#!/usr/bin/env bash
# Fired by crx-prod-deploy.path when Jarvis drops an approved request.
# The request's first line is the surface: app|docs|landing|blog|solver-dash|faucet|dataroom|developers|portal|explorer.
set -uo pipefail
REQ=/root/jarvis/state/deploy.request
RES=/root/jarvis/state/deploy.result
[ -f "$REQ" ] || exit 0
TARGET=$(head -1 "$REQ" | tr -d '[:space:]')
rm -f "$REQ"
case "$TARGET" in
  app|docs|landing|blog|solver-dash|faucet|dataroom|developers|portal|explorer) ;;
  *) { echo "bad target: ${TARGET:-<empty>}"; } > "$RES"; chmod 666 "$RES" 2>/dev/null || true; exit 0 ;;
esac
OUT=$(/opt/crxfx/deploy-bot/run-prod.sh "$TARGET" 2>&1 | tail -2)
case "$TARGET" in
  app)     URL=https://app.crxfx.com ;;
  docs)    URL=https://101.crxfx.com ;;
  landing) URL=https://crxfx.com ;;
  blog)    URL=https://blog.crxfx.com ;;
  solver-dash) URL=https://solver.crxfx.com ;;
  faucet)  URL=https://faucet.crxfx.com ;;
  dataroom) URL=https://dataroom.crxfx.com ;;
  developers) URL=https://developers.crxfx.com ;;
  portal)  URL=https://portal.crxfx.com ;;
  explorer) URL=https://explorer.crxfx.com ;;
esac
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" || echo 000)
{ echo "$OUT"; echo "$URL -> $CODE"; } > "$RES"
chmod 666 "$RES" 2>/dev/null || true
