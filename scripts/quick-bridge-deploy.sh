#!/bin/bash
set -e

RPC="https://index.rpc.zeeve.net"
KEY="0x4b3b08e6572b6fc14645a57933b20102e280f25a7372850b2c2ddb63adcb0fee"
ISSUER_REG="0xae3DcC43AC2E735C43b2a2bCd9C25FcA00441785"
INDEX="0xeD31026718e15Ffcff000831dD568a351354ADC2"
ADMIN="0xC0D3Cb0c97CbF87F103a9901100D8f6D3e94D42A"

cd /Users/maxguillabert/Desktop/index/contracts

echo "=== Step 1: Deploy BridgeProxy Implementation ==="
BRIDGE_IMPL=$(forge create src/bridge/BridgeProxy.sol:BridgeProxy \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy \
    --json | jq -r '.deployedTo')
echo "BridgeProxy impl: $BRIDGE_IMPL"

echo "=== Step 2: Deploy ERC1967Proxy for BridgeProxy ==="
INIT_DATA=$(cast calldata "initialize(address,address,address)" "$ISSUER_REG" "0x0000000000000000000000000000000000000000" "$ADMIN")
BRIDGE_PROXY=$(forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy \
    --constructor-args "$BRIDGE_IMPL" "$INIT_DATA" \
    --json | jq -r '.deployedTo')
echo "BridgeProxy proxy: $BRIDGE_PROXY"

echo "=== Step 3: Deploy BridgedItpFactory ==="
FACTORY=$(forge create src/bridge/BridgedItpFactory.sol:BridgedItpFactory \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy \
    --constructor-args "$BRIDGE_PROXY" \
    --json | jq -r '.deployedTo')
echo "BridgedItpFactory: $FACTORY"

echo "=== Step 4: Set Factory on BridgeProxy ==="
cast send "$BRIDGE_PROXY" "setBridgedItpFactory(address)" "$FACTORY" \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy

echo "=== Step 5: Set Index Contract on BridgeProxy ==="
cast send "$BRIDGE_PROXY" "setIndexContract(address)" "$INDEX" \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy

echo "=== Step 5b: Set Signer Threshold to 2 ==="
cast send "$BRIDGE_PROXY" "setSignerThreshold(uint256)" 2 \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy

echo "=== Step 5c: Set Authorized Bridge on Index ==="
cast send "$INDEX" "setAuthorizedBridge(address)" "$BRIDGE_PROXY" \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy

echo "=== Step 6: Deploy MockBitgetVault ==="
VAULT=$(forge create src/mocks/MockBitgetVault.sol:MockBitgetVault \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy \
    --json | jq -r '.deployedTo')
echo "MockBitgetVault: $VAULT"

echo "=== Step 7: Initialize MockBitgetVault ==="
cast send "$VAULT" "initialize(address)" "$ADMIN" \
    --rpc-url "$RPC" \
    --private-key "$KEY" \
    --legacy

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "BridgeProxy: $BRIDGE_PROXY"
echo "BridgedItpFactory: $FACTORY"
echo "MockBitgetVault: $VAULT"

# Save to file
cat > ../deployments/e2e-bridge-new.json << EOF
{
  "chainId": 111222333,
  "BridgeProxy": "$BRIDGE_PROXY",
  "BridgedItpFactory": "$FACTORY",
  "MockBitgetVault": "$VAULT",
  "IssuerRegistry": "$ISSUER_REG",
  "Index": "$INDEX"
}
EOF
echo "Saved to deployments/e2e-bridge-new.json"
