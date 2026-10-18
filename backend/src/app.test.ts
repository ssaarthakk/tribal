import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openDb } from "./db.js";
import { loadEnv } from "./env.js";
import { RateLimitError, type Llm } from "./llm.js";
import {
  getComponent,
  getRiskMap,
  getStaleDocs,
  getTeamRanking,
} from "./risk.js";
import { suggestReviewers } from "./search.js";
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
    const app = createApp({
      db: await dbPromise,
      llm: null,
      webOrigin: WEB_ORIGIN,
    });
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, nodes: 0 });
  });

  it("allows the web origin", async () => {
    const app = createApp({
      db: await dbPromise,
      llm: null,
      webOrigin: WEB_ORIGIN,
    });
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

  function request(path: string, init?: RequestInit, llm: Llm | null = null) {
    return createApp({ db: fixture.db, llm, webOrigin: WEB_ORIGIN }).request(
      path,
      init,
    );
  }

  function post(path: string, body: unknown, llm: Llm | null = null) {
    return request(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      llm,
    );
  }

  function simulate(body: unknown) {
    return post("/api/simulate", body);
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

  it("GET /api/stale-docs returns the stale docs", async () => {
    const response = await request("/api/stale-docs");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getStaleDocs(fixture.db));
  });

  it("GET /api/suggest-reviewers returns the suggestion", async () => {
    const response = await request("/api/suggest-reviewers?kind=pr&number=8");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      await suggestReviewers(fixture.db, "pr", 8),
    );
  });

  it("GET /api/suggest-reviewers returns 404 for an unknown issue", async () => {
    const response = await request(
      "/api/suggest-reviewers?kind=issue&number=999",
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
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

  it("POST /api/handover returns the template plan without an LLM", async () => {
    const response = await post("/api/handover", { personId: "alice" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ generatedBy: "template" });
  });

  it("POST /api/handover returns 404 for an unknown person", async () => {
    const response = await post("/api/handover", { personId: "nobody" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("POST /api/ask returns 503 without an LLM", async () => {
    const response = await post("/api/ask", {
      question: "Who knows src/db?",
      history: [],
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "llm_unavailable",
      message: "The assistant is not configured.",
    });
  });

  it("POST /api/ask returns 429 when the LLM is rate limited", async () => {
    const rateLimitedLlm: Llm = {
      model: "test-model",
      json() {
        return Promise.reject(new Error("json is not used"));
      },
      chat() {
        return Promise.reject(new RateLimitError("429"));
      },
    };
    const response = await post(
      "/api/ask",
      { question: "Who knows src/db?", history: [] },
      rateLimitedLlm,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "rate_limited",
      message: "Rate limit reached, try again in a minute.",
    });
  });

  it("POST /api/ask returns 400 for an empty question", async () => {
    expect((await post("/api/ask", { question: "" })).status).toBe(400);
  });
});
