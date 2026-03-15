#!/bin/bash
# vps-deploy.sh — Build, upload, and start data-node + oracles on VPS 1
#
# Runs locally on macOS. Cross-compiles for Linux x86_64, SCPs binaries
# + config to VPS 1, sets up PostgreSQL tunnel to VPS 2, then starts services.
#
# Usage:
#   ./vps-deploy.sh                 # Full deploy (build + upload + start)
#   ./vps-deploy.sh --skip-build    # Upload + start (reuse existing binaries)
#   ./vps-deploy.sh --stop          # Stop all services on VPS 1
#   ./vps-deploy.sh --logs          # Tail remote logs
#   ./vps-deploy.sh --status        # Check service health

set -euo pipefail

# ============ Configuration ============
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# SSH
BASTION="max@65.109.10.32"
BASTION_PORT=3189
VPS1_IP="116.203.156.98"
VPS1_PORT=3189
VPS1_USER="max"
VPS2_IP="142.132.164.24"
REMOTE_DIR="/home/max/index"

# Chain — Orbit L3 on VPS 2
RPC_URL="${RPC_URL:-http://142.132.164.24/}"
CHAIN_ID="${CHAIN_ID:-111222333}"

# Oracles
ORACLE_COUNT="${ORACLE_COUNT:-3}"
CYCLE_DURATION_MS="${CYCLE_DURATION_MS:-1000}"
CONSENSUS_TIMEOUT_MS="${CONSENSUS_TIMEOUT_MS:-800}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Cross-compile target
LINUX_TARGET="x86_64-unknown-linux-gnu"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============ SSH Helpers ============
ssh_vps1() {
    ssh -o StrictHostKeyChecking=no -J "${BASTION}:${BASTION_PORT}" -p "$VPS1_PORT" "${VPS1_USER}@${VPS1_IP}" "$@"
}

scp_to_vps1() {
    scp -o StrictHostKeyChecking=no -o "ProxyJump=${BASTION}:${BASTION_PORT}" -P "$VPS1_PORT" "$@"
}

rsync_to_vps1() {
    rsync -avz --progress \
        -e "ssh -o StrictHostKeyChecking=no -J ${BASTION}:${BASTION_PORT} -p ${VPS1_PORT}" \
        "$@"
}

# ============ Parse Args ============
SKIP_BUILD=false
STOP_ONLY=false
TAIL_LOGS=false
STATUS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build) SKIP_BUILD=true; shift;;
        --stop) STOP_ONLY=true; shift;;
        --logs) TAIL_LOGS=true; shift;;
        --status) STATUS_ONLY=true; shift;;
        --rpc) RPC_URL="$2"; shift 2;;
        --oracles) ORACLE_COUNT="$2"; shift 2;;
        --help|-h)
            echo "Usage: ./vps-deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-build    Skip cross-compilation, reuse existing binaries"
            echo "  --stop          Stop all services on VPS 1"
            echo "  --logs          Tail remote logs"
            echo "  --status        Check service health"
            echo "  --rpc URL       Override RPC URL (default: $RPC_URL)"
            echo "  --oracles N     Number of oracle nodes (default: 3)"
            echo ""
            echo "Environment:"
            echo "  RPC_URL         Chain RPC endpoint"
            echo "  CHAIN_ID        Chain ID (default: 111222333)"
            echo "  ORACLE_COUNT    Number of oracles (default: 3)"
            echo "  LOG_LEVEL       Log level (default: info)"
            exit 0;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1;;
    esac
done

# ============ Stop Mode ============
if [ "$STOP_ONLY" = true ]; then
    echo -e "${BLUE}Stopping services on VPS 1...${NC}"
    ssh_vps1 "cd $REMOTE_DIR && bash stop-remote.sh" 2>/dev/null || echo -e "${YELLOW}No services running or stop script not found${NC}"
    exit 0
fi

# ============ Logs Mode ============
if [ "$TAIL_LOGS" = true ]; then
    echo -e "${BLUE}Tailing logs on VPS 1...${NC}"
    ssh_vps1 "tail -f $REMOTE_DIR/logs/*.log"
    exit 0
fi

# ============ Status Mode ============
if [ "$STATUS_ONLY" = true ]; then
    echo -e "${BLUE}Checking services on VPS 1...${NC}"
    ssh_vps1 "
        echo '=== Processes ==='
        ps aux | grep -E 'oracle|data-node' | grep -v grep || echo 'No services running'
        echo ''
        echo '=== Ports ==='
        ss -tlnp 2>/dev/null | grep -E '8200|900[0-9]|1000[0-9]' || echo 'No ports listening'
        echo ''
        echo '=== PostgreSQL Tunnel ==='
        ps aux | grep 'autossh.*5432' | grep -v grep || echo 'No PG tunnel'
        echo ''
        echo '=== Disk ==='
        df -h / | tail -1
    "
    exit 0
fi

# ============ Main Deploy Flow ============
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         VPS 1 DEPLOYMENT — DATA-NODE + ORACLES              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  RPC:     ${RPC_URL}"
echo -e "  Oracles: ${ORACLE_COUNT}"
echo -e "  Target:  ${VPS1_USER}@${VPS1_IP} (via bastion)"
echo ""

# ============ STEP 1: Cross-compile ============
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}[1/5] Cross-compiling for Linux x86_64...${NC}"

    # Check for cross-compilation tool
    if command -v cross &>/dev/null; then
        echo -e "  Using 'cross' (Docker-based cross-compilation)"
        cross build --release --target "$LINUX_TARGET" -p oracle -p data-node
        BINARY_DIR="target/${LINUX_TARGET}/release"
    elif command -v cargo-zigbuild &>/dev/null || command -v cargo &>/dev/null; then
        # Try zigbuild if available, otherwise attempt native cross-compile
        if command -v cargo-zigbuild &>/dev/null; then
            echo -e "  Using 'cargo-zigbuild'"
            cargo zigbuild --release --target "$LINUX_TARGET" -p oracle -p data-node
        else
            echo -e "  Attempting native cross-compile (requires linker for $LINUX_TARGET)"
            cargo build --release --target "$LINUX_TARGET" -p oracle -p data-node
        fi
        BINARY_DIR="target/${LINUX_TARGET}/release"
    else
        echo -e "${RED}No cross-compilation tool found.${NC}"
        echo "Install one of:"
        echo "  cargo install cross    # Docker-based (recommended)"
        echo "  cargo install cargo-zigbuild && brew install zig"
        echo ""
        echo "Or use --skip-build and build on VPS directly:"
        echo "  ssh to VPS 1, git clone, cargo build --release -p oracle -p data-node"
        exit 1
    fi

    # Verify binaries exist
    for bin in oracle data-node; do
        if [ ! -f "$BINARY_DIR/$bin" ]; then
            echo -e "${RED}Binary not found: $BINARY_DIR/$bin${NC}"
            exit 1
        fi
    done
    echo -e "  ${GREEN}Binaries built: oracle $(du -h "$BINARY_DIR/oracle" | cut -f1), data-node $(du -h "$BINARY_DIR/data-node" | cut -f1)${NC}"
else
    echo -e "${BLUE}[1/5] Skipping build (--skip-build)${NC}"
    # Look for existing binaries
    if [ -d "target/${LINUX_TARGET}/release" ]; then
        BINARY_DIR="target/${LINUX_TARGET}/release"
    else
        echo -e "${RED}No Linux binaries found at target/${LINUX_TARGET}/release/${NC}"
        echo "Run without --skip-build first, or build manually."
        exit 1
    fi
fi

# ============ STEP 2: Prepare config ============
echo -e "${BLUE}[2/5] Preparing config files...${NC}"

STAGING_DIR="/tmp/vps-deploy-staging"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/logs" "$STAGING_DIR/data" "$STAGING_DIR/deployments"

# Binaries
cp "$BINARY_DIR/oracle" "$STAGING_DIR/"
cp "$BINARY_DIR/data-node" "$STAGING_DIR/"

# Deployment file
if [ -f "deployments/active-deployment.json" ]; then
    cp deployments/active-deployment.json "$STAGING_DIR/deployments/"
    echo -e "  Copied active-deployment.json"
else
    echo -e "${YELLOW}  Warning: No deployments/active-deployment.json found${NC}"
fi

# Symbol map
if [ -f "data/symbol-map.json" ]; then
    cp data/symbol-map.json "$STAGING_DIR/data/"
    echo -e "  Copied symbol-map.json"
else
    echo '{}' > "$STAGING_DIR/data/symbol-map.json"
    echo -e "${YELLOW}  Created empty symbol-map.json${NC}"
fi

# system.env (credentials)
if [ -f "system.env" ]; then
    cp system.env "$STAGING_DIR/"
    echo -e "  Copied system.env"
fi

# Data-node API keys
if [ -f ".env.data-node" ]; then
    cp .env.data-node "$STAGING_DIR/"
    echo -e "  Copied .env.data-node"
fi

# ============ Generate remote start script ============
cat > "$STAGING_DIR/start-remote.sh" << 'REMOTE_START'
#!/bin/bash
# start-remote.sh — Start data-node + oracles on VPS 1
# Auto-generated by vps-deploy.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load config
if [ -f "system.env" ]; then
    set -a && source system.env && set +a
fi
if [ -f ".env.data-node" ]; then
    set -a && source .env.data-node && set +a
fi

# Defaults (overridable via env)
RPC_URL="${RPC_URL:-${ORBIT_RPC_URL:-http://142.132.164.24/}}"
CHAIN_ID="${CHAIN_ID:-${ORBIT_CHAIN_ID:-111222333}}"
ORACLE_COUNT="${ORACLE_COUNT:-3}"
LOG_LEVEL="${LOG_LEVEL:-info}"
CYCLE_DURATION_MS="${CYCLE_DURATION_MS:-1000}"
CONSENSUS_TIMEOUT_MS="${CONSENSUS_TIMEOUT_MS:-800}"
DATABASE_URL="${DATABASE_URL:-postgres://localhost/index_prices}"
DEPLOYMENT_FILE="${DEPLOYMENT_FILE:-deployments/active-deployment.json}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   INDEX — VPS 1 SERVICES (data-node + oracles)       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  RPC:     $RPC_URL"
echo "  Chain:   $CHAIN_ID"
echo "  Oracles: $ORACLE_COUNT"
echo "  DB:      $DATABASE_URL"
echo ""

# Stop existing
if [ -f .pids ]; then
    echo -e "${YELLOW}Stopping existing services...${NC}"
    bash stop-remote.sh 2>/dev/null || true
fi
rm -f .pids .pids.info

mkdir -p logs

# ── PostgreSQL tunnel (VPS2 → localhost:5432) ──
PG_TUNNEL_RUNNING=false
if ss -tln 2>/dev/null | grep -q ':5432 '; then
    echo -e "  ${GREEN}PostgreSQL already available on :5432${NC}"
    PG_TUNNEL_RUNNING=true
elif command -v autossh &>/dev/null; then
    echo -e "${YELLOW}Setting up PostgreSQL tunnel to VPS 2...${NC}"
    # VPS 2 has PostgreSQL on localhost:5432
    # Use Hetzner private network (10.2.0.x) if available
    VPS2_ADDR="${VPS2_ADDR:-142.132.164.24}"
    autossh -M 0 -f -N -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" \
        -L 5432:127.0.0.1:5432 "max@${VPS2_ADDR}" -p 3189
    sleep 1
    if ss -tln 2>/dev/null | grep -q ':5432 '; then
        echo -e "  ${GREEN}PostgreSQL tunnel established${NC}"
        PG_TUNNEL_RUNNING=true
    else
        echo -e "  ${RED}PostgreSQL tunnel failed${NC}"
    fi
else
    echo -e "  ${YELLOW}autossh not found — install with: sudo apt install autossh${NC}"
    echo -e "  ${YELLOW}Or install PostgreSQL locally: sudo apt install postgresql${NC}"
fi

# ── Check PostgreSQL ──
DB_READY=false
if command -v pg_isready &>/dev/null && pg_isready -q 2>/dev/null; then
    DB_READY=true
    echo -e "  ${GREEN}PostgreSQL ready${NC}"
else
    echo -e "  ${YELLOW}PostgreSQL not ready — data-node will be skipped${NC}"
fi

# ── Oracle keys ──
# Read from system.env or use defaults
ORACLE_KEYS=(
    ""  # index 0 unused
    "${ORACLE_1_PRIVATE_KEY:-}"
    "${ORACLE_2_PRIVATE_KEY:-}"
    "${ORACLE_3_PRIVATE_KEY:-}"
)

# Contract addresses from deployment file or env
if [ -f "$DEPLOYMENT_FILE" ] && command -v python3 &>/dev/null; then
    BRIDGE_PROXY=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('BridgeProxy',''))" 2>/dev/null || echo "")
    BITGET_VAULT=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('MockBitgetVault',''))" 2>/dev/null || echo "")
    SETTLEMENT_CUSTODY=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SettlementBridgeCustody',''))" 2>/dev/null || echo "")
    BLS_CUSTODY=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('BLSCustody',''))" 2>/dev/null || echo "")
    VISION_ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
    INDEX_ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('Index',''))" 2>/dev/null || echo "")
    MOCK_USDT=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('MOCK_USDT',''))" 2>/dev/null || echo "")
elif [ -f "$DEPLOYMENT_FILE" ] && command -v jq &>/dev/null; then
    BRIDGE_PROXY=$(jq -r '.contracts.BridgeProxy // empty' "$DEPLOYMENT_FILE")
    BITGET_VAULT=$(jq -r '.contracts.MockBitgetVault // empty' "$DEPLOYMENT_FILE")
    SETTLEMENT_CUSTODY=$(jq -r '.contracts.SettlementBridgeCustody // empty' "$DEPLOYMENT_FILE")
    BLS_CUSTODY=$(jq -r '.contracts.BLSCustody // empty' "$DEPLOYMENT_FILE")
    VISION_ADDR=$(jq -r '.contracts.Vision // empty' "$DEPLOYMENT_FILE")
    INDEX_ADDR=$(jq -r '.contracts.Index // empty' "$DEPLOYMENT_FILE")
    MOCK_USDT=$(jq -r '.contracts.MOCK_USDT // empty' "$DEPLOYMENT_FILE")
else
    # Fall back to env vars from system.env
    BRIDGE_PROXY="${ORACLE_BRIDGE_PROXY_ADDRESS:-}"
    BITGET_VAULT="${ORACLE_BITGET_VAULT:-}"
    SETTLEMENT_CUSTODY="${ORACLE_SETTLEMENT_CUSTODY:-}"
    BLS_CUSTODY="${ORACLE_BLS_CUSTODY_ADDRESS:-}"
    VISION_ADDR=""
    INDEX_ADDR="${INDEX_ADDRESS:-}"
    MOCK_USDT=""
fi

# ── Start data-node ──
if [ "$DB_READY" = true ]; then
    echo -e "${BLUE}Starting data-node on port 8200...${NC}"

    DATA_NODE_ARGS="serve --database-url $DATABASE_URL"
    DATA_NODE_ARGS="$DATA_NODE_ARGS --rpc-url $RPC_URL --settlement-rpc-url $RPC_URL"
    [ -f "data/symbol-map.json" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --symbol-map data/symbol-map.json"
    [ -f "$DEPLOYMENT_FILE" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --deployment-file $DEPLOYMENT_FILE"
    [ -n "$INDEX_ADDR" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --index-address $INDEX_ADDR"

    # API keys
    [ -n "${FINNHUB_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --finnhub-api-key $FINNHUB_API_KEY"
    [ -n "${COINGECKO_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --coingecko-api-key $COINGECKO_API_KEY"
    [ -n "${FRED_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --fred-api-key $FRED_API_KEY"
    [ -n "${BLS_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --bls-api-key $BLS_API_KEY"
    [ -n "${NASDAQ_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --nasdaq-api-key $NASDAQ_API_KEY"
    [ -n "${TWITCH_CLIENT_ID:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --twitch-client-id $TWITCH_CLIENT_ID"
    [ -n "${TWITCH_CLIENT_SECRET:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --twitch-client-secret $TWITCH_CLIENT_SECRET"
    [ -n "${TMDB_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --tmdb-api-key $TMDB_API_KEY"
    [ -n "${BACKPACKTF_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --backpacktf-api-key $BACKPACKTF_API_KEY"
    [ -n "${MOVEBANK_USER:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --movebank-user $MOVEBANK_USER"
    [ -n "${MOVEBANK_PASSWORD:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --movebank-password $MOVEBANK_PASSWORD"
    [ -n "${EBIRD_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --ebird-api-key $EBIRD_API_KEY"
    [ -n "${CLOUDFLARE_RADAR_TOKEN:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --cloudflare-radar-token $CLOUDFLARE_RADAR_TOKEN"
    [ -n "${TREASURY_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --treasury-api-key $TREASURY_API_KEY"
    [ -n "${EIA_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --eia-api-key $EIA_API_KEY"
    [ -n "${GITHUB_TOKEN:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --github-token $GITHUB_TOKEN"
    [ -n "${NASA_FIRMS_MAP_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --nasa-firms-key $NASA_FIRMS_MAP_KEY"
    [ -n "${AISSTREAM_API_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --aisstream-api-key $AISSTREAM_API_KEY"
    [ -n "${FINRA_CLIENT_ID:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --finra-client-id $FINRA_CLIENT_ID"
    [ -n "${FINRA_CLIENT_SECRET:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --finra-client-secret $FINRA_CLIENT_SECRET"
    [ -n "${ADZUNA_APP_ID:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --adzuna-app-id $ADZUNA_APP_ID"
    [ -n "${ADZUNA_APP_KEY:-}" ] && DATA_NODE_ARGS="$DATA_NODE_ARGS --adzuna-app-key $ADZUNA_APP_KEY"
    DATA_NODE_ARGS="$DATA_NODE_ARGS --ecb-enabled --openmeteo-sync-interval 300"

    nohup ./data-node $DATA_NODE_ARGS > logs/data-node.log 2>&1 &
    DN_PID=$!
    echo $DN_PID >> .pids
    echo "data-node:$DN_PID" >> .pids.info
    echo -e "  ${GREEN}data-node started (PID: $DN_PID)${NC}"
    DATA_NODE_URL="http://localhost:8200"
else
    echo -e "${YELLOW}Skipping data-node (no PostgreSQL)${NC}"
    DATA_NODE_URL=""
fi

# ── Bitget credentials for oracles ──
export BITGET_READONLY_API_KEY="${BITGET_READONLY_API_KEY:-${BITGET_PUB:-dummy}}"
export BITGET_READONLY_API_SECRET="${BITGET_READONLY_API_SECRET:-${BITGET_PK:-dummysecretdummysecretdummysecret}}"
export BITGET_READONLY_PASSPHRASE="${BITGET_READONLY_PASSPHRASE:-${BITGET_PASS:-dummypass}}"

# ── Signature threshold ──
SIG_THRESHOLD=$((ORACLE_COUNT * 2 / 3 + 1))
if [ $SIG_THRESHOLD -lt 2 ]; then SIG_THRESHOLD=2; fi
if [ $SIG_THRESHOLD -gt $ORACLE_COUNT ]; then SIG_THRESHOLD=$ORACLE_COUNT; fi

# ── Start oracles ──
echo -e "${BLUE}Starting $ORACLE_COUNT oracles...${NC}"

for i in $(seq 1 $ORACLE_COUNT); do
    PORT=$((9000 + i))
    BLS_IDX=$((i - 1))

    ORACLE_KEY="${ORACLE_KEYS[$i]:-}"
    if [ -z "$ORACLE_KEY" ]; then
        echo -e "  ${RED}No private key for oracle $i (set ORACLE_${i}_PRIVATE_KEY in system.env)${NC}"
        continue
    fi

    # Write key to temp file
    KEY_FILE="/tmp/oracle-key-$i.txt"
    echo -n "$ORACLE_KEY" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"

    # Build peer list (all other oracles on localhost)
    PEER_LIST=""
    for j in $(seq 1 $ORACLE_COUNT); do
        if [ $j -ne $i ]; then
            [ -n "$PEER_LIST" ] && PEER_LIST="$PEER_LIST,"
            PEER_LIST="${PEER_LIST}127.0.0.1:$((9000 + j))"
        fi
    done

    ORACLE_ARGS="--node-id $i --port $PORT --rpc $RPC_URL"
    ORACLE_ARGS="$ORACLE_ARGS --cycle-duration-ms $CYCLE_DURATION_MS"
    ORACLE_ARGS="$ORACLE_ARGS --min-cycle-gap-ms 50"
    ORACLE_ARGS="$ORACLE_ARGS --consensus-timeout-ms $CONSENSUS_TIMEOUT_MS"
    ORACLE_ARGS="$ORACLE_ARGS --no-tls"
    ORACLE_ARGS="$ORACLE_ARGS --test-key-seeds --bls-key-seed-index $BLS_IDX"
    ORACLE_ARGS="$ORACLE_ARGS --signature-threshold $SIG_THRESHOLD --num-oracles $ORACLE_COUNT"
    ORACLE_ARGS="$ORACLE_ARGS --registry-sync"
    ORACLE_ARGS="$ORACLE_ARGS --log-level $LOG_LEVEL"

    [ -n "$BRIDGE_PROXY" ] && ORACLE_ARGS="$ORACLE_ARGS --bridge-proxy $BRIDGE_PROXY"
    [ -n "$BITGET_VAULT" ] && ORACLE_ARGS="$ORACLE_ARGS --bitget-vault $BITGET_VAULT"
    [ -n "$SETTLEMENT_CUSTODY" ] && ORACLE_ARGS="$ORACLE_ARGS --settlement-custody $SETTLEMENT_CUSTODY"
    [ -n "$BLS_CUSTODY" ] && ORACLE_ARGS="$ORACLE_ARGS --oracle-custody-settlement $BLS_CUSTODY"
    [ -n "$MOCK_USDT" ] && [ "$MOCK_USDT" != "0x0000000000000000000000000000000000000000" ] && ORACLE_ARGS="$ORACLE_ARGS --mock-usdt $MOCK_USDT"
    [ -f "$DEPLOYMENT_FILE" ] && ORACLE_ARGS="$ORACLE_ARGS --deployment-file $DEPLOYMENT_FILE"
    ORACLE_ARGS="$ORACLE_ARGS --wal-path logs/consensus-$i.wal"
    [ -f "data/symbol-map.json" ] && ORACLE_ARGS="$ORACLE_ARGS --symbol-map-file data/symbol-map.json"
    [ -n "$DATA_NODE_URL" ] && ORACLE_ARGS="$ORACLE_ARGS --data-node-url $DATA_NODE_URL"

    # Vision subsystem
    if [ -n "$VISION_ADDR" ] && [ "$DB_READY" = true ]; then
        ORACLE_ARGS="$ORACLE_ARGS --vision-enabled"
        ORACLE_ARGS="$ORACLE_ARGS --vision-address $VISION_ADDR"
        ORACLE_ARGS="$ORACLE_ARGS --vision-database-url $DATABASE_URL"
        [ -n "$DATA_NODE_URL" ] && ORACLE_ARGS="$ORACLE_ARGS --vision-data-node-url $DATA_NODE_URL"
        ORACLE_ARGS="$ORACLE_ARGS --vision-rpc-ws-url $RPC_URL"
    fi

    export ORACLE_PRIVATE_KEY_PATH="$KEY_FILE"
    export ORACLE_PEERS="$PEER_LIST"
    export ORACLE_SETTLEMENT_RPC_URL="$RPC_URL"
    export ORACLE_SETTLEMENT_CHAIN_ID="$CHAIN_ID"

    nohup ./oracle $ORACLE_ARGS > logs/oracle-$i.log 2>&1 &
    ORACLE_PID=$!
    echo $ORACLE_PID >> .pids
    echo "oracle-$i:$ORACLE_PID" >> .pids.info
    echo -e "  ${GREEN}Oracle $i on port $PORT (PID: $ORACLE_PID)${NC}"
done

# ── Health check ──
echo ""
echo -e "${YELLOW}Waiting for services to start (5s)...${NC}"
sleep 5

if [ -n "$DATA_NODE_URL" ]; then
    if curl -sf "$DATA_NODE_URL/health" > /dev/null 2>&1; then
        echo -e "  data-node: ${GREEN}healthy${NC}"
    else
        echo -e "  data-node: ${YELLOW}starting...${NC} (check logs/data-node.log)"
    fi
fi

for i in $(seq 1 $ORACLE_COUNT); do
    HP=$((10000 + i))
    if curl -sf "http://localhost:$HP/health" > /dev/null 2>&1; then
        echo -e "  oracle $i: ${GREEN}healthy${NC}"
    else
        echo -e "  oracle $i: ${YELLOW}starting...${NC} (check logs/oracle-$i.log)"
    fi
done

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   SERVICES STARTED                                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Logs: tail -f logs/*.log"
echo "  Stop: bash stop-remote.sh"
REMOTE_START

# ============ Generate remote stop script ============
cat > "$STAGING_DIR/stop-remote.sh" << 'REMOTE_STOP'
#!/bin/bash
# stop-remote.sh — Stop all Index services on VPS 1

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}Stopping Index services...${NC}"

if [ -f .pids ]; then
    while read -r PID; do
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            NAME="unknown"
            [ -f .pids.info ] && NAME=$(grep ":$PID$" .pids.info 2>/dev/null | cut -d: -f1 || echo "unknown")
            echo -e "  Stopping $NAME (PID: $PID)"
            kill -TERM "$PID" 2>/dev/null || true
        fi
    done < .pids

    # Wait for graceful shutdown
    sleep 3
    while read -r PID; do
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            echo -e "  ${YELLOW}Force killing PID $PID${NC}"
            kill -9 "$PID" 2>/dev/null || true
        fi
    done < .pids

    rm -f .pids .pids.info
fi

# Kill any orphan processes
pkill -f './oracle' 2>/dev/null || true
pkill -f './data-node' 2>/dev/null || true

echo -e "${GREEN}All services stopped${NC}"
REMOTE_STOP

chmod +x "$STAGING_DIR/start-remote.sh" "$STAGING_DIR/stop-remote.sh"
echo -e "  ${GREEN}Config staging ready${NC}"

# ============ STEP 3: Upload to VPS 1 ============
echo -e "${BLUE}[3/5] Uploading to VPS 1...${NC}"

# Create remote directory
ssh_vps1 "mkdir -p $REMOTE_DIR/logs $REMOTE_DIR/data $REMOTE_DIR/deployments"

# Upload binaries (largest files first)
echo -e "  Uploading binaries..."
rsync_to_vps1 "$STAGING_DIR/oracle" "$STAGING_DIR/data-node" "${VPS1_USER}@${VPS1_IP}:${REMOTE_DIR}/"

# Upload config files
echo -e "  Uploading config..."
rsync_to_vps1 \
    "$STAGING_DIR/start-remote.sh" \
    "$STAGING_DIR/stop-remote.sh" \
    "${VPS1_USER}@${VPS1_IP}:${REMOTE_DIR}/"

[ -f "$STAGING_DIR/system.env" ] && rsync_to_vps1 "$STAGING_DIR/system.env" "${VPS1_USER}@${VPS1_IP}:${REMOTE_DIR}/"
[ -f "$STAGING_DIR/.env.data-node" ] && rsync_to_vps1 "$STAGING_DIR/.env.data-node" "${VPS1_USER}@${VPS1_IP}:${REMOTE_DIR}/"
[ -f "$STAGING_DIR/deployments/active-deployment.json" ] && rsync_to_vps1 "$STAGING_DIR/deployments/active-deployment.json" "${VPS1_USER}@${VPS1_IP}:${REMOTE_DIR}/deployments/"
[ -f "$STAGING_DIR/data/symbol-map.json" ] && rsync_to_vps1 "$STAGING_DIR/data/symbol-map.json" "${VPS1_USER}@${VPS1_IP}:${REMOTE_DIR}/data/"

# Make binaries executable
ssh_vps1 "chmod +x $REMOTE_DIR/oracle $REMOTE_DIR/data-node $REMOTE_DIR/start-remote.sh $REMOTE_DIR/stop-remote.sh"

echo -e "  ${GREEN}Upload complete${NC}"

# ============ STEP 4: Stop existing services ============
echo -e "${BLUE}[4/5] Stopping existing services on VPS 1...${NC}"
ssh_vps1 "cd $REMOTE_DIR && bash stop-remote.sh" 2>/dev/null || echo -e "  ${YELLOW}No existing services${NC}"

# ============ STEP 5: Start services ============
echo -e "${BLUE}[5/5] Starting services on VPS 1...${NC}"

ssh_vps1 "cd $REMOTE_DIR && RPC_URL='$RPC_URL' CHAIN_ID='$CHAIN_ID' ORACLE_COUNT='$ORACLE_COUNT' LOG_LEVEL='$LOG_LEVEL' bash start-remote.sh"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║             VPS 1 DEPLOYMENT COMPLETE                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Manage:${NC}"
echo "    ./vps-deploy.sh --status    # Check health"
echo "    ./vps-deploy.sh --logs      # Tail logs"
echo "    ./vps-deploy.sh --stop      # Stop services"
echo ""
echo -e "  ${BLUE}Direct SSH:${NC}"
echo "    ssh -J ${BASTION}:${BASTION_PORT} -p ${VPS1_PORT} ${VPS1_USER}@${VPS1_IP}"
echo "    cd ${REMOTE_DIR} && tail -f logs/*.log"
echo ""

# Cleanup staging
rm -rf "$STAGING_DIR"
