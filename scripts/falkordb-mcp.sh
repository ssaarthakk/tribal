#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
export FALKORDB_DEFAULT_READONLY=true
exec npx -y @falkordb/mcpserver@1.3.0
