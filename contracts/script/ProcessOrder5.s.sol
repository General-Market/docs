// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IIndex.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ProcessOrder5 is Script {
    IIndex index = IIndex(0x0B306BF915C4d645ff596e518fAf3F9669b97016);
    address user = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        console.log("=== Process Order 5 E2E ===");

        // Use a new high cycle number that hasn't been processed
        uint256 cycleNumber = 2000000;

        // Step 1: Check Order 5
        console.log("\n--- Step 1: Check order 5 ---");
        TypesLib.LimitOrder memory order5 = index.getOrder(5);
        console.log("Order 5 status:", uint256(order5.status));
        console.log("Order 5 side:", uint256(order5.side)); // 0=BUY
        console.log("Order 5 amount:", order5.amount);
        console.log("Order 5 ITP:", uint256(order5.itpId));

        require(order5.status == TypesLib.OrderStatus.PENDING, "Order 5 must be PENDING");

        // Step 2: Call confirmBatch
        console.log("\n--- Step 2: Confirm batch ---");
        vm.startBroadcast(deployerKey);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = 5;

        bytes memory emptySignature = new bytes(64);

        index.confirmBatch(cycleNumber, orderIds, emptySignature);
        console.log("confirmBatch succeeded for cycle", cycleNumber);

        // Step 3: Call confirmFills
        console.log("\n--- Step 3: Confirm fills ---");

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: 5,
            fillPrice: 50000e18, // $50,000 per share
            fillAmount: order5.amount,
            cycleNumber: cycleNumber,
            txHash: bytes32(0)
        });

        index.confirmFills(cycleNumber, fills, emptySignature);
        console.log("confirmFills succeeded");

        vm.stopBroadcast();

        // Step 4: Verify
        console.log("\n--- Step 4: Verify ---");
        TypesLib.LimitOrder memory orderFinal = index.getOrder(5);
        console.log("Order 5 final status:", uint256(orderFinal.status)); // 2=FILLED

        // Calculate shares
        uint256 shares = (order5.amount * 1e18) / 50000e18;
        console.log("Expected shares (10 USDC at $50k):", shares);

        console.log("\n=== Order 5 BUY Flow Complete ===");
    }
}
