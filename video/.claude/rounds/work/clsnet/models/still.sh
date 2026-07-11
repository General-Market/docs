#!/bin/bash
# Render ClsNet-Replicate stills to work/clsnet/models/<tag>_<frame>.png
# Usage: still.sh <tag> <frame> [frame...]
cd /Users/maxguillabert/Downloads/index/video
W=.claude/rounds/work/clsnet/models
TAG=$1; shift
PUB="$PWD/.claude/rounds/pubdir/clsnet"
tries=0
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do
  if ! pgrep -f "remotion render" >/dev/null && ! pgrep -f "chrome-headless-shell" >/dev/null; then
    rmdir /tmp/replica-render.lock 2>/dev/null
  fi
  tries=$((tries+1)); [ $tries -gt 120 ] && { echo "LOCK TIMEOUT"; exit 1; }
  sleep 5
done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
for FR in "$@"; do
  npx remotion still src/index-replicas.ts ClsNet-Replicate "$W/${TAG}_${FR}.png" \
    --frame=$FR --public-dir="$PUB" --concurrency=1 --log=error 2>&1 | tail -3
  echo "rendered $W/${TAG}_${FR}.png"
done
