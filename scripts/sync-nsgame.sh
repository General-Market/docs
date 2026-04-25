#!/bin/bash
#
# Sync mono repo's nsgame/ to General-Market/nsgame.git (remote gm-nsgame).
# Called by the post-commit hook whenever nsgame/ files change.
#
# Same shape as scripts/sync-frontend.sh: build a tree from nsgame/,
# parent it on the remote's HEAD, push the synthetic commit, then ping
# Dokploy's deploy webhook so VPS 3 rebuilds the nsgame.org container.
#
# Dokploy on VPS 3 watches gm-nsgame/main (custom-Git source, nixpacks
# builder, build path /). If this script does not run, mono pushes do
# not reach production.

set -e

MONO_ROOT="$(git rev-parse --show-toplevel)"
REMOTE="gm-nsgame"
BRANCH="main"
COMMIT_MSG="$(git log -1 --format='%s')"

cd "$MONO_ROOT"

TREE=$(git ls-tree HEAD -- nsgame/ | sed 's|	nsgame/|	|' | git mktree)

git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null || true
PARENT=$(git rev-parse FETCH_HEAD 2>/dev/null || echo "")

if [ -z "$PARENT" ]; then
  COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE")
else
  COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE" -p "$PARENT")
fi

git push "$REMOTE" "${COMMIT}:refs/heads/${BRANCH}" 2>&1

# Kick Dokploy rebuild. Custom-Git source has no auto-poll on VPS 3.
# Synchronous + retried. The post-commit hook backgrounds this whole script.
DOKPLOY_HOOK="https://generalmarket.io/_dokploy/api/deploy/sbIOAWK7EU0hkMneh7skz"
for attempt in 1 2 3; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$DOKPLOY_HOOK" \
    -H 'Content-Type: application/json' \
    -H 'X-GitHub-Event: push' \
    -d '{"ref":"refs/heads/main"}' -m 15) || CODE="000"
  if [ "$CODE" = "200" ]; then
    echo "[sync-nsgame] Dokploy rebuild triggered (attempt ${attempt})"
    exit 0
  fi
  echo "[sync-nsgame] webhook attempt ${attempt} failed: HTTP ${CODE}"
  sleep 2
done
echo "[sync-nsgame] ERROR — Dokploy webhook never returned 200. Rebuild not triggered."
exit 1
