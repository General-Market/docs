// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployMorphoMarket - Deploy Morpho Blue market with real ITPNAVOracle (Phase 1)
/// @notice Deploys ITPNAVOracle, creates Morpho market, deploys MetaMorpho vault, submits supply cap.
/// @dev Story 8.7: Replaces MockMorphoOracle with real BLS-verified ITPNAVOracle.
///      Uses existing Morpho core + AdaptiveCurveIRM from Story 8.5 (morpho-e2e.json).
///      After this script, run: cast rpc evm_increaseTime 86401 && cast rpc evm_mine
///      Then run ConfigureMorphoMarket to accept cap, set queue, and seed liquidity.
contract DeployMorphoMarket is Script {
    using MarketParamsLib for MarketParams;

    // LLTV: 77% (Tier A per architecture)
    uint256 constant LLTV = 0.77e18;

    // Oracle price: 1 ITP = 100 USDC
    // Precision = 36 + loanDecimals - collateralDecimals = 36 + 6 - 18 = 24
    // So 100 USDC = 100e24
    uint256 constant INITIAL_ORACLE_PRICE = 100e24;

    // MetaMorpho vault supply cap per market
    uint256 constant SUPPLY_CAP = type(uint184).max;

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(anvilKey);

        // Read existing deployment addresses
        address morphoAddr = vm.envAddress("MORPHO");
        address irmAddr = vm.envAddress("ADAPTIVE_IRM");
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");
        address mirrorRegistry = vm.envAddress("MIRROR_REGISTRY");

        // Preserve MOCK_ORACLE from Story 8.5 deployment (append semantics)
        address mockOracle = vm.envOr("MOCK_ORACLE", address(0));

        // Curator and allocator addresses (default to deployer for local testing)
        address curatorAddr = vm.envOr("CURATOR_ADDRESS", deployer);
        address allocatorAddr = vm.envOr("ALLOCATOR_ADDRESS", deployer);

        console.log("Deployer:", deployer);
        console.log("Morpho:", morphoAddr);
        console.log("AdaptiveIRM:", irmAddr);
        console.log("SettlementUSDC:", settlementUSDC);
        console.log("ITP Vault (collateral):", itpVault);
        console.log("MirrorOracleRegistry:", mirrorRegistry);

        Morpho morpho = Morpho(morphoAddr);

        vm.startBroadcast(anvilKey);

        // 1. Deploy ITPNAVOracle (3-param constructor: mirrorRegistry, itpAddress, initialPrice)
        // Constructor sets currentPrice and lastUpdated, so price() works immediately.
        // BLS-signed updatePrice() is tested in MorphoBorrowLend.t.sol; in production,
        // the oracle network pushes the first real BLS-signed update after deployment.
        ITPNAVOracle oracle = new ITPNAVOracle(mirrorRegistry, itpVault, INITIAL_ORACLE_PRICE);
        console.log("ITPNAVOracle deployed:", address(oracle));
        console.log("  Initial price:", INITIAL_ORACLE_PRICE, "(100 USDC per ITP, 24 decimal precision)");
        console.log("  oracle.price():", oracle.price());

        // 2. Create Morpho market with real ITPNAVOracle
        MarketParams memory marketParams = MarketParams({
            loanToken: settlementUSDC,
            collateralToken: itpVault,
            oracle: address(oracle),
            irm: irmAddr,
            lltv: LLTV
        });

        morpho.createMarket(marketParams);
        Id marketId = marketParams.id();
        console.log("Market created with ITPNAVOracle, ID:");
        console.logBytes32(Id.unwrap(marketId));

        // 3. Deploy MetaMorpho vault (MIN_TIMELOCK = 1 days enforced by MetaMorpho)
        MetaMorpho vault = new MetaMorpho(
            deployer,
            morphoAddr,
            1 days,
            settlementUSDC,
            "Index ITP Lending Vault",
            "ilUSDC"
        );
        address vaultAddr = address(vault);
        console.log("MetaMorpho vault deployed:", vaultAddr);

        // 4. Set curator and allocator roles
        vault.setCurator(curatorAddr);
        vault.setIsAllocator(allocatorAddr, true);
        console.log("  Curator:", curatorAddr);
        console.log("  Allocator:", allocatorAddr);

        // 5. Submit supply cap (timelock starts now)
        vault.submitCap(marketParams, SUPPLY_CAP);
        console.log("Supply cap submitted (timelock started, need 1 day to accept)");

        vm.stopBroadcast();

        // 6. Write deployment JSON (preserves MOCK_ORACLE from Story 8.5)
        string memory p1 = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "deployer": "', vm.toString(deployer),
            '",\n  "timestamp": ', vm.toString(block.timestamp),
            ',\n  "contracts": {\n'
        );
        string memory p2a = string.concat(
            '    "MORPHO": "', vm.toString(morphoAddr),
            '",\n    "ADAPTIVE_IRM": "', vm.toString(irmAddr),
            '",\n    "MOCK_ORACLE": "', vm.toString(mockOracle),
            '",\n    "ITP_NAV_ORACLE": "', vm.toString(address(oracle))
        );
        string memory p2 = string.concat(
            p2a,
            '",\n    "MIRROR_REGISTRY": "', vm.toString(mirrorRegistry),
            '",\n    "METAMORPHO_VAULT": "', vm.toString(vaultAddr),
            '",\n    "MARKET_ID": "', vm.toString(Id.unwrap(marketId)),
            '"\n  },\n'
        );
        string memory p3 = string.concat(
            '  "marketParams": {\n',
            '    "loanToken": "', vm.toString(settlementUSDC),
            '",\n    "collateralToken": "', vm.toString(itpVault),
            '",\n    "oracle": "', vm.toString(address(oracle)),
            '",\n    "irm": "', vm.toString(irmAddr),
            '",\n    "lltv": "', vm.toString(LLTV),
            '"\n  }\n}\n'
        );
        vm.writeFile(string.concat(vm.projectRoot(), "/../deployments/morpho-e2e.json"), string.concat(p1, p2, p3));
        console.log("Deployment written to deployments/morpho-e2e.json");
    }
}

/// @title ConfigureMorphoMarket - Configure MetaMorpho vault after timelock (Phase 2)
/// @notice Accepts supply cap, sets supply queue, and seeds vault with USDC liquidity.
/// @dev Must be run AFTER evm_increaseTime(86401) + evm_mine to pass the timelock.
contract ConfigureMorphoMarket is Script {
    using MarketParamsLib for MarketParams;

    uint256 constant LLTV = 0.77e18;
    uint256 constant INITIAL_VAULT_LIQUIDITY = 100_000 * 1e6; // 100k USDC

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        // Read deployment addresses
        address vaultAddr = vm.envAddress("METAMORPHO_VAULT");
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");
        address oracleAddr = vm.envAddress("ITP_NAV_ORACLE");
        address irmAddr = vm.envAddress("ADAPTIVE_IRM");

        MarketParams memory marketParams = MarketParams({
            loanToken: settlementUSDC,
            collateralToken: itpVault,
            oracle: oracleAddr,
            irm: irmAddr,
            lltv: LLTV
        });
        Id marketId = marketParams.id();

        MetaMorpho vault = MetaMorpho(vaultAddr);

        vm.startBroadcast(anvilKey);

        // Accept cap (timelock must have elapsed)
        vault.acceptCap(marketParams);

        // Set supply queue
        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = marketId;
        vault.setSupplyQueue(supplyQueue);
        console.log("Vault configured: supply cap accepted, supply queue set");

        // Seed vault with initial USDC liquidity
        MockERC20(settlementUSDC).mint(vm.addr(anvilKey), INITIAL_VAULT_LIQUIDITY);
        IERC20(settlementUSDC).approve(vaultAddr, INITIAL_VAULT_LIQUIDITY);
        vault.deposit(INITIAL_VAULT_LIQUIDITY, vm.addr(anvilKey));
        console.log("Vault seeded with", INITIAL_VAULT_LIQUIDITY / 1e6, "USDC");

        vm.stopBroadcast();
    }
}
