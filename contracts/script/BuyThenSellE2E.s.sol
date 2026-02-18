// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IIndex.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BuyThenSellE2E is Script {
    IIndex index = IIndex(0x0B306BF915C4d645ff596e518fAf3F9669b97016);
    IERC20 usdc = IERC20(0x5FbDB2315678afecb367f032d93F642f64180aa3);
    address user = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    uint256 userKey = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
    uint256 deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        bytes32 itpId = bytes32(uint256(4));
        uint256 buyAmount = 50e18; // 50 USDC
        uint256 fillPrice = 50000e18; // $50k per share

        // Step 1: Initial state
        console.log("=== BUY then SELL E2E ===");
        uint256 usdcBefore = usdc.balanceOf(user);
        console.log("User USDC before:", usdcBefore);

        // Step 2: Submit BUY order
        console.log("\n--- BUY Phase ---");
        vm.startBroadcast(userKey);
        uint256 buyOrderId = index.submitOrder(
            itpId, TypesLib.Side.BUY, buyAmount, fillPrice, 1, block.timestamp + 3600
        );
        console.log("BUY order ID:", buyOrderId);
        vm.stopBroadcast();

        // Process BUY
        uint256 buyCycle = 4000000;
        vm.startBroadcast(deployerKey);
        uint256[] memory buyIds = new uint256[](1);
        buyIds[0] = buyOrderId;
        bytes memory sig = new bytes(64);

        index.confirmBatch(buyCycle, buyIds, sig);

        TypesLib.Fill[] memory buyFills = new TypesLib.Fill[](1);
        buyFills[0] = TypesLib.Fill({
            orderId: buyOrderId, fillPrice: fillPrice, fillAmount: buyAmount, cycleNumber: buyCycle, txHash: bytes32(0)
        });
        index.confirmFills(buyCycle, buyFills, sig);
        vm.stopBroadcast();

        console.log("BUY processed. Status:", uint256(index.getOrder(buyOrderId).status));

        // Calculate shares: 50 USDC at $50k = 0.001 shares
        uint256 sharesFromBuy = (buyAmount * 1e18) / fillPrice;
        console.log("Shares from BUY:", sharesFromBuy);

        // Total shares now = existing 0.0002 + new 0.001 = 0.0012
        uint256 totalShares = 200000000000000 + sharesFromBuy;
        console.log("Total shares:", totalShares);

        // Step 3: Submit SELL order for all shares
        console.log("\n--- SELL Phase ---");
        vm.startBroadcast(userKey);
        uint256 sellOrderId = index.submitOrder(
            itpId, TypesLib.Side.SELL, totalShares, fillPrice, 1, block.timestamp + 3600
        );
        console.log("SELL order ID:", sellOrderId);
        vm.stopBroadcast();

        // Process SELL
        uint256 sellCycle = 5000000;
        vm.startBroadcast(deployerKey);
        uint256[] memory sellIds = new uint256[](1);
        sellIds[0] = sellOrderId;

        index.confirmBatch(sellCycle, sellIds, sig);

        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](1);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId, fillPrice: fillPrice, fillAmount: totalShares, cycleNumber: sellCycle, txHash: bytes32(0)
        });
        index.confirmFills(sellCycle, sellFills, sig);
        vm.stopBroadcast();

        console.log("SELL processed. Status:", uint256(index.getOrder(sellOrderId).status));

        // Step 4: Final verification
        console.log("\n--- Final State ---");
        uint256 usdcAfter = usdc.balanceOf(user);
        console.log("User USDC after:", usdcAfter);
        console.log("USDC change:", int256(usdcAfter) - int256(usdcBefore));

        // Net USDC change should be 0: bought 50 USDC worth, sold 60 USDC worth (0.0012 shares at $50k)
        // Actually: bought 50 USDC (got 0.001 shares), sold 0.0012 shares (got 60 USDC)
        // Net = -50 (from BUY escrow) + 60 (from SELL) = +10 USDC profit from existing 0.0002 shares
        console.log("Expected net change: +10 USDC (from pre-existing 0.0002 shares)");

        console.log("\n=== BUY then SELL E2E Complete ===");
    }
}
