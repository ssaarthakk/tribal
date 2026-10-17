import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { askAgent } from "./agent.js";
import {
  DATA_FILES,
  HandoverCacheSchema,
  readJsonFileOr,
} from "./datafiles.js";
import type { Db } from "./db.js";
import { getHandover } from "./handover.js";
import { RateLimitError, type Llm } from "./llm.js";
import {
  countNodes,
  getComponent,
  getRiskMap,
  getTeamRanking,
  simulateDeparture,
} from "./risk.js";
import { AskRequestSchema, PersonIdRequestSchema } from "./schemas.js";

export type AppDeps = { db: Db; llm: Llm | null; webOrigin: string };

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
    )
    .post(
      "/api/handover",
      zValidator("json", PersonIdRequestSchema),
      async (c) => {
        const report = await simulateDeparture(
          deps.db,
          c.req.valid("json").personId,
        );
        if (report === null)
          return c.json({ error: "not_found" as const }, 404);
        const cache = await readJsonFileOr(
          DATA_FILES.handovers,
          HandoverCacheSchema,
          { entries: [] },
        );
        return c.json(await getHandover({ report, llm: deps.llm, cache }));
      },
    )
    .post("/api/ask", zValidator("json", AskRequestSchema), async (c) => {
      if (deps.llm === null) {
        return c.json(
          {
            error: "llm_unavailable" as const,
            message: "The assistant is not configured.",
          },
          503,
        );
      }
      const { question, history } = c.req.valid("json");
      try {
        return c.json(
          await askAgent({ db: deps.db, llm: deps.llm, question, history }),
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          return c.json(
            {
              error: "rate_limited" as const,
              message: "Rate limit reached, try again in a minute.",
            },
            429,
          );
        }
        throw error;
      }
    });
}

export type AppType = ReturnType<typeof createApp>;
