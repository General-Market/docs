#!/bin/bash
# testnet.sh — Manage Index testnet on VPSes
#
# Architecture:
#   VPS 1 (be)       — data-node, 3 issuers, PostgreSQL
#   VPS 2 (postgres)  — AP, L3 Orbit chain (Docker)
#   Mac (local)       — contract deployment (forge)
#   Vercel            — frontend (www.generalmarket.io)
#
# Chains:
#   L3 (Orbit)        — chain 111222333, http://142.132.164.24/
#   Settlement (Sonic) — chain 14601, https://rpc.testnet.soniclabs.com
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
# L3 (Orbit)
CHAIN_ID=111222333
RPC_URL="http://142.132.164.24/"

# Settlement chain (Sonic Testnet)
SETTLEMENT_CHAIN_ID=14601
SETTLEMENT_RPC_URL="https://rpc.testnet.soniclabs.com"

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

vps_be_ssh() { ssh -o ConnectTimeout=10 "$VPS_BE_HOST" "$@" < /dev/null 2>/dev/null; }
vps_chain_ssh() { ssh -o ConnectTimeout=10 "$VPS_CHAIN_HOST" "$@" < /dev/null 2>/dev/null; }

# Start a daemon on a remote VPS without SSH hanging.
# Base64-encodes the script locally, decodes + runs on remote with setsid.
# This avoids heredoc (broken by SSH stdin=/dev/null) and quoting issues.
# Usage: _remote_start <ssh_func> <script_content> <log_file>
_remote_start() {
    local ssh_func="$1"
    local script="$2"
    local logfile="$3"
    local script_path="/tmp/start-daemon-$RANDOM.sh"

    # Base64-encode the script content (macOS base64 uses no flag for encode)
    local b64
    b64=$(printf '#!/bin/bash\n%s\n' "$script" | base64)

    $ssh_func "echo '$b64' | base64 -d > $script_path && \
chmod +x $script_path && \
( setsid bash $script_path > $logfile 2>&1 < /dev/null & ) ; \
sleep 0.3 ; rm -f $script_path"
}

check_service() {
    local host=$1 name=$2 pattern=$3
    if ssh -o ConnectTimeout=5 "$host" "pgrep -f '$pattern' > /dev/null 2>&1" < /dev/null 2>/dev/null; then
        local pid=$(ssh -o ConnectTimeout=5 "$host" "pgrep -f '$pattern' | head -1" < /dev/null 2>/dev/null)
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

_merge_deployments() {
    local l3_json="$1"       # e.g., deployments/e2e-full-system-l3.json
    local sonic_json="$2"    # e.g., deployments/e2e-full-system-sonic.json
    local output="$3"        # e.g., deployments/active-deployment.json

    python3 -c "
import json
l3 = json.load(open('$l3_json'))
sonic = json.load(open('$sonic_json'))
sc = sonic['contracts']
# Override settlement-specific contracts with Sonic addresses
for key in ['SettlementBridgeCustody', 'SETTLEMENT_USDC', 'SETTLEMENT_USDC_DECIMALS', 'MockBitgetVault', 'MOCK_USDT', 'BridgedItpFactory']:
    if key in sc:
        l3['contracts'][key] = sc[key]
# Add Sonic-specific keys
if 'IssuerRegistry' in sc:
    l3['contracts']['SettlementIssuerRegistry'] = sc['IssuerRegistry']
# BridgeProxy: frontend/E2E use this for settlement operations (requestCreateItp etc.)
# so it MUST point to the Sonic address. Save L3's as L3BridgeProxy.
if 'BridgeProxy' in sc:
    l3['contracts']['L3BridgeProxy'] = l3['contracts'].get('BridgeProxy', '')
    l3['contracts']['BridgeProxy'] = sc['BridgeProxy']
    l3['contracts']['SettlementBridgeProxy'] = sc['BridgeProxy']
# Add settlement chain metadata
l3['settlementChainId'] = $SETTLEMENT_CHAIN_ID
json.dump(l3, open('$output', 'w'), indent=2)
print('Merged: L3 (%d contracts) + Sonic (%d contracts) -> %s' % (len(l3['contracts']), len(sc), '$output'))
"
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
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p issuer -p curator 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
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

    # Check bls-tool binary (needed for FFI in deploy scripts)
    echo -e "${BLUE}[2/7] Checking bls-tool (FFI)...${NC}"
    if [ ! -f "target/release/bls-tool" ]; then
        echo -e "  ${RED}bls-tool binary not found at target/release/bls-tool${NC}"
        echo -e "  ${YELLOW}Build it manually: cargo build --release -p bls-tool${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}bls-tool ready${NC}"

    # Deploy core system (must run from contracts/ for foundry.toml remappings)
    echo -e "${BLUE}[3/7] Deploying core contracts (Index, IssuerRegistry, USDC, BridgeProxy)...${NC}"
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        > logs/deploy-core.log 2>&1

    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        echo -e "  ${RED}Core deployment failed — check logs/deploy-core.log${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}Core contracts deployed${NC}"

    # 3b: Deploy settlement contracts to Sonic
    echo -e "${BLUE}[3b/7] Deploying settlement contracts to Sonic (chain $SETTLEMENT_CHAIN_ID)...${NC}"

    # Save L3 deployment before Sonic overwrites it
    # The forge script writes to e2e-full-system.json (not active-deployment.json)
    cp deployments/e2e-full-system.json deployments/e2e-full-system-l3.json 2>/dev/null || true

    SONIC_CHAIN_ID=$(cast chain-id --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "0")
    if [ "$SONIC_CHAIN_ID" != "$SETTLEMENT_CHAIN_ID" ]; then
        echo -e "  ${YELLOW}Sonic not reachable (got $SONIC_CHAIN_ID, expected $SETTLEMENT_CHAIN_ID) — skipping settlement deploy${NC}"
    else
        (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
            --rpc-url "$SETTLEMENT_RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --broadcast \
            --chain-id $SETTLEMENT_CHAIN_ID \
            --slow) \
            > logs/deploy-sonic.log 2>&1 || echo -e "  ${YELLOW}Sonic forge script had errors — check logs/deploy-sonic.log${NC}"

        if [ -f "$DEPLOYMENT_FILE" ]; then
            cp "$DEPLOYMENT_FILE" deployments/e2e-full-system-sonic.json
            echo -e "  ${GREEN}Sonic contracts deployed${NC}"
        else
            echo -e "  ${YELLOW}Sonic deploy didn't write JSON — contracts may still be deployed (check log)${NC}"
        fi

        # Merge L3 + Sonic into active deployment
        _merge_deployments \
            deployments/e2e-full-system-l3.json \
            deployments/e2e-full-system-sonic.json \
            "$DEPLOYMENT_FILE"
        echo -e "  ${GREEN}Merged L3 + Sonic deployment${NC}"
    fi

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

    # Fund accounts with gas on Sonic
    echo -e "${BLUE}[4b/7] Funding accounts with gas on Sonic...${NC}"
    for addr in "$ISSUER_1_ADDR" "$ISSUER_2_ADDR" "$ISSUER_3_ADDR" "$AP_ADDR"; do
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$addr" --value 0.5ether > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Funded 4 accounts with 0.5 S each on Sonic${NC}"

    # Deploy Morpho (no timelock wait)
    echo -e "${BLUE}[5/7] Deploying Morpho (forked, no timelock)...${NC}"
    L3_USDC=$(read_deployment_addr "L3_WUSDC")
    ITP_VAULT=$(read_deployment_addr "BridgedItpFactory")
    ISSUER_REGISTRY=$(read_deployment_addr "IssuerRegistry")

    (cd contracts && DEPLOYER_KEY="$DEPLOYER_KEY" \
    SETTLEMENT_USDC="$L3_USDC" ITP_VAULT="$ITP_VAULT" ISSUER_REGISTRY="$ISSUER_REGISTRY" \
    forge script script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        >> logs/deploy-morpho.log 2>&1 || echo -e "  ${YELLOW}Morpho deploy had warnings — check logs/deploy-morpho.log${NC}"
    echo -e "  ${GREEN}Morpho deployed${NC}"

    # Deploy Vision
    echo -e "${BLUE}[6/7] Deploying Vision + batches...${NC}"
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    ISSUER_REGISTRY="$ISSUER_REGISTRY" USDC_ADDRESS="$L3_USDC" \
    forge script script/DeployVision.s.sol:DeployVision \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        >> logs/deploy-vision.log 2>&1 || echo -e "  ${YELLOW}Vision deploy had warnings${NC}"

    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
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

    # Fund accounts with SETTLEMENT_USDC on Sonic (6 decimals)
    SONIC_USDC=$(read_deployment_addr "SETTLEMENT_USDC")
    if [ -n "$SONIC_USDC" ] && [ "$SONIC_USDC" != "" ]; then
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$SONIC_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" 50000000000 \
            > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded deployer with 50k SETTLEMENT_USDC on Sonic${NC}"
    fi

    # Sync deployment JSONs to envs/testnet/ so switch-env.sh testnet stays current
    if [ -d "envs/testnet" ]; then
        [ -f "$DEPLOYMENT_FILE" ] && cp "$DEPLOYMENT_FILE" envs/testnet/deployment.json
        [ -f "deployments/morpho-e2e.json" ] && cp deployments/morpho-e2e.json envs/testnet/morpho-deployment.json
        [ -f "deployments/vision-batches.json" ] && cp deployments/vision-batches.json envs/testnet/vision-batches.json
        # Update Vision address in envs/testnet/.env
        VISION_ADDR=$(read_deployment_addr "Vision")
        if [ -n "$VISION_ADDR" ] && [ -f "envs/testnet/.env" ]; then
            sed -i '' "s|^NEXT_PUBLIC_VISION_ADDRESS=.*|NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}|" envs/testnet/.env
        fi
        echo -e "  ${GREEN}Synced deployment JSONs + Vision address → envs/testnet/${NC}"
    fi

    echo ""
    echo -e "${GREEN}All contracts deployed. Push deployment files to GitHub:${NC}"
    echo -e "  ${CYAN}git add deployments/ envs/testnet/ && git commit -m 'chore: testnet deployment' && git push mono main${NC}"
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

    # Start Sonic RPC proxy on VPS 1 (rate-limited caching proxy)
    echo -e "${BLUE}[3/4] Starting services on VPS 1...${NC}"
    _start_sonic_proxy
    _start_data_node
    _start_issuers

    # Start AP on VPS 2
    echo -e "${BLUE}[4/4] Starting AP on VPS 2...${NC}"
    _start_ap

    echo ""
    echo -e "${GREEN}All services started. Check status: ./testnet.sh status${NC}"
}

_start_sonic_proxy() {
    # Start rate-limiting proxy for Sonic testnet RPC on VPS 1
    if vps_be_ssh "pgrep -f sonic-rpc-proxy > /dev/null 2>&1"; then
        echo -e "  ${GREEN}Sonic RPC proxy already running${NC}"
        return
    fi
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/scripts/sonic-rpc-proxy.py" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/scripts/sonic-rpc-proxy.py"
    _remote_start vps_be_ssh "cd $VPS_BE_DIR
mkdir -p logs
exec python3 scripts/sonic-rpc-proxy.py 8547 $SETTLEMENT_RPC_URL" "$VPS_BE_DIR/logs/sonic-proxy.log"
    sleep 1
    if vps_be_ssh "pgrep -f sonic-rpc-proxy > /dev/null 2>&1"; then
        echo -e "  ${GREEN}Sonic RPC proxy started on :8547${NC}"
    else
        echo -e "  ${YELLOW}Sonic proxy failed — using direct RPC${NC}"
    fi
}

# Settlement RPC for VPS services (through local proxy to avoid 429s)
SETTLEMENT_RPC_VPS="http://127.0.0.1:8547"

_start_data_node() {
    if ssh -o ConnectTimeout=5 "$VPS_BE_HOST" "pgrep -x data-node > /dev/null 2>&1" < /dev/null 2>/dev/null; then
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

    _remote_start vps_be_ssh "cd $VPS_BE_DIR
mkdir -p logs
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres:///$DB_NAME|' data-node/.env
exec ./target/release/data-node serve \\
    --database-url postgres:///$DB_NAME \\
    --symbol-map data/symbol-map.json \\
    --rpc-url $RPC_URL \\
    --settlement-rpc-url $SETTLEMENT_RPC_VPS \\
    --deployment-file $DEPLOYMENT_FILE \\
    --morpho-deployment-file deployments/morpho-e2e.json \\
    --ecb-enabled \\
    --openmeteo-sync-interval 300 \\
    $INDEX_FLAG" "$VPS_BE_DIR/logs/data-node.log"
    sleep 2

    if ssh -o ConnectTimeout=5 "$VPS_BE_HOST" "pgrep -x data-node > /dev/null 2>&1" < /dev/null 2>/dev/null; then
        echo -e "  ${GREEN}data-node started${NC}"
    else
        echo -e "  ${RED}data-node failed to start — check: ssh $VPS_BE_HOST 'tail -50 $VPS_BE_DIR/logs/data-node.log'${NC}"
    fi
}

_start_issuers() {
    # Check if already running
    if ssh -o ConnectTimeout=5 "$VPS_BE_HOST" "pgrep -x issuer > /dev/null 2>&1" < /dev/null 2>/dev/null; then
        echo -e "  ${GREEN}issuers already running${NC}"
        return
    fi

    ISSUER_KEYS=("$ISSUER_1_KEY" "$ISSUER_2_KEY" "$ISSUER_3_KEY")

    # Clean up stale WAL files and set log level
    vps_be_ssh "cd $VPS_BE_DIR && rm -f logs/consensus-*.wal"

    # Get current L3 block to skip stale events from old deployments
    L3_FROM_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    echo -e "  L3 block: $L3_FROM_BLOCK (issuers will start from here)"

    # Read contract addresses from deployment file
    VISION_ADDR=$(read_deployment_addr "Vision")
    BRIDGE_PROXY=$(read_deployment_addr "SettlementBridgeProxy")
    [ -z "$BRIDGE_PROXY" ] && BRIDGE_PROXY=$(read_deployment_addr "BridgeProxy")

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
            VISION_ARGS="--vision-enabled \\
    --vision-address $VISION_ADDR \\
    --vision-database-url postgres:///$DB_NAME \\
    --vision-data-node-url http://localhost:$DATA_NODE_PORT \\
    --vision-rpc-ws-url $RPC_URL \\
    --vision-reveal-window-secs 60 \\
    --vision-tick-poll-interval-ms 500"
        fi

        # Bridge proxy arg
        BRIDGE_ARG=""
        if [ -n "$BRIDGE_PROXY" ]; then
            BRIDGE_ARG="--bridge-proxy $BRIDGE_PROXY"
        fi

        # Write key file first (separate SSH call, always works)
        vps_be_ssh "echo '$KEY' > /tmp/issuer-key-$i.txt"

        _remote_start vps_be_ssh "cd $VPS_BE_DIR
mkdir -p logs
export ISSUER_PRIVATE_KEY_PATH=/tmp/issuer-key-$i.txt
export ISSUER_PEERS=$PEERS
export ISSUER_RPC_URL=$RPC_URL
export ISSUER_SETTLEMENT_RPC_URL=$SETTLEMENT_RPC_VPS
export ISSUER_SETTLEMENT_CHAIN_ID=$SETTLEMENT_CHAIN_ID
export ISSUER_SETTLEMENT_PRIVATE_KEY=$DEPLOYER_KEY
export DATA_NODE_URL=http://localhost:$DATA_NODE_PORT
export EXCHANGE_MODE=mock
exec ./target/release/issuer \\
    --node-id $i \\
    --port $PORT \\
    --rpc $RPC_URL \\
    --cycle-duration-ms 1000 \\
    --min-cycle-gap-ms 50 \\
    --consensus-timeout-ms 800 \\
    --no-tls \\
    --test-key-seeds \\
    --bls-key-seed-index $BLS_IDX \\
    --num-issuers $ISSUER_COUNT \\
    --signature-threshold 2 \\
    --registry-sync \\
    --ntp-server '' \\
    --data-node-url http://localhost:$DATA_NODE_PORT \\
    --deployment-file $DEPLOYMENT_FILE \\
    --symbol-map-file data/symbol-map.json \\
    --wal-path logs/consensus-$i.wal \\
    --log-level info \\
    --from-block $L3_FROM_BLOCK \\
    --sign-timeout-ms 5000 \\
    --itp-id 0x0000000000000000000000000000000000000000000000000000000000000001 \\
    $BRIDGE_ARG \\
    $VISION_ARGS" "$VPS_BE_DIR/logs/issuer-$i.log"

        echo -e "  Issuer $i started on port $PORT"
        # Stagger: let this issuer bind its port before the next one connects
        [ $i -lt $ISSUER_COUNT ] && sleep 1
    done

    echo -e "  ${GREEN}All $ISSUER_COUNT issuers started${NC}"
}

_start_ap() {
    if ssh -o ConnectTimeout=5 "$VPS_CHAIN_HOST" "pgrep -x ap > /dev/null 2>&1" < /dev/null 2>/dev/null; then
        echo -e "  ${GREEN}AP already running${NC}"
        return
    fi

    INDEX_ADDR=$(read_deployment_addr "Index")
    MOCK_VAULT=$(read_deployment_addr "MockBitgetVault")

    # AP uses local RPC (nginx → Docker sequencer on same VPS)
    INDEX_ARG=""
    [ -n "$INDEX_ADDR" ] && INDEX_ARG="--index-contract $INDEX_ADDR"
    VAULT_ARG=""
    [ -n "$MOCK_VAULT" ] && VAULT_ARG="--bitget-vault $MOCK_VAULT"

    _remote_start vps_chain_ssh "cd $VPS_CHAIN_DIR
mkdir -p logs
export AP_PRIVATE_KEY=$AP_KEY
exec ./target/release/ap \\
    --port 9100 \\
    --rpc http://localhost/ \\
    --exchange-mode mock \\
    --settlement-rpc $SETTLEMENT_RPC_URL \\
    --settlement-chain-id $SETTLEMENT_CHAIN_ID \\
    --deployment-file $DEPLOYMENT_FILE \\
    --data-node-url http://$VPS_BE_IP:$DATA_NODE_PORT \\
    --log-level info \\
    $INDEX_ARG \\
    $VAULT_ARG" "$VPS_CHAIN_DIR/logs/ap.log"
    sleep 1

    if ssh -o ConnectTimeout=5 "$VPS_CHAIN_HOST" "pgrep -x ap > /dev/null 2>&1" < /dev/null 2>/dev/null; then
        echo -e "  ${GREEN}AP started on port 9100${NC}"
    else
        echo -e "  ${RED}AP failed — check: ssh $VPS_CHAIN_HOST 'tail -50 $VPS_CHAIN_DIR/logs/ap.log'${NC}"
    fi
}

# ── stop: Stop all VPS services ──────────────────────────────
cmd_stop() {
    echo -e "${CYAN}Stopping all services...${NC}"

    echo -e "${BLUE}VPS 1 (issuers + data-node)...${NC}"
    vps_be_ssh "pkill -x issuer 2>/dev/null; pkill -x data-node 2>/dev/null; pkill -f sonic-rpc-proxy 2>/dev/null; sleep 1; pkill -9 -x issuer 2>/dev/null; pkill -9 -x data-node 2>/dev/null; true"
    echo -e "  ${GREEN}VPS 1 stopped${NC}"

    echo -e "${BLUE}VPS 2 (AP)...${NC}"
    vps_chain_ssh "pkill -x ap 2>/dev/null; sleep 1; pkill -9 -x ap 2>/dev/null; true"
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

    # Check Settlement chain (Sonic)
    echo ""
    echo -e "${BLUE}Settlement Chain (Sonic):${NC}"
    SONIC_ID=$(cast chain-id --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "unreachable")
    if [ "$SONIC_ID" = "$SETTLEMENT_CHAIN_ID" ]; then
        SBLOCK=$(cast block-number --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}Sonic OK — chain $SONIC_ID, block $SBLOCK${NC}"
    else
        echo -e "  ${RED}Sonic unreachable${NC}"
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

    echo -e "${BLUE}[3/4] Rebuilding on VPS 1 (data-node + issuer + curator)...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p issuer -p curator 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
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
        echo "  Settlement chain $SETTLEMENT_CHAIN_ID  — $SETTLEMENT_RPC_URL"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Run ./testnet.sh help for usage"
        exit 1
        ;;
esac
