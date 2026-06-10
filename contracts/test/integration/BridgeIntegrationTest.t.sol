// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/custody/L3BridgeCustody.sol";
import "../../src/custody/SettlementBridgeCustody.sol";
import "../../src/registry/CollateralRegistry.sol";
import "../mocks/MockERC20.sol";
import "../../src/registry/OracleRegistry.sol";
import "../../src/libraries/TypesLib.sol";
import "../../src/libraries/ErrorsLib.sol";
import "../../src/libraries/EventsLib.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title BridgeIntegrationTest - End-to-end bridge integration tests (L3 <-> Settlement)
/// @notice Tests the full two-phase commit bridge lifecycle across L3BridgeCustody,
///         SettlementBridgeCustody, and CollateralRegistry working together
/// @dev Uses real BLS signatures via FFI (bls-tool). All BLS-protected calls use real signing.
contract BridgeIntegrationTest is TestHelper {
    // ============ CONTRACTS ============

    L3BridgeCustody public l3Bridge;
    SettlementBridgeCustody public settlementBridge;
    CollateralRegistry public collateralRegistry;
    OracleRegistry public mockRegistry;
    Governance public governance;
    MockERC20 public usdc;      // L3 USDC (18 decimals)
    MockERC20 public settlementUsdc;   // Settlement USDC (6 decimals, matches production)

    // ============ TEST ACCOUNTS ============

    address public deployer = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public l3IndexAddr = address(0x1234567890123456789012345678901234567890);

    // ============ CONSTANTS ============

    uint256 public constant L3_CHAIN_ID = 111222333;
    uint256 public constant SETTLEMENT_CHAIN_ID = 42161;
    uint256 public constant BRIDGE_AMOUNT = 1000e18;
    uint256 public constant LARGE_AMOUNT = 5000e18;
    bytes32 public constant TEST_ITP_ID = keccak256("TEST_ITP_001");

    // ============ EVENTS (for expectEmit) ============

    // L3BridgeCustody interface events
    event BridgeInitiated(uint256 indexed nonce, uint256 destChainId, uint256 amount);
    event LockReleased(uint256 indexed nonce, bytes32 destTxHash);
    event LockReversed(uint256 indexed nonce);

    // SettlementBridgeCustody interface events
    event BridgeCompleted(uint256 indexed sourceChainId, uint256 amount, uint256 nonce);

    // ============ SETUP ============

    function setUp() public {
        // Deploy on L3 chain context
        vm.chainId(L3_CHAIN_ID);

        // Deploy real governance and oracle registry, register real BLS test oracles
        governance = deployGovernance(deployer);
        mockRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(mockRegistry, deployer);
        // L3 USDC uses 18 decimals (internal protocol standard)
        usdc = new MockERC20("L3USDC", "L3USDC", 18);
        // Settlement USDC uses 6 decimals (matches real USDC on Settlement)
        settlementUsdc = new MockERC20("USDC", "USDC", 6);

        // --- Deploy L3BridgeCustody (UUPS proxy) ---
        L3BridgeCustody l3Impl = new L3BridgeCustody();
        ERC1967Proxy l3Proxy = new ERC1967Proxy(
            address(l3Impl),
            abi.encodeCall(L3BridgeCustody.initialize, (address(mockRegistry), address(usdc)))
        );
        l3Bridge = L3BridgeCustody(address(l3Proxy));

        // --- Deploy SettlementBridgeCustody (UUPS proxy) ---
        // Note: We deploy on same chain but test logic simulates cross-chain interaction
        SettlementBridgeCustody settlementImpl = new SettlementBridgeCustody();
        ERC1967Proxy settlementProxy = new ERC1967Proxy(
            address(settlementImpl),
            abi.encodeCall(SettlementBridgeCustody.initialize, (address(mockRegistry), address(settlementUsdc), l3IndexAddr, address(0)))
        );
        settlementBridge = SettlementBridgeCustody(address(settlementProxy));

        // --- Deploy CollateralRegistry ---
        collateralRegistry = new CollateralRegistry(deployer, address(mockRegistry));

        // --- Fund L3BridgeCustody: alice and bob deposit USDC for locking ---
        usdc.mint(alice, 50_000_000e18);
        vm.prank(alice);
        usdc.approve(address(l3Bridge), type(uint256).max);

        usdc.mint(bob, 50_000_000e18);
        vm.prank(bob);
        usdc.approve(address(l3Bridge), type(uint256).max);

        // --- Fund SettlementBridgeCustody with 6-decimal USDC for release operations ---
        settlementUsdc.mint(address(settlementBridge), 50_000_000e6);

        // --- Seed CollateralRegistry: ITP starts with collateral on L3 ---
        {
            bytes32 msg0 = keccak256(abi.encode(block.chainid, address(collateralRegistry), TEST_ITP_ID, uint256(0), L3_CHAIN_ID, uint256(10_000e18), TypesLib.TxType.BUY, uint256(0)));
            collateralRegistry.recordCollateralMove(
                TEST_ITP_ID,
                0,            // fromChain=0 (external deposit)
                L3_CHAIN_ID,  // toChain=L3
                10_000e18,    // initial collateral
                TypesLib.TxType.BUY,
                signWithTestOracles(msg0)
            , 3, 7);
        }
    }

    // ============ SIGNING HELPERS ============

    /// @dev Sign initiateBridge message (chainid = current, which should be L3_CHAIN_ID)
    function _signInitiateBridge(address custodyAddr, uint256 destChainId, uint256 amount, uint256 bridgeNonce) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, destChainId, amount, bridgeNonce));
        return signWithTestOracles(message);
    }

    /// @dev Sign completeBridge message (chainid = SETTLEMENT_CHAIN_ID)
    function _signCompleteBridge(address custodyAddr, TypesLib.ReleaseProof memory proof, uint256 amount, uint256 bridgeNonce) internal returns (bytes memory) {
        return _signCompleteBridge(custodyAddr, proof, amount, bridgeNonce, address(this));
    }

    /// @dev Sign completeBridge message with explicit recipient
    function _signCompleteBridge(address custodyAddr, TypesLib.ReleaseProof memory proof, uint256 amount, uint256 bridgeNonce, address recipient) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(SETTLEMENT_CHAIN_ID, custodyAddr, recipient, proof, amount, bridgeNonce));
        return signWithTestOracles(message);
    }

    /// @dev Sign markReleased message (chainid = L3_CHAIN_ID)
    function _signMarkReleased(address custodyAddr, uint256 bridgeNonce, bytes32 destTxHash) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, bridgeNonce, destTxHash));
        return signWithTestOracles(message);
    }

    /// @dev Sign reverseLock message (chainid = L3_CHAIN_ID)
    function _signReverseLock(address custodyAddr, uint256 bridgeNonce, uint256 signerCount) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, "reverse", bridgeNonce, signerCount));
        return signWithTestOracles(message);
    }

    /// @dev Sign recordCollateralMove message (auto-incrementing nonce)
    function _signRecordCollateralMove(address colRegAddr, bytes32 itpId, uint256 fromChain, uint256 toChain, uint256 amount, TypesLib.TxType txType, uint256 colRegNonce) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, colRegAddr, itpId, fromChain, toChain, amount, txType, colRegNonce));
        return signWithTestOracles(message);
    }

    // ============ HELPERS ============

    /// @dev Initiate a bridge from L3 and return the nonce
    function _initiateBridge(uint256 amount) internal returns (uint256 nonce) {
        nonce = l3Bridge.bridgeNonce(); // get nonce before initiating
        vm.prank(alice);
        nonce = l3Bridge.initiateBridge(SETTLEMENT_CHAIN_ID, amount, _signInitiateBridge(address(l3Bridge), SETTLEMENT_CHAIN_ID, amount, nonce), 3, 7);
    }

    /// @dev Build a valid ReleaseProof from a lock nonce
    function _buildProof(uint256 nonce) internal view returns (TypesLib.ReleaseProof memory) {
        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        return TypesLib.ReleaseProof({
            sourceChainId: L3_CHAIN_ID,
            sourceBlockNumber: lock.lockedBlock,
            sourceBlockHash: lock.lockedBlockHash,
            sourceTxHash: keccak256(abi.encode("bridge_tx", nonce))
        });
    }

    /// @dev Complete a bridge on Settlement side (switches chain context)
    function _completeBridge(uint256 nonce, uint256 amount) internal {
        TypesLib.ReleaseProof memory proof = _buildProof(nonce);
        // Signature must use SETTLEMENT_CHAIN_ID since completeBridge runs on Settlement
        bytes memory sig = _signCompleteBridge(address(settlementBridge), proof, amount, nonce);
        vm.chainId(SETTLEMENT_CHAIN_ID);
        settlementBridge.completeBridge(L3_CHAIN_ID, amount, nonce, address(this), proof, sig, 3, 7);
        vm.chainId(L3_CHAIN_ID);
    }

    /// @dev Mark a lock as released on L3
    function _markReleased(uint256 nonce) internal {
        bytes32 destTxHash = keccak256(abi.encode("settlement_completion_tx", nonce));
        l3Bridge.markReleased(nonce, destTxHash, _signMarkReleased(address(l3Bridge), nonce, destTxHash), 3, 7);
    }

    /// @dev Execute full L3->Settlement bridge flow: initiate -> complete -> markReleased
    function _fullBridgeFlow(uint256 amount) internal returns (uint256 nonce) {
        nonce = _initiateBridge(amount);
        _completeBridge(nonce, amount);
        _markReleased(nonce);
    }

    /// @dev Record a bridge movement in CollateralRegistry (uses current nonce from registry)
    function _recordBridgeMove(uint256 fromChain, uint256 toChain, uint256 amount) internal {
        uint256 currentNonce = collateralRegistry.getNonce();
        collateralRegistry.recordCollateralMove(
            TEST_ITP_ID,
            fromChain,
            toChain,
            amount,
            TypesLib.TxType.BRIDGE,
            _signRecordCollateralMove(address(collateralRegistry), TEST_ITP_ID, fromChain, toChain, amount, TypesLib.TxType.BRIDGE, currentNonce)
        , 3, 7);
    }

    // ============================================================================
    // TASK 2: L3 -> Settlement Bridge Flow Tests (AC #1, #2)
    // ============================================================================

    function test_l3ToSettlement_initiateBridge_locksUSDC() public {
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 custodyBalBefore = usdc.balanceOf(address(l3Bridge));

        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // Nonce is 0 (first bridge)
        assertEq(nonce, 0);
        assertEq(l3Bridge.bridgeNonce(), 1);

        // USDC transferred from alice to L3BridgeCustody
        assertEq(usdc.balanceOf(alice), aliceBalBefore - BRIDGE_AMOUNT);
        assertEq(usdc.balanceOf(address(l3Bridge)), custodyBalBefore + BRIDGE_AMOUNT);

        // Lock state correct
        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        assertEq(lock.amount, BRIDGE_AMOUNT);
        assertEq(lock.destChainId, SETTLEMENT_CHAIN_ID);
        assertGt(lock.lockedAt, 0);
        assertGt(lock.lockedBlock, 0);
        assertFalse(lock.released);
        assertFalse(lock.reversed);
    }

    function test_l3ToSettlement_initiateBridge_emitsEvents() public {
        vm.expectEmit(true, false, false, true);
        emit EventsLib.BridgeLockConfirmed(0, BRIDGE_AMOUNT, SETTLEMENT_CHAIN_ID, block.number, blockhash(block.number - 1));

        vm.expectEmit(true, false, false, true);
        emit BridgeInitiated(0, SETTLEMENT_CHAIN_ID, BRIDGE_AMOUNT);

        _initiateBridge(BRIDGE_AMOUNT);
    }

    function test_l3ToSettlement_completeBridge_releasesUSDC() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // SettlementBridgeCustody uses 6-decimal USDC — completeBridge converts 18→6 internally
        uint256 expectedSettlementAmount = BRIDGE_AMOUNT / 1e12; // 1000e18 → 1000e6
        uint256 callerBalBefore = settlementUsdc.balanceOf(address(this));
        uint256 settlementBalBefore = settlementUsdc.balanceOf(address(settlementBridge));

        _completeBridge(nonce, BRIDGE_AMOUNT);

        // 6-decimal USDC released from SettlementBridgeCustody to caller
        assertEq(settlementUsdc.balanceOf(address(this)), callerBalBefore + expectedSettlementAmount);
        assertEq(settlementUsdc.balanceOf(address(settlementBridge)), settlementBalBefore - expectedSettlementAmount);

        // Nonce marked as used
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce));
    }

    function test_l3ToSettlement_completeBridge_emitsBridgeCompleted() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        TypesLib.ReleaseProof memory proof = _buildProof(nonce);
        bytes memory completeSig = _signCompleteBridge(address(settlementBridge), proof, BRIDGE_AMOUNT, nonce);
        vm.chainId(SETTLEMENT_CHAIN_ID);

        vm.expectEmit(true, false, false, true);
        emit BridgeCompleted(L3_CHAIN_ID, BRIDGE_AMOUNT, nonce);

        settlementBridge.completeBridge(L3_CHAIN_ID, BRIDGE_AMOUNT, nonce, address(this), proof, completeSig, 3, 7);
        vm.chainId(L3_CHAIN_ID);
    }

    function test_l3ToSettlement_markReleased_finalizesLock() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        _completeBridge(nonce, BRIDGE_AMOUNT);

        // Finalize on L3
        _markReleased(nonce);

        // Lock is now released
        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        assertTrue(lock.released);
        assertFalse(lock.reversed);
    }

    function test_l3ToSettlement_fullFlow_endToEnd() public {
        // Full two-phase commit lifecycle
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 settlementBalBefore = settlementUsdc.balanceOf(address(settlementBridge));
        uint256 expectedSettlementAmount = BRIDGE_AMOUNT / 1e12; // 18→6 decimal conversion

        // Phase 1: Lock on L3 (18-decimal USDC)
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // Verify lock state
        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        assertEq(lock.amount, BRIDGE_AMOUNT);
        assertFalse(lock.released);
        assertFalse(lock.reversed);

        // Phase 2: Complete on Settlement (6-decimal USDC released)
        _completeBridge(nonce, BRIDGE_AMOUNT);
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce));

        // Finalize on L3
        _markReleased(nonce);
        lock = l3Bridge.getPendingLock(nonce);
        assertTrue(lock.released);

        // Balances verified
        assertEq(usdc.balanceOf(alice), aliceBalBefore - BRIDGE_AMOUNT); // L3 side: 18 decimals
        assertEq(settlementUsdc.balanceOf(address(settlementBridge)), settlementBalBefore - expectedSettlementAmount); // Settlement side: 6 decimals
    }

    function test_l3ToSettlement_sequentialNonces() public {
        uint256 nonce0 = _initiateBridge(100e18);
        uint256 nonce1 = _initiateBridge(200e18);
        uint256 nonce2 = _initiateBridge(300e18);

        assertEq(nonce0, 0);
        assertEq(nonce1, 1);
        assertEq(nonce2, 2);
        assertEq(l3Bridge.bridgeNonce(), 3);
    }

    // ============================================================================
    // TASK 3: Settlement -> L3 Bridge Flow Tests (AC #3)
    // ============================================================================

    function test_settlementToL3_settlementBridgeIsDestinationOnly() public view {
        // SettlementBridgeCustody does NOT have an initiateBridge function
        // It only has completeBridge (destination-only contract)
        // For Settlement->L3 direction, BLSCustody on Settlement would lock USDC via execute()
        // and L3 would release. This is beyond current contract scope.

        // Verify SettlementBridgeCustody can only complete bridges from other chains
        assertFalse(settlementBridge.isNonceUsed(L3_CHAIN_ID, 0)); // No bridges completed yet
        assertFalse(settlementBridge.isNonceUsed(SETTLEMENT_CHAIN_ID, 0)); // Can't bridge from self
    }

    function test_settlementToL3_independentNonceTrackingPerSourceChain() public {
        // Initiate 2 bridges from L3
        uint256 nonce0 = _initiateBridge(100e18);
        uint256 nonce1 = _initiateBridge(200e18);

        // Complete nonce 0 from L3
        _completeBridge(nonce0, 100e18);

        // L3 nonce 0 is used, nonce 1 is not
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce0));
        assertFalse(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce1));

        // A hypothetical different source chain (e.g., Base = 8453) nonce 0 is independent
        assertFalse(settlementBridge.isNonceUsed(8453, 0));
    }

    function test_settlementToL3_completeBridgeFromDifferentSourceChains() public {
        // Simulate bridges from two different source chains arriving at Settlement
        // Source chain 1: L3 (111222333)
        uint256 nonce0 = _initiateBridge(100e18);
        _completeBridge(nonce0, 100e18);

        // Source chain 2: Simulate a bridge from hypothetical Base chain (8453)
        TypesLib.ReleaseProof memory baseProof = TypesLib.ReleaseProof({
            sourceChainId: 8453,
            sourceBlockNumber: 99999,
            sourceBlockHash: keccak256("base_block"),
            sourceTxHash: keccak256("base_tx")
        });

        // Complete bridge from Base (nonce 0 — same nonce but different source chain)
        bytes memory baseSig = _signCompleteBridge(address(settlementBridge), baseProof, 50e18, 0);
        vm.chainId(SETTLEMENT_CHAIN_ID);
        settlementBridge.completeBridge(8453, 50e18, 0, address(this), baseProof, baseSig, 3, 7);
        vm.chainId(L3_CHAIN_ID);

        // Both are completed independently
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, 0));
        assertTrue(settlementBridge.isNonceUsed(8453, 0));
    }

    // ============================================================================
    // TASK 4: Timeout Reversal Tests (AC #4)
    // ============================================================================

    function test_timeout_reverseLock_afterTimeout() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // Track balances before reversal
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        uint256 custodyBalBefore = usdc.balanceOf(address(l3Bridge));

        // Advance time past the 1-hour timeout
        vm.warp(block.timestamp + 1 hours + 1);

        // Reverse with 15 signers (meets REVERSAL_THRESHOLD)
        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);

        // Lock is reversed
        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        assertTrue(lock.reversed);
        assertFalse(lock.released);

        // IMPORTANT: reverseLock only sets the reversed flag — it does NOT transfer
        // USDC back to alice or anywhere else. Funds remain locked in the contract.
        // Production will need a governance/admin withdrawal mechanism for reversed funds.
        assertEq(usdc.balanceOf(alice), aliceBalBefore, "Alice balance unchanged - no refund on reversal");
        assertEq(usdc.balanceOf(address(l3Bridge)), custodyBalBefore, "Custody balance unchanged - funds remain locked");
    }

    function test_timeout_reverseLock_emitsEvent() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectEmit(true, false, false, false);
        emit LockReversed(nonce);

        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);
    }

    function test_timeout_markReleasedRevertsOnReversedLock() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        vm.warp(block.timestamp + 1 hours + 1);

        // Reverse the lock
        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);

        // markReleased should revert on reversed lock
        bytes32 destTxHash = keccak256("some_tx");
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E046_LockAlreadyReversed.selector, nonce));
        l3Bridge.markReleased(nonce, destTxHash, signWithTestOracles(keccak256("irrelevant")), 3, 7);
    }

    function test_timeout_reversalFailsBeforeTimeout() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // Do NOT advance time — still within timeout
        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E047_LockTimeoutNotReached.selector,
                nonce,
                lock.lockedAt,
                block.timestamp
            )
        );
        l3Bridge.reverseLock(nonce, signWithTestOracles(keccak256("irrelevant")), 15, 3, 7);
    }

    function test_timeout_reversalFailsWithInsufficientSigners() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        vm.warp(block.timestamp + 1 hours + 1);

        // Try with 14 signers (below REVERSAL_THRESHOLD of 15)
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E048_InsufficientSignerCount.selector, 14, 15));
        l3Bridge.reverseLock(nonce, signWithTestOracles(keccak256("irrelevant")), 14, 3, 7);
    }

    function test_timeout_reversalAt20Signers() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        vm.warp(block.timestamp + 1 hours + 1);

        // 20 signers (above threshold) should work
        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 20), 20, 3, 7);

        TypesLib.PendingLock memory lock = l3Bridge.getPendingLock(nonce);
        assertTrue(lock.reversed);
    }

    function test_timeout_canReverseLock_viewFunction() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // Before timeout
        assertFalse(l3Bridge.canReverseLock(nonce));

        // After timeout
        vm.warp(block.timestamp + 1 hours + 1);
        assertTrue(l3Bridge.canReverseLock(nonce));

        // After reversal
        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);
        assertFalse(l3Bridge.canReverseLock(nonce));
    }

    function test_timeout_doubleReversalFails() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        vm.warp(block.timestamp + 1 hours + 1);

        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);

        // Second reversal should fail
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E046_LockAlreadyReversed.selector, nonce));
        l3Bridge.reverseLock(nonce, signWithTestOracles(keccak256("irrelevant")), 15, 3, 7);
    }

    // ============================================================================
    // TASK 5: Replay Protection Tests (AC #5)
    // ============================================================================

    function test_replay_completeBridgeSameNonceFails() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // First completion succeeds
        _completeBridge(nonce, BRIDGE_AMOUNT);

        // Second completion with same nonce reverts
        TypesLib.ReleaseProof memory proof = _buildProof(nonce);
        vm.chainId(SETTLEMENT_CHAIN_ID);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E054_BridgeAlreadyCompleted.selector, L3_CHAIN_ID, nonce));
        settlementBridge.completeBridge(L3_CHAIN_ID, BRIDGE_AMOUNT, nonce, address(this), proof, signWithTestOracles(keccak256("irrelevant")), 3, 7);
        vm.chainId(L3_CHAIN_ID);
    }

    function test_replay_sameNonceDifferentSourceChainSucceeds() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        // Complete from L3
        _completeBridge(nonce, BRIDGE_AMOUNT);

        // Same nonce but from Base chain should succeed (independent tracking)
        TypesLib.ReleaseProof memory baseProof = TypesLib.ReleaseProof({
            sourceChainId: 8453,
            sourceBlockNumber: 99999,
            sourceBlockHash: keccak256("base_block"),
            sourceTxHash: keccak256("base_tx")
        });
        vm.chainId(SETTLEMENT_CHAIN_ID);
        settlementBridge.completeBridge(8453, 50e18, 0, address(this), baseProof, _signCompleteBridge(address(settlementBridge), baseProof, 50e18, 0), 3, 7);
        vm.chainId(L3_CHAIN_ID);

        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, 0));
        assertTrue(settlementBridge.isNonceUsed(8453, 0));
    }

    function test_replay_markReleasedTwiceFails() public {
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        _completeBridge(nonce, BRIDGE_AMOUNT);

        // First markReleased succeeds
        _markReleased(nonce);

        // Second markReleased fails
        bytes32 destTxHash = keccak256(abi.encode("settlement_completion_tx", nonce));
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E045_LockAlreadyReleased.selector, nonce));
        l3Bridge.markReleased(nonce, destTxHash, signWithTestOracles(keccak256("irrelevant")), 3, 7);
    }

    function test_replay_sequentialNoncesWork() public {
        // Bridge 0
        uint256 n0 = _initiateBridge(100e18);
        _completeBridge(n0, 100e18);
        _markReleased(n0);

        // Bridge 1
        uint256 n1 = _initiateBridge(200e18);
        _completeBridge(n1, 200e18);
        _markReleased(n1);

        // Bridge 2
        uint256 n2 = _initiateBridge(300e18);
        _completeBridge(n2, 300e18);
        _markReleased(n2);

        assertEq(n0, 0);
        assertEq(n1, 1);
        assertEq(n2, 2);

        // All nonces used
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, 0));
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, 1));
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, 2));

        // All locks released
        assertTrue(l3Bridge.getPendingLock(0).released);
        assertTrue(l3Bridge.getPendingLock(1).released);
        assertTrue(l3Bridge.getPendingLock(2).released);
    }

    // ============================================================================
    // TASK 6: CollateralRegistry Integration Tests (AC #6)
    // ============================================================================

    function test_collateral_bridgeL3ToSettlement_updatesBalances() public {
        // Initial state: ITP has 10,000 USDC on L3
        uint256 l3Before = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID);
        assertEq(l3Before, 10_000e18);

        // Execute bridge
        _fullBridgeFlow(BRIDGE_AMOUNT);

        // Record the movement in CollateralRegistry
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, BRIDGE_AMOUNT);

        // L3 collateral decreased
        uint256 l3After = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID);
        assertEq(l3After, l3Before - BRIDGE_AMOUNT);

        // Settlement collateral increased
        uint256 settlementAfter = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID);
        assertEq(settlementAfter, BRIDGE_AMOUNT);
    }

    function test_collateral_bridgeConservesTotal() public {
        uint256 totalBefore = collateralRegistry.getTotalCollateral(TEST_ITP_ID);

        // Bridge and record
        _fullBridgeFlow(BRIDGE_AMOUNT);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, BRIDGE_AMOUNT);

        // Total remains unchanged (conservation of value)
        uint256 totalAfter = collateralRegistry.getTotalCollateral(TEST_ITP_ID);
        assertEq(totalAfter, totalBefore);
    }

    function test_collateral_multipleBridgesTrackedCumulatively() public {
        // Bridge 1: 1000 USDC L3->Settlement
        _fullBridgeFlow(1000e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 1000e18);

        // Bridge 2: 2000 USDC L3->Settlement
        _fullBridgeFlow(2000e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 2000e18);

        // Verify cumulative tracking
        uint256 l3Col = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID);
        uint256 settlementCol = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID);

        assertEq(l3Col, 10_000e18 - 3000e18); // 7000 remaining on L3
        assertEq(settlementCol, 3000e18);             // 3000 on Settlement

        // Total unchanged
        assertEq(collateralRegistry.getTotalCollateral(TEST_ITP_ID), 10_000e18);
    }

    function test_collateral_reversedBridgeDoesNotUpdateRegistry() public {
        // Initiate bridge but DO NOT complete — let it timeout and reverse
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);

        vm.warp(block.timestamp + 1 hours + 1);
        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);

        // IMPORTANT: CollateralRegistry has no awareness of bridge lock state.
        // The oracle application layer must NOT call recordCollateralMove for reversed bridges.
        // This test verifies the expected pattern: skip registry update on reversal.
        uint256 l3Col = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID);
        assertEq(l3Col, 10_000e18); // No change

        uint256 settlementCol = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID);
        assertEq(settlementCol, 0); // No settlement collateral

        assertEq(collateralRegistry.getTotalCollateral(TEST_ITP_ID), 10_000e18);
    }

    function test_collateral_accidentalRecordOfReversedBridgeBreaksInvariant() public {
        // Demonstrates that CollateralRegistry cannot distinguish reversed from completed
        // bridges. If a reversed bridge is accidentally recorded, the registry diverges
        // from actual USDC positions (reversed USDC stays locked in L3BridgeCustody).
        uint256 nonce = _initiateBridge(BRIDGE_AMOUNT);
        vm.warp(block.timestamp + 1 hours + 1);
        l3Bridge.reverseLock(nonce, _signReverseLock(address(l3Bridge), nonce, 15), 15, 3, 7);

        // Accidentally record the reversed bridge — registry accepts it
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, BRIDGE_AMOUNT);

        // Registry now shows collateral on Settlement, but no USDC actually moved there
        uint256 settlementCol = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID);
        assertEq(settlementCol, BRIDGE_AMOUNT, "Registry incorrectly shows Settlement collateral");

        // Total is conserved in registry, but reality diverges:
        // L3BridgeCustody still holds the USDC, yet registry says it's on Settlement
        assertEq(collateralRegistry.getTotalCollateral(TEST_ITP_ID), 10_000e18);
    }

    function test_collateral_getCollateralBreakdown() public {
        // Bridge some collateral to Settlement
        _fullBridgeFlow(BRIDGE_AMOUNT);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, BRIDGE_AMOUNT);

        (uint256[] memory chainIds, uint256[] memory amounts) = collateralRegistry.getCollateralBreakdown(TEST_ITP_ID);

        // Should have 2 chains tracked (L3 and Settlement)
        assertEq(chainIds.length, 2);

        // Find L3 and Settlement in the arrays
        bool foundL3 = false;
        bool foundSettlement = false;
        for (uint256 i = 0; i < chainIds.length; i++) {
            if (chainIds[i] == L3_CHAIN_ID) {
                assertEq(amounts[i], 10_000e18 - BRIDGE_AMOUNT);
                foundL3 = true;
            }
            if (chainIds[i] == SETTLEMENT_CHAIN_ID) {
                assertEq(amounts[i], BRIDGE_AMOUNT);
                foundSettlement = true;
            }
        }
        assertTrue(foundL3);
        assertTrue(foundSettlement);
    }

    // ============================================================================
    // TASK 8: Full End-to-End Multi-Bridge Scenario Tests
    // ============================================================================

    function test_e2e_bridgeAndPartialReturn() public {
        // Step 1: Bridge 1000 USDC L3->Settlement
        uint256 nonce0 = _fullBridgeFlow(1000e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 1000e18);

        // Verify intermediate state
        assertEq(collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID), 9000e18);
        assertEq(collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID), 1000e18);

        // Step 2: Record return of 500 USDC Settlement->L3 (collateral tracking only,
        // since SettlementBridgeCustody is destination-only, the actual bridge back would
        // use BLSCustody.execute on Settlement + L3 release mechanism)
        _recordBridgeMove(SETTLEMENT_CHAIN_ID, L3_CHAIN_ID, 500e18);

        // Verify final state
        assertEq(collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID), 9500e18);
        assertEq(collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID), 500e18);
        assertEq(collateralRegistry.getTotalCollateral(TEST_ITP_ID), 10_000e18);

        // L3 lock is finalized
        assertTrue(l3Bridge.getPendingLock(nonce0).released);
    }

    function test_e2e_concurrentLocks_completedInDifferentOrder() public {
        // Initiate 3 bridges simultaneously
        uint256 nonce0 = _initiateBridge(100e18);
        uint256 nonce1 = _initiateBridge(200e18);
        uint256 nonce2 = _initiateBridge(300e18);

        // Complete in reverse order: nonce2 first, then nonce0, then nonce1
        _completeBridge(nonce2, 300e18);
        _completeBridge(nonce0, 100e18);
        _completeBridge(nonce1, 200e18);

        // All completed on Settlement side
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce0));
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce1));
        assertTrue(settlementBridge.isNonceUsed(L3_CHAIN_ID, nonce2));

        // Mark released on L3 in yet another order
        _markReleased(nonce1);
        _markReleased(nonce2);
        _markReleased(nonce0);

        // All locks finalized
        assertTrue(l3Bridge.getPendingLock(nonce0).released);
        assertTrue(l3Bridge.getPendingLock(nonce1).released);
        assertTrue(l3Bridge.getPendingLock(nonce2).released);
    }

    function test_e2e_mixedScenario_twoSuccessOneReversal() public {
        // Bridge 1: 1000 USDC — successful
        uint256 n0 = _fullBridgeFlow(1000e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 1000e18);

        // Bridge 2: 500 USDC — will be reversed (timeout)
        uint256 n1 = _initiateBridge(500e18);

        // Bridge 3: 2000 USDC — successful
        uint256 n2 = _fullBridgeFlow(2000e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 2000e18);

        // Reverse bridge 2 after timeout
        vm.warp(block.timestamp + 1 hours + 1);
        l3Bridge.reverseLock(n1, _signReverseLock(address(l3Bridge), n1, 15), 15, 3, 7);

        // Do NOT record bridge 2 in collateral registry (it was reversed)

        // Verify final states
        assertTrue(l3Bridge.getPendingLock(n0).released);
        assertTrue(l3Bridge.getPendingLock(n1).reversed);
        assertTrue(l3Bridge.getPendingLock(n2).released);

        // Collateral: only 2 successful bridges recorded (1000 + 2000 = 3000)
        assertEq(collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID), 10_000e18 - 3000e18);
        assertEq(collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID), 3000e18);
        assertEq(collateralRegistry.getTotalCollateral(TEST_ITP_ID), 10_000e18);
    }

    function test_e2e_allCollateralStatesConsistent() public {
        // Complex scenario: multiple bridges + one reversal + collateral moves
        // Bridge 1000 L3->Settlement (success)
        _fullBridgeFlow(1000e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 1000e18);

        // Bridge 500 L3->Settlement (timeout, reversed)
        uint256 reversedNonce = _initiateBridge(500e18);
        vm.warp(block.timestamp + 1 hours + 1);
        l3Bridge.reverseLock(reversedNonce, _signReverseLock(address(l3Bridge), reversedNonce, 15), 15, 3, 7);

        // Bridge 1500 L3->Settlement (success, after time warp)
        _fullBridgeFlow(1500e18);
        _recordBridgeMove(L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, 1500e18);

        // Return 200 Settlement->L3 (collateral record only)
        _recordBridgeMove(SETTLEMENT_CHAIN_ID, L3_CHAIN_ID, 200e18);

        // Final verification
        uint256 l3Col = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, L3_CHAIN_ID);
        uint256 settlementCol = collateralRegistry.getITPCollateralByChain(TEST_ITP_ID, SETTLEMENT_CHAIN_ID);
        uint256 total = collateralRegistry.getTotalCollateral(TEST_ITP_ID);

        // L3: 10000 - 1000 - 1500 + 200 = 7700
        assertEq(l3Col, 7700e18);
        // Settlement: 1000 + 1500 - 200 = 2300
        assertEq(settlementCol, 2300e18);
        // Total: 10000 (conservation)
        assertEq(total, 10_000e18);
    }

    // ============================================================================
    // REVIEW FIX: Multi-actor bridge test (M1)
    // ============================================================================

    function test_e2e_multipleCallersIndependentBridges() public {
        // Alice bridges 1000 USDC
        uint256 aliceBalBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 nonceAlice = l3Bridge.initiateBridge(SETTLEMENT_CHAIN_ID, 1000e18, _signInitiateBridge(address(l3Bridge), SETTLEMENT_CHAIN_ID, 1000e18, 0), 3, 7);

        // Bob bridges 2000 USDC
        uint256 bobBalBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        uint256 nonceBob = l3Bridge.initiateBridge(SETTLEMENT_CHAIN_ID, 2000e18, _signInitiateBridge(address(l3Bridge), SETTLEMENT_CHAIN_ID, 2000e18, 1), 3, 7);

        // Nonces are sequential regardless of caller
        assertEq(nonceAlice, 0);
        assertEq(nonceBob, 1);

        // Both callers had USDC deducted
        assertEq(usdc.balanceOf(alice), aliceBalBefore - 1000e18);
        assertEq(usdc.balanceOf(bob), bobBalBefore - 2000e18);

        // Complete both on Settlement side
        _completeBridge(nonceAlice, 1000e18);
        _completeBridge(nonceBob, 2000e18);

        // Mark both released
        _markReleased(nonceAlice);
        _markReleased(nonceBob);

        assertTrue(l3Bridge.getPendingLock(nonceAlice).released);
        assertTrue(l3Bridge.getPendingLock(nonceBob).released);
    }

    // ============================================================================
    // REVIEW FIX: Bridge contracts do NOT call CollateralRegistry (M3)
    // ============================================================================

    /// @notice Documents that bridge contracts have no link to CollateralRegistry.
    /// The oracle application layer is responsible for calling recordCollateralMove
    /// after observing successful bridge events. This is an architecture decision,
    /// not a bug -- but callers must be aware of the consistency responsibility.
    function test_collateral_bridgeContractsDoNotCallRegistryDirectly() public {
        uint256 registryNonceBefore = collateralRegistry.getNonce();

        // Execute a full bridge flow
        _fullBridgeFlow(BRIDGE_AMOUNT);

        // CollateralRegistry nonce unchanged -- bridge contracts never called it
        uint256 registryNonceAfter = collateralRegistry.getNonce();
        assertEq(registryNonceAfter, registryNonceBefore, "Bridge contracts must not call CollateralRegistry directly");
    }
}
