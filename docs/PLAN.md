# Plan

## Phase 0: Plan the product

- [ ] Write `docs/PROJECT.md`, `docs/ARCHITECTURE.md` and the full phased plan in this file, following `docs/BRIEF.md` section "Instructions for Phase 0".
      Note: FalkorDBLite 0.3.0 does not run on this Windows machine ("Unsupported platform: win32-x64"; it supports only linux-x64 and darwin-arm64, and WSL and Docker are not installed), so development must use FalkorDB Cloud's free tier instead. Tests that need a graph must account for this.
      Note: Phase 1 must provide a local dev graph on a TCP port (`FALKORDB_DEV_PORT`, default 6390) for the FalkorDB MCP server in `.mcp.json`, or point that server at the dev graph on FalkorDB Cloud. The MCP server has not yet been tested against a running graph.
