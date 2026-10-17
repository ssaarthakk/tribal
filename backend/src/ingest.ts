import { createHash } from "node:crypto";
import { SnapshotSchema } from "./datafiles.js";
import type { RepoConfig, Snapshot } from "./datafiles.js";
import { parseClosingReferences } from "./github.js";
import type { GhReview, RepoSource } from "./github.js";

export const LIMITS = {
  prBody: 2000,
  issueBody: 2000,
  commentBody: 1000,
  docBody: 4000,
  commitMessage: 200,
} as const;

const PROGRESS_EVERY = 50;

export function emailHash(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

const EMAIL_PATTERN =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, "[email]");
}

const isoDate = (date: string): string => new Date(date).toISOString();
const cut = (text: string | null, limit: number): string =>
  redactEmails(text ?? "").slice(0, limit);
const trailingNumber = (url: string): number => Number(url.split("/").at(-1));

export async function buildSnapshot(
  config: RepoConfig,
  source: RepoSource,
  fetchedAt: Date,
): Promise<Snapshot> {
  const defaultBranch = await source.defaultBranch();
  const pulls = await source.pullRequests(config.since);
  const reviewsByPull = new Map<number, GhReview[]>();
  for (const pull of pulls) {
    reviewsByPull.set(pull.number, await source.reviews(pull.number));
    if (reviewsByPull.size % PROGRESS_EVERY === 0) {
      console.error(
        `reviews: ${String(reviewsByPull.size)}/${String(pulls.length)}`,
      );
    }
  }
  const issues = (await source.issues(config.since)).filter(
    (issue) => issue.pull_request === undefined,
  );
  const issueComments = await source.issueComments(config.since);
  const reviewComments = await source.reviewComments(config.since);
  const commits = await source.commits(defaultBranch, config.since);
  const docs = await source.markdownDocs(defaultBranch);

  const pullNumbers = new Set(pulls.map((pull) => pull.number));
  const issueNumbers = new Set(issues.map((issue) => issue.number));

  const users = [
    ...pulls.map((pull) => pull.user),
    ...[...reviewsByPull.values()].flat().map((review) => review.user),
    ...issues.map((issue) => issue.user),
    ...issueComments.map((comment) => comment.user),
    ...reviewComments.map((comment) => comment.user),
    ...commits.map((commit) => commit.author),
  ];
  const bots = [
    ...new Set(
      users.flatMap((user) =>
        user !== null && (user.type === "Bot" || user.login.endsWith("[bot]"))
          ? [user.login]
          : [],
      ),
    ),
  ].sort();

  const toComment = (
    idPrefix: string,
    comment: {
      id: number;
      body: string | null;
      created_at: string;
      html_url: string;
      user: { login: string } | null;
    },
    parent: Snapshot["comments"][number]["parent"],
  ): Snapshot["comments"][number] => ({
    id: `${idPrefix}-${String(comment.id)}`,
    body: cut(comment.body, LIMITS.commentBody),
    createdAt: isoDate(comment.created_at),
    url: comment.html_url,
    authorLogin: comment.user?.login ?? null,
    parent,
  });

  const comments: Snapshot["comments"] = [];
  for (const comment of issueComments) {
    const number = trailingNumber(comment.issue_url);
    if (pullNumbers.has(number)) {
      comments.push(toComment("ic", comment, { kind: "pr", number }));
    } else if (issueNumbers.has(number)) {
      comments.push(toComment("ic", comment, { kind: "issue", number }));
    }
  }
  for (const comment of reviewComments) {
    const number = trailingNumber(comment.pull_request_url);
    if (pullNumbers.has(number)) {
      comments.push(toComment("rc", comment, { kind: "pr", number }));
    }
  }

  const result: Snapshot = {
    fetchedAt: fetchedAt.toISOString(),
    defaultBranch,
    config,
    bots,
    commits: commits
      .map((commit) => ({
        sha: commit.sha,
        message: cut(
          commit.commit.message.split("\n")[0] ?? "",
          LIMITS.commitMessage,
        ),
        authoredAt: isoDate(commit.commit.author.date),
        url: `https://github.com/${config.repo}/commit/${commit.sha}`,
        authorLogin: commit.author?.login ?? null,
        authorName: commit.commit.author.name,
        authorEmailHash: emailHash(commit.commit.author.email),
        files: commit.files.map((file) => ({
          path: file.filename,
          additions: file.additions,
          deletions: file.deletions,
        })),
      }))
      .sort(
        (a, b) =>
          a.authoredAt.localeCompare(b.authoredAt) ||
          a.sha.localeCompare(b.sha),
      ),
    pullRequests: pulls
      .map((pull) => ({
        number: pull.number,
        title: redactEmails(pull.title),
        body: cut(pull.body, LIMITS.prBody),
        state:
          pull.merged_at !== null
            ? ("merged" as const)
            : pull.state === "open"
              ? ("open" as const)
              : ("closed" as const),
        createdAt: isoDate(pull.created_at),
        mergedAt: pull.merged_at === null ? null : isoDate(pull.merged_at),
        url: pull.html_url,
        authorLogin: pull.user?.login ?? null,
        mergeCommitSha: pull.merge_commit_sha,
        closesIssues: parseClosingReferences(pull.body ?? "").filter((number) =>
          issueNumbers.has(number),
        ),
        reviews: (reviewsByPull.get(pull.number) ?? []).flatMap((review) =>
          review.user !== null && review.submitted_at !== null
            ? [
                {
                  reviewerLogin: review.user.login,
                  state: review.state,
                  submittedAt: isoDate(review.submitted_at),
                },
              ]
            : [],
        ),
      }))
      .sort((a, b) => a.number - b.number),
    issues: issues
      .map((issue) => ({
        number: issue.number,
        title: redactEmails(issue.title),
        body: cut(issue.body, LIMITS.issueBody),
        state: issue.state === "open" ? ("open" as const) : ("closed" as const),
        createdAt: isoDate(issue.created_at),
        closedAt: issue.closed_at === null ? null : isoDate(issue.closed_at),
        url: issue.html_url,
        authorLogin: issue.user?.login ?? null,
      }))
      .sort((a, b) => a.number - b.number),
    comments: comments.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
    docs: docs
      .filter(
        (doc) =>
          !config.ignorePrefixes.some((prefix) => doc.path.startsWith(prefix)),
      )
      .map((doc) => ({
        path: doc.path,
        title: redactEmails(
          doc.content.match(/^# (.+)$/m)?.[1]?.trim() ??
            doc.path.split("/").at(-1) ??
            doc.path,
        ),
        body: cut(doc.content, LIMITS.docBody),
        updatedAt: isoDate(doc.updatedAt),
        url: `https://github.com/${config.repo}/blob/${defaultBranch}/${doc.path}`,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
  return SnapshotSchema.parse(result);
}
