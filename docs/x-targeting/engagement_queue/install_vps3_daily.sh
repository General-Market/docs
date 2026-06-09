#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/root/index}"
SERVICE_NAME="x-engagement-queue"

chmod 755 "$ROOT_DIR/docs/x-targeting/engagement_queue/run_daily.sh"

cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=X engagement queue daily fetch
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

cat > "/etc/systemd/system/$SERVICE_NAME.timer" <<EOF
[Unit]
Description=Run X engagement queue daily

[Timer]
OnCalendar=*-*-* 10:15:00 UTC
Persistent=true
RandomizedDelaySec=900

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME.timer"
systemctl list-timers "$SERVICE_NAME.timer" --no-pager
