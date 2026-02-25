// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IInvestment.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SellE2E is Script {
    IInvestment index;
    IERC20 usdc;
    address user;
    uint256 userKey;
    uint256 deployerKey;

    function run() external {
        index = IInvestment(vm.envAddress("INDEX_ADDRESS"));
        usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
        user = vm.envAddress("USER_ADDRESS");
        userKey = vm.envUint("USER_KEY");
        deployerKey = vm.envUint("DEPLOYER_KEY");
        console.log("=== SELL Order E2E Flow ===");
        
        bytes32 itpId = bytes32(uint256(4));
        uint256 sellAmount = 1000000000000000; // 0.001 shares (in USDC equivalent: 50 USDC value)
        
        // Step 1: Get user's USDC balance before
        uint256 usdcBefore = usdc.balanceOf(user);
        console.log("\n--- Step 1: Initial state ---");
        console.log("User USDC before:", usdcBefore);
        
        // Step 2: Submit SELL order
        console.log("\n--- Step 2: Submit SELL order ---");
        vm.startBroadcast(userKey);
        
        uint256 orderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            sellAmount, // Amount to sell
            50000e18, // Limit price $50,000
            1, // slippageTier
            block.timestamp + 3600
        );
        console.log("SELL order submitted with ID:", orderId);
        vm.stopBroadcast();
        
        // Step 3: Verify order is PENDING
        TypesLib.LimitOrder memory sellOrder = index.getOrder(orderId);
        console.log("Order status:", uint256(sellOrder.status)); // 0=PENDING
        console.log("Order side:", uint256(sellOrder.side)); // 1=SELL
        
        // Step 4: Process the SELL order through confirmBatch and confirmFills
        console.log("\n--- Step 4: Process SELL order ---");
        uint256 cycleNumber = 1000000;
        
        vm.startBroadcast(deployerKey);
        
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        // Empty sig works in testing mode when issuerRegistry.getAggregatedPubkey() returns empty bytes
        bytes memory emptySignature = new bytes(64);
        
        index.confirmBatch(cycleNumber, orderIds, emptySignature, 3, 7);
        console.log("confirmBatch succeeded");
        
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 50000e18, // $50,000 per share
            fillAmount: sellAmount,
            cycleNumber: cycleNumber,
            txHash: bytes32(0)
        });
        
        index.confirmFills(cycleNumber, fills, emptySignature, 3, 7);
        console.log("confirmFills succeeded");
        
        vm.stopBroadcast();
        
        // Step 5: Verify results
        console.log("\n--- Step 5: Verify results ---");
        TypesLib.LimitOrder memory orderFinal = index.getOrder(orderId);
        console.log("Order final status:", uint256(orderFinal.status)); // 2=FILLED
        
        uint256 usdcAfter = usdc.balanceOf(user);
        console.log("User USDC after:", usdcAfter);
        console.log("USDC received:", usdcAfter - usdcBefore);
        
        console.log("\n=== SELL E2E Flow Complete ===");
        console.log("User sold ITP shares and received USDC back");
    }
}
