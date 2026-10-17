import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { computeExpertise } from "./expertise.js";
import { countByRelationship } from "./load.js";
import {
  LIST_COMPONENTS,
  NEARBY_COLLABORATORS,
  PERSON_COMPONENTS,
} from "./queries.js";
import { withFixtureGraph } from "./test-graph.js";

const EXPECTED_EXPERTISE: Record<
  string,
  [string, number, number, string, boolean][]
> = {
  alice: [
    ["src/db", 6.3, 0.8051, "2026-10-01", true],
    ["src/api", 3.2, 0.3678, "2026-10-01", true],
    ["docs", 2.8, 0.4375, "2026-10-01", true],
    ["src/auth", 0.6, 0.0863, "2026-10-01", false],
  ],
  bob: [
    ["src/api", 5.5, 0.6322, "2026-10-01", true],
    ["src/db", 0.625, 0.0799, "2025-04-09", false],
    ["src/auth", 0.05, 0.0072, "2025-10-06", false],
  ],
  carol: [
    ["src/auth", 6.3, 0.9065, "2026-10-01", true],
    ["tests", 2.0, 0.2857, "2026-10-01", true],
    ["src/ui", 1.0, 0.0909, "2026-04-04", false],
    ["src/db", 0.6, 0.0767, "2026-10-01", false],
  ],
  dave: [
    ["src/ui", 5.4, 0.4909, "2026-10-01", true],
    ["tests", 3.0, 0.4286, "2026-10-01", true],
    ["src/db", 0.3, 0.0383, "2026-04-04", false],
  ],
  erin: [
    ["src/ui", 4.6, 0.4182, "2026-10-01", true],
    ["docs", 3.6, 0.5625, "2026-10-01", true],
    ["tests", 2.0, 0.2857, "2026-10-01", true],
  ],
};

const EXPECTED_BUS_FACTORS = [
  { path: "src/auth", busFactor: 1 },
  { path: "src/db", busFactor: 1 },
  { path: "docs", busFactor: 2 },
  { path: "src/api", busFactor: 2 },
  { path: "src/ui", busFactor: 2 },
  { path: "tests", busFactor: 3 },
];

const CollaboratorRow = z.object({ id: z.string(), weight: z.number() });

const PersonComponentRow = z.object({
  componentPath: z.string(),
  score: z.number(),
  share: z.number(),
  lastActive: z.number(),
  expert: z.boolean(),
});

describe("computeExpertise", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  async function expectExpertiseTable(): Promise<void> {
    for (const [personId, expected] of Object.entries(EXPECTED_EXPERTISE)) {
      const rows = await fixture.db.read(
        PERSON_COMPONENTS,
        { personId },
        PersonComponentRow,
      );
      expect(rows.map((row) => row.componentPath)).toEqual(
        expected.map(([path]) => path),
      );
      rows.forEach((row, index) => {
        const [, score, share, lastActive, expert] = expected[index] ?? [];
        expect(row.score).toBeCloseTo(score ?? Number.NaN, 4);
        expect(row.share).toBeCloseTo(share ?? Number.NaN, 4);
        expect(new Date(row.lastActive).toISOString().slice(0, 10)).toBe(
          lastActive,
        );
        expect(row.expert).toBe(expert);
      });
    }
  }

  it("scores every person and component as in the architecture", async () => {
    await expectExpertiseTable();
  });

  it("sets the bus factor of every component", async () => {
    const rows = await fixture.db.read(
      LIST_COMPONENTS,
      {},
      z.object({ path: z.string(), busFactor: z.number() }),
    );
    expect(rows).toEqual(EXPECTED_BUS_FACTORS);
  });

  it("gives the same values when run twice", async () => {
    await computeExpertise(fixture.db, Date.parse(fixture.snapshot.fetchedAt));
    await expectExpertiseTable();
  });

  it("links collaborators with the architecture weights", async () => {
    const nearby = async (personId: string) =>
      fixture.db.read(NEARBY_COLLABORATORS, { personId }, CollaboratorRow);

    expect(await nearby("alice")).toEqual([
      { id: "carol", weight: 2 },
      { id: "bob", weight: 1.5 },
      { id: "erin", weight: 1.5 },
      { id: "dave", weight: 1 },
    ]);
    expect(await nearby("dave")).toEqual([
      { id: "erin", weight: 3 },
      { id: "alice", weight: 1 },
      { id: "carol", weight: 0.5 },
      { id: "bob", weight: 0 },
    ]);
    expect((await countByRelationship(fixture.db)).COLLABORATES_WITH).toBe(14);
  });
});
