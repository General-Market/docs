// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho, IMetaMorphoBase} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title DeployMorphoE2E - Deploy Morpho Blue + MetaMorpho for E2E testing (Phase 1)
/// @notice Deploys Morpho core, AdaptiveCurveIRM, MirrorIssuerRegistry + ITPNAVOracle,
///         creates a market, deploys MetaMorpho vault, and submits supply cap.
/// @dev Story 8.5: After this script, the deploy bash script must:
///      1. cast rpc evm_increaseTime 86401
///      2. cast rpc evm_mine
///      3. Run ConfigureMorphoE2E to accept cap, set queue, and seed liquidity
///
///      BLS keys are generated deterministically via FFI (bls-tool) using seed indices 0,1,2.
///      This is the same approach as DeployFullSystemE2E — no env vars needed for BLS keys.
///
/// TODO: After this change, update these consumers that still reference MOCK_ORACLE:
///   - data-node/src/chain_pollers.rs (deployment_addr "MOCK_ORACLE")
///   - data-node/src/api.rs (deployment_addr "MOCK_ORACLE")
///   - frontend/lib/contracts/morpho-addresses.ts (c.MOCK_ORACLE)
///   - frontend/e2e/helpers/api-interceptor.ts (MOCK_ORACLE)
///   - frontend/e2e/tests/10-morpho-oracle-health.spec.ts (MOCK_ORACLE)
///   - scripts/stress-test/config.ts (MOCK_ORACLE)
///   - contracts/script/DeployMorphoMarket.s.sol (MOCK_ORACLE)
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

    // BLS constants (3 issuers, 2/3 threshold)
    uint256 constant ISSUER_COUNT = 3;
    uint256 constant BLS_THRESHOLD = 2;

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

        // Generate BLS keys via FFI (deterministic seeds 0,1,2 — same as DeployFullSystemE2E)
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        bytes[] memory issuerPubkeys = new bytes[](ISSUER_COUNT);
        uint256[] memory issuerIds = new uint256[](ISSUER_COUNT);
        for (uint8 i = 0; i < ISSUER_COUNT; i++) {
            issuerPubkeys[i] = blsPubkey(i);
            issuerIds[i] = i;
        }

        vm.startBroadcast(anvilKey);

        // 1. Deploy Morpho Blue core
        Morpho morpho = new Morpho(deployer);
        console.log("Morpho deployed:", address(morpho));

        // 2. Deploy AdaptiveCurveIRM
        AdaptiveCurveIrm irm = new AdaptiveCurveIrm(address(morpho));
        console.log("AdaptiveCurveIRM deployed:", address(irm));

        // 3a. Deploy MirrorIssuerRegistry (UUPS proxy)
        // initialize(aggPubkey, threshold, activeCount, admin)
        MirrorIssuerRegistry registryImpl = new MirrorIssuerRegistry();
        bytes memory initData = abi.encodeCall(
            MirrorIssuerRegistry.initialize,
            (aggPubkey, BLS_THRESHOLD, ISSUER_COUNT, deployer)
        );
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), initData);
        address mirrorRegistry = address(registryProxy);
        console.log("MirrorIssuerRegistry impl:", address(registryImpl));
        console.log("MirrorIssuerRegistry proxy:", mirrorRegistry);

        // 3b. Sync MirrorIssuerRegistry with individual pubkeys (TOFU bootstrap)
        // First sync verifies against aggregated pubkey, then stores individual keys + snapshot
        uint256 syncNonce = 1;
        uint256 activeBitmask = (1 << ISSUER_COUNT) - 1; // 0x07 for 3 issuers
        bytes32 syncHash = keccak256(
            abi.encode(
                "REGISTRY_SYNC",
                block.chainid,
                mirrorRegistry,
                syncNonce,
                keccak256(abi.encode(issuerPubkeys, issuerIds)),
                activeBitmask,
                ISSUER_COUNT,
                BLS_THRESHOLD
            )
        );
        bytes memory syncSig = blsSign("0,1,2", syncHash);
        MirrorIssuerRegistry(mirrorRegistry).sync(
            issuerPubkeys, issuerIds, activeBitmask, ISSUER_COUNT, BLS_THRESHOLD,
            syncNonce, syncSig, 0, 0
        );
        console.log("MirrorIssuerRegistry synced with individual pubkeys (TOFU bootstrap)");

        // 3c. Deploy ITPNAVOracle
        // constructor(issuerRegistry, itpAddress, initialPrice)
        ITPNAVOracle oracle = new ITPNAVOracle(mirrorRegistry, itpVault, INITIAL_ORACLE_PRICE);
        console.log("ITPNAVOracle deployed:", address(oracle));
        console.log("  Initial price:", INITIAL_ORACLE_PRICE, "(1:1 ITP/USDC, 36 decimal precision)");

        // 3d. Authorize ITPNAVOracle for incrementMissedCounts on MirrorIssuerRegistry
        MirrorIssuerRegistry(mirrorRegistry).setAuthorizedMissedCountCaller(address(oracle), true);
        console.log("  ITPNAVOracle authorized for incrementMissedCounts");

        // 3e. Push initial BLS-signed price update so oracle is not stale
        bytes32 navHash = keccak256(
            abi.encode(block.chainid, address(oracle), itpVault, INITIAL_ORACLE_PRICE, block.timestamp, uint256(1))
        );
        bytes memory navSig = blsSign("0,1,2", navHash);
        oracle.updatePrice(INITIAL_ORACLE_PRICE, block.timestamp, 1, navSig, syncNonce, activeBitmask);
        console.log("  Initial BLS-signed price pushed to oracle");

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
            '",\n    "MIRROR_REGISTRY": "', vm.toString(mirrorRegistry),
            '",\n    "ITP_NAV_ORACLE": "', vm.toString(address(oracle)),
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
    uint256 constant INITIAL_VAULT_LIQUIDITY = 100_000 * 1e18;

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        // Read deployment addresses from morpho-e2e.json via env vars
        address vaultAddr = vm.envAddress("METAMORPHO_VAULT");
        address arbUSDC = vm.envAddress("ARB_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");
        address oracleAddr = vm.envAddress("ITP_NAV_ORACLE");
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
