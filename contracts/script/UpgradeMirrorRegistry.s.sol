// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";

/// @title UpgradeMirrorRegistry - Upgrade MirrorIssuerRegistry implementation
/// @dev Usage:
///   PROXY=0x015e39eefbab8f5d317dc7900465ea2673bf8424 \
///   forge script script/UpgradeMirrorRegistry.s.sol:UpgradeMirrorRegistry \
///     --rpc-url $SETTLEMENT_RPC --broadcast --private-key $KEY
contract UpgradeMirrorRegistry is Script {
    function run() external {
        address proxy = vm.envAddress("PROXY");

        console.log("Upgrading MirrorIssuerRegistry...");
        console.log("  Proxy:", proxy);

        // Read state before upgrade
        MirrorIssuerRegistry mirror = MirrorIssuerRegistry(proxy);
        uint256 nonceBefore = mirror.registryNonce();
        uint256 snapshotBefore = mirror.lastSnapshotNonce();
        uint256 countBefore = mirror.activeCount();
        console.log("  State before:");
        console.log("    registryNonce:", nonceBefore);
        console.log("    lastSnapshotNonce:", snapshotBefore);
        console.log("    activeCount:", countBefore);

        vm.startBroadcast();

        // Deploy new implementation
        MirrorIssuerRegistry newImpl = new MirrorIssuerRegistry();
        console.log("  New implementation:", address(newImpl));

        // Upgrade proxy
        mirror.upgradeToAndCall(address(newImpl), "");
        console.log("  Upgrade complete!");

        vm.stopBroadcast();

        // Verify state preserved
        uint256 nonceAfter = mirror.registryNonce();
        uint256 snapshotAfter = mirror.lastSnapshotNonce();
        uint256 countAfter = mirror.activeCount();
        console.log("  State after:");
        console.log("    registryNonce:", nonceAfter);
        console.log("    lastSnapshotNonce:", snapshotAfter);
        console.log("    activeCount:", countAfter);

        require(nonceAfter == nonceBefore, "registryNonce changed!");
        require(snapshotAfter == snapshotBefore, "lastSnapshotNonce changed!");
        require(countAfter == countBefore, "activeCount changed!");
        console.log("  State verification PASSED");
    }
}
