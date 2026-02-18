#!/bin/bash
# ============================================
# MONEY MOVEMENT LOG PARSER
# Parses existing logs for comprehensive money movements
# Matches vital-test.md output format
# ============================================
# Usage: ./scripts/parse-money-logs.sh

LOG_DIR="logs"
OUTPUT="logs/money-movements.log"
RPC_URL="${RPC_URL:-http://localhost:8545}"

# Strip ANSI color codes (macOS compatible using perl)
strip_ansi() {
    perl -pe 's/\e\[[0-9;]*m//g'
}

# ============================================
# HEADER
# ============================================

cat > $OUTPUT << 'HEADER'
=== MONEY MOVEMENT LOG ===
HEADER

echo "Generated: $(date)" >> $OUTPUT
echo "" >> $OUTPUT

# ============================================
# TOKEN FLOW DIAGRAM
# ============================================

cat >> $OUTPUT << 'DIAGRAM'
=== TOKEN FLOW DIAGRAM ===
┌─────────────────────────────────────────────────────────────────────────────┐
│                   USDC FLOW (Buy ITP via Bridge)                            │
│                                                                             │
│   ┌──────┐    ┌──────────┐    ┌───────┐    ┌──────────┐    ┌───────────┐   │
│   │ User │───►│  Bridge  │───►│ Index │───►│  Bridge  │───►│  Custody  │   │
│   │      │    │ (Arb→L3) │    │ (L3)  │    │ (L3→Arb) │    │   (Arb)   │   │
│   └──────┘    └──────────┘    └───────┘    └──────────┘    └─────┬─────┘   │
│   ARB_USDC      L3_USDC       Order/Batch    ARB_USDC            │         │
│                               Confirmed                          │         │
│                                                                  ▼         │
│                                                           ┌───────────┐    │
│                                                           │  Bitget   │    │
│                                                           │  Mock     │    │
│                                                           │  Vault    │    │
│                                                           └───────────┘    │
│                                                           AP trades here   │
│                                                                            │
│   Complete flow: User → Bridge → Index → Bridge → Custody → BitgetMock    │
└─────────────────────────────────────────────────────────────────────────────┘

DIAGRAM

# ============================================
# CONTRACT ADDRESSES (if deployment exists)
# ============================================

if [ -f "deployments/e2e-full-system.json" ]; then
    echo "=== CONTRACT ADDRESSES ===" >> $OUTPUT
    echo "Index: $(jq -r '.contracts.Index' deployments/e2e-full-system.json)" >> $OUTPUT
    echo "ArbBridgeCustody: $(jq -r '.contracts.ArbBridgeCustody' deployments/e2e-full-system.json)" >> $OUTPUT
    echo "L3BridgeCustody: $(jq -r '.contracts.L3BridgeCustody' deployments/e2e-full-system.json)" >> $OUTPUT
    echo "MockBitgetVault: $(jq -r '.contracts.MockBitgetVault' deployments/e2e-full-system.json)" >> $OUTPUT
    echo "ARB_USDC: $(jq -r '.contracts.ARB_USDC' deployments/e2e-full-system.json) (6 decimals)" >> $OUTPUT
    echo "L3_USDC: $(jq -r '.contracts.L3_WUSDC' deployments/e2e-full-system.json) (18 decimals)" >> $OUTPUT
    echo "BTC: $(jq -r '.contracts.BTC' deployments/e2e-full-system.json)" >> $OUTPUT
    echo "ETH: $(jq -r '.contracts.ETH' deployments/e2e-full-system.json)" >> $OUTPUT
    echo "" >> $OUTPUT

    # Load addresses for balance queries
    VAULT=$(jq -r '.contracts.MockBitgetVault' deployments/e2e-full-system.json)
    BTC=$(jq -r '.contracts.BTC' deployments/e2e-full-system.json)
    ETH=$(jq -r '.contracts.ETH' deployments/e2e-full-system.json)
    ARB_USDC=$(jq -r '.contracts.ARB_USDC' deployments/e2e-full-system.json)
    L3_USDC=$(jq -r '.contracts.L3_WUSDC' deployments/e2e-full-system.json)
    INDEX=$(jq -r '.contracts.Index' deployments/e2e-full-system.json)
    ARB_CUSTODY=$(jq -r '.contracts.ArbBridgeCustody' deployments/e2e-full-system.json)
    L3_CUSTODY=$(jq -r '.contracts.L3BridgeCustody' deployments/e2e-full-system.json)
    USER_ADDR="0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
    AP_ADDR="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
fi

# ============================================
# TOKEN MOVEMENTS (from logs)
# ============================================

echo "=== TOKEN MOVEMENTS ===" >> $OUTPUT

# Parse AP logs for trade events
if [ -f "$LOG_DIR/ap.log" ]; then
    cat $LOG_DIR/ap.log 2>/dev/null | strip_ansi | grep "TradeRequest" | while read line; do
        TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
        CYCLE=$(echo "$line" | sed -n 's/.*cycle=\([0-9]*\).*/\1/p')
        SIDE=$(echo "$line" | sed -n 's/.*side=\([A-Za-z]*\).*/\1/p')
        AMT=$(echo "$line" | sed -n 's/.*amount=\([0-9]*\).*/\1/p')
        if [ -n "$CYCLE" ]; then
            echo "[$TS] TradeRequest: cycle=$CYCLE, side=$SIDE, amount=$AMT" >> $OUTPUT
        fi
    done

    # Trade executed
    cat $LOG_DIR/ap.log 2>/dev/null | strip_ansi | grep "Trade executed" | while read line; do
        TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
        TID=$(echo "$line" | sed -n 's/.*trade_id=\([0-9]*\).*/\1/p')
        SELL_TOK=$(echo "$line" | sed -n 's/.*sell_token=\(0x[a-fA-F0-9]*\).*/\1/p')
        BUY_TOK=$(echo "$line" | sed -n 's/.*buy_token=\(0x[a-fA-F0-9]*\).*/\1/p')
        SELL_AMT=$(echo "$line" | sed -n 's/.*sell_amount=\([0-9]*\).*/\1/p')
        BUY_AMT=$(echo "$line" | sed -n 's/.*buy_amount=\([0-9]*\).*/\1/p')
        TX=$(echo "$line" | sed -n 's/.*tx_hash=\(0x[a-fA-F0-9]*\).*/\1/p')
        if [ -n "$TID" ]; then
            echo "[$TS] Vault (${SELL_TOK:0:6}..) --[SELL $SELL_AMT]--> AP" >> $OUTPUT
            echo "[$TS] Vault --[BUY $BUY_AMT of ${BUY_TOK:0:6}..]--> AP" >> $OUTPUT
            echo "    [tx: ${TX:0:18}...]" >> $OUTPUT
        fi
    done
fi

# Parse issuer logs for batch submissions
cat $LOG_DIR/issuer-*.log 2>/dev/null | strip_ansi | grep "Batch submitted" | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    CYCLE=$(echo "$line" | sed -n 's/.*cycle_number=\([0-9]*\).*/\1/p')
    TX=$(echo "$line" | sed -n 's/.*tx_hash=\(0x[a-fA-F0-9]*\).*/\1/p')
    if [ -n "$CYCLE" ]; then
        echo "[$TS] Index --[BatchConfirmed cycle=$CYCLE]--> Issuers" >> $OUTPUT
        echo "    [tx: ${TX:0:18}...]" >> $OUTPUT
    fi
done

echo "" >> $OUTPUT

# ============================================
# BRIDGE OPERATIONS
# ============================================

echo "=== BRIDGE OPERATIONS ===" >> $OUTPUT

# CrossChainOrderCreated events
cat $LOG_DIR/*.log 2>/dev/null | strip_ansi | grep -i "CrossChainOrder\|cross_chain_order" | head -10 | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    ORDER_ID=$(echo "$line" | sed -n 's/.*order_id=\([0-9]*\).*/\1/p')
    AMOUNT=$(echo "$line" | sed -n 's/.*amount=\([0-9]*\).*/\1/p')
    if [ -n "$ORDER_ID" ] || [ -n "$AMOUNT" ]; then
        echo "[$TS] User --[CrossChainOrder orderId=$ORDER_ID, amount=$AMOUNT]--> ArbCustody" >> $OUTPUT
    fi
done

# BridgeLockConfirmed events
cat $LOG_DIR/*.log 2>/dev/null | strip_ansi | grep -i "BridgeLock\|bridge_lock" | head -10 | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    NONCE=$(echo "$line" | sed -n 's/.*nonce=\([0-9]*\).*/\1/p')
    AMOUNT=$(echo "$line" | sed -n 's/.*amount=\([0-9]*\).*/\1/p')
    DEST=$(echo "$line" | sed -n 's/.*dest_chain=\([0-9]*\).*/\1/p')
    if [ -n "$NONCE" ]; then
        echo "[$TS] ArbCustody --[BRIDGE nonce=$NONCE, amount=$AMOUNT]--> L3 (dest=$DEST)" >> $OUTPUT
    fi
done

# BridgeCompleted events
cat $LOG_DIR/*.log 2>/dev/null | strip_ansi | grep -i "BridgeComplete\|bridge_complete" | head -10 | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    NONCE=$(echo "$line" | sed -n 's/.*nonce=\([0-9]*\).*/\1/p')
    AMOUNT=$(echo "$line" | sed -n 's/.*amount=\([0-9]*\).*/\1/p')
    SOURCE=$(echo "$line" | sed -n 's/.*source_chain=\([0-9]*\).*/\1/p')
    if [ -n "$NONCE" ]; then
        echo "[$TS] L3Custody --[BRIDGE_COMPLETE nonce=$NONCE, amount=$AMOUNT]--> ArbCustody" >> $OUTPUT
    fi
done

# Custody release events
cat $LOG_DIR/*.log 2>/dev/null | strip_ansi | grep -i "custody.*release\|release.*vault\|releasing" | head -10 | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    AMOUNT=$(echo "$line" | sed -n 's/.*amount=\([0-9]*\).*/\1/p')
    TX=$(echo "$line" | sed -n 's/.*tx_hash=\(0x[a-fA-F0-9]*\).*/\1/p')
    if [ -n "$AMOUNT" ] || [ -n "$TX" ]; then
        echo "[$TS] ArbCustody --[RELEASE amount=$AMOUNT]--> BitgetMock Vault" >> $OUTPUT
    fi
done

# Check if any bridge operations found
BRIDGE_COUNT=$(cat $LOG_DIR/*.log 2>/dev/null | strip_ansi | grep -ciE "bridge|custody|cross.?chain" 2>/dev/null || echo "0")
if [ "$BRIDGE_COUNT" = "0" ]; then
    echo "  (No bridge transfers detected in logs - using local vault settlement)" >> $OUTPUT
fi

echo "" >> $OUTPUT

# ============================================
# EVENTS TIMELINE
# ============================================

echo "=== EVENTS TIMELINE ===" >> $OUTPUT

# Combine and sort all events by timestamp
{
    # OrderSubmitted from issuer logs
    cat $LOG_DIR/issuer-*.log 2>/dev/null | strip_ansi | grep -i "OrderSubmitted\|order_submitted" | while read line; do
        TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
        ORDER_ID=$(echo "$line" | sed -n 's/.*order_id=\([0-9]*\).*/\1/p')
        SIDE=$(echo "$line" | sed -n 's/.*side=\([A-Za-z]*\).*/\1/p')
        if [ -n "$TS" ]; then
            echo "[$TS] OrderSubmitted: orderId=$ORDER_ID, side=$SIDE"
        fi
    done

    # BatchConfirmed
    cat $LOG_DIR/issuer-*.log 2>/dev/null | strip_ansi | grep -i "BatchConfirmed\|batch_confirmed\|Batch submitted" | while read line; do
        TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
        CYCLE=$(echo "$line" | sed -n 's/.*cycle[_number]*=\([0-9]*\).*/\1/p')
        if [ -n "$TS" ]; then
            echo "[$TS] BatchConfirmed: cycle=$CYCLE"
        fi
    done

    # TradeRequest
    cat $LOG_DIR/ap.log 2>/dev/null | strip_ansi | grep -i "TradeRequest" | while read line; do
        TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
        CYCLE=$(echo "$line" | sed -n 's/.*cycle=\([0-9]*\).*/\1/p')
        SIDE=$(echo "$line" | sed -n 's/.*side=\([A-Za-z]*\).*/\1/p')
        AMT=$(echo "$line" | sed -n 's/.*amount=\([0-9]*\).*/\1/p')
        if [ -n "$TS" ]; then
            echo "[$TS] TradeRequest: cycle=$CYCLE, side=$SIDE, amount=$AMT"
        fi
    done

    # FillConfirmed
    cat $LOG_DIR/issuer-*.log 2>/dev/null | strip_ansi | grep -i "FillConfirmed\|fill_confirmed\|fills confirmed" | while read line; do
        TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
        ORDER_ID=$(echo "$line" | sed -n 's/.*order_id=\([0-9]*\).*/\1/p')
        if [ -n "$TS" ]; then
            echo "[$TS] FillConfirmed: orderId=$ORDER_ID"
        fi
    done
} | sort >> $OUTPUT

echo "" >> $OUTPUT

# ============================================
# BALANCE SUMMARY
# ============================================

echo "=== BALANCE SUMMARY ===" >> $OUTPUT

if [ -f "deployments/e2e-full-system.json" ]; then
    echo "Account                     ARB_USDC        L3_USDC         BTC             ETH" >> $OUTPUT
    echo "─────────────────────────────────────────────────────────────────────────────────────" >> $OUTPUT

    # Get balances (if Anvil is running)
    if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
        # Helper to format balance
        format_bal_6() {
            local bal=$1
            if [ -z "$bal" ] || [ "$bal" = "0" ]; then
                echo "0.00"
            else
                printf "%.2f" $(echo "scale=6; $bal / 1000000" | bc 2>/dev/null) || echo "$bal"
            fi
        }
        format_bal_18() {
            local bal=$1
            if [ -z "$bal" ] || [ "$bal" = "0" ]; then
                echo "0.00"
            else
                printf "%.6f" $(echo "scale=18; $bal / 1000000000000000000" | bc 2>/dev/null) || echo "$bal"
            fi
        }

        USER_ARB=$(cast call "$ARB_USDC" "balanceOf(address)(uint256)" "$USER_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        USER_L3=$(cast call "$L3_USDC" "balanceOf(address)(uint256)" "$USER_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        USER_BTC=$(cast call "$BTC" "balanceOf(address)(uint256)" "$USER_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        USER_ETH=$(cast call "$ETH" "balanceOf(address)(uint256)" "$USER_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

        CUSTODY_ARB=$(cast call "$ARB_USDC" "balanceOf(address)(uint256)" "$ARB_CUSTODY" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        CUSTODY_L3=$(cast call "$L3_USDC" "balanceOf(address)(uint256)" "$L3_CUSTODY" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

        INDEX_L3=$(cast call "$L3_USDC" "balanceOf(address)(uint256)" "$INDEX" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

        VAULT_ARB=$(cast call "$ARB_USDC" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        VAULT_BTC=$(cast call "$BTC" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        VAULT_ETH=$(cast call "$ETH" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

        AP_ARB=$(cast call "$ARB_USDC" "balanceOf(address)(uint256)" "$AP_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        AP_BTC=$(cast call "$BTC" "balanceOf(address)(uint256)" "$AP_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
        AP_ETH=$(cast call "$ETH" "balanceOf(address)(uint256)" "$AP_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

        printf "%-25s %15s %15s %15s %15s\n" "User (${USER_ADDR:0:6}..)" "$(format_bal_6 $USER_ARB)" "$(format_bal_18 $USER_L3)" "$(format_bal_18 $USER_BTC)" "$(format_bal_18 $USER_ETH)" >> $OUTPUT
        printf "%-25s %15s %15s %15s %15s\n" "ArbCustody (${ARB_CUSTODY:0:6}..)" "$(format_bal_6 $CUSTODY_ARB)" "-" "-" "-" >> $OUTPUT
        printf "%-25s %15s %15s %15s %15s\n" "L3Custody (${L3_CUSTODY:0:6}..)" "-" "$(format_bal_18 $CUSTODY_L3)" "-" "-" >> $OUTPUT
        printf "%-25s %15s %15s %15s %15s\n" "Index (${INDEX:0:6}..)" "-" "$(format_bal_18 $INDEX_L3)" "-" "-" >> $OUTPUT
        printf "%-25s %15s %15s %15s %15s\n" "Vault (${VAULT:0:6}..)" "$(format_bal_6 $VAULT_ARB)" "-" "$(format_bal_18 $VAULT_BTC)" "$(format_bal_18 $VAULT_ETH)" >> $OUTPUT
        printf "%-25s %15s %15s %15s %15s\n" "AP (${AP_ADDR:0:6}..)" "$(format_bal_6 $AP_ARB)" "-" "$(format_bal_18 $AP_BTC)" "$(format_bal_18 $AP_ETH)" >> $OUTPUT
    else
        echo "  (Chain not available - unable to query balances)" >> $OUTPUT
    fi
else
    echo "  (Deployment file not found - unable to query balances)" >> $OUTPUT
fi

echo "" >> $OUTPUT

# ============================================
# VAULT NET POSITIONS
# ============================================

echo "=== VAULT NET POSITIONS ===" >> $OUTPUT

if [ -f "deployments/e2e-full-system.json" ] && cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    BTC_POS=$(cast call $VAULT "getNetPosition(address)(int256)" $BTC --rpc-url $RPC_URL 2>/dev/null || echo "N/A")
    ETH_POS=$(cast call $VAULT "getNetPosition(address)(int256)" $ETH --rpc-url $RPC_URL 2>/dev/null || echo "N/A")
    USDC_POS=$(cast call $VAULT "getNetPosition(address)(int256)" $ARB_USDC --rpc-url $RPC_URL 2>/dev/null || echo "N/A")

    echo "  BTC: $BTC_POS (minted to AP)" >> $OUTPUT
    echo "  ETH: $ETH_POS (minted to AP)" >> $OUTPUT
    echo "  ARB_USDC: $USDC_POS (burned for trades)" >> $OUTPUT
else
    echo "  (Unable to query vault positions)" >> $OUTPUT
fi

echo "" >> $OUTPUT

# ============================================
# AP TRADE DETAILS
# ============================================

echo "=== AP TRADE DETAILS ===" >> $OUTPUT

# Token approved
cat $LOG_DIR/ap.log 2>/dev/null | strip_ansi | grep "approved for" | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    TOKEN=$(echo "$line" | sed -n 's/.*token=\(0x[a-fA-F0-9]*\).*/\1/p')
    if [ -n "$TOKEN" ]; then
        echo "[$TS] TOKEN_APPROVED: ${TOKEN:0:14}..." >> $OUTPUT
    fi
done

# Trade executed details
cat $LOG_DIR/ap.log 2>/dev/null | strip_ansi | grep "Trade executed" | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    TID=$(echo "$line" | sed -n 's/.*trade_id=\([0-9]*\).*/\1/p')
    SELL_TOK=$(echo "$line" | sed -n 's/.*sell_token=\(0x[a-fA-F0-9]*\).*/\1/p')
    BUY_TOK=$(echo "$line" | sed -n 's/.*buy_token=\(0x[a-fA-F0-9]*\).*/\1/p')
    SELL_AMT=$(echo "$line" | sed -n 's/.*sell_amount=\([0-9]*\).*/\1/p')
    BUY_AMT=$(echo "$line" | sed -n 's/.*buy_amount=\([0-9]*\).*/\1/p')
    TX=$(echo "$line" | sed -n 's/.*tx_hash=\(0x[a-fA-F0-9]*\).*/\1/p')
    if [ -n "$TID" ]; then
        echo "[$TS] VAULT_TRADE #$TID:" >> $OUTPUT
        echo "    SELL: $SELL_AMT of ${SELL_TOK:0:14}..." >> $OUTPUT
        echo "    BUY:  $BUY_AMT of ${BUY_TOK:0:14}..." >> $OUTPUT
        echo "    TX:   ${TX:0:18}..." >> $OUTPUT
    fi
done

# Settlement
cat $LOG_DIR/ap.log 2>/dev/null | strip_ansi | grep "settlement executed" | while read line; do
    TS=$(echo "$line" | sed -n 's/.*\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}\).*/\1/p')
    OID=$(echo "$line" | sed -n 's/.*order_id=\([0-9]*\).*/\1/p')
    TX=$(echo "$line" | sed -n 's/.*tx_hash=\(0x[a-fA-F0-9]*\).*/\1/p')
    if [ -n "$OID" ]; then
        echo "[$TS] SETTLEMENT: order=$OID tx=${TX:0:18}..." >> $OUTPUT
    fi
done

echo "" >> $OUTPUT
echo "=== END ===" >> $OUTPUT

# ============================================
# CONSOLE OUTPUT
# ============================================

echo ""
echo "=== MONEY MOVEMENT LOG ==="
cat $OUTPUT
echo ""
echo "Log saved to: $OUTPUT"
