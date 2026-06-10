#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/root/index}"
SERVICE="/etc/systemd/system/x-article-radar-ui.service"
PORT="${X_ARTICLE_UI_PORT:-3010}"
HOST="${X_ARTICLE_UI_HOST:-0.0.0.0}"
# Codex reply drafts — reuse the family-chat / docs-AI login on VPS3.
CODEX_BIN="${CODEX_BIN:-codex}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5.5}"
CODEX_HOME="${CODEX_HOME:-/opt/docsai/.codex}"
CODEX_HOME_DIR="${CODEX_HOME_DIR:-/opt/docsai}"

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
Environment=CODEX_BIN=$CODEX_BIN
Environment=CODEX_MODEL=$CODEX_MODEL
Environment=CODEX_HOME=$CODEX_HOME
Environment=CODEX_HOME_DIR=$CODEX_HOME_DIR
ExecStart=/usr/bin/env node $ROOT_DIR/docs/x-targeting/x_articles/ui/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable x-article-radar-ui.service
# restart (not just enable --now) so an already-running service loads new code + env
systemctl restart x-article-radar-ui.service
systemctl status x-article-radar-ui.service --no-pager -l

echo "public UI: http://159.195.77.160:$PORT"
