#!/bin/bash
# Deploy 627 MockERC20 tokens from assets.json and generate symbol-map.json
#
# Usage: ./scripts/deploy-mock-tokens.sh [RPC_URL] [PRIVATE_KEY]
# Defaults to local Anvil if not specified

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RPC_URL="${1:-http://localhost:8545}"
PRIVATE_KEY="${2:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
ASSETS_FILE="$PROJECT_ROOT/assets.json"
OUTPUT_FILE="$PROJECT_ROOT/data/symbol-map.json"
MOCK_VAULT_ADDR="${MOCK_VAULT_ADDR:-}"  # Optional: fund vault with tokens

echo "=== Mock Token Deployment ==="
echo "RPC: $RPC_URL"
echo "Assets: $ASSETS_FILE"
echo "Output: $OUTPUT_FILE"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "ERROR: jq is required. Install with: brew install jq"
    exit 1
fi

if ! command -v forge &> /dev/null; then
    echo "ERROR: forge is required. Install foundry."
    exit 1
fi

# Ensure data directory exists
mkdir -p "$PROJECT_ROOT/data"

# Build contracts first
echo "[1/3] Building contracts..."
cd "$PROJECT_ROOT/contracts"
forge build --quiet

# Count total tokens
TOTAL=$(jq length "$ASSETS_FILE")
echo "[2/3] Deploying $TOTAL mock tokens..."

# Start JSON output
echo "{" > "$OUTPUT_FILE"

DEPLOYED=0
FAILED=0

# Read assets and deploy each token
jq -c '.[]' "$ASSETS_FILE" | while read -r asset; do
    ID=$(echo "$asset" | jq -r '.id')
    BITGET=$(echo "$asset" | jq -r '.bitget')

    # Extract base symbol from Bitget pair (e.g., BTCUSDC -> BTC)
    # Remove common quote currencies
    SYMBOL=$(echo "$BITGET" | sed -E 's/(USDT|USDC|USD)$//')
    NAME="Mock $SYMBOL"

    # Deploy MockERC20
    RESULT=$(forge create src/mocks/MockERC20.sol:MockERC20 \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --constructor-args "$NAME" "$SYMBOL" 18 \
        --json 2>/dev/null || echo "FAILED")

    if [[ "$RESULT" == "FAILED" ]]; then
        echo "  [$ID] FAILED: $BITGET"
        FAILED=$((FAILED + 1))
        continue
    fi

    ADDR=$(echo "$RESULT" | jq -r '.deployedTo')

    if [[ -z "$ADDR" || "$ADDR" == "null" ]]; then
        echo "  [$ID] FAILED: $BITGET (no address)"
        FAILED=$((FAILED + 1))
        continue
    fi

    # Add to symbol map (append comma except first)
    if [[ $DEPLOYED -gt 0 ]]; then
        echo "," >> "$OUTPUT_FILE"
    fi
    echo -n "  \"$ADDR\": \"$BITGET\"" >> "$OUTPUT_FILE"

    DEPLOYED=$((DEPLOYED + 1))

    # Progress every 50 tokens
    if [[ $((DEPLOYED % 50)) -eq 0 ]]; then
        echo "  Deployed $DEPLOYED / $TOTAL tokens..."
    fi

    # Optional: Fund MockBitgetVault with tokens
    if [[ -n "$MOCK_VAULT_ADDR" ]]; then
        # Mint 1M tokens to vault
        cast send "$ADDR" "mint(address,uint256)" "$MOCK_VAULT_ADDR" "1000000000000000000000000" \
            --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" > /dev/null 2>&1 || true
    fi
done

# Close JSON
echo "" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"

echo ""
echo "[3/3] Deployment complete!"
echo "  Deployed: $DEPLOYED"
echo "  Failed: $FAILED"
echo "  Symbol map: $OUTPUT_FILE"
echo ""
echo "To use with issuer:"
echo "  ./target/debug/issuer --symbol-map-file $OUTPUT_FILE ..."
