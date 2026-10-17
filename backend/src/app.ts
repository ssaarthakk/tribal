import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Db } from "./db.js";
import { countNodes } from "./risk.js";

export type AppDeps = { db: Db; webOrigin: string };

export function createApp(deps: AppDeps) {
  return new Hono()
    .use("/api/*", cors({ origin: deps.webOrigin }))
    .get("/api/health", async (c) =>
      c.json({ ok: true as const, nodes: await countNodes(deps.db) }),
    );
}

export type AppType = ReturnType<typeof createApp>;
