// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/custody/ArbBridgeCustody.sol";
import "../src/mocks/MockERC20.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "../src/libraries/DecimalLib.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title ArbBridgeCustodyTest - Comprehensive tests for ArbBridgeCustody
/// @notice Tests bridge completion, cross-chain ITP purchase, and edge cases
contract ArbBridgeCustodyTest is TestHelper {
    ArbBridgeCustody public custody;
    ArbBridgeCustody public implementation;
    IssuerRegistry public mockRegistry;
    Governance public governance;
    MockERC20 public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public l3IndexAddr = address(0x1234567890123456789012345678901234567890);

    // Chain IDs
    uint256 public constant L3_CHAIN_ID = 111222333;
    uint256 public constant ARB_CHAIN_ID = 42161;
    uint256 public constant BASE_CHAIN_ID = 8453;

    // Test amounts (6-decimal USDC for inputs, 18-decimal for internal)
    // 1000 USDC in 6 decimals = 1000 * 10^6 = 1,000,000,000
    uint256 public constant ORDER_AMOUNT_6DEC = 500 * 1e6; // 500 USDC in 6 decimals
    uint256 public constant ORDER_AMOUNT_INTERNAL = 500 * 1e18; // 500 USDC in 18 decimals
    // For completeBridge: amount is 18-decimal (coming from L3)
    uint256 public constant RELEASE_AMOUNT_INTERNAL = 1000 * 1e18; // 1000 USDC internal
    uint256 public constant RELEASE_AMOUNT_6DEC = 1000 * 1e6; // 1000 USDC in 6 dec (actual transfer)
    // Legacy names for backward compatibility in some tests
    uint256 public constant RELEASE_AMOUNT = RELEASE_AMOUNT_INTERNAL;
    uint256 public constant ORDER_AMOUNT = ORDER_AMOUNT_6DEC;
    // No dummy BLS sig — all signatures are real via FFI

    // Test ITP
    bytes32 public constant TEST_ITP_ID = keccak256("TEST_ITP");

    // Events from interface
    event BridgeCompleted(uint256 indexed sourceChainId, uint256 amount, uint256 nonce);
    event CrossChainOrderCreated(
        uint256 indexed orderId,
        bytes32 indexed itpId,
        address indexed user,
        uint256 amount
    );

    function setUp() public {
        // Set Arbitrum chain ID for testing
        vm.chainId(ARB_CHAIN_ID);

        // Deploy real governance and issuer registry via UUPS proxy
        governance = deployGovernance(address(this));
        mockRegistry = deployIssuerRegistry(address(governance));
        // CRITICAL: Deploy USDC with 6 decimals (real USDC format) for Arbitrum side
        usdc = new MockERC20("USDC", "USDC", 6);

        // Deploy implementation
        implementation = new ArbBridgeCustody();

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(ArbBridgeCustody.initialize, (address(mockRegistry), address(usdc), l3IndexAddr, address(0)))
        );

        custody = ArbBridgeCustody(address(proxy));

        // Register 3 real BLS test issuers and set aggregated pubkey
        registerTestIssuersWithBLS(mockRegistry, address(this));

        // Fund custody contract for release tests (6-decimal amounts)
        usdc.mint(address(custody), 10_000_000 * 1e6); // 10M USDC

        // Fund test accounts for cross-chain buy tests (6-decimal amounts)
        usdc.mint(alice, 10_000_000 * 1e6);
        usdc.mint(bob, 10_000_000 * 1e6);
        usdc.mint(address(this), 10_000_000 * 1e6);

        // Approve custody to spend USDC
        vm.prank(alice);
        usdc.approve(address(custody), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(custody), type(uint256).max);

        usdc.approve(address(custody), type(uint256).max);
    }

    // ============ HELPER FUNCTIONS ============

    function _createValidProof(uint256 sourceChainId) internal pure returns (TypesLib.ReleaseProof memory) {
        return TypesLib.ReleaseProof({
            sourceChainId: sourceChainId,
            sourceBlockNumber: 12345,
            sourceBlockHash: keccak256("block_hash"),
            sourceTxHash: keccak256("tx_hash")
        });
    }

    /// @notice Sign a completeBridge call with real BLS signature
    function _signCompleteBridge(
        TypesLib.ReleaseProof memory proof,
        uint256 amount,
        uint256 nonce
    ) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(custody), proof, amount, nonce));
        return signWithTestIssuers(message);
    }

    /// @notice Sign a proposeUpgrade call with real BLS signature
    function _signProposeUpgrade(address newImpl) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(custody), "proposeUpgrade", newImpl));
        return signWithTestIssuers(message);
    }

    /// @notice Sign a proposeEmergencyUpgrade call with real BLS signature
    function _signProposeEmergencyUpgrade(address newImpl) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(custody), "proposeEmergencyUpgrade", newImpl));
        return signWithTestIssuers(message);
    }

    /// @notice Sign a cancelUpgrade call with real BLS signature
    function _signCancelUpgrade(address pendingImpl) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(custody), "cancelUpgrade", pendingImpl));
        return signWithTestIssuers(message);
    }

    // ============ INITIALIZATION TESTS ============

    function test_initialize_setsCorrectValues() public view {
        assertEq(address(custody.issuerRegistry()), address(mockRegistry));
        assertEq(address(custody.usdc()), address(usdc));
        assertEq(custody.l3IndexContract(), l3IndexAddr);
        assertEq(custody.crossChainOrderId(), 0);
    }

    function test_initialize_revertsOnZeroIssuerRegistry() public {
        ArbBridgeCustody impl = new ArbBridgeCustody();
        vm.expectRevert(ErrorsLib.E043_ZeroIssuerRegistry.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(ArbBridgeCustody.initialize, (address(0), address(usdc), l3IndexAddr, address(0)))
        );
    }

    function test_initialize_revertsOnZeroUSDC() public {
        ArbBridgeCustody impl = new ArbBridgeCustody();
        vm.expectRevert(ErrorsLib.E050_ZeroUSDCAddress.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(ArbBridgeCustody.initialize, (address(mockRegistry), address(0), l3IndexAddr, address(0)))
        );
    }

    function test_initialize_revertsOnZeroL3Index() public {
        ArbBridgeCustody impl = new ArbBridgeCustody();
        vm.expectRevert(ErrorsLib.E056_ZeroL3IndexAddress.selector);
        new ERC1967Proxy(
            address(impl),
            abi.encodeCall(ArbBridgeCustody.initialize, (address(mockRegistry), address(usdc), address(0), address(0)))
        );
    }

    // ============ COMPLETE BRIDGE TESTS ============

    function test_completeBridge_happyPath() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        uint256 callerBalanceBefore = usdc.balanceOf(address(this));
        uint256 custodyBalanceBefore = usdc.balanceOf(address(custody));

        // completeBridge receives 18-decimal internal amount from L3
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT_INTERNAL, nonce, proof, _signCompleteBridge(proof, RELEASE_AMOUNT_INTERNAL, nonce), 3, 7);

        // Check nonce is marked as used
        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, nonce));

        // Check USDC transferred to caller (6-decimal amount, converted from 18-decimal)
        // 1000 * 1e18 internal → 1000 * 1e6 actual USDC transfer
        assertEq(usdc.balanceOf(address(this)), callerBalanceBefore + RELEASE_AMOUNT_6DEC);
        assertEq(usdc.balanceOf(address(custody)), custodyBalanceBefore - RELEASE_AMOUNT_6DEC);
    }

    function test_completeBridge_emitsBridgeCompletedEvent() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        vm.expectEmit(true, false, false, true);
        emit BridgeCompleted(L3_CHAIN_ID, RELEASE_AMOUNT, nonce);

        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, nonce, proof, _signCompleteBridge(proof, RELEASE_AMOUNT, nonce), 3, 7);
    }

    function test_completeBridge_emitsEventsLibBridgeCompletedEvent() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        vm.expectEmit(true, true, false, true);
        emit EventsLib.BridgeCompleted(L3_CHAIN_ID, nonce, RELEASE_AMOUNT, proof.sourceTxHash);

        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, nonce, proof, _signCompleteBridge(proof, RELEASE_AMOUNT, nonce), 3, 7);
    }

    function test_completeBridge_replayProtection_revertsOnSameNonce() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        // Complete bridge first time
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, nonce, proof, _signCompleteBridge(proof, RELEASE_AMOUNT, nonce), 3, 7);

        // Try to complete again (replay attack) — reverts before BLS check, any bytes work
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E054_BridgeAlreadyCompleted.selector, L3_CHAIN_ID, nonce)
        );
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, nonce, proof, new bytes(64), 3, 7);
    }

    function test_completeBridge_differentSourceChainsCanUseSameNonce() public {
        uint256 nonce = 0;

        // Complete from L3
        TypesLib.ReleaseProof memory proofL3 = _createValidProof(L3_CHAIN_ID);
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, nonce, proofL3, _signCompleteBridge(proofL3, RELEASE_AMOUNT, nonce), 3, 7);

        // Complete from Base with same nonce (should succeed)
        TypesLib.ReleaseProof memory proofBase = _createValidProof(BASE_CHAIN_ID);
        custody.completeBridge(BASE_CHAIN_ID, RELEASE_AMOUNT, nonce, proofBase, _signCompleteBridge(proofBase, RELEASE_AMOUNT, nonce), 3, 7);

        // Both nonces should be marked used for their respective chains
        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, nonce));
        assertTrue(custody.isNonceUsed(BASE_CHAIN_ID, nonce));
    }

    function test_completeBridge_revertsOnZeroSourceChainId() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(0);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E055_InvalidSourceChainId.selector, 0));
        custody.completeBridge(0, RELEASE_AMOUNT, 0, proof, new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_completeBridge_revertsOnCurrentChainId() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(ARB_CHAIN_ID);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E055_InvalidSourceChainId.selector, ARB_CHAIN_ID));
        custody.completeBridge(ARB_CHAIN_ID, RELEASE_AMOUNT, 0, proof, new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_completeBridge_revertsOnInvalidProof_zeroBlockHash() public {
        TypesLib.ReleaseProof memory proof = TypesLib.ReleaseProof({
            sourceChainId: L3_CHAIN_ID,
            sourceBlockNumber: 12345,
            sourceBlockHash: bytes32(0),
            sourceTxHash: keccak256("tx_hash")
        });

        vm.expectRevert(ErrorsLib.E057_InvalidProof.selector);
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, 0, proof, new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_completeBridge_revertsOnInvalidProof_zeroTxHash() public {
        TypesLib.ReleaseProof memory proof = TypesLib.ReleaseProof({
            sourceChainId: L3_CHAIN_ID,
            sourceBlockNumber: 12345,
            sourceBlockHash: keccak256("block_hash"),
            sourceTxHash: bytes32(0)
        });

        vm.expectRevert(ErrorsLib.E057_InvalidProof.selector);
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, 0, proof, new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_completeBridge_revertsOnProofChainMismatch() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(BASE_CHAIN_ID); // Proof says Base

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E055_InvalidSourceChainId.selector, BASE_CHAIN_ID));
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, 0, proof, new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_completeBridge_zeroAmountAllowed() public {
        // Zero amount is valid - it just marks the nonce as used without transfer
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        uint256 callerBalanceBefore = usdc.balanceOf(address(this));

        custody.completeBridge(L3_CHAIN_ID, 0, nonce, proof, _signCompleteBridge(proof, 0, nonce), 3, 7);

        // Nonce should be marked used
        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, nonce));

        // No USDC transferred
        assertEq(usdc.balanceOf(address(this)), callerBalanceBefore);
    }

    function test_completeBridge_convertsDecimalsCorrectly() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        // Internal amount: 100.5 USDC = 100.5 * 1e18 = 100_500_000_000_000_000_000
        uint256 internalAmount = 100_500_000_000_000_000_000;
        // Expected USDC transfer: 100.5 USDC = 100.5 * 1e6 = 100_500_000
        uint256 expectedUsdcTransfer = 100_500_000;

        uint256 callerBalanceBefore = usdc.balanceOf(address(this));

        custody.completeBridge(L3_CHAIN_ID, internalAmount, nonce, proof, _signCompleteBridge(proof, internalAmount, nonce), 3, 7);

        // Verify 6-decimal USDC was transferred
        assertEq(usdc.balanceOf(address(this)), callerBalanceBefore + expectedUsdcTransfer);
    }

    function test_completeBridge_dustTruncation() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        // Internal amount with dust: 100 USDC + 999,999,999,999 wei (max dust)
        uint256 internalWithDust = 100 * 1e18 + 999_999_999_999;
        // Expected: only 100 USDC transferred (dust truncated)
        uint256 expectedUsdcTransfer = 100 * 1e6;

        uint256 callerBalanceBefore = usdc.balanceOf(address(this));

        custody.completeBridge(L3_CHAIN_ID, internalWithDust, nonce, proof, _signCompleteBridge(proof, internalWithDust, nonce), 3, 7);

        // Dust should be truncated
        assertEq(usdc.balanceOf(address(this)), callerBalanceBefore + expectedUsdcTransfer);
    }

    function test_completeBridge_verySmallAmountBecomes0() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);
        uint256 nonce = 0;

        // Internal amount less than 1e12 converts to 0 USDC
        uint256 verySmallInternal = 999_999_999_999; // Less than 0.000001 USDC

        uint256 callerBalanceBefore = usdc.balanceOf(address(this));

        custody.completeBridge(L3_CHAIN_ID, verySmallInternal, nonce, proof, _signCompleteBridge(proof, verySmallInternal, nonce), 3, 7);

        // No USDC transferred (amount converted to 0)
        assertEq(usdc.balanceOf(address(this)), callerBalanceBefore);
        // But nonce is still marked used
        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, nonce));
    }

    // ============ BUY ITP FROM ARBITRUM TESTS ============

    function test_buyITPFromArbitrum_happyPath() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        // User provides 6-decimal USDC amount
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT_6DEC, 1e18, 1, deadline);

        // Check order ID
        assertEq(orderId, 0);
        assertEq(custody.currentOrderId(), 1);

        // Check USDC transferred to custody (6-decimal transfer)
        // Alice started with 10M USDC (6 dec), now has 10M - 500 USDC
        assertEq(usdc.balanceOf(alice), 10_000_000 * 1e6 - ORDER_AMOUNT_6DEC);

        // Verify order stores 18-decimal internal amount
        TypesLib.CrossChainOrder memory order = custody.getCrossChainOrder(orderId);
        assertEq(order.amount, ORDER_AMOUNT_INTERNAL); // 500 * 1e18
    }

    function test_buyITPFromArbitrum_emitsCrossChainOrderCreatedEvent() public {
        uint256 deadline = block.timestamp + 1 hours;

        // Event emits 18-decimal internal amount
        vm.expectEmit(true, true, true, true);
        emit CrossChainOrderCreated(0, TEST_ITP_ID, alice, ORDER_AMOUNT_INTERNAL);

        vm.prank(alice);
        // User provides 6-decimal USDC
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT_6DEC, 1e18, 1, deadline);
    }

    function test_buyITPFromArbitrum_sequentialOrderIds() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(alice);
        uint256 orderId1 = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 0, deadline);
        uint256 orderId2 = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);
        uint256 orderId3 = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 2, deadline);
        vm.stopPrank();

        assertEq(orderId1, 0);
        assertEq(orderId2, 1);
        assertEq(orderId3, 2);
        assertEq(custody.currentOrderId(), 3);
    }

    function test_buyITPFromArbitrum_revertsOnZeroAmount() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        vm.expectRevert(ErrorsLib.E059_CrossChainOrderZeroAmount.selector);
        custody.buyITPFromArbitrum(TEST_ITP_ID, 0, 1e18, 1, deadline);
    }

    function test_buyITPFromArbitrum_revertsOnAmountBelowMinimum() public {
        uint256 deadline = block.timestamp + 1 hours;

        // MIN_USDC_AMOUNT = 1000 (0.001 USDC in 6 decimals)
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E07F_UsdcAmountTooSmall.selector, 999, 1000)
        );
        custody.buyITPFromArbitrum(TEST_ITP_ID, 999, 1e18, 1, deadline);
    }

    function test_buyITPFromArbitrum_minimumAmountAccepted() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        // Exactly minimum: 1000 (0.001 USDC)
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, 1000, 1e18, 1, deadline);

        TypesLib.CrossChainOrder memory order = custody.getCrossChainOrder(orderId);
        // 1000 (6 dec) -> 1000 * 1e12 = 1e15 (18 dec)
        assertEq(order.amount, 1e15);
    }

    function test_buyITPFromArbitrum_revertsOnInvalidSlippageTier_3() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E011_InvalidSlippageTier.selector, 3));
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 3, deadline);
    }

    function test_buyITPFromArbitrum_revertsOnInvalidSlippageTier_max() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E011_InvalidSlippageTier.selector, type(uint256).max));
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, type(uint256).max, deadline);
    }

    function test_buyITPFromArbitrum_slippageTier0_valid() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 0, deadline);

        assertEq(orderId, 0);
    }

    function test_buyITPFromArbitrum_slippageTier2_valid() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 2, deadline);

        assertEq(orderId, 0);
    }

    function test_buyITPFromArbitrum_revertsOnExpiredDeadline() public {
        uint256 deadline = block.timestamp; // Exactly now - expired

        uint256 minDeadline = block.timestamp + 1;
        uint256 maxDeadline = block.timestamp + 24 hours;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E058_InvalidDeadline.selector, deadline, minDeadline, maxDeadline)
        );
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);
    }

    function test_buyITPFromArbitrum_revertsOnPastDeadline() public {
        uint256 deadline = block.timestamp - 1; // In the past

        uint256 minDeadline = block.timestamp + 1;
        uint256 maxDeadline = block.timestamp + 24 hours;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E058_InvalidDeadline.selector, deadline, minDeadline, maxDeadline)
        );
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);
    }

    function test_buyITPFromArbitrum_revertsOnDeadlineTooFar() public {
        uint256 deadline = block.timestamp + 24 hours + 1; // Just over 24h

        uint256 minDeadline = block.timestamp + 1;
        uint256 maxDeadline = block.timestamp + 24 hours;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E058_InvalidDeadline.selector, deadline, minDeadline, maxDeadline)
        );
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);
    }

    function test_buyITPFromArbitrum_deadlineExactly24hAllowed() public {
        uint256 deadline = block.timestamp + 24 hours; // Exactly 24h - should be valid

        vm.prank(alice);
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);

        assertEq(orderId, 0);
    }

    function test_buyITPFromArbitrum_deadline1SecondValid() public {
        uint256 deadline = block.timestamp + 1; // Minimum valid deadline

        vm.prank(alice);
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);

        assertEq(orderId, 0);
    }

    // ============ VIEW FUNCTION TESTS ============

    function test_isNonceUsed_returnsFalseForUnused() public view {
        assertFalse(custody.isNonceUsed(L3_CHAIN_ID, 0));
        assertFalse(custody.isNonceUsed(L3_CHAIN_ID, 999));
        assertFalse(custody.isNonceUsed(BASE_CHAIN_ID, 0));
    }

    function test_isNonceUsed_returnsTrueForUsed() public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);

        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, 0, proof, _signCompleteBridge(proof, RELEASE_AMOUNT, 0), 3, 7);

        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, 0));
        assertFalse(custody.isNonceUsed(L3_CHAIN_ID, 1)); // Other nonces still unused
    }

    function test_l3IndexContract_returnsCorrectAddress() public view {
        assertEq(custody.l3IndexContract(), l3IndexAddr);
    }

    function test_currentOrderId_startsAtZero() public view {
        assertEq(custody.currentOrderId(), 0);
    }

    function test_currentOrderId_incrementsAfterOrder() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);

        assertEq(custody.currentOrderId(), 1);
    }

    // ============ FUZZ TESTS ============

    function testFuzz_completeBridge_variousAmounts(uint256 internalAmount) public {
        // Internal amounts are 18 decimals
        vm.assume(internalAmount <= 1_000_000 * 1e18);

        // Convert to 6-decimal USDC to ensure custody has enough
        uint256 usdcAmount = DecimalLib.toUsdc(internalAmount);
        usdc.mint(address(custody), usdcAmount);

        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);

        custody.completeBridge(L3_CHAIN_ID, internalAmount, 0, proof, _signCompleteBridge(proof, internalAmount, 0), 3, 7);

        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, 0));
    }

    function testFuzz_completeBridge_variousNonces(uint256 nonce) public {
        TypesLib.ReleaseProof memory proof = _createValidProof(L3_CHAIN_ID);

        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, nonce, proof, _signCompleteBridge(proof, RELEASE_AMOUNT, nonce), 3, 7);

        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, nonce));
    }

    function testFuzz_completeBridge_variousChainIds(uint256 chainId) public {
        vm.assume(chainId > 0 && chainId != ARB_CHAIN_ID);

        TypesLib.ReleaseProof memory proof = _createValidProof(chainId);

        custody.completeBridge(chainId, RELEASE_AMOUNT, 0, proof, _signCompleteBridge(proof, RELEASE_AMOUNT, 0), 3, 7);

        assertTrue(custody.isNonceUsed(chainId, 0));
    }

    function testFuzz_buyITPFromArbitrum_variousAmounts(uint256 usdcAmount6dec) public {
        // Amount is in 6 decimals, must be >= minimum (1000) and reasonable
        vm.assume(usdcAmount6dec >= 1000 && usdcAmount6dec <= 1_000_000 * 1e6);

        usdc.mint(alice, usdcAmount6dec);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, usdcAmount6dec, 1e18, 1, deadline);

        assertEq(orderId, 0);

        // Verify stored amount is 18 decimals
        TypesLib.CrossChainOrder memory order = custody.getCrossChainOrder(orderId);
        assertEq(order.amount, DecimalLib.toInternal(usdcAmount6dec));
    }

    function testFuzz_buyITPFromArbitrum_variousDeadlines(uint256 deadlineOffset) public {
        vm.assume(deadlineOffset > 0 && deadlineOffset <= 24 hours);

        uint256 deadline = block.timestamp + deadlineOffset;

        vm.prank(alice);
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT, 1e18, 1, deadline);

        assertEq(orderId, 0);
    }

    // ============ CONSTANTS TESTS ============

    function test_constants_haveCorrectValues() public view {
        assertEq(custody.MAX_DEADLINE_DURATION(), 24 hours);
        assertEq(custody.MAX_SLIPPAGE_TIER(), 2);
        assertEq(custody.STANDARD_THRESHOLD(), 11);
        assertEq(custody.UPGRADE_TIMELOCK(), 7 days);
        assertEq(custody.EMERGENCY_UPGRADE_TIMELOCK(), 24 hours);
        assertEq(custody.MIN_USDC_AMOUNT(), 1000); // 0.001 USDC in 6 decimals
    }

    // ============ UPGRADE TESTS ============

    function test_proposeUpgrade_setsState() public {
        ArbBridgeCustody newImpl = new ArbBridgeCustody();

        custody.proposeUpgrade(address(newImpl), _signProposeUpgrade(address(newImpl)), 3, 7);

        (address proposedImpl, uint256 proposedAt, bool isEmergency) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(newImpl));
        assertEq(proposedAt, block.timestamp);
        assertFalse(isEmergency);
    }

    function test_proposeUpgrade_revertsOnZeroAddress() public {
        vm.expectRevert(ErrorsLib.E038_ZeroImplementation.selector);
        custody.proposeUpgrade(address(0), new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_proposeUpgrade_revertsOnAlreadyPending() public {
        ArbBridgeCustody newImpl = new ArbBridgeCustody();
        custody.proposeUpgrade(address(newImpl), _signProposeUpgrade(address(newImpl)), 3, 7);

        ArbBridgeCustody anotherImpl = new ArbBridgeCustody();
        vm.expectRevert(ErrorsLib.E039_UpgradeAlreadyPending.selector);
        custody.proposeUpgrade(address(anotherImpl), new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_proposeEmergencyUpgrade_setsEmergencyFlag() public {
        ArbBridgeCustody newImpl = new ArbBridgeCustody();

        custody.proposeEmergencyUpgrade(address(newImpl), _signProposeEmergencyUpgrade(address(newImpl)), 3, 7);

        (, , bool isEmergency) = custody.getPendingUpgrade();
        assertTrue(isEmergency);
    }

    function test_executeUpgrade_revertsBeforeTimelock() public {
        ArbBridgeCustody newImpl = new ArbBridgeCustody();
        custody.proposeUpgrade(address(newImpl), _signProposeUpgrade(address(newImpl)), 3, 7);

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
        ArbBridgeCustody newImpl = new ArbBridgeCustody();
        custody.proposeUpgrade(address(newImpl), _signProposeUpgrade(address(newImpl)), 3, 7);

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
        ArbBridgeCustody newImpl = new ArbBridgeCustody();
        custody.proposeUpgrade(address(newImpl), _signProposeUpgrade(address(newImpl)), 3, 7);

        vm.warp(block.timestamp + 7 days + 1);

        custody.executeUpgrade(address(newImpl));

        // Verify upgrade cleared pending state
        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_executeEmergencyUpgrade_succeedsAfter24Hours() public {
        ArbBridgeCustody newImpl = new ArbBridgeCustody();
        custody.proposeEmergencyUpgrade(address(newImpl), _signProposeEmergencyUpgrade(address(newImpl)), 3, 7);

        vm.warp(block.timestamp + 24 hours + 1);

        custody.executeUpgrade(address(newImpl));

        // Verify upgrade cleared pending state
        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    // ============ CANCEL UPGRADE TESTS ============

    function test_cancelUpgrade_clearsPendingUpgrade() public {
        ArbBridgeCustody newImpl = new ArbBridgeCustody();
        custody.proposeUpgrade(address(newImpl), _signProposeUpgrade(address(newImpl)), 3, 7);

        // Verify pending upgrade exists
        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(newImpl));

        // Cancel the upgrade — message includes the pending impl address
        custody.cancelUpgrade(_signCancelUpgrade(address(newImpl)), 3, 7);

        // Verify pending upgrade is cleared
        (proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(0));
    }

    function test_cancelUpgrade_revertsOnNoPending() public {
        vm.expectRevert(ErrorsLib.E040_NoPendingUpgrade.selector);
        custody.cancelUpgrade(new bytes(64), 3, 7); // reverts before BLS check
    }

    function test_cancelUpgrade_allowsNewProposalAfterCancel() public {
        ArbBridgeCustody impl1 = new ArbBridgeCustody();
        ArbBridgeCustody impl2 = new ArbBridgeCustody();

        // Propose first upgrade
        custody.proposeUpgrade(address(impl1), _signProposeUpgrade(address(impl1)), 3, 7);

        // Cancel it — message includes the pending impl address
        custody.cancelUpgrade(_signCancelUpgrade(address(impl1)), 3, 7);

        // Propose new upgrade (should succeed)
        custody.proposeUpgrade(address(impl2), _signProposeUpgrade(address(impl2)), 3, 7);

        (address proposedImpl, , ) = custody.getPendingUpgrade();
        assertEq(proposedImpl, address(impl2));
    }

    // ============ MULTI-CHAIN NONCE TESTS ============

    // ============ ORDER STORAGE & RETRIEVAL TESTS (Code Review Fixes) ============

    function test_buyITPFromArbitrum_storesOrderParameters() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 limitPrice = 1.5e18;

        vm.prank(alice);
        // User provides 6-decimal USDC
        uint256 orderId = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT_6DEC, limitPrice, 1, deadline);

        TypesLib.CrossChainOrder memory order = custody.getCrossChainOrder(orderId);
        assertEq(order.itpId, TEST_ITP_ID);
        assertEq(order.user, alice);
        // Amount is stored as 18-decimal internal (converted from 6-decimal input)
        assertEq(order.amount, ORDER_AMOUNT_INTERNAL);
        assertEq(order.limitPrice, limitPrice);
        assertEq(order.deadline, deadline);
        assertEq(order.createdAt, block.timestamp);
    }

    function test_getCrossChainOrder_returnsEmptyForNonExistent() public view {
        TypesLib.CrossChainOrder memory order = custody.getCrossChainOrder(999);
        assertEq(order.itpId, bytes32(0));
        assertEq(order.user, address(0));
        assertEq(order.amount, 0);
        assertEq(order.limitPrice, 0);
        assertEq(order.deadline, 0);
        assertEq(order.createdAt, 0);
    }

    function test_buyITPFromArbitrum_multipleOrdersStoredCorrectly() public {
        uint256 deadline1 = block.timestamp + 1 hours;
        uint256 deadline2 = block.timestamp + 2 hours;

        vm.prank(alice);
        uint256 orderId1 = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT_6DEC, 1e18, 0, deadline1);

        vm.prank(bob);
        uint256 orderId2 = custody.buyITPFromArbitrum(TEST_ITP_ID, ORDER_AMOUNT_6DEC * 2, 2e18, 2, deadline2);

        TypesLib.CrossChainOrder memory order1 = custody.getCrossChainOrder(orderId1);
        assertEq(order1.user, alice);
        // Amount is stored as 18-decimal internal
        assertEq(order1.amount, ORDER_AMOUNT_INTERNAL);
        assertEq(order1.limitPrice, 1e18);

        TypesLib.CrossChainOrder memory order2 = custody.getCrossChainOrder(orderId2);
        assertEq(order2.user, bob);
        // 2x input amount = 2x internal amount
        assertEq(order2.amount, ORDER_AMOUNT_INTERNAL * 2);
        assertEq(order2.limitPrice, 2e18);
        assertEq(order2.deadline, deadline2);
    }

    function test_buyITPFromArbitrum_revertsOnZeroItpId() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(alice);
        vm.expectRevert(ErrorsLib.E060_ZeroITPId.selector);
        custody.buyITPFromArbitrum(bytes32(0), ORDER_AMOUNT, 1e18, 1, deadline);
    }

    function test_completeBridge_revertsOnInvalidProof_zeroBlockNumber() public {
        TypesLib.ReleaseProof memory proof = TypesLib.ReleaseProof({
            sourceChainId: L3_CHAIN_ID,
            sourceBlockNumber: 0,
            sourceBlockHash: keccak256("block_hash"),
            sourceTxHash: keccak256("tx_hash")
        });

        vm.expectRevert(ErrorsLib.E057_InvalidProof.selector);
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, 0, proof, new bytes(64), 3, 7); // reverts before BLS check
    }

    // ============ MULTI-CHAIN NONCE TESTS ============

    function test_multiChainNonces_independentTracking() public {
        TypesLib.ReleaseProof memory proofL3 = _createValidProof(L3_CHAIN_ID);
        TypesLib.ReleaseProof memory proofBase = _createValidProof(BASE_CHAIN_ID);

        // Use nonce 0 on L3
        custody.completeBridge(L3_CHAIN_ID, RELEASE_AMOUNT, 0, proofL3, _signCompleteBridge(proofL3, RELEASE_AMOUNT, 0), 3, 7);

        // Use nonce 0 and 1 on Base
        custody.completeBridge(BASE_CHAIN_ID, RELEASE_AMOUNT, 0, proofBase, _signCompleteBridge(proofBase, RELEASE_AMOUNT, 0), 3, 7);
        proofBase.sourceTxHash = keccak256("tx_hash_2");
        custody.completeBridge(BASE_CHAIN_ID, RELEASE_AMOUNT, 1, proofBase, _signCompleteBridge(proofBase, RELEASE_AMOUNT, 1), 3, 7);

        // Verify L3 state
        assertTrue(custody.isNonceUsed(L3_CHAIN_ID, 0));
        assertFalse(custody.isNonceUsed(L3_CHAIN_ID, 1)); // Not used on L3

        // Verify Base state
        assertTrue(custody.isNonceUsed(BASE_CHAIN_ID, 0));
        assertTrue(custody.isNonceUsed(BASE_CHAIN_ID, 1));
    }
}
