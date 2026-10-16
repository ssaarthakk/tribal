# Tribal: product brief

This brief is the input for Phase 0. It describes the product, the locked feature list, the technical decisions already made, and how Phase 0 must turn it into a plan that a less capable model can implement task by task without guessing.

---

## 1. Context

- **Event:** Graph Hacks: Context for AI Agents (WeMakeDevs x FalkorDB), online.
- **Track:** Company Brain: "an agent that understands how a company works. Connect people, teams, projects, documents, and decisions in one graph, so the agent can answer questions and get work done across all of it."
- **Track focus areas** (the plan must visibly cover each one): knowledge from docs, tickets and chats in one graph; who owns what and who knows what; tracing decisions back to their source; keeping knowledge current as things change; answers with clear sources.
- **Deadline:** submissions close **Sunday 18 October 2026, 11:59 PM IST**. Internal target: everything submitted by **Sunday 6:00 PM IST**. Planning starts Friday 16 October afternoon IST.
- **Hard rules from the hackathon:**
  1. FalkorDB must be the primary graph database and support a central part of the product.
  2. The graph must do real work. If the product still works with FalkorDB removed, it's disqualified as decoration.
  3. Only public, synthetic, or our own data. No private, login-protected, paywalled, or personal data in the graph.
  4. Main coding happens during the event (it is during the event now).
  5. AI coding assistants are allowed but must be disclosed. We must be able to explain the graph model, the queries, and the architecture.
  6. **Required in the submission:** a public repo; a README with setup instructions and the graph data model; **the Cypher queries or graph algorithms the product depends on**; a demo video; a live deployment or full local setup instructions; the track name.

## 2. The product

**Tribal** is an open-source knowledge-risk engine for engineering teams. It reads a GitHub repository (issues, pull requests, reviews, commits, and markdown docs), builds a knowledge graph in FalkorDB, and answers the questions a team only asks when it's already too late:

- Who actually understands this part of the codebase?
- What happens if this person leaves?
- Why was this decided, by whom, and is it still true?

**The hero feature is the departure simulation:** pick a person, remove them from the graph, and see which components lose their last expert, which decisions lose their only owner, and what open work is left stranded. The agent then writes a handover plan.

**Demo dataset:** the public `FalkorDB/FalkorDB` GitHub repository, treated as "the company". Its maintainers are people, its folders are components, its PRs and issues are the tickets and chats, and its markdown files are the docs. If that repo turns out to be too small or too large to make a good demo, propose an alternative public repo in Phase 0 and ask before switching.

**Long-term use (not built now, but the design must not block it):** point it at any team's repos, add Slack/Linear/Notion later, run it self-hosted, and plug it into coding agents through MCP.

## 3. Locked feature list

Build exactly these. Nothing else until all of F1–F9 are done and deployed.

| ID  | Feature                          | Summary                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | GitHub ingestion                 | Fetch issues, PRs, review comments, issue/PR comments, commits with changed files, and markdown docs from one repo into a JSON snapshot in `data/`. Live fetching only happens through an explicit CLI command; everything else reads the snapshot.                                                                                                                |
| F2  | Graph model and identity merging | Load the snapshot into FalkorDB using the schema below. Merge a person's GitHub login, commit author emails and name variants into one `Person` node. Idempotent: loading twice produces the same graph.                                                                                                                                                           |
| F3  | Expertise scores                 | Compute `(:Person)-[:KNOWS_ABOUT {score, last_active}]->(:Component)` from commits, reviews, authored PRs and discussion, with time decay.                                                                                                                                                                                                                         |
| F4  | Knowledge risk (hero)            | (a) Bus factor per component. (b) Team dependency ranking using FalkorDB graph algorithms (PageRank and a centrality measure on a person-to-person collaboration graph). (c) Departure simulation: remove a person and report orphaned components, critical components, decisions losing their only owner, stranded open PRs and issues, and suggested successors. |
| F5  | Decision tracking                | LLM extracts decisions from PR and issue threads as structured records, linked to their source thread, the people involved, the affected components, and earlier decisions they replace (`SUPERSEDES`). Results cached in `data/` so deployment and tests never need the LLM for this.                                                                             |
| F6  | Agent Q&A with sources           | Tool-calling chat agent whose tools are Cypher queries and graph algorithms. Every answer cites GitHub URLs and returns the graph path it used so the UI can highlight it. The agent may only state facts that came from tool results.                                                                                                                             |
| F7  | Handover plan                    | After a departure simulation, the agent writes a handover plan (what to document, who to pair with whom, which decisions need a new owner, which open work to reassign), exportable as markdown and as copy-ready GitHub issue text. It **never** posts to GitHub.                                                                                                 |
| F8  | MCP server                       | The same tools as F6 exposed over MCP (stdio), with a README snippet for adding it to Claude Desktop and Cursor.                                                                                                                                                                                                                                                   |
| F9  | Web UI                           | Three screens: Risk Map (graph of people and components coloured by bus factor), Departure Simulation (pick a person, before/after view, handover plan), and Ask (chat with a panel showing the answer's graph path and sources).                                                                                                                                  |

**Stretch, in this order, only after F1–F9 are deployed:**

- S1 Stale-doc alerts: docs whose described component changed significantly after the doc was last updated.
- S2 Daily digest: a CLI command that prints risk changes and new decisions since a given date.
- S3 Reviewer suggestion: for a given open issue or PR, suggest the best reviewers from expertise scores.

**Explicitly out of scope:** Slack, Notion, Jira or other connectors; user accounts and auth; multiple repos at once; live webhooks; billing; posting anything to GitHub.

## 4. Decided technical choices

- **Language:** TypeScript everywhere, Node.js LTS, npm workspaces `backend` and `web`.
- **Backend:** Hono on Node via `@hono/node-server`. Request and response validation with `zod` and `@hono/zod-validator`. Export the app's route type so the frontend uses Hono's typed RPC client (`hono/client`) instead of hand-written fetch calls, which gives the frontend compile-time checked API calls.
- **Graph database:** `falkordblite` (npm) for local development and tests (embedded, no Docker); the official `falkordb` npm client against FalkorDB Cloud's free tier for deployment. One connection module chooses between them from environment variables. The free cloud tier has 100MB of RAM, no persistence, and stops after a day of inactivity, so there must be a seed command that rebuilds the whole graph from `data/` in one go.
- **Search:** use FalkorDB's built-in full-text index on titles, bodies and decision summaries to find entities from a chat question. This keeps search inside the graph database with no embedding model. Verify the index procedures in the current FalkorDB docs. Vector embeddings are not used unless Phase 0 finds full-text search clearly inadequate, in which case ask first.
- **LLM: Google Gemini on the free tier (Google AI Studio key, no card).** Default model: the current free Flash-Lite model, because it has the most generous free daily quota; use a free Flash model only if quality testing shows Flash-Lite isn't good enough. Call it through Gemini's OpenAI-compatible endpoint with the `openai` npm package (only a client library; nothing is sent to or paid to OpenAI), configured by `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. This keeps a one-line switch to another free provider such as Groq if Gemini's limits get in the way. Verify the endpoint URL, model names, function-calling support and structured JSON output against the current Gemini docs in Phase 0. All LLM calls go through one small module with a fake for tests, and all LLM output is validated with `zod`.
- **Free-tier limits shape the design:** free limits are per project, low per minute, and can change, so: (1) decision extraction (F5) runs once offline, sends several short threads per request, retries on HTTP 429 with backoff, and caches results in `data/` keyed by a content hash so re-runs cost nothing; (2) handover plans (F7) for the five people the demo uses are precomputed and cached, with live generation for anyone else; (3) chat (F6) caps tool steps per question and shows a clear "rate limit reached, try again in a minute" message instead of failing. The demo must still be fully usable if the LLM is unavailable, except for new chat questions.
- **GitHub access:** use `GITHUB_TOKEN` if set; otherwise get a token by running `gh auth token` (gh is installed and logged in). Plain `fetch` against the GitHub REST API; no Octokit unless Phase 0 shows a clear need.
- **FalkorDB's official MCP server is a development tool, not part of the product.** It's configured for Claude Code during setup so the coding agent can check the schema and test queries read-only against the dev graph. Phase 1 must make sure a local dev graph is reachable on a fixed TCP port for it. Our own MCP server (F8) is separate: it exposes Tribal's higher-level tools (bus factor, departure simulation, decision history), not raw Cypher. The README should mention that users can run FalkorDB's official MCP server alongside ours for ad-hoc queries.
- **MCP (F8):** the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`), stdio transport, tool inputs defined with `zod`. The agent's tools (F6) and the MCP tools must be the same functions.
- **Frontend:** Vite, React, TypeScript (strict), Tailwind, `react-force-graph-2d` for graph views, and the Hono RPC client for API calls.
- **CLI:** `npm --workspace backend run cli -- <command>` with subcommands `fetch`, `load`, `extract-decisions`, `serve`, `mcp`.
- **Hosting:** frontend on Cloudflare Pages via `wrangler`. Backend: first check whether the `falkordb` npm client can connect to FalkorDB Cloud from Cloudflare Workers (Hono runs on Workers natively, and `wrangler` is already set up). Only use Workers if that works in a real test. Otherwise host the Node backend on a free service such as Render.
- **Before using any library API, FalkorDB procedure, or Cypher function, check the current official docs.** In particular, verify the exact names and signatures of FalkorDB's graph algorithm procedures (PageRank, centrality, shortest path), the full-text index procedures, and which of them FalkorDBLite supports, and record them in `docs/ARCHITECTURE.md`.

## 5. Graph model (starting point; Phase 0 finalises it)

**Nodes**

- `Person {id, login, name, emails}`
- `Component {path, name}`: a top-level or second-level directory; Phase 0 picks the granularity that gives 15–40 components for the demo repo
- `File {path}`
- `Commit {sha, message, authored_at, url}`
- `PullRequest {number, title, body, state, created_at, merged_at, url}`
- `Issue {number, title, body, state, created_at, closed_at, url}`
- `Comment {id, body, created_at, url}`
- `Doc {path, updated_at, url}`
- `Decision {id, summary, rationale, status, decided_at, source_url, confidence}`, where `status` is `active` or `superseded`

**Relationships**

- `(Person)-[:AUTHORED]->(Commit | PullRequest | Issue | Comment)`
- `(Person)-[:REVIEWED {state, at}]->(PullRequest)`
- `(Commit)-[:MODIFIES {additions, deletions}]->(File)`
- `(File)-[:PART_OF]->(Component)`
- `(PullRequest)-[:CONTAINS]->(Commit)`
- `(PullRequest)-[:CLOSES]->(Issue)`
- `(Comment)-[:ON]->(PullRequest | Issue)`
- `(Doc)-[:DESCRIBES]->(Component)`
- `(Person)-[:MADE]->(Decision)`
- `(Decision)-[:DECIDED_IN]->(PullRequest | Issue)`
- `(Decision)-[:AFFECTS]->(Component)`
- `(Decision)-[:SUPERSEDES]->(Decision)`
- Derived: `(Person)-[:KNOWS_ABOUT {score, last_active}]->(Component)`
- Derived: `(Person)-[:COLLABORATES_WITH {weight}]->(Person)`, from reviewing each other's PRs and working on the same components

## 6. Scoring and risk definitions (starting point; Phase 0 finalises the numbers)

- **Activity weights:** commit touching a component = 1.0 × log(1 + lines changed); review on a PR touching it = 0.6; authored PR touching it = 0.8; comment on an issue or PR linked to it = 0.2.
- **Time decay:** each activity is multiplied by 0.5^(age_days / 180).
- **Expert:** a person whose share of a component's total score is at least 10% and who was active on it in the last 365 days.
- **Bus factor:** the number of experts on a component. 0 = orphaned, 1 = critical, 2 = at risk, 3+ = healthy.
- **Departure simulation for person X:** recompute experts excluding X. Report components whose bus factor drops to 0 or 1; active decisions where X is the only `MADE` participant; open PRs and issues authored by X; and for each affected component, the top three remaining people by score as suggested successors, plus people within two `COLLABORATES_WITH` hops of X.
- **Team dependency ranking:** PageRank and one centrality measure over `COLLABORATES_WITH`, using FalkorDB's built-in procedures, not TypeScript re-implementations. This is part of what makes the graph load-bearing.

## 7. Deliverables for the hackathon submission

1. Public GitHub repo, MIT licence.
2. README with: what it is and the track it's entering (Company Brain); a screenshot or GIF; local setup from zero (no Docker); how to point it at another repo; the graph data model (a Mermaid diagram plus a table of node and relationship types); **a section titled "Cypher queries and graph algorithms" listing every query in `backend/src/queries.ts` with a one-line explanation of what each does and which feature uses it, plus every FalkorDB algorithm procedure used and why**; MCP setup for Claude Desktop and Cursor; architecture overview; "Built with AI assistance" disclosure.
3. Live deployment: frontend URL and backend URL, seeded with the demo repo.
4. Demo video, 2–3 minutes, built with Remotion in a `video/` folder (its own npm workspace) from screen recordings I make of the deployed app. The plan includes a demo script (scene by scene: what to show, what to say, roughly how long) and a Remotion composition that assembles my recordings with title cards and captions.
5. Blog post draft in `docs/BLOG.md` (for the best-blog-post side prize): the problem, why a graph, the data model, the departure simulation, what I learned.
6. Submission text: project name, one-line pitch, description, track, links, ready to paste into the WeMakeDevs panel.

---

## 8. Instructions for Phase 0

Phase 0 writes three files and nothing else. No product code.

### `docs/PROJECT.md`

One page: the problem, the product, who it's for, the demo dataset, the hackathon rules that constrain us, the deadline, and how each track focus area is covered (a table: focus area → feature IDs).

### `docs/ARCHITECTURE.md`

The source of truth every later session follows:

- Final graph schema: every node label and property with types, every relationship type with properties, the indexes and constraints to create, and the full-text index.
- The exact FalkorDB algorithm and full-text procedure names and signatures we'll use, verified against current docs, and whether FalkorDBLite supports each.
- Folder layout for `backend/`, `web/`, `data/`, `video/`, with every module named and its one responsibility.
- Module boundaries: which module may import which. Cypher only in `queries.ts`. LLM calls only in one module. Database connection only in one module. GitHub calls only in one module.
- Every backend function that other modules call: name, full TypeScript signature, and one-line purpose. Shared types (as `zod` schemas with inferred types) and the file each lives in.
- API routes: method, path, request and response shapes as `zod` schemas, and how the frontend calls each through the Hono RPC client.
- MCP tools: name, description, input schema, output shape. The agent's tools in F6 must be the same functions.
- Frontend: screens, components, and which API route each one calls.
- The snapshot JSON format in `data/` (with a short example), and the fixture: a small, hand-checkable subset (around 5 people, 6 components, 20 commits, 8 PRs, 6 issues, 3 decisions) that tests use, with known expected values for expertise scores, bus factor and the departure simulation so tests can assert exact numbers.
- Final scoring constants and risk definitions.
- Environment variables and which module reads each one.
- The approved dependency list with exact versions to pin, per workspace. Nothing outside it gets added without asking me.

### `docs/PLAN.md`

Replace the file's contents with the full phased plan, keeping Phase 0 as the first phase with its task ticked, and keeping any `Note:` lines setup left under it.

Phases, in this order:

1. Foundation (config and env validation, database connection for Lite and Cloud, local dev graph on a TCP port for the FalkorDB MCP server, CLI skeleton, health route, fixture snapshot)
2. Ingestion and graph loading (F1, F2)
3. Expertise and knowledge risk (F3, F4)
4. Decisions (F5)
5. Agent and handover plan (F6, F7)
6. MCP server (F8)
7. Web UI (F9)
8. Deployment (FalkorDB Cloud seeding, backend host, Cloudflare Pages)
9. Submission (README, demo script, Remotion video, blog draft, submission text)
10. Stretch (S1, S2, S3)

Put the deployment phase before the UI is fully polished if that's the only way to stay on schedule, and say so.

**Every task must be completable in one session (roughly 30–90 minutes of agent work) and must contain:**

- **Goal:** one sentence.
- **Files:** each file to create or modify.
- **Spec:** TypeScript signatures, `zod` schemas, exact Cypher for any query (named as it will appear in `queries.ts`), route shapes, or UI behaviour. Specific enough that the implementer never has to invent structure.
- **Dependencies:** any package this task adds, with the exact version from the approved list.
- **Acceptance criteria:** 2–5 checkable statements.
- **Tests:** which test file and what each test asserts, using the fixture and exact expected values where possible.
- **Verify:** the commands that prove it works (beyond `npm run check`).
- **Out of scope:** what not to touch.

**Manual work:** gather every manual step the project needs before the final submission into one list (see "When Phase 0 is done"). Only steps that can't happen until later stay in the plan as `[MANUAL]` tasks, placed just before the task that needs them, with exact step-by-step instructions inside. Expected later ones: recording the screen captures for the video, and submitting on the WeMakeDevs panel.

At the top of the plan, add a schedule: each phase with an estimated number of sessions and a target finish time in IST, ending with the submission by Sunday 6:00 PM IST. If the full scope doesn't fit, say which stretch items and which polish to cut; never cut F1–F9.

### When Phase 0 is done

1. List any open questions or risks you found (for example a FalkorDB procedure that FalkorDBLite doesn't support, or the demo repo being too large for the 100MB free tier) and ask me to decide any that need a decision.
2. Show me the schedule.
3. **Ask me to do the manual setup now**, as one numbered checklist with exact steps for each item. Include at least:
   - Confirm I'm registered for Graph Hacks on WeMakeDevs.
   - Create a free Google AI Studio API key and put it in `.env` as `LLM_API_KEY` (I edit `.env` myself; you never read it).
   - Create a FalkorDB Cloud free-tier instance and put its connection details in `.env`.
   - Create an account on the backend host if one is needed (say which one, or that this waits until the Workers test in the deployment phase).
   - Approve creating this project's public GitHub repo with `gh`, and the repo name.
   - Anything else you found that I must do by hand.
4. Wait for me to confirm. Then run `scripts/doctor.sh` to verify what can be verified, and for each item that can't be verified, ask me to confirm it.
5. If I've approved the repo, create the public GitHub repo with `gh` and add it as the `origin` remote. Don't push.
6. Tick the Phase 0 task and follow the normal `/feature` ending.
