import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DATA_FILES,
  DecisionCacheSchema,
  readJsonFile,
  type Snapshot,
} from "./datafiles.js";
import {
  countByLabel,
  countByRelationship,
  docComponents,
  loadSnapshot,
} from "./load.js";
import { COMPONENT_RECENT_PULL_REQUESTS } from "./queries.js";
import { withFixtureGraph } from "./test-graph.js";

const EXPECTED_LABELS = {
  Person: 5,
  Component: 6,
  File: 17,
  Commit: 20,
  PullRequest: 8,
  Issue: 6,
  Comment: 7,
  Doc: 3,
  Decision: 3,
};

const EXPECTED_RELATIONSHIPS = {
  AUTHORED: 40,
  REVIEWED: 7,
  MODIFIES: 22,
  PART_OF: 15,
  CONTAINS: 7,
  CLOSES: 2,
  ON: 7,
  DESCRIBES: 5,
  MADE: 4,
  DECIDED_IN: 3,
  AFFECTS: 3,
  SUPERSEDES: 1,
};

const TRICKY_TITLE = `He said "hi" \\ back\\slash\n'single' 🚀`;

describe("loadSnapshot", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("loads the counts from the architecture", async () => {
    expect(await countByLabel(fixture.db)).toEqual(EXPECTED_LABELS);
    expect(await countByRelationship(fixture.db)).toEqual(
      EXPECTED_RELATIONSHIPS,
    );
  });

  it("gives the same counts when loaded twice", async () => {
    const decisions = await readJsonFile(
      DATA_FILES.fixtureDecisions,
      DecisionCacheSchema,
    );
    await loadSnapshot(fixture.db, fixture.snapshot, decisions);
    expect(await countByLabel(fixture.db)).toEqual(EXPECTED_LABELS);
    expect(await countByRelationship(fixture.db)).toEqual(
      EXPECTED_RELATIONSHIPS,
    );
  });

  it("round-trips quotes, backslashes, newlines and emoji", async () => {
    const other = await withFixtureGraph();
    try {
      const [firstPullRequest, ...rest] = other.snapshot.pullRequests;
      if (firstPullRequest === undefined) throw new Error("no pull requests");
      const tricky: Snapshot = {
        ...other.snapshot,
        pullRequests: [{ ...firstPullRequest, title: TRICKY_TITLE }, ...rest],
      };
      await loadSnapshot(other.db, tricky, { entries: [] });
      const rows = await other.db.read(
        COMPONENT_RECENT_PULL_REQUESTS,
        { path: "src/db", limit: 5 },
        z.object({ number: z.number(), title: z.string() }),
      );
      expect(rows.find((row) => row.number === 1)?.title).toBe(TRICKY_TITLE);
    } finally {
      await other.cleanup();
    }
  });

  it("maps docs to the components they describe", () => {
    const { snapshot } = fixture;
    const components = [
      "docs",
      "src/api",
      "src/auth",
      "src/db",
      "src/ui",
      "tests",
    ];
    const byPath = Object.fromEntries(
      snapshot.docs.map((doc) => [
        doc.path,
        docComponents(doc, components, snapshot.config),
      ]),
    );
    expect(byPath).toEqual({
      "README.md": ["src/api"],
      "docs/db.md": ["docs", "src/db"],
      "docs/ui.md": ["docs", "src/ui"],
    });
  });
});
