#!/bin/bash
# usage: still.sh <compId> <outdir> <frames...>
set -e
COMP="$1"; OUT="$2"; shift 2
mkdir -p "$OUT"
cd /Users/maxguillabert/Downloads/index/video
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 20; done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null || true' EXIT
for f in "$@"; do
  VERIFY_ENTRY=src/index-replicas.ts npx remotion still src/index-replicas.ts "$COMP" \
    "$OUT/f$f.png" --frame=$f --concurrency=1 \
    --public-dir=/Users/maxguillabert/Downloads/index/video/.claude/rounds/pubdir/cls-day \
    --log=error 2>&1 | tail -2
  pkill -f chrome-headless-shell 2>/dev/null || true
done
