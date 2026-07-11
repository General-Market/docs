#!/bin/bash
# clsnet official verify r8 — wait for sibling render, lock, verify, rescue.
cd /Users/maxguillabert/Downloads/index/video
W=.claude/rounds/work/clsnet
mkdir -p $W/r8
# wait while any sibling remotion render is live, THEN take the lock
while pgrep -f "remotion render" >/dev/null 2>&1; do sleep 60; done
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 30; done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
# re-check: a sibling may have grabbed a render slot between checks
while pgrep -f "remotion render" >/dev/null 2>&1; do sleep 60; done
(
  while true; do
    for fmp in /tmp/replicate-attempt-*.mp4; do
      [ -f "$fmp" ] && cp -c "$fmp" "$W/r8/$(basename $fmp)" 2>/dev/null
    done
    sleep 20
  done
) & WATCHER=$!
VERIFY_ENTRY=src/index-replicas.ts VERIFY_PUBLIC_DIR="$PWD/.claude/rounds/pubdir/clsnet" \
  ./scripts/verify-replication.sh public/clsnet-original.mp4 ClsNet-Replicate "$PWD/$W/ref-analysis" \
  > $W/r8/verify-out.txt 2> $W/r8/verify-err.txt
kill $WATCHER 2>/dev/null
cp $W/ref-analysis/last-verify-breakdown.json .claude/rounds/clsnet-verify-r8.json 2>/dev/null
cp $W/ref-analysis/last-verify-keyframes.txt .claude/rounds/clsnet-keyframes-r8.txt 2>/dev/null
cp $W/ref-analysis/last-verify-framessim.txt .claude/rounds/clsnet-framessim-r8.txt 2>/dev/null
tail -3 $W/r8/verify-out.txt
echo VERIFY-R8-DONE
