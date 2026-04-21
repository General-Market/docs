#!/usr/bin/env bash
# Preflight balance check for the prediction-market oracle daemon (SA14).
# Refuses to start if the keypair holds less than MIN_SOL_BALANCE.
#
# The daemon itself re-checks this at boot using an RPC read. This script
# adds a second layer via the `solana` CLI — a belt on top of the
# suspenders — so systemd's ExecStartPre blocks exec before the Rust
# process even spins up.

set -euo pipefail

: "${ORACLE_KEYPAIR:?ORACLE_KEYPAIR is not set}"
: "${RPC_URL:?RPC_URL is not set}"
MIN_SOL_BALANCE="${MIN_SOL_BALANCE:-0.1}"

BALANCE_STR=$(solana balance "$(solana address -k "$ORACLE_KEYPAIR")" --url "$RPC_URL" | awk '{print $1}')

awk -v b="$BALANCE_STR" -v m="$MIN_SOL_BALANCE" 'BEGIN { exit !(b+0 >= m+0) }' || {
    echo "preflight: balance $BALANCE_STR SOL is below floor $MIN_SOL_BALANCE; refusing to start" >&2
    exit 1
}

echo "preflight: balance $BALANCE_STR SOL ok"
