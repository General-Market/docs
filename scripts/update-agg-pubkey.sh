#!/usr/bin/env bash
# Update aggregated BLS pubkey on all registry contracts
#
# Usage:
#   ./scripts/update-agg-pubkey.sh
#
# Required environment variables:
#   RPC              - L3 RPC URL
#   ADMIN_KEY        - Admin private key
#   ISSUER_REGISTRY  - IssuerRegistry proxy address
#   FEE_REGISTRY     - FeeRegistry address
#   ASSET_PAIR_REGISTRY - AssetPairRegistry address
#   COLLATERAL_REGISTRY - CollateralRegistry address
#
# Run after any addIssuer/removeIssuer/key rotation on live testnet.

set -euo pipefail

: "${RPC:?RPC env var required}"
: "${ADMIN_KEY:?ADMIN_KEY env var required}"
: "${ISSUER_REGISTRY:?ISSUER_REGISTRY env var required}"
: "${FEE_REGISTRY:?FEE_REGISTRY env var required}"
: "${ASSET_PAIR_REGISTRY:?ASSET_PAIR_REGISTRY env var required}"
: "${COLLATERAL_REGISTRY:?COLLATERAL_REGISTRY env var required}"

echo "Computing aggregated pubkey from on-chain IssuerRegistry..."
AGG_PUBKEY=$(./target/release/bls-tool --rpc "$RPC" --issuer-registry "$ISSUER_REGISTRY")
echo "Aggregated pubkey: $AGG_PUBKEY"

echo "Setting aggregated pubkey on IssuerRegistry..."
cast send "$ISSUER_REGISTRY" "setAggregatedPubkey(bytes)" "$AGG_PUBKEY" \
  --private-key "$ADMIN_KEY" --rpc-url "$RPC"

echo "Setting aggregated pubkey on FeeRegistry..."
cast send "$FEE_REGISTRY" "setAggregatedPubkey(bytes)" "$AGG_PUBKEY" \
  --private-key "$ADMIN_KEY" --rpc-url "$RPC"

echo "Setting aggregated pubkey on AssetPairRegistry..."
cast send "$ASSET_PAIR_REGISTRY" "setAggregatedPubkey(bytes)" "$AGG_PUBKEY" \
  --private-key "$ADMIN_KEY" --rpc-url "$RPC"

echo "Setting aggregated pubkey on CollateralRegistry..."
cast send "$COLLATERAL_REGISTRY" "setAggregatedPubkey(bytes)" "$AGG_PUBKEY" \
  --private-key "$ADMIN_KEY" --rpc-url "$RPC"

echo "Done. Aggregated pubkey updated on all 4 registries."
