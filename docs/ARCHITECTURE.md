# Tribal: architecture

This file is the source of truth for every implementation task. Follow it exactly. If a task needs something this file doesn't cover, stop and ask.

## 1. Overview

```
GitHub REST API ──────────────fetch──▶ data/snapshot.json ──load──▶ FalkorDB graph ◀── queries.ts
                                             │                          ▲
Gemini (OpenAI-compatible) ◀─extract-decisions─┘ data/decisions.json ──┘
                                                                        │
                    Hono API (app.ts) ◀── tools.ts ──▶ MCP server (mcp.ts)
                          ▲                 ▲
                  web (Vite + React)     agent.ts (chat, tool calling)
```

- `fetch` is the only command that talks to GitHub. Everything else reads files in `data/`.
- `load` rebuilds the whole graph from `data/` in one go (delete graph, create indexes, insert everything, compute derived edges). It is the seed command for FalkorDB Cloud.
- All expertise, risk, collaboration, ranking, search and departure logic runs in FalkorDB as Cypher or FalkorDB procedures. TypeScript only reshapes rows.
- The LLM is used for three things only: extracting decisions (offline, cached), writing handover narrative (cached for demo people, template fallback), and the chat agent.

## 2. Graph schema

All timestamps are stored as **integers: Unix epoch milliseconds (UTC)**. The API converts them to ISO strings. A missing value is `null` (FalkorDB does not store null properties; reading one returns `null`).

### Nodes

| Label         | Property      | Type            | Notes                                                                                     |
| ------------- | ------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `Person`      | `id`          | string          | GitHub login, or `git:<emailHash>` for a commit author with no account                    |
|               | `login`       | string or null  | GitHub login                                                                              |
|               | `name`        | string          | Most frequent commit author name, else the login                                          |
| `Component`   | `path`        | string          | e.g. `src/commands`, `graph/src/runtime`, `(root)`                                        |
|               | `name`        | string          | Last path segment of `path` (`(root)` stays `(root)`)                                     |
|               | `bus_factor`  | integer         | Number of experts. Set by `SET_BUS_FACTOR`                                                |
| `File`        | `path`        | string          |                                                                                           |
| `Commit`      | `sha`         | string          | 40 hex characters                                                                         |
|               | `message`     | string          | First line, at most 200 characters                                                        |
|               | `authored_at` | integer         |                                                                                           |
|               | `url`         | string          | `https://github.com/<repo>/commit/<sha>`                                                  |
| `PullRequest` | `number`      | integer         |                                                                                           |
|               | `title`       | string          |                                                                                           |
|               | `body`        | string          | At most 2,000 characters                                                                  |
|               | `state`       | string          | `open`, `closed` or `merged`                                                              |
|               | `created_at`  | integer         |                                                                                           |
|               | `merged_at`   | integer or null |                                                                                           |
|               | `url`         | string          |                                                                                           |
| `Issue`       | `number`      | integer         |                                                                                           |
|               | `title`       | string          |                                                                                           |
|               | `body`        | string          | At most 2,000 characters                                                                  |
|               | `state`       | string          | `open` or `closed`                                                                        |
|               | `created_at`  | integer         |                                                                                           |
|               | `closed_at`   | integer or null |                                                                                           |
|               | `url`         | string          |                                                                                           |
| `Comment`     | `id`          | string          | `ic-<github id>` for issue/PR conversation comments, `rc-<github id>` for review comments |
|               | `body`        | string          | At most 1,000 characters                                                                  |
|               | `created_at`  | integer         |                                                                                           |
|               | `url`         | string          |                                                                                           |
| `Doc`         | `path`        | string          | Markdown file path at the head of the default branch                                      |
|               | `title`       | string          | First line starting with `# ` (without the `# `), else the file name                      |
|               | `body`        | string          | At most 4,000 characters                                                                  |
|               | `updated_at`  | integer         | Date of the last commit that touched the file                                             |
|               | `url`         | string          | `https://github.com/<repo>/blob/<branch>/<path>`                                          |
| `Decision`    | `id`          | string          | `<threadKey>-<n>`, e.g. `pr-3-1`, `issue-9-2`                                             |
|               | `summary`     | string          |                                                                                           |
|               | `rationale`   | string          |                                                                                           |
|               | `status`      | string          | `active` or `superseded`. Derived: `superseded` if any decision SUPERSEDES it             |
|               | `decided_at`  | integer         |                                                                                           |
|               | `source_url`  | string          | URL of the PR or issue it was decided in                                                  |
|               | `confidence`  | float           | 0 to 1, from the LLM                                                                      |

### Relationships

| Type                | From → To                                    | Properties                                                                               |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `AUTHORED`          | Person → Commit, PullRequest, Issue, Comment |                                                                                          |
| `REVIEWED`          | Person → PullRequest                         | `state` string, `at` integer. One edge per reviewer and PR: the reviewer's latest review |
| `MODIFIES`          | Commit → File                                | `additions` integer, `deletions` integer                                                 |
| `PART_OF`           | File → Component                             |                                                                                          |
| `CONTAINS`          | PullRequest → Commit                         | The PR's merge (squash) commit                                                           |
| `CLOSES`            | PullRequest → Issue                          |                                                                                          |
| `ON`                | Comment → PullRequest or Issue               |                                                                                          |
| `DESCRIBES`         | Doc → Component                              |                                                                                          |
| `MADE`              | Person → Decision                            |                                                                                          |
| `DECIDED_IN`        | Decision → PullRequest or Issue              |                                                                                          |
| `AFFECTS`           | Decision → Component                         |                                                                                          |
| `SUPERSEDES`        | Decision → Decision                          | Newer → older                                                                            |
| `KNOWS_ABOUT`       | Person → Component                           | Derived. `score` float, `last_active` integer, `share` float, `expert` boolean           |
| `COLLABORATES_WITH` | Person → Person                              | Derived. `weight` float. Stored in **both directions** with the same weight              |

### Indexes and constraints

Created on the empty graph **before** any data is inserted (index builds on existing data are asynchronous in FalkorDB; creating them first keeps results deterministic). Queries `CREATE_INDEXES` and `CREATE_FULLTEXT_INDEXES` in section 7.

- Range (exact-match) indexes: `Person(id)`, `Component(path)`, `File(path)`, `Commit(sha)`, `PullRequest(number)`, `Issue(number)`, `Comment(id)`, `Doc(path)`, `Decision(id)`.
- Full-text indexes: `PullRequest(title, body)`, `Issue(title, body)`, `Decision(summary, rationale)`, `Doc(title, body)`.
- **No unique constraints.** `load` always starts from a deleted graph and every insert is a `MERGE` on an indexed key, so duplicates cannot occur; the loader test checks counts after loading twice. FalkorDB constraints are created asynchronously with a separate command (`GRAPH.CONSTRAINT CREATE`), which adds waiting logic for no benefit here.

## 3. FalkorDB procedures

Checked against docs.falkordb.com on 2026-10-16. Not yet run against a live server (no graph existed during Phase 0); task 1.2 runs them on FalkorDB Cloud and in CI and records anything different in a `Note:`.

| Procedure                         | Signature used                                                                                                                    | Yields          | Used by                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------- |
| `algo.pageRank`                   | `CALL algo.pageRank('Person', 'COLLABORATES_WITH')` (positional: label, relationship type)                                        | `node`, `score` | Team ranking (F4b)     |
| `algo.betweenness`                | `CALL algo.betweenness({nodeLabels: ['Person'], relationshipTypes: ['COLLABORATES_WITH'], samplingSize: 1000, samplingSeed: 42})` | `node`, `score` | Team ranking (F4b)     |
| `db.idx.fulltext.createNodeIndex` | `CALL db.idx.fulltext.createNodeIndex('PullRequest', 'title', 'body')`                                                            | nothing         | Schema setup           |
| `db.idx.fulltext.queryNodes`      | `CALL db.idx.fulltext.queryNodes('PullRequest', $query)`                                                                          | `node`, `score` | Search, who knows (F6) |

Notes:

- PageRank in FalkorDB is unweighted, so `COLLABORATES_WITH.weight` does not affect it. Weight orders collaborators and successors.
- Betweenness docs don't say whether edges are directed. Storing `COLLABORATES_WITH` in both directions gives correct relative scores either way. `samplingSize` is capped at the number of nodes, so 1000 makes it exact for our graph sizes; the fixed seed keeps it reproducible.
- `samplingSize`, `samplingSeed`, label and type names are written as literals in the query text, not parameters.
- Full-text query strings use RediSearch syntax. User text is never passed directly: `toFullTextQuery` (in `search.ts`) keeps lowercase words of 3+ letters or digits, removes duplicates, and joins them with `|` (OR). An empty result means no query is sent.
- Cypher functions used: `log`, `^`, `sum`, `max`, `count`, `collect`, `coalesce`, list slicing. All listed in FalkorDB's function docs.
- **FalkorDBLite is not used.** Version 0.3.0 supports only linux-x64 and darwin-arm64, not this Windows machine. Development and tests use FalkorDB Cloud (free tier); CI uses the `falkordb/falkordb` Docker image as a GitHub Actions service container. One client (`falkordb` npm) for all three.

## 4. Scoring and risk definitions

Constants live in `backend/src/expertise.ts` as `SCORING`:

```ts
export const SCORING = {
  commitWeight: 1.0,
  authoredPrWeight: 0.8,
  reviewWeight: 0.6,
  commentWeight: 0.2,
  halfLifeDays: 180,
  expertShare: 0.1,
  activeDays: 365,
  sharedExpertiseWeight: 0.5,
  riskMapMinShare: 0.05,
} as const;
```

- **now** is the snapshot's `fetchedAt`, never the wall clock, so results are reproducible.
- **Decay** of an activity at time `t`: `0.5 ^ ((now - t) / 86400000 / halfLifeDays)`.
- **Activities** per person and component (each multiplied by its decay):
  - Commit: `commitWeight × log2(1 + lines)`, where `lines` is the sum of additions and deletions over the commit's files in that component. Time: `authored_at`. (log2, not ln, so the fixture's numbers are exact: 1, 3, 7, 15, 31 lines give 1, 2, 3, 4, 5.)
  - Authored PR: `authoredPrWeight` for each component the PR's contained commit touches. Time: PR `created_at`.
  - Review: `reviewWeight` for each component the reviewed PR touches, once per reviewer and PR (latest review). A PR's author is never its reviewer. Time: review `at`.
  - Comment: `commentWeight` per comment on a PR touching the component, or on an issue closed by such a PR. Time: comment `created_at`.
- **score** = sum of all activities. **last_active** = latest activity time.
- **share** = score / sum of all scores on that component.
- **Expert**: `share >= expertShare` and `last_active >= now - activeDays days`.
- **Bus factor** = number of experts. Risk level: `0` orphaned, `1` critical, `2` at_risk, `3+` healthy.
- **Collaboration weight** for each pair of people: (number of PRs where one reviewed the other's PR) + `sharedExpertiseWeight` × (number of components where both are experts).
- **Departure simulation for person X** (read-only, nothing is deleted):
  - Affected components: every component where X is an expert. `busFactorAfter` = number of other experts. The original shares are kept: the knowledge leaves with X, so nobody becomes an expert by X leaving.
  - Orphaned: `busFactorAfter = 0`. Critical: `busFactorAfter = 1`.
  - Successors per affected component: the top 3 other people by `KNOWS_ABOUT.score`.
  - Decisions losing their only owner: `active` decisions where X is the only `MADE` participant.
  - Open work: open PRs and open issues authored by X.
  - Nearby collaborators: people within two `COLLABORATES_WITH` hops of X, ordered by direct weight (0 for two-hop only), then id.
- **Team ranking**: PageRank and betweenness over `Person` and `COLLABORATES_WITH`, sorted by PageRank descending.

## 5. Folder layout

```
backend/
  package.json, tsconfig.json
  src/
    env.ts           Parse and validate environment variables (the only reader of process.env)
    db.ts            Connect to FalkorDB and run queries with zod-validated rows (the only importer of falkordb)
    queries.ts       Every Cypher query, as named exported constants
    datafiles.ts     zod schemas and read/write functions for every JSON file in data/
    components.ts    Map a file path to its component; pick the components of a snapshot
    identity.ts      Merge GitHub logins, commit emails and names into people
    github.ts        GitHub REST calls (the only module that talks to GitHub)
    ingest.ts        Turn what github.ts returns into a Snapshot
    load.ts          Rebuild the graph from a snapshot and a decision cache
    expertise.ts     Compute KNOWS_ABOUT, experts, bus factor and COLLABORATES_WITH in the graph
    schemas.ts       zod schemas and types shared by the API, tools and agent
    risk.ts          Read models: risk map, components, people, ranking, departure simulation, decision history
    search.ts        Full-text search and "who knows about X"
    llm.ts           The only module that calls the LLM (OpenAI-compatible client)
    decisions.ts     Select threads, extract decisions with the LLM, maintain the decision cache
    handover.ts      Build, narrate, render and cache handover plans
    tools.ts         The tool list shared by the chat agent and the MCP server
    agent.ts         Tool-calling chat agent
    app.ts           Hono routes; exports AppType for the typed client
    server.ts        Start the HTTP server (auto-seeds an empty graph)
    mcp.ts           MCP stdio server
    cli.ts           Command-line entry: fetch, load, extract-decisions, handovers, serve, mcp
    test-graph.ts    Test helper: a throwaway graph loaded with the fixture
    *.test.ts        vitest tests next to the module they test
web/
  src/
    main.tsx         React entry
    App.tsx          Header, navigation, screen switch from the URL hash
    api.ts           Typed Hono client
    colors.ts        Risk level and node kind colours
    screens/RiskMapScreen.tsx
    screens/SimulationScreen.tsx
    screens/AskScreen.tsx
    components/GraphView.tsx       react-force-graph-2d wrapper with highlighting
    components/ComponentPanel.tsx  Details of one component
    components/RiskBadge.tsx       Text + colour badge for a risk level
    components/HandoverPanel.tsx   Handover plan with copy and download buttons
    components/SourcesList.tsx     List of source links
data/
  config.json                Demo repo settings (input to fetch)
  snapshot.json              Fetched demo snapshot (written by fetch, committed)
  decisions.json             Decision cache for the demo (written by extract-decisions, committed)
  handovers.json             Handover narrative cache (written by handovers, committed)
  fixture/snapshot.json      Synthetic test fixture (section 12)
  fixture/decisions.json     Fixture decisions (section 12)
video/
  package.json, tsconfig.json
  src/index.ts     registerRoot
  src/Root.tsx     Composition "Demo"
  src/Demo.tsx     Scenes in a Series
  src/scenes.ts    Scene list: kind, file, title, caption, seconds
  public/recordings/   Screen recordings (gitignored)
scripts/
  check.sh, format.sh, doctor.sh
  falkordb-mcp.sh  Starts FalkorDB's official MCP server against the dev graph using .env
  deploy-web.sh    Builds and deploys the web app to Cloudflare Pages
render.yaml        Render blueprint for the backend
.github/workflows/ci.yml, keepalive.yml
```

## 6. Module boundaries

- `process.env` is read only in `env.ts`. Other modules receive the parsed `Env` (or a part of it).
- `falkordb` is imported only in `db.ts`.
- Cypher strings exist only in `queries.ts`, including in tests.
- `openai` is imported only in `llm.ts`.
- `fetch` to GitHub and `node:child_process` (only for `gh auth token`) are used only in `github.ts`.
- Files in `data/` are read and written only through `datafiles.ts`.
- `web` imports only **types** from the backend (`import type` from `backend/src/app.ts` and `backend/src/schemas.ts`), never runtime code.
- Allowed imports (a module may import the ones listed after it):
  - `cli` → env, db, datafiles, github, ingest, load, llm, decisions, handover, risk, server, mcp
  - `server` → env, db, app, load, datafiles, llm
  - `mcp` → db, tools
  - `app` → db, risk, search, agent, handover, llm, schemas, datafiles
  - `agent` → llm, tools, schemas
  - `tools` → db, risk, search, schemas
  - `handover` → llm, schemas, datafiles
  - `decisions` → llm, datafiles, components
  - `risk`, `search` → db, queries, schemas
  - `load` → db, queries, datafiles, components, identity, expertise
  - `expertise` → db, queries
  - `ingest` → github, datafiles, components
  - `components`, `identity` → datafiles (types only)

## 7. Query catalogue (`backend/src/queries.ts`)

Every constant below is exported from `queries.ts` with exactly this name and text. Parameters start with `$`. Batched inserts pass `$rows` (at most 500 rows per call; `load.ts` splits larger arrays).

### Setup and health

```ts
export const PING = "RETURN 1 AS one";

export const COUNT_NODES = "MATCH (n) RETURN count(n) AS nodes";

export const COUNT_LABELS =
  "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count";

export const COUNT_RELATIONSHIPS =
  "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count";

export const CREATE_INDEXES = [
  "CREATE INDEX FOR (n:Person) ON (n.id)",
  "CREATE INDEX FOR (n:Component) ON (n.path)",
  "CREATE INDEX FOR (n:File) ON (n.path)",
  "CREATE INDEX FOR (n:Commit) ON (n.sha)",
  "CREATE INDEX FOR (n:PullRequest) ON (n.number)",
  "CREATE INDEX FOR (n:Issue) ON (n.number)",
  "CREATE INDEX FOR (n:Comment) ON (n.id)",
  "CREATE INDEX FOR (n:Doc) ON (n.path)",
  "CREATE INDEX FOR (n:Decision) ON (n.id)",
];

export const CREATE_FULLTEXT_INDEXES = [
  "CALL db.idx.fulltext.createNodeIndex('PullRequest', 'title', 'body')",
  "CALL db.idx.fulltext.createNodeIndex('Issue', 'title', 'body')",
  "CALL db.idx.fulltext.createNodeIndex('Decision', 'summary', 'rationale')",
  "CALL db.idx.fulltext.createNodeIndex('Doc', 'title', 'body')",
];
```

### Loading (F2)

```cypher
-- MERGE_PEOPLE   rows: {id, login, name}
UNWIND $rows AS row
MERGE (p:Person {id: row.id})
SET p.login = row.login, p.name = row.name

-- MERGE_COMPONENTS   rows: {path, name}
UNWIND $rows AS row
MERGE (c:Component {path: row.path})
SET c.name = row.name, c.bus_factor = 0

-- MERGE_FILES   rows: {path, component (string or null)}
UNWIND $rows AS row
MERGE (f:File {path: row.path})
WITH f, row
WHERE row.component IS NOT NULL
MATCH (c:Component {path: row.component})
MERGE (f)-[:PART_OF]->(c)

-- MERGE_COMMITS   rows: {sha, message, authoredAt, url, authorId (string or null)}
UNWIND $rows AS row
MERGE (c:Commit {sha: row.sha})
SET c.message = row.message, c.authored_at = row.authoredAt, c.url = row.url
WITH c, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(c)

-- MERGE_MODIFIES   rows: {sha, path, additions, deletions}
UNWIND $rows AS row
MATCH (c:Commit {sha: row.sha})
MATCH (f:File {path: row.path})
MERGE (c)-[m:MODIFIES]->(f)
SET m.additions = row.additions, m.deletions = row.deletions

-- MERGE_PULL_REQUESTS   rows: {number, title, body, state, createdAt, mergedAt, url, authorId}
UNWIND $rows AS row
MERGE (pr:PullRequest {number: row.number})
SET pr.title = row.title, pr.body = row.body, pr.state = row.state, pr.created_at = row.createdAt, pr.merged_at = row.mergedAt, pr.url = row.url
WITH pr, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(pr)

-- MERGE_CONTAINS   rows: {number, sha}
UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MATCH (c:Commit {sha: row.sha})
MERGE (pr)-[:CONTAINS]->(c)

-- MERGE_REVIEWS   rows: {number, reviewerId, state, at}
UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MATCH (p:Person {id: row.reviewerId})
MERGE (p)-[r:REVIEWED]->(pr)
SET r.state = row.state, r.at = row.at

-- MERGE_ISSUES   rows: {number, title, body, state, createdAt, closedAt, url, authorId}
UNWIND $rows AS row
MERGE (i:Issue {number: row.number})
SET i.title = row.title, i.body = row.body, i.state = row.state, i.created_at = row.createdAt, i.closed_at = row.closedAt, i.url = row.url
WITH i, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(i)

-- MERGE_CLOSES   rows: {prNumber, issueNumber}
UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.prNumber})
MATCH (i:Issue {number: row.issueNumber})
MERGE (pr)-[:CLOSES]->(i)

-- MERGE_PR_COMMENTS   rows: {id, body, createdAt, url, authorId, number}
UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MERGE (c:Comment {id: row.id})
SET c.body = row.body, c.created_at = row.createdAt, c.url = row.url
MERGE (c)-[:ON]->(pr)
WITH c, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(c)

-- MERGE_ISSUE_COMMENTS   rows: same as MERGE_PR_COMMENTS
UNWIND $rows AS row
MATCH (i:Issue {number: row.number})
MERGE (c:Comment {id: row.id})
SET c.body = row.body, c.created_at = row.createdAt, c.url = row.url
MERGE (c)-[:ON]->(i)
WITH c, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(c)

-- MERGE_DOCS   rows: {path, title, body, updatedAt, url, components: string[]}
UNWIND $rows AS row
MERGE (d:Doc {path: row.path})
SET d.title = row.title, d.body = row.body, d.updated_at = row.updatedAt, d.url = row.url
WITH d, row
UNWIND row.components AS componentPath
MATCH (c:Component {path: componentPath})
MERGE (d)-[:DESCRIBES]->(c)

-- MERGE_DECISIONS_IN_PULL_REQUESTS   rows: {id, summary, rationale, decidedAt, confidence, number}
UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MERGE (d:Decision {id: row.id})
SET d.summary = row.summary, d.rationale = row.rationale, d.decided_at = row.decidedAt, d.confidence = row.confidence, d.source_url = pr.url, d.status = 'active'
MERGE (d)-[:DECIDED_IN]->(pr)

-- MERGE_DECISIONS_IN_ISSUES   rows: same as MERGE_DECISIONS_IN_PULL_REQUESTS
UNWIND $rows AS row
MATCH (i:Issue {number: row.number})
MERGE (d:Decision {id: row.id})
SET d.summary = row.summary, d.rationale = row.rationale, d.decided_at = row.decidedAt, d.confidence = row.confidence, d.source_url = i.url, d.status = 'active'
MERGE (d)-[:DECIDED_IN]->(i)

-- MERGE_MADE   rows: {decisionId, personId}
UNWIND $rows AS row
MATCH (d:Decision {id: row.decisionId})
MATCH (p:Person {id: row.personId})
MERGE (p)-[:MADE]->(d)

-- MERGE_AFFECTS   rows: {decisionId, componentPath}
UNWIND $rows AS row
MATCH (d:Decision {id: row.decisionId})
MATCH (c:Component {path: row.componentPath})
MERGE (d)-[:AFFECTS]->(c)

-- MERGE_SUPERSEDES   rows: {newId, oldId}
UNWIND $rows AS row
MATCH (n:Decision {id: row.newId})
MATCH (o:Decision {id: row.oldId})
MERGE (n)-[:SUPERSEDES]->(o)

-- SET_DECISION_STATUS
MATCH (d:Decision)
OPTIONAL MATCH (:Decision)-[s:SUPERSEDES]->(d)
WITH d, count(s) AS newer
SET d.status = CASE WHEN newer > 0 THEN 'superseded' ELSE 'active' END
```

In `queries.ts` each of these is a template string constant named as in its `--` header, without the header line.

### Expertise and collaboration (F3, F4)

Parameters for all: `$now` (epoch ms), `$halfLifeDays`, and the weight named in the query, all from `SCORING`.

```cypher
-- DELETE_KNOWS_ABOUT
MATCH ()-[k:KNOWS_ABOUT]->() DELETE k

-- ADD_COMMIT_EXPERTISE   params: now, halfLifeDays, weight
MATCH (p:Person)-[:AUTHORED]->(c:Commit)-[m:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH p, c, comp, sum(m.additions + m.deletions) AS lines
WITH p, comp, sum($weight * log(1 + lines) / log(2) * 0.5 ^ (($now - c.authored_at) / 86400000.0 / $halfLifeDays)) AS score, max(c.authored_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END

-- ADD_AUTHORED_PR_EXPERTISE   params: now, halfLifeDays, weight
MATCH (p:Person)-[:AUTHORED]->(pr:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, pr, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - pr.created_at) / 86400000.0 / $halfLifeDays)) AS score, max(pr.created_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END

-- ADD_REVIEW_EXPERTISE   params: now, halfLifeDays, weight
MATCH (p:Person)-[r:REVIEWED]->(pr:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, r, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - r.at) / 86400000.0 / $halfLifeDays)) AS score, max(r.at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END

-- ADD_PR_COMMENT_EXPERTISE   params: now, halfLifeDays, weight
MATCH (p:Person)-[:AUTHORED]->(cm:Comment)-[:ON]->(:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, cm, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - cm.created_at) / 86400000.0 / $halfLifeDays)) AS score, max(cm.created_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END

-- ADD_ISSUE_COMMENT_EXPERTISE   params: now, halfLifeDays, weight
MATCH (p:Person)-[:AUTHORED]->(cm:Comment)-[:ON]->(:Issue)<-[:CLOSES]-(:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, cm, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - cm.created_at) / 86400000.0 / $halfLifeDays)) AS score, max(cm.created_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END

-- MARK_EXPERTS   params: now, expertShare, activeDays
MATCH (:Person)-[k:KNOWS_ABOUT]->(comp:Component)
WITH comp, sum(k.score) AS total
MATCH (:Person)-[k:KNOWS_ABOUT]->(comp)
SET k.share = k.score / total, k.expert = (k.score / total >= $expertShare AND k.last_active >= $now - $activeDays * 86400000)

-- SET_BUS_FACTOR
MATCH (comp:Component)
OPTIONAL MATCH (p:Person)-[:KNOWS_ABOUT {expert: true}]->(comp)
WITH comp, count(p) AS experts
SET comp.bus_factor = experts

-- DELETE_COLLABORATION
MATCH ()-[x:COLLABORATES_WITH]->() DELETE x

-- ADD_REVIEW_COLLABORATION
MATCH (a:Person)-[:REVIEWED]->(pr:PullRequest)<-[:AUTHORED]-(b:Person)
WHERE a <> b
WITH a, b, count(pr) AS reviews
MERGE (a)-[x:COLLABORATES_WITH]->(b)
ON CREATE SET x.weight = 0.0
SET x.weight = x.weight + reviews
MERGE (b)-[y:COLLABORATES_WITH]->(a)
ON CREATE SET y.weight = 0.0
SET y.weight = y.weight + reviews

-- ADD_SHARED_EXPERTISE_COLLABORATION   params: weight
MATCH (a:Person)-[:KNOWS_ABOUT {expert: true}]->(c:Component)<-[:KNOWS_ABOUT {expert: true}]-(b:Person)
WHERE a.id < b.id
WITH a, b, count(c) AS shared
MERGE (a)-[x:COLLABORATES_WITH]->(b)
ON CREATE SET x.weight = 0.0
SET x.weight = x.weight + $weight * shared
MERGE (b)-[y:COLLABORATES_WITH]->(a)
ON CREATE SET y.weight = 0.0
SET y.weight = y.weight + $weight * shared
```

### Read models (F4, F6, F9)

```cypher
-- LIST_COMPONENTS
MATCH (c:Component)
RETURN c.path AS path, c.name AS name, c.bus_factor AS busFactor
ORDER BY busFactor, path

-- RISK_MAP_LINKS   params: minShare
MATCH (p:Person)-[k:KNOWS_ABOUT]->(c:Component)
WHERE k.share >= $minShare
RETURN p.id AS personId, p.login AS login, p.name AS name, c.path AS componentPath, k.score AS score, k.share AS share, k.expert AS expert
ORDER BY componentPath, score DESC

-- TEAM_PAGERANK
CALL algo.pageRank('Person', 'COLLABORATES_WITH') YIELD node, score
RETURN node.id AS id, node.login AS login, node.name AS name, score

-- TEAM_BETWEENNESS
CALL algo.betweenness({nodeLabels: ['Person'], relationshipTypes: ['COLLABORATES_WITH'], samplingSize: 1000, samplingSeed: 42}) YIELD node, score
RETURN node.id AS id, score

-- GET_COMPONENT   params: path
MATCH (c:Component {path: $path})
RETURN c.path AS path, c.name AS name, c.bus_factor AS busFactor

-- COMPONENT_EXPERTS   params: path, limit
MATCH (p:Person)-[k:KNOWS_ABOUT]->(c:Component {path: $path})
RETURN p.id AS id, p.login AS login, p.name AS name, k.score AS score, k.share AS share, k.last_active AS lastActive, k.expert AS expert
ORDER BY score DESC, id
LIMIT $limit

-- COMPONENT_DECISIONS   params: path
MATCH (d:Decision)-[:AFFECTS]->(:Component {path: $path})
OPTIONAL MATCH (m:Person)-[:MADE]->(d)
OPTIONAL MATCH (d)-[:SUPERSEDES]->(old:Decision)
RETURN d.id AS id, d.summary AS summary, d.rationale AS rationale, d.status AS status, d.decided_at AS decidedAt, d.source_url AS sourceUrl, collect(DISTINCT m.id) AS madeBy, collect(DISTINCT old.id) AS supersedes
ORDER BY decidedAt, id

-- COMPONENT_DOCS   params: path
MATCH (d:Doc)-[:DESCRIBES]->(:Component {path: $path})
RETURN d.path AS path, d.title AS title, d.url AS url, d.updated_at AS updatedAt
ORDER BY path

-- COMPONENT_RECENT_PULL_REQUESTS   params: path, limit
MATCH (pr:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(:Component {path: $path})
WITH DISTINCT pr
RETURN pr.number AS number, pr.title AS title, pr.url AS url, pr.created_at AS createdAt
ORDER BY createdAt DESC, number DESC
LIMIT $limit

-- GET_PERSON   params: personId
MATCH (p:Person {id: $personId})
RETURN p.id AS id, p.login AS login, p.name AS name

-- PERSON_COMPONENTS   params: personId
MATCH (:Person {id: $personId})-[k:KNOWS_ABOUT]->(c:Component)
RETURN c.path AS componentPath, k.score AS score, k.share AS share, k.last_active AS lastActive, k.expert AS expert
ORDER BY score DESC, componentPath

-- PERSON_DECISIONS   params: personId
MATCH (:Person {id: $personId})-[:MADE]->(d:Decision)
OPTIONAL MATCH (m:Person)-[:MADE]->(d)
OPTIONAL MATCH (d)-[:SUPERSEDES]->(old:Decision)
RETURN d.id AS id, d.summary AS summary, d.rationale AS rationale, d.status AS status, d.decided_at AS decidedAt, d.source_url AS sourceUrl, collect(DISTINCT m.id) AS madeBy, collect(DISTINCT old.id) AS supersedes
ORDER BY decidedAt, id

-- OPEN_WORK   params: personId
MATCH (:Person {id: $personId})-[:AUTHORED]->(w:PullRequest {state: 'open'})
RETURN 'pr' AS kind, w.number AS number, w.title AS title, w.url AS url
UNION ALL
MATCH (:Person {id: $personId})-[:AUTHORED]->(w:Issue {state: 'open'})
RETURN 'issue' AS kind, w.number AS number, w.title AS title, w.url AS url

-- DEPARTURE_COMPONENTS   params: personId
MATCH (x:Person {id: $personId})-[kx:KNOWS_ABOUT {expert: true}]->(c:Component)
OPTIONAL MATCH (o:Person)-[:KNOWS_ABOUT {expert: true}]->(c)
WHERE o <> x
WITH c, count(o) AS after
RETURN c.path AS path, c.bus_factor AS before, after
ORDER BY after, path

-- DEPARTURE_SUCCESSORS   params: personId, paths
UNWIND $paths AS path
MATCH (p:Person)-[k:KNOWS_ABOUT]->(:Component {path: path})
WHERE p.id <> $personId
WITH path, p, k
ORDER BY k.score DESC, p.id
WITH path, collect({id: p.id, login: p.login, name: p.name, score: k.score, lastActive: k.last_active})[0..3] AS successors
RETURN path, successors

-- DEPARTURE_DECISIONS   params: personId
MATCH (x:Person {id: $personId})-[:MADE]->(d:Decision {status: 'active'})
OPTIONAL MATCH (o:Person)-[:MADE]->(d)
WHERE o <> x
WITH d, count(o) AS others
WHERE others = 0
OPTIONAL MATCH (d)-[:AFFECTS]->(c:Component)
RETURN d.id AS id, d.summary AS summary, d.source_url AS sourceUrl, d.decided_at AS decidedAt, collect(c.path) AS affects
ORDER BY decidedAt, id

-- NEARBY_COLLABORATORS   params: personId
MATCH (x:Person {id: $personId})-[:COLLABORATES_WITH*1..2]->(p:Person)
WHERE p.id <> $personId
WITH DISTINCT x, p
OPTIONAL MATCH (x)-[r:COLLABORATES_WITH]->(p)
RETURN p.id AS id, p.login AS login, p.name AS name, coalesce(r.weight, 0.0) AS weight
ORDER BY weight DESC, id
```

`ORDER BY` inside a `UNION` branch is not used; `OPEN_WORK` is sorted in TypeScript (kind `pr` first, then number).

### Search (F6)

```cypher
-- SEARCH_ALL   params: query
CALL db.idx.fulltext.queryNodes('PullRequest', $query) YIELD node, score
RETURN 'pr' AS kind, toString(node.number) AS key, node.title AS title, node.url AS url, score
ORDER BY score DESC LIMIT 5
UNION ALL
CALL db.idx.fulltext.queryNodes('Issue', $query) YIELD node, score
RETURN 'issue' AS kind, toString(node.number) AS key, node.title AS title, node.url AS url, score
ORDER BY score DESC LIMIT 5
UNION ALL
CALL db.idx.fulltext.queryNodes('Decision', $query) YIELD node, score
RETURN 'decision' AS kind, node.id AS key, node.summary AS title, node.source_url AS url, score
ORDER BY score DESC LIMIT 5
UNION ALL
CALL db.idx.fulltext.queryNodes('Doc', $query) YIELD node, score
RETURN 'doc' AS kind, node.path AS key, node.title AS title, node.url AS url, score
ORDER BY score DESC LIMIT 5

-- TOPIC_COMPONENTS   params: query
CALL db.idx.fulltext.queryNodes('PullRequest', $query) YIELD node, score
MATCH (node)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(c:Component)
WITH DISTINCT c, node, score
RETURN c.path AS path, score, node.title AS title, node.url AS url
UNION ALL
CALL db.idx.fulltext.queryNodes('Issue', $query) YIELD node, score
MATCH (node)<-[:CLOSES]-(:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(c:Component)
WITH DISTINCT c, node, score
RETURN c.path AS path, score, node.title AS title, node.url AS url
UNION ALL
CALL db.idx.fulltext.queryNodes('Decision', $query) YIELD node, score
MATCH (node)-[:AFFECTS]->(c:Component)
RETURN c.path AS path, score, node.summary AS title, node.source_url AS url
UNION ALL
CALL db.idx.fulltext.queryNodes('Doc', $query) YIELD node, score
MATCH (node)-[:DESCRIBES]->(c:Component)
RETURN c.path AS path, score, node.title AS title, node.url AS url
```

If FalkorDB rejects `ORDER BY ... LIMIT` inside a `UNION` branch of `SEARCH_ALL`, split it into four constants `SEARCH_PULL_REQUESTS`, `SEARCH_ISSUES`, `SEARCH_DECISIONS`, `SEARCH_DOCS` (one branch each) and add a `Note:` to the task.

## 8. Shared types and backend functions

### `env.ts`

```ts
export const EnvSchema = z.object({
  FALKORDB_HOST: z.string().min(1).default("localhost"),
  FALKORDB_PORT: z.coerce.number().int().positive().default(6379),
  FALKORDB_USERNAME: z.string().optional(),
  FALKORDB_PASSWORD: z.string().optional(),
  FALKORDB_GRAPH: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/)
    .default("tribal"),
  LLM_BASE_URL: z
    .url()
    .default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GITHUB_TOKEN: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
});
export type Env = z.infer<typeof EnvSchema>;
export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env;
```

`loadEnv` drops entries whose value is an empty string before parsing (so `GITHUB_TOKEN=` counts as unset), then throws a readable error listing invalid variable names (never values).

### `db.ts`

```ts
export type Params = Record<string, unknown>;
export type Db = {
  read<T>(cypher: string, params: Params, row: z.ZodType<T>): Promise<T[]>;
  write(cypher: string, params?: Params): Promise<void>;
  deleteGraph(): Promise<void>;
  close(): Promise<void>;
};
export async function openDb(
  env: Pick<
    Env,
    | "FALKORDB_HOST"
    | "FALKORDB_PORT"
    | "FALKORDB_USERNAME"
    | "FALKORDB_PASSWORD"
  >,
  graphName: string,
): Promise<Db>;
```

- `read` uses `graph.roQuery`, `write` uses `graph.query`. `read` parses every row with `row` and throws on mismatch.
- `deleteGraph` ignores the "graph doesn't exist" error only.

### `datafiles.ts`

```ts
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
export async function readJsonFile<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T>;
export async function readJsonFileOr<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T>;
export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void>;
```

Paths are relative to the repo root; `datafiles.ts` resolves them from its own location (`new URL("../../", import.meta.url)`), so commands work from any working directory. `writeJsonFile` writes `JSON.stringify(value, null, 2) + "\n"`. `readJsonFileOr` returns `fallback` only when the file doesn't exist.

### `components.ts`

```ts
export function componentOf(path: string, config: RepoConfig): string | null;
export function selectComponents(snapshot: Snapshot): string[];
export function componentName(componentPath: string): string;
```

- `componentOf`: `null` if the path starts with any `ignorePrefixes` entry. Otherwise take the directory segments (path without the file name). None → `(root)`. Depth = `componentDepth`, plus 1 if the path starts with `<prefix>/` for any `deeperPrefixes` entry. Return the first `depth` segments joined with `/` (fewer if the path has fewer).
- `selectComponents`: count, for each `componentOf` value, the commits that touch at least one file in it; keep those with at least `minComponentCommits`; return sorted.
- A file whose component isn't selected gets no `PART_OF`.

### `identity.ts`

```ts
export type PersonRow = {
  id: string;
  login: string | null;
  name: string;
};
export type Identities = {
  people: PersonRow[];
  commitAuthor: Map<string, string | null>;
  personIdForLogin(login: string | null): string | null;
};
export function resolveIdentities(snapshot: Snapshot): Identities;
export function nameKey(name: string): string;
```

- A login is a bot if it is in `snapshot.bots` or ends with `[bot]`. A commit is a bot commit if its login is a bot or its `authorName` ends with `[bot]`. Bots never become people.
- `nameKey`: trim, lowercase, collapse whitespace.
- Pass 1: for every non-bot commit with a login, map its email hash and its `nameKey(authorName)` to that login.
- Pass 2, per commit (sorted by `authoredAt`, then `sha`): bot → `null`; login → login; else email hash match → that login; else name match → that login; else `git:<authorEmailHash>` (and record its email hash and name so later commits merge into it).
- People: every non-bot login seen anywhere (commit, PR author, reviewer, issue author, comment author) plus every `git:` id. `name` = most frequent `authorName` among the person's commits (ties: alphabetically first), else the login. `people` sorted by id.
- `personIdForLogin`: the login if it's a non-bot login, else `null`.

### `github.ts`

```ts
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
export async function createRepoSource(
  repo: string,
  token: string | undefined,
  fetchImpl?: typeof fetch,
): Promise<RepoSource>;
export function parseClosingReferences(body: string): number[];
export function nextPageUrl(linkHeader: string | null): string | null;
```

- Raw types are `z.infer` of zod schemas in the same file that keep only the fields used: `GhUser = { login: string; type: string }` (nullable where GitHub allows null); `GhPull = { number, title, body: string | null, state, created_at, updated_at, merged_at: string | null, merge_commit_sha: string | null, html_url, user: GhUser | null }`; `GhReview = { user: GhUser | null, state, submitted_at: string | null }`; `GhIssue = { number, title, body: string | null, state, created_at, closed_at: string | null, html_url, user: GhUser | null, pull_request?: unknown }`; `GhIssueComment = { id, body: string | null, created_at, html_url, issue_url, user: GhUser | null }`; `GhReviewComment = { id, body: string | null, created_at, html_url, pull_request_url, user: GhUser | null }`; `GhCommit = { sha, commit: { message, author: { name, email, date } }, author: GhUser | null, parents: { sha }[], files: { filename, additions, deletions }[] }` (from the single-commit endpoint); `GhDoc = { path, content, updatedAt }` (built by `markdownDocs`, `content` decoded from base64 with `Buffer`).
- Token: `token` argument, else the output of `gh auth token`. Requests send `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
- Pagination: `per_page=100`, follow `rel="next"` in the `Link` header. `pullRequests` uses `state=all&sort=updated&direction=desc` and stops when a page's last item has `updated_at < since`. `issues`, `issueComments`, `reviewComments` pass `since=<since>T00:00:00Z`. Requests are sequential; `fetchImpl` defaults to the global `fetch` (tests pass a fake).
- When a response has status 403 or 429 and `x-ratelimit-remaining: 0`, wait until `x-ratelimit-reset` (plus 1 second) and retry once. Other non-2xx responses throw with the URL and status.
- `commits`: list `GET /repos/<repo>/commits?sha=<branch>&since=<since>T00:00:00Z`, skip entries with more than one parent (merge commits), then `GET /repos/<repo>/commits/<sha>` for each remaining one (one request per commit; the endpoint returns at most 300 files, which is enough). Progress every 50 commits to stderr.
- `markdownDocs`: `GET /repos/<repo>/git/trees/<branch>?recursive=1`, keep `blob` paths ending in `.md` (case-insensitive), at most 200; for each, `GET /repos/<repo>/contents/<path>?ref=<branch>` for the content and `GET /repos/<repo>/commits?sha=<branch>&path=<path>&per_page=1` for `updatedAt` (the first item's `commit.author.date`).
- Request budget for the demo: about 2,100 requests (1,150 reviews, 500 commits, 400 for docs, plus list pages), under the 5,000 per hour limit.
- `parseClosingReferences`: numbers matched by `/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi`, deduplicated, in order of appearance.

### `ingest.ts`

```ts
export const LIMITS = {
  prBody: 2000,
  issueBody: 2000,
  commentBody: 1000,
  docBody: 4000,
  commitMessage: 200,
} as const;
export async function buildSnapshot(
  config: RepoConfig,
  source: RepoSource,
  fetchedAt: Date,
): Promise<Snapshot>;
export function emailHash(email: string): string;
```

- `emailHash` = first 16 hex characters of SHA-256 of the trimmed, lowercased email (`node:crypto`). Raw emails never reach the snapshot.
- Bots: every `GhUser` with `type === "Bot"` or a login ending in `[bot]`, deduplicated and sorted.
- PR `state` = `merged` if `merged_at` is set, else GitHub's `state`. `reviews` skip entries without `submitted_at` or user. `closesIssues` = `parseClosingReferences(body)` filtered to issue numbers in the snapshot.
- Comments: issue comments get `id: "ic-<id>"`, parent number from the end of `issue_url`, kind `pr` if that number is a PR in the snapshot, `issue` if it is an issue, otherwise dropped. Review comments get `id: "rc-<id>"`, kind `pr`, number from `pull_request_url`; dropped if that PR isn't in the snapshot.
- Commits: `authorLogin` = `author.login` (`null` if no linked account); `authorName` and `authoredAt` from `commit.author`; `message` = first line of `commit.message` cut to `LIMITS.commitMessage`; `files` from `filename`, `additions`, `deletions`; `url` = `https://github.com/<repo>/commit/<sha>`; files under `ignorePrefixes` are kept (the loader ignores them).
- Docs: skip paths under `ignorePrefixes`; `title` from the first `# ` line, else the file name; `body` cut to `LIMITS.docBody`.
- All dates normalised with `new Date(x).toISOString()`. Arrays sorted: commits by `authoredAt` then `sha`; PRs and issues by number; comments by `createdAt` then `id`; docs by path.

### `load.ts`

```ts
export async function loadSnapshot(
  db: Db,
  snapshot: Snapshot,
  decisions: DecisionCache,
): Promise<LoadSummary>;
export type LoadSummary = { nodes: number; seconds: number };
export function docComponents(
  doc: Snapshot["docs"][number],
  components: string[],
  config: RepoConfig,
): string[];
```

Order: `deleteGraph` → `CREATE_INDEXES` → `CREATE_FULLTEXT_INDEXES` → people, components, files, commits, modifies, PRs, contains, reviews, issues, closes, PR comments, issue comments, docs, decisions (PR and issue), made, affects, supersedes, `SET_DECISION_STATUS` → `computeExpertise(db, Date.parse(snapshot.fetchedAt))` → `COUNT_NODES`.

- Files: every distinct path in commits that `componentOf` doesn't return `null` for.
- Reviews: one row per (reviewer, PR) with the latest `submittedAt`; reviewers who are bots or the PR's author are skipped.
- `docComponents`: the doc's own component (if selected) plus every selected component whose path appears in the doc body, deduplicated and sorted.
- Decisions: from every cache entry whose thread exists in the snapshot. `madeBy` logins map to person ids with `personIdForLogin`; unknown ones are skipped. `affects` entries that aren't selected components are skipped. `supersedes` ids that aren't loaded are skipped.

### `expertise.ts`

```ts
export const SCORING = { ... } as const;
export async function computeExpertise(db: Db, now: number): Promise<void>;
```

Runs, in order: `DELETE_KNOWS_ABOUT`, `ADD_COMMIT_EXPERTISE`, `ADD_AUTHORED_PR_EXPERTISE`, `ADD_REVIEW_EXPERTISE`, `ADD_PR_COMMENT_EXPERTISE`, `ADD_ISSUE_COMMENT_EXPERTISE`, `MARK_EXPERTS`, `SET_BUS_FACTOR`, `DELETE_COLLABORATION`, `ADD_REVIEW_COLLABORATION`, `ADD_SHARED_EXPERTISE_COLLABORATION`.

### `schemas.ts`

```ts
export const RiskLevelSchema = z.enum([
  "orphaned",
  "critical",
  "at_risk",
  "healthy",
]);
export const PersonRefSchema = z.object({
  id: z.string(),
  login: z.string().nullable(),
  name: z.string(),
});
export const ComponentSummarySchema = z.object({
  path: z.string(),
  name: z.string(),
  busFactor: z.number().int(),
  risk: RiskLevelSchema,
});
export const RiskMapLinkSchema = z.object({
  personId: z.string(),
  componentPath: z.string(),
  score: z.number(),
  share: z.number(),
  expert: z.boolean(),
});
export const RiskMapSchema = z.object({
  people: z.array(PersonRefSchema),
  components: z.array(ComponentSummarySchema),
  links: z.array(RiskMapLinkSchema),
});
export const ExpertiseSchema = z.object({
  person: PersonRefSchema,
  score: z.number(),
  share: z.number(),
  lastActive: z.string(),
  expert: z.boolean(),
});
export const DecisionViewSchema = z.object({
  id: z.string(),
  summary: z.string(),
  rationale: z.string(),
  status: z.enum(["active", "superseded"]),
  decidedAt: z.string(),
  sourceUrl: z.string(),
  madeBy: z.array(z.string()),
  supersedes: z.array(z.string()),
});
export const DocRefSchema = z.object({
  path: z.string(),
  title: z.string(),
  url: z.string(),
  updatedAt: z.string(),
});
export const PullRequestRefSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
  createdAt: z.string(),
});
export const ComponentDetailSchema = z.object({
  component: ComponentSummarySchema,
  experts: z.array(ExpertiseSchema),
  decisions: z.array(DecisionViewSchema),
  docs: z.array(DocRefSchema),
  recentPullRequests: z.array(PullRequestRefSchema),
});
export const WorkItemSchema = z.object({
  kind: z.enum(["pr", "issue"]),
  number: z.number().int(),
  title: z.string(),
  url: z.string(),
});
export const PersonComponentSchema = z.object({
  componentPath: z.string(),
  score: z.number(),
  share: z.number(),
  lastActive: z.string(),
  expert: z.boolean(),
});
export const PersonDetailSchema = z.object({
  person: PersonRefSchema,
  components: z.array(PersonComponentSchema),
  decisions: z.array(DecisionViewSchema),
  openWork: z.array(WorkItemSchema),
});
export const SuccessorSchema = z.object({
  person: PersonRefSchema,
  score: z.number(),
  lastActive: z.string(),
});
export const AffectedComponentSchema = z.object({
  path: z.string(),
  busFactorBefore: z.number().int(),
  busFactorAfter: z.number().int(),
  riskAfter: RiskLevelSchema,
  successors: z.array(SuccessorSchema),
});
export const OrphanedDecisionSchema = z.object({
  id: z.string(),
  summary: z.string(),
  sourceUrl: z.string(),
  decidedAt: z.string(),
  affects: z.array(z.string()),
});
export const CollaboratorSchema = z.object({
  person: PersonRefSchema,
  weight: z.number(),
});
export const DepartureReportSchema = z.object({
  person: PersonRefSchema,
  affectedComponents: z.array(AffectedComponentSchema),
  orphaned: z.array(z.string()),
  critical: z.array(z.string()),
  decisionsLosingOwner: z.array(OrphanedDecisionSchema),
  openWork: z.array(WorkItemSchema),
  nearbyCollaborators: z.array(CollaboratorSchema),
});
export const RankedPersonSchema = z.object({
  person: PersonRefSchema,
  pageRank: z.number(),
  betweenness: z.number(),
});
export const TeamRankingSchema = z.array(RankedPersonSchema);
export const SearchHitSchema = z.object({
  kind: z.enum(["pr", "issue", "decision", "doc"]),
  key: z.string(),
  title: z.string(),
  url: z.string(),
  score: z.number(),
});
export const SourceSchema = z.object({ title: z.string(), url: z.string() });
export const NodeKindSchema = z.enum([
  "person",
  "component",
  "decision",
  "pr",
  "issue",
  "doc",
]);
export const GraphPathSchema = z.object({
  nodes: z.array(
    z.object({ id: z.string(), kind: NodeKindSchema, label: z.string() }),
  ),
  links: z.array(
    z.object({ source: z.string(), target: z.string(), type: z.string() }),
  ),
});
export const TopicComponentSchema = z.object({
  path: z.string(),
  relevance: z.number(),
  experts: z.array(ExpertiseSchema),
});
export const WhoKnowsSchema = z.object({
  components: z.array(TopicComponentSchema),
  sources: z.array(SourceSchema),
});
export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});
export const AskRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(ChatTurnSchema).max(10),
});
export const AskResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(SourceSchema),
  path: GraphPathSchema,
  toolCalls: z.array(z.string()),
});
export const PersonIdRequestSchema = z.object({
  personId: z.string().min(1).max(200),
});
export const HandoverPlanSchema = z.object({
  person: PersonRefSchema,
  summary: z.string(),
  knowledgeToDocument: z.array(
    z.object({ componentPath: z.string(), reason: z.string() }),
  ),
  pairings: z.array(
    z.object({
      componentPath: z.string(),
      with: PersonRefSchema,
      reason: z.string(),
    }),
  ),
  decisionsNeedingOwner: z.array(
    z.object({
      decisionId: z.string(),
      summary: z.string(),
      sourceUrl: z.string(),
      suggestedOwner: PersonRefSchema.nullable(),
    }),
  ),
  workToReassign: z.array(
    z.object({
      kind: z.enum(["pr", "issue"]),
      number: z.number().int(),
      title: z.string(),
      url: z.string(),
      suggestedOwner: PersonRefSchema.nullable(),
    }),
  ),
});
export const HandoverResponseSchema = z.object({
  plan: HandoverPlanSchema,
  markdown: z.string(),
  issueTitle: z.string(),
  issueBody: z.string(),
  generatedBy: z.enum(["cache", "llm", "template"]),
});
export function riskLevel(busFactor: number): RiskLevel;
export function toIso(epochMs: number): string;
```

Each schema also exports its inferred type with the same name minus `Schema` (for example `export type DepartureReport = z.infer<typeof DepartureReportSchema>`), but only for types that are used.

Graph path node ids: `person:<id>`, `component:<path>`, `decision:<id>`, `pr:<number>`, `issue:<number>`, `doc:<path>`.

### `risk.ts`

```ts
export async function countNodes(db: Db): Promise<number>;
export async function listComponents(db: Db): Promise<ComponentSummary[]>;
export async function getRiskMap(db: Db): Promise<RiskMap>;
export async function getTeamRanking(db: Db): Promise<TeamRanking>;
export async function getComponent(
  db: Db,
  path: string,
): Promise<ComponentDetail | null>;
export async function getPerson(
  db: Db,
  personId: string,
): Promise<PersonDetail | null>;
export async function simulateDeparture(
  db: Db,
  personId: string,
): Promise<DepartureReport | null>;
export async function getDecisionHistory(
  db: Db,
  componentPath: string,
): Promise<DecisionView[]>;
```

- `getRiskMap`: components from `LIST_COMPONENTS`; links from `RISK_MAP_LINKS` with `minShare = SCORING.riskMapMinShare`; people = distinct people in the links, sorted by id.
- `getTeamRanking`: join `TEAM_PAGERANK` and `TEAM_BETWEENNESS` by id (betweenness 0 if missing), sort by `pageRank` descending, then id.
- `getComponent`: `GET_COMPONENT` (null if no row), `COMPONENT_EXPERTS` with `limit 10`, `COMPONENT_DECISIONS`, `COMPONENT_DOCS`, `COMPONENT_RECENT_PULL_REQUESTS` with `limit 5`.
- `getPerson`: `GET_PERSON` (null if no row), `PERSON_COMPONENTS`, `PERSON_DECISIONS`, `OPEN_WORK`.
- `simulateDeparture`: `GET_PERSON` (null if no row), `DEPARTURE_COMPONENTS`, `DEPARTURE_SUCCESSORS` with the affected paths (skip the query if none), `DEPARTURE_DECISIONS`, `OPEN_WORK`, `NEARBY_COLLABORATORS`. `orphaned` and `critical` are the paths with `busFactorAfter` 0 and 1, in the order of `affectedComponents`.
- `getDecisionHistory`: `COMPONENT_DECISIONS`.

### `search.ts`

```ts
export function toFullTextQuery(text: string): string;
export async function search(db: Db, text: string): Promise<SearchHit[]>;
export async function whoKnows(db: Db, topic: string): Promise<WhoKnows>;
```

- `search`: at most 5 hits per kind; results sorted by score descending, then kind, then key.
- `whoKnows`: rows from `TOPIC_COMPONENTS`, deduplicated by (path, url); relevance per path = sum of scores; top 3 paths by relevance (ties by path); for each, `COMPONENT_EXPERTS` with `limit 5`; sources = distinct (title, url) of the rows for those paths, at most 10.

### `llm.ts`

```ts
export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };
export type LlmToolCall = { id: string; name: string; arguments: string };
export type LlmTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};
export type Llm = {
  model: string;
  json<T>(
    messages: LlmMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
  ): Promise<T>;
  chat(
    messages: LlmMessage[],
    tools: LlmTool[],
  ): Promise<{ content: string | null; toolCalls: LlmToolCall[] }>;
};
export class RateLimitError extends Error {}
export function createLlm(
  env: Pick<Env, "LLM_BASE_URL" | "LLM_API_KEY" | "LLM_MODEL">,
  options?: { fetch?: typeof fetch; maxRetries?: number },
): Llm | null;
export function toJsonSchema(schema: z.ZodType): Record<string, unknown>;
```

- Returns `null` when `LLM_API_KEY` is unset.
- Uses `new OpenAI({ baseURL, apiKey, maxRetries: options.maxRetries ?? 3, fetch: options.fetch })`.
- `json`: `chat.completions.create` with `response_format: { type: "json_schema", json_schema: { name: schemaName, schema: toJsonSchema(schema), strict: true } }`, then `JSON.parse` of the message content and `schema.parse`. Invalid output throws an `Error` that includes `schemaName`.
- `chat`: `tools` mapped to `{ type: "function", function: { name, description, parameters } }`, `tool_choice: "auto"` (omit both when `tools` is empty).
- `toJsonSchema`: `z.toJSONSchema(schema)` with the top-level `$schema` key removed.
- An OpenAI `RateLimitError` (HTTP 429) after retries is rethrown as our `RateLimitError`.

### `decisions.ts`

```ts
export type Thread = {
  key: string;
  kind: "pr" | "issue";
  number: number;
  title: string;
  body: string;
  createdAt: string;
  url: string;
  participants: string[];
  components: string[];
  comments: { author: string; createdAt: string; body: string }[];
};
export const DECISION_HINT: RegExp;
export function buildThreads(snapshot: Snapshot): Thread[];
export function selectCandidateThreads(
  threads: Thread[],
  max: number,
): Thread[];
export function threadHash(thread: Thread, model: string): string;
export async function extractDecisions(input: {
  snapshot: Snapshot;
  cache: DecisionCache;
  llm: Llm;
  onBatch(cache: DecisionCache): Promise<void>;
  sleep?(ms: number): Promise<void>;
}): Promise<DecisionCache>;
export const ExtractionSchema: z.ZodType<Extraction>;
```

Specified in task 4.2.

### `handover.ts`, `tools.ts`, `agent.ts`

Specified in tasks 5.1 to 5.3.

## 9. API routes

All routes live in `app.ts`, chained on one `Hono` instance so the type is inferred:

```ts
export type AppDeps = { db: Db; llm: Llm | null; webOrigin: string };
export function createApp(deps: AppDeps) {
  return new Hono()
    .use("/api/*", cors({ origin: deps.webOrigin }))
    .get("/api/health", ...)
    ...;
}
export type AppType = ReturnType<typeof createApp>;
```

| Method | Path             | Request (validated with `@hono/zod-validator`) | Response 200                  | Errors                                                                                | Task |
| ------ | ---------------- | ---------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- | ---- |
| GET    | `/api/health`    |                                                | `{ ok: true, nodes: number }` |                                                                                       | 1.4  |
| GET    | `/api/risk-map`  |                                                | `RiskMap`                     |                                                                                       | 3.4  |
| GET    | `/api/ranking`   |                                                | `TeamRanking`                 |                                                                                       | 3.4  |
| GET    | `/api/component` | query `{ path: string }`                       | `ComponentDetail`             | 404 `{ error: "not_found" }`                                                          | 3.4  |
| POST   | `/api/simulate`  | json `PersonIdRequest`                         | `DepartureReport`             | 404 `{ error: "not_found" }`                                                          | 3.3  |
| POST   | `/api/handover`  | json `PersonIdRequest`                         | `HandoverResponse`            | 404 `{ error: "not_found" }`                                                          | 5.3  |
| POST   | `/api/ask`       | json `AskRequest`                              | `AskResponse`                 | 429 `{ error: "rate_limited", message }`, 503 `{ error: "llm_unavailable", message }` | 5.2  |

Validation failures return Hono's default 400. Routes return `c.json(value)` with the value typed by the schema's inferred type.

The web client (`web/src/api.ts`):

```ts
import { hc } from "hono/client";
import type { AppType } from "../../backend/src/app";
export const api = hc<AppType>(import.meta.env.VITE_API_URL ?? "/");
```

Calls look like `await api.api["risk-map"].$get()`, `await api.api.component.$get({ query: { path } })`, `await api.api.simulate.$post({ json: { personId } })`. `web/tsconfig.json` gets `"references": [{ "path": "../backend" }]` so TypeScript uses the backend's declaration output. In dev, Vite proxies `/api` to `http://localhost:3000`.

## 10. MCP tools

Defined once in `tools.ts`; `agent.ts` and `mcp.ts` both use the exported `tools` array. Each tool returns `ToolResult = { data: unknown; sources: Source[]; path: GraphPath }`. Over MCP the result is returned as one text content item containing `JSON.stringify(result)`.

| Name                 | Description (exact string)                                                                                                                 | Input                               | `data`                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------- |
| `search`             | "Full-text search over pull requests, issues, decisions and docs. Use short keywords."                                                     | `{ query: string (1-200) }`         | `SearchHit[]`          |
| `who_knows`          | "Find the components related to a topic and the people who know them best."                                                                | `{ topic: string (1-200) }`         | `WhoKnows`             |
| `bus_factor`         | "List every component with its bus factor (number of active experts) and risk level, riskiest first."                                      | `{}`                                | `ComponentSummary[]`   |
| `get_component`      | "Get one component: its experts, decisions, docs and recent pull requests. Paths look like src/commands."                                  | `{ path: string (1-200) }`          | `ComponentDetail`      |
| `get_person`         | "Get one person by GitHub login: the components they know, decisions they made and their open work."                                       | `{ personId: string (1-200) }`      | `PersonDetail`         |
| `simulate_departure` | "Simulate a person leaving: components that lose experts, decisions losing their only owner, stranded open work and suggested successors." | `{ personId: string (1-200) }`      | `DepartureReport`      |
| `team_ranking`       | "Rank people by how central they are to collaboration (PageRank and betweenness)."                                                         | `{}`                                | `TeamRanking` (top 15) |
| `decision_history`   | "List the decisions affecting a component, oldest first, including which ones superseded others."                                          | `{ componentPath: string (1-200) }` | `DecisionView[]`       |

Unknown person or component → `data: { error: "not_found" }`, empty sources and path.

## 11. Frontend

One page, three screens chosen by the URL hash (`#risk` default, `#simulate`, `#ask`). No router library.

| Screen / component | Calls                                              | Behaviour                                                                                                                                                                 |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App`              |                                                    | Header with the name and repo, `<nav>` with three buttons (`aria-current="page"` on the active one), screen                                                               |
| `RiskMapScreen`    | `GET /api/risk-map`, `GET /api/ranking`            | Graph of people and components (components coloured by risk), components table sorted riskiest first, team ranking table; selecting a component opens `ComponentPanel`    |
| `ComponentPanel`   | `GET /api/component`                               | Experts with share, decisions (status, link), docs, recent PRs                                                                                                            |
| `SimulationScreen` | `GET /api/risk-map` (people), `POST /api/simulate` | Person select + Simulate button, counts summary, before/after table with successors, decisions, open work, collaborators, graph with Before/After toggle, `HandoverPanel` |
| `HandoverPanel`    | `POST /api/handover`                               | Plan sections, generatedBy label, Copy markdown, Copy issue text                                                                                                          |
| `AskScreen`        | `POST /api/ask`                                    | Question form, example questions, answers, `SourcesList`, `GraphView` of the latest answer's path, clear 429/503 messages                                                 |
| `GraphView`        |                                                    | `react-force-graph-2d`; props: nodes, links, highlighted ids, onNodeClick; `aria-label` describing the graph                                                              |

Accessibility: every graph has an equivalent table or list with buttons, so the screen works with a keyboard and a screen reader; risk is always shown as text, not only colour; visible focus rings (Tailwind `focus-visible:ring-2`); form fields have labels; colours meet WCAG AA contrast on white.

Colours (`colors.ts`): orphaned `#b91c1c`, critical `#c2410c`, at_risk `#a16207`, healthy `#15803d`, person `#475569`, decision `#6d28d9`, pr and issue `#1d4ed8`, doc `#0f766e`, highlight ring `#111827`, dimmed `#cbd5e1`.

## 12. Data files and the fixture

### `data/config.json` (demo)

```json
{
  "repo": "FalkorDB/FalkorDB",
  "since": "2025-04-16",
  "componentDepth": 2,
  "deeperPrefixes": ["graph/src"],
  "ignorePrefixes": ["deps/", "build/graphblas/"],
  "minComponentCommits": 8,
  "maxDecisionThreads": 300
}
```

### Fixture

Synthetic repo `tribal-fixture/shop`: 5 people, 6 components, 20 commits, 8 PRs, 6 issues, 7 comments, 3 docs, 3 decisions. `fetchedAt` (now) is `2026-10-01T00:00:00.000Z`. Activity dates are exactly 0, 180, 360 or 540 days earlier (`2026-10-01`, `2026-04-04`, `2025-10-06`, `2025-04-09`), so decay factors are 1, 0.5, 0.25 and 0.125.

It exercises: email-hash merging (commit `c18…` has no login but Dave's email hash), name merging (commit `c19…` has no login, an unknown email hash and the name `" carol  diaz "`), a bot commit (`c20…`, dependabot), an ignored prefix (`vendor/`), components dropped by `minComponentCommits` (`scripts`, `(root)`), a review deduplicated to the latest (PR 4), closing references (PR 2 → issue 9, PR 6 → issue 11), comments on PRs and issues, a superseded decision, an open PR and open issues.

`data/fixture/snapshot.json`, copied exactly:

```json
{
  "fetchedAt": "2026-10-01T00:00:00.000Z",
  "defaultBranch": "main",
  "config": {
    "repo": "tribal-fixture/shop",
    "since": "2025-01-01",
    "componentDepth": 2,
    "deeperPrefixes": [],
    "ignorePrefixes": ["vendor/"],
    "minComponentCommits": 2,
    "maxDecisionThreads": 10
  },
  "bots": ["dependabot[bot]"],
  "commits": [
    {
      "sha": "c010000000000000000000000000000000000000",
      "message": "Add connection pool",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c010000000000000000000000000000000000000",
      "authorLogin": "alice",
      "authorName": "Alice Ng",
      "authorEmailHash": "e1a1",
      "files": [{ "path": "src/db/pool.ts", "additions": 5, "deletions": 2 }]
    },
    {
      "sha": "c020000000000000000000000000000000000000",
      "message": "Use one pool for all queries",
      "authoredAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c020000000000000000000000000000000000000",
      "authorLogin": "alice",
      "authorName": "Alice Ng",
      "authorEmailHash": "e1a1",
      "files": [{ "path": "src/db/schema.ts", "additions": 10, "deletions": 5 }]
    },
    {
      "sha": "c030000000000000000000000000000000000000",
      "message": "Create initial schema",
      "authoredAt": "2025-04-09T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c030000000000000000000000000000000000000",
      "authorLogin": "bob",
      "authorName": "Bob Okafor",
      "authorEmailHash": "e2b2",
      "files": [
        { "path": "src/db/schema.ts", "additions": 20, "deletions": 11 }
      ]
    },
    {
      "sha": "c040000000000000000000000000000000000000",
      "message": "Fix route order",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c040000000000000000000000000000000000000",
      "authorLogin": "alice",
      "authorName": "Alice Ng",
      "authorEmailHash": "e1a1",
      "files": [{ "path": "src/api/routes.ts", "additions": 2, "deletions": 1 }]
    },
    {
      "sha": "c050000000000000000000000000000000000000",
      "message": "Add health route",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c050000000000000000000000000000000000000",
      "authorLogin": "bob",
      "authorName": "Bob Okafor",
      "authorEmailHash": "e2b2",
      "files": [{ "path": "src/api/routes.ts", "additions": 4, "deletions": 3 }]
    },
    {
      "sha": "c060000000000000000000000000000000000000",
      "message": "Switch to cursor pagination",
      "authoredAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c060000000000000000000000000000000000000",
      "authorLogin": "bob",
      "authorName": "Bob Okafor",
      "authorEmailHash": "e2b2",
      "files": [
        { "path": "src/api/pagination.ts", "additions": 12, "deletions": 3 }
      ]
    },
    {
      "sha": "c070000000000000000000000000000000000000",
      "message": "Add offset pagination",
      "authoredAt": "2025-10-06T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c070000000000000000000000000000000000000",
      "authorLogin": "alice",
      "authorName": "Alice Ng",
      "authorEmailHash": "e1a1",
      "files": [
        { "path": "src/api/pagination.ts", "additions": 6, "deletions": 1 }
      ]
    },
    {
      "sha": "c080000000000000000000000000000000000000",
      "message": "Add login form handler",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c080000000000000000000000000000000000000",
      "authorLogin": "carol",
      "authorName": "Carol Diaz",
      "authorEmailHash": "e3c3",
      "files": [
        { "path": "src/auth/login.ts", "additions": 10, "deletions": 5 }
      ]
    },
    {
      "sha": "c090000000000000000000000000000000000000",
      "message": "Store sessions in cookies",
      "authoredAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c090000000000000000000000000000000000000",
      "authorLogin": "carol",
      "authorName": "Carol Diaz",
      "authorEmailHash": "e3c3",
      "files": [
        { "path": "src/auth/session.ts", "additions": 5, "deletions": 2 }
      ]
    },
    {
      "sha": "c100000000000000000000000000000000000000",
      "message": "Add app shell",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c100000000000000000000000000000000000000",
      "authorLogin": "dave",
      "authorName": "Dave Kim",
      "authorEmailHash": "e4d4",
      "files": [{ "path": "src/ui/app.tsx", "additions": 3, "deletions": 0 }]
    },
    {
      "sha": "c110000000000000000000000000000000000000",
      "message": "Add focus ring to buttons",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c110000000000000000000000000000000000000",
      "authorLogin": "erin",
      "authorName": "Erin Walsh",
      "authorEmailHash": "e5e5",
      "files": [{ "path": "src/ui/button.tsx", "additions": 5, "deletions": 2 }]
    },
    {
      "sha": "c120000000000000000000000000000000000000",
      "message": "Darken link colour",
      "authoredAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c120000000000000000000000000000000000000",
      "authorLogin": "carol",
      "authorName": "Carol Diaz",
      "authorEmailHash": "e3c3",
      "files": [{ "path": "src/ui/theme.css", "additions": 2, "deletions": 1 }]
    },
    {
      "sha": "c130000000000000000000000000000000000000",
      "message": "Add routing",
      "authoredAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c130000000000000000000000000000000000000",
      "authorLogin": "dave",
      "authorName": "Dave Kim",
      "authorEmailHash": "e4d4",
      "files": [{ "path": "src/ui/app.tsx", "additions": 10, "deletions": 5 }]
    },
    {
      "sha": "c140000000000000000000000000000000000000",
      "message": "Document the pool",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c140000000000000000000000000000000000000",
      "authorLogin": "alice",
      "authorName": "Alice Ng",
      "authorEmailHash": "e1a1",
      "files": [{ "path": "docs/db.md", "additions": 2, "deletions": 1 }]
    },
    {
      "sha": "c150000000000000000000000000000000000000",
      "message": "Write the UI guide",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c150000000000000000000000000000000000000",
      "authorLogin": "erin",
      "authorName": "Erin Walsh",
      "authorEmailHash": "e5e5",
      "files": [{ "path": "docs/ui.md", "additions": 5, "deletions": 2 }]
    },
    {
      "sha": "c160000000000000000000000000000000000000",
      "message": "Add API and UI tests",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c160000000000000000000000000000000000000",
      "authorLogin": "dave",
      "authorName": "Dave Kim",
      "authorEmailHash": "e4d4",
      "files": [
        { "path": "tests/api.test.ts", "additions": 1, "deletions": 0 },
        { "path": "tests/ui.test.ts", "additions": 1, "deletions": 1 }
      ]
    },
    {
      "sha": "c170000000000000000000000000000000000000",
      "message": "Test buttons, vendor lib",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c170000000000000000000000000000000000000",
      "authorLogin": "erin",
      "authorName": "Erin Walsh",
      "authorEmailHash": "e5e5",
      "files": [
        { "path": "tests/ui.test.ts", "additions": 3, "deletions": 0 },
        { "path": "vendor/lib.js", "additions": 100, "deletions": 0 }
      ]
    },
    {
      "sha": "c180000000000000000000000000000000000000",
      "message": "Add db test",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c180000000000000000000000000000000000000",
      "authorLogin": null,
      "authorName": "D. Kim",
      "authorEmailHash": "e4d4",
      "files": [{ "path": "tests/db.test.ts", "additions": 1, "deletions": 0 }]
    },
    {
      "sha": "c190000000000000000000000000000000000000",
      "message": "Add auth test",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c190000000000000000000000000000000000000",
      "authorLogin": null,
      "authorName": " carol  diaz ",
      "authorEmailHash": "e9c9",
      "files": [
        { "path": "tests/auth.test.ts", "additions": 3, "deletions": 0 }
      ]
    },
    {
      "sha": "c200000000000000000000000000000000000000",
      "message": "Bump release script",
      "authoredAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/commit/c200000000000000000000000000000000000000",
      "authorLogin": "dependabot[bot]",
      "authorName": "dependabot[bot]",
      "authorEmailHash": "e0b0",
      "files": [
        { "path": "scripts/release.sh", "additions": 1, "deletions": 1 },
        { "path": "README.md", "additions": 1, "deletions": 0 }
      ]
    }
  ],
  "pullRequests": [
    {
      "number": 1,
      "title": "Add connection pool",
      "body": "Adds a pool to src/db.",
      "state": "merged",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "mergedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/1",
      "authorLogin": "alice",
      "mergeCommitSha": "c010000000000000000000000000000000000000",
      "closesIssues": [],
      "reviews": [
        {
          "reviewerLogin": "carol",
          "state": "APPROVED",
          "submittedAt": "2026-10-01T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 2,
      "title": "Switch to cursor pagination",
      "body": "Replaces offset pagination. Fixes #9",
      "state": "merged",
      "createdAt": "2026-04-04T00:00:00.000Z",
      "mergedAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/2",
      "authorLogin": "bob",
      "mergeCommitSha": "c060000000000000000000000000000000000000",
      "closesIssues": [9],
      "reviews": [
        {
          "reviewerLogin": "alice",
          "state": "APPROVED",
          "submittedAt": "2026-04-04T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 3,
      "title": "Use one pool for all queries",
      "body": "Opening a connection per request is too slow.",
      "state": "merged",
      "createdAt": "2026-04-04T00:00:00.000Z",
      "mergedAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/3",
      "authorLogin": "alice",
      "mergeCommitSha": "c020000000000000000000000000000000000000",
      "closesIssues": [],
      "reviews": [
        {
          "reviewerLogin": "dave",
          "state": "COMMENTED",
          "submittedAt": "2026-04-04T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 4,
      "title": "Add login form handler",
      "body": "Handles the login form.",
      "state": "merged",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "mergedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/4",
      "authorLogin": "carol",
      "mergeCommitSha": "c080000000000000000000000000000000000000",
      "closesIssues": [],
      "reviews": [
        {
          "reviewerLogin": "alice",
          "state": "CHANGES_REQUESTED",
          "submittedAt": "2026-04-04T00:00:00.000Z"
        },
        {
          "reviewerLogin": "alice",
          "state": "APPROVED",
          "submittedAt": "2026-10-01T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 5,
      "title": "Add app shell",
      "body": "Adds the app shell.",
      "state": "merged",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "mergedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/5",
      "authorLogin": "dave",
      "mergeCommitSha": "c100000000000000000000000000000000000000",
      "closesIssues": [],
      "reviews": [
        {
          "reviewerLogin": "erin",
          "state": "APPROVED",
          "submittedAt": "2026-10-01T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 6,
      "title": "Add focus ring to buttons",
      "body": "Fixes #11",
      "state": "merged",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "mergedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/6",
      "authorLogin": "erin",
      "mergeCommitSha": "c110000000000000000000000000000000000000",
      "closesIssues": [11],
      "reviews": [
        {
          "reviewerLogin": "dave",
          "state": "APPROVED",
          "submittedAt": "2026-10-01T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 7,
      "title": "Document the pool",
      "body": "Docs for src/db.",
      "state": "merged",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "mergedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/7",
      "authorLogin": "alice",
      "mergeCommitSha": "c140000000000000000000000000000000000000",
      "closesIssues": [],
      "reviews": [
        {
          "reviewerLogin": "erin",
          "state": "APPROVED",
          "submittedAt": "2026-10-01T00:00:00.000Z"
        }
      ]
    },
    {
      "number": 8,
      "title": "Add read replicas to the db layer",
      "body": "Work in progress.",
      "state": "open",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "mergedAt": null,
      "url": "https://github.com/tribal-fixture/shop/pull/8",
      "authorLogin": "alice",
      "mergeCommitSha": null,
      "closesIssues": [],
      "reviews": []
    }
  ],
  "issues": [
    {
      "number": 9,
      "title": "Offset pagination is slow on large tables",
      "body": "List endpoints time out on big tables.",
      "state": "closed",
      "createdAt": "2025-10-06T00:00:00.000Z",
      "closedAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/9",
      "authorLogin": "bob"
    },
    {
      "number": 10,
      "title": "Session tokens expire too early",
      "body": "Users get logged out after five minutes.",
      "state": "open",
      "createdAt": "2026-04-04T00:00:00.000Z",
      "closedAt": null,
      "url": "https://github.com/tribal-fixture/shop/issues/10",
      "authorLogin": "carol"
    },
    {
      "number": 11,
      "title": "Button focus ring missing",
      "body": "Keyboard users cannot see focus.",
      "state": "closed",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "closedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/11",
      "authorLogin": "erin"
    },
    {
      "number": 12,
      "title": "Document the connection pool settings",
      "body": "Pool size and timeouts are undocumented.",
      "state": "open",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "closedAt": null,
      "url": "https://github.com/tribal-fixture/shop/issues/12",
      "authorLogin": "alice"
    },
    {
      "number": 13,
      "title": "Flaky UI test",
      "body": "The app shell test fails sometimes.",
      "state": "closed",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "closedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/13",
      "authorLogin": "dave"
    },
    {
      "number": 14,
      "title": "Rate limit the public API",
      "body": "We need per-key limits.",
      "state": "open",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "closedAt": null,
      "url": "https://github.com/tribal-fixture/shop/issues/14",
      "authorLogin": "bob"
    }
  ],
  "comments": [
    {
      "id": "ic-1",
      "body": "We chose offset pagination last year because it was simple.",
      "createdAt": "2025-10-06T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/9#ic-1",
      "authorLogin": "alice",
      "parent": { "kind": "issue", "number": 9 }
    },
    {
      "id": "ic-2",
      "body": "Decision: switch list endpoints to cursor pagination instead of offset.",
      "createdAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/9#ic-2",
      "authorLogin": "bob",
      "parent": { "kind": "issue", "number": 9 }
    },
    {
      "id": "ic-3",
      "body": "Agreed, cursors scale better. Offset pagination is superseded.",
      "createdAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/9#ic-3",
      "authorLogin": "alice",
      "parent": { "kind": "issue", "number": 9 }
    },
    {
      "id": "rc-1",
      "body": "Decision: use one shared pool instead of a connection per request.",
      "createdAt": "2026-04-04T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/3#rc-1",
      "authorLogin": "alice",
      "parent": { "kind": "pr", "number": 3 }
    },
    {
      "id": "ic-4",
      "body": "Looks good to me.",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/5#ic-4",
      "authorLogin": "erin",
      "parent": { "kind": "pr", "number": 5 }
    },
    {
      "id": "ic-5",
      "body": "Retrying fixed it locally.",
      "createdAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/issues/13#ic-5",
      "authorLogin": "dave",
      "parent": { "kind": "issue", "number": 13 }
    },
    {
      "id": "rc-2",
      "body": "Please validate the email field.",
      "createdAt": "2025-10-06T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/pull/4#rc-2",
      "authorLogin": "bob",
      "parent": { "kind": "pr", "number": 4 }
    }
  ],
  "docs": [
    {
      "path": "docs/db.md",
      "title": "Database layer",
      "body": "How src/db manages connections and the pool.",
      "updatedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/blob/main/docs/db.md"
    },
    {
      "path": "docs/ui.md",
      "title": "UI guide",
      "body": "Components in src/ui and the theme.",
      "updatedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/blob/main/docs/ui.md"
    },
    {
      "path": "README.md",
      "title": "Shop",
      "body": "A small shop. The HTTP API lives in src/api.",
      "updatedAt": "2026-10-01T00:00:00.000Z",
      "url": "https://github.com/tribal-fixture/shop/blob/main/README.md"
    }
  ]
}
```

`data/fixture/decisions.json`, copied exactly:

```json
{
  "entries": [
    {
      "threadKey": "issue-9",
      "contentHash": "fixture",
      "decisions": [
        {
          "id": "issue-9-1",
          "summary": "Use offset pagination for list endpoints",
          "rationale": "It was the simplest option.",
          "decidedAt": "2025-10-06T00:00:00.000Z",
          "madeBy": ["alice"],
          "affects": ["src/api"],
          "supersedes": [],
          "confidence": 0.8
        },
        {
          "id": "issue-9-2",
          "summary": "Use cursor pagination for list endpoints",
          "rationale": "Offset pagination is slow on large tables.",
          "decidedAt": "2026-04-04T00:00:00.000Z",
          "madeBy": ["bob", "alice"],
          "affects": ["src/api"],
          "supersedes": ["issue-9-1"],
          "confidence": 0.9
        }
      ]
    },
    {
      "threadKey": "pr-3",
      "contentHash": "fixture",
      "decisions": [
        {
          "id": "pr-3-1",
          "summary": "Use one shared connection pool in the database layer",
          "rationale": "Opening a connection per request is too slow.",
          "decidedAt": "2026-04-04T00:00:00.000Z",
          "madeBy": ["alice"],
          "affects": ["src/db"],
          "supersedes": [],
          "confidence": 0.9
        }
      ]
    }
  ]
}
```

### Expected values for the fixture

**Components** (`selectComponents`): `docs`, `src/api`, `src/auth`, `src/db`, `src/ui`, `tests`.

**People** (`resolveIdentities`): `alice` (Alice Ng), `bob` (Bob Okafor), `carol` (Carol Diaz), `dave` (Dave Kim), `erin` (Erin Walsh). Commit `c18…` → `dave`, `c19…` → `carol`, `c20…` → `null`.

**Graph counts after `loadSnapshot`** (same after loading twice):

| Label         | Count | Relationship        | Count |
| ------------- | ----- | ------------------- | ----- |
| `Person`      | 5     | `AUTHORED`          | 40    |
| `Component`   | 6     | `REVIEWED`          | 7     |
| `File`        | 17    | `MODIFIES`          | 22    |
| `Commit`      | 20    | `PART_OF`           | 15    |
| `PullRequest` | 8     | `CONTAINS`          | 7     |
| `Issue`       | 6     | `CLOSES`            | 2     |
| `Comment`     | 7     | `ON`                | 7     |
| `Doc`         | 3     | `DESCRIBES`         | 5     |
| `Decision`    | 3     | `MADE`              | 4     |
| total nodes   | 75    | `DECIDED_IN`        | 3     |
|               |       | `AFFECTS`           | 3     |
|               |       | `SUPERSEDES`        | 1     |
|               |       | `KNOWS_ABOUT`       | 17    |
|               |       | `COLLABORATES_WITH` | 14    |

`DESCRIBES`: `docs/db.md` → `docs`, `src/db`; `docs/ui.md` → `docs`, `src/ui`; `README.md` → `src/api`.

**KNOWS_ABOUT** (score and share to 4 decimals; `last_active` as date):

| Component  | Person | Score | Share  | Last active | Expert        |
| ---------- | ------ | ----- | ------ | ----------- | ------------- |
| `docs`     | erin   | 3.6   | 0.5625 | 2026-10-01  | yes           |
| `docs`     | alice  | 2.8   | 0.4375 | 2026-10-01  | yes           |
| `src/api`  | bob    | 5.5   | 0.6322 | 2026-10-01  | yes           |
| `src/api`  | alice  | 3.2   | 0.3678 | 2026-10-01  | yes           |
| `src/auth` | carol  | 6.3   | 0.9065 | 2026-10-01  | yes           |
| `src/auth` | alice  | 0.6   | 0.0863 | 2026-10-01  | no            |
| `src/auth` | bob    | 0.05  | 0.0072 | 2025-10-06  | no            |
| `src/db`   | alice  | 6.3   | 0.8051 | 2026-10-01  | yes           |
| `src/db`   | bob    | 0.625 | 0.0799 | 2025-04-09  | no (inactive) |
| `src/db`   | carol  | 0.6   | 0.0767 | 2026-10-01  | no            |
| `src/db`   | dave   | 0.3   | 0.0383 | 2026-04-04  | no            |
| `src/ui`   | dave   | 5.4   | 0.4909 | 2026-10-01  | yes           |
| `src/ui`   | erin   | 4.6   | 0.4182 | 2026-10-01  | yes           |
| `src/ui`   | carol  | 1.0   | 0.0909 | 2026-04-04  | no            |
| `tests`    | dave   | 3.0   | 0.4286 | 2026-10-01  | yes           |
| `tests`    | erin   | 2.0   | 0.2857 | 2026-10-01  | yes           |
| `tests`    | carol  | 2.0   | 0.2857 | 2026-10-01  | yes           |

Worked example, Alice on `src/db`: commit `c01` 7 lines → log2(8) = 3 × 1; commit `c02` 15 lines → 4 × 0.5 = 2; authored PR 1 → 0.8 × 1; authored PR 3 → 0.8 × 0.5 = 0.4; comment `rc-1` on PR 3 → 0.2 × 0.5 = 0.1. Total 6.3.

**Bus factor**: `docs` 2 (at_risk), `src/api` 2 (at_risk), `src/auth` 1 (critical), `src/db` 1 (critical), `src/ui` 2 (at_risk), `tests` 3 (healthy).

**COLLABORATES_WITH weights** (both directions): alice–carol 2, alice–bob 1.5, alice–erin 1.5, alice–dave 1, dave–erin 3, carol–dave 0.5, carol–erin 0.5.

**Team ranking**: `alice` has the highest PageRank and the highest betweenness; `bob` has the lowest PageRank and betweenness 0 (his only collaborator is Alice); `carol`, `dave` and `erin` have betweenness 0.

**Departure simulation for `alice`**:

```json
{
  "person": { "id": "alice", "login": "alice", "name": "Alice Ng" },
  "affectedComponents": [
    {
      "path": "src/db",
      "busFactorBefore": 1,
      "busFactorAfter": 0,
      "riskAfter": "orphaned",
      "successors": ["bob 0.625", "carol 0.6", "dave 0.3"]
    },
    {
      "path": "docs",
      "busFactorBefore": 2,
      "busFactorAfter": 1,
      "riskAfter": "critical",
      "successors": ["erin 3.6"]
    },
    {
      "path": "src/api",
      "busFactorBefore": 2,
      "busFactorAfter": 1,
      "riskAfter": "critical",
      "successors": ["bob 5.5"]
    }
  ],
  "orphaned": ["src/db"],
  "critical": ["docs", "src/api"],
  "decisionsLosingOwner": [{ "id": "pr-3-1", "affects": ["src/db"] }],
  "openWork": [
    { "kind": "pr", "number": 8 },
    { "kind": "issue", "number": 12 }
  ],
  "nearbyCollaborators": ["carol 2", "bob 1.5", "erin 1.5", "dave 1"]
}
```

(Successors and collaborators abbreviated as "id score/weight"; the real objects follow `DepartureReportSchema`.) `issue-9-1` is not listed because it is superseded; `issue-9-2` is not listed because Bob also made it.

**Departure simulation for `bob`**: affected `src/api` (2 → 1, critical, successors alice 3.2); no orphaned; no decisions losing owner; open work issue 14.

**Search**: `toFullTextQuery("Who knows about pagination?")` = `"who|knows|about|pagination"`. `search(db, "pagination")` includes PR 2, issue 9, decisions `issue-9-1` and `issue-9-2`. `whoKnows(db, "pagination")` ranks `src/api` first, with experts bob then alice.

## 13. Environment variables

| Variable            | Read by (through `env.ts`)  | Purpose                                       |
| ------------------- | --------------------------- | --------------------------------------------- |
| `FALKORDB_HOST`     | db (via cli, server, tests) | FalkorDB host                                 |
| `FALKORDB_PORT`     | db                          | FalkorDB port                                 |
| `FALKORDB_USERNAME` | db                          | FalkorDB Cloud username                       |
| `FALKORDB_PASSWORD` | db                          | FalkorDB Cloud password                       |
| `FALKORDB_GRAPH`    | cli, server, mcp            | Graph name (tests use `tribal_test_<random>`) |
| `LLM_BASE_URL`      | llm                         | OpenAI-compatible endpoint                    |
| `LLM_API_KEY`       | llm                         | Google AI Studio key                          |
| `LLM_MODEL`         | llm                         | Model id                                      |
| `GITHUB_TOKEN`      | github                      | GitHub REST token                             |
| `PORT`              | server                      | HTTP port                                     |
| `WEB_ORIGIN`        | app (CORS)                  | Allowed browser origin                        |
| `VITE_API_URL`      | web build                   | Backend base URL for the deployed web app     |

`scripts/falkordb-mcp.sh` passes `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME` and `FALKORDB_PASSWORD` from `.env` to FalkorDB's MCP server. Tests load `.env` through `process.loadEnvFile` in `vitest.config.ts` when the file exists. CI sets `FALKORDB_HOST=localhost` and `FALKORDB_PORT=6379` for the service container.

## 14. Approved dependencies

Exact versions; nothing else without asking. All versions were published at least two weeks before 2026-10-16.

| Workspace | Package                            | Version | Kind | Added in |
| --------- | ---------------------------------- | ------- | ---- | -------- |
| root      | `@eslint/js`                       | 10.0.1  | dev  | existing |
| root      | `eslint`                           | 10.13.0 | dev  | existing |
| root      | `eslint-plugin-react-hooks`        | 7.1.1   | dev  | existing |
| root      | `prettier`                         | 3.9.10  | dev  | existing |
| root      | `typescript`                       | 6.0.3   | dev  | existing |
| root      | `typescript-eslint`                | 8.71.2  | dev  | existing |
| root      | `vitest`                           | 5.0.5   | dev  | existing |
| backend   | `hono`                             | 4.13.13 | prod | existing |
| backend   | `@hono/node-server`                | 2.1.5   | prod | existing |
| backend   | `zod`                              | 4.6.5   | prod | 1.1      |
| backend   | `falkordb`                         | 6.8.0   | prod | 1.2      |
| backend   | `@hono/zod-validator`              | 0.9.1   | prod | 3.3      |
| backend   | `openai`                           | 7.27.0  | prod | 4.1      |
| backend   | `@modelcontextprotocol/sdk`        | 1.31.0  | prod | 6.1      |
| backend   | `@types/node`                      | 24.19.2 | dev  | existing |
| backend   | `tsx`                              | 4.23.15 | dev  | existing |
| web       | `react`, `react-dom`               | 19.3.1  | prod | existing |
| web       | `hono`                             | 4.13.13 | prod | 1.4      |
| web       | `react-force-graph-2d`             | 1.29.2  | prod | 7.1      |
| web       | `@tailwindcss/vite`, `tailwindcss` | 4.3.3   | dev  | existing |
| web       | `@types/react`, `@types/react-dom` | 19.3.0  | dev  | existing |
| web       | `@vitejs/plugin-react`             | 6.1.2   | dev  | existing |
| web       | `vite`                             | 8.3.4   | dev  | existing |
| video     | `remotion`, `@remotion/cli`        | 4.0.532 | prod | 9.2      |
| video     | `react`, `react-dom`               | 19.3.1  | prod | 9.2      |
| video     | `@types/react`                     | 19.3.0  | dev  | 9.2      |

Not dependencies: `wrangler` (installed globally), `gh` and `git` (system tools), `@falkordb/mcpserver@1.3.0` (run with `npx` by `scripts/falkordb-mcp.sh`, dev tool only), the `falkordb/falkordb` Docker image for CI (tag pinned in `ci.yml`, task 1.2).
