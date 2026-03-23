// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Investment} from "../src/core/Investment.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";

/// @title UpgradeSecurityFixes
/// @notice Upgrade L3 UUPS contracts with security audit fixes
/// Investment: C6 refund whitelist, C7 emitAssetTrades replay, H15 createITP ACL, H24 zero price
/// OracleRegistry: H13 removeOracleByVote multi-pairing
/// NOTE: Vision is not UUPS — needs fresh deploy. L3BridgeCustody needs BLS+timelock proposal.
contract UpgradeSecurityFixes is Script {
    function run() external {
        address indexProxy = vm.envAddress("INDEX_ADDRESS");
        address oracleRegistryProxy = vm.envAddress("ORACLE_REGISTRY");

        vm.startBroadcast();

        // 1. Upgrade Investment
        Investment newIndex = new Investment();
        console.log("New Investment impl:", address(newIndex));
        Investment(indexProxy).upgradeToAndCall(address(newIndex), "");
        console.log("Investment upgraded at proxy:", indexProxy);

        // 2. Upgrade OracleRegistry
        OracleRegistry newRegistry = new OracleRegistry();
        console.log("New OracleRegistry impl:", address(newRegistry));
        OracleRegistry(oracleRegistryProxy).upgradeToAndCall(address(newRegistry), "");
        console.log("OracleRegistry upgraded at proxy:", oracleRegistryProxy);

        vm.stopBroadcast();
    }
}
