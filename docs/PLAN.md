# Plan

Every task follows `docs/ARCHITECTURE.md` (called ARCH below; "ARCH §7" means its section 7). Query names refer to the query catalogue in ARCH §7; copy their Cypher exactly.

Graph tests use `withFixtureGraph()` (task 2.2) on the FalkorDB instance in `.env` (CI: the service container).

## Schedule

Planning started Friday 16 October, 17:50 IST. Submission target: **Sunday 18 October, 18:00 IST**. Sessions assume about 45 minutes each, including `/commit` and `/clear`.

| Phase                          | Tasks   | Sessions | Target finish (IST)               |
| ------------------------------ | ------- | -------- | --------------------------------- |
| 0 Plan the product             | 0.1     | 1        | Fri 19:00                         |
| 1 Foundation                   | 1.1–1.4 | 4        | Fri 22:30                         |
| 2 Ingestion and graph loading  | 2.1–2.5 | 5        | Sat 10:30 (sleep Fri 01:00–08:00) |
| 3 Expertise and knowledge risk | 3.1–3.5 | 5        | Sat 14:30                         |
| 4 Decisions                    | 4.1–4.3 | 3        | Sat 17:00                         |
| 5 Agent and handover plan      | 5.1–5.3 | 3        | Sat 19:45                         |
| 6 MCP server                   | 6.1     | 1        | Sat 20:30                         |
| 7 Web UI (core screens)        | 7.1–7.5 | 5        | Sun 08:30 (sleep Sat 01:00–07:00) |
| 8 Deployment                   | 8.1–8.4 | 4        | Sun 11:30                         |
| 7.6 UI polish                  | 7.6     | 1        | Sun 12:15                         |
| 9 Submission                   | 9.1–9.7 | 7        | **Sun 18:00**                     |
| 10 Stretch                     | S1–S3   | 3        | only if ahead                     |

- **Deployment comes before UI polish.** Task 7.6 (polish and accessibility pass) runs after Phase 8, because a live deployment is required for the submission and polish isn't. This is the only reordering.
- **Cuts if behind schedule**, in this order: all stretch items (S1, S2, S3); task 7.6 reduced to keyboard and contrast fixes only; the blog draft (9.6) shortened to the required sections; the demo video kept to 2 minutes. F1–F9 are never cut.
- If a session overruns by more than 30 minutes, finish the current task and re-plan the remaining times rather than starting two tasks in one session.

## Manual steps (all of them)

Done now, during Phase 0: WeMakeDevs registration, Google AI Studio key, FalkorDB Cloud instance, Render account, GitHub repo approval. Later, as `[MANUAL]` tasks placed just before the task that needs them: 8.3 connect Render to the repo, 9.3 record the screen captures and screenshot, 9.5 upload the video, 9.7 submit on WeMakeDevs. Pushing to GitHub is always done by you (`git push`), never by the agent.

## Phase 0: Plan the product

- [x] **0.1** Write `docs/PROJECT.md`, `docs/ARCHITECTURE.md` and the full phased plan in this file, following `docs/BRIEF.md` section "Instructions for Phase 0".
      Note: FalkorDBLite 0.3.0 does not run on this Windows machine ("Unsupported platform: win32-x64"; it supports only linux-x64 and darwin-arm64, and WSL and Docker are not installed), so development must use FalkorDB Cloud's free tier instead. Tests that need a graph must account for this.
      Note: Phase 1 must provide a local dev graph on a TCP port (`FALKORDB_DEV_PORT`, default 6390) for the FalkorDB MCP server in `.mcp.json`, or point that server at the dev graph on FalkorDB Cloud. The MCP server has not yet been tested against a running graph.
      Note: User decisions (2026-10-17): FalkorDB Cloud for dev and tests, `falkordb/falkordb` service container in CI, FalkorDBLite dropped; emails stored only as hashes; demo repo FalkorDB/FalkorDB; ARCH deviations from the brief accepted (epoch-ms timestamps, log2, derived decision status, `handovers` command, `FALKORDB_HOST`/`PORT`/`USERNAME`/`PASSWORD`). Repo `ssaarthakk/tribal` created and set as `origin` (not pushed).
      Note: Still open: `FALKORDB_HOST`, `FALKORDB_PORT` and `FALKORDB_USERNAME` are not yet in `.env` (needed before task 1.2); `wrangler` 4.147.0 is installed globally and logged in; GitHub token comes from `gh auth token`.

## Phase 1: Foundation

- [ ] **1.1 Environment config**
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

- [ ] **1.2 Database connection, CI graph and the FalkorDB MCP dev graph**
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

- [ ] **1.3 Data file schemas and the fixture**
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

- [ ] **1.4 Health route, server, CLI skeleton and the typed web client**
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

- [ ] **2.1 Components and identity merging**
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

- [ ] **2.2 Graph loader**
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

- [ ] **2.3 GitHub source**
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

- [ ] **2.4 Build the snapshot and the `fetch` command**
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

- [ ] **2.5 Fetch and load the demo repo**
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

## Phase 3: Expertise and knowledge risk (F3, F4)

- [ ] **3.1 Expertise scores, experts and bus factor**
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

- [ ] **3.2 Collaboration graph and team ranking**
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

- [ ] **3.3 Departure simulation**
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

- [ ] **3.4 Read models and routes: risk map, ranking, component, person**
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

- [ ] **3.5 Full-text search and "who knows about X"**
  - **Goal:** Find PRs, issues, decisions and docs by keywords, and the people who know the matching components.
  - **Files:** create `backend/src/search.ts`, `backend/src/search.test.ts`; modify `backend/src/queries.ts`, `backend/src/schemas.ts`.
  - **Spec:** add `SEARCH_ALL` and `TOPIC_COMPONENTS` (ARCH §7, including the fallback rule for `SEARCH_ALL`). Schemas `SearchHitSchema`, `SourceSchema`, `TopicComponentSchema`, `WhoKnowsSchema`, `ExpertiseSchema`. `search.ts` exactly as ARCH §8. `search` and `whoKnows` return empty results without querying when `toFullTextQuery` is empty.
  - **Dependencies:** none.
  - **Acceptance criteria:** the three search expectations in ARCH §12 hold; `toFullTextQuery("a an -- @#")` = `""`; user text with RediSearch special characters never causes a query error.
  - **Tests:** `search.test.ts`: ARCH §12 search expectations; `search(db, 'pagination" OR 1=1 -- @title:{x}')` resolves (no throw); `toFullTextQuery` cases: duplicates removed, words under 3 characters dropped, lowercased.
  - **Verify:** throwaway script: `whoKnows(db, "query planner")` on the demo graph returns components under `graph/src/planner` or `src/execution_plan`; record the top result in a `Note:`.
  - **Out of scope:** the agent.

## Phase 4: Decisions (F5)

- [ ] **4.1 LLM module**
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

- [ ] **4.2 Decision extraction**
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

- [ ] **4.3 Extract decisions for the demo repo**
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

## Phase 5: Agent and handover plan (F6, F7)

- [ ] **5.1 Shared tools**
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

- [ ] **5.2 Chat agent and `POST /api/ask`**
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

- [ ] **5.3 Handover plan**
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

## Phase 6: MCP server (F8)

- [ ] **6.1 MCP server**
  - **Goal:** Expose the same eight tools over MCP (stdio) and document setup for Claude Desktop and Cursor.
  - **Files:** create `backend/src/mcp.ts`, `backend/src/mcp.test.ts`; modify `backend/src/cli.ts`, `README.md`.
  - **Spec:**
    - Check the `@modelcontextprotocol/sdk` 1.31.0 docs for `McpServer.registerTool`, `StdioServerTransport`, `Client` and `InMemoryTransport` before coding.
    - `export function createMcpServer(db: Db): McpServer` registers every tool from `tools.ts` with `{ description: tool.description, inputSchema: tool.input.shape }` and a handler returning `{ content: [{ type: "text", text: JSON.stringify(await tool.run(db, args)) }] }`. Server name `tribal`, version `0.1.0`.
    - `export async function startMcpServer(env: Env): Promise<void>` opens the db for `FALKORDB_GRAPH` and connects a `StdioServerTransport`. Nothing may be written to stdout except protocol messages; logs go to stderr.
    - CLI `mcp` → `startMcpServer(loadEnv())`.
    - README section "MCP server": build with `npm --workspace backend run build`; config snippet for Claude Desktop (`claude_desktop_config.json`) and Cursor (`.cursor/mcp.json`):
      ```json
      {
        "mcpServers": {
          "tribal": {
            "command": "node",
            "args": [
              "--env-file=/absolute/path/to/tribal/.env",
              "/absolute/path/to/tribal/backend/dist/cli.js",
              "mcp"
            ]
          }
        }
      }
      ```
      plus one line on running FalkorDB's official MCP server alongside for ad-hoc Cypher.
  - **Dependencies:** `@modelcontextprotocol/sdk` 1.31.0 (backend).
  - **Acceptance criteria:**
    1. An MCP client lists exactly the eight tools with their descriptions.
    2. Calling `bus_factor` over MCP on the fixture returns the six components.
    3. The README snippet works in Claude Code (`claude mcp add` equivalent) or Claude Desktop.
  - **Tests:** `mcp.test.ts`: link a `Client` and `createMcpServer(db)` with `InMemoryTransport.createLinkedPair()`; (a) `listTools` names equal the `tools` names; (b) `callTool({ name: "bus_factor", arguments: {} })` text parses to an object whose `data` has 6 entries; (c) `callTool` for `simulate_departure` with `{ personId: "alice" }` has `data.orphaned` `["src/db"]`.
  - **Verify:** build, then add the server to Claude Code with `claude mcp add tribal -- node --env-file=<repo>/.env <repo>/backend/dist/cli.js mcp` in a scratch session or ask the user to try it in Claude Desktop, and call `team_ranking`.
  - **Out of scope:** HTTP transport, auth.

## Phase 7: Web UI (F9)

All screens: Tailwind only, no new UI libraries, labels on every control, `focus-visible:ring-2` on interactive elements, risk shown as text and colour. Use `InferResponseType` from `hono/client` for response types, or `import type` from `backend/src/schemas.ts` (ARCH §6 allows type-only imports from `app.ts` and `schemas.ts`).

- [ ] **7.1 App shell, graph view and Risk Map**
  - **Goal:** Navigation between the three screens and the Risk Map graph with a components table.
  - **Files:** create `web/src/colors.ts`, `web/src/components/GraphView.tsx`, `web/src/components/RiskBadge.tsx`, `web/src/screens/RiskMapScreen.tsx`, `web/src/screens/SimulationScreen.tsx` and `web/src/screens/AskScreen.tsx` (each a heading "Coming in task 7.x" placeholder until its task); modify `web/src/App.tsx`, `web/package.json`.
  - **Spec:**
    - `App.tsx`: header "Tribal" with subtitle "Knowledge risk for FalkorDB/FalkorDB", `<nav aria-label="Screens">` with links `#risk` "Risk map", `#simulate` "Departure simulation", `#ask` "Ask" (`aria-current="page"` on the active one); current screen from `location.hash` with a `hashchange` listener (default `#risk`). The health status line from 1.4 moves to the footer.
    - `colors.ts`: the ARCH §11 colours as `RISK_COLORS: Record<RiskLevel, string>` and `KIND_COLORS`, plus `HIGHLIGHT` and `DIMMED`.
    - `GraphView.tsx`: props `{ nodes: { id: string; label: string; color: string; size: number }[]; links: { source: string; target: string }[]; highlighted?: ReadonlySet<string>; dimmed?: ReadonlySet<string>; onNodeClick?: (id: string) => void; label: string }`. Renders `ForceGraph2D` inside a `div` with `role="img"` and `aria-label={label}`; width from a `ResizeObserver` on the container; `nodeCanvasObject` draws a circle (dimmed colour if in `dimmed`, a 2px `HIGHLIGHT` ring if in `highlighted`) and the label below it when zoomed in (`globalScale > 1.5`) or highlighted; `cooldownTicks={100}`.
    - `RiskBadge.tsx`: `{ level: RiskLevel }` → a pill with the level's text (`orphaned`, `critical`, `at risk`, `healthy`), white text on the risk colour.
    - `RiskMapScreen.tsx`: loads `/api/risk-map` and `/api/ranking`. Left: `GraphView` (components sized `6 + busFactor * 2` and coloured by risk; people size 4, person colour), label "Graph of people and the components they know, coloured by bus factor". A legend listing the four risk levels. Right: table "Components by risk" (path, bus factor, `RiskBadge`, a "Details" button), sorted riskiest first; table "Team ranking" (top 15: name, PageRank to 3 decimals, betweenness to 1 decimal). Clicking a component node or a "Details" button sets `selectedPath` (the panel itself comes in 7.2; for now show the selected path as text). Loading and error states as text.
  - **Dependencies:** `react-force-graph-2d` 1.29.2 (web).
  - **Acceptance criteria:**
    1. The three screens are reachable by keyboard and by URL hash.
    2. The Risk Map shows the demo graph and both tables.
    3. Selecting a component by click or keyboard sets the selection.
  - **Tests:** none (no web test setup); `npm run check` (includes the web build).
  - **Verify:** run the backend on the demo graph and `npm --workspace web run dev`; screenshot `#risk` with the `run` skill and check it.
  - **Out of scope:** component details, other screens.

- [ ] **7.2 Component details panel**
  - **Goal:** Show who knows a component, its decisions, docs and recent PRs.
  - **Files:** create `web/src/components/ComponentPanel.tsx`, `web/src/components/SourcesList.tsx`; modify `web/src/screens/RiskMapScreen.tsx`.
  - **Spec:** `ComponentPanel` `{ path: string; onClose: () => void }` loads `/api/component?path=`. Shows: heading with path and `RiskBadge`; "Experts" list (name, login, share as %, last active date, "expert" tag); "Decisions" list (summary, status tag, decided date, "made by" names, link "Source" to `sourceUrl` with `target="_blank" rel="noopener noreferrer"`, "supersedes …" text when present); "Docs" and "Recent pull requests" as `SourcesList`. `SourcesList` `{ sources: { title: string; url: string }[]; heading: string }` → heading + list of external links (new tab, `rel="noopener noreferrer"`), "None" when empty. In `RiskMapScreen`, the selected component opens the panel beside the tables and highlights the component and its experts in the graph; "Close" button returns focus to the "Details" button that opened it.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Selecting a component shows its details from the API.
    2. All external links open in a new tab with `rel="noopener noreferrer"`.
    3. The panel is usable by keyboard and focus returns on close.
  - **Tests:** none; `npm run check`.
  - **Verify:** screenshot with a component selected.
  - **Out of scope:** other screens.

- [ ] **7.3 Departure Simulation screen**
  - **Goal:** Pick a person, simulate their departure, and see the before/after.
  - **Files:** modify `web/src/screens/SimulationScreen.tsx`.
  - **Spec:** loads `/api/risk-map` for people and components. A `<label>`led `<select>` "Person leaving" (people sorted by name, showing `name (login)`), and a "Simulate departure" button → `POST /api/simulate`. Results: four summary counts (components orphaned, components left with one expert, decisions losing their only owner, open items stranded); table "Affected components" (path, before → after with `RiskBadge` for after, successors as `name (score to 1 decimal)`); "Decisions losing their only owner" (summary with source link); "Open work" (PR/Issue links); "Nearby collaborators" (names with weight). A `GraphView` with a "Before"/"After" radio group: Before = risk-map graph; After = the departing person and their links dimmed, affected components recoloured with `riskAfter` and highlighted.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Simulating the demo's top-ranked person shows non-empty results matching `POST /api/simulate`.
    2. The Before/After toggle changes the graph.
    3. Everything shown in the graph is also in the tables.
  - **Tests:** none; `npm run check`.
  - **Verify:** screenshots of before and after for the top-ranked person.
  - **Out of scope:** handover plan (7.4).

- [ ] **7.4 Handover panel**
  - **Goal:** Show the handover plan and make it easy to export.
  - **Files:** create `web/src/components/HandoverPanel.tsx`; modify `web/src/screens/SimulationScreen.tsx`.
  - **Spec:** below the simulation results, a "Write handover plan" button → `POST /api/handover`. Shows the summary, the four sections as lists, and a small label "Written by the assistant" (`llm`/`cache`) or "Generated from the graph" (`template`). Buttons: "Copy markdown" (`navigator.clipboard.writeText(markdown)`), "Copy issue text" (title, blank line, body). After copying, an `aria-live="polite"` message "Copied". A note: "Tribal never posts to GitHub. Paste the issue text yourself."
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Plans for cached demo people appear immediately with "Written by the assistant".
    2. The copy buttons copy exactly the API's markdown and issue text.
    3. No code path posts to GitHub.
  - **Tests:** none; `npm run check`.
  - **Verify:** screenshot; paste the copied markdown into a scratch file and compare with the API response.
  - **Out of scope:** editing plans.

- [ ] **7.5 Ask screen**
  - **Goal:** Chat with the agent and see the sources and graph path of each answer.
  - **Files:** modify `web/src/screens/AskScreen.tsx`.
  - **Spec:** a form with a `<label>`led `<textarea>` "Question" (max 500 characters) and an "Ask" button; three example-question buttons that fill and submit (start with "Who knows the query planner best?", "What happens if the top-ranked maintainer leaves?" and "Which decisions affect src/commands?", then replace them with three that give good answers on the demo data). The conversation list shows each question and answer; history (last 10 turns) is sent with each request. For the latest answer: `SourcesList` "Sources" and a `GraphView` of its `path` (node colours from `KIND_COLORS`, all nodes labelled), plus the tool names used as small text. 429 → "Rate limit reached, try again in a minute."; 503 → "The assistant is not configured on this server."; while waiting, the button is disabled and an `aria-live` status says "Thinking…".
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. The three example questions give sourced answers on the demo deployment.
    2. The path graph shows the nodes the tools used.
    3. Error states display the specified messages.
  - **Tests:** none; `npm run check`.
  - **Verify:** screenshot after one example question; trigger 503 by running the backend without `LLM_API_KEY` once.
  - **Out of scope:** streaming, markdown rendering.

## Phase 8: Deployment

- [ ] **8.1 Cloudflare Workers check (time-boxed: 30 minutes)**
  - **Goal:** Find out in a real test whether the `falkordb` client can reach FalkorDB Cloud from a Worker.
  - **Files:** none in the repo. Work in the scratchpad directory only.
  - **Spec:** a throwaway Worker (scratchpad folder with its own `package.json` using `falkordb` 6.8.0, `wrangler.toml` with `compatibility_flags = ["nodejs_compat"]` and a recent `compatibility_date`) whose fetch handler connects with `FalkorDB.connect` and returns the result of `RETURN 1`. Secrets are set with `wrangler secret put` by piping values from `.env` through a shell (`set -a; . ./.env; set +a; printf %s "$FALKORDB_PASSWORD" | wrangler secret put FALKORDB_PASSWORD`), never printed. `wrangler deploy`, request it with `curl`, then `wrangler delete` the Worker.
  - **Dependencies:** none (scratchpad only).
  - **Acceptance criteria:**
    1. A `Note:` records pass or fail with the exact error, and the throwaway Worker is deleted.
    2. If it passes, stop and ask the user whether to host the backend on Workers (trade-off: the 15+ MB snapshot can't be bundled for auto-seeding, so seeding stays a CLI step) or on Render as planned. If it fails, continue with Render.
  - **Tests:** none.
  - **Verify:** `wrangler deployments list` shows no leftover Worker.
  - **Out of scope:** changing the backend.

- [ ] **8.2 Backend ready for Render**
  - **Goal:** Make the backend deployable on Render's free tier and keep it and FalkorDB Cloud awake.
  - **Files:** create `render.yaml`, `.github/workflows/keepalive.yml`, `backend/src/server.test.ts`; modify `backend/src/server.ts`.
  - **Spec:**
    - `server.ts`: `export async function ensureSeeded(db: Db, snapshotPath: string, decisionsPath: string): Promise<boolean>`: if `countNodes(db)` is 0, read both files and `loadSnapshot`, return `true`; else `false`. `startServer` calls it with `DATA_FILES.snapshot` and `DATA_FILES.decisions` before listening, and logs whether it seeded.
    - `render.yaml`:
      ```yaml
      services:
        - type: web
          name: tribal-backend
          runtime: node
          plan: free
          region: singapore
          buildCommand: npm ci --workspace backend --include-workspace-root && npm --workspace backend run build
          startCommand: npm --workspace backend run start
          healthCheckPath: /api/health
          envVars:
            - key: NODE_VERSION
              value: "24"
            - key: FALKORDB_HOST
              sync: false
            - key: FALKORDB_PORT
              sync: false
            - key: FALKORDB_USERNAME
              sync: false
            - key: FALKORDB_PASSWORD
              sync: false
            - key: LLM_API_KEY
              sync: false
            - key: WEB_ORIGIN
              sync: false
      ```
      (choose the Render region closest to the FalkorDB Cloud region; Singapore if the instance is in Asia).
    - `keepalive.yml`: `on: schedule: - cron: "*/10 * * * *"` and `workflow_dispatch`; `permissions: {}`; one job on `ubuntu-latest` that runs `curl -fsS --max-time 120 "${{ vars.BACKEND_URL }}/api/health"` and skips (exits 0 with a message) when `vars.BACKEND_URL` is empty.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. On an empty graph the server seeds itself; on a loaded graph it doesn't.
    2. `npm ci --workspace backend --include-workspace-root && npm --workspace backend run build` succeeds locally and `node --env-file=.env backend/dist/cli.js serve` serves `/api/health`.
    3. The keepalive workflow is valid and harmless without `BACKEND_URL`.
  - **Tests:** `server.test.ts`: `ensureSeeded` on a fresh `tribal_test_` graph with the fixture paths → `true` and 75 nodes; again → `false`.
  - **Verify:** the build-and-start command from criterion 2.
  - **Out of scope:** the Render dashboard (8.3).

- [ ] **8.3 [MANUAL] Deploy the backend on Render**
  - **Goal:** The backend runs on Render, connected to FalkorDB Cloud.
  - **Steps for the user:**
    1. Run `/commit`, then `git push -u origin main` yourself.
    2. In the Render dashboard: **New → Blueprint**, pick the `tribal` repo, and confirm `render.yaml`.
    3. Fill in the secret env vars with the same values as your `.env`: `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME`, `FALKORDB_PASSWORD`, `LLM_API_KEY`. Set `WEB_ORIGIN` to `https://tribal.pages.dev` for now (updated in 8.4).
    4. Click **Apply** and wait for the deploy to finish (about 5 minutes). Open `https://<service>.onrender.com/api/health` and check it shows `"ok":true` with a node count above 0.
    5. In GitHub: repo **Settings → Secrets and variables → Actions → Variables → New repository variable**: `BACKEND_URL` = `https://<service>.onrender.com` (no trailing slash). Then **Actions → Keep alive → Run workflow** once and check it's green.
    6. Tell me the backend URL.
  - **Agent checks:** `curl -fsS <url>/api/health` and `curl -X POST <url>/api/simulate …` for the top-ranked person; add the URL as a `Note:`.

- [ ] **8.4 Deploy the web app to Cloudflare Pages**
  - **Goal:** The web app is live on Cloudflare Pages and talks to the Render backend.
  - **Files:** create `scripts/deploy-web.sh`; modify `README.md` (live URLs).
  - **Spec:** `scripts/deploy-web.sh` (executable):
    ```bash
    #!/usr/bin/env bash
    set -eu
    cd "$(dirname "$0")/.."
    : "${BACKEND_URL:?Set BACKEND_URL to the deployed backend URL}"
    VITE_API_URL="$BACKEND_URL" npm --workspace web run build
    wrangler pages deploy web/dist --project-name tribal --branch main
    ```
    First time only: `wrangler pages project create tribal --production-branch main`. Then `BACKEND_URL=<url> bash scripts/deploy-web.sh`. If the Pages URL isn't `https://tribal.pages.dev`, stop and ask the user to set `WEB_ORIGIN` on Render to the real URL and redeploy there.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. The Pages URL loads, the footer shows "Backend connected" with the demo node count.
    2. Risk Map, a departure simulation, a cached handover plan and one Ask question all work on the live site.
    3. README lists the frontend and backend URLs.
  - **Tests:** none; `npm run check`.
  - **Verify:** open the live site with the browser tools; check the four flows in criterion 2 and look at the console for CORS errors.
  - **Out of scope:** custom domains.

## Phase 7 (continued): polish after deployment

- [ ] **7.6 UI polish and accessibility pass**
  - **Goal:** Make the three screens demo-ready and accessible.
  - **Files:** modify files under `web/src/` only.
  - **Spec:** keyboard-only pass through every screen (logical tab order, visible focus, no traps); check colour contrast of text and badges (WCAG AA 4.5:1); loading, empty and error states on every API call; layout works at 1280×720 (recording size) and 390 px wide; page `<title>` per screen ("Risk map · Tribal" etc.); remove placeholder text. Redeploy with `scripts/deploy-web.sh`.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Each screen can be fully used with the keyboard.
    2. No text below 4.5:1 contrast.
    3. Live site updated.
  - **Tests:** none; `npm run check`.
  - **Verify:** screenshots of each screen at 1280×720 on the live site.
  - **Out of scope:** new features.

## Phase 9: Submission

- [ ] **9.1 README**
  - **Goal:** A README that meets every hackathon requirement.
  - **Files:** modify `README.md`.
  - **Spec:** sections, in order: what it is and the track (Company Brain); screenshot (`docs/screenshot.png`, added in 9.3; reference it now); live demo links; how it works (short); graph data model (Mermaid `graph LR` of all node labels and relationship types from ARCH §2, plus a table of node and relationship types with one-line meanings); **"Cypher queries and graph algorithms"**: one bullet per exported constant in `backend/src/queries.ts` (name, one-line explanation, feature IDs), plus each FalkorDB procedure used (`algo.pageRank`, `algo.betweenness`, `db.idx.fulltext.createNodeIndex`, `db.idx.fulltext.queryNodes`) and why; scoring and risk definitions (short, from ARCH §4); local setup from zero (Node 24, `npm install`, `.env` from `.env.example`, FalkorDB Cloud free tier or `docker run -p 6379:6379 falkordb/falkordb`, `cli -- load --fixture` or `cli -- load`, `npm --workspace backend run dev`, `npm --workspace web run dev`); pointing it at another repo (edit `data/config.json`, `fetch`, `extract-decisions`, `load`); MCP server (from 6.1); architecture overview (the diagram from ARCH §1 and the module list); tests (`npm run check`); "Built with AI assistance" (Claude Code; the graph model, queries and architecture are documented here and explained by the author); licence MIT; data note (public repo data, emails stored only as hashes).
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Every exported constant in `queries.ts` is named in the README.
    2. Every required item in BRIEF §1 rule 6 and §7.2 is present.
    3. The Mermaid diagram renders on GitHub (check its syntax).
  - **Tests:** none; `npm run check`.
  - **Verify:** for every `export const` name in `backend/src/queries.ts`, `grep` finds it in `README.md`; preview the Mermaid block.
  - **Out of scope:** blog, video.

- [ ] **9.2 Demo script and Remotion project**
  - **Goal:** A scene-by-scene demo script and a Remotion composition that assembles the recordings with title cards and captions.
  - **Files:** create `video/package.json`, `video/tsconfig.json`, `video/src/index.ts`, `video/src/Root.tsx`, `video/src/Demo.tsx`, `video/src/scenes.ts`; modify root `package.json` (workspace `video`), root `tsconfig.json` (reference `./video`), `.gitignore` (`video/public/recordings/`, `video/out/`), `vitest.config.ts` only if needed.
  - **Spec:**
    - `scenes.ts` is the demo script and the single source for the video: `export const scenes: Scene[]` with `type Scene = { id: string; kind: "title" | "recording"; title: string; show: string; caption: string; seconds: number; file?: string }`, where `show` is what to record and `caption` is the exact narration (also shown in the video). Total 150–170 seconds:
      1. Title card "Tribal: what breaks when someone leaves?" (5 s).
      2. Title card: the problem in one sentence (8 s).
      3. `01-risk-map.mp4`: Risk Map of FalkorDB/FalkorDB, components coloured by bus factor, team ranking (25 s).
      4. `02-component.mp4`: a critical component's panel: experts, decisions with sources (15 s).
      5. `03-simulation.mp4`: simulate the top-ranked maintainer leaving; before/after; orphaned components; decisions losing their owner; stranded work (40 s).
      6. `04-handover.mp4`: write the handover plan; copy issue text (20 s).
      7. `05-ask.mp4`: ask an example question; answer with sources and the highlighted path (25 s).
      8. `06-mcp.mp4`: the same tools from Claude Desktop or Claude Code over MCP (12 s).
      9. Title card: "FalkorDB does the work": Cypher, PageRank, betweenness, full-text (10 s).
      10. Title card: repo and live URLs, "Company Brain track" (5 s).
    - `Root.tsx`: `<Composition id="Demo" component={Demo} width={1920} height={1080} fps={30} durationInFrames={sum of seconds × 30} />`. `Demo.tsx`: `<Series>` of scenes; title scenes are a centred title on a dark background; recording scenes use `<OffthreadVideo src={staticFile("recordings/" + file)} muted />` with the caption in a bar at the bottom. System font stack only.
    - `video/package.json` scripts: `"studio": "remotion studio src/index.ts"`, `"render": "remotion render src/index.ts Demo out/tribal-demo.mp4"`.
  - **Dependencies:** `remotion` 4.0.532, `@remotion/cli` 4.0.532, `react` 19.3.1, `react-dom` 19.3.1, `@types/react` 19.3.0 (video).
  - **Acceptance criteria:**
    1. `scenes.ts` has the ten scenes above with narration, totalling 150–170 seconds.
    2. `npx remotion compositions src/index.ts` (in `video/`) lists `Demo` with the expected duration.
    3. `npx remotion still src/index.ts Demo out/title.png --frame=30` renders the first title card.
  - **Tests:** none; `npm run check` (lint and types include `video/`).
  - **Verify:** criteria 2 and 3.
  - **Out of scope:** the recordings themselves.

- [ ] **9.3 [MANUAL] Record the screen captures and screenshot**
  - **Steps for the user:**
    1. Open the live site in Chrome at 1920×1080 (or browser zoom so the window is 1920×1080), in a clean profile with no extensions visible.
    2. For each recording scene in `video/src/scenes.ts`, record the screen with the Windows Snipping Tool (**Win+Shift+R**, select the browser window) or OBS, following its `show` text. Keep each clip a few seconds longer than its scene.
    3. Save the clips as MP4 with the exact `file` names from `scenes.ts` into `video/public/recordings/`.
    4. Take one screenshot of the Departure Simulation screen with a result and save it as `docs/screenshot.png`.
    5. For scene 8, record the MCP tools being called from Claude Desktop or Claude Code (config from the README).
    6. Tell me when all files are in place.
  - **Agent checks:** every `file` in `scenes.ts` exists in `video/public/recordings/`; `docs/screenshot.png` exists and the README shows it.

- [ ] **9.4 Render the demo video**
  - **Goal:** A 2–3 minute MP4 assembled from the recordings.
  - **Files:** modify `video/src/scenes.ts` only if clip lengths need adjusting.
  - **Spec:** run `npm --workspace video run render`; watch the result in the Studio (`npm --workspace video run studio`) for caption timing; adjust `seconds` per scene so each caption matches its clip.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. `video/out/tribal-demo.mp4` exists and is between 120 and 180 seconds.
    2. Every scene has its caption; no black frames from missing files.
  - **Tests:** none; `npm run check`.
  - **Verify:** check the duration Remotion prints after rendering.
  - **Out of scope:** music, voice-over (you can record narration over it yourself).

- [ ] **9.5 [MANUAL] Upload the video**
  - **Steps for the user:**
    1. Upload `video/out/tribal-demo.mp4` to YouTube (Public or Unlisted), title "Tribal: knowledge risk in FalkorDB (Graph Hacks, Company Brain)".
    2. Paste the description from the top of `docs/SUBMISSION.md` once 9.6 writes it, or a one-line pitch now.
    3. Tell me the video URL.
  - **Agent checks:** add the video URL to `README.md` (top, under the live links) and to `docs/SUBMISSION.md` if it exists.

- [ ] **9.6 Blog draft and submission text**
  - **Goal:** The blog post draft and paste-ready submission text.
  - **Files:** create `docs/BLOG.md`, `docs/SUBMISSION.md`.
  - **Spec:**
    - `docs/BLOG.md` (1,000–1,500 words): the problem (knowledge leaves with people); why a graph (the questions are about connections); the data model (the Mermaid diagram); how expertise and bus factor are computed in Cypher (one real query from `queries.ts`); the departure simulation with real numbers from the demo; decisions and SUPERSEDES; agent with sources and MCP; what I learned (FalkorDB procedures, free-tier constraints, LLM caching); links.
    - `docs/SUBMISSION.md`: project name "Tribal"; one-line pitch (at most 20 words); description (150–250 words); track "Company Brain"; links: repo, live frontend, backend health URL, video; tech used; AI assistance disclosure. Each field under its own heading, ready to paste.
  - **Dependencies:** none.
  - **Acceptance criteria:**
    1. Every number in the blog matches the live demo.
    2. `SUBMISSION.md` contains every field the WeMakeDevs form needs (name, pitch, description, track, repo, demo URL, video URL).
  - **Tests:** none; `npm run check`.
  - **Verify:** read both files once end to end.
  - **Out of scope:** publishing the blog.

- [ ] **9.7 [MANUAL] Submit on WeMakeDevs**
  - **Steps for the user:**
    1. Run `/commit` and `git push` so the public repo has everything.
    2. Open the Graph Hacks submission page on WeMakeDevs, choose the **Company Brain** track, and paste the fields from `docs/SUBMISSION.md`.
    3. Check every link in the form opens (repo, live site, video).
    4. Submit before **Sunday 18 October, 18:00 IST** (hard deadline 23:59 IST).
    5. Tell me it's submitted.
  - **Agent checks:** the live site and backend health respond; the repo's README renders on GitHub.

## Phase 10: Stretch (only if F1–F9 are deployed and time remains)

- [ ] **S1 Stale-doc alerts**
  - **Goal:** Flag docs whose described component changed a lot after the doc's last update.
  - **Files:** modify `backend/src/queries.ts`, `backend/src/schemas.ts`, `backend/src/risk.ts`, `backend/src/tools.ts`, `backend/src/app.ts`, tests, `web/src/screens/RiskMapScreen.tsx`, `README.md`.
  - **Spec:** query `STALE_DOCS` (params `minLines`):
    ```cypher
    MATCH (d:Doc)-[:DESCRIBES]->(c:Component)<-[:PART_OF]-(:File)<-[m:MODIFIES]-(cm:Commit)
    WHERE cm.authored_at > d.updated_at
    WITH d, c, sum(m.additions + m.deletions) AS linesSince, count(DISTINCT cm) AS commitsSince
    WHERE linesSince >= $minLines
    RETURN d.path AS path, d.title AS title, d.url AS url, d.updated_at AS updatedAt, c.path AS componentPath, linesSince, commitsSince
    ORDER BY linesSince DESC
    ```
    `minLines` 200. `getStaleDocs(db)`, `GET /api/stale-docs`, a ninth tool `stale_docs` ("List docs whose component changed significantly after the doc was last updated."), and a "Stale docs" table on the Risk Map.
  - **Dependencies:** none.
  - **Acceptance criteria:** fixture with `minLines` 0 returns no rows (all fixture docs were updated on the latest date); the demo returns a list; the tool appears over MCP.
  - **Tests:** fixture: `STALE_DOCS` with `minLines: 0` returns `[]`; with a fixture copy where `docs/db.md` `updatedAt` is `2025-01-01`, returns `docs/db.md` for `docs` and `src/db`.
  - **Verify:** live site table.
  - **Out of scope:** notifications.

- [ ] **S2 Daily digest**
  - **Goal:** A CLI command that prints what changed since a date.
  - **Files:** modify `backend/src/queries.ts`, `backend/src/risk.ts`, `backend/src/cli.ts`, tests, `README.md`.
  - **Spec:** `cli -- digest --since YYYY-MM-DD`: prints (1) decisions with `decided_at` since the date (summary, source URL), (2) PRs merged since the date per component, (3) components currently orphaned or critical. Queries `DECISIONS_SINCE` and `MERGED_PULL_REQUESTS_SINCE` (params `since` epoch ms) and existing `LIST_COMPONENTS`. Output is plain text, sections with headings.
  - **Acceptance criteria:** fixture with `--since 2026-09-01` lists no decisions, PRs 1, 4, 5, 6, 7 under their components, and `src/auth`, `src/db` as critical.
  - **Tests:** a `digestText(db, since)` function tested on the fixture with the values above.
  - **Verify:** run on the demo graph.
  - **Out of scope:** email or scheduling.

- [ ] **S3 Reviewer suggestion**
  - **Goal:** Suggest reviewers for an open PR or issue from expertise.
  - **Files:** modify `backend/src/search.ts`, `backend/src/tools.ts`, `backend/src/app.ts`, tests, `README.md`.
  - **Spec:** `suggestReviewers(db, kind, number)`: reads the item's title (queries `GET_PULL_REQUEST_TITLE`, `GET_ISSUE_TITLE`), runs `whoKnows` on it, and returns the top 3 distinct experts across its components, excluding the author. Tool `suggest_reviewers` (`{ kind: "pr" | "issue", number }`) and `GET /api/suggest-reviewers?kind=&number=`.
  - **Acceptance criteria:** fixture PR 8 ("Add read replicas to the db layer"; author alice) suggests people other than alice.
  - **Tests:** the fixture case above.
  - **Verify:** one live open PR.
  - **Out of scope:** assigning reviewers on GitHub (never).
