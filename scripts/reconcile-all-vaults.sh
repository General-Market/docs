#!/bin/bash
# Reconcile all vaults that have stale totalActiveCapital.
# Run on VPS where DEPLOYER_PRIVATE_KEY is available.
#
# Usage: ./scripts/reconcile-all-vaults.sh
#
# This calls vault.reconcile(batchId) for every vault that has
# activeBatchDeposits[batchId] > 0 for any batch. The function is
# permissionless — anyone can call it.

set -euo pipefail

RPC="${L3_RPC_URL:-http://142.132.164.24/}"
FACTORY="0xbc418956A20DB5C343b56b6AE947AF4896b23A1e"
BATCH_JOINED_TOPIC="0x1c0ce30c1ac6de0e996765851ba43b39bbc27db1debd311ca41905a706567cdb"

# Use any funded account — reconcile is permissionless
KEY="${DEPLOYER_PRIVATE_KEY:-${BOT_PRIVATE_KEY:-}}"
if [ -z "$KEY" ]; then
  echo "ERROR: Set DEPLOYER_PRIVATE_KEY or BOT_PRIVATE_KEY"
  exit 1
fi

echo "=== Vault Reconciliation ==="
echo "RPC: $RPC"
echo "Factory: $FACTORY"

# Get all vault addresses from the whitelist in deployment.json
VAULTS=$(python3 -c "
import json
with open('frontend/lib/contracts/deployment.json') as f:
    d = json.load(f)
for v in d.get('whitelistedVaults', []):
    print(v)
" 2>/dev/null || cast call "$FACTORY" "getAllVaults()(address[])" --rpc-url "$RPC" 2>/dev/null)

TOTAL=0
RECONCILED=0
SKIPPED=0
ERRORS=0

for VAULT in $VAULTS; do
  # Check if vault has any active capital
  ACTIVE=$(cast call "$VAULT" "totalActiveCapital()(uint256)" --rpc-url "$RPC" 2>/dev/null || echo "0")

  if [ "$ACTIVE" = "0" ] || [ "$ACTIVE" = "0 [0]" ]; then
    continue
  fi

  TOTAL=$((TOTAL + 1))
  echo ""
  echo "Vault: $VAULT (activeCapital: $ACTIVE)"

  # Get all BatchJoined events for this vault
  LOGS=$(cast logs --from-block 0 --to-block latest --address "$VAULT" "$BATCH_JOINED_TOPIC" --rpc-url "$RPC" 2>/dev/null || echo "")

  if [ -z "$LOGS" ]; then
    echo "  No BatchJoined events found"
    continue
  fi

  # Extract batch IDs from topics[1] (indexed batchId)
  BATCH_IDS=$(echo "$LOGS" | grep -A1 "topics:" | grep "0x00000000" | awk '{print $1}' | sort -u)

  for BID_HEX in $BATCH_IDS; do
    BID=$((16#${BID_HEX:2}))

    # Check if this batch still has active deposits
    DEP=$(cast call "$VAULT" "activeBatchDeposits(uint256)(uint256)" "$BID" --rpc-url "$RPC" 2>/dev/null || echo "0")

    if [ "$DEP" = "0" ] || [ "$DEP" = "0 [0]" ]; then
      continue
    fi

    echo "  Reconciling batch $BID (deposit: $DEP)..."
    TX=$(cast send "$VAULT" "reconcile(uint256)" "$BID" \
      --private-key "$KEY" \
      --rpc-url "$RPC" \
      --gas-limit 200000 \
      2>&1) || true

    if echo "$TX" | grep -q "transactionHash\|success\|0x"; then
      echo "  OK: batch $BID reconciled"
      RECONCILED=$((RECONCILED + 1))
    elif echo "$TX" | grep -qi "already\|revert"; then
      echo "  Already reconciled or reverted"
      SKIPPED=$((SKIPPED + 1))
    else
      echo "  FAILED: $TX"
      ERRORS=$((ERRORS + 1))
    fi

    sleep 0.5
  done
done

echo ""
echo "=== Done ==="
echo "Vaults with active capital: $TOTAL"
echo "Batches reconciled: $RECONCILED"
echo "Skipped: $SKIPPED"
echo "Errors: $ERRORS"
