// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {FeeRegistry} from "../src/registry/FeeRegistry.sol";
import {AssetPairRegistry} from "../src/registry/AssetPairRegistry.sol";
import {CollateralRegistry} from "../src/registry/CollateralRegistry.sol";

/// @title SetAggregatedPubkey
/// @notice Push aggregated BLS G2 pubkey to all registry contracts
/// @dev Run after any addIssuer/removeIssuer/key rotation on live testnet
///
/// Usage:
///   AGG_PUBKEY=$(./target/release/bls-tool --rpc $RPC --issuer-registry $ISSUER_REGISTRY)
///   forge script SetAggregatedPubkey --rpc-url $RPC --broadcast --private-key $ADMIN_KEY
contract SetAggregatedPubkey is Script {
    function run() external {
        bytes memory aggPubkey = vm.envBytes("AGG_PUBKEY");
        require(aggPubkey.length == 128, "AGG_PUBKEY must be 128 bytes (G2 point)");

        address issuerRegistry = vm.envAddress("ISSUER_REGISTRY");
        address feeRegistry = vm.envAddress("FEE_REGISTRY");
        address assetPairRegistry = vm.envAddress("ASSET_PAIR_REGISTRY");
        address collateralRegistry = vm.envAddress("COLLATERAL_REGISTRY");

        vm.startBroadcast();

        IssuerRegistry(issuerRegistry).setAggregatedPubkey(aggPubkey);
        console.log("IssuerRegistry updated");

        FeeRegistry(feeRegistry).setAggregatedPubkey(aggPubkey);
        console.log("FeeRegistry updated");

        AssetPairRegistry(assetPairRegistry).setAggregatedPubkey(aggPubkey);
        console.log("AssetPairRegistry updated");

        CollateralRegistry(collateralRegistry).setAggregatedPubkey(aggPubkey);
        console.log("CollateralRegistry updated");

        console.log("Aggregated pubkey set on all registries");
        console.log("Pubkey length:", aggPubkey.length);

        vm.stopBroadcast();
    }
}
