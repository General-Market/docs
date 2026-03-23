#!/bin/bash
# Sets borrow rates for all deployed batch markets.
# Usage: ./scripts/set-batch-rates.sh [rate_per_second]
# Default rate: 1585489599 (5% APR)
#
# Reads market IDs from deployments/batch-markets.json
# Calls CuratorRateIRM.setRates() via forge script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
BATCH_FILE="$ROOT/deployments/batch-markets.json"
MORPHO_FILE="$ROOT/deployments/morpho-deployment.json"

if [ ! -f "$BATCH_FILE" ]; then
    echo "ERROR: $BATCH_FILE not found"
    exit 1
fi

# Extract market IDs from batch-markets.json
MARKET_IDS=$(jq -r '.markets[].marketId' "$BATCH_FILE" | paste -sd, -)
CURATOR_IRM=$(jq -r '.infrastructure.CURATOR_RATE_IRM // .contracts.CURATOR_RATE_IRM' "$BATCH_FILE" 2>/dev/null || jq -r '.contracts.CURATOR_RATE_IRM' "$MORPHO_FILE")
RATE="${1:-1585489599}"
COUNT=$(echo "$MARKET_IDS" | tr ',' '\n' | wc -l | tr -d ' ')

echo "Setting rates for $COUNT markets"
echo "CuratorRateIRM: $CURATOR_IRM"
echo "Rate per-sec WAD: $RATE"

cd "$ROOT/contracts"

CURATOR_RATE_IRM="$CURATOR_IRM" \
BORROW_RATE="$RATE" \
MARKET_IDS="$MARKET_IDS" \
forge script script/SetBatchRates.s.sol --broadcast --rpc-url "$RPC_URL"

echo "Done."
