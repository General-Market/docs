#!/bin/bash
set -euo pipefail

# Deploy all Index contracts to L3 testnet (Orbit chain ID 111222333)
# Story 6.1: Full L3 testnet deployment with UUPS proxies

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source environment if system.env exists
if [ -f "$PROJECT_ROOT/system.env" ]; then
    echo "Loading environment from system.env..."
    set -a
    source "$PROJECT_ROOT/system.env"
    set +a
fi

# Deployer key: prefer ORBIT_DEPLOYER_PRIVATE_KEY, fall back to PRIVATE_KEY
DEPLOY_KEY="${ORBIT_DEPLOYER_PRIVATE_KEY:-${PRIVATE_KEY:-}}"
if [ -z "$DEPLOY_KEY" ]; then
    echo "ERROR: Set ORBIT_DEPLOYER_PRIVATE_KEY or PRIVATE_KEY"
    exit 1
fi
export PRIVATE_KEY="$DEPLOY_KEY"
export ORBIT_DEPLOYER_PRIVATE_KEY="$DEPLOY_KEY"

# USDC address: prefer COLLATERAL_ADDRESS, fall back to ORBIT_WUSDC_ADDRESS
USDC="${COLLATERAL_ADDRESS:-${ORBIT_WUSDC_ADDRESS:-}}"
if [ -z "$USDC" ]; then
    echo "ERROR: Set COLLATERAL_ADDRESS or ORBIT_WUSDC_ADDRESS (wUSDC on L3)"
    exit 1
fi
export COLLATERAL_ADDRESS="$USDC"
export ORBIT_WUSDC_ADDRESS="$USDC"

# Admin address: only export if explicitly set (otherwise DeployL3.s.sol falls back to deployer)
if [ -n "${ADMIN_ADDRESS:-}" ]; then
    export ADMIN_ADDRESS
fi

# RPC URL
RPC_URL="${TESTNET_RPC:-http://159.195.79.153/}"

# Parse flags
DRY_RUN=false
VERIFY=false
VERBOSITY="-vvvv"

for arg in "$@"; do
    case $arg in
        --dry-run)  DRY_RUN=true ;;
        --verify)   VERIFY=true ;;
        --quiet)    VERBOSITY="-vv" ;;
        *)          echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

echo "============================================"
echo "INDEX L3 TESTNET DEPLOYMENT"
echo "============================================"
echo "RPC:     $RPC_URL"
echo "USDC:    $USDC"
echo "Mode:    $([ "$DRY_RUN" = true ] && echo 'DRY RUN (simulation)' || echo 'BROADCAST (live)')"
echo "============================================"
echo ""

cd "$PROJECT_ROOT/contracts"

# Build first
echo "Building contracts..."
forge build --force
echo ""

# Construct forge script command
CMD="forge script scripts/deploy/DeployL3.s.sol --rpc-url $RPC_URL $VERBOSITY"

if [ "$DRY_RUN" = false ]; then
    CMD="$CMD --broadcast"
fi

if [ "$VERIFY" = true ]; then
    CMD="$CMD --verify"
fi

echo "Running: $CMD"
echo ""
eval "$CMD"

echo ""
echo "============================================"
echo "DEPLOYMENT COMPLETE"
echo "============================================"

if [ -f "$PROJECT_ROOT/deployments/l3-testnet.json" ]; then
    echo ""
    echo "Deployed addresses:"
    cat "$PROJECT_ROOT/deployments/l3-testnet.json"
    echo ""
    echo "Saved to: deployments/l3-testnet.json"
fi

echo ""
echo "NEXT STEPS:"
echo "  1. Run verification: forge script scripts/deploy/VerifyL3Deployment.s.sol --rpc-url $RPC_URL -vvvv"
echo "  2. Wire oracle node to contracts (Story 6.2)"
echo "  3. Wire AP to contracts (Story 6.3)"
echo "============================================"
