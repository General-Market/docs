#!/usr/bin/env bash
# Monthly deep radar — 30-day lookback, niche-scoped likes ladder, by-likes report.
# The daily radar (run_daily.sh) catches new Articles; this catches the slow-moving,
# recurring themes (HIP-3, HyperEVM, HL DeFi) where one day is too thin a window.
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/max/index}"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"
# Every -30d niche: the Hyperliquid ecosystem + sub-topics, plus a 30-day deep
# variant of each daily topic. All capped at 100 (set below).
NICHES="${X_ARTICLE_MONTHLY_NICHES:-hyperliquid-30d hip3-30d hyperevm-30d hl-defi-30d ai-30d trading-30d trading-ai-30d crypto-30d polymarket-30d pumpfun-30d prediction-markets-30d}"
DATE_UTC="${X_ARTICLE_DATE:-$(date -u +%F)}"
LOG_DIR="$ROOT_DIR/docs/x-targeting/x_articles/logs"
BUDGET_USD="${X_ARTICLE_BUDGET_USD:-5}"
PAGES="${X_ARTICLE_PAGES:-5}"
ENGINE="$ROOT_DIR/docs/x-targeting/x_articles/find_native_x_articles.py"
RANKER="$ROOT_DIR/docs/x-targeting/x_articles/rank_by_likes.py"

mkdir -p "$LOG_DIR"

if [[ -f "$KEY_SECRET_FILE" ]]; then
  install -m 600 "$KEY_SECRET_FILE" /tmp/.twapi_key
fi
if [[ ! -s /tmp/.twapi_key ]]; then
  echo "missing twitterapi.io key: write it to $KEY_SECRET_FILE or /tmp/.twapi_key" >&2
  exit 2
fi

# The broad ecosystem page reaches for 100; deep sub-topics are thinner, cap at 60.
for niche in $NICHES; do
  # No tight cap — a views floor decides what belongs (everything >= MIN_VIEWS
  # stays); the high max is only a budget backstop.
  max_articles="${X_ARTICLE_MONTHLY_MAX:-500}"
  echo "[$(date -u --iso-8601=seconds)] monthly fetch niche=$niche date=$DATE_UTC max=$max_articles"
  python3 "$ENGINE" \
    --niche "$niche" \
    --date "$DATE_UTC" \
    --lookback-hours "${X_ARTICLE_LOOKBACK_HOURS:-720}" \
    --pages "$PAGES" \
    --latest-pages "${X_ARTICLE_LATEST_PAGES:-14}" \
    --search-mode both \
    --like-thresholds "${X_ARTICLE_LIKE_THRESHOLDS:-5000,2000,1000,500,250,100,50,25,10,5,2,1}" \
    --max-articles "$max_articles" \
    --min-views "${X_ARTICLE_MIN_VIEWS:-1000}" \
    --min-article-age-hours 4 \
    --author-min-age-hours 4 \
    --budget-usd "$BUDGET_USD"
  python3 "$RANKER" --niche "$niche" --date "$DATE_UTC" --top "$max_articles" --window "last 30 days"
  python3 "$RANKER" --niche "$niche" --date "$DATE_UTC" --top "$max_articles" --window "last 30 days" --sort views
done 2>&1 | tee -a "$LOG_DIR/monthly-$DATE_UTC.log"
