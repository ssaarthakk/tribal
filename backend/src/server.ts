import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import {
  DATA_FILES,
  DecisionCacheSchema,
  SnapshotSchema,
  readJsonFile,
} from "./datafiles.js";
import { openDb, type Db } from "./db.js";
import type { Env } from "./env.js";
import { createLlm } from "./llm.js";
import { loadSnapshot } from "./load.js";
import { countNodes } from "./risk.js";

export async function ensureSeeded(
  db: Db,
  snapshotPath: string,
  decisionsPath: string,
): Promise<boolean> {
  if ((await countNodes(db)) > 0) return false;
  const snapshot = await readJsonFile(snapshotPath, SnapshotSchema);
  const decisions = await readJsonFile(decisionsPath, DecisionCacheSchema);
  await loadSnapshot(db, snapshot, decisions);
  return true;
}

export async function startServer(env: Env): Promise<void> {
  const db = await openDb(env, env.FALKORDB_GRAPH);
  const seeded = await ensureSeeded(
    db,
    DATA_FILES.snapshot,
    DATA_FILES.decisions,
  );
  console.log(seeded ? "Graph was empty, seeded it" : "Graph already loaded");
  const app = createApp({
    db,
    llm: createLlm(env),
    webOrigin: env.WEB_ORIGIN,
  });
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`Backend listening on http://localhost:${String(info.port)}`);
  });
}
