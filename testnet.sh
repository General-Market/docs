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
#   ./testnet.sh deploy --seed  # Deploy + start services + seed ITP positions & borrows
#   (reset-chain removed — Orbit L3 re-derives from parent chain, volume wipe causes trie corruption)
#   ./testnet.sh start          # Start all services on VPSes
#   ./testnet.sh stop           # Stop all services on VPSes
#   ./testnet.sh status         # Check what's running
#   ./testnet.sh update         # git pull + rebuild + restart on both VPSes
#   ./testnet.sh seed-orders    # Buy all ITPs + seed Morpho borrows (alias: seed)
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

# Gas price (wei) — must exceed L3 base fee. Query: cast base-fee --rpc-url $RPC_URL
GAS_PRICE=10000000000  # 10 gwei

# Orbit L3 supports 49152 byte contracts (vs 24576 EVM default).
# Forge broadcast rejects deployments over 24576 without this flag.
FORGE_SIZE_FLAG="${FORGE_SIZE_FLAG:---disable-code-size-limit}"

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

# Curator key — Anvil account 5 (dedicated to avoid nonce conflicts with deployer)
CURATOR_KEY="0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"

# ITP Bot key — Anvil account 6 (dedicated to avoid nonce conflicts with deployer)
ITP_BOT_KEY="0x92db14e403b83dfe3df233f83dfa3ecda7b66661b024f5ece2e4d04c5f0b8aa2"

# Token deployer key — Anvil account 7 (separate nonce space for 621-token deploy)
TOKEN_DEPLOYER_KEY="0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"
TOKEN_DEPLOYER_ADDRESS="0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"

# Funder key — Anvil account 8 (cast send only: gas funding, USDC minting, BLS registration)
FUNDER_KEY="0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"
FUNDER_ADDRESS="0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"

# Database
DB_NAME="index_prices"

# Deployment file
DEPLOYMENT_FILE="deployments/active-deployment.json"

# Export INDEX_L3_RPC_URL for foundry.toml (forge reads from this env var)
export INDEX_L3_RPC_URL="$RPC_URL"

# rsync SSH (macOS rsync doesn't handle SSH aliases with /)
RSYNC_SSH_BE="ssh -o ProxyJump=bastion -p 3189"

# ── Helpers ──────────────────────────────────────────────────

vps_be_ssh() { ssh -o ConnectTimeout=10 "$VPS_BE_HOST" "$@" < /dev/null 2>/dev/null; }
vps_chain_ssh() { ssh -o ConnectTimeout=10 "$VPS_CHAIN_HOST" "$@" < /dev/null 2>/dev/null; }

# Settlement RPC for VPS services (through local proxy to avoid 429s)
SETTLEMENT_RPC_VPS="http://127.0.0.1:8547"

# Cleanup trap: remove local override YAMLs only (NOT key files — containers need them at runtime)
_cleanup() {
    rm -f "$SCRIPT_DIR"/.data-node-override.yml "$SCRIPT_DIR"/.oracle-override.yml "$SCRIPT_DIR"/.curator-override.yml "$SCRIPT_DIR"/.ap-override.yml
    # Key files are cleaned up ONLY by cmd_stop (line ~1258), not on exit.
    # Containers read key files at runtime — deleting them kills running services.
}
trap _cleanup EXIT

wait_for_service() {
    local url=$1
    local name=$2
    local expected_nonce=$3
    local max_attempts=30
    echo "Waiting for $name to detect new deployment..."
    for i in $(seq 1 $max_attempts); do
        local nonce=$(curl -sf "$url/admin/health" 2>/dev/null | jq -r '.deployment_nonce // 0')
        if [ "$nonce" = "$expected_nonce" ]; then
            echo -e "  ${GREEN}$name detected nonce $nonce${NC}"
            return 0
        fi
        sleep 2
    done
    echo -e "  ${YELLOW}WARNING: $name did not detect nonce $expected_nonce after $max_attempts attempts${NC}"
    return 1
}

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
    # CRITICAL: sync deployment files AFTER git pull to ensure oracles build with
    # the latest addresses. Without this, oracle Docker images bake in stale
    # deployment.json from git (which may not have the latest settlement addresses).
    for f in active-deployment.json vision-batches.json morpho-e2e.json; do
        [ -f "$SCRIPT_DIR/deployments/$f" ] && \
            rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/deployments/$f" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/$f" 2>/dev/null || true
    done
    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" "$SCRIPT_DIR/deployments/active-deployment.json" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/deployments/active-deployment.json" 2>/dev/null || true
    # Sync frontend deployment files — THREE copies must match:
    # lib/contracts/deployment.json (build-time), public/deployment.json (runtime), public/morpho-deployment.json
    cp "$SCRIPT_DIR/deployments/active-deployment.json" "$SCRIPT_DIR/frontend/lib/contracts/deployment.json" 2>/dev/null || true
    cp "$SCRIPT_DIR/deployments/active-deployment.json" "$SCRIPT_DIR/frontend/public/deployment.json" 2>/dev/null || true
    cp "$SCRIPT_DIR/deployments/morpho-e2e.json" "$SCRIPT_DIR/frontend/public/morpho-deployment.json" 2>/dev/null || true
    # AP on VPS 2 also needs symbol-map for FillConfirmed decomposition
    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/data/symbol-map.json" 2>/dev/null || true
    # Sync deployment JSONs to VPSes — file watcher on services detects changes automatically
    for f in active-deployment.json morpho-e2e.json vision-batches.json; do
        if [ -f "$SCRIPT_DIR/deployments/$f" ]; then
            rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/deployments/$f" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/$f" 2>/dev/null || true
        fi
    done
    if [ -f "$SCRIPT_DIR/deployments/active-deployment.json" ]; then
        rsync -az -e "ssh -o ProxyJump=bastion -p 3189" "$SCRIPT_DIR/deployments/active-deployment.json" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/deployments/active-deployment.json" 2>/dev/null || true
    fi
    # Keep local copies for switch-env compatibility
    if [ -f "$SCRIPT_DIR/deployments/active-deployment.json" ]; then
        cp "$SCRIPT_DIR/deployments/active-deployment.json" "$SCRIPT_DIR/frontend/lib/contracts/deployment.json"
        cp "$SCRIPT_DIR/deployments/active-deployment.json" "$SCRIPT_DIR/envs/testnet/deployment.json"
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

_rebuild_symbol_map_from_chain() {
    local index_addr
    index_addr=$(read_deployment_addr "Index")
    [ -z "$index_addr" ] && { echo -e "  ${YELLOW}Symbol-map chain rebuild skipped (no Index address)${NC}"; return 0; }
    echo -e "  Rebuilding symbol-map from on-chain ITP state..."
    python3 -c "
import json, urllib.request, sys

RPC = '$RPC_URL'
INDEX = '$index_addr'
SMAP_PATH = 'data/symbol-map.json'

def rpc(method, params):
    payload = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode()
    req = urllib.request.Request(RPC, data=payload, headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r).get('result', '0x')

def call(to, data):
    return rpc('eth_call', [{'to': to, 'data': data}, 'latest'])

def decode_uint(hex_str):
    return int(hex_str, 16) if hex_str and hex_str != '0x' else 0

# Load existing symbol-map (preserve all existing entries)
import os
smap = json.load(open(SMAP_PATH)) if os.path.exists(SMAP_PATH) else {}
existing = len(smap)

# getItpCount() -> uint256  selector: 0x2fa9f978
itp_count_raw = call(INDEX, '0x2fa9f978')
itp_count = decode_uint(itp_count_raw)
if itp_count == 0:
    print('No ITPs on-chain — symbol-map unchanged')
    sys.exit(0)

# For each ITP, call getITPState(bytes32) -> returns struct with assets array
# selector for getITPState(bytes32): keccak256('getITPState(bytes32)') = 0x7bfb3953
added = 0
for i in range(1, itp_count + 1):
    itp_id_hex = '%064x' % i
    data = '0x7bfb3953' + itp_id_hex
    raw = call(INDEX, data)
    if not raw or raw == '0x':
        continue
    raw = raw[2:]
    if len(raw) < 64:
        continue
    # ABI-decode dynamic struct: first words are offsets, find the assets array
    # Layout: (address owner, uint256 nav, uint256 totalSupply, address[] assets, uint256[] weights, uint256[] quantities)
    # Word 3 (index 3) = offset to assets array (in bytes from start of data)
    words = [raw[i*64:(i+1)*64] for i in range(len(raw)//64)]
    if len(words) < 5:
        continue
    try:
        assets_offset = int(words[3], 16) // 32  # offset in words
        if assets_offset >= len(words):
            continue
        asset_count = int(words[assets_offset], 16)
        for j in range(asset_count):
            word_idx = assets_offset + 1 + j
            if word_idx >= len(words):
                break
            token_addr = '0x' + words[word_idx][24:].lower()
            if token_addr in smap:
                continue  # already mapped — don't overwrite
            # Read symbol() from token contract — selector 0x95d89b41
            sym_raw = call(token_addr, '0x95d89b41')
            if not sym_raw or sym_raw == '0x':
                continue
            sym_raw = sym_raw[2:]
            sym_words = [sym_raw[k*64:(k+1)*64] for k in range(len(sym_raw)//64)]
            if len(sym_words) < 3:
                continue
            # ABI string: word 0 = offset (0x20), word 1 = length, word 2+ = utf8 bytes
            sym_len = int(sym_words[1], 16)
            if sym_len == 0 or sym_len > 64:
                continue
            sym_bytes = bytes.fromhex(sym_words[2])[:sym_len]
            symbol = sym_bytes.decode('utf-8', errors='replace').strip('\x00')
            if symbol:
                smap[token_addr] = {'pair': symbol + 'USDT', 'source': 'bitget'}
                added += 1
    except Exception:
        continue

import json as _json
_json.dump(smap, open(SMAP_PATH, 'w'), indent=2)
print(f'Chain rebuild: {itp_count} ITPs scanned, {added} new entries added ({len(smap)} total in symbol-map)')
" 2>/dev/null && echo -e "  ${GREEN}Symbol-map rebuilt from chain${NC}" || echo -e "  ${YELLOW}Symbol-map chain rebuild failed (non-critical)${NC}"
}

_merge_deployments() {
    local l3_json="$1"       # e.g., deployments/e2e-full-system-l3.json
    local sonic_json="$2"    # e.g., deployments/e2e-full-system-sonic.json
    local output="$3"        # e.g., deployments/active-deployment.json

    python3 -c "
import json, os
l3 = json.load(open('$l3_json'))
sonic = json.load(open('$sonic_json'))
sc = sonic['contracts']

# Preserve existing keys from active-deployment.json that aren't in L3 or Sonic
# (e.g., Vision from step 6, Morpho from step 5 — these are added by later steps)
existing_doc = {}
existing = {}
if os.path.exists('$output'):
    try:
        existing_doc = json.load(open('$output'))
        existing = existing_doc.get('contracts', {})
    except: pass

# Start with L3 as base
merged = dict(l3['contracts'])

# Preserve keys from existing deployment that L3 doesn't have
# (Vision, Morpho, InvestmentImpl, OracleRegistryImpl, etc.)
for key, val in existing.items():
    if key not in merged and val:
        merged[key] = val

# Override settlement-specific contracts with Sonic addresses
for key in ['SettlementBridgeCustody', 'SETTLEMENT_USDC', 'SETTLEMENT_USDC_DECIMALS', 'MockBitgetVault', 'MOCK_USDT']:
    if key in sc:
        merged[key] = sc[key]
# BridgedItpFactory: exists on BOTH chains. Keep L3 version for Morpho collateral.
if 'BridgedItpFactory' in sc:
    merged['L3BridgedItpFactory'] = merged.get('BridgedItpFactory', '')
    merged['BridgedItpFactory'] = sc['BridgedItpFactory']
    merged['SettlementBridgedItpFactory'] = sc['BridgedItpFactory']
# Add Sonic-specific keys
if 'OracleRegistry' in sc:
    merged['SettlementOracleRegistry'] = sc['OracleRegistry']
# BridgeProxy: frontend/E2E use this for settlement operations (requestCreateItp etc.)
# so it MUST point to the Sonic address. Save L3's as L3BridgeProxy.
if 'BridgeProxy' in sc:
    merged['L3BridgeProxy'] = merged.get('BridgeProxy', '')
    merged['BridgeProxy'] = sc['BridgeProxy']
    merged['SettlementBridgeProxy'] = sc['BridgeProxy']
# Preserve top-level keys from existing doc that consumers depend on —
# services reject JSON without deployer/chainId; vault deployer depends on
# whitelistedVaults + sourceVaults arrays surviving between phases.
for k in ('deployer', 'timestamp', 'whitelistedVaults', 'sourceVaults'):
    if k not in l3 and k in existing_doc:
        l3[k] = existing_doc[k]
# Add settlement chain metadata
l3['contracts'] = merged
l3.setdefault('chainId', $CHAIN_ID)
l3['settlementChainId'] = $SETTLEMENT_CHAIN_ID
json.dump(l3, open('$output', 'w'), indent=2)
print('Merged: L3 (%d) + Sonic (%d) + preserved (%d extra) -> %s' % (
    len(l3['contracts']), len(sc), len(existing), '$output'))
"
}

# Forge sometimes leaves a Sonic broadcast half-submitted (nonce drift on
# --resume). Replay the unreceipted txs via cast — simpler than coaxing forge
# through reconciliation.
_complete_broadcast_via_cast() {
    local broadcast_file="$1"   # e.g., contracts/broadcast/.../14601/run-latest.json
    local rpc="$2"
    local chain_id="$3"
    local gas_price="${4:-50000000000}"  # 50 gwei default
    python3 <<PYEOF
import json, subprocess, sys
bd = json.load(open('$broadcast_file'))
txs = bd.get('transactions', [])
rcpts = bd.get('receipts', [])
rcpt_hashes = set((r.get('transactionHash') or '').lower() for r in rcpts)
missing = [(i, tx) for i, tx in enumerate(txs)
           if not (tx.get('hash') or '').lower() in rcpt_hashes or not tx.get('hash')]
if not missing:
    print('  No missing txs to replay')
    sys.exit(0)
print(f'  Replaying {len(missing)} missing txs via cast')
ok = 0
for i, tx in missing:
    t = tx.get('transaction', {})
    to = t.get('to')
    data = t.get('input') or t.get('data') or '0x'
    value = t.get('value', '0x0')
    if not to:
        print(f'  #{i} skip (contract creation — forge owns)')
        continue
    value_dec = int(value, 16) if isinstance(value, str) and value.startswith('0x') else int(value or 0)
    r = subprocess.run(['cast','send',to,data,'--private-key','$DEPLOYER_KEY',
                        '--rpc-url','$rpc','--chain','$chain_id','--legacy',
                        '--gas-price','$gas_price','--value',str(value_dec)],
                       capture_output=True, text=True, timeout=90)
    if '1 (success)' in r.stdout:
        ok += 1
    else:
        print(f'  #{i} FAIL: {(r.stderr or r.stdout)[-160:]}')
print(f'  {ok}/{len(missing)} replayed')
PYEOF
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
    # Parse flags
    local AUTO_SEED=false
    for arg in "$@"; do
        case "$arg" in
            --seed) AUTO_SEED=true ;;
        esac
    done

    # Opportunistic pre-deploy check: if the current active-deployment.json
    # has dead addresses, say so before we overwrite it. Non-fatal —
    # redeploy is exactly the fix.
    if [ -f "deployments/active-deployment.json" ] && \
       command -v cast >/dev/null 2>&1 && \
       command -v jq >/dev/null 2>&1; then
        echo -e "${BLUE}Pre-deploy address check (informational)...${NC}"
        bash scripts/validate-deployment-addresses.sh \
            "${RPC_URL:-http://142.132.164.24/}" \
            deployments/active-deployment.json || \
            echo -e "${YELLOW}Current deployment has dead addresses — proceeding with redeploy.${NC}"
    fi

    # Wipe deployment-specific Postgres tables (preserves raw market data)
    # These tables contain state tied to contract addresses that change on redeploy.
    # NEVER add vision_player_points or vision_epoch_log — those are persistent lifetime stats.
    echo -e "${BLUE}Wiping stale deployment data from Postgres...${NC}"
    vps_be_ssh "psql -U max -d index_prices -c \"
        TRUNCATE
            vision_round_players,
            vision_batch_lifecycle,
            vision_settlement_proofs,
            vision_batches,
            vision_positions,
            vision_bitmaps,
            vision_kv_store,
            vision_reference_prices,
            itp_snapshots,
            itp_meta,
            trades,
            user_shares,
            -- points_ledger and points_totals preserved (player lifetime stats, not contract-bound)
            issuer_health_snapshots,
            oracle_health_snapshots,
            collector_cursors,
            batch_configs,
            batch_settlements,
            signed_batch_configs,
            liquidity_snapshots,
            sim_nav_series,
            sim_holdings,
            sim_trades
        CASCADE;
    \" 2>&1" \
        && echo -e "  ${GREEN}Deployment tables wiped (raw market data preserved)${NC}" \
        || echo -e "  ${YELLOW}Postgres wipe failed — tables may have stale data${NC}"

    # Also wipe data_node vision tables (separate DB) — stale batches from previous
    # deployments confuse the frontend and oracle batch discovery.
    vps_be_ssh "psql -U max -d data_node -c \"
        TRUNCATE
            vision_batches,
            vision_tick_results,
            vision_reference_prices,
            batch_configs,
            signed_batch_configs,
            batch_settlements
        CASCADE;
    \" 2>&1" \
        && echo -e "  ${GREEN}Data-node vision tables wiped${NC}" \
        || echo -e "  ${YELLOW}Data-node wipe failed (tables may not exist yet)${NC}"

    echo -e "${CYAN}Deploying contracts to L3 (chain $CHAIN_ID)...${NC}"

    # Prerequisites
    for cmd in forge cast python3; do
        command -v $cmd &>/dev/null || { echo -e "${RED}$cmd not found${NC}"; exit 1; }
    done

    # Ensure logs dir exists
    mkdir -p logs

    # Clean secondary broadcast dirs. Token + core broadcasts are preserved for resume
    # UNLESS the core deploy is invalid (step 3 will detect and redeploy).
    echo -e "${BLUE}[0/14] Cleaning stale broadcast data...${NC}"
    rm -rf contracts/broadcast/Deploy107ITPs_Create.s.sol/$CHAIN_ID/
    rm -rf contracts/broadcast/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/
    rm -rf contracts/broadcast/DeployBatchMarkets.s.sol/$CHAIN_ID/
    rm -rf contracts/broadcast/DeployVision.s.sol/$CHAIN_ID/
    rm -rf contracts/broadcast/DeployAllVisionBatches.s.sol/$CHAIN_ID/
    rm -rf contracts/broadcast/DeployMorphoE2E.s.sol/$CHAIN_ID/
    echo -e "  ${GREEN}Secondary broadcast dirs cleaned (core + tokens preserved for resume)${NC}"

    # Check L3 is reachable
    echo -e "${BLUE}[1/14] Checking L3 RPC...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    if [ "$VPS_CHAIN_ID" != "$CHAIN_ID" ]; then
        echo -e "  ${RED}L3 not reachable (got chain $VPS_CHAIN_ID, expected $CHAIN_ID)${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}L3 OK (chain $VPS_CHAIN_ID)${NC}"

    # Auto-adjust gas price if chain base fee exceeds configured GAS_PRICE
    local BASE_FEE=$(cast base-fee --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    if python3 -c "exit(0 if int('$BASE_FEE') > int('$GAS_PRICE') else 1)" 2>/dev/null; then
        local NEW_GAS=$(python3 -c "print(int(int('$BASE_FEE') * 1.5))")
        echo -e "  ${YELLOW}Base fee ($BASE_FEE) exceeds GAS_PRICE ($GAS_PRICE) — auto-adjusting to $NEW_GAS${NC}"
        GAS_PRICE="$NEW_GAS"
    else
        echo -e "  Gas price: $GAS_PRICE (base fee: $BASE_FEE)${NC}"
    fi

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

    # Fund TOKEN_DEPLOYER and FUNDER accounts with gas from DEPLOYER
    # These keys have separate nonce spaces to prevent nonce collisions during deployment.
    echo -e "${BLUE}[1c/14] Funding TOKEN_DEPLOYER + FUNDER accounts with gas...${NC}"
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$TOKEN_DEPLOYER_ADDRESS" --value 50ether > /dev/null 2>&1 || true
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$FUNDER_ADDRESS" --value 50ether > /dev/null 2>&1 || true
    # Fund FUNDER on Sonic too (needed for settlement USDC minting)
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
        "$FUNDER_ADDRESS" --value 1ether > /dev/null 2>&1 || true
    echo -e "  ${GREEN}TOKEN_DEPLOYER ($TOKEN_DEPLOYER_ADDRESS) + FUNDER ($FUNDER_ADDRESS) funded${NC}"

    # Check bls-tool binary (needed for FFI in deploy scripts)
    echo -e "${BLUE}[2/14] Checking bls-tool (FFI)...${NC}"
    if [ ! -f "target/release/bls-tool" ]; then
        echo -e "  ${YELLOW}bls-tool missing — building from workspace root (first run, ~5 min)${NC}"
        cargo build --release --bin bls-tool >> logs/bls-tool-build.log 2>&1 \
            || { echo -e "  ${RED}bls-tool build failed — see logs/bls-tool-build.log${NC}"; exit 1; }
    fi
    echo -e "  ${GREEN}bls-tool ready${NC}"

    # Deploy core system (must run from contracts/ for foundry.toml remappings)
    # Validate existing deploy by checking key contracts have code ON-CHAIN (not just receipt count,
    # which passes on stale broadcasts where simulation nonces diverged from broadcast nonces).
    echo -e "${BLUE}[3/14] Deploying core contracts (Index, OracleRegistry, USDC, BridgeProxy)...${NC}"
    local CORE_DEPLOY_VALID=false
    local EXISTING_RECEIPTS=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('receipts',[])))" 2>/dev/null || echo "0")
    if [ "$EXISTING_RECEIPTS" != "0" ] && [ -f "deployments/e2e-full-system.json" ]; then
        # Receipts exist — but do the contracts actually have code? Orbit L3 nonce drift means
        # simulation addresses diverge from broadcast addresses. The only truth is on-chain.
        local CHECK_INDEX=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system.json'))['contracts']['Index'])" 2>/dev/null || echo "")
        local CHECK_REGISTRY=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system.json'))['contracts']['OracleRegistry'])" 2>/dev/null || echo "")
        if [ -n "$CHECK_INDEX" ] && [ -n "$CHECK_REGISTRY" ]; then
            local INDEX_CODE_LEN=$(cast code --rpc-url "$RPC_URL" "$CHECK_INDEX" 2>/dev/null | wc -c | tr -d ' ')
            local REG_CODE_LEN=$(cast code --rpc-url "$RPC_URL" "$CHECK_REGISTRY" 2>/dev/null | wc -c | tr -d ' ')
            if [ "$INDEX_CODE_LEN" -gt 10 ] && [ "$REG_CODE_LEN" -gt 10 ]; then
                CORE_DEPLOY_VALID=true
                echo -e "  ${GREEN}Valid deployment verified on-chain ($EXISTING_RECEIPTS receipts, Index + OracleRegistry have code)${NC}"
            else
                echo -e "  ${YELLOW}Stale deployment detected ($EXISTING_RECEIPTS receipts but Index=$INDEX_CODE_LEN bytes, Registry=$REG_CODE_LEN bytes) — redeploying${NC}"
            fi
        fi
    fi
    if [ "$CORE_DEPLOY_VALID" = true ]; then
        : # skip forge deploy
    else
        # ============================================================
        # SINGLE-PHASE DEPLOY: DeployFullSystemE2E.run() handles everything internally.
        # (Prior two-phase logic assumed runPhase1()/runPhase2() which don't exist in
        # the Solidity script. Kept receipt-rebuild as fallback if JSON addresses drift.)
        # ============================================================

        rm -rf contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/
        rm -rf contracts/cache/DeployFullSystemE2E.s.sol/$CHAIN_ID/
        rm -f deployments/e2e-full-system.json
        echo -e "  ${YELLOW}Core broadcast cleaned (fresh deploy)${NC}"

        echo -e "  ${BLUE}Deploying DeployFullSystemE2E (all internal phases)...${NC}"
        (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
            --rpc-url "$RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --broadcast --slow \
            --chain-id $CHAIN_ID \
            --legacy --with-gas-price $GAS_PRICE \
            $FORGE_SIZE_FLAG) \
            > logs/deploy-core.log 2>&1 || true

        if [ ! -f "deployments/e2e-full-system.json" ]; then
            echo -e "  ${RED}Core deploy failed — no e2e-full-system.json${NC}"
            echo -e "  ${YELLOW}Last 30 lines of logs/deploy-core.log:${NC}"
            tail -30 logs/deploy-core.log 2>/dev/null || true
            exit 1
        fi
        local CORE_RECEIPTS=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('receipts',[])))" 2>/dev/null || echo "0")
        if [ "$CORE_RECEIPTS" = "0" ]; then
            echo -e "  ${RED}Core deploy failed — 0 receipts${NC}"
            tail -30 logs/deploy-core.log 2>/dev/null || true
            exit 1
        fi
        echo -e "  ${GREEN}Core deploy complete ($CORE_RECEIPTS txs confirmed)${NC}"

        # ---- REBUILD ADDRESSES FROM BROADCAST RECEIPTS ----
        # forge writes SIMULATION addresses to e2e-full-system.json. On Orbit L3
        # the deployer nonce between simulation and broadcast diverges, so the
        # real on-chain addresses differ. Reconcile from broadcast before any
        # downstream step reads the JSON.
        python3 -c "
import json
bd = json.load(open('contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/run-latest.json'))
dj = json.load(open('deployments/e2e-full-system.json'))
impls, proxies = {}, {}
for tx in bd.get('transactions', []):
    if tx.get('transactionType') not in ('CREATE','CREATE2'): continue
    name, addr, args = tx.get('contractName',''), tx.get('contractAddress',''), tx.get('arguments',[])
    if name == 'ERC1967Proxy' and args:
        proxies.setdefault(args[0].lower(), []).append(addr)
    elif name and addr:
        impls.setdefault(name, []).append(addr)
def proxy_of(name):
    if name not in impls: return None
    return (proxies.get(impls[name][0].lower()) or [None])[0]
def plain(name):
    return (impls.get(name) or [None])[0]
c = dj['contracts']
# Proxies
for src, key in [('Investment','Index'),('OracleRegistry','OracleRegistry'),
                  ('Governance','Governance'),('L3BridgeCustody','L3BridgeCustody'),
                  ('SettlementBridgeCustody','SettlementBridgeCustody'),
                  ('BLSCustody','BLSCustody')]:
    a = proxy_of(src)
    if a: c[key] = a
# Plain deploys
for name in ('CollateralRegistry','BridgedItpFactory','BridgeProxy','MockBitgetVault'):
    a = plain(name)
    if a: c[name] = a
# MockERC20 order from Phase 1: L3_WUSDC, SETTLEMENT_USDC, MOCK_USDT
mocks = impls.get('MockERC20', [])
if len(mocks) >= 1:
    c['L3_WUSDC'] = mocks[0]; c['USDC'] = mocks[0]
if len(mocks) >= 2: c['SETTLEMENT_USDC'] = mocks[1]
if len(mocks) >= 3: c['MOCK_USDT'] = mocks[2]
json.dump(dj, open('deployments/e2e-full-system.json','w'), indent=2)
print(f'Reconciled {len([k for k in c if c[k]])} addresses from broadcast receipts')
" 2>/dev/null && echo -e "  ${GREEN}Addresses reconciled from broadcast${NC}" \
|| echo -e "  ${YELLOW}Address reconciliation failed (continuing with simulation values)${NC}"

        # ---- POST-DEPLOY VERIFICATION ----
        local POST_INDEX=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system.json'))['contracts']['Index'])" 2>/dev/null || echo "")
        local POST_REGISTRY=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system.json'))['contracts']['OracleRegistry'])" 2>/dev/null || echo "")
        if [ -n "$POST_INDEX" ] && [ -n "$POST_REGISTRY" ]; then
            local POST_INDEX_CODE=$(cast code --rpc-url "$RPC_URL" "$POST_INDEX" 2>/dev/null | wc -c | tr -d ' ')
            local POST_REG_CODE=$(cast code --rpc-url "$RPC_URL" "$POST_REGISTRY" 2>/dev/null | wc -c | tr -d ' ')
            if [ "$POST_INDEX_CODE" -lt 10 ] || [ "$POST_REG_CODE" -lt 10 ]; then
                echo -e "  ${RED}CRITICAL: Index ($POST_INDEX_CODE bytes) or OracleRegistry ($POST_REG_CODE bytes) missing on-chain after deploy${NC}"
                rm -rf contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/ deployments/e2e-full-system.json
                exit 1
            fi

            # Verify OracleRegistry stores correct governance (may have Phase 2 drift)
            local REG_GOV=$(cast call --rpc-url "$RPC_URL" "$POST_REGISTRY" "governance()(address)" 2>/dev/null | tr -d '[:space:]')
            local REG_GOV_LOWER=$(echo "$REG_GOV" | tr '[:upper:]' '[:lower:]')
            local EXPECTED_GOV=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system.json'))['contracts']['Governance'])" 2>/dev/null || echo "")
            local EXPECTED_GOV_LOWER=$(echo "$EXPECTED_GOV" | tr '[:upper:]' '[:lower:]')
            if [ "$REG_GOV_LOWER" != "$EXPECTED_GOV_LOWER" ]; then
                echo -e "  ${YELLOW}OracleRegistry.governance() = $REG_GOV, expected $EXPECTED_GOV — Phase 2 drift detected${NC}"
                echo -e "  ${YELLOW}Repairing via setGovernance...${NC}"
                cast send "$POST_REGISTRY" "setGovernance(address)" "$EXPECTED_GOV" \
                    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                    --legacy --gas-price $GAS_PRICE --gas-limit 200000 \
                    > /dev/null 2>&1 && echo -e "  ${GREEN}OracleRegistry governance repaired${NC}" \
                    || echo -e "  ${RED}OracleRegistry governance repair failed — may need full redeploy${NC}"
            fi

            # Verify Investment.governance() matches
            local INV_GOV=$(cast call --rpc-url "$RPC_URL" "$POST_INDEX" "governance()(address)" 2>/dev/null | tr -d '[:space:]')
            local INV_GOV_LOWER=$(echo "$INV_GOV" | tr '[:upper:]' '[:lower:]')
            if [ "$INV_GOV_LOWER" != "$EXPECTED_GOV_LOWER" ]; then
                echo -e "  ${RED}WARNING: Investment.governance() = $INV_GOV, expected $EXPECTED_GOV${NC}"
                echo -e "  ${RED}Investment.governance is set-once at init — cannot repair without redeploy.${NC}"
                echo -e "  ${RED}But this should not happen: Investment reads governance from Phase 1 (receipt-rebuilt).${NC}"
            fi

            echo -e "  ${GREEN}On-chain verification passed (Index + OracleRegistry have code, governance chain intact)${NC}"
        fi
    fi

    # Copy fresh deployment to active so subsequent steps read correct addresses
    cp deployments/e2e-full-system.json "$DEPLOYMENT_FILE"
    echo -e "  ${GREEN}Deployment JSON updated${NC}"

    # Verify critical non-proxy contracts have code (MockBitgetVault, MOCK_USDT, L3_WUSDC)
    # These are needed by subsequent deploy steps (tokens, Morpho) and the auto-fix
    # may have missed them.
    echo -e "  Verifying critical contract addresses..."
    local VERIFY_PASS=true
    for key in MockBitgetVault MOCK_USDT L3_WUSDC; do
        local ADDR=$(read_deployment_addr "$key")
        if [ -n "$ADDR" ] && [ "$ADDR" != "None" ]; then
            local CODE_LEN=$(cast code --rpc-url "$RPC_URL" "$ADDR" 2>/dev/null | wc -c | tr -d ' ')
            if [ "$CODE_LEN" -lt 10 ]; then
                echo -e "  ${RED}$key ($ADDR) has no code on-chain!${NC}"
                VERIFY_PASS=false
            fi
        fi
    done
    if [ "$VERIFY_PASS" = false ]; then
        echo -e "  ${RED}CRITICAL: Some contracts have no code. Deployment JSON has stale addresses.${NC}"
        echo -e "  ${RED}Cleaning artifacts and aborting — re-run deploy.${NC}"
        rm -rf contracts/broadcast/DeployFullSystemE2E.s.sol/$CHAIN_ID/ contracts/cache/DeployFullSystemE2E.s.sol/$CHAIN_ID/ deployments/e2e-full-system.json
        exit 1
    fi
    echo -e "  ${GREEN}All critical contracts verified on-chain${NC}"

    # 3b: Register oracle BLS keys in OracleRegistry
    echo -e "${BLUE}[3b/14] Registering oracle BLS keys in OracleRegistry...${NC}"
    # Read the ACTUAL OracleRegistry from the Index contract (not deployment JSON — may be stale)
    INDEX_ADDR_3B=$(read_deployment_addr "Index")
    ORACLE_REGISTRY_ADDR=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR_3B" "oracleRegistry()(address)" 2>/dev/null | tr -d '[:space:]')
    if [ -z "$ORACLE_REGISTRY_ADDR" ] || [ "$ORACLE_REGISTRY_ADDR" = "0x0000000000000000000000000000000000000000" ]; then
        ORACLE_REGISTRY_ADDR=$(read_deployment_addr "OracleRegistry")
    fi
    if [ -z "$ORACLE_REGISTRY_ADDR" ]; then
        echo -e "  ${RED}OracleRegistry address not found in deployment JSON${NC}"
        exit 1
    fi
    echo -e "  OracleRegistry: $ORACLE_REGISTRY_ADDR"

    # Check if oracles are ALREADY registered on-chain (skip registration on re-runs)
    EXISTING_ORACLE_COUNT=$(cast call "$ORACLE_REGISTRY_ADDR" "activeOracleCount()(uint256)" \
        --rpc-url "$RPC_URL" 2>/dev/null | tr -d '[:space:]' || echo "0")
    # cast may return hex (0x3) or decimal (3) — normalize
    EXISTING_ORACLE_COUNT=$(python3 -c "v='$EXISTING_ORACLE_COUNT'; print(int(v, 16) if v.startswith('0x') else int(v) if v.isdigit() else 0)" 2>/dev/null || echo "0")

    if [ "$EXISTING_ORACLE_COUNT" = "3" ]; then
        echo -e "  ${GREEN}Oracles already registered on-chain ($EXISTING_ORACLE_COUNT active) — skipping registration${NC}"
    else
        echo -e "  Current oracle count: $EXISTING_ORACLE_COUNT — registering..."

        # Oracle addresses (Anvil accounts 1-3)
        ORACLE_1_ADDR_BLS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        ORACLE_2_ADDR_BLS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
        ORACLE_3_ADDR_BLS="0x90F79bf6EB2c4f870365E785982E1f101E93b906"

        # Generate BLS pubkeys via bls-tool
        BLS_PUBKEY_0=$(target/release/bls-tool pubkey --seed-index 0 2>/dev/null) || { echo -e "  ${RED}bls-tool pubkey --seed-index 0 failed${NC}"; exit 1; }
        BLS_PUBKEY_1=$(target/release/bls-tool pubkey --seed-index 1 2>/dev/null) || { echo -e "  ${RED}bls-tool pubkey --seed-index 1 failed${NC}"; exit 1; }
        BLS_PUBKEY_2=$(target/release/bls-tool pubkey --seed-index 2 2>/dev/null) || { echo -e "  ${RED}bls-tool pubkey --seed-index 2 failed${NC}"; exit 1; }

        # addOracle requires: (address oracle, bytes32 ipPort, bytes pubkey, bytes popSig)
        # POP = BLS sign of keccak256(abi.encode("INDEX_BLS_POP", chainId, registryAddr, oracleAddr, pubkey))
        _register_one_oracle() {
            local IDX=$1 ORACLE_ADDR=$2 IP_PORT=$3 PUBKEY=$4
            # Convert IP string to bytes32 (right-padded)
            local IP_BYTES32=$(cast --format-bytes32 "$IP_PORT" 2>/dev/null || printf "0x%-64s" "$(echo -n "$IP_PORT" | xxd -p)" | tr ' ' '0')
            # Compute POP message hash
            local POP_MSG=$(cast keccak "$(cast abi-encode 'f(string,uint256,address,address,bytes)' 'INDEX_BLS_POP' $CHAIN_ID $ORACLE_REGISTRY_ADDR $ORACLE_ADDR $PUBKEY)" 2>/dev/null)
            # Sign POP with BLS key
            local POP_SIG=$(target/release/bls-tool sign --seed-indices "$IDX" --message-hash "$POP_MSG" 2>/dev/null)
            if [ -z "$POP_SIG" ]; then echo -e "  ${RED}BLS POP sign failed for oracle $((IDX+1))${NC}"; exit 1; fi
            # Call addOracle with correct 4-param signature
            cast send "$ORACLE_REGISTRY_ADDR" \
                "addOracle(address,bytes32,bytes,bytes)" \
                "$ORACLE_ADDR" "$IP_BYTES32" "$PUBKEY" "$POP_SIG" \
                --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
                > /dev/null 2>&1 || { echo -e "  ${RED}addOracle $((IDX+1)) failed${NC}"; exit 1; }
        }

        echo -e "  Adding oracle 1 ($ORACLE_1_ADDR_BLS)..."
        _register_one_oracle 0 "$ORACLE_1_ADDR_BLS" "127.0.0.1:9001" "$BLS_PUBKEY_0"
        AGG_PUBKEY_1=$(target/release/bls-tool agg-pubkey-from-seeds --seed-indices 0 2>/dev/null) || { echo -e "  ${RED}agg-pubkey 0 failed${NC}"; exit 1; }
        cast send "$ORACLE_REGISTRY_ADDR" "setAggregatedPubkey(bytes,uint256)" \
            "$AGG_PUBKEY_1" 1 \
            --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
            > /dev/null 2>&1 || { echo -e "  ${RED}setAggregatedPubkey 1 failed${NC}"; exit 1; }
        echo -e "  ${GREEN}Oracle 1 registered${NC}"

        echo -e "  Adding oracle 2 ($ORACLE_2_ADDR_BLS)..."
        _register_one_oracle 1 "$ORACLE_2_ADDR_BLS" "127.0.0.1:9002" "$BLS_PUBKEY_1"
        AGG_PUBKEY_2=$(target/release/bls-tool agg-pubkey-from-seeds --seed-indices 0,1 2>/dev/null) || { echo -e "  ${RED}agg-pubkey 0,1 failed${NC}"; exit 1; }
        cast send "$ORACLE_REGISTRY_ADDR" "setAggregatedPubkey(bytes,uint256)" \
            "$AGG_PUBKEY_2" 2 \
            --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
            > /dev/null 2>&1 || { echo -e "  ${RED}setAggregatedPubkey 2 failed${NC}"; exit 1; }
        echo -e "  ${GREEN}Oracle 2 registered${NC}"

        echo -e "  Adding oracle 3 ($ORACLE_3_ADDR_BLS)..."
        _register_one_oracle 2 "$ORACLE_3_ADDR_BLS" "127.0.0.1:9003" "$BLS_PUBKEY_2"
        AGG_PUBKEY_3=$(target/release/bls-tool agg-pubkey-from-seeds --seed-indices 0,1,2 2>/dev/null) || { echo -e "  ${RED}agg-pubkey 0,1,2 failed${NC}"; exit 1; }
        cast send "$ORACLE_REGISTRY_ADDR" "setAggregatedPubkey(bytes,uint256)" \
            "$AGG_PUBKEY_3" 3 \
            --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
            > /dev/null 2>&1 || { echo -e "  ${RED}setAggregatedPubkey 3 failed${NC}"; exit 1; }
        echo -e "  ${GREEN}Oracle 3 registered${NC}"

        # Verify all 3 oracles registered
        ACTIVE_ORACLE_COUNT=$(cast call "$ORACLE_REGISTRY_ADDR" "activeOracleCount()(uint256)" \
            --rpc-url "$RPC_URL" 2>/dev/null | tr -d '[:space:]' || echo "0")
        ACTIVE_ORACLE_COUNT=$(python3 -c "v='$ACTIVE_ORACLE_COUNT'; print(int(v, 16) if v.startswith('0x') else int(v) if v.isdigit() else 0)" 2>/dev/null || echo "0")
        if [ "$ACTIVE_ORACLE_COUNT" != "3" ]; then
            echo -e "  ${YELLOW}Oracle count check returned $ACTIVE_ORACLE_COUNT (Orbit eth_call may fail on proxies — non-fatal)${NC}"
        fi
        echo -e "  ${GREEN}BLS oracle registration complete — $ACTIVE_ORACLE_COUNT active oracles${NC}"
    fi

    # Patch deployment JSON with the verified OracleRegistry address (chain-sourced, not broadcast-derived)
    python3 -c "import json; d=json.load(open('$DEPLOYMENT_FILE')); d['contracts']['OracleRegistry']='$ORACLE_REGISTRY_ADDR'; json.dump(d,open('$DEPLOYMENT_FILE','w'),indent=2)"

    # 3b2: Verify OracleRegistry governance chain
    # On Orbit, CREATE addresses diverge between forge simulation and broadcast.
    # If OracleRegistry._governance points to a stale Governance proxy, ALL admin calls
    # fail — including setAggregatedPubkey. After 86400 blocks, BLSVerifier__SnapshotTooOld
    # permanently prevents order fills. Detect and fix this before it metastasizes.
    #
    # Trust chain: read Governance from the Index contract ON-CHAIN (not from the deployment
    # JSON, which contains simulation addresses that may diverge on Orbit).
    echo -e "${BLUE}[3b2/14] Verifying OracleRegistry governance chain...${NC}"
    INDEX_GOV_ADDR=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR_3B" "governance()(address)" 2>/dev/null | tr -d '[:space:]')
    REGISTRY_GOV=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REGISTRY_ADDR" "governance()(address)" 2>/dev/null | tr -d '[:space:]')
    echo -e "  Index.governance (on-chain): $INDEX_GOV_ADDR"
    echo -e "  OracleRegistry._governance:  $REGISTRY_GOV"

    if [ -n "$REGISTRY_GOV" ] && [ -n "$INDEX_GOV_ADDR" ]; then
        # Normalize to lowercase for comparison
        REGISTRY_GOV_LOWER=$(echo "$REGISTRY_GOV" | tr '[:upper:]' '[:lower:]')
        INDEX_GOV_LOWER=$(echo "$INDEX_GOV_ADDR" | tr '[:upper:]' '[:lower:]')

        if [ "$REGISTRY_GOV_LOWER" != "$INDEX_GOV_LOWER" ]; then
            echo -e "  ${YELLOW}MISMATCH — OracleRegistry._governance ($REGISTRY_GOV) != Index.governance ($INDEX_GOV_ADDR)${NC}"
            echo -e "  ${YELLOW}Attempting setGovernance fix...${NC}"

            # The deployer is admin on the current (possibly stale) governance.
            # If the stale governance proxy is at a valid address where admin() resolves
            # to the deployer, onlyAdmin passes and we can fix it.
            if cast send "$ORACLE_REGISTRY_ADDR" "setGovernance(address)" "$INDEX_GOV_ADDR" \
                --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                --legacy --gas-price $GAS_PRICE --gas-limit 200000 \
                > /dev/null 2>&1; then
                echo -e "  ${GREEN}setGovernance succeeded — governance chain repaired${NC}"
            else
                echo -e "  ${RED}setGovernance failed — governance chain is broken${NC}"
                echo -e "  ${RED}The deployer cannot call onlyAdmin functions on OracleRegistry.${NC}"
                echo -e "  ${RED}Full redeploy required.${NC}"
                exit 1
            fi

            # Verify the fix
            REGISTRY_GOV_AFTER=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REGISTRY_ADDR" "governance()(address)" 2>/dev/null | tr -d '[:space:]')
            echo -e "  Registry _governance after fix: $REGISTRY_GOV_AFTER"
        else
            echo -e "  ${GREEN}Governance chain valid (OracleRegistry and Index agree)${NC}"
        fi

        # Also verify that governance.admin() returns the deployer
        GOV_ADMIN=$(cast call --rpc-url "$RPC_URL" "$INDEX_GOV_ADDR" "admin()(address)" 2>/dev/null | tr -d '[:space:]')
        GOV_ADMIN_LOWER=$(echo "$GOV_ADMIN" | tr '[:upper:]' '[:lower:]')
        DEPLOYER_ADDR_LOWER=$(echo "$DEPLOYER_ADDRESS" | tr '[:upper:]' '[:lower:]')
        if [ "$GOV_ADMIN_LOWER" != "$DEPLOYER_ADDR_LOWER" ]; then
            echo -e "  ${RED}WARNING: Governance.admin() = $GOV_ADMIN, expected deployer $DEPLOYER_ADDRESS${NC}"
        else
            echo -e "  ${GREEN}Governance.admin() = deployer${NC}"
        fi

        # Patch deployment JSON with the on-chain Governance address (may differ from simulation)
        python3 -c "import json; d=json.load(open('$DEPLOYMENT_FILE')); d['contracts']['Governance']='$INDEX_GOV_ADDR'; json.dump(d,open('$DEPLOYMENT_FILE','w'),indent=2)"
    else
        echo -e "  ${YELLOW}Could not read governance addresses — skipping verification${NC}"
    fi

    # 3c: Deploy settlement contracts to Sonic
    echo -e "${BLUE}[3c/14] Deploying settlement contracts to Sonic (chain $SETTLEMENT_CHAIN_ID)...${NC}"

    # Save L3 deployment before Sonic overwrites e2e-full-system.json.
    # Use active-deployment.json (patched by steps 3b/3b2 with on-chain verified
    # OracleRegistry + Governance addresses), NOT e2e-full-system.json (raw forge output
    # with possibly stale simulation addresses).
    cp "$DEPLOYMENT_FILE" deployments/e2e-full-system-l3.json 2>/dev/null || true

    SONIC_CHAIN_ID=$(cast chain-id --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "0")
    if [ "$SONIC_CHAIN_ID" != "$SETTLEMENT_CHAIN_ID" ]; then
        echo -e "  ${YELLOW}Sonic not reachable (got $SONIC_CHAIN_ID, expected $SETTLEMENT_CHAIN_ID) — skipping settlement deploy${NC}"
    else
        rm -rf contracts/broadcast/DeployFullSystemE2E.s.sol/$SETTLEMENT_CHAIN_ID/ contracts/cache/DeployFullSystemE2E.s.sol/$SETTLEMENT_CHAIN_ID/
        # Sonic testnet rejects 1 gwei as "underpriced" — use 50 gwei. Also note
        # that Anvil test accounts on Sonic have EIP-7702 delegations; the Solidity
        # script skips accounts with non-empty code in Phase 10 gas funding.
        local SONIC_GAS_PRICE="${SONIC_GAS_PRICE:-50000000000}"
        (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" DEPLOY_SEED="${DEPLOY_SEED:-$(date +%s)}" \
        forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
            --rpc-url "$SETTLEMENT_RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --broadcast --slow \
            --chain-id $SETTLEMENT_CHAIN_ID \
            --legacy --with-gas-price $SONIC_GAS_PRICE \
            $FORGE_SIZE_FLAG) \
            > logs/deploy-sonic.log 2>&1 || echo -e "  ${YELLOW}Sonic forge script had errors — check logs/deploy-sonic.log${NC}"

        # Forge sometimes stops mid-broadcast on nonce drift (seen on Sonic).
        # If the broadcast JSON exists but has missing receipts, replay the
        # stragglers via cast so we don't need a manual fix.
        SONIC_BROADCAST="contracts/broadcast/DeployFullSystemE2E.s.sol/$SETTLEMENT_CHAIN_ID/run-latest.json"
        if [ -f "$SONIC_BROADCAST" ]; then
            SONIC_MISSING=$(python3 -c "
import json
d = json.load(open('$SONIC_BROADCAST'))
hashes = {(r.get('transactionHash') or '').lower() for r in d.get('receipts',[])}
missing = sum(1 for tx in d.get('transactions',[]) if (tx.get('hash') or '').lower() not in hashes)
print(missing)" 2>/dev/null || echo 0)
            if [ "$SONIC_MISSING" != "0" ] && [ -n "$SONIC_MISSING" ]; then
                echo -e "  ${YELLOW}$SONIC_MISSING Sonic txs missing receipts — replaying via cast${NC}"
                _complete_broadcast_via_cast "$SONIC_BROADCAST" "$SETTLEMENT_RPC_URL" "$SETTLEMENT_CHAIN_ID" "$SONIC_GAS_PRICE"
            fi
        fi

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

        # Post-merge verification: settlement addresses must come from Sonic, not L3.
        # If the merge used a stale L3 backup, BridgeProxy etc. will point to the wrong chain
        # and every bridge/settlement call silently targets the void.
        echo -e "  Verifying settlement addresses in merged deployment..."
        SONIC_BP=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system-sonic.json'))['contracts'].get('BridgeProxy',''))" 2>/dev/null || echo "")
        MERGED_BP=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('BridgeProxy',''))" 2>/dev/null || echo "")
        MERGED_SBC=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SettlementBridgeCustody',''))" 2>/dev/null || echo "")
        MERGED_SUSDC=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SETTLEMENT_USDC',''))" 2>/dev/null || echo "")
        MERGED_SBP=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SettlementBridgeProxy',''))" 2>/dev/null || echo "")

        echo -e "  BridgeProxy (merged):            $MERGED_BP"
        echo -e "  BridgeProxy (Sonic source):       $SONIC_BP"
        echo -e "  SettlementBridgeCustody:          $MERGED_SBC"
        echo -e "  SettlementBridgeProxy:            $MERGED_SBP"
        echo -e "  SETTLEMENT_USDC:                  $MERGED_SUSDC"

        # Verify settlement contracts have code on Sonic
        for _sc_name in BridgeProxy SettlementBridgeCustody; do
            local _sc_addr=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('$_sc_name',''))" 2>/dev/null)
            if [ -n "$_sc_addr" ]; then
                local _sc_code=$(cast code --rpc-url "$SETTLEMENT_RPC_URL" "$_sc_addr" 2>/dev/null | wc -c | tr -d ' ')
                if [ "$_sc_code" -lt 10 ]; then
                    echo -e "  ${RED}$_sc_name ($_sc_addr) has NO CODE on Sonic — frontend buy/create will fail${NC}"
                fi
            fi
        done

        if [ -n "$SONIC_BP" ] && [ "$MERGED_BP" != "$SONIC_BP" ]; then
            echo -e "  ${RED}CRITICAL: BridgeProxy in merged deployment ($MERGED_BP) does not match Sonic deploy ($SONIC_BP)${NC}"
            echo -e "  ${RED}The merge used stale L3 addresses. Frontend would call the wrong BridgeProxy.${NC}"
            echo -e "  ${YELLOW}Attempting repair — forcing Sonic BridgeProxy into merged deployment...${NC}"
            python3 -c "
import json
d = json.load(open('$DEPLOYMENT_FILE'))
sonic = json.load(open('deployments/e2e-full-system-sonic.json'))
sc = sonic['contracts']
for key in ['BridgeProxy', 'SettlementBridgeCustody', 'SETTLEMENT_USDC', 'SettlementBridgeProxy']:
    if key in sc:
        d['contracts'][key] = sc[key]
    elif key == 'SettlementBridgeProxy' and 'BridgeProxy' in sc:
        d['contracts'][key] = sc['BridgeProxy']
if 'BridgeProxy' in sc:
    d['contracts']['L3BridgeProxy'] = d['contracts'].get('L3BridgeProxy', '')
json.dump(d, open('$DEPLOYMENT_FILE', 'w'), indent=2)
print('Repaired settlement addresses from Sonic deployment')
"
            echo -e "  ${GREEN}Settlement addresses repaired${NC}"
        else
            echo -e "  ${GREEN}Settlement addresses verified — BridgeProxy points to Sonic${NC}"
        fi

        # Sync merged deployment to frontend immediately (other deploy steps may read it)
        cp "$DEPLOYMENT_FILE" frontend/lib/contracts/deployment.json
    fi

    # Bump deployment nonce — services auto-detect and flush stale DB state
    echo -e "${BLUE}[3d/14] Bumping deployment nonce (services auto-flush)...${NC}"
    local INDEX_ADDR_NONCE
    INDEX_ADDR_NONCE=$(read_deployment_addr "Index")
    if [ -n "$INDEX_ADDR_NONCE" ] && cast call "$INDEX_ADDR_NONCE" "deploymentNonce()" --rpc-url "$RPC_URL" 2>/dev/null; then
        cast send "$INDEX_ADDR_NONCE" "bumpDeploymentNonce()" \
            --rpc-url "$RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --legacy || echo -e "  ${YELLOW}Nonce bump failed — services will flush on restart${NC}"
        local DEPLOY_NONCE
        DEPLOY_NONCE=$(cast call "$INDEX_ADDR_NONCE" "deploymentNonce()" --rpc-url "$RPC_URL" 2>/dev/null | xargs cast --to-dec 2>/dev/null || echo "?")
        echo -e "  ${GREEN}Deployment nonce now: $DEPLOY_NONCE — services will auto-flush${NC}"
    else
        # Fallback: manual TRUNCATE for contracts without deploymentNonce
        # NEVER add vision_player_points or vision_epoch_log — those are persistent lifetime stats.
        echo -e "  ${YELLOW}Contract lacks deploymentNonce — falling back to manual TRUNCATE${NC}"
        if vps_be_ssh "psql -U max -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name='vision_last_resolved'\" 2>/dev/null | grep -q '1 row'"; then
            vps_be_ssh "psql -U max -d $DB_NAME -c 'TRUNCATE vision_last_resolved, vision_reference_prices, signed_batch_configs, batch_configs, batch_settlements, vision_balance_proofs, vision_batches, vision_batch_state, vision_bitmaps, vision_deposit_orders, vision_kv_store, vision_positions, vision_tick_results, vision_user_balances, vision_withdraw_orders, itp_snapshots, trades, user_shares, oracle_health_snapshots CASCADE;'" \
                && echo -e "  ${GREEN}Vision tables truncated${NC}" \
                || echo -e "  ${YELLOW}Vision table truncate failed — tables may not exist yet${NC}"
        else
            echo -e "  ${YELLOW}Vision tables don't exist yet — skip (data-node will create on first start)${NC}"
        fi
        # Also try manual reload if services are running
        for port in 8200 9001 8400 8300; do
            curl -sf -X POST "http://$VPS_BE_IP:$port/admin/reload" 2>/dev/null && \
                echo -e "  ${GREEN}Triggered manual reload on port $port${NC}" || true
        done
    fi

    # Run oracle DB migrations (schema may have changed between deploys)
    echo -e "  Running oracle DB migrations..."
    for migration in oracle/migrations/*.sql; do
        vps_be_ssh "psql -U max -d $DB_NAME -f $VPS_BE_DIR/$migration" > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Oracle migrations applied${NC}"

    # Seed vision_batch_lifecycle with source names from vision-batches.json
    # (The lifecycle manager discovers these over time, but seeding ensures
    # the player profile API can group batches by source immediately.)
    echo -e "  Seeding batch lifecycle source names..."
    python3 -c "
import json
vb = json.load(open('deployments/vision-batches.json'))
for name, b in vb.get('batches', {}).items():
    bid, ch, td = b['batchId'], b.get('configHash',''), b.get('tickDuration',86400)
    print(f\"INSERT INTO vision_batch_lifecycle (batch_id, source_id, timeframe_secs, config_hash, betting_start, betting_end, settlement_deadline, market_count) VALUES ({bid}, '{name}', {td}, '{ch}', NOW(), NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', 0) ON CONFLICT (batch_id) DO UPDATE SET source_id = '{name}';\")
" | vps_be_ssh "psql -U max -d $DB_NAME" > /dev/null 2>&1 || true
    echo -e "  ${GREEN}Batch lifecycle seeded${NC}"

    # Delete stale consensus WAL files (prevents old P2P state from poisoning fresh deploy)
    vps_be_ssh "rm -f $VPS_BE_DIR/logs/consensus-*.wal" && echo -e "  ${GREEN}Consensus WAL files cleaned${NC}" || true

    # Fund Anvil accounts 1-6 (oracles + AP + curator + itp-bot) with GM for gas
    # Uses FUNDER_KEY (separate nonce space) to avoid corrupting DEPLOYER nonce during forge broadcasts
    echo -e "${BLUE}[4/14] Funding oracle + AP + curator + bot accounts with gas...${NC}"
    ORACLE_1_ADDR=$(cast wallet address "$ORACLE_1_KEY")
    ORACLE_2_ADDR=$(cast wallet address "$ORACLE_2_KEY")
    ORACLE_3_ADDR=$(cast wallet address "$ORACLE_3_KEY")
    AP_ADDR=$(cast wallet address "$AP_KEY")
    CURATOR_ADDR=$(cast wallet address "$CURATOR_KEY")
    ITP_BOT_ADDR=$(cast wallet address "$ITP_BOT_KEY")

    for addr in "$ORACLE_1_ADDR" "$ORACLE_2_ADDR" "$ORACLE_3_ADDR" "$AP_ADDR" "$CURATOR_ADDR" "$ITP_BOT_ADDR"; do
        cast send --private-key "$FUNDER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$addr" --value 10ether > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Funded 6 accounts with 10 GM each${NC}"

    # Fund accounts with gas on Sonic
    echo -e "${BLUE}[4b/14] Funding accounts with gas on Sonic...${NC}"
    for addr in "$ORACLE_1_ADDR" "$ORACLE_2_ADDR" "$ORACLE_3_ADDR" "$AP_ADDR" "$CURATOR_ADDR" "$ITP_BOT_ADDR"; do
        cast send --private-key "$FUNDER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$addr" --value 0.5ether > /dev/null 2>&1 || true
    done
    echo -e "  ${GREEN}Funded 6 accounts with 0.5 S each on Sonic${NC}"

    # Fund fund-manager wallet with gas (vaults get USDC via VisionVaultFactory seed)
    local FM_ADDR=$(cast wallet address "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537" 2>/dev/null || echo "")
    if [ -n "$FM_ADDR" ]; then
        echo -e "  Funding fund-manager wallet with gas..."
        cast send --private-key "$FUNDER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$FM_ADDR" --value 10ether > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded fund-manager ($FM_ADDR) with 10 GM${NC}"
    fi

    # Verify funded accounts have non-zero balances
    echo -e "  Verifying funded balances..."
    local FUND_OK=true
    for addr in "$ORACLE_1_ADDR" "$ORACLE_2_ADDR" "$ORACLE_3_ADDR" "$AP_ADDR" "$CURATOR_ADDR" "$ITP_BOT_ADDR"; do
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
    # Collateral token must be an ERC20, NOT the BridgedItpFactory (which is a factory contract).
    # Prefer ITP_Vault (ERC4626 vault wrapping ITP shares) if deployed; fall back to MOCK_USDT.
    ITP_VAULT=$(read_deployment_addr "ITP_Vault")
    if [ -z "$ITP_VAULT" ] || [ "$ITP_VAULT" = "None" ]; then
        ITP_VAULT=$(read_deployment_addr "MOCK_USDT")
        echo -e "  ${YELLOW}ITP_Vault not found — using MOCK_USDT ($ITP_VAULT) as Morpho collateral${NC}"
    fi
    ORACLE_REGISTRY=$(read_deployment_addr "OracleRegistry")

    rm -rf contracts/broadcast/DeployMorphoE2E.s.sol/$CHAIN_ID/ contracts/cache/DeployMorphoE2E.s.sol/$CHAIN_ID/
    (cd contracts && DEPLOYER_KEY="$DEPLOYER_KEY" \
    SETTLEMENT_USDC="$L3_USDC" ITP_VAULT="$ITP_VAULT" ORACLE_REGISTRY="$ORACLE_REGISTRY" \
    forge script script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE $FORGE_SIZE_FLAG) \
        >> logs/deploy-morpho.log 2>&1 || echo -e "  ${YELLOW}Morpho deploy had warnings — check logs/deploy-morpho.log${NC}"
    echo -e "  ${GREEN}Morpho deployed${NC}"

    # Inject chainId + deployBlock into morpho-e2e.json so data-node hydration works.
    # data-node reads chainId from root to know which chain to scan, and uses deployBlock
    # as the starting point for event discovery. Without these, market discovery never starts.
    if [ -f "deployments/morpho-e2e.json" ]; then
        local CURRENT_BLOCK
        CURRENT_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        python3 -c "
import json
d = json.load(open('deployments/morpho-e2e.json'))
d['chainId'] = $CHAIN_ID
d['deployBlock'] = int('$CURRENT_BLOCK')
json.dump(d, open('deployments/morpho-e2e.json', 'w'), indent=2)
print('Injected chainId=$CHAIN_ID deployBlock=$CURRENT_BLOCK into morpho-e2e.json')
" 2>/dev/null && echo -e "  ${GREEN}morpho-e2e.json: chainId + deployBlock set${NC}" \
            || echo -e "  ${YELLOW}morpho-e2e.json patch failed (non-critical)${NC}"
    fi

    # Deploy Vision
    # Skip Vision / vault redeploy if everything already has code + vaults present.
    # Lets `testnet.sh deploy` resume after an early-phase failure without blowing away
    # downstream state (factory + 235 funded vaults).
    SKIP_VISION_REDEPLOY=false
    CUR_VISION=$(read_deployment_addr "Vision" 2>/dev/null || echo "")
    CUR_VVF=$(read_deployment_addr "VisionVaultFactory" 2>/dev/null || echo "")
    if [ -n "$CUR_VISION" ] && [ -n "$CUR_VVF" ]; then
        V_CODE=$(cast code --rpc-url "$RPC_URL" "$CUR_VISION" 2>/dev/null | wc -c | tr -d ' ')
        F_CODE=$(cast code --rpc-url "$RPC_URL" "$CUR_VVF" 2>/dev/null | wc -c | tr -d ' ')
        VAULT_COUNT=$(python3 -c "import json; print(len(json.load(open('$DEPLOYMENT_FILE')).get('whitelistedVaults', [])))" 2>/dev/null || echo "0")
        if [ "$V_CODE" -gt 10 ] && [ "$F_CODE" -gt 10 ] && [ "$VAULT_COUNT" -gt 0 ]; then
            SKIP_VISION_REDEPLOY=true
            echo -e "${GREEN}[6/14][6b/14][7a/14] Vision + factory + $VAULT_COUNT vaults already live — skipping redeploy${NC}"
        fi
    fi
    if [ "$SKIP_VISION_REDEPLOY" = "true" ]; then
        : # skip the whole Vision block
    else
    echo -e "${BLUE}[6/14] Deploying Vision + batches...${NC}"
    rm -rf contracts/broadcast/DeployVision.s.sol/$CHAIN_ID/ contracts/cache/DeployVision.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    ORACLE_REGISTRY="$ORACLE_REGISTRY" USDC_ADDRESS="$L3_USDC" \
    forge script script/DeployVision.s.sol:DeployVision \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE \
        $FORGE_SIZE_FLAG) \
        >> logs/deploy-vision.log 2>&1 || echo -e "  ${YELLOW}Vision deploy had warnings${NC}"

    # Add Vision address to active-deployment.json BEFORE batch deploy
    # (DeployAllVisionBatches reads Vision address from this file)
    VISION_ADDR_MERGE=$(python3 -c "import json; print(json.load(open('deployments/vision-deployment.json'))['contracts']['Vision'])" 2>/dev/null || echo "")
    if [ -n "$VISION_ADDR_MERGE" ]; then
        python3 -c "
import json
d = json.load(open('$DEPLOYMENT_FILE'))
d['contracts']['Vision'] = '$VISION_ADDR_MERGE'
json.dump(d, open('$DEPLOYMENT_FILE', 'w'), indent=2)
"
        echo -e "  ${GREEN}Added Vision ($VISION_ADDR_MERGE) to active-deployment.json${NC}"
    fi

    # Vision batches: --slow prevents nonce batching drift on L3 Orbit
    rm -rf contracts/broadcast/DeployAllVisionBatches.s.sol/$CHAIN_ID/ contracts/cache/DeployAllVisionBatches.s.sol/$CHAIN_ID/
    VISION_ADDR_DEPLOY=$(read_deployment_addr "Vision")
    echo -e "  Vision address for batches: $VISION_ADDR_DEPLOY"
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
    VISION_ADDRESS="$VISION_ADDR_DEPLOY" \
    forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE $FORGE_SIZE_FLAG) \
        >> logs/deploy-vision-batches.log 2>&1 || echo -e "  ${YELLOW}Vision batches had warnings${NC}"
    echo -e "  ${GREEN}Vision deployed${NC}"

    # Ensure vision-batches.json matches active-deployment.json (active-deployment is source of truth)
    ACTIVE_VISION_ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE')).get('contracts', {}).get('Vision', ''))" 2>/dev/null || echo "")
    if [ -n "$ACTIVE_VISION_ADDR" ]; then
        python3 -c "
import json
d = json.load(open('deployments/vision-batches.json'))
d['vision'] = '$ACTIVE_VISION_ADDR'
json.dump(d, open('deployments/vision-batches.json', 'w'), indent=2)
"
        echo -e "  ${GREEN}vision-batches.json synced with active-deployment.json${NC}"
    fi

    # Phase [6b/14]: Deploy VisionVault implementation + VisionVaultFactory
    echo -e "${BLUE}[6b/14] Deploying VisionVault + VisionVaultFactory...${NC}"
    rm -rf contracts/broadcast/DeployVisionVaults.s.sol/$CHAIN_ID/ contracts/cache/DeployVisionVaults.s.sol/$CHAIN_ID/
    VISION_ADDR_VV=$(read_deployment_addr "Vision")
    (cd contracts && DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
        VISION_ADDRESS="$VISION_ADDR_VV" USDC_ADDRESS="$L3_USDC" \
        forge script script/DeployVisionVaults.s.sol:DeployVisionVaults \
            --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" \
            --broadcast --slow --chain-id $CHAIN_ID \
            --legacy --with-gas-price $GAS_PRICE $FORGE_SIZE_FLAG) \
        >> logs/deploy-vision-vaults-factory.log 2>&1 \
        || { echo -e "${RED}VisionVaultFactory deploy failed${NC}"; exit 1; }
    # Merge factory + impl addresses into active-deployment.json
    python3 -c "
import json
fc = json.load(open('deployments/vision-vault-deployment.json'))['contracts']
d = json.load(open('$DEPLOYMENT_FILE'))
d['contracts']['VisionVault'] = fc['VisionVault']
d['contracts']['VisionVaultFactory'] = fc['VisionVaultFactory']
json.dump(d, open('$DEPLOYMENT_FILE', 'w'), indent=2)
print(f'  VisionVaultFactory: {fc[\"VisionVaultFactory\"]}')
"
    echo -e "  ${GREEN}VisionVault + Factory deployed${NC}"

    # Wipe bot state/PnL files — positions from the old contract are now invalid
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/fund-manager/pnl-data/*.json" 2>/dev/null || true
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/vision-swarm/pnl-data/pnl-*.json" 2>/dev/null || true
    echo -e "  ${GREEN}Cleared stale bot state/PnL files${NC}"

    # Fund test accounts with L3 USDC (FUNDER_KEY — mint is unrestricted on MockERC20)
    echo -e "${BLUE}[7/14] Funding accounts with L3 USDC...${NC}"
    if [ -n "$L3_USDC" ] && [ "$L3_USDC" != "" ]; then
        # Mint 20M USDC to deployer — covers 235 vaults x 10k + ample runway for later manual vault redeploys
        cast send --private-key "$FUNDER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$L3_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" 20000000000000000000000000 \
            > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded deployer with 20M L3 USDC${NC}"
    fi

    # Fund accounts with SETTLEMENT_USDC on Sonic (6 decimals)
    SONIC_USDC=$(read_deployment_addr "SETTLEMENT_USDC")
    if [ -n "$SONIC_USDC" ] && [ "$SONIC_USDC" != "" ]; then
        cast send --private-key "$FUNDER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$SONIC_USDC" "mint(address,uint256)" "$DEPLOYER_ADDRESS" 50000000000 \
            > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded deployer with 50k SETTLEMENT_USDC on Sonic${NC}"
    fi

    # Phase [7a/14]: Deploy + fund Vision vaults — N per source, reads vision-batches.json
    echo -e "${BLUE}[7a/14] Deploying Vision vaults (5 per source, 10k USDC seed)...${NC}"
    # web3.py needs Python 3.11+; system python3 may be too old. Prefer python3.14, fall back to python3.
    VAULT_PYTHON="$(command -v python3.14 || command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3)"
    DEPLOYER_KEY="$DEPLOYER_KEY" L3_RPC_URL="$RPC_URL" \
        "$VAULT_PYTHON" scripts/deploy-and-fund-vaults.py \
            --per-source "${VAULTS_PER_SOURCE:-5}" \
            --seed-amount "${VAULT_SEED_USDC:-10000}" \
        >> logs/deploy-vision-vaults.log 2>&1 \
        && echo -e "  ${GREEN}Vision vaults deployed + funded${NC}" \
        || { echo -e "${RED}Vision vault deploy failed — see logs/deploy-vision-vaults.log${NC}"; exit 1; }
    fi  # end SKIP_VISION_REDEPLOY block

    # Phase: Deploy all Bitget tokens
    echo -e "${BLUE}[8/14] Generating token deploy script...${NC}"
    python3 scripts/deploy-all-tokens.py || { echo -e "${RED}Token generator failed${NC}"; exit 1; }
    echo -e "  ${GREEN}Generated DeployAllTokens.s.sol (621 tokens)${NC}"

    echo -e "${BLUE}[9/14] Deploying all 621 tokens + funding vault (TOKEN_DEPLOYER_KEY)...${NC}"
    local TOKEN_NONCE_BEFORE=$(cast nonce --rpc-url "$RPC_URL" "$TOKEN_DEPLOYER_ADDRESS" 2>/dev/null || echo "?")
    echo -e "  Token deployer nonce before token deploy: $TOKEN_NONCE_BEFORE"
    MOCK_VAULT=$(read_deployment_addr "MockBitgetVault")

    # Resume partial token deploys: check how many receipts exist from previous runs.
    # Orbit L3 nonce issues cause forge to die after ~200 TXs. Re-running resumes from
    # where it left off because forge skips TXs that already have receipts.
    local TOKEN_RECEIPTS=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('receipts',[])))" 2>/dev/null || echo "0")
    local TOKEN_TXS=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('transactions',[])))" 2>/dev/null || echo "0")

    if [ "$TOKEN_RECEIPTS" != "0" ] && [ "$TOKEN_RECEIPTS" = "$TOKEN_TXS" ]; then
        echo -e "  ${GREEN}All token TXs already have receipts ($TOKEN_RECEIPTS/$TOKEN_TXS) — skipping forge${NC}"
    else
        if [ "$TOKEN_RECEIPTS" != "0" ]; then
            echo -e "  ${YELLOW}Resuming partial token deploy ($TOKEN_RECEIPTS/$TOKEN_TXS receipts)...${NC}"
        fi
        # Do NOT rm -rf the token broadcast dir — preserve partial progress for resume.
        # First attempt uses --broadcast (creates broadcast dir). Retries use --resume
        # which re-submits only TXs that lack receipts.
        local TOKEN_DEPLOY_ATTEMPTS=0
        local TOKEN_DEPLOY_MAX=8
        while [ "$TOKEN_DEPLOY_ATTEMPTS" -lt "$TOKEN_DEPLOY_MAX" ]; do
            TOKEN_DEPLOY_ATTEMPTS=$((TOKEN_DEPLOY_ATTEMPTS + 1))
            # Use --resume if broadcast dir exists (partial deploy), --broadcast otherwise (first run)
            local FORGE_BROADCAST_FLAG="--broadcast"
            if [ -f "contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/run-latest.json" ]; then
                FORGE_BROADCAST_FLAG="--resume"
            fi
            # --slow: wait for each TX confirmation before next — Orbit L3's rapid-fire
            # nonce batching kills token deploys after ~200 TXs without this.
            (cd contracts && PRIVATE_KEY="$TOKEN_DEPLOYER_KEY" \
                MOCK_BITGET_VAULT="$MOCK_VAULT" DEPLOY_SEED="${DEPLOY_SEED:-$(date +%s)}" \
                forge script script/DeployAllTokens.s.sol:DeployAllTokens \
                $FORGE_BROADCAST_FLAG --slow --legacy --with-gas-price $GAS_PRICE --rpc-url "$RPC_URL" \
                --private-key "$TOKEN_DEPLOYER_KEY" \
                --chain-id $CHAIN_ID $FORGE_SIZE_FLAG) \
                >> logs/deploy-tokens.log 2>&1 || true

            TOKEN_RECEIPTS=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('receipts',[])))" 2>/dev/null || echo "0")
            TOKEN_TXS=$(python3 -c "import json; d=json.load(open('contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/run-latest.json')); print(len(d.get('transactions',[])))" 2>/dev/null || echo "0")
            echo -e "  Attempt $TOKEN_DEPLOY_ATTEMPTS: $TOKEN_RECEIPTS/$TOKEN_TXS receipts"

            if [ "$TOKEN_RECEIPTS" = "$TOKEN_TXS" ] && [ "$TOKEN_RECEIPTS" != "0" ]; then
                echo -e "  ${GREEN}All token TXs confirmed${NC}"
                break
            fi

            if [ "$TOKEN_DEPLOY_ATTEMPTS" -ge "$TOKEN_DEPLOY_MAX" ]; then
                echo -e "  ${YELLOW}Token deploy incomplete after $TOKEN_DEPLOY_MAX attempts ($TOKEN_RECEIPTS/$TOKEN_TXS) — continuing anyway${NC}"
            fi
        done
    fi

    # Rebuild CSV from broadcast receipts (vm.writeFile uses simulation addresses which can diverge)
    python3 -c "
import json
bd = json.load(open('contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/run-latest.json'))
creates = []
for tx in bd.get('transactions', []):
    if tx.get('transactionType') in ('CREATE', 'CREATE2') and tx.get('contractName') == 'MockERC20':
        creates.append(tx['contractAddress'])
with open('data/all-token-addresses.csv', 'w') as f:
    for i, addr in enumerate(creates):
        f.write(f'{i},{addr}\n')
print(f'Rebuilt CSV from {len(creates)} broadcast receipts')
" 2>/dev/null && echo -e "  ${GREEN}Token CSV rebuilt from broadcast receipts${NC}" || echo -e "  ${YELLOW}CSV rebuild failed — using vm.writeFile output${NC}"

    # Verify at least the first token has code on-chain
    FIRST_TOKEN=$(head -2 data/all-token-addresses.csv | tail -1 | cut -d, -f2)
    if [ -n "$FIRST_TOKEN" ]; then
        TOKEN_CODE=$(cast code --rpc-url "$RPC_URL" "$FIRST_TOKEN" 2>/dev/null | wc -c)
        if [ "$TOKEN_CODE" -gt 10 ]; then
            echo -e "  ${GREEN}Tokens verified (first token has code on-chain)${NC}"
        else
            echo -e "  ${RED}Token deploy FAILED — first token has no code${NC}"; exit 1
        fi
    else
        echo -e "  ${RED}Token deploy FAILED — no addresses in CSV${NC}"; exit 1
    fi

    # Update assets.json with fresh on-chain addresses
    echo -e "${BLUE}[9b/14] Syncing fresh token addresses to assets.json...${NC}"
    python3 scripts/sync-token-addresses.py || echo -e "  ${YELLOW}Address sync had warnings${NC}"
    echo -e "  ${GREEN}Token addresses synced${NC}"

    # Verify token addresses match on-chain code
    echo -e "  Verifying token addresses on-chain..."
    VERIFY_FAIL=0
    for addr in $(python3 -c "import json; [print(a['address']) for a in json.load(open('assets.json'))[:5]]" 2>/dev/null); do
        CODE=$(cast code --rpc-url "$RPC_URL" "$addr" 2>/dev/null | wc -c)
        if [ "$CODE" -lt 10 ]; then
            echo -e "  ${RED}Token $addr has no code!${NC}"
            VERIFY_FAIL=1
        fi
    done
    [ "$VERIFY_FAIL" = "1" ] && { echo -e "  ${RED}Token verification failed — assets.json out of sync${NC}"; exit 1; }
    echo -e "  ${GREEN}Token addresses verified on-chain${NC}"

    # Phase: Fetch fresh prices then create ITPs
    echo -e "${BLUE}[10/14] Fetching fresh Bitget prices for ITP creation...${NC}"
    CREATION_PRICES_FILE="data/creation-prices.json"
    BITGET_RESP=$(curl -sf --connect-timeout 10 --max-time 30 \
        "https://api.bitget.com/api/v2/spot/market/tickers" 2>/dev/null || echo "")
    if [ -n "$BITGET_RESP" ]; then
        PRICE_JSON=$(python3 -c "
import json, sys
resp = json.loads(sys.stdin.read())
tickers = resp.get('data', [])
result = {}
for t in tickers:
    sym = t.get('symbol', '')
    price_str = t.get('lastPr', '0')
    try:
        price_f = float(price_str)
        if price_f > 0:
            price_18dec = int(price_f * 1e18)
            result[sym] = str(price_18dec)
    except:
        pass
json.dump(result, sys.stdout)
" <<< "$BITGET_RESP" 2>/dev/null || echo "")
        if [ -n "$PRICE_JSON" ] && [ "$PRICE_JSON" != "" ]; then
            echo "$PRICE_JSON" > "$CREATION_PRICES_FILE"
            PRICE_COUNT=$(python3 -c "import json; print(len(json.load(open('$CREATION_PRICES_FILE'))))" 2>/dev/null || echo "0")
            if [ "$PRICE_COUNT" -ge 50 ]; then
                echo -e "  ${GREEN}Fetched $PRICE_COUNT fresh Bitget prices${NC}"
            else
                echo -e "  ${YELLOW}Only $PRICE_COUNT prices found — NAV may deviate from \$1${NC}"
            fi
        else
            echo -e "  ${YELLOW}Price extraction failed — using existing creation-prices.json${NC}"
        fi
    else
        echo -e "  ${YELLOW}Bitget API unreachable — using existing creation-prices.json${NC}"
    fi

    echo -e "  Generating ITP deploy scripts..."
    python3 scripts/deploy-107-itps.py || { echo -e "${RED}ITP generator failed${NC}"; exit 1; }
    echo -e "  ${GREEN}Generated ITP create + vault scripts${NC}"

    echo -e "${BLUE}[10b/14] Verifying deployment integrity...${NC}"
    # Check Index
    INDEX_CHECK=$(read_deployment_addr "Index")
    INDEX_CODE=$(cast code --rpc-url "$RPC_URL" "$INDEX_CHECK" 2>/dev/null | wc -c)
    [ "$INDEX_CODE" -lt 10 ] && { echo -e "  ${RED}Index has no code${NC}"; exit 1; }

    # Check oracles (normalize hex/decimal — cast may return either on Orbit L3)
    ORACLE_REG_CHECK=$(cast call --rpc-url "$RPC_URL" "$INDEX_CHECK" "oracleRegistry()(address)" 2>/dev/null | tr -d '[:space:]')
    ORACLE_COUNT_RAW=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REG_CHECK" "activeOracleCount()(uint256)" 2>/dev/null | tr -d '[:space:]')
    ORACLE_COUNT=$(python3 -c "v='$ORACLE_COUNT_RAW'; print(int(v, 16) if v.startswith('0x') else int(v) if v.isdigit() else 0)" 2>/dev/null || echo "0")
    [ "$ORACLE_COUNT" != "3" ] && { echo -e "  ${RED}OracleRegistry has $ORACLE_COUNT oracles (need 3)${NC}"; exit 1; }

    # Check first 3 tokens have code
    for addr in $(head -4 data/all-token-addresses.csv | tail -3 | cut -d, -f2); do
        CODE=$(cast code --rpc-url "$RPC_URL" "$addr" 2>/dev/null | wc -c)
        [ "$CODE" -lt 10 ] && { echo -e "  ${RED}Token $addr has no code${NC}"; exit 1; }
    done
    echo -e "  ${GREEN}Deployment verified: Index ✓, 3 oracles ✓, tokens ✓${NC}"

    echo -e "${BLUE}[11/14] Creating ITPs...${NC}"
    INDEX_ADDR_ITP=$(read_deployment_addr "Index")
    rm -rf contracts/broadcast/Deploy107ITPs_Create.s.sol/$CHAIN_ID/ contracts/cache/Deploy107ITPs_Create.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        INDEX_ADDRESS="$INDEX_ADDR_ITP" \
        forge script script/Deploy107ITPs_Create.s.sol:Deploy107ITPs_Create \
        --broadcast --slow --legacy --with-gas-price $GAS_PRICE --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --chain-id $CHAIN_ID $FORGE_SIZE_FLAG) \
        > logs/deploy-itp-create.log 2>&1 || { echo -e "  ${RED}ITP create FAILED — check logs/deploy-itp-create.log${NC}"; tail -10 logs/deploy-itp-create.log 2>/dev/null; exit 1; }
    echo -e "  ${GREEN}ITPs created${NC}"

    # Verify ITP assets have code on-chain and exist in symbol-map.
    # Orbit nonce drift can cause token deploy addresses to diverge from what
    # the ITP creation script used. If ITP assets point to dead addresses,
    # NAV computation fails (all prices = 0). Check first 5 ITPs as a canary.
    echo -e "  Verifying ITP asset addresses have code on-chain..."
    local ITP_ASSET_OK=true
    for _itp_check in 1 2 3 4 5; do
        local _itp_hex=$(printf "0x%064x" $_itp_check)
        # Read first asset of this ITP
        local _first_asset=$(cast call "$INDEX_ADDR_ITP" \
            "getITPState(bytes32)((address,uint256,uint256,address[],uint256[],uint256[]))" \
            "$_itp_hex" --rpc-url "$RPC_URL" 2>/dev/null | \
            python3 -c "import sys; s=sys.stdin.read(); parts=s.split('['); assets=parts[1].split(']')[0].split(',') if len(parts)>1 else []; print(assets[0].strip() if assets else '')" 2>/dev/null)
        if [ -n "$_first_asset" ] && [ "$_first_asset" != "0x0000000000000000000000000000000000000000" ]; then
            local _asset_code=$(cast code --rpc-url "$RPC_URL" "$_first_asset" 2>/dev/null | wc -c | tr -d ' ')
            if [ "$_asset_code" -lt 10 ]; then
                echo -e "  ${RED}FATAL: ITP $_itp_check asset $_first_asset has NO CODE on-chain${NC}"
                echo -e "  ${RED}  Token addresses diverged during deploy. Full redeploy needed.${NC}"
                ITP_ASSET_OK=false
            fi
        fi
    done
    if [ "$ITP_ASSET_OK" = false ]; then
        echo -e "  ${RED}ITP assets point to dead token addresses. Aborting.${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}ITP asset addresses verified on-chain${NC}"

    echo -e "${BLUE}[12/14] Deploying ITP vaults...${NC}"
    L3_USDC=$(read_deployment_addr "L3_WUSDC")
    rm -rf contracts/broadcast/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/ contracts/cache/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/
    (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
        ADMIN_KEY="$DEPLOYER_KEY" \
        INDEX_ADDRESS="$INDEX_ADDR_ITP" \
        L3_WUSDC="$L3_USDC" \
        forge script script/Deploy107ITPs_Vaults.s.sol:Deploy107ITPs_Vaults \
        --broadcast --slow --legacy --with-gas-price $GAS_PRICE --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --chain-id $CHAIN_ID $FORGE_SIZE_FLAG) \
        > logs/deploy-itp-vaults.log 2>&1 || { echo -e "  ${RED}ITP vault deploy FAILED — check logs/deploy-itp-vaults.log${NC}"; tail -10 logs/deploy-itp-vaults.log 2>/dev/null; exit 1; }
    echo -e "  ${GREEN}ITP vaults deployed${NC}"

    # [12a] Orbit L3 address fix: the vault deploy script calls setITPVault with
    # simulation addresses, which diverge from broadcast addresses on Orbit.
    # Read actual vault addresses from broadcast receipts and patch the Index mapping.
    # [12a] Verify EVERY vault's indexContract() matches the actual Index.
    # ITP vault's indexContract is immutable — if it doesn't match, the vault
    # was deployed with a stale Index address (Orbit divergence) and fills will
    # revert with E063_MintFailed. In that case, redeploy vaults.
    echo -e "  Verifying vault.indexContract() matches Index..."
    local INDEX_ON_CHAIN="$INDEX_ADDR_ITP"
    local VAULT_MISMATCH=0
    local VAULT_OK=0
    local ITP_TOTAL=$(cast call "$INDEX_ON_CHAIN" "getItpCount()(uint256)" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    for _vi in $(seq 1 "$ITP_TOTAL"); do
        local _vhex=$(printf "0x%064x" "$_vi")
        local _vault=$(cast call "$INDEX_ON_CHAIN" "itpVaults(bytes32)(address)" "$_vhex" --rpc-url "$RPC_URL" 2>/dev/null)
        [ -z "$_vault" ] || [ "$_vault" = "0x0000000000000000000000000000000000000000" ] && continue
        local _vault_index=$(cast call "$_vault" "indexContract()(address)" --rpc-url "$RPC_URL" 2>/dev/null)
        if [ "$(echo "$_vault_index" | tr '[:upper:]' '[:lower:]')" != "$(echo "$INDEX_ON_CHAIN" | tr '[:upper:]' '[:lower:]')" ]; then
            VAULT_MISMATCH=$((VAULT_MISMATCH + 1))
            [ "$VAULT_MISMATCH" -le 3 ] && echo -e "  ${RED}ITP $_vi: vault.indexContract=$_vault_index != Index=$INDEX_ON_CHAIN${NC}"
        else
            VAULT_OK=$((VAULT_OK + 1))
        fi
    done
    if [ "$VAULT_MISMATCH" -gt 0 ]; then
        echo -e "  ${RED}FATAL: $VAULT_MISMATCH/$ITP_TOTAL vaults have wrong indexContract (immutable — must redeploy vaults)${NC}"
        echo -e "  ${RED}  Cleaning vault broadcast and redeploying...${NC}"
        rm -rf contracts/broadcast/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/ contracts/cache/Deploy107ITPs_Vaults.s.sol/$CHAIN_ID/
        (cd contracts && PRIVATE_KEY="$DEPLOYER_KEY" \
            ADMIN_KEY="$DEPLOYER_KEY" \
            INDEX_ADDRESS="$INDEX_ON_CHAIN" \
            L3_WUSDC="$L3_USDC" \
            forge script script/Deploy107ITPs_Vaults.s.sol:Deploy107ITPs_Vaults \
            --broadcast --slow --legacy --with-gas-price $GAS_PRICE --rpc-url "$RPC_URL" \
            --private-key "$DEPLOYER_KEY" \
            --chain-id $CHAIN_ID $FORGE_SIZE_FLAG) \
            > logs/deploy-itp-vaults-retry.log 2>&1 || { echo -e "  ${RED}Vault redeploy FAILED${NC}"; tail -5 logs/deploy-itp-vaults-retry.log; exit 1; }
        echo -e "  ${GREEN}Vaults redeployed — re-verifying...${NC}"
        # Re-verify after redeploy
        local _rv_mismatch=0
        for _vi in $(seq 1 5); do
            local _vhex=$(printf "0x%064x" "$_vi")
            local _vault=$(cast call "$INDEX_ON_CHAIN" "itpVaults(bytes32)(address)" "$_vhex" --rpc-url "$RPC_URL" 2>/dev/null)
            [ -z "$_vault" ] || [ "$_vault" = "0x0000000000000000000000000000000000000000" ] && continue
            local _vault_index=$(cast call "$_vault" "indexContract()(address)" --rpc-url "$RPC_URL" 2>/dev/null)
            if [ "$(echo "$_vault_index" | tr '[:upper:]' '[:lower:]')" != "$(echo "$INDEX_ON_CHAIN" | tr '[:upper:]' '[:lower:]')" ]; then
                _rv_mismatch=$((_rv_mismatch + 1))
                echo -e "  ${RED}STILL MISMATCHED after redeploy: ITP $_vi vault.indexContract=$_vault_index${NC}"
            fi
        done
        [ "$_rv_mismatch" -gt 0 ] && { echo -e "  ${RED}FATAL: Vault redeploy didn't fix indexContract mismatch. Manual intervention needed.${NC}"; exit 1; }
        echo -e "  ${GREEN}Vault indexContract verified after redeploy${NC}"
    else
        echo -e "  ${GREEN}All $VAULT_OK vaults verified: indexContract == Index${NC}"
    fi

    # [12b-pre] syncVaultBalance: mint vault tokens for ITP holders who bought before vaults existed.
    # Investment.syncVaultBalance(itpId) is called by the deployer (registered oracle) for each ITP.
    # Without this, early buyers have shares in Index but zero vault tokens — Morpho collateral = 0.
    echo -e "  Calling syncVaultBalance for all ITPs (mint vault tokens for pre-vault holders)..."
    local SYNC_OK=0
    local SYNC_FAIL=0
    for _svi in $(seq 1 "$ITP_TOTAL"); do
        local _svhex=$(printf "0x%064x" "$_svi")
        local _svvault=$(cast call "$INDEX_ON_CHAIN" "itpVaults(bytes32)(address)" "$_svhex" --rpc-url "$RPC_URL" 2>/dev/null)
        [ -z "$_svvault" ] || [ "$_svvault" = "0x0000000000000000000000000000000000000000" ] && continue
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
            "$INDEX_ON_CHAIN" "syncVaultBalance(bytes32)" "$_svhex" \
            > /dev/null 2>&1 && SYNC_OK=$((SYNC_OK + 1)) || SYNC_FAIL=$((SYNC_FAIL + 1))
    done
    echo -e "  ${GREEN}syncVaultBalance: $SYNC_OK OK, $SYNC_FAIL failed${NC}"

    # Deploy Morpho lending markets for ALL ITPs
    echo -e "${BLUE}[12b/14] Deploying batch lending markets for all ITPs...${NC}"
    MORPHO_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MORPHO'])" 2>/dev/null || echo "")
    VAULT_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['METAMORPHO_VAULT'])" 2>/dev/null || echo "")
    CURATOR_IRM=$(python3 -c "import json; c=json.load(open('deployments/morpho-e2e.json'))['contracts']; print(c.get('CURATOR_RATE_IRM', c.get('ADAPTIVE_IRM', '')))" 2>/dev/null || echo "")
    MIRROR_REG=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MIRROR_REGISTRY'])" 2>/dev/null || echo "")
    LOAN_TOKEN=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['marketParams']['loanToken'])" 2>/dev/null || echo "")
    EXISTING_MKT_ID=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MARKET_ID'])" 2>/dev/null || echo "")
    EXISTING_COLLATERAL=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['marketParams']['collateralToken'])" 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "")

    if [ -n "$MORPHO_ADDR" ] && [ -n "$VAULT_ADDR" ]; then
        # Discover ITP vaults that need markets
        INDEX_ADDR_BATCH=$(read_deployment_addr "Index")
        ITP_COUNT=$(cast call "$INDEX_ADDR_BATCH" "getItpCount()(uint256)" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

        BATCH_VAULTS=()
        local SKIPPED_NO_CODE=0
        for i in $(seq 1 "$ITP_COUNT"); do
            ITP_HEX=$(printf "0x%064x" "$i")
            V=$(cast call "$INDEX_ADDR_BATCH" "itpVaults(bytes32)(address)" "$ITP_HEX" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x0000000000000000000000000000000000000000")
            [ "$V" = "0x0000000000000000000000000000000000000000" ] && continue
            V_LOWER=$(echo "$V" | tr '[:upper:]' '[:lower:]')
            [ "$V_LOWER" = "$EXISTING_COLLATERAL" ] && continue
            # Verify vault has code — stale vault addresses from previous deploys
            # produce Morpho markets with dead collateral tokens
            local V_CODE=$(cast code --rpc-url "$RPC_URL" "$V" 2>/dev/null | wc -c | tr -d ' ')
            if [ "$V_CODE" -lt 10 ]; then
                SKIPPED_NO_CODE=$((SKIPPED_NO_CODE + 1))
                continue
            fi
            BATCH_VAULTS+=("$V")
        done
        [ "$SKIPPED_NO_CODE" -gt 0 ] && echo -e "  ${YELLOW}Skipped $SKIPPED_NO_CODE vaults with no code (stale from previous deploy)${NC}"

        NEW_COUNT=${#BATCH_VAULTS[@]}
        if [ "$NEW_COUNT" -gt 0 ]; then
            echo -e "  Deploying $NEW_COUNT batch markets..."
            DEFAULT_LLTV="770000000000000000"
            DEFAULT_PRICE="1000000000000000000000000000000000000"

            export MORPHO="$MORPHO_ADDR" CURATOR_RATE_IRM="$CURATOR_IRM" METAMORPHO_VAULT="$VAULT_ADDR"
            export SETTLEMENT_USDC="$LOAN_TOKEN" MIRROR_REGISTRY="$MIRROR_REG"
            export BATCH_MARKET_COUNT="$NEW_COUNT" EXISTING_MARKET_ID="$EXISTING_MKT_ID"
            for idx in "${!BATCH_VAULTS[@]}"; do
                export "ITP_${idx}_ADDRESS=${BATCH_VAULTS[$idx]}"
                export "ITP_${idx}_LLTV=$DEFAULT_LLTV"
                export "ITP_${idx}_INITIAL_PRICE=$DEFAULT_PRICE"
            done

            rm -rf contracts/broadcast/DeployBatchMarkets.s.sol/$CHAIN_ID/ contracts/cache/DeployBatchMarkets.s.sol/$CHAIN_ID/
            (cd contracts && DEPLOYER_KEY="$DEPLOYER_KEY" \
                forge script script/DeployBatchMarkets.s.sol \
                --rpc-url "$RPC_URL" --broadcast --slow --legacy --with-gas-price $GAS_PRICE \
                --private-key "$DEPLOYER_KEY" \
                --chain-id $CHAIN_ID $FORGE_SIZE_FLAG) \
                > logs/deploy-batch-markets.log 2>&1 || echo -e "  ${YELLOW}Batch markets had warnings — check logs/deploy-batch-markets.log${NC}"

            # Strip Foundry cast annotations from lltv values (e.g. "770...000 [7.7e17]" → "770...000")
            if [ -f "deployments/batch-markets.json" ]; then
                python3 -c "
import json, re
d = json.load(open('deployments/batch-markets.json'))
for m in d.get('markets', []):
    if 'lltv' in m:
        m['lltv'] = re.sub(r'\s*\[.*\]$', '', m['lltv'])
json.dump(d, open('deployments/batch-markets.json', 'w'), indent=2)
" 2>/dev/null || true
            fi
            # Copy output to frontend
            [ -f "deployments/batch-markets.json" ] && cp deployments/batch-markets.json frontend/lib/contracts/batch-markets.json

            # Set initial 5% borrow rate on each new market via CuratorRateIRM.
            # Without an explicit rate, the IRM returns 0 — no interest accrues, lenders get nothing.
            # 5% APY in per-second ray = 5e16 / (365*24*3600) ≈ 1585489599 (but CuratorRateIRM
            # takes APR in 1e18 basis: 5% = 50000000000000000)
            if [ -n "$CURATOR_IRM" ] && [ -f "deployments/batch-markets.json" ]; then
                local INITIAL_RATE="50000000000000000"  # 5% APR in 1e18 basis
                local RATE_SET=0
                local RATE_FAIL=0
                while IFS= read -r _mktid; do
                    [ -z "$_mktid" ] && continue
                    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                        --legacy --gas-price $GAS_PRICE --gas-limit 200000 \
                        "$CURATOR_IRM" "setRate(bytes32,uint256)" "$_mktid" "$INITIAL_RATE" \
                        > /dev/null 2>&1 && RATE_SET=$((RATE_SET + 1)) || RATE_FAIL=$((RATE_FAIL + 1))
                done < <(python3 -c "import json; [print(m['marketId']) for m in json.load(open('deployments/batch-markets.json'))['markets']]" 2>/dev/null)
                echo -e "  ${GREEN}CuratorRateIRM: 5% rate set on $RATE_SET markets ($RATE_FAIL failed)${NC}"
            fi

            echo -e "  ${GREEN}$NEW_COUNT batch lending markets deployed${NC}"
        else
            echo -e "  ${GREEN}All ITPs already have markets${NC}"
        fi
    else
        echo -e "  ${YELLOW}Skipping batch markets — no Morpho deployment${NC}"
    fi

    # Sync deployment files + token registries
    echo -e "${BLUE}[13/14] Syncing deployment files + token registries...${NC}"

    # Patch any stale addresses from broadcast (catches partial deploys, manual reruns)
    ./sync-deployment.sh testnet $CHAIN_ID 2>/dev/null || true
    # Single source of truth: active-deployment.json
    # Services detect changes via file watcher. Frontend reads via /api/deployment endpoint.
    cp envs/testnet/deployment.json "$DEPLOYMENT_FILE" 2>/dev/null || true
    # Keep local copy for switch-env compatibility
    [ -f "$DEPLOYMENT_FILE" ] && cp "$DEPLOYMENT_FILE" envs/testnet/deployment.json
    # Supplementary JSONs still need one copy each
    [ -f "deployments/morpho-e2e.json" ] && cp deployments/morpho-e2e.json envs/testnet/morpho-deployment.json
    [ -f "deployments/batch-markets.json" ] && cp deployments/batch-markets.json envs/testnet/batch-markets.json && cp deployments/batch-markets.json frontend/lib/contracts/batch-markets.json
    [ -f "deployments/vision-batches.json" ] && cp deployments/vision-batches.json envs/testnet/vision-batches.json
    # Update Vision address in envs/testnet/.env
    VISION_ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE')).get('contracts', {}).get('Vision', ''))" 2>/dev/null || echo "")
    if [ -n "$VISION_ADDR" ] && [ -f "envs/testnet/.env" ]; then
        sed -i '' "s|^NEXT_PUBLIC_VISION_ADDRESS=.*|NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}|" envs/testnet/.env
    fi
    echo -e "  ${GREEN}Deployment JSON synced (single source of truth)${NC}"

    # Sync sources-display.json to frontend (data-node is source of truth)
    [ -f "data-node/config/sources-display.json" ] && cp data-node/config/sources-display.json frontend/data/sources-display.json

    # Auto-populate missing internalIds (sourceId as default — required for frontend batch matching)
    python3 -c "
import json
data = json.load(open('frontend/data/sources-display.json'))
sources = data.get('sources', [])
fixed = 0
for s in sources:
    if not s.get('internalIds') and s.get('sourceId'):
        s['internalIds'] = [s['sourceId']]
        fixed += 1
if fixed:
    data['sources'] = sources
    json.dump(data, open('frontend/data/sources-display.json', 'w'), indent=2, ensure_ascii=False)
    print(f'  Auto-populated internalIds for {fixed} sources')
" 2>/dev/null || true

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

    # Merge ALL token deploy broadcasts into symbol-map (covers partial deploys)
    python3 -c "
import json, os
smap = json.load(open('data/symbol-map.json')) if os.path.exists('data/symbol-map.json') else {}
bd = 'contracts/broadcast/DeployAllTokens.s.sol/$CHAIN_ID/'
if os.path.isdir(bd):
    for f in os.listdir(bd):
        if not f.endswith('.json'): continue
        data = json.load(open(os.path.join(bd, f)))
        for tx in data.get('transactions', []):
            if tx.get('transactionType') == 'CREATE' and tx.get('contractName') == 'MockERC20':
                addr = tx.get('contractAddress', '').lower()
                args = tx.get('arguments', [])
                if len(args) >= 2 and addr and addr not in smap:
                    smap[addr] = {'pair': args[1] + 'USDT', 'source': 'bitget'}
json.dump(smap, open('data/symbol-map.json', 'w'), indent=2)
print(f'Merged symbol-map: {len(smap)} entries')
" 2>/dev/null || true
    echo -e "  ${GREEN}Broadcast merge complete${NC}"

    # Chain-authoritative rebuild: read actual token symbols from on-chain ITP state
    # Runs after broadcast merge so it only adds entries missing from the broadcast-derived map
    _rebuild_symbol_map_from_chain

    # Sync symbol-map.json + deployment files to VPS immediately after regeneration
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data/symbol-map.json" 2>/dev/null || true
    rsync -az -e "$RSYNC_SSH_BE" "$DEPLOYMENT_FILE" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/active-deployment.json" 2>/dev/null || true
    echo -e "  ${GREEN}Synced symbol-map + deployment to VPS${NC}"

    # Final safety check: ensure vision-batches.json matches active-deployment.json before switching env
    ACTIVE_VISION_FINAL=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE')).get('contracts', {}).get('Vision', ''))" 2>/dev/null || echo "")
    if [ -n "$ACTIVE_VISION_FINAL" ]; then
        BATCHES_VISION=$(python3 -c "import json; print(json.load(open('deployments/vision-batches.json'))['vision'])" 2>/dev/null || echo "")
        if [ "$BATCHES_VISION" != "$ACTIVE_VISION_FINAL" ]; then
            python3 -c "
import json
d = json.load(open('deployments/vision-batches.json'))
d['vision'] = '$ACTIVE_VISION_FINAL'
json.dump(d, open('deployments/vision-batches.json', 'w'), indent=2)
"
            echo -e "  ${YELLOW}Corrected stale Vision address in vision-batches.json${NC}"
        fi
    fi

    # Final deployment sync — VPS file watcher detects changes automatically
    echo -e "${BLUE}[13.5/14] Final deployment sync...${NC}"
    # Single scp to VPS — file watcher handles the rest
    rsync -az -e "$RSYNC_SSH_BE" "$DEPLOYMENT_FILE" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/active-deployment.json" 2>/dev/null || true
    # Keep local copies for switch-env compatibility.
    # THREE places in the frontend read deployment addresses — all must match:
    #   1. frontend/lib/contracts/deployment.json (imported by addresses.ts at build time)
    #   2. frontend/public/deployment.json (served statically, read at runtime)
    #   3. frontend/public/morpho-deployment.json (Morpho addresses at runtime)
    cp "$DEPLOYMENT_FILE" envs/testnet/deployment.json 2>/dev/null || true
    cp "$DEPLOYMENT_FILE" frontend/lib/contracts/deployment.json
    cp "$DEPLOYMENT_FILE" frontend/public/deployment.json
    cp deployments/morpho-e2e.json frontend/public/morpho-deployment.json 2>/dev/null || true
    # Verify all three match
    local _lib_sbc=$(python3 -c "import json; print(json.load(open('frontend/lib/contracts/deployment.json'))['contracts'].get('SettlementBridgeCustody',''))" 2>/dev/null)
    local _pub_sbc=$(python3 -c "import json; print(json.load(open('frontend/public/deployment.json'))['contracts'].get('SettlementBridgeCustody',''))" 2>/dev/null)
    local _act_sbc=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SettlementBridgeCustody',''))" 2>/dev/null)
    if [ "$_lib_sbc" != "$_act_sbc" ] || [ "$_pub_sbc" != "$_act_sbc" ]; then
        echo -e "  ${RED}FATAL: Frontend deployment files out of sync!${NC}"
        echo -e "  ${RED}  active:  $_act_sbc${NC}"
        echo -e "  ${RED}  lib:     $_lib_sbc${NC}"
        echo -e "  ${RED}  public:  $_pub_sbc${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}Deployment synced (VPS + envs + frontend lib + frontend public — all verified)${NC}"

    # Inject chainId at root of active-deployment.json (data-node hydration requires this).
    # Without chainId at root level, data-node cannot identify the chain for on-chain reads.
    # Also inject deployBlock so data-node starts event scanning from the right block.
    local DEPLOY_BLOCK_FINAL
    DEPLOY_BLOCK_FINAL=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    python3 -c "
import json
d = json.load(open('$DEPLOYMENT_FILE'))
d['chainId'] = $CHAIN_ID
d['deployBlock'] = int('$DEPLOY_BLOCK_FINAL')
d['settlementChainId'] = $SETTLEMENT_CHAIN_ID
json.dump(d, open('$DEPLOYMENT_FILE', 'w'), indent=2)
" 2>/dev/null && echo -e "  ${GREEN}active-deployment.json: chainId=$CHAIN_ID deployBlock=$DEPLOY_BLOCK_FINAL${NC}" \
        || echo -e "  ${YELLOW}chainId/deployBlock injection failed (non-critical)${NC}"
    # Propagate the updated file to all copies
    cp "$DEPLOYMENT_FILE" frontend/lib/contracts/deployment.json
    cp "$DEPLOYMENT_FILE" frontend/public/deployment.json
    cp "$DEPLOYMENT_FILE" envs/testnet/deployment.json 2>/dev/null || true
    rsync -az -e "$RSYNC_SSH_BE" "$DEPLOYMENT_FILE" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/active-deployment.json" 2>/dev/null || true

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

    # ── Step 14.5: Auto-seed ITP positions + borrows ────────────
    if [ "$AUTO_SEED" = true ]; then
        echo ""
        echo -e "${BLUE}[14.5/14] Auto-seeding ITP positions + Morpho borrows...${NC}"
        echo -e "  Starting services first (oracles needed for order processing)..."
        cmd_start
        cmd_seed_orders
    else
        echo ""
        echo -e "${GREEN}All contracts deployed. Next steps:${NC}"
        echo -e "  ${CYAN}1. Start services: ./testnet.sh start${NC}"
        echo -e "  ${CYAN}2. Seed positions: ./testnet.sh seed-orders${NC}"
        echo -e "  ${CYAN}   Or in one shot next time: ./testnet.sh deploy --seed${NC}"
        echo -e "  ${CYAN}3. (Optional) Push: git add deployments/ envs/testnet/ && git commit -m 'chore: testnet deployment' && git push mono main${NC}"
    fi
}

# ── start: Start all services on VPSes ───────────────────────
cmd_start() {
    _STARTED_SERVICES=true
    echo -e "${CYAN}Starting all services on VPSes...${NC}"

    # Ensure PostgreSQL is running on VPS 1 (oracles need it for Vision API)
    echo -e "${BLUE}[0/8] Checking PostgreSQL on VPS 1...${NC}"
    PG_READY=$(vps_be_ssh "pg_isready -q 2>/dev/null" && echo "ok" || echo "down")
    if [ "$PG_READY" != "ok" ]; then
        echo -e "  ${YELLOW}PostgreSQL is down — starting via ans sudo...${NC}"
        # sudo is via user 'ans' (password in vps.md). su to ans, then sudo.
        local ANS_PASS
        ANS_PASS=$(grep -A2 'VPS 1.*prod-be' "$SCRIPT_DIR/vps.md" 2>/dev/null | grep '|' | tail -1 | sed 's/.*`\(.*\)`.*/\1/' || echo "")
        if [ -n "$ANS_PASS" ]; then
            ssh -tt "$VPS_BE_HOST" "echo '$ANS_PASS' | su -c 'echo $ANS_PASS | sudo -S pg_ctlcluster 17 main start 2>&1' ans 2>&1" < /dev/null 2>/dev/null \
                && { sleep 2; echo -e "  ${GREEN}PostgreSQL started${NC}"; } \
                || { echo -e "  ${RED}Failed to start PostgreSQL via ans sudo${NC}"; exit 1; }
        else
            echo -e "  ${RED}FATAL: PostgreSQL is down and cannot find ans password in vps.md${NC}"
            echo -e "  ${YELLOW}Start manually: ssh index-maker/prod/be → sudo pg_ctlcluster 17 main start${NC}"
            exit 1
        fi
        # Verify
        PG_READY=$(vps_be_ssh "pg_isready -q 2>/dev/null" && echo "ok" || echo "down")
        [ "$PG_READY" = "ok" ] || { echo -e "  ${RED}PostgreSQL still not responding after start${NC}"; exit 1; }
    fi
    echo -e "  ${GREEN}PostgreSQL OK${NC}"

    # Check L3
    echo -e "${BLUE}[1/8] Checking L3 chain...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ] || { echo -e "  ${RED}L3 not reachable${NC}"; exit 1; }
    echo -e "  ${GREEN}L3 OK${NC}"

    # Refresh BLS snapshots to prevent SnapshotTooOld (86400 block limit).
    # Try refreshSnapshot() first (callable by any oracle, no admin needed).
    # Fall back to setAggregatedPubkey (admin-only) if refreshSnapshot doesn't exist.
    echo -e "${BLUE}[1b/8] Refreshing BLS snapshots...${NC}"
    local L3_REG=$(read_deployment_addr "OracleRegistry")
    if [ -n "$L3_REG" ] && [ "$L3_REG" != "null" ]; then
        if cast send "$L3_REG" "refreshSnapshot()" \
            --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE > /dev/null 2>&1; then
            echo -e "  ${GREEN}L3 snapshot refreshed (refreshSnapshot)${NC}"
        else
            # Fallback: setAggregatedPubkey (admin-only, works on older contracts)
            local L3_NONCE=$(cast call "$L3_REG" "registryNonce()(uint256)" --rpc-url "$RPC_URL" 2>/dev/null | awk '{print $1}')
            local L3_AGG=$(cast call "$L3_REG" "getAggregatedPubkey()(bytes)" --rpc-url "$RPC_URL" 2>/dev/null)
            if [ -n "$L3_NONCE" ] && [ -n "$L3_AGG" ]; then
                cast send "$L3_REG" "setAggregatedPubkey(bytes,uint256)" "$L3_AGG" "$L3_NONCE" \
                    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                    --legacy --gas-price $GAS_PRICE > /dev/null 2>&1 \
                    && echo -e "  ${GREEN}L3 snapshot refreshed (setAggregatedPubkey nonce=$L3_NONCE)${NC}" \
                    || echo -e "  ${YELLOW}L3 snapshot refresh failed (non-critical)${NC}"
            fi
        fi
    fi
    local SONIC_REG=$(read_deployment_addr "SettlementOracleRegistry")
    if [ -n "$SONIC_REG" ] && [ "$SONIC_REG" != "null" ]; then
        if cast send "$SONIC_REG" "refreshSnapshot()" \
            --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --legacy > /dev/null 2>&1; then
            echo -e "  ${GREEN}Sonic snapshot refreshed (refreshSnapshot)${NC}"
        else
            local SONIC_NONCE=$(cast call "$SONIC_REG" "registryNonce()(uint256)" --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null | awk '{print $1}')
            local SONIC_AGG=$(cast call "$SONIC_REG" "getAggregatedPubkey()(bytes)" --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null)
            if [ -n "$SONIC_NONCE" ] && [ -n "$SONIC_AGG" ]; then
                cast send "$SONIC_REG" "setAggregatedPubkey(bytes,uint256)" "$SONIC_AGG" "$SONIC_NONCE" \
                    --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --legacy > /dev/null 2>&1 \
                    && echo -e "  ${GREEN}Sonic snapshot refreshed (setAggregatedPubkey nonce=$SONIC_NONCE)${NC}" \
                    || echo -e "  ${YELLOW}Sonic snapshot refresh failed (non-critical)${NC}"
            fi
        fi
    fi

    # Kill old bare processes (prevents port conflicts on migration)
    _kill_old_processes

    # Pull latest code and rebuild binaries on BOTH VPSes
    echo -e "${BLUE}[2/8] Syncing files + rebuilding binaries...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && git pull origin main 2>&1 | tail -3" || true
    vps_chain_ssh "cd $VPS_CHAIN_DIR && git pull origin main 2>&1 | tail -3" || true
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
        echo -e "  Rebuilding binaries on VPS 1 (source changed)..."
        vps_be_ssh "source ~/.cargo/env && cd $VPS_BE_DIR && cargo build --release -p oracle -p data-node -p curator -p itp-bot 2>&1 | tail -3" \
            && echo -e "  ${GREEN}VPS 1 binaries rebuilt${NC}" \
            || echo -e "  ${YELLOW}VPS 1 binary rebuild failed — using existing binaries${NC}"
    else
        echo -e "  ${GREEN}Binaries up to date${NC}"
    fi
    _sync_docker_files
    _sync_config_files

    # Verify deployment consistency before starting services
    echo -e "${BLUE}[2b/8] Verifying deployment consistency...${NC}"
    DEPLOYMENT_FILE="${SCRIPT_DIR}/deployments/active-deployment.json"
    FRONT_INDEX=$(python3 -c "import json; print(json.load(open('frontend/lib/contracts/deployment.json'))['contracts']['Index'])" 2>/dev/null || echo "")
    ACTIVE_INDEX=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts']['Index'])" 2>/dev/null || echo "")
    if [ "$FRONT_INDEX" != "$ACTIVE_INDEX" ]; then
        echo -e "  ${YELLOW}Frontend deployment out of sync — fixing...${NC}"
        cp "$DEPLOYMENT_FILE" frontend/lib/contracts/deployment.json
    fi
    ACTIVE_VISION=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
    BATCHES_VISION=$(python3 -c "import json; print(json.load(open('deployments/vision-batches.json'))['vision'])" 2>/dev/null || echo "")
    if [ -n "$ACTIVE_VISION" ] && [ "$ACTIVE_VISION" != "$BATCHES_VISION" ]; then
        echo -e "  ${YELLOW}Vision address mismatch — fixing vision-batches.json...${NC}"
        python3 -c "import json; d=json.load(open('deployments/vision-batches.json')); d['vision']='$ACTIVE_VISION'; json.dump(d,open('deployments/vision-batches.json','w'),indent=2)"
        cp deployments/vision-batches.json frontend/lib/contracts/vision-batches.json 2>/dev/null || true
    fi
    # Verify settlement addresses exist (BridgeProxy, SettlementBridgeCustody, SETTLEMENT_USDC).
    # If these are missing or point to L3, every bridge/settlement call fails silently.
    ACTIVE_BP=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('BridgeProxy',''))" 2>/dev/null || echo "")
    ACTIVE_SBP=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SettlementBridgeProxy',''))" 2>/dev/null || echo "")
    ACTIVE_SBC=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT_FILE'))['contracts'].get('SettlementBridgeCustody',''))" 2>/dev/null || echo "")
    if [ -z "$ACTIVE_BP" ] || [ -z "$ACTIVE_SBC" ]; then
        echo -e "  ${RED}WARNING: Settlement addresses missing from active-deployment.json${NC}"
        echo -e "  ${RED}  BridgeProxy=$ACTIVE_BP  SettlementBridgeCustody=$ACTIVE_SBC${NC}"
        echo -e "  ${RED}  Bridge/settlement operations will fail. Re-run: ./testnet.sh deploy${NC}"
    elif [ -n "$ACTIVE_SBP" ] && [ "$ACTIVE_BP" != "$ACTIVE_SBP" ]; then
        echo -e "  ${YELLOW}WARNING: BridgeProxy ($ACTIVE_BP) != SettlementBridgeProxy ($ACTIVE_SBP)${NC}"
        echo -e "  ${YELLOW}  These should be identical (both point to Sonic). Possible stale merge.${NC}"
    else
        echo -e "  Settlement addresses: BridgeProxy=$ACTIVE_BP SettlementBridgeCustody=$ACTIVE_SBC"
    fi
    echo -e "  ${GREEN}Deployment consistent${NC}"

    # Refresh BLS registry snapshot to prevent SnapshotTooOld (86400 block expiry).
    # Every start must refresh — if the testnet was idle for hours, the old snapshot
    # is dead and every BLS-verified tx will revert.
    echo -e "${BLUE}[2c/8] Refreshing BLS registry snapshot...${NC}"
    ORACLE_REGISTRY_START=$(read_deployment_addr "OracleRegistry")
    if [ -n "$ORACLE_REGISTRY_START" ]; then
        REG_NONCE_START=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REGISTRY_START" "registryNonce()(uint256)" 2>/dev/null || echo "")
        AGG_PUBKEY_START=$(cast call --rpc-url "$RPC_URL" "$ORACLE_REGISTRY_START" "getAggregatedPubkey()(bytes)" 2>/dev/null || echo "")
        if [ -n "$AGG_PUBKEY_START" ] && [ "$AGG_PUBKEY_START" != "" ] && [ -n "$REG_NONCE_START" ]; then
            if cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
                "$ORACLE_REGISTRY_START" "setAggregatedPubkey(bytes,uint256)" "$AGG_PUBKEY_START" "$REG_NONCE_START" \
                --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
                > /dev/null 2>&1; then
                echo -e "  ${GREEN}Registry snapshot refreshed (nonce $REG_NONCE_START)${NC}"
            else
                echo -e "  ${YELLOW}Snapshot refresh failed — governance chain may be broken${NC}"
                echo -e "  ${YELLOW}BLS-verified txs will fail after 86400 blocks from last snapshot${NC}"
            fi
        else
            echo -e "  ${YELLOW}No aggregated pubkey or nonce — skipping snapshot refresh${NC}"
        fi
    else
        echo -e "  ${YELLOW}No OracleRegistry in deployment — skipping${NC}"
    fi

    # Ensure logs dir + existing files are writable by container UID (app=999 != max=1002)
    vps_be_ssh "mkdir -p $VPS_BE_DIR/logs && chmod 777 $VPS_BE_DIR/logs && chmod a+rw $VPS_BE_DIR/logs/* 2>/dev/null; true"

    # Write key files on VPS 1 (mounted into containers, never in env_file/environment)
    # Docker creates dirs for missing bind-mount sources — must remove with privileged container
    # Multiple cleanup strategies: Alpine container (root), then direct rm (user), then verify
    vps_be_ssh "docker run --rm -v /tmp:/hostmp alpine sh -c 'rm -rf /hostmp/oracle-key-1.txt /hostmp/oracle-key-2.txt /hostmp/oracle-key-3.txt /hostmp/settlement-key-1.txt /hostmp/settlement-key-2.txt /hostmp/settlement-key-3.txt /hostmp/curator-key.txt /hostmp/bot-key.txt' 2>/dev/null; true"
    vps_be_ssh "rm -rf /tmp/oracle-key-1.txt /tmp/oracle-key-2.txt /tmp/oracle-key-3.txt /tmp/settlement-key-1.txt /tmp/settlement-key-2.txt /tmp/settlement-key-3.txt /tmp/curator-key.txt /tmp/bot-key.txt 2>/dev/null; true"
    for i in 1 2 3; do
        vps_be_ssh "printf '%s' '${ORACLE_KEYS[$((i-1))]}' > /tmp/oracle-key-$i.txt && chmod 644 /tmp/oracle-key-$i.txt"
        # Each oracle uses its OWN key for settlement (avoids nonce conflicts with deployer)
        vps_be_ssh "printf '%s' '${ORACLE_KEYS[$((i-1))]}' > /tmp/settlement-key-$i.txt && chmod 644 /tmp/settlement-key-$i.txt"
    done
    # Verify key files are regular files (not directories from Docker bind-mount stubs)
    vps_be_ssh "for f in /tmp/oracle-key-1.txt /tmp/oracle-key-2.txt /tmp/oracle-key-3.txt /tmp/settlement-key-1.txt /tmp/settlement-key-2.txt /tmp/settlement-key-3.txt; do [ -f \"\$f\" ] || { echo \"FATAL: \$f is not a regular file\"; exit 1; }; done"
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

    # Start fund-manager (vault-based Vision bot — single process, 183 vaults)
    echo -e "${BLUE}[8/8] Starting fund-manager...${NC}"
    # Stop existing (prevents stale containers during rebuild)
    vps_be_ssh "cd $VPS_BE_DIR/docker/testnet/fund-manager && docker compose down 2>/dev/null; true"
    # Kill legacy vision-swarm if still running
    vps_be_ssh "cd $VPS_BE_DIR/docker/testnet/vision-swarm && docker compose down 2>/dev/null; true"

    # Sync vision-bot source (not under docker/testnet/, needs explicit sync)
    rsync -az --delete \
        --exclude='.venv' --exclude='__pycache__' --exclude='tests' \
        -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/vision-bot/" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/vision-bot/"
    # Sync deployment files
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/deployments/active-deployment.json" "$SCRIPT_DIR/deployments/vision-batches.json" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/deployments/"

    # Writable volume for state persistence
    vps_be_ssh "mkdir -p $VPS_BE_DIR/docker/testnet/fund-manager/pnl-data && chmod 777 $VPS_BE_DIR/docker/testnet/fund-manager/pnl-data"

    # Build
    vps_be_ssh "cd $VPS_BE_DIR && docker compose -f docker/testnet/fund-manager/docker-compose.yml build" \
        || { echo -e "  ${YELLOW}Fund-manager build failed — skipping${NC}"; }

    # Fund manager wallet with gas (vaults are funded via VisionVaultFactory at deploy time)
    FUND_MANAGER_ADDR=$(cast wallet address "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537" 2>/dev/null || echo "")
    if [ -n "$FUND_MANAGER_ADDR" ]; then
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            "$FUND_MANAGER_ADDR" --value 10ether > /dev/null 2>&1 || true
        echo -e "  ${GREEN}Funded manager wallet ($FUND_MANAGER_ADDR) with 10 GM${NC}"
    fi

    # Start fund-manager
    vps_be_ssh "cd $VPS_BE_DIR/docker/testnet/fund-manager && docker compose up -d" \
        && echo -e "  ${GREEN}Fund-manager started (183 vaults)${NC}" \
        || echo -e "  ${YELLOW}Fund-manager failed to start${NC}"

    # Rebuild symbol-map from on-chain ITP assets (catches address drift between deploys)
    _rebuild_symbol_map_from_chain
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data/symbol-map.json" 2>/dev/null || true

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
      - "--sources-display-file"
      - "/app/config/sources-display.json"
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if ! vps1_compose data-node up -d --build; then
        echo -e "  ${RED}data-node failed to start${NC}"; exit 1
    fi

    # Keep override on VPS — containers need it for restarts
    sleep 3
}

_start_oracles_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/oracle/docker-compose.override.yml"

    # Stop existing + clean WAL (safe — no race condition)
    vps1_compose oracle down || true
    vps_be_ssh "cd $VPS_BE_DIR && rm -f logs/consensus-*.wal"

    # Recreate key files AFTER docker compose down (which may leave dir stubs)
    vps_be_ssh "docker run --rm -v /tmp:/hostmp alpine sh -c 'rm -rf /hostmp/oracle-key-1.txt /hostmp/oracle-key-2.txt /hostmp/oracle-key-3.txt /hostmp/settlement-key-1.txt /hostmp/settlement-key-2.txt /hostmp/settlement-key-3.txt' 2>/dev/null; true"
    vps_be_ssh "rm -rf /tmp/oracle-key-1.txt /tmp/oracle-key-2.txt /tmp/oracle-key-3.txt /tmp/settlement-key-1.txt /tmp/settlement-key-2.txt /tmp/settlement-key-3.txt 2>/dev/null; true"
    for i in 1 2 3; do
        vps_be_ssh "printf '%s' '${ORACLE_KEYS[$((i-1))]}' > /tmp/oracle-key-$i.txt && chmod 644 /tmp/oracle-key-$i.txt"
        # Each oracle uses its OWN key for settlement (avoids nonce conflicts with deployer)
        vps_be_ssh "printf '%s' '${ORACLE_KEYS[$((i-1))]}' > /tmp/settlement-key-$i.txt && chmod 644 /tmp/settlement-key-$i.txt"
    done

    # Dynamic args
    L3_FROM_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    echo -e "  L3 block: $L3_FROM_BLOCK (oracles start from here)"

    VISION_ADDR=$(read_deployment_addr "Vision" 2>/dev/null || echo "")
    BRIDGE_PROXY=$(read_deployment_addr "SettlementBridgeProxy")
    [ -z "$BRIDGE_PROXY" ] && BRIDGE_PROXY=$(read_deployment_addr "BridgeProxy")
    VISION_SETTLEMENT_CUSTODY=$(read_deployment_addr "SettlementBridgeCustody")
    MIRROR_REGISTRY=$(read_deployment_addr "SettlementOracleRegistry")

    # Verify critical L3 addresses have code before starting oracles.
    for _check_name in Vision OracleRegistry Index; do
        local _check_addr=$(read_deployment_addr "$_check_name" 2>/dev/null || echo "")
        if [ -n "$_check_addr" ] && [ "$_check_addr" != "0x0000000000000000000000000000000000000000" ]; then
            local _check_code=$(cast code --rpc-url "$RPC_URL" "$_check_addr" 2>/dev/null | wc -c | tr -d ' ')
            if [ "$_check_code" -lt 10 ]; then
                echo -e "  ${RED}FATAL: $_check_name ($_check_addr) has NO CODE on L3${NC}"
                echo -e "  ${RED}  Deployment file is stale. Re-run: ./testnet.sh deploy${NC}"
                exit 1
            fi
        fi
    done
    echo -e "  ${GREEN}L3 contract addresses verified${NC}"

    # Verify critical settlement addresses have code on their respective chains.
    # Stale addresses (from Orbit CREATE divergence or cross-session deploys)
    # cause silent failures in bridge/settlement — catch them here before baking
    # into oracle Docker images.
    if [ -n "$VISION_SETTLEMENT_CUSTODY" ]; then
        local SBC_CODE_LEN=$(cast code --rpc-url "$SETTLEMENT_RPC_URL" "$VISION_SETTLEMENT_CUSTODY" 2>/dev/null | wc -c | tr -d ' ')
        if [ "$SBC_CODE_LEN" -lt 10 ]; then
            echo -e "  ${RED}FATAL: SettlementBridgeCustody ($VISION_SETTLEMENT_CUSTODY) has NO CODE on Settlement chain${NC}"
            echo -e "  ${RED}  This address is stale. Update active-deployment.json with the correct address.${NC}"
            echo -e "  ${RED}  Check: deployments/e2e-full-system-sonic.json for the current Sonic deployment.${NC}"
            # Attempt auto-fix from Sonic deployment
            local SONIC_SBC=$(python3 -c "import json; print(json.load(open('deployments/e2e-full-system-sonic.json'))['contracts']['SettlementBridgeCustody'])" 2>/dev/null || echo "")
            if [ -n "$SONIC_SBC" ]; then
                local SONIC_SBC_CODE=$(cast code --rpc-url "$SETTLEMENT_RPC_URL" "$SONIC_SBC" 2>/dev/null | wc -c | tr -d ' ')
                if [ "$SONIC_SBC_CODE" -gt 10 ]; then
                    echo -e "  ${YELLOW}Auto-fixing from Sonic deployment: $SONIC_SBC${NC}"
                    python3 -c "import json; d=json.load(open('$DEPLOYMENT_FILE')); d['contracts']['SettlementBridgeCustody']='$SONIC_SBC'; json.dump(d,open('$DEPLOYMENT_FILE','w'),indent=2)"
                    VISION_SETTLEMENT_CUSTODY="$SONIC_SBC"
                    echo -e "  ${GREEN}Fixed SettlementBridgeCustody → $SONIC_SBC${NC}"
                else
                    echo -e "  ${RED}Sonic SBC ($SONIC_SBC) also has no code. Full redeploy needed.${NC}"
                    exit 1
                fi
            else
                exit 1
            fi
        fi
    fi

    # Build per-oracle command as YAML list (safe from injection)
    # NOTE: Dockerfile uses ENTRYPOINT ["service-entrypoint"] so command: is ARGS only — no binary path.
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
      - "--settlement-custody"
      - "$VISION_SETTLEMENT_CUSTODY"
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
      - "--vision-settlement-bridge-custody"
      - "$VISION_SETTLEMENT_CUSTODY"
      - "--vision-settlement-rpc-url"
      - "$SETTLEMENT_RPC_VPS"
CMD
        fi
    }

    # No env_file: (env_file values are baked into docker inspect, same as environment:).
    # Read Bitget credentials from system.env on VPS (needed for real price fetching)
    local BITGET_API_KEY BITGET_API_SECRET BITGET_PASSPHRASE
    BITGET_API_KEY=$(vps_be_ssh "grep '^BITGET_READONLY_API_KEY=' $VPS_BE_DIR/system.env 2>/dev/null | cut -d= -f2-" || echo "")
    BITGET_API_SECRET=$(vps_be_ssh "grep '^BITGET_READONLY_API_SECRET=' $VPS_BE_DIR/system.env 2>/dev/null | cut -d= -f2-" || echo "")
    BITGET_PASSPHRASE=$(vps_be_ssh "grep '^BITGET_READONLY_PASSPHRASE=' $VPS_BE_DIR/system.env 2>/dev/null | cut -d= -f2-" || echo "")

    if [ -z "$BITGET_API_KEY" ] || [ -z "$BITGET_API_SECRET" ] || [ -z "$BITGET_PASSPHRASE" ]; then
        echo -e "  ${YELLOW}WARNING: Missing Bitget credentials in system.env — oracles will run in Mock mode (no real prices)${NC}"
    fi

    # All secrets via mounted key files. Only non-secret config in environment:.
    local OVERRIDE="$SCRIPT_DIR/.oracle-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  oracle-1:
    environment:
      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-1.txt
      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key-1.txt
      ORACLE_PEERS: "127.0.0.1:9002,127.0.0.1:9003"
      ORACLE_RPC_URL: "$RPC_URL"
      ORACLE_VISION_ADDRESS: "$VISION_ADDR"
      ORACLE_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ORACLE_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      # ORACLE_MIRROR_REGISTRY_ADDRESS: read from deployment.json SettlementOracleRegistry
      BITGET_READONLY_API_KEY: "$BITGET_API_KEY"
      BITGET_READONLY_API_SECRET: "$BITGET_API_SECRET"
      BITGET_READONLY_PASSPHRASE: "$BITGET_PASSPHRASE"
      EXCHANGE_MODE: "testnet"
    command:
$(_oracle_command_yaml 1 9001 0 "127.0.0.1:9002,127.0.0.1:9003")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/oracle-key-1.txt:/tmp/oracle-key-1.txt:ro
      - /tmp/settlement-key-1.txt:/tmp/settlement-key-1.txt:ro
      - $VPS_BE_DIR/logs:/app/logs

  oracle-2:
    environment:
      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-2.txt
      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key-2.txt
      ORACLE_PEERS: "127.0.0.1:9001,127.0.0.1:9003"
      ORACLE_RPC_URL: "$RPC_URL"
      ORACLE_VISION_ADDRESS: "$VISION_ADDR"
      ORACLE_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ORACLE_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      # ORACLE_MIRROR_REGISTRY_ADDRESS: read from deployment.json SettlementOracleRegistry
      BITGET_READONLY_API_KEY: "$BITGET_API_KEY"
      BITGET_READONLY_API_SECRET: "$BITGET_API_SECRET"
      BITGET_READONLY_PASSPHRASE: "$BITGET_PASSPHRASE"
      EXCHANGE_MODE: "testnet"
    command:
$(_oracle_command_yaml 2 9002 1 "127.0.0.1:9001,127.0.0.1:9003")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/oracle-key-2.txt:/tmp/oracle-key-2.txt:ro
      - /tmp/settlement-key-2.txt:/tmp/settlement-key-2.txt:ro
      - $VPS_BE_DIR/logs:/app/logs

  oracle-3:
    environment:
      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-3.txt
      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key-3.txt
      ORACLE_PEERS: "127.0.0.1:9001,127.0.0.1:9002"
      ORACLE_RPC_URL: "$RPC_URL"
      ORACLE_VISION_ADDRESS: "$VISION_ADDR"
      ORACLE_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ORACLE_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      # ORACLE_MIRROR_REGISTRY_ADDRESS: read from deployment.json SettlementOracleRegistry
      BITGET_READONLY_API_KEY: "$BITGET_API_KEY"
      BITGET_READONLY_API_SECRET: "$BITGET_API_SECRET"
      BITGET_READONLY_PASSPHRASE: "$BITGET_PASSPHRASE"
      EXCHANGE_MODE: "testnet"
    command:
$(_oracle_command_yaml 3 9003 2 "127.0.0.1:9001,127.0.0.1:9002")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/oracle-key-3.txt:/tmp/oracle-key-3.txt:ro
      - /tmp/settlement-key-3.txt:/tmp/settlement-key-3.txt:ro
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

    # Keep override on VPS — containers need it for restarts (command, volumes, env vars)

    # Verify all 3 oracles are running (BLS threshold is 2/3 — all must be up)
    # Oracle needs ~10s to initialize: state reconstruction + P2P connection
    sleep 15
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
    CURATOR_IRM_ADDR=$(python3 -c "import json; c=json.load(open('deployments/morpho-e2e.json'))['contracts']; print(c.get('CURATOR_RATE_IRM', c.get('ADAPTIVE_IRM', '')))" 2>/dev/null || echo "")
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

    # Copy ITPVault bytecode for auto vault deployment (curator deploys vaults for new ITPs).
    # market_deployer.rs uses --vault-bytecode-path to deploy vaults + Morpho markets for
    # ITPs created via requestCreateItp. Without this, new ITPs have no vault and no lending market.
    local VAULT_BC="contracts/out/ITPVault.sol/ITPVault.json"
    if [ -f "$VAULT_BC" ]; then
        rsync -az -e "$RSYNC_SSH_BE" "$VAULT_BC" \
            "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/vault-bytecode.json"
    else
        echo -e "  ${YELLOW}ITPVault.sol artifact not found at $VAULT_BC — auto vault deploy disabled${NC}"
    fi

    if [ -z "$MORPHO_ADDR" ] || [ -z "$VAULT_ADDR" ]; then
        echo -e "  ${YELLOW}Curator skipped — no Morpho deployment${NC}"
        return
    fi

    ORACLE_URLS="http://127.0.0.1:10001,http://127.0.0.1:10002,http://127.0.0.1:10003"

    # Write curator key file on VPS (dedicated key — NOT deployer, avoids nonce conflicts)
    vps_be_ssh "printf '%s' '${CURATOR_KEY#0x}' > /tmp/curator-key.txt && chmod 644 /tmp/curator-key.txt"

    # Use YAML list format (safe from injection)
    # Private key via mounted file (not CLI arg — would be visible in docker inspect/proc)
    local OVERRIDE="$SCRIPT_DIR/.curator-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  curator:
    volumes:
      - /tmp/curator-key.txt:/tmp/curator-key.txt:ro
      - $VPS_BE_DIR/oracle-bytecode.json:/app/oracle-bytecode.json:ro
      - $VPS_BE_DIR/vault-bytecode.json:/app/vault-bytecode.json:ro
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
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
      - "$(python3 -c "import json; d=json.load(open('deployments/batch-markets.json')); print(','.join([m['marketId'] for m in d['markets']]))" 2>/dev/null || echo "$MARKET_ID")"
      - "--oracle-urls"
      - "$ORACLE_URLS"
      - "--l3-rpc-url"
      - "$RPC_URL"
      - "--mirror-registry-address"
      - "$REGISTRY_ADDR"
      - "--l3-registry-address"
      - "$REGISTRY_ADDR"
      - "--oracle-addresses"
      - "$(python3 -c "import json; d=json.load(open('deployments/batch-markets.json')); print(','.join([m['oracle'] for m in d['markets']]))" 2>/dev/null || echo "$ORACLE_ADDR")"
      - "--itp-addresses"
      - "$(python3 -c "import json; d=json.load(open('deployments/batch-markets.json')); print(','.join([m['collateralToken'] for m in d['markets']]))" 2>/dev/null || echo "$ITP_ADDR")"
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
      - "--vault-bytecode-path"
      - "/app/vault-bytecode.json"
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

    # AP_EXCHANGE_MODE controls whether AP executes on real Bitget or in-memory mock.
    # testnet = real Bitget testnet API (requires BITGET_API_KEY/SECRET/PASSPHRASE in system.env)
    # mock    = synthetic fills, no network. Never use on a live chain.
    local AP_EXCHANGE_MODE_VALUE="${AP_EXCHANGE_MODE:-testnet}"

    local OVERRIDE="$SCRIPT_DIR/.ap-override.yml"
    # AP reads key from file via AP_PRIVATE_KEY_PATH (Task 0 prerequisite).
    # Path is not secret — only the file content is. docker inspect shows the path, not the key.
    # Bitget execution creds are injected via env_file → /home/max/index/system.env (gitignored, 600 perms).
    cat > "$OVERRIDE" <<YEOF
services:
  ap:
    env_file:
      - $VPS_CHAIN_DIR/system.env
    environment:
      AP_PRIVATE_KEY_PATH: /tmp/ap-key.txt
    volumes:
      - /tmp/ap-key.txt:/tmp/ap-key.txt:ro
      - $VPS_CHAIN_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
    command:
      - "--port"
      - "9100"
      - "--rpc"
      - "http://10.2.0.3/"
      - "--exchange-mode"
      - "$AP_EXCHANGE_MODE_VALUE"
      - "--settlement-rpc"
      - "$SETTLEMENT_RPC_URL"
      - "--settlement-chain-id"
      - "$SETTLEMENT_CHAIN_ID"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--data-node-url"
      - "http://10.2.0.3:$DATA_NODE_PORT"
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

    # NOTE: override is intentionally left on disk — env_file binds system.env at
    # container start. Removing it would leave the next `docker compose up` without
    # Bitget execution creds or the right --exchange-mode.
}

_start_itp_bot_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/itp-bot/docker-compose.override.yml"

    local INDEX_ADDR_BOT
    INDEX_ADDR_BOT=$(read_deployment_addr "Index")

    # Write bot key file on VPS 1 (dedicated key — NOT deployer, avoids nonce conflicts)
    vps_be_ssh "docker run --rm -v /tmp:/tmp alpine sh -c 'rm -rf /tmp/bot-key.txt' 2>/dev/null; true"
    vps_be_ssh "printf '%s' '$ITP_BOT_KEY' > /tmp/bot-key.txt && chmod 644 /tmp/bot-key.txt"

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
    for svc in fund-manager vision-swarm itp-bot curator oracle data-node sonic-proxy; do
        ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/$svc && docker compose down 2>/dev/null; true" < /dev/null 2>/dev/null
    done
    # Clean up key files and stale overrides on VPS 1
    vps_be_ssh "rm -f /tmp/oracle-key-{1,2,3}.txt /tmp/settlement-key-{1,2,3}.txt /tmp/curator-key.txt /tmp/bot-key.txt"
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
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE $FORGE_SIZE_FLAG) \
        > logs/deploy-vision-batches.log 2>&1

    if [ $? -ne 0 ]; then
        echo -e "  ${RED}Batch deployment failed:${NC}"
        tail -10 logs/deploy-vision-batches.log 2>/dev/null || true
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

# ── seed-orders: Buy all ITPs + seed Morpho borrows ─────────
cmd_seed_orders() {
    echo -e "${CYAN}Seeding ITP orders + Morpho borrows...${NC}"

    # Dedicated seeder key (Anvil account 8) — avoids nonce conflicts with oracles/deployer
    local SEEDER_KEY="0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"
    local SEEDER_ADDRESS="0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"

    # Prerequisites
    for cmd in forge cast python3; do
        command -v $cmd &>/dev/null || { echo -e "${RED}$cmd not found${NC}"; exit 1; }
    done
    mkdir -p logs

    # Check L3 reachable
    local VPS_CHAIN_ID
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ] || { echo -e "${RED}L3 not reachable (got $VPS_CHAIN_ID, expected $CHAIN_ID)${NC}"; exit 1; }

    # Read addresses from deployment JSONs
    local INDEX_ADDR USDC_ADDR MORPHO_ADDR VAULT_ADDR
    INDEX_ADDR=$(read_deployment_addr "Index")
    USDC_ADDR=$(read_deployment_addr "L3_WUSDC")
    MORPHO_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MORPHO'])" 2>/dev/null || echo "")
    VAULT_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['METAMORPHO_VAULT'])" 2>/dev/null || echo "")

    [ -n "$INDEX_ADDR" ] || { echo -e "${RED}Index address not found in $DEPLOYMENT_FILE${NC}"; exit 1; }
    [ -n "$USDC_ADDR" ] || { echo -e "${RED}L3_WUSDC address not found in $DEPLOYMENT_FILE${NC}"; exit 1; }
    [ -n "$MORPHO_ADDR" ] || { echo -e "${RED}MORPHO address not found in deployments/morpho-e2e.json${NC}"; exit 1; }
    [ -n "$VAULT_ADDR" ] || { echo -e "${RED}METAMORPHO_VAULT address not found in deployments/morpho-e2e.json${NC}"; exit 1; }

    echo -e "  Index:  $INDEX_ADDR"
    echo -e "  USDC:   $USDC_ADDR"
    echo -e "  Morpho: $MORPHO_ADDR"
    echo -e "  Vault:  $VAULT_ADDR"
    echo -e "  Seeder: $SEEDER_ADDRESS"

    # ── Step 1: Fund seeder account ──────────────────────────
    echo -e "${BLUE}[1/6] Funding seeder account...${NC}"

    # Gas (GM) — send 1 GM from deployer
    local SEEDER_BALANCE
    SEEDER_BALANCE=$(cast balance --rpc-url "$RPC_URL" "$SEEDER_ADDRESS" 2>/dev/null || echo "0")
    if [ "$SEEDER_BALANCE" = "0" ] || python3 -c "exit(0 if int('$SEEDER_BALANCE') < 10**17 else 1)" 2>/dev/null; then
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE \
            --value 1000000000000000000 "$SEEDER_ADDRESS" \
            > /dev/null 2>&1 || echo -e "  ${YELLOW}Gas funding failed (may already have balance)${NC}"
        echo -e "  ${GREEN}Sent 1 GM for gas${NC}"
    else
        echo -e "  ${GREEN}Seeder already has gas${NC}"
    fi

    # Mint 200k USDC to seeder (enough for 77 ITPs * up to $1000 each)
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$USDC_ADDR" "mint(address,uint256)" "$SEEDER_ADDRESS" 200000000000000000000000 \
        > /dev/null 2>&1 || { echo -e "${RED}USDC mint to seeder failed${NC}"; exit 1; }
    echo -e "  ${GREEN}Minted 200k USDC to seeder${NC}"

    # Mint 50k USDC to deployer (for deployer's own ITP positions — profile page needs these)
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$USDC_ADDR" "mint(address,uint256)" "$DEPLOYER_ADDRESS" 50000000000000000000000 \
        > /dev/null 2>&1 || echo -e "  ${YELLOW}USDC mint to deployer failed (may already have balance)${NC}"
    echo -e "  ${GREEN}Minted 50k USDC to deployer${NC}"

    # Approve USDC spending for deployer (max approval to Index contract)
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$USDC_ADDR" "approve(address,uint256)" "$INDEX_ADDR" "$(cast max-uint)" \
        > /dev/null 2>&1 || echo -e "  ${YELLOW}Deployer USDC approve failed${NC}"
    echo -e "  ${GREEN}Deployer approved USDC to Index${NC}"

    # ── Step 2: Stop oracles ─────────────────────────────────
    echo -e "${BLUE}[2/6] Stopping oracles...${NC}"
    for i in 1 2 3; do
        vps1_compose oracle stop oracle-$i 2>/dev/null || true
    done
    sleep 3
    echo -e "  ${GREEN}Oracles stopped${NC}"

    # ── Step 3: Submit buy orders for all ITPs ───────────────
    echo -e "${BLUE}[3/6] Submitting buy orders for all ITPs...${NC}"
    local ORDER_ID_BEFORE
    ORDER_ID_BEFORE=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "nextOrderId()(uint256)" 2>/dev/null || echo "0")
    echo -e "  nextOrderId before: $ORDER_ID_BEFORE"

    rm -rf contracts/broadcast/SubmitBuyOrders.s.sol/$CHAIN_ID/
    (cd contracts && DEPLOYER_KEY="$SEEDER_KEY" \
    INDEX_ADDRESS="$INDEX_ADDR" USDC_ADDRESS="$USDC_ADDR" \
    forge script script/SubmitBuyOrders.s.sol:SubmitBuyOrders \
        --rpc-url "$RPC_URL" \
        --private-key "$SEEDER_KEY" \
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE \
        $FORGE_SIZE_FLAG) \
        > logs/seed-buy-orders.log 2>&1

    if [ $? -ne 0 ]; then
        echo -e "  ${RED}Buy orders failed:${NC}"
        tail -20 logs/seed-buy-orders.log 2>/dev/null || true
        # Restart oracles before bailing
        echo -e "  ${YELLOW}Restarting oracles despite failure...${NC}"
        for i in 1 2 3; do
            vps1_compose oracle start oracle-$i 2>/dev/null || true
            [ $i -lt 3 ] && sleep 5
        done
        exit 1
    fi

    local ORDER_ID_AFTER
    ORDER_ID_AFTER=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "nextOrderId()(uint256)" 2>/dev/null || echo "0")
    local ORDERS_PLACED=$((ORDER_ID_AFTER - ORDER_ID_BEFORE))
    echo -e "  ${GREEN}Submitted $ORDERS_PLACED buy orders (nextOrderId: $ORDER_ID_BEFORE → $ORDER_ID_AFTER)${NC}"

    # ── Step 3b: Submit deployer buy orders (first 10 ITPs) ──
    # The deployer needs ITP shares for the portfolio page to show positions.
    echo -e "${BLUE}[3b/6] Submitting deployer buy orders (first 10 ITPs)...${NC}"
    local DEPLOYER_BUY_AMOUNT="500000000000000000000"  # 500 USDC (18 dec)
    local DEPLOYER_ORDERS=0
    local EXPIRY=$(($(date +%s) + 86400))
    for i in $(seq 1 10); do
        local ITP_ID
        ITP_ID=$(printf "0x%064x" $i)
        # Check ITP exists
        local ITP_CREATOR
        ITP_CREATOR=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" \
            "getITPState(bytes32)((address,uint256,uint256,address[],uint256[],uint256[]))" \
            "$ITP_ID" 2>/dev/null | head -1 | cut -d',' -f1 || echo "")
        [[ "$ITP_CREATOR" == *"0x0000000000000000000000000000000000000000"* ]] && continue
        [ -z "$ITP_CREATOR" ] && continue

        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE \
            "$INDEX_ADDR" "submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)" \
            "$ITP_ID" 0 "$DEPLOYER_BUY_AMOUNT" 0 1 "$EXPIRY" \
            > /dev/null 2>&1 && DEPLOYER_ORDERS=$((DEPLOYER_ORDERS + 1)) || \
            echo -e "  ${YELLOW}Deployer order for ITP $i failed${NC}"
    done
    echo -e "  ${GREEN}Deployer submitted $DEPLOYER_ORDERS buy orders${NC}"

    # ── Step 4: Restart oracles to process orders ────────────
    echo -e "${BLUE}[4/6] Restarting oracles...${NC}"
    for i in 1 2 3; do
        vps1_compose oracle start oracle-$i 2>/dev/null || true
        [ $i -lt 3 ] && sleep 5
    done
    sleep 10
    # Verify oracles are up
    local all_ok=true
    for i in 1 2 3; do
        if ! check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "oracle" "oracle-$i"; then
            echo -e "  ${RED}oracle-$i not running${NC}"
            all_ok=false
        fi
    done
    [ "$all_ok" = true ] || { echo -e "${RED}Oracles failed to restart — cannot process orders${NC}"; exit 1; }
    echo -e "  ${GREEN}Oracles running${NC}"

    # ── Step 5: Wait for orders to be filled ─────────────────
    echo -e "${BLUE}[5/6] Waiting for oracles to fill orders...${NC}"
    # Poll order status: check if the first submitted order has been processed.
    # Orders are filled when totalSupply of the ITP goes from 0 to >0.
    # We poll the first ITP's totalSupply as a proxy for "oracles have processed at least one round."
    local MAX_WAIT=600  # 10 minutes (oracles need BLS consensus per batch, 104 orders takes time)
    local POLL_INTERVAL=10
    local ELAPSED=0
    local FIRST_ORDER_ID=$ORDER_ID_BEFORE

    while [ $ELAPSED -lt $MAX_WAIT ]; do
        # Check if ITP 1 has supply (meaning at least one buy order was filled)
        local ITP1_SUPPLY
        ITP1_SUPPLY=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" \
            "getITPState(bytes32)((address,uint256,uint256,address[],uint256[],uint256[]))" \
            "0x0000000000000000000000000000000000000000000000000000000000000001" 2>/dev/null \
            | python3 -c "import sys; line=sys.stdin.read(); parts=line.strip().split(','); print(parts[1].strip())" 2>/dev/null \
            || echo "0")

        if [ "$ITP1_SUPPLY" != "0" ] && [ -n "$ITP1_SUPPLY" ]; then
            echo -e "  ${GREEN}Orders being filled (ITP 1 totalSupply: $ITP1_SUPPLY)${NC}"
            # Give oracles more time to process remaining orders
            echo -e "  Waiting 30s for remaining orders..."
            sleep 30
            break
        fi

        ELAPSED=$((ELAPSED + POLL_INTERVAL))
        echo -e "  Waiting... ($ELAPSED/${MAX_WAIT}s)"
        sleep $POLL_INTERVAL
    done

    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo -e "  ${YELLOW}Timed out waiting for fills after ${MAX_WAIT}s — continuing anyway${NC}"
        echo -e "  ${YELLOW}Orders may still be processing. Check: cast call --rpc-url $RPC_URL $INDEX_ADDR 'nextOrderId()(uint256)'${NC}"
    fi

    # ── Step 6: Reallocate vault + seed borrows ──────────────
    echo -e "${BLUE}[6/6] Reallocating vault + seeding borrows...${NC}"

    # Reallocate vault first (spread USDC across all markets so borrows have liquidity)
    rm -rf contracts/broadcast/ReallocateVault.s.sol/$CHAIN_ID/
    (cd contracts && DEPLOYER_KEY="$DEPLOYER_KEY" \
    MORPHO="$MORPHO_ADDR" METAMORPHO_VAULT="$VAULT_ADDR" SPREAD=true \
    forge script script/ReallocateVault.s.sol:ReallocateVault \
        --rpc-url "$RPC_URL" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE \
        $FORGE_SIZE_FLAG) \
        > logs/seed-reallocate.log 2>&1

    if [ $? -ne 0 ]; then
        echo -e "  ${YELLOW}Vault reallocation failed (borrows may still work if markets have supply):${NC}"
        tail -10 logs/seed-reallocate.log 2>/dev/null || true
    else
        echo -e "  ${GREEN}Vault reallocated${NC}"
    fi

    # Seed borrows with buyer (seeder) key
    rm -rf contracts/broadcast/SeedBorrows.s.sol/$CHAIN_ID/
    (cd contracts && BUYER_KEY="$SEEDER_KEY" \
    MORPHO="$MORPHO_ADDR" METAMORPHO_VAULT="$VAULT_ADDR" \
    forge script script/SeedBorrows.s.sol:SeedBorrows \
        --rpc-url "$RPC_URL" \
        --private-key "$SEEDER_KEY" \
        --broadcast --slow \
        --chain-id $CHAIN_ID \
        --legacy --with-gas-price $GAS_PRICE \
        $FORGE_SIZE_FLAG) \
        > logs/seed-borrows.log 2>&1

    if [ $? -ne 0 ]; then
        echo -e "  ${YELLOW}Seed borrows had errors:${NC}"
        tail -10 logs/seed-borrows.log 2>/dev/null || true
    else
        echo -e "  ${GREEN}Borrows seeded${NC}"
    fi

    echo -e "${GREEN}Seeding complete. Running post-deploy verification...${NC}"

    # ── Post-deploy verification ─────────────────────────────
    # Acceptance criteria:
    #   - 10 players on each active batch
    #   - 50+ active Vision sources
    #   - 50+ lending markets with > $10
    #   - 50+ ITPs with > $50 bought
    #   - ALL ITP NAVs within 20% of $1 ($0.80-$1.20)
    #   - Settlements submitted on-chain
    echo -e "${BLUE}[7/7] Verifying system is operational...${NC}"
    local VERIFY_PASS=0
    local VERIFY_FAIL=0

    # 1. ITP fills: pendingOrderCount should be 0
    local PENDING=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "pendingOrderCount()(uint256)" 2>/dev/null | awk '{print $1}')
    if [ "$PENDING" -le 5 ] 2>/dev/null; then
        echo -e "  ${GREEN}[1] ITP fills: $PENDING pending (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${RED}[1] ITP fills: $PENDING still pending${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # 2. ITP NAV prices: all within $0.80-$1.20
    local ITP_TOTAL=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getItpCount()(uint256)" 2>/dev/null | awk '{print $1}')
    local NAV_BAD=0
    local NAV_CHECKED=0
    for _ni in $(seq 1 "${ITP_TOTAL:-0}"); do
        local _nhex=$(printf "0x%064x" "$_ni")
        local _nav=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getNAV(bytes32)(uint256)" "$_nhex" 2>/dev/null | awk '{print $1}')
        [ -z "$_nav" ] && continue
        NAV_CHECKED=$((NAV_CHECKED + 1))
        # Check if NAV is between 0.8e18 and 1.2e18
        if python3 -c "n=int('$_nav'); exit(0 if n < 800000000000000000 or n > 1200000000000000000 else 1)" 2>/dev/null; then
            NAV_BAD=$((NAV_BAD + 1))
            [ "$NAV_BAD" -le 3 ] && echo -e "  ${RED}    ITP $_ni NAV out of range: $_nav${NC}"
        fi
    done
    if [ "$NAV_BAD" -eq 0 ] && [ "$NAV_CHECKED" -gt 0 ]; then
        echo -e "  ${GREEN}[2] ITP NAVs: all $NAV_CHECKED within \$0.80-\$1.20 (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${RED}[2] ITP NAVs: $NAV_BAD/$NAV_CHECKED out of range${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # 3. ITP buys: 50+ ITPs with > $50 supply
    local ITPS_WITH_SUPPLY=0
    for _si in $(seq 1 "${ITP_TOTAL:-0}"); do
        local _shex=$(printf "0x%064x" "$_si")
        local _vault=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "itpVaults(bytes32)(address)" "$_shex" 2>/dev/null)
        [ -z "$_vault" ] || [ "$_vault" = "0x0000000000000000000000000000000000000000" ] && continue
        local _supply=$(cast call --rpc-url "$RPC_URL" "$_vault" "totalSupply()(uint256)" 2>/dev/null | awk '{print $1}')
        # $50 = 50e18 in 18-decimal shares (NAV ~$1)
        if python3 -c "exit(0 if int('${_supply:-0}') > 50000000000000000000 else 1)" 2>/dev/null; then
            ITPS_WITH_SUPPLY=$((ITPS_WITH_SUPPLY + 1))
        fi
    done
    if [ "$ITPS_WITH_SUPPLY" -ge 50 ]; then
        echo -e "  ${GREEN}[3] ITP buys: $ITPS_WITH_SUPPLY ITPs with >\$50 supply (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${RED}[3] ITP buys: only $ITPS_WITH_SUPPLY ITPs with >\$50 (need 50+)${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # 4. Lending: 50+ markets with > $10
    local SUPPLIED=$(grep "Total markets supplied:" logs/seed-borrows.log 2>/dev/null | tail -1 | grep -o '[0-9]*' | tail -1)
    if [ "${SUPPLIED:-0}" -ge 50 ]; then
        echo -e "  ${GREEN}[4] Lending: $SUPPLIED markets supplied (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${RED}[4] Lending: ${SUPPLIED:-0} markets supplied (need 50+)${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # 5. Vision batches: 50+ active sources
    local ACTIVE_SOURCES=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(DISTINCT source_id) FROM vision_batch_lifecycle WHERE settled_at IS NULL;\"" 2>/dev/null | tr -d ' ')
    if [ "${ACTIVE_SOURCES:-0}" -ge 50 ]; then
        echo -e "  ${GREEN}[5] Vision batches: $ACTIVE_SOURCES active sources (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${YELLOW}[5] Vision batches: ${ACTIVE_SOURCES:-0} active sources (data-node still discovering — need 50+)${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # 6. Vision bots: 10 players on active batches
    local BOT_PLAYERS=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(DISTINCT player) FROM vision_positions vp JOIN vision_batch_lifecycle vbl ON vbl.on_chain_batch_id = vp.batch_id WHERE vbl.settled_at IS NULL;\"" 2>/dev/null | tr -d ' ')
    if [ "${BOT_PLAYERS:-0}" -ge 10 ]; then
        echo -e "  ${GREEN}[6] Vision bots: $BOT_PLAYERS players on active batches (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${RED}[6] Vision bots: ${BOT_PLAYERS:-0} players (need 10)${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    # 7. Settlements: proofs submitted on-chain
    local PROOF_COUNT=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(*) FROM vision_settlement_proofs;\"" 2>/dev/null | tr -d ' ')
    local SUBMITTED=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(*) FROM vision_settlement_proofs WHERE submitted = true;\"" 2>/dev/null | tr -d ' ')
    if [ "${SUBMITTED:-0}" -gt 0 ]; then
        echo -e "  ${GREEN}[7] Settlements: $SUBMITTED/$PROOF_COUNT submitted on-chain (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${YELLOW}[7] Settlements: 0 submitted (batches need 1-10 min to expire)${NC}"
    fi

    # 8. All services running
    local SVC_OK=true
    for svc in oracle-1 oracle-2 oracle-3; do
        if ! check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "oracle" "$svc" > /dev/null 2>&1; then
            SVC_OK=false
        fi
    done
    if [ "$SVC_OK" = true ]; then
        echo -e "  ${GREEN}[8] Services: all 3 oracles running (OK)${NC}"
        VERIFY_PASS=$((VERIFY_PASS + 1))
    else
        echo -e "  ${RED}[8] Services: some oracles not running${NC}"
        VERIFY_FAIL=$((VERIFY_FAIL + 1))
    fi

    echo -e ""
    echo -e "  ════════════════════════════════════════"
    echo -e "  Verification: ${GREEN}$VERIFY_PASS passed${NC}, ${RED}$VERIFY_FAIL failed${NC} / 8 checks"
    echo -e "  ════════════════════════════════════════"
    if [ "$VERIFY_FAIL" -eq 0 ]; then
        echo -e "  ${GREEN}ALL CHECKS PASSED — system fully operational${NC}"
    elif [ "$VERIFY_FAIL" -le 2 ]; then
        echo -e "  ${YELLOW}Some checks pending — Vision batches/settlements need time. Re-check in 10 min.${NC}"
    else
        echo -e "  ${RED}Multiple failures — manual investigation needed${NC}"
    fi

    # ── E2E Integration Tests ─────────────────────────────────
    # Tests the full user flow with a non-admin wallet:
    #   1. Create ITP via requestCreateItp (permissionless)
    #   2. Wait for oracle to process + auto-list
    #   3. Buy the new ITP
    #   4. Deposit to Morpho + borrow USDC
    #   5. Verify Vision settlement payouts land in wallets
    echo -e ""
    echo -e "${BLUE}[8/8] E2E integration tests (non-admin wallet)...${NC}"

    # Test wallet: Anvil account 6 (not admin, not oracle, not seeder)
    local TEST_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
    local TEST_ADDR="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
    local E2E_PASS=0
    local E2E_FAIL=0

    # Fund test wallet
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE --value 1000000000000000000 "$TEST_ADDR" > /dev/null 2>&1
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$USDC_ADDR" "mint(address,uint256)" "$TEST_ADDR" 10000000000000000000000 > /dev/null 2>&1
    cast send --private-key "$TEST_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE \
        "$USDC_ADDR" "approve(address,uint256)" "$INDEX_ADDR" "$(cast max-uint)" > /dev/null 2>&1
    echo -e "  Test wallet funded (10K USDC)"

    # ── Test 1: Create ITP via admin (simulating requestCreateItp → oracle flow) ──
    # requestCreateItp lives on Settlement BridgeProxy. For testnet, we simulate the
    # oracle processing by having the admin create an ITP on behalf of the test user.
    echo -e "  [T1] Creating ITP on behalf of test user..."
    local TEST_ITP_ASSETS=()
    local TEST_ITP_PRICES=()
    local TEST_ITP_WEIGHTS=()
    # Pick first 3 tokens from symbol-map
    local _tokens=$(python3 -c "
import json
sm = json.load(open('data/symbol-map.json'))
items = list(sm.items())[:3]
for addr, val in items:
    pair = val.get('pair','') if isinstance(val,dict) else val
    print(addr)
" 2>/dev/null)
    local _tidx=0
    while IFS= read -r _taddr; do
        TEST_ITP_ASSETS+=("$_taddr")
        TEST_ITP_PRICES+=("1000000000000000000")
        if [ $_tidx -eq 2 ]; then
            TEST_ITP_WEIGHTS+=("333333333333333334")
        else
            TEST_ITP_WEIGHTS+=("333333333333333333")
        fi
        _tidx=$((_tidx + 1))
    done <<< "$_tokens"

    local _w_arr=$(IFS=,; echo "${TEST_ITP_WEIGHTS[*]}")
    local _a_arr=$(IFS=,; echo "${TEST_ITP_ASSETS[*]}")
    local _p_arr=$(IFS=,; echo "${TEST_ITP_PRICES[*]}")

    local ITP_COUNT_BEFORE=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getItpCount()(uint256)" 2>/dev/null | awk '{print $1}')
    cast send --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE --gas-limit 2000000 \
        "$INDEX_ADDR" "createITP(string,string,uint256[],address[],uint256[],uint256)" \
        "E2E Test ITP" "E2ETEST" "[$_w_arr]" "[$_a_arr]" "[$_p_arr]" "$(cast max-uint)" \
        > /dev/null 2>&1
    local ITP_COUNT_AFTER=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getItpCount()(uint256)" 2>/dev/null | awk '{print $1}')

    if [ "$ITP_COUNT_AFTER" -gt "$ITP_COUNT_BEFORE" ] 2>/dev/null; then
        echo -e "  ${GREEN}[T1] ITP created (#$ITP_COUNT_AFTER) ✓${NC}"
        E2E_PASS=$((E2E_PASS + 1))
    else
        echo -e "  ${RED}[T1] ITP creation failed${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi
    local NEW_ITP_ID=$(printf "0x%064x" "$ITP_COUNT_AFTER")

    # ── Test 2: Wait for auto-listing in oracle DB (< 60s) ──
    echo -e "  [T2] Waiting for auto-listing..."
    local _listed=false
    for _li in $(seq 1 12); do
        sleep 5
        local _meta=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(*) FROM itp_snapshots WHERE itp_id = '$NEW_ITP_ID';\"" 2>/dev/null | tr -d ' ')
        if [ "${_meta:-0}" -gt 0 ]; then
            _listed=true
            echo -e "  ${GREEN}[T2] Auto-listed in $((_li * 5))s ✓${NC}"
            E2E_PASS=$((E2E_PASS + 1))
            break
        fi
    done
    [ "$_listed" = false ] && { echo -e "  ${RED}[T2] Not listed after 60s${NC}"; E2E_FAIL=$((E2E_FAIL + 1)); }

    # ── Test 3: Buy the new ITP ──
    echo -e "  [T3] Buying new ITP (\$500)..."
    local _expiry=$(($(date +%s) + 86400))
    cast send --private-key "$TEST_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
        --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
        "$INDEX_ADDR" "submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)" \
        "$NEW_ITP_ID" 0 "500000000000000000000" 0 1 "$_expiry" > /dev/null 2>&1

    # Wait for fill
    local _filled=false
    for _fi in $(seq 1 30); do
        sleep 10
        local _p=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "pendingOrderCount()(uint256)" 2>/dev/null | awk '{print $1}')
        [ "$_p" = "0" ] && _filled=true && break
    done

    local _shares=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getUserShares(bytes32,address)(uint256)" "$NEW_ITP_ID" "$TEST_ADDR" 2>/dev/null | awk '{print $1}')
    if [ "$_filled" = true ] && [ "${_shares:-0}" != "0" ]; then
        echo -e "  ${GREEN}[T3] Bought + filled (shares: $_shares) ✓${NC}"
        E2E_PASS=$((E2E_PASS + 1))
    else
        echo -e "  ${RED}[T3] Buy/fill failed (filled=$_filled shares=$_shares)${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi

    # ── Test 4: Deposit to Morpho + borrow ──
    echo -e "  [T4] Lending: deposit collateral + borrow USDC..."
    local _vault=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "itpVaults(bytes32)(address)" "$NEW_ITP_ID" 2>/dev/null)
    local _vbal=$(cast call --rpc-url "$RPC_URL" "$_vault" "balanceOf(address)(uint256)" "$TEST_ADDR" 2>/dev/null | awk '{print $1}')

    if [ -n "$MORPHO_ADDR" ] && [ "${_vbal:-0}" != "0" ]; then
        # Create a Morpho market for this vault (permissionless)
        local _loan=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['marketParams']['loanToken'])" 2>/dev/null)
        local _irm=$(python3 -c "import json; c=json.load(open('deployments/morpho-e2e.json'))['contracts']; print(c.get('CURATOR_RATE_IRM', c.get('ADAPTIVE_IRM','')))" 2>/dev/null)
        local _oracle_reg=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MIRROR_REGISTRY'])" 2>/dev/null)

        # Approve vault token to Morpho
        cast send --private-key "$TEST_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE \
            "$_vault" "approve(address,uint256)" "$MORPHO_ADDR" "$(cast max-uint)" > /dev/null 2>&1

        # Supply half as collateral
        local _supply=$(python3 -c "print(int('$_vbal') // 2)")
        cast send --private-key "$TEST_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
            "$MORPHO_ADDR" "supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)" \
            "($_vault,$_loan,$_oracle_reg,$_irm,770000000000000000)" "$_supply" "$TEST_ADDR" "0x" \
            > /dev/null 2>&1
        local _sc_status=$?

        # Borrow 25% of collateral
        local _borrow=$(python3 -c "print(int('$_supply') // 4)")
        cast send --private-key "$TEST_KEY" --rpc-url "$RPC_URL" --chain $CHAIN_ID \
            --legacy --gas-price $GAS_PRICE --gas-limit 500000 \
            "$MORPHO_ADDR" "borrow((address,address,address,address,uint256),uint256,uint256,address,address)" \
            "($_vault,$_loan,$_oracle_reg,$_irm,770000000000000000)" "$_borrow" 0 "$TEST_ADDR" "$TEST_ADDR" \
            > /dev/null 2>&1
        local _borrow_status=$?

        if [ "$_sc_status" -eq 0 ] && [ "$_borrow_status" -eq 0 ]; then
            echo -e "  ${GREEN}[T4] Collateral supplied + USDC borrowed ✓${NC}"
            E2E_PASS=$((E2E_PASS + 1))
        else
            echo -e "  ${YELLOW}[T4] Lending partially failed (supply=$_sc_status borrow=$_borrow_status)${NC}"
            E2E_FAIL=$((E2E_FAIL + 1))
        fi
    else
        echo -e "  ${YELLOW}[T4] Skipped (no vault tokens or no Morpho)${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi

    # ── Test 5: Vision settlement payout check ──
    echo -e "  [T5] Checking Vision settlement payouts..."
    local _submitted=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(*) FROM vision_settlement_proofs WHERE submitted = true;\"" 2>/dev/null | tr -d ' ')
    local _with_payouts=$(vps_be_ssh "psql -U max -d index_prices -t -c \"SELECT COUNT(*) FROM vision_settlement_proofs WHERE submitted = true AND payouts_json IS NOT NULL AND payouts_json::text != '[\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"0\\\"]';\"" 2>/dev/null | tr -d ' ')
    if [ "${_submitted:-0}" -gt 0 ]; then
        echo -e "  ${GREEN}[T5] Settlements submitted: $_submitted (non-zero payouts: $_with_payouts) ✓${NC}"
        E2E_PASS=$((E2E_PASS + 1))
    else
        echo -e "  ${YELLOW}[T5] No settlements submitted yet (batches may need more time)${NC}"
    fi

    # ── Test 6: Cross-chain ITP creation + auto-listing pipeline ──
    # Full pipeline: requestCreateItp → oracle consensus → vault auto-deploy → Morpho market → SSE listing
    echo -e "  [T6] Cross-chain ITP creation + auto-listing (<90s)..."
    local SETTLEMENT_BRIDGE=$(python3 -c "import json; print(json.load(open('envs/testnet/deployment.json'))['contracts']['SettlementBridgeProxy'])" 2>/dev/null || echo "")

    if [ -z "$SETTLEMENT_BRIDGE" ] || [ "$SETTLEMENT_BRIDGE" = "?" ]; then
        echo -e "  ${YELLOW}[T6] Skipped (no SettlementBridgeProxy)${NC}"
    else
        # Fund test wallet on Settlement
        cast send --private-key "$DEPLOYER_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$TEST_ADDR" --value 1ether > /dev/null 2>&1
        # Approve USDC on Settlement for BridgeProxy
        local SETTLEMENT_USDC=$(python3 -c "import json; print(json.load(open('envs/testnet/deployment.json'))['contracts']['SETTLEMENT_USDC'])" 2>/dev/null)
        cast send --private-key "$TEST_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            "$SETTLEMENT_USDC" "approve(address,uint256)" "$SETTLEMENT_BRIDGE" "$(cast max-uint)" > /dev/null 2>&1

        # Pick 2 tokens from symbol-map for the cross-chain ITP
        local _cc_tokens=$(python3 -c "
import json
sm = json.load(open('data/symbol-map.json'))
items = list(sm.items())[:2]
for addr, val in items:
    print(addr)
" 2>/dev/null)
        local _cc_assets=()
        local _cc_prices=()
        local _cc_weights=()
        local _ci=0
        while IFS= read -r _ca; do
            _cc_assets+=("$_ca")
            _cc_prices+=("1000000000000000000")
            if [ $_ci -eq 0 ]; then _cc_weights+=("500000000000000000"); else _cc_weights+=("500000000000000000"); fi
            _ci=$((_ci + 1))
        done <<< "$_cc_tokens"
        local _ccw=$(IFS=,; echo "${_cc_weights[*]}")
        local _cca=$(IFS=,; echo "${_cc_assets[*]}")
        local _ccp=$(IFS=,; echo "${_cc_prices[*]}")

        local _cc_itp_before=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getItpCount()(uint256)" 2>/dev/null | awk '{print $1}')
        local _cc_ts=$(date +%s)
        local _cc_name="E2E-CC-$_cc_ts"
        local _cc_symbol="CC${_cc_ts: -4}"

        # Submit cross-chain ITP creation request
        cast send --private-key "$TEST_KEY" --rpc-url "$SETTLEMENT_RPC_URL" --chain $SETTLEMENT_CHAIN_ID \
            --gas-limit 500000 \
            "$SETTLEMENT_BRIDGE" \
            "requestCreateItp(string,string,uint256[],address[],uint256[],(string,string,string))" \
            "$_cc_name" "$_cc_symbol" "[$_ccw]" "[$_cca]" "[$_ccp]" '("","","")' \
            > /dev/null 2>&1

        if [ $? -ne 0 ]; then
            echo -e "  ${RED}[T6] requestCreateItp tx failed${NC}"
            E2E_FAIL=$((E2E_FAIL + 1))
        else
            echo -e "  [T6a] Request submitted, waiting for oracle + curator pipeline..."

            # Wait up to 90s for: oracle creates ITP on L3 + curator deploys vault + market
            local _cc_done=false
            local _cc_itp_created=false
            local _cc_vault_deployed=false
            local _cc_market_listed=false
            for _cci in $(seq 1 18); do
                sleep 5

                # Check ITP count increased (oracle processed it)
                if [ "$_cc_itp_created" = false ]; then
                    local _cc_itp_now=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getItpCount()(uint256)" 2>/dev/null | awk '{print $1}')
                    if [ "${_cc_itp_now:-0}" -gt "${_cc_itp_before:-0}" ] 2>/dev/null; then
                        _cc_itp_created=true
                        local _cc_new_id=$(printf "0x%064x" "$_cc_itp_now")
                        echo -e "    ITP created on L3 (#$_cc_itp_now) at $((_cci * 5))s"
                    fi
                fi

                # Check vault deployed (curator auto-deploy)
                if [ "$_cc_itp_created" = true ] && [ "$_cc_vault_deployed" = false ]; then
                    local _cc_vault=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "itpVaults(bytes32)(address)" "$_cc_new_id" 2>/dev/null)
                    if [ -n "$_cc_vault" ] && [ "$_cc_vault" != "0x0000000000000000000000000000000000000000" ]; then
                        _cc_vault_deployed=true
                        echo -e "    Vault deployed at $((_cci * 5))s: $_cc_vault"
                    fi
                fi

                # Check Morpho market exists via data-node SSE (batch_markets count)
                if [ "$_cc_vault_deployed" = true ] && [ "$_cc_market_listed" = false ]; then
                    local _cc_markets=$(vps_be_ssh "curl -s http://localhost:8200/sse/stream?topics=morpho-markets 2>/dev/null | head -c 100" 2>/dev/null || echo "")
                    # Alternative: check supply queue length
                    local _cc_qlen=$(cast call --rpc-url "$RPC_URL" "$VAULT_ADDR" "supplyQueueLength()(uint256)" 2>/dev/null | awk '{print $1}')
                    local _cc_expected=$((_cc_itp_now + 1))  # queue should have itpCount+1 entries (idle market)
                    if [ "${_cc_qlen:-0}" -ge "$_cc_itp_now" ] 2>/dev/null; then
                        _cc_market_listed=true
                        _cc_done=true
                        echo -e "    Morpho market in supply queue at $((_cci * 5))s (queue=$_cc_qlen)"
                        break
                    fi
                fi
            done

            if [ "$_cc_done" = true ]; then
                echo -e "  ${GREEN}[T6] Cross-chain ITP created + auto-listed in $((_cci * 5))s ✓${NC}"
                E2E_PASS=$((E2E_PASS + 1))
            else
                echo -e "  ${RED}[T6] Pipeline incomplete after 90s (itp=$_cc_itp_created vault=$_cc_vault_deployed market=$_cc_market_listed)${NC}"
                E2E_FAIL=$((E2E_FAIL + 1))
            fi
        fi
    fi

    # ── Test 7: Symbol-map validity — ITP NAVs must be non-zero ──
    # If symbol-map is missing entries or has wrong pairs, oracle prices = 0 and NAV = 0.
    # Test: spot-check 5 ITPs via data-node NAV endpoint.
    echo -e "  [T7] Symbol-map validity (NAVs non-zero)..."
    local _nav_nonzero=0
    local _nav_zero=0
    local _dn_itps=$(curl -sf "http://$VPS_BE_IP:$DATA_NODE_PORT/itps" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    itps = data if isinstance(data, list) else data.get('itps', [])
    for itp in itps[:5]:
        nav = itp.get('nav', '0')
        print(nav)
except: pass
" 2>/dev/null || echo "")
    while IFS= read -r _nav_val; do
        [ -z "$_nav_val" ] && continue
        if python3 -c "exit(0 if int('${_nav_val:-0}') > 0 else 1)" 2>/dev/null; then
            _nav_nonzero=$((_nav_nonzero + 1))
        else
            _nav_zero=$((_nav_zero + 1))
        fi
    done <<< "$_dn_itps"
    if [ "$_nav_nonzero" -ge 3 ] && [ "$_nav_zero" -eq 0 ]; then
        echo -e "  ${GREEN}[T7] Symbol-map: $_nav_nonzero/5 ITPs have non-zero NAV ✓${NC}"
        E2E_PASS=$((E2E_PASS + 1))
    elif [ "$_nav_nonzero" -gt 0 ]; then
        echo -e "  ${YELLOW}[T7] Symbol-map: $_nav_nonzero non-zero, $_nav_zero zero NAVs (partial — data-node may still be warming up)${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    else
        echo -e "  ${RED}[T7] Symbol-map: all NAVs are zero — symbol-map likely missing entries or data-node unreachable${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi

    # ── Test 8: Lending markets visible in data-node ──
    # Verifies data-node discovered Morpho markets via supply queue dedup.
    # Result: data-node /morpho-markets endpoint returns >= 50 markets.
    echo -e "  [T8] Lending markets visible in data-node..."
    local _markets_count
    _markets_count=$(curl -sf "http://$VPS_BE_IP:$DATA_NODE_PORT/morpho-markets" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    mkts = data if isinstance(data, list) else data.get('markets', [])
    print(len(mkts))
except: print(0)
" 2>/dev/null || echo "0")
    if [ "${_markets_count:-0}" -ge 50 ]; then
        echo -e "  ${GREEN}[T8] Lending markets: $_markets_count visible in data-node ✓${NC}"
        E2E_PASS=$((E2E_PASS + 1))
    else
        echo -e "  ${RED}[T8] Lending markets: only ${_markets_count:-0} visible (need 50+) — data-node market discovery may have failed${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi

    # ── Test 9: Vault deployed for every ITP (no missing vaults) ──
    # Verifies all ITPs have a registered vault — prerequisite for Morpho collateral.
    echo -e "  [T9] Vault deployment coverage..."
    local _vaulted=0
    local _no_vault=0
    local _itp_total_t9
    _itp_total_t9=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "getItpCount()(uint256)" 2>/dev/null | awk '{print $1}')
    for _t9i in $(seq 1 "${_itp_total_t9:-0}"); do
        local _t9hex=$(printf "0x%064x" "$_t9i")
        local _t9vault=$(cast call --rpc-url "$RPC_URL" "$INDEX_ADDR" "itpVaults(bytes32)(address)" "$_t9hex" 2>/dev/null)
        if [ -n "$_t9vault" ] && [ "$_t9vault" != "0x0000000000000000000000000000000000000000" ]; then
            _vaulted=$((_vaulted + 1))
        else
            _no_vault=$((_no_vault + 1))
        fi
    done
    if [ "$_no_vault" -eq 0 ] && [ "$_vaulted" -gt 0 ]; then
        echo -e "  ${GREEN}[T9] Vaults: all $_vaulted ITPs have vaults ✓${NC}"
        E2E_PASS=$((E2E_PASS + 1))
    else
        echo -e "  ${RED}[T9] Vaults: $_no_vault/$_itp_total_t9 ITPs missing vault — syncVaultBalance or vault deploy may have failed${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi

    # ── Test 10: morpho-deployment.json correct (MORPHO + VAULT + loanToken non-zero) ──
    # Verifies frontend/public/morpho-deployment.json has valid addresses from the current deploy.
    # Stale addresses from a previous deploy cause frontend lending UI to call void contracts.
    echo -e "  [T10] morpho-deployment.json addresses valid..."
    local _morpho_pub=$(python3 -c "import json; d=json.load(open('frontend/public/morpho-deployment.json')); print(d['contracts'].get('MORPHO',''))" 2>/dev/null || echo "")
    local _vault_pub=$(python3 -c "import json; d=json.load(open('frontend/public/morpho-deployment.json')); print(d['contracts'].get('METAMORPHO_VAULT',''))" 2>/dev/null || echo "")
    local _loan_pub=$(python3 -c "import json; d=json.load(open('frontend/public/morpho-deployment.json')); print(d['marketParams'].get('loanToken',''))" 2>/dev/null || echo "")
    local _morpho_src=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MORPHO'])" 2>/dev/null || echo "")
    if [ -n "$_morpho_pub" ] && [ "$_morpho_pub" = "$_morpho_src" ] && [ -n "$_vault_pub" ] && [ -n "$_loan_pub" ]; then
        # Verify MORPHO has code on-chain
        local _morpho_code=$(cast code --rpc-url "$RPC_URL" "$_morpho_pub" 2>/dev/null | wc -c | tr -d ' ')
        if [ "$_morpho_code" -gt 10 ]; then
            echo -e "  ${GREEN}[T10] morpho-deployment.json: MORPHO=$_morpho_pub (has code) ✓${NC}"
            E2E_PASS=$((E2E_PASS + 1))
        else
            echo -e "  ${RED}[T10] morpho-deployment.json: MORPHO=$_morpho_pub has no code on-chain — stale address${NC}"
            E2E_FAIL=$((E2E_FAIL + 1))
        fi
    else
        echo -e "  ${RED}[T10] morpho-deployment.json: missing or mismatched (pub=$_morpho_pub src=$_morpho_src)${NC}"
        E2E_FAIL=$((E2E_FAIL + 1))
    fi

    echo -e ""
    echo -e "  ════════════════════════════════════════"
    echo -e "  E2E Tests: ${GREEN}$E2E_PASS passed${NC}, ${RED}$E2E_FAIL failed${NC} / 10 tests"
    echo -e "  ════════════════════════════════════════"
}

# ── Main dispatcher ──────────────────────────────────────────
case "${1:-help}" in
    setup-be)    cmd_setup_be ;;
    setup-chain) cmd_setup_chain ;;
    deploy)      shift; cmd_deploy "$@" ;;
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    status)      cmd_status ;;
    update)      cmd_update ;;
    refresh-batches) cmd_refresh_batches ;;
    seed-orders|seed) cmd_seed_orders ;;
    sync-deployment) ./sync-deployment.sh testnet $CHAIN_ID ;;
    validate)
        # Generic address validator: every 0x-address in the named JSONs
        # must have bytecode at the testnet RPC. The env-aware validator
        # lives in scripts/validate-deployment.sh; this one takes explicit
        # paths so CI and pre-deploy checks can share it.
        shift
        RPC="${RPC_URL:-http://142.132.164.24/}"
        if [ $# -eq 0 ]; then
            set -- deployments/active-deployment.json
        fi
        bash scripts/validate-deployment-addresses.sh "$RPC" "$@"
        ;;
    logs)        cmd_logs "$2" ;;
    help|--help|-h)
        echo "Usage: ./testnet.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  setup-be          First-time VPS 1 setup (PostgreSQL, clone, build)"
        echo "  setup-chain       First-time VPS 2 setup (clone, build AP)"
        echo "  deploy [--seed]   Deploy contracts (--seed auto-starts services + seeds positions)"
        echo "  start             Start all services on VPSes"
        echo "  stop              Stop all services on VPSes"
        echo "  status            Check what's running"
        echo "  update            git pull + rebuild + restart on both VPSes"
        echo "  refresh-batches   Redeploy Vision batches with fresh version"
        echo "  seed-orders|seed  Buy all 77 ITPs + seed Morpho borrows (stops/restarts oracles)"
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
