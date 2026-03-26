// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IInvestment.sol";
import "../src/libraries/TypesLib.sol";

interface IIndexReader {
    function orders(uint256 orderId)
        external
        view
        returns (
            uint256 id,
            address user,
            bytes32 pairId,
            TypesLib.Side side,
            uint256 amount,
            uint256 limitPrice,
            uint256 slippageTier,
            uint256 deadline,
            bytes32 itpId,
            uint256 timestamp,
            TypesLib.OrderStatus status
        );
}

contract CancelStaleOrders is Script {
    address constant INDEX_ADDR = 0x62BFdE563B2AB16DdA5bCc7c671F797118d19F13;

    uint256 constant START_ID = 204;
    uint256 constant END_ID = 551;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        IIndexReader reader = IIndexReader(INDEX_ADDR);
        IInvestment index = IInvestment(INDEX_ADDR);

        // Phase 1: scan (view calls, no broadcast needed)
        uint256[] memory pendingIds = new uint256[](END_ID - START_ID + 1);
        uint256 count;

        for (uint256 id = START_ID; id <= END_ID; id++) {
            (,,,,,,,,,, TypesLib.OrderStatus st) = reader.orders(id);
            if (st == TypesLib.OrderStatus.PENDING) {
                pendingIds[count] = id;
                count++;
            }
        }

        console.log("Found %s PENDING orders to cancel", count);
        if (count == 0) {
            console.log("Nothing to do.");
            return;
        }

        // Phase 2: cancel (broadcast only the necessary txs)
        vm.startBroadcast(deployerKey);

        for (uint256 i = 0; i < count; i++) {
            index.cancelOrder(pendingIds[i]);
            if ((i + 1) % 10 == 0 || i + 1 == count) {
                console.log("Cancelled %s / %s  (orderId %s)", i + 1, count, pendingIds[i]);
            }
        }

        vm.stopBroadcast();

        console.log("--- Done: %s orders cancelled ---", count);
    }
}
