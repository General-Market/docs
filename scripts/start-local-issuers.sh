#!/bin/bash
# Start 3 issuer nodes for local E2E testing
# Usage: ./scripts/start-local-issuers.sh

set -e

# Load shared Bitget credentials first (if exists)
set -a
if [ -f bitget-credentials.env ]; then
    source bitget-credentials.env
    echo "Loaded Bitget credentials from bitget-credentials.env"
fi
# Load local environment
source issuer-local.env
set +a

# Base ports
BASE_P2P_PORT=9000
BASE_HEALTH_PORT=10000
NUM_ISSUERS=3

# Issuer private keys from index-system.env (use explicit variables to avoid bash array issues)
ISSUER_KEY_1="0x355faf10c89b4aa1c96964b4d7b38ed5844eea436bd1ae8029cb073d3d3355ff"
ISSUER_KEY_2="0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537"
ISSUER_KEY_3="0xd518d48628681d00fe0b35ff9cca3f354e8197eab2ab4b010e1274eccc3e8775"

# Issuer signer addresses (derived from private keys above)
ISSUER_ADDR_1="0xc0d3c9e530ca6d71469bb678e6592274154d9cad"
ISSUER_ADDR_2="0xc0d3ca67da45613e7c5b2d55f09b00b3c99721f4"
ISSUER_ADDR_3="0xc0d3c8dfd3445fd2e4dfed9d11b5b7032b3bd1ac"

# Deployer key (Anvil account 0) for funding
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Build the issuer binary first
echo "Building issuer..."
cargo build --bin issuer --release 2>/dev/null || cargo build --bin issuer

# Fund issuer addresses if they have no ETH
echo "Checking issuer signer balances..."
for i in 1 2 3; do
    eval "ADDR=\$ISSUER_ADDR_$i"
    BALANCE=$(cast balance $ADDR --rpc-url ${ISSUER_RPC_URL} 2>/dev/null || echo "0")
    if [ "$BALANCE" = "0" ] || [ -z "$BALANCE" ]; then
        echo "  Funding Issuer $i ($ADDR) with 10 ETH..."
        cast send $ADDR --value 10ether --private-key $DEPLOYER_KEY --rpc-url ${ISSUER_RPC_URL} > /dev/null 2>&1
    else
        echo "  Issuer $i already funded: $BALANCE wei"
    fi
done

echo "Starting $NUM_ISSUERS issuer nodes for local E2E testing..."

for i in 1 2 3; do
    NODE_ID=$i
    P2P_PORT=$((BASE_P2P_PORT + i - 1))
    HEALTH_PORT=$((BASE_HEALTH_PORT + i - 1))

    # Get the correct key using indirect reference
    eval "PRIVATE_KEY=\$ISSUER_KEY_$i"

    # BLS key seed index (0-based)
    BLS_SEED_IDX=$((i - 1))

    # Generate peers list (all other nodes)
    PEERS=""
    for j in 1 2 3; do
        if [ $j -ne $i ]; then
            [ -n "$PEERS" ] && PEERS="$PEERS,"
            PEERS="${PEERS}127.0.0.1:$((BASE_P2P_PORT + j - 1))"
        fi
    done

    echo "Starting Issuer $NODE_ID (P2P: $P2P_PORT, BLS seed: $BLS_SEED_IDX)"

    ISSUER_NODE_ID=$NODE_ID \
    ISSUER_PORT=$P2P_PORT \
    ISSUER_PRIVATE_KEY="$PRIVATE_KEY" \
    ISSUER_PEERS=$PEERS \
    ISSUER_RPC_URL=${ISSUER_RPC_URL} \
    ISSUER_ARBITRUM_RPC_URL=${ISSUER_ARBITRUM_RPC_URL} \
    ISSUER_INDEX_ADDRESS=${ISSUER_INDEX_ADDRESS} \
    ISSUER_GOVERNANCE_ADDRESS=${ISSUER_GOVERNANCE_ADDRESS} \
    ISSUER_ISSUER_REGISTRY_ADDRESS=${ISSUER_ISSUER_REGISTRY_ADDRESS} \
    ISSUER_COLLATERAL_REGISTRY_ADDRESS=${ISSUER_COLLATERAL_REGISTRY_ADDRESS} \
    ISSUER_BRIDGE_PROXY_ADDRESS=${ISSUER_BRIDGE_PROXY_ADDRESS} \
    ISSUER_BITGET_VAULT=${ISSUER_BITGET_VAULT} \
    ISSUER_MOCK_USDT=${ISSUER_MOCK_USDT} \
    ISSUER_CUSTODY_L3=${ISSUER_CUSTODY_L3:-} \
    ISSUER_ARB_CUSTODY=${ISSUER_ARB_CUSTODY:-} \
    ISSUER_L3_USDC=${ISSUER_L3_USDC:-} \
    ISSUER_ARB_USDC=${ISSUER_ARB_USDC:-} \
    ISSUER_LOG_LEVEL=debug \
    ./target/debug/issuer \
        --chain-id ${ISSUER_ARBITRUM_CHAIN_ID} \
        --num-issuers $NUM_ISSUERS \
        --bls-key-seed-index $BLS_SEED_IDX \
        --test-key-seeds \
        --bridge-proxy ${ISSUER_BRIDGE_PROXY_ADDRESS} \
        > "logs/issuer-${NODE_ID}.log" 2>&1 &

    echo "  PID: $!"
done

echo ""
echo "All issuers started. Logs at:"
echo "  - logs/issuer-1.log"
echo "  - logs/issuer-2.log"
echo "  - logs/issuer-3.log"
echo ""
echo "To stop: pkill -f 'target/debug/issuer'"
