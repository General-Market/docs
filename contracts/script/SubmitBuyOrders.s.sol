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

/// @title SubmitBuyOrders — Submit buy orders for multiple ITPs to seed vault token balances
/// @notice Submits buy orders for up to MAX_ORDERS ITPs that have vault tokens (batch markets).
///         The oracles will process these orders and mint ITP vault tokens to the buyer.
///
///     After oracles process, run SeedBorrows.s.sol to supply collateral + borrow.
contract SubmitBuyOrders is Script {
    uint256 constant MAX_ORDERS = 20;
    uint256 constant BUY_AMOUNT = 500e18; // 500 USDC per ITP
    uint8 constant SIDE_BUY = 0;

    function run() external {
        uint256 key = vm.envOr("DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537));
        address indexAddr = vm.envOr("INDEX_ADDRESS", address(0x61988A72e2c898702bf634D5D2A0278694CC731C));

        IIndex idx = IIndex(indexAddr);
        address user = vm.addr(key);

        uint256 itpCount = idx.getItpCount();
        console.log("Total ITPs:", itpCount);
        console.log("User:", user);

        uint256 submitted = 0;

        vm.startBroadcast(key);

        for (uint256 i = 1; i <= itpCount && submitted < MAX_ORDERS; i++) {
            bytes32 itpId = bytes32(i);

            // Only buy ITPs that have vault tokens (used as Morpho collateral)
            address vault = idx.itpVaults(itpId);
            if (vault == address(0)) continue;

            // Get NAV for fill price
            (, , uint256 nav, , , ) = idx.getITPState(itpId);
            if (nav == 0) nav = 1e18; // default $1

            // Submit buy order: BUY_AMOUNT USDC worth at current NAV
            uint256 orderId = idx.submitOrder(
                itpId,
                SIDE_BUY,
                BUY_AMOUNT,
                nav,
                1, // minFillPct = 1%
                block.timestamp + 86400 // 24h expiry
            );

            console.log("Order", orderId, "ITP", i);
            submitted++;
        }

        vm.stopBroadcast();

        console.log("Submitted", submitted, "buy orders. Wait for oracle processing, then run SeedBorrows.");
    }
}
