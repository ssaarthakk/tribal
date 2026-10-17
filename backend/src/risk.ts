import { z } from "zod";
import type { Db, Params } from "./db.js";
import { SCORING } from "./expertise.js";
import {
  COMPONENT_DECISIONS,
  COMPONENT_DOCS,
  COMPONENT_EXPERTS,
  COMPONENT_RECENT_PULL_REQUESTS,
  COUNT_NODES,
  DEPARTURE_COMPONENTS,
  DEPARTURE_DECISIONS,
  DEPARTURE_SUCCESSORS,
  GET_COMPONENT,
  GET_PERSON,
  LIST_COMPONENTS,
  NEARBY_COLLABORATORS,
  OPEN_WORK,
  PERSON_COMPONENTS,
  PERSON_DECISIONS,
  RISK_MAP_LINKS,
  TEAM_BETWEENNESS,
  TEAM_PAGERANK,
} from "./queries.js";
import {
  type ComponentDetail,
  ComponentSummarySchema,
  type ComponentSummary,
  DecisionViewSchema,
  type DecisionView,
  type DepartureReport,
  DocRefSchema,
  ExpertRowSchema,
  OrphanedDecisionSchema,
  PersonComponentSchema,
  type PersonDetail,
  PersonRefSchema,
  PullRequestRefSchema,
  type RiskMap,
  RiskMapLinkSchema,
  riskLevel,
  type TeamRanking,
  toExpertise,
  toIso,
  WorkItemSchema,
} from "./schemas.js";

const ComponentRowSchema = ComponentSummarySchema.omit({ risk: true });

function toComponentSummary(
  row: z.infer<typeof ComponentRowSchema>,
): ComponentSummary {
  return { ...row, risk: riskLevel(row.busFactor) };
}

async function readDecisions(
  db: Db,
  cypher: string,
  params: Params,
): Promise<DecisionView[]> {
  const rows = await db.read(
    cypher,
    params,
    DecisionViewSchema.extend({ decidedAt: z.number() }),
  );
  return rows.map((row) => ({
    ...row,
    decidedAt: toIso(row.decidedAt),
    madeBy: row.madeBy.sort(),
    supersedes: row.supersedes.sort(),
  }));
}

export async function countNodes(db: Db): Promise<number> {
  const rows = await db.read(COUNT_NODES, {}, z.object({ nodes: z.number() }));
  return rows[0]?.nodes ?? 0;
}

export async function listComponents(db: Db): Promise<ComponentSummary[]> {
  const rows = await db.read(LIST_COMPONENTS, {}, ComponentRowSchema);
  return rows.map(toComponentSummary);
}

export async function getRiskMap(db: Db): Promise<RiskMap> {
  const rows = await db.read(
    RISK_MAP_LINKS,
    { minShare: SCORING.riskMapMinShare },
    RiskMapLinkSchema.extend(PersonRefSchema.omit({ id: true }).shape),
  );
  const people = new Map(
    rows.map((row) => [
      row.personId,
      { id: row.personId, login: row.login, name: row.name },
    ]),
  );
  return {
    people: [...people.values()].sort((a, b) => a.id.localeCompare(b.id)),
    components: await listComponents(db),
    links: rows.map((row) => ({
      personId: row.personId,
      componentPath: row.componentPath,
      score: row.score,
      share: row.share,
      expert: row.expert,
    })),
  };
}

export async function getTeamRanking(db: Db): Promise<TeamRanking> {
  const pageRanks = await db.read(
    TEAM_PAGERANK,
    {},
    PersonRefSchema.extend({ score: z.number() }),
  );
  const betweenness = await db.read(
    TEAM_BETWEENNESS,
    {},
    z.object({ id: z.string(), score: z.number() }),
  );
  const betweennessById = new Map(
    betweenness.map((row) => [row.id, row.score]),
  );
  return pageRanks
    .map(({ score, ...person }) => ({
      person,
      pageRank: score,
      betweenness: betweennessById.get(person.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.pageRank - a.pageRank || a.person.id.localeCompare(b.person.id),
    );
}

export async function getComponent(
  db: Db,
  path: string,
): Promise<ComponentDetail | null> {
  const [component] = await db.read(
    GET_COMPONENT,
    { path },
    ComponentRowSchema,
  );
  if (component === undefined) return null;

  const experts = await db.read(
    COMPONENT_EXPERTS,
    { path, limit: 10 },
    ExpertRowSchema,
  );
  const docs = await db.read(
    COMPONENT_DOCS,
    { path },
    DocRefSchema.extend({ updatedAt: z.number() }),
  );
  const pullRequests = await db.read(
    COMPONENT_RECENT_PULL_REQUESTS,
    { path, limit: 5 },
    PullRequestRefSchema.extend({ createdAt: z.number() }),
  );

  return {
    component: toComponentSummary(component),
    experts: experts.map(toExpertise),
    decisions: await getDecisionHistory(db, path),
    docs: docs.map((doc) => ({ ...doc, updatedAt: toIso(doc.updatedAt) })),
    recentPullRequests: pullRequests.map((pullRequest) => ({
      ...pullRequest,
      createdAt: toIso(pullRequest.createdAt),
    })),
  };
}

export async function getPerson(
  db: Db,
  personId: string,
): Promise<PersonDetail | null> {
  const [person] = await db.read(GET_PERSON, { personId }, PersonRefSchema);
  if (person === undefined) return null;

  const components = await db.read(
    PERSON_COMPONENTS,
    { personId },
    PersonComponentSchema.extend({ lastActive: z.number() }),
  );
  return {
    person,
    components: components.map((component) => ({
      ...component,
      lastActive: toIso(component.lastActive),
    })),
    decisions: await readDecisions(db, PERSON_DECISIONS, { personId }),
    openWork: await readOpenWork(db, personId),
  };
}

export async function getDecisionHistory(
  db: Db,
  componentPath: string,
): Promise<DecisionView[]> {
  return readDecisions(db, COMPONENT_DECISIONS, { path: componentPath });
}

async function readOpenWork(db: Db, personId: string) {
  const rows = await db.read(OPEN_WORK, { personId }, WorkItemSchema);
  return rows.sort(
    (a, b) =>
      Number(a.kind === "issue") - Number(b.kind === "issue") ||
      a.number - b.number,
  );
}

export async function simulateDeparture(
  db: Db,
  personId: string,
): Promise<DepartureReport | null> {
  const [person] = await db.read(GET_PERSON, { personId }, PersonRefSchema);
  if (person === undefined) return null;

  const components = await db.read(
    DEPARTURE_COMPONENTS,
    { personId },
    z.object({ path: z.string(), before: z.number(), after: z.number() }),
  );
  const paths = components.map((component) => component.path);
  const successorRows =
    paths.length === 0
      ? []
      : await db.read(
          DEPARTURE_SUCCESSORS,
          { personId, paths },
          z.object({
            path: z.string(),
            successors: z.array(
              PersonRefSchema.extend({
                score: z.number(),
                lastActive: z.number(),
              }),
            ),
          }),
        );
  const successorsByPath = new Map(
    successorRows.map((row) => [
      row.path,
      row.successors.map(({ score, lastActive, ...successor }) => ({
        person: successor,
        score,
        lastActive: toIso(lastActive),
      })),
    ]),
  );
  const affectedComponents = components.map((component) => ({
    path: component.path,
    busFactorBefore: component.before,
    busFactorAfter: component.after,
    riskAfter: riskLevel(component.after),
    successors: successorsByPath.get(component.path) ?? [],
  }));

  const decisions = await db.read(
    DEPARTURE_DECISIONS,
    { personId },
    OrphanedDecisionSchema.extend({ decidedAt: z.number() }),
  );
  const collaborators = await db.read(
    NEARBY_COLLABORATORS,
    { personId },
    PersonRefSchema.extend({ weight: z.number() }),
  );

  return {
    person,
    affectedComponents,
    orphaned: affectedComponents
      .filter((component) => component.busFactorAfter === 0)
      .map((component) => component.path),
    critical: affectedComponents
      .filter((component) => component.busFactorAfter === 1)
      .map((component) => component.path),
    decisionsLosingOwner: decisions.map((decision) => ({
      ...decision,
      decidedAt: toIso(decision.decidedAt),
    })),
    openWork: await readOpenWork(db, personId),
    nearbyCollaborators: collaborators.map(({ weight, ...collaborator }) => ({
      person: collaborator,
      weight,
    })),
  };
}
