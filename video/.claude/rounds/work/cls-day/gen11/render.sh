#!/bin/bash
set -u
cd /Users/maxguillabert/Downloads/index/video
G=.claude/rounds/work/cls-day/gen11
OUTDIR="${1:-$G/att}"
FRAMES="${2:-1650 1700 1837}"
mkdir -p "$OUTDIR"
LOG="$G/render.log"
echo "$(date) render start -> $OUTDIR frames=[$FRAMES]" >>"$LOG"
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 15; done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
echo "$(date) lock acquired" >>"$LOG"
for f in $FRAMES; do
  OUT="$OUTDIR/f${f}.png"
  VERIFY_ENTRY=src/index-replicas.ts \
  npx remotion still src/index-replicas.ts ClsDay-Replicate "$OUT" \
    --frame="$f" \
    --public-dir="$PWD/.claude/rounds/pubdir/cls-day" \
    >>"$LOG" 2>&1
  echo "$(date) done f$f rc=$?" >>"$LOG"
done
echo "$(date) ALL DONE" >>"$LOG"
