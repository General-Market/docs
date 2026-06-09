#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/max/index}"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"
NICHES="${X_ARTICLE_NICHES:-trading-ai}"
DATE_UTC="${X_ARTICLE_DATE:-$(date -u +%F)}"
LOG_DIR="$ROOT_DIR/docs/x-targeting/x_articles/logs"

mkdir -p "$LOG_DIR"

if [[ -f "$KEY_SECRET_FILE" ]]; then
  install -m 600 "$KEY_SECRET_FILE" /tmp/.twapi_key
fi

if [[ ! -s /tmp/.twapi_key ]]; then
  echo "missing twitterapi.io key: write it to $KEY_SECRET_FILE or /tmp/.twapi_key" >&2
  exit 2
fi

for niche in $NICHES; do
  echo "[$(date -u --iso-8601=seconds)] fetch niche=$niche date=$DATE_UTC"
  python3 "$ROOT_DIR/docs/x-targeting/x_articles/find_native_x_articles.py" \
    --niche "$niche" \
    --date "$DATE_UTC" \
    --lookback-hours 24 \
    --pages "${X_ARTICLE_PAGES:-5}" \
    --search-mode "${X_ARTICLE_SEARCH_MODE:-both}" \
    --like-thresholds "${X_ARTICLE_LIKE_THRESHOLDS:-5000,2000,1000,500,250,100,50,20,10}" \
    --max-articles "${X_ARTICLE_MAX_ARTICLES:-20}" \
    --budget-usd "${X_ARTICLE_BUDGET_USD:-25}"
done 2>&1 | tee -a "$LOG_DIR/$DATE_UTC.log"
