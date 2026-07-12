#!/bin/bash
# ref-over-replica eye montage. Args: OUT REPTAG F1 F2 ...
# ref row = yellow border (r15/vf/v_<F>.png), replica row = cyan (r15/<REPTAG>_<F>.png)
W=/Users/maxguillabert/Downloads/index/video/.claude/rounds/work/clsnet/r15
OUT=$1; REPTAG=$2; shift 2
cols=()
for F in "$@"; do
  ref="$W/vf/v_${F}.png"; rep="$W/${REPTAG}_${F}.png"
  [ -f "$ref" ] || { echo "missing ref $F"; continue; }
  [ -f "$rep" ] || { echo "missing rep $F"; continue; }
  magick "$ref" -resize 480x270 -bordercolor yellow -border 3 /tmp/mr_$F.png
  magick "$rep" -resize 480x270 -bordercolor cyan   -border 3 /tmp/mp_$F.png
  magick /tmp/mr_$F.png /tmp/mp_$F.png -append /tmp/mcol_$F.png
  cols+=(/tmp/mcol_$F.png)
done
magick "${cols[@]}" +append "$W/$OUT.png"
rm -f /tmp/mr_*.png /tmp/mp_*.png /tmp/mcol_*.png
echo "built $W/$OUT.png"
