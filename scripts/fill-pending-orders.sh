#!/usr/bin/env bash
# Fill all pending L3 orders using BLS-signed confirmFills.
# Reads orders from chain, computes BLS sig via bls-tool, submits in batches.
set -euo pipefail

RPC="${L3_RPC:-https://rpc.generalmarket.io/}"
KEY="${DEPLOYER_KEY:-0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537}"
CHAIN_ID=111222333
BATCH_SIZE=10  # orders per confirmFills tx
BLS_TOOL="target/release/bls-tool"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

INDEX=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['Index'])")
REGISTRY=$(python3 -c "import json; print(json.load(open('deployments/active-deployment.json'))['contracts']['OracleRegistry'])")

echo "Index: $INDEX"
echo "Registry: $REGISTRY"

# Get registry nonce
REG_NONCE=$(cast call "$REGISTRY" "registryNonce()(uint256)" --rpc-url "$RPC" | awk '{print $1}')
echo "Registry nonce: $REG_NONCE"

# Get next order ID
NEXT_ORDER=$(cast call "$INDEX" "nextOrderId()(uint256)" --rpc-url "$RPC" | awk '{print $1}')
echo "Next order ID: $NEXT_ORDER (scanning 1..$(($NEXT_ORDER - 1)))"

# Collect all pending orders
PENDING_IDS=()
for i in $(seq 1 $(($NEXT_ORDER - 1))); do
    RAW=$(cast call "$INDEX" "getOrder(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)" "$i" --rpc-url "$RPC" 2>/dev/null || echo "")
    if [ -z "$RAW" ]; then continue; fi
    # Status is the 11th return value (uint8)
    STATUS=$(echo "$RAW" | sed -n '11p' | tr -d '[:space:]')
    if [ "$STATUS" = "0" ]; then
        PENDING_IDS+=("$i")
    fi
done

echo "Found ${#PENDING_IDS[@]} pending orders"
if [ ${#PENDING_IDS[@]} -eq 0 ]; then
    echo "Nothing to fill"
    exit 0
fi

# Process in batches
CYCLE=1000000  # arbitrary cycle number
FILLED=0

for ((start=0; start < ${#PENDING_IDS[@]}; start+=BATCH_SIZE)); do
    BATCH=("${PENDING_IDS[@]:$start:$BATCH_SIZE}")
    CYCLE=$((CYCLE + 1))

    # Build fills array: (orderId, fillAmount, fillPrice, cycleNumber)
    # Each fill uses the order's own amount and a NAV of $1 (1e18)
    FILLS_ABI=""
    for oid in "${BATCH[@]}"; do
        # Read order amount and ITP ID
        RAW=$(cast call "$INDEX" "getOrder(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)" "$oid" --rpc-url "$RPC" 2>/dev/null)
        AMOUNT=$(echo "$RAW" | sed -n '5p' | awk '{print $1}')
        # Fill at $1 NAV (1e18)
        FILL_PRICE="1000000000000000000"

        if [ -n "$FILLS_ABI" ]; then FILLS_ABI+=","; fi
        FILLS_ABI+="($oid,$AMOUNT,$FILL_PRICE,$CYCLE)"
    done

    # Build the message hash: keccak256(abi.encode(chainId, indexAddr, cycleNumber, fills))
    # We need to abi.encode the fills as a tuple array, then hash with chainId etc.
    # This is complex in bash — use cast abi-encode

    # Build fills as solidity tuple array string
    FILLS_SOL="["
    for oid in "${BATCH[@]}"; do
        RAW=$(cast call "$INDEX" "getOrder(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)" "$oid" --rpc-url "$RPC" 2>/dev/null)
        AMOUNT=$(echo "$RAW" | sed -n '5p' | awk '{print $1}')
        FILL_PRICE="1000000000000000000"
        if [ "$FILLS_SOL" != "[" ]; then FILLS_SOL+=","; fi
        FILLS_SOL+="($oid,$AMOUNT,$FILL_PRICE,$CYCLE)"
    done
    FILLS_SOL+="]"

    # Encode the message: keccak256(abi.encode(uint256 chainId, address index, uint256 cycle, Fill[] fills))
    # Fill struct: (uint256 orderId, uint256 fillAmount, uint256 fillPrice, uint256 cycleNumber)
    MSG_ENCODED=$(cast abi-encode "f(uint256,address,uint256,(uint256,uint256,uint256,uint256)[])" \
        "$CHAIN_ID" "$INDEX" "$CYCLE" "$FILLS_SOL" 2>&1)
    MSG_HASH=$(cast keccak "$MSG_ENCODED" 2>&1)

    # Sign with BLS (all 3 oracle keys, seed indices 0,1,2)
    BLS_SIG=$($BLS_TOOL sign --seed-indices "0,1,2" --message-hash "$MSG_HASH" 2>/dev/null)
    if [ -z "$BLS_SIG" ]; then
        echo "BLS sign failed for batch starting at order ${BATCH[0]}"
        continue
    fi

    # Signer bitmask: all 3 oracles = 0b111 = 7
    SIGNER_BITMAP=7

    # Call confirmFills
    echo -n "Filling orders ${BATCH[0]}..${BATCH[-1]} (${#BATCH[@]} orders, cycle $CYCLE)..."
    if cast send "$INDEX" \
        "confirmFills(uint256,(uint256,uint256,uint256,uint256)[],bytes,uint256,uint256)" \
        "$CYCLE" "$FILLS_SOL" "$BLS_SIG" "$REG_NONCE" "$SIGNER_BITMAP" \
        --private-key "$KEY" --rpc-url "$RPC" --gas-limit 3000000 \
        > /dev/null 2>&1; then
        FILLED=$((FILLED + ${#BATCH[@]}))
        echo " OK"
    else
        echo " FAILED"
        # Try individual fills
        for oid in "${BATCH[@]}"; do
            RAW=$(cast call "$INDEX" "getOrder(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)" "$oid" --rpc-url "$RPC" 2>/dev/null)
            AMOUNT=$(echo "$RAW" | sed -n '5p' | awk '{print $1}')
            FILL_PRICE="1000000000000000000"
            SINGLE_CYCLE=$((CYCLE + oid))
            SINGLE_FILLS="[($oid,$AMOUNT,$FILL_PRICE,$SINGLE_CYCLE)]"
            SINGLE_ENCODED=$(cast abi-encode "f(uint256,address,uint256,(uint256,uint256,uint256,uint256)[])" \
                "$CHAIN_ID" "$INDEX" "$SINGLE_CYCLE" "$SINGLE_FILLS" 2>&1)
            SINGLE_HASH=$(cast keccak "$SINGLE_ENCODED" 2>&1)
            SINGLE_SIG=$($BLS_TOOL sign --seed-indices "0,1,2" --message-hash "$SINGLE_HASH" 2>/dev/null)

            if cast send "$INDEX" \
                "confirmFills(uint256,(uint256,uint256,uint256,uint256)[],bytes,uint256,uint256)" \
                "$SINGLE_CYCLE" "$SINGLE_FILLS" "$SINGLE_SIG" "$REG_NONCE" "$SIGNER_BITMAP" \
                --private-key "$KEY" --rpc-url "$RPC" --gas-limit 1000000 \
                > /dev/null 2>&1; then
                echo "  Order $oid: filled"
                FILLED=$((FILLED + 1))
            else
                echo "  Order $oid: FAILED"
            fi
        done
    fi
done

echo ""
echo "Filled $FILLED / ${#PENDING_IDS[@]} orders"

# Check remaining pending
REMAINING=$(cast call "$INDEX" "pendingOrderCount()(uint256)" --rpc-url "$RPC" 2>&1)
echo "Remaining pending: $REMAINING"
