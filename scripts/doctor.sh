#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.."

report() {
  if [ "$2" = "yes" ]; then
    printf 'OK       %s\n' "$1"
  else
    printf 'MISSING  %s\n' "$1"
  fi
}

is_set_in_env_file() {
  [ -f .env ] && grep -qE "^$1=[^[:space:]]" .env
}

echo "Environment variables in .env:"
for name in $(grep -oE '^[A-Z_]+' .env.example); do
  if is_set_in_env_file "$name"; then report "$name" yes; else report "$name" no; fi
done

echo
echo "Tools:"
for tool in node npm git gh wrangler; do
  if command -v "$tool" >/dev/null 2>&1; then report "$tool installed" yes; else report "$tool installed" no; fi
done

if gh auth status >/dev/null 2>&1; then report "gh logged in" yes; else report "gh logged in" no; fi
if wrangler whoami 2>/dev/null | grep -q "You are logged in"; then report "wrangler logged in" yes; else report "wrangler logged in" no; fi
