#!/bin/bash
# Render ClsNet-Replicate stills to work/clsnet/r18/stills/<tag>_<frame>.png through the ONE global lock.
# Usage: still.sh <tag> <frame> [frame...]
cd /Users/maxguillabert/Downloads/index/video
W=.claude/rounds/work/clsnet/r18/stills
mkdir -p "$W"
TAG=$1; shift
PUB="$PWD/.claude/rounds/pubdir/clsnet"
tries=0
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do
  if ! pgrep -f "remotion render" >/dev/null && ! pgrep -f "remotion still" >/dev/null && ! pgrep -f "chrome-headless-shell" >/dev/null; then
    rmdir /tmp/replica-render.lock 2>/dev/null
  fi
  tries=$((tries+1)); [ $tries -gt 240 ] && { echo "LOCK TIMEOUT"; exit 1; }
  sleep 20
done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
for FR in "$@"; do
  npx remotion still src/index-replicas.ts ClsNet-Replicate "$W/${TAG}_${FR}.png" \
    --frame=$FR --public-dir="$PUB" --concurrency=1 --log=error 2>&1 | tail -1
  echo "rendered $W/${TAG}_${FR}.png"
done
pkill -f "chrome-headless-shell" 2>/dev/null
echo "done ${TAG}"
