import { beforeAll, describe, expect, it } from "vitest";
import {
  DATA_FILES,
  SnapshotSchema,
  readJsonFile,
  type DecisionCache,
  type Snapshot,
} from "./datafiles.js";
import {
  buildThreads,
  extractDecisions,
  selectCandidateThreads,
} from "./decisions.js";
import { RateLimitError, type Llm } from "./llm.js";

function fakeLlm(answers: unknown[]) {
  const calls: unknown[] = [];
  const llm: Llm = {
    model: "test-model",
    json(messages, schema) {
      calls.push(messages);
      const answer = answers.shift();
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(schema.parse(answer));
    },
    chat() {
      return Promise.reject(new Error("chat is not used"));
    },
  };
  return { llm, calls };
}

function fakeSleep() {
  const waits: number[] = [];
  const sleep = (ms: number) => {
    waits.push(ms);
    return Promise.resolve();
  };
  return { sleep, waits };
}

const decision = {
  summary: "Use cursor pagination",
  rationale: "Offset is slow.",
  decidedAt: "2026-04-04T00:00:00.000Z",
  madeBy: ["alice", "mallory"],
  affects: ["src/api", "src/nope"],
  supersedes: ["x-1"],
  confidence: 0.9,
};

const answer = {
  threads: [
    {
      key: "issue-9",
      decisions: [decision, { ...decision, confidence: 0.3 }],
    },
  ],
};

describe("decisions", () => {
  let fixture: Snapshot;
  const empty: DecisionCache = { entries: [] };

  beforeAll(async () => {
    fixture = await readJsonFile(DATA_FILES.fixtureSnapshot, SnapshotSchema);
  });

  it("builds threads with participants and components", () => {
    const threads = buildThreads(fixture);
    const pr3 = threads.find((thread) => thread.key === "pr-3");
    const issue9 = threads.find((thread) => thread.key === "issue-9");
    expect(pr3?.participants).toEqual(["alice", "dave"]);
    expect(pr3?.components).toEqual(["src/db"]);
    expect(issue9?.participants).toEqual(["alice", "bob"]);
    expect(issue9?.components).toEqual(["src/api"]);
  });

  it("selects the candidate threads", () => {
    const candidates = selectCandidateThreads(buildThreads(fixture), 10);
    expect(candidates.map((thread) => thread.key)).toEqual(["issue-9", "pr-3"]);
  });

  it("drops invalid values and assigns ids", async () => {
    const { llm, calls } = fakeLlm([answer]);
    const batches: DecisionCache[] = [];
    const result = await extractDecisions({
      snapshot: fixture,
      cache: empty,
      llm,
      onBatch: (cache) => {
        batches.push(cache);
        return Promise.resolve();
      },
      sleep: fakeSleep().sleep,
    });
    expect(calls).toHaveLength(1);
    expect(batches).toEqual([result]);
    expect(result.entries.map((entry) => entry.threadKey)).toEqual([
      "issue-9",
      "pr-3",
    ]);
    expect(result.entries[0]?.decisions).toEqual([
      {
        id: "issue-9-1",
        summary: decision.summary,
        rationale: decision.rationale,
        decidedAt: decision.decidedAt,
        madeBy: ["alice"],
        affects: ["src/api"],
        supersedes: [],
        confidence: 0.9,
      },
    ]);
    expect(result.entries[1]?.decisions).toEqual([]);
  });

  it("falls back to the thread time for a decidedAt out of range", async () => {
    const { llm } = fakeLlm([
      {
        threads: [
          {
            key: "issue-9",
            decisions: [{ ...decision, decidedAt: "2030-01-01T00:00:00Z" }],
          },
        ],
      },
    ]);
    const result = await extractDecisions({
      snapshot: fixture,
      cache: empty,
      llm,
      onBatch: () => Promise.resolve(),
      sleep: fakeSleep().sleep,
    });
    expect(result.entries[0]?.decisions[0]?.decidedAt).toBe(
      "2025-10-06T00:00:00.000Z",
    );
  });

  it("makes no LLM calls when the cache is current", async () => {
    const first = await extractDecisions({
      snapshot: fixture,
      cache: empty,
      llm: fakeLlm([answer]).llm,
      onBatch: () => Promise.resolve(),
      sleep: fakeSleep().sleep,
    });
    const { llm, calls } = fakeLlm([]);
    const second = await extractDecisions({
      snapshot: fixture,
      cache: first,
      llm,
      onBatch: () => Promise.resolve(),
      sleep: fakeSleep().sleep,
    });
    expect(calls).toHaveLength(0);
    expect(second).toEqual(first);
  });

  it("waits and retries the batch after a rate limit", async () => {
    const { llm, calls } = fakeLlm([new RateLimitError("429"), answer]);
    const { sleep, waits } = fakeSleep();
    const result = await extractDecisions({
      snapshot: fixture,
      cache: empty,
      llm,
      onBatch: () => Promise.resolve(),
      sleep,
    });
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([60000]);
    expect(result.entries[0]?.decisions[0]?.id).toBe("issue-9-1");
  });
});
