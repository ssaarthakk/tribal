import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openDb } from "./db.js";
import { loadEnv } from "./env.js";

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
