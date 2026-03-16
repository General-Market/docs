#!/usr/bin/env bash
set -euo pipefail

# Deploy Morpho lending markets for all ITPs that don't have one yet.
# Reads ITP vaults from Index contract, gets NAV prices, runs DeployBatchMarkets.s.sol.
#
# Usage: ./scripts/deploy-batch-markets.sh [--dry-run]
#
# Requires: cast, forge, jq
# Env: DEPLOYER_KEY (optional, defaults to Anvil key 0)

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Config from deployment files ──
DEPLOYMENT="frontend/lib/contracts/deployment.json"
MORPHO_DEPLOYMENT="frontend/lib/contracts/morpho-deployment.json"

INDEX_ADDR=$(jq -r '.contracts.Index' "$DEPLOYMENT")
L3_RPC=$(jq -r '.contracts.L3_WUSDC // empty' "$DEPLOYMENT" | head -c 0; echo "http://142.132.164.24")

MORPHO=$(jq -r '.contracts.MORPHO' "$MORPHO_DEPLOYMENT")
CURATOR_IRM=$(jq -r '.contracts.ADAPTIVE_IRM' "$MORPHO_DEPLOYMENT")
VAULT=$(jq -r '.contracts.METAMORPHO_VAULT' "$MORPHO_DEPLOYMENT")
LOAN_TOKEN=$(jq -r '.marketParams.loanToken' "$MORPHO_DEPLOYMENT")
MIRROR_REGISTRY=$(jq -r '.contracts.MIRROR_REGISTRY' "$MORPHO_DEPLOYMENT")
EXISTING_COLLATERAL=$(jq -r '.marketParams.collateralToken' "$MORPHO_DEPLOYMENT" | tr '[:upper:]' '[:lower:]')

echo "Index contract: $INDEX_ADDR"
echo "Morpho: $MORPHO"
echo "Vault: $VAULT"
echo "Existing collateral: $EXISTING_COLLATERAL"
echo ""

# ── Discover all ITP vaults ──
ITP_COUNT=$(cast call "$INDEX_ADDR" "getItpCount()(uint256)" --rpc-url "$L3_RPC")
echo "Total ITPs on-chain: $ITP_COUNT"

VAULTS=()
ITP_IDS=()
for i in $(seq 1 "$ITP_COUNT"); do
  ITP_ID=$(printf "0x%064x" "$i")
  VAULT_ADDR=$(cast call "$INDEX_ADDR" "itpVaults(bytes32)(address)" "$ITP_ID" --rpc-url "$L3_RPC" 2>/dev/null || echo "0x0000000000000000000000000000000000000000")

  # Skip zero address (no vault) and the existing singleton market
  if [[ "$VAULT_ADDR" == "0x0000000000000000000000000000000000000000" ]]; then
    continue
  fi
  VAULT_LOWER=$(echo "$VAULT_ADDR" | tr '[:upper:]' '[:lower:]')
  if [[ "$VAULT_LOWER" == "$EXISTING_COLLATERAL" ]]; then
    echo "  ITP #$i: $VAULT_ADDR (already has market, skipping)"
    continue
  fi

  VAULTS+=("$VAULT_ADDR")
  ITP_IDS+=("$ITP_ID")
  echo "  ITP #$i: $VAULT_ADDR"
done

NEW_COUNT=${#VAULTS[@]}
echo ""
echo "New markets to deploy: $NEW_COUNT"

if [[ "$NEW_COUNT" -eq 0 ]]; then
  echo "Nothing to deploy."
  exit 0
fi

# ── Build env vars ──
# Default: 77% LLTV, initial price = 1e36 (1 USD in Morpho oracle format: 36 decimals)
DEFAULT_LLTV="770000000000000000"
DEFAULT_PRICE="1000000000000000000000000000000000000"

ENV_FILE=$(mktemp)
cat > "$ENV_FILE" <<EOF
MORPHO=$MORPHO
CURATOR_RATE_IRM=$CURATOR_IRM
METAMORPHO_VAULT=$VAULT
SETTLEMENT_USDC=$LOAN_TOKEN
MIRROR_REGISTRY=$MIRROR_REGISTRY
BATCH_MARKET_COUNT=$NEW_COUNT
EOF

for i in "${!VAULTS[@]}"; do
  cat >> "$ENV_FILE" <<EOF
ITP_${i}_ADDRESS=${VAULTS[$i]}
ITP_${i}_LLTV=$DEFAULT_LLTV
ITP_${i}_INITIAL_PRICE=$DEFAULT_PRICE
EOF
done

echo ""
echo "Generated env file:"
cat "$ENV_FILE"
echo ""

if $DRY_RUN; then
  echo "[DRY RUN] Would run: forge script DeployBatchMarkets --rpc-url $L3_RPC --broadcast"
  echo "Env file: $ENV_FILE"
  rm "$ENV_FILE"
  exit 0
fi

# ── Deploy ──
echo "Deploying batch markets..."
cd contracts
source "$ENV_FILE"
export MORPHO CURATOR_RATE_IRM METAMORPHO_VAULT SETTLEMENT_USDC MIRROR_REGISTRY BATCH_MARKET_COUNT
for i in "${!VAULTS[@]}"; do
  export "ITP_${i}_ADDRESS=${VAULTS[$i]}"
  export "ITP_${i}_LLTV=$DEFAULT_LLTV"
  export "ITP_${i}_INITIAL_PRICE=$DEFAULT_PRICE"
done

forge script script/DeployBatchMarkets.s.sol --rpc-url "$L3_RPC" --broadcast

rm "$ENV_FILE"

# ── Copy output to frontend ──
OUTPUT="../deployments/batch-markets.json"
if [[ -f "$OUTPUT" ]]; then
  cp "$OUTPUT" "../frontend/lib/contracts/batch-markets.json"
  echo ""
  echo "Copied batch-markets.json to frontend/lib/contracts/"
  echo "Redeploy frontend to enable Borrow buttons for all ITPs."
else
  echo "WARNING: batch-markets.json not found at $OUTPUT"
fi
