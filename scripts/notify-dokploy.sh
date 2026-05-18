#!/bin/bash
#
# Ping Dokploy on VPS 3 to redeploy when frontend/ changes on mono/main.
#
# Frontend pulls directly from General-Market/mono via SSH (deploy key
# in Dokploy's ssh-key table, build path /frontend). The public mirror
# (gm-frontend) is gone. This hook replaces the old per-app sync script
# with a single webhook ping. nsgame is no longer deployed — its
# subpath remains in mono as code only.

set -e

ROUTE="$1"
NAME="$2"
case "$ROUTE" in
  frontend) HOOK="https://generalmarket.io/_dokploy/api/deploy/hDH6dhH6bGa-P0sbD684_" ;;
  *)
    echo "[notify-dokploy] unknown route: $ROUTE" >&2
    exit 2
    ;;
esac

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
