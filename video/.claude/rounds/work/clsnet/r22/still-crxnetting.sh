#!/bin/bash
# clsnet r20 canonical still harness.  usage: still.sh <outdir> <frame> [frame...]
#
# Laws baked in (each cost a round — see .claude/rules/replicate-method.md 28-34):
#  - The watchdog wraps AROUND the npx command, never THROUGH it.  A `\ &` spliced into
#    a line-continued npx severed --frame and every still came out FRAME 0 while printing
#    ok and exiting 0.  A frame-0-vs-frame-0 A/B is a perfect tie that reads as "ship it".
#  - Target rm -f'd first, so a stale PNG can never pose as a fresh render.
#  - Never rmdir a lock you did not create.  This script only removes the lock it made.
#  - Remotion `still` sometimes writes the PNG and then never exits.  300s watchdog.
#  - Count the files before you read the numbers: this prints a MANIFEST at the end.
#  - Plate screen: a frame-0 ClsNet still is SOLID NAVY (mean ~0.15, sd ~0).  Any still
#    with sd < 0.02 is flagged LOUDLY.  Screen on mean/sd, never on md5 equality.
set -uo pipefail
OUT="$1"; shift
FRAMES=("$@")
REPO=/Users/maxguillabert/Downloads/index/video
COMP=CrxNetting
mkdir -p "$OUT"
cd "$REPO"

LOCK=/tmp/replica-render.lock
while ! mkdir "$LOCK" 2>/dev/null; do
  echo "[still] lock held, waiting 20s..." >&2
  sleep 20
done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
echo "[still] lock acquired -> ${#FRAMES[@]} frame(s) into $OUT" >&2

for f in "${FRAMES[@]}"; do
  TARGET="$OUT/f$f.png"
  rm -f "$TARGET"
  # watchdog AROUND the whole command.  no backgrounding inside the npx invocation.
  ( VERIFY_ENTRY=src/index-replicas.ts npx remotion still src/index-replicas.ts "$COMP" \
      "$TARGET" --frame=$f --concurrency=1 \
      --public-dir="$REPO/.claude/rounds/pubdir/clsnet" \
      --log=error 2>&1 | tail -2 ) &
  NPXPID=$!
  ( sleep 300; kill -9 $NPXPID 2>/dev/null ) &
  WDPID=$!
  wait $NPXPID 2>/dev/null
  kill $WDPID 2>/dev/null
  pkill -f chrome-headless-shell 2>/dev/null || true
  if [ ! -f "$TARGET" ]; then
    echo "[still] !! MISSING $TARGET  (OOM, or a SIBLING's syntax error broke the shared bundle)" >&2
  fi
done

echo "[still] ===== MANIFEST (count the files before you read the numbers) =====" >&2
GOT=0
for f in "${FRAMES[@]}"; do
  T="$OUT/f$f.png"
  if [ -f "$T" ]; then
    GOT=$((GOT+1))
    read -r MEAN SD <<< "$(magick "$T" -colorspace gray -format '%[fx:mean] %[fx:standard_deviation]' info: 2>/dev/null)"
    FLAG=""
    awk -v s="$SD" 'BEGIN{exit !(s<0.02)}' && FLAG="  <<< PLATE?? sd<0.02 — HARNESS IS LYING, DO NOT GATE ON THIS"
    printf '[still] f%-6s mean=%.4f sd=%.4f  md5=%s%s\n' "$f" "$MEAN" "$SD" "$(md5 -q "$T")" "$FLAG" >&2
  else
    echo "[still] f$f  ABSENT" >&2
  fi
done
echo "[still] asked ${#FRAMES[@]}, got $GOT" >&2
[ "$GOT" -eq "${#FRAMES[@]}" ] || { echo "[still] FAIL: frame count mismatch — a dropped frame scores as a blank column, not an error." >&2; exit 1; }
