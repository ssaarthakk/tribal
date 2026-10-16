#!/usr/bin/env bash
command=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).tool_input.command ?? "")')

if [[ "$command" != *$'\n'* ]] && printf '%s' "$command" | grep -Eq '^git (diff|status|ls-files)( [^;&|<>`$]*)?$'; then
  exit 0
fi

echo "Blocked: this reviewer may only run git diff, git status or git ls-files." >&2
exit 2
