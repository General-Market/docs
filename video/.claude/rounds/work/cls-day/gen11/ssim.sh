#!/bin/bash
# ssim.sh <dir_att> <frames...>  -> prints ref-vs-att SSIM per frame
set -u
cd /Users/maxguillabert/Downloads/index/video
G=.claude/rounds/work/cls-day/gen11
ATT="$1"; shift
for f in "$@"; do
  R="$G/ref/f$f.png"; A="$ATT/f$f.png"
  if [[ -f "$R" && -f "$A" ]]; then
    v=$(ffmpeg -nostdin -i "$R" -i "$A" -lavfi ssim -f null - 2>&1 | grep -oE 'All:[0-9.]+' | head -1)
    echo "f$f  $v"
  else
    echo "f$f  MISSING (R=$([[ -f $R ]] && echo y||echo n) A=$([[ -f $A ]] && echo y||echo n))"
  fi
done
