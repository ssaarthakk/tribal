# Plan: done phases

Phases 0 to 5 of `docs/PLAN.md`, moved here when they were finished. Their specs and `Note:` lines still describe how the code works.

## Phase 0: Plan the product

- [x] **0.1** Write `docs/PROJECT.md`, `docs/ARCHITECTURE.md` and the full phased plan in this file, following `docs/BRIEF.md` section "Instructions for Phase 0".
      Note: FalkorDBLite 0.3.0 does not run on this Windows machine ("Unsupported platform: win32-x64"; it supports only linux-x64 and darwin-arm64, and WSL and Docker are not installed), so development must use FalkorDB Cloud's free tier instead. Tests that need a graph must account for this.
      Note: Phase 1 must provide a local dev graph on a TCP port (`FALKORDB_DEV_PORT`, default 6390) for the FalkorDB MCP server in `.mcp.json`, or point that server at the dev graph on FalkorDB Cloud. The MCP server has not yet been tested against a running graph.
      Note: User decisions (2026-10-17): FalkorDB Cloud for dev and tests, `falkordb/falkordb` service container in CI, FalkorDBLite dropped; emails stored only as hashes; demo repo FalkorDB/FalkorDB; ARCH deviations from the brief accepted (epoch-ms timestamps, log2, derived decision status, `handovers` command, `FALKORDB_HOST`/`PORT`/`USERNAME`/`PASSWORD`). Repo `ssaarthakk/tribal` created and set as `origin` (not pushed).
      Note: Still open: `FALKORDB_HOST`, `FALKORDB_PORT` and `FALKORDB_USERNAME` are not yet in `.env` (needed before task 1.2); `wrangler` 4.147.0 is installed globally and logged in; GitHub token comes from `gh auth token`.

## Phase 1: Foundation

- [x] **1.1 Environment config**
  - **Goal:** Parse and validate every environment variable in one module, and remove the `greet` placeholder.
  - **Files:** create `backend/src/env.ts`, `backend/src/env.test.ts`; delete `backend/src/greet.ts`, `backend/src/greet.test.ts`; modify `backend/src/cli.ts`, `backend/src/index.ts`, `backend/package.json`, `.env.example`.
  - **Spec:**
    - `env.ts` exactly as ARCH §8 `env.ts`. `loadEnv` removes keys whose value is `""`, parses with `EnvSchema.safeParse`, and on failure throws `new Error("Invalid environment variables: " + names.join(", "))` where `names` are the issue paths. Values never appear in the message.
    - `.env.example` becomes exactly these lines (the order doctor.sh prints):
      ```
      FALKORDB_HOST=
      FALKORDB_PORT=6379
      FALKORDB_USERNAME=
      FALKORDB_PASSWORD=
      FALKORDB_GRAPH=tribal
      LLM_API_KEY=
      LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
      LLM_MODEL=gemini-3.5-flash-lite
      GITHUB_TOKEN=
      PORT=3000
      WEB_ORIGIN=http://localhost:5173
      ```
    - `cli.ts` temporarily prints `Usage: npm --workspace backend run cli -- <command>` and exits with code 1 (task 1.4 replaces it). `index.ts` serves `app.get("/", (c) => c.text("Tribal"))` (task 1.4 deletes it).
  - **Dependencies:** `zod` 4.6.5 (backend).
  - **Acceptance criteria:**
    1. `loadEnv({})` returns every default from ARCH §8.
    2. Empty strings count as unset.
    3. Invalid values throw an error naming the variable but not its value.
    4. No file imports `greet` and `greet.ts` is gone.
  - **Tests:** `env.test.ts`: (a) `loadEnv({})` equals `{ FALKORDB_HOST: "localhost", FALKORDB_PORT: 6379, FALKORDB_GRAPH: "tribal", LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/", LLM_MODEL: "gemini-3.5-flash-lite", PORT: 3000, WEB_ORIGIN: "http://localhost:5173" }`; (b) `loadEnv({ GITHUB_TOKEN: "", FALKORDB_PORT: "6380" })` has no `GITHUB_TOKEN` and `FALKORDB_PORT` 6380; (c) `loadEnv({ FALKORDB_PORT: "abc-secret" })` throws a message containing `FALKORDB_PORT` and not containing `abc-secret`; (d) `FALKORDB_GRAPH: "bad-name"` throws.
  - **Verify:** `bash scripts/doctor.sh` lists the new variable names.
  - **Out of scope:** database code, CLI commands, the web app.

- [x] **1.2 Database connection, CI graph and the FalkorDB MCP dev graph**
  - **Goal:** One module that connects to FalkorDB and runs validated queries, a FalkorDB service in CI, and FalkorDB's MCP server pointed at the dev graph.
  - **Files:** create `backend/src/db.ts`, `backend/src/queries.ts`, `backend/src/db.test.ts`, `scripts/falkordb-mcp.sh`; modify `vitest.config.ts`, `.github/workflows/ci.yml`, `.mcp.json`, `backend/package.json`.
  - **Spec:**
    - `db.ts` exactly as ARCH §8 `db.ts`. `openDb` calls `FalkorDB.connect({ socket: { host, port, connectTimeout: 10000 }, username, password })` (omit `username`/`password` when unset; `exactOptionalPropertyTypes` is on) and `db.selectGraph(graphName)`.
    - `read` on a graph that doesn't exist returns `[]`: run one read on a missing graph, find FalkorDB's exact error message, and match only that message. Record the message in a `Note:`.
    - `queries.ts` starts with `PING` and `COUNT_NODES` from ARCH §7.
    - `vitest.config.ts`: before `defineConfig`, `if (existsSync(".env")) process.loadEnvFile(".env");`; add `testTimeout: 60000` and `hookTimeout: 60000`.
    - `ci.yml` job `check`: add a service `falkordb` with image `falkordb/falkordb:<tag>` and `ports: ["6379:6379"]`, and job-level `env: { FALKORDB_HOST: localhost, FALKORDB_PORT: "6379" }`. `<tag>` = the release tag matching the FalkorDB version on the Cloud instance (from `db.info()` or the Cloud dashboard), or the newest tag at least two weeks old with the same major version (for example `v4.22.0`).
    - `scripts/falkordb-mcp.sh` (executable, shebang allowed):
      ```bash
      #!/usr/bin/env bash
      set -eu
      cd "$(dirname "$0")/.."
      if [ -f .env ]; then
        set -a
        . ./.env
        set +a
      fi
      export FALKORDB_DEFAULT_READONLY=true
      exec npx -y @falkordb/mcpserver@1.3.0
      ```
    - `.mcp.json`: the `falkordb` server becomes `{ "type": "stdio", "command": "bash", "args": ["scripts/falkordb-mcp.sh"] }`.
    - This resolves the Phase 0 note about a local dev graph: the MCP server points at the Cloud graph through `.env`.
  - **Dependencies:** `falkordb` 6.8.0 (backend).
  - **Acceptance criteria:**
    1. `db.read(PING, {}, z.object({ one: z.number() }))` returns `[{ one: 1 }]` against the Cloud instance.
    2. A row that doesn't match the schema makes `read` reject.
    3. `deleteGraph()` on a graph that doesn't exist resolves.
    4. CI defines the FalkorDB service and env.
    5. The FalkorDB procedures in ARCH §3 were tried on the Cloud instance and the results recorded.
  - **Tests:** `db.test.ts` (uses `loadEnv()` and a random `tribal_test_` graph name): (a) PING returns `[{ one: 1 }]`; (b) PING with schema `z.object({ one: z.string() })` rejects; (c) `deleteGraph()` on a never-created graph resolves; (d) `read(COUNT_NODES, …)` on a never-created graph returns `[]`.
  - **Verify:** `npm run check` (runs against Cloud). Then, in a throwaway script in the scratchpad directory (not committed, Cypher allowed there), on a throwaway graph with three `Person` nodes joined by `COLLABORATES_WITH` edges in one direction only, run `algo.pageRank`, `algo.betweenness` and `db.idx.fulltext.createNodeIndex`/`queryNodes` exactly as ARCH §3, and delete the graph. Add one `Note:` line with: the server version, whether each call worked, and whether betweenness counted the one-way edges as directed. If any procedure fails, stop and ask.
  - **Out of scope:** loading data, other queries. Testing the MCP server itself happens at the start of task 1.3, because MCP servers load when a session starts.
    Note: FalkorDB's missing-graph error is exactly `ERR Invalid graph operation on empty key`. It is returned by `GRAPH.RO_QUERY` (even for `RETURN 1`) and by `GRAPH.DELETE`, so `db.test.ts` runs `db.write(PING)` first in tests (a) and (b) to create the graph; `read(PING)` on a never-created graph returns `[]`, not `[{ one: 1 }]`. Each test opens its own random graph.
    Note: Cloud instance: FalkorDB graph module 42200 (v4.22.0), CI service pinned to `falkordb/falkordb:v4.22.0`. On a throwaway graph all procedures worked as in ARCH §3: `algo.pageRank` (a→b and c→b gave b 0.574, a and c 0.213 each), `algo.betweenness` (all 0 for a→b and c→b, so it treats edges as directed; storing both directions as ARCH says stays correct), `db.idx.fulltext.createNodeIndex` and `queryNodes` (`'retry|typo'` matched both PRs). The throwaway graph was deleted.
    Note: The FalkorDB MCP server (`scripts/falkordb-mcp.sh`) has not been started yet; task 1.3 tests it at session start.
    Note: Task 1.3 tested it. The session's own connection to `falkordb` closed at startup (likely the first `npx` download), but running `bash scripts/falkordb-mcp.sh` over stdio worked: it initialised, listed 7 tools including `list_graphs`, and `list_graphs` returned an empty list. No script change was needed; if the connection still fails in a fresh session, run `/mcp` to reconnect.

- [x] **1.3 Data file schemas and the fixture**
  - **Goal:** zod schemas and helpers for every file in `data/`, the demo config, and the synthetic fixture.
  - **Files:** create `backend/src/datafiles.ts`, `backend/src/datafiles.test.ts`, `data/config.json`, `data/fixture/snapshot.json`, `data/fixture/decisions.json`; delete `data/.gitkeep`.
  - **Spec:**
    - First, check that FalkorDB's MCP server works in this session: call its list-graphs tool. If it fails, fix `scripts/falkordb-mcp.sh` or `.mcp.json` (stop and ask if it needs the user), and add a `Note:` under task 1.2.
    - `datafiles.ts` exactly as ARCH §8 `datafiles.ts`.
    - `data/config.json` exactly as ARCH §12. The two fixture files are copied exactly from ARCH §12 (whitespace may differ; content must be identical).
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Both fixture files and `data/config.json` parse with their schemas.
    2. The fixture has 20 commits, 8 PRs, 6 issues, 7 comments, 3 docs and 3 decisions.
    3. Paths resolve from the repo root regardless of the working directory.
  - **Tests:** `datafiles.test.ts`: (a) `readJsonFile(DATA_FILES.fixtureSnapshot, SnapshotSchema)` has the counts above and `fetchedAt` `2026-10-01T00:00:00.000Z`; (b) fixture decisions have 2 entries and 3 decisions in total; (c) `data/config.json` parses and has repo `FalkorDB/FalkorDB`; (d) `readJsonFileOr` on a missing file in `os.tmpdir()` returns the fallback; (e) `writeJsonFile` then `readJsonFile` round-trips an object in `os.tmpdir()`.
  - **Verify:** `npm run check`.
  - **Out of scope:** loading into the graph, fetching.
    Note: `datafiles.ts` resolves paths with `path.resolve(repoRoot, path)` instead of `new URL(...)`, so absolute paths (the `os.tmpdir()` tests) pass through unchanged.

- [x] **1.4 Health route, server, CLI skeleton and the typed web client**
  - **Goal:** A running Hono API with `GET /api/health`, a CLI with `serve`, and the web app calling it through the typed Hono client.
  - **Files:** create `backend/src/app.ts`, `backend/src/app.test.ts`, `backend/src/server.ts`, `backend/src/risk.ts`, `web/src/api.ts`; modify `backend/src/cli.ts`, `backend/package.json`, `web/package.json`, `web/src/App.tsx`, `web/vite.config.ts`, `web/tsconfig.json`; delete `backend/src/index.ts`.
  - **Spec:**
    - `risk.ts`: only `countNodes(db)` for now: `COUNT_NODES` with row schema `z.object({ nodes: z.number() })`, returns the first row's `nodes` or 0.
    - `app.ts`: `AppDeps = { db: Db; webOrigin: string }` (later tasks add fields). `createApp` as ARCH §9 with `cors` from `hono/cors` and `GET /api/health` → `c.json({ ok: true as const, nodes })`. Export `AppType`.
    - `server.ts`: `export async function startServer(env: Env): Promise<void>`: `openDb(env, env.FALKORDB_GRAPH)`, `createApp`, `serve({ fetch: app.fetch, port: env.PORT })`, log `Backend listening on http://localhost:<port>`.
    - `cli.ts`: reads `process.argv[2]`. `serve` → `startServer(loadEnv())`. Anything else → print usage (command list with one line each) to stderr, exit code 1. Later tasks add commands to the same `switch`.
    - `backend/package.json` scripts: `"dev": "tsx watch --env-file-if-exists=../.env src/cli.ts serve"`, `"start": "node --env-file-if-exists=../.env dist/cli.js serve"`; `build` and `cli` unchanged.
    - Web: `api.ts` exactly as ARCH §9. `web/tsconfig.json` adds `"references": [{ "path": "../backend" }]`. `vite.config.ts` adds `server: { proxy: { "/api": "http://localhost:3000" } }`. `App.tsx` shows the title and a status line: "Backend connected: N nodes in the graph" or "Backend not reachable", using `api.api.health.$get()` in a `useEffect`.
    - ARCH §6 allows web to import types only. If `tsc -b` can't resolve the backend types through the project reference, stop and ask.
  - **Dependencies:** `hono` 4.13.13 (web).
  - **Acceptance criteria:**
    1. `GET /api/health` returns `{ ok: true, nodes: <number> }`.
    2. `npm --workspace backend run cli -- serve` starts the server; an unknown command exits with code 1.
    3. The web app's call is type-checked: changing `nodes` to a string in the route makes `tsc -b` fail (try it, then revert).
  - **Tests:** `app.test.ts`: (a) `createApp({ db, webOrigin: "http://localhost:5173" }).request("/api/health")` on a fresh `tribal_test_` graph returns 200 and `{ ok: true, nodes: 0 }`; (b) the response has `access-control-allow-origin: http://localhost:5173` when the request sends that `Origin`.
  - **Verify:** `npm --workspace backend run dev` and `npm --workspace web run dev`, open http://localhost:5173 and see the status line (use the `run` skill).
  - **Out of scope:** other routes, auto-seeding (8.2).

## Phase 2: Ingestion and graph loading (F1, F2)

- [x] **2.1 Components and identity merging**
  - **Goal:** Pure functions that map files to components and merge GitHub logins, emails and names into people.
  - **Files:** create `backend/src/components.ts`, `backend/src/components.test.ts`, `backend/src/identity.ts`, `backend/src/identity.test.ts`.
  - **Spec:** exactly ARCH §8 `components.ts` and `identity.ts`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Fixture components are exactly the six in ARCH §12.
    2. Fixture people and commit authors match ARCH §12.
    3. Bots never become people.
  - **Tests:** `components.test.ts`: `componentOf` with the fixture config: `src/db/pool.ts` → `src/db`, `README.md` → `(root)`, `vendor/lib.js` → `null`, `tests/api.test.ts` → `tests`; with the demo config: `graph/src/runtime/eval.rs` → `graph/src/runtime`, `src/commands/x.c` → `src/commands`, `src/module.c` → `src`, `deps/GraphBLAS/a.c` → `null`; `selectComponents(fixture)` = `["docs", "src/api", "src/auth", "src/db", "src/ui", "tests"]`; `componentName("graph/src/runtime")` = `runtime`. `identity.test.ts`: people ids `["alice", "bob", "carol", "dave", "erin"]`; names as ARCH §12; `commitAuthor` for `c18…` = `dave`, `c19…` = `carol`, `c20…` = `null`; `personIdForLogin("dependabot[bot]")` = `null`; `nameKey("  Carol   Diaz ")` = `carol diaz`.
  - **Verify:** `npm run check`.
  - **Out of scope:** the graph.

- [x] **2.2 Graph loader**
  - **Goal:** Rebuild the graph from a snapshot and a decision cache, idempotently, and add the `load` command.
  - **Files:** create `backend/src/load.ts`, `backend/src/load.test.ts`, `backend/src/test-graph.ts`; modify `backend/src/queries.ts`, `backend/src/cli.ts`.
  - **Spec:**
    - Add to `queries.ts`: `CREATE_INDEXES`, `CREATE_FULLTEXT_INDEXES`, `COUNT_LABELS`, `COUNT_RELATIONSHIPS` and every query under "Loading (F2)" in ARCH §7.
    - `load.ts` as ARCH §8 `load.ts`, except that `computeExpertise` doesn't exist yet: leave that step out (task 3.1 adds it). Also export `countByLabel(db): Promise<Record<string, number>>` and `countByRelationship(db): Promise<Record<string, number>>`. Timestamps are converted with `Date.parse`. Rows are sent in chunks of 500.
    - `test-graph.ts`: `export async function withFixtureGraph(): Promise<{ db: Db; snapshot: Snapshot; cleanup(): Promise<void> }>` opens a `tribal_test_<random>` graph with `loadEnv()`, reads both fixture files, runs `loadSnapshot`, and `cleanup` deletes the graph and closes the connection.
    - CLI `load`: reads `DATA_FILES.snapshot` and `DATA_FILES.decisions` (`readJsonFileOr` with `{ entries: [] }` for decisions), or the fixture files with `--fixture`; loads into `FALKORDB_GRAPH`; prints node and relationship counts and seconds.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Fixture counts equal the ARCH §12 table (all rows except `KNOWS_ABOUT` and `COLLABORATES_WITH`, which come in Phase 3).
    2. Loading twice into the same graph gives the same counts.
    3. Quotes, backslashes, newlines and emoji in text round-trip.
    4. `DESCRIBES` edges match ARCH §12.
  - **Tests:** `load.test.ts` (one `withFixtureGraph` in `beforeAll`): (a) `countByLabel` and `countByRelationship` match ARCH §12; (b) call `loadSnapshot` again on the same db and counts are unchanged; (c) on a separate test graph, load a copy of the fixture where PR 1's title is `He said "hi" \ back\slash` + newline + `'single' 🚀`, and read it back with `COMPONENT_RECENT_PULL_REQUESTS` (path `src/db`, limit 5; add that query from ARCH §7 in this task) unchanged; (d) `docComponents` for the three fixture docs gives the ARCH §12 lists.
  - **Verify:** `npm --workspace backend run cli -- load --fixture`, then check the graph with FalkorDB's MCP server (read-only): `MATCH (p:Person) RETURN p.id`.
  - **Out of scope:** derived edges, fetching.
  - Note: the FalkorDB MCP server failed to connect this session, so the `MATCH (p:Person)` check was not run; `load --fixture` printed the expected counts instead, and the loader tests read the graph back.

- [x] **2.3 GitHub source**
  - **Goal:** The only module that talks to GitHub: REST calls with pagination and rate-limit handling.
  - **Files:** create `backend/src/github.ts`, `backend/src/github.test.ts`.
  - **Spec:** exactly ARCH §8 `github.ts`. `gh auth token` runs through promisified `execFile` from `node:child_process`. Responses are validated with the raw zod schemas; arrays are validated per page.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. `commits` skips merge commits and returns the files of each commit, across pages.
    2. `parseClosingReferences` finds all GitHub closing keywords.
    3. `nextPageUrl` extracts `rel="next"` or returns `null`.
    4. No test calls the network.
  - **Tests:** `github.test.ts`: (a) `createRepoSource("o/r", "t", fakeFetch)` where `fakeFetch` serves a commit list in two pages (linked by `Link` headers; three commits, one with two parents) and a detail response per commit: `commits("main", "2026-01-01")` returns the two non-merge commits with their files, and every request has `Authorization: Bearer t`; (b) `parseClosingReferences("Fixes #9, closes #12 and resolved #9; see #4")` = `[9, 12]`; (c) `nextPageUrl('<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last"')` = `https://api.github.com/x?page=2`, and `nextPageUrl(null)` = `null`.
  - **Verify:** a throwaway scratchpad script calls `createRepoSource("FalkorDB/FalkorDB", undefined)` → `defaultBranch()` prints `main` (live, read-only).
  - **Out of scope:** building the snapshot, writing files.

- [x] **2.4 Build the snapshot and the `fetch` command**
  - **Goal:** Turn GitHub data into a validated snapshot file.
  - **Files:** create `backend/src/ingest.ts`, `backend/src/ingest.test.ts`; modify `backend/src/cli.ts`.
  - **Spec:** exactly ARCH §8 `ingest.ts`. `buildSnapshot` calls the source in this order: `defaultBranch`, `pullRequests`, `reviews` for each PR (sequentially, logging progress every 50 PRs to stderr), `issues` (dropping items with `pull_request`), `issueComments`, `reviewComments`, `commits`, `markdownDocs`; returns `SnapshotSchema.parse(result)`. CLI `fetch`: reads `DATA_FILES.config`, `createRepoSource(config.repo, env.GITHUB_TOKEN)`, writes `DATA_FILES.snapshot`, prints counts.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. With a fake `RepoSource`, the snapshot is valid and deterministic (same input → identical JSON).
    2. No raw email appears anywhere in the snapshot.
    3. Bots, PR states, comment parents and closing references follow ARCH §8.
  - **Tests:** `ingest.test.ts` with an in-test fake `RepoSource` (2 PRs: one merged with a review from a `Bot`-type user and a body "Fixes #3", one open; 1 issue #3; 1 issue comment on PR 1 and 1 on issue #3; 1 review comment on PR 1; 2 commits, one by `dependabot[bot]`; 1 doc `docs/a.md` starting `# A title`): (a) PR 1 state `merged` and `closesIssues` `[3]`; (b) bots = the bot logins, sorted; (c) comment ids `ic-…`/`rc-…` with correct parent kinds; (d) `JSON.stringify(snapshot)` doesn't contain `@`-emails from the fake commits; `authorEmailHash` = `emailHash` of them; (e) doc title `A title`; (f) running twice gives identical JSON.
  - **Verify:** `npm run check`. (The live fetch is task 2.5.)
  - **Out of scope:** the live fetch, loading.

- [x] **2.5 Fetch and load the demo repo**
  - **Goal:** Produce `data/snapshot.json` for FalkorDB/FalkorDB and load it into the Cloud graph, within the memory budget.
  - **Files:** create `data/snapshot.json` (generated); modify `data/config.json` only if the checks below require it.
  - **Spec:** run `npm --workspace backend run cli -- fetch` (live GitHub; about 2,100 requests, 15–30 minutes; run it in the background and wait for completion). Then `npm --workspace backend run cli -- load`. Measure memory with a throwaway scratchpad script calling the `falkordb` client's `graph.memoryUsage()` for graph `tribal`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. `data/snapshot.json` parses with `SnapshotSchema` and contains no `@` email addresses (grep for `@users.noreply` and `@gmail` returns nothing).
    2. `selectComponents` returns between 15 and 40 components. If not, adjust `minComponentCommits` only, and note why.
    3. The loaded graph uses at most 60 MB. If more, stop and ask (options: shorten `since`, lower body limits).
    4. A `Note:` records: commits, PRs, issues, comments, docs, people, components, graph MB, fetch minutes, load seconds.
  - **Tests:** none new (no new code). `npm run check` still passes.
  - **Verify:** with FalkorDB's MCP server: `MATCH (c:Component) RETURN c.path ORDER BY c.path`.
  - **Out of scope:** expertise, decisions.
  - Note: 504 commits, 1,200 PRs, 1,775 issues, 11,459 comments, 16 docs, 275 people, 35 components (`minComponentCommits` unchanged), graph 20 MB, fetch 20 minutes (one earlier attempt died on a transient GitHub 502), load 3.5 seconds.
  - Note: a contributor email in a PR `Signed-off-by` trailer broke criterion 1, so `ingest.ts` now redacts email addresses to `[email]` in all titles and bodies before truncating (test in `ingest.test.ts`). The existing snapshot was redacted in place instead of refetched; the 14 bodies that were at their length limit were re-read from GitHub so the file matches what `fetch` now produces. The FalkorDB MCP server was down, so the component check ran read-only through `openDb`.

## Phase 3: Expertise and knowledge risk (F3, F4)

- [x] **3.1 Expertise scores, experts and bus factor**
  - **Goal:** Compute `KNOWS_ABOUT`, experts and bus factor in Cypher as part of every load.
  - **Files:** create `backend/src/expertise.ts`, `backend/src/expertise.test.ts`; modify `backend/src/queries.ts`, `backend/src/load.ts`, `backend/src/load.test.ts`.
  - **Spec:** `SCORING` and `computeExpertise` exactly as ARCH §4 and §8, but run only `DELETE_KNOWS_ABOUT` through `SET_BUS_FACTOR` (collaboration comes in 3.2). Add those queries plus `LIST_COMPONENTS` and `PERSON_COMPONENTS` from ARCH §7. `loadSnapshot` calls `computeExpertise(db, Date.parse(snapshot.fetchedAt))` after `SET_DECISION_STATUS`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Every `KNOWS_ABOUT` score, share, last-active date and expert flag equals the ARCH §12 table (scores and shares to 4 decimals).
    2. Bus factors equal ARCH §12.
    3. Running `computeExpertise` twice gives the same values (no double counting).
  - **Tests:** `expertise.test.ts` (one `withFixtureGraph`): (a) for each of the 5 people, `PERSON_COMPONENTS` rows match the table (`toBeCloseTo(x, 4)`; `lastActive` compared as ISO date prefix); (b) `LIST_COMPONENTS` bus factors match; (c) after a second `computeExpertise`, (a) still holds. `load.test.ts`: `KNOWS_ABOUT` count is 17.
  - **Verify:** `npm --workspace backend run cli -- load`, then with the MCP server list the 10 lowest-bus-factor components of the demo graph.
  - **Out of scope:** collaboration, routes.
  - Note: the FalkorDB MCP server was down, so the queries were checked read-only through `openDb`. The demo graph has 387 `KNOWS_ABOUT` edges. Lowest bus factors: `graph/src/parser` 1, then `.github`, `bench/src`, `graph`, `graph/src/effects`, `graph/src/graph`, `graph/src/index`, `graph/src/planner`, `graph/src/runtime` and `src/algorithms` at 2.

- [x] **3.2 Collaboration graph and team ranking**
  - **Goal:** Build `COLLABORATES_WITH` and rank people with FalkorDB's PageRank and betweenness.
  - **Files:** create `backend/src/risk.test.ts`; modify `backend/src/expertise.ts`, `backend/src/queries.ts`, `backend/src/risk.ts`, `backend/src/schemas.ts` (create), `backend/src/expertise.test.ts`.
  - **Spec:** `computeExpertise` now also runs `DELETE_COLLABORATION`, `ADD_REVIEW_COLLABORATION`, `ADD_SHARED_EXPERTISE_COLLABORATION` (weight `SCORING.sharedExpertiseWeight`). Add those queries and `TEAM_PAGERANK`, `TEAM_BETWEENNESS`, `NEARBY_COLLABORATORS`. `schemas.ts`: `PersonRefSchema`, `RankedPersonSchema`, `TeamRankingSchema` (ARCH §8). `risk.ts`: `getTeamRanking` as ARCH §8.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Collaboration weights equal ARCH §12, in both directions.
    2. Ranking: Alice first by PageRank and highest betweenness; Bob last by PageRank with betweenness 0; Carol, Dave and Erin betweenness 0.
    3. PageRank and betweenness come from FalkorDB procedures, not TypeScript.
  - **Tests:** `expertise.test.ts`: `NEARBY_COLLABORATORS` for alice = carol 2, bob 1.5, erin 1.5, dave 1 (in that order); for dave the direct weights are erin 3, alice 1, carol 0.5 and bob 0 (two hops); `COLLABORATES_WITH` count 14. `risk.test.ts`: `getTeamRanking` assertions from acceptance criterion 2.
  - **Verify:** print the demo graph's top 10 ranking from a throwaway scratchpad script and add it as a `Note:` (used to choose demo people later).
  - **Out of scope:** routes.
  - Note: the ARCH §7 `ADD_REVIEW_COLLABORATION` made duplicate edges on FalkorDB when two people reviewed each other (both rows MERGE both directions in one query, and FalkorDB does not see edges made by earlier rows), giving 18 edges instead of 14. It now groups by the unordered pair (`first`/`second` by id) before the MERGEs; same weights, ARCH §7 updated to match. The FalkorDB MCP server was down, so queries were checked through `openDb` and the tests.
  - Note: demo graph has 92 `COLLABORATES_WITH` edges over 275 people. Top 10 by PageRank (PageRank, betweenness): swilly22 0.0016 840, AviAvni 0.0013 630, GomezGab 0.0011 496, gkorland 0.0009 252.5, DvirDukhan 0.0008 247.3, barakb 0.0008 124.3, dudizimber 0.0007 66.8, MuhammadQadora 0.0003 0, Anchel123 0.0003 0, danshalev7 0.0002 0.

- [x] **3.3 Departure simulation**
  - **Goal:** The hero query: what happens if a person leaves, plus `POST /api/simulate`.
  - **Files:** modify `backend/src/queries.ts`, `backend/src/schemas.ts`, `backend/src/risk.ts`, `backend/src/risk.test.ts`, `backend/src/app.ts`, `backend/src/app.test.ts`, `backend/package.json`.
  - **Spec:** add `GET_PERSON`, `OPEN_WORK`, `DEPARTURE_COMPONENTS`, `DEPARTURE_SUCCESSORS`, `DEPARTURE_DECISIONS`. Add to `schemas.ts`: `RiskLevelSchema`, `SuccessorSchema`, `AffectedComponentSchema`, `OrphanedDecisionSchema`, `WorkItemSchema`, `CollaboratorSchema`, `DepartureReportSchema`, `PersonIdRequestSchema`, `riskLevel`, `toIso`. `simulateDeparture` as ARCH §8; `OPEN_WORK` rows sorted `pr` before `issue`, then by number. Route `POST /api/simulate` with `zValidator("json", PersonIdRequestSchema)`; 404 `{ error: "not_found" }` when the person doesn't exist.
  - **Dependencies:** `@hono/zod-validator` 0.9.1 (backend).
  - **Acceptance criteria:**
    1. The report for `alice` equals ARCH §12 (all fields, exact values).
    2. The report for `bob` equals ARCH §12.
    3. Unknown person → `null` from `simulateDeparture` and 404 from the route; invalid body → 400.
    4. Nothing in the graph changes (node and relationship counts identical before and after).
  - **Tests:** `risk.test.ts`: (a) alice report deep-equals the full expected object (write it out in the test from ARCH §12; dates as ISO strings); (b) bob report; (c) `simulateDeparture(db, "nobody")` is `null`; (d) counts unchanged. `app.test.ts`: `POST /api/simulate` with `{ personId: "alice" }` → 200 and `orphaned` `["src/db"]`; `{ personId: "nobody" }` → 404; `{}` → 400.
  - **Verify:** `curl -X POST localhost:3000/api/simulate -H 'content-type: application/json' -d '{"personId":"<top person from 3.2>"}'` on the demo graph.
  - **Out of scope:** handover plan, UI.
  - Note: the FalkorDB MCP server was down, so the new queries were checked through the tests and the running server. Demo check: `swilly22` leaving drops 10 components from bus factor 2 to 1 (critical), orphans none, and leaves 40 open work items.

- [x] **3.4 Read models and routes: risk map, ranking, component, person**
  - **Goal:** Everything the Risk Map needs, as functions and routes.
  - **Files:** modify `backend/src/queries.ts`, `backend/src/schemas.ts`, `backend/src/risk.ts`, `backend/src/risk.test.ts`, `backend/src/app.ts`, `backend/src/app.test.ts`.
  - **Spec:** add `RISK_MAP_LINKS`, `GET_COMPONENT`, `COMPONENT_EXPERTS`, `COMPONENT_DECISIONS`, `COMPONENT_DOCS`, `PERSON_DECISIONS` (`COMPONENT_RECENT_PULL_REQUESTS` exists from 2.2). Schemas from ARCH §8 needed by these functions. Functions `listComponents`, `getRiskMap`, `getComponent`, `getPerson`, `getDecisionHistory` as ARCH §8. Routes `GET /api/risk-map`, `GET /api/ranking`, `GET /api/component?path=` as ARCH §9 (`getPerson` has no route; the `get_person` tool uses it).
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Fixture risk map: 6 components with ARCH §12 bus factors and risk levels; links only where share ≥ 0.05 (15 links: all 17 except bob on `src/auth` and dave on `src/db`); 5 people.
    2. `getComponent(db, "src/api")`: experts bob then alice; decisions `issue-9-1` (superseded) then `issue-9-2` (active, `supersedes: ["issue-9-1"]`, `madeBy` alice and bob); docs `README.md`; recent PRs `[2]`.
    3. `getPerson(db, "alice")`: 4 components with `src/db` first; 3 decisions; open work PR 8 and issue 12.
    4. Unknown path or id → 404.
  - **Tests:** `risk.test.ts` for criteria 1–3 (exact values); `app.test.ts`: each route returns 200 for a fixture value and 404 for an unknown one.
  - **Verify:** `curl localhost:3000/api/risk-map | head -c 500` on the demo graph.
  - **Out of scope:** search.
  - Note: the FalkorDB MCP server was down, so the new queries were checked through the tests and the running server. `madeBy` and `supersedes` are sorted in TypeScript because `collect` order is not fixed. Risk-map links tie on score (carol and erin on `tests`), so the test sorts links before comparing.

- [x] **3.5 Full-text search and "who knows about X"**
  - **Goal:** Find PRs, issues, decisions and docs by keywords, and the people who know the matching components.
  - **Files:** create `backend/src/search.ts`, `backend/src/search.test.ts`; modify `backend/src/queries.ts`, `backend/src/schemas.ts`.
  - **Spec:** add `SEARCH_ALL` and `TOPIC_COMPONENTS` (ARCH §7, including the fallback rule for `SEARCH_ALL`). Schemas `SearchHitSchema`, `SourceSchema`, `TopicComponentSchema`, `WhoKnowsSchema`, `ExpertiseSchema`. `search.ts` exactly as ARCH §8. `search` and `whoKnows` return empty results without querying when `toFullTextQuery` is empty.
  - **Dependencies:** none.
  - **Acceptance criteria:** the three search expectations in ARCH §12 hold; `toFullTextQuery("a an -- @#")` = `""`; user text with RediSearch special characters never causes a query error.
  - **Tests:** `search.test.ts`: ARCH §12 search expectations; `search(db, 'pagination" OR 1=1 -- @title:{x}')` resolves (no throw); `toFullTextQuery` cases: duplicates removed, words under 3 characters dropped, lowercased.
  - **Verify:** throwaway script: `whoKnows(db, "query planner")` on the demo graph returns components under `graph/src/planner` or `src/execution_plan`; record the top result in a `Note:`.
  - **Out of scope:** the agent.
  - Note: `SEARCH_ALL` runs as written (FalkorDB accepts `ORDER BY ... LIMIT` in `UNION` branches). The FalkorDB MCP server was down, so queries were checked through the tests. `ExpertRowSchema` and `toExpertise` live in `schemas.ts` so `risk` and `search` share them without breaking module boundaries. Demo check fails as specified: `whoKnows(db, "query planner")` ranks `tests/flow` first (153.6), then `(root)`, `.github/workflows`. Summed scores favour widely touched components, and "query" matches most PRs; `src/execution_plan` is 10th. With "planner" alone `graph/src/planner` is 2nd. User chose to keep the ARCH ranking; pick demo topics that rank well.

## Phase 4: Decisions (F5)

- [x] **4.1 LLM module**
  - **Goal:** One module for all LLM calls, with structured output, tool calling, retries and a replaceable `fetch`.
  - **Files:** create `backend/src/llm.ts`, `backend/src/llm.test.ts`; modify `backend/package.json`.
  - **Spec:** exactly ARCH §8 `llm.ts`. Before writing code, check the current `openai` 7.27.0 API for `chat.completions.create`, `response_format` with `json_schema`, and its `RateLimitError` class, and Gemini's OpenAI-compatibility page for anything unsupported (record in a `Note:`).
  - **Dependencies:** `openai` 7.27.0 (backend).
  - **Acceptance criteria:**
    1. `createLlm` returns `null` without `LLM_API_KEY`.
    2. `json` returns schema-valid data and rejects invalid or non-JSON output with an error naming the schema.
    3. `chat` returns tool calls in our own `LlmToolCall` shape.
    4. HTTP 429 becomes `RateLimitError`.
  - **Tests:** `llm.test.ts` with `options.fetch` returning canned `Response`s (OpenAI chat completion JSON) and `maxRetries: 0`: (a) null without key; (b) `json` with content `{"n":1}` and schema `z.object({ n: z.number() })` → `{ n: 1 }`; and the request body sent to fetch contains `"type":"json_schema"`; (c) content `not json` rejects with a message containing the schema name; (d) a response with one tool call `{ id: "t1", function: { name: "bus_factor", arguments: "{}" } }` → `toolCalls` `[{ id: "t1", name: "bus_factor", arguments: "{}" }]`; (e) status 429 → `RateLimitError`; (f) `toJsonSchema` output has no `$schema` key.
  - **Verify:** throwaway scratchpad script: one live `json` call with a tiny schema using `.env`; it must succeed with `gemini-3.5-flash-lite`. If the endpoint rejects the JSON schema, adjust `toJsonSchema` and note what was removed.
  - **Out of scope:** prompts, decision logic.
    Note: Gemini's OpenAI-compatibility page lists no unsupported parameters for `response_format` `json_schema` or `tools`/`tool_choice`; a live `json` call (zod object with string, number and string array) and a live `chat` tool call both succeeded with `gemini-3.5-flash-lite`, so `toJsonSchema` removes only `$schema`.

- [x] **4.2 Decision extraction**
  - **Goal:** Pick likely decision threads, extract decisions with the LLM in batches, validate them, and cache them by content hash; add `extract-decisions`.
  - **Files:** create `backend/src/decisions.ts`, `backend/src/decisions.test.ts`; modify `backend/src/cli.ts`.
  - **Spec:**
    - `Thread`, `buildThreads`, `selectCandidateThreads`, `threadHash`, `extractDecisions`, `ExtractionSchema` as ARCH §8.
    - `buildThreads`: one thread per PR (`key` `pr-<n>`) and per issue (`issue-<n>`). `participants`: sorted unique non-bot logins of the author, reviewers (PRs) and comment authors. `components`: PR → selected components of its merge commit's files; issue → union of the components of PRs that close it. `body` cut to 1,500 characters; `comments`: the first 15 by `createdAt`, bodies cut to 500, `author` = login or `unknown`.
    - `DECISION_HINT = /\b(decid\w*|decision\w*|agree[ds]?|instead of|rather than|we (?:should|will|won't)|propos\w*|rfc|deprecat\w*|trade-?offs?|going forward|supersed\w*)\b/gi`.
    - `selectCandidateThreads`: hint count = number of matches in title, body and comment bodies; keep threads with at least one; sort by count desc, `createdAt` desc, key; take `max`; return them sorted by `createdAt` asc, then key.
    - `threadHash` = first 16 hex of SHA-256 of `model + JSON.stringify(thread)`.
    - `ExtractionSchema = z.object({ threads: z.array(z.object({ key: z.string(), decisions: z.array(z.object({ summary: z.string(), rationale: z.string(), decidedAt: z.string(), madeBy: z.array(z.string()), affects: z.array(z.string()), supersedes: z.array(z.string()), confidence: z.number() })) })) })`.
    - `extractDecisions`: candidates = `selectCandidateThreads(buildThreads(snapshot), snapshot.config.maxDecisionThreads)`; skip threads whose cache entry has the same `threadHash`; process the rest in batches of 5 in order. Per batch, call `llm.json([system, user], ExtractionSchema, "decision_extraction")` where the system message is exactly:

      > You read GitHub pull request and issue threads and extract engineering decisions: choices the participants explicitly made or agreed on, such as a design, a library, an approach, a convention, or rejecting an alternative. Ignore routine work such as bug fixes without a stated choice, version bumps and review nits. Return every thread key with a list of decisions, empty if there are none. For each decision give: summary (one sentence, at most 25 words), rationale (why, at most 40 words, taken from the thread), decidedAt (ISO 8601 time of the comment or event where it was decided), madeBy (GitHub logins from the thread's participants who made or agreed to it), affects (paths from the components list), supersedes (ids from earlierDecisions that this decision replaces, otherwise empty) and confidence (0 to 1). Use only information in the threads.

      and the user message is `JSON.stringify({ components, earlierDecisions, threads })`: `components` = all selected component paths; `earlierDecisions` = up to 30 decisions already in the cache (`{ id, summary, affects }`), newest first, that share a component with the batch, or the 30 newest when the batch has no components.

    - Validation per returned decision (threads not in the batch are ignored): drop `madeBy` logins not in the thread's participants, `affects` not in `components`, `supersedes` ids not in `earlierDecisions`; drop the decision if `confidence < 0.5` or `madeBy` is empty; `decidedAt` = the parsed value if valid and between the thread's `createdAt` and `snapshot.fetchedAt`, else the thread's `createdAt`; `confidence` clamped to 0–1; ids `<key>-<n>` numbered from 1 in returned order. Every thread in the batch gets a cache entry (empty `decisions` if none), replacing any older entry with the same key. Entries sorted by `threadKey`. Call `onBatch(cache)` after each batch.
    - Waits: `sleep(4000)` between batches; on `RateLimitError`, `sleep(60000)` and retry the same batch, up to 5 times, then rethrow. `sleep` defaults to a `setTimeout` promise.
    - CLI `extract-decisions`: requires an LLM (exit 1 with "Set LLM_API_KEY in .env" otherwise); reads snapshot and `readJsonFileOr(DATA_FILES.decisions, …, { entries: [] })`; `onBatch` writes `DATA_FILES.decisions`; prints progress and totals.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. On the fixture, the candidates are exactly `issue-9` then `pr-3`.
    2. Invalid LLM values are dropped as specified; ids are assigned by us.
    3. A second run with the resulting cache makes zero LLM calls.
    4. A 429 waits and retries the batch.
  - **Tests:** `decisions.test.ts` with a fake `Llm` (records calls, returns scripted `json` results) and a fake `sleep`: (a) `buildThreads(fixture)`: `pr-3` participants `["alice", "dave"]`, components `["src/db"]`; `issue-9` participants `["alice", "bob"]`, components `["src/api"]`; (b) candidates `["issue-9", "pr-3"]`; (c) a scripted answer with madeBy `["alice", "mallory"]`, affects `["src/api", "src/nope"]`, supersedes `["x-1"]`, and a second decision with confidence 0.3 → one decision `issue-9-1` with madeBy `["alice"]`, affects `["src/api"]`, supersedes `[]`; (d) running again with the returned cache → fake called 0 times; (e) first call throws `RateLimitError`, second succeeds → result present and `sleep` called with 60000.
  - **Verify:** `npm run check`. (The live run is 4.3.)
  - **Out of scope:** loading (already done by `load.ts`).

- [x] **4.3 Extract decisions for the demo repo**
  - **Goal:** Produce `data/decisions.json` for the demo, load it and check its quality.
  - **Files:** create `data/decisions.json` (generated).
  - **Spec:** run `npm --workspace backend run cli -- extract-decisions` (live LLM, about 60 requests; run in the background). Then `cli -- load`. Read 10 decisions and their source threads (via FalkorDB's MCP server and the source URLs) and judge them.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. `data/decisions.json` parses and covers every candidate thread.
    2. At least 30 decisions are loaded and at least one `SUPERSEDES` edge exists (if none, note it; don't fake one).
    3. At least 8 of the 10 spot-checked decisions are real decisions stated in their thread. If not, stop and ask whether to switch `LLM_MODEL` to `gemini-3.8-flash`.
    4. A `Note:` records decisions count, supersedes count, requests, minutes, and the spot-check result.
  - **Tests:** none new. `npm run check` passes.
  - **Verify:** with the MCP server: `MATCH (d:Decision)-[:AFFECTS]->(c:Component) RETURN c.path, count(d) ORDER BY count(d) DESC LIMIT 10`.
  - **Out of scope:** prompt changes beyond fixing a clear failure (note any change).
    Note: 300 candidate threads all cached (58 with decisions); 74 decisions loaded (77 `AFFECTS`, 88 `MADE`), 0 superseding and 0 `SUPERSEDES` edges (the model never linked an earlier decision; not faked). 60 requests (one per batch of 5), 6.4 minutes, no prompt changes. Spot-check of 10 evenly spaced decisions: 8 real (issue-2225-1, issue-3242-1, pr-1374-1, pr-1843-1, pr-2092-1, pr-2392-2, pr-2622-1, pr-2764-1); pr-2261-1 is a factual reply to a bot suggestion and pr-3312-1 is a bug fix. The FalkorDB MCP server failed to connect this session, so the verify query ran read-only through `db.read` in a scratchpad script: top components `tests/flow` 17, `graph/src/runtime` 10, `src` 7, `.github/workflows` 6.

## Phase 5: Agent and handover plan (F6, F7)

- [x] **5.1 Shared tools**
  - **Goal:** The eight graph tools, defined once for the agent and the MCP server, each returning data, sources and a graph path.
  - **Files:** create `backend/src/tools.ts`, `backend/src/tools.test.ts`; modify `backend/src/schemas.ts`.
  - **Spec:**
    - `schemas.ts`: add `NodeKindSchema`, `GraphPathSchema` and `export type ToolResult = { data: unknown; sources: Source[]; path: GraphPath }`.
    - `tools.ts`:
      ```ts
      export type Tool = {
        name: string;
        description: string;
        input: z.ZodObject;
        run(db: Db, args: unknown): Promise<ToolResult>;
      };
      function defineTool<S extends z.ZodObject>(
        name: string,
        description: string,
        input: S,
        run: (db: Db, args: z.infer<S>) => Promise<ToolResult>,
      ): Tool;
      export const tools: Tool[];
      ```
      `defineTool` returns `{ name, description, input, run: (db, args) => run(db, input.parse(args)) }`. Tools, descriptions and inputs exactly as ARCH §10, in that order; strings have `.min(1).max(200)`.
    - `data` per ARCH §10. Not found → `{ data: { error: "not_found" }, sources: [], path: { nodes: [], links: [] } }`.
    - Paths (node ids per ARCH §8; labels: person → name, component → path, decision → summary cut to 60 characters, pr → `PR #n`, issue → `Issue #n`, doc → title):
      - `search`: hit nodes, no links. `who_knows`: components and their experts, links expert → component `KNOWS_ABOUT`. `bus_factor`: component nodes. `get_component`: component, experts (`KNOWS_ABOUT`), decisions (`AFFECTS`, decision → component), docs (`DESCRIBES`). `get_person`: person, components (`KNOWS_ABOUT`), decisions (`MADE`). `simulate_departure`: person, affected components (`KNOWS_ABOUT`), successors (`KNOWS_ABOUT`, successor → component), decisions losing owner (`MADE`). `team_ranking`: the top 15 people. `decision_history`: component, decisions (`AFFECTS`) and `SUPERSEDES` links between them.
    - Sources: `search` → hits; `who_knows` → its sources; `get_component` → decisions (summary, sourceUrl), docs (title, url), PRs (`PR #n: title`, url); `get_person` and `simulate_departure` → decisions and open work (`PR #n: title` / `Issue #n: title`); `decision_history` → decisions; others → `[]`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Exactly the eight tools of ARCH §10, in order, with the exact descriptions.
    2. Every tool runs on the fixture and returns schema-valid paths.
    3. Invalid arguments throw a `ZodError`; unknown entities return `not_found`.
  - **Tests:** `tools.test.ts`: (a) names in order; (b) `simulate_departure` for alice: sources include the URLs of PR 8, issue 12 and PR 3 (decision `pr-3-1`); path contains `person:alice`, `component:src/db` and a link `person:alice` → `component:src/db` of type `KNOWS_ABOUT`; (c) every tool's result passes `GraphPathSchema` for valid fixture input (`search` "pagination", `who_knows` "pagination", `get_component` "src/api", `get_person` "alice", `decision_history` "src/api"); (d) `get_component` with `{ path: "nope" }` → `not_found`; (e) `simulate_departure` with `{}` throws.
  - **Verify:** `npm run check`.
  - **Out of scope:** the agent loop, MCP.
    Note: `defineTool`'s `run` follows the spec literally (not `async`), so invalid arguments throw a `ZodError` synchronously from `run` rather than returning a rejected promise; callers should wrap the call itself in `try`. `decision_history` uses `getComponent` to detect unknown components and reuses its `decisions`.

- [x] **5.2 Chat agent and `POST /api/ask`**
  - **Goal:** A tool-calling agent that answers only from tool results and returns sources and the graph path.
  - **Files:** create `backend/src/agent.ts`, `backend/src/agent.test.ts`; modify `backend/src/schemas.ts`, `backend/src/app.ts`, `backend/src/app.test.ts`, `backend/src/server.ts`.
  - **Spec:**
    - Schemas `ChatTurnSchema`, `AskRequestSchema`, `AskResponseSchema`.
    - `agent.ts`: `export const MAX_TOOL_STEPS = 4;` and `export async function askAgent(input: { db: Db; llm: Llm; question: string; history: ChatTurn[] }): Promise<AskResponse>`. System message exactly:
      > You are Tribal. You answer questions about one GitHub repository: its people, code components, decisions and knowledge risk. Use the tools to look things up before answering. Only state facts that appear in tool results. If the tools return nothing relevant, say you don't know. Person ids are GitHub logins. Don't include URLs; sources are shown separately. Answer in plain text in at most 150 words.
    - Loop: messages = system, history, user question. Up to `MAX_TOOL_STEPS` times: `llm.chat(messages, toolDefs)` with `toolDefs = tools.map((t) => ({ name: t.name, description: t.description, parameters: toJsonSchema(t.input) }))`. No tool calls → the content is the answer. Otherwise append the assistant message with its tool calls, then for each call append a `tool` message: unknown name → `{"error":"unknown_tool"}`; `JSON.parse` or `ZodError` failure → `{"error":"invalid_arguments"}`; else `JSON.stringify(result.data)` cut to 8,000 characters, and collect its sources and path. If the steps run out, one more `llm.chat([...messages, { role: "user", content: "Answer now using only the tool results above." }], [])`.
    - Output: `sources` deduplicated by URL (first title wins, at most 12); `path` nodes deduplicated by id and links by source, type and target; `toolCalls` = called tool names in order. `RateLimitError` propagates.
    - `AppDeps` gains `llm: Llm | null`; `server.ts` passes `createLlm(env)`. Route `POST /api/ask` with `zValidator("json", AskRequestSchema)`: `llm` null → 503 `{ error: "llm_unavailable", message: "The assistant is not configured." }`; `RateLimitError` → 429 `{ error: "rate_limited", message: "Rate limit reached, try again in a minute." }`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. With a scripted fake LLM that calls `simulate_departure` for alice and then answers, the response has the answer, the tool's sources and path, and `toolCalls` `["simulate_departure"]`.
    2. Bad tool names or arguments don't crash the loop.
    3. The loop stops after `MAX_TOOL_STEPS` and forces a final answer.
    4. 429 and 503 responses as specified.
  - **Tests:** `agent.test.ts` (fixture graph, fake `Llm`): criteria 1–3 (for 3: a fake that always returns a tool call → exactly 5 `chat` calls, the last with `[]` tools). `app.test.ts`: `/api/ask` with `llm: null` → 503; with a fake that throws `RateLimitError` → 429; `{ question: "" }` → 400.
  - **Verify:** with the backend running on the demo graph and a real key: `curl -X POST localhost:3000/api/ask -H 'content-type: application/json' -d '{"question":"Who knows the query planner best?","history":[]}'` returns an answer with sources. Record the answer quality in a `Note:`.
  - **Out of scope:** UI.
    Note: Gemini 3 rejects a follow-up turn with tool calls unless each call's `extra_content.google.thought_signature` is sent back, so `LlmToolCall` gained an optional `thoughtSignature` that `llm.ts` reads (zod) and echoes on assistant tool calls (user-approved deviation from ARCH §8; new `llm.test.ts` case). `toolCalls` lists every requested name, including unknown ones.
    Note: Live verify (port 3001, as 3000 was taken by another process): "Who knows the query planner best?" took all 4 steps (`who_knows`, `search`, `who_knows`, `search`) and answered AviAvni, DvirDukhan, Roi Lipman and Guy Korland, with 12 sources and a 36-node path. The names are plausible, but the sources are loosely related search hits (e.g. quickjs config, Cypher comments PRs).

- [x] **5.3 Handover plan**
  - **Goal:** Turn a departure report into a handover plan (deterministic structure, optional LLM narrative, cached), rendered as markdown and GitHub issue text, plus `POST /api/handover` and the `handovers` command.
  - **Files:** create `backend/src/handover.ts`, `backend/src/handover.test.ts`, `data/handovers.json` (generated); modify `backend/src/schemas.ts`, `backend/src/app.ts`, `backend/src/app.test.ts`, `backend/src/cli.ts`.
  - **Spec:**
    - Schemas `HandoverPlanSchema`, `HandoverResponseSchema` (ARCH §8).
    - `handover.ts`:
      ```ts
      export function buildHandoverPlan(report: DepartureReport): HandoverPlan;
      export async function narrateHandover(
        llm: Llm,
        plan: HandoverPlan,
      ): Promise<{ summary: string; pairingReasons: string[] }>;
      export function renderHandoverMarkdown(plan: HandoverPlan): string;
      export function renderHandoverIssue(plan: HandoverPlan): {
        title: string;
        body: string;
      };
      export function reportHash(report: DepartureReport): string;
      export async function getHandover(input: {
        report: DepartureReport;
        llm: Llm | null;
        cache: HandoverCache;
        saveCache?: (cache: HandoverCache) => Promise<void>;
      }): Promise<HandoverResponse>;
      ```
    - `buildHandoverPlan`: `knowledgeToDocument` = affected components with `busFactorAfter <= 1`, reason `Bus factor drops from <before> to <after>.`; `pairings` = for those components with a successor, `with` = first successor, reason `<with.name> has the highest remaining expertise on <path>.`; `decisionsNeedingOwner` = every `decisionsLosingOwner`, suggested owner = first successor of the first of its `affects` that is an affected component with successors, else the first nearby collaborator, else `null`; `workToReassign` = every open work item, suggested owner = first nearby collaborator or `null`; `summary` = `<name> is an expert on <n> component(s). After they leave, <o> would have no expert and <c> would have one. <d> decision(s) would lose their only owner and <w> open item(s) need a new owner.`
    - `narrateHandover`: `llm.json` with schema `z.object({ summary: z.string(), pairingReasons: z.array(z.string()) })`, system message "You write short, factual handover plans for engineering teams. Use only facts in the plan JSON. Write a summary of 2 to 4 sentences and one short reason per pairing, in the same order as the pairings.", user message `JSON.stringify(plan)`. If `pairingReasons.length !== plan.pairings.length`, keep the template reasons.
    - `renderHandoverMarkdown`: exactly
      ```
      # Handover plan: <name>

      <summary>

      ## Knowledge to document

      - `<path>`: <reason>

      ## Pair up

      - `<path>`: pair with <with.name> (<with.login ?? with.id>). <reason>

      ## Decisions that need a new owner

      - [<summary>](<sourceUrl>): suggested owner <owner.name or "nobody found">

      ## Open work to reassign

      - [PR #<n>: <title>](<url>): suggested owner <owner.name or "nobody found">
      ```
      (issues use `Issue #<n>`); an empty section has the single line `- Nothing to do.`; lines joined with `\n`, ending with one `\n`.
    - `renderHandoverIssue`: title `Handover plan for <name>`; body = the markdown without its first line and the blank line after it, with every line starting `- ` changed to start `- [ ] ` (except `- Nothing to do.`).
    - `reportHash` = first 16 hex of SHA-256 of `JSON.stringify(report)`.
    - `getHandover`: plan = `buildHandoverPlan`; cache entry with the same `personId` and `reportHash` → apply its summary and reasons, `generatedBy: "cache"`; else if `llm` → `narrateHandover`, apply, call `saveCache` with the entry added (replacing that person's old entry) if given, `generatedBy: "llm"`; any error (including `RateLimitError`) or no `llm` → template plan, `generatedBy: "template"`. Returns plan, markdown and issue title/body.
    - Route `POST /api/handover` (`PersonIdRequestSchema`): `simulateDeparture` (404 if null), cache = `readJsonFileOr(DATA_FILES.handovers, HandoverCacheSchema, { entries: [] })`, `getHandover` without `saveCache` (the deployed file system is read-only in practice).
    - CLI `handovers`: requires an LLM; takes the top 5 people of `getTeamRanking`, runs `getHandover` for each with `saveCache` writing `DATA_FILES.handovers`, and prints each person and `generatedBy`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. The template plan for alice: `knowledgeToDocument` `src/db`, `docs`, `src/api`; pairings bob, erin, bob; decision `pr-3-1` → bob; open work PR 8 and issue 12 → carol.
    2. Markdown and issue text follow the templates exactly.
    3. Cache hit → no LLM call; LLM error → template.
    4. `data/handovers.json` holds 5 cached plans for the demo, and the route never calls the LLM for them.
  - **Tests:** `handover.test.ts` (fixture report for alice from `simulateDeparture`, fake `Llm`): (a) criterion 1; (b) `renderHandoverMarkdown` equals the full expected string for alice (written out in the test); (c) the issue body's first line is `<summary>` and contains `- [ ] \`src/db\``; (d) cache hit → fake not called, `generatedBy` `cache`; (e) fake throws → `template`; (f) fake returns 2 reasons for 3 pairings → template reasons kept, LLM summary used. `app.test.ts`: `/api/handover`alice → 200 with`generatedBy` `template` (`llm: null`); `nobody` → 404.
  - **Verify:** `npm --workspace backend run cli -- handovers` on the demo graph (live LLM, 5 requests); then `POST /api/handover` for one of them returns `generatedBy` `cache`.
  - **Out of scope:** UI, posting to GitHub (never).
    Note: The live `handovers` run cached LLM plans for swilly22, AviAvni, GomezGab, gkorland and DvirDukhan (5 requests). Running `POST /api/handover` through `createApp` with `llm: null` returned `generatedBy` `cache` for all five. The LLM schema name is `handover_narrative`. `handover.test.ts` has its own fake `Llm`, close to the one in `decisions.test.ts`. They were not merged because that needs a shared test helper, and CLAUDE.md says to ask first.
