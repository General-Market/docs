// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/core/Investment.sol";

contract UpgradeAndResetOrders is Script {
    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537));
        address indexProxy = vm.envAddress("INDEX_ADDRESS");

        vm.startBroadcast(pk);

        // Deploy new implementation with resetOrderState()
        Investment newImpl = new Investment();
        console.log("New Investment impl:", address(newImpl));

        // Upgrade proxy (UUPS)
        Investment(indexProxy).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded");

        // Reset stale order state
        Investment(indexProxy).resetOrderState();
        uint256 nextId = Investment(indexProxy).nextOrderId();
        console.log("nextOrderId reset to:", nextId);

        vm.stopBroadcast();
    }
}
