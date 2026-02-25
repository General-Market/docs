// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Vision} from "../src/vision/Vision.sol";
import {IVision} from "../src/interfaces/IVision.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {Governance} from "../src/Governance.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

contract VisionTest is TestHelper {
    Vision public vision;
    MockERC20 public usdc;
    IssuerRegistry public issuerRegistry;
    Governance public governance;

    address public creator;
    address public nonCreator;

    // Default batch params
    bytes32 constant SOURCE_ID = keccak256("test_source");
    bytes32 constant CONFIG_HASH = keccak256("test_config");
    uint256 constant TICK_DURATION = 1 hours;
    uint256 constant LOCK_OFFSET = 60; // 60 seconds

    function setUp() public {
        creator = makeAddr("creator");
        nonCreator = makeAddr("nonCreator");

        // Deploy mock tokens
        usdc = new MockERC20("USDC", "USDC", 6);

        // Deploy governance and issuer registry for BLS verification
        governance = deployGovernance(address(this));
        issuerRegistry = deployIssuerRegistry(address(governance));

        // Register test issuers and set aggregated pubkey
        registerTestIssuersWithBLS(issuerRegistry, address(this));

        // Deploy Vision
        vision = new Vision(
            address(usdc),
            address(issuerRegistry),
            address(this) // feeCollector
        );
    }

    // ============ Helper: create a batch via BLS and return its ID ============

    function _createDefaultBatch() internal returns (uint256 batchId) {
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(creator);
        batchId = vision.createBatch(
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            LOCK_OFFSET,
            blsSig,
            REF_NONCE,
            SIGNERS_BITMASK
        );
    }

    /// @dev Create batch with custom sourceId for idempotency tests
    function _createBatchWithSource(bytes32 sourceId) internal returns (uint256 batchId) {
        bytes32 configHash = keccak256(abi.encode("config", sourceId));
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            sourceId,
            configHash,
            TICK_DURATION,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(creator);
        batchId = vision.createBatch(
            sourceId,
            configHash,
            TICK_DURATION,
            LOCK_OFFSET,
            blsSig,
            REF_NONCE,
            SIGNERS_BITMASK
        );
    }

    /// @dev Mint USDC to player, approve Vision, and return the player address
    function _preparePlayer(address player, uint256 amount) internal {
        usdc.mint(player, amount);
        vm.prank(player);
        usdc.approve(address(vision), type(uint256).max);
    }

    // ============ createBatch ============

    function test_createBatch() public {
        uint256 batchId = _createDefaultBatch();
        assertEq(batchId, 0, "First batch should have ID 0");

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.creator, creator, "Creator should be msg.sender");
        assertEq(batch.sourceId, SOURCE_ID, "Source ID should match");
        assertEq(batch.configHash, CONFIG_HASH, "Config hash should match");
        assertEq(batch.tickDuration, TICK_DURATION, "Tick duration should match");
        assertEq(batch.lockOffset, LOCK_OFFSET, "Lock offset should match");
        assertEq(batch.createdAtTick, block.timestamp / TICK_DURATION, "Created at tick should match");
        assertEq(batch.paused, false, "Batch should not be paused");

        // Second batch with different sourceId should get ID 1
        bytes32 sourceId2 = keccak256("test_source_2");
        uint256 batchId2 = _createBatchWithSource(sourceId2);
        assertEq(batchId2, 1, "Second batch should have ID 1");
        assertEq(vision.nextBatchId(), 2, "nextBatchId should be 2");
    }

    function test_createBatch_idempotent() public {
        // First call creates the batch
        uint256 batchId1 = _createDefaultBatch();

        // Second call with same sourceId returns existing batch (no BLS needed)
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(nonCreator);
        uint256 batchId2 = vision.createBatch(
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            LOCK_OFFSET,
            blsSig,
            REF_NONCE,
            SIGNERS_BITMASK
        );

        assertEq(batchId1, batchId2, "Idempotent: should return same batch ID");
        assertEq(vision.nextBatchId(), 1, "Should not have created a second batch");
    }

    function test_createBatch_sourceIdMapping() public {
        uint256 batchId = _createDefaultBatch();

        assertTrue(vision.sourceIdHasBatch(SOURCE_ID), "sourceIdHasBatch should be true");
        assertEq(vision.sourceIdToBatchId(SOURCE_ID), batchId, "sourceIdToBatchId should map correctly");
        assertEq(vision.getBatchIdBySourceId(SOURCE_ID), batchId, "getBatchIdBySourceId should work");
    }

    function test_createBatch_revertZeroTickDuration() public {
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            uint256(0),
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(IVision.InvalidTickDuration.selector);
        vm.prank(creator);
        vision.createBatch(SOURCE_ID, CONFIG_HASH, 0, LOCK_OFFSET, blsSig, REF_NONCE, SIGNERS_BITMASK);
    }

    function test_createBatch_revertExcessiveTickDuration() public {
        uint256 badDuration = 30 days + 1;
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            badDuration,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(IVision.InvalidTickDuration.selector);
        vm.prank(creator);
        vision.createBatch(SOURCE_ID, CONFIG_HASH, badDuration, LOCK_OFFSET, blsSig, REF_NONCE, SIGNERS_BITMASK);
    }

    function test_createBatch_revertLockOffsetTooLong() public {
        // lockOffset >= tickDuration should revert
        uint256 badLockOffset = TICK_DURATION;
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            badLockOffset
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(IVision.InvalidLockOffset.selector);
        vm.prank(creator);
        vision.createBatch(SOURCE_ID, CONFIG_HASH, TICK_DURATION, badLockOffset, blsSig, REF_NONCE, SIGNERS_BITMASK);
    }

    function test_createBatch_revertInvalidBLS() public {
        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong_message"));

        vm.expectRevert();
        vm.prank(creator);
        vision.createBatch(SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET, wrongSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ getBatch ============

    function test_getBatch_returnsEmptyForNonExistent() public view {
        IVision.Batch memory batch = vision.getBatch(999);
        assertEq(batch.creator, address(0), "Non-existent batch creator should be zero");
        assertEq(batch.tickDuration, 0, "Non-existent batch should have zero tick duration");
    }

    // ============ createBatchAndJoin ============

    function test_createBatchAndJoin() public {
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        bytes32 bitmapHash = keccak256("bitmap1");

        vm.prank(player);
        uint256 batchId = vision.createBatchAndJoin(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK,
            10e6, 1e6, bitmapHash
        );

        assertEq(batchId, 0, "First batch should have ID 0");

        // Verify batch was created
        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.sourceId, SOURCE_ID, "Source ID should match");
        assertEq(batch.configHash, CONFIG_HASH, "Config hash should match");

        // Verify player joined
        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.bitmapHash, bitmapHash, "bitmapHash should match");
        assertEq(pos.stakePerTick, 1e6, "stakePerTick should match");
        assertEq(pos.balance, 10e6, "balance should equal deposit");
        assertEq(pos.configHash, CONFIG_HASH, "Position configHash should match");

        // Verify USDC transferred
        assertEq(usdc.balanceOf(address(vision)), 10e6, "Vision should hold the USDC");
    }

    function test_createBatchAndJoin_idempotent() public {
        // First player creates + joins
        address player1 = makeAddr("player1");
        _preparePlayer(player1, 10e6);

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            SOURCE_ID,
            CONFIG_HASH,
            TICK_DURATION,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player1);
        uint256 batchId1 = vision.createBatchAndJoin(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK,
            10e6, 1e6, keccak256("bitmap1")
        );

        // Second player calls createBatchAndJoin with same sourceId - should join existing
        address player2 = makeAddr("player2");
        _preparePlayer(player2, 5e6);

        vm.prank(player2);
        uint256 batchId2 = vision.createBatchAndJoin(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK,
            5e6, 1e6, keccak256("bitmap2")
        );

        assertEq(batchId1, batchId2, "Should join existing batch");
        assertEq(vision.nextBatchId(), 1, "Only 1 batch should exist");

        // Both players should have positions
        IVision.PlayerPosition memory pos1 = vision.getPosition(batchId1, player1);
        IVision.PlayerPosition memory pos2 = vision.getPosition(batchId2, player2);
        assertEq(pos1.stakePerTick, 1e6, "Player1 should have position");
        assertEq(pos2.stakePerTick, 1e6, "Player2 should have position");
    }

    // ============ joinBatch ============

    function test_joinBatch() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        uint256 stakePerTick = 1e6;
        bytes32 bitmapHash = keccak256("bitmap1");

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, stakePerTick, bitmapHash);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.bitmapHash, bitmapHash, "bitmapHash should match");
        assertEq(pos.configHash, CONFIG_HASH, "configHash should match");
        assertEq(pos.stakePerTick, stakePerTick, "stakePerTick should match");
        assertEq(pos.balance, 10e6, "balance should equal deposit");
        assertEq(pos.totalDeposited, 10e6, "totalDeposited should equal deposit");
        assertEq(pos.joinTimestamp, block.timestamp, "joinTimestamp should be current");
        assertEq(pos.totalClaimed, 0, "totalClaimed should be 0");
        assertEq(pos.lastClaimedTick, 0, "lastClaimedTick should be 0");

        // Verify USDC transferred
        assertEq(usdc.balanceOf(address(vision)), 10e6, "Vision should hold the USDC");
        assertEq(usdc.balanceOf(player), 0, "Player should have 0 USDC left");
    }

    function test_joinBatch_revertConfigMismatch() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        // Use wrong configHash
        bytes32 wrongConfig = keccak256("wrong_config");
        vm.expectRevert(IVision.BatchNotFound.selector);
        vm.prank(player);
        vision.joinBatch(batchId, wrongConfig, 10e6, 1e6, keccak256("bitmap"));
    }

    function test_joinBatch_revertNotEnoughDeposit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        // stakePerTick = 5 USDC, deposit = 3 USDC (< stakePerTick)
        vm.expectRevert(IVision.InsufficientDeposit.selector);
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 3e6, 5e6, keccak256("bitmap"));
    }

    function test_joinBatch_revertStakeBelowMinimum() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        // MIN_STAKE_PER_TICK is 1e5, use 1e4
        vm.expectRevert(IVision.StakeBelowMinimum.selector);
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 1e4, 1e4, keccak256("bitmap"));
    }

    function test_joinBatch_revertAlreadyJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 20e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        // Try joining again
        vm.expectRevert(IVision.AlreadyJoined.selector);
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 5e6, 1e6, keccak256("bitmap2"));
    }

    function test_joinBatch_revertBatchNotFound() public {
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.expectRevert(IVision.BatchNotFound.selector);
        vm.prank(player);
        vision.joinBatch(999, CONFIG_HASH, 5e6, 1e6, keccak256("bitmap"));
    }

    function test_joinBatch_minimumStakeExactly() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 1e5);

        // Exactly MIN_STAKE_PER_TICK should work
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 1e5, 1e5, keccak256("bitmap"));

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.stakePerTick, 1e5);
        assertEq(pos.balance, 1e5);
    }

    // ============ deposit ============

    function test_deposit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 20e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        vm.expectEmit(true, true, false, true);
        emit IVision.PlayerDeposited(batchId, player, 5e6);

        vm.prank(player);
        vision.deposit(batchId, 5e6);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.balance, 15e6, "Balance should be 10 + 5 = 15 USDC");
        assertEq(pos.totalDeposited, 15e6, "totalDeposited should be 10 + 5 = 15 USDC");
        assertEq(usdc.balanceOf(address(vision)), 15e6);
    }

    function test_deposit_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.expectRevert(IVision.NotJoined.selector);
        vm.prank(player);
        vision.deposit(batchId, 5e6);
    }

    // ============ updateBitmap ============

    function test_updateBitmap() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap1"));

        bytes32 newHash = keccak256("bitmap2");
        vm.prank(player);
        vision.updateBitmap(batchId, CONFIG_HASH, newHash);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.bitmapHash, newHash, "bitmapHash should be updated");
        assertEq(pos.configHash, CONFIG_HASH, "configHash should track active config");
    }

    function test_updateBitmap_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        vm.expectRevert(IVision.NotJoined.selector);
        vm.prank(player);
        vision.updateBitmap(batchId, CONFIG_HASH, keccak256("bitmap"));
    }

    // ============ claimRewards ============

    function test_claimRewards_happyPath() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        // Simulate: another player deposited and lost, so the contract has extra USDC
        usdc.mint(address(vision), 5e6); // simulate losers' funds in pool

        // Issuers determined newBalance = 13e6 (player won 3 USDC)
        uint256 fromTick = 1;
        uint256 toTick = 5;
        uint256 newBalance = 13e6;

        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CLAIM",
            batchId,
            player,
            fromTick,
            toTick,
            newBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        // winnings = 13e6 - 10e6 = 3e6
        // fee = 3e6 * 30 / 10000 = 9000
        // payout = 3e6 - 9000 = 2991000
        uint256 expectedPayout = 3e6 - (3e6 * 30 / 10000);

        vm.expectEmit(true, true, false, true);
        emit IVision.RewardsClaimed(batchId, player, expectedPayout);

        vm.prank(player);
        vision.claimRewards(batchId, fromTick, toTick, newBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.balance, 13e6, "Balance should be updated to newBalance");
        assertEq(pos.lastClaimedTick, toTick, "lastClaimedTick should be updated");
        assertEq(pos.totalClaimed, expectedPayout, "totalClaimed should track payout");
        assertEq(usdc.balanceOf(player), expectedPayout, "Player should receive payout");
        assertEq(vision.accumulatedFees(), 9000, "Fees should accumulate");
    }

    function test_claimRewards_lossRecorded() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        uint256 fromTick = 1;
        uint256 toTick = 5;
        uint256 newBalance = 7e6;

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CLAIM", batchId, player,
            fromTick, toTick, newBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player);
        vision.claimRewards(batchId, fromTick, toTick, newBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.balance, 7e6, "Balance should decrease to newBalance");
        assertEq(pos.lastClaimedTick, toTick, "lastClaimedTick should be updated");
        assertEq(pos.totalClaimed, 0, "No payout on loss");
        assertEq(usdc.balanceOf(player), 0, "Player receives nothing on loss");
    }

    function test_claimRewards_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        vm.expectRevert(IVision.NotJoined.selector);
        vm.prank(player);
        vision.claimRewards(batchId, 1, 5, 10e6, new bytes(64), REF_NONCE, SIGNERS_BITMASK);
    }

    function test_claimRewards_revertInvalidTickRange() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        // toTick < fromTick
        vm.expectRevert(IVision.InvalidTickRange.selector);
        vm.prank(player);
        vision.claimRewards(batchId, 5, 3, 10e6, new bytes(64), REF_NONCE, SIGNERS_BITMASK);
    }

    function test_claimRewards_revertTickAlreadyClaimed() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        // First claim: ticks 1-5
        uint256 newBalance = 10e6;
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CLAIM", batchId, player,
            uint256(1), uint256(5), newBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player);
        vision.claimRewards(batchId, 1, 5, newBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        // Second claim with overlapping ticks (fromTick=3 <= lastClaimedTick=5)
        vm.expectRevert(IVision.TickAlreadyClaimed.selector);
        vm.prank(player);
        vision.claimRewards(batchId, 3, 8, 10e6, new bytes(64), REF_NONCE, SIGNERS_BITMASK);
    }

    function test_claimRewards_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vm.prank(player);
        vision.claimRewards(batchId, 1, 5, 12e6, wrongSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ withdraw ============

    function test_withdraw_happyPath_withProfit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        // Simulate pool having enough to pay out
        usdc.mint(address(vision), 5e6);

        uint256 finalBalance = 14e6; // profit = 4 USDC
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        uint256 expectedFee = 4e6 * 30 / 10000;
        uint256 expectedPayout = finalBalance - expectedFee;

        vm.expectEmit(true, true, false, true);
        emit IVision.PlayerWithdrawn(batchId, player, expectedPayout);

        vm.prank(player);
        vision.withdraw(batchId, finalBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.stakePerTick, 0, "Position should be deleted");
        assertEq(pos.balance, 0, "Position should be deleted");

        assertEq(usdc.balanceOf(player), expectedPayout, "Player gets payout");
        assertEq(vision.accumulatedFees(), expectedFee, "Fees accumulated");
    }

    function test_withdraw_happyPath_withLoss() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        uint256 finalBalance = 7e6;
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player);
        vision.withdraw(batchId, finalBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.stakePerTick, 0, "Position should be deleted");

        assertEq(usdc.balanceOf(player), 7e6, "Player gets remaining balance");
        assertEq(vision.accumulatedFees(), 0, "No fees on loss");
    }

    function test_withdraw_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        vm.expectRevert(IVision.NotJoined.selector);
        vm.prank(player);
        vision.withdraw(batchId, 10e6, new bytes(64), REF_NONCE, SIGNERS_BITMASK);
    }

    function test_withdraw_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vm.prank(player);
        vision.withdraw(batchId, 10e6, wrongSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ getPosition ============

    function test_getPosition_returnsEmptyForNonExistent() public view {
        IVision.PlayerPosition memory pos = vision.getPosition(0, address(0xdead));
        assertEq(pos.stakePerTick, 0, "Non-existent position stakePerTick should be 0");
        assertEq(pos.balance, 0, "Non-existent position balance should be 0");
        assertEq(pos.bitmapHash, bytes32(0), "Non-existent position bitmapHash should be 0");
    }

    // ============ registerBot ============

    function test_registerBot() public {
        address bot = makeAddr("bot1");

        vm.expectEmit(true, false, false, true);
        emit IVision.BotRegistered(bot, "http://bot1.example.com");

        vm.prank(bot);
        vision.registerBot("http://bot1.example.com", keccak256("pubkey1"));

        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 1, "Should have 1 bot");
        assertEq(addrs[0], bot, "Bot address should match");
        assertEq(bots[0].endpoint, "http://bot1.example.com", "Endpoint should match");
        assertEq(bots[0].pubkeyHash, keccak256("pubkey1"), "PubkeyHash should match");
        assertEq(bots[0].registeredAt, block.timestamp, "registeredAt should be current");
        assertTrue(bots[0].isActive, "Bot should be active");
    }

    function test_registerBot_revertAlreadyRegistered() public {
        address bot = makeAddr("bot1");

        vm.prank(bot);
        vision.registerBot("http://bot1.example.com", keccak256("pubkey1"));

        vm.expectRevert(IVision.BotAlreadyRegistered.selector);
        vm.prank(bot);
        vision.registerBot("http://bot1-v2.example.com", keccak256("pubkey1v2"));
    }

    // ============ deregisterBot ============

    function test_deregisterBot() public {
        address bot = makeAddr("bot1");

        vm.prank(bot);
        vision.registerBot("http://bot1.example.com", keccak256("pubkey1"));

        vm.expectEmit(true, false, false, false);
        emit IVision.BotDeregistered(bot);

        vm.prank(bot);
        vision.deregisterBot();

        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 0, "Should have 0 bots after deregister");
        assertEq(bots.length, 0, "Bots array should be empty");
    }

    function test_deregisterBot_swapAndPop() public {
        address bot1 = makeAddr("bot1");
        address bot2 = makeAddr("bot2");
        address bot3 = makeAddr("bot3");

        vm.prank(bot1);
        vision.registerBot("http://bot1.example.com", keccak256("pk1"));
        vm.prank(bot2);
        vision.registerBot("http://bot2.example.com", keccak256("pk2"));
        vm.prank(bot3);
        vision.registerBot("http://bot3.example.com", keccak256("pk3"));

        vm.prank(bot2);
        vision.deregisterBot();

        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 2, "Should have 2 bots after deregister");
        assertEq(addrs[0], bot1, "First bot should be bot1");
        assertEq(addrs[1], bot3, "Second bot should be bot3 (swapped)");
        assertEq(bots[0].endpoint, "http://bot1.example.com", "Bot1 endpoint intact");
        assertEq(bots[1].endpoint, "http://bot3.example.com", "Bot3 endpoint intact");
    }

    function test_deregisterBot_revertNotRegistered() public {
        address bot = makeAddr("unregistered");

        vm.expectRevert(IVision.BotNotRegistered.selector);
        vm.prank(bot);
        vision.deregisterBot();
    }

    // ============ getAllActiveBots ============

    function test_getAllActiveBots() public {
        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 0, "Should start empty");
        assertEq(bots.length, 0, "Should start empty");

        address bot1 = makeAddr("bot1");
        address bot2 = makeAddr("bot2");

        vm.prank(bot1);
        vision.registerBot("http://bot1.example.com", keccak256("pk1"));
        vm.prank(bot2);
        vision.registerBot("http://bot2.example.com", keccak256("pk2"));

        (addrs, bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 2, "Should have 2 bots");
        assertEq(bots.length, 2, "Should have 2 bot structs");
        assertEq(addrs[0], bot1);
        assertEq(addrs[1], bot2);
        assertTrue(bots[0].isActive);
        assertTrue(bots[1].isActive);
    }

    // ============ collectFees ============

    function test_collectFees() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        usdc.mint(address(vision), 5e6);

        uint256 finalBalance = 14e6;
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player);
        vision.withdraw(batchId, finalBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        uint256 expectedFees = 4e6 * 30 / 10000;
        assertEq(vision.accumulatedFees(), expectedFees, "Fees should be accumulated");

        uint256 collectorBalanceBefore = usdc.balanceOf(address(this));
        vision.collectFees();

        assertEq(vision.accumulatedFees(), 0, "Fees should be zero after collection");
        assertEq(usdc.balanceOf(address(this)), collectorBalanceBefore + expectedFees, "Collector should receive fees");
    }

    function test_collectFees_revertUnauthorized() public {
        address notCollector = makeAddr("notCollector");

        vm.expectRevert(IVision.Unauthorized.selector);
        vm.prank(notCollector);
        vision.collectFees();
    }

    // ============ pause ============

    function test_pause_happyPath() public {
        uint256 batchId = _createDefaultBatch();

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", batchId
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectEmit(true, false, false, false);
        emit IVision.BatchPausedEvent(batchId);

        vision.pause(batchId, blsSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertTrue(batch.paused, "Batch should be paused");
    }

    function test_pause_revertBatchNotFound() public {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", uint256(999)
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(IVision.BatchNotFound.selector);
        vision.pause(999, blsSig, REF_NONCE, SIGNERS_BITMASK);
    }

    function test_pause_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vision.pause(batchId, wrongSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ unpause ============

    function test_unpause_happyPath() public {
        uint256 batchId = _createDefaultBatch();

        bytes32 pauseMsg = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", batchId
        ));
        bytes memory pauseSig = signWithTestIssuers(pauseMsg);
        vision.pause(batchId, pauseSig, REF_NONCE, SIGNERS_BITMASK);

        assertTrue(vision.getBatch(batchId).paused, "Should be paused");

        bytes32 unpauseMsg = keccak256(abi.encode(
            block.chainid, address(vision), "UNPAUSE", batchId
        ));
        bytes memory unpauseSig = signWithTestIssuers(unpauseMsg);

        vm.expectEmit(true, false, false, false);
        emit IVision.BatchUnpaused(batchId);

        vision.unpause(batchId, unpauseSig, REF_NONCE, SIGNERS_BITMASK);

        assertFalse(vision.getBatch(batchId).paused, "Should be unpaused");
    }

    function test_unpause_revertBatchNotFound() public {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "UNPAUSE", uint256(999)
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(IVision.BatchNotFound.selector);
        vision.unpause(999, blsSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ forceWithdraw ============

    function test_forceWithdraw_happyPath_withProfit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        usdc.mint(address(vision), 5e6);

        uint256 finalBalance = 14e6;
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "FORCE_WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        uint256 expectedFee = 4e6 * 30 / 10000;
        uint256 expectedPayout = finalBalance - expectedFee;

        vm.expectEmit(true, true, false, true);
        emit IVision.ForceWithdrawn(batchId, player, expectedPayout);

        vision.forceWithdraw(batchId, player, finalBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.stakePerTick, 0, "Position should be deleted");

        assertEq(usdc.balanceOf(player), expectedPayout, "Player gets payout");
        assertEq(vision.accumulatedFees(), expectedFee, "Fees accumulated");
    }

    function test_forceWithdraw_happyPath_withLoss() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));

        uint256 finalBalance = 7e6;
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "FORCE_WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectEmit(true, true, false, true);
        emit IVision.ForceWithdrawn(batchId, player, 7e6);

        vision.forceWithdraw(batchId, player, finalBalance, blsSig, REF_NONCE, SIGNERS_BITMASK);

        assertEq(usdc.balanceOf(player), 7e6, "Player gets remaining balance");
        assertEq(vision.accumulatedFees(), 0, "No fees on loss");
    }

    function test_forceWithdraw_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "FORCE_WITHDRAW", batchId, player, uint256(10e6)
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(IVision.NotJoined.selector);
        vision.forceWithdraw(batchId, player, 10e6, blsSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ pause prevents join ============

    function test_joinBatch_revertWhenPaused() public {
        uint256 batchId = _createDefaultBatch();

        bytes32 pauseMsg = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", batchId
        ));
        bytes memory pauseSig = signWithTestIssuers(pauseMsg);
        vision.pause(batchId, pauseSig, REF_NONCE, SIGNERS_BITMASK);

        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.expectRevert(IVision.BatchPaused.selector);
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));
    }

    // ============ lock window ============

    function test_joinBatch_revertWhenLocked() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        // Advance time to within lock window (last LOCK_OFFSET seconds of tick)
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentAbsoluteTick = block.timestamp / batch.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * batch.tickDuration;
        // Move to tickEnd - lockOffset (exactly at lock boundary)
        vm.warp(tickEnd - batch.lockOffset);

        vm.expectRevert(IVision.TickLocked.selector);
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e6, 1e6, keccak256("bitmap"));
    }

    // ============ currentTickId ============

    function test_currentTickId() public {
        uint256 batchId = _createDefaultBatch();

        uint256 tickId = vision.currentTickId(batchId);
        assertEq(tickId, 0, "Initial tick should be 0");

        // Advance 1 full tick
        vm.warp(block.timestamp + TICK_DURATION);
        assertEq(vision.currentTickId(batchId), 1, "Should be tick 1 after 1 duration");

        // Advance another tick
        vm.warp(block.timestamp + TICK_DURATION);
        assertEq(vision.currentTickId(batchId), 2, "Should be tick 2 after 2 durations");
    }

    function test_currentTickId_revertBatchNotFound() public {
        vm.expectRevert(IVision.BatchNotFound.selector);
        vision.currentTickId(999);
    }
}
