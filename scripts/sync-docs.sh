#!/bin/bash
#
# Sync public-facing docs from mono/docs/ to General-Market/docs.git.
# Called by the post-commit hook whenever docs/ files change.
#
# Whitelisted: internal planning, research, and ops notes stay private.
# Additive: files that exist on gm-docs but not in mono (e.g. historical
# plans pushed directly to gm-docs before this hook existed) are preserved.
#
# Mintlify rebuilds docs.generalmarket.io on each push to gm-docs/main.

set -e

MONO_ROOT="$(git rev-parse --show-toplevel)"
REMOTE_URL="https://github.com/General-Market/docs.git"
BRANCH="main"
COMMIT_MSG="$(git log -1 --format='%s')"
TMP=$(mktemp -d)

trap 'rm -rf "$TMP"' EXIT

# Whitelist — only these paths under docs/ are public
PUBLIC_DIRS="api concepts guides images index logo skills snippets vision"
PUBLIC_FILES="error-codes.md error-handling-audit-report.md favicon.svg index.md llms.txt llms-full.txt mint.json project-overview.md"

git clone --quiet --depth 1 "$REMOTE_URL" "$TMP"

for d in $PUBLIC_DIRS; do
  if [ -d "$MONO_ROOT/docs/$d" ]; then
    rsync -a "$MONO_ROOT/docs/$d/" "$TMP/$d/"
  fi
done

for f in $PUBLIC_FILES; do
  if [ -f "$MONO_ROOT/docs/$f" ]; then
    cp "$MONO_ROOT/docs/$f" "$TMP/$f"
  fi
done

cd "$TMP"
git add -A

if git diff --cached --quiet; then
  echo "[sync-docs] no whitelisted changes, skipping push"
  exit 0
fi

git -c user.email=hook@generalmarket.io -c user.name="mono sync" commit -m "$COMMIT_MSG" >/dev/null
git push origin "$BRANCH"
