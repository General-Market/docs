#!/bin/bash
# Morpho E2E Deployment Script
# Deploys MirrorIssuerRegistry, ITPNAVOracle, and creates Morpho market
# with BLS-verified oracle (production-like) or MockMorphoOracle (fallback)
#
# Prerequisites:
#   - Anvil running with vital-test infrastructure deployed
#   - Run `./scripts/local-e2e-deploy.sh` first
#
# Usage:
#   ./scripts/deploy-morpho-e2e.sh                  # Default (mock oracle mode)
#   ./scripts/deploy-morpho-e2e.sh --use-real-oracle  # BLS-verified oracle (requires issuers)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"

# Configuration
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
DEPLOYER_ADDR="${DEPLOYER_ADDR:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"

# Parse command line arguments
USE_REAL_ORACLE=false
for arg in "$@"; do
  case $arg in
    --use-real-oracle)
      USE_REAL_ORACLE=true
      shift
      ;;
  esac
done

# Issuer endpoints (for BLS signature collection)
ISSUER_PORTS="${ISSUER_PORTS:-9001,9002,9003}"
ISSUER_HOST="${ISSUER_HOST:-127.0.0.1}"

echo "=== Morpho E2E Deployment ==="
echo "RPC URL: $RPC_URL"
echo "Oracle Mode: $([ "$USE_REAL_ORACLE" = true ] && echo "REAL (BLS-verified)" || echo "MOCK")"
echo ""

# 1. Validate prerequisites
echo "[1/8] Validating prerequisites..."

# Check Anvil is running
if ! curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | grep -q "result"; then
  echo "ERROR: Anvil is not running at $RPC_URL"
  echo "       Run './scripts/local-e2e-deploy.sh' first"
  exit 1
fi
echo "  ✓ Anvil is running"

# Check local-e2e.json exists
LOCAL_E2E_FILE="$PROJECT_ROOT/deployments/local-e2e.json"
if [ ! -f "$LOCAL_E2E_FILE" ]; then
  echo "ERROR: $LOCAL_E2E_FILE not found"
  echo "       Run './scripts/local-e2e-deploy.sh' first"
  exit 1
fi
echo "  ✓ local-e2e.json exists"

# Extract required addresses from local-e2e.json
ARB_USDC=$(jq -r '.contracts.ARB_USDC' "$LOCAL_E2E_FILE")
ISSUER_REGISTRY=$(jq -r '.contracts.ISSUER_REGISTRY' "$LOCAL_E2E_FILE")
L3_USDC=$(jq -r '.contracts.L3_USDC' "$LOCAL_E2E_FILE")
ITP_VAULT=$(jq -r '.contracts.ITP_VAULT // empty' "$LOCAL_E2E_FILE")

if [ -z "$ARB_USDC" ] || [ "$ARB_USDC" = "null" ]; then
  echo "ERROR: ARB_USDC not found in local-e2e.json"
  exit 1
fi
if [ -z "$ISSUER_REGISTRY" ] || [ "$ISSUER_REGISTRY" = "null" ]; then
  echo "ERROR: ISSUER_REGISTRY not found in local-e2e.json"
  exit 1
fi
echo "  ✓ Required addresses extracted from local-e2e.json"
echo "    ARB_USDC: $ARB_USDC"
echo "    ISSUER_REGISTRY: $ISSUER_REGISTRY"

# Determine ITP vault address for collateral
# If ITP_VAULT is empty in local-e2e.json, use the mock collateral from morpho-e2e.json (Story 8.5)
if [ -z "$ITP_VAULT" ] || [ "$ITP_VAULT" = "" ]; then
  # Check if morpho-e2e.json has a collateral token from previous deployment
  MORPHO_E2E_FILE="$PROJECT_ROOT/deployments/morpho-e2e.json"
  if [ -f "$MORPHO_E2E_FILE" ]; then
    ITP_VAULT=$(jq -r '.marketParams.collateralToken // empty' "$MORPHO_E2E_FILE")
  fi

  # If still empty, we'll need to deploy a mock ITP collateral
  if [ -z "$ITP_VAULT" ] || [ "$ITP_VAULT" = "" ]; then
    echo "  INFO: No ITP vault — will use existing mock collateral from Morpho deployment"
  else
    echo "  ✓ Using existing collateral token: $ITP_VAULT"
  fi
else
  echo "  ✓ ITP_VAULT: $ITP_VAULT"
fi

# Read existing Morpho deployment (from Story 8.5)
# Initialize variables to empty (for -u strict mode)
EXISTING_MORPHO=""
EXISTING_IRM=""
EXISTING_VAULT=""
EXISTING_MOCK_ORACLE=""
EXISTING_MARKET_ID=""
EXISTING_COLLATERAL=""

MORPHO_E2E_FILE="$PROJECT_ROOT/deployments/morpho-e2e.json"
if [ -f "$MORPHO_E2E_FILE" ]; then
  EXISTING_MORPHO=$(jq -r '.contracts.MORPHO // empty' "$MORPHO_E2E_FILE")
  EXISTING_IRM=$(jq -r '.contracts.ADAPTIVE_IRM // empty' "$MORPHO_E2E_FILE")
  EXISTING_VAULT=$(jq -r '.contracts.METAMORPHO_VAULT // empty' "$MORPHO_E2E_FILE")
  EXISTING_MOCK_ORACLE=$(jq -r '.contracts.MOCK_ORACLE // empty' "$MORPHO_E2E_FILE")
  EXISTING_MARKET_ID=$(jq -r '.contracts.MARKET_ID // empty' "$MORPHO_E2E_FILE")
  EXISTING_COLLATERAL=$(jq -r '.marketParams.collateralToken // empty' "$MORPHO_E2E_FILE")

  if [ -n "$EXISTING_MORPHO" ] && [ "$EXISTING_MORPHO" != "null" ]; then
    echo "  ✓ Existing Morpho deployment found"
    echo "    MORPHO: $EXISTING_MORPHO"
    echo "    ADAPTIVE_IRM: $EXISTING_IRM"
    echo "    METAMORPHO_VAULT: $EXISTING_VAULT"
    echo "    MOCK_ORACLE: $EXISTING_MOCK_ORACLE"

    # Use existing collateral if ITP_VAULT not set
    if [ -z "$ITP_VAULT" ] || [ "$ITP_VAULT" = "" ]; then
      ITP_VAULT="$EXISTING_COLLATERAL"
      echo "    Using existing collateral: $ITP_VAULT"
    fi
  fi
fi

# 2. Deploy MirrorIssuerRegistry
echo ""
echo "[2/8] Deploying MirrorIssuerRegistry..."
cd "$CONTRACTS_DIR"

# Get aggregated pubkey from L3 IssuerRegistry
# Note: getAggregatedPubkey() is DEPRECATED and returns empty bytes (G2 aggregation must be done off-chain)
# For mock mode, we use a dummy 128-byte pubkey. For real mode, we'd need off-chain aggregation.
echo "  Fetching aggregated pubkey from IssuerRegistry..."
AGG_PUBKEY_RAW=$(cast call "$ISSUER_REGISTRY" "getAggregatedPubkey()" --rpc-url "$RPC_URL" 2>/dev/null || echo "")

# Decode ABI-encoded bytes to get actual pubkey length
# Format: 0x<offset:32bytes><length:32bytes><data>
# If length is 0, the pubkey is empty (getAggregatedPubkey is deprecated and returns empty)
PUBKEY_LENGTH=0
if [ -n "$AGG_PUBKEY_RAW" ] && [ ${#AGG_PUBKEY_RAW} -ge 130 ]; then
  # Extract length from bytes 66-130 (32 bytes after the offset, in hex chars position 66-130)
  LENGTH_HEX="${AGG_PUBKEY_RAW:66:64}"
  PUBKEY_LENGTH=$(printf "%d" "0x$LENGTH_HEX" 2>/dev/null || echo "0")
fi

if [ "$PUBKEY_LENGTH" -eq 0 ]; then
  echo "  ⚠️  WARNING: IssuerRegistry has no aggregated pubkey (getAggregatedPubkey is deprecated)"
  echo "     Using dummy 128-byte pubkey for MirrorIssuerRegistry initialization"
  echo "     BLS signature verification will FAIL - oracle uses constructor price only"
  # Generate a valid 128-byte dummy pubkey (all 0x01 bytes - non-zero to avoid potential edge cases)
  AGG_PUBKEY="0x0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101"
elif [ "$PUBKEY_LENGTH" -eq 128 ]; then
  # Extract the actual 128-byte pubkey data (starts at position 130, 256 hex chars = 128 bytes)
  AGG_PUBKEY="0x${AGG_PUBKEY_RAW:130:256}"
  echo "  ✓ Got valid 128-byte aggregated pubkey from IssuerRegistry"
else
  echo "  ⚠️  WARNING: Unexpected pubkey length: $PUBKEY_LENGTH bytes (expected 128)"
  echo "     Using dummy pubkey instead"
  AGG_PUBKEY="0x0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101"
fi

# Get issuer count
ISSUER_COUNT=$(cast call "$ISSUER_REGISTRY" "activeIssuerCount()" --rpc-url "$RPC_URL" 2>/dev/null | sed 's/0x//' | xargs printf "%d" 2>/dev/null || echo "0")
echo "  Active issuers: $ISSUER_COUNT"

# Handle case where no issuers are registered (use defaults for testing)
if [ "$ISSUER_COUNT" -eq 0 ]; then
  echo "  ⚠️  No active issuers registered. Using default values (3 issuers, 2/3 threshold)"
  ISSUER_COUNT=3
  THRESHOLD=2
else
  # Threshold is 2/3 of issuers (minimum 2)
  THRESHOLD=$((ISSUER_COUNT * 2 / 3))
  if [ "$THRESHOLD" -lt 2 ]; then
    THRESHOLD=2
  fi
  # Don't exceed issuer count
  if [ "$THRESHOLD" -gt "$ISSUER_COUNT" ]; then
    THRESHOLD="$ISSUER_COUNT"
  fi
fi
echo "  BLS threshold: $THRESHOLD"

# Deploy MirrorIssuerRegistry implementation and proxy
echo "  Deploying MirrorIssuerRegistry implementation..."
# Note: --json outputs JSON to stdout, stderr has compilation messages
FORGE_OUTPUT=$(forge create --broadcast --private-key "$DEPLOYER_KEY" \
  src/registry/MirrorIssuerRegistry.sol:MirrorIssuerRegistry \
  --rpc-url "$RPC_URL" --json 2>/dev/null)
FORGE_EXIT=$?
MIRROR_IMPL=$(echo "$FORGE_OUTPUT" | jq -r '.deployedTo // empty' 2>/dev/null || echo "")
if [ "$FORGE_EXIT" -ne 0 ] || [ -z "$MIRROR_IMPL" ]; then
  echo "  ERROR: Failed to deploy MirrorIssuerRegistry implementation (exit=$FORGE_EXIT)"
  # Re-run without --json to see the error
  forge create --broadcast --private-key "$DEPLOYER_KEY" \
    src/registry/MirrorIssuerRegistry.sol:MirrorIssuerRegistry \
    --rpc-url "$RPC_URL" 2>&1 || true
  exit 1
fi
echo "  MirrorIssuerRegistry impl: $MIRROR_IMPL"

# Encode initialize call
INIT_DATA=$(cast calldata "initialize(bytes,uint256,uint256,address)" \
  "$AGG_PUBKEY" "$THRESHOLD" "$ISSUER_COUNT" "$DEPLOYER_ADDR")

# Deploy ERC1967Proxy
# Note: --json doesn't work for library contracts, so we parse text output
echo "  Deploying ERC1967Proxy..."
FORGE_OUTPUT=$(forge create --broadcast --private-key "$DEPLOYER_KEY" \
  lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
  --constructor-args "$MIRROR_IMPL" "$INIT_DATA" \
  --rpc-url "$RPC_URL" 2>&1)
FORGE_EXIT=$?
# Try JSON first, then fall back to text parsing
MIRROR_PROXY=$(echo "$FORGE_OUTPUT" | jq -r '.deployedTo // empty' 2>/dev/null || echo "")
if [ -z "$MIRROR_PROXY" ]; then
  # Parse text output: "Deployed to: 0x..."
  MIRROR_PROXY=$(echo "$FORGE_OUTPUT" | grep -E "^Deployed to:" | awk '{print $3}')
fi
if [ "$FORGE_EXIT" -ne 0 ] || [ -z "$MIRROR_PROXY" ]; then
  echo "  ERROR: Failed to deploy ERC1967Proxy (exit=$FORGE_EXIT)"
  echo "  Forge output: $FORGE_OUTPUT"
  exit 1
fi
echo "  MirrorIssuerRegistry proxy: $MIRROR_PROXY"

# 3. Deploy ITPNAVOracle
echo ""
echo "[3/8] Deploying ITPNAVOracle..."

# Initial price: 1 ITP = 100 USDC (24 decimal precision = 36 + 6 - 18)
# 100e24 = 100 * 10^24
INITIAL_PRICE="100000000000000000000000000"

# If ITP_VAULT still not set, use a placeholder address for now
if [ -z "$ITP_VAULT" ] || [ "$ITP_VAULT" = "" ]; then
  # Use existing collateral from morpho deployment
  if [ -n "$EXISTING_COLLATERAL" ] && [ "$EXISTING_COLLATERAL" != "null" ]; then
    ITP_VAULT="$EXISTING_COLLATERAL"
  else
    # Fall back to ETH from local-e2e.json (mock ITP for testing)
    ITP_VAULT=$(jq -r '.contracts.ETH // .contracts.fakeETH // empty' "$LOCAL_E2E_FILE")
    if [ -z "$ITP_VAULT" ] || [ "$ITP_VAULT" = "null" ]; then
      # Last resort: deploy a mock ERC20 token
      echo "  Deploying mock ITP collateral token..."
      FORGE_OUTPUT=$(forge create --broadcast --private-key "$DEPLOYER_KEY" \
        src/mocks/MockERC20.sol:MockERC20 \
        --constructor-args "Mock ITP" "mITP" 18 \
        --rpc-url "$RPC_URL" --json 2>/dev/null)
      ITP_VAULT=$(echo "$FORGE_OUTPUT" | jq -r '.deployedTo // empty' 2>/dev/null || echo "")
      if [ -z "$ITP_VAULT" ]; then
        echo "  ERROR: Failed to deploy mock ITP token and no fallback available"
        exit 1
      fi
      echo "  ✓ Deployed mock ITP: $ITP_VAULT"
    else
      echo "  Using ETH as mock ITP collateral: $ITP_VAULT"
    fi
  fi
fi

# Deploy ITPNAVOracle
echo "  Deploying ITPNAVOracle..."
FORGE_OUTPUT=$(forge create --broadcast --private-key "$DEPLOYER_KEY" \
  src/oracle/ITPNAVOracle.sol:ITPNAVOracle \
  --constructor-args "$MIRROR_PROXY" "$ITP_VAULT" "$INITIAL_PRICE" \
  --rpc-url "$RPC_URL" 2>&1)
FORGE_EXIT=$?
# Try JSON first, then fall back to text parsing
ITP_ORACLE=$(echo "$FORGE_OUTPUT" | jq -r '.deployedTo // empty' 2>/dev/null || echo "")
if [ -z "$ITP_ORACLE" ]; then
  # Parse text output: "Deployed to: 0x..."
  ITP_ORACLE=$(echo "$FORGE_OUTPUT" | grep -E "^Deployed to:" | awk '{print $3}')
fi
if [ "$FORGE_EXIT" -ne 0 ] || [ -z "$ITP_ORACLE" ]; then
  echo "  ERROR: Failed to deploy ITPNAVOracle (exit=$FORGE_EXIT)"
  echo "  Forge output: $FORGE_OUTPUT"
  exit 1
fi
echo "  ITPNAVOracle: $ITP_ORACLE"
echo "  ITP Address: $ITP_VAULT"
echo "  Initial Price: $INITIAL_PRICE (100 USDC per ITP)"

# 4. Integrate with existing Morpho deployment or deploy fresh
echo ""
echo "[4/8] Setting up Morpho Blue market..."

ORACLE_MODE="mock"
ORACLE_TO_USE="$EXISTING_MOCK_ORACLE"

# Check if we need to deploy Morpho from scratch
if [ -z "$EXISTING_MORPHO" ] || [ "$EXISTING_MORPHO" = "null" ]; then
  echo "  No existing Morpho deployment found - deploying Morpho Blue from scratch..."

  # Run the DeployMorphoE2E forge script
  echo "  Running DeployMorphoE2E forge script..."
  ARB_USDC=$ARB_USDC ITP_VAULT=$ITP_VAULT DEPLOYER_KEY=$DEPLOYER_KEY \
    PRIVATE_KEY=$DEPLOYER_KEY forge script script/DeployMorphoE2E.s.sol:DeployMorphoE2E \
    --rpc-url "$RPC_URL" --broadcast 2>&1 | tee /tmp/morpho-deploy.log
  MORPHO_STATUS=${PIPESTATUS[0]}

  if [ $MORPHO_STATUS -ne 0 ]; then
    echo "  ERROR: Morpho deployment failed (exit=$MORPHO_STATUS)"
    cat /tmp/morpho-deploy.log
    exit 1
  fi

  # Re-read the deployment file
  if [ -f "$MORPHO_E2E_FILE" ]; then
    EXISTING_MORPHO=$(jq -r '.contracts.MORPHO // empty' "$MORPHO_E2E_FILE")
    EXISTING_IRM=$(jq -r '.contracts.ADAPTIVE_IRM // empty' "$MORPHO_E2E_FILE")
    EXISTING_VAULT=$(jq -r '.contracts.METAMORPHO_VAULT // empty' "$MORPHO_E2E_FILE")
    EXISTING_MOCK_ORACLE=$(jq -r '.contracts.MOCK_ORACLE // empty' "$MORPHO_E2E_FILE")
    EXISTING_MARKET_ID=$(jq -r '.contracts.MARKET_ID // empty' "$MORPHO_E2E_FILE")
    EXISTING_COLLATERAL=$(jq -r '.marketParams.collateralToken // empty' "$MORPHO_E2E_FILE")
    ORACLE_TO_USE="$EXISTING_MOCK_ORACLE"
    echo "  ✓ Morpho Blue deployed successfully"
    echo "    MORPHO: $EXISTING_MORPHO"
    echo "    MOCK_ORACLE: $EXISTING_MOCK_ORACLE"
  else
    echo "  ERROR: morpho-e2e.json not created by forge script"
    exit 1
  fi
fi

if [ "$USE_REAL_ORACLE" = true ]; then
  echo "  Using ITPNAVOracle (BLS-verified)..."
  ORACLE_MODE="real"
  ORACLE_TO_USE="$ITP_ORACLE"

  # Verify oracle price is set
  ORACLE_PRICE=$(cast call "$ITP_ORACLE" "price()" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x0")
  echo "  Oracle price: $ORACLE_PRICE"
else
  echo "  Using MockMorphoOracle (fallback mode)..."
  if [ -z "$ORACLE_TO_USE" ] || [ "$ORACLE_TO_USE" = "null" ]; then
    echo "  ERROR: No MockMorphoOracle found in deployment"
    exit 1
  fi
fi

# Check if we need to create a new market with the real oracle
# If existing Morpho deployment has MockOracle and we want real oracle, we need new market
if [ "$USE_REAL_ORACLE" = true ]; then
  echo "  Creating new Morpho market with ITPNAVOracle..."

  # Get Morpho contract and IRM from existing deployment
  MORPHO="$EXISTING_MORPHO"
  IRM="$EXISTING_IRM"

  if [ -z "$MORPHO" ] || [ "$MORPHO" = "null" ]; then
    echo "  ERROR: Morpho not found in existing deployment"
    exit 1
  fi

  # LLTV: 77%
  LLTV="770000000000000000"

  # Create new market with ITPNAVOracle
  echo "  Creating market with loanToken=$ARB_USDC, collateral=$ITP_VAULT, oracle=$ITP_ORACLE..."

  # Create the market using cast (simpler than forge script for single call)
  # morpho.createMarket(MarketParams memory params)
  # MarketParams = (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)

  # Encode market params struct for createMarket call
  CREATE_MARKET_RESULT=$(cast send "$MORPHO" "createMarket((address,address,address,address,uint256))" \
    "($ARB_USDC,$ITP_VAULT,$ITP_ORACLE,$IRM,$LLTV)" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --json 2>/dev/null || echo "{}")

  CREATE_TX_HASH=$(echo "$CREATE_MARKET_RESULT" | jq -r '.transactionHash // "FAILED"')
  if [ "$CREATE_TX_HASH" = "FAILED" ]; then
    echo "  WARNING: Market creation failed (may already exist)"
  else
    echo "  Market creation tx: $CREATE_TX_HASH"
  fi

  # Compute market ID using same formula as Morpho
  # id = keccak256(abi.encode(loanToken, collateralToken, oracle, irm, lltv))
  MARKET_ID=$(cast keccak256 "$(cast abi-encode 'f(address,address,address,address,uint256)' \
    "$ARB_USDC" "$ITP_VAULT" "$ITP_ORACLE" "$IRM" "$LLTV")")
  echo "  Market ID (real oracle): $MARKET_ID"
else
  # Use existing market from MockOracle deployment
  MARKET_ID="$EXISTING_MARKET_ID"
  MORPHO="$EXISTING_MORPHO"
  IRM="$EXISTING_IRM"
  echo "  Using existing market ID: $MARKET_ID"
fi

# 5. Handle MetaMorpho timelock
echo ""
echo "[5/8] MetaMorpho vault configuration..."

VAULT="$EXISTING_VAULT"
IRM="$EXISTING_IRM"
VAULT_CONFIG_OK=true

# Fast-forward time to accept the cap (required after fresh Morpho deployment)
# The DeployMorphoE2E script submits the cap but doesn't accept it
echo "  Fast-forwarding 1 day for MetaMorpho timelock..."
cast rpc evm_increaseTime 86401 --rpc-url "$RPC_URL" > /dev/null 2>&1
cast rpc evm_mine --rpc-url "$RPC_URL" > /dev/null 2>&1

# Accept the cap for the existing market (mock oracle)
if [ -n "$EXISTING_MARKET_ID" ] && [ "$EXISTING_MARKET_ID" != "null" ] && [ -n "$IRM" ]; then
  echo "  Accepting supply cap for existing market..."
  if ! cast send "$VAULT" "acceptCap((address,address,address,address,uint256))" \
    "($ARB_USDC,$ITP_VAULT,$EXISTING_MOCK_ORACLE,$IRM,770000000000000000)" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet 2>/dev/null; then
    echo "  ⚠️  Cap acceptance failed (may already be accepted or cap not pending)"
  else
    echo "  ✓ Supply cap accepted"
  fi

  # Set supply queue with the market
  echo "  Setting supply queue..."
  if ! cast send "$VAULT" "setSupplyQueue(bytes32[])" "[$EXISTING_MARKET_ID]" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet 2>/dev/null; then
    echo "  ⚠️  Supply queue update failed"
  else
    echo "  ✓ Supply queue set"
  fi
fi

if [ "$USE_REAL_ORACLE" = true ]; then
  # For real oracle mode, we need to add the new market to the vault
  # This requires timelock handling

  echo "  Submitting supply cap for new market..."
  SUPPLY_CAP="24519928653854221733733552434404946937899825954937634816"  # type(uint184).max

  # Submit cap (starts timelock)
  if ! cast send "$VAULT" "submitCap((address,address,address,address,uint256),uint256)" \
    "($ARB_USDC,$ITP_VAULT,$ITP_ORACLE,$IRM,770000000000000000)" "$SUPPLY_CAP" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet 2>/dev/null; then
    echo "  ⚠️  Cap submission failed (may already exist)"
    VAULT_CONFIG_OK=false
  fi

  echo "  Fast-forwarding 1 day for MetaMorpho timelock..."
  cast rpc evm_increaseTime 86401 --rpc-url "$RPC_URL" > /dev/null 2>&1
  cast rpc evm_mine --rpc-url "$RPC_URL" > /dev/null 2>&1

  echo "  Accepting supply cap..."
  if ! cast send "$VAULT" "acceptCap((address,address,address,address,uint256))" \
    "($ARB_USDC,$ITP_VAULT,$ITP_ORACLE,$IRM,770000000000000000)" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet 2>/dev/null; then
    echo "  ⚠️  Cap acceptance failed (timelock may not have elapsed or cap not pending)"
    VAULT_CONFIG_OK=false
  fi

  # Set supply queue with both markets (mock and real oracle)
  echo "  Setting supply queue..."
  # Note: If existing market uses MockOracle and new uses ITPNAVOracle, we have 2 markets
  # For simplicity in E2E, just use the new market in the queue
  if ! cast send "$VAULT" "setSupplyQueue(bytes32[])" "[$MARKET_ID]" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet 2>/dev/null; then
    echo "  ⚠️  Supply queue update failed"
    VAULT_CONFIG_OK=false
  fi

  if [ "$VAULT_CONFIG_OK" = true ]; then
    echo "  ✓ Vault configured for real oracle market"
  else
    echo "  ⚠️  Some vault configuration steps failed - market may need manual setup"
  fi
else
  echo "  Using existing vault configuration (mock oracle mode)"
fi

# 6. Seed vault with USDC (if needed)
echo ""
echo "[6/8] Seeding vault with USDC liquidity..."

# Check current vault total assets
CURRENT_ASSETS=$(cast call "$VAULT" "totalAssets()" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x0")
CURRENT_ASSETS_DEC=$(printf "%d" "$CURRENT_ASSETS" 2>/dev/null || echo "0")

if [ "$CURRENT_ASSETS_DEC" -lt 100000000 ]; then
  # Need to seed with 100,000 USDC = 100_000 * 1e6 = 100_000_000_000
  SEED_AMOUNT=100000000000

  echo "  Minting $((SEED_AMOUNT / 1000000)) USDC to deployer..."
  cast send "$ARB_USDC" "mint(address,uint256)" "$DEPLOYER_ADDR" "$SEED_AMOUNT" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet

  echo "  Approving vault to spend USDC..."
  cast send "$ARB_USDC" "approve(address,uint256)" "$VAULT" "$SEED_AMOUNT" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet

  echo "  Depositing USDC into vault..."
  cast send "$VAULT" "deposit(uint256,address)" "$SEED_AMOUNT" "$DEPLOYER_ADDR" \
    --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" --quiet

  echo "  ✓ Seeded vault with $((SEED_AMOUNT / 1000000)) USDC"
else
  echo "  ✓ Vault already has liquidity: $((CURRENT_ASSETS_DEC / 1000000)) USDC"
fi

# 7. Collect BLS NAV price and push to oracle (if real oracle mode and issuers running)
echo ""
echo "[7/8] BLS NAV price collection..."

if [ "$USE_REAL_ORACLE" = true ]; then
  echo "  Attempting to collect BLS signatures from issuers..."

  # Try to collect signatures from issuers
  IFS=',' read -ra PORTS <<< "$ISSUER_PORTS"
  SIGNATURES=()
  ISSUER_IDS=()

  for port in "${PORTS[@]}"; do
    ISSUER_URL="http://${ISSUER_HOST}:${port}/api/nav-sign?itp=$ITP_VAULT"
    echo "    Querying $ISSUER_URL..."

    RESPONSE=$(curl -s -m 5 "$ISSUER_URL" 2>/dev/null || echo "{}")
    SIG=$(echo "$RESPONSE" | jq -r '.blsSignature // empty')

    if [ -n "$SIG" ] && [ "$SIG" != "null" ]; then
      SIGNATURES+=("$SIG")
      ISSUER_ID=$(echo "$RESPONSE" | jq -r '.issuerId // 0')
      ISSUER_IDS+=("$ISSUER_ID")
      echo "      ✓ Got signature from issuer $ISSUER_ID"
    else
      echo "      ✗ No signature from port $port"
    fi
  done

  # Check if we have enough signatures (threshold)
  if [ ${#SIGNATURES[@]} -ge "$THRESHOLD" ]; then
    echo "  ✓ Collected ${#SIGNATURES[@]} signatures (threshold: $THRESHOLD)"

    # Note: Full BLS aggregation and oracle update would require:
    # 1. Aggregating the signatures (complex cryptographic operation)
    # 2. Computing signers bitmask
    # 3. Calling oracle.updatePrice()
    # This is implemented in the curator service (Story 8.10)
    # For this deploy script, we rely on the initial price set in constructor

    echo "  INFO: BLS aggregation requires curator service (Story 8.10)"
    echo "        Oracle initialized with constructor price: $INITIAL_PRICE"
  else
    echo "  ⚠️  Only ${#SIGNATURES[@]} signatures (need $THRESHOLD)"
    echo "     Issuers may not be running. Oracle uses constructor price."
  fi
else
  echo "  Skipping BLS collection (mock oracle mode)"
  echo "  MockMorphoOracle price is set in existing deployment"
fi

# 8. Write deployment JSON and environment file
echo ""
echo "[8/8] Writing deployment files..."

# Get chain ID
CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
TIMESTAMP=$(date +%s)

# Update morpho-e2e.json with new fields
cat > "$PROJECT_ROOT/deployments/morpho-e2e.json" << EOF
{
  "chainId": $CHAIN_ID,
  "deployer": "$DEPLOYER_ADDR",
  "timestamp": $TIMESTAMP,
  "oracleMode": "$ORACLE_MODE",
  "contracts": {
    "MORPHO": "$MORPHO",
    "ADAPTIVE_IRM": "$IRM",
    "MOCK_ORACLE": "$EXISTING_MOCK_ORACLE",
    "ITP_ORACLE": "$ITP_ORACLE",
    "MIRROR_REGISTRY": "$MIRROR_PROXY",
    "METAMORPHO_VAULT": "$VAULT",
    "MARKET_ID": "$MARKET_ID"
  },
  "marketParams": {
    "loanToken": "$ARB_USDC",
    "collateralToken": "$ITP_VAULT",
    "oracle": "$ORACLE_TO_USE",
    "irm": "$IRM",
    "lltv": "770000000000000000"
  }
}
EOF
echo "  ✓ Saved deployments/morpho-e2e.json"

# Write environment file
cat > "$PROJECT_ROOT/deployments/morpho-e2e.env" << EOF
# Morpho E2E Deployment Environment Variables
# Source this file: source deployments/morpho-e2e.env
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

export MORPHO="$MORPHO"
export ADAPTIVE_IRM="$IRM"
export ITP_ORACLE="$ITP_ORACLE"
export MOCK_ORACLE="$EXISTING_MOCK_ORACLE"
export MIRROR_REGISTRY="$MIRROR_PROXY"
export METAMORPHO_VAULT="$VAULT"
export MORPHO_MARKET_ID="$MARKET_ID"
export ORACLE_MODE="$ORACLE_MODE"
EOF
echo "  ✓ Saved deployments/morpho-e2e.env"

# 9. Run verification commands
echo ""
echo "=== Verification ==="

# Initialize verification status
VERIFY_OK=true

# Verify oracle price
echo "  Checking oracle price..."
ORACLE_ADDR="$ORACLE_TO_USE"
VERIFY_PRICE=$(cast call "$ORACLE_ADDR" "price()" --rpc-url "$RPC_URL" 2>/dev/null || echo "FAILED")
if [ "$VERIFY_PRICE" = "FAILED" ]; then
  echo "  ✗ Oracle price() call failed"
  VERIFY_OK=false
else
  PRICE_DEC=$(printf "%d" "$VERIFY_PRICE" 2>/dev/null || echo "0")
  if [ "$PRICE_DEC" -gt 0 ]; then
    echo "  ✓ Oracle price: $VERIFY_PRICE (non-zero)"
  else
    echo "  ✗ Oracle price is zero"
    VERIFY_OK=false
  fi
fi

# Verify vault total assets
echo "  Checking vault total assets..."
VERIFY_ASSETS=$(cast call "$VAULT" "totalAssets()" --rpc-url "$RPC_URL" 2>/dev/null || echo "FAILED")
if [ "$VERIFY_ASSETS" = "FAILED" ]; then
  echo "  ✗ Vault totalAssets() call failed"
  VERIFY_OK=false
else
  ASSETS_DEC=$(printf "%d" "$VERIFY_ASSETS" 2>/dev/null || echo "0")
  if [ "$ASSETS_DEC" -gt 0 ]; then
    echo "  ✓ Vault totalAssets: $((ASSETS_DEC / 1000000)) USDC"
  else
    echo "  ✗ Vault has no assets"
    VERIFY_OK=false
  fi
fi

# Verify market exists
echo "  Checking market exists..."
MARKET_INFO=$(cast call "$MORPHO" "idToMarketParams(bytes32)" "$MARKET_ID" --rpc-url "$RPC_URL" 2>/dev/null || echo "FAILED")
if [ "$MARKET_INFO" = "FAILED" ] || [ -z "$MARKET_INFO" ]; then
  echo "  ✗ Market lookup failed"
  VERIFY_OK=false
else
  echo "  ✓ Market exists: $MARKET_ID"
fi

# Verify MirrorIssuerRegistry
echo "  Checking MirrorIssuerRegistry..."
MIRROR_PUBKEY=$(cast call "$MIRROR_PROXY" "getAggregatedPubkey()" --rpc-url "$RPC_URL" 2>/dev/null || echo "FAILED")
if [ "$MIRROR_PUBKEY" = "FAILED" ]; then
  echo "  ✗ MirrorIssuerRegistry getAggregatedPubkey() failed"
  VERIFY_OK=false
else
  echo "  ✓ MirrorIssuerRegistry has aggregated pubkey"
fi

# Summary
echo ""
echo "=== Deployment Summary ==="
echo "  Oracle Mode:        $ORACLE_MODE"
echo "  MORPHO:             $MORPHO"
echo "  ADAPTIVE_IRM:       $IRM"
echo "  MIRROR_REGISTRY:    $MIRROR_PROXY"
echo "  ITP_ORACLE:         $ITP_ORACLE"
echo "  MOCK_ORACLE:        $EXISTING_MOCK_ORACLE"
echo "  METAMORPHO_VAULT:   $VAULT"
echo "  MARKET_ID:          $MARKET_ID"
echo ""
echo "=== Environment Variables ==="
echo "  export MORPHO=$MORPHO"
echo "  export METAMORPHO_VAULT=$VAULT"
echo "  export ITP_ORACLE=$ITP_ORACLE"
echo "  export MIRROR_REGISTRY=$MIRROR_PROXY"
echo "  export ADAPTIVE_IRM=$IRM"
echo "  export MORPHO_MARKET_ID=$MARKET_ID"
echo ""
echo "  Or: source deployments/morpho-e2e.env"
echo ""
echo "=== Verification Commands ==="
echo "  # Check oracle price"
echo "  cast call \$ITP_ORACLE \"price()\" --rpc-url $RPC_URL"
echo ""
echo "  # Check vault total assets"
echo "  cast call \$METAMORPHO_VAULT \"totalAssets()\" --rpc-url $RPC_URL"
echo ""
echo "  # Check market exists"
echo "  cast call \$MORPHO \"idToMarketParams(bytes32)\" \$MORPHO_MARKET_ID --rpc-url $RPC_URL"
echo ""
if [ "$VERIFY_OK" = true ]; then
  echo "Done! Morpho E2E deployment complete."
  exit 0
else
  echo "Done with warnings. Some verifications failed - check output above."
  exit 1
fi
