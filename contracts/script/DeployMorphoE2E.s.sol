// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho, IMetaMorphoBase} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {MirrorOracleRegistry} from "../src/registry/MirrorOracleRegistry.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// ERC1967Proxy no longer needed — oracle uses the main OracleRegistry
import "./helpers/DeployBLSHelper.sol";

/// @title DeployMorphoE2E - Deploy Morpho Blue + MetaMorpho (single-phase, no timelock wait)
/// @notice Deploys Morpho core, AdaptiveCurveIRM, ITPNAVOracle, creates a market,
///         deploys MetaMorpho vault (timelock=0), submits+accepts cap, sets queue, seeds liquidity.
///         No evm_increaseTime needed — MIN_TIMELOCK is set to 0 for testnet.
///
///      BLS keys are generated deterministically via FFI (bls-tool) using seed indices 0,1,2.
///      This is the same approach as DeployFullSystemE2E — no env vars needed for BLS keys.
contract DeployMorphoE2E is DeployBLSHelper {
    using MarketParamsLib for MarketParams;

    // LLTV: 77% (Tier A per architecture)
    uint256 constant LLTV = 0.77e18;

    // Oracle price: 1 ITP vault token = 1 USDC (NAV starts at $1)
    // Both L3_WUSDC (loan) and vault ERC20 (collateral) are 18 decimals
    // Precision = 36 + loanDecimals - collateralDecimals = 36 + 18 - 18 = 36
    // So 1 USDC = 1e36
    uint256 constant INITIAL_ORACLE_PRICE = 1e36;

    // MetaMorpho vault supply cap per market
    uint256 constant SUPPLY_CAP = type(uint184).max;

    // BLS constants (3 oracles, 2/3 threshold)
    uint256 constant ORACLE_COUNT = 3;
    uint256 constant BLS_THRESHOLD = 2;

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(anvilKey);

        // Read existing deployment addresses
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");
        // Use the MAIN OracleRegistry for the oracle — keeps nonces in sync
        // when registry syncs happen during ITP creation/rebalance
        address mainRegistry = vm.envAddress("ORACLE_REGISTRY");

        console.log("Deployer:", deployer);
        console.log("SettlementUSDC:", settlementUSDC);
        console.log("ITP Vault (collateral):", itpVault);
        console.log("OracleRegistry (shared):", mainRegistry);

        vm.startBroadcast(anvilKey);

        // 1. Deploy Morpho Blue core
        Morpho morpho = new Morpho(deployer);
        console.log("Morpho deployed:", address(morpho));

        // 2. Deploy CuratorRateIRM
        CuratorRateIRM irm = new CuratorRateIRM(address(morpho), deployer);
        console.log("CuratorRateIRM deployed:", address(irm));

        // 3. Deploy ITPNAVOracle using the main OracleRegistry
        // (no separate MirrorOracleRegistry — avoids nonce desync when
        //  registry syncs happen during ITP create/rebalance consensus)
        ITPNAVOracle oracle = new ITPNAVOracle(mainRegistry, itpVault, INITIAL_ORACLE_PRICE);
        console.log("ITPNAVOracle deployed:", address(oracle));
        console.log("  Initial price:", INITIAL_ORACLE_PRICE, "(1:1 ITP/USDC, 36 decimal precision)");

        // Authorize ITPNAVOracle for incrementMissedCounts on main registry.
        // On a live testnet the registry admin is the issuer-2 key, not the deployer.
        // If ADMIN_KEY is set, switch broadcast to it for this single call.
        uint256 adminKey = vm.envOr("ADMIN_KEY", uint256(0));
        if (adminKey != 0 && vm.addr(adminKey) != deployer) {
            vm.stopBroadcast();
            vm.startBroadcast(adminKey);
            MirrorOracleRegistry(mainRegistry).setAuthorizedMissedCountCaller(address(oracle), true);
            vm.stopBroadcast();
            vm.startBroadcast(anvilKey);
        } else {
            MirrorOracleRegistry(mainRegistry).setAuthorizedMissedCountCaller(address(oracle), true);
        }
        console.log("  ITPNAVOracle authorized for incrementMissedCounts");

        // Push initial BLS-signed price update so oracle is not stale
        // Use the main registry's current nonce for BLS verification
        uint256 registryNonce = MirrorOracleRegistry(mainRegistry).lastSnapshotNonce();
        uint256 activeBitmask = (1 << ORACLE_COUNT) - 1; // 0x07 for 3 oracles
        bytes32 navHash = keccak256(
            abi.encode(block.chainid, address(oracle), itpVault, INITIAL_ORACLE_PRICE, block.timestamp, uint256(1))
        );
        bytes memory navSig = blsSign("0,1,2", navHash);
        oracle.updatePrice(INITIAL_ORACLE_PRICE, block.timestamp, 1, navSig, registryNonce, activeBitmask);
        console.log("  Initial BLS-signed price pushed to oracle (nonce:", registryNonce, ")");

        // 4. Enable IRM and LLTV on Morpho
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);
        console.log("IRM enabled, LLTV 77% enabled");

        // 5. Create market
        MarketParams memory marketParams = MarketParams({
            loanToken: settlementUSDC,
            collateralToken: itpVault,
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });

        morpho.createMarket(marketParams);
        Id marketId = marketParams.id();
        console.log("Market created, ID:");
        console.logBytes32(Id.unwrap(marketId));

        // Set initial borrow rate: 5% APR = 0.05 / 31536000 ≈ 1585489599 WAD per second
        irm.setRate(marketId, 1585489599);
        console.log("Initial borrow rate set: 5% APR");

        // 6. Deploy MetaMorpho vault (timelock=0 for testnet, no waiting)
        MetaMorpho vault = new MetaMorpho(
            deployer,
            address(morpho),
            0,
            settlementUSDC,
            "Index ITP Lending Vault",
            "ilUSDC"
        );
        address vaultAddr = address(vault);
        console.log("MetaMorpho vault deployed:", vaultAddr);

        // 7. Submit + accept cap immediately (MIN_TIMELOCK=0, no waiting)
        vault.submitCap(marketParams, SUPPLY_CAP);
        vault.acceptCap(marketParams);
        console.log("Supply cap submitted and accepted");

        // 8. Set supply queue
        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = marketId;
        vault.setSupplyQueue(supplyQueue);
        console.log("Supply queue set");

        // 9. Seed vault with initial USDC liquidity
        uint256 initialLiquidity = 100_000 * 1e18;
        MockERC20(settlementUSDC).mint(deployer, initialLiquidity);
        IERC20(settlementUSDC).approve(vaultAddr, initialLiquidity);
        vault.deposit(initialLiquidity, deployer);
        console.log("Vault seeded with 100k USDC");

        vm.stopBroadcast();

        // 8. Write deployment JSON (split into chunks to avoid stack-too-deep)
        string memory p1 = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "deployer": "', vm.toString(deployer),
            '",\n  "timestamp": ', vm.toString(block.timestamp),
            ',\n  "contracts": {\n'
        );
        string memory p2 = string.concat(
            '    "MORPHO": "', vm.toString(address(morpho)),
            '",\n    "CURATOR_RATE_IRM": "', vm.toString(address(irm)),
            '",\n    "MIRROR_REGISTRY": "', vm.toString(mainRegistry),
            '",\n    "ITP_NAV_ORACLE": "', vm.toString(address(oracle)),
            '",\n    "METAMORPHO_VAULT": "', vm.toString(vaultAddr),
            '",\n    "MARKET_ID": "', vm.toString(Id.unwrap(marketId)),
            '"\n  },\n'
        );
        string memory p3 = string.concat(
            '  "marketParams": {\n',
            '    "loanToken": "', vm.toString(settlementUSDC),
            '",\n    "collateralToken": "', vm.toString(itpVault),
            '",\n    "oracle": "', vm.toString(address(oracle)),
            '",\n    "irm": "', vm.toString(address(irm)),
            '",\n    "lltv": "', vm.toString(LLTV),
            '"\n  }\n}\n'
        );
        vm.writeFile(string.concat(vm.projectRoot(), "/../deployments/morpho-e2e.json"), string.concat(p1, p2, p3));
        console.log("Deployment written to deployments/morpho-e2e.json");
    }
}

// ConfigureMorphoE2E removed — Phase 2 merged into DeployMorphoE2E (no timelock wait needed)
