import { describe, expect, it } from "vitest";
import { RepoConfigSchema } from "./datafiles.js";
import type { RepoSource } from "./github.js";
import { buildSnapshot, emailHash } from "./ingest.js";

const config = RepoConfigSchema.parse({
  repo: "o/r",
  since: "2026-01-01",
  componentDepth: 1,
  deeperPrefixes: [],
  ignorePrefixes: ["deps/"],
  minComponentCommits: 1,
  maxDecisionThreads: 10,
});

const human = { login: "ada", type: "User" };
const bot = { login: "review-bot", type: "Bot" };
const sha = (letter: string): string => letter.repeat(40);

function commit(letter: string, user: typeof human | null, email: string) {
  return {
    sha: sha(letter),
    commit: {
      message: `first line ${letter}\nbody`,
      author: { name: "Ada", email, date: "2026-02-01T10:00:00Z" },
    },
    author: user,
    parents: [{ sha: "p" }],
    files: [{ filename: "src/a.ts", additions: 1, deletions: 0 }],
  };
}

const source: RepoSource = {
  defaultBranch: () => Promise.resolve("main"),
  pullRequests: () =>
    Promise.resolve([
      {
        number: 1,
        title: "Merged",
        body: "Fixes #3\nSigned-off-by: Ada <1+ada@users.noreply.github.com>",
        state: "closed",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-02T00:00:00Z",
        merged_at: "2026-02-02T00:00:00Z",
        merge_commit_sha: sha("a"),
        html_url: "https://github.com/o/r/pull/1",
        user: human,
      },
      {
        number: 2,
        title: "Open",
        body: null,
        state: "open",
        created_at: "2026-02-03T00:00:00Z",
        updated_at: "2026-02-03T00:00:00Z",
        merged_at: null,
        merge_commit_sha: null,
        html_url: "https://github.com/o/r/pull/2",
        user: human,
      },
    ]),
  reviews: (prNumber) =>
    Promise.resolve(
      prNumber === 1
        ? [
            {
              user: bot,
              state: "COMMENTED",
              submitted_at: "2026-02-01T12:00:00Z",
            },
          ]
        : [],
    ),
  issues: () =>
    Promise.resolve([
      {
        number: 3,
        title: "Issue",
        body: "body",
        state: "open",
        created_at: "2026-01-15T00:00:00Z",
        closed_at: null,
        html_url: "https://github.com/o/r/issues/3",
        user: human,
      },
      {
        number: 1,
        title: "Merged",
        body: null,
        state: "closed",
        created_at: "2026-02-01T00:00:00Z",
        closed_at: null,
        html_url: "https://github.com/o/r/pull/1",
        user: human,
        pull_request: {},
      },
    ]),
  issueComments: () =>
    Promise.resolve([
      {
        id: 10,
        body: "on pr",
        created_at: "2026-02-01T09:00:00Z",
        html_url: "https://github.com/o/r/pull/1#c10",
        issue_url: "https://api.github.com/repos/o/r/issues/1",
        user: human,
      },
      {
        id: 11,
        body: "on issue",
        created_at: "2026-01-16T09:00:00Z",
        html_url: "https://github.com/o/r/issues/3#c11",
        issue_url: "https://api.github.com/repos/o/r/issues/3",
        user: human,
      },
    ]),
  reviewComments: () =>
    Promise.resolve([
      {
        id: 20,
        body: "inline",
        created_at: "2026-02-01T11:00:00Z",
        html_url: "https://github.com/o/r/pull/1#r20",
        pull_request_url: "https://api.github.com/repos/o/r/pulls/1",
        user: human,
      },
    ]),
  commits: () =>
    Promise.resolve([
      commit("b", human, " Ada@Example.com "),
      commit("a", { login: "dependabot[bot]", type: "Bot" }, "bot@example.com"),
    ]),
  markdownDocs: () =>
    Promise.resolve([
      {
        path: "docs/a.md",
        content: "# A title\ntext",
        updatedAt: "2026-02-01T00:00:00Z",
      },
    ]),
};

const fetchedAt = new Date("2026-03-01T00:00:00Z");

describe("buildSnapshot", () => {
  it("sets PR state and closing references", async () => {
    const snapshot = await buildSnapshot(config, source, fetchedAt);
    expect(snapshot.pullRequests.map((pr) => pr.state)).toEqual([
      "merged",
      "open",
    ]);
    expect(snapshot.pullRequests[0]?.closesIssues).toEqual([3]);
    expect(snapshot.issues.map((issue) => issue.number)).toEqual([3]);
  });

  it("lists bots sorted", async () => {
    const snapshot = await buildSnapshot(config, source, fetchedAt);
    expect(snapshot.bots).toEqual(["dependabot[bot]", "review-bot"]);
  });

  it("gives comments prefixed ids and parent kinds", async () => {
    const snapshot = await buildSnapshot(config, source, fetchedAt);
    expect(snapshot.comments.map((c) => [c.id, c.parent])).toEqual([
      ["ic-11", { kind: "issue", number: 3 }],
      ["ic-10", { kind: "pr", number: 1 }],
      ["rc-20", { kind: "pr", number: 1 }],
    ]);
  });

  it("hashes emails and keeps them out of the snapshot", async () => {
    const snapshot = await buildSnapshot(config, source, fetchedAt);
    expect(JSON.stringify(snapshot)).not.toContain("@example.com");
    expect(JSON.stringify(snapshot)).not.toContain("@users.noreply");
    expect(snapshot.pullRequests[0]?.body).toBe(
      "Fixes #3\nSigned-off-by: Ada <[email]>",
    );
    expect(snapshot.commits.map((c) => c.authorEmailHash)).toContain(
      emailHash("ada@example.com"),
    );
  });

  it("takes the doc title from the first heading", async () => {
    const snapshot = await buildSnapshot(config, source, fetchedAt);
    expect(snapshot.docs[0]?.title).toBe("A title");
  });

  it("is deterministic", async () => {
    const first = await buildSnapshot(config, source, fetchedAt);
    const second = await buildSnapshot(config, source, fetchedAt);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
