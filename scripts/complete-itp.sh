#!/bin/bash
# Complete ITP creation manually for E2E testing
# This uses a hardcoded BLS signature from the deterministic test key

set -e

RPC_URL="https://index.rpc.zeeve.net"
BRIDGE_PROXY="0xfBaBC11c9F238556880589b092fb199AF273849B"
DEPLOYER_KEY="0x4b3b08e6572b6fc14645a57933b20102e280f25a7372850b2c2ddb63adcb0fee"

# Nonce 0 ITP details
NONCE=0
ORBIT_ITP_ID="0x0000000000000000000000000000000000000000000000000000000000000001"

# Signer bitmap: only issuer 0 signed (bit 0 = 1)
SIGNER_BITMAP=1

# Issuer 0's BLS public key (128 bytes G2 point)
AGGREGATED_PUBKEY="0x1d2ff4c9240e3300c4d21ac229ce6e4f497f78646be9de627d0aaa658a03ff041a049d7ae5b0a0297dc15a2fcff8eadc8d6678dcd46467fbb9a68ec1eda40ae419ca761b3fb008a7b4e4f61c9b87f432972eecacb4c6ce119cf03d8207b532f1018db167388d90af87cca6bf9fdbe7ab6205a0af40b5b826738481f2f3057f29"

# BLS signature (64 bytes G1 point) - this needs to be generated
# For now using a placeholder - actual signature needs BLS signing
SIGNATURE="0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

echo "=== Completing ITP Creation ==="
echo "Nonce: $NONCE"
echo "Orbit ITP ID: $ORBIT_ITP_ID"
echo "Signer Bitmap: $SIGNER_BITMAP"

# First check if still pending
echo ""
echo "Checking pending status..."
cast call $BRIDGE_PROXY "getPendingCreation(uint256)(address,string,string,uint256[],address[],uint64,bool)" $NONCE --rpc-url $RPC_URL

# Note: This will fail without a valid BLS signature
# The actual completion requires signing the message:
# keccak256(abi.encodePacked(chainId, bridgeProxy, admin, nonce, orbitItpId))

echo ""
echo "To complete manually, run the Rust test that generates the signature:"
echo "cd issuer && cargo test test_generate_completion_signature -- --nocapture"
