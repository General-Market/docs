// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IInvestment.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ManualE2E is Script {
    IInvestment index;
    address user;
    uint256 deployerKey;

    function run() external {
        index = IInvestment(vm.envAddress("INDEX_ADDRESS"));
        user = vm.envAddress("USER_ADDRESS");
        deployerKey = vm.envUint("DEPLOYER_KEY");
        console.log("=== Manual E2E Flow ===");
        
        // Use a high cycle number that hasn't been processed
        uint256 cycleNumber = 999999;
        
        // Step 1: Check pending orders
        console.log("\n--- Step 1: Check order 3 ---");
        TypesLib.LimitOrder memory order3 = index.getOrder(3);
        console.log("Order 3 status:", uint256(order3.status)); // 0=PENDING
        console.log("Order 3 ITP ID:", uint256(order3.itpId));
        console.log("Order 3 amount:", order3.amount);
        
        // Step 2: Call confirmBatch with order 3
        console.log("\n--- Step 2: Confirm batch with order 3 ---");
        vm.startBroadcast(deployerKey);
        
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = 3;
        
        // Empty sig works in testing mode when issuerRegistry.getAggregatedPubkey() returns empty bytes
        bytes memory emptySignature = new bytes(64);
        
        index.confirmBatch(cycleNumber, orderIds, emptySignature);
        console.log("confirmBatch succeeded for cycle", cycleNumber);
        
        // Check order status after batch
        TypesLib.LimitOrder memory orderAfterBatch = index.getOrder(3);
        console.log("Order 3 status after batch:", uint256(orderAfterBatch.status)); // 1=BATCHED
        
        // Step 3: Call confirmFills with fill for order 3
        console.log("\n--- Step 3: Confirm fills for order 3 ---");
        
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: 3,
            fillPrice: 50000e18, // $50,000 per share
            fillAmount: order3.amount, // Fill entire amount
            cycleNumber: cycleNumber,
            txHash: bytes32(0) // Empty for testing
        });
        
        index.confirmFills(cycleNumber, fills, emptySignature);
        console.log("confirmFills succeeded for cycle", cycleNumber);
        
        vm.stopBroadcast();
        
        // Step 4: Verify results
        console.log("\n--- Step 4: Verify final state ---");
        TypesLib.LimitOrder memory orderFinal = index.getOrder(3);
        console.log("Order 3 final status:", uint256(orderFinal.status)); // 2=FILLED
        
        // Calculate expected shares: amount / fillPrice * 1e18
        uint256 expectedShares = (order3.amount * 1e18) / 50000e18;
        console.log("Expected shares (50 USDC at $50k/share):", expectedShares);
        
        console.log("\n=== E2E BUY Flow Complete ===");
        console.log("Order 3 processed: PENDING -> BATCHED -> FILLED");
    }
}
