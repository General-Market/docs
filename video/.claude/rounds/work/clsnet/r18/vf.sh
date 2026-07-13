#!/bin/bash
# Extract EXACT ref frames (25fps, ref n == comp n) to work/clsnet/r18/vf/v_<n>.png
# Usage: vf.sh <frame> [frame...]
cd /Users/maxguillabert/Downloads/index/video
W=.claude/rounds/work/clsnet/r18/vf
mkdir -p "$W"
for FR in "$@"; do
  ffmpeg -nostdin -loglevel error -y -i public/clsnet-original.mp4 \
    -vf "select='eq(n\,${FR})'" -vframes 1 "$W/v_${FR}.png"
  echo "ref $W/v_${FR}.png"
done
