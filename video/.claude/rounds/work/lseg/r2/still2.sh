#!/bin/bash
# lseg r2 still harness — lock + slim entry/pubdir. Usage: still2.sh OUTDIR FRAME [FRAME...]
# Law 31: every render goes through this; law 32: never break a foreign lock.
cd /Users/maxguillabert/Downloads/index/video || exit 1
OUT=$1; shift
mkdir -p "$OUT"
while ! mkdir /tmp/replica-render.lock 2>/dev/null; do sleep 30; done
trap 'rmdir /tmp/replica-render.lock 2>/dev/null' EXIT
for F in "$@"; do
  npx remotion still src/index-replicas.ts Lseg-Replicate \
    --frame "$F" --output "$OUT/att-$F.png" \
    --public-dir "$PWD/.claude/rounds/pubdir/lseg" >"$OUT/.log-$F" 2>&1 \
    || echo "FAIL $F (see $OUT/.log-$F)"
done
# Law 28/29 screen: count files + mean/sd per still (frame-0 plate = royal, sd~0).
for F in "$@"; do
  [ -f "$OUT/att-$F.png" ] && magick "$OUT/att-$F.png" -format "att-$F mean=%[fx:mean] sd=%[fx:standard_deviation]\n" info: 2>/dev/null
done
