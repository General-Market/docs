// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VisionReconciler} from "../src/vision/VisionReconciler.sol";

/// @notice Deploys the stateless `VisionReconciler` helper used by the oracle
///         to bundle per-player `reconcile(batchId, payout)` calls into a
///         single transaction. Removes the per-player nonce contention on the
///         oracle leader's EOA after every `settleBatch`.
contract DeployVisionReconciler is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(key);
        VisionReconciler reconciler = new VisionReconciler();
        vm.stopBroadcast();
        console.log("VisionReconciler:", address(reconciler));
    }
}
