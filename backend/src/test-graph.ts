import { randomUUID } from "node:crypto";
import {
  DATA_FILES,
  DecisionCacheSchema,
  SnapshotSchema,
  readJsonFile,
  type Snapshot,
} from "./datafiles.js";
import { openDb, type Db } from "./db.js";
import { loadEnv } from "./env.js";
import { loadSnapshot } from "./load.js";

export async function withFixtureGraph(): Promise<{
  db: Db;
  snapshot: Snapshot;
  cleanup(): Promise<void>;
}> {
  const db = await openDb(
    loadEnv(),
    `tribal_test_${randomUUID().replaceAll("-", "")}`,
  );
  const snapshot = await readJsonFile(
    DATA_FILES.fixtureSnapshot,
    SnapshotSchema,
  );
  const decisions = await readJsonFile(
    DATA_FILES.fixtureDecisions,
    DecisionCacheSchema,
  );
  await loadSnapshot(db, snapshot, decisions);
  return {
    db,
    snapshot,
    async cleanup() {
      await db.deleteGraph();
      await db.close();
    },
  };
}
