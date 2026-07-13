#!/bin/bash
# usage: ssim.sh <dir-with-fNNNN.png> <frames...>
cd /Users/maxguillabert/Downloads/index/video
R=.claude/rounds/work/cls-day/r18-lib/refs
for f in "${@:2}"; do
  v=$(ffmpeg -nostdin -loglevel error -i "$R/f$f.png" -i "$1/f$f.png" -lavfi ssim=stats_file=- -f null - 2>/dev/null | grep -o 'All:[0-9.]*' | cut -d: -f2)
  echo "f$f $v"
done
