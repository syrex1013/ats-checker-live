#!/usr/bin/env bash
# Deploy to GitHub Pages: commit everything and push to the gh-pages branch.
set -e
cd "$(dirname "$0")"
git init -q 2>/dev/null || true
git add -A
git commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || echo "nothing to commit"
# Use a clean gh-pages branch via subtree-less push of current dir
git checkout -q -B gh-pages 2>/dev/null || git checkout -q -B gh-pages
git push -q -f origin gh-pages
echo "Pushed to gh-pages. Enable Pages: repo Settings → Pages → branch gh-pages."
