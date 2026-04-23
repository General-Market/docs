#!/bin/bash
#
# Sync mono repo's frontend/ to General-Market/frontend.git (remote gm-frontend).
# Called by the post-commit hook whenever frontend/ files change.
#
# Builds a tree object from frontend/ (stripping the prefix), parents it
# on the remote's current HEAD, pushes the synthetic commit, then pings
# Dokploy's deploy webhook so the rebuild kicks without waiting for a
# GitHub-side trigger (custom-Git source in Dokploy has no auto-poll).
#
# Dokploy on VPS 3 watches gm-frontend/main (push + webhook, nixpacks builder)
# and rebuilds the production container. If this script does not run,
# mono pushes do not reach production.

set -e

MONO_ROOT="$(git rev-parse --show-toplevel)"
REMOTE="gm-frontend"
REMOTE2="fnd"
BRANCH="main"
COMMIT_MSG="$(git log -1 --format='%s')"

cd "$MONO_ROOT"

TREE=$(git ls-tree HEAD -- frontend/ | sed 's|	frontend/|	|' | git mktree)

git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null || true
PARENT=$(git rev-parse FETCH_HEAD 2>/dev/null || echo "")

if [ -z "$PARENT" ]; then
  COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE")
else
  COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE" -p "$PARENT")
fi

git push "$REMOTE" "${COMMIT}:refs/heads/${BRANCH}" 2>&1
git push "$REMOTE2" "${COMMIT}:refs/heads/${BRANCH}" 2>&1 || echo "warn: push to ${REMOTE2} failed (non-fatal)"

# Kick Dokploy rebuild. Custom-Git source has no auto-poll; this is how VPS 3
# hears about the new commit. Run synchronously — the post-commit hook already
# backgrounds this whole script, so the 10s curl does not delay `git commit`.
# Previously backgrounded here too, which meant the curl was orphaned on shell
# exit and silently dropped on ~1 push in 3. Foreground + retry is reliable.
DOKPLOY_HOOK="https://generalmarket.io/_dokploy/api/deploy/hDH6dhH6bGa-P0sbD684_"
for attempt in 1 2 3; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$DOKPLOY_HOOK" \
    -H 'Content-Type: application/json' \
    -H 'X-GitHub-Event: push' \
    -d '{"ref":"refs/heads/main"}' -m 15) || CODE="000"
  if [ "$CODE" = "200" ]; then
    echo "[sync-frontend] Dokploy rebuild triggered (attempt ${attempt})"
    exit 0
  fi
  echo "[sync-frontend] webhook attempt ${attempt} failed: HTTP ${CODE}"
  sleep 2
done
echo "[sync-frontend] ERROR — Dokploy webhook never returned 200. Rebuild not triggered."
exit 1
