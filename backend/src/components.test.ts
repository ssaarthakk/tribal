import { beforeAll, describe, expect, it } from "vitest";
import { componentName, componentOf, selectComponents } from "./components.js";
import {
  DATA_FILES,
  RepoConfigSchema,
  SnapshotSchema,
  readJsonFile,
  type Snapshot,
} from "./datafiles.js";

describe("components", () => {
  let fixture: Snapshot;

  beforeAll(async () => {
    fixture = await readJsonFile(DATA_FILES.fixtureSnapshot, SnapshotSchema);
  });

  it("maps files to components with the fixture config", () => {
    expect(componentOf("src/db/pool.ts", fixture.config)).toBe("src/db");
    expect(componentOf("README.md", fixture.config)).toBe("(root)");
    expect(componentOf("vendor/lib.js", fixture.config)).toBeNull();
    expect(componentOf("tests/api.test.ts", fixture.config)).toBe("tests");
  });

  it("maps files to components with the demo config", async () => {
    const demo = await readJsonFile(DATA_FILES.config, RepoConfigSchema);
    expect(componentOf("graph/src/runtime/eval.rs", demo)).toBe(
      "graph/src/runtime",
    );
    expect(componentOf("src/commands/x.c", demo)).toBe("src/commands");
    expect(componentOf("src/module.c", demo)).toBe("src");
    expect(componentOf("deps/GraphBLAS/a.c", demo)).toBeNull();
  });

  it("selects the fixture components", () => {
    expect(selectComponents(fixture)).toEqual([
      "docs",
      "src/api",
      "src/auth",
      "src/db",
      "src/ui",
      "tests",
    ]);
  });

  it("names a component by its last segment", () => {
    expect(componentName("graph/src/runtime")).toBe("runtime");
  });
});
