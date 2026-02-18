#!/bin/bash
set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

RPC_URL="${RPC_URL:-http://localhost:8545}"
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
USER_KEY="0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
USER_ADDR="0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"

mkdir -p logs
LOG="logs/money-movements.log"

out() { echo "$1"; echo "$1" >> "$LOG"; }

get_bal() { cast call "$1" "balanceOf(address)(uint256)" "$2" --rpc-url "$RPC_URL" 2>/dev/null || echo "0"; }
fmt6() { echo "scale=2; $1 / 1000000" | bc 2>/dev/null || echo "$1"; }
fmt18() { echo "scale=2; $1 / 1000000000000000000" | bc 2>/dev/null || echo "$1"; }

echo "# E2E Money Movement Log" > "$LOG"
out "---"

# Deploy
out "Deploying..."
cd contracts
forge script script/DeployFullSystemE2E.s.sol:DeployFullSystemE2E --rpc-url "$RPC_URL" --broadcast --skip-simulation -vvv 2>&1 | tee ../logs/deploy.log
cd ..

# Load addresses
INDEX=$(jq -r '.contracts.Index' deployments/e2e-full-system.json)
ARB_CUSTODY=$(jq -r '.contracts.ArbBridgeCustody' deployments/e2e-full-system.json)
VAULT=$(jq -r '.contracts.MockBitgetVault' deployments/e2e-full-system.json)
L3_USDC=$(jq -r '.contracts.L3_WUSDC' deployments/e2e-full-system.json)
ARB_USDC=$(jq -r '.contracts.ARB_USDC' deployments/e2e-full-system.json)
ITP_ID=$(jq -r '.contracts.itpId' deployments/e2e-full-system.json)

out "Index: $INDEX"
out "ARB_USDC: $ARB_USDC"

# Step 1: User buy
out ""
out "=== STEP 1: User locks USDC in custody ==="
cast send "$ARB_USDC" "approve(address,uint256)" "$ARB_CUSTODY" "1000000000" --private-key "$USER_KEY" --rpc-url "$RPC_URL" > /dev/null 2>&1
DEADLINE=$(($(date +%s) + 3600))
cast send "$ARB_CUSTODY" "buyITPFromArbitrum(bytes32,uint256,uint256,uint256,uint256)" "$ITP_ID" "1000000000" "1000000000000000000" "1" "$DEADLINE" --private-key "$USER_KEY" --rpc-url "$RPC_URL" > /dev/null 2>&1 || true

out "User ARB_USDC: $(fmt6 $(get_bal $ARB_USDC $USER_ADDR))"
out "Custody ARB_USDC: $(fmt6 $(get_bal $ARB_USDC $ARB_CUSTODY))"

# Step 2: Bridge simulation
out ""
out "=== STEP 2: Bridge Arb -> L3 ==="
cast send "$L3_USDC" "mint(address,uint256)" "$USER_ADDR" "1000000000000000000000" --private-key "$DEPLOYER_KEY" --rpc-url "$RPC_URL" > /dev/null 2>&1
out "User L3_USDC: $(fmt18 $(get_bal $L3_USDC $USER_ADDR))"

# Step 3: Submit order
out ""
out "=== STEP 3: Submit order ==="
cast send "$L3_USDC" "approve(address,uint256)" "$INDEX" "1000000000000000000000" --private-key "$USER_KEY" --rpc-url "$RPC_URL" > /dev/null 2>&1
cast send "$INDEX" "submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)" "$ITP_ID" "0" "1000000000000000000000" "1000000000000000000" "1" "$DEADLINE" --private-key "$USER_KEY" --rpc-url "$RPC_URL" 2>&1 || echo "Order failed"

out "Index L3_USDC: $(fmt18 $(get_bal $L3_USDC $INDEX))"

out ""
out "=== DONE ==="
out "Log: $LOG"
