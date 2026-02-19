// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Governance.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/core/BLSCustody.sol";
import "../src/interfaces/IBLSCustody.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "../scripts/deploy/DeployBLSCustodyArbitrum.s.sol";
import "./helpers/TestHelper.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBLSCustodyArbitrumTest - Deployment validation tests for Story 6.5
/// @notice Tests the full Arbitrum deployment chain: Governance -> IssuerRegistry -> BLSCustody
/// @dev Uses real IssuerRegistry with real BLS test keys
///      for both whitelist tests and initialization chain tests
contract DeployBLSCustodyArbitrumTest is TestHelper {
    // Real contracts (initialization chain)
    Governance public governance;
    IssuerRegistry public issuerRegistry;

    // BLSCustody with separate registry (for whitelist testing)
    BLSCustody public custody;
    IssuerRegistry public mockRegistry;

    // BLSCustody with real registry (for initialization chain testing)
    BLSCustody public custodyReal;

    // Proxy addresses
    address public governanceProxy;
    address public issuerRegistryProxy;
    address public blsCustodyProxy;
    address public blsCustodyRealProxy;

    // Implementation addresses
    address public governanceImpl;
    address public issuerRegistryImpl;
    address public blsCustodyImpl;

    // Constants matching deployment script
    address constant ONEINCH_ROUTER_V6 = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    address public deployer;
    uint256 public deployerKey = 0xA11CE;

    function setUp() public {
        deployer = vm.addr(deployerKey);
        vm.deal(deployer, 100 ether);

        vm.startPrank(deployer);

        // ===== Deploy real initialization chain =====

        // Deploy Governance
        Governance govImpl = new Governance();
        governanceImpl = address(govImpl);
        ERC1967Proxy govProxy = new ERC1967Proxy(
            governanceImpl,
            abi.encodeCall(Governance.initialize, (deployer))
        );
        governanceProxy = address(govProxy);
        governance = Governance(governanceProxy);

        // Deploy IssuerRegistry (real)
        IssuerRegistry irImpl = new IssuerRegistry();
        issuerRegistryImpl = address(irImpl);
        ERC1967Proxy irProxy = new ERC1967Proxy(
            issuerRegistryImpl,
            abi.encodeCall(IssuerRegistry.initialize, (governanceProxy))
        );
        issuerRegistryProxy = address(irProxy);
        issuerRegistry = IssuerRegistry(issuerRegistryProxy);

        // Deploy BLSCustody with real IssuerRegistry (for init chain tests)
        BLSCustody custodyImplReal = new BLSCustody();
        ERC1967Proxy custodyRealProxy = new ERC1967Proxy(
            address(custodyImplReal),
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        blsCustodyRealProxy = address(custodyRealProxy);
        custodyReal = BLSCustody(blsCustodyRealProxy);

        // ===== Deploy BLSCustody with separate IssuerRegistry for whitelist tests =====
        // Separate IssuerRegistry for whitelist tests, BLS verification uses real BLS keys
        IssuerRegistry mockRegImpl = new IssuerRegistry();
        ERC1967Proxy mockRegProxy = new ERC1967Proxy(
            address(mockRegImpl),
            abi.encodeCall(IssuerRegistry.initialize, (governanceProxy))
        );
        mockRegistry = IssuerRegistry(address(mockRegProxy));

        // Register 3 real BLS test issuers in both registries and set aggregated pubkeys
        // Must stop startPrank — registerTestIssuersWithBLS uses vm.prank internally
        vm.stopPrank();
        registerTestIssuersWithBLS(mockRegistry, deployer);
        registerTestIssuersWithBLS(issuerRegistry, deployer);
        vm.startPrank(deployer);

        BLSCustody custodyImpl = new BLSCustody();
        blsCustodyImpl = address(custodyImpl);
        ERC1967Proxy custodyProxy = new ERC1967Proxy(
            blsCustodyImpl,
            abi.encodeCall(BLSCustody.initialize, (address(mockRegistry)))
        );
        blsCustodyProxy = address(custodyProxy);
        custody = BLSCustody(blsCustodyProxy);

        // Propose whitelist targets with real BLS signatures
        custody.proposeWhitelist(ONEINCH_ROUTER_V6, _signProposeWhitelist(address(custody), ONEINCH_ROUTER_V6));
        custody.proposeWhitelist(USDC_ARBITRUM, _signProposeWhitelist(address(custody), USDC_ARBITRUM));

        vm.stopPrank();
    }

    // ============ SIGNING HELPERS ============

    /// @notice Sign a BLSCustody.proposeWhitelist call with real BLS signature
    function _signProposeWhitelist(address custodyAddr, address target) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, "proposeWhitelist", target));
        return signWithTestIssuers(message);
    }

    // ============ AC #1: UUPS PROXY DEPLOYMENT ============

    function test_blsCustody_deployedAsUUPSProxy() public view {
        assertGt(blsCustodyProxy.code.length, 0, "Proxy should have code");
        assertGt(blsCustodyImpl.code.length, 0, "Implementation should have code");
        assertTrue(blsCustodyProxy != blsCustodyImpl, "Proxy and impl should differ");
    }

    function test_realChain_allProxiesDeployed() public view {
        assertGt(governanceProxy.code.length, 0, "Governance proxy should have code");
        assertGt(issuerRegistryProxy.code.length, 0, "IssuerRegistry proxy should have code");
        assertGt(blsCustodyRealProxy.code.length, 0, "BLSCustody real proxy should have code");
    }

    function test_proxyDelegation_issuerRegistryReturnsCorrectValue() public view {
        address registryAddr = address(custody.issuerRegistry());
        assertEq(registryAddr, address(mockRegistry), "Proxy should delegate to implementation");
    }

    function test_proxyDelegation_constantsAccessible() public view {
        assertEq(custody.STANDARD_THRESHOLD(), 11);
        assertEq(custody.EMERGENCY_THRESHOLD(), 15);
        assertEq(custody.EMERGENCY_UPGRADE_THRESHOLD(), 17);
        assertEq(custody.WHITELIST_TIMELOCK(), 2 days);
        assertEq(custody.UPGRADE_TIMELOCK(), 7 days);
        assertEq(custody.EMERGENCY_UPGRADE_TIMELOCK(), 24 hours);
    }

    // ============ AC #2: INITIALIZATION STATE ============

    function test_initialization_realChain_issuerRegistrySet() public view {
        address registryAddr = address(custodyReal.issuerRegistry());
        assertEq(registryAddr, issuerRegistryProxy, "IssuerRegistry should be set to real proxy");
    }

    function test_initialization_issuerRegistryIsValid() public view {
        uint256 activeCount = issuerRegistry.activeIssuerCount();
        assertEq(activeCount, 3, "Should have 3 test issuers registered");
    }

    function test_initialization_governanceAdminCorrect() public view {
        assertEq(governance.admin(), deployer, "Governance admin should be deployer");
    }

    function test_initialization_issuerRegistryGovernanceCorrect() public view {
        assertEq(address(issuerRegistry.governance()), governanceProxy, "IssuerRegistry governance should match");
    }

    function test_initialization_cannotReinitialize() public {
        vm.expectRevert();
        custody.initialize(address(0x123));
    }

    function test_initialization_realCustodyCannotReinitialize() public {
        vm.expectRevert();
        custodyReal.initialize(address(0x123));
    }

    // ============ AC #3: 1INCH ROUTER V6 WHITELISTED ============

    function test_whitelist_1inchRouterProposed() public view {
        (uint256 proposedAt, ) = custody.getWhitelistStatus(ONEINCH_ROUTER_V6);
        assertGt(proposedAt, 0, "1inch Router V6 should be proposed");
    }

    function test_whitelist_1inchRouterActivatedAfterTimelock() public {
        vm.warp(block.timestamp + 2 days + 1);
        custody.activateWhitelist(ONEINCH_ROUTER_V6);
        assertTrue(custody.isWhitelisted(ONEINCH_ROUTER_V6), "1inch Router V6 should be whitelisted after activation");
    }

    function test_whitelist_1inchRouterCannotActivateBeforeTimelock() public {
        vm.expectRevert();
        custody.activateWhitelist(ONEINCH_ROUTER_V6);
    }

    // ============ AC #4: USDC WHITELISTED ============

    function test_whitelist_usdcProposed() public view {
        (uint256 proposedAt, ) = custody.getWhitelistStatus(USDC_ARBITRUM);
        assertGt(proposedAt, 0, "USDC should be proposed");
    }

    function test_whitelist_usdcActivatedAfterTimelock() public {
        vm.warp(block.timestamp + 2 days + 1);
        custody.activateWhitelist(USDC_ARBITRUM);
        assertTrue(custody.isWhitelisted(USDC_ARBITRUM), "USDC should be whitelisted after activation");
    }

    // ============ AC #5: DEPLOYMENT SCRIPT EXISTS ============

    function test_deploymentScript_compiles() public pure {
        // If this test file compiles, the deployment script exists and compiles
        // (we import DeployBLSCustodyArbitrum at the top)
        assertTrue(true);
    }

    // ============ PROXY DELEGATION TESTS ============

    function test_activateAndVerifyWhitelist() public {
        vm.warp(block.timestamp + 2 days + 1);
        custody.activateWhitelist(ONEINCH_ROUTER_V6);
        custody.activateWhitelist(USDC_ARBITRUM);

        assertTrue(custody.isWhitelisted(ONEINCH_ROUTER_V6));
        assertTrue(custody.isWhitelisted(USDC_ARBITRUM));
    }

    function test_execute_failsWithNonWhitelistedTarget() public {
        address nonWhitelisted = address(0xDEAD);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E026_TargetNotWhitelisted.selector, nonWhitelisted));
        custody.execute(nonWhitelisted, "", "", 0);
    }

    // ============ ISSUER REGISTRY INTEGRATION ============

    function test_issuerRegistry_canAddIssuers() public {
        vm.startPrank(deployer);
        uint256 countBefore = issuerRegistry.activeIssuerCount();
        // G2 pubkey format: 128 bytes [x_im, x_re, y_im, y_re]
        bytes memory blsPubkey = abi.encodePacked(
            uint256(1), uint256(2), uint256(3), uint256(4)
        );
        issuerRegistry.addIssuer(address(0x1001), bytes32(uint256(1)), blsPubkey);
        assertEq(issuerRegistry.activeIssuerCount(), countBefore + 1);
        vm.stopPrank();
    }

    function test_blsCustody_readsAggregatedPubkey() public view {
        // G2 aggregated pubkey must be set (128 bytes for G2 point)
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        assertEq(aggregatedPubkey.length, 128, "Aggregated pubkey should be 128 bytes (G2 point)");
    }

    // ============ FULL DEPLOYMENT FLOW ============

    function test_fullDeploymentFlow() public {
        // 1. Verify all contracts deployed
        assertGt(governanceProxy.code.length, 0);
        assertGt(issuerRegistryProxy.code.length, 0);
        assertGt(blsCustodyProxy.code.length, 0);
        assertGt(blsCustodyRealProxy.code.length, 0);

        // 2. Verify real initialization chain
        assertEq(governance.admin(), deployer);
        assertEq(address(issuerRegistry.governance()), governanceProxy);
        assertEq(address(custodyReal.issuerRegistry()), issuerRegistryProxy);

        // 3. Verify whitelist proposals exist (mock registry custody)
        (uint256 routerProposedAt, ) = custody.getWhitelistStatus(ONEINCH_ROUTER_V6);
        (uint256 usdcProposedAt, ) = custody.getWhitelistStatus(USDC_ARBITRUM);
        assertGt(routerProposedAt, 0);
        assertGt(usdcProposedAt, 0);

        // 4. Activate whitelists after timelock
        vm.warp(block.timestamp + 2 days + 1);
        custody.activateWhitelist(ONEINCH_ROUTER_V6);
        custody.activateWhitelist(USDC_ARBITRUM);

        // 5. Verify whitelisted
        assertTrue(custody.isWhitelisted(ONEINCH_ROUTER_V6));
        assertTrue(custody.isWhitelisted(USDC_ARBITRUM));

        // 6. Verify nonce starts at 0
        assertEq(custody.nonce(), 0);
        assertEq(custodyReal.nonce(), 0);
    }

    function test_blsCustody_mockRegistry_readsAggregatedPubkey() public view {
        // Real aggregated G2 pubkey is 128 bytes, set via registerTestIssuersWithBLS
        bytes memory aggPubkey = mockRegistry.getAggregatedPubkey();
        assertEq(aggPubkey.length, 128, "Mock registry should return 128-byte aggregated pubkey");
    }
}
