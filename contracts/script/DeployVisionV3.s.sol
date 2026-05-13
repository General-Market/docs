// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Vision} from "../src/vision/Vision.sol";

/// @notice Deploys a fresh Vision contract carrying the new multicall entries:
///         `settleBatches` (Phase 1, per-item BLS bundle) and
///         `settleBatchesSingle` (Phase 6, single-aggregated-BLS bundle).
///         Vision is non-upgradeable — this is a redeploy, not an upgrade.
///         Existing batches on the prior Vision keep their lifecycle; new
///         batches go to this contract after the cutover.
contract DeployVisionV3 is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address usdc = vm.envAddress("VISION_USDC");
        address oracleRegistry = vm.envAddress("VISION_ORACLE_REGISTRY");
        address feeCollector = vm.envAddress("VISION_FEE_COLLECTOR");

        vm.startBroadcast(key);
        Vision vision = new Vision(usdc, oracleRegistry, feeCollector);
        vm.stopBroadcast();

        console.log("Vision v3:", address(vision));
        console.log("  usdc:", usdc);
        console.log("  oracleRegistry:", oracleRegistry);
        console.log("  feeCollector:", feeCollector);
    }
}
