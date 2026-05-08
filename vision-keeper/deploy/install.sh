#!/usr/bin/env bash
# Install the vision-keeper on VPS 1.
# Run from the operator's machine. The script SSHes in, builds, wires systemd.
# The keeper exists so you don't have to call it. If it works, you forget it.

set -euo pipefail

REMOTE="index-maker/prod/be"
SSH_PORT="3189"
REPO="/home/max/index"
KEEPER="${REPO}/vision-keeper"
SERVICE_SRC="${KEEPER}/deploy/vision-keeper.service"
SERVICE_DST="/etc/systemd/system/vision-keeper.service"
ENV_FILE="${KEEPER}/.env"

echo "==> Installing vision-keeper on ${REMOTE}"

ssh -p "${SSH_PORT}" "${REMOTE}" bash -se <<EOF
set -euo pipefail

echo "--> Pulling latest from mono"
cd "${REPO}"
git pull

echo "--> Installing keeper dependencies"
cd "${KEEPER}"
npm install --omit=dev

echo "--> Building keeper"
# build needs typescript; install dev deps without polluting prod node_modules
npm install --include=dev --no-save typescript @types/node tsx
npm run build

echo "--> Copying systemd unit"
cp "${SERVICE_SRC}" "${SERVICE_DST}"
systemctl daemon-reload

if [ ! -f "${ENV_FILE}" ]; then
  echo ""
  echo "================================================================"
  echo "  Missing ${ENV_FILE}"
  echo ""
  echo "  Create it before the keeper can start. Required:"
  echo "    KEEPER_PRIVATE_KEY=0x..."
  echo "    L3_RPC_URL=https://rpc.generalmarket.io/"
  echo ""
  echo "  Optional: POLL_INTERVAL_SECS, LOOKBACK_SECONDS, KEEPER_HEALTH_PORT"
  echo ""
  echo "  Then re-run this script, or finish manually:"
  echo "    systemctl enable vision-keeper"
  echo "    systemctl restart vision-keeper"
  echo "================================================================"
  exit 0
fi

echo "--> Enabling and restarting service"
systemctl enable vision-keeper
systemctl restart vision-keeper

echo "--> Tailing recent logs"
sleep 2
journalctl -u vision-keeper --no-pager -n 30 || true
EOF

echo ""
echo "==> Done. Live logs: ssh -p ${SSH_PORT} ${REMOTE} 'journalctl -u vision-keeper -f'"
