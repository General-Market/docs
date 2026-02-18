#!/bin/bash
# Start AP node for local E2E testing
# Usage: ./scripts/start-local-ap.sh

set -e

# Load shared Bitget credentials first (if exists)
set -a
if [ -f bitget-credentials.env ]; then
    source bitget-credentials.env
    echo "Loaded Bitget credentials from bitget-credentials.env"
fi
# Load local environment
source ap-local.env
set +a

# Chain ID for local Anvil (from local-e2e.json)
AP_CHAIN_ID="${AP_CHAIN_ID:-1234567890}"

# Build the AP binary first
echo "Building AP..."
cargo build --bin ap --release 2>/dev/null || cargo build --bin ap

echo "Starting AP node for local E2E testing..."

AP_PORT=${AP_PORT} \
AP_RPC_URL=${AP_RPC_URL} \
AP_INDEX_CONTRACT=${AP_INDEX_CONTRACT} \
AP_MOCK_BITGET=${AP_MOCK_BITGET} \
AP_BITGET_VAULT=${AP_BITGET_VAULT} \
AP_MOCK_USDT=${AP_MOCK_USDT} \
AP_DEPLOYMENT_FILE=${AP_DEPLOYMENT_FILE} \
AP_MOCK_CHAIN=${AP_MOCK_CHAIN} \
AP_PRIVATE_KEY=${AP_PRIVATE_KEY} \
AP_LOG_LEVEL=${AP_LOG_LEVEL} \
./target/debug/ap --chain-id ${AP_CHAIN_ID} > logs/ap.log 2>&1 &

AP_PID=$!
echo "AP started with PID: $AP_PID"
echo ""
echo "AP node running on:"
echo "  - API: http://localhost:${AP_PORT}"
echo "  - Log: logs/ap.log"
echo ""
echo "To stop: kill $AP_PID"
