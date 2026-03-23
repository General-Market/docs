// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";

/// @title DeployBatchMarkets — Batch deploy CuratorRateIRM markets for multiple ITPs
/// @notice For each ITP: deploys ITPNAVOracle → creates Morpho market with CuratorRateIRM → submits+accepts vault supply cap.
/// @dev No timelock wait needed — MIN_TIMELOCK is 0 for testnet. Caps are accepted inline.
///
///      Environment variables:
///        MORPHO                — Morpho Blue core address
///        CURATOR_RATE_IRM      — CuratorRateIRM address (already deployed + enabled)
///        METAMORPHO_VAULT      — MetaMorpho vault address
///        SETTLEMENT_USDC              — Loan token (USDC)
///        MIRROR_REGISTRY       — MirrorOracleRegistry for oracle constructor
///        BATCH_MARKET_COUNT    — Number of ITP markets to create (1-indexed)
///        ITP_<i>_ADDRESS       — ITP token address (i = 0..count-1)
///        ITP_<i>_LLTV          — LLTV in WAD (e.g. 770000000000000000 for 77%)
///        ITP_<i>_INITIAL_PRICE — Initial oracle price (Morpho-scaled, 24 decimal precision)
contract DeployBatchMarkets is Script {
    using MarketParamsLib for MarketParams;

    /// @notice Max supply cap per market in MetaMorpho vault
    uint256 constant SUPPLY_CAP = type(uint184).max;

    struct MarketDeployment {
        address itpAddress;
        address oracle;
        Id marketId;
        uint256 lltv;
    }

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(anvilKey);

        // Read shared infrastructure addresses
        address morphoAddr = vm.envAddress("MORPHO");
        address curatorIrmAddr = vm.envAddress("CURATOR_RATE_IRM");
        address vaultAddr = vm.envAddress("METAMORPHO_VAULT");
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address mirrorRegistry = vm.envAddress("MIRROR_REGISTRY");
        uint256 marketCount = vm.envUint("BATCH_MARKET_COUNT");

        require(marketCount > 0 && marketCount <= 100, "BATCH_MARKET_COUNT must be 1-100");

        console.log("=== DeployBatchMarkets ===");
        console.log("Deployer:", deployer);
        console.log("Morpho:", morphoAddr);
        console.log("CuratorRateIRM:", curatorIrmAddr);
        console.log("MetaMorpho Vault:", vaultAddr);
        console.log("Loan Token (USDC):", settlementUSDC);
        console.log("Mirror Registry:", mirrorRegistry);
        console.log("Market count:", marketCount);

        Morpho morpho = Morpho(morphoAddr);
        MetaMorpho vault = MetaMorpho(vaultAddr);

        MarketDeployment[] memory deployments = new MarketDeployment[](marketCount);

        vm.startBroadcast(anvilKey);

        for (uint256 i = 0; i < marketCount; i++) {
            // Read per-ITP env vars
            string memory prefix = string.concat("ITP_", vm.toString(i));
            address itpAddress = vm.envAddress(string.concat(prefix, "_ADDRESS"));
            uint256 lltv = vm.envUint(string.concat(prefix, "_LLTV"));
            uint256 initialPrice = vm.envUint(string.concat(prefix, "_INITIAL_PRICE"));

            require(lltv > 0 && lltv <= 0.95e18, "Invalid LLTV");
            require(initialPrice > 0, "Invalid initial price");

            console.log("---");
            console.log("Market", i);
            console.log("  ITP:", itpAddress);
            console.log("  LLTV:", lltv);
            console.log("  Initial Price:", initialPrice);

            // 1. Deploy ITPNAVOracle for this ITP
            ITPNAVOracle oracle = new ITPNAVOracle(mirrorRegistry, itpAddress, initialPrice);
            console.log("  Oracle deployed:", address(oracle));

            // 2. Create Morpho market (skip if already exists)
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
                console.log("  Market created, ID:");
            } else {
                console.log("  Market exists, ID:");
            }
            console.logBytes32(Id.unwrap(marketId));

            // 3. Submit + accept supply cap (idempotent — acceptCap is no-op if already accepted)
            vault.submitCap(params, SUPPLY_CAP);
            vault.acceptCap(params);
            console.log("  Supply cap submitted and accepted");

            deployments[i] = MarketDeployment({
                itpAddress: itpAddress,
                oracle: address(oracle),
                marketId: marketId,
                lltv: lltv
            });
        }

        // Set supply queue: existing market (if any) + all batch markets
        bytes32 existingId = vm.envOr("EXISTING_MARKET_ID", bytes32(0));
        uint256 offset = existingId != bytes32(0) ? 1 : 0;
        Id[] memory supplyQueue = new Id[](marketCount + offset);
        if (offset > 0) {
            supplyQueue[0] = Id.wrap(existingId);
            console.log("Prepending existing market to supply queue");
        }
        for (uint256 i = 0; i < marketCount; i++) {
            supplyQueue[offset + i] = deployments[i].marketId;
        }
        vault.setSupplyQueue(supplyQueue);
        console.log("Supply queue set with", marketCount + offset, "markets");

        // Set initial borrow rates for all batch markets (5% APR default)
        // 5% APR = 0.05 * 1e18 / 31_536_000 ≈ 1_585_489_599
        uint256 defaultRate = vm.envOr("DEFAULT_BORROW_RATE", uint256(1585489599));
        CuratorRateIRM curatorIrm = CuratorRateIRM(curatorIrmAddr);
        Id[] memory rateIds = new Id[](marketCount);
        uint256[] memory rateValues = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            rateIds[i] = deployments[i].marketId;
            rateValues[i] = defaultRate;
        }
        curatorIrm.setRates(rateIds, rateValues);
        console.log("Borrow rates set for", marketCount, "markets");

        vm.stopBroadcast();

        // Write batch deployment JSON
        _writeDeploymentJson(
            deployer, morphoAddr, curatorIrmAddr, vaultAddr, settlementUSDC, mirrorRegistry, deployments
        );
    }

    function _writeDeploymentJson(
        address deployer,
        address morphoAddr,
        address curatorIrmAddr,
        address vaultAddr,
        address settlementUSDC,
        address mirrorRegistry,
        MarketDeployment[] memory deployments
    ) internal {
        // Header
        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "deployer": "', vm.toString(deployer),
            '",\n  "timestamp": ', vm.toString(block.timestamp),
            ',\n  "infrastructure": {\n',
            '    "MORPHO": "', vm.toString(morphoAddr),
            '",\n    "CURATOR_RATE_IRM": "', vm.toString(curatorIrmAddr),
            '",\n    "METAMORPHO_VAULT": "', vm.toString(vaultAddr),
            '",\n    "SETTLEMENT_USDC": "', vm.toString(settlementUSDC),
            '",\n    "MIRROR_REGISTRY": "', vm.toString(mirrorRegistry),
            '"\n  },\n  "markets": [\n'
        );

        // Each market entry
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
            if (i < deployments.length - 1) {
                entry = string.concat(entry, ',');
            }
            json = string.concat(json, entry, '\n');
        }

        json = string.concat(json, '  ]\n}\n');

        string memory outPath = string.concat(vm.projectRoot(), "/../deployments/batch-markets.json");
        vm.writeFile(outPath, json);
        console.log("---");
        console.log("Batch deployment written to deployments/batch-markets.json");
        console.log("Markets deployed:", deployments.length);
        console.log("All caps accepted and supply queue set (no timelock wait)");
    }
}
