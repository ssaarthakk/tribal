import { beforeAll, describe, expect, it } from "vitest";
import { DATA_FILES, SnapshotSchema, readJsonFile } from "./datafiles.js";
import { nameKey, resolveIdentities, type Identities } from "./identity.js";

describe("identity", () => {
  let identities: Identities;
  let shaStartingWith: (prefix: string) => string;

  beforeAll(async () => {
    const fixture = await readJsonFile(
      DATA_FILES.fixtureSnapshot,
      SnapshotSchema,
    );
    identities = resolveIdentities(fixture);
    shaStartingWith = (prefix) => {
      const commit = fixture.commits.find((c) => c.sha.startsWith(prefix));
      if (!commit) {
        throw new Error(`No fixture commit starts with ${prefix}`);
      }
      return commit.sha;
    };
  });

  it("finds the five fixture people", () => {
    expect(identities.people.map((p) => p.id)).toEqual([
      "alice",
      "bob",
      "carol",
      "dave",
      "erin",
    ]);
    expect(identities.people.map((p) => p.name)).toEqual([
      "Alice Ng",
      "Bob Okafor",
      "Carol Diaz",
      "Dave Kim",
      "Erin Walsh",
    ]);
  });

  it("merges commits without a login by email hash or name", () => {
    expect(identities.commitAuthor.get(shaStartingWith("c18"))).toBe("dave");
    expect(identities.commitAuthor.get(shaStartingWith("c19"))).toBe("carol");
  });

  it("never turns a bot into a person", () => {
    expect(identities.commitAuthor.get(shaStartingWith("c20"))).toBeNull();
    expect(identities.personIdForLogin("dependabot[bot]")).toBeNull();
  });

  it("normalises names", () => {
    expect(nameKey("  Carol   Diaz ")).toBe("carol diaz");
  });
});
