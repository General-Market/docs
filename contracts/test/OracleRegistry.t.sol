// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Test.sol";
import "./helpers/TestHelper.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";
import {IOracleRegistry} from "../src/interfaces/IOracleRegistry.sol";
import {Governance} from "../src/Governance.sol";
import {TypesLib} from "../src/libraries/TypesLib.sol";
import {BLSLib} from "../src/libraries/BLSLib.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title OracleRegistryTest - Comprehensive tests for OracleRegistry.sol (Story 2.12)
/// @notice Tests oracle management, aggregated key updates, and access control
contract OracleRegistryTest is TestHelper {
    OracleRegistry public implementation;
    OracleRegistry public registry;
    ERC1967Proxy public proxy;

    Governance public govImplementation;
    Governance public governance;
    ERC1967Proxy public govProxy;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public oracle1Addr = makeAddr("oracle1");
    address public oracle2Addr = makeAddr("oracle2");
    address public oracle3Addr = makeAddr("oracle3");

    bytes32 public constant IP_1 = bytes32(uint256(0x7f000001)); // 127.0.0.1
    bytes32 public constant IP_2 = bytes32(uint256(0x7f000002)); // 127.0.0.2
    bytes32 public constant IP_3 = bytes32(uint256(0x7f000003)); // 127.0.0.3

    // Real BLS pubkeys from deterministic seeds (generated via FFI in setUp)
    bytes public pubkey1;
    bytes public pubkey2;
    bytes public pubkey3;

    // Events for expectEmit
    event OracleAdded(uint256 indexed oracleId, address indexed addr, bytes blsPubkey);
    event OracleRemoved(uint256 indexed oracleId);

    function setUp() public {
        // Deploy Governance first
        govImplementation = new Governance();
        bytes memory govInitData = abi.encodeWithSelector(Governance.initialize.selector, admin);
        govProxy = new ERC1967Proxy(address(govImplementation), govInitData);
        governance = Governance(address(govProxy));

        // Deploy OracleRegistry
        implementation = new OracleRegistry();
        bytes memory initData = abi.encodeWithSelector(OracleRegistry.initialize.selector, address(governance));
        proxy = new ERC1967Proxy(address(implementation), initData);
        registry = OracleRegistry(address(proxy));

        // Generate REAL BLS G2 pubkeys from deterministic seeds via FFI
        pubkey1 = blsPubkey(0);
        pubkey2 = blsPubkey(1);
        pubkey3 = blsPubkey(2);

        // Set the aggregated pubkey from seeds 0,1,2
        // Nonce is 0 because no oracles have been added yet (no state changes)
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        vm.prank(admin);
        registry.setAggregatedPubkey(aggPubkey, 0);
    }

    // ============ BLS SIGNING HELPERS ============

    /// @notice Generate a Proof of Possession (PoP) signature for addOracle
    /// @param oracleAddr The oracle's address
    /// @param pubkey The BLS public key
    /// @param seedIndex The seed index of the key (for signing)
    function _signPoP(address oracleAddr, bytes memory pubkey, uint8 seedIndex) internal returns (bytes memory) {
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), oracleAddr, pubkey));
        return blsSign(vm.toString(uint256(seedIndex)), popMsg);
    }

    /// @notice Sign a requestKeyRotation message with the individual oracle's key
    function _signRotationRequest(uint256 oracleId, bytes memory newPubkey, uint8 seedIndex) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode("ROTATE", block.chainid, address(registry), oracleId, newPubkey));
        return blsSign(vm.toString(uint256(seedIndex)), message);
    }

    /// @notice Generate a Proof of Possession (PoP) for a new key during rotation
    /// @param oracleAddr The oracle's address
    /// @param newPubkey The new BLS public key
    /// @param newKeySeedIndex The seed index of the NEW key (for signing)
    function _signRotationPoP(address oracleAddr, bytes memory newPubkey, uint8 newKeySeedIndex) internal returns (bytes memory) {
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), oracleAddr, newPubkey));
        return blsSign(vm.toString(uint256(newKeySeedIndex)), popMsg);
    }

    /// @notice Sign an approveRotation message with the approving oracle's key
    function _signApproval(uint256 rotatingOracleId, bytes memory newPubkey, uint8 approverSeedIndex) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode("APPROVE_ROTATION", block.chainid, address(registry), rotatingOracleId, newPubkey));
        return blsSign(vm.toString(uint256(approverSeedIndex)), message);
    }

    /// @notice Sign an updateOracleIp message with the oracle's key
    function _signIpUpdate(uint256 oracleId, bytes32 newIp, uint8 seedIndex) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode("UPDATE_IP", block.chainid, address(registry), oracleId, newIp));
        return blsSign(vm.toString(uint256(seedIndex)), message);
    }

    // ============ SNAPSHOT HELPERS ============

    /// @notice Wrapper: addOracle + auto-snapshot to satisfy PendingSnapshot constraint
    function _addOracleAndSnapshot(
        address oracleAddr, bytes32 ip, bytes memory pubkey, bytes memory popSig
    ) internal returns (uint256 oracleId) {
        vm.prank(admin);
        oracleId = registry.addOracle(oracleAddr, ip, pubkey, popSig);
        uint256 nonce = registry.registryNonce();
        vm.prank(admin);
        registry.setAggregatedPubkey(pubkey, nonce);
    }

    /// @notice Wrapper: removeOracle + auto-snapshot
    function _removeOracleAndSnapshot(uint256 oracleId) internal {
        vm.prank(admin);
        registry.removeOracle(oracleId);
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

    function test_initialization_zeroActiveOracles() public view {
        assertEq(registry.activeOracleCount(), 0);
    }

    function test_initialization_revertsWithZeroAddress() public {
        OracleRegistry newImpl = new OracleRegistry();

        vm.expectRevert(OracleRegistry.ZeroAddress.selector);
        new ERC1967Proxy(
            address(newImpl),
            abi.encodeWithSelector(OracleRegistry.initialize.selector, address(0))
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

    // ============ ADD ORACLE TESTS ============

    function test_addOracle_createsOracleWithCorrectData() public {
        bytes memory pop1 = _signPoP(oracle1Addr, pubkey1, 0);
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracle1Addr, IP_1, pubkey1, pop1);

        assertEq(oracleId, 0);

        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);
        assertEq(oracle.addr, oracle1Addr);
        assertEq(oracle.ip, IP_1);
        assertEq(oracle.blsPubkey, pubkey1);
        assertEq(oracle.status, 1); // active
        assertEq(oracle.registeredAt, block.timestamp);
    }

    function test_addOracle_incrementsActiveCount() public {
        assertEq(registry.activeOracleCount(), 0);

        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        assertEq(registry.activeOracleCount(), 1);

        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        assertEq(registry.activeOracleCount(), 2);
    }

    function test_addOracle_assignsSequentialIds() public {
        bytes memory pop1 = _signPoP(oracle1Addr, pubkey1, 0);
        bytes memory pop2 = _signPoP(oracle2Addr, pubkey2, 1);
        bytes memory pop3 = _signPoP(oracle3Addr, pubkey3, 2);

        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, pop1);
        uint256 id2 = _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, pop2);
        uint256 id3 = _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, pop3);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
    }

    function test_addOracle_emitsOracleAdded() public {
        bytes memory pop1 = _signPoP(oracle1Addr, pubkey1, 0);

        vm.expectEmit(true, true, false, true);
        emit OracleAdded(0, oracle1Addr, pubkey1);

        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, pop1);
    }

    function test_addOracle_storesPubkeyCorrectly() public {
        // Aggregated pubkey is set in setUp
        bytes memory initialAgg = registry.getAggregatedPubkey();
        assertEq(initialAgg.length, 128);

        // Add first oracle
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Verify pubkey stored correctly on oracle struct
        TypesLib.Oracle memory oracle = registry.getOracle(0);
        assertEq(oracle.blsPubkey, pubkey1);

        // Add second oracle
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        // Verify second pubkey stored correctly
        TypesLib.Oracle memory oracle2 = registry.getOracle(1);
        assertEq(oracle2.blsPubkey, pubkey2);

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
    }

    function test_addOracle_revertsForNonAdmin() public {
        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, new bytes(64));
    }

    function test_addOracle_revertsForZeroAddress() public {
        vm.expectRevert(OracleRegistry.ZeroAddress.selector);
        vm.prank(admin);
        registry.addOracle(address(0), IP_1, pubkey1, new bytes(64));
    }

    function test_addOracle_revertsForInvalidPubkeyLength() public {
        bytes memory shortPubkey = new bytes(32);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.InvalidPubkeyLength.selector, 32));
        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, shortPubkey, new bytes(64));
    }

    function test_addOracle_storesValidPubkeyWithPoP() public {
        // With PoP verification, only real BLS pubkeys (with valid PoP) can be registered.
        // Use a real pubkey from seed 0 with valid PoP.
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Verify it was stored
        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);
        assertEq(oracle.blsPubkey, pubkey1);
    }

    // ============ REMOVE ORACLE TESTS ============

    function test_removeOracle_deactivatesOracle() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        vm.prank(admin);
        registry.removeOracle(oracleId);

        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);
        assertEq(oracle.status, 0); // inactive
    }

    function test_removeOracle_decrementsActiveCount() public {
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        assertEq(registry.activeOracleCount(), 2);

        vm.prank(admin);
        registry.removeOracle(id1);

        assertEq(registry.activeOracleCount(), 1);
    }

    function test_removeOracle_emitsOracleRemoved() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        vm.expectEmit(true, false, false, false);
        emit OracleRemoved(oracleId);

        vm.prank(admin);
        registry.removeOracle(oracleId);
    }

    function test_removeOracle_deactivatesButKeepsPubkey() public {
        // Add two oracles
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        // Remove first oracle
        vm.prank(admin);
        registry.removeOracle(id1);

        // Pubkey is still stored (just inactive)
        TypesLib.Oracle memory oracle = registry.getOracle(id1);
        assertEq(oracle.blsPubkey, pubkey1);
        assertEq(oracle.status, 0); // inactive

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
    }

    function test_removeOracle_addAndRemoveRestoresZero() public {
        // Add oracle
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Remove oracle
        vm.prank(admin);
        registry.removeOracle(oracleId);

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        bytes memory agg = registry.getAggregatedPubkey();
        assertEq(agg.length, 128);

        // Verify oracle is inactive
        assertEq(registry.activeOracleCount(), 0);
    }

    function test_removeOracle_revertsForNonAdmin() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.removeOracle(oracleId);
    }

    function test_removeOracle_revertsForNonExistentOracle() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotFound.selector, 999));
        vm.prank(admin);
        registry.removeOracle(999);
    }

    function test_removeOracle_revertsForAlreadyInactiveOracle() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        _removeOracleAndSnapshot(oracleId);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotActive.selector, oracleId));
        vm.prank(admin);
        registry.removeOracle(oracleId);
    }

    // ============ VIEW FUNCTIONS TESTS ============

    function test_getOracle_returnsCorrectData() public {
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);

        assertEq(oracle.addr, oracle1Addr);
        assertEq(oracle.ip, IP_1);
        assertEq(oracle.blsPubkey, pubkey1);
        assertEq(oracle.status, 1);
    }

    function test_getOracle_returnsEmptyForNonExistent() public view {
        TypesLib.Oracle memory oracle = registry.getOracle(999);
        assertEq(oracle.addr, address(0));
        assertEq(oracle.ip, bytes32(0));
        assertEq(oracle.blsPubkey.length, 0);
        assertEq(oracle.status, 0);
    }

    function test_getOracles_returnsAllOracles() public {
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));

        TypesLib.Oracle[] memory oracles = registry.getOracles();

        assertEq(oracles.length, 3);
        assertEq(oracles[0].addr, oracle1Addr);
        assertEq(oracles[1].addr, oracle2Addr);
        assertEq(oracles[2].addr, oracle3Addr);
    }

    function test_getOracles_includesInactiveOracles() public {
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        _removeOracleAndSnapshot(id1);

        TypesLib.Oracle[] memory oracles = registry.getOracles();

        assertEq(oracles.length, 2);
        assertEq(oracles[0].status, 0); // inactive
        assertEq(oracles[1].status, 1); // active
    }

    function test_activeOracleCount_accurate() public {
        assertEq(registry.activeOracleCount(), 0);

        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        assertEq(registry.activeOracleCount(), 1);

        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        assertEq(registry.activeOracleCount(), 2);

        vm.prank(admin);
        registry.removeOracle(id1);
        assertEq(registry.activeOracleCount(), 1);
    }

    // ============ AGGREGATED PUBKEY MATH TESTS ============

    function test_aggregatedPubkey_offChainComputation() public {
        // G2 aggregation is computed off-chain; aggregated pubkey is set in setUp and not auto-updated

        // Add all three oracles
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        uint256 id2 = _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
        assertEq(registry.activeOracleCount(), 3);

        // Remove oracle 1
        _removeOracleAndSnapshot(id1);

        // Not auto-updated (off-chain aggregation)
        assertEq(registry.getAggregatedPubkey().length, 128);
        assertEq(registry.activeOracleCount(), 2);

        // Remove oracle 2
        _removeOracleAndSnapshot(id2);

        // Not auto-updated
        assertEq(registry.getAggregatedPubkey().length, 128);
        assertEq(registry.activeOracleCount(), 1);

        // Individual pubkeys are preserved on oracle structs
        TypesLib.Oracle memory oracle3 = registry.getOracle(2);
        assertEq(oracle3.blsPubkey, pubkey3);
        assertEq(oracle3.status, 1); // active
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
        OracleRegistry newImpl = new OracleRegistry();

        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.upgradeToAndCall(address(newImpl), "");

        vm.prank(admin);
        registry.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgrade_preservesState() public {
        // Add oracles
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        // Upgrade
        OracleRegistry newImpl = new OracleRegistry();
        vm.prank(admin);
        registry.upgradeToAndCall(address(newImpl), "");

        // State should be preserved
        assertEq(registry.activeOracleCount(), 2);

        TypesLib.Oracle memory oracle1 = registry.getOracle(0);
        assertEq(oracle1.addr, oracle1Addr);
        assertEq(oracle1.blsPubkey, pubkey1);

        TypesLib.Oracle memory oracle2 = registry.getOracle(1);
        assertEq(oracle2.addr, oracle2Addr);
        assertEq(oracle2.blsPubkey, pubkey2);
    }

    // ============ ACCESS CONTROL COMPREHENSIVE TESTS ============

    function test_viewFunctions_accessibleByAnyone() public view {
        registry.getOracle(0);
        registry.getAggregatedPubkey();
        registry.getOracles();
        registry.activeOracleCount();
        registry.getPendingRotation(0);
        registry.canExecuteRotation(0);
        registry.governance();
    }

    // ============ FUZZ TESTS ============

    function testFuzz_addOracle_anyValidAddress(address oracleAddr) public {
        vm.assume(oracleAddr != address(0));

        bytes memory pop = _signPoP(oracleAddr, pubkey1, 0);
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracleAddr, IP_1, pubkey1, pop);

        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);
        assertEq(oracle.addr, oracleAddr);
        assertEq(oracle.status, 1);
    }

    function testFuzz_addOracle_anyIP(bytes32 ip) public {
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracle1Addr, ip, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);
        assertEq(oracle.ip, ip);
    }

    // ============ BLS VERIFICATION STUB TESTS ============

    function test_removeOracleByVote_revertsWithInvalidBLSSignature() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes memory fakeSignature = new bytes(128);
        uint256 refNonce = registry.lastSnapshotNonce();

        vm.expectRevert(OracleRegistry.InvalidBLSSignature.selector);
        registry.removeOracleByVote(oracleId, fakeSignature, refNonce, SIGNERS_BITMASK);
    }

    // ============ KEY ROTATION TESTS (Story 2.13) ============

    // Key rotation events
    event KeyRotationRequested(uint256 indexed oracleId, bytes newPubkey);
    event KeyRotationApproved(uint256 indexed rotatingOracleId, uint256 indexed approvingOracleId, uint256 approvalCount);
    event KeyRotationExecuted(uint256 indexed oracleId, bytes oldPubkey, bytes newPubkey);
    event RotationWindowForced(uint256 indexed oracleId);
    event KeyRotationCancelled(uint256 indexed oracleId);

    /// @notice Helper to set up 20 oracles for rotation tests
    /// @dev Uses real BLS pubkeys from deterministic seeds via FFI
    function _setupOraclesForRotation() internal returns (uint256[] memory oracleIds, bytes[] memory pubkeys) {
        oracleIds = new uint256[](20);
        pubkeys = new bytes[](20);

        for (uint256 i = 0; i < 20; i++) {
            (oracleIds[i], pubkeys[i]) = _registerSingleOracleAndSnapshot(i);
        }

        return (oracleIds, pubkeys);
    }

    /// @dev Inner helper to reduce stack depth in _setupOraclesForRotation loop
    function _registerSingleOracleAndSnapshot(uint256 i) internal returns (uint256 id, bytes memory pk) {
        pk = blsPubkey(uint8(i));
        address oracleAddr = makeAddr(string(abi.encodePacked("oracle", i)));
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), oracleAddr, pk));
        bytes memory popSig = blsSign(vm.toString(i), popMsg);
        id = _addOracleAndSnapshot(oracleAddr, bytes32(i), pk, popSig);
    }

    // ============ requestKeyRotation Tests ============

    function test_requestKeyRotation_success() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes memory sig = _signRotationRequest(oracleId, pubkey2, 0);
        bytes memory newKeyPop = _signRotationPoP(oracle1Addr, pubkey2, 1);

        vm.expectEmit(true, false, false, true);
        emit KeyRotationRequested(oracleId, pubkey2);

        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, pubkey2, sig, newKeyPop);

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleId);
        assertEq(rotation.oracleId, oracleId);
        assertEq(rotation.newPubkey, pubkey2);
        assertEq(rotation.requestedAt, block.timestamp);
        assertEq(rotation.approvalCount, 0);
        assertFalse(rotation.executed);
    }

    function test_requestKeyRotation_revertsUnauthorizedCaller() public {
        // requestKeyRotation now requires msg.sender == oracle.addr (ECDSA).
        // Non-oracle callers are rejected with Unauthorized().
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes memory sig = _signRotationRequest(oracleId, pubkey2, 0);
        bytes memory newKeyPop = _signRotationPoP(oracle1Addr, pubkey2, 1);

        // Non-oracle call reverts with Unauthorized
        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.requestKeyRotation(oracleId, pubkey2, sig, newKeyPop);
    }

    function test_requestKeyRotation_revertsOracleNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotFound.selector, 999));
        registry.requestKeyRotation(999, pubkey2, new bytes(64), new bytes(64));
    }

    function test_requestKeyRotation_revertsOracleNotActive() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        _removeOracleAndSnapshot(oracleId);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotActive.selector, oracleId));
        registry.requestKeyRotation(oracleId, pubkey2, new bytes(64), new bytes(64));
    }

    function test_requestKeyRotation_revertsInvalidPubkeyLength() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes memory shortPubkey = new bytes(32);
        // BLS check happens before pubkey length check, so sign correctly
        bytes memory sig = _signRotationRequest(oracleId, shortPubkey, 0);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.InvalidPubkeyLength.selector, 32));
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, shortPubkey, sig, new bytes(64));
    }

    function test_requestKeyRotation_revertsInvalidPubkey() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // 64-byte pubkey is invalid length (must be 128 for G2)
        bytes memory invalidPubkey = abi.encodePacked(uint256(12345), uint256(67890));
        bytes memory sig = _signRotationRequest(oracleId, invalidPubkey, 0);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.InvalidPubkeyLength.selector, 64));
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, invalidPubkey, sig, new bytes(64));
    }

    function test_requestKeyRotation_revertsRotationAlreadyPending() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, pubkey2, _signRotationRequest(oracleId, pubkey2, 0), _signRotationPoP(oracle1Addr, pubkey2, 1));

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.RotationAlreadyPending.selector, oracleId));
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, pubkey3, _signRotationRequest(oracleId, pubkey3, 0), _signRotationPoP(oracle1Addr, pubkey3, 2));
    }

    // ============ approveRotation Tests ============

    function test_approveRotation_success() public {
        (uint256[] memory oracleIds, bytes[] memory pubkeys) = _setupOraclesForRotation();
        uint256 rotatingId = oracleIds[0];
        uint256 approvingId = oracleIds[1];
        address oracle0Addr = makeAddr(string(abi.encodePacked("oracle", uint256(0))));

        // Request rotation to a fresh key (seed 20, not registered)
        bytes memory newPubkey = blsPubkey(20);
        vm.prank(oracle0Addr);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(oracle0Addr, newPubkey, 20));

        // Get the new pubkey for the approval message
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, 1);

        vm.expectEmit(true, true, false, true);
        emit KeyRotationApproved(rotatingId, approvingId, 1);

        vm.prank(registry.getOracle(approvingId).addr);
        registry.approveRotation(rotatingId, approvingId, sig);

        TypesLib.KeyRotation memory rotationAfter = registry.getPendingRotation(rotatingId);
        assertEq(rotationAfter.approvalCount, 1);
    }

    function test_approveRotation_revertsUnauthorizedCaller() public {
        // approveRotation now requires msg.sender == approver.addr (ECDSA).
        // Non-approver callers are rejected with Unauthorized().
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();
        address oracle0Addr = makeAddr(string(abi.encodePacked("oracle", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        vm.prank(oracle0Addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(oracle0Addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, 1);

        // Non-approver call reverts with Unauthorized
        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.approveRotation(oracleIds[0], oracleIds[1], sig);
    }

    function test_approveRotation_revertsNoRotationPending() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.NoRotationPending.selector, oracleIds[0]));
        registry.approveRotation(oracleIds[0], oracleIds[1], new bytes(64));
    }

    function test_approveRotation_revertsSelfApproval() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();
        address oracle0Addr = makeAddr(string(abi.encodePacked("oracle", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        vm.prank(oracle0Addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(oracle0Addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, 0);

        vm.expectRevert(OracleRegistry.SelfApprovalNotAllowed.selector);
        vm.prank(oracle0Addr);
        registry.approveRotation(oracleIds[0], oracleIds[0], sig);
    }

    function test_approveRotation_revertsDoubleApproval() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();
        address oracle0Addr = makeAddr(string(abi.encodePacked("oracle", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        vm.prank(oracle0Addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(oracle0Addr, newPubkey, 20));

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        bytes memory sig1 = _signApproval(oracleIds[0], rotation.newPubkey, 1);
        bytes memory sig2 = _signApproval(oracleIds[0], rotation.newPubkey, 1);

        address approver1Addr = registry.getOracle(oracleIds[1]).addr;
        vm.prank(approver1Addr);
        registry.approveRotation(oracleIds[0], oracleIds[1], sig1);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.AlreadyApproved.selector, oracleIds[1]));
        vm.prank(approver1Addr);
        registry.approveRotation(oracleIds[0], oracleIds[1], sig2);
    }

    function test_approveRotation_revertsApprovingOracleNotFound() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();
        address oracle0Addr = makeAddr(string(abi.encodePacked("oracle", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        vm.prank(oracle0Addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(oracle0Addr, newPubkey, 20));

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotFound.selector, 999));
        registry.approveRotation(oracleIds[0], 999, new bytes(64));
    }

    function test_approveRotation_revertsApprovingOracleNotActive() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();
        address oracle0Addr = makeAddr(string(abi.encodePacked("oracle", uint256(0))));

        bytes memory newPubkey = blsPubkey(20);
        vm.prank(oracle0Addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(oracle0Addr, newPubkey, 20));

        // Remove approving oracle
        vm.prank(admin);
        registry.removeOracle(oracleIds[1]);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotActive.selector, oracleIds[1]));
        registry.approveRotation(oracleIds[0], oracleIds[1], new bytes(64));
    }

    // ============ executeRotation Tests ============

    function test_executeRotation_fullFlow() public {
        (uint256[] memory oracleIds, bytes[] memory pubkeys) = _setupOraclesForRotation();
        uint256 rotatingId = oracleIds[0];
        bytes memory oldPubkey = pubkeys[0];

        // Generate new real 128-byte G2 pubkey from seed 20 (not used by any oracle)
        bytes memory newPubkey = blsPubkey(20);

        // Request rotation (seed 0 signs)
        vm.startPrank(registry.getOracle(rotatingId).addr);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getOracle(rotatingId).addr, newPubkey, 20));
        vm.stopPrank();

        // Get 10 approvals from other oracles
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(rotatingId, oracleIds[i], sig);
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

        // Verify oracle pubkey updated
        TypesLib.Oracle memory oracle = registry.getOracle(rotatingId);
        assertEq(oracle.blsPubkey, newPubkey);

        // Aggregated pubkey is set in setUp (computed off-chain, not auto-updated)
        assertEq(registry.getAggregatedPubkey().length, 128);
    }

    function test_executeRotation_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.NoRotationPending.selector, 0));
        registry.executeRotation(0);
    }

    function test_executeRotation_revertsInsufficientApprovals() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        // Only get 9 approvals (need 10)
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 9; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        vm.warp(block.timestamp + 25 hours);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.InsufficientApprovals.selector, 9, 10));
        registry.executeRotation(oracleIds[0]);
    }

    function test_executeRotation_revertsTimelockNotExpired() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        // Only wait 23 hours (need 24)
        vm.warp(block.timestamp + 23 hours);

        vm.expectRevert(); // TimelockNotExpired
        registry.executeRotation(oracleIds[0]);
    }

    function test_executeRotation_revertsSafePeriodNotElapsed() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        // Fast forward 24h - timelock satisfied, but we'll test safe period by adding late approval
        vm.warp(block.timestamp + 24 hours);

        // Add one more approval (11th) now - this resets the safe period timer
        bytes memory lateSig = _signApproval(oracleIds[0], rotation.newPubkey, 11);
        vm.prank(registry.getOracle(oracleIds[11]).addr);
        registry.approveRotation(oracleIds[0], oracleIds[11], lateSig);

        // Try to execute immediately - safe period (1h) hasn't passed since the late approval
        vm.expectRevert(); // SafePeriodNotElapsed
        registry.executeRotation(oracleIds[0]);

        // Wait 30 more minutes - still not enough
        vm.warp(block.timestamp + 30 minutes);
        vm.expectRevert();
        registry.executeRotation(oracleIds[0]);

        // Wait another 31 minutes - now safe period is satisfied
        vm.warp(block.timestamp + 31 minutes);
        registry.executeRotation(oracleIds[0]); // Should succeed
    }

    function test_executeRotation_revertsAlreadyExecuted() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        vm.warp(block.timestamp + 25 hours);

        registry.executeRotation(oracleIds[0]);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.RotationAlreadyExecuted.selector, oracleIds[0]));
        registry.executeRotation(oracleIds[0]);
    }

    // ============ forceRotationWindow Tests ============

    function test_forceRotationWindow_success() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        // Wait 49 hours (past 48h admin force window)
        vm.warp(block.timestamp + 49 hours);

        vm.expectEmit(true, false, false, false);
        emit RotationWindowForced(oracleIds[0]);

        vm.prank(admin);
        registry.forceRotationWindow(oracleIds[0]);

        // Now execution should succeed even without safe period
        registry.executeRotation(oracleIds[0]);
    }

    function test_forceRotationWindow_revertsNonAdmin() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        vm.warp(block.timestamp + 49 hours);

        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.forceRotationWindow(oracleIds[0]);
    }

    function test_forceRotationWindow_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.NoRotationPending.selector, 0));
        vm.prank(admin);
        registry.forceRotationWindow(0);
    }

    function test_forceRotationWindow_revertsForceWindowNotElapsed() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        // Only wait 47 hours (need 48)
        vm.warp(block.timestamp + 47 hours);

        vm.expectRevert(); // ForceWindowNotElapsed
        vm.prank(admin);
        registry.forceRotationWindow(oracleIds[0]);
    }

    // ============ cancelRotation Tests ============

    function test_cancelRotation_success() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        vm.expectEmit(true, false, false, false);
        emit KeyRotationCancelled(oracleIds[0]);

        vm.prank(admin);
        registry.cancelRotation(oracleIds[0]);

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        assertEq(rotation.requestedAt, 0);
    }

    function test_cancelRotation_revertsNonAdmin() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.cancelRotation(oracleIds[0]);
    }

    function test_cancelRotation_revertsNoRotationPending() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.NoRotationPending.selector, 0));
        vm.prank(admin);
        registry.cancelRotation(0);
    }

    function test_cancelRotation_allowsNewRotationAfterCancel() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey1 = blsPubkey(20);
        bytes memory newPubkey2 = blsPubkey(21);

        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey1, _signRotationRequest(oracleIds[0], newPubkey1, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey1, 20));
        vm.stopPrank();
        vm.prank(admin);
        registry.cancelRotation(oracleIds[0]);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey2, _signRotationRequest(oracleIds[0], newPubkey2, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey2, 21));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        assertEq(rotation.newPubkey, newPubkey2);
    }

    function test_cancelRotation_approvalsDoNotCarryOver() public {
        // This test verifies the fix for the approval carryover security bug
        // Old approvals should NOT count towards a new rotation after cancel
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey1 = blsPubkey(20);
        bytes memory newPubkey2 = blsPubkey(21);

        // Request first rotation and get 5 approvals
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey1, _signRotationRequest(oracleIds[0], newPubkey1, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey1, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation1 = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 5; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation1.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        TypesLib.KeyRotation memory rotation1After = registry.getPendingRotation(oracleIds[0]);
        assertEq(rotation1After.approvalCount, 5);

        // Cancel rotation
        vm.prank(admin);
        registry.cancelRotation(oracleIds[0]);

        // Request NEW rotation (with different pubkey)
        // Advance time to ensure new requestedAt is different
        vm.warp(block.timestamp + 1);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey2, _signRotationRequest(oracleIds[0], newPubkey2, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey2, 21));
        vm.stopPrank();

        // New rotation should start with 0 approvals (old approvals don't carry over)
        TypesLib.KeyRotation memory rotation2 = registry.getPendingRotation(oracleIds[0]);
        assertEq(rotation2.approvalCount, 0, "Old approvals should not carry over after cancel");

        // Previous approvers should be able to approve again
        for (uint256 i = 1; i <= 5; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation2.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        TypesLib.KeyRotation memory rotation3 = registry.getPendingRotation(oracleIds[0]);
        assertEq(rotation3.approvalCount, 5, "Previous approvers should be able to approve new rotation");
    }

    function test_requestKeyRotation_revertsSamePubkey() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Try to rotate to the same pubkey
        bytes memory sig = _signRotationRequest(oracleId, pubkey1, 0);
        vm.expectRevert(OracleRegistry.SamePubkey.selector);
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, pubkey1, sig, new bytes(64));
    }

    // ============ Grace Period Tests ============

    function test_isKeyInGracePeriod_falseWhenNeverRotated() public view {
        assertFalse(registry.isKeyInGracePeriod(pubkey1));
    }

    function test_isKeyInGracePeriod_trueAfterRotation() public {
        (uint256[] memory oracleIds, bytes[] memory pubkeys) = _setupOraclesForRotation();
        bytes memory oldPubkey = pubkeys[0];

        // Set current cycle
        vm.prank(admin);
        registry.updateCurrentCycle(100);

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        vm.warp(block.timestamp + 25 hours);
        registry.executeRotation(oracleIds[0]);

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
        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.updateCurrentCycle(42);
    }

    // ============ canExecuteRotation Tests ============

    function test_canExecuteRotation_returnsFalseWhenNoPending() public view {
        assertFalse(registry.canExecuteRotation(0));
        assertFalse(registry.canExecuteRotation(999));
    }

    function test_canExecuteRotation_returnsFalseWhenInsufficientApprovals() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        assertFalse(registry.canExecuteRotation(oracleIds[0]));
    }

    function test_canExecuteRotation_returnsFalseWhenTimelockNotPassed() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        // Not enough time passed
        assertFalse(registry.canExecuteRotation(oracleIds[0]));
    }

    function test_canExecuteRotation_returnsTrueWhenAllConditionsMet() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(oracleIds[0], rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(oracleIds[0], oracleIds[i], sig);
        }

        // Wait for timelock (24h) + safe period (1h)
        vm.warp(block.timestamp + 25 hours);

        assertTrue(registry.canExecuteRotation(oracleIds[0]));
    }

    function test_getPendingRotation_returnsCorrectData() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        assertEq(rotation.oracleId, oracleIds[0]);
        assertEq(rotation.newPubkey, newPubkey);
        assertEq(rotation.approvalCount, 0);
        assertFalse(rotation.executed);
    }

    // ============ EDGE CASE TESTS ============

    function test_multipleOracles_sameAddress() public {
        // Same address can be registered multiple times (different IDs)
        bytes memory pop1 = _signPoP(oracle1Addr, pubkey1, 0);
        bytes memory pop2 = _signPoP(oracle1Addr, pubkey2, 1);

        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, pop1);
        uint256 id2 = _addOracleAndSnapshot(oracle1Addr, IP_2, pubkey2, pop2);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(registry.activeOracleCount(), 2);
    }

    // ============ BLS VERIFICATION TESTS (Story 7.17) ============

    function test_requestKeyRotation_revertsWithInvalidSignature() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Sign with a WRONG seed index (seed 1 instead of seed 0 which owns the key)
        bytes32 message = keccak256(abi.encode("ROTATE", block.chainid, address(registry), oracleId, pubkey2));
        bytes memory wrongSig = blsSign("1", message);

        vm.expectRevert(ErrorsLib.E086_InvalidRotationSignature.selector);
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, pubkey2, wrongSig, new bytes(64));
    }

    function test_requestKeyRotation_revertsUnauthorizedBeforeBLSCheck() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Non-oracle calling reverts with Unauthorized before BLS check is reached
        bytes32 message = keccak256(abi.encode("ROTATE", block.chainid, address(registry), oracleId, pubkey2));
        bytes memory wrongSig = blsSign("1", message); // signed by wrong key
        vm.expectRevert(OracleRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.requestKeyRotation(oracleId, pubkey2, wrongSig, new bytes(64));
    }

    function test_approveRotation_revertsWithInvalidSignature() public {
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();

        // Request rotation (with valid BLS from seed 0)
        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(oracleIds[0]).addr);
        registry.requestKeyRotation(oracleIds[0], newPubkey, _signRotationRequest(oracleIds[0], newPubkey, 0), _signRotationPoP(registry.getOracle(oracleIds[0]).addr, newPubkey, 20));
        vm.stopPrank();

        // Sign approval with WRONG seed index (seed 2 instead of seed 1)
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(oracleIds[0]);
        bytes32 message = keccak256(abi.encode("APPROVE_ROTATION", block.chainid, address(registry), oracleIds[0], rotation.newPubkey));
        bytes memory wrongSig = blsSign("2", message); // signed by seed 2, not seed 1

        address approver1Addr = registry.getOracle(oracleIds[1]).addr;
        vm.expectRevert(ErrorsLib.E087_InvalidApprovalSignature.selector);
        vm.prank(approver1Addr);
        registry.approveRotation(oracleIds[0], oracleIds[1], wrongSig);
    }

    // ============ PEER DISCOVERY TESTS (Story 7.17) ============

    function test_getActiveOracleEndpoints_returnsActiveOracles() public {
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));

        (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys_) = registry.getActiveOracleEndpoints();

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

    function test_getActiveOracleEndpoints_excludesInactive() public {
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        _removeOracleAndSnapshot(id1);

        (uint256[] memory ids, bytes32[] memory ips,) = registry.getActiveOracleEndpoints();

        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
        assertEq(ips[0], IP_2);
    }

    function test_getActiveOracleEndpoints_emptyWhenNoOracles() public view {
        (uint256[] memory ids, bytes32[] memory ips, bytes[] memory pubkeys_) = registry.getActiveOracleEndpoints();
        assertEq(ids.length, 0);
        assertEq(ips.length, 0);
        assertEq(pubkeys_.length, 0);
    }

    function test_updateOracleIp_success() public {
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes32 newIp = bytes32(uint256(0xC0A80001)); // 192.168.0.1

        // Sign with seed 0 (the oracle's key)
        bytes memory sig = _signIpUpdate(oracleId, newIp, 0);
        registry.updateOracleIp(oracleId, newIp, sig);

        TypesLib.Oracle memory oracle = registry.getOracle(oracleId);
        assertEq(oracle.ip, newIp);
    }

    function test_updateOracleIp_revertsWithInvalidSig() public {
        vm.prank(admin);
        uint256 oracleId = registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Sign with WRONG seed (seed 1 instead of seed 0)
        bytes32 newIp = bytes32(uint256(1));
        bytes memory wrongSig = _signIpUpdate(oracleId, newIp, 1);

        vm.expectRevert(ErrorsLib.E088_InvalidIpUpdateSignature.selector);
        registry.updateOracleIp(oracleId, newIp, wrongSig);
    }

    function test_updateOracleIp_revertsOracleNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotFound.selector, 999));
        registry.updateOracleIp(999, bytes32(uint256(1)), new bytes(64));
    }

    function test_updateOracleIp_revertsOracleNotActive() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        _removeOracleAndSnapshot(oracleId);

        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleNotActive.selector, oracleId));
        registry.updateOracleIp(oracleId, bytes32(uint256(1)), new bytes(64));
    }

    function test_updateOracleIp_reflectedInEndpoints() public {
        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes32 newIp = bytes32(uint256(0xC0A80001));
        bytes memory sig = _signIpUpdate(0, newIp, 0);
        registry.updateOracleIp(0, newIp, sig);

        (, bytes32[] memory ips,) = registry.getActiveOracleEndpoints();
        assertEq(ips[0], newIp);
    }

    // ============ EDGE CASE TESTS ============

    function test_samePublicKey_differentOracles_revertsOnDuplicate() public {
        // Key uniqueness: same pubkey cannot be registered by two different oracles
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Second registration with same pubkey should revert
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleRegistry__PubkeyAlreadyRegistered.selector, 0));
        vm.prank(admin);
        registry.addOracle(oracle2Addr, IP_2, pubkey1, _signPoP(oracle2Addr, pubkey1, 0));
    }

    // ============ REGISTRY STATE CHANGE TESTS (Story 8.1) ============

    // Event for expectEmit
    event RegistryStateChanged(uint256 indexed nonce, uint256 activeCount, bytes32 stateHash);

    function test_addOracle_emitsRegistryStateChanged() public {
        // Initial nonce should be 0
        assertEq(registry.registryNonce(), 0);

        // Compute expected state hash (will include pubkey1)
        bytes32 expectedHash = keccak256(abi.encodePacked(pubkey1));

        vm.expectEmit(true, false, false, true);
        emit RegistryStateChanged(1, 1, expectedHash);

        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Verify nonce incremented
        assertEq(registry.registryNonce(), 1);
    }

    function test_addOracle_incrementsNonceCorrectly() public {
        assertEq(registry.registryNonce(), 0);

        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        assertEq(registry.registryNonce(), 1);

        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        assertEq(registry.registryNonce(), 2);

        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));
        assertEq(registry.registryNonce(), 3);
    }

    function test_removeOracle_emitsRegistryStateChanged() public {
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        assertEq(registry.registryNonce(), 1);

        // After removal, state hash should be empty (keccak256 of empty bytes)
        bytes32 expectedHash = keccak256("");

        vm.expectEmit(true, false, false, true);
        emit RegistryStateChanged(2, 0, expectedHash);

        vm.prank(admin);
        registry.removeOracle(oracleId);

        assertEq(registry.registryNonce(), 2);
    }

    function test_executeRotation_emitsRegistryStateChanged() public {
        (uint256[] memory oracleIds, bytes[] memory pubkeys_) = _setupOraclesForRotation();
        uint256 rotatingId = oracleIds[0];

        uint256 nonceAfterSetup = registry.registryNonce();
        assertEq(nonceAfterSetup, 20); // 20 oracles added

        // New pubkey for rotation
        bytes memory newPubkey = blsPubkey(20);

        // Request rotation
        vm.startPrank(registry.getOracle(rotatingId).addr);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getOracle(rotatingId).addr, newPubkey, 20));
        vm.stopPrank();

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(rotatingId, oracleIds[i], sig);
        }

        // Wait for timelock + safe period
        vm.warp(block.timestamp + 25 hours);

        // Compute expected state hash (new pubkey + remaining 19 oracles)
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

    function test_getRegistryStateHash_correctForKnownOracles() public {
        // Empty registry
        bytes32 emptyHash = registry.getRegistryStateHash();
        assertEq(emptyHash, keccak256(""));

        // Add first oracle
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        bytes32 hash1 = registry.getRegistryStateHash();
        assertEq(hash1, keccak256(abi.encodePacked(pubkey1)));

        // Add second oracle
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        bytes32 hash2 = registry.getRegistryStateHash();
        assertEq(hash2, keccak256(abi.encodePacked(pubkey1, pubkey2)));

        // Add third oracle
        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));

        bytes32 hash3 = registry.getRegistryStateHash();
        assertEq(hash3, keccak256(abi.encodePacked(pubkey1, pubkey2, pubkey3)));
    }

    function test_registryNonce_returnsCorrectValueAfterMutations() public {
        assertEq(registry.registryNonce(), 0);

        // Add 3 oracles
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        assertEq(registry.registryNonce(), 1);

        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        assertEq(registry.registryNonce(), 2);

        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));
        assertEq(registry.registryNonce(), 3);

        // Remove one oracle
        vm.prank(admin);
        registry.removeOracle(id1);
        assertEq(registry.registryNonce(), 4);
    }

    function test_stateHash_changesWhenOraclesAddedRemoved() public {
        bytes32 hash0 = registry.getRegistryStateHash();

        // Add first oracle - hash changes
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        bytes32 hash1 = registry.getRegistryStateHash();
        assertTrue(hash0 != hash1);

        // Add second oracle - hash changes again
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        bytes32 hash2 = registry.getRegistryStateHash();
        assertTrue(hash1 != hash2);

        // Remove first oracle - hash changes
        vm.prank(admin);
        registry.removeOracle(id1);
        bytes32 hash3 = registry.getRegistryStateHash();
        assertTrue(hash2 != hash3);

        // hash3 should equal just pubkey2 since oracle1 was removed
        assertEq(hash3, keccak256(abi.encodePacked(pubkey2)));
    }

    function test_getRegistryStateHash_skipInactiveOracles() public {
        // Add 3 oracles
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));
        _addOracleAndSnapshot(oracle3Addr, IP_3, pubkey3, _signPoP(oracle3Addr, pubkey3, 2));

        // Remove the first oracle
        vm.prank(admin);
        registry.removeOracle(id1);

        // State hash should only include pubkey2 and pubkey3
        bytes32 stateHash = registry.getRegistryStateHash();
        assertEq(stateHash, keccak256(abi.encodePacked(pubkey2, pubkey3)));
    }

    function test_registryStateChanged_eventDataMatchesViewFunctions() public {
        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // After add, state should match
        uint256 nonce = registry.registryNonce();
        uint256 activeCount = registry.activeOracleCount();
        bytes32 stateHash = registry.getRegistryStateHash();

        assertEq(nonce, 1);
        assertEq(activeCount, 1);
        assertEq(stateHash, keccak256(abi.encodePacked(pubkey1)));
    }

    function test_addOracle_eventOrderOracleAddedBeforeStateChanged() public {
        // AC5: _emitStateChange() must be called AFTER emit OracleAdded
        vm.recordLogs();

        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Find OracleAdded and RegistryStateChanged events
        bytes32 oracleAddedSig = keccak256("OracleAdded(uint256,address,bytes)");
        bytes32 stateChangedSig = keccak256("RegistryStateChanged(uint256,uint256,bytes32)");

        uint256 oracleAddedIdx = type(uint256).max;
        uint256 stateChangedIdx = type(uint256).max;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == oracleAddedSig) {
                oracleAddedIdx = i;
            }
            if (logs[i].topics[0] == stateChangedSig) {
                stateChangedIdx = i;
            }
        }

        assertTrue(oracleAddedIdx != type(uint256).max, "OracleAdded event not found");
        assertTrue(stateChangedIdx != type(uint256).max, "RegistryStateChanged event not found");
        assertTrue(oracleAddedIdx < stateChangedIdx, "OracleAdded must come before RegistryStateChanged");
    }

    function test_removeOracle_eventOrderOracleRemovedBeforeStateChanged() public {
        // AC6: _emitStateChange() must be called AFTER emit OracleRemoved
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        vm.recordLogs();

        vm.prank(admin);
        registry.removeOracle(oracleId);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 oracleRemovedSig = keccak256("OracleRemoved(uint256)");
        bytes32 stateChangedSig = keccak256("RegistryStateChanged(uint256,uint256,bytes32)");

        uint256 oracleRemovedIdx = type(uint256).max;
        uint256 stateChangedIdx = type(uint256).max;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == oracleRemovedSig) {
                oracleRemovedIdx = i;
            }
            if (logs[i].topics[0] == stateChangedSig) {
                stateChangedIdx = i;
            }
        }

        assertTrue(oracleRemovedIdx != type(uint256).max, "OracleRemoved event not found");
        assertTrue(stateChangedIdx != type(uint256).max, "RegistryStateChanged event not found");
        assertTrue(oracleRemovedIdx < stateChangedIdx, "OracleRemoved must come before RegistryStateChanged");
    }

    function test_executeRotation_eventOrderKeyRotationExecutedBeforeStateChanged() public {
        // AC7: _emitStateChange() must be called AFTER emit KeyRotationExecuted
        (uint256[] memory oracleIds,) = _setupOraclesForRotation();
        uint256 rotatingId = oracleIds[0];

        bytes memory newPubkey = blsPubkey(20);

        vm.startPrank(registry.getOracle(rotatingId).addr);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getOracle(rotatingId).addr, newPubkey, 20));
        vm.stopPrank();

        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(rotatingId, oracleIds[i], sig);
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

    function test_addOracle_revertsOnInvalidPoP() public {
        // Sign PoP with the WRONG key (seed 1 instead of seed 0)
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), oracle1Addr, pubkey1));
        bytes memory wrongPop = blsSign("1", popMsg);

        vm.expectRevert(OracleRegistry.OracleRegistry__InvalidPoP.selector);
        vm.prank(admin);
        registry.addOracle(oracle1Addr, IP_1, pubkey1, wrongPop);
    }

    function test_addOracle_revertsOnDuplicatePubkey() public {
        // Register oracle1 with pubkey1
        _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Try to register oracle2 with the same pubkey1 -- should revert
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleRegistry__PubkeyAlreadyRegistered.selector, 0));
        vm.prank(admin);
        registry.addOracle(oracle2Addr, IP_2, pubkey1, _signPoP(oracle2Addr, pubkey1, 0));
    }

    function test_removeOracle_clearsPubkeyUniqueness() public {
        // Register and remove oracle1 with pubkey1
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        _removeOracleAndSnapshot(id1);

        // Now oracle2 can register with the same pubkey1 (uniqueness was cleared on removal)
        vm.prank(admin);
        uint256 id2 = registry.addOracle(oracle2Addr, IP_2, pubkey1, _signPoP(oracle2Addr, pubkey1, 0));

        TypesLib.Oracle memory oracle2 = registry.getOracle(id2);
        assertEq(oracle2.blsPubkey, pubkey1);
        assertEq(oracle2.status, 1);
    }

    function test_executeRotation_clearsPubkeyUniqueness() public {
        // Set up 20 oracles, rotate oracle 0 from seed-0 key to seed-20 key
        (uint256[] memory oracleIds, bytes[] memory pubkeys_) = _setupOraclesForRotation();
        uint256 rotatingId = oracleIds[0];
        bytes memory oldPubkey = pubkeys_[0];

        bytes memory newPubkey = blsPubkey(20);
        vm.startPrank(registry.getOracle(rotatingId).addr);
        registry.requestKeyRotation(rotatingId, newPubkey, _signRotationRequest(rotatingId, newPubkey, 0), _signRotationPoP(registry.getOracle(rotatingId).addr, newPubkey, 20));
        vm.stopPrank();

        // Get 10 approvals
        TypesLib.KeyRotation memory rotation = registry.getPendingRotation(rotatingId);
        for (uint256 i = 1; i <= 10; i++) {
            bytes memory sig = _signApproval(rotatingId, rotation.newPubkey, uint8(i));
            vm.prank(registry.getOracle(oracleIds[i]).addr);
            registry.approveRotation(rotatingId, oracleIds[i], sig);
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

        // Old pubkey (seed 0) is now free. A new oracle should be able to register with it.
        address newOracleAddr = makeAddr("newOracleForOldKey");
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), newOracleAddr, oldPubkey));
        bytes memory popSig = blsSign("0", popMsg);

        vm.prank(admin);
        uint256 newId = registry.addOracle(newOracleAddr, bytes32(uint256(999)), oldPubkey, popSig);

        TypesLib.Oracle memory newOracle = registry.getOracle(newId);
        assertEq(newOracle.blsPubkey, oldPubkey);
    }

    function test_requestKeyRotation_revertsOnDuplicateNewPubkey() public {
        // Register oracle1 with pubkey1 and oracle2 with pubkey2
        uint256 id1 = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));
        _addOracleAndSnapshot(oracle2Addr, IP_2, pubkey2, _signPoP(oracle2Addr, pubkey2, 1));

        // Try to rotate oracle1 to pubkey2 (already used by oracle2)
        bytes memory sig = _signRotationRequest(id1, pubkey2, 0);
        vm.expectRevert(abi.encodeWithSelector(OracleRegistry.OracleRegistry__PubkeyAlreadyRegistered.selector, 1));
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(id1, pubkey2, sig, new bytes(64));
    }

    function test_requestKeyRotation_revertsOnInvalidNewKeyPoP() public {
        // Register oracle1
        uint256 oracleId = _addOracleAndSnapshot(oracle1Addr, IP_1, pubkey1, _signPoP(oracle1Addr, pubkey1, 0));

        // Request rotation with valid old-key sig but WRONG PoP for new key
        // Sign PoP with seed 0 (wrong) instead of seed 1 (the new key's seed)
        bytes memory oldKeySig = _signRotationRequest(oracleId, pubkey2, 0);
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), oracle1Addr, pubkey2));
        bytes memory wrongPop = blsSign("0", popMsg); // wrong: should be signed by seed 1

        vm.expectRevert(OracleRegistry.OracleRegistry__InvalidPoP.selector);
        vm.prank(oracle1Addr);
        registry.requestKeyRotation(oracleId, pubkey2, oldKeySig, wrongPop);
    }
}
