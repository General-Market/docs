#!/usr/bin/env bash
# Render one still per chart segment from the FinanceChartsReel composition.
# Output: out/finance-stills/chart-NN.png

set -euo pipefail
cd "$(dirname "$0")/.."

OUT="out/finance-stills"
mkdir -p "$OUT"

# Midpoint frame per chart segment (see CHART_SPECS.md schedule).
declare -a FRAMES=(75 225 375 525 675 825 990 1170 1335 1500 1665 1815)
declare -a NAMES=(01 02 03 04 05 06 07 08 09 10 11 12)

for i in "${!FRAMES[@]}"; do
  FR="${FRAMES[$i]}"
  NM="${NAMES[$i]}"
  echo "▶ rendering chart $NM @ frame $FR"
  npx remotion still src/index.ts FinanceChartsReel \
    "$OUT/chart-$NM.png" \
    --frame="$FR" \
    --log=error 2>&1 | tail -5 || echo "  (chart $NM failed)"
done

echo "done. files at $OUT/"
ls -la "$OUT"
