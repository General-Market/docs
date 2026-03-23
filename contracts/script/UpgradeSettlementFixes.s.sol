// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {SettlementBridgeCustody} from "../src/custody/SettlementBridgeCustody.sol";

/// @title UpgradeSettlementFixes
/// @notice Upgrade Settlement chain contracts with security fixes (C4, H1, H18, H21)
contract UpgradeSettlementFixes is Script {
    function run() external {
        address custodyProxy = vm.envAddress("SETTLEMENT_CUSTODY");

        vm.startBroadcast();

        // Upgrade SettlementBridgeCustody (C4: completeBridge recipient, H1: error code, H18: visionReserve, H21: revert on truncation)
        SettlementBridgeCustody newCustody = new SettlementBridgeCustody();
        console.log("New SettlementBridgeCustody impl:", address(newCustody));
        SettlementBridgeCustody(custodyProxy).upgradeToAndCall(address(newCustody), "");
        console.log("SettlementBridgeCustody upgraded at proxy:", custodyProxy);

        vm.stopBroadcast();
    }
}
