#!/bin/bash
# testnet.sh — Manage Index testnet on VPSes (Orbit L3, chain 111222333)
#
# Architecture:
#   VPS 1 (be)       — data-node, 3 issuers, PostgreSQL
#   VPS 2 (postgres)  — AP, L3 Orbit chain (Docker)
#   Mac (local)       — contract deployment (forge)
#   Vercel            — frontend (www.generalmarket.io)
#
# Usage:
#   ./testnet.sh setup-be       # First-time VPS 1 setup (PostgreSQL, clone, build)
#   ./testnet.sh setup-chain    # First-time VPS 2 setup (clone, build AP)
#   ./testnet.sh deploy         # Deploy contracts from Mac to L3
#   ./testnet.sh start          # Start all services on VPSes
#   ./testnet.sh stop           # Stop all services on VPSes
#   ./testnet.sh status         # Check what's running
#   ./testnet.sh update         # git pull + rebuild + restart on both VPSes
#   ./testnet.sh logs [service] # Tail logs (data-node, issuer-1..3, ap)

set -e

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Configuration ────────────────────────────────────────────
CHAIN_ID=111222333
RPC_URL="http://142.132.164.24/"
GITHUB_REPO="https://github.com/General-Market/mono.git"

# VPS 1 — Backend (issuers + data-node + PostgreSQL)
VPS_BE_HOST="index-maker/prod/be"
VPS_BE_IP="116.203.156.98"
VPS_BE_USER="max"
VPS_BE_DIR="/home/max/index"
DATA_NODE_PORT=8200

# VPS 2 — Chain + AP
VPS_CHAIN_HOST="index-maker/prod/postgres"
VPS_CHAIN_IP="142.132.164.24"
VPS_CHAIN_USER="max"
VPS_CHAIN_DIR="/home/max/index"

# Deployer (chain owner, contract deployer)
DEPLOYER_KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER_ADDRESS="0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4"

# Issuer keys — Anvil accounts 1-3 (must match DeployFullSystemE2E._registerIssuers)
ISSUER_1_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
ISSUER_2_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
ISSUER_3_KEY="0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
ISSUER_COUNT=3

# AP key — Anvil account 4
AP_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"

# Database
DB_NAME="index_prices"

# Deployment file
DEPLOYMENT_FILE="deployments/active-deployment.json"

# rsync SSH (macOS rsync doesn't handle SSH aliases with /)
RSYNC_SSH_BE="ssh -o ProxyJump=bastion -p 3189"

# ── Helpers ──────────────────────────────────────────────────

vps_be_ssh() { ssh -o ConnectTimeout=10 "$VPS_BE_HOST" "$@" 2>/dev/null; }
vps_chain_ssh() { ssh -o ConnectTimeout=10 "$VPS_CHAIN_HOST" "$@" 2>/dev/null; }

check_service() {
    local host=$1 name=$2 pattern=$3
    if ssh -o ConnectTimeout=5 "$host" "pgrep -f '$pattern' > /dev/null 2>&1" 2>/dev/null; then
        local pid=$(ssh -o ConnectTimeout=5 "$host" "pgrep -f '$pattern' | head -1" 2>/dev/null)
        echo -e "  ${GREEN}$name running (PID: $pid)${NC}"
        return 0
    else
        echo -e "  ${YELLOW}$name not running${NC}"
        return 1
    fi
}

read_deployment_addr() {
    local key=$1
    python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('$key', ''))" 2>/dev/null || echo ""
}

# ── setup-be: First-time VPS 1 setup ────────────────────────
cmd_setup_be() {
    echo -e "${CYAN}Setting up VPS 1 (Backend)...${NC}"
    echo -e "${BLUE}[1/5] Checking SSH access...${NC}"
    vps_be_ssh "echo ok" || { echo -e "${RED}Cannot SSH to VPS 1${NC}"; exit 1; }
    echo -e "  ${GREEN}SSH OK${NC}"

    echo -e "${BLUE}[2/5] Installing Rust...${NC}"
    vps_be_ssh 'command -v cargo >/dev/null 2>&1 && echo "RUST_OK" || (curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y)' | grep -v 'Unauthorized\|monitored'
    echo -e "  ${GREEN}Rust ready${NC}"

    echo -e "${BLUE}[3/5] Setting up PostgreSQL...${NC}"
    # Check if PostgreSQL is installed
    if vps_be_ssh "command -v psql >/dev/null 2>&1"; then
        echo -e "  ${GREEN}PostgreSQL already installed${NC}"
    else
        echo -e "  ${YELLOW}PostgreSQL not installed. Install manually:${NC}"
        echo -e "  ${CYAN}ssh $VPS_BE_HOST${NC}"
        echo -e "  ${CYAN}su - ans  # then: sudo apt install -y postgresql${NC}"
        exit 1
    fi
    # Check role + DB
    DB_OK=$(vps_be_ssh "psql -U max -d $DB_NAME -c 'SELECT 1' 2>&1 | grep -c '1 row'" || echo "0")
    if [ "$DB_OK" = "1" ]; then
        echo -e "  ${GREEN}Database $DB_NAME ready${NC}"
    else
        echo -e "  ${YELLOW}Database not set up. Run manually:${NC}"
        echo -e "  ${CYAN}ssh $VPS_BE_HOST${NC}"
        echo -e "  ${CYAN}su - ans  # then: sudo -u postgres createuser -s max${NC}"
        echo -e "  ${CYAN}createdb $DB_NAME${NC}"
        exit 1
    fi

    echo -e "${BLUE}[4/5] Cloning repo from GitHub...${NC}"
    if vps_be_ssh "[ -d $VPS_BE_DIR/.git ]"; then
        echo -e "  ${GREEN}Repo already cloned — pulling latest...${NC}"
        vps_be_ssh "cd $VPS_BE_DIR && git pull origin main" | tail -3
    else
        vps_be_ssh "git clone $GITHUB_REPO $VPS_BE_DIR" | tail -3
    fi
    echo -e "  ${GREEN}Repo ready${NC}"

    echo -e "${BLUE}[5/5] Building binaries...${NC}"
    echo -e "  ${YELLOW}This may take several minutes on first build...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p issuer 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
    echo -e "  ${GREEN}Build complete${NC}"

    # Sync .env for data-node
    echo -e "${BLUE}Syncing data-node .env...${NC}"
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data-node/.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data-node/.env"
    echo -e "  ${GREEN}VPS 1 setup complete${NC}"
}

# ── setup-chain: First-time VPS 2 setup ─────────────────────
cmd_setup_chain() {
    echo -e "${CYAN}Setting up VPS 2 (Chain + AP)...${NC}"
    echo -e "${BLUE}[1/3] Checking SSH access...${NC}"
    vps_chain_ssh "echo ok" || { echo -e "${RED}Cannot SSH to VPS 2${NC}"; exit 1; }
    echo -e "  ${GREEN}SSH OK${NC}"

    echo -e "${BLUE}[2/3] Cloning repo from GitHub...${NC}"
    if vps_chain_ssh "[ -d $VPS_CHAIN_DIR/.git ]"; then
        echo -e "  ${GREEN}Repo already cloned — pulling latest...${NC}"
        vps_chain_ssh "cd $VPS_CHAIN_DIR && git pull origin main" | tail -3
    else
        vps_chain_ssh "git clone $GITHUB_REPO $VPS_CHAIN_DIR" | tail -3
    fi
    echo -e "  ${GREEN}Repo ready${NC}"

    echo -e "${BLUE}[3/3] Building AP binary...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p ap 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
    echo -e "  ${GREEN}VPS 2 setup complete${NC}"
}

# ── deploy: Deploy contracts from Mac to L3 ──────────────────
cmd_deploy() {
    echo -e "${CYAN}Deploying contracts to L3 (chain $CHAIN_ID)...${NC}"

    # Prerequisites
    for cmd in forge cast python3; do
        command -v $cmd &>/dev/null || { echo -e "${RED}$cmd not found${NC}"; exit 1; }
    done

    # Check L3 is reachable
    echo -e "${BLUE}[1/7] Checking L3 RPC...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    if [ "$VPS_CHAIN_ID" != "$CHAIN_ID" ]; then
        echo -e "  ${RED}L3 not reachable (got chain $VPS_CHAIN_ID, expected $CHAIN_ID)${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}L3 OK (chain $VPS_CHAIN_ID)${NC}"

    # Build bls-tool (needed for FFI in deploy scripts)
    echo -e "${BLUE}[2/7] Building bls-tool (FFI)...${NC}"
    cargo build --release -p bls-tool 2>&1 | tail -3
    echo -e "  ${GREEN}bls-tool ready${NC}"

    # Deploy core system
    echo -e "${BLUE}[3/7] Deploying core contracts (Index, IssuerRegistry, USDC, BridgeProxy)...${NC}"
    forge script contracts/script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow \
        > logs/deploy-core.log 2>&1

    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        echo -e "  ${RED}Core deployment failed — check logs/deploy-core.log${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}Core contracts deployed${NC}"

    # Fund Anvil accounts 1-4 (issuers + AP) with GM for gas
    echo -e "${BLUE}[4/7] Funding issuer + AP accounts with gas...${NC}"
    ISSUER_1_ADDR=$(cast wallet address "$ISSUER_1_KEY")
    ISSUER_2_ADDR=$(cast wallet address "$ISSUER_2_KEY")
    ISSUER_3_ADDR=$(cast wallet address "$ISSUER_3_KEY")
    AP_ADDR=$(cast wallet address "$AP_KEY")

    for addr in "$ISSUER_1_ADDR" "$ISSUER_2_ADDR" "$ISSUER_3_ADDR" "$AP_ADDR"; do
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$addr" --value 10ether > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Funded 4 accounts with 10 GM each${NC}"

    # Deploy Morpho (no timelock wait)
    echo -e "${BLUE}[5/7] Deploying Morpho (forked, no timelock)...${NC}"
    L3_USDC=$(read_deployment_addr "L3_WUSDC")
    ITP_VAULT=$(read_deployment_addr "ITP_Vault")
    ISSUER_REGISTRY=$(read_deployment_addr "IssuerRegistry")

    ARB_USDC="$L3_USDC" ITP_VAULT="$ITP_VAULT" ISSUER_REGISTRY="$ISSUER_REGISTRY" \
    forge script contracts/script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow \
        >> logs/deploy-morpho.log 2>&1 || echo -e "  ${YELLOW}Morpho deploy had warnings — check logs/deploy-morpho.log${NC}"
    echo -e "  ${GREEN}Morpho deployed${NC}"

    # Deploy Vision
    echo -e "${BLUE}[6/7] Deploying Vision + batches...${NC}"
    forge script contracts/script/DeployVision.s.sol:DeployVision \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow \
        >> logs/deploy-vision.log 2>&1 || echo -e "  ${YELLOW}Vision deploy had warnings${NC}"

    forge script contracts/script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow \
        >> logs/deploy-vision-batches.log 2>&1 || echo -e "  ${YELLOW}Vision batches had warnings${NC}"
    echo -e "  ${GREEN}Vision deployed${NC}"

    # Fund test accounts with L3 USDC
    echo -e "${BLUE}[7/7] Funding accounts with L3 USDC...${NC}"
    if [ -n "$L3_USDC" ] && [ "$L3_USDC" != "" ]; then
        # Mint 1M USDC to deployer
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$L3_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" 1000000000000000000000000 \
            > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded deployer with 1M L3 USDC${NC}"
    fi

    echo ""
    echo -e "${GREEN}All contracts deployed. Push deployment files to GitHub:${NC}"
    echo -e "  ${CYAN}git add deployments/ && git commit -m 'chore: testnet deployment' && git push mono main${NC}"
    echo -e "  ${CYAN}Then run: ./testnet.sh update${NC}"
}

# ── start: Start all services on VPSes ───────────────────────
cmd_start() {
    echo -e "${CYAN}Starting all services on VPSes...${NC}"

    # Check L3 is up
    echo -e "${BLUE}[1/4] Checking L3 chain...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    if [ "$VPS_CHAIN_ID" != "$CHAIN_ID" ]; then
        echo -e "  ${RED}L3 not reachable${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}L3 OK${NC}"

    # Check deployment file exists on VPSes
    echo -e "${BLUE}[2/4] Checking deployment files on VPSes...${NC}"
    if ! vps_be_ssh "[ -f $VPS_BE_DIR/$DEPLOYMENT_FILE ]"; then
        echo -e "  ${RED}No deployment file on VPS 1. Run: ./testnet.sh update${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}Deployment files present${NC}"

    # Start data-node on VPS 1
    echo -e "${BLUE}[3/4] Starting services on VPS 1...${NC}"
    _start_data_node
    _start_issuers

    # Start AP on VPS 2
    echo -e "${BLUE}[4/4] Starting AP on VPS 2...${NC}"
    _start_ap

    echo ""
    echo -e "${GREEN}All services started. Check status: ./testnet.sh status${NC}"
}

_start_data_node() {
    if ssh -o ConnectTimeout=5 "$VPS_BE_HOST" "pgrep -x data-node > /dev/null 2>&1" 2>/dev/null; then
        echo -e "  ${GREEN}data-node already running${NC}"
        return
    fi

    # Sync .env, config files, and credentials
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data-node/.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data-node/.env"
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/assets.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/assets.json" 2>/dev/null || true
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data/symbol-map.json" 2>/dev/null || true
    [ -f "$SCRIPT_DIR/system.env" ] && rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/system.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/system.env" 2>/dev/null || true

    # Read Index contract address from deployment file
    local INDEX_ADDR
    INDEX_ADDR=$(read_deployment_addr "Index")
    local INDEX_FLAG=""
    if [ -n "$INDEX_ADDR" ]; then
        INDEX_FLAG="--index-address $INDEX_ADDR"
    fi

    vps_be_ssh "cd $VPS_BE_DIR && \
        sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres:///$DB_NAME|' data-node/.env && \
        mkdir -p logs && \
        nohup ./target/release/data-node serve \
            --database-url postgres:///$DB_NAME \
            --symbol-map data/symbol-map.json \
            --rpc-url $RPC_URL \
            --arb-rpc-url $RPC_URL \
            --deployment-file $DEPLOYMENT_FILE \
            --morpho-deployment-file deployments/morpho-e2e.json \
            --ecb-enabled \
            --openmeteo-sync-interval 300 \
            $INDEX_FLAG \
            > logs/data-node.log 2>&1 &
        echo \$!"
    sleep 2

    if ssh -o ConnectTimeout=5 "$VPS_BE_HOST" "pgrep -x data-node > /dev/null 2>&1" 2>/dev/null; then
        echo -e "  ${GREEN}data-node started${NC}"
    else
        echo -e "  ${RED}data-node failed to start — check: ssh $VPS_BE_HOST 'tail -50 $VPS_BE_DIR/logs/data-node.log'${NC}"
    fi
}

_start_issuers() {
    # Check if already running
    if ssh -o ConnectTimeout=5 "$VPS_BE_HOST" "pgrep -f 'target/release/issuer' > /dev/null 2>&1" 2>/dev/null; then
        echo -e "  ${GREEN}issuers already running${NC}"
        return
    fi

    ISSUER_KEYS=("$ISSUER_1_KEY" "$ISSUER_2_KEY" "$ISSUER_3_KEY")

    # Read contract addresses from deployment file
    VISION_ADDR=$(read_deployment_addr "Vision")
    BRIDGE_PROXY=$(read_deployment_addr "BridgeProxy")

    for i in 1 2 3; do
        PORT=$((9000 + i))
        BLS_IDX=$((i - 1))
        KEY="${ISSUER_KEYS[$BLS_IDX]}"

        # Build peer list
        PEERS=""
        for j in 1 2 3; do
            if [ $j -ne $i ]; then
                [ -n "$PEERS" ] && PEERS="$PEERS,"
                PEERS="${PEERS}127.0.0.1:$((9000 + j))"
            fi
        done

        # Vision args
        VISION_ARGS=""
        if [ -n "$VISION_ADDR" ] && [ "$VISION_ADDR" != "" ]; then
            VISION_ARGS="--vision-enabled \
                --vision-address $VISION_ADDR \
                --vision-database-url postgres:///$DB_NAME \
                --vision-data-node-url http://localhost:$DATA_NODE_PORT \
                --vision-rpc-ws-url $RPC_URL \
                --vision-reveal-window-secs 60 \
                --vision-tick-poll-interval-ms 500"
        fi

        vps_be_ssh "cd $VPS_BE_DIR && \
            mkdir -p logs /tmp && \
            echo '$KEY' > /tmp/issuer-key-$i.txt && \
            ISSUER_PRIVATE_KEY_PATH=/tmp/issuer-key-$i.txt \
            ISSUER_PEERS=$PEERS \
            ISSUER_RPC_URL=$RPC_URL \
            ISSUER_ARBITRUM_RPC_URL=$RPC_URL \
            ISSUER_ARBITRUM_CHAIN_ID=$CHAIN_ID \
            DATA_NODE_URL=http://localhost:$DATA_NODE_PORT \
            EXCHANGE_MODE=mock \
            nohup ./target/release/issuer \
                --node-id $i \
                --port $PORT \
                --rpc $RPC_URL \
                --cycle-duration-ms 1000 \
                --min-cycle-gap-ms 50 \
                --consensus-timeout-ms 800 \
                --no-tls \
                --test-key-seeds \
                --bls-key-seed-index $BLS_IDX \
                --num-issuers $ISSUER_COUNT \
                --signature-threshold 2 \
                --registry-sync \
                --ntp-server \"\" \
                --data-node-url http://localhost:$DATA_NODE_PORT \
                --deployment-file $DEPLOYMENT_FILE \
                --symbol-map-file data/symbol-map.json \
                --wal-path logs/consensus-$i.wal \
                --log-level info \
                --itp-id 0x0000000000000000000000000000000000000000000000000000000000000001 \
                $([ -n \"$BRIDGE_PROXY\" ] && echo \"--bridge-proxy $BRIDGE_PROXY\") \
                $VISION_ARGS \
                > logs/issuer-$i.log 2>&1 &
            echo \$!"
        echo -e "  Issuer $i started on port $PORT"
    done

    echo -e "  ${GREEN}All $ISSUER_COUNT issuers started${NC}"
}

_start_ap() {
    if ssh -o ConnectTimeout=5 "$VPS_CHAIN_HOST" "pgrep -f 'target/release/ap' > /dev/null 2>&1" 2>/dev/null; then
        echo -e "  ${GREEN}AP already running${NC}"
        return
    fi

    INDEX_ADDR=$(read_deployment_addr "Index")
    MOCK_VAULT=$(read_deployment_addr "MockBitgetVault")

    # AP uses local RPC (nginx → Docker sequencer on same VPS)
    vps_chain_ssh "cd $VPS_CHAIN_DIR && \
        mkdir -p logs && \
        AP_PRIVATE_KEY=$AP_KEY \
        nohup ./target/release/ap \
            --port 9100 \
            --rpc http://localhost/ \
            --exchange-mode mock \
            --arb-rpc http://localhost/ \
            --arb-chain-id $CHAIN_ID \
            --deployment-file $DEPLOYMENT_FILE \
            --data-node-url http://$VPS_BE_IP:$DATA_NODE_PORT \
            --log-level info \
            $([ -n \"$INDEX_ADDR\" ] && echo \"--index-contract $INDEX_ADDR\") \
            $([ -n \"$MOCK_VAULT\" ] && echo \"--bitget-vault $MOCK_VAULT\") \
            > logs/ap.log 2>&1 &
        echo \$!"
    sleep 1

    if ssh -o ConnectTimeout=5 "$VPS_CHAIN_HOST" "pgrep -f 'target/release/ap' > /dev/null 2>&1" 2>/dev/null; then
        echo -e "  ${GREEN}AP started on port 9100${NC}"
    else
        echo -e "  ${RED}AP failed — check: ssh $VPS_CHAIN_HOST 'tail -50 $VPS_CHAIN_DIR/logs/ap.log'${NC}"
    fi
}

# ── stop: Stop all VPS services ──────────────────────────────
cmd_stop() {
    echo -e "${CYAN}Stopping all services...${NC}"

    echo -e "${BLUE}VPS 1 (issuers + data-node)...${NC}"
    vps_be_ssh "pkill -f 'target/release/issuer' 2>/dev/null || true; pkill -x data-node 2>/dev/null || true"
    echo -e "  ${GREEN}VPS 1 stopped${NC}"

    echo -e "${BLUE}VPS 2 (AP)...${NC}"
    vps_chain_ssh "pkill -f 'target/release/ap' 2>/dev/null || true"
    echo -e "  ${GREEN}VPS 2 stopped${NC}"

    echo -e "${GREEN}All services stopped${NC}"
}

# ── status: Check what's running ─────────────────────────────
cmd_status() {
    echo -e "${CYAN}Service status:${NC}"
    echo ""
    echo -e "${BLUE}VPS 1 ($VPS_BE_IP) — Backend:${NC}"
    check_service "$VPS_BE_HOST" "data-node" "data-node serve" || true
    check_service "$VPS_BE_HOST" "issuer-1" "node-id 1" || true
    check_service "$VPS_BE_HOST" "issuer-2" "node-id 2" || true
    check_service "$VPS_BE_HOST" "issuer-3" "node-id 3" || true

    echo ""
    echo -e "${BLUE}VPS 2 ($VPS_CHAIN_IP) — Chain + AP:${NC}"
    check_service "$VPS_CHAIN_HOST" "AP" "target/release/ap" || true

    # Check L3 chain
    echo ""
    echo -e "${BLUE}L3 Chain:${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "unreachable")
    if [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ]; then
        BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}L3 OK — chain $VPS_CHAIN_ID, block $BLOCK${NC}"
    else
        echo -e "  ${RED}L3 unreachable${NC}"
    fi

    # Check data-node health
    echo ""
    echo -e "${BLUE}Data-node health:${NC}"
    HEALTH=$(curl -sf "http://$VPS_BE_IP:$DATA_NODE_PORT/health" 2>/dev/null || echo "unreachable")
    if echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  db={d[\"db_connected\"]}, symbols={d[\"symbols_tracked\"]}')" 2>/dev/null; then
        echo -e "  ${GREEN}Healthy${NC}"
    else
        echo -e "  ${YELLOW}$HEALTH${NC}"
    fi
}

# ── update: Pull + rebuild + restart ─────────────────────────
cmd_update() {
    echo -e "${CYAN}Updating both VPSes from GitHub...${NC}"

    # Stop services first
    cmd_stop

    echo -e "${BLUE}[1/4] Pulling latest on VPS 1...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && git pull origin main 2>&1 | tail -5"
    echo -e "  ${GREEN}VPS 1 updated${NC}"

    echo -e "${BLUE}[2/4] Pulling latest on VPS 2...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && git pull origin main 2>&1 | tail -5"
    echo -e "  ${GREEN}VPS 2 updated${NC}"

    echo -e "${BLUE}[3/4] Rebuilding on VPS 1 (data-node + issuer)...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p issuer 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
    echo -e "  ${GREEN}VPS 1 build complete${NC}"

    echo -e "${BLUE}[4/4] Rebuilding on VPS 2 (AP)...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p ap 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
    echo -e "  ${GREEN}VPS 2 build complete${NC}"

    # Sync config files and credentials to VPS 1
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data-node/.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data-node/.env"
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/assets.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/assets.json" 2>/dev/null || true
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data/symbol-map.json" 2>/dev/null || true
    [ -f "$SCRIPT_DIR/system.env" ] && rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/system.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/system.env" 2>/dev/null || true

    # Restart
    cmd_start
}

# ── logs: Tail service logs ──────────────────────────────────
cmd_logs() {
    local service="${1:-all}"
    case $service in
        data-node)
            echo -e "${CYAN}Tailing data-node logs (VPS 1)...${NC}"
            ssh "$VPS_BE_HOST" "tail -f $VPS_BE_DIR/logs/data-node.log"
            ;;
        issuer-1|issuer-2|issuer-3)
            local num=${service#issuer-}
            echo -e "${CYAN}Tailing issuer-$num logs (VPS 1)...${NC}"
            ssh "$VPS_BE_HOST" "tail -f $VPS_BE_DIR/logs/issuer-$num.log"
            ;;
        ap)
            echo -e "${CYAN}Tailing AP logs (VPS 2)...${NC}"
            ssh "$VPS_CHAIN_HOST" "tail -f $VPS_CHAIN_DIR/logs/ap.log"
            ;;
        all|"")
            echo -e "${CYAN}Tailing issuer-1 + AP logs...${NC}"
            echo -e "${YELLOW}(Use ./testnet.sh logs <service> for specific logs)${NC}"
            ssh "$VPS_BE_HOST" "tail -f $VPS_BE_DIR/logs/issuer-1.log" &
            PID1=$!
            ssh "$VPS_CHAIN_HOST" "tail -f $VPS_CHAIN_DIR/logs/ap.log" &
            PID2=$!
            trap "kill $PID1 $PID2 2>/dev/null" INT
            wait
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            echo "Available: data-node, issuer-1, issuer-2, issuer-3, ap, all"
            exit 1
            ;;
    esac
}

# ── Main dispatcher ──────────────────────────────────────────
case "${1:-help}" in
    setup-be)    cmd_setup_be ;;
    setup-chain) cmd_setup_chain ;;
    deploy)      cmd_deploy ;;
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    status)      cmd_status ;;
    update)      cmd_update ;;
    logs)        cmd_logs "$2" ;;
    help|--help|-h)
        echo "Usage: ./testnet.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  setup-be       First-time VPS 1 setup (PostgreSQL, clone, build)"
        echo "  setup-chain    First-time VPS 2 setup (clone, build AP)"
        echo "  deploy         Deploy contracts from Mac to L3"
        echo "  start          Start all services on VPSes"
        echo "  stop           Stop all services on VPSes"
        echo "  status         Check what's running"
        echo "  update         git pull + rebuild + restart on both VPSes"
        echo "  logs [svc]     Tail logs (data-node, issuer-1..3, ap, all)"
        echo ""
        echo "Architecture:"
        echo "  VPS 1 ($VPS_BE_IP)    — data-node, 3 issuers, PostgreSQL"
        echo "  VPS 2 ($VPS_CHAIN_IP)  — AP, L3 Orbit chain"
        echo "  L3 chain $CHAIN_ID     — $RPC_URL"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Run ./testnet.sh help for usage"
        exit 1
        ;;
esac
