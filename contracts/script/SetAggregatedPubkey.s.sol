// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";

/// @title SetAggregatedPubkey
/// @notice Push aggregated BLS G2 pubkey to OracleRegistry
/// @dev All other contracts read pubkey from OracleRegistry via BLSVerifier.
///      Run after any addOracle/removeOracle/key rotation on live testnet.
///
/// Usage:
///   AGG_PUBKEY=$(./target/release/bls-tool --rpc $RPC --oracle-registry $ORACLE_REGISTRY)
///   forge script SetAggregatedPubkey --rpc-url $RPC --broadcast --private-key $ADMIN_KEY
contract SetAggregatedPubkey is Script {
    function run() external {
        bytes memory aggPubkey = vm.envBytes("AGG_PUBKEY");
        require(aggPubkey.length == 128, "AGG_PUBKEY must be 128 bytes (G2 point)");

        address oracleRegistry = vm.envAddress("ORACLE_REGISTRY");

        vm.startBroadcast();

        uint256 nonce = OracleRegistry(oracleRegistry).registryNonce();
        OracleRegistry(oracleRegistry).setAggregatedPubkey(aggPubkey, nonce);
        console.log("OracleRegistry updated with aggregated pubkey");
        console.log("Pubkey length:", aggPubkey.length);
        console.log("Registry nonce used:", nonce);

        vm.stopBroadcast();
    }
}
