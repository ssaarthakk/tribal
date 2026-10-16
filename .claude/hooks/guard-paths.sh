#!/usr/bin/env bash
file=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).tool_input.file_path ?? "")')
name="${file##*[\\/]}"

case "$name" in
  .env.example) exit 0 ;;
  .env*)
    echo "Blocked: $name may hold secrets. Only .env.example can be edited; the user edits .env by hand." >&2
    exit 2
    ;;
  *playbook*)
    echo "Blocked: playbook files are the user's private notes and must not be written." >&2
    exit 2
    ;;
esac

exit 0
