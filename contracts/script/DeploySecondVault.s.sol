// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeploySecondVault — Deploy a second MetaMorpho vault + batch markets
/// @notice Deploys a new MetaMorpho vault, then creates Morpho markets for the
///         remaining ITPs that didn't fit in the first vault's queue (limit 30).
///         Reuses the existing Morpho Blue core + CuratorRateIRM.
contract DeploySecondVault is Script {
    using MarketParamsLib for MarketParams;

    uint256 constant SUPPLY_CAP = type(uint184).max;

    struct MarketDeployment {
        address itpAddress;
        address oracle;
        Id marketId;
        uint256 lltv;
    }

    function run() external {
        uint256 key = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(key);

        address morphoAddr = vm.envAddress("MORPHO");
        address curatorIrmAddr = vm.envAddress("CURATOR_RATE_IRM");
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address mirrorRegistry = vm.envAddress("MIRROR_REGISTRY");
        uint256 marketCount = vm.envUint("BATCH_MARKET_COUNT");
        uint256 seedLiquidity = vm.envOr("SEED_LIQUIDITY", uint256(0));

        require(marketCount > 0 && marketCount <= 100, "BATCH_MARKET_COUNT must be 1-100");

        console.log("=== DeploySecondVault ===");
        console.log("Deployer:", deployer);
        console.log("Morpho:", morphoAddr);
        console.log("Market count:", marketCount);

        Morpho morpho = Morpho(morphoAddr);

        MarketDeployment[] memory deployments = new MarketDeployment[](marketCount);

        vm.startBroadcast(key);

        // 1. Deploy new MetaMorpho vault (timelock=0 for testnet)
        MetaMorpho vault = new MetaMorpho(
            deployer,
            morphoAddr,
            0,
            settlementUSDC,
            "Index ITP Lending Vault 2",
            "ilUSDC2"
        );
        console.log("Vault 2 deployed:", address(vault));

        // 2. Deploy markets
        for (uint256 i = 0; i < marketCount; i++) {
            string memory prefix = string.concat("ITP_", vm.toString(i));
            address itpAddress = vm.envAddress(string.concat(prefix, "_ADDRESS"));
            uint256 lltv = vm.envUint(string.concat(prefix, "_LLTV"));
            uint256 initialPrice = vm.envUint(string.concat(prefix, "_INITIAL_PRICE"));

            console.log("---");
            console.log("Market", i);

            // Deploy oracle
            ITPNAVOracle oracle = new ITPNAVOracle(mirrorRegistry, itpAddress, initialPrice);
            console.log("  Oracle:", address(oracle));

            // Create market (skip if exists)
            MarketParams memory params = MarketParams({
                loanToken: settlementUSDC,
                collateralToken: itpAddress,
                oracle: address(oracle),
                irm: curatorIrmAddr,
                lltv: lltv
            });

            Id marketId = params.id();
            (,,,, uint128 mktLastUpdate,) = morpho.market(marketId);
            if (mktLastUpdate == 0) {
                morpho.createMarket(params);
                console.log("  Market created");
            } else {
                console.log("  Market exists");
            }

            // Submit + accept cap on the NEW vault
            vault.submitCap(params, SUPPLY_CAP);
            vault.acceptCap(params);

            deployments[i] = MarketDeployment({
                itpAddress: itpAddress,
                oracle: address(oracle),
                marketId: marketId,
                lltv: lltv
            });
        }

        // 3. Set supply queue (capped at 30)
        uint256 queueLen = marketCount < 30 ? marketCount : 30;
        Id[] memory supplyQueue = new Id[](queueLen);
        for (uint256 i = 0; i < queueLen; i++) {
            supplyQueue[i] = deployments[i].marketId;
        }
        vault.setSupplyQueue(supplyQueue);
        console.log("Supply queue set with", queueLen, "markets");

        // 4. Seed liquidity if requested
        if (seedLiquidity > 0) {
            MockERC20(settlementUSDC).mint(deployer, seedLiquidity);
            IERC20(settlementUSDC).approve(address(vault), seedLiquidity);
            vault.deposit(seedLiquidity, deployer);
            console.log("Seeded with", seedLiquidity);
        }

        vm.stopBroadcast();

        // 5. Write deployment JSON
        _writeJson(deployer, morphoAddr, curatorIrmAddr, address(vault), settlementUSDC, mirrorRegistry, deployments);
    }

    function _writeJson(
        address deployer,
        address morphoAddr,
        address curatorIrmAddr,
        address vaultAddr,
        address settlementUSDC,
        address mirrorRegistry,
        MarketDeployment[] memory deployments
    ) internal {
        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "deployer": "', vm.toString(deployer),
            '",\n  "timestamp": ', vm.toString(block.timestamp),
            ',\n  "infrastructure": {\n',
            '    "MORPHO": "', vm.toString(morphoAddr),
            '",\n    "CURATOR_RATE_IRM": "', vm.toString(curatorIrmAddr),
            '",\n    "METAMORPHO_VAULT_2": "', vm.toString(vaultAddr),
            '",\n    "SETTLEMENT_USDC": "', vm.toString(settlementUSDC),
            '",\n    "MIRROR_REGISTRY": "', vm.toString(mirrorRegistry),
            '"\n  },\n  "markets": [\n'
        );

        for (uint256 i = 0; i < deployments.length; i++) {
            MarketDeployment memory d = deployments[i];
            string memory entry = string.concat(
                '    {\n',
                '      "collateralToken": "', vm.toString(d.itpAddress),
                '",\n      "oracle": "', vm.toString(d.oracle),
                '",\n      "marketId": "', vm.toString(Id.unwrap(d.marketId)),
                '",\n      "lltv": "', vm.toString(d.lltv),
                '",\n      "loanToken": "', vm.toString(settlementUSDC),
                '",\n      "irm": "', vm.toString(curatorIrmAddr),
                '"\n    }'
            );
            if (i < deployments.length - 1) entry = string.concat(entry, ',');
            json = string.concat(json, entry, '\n');
        }

        json = string.concat(json, '  ]\n}\n');
        string memory outPath = string.concat(vm.projectRoot(), "/../deployments/batch-markets-v2.json");
        vm.writeFile(outPath, json);
        console.log("Written to deployments/batch-markets-v2.json");
    }
}
