---
name: commit
description: Commit the finished phase with a single short subject line.
disable-model-invocation: true
---

1. Run `git status` and `git diff` to see what changed.
2. Run `npm run check`. If it fails, stop and report; don't commit.
3. Stage only the files that belong to this phase (all its tasks, including the `docs/PLAN.md` ticks). Never stage `.env*` (other than `.env.example`), playbook files, or anything in `.gitignore`. Stage shell scripts with `git add --chmod=+x` so they stay executable.
4. Commit with **a single short subject line**: imperative mood, under 60 characters (e.g. `Add expertise and knowledge risk`).
   - **No body or description.**
   - **No `Co-Authored-By` trailer** or any other trailer or attribution.
5. Show the user the commit hash and subject. **Do not push.**
