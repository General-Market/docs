// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2, Vm} from "forge-std/Test.sol";
import {Vision} from "../src/vision/Vision.sol";
import {IVision} from "../src/interfaces/IVision.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";
import {Governance} from "../src/Governance.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

/// @title VisionTest — Round-based prediction market tests
/// @notice 14 tests covering the round-based model: joinBatchDirect, settleBatch,
///         updateBitmap, lock windows, fee deduction, solvency.
contract VisionTest is TestHelper {
    Vision public vision;
    MockERC20 public usdc;
    OracleRegistry public oracleRegistry;
    Governance public governance;

    address public player1;
    address public player2;
    address public player3;
    address public collector;

    bytes32 constant SOURCE_ID = keccak256("test_source");
    bytes32 constant CONFIG_HASH = keccak256("test_config");
    uint256 constant TICK_DURATION = 1 hours;
    uint256 constant LOCK_OFFSET = 60; // 60 seconds
    uint256 constant SETTLEMENT_GRACE = 2 hours; // window for the oracle to settle past tick end
    uint256 constant DEPOSIT = 10 ether; // 10 USDC (18 decimals)

    function setUp() public {
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");
        player3 = makeAddr("player3");
        collector = makeAddr("collector");

        usdc = new MockERC20("USDC", "USDC", 18);

        governance = deployGovernance(address(this));
        oracleRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(oracleRegistry, address(this));

        vision = new Vision(
            address(usdc),
            address(oracleRegistry),
            collector
        );

        // Fund players
        usdc.mint(player1, 1000 ether);
        usdc.mint(player2, 1000 ether);
        usdc.mint(player3, 1000 ether);

        // Approve
        vm.prank(player1);
        usdc.approve(address(vision), type(uint256).max);
        vm.prank(player2);
        usdc.approve(address(vision), type(uint256).max);
        vm.prank(player3);
        usdc.approve(address(vision), type(uint256).max);
    }

    // ============ HELPERS ============

    function _createBatch() internal returns (uint256 batchId) {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET, SETTLEMENT_GRACE
        ));
        bytes memory sig = signWithTestOracles(message);
        batchId = vision.createBatch(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET, SETTLEMENT_GRACE,
            sig, REF_NONCE, SIGNERS_BITMASK
        );
    }

    function _joinBatch(uint256 batchId, address player, uint256 deposit) internal {
        bytes32 bitmapHash = keccak256(abi.encode("bitmap", player));
        vm.prank(player);
        vision.joinBatchDirect(batchId, CONFIG_HASH, deposit, bitmapHash);
    }

    function _settleBatch(
        uint256 batchId,
        address[] memory players,
        uint256[] memory payouts
    ) internal {
        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH", batchId, payoutsHash
        ));
        bytes memory sig = signWithTestOracles(message);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ TEST 1: joinBatchDirect deposits USDC ============

    function test_joinBatchDirect_depositsUSDC() public {
        uint256 batchId = _createBatch();

        uint256 balBefore = usdc.balanceOf(player1);
        _joinBatch(batchId, player1, DEPOSIT);
        uint256 balAfter = usdc.balanceOf(player1);

        assertEq(balBefore - balAfter, DEPOSIT, "USDC should transfer from player");
        assertEq(usdc.balanceOf(address(vision)), DEPOSIT, "Vision should hold USDC");

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player1);
        assertEq(pos.totalDeposited, DEPOSIT, "totalDeposited should match");
        assertTrue(pos.joinTimestamp > 0, "joinTimestamp should be set");
    }

    // ============ TEST 2: joinBatchDirect requires approval ============

    function test_joinBatchDirect_requiresApproval() public {
        uint256 batchId = _createBatch();

        address noApproval = makeAddr("noApproval");
        usdc.mint(noApproval, 100 ether);
        // No approval given

        bytes32 bitmapHash = keccak256("bitmap_no_approval");
        vm.prank(noApproval);
        vm.expectRevert(); // SafeERC20 revert
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);
    }

    // ============ TEST 3: joinBatchDirect rejects in lock window ============

    function test_joinBatchDirect_rejectsInLockWindow() public {
        uint256 batchId = _createBatch();

        // Warp to lock window: last 60 seconds of tick
        uint256 currentTick = block.timestamp / TICK_DURATION;
        uint256 tickEnd = (currentTick + 1) * TICK_DURATION;
        vm.warp(tickEnd - LOCK_OFFSET + 1); // inside lock window

        bytes32 bitmapHash = keccak256("bitmap_locked");
        vm.prank(player1);
        vm.expectRevert(IVision.TickLocked.selector);
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);
    }

    // ============ TEST 4: joinBatchDirect rejects duplicate join ============

    function test_joinBatchDirect_rejectsDuplicateJoin() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        bytes32 bitmapHash = keccak256("bitmap_dup");
        vm.prank(player1);
        vm.expectRevert(IVision.AlreadyJoined.selector);
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);
    }

    // ============ TEST 5: settleBatch transfers USDC to players ============

    function test_settleBatch_transfersUSDCToPlayers() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);
        _joinBatch(batchId, player2, DEPOSIT);

        uint256 bal1Before = usdc.balanceOf(player1);
        uint256 bal2Before = usdc.balanceOf(player2);

        // Player1 wins, player2 loses
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        // Sort ascending
        if (uint160(player1) < uint160(player2)) {
            players[0] = player1;
            players[1] = player2;
            payouts[0] = 15 ether; // winner
            payouts[1] = 5 ether;  // loser
        } else {
            players[0] = player2;
            players[1] = player1;
            payouts[0] = 5 ether;
            payouts[1] = 15 ether;
        }

        _settleBatch(batchId, players, payouts);

        // Check USDC arrived in player wallets
        uint256 winnerIdx = uint160(player1) < uint160(player2) ? 0 : 1;
        uint256 loserIdx = 1 - winnerIdx;

        // Winner: profit = 15 - 10 = 5, fee = 5 * 5 / 10000 = 0.0025, net = 14.9975
        uint256 profit = 5 ether;
        uint256 fee = (profit * vision.PROTOCOL_FEE_BPS()) / 10000;
        uint256 expectedWinnerPayout = 15 ether - fee;

        // Loser: no profit, no fee, net = 5
        uint256 expectedLoserPayout = 5 ether;

        address winner = winnerIdx == 0 ? players[0] : players[1];
        address loser = loserIdx == 0 ? players[0] : players[1];

        assertEq(
            usdc.balanceOf(winner) - (winner == player1 ? bal1Before : bal2Before),
            expectedWinnerPayout,
            "Winner should receive payout minus fee"
        );
        assertEq(
            usdc.balanceOf(loser) - (loser == player1 ? bal1Before : bal2Before),
            expectedLoserPayout,
            "Loser should receive remaining payout (no fee on loss)"
        );
    }

    // ============ TEST 6: settleBatch deducts fee on profit ============

    function test_settleBatch_deductsFeeOnProfit() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);
        _joinBatch(batchId, player2, DEPOSIT);

        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        if (uint160(player1) < uint160(player2)) {
            players[0] = player1;
            players[1] = player2;
            payouts[0] = 18 ether; // big winner
            payouts[1] = 2 ether;  // big loser
        } else {
            players[0] = player2;
            players[1] = player1;
            payouts[0] = 2 ether;
            payouts[1] = 18 ether;
        }

        _settleBatch(batchId, players, payouts);

        // Winner profit = 18 - 10 = 8, fee = 8 * 5 / 10000 = 0.004 USDC
        uint256 expectedFee = (8 ether * vision.PROTOCOL_FEE_BPS()) / 10000;
        // Loser has no profit — no fee
        assertEq(vision.accumulatedRealFees(), expectedFee, "Only winner should have fee");
    }

    // ============ TEST 7: settleBatch deletes positions ============

    function test_settleBatch_deletesPositions() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);
        _joinBatch(batchId, player2, DEPOSIT);

        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        if (uint160(player1) < uint160(player2)) {
            players[0] = player1;
            players[1] = player2;
        } else {
            players[0] = player2;
            players[1] = player1;
        }
        payouts[0] = DEPOSIT;
        payouts[1] = DEPOSIT;

        _settleBatch(batchId, players, payouts);

        IVision.PlayerPosition memory pos1 = vision.getPosition(batchId, player1);
        IVision.PlayerPosition memory pos2 = vision.getPosition(batchId, player2);
        assertEq(pos1.totalDeposited, 0, "Player1 position should be deleted");
        assertEq(pos2.totalDeposited, 0, "Player2 position should be deleted");
    }

    // ============ TEST 8: settleBatch rejects double settle ============

    function test_settleBatch_rejectsDoubleSettle() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = player1;
        payouts[0] = DEPOSIT;

        _settleBatch(batchId, players, payouts);

        // Second settle should revert (batch is paused after settlement)
        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH", batchId, payoutsHash
        ));
        bytes memory sig = signWithTestOracles(message);

        vm.expectRevert(IVision.BatchAlreadySettled.selector);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ TEST 9: settleBatch requires BLS ============

    function test_settleBatch_requiresBLS() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = player1;
        payouts[0] = DEPOSIT;

        // Fake signature
        bytes memory fakeSig = new bytes(64);

        vm.expectRevert();
        vision.settleBatch(batchId, players, payouts, fakeSig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ TEST 10: settleBatch conserves USDC (solvency) ============

    function test_settleBatch_conservesUSDC() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);
        _joinBatch(batchId, player2, DEPOSIT);

        // Try to pay out more than deposited
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        if (uint160(player1) < uint160(player2)) {
            players[0] = player1;
            players[1] = player2;
        } else {
            players[0] = player2;
            players[1] = player1;
        }
        payouts[0] = 15 ether;
        payouts[1] = 6 ether; // total 21 > 20 deposited

        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH", batchId, payoutsHash
        ));
        bytes memory sig = signWithTestOracles(message);

        vm.expectRevert(IVision.NonZeroSum.selector);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ TEST 11: full round lifecycle ============

    function test_roundLifecycle_fullCycle() public {
        // Create batch
        uint256 batchId = _createBatch();

        // 3 players join
        _joinBatch(batchId, player1, DEPOSIT);
        _joinBatch(batchId, player2, DEPOSIT);
        _joinBatch(batchId, player3, DEPOSIT);

        uint256 totalDeposited = DEPOSIT * 3; // 30 ether
        assertEq(usdc.balanceOf(address(vision)), totalDeposited);

        // Settle: player1 wins big, others lose
        address[] memory players = new address[](3);
        uint256[] memory payouts = new uint256[](3);

        // Sort addresses ascending
        address[3] memory sorted;
        sorted[0] = player1;
        sorted[1] = player2;
        sorted[2] = player3;
        // Bubble sort
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = i + 1; j < 3; j++) {
                if (uint160(sorted[i]) > uint160(sorted[j])) {
                    address tmp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = tmp;
                }
            }
        }

        uint256 totalPayout;
        for (uint256 i = 0; i < 3; i++) {
            players[i] = sorted[i];
            if (sorted[i] == player1) {
                payouts[i] = 20 ether; // winner
            } else {
                payouts[i] = 5 ether;  // losers
            }
            totalPayout += payouts[i];
        }
        assertEq(totalPayout, totalDeposited, "Payouts must equal deposits (zero-sum)");

        uint256[3] memory balsBefore;
        for (uint256 i = 0; i < 3; i++) {
            balsBefore[i] = usdc.balanceOf(sorted[i]);
        }

        _settleBatch(batchId, players, payouts);

        // Verify USDC arrived in wallets
        for (uint256 i = 0; i < 3; i++) {
            uint256 payout = payouts[i];
            uint256 profit = payout > DEPOSIT ? payout - DEPOSIT : 0;
            uint256 fee = (profit * vision.PROTOCOL_FEE_BPS()) / 10000;
            uint256 netPayout = payout - fee;

            uint256 received = usdc.balanceOf(sorted[i]) - balsBefore[i];
            assertEq(received, netPayout, "Player should receive net payout");
        }

        // Batch should be settled
        IVision.Batch memory b = vision.getBatch(batchId);
        assertTrue(b.settled, "Batch should be settled after settlement");
    }

    // ============ TEST 12: multiple rounds same source ============

    function test_multipleRoundsSameSource() public {
        uint256 batchId1 = _createBatch();
        uint256 batchId2 = _createBatch();

        assertTrue(batchId2 > batchId1, "Second batch should have higher ID");
        assertEq(vision.latestBatchForSource(SOURCE_ID), batchId2, "Latest should be second batch");

        // Both batches are independently joinable
        _joinBatch(batchId1, player1, DEPOSIT);
        _joinBatch(batchId2, player2, DEPOSIT);

        IVision.PlayerPosition memory pos1 = vision.getPosition(batchId1, player1);
        IVision.PlayerPosition memory pos2 = vision.getPosition(batchId2, player2);
        assertEq(pos1.totalDeposited, DEPOSIT);
        assertEq(pos2.totalDeposited, DEPOSIT);
    }

    // ============ TEST 13: updateBitmap works before lock ============

    function test_updateBitmap_worksBeforeLock() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        bytes32 newBitmap = keccak256("new_bitmap");
        vm.prank(player1);
        vision.updateBitmap(batchId, CONFIG_HASH, newBitmap);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player1);
        assertEq(pos.bitmapHash, newBitmap, "Bitmap should be updated");
    }

    // ============ TEST 14: updateBitmap rejects after lock ============

    function test_updateBitmap_rejectsAfterLock() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        // Warp to lock window
        uint256 currentTick = block.timestamp / TICK_DURATION;
        uint256 tickEnd = (currentTick + 1) * TICK_DURATION;
        vm.warp(tickEnd - LOCK_OFFSET + 1);

        bytes32 newBitmap = keccak256("locked_bitmap");
        vm.prank(player1);
        vm.expectRevert(IVision.TickLocked.selector);
        vision.updateBitmap(batchId, CONFIG_HASH, newBitmap);
    }

    // ============ TEST 15: settleBatch reverts on non-zero-sum payouts ============

    /// @notice The fund-leak bug guard. Settlement must distribute exactly
    ///         what was deposited — no more, no less. Underflow leaks USDC
    ///         into nowhere; overflow drains the contract.
    function test_settleBatch_revertsOnNonZeroSum() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);
        _joinBatch(batchId, player2, DEPOSIT);

        // Sort ascending
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        if (uint160(player1) < uint160(player2)) {
            players[0] = player1;
            players[1] = player2;
        } else {
            players[0] = player2;
            players[1] = player1;
        }

        // Total deposits = 20 ether. Pay out only 19 ether (1 ether vanishes).
        payouts[0] = 10 ether;
        payouts[1] = 9 ether;

        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH", batchId, payoutsHash
        ));
        bytes memory sig = signWithTestOracles(message);

        vm.expectRevert(IVision.NonZeroSum.selector);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }

    // ============ TEST 16: PlayerJoined emits the full deposit ============

    /// @notice Regression for the original bug: the event must carry the full
    ///         deposit amount, not a smaller "stake" parameter the oracle would
    ///         have used to compute payouts against.
    function test_joinBatchDirect_emitsFullDepositInEvent() public {
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256(abi.encode("bitmap", player1));

        vm.recordLogs();
        vm.prank(player1);
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        Vm.Log[] memory entries = vm.getRecordedLogs();

        bytes32 sig = keccak256("PlayerJoined(uint256,address,uint256,bytes32,bytes32)");
        bool found;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics.length > 0 && entries[i].topics[0] == sig) {
                // topics: [sig, batchId, player]; data: deposit, bitmapHash, configHash
                (uint256 depositArg, bytes32 bmHash, bytes32 cfgHash) =
                    abi.decode(entries[i].data, (uint256, bytes32, bytes32));
                assertEq(depositArg, DEPOSIT, "Event must carry full depositAmount");
                assertEq(bmHash, bitmapHash, "Event bitmapHash must match");
                assertEq(cfgHash, CONFIG_HASH, "Event configHash must match");
                found = true;
                break;
            }
        }
        assertTrue(found, "PlayerJoined event must be emitted");
    }

    // ============ REFUND TESTS ============

    /// @notice After settlementGrace expires without settlement, the player
    ///         can pull back exactly what they deposited. No fee.
    function test_claimRefund_returnsDeposit() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        uint256 balBefore = usdc.balanceOf(player1);

        // Warp past expiration: end of tick + grace + 1
        uint256 expiration = vision.batchExpirationTime(batchId);
        vm.warp(expiration + 1);

        vm.prank(player1);
        vision.claimRefund(batchId);

        assertEq(
            usdc.balanceOf(player1) - balBefore,
            DEPOSIT,
            "Player must receive full deposit, no fee"
        );

        // Position cleared — repeat refund must revert
        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player1);
        assertEq(pos.totalDeposited, 0, "Position deleted after refund");
    }

    /// @notice settleBatch must revert past the cliff. The oracle has lost
    ///         the right to decide; only refunds are legal now.
    function test_settleBatch_rejectedPastExpiration() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        uint256 expiration = vision.batchExpirationTime(batchId);
        vm.warp(expiration + 1);

        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = player1;
        payouts[0] = DEPOSIT;

        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH", batchId, payoutsHash
        ));
        bytes memory sig = signWithTestOracles(message);

        vm.expectRevert(IVision.SettlementWindowClosed.selector);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }

    /// @notice Refund attempted before grace expires must revert.
    function test_claimRefund_rejectedBeforeExpiration() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        // Still inside the grace window
        vm.prank(player1);
        vm.expectRevert(IVision.NotYetRefundable.selector);
        vision.claimRefund(batchId);
    }

    /// @notice Double-refund must revert. The position-deletion sentinel is
    ///         the per-player guard.
    function test_claimRefund_rejectsDouble() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        vm.warp(vision.batchExpirationTime(batchId) + 1);

        vm.prank(player1);
        vision.claimRefund(batchId);

        vm.prank(player1);
        vm.expectRevert(IVision.NotJoined.selector);
        vision.claimRefund(batchId);
    }

    /// @notice Refund on an already-settled batch must revert. Settlement
    ///         already paid the player; there's nothing to refund.
    function test_claimRefund_rejectsSettled() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        // Settle inside the window
        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = player1;
        payouts[0] = DEPOSIT;
        _settleBatch(batchId, players, payouts);

        // Past the cliff — but the batch is already settled
        vm.warp(vision.batchExpirationTime(batchId) + 1);

        vm.prank(player1);
        vm.expectRevert(IVision.BatchAlreadySettled.selector);
        vision.claimRefund(batchId);
    }

    /// @notice claimRefundFor — anyone can pay gas to rescue any player.
    ///         USDC always lands in the player's wallet, never the caller's.
    function test_claimRefundFor_paysOriginalPlayer() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        vm.warp(vision.batchExpirationTime(batchId) + 1);

        uint256 player1Before = usdc.balanceOf(player1);
        uint256 player2Before = usdc.balanceOf(player2);

        vm.prank(player2); // someone else fires the rescue
        vision.claimRefundFor(batchId, player1);

        assertEq(
            usdc.balanceOf(player1) - player1Before,
            DEPOSIT,
            "Player1 receives the deposit, even though player2 called"
        );
        assertEq(
            usdc.balanceOf(player2),
            player2Before,
            "Caller wallet must not be touched"
        );
    }

    /// @notice settlementGrace bounds: zero, below MIN, and above MAX must
    ///         all revert. The oracle gets at least one minute, never more
    ///         than 24 hours.
    function test_createBatch_rejectsInvalidSettlementGrace() public {
        // Zero grace
        bytes32 sourceA = keccak256("grace_test_zero");
        bytes32 cfgA = keccak256("cfg_zero");
        bytes32 messageA = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            sourceA, cfgA, TICK_DURATION, LOCK_OFFSET, uint256(0)
        ));
        bytes memory sigA = signWithTestOracles(messageA);
        vm.expectRevert(IVision.InvalidSettlementGrace.selector);
        vision.createBatch(
            sourceA, cfgA, TICK_DURATION, LOCK_OFFSET, 0,
            sigA, REF_NONCE, SIGNERS_BITMASK
        );

        // Above MAX_SETTLEMENT_GRACE
        bytes32 sourceB = keccak256("grace_test_huge");
        bytes32 cfgB = keccak256("cfg_huge");
        uint256 tooBig = vision.MAX_SETTLEMENT_GRACE() + 1;
        bytes32 messageB = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            sourceB, cfgB, TICK_DURATION, LOCK_OFFSET, tooBig
        ));
        bytes memory sigB = signWithTestOracles(messageB);
        vm.expectRevert(IVision.InvalidSettlementGrace.selector);
        vision.createBatch(
            sourceB, cfgB, TICK_DURATION, LOCK_OFFSET, tooBig,
            sigB, REF_NONCE, SIGNERS_BITMASK
        );
    }

    /// @notice The expiration view matches the formula: tick end + grace.
    function test_batchExpirationTime_matchesFormula() public {
        uint256 batchId = _createBatch();
        IVision.Batch memory b = vision.getBatch(batchId);
        uint256 expected = (b.createdAtTick + 1) * b.tickDuration + b.settlementGrace;
        assertEq(vision.batchExpirationTime(batchId), expected, "expiration formula");
    }
}
