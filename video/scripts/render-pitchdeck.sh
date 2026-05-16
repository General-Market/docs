#!/usr/bin/env bash
# Render PitchTen into the frontend's public/pitchdeck/ directory.
#
# Outputs:
#   frontend/public/pitchdeck/pitch.mp4         — full 54s deck
#   frontend/public/pitchdeck/pitch.pdf         — 10-page static PDF
#   frontend/public/pitchdeck/slides/NN.mp4     — per-slide 5s MP4 (×10)
#   frontend/public/pitchdeck/slides/NN.jpg     — per-slide poster JPG (×10)
#
# Run from anywhere — paths are resolved relative to this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIDEO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_PUBLIC="$(cd "${VIDEO_DIR}/../frontend/public" && pwd)"
OUT="${FRONTEND_PUBLIC}/pitchdeck"
SLIDES_OUT="${OUT}/slides"
STILLS_TMP="$(mktemp -d -t pitchten-stills.XXXXXX)"
trap 'rm -rf "${STILLS_TMP}"' EXIT

mkdir -p "${OUT}" "${SLIDES_OUT}"

cd "${VIDEO_DIR}"

if ! command -v magick >/dev/null 2>&1; then
  echo "error: imagemagick 'magick' command not found. brew install imagemagick" >&2
  exit 1
fi

SLIDES=(
  PitchTen-01-Problem
  PitchTen-02-Market
  PitchTen-03-Traction
  PitchTen-04-Business
  PitchTen-05-Competition
  PitchTen-06-Growth
  PitchTen-07-Team
  PitchTen-08-Ask
  PitchTen-09-Financials
  PitchTen-10-Risks
)

START=$(date +%s)

echo "==> rendering 10 per-slide MP4s + stills"
for ID in "${SLIDES[@]}"; do
  IDX=$(echo "$ID" | grep -oE "[0-9]{2}" | head -1)
  echo "  → ${ID}"
  npx remotion render "${ID}" "${SLIDES_OUT}/${IDX}.mp4" \
    --codec=h264 --crf=23 --pixel-format=yuv420p --concurrency=6 \
    --log=error
  npx remotion still "${ID}" "${STILLS_TMP}/${IDX}.png" --frame=100 --log=error
done

echo "==> generating slide posters (jpg)"
for png in "${STILLS_TMP}"/*.png; do
  base=$(basename "${png}" .png)
  magick "${png}" -quality 85 -resize 1920x "${SLIDES_OUT}/${base}.jpg"
done

echo "==> building PDF from stills"
magick -density 96 "${STILLS_TMP}"/*.png "${OUT}/pitch.pdf"

echo "==> rendering full deck MP4"
npx remotion render PitchTen "${OUT}/pitch.mp4" \
  --codec=h264 --crf=23 --pixel-format=yuv420p --concurrency=6 \
  --log=error

END=$(date +%s)
echo ""
echo "Done in $((END-START))s."
echo "Artifacts:"
ls -lh "${OUT}/pitch.mp4" "${OUT}/pitch.pdf"
ls -lh "${SLIDES_OUT}/" | tail -n +2
