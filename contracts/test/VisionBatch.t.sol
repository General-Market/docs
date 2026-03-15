// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Vision} from "../src/vision/Vision.sol";
import {IVision} from "../src/interfaces/IVision.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";
import {Governance} from "../src/Governance.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

/// @title VisionBatchTest — Hash-based batch tests
/// @notice Tests for config hash computation, createBatchAndJoin idempotency,
///         lazy config promotion, and lock window enforcement.
contract VisionBatchTest is TestHelper {
    Vision public vision;
    MockERC20 public usdc;
    OracleRegistry public oracleRegistry;
    Governance public governance;

    // Default test params
    bytes32 constant SOURCE_ID = keccak256("crypto");
    bytes32 constant CONFIG_HASH = keccak256("config_v1");
    bytes32 constant CONFIG_HASH_V2 = keccak256("config_v2");
    uint256 constant TICK_DURATION = 600; // 10 minutes
    uint256 constant LOCK_OFFSET = 90;   // 90 seconds

    function setUp() public {
        // Deploy mock tokens
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy governance and oracle registry for BLS verification
        governance = deployGovernance(address(this));
        oracleRegistry = deployOracleRegistry(address(governance));

        // Register test oracles and set aggregated pubkey
        registerTestOraclesWithBLS(oracleRegistry, address(this));

        // Deploy Vision
        vision = new Vision(
            address(usdc),
            address(oracleRegistry),
            address(this) // feeCollector
        );
    }

    // ── Helpers ──

    function _signCreateBatch(
        bytes32 sourceId,
        bytes32 configHash,
        uint256 tickDuration,
        uint256 lockOffset
    ) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            sourceId,
            configHash,
            tickDuration,
            lockOffset
        ));
        return signWithTestOracles(message);
    }

    function _signUpdateConfig(
        uint256 batchId,
        bytes32 configHash,
        uint256 lockOffset,
        uint256 tickDuration
    ) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "UPDATE_BATCH_CONFIG",
            batchId,
            configHash,
            lockOffset,
            tickDuration
        ));
        return signWithTestOracles(message);
    }

    function _createBatch() internal returns (uint256 batchId) {
        bytes memory blsSig = _signCreateBatch(SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET);
        batchId = vision.createBatch(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK
        );
    }

    function _preparePlayer(address player, uint256 amount) internal {
        usdc.mint(player, amount);
        vm.startPrank(player);
        usdc.approve(address(vision), type(uint256).max);
        vision.depositBalance(amount);
        vm.stopPrank();
    }

    // ════════════════════════════════════════════════
    // Test 1: Config hash computation matches expected structure
    // ════════════════════════════════════════════════

    function test_configHashStructure() public pure {
        // Verify the hash structure used in batch creation domain tag
        // This hash should match what Rust's ethers::abi::encode produces
        bytes32 marketHash = keccak256(abi.encode(
            "bitcoin",     // asset_id (String)
            "up_x",        // resolution_type (String)
            uint256(200)   // threshold_bps
        ));
        assertTrue(marketHash != bytes32(0), "market hash should be non-zero");

        // Markets root = keccak256 of concatenated sorted market hashes
        bytes32 marketsRoot = keccak256(abi.encodePacked(marketHash));
        assertTrue(marketsRoot != bytes32(0), "markets root should be non-zero");

        // Outer config hash = keccak256(abi.encode(source_id, tick_duration, lock_offset, marketsRoot))
        bytes32 configHash = keccak256(abi.encode(
            "crypto",       // source_id
            uint256(600),   // tick_duration
            uint256(90),    // lock_offset
            marketsRoot     // FixedBytes(32)
        ));
        assertTrue(configHash != bytes32(0), "config hash should be non-zero");

        // Multi-market: verify deterministic ordering matters
        bytes32 marketHashBtc = keccak256(abi.encode("bitcoin", "up_x", uint256(200)));
        bytes32 marketHashEth = keccak256(abi.encode("ethereum", "up_x", uint256(300)));

        // Sorted: bitcoin < ethereum (lexicographic)
        bytes32 rootAB = keccak256(abi.encodePacked(marketHashBtc, marketHashEth));
        bytes32 rootBA = keccak256(abi.encodePacked(marketHashEth, marketHashBtc));

        // Different orderings produce different roots
        assertTrue(rootAB != rootBA, "order must matter for config hash");
    }

    function test_configHashDeterministic() public pure {
        // Same inputs should always produce same hash
        bytes32 hash1 = keccak256(abi.encode(
            "crypto", uint256(600), uint256(90),
            keccak256(abi.encodePacked(
                keccak256(abi.encode("bitcoin", "up_x", uint256(200)))
            ))
        ));
        bytes32 hash2 = keccak256(abi.encode(
            "crypto", uint256(600), uint256(90),
            keccak256(abi.encodePacked(
                keccak256(abi.encode("bitcoin", "up_x", uint256(200)))
            ))
        ));
        assertEq(hash1, hash2, "Config hash should be deterministic");
    }

    // ════════════════════════════════════════════════
    // Test 2: createBatchAndJoin idempotency
    // ════════════════════════════════════════════════

    function test_createBatchAndJoin_firstCallCreatesBatch() public {
        address player = makeAddr("player1");
        _preparePlayer(player, 10e18);

        bytes memory blsSig = _signCreateBatch(SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET);

        vm.prank(player);
        uint256 batchId = vision.createBatchAndJoin(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK,
            10e18, 1e18, keccak256("bitmap")
        );

        assertEq(batchId, 0, "First batch should be ID 0");
        assertTrue(vision.sourceIdHasBatch(SOURCE_ID), "sourceId should have batch");
        assertEq(vision.sourceIdToBatchId(SOURCE_ID), 0, "sourceId should map to batch 0");

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.sourceId, SOURCE_ID);
        assertEq(batch.configHash, CONFIG_HASH);
        assertEq(batch.tickDuration, TICK_DURATION);
        assertEq(batch.lockOffset, LOCK_OFFSET);
    }

    function test_createBatchAndJoin_secondCallJoinsExisting() public {
        // Player 1 creates batch
        address player1 = makeAddr("player1");
        _preparePlayer(player1, 10e18);

        bytes memory blsSig = _signCreateBatch(SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET);

        vm.prank(player1);
        uint256 batchId1 = vision.createBatchAndJoin(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK,
            10e18, 1e18, keccak256("bitmap1")
        );

        // Player 2 calls createBatchAndJoin with same sourceId
        address player2 = makeAddr("player2");
        _preparePlayer(player2, 5e18);

        vm.prank(player2);
        uint256 batchId2 = vision.createBatchAndJoin(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK,
            5e18, 1e18, keccak256("bitmap2")
        );

        // Should return same batch ID — no new batch created
        assertEq(batchId1, batchId2, "Should join existing batch, not create new");
        assertEq(vision.nextBatchId(), 1, "Only 1 batch should exist");

        // Both players should have positions
        assertTrue(vision.getPosition(batchId1, player1).stakePerTick > 0, "Player 1 should have position");
        assertTrue(vision.getPosition(batchId2, player2).stakePerTick > 0, "Player 2 should have position");
    }

    function test_createBatchAndJoin_differentSourceIds() public {
        address player = makeAddr("player1");
        _preparePlayer(player, 20e18);

        bytes32 sourceA = keccak256("source_A");
        bytes32 sourceB = keccak256("source_B");
        bytes32 configA = keccak256("config_A");
        bytes32 configB = keccak256("config_B");

        bytes memory sigA = _signCreateBatch(sourceA, configA, TICK_DURATION, LOCK_OFFSET);
        bytes memory sigB = _signCreateBatch(sourceB, configB, TICK_DURATION, LOCK_OFFSET);

        vm.prank(player);
        uint256 batchIdA = vision.createBatchAndJoin(
            sourceA, configA, TICK_DURATION, LOCK_OFFSET,
            sigA, REF_NONCE, SIGNERS_BITMASK,
            10e18, 1e18, keccak256("bitmapA")
        );

        // Need a second player for batch B since player already joined A
        address player2 = makeAddr("player2");
        _preparePlayer(player2, 10e18);

        vm.prank(player2);
        uint256 batchIdB = vision.createBatchAndJoin(
            sourceB, configB, TICK_DURATION, LOCK_OFFSET,
            sigB, REF_NONCE, SIGNERS_BITMASK,
            10e18, 1e18, keccak256("bitmapB")
        );

        assertEq(batchIdA, 0, "First source should get batch 0");
        assertEq(batchIdB, 1, "Second source should get batch 1");
        assertTrue(vision.sourceIdHasBatch(sourceA));
        assertTrue(vision.sourceIdHasBatch(sourceB));
    }

    // ════════════════════════════════════════════════
    // Test 3: Lazy config promotion
    // ════════════════════════════════════════════════

    function test_lazyPromotion_nextConfigPromotedAtTickBoundary() public {
        uint256 batchId = _createBatch();

        IVision.Batch memory batchBefore = vision.getBatch(batchId);
        assertEq(batchBefore.configHash, CONFIG_HASH, "Initial config should be CONFIG_HASH");
        assertEq(batchBefore.nextConfigHash, bytes32(0), "No pending config initially");

        // Stage a new config via updateBatchConfig
        uint256 newLockOffset = 120;
        bytes memory updateSig = _signUpdateConfig(batchId, CONFIG_HASH_V2, newLockOffset, TICK_DURATION);
        vision.updateBatchConfig(batchId, CONFIG_HASH_V2, newLockOffset, TICK_DURATION, updateSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.Batch memory batchAfterUpdate = vision.getBatch(batchId);
        assertEq(batchAfterUpdate.configHash, CONFIG_HASH, "Active config should not change yet");
        assertEq(batchAfterUpdate.nextConfigHash, CONFIG_HASH_V2, "Pending config should be V2");
        assertEq(batchAfterUpdate.nextLockOffset, newLockOffset, "Pending lock offset should be new");

        // Advance time to next tick boundary
        vm.warp(block.timestamp + TICK_DURATION);

        // Calling any user function triggers promotion
        // We use getBatchIdBySourceId which doesn't trigger promotion,
        // but joinBatch does. Let's have a player join to trigger it.
        address player = makeAddr("player_promotion");
        _preparePlayer(player, 10e18);

        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH_V2, 10e18, 1e18, keccak256("bitmap"));

        // Now check that config was promoted
        IVision.Batch memory batchAfterPromotion = vision.getBatch(batchId);
        assertEq(batchAfterPromotion.configHash, CONFIG_HASH_V2, "Config should be promoted to V2");
        assertEq(batchAfterPromotion.nextConfigHash, bytes32(0), "Pending should be cleared");
        assertEq(batchAfterPromotion.lockOffset, newLockOffset, "Lock offset should be updated");
        assertEq(batchAfterPromotion.nextLockOffset, 0, "Pending lock offset should be cleared");
    }

    function test_lazyPromotion_noPromotionWithinSameTick() public {
        uint256 batchId = _createBatch();

        // Stage a new config
        bytes memory updateSig = _signUpdateConfig(batchId, CONFIG_HASH_V2, LOCK_OFFSET, TICK_DURATION);
        vision.updateBatchConfig(batchId, CONFIG_HASH_V2, LOCK_OFFSET, TICK_DURATION, updateSig, REF_NONCE, SIGNERS_BITMASK);

        // DO NOT advance time — still in same tick
        // Join should use the OLD config
        address player = makeAddr("player_same_tick");
        _preparePlayer(player, 10e18);

        // Should require the original CONFIG_HASH since promotion hasn't happened
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e18, 1e18, keccak256("bitmap"));

        // Config should still be the original
        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.configHash, CONFIG_HASH, "Config should NOT be promoted within same tick");
        assertEq(batch.nextConfigHash, CONFIG_HASH_V2, "Pending should still be waiting");
    }

    function test_lazyPromotion_emitsEvent() public {
        uint256 batchId = _createBatch();

        // Stage V2
        bytes memory updateSig = _signUpdateConfig(batchId, CONFIG_HASH_V2, LOCK_OFFSET, TICK_DURATION);
        vision.updateBatchConfig(batchId, CONFIG_HASH_V2, LOCK_OFFSET, TICK_DURATION, updateSig, REF_NONCE, SIGNERS_BITMASK);

        // Advance to next tick
        vm.warp(block.timestamp + TICK_DURATION);

        // Expect BatchConfigPromoted event
        // The exact tick number depends on warp, so we check indexed fields
        vm.expectEmit(true, false, false, false);
        emit IVision.BatchConfigPromoted(batchId, CONFIG_HASH, CONFIG_HASH_V2, 0);

        // Trigger promotion via updateBatchConfig (which calls _promoteConfigIfNeeded)
        bytes32 configV3 = keccak256("config_v3");
        bytes memory updateSig2 = _signUpdateConfig(batchId, configV3, LOCK_OFFSET, TICK_DURATION);
        vision.updateBatchConfig(batchId, configV3, LOCK_OFFSET, TICK_DURATION, updateSig2, REF_NONCE, SIGNERS_BITMASK);
    }

    function test_updateBatchConfig_noopIfSameAsActive() public {
        uint256 batchId = _createBatch();

        // Try to update with same configHash as active — should no-op
        bytes memory updateSig = _signUpdateConfig(batchId, CONFIG_HASH, LOCK_OFFSET, TICK_DURATION);
        // This should return without reverting (no-op path in the contract)
        vision.updateBatchConfig(batchId, CONFIG_HASH, LOCK_OFFSET, TICK_DURATION, updateSig, REF_NONCE, SIGNERS_BITMASK);

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.nextConfigHash, bytes32(0), "No pending config for no-op");
    }

    // ════════════════════════════════════════════════
    // Test 4: Lock window enforcement
    // ════════════════════════════════════════════════

    function test_lockWindow_joinBatchRevertsInLockPeriod() public {
        uint256 batchId = _createBatch();
        address player = makeAddr("player_lock");
        _preparePlayer(player, 10e18);

        // Compute lock boundary
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentAbsoluteTick = block.timestamp / batch.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * batch.tickDuration;
        uint256 lockStart = tickEnd - batch.lockOffset;

        // Warp to exactly the lock boundary
        vm.warp(lockStart);

        vm.expectRevert(IVision.TickLocked.selector);
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e18, 1e18, keccak256("bitmap"));
    }

    function test_lockWindow_joinBatchSucceedsBeforeLockPeriod() public {
        uint256 batchId = _createBatch();
        address player = makeAddr("player_before_lock");
        _preparePlayer(player, 10e18);

        // Compute one second before lock boundary
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentAbsoluteTick = block.timestamp / batch.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * batch.tickDuration;
        uint256 lockStart = tickEnd - batch.lockOffset;

        // Warp to 1 second before lock
        vm.warp(lockStart - 1);

        // Should succeed
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e18, 1e18, keccak256("bitmap"));

        assertTrue(vision.getPosition(batchId, player).stakePerTick > 0);
    }

    function test_lockWindow_updateBitmapRevertsInLockPeriod() public {
        uint256 batchId = _createBatch();
        address player = makeAddr("player_bitmap_lock");
        _preparePlayer(player, 10e18);

        // Join before lock period
        vm.prank(player);
        vision.joinBatch(batchId, CONFIG_HASH, 10e18, 1e18, keccak256("bitmap_old"));

        // Warp to lock period
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentAbsoluteTick = block.timestamp / batch.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * batch.tickDuration;
        vm.warp(tickEnd - batch.lockOffset);

        vm.expectRevert(IVision.TickLocked.selector);
        vm.prank(player);
        vision.updateBitmap(batchId, CONFIG_HASH, keccak256("bitmap_new"));
    }

    function test_lockWindow_updateBatchConfigRevertsInLockPeriod() public {
        uint256 batchId = _createBatch();

        // Warp to lock period
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentAbsoluteTick = block.timestamp / batch.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * batch.tickDuration;
        vm.warp(tickEnd - batch.lockOffset);

        bytes memory updateSig = _signUpdateConfig(batchId, CONFIG_HASH_V2, LOCK_OFFSET, TICK_DURATION);
        vm.expectRevert(IVision.TickLocked.selector);
        vision.updateBatchConfig(batchId, CONFIG_HASH_V2, LOCK_OFFSET, TICK_DURATION, updateSig, REF_NONCE, SIGNERS_BITMASK);
    }

    function test_lockWindow_zeroLockOffsetNeverLocks() public {
        // Create batch with zero lock offset
        bytes32 sourceId = keccak256("no_lock_source");
        bytes32 configHash = keccak256("no_lock_config");
        uint256 zeroLock = 0;

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            sourceId, configHash, TICK_DURATION, zeroLock
        ));
        bytes memory blsSig = signWithTestOracles(message);

        uint256 batchId = vision.createBatch(
            sourceId, configHash, TICK_DURATION, zeroLock,
            blsSig, REF_NONCE, SIGNERS_BITMASK
        );

        // Warp to very end of tick (1 second before)
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentAbsoluteTick = block.timestamp / batch.tickDuration;
        uint256 tickEnd = (currentAbsoluteTick + 1) * batch.tickDuration;
        vm.warp(tickEnd - 1);

        // Should NOT revert — zero lock offset means no lock window
        address player = makeAddr("player_no_lock");
        _preparePlayer(player, 10e18);

        vm.prank(player);
        vision.joinBatch(batchId, configHash, 10e18, 1e18, keccak256("bitmap"));

        assertTrue(vision.getPosition(batchId, player).stakePerTick > 0);
    }

    // ════════════════════════════════════════════════
    // Test 5: currentTickId edge cases
    // ════════════════════════════════════════════════

    function test_currentTickId_incrementsCorrectly() public {
        uint256 batchId = _createBatch();

        assertEq(vision.currentTickId(batchId), 0, "Initial tick should be 0");

        // Use absolute tick boundaries to avoid block.timestamp stale-read issues in Foundry
        IVision.Batch memory b = vision.getBatch(batchId);
        uint256 createdAtTick = b.createdAtTick;

        vm.warp((createdAtTick + 1) * TICK_DURATION);
        assertEq(vision.currentTickId(batchId), 1, "After 1 tick duration");

        vm.warp((createdAtTick + 2) * TICK_DURATION);
        assertEq(vision.currentTickId(batchId), 2, "After 2 tick durations");

        vm.warp((createdAtTick + 12) * TICK_DURATION);
        assertEq(vision.currentTickId(batchId), 12, "After 12 tick durations total");
    }

    // ════════════════════════════════════════════════
    // Test 6: BLS domain separation
    // ════════════════════════════════════════════════

    function test_blsDomainSeparation_createVsUpdate() public {
        // Create uses "CREATE_BATCH" domain tag
        bytes32 createMsg = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET
        ));

        // Update uses "UPDATE_BATCH_CONFIG" domain tag
        bytes32 updateMsg = keccak256(abi.encode(
            block.chainid, address(vision), "UPDATE_BATCH_CONFIG",
            uint256(0), CONFIG_HASH, LOCK_OFFSET
        ));

        // Domain tags ensure messages are different even with overlapping params
        assertTrue(createMsg != updateMsg, "Create and update messages must differ");
    }

    function test_blsDomainSeparation_differentChainIds() public pure {
        // Same params but different chain IDs must produce different hashes
        bytes32 msgChain1 = keccak256(abi.encode(
            uint256(1), address(0x1234), "CREATE_BATCH",
            bytes32(0), bytes32(0), uint256(600), uint256(90)
        ));
        bytes32 msgChain2 = keccak256(abi.encode(
            uint256(2), address(0x1234), "CREATE_BATCH",
            bytes32(0), bytes32(0), uint256(600), uint256(90)
        ));
        assertTrue(msgChain1 != msgChain2, "Different chain IDs must produce different messages");
    }

    // ════════════════════════════════════════════════
    // Test 7: getBatchIdBySourceId
    // ════════════════════════════════════════════════

    function test_getBatchIdBySourceId_revertsIfNoBatch() public {
        bytes32 unknownSource = keccak256("unknown_source");
        vm.expectRevert(IVision.BatchNotFound.selector);
        vision.getBatchIdBySourceId(unknownSource);
    }

    function test_getBatchIdBySourceId_returnsCorrectId() public {
        uint256 batchId = _createBatch();
        assertEq(vision.getBatchIdBySourceId(SOURCE_ID), batchId);
    }

    // ════════════════════════════════════════════════
    // Test 8: MAX_BATCHES cap enforcement
    // ════════════════════════════════════════════════

    function test_createBatch_revertsAtMaxBatches() public {
        // Force nextBatchId to MAX_BATCHES (200) via direct storage write.
        // nextBatchId is at slot 2 per `forge inspect Vision storage-layout`.
        // This skips creating 200 real batches (200 BLS FFI calls would be impractical).
        // The cap check fires before BLS verification, so BLS is irrelevant here.
        vm.store(address(vision), bytes32(uint256(2)), bytes32(uint256(200)));
        assertEq(vision.nextBatchId(), 200, "Storage write sanity check");

        // Attempt to create one more batch — must revert with TooManyBatches
        bytes32 overflowSource = keccak256("overflow_source");
        bytes32 overflowConfig = keccak256("overflow_config");
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "CREATE_BATCH",
            overflowSource,
            overflowConfig,
            TICK_DURATION,
            LOCK_OFFSET
        ));
        bytes memory blsSig = signWithTestOracles(message);

        vm.expectRevert(IVision.TooManyBatches.selector);
        vision.createBatch(
            overflowSource, overflowConfig, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK
        );
    }

    function test_createBatch_idempotentCallDoesNotCountTowardsCap() public {
        // Create a real batch so sourceIdHasBatch[SOURCE_ID] = true
        _createBatch();

        // Force nextBatchId to MAX_BATCHES — cap is reached
        vm.store(address(vision), bytes32(uint256(2)), bytes32(uint256(200)));

        // Idempotent call (same sourceId) must still succeed — it short-circuits before the cap check
        bytes memory blsSig = _signCreateBatch(SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET);
        uint256 batchId = vision.createBatch(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            blsSig, REF_NONCE, SIGNERS_BITMASK
        );
        assertEq(batchId, 0, "Idempotent call should return existing batch 0");
        assertEq(vision.nextBatchId(), 200, "nextBatchId should be unchanged");
    }
}
