// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { CollateralVault } from "../../src/vision/CollateralVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock WIND token for testing
contract MockWIND is ERC20 {
    constructor() ERC20("WIND Token", "WIND") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CollateralVaultTest is Test {
    CollateralVault public vault;
    MockWIND public wind;

    // Test accounts with known private keys
    uint256 constant CREATOR_PK = 0xA11CE;
    uint256 constant FILLER_PK = 0xB0B;

    address creator;
    address filler;
    address thirdParty;

    // EIP-712 domain components
    bytes32 constant BET_COMMITMENT_TYPEHASH = keccak256(
        "BetCommitment(bytes32 tradesRoot,address creator,address filler,uint256 creatorAmount,uint256 fillerAmount,uint256 deadline,uint256 nonce,uint256 expiry)"
    );

    // Events (redeclared for testing)
    event Deposit(address indexed user, uint256 amount, uint256 newAvailableBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newAvailableBalance);
    event BetCommitted(
        uint256 indexed betId,
        address indexed creator,
        address indexed filler,
        bytes32 tradesRoot,
        uint256 creatorAmount,
        uint256 fillerAmount,
        uint256 deadline
    );
    event CollateralLocked(address indexed user, uint256 indexed betId, uint256 amount);
    event BetSettled(uint256 indexed betId, address indexed winner, uint256 payout);
    event FeeCollected(uint256 indexed betId, uint256 feeAmount, address collector);
    event FeeConfigUpdated(uint256 feeBps, address collector);

    // Settlement EIP-712
    bytes32 constant SETTLEMENT_AGREEMENT_TYPEHASH = keccak256(
        "SettlementAgreement(uint256 betId,address winner,uint256 nonce,uint256 expiry)"
    );

    function setUp() public {
        // Derive addresses from private keys
        creator = vm.addr(CREATOR_PK);
        filler = vm.addr(FILLER_PK);
        thirdParty = address(0x3333);

        // Deploy mock WIND token
        wind = new MockWIND();

        // Deploy CollateralVault
        vault = new CollateralVault(address(wind));

        // Fund test accounts
        wind.mint(creator, 10000e18);
        wind.mint(filler, 10000e18);
        wind.mint(thirdParty, 10000e18);

        // Approve vault for all test accounts
        vm.prank(creator);
        wind.approve(address(vault), type(uint256).max);

        vm.prank(filler);
        wind.approve(address(vault), type(uint256).max);

        vm.prank(thirdParty);
        wind.approve(address(vault), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_ConstructorSetsWindToken() public view {
        assertEq(address(vault.WIND()), address(wind));
    }

    function test_ConstructorRevertsZeroAddress() public {
        vm.expectRevert(CollateralVault.ZeroAddress.selector);
        new CollateralVault(address(0));
    }

    // ============ Deposit Tests (AC: #1) ============

    function test_DepositHappyPath() public {
        uint256 depositAmount = 1000e18;
        uint256 balanceBefore = wind.balanceOf(creator);

        vm.prank(creator);
        vault.deposit(depositAmount);

        assertEq(vault.getAvailableBalance(creator), depositAmount);
        assertEq(vault.getLockedBalance(creator), 0);
        assertEq(vault.getTotalBalance(creator), depositAmount);
        assertEq(wind.balanceOf(creator), balanceBefore - depositAmount);
        assertEq(wind.balanceOf(address(vault)), depositAmount);
    }

    function test_DepositEmitsEvent() public {
        uint256 depositAmount = 1000e18;

        vm.prank(creator);
        vm.expectEmit(true, false, false, true);
        emit Deposit(creator, depositAmount, depositAmount);
        vault.deposit(depositAmount);
    }

    function test_DepositZeroAmountReverts() public {
        vm.prank(creator);
        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_DepositMultipleTimes() public {
        vm.startPrank(creator);
        vault.deposit(100e18);
        vault.deposit(200e18);
        vault.deposit(300e18);
        vm.stopPrank();

        assertEq(vault.getAvailableBalance(creator), 600e18);
    }

    // ============ Withdraw Tests (AC: #2, #4) ============

    function test_WithdrawHappyPath() public {
        uint256 depositAmount = 1000e18;
        uint256 withdrawAmount = 400e18;

        vm.startPrank(creator);
        vault.deposit(depositAmount);
        vault.withdraw(withdrawAmount);
        vm.stopPrank();

        assertEq(vault.getAvailableBalance(creator), depositAmount - withdrawAmount);
        assertEq(wind.balanceOf(creator), 10000e18 - depositAmount + withdrawAmount);
    }

    function test_WithdrawEmitsEvent() public {
        uint256 depositAmount = 1000e18;
        uint256 withdrawAmount = 400e18;

        vm.startPrank(creator);
        vault.deposit(depositAmount);

        vm.expectEmit(true, false, false, true);
        emit Withdraw(creator, withdrawAmount, depositAmount - withdrawAmount);
        vault.withdraw(withdrawAmount);
        vm.stopPrank();
    }

    function test_WithdrawMoreThanAvailableReverts() public {
        uint256 depositAmount = 1000e18;

        vm.startPrank(creator);
        vault.deposit(depositAmount);

        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.InsufficientBalance.selector, depositAmount, depositAmount + 1)
        );
        vault.withdraw(depositAmount + 1);
        vm.stopPrank();
    }

    function test_WithdrawZeroAmountReverts() public {
        vm.prank(creator);
        vault.deposit(1000e18);

        vm.prank(creator);
        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.withdraw(0);
    }

    function test_WithdrawFullAmount() public {
        uint256 depositAmount = 1000e18;

        vm.startPrank(creator);
        vault.deposit(depositAmount);
        vault.withdraw(depositAmount);
        vm.stopPrank();

        assertEq(vault.getAvailableBalance(creator), 0);
    }

    // ============ CommitBet Tests (AC: #3, #5) ============

    function test_CommitBetHappyPath() public {
        // Deposit collateral
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        // Create commitment
        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        // Sign commitment
        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        // Execute commitBet
        uint256 betId = vault.commitBet(commitment, creatorSig, fillerSig);

        // Verify bet created
        assertEq(betId, 0);

        CollateralVault.Bet memory bet = vault.getBet(betId);
        assertEq(bet.creator, creator);
        assertEq(bet.filler, filler);
        assertEq(bet.creatorAmount, 200e18);
        assertEq(bet.fillerAmount, 200e18);
        assertEq(bet.tradesRoot, bytes32(uint256(1)));
        assertEq(uint8(bet.status), uint8(CollateralVault.BetStatus.Active));

        // Verify balances locked
        assertEq(vault.getAvailableBalance(creator), 300e18);
        assertEq(vault.getLockedBalance(creator), 200e18);
        assertEq(vault.getAvailableBalance(filler), 300e18);
        assertEq(vault.getLockedBalance(filler), 200e18);

        // Verify nonces incremented
        assertEq(vault.getNonce(creator), 1);
        assertEq(vault.getNonce(filler), 1);
    }

    function test_CommitBetEmitsEvents() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        // Expect events
        vm.expectEmit(true, true, false, true);
        emit CollateralLocked(creator, 0, 200e18);

        vm.expectEmit(true, true, false, true);
        emit CollateralLocked(filler, 0, 200e18);

        vm.expectEmit(true, true, true, true);
        emit BetCommitted(
            0, creator, filler, bytes32(uint256(1)), 200e18, 200e18, block.timestamp + 1 days
        );

        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetInvalidCreatorSignatureReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        // Sign with wrong key for creator
        bytes32 digest = _getCommitmentDigest(commitment);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(FILLER_PK, digest); // Wrong key!
        bytes memory wrongCreatorSig = abi.encodePacked(r, s, v);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(FILLER_PK, digest);
        bytes memory fillerSig = abi.encodePacked(r2, s2, v2);

        vm.expectRevert(CollateralVault.InvalidSignature.selector);
        vault.commitBet(commitment, wrongCreatorSig, fillerSig);
    }

    function test_CommitBetInvalidFillerSignatureReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        bytes32 digest = _getCommitmentDigest(commitment);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(CREATOR_PK, digest);
        bytes memory creatorSig = abi.encodePacked(r, s, v);

        // Sign with wrong key for filler
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(CREATOR_PK, digest); // Wrong key!
        bytes memory wrongFillerSig = abi.encodePacked(r2, s2, v2);

        vm.expectRevert(CollateralVault.InvalidSignature.selector);
        vault.commitBet(commitment, creatorSig, wrongFillerSig);
    }

    function test_CommitBetInsufficientCreatorBalanceReverts() public {
        vm.prank(creator);
        vault.deposit(100e18); // Less than needed

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18, // More than available
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(abi.encodeWithSelector(CollateralVault.InsufficientBalance.selector, 100e18, 200e18));
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetInsufficientFillerBalanceReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(100e18); // Less than needed

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18, // More than available
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(abi.encodeWithSelector(CollateralVault.InsufficientBalance.selector, 100e18, 200e18));
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetSelfBetReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: creator, // Same as creator!
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        // Sign both with creator's key
        bytes32 digest = _getCommitmentDigest(commitment);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(CREATOR_PK, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(CollateralVault.SelfBetNotAllowed.selector);
        vault.commitBet(commitment, sig, sig);
    }

    function test_CommitBetExpiredSignatureReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp - 1 // Already expired!
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(abi.encodeWithSelector(CollateralVault.SignatureExpired.selector, commitment.expiry));
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetZeroCreatorAddressReverts() public {
        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: address(0),
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        // Can't really sign for address(0), so we'll just pass dummy signatures
        bytes memory dummySig = new bytes(65);

        vm.expectRevert(CollateralVault.ZeroAddress.selector);
        vault.commitBet(commitment, dummySig, dummySig);
    }

    function test_CommitBetZeroAmountReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 0, // Zero!
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetDeadlineInPastReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp - 1, // Past deadline!
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.DeadlineInPast.selector, commitment.deadline, block.timestamp)
        );
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetDeadlineAtCurrentTimeReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp, // Exactly now - should fail
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.DeadlineInPast.selector, commitment.deadline, block.timestamp)
        );
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetInvalidCreatorNonceReverts() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 1, // Wrong nonce - should be 0
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);

        vm.expectRevert(abi.encodeWithSelector(CollateralVault.InvalidNonce.selector, creator, 0, 1));
        vault.commitBet(commitment, creatorSig, fillerSig);
    }

    function test_CommitBetInvalidFillerNonceReverts() public {
        // First, increment creator's nonce by making a bet
        vm.prank(creator);
        vault.deposit(1000e18);

        vm.prank(filler);
        vault.deposit(1000e18);

        // First bet to increment nonces
        CollateralVault.BetCommitment memory commitment1 = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 100e18,
            fillerAmount: 100e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig1, bytes memory fillerSig1) = _signCommitment(commitment1);
        vault.commitBet(commitment1, creatorSig1, fillerSig1);

        // Now creator nonce is 1, filler nonce is 1
        // Try with nonce=0 for filler - will fail because filler's nonce is now 1
        CollateralVault.BetCommitment memory commitment2 = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(2)),
            creator: creator,
            filler: filler,
            creatorAmount: 100e18,
            fillerAmount: 100e18,
            deadline: block.timestamp + 1 days,
            nonce: 0, // Wrong - both are at 1 now
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig2, bytes memory fillerSig2) = _signCommitment(commitment2);

        vm.expectRevert(abi.encodeWithSelector(CollateralVault.InvalidNonce.selector, creator, 1, 0));
        vault.commitBet(commitment2, creatorSig2, fillerSig2);
    }

    // ============ Withdraw With Locked Balance Tests (AC: #4) ============

    function test_WithdrawOnlyAvailableNotLocked() public {
        // Deposit
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        // Commit bet to lock some collateral
        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);
        vault.commitBet(commitment, creatorSig, fillerSig);

        // Creator has 300 available, 200 locked
        assertEq(vault.getAvailableBalance(creator), 300e18);
        assertEq(vault.getLockedBalance(creator), 200e18);

        // Try to withdraw more than available (but less than total)
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.InsufficientBalance.selector, 300e18, 400e18));
        vault.withdraw(400e18);

        // Can withdraw available
        vm.prank(creator);
        vault.withdraw(300e18);

        assertEq(vault.getAvailableBalance(creator), 0);
        assertEq(vault.getLockedBalance(creator), 200e18);
    }

    // ============ Multiple Concurrent Bets Test ============

    function test_MultipleConcurrentBetsLockCorrectAmounts() public {
        // Deposit
        vm.prank(creator);
        vault.deposit(1000e18);

        vm.prank(filler);
        vault.deposit(1000e18);

        // First bet
        CollateralVault.BetCommitment memory commitment1 = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig1, bytes memory fillerSig1) = _signCommitment(commitment1);
        vault.commitBet(commitment1, creatorSig1, fillerSig1);

        // Second bet (nonces are now 1)
        CollateralVault.BetCommitment memory commitment2 = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(2)),
            creator: creator,
            filler: filler,
            creatorAmount: 300e18,
            fillerAmount: 300e18,
            deadline: block.timestamp + 1 days,
            nonce: 1,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig2, bytes memory fillerSig2) = _signCommitment(commitment2);
        vault.commitBet(commitment2, creatorSig2, fillerSig2);

        // Verify correct locked amounts
        assertEq(vault.getLockedBalance(creator), 500e18);
        assertEq(vault.getLockedBalance(filler), 500e18);
        assertEq(vault.getAvailableBalance(creator), 500e18);
        assertEq(vault.getAvailableBalance(filler), 500e18);

        // Verify bet IDs
        assertEq(vault.nextBetId(), 2);
    }

    // ============ Fuzz Tests ============

    function testFuzz_DepositWithdraw(uint256 depositAmount, uint256 withdrawAmount) public {
        // Bound inputs
        depositAmount = bound(depositAmount, 1, 10000e18);
        withdrawAmount = bound(withdrawAmount, 1, depositAmount);

        wind.mint(address(this), depositAmount);
        wind.approve(address(vault), depositAmount);

        vault.deposit(depositAmount);
        assertEq(vault.getAvailableBalance(address(this)), depositAmount);

        vault.withdraw(withdrawAmount);
        assertEq(vault.getAvailableBalance(address(this)), depositAmount - withdrawAmount);
    }

    function testFuzz_DepositAmount(uint256 amount) public {
        // Bound to reasonable range
        amount = bound(amount, 1, 10000e18);

        wind.mint(address(this), amount);
        wind.approve(address(vault), amount);

        vault.deposit(amount);
        assertEq(vault.getAvailableBalance(address(this)), amount);
    }

    // ============ View Function Tests ============

    function test_GetBetStatus() public {
        vm.prank(creator);
        vault.deposit(500e18);

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: 200e18,
            fillerAmount: 200e18,
            deadline: block.timestamp + 1 days,
            nonce: 0,
            expiry: block.timestamp + 1 hours
        });

        (bytes memory creatorSig, bytes memory fillerSig) = _signCommitment(commitment);
        uint256 betId = vault.commitBet(commitment, creatorSig, fillerSig);

        assertEq(uint8(vault.getBetStatus(betId)), uint8(CollateralVault.BetStatus.Active));
    }

    function test_GetNonExistentBetReturnsNone() public view {
        assertEq(uint8(vault.getBetStatus(999)), uint8(CollateralVault.BetStatus.None));
    }

    // ============ Helper Functions ============

    function _getCommitmentDigest(CollateralVault.BetCommitment memory commitment) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                BET_COMMITMENT_TYPEHASH,
                commitment.tradesRoot,
                commitment.creator,
                commitment.filler,
                commitment.creatorAmount,
                commitment.fillerAmount,
                commitment.deadline,
                commitment.nonce,
                commitment.expiry
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", vault.DOMAIN_SEPARATOR(), structHash));
    }

    function _signCommitment(CollateralVault.BetCommitment memory commitment)
        internal
        view
        returns (bytes memory creatorSig, bytes memory fillerSig)
    {
        bytes32 digest = _getCommitmentDigest(commitment);

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(CREATOR_PK, digest);
        creatorSig = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(FILLER_PK, digest);
        fillerSig = abi.encodePacked(r2, s2, v2);
    }

    function _getSettlementDigest(CollateralVault.SettlementAgreement memory agreement)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                SETTLEMENT_AGREEMENT_TYPEHASH,
                agreement.betId,
                agreement.winner,
                agreement.nonce,
                agreement.expiry
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", vault.DOMAIN_SEPARATOR(), structHash));
    }

    function _signSettlement(CollateralVault.SettlementAgreement memory agreement)
        internal
        view
        returns (bytes memory creatorSig, bytes memory fillerSig)
    {
        bytes32 digest = _getSettlementDigest(agreement);

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(CREATOR_PK, digest);
        creatorSig = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(FILLER_PK, digest);
        fillerSig = abi.encodePacked(r2, s2, v2);
    }

    /// @notice Helper: deposit, commit, warp past deadline, then settle
    function _createAndSettleBet(uint256 creatorAmt, uint256 fillerAmt, address winner) internal returns (uint256 betId) {
        vm.prank(creator);
        vault.deposit(creatorAmt);

        vm.prank(filler);
        vault.deposit(fillerAmt);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(1)),
            creator: creator,
            filler: filler,
            creatorAmount: creatorAmt,
            fillerAmount: fillerAmt,
            deadline: block.timestamp + 1 days,
            nonce: vault.getNonce(creator),
            expiry: block.timestamp + 1 hours
        });

        (bytes memory cSig, bytes memory fSig) = _signCommitment(commitment);
        betId = vault.commitBet(commitment, cSig, fSig);

        // Warp past deadline
        vm.warp(block.timestamp + 1 days + 1);

        // Settle
        CollateralVault.SettlementAgreement memory agreement = CollateralVault.SettlementAgreement({
            betId: betId,
            winner: winner,
            nonce: vault.getNonce(creator),
            expiry: block.timestamp + 1 hours
        });

        (bytes memory sSigC, bytes memory sSigF) = _signSettlement(agreement);
        vault.settleByAgreement(agreement, sSigC, sSigF);
    }

    // ============ Protocol Fee Tests (Story 7-1, Task 1) ============

    function test_SetFeeConfigHappyPath() public {
        address collector = address(0xFEE);
        vault.setFeeConfig(10, collector); // 0.1%

        assertEq(vault.protocolFeeBps(), 10);
        assertEq(vault.feeCollector(), collector);
    }

    function test_SetFeeConfigEmitsEvent() public {
        address collector = address(0xFEE);

        vm.expectEmit(false, false, false, true);
        emit FeeConfigUpdated(10, collector);
        vault.setFeeConfig(10, collector);
    }

    function test_SetFeeConfigMaxBps() public {
        vault.setFeeConfig(500, address(0xFEE)); // 5% max
        assertEq(vault.protocolFeeBps(), 500);
    }

    function test_SetFeeConfigExceedsMaxReverts() public {
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.FeeTooHigh.selector, 501, 500));
        vault.setFeeConfig(501, address(0xFEE));
    }

    function test_SetFeeConfigNotOwnerReverts() public {
        vm.prank(creator);
        vm.expectRevert(CollateralVault.NotOwner.selector);
        vault.setFeeConfig(10, address(0xFEE));
    }

    function test_SetFeeConfigZeroBps() public {
        vault.setFeeConfig(0, address(0xFEE));
        assertEq(vault.protocolFeeBps(), 0);
    }

    function test_SetFeeConfigZeroCollector() public {
        vault.setFeeConfig(10, address(0));
        assertEq(vault.feeCollector(), address(0));
    }

    function test_SettlementWithFee() public {
        address collector = address(0xFEE);
        vault.setFeeConfig(10, collector); // 0.1% = 10 bps

        _createAndSettleBet(500e18, 500e18, creator);

        // totalPot = 1000e18, fee = 1000e18 * 10 / 10000 = 1e18
        uint256 expectedFee = 1e18;
        uint256 expectedPayout = 1000e18 - expectedFee;

        assertEq(vault.getAvailableBalance(creator), expectedPayout);
        assertEq(vault.getAvailableBalance(collector), expectedFee);
        assertEq(vault.accumulatedFees(), expectedFee);
    }

    function test_SettlementWithFeeVerifiesState() public {
        address collector = address(0xFEE);
        vault.setFeeConfig(100, collector); // 1%

        _createAndSettleBet(500e18, 500e18, creator);

        // Verify fee was collected (10e18 = 1% of 1000e18)
        assertEq(vault.accumulatedFees(), 10e18);
        assertEq(vault.getAvailableBalance(collector), 10e18);
        assertEq(vault.getAvailableBalance(creator), 990e18);
    }

    function test_SettlementNoFeeWhenBpsZero() public {
        vault.setFeeConfig(0, address(0xFEE)); // 0%

        _createAndSettleBet(500e18, 500e18, creator);

        assertEq(vault.getAvailableBalance(creator), 1000e18); // Full pot
        assertEq(vault.getAvailableBalance(address(0xFEE)), 0); // No fee
        assertEq(vault.accumulatedFees(), 0);
    }

    function test_SettlementNoFeeWhenCollectorZero() public {
        vault.setFeeConfig(10, address(0)); // Collector not set

        _createAndSettleBet(500e18, 500e18, creator);

        assertEq(vault.getAvailableBalance(creator), 1000e18); // Full pot
        assertEq(vault.accumulatedFees(), 0);
    }

    function test_SettlementNoFeeByDefault() public {
        // No setFeeConfig called — default 0
        _createAndSettleBet(500e18, 500e18, creator);

        assertEq(vault.getAvailableBalance(creator), 1000e18); // Full pot
        assertEq(vault.accumulatedFees(), 0);
    }

    function test_FeeCollectorCanWithdraw() public {
        address collector = address(0xFEE);
        vault.setFeeConfig(100, collector); // 1%

        // Mint and approve for collector (for potential future deposits)
        wind.mint(collector, 1e18);
        vm.prank(collector);
        wind.approve(address(vault), type(uint256).max);

        _createAndSettleBet(500e18, 500e18, creator);

        // Fee = 1000e18 * 100 / 10000 = 10e18
        assertEq(vault.getAvailableBalance(collector), 10e18);

        // Collector withdraws fee
        vm.prank(collector);
        vault.withdraw(10e18);

        assertEq(vault.getAvailableBalance(collector), 0);
        assertEq(wind.balanceOf(collector), 1e18 + 10e18); // original + fee
    }

    function test_MultipleBetsAccumulateFees() public {
        address collector = address(0xFEE);
        vault.setFeeConfig(100, collector); // 1%

        // First bet: 500+500=1000, fee=10
        _createAndSettleBet(500e18, 500e18, creator);

        // Second bet: need fresh deposits (creator won first, has ~990e18 available)
        // Reset by depositing more for filler
        wind.mint(filler, 10000e18);
        vm.prank(filler);
        wind.approve(address(vault), type(uint256).max);

        vm.prank(creator);
        vault.deposit(500e18); // creator deposits more (has tokens from first win + original)

        vm.prank(filler);
        vault.deposit(500e18);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(2)),
            creator: creator,
            filler: filler,
            creatorAmount: 500e18,
            fillerAmount: 500e18,
            deadline: block.timestamp + 1 days,
            nonce: vault.getNonce(creator),
            expiry: block.timestamp + 1 hours
        });

        (bytes memory cSig, bytes memory fSig) = _signCommitment(commitment);
        uint256 betId2 = vault.commitBet(commitment, cSig, fSig);

        vm.warp(block.timestamp + 1 days + 1);

        CollateralVault.SettlementAgreement memory agreement = CollateralVault.SettlementAgreement({
            betId: betId2,
            winner: filler,
            nonce: vault.getNonce(creator),
            expiry: block.timestamp + 1 hours
        });

        (bytes memory sSigC, bytes memory sSigF) = _signSettlement(agreement);
        vault.settleByAgreement(agreement, sSigC, sSigF);

        // Total accumulated fees: 10e18 + 10e18 = 20e18
        assertEq(vault.accumulatedFees(), 20e18);
        assertEq(vault.getAvailableBalance(collector), 20e18);
    }

    function testFuzz_FeeCalculation(uint256 feeBps, uint256 betAmount) public {
        feeBps = bound(feeBps, 1, 500);
        betAmount = bound(betAmount, 1e18, 5000e18);

        address collector = address(0xFEE);
        vault.setFeeConfig(feeBps, collector);

        wind.mint(creator, betAmount);
        vm.prank(creator);
        wind.approve(address(vault), type(uint256).max);

        wind.mint(filler, betAmount);
        vm.prank(filler);
        wind.approve(address(vault), type(uint256).max);

        vm.prank(creator);
        vault.deposit(betAmount);
        vm.prank(filler);
        vault.deposit(betAmount);

        CollateralVault.BetCommitment memory commitment = CollateralVault.BetCommitment({
            tradesRoot: bytes32(uint256(99)),
            creator: creator,
            filler: filler,
            creatorAmount: betAmount,
            fillerAmount: betAmount,
            deadline: block.timestamp + 1 days,
            nonce: vault.getNonce(creator),
            expiry: block.timestamp + 1 hours
        });

        (bytes memory cSig, bytes memory fSig) = _signCommitment(commitment);
        uint256 betId = vault.commitBet(commitment, cSig, fSig);

        vm.warp(block.timestamp + 1 days + 1);

        CollateralVault.SettlementAgreement memory agreement = CollateralVault.SettlementAgreement({
            betId: betId,
            winner: creator,
            nonce: vault.getNonce(creator),
            expiry: block.timestamp + 1 hours
        });

        (bytes memory sSigC, bytes memory sSigF) = _signSettlement(agreement);
        vault.settleByAgreement(agreement, sSigC, sSigF);

        uint256 totalPot = betAmount * 2;
        uint256 expectedFee = (totalPot * feeBps) / 10000;
        uint256 expectedPayout = totalPot - expectedFee;

        assertEq(vault.getAvailableBalance(creator), expectedPayout);
        assertEq(vault.getAvailableBalance(collector), expectedFee);
        assertEq(vault.accumulatedFees(), expectedFee);
    }

    function test_OwnerSetOnDeployment() public view {
        assertEq(vault.owner(), address(this));
    }

    function test_MaxFeeBpsConstant() public view {
        assertEq(vault.MAX_FEE_BPS(), 500);
    }
}
