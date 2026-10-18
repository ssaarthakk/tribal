import { z } from "zod";
import type { Db } from "./db.js";
import {
  getComponent,
  getPerson,
  getStaleDocs,
  getTeamRanking,
  listComponents,
  simulateDeparture,
} from "./risk.js";
import { search, suggestReviewers, whoKnows } from "./search.js";
import type {
  GraphPath,
  PersonRef,
  Source,
  ToolResult,
  WorkItem,
} from "./schemas.js";

export type Tool = {
  name: string;
  description: string;
  input: z.ZodObject;
  run(db: Db, args: unknown): Promise<ToolResult>;
};

type PathNode = GraphPath["nodes"][number];
type PathLink = GraphPath["links"][number];

const TEAM_RANKING_LIMIT = 15;
const DECISION_LABEL_LENGTH = 60;

const text = z.string().min(1).max(200);

const NOT_FOUND: ToolResult = {
  data: { error: "not_found" },
  sources: [],
  path: { nodes: [], links: [] },
};

function defineTool<S extends z.ZodObject>(
  name: string,
  description: string,
  input: S,
  run: (db: Db, args: z.infer<S>) => Promise<ToolResult>,
): Tool {
  return {
    name,
    description,
    input,
    run: (db, args) => run(db, input.parse(args)),
  };
}

function personNode(person: PersonRef): PathNode {
  return { id: `person:${person.id}`, kind: "person", label: person.name };
}

function componentNode(path: string): PathNode {
  return { id: `component:${path}`, kind: "component", label: path };
}

function decisionNode(decision: { id: string; summary: string }): PathNode {
  return {
    id: `decision:${decision.id}`,
    kind: "decision",
    label: decision.summary.slice(0, DECISION_LABEL_LENGTH),
  };
}

function docNode(doc: { path: string; title: string }): PathNode {
  return { id: `doc:${doc.path}`, kind: "doc", label: doc.title };
}

function link(source: PathNode, type: string, target: PathNode): PathLink {
  return { source: source.id, target: target.id, type };
}

function graphPath(nodes: PathNode[], links: PathLink[] = []): GraphPath {
  return {
    nodes: [...new Map(nodes.map((node) => [node.id, node])).values()],
    links,
  };
}

function decisionSource(decision: {
  summary: string;
  sourceUrl: string;
}): Source {
  return { title: decision.summary, url: decision.sourceUrl };
}

function workSource(item: WorkItem): Source {
  const kind = item.kind === "pr" ? "PR" : "Issue";
  return {
    title: `${kind} #${String(item.number)}: ${item.title}`,
    url: item.url,
  };
}

export const tools: Tool[] = [
  defineTool(
    "search",
    "Full-text search over pull requests, issues, decisions and docs. Use short keywords.",
    z.object({ query: text }),
    async (db, { query }) => {
      const hits = await search(db, query);
      const nodes = hits.map((hit): PathNode => {
        const id = `${hit.kind}:${hit.key}`;
        if (hit.kind === "pr")
          return { id, kind: "pr", label: `PR #${hit.key}` };
        if (hit.kind === "issue")
          return { id, kind: "issue", label: `Issue #${hit.key}` };
        if (hit.kind === "decision")
          return decisionNode({ id: hit.key, summary: hit.title });
        return { id, kind: "doc", label: hit.title };
      });
      return {
        data: hits,
        sources: hits.map((hit) => ({ title: hit.title, url: hit.url })),
        path: graphPath(nodes),
      };
    },
  ),
  defineTool(
    "who_knows",
    "Find the components related to a topic and the people who know them best.",
    z.object({ topic: text }),
    async (db, { topic }) => {
      const result = await whoKnows(db, topic);
      const nodes: PathNode[] = [];
      const links: PathLink[] = [];
      for (const component of result.components) {
        const target = componentNode(component.path);
        nodes.push(target);
        for (const expert of component.experts) {
          const source = personNode(expert.person);
          nodes.push(source);
          links.push(link(source, "KNOWS_ABOUT", target));
        }
      }
      return {
        data: result,
        sources: result.sources,
        path: graphPath(nodes, links),
      };
    },
  ),
  defineTool(
    "bus_factor",
    "List every component with its bus factor (number of active experts) and risk level, riskiest first.",
    z.object({}),
    async (db) => {
      const components = await listComponents(db);
      return {
        data: components,
        sources: [],
        path: graphPath(
          components.map((component) => componentNode(component.path)),
        ),
      };
    },
  ),
  defineTool(
    "get_component",
    "Get one component: its experts, decisions, docs and recent pull requests. Paths look like src/commands.",
    z.object({ path: text }),
    async (db, { path }) => {
      const detail = await getComponent(db, path);
      if (detail === null) return NOT_FOUND;

      const component = componentNode(path);
      const experts = detail.experts.map((expert) => personNode(expert.person));
      const decisions = detail.decisions.map(decisionNode);
      const docs = detail.docs.map(docNode);
      return {
        data: detail,
        sources: [
          ...detail.decisions.map(decisionSource),
          ...detail.docs.map((doc) => ({ title: doc.title, url: doc.url })),
          ...detail.recentPullRequests.map((pullRequest) =>
            workSource({ kind: "pr", ...pullRequest }),
          ),
        ],
        path: graphPath(
          [component, ...experts, ...decisions, ...docs],
          [
            ...experts.map((expert) => link(expert, "KNOWS_ABOUT", component)),
            ...decisions.map((decision) =>
              link(decision, "AFFECTS", component),
            ),
            ...docs.map((doc) => link(doc, "DESCRIBES", component)),
          ],
        ),
      };
    },
  ),
  defineTool(
    "get_person",
    "Get one person by GitHub login: the components they know, decisions they made and their open work.",
    z.object({ personId: text }),
    async (db, { personId }) => {
      const detail = await getPerson(db, personId);
      if (detail === null) return NOT_FOUND;

      const person = personNode(detail.person);
      const components = detail.components.map((component) =>
        componentNode(component.componentPath),
      );
      const decisions = detail.decisions.map(decisionNode);
      return {
        data: detail,
        sources: [
          ...detail.decisions.map(decisionSource),
          ...detail.openWork.map(workSource),
        ],
        path: graphPath(
          [person, ...components, ...decisions],
          [
            ...components.map((component) =>
              link(person, "KNOWS_ABOUT", component),
            ),
            ...decisions.map((decision) => link(person, "MADE", decision)),
          ],
        ),
      };
    },
  ),
  defineTool(
    "simulate_departure",
    "Simulate a person leaving: components that lose experts, decisions losing their only owner, stranded open work and suggested successors.",
    z.object({ personId: text }),
    async (db, { personId }) => {
      const report = await simulateDeparture(db, personId);
      if (report === null) return NOT_FOUND;

      const person = personNode(report.person);
      const nodes = [person];
      const links: PathLink[] = [];
      for (const affected of report.affectedComponents) {
        const component = componentNode(affected.path);
        nodes.push(component);
        links.push(link(person, "KNOWS_ABOUT", component));
        for (const successor of affected.successors) {
          const node = personNode(successor.person);
          nodes.push(node);
          links.push(link(node, "KNOWS_ABOUT", component));
        }
      }
      for (const decision of report.decisionsLosingOwner) {
        const node = decisionNode(decision);
        nodes.push(node);
        links.push(link(person, "MADE", node));
      }
      return {
        data: report,
        sources: [
          ...report.decisionsLosingOwner.map(decisionSource),
          ...report.openWork.map(workSource),
        ],
        path: graphPath(nodes, links),
      };
    },
  ),
  defineTool(
    "team_ranking",
    "Rank people by how central they are to collaboration (PageRank and betweenness).",
    z.object({}),
    async (db) => {
      const ranking = (await getTeamRanking(db)).slice(0, TEAM_RANKING_LIMIT);
      return {
        data: ranking,
        sources: [],
        path: graphPath(ranking.map((ranked) => personNode(ranked.person))),
      };
    },
  ),
  defineTool(
    "decision_history",
    "List the decisions affecting a component, oldest first, including which ones superseded others.",
    z.object({ componentPath: text }),
    async (db, { componentPath }) => {
      const detail = await getComponent(db, componentPath);
      if (detail === null) return NOT_FOUND;

      const component = componentNode(componentPath);
      const decisions = detail.decisions.map(decisionNode);
      const ids = new Set(detail.decisions.map((decision) => decision.id));
      const supersedes = detail.decisions.flatMap((decision) =>
        decision.supersedes
          .filter((oldId) => ids.has(oldId))
          .map((oldId) => ({
            source: `decision:${decision.id}`,
            target: `decision:${oldId}`,
            type: "SUPERSEDES",
          })),
      );
      return {
        data: detail.decisions,
        sources: detail.decisions.map(decisionSource),
        path: graphPath(
          [component, ...decisions],
          [
            ...decisions.map((decision) =>
              link(decision, "AFFECTS", component),
            ),
            ...supersedes,
          ],
        ),
      };
    },
  ),
  defineTool(
    "stale_docs",
    "List docs whose component changed significantly after the doc was last updated.",
    z.object({}),
    async (db) => {
      const staleDocs = await getStaleDocs(db);
      const sources = new Map(
        staleDocs.map((doc) => [doc.url, { title: doc.title, url: doc.url }]),
      );
      return {
        data: staleDocs,
        sources: [...sources.values()],
        path: graphPath(
          staleDocs.flatMap((doc) => [
            docNode(doc),
            componentNode(doc.componentPath),
          ]),
          staleDocs.map((doc) =>
            link(docNode(doc), "DESCRIBES", componentNode(doc.componentPath)),
          ),
        ),
      };
    },
  ),
  defineTool(
    "suggest_reviewers",
    "Suggest up to three reviewers for a pull request or issue from expertise on the components it relates to, excluding its author.",
    z.object({
      kind: z.enum(["pr", "issue"]),
      number: z.number().int().positive(),
    }),
    async (db, { kind, number }) => {
      const suggestion = await suggestReviewers(db, kind, number);
      if (suggestion === null) return NOT_FOUND;

      return {
        data: suggestion,
        sources: suggestion.sources,
        path: graphPath(
          suggestion.reviewers.flatMap((reviewer) => [
            personNode(reviewer.person),
            componentNode(reviewer.componentPath),
          ]),
          suggestion.reviewers.map((reviewer) =>
            link(
              personNode(reviewer.person),
              "KNOWS_ABOUT",
              componentNode(reviewer.componentPath),
            ),
          ),
        ),
      };
    },
  ),
];
