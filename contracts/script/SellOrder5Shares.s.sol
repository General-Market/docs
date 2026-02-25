// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IInvestment.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SellOrder5Shares is Script {
    IInvestment index = IInvestment(0x0B306BF915C4d645ff596e518fAf3F9669b97016);
    IERC20 usdc = IERC20(0x5FbDB2315678afecb367f032d93F642f64180aa3);
    address user = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    uint256 userKey = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
    uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        console.log("=== SELL Order 5 Shares E2E ===");

        bytes32 itpId = bytes32(uint256(4));
        // Order 3 + Order 5 total shares: 0.001 + 0.0002 = 0.0012 shares
        uint256 sellAmount = 1200000000000000;

        // Step 1: Check user's USDC before
        uint256 usdcBefore = usdc.balanceOf(user);
        console.log("\n--- Step 1: Initial state ---");
        console.log("User USDC before:", usdcBefore);
        console.log("Sell amount (shares):", sellAmount);

        // Step 2: Submit SELL order
        console.log("\n--- Step 2: Submit SELL order ---");
        vm.startBroadcast(userKey);

        uint256 orderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            sellAmount,
            50000e18, // Limit price $50,000
            1,
            block.timestamp + 3600
        );
        console.log("SELL order submitted with ID:", orderId);
        vm.stopBroadcast();

        // Step 3: Process the SELL order
        console.log("\n--- Step 3: Process SELL order ---");
        uint256 cycleNumber = 3000000;

        vm.startBroadcast(deployerKey);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        bytes memory emptySignature = new bytes(64);

        index.confirmBatch(cycleNumber, orderIds, emptySignature, 3, 7);
        console.log("confirmBatch succeeded");

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 50000e18,
            fillAmount: sellAmount,
            cycleNumber: cycleNumber,
            txHash: bytes32(0)
        });

        index.confirmFills(cycleNumber, fills, emptySignature, 3, 7);
        console.log("confirmFills succeeded");

        vm.stopBroadcast();

        // Step 4: Verify
        console.log("\n--- Step 4: Verify ---");
        TypesLib.LimitOrder memory orderFinal = index.getOrder(orderId);
        console.log("Order final status:", uint256(orderFinal.status)); // 2=FILLED

        uint256 usdcAfter = usdc.balanceOf(user);
        console.log("User USDC after:", usdcAfter);
        console.log("USDC received:", usdcAfter - usdcBefore);

        // Expected: 0.0012 shares * $50,000 = 60 USDC (60e18)
        console.log("Expected USDC return: 60e18 (60 USDC)");

        console.log("\n=== SELL Flow Complete ===");
    }
}
