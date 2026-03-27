// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/core/Investment.sol";

interface IProxy {
    function upgradeToAndCall(address newImpl, bytes calldata data) external;
}

contract UpgradeInvestment is Script {
    function run() external {
        uint256 key = vm.envOr("DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537));
        address proxy = vm.envAddress("INDEX_ADDRESS");

        vm.startBroadcast(key);

        // Deploy new implementation (libraries auto-linked by forge)
        Investment newImpl = new Investment();
        console.log("New implementation:", address(newImpl));

        // Upgrade proxy
        IProxy(proxy).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded");

        vm.stopBroadcast();
    }
}
