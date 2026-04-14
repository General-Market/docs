#!/usr/bin/env bash
# Validate all deployment addresses have code on-chain.
# Run before E2E tests or Vercel deploy to catch stale configs early.
#
# Usage:
#   ./scripts/validate-deployment.sh              # uses active env
#   ./scripts/validate-deployment.sh testnet       # forces testnet env
#   ./scripts/validate-deployment.sh --fix         # redeploy stale contracts

set -eo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# Load env
ENV="${1:-$(cat .active-env 2>/dev/null || echo 'local')}"
if [ "$ENV" = "--fix" ]; then
    FIX=1
    ENV="$(cat .active-env 2>/dev/null || echo 'local')"
else
    FIX="${2:-0}"
    [ "$2" = "--fix" ] && FIX=1
fi

echo -e "${BLUE}Validating deployment addresses (env: $ENV)${NC}"

# Determine RPC from env
case "$ENV" in
    local)   L3_RPC="http://localhost:8545" ;;
    testnet) L3_RPC="http://142.132.164.24/" ;;
    *)       L3_RPC="http://142.132.164.24/" ;;
esac

# Check L3 connectivity
CHAIN_ID=$(cast chain-id --rpc-url "$L3_RPC" 2>/dev/null || echo "0")
if [ "$CHAIN_ID" = "0" ]; then
    echo -e "${RED}L3 RPC unreachable: $L3_RPC${NC}"
    exit 1
fi
echo -e "  ${GREEN}L3 chain $CHAIN_ID reachable${NC}"

# Read deployment JSON
DEPLOYMENT="frontend/lib/contracts/deployment.json"
if [ ! -f "$DEPLOYMENT" ]; then
    echo -e "${RED}Missing: $DEPLOYMENT${NC}"
    exit 1
fi

ERRORS=0
WARNINGS=0

# Validate core contracts
CORE_CONTRACTS="Index OracleRegistry Vision L3_WUSDC L3BridgeProxy CollateralRegistry"
echo -e "\n${BLUE}Core contracts:${NC}"
for NAME in $CORE_CONTRACTS; do
    ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT'))['contracts'].get('$NAME',''))" 2>/dev/null)
    if [ -z "$ADDR" ]; then
        echo -e "  ${RED}MISSING $NAME — not in deployment.json${NC}"
        ERRORS=$((ERRORS + 1))
        continue
    fi
    CODE=$(cast code "$ADDR" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x")
    if [ "$CODE" = "0x" ] || [ -z "$CODE" ]; then
        echo -e "  ${RED}NO CODE $NAME ($ADDR)${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}OK${NC} $NAME ($ADDR)"
    fi
done

# Validate optional contracts
OPT_CONTRACTS="MockBitgetVault Governance"
echo -e "\n${BLUE}Optional contracts:${NC}"
for NAME in $OPT_CONTRACTS; do
    ADDR=$(python3 -c "import json; print(json.load(open('$DEPLOYMENT'))['contracts'].get('$NAME',''))" 2>/dev/null)
    if [ -z "$ADDR" ]; then continue; fi
    CODE=$(cast code "$ADDR" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x")
    if [ "$CODE" = "0x" ] || [ -z "$CODE" ]; then
        echo -e "  ${YELLOW}NO CODE $NAME ($ADDR)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${GREEN}OK${NC} $NAME ($ADDR)"
    fi
done

# Validate Morpho
MORPHO_JSON="frontend/lib/contracts/morpho-deployment.json"
echo -e "\n${BLUE}Morpho:${NC}"
if [ -f "$MORPHO_JSON" ]; then
    MORPHO_ADDR=$(python3 -c "import json; print(json.load(open('$MORPHO_JSON'))['contracts']['MORPHO'])" 2>/dev/null)
    MORPHO_CODE=$(cast code "$MORPHO_ADDR" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x")
    if [ "$MORPHO_CODE" = "0x" ]; then
        echo -e "  ${RED}MORPHO ($MORPHO_ADDR) has NO CODE${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}OK${NC} MORPHO ($MORPHO_ADDR)"
    fi

    COLLAT_ADDR=$(python3 -c "import json; print(json.load(open('$MORPHO_JSON'))['marketParams']['collateralToken'])" 2>/dev/null)
    COLLAT_CODE=$(cast code "$COLLAT_ADDR" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x")
    if [ "$COLLAT_CODE" = "0x" ]; then
        echo -e "  ${RED}collateralToken ($COLLAT_ADDR) has NO CODE — STALE DEPLOYMENT${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}OK${NC} collateralToken ($COLLAT_ADDR)"
    fi

    ORACLE_ADDR=$(python3 -c "import json; print(json.load(open('$MORPHO_JSON'))['contracts']['ITP_NAV_ORACLE'])" 2>/dev/null)
    ORACLE_CODE=$(cast code "$ORACLE_ADDR" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x")
    if [ "$ORACLE_CODE" = "0x" ]; then
        echo -e "  ${YELLOW}Oracle ($ORACLE_ADDR) has NO CODE${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${GREEN}OK${NC} Oracle ($ORACLE_ADDR)"
    fi
else
    echo -e "  ${YELLOW}No morpho-deployment.json found${NC}"
fi

# Vision batches
echo -e "\n${BLUE}Vision:${NC}"
VISION_JSON="frontend/lib/contracts/vision-batches.json"
if [ -f "$VISION_JSON" ]; then
    BATCH_COUNT=$(python3 -c "import json; print(json.load(open('$VISION_JSON'))['batchCount'])" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}$BATCH_COUNT batches configured${NC}"
else
    echo -e "  ${YELLOW}No vision-batches.json found${NC}"
fi

# JSON consistency check (frontend vs deployments)
echo -e "\n${BLUE}JSON consistency:${NC}"
for FILE in deployment.json morpho-deployment.json vision-batches.json; do
    FRONTEND="frontend/lib/contracts/$FILE"
    DEPLOY="deployments/${FILE/deployment/active-deployment}"
    [ "$FILE" = "deployment.json" ] && DEPLOY="deployments/active-deployment.json"
    [ "$FILE" = "morpho-deployment.json" ] && DEPLOY="deployments/morpho-e2e.json"
    [ "$FILE" = "vision-batches.json" ] && DEPLOY="deployments/vision-batches.json"

    if [ -f "$FRONTEND" ] && [ -f "$DEPLOY" ]; then
        if diff -q "$FRONTEND" "$DEPLOY" >/dev/null 2>&1; then
            echo -e "  ${GREEN}OK${NC} $FILE matches deployments/"
        else
            echo -e "  ${YELLOW}MISMATCH${NC} $FILE differs from deployments/"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
done

# Cross-file Index address consistency — catches the "envs/testnet/active-deployment stale" class
echo -e "\n${BLUE}Cross-file Index consistency:${NC}"
CANONICAL_INDEX=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])" 2>/dev/null)
if [ -z "$CANONICAL_INDEX" ]; then
    echo -e "  ${RED}Cannot read Index from deployments/active-deployment.json${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "  canonical Index: $CANONICAL_INDEX"
    for FP in \
        "envs/testnet/active-deployment.json" \
        "envs/testnet/deployment.json" \
        "frontend/public/deployment.json" \
        "frontend/lib/contracts/deployment.json"; do
        if [ ! -f "$FP" ]; then continue; fi
        OTHER=$(python3 -c "
import json
d = json.load(open('$FP'))
for path in [('contracts','Index'), ('Index',), ('addresses','Index')]:
    cur = d; ok = True
    for k in path:
        if isinstance(cur, dict) and k in cur: cur = cur[k]
        else: ok = False; break
    if ok and cur:
        print(cur); break
" 2>/dev/null)
        if [ -z "$OTHER" ]; then
            echo -e "  ${YELLOW}skip${NC} $FP (no Index field)"
            continue
        fi
        if [ "$(echo "$OTHER" | tr '[:upper:]' '[:lower:]')" = "$(echo "$CANONICAL_INDEX" | tr '[:upper:]' '[:lower:]')" ]; then
            echo -e "  ${GREEN}OK${NC} $FP"
        else
            echo -e "  ${RED}DRIFT${NC} $FP Index=$OTHER"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

# Summary
echo -e "\n${BLUE}Summary:${NC} $ERRORS errors, $WARNINGS warnings"
if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}Deployment has $ERRORS address errors — redeploy required${NC}"
    exit 1
fi
if [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}Deployment has $WARNINGS warnings (non-blocking)${NC}"
fi
echo -e "${GREEN}Deployment validation passed${NC}"
