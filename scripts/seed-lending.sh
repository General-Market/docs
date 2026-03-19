#!/usr/bin/env bash
# seed-lending.sh — Buy ITPs, supply as collateral, borrow USDC for each batch market.
# Seeds the MetaMorpho vault with borrow activity so supply APY > 0.
#
# Usage:
#   ./scripts/seed-lending.sh [--buy-only] [--borrow-only] [--amount 100]
#
# Requires: cast (foundry), jq, python3
# Reads: frontend/lib/contracts/batch-markets.json, deployment.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Parse flags ──
BUY_ONLY=false
BORROW_ONLY=false
BUY_AMOUNT=100  # USDC per ITP
BORROW_PCT=30   # Borrow 30% of collateral value (conservative, LLTV=77%)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --buy-only)    BUY_ONLY=true; shift ;;
    --borrow-only) BORROW_ONLY=true; shift ;;
    --amount)      BUY_AMOUNT="$2"; shift 2 ;;
    *)             echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── Load config ──
BATCH_MARKETS="$ROOT/frontend/lib/contracts/batch-markets.json"
DEPLOYMENT="$ROOT/frontend/lib/contracts/deployment.json"

if [[ ! -f "$BATCH_MARKETS" ]]; then echo "batch-markets.json not found"; exit 1; fi
if [[ ! -f "$DEPLOYMENT" ]]; then echo "deployment.json not found"; exit 1; fi

# Addresses from deployment.json
INDEX=$(python3 -c "import json; d=json.load(open('$DEPLOYMENT')); print(d['contracts']['Index'])")
L3_USDC=$(python3 -c "import json; d=json.load(open('$DEPLOYMENT')); print(d['contracts']['L3_WUSDC'])")

# Addresses from batch-markets.json
MORPHO=$(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(d['infrastructure']['MORPHO'])")
LOAN_TOKEN=$(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(d['infrastructure']['SETTLEMENT_USDC'])")
MARKET_COUNT=$(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(len(d['markets']))")

# RPC
L3_RPC="${L3_RPC_URL:-http://142.132.164.24/}"

# Deployer key (default testnet deployer)
DEPLOYER_KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER=$(cast wallet address "$DEPLOYER_KEY" 2>/dev/null)

echo "=== Seed Lending ==="
echo "Index:       $INDEX"
echo "L3 USDC:     $L3_USDC"
echo "Morpho:      $MORPHO"
echo "Loan Token:  $LOAN_TOKEN"
echo "Markets:     $MARKET_COUNT"
echo "Deployer:    $DEPLOYER"
echo "Buy amount:  $BUY_AMOUNT USDC per ITP"
echo "Borrow pct:  $BORROW_PCT% of collateral"
echo ""

# ── Read ITP count and build vault→itpId map ──
ITP_COUNT=$(cast call "$INDEX" "getItpCount()(uint256)" --rpc-url "$L3_RPC")
echo "ITPs on-chain: $ITP_COUNT"

declare -A VAULT_TO_ITP  # vault_addr_lower → itpId
for i in $(seq 1 "$ITP_COUNT"); do
  ITP_ID=$(printf "0x%064x" "$i")
  VAULT=$(cast call "$INDEX" "itpVaults(bytes32)(address)" "$ITP_ID" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x0000000000000000000000000000000000000000")
  VAULT_LOWER=$(echo "$VAULT" | tr '[:upper:]' '[:lower:]')
  if [[ "$VAULT_LOWER" != "0x0000000000000000000000000000000000000000" ]]; then
    VAULT_TO_ITP["$VAULT_LOWER"]="$ITP_ID"
  fi
done
echo "Vaults mapped: ${#VAULT_TO_ITP[@]}"
echo ""

# ── Read batch markets ──
COLLATERALS=()
ORACLES=()
IRMS=()
LLTVS=()
for i in $(seq 0 $((MARKET_COUNT - 1))); do
  COLLATERALS+=($(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(d['markets'][$i]['collateralToken'])"))
  ORACLES+=($(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(d['markets'][$i]['oracle'])"))
  IRMS+=($(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(d['markets'][$i]['irm'])"))
  LLTVS+=($(python3 -c "import json; d=json.load(open('$BATCH_MARKETS')); print(d['markets'][$i]['lltv'])"))
done

# ── Amount in 18 decimals ──
BUY_WEI=$(python3 -c "print(int($BUY_AMOUNT * 10**18))")
DEADLINE=$(($(date +%s) + 86400))  # 24h from now
MAX_UINT="0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

# ═══════════════════════════════════════════════════════════════
# PHASE 1: Buy ITPs (submit orders for each batch market ITP)
# ═══════════════════════════════════════════════════════════════
if ! $BORROW_ONLY; then
  echo "══ Phase 1: Buy ITPs ══"

  # Mint L3 USDC first (MockERC20 — public mint)
  TOTAL_USDC=$(python3 -c "print(int($BUY_AMOUNT * $MARKET_COUNT * 2 * 10**18))")
  echo "Minting $((BUY_AMOUNT * MARKET_COUNT * 2)) L3 USDC to deployer..."
  cast send "$L3_USDC" "mint(address,uint256)" "$DEPLOYER" "$TOTAL_USDC" \
    --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 100000 2>/dev/null || echo "  (mint may have failed — might not be MockERC20)"

  # Approve Index to spend USDC
  echo "Approving Index to spend USDC..."
  cast send "$L3_USDC" "approve(address,uint256)" "$INDEX" "$MAX_UINT" \
    --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 100000 2>/dev/null

  ORDER_IDS=()
  SKIPPED=0
  for i in $(seq 0 $((MARKET_COUNT - 1))); do
    COLL="${COLLATERALS[$i]}"
    COLL_LOWER=$(echo "$COLL" | tr '[:upper:]' '[:lower:]')
    ITP_ID="${VAULT_TO_ITP[$COLL_LOWER]:-}"

    if [[ -z "$ITP_ID" ]]; then
      echo "  Market $i: collateral $COLL — no matching ITP, skipping"
      ORDER_IDS+=("")
      SKIPPED=$((SKIPPED + 1))
      continue
    fi

    # Check existing balance
    BAL=$(cast call "$COLL" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$L3_RPC" 2>/dev/null || echo "0")
    if [[ "$BAL" != "0" && "$BAL" != "0x0" ]]; then
      echo "  Market $i: already has $BAL collateral, skipping buy"
      ORDER_IDS+=("")
      continue
    fi

    # Submit buy order: submitOrder(bytes32, uint8, uint256, uint256, uint256, uint256)
    # side=0 (Buy), limitPrice=10 USDC (10x buffer), slippageTier=1
    LIMIT_PRICE=$(python3 -c "print(int(10 * 10**18))")
    echo -n "  Market $i: buying ITP ${ITP_ID:0:18}... "
    ORDER_ID=$(cast send "$INDEX" \
      "submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)" \
      "$ITP_ID" 0 "$BUY_WEI" "$LIMIT_PRICE" 1 "$DEADLINE" \
      --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 500000 \
      --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','0x0'))" || echo "failed")

    if [[ "$ORDER_ID" == "0x1" ]]; then
      echo "tx confirmed"
      ORDER_IDS+=("ok")
    else
      echo "FAILED"
      ORDER_IDS+=("")
    fi
  done

  SUBMITTED=$((MARKET_COUNT - SKIPPED))
  echo ""
  echo "Submitted $SUBMITTED buy orders. Waiting for oracle fills..."

  if $BUY_ONLY; then
    echo "Done (--buy-only). Run again with --borrow-only after orders fill."
    exit 0
  fi

  # Wait for oracle to fill orders (poll collateral balances)
  MAX_WAIT=300  # 5 minutes
  POLL_INTERVAL=15
  ELAPSED=0
  while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    FILLED=0
    for i in $(seq 0 $((MARKET_COUNT - 1))); do
      BAL=$(cast call "${COLLATERALS[$i]}" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$L3_RPC" 2>/dev/null || echo "0")
      if [[ "$BAL" != "0" && "$BAL" != "0x0" ]]; then
        FILLED=$((FILLED + 1))
      fi
    done
    echo "  ${ELAPSED}s: $FILLED/$MARKET_COUNT markets have collateral"
    if [[ $FILLED -ge $SUBMITTED ]]; then
      echo "All orders filled!"
      break
    fi
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done
  echo ""
fi

# ═══════════════════════════════════════════════════════════════
# PHASE 2: Supply collateral + Borrow for each market
# ═══════════════════════════════════════════════════════════════
echo "══ Phase 2: Supply Collateral + Borrow ══"

# Need to mint loan token USDC if it differs from L3_USDC (for repayment buffer)
if [[ "$(echo "$LOAN_TOKEN" | tr '[:upper:]' '[:lower:]')" != "$(echo "$L3_USDC" | tr '[:upper:]' '[:lower:]')" ]]; then
  echo "Minting loan token USDC (different from L3 USDC)..."
  cast send "$LOAN_TOKEN" "mint(address,uint256)" "$DEPLOYER" "$(python3 -c 'print(10**24)')" \
    --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 100000 2>/dev/null || echo "  (loan token mint failed — may not be MockERC20)"
fi

SUPPLIED=0
BORROWED=0

for i in $(seq 0 $((MARKET_COUNT - 1))); do
  COLL="${COLLATERALS[$i]}"

  # Check collateral balance
  BAL=$(cast call "$COLL" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$L3_RPC" 2>/dev/null || echo "0")
  if [[ "$BAL" == "0" || "$BAL" == "0x0" ]]; then
    echo "  Market $i: no collateral, skipping"
    continue
  fi

  # Use full balance as collateral
  SUPPLY_AMOUNT="$BAL"
  # Borrow = collateral_value * BORROW_PCT / 100
  # Since NAV ≈ $1 and oracle price = 1e36, collateral value ≈ collateral amount
  BORROW_AMOUNT=$(python3 -c "print(int(int('$BAL') * $BORROW_PCT // 100))")
  if [[ "$BORROW_AMOUNT" == "0" ]]; then
    BORROW_AMOUNT=$(python3 -c "print(int(1 * 10**18))")  # minimum 1 USDC
  fi

  echo -n "  Market $i ($COLL): "

  # Approve collateral to Morpho
  cast send "$COLL" "approve(address,uint256)" "$MORPHO" "$MAX_UINT" \
    --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 100000 2>/dev/null || true

  # supplyCollateral(MarketParams, uint256 assets, address onBehalf, bytes data)
  # MarketParams = (loanToken, collateralToken, oracle, irm, lltv)
  RESULT=$(cast send "$MORPHO" \
    "supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)" \
    "(${LOAN_TOKEN},${COLL},${ORACLES[$i]},${IRMS[$i]},${LLTVS[$i]})" \
    "$SUPPLY_AMOUNT" "$DEPLOYER" "0x" \
    --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 500000 \
    --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','0x0'))" || echo "0x0")

  if [[ "$RESULT" == "0x1" ]]; then
    echo -n "supplied, "
    SUPPLIED=$((SUPPLIED + 1))
  else
    echo "supply FAILED"
    continue
  fi

  # borrow(MarketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)
  RESULT=$(cast send "$MORPHO" \
    "borrow((address,address,address,address,uint256),uint256,uint256,address,address)" \
    "(${LOAN_TOKEN},${COLL},${ORACLES[$i]},${IRMS[$i]},${LLTVS[$i]})" \
    "$BORROW_AMOUNT" "0" "$DEPLOYER" "$DEPLOYER" \
    --rpc-url "$L3_RPC" --private-key "$DEPLOYER_KEY" --gas-limit 500000 \
    --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','0x0'))" || echo "0x0")

  if [[ "$RESULT" == "0x1" ]]; then
    BORROW_USD=$(python3 -c "print(f'{int(\"$BORROW_AMOUNT\") / 10**18:.2f}')")
    echo "borrowed $BORROW_USD USDC"
    BORROWED=$((BORROWED + 1))
  else
    echo "borrow FAILED (may exceed LLTV)"
  fi
done

echo ""
echo "═══ Summary ═══"
echo "Supplied collateral: $SUPPLIED / $MARKET_COUNT markets"
echo "Borrowed USDC:       $BORROWED / $MARKET_COUNT markets"
echo ""
echo "The vault should now show non-zero APY."
echo "Check: cast call $MORPHO 'market(bytes32)' <marketId> --rpc-url $L3_RPC"
