import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { z } from "zod";

const GhUserSchema = z.object({ login: z.string(), type: z.string() });
const nullableUser = GhUserSchema.nullable();

const GhPullSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  html_url: z.string(),
  user: nullableUser,
});

const GhReviewSchema = z.object({
  user: nullableUser,
  state: z.string(),
  submitted_at: z.string().nullable(),
});

const GhIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  html_url: z.string(),
  user: nullableUser,
  pull_request: z.unknown().optional(),
});

const GhIssueCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  created_at: z.string(),
  html_url: z.string(),
  issue_url: z.string(),
  user: nullableUser,
});

const GhReviewCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  created_at: z.string(),
  html_url: z.string(),
  pull_request_url: z.string(),
  user: nullableUser,
});

const GhCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string(),
      date: z.string(),
    }),
  }),
  author: nullableUser,
  parents: z.array(z.object({ sha: z.string() })),
  files: z.array(
    z.object({
      filename: z.string(),
      additions: z.number(),
      deletions: z.number(),
    }),
  ),
});

const CommitListItemSchema = z.object({
  sha: z.string(),
  parents: z.array(z.object({ sha: z.string() })),
});

const CommitDateListSchema = z.array(
  z.object({ commit: z.object({ author: z.object({ date: z.string() }) }) }),
);

const RepoSchema = z.object({ default_branch: z.string() });
const TreeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});
const ContentSchema = z.object({ content: z.string() });

export type GhPull = z.infer<typeof GhPullSchema>;
export type GhReview = z.infer<typeof GhReviewSchema>;
export type GhIssue = z.infer<typeof GhIssueSchema>;
export type GhIssueComment = z.infer<typeof GhIssueCommentSchema>;
export type GhReviewComment = z.infer<typeof GhReviewCommentSchema>;
export type GhCommit = z.infer<typeof GhCommitSchema>;
export type GhDoc = { path: string; content: string; updatedAt: string };

export type RepoSource = {
  defaultBranch(): Promise<string>;
  pullRequests(since: string): Promise<GhPull[]>;
  reviews(prNumber: number): Promise<GhReview[]>;
  issues(since: string): Promise<GhIssue[]>;
  issueComments(since: string): Promise<GhIssueComment[]>;
  reviewComments(since: string): Promise<GhReviewComment[]>;
  commits(branch: string, since: string): Promise<GhCommit[]>;
  markdownDocs(branch: string): Promise<GhDoc[]>;
};

const API_URL = "https://api.github.com";
const MAX_DOCS = 200;
const PROGRESS_EVERY = 50;
const runFile = promisify(execFile);

export function parseClosingReferences(body: string): number[] {
  const numbers = [
    ...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi),
  ].map((match) => Number(match[1]));
  return [...new Set(numbers)];
}

export function nextPageUrl(linkHeader: string | null): string | null {
  return linkHeader?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
}

export async function createRepoSource(
  repo: string,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<RepoSource> {
  const resolvedToken =
    token ?? (await runFile("gh", ["auth", "token"])).stdout.trim();
  const headers = {
    Authorization: `Bearer ${resolvedToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function send(url: string, canRetry = true): Promise<Response> {
    const response = await fetchImpl(url, { headers });
    const rateLimited =
      (response.status === 403 || response.status === 429) &&
      response.headers.get("x-ratelimit-remaining") === "0";
    if (rateLimited && canRetry) {
      const resetAt = Number(response.headers.get("x-ratelimit-reset")) * 1000;
      await sleep(Math.max(0, resetAt - Date.now()) + 1000);
      return send(url, false);
    }
    if (!response.ok) {
      throw new Error(
        `GitHub request failed: ${url} (${String(response.status)})`,
      );
    }
    return response;
  }

  async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await send(`${API_URL}${path}`);
    return schema.parse(await response.json());
  }

  async function getPages<T>(
    path: string,
    item: z.ZodType<T>,
    isLastPage: (items: T[]) => boolean = () => false,
  ): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = `${API_URL}${path}`;
    while (url !== null) {
      const response = await send(url);
      const items = z.array(item).parse(await response.json());
      results.push(...items);
      url = isLastPage(items)
        ? null
        : nextPageUrl(response.headers.get("link"));
    }
    return results;
  }

  const sinceParam = (since: string): string => `since=${since}T00:00:00Z`;
  const encodePath = (path: string): string =>
    path.split("/").map(encodeURIComponent).join("/");

  return {
    async defaultBranch() {
      return (await getJson(`/repos/${repo}`, RepoSchema)).default_branch;
    },

    pullRequests(since) {
      return getPages(
        `/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`,
        GhPullSchema,
        (items) => (items.at(-1)?.updated_at ?? since) < since,
      );
    },

    reviews(prNumber) {
      return getPages(
        `/repos/${repo}/pulls/${String(prNumber)}/reviews?per_page=100`,
        GhReviewSchema,
      );
    },

    issues(since) {
      return getPages(
        `/repos/${repo}/issues?state=all&${sinceParam(since)}&per_page=100`,
        GhIssueSchema,
      );
    },

    issueComments(since) {
      return getPages(
        `/repos/${repo}/issues/comments?${sinceParam(since)}&per_page=100`,
        GhIssueCommentSchema,
      );
    },

    reviewComments(since) {
      return getPages(
        `/repos/${repo}/pulls/comments?${sinceParam(since)}&per_page=100`,
        GhReviewCommentSchema,
      );
    },

    async commits(branch, since) {
      const listed = await getPages(
        `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&${sinceParam(since)}&per_page=100`,
        CommitListItemSchema,
      );
      const shas = listed
        .filter((commit) => commit.parents.length <= 1)
        .map((commit) => commit.sha);
      const commits: GhCommit[] = [];
      for (const sha of shas) {
        commits.push(
          await getJson(`/repos/${repo}/commits/${sha}`, GhCommitSchema),
        );
        if (commits.length % PROGRESS_EVERY === 0) {
          console.error(
            `commits: ${String(commits.length)}/${String(shas.length)}`,
          );
        }
      }
      return commits;
    },

    async markdownDocs(branch) {
      const { tree } = await getJson(
        `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        TreeSchema,
      );
      const paths = tree
        .filter((entry) => entry.type === "blob" && /\.md$/i.test(entry.path))
        .map((entry) => entry.path)
        .slice(0, MAX_DOCS);
      const docs: GhDoc[] = [];
      for (const path of paths) {
        const file = await getJson(
          `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
          ContentSchema,
        );
        const [latest] = await getJson(
          `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=1`,
          CommitDateListSchema,
        );
        if (latest === undefined) {
          throw new Error(`No commit found for ${path}`);
        }
        docs.push({
          path,
          content: Buffer.from(file.content, "base64").toString("utf8"),
          updatedAt: latest.commit.author.date,
        });
      }
      return docs;
    },
  };
}
