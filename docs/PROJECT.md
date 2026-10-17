# Tribal: project

## The problem

Engineering teams lose knowledge without noticing it. Someone leaves, and only then does the team find out that they were the only person who understood the storage layer, or that the reason behind a design choice lived only in a PR thread they wrote two years ago. The questions teams need answered (who knows this? what breaks if they leave? why did we decide this?) are graph questions: about people, code, conversations and decisions, and how they connect.

## The product

Tribal is an open-source knowledge-risk engine. It reads one GitHub repository (commits with changed files, pull requests, reviews, issues, comments and markdown docs), builds a knowledge graph in FalkorDB, and answers:

- **Who knows what:** expertise scores per person and component, from commits, reviews, authored PRs and discussion, with time decay.
- **What breaks if someone leaves:** bus factor per component, team dependency ranking with FalkorDB's PageRank and betweenness procedures, and the hero feature, the **departure simulation**. Pick a person, take them out of the graph, and see which components lose their last expert, which decisions lose their only owner, and which open work is left stranded. Tribal then writes a handover plan.
- **Why was this decided:** decisions extracted from PR and issue threads, linked to their source thread, the people who made them, the components they affect, and the earlier decisions they replace.

It has a web UI (Risk Map, Departure Simulation, Ask), a chat agent whose tools are graph queries and which cites GitHub URLs for every answer, and an MCP server exposing the same tools to coding agents.

## Who it's for

Engineering managers and tech leads who want to see knowledge risk before it becomes an incident, and engineers onboarding to an unfamiliar codebase who want to know who to ask and why things are the way they are. Long term: any team, self-hosted, pointed at its own repos and plugged into its coding agents through MCP.

## Demo dataset

The public `FalkorDB/FalkorDB` repository, treated as "the company", default branch `main`, activity since 2025-04-16 (18 months). Checked on 2026-10-16:

| Item                                    | Count                                                        |
| --------------------------------------- | ------------------------------------------------------------ |
| Commits on `main` in the window         | 504 (all squash merges, no merge commits)                    |
| Human commit authors                    | about 20, of whom 8 are regular; plus dependabot and Copilot |
| PRs / issues created in the window      | about 1,140 / 1,110                                          |
| Issue and review comments in the window | about 4,500 / 7,000                                          |
| Components (see ARCHITECTURE)           | about 36 with at least 8 commits each                        |

`main` is the Rust rewrite of the engine (`graph/src/*`) alongside the C engine (`src/*`), so the data tells a real knowledge-transfer story: a few maintainers hold most of the knowledge of each engine. Vendored code (`deps/`, `build/graphblas/`) is ignored. The size fits the 100MB FalkorDB Cloud free tier (estimated 20 to 40MB, measured in task 2.5).

## Hackathon constraints

- **Event:** Graph Hacks: Context for AI Agents (WeMakeDevs x FalkorDB), online. **Track:** Company Brain.
- **Deadline:** submissions close Sunday 18 October 2026, 11:59 PM IST. Internal target: submitted by **Sunday 6:00 PM IST**.
- FalkorDB is the primary database and does the central work: expertise, bus factor, collaboration, PageRank, betweenness, full-text search and the departure simulation are all Cypher queries or FalkorDB procedures. Without FalkorDB nothing works.
- Only public, synthetic or our own data. The demo repo is public; author emails are stored only as hashes; the test fixture is synthetic.
- Main coding happens during the event. AI assistance (Claude Code) is disclosed in the README.
- Required in the submission: public repo, README with setup and graph data model, the Cypher queries and graph algorithms used, demo video, live deployment, track name.

## Track focus areas

| Focus area                                          | How Tribal covers it                                                                                                                             | Features   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Knowledge from docs, tickets and chats in one graph | Markdown docs, issues, PRs, reviews and comments are nodes in one FalkorDB graph, linked to code, people and decisions                           | F1, F2, F5 |
| Who owns what and who knows what                    | Time-decayed expertise scores, experts and bus factor per component, team ranking with PageRank and betweenness                                  | F3, F4, F9 |
| Tracing decisions back to their source              | Decisions linked to their PR or issue thread, the people who made them, affected components and the decisions they supersede                     | F5, F6     |
| Keeping knowledge current as things change          | Time decay and a 365-day activity window; re-fetch and reload are idempotent; the decision cache re-runs only changed threads; SUPERSEDES chains | F1, F3, F5 |
| Answers with clear sources                          | Every agent and MCP answer returns the GitHub URLs and the graph path it used; the UI highlights the path                                        | F6, F8, F9 |
