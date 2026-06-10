#!/usr/bin/env bash
# Monthly deep radar — 30-day lookback, niche-scoped likes ladder, by-likes report.
# The daily radar (run_daily.sh) catches new Articles; this catches the slow-moving,
# recurring themes (HIP-3, HyperEVM, HL DeFi) where one day is too thin a window.
#
# Two passes. Pass 1 gives EVERY niche its high-threshold cream (retweet ladder +
# likes >= 100 + replies ladder) before any niche descends the low rungs; pass 2
# returns for the low rungs + the deep keyword sweep, merging into pass 1's output.
# A dead run or drained budget now starves the ladder's tail, never a whole niche.
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/max/index}"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"
# Every -30d niche: the Hyperliquid ecosystem + sub-topics, plus a 30-day deep
# variant of each daily topic. All capped at 100 (set below).
NICHES="${X_ARTICLE_MONTHLY_NICHES:-hyperliquid-30d hip3-30d hip4-30d hyperevm-30d hl-defi-30d ai-30d trading-30d trading-ai-30d crypto-30d polymarket-30d pumpfun-30d prediction-markets-30d copy-trading-30d}"
DATE_UTC="${X_ARTICLE_DATE:-$(date -u +%F)}"
LOG_DIR="$ROOT_DIR/docs/x-targeting/x_articles/logs"
BUDGET_USD="${X_ARTICLE_BUDGET_USD:-5}"
PAGES="${X_ARTICLE_PAGES:-10}"
FIRST_THRESHOLDS="${X_ARTICLE_LIKE_THRESHOLDS_FIRST:-5000,2000,1000,500,250,100}"
DEEP_THRESHOLDS="${X_ARTICLE_LIKE_THRESHOLDS_DEEP:-50,25,10,5,2,1}"
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

# No tight cap — a views floor decides what belongs (everything >= MIN_VIEWS
# stays); the high max is only a budget backstop.
max_articles="${X_ARTICLE_MONTHLY_MAX:-500}"

fetch() {
  local niche="$1" pass_ladders="$2" pass_thresholds="$3"; shift 3
  python3 "$ENGINE" \
    --niche "$niche" \
    --date "$DATE_UTC" \
    --lookback-hours "${X_ARTICLE_LOOKBACK_HOURS:-720}" \
    --pages "$PAGES" \
    --latest-pages "${X_ARTICLE_LATEST_PAGES:-50}" \
    --search-mode both \
    --ladders "$pass_ladders" \
    --like-thresholds "$pass_thresholds" \
    --max-articles "$max_articles" \
    --min-views "${X_ARTICLE_MIN_VIEWS:-1000}" \
    --min-article-age-hours 4 \
    --author-min-age-hours 4 \
    --budget-usd "$BUDGET_USD" \
    "$@"
  python3 "$RANKER" --niche "$niche" --date "$DATE_UTC" --top "$max_articles" --window "last 30 days"
  python3 "$RANKER" --niche "$niche" --date "$DATE_UTC" --top "$max_articles" --window "last 30 days" --sort views
}

{
  for niche in $NICHES; do
    echo "[$(date -u +%FT%TZ)] monthly pass=1 niche=$niche date=$DATE_UTC max=$max_articles"
    fetch "$niche" "rt,likes,replies" "$FIRST_THRESHOLDS"
  done

  for niche in $NICHES; do
    echo "[$(date -u +%FT%TZ)] monthly pass=2 niche=$niche date=$DATE_UTC max=$max_articles"
    fetch "$niche" "likes,keyword" "$DEEP_THRESHOLDS" --merge
  done
} 2>&1 | tee -a "$LOG_DIR/monthly-$DATE_UTC.log"
