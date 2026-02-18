#!/usr/bin/env bash
# manage-assets.sh — Request asset additions/removals via requestRebalance event
#
# Usage:
#   ./scripts/manage-assets.sh --delist ALPHA,BETA --note "Delisted from Bitget"
#   ./scripts/manage-assets.sh --list HYPE:0xaddr:HYPEUSDT:bitget --note "New listing"
#   ./scripts/manage-assets.sh --reweight 0.5,0.3,0.2 --note "Weight adjustment"
#
# Environment variables:
#   ITP_ID          - ITP identifier (bytes32, required)
#   INDEX_ADDRESS   - Index contract address (or read from deployment file)
#   RPC_URL         - RPC endpoint (default: https://index.rpc.zeeve.net)
#   PRIVATE_KEY     - Sender private key (required)
#   DEPLOYMENT_FILE - Deployment JSON file (default: deployments/e2e-full-system.json)
#
# This script reads the current ITP state, computes removeIndices and
# redistributed weights, then calls requestRebalance() which only emits
# an event. Issuers pick up the event and execute the actual rebalance.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Defaults
RPC_URL="${RPC_URL:-https://index.rpc.zeeve.net}"
DEPLOYMENT_FILE="${DEPLOYMENT_FILE:-$ROOT_DIR/deployments/e2e-full-system.json}"

# Parse arguments
DELIST=""
LIST=""
REWEIGHT=""
NOTE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --delist)
            DELIST="$2"
            shift 2
            ;;
        --list)
            LIST="$2"
            shift 2
            ;;
        --reweight)
            REWEIGHT="$2"
            shift 2
            ;;
        --note)
            NOTE="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 [--delist SYMBOLS] [--list SYMBOL:ADDR:PAIR:SOURCE] [--reweight WEIGHTS] --note NOTE"
            exit 1
            ;;
    esac
done

# Validate required env vars
if [ -z "${ITP_ID:-}" ]; then
    echo "ERROR: ITP_ID environment variable is required"
    exit 1
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
    echo "ERROR: PRIVATE_KEY environment variable is required"
    exit 1
fi

if [ -z "$NOTE" ]; then
    echo "ERROR: --note is required"
    exit 1
fi

# Resolve INDEX_ADDRESS
if [ -z "${INDEX_ADDRESS:-}" ]; then
    if [ -f "$DEPLOYMENT_FILE" ]; then
        INDEX_ADDRESS=$(jq -r '.contracts.Index // .contracts.IndexProxy // empty' "$DEPLOYMENT_FILE")
        if [ -z "$INDEX_ADDRESS" ]; then
            echo "ERROR: Could not find Index address in $DEPLOYMENT_FILE"
            exit 1
        fi
        echo "Index address from deployment: $INDEX_ADDRESS"
    else
        echo "ERROR: INDEX_ADDRESS not set and $DEPLOYMENT_FILE not found"
        exit 1
    fi
fi

echo "=== Manage Assets ==="
echo "ITP ID:  $ITP_ID"
echo "Index:   $INDEX_ADDRESS"
echo "RPC:     $RPC_URL"
echo ""

# Read current ITP state
echo "Reading ITP state..."
STATE=$(cast call "$INDEX_ADDRESS" "getITPState(bytes32)(address,uint256,uint256,address[],uint256[],uint256[])" "$ITP_ID" --rpc-url "$RPC_URL")

# Parse state (cast returns multiline)
ASSETS_LINE=$(echo "$STATE" | sed -n '4p') # address[] assets
WEIGHTS_LINE=$(echo "$STATE" | sed -n '5p') # uint256[] weights

echo "Current assets:  $ASSETS_LINE"
echo "Current weights: $WEIGHTS_LINE"

# Use python to compute the rebalance parameters
python3 -c "
import json, sys

itp_id = '$ITP_ID'
delist = '$DELIST'
list_arg = '$LIST'
reweight = '$REWEIGHT'
note = '$NOTE'

# Parse current state from cast output
assets_raw = '''$ASSETS_LINE'''.strip().strip('[]')
weights_raw = '''$WEIGHTS_LINE'''.strip().strip('[]')

assets = [a.strip() for a in assets_raw.split(',') if a.strip()]
weights = [int(w.strip()) for w in weights_raw.split(',') if w.strip()]

if len(assets) != len(weights):
    print(f'ERROR: assets ({len(assets)}) and weights ({len(weights)}) length mismatch', file=sys.stderr)
    sys.exit(1)

remove_indices = []
add_assets = []
new_weights = list(weights)

if delist:
    # Load symbol map to find addresses
    symbol_map_path = 'data/symbol-map.json'
    with open(symbol_map_path) as f:
        symbol_map = json.load(f)

    # Build reverse map: pair -> address
    pair_to_addr = {}
    for addr, info in symbol_map.items():
        pair = info['pair'] if isinstance(info, dict) else info
        # Extract base symbol from pair (e.g., BTCUSDC -> BTC)
        base = pair.replace('USDC', '').replace('USDT', '')
        pair_to_addr[base.upper()] = addr.lower()

    symbols_to_delist = [s.strip().upper() for s in delist.split(',')]
    assets_lower = [a.lower() for a in assets]

    for symbol in symbols_to_delist:
        if symbol not in pair_to_addr:
            print(f'WARNING: {symbol} not found in symbol-map.json, skipping', file=sys.stderr)
            continue
        addr = pair_to_addr[symbol]
        if addr not in assets_lower:
            print(f'WARNING: {symbol} ({addr}) not in ITP assets, skipping', file=sys.stderr)
            continue
        idx = assets_lower.index(addr)
        remove_indices.append(idx)

    # Sort descending (required for swap-and-pop)
    remove_indices.sort(reverse=True)

    # Remove weights at those indices and redistribute
    removed_weight = sum(new_weights[i] for i in remove_indices)
    for i in remove_indices:
        del new_weights[i]

    if new_weights:
        # Redistribute evenly
        per_asset = removed_weight // len(new_weights)
        remainder = removed_weight - per_asset * len(new_weights)
        for i in range(len(new_weights)):
            new_weights[i] += per_asset
        new_weights[0] += remainder  # give remainder to first

if list_arg:
    # Format: SYMBOL:ADDRESS:PAIR:SOURCE
    parts = list_arg.split(':')
    if len(parts) != 4:
        print('ERROR: --list format must be SYMBOL:ADDRESS:PAIR:SOURCE', file=sys.stderr)
        sys.exit(1)
    _, new_addr, _, _ = parts
    add_assets.append(new_addr)

    # Default: give new asset MIN_WEIGHT, reduce others proportionally
    min_weight = 2500000000000000  # 0.25% = 25e14
    new_asset_weight = min_weight
    total_reduction = new_asset_weight
    for i in range(len(new_weights)):
        reduction = (new_weights[i] * total_reduction) // sum(new_weights)
        new_weights[i] -= reduction
    new_weights.append(new_asset_weight)

    # Adjust to ensure sum = 1e18
    diff = 1000000000000000000 - sum(new_weights)
    new_weights[0] += diff

if reweight:
    # Direct weight specification
    new_weights = [int(float(w) * 1e18) for w in reweight.split(',')]

# Validate
WEIGHT_SUM = 1000000000000000000
if sum(new_weights) != WEIGHT_SUM:
    # Adjust first weight to fix rounding
    diff = WEIGHT_SUM - sum(new_weights)
    new_weights[0] += diff

# Format for cast
remove_str = '[' + ','.join(str(i) for i in remove_indices) + ']'
add_str = '[' + ','.join(add_assets) + ']'
weights_str = '[' + ','.join(str(w) for w in new_weights) + ']'

print(f'REMOVE_INDICES={remove_str}')
print(f'ADD_ASSETS={add_str}')
print(f'NEW_WEIGHTS={weights_str}')
print(f'NOTE={note}')
" > /tmp/manage-assets-params.sh

# Source the computed params
source /tmp/manage-assets-params.sh

echo ""
echo "Computed parameters:"
echo "  Remove indices: $REMOVE_INDICES"
echo "  Add assets:     $ADD_ASSETS"
echo "  New weights:    $NEW_WEIGHTS"
echo "  Note:           $NOTE"
echo ""

# Call requestRebalance (event-only, permissionless)
echo "Calling requestRebalance..."
cast send "$INDEX_ADDRESS" \
    "requestRebalance(bytes32,uint256[],address[],uint256[],string)" \
    "$ITP_ID" \
    "$REMOVE_INDICES" \
    "$ADD_ASSETS" \
    "$NEW_WEIGHTS" \
    "$NOTE" \
    --private-key "$PRIVATE_KEY" \
    --rpc-url "$RPC_URL"

echo ""
echo "RebalanceRequested event emitted. Issuers will verify and execute."
