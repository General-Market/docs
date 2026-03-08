#!/bin/bash
# restart-issuers.sh — Stop and restart all 3 issuers on VPS
# Sources system.env for keys, sets all required env vars.
# Usage: ./restart-issuers.sh [--build]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Parse args ──
BUILD=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --build) BUILD=true; shift;;
        *) echo -e "${RED}Unknown: $1${NC}"; exit 1;;
    esac
done

# ── Load system.env ──
if [ -f system.env ]; then
    set -a && source system.env && set +a
else
    echo -e "${RED}No system.env found!${NC}"; exit 1
fi

# ── Config ──
RPC_URL="${ORBIT_RPC_URL:-http://142.132.164.24/}"
CHAIN_ID="${ORBIT_CHAIN_ID:-111222333}"
ISSUER_COUNT=3
LOG_LEVEL="${LOG_LEVEL:-info}"
DATA_NODE_URL="http://localhost:8200"
DEPLOYMENT_FILE="deployments/active-deployment.json"

ISSUER_KEYS=(
    ""
    "${ISSUER_1_PRIVATE_KEY}"
    "${ISSUER_2_PRIVATE_KEY}"
    "${ISSUER_3_PRIVATE_KEY}"
)

# ── Optional rebuild ──
if [ "$BUILD" = true ]; then
    echo -e "${YELLOW}Building issuer...${NC}"
    export PATH="$HOME/.cargo/bin:$PATH"
    cargo build --release -p issuer 2>&1 | tail -3
    echo -e "${GREEN}Build complete${NC}"
fi

# ── Stop existing ──
echo -e "${YELLOW}Stopping existing issuers...${NC}"
pkill -f './target/release/issuer' 2>/dev/null || true
sleep 2
# Force kill if needed
pkill -9 -f './target/release/issuer' 2>/dev/null || true
sleep 1
echo -e "${GREEN}Stopped${NC}"

# ── Write keys ──
for i in 1 2 3; do
    KEY_FILE="/tmp/issuer-key-$i.txt"
    printf "%s" "${ISSUER_KEYS[$i]}" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
done

# ── Contract addresses ──
BRIDGE_PROXY=""
if [ -f "$DEPLOYMENT_FILE" ] && command -v python3 &>/dev/null; then
    BRIDGE_PROXY=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('BridgeProxy',''))" 2>/dev/null || echo "")
fi

# ── Start issuers ──
echo -e "${YELLOW}Starting $ISSUER_COUNT issuers...${NC}"
mkdir -p logs

# ITP ID (hardcoded for now — same for all issuers)
ITP_ID="0x0000000000000000000000000000000000000000000000000000000000000001"

for i in $(seq 1 $ISSUER_COUNT); do
    PORT=$((9000 + i))
    BLS_IDX=$((i - 1))

    # Build peer list
    PEER_LIST=""
    for j in $(seq 1 $ISSUER_COUNT); do
        if [ $j -ne $i ]; then
            [ -n "$PEER_LIST" ] && PEER_LIST="$PEER_LIST,"
            PEER_LIST="${PEER_LIST}127.0.0.1:$((9000 + j))"
        fi
    done

    ISSUER_PRIVATE_KEY_PATH="/tmp/issuer-key-$i.txt" \
    ISSUER_PEERS="$PEER_LIST" \
    ISSUER_SETTLEMENT_RPC_URL="$RPC_URL" \
    ISSUER_SETTLEMENT_CHAIN_ID="$CHAIN_ID" \
    BITGET_READONLY_API_KEY="${BITGET_PUB:-dummy}" \
    BITGET_READONLY_API_SECRET="${BITGET_PK:-dummy}" \
    BITGET_READONLY_PASSPHRASE="${BITGET_PASS:-dummy}" \
    nohup ./target/release/issuer \
        --node-id $i --port $PORT --bls-key-seed-index $BLS_IDX \
        --wal-path "logs/consensus-$i.wal" \
        --rpc "$RPC_URL" \
        --cycle-duration-ms 1000 --min-cycle-gap-ms 50 --consensus-timeout-ms 800 \
        --no-tls --test-key-seeds --num-issuers $ISSUER_COUNT --signature-threshold 2 \
        --registry-sync --ntp-server "" \
        --data-node-url "$DATA_NODE_URL" \
        --deployment-file "$DEPLOYMENT_FILE" \
        --symbol-map-file data/symbol-map.json \
        --log-level "$LOG_LEVEL" \
        --from-block 9720 \
        --itp-id "$ITP_ID" \
        ${BRIDGE_PROXY:+--bridge-proxy "$BRIDGE_PROXY"} \
        > "logs/issuer-$i.log" 2>&1 &

    echo -e "  ${GREEN}Issuer $i on port $PORT (PID: $!)${NC}"
done

sleep 2

# ── Verify ──
RUNNING=$(ps aux | grep './target/release/issuer' | grep -v grep | grep -v 'bash' | wc -l)
if [ "$RUNNING" -eq "$ISSUER_COUNT" ]; then
    echo -e "${GREEN}All $ISSUER_COUNT issuers running${NC}"
else
    echo -e "${RED}Only $RUNNING/$ISSUER_COUNT issuers running! Check logs:${NC}"
    for i in $(seq 1 $ISSUER_COUNT); do
        echo "  tail -20 logs/issuer-$i.log"
    done
fi
