import { describe, expect, it } from "vitest";
import {
  createRepoSource,
  nextPageUrl,
  parseClosingReferences,
} from "./github.js";

const author = {
  name: "Ada",
  email: "ada@example.com",
  date: "2026-02-01T10:00:00Z",
};

function detail(sha: string, filename: string) {
  return {
    sha,
    commit: { message: `message ${sha}`, author },
    author: { login: "ada", type: "User" },
    parents: [{ sha: "p1" }],
    files: [{ filename, additions: 3, deletions: 1 }],
  };
}

const details = new Map([
  ["sha1", detail("sha1", "src/a.ts")],
  ["sha3", detail("sha3", "src/c.ts")],
]);

const listPage1 = [
  { sha: "sha1", parents: [{ sha: "p1" }] },
  { sha: "sha2", parents: [{ sha: "p1" }, { sha: "p2" }] },
];
const listPage2 = [{ sha: "sha3", parents: [{ sha: "p1" }] }];

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { headers });
}

describe("github", () => {
  it("lists non-merge commits across pages with their files", async () => {
    const authorizations: (string | null)[] = [];
    const fakeFetch: typeof fetch = (input, init) => {
      authorizations.push(new Headers(init?.headers).get("authorization"));
      const url = new URL(input instanceof Request ? input.url : input);
      const sha = url.pathname.split("/").at(-1) ?? "";
      const detailForSha = details.get(sha);
      if (url.pathname === "/repos/o/r/commits") {
        return Promise.resolve(
          url.searchParams.get("page") === "2"
            ? jsonResponse(listPage2)
            : jsonResponse(listPage1, {
                Link: '<https://api.github.com/repos/o/r/commits?sha=main&page=2>; rel="next"',
              }),
        );
      }
      return Promise.resolve(
        detailForSha
          ? jsonResponse(detailForSha)
          : new Response("", { status: 404 }),
      );
    };

    const source = await createRepoSource("o/r", "t", fakeFetch);
    const commits = await source.commits("main", "2026-01-01");

    expect(commits.map((commit) => commit.sha)).toEqual(["sha1", "sha3"]);
    expect(commits.map((commit) => commit.files[0]?.filename)).toEqual([
      "src/a.ts",
      "src/c.ts",
    ]);
    expect(authorizations).toHaveLength(4);
    expect(new Set(authorizations)).toEqual(new Set(["Bearer t"]));
  });

  it("finds all closing references once", () => {
    expect(
      parseClosingReferences("Fixes #9, closes #12 and resolved #9; see #4"),
    ).toEqual([9, 12]);
  });

  it("extracts the next page url", () => {
    expect(
      nextPageUrl(
        '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last"',
      ),
    ).toBe("https://api.github.com/x?page=2");
    expect(nextPageUrl(null)).toBeNull();
  });
});
