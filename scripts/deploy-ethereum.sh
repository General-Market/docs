#!/bin/bash
set -euo pipefail

# Deploy BLSCustody and dependencies to Ethereum Mainnet
# Story 6.6: BLSCustody multi-chain deployment

# Validate required environment variables
: "${PRIVATE_KEY:?PRIVATE_KEY is required}"
: "${ETHEREUM_RPC_URL:?ETHEREUM_RPC_URL is required}"

echo "============================================"
echo "Deploying BLSCustody to Ethereum Mainnet"
echo "Chain ID: 1"
echo "============================================"
echo ""

# Optional: pass existing IssuerRegistry address
if [ -n "${ISSUER_REGISTRY_ADDRESS:-}" ]; then
    echo "Using existing IssuerRegistry: $ISSUER_REGISTRY_ADDRESS"
fi

# Validate RPC points to Ethereum mainnet (chain ID 1)
ACTUAL_CHAIN_ID=$(cast chain-id --rpc-url "$ETHEREUM_RPC_URL" 2>/dev/null || echo "unknown")
if [ "$ACTUAL_CHAIN_ID" != "1" ]; then
    echo "ERROR: RPC returned chain ID $ACTUAL_CHAIN_ID, expected 1 (Ethereum Mainnet)"
    exit 1
fi
echo "Chain ID verified: $ACTUAL_CHAIN_ID (Ethereum Mainnet)"
echo ""

# Set deployment output path
export DEPLOYMENT_OUTPUT="../deployments/ethereum.json"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../contracts"

forge script scripts/deploy/DeployBLSCustody.s.sol \
    --rpc-url "$ETHEREUM_RPC_URL" \
    --broadcast \
    ${ETHERSCAN_API_KEY:+--verify --etherscan-api-key "$ETHERSCAN_API_KEY"} \
    -vvvv

echo ""
echo "============================================"
echo "Deployment complete."
echo "Check deployments/ethereum.json for addresses."
echo ""
echo "NEXT STEPS:"
echo "  1. Run setup-whitelist.sh to propose whitelist targets"
echo "  2. Wait 2 days for whitelist timelock to expire"
echo "  3. Call activateWhitelist() for each proposed target"
echo "============================================"
