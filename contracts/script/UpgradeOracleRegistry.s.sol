// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";

/// @title UpgradeOracleRegistry
/// @notice UUPS upgrade for OracleRegistry proxy (adds setAggregatedPubkey storage)
contract UpgradeOracleRegistry is Script {
    function run() external {
        address proxyAddress = vm.envAddress("ORACLE_REGISTRY");

        vm.startBroadcast();

        // Deploy new implementation
        OracleRegistry newImpl = new OracleRegistry();
        console.log("New OracleRegistry implementation:", address(newImpl));

        // Upgrade proxy (caller must be admin)
        OracleRegistry proxy = OracleRegistry(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");

        console.log("OracleRegistry upgraded successfully");
        console.log("Proxy address:", proxyAddress);

        vm.stopBroadcast();
    }
}
