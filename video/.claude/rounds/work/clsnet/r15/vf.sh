#!/bin/bash
cd /Users/maxguillabert/Downloads/index/video
REF=public/clsnet-original.mp4
OUT=.claude/rounds/work/clsnet/r15/vf
mkdir -p "$OUT"
for F in "$@"; do
  T=$(python3 -c "print(($F-0.4)/25.0)")
  ffmpeg -nostdin -loglevel error -ss "$T" -i "$REF" -frames:v 1 -update 1 -y "$OUT/v_${F}.png"
done
echo "extracted: $@"
