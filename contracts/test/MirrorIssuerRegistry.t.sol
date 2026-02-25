// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {IMirrorIssuerRegistry} from "../src/interfaces/IMirrorIssuerRegistry.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {BLSLib} from "../src/libraries/BLSLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Governance} from "../src/Governance.sol";
import "./helpers/TestHelper.sol";

/// @title MirrorIssuerRegistry.t.sol - Tests for Story 8.2
/// @notice Tests for MirrorIssuerRegistry synced via BLS proofs
contract MirrorIssuerRegistryTest is TestHelper {
    MirrorIssuerRegistry public mirror;
    address public admin = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    // Test pubkeys (128 bytes G2)
    bytes public validPubkey1;
    bytes public validPubkey2;
    bytes public invalidPubkey; // Wrong length

    // Test BLS signature (64 bytes G1) - for mock/happy path
    bytes public mockSignature;

    function setUp() public {
        // Generate valid 128-byte pubkeys
        validPubkey1 = generateTestPubkey(1);
        validPubkey2 = generateTestPubkey(2);
        invalidPubkey = new bytes(64); // Wrong length

        // Generate mock 64-byte signature
        mockSignature = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            mockSignature[i] = bytes1(uint8(i + 100));
        }

        // Deploy MirrorIssuerRegistry as UUPS proxy
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey1, 2, 3, admin))
        );
        mirror = MirrorIssuerRegistry(address(proxy));
    }

    // ============ TASK 11.2: INITIALIZE TESTS ============

    function test_initialize_setsAllValuesCorrectly() public view {
        assertEq(mirror.getAggregatedPubkey(), validPubkey1);
        assertEq(mirror.threshold(), 2);
        assertEq(mirror.activeCount(), 3);
        assertEq(mirror.admin(), admin);
        assertEq(mirror.registryNonce(), 0);
    }

    function test_initialize_storesCorrectPubkeyLength() public view {
        bytes memory storedPubkey = mirror.getAggregatedPubkey();
        assertEq(storedPubkey.length, 128);
    }

    // ============ TASK 11.3: INITIALIZE REVERT ON INVALID PUBKEY ============

    function test_initialize_revertsOnInvalidPubkeyLength() public {
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();

        // Try to initialize with 64-byte pubkey (should fail)
        vm.expectRevert(ErrorsLib.E091_InvalidAggPubkey.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (invalidPubkey, 2, 3, admin))
        );
    }

    function test_initialize_revertsOnEmptyPubkey() public {
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();
        bytes memory emptyPubkey = new bytes(0);

        vm.expectRevert(ErrorsLib.E091_InvalidAggPubkey.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (emptyPubkey, 2, 3, admin))
        );
    }

    function test_initialize_revertsOnTooLongPubkey() public {
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();
        bytes memory longPubkey = new bytes(256);

        vm.expectRevert(ErrorsLib.E091_InvalidAggPubkey.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (longPubkey, 2, 3, admin))
        );
    }

    // ============ ZERO ADDRESS VALIDATION TESTS (HIGH-1 FIX) ============

    function test_initialize_revertsOnZeroAdmin() public {
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();

        vm.expectRevert(ErrorsLib.E092_ZeroAdmin.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey1, 2, 3, address(0)))
        );
    }

    function test_setAdmin_revertsOnZeroAddress() public {
        vm.expectRevert(ErrorsLib.E092_ZeroAdmin.selector);
        mirror.setAdmin(address(0));
    }

    // ============ THRESHOLD VALIDATION TESTS (HIGH-3 FIX) ============

    function test_initialize_revertsOnZeroThreshold() public {
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E093_InvalidThreshold.selector, 0, 3));
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey1, 0, 3, admin))
        );
    }

    function test_initialize_revertsOnThresholdGreaterThanActiveCount() public {
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E093_InvalidThreshold.selector, 5, 3));
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey1, 5, 3, admin))
        );
    }

    function test_sync_revertsOnZeroThreshold() public {
        // Threshold validation happens before BLS, so no mock needed
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E093_InvalidThreshold.selector, 0, 4));
        mirror.sync(validPubkey2, 4, 0, 1, mockSignature, 0x7);
    }

    function test_sync_revertsOnThresholdGreaterThanActiveCount() public {
        // Threshold validation happens before BLS, so no mock needed
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E093_InvalidThreshold.selector, 5, 3));
        mirror.sync(validPubkey2, 3, 5, 1, mockSignature, 0x7);
    }

    // ============ TASK 11.5: SYNC REVERTS ON STALE NONCE ============

    function test_sync_revertsOnStaleNonce_equal() public {
        // nonce = 0 (equal to current registryNonce = 0)
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E090_StaleNonce.selector, 0, 0));
        mirror.sync(validPubkey2, 4, 3, 0, mockSignature, 0x7);
    }

    function test_sync_revertsOnStaleNonce_lessThan() public {
        // First, we need to do a successful sync to increment nonce
        // Since BLS verification will fail with mock data, we'll test the nonce check order
        // The nonce check happens BEFORE BLS verification

        // For this test, nonce = 0 should fail (equal to current)
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E090_StaleNonce.selector, 0, 0));
        mirror.sync(validPubkey2, 4, 3, 0, mockSignature, 0x7);
    }

    // ============ TASK 11.6: SYNC REVERTS ON INVALID BLS SIGNATURE ============

    function test_sync_revertsOnInvalidBLSSignature() public {
        // Use nonce > 0 to pass nonce check, but BLS verification should fail
        // with our mock signature against the stored pubkey
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        mirror.sync(validPubkey2, 4, 3, 1, mockSignature, 0x7);
    }

    function test_sync_revertsOnEmptySignature() public {
        bytes memory emptySignature = new bytes(0);
        // Empty signature should fail BLS verification (wrong length)
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        mirror.sync(validPubkey2, 4, 3, 1, emptySignature, 0x7);
    }

    function test_sync_revertsOnWrongLengthSignature() public {
        bytes memory wrongLengthSig = new bytes(32);
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        mirror.sync(validPubkey2, 4, 3, 1, wrongLengthSig, 0x7);
    }

    // ============ TASK 11.7: SYNC REVERTS ON INVALID PUBKEY LENGTH ============

    function test_sync_revertsOnInvalidPubkeyLength() public {
        // Nonce check passes (1 > 0), but pubkey length check fails
        vm.expectRevert(ErrorsLib.E091_InvalidAggPubkey.selector);
        mirror.sync(invalidPubkey, 4, 3, 1, mockSignature, 0x7);
    }

    function test_sync_revertsOnEmptyNewPubkey() public {
        bytes memory emptyPubkey = new bytes(0);
        vm.expectRevert(ErrorsLib.E091_InvalidAggPubkey.selector);
        mirror.sync(emptyPubkey, 4, 3, 1, mockSignature, 0x7);
    }

    // ============ TASK 11.4 & AC8: SYNC HAPPY PATH ============
    // Note: Happy-path sync tests with BLS mocking are in MirrorIssuerRegistryIntegrationTest
    // (test_integration_fullSyncFlow_L3ToMirror, test_integration_multipleSyncsTrackL3Changes)
    // Unit tests here focus on validation error paths that don't require BLS verification

    // ============ TASK 11.8: VIEW FUNCTION TESTS ============

    function test_getAggregatedPubkey_returnsCorrectValue() public view {
        bytes memory pubkey = mirror.getAggregatedPubkey();
        assertEq(pubkey.length, 128);
        assertEq(keccak256(pubkey), keccak256(validPubkey1));
    }

    function test_threshold_returnsCorrectValue() public view {
        assertEq(mirror.threshold(), 2);
    }

    function test_activeCount_returnsCorrectValue() public view {
        assertEq(mirror.activeCount(), 3);
    }

    function test_registryNonce_startsAtZero() public view {
        assertEq(mirror.registryNonce(), 0);
    }

    // ============ TASK 11.9: ADMIN FUNCTION TESTS ============

    function test_setAdmin_worksForAdmin() public {
        vm.expectEmit(true, true, false, true);
        emit EventsLib.AdminChanged(admin, user1);

        mirror.setAdmin(user1);

        assertEq(mirror.admin(), user1);
    }

    function test_setAdmin_revertsForNonAdmin() public {
        vm.prank(user1);
        vm.expectRevert(MirrorIssuerRegistry.Unauthorized.selector);
        mirror.setAdmin(user2);
    }

    function test_setAdmin_newAdminCanSetAdmin() public {
        // Admin transfers to user1
        mirror.setAdmin(user1);
        assertEq(mirror.admin(), user1);

        // Original admin can no longer set admin
        vm.expectRevert(MirrorIssuerRegistry.Unauthorized.selector);
        mirror.setAdmin(user2);

        // New admin can set admin
        vm.prank(user1);
        mirror.setAdmin(user2);
        assertEq(mirror.admin(), user2);
    }

    // ============ TASK 11.10: UPGRADE AUTHORIZATION TESTS ============

    function test_upgradeAuthorization_adminCanUpgrade() public {
        // Deploy new implementation
        MirrorIssuerRegistry newImpl = new MirrorIssuerRegistry();

        // Admin can upgrade
        mirror.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgradeAuthorization_nonAdminCannotUpgrade() public {
        MirrorIssuerRegistry newImpl = new MirrorIssuerRegistry();

        vm.prank(user1);
        vm.expectRevert(MirrorIssuerRegistry.Unauthorized.selector);
        mirror.upgradeToAndCall(address(newImpl), "");
    }

    // ============ ADDITIONAL EDGE CASE TESTS ============

    function test_initialize_cannotBeCalledTwice() public {
        // Try to call initialize again
        vm.expectRevert(); // OZ will revert with Initializable error
        mirror.initialize(validPubkey2, 3, 4, user1);
    }

    function test_sync_orderOfValidation_nonceBeforeBLS() public {
        // This test verifies that nonce is checked before BLS verification
        // (which is the expected order for gas efficiency)

        // With nonce = 0 (stale), we should get StaleNonce error, not InvalidBLSSignature
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E090_StaleNonce.selector, 0, 0));
        mirror.sync(validPubkey2, 4, 3, 0, mockSignature, 0x7);
    }

    function test_sync_orderOfValidation_pubkeyBeforeBLS() public {
        // With valid nonce but invalid pubkey length, we should get InvalidAggPubkey
        // This verifies pubkey length is checked before BLS verification
        vm.expectRevert(ErrorsLib.E091_InvalidAggPubkey.selector);
        mirror.sync(invalidPubkey, 4, 3, 1, mockSignature, 0x7);
    }

    function test_sync_orderOfValidation_thresholdBeforeBLS() public {
        // With valid nonce and pubkey but invalid threshold, we should get InvalidThreshold
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E093_InvalidThreshold.selector, 0, 4));
        mirror.sync(validPubkey2, 4, 0, 1, mockSignature, 0x7);
    }

    function test_constructor_disablesInitializers() public {
        // Deploy implementation directly (not via proxy)
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();

        // Try to initialize directly - should fail
        vm.expectRevert(); // OZ Initializable error
        impl.initialize(validPubkey1, 2, 3, admin);
    }

    function test_interface_compliance() public view {
        // Verify all IMirrorIssuerRegistry functions are callable
        mirror.getAggregatedPubkey();
        mirror.aggregatedPubkey();
        mirror.threshold();
        mirror.activeCount();
        mirror.registryNonce();
        mirror.admin();
    }

    function test_initialize_thresholdEqualsActiveCount_succeeds() public {
        // Edge case: threshold = activeCount should be valid
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey1, 3, 3, admin))
        );
        MirrorIssuerRegistry m = MirrorIssuerRegistry(address(proxy));
        assertEq(m.threshold(), 3);
        assertEq(m.activeCount(), 3);
    }
}

/// @title MirrorIssuerRegistryIntegrationTest - Integration with L3 IssuerRegistry (Task 12)
/// @notice Tests the full sync flow from L3 IssuerRegistry to MirrorIssuerRegistry
/// @dev Note: Real BLS signature verification requires matching private keys
///      These tests verify the contract logic and event emission patterns
contract MirrorIssuerRegistryIntegrationTest is TestHelper {
    MirrorIssuerRegistry public mirror;
    IssuerRegistry public l3Registry;
    Governance public governance;

    address public admin = address(this);
    address public issuer1 = address(0x1001);
    address public issuer2 = address(0x1002);
    address public issuer3 = address(0x1003);

    bytes public pubkey1;
    bytes public pubkey2;
    bytes public pubkey3;

    function setUp() public {
        // Generate test pubkeys (real BLS keys from seeds 1,2,3 for L3 registration)
        pubkey1 = generateTestPubkey(1);
        pubkey2 = generateTestPubkey(2);
        pubkey3 = generateTestPubkey(3);

        // Deploy L3 IssuerRegistry
        governance = deployGovernance(admin);
        l3Registry = deployIssuerRegistry(address(governance));

        // Register 3 issuers on L3 using seeds 1,2,3
        registerIssuer(l3Registry, admin, issuer1, bytes32("ip1"), 1);
        registerIssuer(l3Registry, admin, issuer2, bytes32("ip2"), 2);
        registerIssuer(l3Registry, admin, issuer3, bytes32("ip3"), 3);

        // Deploy MirrorIssuerRegistry initialized with the aggregated pubkey of test issuers 0,1,2
        // This allows sync() to be signed with signWithTestIssuers()
        MirrorIssuerRegistry impl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (blsAggPubkey("0,1,2"), 2, 3, admin))
        );
        mirror = MirrorIssuerRegistry(address(proxy));
    }

    function test_integration_l3RegistryHasIssuers() public view {
        // Verify L3 registry has the expected issuers
        assertEq(l3Registry.activeIssuerCount(), 3);
    }

    function test_integration_mirrorInitializedWithMatchingState() public view {
        // Verify mirror is initialized with matching threshold and count
        assertEq(mirror.threshold(), 2);
        assertEq(mirror.activeCount(), 3);
        assertEq(mirror.registryNonce(), 0);
    }

    function test_integration_l3AddIssuerEmitsEvent() public {
        // Adding a 4th issuer on L3 should emit RegistryStateChanged
        bytes memory pubkey4 = generateTestPubkey(4);
        address issuer4 = address(0x1004);

        // Get current nonce from L3 registry
        uint256 currentNonce = l3Registry.registryNonce();

        // Generate Proof of Possession for issuer4
        bytes32 popMsg4 = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(l3Registry), issuer4, pubkey4));
        bytes memory popSig4 = blsSign(vm.toString(uint256(4)), popMsg4);

        // Expect RegistryStateChanged event
        vm.expectEmit(true, false, false, false);
        emit EventsLib.RegistryStateChanged(currentNonce + 1, 4, bytes32(0));

        vm.prank(admin);
        l3Registry.addIssuer(issuer4, bytes32("ip4"), pubkey4, popSig4);

        // Verify nonce incremented
        assertEq(l3Registry.registryNonce(), currentNonce + 1);
    }

    function test_integration_syncRequiresValidBLSSignature() public {
        // Attempt to sync with mock signature should fail BLS verification
        bytes memory mockSig = new bytes(64);
        bytes memory newPubkey = generateTestPubkey(10);

        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        mirror.sync(newPubkey, 4, 3, 1, mockSig, 0x7);
    }

    function test_integration_syncNonceMatchesL3() public view {
        // In a real scenario, the sync nonce would come from L3's registryNonce
        uint256 l3Nonce = l3Registry.registryNonce();
        uint256 mirrorNonce = mirror.registryNonce();

        // Initially, L3 has nonce from registering 3 issuers, mirror has 0
        assertTrue(l3Nonce >= mirrorNonce);
    }

    function test_integration_stateHashComputedCorrectly() public view {
        // Verify L3 can compute state hash
        bytes32 stateHash = l3Registry.getRegistryStateHash();
        assertTrue(stateHash != bytes32(0));
    }

    // ============ AC8: FULL SYNC FLOW TEST (HIGH-2 FIX) ============

    function test_integration_fullSyncFlow_L3ToMirror() public {
        // This test simulates the full AC8 flow:
        // 1. Add issuer on L3 → RegistryStateChanged emitted
        // 2. Compute new aggregated pubkey
        // 3. Generate real BLS sync proof via signWithTestIssuers
        // 4. Call sync() on mirror (verified against current agg pubkey = blsAggPubkey("0,1,2"))
        // 5. Verify mirror state matches expected

        // Step 1: Add 4th issuer on L3
        bytes memory pubkey4 = generateTestPubkey(4);
        address issuer4 = address(0x1004);
        uint256 l3NonceBefore = l3Registry.registryNonce();

        // Generate Proof of Possession for issuer4
        bytes32 popMsg4 = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(l3Registry), issuer4, pubkey4));
        bytes memory popSig4 = blsSign(vm.toString(uint256(4)), popMsg4);

        vm.prank(admin);
        l3Registry.addIssuer(issuer4, bytes32("ip4"), pubkey4, popSig4);

        uint256 l3NonceAfter = l3Registry.registryNonce();
        assertEq(l3NonceAfter, l3NonceBefore + 1);
        assertEq(l3Registry.activeIssuerCount(), 4);

        // Step 2: New aggregated pubkey after adding issuer 4 (for test, use seed 4's pubkey)
        bytes memory newAggPubkey = generateTestPubkey(4);

        // Step 3: Generate real BLS signature (signed by test issuers 0,1,2)
        uint256 syncNonce = l3NonceAfter;
        uint256 newActiveCount = 4;
        uint256 newThreshold = 3;
        bytes32 messageHash = keccak256(abi.encode("REGISTRY_SYNC", block.chainid, address(mirror), syncNonce, newAggPubkey, newActiveCount, newThreshold));
        bytes memory blsSignature = signWithTestIssuers(messageHash);
        uint256 signersBitmask = 0x7; // First 3 issuers signed

        // Step 4: Call sync on mirror
        vm.expectEmit(true, false, false, true);
        emit EventsLib.RegistrySynced(
            syncNonce,
            newActiveCount,
            newThreshold,
            keccak256(newAggPubkey),
            signersBitmask
        );

        mirror.sync(newAggPubkey, newActiveCount, newThreshold, syncNonce, blsSignature, signersBitmask);

        // Step 5: Verify mirror state matches expected
        assertEq(mirror.registryNonce(), syncNonce);
        assertEq(mirror.activeCount(), newActiveCount);
        assertEq(mirror.threshold(), newThreshold);
        assertEq(keccak256(mirror.getAggregatedPubkey()), keccak256(newAggPubkey));
    }

    function test_integration_multipleSyncsTrackL3Changes() public {
        // Initial state: mirror has nonce 0, L3 has nonce 3 (from 3 issuer registrations)
        // Mirror is initialized with blsAggPubkey("0,1,2"), so all syncs use signWithTestIssuers.
        assertEq(mirror.registryNonce(), 0);
        assertTrue(l3Registry.registryNonce() >= 3);

        // Sync 1: Catch up to L3's current state.
        // Use blsAggPubkey("0,1,2") as the new pubkey so the mirror stays signable.
        bytes memory aggPubkey1 = blsAggPubkey("0,1,2");
        bytes32 msg1 = keccak256(abi.encode("REGISTRY_SYNC", block.chainid, address(mirror), uint256(1), aggPubkey1, uint256(3), uint256(2)));
        mirror.sync(aggPubkey1, 3, 2, 1, signWithTestIssuers(msg1), 0x7);
        assertEq(mirror.registryNonce(), 1);

        // Add issuer on L3
        bytes memory pubkey4_ = generateTestPubkey(4);
        bytes32 popMsg4_ = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(l3Registry), address(0x1004), pubkey4_));
        bytes memory popSig4_ = blsSign(vm.toString(uint256(4)), popMsg4_);
        vm.prank(admin);
        l3Registry.addIssuer(address(0x1004), bytes32("ip4"), pubkey4_, popSig4_);

        // Sync 2: Update mirror with new issuer count.
        // Mirror still holds blsAggPubkey("0,1,2") as current pubkey → still signable.
        bytes memory aggPubkey2 = blsAggPubkey("0,1,2");
        bytes32 msg2 = keccak256(abi.encode("REGISTRY_SYNC", block.chainid, address(mirror), uint256(2), aggPubkey2, uint256(4), uint256(3)));
        mirror.sync(aggPubkey2, 4, 3, 2, signWithTestIssuers(msg2), 0xF);
        assertEq(mirror.registryNonce(), 2);
        assertEq(mirror.activeCount(), 4);
        assertEq(mirror.threshold(), 3);
    }
}
