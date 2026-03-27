// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SeedBorrows — Supply collateral + borrow from all batch markets
/// @notice For each market in the vault's withdraw queue:
///         1. Reads the ITP vault token (collateral)
///         2. If the buyer has a balance, approves Morpho and supplies 50% as collateral
///         3. Borrows 50% of collateral value in USDC
///
/// Prerequisites:
///   - Buyer must hold ITP vault tokens (run SubmitBuyOrders + wait for oracle fills)
///   - Markets must have supply (run ReallocateVault first)
///
/// Environment:
///   BUYER_KEY, MORPHO, METAMORPHO_VAULT
contract SeedBorrows is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        // Buyer = Anvil account 9 (0xa0Ee7A142d267C1f36714E4a8F75612F20a79720)
        uint256 key = vm.envOr("BUYER_KEY", uint256(0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6));
        address morphoAddr = vm.envOr("MORPHO", address(0xb1a301C89cB313084Bb4367f8D30a21AD7c3D449));
        address vaultAddr = vm.envOr("METAMORPHO_VAULT", address(0xE67Eee49D5032D5618d7549F5dE866FF442F1Eee));

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

            // Skip markets where collateral token has no code (stale/dummy markets)
            if (mp.collateralToken.code.length == 0) continue;

            // Check user's balance of the collateral token
            uint256 bal = IERC20(mp.collateralToken).balanceOf(user);
            if (bal == 0) continue;

            // Check market has supply (liquidity to borrow)
            Market memory m = morpho.market(marketId);
            uint128 totalSupply = m.totalSupplyAssets;
            if (totalSupply == 0) continue;

            // Supply 50% of balance as collateral (keep 50% liquid)
            uint256 collateralAmount = bal / 2;
            if (collateralAmount == 0) continue;

            // Approve collateral to Morpho
            IERC20(mp.collateralToken).approve(morphoAddr, type(uint256).max);

            morpho.supplyCollateral(mp, collateralAmount, user, "");
            supplied++;

            // Borrow 50% of collateral value in USDC
            // Collateral value ≈ collateralAmount (ITP shares are ~$1 each at 18 dec)
            // With LLTV 77%, borrowing 50% of collateral value is safe
            uint256 borrowAmount = collateralAmount / 2;

            // Cap at available liquidity
            if (borrowAmount > uint256(totalSupply) / 2) {
                borrowAmount = uint256(totalSupply) / 2;
            }
            if (borrowAmount == 0) continue;

            morpho.borrow(mp, borrowAmount, 0, user, user);
            borrowed++;

            console.log("Market %d - supplied collateral, borrowed %d USDC", i, borrowAmount / 1e18);
        }

        vm.stopBroadcast();

        console.log("Total markets supplied:", supplied);
        console.log("Total markets borrowed:", borrowed);
    }
}
