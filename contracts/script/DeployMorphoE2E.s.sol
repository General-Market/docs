// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho, IMetaMorphoBase} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {MockMorphoOracle} from "../src/mocks/MockMorphoOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployMorphoE2E - Deploy Morpho Blue + MetaMorpho for E2E testing (Phase 1)
/// @notice Deploys Morpho core, AdaptiveCurveIRM, MockMorphoOracle, creates a market,
///         deploys MetaMorpho vault, and submits supply cap.
/// @dev Story 8.5: After this script, the deploy bash script must:
///      1. cast rpc evm_increaseTime 86401
///      2. cast rpc evm_mine
///      3. Run ConfigureMorphoE2E to accept cap, set queue, and seed liquidity
contract DeployMorphoE2E is Script {
    using MarketParamsLib for MarketParams;

    // LLTV: 77% (Tier A per architecture)
    uint256 constant LLTV = 0.77e18;

    // Oracle price: 1 ITP = 100 USDC (example price for testing)
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
        address arbUSDC = vm.envAddress("ARB_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");

        console.log("Deployer:", deployer);
        console.log("ArbUSDC:", arbUSDC);
        console.log("ITP Vault (collateral):", itpVault);

        vm.startBroadcast(anvilKey);

        // 1. Deploy Morpho Blue core
        Morpho morpho = new Morpho(deployer);
        console.log("Morpho deployed:", address(morpho));

        // 2. Deploy AdaptiveCurveIRM
        AdaptiveCurveIrm irm = new AdaptiveCurveIrm(address(morpho));
        console.log("AdaptiveCurveIRM deployed:", address(irm));

        // 3. Deploy MockMorphoOracle
        MockMorphoOracle oracle = new MockMorphoOracle(INITIAL_ORACLE_PRICE);
        console.log("MockMorphoOracle deployed:", address(oracle));
        console.log("  Initial price:", INITIAL_ORACLE_PRICE, "(100 USDC per ITP, 24 decimal precision)");

        // 4. Enable IRM and LLTV on Morpho
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);
        console.log("IRM enabled, LLTV 77% enabled");

        // 5. Create market
        MarketParams memory marketParams = MarketParams({
            loanToken: arbUSDC,
            collateralToken: itpVault,
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });

        morpho.createMarket(marketParams);
        Id marketId = marketParams.id();
        console.log("Market created, ID:");
        console.logBytes32(Id.unwrap(marketId));

        // 6. Deploy MetaMorpho vault (via_ir=true in foundry.toml, matches test deployment)
        // MetaMorpho enforces MIN_TIMELOCK = 1 days
        MetaMorpho vault = new MetaMorpho(
            deployer,
            address(morpho),
            1 days,
            arbUSDC,
            "Index ITP Lending Vault",
            "ilUSDC"
        );
        address vaultAddr = address(vault);
        console.log("MetaMorpho vault deployed:", vaultAddr);

        // 7. Submit supply cap (timelock starts now)
        vault.submitCap(marketParams, SUPPLY_CAP);
        console.log("Supply cap submitted (timelock started)");

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
            '",\n    "ADAPTIVE_IRM": "', vm.toString(address(irm)),
            '",\n    "MOCK_ORACLE": "', vm.toString(address(oracle)),
            '",\n    "METAMORPHO_VAULT": "', vm.toString(vaultAddr),
            '",\n    "MARKET_ID": "', vm.toString(Id.unwrap(marketId)),
            '"\n  },\n'
        );
        string memory p3 = string.concat(
            '  "marketParams": {\n',
            '    "loanToken": "', vm.toString(arbUSDC),
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

/// @title ConfigureMorphoE2E - Configure MetaMorpho vault after timelock (Phase 2)
/// @notice Accepts supply cap, sets supply queue, and seeds vault with USDC liquidity.
/// @dev Must be run AFTER evm_increaseTime(86401) + evm_mine to pass the timelock.
contract ConfigureMorphoE2E is Script {
    using MarketParamsLib for MarketParams;

    uint256 constant LLTV = 0.77e18;
    uint256 constant INITIAL_VAULT_LIQUIDITY = 100_000 * 1e6;

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        // Read deployment addresses from morpho-e2e.json via env vars
        address vaultAddr = vm.envAddress("METAMORPHO_VAULT");
        address arbUSDC = vm.envAddress("ARB_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");
        address oracleAddr = vm.envAddress("MOCK_ORACLE");
        address irmAddr = vm.envAddress("ADAPTIVE_IRM");

        MarketParams memory marketParams = MarketParams({
            loanToken: arbUSDC,
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
        MockERC20(arbUSDC).mint(vm.addr(anvilKey), INITIAL_VAULT_LIQUIDITY);
        IERC20(arbUSDC).approve(vaultAddr, INITIAL_VAULT_LIQUIDITY);
        vault.deposit(INITIAL_VAULT_LIQUIDITY, vm.addr(anvilKey));
        console.log("Vault seeded with", INITIAL_VAULT_LIQUIDITY / 1e6, "USDC");

        vm.stopBroadcast();
    }
}
