import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { openDb } from "./db.js";
import type { Env } from "./env.js";

export async function startServer(env: Env): Promise<void> {
  const db = await openDb(env, env.FALKORDB_GRAPH);
  const app = createApp({ db, webOrigin: env.WEB_ORIGIN });
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`Backend listening on http://localhost:${String(info.port)}`);
  });
}
