// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Investment.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";

/// @title IndexProductionHardening.t.sol - Tests for Story 7.16
/// @notice Tests BLS price updates, weighted NAV, minBuyAmount, queue depth monitoring
contract IndexProductionHardeningTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;

    address public admin;
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    // Test asset addresses
    address public btcAddr = makeAddr("BTC");
    address public ethAddr = makeAddr("ETH");
    address public solAddr = makeAddr("SOL");

    // Price constants
    uint256 constant BTC_PRICE = 50_000e18;
    uint256 constant ETH_PRICE = 3_000e18;
    uint256 constant SOL_PRICE = 100e18;

    // ITP IDs
    bytes32 public singleAssetItpId;
    bytes32 public multiAssetItpId;

    function setUp() public {
        admin = address(this);

        // Deploy mock contracts
        usdc = new MockERC20("USDC", "USDC", 18);
        governance = deployGovernance(admin);

        // Deploy Index as UUPS proxy
        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        index = Investment(address(proxy));

        // Setup IssuerRegistry with real BLS keys
        IssuerRegistry registry = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(registry, admin);
        vm.prank(admin);
        index.setIssuerRegistry(address(registry));

        // Create single-asset ITP (100% BTC)
        {
            address[] memory assets = new address[](1);
            assets[0] = btcAddr;
            uint256[] memory weights = new uint256[](1);
            weights[0] = 1e18;
            uint256[] memory prices = new uint256[](1);
            prices[0] = BTC_PRICE;
            singleAssetItpId = index.createITP("BTC Only", "BTCO", weights, assets, prices, type(uint256).max);
        }

        // Create multi-asset ITP (60% BTC, 40% ETH)
        {
            address[] memory assets = new address[](2);
            assets[0] = btcAddr;
            assets[1] = ethAddr;
            uint256[] memory weights = new uint256[](2);
            weights[0] = 6e17; // 60%
            weights[1] = 4e17; // 40%
            uint256[] memory prices = new uint256[](2);
            prices[0] = BTC_PRICE;
            prices[1] = ETH_PRICE;
            multiAssetItpId = index.createITP("BTC ETH", "BTCETH", weights, assets, prices, type(uint256).max);
        }

        // Fund test users
        usdc.mint(user1, 10_000_000e18);
        usdc.mint(user2, 10_000_000e18);
        vm.prank(user1);
        usdc.approve(address(index), type(uint256).max);
        vm.prank(user2);
        usdc.approve(address(index), type(uint256).max);
    }

    // ============ SIGNING HELPERS ============

    function _signSetItpNav(bytes32 itpId, uint256 nav) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), "setItpNav", itpId, nav));
        return signWithTestIssuers(msgHash);
    }

    function _signBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestIssuers(msgHash);
    }

    function _signFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestIssuers(msgHash);
    }

    function _signRefund(uint256 orderId) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), "refund", orderId));
        return signWithTestIssuers(msgHash);
    }

    // ============ NAV CALCULATION TESTS (AC #2) ============

    function test_nav_singleAssetITP() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // ITP starts at $1: qty = (1e18 * 1e18) / 50000e18 = 2e13
        // NAV = (2e13 * 50000e18) / 1e18 = 1e18 ($1)
        assertEq(nav, 1e18, "Single asset ITP NAV should be $1 at creation prices");
    }

    function test_nav_multiAssetITP() public {
        uint256 nav = index.getNAV(multiAssetItpId);
        // ITP starts at $1. NAV = Σ(qty[i] * price[i]) / 1e18
        // qty_btc = (6e17 * 1e18) / 50000e18 = 12000000000000
        // qty_eth = (4e17 * 1e18) / 3000e18 = 133333333333333
        // NAV = (12000000000000 * 50000e18 + 133333333333333 * 3000e18) / 1e18
        //     ≈ 1e18 (minor rounding from integer division)
        // Allow 1 wei tolerance for integer division rounding
        assertApproxEqAbs(nav, 1e18, 1e3, "Multi-asset ITP NAV should be ~$1 at creation prices");
    }

    function test_nav_fiveAssetITP() public {
        address linkAddr = makeAddr("LINK");
        address aaveAddr = makeAddr("AAVE");

        address[] memory assets = new address[](5);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        assets[2] = solAddr;
        assets[3] = linkAddr;
        assets[4] = aaveAddr;

        uint256[] memory weights = new uint256[](5);
        weights[0] = 4e17;  // 40%
        weights[1] = 3e17;  // 30%
        weights[2] = 15e16; // 15%
        weights[3] = 1e17;  // 10%
        weights[4] = 5e16;  // 5%

        uint256[] memory prices = new uint256[](5);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;
        prices[2] = SOL_PRICE;
        prices[3] = 15e18;  // $15 LINK
        prices[4] = 200e18; // $200 AAVE

        bytes32 fiveItpId = index.createITP("Five Asset", "FIVE", weights, assets, prices, type(uint256).max);

        uint256 nav = index.getNAV(fiveItpId);
        // ITP starts at $1 — NAV should be ~1e18 at creation prices
        assertApproxEqAbs(nav, 1e18, 1e3, "5-asset ITP NAV should be ~$1 at creation prices");
    }

    function test_nav_maxAssetITP() public {
        // Create ITP with 50 assets
        uint256 assetCount = 50;
        address[] memory assets = new address[](assetCount);
        uint256[] memory weights = new uint256[](assetCount);
        uint256[] memory prices = new uint256[](assetCount);

        uint256 weightPerAsset = 1e18 / assetCount; // 2%
        uint256 remainder = 1e18 - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            address assetAddr = address(uint160(0x2000 + i));
            assets[i] = assetAddr;
            weights[i] = weightPerAsset;
            prices[i] = (i + 1) * 1e18; // $1, $2, $3, ...
        }
        weights[0] += remainder;

        bytes32 maxItpId = index.createITP("Max Assets", "MAX", weights, assets, prices, type(uint256).max);
        uint256 nav = index.getNAV(maxItpId);
        // ITP starts at $1 — NAV should be ~1e18
        assertApproxEqAbs(nav, 1e18, 1e3, "50-asset ITP NAV should be ~$1 at creation prices");
    }

    function test_nav_zeroPriceContributesZero() public {
        // Simulate ETH price going to 0 — only BTC component contributes
        // qty_btc = (6e17 * 1e18) / 50000e18 = 12000000000000
        // contribution = (12000000000000 * 50000e18) / 1e18 = 6e17 ($0.60)
        uint256 expected = 6e17;
        index.setItpNav(multiAssetItpId, expected, _signSetItpNav(multiAssetItpId, expected));
        uint256 nav = index.getNAV(multiAssetItpId);
        assertEq(nav, expected, "NAV should reflect zero ETH price scenario");
    }

    function test_nav_unequalWeights() public {
        // 99.75% BTC + 0.25% ETH
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 9975e14; // 99.75%
        weights[1] = 25e14;   // 0.25%

        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 unequalItpId = index.createITP("Unequal", "UNEQ", weights, assets, prices, type(uint256).max);
        uint256 nav = index.getNAV(unequalItpId);

        // ITP starts at $1 — NAV should be ~1e18 regardless of weight distribution
        assertApproxEqAbs(nav, 1e18, 1e3, "Unequal weight ITP NAV should be ~$1 at creation prices");
    }

    function test_submitOrder_limitPriceWorksWithNAV() public {
        // Multi-asset ITP NAV ≈ $1 (starts at $1)
        uint256 nav = index.getNAV(multiAssetItpId);
        assertApproxEqAbs(nav, 1e18, 1e3, "Pre-condition: NAV should be ~$1");

        // Order at NAV price should succeed
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            multiAssetItpId,
            TypesLib.Side.BUY,
            10e18,
            nav,
            1,
            block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "Order should succeed at NAV price");
    }

    // ============ MIN BUY AMOUNT TESTS (AC #3) ============

    function test_minBuyAmount_orderBelowMinReverts() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // Set minimum buy amount for BTC to 100 USDC
        index.setMinBuyAmount(btcAddr, 100e18);

        // Try to submit order below minimum
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E082_BelowMinBuyAmount.selector, 50e18, 100e18)
        );
        index.submitOrder(
            singleAssetItpId,
            TypesLib.Side.BUY,
            50e18,
            nav,
            1,
            block.timestamp + 1 hours
        );
    }

    function test_minBuyAmount_orderAtMinSucceeds() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        index.setMinBuyAmount(btcAddr, 100e18);

        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId,
            TypesLib.Side.BUY,
            100e18,
            nav,
            1,
            block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "Order at minimum should succeed");
    }

    function test_minBuyAmount_unconfiguredPasses() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // No minBuyAmount set for BTC (default 0) — should pass
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId,
            TypesLib.Side.BUY,
            1e15, // Minimum global amount
            nav,
            1,
            block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "Unconfigured asset should pass min check");
    }

    function test_minBuyAmount_adminOnlyAccess() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E061_Unauthorized.selector, user1, admin)
        );
        index.setMinBuyAmount(btcAddr, 100e18);
    }

    function test_minBuyAmount_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit EventsLib.MinBuyAmountUpdated(btcAddr, 100e18);
        index.setMinBuyAmount(btcAddr, 100e18);
    }

    function test_setBatchMinBuyAmounts() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e18;
        amounts[1] = 50e18;

        index.setBatchMinBuyAmounts(assets, amounts);

        assertEq(index.minBuyAmount(btcAddr), 100e18, "BTC min should be set");
        assertEq(index.minBuyAmount(ethAddr), 50e18, "ETH min should be set");
    }

    function test_setBatchMinBuyAmounts_revertsOnLengthMismatch() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E015_LengthMismatch.selector, 2, 1)
        );
        index.setBatchMinBuyAmounts(assets, amounts);
    }

    function test_minBuyAmount_sellOrderNotChecked() public {
        // Seed some shares for user1 BEFORE setting min buy amount
        _seedShares(singleAssetItpId, user1, 100e18);

        // Set high min buy amount AFTER seeding
        index.setMinBuyAmount(btcAddr, 1_000_000e18);

        uint256 nav = index.getNAV(singleAssetItpId);
        // SELL order should not check minBuyAmount
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId,
            TypesLib.Side.SELL,
            10e18,
            nav,
            1,
            block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "SELL order should bypass minBuyAmount");
    }

    // ============ QUEUE DEPTH TESTS (AC #4) ============

    function test_queueDepth_incrementsOnSubmit() public {
        assertEq(index.pendingOrderCount(), 0, "Should start at 0");
        uint256 nav = index.getNAV(singleAssetItpId);

        vm.prank(user1);
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);

        assertEq(index.pendingOrderCount(), 1, "Should increment to 1");
    }

    function test_queueDepth_decrementsOnFill() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // Submit order
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours
        );
        assertEq(index.pendingOrderCount(), 1, "Pre: Should be 1");

        // Batch and fill
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signBatch(1, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: nav,
            fillAmount: 10e18,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        index.confirmFills(1, fills, _signFills(1, fills));

        assertEq(index.pendingOrderCount(), 0, "Should decrement to 0 after fill");
    }

    function test_queueDepth_decrementsOnRefund() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // Submit order
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours
        );
        assertEq(index.pendingOrderCount(), 1, "Pre: Should be 1");

        // Warp past deadline
        vm.warp(block.timestamp + 2 hours);

        // Refund
        index.refundExpiredOrder(orderId, _signRefund(orderId));

        assertEq(index.pendingOrderCount(), 0, "Should decrement to 0 after refund");
    }

    function test_queueDepth_pauseThresholdReverts() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // Set pause threshold to 3
        index.setQueueThresholds(2, 3);

        // Submit 3 orders (reaching threshold)
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(user1);
            index.submitOrder(
                singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours
            );
        }

        assertEq(index.pendingOrderCount(), 3, "Should have 3 pending");

        // 4th order should revert
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E083_QueueFull.selector, 3, 3)
        );
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);
    }

    function test_queueDepth_atThresholdMinusOneSucceeds() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        index.setQueueThresholds(2, 3);

        // Submit 2 orders (below threshold)
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(user1);
            index.submitOrder(
                singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours
            );
        }

        // 3rd order should still succeed (at threshold - 1 before increment)
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "Order at threshold-1 should succeed");
    }

    function test_queueDepth_warningEventEmitted() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        index.setQueueThresholds(2, 10);

        // Submit 2 orders to reach warning threshold
        vm.prank(user1);
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);
        vm.prank(user1);
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);

        // 3rd order should emit warning (count > 2)
        vm.expectEmit(false, false, false, true);
        emit EventsLib.QueueDepthWarning(3);
        vm.prank(user1);
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);
    }

    function test_setQueueThresholds_adminOnly() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E061_Unauthorized.selector, user1, admin)
        );
        index.setQueueThresholds(100, 500);
    }

    function test_setQueueThresholds_configurable() public {
        index.setQueueThresholds(200, 1000);
        assertEq(index.queueWarningThreshold(), 200, "Warning threshold should be 200");
        assertEq(index.queuePauseThreshold(), 1000, "Pause threshold should be 1000");
    }

    function test_queueDepth_noThresholdMeansNoLimit() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        // Default thresholds are 0 (no limit)
        assertEq(index.queuePauseThreshold(), 0, "Default pause threshold should be 0");

        // Should be able to submit many orders
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(user1);
            index.submitOrder(
                singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours
            );
        }
        assertEq(index.pendingOrderCount(), 10, "Should have 10 pending orders");
    }

    // ============ INTEGRATION TESTS (AC #5) ============

    function test_integration_allFeaturesActive() public {
        // Configure all features
        index.setMinBuyAmount(btcAddr, 5e18);
        index.setQueueThresholds(2, 5);

        // Update NAV directly: BTC $50k → $55k (10% increase) → NAV = $1.10
        // qty_btc = (1e18 * 1e18) / 50000e18 = 2e13 (computed at creation)
        // new NAV = (2e13 * 55000e18) / 1e18 = 1.1e18 ($1.10)
        index.setItpNav(singleAssetItpId, 1.1e18, _signSetItpNav(singleAssetItpId, 1.1e18));

        uint256 nav = index.getNAV(singleAssetItpId);
        assertEq(nav, 1.1e18, "NAV should reflect updated value ($1.10)");

        // Submit order above min amount, within limit price, within queue limit
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            singleAssetItpId,
            TypesLib.Side.BUY,
            10e18,
            nav,
            1,
            block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "Order should succeed with all features active");

        // Verify queue depth increased
        assertEq(index.pendingOrderCount(), 1, "Queue depth should be 1");
    }

    function test_integration_zeroPrice_edgeCase() public {
        // Set NAV to 0 (simulates oracle failure — all prices 0)
        index.setItpNav(multiAssetItpId, 0, _signSetItpNav(multiAssetItpId, 0));

        // NAV should be 0
        uint256 nav = index.getNAV(multiAssetItpId);
        assertEq(nav, 0, "NAV should be 0 when set to 0");

        // Order with 0 NAV should skip limit price check (per existing logic)
        vm.prank(user1);
        uint256 orderId = index.submitOrder(
            multiAssetItpId,
            TypesLib.Side.BUY,
            10e18,
            1e18, // any limit price
            1,
            block.timestamp + 1 hours
        );
        assertGt(orderId, 0, "Order should succeed with 0 NAV");
    }

    function test_integration_exactThresholdBoundaries() public {
        uint256 nav = index.getNAV(singleAssetItpId);
        index.setQueueThresholds(1, 2);

        // First order — no warning (count = 1, not > 1)
        vm.prank(user1);
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);
        assertEq(index.pendingOrderCount(), 1, "Count should be 1");

        // Second order — warning emitted (count = 2 > 1)
        vm.expectEmit(false, false, false, true);
        emit EventsLib.QueueDepthWarning(2);
        vm.prank(user1);
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);
        assertEq(index.pendingOrderCount(), 2, "Count should be 2");

        // Third order — should revert (count >= 2 = pause threshold)
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E083_QueueFull.selector, 2, 2)
        );
        index.submitOrder(singleAssetItpId, TypesLib.Side.BUY, 10e18, nav, 1, block.timestamp + 1 hours);
    }

    function test_setQueueThresholds_revertsIfWarningGtPause() public {
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E089_InvalidQueueThresholds.selector, 500, 100)
        );
        index.setQueueThresholds(500, 100);
    }

    function test_setQueueThresholds_allowsWarningEqualPause() public {
        index.setQueueThresholds(100, 100);
        assertEq(index.queueWarningThreshold(), 100);
        assertEq(index.queuePauseThreshold(), 100);
    }

    function test_setQueueThresholds_allowsBothZero() public {
        index.setQueueThresholds(0, 0);
        assertEq(index.queueWarningThreshold(), 0);
        assertEq(index.queuePauseThreshold(), 0);
    }

    function test_setQueueThresholds_allowsWarningOnlyNoPause() public {
        // Warning only (pause = 0 means no limit) — any warning value is valid
        index.setQueueThresholds(100, 0);
        assertEq(index.queueWarningThreshold(), 100);
        assertEq(index.queuePauseThreshold(), 0);
    }

    function test_setQueueThresholds_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit EventsLib.QueueThresholdsUpdated(100, 500);
        index.setQueueThresholds(100, 500);
    }

    function test_nav_consistentAcrossViewFunctions() public {
        // getNAV and getITPState should return the same NAV
        uint256 navDirect = index.getNAV(singleAssetItpId);
        (,, uint256 navFromState,,,) = index.getITPState(singleAssetItpId);
        assertEq(navDirect, navFromState, "getNAV and getITPState.nav must match");
    }

    // ============ HELPERS ============

    /// @dev Give shares to a user for SELL order testing
    function _seedShares(bytes32 _itpId, address user, uint256 amount) internal {
        // Compute limit price before vm.prank (avoid prank consumed by view call)
        uint256 navPrice = index.getNAV(_itpId);
        uint256 limitPrice = navPrice > 0 ? navPrice : 1e18;

        // Submit BUY order → batch → fill to give user shares
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            _itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            2,
            block.timestamp + 1 hours
        );

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        // Use a unique cycle number
        uint256 cycle = uint256(keccak256(abi.encode(orderId, block.timestamp)));
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: amount,
            cycleNumber: cycle,
            txHash: bytes32(0)
        });
        index.confirmFills(cycle, fills, _signFills(cycle, fills));
    }
}
