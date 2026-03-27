// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IIndex {
    function getItpCount() external view returns (uint256);
    function itpVaults(bytes32 itpId) external view returns (address);
    function getITPState(bytes32 itpId) external view returns (
        address creator, uint256 totalSupply, uint256 nav,
        address[] memory assets, uint256[] memory weights, uint256[] memory inventory
    );
    function submitOrder(
        bytes32 itpId, uint8 side, uint256 amount, uint256 price,
        uint256 minFillPct, uint256 expiry
    ) external returns (uint256);
    function nextOrderId() external view returns (uint256);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/// @title SubmitBuyOrders — Submit buy orders for ALL ITPs with random amounts
/// @notice Submits buy orders for every ITP (1..itpCount) with random $1-$1000 each.
///         The oracles will process these orders and mint ITP shares to the buyer.
///
///     After oracles process, run SeedBorrows.s.sol to supply collateral + borrow.
contract SubmitBuyOrders is Script {
    uint8 constant SIDE_BUY = 0;
    uint256 constant MIN_AMOUNT = 1e18;    // $1 (18 decimals)
    uint256 constant MAX_AMOUNT = 1000e18; // $1000

    function run() external {
        uint256 key = vm.envOr("DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537));
        address indexAddr = vm.envAddress("INDEX_ADDRESS");
        address usdcAddr = vm.envAddress("USDC_ADDRESS");

        IIndex idx = IIndex(indexAddr);
        address user = vm.addr(key);

        uint256 itpCount = idx.getItpCount();
        console.log("Total ITPs:", itpCount);
        console.log("User:", user);

        // Approve USDC to Index (enough for worst case: 77 * 1000 = 77K)
        vm.startBroadcast(key);
        IERC20(usdcAddr).approve(indexAddr, type(uint256).max);

        uint256 submitted = 0;
        uint256 totalUsdc = 0;

        for (uint256 i = 1; i <= itpCount; i++) {
            bytes32 itpId = bytes32(i);

            // Get NAV — skip if no assets
            (address creator,,,,,) = idx.getITPState(itpId);
            if (creator == address(0)) continue;

            // Random amount: hash(block.timestamp, i) → $1-$1000
            uint256 pseudoRandom = uint256(keccak256(abi.encode(block.timestamp, i, "buy")));
            uint256 amount = MIN_AMOUNT + (pseudoRandom % (MAX_AMOUNT - MIN_AMOUNT));

            uint256 orderId = idx.submitOrder(
                itpId,
                SIDE_BUY,
                amount,
                0, // market price (oracle fills at current NAV)
                1, // minFillPct = 1%
                block.timestamp + 86400 // 24h expiry
            );

            console.log("Order %d ITP %d amount %d", orderId, i, amount / 1e18);
            submitted++;
            totalUsdc += amount;
        }

        vm.stopBroadcast();

        console.log("Submitted", submitted, "buy orders, total USDC:", totalUsdc / 1e18);
        console.log("Wait for oracle consensus, then run SeedBorrows.");
    }
}
