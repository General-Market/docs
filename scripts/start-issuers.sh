#!/bin/bash
# Start 3 Issuer Nodes for E2E Testing
# Reads contract addresses from deployments/active-deployment.json
#
# Uses wall-clock aligned cycles (no --start-cycle) so nodes stay
# synchronized regardless of boot time stagger.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
export PATH="$HOME/.foundry/bin:$PATH"

# Source system config if available (BITGET_PUB, BITGET_PK, BITGET_PASS)
if [ -f "system.env" ]; then
    set -a && source system.env && set +a
    echo "Loaded credentials from system.env"
fi

# Map system.env names → issuer read-only env vars
export BITGET_READONLY_API_KEY="${BITGET_READONLY_API_KEY:-$BITGET_PUB}"
export BITGET_READONLY_API_SECRET="${BITGET_READONLY_API_SECRET:-$BITGET_PK}"
export BITGET_READONLY_PASSPHRASE="${BITGET_READONLY_PASSPHRASE:-$BITGET_PASS}"

DEPLOYMENT_FILE="deployments/active-deployment.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "Error: Deployment file not found: $DEPLOYMENT_FILE"
    echo "Run: ./scripts/sync-deployment.sh deployments/full-e2e-deployment.json"
    exit 1
fi

# Helper: read JSON field (works with python3, no jq needed)
jval() { python3 -c "import json,sys; d=json.load(open('$DEPLOYMENT_FILE')); v=$1; print(v if v else '')" 2>/dev/null; }

# Load from env var → deployment file → localhost fallback
if [ -z "$RPC" ]; then
    RPC=$(jval "d.get('rpc','')")
fi
RPC="${RPC:-${ISSUER_RPC_URL:-http://localhost:8545}}"
INDEX=$(jval "d['contracts']['Index']")
GOVERNANCE=$(jval "d['contracts']['Governance']")
ISSUER_REG=$(jval "d['contracts']['IssuerRegistry']")
BRIDGE_PROXY=$(jval "d['contracts']['BridgeProxy']")
BITGET_VAULT=$(jval "d['contracts']['MockBitgetVault']")
MOCK_USDT=$(jval "d['contracts'].get('MOCK_USDT', d['contracts'].get('MockUSDT',''))")
VISION=$(jval "d['contracts'].get('Vision','')")
ARB_CUSTODY=$(jval "d['contracts'].get('ArbBridgeCustody','')")
BLS_CUSTODY=$(jval "d['contracts'].get('BLSCustody','')")
CHAIN_ID=$(jval "d['chainId']")

# Issuer private keys
ISSUER_1_KEY="${ISSUER_1_KEY:-0x355faf10c89b4aa1c96964b4d7b38ed5844eea436bd1ae8029cb073d3d3355ff}"
ISSUER_2_KEY="${ISSUER_2_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
ISSUER_3_KEY="${ISSUER_3_KEY:-0xd518d48628681d00fe0b35ff9cca3f354e8197eab2ab4b010e1274eccc3e8775}"

echo "=== Starting 3 Issuer Nodes ==="
echo "Config: $DEPLOYMENT_FILE"
echo "RPC: $RPC"
echo "IssuerRegistry: $ISSUER_REG"
echo "BridgeProxy: $BRIDGE_PROXY"
echo "MockBitgetVault: $BITGET_VAULT"
echo "Exchange Mode: ${EXCHANGE_MODE:-mock}"
echo "Bitget Readonly Key: ${BITGET_READONLY_API_KEY:+set (${#BITGET_READONLY_API_KEY} chars)}"
echo ""

# Kill any existing issuer processes
pkill -9 -f 'target/release/issuer' 2>/dev/null || true
sleep 0.5

mkdir -p logs

# Common env vars
export EXCHANGE_MODE="${EXCHANGE_MODE:-mock}"
export ISSUER_RPC_URL="$RPC"
export ISSUER_INDEX_ADDRESS="$INDEX"
export ISSUER_GOVERNANCE_ADDRESS="$GOVERNANCE"
export ISSUER_ISSUER_REGISTRY_ADDRESS="$ISSUER_REG"
export ISSUER_BRIDGE_PROXY_ADDRESS="$BRIDGE_PROXY"
export ISSUER_BITGET_VAULT="$BITGET_VAULT"
export ISSUER_MOCK_USDT="$MOCK_USDT"
# Vision CLI args (only when Vision contract is deployed)
VISION_ARGS=""
if [ -n "$VISION" ] && [ "$VISION" != "null" ]; then
    VISION_DB="${VISION_DATABASE_URL:-postgres://max:max@localhost/index_prices}"
    VISION_ARGS="--vision-enabled --vision-address $VISION --vision-database-url $VISION_DB --vision-data-node-url http://localhost:8200 --vision-rpc-ws-url $RPC"
    echo "Vision: $VISION (DB: $VISION_DB)"
fi
export ISSUER_ARBITRUM_CHAIN_ID="$CHAIN_ID"
export ISSUER_ARBITRUM_RPC_URL="$RPC"
export ISSUER_DEPLOYMENT_FILE="$DEPLOYMENT_FILE"

BINARY="./target/release/issuer"

# Start all 3 issuers simultaneously (no sleep between starts!)
# Wall-clock aligned mode: cycles derived from unix_timestamp_ms / cycle_duration_ms
# --num-issuers 3: must match actual number of running nodes
echo "Starting Issuer 1 on port 9001..."
ISSUER_NODE_ID=1 \
ISSUER_PRIVATE_KEY="$ISSUER_1_KEY" \
ISSUER_PEERS="127.0.0.1:9002,127.0.0.1:9003" \
$BINARY \
    --node-id 1 \
    --port 9001 \
    --cycle-duration-ms 1000 \
    --min-cycle-gap-ms 50 \
    --consensus-timeout-ms 800 \
    --no-tls \
    --bridge-proxy "$BRIDGE_PROXY" \
    --test-key-seeds \
    --bls-key-seed-index 0 \
    --signature-threshold 2 \
    --num-issuers 3 \
    --registry-sync \
    --ntp-server "" \
    --data-node-url http://localhost:8200 \
    --itp-id 0x0000000000000000000000000000000000000000000000000000000000000001 \
    --deployment-file "$DEPLOYMENT_FILE" \
    ${ARB_CUSTODY:+--arb-custody "$ARB_CUSTODY"} \
    ${BLS_CUSTODY:+--issuer-custody-arb "$BLS_CUSTODY"} \
    --symbol-map-file data/symbol-map.json \
    --wal-path logs/consensus-1.wal \
    $VISION_ARGS \
    > logs/issuer-1.log 2>&1 &
ISSUER_1_PID=$!

echo "Starting Issuer 2 on port 9002..."
ISSUER_NODE_ID=2 \
ISSUER_PRIVATE_KEY="$ISSUER_2_KEY" \
ISSUER_PEERS="127.0.0.1:9001,127.0.0.1:9003" \
$BINARY \
    --node-id 2 \
    --port 9002 \
    --cycle-duration-ms 1000 \
    --min-cycle-gap-ms 50 \
    --consensus-timeout-ms 800 \
    --no-tls \
    --bridge-proxy "$BRIDGE_PROXY" \
    --test-key-seeds \
    --bls-key-seed-index 1 \
    --signature-threshold 2 \
    --num-issuers 3 \
    --registry-sync \
    --ntp-server "" \
    --data-node-url http://localhost:8200 \
    --itp-id 0x0000000000000000000000000000000000000000000000000000000000000001 \
    --deployment-file "$DEPLOYMENT_FILE" \
    ${ARB_CUSTODY:+--arb-custody "$ARB_CUSTODY"} \
    ${BLS_CUSTODY:+--issuer-custody-arb "$BLS_CUSTODY"} \
    --symbol-map-file data/symbol-map.json \
    --wal-path logs/consensus-2.wal \
    $VISION_ARGS \
    > logs/issuer-2.log 2>&1 &
ISSUER_2_PID=$!

echo "Starting Issuer 3 on port 9003..."
ISSUER_NODE_ID=3 \
ISSUER_PRIVATE_KEY="$ISSUER_3_KEY" \
ISSUER_PEERS="127.0.0.1:9001,127.0.0.1:9002" \
$BINARY \
    --node-id 3 \
    --port 9003 \
    --cycle-duration-ms 1000 \
    --min-cycle-gap-ms 50 \
    --consensus-timeout-ms 800 \
    --no-tls \
    --bridge-proxy "$BRIDGE_PROXY" \
    --test-key-seeds \
    --bls-key-seed-index 2 \
    --signature-threshold 2 \
    --num-issuers 3 \
    --registry-sync \
    --ntp-server "" \
    --data-node-url http://localhost:8200 \
    --itp-id 0x0000000000000000000000000000000000000000000000000000000000000001 \
    --deployment-file "$DEPLOYMENT_FILE" \
    ${ARB_CUSTODY:+--arb-custody "$ARB_CUSTODY"} \
    ${BLS_CUSTODY:+--issuer-custody-arb "$BLS_CUSTODY"} \
    --symbol-map-file data/symbol-map.json \
    --wal-path logs/consensus-3.wal \
    $VISION_ARGS \
    > logs/issuer-3.log 2>&1 &
ISSUER_3_PID=$!

echo ""
echo "All 3 issuers started simultaneously!"
echo "PIDs: $ISSUER_1_PID $ISSUER_2_PID $ISSUER_3_PID"
echo "Check logs: tail -f logs/issuer-*.log"
echo "To stop: pkill -f 'target/release/issuer'"
