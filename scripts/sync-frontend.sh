#!/bin/bash
#
# Sync mono repo's frontend/ to General-Market/frontend.git (remote gm-frontend).
# Called by the post-commit hook whenever frontend/ files change.
#
# Builds a tree object from frontend/ (stripping the prefix), parents it
# on the remote's current HEAD, pushes the synthetic commit.
#
# Vercel and the Dokploy poller both watch gm-frontend/main — if this
# script does not run, mono pushes do not reach production.

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
