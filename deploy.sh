#!/bin/bash
# deploy.sh — Deploy data-node to VPS (prod-postgres)
#
# First run:  ./deploy.sh --first-run    (installs Rust, creates DB, builds, starts)
# Update:     ./deploy.sh                (syncs code, rebuilds, restarts)
# Stop:       ./deploy.sh --stop         (stops VPS data-node)
# Status:     ./deploy.sh --status       (check if VPS data-node is running)
#
# Mutual exclusion: if VPS data-node is running, local won't start (and vice versa).
# This prevents double API key usage which triggers rate limits.

set -e

# ── Config ────────────────────────────────────────────────────
VPS_HOST="index-maker/prod/postgres"       # SSH alias (for ssh commands)
VPS_IP="142.132.164.24"
VPS_USER="max"
VPS_DIR="/home/max/index"
DB_NAME="index_prices"
DATA_NODE_PORT=8200
# rsync needs explicit SSH command because macOS rsync doesn't handle SSH aliases with /
RSYNC_SSH="ssh -o ProxyJump=bastion -p 3189"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Helpers ───────────────────────────────────────────────────

vps_data_node_running() {
    # Use pgrep -x with the exact binary name to avoid self-matching
    # ConnectTimeout prevents hanging on SSH multiplexing issues
    ssh -o ConnectTimeout=5 "$VPS_HOST" "pgrep -x data-node > /dev/null 2>&1" 2>/dev/null
    return $?
}

local_data_node_running() {
    pgrep -f 'data-node serve' > /dev/null 2>&1
    return $?
}

check_lock() {
    # Returns "vps", "local", or "none"
    if vps_data_node_running; then
        echo "vps"
    elif local_data_node_running; then
        echo "local"
    else
        echo "none"
    fi
}

# ── Parse Args ────────────────────────────────────────────────
FIRST_RUN=false
STOP=false
STATUS=false

for arg in "$@"; do
    case $arg in
        --first-run) FIRST_RUN=true ;;
        --stop)      STOP=true ;;
        --status)    STATUS=true ;;
        --help)
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --first-run   First-time setup (install Rust, create DB, build)"
            echo "  --stop        Stop VPS data-node"
            echo "  --status      Check if data-node is running (local or VPS)"
            echo "  --help        Show this help"
            exit 0
            ;;
        *) echo "Unknown option: $arg"; exit 1 ;;
    esac
done

# ── Status ────────────────────────────────────────────────────
if [ "$STATUS" = true ]; then
    echo -e "${CYAN}Data-node status:${NC}"
    if local_data_node_running; then
        LOCAL_PID=$(pgrep -f 'data-node serve' | head -1)
        echo -e "  ${GREEN}LOCAL running (PID: $LOCAL_PID)${NC}"
    else
        echo -e "  ${YELLOW}LOCAL not running${NC}"
    fi
    if vps_data_node_running; then
        VPS_PID=$(ssh "$VPS_HOST" "pgrep -f 'data-node serve' | head -1" 2>/dev/null)
        echo -e "  ${GREEN}VPS running (PID: $VPS_PID)${NC}"
    else
        echo -e "  ${YELLOW}VPS not running${NC}"
    fi
    exit 0
fi

# ── Stop ──────────────────────────────────────────────────────
if [ "$STOP" = true ]; then
    echo -e "${BLUE}Stopping VPS data-node...${NC}"
    ssh "$VPS_HOST" "pkill -x data-node 2>/dev/null || true" 2>/dev/null
    sleep 1
    if vps_data_node_running; then
        echo -e "  ${RED}Failed to stop — force killing${NC}"
        ssh "$VPS_HOST" "pkill -9 -x data-node 2>/dev/null || true" 2>/dev/null
    fi
    echo -e "  ${GREEN}VPS data-node stopped${NC}"
    exit 0
fi

# ── Mutual exclusion check ────────────────────────────────────
LOCK=$(check_lock)
if [ "$LOCK" = "local" ]; then
    echo -e "${RED}ERROR: Local data-node is running.${NC}"
    echo -e "${YELLOW}Stop local first: pkill -x data-node${NC}"
    echo -e "${YELLOW}Or use: ./deploy.sh --stop (for VPS)${NC}"
    exit 1
fi

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         DATA-NODE VPS DEPLOYMENT                            ║"
echo "║  Target: $VPS_HOST                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── First-run: Install Rust + create DB ───────────────────────
if [ "$FIRST_RUN" = true ]; then
    echo -e "${BLUE}[1/5] First-run setup: Installing Rust on VPS...${NC}"
    ssh "$VPS_HOST" 'command -v cargo >/dev/null 2>&1 && echo "RUST_INSTALLED" || (curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source ~/.cargo/env && rustc --version)' 2>/dev/null | grep -v 'Unauthorized\|monitored'
    echo -e "  ${GREEN}Rust ready${NC}"

    echo -e "${BLUE}[2/5] First-run setup: Creating PostgreSQL database + role...${NC}"
    # Check if role already exists
    DB_OK=$(ssh "$VPS_HOST" "psql -U max -d postgres -c 'SELECT 1' 2>&1 | grep -c '1 row'" 2>/dev/null || echo "0")
    if [ "$DB_OK" = "1" ]; then
        echo -e "  ${GREEN}PostgreSQL role 'max' already exists${NC}"
        # Ensure DB exists
        ssh "$VPS_HOST" "createdb $DB_NAME 2>/dev/null || true" 2>/dev/null
        echo -e "  ${GREEN}Database ready${NC}"
    else
        echo -e "  ${RED}PostgreSQL role 'max' does not exist.${NC}"
        echo -e "  ${YELLOW}SSH in manually and run these commands:${NC}"
        echo ""
        echo -e "  ${CYAN}ssh $VPS_HOST${NC}"
        echo -e "  ${CYAN}sudo -u postgres createuser -s max${NC}"
        echo -e "  ${CYAN}sudo -u postgres createdb $DB_NAME -O max${NC}"
        echo ""
        echo -e "  ${YELLOW}Then re-run: ./deploy.sh --first-run${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}[1/5] Checking VPS prerequisites...${NC}"
    ssh "$VPS_HOST" 'source ~/.cargo/env 2>/dev/null; cargo --version' 2>/dev/null | grep -v 'Unauthorized\|monitored' || {
        echo -e "  ${RED}Rust not installed on VPS. Run with --first-run${NC}"
        exit 1
    }
    # Verify PostgreSQL access
    DB_OK=$(ssh "$VPS_HOST" "psql -U max -d $DB_NAME -c 'SELECT 1' 2>&1 | grep -c '1 row'" 2>/dev/null || echo "0")
    if [ "$DB_OK" != "1" ]; then
        echo -e "  ${RED}Cannot connect to PostgreSQL ($DB_NAME). Run with --first-run${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}Prerequisites OK${NC}"
fi

# ── Sync source code ──────────────────────────────────────────
echo -e "${BLUE}[2/5] Syncing source code to VPS...${NC}"

# Create target dir
ssh "$VPS_HOST" "mkdir -p $VPS_DIR" 2>/dev/null

# Rsync data-node source + shared code (exclude target dir to avoid huge transfers)
rsync -az --delete -e "$RSYNC_SSH" \
    --exclude 'target/' \
    --exclude '.git/' \
    --exclude 'frontend/' \
    --exclude 'node_modules/' \
    --exclude 'test-results/' \
    --exclude 'screenshots/' \
    --include 'Cargo.toml' \
    --include 'Cargo.lock' \
    --include 'assets.json' \
    --include 'data-node/***' \
    --include 'issuer/***' \
    --include 'ap/***' \
    --include 'curator/***' \
    --include 'common/***' \
    --include 'data/' \
    --include 'data/***' \
    --include 'deployments/' \
    --include 'deployments/***' \
    --exclude '*' \
    "$SCRIPT_DIR/" "$VPS_USER@$VPS_IP:$VPS_DIR/"

# Sync .env files
rsync -az -e "$RSYNC_SSH" "$SCRIPT_DIR/data-node/.env" "$VPS_USER@$VPS_IP:$VPS_DIR/data-node/.env"

# Also sync config files for vision sources
rsync -az -e "$RSYNC_SSH" --include='*.json' --exclude='*' \
    "$SCRIPT_DIR/data-node/src/config/" "$VPS_USER@$VPS_IP:$VPS_DIR/data-node/src/config/" 2>/dev/null || true

echo -e "  ${GREEN}Source synced${NC}"

# ── Patch VPS .env for remote Postgres ────────────────────────
echo -e "${BLUE}[3/5] Patching .env for VPS PostgreSQL...${NC}"
ssh "$VPS_HOST" "cd $VPS_DIR && sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres:///$DB_NAME|' data-node/.env" 2>/dev/null
# Also update RPC URLs to point to VPS L3 (local nginx proxy)
ssh "$VPS_HOST" "cd $VPS_DIR && sed -i 's|INDEX_RPC_URL=.*|INDEX_RPC_URL=http://localhost/|' data-node/.env && sed -i 's|SETTLEMENT_RPC_URL=.*|SETTLEMENT_RPC_URL=http://localhost/|' data-node/.env" 2>/dev/null
echo -e "  ${GREEN}ENV patched (postgres:///$DB_NAME — peer auth via socket)${NC}"

# ── Build on VPS ──────────────────────────────────────────────
echo -e "${BLUE}[4/5] Building data-node on VPS (this may take a few minutes)...${NC}"
ssh "$VPS_HOST" "cd $VPS_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node 2>&1 | tail -5" 2>/dev/null | grep -v 'Unauthorized\|monitored'
echo -e "  ${GREEN}Build complete${NC}"

# ── Stop old + start new ──────────────────────────────────────
echo -e "${BLUE}[5/5] Starting data-node on VPS...${NC}"

# Stop any existing data-node
ssh "$VPS_HOST" "pkill -x data-node 2>/dev/null || true" 2>/dev/null
sleep 1

# Start data-node (nohup, background)
# The data-node reads .env from CWD automatically via dotenvy
ssh "$VPS_HOST" "mkdir -p $VPS_DIR/logs && cd $VPS_DIR && nohup ./target/release/data-node serve \
    --database-url postgres:///$DB_NAME \
    --rpc-url http://localhost/ \
    --settlement-rpc-url http://localhost/ \
    --ecb-enabled \
    --openmeteo-sync-interval 300 \
    > logs/data-node.log 2>&1 &
    echo \$!" 2>/dev/null | grep -v 'Unauthorized\|monitored'

sleep 2

# Verify it started
if vps_data_node_running; then
    VPS_PID=$(ssh "$VPS_HOST" "pgrep -f 'data-node serve' | head -1" 2>/dev/null)
    echo -e "  ${GREEN}data-node running on VPS (PID: $VPS_PID, port $DATA_NODE_PORT)${NC}"
else
    echo -e "  ${RED}Failed to start data-node on VPS${NC}"
    echo -e "  ${YELLOW}Check logs: ssh $VPS_HOST 'tail -50 $VPS_DIR/logs/data-node.log'${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
echo -e "║         DEPLOYMENT COMPLETE                                  ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  VPS data-node: http://142.132.164.24:$DATA_NODE_PORT"
echo -e "  Logs:          ssh $VPS_HOST 'tail -f $VPS_DIR/logs/data-node.log'"
echo -e "  Stop:          ./deploy.sh --stop"
echo -e "  Status:        ./deploy.sh --status"
echo ""
echo -e "  ${YELLOW}NOTE: Local data-node is now locked out (shared API keys).${NC}"
echo -e "  ${YELLOW}Run ./deploy.sh --stop before starting local data-node.${NC}"
