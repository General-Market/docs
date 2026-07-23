#!/bin/bash
# clsnet official verify r23 (round lead, post-lanes) — lock, verify, rescue artifacts.
# Reuses the generic lane verifier (.verify-r20-lane.sh is the standard verify-replication.sh).
cd /Users/maxguillabert/Downloads/index/video
W=.claude/rounds/work/clsnet
mkdir -p $W/r23
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 30; done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
# rescue watcher: copy the attempt mp4 before the verify's cleanup trap eats it
(
  while true; do
    for fmp in /tmp/replicate-attempt-*.mp4; do
      [ -f "$fmp" ] && cp -c "$fmp" "$W/r23/$(basename $fmp)" 2>/dev/null
    done
    sleep 20
  done
) & WATCHER=$!
VERIFY_ENTRY=src/index-replicas.ts VERIFY_PUBLIC_DIR="$PWD/.claude/rounds/pubdir/clsnet" \
  ./scripts/.verify-r20-lane.sh public/clsnet-original.mp4 ClsNet-Replicate "$PWD/$W/ref-analysis" \
  > $W/r23/verify-out.txt 2> $W/r23/verify-err.txt
kill $WATCHER 2>/dev/null
cp $W/ref-analysis/last-verify-breakdown.json .claude/rounds/clsnet-verify-r23.json 2>/dev/null
cp $W/ref-analysis/last-verify-keyframes.txt .claude/rounds/clsnet-keyframes-r23.txt 2>/dev/null
cp $W/ref-analysis/last-verify-framessim.txt .claude/rounds/clsnet-framessim-r23.txt 2>/dev/null
echo "=== SCORE LINE ==="
grep -E "SCORE:" $W/r23/verify-out.txt
echo VERIFY-R23-DONE
