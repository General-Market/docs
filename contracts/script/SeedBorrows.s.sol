// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SeedBorrows — Supply collateral + borrow random amounts for all batch markets
/// @notice For each market in the vault's withdraw queue:
///         1. Reads the ITP vault token (collateral)
///         2. If the user has a balance, approves Morpho and supplies as collateral
///         3. Borrows a random amount (1-100 USDC) from the market
///
/// Prerequisites:
///   - User must hold ITP vault tokens for the ITPs
///   - Markets must have supply (run ReallocateVault first)
///   - ITP vault tokens must exist (user must have bought ITPs)
///
/// Environment:
///   DEPLOYER_KEY, MORPHO, METAMORPHO_VAULT
contract SeedBorrows is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        uint256 key = vm.envOr("DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537));
        address morphoAddr = vm.envOr("MORPHO", address(0x668a7c99Db8425CE74F5826622652958c6946E74));
        address vaultAddr = vm.envOr("METAMORPHO_VAULT", address(0xd8A9e892c69113e2576C3c066922c46a9121DA6F));

        address user = vm.addr(key);
        IMorpho morpho = IMorpho(morphoAddr);
        MetaMorpho vault = MetaMorpho(vaultAddr);

        uint256 wqLen = vault.withdrawQueueLength();
        console.log("Markets:", wqLen);
        console.log("User:", user);

        uint256 borrowed = 0;
        uint256 supplied = 0;

        vm.startBroadcast(key);

        for (uint256 i = 0; i < wqLen; i++) {
            Id marketId = vault.withdrawQueue(i);
            MarketParams memory mp = morpho.idToMarketParams(marketId);

            // Check user's balance of the collateral token
            uint256 bal = IERC20(mp.collateralToken).balanceOf(user);
            if (bal == 0) continue;

            // Check market has supply (liquidity to borrow)
            (uint128 totalSupply,,,,, ) = morpho.market(marketId);
            if (totalSupply == 0) continue;

            // Approve collateral to Morpho
            IERC20(mp.collateralToken).approve(morphoAddr, type(uint256).max);

            // Supply all balance as collateral
            morpho.supplyCollateral(mp, bal, user, "");
            supplied++;

            // Borrow a random amount between 1 and 100 USDC (18 decimals on L3)
            uint256 pseudoRandom = uint256(keccak256(abi.encode(block.timestamp, i))) % 100 + 1;
            uint256 borrowAmount = pseudoRandom * 1e18; // 1-100 USDC

            // Cap borrow at what's available (totalSupply) and what health allows
            if (borrowAmount > uint256(totalSupply) / 2) {
                borrowAmount = uint256(totalSupply) / 2;
            }
            if (borrowAmount == 0) continue;

            morpho.borrow(mp, borrowAmount, 0, user, user);
            borrowed++;

            console.log("Market", i, "- supplied collateral, borrowed", borrowAmount / 1e18, "USDC");
        }

        vm.stopBroadcast();

        console.log("Total markets supplied:", supplied);
        console.log("Total markets borrowed:", borrowed);
    }
}
