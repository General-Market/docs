// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AcceptBatchCaps — Accept vault caps + set supply queue (no timelock wait needed)
/// @notice Accepts supply caps for all batch markets and sets the supply queue.
///         With MIN_TIMELOCK=0, can run immediately after DeployBatchMarkets.
///         Optionally seeds the vault with initial USDC liquidity.
///
///      Environment variables (same as DeployBatchMarkets):
///        METAMORPHO_VAULT      — MetaMorpho vault address
///        ARB_USDC              — Loan token (USDC)
///        CURATOR_RATE_IRM      — CuratorRateIRM address
///        BATCH_MARKET_COUNT    — Number of ITP markets
///        ITP_<i>_ADDRESS       — ITP token address (i = 0..count-1)
///        ITP_<i>_LLTV          — LLTV in WAD
///        ITP_<i>_ORACLE        — Oracle address (from DeployBatchMarkets output)
///      Optional:
///        SEED_LIQUIDITY_USDC   — Amount of USDC to seed vault (6 decimals, default: 0)
///        EXISTING_MARKET_IDS   — Comma-separated existing market IDs to keep in supply queue
contract AcceptBatchCaps is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(anvilKey);

        address vaultAddr = vm.envAddress("METAMORPHO_VAULT");
        address arbUSDC = vm.envAddress("ARB_USDC");
        address curatorIrmAddr = vm.envAddress("CURATOR_RATE_IRM");
        uint256 marketCount = vm.envUint("BATCH_MARKET_COUNT");
        uint256 seedLiquidity = vm.envOr("SEED_LIQUIDITY_USDC", uint256(0));

        require(marketCount > 0 && marketCount <= 50, "BATCH_MARKET_COUNT must be 1-50");

        console.log("=== AcceptBatchCaps ===");
        console.log("Vault:", vaultAddr);
        console.log("Market count:", marketCount);
        console.log("Seed liquidity:", seedLiquidity);

        MetaMorpho vault = MetaMorpho(vaultAddr);

        // Build market params and IDs for all batch markets
        Id[] memory batchIds = new Id[](marketCount);

        vm.startBroadcast(anvilKey);

        for (uint256 i = 0; i < marketCount; i++) {
            string memory prefix = string.concat("ITP_", vm.toString(i));
            address itpAddress = vm.envAddress(string.concat(prefix, "_ADDRESS"));
            uint256 lltv = vm.envUint(string.concat(prefix, "_LLTV"));
            address oracleAddr = vm.envAddress(string.concat(prefix, "_ORACLE"));

            MarketParams memory params = MarketParams({
                loanToken: arbUSDC,
                collateralToken: itpAddress,
                oracle: oracleAddr,
                irm: curatorIrmAddr,
                lltv: lltv
            });

            Id marketId = params.id();
            batchIds[i] = marketId;

            // Accept the pending cap (timelock must have elapsed)
            vault.acceptCap(params);
            console.log("Accepted cap for market", i);
            console.logBytes32(Id.unwrap(marketId));
        }

        // Set supply queue: batch markets (existing markets can be prepended via separate script)
        vault.setSupplyQueue(batchIds);
        console.log("Supply queue set with", marketCount, "markets");

        // Optionally seed vault with USDC liquidity
        if (seedLiquidity > 0) {
            MockERC20(arbUSDC).mint(deployer, seedLiquidity);
            IERC20(arbUSDC).approve(vaultAddr, seedLiquidity);
            vault.deposit(seedLiquidity, deployer);
            console.log("Vault seeded with", seedLiquidity / 1e6, "USDC");
        }

        vm.stopBroadcast();

        console.log("---");
        console.log("All caps accepted and supply queue configured");
        console.log("Markets are now ready for lending via CuratorRateIRM");
    }
}
