import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildHandoverPlan,
  getHandover,
  renderHandoverIssue,
  renderHandoverMarkdown,
  reportHash,
} from "./handover.js";
import { RateLimitError, type Llm } from "./llm.js";
import { simulateDeparture } from "./risk.js";
import type { DepartureReport } from "./schemas.js";
import { withFixtureGraph } from "./test-graph.js";

const FIXTURE_URL = "https://github.com/tribal-fixture/shop";

const ALICE_MARKDOWN = `# Handover plan: Alice Ng

Alice Ng is an expert on 3 component(s). After they leave, 1 would have no expert and 2 would have one. 1 decision(s) would lose their only owner and 2 open item(s) need a new owner.

## Knowledge to document

- \`src/db\`: Bus factor drops from 1 to 0.
- \`docs\`: Bus factor drops from 2 to 1.
- \`src/api\`: Bus factor drops from 2 to 1.

## Pair up

- \`src/db\`: pair with Bob Okafor (bob). Bob Okafor has the highest remaining expertise on src/db.
- \`docs\`: pair with Erin Walsh (erin). Erin Walsh has the highest remaining expertise on docs.
- \`src/api\`: pair with Bob Okafor (bob). Bob Okafor has the highest remaining expertise on src/api.

## Decisions that need a new owner

- [Use one shared connection pool in the database layer](${FIXTURE_URL}/pull/3): suggested owner Bob Okafor

## Open work to reassign

- [PR #8: Add read replicas to the db layer](${FIXTURE_URL}/pull/8): suggested owner Carol Diaz
- [Issue #12: Document the connection pool settings](${FIXTURE_URL}/issues/12): suggested owner Carol Diaz
`;

function fakeLlm(answer: () => unknown) {
  let calls = 0;
  const llm: Llm = {
    model: "test-model",
    json(_messages, schema) {
      calls += 1;
      return Promise.resolve().then(() => schema.parse(answer()));
    },
    chat() {
      return Promise.reject(new Error("chat is not used"));
    },
  };
  return { llm, calls: () => calls };
}

describe("handover", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;
  let report: DepartureReport;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
    const alice = await simulateDeparture(fixture.db, "alice");
    if (alice === null) throw new Error("alice is missing from the fixture");
    report = alice;
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("builds the template plan for alice", () => {
    const plan = buildHandoverPlan(report);
    expect(plan.knowledgeToDocument.map((item) => item.componentPath)).toEqual([
      "src/db",
      "docs",
      "src/api",
    ]);
    expect(plan.pairings.map((pairing) => pairing.with.id)).toEqual([
      "bob",
      "erin",
      "bob",
    ]);
    expect(
      plan.decisionsNeedingOwner.map((decision) => [
        decision.decisionId,
        decision.suggestedOwner?.id,
      ]),
    ).toEqual([["pr-3-1", "bob"]]);
    expect(
      plan.workToReassign.map((item) => [
        item.kind,
        item.number,
        item.suggestedOwner?.id,
      ]),
    ).toEqual([
      ["pr", 8, "carol"],
      ["issue", 12, "carol"],
    ]);
  });

  it("renders the markdown template", () => {
    expect(renderHandoverMarkdown(buildHandoverPlan(report))).toBe(
      ALICE_MARKDOWN,
    );
  });

  it("renders the issue text with checkboxes", () => {
    const plan = buildHandoverPlan(report);
    const issue = renderHandoverIssue(plan);
    expect(issue.title).toBe("Handover plan for Alice Ng");
    expect(issue.body.split("\n")[0]).toBe(plan.summary);
    expect(issue.body).toContain("- [ ] `src/db`");
  });

  it("uses the cache without calling the LLM", async () => {
    const { llm, calls } = fakeLlm(() => ({}));
    const response = await getHandover({
      report,
      llm,
      cache: {
        entries: [
          {
            personId: "alice",
            reportHash: reportHash(report),
            summary: "Cached summary.",
            pairingReasons: ["a", "b", "c"],
          },
        ],
      },
    });
    expect(calls()).toBe(0);
    expect(response.generatedBy).toBe("cache");
    expect(response.plan.summary).toBe("Cached summary.");
    expect(response.plan.pairings.map((pairing) => pairing.reason)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("falls back to the template when the LLM fails", async () => {
    const { llm } = fakeLlm(() => {
      throw new RateLimitError("429");
    });
    const response = await getHandover({ report, llm, cache: { entries: [] } });
    expect(response.generatedBy).toBe("template");
    expect(response.markdown).toBe(ALICE_MARKDOWN);
  });

  it("keeps the template reasons when the LLM returns the wrong count", async () => {
    const { llm } = fakeLlm(() => ({
      summary: "LLM summary.",
      pairingReasons: ["a", "b"],
    }));
    const saved: unknown[] = [];
    const response = await getHandover({
      report,
      llm,
      cache: { entries: [] },
      saveCache: (cache) => {
        saved.push(cache);
        return Promise.resolve();
      },
    });
    expect(response.generatedBy).toBe("llm");
    expect(response.plan.summary).toBe("LLM summary.");
    expect(response.plan.pairings).toEqual(buildHandoverPlan(report).pairings);
    expect(saved).toHaveLength(1);
  });
});
