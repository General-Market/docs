#!/bin/bash
# Install systemd timer that calls OracleRegistry.refreshSnapshot() every 4h.
#
# Why this exists:
# The oracle's mirror_sync_task already tries to call refreshSnapshot, but
# it's gated on msg.sender being a registered oracle EOA. The current
# OracleRegistry was deployed with Anvil's default keys (#1, #2, #3) as
# the registered oracle .addr fields; the oracle service signs from a
# different keyset (ORACLE_PRIVATE_KEY + ORACLE_FLEET_KEYS). BLS verification
# is happy — same BLS pubkeys — but `refreshSnapshot()` reverts Unauthorized.
#
# Without the snapshot blockNumber being bumped, every BLS-verified L3 call
# (createBatch, settleBatch) reverts with BLSVerifier__SnapshotTooOld once
# the parent chain advances 86400 blocks past the snapshot (~24h on Sonic).
# The whole Vision pipeline freezes.
#
# This timer uses Anvil key #1 — which IS registered — to keep the snapshot
# fresh until the oracle service is taught to call refreshSnapshot itself
# (or the registry is repaired with the real oracle EOAs).
#
# Run on VPS 1 as root:
#   bash scripts/install-refresh-l3-snapshot.sh
#
# Inspect:
#   systemctl list-timers refresh-l3-snapshot.timer
#   tail -50 /var/log/refresh-l3-snapshot.log

set -e

mkdir -p /root/bin

cat > /root/bin/refresh-l3-snapshot.sh <<'SCRIPT'
#!/bin/bash
set -e
RPC=https://rpc.generalmarket.io/
REG=0xd4c6b4a1A3579150993EdD6B5f46aA45d395480b
PRIV=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
LOG=/var/log/refresh-l3-snapshot.log
{
  echo "=== $(date -u +%FT%TZ) refreshSnapshot ==="
  /root/.foundry/bin/cast send "$REG" "refreshSnapshot()" \
    --rpc-url "$RPC" --private-key "$PRIV" --gas-limit 200000 \
    --json 2>&1 | head -50 || true
} >> "$LOG" 2>&1
SCRIPT
chmod +x /root/bin/refresh-l3-snapshot.sh

cat > /etc/systemd/system/refresh-l3-snapshot.service <<UNIT
[Unit]
Description=Refresh L3 OracleRegistry snapshot (Anvil-key workaround)
After=network-online.target

[Service]
Type=oneshot
ExecStart=/root/bin/refresh-l3-snapshot.sh
UNIT

cat > /etc/systemd/system/refresh-l3-snapshot.timer <<UNIT
[Unit]
Description=Run refresh-l3-snapshot every 4 hours

[Timer]
OnBootSec=2min
OnUnitActiveSec=4h
Unit=refresh-l3-snapshot.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now refresh-l3-snapshot.timer
systemctl list-timers refresh-l3-snapshot.timer --no-pager
