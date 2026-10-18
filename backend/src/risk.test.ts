import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { countByLabel, countByRelationship, loadSnapshot } from "./load.js";
import { STALE_DOCS } from "./queries.js";
import {
  digestText,
  getComponent,
  getPerson,
  getRiskMap,
  getStaleDocs,
  getTeamRanking,
  simulateDeparture,
} from "./risk.js";
import { withFixtureGraph } from "./test-graph.js";

const ALICE = { id: "alice", login: "alice", name: "Alice Ng" };
const BOB = { id: "bob", login: "bob", name: "Bob Okafor" };
const CAROL = { id: "carol", login: "carol", name: "Carol Diaz" };
const DAVE = { id: "dave", login: "dave", name: "Dave Kim" };
const ERIN = { id: "erin", login: "erin", name: "Erin Walsh" };

const FIXTURE_URL = "https://github.com/tribal-fixture/shop";

function successor(person: typeof ALICE, score: number, lastActive: string) {
  return {
    person,
    score,
    lastActive: `${lastActive}T00:00:00.000Z`,
  };
}

const OCT_1 = "2026-10-01T00:00:00.000Z";
const APR_4 = "2026-04-04T00:00:00.000Z";

const ISSUE_9_1 = {
  id: "issue-9-1",
  summary: "Use offset pagination for list endpoints",
  rationale: "It was the simplest option.",
  status: "superseded",
  decidedAt: "2025-10-06T00:00:00.000Z",
  sourceUrl: `${FIXTURE_URL}/issues/9`,
  madeBy: ["alice"],
  supersedes: [],
};
const ISSUE_9_2 = {
  id: "issue-9-2",
  summary: "Use cursor pagination for list endpoints",
  rationale: "Offset pagination is slow on large tables.",
  status: "active",
  decidedAt: APR_4,
  sourceUrl: `${FIXTURE_URL}/issues/9`,
  madeBy: ["alice", "bob"],
  supersedes: ["issue-9-1"],
};
const PR_3_1 = {
  id: "pr-3-1",
  summary: "Use one shared connection pool in the database layer",
  rationale: "Opening a connection per request is too slow.",
  status: "active",
  decidedAt: APR_4,
  sourceUrl: `${FIXTURE_URL}/pull/3`,
  madeBy: ["alice"],
  supersedes: [],
};

function rounded<T extends { score: number; share: number }>(row: T): T {
  return {
    ...row,
    score: Number(row.score.toFixed(4)),
    share: Number(row.share.toFixed(4)),
  };
}

let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;

beforeAll(async () => {
  fixture = await withFixtureGraph();
});

afterAll(async () => {
  await fixture.cleanup();
});

describe("getTeamRanking", () => {
  it("ranks alice first and bob last with no betweenness", async () => {
    const ranking = await getTeamRanking(fixture.db);
    const betweenness = Object.fromEntries(
      ranking.map((entry) => [entry.person.id, entry.betweenness]),
    );

    expect(ranking).toHaveLength(5);
    expect(ranking[0]?.person).toEqual(ALICE);
    expect(ranking.at(-1)?.person.id).toBe("bob");
    expect(ranking[0]?.pageRank).toBeGreaterThan(ranking[1]?.pageRank ?? 1);
    expect(ranking.at(-1)?.pageRank).toBeLessThan(
      ranking.at(-2)?.pageRank ?? 0,
    );
    expect(betweenness.alice).toBeGreaterThan(0);
    expect(betweenness).toMatchObject({ bob: 0, carol: 0, dave: 0, erin: 0 });
  });
});

describe("getRiskMap", () => {
  it("returns components, people and links above the minimum share", async () => {
    const riskMap = await getRiskMap(fixture.db);
    const links = riskMap.links
      .map(rounded)
      .sort(
        (a, b) =>
          a.componentPath.localeCompare(b.componentPath) ||
          a.personId.localeCompare(b.personId),
      )
      .map((link) => [
        link.componentPath,
        link.personId,
        link.score,
        link.share,
        link.expert,
      ]);

    expect(riskMap.people).toEqual([ALICE, BOB, CAROL, DAVE, ERIN]);
    expect(riskMap.components).toEqual([
      { path: "src/auth", name: "auth", busFactor: 1, risk: "critical" },
      { path: "src/db", name: "db", busFactor: 1, risk: "critical" },
      { path: "docs", name: "docs", busFactor: 2, risk: "at_risk" },
      { path: "src/api", name: "api", busFactor: 2, risk: "at_risk" },
      { path: "src/ui", name: "ui", busFactor: 2, risk: "at_risk" },
      { path: "tests", name: "tests", busFactor: 3, risk: "healthy" },
    ]);
    expect(links).toEqual([
      ["docs", "alice", 2.8, 0.4375, true],
      ["docs", "erin", 3.6, 0.5625, true],
      ["src/api", "alice", 3.2, 0.3678, true],
      ["src/api", "bob", 5.5, 0.6322, true],
      ["src/auth", "alice", 0.6, 0.0863, false],
      ["src/auth", "carol", 6.3, 0.9065, true],
      ["src/db", "alice", 6.3, 0.8051, true],
      ["src/db", "bob", 0.625, 0.0799, false],
      ["src/db", "carol", 0.6, 0.0767, false],
      ["src/ui", "carol", 1, 0.0909, false],
      ["src/ui", "dave", 5.4, 0.4909, true],
      ["src/ui", "erin", 4.6, 0.4182, true],
      ["tests", "carol", 2, 0.2857, true],
      ["tests", "dave", 3, 0.4286, true],
      ["tests", "erin", 2, 0.2857, true],
    ]);
  });
});

describe("getComponent", () => {
  it("returns the details of src/api", async () => {
    const detail = await getComponent(fixture.db, "src/api");

    expect({ ...detail, experts: detail?.experts.map(rounded) }).toEqual({
      component: {
        path: "src/api",
        name: "api",
        busFactor: 2,
        risk: "at_risk",
      },
      experts: [
        {
          person: BOB,
          score: 5.5,
          share: 0.6322,
          lastActive: OCT_1,
          expert: true,
        },
        {
          person: ALICE,
          score: 3.2,
          share: 0.3678,
          lastActive: OCT_1,
          expert: true,
        },
      ],
      decisions: [ISSUE_9_1, ISSUE_9_2],
      docs: [
        {
          path: "README.md",
          title: "Shop",
          url: `${FIXTURE_URL}/blob/main/README.md`,
          updatedAt: OCT_1,
        },
      ],
      recentPullRequests: [
        {
          number: 2,
          title: "Switch to cursor pagination",
          url: `${FIXTURE_URL}/pull/2`,
          createdAt: APR_4,
        },
      ],
    });
  });

  it("returns null for an unknown path", async () => {
    expect(await getComponent(fixture.db, "nowhere")).toBeNull();
  });
});

describe("getPerson", () => {
  it("returns what alice knows, decided and has open", async () => {
    const detail = await getPerson(fixture.db, "alice");

    expect({ ...detail, components: detail?.components.map(rounded) }).toEqual({
      person: ALICE,
      components: [
        ["src/db", 6.3, 0.8051, true],
        ["src/api", 3.2, 0.3678, true],
        ["docs", 2.8, 0.4375, true],
        ["src/auth", 0.6, 0.0863, false],
      ].map(([componentPath, score, share, expert]) => ({
        componentPath,
        score,
        share,
        lastActive: OCT_1,
        expert,
      })),
      decisions: [ISSUE_9_1, ISSUE_9_2, PR_3_1],
      openWork: [
        {
          kind: "pr",
          number: 8,
          title: "Add read replicas to the db layer",
          url: `${FIXTURE_URL}/pull/8`,
        },
        {
          kind: "issue",
          number: 12,
          title: "Document the connection pool settings",
          url: `${FIXTURE_URL}/issues/12`,
        },
      ],
    });
  });

  it("returns null for an unknown person", async () => {
    expect(await getPerson(fixture.db, "nobody")).toBeNull();
  });
});

describe("simulateDeparture", () => {
  it("reports what alice leaving breaks", async () => {
    expect(await simulateDeparture(fixture.db, "alice")).toEqual({
      person: ALICE,
      affectedComponents: [
        {
          path: "src/db",
          busFactorBefore: 1,
          busFactorAfter: 0,
          riskAfter: "orphaned",
          successors: [
            successor(BOB, 0.625, "2025-04-09"),
            successor(CAROL, 0.6, "2026-10-01"),
            successor(DAVE, 0.3, "2026-04-04"),
          ],
        },
        {
          path: "docs",
          busFactorBefore: 2,
          busFactorAfter: 1,
          riskAfter: "critical",
          successors: [successor(ERIN, 3.6, "2026-10-01")],
        },
        {
          path: "src/api",
          busFactorBefore: 2,
          busFactorAfter: 1,
          riskAfter: "critical",
          successors: [successor(BOB, 5.5, "2026-10-01")],
        },
      ],
      orphaned: ["src/db"],
      critical: ["docs", "src/api"],
      decisionsLosingOwner: [
        {
          id: "pr-3-1",
          summary: "Use one shared connection pool in the database layer",
          sourceUrl: `${FIXTURE_URL}/pull/3`,
          decidedAt: "2026-04-04T00:00:00.000Z",
          affects: ["src/db"],
        },
      ],
      openWork: [
        {
          kind: "pr",
          number: 8,
          title: "Add read replicas to the db layer",
          url: `${FIXTURE_URL}/pull/8`,
        },
        {
          kind: "issue",
          number: 12,
          title: "Document the connection pool settings",
          url: `${FIXTURE_URL}/issues/12`,
        },
      ],
      nearbyCollaborators: [
        { person: CAROL, weight: 2 },
        { person: BOB, weight: 1.5 },
        { person: ERIN, weight: 1.5 },
        { person: DAVE, weight: 1 },
      ],
    });
  });

  it("reports what bob leaving breaks", async () => {
    expect(await simulateDeparture(fixture.db, "bob")).toEqual({
      person: BOB,
      affectedComponents: [
        {
          path: "src/api",
          busFactorBefore: 2,
          busFactorAfter: 1,
          riskAfter: "critical",
          successors: [successor(ALICE, 3.2, "2026-10-01")],
        },
      ],
      orphaned: [],
      critical: ["src/api"],
      decisionsLosingOwner: [],
      openWork: [
        {
          kind: "issue",
          number: 14,
          title: "Rate limit the public API",
          url: `${FIXTURE_URL}/issues/14`,
        },
      ],
      nearbyCollaborators: [
        { person: ALICE, weight: 1.5 },
        { person: CAROL, weight: 0 },
        { person: DAVE, weight: 0 },
        { person: ERIN, weight: 0 },
      ],
    });
  });

  it("returns null for an unknown person", async () => {
    expect(await simulateDeparture(fixture.db, "nobody")).toBeNull();
  });

  it("leaves the graph unchanged", async () => {
    const labels = await countByLabel(fixture.db);
    const relationships = await countByRelationship(fixture.db);
    await simulateDeparture(fixture.db, "alice");
    expect(await countByLabel(fixture.db)).toEqual(labels);
    expect(await countByRelationship(fixture.db)).toEqual(relationships);
  });
});

describe("STALE_DOCS", () => {
  const StaleRowSchema = z.object({
    path: z.string(),
    componentPath: z.string(),
  });

  it("finds no stale docs in the fixture", async () => {
    expect(
      await fixture.db.read(STALE_DOCS, { minLines: 0 }, StaleRowSchema),
    ).toEqual([]);
    expect(await getStaleDocs(fixture.db)).toEqual([]);
  });

  it("flags docs/db.md for both its components when it is old", async () => {
    const other = await withFixtureGraph();
    try {
      await loadSnapshot(
        other.db,
        {
          ...other.snapshot,
          docs: other.snapshot.docs.map((doc) =>
            doc.path === "docs/db.md"
              ? { ...doc, updatedAt: "2025-01-01T00:00:00.000Z" }
              : doc,
          ),
        },
        { entries: [] },
      );
      const rows = await other.db.read(
        STALE_DOCS,
        { minLines: 0 },
        StaleRowSchema,
      );
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(
        expect.arrayContaining([
          { path: "docs/db.md", componentPath: "docs" },
          { path: "docs/db.md", componentPath: "src/db" },
        ]),
      );
    } finally {
      await other.cleanup();
    }
  });
});

describe("digestText", () => {
  it("lists merged PRs per component and risky components since a date", async () => {
    expect(await digestText(fixture.db, "2026-09-01")).toBe(
      [
        "Digest since 2026-09-01",
        "",
        "Decisions",
        "- None",
        "",
        "Merged pull requests",
        "docs",
        `- #7 Document the pool (${FIXTURE_URL}/pull/7)`,
        "src/auth",
        `- #4 Add login form handler (${FIXTURE_URL}/pull/4)`,
        "src/db",
        `- #1 Add connection pool (${FIXTURE_URL}/pull/1)`,
        "src/ui",
        `- #5 Add app shell (${FIXTURE_URL}/pull/5)`,
        `- #6 Add focus ring to buttons (${FIXTURE_URL}/pull/6)`,
        "",
        "Orphaned or critical components",
        "- src/auth: critical",
        "- src/db: critical",
      ].join("\n"),
    );
  });
});
