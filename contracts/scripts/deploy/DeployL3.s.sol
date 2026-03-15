// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Upgradeable contracts (UUPS proxy pattern)
import {Governance} from "../../src/Governance.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {FeeRegistry} from "../../src/registry/FeeRegistry.sol";
import {BLSCustody} from "../../src/core/BLSCustody.sol";
import {L3BridgeCustody} from "../../src/custody/L3BridgeCustody.sol";
import {Investment} from "../../src/core/Investment.sol";

// Non-upgradeable contracts (constructor-based)
import {AssetPairRegistry} from "../../src/registry/AssetPairRegistry.sol";
import {CollateralRegistry} from "../../src/registry/CollateralRegistry.sol";

// Libraries
import {BLSLib} from "../../src/libraries/BLSLib.sol";

// BLS FFI helpers for PoP signature generation
import {DeployBLSHelper} from "../../script/helpers/DeployBLSHelper.sol";

/// @title DeployL3 - Full L3 testnet deployment script
/// @notice Deploys all Index L3 contracts with correct initialization order
/// @dev Run with: forge script scripts/deploy/DeployL3.s.sol --rpc-url $TESTNET_RPC --broadcast
contract DeployL3 is DeployBLSHelper {
    // ============ DEPLOYED ADDRESSES ============

    // Proxies (upgradeable)
    address public governanceProxy;
    address public oracleRegistryProxy;
    address public feeRegistryProxy;
    address public blsCustodyProxy;
    address public l3BridgeCustodyProxy;
    address public indexProxy;

    // Implementations (upgradeable)
    address public governanceImpl;
    address public oracleRegistryImpl;
    address public feeRegistryImpl;
    address public blsCustodyImpl;
    address public l3BridgeCustodyImpl;
    address public indexImpl;

    // Non-upgradeable
    address public assetPairRegistryAddr;
    address public collateralRegistryAddr;

    // Stored for JSON output
    address internal _usdc;

    function run() external {
        // ============ LOAD ENVIRONMENT ============

        uint256 deployerPrivateKey = vm.envOr("ORBIT_DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "No deployer private key set (ORBIT_DEPLOYER_PRIVATE_KEY or PRIVATE_KEY)");

        address deployer = vm.addr(deployerPrivateKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address usdc = vm.envOr("COLLATERAL_ADDRESS", vm.envOr("ORBIT_WUSDC_ADDRESS", address(0)));
        require(usdc != address(0), "No USDC address set (COLLATERAL_ADDRESS or ORBIT_WUSDC_ADDRESS)");
        _usdc = usdc;

        console2.log("===========================================");
        console2.log("INDEX L3 TESTNET DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Admin:", admin);
        console2.log("USDC (wUSDC):", usdc);
        console2.log("Balance:", deployer.balance);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============ PHASE 1: Governance (no deps) ============
        console2.log("--- Phase 1: Governance ---");
        _deployGovernance(admin);

        // ============ PHASE 2: Registries ============
        console2.log("--- Phase 2: Registries ---");
        _deployRegistries(admin);

        // ============ PHASE 3: Custody (depends on OracleRegistry) ============
        console2.log("--- Phase 3: Custody ---");
        _deployCustody(usdc);

        // ============ PHASE 4: Core (depends on Governance + USDC) ============
        console2.log("--- Phase 4: Core ---");
        _deployIndex(usdc);

        // ============ PHASE 5: ITP ============
        console2.log("--- Phase 5: ITP ---");
        console2.log("  ITP: created dynamically via Investment.createITP() (no standalone deploy)");

        // ============ PHASE 6: Post-deploy wiring ============
        console2.log("--- Phase 6: Post-deploy wiring ---");
        _wireIndexRegistries();

        // Oracle registration is optional - skip if SKIP_ORACLE_REGISTRATION is set
        bool skipOracles = vm.envOr("SKIP_ORACLE_REGISTRATION", false);
        if (!skipOracles) {
            _registerTestOracles();
        } else {
            console2.log("  Skipping oracle registration (SKIP_ORACLE_REGISTRATION=true)");
            console2.log("  Register oracles manually with correct G2 BLS pubkeys");
        }

        vm.stopBroadcast();

        // ============ WRITE DEPLOYMENT JSON ============
        _saveDeployment(deployer);
    }

    // ============ PHASE 1 ============

    function _deployGovernance(address admin) internal {
        Governance impl = new Governance();
        governanceImpl = address(impl);

        bytes memory initData = abi.encodeWithSelector(Governance.initialize.selector, admin);
        ERC1967Proxy proxy = new ERC1967Proxy(governanceImpl, initData);
        governanceProxy = address(proxy);

        // Verify
        Governance gov = Governance(governanceProxy);
        require(gov.admin() == admin, "Governance: admin mismatch");
        require(!gov.isPaused(), "Governance: should not be paused");
        console2.log("  Governance impl:", governanceImpl);
        console2.log("  Governance proxy:", governanceProxy);
    }

    // ============ PHASE 2 ============

    function _deployRegistries(address admin) internal {
        // OracleRegistry (UUPS, depends on Governance)
        {
            OracleRegistry impl = new OracleRegistry();
            oracleRegistryImpl = address(impl);

            bytes memory initData = abi.encodeWithSelector(OracleRegistry.initialize.selector, governanceProxy);
            ERC1967Proxy proxy = new ERC1967Proxy(oracleRegistryImpl, initData);
            oracleRegistryProxy = address(proxy);

            OracleRegistry reg = OracleRegistry(oracleRegistryProxy);
            require(address(reg.governance()) == governanceProxy, "OracleRegistry: governance mismatch");
            require(reg.activeOracleCount() == 0, "OracleRegistry: active count should be 0");
            console2.log("  OracleRegistry impl:", oracleRegistryImpl);
            console2.log("  OracleRegistry proxy:", oracleRegistryProxy);
        }

        // FeeRegistry (UUPS, admin-based)
        {
            FeeRegistry impl = new FeeRegistry();
            feeRegistryImpl = address(impl);

            bytes memory initData = abi.encodeWithSelector(FeeRegistry.initialize.selector, admin);
            ERC1967Proxy proxy = new ERC1967Proxy(feeRegistryImpl, initData);
            feeRegistryProxy = address(proxy);

            FeeRegistry reg = FeeRegistry(feeRegistryProxy);
            require(reg.admin() == admin, "FeeRegistry: admin mismatch");
            console2.log("  FeeRegistry impl:", feeRegistryImpl);
            console2.log("  FeeRegistry proxy:", feeRegistryProxy);
        }

        // AssetPairRegistry (non-upgradeable, constructor)
        {
            AssetPairRegistry apr = new AssetPairRegistry(admin, oracleRegistryProxy);
            assetPairRegistryAddr = address(apr);

            require(apr.admin() == admin, "AssetPairRegistry: admin mismatch");
            console2.log("  AssetPairRegistry:", assetPairRegistryAddr);
        }

        // CollateralRegistry (non-upgradeable, constructor)
        {
            CollateralRegistry cr = new CollateralRegistry(admin, oracleRegistryProxy);
            collateralRegistryAddr = address(cr);

            require(cr.admin() == admin, "CollateralRegistry: admin mismatch");
            console2.log("  CollateralRegistry:", collateralRegistryAddr);
        }
    }

    // ============ PHASE 3 ============

    function _deployCustody(address usdc) internal {
        // BLSCustody (UUPS)
        {
            BLSCustody impl = new BLSCustody();
            blsCustodyImpl = address(impl);

            bytes memory initData = abi.encodeWithSelector(BLSCustody.initialize.selector, oracleRegistryProxy);
            ERC1967Proxy proxy = new ERC1967Proxy(blsCustodyImpl, initData);
            blsCustodyProxy = address(proxy);

            BLSCustody custody = BLSCustody(blsCustodyProxy);
            require(address(custody.oracleRegistry()) == oracleRegistryProxy, "BLSCustody: oracleRegistry mismatch");
            console2.log("  BLSCustody impl:", blsCustodyImpl);
            console2.log("  BLSCustody proxy:", blsCustodyProxy);
        }

        // L3BridgeCustody (UUPS)
        {
            L3BridgeCustody impl = new L3BridgeCustody();
            l3BridgeCustodyImpl = address(impl);

            bytes memory initData = abi.encodeWithSelector(
                L3BridgeCustody.initialize.selector, oracleRegistryProxy, usdc
            );
            ERC1967Proxy proxy = new ERC1967Proxy(l3BridgeCustodyImpl, initData);
            l3BridgeCustodyProxy = address(proxy);

            L3BridgeCustody custody = L3BridgeCustody(l3BridgeCustodyProxy);
            require(
                address(custody.oracleRegistry()) == oracleRegistryProxy, "L3BridgeCustody: oracleRegistry mismatch"
            );
            require(address(custody.usdc()) == usdc, "L3BridgeCustody: usdc mismatch");
            console2.log("  L3BridgeCustody impl:", l3BridgeCustodyImpl);
            console2.log("  L3BridgeCustody proxy:", l3BridgeCustodyProxy);
        }
    }

    // ============ PHASE 4 ============

    function _deployIndex(address usdc) internal {
        Investment impl = new Investment();
        indexImpl = address(impl);

        bytes memory initData = abi.encodeWithSelector(Investment.initialize.selector, governanceProxy, usdc);
        ERC1967Proxy proxy = new ERC1967Proxy(indexImpl, initData);
        indexProxy = address(proxy);

        Investment idx = Investment(indexProxy);
        require(address(idx.governance()) == governanceProxy, "Investment: governance mismatch");
        require(address(idx.usdc()) == usdc, "Investment: usdc mismatch");
        console2.log("  Investment impl:", indexImpl);
        console2.log("  Investment proxy:", indexProxy);
    }

    // ============ PHASE 6 ============

    function _wireIndexRegistries() internal {
        Investment idx = Investment(indexProxy);

        // Wire OracleRegistry into Investment (one-time setter)
        idx.setOracleRegistry(oracleRegistryProxy);
        console2.log("  Investment.setOracleRegistry:", oracleRegistryProxy);

        // Wire FeeRegistry into Investment
        idx.setFeeRegistry(feeRegistryProxy);
        console2.log("  Investment.setFeeRegistry:", feeRegistryProxy);
    }

    function _registerTestOracles() internal {
        // Skip oracle registration when SKIP_ORACLE_REGISTRATION=true
        // This allows local-e2e-deploy.sh to register oracles with correct BLS keys
        bool skipRegistration = vm.envOr("SKIP_ORACLE_REGISTRATION", false);
        if (skipRegistration) {
            console2.log("  Skipping oracle registration (SKIP_ORACLE_REGISTRATION=true)");
            return;
        }

        OracleRegistry reg = OracleRegistry(oracleRegistryProxy);

        // Oracle addresses from index-system.env
        // These match the addresses derived from the private keys
        address oracle1Addr = vm.envOr("ORACLE_1_ADDRESS", address(0xC0D3C9E530ca6d71469bB678E6592274154D9caD));
        address oracle2Addr = vm.envOr("ORACLE_2_ADDRESS", address(0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4));
        address oracle3Addr = vm.envOr("ORACLE_3_ADDRESS", address(0xC0D3C8DFd3445fd2e4dfED9D11b5B7032B3BD1ac));

        // Real BLS G2 pubkeys from deterministic seeds via FFI (matching node-id 0,1,2)
        // PoP signatures prove each oracle controls the corresponding BLS private key

        // Must snapshot (setAggregatedPubkey) after EACH addOracle due to PendingSnapshot constraint

        // Oracle 1 (node-id 0)
        {
            bytes memory pubkey = blsPubkey(0);
            bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), oracle1Addr, pubkey));
            bytes memory popSig = blsSign("0", popMsg);
            uint256 id = reg.addOracle(oracle1Addr, bytes32("oracle1.index.network"), pubkey, popSig);
            reg.setAggregatedPubkey(blsPubkey(0), 1);
            console2.log("  Oracle 1 registered, id:", id);
            console2.log("    Address:", oracle1Addr);
        }

        // Oracle 2 (node-id 1)
        {
            bytes memory pubkey = blsPubkey(1);
            bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), oracle2Addr, pubkey));
            bytes memory popSig = blsSign("1", popMsg);
            uint256 id = reg.addOracle(oracle2Addr, bytes32("oracle2.index.network"), pubkey, popSig);
            reg.setAggregatedPubkey(blsAggPubkey("0,1"), 2);
            console2.log("  Oracle 2 registered, id:", id);
            console2.log("    Address:", oracle2Addr);
        }

        // Oracle 3 (node-id 2)
        {
            bytes memory pubkey = blsPubkey(2);
            bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), oracle3Addr, pubkey));
            bytes memory popSig = blsSign("2", popMsg);
            uint256 id = reg.addOracle(oracle3Addr, bytes32("oracle3.index.network"), pubkey, popSig);
            reg.setAggregatedPubkey(blsAggPubkey("0,1,2"), 3);
            console2.log("  Oracle 3 registered, id:", id);
            console2.log("    Address:", oracle3Addr);
        }

        // Verify registration
        require(reg.activeOracleCount() == 3, "OracleRegistry: expected 3 active oracles");
        console2.log("  Active oracles:", reg.activeOracleCount());
        console2.log("  Aggregated pubkey set (snapshot after each addOracle)");
    }

    // ============ JSON OUTPUT ============

    function _saveDeployment(address deployer) internal {
        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");

        // Build JSON in parts to avoid stack-too-deep
        string memory part1 = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "Governance": "', vm.toString(governanceProxy), '",\n',
            '    "GovernanceImpl": "', vm.toString(governanceImpl), '",\n'
        );

        string memory part2 = string.concat(
            '    "OracleRegistry": "', vm.toString(oracleRegistryProxy), '",\n',
            '    "OracleRegistryImpl": "', vm.toString(oracleRegistryImpl), '",\n',
            '    "FeeRegistry": "', vm.toString(feeRegistryProxy), '",\n',
            '    "FeeRegistryImpl": "', vm.toString(feeRegistryImpl), '",\n',
            '    "AssetPairRegistry": "', vm.toString(assetPairRegistryAddr), '",\n',
            '    "CollateralRegistry": "', vm.toString(collateralRegistryAddr), '",\n'
        );

        string memory part3 = string.concat(
            '    "BLSCustody": "', vm.toString(blsCustodyProxy), '",\n',
            '    "BLSCustodyImpl": "', vm.toString(blsCustodyImpl), '",\n',
            '    "L3BridgeCustody": "', vm.toString(l3BridgeCustodyProxy), '",\n',
            '    "L3BridgeCustodyImpl": "', vm.toString(l3BridgeCustodyImpl), '",\n',
            '    "Index": "', vm.toString(indexProxy), '",\n',
            '    "IndexImpl": "', vm.toString(indexImpl), '",\n',
            '    "USDC": "', vm.toString(_usdc), '"\n',
            '  }\n',
            '}'
        );

        string memory json = string.concat(part1, part2, part3);
        vm.writeFile("../deployments/l3-testnet.json", json);
        console2.log("Addresses saved to: deployments/l3-testnet.json");
    }
}
