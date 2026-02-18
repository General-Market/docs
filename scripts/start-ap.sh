#!/bin/bash
# Start AP (Authorized Participant) Node for E2E Testing
# Reads contract addresses from deployments/active-deployment.json

set -e
cd /Users/maxguillabert/Downloads/index
export PATH="$HOME/.foundry/bin:$PATH"

# Source Bitget credentials if available (BITGET_PUB, BITGET_PK, BITGET_PASS)
if [ -f "global.env" ]; then
    set -a && source global.env && set +a
    echo "Loaded credentials from global.env"
fi

# Map global.env names → AP price fetcher env vars
export BITGET_API_KEY="${BITGET_API_KEY:-$BITGET_PUB}"
export BITGET_API_SECRET="${BITGET_API_SECRET:-$BITGET_PK}"
export BITGET_API_PASSPHRASE="${BITGET_API_PASSPHRASE:-$BITGET_PASS}"

DEPLOYMENT_FILE="deployments/active-deployment.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "Error: Deployment file not found: $DEPLOYMENT_FILE"
    echo "Run: ./scripts/sync-deployment.sh deployments/full-e2e-deployment.json"
    exit 1
fi

# Load from deployment file (fall back to env or localhost)
RPC=$(jq -r '.rpc // empty' "$DEPLOYMENT_FILE")
RPC="${RPC:-${AP_RPC_URL:-http://localhost:8545}}"
INDEX=$(jq -r '.contracts.Index' "$DEPLOYMENT_FILE")
BITGET_VAULT=$(jq -r '.contracts.MockBitgetVault' "$DEPLOYMENT_FILE")
MOCK_USDT=$(jq -r '.contracts.MOCK_USDT // .contracts.MockUSDT // empty' "$DEPLOYMENT_FILE")

# AP private key
AP_KEY="0x582978b132648fe53de139c6b9297040a2757616cac9a2fd17aa167bdc6fa340"

echo "=== Starting AP Node ==="
echo "Config: $DEPLOYMENT_FILE"
echo "RPC: $RPC"
echo "Index: $INDEX"
echo "MockBitgetVault: $BITGET_VAULT"
echo "MockUSDT: $MOCK_USDT"
echo "Data Node: http://localhost:8200"
echo ""

mkdir -p logs

echo "Starting AP on port 9100..."
AP_BINARY="target/release/ap"
if [ ! -f "$AP_BINARY" ]; then
    echo "AP binary not found at $AP_BINARY, building..."
    cargo build --release -p ap 2>&1 | tail -3
fi
AP_PRIVATE_KEY="$AP_KEY" \
"$AP_BINARY" \
    --port 9100 \
    --rpc "$RPC" \
    --index-contract "$INDEX" \
    --mock-bitget \
    --bitget-vault "$BITGET_VAULT" \
    --deployment-file "$DEPLOYMENT_FILE" \
    ${MOCK_USDT:+--mock-usdt "$MOCK_USDT"} \
    --data-node-url http://localhost:8200 \
    --log-level info \
    > logs/ap.log 2>&1 &

AP_PID=$!
echo "AP PID: $AP_PID"
echo ""
echo "AP started on port 9100"
echo "Health endpoint: http://localhost:9100/health"
echo "Check logs: tail -f logs/ap.log"
echo "To stop: pkill -f 'target/release/ap'"
