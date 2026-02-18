#!/bin/bash
set -euo pipefail

# Propose initial whitelist targets for BLSCustody on a given chain
# Story 6.6: Multi-chain whitelist setup
#
# This script proposes whitelist targets (1inch Router V6 + USDC) for a deployed BLSCustody.
# After proposal, a 2-day timelock must expire before targets can be activated.
#
# IMPORTANT:
#   - Whitelist activation requires a SEPARATE call to activateWhitelist() after 2 days.
#   - proposeWhitelist() requires BLS signature verification. With an empty aggregated
#     pubkey (Phase 1 / fresh IssuerRegistry), verification is skipped.
#   - If IssuerRegistry has a non-empty aggregated pubkey, set SKIP_WHITELIST=true
#     and propose whitelist via the issuer network's BLS-signed transaction.
#
# SECURITY: This script passes private keys via --private-key CLI argument,
# which may be visible in process listings (ps aux). For production deployments,
# prefer --keystore (encrypted keyfile) or --ledger / --trezor (hardware wallet).
#
# 1inch Aggregation Router V6 addresses (same on all EVM chains):
#   0x111111125421cA6dc452d289314280a0f8842A65
#
# USDC addresses per chain:
#   Ethereum: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
#   Base:     0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
#   Optimism: 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
#   Arbitrum: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831

# Validate required environment variables
: "${RPC_URL:?RPC_URL is required}"
: "${BLSCUSTODY_ADDRESS:?BLSCUSTODY_ADDRESS is required}"
: "${CHAIN:?CHAIN is required (ethereum|base|optimism)}"

# Wallet configuration for cast transactions
# Override with WALLET_OPTS for hardware wallets or keystores:
#   WALLET_OPTS="--keystore /path/to/keystore" ./scripts/setup-whitelist.sh
#   WALLET_OPTS="--ledger" ./scripts/setup-whitelist.sh
if [ -z "${WALLET_OPTS:-}" ]; then
    : "${PRIVATE_KEY:?PRIVATE_KEY is required (or set WALLET_OPTS for --keystore/--ledger)}"
    WALLET_OPTS="--private-key $PRIVATE_KEY"
fi

# 1inch Router V6 - same address on all chains
ONEINCH_ROUTER="0x111111125421cA6dc452d289314280a0f8842A65"

# Chain-specific USDC
case "$CHAIN" in
    ethereum)
        USDC_ADDRESS="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        ;;
    base)
        USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        ;;
    optimism)
        USDC_ADDRESS="0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
        ;;
    arbitrum)
        USDC_ADDRESS="0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
        ;;
    *)
        echo "ERROR: Unknown chain '$CHAIN'. Use: ethereum, base, optimism, or arbitrum"
        exit 1
        ;;
esac

echo "============================================"
echo "Proposing Whitelist Targets"
echo "Chain: $CHAIN"
echo "BLSCustody: $BLSCUSTODY_ADDRESS"
echo "============================================"
echo ""
echo "Targets:"
echo "  1inch Router V6: $ONEINCH_ROUTER"
echo "  USDC ($CHAIN):   $USDC_ADDRESS"
echo ""

# proposeWhitelist(address target, bytes blsSignature)
# Function selector: proposeWhitelist(address,bytes)
# With empty BLS signature (Phase 1: aggregated pubkey is empty, verification skipped)

echo "Proposing 1inch Router V6..."
cast send "$BLSCUSTODY_ADDRESS" \
    "proposeWhitelist(address,bytes)" \
    "$ONEINCH_ROUTER" \
    "0x" \
    $WALLET_OPTS \
    --rpc-url "$RPC_URL"

echo ""
echo "Proposing USDC..."
cast send "$BLSCUSTODY_ADDRESS" \
    "proposeWhitelist(address,bytes)" \
    "$USDC_ADDRESS" \
    "0x" \
    $WALLET_OPTS \
    --rpc-url "$RPC_URL"

echo ""
echo "============================================"
echo "Whitelist proposals submitted."
echo ""
echo "NEXT STEPS:"
echo "  1. Wait 2 days (172800 seconds) for timelock to expire"
echo "  2. Activate each target:"
echo "     cast send $BLSCUSTODY_ADDRESS 'activateWhitelist(address)' $ONEINCH_ROUTER \$WALLET_OPTS --rpc-url \$RPC_URL"
echo "     cast send $BLSCUSTODY_ADDRESS 'activateWhitelist(address)' $USDC_ADDRESS \$WALLET_OPTS --rpc-url \$RPC_URL"
echo "============================================"
