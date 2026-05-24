#!/bin/bash
#
# Ping Dokploy on VPS 3 to redeploy when frontend/ changes on mono/main.
#
# Frontend pulls directly from General-Market/mono via SSH (deploy key
# in Dokploy's ssh-key table, build path /frontend). The public mirror
# (gm-frontend) is gone. This hook replaces the old per-app sync script
# with a single webhook ping. nsgame is no longer deployed — its
# subpath remains in mono as code only.
#
# RACE FIX (2026-05-24): this script is launched from the *post-commit*
# hook, which fires the instant a commit is made — BEFORE `git push`
# publishes it. Dokploy clones General-Market/mono on the ping, so if we
# pinged immediately it would build the state from BEFORE the commit and
# the change would never deploy. (This silently defeated every agent: the
# push succeeded, the webhook returned 200, yet the live site never moved.)
# So we now block until the just-made commit is actually reachable on
# mono/main, then ping. The deploy follows the code, not the commit clock.

set -e

ROUTE="$1"
NAME="$2"
# Commit to wait for before triggering a clone. Defaults to HEAD so existing
# post-commit hooks (which don't pass it) are fixed without being touched.
COMMIT_SHA="${3:-$(git rev-parse HEAD 2>/dev/null || echo '')}"
REMOTE="${DOKPLOY_NOTIFY_REMOTE:-mono}"
BRANCH="main"

case "$ROUTE" in
  frontend) HOOK="https://generalmarket.io/_dokploy/api/deploy/hDH6dhH6bGa-P0sbD684_" ;;
  *)
    echo "[notify-dokploy] unknown route: $ROUTE" >&2
    exit 2
    ;;
esac

# Wait (≤180s) for COMMIT_SHA to land on ${REMOTE}/${BRANCH} before pinging.
# `if`-guarded git calls don't trip `set -e`. A fetch updates objects so the
# ancestry check is real, not a tip-equality guess (handles commit-then-push
# of several commits at once). On timeout we ping anyway — a no-op clone beats
# a missed deploy.
if [ -n "$COMMIT_SHA" ]; then
  published=0
  for i in $(seq 1 60); do
    if git fetch -q "$REMOTE" "$BRANCH" 2>/dev/null \
      && git merge-base --is-ancestor "$COMMIT_SHA" FETCH_HEAD 2>/dev/null; then
      published=1
      break
    fi
    sleep 3
  done
  if [ "$published" = 1 ]; then
    echo "[notify-dokploy] ${COMMIT_SHA:0:9} is live on ${REMOTE}/${BRANCH} — triggering deploy"
  else
    echo "[notify-dokploy] WARN: ${COMMIT_SHA:0:9} not on ${REMOTE}/${BRANCH} after 180s; pinging anyway"
  fi
fi

# Synchronous + retried. Dokploy's webhook is idempotent — duplicates
# either no-op (no new commit) or queue a second deploy that the worker
# rejects. Either way, the cost is one extra clone, not a corrupt state.
for attempt in 1 2 3; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HOOK" \
    -H 'Content-Type: application/json' \
    -H 'X-GitHub-Event: push' \
    -d '{"ref":"refs/heads/main"}' -m 15) || CODE="000"
  if [ "$CODE" = "200" ]; then
    echo "[notify-dokploy] ${NAME:-$ROUTE} rebuild triggered (attempt ${attempt})"
    exit 0
  fi
  echo "[notify-dokploy] webhook attempt ${attempt} failed: HTTP ${CODE}"
  sleep 2
done
echo "[notify-dokploy] ERROR — Dokploy webhook never returned 200 for ${ROUTE}."
exit 1
