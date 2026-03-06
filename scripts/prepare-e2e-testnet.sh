#!/bin/bash
# ============================================================================
# Prepare Testnet for E2E Tests
# ============================================================================
#
# Run this ONCE after a fresh deployment to set up everything the Playwright
# E2E tests need. Idempotent — safe to re-run.
#
# What it does:
#   1. Validates prerequisites (forge, cast, jq, node)
#   2. Reads contract addresses from deployments/active-deployment.json
#   3. Checks if ITP #1 exists on-chain — if not, deploys 100-asset ITP
#   4. Syncs deployment files to frontend
#   5. Checks data-node health + sim cache warmth
#   6. Checks frontend accessibility
#   7. Prints readiness summary
#
# Usage:
#   ./scripts/prepare-e2e-testnet.sh
#
# Environment overrides:
#   RPC=http://...           L3 RPC URL (default: from deployment.json)
#   DEPLOYER_KEY=0x...       Deployer private key
#   DATA_NODE_URL=http://... Data-node URL
#   FRONTEND_URL=http://...  Frontend URL to check
#   SKIP_ITP_DEPLOY=1        Skip ITP deployment even if none exists

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
export PATH="$HOME/.foundry/bin:$PATH"

# ── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ── Result tracking ─────────────────────────────────────────
declare -a CHECK_NAMES
declare -a CHECK_RESULTS
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_pass() {
    CHECK_NAMES+=("$1")
    CHECK_RESULTS+=("PASS")
    PASS_COUNT=$((PASS_COUNT + 1))
    echo -e "  ${GREEN}✓${NC} $1"
}

check_fail() {
    CHECK_NAMES+=("$1")
    CHECK_RESULTS+=("FAIL")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo -e "  ${RED}✗${NC} $1 — $2"
}

check_warn() {
    CHECK_NAMES+=("$1")
    CHECK_RESULTS+=("WARN")
    WARN_COUNT=$((WARN_COUNT + 1))
    echo -e "  ${YELLOW}!${NC} $1 — $2"
}

# ── Configuration ───────────────────────────────────────────
DEPLOYMENT_FILE="deployments/active-deployment.json"
ITP_100_DEPLOYMENT="deployments/itp-100-asset.json"

DEPLOYER_KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER_ADDR="0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4"

echo -e "${BOLD}=== Prepare Testnet for E2E Tests ===${NC}"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ════════════════════════════════════════════════════════════
# Step 1: Prerequisites
# ════════════════════════════════════════════════════════════
echo -e "${CYAN}Step 1: Prerequisites${NC}"

for cmd in forge cast jq python3 node; do
    if command -v "$cmd" &>/dev/null; then
        check_pass "$cmd installed"
    else
        check_fail "$cmd installed" "not found in PATH"
    fi
done

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    check_fail "Deployment file" "$DEPLOYMENT_FILE not found"
    echo -e "${RED}Cannot continue without deployment file.${NC}"
    exit 1
fi
check_pass "Deployment file exists"

# ════════════════════════════════════════════════════════════
# Step 2: Load config
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}Step 2: Load configuration${NC}"

jval() { python3 -c "import json,sys; d=json.load(open('$DEPLOYMENT_FILE')); v=$1; print(v if v else '')" 2>/dev/null; }

CHAIN_ID=$(jval "d['chainId']")
INDEX=$(jval "d['contracts']['Index']")
BITGET_VAULT=$(jval "d['contracts']['MockBitgetVault']")
BRIDGE_PROXY=$(jval "d['contracts']['BridgeProxy']")
L3_WUSDC=$(jval "d['contracts'].get('L3_WUSDC', d['contracts'].get('USDC',''))")
VISION=$(jval "d['contracts'].get('Vision','')")
AP_ADDR=$(jval "d['accounts'].get('ap','')")

# RPC from env → deployment file → default
if [ -z "$RPC" ]; then
    RPC=$(jval "d.get('rpc','')")
fi
RPC="${RPC:-http://142.132.164.24/}"

DATA_NODE_URL="${DATA_NODE_URL:-http://116.203.156.98/data-node}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo "  Chain ID:        $CHAIN_ID"
echo "  RPC:             $RPC"
echo "  Index:           $INDEX"
echo "  MockBitgetVault: $BITGET_VAULT"
echo "  BridgeProxy:     $BRIDGE_PROXY"
echo "  L3_WUSDC:        $L3_WUSDC"
echo "  Vision:          $VISION"
echo "  AP:              $AP_ADDR"
echo "  Data-node:       $DATA_NODE_URL"
echo "  Frontend:        $FRONTEND_URL"

# Verify RPC connectivity
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
    ACTUAL_CHAIN=$(cast chain-id --rpc-url "$RPC" 2>/dev/null)
    if [ "$ACTUAL_CHAIN" = "$CHAIN_ID" ]; then
        check_pass "RPC reachable (chain $ACTUAL_CHAIN)"
    else
        check_warn "RPC reachable" "chain $ACTUAL_CHAIN ≠ expected $CHAIN_ID"
    fi
else
    check_fail "RPC reachable" "$RPC unreachable"
    echo -e "${RED}Cannot continue without RPC.${NC}"
    exit 1
fi

# ════════════════════════════════════════════════════════════
# Step 3: Check / Deploy ITP
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}Step 3: Check ITP on-chain${NC}"

ITP_COUNT=$(cast call "$INDEX" "getItpCount()" --rpc-url "$RPC" 2>/dev/null | cast --to-dec 2>/dev/null || echo "0")
echo "  Current ITP count: $ITP_COUNT"

if [ "$ITP_COUNT" -gt 0 ] 2>/dev/null; then
    check_pass "ITP #1 exists on-chain (count=$ITP_COUNT)"

    # Verify NAV
    ITP_ID="0x0000000000000000000000000000000000000000000000000000000000000001"
    NAV_RAW=$(cast call "$INDEX" "getNAV(bytes32)" "$ITP_ID" --rpc-url "$RPC" 2>/dev/null || echo "0x0")
    NAV_DEC=$(cast --to-dec "$NAV_RAW" 2>/dev/null || echo "0")
    echo "  ITP #1 NAV: $NAV_DEC"
elif [ "${SKIP_ITP_DEPLOY:-0}" = "1" ]; then
    check_warn "No ITP on-chain" "SKIP_ITP_DEPLOY=1, skipping deploy"
else
    echo "  No ITPs found — deploying 100-asset ITP..."
    echo ""

    # ── 3a: Fetch Bitget prices ──
    echo "  Fetching Bitget prices..."
    CREATION_PRICES_FILE="data/creation-prices.json"

    BITGET_RESP=$(curl -sf --connect-timeout 10 --max-time 30 \
        "https://api.bitget.com/api/v2/spot/market/tickers" 2>/dev/null || echo "")

    if [ -n "$BITGET_RESP" ] && echo "$BITGET_RESP" | jq -e '.data' >/dev/null 2>&1; then
        python3 -c "
import json, sys

data = json.loads('''$(echo "$BITGET_RESP" | python3 -c "import sys; print(sys.stdin.read().replace(\"'\", \"\\\\'\"))")''')
tickers = {t['symbol']: t['lastPr'] for t in data.get('data', [])}

result = {}
for sym, price_str in tickers.items():
    try:
        price_float = float(price_str)
        price_int = int(price_float * 10**18)
        result[sym] = str(price_int)
    except:
        pass

with open('$CREATION_PRICES_FILE', 'w') as f:
    json.dump(result, f, indent=2)
print(f'Wrote {len(result)} prices to $CREATION_PRICES_FILE', file=sys.stderr)
" 2>&1 | head -5

        PRICE_COUNT=$(jq 'length' "$CREATION_PRICES_FILE" 2>/dev/null || echo "0")
        if [ "$PRICE_COUNT" -gt 50 ]; then
            check_pass "Bitget prices fetched ($PRICE_COUNT pairs)"
        else
            check_warn "Bitget prices" "Only $PRICE_COUNT pairs (need 100)"
        fi
    else
        check_warn "Bitget API" "Unreachable — using existing prices file"
    fi

    # ── 3b: Deploy 100-asset ITP ──
    echo ""
    echo "  Running Deploy100AssetITP.s.sol..."
    echo "  Deployer: $DEPLOYER_ADDR"
    echo "  Index:    $INDEX"
    echo "  Vault:    $BITGET_VAULT"

    mkdir -p logs
    cd contracts

    PRIVATE_KEY="$DEPLOYER_KEY" \
    ADMIN_KEY="$DEPLOYER_KEY" \
    INDEX_ADDRESS="$INDEX" \
    MOCK_BITGET_VAULT="$BITGET_VAULT" \
    AP_ADDRESS="${AP_ADDR:-$DEPLOYER_ADDR}" \
    L3_WUSDC="$L3_WUSDC" \
    forge script script/Deploy100AssetITP.s.sol:Deploy100AssetITP \
        --rpc-url "$RPC" \
        --private-key "$DEPLOYER_KEY" \
        --broadcast \
        --chain-id "$CHAIN_ID" \
        --slow \
        -vv > ../logs/forge-deploy-itp.log 2>&1
    FORGE_RC=$?
    cd "$REPO_ROOT"

    if [ "$FORGE_RC" -ne 0 ]; then
        check_fail "Deploy 100-asset ITP" "forge script failed (exit $FORGE_RC)"
        echo "  Last 30 lines of log:"
        tail -30 logs/forge-deploy-itp.log
    else
        check_pass "Deploy 100-asset ITP"

        # Verify ITP exists now
        ITP_COUNT=$(cast call "$INDEX" "getItpCount()" --rpc-url "$RPC" 2>/dev/null | cast --to-dec 2>/dev/null || echo "0")
        if [ "$ITP_COUNT" -gt 0 ]; then
            check_pass "ITP #1 verified on-chain (count=$ITP_COUNT)"
        else
            check_fail "ITP #1 verified" "getItpCount still 0 after deploy"
        fi

        # Merge ITP deployment into active-deployment.json
        if [ -f "$ITP_100_DEPLOYMENT" ]; then
            python3 -c "
import json
deploy = json.load(open('$DEPLOYMENT_FILE'))
itp100 = json.load(open('$ITP_100_DEPLOYMENT'))
deploy['contracts']['itpId'] = itp100['itpId']
deploy['contracts']['ITP_Vault'] = itp100.get('itpVault', '')
json.dump(deploy, open('$DEPLOYMENT_FILE', 'w'), indent=2)
"
            echo "  Merged ITP data into $DEPLOYMENT_FILE"
        fi
    fi
fi

# ════════════════════════════════════════════════════════════
# Step 4: Sync deployment files to frontend
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}Step 4: Sync deployment files${NC}"

cp "$DEPLOYMENT_FILE" frontend/lib/contracts/deployment.json
check_pass "deployment.json → frontend/lib/contracts/"

# Also copy deployed-assets.json if it exists
if [ -f "frontend/public/deployed-assets.json" ]; then
    ASSET_COUNT=$(jq 'length' frontend/public/deployed-assets.json 2>/dev/null || echo "0")
    check_pass "deployed-assets.json exists ($ASSET_COUNT assets)"
else
    check_warn "deployed-assets.json" "Not found — Create ITP section won't work"
fi

# Copy vision deployment files if they exist
for f in deployments/vision-deployment.json deployments/vision-batches.json deployments/morpho-e2e.json; do
    if [ -f "$f" ]; then
        echo "  $(basename $f) exists"
    fi
done

# ════════════════════════════════════════════════════════════
# Step 5: Fund test accounts
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}Step 5: Fund test accounts${NC}"

# Test user = deployer on testnet
TEST_USER="$DEPLOYER_ADDR"

# Check ETH balance
ETH_BAL=$(cast balance "$TEST_USER" --ether --rpc-url "$RPC" 2>/dev/null || echo "0")
ETH_OK=$(python3 -c "print('yes' if float('$ETH_BAL') > 1 else 'no')" 2>/dev/null || echo "no")
if [ "$ETH_OK" = "yes" ]; then
    check_pass "Test user has ETH (${ETH_BAL} ETH)"
else
    check_warn "Test user ETH" "Low balance: ${ETH_BAL} ETH"
fi

# Check L3_WUSDC balance
if [ -n "$L3_WUSDC" ]; then
    USDC_BAL=$(cast call "$L3_WUSDC" "balanceOf(address)" "$TEST_USER" --rpc-url "$RPC" 2>/dev/null || echo "0x0")
    USDC_DEC=$(cast --to-dec "$USDC_BAL" 2>/dev/null || echo "0")
    USDC_HAS=$(python3 -c "print('yes' if int('$USDC_DEC') > 0 else 'no')" 2>/dev/null || echo "no")
    if [ "$USDC_HAS" = "yes" ]; then
        check_pass "Test user has L3_WUSDC ($USDC_DEC)"
    else
        # Mint some L3_WUSDC for tests
        echo "  Minting 10000 L3_WUSDC to test user..."
        MINT_AMOUNT="10000000000000000000000"  # 10000 * 1e18
        cast send "$L3_WUSDC" "mint(address,uint256)" "$TEST_USER" "$MINT_AMOUNT" \
            --private-key "$DEPLOYER_KEY" --rpc-url "$RPC" >/dev/null 2>&1 && \
            check_pass "Minted 10000 L3_WUSDC to test user" || \
            check_warn "Mint L3_WUSDC" "Failed (deployer may not have mint rights)"
    fi
fi

# Check ARB_USDC balance (same chain on testnet)
ARB_USDC=$(jval "d['contracts'].get('ARB_USDC','')")
if [ -n "$ARB_USDC" ]; then
    ARB_BAL=$(cast call "$ARB_USDC" "balanceOf(address)" "$TEST_USER" --rpc-url "$RPC" 2>/dev/null || echo "0x0")
    ARB_DEC=$(cast --to-dec "$ARB_BAL" 2>/dev/null || echo "0")
    ARB_HAS=$(python3 -c "print('yes' if int('$ARB_DEC') > 0 else 'no')" 2>/dev/null || echo "no")
    if [ "$ARB_HAS" = "yes" ]; then
        check_pass "Test user has ARB_USDC ($ARB_DEC)"
    else
        echo "  Minting 10000 ARB_USDC to test user..."
        MINT_AMOUNT="10000000000"  # 10000 * 1e6
        cast send "$ARB_USDC" "mint(address,uint256)" "$TEST_USER" "$MINT_AMOUNT" \
            --private-key "$DEPLOYER_KEY" --rpc-url "$RPC" >/dev/null 2>&1 && \
            check_pass "Minted 10000 ARB_USDC to test user" || \
            check_warn "Mint ARB_USDC" "Failed"
    fi
fi

# ════════════════════════════════════════════════════════════
# Step 6: Check data-node
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}Step 6: Data-node health${NC}"

DN_HEALTH=$(curl -sf "$DATA_NODE_URL/health" 2>/dev/null || echo "")
if [ -n "$DN_HEALTH" ]; then
    DN_STATUS=$(echo "$DN_HEALTH" | jq -r '.status // "unknown"' 2>/dev/null)
    DN_SYMBOLS=$(echo "$DN_HEALTH" | jq -r '.symbols_tracked // 0' 2>/dev/null)
    if [ "$DN_STATUS" = "healthy" ]; then
        check_pass "Data-node healthy ($DN_SYMBOLS symbols tracked)"
    else
        check_warn "Data-node" "Status: $DN_STATUS"
    fi
else
    check_fail "Data-node" "$DATA_NODE_URL unreachable"
fi

# Check SSE stream has ITP data (data-node must have --index-address)
SSE_DATA=$(curl -sf --max-time 5 "$DATA_NODE_URL/sse/stream?topics=nav" 2>/dev/null | head -5 || echo "")
if echo "$SSE_DATA" | grep -q "itp-nav"; then
    ITP_NAME=$(echo "$SSE_DATA" | grep '"name"' | head -1 | python3 -c "import sys,json; d=json.loads(sys.stdin.read().split('data: ')[1]); print(d[0]['name'])" 2>/dev/null || echo "unknown")
    check_pass "SSE stream has ITP data ($ITP_NAME)"
else
    check_warn "SSE stream" "No ITP data — data-node may be missing --index-address. Restart with: ./testnet.sh stop && ./testnet.sh start"
fi

# Check sim cache
SIM_CATS=$(curl -sf "$DATA_NODE_URL/sim/categories" 2>/dev/null || echo "")
if [ -n "$SIM_CATS" ]; then
    CAT_COUNT=$(echo "$SIM_CATS" | jq '.categories | length' 2>/dev/null || echo "0")
    COINS_TOTAL=$(echo "$SIM_CATS" | jq '[.categories[].coin_count] | add // 0' 2>/dev/null || echo "0")
    if [ "$COINS_TOTAL" -gt 0 ]; then
        check_pass "Sim cache warm ($CAT_COUNT categories, $COINS_TOTAL coins)"
    else
        check_warn "Sim cache" "Empty ($CAT_COUNT categories, 0 coins). CoinGecko collector needs time."
        echo "  Triggering cache reload..."
        RELOAD=$(curl -sf "$DATA_NODE_URL/sim/reload-cache" 2>/dev/null || echo "")
        if [ -n "$RELOAD" ]; then
            RELOAD_CATS=$(echo "$RELOAD" | jq '.categories // 0' 2>/dev/null)
            echo "  Reload result: $RELOAD_CATS categories"
        fi
        echo "  Backtester tests will poll up to 180s for cache warmup."
    fi
fi

# Check Vision batches (served by issuers, not data-node)
if [ -n "$VISION" ]; then
    ISSUER_URL="${ISSUER_URL:-http://116.203.156.98/issuer1}"
    VISION_RESP=$(curl -sf "$ISSUER_URL/vision/batches" 2>/dev/null || echo "")
    if [ -n "$VISION_RESP" ]; then
        BATCH_COUNT=$(echo "$VISION_RESP" | jq '.batches | length' 2>/dev/null || echo "0")
        if [ "$BATCH_COUNT" -gt 0 ]; then
            check_pass "Vision batches available ($BATCH_COUNT via issuer)"
        else
            check_warn "Vision batches" "0 batches on issuer — may need re-indexing"
        fi
    else
        check_warn "Vision batches" "Issuer API unreachable at $ISSUER_URL"
    fi
fi

# ════════════════════════════════════════════════════════════
# Step 7: Check frontend
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}Step 7: Frontend${NC}"

FE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")
if [ "$FE_STATUS" = "200" ] || [ "$FE_STATUS" = "304" ]; then
    check_pass "Frontend reachable ($FRONTEND_URL)"
else
    check_warn "Frontend" "HTTP $FE_STATUS at $FRONTEND_URL — start with: cd frontend && npm run dev"
fi

# ════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════
echo ""
echo "============================================"
echo -e "${BOLD}     E2E TESTNET PREPARATION SUMMARY${NC}"
echo "============================================"
echo ""

for i in "${!CHECK_NAMES[@]}"; do
    case "${CHECK_RESULTS[$i]}" in
        PASS) echo -e "  ${GREEN}✓${NC} ${CHECK_NAMES[$i]}" ;;
        FAIL) echo -e "  ${RED}✗${NC} ${CHECK_NAMES[$i]}" ;;
        WARN) echo -e "  ${YELLOW}!${NC} ${CHECK_NAMES[$i]}" ;;
    esac
done

echo ""
echo "--------------------------------------------"
echo -e "  ${GREEN}Pass: $PASS_COUNT${NC}  |  ${YELLOW}Warn: $WARN_COUNT${NC}  |  ${RED}Fail: $FAIL_COUNT${NC}"
echo "--------------------------------------------"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}Ready for E2E tests!${NC}"
    echo ""
    echo "Run tests with:"
    echo "  cd frontend && E2E_TESTNET=1 npx playwright test --config e2e/playwright.config.ts"
    echo ""
    echo "Or specific test files:"
    echo "  E2E_TESTNET=1 npx playwright test e2e/tests/00-health-check.spec.ts"
    exit 0
else
    echo -e "${RED}$FAIL_COUNT critical issue(s) — fix before running E2E tests.${NC}"
    exit 1
fi
