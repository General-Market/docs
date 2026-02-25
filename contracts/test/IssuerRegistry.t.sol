// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Test.sol";
import "./helpers/TestHelper.sol";
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
contract IssuerRegistryTest is TestHelper {
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

    // Real BLS pubkeys from deterministic seeds (generated via FFI in setUp)
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

        // Generate REAL BLS G2 pubkeys from deterministic seeds via FFI
        pubkey1 = blsPubkey(0);
        pubkey2 = blsPubkey(1);
        pubkey3 = blsPubkey(2);

        // Set the aggregated pubkey from seeds 0,1,2
        // Nonce is 0 because no issuers have been added yet (no state changes)
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        vm.prank(admin);
        registry.setAggregatedPubkey(aggPubkey, 0);
    }

    // ============ BLS SIGNING HELPERS ============

    /// @notice Generate a Proof of Possession (PoP) signature for addIssuer
    /// @param issuerAddr The issuer's address
    /// @param pubkey The BLS public key
    /// @param seedIndex The seed index of the key (for signing)
    function _signPoP(address issuerAddr, bytes memory pubkey, uint8 seedIndex) internal returns (bytes memory) {
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), issuerAddr, pubkey));
        return blsSign(vm.toString(uint256(seedIndex)), popMsg);
    }

    /// @notice Sign a requestKeyRotation message with the individual issuer's key
    function _signRotationRequest(uint256 issuerId, bytes memory newPubkey, uint8 seedIndex) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode("ROTATE", issuerId, newPubkey));
        return blsSign(vm.toString(uint256(seedIndex)), message);
    }

    /// @notice Generate a Proof of Possession (PoP) for a new key during rotation
    /// @param issuerAddr The issuer's address
    /// @param newPubkey The new BLS public key
    /// @param newKeySeedIndex The seed index of the NEW key (for signing)
    function _signRotationPoP(address issuerAddr, bytes memory newPubkey, uint8 newKeySeedIndex) internal returns (bytes memory) {
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), issuerAddr, newPubkey));
        return blsSign(vm.toString(uint256(newKeySeedIndex)), popMsg);
    }

    /// @notice Sign an approveRotation message with the approving issuer's key
    function _signApproval(uint256 rotatingIssuerId, bytes memory newPubkey, uint8 approverSeedIndex) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode("APPROVE_ROTATION", rotatingIssuerId, newPubkey));
        return blsSign(vm.toString(uint256(approverSeedIndex)), message);
    }

    /// @notice Sign an updateIssuerIp message with the issuer's key
    function _signIpUpdate(uint256 issuerId, bytes32 newIp, uint8 seedIndex) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode("UPDATE_IP", issuerId, newIp));
        return blsSign(vm.toString(uint256(seedIndex)), message);
    }

    // ============ SNAPSHOT HELPERS ============

    /// @notice Wrapper: addIssuer + auto-snapshot to satisfy PendingSnapshot constraint
    function _addIssuerAndSnapshot(
        address issuerAddr, bytes32 ip, bytes memory pubkey, bytes memory popSig
    ) internal returns (uint256 issuerId) {
        vm.prank(admin);
        issuerId = registry.addIssuer(issuerAddr, ip, pubkey, popSig);
        uint256 nonce = registry.registryNonce();
        vm.prank(admin);
        registry.setAggregatedPubkey(pubkey, nonce);
    }

    /// @notice Wrapper: removeIssuer + auto-snapshot
    function _removeIssuerAndSnapshot(uint256 issuerId) internal {
        vm.prank(admin);
        registry.removeIssuer(issuerId);
        uint256 nonce = registry.registryNonce();
        bytes memory pubkey = registry.getAggregatedPubkey();
        if (pubkey.length == 0) pubkey = new bytes(128);
        vm.prank(admin);
        registry.setAggregatedPubkey(pubkey, nonce);
    }

    // ============ INITIALIZATION TESTS ============

    function test_initialization_setsGovernance() public view {
        assertEq(address(registry.governance()), address(governance));
    }

    function test_initialization_aggregatedPubkeySetInSetUp() public view {
        // setUp sets a real aggregated pubkey from seeds 0,1,2
        bytes memory aggPubkey = registry.getAggregatedPubkey();
        assertEq(aggPubkey.length, 128);
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
        bytes memory pop1 = _signPoP(issuer1Addr, pubkey1, 0);
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1, pop1);

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

        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        assertEq(registry.activeIssuerCount(), 1);

        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

        assertEq(registry.activeIssuerCount(), 2);
    }

    function test_addIssuer_assignsSequentialIds() public {
        bytes memory pop1 = _signPoP(issuer1Addr, pubkey1, 0);
        bytes memory pop2 = _signPoP(issuer2Addr, pubkey2, 1);
        bytes memory pop3 = _signPoP(issuer3Addr, pubkey3, 2);

        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, pop1);
        uint256 id2 = _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, pop2);
        uint256 id3 = _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, pop3);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
    }

    function test_addIssuer_emitsIssuerAdded() public {
        bytes memory pop1 = _signPoP(issuer1Addr, pubkey1, 0);

        vm.expectEmit(true, true, false, true);
        emit IssuerAdded(0, issuer1Addr, pubkey1);

        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, pop1);
    }

    function test_addIssuer_storesPubkeyCorrectly() public {
        // Aggregated pubkey is set in setUp
        bytes memory initialAgg = registry.getAggregatedPubkey();
        assertEq(initialAgg.length, 128);

        // Add first issuer
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Verify pubkey stored correctly on issuer struct
        TypesLib.Issuer memory issuer = registry.getIssuer(0);
        assertEq(issuer.blsPubkey, pubkey1);

        // Add second issuer
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

        // Verify second pubkey stored correctly
        TypesLib.Issuer memory issuer2 = registry.getIssuer(1);
        assertEq(issuer2.blsPubkey, pubkey2);

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
    }

    function test_addIssuer_revertsForNonAdmin() public {
        vm.expectRevert(IssuerRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, new bytes(64));
    }

    function test_addIssuer_revertsForZeroAddress() public {
        vm.expectRevert(IssuerRegistry.ZeroAddress.selector);
        vm.prank(admin);
        registry.addIssuer(address(0), IP_1, pubkey1, new bytes(64));
    }

    function test_addIssuer_revertsForInvalidPubkeyLength() public {
        bytes memory shortPubkey = new bytes(32);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InvalidPubkeyLength.selector, 32));
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, shortPubkey, new bytes(64));
    }

    function test_addIssuer_storesValidPubkeyWithPoP() public {
        // With PoP verification, only real BLS pubkeys (with valid PoP) can be registered.
        // Use a real pubkey from seed 0 with valid PoP.
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Verify it was stored
        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.blsPubkey, pubkey1);
    }

    // ============ REMOVE ISSUER TESTS ============

    function test_removeIssuer_deactivatesIssuer() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        vm.prank(admin);
        registry.removeIssuer(issuerId);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.status, 0); // inactive
    }

    function test_removeIssuer_decrementsActiveCount() public {
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

        assertEq(registry.activeIssuerCount(), 2);

        vm.prank(admin);
        registry.removeIssuer(id1);

        assertEq(registry.activeIssuerCount(), 1);
    }

    function test_removeIssuer_emitsIssuerRemoved() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        vm.expectEmit(true, false, false, false);
        emit IssuerRemoved(issuerId);

        vm.prank(admin);
        registry.removeIssuer(issuerId);
    }

    function test_removeIssuer_deactivatesButKeepsPubkey() public {
        // Add two issuers
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

        // Remove first issuer
        vm.prank(admin);
        registry.removeIssuer(id1);

        // Pubkey is still stored (just inactive)
        TypesLib.Issuer memory issuer = registry.getIssuer(id1);
        assertEq(issuer.blsPubkey, pubkey1);
        assertEq(issuer.status, 0); // inactive

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
    }

    function test_removeIssuer_addAndRemoveRestoresZero() public {
        // Add issuer
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Remove issuer
        vm.prank(admin);
        registry.removeIssuer(issuerId);

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        bytes memory agg = registry.getAggregatedPubkey();
        assertEq(agg.length, 128);

        // Verify issuer is inactive
        assertEq(registry.activeIssuerCount(), 0);
    }

    function test_removeIssuer_revertsForNonAdmin() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

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
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        _removeIssuerAndSnapshot(issuerId);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerId));
        vm.prank(admin);
        registry.removeIssuer(issuerId);
    }

    // ============ VIEW FUNCTIONS TESTS ============

    function test_getIssuer_returnsCorrectData() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

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
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));

        TypesLib.Issuer[] memory issuers = registry.getIssuers();

        assertEq(issuers.length, 3);
        assertEq(issuers[0].addr, issuer1Addr);
        assertEq(issuers[1].addr, issuer2Addr);
        assertEq(issuers[2].addr, issuer3Addr);
    }

    function test_getIssuers_includesInactiveIssuers() public {
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        _removeIssuerAndSnapshot(id1);

        TypesLib.Issuer[] memory issuers = registry.getIssuers();

        assertEq(issuers.length, 2);
        assertEq(issuers[0].status, 0); // inactive
        assertEq(issuers[1].status, 1); // active
    }

    function test_activeIssuerCount_accurate() public {
        assertEq(registry.activeIssuerCount(), 0);

        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        assertEq(registry.activeIssuerCount(), 1);

        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        assertEq(registry.activeIssuerCount(), 2);

        vm.prank(admin);
        registry.removeIssuer(id1);
        assertEq(registry.activeIssuerCount(), 1);
    }

    // ============ AGGREGATED PUBKEY MATH TESTS ============

    function test_aggregatedPubkey_offChainComputation() public {
        // G2 aggregation is computed off-chain; aggregated pubkey is set in setUp and not auto-updated

        // Add all three issuers
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        uint256 id2 = _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
        assertEq(registry.activeIssuerCount(), 3);

        // Remove issuer 1
        _removeIssuerAndSnapshot(id1);

        // Not auto-updated (off-chain aggregation)
        assertEq(registry.getAggregatedPubkey().length, 128);
        assertEq(registry.activeIssuerCount(), 2);

        // Remove issuer 2
        _removeIssuerAndSnapshot(id2);

        // Not auto-updated
        assertEq(registry.getAggregatedPubkey().length, 128);
        assertEq(registry.activeIssuerCount(), 1);

        // Individual pubkeys are preserved on issuer structs
        TypesLib.Issuer memory issuer3 = registry.getIssuer(2);
        assertEq(issuer3.blsPubkey, pubkey3);
        assertEq(issuer3.status, 1); // active
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
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

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

        bytes memory pop = _signPoP(issuerAddr, pubkey1, 0);
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuerAddr, IP_1, pubkey1, pop);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.addr, issuerAddr);
        assertEq(issuer.status, 1);
    }

    function testFuzz_addIssuer_anyIP(bytes32 ip) public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, ip, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.ip, ip);
    }

    // ============ BLS VERIFICATION STUB TESTS ============

    function test_removeIssuerByVote_revertsWithInvalidBLSSignature() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes memory fakeSignature = new bytes(128);
        uint256 refNonce = registry.lastSnapshotNonce();

        vm.expectRevert(IssuerRegistry.InvalidBLSSignature.selector);
        registry.removeIssuerByVote(issuerId, fakeSignature, refNonce, SIGNERS_BITMASK);
    }

    // ============ KEY ROTATION TESTS (Story 2.13) ============

    // Key rotation events
    event KeyRotationRequested(uint256 indexed issuerId, bytes newPubkey);
    event KeyRotationApproved(uint256 indexed rotatingIssuerId, uint256 indexed approvingIssuerId, uint256 approvalCount);
    event KeyRotationExecuted(uint256 indexed issuerId, bytes oldPubkey, bytes newPubkey);
    event RotationWindowForced(uint256 indexed issuerId);
    event KeyRotationCancelled(uint256 indexed issuerId);

    /// @notice Helper to set up 20 issuers for rotation tests
    /// @dev Uses real BLS pubkeys from deterministic seeds via FFI
    function _setupIssuersForRotation() internal returns (uint256[] memory issuerIds, bytes[] memory pubkeys) {
        issuerIds = new uint256[](20);
        pubkeys = new bytes[](20);

        for (uint256 i = 0; i < 20; i++) {
            (issuerIds[i], pubkeys[i]) = _registerSingleIssuerAndSnapshot(i);
        }

        return (issuerIds, pubkeys);
    }

    /// @dev Inner helper to reduce stack depth in _setupIssuersForRotation loop
    function _registerSingleIssuerAndSnapshot(uint256 i) internal returns (uint256 id, bytes memory pk) {
        pk = blsPubkey(uint8(i));
        address issuerAddr = makeAddr(string(abi.encodePacked("issuer", i)));
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), issuerAddr, pk));
        bytes memory popSig = blsSign(vm.toString(i), popMsg);
        id = _addIssuerAndSnapshot(issuerAddr, bytes32(i), pk, popSig);
    }

    // ============ requestKeyRotation Tests ============

    function test_requestKeyRotation_success() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes memory sig = _signRotationRequest(issuerId, pubkey2, 0);
        bytes memory newKeyPop = _signRotationPoP(issuer1Addr, pubkey2, 1);

        vm.expectEmit(true, false, false, true);
        emit KeyRotationRequested(issuerId, pubkey2);

        registry.requestKeyRotation(issuerId, pubkey2, sig, newKeyPop);

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerId);
        assertEq(rotation.issuerId, issuerId);
        assertEq(rotation.newPubkey, pubkey2);
        assertEq(rotation.requestedAt, block.timestamp);
        assertEq(rotation.approvalCount, 0);
        assertFalse(rotation.executed);
    }

    function test_requestKeyRotation_anyoneCanCallWithValidBLS() public {
        // BLS signature verification replaces admin access control for key rotation.
        // Anyone with a valid BLS sig (signed by the issuer's current key) can request rotation.
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes memory sig = _signRotationRequest(issuerId, pubkey2, 0);
        bytes memory newKeyPop = _signRotationPoP(issuer1Addr, pubkey2, 1);

        // Non-admin call succeeds because BLS signature is valid
        vm.prank(user);
        registry.requestKeyRotation(issuerId, pubkey2, sig, newKeyPop);

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerId);
        assertEq(rotation.newPubkey, pubkey2);
    }

    function test_requestKeyRotation_revertsIssuerNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        registry.requestKeyRotation(999, pubkey2, new bytes(64), new bytes(64));
    }

    function test_requestKeyRotation_revertsIssuerNotActive() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        _removeIssuerAndSnapshot(issuerId);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerId));
        registry.requestKeyRotation(issuerId, pubkey2, new bytes(64), new bytes(64));
    }

    function test_requestKeyRotation_revertsInvalidPubkeyLength() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes memory shortPubkey = new bytes(32);
        // BLS check happens before pubkey length check, so sign correctly
        bytes memory sig = _signRotationRequest(issuerId, shortPubkey, 0);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InvalidPubkeyLength.selector, 32));
        registry.requestKeyRotation(issuerId, shortPubkey, sig, new bytes(64));
    }

    function test_requestKeyRotation_revertsInvalidPubkey() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // 64-byte pubkey is invalid length (must be 128 for G2)
        bytes memory invalidPubkey = abi.encodePacked(uint256(12345), uint256(67890));
        bytes memory sig = _signRotationRequest(issuerId, invalidPubkey, 0);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InvalidPubkeyLength.selector, 64));
        registry.requestKeyRotation(issuerId, invalidPubkey, sig, new bytes(64));
    }

    function test_requestKeyRotation_revertsRotationAlreadyPending() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        registry.requestKeyRotation(issuerId, pubkey2, _signRotationRequest(issuerId, pubkey2, 0), _signRotationPoP(issuer1Addr, pubkey2, 1));

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.RotationAlreadyPending.selector, issuerId));
        registry.requestKeyRotation(issuerId, pubkey3, _signRotationRequest(issuerId, pubkey3, 0), _signRotationPoP(issuer1Addr, pubkey3, 2));
    }

    // ============ approveRotation Tests ============

    function test_approveRotation_success() public {
        (uint256[] memory issuerIds, bytes[] memory pubkeys) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];
        uint256 approvingId = issuerIds[1];
        address issuer0Addr = makeAddr(string(abi.encodePacked("issuer", uint256(0))));

        // Request rotation to a fresh key (seed 20, not registered)
        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(issuer0Addr, newPubkey, 20));

        // Get the new pubkey for the approval message
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, 1);

        vm.expectEmit(true, true, false, true);
        emit KeyRotationApproved(rotatingId, approvingId, 1);

        registry.approveRotation(rotatingId, approvingId, sig);

        TypesLib.KeyRotation memory rotationAfter = registry.getPendingRotation(rotatingId);
        assertEq(rotationAfter.approvalCount, 1);
    }

    function test_approveRotation_anyoneCanCallWithValidBLS() public {
        // BLS signature verification replaces admin access control for approval.
        // Anyone can relay a valid BLS-signed approval.
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        address issuer0Addr = makeAddr(string(abi.encodePacked("issuer", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(issuer0Addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, 1);

        // Non-admin call succeeds because BLS signature is valid
        vm.prank(user);
        registry.approveRotation(issuerIds[0], issuerIds[1], sig);

        TypesLib.KeyRotation memory rotationAfter = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotationAfter.approvalCount, 1);
    }

    function test_approveRotation_revertsNoRotationPending() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.NoRotationPending.selector, issuerIds[0]));
        registry.approveRotation(issuerIds[0], issuerIds[1], new bytes(64));
    }

    function test_approveRotation_revertsSelfApproval() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        address issuer0Addr = makeAddr(string(abi.encodePacked("issuer", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(issuer0Addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, 0);

        vm.expectRevert(IssuerRegistry.SelfApprovalNotAllowed.selector);
        registry.approveRotation(issuerIds[0], issuerIds[0], sig);
    }

    function test_approveRotation_revertsDoubleApproval() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        address issuer0Addr = makeAddr(string(abi.encodePacked("issuer", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(issuer0Addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        bytes memory sig1 = _signApproval(issuerIds[0], rotation.newPubkey, 1);
        bytes memory sig2 = _signApproval(issuerIds[0], rotation.newPubkey, 1);

        registry.approveRotation(issuerIds[0], issuerIds[1], sig1);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.AlreadyApproved.selector, issuerIds[1]));
        registry.approveRotation(issuerIds[0], issuerIds[1], sig2);
    }

    function test_approveRotation_revertsApprovingIssuerNotFound() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        address issuer0Addr = makeAddr(string(abi.encodePacked("issuer", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(issuer0Addr, newPubkey, 20));

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        registry.approveRotation(issuerIds[0], 999, new bytes(64));
    }

    function test_approveRotation_revertsApprovingIssuerNotActive() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();
        address issuer0Addr = makeAddr(string(abi.encodePacked("issuer", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(issuer0Addr, newPubkey, 20));

        // Remove approving issuer
        vm.prank(admin);
        registry.removeIssuer(issuerIds[1]);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerIds[1]));
        registry.approveRotation(issuerIds[0], issuerIds[1], new bytes(64));
    }

    // ============ executeRotation Tests ============

    function test_executeRotation_fullFlow() public {
        (uint256[] memory issuerIds, bytes[] memory pubkeys) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];
        bytes memory oldPubkey = pubkeys[0];

        // Generate new real 128-byte G2 pubkey from seed 20 (not used by any issuer)
        bytes memory newPubkey = blsPubkey(20);

        // Request rotation (seed 0 signs)
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getIssuer(rotatingId).addr, newPubkey, 20));

        // Get 10 approvals from other issuers
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            registry.approveRotation(rotatingId, issuerIds[i], sig);
        }

        // Wait for timelock (24h) + safe period (1h)
        vm.warp(block.timestamp + 25 hours);

        // Execute
        vm.expectEmit(true, false, false, true);
        emit KeyRotationExecuted(rotatingId, oldPubkey, newPubkey);

        registry.executeRotation(rotatingId);

        // Verify rotation
        TypesLib.KeyRotation memory rotationAfter = registry.getPendingRotation(rotatingId);
        assertTrue(rotationAfter.executed);

        // Verify issuer pubkey updated
        TypesLib.Issuer memory issuer = registry.getIssuer(rotatingId);
        assertEq(issuer.blsPubkey, newPubkey);

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
    }

    function test_executeRotation_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.NoRotationPending.selector, 0));
        registry.executeRotation(0);
    }

    function test_executeRotation_revertsInsufficientApprovals() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        // Only get 9 approvals (need 10)
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 9; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        vm.warp(block.timestamp + 25 hours);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.InsufficientApprovals.selector, 9, 10));
        registry.executeRotation(issuerIds[0]);
    }

    function test_executeRotation_revertsTimelockNotExpired() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        // Only wait 23 hours (need 24)
        vm.warp(block.timestamp + 23 hours);

        vm.expectRevert(); // TimelockNotExpired
        registry.executeRotation(issuerIds[0]);
    }

    function test_executeRotation_revertsSafePeriodNotElapsed() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        // Fast forward 24h - timelock satisfied, but we'll test safe period by adding late approval
        vm.warp(block.timestamp + 24 hours);

        // Add one more approval (11th) now - this resets the safe period timer
        bytes memory lateSig = _signApproval(issuerIds[0], rotation.newPubkey, 11);
        registry.approveRotation(issuerIds[0], issuerIds[11], lateSig);

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

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        vm.warp(block.timestamp + 25 hours);

        registry.executeRotation(issuerIds[0]);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.RotationAlreadyExecuted.selector, issuerIds[0]));
        registry.executeRotation(issuerIds[0]);
    }

    // ============ forceRotationWindow Tests ============

    function test_forceRotationWindow_success() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

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

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

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

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        // Only wait 47 hours (need 48)
        vm.warp(block.timestamp + 47 hours);

        vm.expectRevert(); // ForceWindowNotElapsed
        vm.prank(admin);
        registry.forceRotationWindow(issuerIds[0]);
    }

    // ============ cancelRotation Tests ============

    function test_cancelRotation_success() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        vm.expectEmit(true, false, false, false);
        emit KeyRotationCancelled(issuerIds[0]);

        vm.prank(admin);
        registry.cancelRotation(issuerIds[0]);

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation.requestedAt, 0);
    }

    function test_cancelRotation_revertsNonAdmin() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

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

        bytes memory newPubkey1 = blsPubkey(20);
        bytes memory newPubkey2 = blsPubkey(21);

        vm.prank(admin);
        registry.requestKeyRotation(issuerIds[0], newPubkey1, _signRotationRequest(issuerIds[0], newPubkey1, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey1, 20));
        vm.prank(admin);
        registry.cancelRotation(issuerIds[0]);
        registry.requestKeyRotation(issuerIds[0], newPubkey2, _signRotationRequest(issuerIds[0], newPubkey2, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey2, 21));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation.newPubkey, newPubkey2);
    }

    function test_cancelRotation_approvalsDoNotCarryOver() public {
        // This test verifies the fix for the approval carryover security bug
        // Old approvals should NOT count towards a new rotation after cancel
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey1 = blsPubkey(20);
        bytes memory newPubkey2 = blsPubkey(21);

        // Request first rotation and get 5 approvals
        registry.requestKeyRotation(issuerIds[0], newPubkey1, _signRotationRequest(issuerIds[0], newPubkey1, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey1, 20));

        TypesLib.KeyRotation memory rotation1 = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 5; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation1.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        TypesLib.KeyRotation memory rotation1After = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation1After.approvalCount, 5);

        // Cancel rotation
        vm.prank(admin);
        registry.cancelRotation(issuerIds[0]);

        // Request NEW rotation (with different pubkey)
        // Advance time to ensure new requestedAt is different
        vm.warp(block.timestamp + 1);
        registry.requestKeyRotation(issuerIds[0], newPubkey2, _signRotationRequest(issuerIds[0], newPubkey2, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey2, 21));

        // New rotation should start with 0 approvals (old approvals don't carry over)
        TypesLib.KeyRotation memory rotation2 = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation2.approvalCount, 0, "Old approvals should not carry over after cancel");

        // Previous approvers should be able to approve again
        for (uint256 i = 1; i <= 5; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation2.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        TypesLib.KeyRotation memory rotation3 = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation3.approvalCount, 5, "Previous approvers should be able to approve new rotation");
    }

    function test_requestKeyRotation_revertsSamePubkey() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Try to rotate to the same pubkey
        bytes memory sig = _signRotationRequest(issuerId, pubkey1, 0);
        vm.expectRevert(IssuerRegistry.SamePubkey.selector);
        registry.requestKeyRotation(issuerId, pubkey1, sig, new bytes(64));
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

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

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

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        assertFalse(registry.canExecuteRotation(issuerIds[0]));
    }

    function test_canExecuteRotation_returnsFalseWhenTimelockNotPassed() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        // Not enough time passed
        assertFalse(registry.canExecuteRotation(issuerIds[0]));
    }

    function test_canExecuteRotation_returnsTrueWhenAllConditionsMet() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(issuerIds[0], rotation.newPubkey, uint8(i));
            registry.approveRotation(issuerIds[0], issuerIds[i], sig);
        }

        // Wait for timelock (24h) + safe period (1h)
        vm.warp(block.timestamp + 25 hours);

        assertTrue(registry.canExecuteRotation(issuerIds[0]));
    }

    function test_getPendingRotation_returnsCorrectData() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        assertEq(rotation.issuerId, issuerIds[0]);
        assertEq(rotation.newPubkey, newPubkey);
        assertEq(rotation.approvalCount, 0);
        assertFalse(rotation.executed);
    }

    // ============ EDGE CASE TESTS ============

    function test_multipleIssuers_sameAddress() public {
        // Same address can be registered multiple times (different IDs)
        bytes memory pop1 = _signPoP(issuer1Addr, pubkey1, 0);
        bytes memory pop2 = _signPoP(issuer1Addr, pubkey2, 1);

        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, pop1);
        uint256 id2 = _addIssuerAndSnapshot(issuer1Addr, IP_2, pubkey2, pop2);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(registry.activeIssuerCount(), 2);
    }

    // ============ BLS VERIFICATION TESTS (Story 7.17) ============

    function test_requestKeyRotation_revertsWithInvalidSignature() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Sign with a WRONG seed index (seed 1 instead of seed 0 which owns the key)
        bytes32 message = keccak256(abi.encode("ROTATE", issuerId, pubkey2));
        bytes memory wrongSig = blsSign("1", message);

        vm.expectRevert(ErrorsLib.E086_InvalidRotationSignature.selector);
        registry.requestKeyRotation(issuerId, pubkey2, wrongSig, new bytes(64));
    }

    function test_requestKeyRotation_anyoneCanCallWithValidSig() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Non-admin calling with wrong sig should get E086
        bytes32 message = keccak256(abi.encode("ROTATE", issuerId, pubkey2));
        bytes memory wrongSig = blsSign("1", message); // signed by wrong key
        vm.expectRevert(ErrorsLib.E086_InvalidRotationSignature.selector);
        vm.prank(user);
        registry.requestKeyRotation(issuerId, pubkey2, wrongSig, new bytes(64));
    }

    function test_approveRotation_revertsWithInvalidSignature() public {
        (uint256[] memory issuerIds,) = _setupIssuersForRotation();

        // Request rotation (with valid BLS from seed 0)
        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(issuerIds[0], newPubkey, _signRotationRequest(issuerIds[0], newPubkey, 0), _signRotationPoP(registry.getIssuer(issuerIds[0]).addr, newPubkey, 20));

        // Sign approval with WRONG seed index (seed 2 instead of seed 1)
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(issuerIds[0]);
        bytes32 message = keccak256(abi.encode("APPROVE_ROTATION", issuerIds[0], rotation.newPubkey));
        bytes memory wrongSig = blsSign("2", message); // signed by seed 2, not seed 1

        vm.expectRevert(ErrorsLib.E087_InvalidApprovalSignature.selector);
        registry.approveRotation(issuerIds[0], issuerIds[1], wrongSig);
    }

    // ============ PEER DISCOVERY TESTS (Story 7.17) ============

    function test_getActiveIssuerEndpoints_returnsActiveIssuers() public {
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));

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
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        _removeIssuerAndSnapshot(id1);

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

    function test_updateIssuerIp_success() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes32 newIp = bytes32(uint256(0xC0A80001)); // 192.168.0.1

        // Sign with seed 0 (the issuer's key)
        bytes memory sig = _signIpUpdate(issuerId, newIp, 0);
        registry.updateIssuerIp(issuerId, newIp, sig);

        TypesLib.Issuer memory issuer = registry.getIssuer(issuerId);
        assertEq(issuer.ip, newIp);
    }

    function test_updateIssuerIp_revertsWithInvalidSig() public {
        vm.prank(admin);
        uint256 issuerId = registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Sign with WRONG seed (seed 1 instead of seed 0)
        bytes32 newIp = bytes32(uint256(1));
        bytes memory wrongSig = _signIpUpdate(issuerId, newIp, 1);

        vm.expectRevert(ErrorsLib.E088_InvalidIpUpdateSignature.selector);
        registry.updateIssuerIp(issuerId, newIp, wrongSig);
    }

    function test_updateIssuerIp_revertsIssuerNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotFound.selector, 999));
        registry.updateIssuerIp(999, bytes32(uint256(1)), new bytes(64));
    }

    function test_updateIssuerIp_revertsIssuerNotActive() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        _removeIssuerAndSnapshot(issuerId);

        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerNotActive.selector, issuerId));
        registry.updateIssuerIp(issuerId, bytes32(uint256(1)), new bytes(64));
    }

    function test_updateIssuerIp_reflectedInEndpoints() public {
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes32 newIp = bytes32(uint256(0xC0A80001));
        bytes memory sig = _signIpUpdate(0, newIp, 0);
        registry.updateIssuerIp(0, newIp, sig);

        (, bytes32[] memory ips,) = registry.getActiveIssuerEndpoints();
        assertEq(ips[0], newIp);
    }

    // ============ EDGE CASE TESTS ============

    function test_samePublicKey_differentIssuers_revertsOnDuplicate() public {
        // Key uniqueness: same pubkey cannot be registered by two different issuers
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Second registration with same pubkey should revert
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerRegistry__PubkeyAlreadyRegistered.selector, 0));
        vm.prank(admin);
        registry.addIssuer(issuer2Addr, IP_2, pubkey1, _signPoP(issuer2Addr, pubkey1, 0));
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
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Verify nonce incremented
        assertEq(registry.registryNonce(), 1);
    }

    function test_addIssuer_incrementsNonceCorrectly() public {
        assertEq(registry.registryNonce(), 0);

        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        assertEq(registry.registryNonce(), 1);

        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        assertEq(registry.registryNonce(), 2);

        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));
        assertEq(registry.registryNonce(), 3);
    }

    function test_removeIssuer_emitsRegistryStateChanged() public {
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
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
        bytes memory newPubkey = blsPubkey(20);

        // Request rotation
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getIssuer(rotatingId).addr, newPubkey, 20));

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            registry.approveRotation(rotatingId, issuerIds[i], sig);
        }

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
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        bytes32 hash1 = registry.getRegistryStateHash();
        assertEq(hash1, keccak256(abi.encodePacked(pubkey1)));

        // Add second issuer
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

        bytes32 hash2 = registry.getRegistryStateHash();
        assertEq(hash2, keccak256(abi.encodePacked(pubkey1, pubkey2)));

        // Add third issuer
        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));

        bytes32 hash3 = registry.getRegistryStateHash();
        assertEq(hash3, keccak256(abi.encodePacked(pubkey1, pubkey2, pubkey3)));
    }

    function test_registryNonce_returnsCorrectValueAfterMutations() public {
        assertEq(registry.registryNonce(), 0);

        // Add 3 issuers
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        assertEq(registry.registryNonce(), 1);

        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        assertEq(registry.registryNonce(), 2);

        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));
        assertEq(registry.registryNonce(), 3);

        // Remove one issuer
        vm.prank(admin);
        registry.removeIssuer(id1);
        assertEq(registry.registryNonce(), 4);
    }

    function test_stateHash_changesWhenIssuersAddedRemoved() public {
        bytes32 hash0 = registry.getRegistryStateHash();

        // Add first issuer - hash changes
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        bytes32 hash1 = registry.getRegistryStateHash();
        assertTrue(hash0 != hash1);

        // Add second issuer - hash changes again
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
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
        // Add 3 issuers
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));
        _addIssuerAndSnapshot(issuer3Addr, IP_3, pubkey3, _signPoP(issuer3Addr, pubkey3, 2));

        // Remove the first issuer
        vm.prank(admin);
        registry.removeIssuer(id1);

        // State hash should only include pubkey2 and pubkey3
        bytes32 stateHash = registry.getRegistryStateHash();
        assertEq(stateHash, keccak256(abi.encodePacked(pubkey2, pubkey3)));
    }

    function test_registryStateChanged_eventDataMatchesViewFunctions() public {
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

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
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

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
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

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

        bytes memory newPubkey = blsPubkey(20);

        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getIssuer(rotatingId).addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            registry.approveRotation(rotatingId, issuerIds[i], sig);
        }

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

    // ============ PROOF OF POSSESSION (PoP) AND KEY UNIQUENESS TESTS ============

    function test_addIssuer_revertsOnInvalidPoP() public {
        // Sign PoP with the WRONG key (seed 1 instead of seed 0)
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), issuer1Addr, pubkey1));
        bytes memory wrongPop = blsSign("1", popMsg);

        vm.expectRevert(IssuerRegistry.IssuerRegistry__InvalidPoP.selector);
        vm.prank(admin);
        registry.addIssuer(issuer1Addr, IP_1, pubkey1, wrongPop);
    }

    function test_addIssuer_revertsOnDuplicatePubkey() public {
        // Register issuer1 with pubkey1
        _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Try to register issuer2 with the same pubkey1 -- should revert
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerRegistry__PubkeyAlreadyRegistered.selector, 0));
        vm.prank(admin);
        registry.addIssuer(issuer2Addr, IP_2, pubkey1, _signPoP(issuer2Addr, pubkey1, 0));
    }

    function test_removeIssuer_clearsPubkeyUniqueness() public {
        // Register and remove issuer1 with pubkey1
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        _removeIssuerAndSnapshot(id1);

        // Now issuer2 can register with the same pubkey1 (uniqueness was cleared on removal)
        vm.prank(admin);
        uint256 id2 = registry.addIssuer(issuer2Addr, IP_2, pubkey1, _signPoP(issuer2Addr, pubkey1, 0));

        TypesLib.Issuer memory issuer2 = registry.getIssuer(id2);
        assertEq(issuer2.blsPubkey, pubkey1);
        assertEq(issuer2.status, 1);
    }

    function test_executeRotation_clearsPubkeyUniqueness() public {
        // Set up 20 issuers, rotate issuer 0 from seed-0 key to seed-20 key
        (uint256[] memory issuerIds, bytes[] memory pubkeys_) = _setupIssuersForRotation();
        uint256 rotatingId = issuerIds[0];
        bytes memory oldPubkey = pubkeys_[0];

        bytes memory newPubkey = blsPubkey(20);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getIssuer(rotatingId).addr, newPubkey, 20));

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            registry.approveRotation(rotatingId, issuerIds[i], sig);
        }

        vm.warp(block.timestamp + 25 hours);
        registry.executeRotation(rotatingId);

        // Snapshot after rotation to allow further mutations
        {
            uint256 nonce = registry.registryNonce();
            bytes memory aggPk = registry.getAggregatedPubkey();
            vm.prank(admin);
            registry.setAggregatedPubkey(aggPk, nonce);
        }

        // Old pubkey (seed 0) is now free. A new issuer should be able to register with it.
        address newIssuerAddr = makeAddr("newIssuerForOldKey");
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), newIssuerAddr, oldPubkey));
        bytes memory popSig = blsSign("0", popMsg);

        vm.prank(admin);
        uint256 newId = registry.addIssuer(newIssuerAddr, bytes32(uint256(999)), oldPubkey, popSig);

        TypesLib.Issuer memory newIssuer = registry.getIssuer(newId);
        assertEq(newIssuer.blsPubkey, oldPubkey);
    }

    function test_requestKeyRotation_revertsOnDuplicateNewPubkey() public {
        // Register issuer1 with pubkey1 and issuer2 with pubkey2
        uint256 id1 = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));
        _addIssuerAndSnapshot(issuer2Addr, IP_2, pubkey2, _signPoP(issuer2Addr, pubkey2, 1));

        // Try to rotate issuer1 to pubkey2 (already used by issuer2)
        bytes memory sig = _signRotationRequest(id1, pubkey2, 0);
        vm.expectRevert(abi.encodeWithSelector(IssuerRegistry.IssuerRegistry__PubkeyAlreadyRegistered.selector, 1));
        registry.requestKeyRotation(id1, pubkey2, sig, new bytes(64));
    }

    function test_requestKeyRotation_revertsOnInvalidNewKeyPoP() public {
        // Register issuer1
        uint256 issuerId = _addIssuerAndSnapshot(issuer1Addr, IP_1, pubkey1, _signPoP(issuer1Addr, pubkey1, 0));

        // Request rotation with valid old-key sig but WRONG PoP for new key
        // Sign PoP with seed 0 (wrong) instead of seed 1 (the new key's seed)
        bytes memory oldKeySig = _signRotationRequest(issuerId, pubkey2, 0);
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), issuer1Addr, pubkey2));
        bytes memory wrongPop = blsSign("0", popMsg); // wrong: should be signed by seed 1

        vm.expectRevert(IssuerRegistry.IssuerRegistry__InvalidPoP.selector);
        registry.requestKeyRotation(issuerId, pubkey2, oldKeySig, wrongPop);
    }
}
