# Plan

Every task follows `docs/ARCHITECTURE.md` (called ARCH below; "ARCH §7" means its section 7). Query names refer to the query catalogue in ARCH §7; copy their Cypher exactly.

Graph tests use `withFixtureGraph()` (task 2.2) on the FalkorDB instance in `.env` (CI: the service container).

## Schedule

Planning started Friday 16 October, 17:50 IST. Submission target: **Sunday 18 October, 18:00 IST**. Sessions assume about 45 minutes each, including `/clear`. `/commit` runs once at the end of each phase, after its last task.

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

## Phases 0 to 5: done

Their specs and `Note:` lines are in `docs/PLAN-done.md`. Read the matching task there when a task builds on an earlier one.

## Phase 6: MCP server (F8)

- [x] **6.1 MCP server**
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
    Note: Verified with an SDK `StdioClientTransport` running the README's exact `node --env-file=… backend/dist/cli.js mcp` command against the dev graph (eight tools listed, `team_ranking` returned 15 people), not inside a Claude Code or Claude Desktop session; the user should try the snippet in one of them once.

## Phase 7: Web UI (F9)

All screens: Tailwind only, no new UI libraries, labels on every control, `focus-visible:ring-2` on interactive elements, risk shown as text and colour. Use `InferResponseType` from `hono/client` for response types, or `import type` from `backend/src/schemas.ts` (ARCH §6 allows type-only imports from `app.ts` and `schemas.ts`).

- [x] **7.1 App shell, graph view and Risk Map**
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
    Note: ARCH §11 has no colour for the `component` node kind, so `KIND_COLORS.component` is `#0369a1`; graph node ids use the ARCH §8 `person:`/`component:` prefixes.

- [x] **7.2 Component details panel**
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
    Note: `/api/component` returns `madeBy` as person ids (logins), so the panel shows the expert's name when the person is in the experts list and the login otherwise; "supersedes" shows decision ids. The graph highlights the component and the people with `expert: true` links to it.

- [x] **7.3 Departure Simulation screen**
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
    Note: The risk-map graph builder moved into an exported `riskMapGraph(riskMap, riskOf)` in `RiskMapScreen.tsx` so both screens share it. `GraphView` has no link colouring, so After dims only the departing person's node; their links keep the default faint colour. Decisions are a hand-written list rather than `SourcesList` because several decisions can share one thread URL, and `SourcesList` keys rows by URL.

- [x] **7.4 Handover panel**
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

- [x] **7.5 Ask screen**
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
    Note: "Who knows the query planner best?" was replaced because its sources were loosely related search hits; the final three examples were checked against the local backend on the dev graph (7, 12 and 3 sources), not yet a deployed demo. All path nodes are passed as `highlighted` so `GraphView` labels them.

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
