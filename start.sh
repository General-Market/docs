#!/bin/bash
# start.sh - Launch full Index L3 local development environment
#
# Deploys ALL contracts (core + 100-asset ITP + Bitget tokens + Morpho),
# generates symbol map, syncs frontend addresses, and starts issuers + AP
# with real Bitget price proxy enabled.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration (basic — chain/RPC set after system.env to avoid overwrite)
ISSUER_COUNT=${ISSUER_COUNT:-3}
SKIP_DEPLOY=${SKIP_DEPLOY:-false}
NO_TAIL=${NO_TAIL:-false}
DEPLOYER_KEY=${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
TEST_USER_KEY=${TEST_USER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}
TEST_USER_ADDRESS=${TEST_USER_ADDRESS:-0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4}
AP_KEY=${AP_KEY:-0x582978b132648fe53de139c6b9297040a2757616cac9a2fd17aa167bdc6fa340}
# Vision bots use real private keys (no impersonation)
VISION_BOT_KEY=${VISION_BOT_KEY:-0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82}
VISION_BOT2_KEY=${VISION_BOT2_KEY:-0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892f8b25f3f12a69}

# Bitget credentials (dummy = public endpoints only, sufficient for price reads)
export BITGET_API_KEY=${BITGET_API_KEY:-dummy}
export BITGET_API_SECRET=${BITGET_API_SECRET:-dummysecretdummysecretdummysecret}
export BITGET_API_PASSPHRASE=${BITGET_API_PASSPHRASE:-dummypass}
export BITGET_READONLY_API_KEY=${BITGET_READONLY_API_KEY:-dummy}
export BITGET_READONLY_API_SECRET=${BITGET_READONLY_API_SECRET:-dummysecretdummysecretdummysecret}
export BITGET_READONLY_PASSPHRASE=${BITGET_READONLY_PASSPHRASE:-dummypass}

# Exchange mode: mock (default for local dev), testnet, or mainnet
export EXCHANGE_MODE="${EXCHANGE_MODE:-mock}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load system.env if present (Bitget credentials, etc.)
if [ -f "$SCRIPT_DIR/system.env" ]; then
    set -a && source "$SCRIPT_DIR/system.env" && set +a
fi
# Prefer real credentials from system.env (BITGET_PUB/PK/PASS) over dummy defaults
export BITGET_READONLY_API_KEY="${BITGET_PUB:-${BITGET_READONLY_API_KEY}}"
export BITGET_READONLY_API_SECRET="${BITGET_PK:-${BITGET_READONLY_API_SECRET}}"
export BITGET_READONLY_PASSPHRASE="${BITGET_PASS:-${BITGET_READONLY_PASSPHRASE}}"

# Local chain configuration — MUST be set AFTER sourcing system.env
# (system.env defines SETTLEMENT_RPC_URL pointing to real Settlement which would break local dev)
CHAIN_ID=111222333
RPC_URL="http://localhost:8545"
SETTLEMENT_CHAIN_ID=421611337
SETTLEMENT_RPC_URL="http://localhost:8546"

# Unset production contract addresses from system.env — local dev reads from deployment file
# (env vars have higher priority than --deployment-file, so stale prod addresses break local dev)
unset ISSUER_INDEX_ADDRESS ISSUER_GOVERNANCE_ADDRESS ISSUER_ISSUER_REGISTRY_ADDRESS
unset ISSUER_COLLATERAL_REGISTRY_ADDRESS ISSUER_BLS_CUSTODY_ADDRESS ISSUER_L3_BRIDGE_CUSTODY_ADDRESS
unset ISSUER_BRIDGE_PROXY_ADDRESS ISSUER_BITGET_VAULT ISSUER_SETTLEMENT_CUSTODY
unset ISSUER_RPC_URL ISSUER_SETTLEMENT_RPC_URL ISSUER_SETTLEMENT_CHAIN_ID ISSUER_LOG_LEVEL

# Add Foundry to PATH if not already available
if ! command -v anvil &>/dev/null && [ -d "$HOME/.foundry/bin" ]; then
    export PATH="$HOME/.foundry/bin:$PATH"
fi

TOTAL_STEPS=13

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║         INDEX L3 FULL LOCAL ENVIRONMENT                     ║"
    echo "║  Contracts + Bitget Tokens + Morpho + Services              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_help() {
    echo "Usage: ./start.sh [OPTIONS]"
    echo ""
    echo "Launches the full Index L3 local dev environment with ALL contracts."
    echo ""
    echo "Options:"
    echo "  --issuers N     Number of issuer nodes (default: 3)"
    echo "  --skip-deploy   Skip ALL contract deployment (use existing chain)"
    echo "  --no-tail       Don't tail logs after startup"
    echo "  --stress        Stress-test log profile (warn level, consensus/cycle at info)"
    echo "  --vision        Enable Vision subsystem (batches + bots) alongside Index"
    echo "  --help          Show this help message"
    echo ""
    echo "What gets deployed:"
    echo "  1. Anvil local chain (chain ID 111222333)"
    echo "  2. Core contracts (Index, BridgeProxy, SettlementBridgeCustody, etc.)"
    echo "  3. 100-asset ITP with equal weights"
    echo "  4. All Bitget token pairs (~627 tokens from live Bitget API)"
    echo "  5. Morpho Blue lending (Morpho, MetaMorpho vault, Oracle, IRM)"
    echo "  6. Frontend addresses synced automatically"
    echo "  7. Issuers with bitget-vault + real price verification"
    echo "  8. AP with real Bitget price proxy (684 live pairs)"
    echo ""
    echo "Environment Variables:"
    echo "  BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE"
    echo "    Real credentials for authenticated Bitget access."
    echo "    Defaults to dummy values (public ticker endpoint only)."
    echo ""
    echo "  BITGET_READONLY_API_KEY, BITGET_READONLY_API_SECRET, BITGET_READONLY_PASSPHRASE"
    echo "    Read-only credentials for issuer price verification."
    echo "    Defaults to dummy values."
}

# Log level (overridable via env or --stress flag)
LOG_LEVEL=${LOG_LEVEL:-info}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h) print_help; exit 0;;
        --issuers) ISSUER_COUNT="$2"; shift 2;;
        --skip-deploy) SKIP_DEPLOY=true; shift;;
        --no-tail) NO_TAIL=true; shift;;
        --no-test) NO_TEST=true; shift;;
        --stress) LOG_LEVEL=warn; export RUST_LOG="warn,issuer::consensus=info,issuer::cycle=info"; shift;;
        --vision) VISION_ENABLED=true; shift;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1;;
    esac
done

if ! [[ "$ISSUER_COUNT" =~ ^[0-9]+$ ]] || [ "$ISSUER_COUNT" -lt 1 ] || [ "$ISSUER_COUNT" -gt 20 ]; then
    echo -e "${RED}Error: --issuers must be 1-20${NC}"; exit 1
fi

VISION_ENABLED=${VISION_ENABLED:-true}

print_banner

echo -e "${YELLOW}Configuration:${NC}"
echo "  Issuers: $ISSUER_COUNT | Skip deploy: $SKIP_DEPLOY | Tail logs: $([[ "$NO_TAIL" == "true" ]] && echo "no" || echo "yes") | Log level: $LOG_LEVEL | Exchange: $EXCHANGE_MODE | Vision: $VISION_ENABLED"
echo ""

# ============ Prerequisites ============
echo -e "${YELLOW}Checking prerequisites...${NC}"

for cmd in anvil forge python3 curl; do
    if ! command -v $cmd &>/dev/null; then
        echo -e "${RED}Error: $cmd not found${NC}"; exit 1
    fi
done

if [ ! -f "target/release/issuer" ] || [ ! -f "target/release/ap" ] || [ ! -f "target/release/data-node" ]; then
    echo -e "${YELLOW}Building Rust binaries...${NC}"
    cargo build --release -p issuer -p ap -p data-node
fi

# Find pg_isready (may not be in PATH on macOS with Homebrew)
PG_ISREADY="pg_isready"
if ! command -v pg_isready &>/dev/null; then
    for pg_path in /opt/homebrew/opt/postgresql@{17,16,15,14}/bin/pg_isready /usr/local/opt/postgresql@{17,16,15,14}/bin/pg_isready; do
        if [ -x "$pg_path" ]; then
            PG_ISREADY="$pg_path"
            break
        fi
    done
fi
# Also find psql
PSQL="psql"
if ! command -v psql &>/dev/null; then
    for psql_path in /opt/homebrew/opt/postgresql@{17,16,15,14}/bin/psql /usr/local/opt/postgresql@{17,16,15,14}/bin/psql; do
        if [ -x "$psql_path" ]; then
            PSQL="$psql_path"
            break
        fi
    done
fi

echo -e "${GREEN}Prerequisites OK${NC}"

# Derive Vision bot addresses from private keys
VISION_BOT_ADDRESS=$(cast wallet address "$VISION_BOT_KEY")
VISION_BOT2_ADDRESS=$(cast wallet address "$VISION_BOT2_KEY")
echo -e "  Vision bot 1: $VISION_BOT_ADDRESS"
echo -e "  Vision bot 2: $VISION_BOT2_ADDRESS"
echo ""

mkdir -p logs deployments data

# ============ Cleanup ============
if [ -f .pids ]; then
    echo -e "${YELLOW}Cleaning up previous processes...${NC}"
    if [ "$SKIP_DEPLOY" = true ]; then
        # When skip-deploy, only stop non-Anvil processes (keep deployed chains alive)
        while read -r PID; do
            if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
                NAME=$(grep ":$PID$" .pids.info 2>/dev/null | cut -d: -f1 || echo "unknown")
                case "$NAME" in
                    anvil-l3|anvil-settlement|data-node|frontend) echo -e "  ${GREEN}Keeping $NAME (PID: $PID)${NC}" ;;
                    *) kill "$PID" 2>/dev/null || true ;;
                esac
            fi
        done < .pids
    else
        ./stop.sh 2>/dev/null || true
    fi
fi
rm -f .pids .pids.info

# Kill any leftover processes on our ports and wait for ports to be free
# When --skip-deploy is used, keep Anvils alive (they have deployed contracts)
SKIP_ANVIL_KILL=${SKIP_DEPLOY}
for port in 3000 8545 8546 8200 9001 9002 9003 9100; do
    if [ "$SKIP_ANVIL_KILL" = true ] && { [ "$port" = "8545" ] || [ "$port" = "8546" ]; }; then
        continue
    fi
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
# Wait for ports to actually be released by the OS
for attempt in $(seq 1 20); do
    BUSY=false
    for port in 8545 8546; do
        if lsof -ti:$port > /dev/null 2>&1; then
            if [ "$SKIP_ANVIL_KILL" = true ]; then
                continue
            fi
            BUSY=true
            lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
            break
        fi
    done
    if ! $BUSY; then break; fi
    sleep 0.5
done

# Clean stale deployment artifacts for fresh deploy
if [ "$SKIP_DEPLOY" = false ]; then
    rm -f data/symbol-map.json data/ap_block_tracker.json
    rm -f deployments/active-deployment.json deployments/morpho-e2e.json
    rm -f logs/deploy-*.log
    # Always clear broadcast (nonce tracking), only clear cache if contracts changed
    rm -rf contracts/broadcast
    if [ -n "$(git diff --name-only HEAD -- contracts/src/ contracts/script/ 2>/dev/null)" ] || \
       [ ! -d contracts/cache ]; then
        rm -rf contracts/cache
        echo -e "  ${YELLOW}Forge cache cleared (contract changes detected)${NC}"
    fi
fi

# ============ STEP 1: Anvil (L3 + Settlement) ============
echo -e "${BLUE}[1/$TOTAL_STEPS] Starting Anvil chains (L3: $CHAIN_ID, Settlement: $SETTLEMENT_CHAIN_ID)...${NC}"

# When --skip-deploy is used and Anvils are already running, reuse them
if [ "$SKIP_DEPLOY" = true ] && lsof -ti:8545 > /dev/null 2>&1 && lsof -ti:8546 > /dev/null 2>&1; then
    ANVIL_L3_PID=$(lsof -ti:8545 | head -1)
    ANVIL_SETTLEMENT_PID=$(lsof -ti:8546 | head -1)
    echo $ANVIL_L3_PID >> .pids
    echo "anvil-l3:$ANVIL_L3_PID" >> .pids.info
    echo $ANVIL_SETTLEMENT_PID >> .pids
    echo "anvil-settlement:$ANVIL_SETTLEMENT_PID" >> .pids.info
    echo -e "  L3 Anvil: ${GREEN}reused (PID: $ANVIL_L3_PID)${NC}"
    echo -e "  Settlement Anvil: ${GREEN}reused (PID: $ANVIL_SETTLEMENT_PID)${NC}"
else
    nohup anvil --chain-id $CHAIN_ID --host 0.0.0.0 --port 8545 --accounts 100 -q > /dev/null 2>&1 &
    ANVIL_L3_PID=$!
    echo $ANVIL_L3_PID >> .pids
    echo "anvil-l3:$ANVIL_L3_PID" >> .pids.info

    nohup anvil --chain-id $SETTLEMENT_CHAIN_ID --host 0.0.0.0 --port 8546 --accounts 100 -q > /dev/null 2>&1 &
    ANVIL_SETTLEMENT_PID=$!
    echo $ANVIL_SETTLEMENT_PID >> .pids
    echo "anvil-settlement:$ANVIL_SETTLEMENT_PID" >> .pids.info
fi

# Poll both Anvils in parallel
wait_for_rpc() {
    local name="$1" url="$2"
    for i in {1..30}; do
        if curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
            "$url" > /dev/null 2>&1; then
            return 0
        fi
        sleep 0.5
    done
    return 1
}

wait_for_rpc "L3" "$RPC_URL" &
L3_WAIT_PID=$!
wait_for_rpc "Settlement" "$SETTLEMENT_RPC_URL" &
SETTLEMENT_WAIT_PID=$!

L3_OK=true; SETTLEMENT_OK=true
wait $L3_WAIT_PID || L3_OK=false
wait $SETTLEMENT_WAIT_PID || SETTLEMENT_OK=false

if $L3_OK; then
    echo -e "  L3 Anvil: ${GREEN}OK${NC}"
else
    echo -e "${RED}Error: L3 Anvil failed to start${NC}"; exit 1
fi
if $SETTLEMENT_OK; then
    echo -e "  Settlement Anvil: ${GREEN}OK${NC}"
else
    echo -e "${RED}Error: Settlement Anvil failed to start${NC}"; exit 1
fi

if [ "$SKIP_DEPLOY" = true ]; then
    echo -e "${BLUE}[2-6/$TOTAL_STEPS] Skipping contract deployment (--skip-deploy)${NC}"
    # Load existing addresses
    if [ ! -f deployments/active-deployment.json ]; then
        echo -e "${RED}Error: deployments/active-deployment.json not found${NC}"; exit 1
    fi
else
    # ============ STEP 2: Core contracts (both chains) ============
    echo -e "${BLUE}[2/$TOTAL_STEPS] Deploying core contracts (L3 + Settlement)...${NC}"
    cd contracts
    export PRIVATE_KEY=$DEPLOYER_KEY

    # Clean compiled artifacts to prevent stale bytecode
    forge clean > /dev/null 2>&1

    # 2a: Deploy to L3
    if ! forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-core-l3.log 2>&1; then
        echo -e "${RED}Error: L3 core deployment failed${NC}"
        tail -20 ../logs/deploy-core-l3.log
        exit 1
    fi
    echo -e "  ${GREEN}L3 core contracts deployed${NC}"

    # Save L3 deployment before Settlement deploy overwrites e2e-full-system.json
    # (Settlement deploy sets chainId=42161, but AP/issuers need L3 chainId=111222333)
    [ -f ../deployments/e2e-full-system.json ] && cp ../deployments/e2e-full-system.json ../deployments/e2e-full-system-l3.json

    # 2b: Deploy to Settlement (same deployer, fresh Anvil → identical addresses)
    if ! forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --broadcast --slow --rpc-url $SETTLEMENT_RPC_URL > ../logs/deploy-core-settlement.log 2>&1; then
        echo -e "${RED}Error: Settlement core deployment failed${NC}"
        tail -20 ../logs/deploy-core-settlement.log
        exit 1
    fi
    echo -e "  ${GREEN}Settlement core contracts deployed (mirror)${NC}"
    cd ..

    # Copy the L3 deployment to active (AP/issuers expect L3 chain ID 111222333).
    # The Settlement deploy overwrites e2e-full-system.json with chainId=42161, so we
    # use the L3 version saved before Settlement deploy (addresses are identical).
    L3_DEPLOY="deployments/e2e-full-system-l3.json"
    if [ ! -f "$L3_DEPLOY" ] && [ -f deployments/e2e-full-system.json ]; then
        L3_DEPLOY="deployments/e2e-full-system.json"
    fi
    if [ -f "$L3_DEPLOY" ]; then
        cp "$L3_DEPLOY" deployments/active-deployment.json
        echo -e "  ${GREEN}Deployment JSON synced${NC}"
    else
        echo -e "${RED}Error: Deployment JSON not generated${NC}"; exit 1
    fi

    # Fund test user with native ETH on both chains
    TEST_USER=$TEST_USER_ADDRESS
    cast send --private-key $DEPLOYER_KEY --value 100ether $TEST_USER --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY --value 100ether $TEST_USER --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
    # NOTE: impersonation moved to after all deployments (Step 7) — Forge --broadcast
    # resets Anvil impersonation state, so impersonating here gets lost by Steps 3-6.
    echo -e "  ${GREEN}Test user $TEST_USER funded with 100 ETH on both chains${NC}"

    # Fund AP wallet with native ETH on Settlement (needed for gas on executeTrade + swapStable)
    AP_ADDR=$(cast wallet address $AP_KEY)
    cast send --private-key $DEPLOYER_KEY --value 100ether $AP_ADDR --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}AP $AP_ADDR funded with 100 ETH on Settlement${NC}"

    # Fund test user with USDC tokens on both chains
    L3_WUSDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['L3_WUSDC'])")
    SETTLEMENT_USDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['SETTLEMENT_USDC'])")
    cast send --private-key $DEPLOYER_KEY $L3_WUSDC "mint(address,uint256)" $TEST_USER 50000000000000000000000 --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $SETTLEMENT_USDC "mint(address,uint256)" $TEST_USER 50000000000 --rpc-url $RPC_URL > /dev/null 2>&1
    # Mint SETTLEMENT_USDC on Settlement too (frontend reads from Settlement)
    cast send --private-key $DEPLOYER_KEY $SETTLEMENT_USDC "mint(address,uint256)" $TEST_USER 50000000000 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}Test user funded with 50k L3_WUSDC (L3) + 50k SETTLEMENT_USDC (both chains)${NC}"

    # Fund Vision bots (Players for Vision) — Vision now lives on L3
    # Fund with GM (native) for gas + L3_WUSDC (18 dec) for deposits
    cast send --private-key $DEPLOYER_KEY --value 100ether $VISION_BOT_ADDRESS --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $L3_WUSDC "mint(address,uint256)" $VISION_BOT_ADDRESS 50000000000000000000000 --rpc-url $RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}Vision bot 1 $VISION_BOT_ADDRESS funded with 100 GM + 50k L3_WUSDC (L3)${NC}"
    cast send --private-key $DEPLOYER_KEY --value 100ether $VISION_BOT2_ADDRESS --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $L3_WUSDC "mint(address,uint256)" $VISION_BOT2_ADDRESS 50000000000000000000000 --rpc-url $RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}Vision bot 2 $VISION_BOT2_ADDRESS funded with 100 GM + 50k L3_WUSDC (L3)${NC}"

    # ============ STEP 3: 100-asset ITP ============
    echo -e "${BLUE}[3/$TOTAL_STEPS] Deploying 100-asset ITP...${NC}"

    # Extract addresses from deployment
    INDEX_ADDRESS=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])")
    MOCK_BITGET_VAULT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['MockBitgetVault'])")
    AP_ADDRESS=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['accounts']['ap'])")
    MOCK_USDT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('MOCK_USDT',''))" 2>/dev/null || echo "")
    SETTLEMENT_USDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['SETTLEMENT_USDC'])")

    # Register USDC + USDT as supported stablecoins in MockBitgetVault (for swapStable)
    # SETTLEMENT_USDC = 6 decimals, MOCK_USDT = 18 decimals (L3 standard)
    # Must register on BOTH chains since vault is deployed on both (AP uses Settlement RPC)
    if [ -n "$MOCK_USDT" ] && [ "$MOCK_USDT" != "" ]; then
        cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT \
            "setStableTokens(address,uint8,address,uint8)" \
            "$SETTLEMENT_USDC" 6 "$MOCK_USDT" 18 \
            --rpc-url $RPC_URL > /dev/null 2>&1
        cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT \
            "setStableTokens(address,uint8,address,uint8)" \
            "$SETTLEMENT_USDC" 6 "$MOCK_USDT" 18 \
            --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
        echo -e "  ${GREEN}MockBitgetVault: registered USDC=$SETTLEMENT_USDC(6dec) + USDT=$MOCK_USDT(18dec) for swapStable (both chains)${NC}"
    fi

    # Enable trading fee simulation (10 bps = 0.1%) on both chains
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setFee(uint256)" 10 --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setFee(uint256)" 10 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}MockBitgetVault: fee set to 10 bps (0.1%) on both chains${NC}"

    # Spread is now applied by AP using real Bitget bid/ask — vault spread = 0
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setSpread(uint256)" 0 --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setSpread(uint256)" 0 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}MockBitgetVault: spread=0 (real bid/ask applied by AP from /fast-prices)${NC}"

    # Fund vault with SETTLEMENT_USDC on Settlement chain (needed for fundSellOrder to pay users)
    # 1M USDC (6 decimals) = 1_000_000 * 10^6 = 1000000000000
    cast send --private-key $DEPLOYER_KEY $SETTLEMENT_USDC "mint(address,uint256)" $MOCK_BITGET_VAULT 1000000000000 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}MockBitgetVault: funded with 1M SETTLEMENT_USDC on Settlement (for sell order payouts)${NC}"

    # Fetch real Bitget prices for ITP creation (so NAV starts at ~$1, not ~$730)
    CREATION_PRICES_FILE="data/creation-prices.json"
    USE_CREATION_PRICES="false"
    BITGET_RESP=$(curl -sf --connect-timeout 10 --max-time 30 \
        "https://api.bitget.com/api/v2/spot/market/tickers" 2>/dev/null || echo "")
    if [ -n "$BITGET_RESP" ]; then
        PRICE_JSON=$(python3 -c "
import json, sys, math
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
                USE_CREATION_PRICES="true"
                echo -e "  Fetched $PRICE_COUNT Bitget prices for ITP creation"
            else
                echo -e "  ${YELLOW}Only $PRICE_COUNT prices found, using \$1 defaults${NC}"
            fi
        else
            echo -e "  ${YELLOW}Price extraction failed, using \$1 defaults${NC}"
        fi
        # Extract avg bid/ask spread from Bitget tickers for reporting
        BITGET_AVG_SPREAD=$(python3 -c "
import json, sys
resp = json.loads(sys.stdin.read())
tickers = resp.get('data', [])
spreads = []
for t in tickers:
    bid = float(t.get('bidPr', '0') or '0')
    ask = float(t.get('askPr', '0') or '0')
    if bid > 0 and ask > 0:
        mid = (bid + ask) / 2
        spreads.append((ask - bid) / mid * 10000)
if spreads:
    print(f'{sum(spreads)/len(spreads):.1f}')
else:
    print('0')
" <<< "$BITGET_RESP" 2>/dev/null || echo "0")
        echo -e "  Avg Bitget bid/ask spread: ${BITGET_AVG_SPREAD} bps across all tickers"

        # Save per-symbol spreads for cost-of-acquisition display
        python3 -c "
import json, sys
resp = json.loads(sys.stdin.read())
result = {}
for t in resp.get('data', []):
    bid = float(t.get('bidPr', '0') or '0')
    ask = float(t.get('askPr', '0') or '0')
    if bid > 0 and ask > 0:
        mid = (bid + ask) / 2
        result[t['symbol']] = round((ask - bid) / mid * 10000, 1)
json.dump(result, sys.stdout)
" <<< "$BITGET_RESP" > data/creation-spreads.json 2>/dev/null
    else
        echo -e "  ${YELLOW}Bitget API unreachable, using \$1 defaults${NC}"
    fi

    L3_WUSDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['L3_WUSDC'])")

    # 3a: Deploy to L3
    cd contracts
    if ! INDEX_ADDRESS=$INDEX_ADDRESS \
    MOCK_BITGET_VAULT=$MOCK_BITGET_VAULT \
    AP_ADDRESS=$AP_ADDRESS \
    L3_WUSDC=$L3_WUSDC \
    USE_CREATION_PRICES=$USE_CREATION_PRICES \
    forge script script/Deploy100AssetITP.s.sol:Deploy100AssetITP \
        --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-itp100-l3.log 2>&1; then
        echo -e "${RED}Error: ITP-100 L3 deployment failed${NC}"
        tail -20 ../logs/deploy-itp100-l3.log
        exit 1
    fi
    cd ..
    echo -e "  ${GREEN}100-asset ITP deployed on L3${NC}"

    # Merge 100-asset ITP data into active deployment
    python3 -c "
import json
deploy = json.load(open('deployments/active-deployment.json'))
itp100 = json.load(open('deployments/itp-100-asset.json'))
deploy['contracts']['itpId'] = itp100['itpId']
deploy['contracts']['ITP_Vault'] = itp100.get('itpVault', '')
json.dump(deploy, open('deployments/active-deployment.json', 'w'), indent=2)
"

    # 3b: Deploy to Settlement (same deployer account 1 + nonce → identical addresses)
    cd contracts
    if ! INDEX_ADDRESS=$INDEX_ADDRESS \
    MOCK_BITGET_VAULT=$MOCK_BITGET_VAULT \
    AP_ADDRESS=$AP_ADDRESS \
    L3_WUSDC=$L3_WUSDC \
    USE_CREATION_PRICES=$USE_CREATION_PRICES \
    forge script script/Deploy100AssetITP.s.sol:Deploy100AssetITP \
        --broadcast --slow --rpc-url $SETTLEMENT_RPC_URL > ../logs/deploy-itp100-settlement.log 2>&1; then
        echo -e "${RED}Error: ITP-100 Settlement deployment failed${NC}"
        tail -20 ../logs/deploy-itp100-settlement.log
        exit 1
    fi
    cd ..
    echo -e "  ${GREEN}100-asset ITP deployed on Settlement (mirror)${NC}"

    # 3c: Create BridgedITP on Settlement via requestCreateItp + completeCreateItp (BLS-signed)
    BRIDGE_PROXY=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['BridgeProxy'])")
    ITP_ID=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['itpId'])")
    ITP_NAME=$(python3 -c "import json; d=json.load(open('deployments/itp-100-asset.json')); print(d.get('name','Top 100 ITP'))" 2>/dev/null || echo "Top 100 ITP")
    ITP_SYMBOL=$(python3 -c "import json; d=json.load(open('deployments/itp-100-asset.json')); print(d.get('symbol','ITP100'))" 2>/dev/null || echo "ITP100")

    # Build comma-separated token addresses from itp-100-asset.json
    ITP_TOKENS=$(python3 -c "import json; print(','.join(json.load(open('deployments/itp-100-asset.json'))['tokens']))")

    cd contracts
    if ! BRIDGE_PROXY=$BRIDGE_PROXY \
    ITP_ID=$ITP_ID \
    ITP_NAME="$ITP_NAME" \
    ITP_SYMBOL="$ITP_SYMBOL" \
    ITP_TOKENS="$ITP_TOKENS" \
    forge script script/CreateBridgedItp.s.sol:CreateBridgedItp \
        --broadcast --slow --rpc-url $SETTLEMENT_RPC_URL > ../logs/deploy-bridged-itp.log 2>&1; then
        echo -e "${YELLOW}  Warning: BridgedITP creation failed (check logs/deploy-bridged-itp.log)${NC}"
    fi
    cd ..

    # Read BridgedITP address from BridgeProxy mapping
    BRIDGED_ITP=$(cast call $BRIDGE_PROXY "getBridgedItp(bytes32)(address)" "$ITP_ID" --rpc-url $SETTLEMENT_RPC_URL 2>/dev/null || echo "")
    if [ -n "$BRIDGED_ITP" ] && [ "$BRIDGED_ITP" != "0x0000000000000000000000000000000000000000" ]; then
        echo -e "  ${GREEN}BridgedITP created on Settlement: $BRIDGED_ITP${NC}"

        # setBridgeProxy is now done in DeployFullSystemE2E.s.sol Phase 6 (before BLS pubkey is set)
        echo -e "  ${GREEN}SettlementBridgeCustody.bridgeProxy set in deploy script${NC}"
        python3 -c "
import json
deploy = json.load(open('deployments/active-deployment.json'))
deploy['contracts']['BridgedITP'] = '$BRIDGED_ITP'
json.dump(deploy, open('deployments/active-deployment.json', 'w'), indent=2)
"
    else
        echo -e "  ${YELLOW}Warning: BridgedITP creation failed (sell won't work)${NC}"
    fi

    # 3d: Set ITP metadata (description + website) on BridgeProxy
    DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    cast send $BRIDGE_PROXY \
        "setItpMetadata(bytes32,string,string,string)" \
        "$ITP_ID" \
        "Top 100 crypto assets by market cap, equal-weighted. Rebalances weekly." \
        "https://www.generalmarket.io" \
        "" \
        --private-key $DEPLOYER_KEY \
        --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1 && \
        echo -e "  ${GREEN}ITP metadata set (description + website)${NC}" || \
        echo -e "  ${YELLOW}Warning: Failed to set ITP metadata${NC}"

    cp deployments/active-deployment.json frontend/lib/contracts/deployment.json

    # ============ STEP 4: Virtual Bitget tokens ============
    echo -e "${BLUE}[4/$TOTAL_STEPS] Generating virtual Bitget token addresses...${NC}"

    if ! python3 scripts/generate-virtual-tokens.py > logs/generate-virtual-tokens.log 2>&1; then
        echo -e "${RED}Error: Virtual token generation failed${NC}"
        tail -20 logs/generate-virtual-tokens.log
        exit 1
    fi

    TOKEN_COUNT=$(python3 -c "import json; print(len(json.load(open('data/symbol-map.json'))))")
    echo -e "  ${GREEN}${TOKEN_COUNT} Bitget pair tokens deployed${NC}"

    # Merge ITP tokens into symbol map using ON-CHAIN addresses (not simulation JSON).
    # Foundry simulation saves different addresses than broadcast produces, so we read
    # the actual L3 chain state via cast to get the real token addresses.
    ITP_ID_HEX=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['itpId'])")
    INDEX_FOR_MERGE=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])")
    python3 -c "
import json, subprocess, sys

# Read on-chain ITP state to get actual token addresses
result = subprocess.run(
    ['cast', 'call', '$INDEX_FOR_MERGE', 'getITPState(bytes32)', '$ITP_ID_HEX',
     '--rpc-url', 'http://localhost:8545'],
    capture_output=True, text=True
)
if result.returncode != 0:
    print(f'  WARNING: cast call failed: {result.stderr}', file=sys.stderr)
    sys.exit(0)

hex_data = result.stdout.strip()[2:]
words = [hex_data[i:i+64] for i in range(0, len(hex_data), 64)]

# Find the assets array: first word with value 100 (0x64) is the array length
asset_start = None
for i, w in enumerate(words):
    if int(w, 16) == 100 and i < len(words) - 100:
        # Verify next 100 words look like addresses (non-zero, fits in 160 bits)
        looks_like_addrs = all(0 < int(words[i+1+j], 16) < 2**160 for j in range(min(5, 100)))
        if looks_like_addrs:
            asset_start = i + 1
            break

if asset_start is None:
    print('  WARNING: Could not parse on-chain ITP assets')
    sys.exit(0)

on_chain_addrs = ['0x' + words[asset_start + j][24:] for j in range(100)]

# Read pairs from itp-100-asset.json (pair names are correct, addresses are not)
itp = json.load(open('deployments/itp-100-asset.json'))
pairs = itp.get('bitgetPairs', [])
if len(pairs) != 100:
    print(f'  WARNING: itp-100-asset.json has {len(pairs)} pairs, expected 100')
    sys.exit(0)

# Also patch itp-100-asset.json with correct on-chain addresses
sim_tokens = itp.get('tokens', [])
changed = sum(1 for a, s in zip(on_chain_addrs, sim_tokens) if a.lower() != s.lower())
itp['tokens'] = on_chain_addrs
json.dump(itp, open('deployments/itp-100-asset.json', 'w'), indent=2)

# Merge on-chain addresses into symbol map (always overwrite — ITP pair
# assignment takes precedence over the Bitget token deploy's assignment,
# which uses a different index offset and produces wrong pair mappings).
sm = json.load(open('data/symbol-map.json'))
updated = 0
for addr, pair in zip(on_chain_addrs, pairs):
    key = addr.lower()
    old = sm.get(key, {}).get('pair', '')
    sm[key] = {'pair': pair, 'source': 'bitget'}
    if old and old != pair:
        updated += 1
json.dump(sm, open('data/symbol-map.json', 'w'), indent=2)
print(f'  Patched {changed}/100 token addresses from on-chain state')
print(f'  Merged 100 ITP tokens into symbol map ({updated} pair corrections, total: {len(sm)})')
"

    # Regenerate assets.json from symbol-map so the collector tracks ALL symbols
    # Deduplicate by base symbol: prefer USDC pair over USDT
    python3 -c "
import json
sm = json.load(open('data/symbol-map.json'))
by_symbol = {}
for addr, info in sm.items():
    if not isinstance(info, dict) or 'pair' not in info:
        continue
    pair = info['pair']
    for suffix in ['USDC', 'USDT']:
        if pair.endswith(suffix):
            base = pair[:-len(suffix)]
            break
    else:
        base = pair
    # Prefer USDC over USDT
    if base in by_symbol:
        existing_pair = by_symbol[base]['bitget']
        if existing_pair.endswith('USDC'):
            continue
    by_symbol[base] = {'address': addr, 'bitget': pair}
assets = sorted(by_symbol.values(), key=lambda x: x['bitget'])
json.dump(assets, open('assets.json', 'w'), indent=2)
print(f'  Generated assets.json with {len(assets)} unique symbols from symbol-map')
"

    # Regenerate frontend deployed-assets.json from symbol-map (after ITP merge so addresses are current)
    # Deduplicate by base symbol: prefer USDC pair over USDT
    python3 -c "
import json
sm = json.load(open('data/symbol-map.json'))
by_symbol = {}
for addr, info in sorted(sm.items()):
    if not isinstance(info, dict) or 'pair' not in info:
        continue
    pair = info['pair']
    for suffix in ['USDC', 'USDT']:
        if pair.endswith(suffix):
            sym = pair[:-len(suffix)]
            break
    else:
        sym = pair
    # Prefer USDC over USDT
    if sym in by_symbol:
        existing_pair = by_symbol[sym]['_pair']
        if existing_pair.endswith('USDC'):
            continue
    by_symbol[sym] = {'address': addr, 'symbol': sym, '_pair': pair}
assets = [{'address': v['address'], 'symbol': v['symbol']} for v in sorted(by_symbol.values(), key=lambda x: x['symbol'])]
json.dump(assets, open('frontend/public/deployed-assets.json', 'w'), indent=2)
print(f'  Regenerated frontend/public/deployed-assets.json with {len(assets)} unique assets')
"

    # ============ STEP 5: Morpho lending ============
    echo -e "${BLUE}[5/$TOTAL_STEPS] Deploying Morpho Blue lending system...${NC}"

    cd contracts

    # Morpho is optional - don't let failures kill the whole script
    set +e

    # Read vault ERC20 token address from active-deployment.json (created in Step 3)
    # Morpho uses the L3 vault ERC20 as collateral (not BridgedITP on Settlement)
    VAULT_TOKEN=$(python3 -c "import json; print(json.load(open('../deployments/active-deployment.json'))['contracts']['ITP_Vault'])" 2>/dev/null || echo "")
    L3_WUSDC_ADDR=$(python3 -c "import json; print(json.load(open('../deployments/active-deployment.json'))['contracts']['L3_WUSDC'])" 2>/dev/null || echo "")

    if [ -z "$VAULT_TOKEN" ] || [ "$VAULT_TOKEN" = "None" ]; then
        echo -e "${YELLOW}  Warning: ITP_Vault not found in deployment, skipping Morpho${NC}"
    else
        # Phase 1: Deploy Morpho core on L3 (Morpho Blue + IRM + Oracle + MetaMorpho vault)
        # Oracle uses the MAIN IssuerRegistry (not a separate mirror) to avoid nonce desync
        MAIN_REGISTRY=$(python3 -c "import json; print(json.load(open('../deployments/active-deployment.json'))['contracts']['IssuerRegistry'])" 2>/dev/null || echo "")
        ITP_VAULT=$VAULT_TOKEN \
        SETTLEMENT_USDC=$L3_WUSDC_ADDR \
        ISSUER_REGISTRY=$MAIN_REGISTRY \
        forge script script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
            --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-morpho-phase1.log 2>&1

        if [ $? -eq 0 ]; then
            # Extract Phase 1 addresses from morpho-e2e.json
            METAMORPHO_VAULT=$(python3 -c "import json; print(json.load(open('../deployments/morpho-e2e.json'))['contracts']['METAMORPHO_VAULT'])" 2>/dev/null || echo "")
            ITP_NAV_ORACLE=$(python3 -c "import json; print(json.load(open('../deployments/morpho-e2e.json'))['contracts']['ITP_NAV_ORACLE'])" 2>/dev/null || echo "")
            ADAPTIVE_IRM=$(python3 -c "import json; print(json.load(open('../deployments/morpho-e2e.json'))['contracts']['ADAPTIVE_IRM'])" 2>/dev/null || echo "")

            # Advance time for MetaMorpho timelock (1 day + 1 second)
            # Advance BOTH chains to keep timestamps in sync
            cast rpc evm_increaseTime 86401 --rpc-url $RPC_URL > /dev/null 2>&1
            cast rpc evm_mine --rpc-url $RPC_URL > /dev/null 2>&1
            cast rpc evm_increaseTime 86401 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
            cast rpc evm_mine --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1

            # Phase 2: Configure vault + seed liquidity (on L3)
            ITP_VAULT=$VAULT_TOKEN \
            SETTLEMENT_USDC=$L3_WUSDC_ADDR \
            METAMORPHO_VAULT=$METAMORPHO_VAULT \
            ITP_NAV_ORACLE=$ITP_NAV_ORACLE \
            ADAPTIVE_IRM=$ADAPTIVE_IRM \
            forge script script/DeployMorphoE2E.s.sol:ConfigureMorphoE2E \
                --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-morpho-phase2.log 2>&1

            if [ $? -eq 0 ]; then
                # Refresh oracle lastUpdated (slot 2) — the evm_increaseTime above pushes
                # the oracle past MAX_STALENESS (24h), making price() revert.
                # Set lastUpdated to current block.timestamp so oracle reads stay fresh.
                if [ -n "$ITP_NAV_ORACLE" ]; then
                    CURRENT_TS=$(cast block latest --rpc-url $RPC_URL --json 2>/dev/null | python3 -c "import sys,json; print(hex(int(json.load(sys.stdin)['timestamp'],16)))" 2>/dev/null || echo "")
                    if [ -n "$CURRENT_TS" ]; then
                        PADDED_TS=$(python3 -c "print('0x' + hex(int('$CURRENT_TS', 16))[2:].zfill(64))")
                        cast rpc anvil_setStorageAt $ITP_NAV_ORACLE "0x0000000000000000000000000000000000000000000000000000000000000002" $PADDED_TS --rpc-url $RPC_URL > /dev/null 2>&1
                    fi
                fi
                echo -e "  ${GREEN}Morpho Blue deployed and configured${NC}"
            else
                echo -e "${YELLOW}  Warning: Morpho Phase 2 failed (check logs/deploy-morpho-phase2.log)${NC}"
            fi
        else
            echo -e "${YELLOW}  Warning: Morpho Phase 1 failed (check logs/deploy-morpho-phase1.log)${NC}"
        fi
    fi

    set -e
    cd ..

    # ============ STEP 6: Vision on L3 (dual-balance architecture) ============
    if [ "$VISION_ENABLED" = true ]; then
    echo -e "${BLUE}[6/$TOTAL_STEPS] Deploying Vision contract on L3...${NC}"

    ISSUER_REG_ADDR=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['IssuerRegistry'])")
    L3_WUSDC_ADDR=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['L3_WUSDC'])")

    cd contracts
    set +e
    ISSUER_REGISTRY=$ISSUER_REG_ADDR \
    USDC_ADDRESS=$L3_WUSDC_ADDR \
    forge script script/DeployVision.s.sol:DeployVision \
        --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-vision.log 2>&1

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}Vision contract deployed${NC}"

        # Merge Vision addresses into active deployment
        python3 -c "
import json
deploy = json.load(open('../deployments/active-deployment.json'))
vision = json.load(open('../deployments/vision-deployment.json'))
deploy['contracts']['Vision'] = vision['contracts']['Vision']
json.dump(deploy, open('../deployments/active-deployment.json', 'w'), indent=2)
"
        echo -e "  ${GREEN}Vision addresses merged into active-deployment.json${NC}"

        # Run Vision database migrations (issuer chain listener needs these tables)
        if $PG_ISREADY -q 2>/dev/null; then
            $PSQL -d index_prices -f ../issuer/migrations/001_create_vision_tables.sql > /dev/null 2>&1 || true
            $PSQL -d index_prices -f ../issuer/migrations/002_create_vision_deposit_tables.sql > /dev/null 2>&1 || true
            $PSQL -d index_prices -f ../issuer/migrations/003_create_vision_balance_proofs.sql > /dev/null 2>&1 || true
            # Reset chain listener bookmark (Anvil restarts from block 0 each session)
            $PSQL -d index_prices -c "UPDATE vision_kv_store SET value = '0' WHERE key = 'chain_listener_last_block';" > /dev/null 2>&1 || true
            $PSQL -d index_prices -c "TRUNCATE vision_batches, vision_positions, vision_tick_results;" > /dev/null 2>&1 || true
            echo -e "  ${GREEN}Vision database tables created (bookmark reset)${NC}"
        fi
    else
        echo -e "${YELLOW}  Warning: Vision deployment failed (check logs/deploy-vision.log)${NC}"
    fi
    set -e
    cd ..

    # ============ STEP 6b: Deploy all Vision batches (BLS-signed) ============
    echo -e "${BLUE}[6b/$TOTAL_STEPS] Deploying all Vision batches (BLS-signed, 1-2 tx via bulk helper)...${NC}"

    VISION_ADDR_BATCH=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
    if [ -n "$VISION_ADDR_BATCH" ] && [ "$VISION_ADDR_BATCH" != "" ]; then
        cd contracts
        set +e
        VISION_ADDRESS=$VISION_ADDR_BATCH \
        forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
            --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-vision-batches.log 2>&1

        if [ $? -eq 0 ]; then
            BATCH_COUNT=$(python3 -c "import json; print(json.load(open('../deployments/vision-batches.json')).get('batchCount',0))" 2>/dev/null || echo "0")
            echo -e "  ${GREEN}$BATCH_COUNT Vision batches deployed in 2 txs${NC}"

            # Copy batch mapping to frontend
            cp ../deployments/vision-batches.json ../frontend/lib/contracts/vision-batches.json 2>/dev/null || true
        else
            echo -e "${RED}Error: Vision batch deployment failed${NC}"
            tail -20 ../logs/deploy-vision-batches.log
        fi
        set -e
        cd ..
    else
        echo -e "${YELLOW}  Warning: Vision address not found, skipping batch deployment${NC}"
    fi
    else
        echo -e "${BLUE}[6/$TOTAL_STEPS] Skipping Vision deployment (use --vision to enable)${NC}"
    fi  # end VISION_ENABLED

fi  # end SKIP_DEPLOY

# ============ STEP 7: Sync frontend addresses ============
echo -e "${BLUE}[7/$TOTAL_STEPS] Syncing frontend addresses...${NC}"

# Copy deployment JSON directly — frontend imports it as single source of truth
if [ -f "deployments/active-deployment.json" ]; then
    cp deployments/active-deployment.json frontend/lib/contracts/deployment.json
    echo "  Copied deployment.json → frontend/lib/contracts/deployment.json"
else
    echo "  No deployment file, skipping"
fi

# Copy morpho deployment if it exists
if [ -f "deployments/morpho-e2e.json" ]; then
    cp deployments/morpho-e2e.json frontend/lib/contracts/morpho-deployment.json
    echo "  Copied morpho-e2e.json → frontend/lib/contracts/morpho-deployment.json"
fi

# Sync generated JSONs back to envs/local/ so switch-env.sh local stays current
if [ -d "envs/local" ]; then
    [ -f "deployments/active-deployment.json" ] && cp deployments/active-deployment.json envs/local/deployment.json
    [ -f "deployments/morpho-e2e.json" ] && cp deployments/morpho-e2e.json envs/local/morpho-deployment.json
    [ -f "deployments/vision-batches.json" ] && cp deployments/vision-batches.json envs/local/vision-batches.json
    # Update VISION_ADDRESS in envs/local/.env from deployment JSON
    VISION_ADDR=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
    if [ -n "$VISION_ADDR" ] && [ -f "envs/local/.env" ]; then
        sed -i '' "s|^NEXT_PUBLIC_VISION_ADDRESS=.*|NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}|" envs/local/.env
    fi
    echo "  Synced deployment JSONs + Vision address → envs/local/"
fi

echo "  Address sync complete"

# Impersonate test user on both Anvils so mock wallet can send eth_sendTransaction.
# MUST be after all forge --broadcast deployments — Forge broadcast resets Anvil impersonation state.
TEST_USER=$TEST_USER_ADDRESS
cast rpc anvil_impersonateAccount $TEST_USER --rpc-url $RPC_URL > /dev/null 2>&1
cast rpc anvil_impersonateAccount $TEST_USER --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
echo -e "  ${GREEN}Test user $TEST_USER impersonated on both Anvils${NC}"

# Start background block miner — services need blocks to advance for event detection.
# Anvil automine only creates blocks on transactions; this loop creates empty blocks
# every 1 second so services reliably detect cross-chain events between transactions.
# Must be AFTER all deployments (automine handles those instantly).
nohup bash -c "while true; do cast rpc evm_mine --rpc-url $RPC_URL > /dev/null 2>&1; cast rpc evm_mine --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1; sleep 1; done" > /dev/null 2>&1 &
MINER_PID=$!
echo $MINER_PID >> .pids
echo "block-miner:$MINER_PID" >> .pids.info
echo -e "  ${GREEN}Background block miner started (1s interval, PID: $MINER_PID)${NC}"

# ============ STEP 8: Data-node ============
# Data-node serves a REST API on port 8200 for asset prices, ITP NAV, and chart data.
# Requires PostgreSQL. If unavailable, issuers fall back to Bitget direct price feeds.
echo -e "${BLUE}[8/$TOTAL_STEPS] Starting data-node service...${NC}"

INDEX_ADDRESS=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])" 2>/dev/null || echo "")
DATA_NODE_RUNNING=false

# Mutual exclusion: check if VPS data-node is already running (shared API keys)
VPS_DN_RUNNING=false
if ssh index-maker/prod/postgres "pgrep -x data-node > /dev/null 2>&1" 2>/dev/null; then
    VPS_DN_RUNNING=true
fi

if [ "$VPS_DN_RUNNING" = true ]; then
    echo -e "  ${YELLOW}VPS data-node is running — skipping local (shared API keys)${NC}"
    echo -e "  ${YELLOW}Stop VPS first: ./deploy.sh --stop${NC}"
    # Still set DATA_NODE_URL to VPS for issuers/AP to use
    export DATA_NODE_URL="http://142.132.164.24:8200"
    DATA_NODE_RUNNING=true
elif ! $PG_ISREADY -q 2>/dev/null; then
    echo -e "  ${YELLOW}PostgreSQL not running — skipping data-node${NC}"
    echo -e "  ${YELLOW}Charts won't work. Start PostgreSQL and re-run.${NC}"
else
    # Load API keys from .env.data-node if it exists
    if [ -f "$SCRIPT_DIR/.env.data-node" ]; then
        set -a
        source "$SCRIPT_DIR/.env.data-node"
        set +a
    fi

    # On fresh deploy, pass --reset-session so data-node truncates session tables
    # and resets cursors atomically before collectors start
    RESET_SESSION_FLAG=""
    if [ "$SKIP_DEPLOY" = false ]; then
        RESET_SESSION_FLAG="--reset-session"
    fi

    nohup ./target/release/data-node serve \
        --database-url postgres://localhost/index_prices \
        --symbol-map "$SCRIPT_DIR/data/symbol-map.json" \
        --rpc-url $RPC_URL \
        --settlement-rpc-url $SETTLEMENT_RPC_URL \
        --deployment-file deployments/active-deployment.json \
        --morpho-deployment-file deployments/morpho-e2e.json \
        ${INDEX_ADDRESS:+--index-address $INDEX_ADDRESS} \
        ${FINNHUB_API_KEY:+--finnhub-api-key "$FINNHUB_API_KEY"} \
        ${COINGECKO_API_KEY:+--coingecko-api-key "$COINGECKO_API_KEY"} \
        ${FRED_API_KEY:+--fred-api-key "$FRED_API_KEY"} \
        ${BLS_API_KEY:+--bls-api-key "$BLS_API_KEY"} \
        ${NASDAQ_API_KEY:+--nasdaq-api-key "$NASDAQ_API_KEY"} \
        ${TWITCH_CLIENT_ID:+--twitch-client-id "$TWITCH_CLIENT_ID"} \
        ${TWITCH_CLIENT_SECRET:+--twitch-client-secret "$TWITCH_CLIENT_SECRET"} \
        ${TMDB_API_KEY:+--tmdb-api-key "$TMDB_API_KEY"} \
        ${LASTFM_API_KEY:+--lastfm-api-key "$LASTFM_API_KEY"} \
        ${BACKPACKTF_API_KEY:+--backpacktf-api-key "$BACKPACKTF_API_KEY"} \
        ${MOVEBANK_USER:+--movebank-user "$MOVEBANK_USER"} \
        ${MOVEBANK_PASSWORD:+--movebank-password "$MOVEBANK_PASSWORD"} \
        ${EBIRD_API_KEY:+--ebird-api-key "$EBIRD_API_KEY"} \
        ${CLOUDFLARE_RADAR_TOKEN:+--cloudflare-radar-token "$CLOUDFLARE_RADAR_TOKEN"} \
        ${TREASURY_API_KEY:+--treasury-api-key "$TREASURY_API_KEY"} \
        ${EIA_API_KEY:+--eia-api-key "$EIA_API_KEY"} \
        ${GITHUB_TOKEN:+--github-token "$GITHUB_TOKEN"} \
        ${NASA_FIRMS_MAP_KEY:+--nasa-firms-key "$NASA_FIRMS_MAP_KEY"} \
        ${AISSTREAM_API_KEY:+--aisstream-api-key "$AISSTREAM_API_KEY"} \
        ${FINRA_CLIENT_ID:+--finra-client-id "$FINRA_CLIENT_ID"} \
        ${FINRA_CLIENT_SECRET:+--finra-client-secret "$FINRA_CLIENT_SECRET"} \
        ${BGG_API_TOKEN:+--bgg-api-token "$BGG_API_TOKEN"} \
        ${BESTBUY_API_KEY:+--bestbuy-api-key "$BESTBUY_API_KEY"} \
        ${ADZUNA_APP_ID:+--adzuna-app-id "$ADZUNA_APP_ID"} \
        ${ADZUNA_APP_KEY:+--adzuna-app-key "$ADZUNA_APP_KEY"} \
        ${PRIM_API_KEY:+--prim-api-key "$PRIM_API_KEY"} \
        --ecb-enabled \
        --openmeteo-sync-interval 300 \
        $RESET_SESSION_FLAG \
        > logs/data-node.log 2>&1 &
    PH_PID=$!
    echo $PH_PID >> .pids
    echo "data-node:$PH_PID" >> .pids.info
    echo -e "  data-node on port 8200 (PID: $PH_PID)"
    DATA_NODE_RUNNING=true
fi

# Vision batches are now always deployed by DeployAllVisionBatches.s.sol in Step 6b
# (BLS-signed, no need for deferred creation)

# ============ STEP 9: Launch AP ============
echo -e "${BLUE}[9/$TOTAL_STEPS] Starting AP with real Bitget price proxy...${NC}"

AP_ARGS="--port 9100 --rpc $RPC_URL --exchange-mode $EXCHANGE_MODE"
AP_ARGS="$AP_ARGS --settlement-rpc $SETTLEMENT_RPC_URL --settlement-chain-id $SETTLEMENT_CHAIN_ID"
AP_ARGS="$AP_ARGS --deployment-file deployments/active-deployment.json"
[ "$DATA_NODE_RUNNING" = true ] && AP_ARGS="$AP_ARGS --data-node-url ${DATA_NODE_URL:-http://localhost:8200}"
AP_ARGS="$AP_ARGS --log-level ${LOG_LEVEL}"

[ -n "$INDEX_ADDRESS" ] && AP_ARGS="$AP_ARGS --index-contract $INDEX_ADDRESS"
[ -n "$MOCK_BITGET_VAULT" ] && AP_ARGS="$AP_ARGS --bitget-vault $MOCK_BITGET_VAULT"
[ -n "$MOCK_USDT" ] && [ "$MOCK_USDT" != "0x0000000000000000000000000000000000000000" ] && AP_ARGS="$AP_ARGS --mock-usdt $MOCK_USDT"

AP_PRIVATE_KEY=$AP_KEY eval "./target/release/ap $AP_ARGS > /dev/null 2>&1 &"
AP_PID=$!
echo $AP_PID >> .pids
echo "ap:$AP_PID" >> .pids.info
echo -e "  AP on port 9100 (PID: $AP_PID)"

# Wait for services to start
sleep 3

# Launch 2 Vision bots if Vision was deployed
VISION_ADDR_BOT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
if [ -n "$VISION_ADDR_BOT" ] && [ "$VISION_ADDR_BOT" != "" ] && [ -f "$SCRIPT_DIR/vision-bot/bot.py" ]; then
    echo -e "${BLUE}  Starting 2 Vision bots...${NC}"
    # Install deps if needed
    if [ ! -d "$SCRIPT_DIR/vision-bot/.venv" ]; then
        python3 -m venv "$SCRIPT_DIR/vision-bot/.venv" 2>/dev/null || true
    fi
    source "$SCRIPT_DIR/vision-bot/.venv/bin/activate" 2>/dev/null || true
    pip install -q -r "$SCRIPT_DIR/vision-bot/requirements.txt" 2>/dev/null || true

    # Bot 1: poll mode (joins batches as they appear)
    (
        cd "$SCRIPT_DIR"
        L3_RPC_URL="$RPC_URL" \
        VISION_API_URL="http://localhost:10001" \
        DATA_NODE_URL="http://localhost:8200" \
        BOT_ADDRESS="$VISION_BOT_ADDRESS" \
        BOT_PRIVATE_KEY="$VISION_BOT_KEY" \
        POLL_INTERVAL=5 \
        MAX_BATCHES=50 \
        MAX_EXPOSURE=1000 \
        STRATEGY=momentum \
        DEPOSIT_AMOUNT=20 \
        STAKE_PER_TICK=3 \
        PNL_FILE="pnl-bot1.json" \
        python3 vision-bot/bot.py > logs/vision-bot-1.log 2>&1
    ) &
    VBOT1_PID=$!
    echo $VBOT1_PID >> .pids
    echo "vision-bot-1:$VBOT1_PID" >> .pids.info
    echo -e "  ${GREEN}Vision bot 1 started (PID: $VBOT1_PID)${NC}"

    # Bot 2: poll mode (joins batches as they appear)
    (
        cd "$SCRIPT_DIR"
        L3_RPC_URL="$RPC_URL" \
        VISION_API_URL="http://localhost:10001" \
        DATA_NODE_URL="http://localhost:8200" \
        BOT_ADDRESS="$VISION_BOT2_ADDRESS" \
        BOT_PRIVATE_KEY="$VISION_BOT2_KEY" \
        POLL_INTERVAL=5 \
        MAX_BATCHES=50 \
        MAX_EXPOSURE=1000 \
        STRATEGY=random \
        DEPOSIT_AMOUNT=10 \
        STAKE_PER_TICK=1 \
        PNL_FILE="pnl-bot2.json" \
        python3 vision-bot/bot.py > logs/vision-bot-2.log 2>&1
    ) &
    VBOT2_PID=$!
    echo $VBOT2_PID >> .pids
    echo "vision-bot-2:$VBOT2_PID" >> .pids.info
    echo -e "  ${GREEN}Vision bot 2 started (PID: $VBOT2_PID)${NC}"
fi

# ============ Docs (optional — run Mintlify dev server) ============
if [ "$DOCS" = "1" ]; then
    echo -e "${BLUE}Starting Mintlify docs dev server on port 3030...${NC}"
    (cd "$SCRIPT_DIR/docs" && npx @mintlify/cli@latest dev --port 3030) > "$SCRIPT_DIR/logs/docs.log" 2>&1 &
    DOCS_DEV_PID=$!
    echo $DOCS_DEV_PID >> .pids
    echo "mintlify-docs:$DOCS_DEV_PID" >> .pids.info
    export DOCS_URL="http://localhost:3030"
    echo -e "  ${GREEN}Docs: http://localhost:3030${NC}"
fi

# ============ STEP 10: Frontend E2E Browser Tests ============
echo -e "${BLUE}[10/$TOTAL_STEPS] Starting frontend & running E2E browser tests...${NC}"

set +e  # Don't exit on E2E test failures

    # Extract ITP ID for service readiness check
    ITP_ID=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['itpId'])")

    # Wait for issuers + data-node to initialize (E2E buy test needs live NAV)
    echo -e "  Waiting for issuers + data-node to initialize..."
    NAV_READY=false
    for attempt in $(seq 1 90); do
        NAV_RESP=$(curl -sf "http://localhost:8200/itp-price?itp_id=$ITP_ID" 2>/dev/null || echo "")
        if [ -n "$NAV_RESP" ]; then
            NAV_VAL=$(echo "$NAV_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('nav','0'))" 2>/dev/null || echo "0")
            if [ "$NAV_VAL" != "0" ] && [ -n "$NAV_VAL" ]; then
                NAV_DISPLAY=$(echo "$NAV_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('nav_display','?'))" 2>/dev/null || echo "?")
                echo -e "  ${GREEN}Data-node ready! NAV: \$$NAV_DISPLAY (${attempt}s)${NC}"
                NAV_READY=true
                break
            fi
        fi
        sleep 1
    done
    if [ "$NAV_READY" != true ]; then
        echo -e "  ${YELLOW}Data-node not ready after 90s — continuing anyway${NC}"
    fi

sleep 2

# Install frontend deps + Playwright browser
echo -e "  Installing frontend dependencies..."
cd frontend
npm install --prefer-offline --no-audit > ../logs/frontend-install.log 2>&1
echo -e "  Installing Playwright chromium..."
npx playwright install chromium > ../logs/playwright-install.log 2>&1
echo -e "  ${GREEN}Dependencies ready${NC}"

# Write local dev .env.local via switch-env.sh
cd ..
./switch-env.sh local
cd frontend
# Inject dynamic Vision address from deployment JSON
VISION_ADDR=$(python3 -c "import json; print(json.load(open('../deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
if [ -n "$VISION_ADDR" ]; then
    sed -i '' "s|^NEXT_PUBLIC_VISION_ADDRESS=.*|NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}|" .env.local
fi

# Start Next.js dev server
echo -e "  Starting Next.js dev server on port 3000..."
nohup npm run dev > ../logs/frontend-dev.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID >> ../.pids
echo "frontend:$FRONTEND_PID" >> ../.pids.info
cd ..

# Wait for frontend to be ready
for attempt in $(seq 1 60); do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  ${GREEN}Frontend ready (${attempt}s)${NC}"
        break
    fi
    if [ $attempt -eq 60 ]; then
        echo -e "  ${RED}Frontend not ready after 60s — check logs/frontend-dev.log${NC}"
    fi
    sleep 1
done

# ============ STEP 11: Mintlify Docs ============
echo -e "${BLUE}[11/$TOTAL_STEPS] Starting Mintlify docs server...${NC}"
if [ "$DOCS" = "1" ]; then
    echo -e "  ${GREEN}Already started via DOCS=1 (port 3030)${NC}"
elif [ -f "$SCRIPT_DIR/docs/mint.json" ]; then
    cd "$SCRIPT_DIR/docs"
    npx @mintlify/cli@latest dev --port 3333 > "$SCRIPT_DIR/logs/docs.log" 2>&1 &
    DOCS_PID=$!
    echo $DOCS_PID >> "$SCRIPT_DIR/.pids"
    echo "mintlify-docs:$DOCS_PID" >> "$SCRIPT_DIR/.pids.info"
    cd "$SCRIPT_DIR"
    echo -e "  ${GREEN}Mintlify docs server started on port 3333 (PID: $DOCS_PID)${NC}"
else
    echo -e "  ${YELLOW}No docs/mint.json found — skipping docs server${NC}"
fi

# Run Playwright E2E tests (health → connect → buy → lending → sell)
echo -e ""
if [ "$NO_TEST" = true ]; then
    echo -e "  ${YELLOW}Skipping E2E tests (--no-test)${NC}"
    E2E_EXIT=0
else
        echo -e "  ${BLUE}Running Playwright E2E tests...${NC}"
        echo -e "  Tests: health-check → connect-wallet → buy-itp → lending-cycle → sell-itp"
        if [ "$VISION_ENABLED" = true ]; then
            echo -e "  + vision → vision-sources"
        fi
        echo -e ""
        cd frontend
        npm run e2e 2>&1 | tee ../logs/e2e-results.log
        E2E_EXIT=$?
        cd ..

    echo ""
    if [ $E2E_EXIT -eq 0 ]; then
        echo -e "  ${GREEN}╔════════════════════════════════╗${NC}"
        echo -e "  ${GREEN}║   E2E BROWSER TESTS PASSED     ║${NC}"
        echo -e "  ${GREEN}╚════════════════════════════════╝${NC}"
    else
        echo -e "  ${RED}╔════════════════════════════════╗${NC}"
        echo -e "  ${RED}║   E2E BROWSER TESTS FAILED     ║${NC}"
        echo -e "  ${RED}╚════════════════════════════════╝${NC}"
        echo -e "  ${YELLOW}Exit code: $E2E_EXIT${NC}"
        echo -e "  ${YELLOW}Full log:  logs/e2e-results.log${NC}"
        echo -e "  ${YELLOW}Debug:     cd frontend && npm run e2e:headed${NC}"
    fi
    echo ""
fi

set -e

# ============ STEP 12b: Vision 2-Bot Trading Verification ============
VISION_ADDR_VERIFY=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
if [ "$NO_TEST" = true ]; then
    true  # skip vision verification when --no-test
elif [ -n "$VISION_ADDR_VERIFY" ] && [ "$VISION_ADDR_VERIFY" != "" ] && [ "$DATA_NODE_RUNNING" = true ]; then
    echo -e "${BLUE}[11b/$TOTAL_STEPS] Vision 2-Bot Trading Verification...${NC}"

    # Wait for both bots to join the batch
    echo -e "  Waiting for both bots to join batch 0..."
    BOTH_JOINED=false
    for attempt in $(seq 1 60); do
        BATCH_STATE=$(curl -sf "http://localhost:10001/vision/batch/0/state" 2>/dev/null || echo "")
        if [ -n "$BATCH_STATE" ]; then
            PLAYER_COUNT=$(echo "$BATCH_STATE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('player_count',0))" 2>/dev/null || echo "0")
            if [ "$PLAYER_COUNT" -ge 2 ] 2>/dev/null; then
                echo -e "  ${GREEN}Both bots joined! ($PLAYER_COUNT players in batch 0, ${attempt}s)${NC}"
                BOTH_JOINED=true
                break
            fi
        fi
        sleep 1
    done

    if [ "$BOTH_JOINED" != true ]; then
        echo -e "  ${YELLOW}Warning: Only $PLAYER_COUNT player(s) joined after 60s${NC}"
        echo -e "  ${YELLOW}Bot 1 log tail:${NC}"
        tail -5 logs/vision-bot-1.log 2>/dev/null || true
        echo -e "  ${YELLOW}Bot 2 log tail:${NC}"
        tail -5 logs/vision-bot-2.log 2>/dev/null || true
    fi

    if [ "$BOTH_JOINED" = true ]; then
        # Simulate HN score changes by updating market_prices in Postgres.
        # For half the assets, increase the score by 50% (UP); for the other half,
        # decrease by 30% (DOWN). This ensures clear winners/losers.
        echo -e "  Simulating HN score changes for tick resolution..."
        $PSQL -d index_prices -c "
            WITH ranked AS (
                SELECT DISTINCT ON (asset_id)
                    id, asset_id, value,
                    ROW_NUMBER() OVER (PARTITION BY 1 ORDER BY asset_id) as rn,
                    COUNT(*) OVER () as total
                FROM market_prices
                WHERE source = 'hackernews'
                ORDER BY asset_id, fetched_at DESC
            )
            UPDATE market_prices mp
            SET value = CASE
                WHEN r.rn <= r.total / 2 THEN r.value * 1.5
                ELSE r.value * 0.7
            END,
            fetched_at = NOW()
            FROM ranked r
            WHERE mp.id = r.id;
        " > /dev/null 2>&1 || true
        echo -e "  ${GREEN}HN scores modified (half UP +50%, half DOWN -30%)${NC}"

        # Fast-forward Anvil time past tick 0 end (30s tick + 0s reveal window)
        echo -e "  Fast-forwarding Anvil time for tick 0 resolution..."
        cast rpc evm_increaseTime 35 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
        cast rpc evm_mine --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
        # Also advance L3 to keep in sync
        cast rpc evm_increaseTime 35 --rpc-url $RPC_URL > /dev/null 2>&1
        cast rpc evm_mine --rpc-url $RPC_URL > /dev/null 2>&1

        echo -e "  Waiting for tick 0 resolution..."
        TICK0_RESOLVED=false
        for attempt in $(seq 1 30); do
            # Check issuer log for tick resolution
            if grep -q "Tick resolved.*tick_id=0" logs/issuer-1.log 2>/dev/null; then
                TICK0_RESOLVED=true
                echo -e "  ${GREEN}Tick 0 resolved! (${attempt}s)${NC}"
                # Show the resolution details
                grep "Player balance update.*tick_id=0" logs/issuer-1.log 2>/dev/null | tail -5
                break
            fi
            sleep 1
        done

        if [ "$TICK0_RESOLVED" != true ]; then
            echo -e "  ${YELLOW}Tick 0 not resolved after 30s${NC}"
            echo -e "  ${YELLOW}Issuer 1 Vision logs:${NC}"
            grep -i "vision\|tick\|due\|market.*price" logs/issuer-1.log 2>/dev/null | tail -20
        fi

        # Fast-forward time for tick 1
        if [ "$TICK0_RESOLVED" = true ]; then
            # Modify scores again (reverse the changes to create more variation)
            $PSQL -d index_prices -c "
                WITH ranked AS (
                    SELECT DISTINCT ON (asset_id)
                        id, asset_id, value,
                        ROW_NUMBER() OVER (PARTITION BY 1 ORDER BY asset_id) as rn,
                        COUNT(*) OVER () as total
                    FROM market_prices
                    WHERE source = 'hackernews'
                    ORDER BY asset_id, fetched_at DESC
                )
                UPDATE market_prices mp
                SET value = CASE
                    WHEN r.rn <= r.total / 2 THEN r.value * 0.6
                    ELSE r.value * 1.8
                END,
                fetched_at = NOW()
                FROM ranked r
                WHERE mp.id = r.id;
            " > /dev/null 2>&1 || true
            echo -e "  ${GREEN}HN scores modified for tick 1 (reversed pattern)${NC}"

            echo -e "  Fast-forwarding Anvil time for tick 1 resolution..."
            cast rpc evm_increaseTime 35 --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
            cast rpc evm_mine --rpc-url $SETTLEMENT_RPC_URL > /dev/null 2>&1
            cast rpc evm_increaseTime 35 --rpc-url $RPC_URL > /dev/null 2>&1
            cast rpc evm_mine --rpc-url $RPC_URL > /dev/null 2>&1

            echo -e "  Waiting for tick 1 resolution..."
            TICK1_RESOLVED=false
            for attempt in $(seq 1 30); do
                if grep -q "Tick resolved.*tick_id=1" logs/issuer-1.log 2>/dev/null; then
                    TICK1_RESOLVED=true
                    echo -e "  ${GREEN}Tick 1 resolved! (${attempt}s)${NC}"
                    grep "Player balance update.*tick_id=1" logs/issuer-1.log 2>/dev/null | tail -5
                    break
                fi
                sleep 1
            done

            if [ "$TICK1_RESOLVED" != true ]; then
                echo -e "  ${YELLOW}Tick 1 not resolved after 30s${NC}"
                grep -i "vision\|tick\|due\|market.*price" logs/issuer-1.log 2>/dev/null | tail -20
            fi
        fi

        # Final Vision verification: check who won
        echo ""
        echo -e "  ${CYAN}═══ Vision Trading Results ═══${NC}"
        python3 -c "
import re, sys

log_file = 'logs/issuer-1.log'
try:
    with open(log_file) as f:
        lines = f.readlines()
except FileNotFoundError:
    print('  Could not read issuer log')
    sys.exit(0)

# Parse balance updates
player_deltas = {}
for line in lines:
    m = re.search(r'Player balance update.*player=([0-9a-fA-Fx]+).*delta=([+-]?\d+)', line)
    if m:
        player = m.group(1)
        delta = int(m.group(2))
        player_deltas.setdefault(player, []).append(delta)

if not player_deltas:
    print('  No balance updates found in logs')
    sys.exit(0)

for player, deltas in player_deltas.items():
    total = sum(deltas)
    status = 'WINNER' if total > 0 else ('LOSER' if total < 0 else 'BREAK-EVEN')
    emoji = '✅' if total > 0 else ('❌' if total < 0 else '➖')
    print(f'  {player[:18]}... total delta: {total:+d} [{status}]')

winners = sum(1 for d in player_deltas.values() if sum(d) > 0)
losers = sum(1 for d in player_deltas.values() if sum(d) < 0)
print()
if winners > 0 and losers > 0:
    print(f'  ✅ SUCCESS: {winners} winner(s), {losers} loser(s)')
else:
    print(f'  ⚠️  Expected divergent outcomes: {winners} winner(s), {losers} loser(s)')
" 2>/dev/null || true
        echo ""
    fi
fi

# ============ STEP 12: Verification ============
echo ""
echo -e "${YELLOW}Verifying services...${NC}"

# AP health
AP_STATUS=$(curl -sf http://localhost:9100/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
if [ "$AP_STATUS" = "healthy" ] || [ "$AP_STATUS" = "degraded" ]; then
    PRICE_COUNT=$(curl -s http://localhost:9100/prices | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('prices',{})))" 2>/dev/null || echo "?")
    echo -e "  AP: ${GREEN}${AP_STATUS}${NC} ($PRICE_COUNT live prices)"
else
    echo -e "  AP: ${RED}not ready${NC} (status: $AP_STATUS, check logs/ap.log)"
fi

# Note: Issuers run on VPS only (via Docker Compose), not locally

# Contract summary
echo ""
echo -e "${YELLOW}Deployed Contracts:${NC}"
python3 -c "
import json, os
if os.path.exists('deployments/active-deployment.json'):
    d = json.load(open('deployments/active-deployment.json'))
    for k,v in d.get('contracts',{}).items():
        if isinstance(v,str) and v.startswith('0x') and len(v)==42:
            print(f'  {k:25s} {v}')
if os.path.exists('data/symbol-map.json'):
    sm = json.load(open('data/symbol-map.json'))
    print(f'  {\"Bitget Token Pairs\":25s} {len(sm)} tokens')
" 2>/dev/null

# ============ Summary ============
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║             LOCAL ENVIRONMENT READY!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}L3 Anvil:${NC}  http://localhost:8545 (chain $CHAIN_ID)"
echo -e "  ${BLUE}Settlement Anvil:${NC} http://localhost:8546 (chain $SETTLEMENT_CHAIN_ID)"
echo -e "  ${BLUE}AP:${NC}        port 9100 (real Bitget price proxy)"
echo -e "  ${BLUE}Issuers:${NC}  VPS only (not started locally)"
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:3000 (running)"
echo -e "  ${BLUE}Docs:${NC}      http://localhost:3333 (Mintlify)"
echo -e "  ${BLUE}E2E Tests:${NC} cd frontend && npm run e2e:headed"
echo -e "  ${BLUE}Logs:${NC}      ./logs/"
echo ""
echo -e "Run ${YELLOW}./stop.sh${NC} to shut down all services"
echo ""

# ============ Tail Logs ============
if [ "$NO_TAIL" = false ]; then
    echo -e "${YELLOW}Tailing logs (Ctrl+C to stop tailing, services continue)...${NC}"
    echo ""
    tail -f logs/*.log
fi
