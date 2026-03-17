#!/bin/bash
# testnet.sh — Manage Index testnet on VPSes
#
# Architecture:
#   VPS 1 (be)       — data-node, 3 oracles, Curator, PostgreSQL
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
#   ./testnet.sh logs [service] # Tail logs (data-node, oracle-1..3, ap)

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

# VPS 1 — Backend (oracles + data-node + PostgreSQL)
VPS_BE_HOST="index-maker/prod/be"
VPS_BE_IP="116.203.156.98"
VPS_BE_USER="max"
VPS_BE_DIR="/home/max/index"
DATA_NODE_PORT=8200
EXPLORER_TOKEN="20b8dfdd244827f7a88d31dbe96b448938f1731437a9340e3a616ba63f2dc267"

# VPS 2 — Chain + AP
VPS_CHAIN_HOST="index-maker/prod/postgres"
VPS_CHAIN_IP="142.132.164.24"
VPS_CHAIN_USER="max"
VPS_CHAIN_DIR="/home/max/index"

# Deployer (chain owner, contract deployer)
DEPLOYER_KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER_ADDRESS="0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4"

# Oracle keys — Anvil accounts 1-3 (must match DeployFullSystemE2E._registerOracles)
ORACLE_1_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
ORACLE_2_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
ORACLE_3_KEY="0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
ORACLE_COUNT=3
ORACLE_KEYS=("$ORACLE_1_KEY" "$ORACLE_2_KEY" "$ORACLE_3_KEY")

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

# Settlement RPC for VPS services (through local proxy to avoid 429s)
SETTLEMENT_RPC_VPS="http://127.0.0.1:8547"

# Cleanup trap: remove local override YAMLs + remote key files on exit (prevents secrets on disk)
_cleanup() {
    rm -f "$SCRIPT_DIR"/.data-node-override.yml "$SCRIPT_DIR"/.oracle-override.yml "$SCRIPT_DIR"/.curator-override.yml "$SCRIPT_DIR"/.ap-override.yml
    # Only clean remote key files if we were starting/stopping services (not on status/logs/deploy)
    if [ "${_STARTED_SERVICES:-}" = "true" ]; then
        vps_be_ssh "rm -f /tmp/oracle-key-{1,2,3}.txt /tmp/settlement-key.txt /tmp/curator-key.txt" 2>/dev/null || true
        vps_chain_ssh "rm -f /tmp/ap-key.txt" 2>/dev/null || true
    fi
}
trap _cleanup EXIT

# Run docker compose on a VPS. Errors are NOT suppressed.
# All arguments are script-controlled (no user input), so simple concatenation is safe.
# IMPORTANT: pass each docker compose arg separately, e.g. vps1_compose dir "up" "-d" "--build"
vps1_compose() {
    local service_dir="$1"; shift
    ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/$service_dir && DOCKER_BUILDKIT=1 docker compose $*" < /dev/null
}
vps2_compose() {
    local service_dir="$1"; shift
    ssh "$VPS_CHAIN_HOST" "cd $VPS_CHAIN_DIR/docker/testnet/$service_dir && DOCKER_BUILDKIT=1 docker compose $*" < /dev/null
}

check_docker_service() {
    local host="$1" dir="$2" service="$3" name="$4"
    local status
    status=$(ssh -o ConnectTimeout=5 "$host" \
        "cd $dir/docker/testnet/$service && docker compose ps --format '{{.Status}}' $name 2>/dev/null" \
        < /dev/null 2>/dev/null)
    if echo "$status" | grep -q "Up"; then
        echo -e "  ${GREEN}$name running ($status)${NC}"
        return 0
    else
        echo -e "  ${YELLOW}$name not running${NC}"
        return 1
    fi
}

_sync_docker_files() {
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/docker/testnet/" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/"
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/.dockerignore" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/.dockerignore"
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/scripts/sonic-rpc-proxy.py" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/scripts/sonic-rpc-proxy.py"
    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" \
        "$SCRIPT_DIR/docker/testnet/ap/" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/docker/testnet/ap/"
    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" \
        "$SCRIPT_DIR/.dockerignore" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/.dockerignore"
}

_sync_config_files() {
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data-node/.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data-node/.env"
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data/symbol-map.json" 2>/dev/null || true
    # Sync deployment JSONs to both VPSes (truncate first to avoid stale data from longer previous files)
    for f in active-deployment.json morpho-e2e.json vision-batches.json; do
        if [ -f "$SCRIPT_DIR/deployments/$f" ]; then
            vps_be_ssh "truncate -s 0 $VPS_BE_DIR/deployments/$f 2>/dev/null; true"
            ssh "$VPS_BE_HOST" "cat > $VPS_BE_DIR/deployments/$f" < "$SCRIPT_DIR/deployments/$f" 2>/dev/null
        fi
    done
    if [ -f "$SCRIPT_DIR/deployments/active-deployment.json" ]; then
        vps_chain_ssh "truncate -s 0 $VPS_CHAIN_DIR/deployments/active-deployment.json 2>/dev/null; true"
        ssh "$VPS_CHAIN_HOST" "cat > $VPS_CHAIN_DIR/deployments/active-deployment.json" < "$SCRIPT_DIR/deployments/active-deployment.json" 2>/dev/null
    fi
}

# Kill any old bare-metal processes to prevent port conflicts
_kill_old_processes() {
    echo -e "  Cleaning up old bare processes..."
    vps_be_ssh "pkill -9 -x oracle 2>/dev/null; pkill -9 -x data-node 2>/dev/null; pkill -9 -x curator 2>/dev/null; pkill -9 -f '[s]onic-rpc-proxy' 2>/dev/null; true"
    vps_chain_ssh "pkill -9 -x ap 2>/dev/null; true"
    sleep 2
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
for key in ['SettlementBridgeCustody', 'SETTLEMENT_USDC', 'SETTLEMENT_USDC_DECIMALS', 'MockBitgetVault', 'MOCK_USDT']:
    if key in sc:
        l3['contracts'][key] = sc[key]
# BridgedItpFactory: exists on BOTH chains. Keep L3 version for Morpho collateral.
if 'BridgedItpFactory' in sc:
    l3['contracts']['L3BridgedItpFactory'] = l3['contracts'].get('BridgedItpFactory', '')
    l3['contracts']['BridgedItpFactory'] = sc['BridgedItpFactory']
    l3['contracts']['SettlementBridgedItpFactory'] = sc['BridgedItpFactory']
# Add Sonic-specific keys
if 'OracleRegistry' in sc:
    l3['contracts']['SettlementOracleRegistry'] = sc['OracleRegistry']
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

    echo -e "${BLUE}[3b/5] Checking Docker...${NC}"
    if vps_be_ssh "command -v docker >/dev/null 2>&1"; then
        echo -e "  ${GREEN}Docker already installed${NC}"
    else
        echo -e "  ${YELLOW}Docker not installed. Install manually:${NC}"
        echo -e "  ${CYAN}ssh $VPS_BE_HOST${NC}"
        echo -e "  ${CYAN}curl -fsSL https://get.docker.com | sh${NC}"
        echo -e "  ${CYAN}sudo usermod -aG docker max${NC}"
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
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p oracle -p curator 2>&1 | tail -5" | grep -v 'Unauthorized\|monitored'
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
    echo -e "${BLUE}[1/14] Checking L3 RPC...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    if [ "$VPS_CHAIN_ID" != "$CHAIN_ID" ]; then
        echo -e "  ${RED}L3 not reachable (got chain $VPS_CHAIN_ID, expected $CHAIN_ID)${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}L3 OK (chain $VPS_CHAIN_ID)${NC}"

    # Check deployer gas balance
    echo -e "${BLUE}[1b/14] Checking deployer gas balance...${NC}"
    DEPLOYER_BAL_WEI=$(cast balance --rpc-url "$RPC_URL" "$DEPLOYER_ADDRESS" 2>/dev/null || echo "0")
    DEPLOYER_BAL_ETH=$(python3 -c "print(f'{int($DEPLOYER_BAL_WEI) / 1e18:.1f}')" 2>/dev/null || echo "0")
    # Need ~100 GM for ~1800 txs (621 token deploys + 621 mints + 96 ITP creates + 96 vaults + Vision)
    MIN_BAL_WEI="100000000000000000000"  # 100 GM
    if python3 -c "exit(0 if int('$DEPLOYER_BAL_WEI') >= int('$MIN_BAL_WEI') else 1)" 2>/dev/null; then
        echo -e "  ${GREEN}Deployer balance: ${DEPLOYER_BAL_ETH} GM${NC}"
    else
        echo -e "  ${RED}Deployer balance too low: ${DEPLOYER_BAL_ETH} GM (need >= 100 GM for ~1800 txs)${NC}"
        exit 1
    fi

    # Check bls-tool binary (needed for FFI in deploy scripts)
    echo -e "${BLUE}[2/14] Checking bls-tool (FFI)...${NC}"
    if [ ! -f "target/release/bls-tool" ]; then
        echo -e "  ${RED}bls-tool binary not found at target/release/bls-tool${NC}"
        echo -e "  ${YELLOW}Build it manually: cargo build --release -p bls-tool${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}bls-tool ready${NC}"

    # Deploy core system (must run from contracts/ for foundry.toml remappings)
    # Clean forge cache first — stale cache causes 0-receipt broadcasts
    echo -e "${BLUE}[3/14] Deploying core contracts (Index, OracleRegistry, USDC, BridgeProxy)...${NC}"
    rm -rf contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/ contracts/cache/DeployFullSystemE2E.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        > logs/deploy-core.log 2>&1

    # Verify deployment succeeded: check both JSON file exists AND has receipts
    if [ ! -f "deployments/e2e-full-system.json" ]; then
        echo -e "  ${RED}Core deployment failed — no deployment JSON${NC}"
        echo -e "  ${YELLOW}Check: logs/deploy-core.log${NC}"
        exit 1
    fi
    local RECEIPT_COUNT=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('receipts',[])))" 2>/dev/null || echo "0")
    if [ "$RECEIPT_COUNT" = "0" ]; then
        echo -e "  ${RED}Core deployment broadcast failed — 0 receipts (transactions not submitted)${NC}"
        echo -e "  ${YELLOW}This usually means forge cache was corrupted. Cache was cleaned, try again.${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}Core contracts deployed ($RECEIPT_COUNT txs confirmed)${NC}"

    # 3b: Deploy settlement contracts to Sonic
    echo -e "${BLUE}[3b/14] Deploying settlement contracts to Sonic (chain $SETTLEMENT_CHAIN_ID)...${NC}"

    # Save L3 deployment before Sonic overwrites it
    # The forge script writes to e2e-full-system.json (not active-deployment.json)
    cp deployments/e2e-full-system.json deployments/e2e-full-system-l3.json 2>/dev/null || true

    SONIC_CHAIN_ID=$(cast chain-id --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "0")
    if [ "$SONIC_CHAIN_ID" != "$SETTLEMENT_CHAIN_ID" ]; then
        echo -e "  ${YELLOW}Sonic not reachable (got $SONIC_CHAIN_ID, expected $SETTLEMENT_CHAIN_ID) — skipping settlement deploy${NC}"
    else
        rm -rf contracts/broadcast/DeployFullSystemE2E.s.sol/$SETTLEMENT_CHAIN_ID/ contracts/cache/DeployFullSystemE2E.s.sol/$SETTLEMENT_CHAIN_ID/
        (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
            --rpc-url "$SETTLEMENT_RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --broadcast \
            --chain-id $SETTLEMENT_CHAIN_ID \
            --slow) \
            > logs/deploy-sonic.log 2>&1 || echo -e "  ${YELLOW}Sonic forge script had errors — check logs/deploy-sonic.log${NC}"

        if [ -f "deployments/e2e-full-system.json" ]; then
            cp deployments/e2e-full-system.json deployments/e2e-full-system-sonic.json
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

    # Reset Vision DB state (stale batch IDs from previous deployment)
    echo -e "${BLUE}[3c/14] Resetting Vision database state...${NC}"
    if vps_be_ssh "psql -U max -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name='vision_last_resolved'\" 2>/dev/null | grep -q '1 row'"; then
        vps_be_ssh "psql -U max -d $DB_NAME -c 'TRUNCATE vision_last_resolved, vision_reference_prices, signed_batch_configs, batch_configs, batch_settlements, vision_balance_proofs, vision_batches, vision_batch_state, vision_bitmaps, vision_deposit_orders, vision_kv_store, vision_positions, vision_tick_results, vision_user_balances, vision_withdraw_orders, itp_snapshots, trades, user_shares, oracle_health_snapshots CASCADE;'" \
            && echo -e "  ${GREEN}Vision tables truncated${NC}" \
            || echo -e "  ${YELLOW}Vision table truncate failed — tables may not exist yet${NC}"
    else
        echo -e "  ${YELLOW}Vision tables don't exist yet — skip (data-node will create on first start)${NC}"
    fi

    # Run oracle DB migrations (schema may have changed between deploys)
    echo -e "  Running oracle DB migrations..."
    for migration in oracle/migrations/*.sql; do
        vps_be_ssh "psql -U max -d $DB_NAME -f $VPS_BE_DIR/$migration" > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Oracle migrations applied${NC}"

    # Delete stale consensus WAL files (prevents old P2P state from poisoning fresh deploy)
    vps_be_ssh "rm -f $VPS_BE_DIR/logs/consensus-*.wal" && echo -e "  ${GREEN}Consensus WAL files cleaned${NC}" || true

    # Fund Anvil accounts 1-4 (oracles + AP) with GM for gas
    echo -e "${BLUE}[4/14] Funding oracle + AP accounts with gas...${NC}"
    ORACLE_1_ADDR=$(cast wallet address "$ORACLE_1_KEY")
    ORACLE_2_ADDR=$(cast wallet address "$ORACLE_2_KEY")
    ORACLE_3_ADDR=$(cast wallet address "$ORACLE_3_KEY")
    AP_ADDR=$(cast wallet address "$AP_KEY")

    for addr in "$ORACLE_1_ADDR" "$ORACLE_2_ADDR" "$ORACLE_3_ADDR" "$AP_ADDR"; do
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$addr" --value 10ether > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Funded 4 accounts with 10 GM each${NC}"

    # Fund accounts with gas on Sonic
    echo -e "${BLUE}[4b/14] Funding accounts with gas on Sonic...${NC}"
    for addr in "$ORACLE_1_ADDR" "$ORACLE_2_ADDR" "$ORACLE_3_ADDR" "$AP_ADDR"; do
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$addr" --value 0.5ether > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Funded 4 accounts with 0.5 S each on Sonic${NC}"

    # Fund swarm bot wallets with gas (if addresses.json exists)
    if [ -f "docker/testnet/vision-swarm/addresses.json" ]; then
        echo -e "  Funding swarm bot wallets with gas..."
        while IFS= read -r addr; do
            addr=$(echo "$addr" | tr -d '", ')
            [[ -z "$addr" || "$addr" == "[" || "$addr" == "]" ]] && continue
            [[ "$addr" =~ ^0x[0-9a-fA-F]{40}$ ]] || continue
            cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                "$addr" --value 1ether > /dev/null 2>&1 || true
        done < "docker/testnet/vision-swarm/addresses.json"
        echo -e "  ${GREEN}Funded swarm bot wallets with 1 GM each${NC}"
    fi

    # Verify funded accounts have non-zero balances
    echo -e "  Verifying funded balances..."
    local FUND_OK=true
    for addr in "$ORACLE_1_ADDR" "$ORACLE_2_ADDR" "$ORACLE_3_ADDR" "$AP_ADDR"; do
        local BAL=$(cast balance --rpc-url "$RPC_URL" "$addr" 2>/dev/null || echo "0")
        if [ "$BAL" = "0" ]; then
            echo -e "  ${RED}WARNING: $addr has 0 balance after funding${NC}"
            FUND_OK=false
        fi
    done
    [ "$FUND_OK" = true ] && echo -e "  ${GREEN}All accounts funded${NC}" || echo -e "  ${YELLOW}Some funding may have failed — check above${NC}"

    # Deploy Morpho (no timelock wait)
    echo -e "${BLUE}[5/14] Deploying Morpho (forked, no timelock)...${NC}"
    L3_USDC=$(read_deployment_addr "L3_WUSDC")
    # Use L3BridgedItpFactory (L3-chain), NOT BridgedItpFactory (Settlement-chain after merge)
    ITP_VAULT=$(read_deployment_addr "L3BridgedItpFactory")
    if [ -z "$ITP_VAULT" ]; then
        # Fallback: read from L3-only deployment JSON (before merge)
        ITP_VAULT=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system-l3.json'))['contracts']['BridgedItpFactory'])" 2>/dev/null)
    fi
    ORACLE_REGISTRY=$(read_deployment_addr "OracleRegistry")

    rm -rf contracts/broadcast/DeployMorphoE2E.s.sol/$CHAIN_ID/ contracts/cache/DeployMorphoE2E.s.sol/$CHAIN_ID/
    (cd contracts && DEPLOYER_KEY="$DEPLOYER_KEY" \
    SETTLEMENT_USDC="$L3_USDC" ITP_VAULT="$ITP_VAULT" ORACLE_REGISTRY="$ORACLE_REGISTRY" \
    forge script script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        >> logs/deploy-morpho.log 2>&1 || echo -e "  ${YELLOW}Morpho deploy had warnings — check logs/deploy-morpho.log${NC}"
    echo -e "  ${GREEN}Morpho deployed${NC}"

    # Deploy Vision
    echo -e "${BLUE}[6/14] Deploying Vision + batches...${NC}"
    rm -rf contracts/broadcast/DeployVision.s.sol/$CHAIN_ID/ contracts/cache/DeployVision.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    ORACLE_REGISTRY="$ORACLE_REGISTRY" USDC_ADDRESS="$L3_USDC" \
    forge script script/DeployVision.s.sol:DeployVision \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        >> logs/deploy-vision.log 2>&1 || echo -e "  ${YELLOW}Vision deploy had warnings${NC}"

    # Vision batches: do NOT use --slow (causes nonce races on L3 Orbit)
    rm -rf contracts/broadcast/DeployAllVisionBatches.s.sol/$CHAIN_ID/ contracts/cache/DeployAllVisionBatches.s.sol/$CHAIN_ID/
    # Read Vision address: try active-deployment first (most reliable), then vision-deployment.json fallback
    VISION_ADDR_DEPLOY=$(read_deployment_addr "Vision" 2>/dev/null || python3 -c "import json; print(json.load(open('deployments/vision-deployment.json'))['vision'])" 2>/dev/null || echo "")
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    VISION_ADDRESS="$VISION_ADDR_DEPLOY" \
    forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID) \
        >> logs/deploy-vision-batches.log 2>&1 || echo -e "  ${YELLOW}Vision batches had warnings${NC}"
    echo -e "  ${GREEN}Vision deployed${NC}"

    # Add Vision address to active-deployment.json (Vision is deployed separately)
    # Read from vision-deployment.json (always written by DeployVision), NOT vision-batches.json (may fail)
    VISION_ADDR_MERGE=$(python3 -c "import json; print(json.load(open('deployments/vision-deployment.json'))['contracts']['Vision'])" 2>/dev/null || echo "")
    if [ -n "$VISION_ADDR_MERGE" ]; then
        python3 -c "
import json
d = json.load(open('$DEPLOYMENT_FILE'))
d['contracts']['Vision'] = '$VISION_ADDR_MERGE'
json.dump(d, open('$DEPLOYMENT_FILE', 'w'), indent=2)
"
        echo -e "  ${GREEN}Added Vision to active-deployment.json${NC}"
    fi

    # Fund test accounts with L3 USDC
    echo -e "${BLUE}[7/14] Funding accounts with L3 USDC...${NC}"
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

    # Phase: Deploy all Bitget tokens
    echo -e "${BLUE}[8/14] Generating token deploy script...${NC}"
    python3 scripts/deploy-all-tokens.py || { echo -e "${RED}Token generator failed${NC}"; exit 1; }
    echo -e "  ${GREEN}Generated DeployAllTokens.s.sol (621 tokens)${NC}"

    echo -e "${BLUE}[9/14] Deploying all 621 tokens + funding vault...${NC}"
    MOCK_VAULT=$(read_deployment_addr "MockBitgetVault")
    rm -rf contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/ contracts/cache/DeployAllTokens.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        MOCK_BITGET_VAULT="$MOCK_VAULT" \
        forge script script/DeployAllTokens.s.sol:DeployAllTokens \
        --broadcast --slow --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --chain-id $CHAIN_ID) \
        > logs/deploy-tokens.log 2>&1 || { echo -e "  ${RED}Token deploy FAILED — check logs/deploy-tokens.log${NC}"; exit 1; }
    echo -e "  ${GREEN}621 tokens deployed, vault funded${NC}"

    # Update assets.json with fresh on-chain addresses
    echo -e "${BLUE}[9b/14] Syncing fresh token addresses to assets.json...${NC}"
    python3 scripts/sync-token-addresses.py || echo -e "  ${YELLOW}Address sync had warnings${NC}"
    echo -e "  ${GREEN}Token addresses synced${NC}"

    # Phase: Create ITPs
    echo -e "${BLUE}[10/14] Generating ITP deploy scripts...${NC}"
    python3 scripts/deploy-107-itps.py || { echo -e "${RED}ITP generator failed${NC}"; exit 1; }
    echo -e "  ${GREEN}Generated ITP create + vault scripts${NC}"

    echo -e "${BLUE}[11/14] Creating ITPs...${NC}"
    INDEX_ADDR_ITP=$(read_deployment_addr "Index")
    rm -rf contracts/broadcast/Deploy107ITPs_Create.s.sol/$CHAIN_ID/ contracts/cache/Deploy107ITPs_Create.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        INDEX_ADDRESS="$INDEX_ADDR_ITP" \
        forge script script/Deploy107ITPs_Create.s.sol:Deploy107ITPs_Create \
        --broadcast --slow --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --chain-id $CHAIN_ID) \
        > logs/deploy-itp-create.log 2>&1 || { echo -e "  ${RED}ITP create FAILED — check logs/deploy-itp-create.log${NC}"; exit 1; }
    echo -e "  ${GREEN}ITPs created${NC}"

    echo -e "${BLUE}[12/14] Deploying ITP vaults...${NC}"
    L3_USDC=$(read_deployment_addr "L3_WUSDC")
    rm -rf contracts/broadcast/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/ contracts/cache/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        ADMIN_KEY="$DEPLOYER_KEY" \
        INDEX_ADDRESS="$INDEX_ADDR_ITP" \
        L3_WUSDC="$L3_USDC" \
        forge script script/Deploy107ITPs_Vaults.s.sol:Deploy107ITPs_Vaults \
        --broadcast --slow --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --chain-id $CHAIN_ID) \
        > logs/deploy-itp-vaults.log 2>&1 || { echo -e "  ${RED}ITP vault deploy FAILED — check logs/deploy-itp-vaults.log${NC}"; exit 1; }
    echo -e "  ${GREEN}ITP vaults deployed${NC}"

    # Sync deployment files + token registries
    echo -e "${BLUE}[13/14] Syncing deployment files + token registries...${NC}"

    # Patch any stale addresses from broadcast (catches partial deploys, manual reruns)
    ./sync-deployment.sh testnet $CHAIN_ID 2>/dev/null || true
    # Now copy the (potentially patched) env deployment back to active
    if [ -d "envs/testnet" ]; then
        cp envs/testnet/deployment.json "$DEPLOYMENT_FILE" 2>/dev/null || true
        [ -f "$DEPLOYMENT_FILE" ] && cp "$DEPLOYMENT_FILE" envs/testnet/deployment.json
        [ -f "deployments/morpho-e2e.json" ] && cp deployments/morpho-e2e.json envs/testnet/morpho-deployment.json
        [ -f "deployments/vision-batches.json" ] && cp deployments/vision-batches.json envs/testnet/vision-batches.json
        # Update Vision address in envs/testnet/.env
        VISION_ADDR=$(python3 -c "import json; print(json.load(open('deployments/vision-batches.json'))['vision'])" 2>/dev/null || echo "")
        if [ -n "$VISION_ADDR" ] && [ -f "envs/testnet/.env" ]; then
            sed -i '' "s|^NEXT_PUBLIC_VISION_ADDRESS=.*|NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}|" envs/testnet/.env
        fi
        echo -e "  ${GREEN}Synced deployment JSONs + Vision address → envs/testnet/${NC}"
    fi

    # Regenerate deployed-assets.json and symbol-map.json from assets.json.
    # Must happen BEFORE switch-env so oracles/data-node get fresh symbol maps.
    python3 -c "
import json, re
assets = json.load(open('assets.json'))
deployed = json.load(open('frontend/public/deployed-assets.json'))
existing = {a['symbol'] for a in deployed}
for a in assets:
    sym = re.sub(r'(USDT|USDC)\$', '', a['bitget'])
    if sym and sym not in existing:
        deployed.append({'address': a['address'], 'symbol': sym})
        existing.add(sym)
json.dump(deployed, open('frontend/public/deployed-assets.json', 'w'), indent=2)
smap = {}
for a in assets:
    smap[a['address'].lower()] = {'pair': a['bitget'], 'source': 'bitget'}
json.dump(smap, open('data/symbol-map.json', 'w'), indent=2)
print(f'{len(deployed)} tokens in deployed-assets.json, {len(smap)} in symbol-map.json')
" 2>/dev/null && echo -e "  ${GREEN}Token registries synced${NC}" || echo -e "  ${YELLOW}Token registry sync failed${NC}"

    # Switch local env to testnet (copies deployment JSONs to frontend/lib/contracts/)
    ./switch-env.sh testnet 2>/dev/null || true

    # Deploy frontend to Vercel with new contract addresses
    echo -e "${BLUE}[14/14] Deploying frontend to Vercel...${NC}"
    if command -v vercel &>/dev/null; then
        (cd frontend && vercel --prod --yes 2>&1 | tail -5) && \
            echo -e "  ${GREEN}Frontend deployed to Vercel${NC}" || \
            echo -e "  ${YELLOW}Vercel deploy failed — deploy manually: cd frontend && vercel --prod${NC}"
    else
        echo -e "  ${YELLOW}vercel CLI not found — deploy manually: cd frontend && vercel --prod${NC}"
    fi

    echo ""
    echo -e "${GREEN}All contracts deployed. Next steps:${NC}"
    echo -e "  ${CYAN}1. Start services: ./testnet.sh start${NC}"
    echo -e "  ${CYAN}2. (Optional) Push: git add deployments/ envs/testnet/ && git commit -m 'chore: testnet deployment' && git push mono main${NC}"
}

# ── start: Start all services on VPSes ───────────────────────
cmd_start() {
    _STARTED_SERVICES=true
    echo -e "${CYAN}Starting all services on VPSes...${NC}"

    # Check L3
    echo -e "${BLUE}[1/8] Checking L3 chain...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ] || { echo -e "  ${RED}L3 not reachable${NC}"; exit 1; }
    echo -e "  ${GREEN}L3 OK${NC}"

    # Kill old bare processes (prevents port conflicts on migration)
    _kill_old_processes

    # Pull latest code and rebuild binaries on VPS (ensures rename/schema changes are picked up)
    echo -e "${BLUE}[2/8] Syncing files + rebuilding binaries...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && git pull origin main 2>&1 | tail -3" || true
    # Rebuild all Rust binaries if source changed since last build
    local NEED_REBUILD=false
    for bin in oracle data-node curator itp-bot; do
        if vps_be_ssh "test -f $VPS_BE_DIR/target/release/$bin" 2>/dev/null; then
            if vps_be_ssh "find $VPS_BE_DIR/oracle/src $VPS_BE_DIR/common/src $VPS_BE_DIR/data-node/src $VPS_BE_DIR/curator/src -newer $VPS_BE_DIR/target/release/$bin -name '*.rs' 2>/dev/null | head -1 | grep -q ." 2>/dev/null; then
                NEED_REBUILD=true
                break
            fi
        else
            NEED_REBUILD=true
            break
        fi
    done
    if [ "$NEED_REBUILD" = true ]; then
        echo -e "  Rebuilding binaries on VPS (source changed)..."
        vps_be_ssh "source ~/.cargo/env && cd $VPS_BE_DIR && cargo build --release -p oracle -p data-node -p curator -p itp-bot 2>&1 | tail -3" \
            && echo -e "  ${GREEN}Binaries rebuilt${NC}" \
            || echo -e "  ${YELLOW}Binary rebuild failed — using existing binaries${NC}"
    else
        echo -e "  ${GREEN}Binaries up to date${NC}"
    fi
    _sync_docker_files
    _sync_config_files

    # Ensure logs dir + existing files are writable by container UID (app=999 != max=1002)
    vps_be_ssh "mkdir -p $VPS_BE_DIR/logs && chmod 777 $VPS_BE_DIR/logs && chmod a+rw $VPS_BE_DIR/logs/* 2>/dev/null; true"

    # Write key files on VPS 1 (mounted into containers, never in env_file/environment)
    # First remove any Docker-created directory stubs (Docker creates dirs for missing mount sources)
    vps_be_ssh "docker run --rm -v /tmp:/tmp alpine sh -c 'rm -rf /tmp/oracle-key-1.txt /tmp/oracle-key-2.txt /tmp/oracle-key-3.txt /tmp/settlement-key.txt /tmp/curator-key.txt' 2>/dev/null; true"
    for i in 1 2 3; do
        vps_be_ssh "printf '%s' '${ORACLE_KEYS[$((i-1))]}' > /tmp/oracle-key-$i.txt && chmod 644 /tmp/oracle-key-$i.txt"
    done
    # Settlement key shared by all oracles (same deployer key)
    vps_be_ssh "printf '%s' '$DEPLOYER_KEY' > /tmp/settlement-key.txt && chmod 644 /tmp/settlement-key.txt"
    echo -e "  ${GREEN}Files synced${NC}"

    # Start sonic-proxy
    echo -e "${BLUE}[3/8] Starting sonic-proxy...${NC}"
    if ! vps1_compose sonic-proxy up -d --build; then
        echo -e "  ${RED}sonic-proxy failed to start${NC}"; exit 1
    fi
    sleep 2
    echo -e "  ${GREEN}sonic-proxy started${NC}"

    # Start data-node
    echo -e "${BLUE}[4/8] Starting data-node...${NC}"
    _start_data_node_docker
    echo -e "  ${GREEN}data-node started${NC}"

    # Reset vision chain listener bookmark if vision_batches is empty (fresh deploy).
    # Without this, the chain listener resumes past the deploy block and never sees
    # BatchConfigPromoted events, so vision ticks never resolve.
    if vps_be_ssh "psql -U max -d $DB_NAME -tAc \"SELECT COUNT(*) FROM vision_batches\" 2>/dev/null" | grep -q '^0$'; then
        vps_be_ssh "psql -U max -d $DB_NAME -c \"DELETE FROM vision_kv_store WHERE key = 'chain_listener_last_block'\" 2>/dev/null" && \
            echo -e "  ${GREEN}Vision chain listener bookmark reset (fresh deploy detected)${NC}" || true
    fi

    # Start oracles (staggered)
    echo -e "${BLUE}[5/8] Starting oracles...${NC}"
    _start_oracles_docker
    echo -e "  ${GREEN}oracles started${NC}"

    # Start curator
    _start_curator_docker

    # Start AP on VPS 2
    echo -e "${BLUE}[6/8] Starting AP on VPS 2...${NC}"
    _start_ap_docker

    # Start itp-bot
    echo -e "${BLUE}[7/8] Starting itp-bot...${NC}"
    _start_itp_bot_docker

    # Start vision swarm (optional — requires swarm.env)
    echo -e "${BLUE}[8/8] Starting vision swarm...${NC}"
    if [ -f "docker/testnet/vision-swarm/swarm.env" ]; then
        # Stop existing swarm (prevents stale containers during rebuild)
        vps_be_ssh "cd $VPS_BE_DIR/docker/testnet/vision-swarm && docker compose down 2>/dev/null; true"

        # Sync vision-bot source (not under docker/testnet/, needs explicit sync)
        rsync -az --delete \
            --exclude='.venv' --exclude='__pycache__' --exclude='tests' \
            -e "$RSYNC_SSH_BE" \
            "$SCRIPT_DIR/vision-bot/" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/vision-bot/"
        # docker/testnet/vision-swarm/ already synced by _sync_docker_files in step [2/8]
        # Sync deployment files
        rsync -az -e "$RSYNC_SSH_BE" \
            "$SCRIPT_DIR/deployments/active-deployment.json" "$SCRIPT_DIR/deployments/vision-batches.json" \
            "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/"

        # Create pnl-data dir
        vps_be_ssh "mkdir -p $VPS_BE_DIR/docker/testnet/vision-swarm/pnl-data && chmod 777 $VPS_BE_DIR/docker/testnet/vision-swarm/pnl-data"

        # Build
        vps_be_ssh "cd $VPS_BE_DIR && docker compose -f docker/testnet/vision-swarm/docker-compose.yml build" \
            || { echo -e "  ${YELLOW}Swarm build failed — skipping${NC}"; }

        # Fund bot wallets with gas + USDC
        USDC_ADDR=$(read_deployment_addr "L3_WUSDC")
        FUND_AMOUNT="100000000000000000000000"  # 100k USDC, 18 decimals
        FUND_FAILURES=0
        if [ -n "$USDC_ADDR" ] && [ -f "docker/testnet/vision-swarm/addresses.json" ]; then
            while IFS= read -r addr; do
                addr=$(echo "$addr" | tr -d '", ')
                [[ -z "$addr" || "$addr" == "[" || "$addr" == "]" ]] && continue
                [[ "$addr" =~ ^0x[0-9a-fA-F]{40}$ ]] || continue
                # Gas (1 GM)
                cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                    "$addr" --value 1ether > /dev/null 2>&1 || true
                # USDC
                if ! cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                    "$USDC_ADDR" "mint(address,uint256)" "$addr" "$FUND_AMOUNT" \
                    > /dev/null 2>&1; then
                    FUND_FAILURES=$((FUND_FAILURES + 1))
                fi
            done < "docker/testnet/vision-swarm/addresses.json"
            if [ "$FUND_FAILURES" -gt 2 ]; then
                echo -e "  ${YELLOW}WARNING: $FUND_FAILURES bot wallets failed to fund${NC}"
            else
                echo -e "  ${GREEN}Funded swarm wallets with gas + USDC${NC}"
            fi
        fi

        # Start swarm
        vps_be_ssh "cd $VPS_BE_DIR/docker/testnet/vision-swarm && set -a && source swarm.env && set +a && docker compose up -d" \
            && echo -e "  ${GREEN}Vision swarm started (10 bots)${NC}" \
            || echo -e "  ${YELLOW}Vision swarm failed to start${NC}"
    else
        echo -e "  ${YELLOW}Swarm skipped — docker/testnet/vision-swarm/swarm.env not found${NC}"
    fi

    echo ""
    echo -e "${GREEN}All services started. Check status: ./testnet.sh status${NC}"
}

_start_data_node_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"

    local INDEX_ADDR INDEX_FLAG DN_CMD
    INDEX_ADDR=$(read_deployment_addr "Index")
    INDEX_FLAG=""
    [ -n "$INDEX_ADDR" ] && INDEX_FLAG="--index-address $INDEX_ADDR"

    # Generate override with full command
    local OVERRIDE="$SCRIPT_DIR/.data-node-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  data-node:
    command:
      - "serve"
      - "--database-url"
      - "postgres://max@localhost/index_prices"
      - "--symbol-map"
      - "/app/data/symbol-map.json"
      - "--rpc-url"
      - "$RPC_URL"
      - "--settlement-rpc-url"
      - "$SETTLEMENT_RPC_VPS"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--morpho-deployment-file"
      - "/app/deployments/morpho-e2e.json"
      - "--ecb-enabled"
      - "--openmeteo-sync-interval"
      - "300"
$([ -n "$INDEX_FLAG" ] && echo '      - "--index-address"
      - "'"$INDEX_ADDR"'"')
      - "--explorer-token"
      - "$EXPLORER_TOKEN"
      - "--oracle-health-urls"
      - "http://127.0.0.1:10001,http://127.0.0.1:10002,http://127.0.0.1:10003"
      - "--oracle-health-poll-interval"
      - "60"
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if ! vps1_compose data-node up -d --build; then
        echo -e "  ${RED}data-node failed to start${NC}"; exit 1
    fi

    # Clean up override on VPS
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"
    sleep 3
}

_start_oracles_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/oracle/docker-compose.override.yml"

    # Stop existing + clean WAL (safe — no race condition)
    vps1_compose oracle down || true
    vps_be_ssh "cd $VPS_BE_DIR && rm -f logs/consensus-*.wal"

    # Dynamic args
    L3_FROM_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    echo -e "  L3 block: $L3_FROM_BLOCK (oracles start from here)"

    VISION_ADDR=$(python3 -c "import json; print(json.load(open('deployments/vision-batches.json'))['vision'])" 2>/dev/null || echo "")
    BRIDGE_PROXY=$(read_deployment_addr "SettlementBridgeProxy")
    [ -z "$BRIDGE_PROXY" ] && BRIDGE_PROXY=$(read_deployment_addr "BridgeProxy")
    VISION_SETTLEMENT_CUSTODY=$(read_deployment_addr "SettlementBridgeCustody")
    MIRROR_REGISTRY=$(read_deployment_addr "SettlementOracleRegistry")

    # Build per-oracle command as YAML list (safe from injection)
    _oracle_command_yaml() {
        local NODE_ID=$1 PORT=$2 BLS_IDX=$3 PEERS=$4
        cat <<CMD
      - "--node-id"
      - "$NODE_ID"
      - "--port"
      - "$PORT"
      - "--rpc"
      - "$RPC_URL"
      - "--cycle-duration-ms"
      - "1000"
      - "--min-cycle-gap-ms"
      - "50"
      - "--consensus-timeout-ms"
      - "800"
      - "--no-tls"
      - "--test-key-seeds"
      - "--bls-key-seed-index"
      - "$BLS_IDX"
      - "--num-oracles"
      - "3"
      - "--signature-threshold"
      - "2"
      - "--registry-sync"
      - "--data-node-url"
      - "http://localhost:$DATA_NODE_PORT"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--symbol-map-file"
      - "/app/data/symbol-map.json"
      - "--wal-path"
      - "/app/logs/consensus-$NODE_ID.wal"
      - "--log-level"
      - "info"
      - "--from-block"
      - "$L3_FROM_BLOCK"
      - "--sign-timeout-ms"
      - "5000"
      - "--itp-id"
      - "0x0000000000000000000000000000000000000000000000000000000000000001"
CMD
        [ -n "$BRIDGE_PROXY" ] && cat <<CMD
      - "--bridge-proxy"
      - "$BRIDGE_PROXY"
CMD
        if [ -n "$VISION_ADDR" ]; then
            cat <<CMD
      - "--vision-enabled"
      - "--vision-address"
      - "$VISION_ADDR"
      - "--vision-database-url"
      - "postgres://max@localhost/index_prices"
      - "--vision-data-node-url"
      - "http://localhost:$DATA_NODE_PORT"
      - "--vision-rpc-ws-url"
      - "$RPC_URL"
      - "--vision-reveal-window-secs"
      - "60"
      - "--vision-tick-poll-interval-ms"
      - "500"
      - "--vision-settlement-bridge-custody"
      - "$VISION_SETTLEMENT_CUSTODY"
      - "--vision-settlement-rpc-url"
      - "$SETTLEMENT_RPC_VPS"
CMD
        fi
    }

    # No env_file: (env_file values are baked into docker inspect, same as environment:).
    # All secrets via mounted key files. Only non-secret config in environment:.
    local OVERRIDE="$SCRIPT_DIR/.oracle-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  oracle-1:
    environment:
      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-1.txt
      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key.txt
      ORACLE_PEERS: "127.0.0.1:9002,127.0.0.1:9003"
      ORACLE_RPC_URL: "$RPC_URL"
      ORACLE_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ORACLE_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      ORACLE_MIRROR_REGISTRY_ADDRESS: "$MIRROR_REGISTRY"
      EXCHANGE_MODE: "mock"
    command:
$(_oracle_command_yaml 1 9001 0 "127.0.0.1:9002,127.0.0.1:9003")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/oracle-key-1.txt:/tmp/oracle-key-1.txt:ro
      - /tmp/settlement-key.txt:/tmp/settlement-key.txt:ro
      - $VPS_BE_DIR/logs:/app/logs

  oracle-2:
    environment:
      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-2.txt
      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key.txt
      ORACLE_PEERS: "127.0.0.1:9001,127.0.0.1:9003"
      ORACLE_RPC_URL: "$RPC_URL"
      ORACLE_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ORACLE_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      ORACLE_MIRROR_REGISTRY_ADDRESS: "$MIRROR_REGISTRY"
      EXCHANGE_MODE: "mock"
    command:
$(_oracle_command_yaml 2 9002 1 "127.0.0.1:9001,127.0.0.1:9003")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/oracle-key-2.txt:/tmp/oracle-key-2.txt:ro
      - /tmp/settlement-key.txt:/tmp/settlement-key.txt:ro
      - $VPS_BE_DIR/logs:/app/logs

  oracle-3:
    environment:
      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-3.txt
      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key.txt
      ORACLE_PEERS: "127.0.0.1:9001,127.0.0.1:9002"
      ORACLE_RPC_URL: "$RPC_URL"
      ORACLE_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ORACLE_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      ORACLE_MIRROR_REGISTRY_ADDRESS: "$MIRROR_REGISTRY"
      EXCHANGE_MODE: "mock"
    command:
$(_oracle_command_yaml 3 9003 2 "127.0.0.1:9001,127.0.0.1:9002")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/oracle-key-3.txt:/tmp/oracle-key-3.txt:ro
      - /tmp/settlement-key.txt:/tmp/settlement-key.txt:ro
      - $VPS_BE_DIR/logs:/app/logs
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/oracle/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    # Build image once
    vps1_compose oracle build

    # Start oracles sequentially with 5s stagger (P2P needs peers listening)
    for i in 1 2 3; do
        echo -e "  Oracle $i starting on port $((9000 + i))..."
        if ! vps1_compose oracle up -d oracle-$i; then
            echo -e "  ${RED}oracle-$i failed to start${NC}"
        fi
        [ $i -lt 3 ] && sleep 5
    done

    # Clean up override on VPS
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/oracle/docker-compose.override.yml"

    # Verify all 3 oracles are running (BLS threshold is 2/3 — all must be up)
    sleep 3
    local all_ok=true
    for i in 1 2 3; do
        if ! check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "oracle" "oracle-$i"; then
            echo -e "  ${RED}FATAL: oracle-$i not running after start${NC}"
            all_ok=false
        fi
    done
    if [ "$all_ok" = false ]; then
        echo -e "  ${RED}Not all oracles started — consensus impossible. Stopping all.${NC}"
        cmd_stop
        exit 1
    fi
}

_start_curator_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/curator/docker-compose.override.yml"

    MORPHO_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MORPHO'])" 2>/dev/null || echo "")
    VAULT_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['METAMORPHO_VAULT'])" 2>/dev/null || echo "")
    MARKET_ID=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MARKET_ID'])" 2>/dev/null || echo "")
    ORACLE_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['ITP_NAV_ORACLE'])" 2>/dev/null || echo "")
    CURATOR_IRM_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['ADAPTIVE_IRM'])" 2>/dev/null || echo "")
    MIRROR_REG_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MIRROR_REGISTRY'])" 2>/dev/null || echo "")
    LOAN_TOKEN_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['marketParams']['loanToken'])" 2>/dev/null || echo "")
    ITP_ADDR=$(read_deployment_addr "BridgedITP")
    INDEX_ADDR=$(read_deployment_addr "Index")
    REGISTRY_ADDR=$(read_deployment_addr "OracleRegistry")

    # Copy ITPNAVOracle bytecode for auto market deployment
    local ORACLE_BC="contracts/out/ITPNAVOracle.sol/ITPNAVOracle.json"
    if [ -f "$ORACLE_BC" ]; then
        rsync -az -e "$RSYNC_SSH_BE" "$ORACLE_BC" \
            "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/oracle-bytecode.json"
    fi

    if [ -z "$MORPHO_ADDR" ] || [ -z "$VAULT_ADDR" ]; then
        echo -e "  ${YELLOW}Curator skipped — no Morpho deployment${NC}"
        return
    fi

    ORACLE_URLS="http://127.0.0.1:10001,http://127.0.0.1:10002,http://127.0.0.1:10003"

    # Write curator key file on VPS (same pattern as oracle keys — NOT in CLI args or environment)
    vps_be_ssh "printf '%s' '${DEPLOYER_KEY#0x}' > /tmp/curator-key.txt && chmod 644 /tmp/curator-key.txt"

    # Use YAML list format (safe from injection)
    # Private key via mounted file (not CLI arg — would be visible in docker inspect/proc)
    local OVERRIDE="$SCRIPT_DIR/.curator-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  curator:
    volumes:
      - /tmp/curator-key.txt:/tmp/curator-key.txt:ro
      - $VPS_BE_DIR/oracle-bytecode.json:/app/oracle-bytecode.json:ro
    command:
      - "--unified-mode"
      - "--rpc-url"
      - "$RPC_URL"
      - "--private-key-file"
      - "/tmp/curator-key.txt"
      - "--morpho-address"
      - "$MORPHO_ADDR"
      - "--vault-address"
      - "$VAULT_ADDR"
      - "--market-ids"
      - "$MARKET_ID"
      - "--oracle-address"
      - "$ORACLE_ADDR"
      - "--itp-address"
      - "$ITP_ADDR"
      - "--oracle-urls"
      - "$ORACLE_URLS"
      - "--l3-rpc-url"
      - "$RPC_URL"
      - "--mirror-registry-address"
      - "$REGISTRY_ADDR"
      - "--l3-registry-address"
      - "$REGISTRY_ADDR"
      - "--oracle-addresses"
      - "$ORACLE_ADDR"
      - "--itp-addresses"
      - "$ITP_ADDR"
      - "--allocation-interval-secs"
      - "60"
      - "--update-interval-secs"
      - "300"
      - "--health-scan-interval-secs"
      - "300"
      - "--data-node-url"
      - "http://localhost:$DATA_NODE_PORT"
      - "--index-address"
      - "$INDEX_ADDR"
      - "--curator-irm-address"
      - "$CURATOR_IRM_ADDR"
      - "--loan-token-address"
      - "$LOAN_TOKEN_ADDR"
      - "--oracle-bytecode-path"
      - "/app/oracle-bytecode.json"
      - "--market-deploy-interval-secs"
      - "300"
      - "--log-level"
      - "info"
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/curator/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if vps1_compose curator up -d --build; then
        echo -e "  ${GREEN}Curator started${NC}"
    else
        echo -e "  ${RED}Curator failed — check: ./testnet.sh logs curator${NC}"
    fi

    # Clean up override (no secrets in it now, but clean up anyway)
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/curator/docker-compose.override.yml"
}

_start_ap_docker() {
    # Clean up any stale override from previous failed run
    vps_chain_ssh "rm -f $VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"

    INDEX_ADDR=$(read_deployment_addr "Index")
    MOCK_VAULT=$(read_deployment_addr "MockBitgetVault")

    # Write AP key file on VPS 2 (NOT in environment: or CLI — visible in docker inspect)
    # First remove any Docker-created directory stub
    vps_chain_ssh "docker run --rm -v /tmp:/tmp alpine sh -c 'rm -rf /tmp/ap-key.txt' 2>/dev/null; true"
    vps_chain_ssh "printf '%s' '$AP_KEY' > /tmp/ap-key.txt && chmod 644 /tmp/ap-key.txt"

    local OVERRIDE="$SCRIPT_DIR/.ap-override.yml"
    # AP reads key from file via AP_PRIVATE_KEY_PATH (Task 0 prerequisite).
    # Path is not secret — only the file content is. docker inspect shows the path, not the key.
    cat > "$OVERRIDE" <<YEOF
services:
  ap:
    environment:
      AP_PRIVATE_KEY_PATH: /tmp/ap-key.txt
    volumes:
      - /tmp/ap-key.txt:/tmp/ap-key.txt:ro
    command:
      - "--port"
      - "9100"
      - "--rpc"
      - "http://localhost/"
      - "--exchange-mode"
      - "mock"
      - "--settlement-rpc"
      - "$SETTLEMENT_RPC_URL"
      - "--settlement-chain-id"
      - "$SETTLEMENT_CHAIN_ID"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--data-node-url"
      - "http://$VPS_BE_IP:$DATA_NODE_PORT"
      - "--log-level"
      - "info"
$([ -n "$INDEX_ADDR" ] && echo '      - "--index-contract"
      - "'"$INDEX_ADDR"'"')
$([ -n "$MOCK_VAULT" ] && echo '      - "--bitget-vault"
      - "'"$MOCK_VAULT"'"')
YEOF

    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" "$OVERRIDE" \
        "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if vps2_compose ap up -d --build; then
        echo -e "  ${GREEN}AP started${NC}"
    else
        echo -e "  ${RED}AP failed — check: ./testnet.sh logs ap${NC}"
    fi

    # Clean up override (no secrets in it now)
    vps_chain_ssh "rm -f $VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"
}

_start_itp_bot_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/itp-bot/docker-compose.override.yml"

    local INDEX_ADDR_BOT
    INDEX_ADDR_BOT=$(read_deployment_addr "Index")

    # Write bot key file on VPS 1
    vps_be_ssh "docker run --rm -v /tmp:/tmp alpine sh -c 'rm -rf /tmp/bot-key.txt' 2>/dev/null; true"
    vps_be_ssh "printf '%s' '$DEPLOYER_KEY' > /tmp/bot-key.txt && chmod 644 /tmp/bot-key.txt"

    local OVERRIDE="$SCRIPT_DIR/.itp-bot-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  itp-bot:
    environment:
      - DATA_NODE_URL=http://localhost:$DATA_NODE_PORT
      - DATA_NODE_AUTH_TOKEN=$EXPLORER_TOKEN
      - L3_RPC_URL=$RPC_URL
      - INDEX_ADDRESS=$INDEX_ADDR_BOT
      - BOT_KEY_FILE=/tmp/bot-key.txt
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/itp-bot/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if vps1_compose itp-bot up -d --build; then
        echo -e "  ${GREEN}itp-bot started${NC}"
    else
        echo -e "  ${YELLOW}itp-bot failed to start — check: ./testnet.sh logs itp-bot${NC}"
    fi

    # Clean up override
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/itp-bot/docker-compose.override.yml"
}

# ── stop: Stop all VPS services ──────────────────────────────
cmd_stop() {
    _STARTED_SERVICES=true
    echo -e "${CYAN}Stopping all services...${NC}"

    echo -e "${BLUE}VPS 1...${NC}"
    for svc in vision-swarm itp-bot curator oracle data-node sonic-proxy; do
        ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/$svc && docker compose down 2>/dev/null; true" < /dev/null 2>/dev/null
    done
    # Clean up key files and stale overrides on VPS 1
    vps_be_ssh "rm -f /tmp/oracle-key-{1,2,3}.txt /tmp/settlement-key.txt /tmp/curator-key.txt /tmp/bot-key.txt"
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/*/docker-compose.override.yml"
    echo -e "  ${GREEN}VPS 1 stopped + keys cleaned${NC}"

    echo -e "${BLUE}VPS 2...${NC}"
    ssh "$VPS_CHAIN_HOST" "cd $VPS_CHAIN_DIR/docker/testnet/ap && docker compose down 2>/dev/null; true" < /dev/null 2>/dev/null
    # Clean up key files on VPS 2
    vps_chain_ssh "rm -f /tmp/ap-key.txt"
    vps_chain_ssh "rm -f $VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"
    echo -e "  ${GREEN}VPS 2 stopped + keys cleaned${NC}"

    echo -e "${GREEN}All services stopped${NC}"
}

# ── status: Check what's running ─────────────────────────────
cmd_status() {
    echo -e "${CYAN}Service status:${NC}"
    echo ""
    echo -e "${BLUE}VPS 1 ($VPS_BE_IP):${NC}"
    for svc in sonic-proxy data-node; do
        check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "$svc" "$svc" || true
    done
    for i in 1 2 3; do
        check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "oracle" "oracle-$i" || true
    done
    check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "curator" "curator" || true
    check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "itp-bot" "testnet-itp-bot" || true

    echo ""
    echo -e "${BLUE}VPS 2 ($VPS_CHAIN_IP):${NC}"
    check_docker_service "$VPS_CHAIN_HOST" "$VPS_CHAIN_DIR" "ap" "ap" || true

    echo ""
    echo -e "${BLUE}L3 Chain:${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "unreachable")
    if [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ]; then
        BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}L3 OK — chain $VPS_CHAIN_ID, block $BLOCK${NC}"
    else
        echo -e "  ${RED}L3 unreachable${NC}"
    fi

    echo ""
    echo -e "${BLUE}Settlement (Sonic):${NC}"
    SONIC_ID=$(cast chain-id --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "unreachable")
    if [ "$SONIC_ID" = "$SETTLEMENT_CHAIN_ID" ]; then
        SBLOCK=$(cast block-number --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}Sonic OK — chain $SONIC_ID, block $SBLOCK${NC}"
    else
        echo -e "  ${RED}Sonic unreachable${NC}"
    fi

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
    echo -e "${CYAN}Updating both VPSes...${NC}"
    cmd_stop

    echo -e "${BLUE}[1/4] Pulling on VPS 1...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && git pull origin main 2>&1 | tail -5"
    echo -e "${BLUE}[2/4] Pulling on VPS 2...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && git pull origin main 2>&1 | tail -5"

    echo -e "${BLUE}[3/4] Building on VPS 1...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p oracle -p curator 2>&1 | tail -5"
    echo -e "${BLUE}[4/4] Building on VPS 2...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p ap 2>&1 | tail -5"

    _sync_config_files
    cmd_start
}

# ── logs: Tail service logs ──────────────────────────────────
cmd_logs() {
    local service="${1:-all}"
    case $service in
        sonic-proxy)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/sonic-proxy && docker compose logs -f" ;;
        data-node)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/data-node && docker compose logs -f" ;;
        oracle-1|oracle-2|oracle-3)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/oracle && docker compose logs -f $service" ;;
        curator)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/curator && docker compose logs -f" ;;
        ap)
            ssh "$VPS_CHAIN_HOST" "cd $VPS_CHAIN_DIR/docker/testnet/ap && docker compose logs -f" ;;
        itp-bot)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/itp-bot && docker compose logs -f" ;;
        all)
            echo -e "${CYAN}Tailing oracle-1 + data-node...${NC}"
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/oracle && docker compose logs -f oracle-1" &
            PID1=$!
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/data-node && docker compose logs -f" &
            PID2=$!
            trap "kill $PID1 $PID2 2>/dev/null" INT; wait ;;
        *) echo "Available: sonic-proxy, data-node, oracle-1..3, curator, ap, itp-bot, all"; exit 1 ;;
    esac
}

# ── refresh-batches: Redeploy Vision batches with bumped version ──
cmd_refresh_batches() {
    echo -e "${CYAN}Refreshing Vision batches...${NC}"

    # Prerequisites
    for cmd in forge cast python3; do
        command -v $cmd &>/dev/null || { echo -e "${RED}$cmd not found${NC}"; exit 1; }
    done
    [ -f "target/release/bls-tool" ] || { echo -e "${RED}bls-tool not found — run: cargo build --release -p bls-tool${NC}"; exit 1; }

    # Check L3 reachable
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ] || { echo -e "${RED}L3 not reachable${NC}"; exit 1; }

    # Auto-increment BATCH_VERSION (persisted in .batch-version)
    local VERSION_FILE="$SCRIPT_DIR/.batch-version"
    local CURRENT_VERSION=1
    if [ -f "$VERSION_FILE" ]; then
        CURRENT_VERSION=$(cat "$VERSION_FILE")
    fi
    local NEW_VERSION=$((CURRENT_VERSION + 1))
    echo "$NEW_VERSION" > "$VERSION_FILE"
    local BATCH_VERSION="v${NEW_VERSION}"
    echo -e "  ${BLUE}BATCH_VERSION: $BATCH_VERSION (was v$CURRENT_VERSION)${NC}"

    # Refresh BLS registry snapshot to avoid SnapshotTooOld
    echo -e "${BLUE}[1/4] Refreshing BLS registry snapshot...${NC}"
    ORACLE_REGISTRY=$(read_deployment_addr "OracleRegistry")
    if [ -n "$ORACLE_REGISTRY" ]; then
        REG_NONCE=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REGISTRY" "registryNonce()(uint256)" 2>/dev/null || echo "0")
        AGG_PUBKEY=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REGISTRY" "getAggregatedPubkey()(bytes)" 2>/dev/null || echo "")
        if [ -n "$AGG_PUBKEY" ] && [ "$AGG_PUBKEY" != "" ]; then
            cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                "$ORACLE_REGISTRY" "setAggregatedPubkey(bytes,uint256)" "$AGG_PUBKEY" "$REG_NONCE" \
                > /dev/null 2>&1 || echo -e "  ${YELLOW}Snapshot refresh failed (non-fatal)${NC}"
            echo -e "  ${GREEN}Registry snapshot refreshed (nonce $REG_NONCE)${NC}"
        else
            echo -e "  ${YELLOW}No aggregated pubkey found — skipping snapshot refresh${NC}"
        fi
    fi

    # Fetch fresh recommended configs from data-node so deploy uses current hashes.
    # Without this, the deploy script uses stale vision-recommended-configs.json and
    # the on-chain config_hashes won't match what the data-node computes — causing
    # oracles to get 404 when fetching batch configs and ticks never advance.
    echo -e "${BLUE}[2/4] Fetching fresh batch configs from data-node...${NC}"
    local DATA_NODE_URL="${DATA_NODE_URL:-http://116.203.156.98/data-node}"
    if curl -sf "$DATA_NODE_URL/batches/recommended" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
# Transform data-node array format to deploy script's keyed format:
# { configs: { sourceId: { configHash, tickDurationSecs, lockOffsetSecs } } }
configs = {}
for b in d['batches']:
    configs[b['sourceId']] = {
        'configHash': b['configHash'],
        'tickDurationSecs': b['tickDurationSecs'],
        'lockOffsetSecs': b['lockOffsetSecs'],
        'marketCount': len(b.get('markets', []))
    }
json.dump({'configs': configs}, open('deployments/vision-recommended-configs.json', 'w'), indent=2)
print(len(configs))
" 2>/dev/null; then
        local RECO_COUNT=$(python3 -c "import json; print(len(json.load(open('deployments/vision-recommended-configs.json'))['configs']))" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}Fetched $RECO_COUNT recommended configs${NC}"
    else
        echo -e "  ${YELLOW}Could not fetch recommended configs — using existing file${NC}"
    fi

    # Deploy fresh batches
    echo -e "${BLUE}[3/4] Deploying Vision batches (version $BATCH_VERSION)...${NC}"
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" BATCH_VERSION="$BATCH_VERSION" \
    forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id $CHAIN_ID \
        --slow) \
        > logs/deploy-vision-batches.log 2>&1

    if [ $? -ne 0 ]; then
        echo -e "  ${RED}Batch deployment failed — check logs/deploy-vision-batches.log${NC}"
        # Rollback version
        echo "$CURRENT_VERSION" > "$VERSION_FILE"
        exit 1
    fi
    echo -e "  ${GREEN}Batches deployed${NC}"

    # Sync vision-batches.json
    echo -e "${BLUE}[4/4] Syncing deployment files...${NC}"
    if [ -f "deployments/vision-batches.json" ]; then
        [ -d "envs/testnet" ] && cp deployments/vision-batches.json envs/testnet/vision-batches.json
        # Also copy to frontend for E2E
        cp deployments/vision-batches.json frontend/lib/contracts/vision-batches.json 2>/dev/null || true
        BATCH_COUNT=$(python3 -c "import json; print(json.load(open('deployments/vision-batches.json'))['batchCount'])" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}vision-batches.json updated ($BATCH_COUNT batches)${NC}"
    fi

    echo -e "${GREEN}Vision batches refreshed (version $BATCH_VERSION)${NC}"
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
    refresh-batches) cmd_refresh_batches ;;
    sync-deployment) ./sync-deployment.sh testnet $CHAIN_ID ;;
    logs)        cmd_logs "$2" ;;
    help|--help|-h)
        echo "Usage: ./testnet.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  setup-be          First-time VPS 1 setup (PostgreSQL, clone, build)"
        echo "  setup-chain       First-time VPS 2 setup (clone, build AP)"
        echo "  deploy            Deploy contracts from Mac to L3"
        echo "  start             Start all services on VPSes"
        echo "  stop              Stop all services on VPSes"
        echo "  status            Check what's running"
        echo "  update            git pull + rebuild + restart on both VPSes"
        echo "  refresh-batches   Redeploy Vision batches with fresh version"
        echo "  sync-deployment   Patch deployment JSON from latest forge broadcasts"
        echo "  logs [svc]        Tail logs (sonic-proxy, data-node, oracle-1..3, curator, ap, all)"
        echo ""
        echo "Architecture:"
        echo "  VPS 1 ($VPS_BE_IP)    — data-node, 3 oracles, Curator, PostgreSQL"
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
