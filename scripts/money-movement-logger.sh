#!/bin/bash
# Money Movement Logger
# Monitors blockchain events and logs all token transfers, trades, and bridge operations
# Usage: ./scripts/money-movement-logger.sh [--follow]
#
# This script tracks the full bridge flow:
# User → Bridge → Index → Bridge → Custody → BitgetMock

set -e

# Load environment
if [ -f issuer-local.env ]; then
    source issuer-local.env
fi

RPC_URL=${ISSUER_RPC_URL:-http://localhost:8545}
LOG_FILE="logs/money-movements.log"
DEPLOYMENT_FILE="deployments/e2e-full-system.json"

# Contract addresses from deployment
INDEX=$(jq -r '.contracts.Index' $DEPLOYMENT_FILE 2>/dev/null || echo "")
VAULT=$(jq -r '.contracts.MockBitgetVault' $DEPLOYMENT_FILE 2>/dev/null || echo "")
L3_USDC=$(jq -r '.contracts.L3_WUSDC' $DEPLOYMENT_FILE 2>/dev/null || echo "")
ARB_USDC=$(jq -r '.contracts.ARB_USDC' $DEPLOYMENT_FILE 2>/dev/null || echo "")
BTC=$(jq -r '.contracts.BTC' $DEPLOYMENT_FILE 2>/dev/null || echo "")
ETH=$(jq -r '.contracts.ETH' $DEPLOYMENT_FILE 2>/dev/null || echo "")
L3_CUSTODY=$(jq -r '.contracts.L3BridgeCustody' $DEPLOYMENT_FILE 2>/dev/null || echo "")
ARB_CUSTODY=$(jq -r '.contracts.ArbBridgeCustody' $DEPLOYMENT_FILE 2>/dev/null || echo "")

# ============================================
# EVENT SIGNATURES AND TOPIC HASHES
# ============================================
# Transfer event (ERC20)
TRANSFER_SIG="Transfer(address,address,uint256)"
TRANSFER_TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# Bridge events (ArbBridgeCustody / L3BridgeCustody)
CROSS_CHAIN_ORDER_SIG="CrossChainOrderCreated(uint256,bytes32,address,uint256)"
BRIDGE_LOCK_SIG="BridgeLockConfirmed(uint256,uint256,uint256,uint256,bytes32)"
BRIDGE_COMPLETE_SIG="BridgeCompleted(uint256,uint256,uint256,bytes32)"
CUSTODY_RELEASED_SIG="CustodyReleased(uint256,address,uint256)"

# Index events
ORDER_SUBMITTED_SIG="OrderSubmitted(uint256,address,bytes32,bytes32,uint8,uint256,uint256,uint256,uint256)"
BATCH_CONFIRMED_SIG="BatchConfirmed(uint256,uint256[],bytes)"
FILL_CONFIRMED_SIG="FillConfirmed(uint256,uint256,uint256,uint256)"

# Vault events
TRADE_REQUEST_SIG="TradeRequest(uint256,bytes32,uint8,uint256,uint256)"
MINT_SIG="Mint(address,uint256)"
BURN_SIG="Burn(address,uint256)"

# Compute topic hashes (using cast)
compute_topic() {
    cast keccak "$1" 2>/dev/null | head -c 66
}

# Pre-compute topic hashes on startup
CROSS_CHAIN_ORDER_TOPIC=$(compute_topic "$CROSS_CHAIN_ORDER_SIG")
BRIDGE_LOCK_TOPIC=$(compute_topic "$BRIDGE_LOCK_SIG")
BRIDGE_COMPLETE_TOPIC=$(compute_topic "$BRIDGE_COMPLETE_SIG")
CUSTODY_RELEASED_TOPIC=$(compute_topic "$CUSTODY_RELEASED_SIG")
ORDER_SUBMITTED_TOPIC=$(compute_topic "$ORDER_SUBMITTED_SIG")
BATCH_CONFIRMED_TOPIC=$(compute_topic "$BATCH_CONFIRMED_SIG")
FILL_CONFIRMED_TOPIC=$(compute_topic "$FILL_CONFIRMED_SIG")
TRADE_REQUEST_TOPIC=$(compute_topic "$TRADE_REQUEST_SIG")

# ============================================
# HELPER FUNCTIONS
# ============================================

# Helper to format address (shortened)
short_addr() {
    echo "${1:0:6}..${1: -4}"
}

# Helper to format amount with 18 decimals
format_18dec() {
    local wei=$1
    if [ -z "$wei" ] || [ "$wei" = "0x" ]; then
        echo "0.00"
        return
    fi
    # Convert hex to decimal if needed
    if [[ $wei == 0x* ]]; then
        wei=$(cast --to-base $wei 10 2>/dev/null || echo "0")
    fi
    # Format with decimals
    if [ ${#wei} -gt 18 ]; then
        local whole=${wei:0:$((${#wei}-18))}
        local dec=${wei:$((${#wei}-18)):2}
        printf "%s.%s" "$whole" "$dec"
    elif [ ${#wei} -gt 16 ]; then
        printf "0.%s" "${wei:0:2}"
    else
        echo "0.00"
    fi
}

# Helper to format amount with 6 decimals (USDC on Arbitrum)
format_6dec() {
    local amount=$1
    if [ -z "$amount" ] || [ "$amount" = "0x" ]; then
        echo "0.00"
        return
    fi
    # Convert hex to decimal if needed
    if [[ $amount == 0x* ]]; then
        amount=$(cast --to-base $amount 10 2>/dev/null || echo "0")
    fi
    # Format with 6 decimals
    if [ ${#amount} -gt 6 ]; then
        local whole=${amount:0:$((${#amount}-6))}
        local dec=${amount:$((${#amount}-6)):2}
        printf "%s.%s" "$whole" "$dec"
    elif [ ${#amount} -gt 4 ]; then
        printf "0.%s" "${amount:0:2}"
    else
        echo "0.00"
    fi
}

# Get token name from address
token_name() {
    local addr=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    local l3_lower=$(echo "$L3_USDC" | tr '[:upper:]' '[:lower:]')
    local arb_lower=$(echo "$ARB_USDC" | tr '[:upper:]' '[:lower:]')
    local btc_lower=$(echo "$BTC" | tr '[:upper:]' '[:lower:]')
    local eth_lower=$(echo "$ETH" | tr '[:upper:]' '[:lower:]')

    case $addr in
        $l3_lower) echo "L3_USDC" ;;
        $arb_lower) echo "ARB_USDC" ;;
        $btc_lower) echo "BTC" ;;
        $eth_lower) echo "ETH" ;;
        *) echo "TOKEN" ;;
    esac
}

# Get contract name from address
contract_name() {
    local addr=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    local index_lower=$(echo "$INDEX" | tr '[:upper:]' '[:lower:]')
    local vault_lower=$(echo "$VAULT" | tr '[:upper:]' '[:lower:]')
    local l3_custody_lower=$(echo "$L3_CUSTODY" | tr '[:upper:]' '[:lower:]')
    local arb_custody_lower=$(echo "$ARB_CUSTODY" | tr '[:upper:]' '[:lower:]')

    case $addr in
        $index_lower) echo "Index" ;;
        $vault_lower) echo "Vault" ;;
        $l3_custody_lower) echo "L3Custody" ;;
        $arb_custody_lower) echo "ArbCustody" ;;
        "0x0000000000000000000000000000000000000000") echo "ZERO" ;;
        *) echo "$(short_addr $addr)" ;;
    esac
}

# Log event with timestamp
log_event() {
    local timestamp=$(date '+%H:%M:%S')
    local msg="$1"
    echo "[$timestamp] $msg" | tee -a $LOG_FILE
}

# Log token flow in FROM --> TO format
log_token_flow() {
    local from="$1"
    local to="$2"
    local amount="$3"
    local token="$4"
    local from_name=$(contract_name "$from")
    local to_name=$(contract_name "$to")
    log_event "TRANSFER: $from_name ($(short_addr $from)) --[$amount $token]--> $to_name ($(short_addr $to))"
}

# Query balance of token for address
get_balance() {
    local token=$1
    local addr=$2
    cast call $token "balanceOf(address)(uint256)" $addr --rpc-url $RPC_URL 2>/dev/null || echo "0"
}

# Snapshot and log balances
snapshot_balances() {
    local label="$1"
    log_event ""
    log_event "=== BALANCES $label ==="

    # User balance (first user from deployment)
    local USER=$(jq -r '.users[0] // empty' $DEPLOYMENT_FILE 2>/dev/null || echo "")
    if [ -n "$USER" ]; then
        local user_arb=$(get_balance "$ARB_USDC" "$USER")
        local user_l3=$(get_balance "$L3_USDC" "$USER")
        log_event "  User ($(short_addr $USER)): ARB_USDC=$(format_6dec $user_arb), L3_USDC=$(format_18dec $user_l3)"
    fi

    # ArbCustody
    if [ -n "$ARB_CUSTODY" ]; then
        local arb_bal=$(get_balance "$ARB_USDC" "$ARB_CUSTODY")
        log_event "  ArbCustody ($(short_addr $ARB_CUSTODY)): ARB_USDC=$(format_6dec $arb_bal)"
    fi

    # L3Custody
    if [ -n "$L3_CUSTODY" ]; then
        local l3_bal=$(get_balance "$L3_USDC" "$L3_CUSTODY")
        log_event "  L3Custody ($(short_addr $L3_CUSTODY)): L3_USDC=$(format_18dec $l3_bal)"
    fi

    # Index
    if [ -n "$INDEX" ]; then
        local idx_bal=$(get_balance "$L3_USDC" "$INDEX")
        log_event "  Index ($(short_addr $INDEX)): L3_USDC=$(format_18dec $idx_bal)"
    fi

    # Vault
    if [ -n "$VAULT" ]; then
        local vault_arb=$(get_balance "$ARB_USDC" "$VAULT")
        local vault_btc=$(get_balance "$BTC" "$VAULT")
        local vault_eth=$(get_balance "$ETH" "$VAULT")
        log_event "  Vault ($(short_addr $VAULT)): ARB_USDC=$(format_6dec $vault_arb), BTC=$(format_18dec $vault_btc), ETH=$(format_18dec $vault_eth)"
    fi

    log_event "========================"
    log_event ""
}

# ============================================
# EVENT PARSING
# ============================================

parse_event() {
    local topic0="$1"
    local topics="$2"
    local data="$3"
    local address="$4"

    case $topic0 in
        $TRANSFER_TOPIC)
            # Transfer(address indexed from, address indexed to, uint256 value)
            local from=$(echo "$topics" | jq -r '.[1]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local to=$(echo "$topics" | jq -r '.[2]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local token_nm=$(token_name "$address")
            local amount
            if [[ "$token_nm" == "ARB_USDC" ]]; then
                amount=$(format_6dec "$data")
            else
                amount=$(format_18dec "$data")
            fi
            log_token_flow "$from" "$to" "$amount" "$token_nm"
            ;;

        $CROSS_CHAIN_ORDER_TOPIC)
            log_event "EVENT: CrossChainOrderCreated"
            log_event "  → User initiated cross-chain buy on Arbitrum"
            ;;

        $BRIDGE_LOCK_TOPIC)
            log_event "EVENT: BridgeLockConfirmed"
            log_event "  → USDC locked in custody for bridge"
            ;;

        $BRIDGE_COMPLETE_TOPIC)
            log_event "EVENT: BridgeCompleted"
            log_event "  → Bridge transfer completed"
            ;;

        $CUSTODY_RELEASED_TOPIC)
            log_event "EVENT: CustodyReleased"
            log_event "  → USDC released from custody to vault"
            ;;

        $ORDER_SUBMITTED_TOPIC)
            log_event "EVENT: OrderSubmitted"
            log_event "  → Order submitted to Index"
            ;;

        $BATCH_CONFIRMED_TOPIC)
            log_event "EVENT: BatchConfirmed"
            log_event "  → Issuers confirmed batch with BLS signatures"
            ;;

        $FILL_CONFIRMED_TOPIC)
            log_event "EVENT: FillConfirmed"
            log_event "  → Order fill confirmed, ITP minted/burned"
            ;;

        $TRADE_REQUEST_TOPIC)
            log_event "EVENT: TradeRequest"
            log_event "  → AP trade request sent to vault"
            ;;
    esac
}

# Process transaction receipt for events
process_receipt() {
    local tx_hash=$1
    local RECEIPT=$(cast receipt $tx_hash --rpc-url $RPC_URL --json 2>/dev/null)

    if [ -z "$RECEIPT" ]; then
        return
    fi

    # Parse each log entry
    echo "$RECEIPT" | jq -c '.logs[]' 2>/dev/null | while read log_entry; do
        local topic0=$(echo "$log_entry" | jq -r '.topics[0]')
        local topics=$(echo "$log_entry" | jq -c '.topics')
        local data=$(echo "$log_entry" | jq -r '.data')
        local address=$(echo "$log_entry" | jq -r '.address')

        parse_event "$topic0" "$topics" "$data" "$address"
    done
}

# ============================================
# MAIN
# ============================================

mkdir -p logs

# Header
echo "" >> $LOG_FILE
log_event "╔══════════════════════════════════════════════════════════════════════════════╗"
log_event "║                     MONEY MOVEMENT LOGGER STARTED                            ║"
log_event "╠══════════════════════════════════════════════════════════════════════════════╣"
log_event "║  RPC: $RPC_URL"
log_event "║  Tracking flow: User → Bridge → Index → Bridge → Custody → Vault"
log_event "╠══════════════════════════════════════════════════════════════════════════════╣"
log_event "║  Contract Addresses:"
log_event "║    Index:      $INDEX"
log_event "║    ArbCustody: $ARB_CUSTODY"
log_event "║    L3Custody:  $L3_CUSTODY"
log_event "║    Vault:      $VAULT"
log_event "║    ARB_USDC:   $ARB_USDC"
log_event "║    L3_USDC:    $L3_USDC"
log_event "╚══════════════════════════════════════════════════════════════════════════════╝"

# Get current block
CURRENT_BLOCK=$(cast block-number --rpc-url $RPC_URL 2>/dev/null || echo "0")
log_event "Starting from block: $CURRENT_BLOCK"

# Initial balance snapshot
snapshot_balances "INITIAL"

# Main loop for following
if [ "$1" = "--follow" ]; then
    log_event "Following new blocks..."
    LAST_BLOCK=$CURRENT_BLOCK

    while true; do
        sleep 1
        NEW_BLOCK=$(cast block-number --rpc-url $RPC_URL 2>/dev/null || echo $LAST_BLOCK)

        if [ "$NEW_BLOCK" -gt "$LAST_BLOCK" ]; then
            for block in $(seq $((LAST_BLOCK + 1)) $NEW_BLOCK); do
                # Get block transactions
                BLOCK_DATA=$(cast block $block --json --rpc-url $RPC_URL 2>/dev/null)
                TX_HASHES=$(echo "$BLOCK_DATA" | jq -r '.transactions[]' 2>/dev/null)

                if [ -n "$TX_HASHES" ]; then
                    log_event ""
                    log_event "━━━ Block $block ━━━"

                    for tx_hash in $TX_HASHES; do
                        process_receipt "$tx_hash"
                    done

                    # Snapshot balances after block with events
                    snapshot_balances "AFTER BLOCK $block"
                fi
            done
            LAST_BLOCK=$NEW_BLOCK
        fi
    done
else
    # One-time scan of recent blocks
    log_event ""
    log_event "Scanning last 100 blocks..."
    START_BLOCK=$((CURRENT_BLOCK - 100))
    [ $START_BLOCK -lt 0 ] && START_BLOCK=0

    for block in $(seq $START_BLOCK $CURRENT_BLOCK); do
        BLOCK_DATA=$(cast block $block --json --rpc-url $RPC_URL 2>/dev/null)
        TX_HASHES=$(echo "$BLOCK_DATA" | jq -r '.transactions[]' 2>/dev/null)

        if [ -n "$TX_HASHES" ]; then
            log_event ""
            log_event "━━━ Block $block ━━━"

            for tx_hash in $TX_HASHES; do
                process_receipt "$tx_hash"
            done
        fi
    done

    # Final balance snapshot
    snapshot_balances "FINAL"

    log_event ""
    log_event "Scan complete. Run with --follow to monitor new events."
fi
