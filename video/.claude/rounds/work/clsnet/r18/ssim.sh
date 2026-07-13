#!/bin/bash
# ffmpeg SSIM between two PNGs, optional crop WxH+X+Y applied to BOTH.
# Usage: ssim.sh <a.png> <b.png> [WxH+X+Y]
A=$1; B=$2; CROP=$3
if [ -n "$CROP" ]; then
  W=${CROP%%x*}; R=${CROP#*x}; H=${R%%+*}; R=${R#*+}; X=${R%%+*}; Y=${R##*+}
  VF="crop=${W}:${H}:${X}:${Y}"
  ffmpeg -nostdin -loglevel error -i "$A" -i "$B" -lavfi "[0:v]${VF}[a];[1:v]${VF}[b];[a][b]ssim=stats_file=-" -f null - 2>/dev/null | tail -1
else
  ffmpeg -nostdin -loglevel error -i "$A" -i "$B" -lavfi ssim=stats_file=- -f null - 2>/dev/null | tail -1
fi
