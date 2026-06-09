#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/root/index}"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"
TARGET="${X_ENGAGEMENT_TARGET:-100xgemfinder}"
DATE_UTC="${X_ENGAGEMENT_DATE:-$(date -u +%F)}"
MAX_QUEUE="${X_ENGAGEMENT_MAX_QUEUE:-15}"
FORCE="${X_ENGAGEMENT_FORCE:-0}"
LOG_DIR="$ROOT_DIR/docs/x-targeting/engagement_queue/logs"
TARGET_DIR="$(echo "$TARGET" | tr '[:upper:]' '[:lower:]' | sed 's/^@//')"
OUT_FILE="$ROOT_DIR/docs/x-targeting/engagement_queue/$DATE_UTC/$TARGET_DIR/queue.jsonl"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/$DATE_UTC.log") 2>&1

if [[ -f "$KEY_SECRET_FILE" ]]; then
  install -m 600 "$KEY_SECRET_FILE" /tmp/.twapi_key
fi

if [[ ! -s /tmp/.twapi_key ]]; then
  echo "missing twitterapi.io key: write it to $KEY_SECRET_FILE or /tmp/.twapi_key" >&2
  exit 2
fi

if [[ "$FORCE" != "1" && -f "$OUT_FILE" ]]; then
  if python3 - "$OUT_FILE" <<'PY'
import json
import sys

path = sys.argv[1]
rows = [json.loads(line) for line in open(path) if line.strip()]
complete = len(rows) > 0 and all(
    "handle" in row
    and "tweet_url" in row
    and "bot_risk" in row
    and "source_strategy" in row
    and "lookback_hours" in row
    and "data_hook" in row
    and "reply_draft" in row
    for row in rows
)
sys.exit(0 if complete else 1)
PY
  then
    existing_rows="$(wc -l < "$OUT_FILE" | tr -d ' ')"
    echo "[$(date -u --iso-8601=seconds)] skip target=$TARGET date=$DATE_UTC rows=$existing_rows already_done=1"
    exit 0
  fi
fi

echo "[$(date -u --iso-8601=seconds)] fetch target=$TARGET date=$DATE_UTC"
python3 "$ROOT_DIR/docs/x-targeting/engagement_queue/find_engagement_queue.py" \
  --target "$TARGET" \
  --date "$DATE_UTC" \
  --lookback-hours "${X_ENGAGEMENT_LOOKBACK_HOURS:-24}" \
  --target-posts "${X_ENGAGEMENT_TARGET_POSTS:-8}" \
  --pages "${X_ENGAGEMENT_PAGES:-3}" \
  --around-handles "${X_ENGAGEMENT_AROUND_HANDLES:-10}" \
  --around-pages "${X_ENGAGEMENT_AROUND_PAGES:-1}" \
  --max-queue "$MAX_QUEUE" \
  --max-bot-risk "${X_ENGAGEMENT_MAX_BOT_RISK:-2}" \
  --budget-usd "${X_ENGAGEMENT_BUDGET_USD:-10}"
