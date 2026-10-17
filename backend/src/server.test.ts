import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { DATA_FILES } from "./datafiles.js";
import { openDb } from "./db.js";
import { loadEnv } from "./env.js";
import { countNodes } from "./risk.js";
import { ensureSeeded } from "./server.js";

describe("ensureSeeded", () => {
  const dbPromise = openDb(
    loadEnv(),
    `tribal_test_${randomUUID().replaceAll("-", "")}`,
  );

  afterAll(async () => {
    const db = await dbPromise;
    await db.deleteGraph();
    await db.close();
  });

  it("seeds an empty graph once", async () => {
    const db = await dbPromise;
    const seed = () =>
      ensureSeeded(db, DATA_FILES.fixtureSnapshot, DATA_FILES.fixtureDecisions);

    expect(await seed()).toBe(true);
    expect(await countNodes(db)).toBe(75);
    expect(await seed()).toBe(false);
  });
});
