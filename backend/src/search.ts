import { z } from "zod";
import type { Db } from "./db.js";
import {
  COMPONENT_EXPERTS,
  GET_ISSUE_TITLE,
  GET_PULL_REQUEST_TITLE,
  SEARCH_ALL,
  TOPIC_COMPONENTS,
} from "./queries.js";
import {
  ExpertRowSchema,
  SearchHitSchema,
  SourceSchema,
  type PersonRef,
  type SearchHit,
  type Source,
  toExpertise,
  type WhoKnows,
} from "./schemas.js";

const TOPIC_PATH_LIMIT = 3;
const TOPIC_EXPERT_LIMIT = 5;
const TOPIC_SOURCE_LIMIT = 10;
const REVIEWER_LIMIT = 3;

export function toFullTextQuery(text: string): string {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
  return [...new Set(words)].join("|");
}

export async function search(db: Db, text: string): Promise<SearchHit[]> {
  const query = toFullTextQuery(text);
  if (query === "") return [];

  const hits = await db.read(SEARCH_ALL, { query }, SearchHitSchema);
  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.kind.localeCompare(b.kind) ||
      a.key.localeCompare(b.key),
  );
}

export async function whoKnows(db: Db, topic: string): Promise<WhoKnows> {
  const query = toFullTextQuery(topic);
  if (query === "") return { components: [], sources: [] };

  const rows = await db.read(
    TOPIC_COMPONENTS,
    { query },
    SourceSchema.extend({ path: z.string(), score: z.number() }),
  );
  const uniqueRows = [
    ...new Map(
      rows.map((row) => [JSON.stringify([row.path, row.url]), row]),
    ).values(),
  ];
  const relevanceByPath = new Map<string, number>();
  for (const row of uniqueRows) {
    relevanceByPath.set(
      row.path,
      (relevanceByPath.get(row.path) ?? 0) + row.score,
    );
  }
  const topPaths = [...relevanceByPath]
    .sort(([pathA, a], [pathB, b]) => b - a || pathA.localeCompare(pathB))
    .slice(0, TOPIC_PATH_LIMIT);

  const components = [];
  for (const [path, relevance] of topPaths) {
    const experts = await db.read(
      COMPONENT_EXPERTS,
      { path, limit: TOPIC_EXPERT_LIMIT },
      ExpertRowSchema,
    );
    components.push({ path, relevance, experts: experts.map(toExpertise) });
  }

  const sources = new Map(
    uniqueRows
      .filter((row) => topPaths.some(([path]) => path === row.path))
      .map((row) => [
        JSON.stringify([row.title, row.url]),
        { title: row.title, url: row.url },
      ]),
  );
  return {
    components,
    sources: [...sources.values()].slice(0, TOPIC_SOURCE_LIMIT),
  };
}

type ReviewerSuggestion = {
  title: string;
  reviewers: { person: PersonRef; componentPath: string }[];
  sources: Source[];
};

export async function suggestReviewers(
  db: Db,
  kind: "pr" | "issue",
  number: number,
): Promise<ReviewerSuggestion | null> {
  const [item] = await db.read(
    kind === "pr" ? GET_PULL_REQUEST_TITLE : GET_ISSUE_TITLE,
    { number },
    z.object({ title: z.string(), authorId: z.string().nullable() }),
  );
  if (item === undefined) return null;

  const { components, sources } = await whoKnows(db, item.title);
  const reviewers = new Map<string, ReviewerSuggestion["reviewers"][number]>();
  for (const component of components) {
    for (const { person } of component.experts) {
      if (person.id !== item.authorId && !reviewers.has(person.id)) {
        reviewers.set(person.id, { person, componentPath: component.path });
      }
    }
  }
  return {
    title: item.title,
    reviewers: [...reviewers.values()].slice(0, REVIEWER_LIMIT),
    sources,
  };
}
