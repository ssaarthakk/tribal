# Submission

## Project name

Tribal

## One-line pitch

Tribal maps who knows what in your codebase and shows exactly what breaks when someone leaves.

## Description

Every engineering team has knowledge that lives in a few people's heads. Nobody notices until one of them leaves. Tribal is an open-source knowledge-risk engine that finds that risk before it hurts.

It reads a GitHub repository (commits, pull requests, reviews, issues, comments and markdown docs) into a FalkorDB knowledge graph. Cypher computes time-decayed expertise and a bus factor for every component. FalkorDB's PageRank and betweenness rank who the team depends on most. An LLM extracts decisions from PR and issue threads and links each one to its source, its owners and the components it affects.

The demo treats the public FalkorDB/FalkorDB repository as the company. Of its 35 components, 1 has a single expert, 19 have two, and 15 are healthy. The hero feature is the departure simulation: when the top-ranked maintainer, Roi Lipman, leaves, 10 components drop to a single expert, 8 decisions lose their only owner, and 40 open pull requests and issues are left stranded. The agent then writes a handover plan with suggested successors and copy-ready GitHub issue text.

An Ask screen answers questions such as "why was this decided?" with GitHub sources and highlights the graph path it used. The same tools are exposed over MCP, so Claude Desktop or Cursor can use them too. Remove FalkorDB and nothing works: every answer is a graph query.

## Track

Company Brain

## Links

- Repository: https://github.com/ssaarthakk/tribal
- Live demo: https://tribal.ssaarthakk.me
- Backend health: https://tribal-backend-gaxe.onrender.com/api/health
- Demo video: https://youtu.be/XUG6PpnAPeQ

## Tech used

- FalkorDB Cloud and the `falkordb` Node.js client: Cypher, `algo.pageRank`, `algo.betweenness`, full-text indexes
- TypeScript and Node.js 24
- Hono API with `zod` validation and a typed RPC client
- React, Vite, Tailwind CSS and `react-force-graph-2d`
- Google Gemini through its OpenAI-compatible endpoint, for decision extraction, handover plans and the chat agent
- Model Context Protocol TypeScript SDK
- Vitest
- Remotion for the demo video
- Render (backend) and Cloudflare Pages (frontend)

## AI assistance disclosure

Tribal was built with the help of Claude Code, an AI coding assistant, as the hackathon rules allow. The graph model, Cypher queries and architecture are documented in the README and `docs/ARCHITECTURE.md`, and the author can explain each of them.
