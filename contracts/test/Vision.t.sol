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
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET
        ));
        bytes memory sig = signWithTestOracles(message);
        batchId = vision.createBatch(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            sig, REF_NONCE, SIGNERS_BITMASK
        );
    }

    function _joinBatch(uint256 batchId, address player, uint256 deposit) internal {
        bytes32 bitmapHash = keccak256(abi.encode("bitmap", player));
        vm.prank(player);
        vision.joinBatchDirect(batchId, CONFIG_HASH, deposit, deposit, bitmapHash);
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
        assertEq(pos.deposit, DEPOSIT, "Position deposit should match");
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
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, DEPOSIT, bitmapHash);
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
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, DEPOSIT, bitmapHash);
    }

    // ============ TEST 4: joinBatchDirect rejects duplicate join ============

    function test_joinBatchDirect_rejectsDuplicateJoin() public {
        uint256 batchId = _createBatch();
        _joinBatch(batchId, player1, DEPOSIT);

        bytes32 bitmapHash = keccak256("bitmap_dup");
        vm.prank(player1);
        vm.expectRevert(IVision.AlreadyJoined.selector);
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, DEPOSIT, bitmapHash);
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

        // Winner: profit = 15 - 10 = 5, fee = 5 * 30 / 10000 = 0.015, net = 14.985
        uint256 profit = 5 ether;
        uint256 fee = (profit * 30) / 10000;
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

        // Winner profit = 18 - 10 = 8, fee = 8 * 30 / 10000 = 0.024 USDC
        uint256 expectedFee = (8 ether * 30) / 10000;
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
        assertEq(pos1.deposit, 0, "Player1 position should be deleted");
        assertEq(pos2.deposit, 0, "Player2 position should be deleted");
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

        vm.expectRevert(IVision.InsolventPayout.selector);
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
            uint256 fee = (profit * 30) / 10000;
            uint256 netPayout = payout - fee;

            uint256 received = usdc.balanceOf(sorted[i]) - balsBefore[i];
            assertEq(received, netPayout, "Player should receive net payout");
        }

        // Batch should be settled (paused)
        IVision.Batch memory b = vision.getBatch(batchId);
        assertTrue(b.paused, "Batch should be paused after settlement");
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
        assertEq(pos1.deposit, DEPOSIT);
        assertEq(pos2.deposit, DEPOSIT);
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
}
