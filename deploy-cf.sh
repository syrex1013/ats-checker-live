#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN env}"
export CLOUDFLARE_API_TOKEN
# Non-interactive Pages deploy. Project created on first run.
wrangler pages deploy . --project-name=ats-checker --branch=main
