import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const IsoDate = z.iso.datetime();

export const RepoConfigSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  since: z.iso.date(),
  componentDepth: z.number().int().min(1),
  deeperPrefixes: z.array(z.string()),
  ignorePrefixes: z.array(z.string()),
  minComponentCommits: z.number().int().min(1),
  maxDecisionThreads: z.number().int().min(0),
});

export const CommitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  message: z.string(),
  authoredAt: IsoDate,
  url: z.url(),
  authorLogin: z.string().nullable(),
  authorName: z.string(),
  authorEmailHash: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      additions: z.number().int().min(0),
      deletions: z.number().int().min(0),
    }),
  ),
});

export const PullRequestSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  state: z.enum(["open", "closed", "merged"]),
  createdAt: IsoDate,
  mergedAt: IsoDate.nullable(),
  url: z.url(),
  authorLogin: z.string().nullable(),
  mergeCommitSha: z.string().nullable(),
  closesIssues: z.array(z.number().int().positive()),
  reviews: z.array(
    z.object({
      reviewerLogin: z.string(),
      state: z.string(),
      submittedAt: IsoDate,
    }),
  ),
});

export const IssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  state: z.enum(["open", "closed"]),
  createdAt: IsoDate,
  closedAt: IsoDate.nullable(),
  url: z.url(),
  authorLogin: z.string().nullable(),
});

export const CommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: IsoDate,
  url: z.url(),
  authorLogin: z.string().nullable(),
  parent: z.object({
    kind: z.enum(["pr", "issue"]),
    number: z.number().int().positive(),
  }),
});

export const DocSchema = z.object({
  path: z.string(),
  title: z.string(),
  body: z.string(),
  updatedAt: IsoDate,
  url: z.url(),
});

export const SnapshotSchema = z.object({
  fetchedAt: IsoDate,
  defaultBranch: z.string(),
  config: RepoConfigSchema,
  bots: z.array(z.string()),
  commits: z.array(CommitSchema),
  pullRequests: z.array(PullRequestSchema),
  issues: z.array(IssueSchema),
  comments: z.array(CommentSchema),
  docs: z.array(DocSchema),
});

export const CachedDecisionSchema = z.object({
  id: z.string(),
  summary: z.string(),
  rationale: z.string(),
  decidedAt: IsoDate,
  madeBy: z.array(z.string()),
  affects: z.array(z.string()),
  supersedes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const DecisionCacheSchema = z.object({
  entries: z.array(
    z.object({
      threadKey: z.string().regex(/^(pr|issue)-\d+$/),
      contentHash: z.string(),
      decisions: z.array(CachedDecisionSchema),
    }),
  ),
});

export const HandoverCacheSchema = z.object({
  entries: z.array(
    z.object({
      personId: z.string(),
      reportHash: z.string(),
      summary: z.string(),
      pairingReasons: z.array(z.string()),
    }),
  ),
});

export type RepoConfig = z.infer<typeof RepoConfigSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type DecisionCache = z.infer<typeof DecisionCacheSchema>;
export type HandoverCache = z.infer<typeof HandoverCacheSchema>;

export const DATA_FILES = {
  config: "data/config.json",
  snapshot: "data/snapshot.json",
  decisions: "data/decisions.json",
  handovers: "data/handovers.json",
  fixtureSnapshot: "data/fixture/snapshot.json",
  fixtureDecisions: "data/fixture/decisions.json",
} as const;

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function resolvePath(path: string): string {
  return resolve(REPO_ROOT, path);
}

export async function readJsonFile<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const text = await readFile(resolvePath(path), "utf8");
  return schema.parse(JSON.parse(text));
}

export async function readJsonFileOr<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  try {
    return await readJsonFile(path, schema);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  const file = resolvePath(path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}
