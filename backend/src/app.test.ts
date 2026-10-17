import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openDb } from "./db.js";
import { loadEnv } from "./env.js";
import { getComponent, getRiskMap, getTeamRanking } from "./risk.js";
import { withFixtureGraph } from "./test-graph.js";

const WEB_ORIGIN = "http://localhost:5173";

describe("GET /api/health", () => {
  const graphName = `tribal_test_${randomUUID().replaceAll("-", "")}`;
  const dbPromise = openDb(loadEnv(), graphName);

  afterAll(async () => {
    const db = await dbPromise;
    await db.deleteGraph();
    await db.close();
  });

  it("reports an empty graph", async () => {
    const app = createApp({ db: await dbPromise, webOrigin: WEB_ORIGIN });
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, nodes: 0 });
  });

  it("allows the web origin", async () => {
    const app = createApp({ db: await dbPromise, webOrigin: WEB_ORIGIN });
    const response = await app.request("/api/health", {
      headers: { Origin: WEB_ORIGIN },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe(
      WEB_ORIGIN,
    );
  });
});

describe("fixture routes", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  function request(path: string, init?: RequestInit) {
    return createApp({ db: fixture.db, webOrigin: WEB_ORIGIN }).request(
      path,
      init,
    );
  }

  function simulate(body: unknown) {
    return request("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("GET /api/risk-map returns the risk map", async () => {
    const response = await request("/api/risk-map");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getRiskMap(fixture.db));
  });

  it("GET /api/ranking returns the team ranking", async () => {
    const response = await request("/api/ranking");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getTeamRanking(fixture.db));
  });

  it("GET /api/component returns a component", async () => {
    const response = await request("/api/component?path=src/api");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      await getComponent(fixture.db, "src/api"),
    );
  });

  it("GET /api/component returns 404 for an unknown path", async () => {
    const response = await request("/api/component?path=nowhere");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("POST /api/simulate returns the departure report", async () => {
    const response = await simulate({ personId: "alice" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ orphaned: ["src/db"] });
  });

  it("POST /api/simulate returns 404 for an unknown person", async () => {
    const response = await simulate({ personId: "nobody" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("POST /api/simulate returns 400 for an invalid body", async () => {
    expect((await simulate({})).status).toBe(400);
  });
});
