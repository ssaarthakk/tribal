---
name: feature
description: Do the next unchecked task from docs/PLAN.md, completely, in this session.
disable-model-invocation: true
---

Run this at the start of a fresh session. Assume no memory of earlier sessions.

1. Run `git status`. Commits happen once per phase, so uncommitted changes from earlier tasks of the current phase are expected. If the changes look unrelated to the current phase, stop and ask the user.
2. Read `CLAUDE.md`, `docs/PLAN.md`, and, if they exist, `docs/ARCHITECTURE.md` and `docs/PROJECT.md`.
3. Find the first unchecked task in the first phase that isn't fully done. If everything is done, say so and stop.
4. If the task is tagged `[MANUAL]`, show the user the exact steps they need to do, wait for them to confirm they're done, verify what can be verified (for example with `scripts/doctor.sh`), then tick it and stop.
5. Tell the user in one or two lines which task you're starting and what you'll change.
6. Implement **only that task, completely, in this session**, following its spec in `docs/PLAN.md` exactly: the files it lists, the function signatures it gives, the Cypher it gives, and its acceptance criteria. If the spec is ambiguous or blocked, stop and ask the user rather than guessing.
7. Write or update the tests the task specifies.
8. Run `npm run check` and fix any failures.
9. Run the `ponytail-reviewer` subagent on the files this task changed (list them in its prompt; the uncommitted diff may also hold earlier tasks of this phase).
10. Remove every bloat item it reports, unless removing it would break the task's acceptance criteria. In that case, keep it and say why in one line.
11. Run `npm run check` again.
12. Go through each acceptance criterion and confirm it's met, with the evidence (test name, command output, or file).
13. Tick the task's checkbox in `docs/PLAN.md`. If you had to deviate from the spec, add one line under the task starting with `Note:` saying what and why, so the next session knows.
14. Give the user a short summary (what changed, which files, what the reviewer removed). If this task is the last one of its phase in `docs/PLAN.md`, tell them to run `/commit` and then clear the session; otherwise tell them to clear the session. **Do not commit.**
