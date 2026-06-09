#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/max/index}"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"
NICHES="${X_ARTICLE_NICHES:-trading-ai ai trading crypto prediction-markets polymarket pumpfun hyperliquid}"
DATE_UTC="${X_ARTICLE_DATE:-$(date -u +%F)}"
LOG_DIR="$ROOT_DIR/docs/x-targeting/x_articles/logs"
MAX_ARTICLES="${X_ARTICLE_MAX_ARTICLES:-20}"
FORCE="${X_ARTICLE_FORCE:-0}"

mkdir -p "$LOG_DIR"

if [[ -f "$KEY_SECRET_FILE" ]]; then
  install -m 600 "$KEY_SECRET_FILE" /tmp/.twapi_key
fi

if [[ ! -s /tmp/.twapi_key ]]; then
  echo "missing twitterapi.io key: write it to $KEY_SECRET_FILE or /tmp/.twapi_key" >&2
  exit 2
fi

for niche in $NICHES; do
  out_file="$ROOT_DIR/docs/x-targeting/x_articles/$DATE_UTC/$niche/articles.jsonl"
  if [[ "$FORCE" != "1" && -f "$out_file" ]]; then
    if python3 - "$out_file" "$MAX_ARTICLES" <<'PY'
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
      echo "[$(date -u --iso-8601=seconds)] skip niche=$niche date=$DATE_UTC rows=$existing_rows already_complete=1"
      continue
    fi
  fi

  echo "[$(date -u --iso-8601=seconds)] fetch niche=$niche date=$DATE_UTC"
  python3 "$ROOT_DIR/docs/x-targeting/x_articles/find_native_x_articles.py" \
    --niche "$niche" \
    --date "$DATE_UTC" \
    --lookback-hours 24 \
    --pages "${X_ARTICLE_PAGES:-5}" \
    --search-mode "${X_ARTICLE_SEARCH_MODE:-both}" \
    --like-thresholds "${X_ARTICLE_LIKE_THRESHOLDS:-5000,2000,1000,500,250,100,50,20,10}" \
    --max-articles "$MAX_ARTICLES" \
    --min-article-age-hours "${X_ARTICLE_MIN_ARTICLE_AGE_HOURS:-4}" \
    --author-min-age-hours "${X_ARTICLE_AUTHOR_MIN_AGE_HOURS:-4}" \
    --budget-usd "${X_ARTICLE_BUDGET_USD:-25}"

  # By-likes companion (free, no API) — emits by-likes.md next to report.md.
  python3 "$ROOT_DIR/docs/x-targeting/x_articles/rank_by_likes.py" \
    --niche "$niche" --date "$DATE_UTC" --top "$MAX_ARTICLES" --window "last 24 hours" || true
done 2>&1 | tee -a "$LOG_DIR/$DATE_UTC.log"
