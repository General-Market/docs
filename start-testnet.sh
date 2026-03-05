#!/bin/bash
# start-testnet.sh — Launch Index on VPS testnet (Orbit L3 on Sonic)
#
# Unlike start.sh which runs everything locally with Anvil,
# this script uses the real VPS L3 chain and VPS PostgreSQL:
#   - L3 RPC: http://142.132.164.24/ (Orbit chain on VPS 2, chain ID 111222333)
#   - PostgreSQL: VPS 2 (data-node runs there via deploy.sh)
#   - Contracts: deployed to VPS L3
#   - Issuers + AP: run locally, point to VPS RPC
#   - Frontend: runs locally, points to VPS services
#
# Usage:
#   ./start-testnet.sh                 # Full deploy + start
#   ./start-testnet.sh --skip-deploy   # Start services only (contracts already deployed)
#   ./start-testnet.sh --no-tail       # Don't tail logs
#   ./start-testnet.sh --vision        # Enable Vision subsystem

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Testnet Configuration ─────────────────────────────────────
# VPS L3 chain (Orbit on Sonic Testnet)
CHAIN_ID=111222333
RPC_URL="http://142.132.164.24/"
# No separate Arb chain on testnet — L3 handles everything
ARB_CHAIN_ID=$CHAIN_ID
ARB_RPC_URL="$RPC_URL"

# VPS data-node
VPS_HOST="index-maker/prod/postgres"
DATA_NODE_URL="http://142.132.164.24:8200"

# Testnet deployer wallet (from vps.md)
DEPLOYER_KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER_ADDRESS="0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4"

# Test user (same as deployer on testnet)
TEST_USER_KEY="$DEPLOYER_KEY"
TEST_USER_ADDRESS="$DEPLOYER_ADDRESS"

# AP key
AP_KEY=${AP_KEY:-0x582978b132648fe53de139c6b9297040a2757616cac9a2fd17aa167bdc6fa340}

# Vision bots
VISION_BOT_KEY=${VISION_BOT_KEY:-0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82}
VISION_BOT2_KEY=${VISION_BOT2_KEY:-0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892f8b25f3f12a69}

# Issuer keys
ISSUER_1_KEY="${ISSUER_1_KEY:-0x355faf10c89b4aa1c96964b4d7b38ed5844eea436bd1ae8029cb073d3d3355ff}"
ISSUER_2_KEY="${ISSUER_2_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
ISSUER_3_KEY="${ISSUER_3_KEY:-0xd518d48628681d00fe0b35ff9cca3e354e8197eab2ab4b010e1274eccc3e8775}"

ISSUER_COUNT=3
SKIP_DEPLOY=false
NO_TAIL=false
NO_TEST=false
VISION_ENABLED=true
LOG_LEVEL=${LOG_LEVEL:-info}

# Bitget credentials
export BITGET_API_KEY=${BITGET_API_KEY:-dummy}
export BITGET_API_SECRET=${BITGET_API_SECRET:-dummysecretdummysecretdummysecret}
export BITGET_API_PASSPHRASE=${BITGET_API_PASSPHRASE:-dummypass}
export BITGET_READONLY_API_KEY=${BITGET_READONLY_API_KEY:-dummy}
export BITGET_READONLY_API_SECRET=${BITGET_READONLY_API_SECRET:-dummysecretdummysecretdummysecret}
export BITGET_READONLY_PASSPHRASE=${BITGET_READONLY_PASSPHRASE:-dummypass}
export EXCHANGE_MODE="${EXCHANGE_MODE:-mock}"

# Load system.env if present
if [ -f "$SCRIPT_DIR/system.env" ]; then
    set -a && source "$SCRIPT_DIR/system.env" && set +a
fi
export BITGET_READONLY_API_KEY="${BITGET_PUB:-${BITGET_READONLY_API_KEY}}"
export BITGET_READONLY_API_SECRET="${BITGET_PK:-${BITGET_READONLY_API_SECRET}}"
export BITGET_READONLY_PASSPHRASE="${BITGET_PASS:-${BITGET_READONLY_PASSPHRASE}}"

# Unset production contract addresses (read from deployment file instead)
unset ISSUER_INDEX_ADDRESS ISSUER_GOVERNANCE_ADDRESS ISSUER_ISSUER_REGISTRY_ADDRESS
unset ISSUER_COLLATERAL_REGISTRY_ADDRESS ISSUER_BLS_CUSTODY_ADDRESS ISSUER_L3_BRIDGE_CUSTODY_ADDRESS
unset ISSUER_BRIDGE_PROXY_ADDRESS ISSUER_BITGET_VAULT ISSUER_ARB_CUSTODY
unset ISSUER_RPC_URL ISSUER_ARBITRUM_RPC_URL ISSUER_ARBITRUM_CHAIN_ID ISSUER_LOG_LEVEL

# Add Foundry to PATH
if ! command -v forge &>/dev/null && [ -d "$HOME/.foundry/bin" ]; then
    export PATH="$HOME/.foundry/bin:$PATH"
fi

# ── Parse arguments ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: ./start-testnet.sh [OPTIONS]"
            echo ""
            echo "Launches Index on VPS testnet (Orbit L3, chain ID 111222333)"
            echo ""
            echo "Options:"
            echo "  --skip-deploy   Skip contract deployment (use existing)"
            echo "  --no-tail       Don't tail logs after startup"
            echo "  --no-test       Skip E2E tests"
            echo "  --no-vision     Disable Vision subsystem"
            echo "  --help          Show this help"
            exit 0
            ;;
        --skip-deploy) SKIP_DEPLOY=true; shift;;
        --no-tail) NO_TAIL=true; shift;;
        --no-test) NO_TEST=true; shift;;
        --no-vision) VISION_ENABLED=false; shift;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1;;
    esac
done

# ── Banner ────────────────────────────────────────────────────
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         INDEX L3 TESTNET ENVIRONMENT                       ║"
echo "║  VPS L3: $RPC_URL (chain $CHAIN_ID)           ║"
echo "║  Data-node: $DATA_NODE_URL                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Chain: $CHAIN_ID | RPC: $RPC_URL"
echo "  Skip deploy: $SKIP_DEPLOY | Vision: $VISION_ENABLED | Log: $LOG_LEVEL"
echo ""

TOTAL_STEPS=10

# ── Step 1: Prerequisites ─────────────────────────────────────
echo -e "${BLUE}[1/$TOTAL_STEPS] Checking prerequisites...${NC}"

for cmd in forge python3 curl; do
    if ! command -v $cmd &>/dev/null; then
        echo -e "${RED}Error: $cmd not found${NC}"; exit 1
    fi
done

# Build Rust binaries (issuers + AP run locally)
if [ ! -f "target/release/issuer" ] || [ ! -f "target/release/ap" ]; then
    echo -e "${YELLOW}Building Rust binaries (issuer + ap)...${NC}"
    cargo build --release -p issuer -p ap
fi

echo -e "  ${GREEN}Prerequisites OK${NC}"

# Check VPS L3 is reachable
echo -e "  Checking VPS L3 RPC..."
VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
if [ "$VPS_CHAIN_ID" != "$CHAIN_ID" ]; then
    echo -e "  ${RED}VPS L3 not reachable or wrong chain ID (got: $VPS_CHAIN_ID, expected: $CHAIN_ID)${NC}"
    exit 1
fi
echo -e "  ${GREEN}VPS L3 OK (chain $VPS_CHAIN_ID)${NC}"

# Check deployer balance
DEPLOYER_BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
echo -e "  Deployer balance: $DEPLOYER_BALANCE wei"

mkdir -p logs deployments data

# ── Step 2: Cleanup local processes ───────────────────────────
echo -e "${BLUE}[2/$TOTAL_STEPS] Cleaning up local processes...${NC}"
pkill -f 'target/release/issuer' 2>/dev/null || true
pkill -f 'target/release/ap' 2>/dev/null || true
# Don't kill local data-node — VPS handles it
for port in 9001 9002 9003 9100; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
rm -f .pids .pids.info
sleep 1
echo -e "  ${GREEN}Clean${NC}"

# ── Step 3: Deploy contracts to VPS L3 ────────────────────────
if [ "$SKIP_DEPLOY" = false ]; then
    echo -e "${BLUE}[3/$TOTAL_STEPS] Deploying contracts to VPS L3...${NC}"

    # Deploy core contracts
    echo -e "  Deploying core contracts (Index, BridgeProxy, Vision, Morpho)..."
    forge script contracts/script/DeployFullSystem.s.sol:DeployFullSystem \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow \
        > logs/deploy-testnet.log 2>&1

    # Check if deployment file was created
    if [ ! -f "deployments/active-deployment.json" ]; then
        echo -e "  ${RED}Deployment failed — no active-deployment.json${NC}"
        echo -e "  ${YELLOW}Check logs/deploy-testnet.log${NC}"
        exit 1
    fi

    # Patch deployment file with testnet RPC
    python3 -c "
import json
d = json.load(open('deployments/active-deployment.json'))
d['rpc'] = '$RPC_URL'
d['chainId'] = $CHAIN_ID
json.dump(d, open('deployments/active-deployment.json', 'w'), indent=2)
"
    echo -e "  ${GREEN}Core contracts deployed${NC}"

    # Deploy Vision batches if enabled
    if [ "$VISION_ENABLED" = true ]; then
        echo -e "  Deploying Vision batches..."
        forge script contracts/script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
            --rpc-url "$RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --broadcast \
            --chain-id $CHAIN_ID \
            --slow \
            >> logs/deploy-testnet.log 2>&1 || echo -e "  ${YELLOW}Vision batch deploy had warnings${NC}"
        echo -e "  ${GREEN}Vision batches deployed${NC}"
    fi

    # Fund test accounts on L3
    echo -e "  Funding test accounts..."
    L3_USDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('L3_WUSDC', ''))" 2>/dev/null || echo "")
    if [ -n "$L3_USDC" ] && [ "$L3_USDC" != "" ]; then
        # Mint USDC to deployer (L3 has 18 decimals)
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$L3_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" 1000000000000000000000000 \
            > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded deployer with 1M L3 USDC${NC}"

        # Fund Vision bots
        VISION_BOT_ADDRESS=$(cast wallet address "$VISION_BOT_KEY")
        VISION_BOT2_ADDRESS=$(cast wallet address "$VISION_BOT2_KEY")
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$L3_USDC" "mint(address,uint256)" "$VISION_BOT_ADDRESS" 100000000000000000000000 \
            > /dev/null 2>&1 || true
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$L3_USDC" "mint(address,uint256)" "$VISION_BOT2_ADDRESS" 100000000000000000000000 \
            > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded Vision bots${NC}"

        # Fund gas for bots + AP
        AP_ADDRESS=$(cast wallet address "$AP_KEY")
        for addr in "$VISION_BOT_ADDRESS" "$VISION_BOT2_ADDRESS" "$AP_ADDRESS"; do
            cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                "$addr" --value 10000000000000000000 > /dev/null 2>&1 || true
        done
        echo -e "  ${GREEN}Funded gas for bots + AP${NC}"
    fi
else
    echo -e "${BLUE}[3/$TOTAL_STEPS] Skipping deployment (--skip-deploy)${NC}"
    if [ ! -f "deployments/active-deployment.json" ]; then
        echo -e "  ${RED}No active-deployment.json — run without --skip-deploy first${NC}"
        exit 1
    fi
fi

# ── Step 4: Generate symbol map ───────────────────────────────
echo -e "${BLUE}[4/$TOTAL_STEPS] Generating symbol map...${NC}"
# Symbol map from deployment (same logic as start.sh)
DEPLOYMENT_FILE="deployments/active-deployment.json"
INDEX_ADDRESS=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('Index', ''))" 2>/dev/null || echo "")

if [ -n "$INDEX_ADDRESS" ] && [ "$INDEX_ADDRESS" != "" ]; then
    python3 scripts/generate-markets-json.py \
        --rpc-url "$RPC_URL" \
        --deployment-file "$DEPLOYMENT_FILE" \
        --output data/symbol-map.json \
        > /dev/null 2>&1 || echo -e "  ${YELLOW}Symbol map generation failed — using existing${NC}"
fi
echo -e "  ${GREEN}Symbol map ready${NC}"

# ── Step 5: Sync frontend addresses ──────────────────────────
echo -e "${BLUE}[5/$TOTAL_STEPS] Syncing frontend addresses...${NC}"
cp deployments/active-deployment.json frontend/public/deployment.json 2>/dev/null || true

# Write testnet .env.local for frontend
VISION_ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
cat > frontend/.env.local <<ENVEOF
NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_RPC_URL=$RPC_URL
NEXT_PUBLIC_L3_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_L3_RPC_URL=$RPC_URL
NEXT_PUBLIC_ARB_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_AP_URL=http://localhost:9100
NEXT_PUBLIC_DATA_NODE_URL=$DATA_NODE_URL
NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}
NEXT_PUBLIC_VISION_API_URL=http://localhost:10001
NEXT_PUBLIC_ISSUER_URLS=http://localhost:10001,http://localhost:10002,http://localhost:10003
ENVEOF
echo -e "  ${GREEN}Frontend synced (pointing to VPS)${NC}"

# ── Step 6: Ensure VPS data-node is running ───────────────────
echo -e "${BLUE}[6/$TOTAL_STEPS] Checking VPS data-node...${NC}"

if ssh "$VPS_HOST" "pgrep -f 'data-node serve' > /dev/null 2>&1" 2>/dev/null; then
    echo -e "  ${GREEN}VPS data-node already running${NC}"
else
    echo -e "  ${YELLOW}VPS data-node not running — deploying...${NC}"
    ./deploy.sh
fi

# Verify data-node is accessible
if curl -sf "$DATA_NODE_URL/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}Data-node healthy at $DATA_NODE_URL${NC}"
else
    echo -e "  ${YELLOW}Data-node not yet healthy (may be starting up)${NC}"
fi

# ── Step 7: Launch Issuers (locally, pointing to VPS) ─────────
echo -e "${BLUE}[7/$TOTAL_STEPS] Starting $ISSUER_COUNT issuers (local → VPS L3)...${NC}"

# Build issuer args
ISSUER_ARGS="--cycle-duration-ms 1000 --min-cycle-gap-ms 50 --consensus-timeout-ms 800"
ISSUER_ARGS="$ISSUER_ARGS --no-tls --test-key-seeds --signature-threshold 2 --num-issuers $ISSUER_COUNT"
ISSUER_ARGS="$ISSUER_ARGS --registry-sync --ntp-server \"\""
ISSUER_ARGS="$ISSUER_ARGS --deployment-file $DEPLOYMENT_FILE"
ISSUER_ARGS="$ISSUER_ARGS --symbol-map-file data/symbol-map.json"
ISSUER_ARGS="$ISSUER_ARGS --data-node-url $DATA_NODE_URL"

# Vision args
if [ "$VISION_ENABLED" = true ] && [ -n "$VISION_ADDR" ] && [ "$VISION_ADDR" != "" ]; then
    ISSUER_ARGS="$ISSUER_ARGS --vision-enabled"
    ISSUER_ARGS="$ISSUER_ARGS --vision-address $VISION_ADDR"
    ISSUER_ARGS="$ISSUER_ARGS --vision-database-url postgres://max@142.132.164.24:5432/index_prices"
    ISSUER_ARGS="$ISSUER_ARGS --vision-data-node-url $DATA_NODE_URL"
    ISSUER_ARGS="$ISSUER_ARGS --vision-rpc-ws-url $RPC_URL"
    ISSUER_ARGS="$ISSUER_ARGS --vision-reveal-window-secs 60"
    ISSUER_ARGS="$ISSUER_ARGS --vision-tick-poll-interval-ms 500"
fi

BINARY="./target/release/issuer"
ISSUER_KEYS=("$ISSUER_1_KEY" "$ISSUER_2_KEY" "$ISSUER_3_KEY")

for i in $(seq 1 $ISSUER_COUNT); do
    PORT=$((9000 + i))
    KEY_IDX=$((i - 1))

    # Build peer list (all other issuers)
    PEERS=""
    for j in $(seq 1 $ISSUER_COUNT); do
        if [ $j -ne $i ]; then
            [ -n "$PEERS" ] && PEERS="$PEERS,"
            PEERS="${PEERS}127.0.0.1:$((9000 + j))"
        fi
    done

    ISSUER_NODE_ID=$i \
    ISSUER_PRIVATE_KEY="${ISSUER_KEYS[$KEY_IDX]}" \
    ISSUER_PEERS="$PEERS" \
    ISSUER_RPC_URL="$RPC_URL" \
    ISSUER_ARBITRUM_RPC_URL="$RPC_URL" \
    ISSUER_ARBITRUM_CHAIN_ID="$CHAIN_ID" \
    $BINARY \
        --node-id $i \
        --port $PORT \
        --bls-key-seed-index $KEY_IDX \
        --bridge-proxy "$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('BridgeProxy', ''))" 2>/dev/null)" \
        --wal-path "logs/consensus-$i.wal" \
        $ISSUER_ARGS \
        > "logs/issuer-$i.log" 2>&1 &
    ISSUER_PID=$!
    echo $ISSUER_PID >> .pids
    echo "issuer-$i:$ISSUER_PID" >> .pids.info
    echo -e "  Issuer $i on port $PORT (PID: $ISSUER_PID)"
done

echo -e "  ${GREEN}All $ISSUER_COUNT issuers started${NC}"

# ── Step 8: Launch AP (locally, pointing to VPS) ──────────────
echo -e "${BLUE}[8/$TOTAL_STEPS] Starting AP (local → VPS L3)...${NC}"

AP_ARGS="--port 9100 --rpc $RPC_URL --exchange-mode $EXCHANGE_MODE"
AP_ARGS="$AP_ARGS --arb-rpc $RPC_URL --arb-chain-id $CHAIN_ID"
AP_ARGS="$AP_ARGS --deployment-file $DEPLOYMENT_FILE"
AP_ARGS="$AP_ARGS --data-node-url $DATA_NODE_URL"
AP_ARGS="$AP_ARGS --log-level $LOG_LEVEL"

MOCK_BITGET_VAULT=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('MockBitgetVault', ''))" 2>/dev/null || echo "")
[ -n "$INDEX_ADDRESS" ] && AP_ARGS="$AP_ARGS --index-contract $INDEX_ADDRESS"
[ -n "$MOCK_BITGET_VAULT" ] && AP_ARGS="$AP_ARGS --bitget-vault $MOCK_BITGET_VAULT"

AP_PRIVATE_KEY=$AP_KEY eval "./target/release/ap $AP_ARGS > logs/ap.log 2>&1 &"
AP_PID=$!
echo $AP_PID >> .pids
echo "ap:$AP_PID" >> .pids.info
echo -e "  AP on port 9100 (PID: $AP_PID)"

# ── Step 9: Frontend ──────────────────────────────────────────
echo -e "${BLUE}[9/$TOTAL_STEPS] Starting frontend (local dev server)...${NC}"

cd frontend
npm install --prefer-offline --no-audit > ../logs/frontend-install.log 2>&1

nohup npm run dev > ../logs/frontend-dev.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID >> ../.pids
echo "frontend:$FRONTEND_PID" >> ../.pids.info
cd ..

# Wait for frontend
for attempt in $(seq 1 60); do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  ${GREEN}Frontend ready (${attempt}s)${NC}"
        break
    fi
    if [ $attempt -eq 60 ]; then
        echo -e "  ${YELLOW}Frontend not ready after 60s — check logs/frontend-dev.log${NC}"
    fi
    sleep 1
done

# ── Step 10: Summary ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
echo -e "║         TESTNET ENVIRONMENT READY                            ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Chain:${NC}      $RPC_URL (ID: $CHAIN_ID)"
echo -e "  ${CYAN}Data-node:${NC}  $DATA_NODE_URL"
echo -e "  ${CYAN}Issuers:${NC}    localhost:9001-900$ISSUER_COUNT"
echo -e "  ${CYAN}AP:${NC}         localhost:9100"
echo -e "  ${CYAN}Frontend:${NC}   http://localhost:3000"
echo -e "  ${CYAN}Explorer:${NC}   http://142.132.164.24/ (GET requests)"
echo ""
echo -e "  ${YELLOW}Deployer:${NC}   $DEPLOYER_ADDRESS"
echo -e "  ${YELLOW}Deployment:${NC} deployments/active-deployment.json"
echo ""

# Show services
echo -e "${CYAN}Running services:${NC}"
if [ -f .pids.info ]; then
    while IFS= read -r line; do
        echo "  $line"
    done < .pids.info
fi
echo ""

echo -e "  ${YELLOW}Logs:${NC}"
echo "    tail -f logs/issuer-1.log    # Issuer consensus"
echo "    tail -f logs/ap.log          # AP keeper"
echo "    ssh $VPS_HOST 'tail -f ~/index/logs/data-node.log'  # Data-node"
echo ""
echo -e "  ${YELLOW}Stop:${NC}"
echo "    ./stop.sh                    # Stop local services"
echo "    ./deploy.sh --stop           # Stop VPS data-node"
echo ""

if [ "$NO_TAIL" != true ]; then
    echo -e "${CYAN}Tailing issuer + AP logs (Ctrl+C to stop)...${NC}"
    tail -f logs/issuer-1.log logs/ap.log 2>/dev/null
fi
