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

/// @title LimitPriceFill.t.sol - Tests for on-chain limit price enforcement
/// @notice Tests that fill prices are validated against order limitPrice in confirmFills
contract LimitPriceFillTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;

    address public user = address(0x1);
    address public admin = address(this);

    bytes32 public itpId;

    uint256 constant INITIAL_PRICE = 1e18;

    // Counter for unique cycle numbers
    uint256 internal _cycleCounter = 1;

    function setUp() public {
        // Deploy mock USDC with 18 decimals
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy mock governance
        governance = deployGovernance(address(this));

        // Deploy Index as UUPS proxy
        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        index = Investment(address(proxy));

        // Setup IssuerRegistry with real BLS keys for verification
        IssuerRegistry registry = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(registry, address(this));
        index.setIssuerRegistry(address(registry));

        // Create test ITP with 1 asset
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = address(usdc);
        uint256[] memory prices = new uint256[](1);
        prices[0] = INITIAL_PRICE;

        itpId = index.createITP("Test ITP", "TITP", weights, assets, prices, type(uint256).max);

        // Mint USDC to test user and approve
        usdc.mint(user, 10_000e18);
        vm.prank(user);
        usdc.approve(address(index), type(uint256).max);
    }

    // ============ HELPERS ============

    function _nextCycle() internal returns (uint256) {
        return _cycleCounter++;
    }

    function _signBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestIssuers(msgHash);
    }

    function _signFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestIssuers(msgHash);
    }

    /// @notice Submit a BUY order, batch it, and fill it in one shot
    function _buyAndFill(address userAddr, uint256 amount, uint256 limitPrice, uint256 fillPrice) internal returns (uint256 orderId) {
        vm.prank(userAddr);
        orderId = index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, 1, block.timestamp + 1 hours);

        uint256 cycle = _nextCycle();

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds), 3, 7);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: amount,
            cycleNumber: cycle,
            txHash: bytes32(0)
        });
        index.confirmFills(cycle, fills, _signFills(cycle, fills), 3, 7);
    }

    /// @notice Submit a BUY order with a specific limit price
    function _createBuyOrder(address userAddr, uint256 amount, uint256 limitPrice) internal returns (uint256) {
        vm.prank(userAddr);
        return index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, 1, block.timestamp + 1 hours);
    }

    /// @notice Submit a SELL order with a specific limit price (user must have shares already)
    function _createSellOrder(address userAddr, uint256 shares, uint256 limitPrice) internal returns (uint256) {
        vm.prank(userAddr);
        return index.submitOrder(itpId, TypesLib.Side.SELL, shares, limitPrice, 1, block.timestamp + 1 hours);
    }

    /// @notice Give user shares by completing a buy at price 1e18 with no limit
    function _giveUserShares(address userAddr, uint256 shareAmount) internal {
        usdc.mint(userAddr, shareAmount);
        vm.prank(userAddr);
        usdc.approve(address(index), shareAmount);
        _buyAndFill(userAddr, shareAmount, 0, 1e18);
    }

    /// @notice Batch and fill a single order
    function _batchAndFill(uint256 orderId, uint256 fillPrice, uint256 fillAmount) internal {
        uint256 cycle = _nextCycle();

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds), 3, 7);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: fillAmount,
            cycleNumber: cycle,
            txHash: bytes32(0)
        });
        index.confirmFills(cycle, fills, _signFills(cycle, fills), 3, 7);
    }

    /// @notice Batch and attempt fill (expecting revert)
    function _batchAndFillExpectRevert(uint256 orderId, uint256 fillPrice, uint256 fillAmount, bytes memory revertData) internal {
        uint256 cycle = _nextCycle();

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds), 3, 7);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: fillAmount,
            cycleNumber: cycle,
            txHash: bytes32(0)
        });

        vm.expectRevert(revertData);
        index.confirmFills(cycle, fills, _signFills(cycle, fills), 3, 7);
    }

    // ============ BUY LIMIT PRICE TESTS ============

    /// @notice 1. Fill price = limit price -> succeeds
    function test_buyFill_atLimitPrice_succeeds() public {
        uint256 orderId = _createBuyOrder(user, 10e18, 2e18); // limit = $2
        _batchAndFill(orderId, 2e18, 10e18); // fill at exactly $2

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    /// @notice 2. Fill price < limit price -> succeeds (better deal for buyer)
    function test_buyFill_belowLimitPrice_succeeds() public {
        uint256 orderId = _createBuyOrder(user, 10e18, 2e18); // limit = $2
        _batchAndFill(orderId, 1e18, 10e18); // fill at $1 (better than $2 limit)

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    /// @notice 3. Fill price > limit price -> reverts with E126
    function test_buyFill_aboveLimitPrice_reverts() public {
        uint256 orderId = _createBuyOrder(user, 10e18, 2e18); // limit = $2

        _batchAndFillExpectRevert(
            orderId,
            3e18,  // fill at $3, exceeds $2 limit
            10e18,
            abi.encodeWithSelector(
                ErrorsLib.E126_FillPriceViolatesLimit.selector,
                orderId,
                3e18,   // fillPrice
                2e18,   // limitPrice
                uint8(TypesLib.Side.BUY) // side=0
            )
        );
    }

    /// @notice 4. limitPrice=0, high fill price -> succeeds (no limit)
    function test_buyFill_noLimit_anyPriceSucceeds() public {
        uint256 orderId = _createBuyOrder(user, 10e18, 0); // no limit
        _batchAndFill(orderId, 5e18, 10e18); // fill at $5 - any price should work

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    /// @notice 5. Verify shares = fillAmount * 1e18 / fillPrice when at limit
    function test_buyFill_atLimitPrice_sharesCorrect() public {
        uint256 sharesBefore = index.getUserShares(itpId, user);

        uint256 orderId = _createBuyOrder(user, 10e18, 2e18); // limit = $2
        _batchAndFill(orderId, 2e18, 10e18); // fill at $2

        uint256 sharesAfter = index.getUserShares(itpId, user);
        // shares = fillAmount * 1e18 / fillPrice = 10e18 * 1e18 / 2e18 = 5e18
        assertEq(sharesAfter - sharesBefore, 5e18, "Shares should be fillAmount/fillPrice");
    }

    /// @notice 6. Fill below limit gives more shares (user benefits)
    function test_buyFill_belowLimitPrice_moreShares() public {
        // Create two orders: one at limit, one below
        uint256 orderId1 = _createBuyOrder(user, 10e18, 2e18);
        _batchAndFill(orderId1, 2e18, 10e18); // at limit price $2
        uint256 sharesAtLimit = index.getUserShares(itpId, user);

        // Second user: fill below limit gives more shares
        address user2 = address(0x2);
        usdc.mint(user2, 10e18);
        vm.prank(user2);
        usdc.approve(address(index), type(uint256).max);

        vm.prank(user2);
        uint256 orderId2 = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 2e18, 1, block.timestamp + 1 hours);
        _batchAndFill(orderId2, 1e18, 10e18); // below limit price $1
        uint256 sharesBelowLimit = index.getUserShares(itpId, user2);

        // At $2: shares = 10e18 / 2e18 = 5e18
        // At $1: shares = 10e18 / 1e18 = 10e18
        assertEq(sharesAtLimit, 5e18, "Shares at limit");
        assertEq(sharesBelowLimit, 10e18, "Shares below limit");
        assertTrue(sharesBelowLimit > sharesAtLimit, "Below-limit fill should give more shares");
    }

    // ============ SELL LIMIT PRICE TESTS ============

    /// @notice 7. Fill price = limit price -> succeeds
    function test_sellFill_atLimitPrice_succeeds() public {
        _giveUserShares(user, 100e18);

        uint256 orderId = _createSellOrder(user, 50e18, 1e18); // limit = $1
        // Fund contract for payout
        usdc.mint(address(index), 50e18);
        _batchAndFill(orderId, 1e18, 50e18); // fill at exactly $1

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    /// @notice 8. Fill price > limit price -> succeeds (better deal for seller)
    function test_sellFill_aboveLimitPrice_succeeds() public {
        _giveUserShares(user, 100e18);

        uint256 orderId = _createSellOrder(user, 50e18, 1e18); // limit = $1
        // Fund contract for payout at higher price
        usdc.mint(address(index), 100e18);
        _batchAndFill(orderId, 2e18, 50e18); // fill at $2 (better than $1 limit)

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    /// @notice 9. Fill price < limit price -> reverts with E126
    function test_sellFill_belowLimitPrice_reverts() public {
        _giveUserShares(user, 100e18);

        uint256 orderId = _createSellOrder(user, 50e18, 2e18); // limit = $2 minimum

        _batchAndFillExpectRevert(
            orderId,
            1e18,  // fill at $1, below $2 limit
            50e18,
            abi.encodeWithSelector(
                ErrorsLib.E126_FillPriceViolatesLimit.selector,
                orderId,
                1e18,   // fillPrice
                2e18,   // limitPrice
                uint8(TypesLib.Side.SELL) // side=1
            )
        );
    }

    /// @notice 10. limitPrice=0, low fill price -> succeeds (no limit)
    function test_sellFill_noLimit_anyPriceSucceeds() public {
        _giveUserShares(user, 100e18);

        uint256 orderId = _createSellOrder(user, 50e18, 0); // no limit
        // Fund contract for payout
        usdc.mint(address(index), 50e18);
        _batchAndFill(orderId, 0.01e18, 50e18); // very low price, no limit so it passes

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }

    /// @notice 11. Verify USDC returned = fillAmount * fillPrice / 1e18
    function test_sellFill_atLimitPrice_usdcCorrect() public {
        _giveUserShares(user, 100e18);

        uint256 userBalanceBefore = usdc.balanceOf(user);

        uint256 orderId = _createSellOrder(user, 50e18, 1.5e18); // limit = $1.50
        // Fund contract for payout
        usdc.mint(address(index), 75e18);
        _batchAndFill(orderId, 1.5e18, 50e18); // fill at exactly $1.50

        uint256 userBalanceAfter = usdc.balanceOf(user);
        // usdcToReturn = (50e18 * 1.5e18) / 1e18 = 75e18
        assertEq(userBalanceAfter - userBalanceBefore, 75e18, "USDC returned should be fillAmount * fillPrice / 1e18");
    }

    // ============ EDGE CASE TESTS ============

    /// @notice 12. Tiny limit, normal fill -> reverts
    function test_buyFill_limitPrice1Wei_aboveFillReverts() public {
        uint256 orderId = _createBuyOrder(user, 10e18, 1); // limit = 1 wei

        _batchAndFillExpectRevert(
            orderId,
            1e18,  // fill at $1, way above 1 wei limit
            10e18,
            abi.encodeWithSelector(
                ErrorsLib.E126_FillPriceViolatesLimit.selector,
                orderId,
                1e18,
                1,
                uint8(TypesLib.Side.BUY)
            )
        );
    }

    /// @notice 13. Huge min price, normal fill -> reverts
    function test_sellFill_hugeLimitPrice_normalFillReverts() public {
        _giveUserShares(user, 100e18);

        uint256 hugeLimit = 1000e18; // $1000 minimum
        uint256 orderId = _createSellOrder(user, 50e18, hugeLimit);

        _batchAndFillExpectRevert(
            orderId,
            1e18,  // fill at $1, way below $1000 limit
            50e18,
            abi.encodeWithSelector(
                ErrorsLib.E126_FillPriceViolatesLimit.selector,
                orderId,
                1e18,
                hugeLimit,
                uint8(TypesLib.Side.SELL)
            )
        );
    }

    /// @notice 14. Exact boundary: fillPrice = limitPrice + 1 -> reverts, fillPrice = limitPrice -> succeeds
    function test_buyFill_exactLimitBoundary() public {
        uint256 limitPrice = 2e18;

        // First: fillPrice = limitPrice + 1 -> reverts
        uint256 orderId1 = _createBuyOrder(user, 10e18, limitPrice);
        _batchAndFillExpectRevert(
            orderId1,
            limitPrice + 1,  // 1 wei above limit
            10e18,
            abi.encodeWithSelector(
                ErrorsLib.E126_FillPriceViolatesLimit.selector,
                orderId1,
                limitPrice + 1,
                limitPrice,
                uint8(TypesLib.Side.BUY)
            )
        );

        // Second: fillPrice = limitPrice -> succeeds
        uint256 orderId2 = _createBuyOrder(user, 10e18, limitPrice);
        _batchAndFill(orderId2, limitPrice, 10e18); // exactly at limit

        TypesLib.LimitOrder memory order2 = index.getOrder(orderId2);
        assertEq(uint8(order2.status), uint8(TypesLib.OrderStatus.FILLED));
    }
}
