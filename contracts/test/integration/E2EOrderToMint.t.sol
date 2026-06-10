// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/core/Investment.sol";
import "../../src/core/ITP.sol";
import "../mocks/MockERC20.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import "../../src/registry/OracleRegistry.sol";
import "../../src/libraries/TypesLib.sol";
import "../../src/libraries/ErrorsLib.sol";
import "../../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title E2EOrderToMint - End-to-End Integration Test (Story 6.10)
/// @notice Tests the complete order-to-mint flow: submit → batch → fill → mint
/// @dev Uses real BLS signatures via FFI (bls-tool). All happy-path tests use real BLS signing.
contract E2EOrderToMintTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;
    ITP public itpVault;

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public admin;

    bytes32 public itpId;
    bytes32 public pairId;

    uint256 constant INITIAL_PRICE = 1e18; // $1.00
    uint256 constant INITIAL_USDC = 10_000e18;

    function setUp() public {
        admin = address(this);

        // Deploy mock USDC
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy mock governance
        governance = deployGovernance(admin);

        // Deploy Index as UUPS proxy
        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        index = Investment(address(proxy));

        // Deploy OracleRegistry, register real BLS test oracles, wire to Index
        OracleRegistry oracleRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(oracleRegistry, admin);
        index.setOracleRegistry(address(oracleRegistry));

        // Create test ITP with single asset (simplified for E2E)
        address[] memory assets = new address[](1);
        assets[0] = address(usdc);

        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18; // 100%

        uint256[] memory prices = new uint256[](1);
        prices[0] = INITIAL_PRICE;

        itpId = index.createITP("Crypto Blend", "CBLEND", weights, assets, prices, type(uint256).max);
        pairId = keccak256(abi.encode(itpId, uint256(0)));

        // Deploy ITP vault and link it
        itpVault = new ITP(
            itpId,
            address(index),
            "Crypto Blend Token",
            "CBLEND",
            IERC20(address(usdc))
        );
        index.setITPVault(itpId, address(itpVault));

        // Fund test users
        address[3] memory users = [user1, user2, user3];
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], INITIAL_USDC);
            vm.prank(users[i]);
            usdc.approve(address(index), type(uint256).max);
        }
    }

    // ============ SIGNING HELPERS ============

    function _signConfirmBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestOracles(message);
    }

    function _signConfirmFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestOracles(message);
    }

    function _signRefundExpiredOrder(uint256 orderId) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), "refund", orderId));
        return signWithTestOracles(message);
    }

    function _signSetItpNav(bytes32 _itpId, uint256 nav) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), "setItpNav", _itpId, nav));
        return signWithTestOracles(message);
    }

    // ============ HELPERS ============

    function _submitOrder(
        address user,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier
    ) internal returns (uint256 orderId) {
        vm.prank(user);
        orderId = index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            slippageTier,
            block.timestamp + 1 hours
        );
    }

    function _confirmBatch(uint256 cycleNumber, uint256[] memory orderIds) internal {
        index.confirmBatch(cycleNumber, orderIds, _signConfirmBatch(cycleNumber, orderIds), 3, 7);
    }

    function _confirmFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal {
        index.confirmFills(cycleNumber, fills, _signConfirmFills(cycleNumber, fills), 3, 7);
    }

    // ============ E2E HAPPY PATH (AC1, AC2, AC4, AC5, AC7) ============

    function test_e2e_order_to_mint_happy_path() public {
        uint256 orderAmount = 100e18; // 100 USDC
        uint256 fillPrice = 1e18;     // $1 per share

        // --- AC1: User submits a limit order ---
        uint256 userUsdcBefore = usdc.balanceOf(user1);

        // Expect OrderSubmitted event
        vm.expectEmit(true, true, true, true);
        emit EventsLib.OrderSubmitted(
            1, user1, itpId, pairId,
            uint8(TypesLib.Side.BUY),
            orderAmount, 1e18, 1,
            block.timestamp + 1 hours
        );

        uint256 orderId = _submitOrder(user1, orderAmount, 1e18, 1);

        // Verify orderId
        assertEq(orderId, 1, "First order should have ID 1");

        // Verify USDC transferred from user to Index
        assertEq(usdc.balanceOf(user1), userUsdcBefore - orderAmount, "USDC should transfer to Index");
        assertEq(usdc.balanceOf(address(index)), orderAmount, "Index should hold USDC");

        // Verify order status is PENDING
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.PENDING));

        // --- AC2: Oracles batch the order via BLS consensus ---
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        // Expect TradeRequest event (for AP)
        vm.expectEmit(true, true, false, true);
        emit EventsLib.TradeRequest(1, pairId, uint8(TypesLib.Side.BUY), orderAmount, 1e18);

        // Expect BatchConfirmed event (don't check data — signature bytes vary with real BLS)
        vm.expectEmit(true, false, false, false);
        emit EventsLib.BatchConfirmed(1, orderIds, "");

        _confirmBatch(1, orderIds);

        // Verify order status is BATCHED
        order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.BATCHED));

        // --- AC4: Oracles verify fill and confirm on-chain ---
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: orderAmount,
            cycleNumber: 1,
            txHash: bytes32(uint256(0xdead))
        });

        // Expect FillConfirmed event
        vm.expectEmit(true, true, false, true);
        emit EventsLib.FillConfirmed(orderId, 1, fillPrice, orderAmount);

        _confirmFills(1, fills);

        // --- AC5: ITP tokens minted to user ---
        // shares = fillAmount * 1e18 / fillPrice = 100e18 * 1e18 / 1e18 = 100e18
        uint256 expectedShares = (orderAmount * 1e18) / fillPrice;

        // Verify ITP token balance (actual ERC20 balance via vault)
        assertEq(itpVault.balanceOf(user1), expectedShares, "User should receive ITP tokens");
        assertGt(itpVault.balanceOf(user1), 0, "ITP balance must be > 0");

        // Verify ITP total supply
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, expectedShares, "ITP totalSupply should match shares");
        assertEq(itp.totalValue, orderAmount, "ITP totalValue should match fill amount");

        // Verify order status is FILLED
        order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    // ============ MULTIPLE ORDERS SINGLE BATCH (AC7) ============

    function test_e2e_multiple_orders_single_batch() public {
        // 3 users submit orders
        uint256 orderId1 = _submitOrder(user1, 50e18, 1e18, 1);
        uint256 orderId2 = _submitOrder(user2, 100e18, 1e18, 1);
        uint256 orderId3 = _submitOrder(user3, 200e18, 1e18, 0);

        // All batched in one cycle
        uint256[] memory orderIds = new uint256[](3);
        orderIds[0] = orderId1;
        orderIds[1] = orderId2;
        orderIds[2] = orderId3;
        _confirmBatch(1, orderIds);

        // All filled in one cycle
        uint256 fillPrice = 1e18;
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](3);
        fills[0] = TypesLib.Fill({
            orderId: orderId1,
            fillPrice: fillPrice,
            fillAmount: 50e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        fills[1] = TypesLib.Fill({
            orderId: orderId2,
            fillPrice: fillPrice,
            fillAmount: 100e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        fills[2] = TypesLib.Fill({
            orderId: orderId3,
            fillPrice: fillPrice,
            fillAmount: 200e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        // Verify each user's ITP balance
        assertEq(itpVault.balanceOf(user1), 50e18, "User1 should have 50 ITP");
        assertEq(itpVault.balanceOf(user2), 100e18, "User2 should have 100 ITP");
        assertEq(itpVault.balanceOf(user3), 200e18, "User3 should have 200 ITP");

        // Verify aggregate ITP state
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, 350e18, "Total supply should be 350");
        assertEq(itp.totalValue, 350e18, "Total value should be 350 USDC");

        // All orders FILLED
        assertEq(uint8(index.getOrder(orderId1).status), uint8(TypesLib.OrderStatus.FILLED));
        assertEq(uint8(index.getOrder(orderId2).status), uint8(TypesLib.OrderStatus.FILLED));
        assertEq(uint8(index.getOrder(orderId3).status), uint8(TypesLib.OrderStatus.FILLED));
    }

    // ============ EXPIRED ORDER REFUND (AC7) ============

    function test_e2e_order_expired_refund() public {
        uint256 orderAmount = 50e18;
        uint256 userUsdcBefore = usdc.balanceOf(user1);

        // Submit order with 1-hour deadline
        uint256 orderId = _submitOrder(user1, orderAmount, 1e18, 1);

        // Verify USDC transferred
        assertEq(usdc.balanceOf(user1), userUsdcBefore - orderAmount);

        // Fast-forward past deadline
        vm.warp(block.timestamp + 2 hours);

        // Refund expired order
        vm.expectEmit(true, true, false, true);
        emit EventsLib.OrderRefunded(orderId, user1, orderAmount);

        index.refundExpiredOrder(orderId, _signRefundExpiredOrder(orderId), 3, 7);

        // Verify USDC refunded
        assertEq(usdc.balanceOf(user1), userUsdcBefore, "Full USDC should be refunded");

        // Verify order status is EXPIRED
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.EXPIRED));

        // Verify no ITP minted
        assertEq(itpVault.balanceOf(user1), 0, "No ITP should be minted for expired order");
    }

    // ============ SLIPPAGE TIER 0 ON-CHAIN PATH (AC7) ============

    /// @notice Tests that an order with strict slippage tier (0 = 0.3%) stores the tier
    ///         and completes the on-chain E2E path. Slippage enforcement is performed
    ///         OFF-CHAIN by the oracle netting engine (oracle/src/slippage/mod.rs).
    ///         On-chain confirmFills() trusts the oracle BLS consensus and does NOT
    ///         re-validate slippage. This test verifies the on-chain path is functional
    ///         for tier-0 orders.
    function test_e2e_order_strict_slippage_tier_on_chain_path() public {
        // Tier 0 = strict 0.3% slippage (enforced off-chain by oracles)
        uint256 orderId = _submitOrder(user1, 100e18, 1e18, 0);

        // Verify slippage tier is stored correctly in the order
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.slippageTier, 0, "Slippage tier 0 (strict) must be stored");

        // Batch the order
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        _confirmBatch(1, orderIds);

        // On-chain fill succeeds — oracles already validated slippage off-chain
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 100e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.FILLED));
        assertEq(itpVault.balanceOf(user1), 100e18);
    }

    // ============ E2E WITH DIFFERENT FILL PRICE ============

    function test_e2e_fill_at_higher_price() public {
        // Order for 100 USDC, fill at $2 per share = 50 shares
        uint256 orderAmount = 100e18;
        uint256 fillPrice = 2e18;
        uint256 expectedShares = (orderAmount * 1e18) / fillPrice; // 50e18

        // Set NAV to $2 so limit price validation passes
        index.setItpNav(itpId, 2e18, _signSetItpNav(itpId, 2e18), 3, 7);

        uint256 orderId = _submitOrder(user1, orderAmount, 2e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        _confirmBatch(1, orderIds);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: orderAmount,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        assertEq(itpVault.balanceOf(user1), expectedShares, "Shares should be amount/price");
        assertEq(itpVault.balanceOf(user1), 50e18, "100 USDC at $2 = 50 shares");
    }

    // ============ E2E PARTIAL FILL ============

    function test_e2e_partial_fill_refund() public {
        uint256 orderAmount = 100e18;
        uint256 fillAmount = 60e18;
        uint256 refundAmount = orderAmount - fillAmount; // 40e18

        uint256 userUsdcBefore = usdc.balanceOf(user1);
        uint256 orderId = _submitOrder(user1, orderAmount, 1e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        _confirmBatch(1, orderIds);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: fillAmount,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        // User gets 60 ITP shares AND 40 USDC refund
        assertEq(itpVault.balanceOf(user1), 60e18, "Should receive shares for filled portion");
        assertEq(usdc.balanceOf(user1), userUsdcBefore - orderAmount + refundAmount, "Remainder refunded");

        // Order is FILLED
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.FILLED));
    }

    // ============ E2E MULTI-CYCLE FLOW ============

    function test_e2e_multi_cycle_orders() public {
        // Cycle 1: user1 order
        uint256 orderId1 = _submitOrder(user1, 50e18, 1e18, 1);
        uint256[] memory batch1 = new uint256[](1);
        batch1[0] = orderId1;
        _confirmBatch(1, batch1);

        TypesLib.Fill[] memory fills1 = new TypesLib.Fill[](1);
        fills1[0] = TypesLib.Fill({
            orderId: orderId1,
            fillPrice: 1e18,
            fillAmount: 50e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills1);

        assertEq(itpVault.balanceOf(user1), 50e18);

        // Cycle 2: user2 order
        uint256 orderId2 = _submitOrder(user2, 80e18, 1e18, 1);
        uint256[] memory batch2 = new uint256[](1);
        batch2[0] = orderId2;
        _confirmBatch(2, batch2);

        TypesLib.Fill[] memory fills2 = new TypesLib.Fill[](1);
        fills2[0] = TypesLib.Fill({
            orderId: orderId2,
            fillPrice: 1e18,
            fillAmount: 80e18,
            cycleNumber: 2,
            txHash: bytes32(0)
        });
        _confirmFills(2, fills2);

        assertEq(itpVault.balanceOf(user2), 80e18);

        // Verify cumulative ITP state
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, 130e18);
        assertEq(itp.totalValue, 130e18);
    }

    // ============ EVENTS EMITTED IN CORRECT ORDER (AC7) ============

    function test_e2e_events_emitted_in_correct_order() public {
        uint256 orderAmount = 10e18;

        // Record all logs
        vm.recordLogs();

        // Submit order
        uint256 orderId = _submitOrder(user1, orderAmount, 1e18, 1);

        // Batch
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        _confirmBatch(1, orderIds);

        // Fill
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: orderAmount,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        // Verify event order
        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Find event topics
        bytes32 orderSubmittedTopic = EventsLib.OrderSubmitted.selector;
        bytes32 tradeRequestTopic = EventsLib.TradeRequest.selector;
        bytes32 batchConfirmedTopic = EventsLib.BatchConfirmed.selector;
        bytes32 fillConfirmedTopic = EventsLib.FillConfirmed.selector;

        uint256 orderSubmittedIdx;
        uint256 tradeRequestIdx;
        uint256 batchConfirmedIdx;
        uint256 fillConfirmedIdx;
        bool foundOrder;
        bool foundTrade;
        bool foundBatch;
        bool foundFill;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == orderSubmittedTopic && !foundOrder) {
                orderSubmittedIdx = i;
                foundOrder = true;
            } else if (logs[i].topics[0] == tradeRequestTopic && !foundTrade) {
                tradeRequestIdx = i;
                foundTrade = true;
            } else if (logs[i].topics[0] == batchConfirmedTopic && !foundBatch) {
                batchConfirmedIdx = i;
                foundBatch = true;
            } else if (logs[i].topics[0] == fillConfirmedTopic && !foundFill) {
                fillConfirmedIdx = i;
                foundFill = true;
            }
        }

        assertTrue(foundOrder, "OrderSubmitted event must be emitted");
        assertTrue(foundTrade, "TradeRequest event must be emitted");
        assertTrue(foundBatch, "BatchConfirmed event must be emitted");
        assertTrue(foundFill, "FillConfirmed event must be emitted");

        // Verify order: OrderSubmitted < TradeRequest < BatchConfirmed < FillConfirmed
        assertTrue(orderSubmittedIdx < tradeRequestIdx, "OrderSubmitted before TradeRequest");
        assertTrue(tradeRequestIdx < batchConfirmedIdx, "TradeRequest before BatchConfirmed");
        assertTrue(batchConfirmedIdx < fillConfirmedIdx, "BatchConfirmed before FillConfirmed");
    }

    // ============ FINAL TOKEN BALANCE VERIFICATION (AC7) ============

    function test_e2e_final_token_balances() public {
        uint256 user1Amount = 100e18;
        uint256 user2Amount = 200e18;

        // Both users order
        uint256 orderId1 = _submitOrder(user1, user1Amount, 1e18, 1);
        uint256 orderId2 = _submitOrder(user2, user2Amount, 1e18, 1);

        // Batch both
        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = orderId1;
        orderIds[1] = orderId2;
        _confirmBatch(1, orderIds);

        // Fill both at $1
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](2);
        fills[0] = TypesLib.Fill({
            orderId: orderId1,
            fillPrice: 1e18,
            fillAmount: user1Amount,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        fills[1] = TypesLib.Fill({
            orderId: orderId2,
            fillPrice: 1e18,
            fillAmount: user2Amount,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        // Final balance checks
        // ITP tokens
        assertEq(itpVault.balanceOf(user1), user1Amount, "user1 ITP balance");
        assertEq(itpVault.balanceOf(user2), user2Amount, "user2 ITP balance");
        assertEq(itpVault.totalSupply(), user1Amount + user2Amount, "Total ITP supply");

        // USDC balances
        assertEq(usdc.balanceOf(user1), INITIAL_USDC - user1Amount, "user1 USDC spent");
        assertEq(usdc.balanceOf(user2), INITIAL_USDC - user2Amount, "user2 USDC spent");

        // Index holds the USDC
        assertEq(usdc.balanceOf(address(index)), user1Amount + user2Amount, "Index holds USDC");
    }
}
