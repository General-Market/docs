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
TEST_USER_ADDRESS=${TEST_USER_ADDRESS:-0xC0D3C3ba6c2215b0cBf4375f4c280c0cc6C43850}
AP_KEY=${AP_KEY:-0x582978b132648fe53de139c6b9297040a2757616cac9a2fd17aa167bdc6fa340}

# Bitget credentials (dummy = public endpoints only, sufficient for price reads)
export BITGET_API_KEY=${BITGET_API_KEY:-dummy}
export BITGET_API_SECRET=${BITGET_API_SECRET:-dummysecretdummysecretdummysecret}
export BITGET_API_PASSPHRASE=${BITGET_API_PASSPHRASE:-dummypass}
export BITGET_READONLY_API_KEY=${BITGET_READONLY_API_KEY:-dummy}
export BITGET_READONLY_API_SECRET=${BITGET_READONLY_API_SECRET:-dummysecretdummysecretdummysecret}
export BITGET_READONLY_PASSPHRASE=${BITGET_READONLY_PASSPHRASE:-dummypass}

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
# (system.env defines ARB_RPC_URL pointing to real Arbitrum which would break local dev)
CHAIN_ID=111222333
RPC_URL="http://localhost:8545"
ARB_CHAIN_ID=421611337
ARB_RPC_URL="http://localhost:8546"

# Add Foundry to PATH if not already available
if ! command -v anvil &>/dev/null && [ -d "$HOME/.foundry/bin" ]; then
    export PATH="$HOME/.foundry/bin:$PATH"
fi

TOTAL_STEPS=12

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
    echo "  --help          Show this help message"
    echo ""
    echo "What gets deployed:"
    echo "  1. Anvil local chain (chain ID 111222333)"
    echo "  2. Core contracts (Index, BridgeProxy, ArbBridgeCustody, etc.)"
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
        --stress) LOG_LEVEL=warn; export RUST_LOG="warn,issuer::consensus=info,issuer::cycle=info"; shift;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1;;
    esac
done

if ! [[ "$ISSUER_COUNT" =~ ^[0-9]+$ ]] || [ "$ISSUER_COUNT" -lt 1 ] || [ "$ISSUER_COUNT" -gt 20 ]; then
    echo -e "${RED}Error: --issuers must be 1-20${NC}"; exit 1
fi

print_banner

echo -e "${YELLOW}Configuration:${NC}"
echo "  Issuers: $ISSUER_COUNT | Skip deploy: $SKIP_DEPLOY | Tail logs: $([[ "$NO_TAIL" == "true" ]] && echo "no" || echo "yes") | Log level: $LOG_LEVEL"
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
echo ""

mkdir -p logs deployments data

# ============ Cleanup ============
if [ -f .pids ]; then
    echo -e "${YELLOW}Cleaning up previous processes...${NC}"
    ./stop.sh 2>/dev/null || true
fi
rm -f .pids .pids.info

# Kill any leftover processes on our ports and wait for ports to be free
for port in 3000 8545 8546 8200 9001 9002 9003 9100; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
# Wait for ports to actually be released by the OS
for attempt in $(seq 1 20); do
    BUSY=false
    for port in 8545 8546; do
        if lsof -ti:$port > /dev/null 2>&1; then
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

# ============ STEP 1: Anvil (L3 + Arbitrum) ============
echo -e "${BLUE}[1/$TOTAL_STEPS] Starting Anvil chains (L3: $CHAIN_ID, Arbitrum: $ARB_CHAIN_ID)...${NC}"
anvil --chain-id $CHAIN_ID --host 0.0.0.0 --port 8545 --accounts 100 -q > /dev/null 2>&1 &
ANVIL_L3_PID=$!
echo $ANVIL_L3_PID >> .pids
echo "anvil-l3:$ANVIL_L3_PID" >> .pids.info

anvil --chain-id $ARB_CHAIN_ID --host 0.0.0.0 --port 8546 --accounts 100 -q > /dev/null 2>&1 &
ANVIL_ARB_PID=$!
echo $ANVIL_ARB_PID >> .pids
echo "anvil-arb:$ANVIL_ARB_PID" >> .pids.info

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
wait_for_rpc "Arb" "$ARB_RPC_URL" &
ARB_WAIT_PID=$!

L3_OK=true; ARB_OK=true
wait $L3_WAIT_PID || L3_OK=false
wait $ARB_WAIT_PID || ARB_OK=false

if $L3_OK; then
    echo -e "  L3 Anvil: ${GREEN}OK${NC}"
else
    echo -e "${RED}Error: L3 Anvil failed to start${NC}"; exit 1
fi
if $ARB_OK; then
    echo -e "  Arb Anvil: ${GREEN}OK${NC}"
else
    echo -e "${RED}Error: Arbitrum Anvil failed to start${NC}"; exit 1
fi

if [ "$SKIP_DEPLOY" = true ]; then
    echo -e "${BLUE}[2-6/$TOTAL_STEPS] Skipping contract deployment (--skip-deploy)${NC}"
    # Load existing addresses
    if [ ! -f deployments/active-deployment.json ]; then
        echo -e "${RED}Error: deployments/active-deployment.json not found${NC}"; exit 1
    fi
else
    # ============ STEP 2: Core contracts (both chains) ============
    echo -e "${BLUE}[2/$TOTAL_STEPS] Deploying core contracts (L3 + Arbitrum)...${NC}"
    cd contracts
    export PRIVATE_KEY=$DEPLOYER_KEY

    # 2a: Deploy to L3
    if ! forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-core-l3.log 2>&1; then
        echo -e "${RED}Error: L3 core deployment failed${NC}"
        tail -20 ../logs/deploy-core-l3.log
        exit 1
    fi
    echo -e "  ${GREEN}L3 core contracts deployed${NC}"

    # Save L3 deployment before Arb deploy overwrites e2e-full-system.json
    # (Arb deploy sets chainId=42161, but AP/issuers need L3 chainId=111222333)
    [ -f ../deployments/e2e-full-system.json ] && cp ../deployments/e2e-full-system.json ../deployments/e2e-full-system-l3.json

    # 2b: Deploy to Arb (same deployer, fresh Anvil → identical addresses)
    if ! forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E \
        --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-core-arb.log 2>&1; then
        echo -e "${RED}Error: Arbitrum core deployment failed${NC}"
        tail -20 ../logs/deploy-core-arb.log
        exit 1
    fi
    echo -e "  ${GREEN}Arbitrum core contracts deployed (mirror)${NC}"
    cd ..

    # Copy the L3 deployment to active (AP/issuers expect L3 chain ID 111222333).
    # The Arb deploy overwrites e2e-full-system.json with chainId=42161, so we
    # use the L3 version saved before Arb deploy (addresses are identical).
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
    cast send --private-key $DEPLOYER_KEY --value 100ether $TEST_USER --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    # Impersonate test user on both Anvils so mock wallet can send eth_sendTransaction
    cast rpc anvil_impersonateAccount $TEST_USER --rpc-url $RPC_URL > /dev/null 2>&1
    cast rpc anvil_impersonateAccount $TEST_USER --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}Test user $TEST_USER funded with 100 ETH on both chains${NC}"

    # Fund AP wallet with native ETH on Arb (needed for gas on executeTrade + swapStable)
    AP_ADDR=$(cast wallet address $AP_KEY)
    cast send --private-key $DEPLOYER_KEY --value 100ether $AP_ADDR --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}AP $AP_ADDR funded with 100 ETH on Arb${NC}"

    # Fund test user with USDC tokens on both chains
    L3_WUSDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['L3_WUSDC'])")
    ARB_USDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['ARB_USDC'])")
    cast send --private-key $DEPLOYER_KEY $L3_WUSDC "mint(address,uint256)" $TEST_USER 50000000000000000000000 --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $ARB_USDC "mint(address,uint256)" $TEST_USER 50000000000 --rpc-url $RPC_URL > /dev/null 2>&1
    # Mint ARB_USDC on Arbitrum too (frontend reads from Arb)
    cast send --private-key $DEPLOYER_KEY $ARB_USDC "mint(address,uint256)" $TEST_USER 50000000000 --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}Test user funded with 50k L3_WUSDC (L3) + 50k ARB_USDC (both chains)${NC}"

    # ============ STEP 3: 100-asset ITP ============
    echo -e "${BLUE}[3/$TOTAL_STEPS] Deploying 100-asset ITP...${NC}"

    # Extract addresses from deployment
    INDEX_ADDRESS=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])")
    MOCK_BITGET_VAULT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['MockBitgetVault'])")
    AP_ADDRESS=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['accounts']['ap'])")
    MOCK_USDT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('MOCK_USDT',''))" 2>/dev/null || echo "")
    ARB_USDC=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['ARB_USDC'])")

    # Register USDC + USDT as supported stablecoins in MockBitgetVault (for swapStable)
    # ARB_USDC = 6 decimals, MOCK_USDT = 18 decimals (L3 standard)
    # Must register on BOTH chains since vault is deployed on both (AP uses Arb RPC)
    if [ -n "$MOCK_USDT" ] && [ "$MOCK_USDT" != "" ]; then
        cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT \
            "setStableTokens(address,uint8,address,uint8)" \
            "$ARB_USDC" 6 "$MOCK_USDT" 18 \
            --rpc-url $RPC_URL > /dev/null 2>&1
        cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT \
            "setStableTokens(address,uint8,address,uint8)" \
            "$ARB_USDC" 6 "$MOCK_USDT" 18 \
            --rpc-url $ARB_RPC_URL > /dev/null 2>&1
        echo -e "  ${GREEN}MockBitgetVault: registered USDC=$ARB_USDC(6dec) + USDT=$MOCK_USDT(18dec) for swapStable (both chains)${NC}"
    fi

    # Enable trading fee simulation (10 bps = 0.1%) on both chains
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setFee(uint256)" 10 --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setFee(uint256)" 10 --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}MockBitgetVault: fee set to 10 bps (0.1%) on both chains${NC}"

    # Spread is now applied by AP using real Bitget bid/ask — vault spread = 0
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setSpread(uint256)" 0 --rpc-url $RPC_URL > /dev/null 2>&1
    cast send --private-key $DEPLOYER_KEY $MOCK_BITGET_VAULT "setSpread(uint256)" 0 --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    echo -e "  ${GREEN}MockBitgetVault: spread=0 (real bid/ask applied by AP from /fast-prices)${NC}"

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

    # 3b: Deploy to Arb (same deployer account 1 + nonce → identical addresses)
    cd contracts
    if ! INDEX_ADDRESS=$INDEX_ADDRESS \
    MOCK_BITGET_VAULT=$MOCK_BITGET_VAULT \
    AP_ADDRESS=$AP_ADDRESS \
    L3_WUSDC=$L3_WUSDC \
    USE_CREATION_PRICES=$USE_CREATION_PRICES \
    forge script script/Deploy100AssetITP.s.sol:Deploy100AssetITP \
        --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-itp100-arb.log 2>&1; then
        echo -e "${RED}Error: ITP-100 Arbitrum deployment failed${NC}"
        tail -20 ../logs/deploy-itp100-arb.log
        exit 1
    fi
    cd ..
    echo -e "  ${GREEN}100-asset ITP deployed on Arbitrum (mirror)${NC}"

    # 3c: Create BridgedITP on Arbitrum via requestCreateItp + completeCreateItp (BLS-signed)
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
        --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-bridged-itp.log 2>&1; then
        echo -e "${YELLOW}  Warning: BridgedITP creation failed (check logs/deploy-bridged-itp.log)${NC}"
    fi
    cd ..

    # Read BridgedITP address from BridgeProxy mapping
    BRIDGED_ITP=$(cast call $BRIDGE_PROXY "getBridgedItp(bytes32)(address)" "$ITP_ID" --rpc-url $ARB_RPC_URL 2>/dev/null || echo "")
    if [ -n "$BRIDGED_ITP" ] && [ "$BRIDGED_ITP" != "0x0000000000000000000000000000000000000000" ]; then
        echo -e "  ${GREEN}BridgedITP created on Arbitrum: $BRIDGED_ITP${NC}"

        # setBridgeProxy is now done in DeployFullSystemE2E.s.sol Phase 6 (before BLS pubkey is set)
        echo -e "  ${GREEN}ArbBridgeCustody.bridgeProxy set in deploy script${NC}"
        python3 -c "
import json
deploy = json.load(open('deployments/active-deployment.json'))
deploy['contracts']['BridgedITP'] = '$BRIDGED_ITP'
json.dump(deploy, open('deployments/active-deployment.json', 'w'), indent=2)
"
    else
        echo -e "  ${YELLOW}Warning: BridgedITP creation failed (sell won't work)${NC}"
    fi

    cp deployments/active-deployment.json frontend/lib/contracts/deployment.json

    # ============ STEP 4: All Bitget tokens ============
    echo -e "${BLUE}[4/$TOTAL_STEPS] Deploying Bitget pair tokens (fetching live pairs from API)...${NC}"

    if ! python3 scripts/deploy-all-bitget-tokens.py --rpc-url $ARB_RPC_URL > logs/deploy-bitget-tokens.log 2>&1; then
        echo -e "${RED}Error: Bitget token deployment failed${NC}"
        tail -20 logs/deploy-bitget-tokens.log
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
    python3 -c "
import json
sm = json.load(open('data/symbol-map.json'))
assets = [{'address': addr, 'bitget': info['pair']}
          for addr, info in sm.items()
          if isinstance(info, dict) and 'pair' in info]
json.dump(assets, open('assets.json', 'w'), indent=2)
print(f'  Generated assets.json with {len(assets)} symbols from symbol-map')
"

    # ============ STEP 5: Morpho lending ============
    echo -e "${BLUE}[5/$TOTAL_STEPS] Deploying Morpho Blue lending system...${NC}"

    cd contracts

    # Morpho is optional - don't let failures kill the whole script
    set +e

    # Read real BridgedITP address from active-deployment.json (created in Step 3)
    BRIDGED_ITP=$(python3 -c "import json; print(json.load(open('../deployments/active-deployment.json'))['contracts']['BridgedITP'])" 2>/dev/null || echo "")

    if [ -z "$BRIDGED_ITP" ] || [ "$BRIDGED_ITP" = "None" ]; then
        echo -e "${YELLOW}  Warning: BridgedITP not found in deployment, skipping Morpho${NC}"
    else
        # Phase 1: Deploy Morpho core (Morpho Blue + IRM + Oracle + MetaMorpho vault)
        ITP_VAULT=$BRIDGED_ITP \
        ARB_USDC=$ARB_USDC \
        forge script script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
            --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-morpho-phase1.log 2>&1

        if [ $? -eq 0 ]; then
            # Extract Phase 1 addresses from morpho-e2e.json
            METAMORPHO_VAULT=$(python3 -c "import json; print(json.load(open('../deployments/morpho-e2e.json'))['contracts']['METAMORPHO_VAULT'])" 2>/dev/null || echo "")
            MOCK_ORACLE=$(python3 -c "import json; print(json.load(open('../deployments/morpho-e2e.json'))['contracts']['MOCK_ORACLE'])" 2>/dev/null || echo "")
            ADAPTIVE_IRM=$(python3 -c "import json; print(json.load(open('../deployments/morpho-e2e.json'))['contracts']['ADAPTIVE_IRM'])" 2>/dev/null || echo "")

            # Advance time for MetaMorpho timelock (1 day + 1 second)
            # MUST advance BOTH chains to keep timestamps in sync — otherwise cross-chain
            # deadline validation fails (deadline from Arb is >24h ahead of L3's time)
            cast rpc evm_increaseTime 86401 --rpc-url $ARB_RPC_URL > /dev/null 2>&1
            cast rpc evm_mine --rpc-url $ARB_RPC_URL > /dev/null 2>&1
            cast rpc evm_increaseTime 86401 --rpc-url $RPC_URL > /dev/null 2>&1
            cast rpc evm_mine --rpc-url $RPC_URL > /dev/null 2>&1

            # Phase 2: Configure vault + seed liquidity
            ITP_VAULT=$BRIDGED_ITP \
            ARB_USDC=$ARB_USDC \
            METAMORPHO_VAULT=$METAMORPHO_VAULT \
            MOCK_ORACLE=$MOCK_ORACLE \
            ADAPTIVE_IRM=$ADAPTIVE_IRM \
            forge script script/DeployMorphoE2E.s.sol:ConfigureMorphoE2E \
                --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-morpho-phase2.log 2>&1

            if [ $? -eq 0 ]; then
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

    # ============ STEP 6: Vision (P2Pool) ============
    echo -e "${BLUE}[6/$TOTAL_STEPS] Deploying Vision (P2Pool) contract...${NC}"

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

        # Run P2Pool database migrations (issuer chain listener needs these tables)
        if $PG_ISREADY -q 2>/dev/null; then
            $PSQL -d index_prices -f ../issuer/migrations/001_create_p2pool_tables.sql > /dev/null 2>&1 || true
            echo -e "  ${GREEN}P2Pool database tables created${NC}"
        fi
    else
        echo -e "${YELLOW}  Warning: Vision deployment failed (check logs/deploy-vision.log)${NC}"
    fi
    set -e
    cd ..
fi

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

echo "  Address sync complete"

# Start background block miner — issuers need blocks to advance for event detection.
# Anvil automine only creates blocks on transactions; this loop creates empty blocks
# every 1 second so issuers reliably detect cross-chain events between transactions.
# Must be AFTER all deployments (automine handles those instantly).
(while true; do
    cast rpc evm_mine --rpc-url $RPC_URL > /dev/null 2>&1
    cast rpc evm_mine --rpc-url $ARB_RPC_URL > /dev/null 2>&1
    sleep 1
done) &
MINER_PID=$!
echo $MINER_PID >> .pids
echo "block-miner:$MINER_PID" >> .pids.info
echo -e "  ${GREEN}Background block miner started (1s interval, PID: $MINER_PID)${NC}"

# ============ STEP 8: Launch Issuers ============
echo -e "${BLUE}[8/$TOTAL_STEPS] Starting $ISSUER_COUNT issuer nodes (with Bitget price proxy)...${NC}"

# Extract addresses for issuers
BRIDGE_PROXY=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['BridgeProxy'])" 2>/dev/null || echo "")
MOCK_BITGET_VAULT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['MockBitgetVault'])" 2>/dev/null || echo "")
ARB_CUSTODY=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['ArbBridgeCustody'])" 2>/dev/null || echo "")
BLS_CUSTODY=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['BLSCustody'])" 2>/dev/null || echo "")
MOCK_USDT=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('MOCK_USDT',''))" 2>/dev/null || echo "")

# Anvil account private keys for issuers (accounts 1-20)
# Account 0 is the deployer, accounts 1+ are issuer nodes
ISSUER_KEYS=(
    ""  # placeholder for index 0
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"  # Account 1
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"  # Account 2
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"  # Account 3
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"  # Account 4
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"  # Account 5
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"  # Account 6
    "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"  # Account 7
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"  # Account 8
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"  # Account 9
)

SIG_THRESHOLD=$((ISSUER_COUNT * 2 / 3 + 1))
if [ $SIG_THRESHOLD -lt 2 ]; then SIG_THRESHOLD=2; fi
if [ $SIG_THRESHOLD -gt $ISSUER_COUNT ]; then SIG_THRESHOLD=$ISSUER_COUNT; fi

for i in $(seq 1 $ISSUER_COUNT); do
    PORT=$((9000 + i))
    BLS_IDX=$((i - 1))

    ISSUER_ARGS="--node-id $i --port $PORT --rpc $RPC_URL"
    ISSUER_ARGS="$ISSUER_ARGS --cycle-duration-ms 200 --min-cycle-gap-ms 20 --consensus-timeout-ms 150 --no-tls"
    ISSUER_ARGS="$ISSUER_ARGS --test-key-seeds --bls-key-seed-index $BLS_IDX"
    ISSUER_ARGS="$ISSUER_ARGS --signature-threshold $SIG_THRESHOLD --num-issuers $ISSUER_COUNT"
    ISSUER_ARGS="$ISSUER_ARGS --ntp-server \"\""
    ISSUER_ARGS="$ISSUER_ARGS --log-level ${LOG_LEVEL}"

    [ -n "$BRIDGE_PROXY" ] && ISSUER_ARGS="$ISSUER_ARGS --bridge-proxy $BRIDGE_PROXY"
    [ -n "$MOCK_BITGET_VAULT" ] && ISSUER_ARGS="$ISSUER_ARGS --bitget-vault $MOCK_BITGET_VAULT"
    [ -n "$ARB_CUSTODY" ] && ISSUER_ARGS="$ISSUER_ARGS --arb-custody $ARB_CUSTODY"
    [ -n "$BLS_CUSTODY" ] && ISSUER_ARGS="$ISSUER_ARGS --issuer-custody-arb $BLS_CUSTODY"
    [ -n "$MOCK_USDT" ] && [ "$MOCK_USDT" != "0x0000000000000000000000000000000000000000" ] && ISSUER_ARGS="$ISSUER_ARGS --mock-usdt $MOCK_USDT"
    ISSUER_ARGS="$ISSUER_ARGS --deployment-file deployments/active-deployment.json"
    [ -f "$SCRIPT_DIR/data/symbol-map.json" ] && ISSUER_ARGS="$ISSUER_ARGS --symbol-map-file $SCRIPT_DIR/data/symbol-map.json"

    # Build peer list (all other issuers)
    PEER_LIST=""
    for j in $(seq 1 $ISSUER_COUNT); do
        if [ $j -ne $i ]; then
            [ -n "$PEER_LIST" ] && PEER_LIST="$PEER_LIST,"
            PEER_LIST="${PEER_LIST}127.0.0.1:$((9000 + j))"
        fi
    done

    ISSUER_KEY=${ISSUER_KEYS[$i]:-""}
    # Write key to temp file (eval+inline env mangles hex keys)
    ISSUER_KEY_FILE="/tmp/issuer-key-$i.txt"
    echo -n "$ISSUER_KEY" > "$ISSUER_KEY_FILE"
    export ISSUER_PRIVATE_KEY_PATH="$ISSUER_KEY_FILE"
    export ISSUER_PEERS="$PEER_LIST"
    export ISSUER_ARBITRUM_RPC_URL="$ARB_RPC_URL"
    export ISSUER_ARBITRUM_CHAIN_ID="$ARB_CHAIN_ID"
    export ISSUER_BRIDGE_PROXY_ADDRESS="$BRIDGE_PROXY"
    # Only pass DATA_NODE_URL when PostgreSQL is available (data-node needs it).
    # Without it, issuers use BitgetPriceFetcher for asset prices and compute NAV locally
    # from on-chain inventory + live Bitget prices (no $1 fallback).
    if $PG_ISREADY -q 2>/dev/null; then
        export DATA_NODE_URL="http://localhost:8200"
    fi

    # P2Pool subsystem — enable if Vision contract was deployed
    VISION_ADDR_CHECK=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
    if [ -n "$VISION_ADDR_CHECK" ] && [ "$VISION_ADDR_CHECK" != "" ] && $PG_ISREADY -q 2>/dev/null; then
        export ISSUER_P2POOL_ENABLED=true
        export ISSUER_P2POOL_VISION_ADDRESS="$VISION_ADDR_CHECK"
        export ISSUER_P2POOL_DATABASE_URL="postgres://localhost/index_prices"
        export ISSUER_P2POOL_DATA_NODE_URL="http://localhost:8200"
        export ISSUER_P2POOL_RPC_WS_URL="$RPC_URL"
    fi
    ./target/release/issuer $ISSUER_ARGS > logs/issuer-$i.log 2>&1 &
    ISSUER_PID=$!
    echo $ISSUER_PID >> .pids
    echo "issuer-$i:$ISSUER_PID" >> .pids.info
    echo -e "  Issuer $i on port $PORT (PID: $ISSUER_PID)"
done

# ============ STEP 9: Data-node ============
# Data-node serves a REST API on port 8200 for asset prices, ITP NAV, and chart data.
# Requires PostgreSQL. If unavailable, issuers fall back to Bitget direct price feeds.
echo -e "${BLUE}[9/$TOTAL_STEPS] Starting data-node service...${NC}"

INDEX_ADDRESS=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])" 2>/dev/null || echo "")
DATA_NODE_RUNNING=false

if ! $PG_ISREADY -q 2>/dev/null; then
    echo -e "  ${YELLOW}PostgreSQL not running — skipping data-node${NC}"
    echo -e "  ${YELLOW}Charts won't work. Start PostgreSQL and re-run.${NC}"
else
    ./target/release/data-node serve \
        --database-url postgres://localhost/index_prices \
        --symbol-map "$SCRIPT_DIR/data/symbol-map.json" \
        --rpc-url $RPC_URL \
        --arb-rpc-url $ARB_RPC_URL \
        --deployment-file deployments/active-deployment.json \
        --morpho-deployment-file deployments/morpho-e2e.json \
        ${INDEX_ADDRESS:+--index-address $INDEX_ADDRESS} \
        > logs/data-node.log 2>&1 &
    PH_PID=$!
    echo $PH_PID >> .pids
    echo "data-node:$PH_PID" >> .pids.info
    echo -e "  data-node on port 8200 (PID: $PH_PID)"
    DATA_NODE_RUNNING=true

    if [ "$SKIP_DEPLOY" = false ]; then
        # Wait for data-node to be ready, then reset session data via admin endpoint
        for i in $(seq 1 10); do
            if curl -sf http://localhost:8200/health > /dev/null 2>&1; then
                break
            fi
            sleep 0.5
        done
        if curl -sf -X POST http://localhost:8200/admin/reset-session > /dev/null 2>&1; then
            echo -e "  ${GREEN}Session data reset via admin endpoint${NC}"
        else
            # Fallback to direct psql if admin endpoint unavailable
            $PSQL -d index_prices -c "TRUNCATE itp_snapshots, trades;" 2>/dev/null || true
            echo -e "  ${YELLOW}Session data reset via psql fallback${NC}"
        fi
    fi
fi

# ============ STEP 10: Launch AP ============
echo -e "${BLUE}[10/$TOTAL_STEPS] Starting AP with real Bitget price proxy...${NC}"

AP_ARGS="--port 9100 --rpc $RPC_URL --mock-bitget"
AP_ARGS="$AP_ARGS --arb-rpc $ARB_RPC_URL --arb-chain-id $ARB_CHAIN_ID"
AP_ARGS="$AP_ARGS --deployment-file deployments/active-deployment.json"
[ "$DATA_NODE_RUNNING" = true ] && AP_ARGS="$AP_ARGS --data-node-url http://localhost:8200"
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

# ============ STEP 11: Frontend E2E Browser Tests ============
echo -e "${BLUE}[11/$TOTAL_STEPS] Starting frontend & running E2E browser tests...${NC}"

set +e  # Don't exit on E2E test failures

# Extract ITP ID for service readiness check
ITP_ID=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['itpId'])")

# Wait for issuers + data-node to initialize (E2E buy test needs live NAV)
echo -e "  Waiting for issuers + data-node to initialize..."
NAV_READY=false
for attempt in $(seq 1 30); do
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
    echo -e "  ${YELLOW}Data-node not ready after 30s — continuing anyway${NC}"
fi
sleep 2

# Install frontend deps + Playwright browser
echo -e "  Installing frontend dependencies..."
cd frontend
npm install --prefer-offline --no-audit > ../logs/frontend-install.log 2>&1
echo -e "  Installing Playwright chromium..."
npx playwright install chromium > ../logs/playwright-install.log 2>&1
echo -e "  ${GREEN}Dependencies ready${NC}"

# Write local dev .env.local (overrides any prod SSH tunnel config)
VISION_ADDR=$(python3 -c "import json; print(json.load(open('../deployments/active-deployment.json'))['contracts'].get('Vision',''))" 2>/dev/null || echo "")
cat > .env.local <<ENVEOF
NEXT_PUBLIC_CHAIN_ID=421611337
NEXT_PUBLIC_RPC_URL=http://localhost:8546
NEXT_PUBLIC_AP_URL=http://localhost:9100
NEXT_PUBLIC_DATA_NODE_URL=http://localhost:8200
NEXT_PUBLIC_VISION_ADDRESS=${VISION_ADDR}
NEXT_PUBLIC_P2POOL_API_URL=http://localhost:10001
NEXT_PUBLIC_ISSUER_URLS=http://localhost:10001,http://localhost:10002,http://localhost:10003
ENVEOF

# Start Next.js dev server
echo -e "  Starting Next.js dev server on port 3000..."
npm run dev > ../logs/frontend-dev.log 2>&1 &
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

# Run Playwright E2E tests (health → connect → buy → lending → sell)
echo -e ""
echo -e "  ${BLUE}Running Playwright E2E tests...${NC}"
echo -e "  Tests: health-check → connect-wallet → buy-itp → lending-cycle → sell-itp"
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

set -e

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

# Issuer health
for i in $(seq 1 $ISSUER_COUNT); do
    HP=$((10000 + i))
    if curl -s "http://localhost:$HP/health" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('status')=='healthy' else 1)" 2>/dev/null; then
        echo -e "  Issuer $i: ${GREEN}healthy${NC}"
    else
        echo -e "  Issuer $i: ${YELLOW}starting...${NC} (check logs/issuer-$i.log)"
    fi
done

# P2Pool API health
P2POOL_API_PORT=10001
if curl -sf "http://localhost:$P2POOL_API_PORT/p2pool/batches" > /dev/null 2>&1; then
    echo -e "  P2Pool API: ${GREEN}healthy${NC} (port $P2POOL_API_PORT)"
else
    echo -e "  P2Pool API: ${YELLOW}starting...${NC} (port $P2POOL_API_PORT, check logs/issuer-1.log)"
fi

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
echo -e "  ${BLUE}Arb Anvil:${NC} http://localhost:8546 (chain $ARB_CHAIN_ID)"
echo -e "  ${BLUE}Issuers:${NC}   ports 9001-900$ISSUER_COUNT (bitget-vault + arb-custody)"
echo -e "  ${BLUE}AP:${NC}        port 9100 (real Bitget price proxy)"
echo -e "  ${BLUE}P2Pool:${NC}   http://localhost:10101 (issuer 1 API)"
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:3000 (running)"
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
