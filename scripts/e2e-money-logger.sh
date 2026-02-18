#!/bin/bash
# E2E Money Movement Logger
# Real-time event logger that watches chain events and prints labeled lines.
# Tracks every token transfer, bridge operation, and trade with labeled contracts and chain context.
#
# Usage: ./scripts/e2e-money-logger.sh [--follow]
#
# Flow tracked:
#   BUY:       User ARB_USDC → ArbCustody → Bridge → L3 Index → confirmBatch → Issuers instruct AP → USDT swap → Trade → confirmFills → ITP minted
#   REBALANCE: proposeRebalance → Issuers confirm batch → Issuers instruct AP trades → weights updated
#   SELL:      submitOrder(SELL) → Issuers confirm batch → Issuers instruct AP reverse trades → shares burned → USDC returned

set -e

# ============================================
# CONFIGURATION
# ============================================

RPC_URL=${ISSUER_RPC_URL:-http://localhost:8545}
LOG_FILE="logs/money-movements.log"
DEPLOYMENT_FILE="deployments/e2e-full-system.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "ERROR: Deployment file not found: $DEPLOYMENT_FILE"
    echo "Run DeployFullSystemE2E first."
    exit 1
fi

# ============================================
# LOAD CONTRACT ADDRESSES
# ============================================

INDEX=$(jq -r '.contracts.Index' $DEPLOYMENT_FILE)
GOVERNANCE=$(jq -r '.contracts.Governance' $DEPLOYMENT_FILE)
ISSUER_REG=$(jq -r '.contracts.IssuerRegistry' $DEPLOYMENT_FILE)
L3_CUSTODY=$(jq -r '.contracts.L3BridgeCustody' $DEPLOYMENT_FILE)
ARB_CUSTODY=$(jq -r '.contracts.ArbBridgeCustody' $DEPLOYMENT_FILE)
BLS_CUSTODY=$(jq -r '.contracts.BLSCustody' $DEPLOYMENT_FILE)
VAULT=$(jq -r '.contracts.MockBitgetVault' $DEPLOYMENT_FILE)
L3_USDC=$(jq -r '.contracts.L3_WUSDC' $DEPLOYMENT_FILE)
ARB_USDC=$(jq -r '.contracts.ARB_USDC' $DEPLOYMENT_FILE)
BTC_ADDR=$(jq -r '.contracts.BTC' $DEPLOYMENT_FILE)
ETH_ADDR=$(jq -r '.contracts.ETH' $DEPLOYMENT_FILE)
ITP_ID=$(jq -r '.contracts.itpId' $DEPLOYMENT_FILE)

# Accounts
ADMIN=$(jq -r '.accounts.admin' $DEPLOYMENT_FILE)
ISSUER1=$(jq -r '.accounts.issuer1' $DEPLOYMENT_FILE)
ISSUER2=$(jq -r '.accounts.issuer2' $DEPLOYMENT_FILE)
ISSUER3=$(jq -r '.accounts.issuer3' $DEPLOYMENT_FILE)
AP=$(jq -r '.accounts.ap' $DEPLOYMENT_FILE)
USER=$(jq -r '.accounts.user' $DEPLOYMENT_FILE)

# MockUSDT from DeployLocalE2E
MOCK_USDT="0x809d550fca64d94Bd9F66E60752A544199cfAC3D"

# Issuer signer addresses (the ones that actually sign txs via issuer binary)
ISSUER_SIGNER_1="0xc0d3c9e530ca6d71469bb678e6592274154d9cad"
ISSUER_SIGNER_2="0xc0d3ca67da45613e7c5b2d55f09b00b3c99721f4"
ISSUER_SIGNER_3="0xc0d3c8dfd3445fd2e4dfed9d11b5b7032b3bd1ac"

# ============================================
# EVENT TOPIC HASHES
# ============================================

# ERC20
TRANSFER_TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# ArbBridgeCustody
CROSS_CHAIN_ORDER_TOPIC=$(cast keccak "CrossChainOrderCreated(uint256,bytes32,address,uint256)" 2>/dev/null)

# Index events
ORDER_SUBMITTED_TOPIC=$(cast keccak "OrderSubmitted(uint256,address,bytes32,bytes32,uint8,uint256,uint256,uint256,uint256)" 2>/dev/null)
BATCH_CONFIRMED_TOPIC=$(cast keccak "BatchConfirmed(uint256,uint256[],bytes)" 2>/dev/null)
FILL_CONFIRMED_TOPIC=$(cast keccak "FillConfirmed(uint256,uint256,uint256,uint256)" 2>/dev/null)

# Rebalance events
REBALANCE_PROPOSED_TOPIC=$(cast keccak "RebalanceProposed(bytes32,uint256[],uint256[])" 2>/dev/null)
REBALANCE_BATCH_TOPIC=$(cast keccak "RebalanceBatchConfirmed(uint256,bytes32[],bytes)" 2>/dev/null)
WEIGHTS_UPDATED_TOPIC=$(cast keccak "WeightsUpdated(bytes32,uint256[],uint256[])" 2>/dev/null)

# MockBitgetVault events
TRADE_EXECUTED_TOPIC=$(cast keccak "TradeExecuted(uint256,address,address,uint256,uint256,address,uint256)" 2>/dev/null)
STABLE_SWAP_TOPIC=$(cast keccak "StableSwap(address,address,uint256,address)" 2>/dev/null)

# ============================================
# LABEL MAPS
# ============================================

# Get label for an address (lowercase comparison)
label_addr() {
    local addr=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    local index_l=$(echo "$INDEX" | tr '[:upper:]' '[:lower:]')
    local vault_l=$(echo "$VAULT" | tr '[:upper:]' '[:lower:]')
    local l3_custody_l=$(echo "$L3_CUSTODY" | tr '[:upper:]' '[:lower:]')
    local arb_custody_l=$(echo "$ARB_CUSTODY" | tr '[:upper:]' '[:lower:]')
    local bls_custody_l=$(echo "$BLS_CUSTODY" | tr '[:upper:]' '[:lower:]')
    local admin_l=$(echo "$ADMIN" | tr '[:upper:]' '[:lower:]')
    local ap_l=$(echo "$AP" | tr '[:upper:]' '[:lower:]')
    local user_l=$(echo "$USER" | tr '[:upper:]' '[:lower:]')
    local issuer1_l=$(echo "$ISSUER1" | tr '[:upper:]' '[:lower:]')
    local issuer2_l=$(echo "$ISSUER2" | tr '[:upper:]' '[:lower:]')
    local issuer3_l=$(echo "$ISSUER3" | tr '[:upper:]' '[:lower:]')
    local signer1_l=$(echo "$ISSUER_SIGNER_1" | tr '[:upper:]' '[:lower:]')
    local signer2_l=$(echo "$ISSUER_SIGNER_2" | tr '[:upper:]' '[:lower:]')
    local signer3_l=$(echo "$ISSUER_SIGNER_3" | tr '[:upper:]' '[:lower:]')

    case "$addr" in
        "$index_l") echo "Index" ;;
        "$vault_l") echo "MockBitgetVault" ;;
        "$l3_custody_l") echo "L3BridgeCustody" ;;
        "$arb_custody_l") echo "ArbBridgeCustody" ;;
        "$bls_custody_l") echo "BLSCustody" ;;
        "$admin_l") echo "Admin/Deployer" ;;
        "$ap_l") echo "AP" ;;
        "$user_l") echo "User" ;;
        "$issuer1_l") echo "Issuer1(anvil)" ;;
        "$issuer2_l") echo "Issuer2(anvil)" ;;
        "$issuer3_l") echo "Issuer3(anvil)" ;;
        "$signer1_l") echo "IssuerSigner1" ;;
        "$signer2_l") echo "IssuerSigner2" ;;
        "$signer3_l") echo "IssuerSigner3" ;;
        "0x0000000000000000000000000000000000000000") echo "ZERO(mint/burn)" ;;
        *) echo "${addr:0:6}..${addr: -4}" ;;
    esac
}

# Get token name from contract address
token_name() {
    local addr=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    local l3_l=$(echo "$L3_USDC" | tr '[:upper:]' '[:lower:]')
    local arb_l=$(echo "$ARB_USDC" | tr '[:upper:]' '[:lower:]')
    local btc_l=$(echo "$BTC_ADDR" | tr '[:upper:]' '[:lower:]')
    local eth_l=$(echo "$ETH_ADDR" | tr '[:upper:]' '[:lower:]')
    local usdt_l=$(echo "$MOCK_USDT" | tr '[:upper:]' '[:lower:]')

    case "$addr" in
        "$l3_l") echo "L3_WUSDC" ;;
        "$arb_l") echo "ARB_USDC" ;;
        "$btc_l") echo "BTC" ;;
        "$eth_l") echo "ETH" ;;
        "$usdt_l") echo "USDT" ;;
        *) echo "TOKEN(${addr:0:6})" ;;
    esac
}

# Get chain context for a contract (both chains on same Anvil, but logically separate)
chain_for() {
    local addr=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    local arb_custody_l=$(echo "$ARB_CUSTODY" | tr '[:upper:]' '[:lower:]')
    local arb_usdc_l=$(echo "$ARB_USDC" | tr '[:upper:]' '[:lower:]')
    # ARB contracts
    if [ "$addr" = "$arb_custody_l" ] || [ "$addr" = "$arb_usdc_l" ]; then
        echo "ARB"
    else
        echo "L3"
    fi
}

# ============================================
# FORMATTING
# ============================================

# Format amount with 18 decimals
fmt18() {
    local val=$1
    if [ -z "$val" ] || [ "$val" = "0x" ] || [ "$val" = "0x0" ]; then echo "0.00"; return; fi
    if [[ $val == 0x* ]]; then val=$(cast --to-base "$val" 10 2>/dev/null || echo "0"); fi
    if [ ${#val} -gt 18 ]; then
        local whole=${val:0:$((${#val}-18))}
        local dec=${val:$((${#val}-18)):4}
        printf "%s.%s" "$whole" "$dec"
    elif [ ${#val} -gt 14 ]; then
        printf "0.%0*d%s" $((18 - ${#val})) 0 "${val:0:4}"
    else
        echo "0.0000"
    fi
}

# Format amount with 6 decimals
fmt6() {
    local val=$1
    if [ -z "$val" ] || [ "$val" = "0x" ] || [ "$val" = "0x0" ]; then echo "0.00"; return; fi
    if [[ $val == 0x* ]]; then val=$(cast --to-base "$val" 10 2>/dev/null || echo "0"); fi
    if [ ${#val} -gt 6 ]; then
        local whole=${val:0:$((${#val}-6))}
        local dec=${val:$((${#val}-6)):2}
        printf "%s.%s" "$whole" "$dec"
    elif [ ${#val} -gt 4 ]; then
        printf "0.%0*d%s" $((6 - ${#val})) 0 "${val:0:2}"
    else
        echo "0.00"
    fi
}

# Format token amount based on token address
fmt_token() {
    local token_addr=$1
    local amount=$2
    local tn=$(token_name "$token_addr")
    case "$tn" in
        "ARB_USDC"|"USDT") fmt6 "$amount" ;;
        *) fmt18 "$amount" ;;
    esac
}

# ============================================
# LOGGING
# ============================================

log() {
    local ts=$(date '+%H:%M:%S')
    echo "[$ts] $1" | tee -a "$LOG_FILE"
}

# ============================================
# EVENT PARSING
# ============================================

parse_log_entry() {
    local topic0="$1"
    local topics_json="$2"
    local data="$3"
    local emitter="$4"
    local chain=$(chain_for "$emitter")

    case "$topic0" in
        "$TRANSFER_TOPIC")
            local from=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local to=$(echo "$topics_json" | jq -r '.[2]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local tn=$(token_name "$emitter")
            local amount=$(fmt_token "$emitter" "$data")
            local from_label=$(label_addr "$from")
            local to_label=$(label_addr "$to")
            log "[TRANSFER] $tn: $from_label (${from:0:6}..) → $to_label (${to:0:6}..) | $amount | chain=$chain"
            ;;

        "$CROSS_CHAIN_ORDER_TOPIC")
            local order_id_hex=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null)
            local order_id=$(cast --to-base "$order_id_hex" 10 2>/dev/null || echo "?")
            log "[BRIDGE-ORDER] orderId=$order_id | User initiated cross-chain buy on Arbitrum | chain=ARB"
            ;;

        "$ORDER_SUBMITTED_TOPIC")
            local order_id_hex=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null)
            local order_id=$(cast --to-base "$order_id_hex" 10 2>/dev/null || echo "?")
            local user_addr=$(echo "$topics_json" | jq -r '.[2]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local user_label=$(label_addr "$user_addr")
            # Side is in the data payload — first 32 bytes = pairId, second 32 bytes = itpId, then side byte
            log "[ORDER] orderId=$order_id submitter=$user_label (${user_addr:0:6}..) | chain=$chain"
            ;;

        "$BATCH_CONFIRMED_TOPIC")
            local cycle_hex=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null)
            local cycle=$(cast --to-base "$cycle_hex" 10 2>/dev/null || echo "?")
            log "[BATCH] Issuers confirmed batch | cycle=$cycle | chain=$chain"
            ;;

        "$FILL_CONFIRMED_TOPIC")
            local order_id_hex=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null)
            local order_id=$(cast --to-base "$order_id_hex" 10 2>/dev/null || echo "?")
            # data: fillPrice (32 bytes) + fillAmount (32 bytes) + usdcToReturn (32 bytes)
            if [ ${#data} -ge 130 ]; then
                local price_hex="0x${data:2:64}"
                local amount_hex="0x${data:66:64}"
                local price=$(fmt18 "$price_hex")
                local amount=$(fmt18 "$amount_hex")
                log "[FILL] orderId=$order_id price=$price amount=$amount | chain=$chain"
            else
                log "[FILL] orderId=$order_id | chain=$chain"
            fi
            ;;

        "$REBALANCE_PROPOSED_TOPIC")
            log "[REBALANCE-PROPOSED] ITP rebalance proposed by asset manager | chain=$chain"
            ;;

        "$REBALANCE_BATCH_TOPIC")
            local cycle_hex=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null)
            local cycle=$(cast --to-base "$cycle_hex" 10 2>/dev/null || echo "?")
            log "[REBALANCE-BATCH] Issuers confirmed rebalance batch | cycle=$cycle | chain=$chain"
            ;;

        "$WEIGHTS_UPDATED_TOPIC")
            log "[WEIGHTS-UPDATED] ITP weights updated after rebalance | chain=$chain"
            ;;

        "$TRADE_EXECUTED_TOPIC")
            local trade_id_hex=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null)
            local trade_id=$(cast --to-base "$trade_id_hex" 10 2>/dev/null || echo "?")
            # data: sellToken(32) + buyToken(32) + sellAmount(32) + buyAmount(32) + trader(32) + timestamp(32)
            if [ ${#data} -ge 386 ]; then
                local sell_token="0x${data:26:40}"
                local buy_token="0x${data:90:40}"
                local sell_amount_hex="0x${data:130:64}"
                local buy_amount_hex="0x${data:194:64}"
                local sell_tn=$(token_name "$sell_token")
                local buy_tn=$(token_name "$buy_token")
                local sell_amt=$(fmt_token "$sell_token" "$sell_amount_hex")
                local buy_amt=$(fmt_token "$buy_token" "$buy_amount_hex")
                log "[TRADE] tradeId=$trade_id | Issuers instructed AP: sell $sell_amt $sell_tn → buy $buy_amt $buy_tn | chain=$chain"
            else
                log "[TRADE] tradeId=$trade_id | Issuers instructed AP to execute trade | chain=$chain"
            fi
            ;;

        "$STABLE_SWAP_TOPIC")
            local from_token=$(echo "$topics_json" | jq -r '.[1]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local to_token=$(echo "$topics_json" | jq -r '.[2]' 2>/dev/null | sed 's/0x000000000000000000000000/0x/')
            local from_tn=$(token_name "$from_token")
            local to_tn=$(token_name "$to_token")
            local amount=$(fmt6 "$data")
            log "[SWAP] Issuers instructed AP: $from_tn→$to_tn | amount=$amount | chain=$chain"
            ;;
    esac
}

# Process all logs from a transaction receipt
process_tx() {
    local tx_hash=$1
    local receipt=$(cast receipt "$tx_hash" --rpc-url "$RPC_URL" --json 2>/dev/null)
    [ -z "$receipt" ] && return

    echo "$receipt" | jq -c '.logs[]' 2>/dev/null | while read -r entry; do
        local topic0=$(echo "$entry" | jq -r '.topics[0]')
        local topics=$(echo "$entry" | jq -c '.topics')
        local data=$(echo "$entry" | jq -r '.data')
        local emitter=$(echo "$entry" | jq -r '.address')
        parse_log_entry "$topic0" "$topics" "$data" "$emitter"
    done
}

# ============================================
# BALANCE SNAPSHOTS
# ============================================

balance_snapshot() {
    local label="$1"
    log ""
    log "┌─── BALANCES: $label ───"

    # User
    local u_arb=$(cast call "$ARB_USDC" "balanceOf(address)(uint256)" "$USER" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    local u_l3=$(cast call "$L3_USDC" "balanceOf(address)(uint256)" "$USER" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    log "│  User:         ARB_USDC=$(fmt6 "$u_arb")  L3_WUSDC=$(fmt18 "$u_l3")"

    # ArbBridgeCustody
    local ac_arb=$(cast call "$ARB_USDC" "balanceOf(address)(uint256)" "$ARB_CUSTODY" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    log "│  ArbCustody:   ARB_USDC=$(fmt6 "$ac_arb")"

    # Index
    local idx_l3=$(cast call "$L3_USDC" "balanceOf(address)(uint256)" "$INDEX" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    log "│  Index:        L3_WUSDC=$(fmt18 "$idx_l3")"

    # MockBitgetVault
    local v_btc=$(cast call "$BTC_ADDR" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    local v_eth=$(cast call "$ETH_ADDR" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    local v_usdt=$(cast call "$MOCK_USDT" "balanceOf(address)(uint256)" "$VAULT" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    log "│  Vault:        BTC=$(fmt18 "$v_btc")  ETH=$(fmt18 "$v_eth")  USDT=$(fmt6 "$v_usdt")"

    # AP
    local ap_btc=$(cast call "$BTC_ADDR" "balanceOf(address)(uint256)" "$AP" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    local ap_eth=$(cast call "$ETH_ADDR" "balanceOf(address)(uint256)" "$AP" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    log "│  AP:           BTC=$(fmt18 "$ap_btc")  ETH=$(fmt18 "$ap_eth")"

    # ITP shares for issuer signers (share holders from buy flow)
    local s1_shares=$(cast storage "$INDEX" "$(cast index bytes32 "$(cast index address "$ISSUER_SIGNER_1" 18)" "$ITP_ID")" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x0")
    log "│  IssuerSigner1 ITP shares: $(fmt18 "$s1_shares")"

    log "└────────────────────────────"
    log ""
}

# ============================================
# MAIN
# ============================================

mkdir -p logs

# Header
log ""
log "╔═══════════════════════════════════════════════════════════════════════╗"
log "║                    E2E MONEY MOVEMENT LOGGER                        ║"
log "╠═══════════════════════════════════════════════════════════════════════╣"
log "║  RPC: $RPC_URL"
log "║  Flow: BUY → REBALANCE → SELL"
log "║"
log "║  Key: Issuers decide USDC→USDT swaps and instruct AP to execute"
log "║       Issuers instruct AP to withdraw from vault"
log "╠═══════════════════════════════════════════════════════════════════════╣"
log "║  Contracts:"
log "║    Index:          $INDEX"
log "║    ArbCustody:     $ARB_CUSTODY"
log "║    L3Custody:      $L3_CUSTODY"
log "║    MockBitgetVault: $VAULT"
log "║    L3_WUSDC:       $L3_USDC (18 dec)"
log "║    ARB_USDC:       $ARB_USDC (6 dec)"
log "║    USDT:           $MOCK_USDT (6 dec)"
log "║    BTC:            $BTC_ADDR"
log "║    ETH:            $ETH_ADDR"
log "║  Accounts:"
log "║    User:           $USER"
log "║    AP:             $AP"
log "║    IssuerSigner1:  $ISSUER_SIGNER_1"
log "╚═══════════════════════════════════════════════════════════════════════╝"

CURRENT_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
log "Starting from block: $CURRENT_BLOCK"

balance_snapshot "INITIAL"

# ============================================
# FOLLOW MODE
# ============================================

if [ "$1" = "--follow" ]; then
    log "Following new blocks..."
    LAST_BLOCK=$CURRENT_BLOCK
    EMPTY_STREAK=0

    while true; do
        sleep 1
        NEW_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "$LAST_BLOCK")

        if [ "$NEW_BLOCK" -gt "$LAST_BLOCK" ]; then
            for block in $(seq $((LAST_BLOCK + 1)) "$NEW_BLOCK"); do
                BLOCK_DATA=$(cast block "$block" --json --rpc-url "$RPC_URL" 2>/dev/null)
                TX_HASHES=$(echo "$BLOCK_DATA" | jq -r '.transactions[]' 2>/dev/null)

                if [ -n "$TX_HASHES" ]; then
                    EMPTY_STREAK=0
                    log ""
                    log "━━━ Block $block ━━━"
                    for tx_hash in $TX_HASHES; do
                        process_tx "$tx_hash"
                    done
                    balance_snapshot "AFTER BLOCK $block"
                else
                    EMPTY_STREAK=$((EMPTY_STREAK + 1))
                fi
            done
            LAST_BLOCK=$NEW_BLOCK
        fi
    done
else
    # One-time scan
    log "Scanning last 50 blocks..."
    START_BLOCK=$((CURRENT_BLOCK - 50))
    [ $START_BLOCK -lt 0 ] && START_BLOCK=0

    for block in $(seq $START_BLOCK "$CURRENT_BLOCK"); do
        BLOCK_DATA=$(cast block "$block" --json --rpc-url "$RPC_URL" 2>/dev/null)
        TX_HASHES=$(echo "$BLOCK_DATA" | jq -r '.transactions[]' 2>/dev/null)

        if [ -n "$TX_HASHES" ]; then
            log ""
            log "━━━ Block $block ━━━"
            for tx_hash in $TX_HASHES; do
                process_tx "$tx_hash"
            done
        fi
    done

    balance_snapshot "FINAL"
    log "Scan complete. Run with --follow to monitor live."
fi
