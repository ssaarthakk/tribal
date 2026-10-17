import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { componentOf, selectComponents } from "./components.js";
import type { DecisionCache, Snapshot } from "./datafiles.js";
import { RateLimitError, type Llm } from "./llm.js";

export type Thread = {
  key: string;
  kind: "pr" | "issue";
  number: number;
  title: string;
  body: string;
  createdAt: string;
  url: string;
  participants: string[];
  components: string[];
  comments: { author: string; createdAt: string; body: string }[];
};

type ThreadSource = Pick<
  Snapshot["issues"][number],
  "number" | "title" | "body" | "createdAt" | "url" | "authorLogin"
>;

export const DECISION_HINT =
  /\b(decid\w*|decision\w*|agree[ds]?|instead of|rather than|we (?:should|will|won't)|propos\w*|rfc|deprecat\w*|trade-?offs?|going forward|supersed\w*)\b/gi;

export const ExtractionSchema = z.object({
  threads: z.array(
    z.object({
      key: z.string(),
      decisions: z.array(
        z.object({
          summary: z.string(),
          rationale: z.string(),
          decidedAt: z.string(),
          madeBy: z.array(z.string()),
          affects: z.array(z.string()),
          supersedes: z.array(z.string()),
          confidence: z.number(),
        }),
      ),
    }),
  ),
});

const BODY_LIMIT = 1500;
const COMMENT_LIMIT = 15;
const COMMENT_BODY_LIMIT = 500;
const BATCH_SIZE = 5;
const EARLIER_DECISIONS_LIMIT = 30;
const MIN_CONFIDENCE = 0.5;
const BATCH_PAUSE_MS = 4000;
const RATE_LIMIT_PAUSE_MS = 60000;
const RATE_LIMIT_RETRIES = 5;

const SYSTEM_PROMPT =
  "You read GitHub pull request and issue threads and extract engineering decisions: choices the participants explicitly made or agreed on, such as a design, a library, an approach, a convention, or rejecting an alternative. Ignore routine work such as bug fixes without a stated choice, version bumps and review nits. Return every thread key with a list of decisions, empty if there are none. For each decision give: summary (one sentence, at most 25 words), rationale (why, at most 40 words, taken from the thread), decidedAt (ISO 8601 time of the comment or event where it was decided), madeBy (GitHub logins from the thread's participants who made or agreed to it), affects (paths from the components list), supersedes (ids from earlierDecisions that this decision replaces, otherwise empty) and confidence (0 to 1). Use only information in the threads.";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function buildThreads(snapshot: Snapshot): Thread[] {
  const selected = new Set(selectComponents(snapshot));
  const bots = new Set(snapshot.bots);
  const commitComponents = new Map(
    snapshot.commits.map((commit) => [
      commit.sha,
      commit.files.flatMap((file) => {
        const component = componentOf(file.path, snapshot.config);
        return component !== null && selected.has(component) ? [component] : [];
      }),
    ]),
  );
  const pullRequestComponents = (
    pullRequest: Snapshot["pullRequests"][number],
  ) =>
    pullRequest.mergeCommitSha === null
      ? []
      : (commitComponents.get(pullRequest.mergeCommitSha) ?? []);

  function toThread(
    kind: Thread["kind"],
    source: ThreadSource,
    otherParticipants: string[],
    components: string[],
  ): Thread {
    const comments = snapshot.comments
      .filter(
        (comment) =>
          comment.parent.kind === kind &&
          comment.parent.number === source.number,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const logins = [
      source.authorLogin,
      ...otherParticipants,
      ...comments.map((comment) => comment.authorLogin),
    ];
    return {
      key: `${kind}-${String(source.number)}`,
      kind,
      number: source.number,
      title: source.title,
      body: source.body.slice(0, BODY_LIMIT),
      createdAt: source.createdAt,
      url: source.url,
      participants: uniqueSorted(
        logins.filter(
          (login): login is string => login !== null && !bots.has(login),
        ),
      ),
      components: uniqueSorted(components),
      comments: comments.slice(0, COMMENT_LIMIT).map((comment) => ({
        author: comment.authorLogin ?? "unknown",
        createdAt: comment.createdAt,
        body: comment.body.slice(0, COMMENT_BODY_LIMIT),
      })),
    };
  }

  return [
    ...snapshot.pullRequests.map((pullRequest) =>
      toThread(
        "pr",
        pullRequest,
        pullRequest.reviews.map((review) => review.reviewerLogin),
        pullRequestComponents(pullRequest),
      ),
    ),
    ...snapshot.issues.map((issue) =>
      toThread(
        "issue",
        issue,
        [],
        snapshot.pullRequests
          .filter((pullRequest) =>
            pullRequest.closesIssues.includes(issue.number),
          )
          .flatMap(pullRequestComponents),
      ),
    ),
  ];
}

function hintCount(thread: Thread): number {
  const texts = [
    thread.title,
    thread.body,
    ...thread.comments.map((comment) => comment.body),
  ];
  return texts.join("\n").match(DECISION_HINT)?.length ?? 0;
}

export function selectCandidateThreads(
  threads: Thread[],
  max: number,
): Thread[] {
  return threads
    .map((thread) => ({ thread, hints: hintCount(thread) }))
    .filter(({ hints }) => hints > 0)
    .sort(
      (a, b) =>
        b.hints - a.hints ||
        b.thread.createdAt.localeCompare(a.thread.createdAt) ||
        a.thread.key.localeCompare(b.thread.key),
    )
    .slice(0, max)
    .map(({ thread }) => thread)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key),
    );
}

export function threadHash(thread: Thread, model: string): string {
  return createHash("sha256")
    .update(model + JSON.stringify(thread))
    .digest("hex")
    .slice(0, 16);
}

function decidedAtWithin(
  value: string,
  thread: Thread,
  fetchedAt: string,
): string {
  const time = Date.parse(value);
  return time >= Date.parse(thread.createdAt) && time <= Date.parse(fetchedAt)
    ? new Date(time).toISOString()
    : thread.createdAt;
}

async function withRateLimitRetry<T>(
  request: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (
        !(error instanceof RateLimitError) ||
        attempt === RATE_LIMIT_RETRIES
      ) {
        throw error;
      }
      await sleep(RATE_LIMIT_PAUSE_MS);
    }
  }
}

export async function extractDecisions(input: {
  snapshot: Snapshot;
  cache: DecisionCache;
  llm: Llm;
  onBatch(cache: DecisionCache): Promise<void>;
  sleep?(ms: number): Promise<void>;
}): Promise<DecisionCache> {
  const { snapshot, llm } = input;
  const sleep = (ms: number) => input.sleep?.(ms) ?? setTimeout(ms);
  const components = selectComponents(snapshot);
  const entries = new Map(
    input.cache.entries.map((entry) => [entry.threadKey, entry]),
  );
  const currentCache = (): DecisionCache => ({
    entries: [...entries.values()].sort((a, b) =>
      a.threadKey.localeCompare(b.threadKey),
    ),
  });
  const pending = selectCandidateThreads(
    buildThreads(snapshot),
    snapshot.config.maxDecisionThreads,
  ).filter(
    (thread) =>
      entries.get(thread.key)?.contentHash !== threadHash(thread, llm.model),
  );

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    if (start > 0) await sleep(BATCH_PAUSE_MS);
    const batch = pending.slice(start, start + BATCH_SIZE);
    const batchComponents = new Set(
      batch.flatMap((thread) => thread.components),
    );
    const earlierDecisions = [...entries.values()]
      .flatMap((entry) => entry.decisions)
      .filter(
        (decision) =>
          batchComponents.size === 0 ||
          decision.affects.some((path) => batchComponents.has(path)),
      )
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
      .slice(0, EARLIER_DECISIONS_LIMIT)
      .map(({ id, summary, affects }) => ({ id, summary, affects }));
    const earlierIds = new Set(earlierDecisions.map((decision) => decision.id));

    const extraction = await withRateLimitRetry(
      () =>
        llm.json(
          [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                components,
                earlierDecisions,
                threads: batch,
              }),
            },
          ],
          ExtractionSchema,
          "decision_extraction",
        ),
      sleep,
    );

    for (const thread of batch) {
      const returned =
        extraction.threads.find((extracted) => extracted.key === thread.key)
          ?.decisions ?? [];
      const decisions = returned
        .map((decision) => ({
          ...decision,
          madeBy: decision.madeBy.filter((login) =>
            thread.participants.includes(login),
          ),
          affects: decision.affects.filter((path) => components.includes(path)),
          supersedes: decision.supersedes.filter((id) => earlierIds.has(id)),
        }))
        .filter(
          (decision) =>
            decision.confidence >= MIN_CONFIDENCE && decision.madeBy.length > 0,
        )
        .map((decision, index) => ({
          id: `${thread.key}-${String(index + 1)}`,
          ...decision,
          decidedAt: decidedAtWithin(
            decision.decidedAt,
            thread,
            snapshot.fetchedAt,
          ),
          confidence: Math.min(decision.confidence, 1),
        }));
      entries.set(thread.key, {
        threadKey: thread.key,
        contentHash: threadHash(thread, llm.model),
        decisions,
      });
    }
    await input.onBatch(currentCache());
  }

  return currentCache();
}
