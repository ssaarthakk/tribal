import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { openDb, type Db } from "./db.js";
import { loadEnv } from "./env.js";
import { COUNT_NODES, PING } from "./queries.js";

describe("db", () => {
  const opened: Db[] = [];

  async function openTestDb(): Promise<Db> {
    const graphName = `tribal_test_${randomUUID().replaceAll("-", "")}`;
    const db = await openDb(loadEnv(), graphName);
    opened.push(db);
    return db;
  }

  afterAll(async () => {
    for (const db of opened) {
      await db.deleteGraph();
      await db.close();
    }
  });

  it("returns rows that match the schema", async () => {
    const db = await openTestDb();
    await db.write(PING);
    const rows = await db.read(PING, {}, z.object({ one: z.number() }));
    expect(rows).toEqual([{ one: 1 }]);
  });

  it("rejects rows that do not match the schema", async () => {
    const db = await openTestDb();
    await db.write(PING);
    await expect(
      db.read(PING, {}, z.object({ one: z.string() })),
    ).rejects.toThrow();
  });

  it("deletes a graph that does not exist", async () => {
    const db = await openTestDb();
    await expect(db.deleteGraph()).resolves.toBeUndefined();
  });

  it("reads zero rows from a graph that does not exist", async () => {
    const db = await openTestDb();
    const rows = await db.read(
      COUNT_NODES,
      {},
      z.object({ nodes: z.number() }),
    );
    expect(rows).toEqual([]);
  });
});
