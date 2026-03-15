// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";

/// @title UpgradeIssuerRegistry
/// @notice UUPS upgrade for IssuerRegistry proxy (adds setAggregatedPubkey storage)
contract UpgradeIssuerRegistry is Script {
    function run() external {
        address proxyAddress = vm.envAddress("ISSUER_REGISTRY");

        vm.startBroadcast();

        // Deploy new implementation
        IssuerRegistry newImpl = new IssuerRegistry();
        console.log("New IssuerRegistry implementation:", address(newImpl));

        // Upgrade proxy (caller must be admin)
        IssuerRegistry proxy = IssuerRegistry(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");

        console.log("IssuerRegistry upgraded successfully");
        console.log("Proxy address:", proxyAddress);

        vm.stopBroadcast();
    }
}
