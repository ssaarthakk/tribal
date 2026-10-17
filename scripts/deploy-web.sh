#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
: "${BACKEND_URL:?Set BACKEND_URL to the deployed backend URL}"
VITE_API_URL="$BACKEND_URL" npm --workspace web run build
wrangler pages deploy web/dist --project-name tribal --branch main
