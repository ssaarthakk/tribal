import { z } from "zod";
import { componentName, componentOf, selectComponents } from "./components.js";
import type { DecisionCache, RepoConfig, Snapshot } from "./datafiles.js";
import type { Db } from "./db.js";
import { resolveIdentities } from "./identity.js";
import {
  COUNT_LABELS,
  COUNT_RELATIONSHIPS,
  CREATE_FULLTEXT_INDEXES,
  CREATE_INDEXES,
  MERGE_AFFECTS,
  MERGE_CLOSES,
  MERGE_COMMITS,
  MERGE_COMPONENTS,
  MERGE_CONTAINS,
  MERGE_DECISIONS_IN_ISSUES,
  MERGE_DECISIONS_IN_PULL_REQUESTS,
  MERGE_DOCS,
  MERGE_FILES,
  MERGE_ISSUE_COMMENTS,
  MERGE_ISSUES,
  MERGE_MADE,
  MERGE_MODIFIES,
  MERGE_PEOPLE,
  MERGE_PR_COMMENTS,
  MERGE_PULL_REQUESTS,
  MERGE_REVIEWS,
  MERGE_SUPERSEDES,
  SET_DECISION_STATUS,
} from "./queries.js";
import { countNodes } from "./risk.js";

const CHUNK_SIZE = 500;

export type LoadSummary = { nodes: number; seconds: number };

async function insertRows(
  db: Db,
  cypher: string,
  rows: unknown[],
): Promise<void> {
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    await db.write(cypher, { rows: rows.slice(start, start + CHUNK_SIZE) });
  }
}

export function docComponents(
  doc: Snapshot["docs"][number],
  components: string[],
  config: RepoConfig,
): string[] {
  const own = componentOf(doc.path, config);
  const mentioned = components.filter(
    (component) => component === own || doc.body.includes(component),
  );
  return [...new Set(mentioned)].sort();
}

export async function loadSnapshot(
  db: Db,
  snapshot: Snapshot,
  decisions: DecisionCache,
): Promise<LoadSummary> {
  const startedAt = Date.now();
  const { config } = snapshot;
  const identities = resolveIdentities(snapshot);
  const components = selectComponents(snapshot);

  await db.deleteGraph();
  for (const cypher of [...CREATE_INDEXES, ...CREATE_FULLTEXT_INDEXES]) {
    await db.write(cypher);
  }

  await insertRows(db, MERGE_PEOPLE, identities.people);
  await insertRows(
    db,
    MERGE_COMPONENTS,
    components.map((path) => ({ path, name: componentName(path) })),
  );

  const fileComponents = new Map<string, string | null>();
  for (const commit of snapshot.commits) {
    for (const file of commit.files) {
      const component = componentOf(file.path, config);
      if (component !== null) {
        fileComponents.set(
          file.path,
          components.includes(component) ? component : null,
        );
      }
    }
  }
  await insertRows(
    db,
    MERGE_FILES,
    [...fileComponents].map(([path, component]) => ({ path, component })),
  );

  await insertRows(
    db,
    MERGE_COMMITS,
    snapshot.commits.map((commit) => ({
      sha: commit.sha,
      message: commit.message,
      authoredAt: Date.parse(commit.authoredAt),
      url: commit.url,
      authorId: identities.commitAuthor.get(commit.sha) ?? null,
    })),
  );
  await insertRows(
    db,
    MERGE_MODIFIES,
    snapshot.commits.flatMap((commit) =>
      commit.files
        .filter((file) => fileComponents.has(file.path))
        .map((file) => ({
          sha: commit.sha,
          path: file.path,
          additions: file.additions,
          deletions: file.deletions,
        })),
    ),
  );

  await insertRows(
    db,
    MERGE_PULL_REQUESTS,
    snapshot.pullRequests.map((pullRequest) => ({
      number: pullRequest.number,
      title: pullRequest.title,
      body: pullRequest.body,
      state: pullRequest.state,
      createdAt: Date.parse(pullRequest.createdAt),
      mergedAt:
        pullRequest.mergedAt === null ? null : Date.parse(pullRequest.mergedAt),
      url: pullRequest.url,
      authorId: identities.personIdForLogin(pullRequest.authorLogin),
    })),
  );
  await insertRows(
    db,
    MERGE_CONTAINS,
    snapshot.pullRequests.flatMap((pullRequest) =>
      pullRequest.mergeCommitSha === null
        ? []
        : [{ number: pullRequest.number, sha: pullRequest.mergeCommitSha }],
    ),
  );

  const reviewRows = snapshot.pullRequests.flatMap((pullRequest) => {
    const latestByReviewer = new Map<
      string,
      { number: number; reviewerId: string; state: string; at: number }
    >();
    const reviews = pullRequest.reviews.toSorted(
      (a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt),
    );
    for (const review of reviews) {
      const reviewerId = identities.personIdForLogin(review.reviewerLogin);
      if (reviewerId !== null && reviewerId !== pullRequest.authorLogin) {
        latestByReviewer.set(reviewerId, {
          number: pullRequest.number,
          reviewerId,
          state: review.state,
          at: Date.parse(review.submittedAt),
        });
      }
    }
    return [...latestByReviewer.values()];
  });
  await insertRows(db, MERGE_REVIEWS, reviewRows);

  await insertRows(
    db,
    MERGE_ISSUES,
    snapshot.issues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      createdAt: Date.parse(issue.createdAt),
      closedAt: issue.closedAt === null ? null : Date.parse(issue.closedAt),
      url: issue.url,
      authorId: identities.personIdForLogin(issue.authorLogin),
    })),
  );
  await insertRows(
    db,
    MERGE_CLOSES,
    snapshot.pullRequests.flatMap((pullRequest) =>
      pullRequest.closesIssues.map((issueNumber) => ({
        prNumber: pullRequest.number,
        issueNumber,
      })),
    ),
  );

  const commentRows = (kind: "pr" | "issue") =>
    snapshot.comments
      .filter((comment) => comment.parent.kind === kind)
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: Date.parse(comment.createdAt),
        url: comment.url,
        authorId: identities.personIdForLogin(comment.authorLogin),
        number: comment.parent.number,
      }));
  await insertRows(db, MERGE_PR_COMMENTS, commentRows("pr"));
  await insertRows(db, MERGE_ISSUE_COMMENTS, commentRows("issue"));

  await insertRows(
    db,
    MERGE_DOCS,
    snapshot.docs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      body: doc.body,
      updatedAt: Date.parse(doc.updatedAt),
      url: doc.url,
      components: docComponents(doc, components, config),
    })),
  );

  const pullRequestNumbers = new Set(
    snapshot.pullRequests.map((pullRequest) => pullRequest.number),
  );
  const issueNumbers = new Set(snapshot.issues.map((issue) => issue.number));
  const loadedEntries = decisions.entries.flatMap((entry) => {
    const [kind, number] = entry.threadKey.split("-");
    const exists =
      kind === "pr"
        ? pullRequestNumbers.has(Number(number))
        : issueNumbers.has(Number(number));
    return exists ? [{ kind, number: Number(number), entry }] : [];
  });
  const loadedDecisions = loadedEntries.flatMap(({ entry }) => entry.decisions);
  const loadedIds = new Set(loadedDecisions.map((decision) => decision.id));
  const decisionRows = (kind: "pr" | "issue") =>
    loadedEntries
      .filter((loaded) => loaded.kind === kind)
      .flatMap(({ number, entry }) =>
        entry.decisions.map((decision) => ({
          id: decision.id,
          summary: decision.summary,
          rationale: decision.rationale,
          decidedAt: Date.parse(decision.decidedAt),
          confidence: decision.confidence,
          number,
        })),
      );
  await insertRows(db, MERGE_DECISIONS_IN_PULL_REQUESTS, decisionRows("pr"));
  await insertRows(db, MERGE_DECISIONS_IN_ISSUES, decisionRows("issue"));

  await insertRows(
    db,
    MERGE_MADE,
    loadedDecisions.flatMap((decision) =>
      decision.madeBy.flatMap((login) => {
        const personId = identities.personIdForLogin(login);
        return personId === null ? [] : [{ decisionId: decision.id, personId }];
      }),
    ),
  );
  await insertRows(
    db,
    MERGE_AFFECTS,
    loadedDecisions.flatMap((decision) =>
      decision.affects
        .filter((componentPath) => components.includes(componentPath))
        .map((componentPath) => ({ decisionId: decision.id, componentPath })),
    ),
  );
  await insertRows(
    db,
    MERGE_SUPERSEDES,
    loadedDecisions.flatMap((decision) =>
      decision.supersedes
        .filter((oldId) => loadedIds.has(oldId))
        .map((oldId) => ({ newId: decision.id, oldId })),
    ),
  );
  await db.write(SET_DECISION_STATUS);

  return {
    nodes: await countNodes(db),
    seconds: (Date.now() - startedAt) / 1000,
  };
}

export async function countByLabel(db: Db): Promise<Record<string, number>> {
  const rows = await db.read(
    COUNT_LABELS,
    {},
    z.object({ label: z.string(), count: z.number() }),
  );
  return Object.fromEntries(rows.map((row) => [row.label, row.count]));
}

export async function countByRelationship(
  db: Db,
): Promise<Record<string, number>> {
  const rows = await db.read(
    COUNT_RELATIONSHIPS,
    {},
    z.object({ type: z.string(), count: z.number() }),
  );
  return Object.fromEntries(rows.map((row) => [row.type, row.count]));
}
