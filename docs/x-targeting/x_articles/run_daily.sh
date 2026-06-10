#!/usr/bin/env bash
# Daily radar — 24-hour lookback over every niche.
#
# Two passes. Pass 1 gives EVERY niche its high-threshold cream (retweet ladder +
# likes >= 100 + replies ladder) before any niche descends the low rungs; pass 2
# returns for the low rungs + the deep keyword sweep, merging into pass 1's output.
# A dead run or drained budget now starves the ladder's tail, never a whole niche.
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/max/index}"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"
NICHES="${X_ARTICLE_NICHES:-trading-ai ai trading crypto prediction-markets polymarket pumpfun hyperliquid copy-trading}"
DATE_UTC="${X_ARTICLE_DATE:-$(date -u +%F)}"
LOG_DIR="$ROOT_DIR/docs/x-targeting/x_articles/logs"
# No tight cap — the views floor decides what belongs; the max is a budget backstop.
MAX_ARTICLES="${X_ARTICLE_MAX_ARTICLES:-300}"
MIN_VIEWS="${X_ARTICLE_MIN_VIEWS:-1000}"
FORCE="${X_ARTICLE_FORCE:-0}"
BROAD_NICHES="${X_ARTICLE_BROAD_NICHES:-ai trading crypto polymarket pumpfun prediction-markets}"
BROAD_MAX="${X_ARTICLE_BROAD_MAX:-300}"
FIRST_THRESHOLDS="${X_ARTICLE_LIKE_THRESHOLDS_FIRST:-5000,2000,1000,500,250,100}"
DEEP_THRESHOLDS="${X_ARTICLE_LIKE_THRESHOLDS_DEEP:-50,20,10}"

mkdir -p "$LOG_DIR"

if [[ -f "$KEY_SECRET_FILE" ]]; then
  install -m 600 "$KEY_SECRET_FILE" /tmp/.twapi_key
fi

if [[ ! -s /tmp/.twapi_key ]]; then
  echo "missing twitterapi.io key: write it to $KEY_SECRET_FILE or /tmp/.twapi_key" >&2
  exit 2
fi

niche_caps() {
  # Deeper cap + pagination for high-population niches so the ladder is not
  # truncated at the default before the long tail is reached.
  niche_max="$MAX_ARTICLES"; niche_pages="${X_ARTICLE_PAGES:-5}"
  if [[ " $BROAD_NICHES " == *" $1 "* ]]; then
    niche_max="$BROAD_MAX"; niche_pages="${X_ARTICLE_BROAD_PAGES:-8}"
  fi
}

fetch() {
  local niche="$1" pass_ladders="$2" pass_thresholds="$3"; shift 3
  python3 "$ROOT_DIR/docs/x-targeting/x_articles/find_native_x_articles.py" \
    --niche "$niche" \
    --date "$DATE_UTC" \
    --lookback-hours 24 \
    --pages "$niche_pages" \
    --search-mode "${X_ARTICLE_SEARCH_MODE:-both}" \
    --ladders "$pass_ladders" \
    --like-thresholds "$pass_thresholds" \
    --max-articles "$niche_max" \
    --min-views "$MIN_VIEWS" \
    --min-article-age-hours "${X_ARTICLE_MIN_ARTICLE_AGE_HOURS:-4}" \
    --author-min-age-hours "${X_ARTICLE_AUTHOR_MIN_AGE_HOURS:-4}" \
    --budget-usd "${X_ARTICLE_BUDGET_USD:-25}" \
    "$@"

  # Ranking companions (free, no API) — by-likes.md + by-views.md next to report.md.
  python3 "$ROOT_DIR/docs/x-targeting/x_articles/rank_by_likes.py" \
    --niche "$niche" --date "$DATE_UTC" --top "$niche_max" --window "last 24 hours" || true
  python3 "$ROOT_DIR/docs/x-targeting/x_articles/rank_by_likes.py" \
    --niche "$niche" --date "$DATE_UTC" --top "$niche_max" --window "last 24 hours" --sort views || true
}

{
  # Skip filter once, up front: a niche whose articles.jsonl is already complete
  # for today is excluded from both passes.
  RUN_NICHES=""
  for niche in $NICHES; do
    niche_caps "$niche"
    out_file="$ROOT_DIR/docs/x-targeting/x_articles/$DATE_UTC/$niche/articles.jsonl"
    if [[ "$FORCE" != "1" && -f "$out_file" ]]; then
      if python3 - "$out_file" "$niche_max" <<'PY'
import json
import sys

path, max_articles = sys.argv[1], int(sys.argv[2])
rows = [json.loads(line) for line in open(path) if line.strip()]
complete = (
    len(rows) > 0
    and len(rows) <= max_articles
    and all("views_per_1k_followers" in row and "views_vs_author_avg" in row for row in rows)
)
sys.exit(0 if complete else 1)
PY
      then
        existing_rows="$(wc -l < "$out_file" | tr -d ' ')"
        echo "[$(date -u +%FT%TZ)] skip niche=$niche date=$DATE_UTC rows=$existing_rows already_complete=1"
        continue
      fi
    fi
    RUN_NICHES="$RUN_NICHES $niche"
  done

  for niche in $RUN_NICHES; do
    niche_caps "$niche"
    echo "[$(date -u +%FT%TZ)] daily pass=1 niche=$niche date=$DATE_UTC"
    fetch "$niche" "rt,likes,replies" "$FIRST_THRESHOLDS"
  done

  for niche in $RUN_NICHES; do
    niche_caps "$niche"
    echo "[$(date -u +%FT%TZ)] daily pass=2 niche=$niche date=$DATE_UTC"
    fetch "$niche" "likes,keyword" "$DEEP_THRESHOLDS" --merge
  done
} 2>&1 | tee -a "$LOG_DIR/$DATE_UTC.log"
