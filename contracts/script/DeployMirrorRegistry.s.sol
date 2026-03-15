// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MirrorOracleRegistry} from "../src/registry/MirrorOracleRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployMirrorRegistry - Deploy MirrorOracleRegistry on Settlement
/// @dev Requires bls-tool to be built for FFI pubkey generation.
///      Usage:
///        forge script script/DeployMirrorRegistry.s.sol:DeployMirrorRegistry \
///          --rpc-url $SETTLEMENT_RPC --broadcast --ffi \
///          --private-key $DEPLOYER_KEY
contract DeployMirrorRegistry is Script {
    string constant BLS_TOOL = "../target/release/bls-tool";

    function run() external {
        // Get aggregated pubkey for seeds 0,1,2
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        require(aggPubkey.length == 128, "Bad aggPubkey length");

        uint256 _threshold = 2;
        uint256 _activeCount = 3;
        address _admin = msg.sender;

        console.log("Deploying MirrorOracleRegistry on Settlement...");
        console.log("  admin:", _admin);
        console.log("  activeCount:", _activeCount);
        console.log("  threshold:", _threshold);
        console.log("  aggPubkey length:", aggPubkey.length);

        vm.startBroadcast();

        // Deploy implementation
        MirrorOracleRegistry impl = new MirrorOracleRegistry();
        console.log("  Implementation:", address(impl));

        // Deploy proxy with init
        bytes memory initData = abi.encodeCall(
            MirrorOracleRegistry.initialize,
            (aggPubkey, _threshold, _activeCount, _admin)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        console.log("  Proxy (use this address):", address(proxy));

        vm.stopBroadcast();

        // Verify
        MirrorOracleRegistry mirror = MirrorOracleRegistry(address(proxy));
        console.log("  Verification:");
        console.log("    registryNonce:", mirror.registryNonce());
        console.log("    lastSnapshotNonce:", mirror.lastSnapshotNonce());
        console.log("    activeCount:", mirror.activeCount());
        console.log("    threshold:", mirror.threshold());
        console.log("    admin:", mirror.admin());
    }

    function blsAggPubkey(string memory seedIndices) internal returns (bytes memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = BLS_TOOL;
        cmd[1] = "agg-pubkey-from-seeds";
        cmd[2] = "--seed-indices";
        cmd[3] = seedIndices;
        return vm.ffi(cmd);
    }
}
