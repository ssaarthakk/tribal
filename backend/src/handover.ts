import { createHash } from "node:crypto";
import { z } from "zod";
import type { HandoverCache } from "./datafiles.js";
import type { Llm } from "./llm.js";
import type {
  DepartureReport,
  HandoverPlan,
  HandoverResponse,
  PersonRef,
} from "./schemas.js";

const NarrativeSchema = z.object({
  summary: z.string(),
  pairingReasons: z.array(z.string()),
});

type Narrative = z.infer<typeof NarrativeSchema>;

const NARRATIVE_PROMPT =
  "You write short, factual handover plans for engineering teams. Use only facts in the plan JSON. Write a summary of 2 to 4 sentences and one short reason per pairing, in the same order as the pairings.";

const NOTHING_TO_DO = "- Nothing to do.";

export function buildHandoverPlan(report: DepartureReport): HandoverPlan {
  const atRisk = report.affectedComponents.filter(
    (component) => component.busFactorAfter <= 1,
  );
  const firstCollaborator = report.nearbyCollaborators[0]?.person ?? null;
  const firstSuccessor = (path: string): PersonRef | undefined =>
    report.affectedComponents.find((component) => component.path === path)
      ?.successors[0]?.person;
  const { name } = report.person;

  return {
    person: report.person,
    summary: `${name} is an expert on ${String(report.affectedComponents.length)} component(s). After they leave, ${String(report.orphaned.length)} would have no expert and ${String(report.critical.length)} would have one. ${String(report.decisionsLosingOwner.length)} decision(s) would lose their only owner and ${String(report.openWork.length)} open item(s) need a new owner.`,
    knowledgeToDocument: atRisk.map((component) => ({
      componentPath: component.path,
      reason: `Bus factor drops from ${String(component.busFactorBefore)} to ${String(component.busFactorAfter)}.`,
    })),
    pairings: atRisk.flatMap((component) => {
      const successor = component.successors[0]?.person;
      if (successor === undefined) return [];
      return [
        {
          componentPath: component.path,
          with: successor,
          reason: `${successor.name} has the highest remaining expertise on ${component.path}.`,
        },
      ];
    }),
    decisionsNeedingOwner: report.decisionsLosingOwner.map((decision) => ({
      decisionId: decision.id,
      summary: decision.summary,
      sourceUrl: decision.sourceUrl,
      suggestedOwner:
        decision.affects
          .map(firstSuccessor)
          .find((owner) => owner !== undefined) ?? firstCollaborator,
    })),
    workToReassign: report.openWork.map((item) => ({
      ...item,
      suggestedOwner: firstCollaborator,
    })),
  };
}

export async function narrateHandover(
  llm: Llm,
  plan: HandoverPlan,
): Promise<Narrative> {
  return llm.json(
    [
      { role: "system", content: NARRATIVE_PROMPT },
      { role: "user", content: JSON.stringify(plan) },
    ],
    NarrativeSchema,
    "handover_narrative",
  );
}

function applyNarrative(
  plan: HandoverPlan,
  narrative: Narrative,
): HandoverPlan {
  const reasonsFit = narrative.pairingReasons.length === plan.pairings.length;
  return {
    ...plan,
    summary: narrative.summary,
    pairings: plan.pairings.map((pairing, index) => ({
      ...pairing,
      reason: reasonsFit
        ? (narrative.pairingReasons[index] ?? pairing.reason)
        : pairing.reason,
    })),
  };
}

function section(heading: string, items: string[]): string[] {
  return [
    `## ${heading}`,
    "",
    ...(items.length > 0 ? items : [NOTHING_TO_DO]),
    "",
  ];
}

function ownerName(owner: PersonRef | null): string {
  return owner?.name ?? "nobody found";
}

export function renderHandoverMarkdown(plan: HandoverPlan): string {
  return [
    `# Handover plan: ${plan.person.name}`,
    "",
    plan.summary,
    "",
    ...section(
      "Knowledge to document",
      plan.knowledgeToDocument.map(
        (item) => `- \`${item.componentPath}\`: ${item.reason}`,
      ),
    ),
    ...section(
      "Pair up",
      plan.pairings.map(
        (pairing) =>
          `- \`${pairing.componentPath}\`: pair with ${pairing.with.name} (${pairing.with.login ?? pairing.with.id}). ${pairing.reason}`,
      ),
    ),
    ...section(
      "Decisions that need a new owner",
      plan.decisionsNeedingOwner.map(
        (decision) =>
          `- [${decision.summary}](${decision.sourceUrl}): suggested owner ${ownerName(decision.suggestedOwner)}`,
      ),
    ),
    ...section(
      "Open work to reassign",
      plan.workToReassign.map(
        (item) =>
          `- [${item.kind === "pr" ? "PR" : "Issue"} #${String(item.number)}: ${item.title}](${item.url}): suggested owner ${ownerName(item.suggestedOwner)}`,
      ),
    ),
  ].join("\n");
}

export function renderHandoverIssue(plan: HandoverPlan): {
  title: string;
  body: string;
} {
  const body = renderHandoverMarkdown(plan)
    .split("\n")
    .slice(2)
    .map((line) =>
      line.startsWith("- ") && line !== NOTHING_TO_DO
        ? `- [ ] ${line.slice(2)}`
        : line,
    )
    .join("\n");
  return { title: `Handover plan for ${plan.person.name}`, body };
}

export function reportHash(report: DepartureReport): string {
  return createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex")
    .slice(0, 16);
}

function toResponse(
  plan: HandoverPlan,
  generatedBy: HandoverResponse["generatedBy"],
): HandoverResponse {
  const issue = renderHandoverIssue(plan);
  return {
    plan,
    markdown: renderHandoverMarkdown(plan),
    issueTitle: issue.title,
    issueBody: issue.body,
    generatedBy,
  };
}

export async function getHandover(input: {
  report: DepartureReport;
  llm: Llm | null;
  cache: HandoverCache;
  saveCache?: (cache: HandoverCache) => Promise<void>;
}): Promise<HandoverResponse> {
  const plan = buildHandoverPlan(input.report);
  const personId = input.report.person.id;
  const hash = reportHash(input.report);
  const cached = input.cache.entries.find(
    (entry) => entry.personId === personId && entry.reportHash === hash,
  );
  if (cached !== undefined) {
    return toResponse(applyNarrative(plan, cached), "cache");
  }
  if (input.llm === null) return toResponse(plan, "template");
  let narrative: Narrative;
  try {
    narrative = await narrateHandover(input.llm, plan);
  } catch {
    return toResponse(plan, "template");
  }
  await input.saveCache?.({
    entries: [
      ...input.cache.entries.filter((entry) => entry.personId !== personId),
      { personId, reportHash: hash, ...narrative },
    ],
  });
  return toResponse(applyNarrative(plan, narrative), "llm");
}
