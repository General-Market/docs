// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Index.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";

/// @title IndexBatchFillConfirmation.t.sol - Tests for Story 2.4
/// @notice Tests for confirmBatch, confirmFills, and refundExpiredOrder
contract IndexBatchFillConfirmationTest is TestHelper {
    Index public index;
    MockERC20 public usdc;
    Governance public governance;

    address public user = address(0x1);
    address public user2 = address(0x2);
    address public admin = address(this);

    bytes32 public itpId;
    bytes32 public pairId;

    uint256 constant MIN_ORDER_AMOUNT = 1e15;
    uint256 constant INITIAL_PRICE = 1e18;

    function setUp() public {
        // Deploy mock USDC with 18 decimals
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy mock governance
        governance = deployGovernance(address(this));

        // Deploy Index as UUPS proxy
        Index impl = new Index();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Index.initialize, (address(governance), address(usdc)))
        );
        index = Index(address(proxy));

        // Setup IssuerRegistry with real BLS keys for verification
        IssuerRegistry registry = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(registry, address(this));
        index.setIssuerRegistry(address(registry));

        // Create test ITP
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = address(usdc);
        uint256[] memory prices = new uint256[](1);
        prices[0] = INITIAL_PRICE;

        itpId = index.createITP("Test ITP", "TITP", weights, assets, prices, type(uint256).max);
        pairId = keccak256(abi.encode(itpId, uint256(0)));

        // Mint USDC to test users
        usdc.mint(user, 1000e18);
        usdc.mint(user2, 1000e18);

        // Users approve Index
        vm.prank(user);
        usdc.approve(address(index), type(uint256).max);
        vm.prank(user2);
        usdc.approve(address(index), type(uint256).max);
    }

    // Helper to create an order
    function _createOrder(address userAddr, uint256 amount) internal returns (uint256) {
        vm.prank(userAddr);
        return index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            amount,
            1e18,
            1,
            block.timestamp + 1 hours
        );
    }

    // Helper: sign a confirmBatch call
    function _signBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestIssuers(msgHash);
    }

    // Helper: sign a confirmFills call
    function _signFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestIssuers(msgHash);
    }

    // Helper: sign a refundExpiredOrder call
    function _signRefund(uint256 orderId) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), "refund", orderId));
        return signWithTestIssuers(msgHash);
    }

    // ============ CONFIRM BATCH TESTS ============

    function test_confirmBatch_happyPath() public {
        // Create orders
        uint256 orderId1 = _createOrder(user, 10e18);
        uint256 orderId2 = _createOrder(user2, 20e18);

        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = orderId1;
        orderIds[1] = orderId2;

        // Confirm batch
        uint256 cycleNumber = 1;
        index.confirmBatch(cycleNumber, orderIds, _signBatch(cycleNumber, orderIds));

        // Verify orders are marked as BATCHED
        TypesLib.LimitOrder memory order1 = index.getOrder(orderId1);
        TypesLib.LimitOrder memory order2 = index.getOrder(orderId2);

        assertEq(uint8(order1.status), uint8(TypesLib.OrderStatus.BATCHED));
        assertEq(uint8(order2.status), uint8(TypesLib.OrderStatus.BATCHED));

        // Verify cycle is marked as processed
        assertTrue(index.cycleProcessed(cycleNumber));
    }

    function test_confirmBatch_emitsEvents() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        // Expect TradeRequest event for the order
        vm.expectEmit(true, true, false, true);
        emit EventsLib.TradeRequest(
            1, // cycleNumber
            pairId,
            uint8(TypesLib.Side.BUY),
            10e18,
            1e18
        );

        // Expect BatchConfirmed event (check topics only, not signature bytes)
        bytes memory batchSig = _signBatch(1, orderIds);
        vm.expectEmit(true, false, false, false);
        emit EventsLib.BatchConfirmed(1, orderIds, batchSig);

        index.confirmBatch(1, orderIds, batchSig);
    }

    function test_confirmBatch_revertsOnCycleAlreadyProcessed() public {
        uint256 orderId = _createOrder(user, 10e18);
        uint256 orderId2 = _createOrder(user2, 10e18);

        uint256[] memory orderIds1 = new uint256[](1);
        orderIds1[0] = orderId;

        uint256[] memory orderIds2 = new uint256[](1);
        orderIds2[0] = orderId2;

        // First batch succeeds
        index.confirmBatch(1, orderIds1, _signBatch(1, orderIds1));

        // Second batch with same cycle number reverts
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E019_CycleAlreadyProcessed.selector, 1));
        index.confirmBatch(1, orderIds2, _signBatch(1, orderIds2));
    }

    function test_confirmBatch_revertsOnOrderNotFound() public {
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = 999; // Non-existent order

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E022_OrderNotFound.selector, 999));
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));
    }

    function test_confirmBatch_revertsOnOrderAlreadyBatched() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        // First batch succeeds
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Try to batch the same order in a different cycle
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E021_OrderAlreadyBatched.selector, orderId));
        index.confirmBatch(2, orderIds, _signBatch(2, orderIds));
    }

    function test_confirmBatch_multipleOrdersSameCycle() public {
        uint256 orderId1 = _createOrder(user, 10e18);
        uint256 orderId2 = _createOrder(user, 20e18);
        uint256 orderId3 = _createOrder(user2, 30e18);

        uint256[] memory orderIds = new uint256[](3);
        orderIds[0] = orderId1;
        orderIds[1] = orderId2;
        orderIds[2] = orderId3;

        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // All orders should be batched
        assertEq(uint8(index.getOrder(orderId1).status), uint8(TypesLib.OrderStatus.BATCHED));
        assertEq(uint8(index.getOrder(orderId2).status), uint8(TypesLib.OrderStatus.BATCHED));
        assertEq(uint8(index.getOrder(orderId3).status), uint8(TypesLib.OrderStatus.BATCHED));
    }

    function test_confirmBatch_emptyOrdersArray() public {
        uint256[] memory orderIds = new uint256[](0);

        // Should succeed with empty array (no orders to batch)
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));
        assertTrue(index.cycleProcessed(1));
    }

    // ============ CONFIRM FILLS TESTS ============

    function test_confirmFills_happyPath() public {
        // Create and batch an order
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Confirm fills
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        index.confirmFills(1, fills, _signFills(1, fills));

        // Verify order is marked as FILLED
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));

        // Verify ITP total supply and value updated
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, 10e18); // shares = fillAmount / fillPrice = 10e18
        assertEq(itp.totalValue, 10e18);
    }

    function test_confirmFills_emitsEvent() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        vm.expectEmit(true, true, false, true);
        emit EventsLib.FillConfirmed(orderId, 1, 1e18, 10e18);

        index.confirmFills(1, fills, _signFills(1, fills));
    }

    function test_confirmFills_revertsOnOrderNotFound() public {
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: 999,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E022_OrderNotFound.selector, 999));
        index.confirmFills(1, fills, _signFills(1, fills));
    }

    function test_confirmFills_revertsOnOrderAlreadyFilled() public {
        // Wave 3.4: confirmFills now accepts PENDING orders (late fill tolerance).
        // So instead test that a FILLED order is rejected.
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Fill the order first
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        index.confirmFills(1, fills, _signFills(1, fills));

        // Now try to fill the already-FILLED order again
        TypesLib.Fill[] memory fills2 = new TypesLib.Fill[](1);
        fills2[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 2,
            txHash: bytes32(0)
        });

        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E024_InvalidOrderStatus.selector,
                orderId,
                uint256(TypesLib.OrderStatus.FILLED),
                uint256(TypesLib.OrderStatus.BATCHED)
            )
        );
        index.confirmFills(2, fills2, _signFills(2, fills2));
    }

    function test_confirmFills_revertsOnFillExceedsOrder() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 20e18, // More than order amount
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E023_FillExceedsOrder.selector, orderId, 20e18, 10e18)
        );
        index.confirmFills(1, fills, _signFills(1, fills));
    }

    function test_confirmFills_multipleFills() public {
        uint256 orderId1 = _createOrder(user, 10e18);
        uint256 orderId2 = _createOrder(user2, 20e18);

        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = orderId1;
        orderIds[1] = orderId2;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](2);
        fills[0] = TypesLib.Fill({
            orderId: orderId1,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        fills[1] = TypesLib.Fill({
            orderId: orderId2,
            fillPrice: 1e18,
            fillAmount: 20e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        index.confirmFills(1, fills, _signFills(1, fills));

        assertEq(uint8(index.getOrder(orderId1).status), uint8(TypesLib.OrderStatus.FILLED));
        assertEq(uint8(index.getOrder(orderId2).status), uint8(TypesLib.OrderStatus.FILLED));

        // Total supply should be 30e18 (10 + 20)
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, 30e18);
        assertEq(itp.totalValue, 30e18);
    }

    function test_confirmFills_partialFill() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Record user balance before fill
        uint256 userBalanceBefore = usdc.balanceOf(user);

        // Fill only 5e18 out of 10e18
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 5e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        index.confirmFills(1, fills, _signFills(1, fills));

        // Order should still be marked as FILLED (status changes)
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.FILLED));

        // ITP supply should reflect partial fill
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, 5e18);

        // H-2 fix: Verify remainder (5e18) was refunded to user
        assertEq(usdc.balanceOf(user), userBalanceBefore + 5e18, "Remainder should be refunded");
    }

    function test_confirmFills_differentFillPrice() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Fill at 2 USD per share
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 2e18, // $2 per share
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        index.confirmFills(1, fills, _signFills(1, fills));

        // shares = fillAmount / fillPrice = 10e18 / 2e18 = 5e18 shares
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, 5e18);
        assertEq(itp.totalValue, 10e18);
    }

    // ============ SELL ORDER FILL TESTS (Story 7.14) ============

    // Counter for unique cycle numbers in test helpers
    uint256 internal _setupCycleCounter = 1000;

    // Helper to setup user with ITP shares via completed BUY order
    function _setupUserWithShares(address userAddr, uint256 shareAmount) internal {
        usdc.mint(userAddr, shareAmount);
        vm.prank(userAddr);
        usdc.approve(address(index), shareAmount);

        vm.prank(userAddr);
        uint256 buyOrderId = index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            shareAmount,
            1e18,
            1,
            block.timestamp + 1 hours
        );

        // Use unique cycle number for each setup call
        uint256 cycleNum = _setupCycleCounter++;

        uint256[] memory buyOrderIds = new uint256[](1);
        buyOrderIds[0] = buyOrderId;
        index.confirmBatch(cycleNum, buyOrderIds, _signBatch(cycleNum, buyOrderIds));

        TypesLib.Fill[] memory buyFills = new TypesLib.Fill[](1);
        buyFills[0] = TypesLib.Fill({
            orderId: buyOrderId,
            fillPrice: 1e18,
            fillAmount: shareAmount,
            cycleNumber: cycleNum,
            txHash: keccak256(abi.encode("setup_buy", cycleNum))
        });
        index.confirmFills(cycleNum, buyFills, _signFills(cycleNum, buyFills));
    }

    function test_confirmFills_sellOrder_happyPath() public {
        // First, give user ITP shares via a completed BUY order
        _setupUserWithShares(user, 100e18);

        // Verify user has shares
        TypesLib.ITPCore memory itpBefore = index.getITP(itpId);
        assertEq(itpBefore.totalSupply, 100e18);
        assertEq(itpBefore.totalValue, 100e18);

        // Record user USDC balance before sell
        uint256 userBalanceBefore = usdc.balanceOf(user);

        // Create SELL order
        vm.prank(user);
        uint256 sellOrderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            10e18,
            1e18,
            1,
            block.timestamp + 1 hours
        );

        // Batch the sell order
        uint256[] memory sellOrderIds = new uint256[](1);
        sellOrderIds[0] = sellOrderId;
        uint256 sellCycleNumber = block.timestamp + 100;
        index.confirmBatch(sellCycleNumber, sellOrderIds, _signBatch(sellCycleNumber, sellOrderIds));

        // Confirm the fill: fillAmount=10e18 shares at fillPrice=1e18
        // usdcToReturn = (10e18 * 1e18) / 1e18 = 10e18
        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](1);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: sellCycleNumber,
            txHash: keccak256("sell_tx")
        });
        index.confirmFills(sellCycleNumber, sellFills, _signFills(sellCycleNumber, sellFills));

        // Verify order marked as FILLED
        TypesLib.LimitOrder memory order = index.getOrder(sellOrderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));

        // Verify user received USDC back: (10e18 * 1e18) / 1e18 = 10e18
        assertEq(usdc.balanceOf(user), userBalanceBefore + 10e18);

        // Verify ITP supply decreased (shares burned)
        TypesLib.ITPCore memory itpAfter = index.getITP(itpId);
        assertEq(itpAfter.totalSupply, 90e18, "Total supply should decrease by sold amount");
        assertEq(itpAfter.totalValue, 90e18, "Total value should decrease by USDC returned");
    }

    function test_confirmFills_sellOrder_differentPrice() public {
        // Give user shares at price 1.0
        _setupUserWithShares(user, 100e18);

        uint256 userBalanceBefore = usdc.balanceOf(user);

        // SELL 10 shares
        vm.prank(user);
        uint256 sellOrderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            10e18,
            1e18,
            1,
            block.timestamp + 1 hours
        );

        uint256[] memory sellOrderIds = new uint256[](1);
        sellOrderIds[0] = sellOrderId;
        uint256 sellCycleNumber = block.timestamp + 100;
        index.confirmBatch(sellCycleNumber, sellOrderIds, _signBatch(sellCycleNumber, sellOrderIds));

        // Fill at price 2.0: usdcToReturn = (10e18 * 2e18) / 1e18 = 20e18
        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](1);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId,
            fillPrice: 2e18,
            fillAmount: 10e18,
            cycleNumber: sellCycleNumber,
            txHash: keccak256("sell_tx_price2")
        });

        // Need to fund the contract with enough USDC for the payout
        usdc.mint(address(index), 20e18);

        index.confirmFills(sellCycleNumber, sellFills, _signFills(sellCycleNumber, sellFills));

        // User should get 20 USDC (10 shares * $2 price)
        assertEq(usdc.balanceOf(user), userBalanceBefore + 20e18, "Should receive shares * price USDC");

        // ITP: supply = 100 - 10 = 90, value = 100 - 20 = 80
        TypesLib.ITPCore memory itpAfter = index.getITP(itpId);
        assertEq(itpAfter.totalSupply, 90e18, "Total supply should decrease by shares sold");
        assertEq(itpAfter.totalValue, 80e18, "Total value should decrease by USDC returned (20)");
    }

    function test_confirmFills_sellOrder_emitsFillConfirmed() public {
        _setupUserWithShares(user, 100e18);

        vm.prank(user);
        uint256 sellOrderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            25e18,
            1e18,
            1,
            block.timestamp + 1 hours
        );

        uint256[] memory sellOrderIds = new uint256[](1);
        sellOrderIds[0] = sellOrderId;
        uint256 sellCycleNumber = block.timestamp + 200;
        index.confirmBatch(sellCycleNumber, sellOrderIds, _signBatch(sellCycleNumber, sellOrderIds));

        // Expect FillConfirmed event
        vm.expectEmit(true, true, false, true);
        emit EventsLib.FillConfirmed(sellOrderId, sellCycleNumber, 1e18, 25e18);

        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](1);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId,
            fillPrice: 1e18,
            fillAmount: 25e18,
            cycleNumber: sellCycleNumber,
            txHash: keccak256("sell_tx_2")
        });
        index.confirmFills(sellCycleNumber, sellFills, _signFills(sellCycleNumber, sellFills));
    }

    function test_confirmFills_sellOrder_partialFill() public {
        _setupUserWithShares(user, 100e18);

        // User sells 50 shares
        vm.prank(user);
        uint256 sellOrderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            50e18,
            1e18,
            1,
            block.timestamp + 1 hours
        );

        uint256[] memory sellOrderIds = new uint256[](1);
        sellOrderIds[0] = sellOrderId;
        uint256 sellCycleNumber = block.timestamp + 300;
        index.confirmBatch(sellCycleNumber, sellOrderIds, _signBatch(sellCycleNumber, sellOrderIds));

        // But only 30 shares are filled at price 1.0
        // usdcToReturn = (30e18 * 1e18) / 1e18 = 30e18
        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](1);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId,
            fillPrice: 1e18,
            fillAmount: 30e18, // Partial fill
            cycleNumber: sellCycleNumber,
            txHash: keccak256("partial_sell_tx")
        });

        uint256 userBalanceBefore = usdc.balanceOf(user);
        index.confirmFills(sellCycleNumber, sellFills, _signFills(sellCycleNumber, sellFills));

        // User receives 30 USDC: (30e18 shares * 1e18 price) / 1e18 = 30e18
        assertEq(usdc.balanceOf(user), userBalanceBefore + 30e18);

        // ITP accounting:
        // totalSupply: 100 - 50 (order.amount) + 20 (unfilled shares restored) = 70
        // totalValue: 100 - 30 (usdcToReturn) = 70
        TypesLib.ITPCore memory itpAfter = index.getITP(itpId);
        assertEq(itpAfter.totalSupply, 70e18, "Total supply should be 100 - 50 + 20 = 70");
        assertEq(itpAfter.totalValue, 70e18, "Total value should be 100 - 30 = 70");
    }

    function test_confirmFills_sellOrder_fullSell() public {
        _setupUserWithShares(user, 100e18);

        // User sells all 100 shares
        vm.prank(user);
        uint256 sellOrderId = index.submitOrder(
            itpId,
            TypesLib.Side.SELL,
            100e18,
            1e18,
            1,
            block.timestamp + 1 hours
        );

        uint256[] memory sellOrderIds = new uint256[](1);
        sellOrderIds[0] = sellOrderId;
        uint256 sellCycleNumber = block.timestamp + 400;
        index.confirmBatch(sellCycleNumber, sellOrderIds, _signBatch(sellCycleNumber, sellOrderIds));

        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](1);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId,
            fillPrice: 1e18,
            fillAmount: 100e18,
            cycleNumber: sellCycleNumber,
            txHash: keccak256("full_sell_tx")
        });
        index.confirmFills(sellCycleNumber, sellFills, _signFills(sellCycleNumber, sellFills));

        // ITP should have 0 supply after selling all
        TypesLib.ITPCore memory itpAfter = index.getITP(itpId);
        assertEq(itpAfter.totalSupply, 0, "Total supply should be 0 after full sell");
        assertEq(itpAfter.totalValue, 0, "Total value should be 0 after full sell");
    }

    function test_confirmFills_sellOrder_multipleSellers() public {
        _setupUserWithShares(user, 100e18);
        _setupUserWithShares(user2, 50e18);

        // User1 sells 30, User2 sells 20
        vm.prank(user);
        uint256 sellOrderId1 = index.submitOrder(
            itpId, TypesLib.Side.SELL, 30e18, 1e18, 1, block.timestamp + 1 hours
        );

        vm.prank(user2);
        uint256 sellOrderId2 = index.submitOrder(
            itpId, TypesLib.Side.SELL, 20e18, 1e18, 1, block.timestamp + 1 hours
        );

        uint256[] memory sellOrderIds = new uint256[](2);
        sellOrderIds[0] = sellOrderId1;
        sellOrderIds[1] = sellOrderId2;
        uint256 sellCycleNumber = block.timestamp + 500;
        index.confirmBatch(sellCycleNumber, sellOrderIds, _signBatch(sellCycleNumber, sellOrderIds));

        TypesLib.Fill[] memory sellFills = new TypesLib.Fill[](2);
        sellFills[0] = TypesLib.Fill({
            orderId: sellOrderId1,
            fillPrice: 1e18,
            fillAmount: 30e18,
            cycleNumber: sellCycleNumber,
            txHash: keccak256("multi_sell_1")
        });
        sellFills[1] = TypesLib.Fill({
            orderId: sellOrderId2,
            fillPrice: 1e18,
            fillAmount: 20e18,
            cycleNumber: sellCycleNumber,
            txHash: keccak256("multi_sell_2")
        });
        index.confirmFills(sellCycleNumber, sellFills, _signFills(sellCycleNumber, sellFills));

        // ITP totalSupply: 150 - 30 - 20 = 100
        TypesLib.ITPCore memory itpAfter = index.getITP(itpId);
        assertEq(itpAfter.totalSupply, 100e18, "Total supply should be 150 - 50 = 100");
    }

    // ============ REFUND EXPIRED ORDER TESTS ============

    function test_refundExpiredOrder_happyPath() public {
        uint256 orderId = _createOrder(user, 10e18);

        // Fast forward past deadline
        vm.warp(block.timestamp + 2 hours);

        uint256 userBalanceBefore = usdc.balanceOf(user);

        // M-4 fix: Expect OrderRefunded event
        vm.expectEmit(true, true, false, true);
        emit EventsLib.OrderRefunded(orderId, user, 10e18);

        index.refundExpiredOrder(orderId, _signRefund(orderId));

        // Verify USDC refunded
        assertEq(usdc.balanceOf(user), userBalanceBefore + 10e18);

        // Verify order marked as EXPIRED
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.EXPIRED));
    }

    function test_refundExpiredOrder_revertsIfNotExpired() public {
        uint256 orderId = _createOrder(user, 10e18);

        // Order not yet expired (deadline is in 1 hour)
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E034_OrderNotYetExpired.selector,
                orderId,
                block.timestamp + 1 hours,
                block.timestamp
            )
        );
        index.refundExpiredOrder(orderId, _signRefund(orderId));
    }

    function test_refundExpiredOrder_revertsOnOrderNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E022_OrderNotFound.selector, 999));
        index.refundExpiredOrder(999, _signRefund(999));
    }

    function test_refundExpiredOrder_revertsIfAlreadyFilled() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        index.confirmFills(1, fills, _signFills(1, fills));

        // Fast forward past deadline
        vm.warp(block.timestamp + 2 hours);

        // Can't refund already filled order
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E024_InvalidOrderStatus.selector,
                orderId,
                uint256(TypesLib.OrderStatus.FILLED),
                uint256(TypesLib.OrderStatus.PENDING)
            )
        );
        index.refundExpiredOrder(orderId, _signRefund(orderId));
    }

    function test_refundExpiredOrder_revertsIfAlreadyExpired() public {
        uint256 orderId = _createOrder(user, 10e18);

        vm.warp(block.timestamp + 2 hours);

        // First refund succeeds
        index.refundExpiredOrder(orderId, _signRefund(orderId));

        // Second refund fails (already expired/refunded)
        vm.expectRevert(
            abi.encodeWithSelector(
                ErrorsLib.E024_InvalidOrderStatus.selector,
                orderId,
                uint256(TypesLib.OrderStatus.EXPIRED),
                uint256(TypesLib.OrderStatus.PENDING)
            )
        );
        index.refundExpiredOrder(orderId, _signRefund(orderId));
    }

    function test_refundExpiredOrder_batchedOrderCanBeRefunded() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Fast forward past deadline
        vm.warp(block.timestamp + 2 hours);

        uint256 userBalanceBefore = usdc.balanceOf(user);

        // Batched but unfilled order can be refunded
        index.refundExpiredOrder(orderId, _signRefund(orderId));

        assertEq(usdc.balanceOf(user), userBalanceBefore + 10e18);
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.EXPIRED));
    }

    // ============ CYCLE PROCESSING TESTS ============

    function test_confirmBatch_differentCyclesCanProcess() public {
        uint256 orderId1 = _createOrder(user, 10e18);
        uint256 orderId2 = _createOrder(user2, 20e18);

        uint256[] memory orderIds1 = new uint256[](1);
        orderIds1[0] = orderId1;

        uint256[] memory orderIds2 = new uint256[](1);
        orderIds2[0] = orderId2;

        // Process different cycles
        index.confirmBatch(1, orderIds1, _signBatch(1, orderIds1));
        index.confirmBatch(2, orderIds2, _signBatch(2, orderIds2));

        assertTrue(index.cycleProcessed(1));
        assertTrue(index.cycleProcessed(2));
    }

    // ============ NEW VALIDATION TESTS (Code Review Fixes) ============

    function test_confirmFills_revertsOnCycleMismatch() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Fill has cycleNumber=2 but function param is 1
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 10e18,
            cycleNumber: 2, // Mismatched!
            txHash: bytes32(0)
        });

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E036_FillCycleMismatch.selector, 2, 1)
        );
        index.confirmFills(1, fills, _signFills(1, fills));
    }

    function test_confirmFills_revertsOnZeroShares() public {
        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        // Fill with extremely high price that results in < MIN_SHARES
        // MIN_SHARES = 1e12, so need: fillAmount * 1e18 / fillPrice < 1e12
        // 10e18 * 1e18 / fillPrice < 1e12 => fillPrice > 10e24
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 100e24, // Very high price
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E037_ZeroSharesCalculated.selector, 10e18, 100e24)
        );
        index.confirmFills(1, fills, _signFills(1, fills));
    }

    // ============ FUZZ TESTS ============

    function testFuzz_confirmBatch_validCycleNumbers(uint256 cycleNumber) public {
        // Skip 0 as it might have edge cases
        vm.assume(cycleNumber > 0);

        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        index.confirmBatch(cycleNumber, orderIds, _signBatch(cycleNumber, orderIds));
        assertTrue(index.cycleProcessed(cycleNumber));
    }

    function testFuzz_confirmFills_validFillAmounts(uint256 fillAmount) public {
        // Bound fill amount to order amount, with minimum that produces >= MIN_SHARES
        // MIN_SHARES = 1e12, fillPrice = 1e18, so fillAmount must be >= 1e12
        fillAmount = bound(fillAmount, 1e12, 10e18);

        uint256 orderId = _createOrder(user, 10e18);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: fillAmount,
            cycleNumber: 1,
            txHash: bytes32(0)
        });

        index.confirmFills(1, fills, _signFills(1, fills));
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.FILLED));
    }
}
