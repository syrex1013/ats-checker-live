#!/usr/bin/env bash
# =============================================================================
#  AUTONOMOUS GROWTH LOOP
#  Runs on a schedule (macOS launchd / cron). Each tick:
#    1. Generates a new evergreen blog post (if queue has one)
#    2. Commits + pushes to gh-pages
#    3. Redeploys to Cloudflare Pages
#  Result: the site keeps attracting fresh SEO traffic without any interaction.
# =============================================================================
set -euo pipefail
cd /Users/adrian/ats-checker-live

# 1. new post (no-op if queue empty)
node blog/generate.js

# 2. commit + push
git add -A
git commit -q -m "auto: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || echo "nothing new"
git push -u origin gh-pages -q

# 3. redeploy (wrangler uses cached OAuth from `wrangler login`)
wrangler pages deploy . --project-name=ats-checker --branch=gh-pages --commit-dirty=true -q

echo "loop tick done: $(date -u)"
