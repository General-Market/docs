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
    MockERC20 public wind;
    IssuerRegistry public issuerRegistry;
    Governance public governance;

    address public creator;
    address public nonCreator;

    function setUp() public {
        creator = makeAddr("creator");
        nonCreator = makeAddr("nonCreator");

        // Deploy mock tokens
        usdc = new MockERC20("USDC", "USDC", 6);
        wind = new MockERC20("WIND", "WIND", 18);

        // Deploy governance and issuer registry for BLS verification
        governance = deployGovernance(address(this));
        issuerRegistry = deployIssuerRegistry(address(governance));

        // Register test issuers and set aggregated pubkey
        registerTestIssuersWithBLS(issuerRegistry, address(this));

        // Deploy Vision
        vision = new Vision(
            address(usdc),
            address(wind),
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
}
