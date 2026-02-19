// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";

/// @title SetAggregatedPubkey
/// @notice Push aggregated BLS G2 pubkey to IssuerRegistry
/// @dev All other contracts read pubkey from IssuerRegistry via BLSVerifier.
///      Run after any addIssuer/removeIssuer/key rotation on live testnet.
///
/// Usage:
///   AGG_PUBKEY=$(./target/release/bls-tool --rpc $RPC --issuer-registry $ISSUER_REGISTRY)
///   forge script SetAggregatedPubkey --rpc-url $RPC --broadcast --private-key $ADMIN_KEY
contract SetAggregatedPubkey is Script {
    function run() external {
        bytes memory aggPubkey = vm.envBytes("AGG_PUBKEY");
        require(aggPubkey.length == 128, "AGG_PUBKEY must be 128 bytes (G2 point)");

        address issuerRegistry = vm.envAddress("ISSUER_REGISTRY");

        vm.startBroadcast();

        IssuerRegistry(issuerRegistry).setAggregatedPubkey(aggPubkey);
        console.log("IssuerRegistry updated with aggregated pubkey");
        console.log("Pubkey length:", aggPubkey.length);

        vm.stopBroadcast();
    }
}
