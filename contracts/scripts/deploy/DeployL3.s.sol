// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Upgradeable contracts (UUPS proxy pattern)
import {Governance} from "../../src/Governance.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {FeeRegistry} from "../../src/registry/FeeRegistry.sol";
import {BLSCustody} from "../../src/core/BLSCustody.sol";
import {L3BridgeCustody} from "../../src/custody/L3BridgeCustody.sol";
import {Index} from "../../src/core/Index.sol";

// Non-upgradeable contracts (constructor-based)
import {AssetPairRegistry} from "../../src/registry/AssetPairRegistry.sol";
import {CollateralRegistry} from "../../src/registry/CollateralRegistry.sol";

// Libraries
import {BLSLib} from "../../src/libraries/BLSLib.sol";

/// @title DeployL3 - Full L3 testnet deployment script
/// @notice Deploys all Index L3 contracts with correct initialization order
/// @dev Run with: forge script scripts/deploy/DeployL3.s.sol --rpc-url $TESTNET_RPC --broadcast
contract DeployL3 is Script {
    // ============ DEPLOYED ADDRESSES ============

    // Proxies (upgradeable)
    address public governanceProxy;
    address public issuerRegistryProxy;
    address public feeRegistryProxy;
    address public blsCustodyProxy;
    address public l3BridgeCustodyProxy;
    address public indexProxy;

    // Implementations (upgradeable)
    address public governanceImpl;
    address public issuerRegistryImpl;
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

        // ============ PHASE 3: Custody (depends on IssuerRegistry) ============
        console2.log("--- Phase 3: Custody ---");
        _deployCustody(usdc);

        // ============ PHASE 4: Core (depends on Governance + USDC) ============
        console2.log("--- Phase 4: Core ---");
        _deployIndex(usdc);

        // ============ PHASE 5: ITP ============
        console2.log("--- Phase 5: ITP ---");
        console2.log("  ITP: created dynamically via Index.createITP() (no standalone deploy)");

        // ============ PHASE 6: Post-deploy wiring ============
        console2.log("--- Phase 6: Post-deploy wiring ---");
        _wireIndexRegistries();

        // Issuer registration is optional - skip if SKIP_ISSUER_REGISTRATION is set
        bool skipIssuers = vm.envOr("SKIP_ISSUER_REGISTRATION", false);
        if (!skipIssuers) {
            _registerTestIssuers();
        } else {
            console2.log("  Skipping issuer registration (SKIP_ISSUER_REGISTRATION=true)");
            console2.log("  Register issuers manually with correct G2 BLS pubkeys");
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
        // IssuerRegistry (UUPS, depends on Governance)
        {
            IssuerRegistry impl = new IssuerRegistry();
            issuerRegistryImpl = address(impl);

            bytes memory initData = abi.encodeWithSelector(IssuerRegistry.initialize.selector, governanceProxy);
            ERC1967Proxy proxy = new ERC1967Proxy(issuerRegistryImpl, initData);
            issuerRegistryProxy = address(proxy);

            IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);
            require(address(reg.governance()) == governanceProxy, "IssuerRegistry: governance mismatch");
            require(reg.activeIssuerCount() == 0, "IssuerRegistry: active count should be 0");
            console2.log("  IssuerRegistry impl:", issuerRegistryImpl);
            console2.log("  IssuerRegistry proxy:", issuerRegistryProxy);
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
        // Test mode enables admin batch functions - ONLY for testnet/local deployments
        {
            bool testMode = vm.envOr("ASSET_PAIR_REGISTRY_TEST_MODE", false);
            AssetPairRegistry apr = new AssetPairRegistry(admin, testMode);
            assetPairRegistryAddr = address(apr);

            require(apr.admin() == admin, "AssetPairRegistry: admin mismatch");
            console2.log("  AssetPairRegistry:", assetPairRegistryAddr);
            console2.log("    Test mode:", testMode ? "ENABLED (E2E only)" : "DISABLED (production)");
        }

        // CollateralRegistry (non-upgradeable, constructor)
        {
            CollateralRegistry cr = new CollateralRegistry(admin);
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

            bytes memory initData = abi.encodeWithSelector(BLSCustody.initialize.selector, issuerRegistryProxy);
            ERC1967Proxy proxy = new ERC1967Proxy(blsCustodyImpl, initData);
            blsCustodyProxy = address(proxy);

            BLSCustody custody = BLSCustody(blsCustodyProxy);
            require(address(custody.issuerRegistry()) == issuerRegistryProxy, "BLSCustody: issuerRegistry mismatch");
            console2.log("  BLSCustody impl:", blsCustodyImpl);
            console2.log("  BLSCustody proxy:", blsCustodyProxy);
        }

        // L3BridgeCustody (UUPS)
        {
            L3BridgeCustody impl = new L3BridgeCustody();
            l3BridgeCustodyImpl = address(impl);

            bytes memory initData = abi.encodeWithSelector(
                L3BridgeCustody.initialize.selector, issuerRegistryProxy, usdc
            );
            ERC1967Proxy proxy = new ERC1967Proxy(l3BridgeCustodyImpl, initData);
            l3BridgeCustodyProxy = address(proxy);

            L3BridgeCustody custody = L3BridgeCustody(l3BridgeCustodyProxy);
            require(
                address(custody.issuerRegistry()) == issuerRegistryProxy, "L3BridgeCustody: issuerRegistry mismatch"
            );
            require(address(custody.usdc()) == usdc, "L3BridgeCustody: usdc mismatch");
            console2.log("  L3BridgeCustody impl:", l3BridgeCustodyImpl);
            console2.log("  L3BridgeCustody proxy:", l3BridgeCustodyProxy);
        }
    }

    // ============ PHASE 4 ============

    function _deployIndex(address usdc) internal {
        Index impl = new Index();
        indexImpl = address(impl);

        bytes memory initData = abi.encodeWithSelector(Index.initialize.selector, governanceProxy, usdc);
        ERC1967Proxy proxy = new ERC1967Proxy(indexImpl, initData);
        indexProxy = address(proxy);

        Index idx = Index(indexProxy);
        require(address(idx.governance()) == governanceProxy, "Index: governance mismatch");
        require(address(idx.usdc()) == usdc, "Index: usdc mismatch");
        console2.log("  Index impl:", indexImpl);
        console2.log("  Index proxy:", indexProxy);
    }

    // ============ PHASE 6 ============

    function _wireIndexRegistries() internal {
        Index idx = Index(indexProxy);

        // Wire IssuerRegistry into Index (one-time setter)
        idx.setIssuerRegistry(issuerRegistryProxy);
        console2.log("  Index.setIssuerRegistry:", issuerRegistryProxy);

        // Wire FeeRegistry into Index
        idx.setFeeRegistry(feeRegistryProxy);
        console2.log("  Index.setFeeRegistry:", feeRegistryProxy);
    }

    function _registerTestIssuers() internal {
        // Skip issuer registration when SKIP_ISSUER_REGISTRATION=true
        // This allows local-e2e-deploy.sh to register issuers with correct BLS keys
        bool skipRegistration = vm.envOr("SKIP_ISSUER_REGISTRATION", false);
        if (skipRegistration) {
            console2.log("  Skipping issuer registration (SKIP_ISSUER_REGISTRATION=true)");
            return;
        }

        IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);

        // Issuer addresses from index-system.env
        // These match the addresses derived from the private keys
        address issuer1Addr = vm.envOr("ISSUER_1_ADDRESS", address(0xC0D3C9E530ca6d71469bB678E6592274154D9caD));
        address issuer2Addr = vm.envOr("ISSUER_2_ADDRESS", address(0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4));
        address issuer3Addr = vm.envOr("ISSUER_3_ADDRESS", address(0xC0D3C8DFd3445fd2e4dfED9D11b5B7032B3BD1ac));

        // G2 pubkeys (128 bytes each) - deterministic from node-id seed [N, 0x42, 0, ...]
        // These are generated by the issuer nodes using --node-id flag
        // For now, use placeholder G2 points that will be replaced when nodes start
        // Format: [x_im (32), x_re (32), y_im (32), y_re (32)]

        // Issuer 1 (node-id 0) - placeholder G2 pubkey
        {
            bytes memory pubkey = abi.encodePacked(
                uint256(0x0001000000000000000000000000000000000000000000000000000000000042),
                uint256(0x0001000000000000000000000000000000000000000000000000000000000001),
                uint256(0x0001000000000000000000000000000000000000000000000000000000000002),
                uint256(0x0001000000000000000000000000000000000000000000000000000000000003)
            );
            uint256 id = reg.addIssuer(issuer1Addr, bytes32("issuer1.index.network"), pubkey);
            console2.log("  Issuer 1 registered, id:", id);
            console2.log("    Address:", issuer1Addr);
        }

        // Issuer 2 (node-id 1) - placeholder G2 pubkey
        {
            bytes memory pubkey = abi.encodePacked(
                uint256(0x0002000000000000000000000000000000000000000000000000000000000042),
                uint256(0x0002000000000000000000000000000000000000000000000000000000000001),
                uint256(0x0002000000000000000000000000000000000000000000000000000000000002),
                uint256(0x0002000000000000000000000000000000000000000000000000000000000003)
            );
            uint256 id = reg.addIssuer(issuer2Addr, bytes32("issuer2.index.network"), pubkey);
            console2.log("  Issuer 2 registered, id:", id);
            console2.log("    Address:", issuer2Addr);
        }

        // Issuer 3 (node-id 2) - placeholder G2 pubkey
        {
            bytes memory pubkey = abi.encodePacked(
                uint256(0x0003000000000000000000000000000000000000000000000000000000000042),
                uint256(0x0003000000000000000000000000000000000000000000000000000000000001),
                uint256(0x0003000000000000000000000000000000000000000000000000000000000002),
                uint256(0x0003000000000000000000000000000000000000000000000000000000000003)
            );
            uint256 id = reg.addIssuer(issuer3Addr, bytes32("issuer3.index.network"), pubkey);
            console2.log("  Issuer 3 registered, id:", id);
            console2.log("    Address:", issuer3Addr);
        }

        // Verify registration
        require(reg.activeIssuerCount() == 3, "IssuerRegistry: expected 3 active issuers");
        console2.log("  Active issuers:", reg.activeIssuerCount());
        // Note: getAggregatedPubkey() returns empty bytes (G2 aggregation is done off-chain)
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
            '    "IssuerRegistry": "', vm.toString(issuerRegistryProxy), '",\n',
            '    "IssuerRegistryImpl": "', vm.toString(issuerRegistryImpl), '",\n',
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
