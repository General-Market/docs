#!/bin/bash
# usage: ssim.sh <refdir> <attdir> <frames...>
R="$1"; A="$2"; shift 2
for f in "$@"; do
  v=$(ffmpeg -nostdin -v error -i "$R/f$f.png" -i "$A/f$f.png" -lavfi ssim=stats_file=- -f null - 2>/dev/null | grep All | sed 's/.*All:\([0-9.]*\).*/\1/')
  echo "f$f $v"
done
