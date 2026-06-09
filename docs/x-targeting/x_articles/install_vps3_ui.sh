#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/root/index}"
SERVICE="/etc/systemd/system/x-article-radar-ui.service"
PORT="${X_ARTICLE_UI_PORT:-3010}"
HOST="${X_ARTICLE_UI_HOST:-0.0.0.0}"

if [[ $EUID -ne 0 ]]; then
  echo "run as root on VPS3" >&2
  exit 2
fi

if [[ ! -f "$ROOT_DIR/docs/x-targeting/x_articles/ui/server.mjs" ]]; then
  echo "missing UI server at $ROOT_DIR/docs/x-targeting/x_articles/ui/server.mjs" >&2
  exit 2
fi

cat > "$SERVICE" <<EOF
[Unit]
Description=Native X Article radar UI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT_DIR
Environment=HOST=$HOST
Environment=PORT=$PORT
ExecStart=/usr/bin/env node $ROOT_DIR/docs/x-targeting/x_articles/ui/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now x-article-radar-ui.service
systemctl status x-article-radar-ui.service --no-pager -l

echo "public UI: http://159.195.77.160:$PORT"
