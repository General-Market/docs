// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Index} from "../src/core/Index.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title UpgradeIndex
 * @notice Upgrade Index proxy to new implementation with getAllItps support
 */
contract UpgradeIndex is Script {
    function run() external {
        address proxyAddress = vm.envOr("INDEX_PROXY", address(0x6CCcB99208A6AFfe4F3a14237bC2C9B540774177));

        vm.startBroadcast();

        // Deploy new implementation
        Index newImpl = new Index();
        console.log("New Index implementation:", address(newImpl));

        // Upgrade proxy (caller must be admin)
        Index proxy = Index(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");

        console.log("Index upgraded successfully");
        console.log("Proxy address:", proxyAddress);

        vm.stopBroadcast();
    }
}
