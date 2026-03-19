#!/usr/bin/env bash
set -euo pipefail

# fix-broken-oracles.sh — Find Morpho markets with empty oracle code, evict them
# from the MetaMorpho withdraw queue, then redeploy via DeployBatchMarkets.s.sol.
#
# The withdraw queue is full at 30. Markets whose oracles have no bytecode are
# dead weight — useless collateral slots consuming the queue limit. This script:
#   1. Reads the current withdraw queue (up to 30 market IDs)
#   2. For each market, resolves the oracle address and checks its code size
#   3. Markets with code size 0 get their cap zeroed (submitCap with 0)
#   4. If those markets have supply shares, calls submitMarketRemoval
#   5. Calls updateWithdrawQueue omitting the broken indexes
#   6. Reruns DeployBatchMarkets.s.sol for the affected ITP vaults
#
# Usage: ./scripts/fix-broken-oracles.sh [--dry-run]
#
# Requires: cast, forge, jq, python3

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Constants ──
RPC="http://142.132.164.24/"
KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
DEPLOYER=$(cast wallet address "$KEY" 2>/dev/null)

MORPHO="0xecf30fA79bb8aB854932E3De0a7D75Cf19cFd867"
VAULT="0xEd0B49a94104D65B8280B0B505402523A2fDBB6d"
IRM="0x9AFC81B6182F63dc10FECC42256248eE84593B27"
LOAN="0xB9f33D949224CEbb2c0eA649688FCf7cE57D8cD9"
MIRROR="0x4B0aac291f93081E6338d32dE15a5c4BEEEF1de1"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOYMENT="$ROOT/frontend/lib/contracts/deployment.json"
MORPHO_DEPLOYMENT="$ROOT/frontend/lib/contracts/morpho-deployment.json"
EXISTING_MARKET_ID=$(jq -r '.contracts.MARKET_ID' "$MORPHO_DEPLOYMENT")

DEFAULT_LLTV="770000000000000000"
DEFAULT_PRICE="1000000000000000000000000000000000000"

echo "=== Fix Broken Oracles ==="
echo "Deployer: $DEPLOYER"
echo "Vault:    $VAULT"
echo "Morpho:   $MORPHO"
echo ""

# ── Step 1: Read withdraw queue and check oracle code ──
WQ_LEN=$(cast call "$VAULT" "withdrawQueueLength()(uint256)" --rpc-url "$RPC")
echo "Withdraw queue length: $WQ_LEN"
echo ""

declare -a BROKEN_INDEXES=()     # indexes in WQ that have dead oracles
declare -a BROKEN_COLLATERALS=() # corresponding collateral (ITP vault) addresses
declare -a HEALTHY_INDEXES=()    # indexes to keep

for idx in $(seq 0 $((WQ_LEN - 1))); do
  MID=$(cast call "$VAULT" "withdrawQueue(uint256)(bytes32)" "$idx" --rpc-url "$RPC" 2>/dev/null)

  # Resolve market params: (loanToken, collateralToken, oracle, irm, lltv)
  PARAMS=$(cast call "$MORPHO" "idToMarketParams(bytes32)(address,address,address,address,uint256)" "$MID" --rpc-url "$RPC" 2>/dev/null)

  COLL=$(echo "$PARAMS" | sed -n '2p' | xargs)
  ORACLE=$(echo "$PARAMS" | sed -n '3p' | xargs)

  # Check oracle code size
  CODE=$(cast code "$ORACLE" --rpc-url "$RPC" 2>/dev/null || echo "0x")
  # "0x" means empty — no bytecode
  if [[ "$CODE" == "0x" || -z "$CODE" ]]; then
    echo "  [$idx] BROKEN  oracle=$ORACLE  collateral=$COLL"
    BROKEN_INDEXES+=("$idx")
    BROKEN_COLLATERALS+=("$COLL")
  else
    CODE_LEN=$(( (${#CODE} - 2) / 2 ))
    echo "  [$idx] OK      oracle=$ORACLE  code=${CODE_LEN}B  collateral=$COLL"
    HEALTHY_INDEXES+=("$idx")
  fi
done

BROKEN_COUNT=${#BROKEN_INDEXES[@]}
HEALTHY_COUNT=${#HEALTHY_INDEXES[@]}
echo ""
echo "Broken: $BROKEN_COUNT"
echo "Healthy: $HEALTHY_COUNT"
echo ""

if [[ "$BROKEN_COUNT" -eq 0 ]]; then
  echo "All oracles have code. Nothing to fix."
  exit 0
fi

if $DRY_RUN; then
  echo "[DRY RUN] Would zero caps for $BROKEN_COUNT markets, rebuild withdraw queue, then redeploy."
  echo "Broken collaterals:"
  for c in "${BROKEN_COLLATERALS[@]}"; do
    echo "  $c"
  done
  exit 0
fi

# ── Step 2: Zero caps of broken markets ──
echo "Zeroing caps of broken markets..."
for idx in "${BROKEN_INDEXES[@]}"; do
  MID=$(cast call "$VAULT" "withdrawQueue(uint256)(bytes32)" "$idx" --rpc-url "$RPC" 2>/dev/null)

  PARAMS=$(cast call "$MORPHO" "idToMarketParams(bytes32)(address,address,address,address,uint256)" "$MID" --rpc-url "$RPC" 2>/dev/null)
  P_LOAN=$(echo "$PARAMS" | sed -n '1p' | xargs)
  P_COLL=$(echo "$PARAMS" | sed -n '2p' | xargs)
  P_ORACLE=$(echo "$PARAMS" | sed -n '3p' | xargs)
  P_IRM=$(echo "$PARAMS" | sed -n '4p' | xargs)
  P_LLTV=$(echo "$PARAMS" | sed -n '5p' | xargs)

  echo -n "  [$idx] submitCap(0) for collateral=$P_COLL ... "

  # submitCap with newSupplyCap < currentCap sets cap immediately (no timelock)
  cast send "$VAULT" \
    "submitCap((address,address,address,address,uint256),uint256)" \
    "($P_LOAN,$P_COLL,$P_ORACLE,$P_IRM,$P_LLTV)" "0" \
    --private-key "$KEY" --rpc-url "$RPC" --gas-limit 300000 \
    --legacy --gas-price 200000000 \
    2>/dev/null >/dev/null && echo "OK" || echo "FAILED (may already be 0)"
done
echo ""

# ── Step 3: Handle markets with supply shares ──
echo "Checking supply shares on broken markets..."
for idx in "${BROKEN_INDEXES[@]}"; do
  MID=$(cast call "$VAULT" "withdrawQueue(uint256)(bytes32)" "$idx" --rpc-url "$RPC" 2>/dev/null)

  SHARES=$(cast call "$MORPHO" "supplyShares(bytes32,address)(uint256)" "$MID" "$VAULT" --rpc-url "$RPC" 2>/dev/null || echo "0")
  SHARES_CLEAN=$(echo "$SHARES" | tr -d '[:space:]')

  if [[ "$SHARES_CLEAN" != "0" && "$SHARES_CLEAN" != "" ]]; then
    echo "  [$idx] has $SHARES_CLEAN supply shares — calling submitMarketRemoval..."

    PARAMS=$(cast call "$MORPHO" "idToMarketParams(bytes32)(address,address,address,address,uint256)" "$MID" --rpc-url "$RPC" 2>/dev/null)
    P_LOAN=$(echo "$PARAMS" | sed -n '1p' | xargs)
    P_COLL=$(echo "$PARAMS" | sed -n '2p' | xargs)
    P_ORACLE=$(echo "$PARAMS" | sed -n '3p' | xargs)
    P_IRM=$(echo "$PARAMS" | sed -n '4p' | xargs)
    P_LLTV=$(echo "$PARAMS" | sed -n '5p' | xargs)

    cast send "$VAULT" \
      "submitMarketRemoval((address,address,address,address,uint256))" \
      "($P_LOAN,$P_COLL,$P_ORACLE,$P_IRM,$P_LLTV)" \
      --private-key "$KEY" --rpc-url "$RPC" --gas-limit 300000 \
      --legacy --gas-price 200000000 \
      2>/dev/null >/dev/null && echo "    submitMarketRemoval: OK" || echo "    submitMarketRemoval: FAILED"
  else
    echo "  [$idx] no supply shares — clean removal"
  fi
done
echo ""

# ── Step 4: Update withdraw queue — keep only healthy indexes ──
echo "Updating withdraw queue to remove broken markets..."
echo "  Keeping indexes: ${HEALTHY_INDEXES[*]}"

# Build the uint256[] argument for updateWithdrawQueue
# Format: [idx0,idx1,idx2,...]
INDEXES_ARG="["
FIRST=true
for hidx in "${HEALTHY_INDEXES[@]}"; do
  if $FIRST; then
    FIRST=false
  else
    INDEXES_ARG+=","
  fi
  INDEXES_ARG+="$hidx"
done
INDEXES_ARG+="]"

cast send "$VAULT" \
  "updateWithdrawQueue(uint256[])" "$INDEXES_ARG" \
  --private-key "$KEY" --rpc-url "$RPC" --gas-limit 1000000 \
  --legacy --gas-price 200000000 \
  2>/dev/null >/dev/null && echo "  Withdraw queue updated: OK" || {
    echo "  Withdraw queue update FAILED"
    echo "  This may mean some markets still have supply shares or pending caps."
    echo "  Check manually."
    exit 1
  }

# Verify new queue length
NEW_WQ_LEN=$(cast call "$VAULT" "withdrawQueueLength()(uint256)" --rpc-url "$RPC")
echo "  New withdraw queue length: $NEW_WQ_LEN (was $WQ_LEN, removed $BROKEN_COUNT)"
echo ""

# ── Step 5: Redeploy oracles + markets via DeployBatchMarkets.s.sol ──
REDEPLOY_COUNT=${#BROKEN_COLLATERALS[@]}
echo "Redeploying $REDEPLOY_COUNT markets with new oracles..."
echo ""

# Build env vars for forge script
ENV_FILE=$(mktemp)
cat > "$ENV_FILE" <<EOF
MORPHO=$MORPHO
CURATOR_RATE_IRM=$IRM
METAMORPHO_VAULT=$VAULT
SETTLEMENT_USDC=$LOAN
MIRROR_REGISTRY=$MIRROR
BATCH_MARKET_COUNT=$REDEPLOY_COUNT
EXISTING_MARKET_ID=$EXISTING_MARKET_ID
DEPLOYER_KEY=$KEY
EOF

for i in "${!BROKEN_COLLATERALS[@]}"; do
  cat >> "$ENV_FILE" <<EOF
ITP_${i}_ADDRESS=${BROKEN_COLLATERALS[$i]}
ITP_${i}_LLTV=$DEFAULT_LLTV
ITP_${i}_INITIAL_PRICE=$DEFAULT_PRICE
EOF
done

echo "Generated env file:"
cat "$ENV_FILE"
echo ""

# Source and export all vars
source "$ENV_FILE"
export MORPHO CURATOR_RATE_IRM METAMORPHO_VAULT SETTLEMENT_USDC MIRROR_REGISTRY
export BATCH_MARKET_COUNT EXISTING_MARKET_ID DEPLOYER_KEY
for i in "${!BROKEN_COLLATERALS[@]}"; do
  export "ITP_${i}_ADDRESS=${BROKEN_COLLATERALS[$i]}"
  export "ITP_${i}_LLTV=$DEFAULT_LLTV"
  export "ITP_${i}_INITIAL_PRICE=$DEFAULT_PRICE"
done

cd "$ROOT/contracts"
rm -rf broadcast/DeployBatchMarkets.s.sol/ cache/DeployBatchMarkets.s.sol/

echo "Running forge script..."
forge script script/DeployBatchMarkets.s.sol \
  --rpc-url "$RPC" \
  --broadcast \
  --legacy \
  --with-gas-price 200000000 \
  --force

rm "$ENV_FILE"

# ── Step 6: Copy output ──
OUTPUT="$ROOT/deployments/batch-markets.json"
if [[ -f "$OUTPUT" ]]; then
  cp "$OUTPUT" "$ROOT/frontend/lib/contracts/batch-markets.json"
  echo ""
  echo "Copied batch-markets.json to frontend."
fi

# ── Verification ──
echo ""
echo "=== Verification ==="
FINAL_WQ=$(cast call "$VAULT" "withdrawQueueLength()(uint256)" --rpc-url "$RPC")
FINAL_SQ=$(cast call "$VAULT" "supplyQueueLength()(uint256)" --rpc-url "$RPC")
echo "Withdraw queue: $FINAL_WQ"
echo "Supply queue:   $FINAL_SQ"
echo ""
echo "Done. $BROKEN_COUNT dead markets evicted, $REDEPLOY_COUNT redeployed with working oracles."
