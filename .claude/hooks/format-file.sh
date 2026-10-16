#!/usr/bin/env bash
file=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).tool_input.file_path ?? "")')

case "$file" in
  *.ts | *.tsx | *.js | *.json | *.css | *.md | *.yml | *.yaml | *.html)
    cd "$CLAUDE_PROJECT_DIR" && npx --no-install prettier --write "$file" >/dev/null 2>&1
    ;;
esac

exit 0
