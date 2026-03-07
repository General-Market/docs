#!/bin/bash
set -euo pipefail

# Deploy BLSCustody and dependencies to the settlement chain
# Story 6.5: BLSCustody settlement chain deployment

# Validate required environment variables
: "${PRIVATE_KEY:?PRIVATE_KEY is required}"
: "${SETTLEMENT_RPC_URL:?SETTLEMENT_RPC_URL is required}"
: "${ARBISCAN_API_KEY:?ARBISCAN_API_KEY is required}"

echo "============================================"
echo "Deploying BLSCustody to settlement chain"
echo "============================================"
echo ""

# Optional environment variables:
#   ISSUER_REGISTRY_ADDRESS - Reuse an existing IssuerRegistry deployment (skips Governance+IssuerRegistry deploy)
#   SKIP_WHITELIST=true     - Skip whitelist proposals (needed when IssuerRegistry has real BLS keys,
#                             due to G1/G2 pubkey mismatch in Phase 1 BLS verification)
if [ -n "${ISSUER_REGISTRY_ADDRESS:-}" ]; then
    echo "Using existing IssuerRegistry: $ISSUER_REGISTRY_ADDRESS"
fi

cd contracts

# Deploy contracts
forge script scripts/deploy/DeployBLSCustodyArbitrum.s.sol \
    --rpc-url "$SETTLEMENT_RPC_URL" \
    --broadcast \
    --verify \
    --etherscan-api-key "$ARBISCAN_API_KEY" \
    -vvvv

echo ""
echo "============================================"
echo "Deployment complete."
echo "Check deployments/arbitrum.json for addresses."
echo ""
echo "NEXT STEPS:"
echo "  1. Wait 2 days for whitelist timelock to expire"
echo "  2. Call activateWhitelist() for 1inch Router V6 and USDC"
echo "============================================"
