# Tribal

Tribal is an open-source knowledge-risk engine for engineering teams. It reads a GitHub repository, builds a knowledge graph in [FalkorDB](https://www.falkordb.com/), and shows who knows what, what breaks if someone leaves, and why decisions were made.

Built for Graph Hacks (WeMakeDevs x FalkorDB), Company Brain track. Work in progress.

## Install

Requires Node.js 24 (see `.nvmrc`) and Bash (on Windows, run the commands from Git Bash).

```bash
npm install
cp .env.example .env
```

Fill in `.env` as needed. `bash scripts/doctor.sh` shows which variables and tools are set up, without printing any values.

## Checks

```bash
npm run check
npm run format
```

`check` runs Prettier, ESLint, the TypeScript build, Vitest and the web build, and stops at the first failure. `format` fixes formatting and autofixable lint problems.

## MCP server

Tribal exposes its eight tools (`search`, `who_knows`, `bus_factor`, `get_component`, `get_person`, `simulate_departure`, `team_ranking`, `decision_history`) over MCP on stdio. Build the backend first:

```bash
npm --workspace backend run build
```

Then add this to Claude Desktop (`claude_desktop_config.json`) or Cursor (`.cursor/mcp.json`), with your own absolute paths:

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

In Claude Code: `claude mcp add tribal -- node --env-file=/absolute/path/to/tribal/.env /absolute/path/to/tribal/backend/dist/cli.js mcp`.

For ad-hoc Cypher against the same graph, run FalkorDB's official MCP server alongside it with `bash scripts/falkordb-mcp.sh`.

## Built with AI assistance

This project was built with the help of [Claude Code](https://claude.com/claude-code), an AI coding assistant, as allowed by the hackathon rules.

## License

MIT
