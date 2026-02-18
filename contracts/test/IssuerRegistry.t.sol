// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {IIssuerRegistry} from "../src/interfaces/IIssuerRegistry.sol";
import {Governance} from "../src/Governance.sol";
import {TypesLib} from "../src/libraries/TypesLib.sol";
import {BLSLib} from "../src/libraries/BLSLib.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title IssuerRegistryTest - Comprehensive tests for IssuerRegistry.sol (Story 2.12)
/// @notice Tests issuer management, aggregated key updates, and access control
contract IssuerRegistryTest is Test {
    IssuerRegistry public implementation;
    IssuerRegistry public registry;
    ERC1967Proxy public proxy;

    Governance public govImplementation;
    Governance public governance;
    ERC1967Proxy public govProxy;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public issuer1Addr = makeAddr("issuer1");
    address public issuer2Addr = makeAddr("issuer2");
    address public issuer3Addr = makeAddr("issuer3");

    bytes32 public constant IP_1 = bytes32(uint256(0x7f000001)); // 127.0.0.1
    bytes32 public constant IP_2 = bytes32(uint256(0x7f000002)); // 127.0.0.2
    bytes32 public constant IP_3 = bytes32(uint256(0x7f000003)); // 127.0.0.3

    // Test BLS pubkeys (G2 points, 128 bytes)
    // These are mock G2 pubkeys for testing - actual verification happens via pairing
    bytes public pubkey1;
    bytes public pubkey2;
    bytes public pubkey3;

    // Events for expectEmit
    event IssuerAdded(uint256 indexed issuerId, address indexed addr, bytes blsPubkey);
    event IssuerRemoved(uint256 indexed issuerId);

    function setUp() public {
        // Deploy Governance first
        govImplementation = new Governance();
        bytes memory govInitData = abi.encodeWithSelector(Governance.initialize.selector, admin);
        govProxy = new ERC1967Proxy(address(govImplementation), govInitData);
        governance = Governance(address(govProxy));

        // Deploy IssuerRegistry
        implementation = new IssuerRegistry();
        bytes memory initData = abi.encodeWithSelector(IssuerRegistry.initialize.selector, address(governance));
        proxy = new ERC1967Proxy(address(implementation), initData);
        registry = IssuerRegistry(address(proxy));

        // Enable testMode so admin can call rotation functions without BLS signatures
        vm.prank(admin);
        registry.setTestMode(true);

        // Generate mock G2 pubkeys (128 bytes each)
        // G2 point format: [x_im (32), x_re (32), y_im (32), y_re (32)]
        // We use simple distinct values for testing - actual G2 curve validation
        // happens at the pairing precompile level, not at storage level
        pubkey1 = abi.encodePacked(uint256(1), uint256(2), uint256(3), uint256(4));
        pubkey2 = abi.encodePacked(uint256(5), uint256(6), uint256(7), uint256(8));
        pubkey3 = abi.encodePacked(uint256(9), uint256(10), uint256(11), uint256(12));
    }

    // ============ INITIALIZATION TESTS ============

    function test_initialization_setsGovernance() public view {
        assertEq(address(registry.governance()), address(governance));
    }

    function test_initialization_emptyAggregatedPubkey() public view {
        // G2 aggregation is done off-chain; on-chain function returns empty bytes
        bytes memory aggPubkey = registry.getAggregatedPubkey();
        assertEq(aggPubkey.length, 0);
    }

    function test_initialization_zeroActiveIssuers() public view {
        assertEq(registry.activeIssuerCount(), 0);
    }

    function test_initialization_revertsWithZeroAddress() public {
        IssuerRegistry newImpl = new IssuerRegistry();

        vm.expectRevert(IssuerRegistry.ZeroAddress.selector);
        new ERC1967Proxy(
            address(newImpl),
            abi.encodeWithSelector(IssuerRegistry.initialize.selector, address(0))
        );
    }

    function test_implementation_cannotBeInitialized() public {
        vm.expectRevert();
        implementation.initialize(address(governance));
    }

    function test_proxy_cannotBeReinitialized() public {
        vm.expectRevert();
        registry.initialize(address(governance));
    }

    // ============ ADD ISSUER TESTS ============

    function test_addIssuer_createsIssuerWithCorrectData() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        assertEq(issuerId, 0);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.addr, issuer1Addr);
        assertEq(issuer.ip, IP_1);
        assertEq(issuer.blsPubkey, pubkey1);
        assertEq(issuer.status, 1); // active
        assertEq(issuer.registeredAt, block.timestamp);
    }

    function test_addIssuer_incrementsActiveCount() public {
        assertEq(registry.activeIssuerCount(), 0);

        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        assertEq(registry.activeIssuerCount(), 1);

        vm.prank(admin);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);

        assertEq(registry.activeIssuerCount(), 2);
    }

    function test_addIssuer_assignsSequentialIds() public {
        vm.startPrank(admin);

        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        uint256 id2 = registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        uint256 id3 = registry.addIssuer(issuer3Addr, IP_3, pubkey3);

        vm.stopPrank();

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
    }

    function test_addIssuer_emitsIssuerAdded() public {
        vm.expectEmit(true, true, false, true);
        emit IssuerAdded(0, issuer1Addr, pubkey1);

        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);
    }

    function test_addIssuer_storesPubkeyCorrectly() public {
        // G2 aggregation is off-chain; getAggregatedPubkey returns empty
        bytes memory initialAgg = registry.getAggregatedPubkey();
        assertEq(initialAgg.length, 0);

        // Add first issuer
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // Verify pubkey stored correctly on issuer struct
        TypesLib.Issuer memory issuer = registry.getIssuer(0);
        assertEq(issuer.blsPubkey, pubkey1);

        // Add second issuer
        vm.prank(admin);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);

        // Verify second pubkey stored correctly
        TypesLib.Issuer memory issuer2 = registry.getIssuer(1);
        assertEq(issuer2.blsPubkey, pubkey2);

        // Aggregated pubkey still returns empty (computed off-chain)
        assertEq(registry.getAggregatedPubkey().length, 0);
    }

    function test_addIssuer_revertsForNonAdmin() public {
        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);
    }

    function test_addIssuer_revertsForZeroAddress() public {
        vm.expectRevert(IssuerRegistry.ZeroAddress.selector);
        vm.prank(admin);
        registry.addIssuer(address(0), IP_1, pubkey1);
    }

    function test_addIssuer_revertsForInvalidPubkeyLength() public {
        bytes memory shortPubkey = new bytes(32);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InvalidPubkeyLength.selector, 32));
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, shortPubkey);
    }

    function test_addIssuer_acceptsAnyValidLengthPubkey() public {
        // G2 curve validation cannot be done on-chain (no precompile)
        // The pairing precompile will reject invalid G2 points at verification time
        // We accept any 128-byte pubkey at storage time
        bytes memory anyPubkey = abi.encodePacked(
            uint256(12345),
            uint256(67890),
            uint256(11111),
            uint256(22222)
        );

        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, anyPubkey);

        // Verify it was stored
        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.blsPubkey, anyPubkey);
    }

    // ============ REMOVE ISSUER TESTS ============

    function test_removeIssuer_deactivatesIssuer() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.status, 0); // inactive
    }

    function test_removeIssuer_decrementsActiveCount() public {
        vm.startPrank(admin);
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        vm.stopPrank();

        assertEq(registry.activeIssuerCount(), 2);

        vm.prank(admin);
        registry.removeIssuer(id1);

        assertEq(registry.activeIssuerCount(), 1);
    }

    function test_removeIssuer_emitsIssuerRemoved() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.expectEmit(true, false, false, false);
        emit IssuerRemoved(issuerId);

        vm.prank(admin);
        registry.removeIssuer(issuerId);
    }

    function test_removeIssuer_deactivatesButKeepsPubkey() public {
        // Add two issuers
        vm.startPrank(admin);
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        vm.stopPrank();

        // Remove first issuer
        vm.prank(admin);
        registry.removeIssuer(id1);

        // Pubkey is still stored (just inactive)
        TypesLib.Issuer memory issuer = registry.getIssuer(id1);
        assertEq(issuer.blsPubkey, pubkey1);
        assertEq(issuer.status, 0); // inactive

        // Aggregated pubkey returns empty (computed off-chain)
        assertEq(registry.getAggregatedPubkey().length, 0);
    }

    function test_removeIssuer_addAndRemoveRestoresZero() public {
        // Add issuer
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // Remove issuer
        vm.prank(admin);
        registry.removeIssuer(issuerId);

        // Aggregated pubkey returns empty (computed off-chain)
        bytes memory agg = registry.getAggregatedPubkey();
        assertEq(agg.length, 0);

        // Verify issuer is inactive
        assertEq(registry.activeIssuerCount(), 0);
    }

    function test_removeIssuer_revertsForNonAdmin() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.removeIssuer(issuerId);
    }

    function test_removeIssuer_revertsForNonExistentIssuer() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        vm.prank(admin);
        registry.removeIssuer(999);
    }

    function test_removeIssuer_revertsForAlreadyInactiveIssuer() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerId));
        vm.prank(admin);
        registry.removeIssuer(issuerId);
    }

    // ============ VIEW FUNCTIONS TESTS ============

    function test_getIssuer_returnsCorrectData() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);

        assertEq(issuer.addr, issuer1Addr);
        assertEq(issuer.ip, IP_1);
        assertEq(issuer.blsPubkey, pubkey1);
        assertEq(issuer.status, 1);
    }

    function test_getIssuer_returnsEmptyForNonExistent() public view {
        TypesLib.Issuer memory issuer = registry.getIssuer(999);
        assertEq(issuer.addr, address(0));
        assertEq(issuer.ip, bytes32(0));
        assertEq(issuer.blsPubkey.length, 0);
        assertEq(issuer.status, 0);
    }

    function test_getIssuers_returnsAllIssuers() public {
        vm.startPrank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        registry.addIssuer(issuer3Addr, IP_3, pubkey3);
        vm.stopPrank();

        TypesLib.Issuer[] memory issuers = registry.getIssuers();

        assertEq(issuers.length, 3);
        assertEq(issuers[0].addr, issuer1Addr);
        assertEq(issuers[1].addr, issuer2Addr);
        assertEq(issuers[2].addr, issuer3Addr);
    }

    function test_getIssuers_includesInactiveIssuers() public {
        vm.startPrank(admin);
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        registry.removeIssuer(id1);
        vm.stopPrank();

        TypesLib.Issuer[] memory issuers = registry.getIssuers();

        assertEq(issuers.length, 2);
        assertEq(issuers[0].status, 0); // inactive
        assertEq(issuers[1].status, 1); // active
    }

    function test_activeIssuerCount_accurate() public {
        vm.startPrank(admin);

        assertEq(registry.activeIssuerCount(), 0);

        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        assertEq(registry.activeIssuerCount(), 1);

        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        assertEq(registry.activeIssuerCount(), 2);

        registry.removeIssuer(id1);
        assertEq(registry.activeIssuerCount(), 1);

        vm.stopPrank();
    }

    // ============ AGGREGATED PUBKEY MATH TESTS ============

    function test_aggregatedPubkey_offChainComputation() public {
        // G2 aggregation is computed off-chain; getAggregatedPubkey always returns empty
        vm.startPrank(admin);

        // Add all three issuers
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        uint256 id2 = registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        registry.addIssuer(issuer3Addr, IP_3, pubkey3);

        // Aggregated pubkey returns empty (computed off-chain)
        assertEq(registry.getAggregatedPubkey().length, 0);
        assertEq(registry.activeIssuerCount(), 3);

        // Remove issuer 1
        registry.removeIssuer(id1);

        // Still empty (off-chain aggregation)
        assertEq(registry.getAggregatedPubkey().length, 0);
        assertEq(registry.activeIssuerCount(), 2);

        // Remove issuer 2
        registry.removeIssuer(id2);

        // Still empty
        assertEq(registry.getAggregatedPubkey().length, 0);
        assertEq(registry.activeIssuerCount(), 1);

        // Individual pubkeys are preserved on issuer structs
        TypesLib.Issuer memory issuer3 = registry.getIssuer(2);
        assertEq(issuer3.blsPubkey, pubkey3);
        assertEq(issuer3.status, 1); // active

        vm.stopPrank();
    }

    // ============ CONSTANTS TESTS ============

    function test_constants_areCorrect() public view {
        assertEq(registry.ROTATION_THRESHOLD(), 10);
        assertEq(registry.ROTATION_TIMELOCK(), 24 hours);
        assertEq(registry.SAFE_PERIOD(), 1 hours);
        assertEq(registry.ADMIN_FORCE_WINDOW(), 48 hours);
    }

    // ============ UPGRADE TESTS ============

    function test_upgradeAuthorization_onlyAdmin() public {
        IssuerRegistry newImpl = new IssuerRegistry();

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.upgradeToAndCall(address(newImpl), "");

        vm.prank(admin);
        registry.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgrade_preservesState() public {
        // Add issuers
        vm.startPrank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        vm.stopPrank();

        // Upgrade
        IssuerRegistry newImpl = new IssuerRegistry();
        vm.prank(admin);
        registry.upgradeToAndCall(address(newImpl), "");

        // State should be preserved
        assertEq(registry.activeIssuerCount(), 2);

        TypesLib.Issuer memory issuer1 = registry.getIssuer(0);
        assertEq(issuer1.addr, issuer1Addr);
        assertEq(issuer1.blsPubkey, pubkey1);

        TypesLib.Issuer memory issuer2 = registry.getIssuer(1);
        assertEq(issuer2.addr, issuer2Addr);
        assertEq(issuer2.blsPubkey, pubkey2);
    }

    // ============ ACCESS CONTROL COMPREHENSIVE TESTS ============

    function test_viewFunctions_accessibleByAnyone() public view {
        registry.getIssuer(0);
        registry.getAggregatedPubkey();
        registry.getIssuers();
        registry.activeIssuerCount();
        registry.getPendingRotation(0);
        registry.canExecuteRotation(0);
        registry.governance();
    }

    // ============ FUZZ TESTS ============

    function testFuzz_addIssuer_anyValidAddress(address issuerAddr) public {
        vm.assume(issuerAddr != address(0));

        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuerAddr, IP_1, pubkey1);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.addr, issuerAddr);
        assertEq(issuer.status, 1);
    }

    function testFuzz_addIssuer_anyIP(bytes32 ip) public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, ip, pubkey1);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.ip, ip);
    }

    // ============ BLS VERIFICATION STUB TESTS ============

    function test_removeIssuerByVote_revertsWithBLSNotSupported() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        bytes memory fakeSignature = new bytes(128);

        vm.expectRevert(IssuerRegistry.BLSVerificationNotYetSupported.selector);
        registry.removeIssuerByVote(issuerId, fakeSignature);
    }

    // ============ KEY ROTATION TESTS (Story 2.13) ============

    // Key rotation events
    event KeyRotationRequested(uint256 indexed issuerId, bytes newPubkey);
    event KeyRotationApproved(uint256 indexed rotatingIssuerId, uint256 indexed approvingIssuerId, uint256 approvalCount);
    event KeyRotationExecuted(uint256 indexed issuerId, bytes oldPubkey, bytes newPubkey);
    event RotationWindowForced(uint256 indexed issuerId);
    event KeyRotationCancelled(uint256 indexed issuerId);

    /// @notice Helper to set up 20 issuers for rotation tests
    /// @dev Generates mock 128-byte G2 pubkeys for each issuer
    function _setupIssuersForRotation() internal returns (uint256[] memory issuerIds, bytes[] memory pubkeys) {
        issuerIds = new uint256[](20);
        pubkeys = new bytes[](20);

        vm.startPrank(admin);
        for (uint256 i = 0; i < 20; i++) {
            // Generate mock 128-byte G2 pubkey: [x_im, x_re, y_im, y_re]
            // Each coordinate is unique per issuer for testing
            pubkeys[i] = abi.encodePacked(
                uint256(100 + i * 4),     // x_im
                uint256(101 + i * 4),     // x_re
                uint256(102 + i * 4),     // y_im
                uint256(103 + i * 4)      // y_re
            );
            issuerIds[i] = registry.addIssuer(makeAddr(string(abi.encodePacked("issuer", i))), bytes32(i), pubkeys[i]);
        }
        vm.stopPrank();

        return (issuerIds, pubkeys);
    }

    // ============ requestKeyRotation Tests ============

    function test_requestKeyRotation_success() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.expectEmit(true, false, false, true);
        emit KeyRotationRequested(issuerId, pubkey2);

        vm.prank(admin);
        registry.requestKeyRotation(issuerId, pubkey2, "");

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerId);
        assertEq(rotation.issuerId, issuerId);
        assertEq(rotation.newPubkey, pubkey2);
        assertEq(rotation.requestedAt, block.timestamp);
        assertEq(rotation.approvalCount, 0);
        assertFalse(rotation.executed);
    }

    function test_requestKeyRotation_revertsNonAdmin() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.requestKeyRotation(issuerId, pubkey2, "");
    }

    function test_requestKeyRotation_revertsIssuerNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        vm.prank(admin);
        registry.requestKeyRotation(999, pubkey2, "");
    }

    function test_requestKeyRotation_revertsIssuerNotActive() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerId));
        vm.prank(admin);
        registry.requestKeyRotation(issuerId, pubkey2, "");
    }

    function test_requestKeyRotation_revertsInvalidPubkeyLength() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        bytes memory shortPubkey = new bytes(32);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InvalidPubkeyLength.selector, 32));
        vm.prank(admin);
        registry.requestKeyRotation(issuerId, shortPubkey, "");
    }

    function test_requestKeyRotation_revertsInvalidPubkey() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // 64-byte pubkey is invalid length (must be 128 for G2)
        bytes memory invalidPubkey = abi.encodePacked(uint256(12345), uint256(67890));

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InvalidPubkeyLength.selector, 64));
        vm.prank(admin);
        registry.requestKeyRotation(issuerId, invalidPubkey, "");
    }

    function test_requestKeyRotation_revertsRotationAlreadyPending() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.prank(admin);
        registry.requestKeyRotation(issuerId, pubkey2, "");

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.RotationAlreadyPending.selector, issuerId));
        vm.prank(admin);
        registry.requestKeyRotation(issuerId, pubkey3, "");
    }

    // ============ approveRotation Tests ============

    function test_approveRotation_success() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];
        uint256 approvingId = issuerIds[1];

        // Request rotation
        vm.prank(admin);
        registry.requestKeyRotation(rotatingId, pubkey2, "");

        vm.expectEmit(true, true, false, true);
        emit KeyRotationApproved(rotatingId, approvingId, 1);

        vm.prank(admin);
        registry.approveRotation(rotatingId, approvingId, "");

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        assertEq(rotation.approvalCount, 1);
    }

    function test_approveRotation_revertsNonAdmin() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.approveRotation(issuerIds[0], issuerIds[1], "");
    }

    function test_approveRotation_revertsNoRotationPending() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.NoRotationPending.selector, issuerIds[0]));
        vm.prank(admin);
        registry.approveRotation(issuerIds[0], issuerIds[1], "");
    }

    function test_approveRotation_revertsSelfApproval() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.expectRevert(IssuerRegistry.SelfApprovalNotAllowed.selector);
        vm.prank(admin);
        registry.approveRotation(issuerIds[0], issuerIds[0], "");
    }

    function test_approveRotation_revertsDoubleApproval() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.prank(admin);
        registry.approveRotation(issuerIds[0], issuerIds[1], "");

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.AlreadyApproved.selector, issuerIds[1]));
        vm.prank(admin);
        registry.approveRotation(issuerIds[0], issuerIds[1], "");
    }

    function test_approveRotation_revertsApprovingIssuerNotFound() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        vm.prank(admin);
        registry.approveRotation(issuerIds[0], 999, "");
    }

    function test_approveRotation_revertsApprovingIssuerNotActive() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Remove approving issuer
        vm.prank(admin);
        registry.removeIssuer(issuerIds[1]);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerIds[1]));
        vm.prank(admin);
        registry.approveRotation(issuerIds[0], issuerIds[1], "");
    }

    // ============ executeRotation Tests ============

    function test_executeRotation_fullFlow() public {
        (uint256[] memory issuerIds, bytes[] memory pubkeys) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];
        bytes memory oldPubkey = pubkeys[0];

        // Generate new mock 128-byte G2 pubkey
        bytes memory newPubkey = abi.encodePacked(
            uint256(1000),
            uint256(1001),
            uint256(1002),
            uint256(1003)
        );

        // Request rotation
        vm.prank(admin);
        registry.requestKeyRotation(rotatingId, newPubkey, "");

        // Get 10 approvals from other issuers
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(rotatingId, issuerIds[i], "");
        }
        vm.stopPrank();

        // Wait for timelock (24h) + safe period (1h)
        vm.warp(block.timestamp + 25 hours);

        // Execute
        vm.expectEmit(true, false, false, true);
        emit KeyRotationExecuted(rotatingId, oldPubkey, newPubkey);

        registry.executeRotation(rotatingId);

        // Verify rotation
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        assertTrue(rotation.executed);

        // Verify issuer pubkey updated
        TypesLib.Issuer memory issuer = registry.getIssuer(rotatingId);
        assertEq(issuer.blsPubkey, newPubkey);

        // Aggregated pubkey returns empty (computed off-chain)
        assertEq(registry.getAggregatedPubkey().length, 0);
    }

    function test_executeRotation_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.NoRotationPending.selector, 0));
        registry.executeRotation(0);
    }

    function test_executeRotation_revertsInsufficientApprovals() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Only get 9 approvals (need 10)
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 9; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InsufficientApprovals.selector, 9, 10));
        registry.executeRotation(issuerIds[0]);
    }

    function test_executeRotation_revertsTimelockNotExpired() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Get 10 approvals
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        // Only wait 23 hours (need 24)
        vm.warp(block.timestamp + 23 hours);

        vm.expectRevert(); // TimelockNotExpired
        registry.executeRotation(issuerIds[0]);
    }

    function test_executeRotation_revertsSafePeriodNotElapsed() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Get 10 approvals
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        // Fast forward 24h - timelock satisfied, but we'll test safe period by adding late approval
        vm.warp(block.timestamp + 24 hours);

        // Add one more approval (11th) now - this resets the safe period timer
        vm.prank(admin);
        registry.approveRotation(issuerIds[0], issuerIds[11], "");

        // Try to execute immediately - safe period (1h) hasn't passed since the late approval
        vm.expectRevert(); // SafePeriodNotElapsed
        registry.executeRotation(issuerIds[0]);

        // Wait 30 more minutes - still not enough
        vm.warp(block.timestamp + 30 minutes);
        vm.expectRevert();
        registry.executeRotation(issuerIds[0]);

        // Wait another 31 minutes - now safe period is satisfied
        vm.warp(block.timestamp + 31 minutes);
        registry.executeRotation(issuerIds[0]); // Should succeed
    }

    function test_executeRotation_revertsAlreadyExecuted() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);

        registry.executeRotation(issuerIds[0]);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.RotationAlreadyExecuted.selector, issuerIds[0]));
        registry.executeRotation(issuerIds[0]);
    }

    // ============ forceRotationWindow Tests ============

    function test_forceRotationWindow_success() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Get 10 approvals
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        // Wait 49 hours (past 48h admin force window)
        vm.warp(block.timestamp + 49 hours);

        vm.expectEmit(true, false, false, false);
        emit RotationWindowForced(issuerIds[0]);

        vm.prank(admin);
        registry.forceRotationWindow(issuerIds[0]);

        // Now execution should succeed even without safe period
        registry.executeRotation(issuerIds[0]);
    }

    function test_forceRotationWindow_revertsNonAdmin() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.warp(block.timestamp + 49 hours);

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.forceRotationWindow(issuerIds[0]);
    }

    function test_forceRotationWindow_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.NoRotationPending.selector, 0));
        vm.prank(admin);
        registry.forceRotationWindow(0);
    }

    function test_forceRotationWindow_revertsForceWindowNotElapsed() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Only wait 47 hours (need 48)
        vm.warp(block.timestamp + 47 hours);

        vm.expectRevert(); // ForceWindowNotElapsed
        vm.prank(admin);
        registry.forceRotationWindow(issuerIds[0]);
    }

    // ============ cancelRotation Tests ============

    function test_cancelRotation_success() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.expectEmit(true, false, false, false);
        emit KeyRotationCancelled(issuerIds[0]);

        vm.prank(admin);
        registry.cancelRotation(issuerIds[0]);

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation.requestedAt, 0);
    }

    function test_cancelRotation_revertsNonAdmin() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.cancelRotation(issuerIds[0]);
    }

    function test_cancelRotation_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.NoRotationPending.selector, 0));
        vm.prank(admin);
        registry.cancelRotation(0);
    }

    function test_cancelRotation_allowsNewRotationAfterCancel() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.startPrank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");
        registry.cancelRotation(issuerIds[0]);
        registry.requestKeyRotation(issuerIds[0], pubkey3, "");
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation.newPubkey, pubkey3);
    }

    function test_cancelRotation_approvalsDoNotCarryOver() public {
        // This test verifies the fix for the approval carryover security bug
        // Old approvals should NOT count towards a new rotation after cancel
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        // Request first rotation and get 5 approvals
        vm.startPrank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");
        for (uint256 i = 1; i <= 5; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation1 = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation1.approvalCount, 5);

        // Cancel rotation
        vm.prank(admin);
        registry.cancelRotation(issuerIds[0]);

        // Request NEW rotation (with different pubkey)
        // Advance time to ensure new requestedAt is different
        vm.warp(block.timestamp + 1);
        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey3, "");

        // New rotation should start with 0 approvals (old approvals don't carry over)
        TypesLib.KeyRotation memory rotation2 = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation2.approvalCount, 0, "Old approvals should not carry over after cancel");

        // Previous approvers should be able to approve again
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 5; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation3 = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation3.approvalCount, 5, "Previous approvers should be able to approve new rotation");
    }

    function test_requestKeyRotation_revertsSamePubkey() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // Try to rotate to the same pubkey
        vm.expectRevert(IssuerRegistry.SamePubkey.selector);
        vm.prank(admin);
        registry.requestKeyRotation(issuerId, pubkey1, "");
    }

    // ============ Grace Period Tests ============

    function test_isKeyInGracePeriod_falseWhenNeverRotated() public view {
        assertFalse(registry.isKeyInGracePeriod(pubkey1));
    }

    function test_isKeyInGracePeriod_trueAfterRotation() public {
        (uint256[] memory issuerIds, bytes[] memory pubkeys) = _setupIssuersForRotation();
        bytes memory oldPubkey = pubkeys[0];

        // Set current cycle
        vm.prank(admin);
        registry.updateCurrentCycle(100);

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);
        registry.executeRotation(issuerIds[0]);

        // Old key should be in grace period
        assertTrue(registry.isKeyInGracePeriod(oldPubkey));

        // Advance cycle past grace period
        vm.prank(admin);
        registry.updateCurrentCycle(111); // past 100 + 10 grace cycles

        // Old key should no longer be in grace period
        assertFalse(registry.isKeyInGracePeriod(oldPubkey));
    }

    // ============ updateCurrentCycle Tests ============

    function test_updateCurrentCycle_success() public {
        vm.prank(admin);
        registry.updateCurrentCycle(42);
        assertEq(registry.currentCycle(), 42);
    }

    function test_updateCurrentCycle_revertsNonAdmin() public {
        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.updateCurrentCycle(42);
    }

    // ============ canExecuteRotation Tests ============

    function test_canExecuteRotation_returnsFalseWhenNoPending() public view {
        assertFalse(registry.canExecuteRotation(0));
        assertFalse(registry.canExecuteRotation(999));
    }

    function test_canExecuteRotation_returnsFalseWhenInsufficientApprovals() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        assertFalse(registry.canExecuteRotation(issuerIds[0]));
    }

    function test_canExecuteRotation_returnsFalseWhenTimelockNotPassed() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        // Not enough time passed
        assertFalse(registry.canExecuteRotation(issuerIds[0]));
    }

    function test_canExecuteRotation_returnsTrueWhenAllConditionsMet() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(issuerIds[0], issuerIds[i], "");
        }
        vm.stopPrank();

        // Wait for timelock (24h) + safe period (1h)
        vm.warp(block.timestamp + 25 hours);

        assertTrue(registry.canExecuteRotation(issuerIds[0]));
    }

    function test_getPendingRotation_returnsCorrectData() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation.issuerId, issuerIds[0]);
        assertEq(rotation.newPubkey, pubkey2);
        assertEq(rotation.approvalCount, 0);
        assertFalse(rotation.executed);
    }

    // ============ EDGE CASE TESTS ============

    function test_multipleIssuers_sameAddress() public {
        // Same address can be registered multiple times (different IDs)
        vm.startPrank(admin);

        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        uint256 id2 = registry.addIssuer(issuer1Addr, IP_2, pubkey2);

        vm.stopPrank();

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(registry.activeIssuerCount(), 2);
    }

    // ============ TEST MODE TESTS (Story 7.17) ============

    function test_setTestMode_adminCanToggle() public {
        assertTrue(registry.testMode()); // set in setUp

        vm.prank(admin);
        registry.setTestMode(false);
        assertFalse(registry.testMode());

        vm.prank(admin);
        registry.setTestMode(true);
        assertTrue(registry.testMode());
    }

    function test_setTestMode_revertsNonAdmin() public {
        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.setTestMode(false);
    }

    function test_requestKeyRotation_blsMode_revertsWithInvalidSignature() public {
        // Disable testMode to enable BLS verification
        vm.prank(admin);
        registry.setTestMode(false);

        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // Invalid BLS signature (wrong length or invalid)
        bytes memory invalidSig = new bytes(64);

        vm.expectRevert(ErrorsLib.E086_InvalidRotationSignature.selector);
        registry.requestKeyRotation(issuerId, pubkey2, invalidSig);
    }

    function test_requestKeyRotation_blsMode_anyoneCanCallWithValidSig() public {
        // In non-testMode, anyone can call with valid BLS sig
        // Since we can't generate real BLS sigs in tests, we verify the revert path
        vm.prank(admin);
        registry.setTestMode(false);

        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // Non-admin calling without valid sig should get E086
        bytes memory fakeSig = new bytes(64);
        vm.expectRevert(ErrorsLib.E086_InvalidRotationSignature.selector);
        vm.prank(user);
        registry.requestKeyRotation(issuerId, pubkey2, fakeSig);
    }

    function test_approveRotation_blsMode_revertsWithInvalidSignature() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        // Request rotation (in testMode, admin calls)
        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], pubkey2, "");

        // Disable testMode for approval
        vm.prank(admin);
        registry.setTestMode(false);

        // Invalid BLS signature
        bytes memory invalidSig = new bytes(64);
        vm.expectRevert(ErrorsLib.E087_InvalidApprovalSignature.selector);
        registry.approveRotation(issuerIds[0], issuerIds[1], invalidSig);
    }

    // ============ PEER DISCOVERY TESTS (Story 7.17) ============

    function test_getActiveIssuerEndpoints_returnsActiveIssuers() public {
        vm.startPrank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        registry.addIssuer(issuer3Addr, IP_3, pubkey3);
        vm.stopPrank();

        (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys_) = registry.getActiveIssuerEndpoints();

        assertEq(ids.length, 3);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
        assertEq(ids[2], 2);
        assertEq(ips[0], IP_1);
        assertEq(ips[1], IP_2);
        assertEq(ips[2], IP_3);
        assertEq(pubkeys_[0], pubkey1);
        assertEq(pubkeys_[1], pubkey2);
        assertEq(pubkeys_[2], pubkey3);
    }

    function test_getActiveIssuerEndpoints_excludesInactive() public {
        vm.startPrank(admin);
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        registry.removeIssuer(id1);
        vm.stopPrank();

        (uint256[] memory ids, bytes32[] memory ips,) = registry.getActiveIssuerEndpoints();

        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
        assertEq(ips[0], IP_2);
    }

    function test_getActiveIssuerEndpoints_emptyWhenNoIssuers() public view {
        (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys_) = registry.getActiveIssuerEndpoints();
        assertEq(ids.length, 0);
        assertEq(ips.length, 0);
        assertEq(pubkeys_.length, 0);
    }

    function test_updateIssuerIp_testMode_success() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        bytes32 newIp = bytes32(uint256(0xC0A80001)); // 192.168.0.1

        vm.prank(admin);
        registry.updateIssuerIp(issuerId, newIp, "");

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.ip, newIp);
    }

    function test_updateIssuerIp_testMode_revertsNonAdmin() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.updateIssuerIp(issuerId, bytes32(uint256(1)), "");
    }

    function test_updateIssuerIp_blsMode_revertsWithInvalidSig() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.prank(admin);
        registry.setTestMode(false);

        bytes memory invalidSig = new bytes(64);
        vm.expectRevert(ErrorsLib.E088_InvalidIpUpdateSignature.selector);
        registry.updateIssuerIp(issuerId, bytes32(uint256(1)), invalidSig);
    }

    function test_updateIssuerIp_revertsIssuerNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        vm.prank(admin);
        registry.updateIssuerIp(999, bytes32(uint256(1)), "");
    }

    function test_updateIssuerIp_revertsIssuerNotActive() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerId));
        vm.prank(admin);
        registry.updateIssuerIp(issuerId, bytes32(uint256(1)), "");
    }

    function test_updateIssuerIp_reflectedInEndpoints() public {
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        bytes32 newIp = bytes32(uint256(0xC0A80001));
        vm.prank(admin);
        registry.updateIssuerIp(0, newIp, "");

        (, bytes32[] memory ips,) = registry.getActiveIssuerEndpoints();
        assertEq(ips[0], newIp);
    }

    // ============ EDGE CASE TESTS ============

    function test_samePublicKey_differentIssuers() public {
        // Same pubkey can technically be used (though unusual)
        vm.startPrank(admin);

        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        uint256 id2 = registry.addIssuer(issuer2Addr, IP_2, pubkey1);

        vm.stopPrank();

        // Both issuers have the same pubkey stored
        TypesLib.Issuer memory issuer1 = registry.getIssuer(id1);
        TypesLib.Issuer memory issuer2 = registry.getIssuer(id2);
        assertEq(issuer1.blsPubkey, pubkey1);
        assertEq(issuer2.blsPubkey, pubkey1);

        // Aggregated pubkey returns empty (computed off-chain)
        assertEq(registry.getAggregatedPubkey().length, 0);
        assertEq(registry.activeIssuerCount(), 2);
    }

    // ============ REGISTRY STATE CHANGE TESTS (Story 8.1) ============

    // Event for expectEmit
    event RegistryStateChanged(uint256 indexed nonce, uint256 activeCount, bytes32 stateHash);

    function test_addIssuer_emitsRegistryStateChanged() public {
        // Initial nonce should be 0
        assertEq(registry.registryNonce(), 0);

        // Compute expected state hash (will include pubkey1)
        bytes32 expectedHash = keccak256(abi.encodePacked(pubkey1));

        vm.expectEmit(true, false, false, true);
        emit RegistryStateChanged(1, 1, expectedHash);

        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // Verify nonce incremented
        assertEq(registry.registryNonce(), 1);
    }

    function test_addIssuer_incrementsNonceCorrectly() public {
        assertEq(registry.registryNonce(), 0);

        vm.startPrank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        assertEq(registry.registryNonce(), 1);

        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        assertEq(registry.registryNonce(), 2);

        registry.addIssuer(issuer3Addr, IP_3, pubkey3);
        assertEq(registry.registryNonce(), 3);
        vm.stopPrank();
    }

    function test_removeIssuer_emitsRegistryStateChanged() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        assertEq(registry.registryNonce(), 1);

        // After removal, state hash should be empty (keccak256 of empty bytes)
        bytes32 expectedHash = keccak256("");

        vm.expectEmit(true, false, false, true);
        emit RegistryStateChanged(2, 0, expectedHash);

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        assertEq(registry.registryNonce(), 2);
    }

    function test_executeRotation_emitsRegistryStateChanged() public {
        (uint256[] memory issuerIds, bytes[] memory pubkeys_) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];

        uint256 nonceAfterSetup = registry.registryNonce();
        assertEq(nonceAfterSetup, 20); // 20 issuers added

        // New pubkey for rotation
        bytes memory newPubkey = abi.encodePacked(
            uint256(9999),
            uint256(9998),
            uint256(9997),
            uint256(9996)
        );

        // Request rotation
        vm.prank(admin);
        registry.requestKeyRotation(rotatingId, newPubkey, "");

        // Get 10 approvals
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(rotatingId, issuerIds[i], "");
        }
        vm.stopPrank();

        // Wait for timelock + safe period
        vm.warp(block.timestamp + 25 hours);

        // Compute expected state hash (new pubkey + remaining 19 issuers)
        bytes memory packed = abi.encodePacked(newPubkey);
        for (uint256 i = 1; i < 20; i++) {
            packed = abi.encodePacked(packed, pubkeys_[i]);
        }
        bytes32 expectedHash = keccak256(packed);

        vm.expectEmit(true, false, false, true);
        emit RegistryStateChanged(nonceAfterSetup + 1, 20, expectedHash);

        registry.executeRotation(rotatingId);

        assertEq(registry.registryNonce(), nonceAfterSetup + 1);
    }

    function test_getRegistryStateHash_correctForKnownIssuers() public {
        // Empty registry
        bytes32 emptyHash = registry.getRegistryStateHash();
        assertEq(emptyHash, keccak256(""));

        // Add first issuer
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        bytes32 hash1 = registry.getRegistryStateHash();
        assertEq(hash1, keccak256(abi.encodePacked(pubkey1)));

        // Add second issuer
        vm.prank(admin);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);

        bytes32 hash2 = registry.getRegistryStateHash();
        assertEq(hash2, keccak256(abi.encodePacked(pubkey1, pubkey2)));

        // Add third issuer
        vm.prank(admin);
        registry.addIssuer(issuer3Addr, IP_3, pubkey3);

        bytes32 hash3 = registry.getRegistryStateHash();
        assertEq(hash3, keccak256(abi.encodePacked(pubkey1, pubkey2, pubkey3)));
    }

    function test_registryNonce_returnsCorrectValueAfterMutations() public {
        assertEq(registry.registryNonce(), 0);

        vm.startPrank(admin);

        // Add 3 issuers
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        assertEq(registry.registryNonce(), 1);

        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        assertEq(registry.registryNonce(), 2);

        registry.addIssuer(issuer3Addr, IP_3, pubkey3);
        assertEq(registry.registryNonce(), 3);

        // Remove one issuer
        registry.removeIssuer(id1);
        assertEq(registry.registryNonce(), 4);

        vm.stopPrank();
    }

    function test_stateHash_changesWhenIssuersAddedRemoved() public {
        bytes32 hash0 = registry.getRegistryStateHash();

        // Add first issuer - hash changes
        vm.prank(admin);
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        bytes32 hash1 = registry.getRegistryStateHash();
        assertTrue(hash0 != hash1);

        // Add second issuer - hash changes again
        vm.prank(admin);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        bytes32 hash2 = registry.getRegistryStateHash();
        assertTrue(hash1 != hash2);

        // Remove first issuer - hash changes
        vm.prank(admin);
        registry.removeIssuer(id1);
        bytes32 hash3 = registry.getRegistryStateHash();
        assertTrue(hash2 != hash3);

        // hash3 should equal just pubkey2 since issuer1 was removed
        assertEq(hash3, keccak256(abi.encodePacked(pubkey2)));
    }

    function test_getRegistryStateHash_skipInactiveIssuers() public {
        vm.startPrank(admin);

        // Add 3 issuers
        uint256 id1 = registry.addIssuer(issuer1Addr, IP_1, pubkey1);
        registry.addIssuer(issuer2Addr, IP_2, pubkey2);
        registry.addIssuer(issuer3Addr, IP_3, pubkey3);

        // Remove the first issuer
        registry.removeIssuer(id1);

        vm.stopPrank();

        // State hash should only include pubkey2 and pubkey3
        bytes32 stateHash = registry.getRegistryStateHash();
        assertEq(stateHash, keccak256(abi.encodePacked(pubkey2, pubkey3)));
    }

    function test_registryStateChanged_eventDataMatchesViewFunctions() public {
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        // After add, state should match
        uint256 nonce = registry.registryNonce();
        uint256 activeCount = registry.activeIssuerCount();
        bytes32 stateHash = registry.getRegistryStateHash();

        assertEq(nonce, 1);
        assertEq(activeCount, 1);
        assertEq(stateHash, keccak256(abi.encodePacked(pubkey1)));
    }

    function test_addIssuer_eventOrderIssuerAddedBeforeStateChanged() public {
        // AC5: _emitStateChange() must be called AFTER emit IssuerAdded
        vm.recordLogs();

        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Find IssuerAdded and RegistryStateChanged events
        bytes32 issuerAddedSig = keccak256("IssuerAdded(uint256,address,bytes)");
        bytes32 stateChangedSig = keccak256("RegistryStateChanged(uint256,uint256,bytes32)");

        uint256 issuerAddedIdx = type(uint256).max;
        uint256 stateChangedIdx = type(uint256).max;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == issuerAddedSig) {
                issuerAddedIdx = i;
            }
            if (logs[i].topics[0] == stateChangedSig) {
                stateChangedIdx = i;
            }
        }

        assertTrue(issuerAddedIdx != type(uint256).max, "IssuerAdded event not found");
        assertTrue(stateChangedIdx != type(uint256).max, "RegistryStateChanged event not found");
        assertTrue(issuerAddedIdx < stateChangedIdx, "IssuerAdded must come before RegistryStateChanged");
    }

    function test_removeIssuer_eventOrderIssuerRemovedBeforeStateChanged() public {
        // AC6: _emitStateChange() must be called AFTER emit IssuerRemoved
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1);

        vm.recordLogs();

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 issuerRemovedSig = keccak256("IssuerRemoved(uint256)");
        bytes32 stateChangedSig = keccak256("RegistryStateChanged(uint256,uint256,bytes32)");

        uint256 issuerRemovedIdx = type(uint256).max;
        uint256 stateChangedIdx = type(uint256).max;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == issuerRemovedSig) {
                issuerRemovedIdx = i;
            }
            if (logs[i].topics[0] == stateChangedSig) {
                stateChangedIdx = i;
            }
        }

        assertTrue(issuerRemovedIdx != type(uint256).max, "IssuerRemoved event not found");
        assertTrue(stateChangedIdx != type(uint256).max, "RegistryStateChanged event not found");
        assertTrue(issuerRemovedIdx < stateChangedIdx, "IssuerRemoved must come before RegistryStateChanged");
    }

    function test_executeRotation_eventOrderKeyRotationExecutedBeforeStateChanged() public {
        // AC7: _emitStateChange() must be called AFTER emit KeyRotationExecuted
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];

        bytes memory newPubkey = abi.encodePacked(uint256(1000), uint256(1001), uint256(1002), uint256(1003));

        vm.prank(admin);
        registry.requestKeyRotation(rotatingId, newPubkey, "");

        vm.startPrank(admin);
        for (uint256 i = 1; i <= 10; i++) {
            registry.approveRotation(rotatingId, issuerIds[i], "");
        }
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);

        vm.recordLogs();
        registry.executeRotation(rotatingId);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 rotationExecutedSig = keccak256("KeyRotationExecuted(uint256,bytes,bytes)");
        bytes32 stateChangedSig = keccak256("RegistryStateChanged(uint256,uint256,bytes32)");

        uint256 rotationExecutedIdx = type(uint256).max;
        uint256 stateChangedIdx = type(uint256).max;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == rotationExecutedSig) {
                rotationExecutedIdx = i;
            }
            if (logs[i].topics[0] == stateChangedSig) {
                stateChangedIdx = i;
            }
        }

        assertTrue(rotationExecutedIdx != type(uint256).max, "KeyRotationExecuted event not found");
        assertTrue(stateChangedIdx != type(uint256).max, "RegistryStateChanged event not found");
        assertTrue(rotationExecutedIdx < stateChangedIdx, "KeyRotationExecuted must come before RegistryStateChanged");
    }
}
