#!/bin/bash
# lseg official verify r2 — lock, yc-pitch quarantine (restored by trap), rescue watcher.
cd /Users/maxguillabert/Downloads/index/video || exit 1
W=.claude/rounds/work/lseg
mkdir -p $W/r2
YC=src/compositions/yc-pitch/YCPitchComposition.tsx
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 30; done
restore() {
  [ -f "$YC.hold" ] && mv "$YC.hold" "$YC"
  rmdir /tmp/replica-render.lock 2>/dev/null
  kill "$WATCHER" 2>/dev/null
}
trap restore EXIT
mv "$YC" "$YC.hold"
(
  while true; do
    for fmp in /tmp/replicate-attempt-*.mp4; do
      [ -f "$fmp" ] && cp -c "$fmp" "$W/r2/attempt-r2.mp4" 2>/dev/null
    done
    sleep 20
  done
) & WATCHER=$!
VERIFY_ENTRY=src/index-replicas.ts VERIFY_PUBLIC_DIR="$PWD/.claude/rounds/pubdir/lseg" \
  ./scripts/verify-replication.sh public/lseg-replicate/original.mp4 Lseg-Replicate \
  > $W/r2/verify-out.txt 2> $W/r2/verify-err.txt
cp public/lseg-replicate/reference-analysis/last-verify-breakdown.json .claude/rounds/lseg-verify-r2.json 2>/dev/null
cp public/lseg-replicate/reference-analysis/last-verify-keyframes.txt .claude/rounds/lseg-keyframes-r2.txt 2>/dev/null
cp public/lseg-replicate/reference-analysis/last-verify-framessim.txt .claude/rounds/lseg-framessim-r2.txt 2>/dev/null
echo "=== SCORE ==="
grep -E "SCORE:" $W/r2/verify-out.txt
echo VERIFY-R2-DONE
