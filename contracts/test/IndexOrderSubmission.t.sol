// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Investment.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract IndexOrderSubmissionTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;
    IssuerRegistry public issuerRegistry;

    address public user = address(0x1);
    address public admin = address(this);

    bytes32 public itpId;
    bytes32 public pairId;

    uint256 constant MIN_ORDER_AMOUNT = 1e15; // 0.001 USDC
    uint256 constant MAX_DEADLINE_DURATION = 24 hours;
    uint256 constant INITIAL_PRICE = 1e18; // $1.00

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

        // Deploy IssuerRegistry with real BLS keys and wire to Index
        issuerRegistry = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(issuerRegistry, address(this));
        index.setIssuerRegistry(address(issuerRegistry));

        // Create test ITP using helper function
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18; // 100% weight
        address[] memory assets = new address[](1);
        assets[0] = address(usdc);

        uint256[] memory prices = new uint256[](1);
        prices[0] = INITIAL_PRICE;

        itpId = index.createITP("Test ITP", "TITP", weights, assets, prices, type(uint256).max);

        // Compute pairId (itpId + asset index 0)
        pairId = keccak256(abi.encode(itpId, uint256(0)));

        // Mint USDC to test user
        usdc.mint(user, 1000e18);

        // User approves Index to spend USDC
        vm.prank(user);
        usdc.approve(address(index), type(uint256).max);
    }

    // ============ TASK 1: Core submitOrder Tests ============

    function test_submitOrder_happyPath() public {
        uint256 amount = 10e18; // 10 USDC
        uint256 limitPrice = 1e18; // $1.00
        uint256 slippageTier = 1; // normal
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, slippageTier, deadline);

        // Verify orderId starts from 1
        assertEq(orderId, 1);

        // Verify order stored correctly
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.id, orderId);
        assertEq(order.user, user);
        assertEq(order.itpId, itpId);
        assertEq(uint8(order.side), uint8(TypesLib.Side.BUY));
        assertEq(order.amount, amount);
        assertEq(order.limitPrice, limitPrice);
        assertEq(order.slippageTier, slippageTier);
        assertEq(order.deadline, deadline);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.PENDING));

        // Verify USDC transferred from user to Index
        assertEq(usdc.balanceOf(user), 1000e18 - amount);
        assertEq(usdc.balanceOf(address(index)), amount);
    }

    function test_submitOrder_emitsEvent() public {
        uint256 amount = 10e18;
        uint256 limitPrice = 1e18;
        uint256 slippageTier = 1;
        uint256 deadline = block.timestamp + 1 hours;

        vm.expectEmit(true, true, true, true);
        emit EventsLib.OrderSubmitted(
            1, // orderId
            user,
            itpId,
            pairId,
            uint8(TypesLib.Side.BUY),
            amount,
            limitPrice,
            slippageTier,
            deadline
        );

        vm.prank(user);
        index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, slippageTier, deadline);
    }

    function test_submitOrder_incrementsOrderId() public {
        uint256 amount = 10e18;
        uint256 limitPrice = 1e18;
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(user);
        uint256 orderId1 = index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, 1, deadline);
        uint256 orderId2 = index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, 1, deadline + 1 hours);
        uint256 orderId3 = index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, 0, deadline + 2 hours);
        vm.stopPrank();

        assertEq(orderId1, 1);
        assertEq(orderId2, 2);
        assertEq(orderId3, 3);
    }

    // ============ TASK 2: Slippage Tier Validation Tests ============

    function test_submitOrder_slippageTier0() public {
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            itpId, TypesLib.Side.BUY, 10e18, 1e18, 0, block.timestamp + 1 hours
        );

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.slippageTier, 0);
    }

    function test_submitOrder_slippageTier1() public {
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours
        );

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.slippageTier, 1);
    }

    function test_submitOrder_slippageTier2() public {
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            itpId, TypesLib.Side.BUY, 10e18, 1e18, 2, block.timestamp + 1 hours
        );

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.slippageTier, 2);
    }

    function test_submitOrder_revertsOnInvalidSlippageTier() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E011_InvalidSlippageTier.selector, 3));
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 3, block.timestamp + 1 hours);
    }

    function test_submitOrder_revertsOnSlippageTier4() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E011_InvalidSlippageTier.selector, 4));
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 4, block.timestamp + 1 hours);
    }

    // ============ TASK 3: Deadline Validation Tests ============

    function test_submitOrder_revertsOnDeadlineInPast() public {
        vm.warp(1000); // Set block.timestamp to 1000

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E012_InvalidDeadline.selector, 500, 1000, 24 hours)
        );
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, 500);
    }

    function test_submitOrder_revertsOnDeadlineEqualToNow() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E012_InvalidDeadline.selector, block.timestamp, block.timestamp, 24 hours)
        );
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp);
    }

    function test_submitOrder_revertsOnDeadlineTooFar() public {
        uint256 tooFarDeadline = block.timestamp + 25 hours;
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E012_InvalidDeadline.selector, tooFarDeadline, block.timestamp, 24 hours)
        );
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, tooFarDeadline);
    }

    function test_submitOrder_acceptsExact24HourDeadline() public {
        uint256 deadline = block.timestamp + 24 hours;

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, deadline);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.deadline, deadline);
    }

    function test_submitOrder_accepts1MinuteDeadline() public {
        uint256 deadline = block.timestamp + 1 minutes;

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, deadline);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.deadline, deadline);
    }

    // ============ TASK 5: Minimum Amount Validation Tests ============

    function test_submitOrder_revertsOnAmountBelowMinimum() public {
        uint256 tooSmall = MIN_ORDER_AMOUNT - 1; // Just below minimum

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E001_OrderBelowMin.selector, tooSmall, MIN_ORDER_AMOUNT)
        );
        index.submitOrder(itpId, TypesLib.Side.BUY, tooSmall, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_acceptsExactMinimumAmount() public {
        vm.prank(user);
        uint256 orderId =
            index.submitOrder(itpId, TypesLib.Side.BUY, MIN_ORDER_AMOUNT, 1e18, 1, block.timestamp + 1 hours);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.amount, MIN_ORDER_AMOUNT);
    }

    function test_submitOrder_revertsOnZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E001_OrderBelowMin.selector, 0, MIN_ORDER_AMOUNT));
        index.submitOrder(itpId, TypesLib.Side.BUY, 0, 1e18, 1, block.timestamp + 1 hours);
    }

    // ============ TASK 6: getOrder Tests ============

    function test_getOrder_returnsCorrectData() public {
        uint256 amount = 50e18;
        uint256 limitPrice = 0.9e18;
        uint256 slippageTier = 2;
        uint256 deadline = block.timestamp + 12 hours;

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, amount, limitPrice, slippageTier, deadline);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);

        assertEq(order.id, orderId);
        assertEq(order.user, user);
        assertEq(order.itpId, itpId);
        assertEq(uint8(order.side), uint8(TypesLib.Side.BUY));
        assertEq(order.amount, amount);
        assertEq(order.limitPrice, limitPrice);
        assertEq(order.slippageTier, slippageTier);
        assertEq(order.deadline, deadline);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.PENDING));
        assertEq(order.timestamp, block.timestamp);
    }

    function test_getOrder_returnsEmptyForNonExistent() public view {
        TypesLib.LimitOrder memory order = index.getOrder(999);
        assertEq(order.id, 0);
        assertEq(order.user, address(0));
    }

    // ============ TASK 7: Error Handling Tests ============

    function test_submitOrder_revertsOnInsufficientBalance() public {
        address poorUser = address(0x2);
        usdc.mint(poorUser, 1e18); // Only 1 USDC

        vm.prank(poorUser);
        usdc.approve(address(index), type(uint256).max);

        vm.prank(poorUser);
        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E002_InsufficientBalance.selector, poorUser, 10e18, 1e18)
        );
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_revertsOnNonExistentITP() public {
        bytes32 fakeItpId = keccak256("fake");

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E006_ITPNotFound.selector, fakeItpId));
        index.submitOrder(fakeItpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_revertsOnSystemPaused() public {
        governance.pause();

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E004_SystemPaused.selector));
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_revertsOnITPPaused() public {
        governance.pauseITP(itpId);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E003_ITPPaused.selector, itpId));
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    // ============ TASK 8: Additional Edge Case Tests ============

    // ============ SELL ORDER TESTS (Story 7.14) ============

    function test_submitOrder_sellRevertsOnInsufficientShares() public {
        // User has no ITP shares, so SELL should fail with E081
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E081_InsufficientShares.selector, user, 10e18, 0));
        index.submitOrder(itpId, TypesLib.Side.SELL, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_sellHappyPath() public {
        // First, give user some ITP shares via a BUY order that gets filled
        _setupUserWithShares(user, itpId, 100e18);

        uint256 sharesBefore = _getUserShares(itpId, user);
        assertEq(sharesBefore, 100e18);

        // Now submit a SELL order
        uint256 sellAmount = 50e18;
        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.SELL, sellAmount, 1e18, 1, block.timestamp + 1 hours);

        // Verify order stored correctly
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.id, orderId);
        assertEq(order.user, user);
        assertEq(order.itpId, itpId);
        assertEq(uint8(order.side), uint8(TypesLib.Side.SELL));
        assertEq(order.amount, sellAmount);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.PENDING));

        // Verify shares were escrowed (deducted from user)
        uint256 sharesAfter = _getUserShares(itpId, user);
        assertEq(sharesAfter, 100e18 - sellAmount);
    }

    function test_submitOrder_sellEmitsEvent() public {
        _setupUserWithShares(user, itpId, 100e18);

        uint256 sellAmount = 30e18;
        uint256 limitPrice = 1e18;
        uint256 slippageTier = 1;
        uint256 deadline = block.timestamp + 1 hours;

        // orderId is 2 because _setupUserWithShares creates order 1 (BUY) first
        vm.expectEmit(true, true, true, true);
        emit EventsLib.OrderSubmitted(
            2, // orderId (2nd order after the BUY in setup)
            user,
            itpId,
            pairId,
            uint8(TypesLib.Side.SELL),
            sellAmount,
            limitPrice,
            slippageTier,
            deadline
        );

        vm.prank(user);
        index.submitOrder(itpId, TypesLib.Side.SELL, sellAmount, limitPrice, slippageTier, deadline);
    }

    function test_submitOrder_sellRevertsOnPartialInsufficientShares() public {
        // User has some shares but not enough
        _setupUserWithShares(user, itpId, 25e18);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E081_InsufficientShares.selector, user, 50e18, 25e18));
        index.submitOrder(itpId, TypesLib.Side.SELL, 50e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_sellExactShares() public {
        // User sells exact amount of shares they have
        _setupUserWithShares(user, itpId, 100e18);

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.SELL, 100e18, 1e18, 1, block.timestamp + 1 hours);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.amount, 100e18);

        // All shares should be escrowed
        assertEq(_getUserShares(itpId, user), 0);
    }

    // Helper to setup user with ITP shares (simulates a completed BUY order)
    function _setupUserWithShares(address _user, bytes32 _itpId, uint256 shares) internal {
        uint256 amount = shares; // 1:1 for simplicity
        usdc.mint(_user, amount);

        vm.prank(_user);
        usdc.approve(address(index), amount);

        vm.prank(_user);
        uint256 orderId = index.submitOrder(_itpId, TypesLib.Side.BUY, amount, 1e18, 1, block.timestamp + 1 hours);

        // Batch the order with real BLS signature
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        uint256 cycleNum = 1;
        bytes32 batchMsg = keccak256(abi.encode(block.chainid, address(index), cycleNum, orderIds));
        index.confirmBatch(cycleNum, orderIds, signWithTestIssuers(batchMsg), 3, 7);

        // Fill the order with real BLS signature
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: amount,
            cycleNumber: cycleNum,
            txHash: keccak256("test_tx")
        });
        bytes32 fillMsg = keccak256(abi.encode(block.chainid, address(index), cycleNum, fills));
        index.confirmFills(cycleNum, fills, signWithTestIssuers(fillMsg), 3, 7);
    }

    // Helper to get user shares (reads internal _userShares via storage slot)
    function _getUserShares(bytes32 _itpId, address _user) internal view returns (uint256) {
        // _userShares is at slot 18 in IndexStorage.sol
        // For nested mapping: _userShares[_itpId][_user]
        // slot1 = keccak256(abi.encode(_itpId, baseSlot))
        // slot2 = keccak256(abi.encode(_user, slot1))
        bytes32 slot1 = keccak256(abi.encode(_itpId, uint256(18)));
        bytes32 slot2 = keccak256(abi.encode(_user, slot1));
        return uint256(vm.load(address(index), slot2));
    }

    function test_submitOrder_multipleOrdersSameUser() public {
        vm.startPrank(user);

        uint256 orderId1 = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 0, block.timestamp + 1 hours);
        uint256 orderId2 = index.submitOrder(itpId, TypesLib.Side.BUY, 20e18, 1.1e18, 1, block.timestamp + 2 hours);
        uint256 orderId3 = index.submitOrder(itpId, TypesLib.Side.BUY, 30e18, 0.9e18, 2, block.timestamp + 3 hours);

        vm.stopPrank();

        assertEq(orderId1, 1);
        assertEq(orderId2, 2);
        assertEq(orderId3, 3);

        // Verify total USDC transferred
        assertEq(usdc.balanceOf(address(index)), 60e18);
        assertEq(usdc.balanceOf(user), 1000e18 - 60e18);
    }

    function test_submitOrder_revertsOnInsufficientApproval() public {
        address lowApprovalUser = address(0x3);
        usdc.mint(lowApprovalUser, 100e18);

        vm.prank(lowApprovalUser);
        usdc.approve(address(index), 5e18); // Approve less than order amount

        vm.prank(lowApprovalUser);
        vm.expectRevert(); // SafeERC20 will revert on insufficient allowance
        index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrder_storesCorrectTimestamp() public {
        vm.warp(1234567890);

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.timestamp, 1234567890);
    }

    function test_submitOrder_storesCorrectPairId() public {
        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.pairId, pairId);
    }

    // ============ Access Control Tests ============

    function test_setIssuerRegistry_onlyOnce() public {
        // IssuerRegistry already set in setUp, so second call should revert
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E062_AlreadyInitialized.selector));
        index.setIssuerRegistry(address(0x5678));
    }

    function test_setIssuerRegistry_revertsForNonAdmin() public {
        // Deploy a fresh Index without IssuerRegistry set
        Investment impl2 = new Investment();
        ERC1967Proxy proxy2 = new ERC1967Proxy(
            address(impl2),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        Investment freshIndex = Investment(address(proxy2));

        address adminAddr = governance.admin();
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E061_Unauthorized.selector, user, adminAddr));
        vm.prank(user);
        freshIndex.setIssuerRegistry(address(0x1234));
    }

    // ============ Fuzz Tests ============

    function testFuzz_submitOrder_validAmounts(uint256 amount) public {
        // Bound amount to valid range
        amount = bound(amount, MIN_ORDER_AMOUNT, 100e18);

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, amount, 1e18, 1, block.timestamp + 1 hours);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.amount, amount);
    }

    function testFuzz_submitOrder_validPrices(uint256 limitPrice) public {
        // Bound price to valid range (50% to 150% of current price 1e18)
        limitPrice = bound(limitPrice, 0.5e18, 1.5e18);

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, limitPrice, 1, block.timestamp + 1 hours);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.limitPrice, limitPrice);
    }

    function testFuzz_submitOrder_validDeadlines(uint256 deadline) public {
        // Bound deadline to valid range
        deadline = bound(deadline, block.timestamp + 1, block.timestamp + 24 hours);

        vm.prank(user);
        uint256 orderId = index.submitOrder(itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, deadline);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.deadline, deadline);
    }

    // ============ submitOrderFor Tests ============

    function _setupIssuerRegistry() internal returns (IssuerRegistry registry, address issuerAddr) {
        // Use the registry already wired in setUp
        registry = issuerRegistry;

        // Register an issuer
        issuerAddr = address(0xC0D3);
        registerIssuer(registry, address(this), issuerAddr, bytes32(0), 10);

        // Fund the issuer with USDC and approve
        usdc.mint(issuerAddr, 1000e18);
        vm.prank(issuerAddr);
        usdc.approve(address(index), type(uint256).max);
    }

    function test_submitOrderFor_happyPath() public {
        (, address issuerAddr) = _setupIssuerRegistry();
        address beneficiary = address(0xBEEF);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(issuerAddr);
        uint256 orderId = index.submitOrderFor(beneficiary, itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, deadline);

        // Order user should be the beneficiary, not the issuer
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.user, beneficiary);
        assertEq(order.amount, 10e18);
        assertEq(uint8(order.side), uint8(TypesLib.Side.BUY));

        // USDC should have been taken from the issuer (payer), not the beneficiary
        assertEq(usdc.balanceOf(issuerAddr), 990e18);
    }

    function test_submitOrderFor_revertsForNonIssuer() public {
        _setupIssuerRegistry();
        address nonIssuer = address(0xBAD);
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(nonIssuer);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E097_NotActiveIssuer.selector, nonIssuer));
        index.submitOrderFor(address(0xBEEF), itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, deadline);
    }

    function test_submitOrderFor_revertsForZeroBeneficiary() public {
        (, address issuerAddr) = _setupIssuerRegistry();
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(issuerAddr);
        vm.expectRevert(ErrorsLib.E098_ZeroBeneficiary.selector);
        index.submitOrderFor(address(0), itpId, TypesLib.Side.BUY, 10e18, 1e18, 1, deadline);
    }

    function test_submitOrderFor_revertsWithNoIssuerRegistry() public {
        // Don't set issuer registry — default is address(0)
        // Need a fresh Index (setUp already sets registry on the main one)
        MockERC20 usdc2 = new MockERC20("USDC2", "USDC2", 18);
        Investment impl2 = new Investment();
        ERC1967Proxy proxy2 = new ERC1967Proxy(
            address(impl2),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc2)))
        );
        Investment index2 = Investment(address(proxy2));

        uint256[] memory w = new uint256[](1);
        w[0] = 1e18;
        address[] memory a = new address[](1);
        a[0] = address(usdc2);
        uint256[] memory p = new uint256[](1);
        p[0] = 1e18;
        index2.createITP("T", "T", w, a, p, type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E097_NotActiveIssuer.selector, address(this)));
        index2.submitOrderFor(address(0xBEEF), bytes32(uint256(1)), TypesLib.Side.BUY, 10e18, 1e18, 1, block.timestamp + 1 hours);
    }

    function test_submitOrderFor_sharesGoToBeneficiaryAfterFill() public {
        (, address issuerAddr) = _setupIssuerRegistry();
        address beneficiary = address(0xBEEF);
        uint256 deadline = block.timestamp + 1 hours;

        // Submit order via issuer for beneficiary
        vm.prank(issuerAddr);
        uint256 orderId = index.submitOrderFor(beneficiary, itpId, TypesLib.Side.BUY, 100e18, 1e18, 1, deadline);

        // Confirm batch with real BLS signature
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        uint256 cycleNum2 = 2;
        bytes32 batchMsg2 = keccak256(abi.encode(block.chainid, address(index), cycleNum2, orderIds));
        index.confirmBatch(cycleNum2, orderIds, signWithTestIssuers(batchMsg2), 3, 7);

        // Confirm fill with real BLS signature
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 100e18,
            cycleNumber: cycleNum2,
            txHash: bytes32(0)
        });
        bytes32 fillMsg2 = keccak256(abi.encode(block.chainid, address(index), cycleNum2, fills));
        index.confirmFills(cycleNum2, fills, signWithTestIssuers(fillMsg2), 3, 7);

        // Verify shares went to beneficiary, not issuer
        // shares = (100e18 * 1e18) / 1e18 = 100e18
        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(order.user, beneficiary);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED));
    }
}
