#!/bin/bash
# Register correct BLS pubkeys for test issuers
# This script removes existing issuers and re-adds them with the deterministic test BLS keys

set -e

RPC_URL="${RPC_URL:-http://localhost:8545}"
ISSUER_REGISTRY="${ISSUER_REGISTRY:-0x5fc8d32690cc91d4c39d9d3abcbd16989f875707}"

# Admin private key (Anvil account #0)
ADMIN_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Issuer addresses (Anvil accounts #1, #2, #3)
ISSUER_ADDR_0="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
ISSUER_ADDR_1="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
ISSUER_ADDR_2="0x90F79bf6EB2c4f870365E785982E1f101E93b906"

# BLS pubkeys from deterministic test seeds (128 bytes each for G2 points)
# Generated with: cargo test -p issuer --lib test_print_bls_pubkeys -- --nocapture
PUBKEY_0="0x1d2ff4c9240e3300c4d21ac229ce6e4f497f78646be9de627d0aaa658a03ff041a049d7ae5b0a0297dc15a2fcff8eadc8d6678dcd46467fbb9a68ec1eda40ae419ca761b3fb008a7b4e4f61c9b87f432972eecacb4c6ce119cf03d8207b532f1018db167388d90af87cca6bf9fdbe7ab6205a0af40b5b826738481f2f3057f29"
PUBKEY_1="0x10e20474c38c6b4bf1d143bfbf4d3289892b2577c4f925add34e6341c50895e116a9e979e182d2d1aaa4fdcc70e5dd285205db9dc4354e16956e808e0548d3970c1881bd3ca8b715d32bc3ba5d843af164a9ec2311a9bfdf1a02811afa1a97b829eb89f05c19a701fb95ce227ec70c1ba8001d261eaf752487ebf2289fdbd391"
PUBKEY_2="0x1a741e18e79359dc18519926556d3f549676bd0d01640b55c513f0c9cfef20851c3d07978a2bc9e33a7fd0149183662f3efc43a8dcfe9d753a76c538859cce792e072b916d90700bdc809b348a1dd2e71e63faf24e041af43c6b96da44e20f41133f3cc3fbe1acecc601211d05836ba2b2a0831ae5c1b4650475f83c42f0ef7e"

# IP identifiers (arbitrary for local testing)
IP_0="0x6973737565723030312e696e6465782e6c6f63616c0000000000000000000000"
IP_1="0x6973737565723030322e696e6465782e6c6f63616c0000000000000000000000"
IP_2="0x6973737565723030332e696e6465782e6c6f63616c0000000000000000000000"

echo "=== Registering Test BLS Keys ==="
echo "RPC: $RPC_URL"
echo "IssuerRegistry: $ISSUER_REGISTRY"
echo ""

# Check current issuer count
CURRENT_COUNT=$(cast call $ISSUER_REGISTRY "activeIssuerCount()(uint256)" --rpc-url $RPC_URL)
echo "Current active issuers: $CURRENT_COUNT"

# Remove existing issuers if any
echo ""
echo "--- Removing existing issuers ---"
for i in 0 1 2; do
    # Check if issuer exists and is active
    STATUS=$(cast call $ISSUER_REGISTRY "getIssuer(uint256)((address,bytes32,bytes,uint256))" $i --rpc-url $RPC_URL 2>/dev/null | grep -o '0x[a-fA-F0-9]*' | head -1 || echo "0x0000000000000000000000000000000000000000")
    if [ "$STATUS" != "0x0000000000000000000000000000000000000000" ]; then
        echo "Removing issuer $i..."
        cast send $ISSUER_REGISTRY "removeIssuer(uint256)" $i --private-key $ADMIN_KEY --rpc-url $RPC_URL > /dev/null 2>&1 || echo "  (already removed or not active)"
    fi
done

# Add issuers with correct BLS pubkeys
echo ""
echo "--- Adding issuers with test BLS keys ---"

echo "Adding issuer 0 (${ISSUER_ADDR_0})..."
cast send $ISSUER_REGISTRY "addIssuer(address,bytes32,bytes)" \
    $ISSUER_ADDR_0 $IP_0 $PUBKEY_0 \
    --private-key $ADMIN_KEY --rpc-url $RPC_URL > /dev/null
echo "  Done"

echo "Adding issuer 1 (${ISSUER_ADDR_1})..."
cast send $ISSUER_REGISTRY "addIssuer(address,bytes32,bytes)" \
    $ISSUER_ADDR_1 $IP_1 $PUBKEY_1 \
    --private-key $ADMIN_KEY --rpc-url $RPC_URL > /dev/null
echo "  Done"

echo "Adding issuer 2 (${ISSUER_ADDR_2})..."
cast send $ISSUER_REGISTRY "addIssuer(address,bytes32,bytes)" \
    $ISSUER_ADDR_2 $IP_2 $PUBKEY_2 \
    --private-key $ADMIN_KEY --rpc-url $RPC_URL > /dev/null
echo "  Done"

# Verify
echo ""
echo "--- Verification ---"
NEW_COUNT=$(cast call $ISSUER_REGISTRY "activeIssuerCount()(uint256)" --rpc-url $RPC_URL)
echo "Active issuers: $NEW_COUNT"

echo ""
echo "Registered pubkeys:"
for i in 0 1 2; do
    RESULT=$(cast call $ISSUER_REGISTRY "getIssuer(uint256)((address,bytes32,bytes,uint256))" $i --rpc-url $RPC_URL 2>/dev/null)
    ADDR=$(echo "$RESULT" | grep -o '0x[a-fA-F0-9]\{40\}' | head -1)
    echo "  Issuer $i: $ADDR"
done

echo ""
echo "=== Done ==="
