#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/max/index}"
SERVICE="/etc/systemd/system/x-article-radar.service"
TIMER="/etc/systemd/system/x-article-radar.timer"
ENV_FILE="/etc/x-article-radar.env"
KEY_SECRET_FILE="${TWITTERAPI_KEY_FILE:-/root/.secrets/twitterapi_io_key}"

if [[ $EUID -ne 0 ]]; then
  echo "run as root on VPS3" >&2
  exit 2
fi

if [[ ! -d "$ROOT_DIR/docs/x-targeting/x_articles" ]]; then
  echo "missing repo at $ROOT_DIR; set ROOT_DIR=/path/to/index" >&2
  exit 2
fi

mkdir -p "$(dirname "$KEY_SECRET_FILE")"
if [[ ! -f "$KEY_SECRET_FILE" ]]; then
  umask 077
  : > "$KEY_SECRET_FILE"
  echo "created empty key file: $KEY_SECRET_FILE"
  echo "write the twitterapi.io key into it before starting the timer"
fi

cat > "$ENV_FILE" <<EOF
ROOT_DIR=$ROOT_DIR
TWITTERAPI_KEY_FILE=$KEY_SECRET_FILE
X_ARTICLE_NICHES=trading-ai ai trading crypto prediction-markets polymarket pumpfun hyperliquid copy-trading
X_ARTICLE_PAGES=5
X_ARTICLE_BROAD_PAGES=8
X_ARTICLE_BROAD_NICHES=ai trading crypto polymarket pumpfun prediction-markets
X_ARTICLE_BROAD_MAX=300
X_ARTICLE_SEARCH_MODE=both
X_ARTICLE_MAX_ARTICLES=300
X_ARTICLE_MIN_VIEWS=1000
X_ARTICLE_MIN_ARTICLE_AGE_HOURS=4
X_ARTICLE_AUTHOR_MIN_AGE_HOURS=4
X_ARTICLE_BUDGET_USD=25
EOF

cat > "$SERVICE" <<EOF
[Unit]
Description=Fetch native X Articles for niche radar
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/x-article-radar.env
WorkingDirectory=$ROOT_DIR
ExecStart=/usr/bin/env bash $ROOT_DIR/docs/x-targeting/x_articles/run_daily.sh
EOF

cat > "$TIMER" <<'EOF'
[Unit]
Description=Daily native X Article radar fetch

[Timer]
OnCalendar=*-*-* 09:15:00 UTC
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now x-article-radar.timer
systemctl list-timers x-article-radar.timer --no-pager

echo "installed x-article-radar.timer"
echo "key file: $KEY_SECRET_FILE"
echo "manual run: systemctl start x-article-radar.service"
