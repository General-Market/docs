// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho, MarketAllocation} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";

contract ReallocateVault is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        uint256 key = vm.envOr("DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537));
        address morphoAddr = vm.envOr("MORPHO", address(0xb1a301C89cB313084Bb4367f8D30a21AD7c3D449));
        address vaultAddr = vm.envOr("METAMORPHO_VAULT", address(0xE67Eee49D5032D5618d7549F5dE866FF442F1Eee));
        bool spread = vm.envOr("SPREAD", false);

        IMorpho morpho = IMorpho(morphoAddr);
        MetaMorpho vault = MetaMorpho(vaultAddr);

        uint256 totalAssets = vault.totalAssets();
        uint256 wqLen = vault.withdrawQueueLength();

        console.log("Total assets:", totalAssets);
        console.log("Markets:", wqLen);

        MarketAllocation[] memory allocs = new MarketAllocation[](wqLen);

        if (spread) {
            uint256 perMarket = totalAssets / wqLen;
            for (uint256 i = 0; i < wqLen; i++) {
                Id marketId = vault.withdrawQueue(i);
                MarketParams memory mp = morpho.idToMarketParams(marketId);
                allocs[i] = MarketAllocation({marketParams: mp, assets: perMarket});
            }
            allocs[wqLen - 1].assets = totalAssets - (perMarket * (wqLen - 1));
            console.log("Spreading", perMarket, "per market");
        } else {
            // Consolidate: withdrawals FIRST (zeroed markets), then supplies (borrowed markets)
            // MetaMorpho processes array sequentially — need liquidity before supplying
            uint256 idx = 0;
            uint256 freed = 0;
            uint256 sinkMarket = type(uint256).max;
            // Pass 1: put empty markets first (withdrawals)
            for (uint256 i = 0; i < wqLen; i++) {
                Id marketId = vault.withdrawQueue(i);
                uint256 borrow = morpho.market(marketId).totalBorrowAssets;
                if (borrow == 0) {
                    MarketParams memory mp = morpho.idToMarketParams(marketId);
                    uint256 supply = morpho.market(marketId).totalSupplyAssets;
                    allocs[idx] = MarketAllocation({marketParams: mp, assets: 0});
                    freed += supply;
                    idx++;
                }
            }
            // Pass 2: borrowed markets keep their supply
            for (uint256 i = 0; i < wqLen; i++) {
                Id marketId = vault.withdrawQueue(i);
                uint256 borrow = morpho.market(marketId).totalBorrowAssets;
                if (borrow > 0) {
                    MarketParams memory mp = morpho.idToMarketParams(marketId);
                    uint256 supply = morpho.market(marketId).totalSupplyAssets;
                    allocs[idx] = MarketAllocation({marketParams: mp, assets: supply + (sinkMarket == type(uint256).max ? freed : 0)});
                    if (sinkMarket == type(uint256).max) sinkMarket = idx;
                    idx++;
                }
            }
            console.log("Freed from empty markets:", freed);
        }

        vm.startBroadcast(key);
        vault.reallocate(allocs);
        vm.stopBroadcast();
        console.log("Done");
    }
}
