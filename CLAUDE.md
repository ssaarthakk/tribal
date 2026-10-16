# Tribal

Knowledge-risk engine: reads a GitHub repo into a FalkorDB graph and shows who knows what, what breaks if someone leaves, and why decisions were made. TypeScript, npm workspaces `backend` (Hono) and `web` (Vite + React + Tailwind).

## Code style

- KISS: the simplest thing that fully works. No abstractions "for later".
- DRY: don't repeat logic or content that changes together. Don't add tooling just to remove small, stable repetition; ask first.
- Simple, readable, complete. A beginner should understand every file.
- **No comments anywhere**: no TypeScript, CSS, shell, YAML, JSON-with-comments or config comments, and no JSDoc. Use clear names and structure instead. Only exception: a shebang line. Where a library needs descriptive text (MCP tool descriptions, LLM tool schemas), pass it as an explicit string field.
- Strict TypeScript. No `any`, no non-null assertions (`!`), no `@ts-ignore` or `@ts-expect-error`, no `eslint-disable`. Validate every external input (HTTP requests, GitHub API responses, LLM output, env vars) with `zod` at the boundary once it's added.
- No new dependencies or frameworks without asking. The approved list is in `docs/ARCHITECTURE.md` once it exists.
- No analytics, trackers, cookies, or third-party scripts or fonts without asking.
- Accessible UI: labels, alt text, contrast, visible keyboard focus.

## Where things live

- All Cypher queries live in `backend/src/queries.ts` as named exported constants. No Cypher strings anywhere else.
- Graph schema, folder layout, module boundaries and approved dependencies are in `docs/ARCHITECTURE.md`. Follow it exactly. If a task needs something it doesn't cover, stop and ask.
- Tests and local runs use the fixture snapshot in `data/`, never the live GitHub API or a live LLM. Anything that calls an LLM or GitHub goes through a function that tests can replace with a fake.

## Workflow

- Work follows `docs/PLAN.md`, split into phases. Phase 0 is planning. One task per session, started with `/feature`.
- Every backend task adds or updates vitest tests covering its acceptance criteria.
- **Never run `git commit` or `git push` yourself.** Commits happen only when the user runs `/commit`.
- Run `npm run check` before saying a task is done. `npm run format` fixes formatting and autofixable lint.
- Product background is in `docs/PROJECT.md` and `docs/BRIEF.md`. Read them when you need context.
- If something needs the user (an account, an API key, a manual step, a decision), stop and ask. Don't guess and don't work around it.
- Before adding or changing a query in `backend/src/queries.ts`, use the FalkorDB MCP server to check the current schema and run the query read-only against the dev graph. Never use it to write to the graph; all writes go through the app's own code.

## Security

- Never write secrets, API keys, or personal data into the repo.
- Never read or edit `.env*` files except `.env.example`. Use `scripts/doctor.sh` to check what's set.
- Never create, comment on, or modify issues, PRs or anything else on GitHub repos other than this project's own repo.
- All external links that open new tabs use `rel="noopener noreferrer"`.
