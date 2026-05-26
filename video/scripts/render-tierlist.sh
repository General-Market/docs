#!/usr/bin/env bash
# Render TierListReel without the pain.
#
# The whole video/public dir is ~7.6 GB (anticheat-edit + broll assets). Remotion
# copies the entire public dir into its bundle on every render, so a comp that
# needs only source-imgs (~4 MB) still pays a 7.6 GB copy — minutes long, and a
# wide window for the `remotion` restart script's `pkill -f remotion` to kill the
# worker (the exit-144 deaths).
#
# This hands Remotion a slim public dir holding only source-imgs (symlinked, so
# it never goes stale). Renders drop from "killed after minutes" to a few seconds.
#
# Usage:
#   scripts/render-tierlist.sh                 # -> ~/Downloads/TierListReel.mp4
#   scripts/render-tierlist.sh out.mp4         # -> custom path
set -euo pipefail
cd "$(dirname "$0")/.."

SLIM="$(mktemp -d)/public"
trap 'rm -rf "$(dirname "$SLIM")"' EXIT
mkdir -p "$SLIM"
ln -sfn "$PWD/public/source-imgs" "$SLIM/source-imgs"

OUT="${1:-$HOME/Downloads/TierListReel.mp4}"
npx remotion render src/index.ts TierListReel "$OUT" --public-dir="$SLIM"
echo "→ $OUT"
