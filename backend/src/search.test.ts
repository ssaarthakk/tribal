import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "./db.js";
import {
  search,
  suggestReviewers,
  toFullTextQuery,
  whoKnows,
} from "./search.js";
import { withFixtureGraph } from "./test-graph.js";

describe("toFullTextQuery", () => {
  it("keeps lowercase words of 3+ characters joined with OR", () => {
    expect(toFullTextQuery("Who knows about pagination?")).toBe(
      "who|knows|about|pagination",
    );
  });

  it("removes duplicates and short words", () => {
    expect(toFullTextQuery("API api Api db to Cursor")).toBe("api|cursor");
  });

  it("returns an empty string when nothing is left", () => {
    expect(toFullTextQuery("a an -- @#")).toBe("");
  });
});

describe("search", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;
  let db: Db;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
    db = fixture.db;
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("finds the pagination PR, issue and decisions", async () => {
    const hits = await search(db, "pagination");
    const keys = hits.map((hit) => `${hit.kind}:${hit.key}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        "pr:2",
        "issue:9",
        "decision:issue-9-1",
        "decision:issue-9-2",
      ]),
    );
  });

  it("does not fail on RediSearch special characters", async () => {
    await expect(
      search(db, 'pagination" OR 1=1 -- @title:{x}'),
    ).resolves.toBeDefined();
  });

  it("returns nothing for an empty query", async () => {
    expect(await search(db, "a an -- @#")).toEqual([]);
    expect(await whoKnows(db, "a an -- @#")).toEqual({
      components: [],
      sources: [],
    });
  });

  it("ranks src/api first for pagination, with experts bob then alice", async () => {
    const result = await whoKnows(db, "pagination");
    expect(result.components[0]?.path).toBe("src/api");
    expect(result.components[0]?.experts.map((e) => e.person.id)).toEqual([
      "bob",
      "alice",
    ]);
  });

  it("suggests reviewers other than alice for her PR 8", async () => {
    const suggestion = await suggestReviewers(db, "pr", 8);
    const ids = suggestion?.reviewers.map((reviewer) => reviewer.person.id);
    expect(ids?.length).toBeGreaterThan(0);
    expect(ids).not.toContain("alice");
  });

  it("returns null for an unknown PR", async () => {
    expect(await suggestReviewers(db, "pr", 999)).toBeNull();
  });
});
