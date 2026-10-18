import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { Db } from "./db.js";
import { GraphPathSchema } from "./schemas.js";
import { withFixtureGraph } from "./test-graph.js";
import { tools, type Tool } from "./tools.js";

const FIXTURE_URL = "https://github.com/tribal-fixture/shop";

function tool(name: string): Tool {
  const found = tools.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`Missing tool ${name}`);
  return found;
}

describe("tools", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;
  let db: Db;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
    db = fixture.db;
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("defines the ten tools in order", () => {
    expect(tools.map((candidate) => candidate.name)).toEqual([
      "search",
      "who_knows",
      "bus_factor",
      "get_component",
      "get_person",
      "simulate_departure",
      "team_ranking",
      "decision_history",
      "stale_docs",
      "suggest_reviewers",
    ]);
  });

  it("simulates alice leaving with sources and a graph path", async () => {
    const result = await tool("simulate_departure").run(db, {
      personId: "alice",
    });
    expect(result.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining([
        `${FIXTURE_URL}/pull/8`,
        `${FIXTURE_URL}/issues/12`,
        `${FIXTURE_URL}/pull/3`,
      ]),
    );
    const nodeIds = result.path.nodes.map((node) => node.id);
    expect(nodeIds).toEqual(
      expect.arrayContaining(["person:alice", "component:src/db"]),
    );
    expect(result.path.links).toContainEqual({
      source: "person:alice",
      target: "component:src/db",
      type: "KNOWS_ABOUT",
    });
  });

  it.each([
    ["search", { query: "pagination" }],
    ["who_knows", { topic: "pagination" }],
    ["bus_factor", {}],
    ["get_component", { path: "src/api" }],
    ["get_person", { personId: "alice" }],
    ["simulate_departure", { personId: "alice" }],
    ["team_ranking", {}],
    ["decision_history", { componentPath: "src/api" }],
    ["suggest_reviewers", { kind: "pr", number: 8 }],
  ])("%s returns a valid graph path", async (name, args) => {
    const result = await tool(name).run(db, args);
    expect(GraphPathSchema.parse(result.path).nodes.length).toBeGreaterThan(0);
  });

  it("returns not_found for an unknown component", async () => {
    expect(await tool("get_component").run(db, { path: "nope" })).toEqual({
      data: { error: "not_found" },
      sources: [],
      path: { nodes: [], links: [] },
    });
  });

  it("throws a ZodError for missing arguments", () => {
    expect(() => tool("simulate_departure").run(db, {})).toThrow(ZodError);
  });
});
