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

    // ============ createBatch ============

    function test_createBatch() public {
        bytes32[] memory marketIds = new bytes32[](2);
        marketIds[0] = keccak256("BTC-USD");
        marketIds[1] = keccak256("ETH-USD");

        uint8[] memory resolutionTypes = new uint8[](2);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);
        resolutionTypes[1] = uint8(IVision.ResolutionType.DOWN_30);

        uint256 tickDuration = 1 hours;
        uint256[] memory customThresholds = new uint256[](0);

        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, tickDuration, customThresholds);

        assertEq(batchId, 0, "First batch should have ID 0");

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.creator, creator, "Creator should be msg.sender");
        assertEq(batch.marketIds.length, 2, "Should have 2 market IDs");
        assertEq(batch.marketIds[0], marketIds[0], "First market ID should match");
        assertEq(batch.marketIds[1], marketIds[1], "Second market ID should match");
        assertEq(batch.resolutionTypes.length, 2, "Should have 2 resolution types");
        assertEq(batch.resolutionTypes[0], resolutionTypes[0], "First resolution type should match");
        assertEq(batch.resolutionTypes[1], resolutionTypes[1], "Second resolution type should match");
        assertEq(batch.tickDuration, tickDuration, "Tick duration should match");
        assertEq(batch.createdAtTick, block.timestamp / tickDuration, "Created at tick should match");
        assertEq(batch.paused, false, "Batch should not be paused");

        // Second batch should get ID 1
        vm.prank(creator);
        uint256 batchId2 = vision.createBatch(marketIds, resolutionTypes, tickDuration, customThresholds);
        assertEq(batchId2, 1, "Second batch should have ID 1");
        assertEq(vision.nextBatchId(), 2, "nextBatchId should be 2");
    }

    function test_createBatch_emitsEvent() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256 tickDuration = 1 hours;
        uint256[] memory customThresholds = new uint256[](0);

        vm.expectEmit(true, true, false, true);
        emit Vision.BatchCreated(0, creator, tickDuration);

        vm.prank(creator);
        vision.createBatch(marketIds, resolutionTypes, tickDuration, customThresholds);
    }

    function test_createBatch_revertOnMismatch() public {
        bytes32[] memory marketIds = new bytes32[](2);
        marketIds[0] = keccak256("BTC-USD");
        marketIds[1] = keccak256("ETH-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.expectRevert(Vision.ArrayLengthMismatch.selector);
        vm.prank(creator);
        vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);
    }

    function test_createBatch_revertZeroTickDuration() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.expectRevert(Vision.InvalidTickDuration.selector);
        vm.prank(creator);
        vision.createBatch(marketIds, resolutionTypes, 0, customThresholds);
    }

    function test_createBatch_revertExcessiveTickDuration() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        // 30 days + 1 second should revert
        vm.expectRevert(Vision.InvalidTickDuration.selector);
        vm.prank(creator);
        vision.createBatch(marketIds, resolutionTypes, 30 days + 1, customThresholds);
    }

    function test_createBatch_maxTickDuration() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        // Exactly 30 days should succeed
        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, 30 days, customThresholds);
        assertEq(batchId, 0);
    }

    function test_createBatch_storesCustomThresholds() public {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_X);

        uint256[] memory customThresholds = new uint256[](2);
        customThresholds[0] = 500; // 5%
        customThresholds[1] = 1000; // 10%

        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertEq(batch.customThresholds.length, 2);
        assertEq(batch.customThresholds[0], 500);
        assertEq(batch.customThresholds[1], 1000);
    }

    // ============ getBatch ============

    function test_getBatch_returnsEmptyForNonExistent() public view {
        IVision.Batch memory batch = vision.getBatch(999);
        assertEq(batch.creator, address(0), "Non-existent batch creator should be zero");
        assertEq(batch.marketIds.length, 0, "Non-existent batch should have no markets");
        assertEq(batch.tickDuration, 0, "Non-existent batch should have zero tick duration");
    }

    // ============ updateBatchMarkets ============

    function test_updateBatchMarkets_revertNonCreator() public {
        // First create a batch as creator
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);

        // Try to update from non-creator
        bytes32[] memory newMarketIds = new bytes32[](1);
        newMarketIds[0] = keccak256("ETH-USD");

        uint8[] memory newResolutionTypes = new uint8[](1);
        newResolutionTypes[0] = uint8(IVision.ResolutionType.DOWN_0);

        vm.expectRevert(Vision.Unauthorized.selector);
        vm.prank(nonCreator);
        vision.updateBatchMarkets(batchId, newMarketIds, newResolutionTypes, new bytes(64));
    }

    function test_updateBatchMarkets_revertBatchNotFound() public {
        bytes32[] memory newMarketIds = new bytes32[](1);
        newMarketIds[0] = keccak256("ETH-USD");

        uint8[] memory newResolutionTypes = new uint8[](1);
        newResolutionTypes[0] = uint8(IVision.ResolutionType.DOWN_0);

        vm.expectRevert(Vision.BatchNotFound.selector);
        vm.prank(creator);
        vision.updateBatchMarkets(999, newMarketIds, newResolutionTypes, new bytes(64));
    }

    function test_updateBatchMarkets_revertArrayMismatch() public {
        // Create batch first
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);

        // Try update with mismatched arrays
        bytes32[] memory newMarketIds = new bytes32[](2);
        newMarketIds[0] = keccak256("ETH-USD");
        newMarketIds[1] = keccak256("SOL-USD");

        uint8[] memory newResolutionTypes = new uint8[](1);
        newResolutionTypes[0] = uint8(IVision.ResolutionType.DOWN_0);

        vm.expectRevert(Vision.ArrayLengthMismatch.selector);
        vm.prank(creator);
        vision.updateBatchMarkets(batchId, newMarketIds, newResolutionTypes, new bytes(64));
    }

    function test_updateBatchMarkets_happyPath() public {
        // Create batch first
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);

        // Prepare new markets
        bytes32[] memory newMarketIds = new bytes32[](2);
        newMarketIds[0] = keccak256("ETH-USD");
        newMarketIds[1] = keccak256("SOL-USD");

        uint8[] memory newResolutionTypes = new uint8[](2);
        newResolutionTypes[0] = uint8(IVision.ResolutionType.DOWN_0);
        newResolutionTypes[1] = uint8(IVision.ResolutionType.FLAT_0);

        // Compute the BLS message hash matching the contract logic
        IVision.Batch memory batch = vision.getBatch(batchId);
        uint256 currentTick = block.timestamp / batch.tickDuration;
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(vision),
            "updateBatchMarkets",
            batchId,
            keccak256(abi.encodePacked(newMarketIds)),
            keccak256(abi.encodePacked(newResolutionTypes)),
            currentTick
        ));

        // Sign with real BLS keys
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectEmit(true, false, false, false);
        emit Vision.BatchMarketsUpdated(batchId);

        vm.prank(creator);
        vision.updateBatchMarkets(batchId, newMarketIds, newResolutionTypes, blsSig);

        // Verify the update
        IVision.Batch memory updatedBatch = vision.getBatch(batchId);
        assertEq(updatedBatch.marketIds.length, 2, "Should have 2 new market IDs");
        assertEq(updatedBatch.marketIds[0], newMarketIds[0], "First market should be ETH-USD");
        assertEq(updatedBatch.marketIds[1], newMarketIds[1], "Second market should be SOL-USD");
        assertEq(updatedBatch.resolutionTypes[0], newResolutionTypes[0], "First resolution type should match");
        assertEq(updatedBatch.resolutionTypes[1], newResolutionTypes[1], "Second resolution type should match");
    }

    function test_updateBatchMarkets_revertInvalidBLSSignature() public {
        // Create batch first
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.prank(creator);
        uint256 batchId = vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);

        // Sign wrong message
        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong message"));

        bytes32[] memory newMarketIds = new bytes32[](1);
        newMarketIds[0] = keccak256("ETH-USD");

        uint8[] memory newResolutionTypes = new uint8[](1);
        newResolutionTypes[0] = uint8(IVision.ResolutionType.DOWN_0);

        vm.expectRevert();
        vm.prank(creator);
        vision.updateBatchMarkets(batchId, newMarketIds, newResolutionTypes, wrongSig);
    }

    // ============ Helper: create a batch and return its ID ============

    function _createDefaultBatch() internal returns (uint256 batchId) {
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds[0] = keccak256("BTC-USD");

        uint8[] memory resolutionTypes = new uint8[](1);
        resolutionTypes[0] = uint8(IVision.ResolutionType.UP_0);

        uint256[] memory customThresholds = new uint256[](0);

        vm.prank(creator);
        batchId = vision.createBatch(marketIds, resolutionTypes, 1 hours, customThresholds);
    }

    /// @dev Mint USDC to player, approve Vision, and return the player address
    function _preparePlayer(address player, uint256 amount) internal {
        usdc.mint(player, amount);
        vm.prank(player);
        usdc.approve(address(vision), type(uint256).max);
    }

    // ============ joinBatch ============

    function test_joinBatch() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6); // 10 USDC

        uint256 stakePerTick = 1e6; // 1 USDC
        bytes32 bitmapHash = keccak256("bitmap1");

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, stakePerTick, bitmapHash);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.bitmapHash, bitmapHash, "bitmapHash should match");
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

    function test_joinBatch_emitsEvent() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 5e6);

        bytes32 bitmapHash = keccak256("bitmap1");

        vm.expectEmit(true, true, false, true);
        emit Vision.PlayerJoined(batchId, player, 1e6, bitmapHash);

        vm.prank(player);
        vision.joinBatch(batchId, 5e6, 1e6, bitmapHash);
    }

    function test_joinBatch_revertNotEnoughDeposit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        // stakePerTick = 5 USDC, deposit = 3 USDC (< stakePerTick)
        vm.expectRevert(Vision.InsufficientDeposit.selector);
        vm.prank(player);
        vision.joinBatch(batchId, 3e6, 5e6, keccak256("bitmap"));
    }

    function test_joinBatch_revertStakeBelowMinimum() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        // MIN_STAKE_PER_TICK is 1e5, use 1e4
        vm.expectRevert(Vision.StakeBelowMinimum.selector);
        vm.prank(player);
        vision.joinBatch(batchId, 1e4, 1e4, keccak256("bitmap"));
    }

    function test_joinBatch_revertAlreadyJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 20e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // Try joining again
        vm.expectRevert(Vision.AlreadyJoined.selector);
        vm.prank(player);
        vision.joinBatch(batchId, 5e6, 1e6, keccak256("bitmap2"));
    }

    function test_joinBatch_revertBatchNotFound() public {
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.expectRevert(Vision.BatchNotFound.selector);
        vm.prank(player);
        vision.joinBatch(999, 5e6, 1e6, keccak256("bitmap"));
    }

    function test_joinBatch_minimumStakeExactly() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 1e5);

        // Exactly MIN_STAKE_PER_TICK should work
        vm.prank(player);
        vision.joinBatch(batchId, 1e5, 1e5, keccak256("bitmap"));

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
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        vm.expectEmit(true, true, false, true);
        emit Vision.PlayerDeposited(batchId, player, 5e6);

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

        vm.expectRevert(Vision.NotJoined.selector);
        vm.prank(player);
        vision.deposit(batchId, 5e6);
    }

    // ============ updateBitmap ============

    function test_updateBitmap() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap1"));

        bytes32 newHash = keccak256("bitmap2");
        vm.prank(player);
        vision.updateBitmap(batchId, newHash);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.bitmapHash, newHash, "bitmapHash should be updated");
    }

    function test_updateBitmap_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        vm.expectRevert(Vision.NotJoined.selector);
        vm.prank(player);
        vision.updateBitmap(batchId, keccak256("bitmap"));
    }

    // ============ claimRewards ============

    function test_claimRewards_happyPath() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

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
        emit Vision.RewardsClaimed(batchId, player, expectedPayout);

        vm.prank(player);
        vision.claimRewards(batchId, fromTick, toTick, newBalance, blsSig);

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
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // Issuers determined newBalance = 7e6 (player lost 3 USDC)
        uint256 fromTick = 1;
        uint256 toTick = 5;
        uint256 newBalance = 7e6;

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

        vm.prank(player);
        vision.claimRewards(batchId, fromTick, toTick, newBalance, blsSig);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.balance, 7e6, "Balance should decrease to newBalance");
        assertEq(pos.lastClaimedTick, toTick, "lastClaimedTick should be updated");
        assertEq(pos.totalClaimed, 0, "No payout on loss");
        assertEq(usdc.balanceOf(player), 0, "Player receives nothing on loss");
    }

    function test_claimRewards_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        vm.expectRevert(Vision.NotJoined.selector);
        vm.prank(player);
        vision.claimRewards(batchId, 1, 5, 10e6, new bytes(64));
    }

    function test_claimRewards_revertInvalidTickRange() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // toTick < fromTick
        vm.expectRevert(Vision.InvalidTickRange.selector);
        vm.prank(player);
        vision.claimRewards(batchId, 5, 3, 10e6, new bytes(64));
    }

    function test_claimRewards_revertTickAlreadyClaimed() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // First claim: ticks 1-5
        uint256 newBalance = 10e6; // no change, simplest case
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CLAIM", batchId, player,
            uint256(1), uint256(5), newBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player);
        vision.claimRewards(batchId, 1, 5, newBalance, blsSig);

        // Second claim with overlapping ticks (fromTick=3 <= lastClaimedTick=5)
        vm.expectRevert(Vision.TickAlreadyClaimed.selector);
        vm.prank(player);
        vision.claimRewards(batchId, 3, 8, 10e6, new bytes(64));
    }

    function test_claimRewards_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // Sign wrong message
        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vm.prank(player);
        vision.claimRewards(batchId, 1, 5, 12e6, wrongSig);
    }

    // ============ withdraw ============

    function test_withdraw_happyPath_withProfit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // Simulate pool having enough to pay out
        usdc.mint(address(vision), 5e6);

        uint256 finalBalance = 14e6; // profit = 4 USDC
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        // profit = 14e6 - 10e6 = 4e6; fee = 4e6 * 30 / 10000 = 12000
        uint256 expectedFee = 4e6 * 30 / 10000;
        uint256 expectedPayout = finalBalance - expectedFee;

        vm.expectEmit(true, true, false, true);
        emit Vision.PlayerWithdrawn(batchId, player, expectedPayout);

        vm.prank(player);
        vision.withdraw(batchId, finalBalance, blsSig);

        // Position should be deleted
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
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        uint256 finalBalance = 7e6; // lost 3 USDC, no profit
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        // No profit, fee = 0, payout = 7e6
        vm.prank(player);
        vision.withdraw(batchId, finalBalance, blsSig);

        IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
        assertEq(pos.stakePerTick, 0, "Position should be deleted");

        assertEq(usdc.balanceOf(player), 7e6, "Player gets remaining balance");
        assertEq(vision.accumulatedFees(), 0, "No fees on loss");
    }

    function test_withdraw_revertNotJoined() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");

        vm.expectRevert(Vision.NotJoined.selector);
        vm.prank(player);
        vision.withdraw(batchId, 10e6, new bytes(64));
    }

    function test_withdraw_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vm.prank(player);
        vision.withdraw(batchId, 10e6, wrongSig);
    }

    // ============ getPosition ============

    function test_getPosition_returnsEmptyForNonExistent() public view {
        IVision.PlayerPosition memory pos = vision.getPosition(0, address(0xdead));
        assertEq(pos.stakePerTick, 0, "Non-existent position stakePerTick should be 0");
        assertEq(pos.balance, 0, "Non-existent position balance should be 0");
        assertEq(pos.bitmapHash, bytes32(0), "Non-existent position bitmapHash should be 0");
    }

    // ============ Helper: prepare bot ============

    function _prepareBot(address bot) internal pure {
        // No-op: bot registration is free (no staking required)
        bot; // silence unused warning
    }

    // ============ registerBot ============

    function test_registerBot() public {
        address bot = makeAddr("bot1");

        vm.expectEmit(true, false, false, true);
        emit Vision.BotRegistered(bot, "http://bot1.example.com");

        vm.prank(bot);
        vision.registerBot("http://bot1.example.com", keccak256("pubkey1"));

        // Verify bot struct
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

        vm.expectRevert(Vision.BotAlreadyRegistered.selector);
        vm.prank(bot);
        vision.registerBot("http://bot1-v2.example.com", keccak256("pubkey1v2"));
    }

    // ============ deregisterBot ============

    function test_deregisterBot() public {
        address bot = makeAddr("bot1");

        vm.prank(bot);
        vision.registerBot("http://bot1.example.com", keccak256("pubkey1"));

        vm.expectEmit(true, false, false, false);
        emit Vision.BotDeregistered(bot);

        vm.prank(bot);
        vision.deregisterBot();

        // Verify removed
        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 0, "Should have 0 bots after deregister");
        assertEq(bots.length, 0, "Bots array should be empty");
    }

    function test_deregisterBot_swapAndPop() public {
        // Register 3 bots
        address bot1 = makeAddr("bot1");
        address bot2 = makeAddr("bot2");
        address bot3 = makeAddr("bot3");

        vm.prank(bot1);
        vision.registerBot("http://bot1.example.com", keccak256("pk1"));
        vm.prank(bot2);
        vision.registerBot("http://bot2.example.com", keccak256("pk2"));
        vm.prank(bot3);
        vision.registerBot("http://bot3.example.com", keccak256("pk3"));

        // Deregister middle bot (bot2) — should swap bot3 into its slot
        vm.prank(bot2);
        vision.deregisterBot();

        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 2, "Should have 2 bots after deregister");

        // After swap-and-pop: bot1 at index 0, bot3 at index 1
        assertEq(addrs[0], bot1, "First bot should be bot1");
        assertEq(addrs[1], bot3, "Second bot should be bot3 (swapped)");
        assertEq(bots[0].endpoint, "http://bot1.example.com", "Bot1 endpoint intact");
        assertEq(bots[1].endpoint, "http://bot3.example.com", "Bot3 endpoint intact");
    }

    function test_deregisterBot_revertNotRegistered() public {
        address bot = makeAddr("unregistered");

        vm.expectRevert(Vision.BotNotRegistered.selector);
        vm.prank(bot);
        vision.deregisterBot();
    }

    // ============ getAllActiveBots ============

    function test_getAllActiveBots() public {
        // Empty initially
        (address[] memory addrs, IVision.Bot[] memory bots) = vision.getAllActiveBots();
        assertEq(addrs.length, 0, "Should start empty");
        assertEq(bots.length, 0, "Should start empty");

        // Add 2 bots
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
        // Setup: player joins, wins, generates fees
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // Give contract extra USDC so it can pay winnings
        usdc.mint(address(vision), 5e6);

        // Withdraw with profit to generate fees
        uint256 finalBalance = 14e6;
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.prank(player);
        vision.withdraw(batchId, finalBalance, blsSig);

        // fees = (14e6 - 10e6) * 30 / 10000 = 12000
        uint256 expectedFees = 4e6 * 30 / 10000;
        assertEq(vision.accumulatedFees(), expectedFees, "Fees should be accumulated");

        // Collect fees (test contract is feeCollector)
        uint256 collectorBalanceBefore = usdc.balanceOf(address(this));
        vision.collectFees();

        assertEq(vision.accumulatedFees(), 0, "Fees should be zero after collection");
        assertEq(usdc.balanceOf(address(this)), collectorBalanceBefore + expectedFees, "Collector should receive fees");
    }

    function test_collectFees_revertUnauthorized() public {
        address notCollector = makeAddr("notCollector");

        vm.expectRevert(Vision.Unauthorized.selector);
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
        emit Vision.BatchPausedEvent(batchId);

        vision.pause(batchId, blsSig);

        IVision.Batch memory batch = vision.getBatch(batchId);
        assertTrue(batch.paused, "Batch should be paused");
    }

    function test_pause_revertBatchNotFound() public {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", uint256(999)
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(Vision.BatchNotFound.selector);
        vision.pause(999, blsSig);
    }

    function test_pause_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vision.pause(batchId, wrongSig);
    }

    // ============ unpause ============

    function test_unpause_happyPath() public {
        uint256 batchId = _createDefaultBatch();

        // First pause
        bytes32 pauseMsg = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", batchId
        ));
        bytes memory pauseSig = signWithTestIssuers(pauseMsg);
        vision.pause(batchId, pauseSig);

        assertTrue(vision.getBatch(batchId).paused, "Should be paused");

        // Now unpause
        bytes32 unpauseMsg = keccak256(abi.encode(
            block.chainid, address(vision), "UNPAUSE", batchId
        ));
        bytes memory unpauseSig = signWithTestIssuers(unpauseMsg);

        vm.expectEmit(true, false, false, false);
        emit Vision.BatchUnpaused(batchId);

        vision.unpause(batchId, unpauseSig);

        assertFalse(vision.getBatch(batchId).paused, "Should be unpaused");
    }

    function test_unpause_revertBatchNotFound() public {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "UNPAUSE", uint256(999)
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectRevert(Vision.BatchNotFound.selector);
        vision.unpause(999, blsSig);
    }

    function test_unpause_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vision.unpause(batchId, wrongSig);
    }

    // ============ forceWithdraw ============

    function test_forceWithdraw_happyPath_withProfit() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        // Extra USDC in pool to cover winnings
        usdc.mint(address(vision), 5e6);

        uint256 finalBalance = 14e6; // profit = 4 USDC
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "FORCE_WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        uint256 expectedFee = 4e6 * 30 / 10000; // 12000
        uint256 expectedPayout = finalBalance - expectedFee;

        vm.expectEmit(true, true, false, true);
        emit Vision.ForceWithdrawn(batchId, player, expectedPayout);

        vision.forceWithdraw(batchId, player, finalBalance, blsSig);

        // Position should be deleted
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
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        uint256 finalBalance = 7e6; // loss, no fee
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "FORCE_WITHDRAW", batchId, player, finalBalance
        ));
        bytes memory blsSig = signWithTestIssuers(message);

        vm.expectEmit(true, true, false, true);
        emit Vision.ForceWithdrawn(batchId, player, 7e6);

        vision.forceWithdraw(batchId, player, finalBalance, blsSig);

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

        vm.expectRevert(Vision.NotJoined.selector);
        vision.forceWithdraw(batchId, player, 10e6, blsSig);
    }

    function test_forceWithdraw_revertInvalidBLS() public {
        uint256 batchId = _createDefaultBatch();
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));

        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong"));

        vm.expectRevert();
        vision.forceWithdraw(batchId, player, 10e6, wrongSig);
    }

    // ============ pause prevents join ============

    function test_joinBatch_revertWhenPaused() public {
        uint256 batchId = _createDefaultBatch();

        // Pause the batch via BLS
        bytes32 pauseMsg = keccak256(abi.encode(
            block.chainid, address(vision), "PAUSE", batchId
        ));
        bytes memory pauseSig = signWithTestIssuers(pauseMsg);
        vision.pause(batchId, pauseSig);

        // Try to join — should revert
        address player = makeAddr("player1");
        _preparePlayer(player, 10e6);

        vm.expectRevert(Vision.BatchPaused.selector);
        vm.prank(player);
        vision.joinBatch(batchId, 10e6, 1e6, keccak256("bitmap"));
    }
}
