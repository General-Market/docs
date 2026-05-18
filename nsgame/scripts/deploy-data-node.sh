#!/bin/bash
#
# Deploy data-node to VPS 3.
#
# VPS 3 only has `common` and `data-node` checked out — the other workspace
# members (oracle, ap, curator, itp-bot) never made it across. Cargo.vps3.toml
# is a slim manifest that lists only those two members. Sync the slim manifest
# alongside the source, then build and restart the systemd unit.
#
# Run from the mono root. Requires SSH config alias `vps3` (port 3189, root).

set -euo pipefail

MONO_ROOT="$(git rev-parse --show-toplevel)"
cd "$MONO_ROOT"

VPS_HOST="root@159.195.77.160"
VPS_PORT="3189"

echo "[deploy-data-node] syncing data-node/ to VPS 3"
rsync -az --exclude='target/' -e "ssh -p ${VPS_PORT}" data-node/ "${VPS_HOST}:/root/index/data-node/"

echo "[deploy-data-node] syncing common/ to VPS 3"
rsync -az --exclude='target/' -e "ssh -p ${VPS_PORT}" common/ "${VPS_HOST}:/root/index/common/"

echo "[deploy-data-node] installing slim Cargo.toml"
rsync -az -e "ssh -p ${VPS_PORT}" Cargo.vps3.toml "${VPS_HOST}:/root/index/Cargo.toml"

echo "[deploy-data-node] building and restarting on VPS 3"
ssh vps3 'cd /root/index && cargo build --release --bin data-node && install -m 0755 target/release/data-node /usr/local/bin/nsgame-data-node && systemctl restart nsgame-data-node && systemctl is-active nsgame-data-node'

echo "[deploy-data-node] done"
