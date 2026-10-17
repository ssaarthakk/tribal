import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { Db } from "./db.js";
import {
  countNodes,
  getComponent,
  getRiskMap,
  getTeamRanking,
  simulateDeparture,
} from "./risk.js";
import { PersonIdRequestSchema } from "./schemas.js";

export type AppDeps = { db: Db; webOrigin: string };

export function createApp(deps: AppDeps) {
  return new Hono()
    .use("/api/*", cors({ origin: deps.webOrigin }))
    .get("/api/health", async (c) =>
      c.json({ ok: true as const, nodes: await countNodes(deps.db) }),
    )
    .get("/api/risk-map", async (c) => c.json(await getRiskMap(deps.db)))
    .get("/api/ranking", async (c) => c.json(await getTeamRanking(deps.db)))
    .get(
      "/api/component",
      zValidator("query", z.object({ path: z.string() })),
      async (c) => {
        const component = await getComponent(
          deps.db,
          c.req.valid("query").path,
        );
        if (component === null)
          return c.json({ error: "not_found" as const }, 404);
        return c.json(component);
      },
    )
    .post(
      "/api/simulate",
      zValidator("json", PersonIdRequestSchema),
      async (c) => {
        const report = await simulateDeparture(
          deps.db,
          c.req.valid("json").personId,
        );
        if (report === null)
          return c.json({ error: "not_found" as const }, 404);
        return c.json(report);
      },
    );
}

export type AppType = ReturnType<typeof createApp>;
