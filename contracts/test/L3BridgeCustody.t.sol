// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/custody/L3BridgeCustody.sol";
import "../src/mocks/MockERC20.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title L3BridgeCustodyTest - Comprehensive tests for L3BridgeCustody
/// @notice Tests bridge lock, release, reversal, and edge cases
contract L3BridgeCustodyTest is TestHelper {
    L3BridgeCustody public custody;
    L3BridgeCustody public implementation;
    IssuerRegistry public mockRegistry;
    Governance public governance;
    MockERC20 public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    uint256 public constant DEST_CHAIN_ARBITRUM = 42161;
    uint256 public constant DEST_CHAIN_BASE = 8453;
    uint256 public constant LOCK_AMOUNT = 1000e18;
    bytes public constant EMPTY_BLS_SIG = "";

    // Events from interface
    event BridgeInitiated(uint256 indexed nonce, uint256 destChainId, uint256 amount);
    event LockReleased(uint256 indexed nonce, bytes32 destTxHash);
    event LockReversed(uint256 indexed nonce);

    function setUp() public {
        // Deploy real governance and issuer registry via UUPS proxy
        governance = deployGovernance(address(this));
        mockRegistry = deployIssuerRegistry(address(governance));
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy implementation
        implementation = new L3BridgeCustody();

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(L3BridgeCustody.initialize, (address(mockRegistry), address(usdc)))
        );

        custody = L3BridgeCustody(address(proxy));

        // Fund test accounts
        usdc.mint(alice, 10_000_000e18);
        usdc.mint(bob, 10_000_000e18);
        usdc.mint(address(this), 10_000_000e18);

        // Approve custody to spend USDC
        vm.prank(alice);
        usdc.approve(address(custody), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(custody), type(uint256).max);

        usdc.approve(address(custody), type(uint256).max);
    }

    // ============ INITIALIZATION TESTS ============

    function test_initialize_setsCorrectValues() public view {
        assertEq(address(custody.issuerRegistry()), address(mockRegistry));
        assertEq(address(custody.usdc()), address(usdc));
        assertEq(custody.bridgeNonce(), 0);
    }

    function test_initialize_revertsOnZeroIssuerRegistry() public {
        L3BridgeCustody impl = new L3BridgeCustody();
        vm.expectRevert(ErrorsLib.E043_ZeroIssuerRegistry.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(L3BridgeCustody.initialize, (address(0), address(usdc)))
        );
    }

    function test_initialize_revertsOnZeroUSDC() public {
        L3BridgeCustody impl = new L3BridgeCustody();
        vm.expectRevert(ErrorsLib.E050_ZeroUSDCAddress.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(L3BridgeCustody.initialize, (address(mockRegistry), address(0)))
        );
    }

    // ============ INITIATE BRIDGE TESTS ============

    function test_initiateBridge_happyPath() public {
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Check nonce
        assertEq(nonce, 0);
        assertEq(custody.bridgeNonce(), 1);

        // Check USDC transferred
        assertEq(usdc.balanceOf(alice), balanceBefore - LOCK_AMOUNT);
        assertEq(usdc.balanceOf(address(custody)), LOCK_AMOUNT);

        // Check pending lock
        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);
        assertEq(lock.amount, LOCK_AMOUNT);
        assertEq(lock.destChainId, DEST_CHAIN_ARBITRUM);
        assertEq(lock.lockedAt, block.timestamp);
        assertEq(lock.lockedBlock, block.number);
        assertFalse(lock.released);
        assertFalse(lock.reversed);
    }

    function test_initiateBridge_emitsBridgeLockConfirmedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit EventsLib.BridgeLockConfirmed(
            0, // nonce
            LOCK_AMOUNT,
            DEST_CHAIN_ARBITRUM,
            block.number,
            blockhash(block.number - 1)
        );

        vm.prank(alice);
        custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);
    }

    function test_initiateBridge_emitsBridgeInitiatedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit BridgeInitiated(0, DEST_CHAIN_ARBITRUM, LOCK_AMOUNT);

        vm.prank(alice);
        custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);
    }

    function test_initiateBridge_sequentialNonces() public {
        vm.startPrank(alice);

        uint256 nonce1 = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);
        uint256 nonce2 = custody.initiateBridge(DEST_CHAIN_BASE, LOCK_AMOUNT, EMPTY_BLS_SIG);
        uint256 nonce3 = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        vm.stopPrank();

        assertEq(nonce1, 0);
        assertEq(nonce2, 1);
        assertEq(nonce3, 2);
        assertEq(custody.bridgeNonce(), 3);
    }

    function test_initiateBridge_transfersUSDCToContract() public {
        uint256 custodyBalanceBefore = usdc.balanceOf(address(custody));

        vm.prank(alice);
        custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        assertEq(usdc.balanceOf(address(custody)), custodyBalanceBefore + LOCK_AMOUNT);
    }

    function test_initiateBridge_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(ErrorsLib.E052_ZeroAmount.selector);
        custody.initiateBridge(DEST_CHAIN_ARBITRUM, 0, EMPTY_BLS_SIG);
    }

    function test_initiateBridge_revertsOnZeroDestChainId() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E053_InvalidDestChainId.selector, 0));
        custody.initiateBridge(0, LOCK_AMOUNT, EMPTY_BLS_SIG);
    }

    function test_initiateBridge_revertsOnCurrentChainId() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E053_InvalidDestChainId.selector, block.chainid));
        custody.initiateBridge(block.chainid, LOCK_AMOUNT, EMPTY_BLS_SIG);
    }

    // ============ MARK RELEASED TESTS ============

    function test_markReleased_happyPath() public {
        // First initiate a bridge
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Mark as released
        bytes32 destTxHash = keccak256("dest_tx_hash");
        custody.markReleased(nonce, destTxHash, EMPTY_BLS_SIG);

        // Check lock is released
        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);
        assertTrue(lock.released);
        assertFalse(lock.reversed);
    }

    function test_markReleased_emitsLockReleasedEvent() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        bytes32 destTxHash = keccak256("dest_tx_hash");

        vm.expectEmit(true, false, false, true);
        emit LockReleased(nonce, destTxHash);

        custody.markReleased(nonce, destTxHash, EMPTY_BLS_SIG);
    }

    function test_markReleased_revertsOnNonexistentLock() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E049_LockNotFound.selector, 999));
        custody.markReleased(999, keccak256("hash"), EMPTY_BLS_SIG);
    }

    function test_markReleased_revertsOnDoubleRelease() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        bytes32 destTxHash = keccak256("dest_tx_hash");
        custody.markReleased(nonce, destTxHash, EMPTY_BLS_SIG);

        // Try to release again
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E045_LockAlreadyReleased.selector, nonce));
        custody.markReleased(nonce, destTxHash, EMPTY_BLS_SIG);
    }

    function test_markReleased_revertsOnReversedLock() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Fast-forward past timeout
        vm.warp(block.timestamp + 1 hours + 1);

        // Reverse the lock
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);

        // Try to mark as released
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E046_LockAlreadyReversed.selector, nonce));
        custody.markReleased(nonce, keccak256("hash"), EMPTY_BLS_SIG);
    }

    // ============ REVERSE LOCK TESTS ============

    function test_reverseLock_happyPathAfterTimeout() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Fast-forward past timeout (1 hour)
        vm.warp(block.timestamp + 1 hours + 1);

        // Reverse the lock
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);

        // Check lock is reversed
        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);
        assertFalse(lock.released);
        assertTrue(lock.reversed);
    }

    function test_reverseLock_emitsLockReversedEvent() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectEmit(true, false, false, false);
        emit LockReversed(nonce);

        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);
    }

    function test_reverseLock_revertsBeforeTimeout() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        uint256 lockedAt = block.timestamp;

        // Try to reverse immediately (before timeout)
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E047_LockTimeoutNotReached.selector,
                nonce,
                lockedAt,
                block.timestamp
            )
        );
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);
    }

    function test_reverseLock_revertsOnDoubleReversal() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 1 hours + 1);

        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);

        // Try to reverse again
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E046_LockAlreadyReversed.selector, nonce));
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);
    }

    function test_reverseLock_revertsOnReleasedLock() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Mark as released first
        custody.markReleased(nonce, keccak256("hash"), EMPTY_BLS_SIG);

        // Fast-forward past timeout
        vm.warp(block.timestamp + 1 hours + 1);

        // Try to reverse
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E045_LockAlreadyReleased.selector, nonce));
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);
    }

    function test_reverseLock_revertsOnInsufficientSignerCount() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 1 hours + 1);

        // Try with only 14 signers (need 15)
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E048_InsufficientSignerCount.selector, 14, 15)
        );
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 14);
    }

    function test_reverseLock_revertsOnNonexistentLock() public {
        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E049_LockNotFound.selector, 999));
        custody.reverseLock(999, EMPTY_BLS_SIG, 15);
    }

    // ============ VIEW FUNCTION TESTS ============

    function test_currentNonce_returnsCorrectValue() public {
        assertEq(custody.currentNonce(), 0);

        vm.prank(alice);
        custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        assertEq(custody.currentNonce(), 1);
    }

    function test_getPendingLock_returnsCorrectData() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);

        assertEq(lock.amount, LOCK_AMOUNT);
        assertEq(lock.destChainId, DEST_CHAIN_ARBITRUM);
        assertEq(lock.lockedAt, block.timestamp);
        assertEq(lock.lockedBlock, block.number);
        assertFalse(lock.released);
        assertFalse(lock.reversed);
    }

    function test_canReverseLock_returnsFalseBeforeTimeout() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        assertFalse(custody.canReverseLock(nonce));
    }

    function test_canReverseLock_returnsTrueAfterTimeout() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 1 hours);

        assertTrue(custody.canReverseLock(nonce));
    }

    function test_canReverseLock_returnsFalseIfReleased() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        custody.markReleased(nonce, keccak256("hash"), EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 1 hours);

        assertFalse(custody.canReverseLock(nonce));
    }

    function test_canReverseLock_returnsFalseIfReversed() public {
        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 1 hours + 1);
        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);

        assertFalse(custody.canReverseLock(nonce));
    }

    function test_canReverseLock_returnsFalseForNonexistentLock() public view {
        assertFalse(custody.canReverseLock(999));
    }

    // ============ FUZZ TESTS ============

    function testFuzz_initiateBridge_variousAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1_000_000e18);

        usdc.mint(alice, amount);

        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, amount, EMPTY_BLS_SIG);

        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);
        assertEq(lock.amount, amount);
    }

    function testFuzz_initiateBridge_variousChainIds(uint256 chainId) public {
        vm.assume(chainId > 0);

        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(chainId, LOCK_AMOUNT, EMPTY_BLS_SIG);

        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);
        assertEq(lock.destChainId, chainId);
    }

    function testFuzz_reverseLock_exactlyAtTimeout(uint256 extraSeconds) public {
        vm.assume(extraSeconds <= 1 days);

        vm.prank(alice);
        uint256 nonce = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Warp to exactly the timeout
        vm.warp(block.timestamp + 1 hours + extraSeconds);

        custody.reverseLock(nonce, EMPTY_BLS_SIG, 15);

        TypesLib.PendingLock memory lock = custody.getPendingLock(nonce);
        assertTrue(lock.reversed);
    }

    // ============ CONSTANTS TESTS ============

    function test_constants_haveCorrectValues() public view {
        assertEq(custody.LOCK_TIMEOUT(), 1 hours);
        assertEq(custody.STANDARD_THRESHOLD(), 11);
        assertEq(custody.REVERSAL_THRESHOLD(), 15);
        assertEq(custody.UPGRADE_TIMELOCK(), 7 days);
        assertEq(custody.EMERGENCY_UPGRADE_TIMELOCK(), 24 hours);
    }

    // ============ MULTIPLE LOCKS TESTS ============

    function test_multipleLocks_independentState() public {
        // Alice initiates lock 0
        vm.prank(alice);
        uint256 nonce0 = custody.initiateBridge(DEST_CHAIN_ARBITRUM, LOCK_AMOUNT, EMPTY_BLS_SIG);

        // Bob initiates lock 1
        vm.prank(bob);
        uint256 nonce1 = custody.initiateBridge(DEST_CHAIN_BASE, LOCK_AMOUNT * 2, EMPTY_BLS_SIG);

        // Release lock 0
        custody.markReleased(nonce0, keccak256("hash0"), EMPTY_BLS_SIG);

        // Lock 1 should still be unreleased
        TypesLib.PendingLock memory lock0 = custody.getPendingLock(nonce0);
        TypesLib.PendingLock memory lock1 = custody.getPendingLock(nonce1);

        assertTrue(lock0.released);
        assertFalse(lock1.released);

        // Amounts should be correct
        assertEq(lock0.amount, LOCK_AMOUNT);
        assertEq(lock1.amount, LOCK_AMOUNT * 2);

        // Dest chains should be correct
        assertEq(lock0.destChainId, DEST_CHAIN_ARBITRUM);
        assertEq(lock1.destChainId, DEST_CHAIN_BASE);
    }

    // ============ UPGRADE TESTS ============

    function test_proposeUpgrade_setsState() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();

        custody.proposeUpgrade(address(newImpl), EMPTY_BLS_SIG);

        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(newImpl));
        assertEq(proposedAt, block.timestamp);
        assertFalse(isEmergency);
    }

    function test_proposeUpgrade_revertsOnZeroAddress() public {
        vm.expectRevert(ErrorsLib.E038_ZeroImplementation.selector);
        custody.proposeUpgrade(address(0), EMPTY_BLS_SIG);
    }

    function test_proposeUpgrade_revertsOnAlreadyPending() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();
        custody.proposeUpgrade(address(newImpl), EMPTY_BLS_SIG);

        L3BridgeCustody anotherImpl = new L3BridgeCustody();
        vm.expectRevert(ErrorsLib.E039_UpgradeAlreadyPending.selector);
        custody.proposeUpgrade(address(anotherImpl), EMPTY_BLS_SIG);
    }

    function test_proposeEmergencyUpgrade_setsEmergencyFlag() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();

        custody.proposeEmergencyUpgrade(address(newImpl), EMPTY_BLS_SIG);

        (, , bool isEmergency) = custody.getPendingUpgrade();
        assertTrue(isEmergency);
    }

    function test_executeUpgrade_revertsBeforeTimelock() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();
        custody.proposeUpgrade(address(newImpl), EMPTY_BLS_SIG);

        uint256 unlockTime = block.timestamp + 7 days;
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E042_UpgradeTimelockActive.selector,
                unlockTime,
                block.timestamp
            )
        );
        custody.executeUpgrade(address(newImpl));
    }

    function test_executeUpgrade_revertsOnNoPending() public {
        vm.expectRevert(ErrorsLib.E040_NoPendingUpgrade.selector);
        custody.executeUpgrade(address(0x123));
    }

    function test_executeUpgrade_revertsOnMismatch() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();
        custody.proposeUpgrade(address(newImpl), EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E041_ImplementationMismatch.selector,
                address(newImpl),
                address(0x123)
            )
        );
        custody.executeUpgrade(address(0x123));
    }

    function test_executeUpgrade_succeedsAfterTimelock() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();
        custody.proposeUpgrade(address(newImpl), EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 7 days + 1);

        custody.executeUpgrade(address(newImpl));

        // Verify upgrade cleared pending state
        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_executeEmergencyUpgrade_succeedsAfter24Hours() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();
        custody.proposeEmergencyUpgrade(address(newImpl), EMPTY_BLS_SIG);

        vm.warp(block.timestamp + 24 hours + 1);

        custody.executeUpgrade(address(newImpl));

        // Verify upgrade cleared pending state
        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    // ============ CANCEL UPGRADE TESTS ============

    function test_cancelUpgrade_clearsPendingUpgrade() public {
        L3BridgeCustody newImpl = new L3BridgeCustody();
        custody.proposeUpgrade(address(newImpl), EMPTY_BLS_SIG);

        // Verify pending upgrade exists
        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(newImpl));

        // Cancel the upgrade
        custody.cancelUpgrade(EMPTY_BLS_SIG);

        // Verify pending upgrade is cleared
        (proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_cancelUpgrade_revertsOnNoPending() public {
        vm.expectRevert(ErrorsLib.E040_NoPendingUpgrade.selector);
        custody.cancelUpgrade(EMPTY_BLS_SIG);
    }

    function test_cancelUpgrade_allowsNewProposalAfterCancel() public {
        L3BridgeCustody impl1 = new L3BridgeCustody();
        L3BridgeCustody impl2 = new L3BridgeCustody();

        // Propose first upgrade
        custody.proposeUpgrade(address(impl1), EMPTY_BLS_SIG);

        // Cancel it
        custody.cancelUpgrade(EMPTY_BLS_SIG);

        // Propose new upgrade (should succeed)
        custody.proposeUpgrade(address(impl2), EMPTY_BLS_SIG);

        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(impl2));
    }
}
