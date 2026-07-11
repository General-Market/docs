#!/bin/bash
# still.sh <frame> <outname>  — render one ClsDay-Replicate still via slim path
set -u
cd /Users/maxguillabert/Downloads/index/video
F="$1"; OUT=".claude/rounds/work/cls-day/models/att/${2:-att_$1}.png"
tries=0
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do
  tries=$((tries+1)); sleep 5
  if [ $tries -gt 120 ]; then rmdir /tmp/replica-render.lock 2>/dev/null; fi
done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
VERIFY_ENTRY=src/index-replicas.ts \
npx remotion still src/index-replicas.ts ClsDay-Replicate "$PWD/$OUT" \
  --frame=$F --public-dir="$PWD/.claude/rounds/pubdir/cls-day" 2>&1 | tail -3
echo "DONE $OUT"
