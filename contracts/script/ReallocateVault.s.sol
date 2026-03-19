// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho, MarketAllocation} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";

/// @title ReallocateVault — Spread vault supply evenly across all supply queue markets
contract ReallocateVault is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        uint256 key = vm.envOr(
            "DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537)
        );

        address morphoAddr = vm.envOr("MORPHO", address(0xecf30fA79bb8aB854932E3De0a7D75Cf19cFd867));
        address vaultAddr = vm.envOr("METAMORPHO_VAULT", address(0xEd0B49a94104D65B8280B0B505402523A2fDBB6d));

        IMorpho morpho = IMorpho(morphoAddr);
        MetaMorpho vault = MetaMorpho(vaultAddr);

        uint256 totalAssets = vault.totalAssets();
        uint256 wqLen = vault.withdrawQueueLength();
        uint256 perMarket = totalAssets / wqLen;

        console.log("Total assets:", totalAssets);
        console.log("Markets:", wqLen);
        console.log("Per market:", perMarket);

        // Build allocation array: market 0 first (withdrawal), then rest (supply)
        MarketAllocation[] memory allocs = new MarketAllocation[](wqLen);
        for (uint256 i = 0; i < wqLen; i++) {
            Id marketId = vault.withdrawQueue(i);
            MarketParams memory mp = morpho.idToMarketParams(marketId);
            allocs[i] = MarketAllocation({marketParams: mp, assets: perMarket});
        }
        // Last market gets remainder
        allocs[wqLen - 1].assets = totalAssets - (perMarket * (wqLen - 1));

        vm.startBroadcast(key);
        vault.reallocate(allocs);
        vm.stopBroadcast();

        console.log("Reallocated successfully");
    }
}
