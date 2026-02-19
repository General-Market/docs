// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/registry/AssetPairRegistry.sol";
import "../src/interfaces/IAssetPairRegistry.sol";
import "../src/libraries/TypesLib.sol";

/// @title AssetPairRegistryTest - Comprehensive tests for AssetPairRegistry
/// @notice Tests all asset and pair lifecycle operations, timelocks, and view functions
contract AssetPairRegistryTest is Test {
    AssetPairRegistry public registry;

    address public admin = address(0x1);
    address public user = address(0x2);
    address public asset1 = address(0x100);
    address public asset2 = address(0x200);
    address public quoteToken = address(0x300); // USDC
    bytes32 public constant SOURCE_BITGET = keccak256("BITGET");
    bytes32 public constant SOURCE_1INCH = keccak256("1INCH");
    uint256 public constant CHAIN_ARBITRUM = 42161;
    uint256 public constant CHAIN_CEX = 0;

    // BLS signature must be exactly 64 bytes (G1 point) and on the BN254 curve.
    // Use the generator point G1 = (1, 2) which satisfies y² = x³ + 3 (mod P).
    bytes public mockSignature = abi.encode(uint256(1), uint256(2));

    function setUp() public {
        registry = new AssetPairRegistry(admin, address(0x1));

        // Mock BN254 pairing precompile (address 0x08) to accept any signature
        // This allows tests to use mockSignature without real BLS key setup
        vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

        // BLS verification now reads from IssuerRegistry (set via constructor)
    }

    // ============ CONSTRUCTOR TESTS ============

    function test_constructor_setsAdmin() public view {
        assertEq(registry.admin(), admin);
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(AssetPairRegistry.ZeroAddress.selector);
        new AssetPairRegistry(address(0), address(0x1));
    }

    // ============ PROPOSE ASSET TESTS ============

    function test_proposeAsset_createsPendingEntry() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        (address assetAddr, uint8 status, uint256 proposedAt,) = registry.getAsset(asset1);

        assertEq(assetAddr, asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.PENDING));
        assertEq(proposedAt, block.timestamp + 2 days);
    }

    function test_proposeAsset_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IAssetPairRegistry.AssetProposed(asset1, user, block.timestamp + 2 days);

        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);
    }

    function test_proposeAsset_incrementsNonce() public {
        uint256 nonceBefore = registry.getNonce();

        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        assertEq(registry.getNonce(), nonceBefore + 1);
    }

    function test_proposeAsset_revertsOnZeroAddress() public {
        vm.expectRevert(AssetPairRegistry.ZeroAddress.selector);
        registry.proposeAsset(address(0), mockSignature);
    }

    function test_proposeAsset_revertsIfAlreadyExists() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        vm.expectRevert(AssetPairRegistry.AssetAlreadyExists.selector);
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);
    }

    // ============ ACTIVATE ASSET TESTS ============

    function test_activateAsset_failsBeforeTimelock() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        // Try to activate immediately
        vm.expectRevert(AssetPairRegistry.TimelockNotPassed.selector);
        registry.activateAsset(asset1);
    }

    function test_activateAsset_succeedsAfterTimelock() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        // Warp past timelock
        vm.warp(block.timestamp + 2 days + 1);

        registry.activateAsset(asset1);

        (, uint8 status,, uint256 activatedAt) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.ACTIVE));
        assertEq(activatedAt, block.timestamp);
    }

    function test_activateAsset_emitsEvent() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        vm.warp(block.timestamp + 2 days + 1);

        vm.expectEmit(true, true, false, false);
        emit IAssetPairRegistry.AssetActivated(asset1, address(this));

        registry.activateAsset(asset1);
    }

    function test_activateAsset_revertsIfNotPending() public {
        // Asset not proposed
        vm.expectRevert(AssetPairRegistry.AssetNotPending.selector);
        registry.activateAsset(asset1);
    }

    function test_activateAsset_anyoneCanCall() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        vm.warp(block.timestamp + 2 days + 1);

        // Random address can activate
        vm.prank(address(0x999));
        registry.activateAsset(asset1);

        (, uint8 status,,) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.ACTIVE));
    }

    // ============ DELIST ASSET TESTS ============

    function test_delistAsset_marksAsDelisting() public {
        // Setup: propose and activate
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        (, uint8 status,,) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.DELISTING));
    }

    function test_delistAsset_emitsEvent() public {
        _proposeAndActivateAsset(asset1);

        vm.expectEmit(true, false, false, false);
        emit IAssetPairRegistry.AssetDelisting(asset1);

        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);
    }

    function test_delistAsset_revertsIfNotActive() public {
        // Asset not proposed
        vm.expectRevert(AssetPairRegistry.AssetNotActive.selector);
        registry.delistAsset(asset1, mockSignature);
    }

    // ============ EMERGENCY REMOVE ASSET TESTS ============

    function test_emergencyRemoveAsset_immediatelyRemoves() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.emergencyRemoveAsset(asset1, mockSignature);

        (, uint8 status,,) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.INACTIVE));
    }

    function test_emergencyRemoveAsset_emitsEvent() public {
        _proposeAndActivateAsset(asset1);

        vm.expectEmit(true, false, false, false);
        emit IAssetPairRegistry.AssetEmergencyRemoved(asset1);

        vm.prank(user);
        registry.emergencyRemoveAsset(asset1, mockSignature);
    }

    function test_emergencyRemoveAsset_worksOnDelistingAsset() public {
        _proposeAndActivateAsset(asset1);

        // First delist
        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        // Then emergency remove
        vm.prank(user);
        registry.emergencyRemoveAsset(asset1, mockSignature);

        (, uint8 status,,) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.INACTIVE));
    }

    function test_emergencyRemoveAsset_revertsIfNotActiveOrDelisting() public {
        vm.expectRevert(AssetPairRegistry.AssetNotActive.selector);
        registry.emergencyRemoveAsset(asset1, mockSignature);
    }

    // ============ PROPOSE PAIR TESTS ============

    function test_proposePair_createsPendingEntry() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        (
            address asset,
            bytes32 source,
            address quote,
            uint256 chainId,
            uint8 status,
            uint256 proposedAt,
        ) = registry.getPair(pairId);

        assertEq(asset, asset1);
        assertEq(source, SOURCE_BITGET);
        assertEq(quote, quoteToken);
        assertEq(chainId, CHAIN_CEX);
        assertEq(status, uint8(TypesLib.PairStatus.PENDING));
        assertEq(proposedAt, block.timestamp + 2 days);
    }

    function test_proposePair_failsIfAssetNotActive() public {
        // Asset not proposed
        vm.expectRevert(AssetPairRegistry.AssetNotWhitelisted.selector);
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
    }

    function test_proposePair_generatesCorrectPairId() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        bytes32 expectedPairId = keccak256(abi.encode(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX));
        bytes32 computedPairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        assertEq(expectedPairId, computedPairId);

        // Verify it's tracked in asset pairs
        bytes32[] memory assetPairs = registry.getPairsForAsset(asset1);
        assertEq(assetPairs.length, 1);
        assertEq(assetPairs[0], expectedPairId);
    }

    function test_proposePair_emitsEvent() public {
        _proposeAndActivateAsset(asset1);

        bytes32 expectedPairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        vm.expectEmit(true, true, true, true);
        emit IAssetPairRegistry.PairProposed(
            expectedPairId, asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, user, block.timestamp + 2 days
        );

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
    }

    function test_proposePair_revertsIfPairExists() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        vm.expectRevert(AssetPairRegistry.PairAlreadyExists.selector);
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
    }

    // ============ ACTIVATE PAIR TESTS ============

    function test_activatePair_failsBeforeTimelock() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        vm.expectRevert(AssetPairRegistry.TimelockNotPassed.selector);
        registry.activatePair(pairId);
    }

    function test_activatePair_succeedsAfterTimelock() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Warp past timelock
        vm.warp(block.timestamp + 2 days + 1);

        registry.activatePair(pairId);

        (,,,, uint8 status,, uint256 activatedAt) = registry.getPair(pairId);
        assertEq(status, uint8(TypesLib.PairStatus.ACTIVE));
        assertEq(activatedAt, block.timestamp);
    }

    function test_activatePair_emitsEvent() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        vm.warp(block.timestamp + 2 days + 1);

        vm.expectEmit(true, true, false, false);
        emit IAssetPairRegistry.PairActivated(pairId, address(this));

        registry.activatePair(pairId);
    }

    function test_activatePair_revertsIfNotPending() public {
        bytes32 fakePairId = bytes32(uint256(1));

        vm.expectRevert(AssetPairRegistry.PairNotPending.selector);
        registry.activatePair(fakePairId);
    }

    // ============ DELIST PAIR TESTS ============

    function test_delistPair_marksAsDelisted() public {
        bytes32 pairId = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        vm.prank(user);
        registry.delistPair(pairId, mockSignature);

        (,,,, uint8 status,,) = registry.getPair(pairId);
        assertEq(status, uint8(TypesLib.PairStatus.DELISTED));
    }

    function test_delistPair_emitsEvent() public {
        bytes32 pairId = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        vm.expectEmit(true, false, false, false);
        emit IAssetPairRegistry.PairDelisted(pairId);

        vm.prank(user);
        registry.delistPair(pairId, mockSignature);
    }

    function test_delistPair_revertsIfNotActive() public {
        bytes32 fakePairId = bytes32(uint256(1));

        vm.expectRevert(AssetPairRegistry.PairNotActive.selector);
        registry.delistPair(fakePairId, mockSignature);
    }

    // ============ VIEW FUNCTION TESTS ============

    function test_isAssetWhitelisted_returnsTrueForActive() public {
        _proposeAndActivateAsset(asset1);

        assertTrue(registry.isAssetWhitelisted(asset1));
    }

    function test_isAssetWhitelisted_returnsFalseForNonActive() public {
        assertFalse(registry.isAssetWhitelisted(asset1));

        // Pending
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);
        assertFalse(registry.isAssetWhitelisted(asset1));
    }

    function test_isAssetDelisting_returnsTrueForDelisting() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        assertTrue(registry.isAssetDelisting(asset1));
    }

    function test_isPairActive_returnsTrueForActive() public {
        bytes32 pairId = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        assertTrue(registry.isPairActive(pairId));
    }

    function test_isPairActive_returnsFalseForNonActive() public {
        bytes32 fakePairId = bytes32(uint256(1));
        assertFalse(registry.isPairActive(fakePairId));
    }

    function test_getActiveAssets_returnsOnlyActiveAssets() public {
        _proposeAndActivateAsset(asset1);
        _proposeAndActivateAsset(asset2);

        address[] memory activeAssets = registry.getActiveAssets();
        assertEq(activeAssets.length, 2);
        assertEq(activeAssets[0], asset1);
        assertEq(activeAssets[1], asset2);

        // Delist one
        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        activeAssets = registry.getActiveAssets();
        assertEq(activeAssets.length, 1);
        assertEq(activeAssets[0], asset2);
    }

    function test_getActivePairs_returnsOnlyActivePairs() public {
        bytes32 pairId1 = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);
        bytes32 pairId2 = _proposeAndActivatePair(asset1, SOURCE_1INCH, quoteToken, CHAIN_ARBITRUM);

        bytes32[] memory activePairs = registry.getActivePairs();
        assertEq(activePairs.length, 2);
        assertEq(activePairs[0], pairId1);
        assertEq(activePairs[1], pairId2);

        // Delist one
        vm.prank(user);
        registry.delistPair(pairId1, mockSignature);

        activePairs = registry.getActivePairs();
        assertEq(activePairs.length, 1);
        assertEq(activePairs[0], pairId2);
    }

    function test_getPairsForAsset_returnsAllPairsForAsset() public {
        _proposeAndActivateAsset(asset1);

        // Create multiple pairs for same asset
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_1INCH, quoteToken, CHAIN_ARBITRUM, mockSignature);

        bytes32[] memory assetPairs = registry.getPairsForAsset(asset1);
        assertEq(assetPairs.length, 2);
    }

    function test_computePairId_isPure() public view {
        bytes32 pairId1 = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);
        bytes32 pairId2 = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);
        assertEq(pairId1, pairId2);
    }

    // ============ REPLAY PROTECTION TESTS ============

    function test_replayProtection_nonceIncrementsOnEachCall() public {
        uint256 nonce0 = registry.getNonce();

        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);
        assertEq(registry.getNonce(), nonce0 + 1);

        vm.warp(block.timestamp + 2 days + 1);
        registry.activateAsset(asset1);

        // Activate doesn't use nonce
        assertEq(registry.getNonce(), nonce0 + 1);

        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);
        assertEq(registry.getNonce(), nonce0 + 2);
    }

    // ============ MULTIPLE ASSETS AND PAIRS TESTS ============

    function test_multipleAssetsAndPairs_trackIndependently() public {
        // Setup multiple assets
        _proposeAndActivateAsset(asset1);
        _proposeAndActivateAsset(asset2);

        // Create pairs for each
        bytes32 pair1 = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);
        bytes32 pair2 = _proposeAndActivatePair(asset2, SOURCE_BITGET, quoteToken, CHAIN_CEX);
        bytes32 pair3 = _proposeAndActivatePair(asset1, SOURCE_1INCH, quoteToken, CHAIN_ARBITRUM);

        // Verify independent tracking
        assertTrue(registry.isAssetWhitelisted(asset1));
        assertTrue(registry.isAssetWhitelisted(asset2));

        assertTrue(registry.isPairActive(pair1));
        assertTrue(registry.isPairActive(pair2));
        assertTrue(registry.isPairActive(pair3));

        // Delist one asset
        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        assertTrue(registry.isAssetDelisting(asset1));
        assertTrue(registry.isAssetWhitelisted(asset2)); // asset2 unaffected

        // Pairs should still be active (existing orders can complete)
        assertTrue(registry.isPairActive(pair1));
        assertTrue(registry.isPairActive(pair2));
    }

    function test_assetDelistingAffectsPairAvailability() public {
        _proposeAndActivateAsset(asset1);

        // Create a pair
        bytes32 pairId = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Delist asset
        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        // Pair is still active (existing orders can complete)
        assertTrue(registry.isPairActive(pairId));

        // But asset is delisting
        assertTrue(registry.isAssetDelisting(asset1));
        assertFalse(registry.isAssetWhitelisted(asset1));

        // New pairs cannot be proposed for delisting asset
        vm.expectRevert(AssetPairRegistry.AssetNotWhitelisted.selector);
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_1INCH, quoteToken, CHAIN_ARBITRUM, mockSignature);
    }

    // ============ ACTIVATE PAIR - ASSET STATUS CHECK (HIGH-3 FIX) ============

    function test_activatePair_revertsIfAssetNoLongerActive() public {
        _proposeAndActivateAsset(asset1);

        // Propose a pair
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Delist the asset during pair's timelock
        vm.prank(user);
        registry.delistAsset(asset1, mockSignature);

        // Warp past timelock
        vm.warp(block.timestamp + 2 days + 1);

        // Try to activate pair - should fail because asset is DELISTING
        vm.expectRevert(AssetPairRegistry.AssetNotWhitelisted.selector);
        registry.activatePair(pairId);
    }

    function test_activatePair_revertsIfAssetEmergencyRemoved() public {
        _proposeAndActivateAsset(asset1);

        // Propose a pair
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Emergency remove the asset during pair's timelock
        vm.prank(user);
        registry.emergencyRemoveAsset(asset1, mockSignature);

        // Warp past timelock
        vm.warp(block.timestamp + 2 days + 1);

        // Try to activate pair - should fail because asset is INACTIVE
        vm.expectRevert(AssetPairRegistry.AssetNotWhitelisted.selector);
        registry.activatePair(pairId);
    }

    // ============ CANCEL ASSET PROPOSAL TESTS (MEDIUM-2 FIX) ============

    function test_cancelAssetProposal_resetsToInactive() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        // Cancel the proposal
        vm.prank(user);
        registry.cancelAssetProposal(asset1, mockSignature);

        (, uint8 status,,) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.INACTIVE));
    }

    function test_cancelAssetProposal_emitsEvent() public {
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        vm.expectEmit(true, false, false, false);
        emit IAssetPairRegistry.AssetProposalCancelled(asset1);

        vm.prank(user);
        registry.cancelAssetProposal(asset1, mockSignature);
    }

    function test_cancelAssetProposal_revertsIfNotPending() public {
        vm.expectRevert(AssetPairRegistry.AssetNotPending.selector);
        registry.cancelAssetProposal(asset1, mockSignature);
    }

    function test_cancelAssetProposal_allowsReproposal() public {
        // Propose
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        // Cancel
        vm.prank(user);
        registry.cancelAssetProposal(asset1, mockSignature);

        // Re-propose should succeed
        vm.prank(user);
        registry.proposeAsset(asset1, mockSignature);

        (, uint8 status,,) = registry.getAsset(asset1);
        assertEq(status, uint8(TypesLib.AssetStatus.PENDING));
    }

    // ============ CANCEL PAIR PROPOSAL TESTS (MEDIUM-2 FIX) ============

    function test_cancelPairProposal_resetsToInactive() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Cancel the proposal
        vm.prank(user);
        registry.cancelPairProposal(pairId, mockSignature);

        (,,,, uint8 status,,) = registry.getPair(pairId);
        assertEq(status, uint8(TypesLib.PairStatus.INACTIVE));
    }

    function test_cancelPairProposal_emitsEvent() public {
        _proposeAndActivateAsset(asset1);

        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        vm.expectEmit(true, false, false, false);
        emit IAssetPairRegistry.PairProposalCancelled(pairId);

        vm.prank(user);
        registry.cancelPairProposal(pairId, mockSignature);
    }

    function test_cancelPairProposal_revertsIfNotPending() public {
        bytes32 fakePairId = bytes32(uint256(1));

        vm.expectRevert(AssetPairRegistry.PairNotPending.selector);
        registry.cancelPairProposal(fakePairId, mockSignature);
    }

    function test_cancelPairProposal_allowsReproposal() public {
        _proposeAndActivateAsset(asset1);

        // Propose
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);
        bytes32 pairId = registry.computePairId(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Cancel
        vm.prank(user);
        registry.cancelPairProposal(pairId, mockSignature);

        // Re-propose should succeed
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX, mockSignature);

        (,,,, uint8 status,,) = registry.getPair(pairId);
        assertEq(status, uint8(TypesLib.PairStatus.PENDING));
    }

    // ============ GET ACTIVE PAIRS FOR ASSET TESTS (MEDIUM-4 FIX) ============

    function test_getActivePairsForAsset_filtersDelisted() public {
        _proposeAndActivateAsset(asset1);

        // Create two pairs
        bytes32 pairId1 = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);
        bytes32 pairId2 = _proposeAndActivatePair(asset1, SOURCE_1INCH, quoteToken, CHAIN_ARBITRUM);

        // Both should be active
        bytes32[] memory activePairs = registry.getActivePairsForAsset(asset1);
        assertEq(activePairs.length, 2);

        // Delist one pair
        vm.prank(user);
        registry.delistPair(pairId1, mockSignature);

        // Only one should be active now
        activePairs = registry.getActivePairsForAsset(asset1);
        assertEq(activePairs.length, 1);
        assertEq(activePairs[0], pairId2);
    }

    function test_getActivePairsForAsset_filtersPending() public {
        _proposeAndActivateAsset(asset1);

        // Activate one pair
        bytes32 pairId1 = _proposeAndActivatePair(asset1, SOURCE_BITGET, quoteToken, CHAIN_CEX);

        // Propose another (still pending)
        vm.prank(user);
        registry.proposePair(asset1, SOURCE_1INCH, quoteToken, CHAIN_ARBITRUM, mockSignature);

        // getPairsForAsset returns both
        bytes32[] memory allPairs = registry.getPairsForAsset(asset1);
        assertEq(allPairs.length, 2);

        // getActivePairsForAsset returns only active one
        bytes32[] memory activePairs = registry.getActivePairsForAsset(asset1);
        assertEq(activePairs.length, 1);
        assertEq(activePairs[0], pairId1);
    }

    // ============ ADMIN FUNCTION TESTS ============

    function test_setAdmin_onlyAdmin() public {
        address newAdmin = address(0x999);

        vm.expectRevert(AssetPairRegistry.Unauthorized.selector);
        vm.prank(user);
        registry.setAdmin(newAdmin);

        vm.prank(admin);
        registry.setAdmin(newAdmin);

        assertEq(registry.admin(), newAdmin);
    }

    function test_setAdmin_revertsOnZeroAddress() public {
        vm.expectRevert(AssetPairRegistry.ZeroAddress.selector);
        vm.prank(admin);
        registry.setAdmin(address(0));
    }

    function test_setAdmin_emitsEvent() public {
        address newAdmin = address(0x999);

        vm.expectEmit(true, true, false, false);
        emit IAssetPairRegistry.AdminChanged(admin, newAdmin);

        vm.prank(admin);
        registry.setAdmin(newAdmin);
    }

    // ============ HELPER FUNCTIONS ============

    function _proposeAndActivateAsset(address asset) internal {
        vm.prank(user);
        registry.proposeAsset(asset, mockSignature);

        vm.warp(block.timestamp + 2 days + 1);
        registry.activateAsset(asset);
    }

    function _proposeAndActivatePair(address asset, bytes32 source, address quote, uint256 chainId)
        internal
        returns (bytes32 pairId)
    {
        // Ensure asset is active
        if (!registry.isAssetWhitelisted(asset)) {
            _proposeAndActivateAsset(asset);
        }

        vm.prank(user);
        registry.proposePair(asset, source, quote, chainId, mockSignature);

        pairId = registry.computePairId(asset, source, quote, chainId);

        vm.warp(block.timestamp + 2 days + 1);
        registry.activatePair(pairId);

        return pairId;
    }
}
