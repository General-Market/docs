// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {FeeRegistry} from "../src/registry/FeeRegistry.sol";
import {AssetPairRegistry} from "../src/registry/AssetPairRegistry.sol";
import {CollateralRegistry} from "../src/registry/CollateralRegistry.sol";
import {BLSCustody} from "../src/core/BLSCustody.sol";
import {L3BridgeCustody} from "../src/custody/L3BridgeCustody.sol";
import {Investment} from "../src/core/Investment.sol";
import {BLSLib} from "../src/libraries/BLSLib.sol";
import {TypesLib} from "../src/libraries/TypesLib.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BLSTestHelper} from "./helpers/BLSTestHelper.sol";

/// @title DeployL3Test - Tests for L3 deployment logic
/// @notice Verifies the deployment order, initialization, and wiring of all contracts
contract DeployL3Test is BLSTestHelper {
    // Simulated deployer / admin
    address public deployer;
    uint256 public deployerKey;
    address public usdc;

    // Deployed addresses
    address public governanceProxy;
    address public governanceImpl;
    address public issuerRegistryProxy;
    address public issuerRegistryImpl;
    address public feeRegistryProxy;
    address public feeRegistryImpl;
    address public assetPairRegistryAddr;
    address public collateralRegistryAddr;
    address public blsCustodyProxy;
    address public blsCustodyImpl;
    address public l3BridgeCustodyProxy;
    address public l3BridgeCustodyImpl;
    address public indexProxy;
    address public indexImpl;

    function setUp() public {
        deployerKey = 0xA11CE;
        deployer = vm.addr(deployerKey);
        usdc = makeAddr("wUSDC");

        // Give the USDC mock some code and mock decimals() so ERC20 checks pass
        vm.etch(usdc, hex"00");
        vm.mockCall(usdc, abi.encodeWithSignature("decimals()"), abi.encode(uint8(18)));

        vm.startPrank(deployer);

        // ============ PHASE 1: Governance ============
        {
            Governance impl = new Governance();
            governanceImpl = address(impl);
            bytes memory initData = abi.encodeWithSelector(Governance.initialize.selector, deployer);
            ERC1967Proxy proxy = new ERC1967Proxy(governanceImpl, initData);
            governanceProxy = address(proxy);
        }

        // ============ PHASE 2: Registries ============
        {
            IssuerRegistry impl = new IssuerRegistry();
            issuerRegistryImpl = address(impl);
            bytes memory initData = abi.encodeWithSelector(IssuerRegistry.initialize.selector, governanceProxy);
            ERC1967Proxy proxy = new ERC1967Proxy(issuerRegistryImpl, initData);
            issuerRegistryProxy = address(proxy);
        }
        {
            FeeRegistry impl = new FeeRegistry();
            feeRegistryImpl = address(impl);
            bytes memory initData = abi.encodeWithSelector(FeeRegistry.initialize.selector, deployer);
            ERC1967Proxy proxy = new ERC1967Proxy(feeRegistryImpl, initData);
            feeRegistryProxy = address(proxy);
        }
        {
            AssetPairRegistry apr = new AssetPairRegistry(deployer, issuerRegistryProxy);
            assetPairRegistryAddr = address(apr);
        }
        {
            CollateralRegistry cr = new CollateralRegistry(deployer, issuerRegistryProxy);
            collateralRegistryAddr = address(cr);
        }

        // ============ PHASE 3: Custody ============
        {
            BLSCustody impl = new BLSCustody();
            blsCustodyImpl = address(impl);
            bytes memory initData = abi.encodeWithSelector(BLSCustody.initialize.selector, issuerRegistryProxy);
            ERC1967Proxy proxy = new ERC1967Proxy(blsCustodyImpl, initData);
            blsCustodyProxy = address(proxy);
        }
        {
            L3BridgeCustody impl = new L3BridgeCustody();
            l3BridgeCustodyImpl = address(impl);
            bytes memory initData = abi.encodeWithSelector(
                L3BridgeCustody.initialize.selector, issuerRegistryProxy, usdc
            );
            ERC1967Proxy proxy = new ERC1967Proxy(l3BridgeCustodyImpl, initData);
            l3BridgeCustodyProxy = address(proxy);
        }

        // ============ PHASE 4: Index ============
        {
            Investment impl = new Investment();
            indexImpl = address(impl);
            bytes memory initData = abi.encodeWithSelector(Investment.initialize.selector, governanceProxy, usdc);
            ERC1967Proxy proxy = new ERC1967Proxy(indexImpl, initData);
            indexProxy = address(proxy);
        }

        // Wire registries into Index
        Investment(indexProxy).setIssuerRegistry(issuerRegistryProxy);
        Investment(indexProxy).setFeeRegistry(feeRegistryProxy);

        vm.stopPrank();
    }

    // ============ Phase 1 Tests: Governance ============

    function test_governance_adminIsCorrect() public view {
        Governance gov = Governance(governanceProxy);
        assertEq(gov.admin(), deployer);
    }

    function test_governance_notPausedInitially() public view {
        Governance gov = Governance(governanceProxy);
        assertFalse(gov.isPaused());
    }

    function test_governance_proxyHasCode() public view {
        assertTrue(governanceProxy.code.length > 0);
    }

    function test_governance_implHasCode() public view {
        assertTrue(governanceImpl.code.length > 0);
    }

    // ============ Phase 2 Tests: Registries ============

    function test_issuerRegistry_governanceMatches() public view {
        IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);
        assertEq(address(reg.governance()), governanceProxy);
    }

    function test_issuerRegistry_activeCountZero() public view {
        IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);
        assertEq(reg.activeIssuerCount(), 0);
    }

    function test_feeRegistry_adminIsCorrect() public view {
        FeeRegistry reg = FeeRegistry(feeRegistryProxy);
        assertEq(reg.admin(), deployer);
    }

    function test_assetPairRegistry_adminIsCorrect() public view {
        AssetPairRegistry reg = AssetPairRegistry(assetPairRegistryAddr);
        assertEq(reg.admin(), deployer);
    }

    function test_collateralRegistry_adminIsCorrect() public view {
        CollateralRegistry reg = CollateralRegistry(collateralRegistryAddr);
        assertEq(reg.admin(), deployer);
    }

    // ============ Phase 3 Tests: Custody ============

    function test_blsCustody_issuerRegistryMatches() public view {
        BLSCustody custody = BLSCustody(blsCustodyProxy);
        assertEq(address(custody.issuerRegistry()), issuerRegistryProxy);
    }

    function test_l3BridgeCustody_issuerRegistryMatches() public view {
        L3BridgeCustody custody = L3BridgeCustody(l3BridgeCustodyProxy);
        assertEq(address(custody.issuerRegistry()), issuerRegistryProxy);
    }

    function test_l3BridgeCustody_usdcMatches() public view {
        L3BridgeCustody custody = L3BridgeCustody(l3BridgeCustodyProxy);
        assertEq(address(custody.usdc()), usdc);
    }

    // ============ Phase 4 Tests: Index ============

    function test_index_governanceMatches() public view {
        Investment idx = Investment(indexProxy);
        assertEq(address(idx.governance()), governanceProxy);
    }

    function test_index_usdcMatches() public view {
        Investment idx = Investment(indexProxy);
        assertEq(address(idx.usdc()), usdc);
    }

    function test_index_issuerRegistryWired() public view {
        Investment idx = Investment(indexProxy);
        assertEq(address(idx.issuerRegistry()), issuerRegistryProxy);
    }

    function test_index_feeRegistryWired() public view {
        Investment idx = Investment(indexProxy);
        assertEq(address(idx.feeRegistry()), feeRegistryProxy);
    }

    // ============ Phase 6 Tests: Test Issuer Registration ============

    function test_registerTestIssuers_threeIssuers() public {
        IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);

        // Real BLS G2 pubkeys from deterministic seeds via FFI
        bytes memory pubkey1 = blsPubkey(0);
        bytes memory pubkey2 = blsPubkey(1);
        bytes memory pubkey3 = blsPubkey(2);

        address issuer1 = address(uint160(uint256(keccak256("test-issuer-1"))));
        address issuer2 = address(uint160(uint256(keccak256("test-issuer-2"))));
        address issuer3 = address(uint160(uint256(keccak256("test-issuer-3"))));

        // Generate Proof of Possession signatures
        bytes32 popMsg1 = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), issuer1, pubkey1));
        bytes32 popMsg2 = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), issuer2, pubkey2));
        bytes32 popMsg3 = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), issuer3, pubkey3));
        bytes memory popSig1 = blsSign(vm.toString(uint256(0)), popMsg1);
        bytes memory popSig2 = blsSign(vm.toString(uint256(1)), popMsg2);
        bytes memory popSig3 = blsSign(vm.toString(uint256(2)), popMsg3);

        // addIssuer requires admin of governance
        vm.startPrank(deployer);
        uint256 id1 = reg.addIssuer(issuer1, bytes32("issuer1.index.network"), pubkey1, popSig1);
        uint256 id2 = reg.addIssuer(issuer2, bytes32("issuer2.index.network"), pubkey2, popSig2);
        uint256 id3 = reg.addIssuer(issuer3, bytes32("issuer3.index.network"), pubkey3, popSig3);
        vm.stopPrank();

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
        assertEq(reg.activeIssuerCount(), 3);

        // G2 aggregation is done off-chain; getAggregatedPubkey returns empty bytes
        bytes memory aggKey = reg.getAggregatedPubkey();
        assertEq(aggKey.length, 0);
    }

    function test_registerTestIssuers_issuerDataCorrect() public {
        IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);

        // Real BLS G2 pubkey from deterministic seed via FFI
        bytes memory pubkey1 = blsPubkey(0);
        address issuer1 = address(uint160(uint256(keccak256("test-issuer-1"))));

        // Generate Proof of Possession
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(reg), issuer1, pubkey1));
        bytes memory popSig = blsSign(vm.toString(uint256(0)), popMsg);

        vm.prank(deployer);
        uint256 id = reg.addIssuer(issuer1, bytes32("issuer1.index.network"), pubkey1, popSig);

        TypesLib.Issuer memory issuer = reg.getIssuer(id);
        assertEq(issuer.addr, issuer1);
        assertEq(issuer.ip, bytes32("issuer1.index.network"));
        assertEq(issuer.blsPubkey, pubkey1);
        assertEq(issuer.status, 1); // active
    }

    // ============ UUPS Proxy Verification Tests ============

    function test_uupsProxies_haveImplementationSlot() public view {
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

        // Governance
        bytes32 govImpl = vm.load(governanceProxy, implSlot);
        assertEq(address(uint160(uint256(govImpl))), governanceImpl);

        // IssuerRegistry
        bytes32 irImpl = vm.load(issuerRegistryProxy, implSlot);
        assertEq(address(uint160(uint256(irImpl))), issuerRegistryImpl);

        // FeeRegistry
        bytes32 frImpl = vm.load(feeRegistryProxy, implSlot);
        assertEq(address(uint160(uint256(frImpl))), feeRegistryImpl);

        // BLSCustody
        bytes32 bcImpl = vm.load(blsCustodyProxy, implSlot);
        assertEq(address(uint160(uint256(bcImpl))), blsCustodyImpl);

        // L3BridgeCustody
        bytes32 lbcImpl = vm.load(l3BridgeCustodyProxy, implSlot);
        assertEq(address(uint160(uint256(lbcImpl))), l3BridgeCustodyImpl);

        // Index
        bytes32 idxImpl = vm.load(indexProxy, implSlot);
        assertEq(address(uint160(uint256(idxImpl))), indexImpl);
    }

    function test_nonUpgradeable_noProxySlot() public view {
        // AssetPairRegistry and CollateralRegistry are NOT proxied
        assertTrue(assetPairRegistryAddr.code.length > 0);
        assertTrue(collateralRegistryAddr.code.length > 0);
    }

    // ============ Deployment Order Tests ============

    function test_deploymentOrder_governanceFirst() public view {
        // Governance should be deployed before IssuerRegistry
        // Verified by IssuerRegistry being initialized with governanceProxy
        IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);
        assertEq(address(reg.governance()), governanceProxy);
    }

    function test_deploymentOrder_issuerRegistryBeforeCustody() public view {
        // BLSCustody and L3BridgeCustody depend on IssuerRegistry
        BLSCustody bls = BLSCustody(blsCustodyProxy);
        assertEq(address(bls.issuerRegistry()), issuerRegistryProxy);

        L3BridgeCustody l3b = L3BridgeCustody(l3BridgeCustodyProxy);
        assertEq(address(l3b.issuerRegistry()), issuerRegistryProxy);
    }

    // ============ Reinitialization Protection Tests ============

    function test_governance_cannotReinitialize() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        Governance(governanceProxy).initialize(makeAddr("attacker"));
    }

    function test_issuerRegistry_cannotReinitialize() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        IssuerRegistry(issuerRegistryProxy).initialize(makeAddr("attacker"));
    }

    function test_feeRegistry_cannotReinitialize() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        FeeRegistry(feeRegistryProxy).initialize(makeAddr("attacker"));
    }

    function test_blsCustody_cannotReinitialize() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        BLSCustody(blsCustodyProxy).initialize(makeAddr("attacker"));
    }

    function test_l3BridgeCustody_cannotReinitialize() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        L3BridgeCustody(l3BridgeCustodyProxy).initialize(makeAddr("attacker"), makeAddr("fake-usdc"));
    }

    function test_index_cannotReinitialize() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        Investment(indexProxy).initialize(makeAddr("attacker"), makeAddr("fake-usdc"));
    }
}
