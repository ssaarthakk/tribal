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

## Built with AI assistance

This project was built with the help of [Claude Code](https://claude.com/claude-code), an AI coding assistant, as allowed by the hackathon rules.

## License

MIT
