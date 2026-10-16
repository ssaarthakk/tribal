#!/usr/bin/env bash
set -u

step() {
  local name="$1"
  shift
  echo "==> $name"
  if ! "$@"; then
    echo "Check failed at step: $name" >&2
    exit 1
  fi
}

step "prettier" prettier --check .
step "eslint" eslint .
step "typescript" tsc -b
step "vitest" vitest run
step "web build" npm --workspace web run build

echo "All checks passed."
