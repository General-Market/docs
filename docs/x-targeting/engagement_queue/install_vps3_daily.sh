#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/root/index}"
SERVICE_NAME="x-engagement-queue"
TIMER_NAME="$SERVICE_NAME.timer"

chmod 755 "$ROOT_DIR/docs/x-targeting/engagement_queue/run_daily.sh"

cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=X engagement queue manual fetch
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$ROOT_DIR
Environment=ROOT_DIR=$ROOT_DIR
Environment=X_ENGAGEMENT_TARGET=100xgemfinder
Environment=X_ENGAGEMENT_MAX_QUEUE=15
ExecStart=$ROOT_DIR/docs/x-targeting/engagement_queue/run_daily.sh
EOF

systemctl disable --now "$TIMER_NAME" >/dev/null 2>&1 || true
rm -f "/etc/systemd/system/$TIMER_NAME"

systemctl daemon-reload
systemctl status "$SERVICE_NAME.service" --no-pager || true
