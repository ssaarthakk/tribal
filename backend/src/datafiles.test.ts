import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DATA_FILES,
  DecisionCacheSchema,
  RepoConfigSchema,
  SnapshotSchema,
  readJsonFile,
  readJsonFileOr,
  writeJsonFile,
} from "./datafiles.js";

describe("datafiles", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "tribal-datafiles-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads the fixture snapshot", async () => {
    const snapshot = await readJsonFile(
      DATA_FILES.fixtureSnapshot,
      SnapshotSchema,
    );
    expect(snapshot.fetchedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(snapshot.commits).toHaveLength(20);
    expect(snapshot.pullRequests).toHaveLength(8);
    expect(snapshot.issues).toHaveLength(6);
    expect(snapshot.comments).toHaveLength(7);
    expect(snapshot.docs).toHaveLength(3);
  });

  it("reads the fixture decisions", async () => {
    const cache = await readJsonFile(
      DATA_FILES.fixtureDecisions,
      DecisionCacheSchema,
    );
    expect(cache.entries).toHaveLength(2);
    expect(cache.entries.flatMap((entry) => entry.decisions)).toHaveLength(3);
  });

  it("reads the demo config", async () => {
    const config = await readJsonFile(DATA_FILES.config, RepoConfigSchema);
    expect(config.repo).toBe("FalkorDB/FalkorDB");
  });

  it("returns the fallback for a missing file", async () => {
    const fallback = { value: 1 };
    const result = await readJsonFileOr(
      join(dir, "missing.json"),
      z.object({ value: z.number() }),
      fallback,
    );
    expect(result).toBe(fallback);
  });

  it("round-trips a written file", async () => {
    const path = join(dir, "nested", "value.json");
    await writeJsonFile(path, { value: 2 });
    expect(await readJsonFile(path, z.object({ value: z.number() }))).toEqual({
      value: 2,
    });
  });
});
