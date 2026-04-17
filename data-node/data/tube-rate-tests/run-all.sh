#!/usr/bin/env bash
# Run the empirical rate-limit ramp against every harvestable tube.
# Sequential, tightest ramp first, short steps. Output per-tube CSVs +
# a summary.
set -uo pipefail

BIN="$(cd "$(dirname "$0")/../../../target/release/examples" && pwd)/test_tube_scrape"
DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$(dirname "$0")"
STEP_SECS="${STEP_SECS:-15}"

# Order: Cloudflare-protected first (so we see the ceiling cleanly),
# Txxx excluded (JS-rendered).
TUBES=(pornhub xvideos xhamster xnxx redtube youporn eporner)

echo "=== binary: $BIN ==="
echo "=== step_secs: $STEP_SECS ==="
echo

SUMMARY="$OUT_DIR/summary.tsv"
: > "$SUMMARY"
printf "site\ttotal\tok\th429\th403\th5xx\tchal\tneterr\n" >> "$SUMMARY"

for t in "${TUBES[@]}"; do
  URLS="$DATA_DIR/test-urls-$t.txt"
  OUT="$OUT_DIR/rate-test-$t.csv"
  if [[ ! -s "$URLS" ]]; then
    echo "--- skip $t (no URLs) ---"
    continue
  fi
  echo "==== $t ===="
  "$BIN" --site "$t" --urls-file "$URLS" --output "$OUT" --step-secs "$STEP_SECS" 2>&1 \
    | tee "$OUT_DIR/log-$t.txt"

  # Pull counters from the final TOTALS line printed by the binary
  line=$(grep -E 'TOTALS' "$OUT_DIR/log-$t.txt" | tail -1)
  n=$(echo "$line" | grep -oE 'n=[0-9]+' | head -1 | cut -d= -f2)
  ok=$(echo "$line" | grep -oE 'ok=[0-9]+' | head -1 | cut -d= -f2)
  r429=$(echo "$line" | grep -oE '429=[0-9]+' | head -1 | cut -d= -f2)
  r403=$(echo "$line" | grep -oE '403=[0-9]+' | head -1 | cut -d= -f2)
  r5xx=$(echo "$line" | grep -oE '5xx=[0-9]+' | head -1 | cut -d= -f2)
  ch=$(echo "$line" | grep -oE 'chal=[0-9]+' | head -1 | cut -d= -f2)
  ne=$(echo "$line" | grep -oE 'neterr=[0-9]+' | head -1 | cut -d= -f2)
  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$t" "${n:-0}" "${ok:-0}" "${r429:-0}" "${r403:-0}" "${r5xx:-0}" "${ch:-0}" "${ne:-0}" \
    >> "$SUMMARY"
  echo
done

echo "=== DONE — summary ==="
column -t -s $'\t' "$SUMMARY"
