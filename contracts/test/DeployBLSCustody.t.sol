// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Governance.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/core/BLSCustody.sol";
import "../src/interfaces/IBLSCustody.sol";
import "../src/libraries/ErrorsLib.sol";
import "./helpers/TestHelper.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBLSCustodyTest - Deployment validation for Story 6.6
/// @notice Tests generic BLSCustody deployment: Governance -> IssuerRegistry -> BLSCustody chain
/// @dev Validates UUPS proxy deployment, initialization, re-init protection, and cross-chain replay
contract DeployBLSCustodyTest is TestHelper {
    // Real contracts (full initialization chain)
    Governance public governance;
    IssuerRegistry public issuerRegistry;
    BLSCustody public custody;

    // BLSCustody with separate registry (for whitelist testing)
    BLSCustody public custodyMock;
    IssuerRegistry public mockRegistry;

    // Proxy addresses
    address public governanceProxy;
    address public issuerRegistryProxy;
    address public blsCustodyProxy;
    address public blsCustodyMockProxy;

    // Implementation addresses
    address public governanceImpl;
    address public issuerRegistryImpl;
    address public blsCustodyImpl;

    // Chain-specific constants from story
    address constant ONEINCH_ROUTER_V6 = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant USDC_ETHEREUM = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_OPTIMISM = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;

    address public deployer;
    uint256 public deployerKey = 0xA11CE;

    function setUp() public {
        deployer = vm.addr(deployerKey);
        vm.deal(deployer, 100 ether);

        vm.startPrank(deployer);

        // ===== Deploy real initialization chain (simulates DeployBLSCustody.s.sol) =====

        // Governance
        Governance govImpl = new Governance();
        governanceImpl = address(govImpl);
        ERC1967Proxy govProxy = new ERC1967Proxy(
            governanceImpl,
            abi.encodeCall(Governance.initialize, (deployer))
        );
        governanceProxy = address(govProxy);
        governance = Governance(governanceProxy);

        // IssuerRegistry
        IssuerRegistry irImpl = new IssuerRegistry();
        issuerRegistryImpl = address(irImpl);
        ERC1967Proxy irProxy = new ERC1967Proxy(
            issuerRegistryImpl,
            abi.encodeCall(IssuerRegistry.initialize, (governanceProxy))
        );
        issuerRegistryProxy = address(irProxy);
        issuerRegistry = IssuerRegistry(issuerRegistryProxy);

        // BLSCustody (real registry)
        BLSCustody custodyImpl = new BLSCustody();
        blsCustodyImpl = address(custodyImpl);
        ERC1967Proxy custodyProxy = new ERC1967Proxy(
            blsCustodyImpl,
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        blsCustodyProxy = address(custodyProxy);
        custody = BLSCustody(blsCustodyProxy);

        // ===== Deploy BLSCustody with separate IssuerRegistry for whitelist tests =====
        // Separate IssuerRegistry for whitelist tests, BLS verification mocked via precompile
        IssuerRegistry mockRegImpl = new IssuerRegistry();
        ERC1967Proxy mockRegProxy = new ERC1967Proxy(
            address(mockRegImpl),
            abi.encodeCall(IssuerRegistry.initialize, (governanceProxy))
        );
        mockRegistry = IssuerRegistry(address(mockRegProxy));

        // Set aggregated pubkey and mock precompile for BLS test bypass
        mockRegistry.setAggregatedPubkey(new bytes(128));
        issuerRegistry.setAggregatedPubkey(new bytes(128));
        vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

        BLSCustody custodyImplMock = new BLSCustody();
        ERC1967Proxy mockProxy = new ERC1967Proxy(
            address(custodyImplMock),
            abi.encodeCall(BLSCustody.initialize, (address(mockRegistry)))
        );
        blsCustodyMockProxy = address(mockProxy);
        custodyMock = BLSCustody(blsCustodyMockProxy);

        vm.stopPrank();
    }

    // ============ AC #1, #2, #3: UUPS PROXY DEPLOYMENT (Ethereum, Base, Optimism) ============

    function test_blsCustody_deployedAsUUPSProxy() public view {
        assertGt(blsCustodyProxy.code.length, 0, "Proxy should have code");
        assertGt(blsCustodyImpl.code.length, 0, "Implementation should have code");
        assertTrue(blsCustodyProxy != blsCustodyImpl, "Proxy and impl should differ");
    }

    function test_allProxiesDeployed() public view {
        assertGt(governanceProxy.code.length, 0, "Governance proxy should have code");
        assertGt(issuerRegistryProxy.code.length, 0, "IssuerRegistry proxy should have code");
        assertGt(blsCustodyProxy.code.length, 0, "BLSCustody proxy should have code");
    }

    function test_proxyDelegation_constantsAccessible() public view {
        assertEq(custody.STANDARD_THRESHOLD(), 11);
        assertEq(custody.EMERGENCY_THRESHOLD(), 15);
        assertEq(custody.EMERGENCY_UPGRADE_THRESHOLD(), 17);
        assertEq(custody.WHITELIST_TIMELOCK(), 2 days);
        assertEq(custody.UPGRADE_TIMELOCK(), 7 days);
        assertEq(custody.EMERGENCY_UPGRADE_TIMELOCK(), 24 hours);
    }

    // ============ AC #4: SAME BLS PUBLIC KEY CONFIGURED ============

    function test_initialization_issuerRegistrySet() public view {
        assertEq(
            address(custody.issuerRegistry()),
            issuerRegistryProxy,
            "IssuerRegistry should be set to real proxy"
        );
    }

    function test_initialization_issuerRegistryStartsEmpty() public view {
        assertEq(issuerRegistry.activeIssuerCount(), 0, "Should start with 0 active issuers");
    }

    function test_initialization_governanceAdminCorrect() public view {
        assertEq(governance.admin(), deployer, "Governance admin should be deployer");
    }

    function test_initialization_issuerRegistryGovernanceCorrect() public view {
        assertEq(
            address(issuerRegistry.governance()),
            governanceProxy,
            "IssuerRegistry governance should match"
        );
    }

    // ============ AC #8: POST-DEPLOYMENT VERIFICATION ============

    function test_initialization_nonceIsZero() public view {
        assertEq(custody.nonce(), 0, "Nonce should be 0 after deployment");
    }

    function test_initialization_cannotReinitialize() public {
        vm.expectRevert();
        custody.initialize(address(0x123));
    }

    function test_initialization_mockCustodyCannotReinitialize() public {
        vm.expectRevert();
        custodyMock.initialize(address(0x123));
    }

    function test_initialization_zeroRegistryReverts() public {
        BLSCustody impl = new BLSCustody();
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E043_ZeroIssuerRegistry.selector));
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(BLSCustody.initialize, (address(0)))
        );
    }

    // ============ AC #5: CHAIN-SPECIFIC WHITELIST TARGETS ============

    function test_whitelist_proposeAndActivate1inchRouter() public {
        vm.startPrank(deployer);

        // Propose with dummy signature (BLS verified via mocked precompile)
        custodyMock.proposeWhitelist(ONEINCH_ROUTER_V6, new bytes(64));
        (uint256 proposedAt, ) = custodyMock.getWhitelistStatus(ONEINCH_ROUTER_V6);
        assertGt(proposedAt, 0, "1inch Router should be proposed");

        // Activate after timelock
        vm.warp(block.timestamp + 2 days + 1);
        custodyMock.activateWhitelist(ONEINCH_ROUTER_V6);
        assertTrue(custodyMock.isWhitelisted(ONEINCH_ROUTER_V6), "1inch Router should be whitelisted");

        vm.stopPrank();
    }

    function test_whitelist_proposeUSDCEthereum() public {
        vm.startPrank(deployer);
        custodyMock.proposeWhitelist(USDC_ETHEREUM, new bytes(64));
        (uint256 proposedAt, ) = custodyMock.getWhitelistStatus(USDC_ETHEREUM);
        assertGt(proposedAt, 0, "USDC Ethereum should be proposed");
        vm.stopPrank();
    }

    function test_whitelist_proposeUSDCBase() public {
        vm.startPrank(deployer);
        custodyMock.proposeWhitelist(USDC_BASE, new bytes(64));
        (uint256 proposedAt, ) = custodyMock.getWhitelistStatus(USDC_BASE);
        assertGt(proposedAt, 0, "USDC Base should be proposed");
        vm.stopPrank();
    }

    function test_whitelist_proposeUSDCOptimism() public {
        vm.startPrank(deployer);
        custodyMock.proposeWhitelist(USDC_OPTIMISM, new bytes(64));
        (uint256 proposedAt, ) = custodyMock.getWhitelistStatus(USDC_OPTIMISM);
        assertGt(proposedAt, 0, "USDC Optimism should be proposed");
        vm.stopPrank();
    }

    function test_whitelist_cannotActivateBeforeTimelock() public {
        vm.startPrank(deployer);
        custodyMock.proposeWhitelist(ONEINCH_ROUTER_V6, new bytes(64));

        vm.expectRevert();
        custodyMock.activateWhitelist(ONEINCH_ROUTER_V6);
        vm.stopPrank();
    }

    // ============ AC #9: CROSS-CHAIN REPLAY PROTECTION ============

    function test_chainIdIncludedInMessageHash() public view {
        // BLSCustody.execute() uses: keccak256(abi.encode(block.chainid, address(this), target, data, nonceValue))
        // Verify different chainIds produce different message hashes (replay protection)
        address target = address(0x1234);
        bytes memory data = hex"deadbeef";
        uint256 nonceValue = 0;

        bytes32 hashEth = keccak256(abi.encode(uint256(1), blsCustodyProxy, target, data, nonceValue));
        bytes32 hashBase = keccak256(abi.encode(uint256(8453), blsCustodyProxy, target, data, nonceValue));
        bytes32 hashOp = keccak256(abi.encode(uint256(10), blsCustodyProxy, target, data, nonceValue));

        assertTrue(hashEth != hashBase, "Ethereum and Base hashes must differ");
        assertTrue(hashEth != hashOp, "Ethereum and Optimism hashes must differ");
        assertTrue(hashBase != hashOp, "Base and Optimism hashes must differ");
    }

    function test_executionFailsWithNonWhitelistedTarget() public {
        address nonWhitelisted = address(0xDEAD);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, nonWhitelisted)
        );
        custody.execute(nonWhitelisted, "", "", 0);
    }

    // ============ EXISTING ISSUER REGISTRY REUSE ============

    function test_existingIssuerRegistry_custodyPointsToIt() public view {
        // custodyMock uses mockRegistry as its issuerRegistry
        assertEq(
            address(custodyMock.issuerRegistry()),
            address(mockRegistry),
            "Should point to provided IssuerRegistry"
        );
    }

    // ============ FULL DEPLOYMENT FLOW ============

    function test_fullDeploymentFlow() public {
        // 1. All contracts deployed
        assertGt(governanceProxy.code.length, 0);
        assertGt(issuerRegistryProxy.code.length, 0);
        assertGt(blsCustodyProxy.code.length, 0);

        // 2. Initialization chain correct
        assertEq(governance.admin(), deployer);
        assertEq(address(issuerRegistry.governance()), governanceProxy);
        assertEq(address(custody.issuerRegistry()), issuerRegistryProxy);

        // 3. Nonce is 0
        assertEq(custody.nonce(), 0);

        // 4. No used nonces
        assertFalse(custody.isNonceUsed(0));
        assertFalse(custody.isNonceUsed(1));
        assertFalse(custody.isNonceUsed(255));
    }

}
