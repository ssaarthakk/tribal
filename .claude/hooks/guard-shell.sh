#!/usr/bin/env bash
command=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).tool_input.command ?? "")')

force_push='git([[:space:]].*)?[[:space:]]push([[:space:]].*)?[[:space:]](--force[^[:space:]]*|-f)([[:space:]]|$)'
hard_reset='git([[:space:]].*)?[[:space:]]reset([[:space:]].*)?[[:space:]]--hard'

if printf '%s' "$command" | grep -Eq "$force_push"; then
  echo "Blocked: force pushing is not allowed in this project." >&2
  exit 2
fi

if printf '%s' "$command" | grep -Eq "$hard_reset"; then
  echo "Blocked: git reset --hard is not allowed in this project. It throws away uncommitted work." >&2
  exit 2
fi

exit 0
