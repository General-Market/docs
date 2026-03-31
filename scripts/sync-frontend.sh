#!/bin/bash
#
# Sync mono repo's frontend/ to General-Market/frontend.git
# Called by post-commit hook when frontend/ files change.
#
# Creates a commit on the frontend repo's history with the current
# frontend/ tree state, then pushes it.
#

set -e

MONO_ROOT="$(git rev-parse --show-toplevel)"
REMOTE="gm-frontend"
REMOTE2="fnd"
BRANCH="main"
COMMIT_MSG="$(git log -1 --format='%s')"

cd "$MONO_ROOT"

# Build a tree object from frontend/ contents (strip the frontend/ prefix)
TREE=$(git ls-tree HEAD -- frontend/ | sed 's/	frontend\//	/' | git mktree)

# Fetch the remote's current HEAD so we can parent our commit on it
git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null || true
PARENT=$(git rev-parse "FETCH_HEAD" 2>/dev/null || echo "")

if [ -z "$PARENT" ]; then
  COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE")
else
  COMMIT=$(echo "$COMMIT_MSG" | git commit-tree "$TREE" -p "$PARENT")
fi

git push "$REMOTE" "$COMMIT:refs/heads/$BRANCH" 2>&1
git push "$REMOTE2" "$COMMIT:refs/heads/$BRANCH" 2>&1 || echo "warn: push to $REMOTE2 failed (non-fatal)"
