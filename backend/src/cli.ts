import {
  DATA_FILES,
  DecisionCacheSchema,
  HandoverCacheSchema,
  RepoConfigSchema,
  SnapshotSchema,
  readJsonFile,
  readJsonFileOr,
  writeJsonFile,
} from "./datafiles.js";
import { openDb } from "./db.js";
import { extractDecisions } from "./decisions.js";
import { getHandover } from "./handover.js";
import { loadEnv } from "./env.js";
import { createRepoSource } from "./github.js";
import { buildSnapshot } from "./ingest.js";
import { createLlm } from "./llm.js";
import { countByLabel, countByRelationship, loadSnapshot } from "./load.js";
import { startMcpServer } from "./mcp.js";
import { getTeamRanking, simulateDeparture } from "./risk.js";
import { startServer } from "./server.js";

const USAGE = `Usage: npm --workspace backend run cli -- <command>

Commands:
  serve            Start the API server
  fetch            Fetch the repo from GitHub into the snapshot file
  load [--fixture] Rebuild the graph from the data files
  extract-decisions  Extract decisions from PR and issue threads with the LLM
  handovers        Cache handover plans for the top 5 people with the LLM
  mcp              Start the MCP server on stdio`;

async function fetchCommand(): Promise<void> {
  const config = await readJsonFile(DATA_FILES.config, RepoConfigSchema);
  const source = await createRepoSource(config.repo, loadEnv().GITHUB_TOKEN);
  const snapshot = await buildSnapshot(config, source, new Date());
  await writeJsonFile(DATA_FILES.snapshot, snapshot);
  console.log(
    `${String(snapshot.commits.length)} commits, ${String(snapshot.pullRequests.length)} PRs, ${String(snapshot.issues.length)} issues, ${String(snapshot.comments.length)} comments, ${String(snapshot.docs.length)} docs`,
  );
}

async function loadCommand(useFixture: boolean): Promise<void> {
  const env = loadEnv();
  const snapshot = await readJsonFile(
    useFixture ? DATA_FILES.fixtureSnapshot : DATA_FILES.snapshot,
    SnapshotSchema,
  );
  const decisions = await readJsonFileOr(
    useFixture ? DATA_FILES.fixtureDecisions : DATA_FILES.decisions,
    DecisionCacheSchema,
    { entries: [] },
  );
  const db = await openDb(env, env.FALKORDB_GRAPH);
  try {
    const summary = await loadSnapshot(db, snapshot, decisions);
    console.log("Nodes:", await countByLabel(db));
    console.log("Relationships:", await countByRelationship(db));
    console.log(summary.nodes, "nodes in", summary.seconds, "seconds");
  } finally {
    await db.close();
  }
}

async function extractDecisionsCommand(): Promise<void> {
  const llm = createLlm(loadEnv());
  if (llm === null) {
    console.error("Set LLM_API_KEY in .env");
    process.exit(1);
  }
  const snapshot = await readJsonFile(DATA_FILES.snapshot, SnapshotSchema);
  const cache = await readJsonFileOr(
    DATA_FILES.decisions,
    DecisionCacheSchema,
    { entries: [] },
  );
  const result = await extractDecisions({
    snapshot,
    cache,
    llm,
    onBatch: async (updated) => {
      await writeJsonFile(DATA_FILES.decisions, updated);
      console.log(`${String(updated.entries.length)} threads cached`);
    },
  });
  const decisions = result.entries.flatMap((entry) => entry.decisions);
  const supersedes = decisions.filter(
    (decision) => decision.supersedes.length > 0,
  );
  console.log(
    `${String(result.entries.length)} threads, ${String(decisions.length)} decisions, ${String(supersedes.length)} superseding`,
  );
}

async function handoversCommand(): Promise<void> {
  const env = loadEnv();
  const llm = createLlm(env);
  if (llm === null) {
    console.error("Set LLM_API_KEY in .env");
    process.exit(1);
  }
  let cache = await readJsonFileOr(DATA_FILES.handovers, HandoverCacheSchema, {
    entries: [],
  });
  const db = await openDb(env, env.FALKORDB_GRAPH);
  try {
    for (const { person } of (await getTeamRanking(db)).slice(0, 5)) {
      const report = await simulateDeparture(db, person.id);
      if (report === null) continue;
      const { generatedBy } = await getHandover({
        report,
        llm,
        cache,
        saveCache: async (updated) => {
          cache = updated;
          await writeJsonFile(DATA_FILES.handovers, updated);
        },
      });
      console.log(`${person.id}: ${generatedBy}`);
    }
  } finally {
    await db.close();
  }
}

switch (process.argv[2]) {
  case "serve":
    await startServer(loadEnv());
    break;
  case "fetch":
    await fetchCommand();
    break;
  case "load":
    await loadCommand(process.argv.includes("--fixture"));
    break;
  case "extract-decisions":
    await extractDecisionsCommand();
    break;
  case "handovers":
    await handoversCommand();
    break;
  case "mcp":
    await startMcpServer(loadEnv());
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
