// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/core/Investment.sol";
import "../../src/core/ITP.sol";
import "../../src/custody/SettlementBridgeCustody.sol";
import "../../src/custody/L3BridgeCustody.sol";
import "../../src/core/BLSCustody.sol";
import "../../src/bridge/BridgeProxy.sol";
import "../../src/bridge/BridgedItpFactory.sol";
import "../../src/registry/CollateralRegistry.sol";
import "../mocks/MockERC20.sol";
import "../mocks/MockBitgetVault.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import "../../src/registry/OracleRegistry.sol";
import "../../src/libraries/TypesLib.sol";
import "../../src/libraries/ErrorsLib.sol";
import "../../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title E2ECrossChainBuyTest - End-to-End Cross-Chain Buy Integration Test (Story 6.12)
/// @notice Tests the full cross-chain buy flow:
///         buyITPFromSettlement on Settlement -> oracles process -> ITP minted on L3
/// @dev Uses vm.chainId() switching pattern from BridgeIntegrationTest and
///      order-to-mint patterns from E2EOrderToMint
contract E2ECrossChainBuyTest is TestHelper {
    // ============ CONTRACTS ============

    // L3 contracts
    Investment public index;
    MockERC20 public l3Usdc;
    Governance public governance;
    ITP public itpVault;

    // Settlement contracts
    SettlementBridgeCustody public settlementBridge;
    OracleRegistry public mockRegistry;
    MockERC20 public settlementUsdc;

    // ============ TEST ACCOUNTS ============

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public admin;

    // ============ STATE ============

    bytes32 public itpId;
    bytes32 public pairId;

    // ============ CONSTANTS ============

    uint256 public constant L3_CHAIN_ID = 111222333;
    uint256 public constant SETTLEMENT_CHAIN_ID = 42161;
    uint256 public constant INITIAL_PRICE = 1e18; // $1.00
    // Story 7-6b: Settlement USDC uses 6 decimals, L3 uses 18 decimals
    uint256 public constant INITIAL_SETTLEMENT_USDC = 10_000e6;  // 6 decimals for Settlement
    uint256 public constant INITIAL_L3_USDC = 10_000e18;  // 18 decimals for L3

    // ============ EVENTS (for expectEmit) ============

    event CrossChainOrderCreated(uint256 indexed orderId, bytes32 indexed itpId, address indexed user, uint256 amount);

    // ============ SETUP ============

    function setUp() public {
        admin = address(this);

        // Start on L3 chain context
        vm.chainId(L3_CHAIN_ID);

        // --- Deploy L3 stack ---
        l3Usdc = new MockERC20("USDC", "USDC", 18);
        governance = deployGovernance(admin);

        // Deploy real oracle registry via UUPS proxy (shared)
        mockRegistry = deployOracleRegistry(address(governance));

        // Register 3 real BLS test oracles and set aggregated pubkey
        registerTestOraclesWithBLS(mockRegistry, admin);

        // Deploy Index as UUPS proxy
        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(l3Usdc)))
        );
        index = Investment(address(proxy));

        // Wire OracleRegistry to Index (required for BLS verification)
        index.setOracleRegistry(address(mockRegistry));

        // Create test ITP with single asset (USDC, 100% weight)
        address[] memory assets = new address[](1);
        assets[0] = address(l3Usdc);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        uint256[] memory prices = new uint256[](1);
        prices[0] = INITIAL_PRICE;

        itpId = index.createITP("CrossChain Test", "XCHAIN", weights, assets, prices, type(uint256).max);
        pairId = keccak256(abi.encode(itpId, uint256(0)));

        // Deploy ITP vault and link it
        itpVault = new ITP(
            itpId,
            address(index),
            "CrossChain Test Token",
            "XCHAIN",
            IERC20(address(l3Usdc))
        );
        index.setITPVault(itpId, address(itpVault));

        // Fund L3 Index with USDC for fills (in production, USDC comes from user orders)
        // For cross-chain buy E2E, the L3 order is submitted by admin on behalf of user,
        // so admin needs USDC to escrow into Index
        l3Usdc.mint(admin, 100_000e18);
        l3Usdc.approve(address(index), type(uint256).max);

        // --- Deploy Settlement stack ---
        // Deploy Settlement USDC with 6 decimals (real USDC format on Settlement)
        // Story 7-6b: Settlement USDC uses 6 decimals, L3 uses 18 decimals internally
        settlementUsdc = new MockERC20("USDC", "USDC", 6);

        // Deploy SettlementBridgeCustody as UUPS proxy
        SettlementBridgeCustody settlementImpl = new SettlementBridgeCustody();
        ERC1967Proxy settlementProxy = new ERC1967Proxy(
            address(settlementImpl),
            abi.encodeCall(SettlementBridgeCustody.initialize, (address(mockRegistry), address(settlementUsdc), address(index), address(0)))
        );
        settlementBridge = SettlementBridgeCustody(address(settlementProxy));

        // Fund test users with Settlement USDC (6 decimals)
        address[3] memory users = [user1, user2, user3];
        for (uint256 i = 0; i < users.length; i++) {
            settlementUsdc.mint(users[i], INITIAL_SETTLEMENT_USDC);
            vm.prank(users[i]);
            settlementUsdc.approve(address(settlementBridge), type(uint256).max);
        }
    }

    // ============ HELPERS ============

    /// @dev User buys ITP from Settlement (switches to Settlement chain context)
    function _buyITPFromSettlement(
        address user,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) internal returns (uint256 orderId) {
        vm.chainId(SETTLEMENT_CHAIN_ID);
        vm.prank(user);
        orderId = settlementBridge.buyITPFromSettlement(itpId, amount, limitPrice, slippageTier, deadline);
        vm.chainId(L3_CHAIN_ID);
    }

    /// @dev Admin submits matching order on L3 Index (simulating oracle behavior)
    function _submitOrderOnL3(
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier
    ) internal returns (uint256 orderId) {
        orderId = index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            slippageTier,
            block.timestamp + 1 hours
        );
    }

    /// @dev User submits order on L3 (requires user to have L3 USDC approved to Index)
    function _submitOrderOnL3AsUser(
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

    /// @dev Confirm batch on L3
    function _confirmBatch(uint256 cycleNumber, uint256[] memory orderIds) internal {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        index.confirmBatch(cycleNumber, orderIds, signWithTestOracles(message), 3, 7);
    }

    /// @dev Confirm fills on L3
    function _confirmFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        index.confirmFills(cycleNumber, fills, signWithTestOracles(message), 3, 7);
    }

    // ============ SIGNING HELPERS ============

    /// @notice Sign Index.confirmBatch
    function _signConfirmBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestOracles(message);
    }

    /// @notice Sign Index.confirmFills
    function _signConfirmFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestOracles(message);
    }

    /// @notice Sign Index.setItpNav
    function _signSetItpNav(address indexAddr, bytes32 _itpId, uint256 nav) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, indexAddr, "setItpNav", _itpId, nav));
        return signWithTestOracles(message);
    }

    /// @notice Sign BLSCustody.proposeWhitelist
    function _signProposeWhitelist(address custodyAddr, address target) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, "proposeWhitelist", target));
        return signWithTestOracles(message);
    }

    /// @notice Sign BLSCustody.execute
    function _signExecute(address custodyAddr, address target, bytes memory data, uint256 nonceValue) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, custodyAddr, target, data, nonceValue));
        return signWithTestOracles(message);
    }

    /// @notice Sign CollateralRegistry.recordCollateralMove (uses internal auto-incrementing nonce)
    function _signRecordCollateralMove(
        address colRegAddr,
        bytes32 _itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        TypesLib.TxType txType,
        uint256 colRegNonce
    ) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, colRegAddr, _itpId, fromChain, toChain, amount, txType, colRegNonce));
        return signWithTestOracles(message);
    }

    /// @notice Sign BridgeProxy.completeCreateItp
    function _signCompleteCreateItp(
        address bridgeProxAddr,
        address creationAdmin,
        uint256 creationNonce,
        uint256[] memory weights,
        address[] memory assets
    ) internal returns (bytes memory) {
        bytes32 weightsHash = keccak256(abi.encodePacked(weights));
        bytes32 assetsHash = keccak256(abi.encodePacked(assets));
        bytes32 message = keccak256(abi.encodePacked(block.chainid, bridgeProxAddr, creationAdmin, creationNonce, weightsHash, assetsHash));
        return signWithTestOracles(message);
    }

    /// @notice Sign BridgeProxy.mintBridgedShares
    function _signMintBridgedShares(address bridgeProxAddr, bytes32 _itpId, address user, uint256 amount, uint256 orderId) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, bridgeProxAddr, "mintBridgedShares", _itpId, user, amount, orderId));
        return signWithTestOracles(message);
    }

    // ============ TASK 1.3: HAPPY PATH (AC #1, #2, #3, #4, #5) ============

    function test_e2e_crosschain_buy_happy_path() public {
        // Story 7-6b: User provides 6-decimal USDC, contract converts to 18-decimal internally
        uint256 orderAmount6Dec = 100e6;   // 100 USDC in 6 decimals (user input)
        uint256 orderAmount18Dec = 100e18; // 100 USDC in 18 decimals (internal)
        uint256 limitPrice = 1e18;         // $1.00 per share
        uint256 deadline = block.timestamp + 1 hours;

        // === AC1: User calls buyITPFromSettlement on Settlement ===

        uint256 userSettlementUsdcBefore = settlementUsdc.balanceOf(user1);
        uint256 custodySettlementUsdcBefore = settlementUsdc.balanceOf(address(settlementBridge));

        // Switch to Settlement chain and buy
        vm.chainId(SETTLEMENT_CHAIN_ID);

        // Expect CrossChainOrderCreated event with 18-decimal internal amount
        vm.expectEmit(true, true, true, true, address(settlementBridge));
        emit CrossChainOrderCreated(0, itpId, user1, orderAmount18Dec);

        vm.prank(user1);
        uint256 settlementOrderId = settlementBridge.buyITPFromSettlement(itpId, orderAmount6Dec, limitPrice, 1, deadline);

        // Verify order ID
        assertEq(settlementOrderId, 0, "First cross-chain order should have ID 0");

        // Verify 6-decimal USDC transferred from user to SettlementBridgeCustody
        assertEq(settlementUsdc.balanceOf(user1), userSettlementUsdcBefore - orderAmount6Dec, "User USDC should decrease");
        assertEq(settlementUsdc.balanceOf(address(settlementBridge)), custodySettlementUsdcBefore + orderAmount6Dec, "Custody USDC should increase");

        // === AC2: Oracles observe event and process on L3 ===

        // Verify getCrossChainOrder returns 18-decimal internal amount
        TypesLib.CrossChainOrder memory ccOrder = settlementBridge.getCrossChainOrder(settlementOrderId);
        assertEq(ccOrder.itpId, itpId, "Order itpId mismatch");
        assertEq(ccOrder.user, user1, "Order user mismatch");
        assertEq(ccOrder.amount, orderAmount18Dec, "Order amount should be 18 decimals");
        assertEq(ccOrder.limitPrice, limitPrice, "Order limitPrice mismatch");
        assertEq(ccOrder.deadline, deadline, "Order deadline mismatch");
        assertGt(ccOrder.createdAt, 0, "Order createdAt should be set");

        // Switch to L3 — simulate oracle routing order to user1
        vm.chainId(L3_CHAIN_ID);

        // Fund user1 with L3 USDC for order escrow (18 decimals on L3)
        l3Usdc.mint(user1, orderAmount18Dec);
        vm.prank(user1);
        l3Usdc.approve(address(index), type(uint256).max);

        // User1 submits matching order on L3 (oracle routes to user address)
        uint256 l3OrderId = _submitOrderOnL3AsUser(user1, orderAmount18Dec, limitPrice, 1);

        // Verify limitPrice continuity across chains
        TypesLib.LimitOrder memory pendingOrder = index.getOrder(l3OrderId);
        assertEq(pendingOrder.limitPrice, ccOrder.limitPrice, "L3 order limitPrice must match cross-chain order");

        // Confirm batch
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = l3OrderId;
        _confirmBatch(1, orderIds);

        // === AC3: AP executes trade, fill confirmed ===
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: l3OrderId,
            fillPrice: limitPrice,
            fillAmount: orderAmount18Dec,
            cycleNumber: 1,
            txHash: bytes32(uint256(0xdead))
        });
        _confirmFills(1, fills);

        // === AC4: ITP minted on L3 corresponds to user's cross-chain buy ===

        // shares = fillAmount * 1e18 / fillPrice = 100e18 * 1e18 / 1e18 = 100e18
        uint256 expectedShares = (orderAmount18Dec * 1e18) / limitPrice;

        // User1 submitted the L3 order, so ITP tokens go to user1
        assertEq(itpVault.balanceOf(user1), expectedShares, "User should receive ITP tokens on L3");
        assertGt(itpVault.balanceOf(user1), 0, "ITP balance must be > 0");

        // Verify order status is FILLED on L3
        TypesLib.LimitOrder memory order = index.getOrder(l3OrderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.FILLED), "L3 order should be FILLED");

        // Cross-chain order on Settlement remains stored (18-decimal internal amount)
        TypesLib.CrossChainOrder memory storedOrder = settlementBridge.getCrossChainOrder(settlementOrderId);
        assertEq(storedOrder.amount, orderAmount18Dec, "Cross-chain order should remain stored");
    }

    // ============ TASK 1.4: MULTIPLE USERS (AC #1, #2, #3, #4) ============

    function test_e2e_crosschain_buy_multiple_users() public {
        uint256 deadline = block.timestamp + 1 hours;

        // Story 7-6b: Users buy from Settlement with 6-decimal USDC
        // Contract converts to 18-decimal internally
        uint256 settlementOrder0 = _buyITPFromSettlement(user1, 50e6, 1e18, 1, deadline);
        uint256 settlementOrder1 = _buyITPFromSettlement(user2, 100e6, 1e18, 1, deadline);
        uint256 settlementOrder2 = _buyITPFromSettlement(user3, 200e6, 1e18, 0, deadline);

        assertEq(settlementOrder0, 0);
        assertEq(settlementOrder1, 1);
        assertEq(settlementOrder2, 2);

        // Simulate oracles processing on L3 — all in single batch (18-decimal amounts)
        uint256 l3Order1 = _submitOrderOnL3(50e18, 1e18, 1);
        uint256 l3Order2 = _submitOrderOnL3(100e18, 1e18, 1);
        uint256 l3Order3 = _submitOrderOnL3(200e18, 1e18, 0);

        uint256[] memory orderIds = new uint256[](3);
        orderIds[0] = l3Order1;
        orderIds[1] = l3Order2;
        orderIds[2] = l3Order3;
        _confirmBatch(1, orderIds);

        // Fill all at $1 (18-decimal amounts on L3)
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](3);
        fills[0] = TypesLib.Fill({orderId: l3Order1, fillPrice: 1e18, fillAmount: 50e18, cycleNumber: 1, txHash: bytes32(0)});
        fills[1] = TypesLib.Fill({orderId: l3Order2, fillPrice: 1e18, fillAmount: 100e18, cycleNumber: 1, txHash: bytes32(0)});
        fills[2] = TypesLib.Fill({orderId: l3Order3, fillPrice: 1e18, fillAmount: 200e18, cycleNumber: 1, txHash: bytes32(0)});
        _confirmFills(1, fills);

        // Verify ITP minted (all to admin in this simulation)
        assertEq(itpVault.balanceOf(admin), 350e18, "Total ITP should be 350");

        // Verify Settlement USDC balances (6-decimal amounts)
        assertEq(settlementUsdc.balanceOf(user1), INITIAL_SETTLEMENT_USDC - 50e6, "User1 Settlement USDC decreased");
        assertEq(settlementUsdc.balanceOf(user2), INITIAL_SETTLEMENT_USDC - 100e6, "User2 Settlement USDC decreased");
        assertEq(settlementUsdc.balanceOf(user3), INITIAL_SETTLEMENT_USDC - 200e6, "User3 Settlement USDC decreased");

        // Verify all L3 orders FILLED
        assertEq(uint8(index.getOrder(l3Order1).status), uint8(TypesLib.OrderStatus.FILLED));
        assertEq(uint8(index.getOrder(l3Order2).status), uint8(TypesLib.OrderStatus.FILLED));
        assertEq(uint8(index.getOrder(l3Order3).status), uint8(TypesLib.OrderStatus.FILLED));
    }

    // ============ TASK 1.5: EXPIRED DEADLINE (AC #5) ============

    function test_e2e_crosschain_buy_expired_deadline() public {
        vm.chainId(SETTLEMENT_CHAIN_ID);

        // Deadline in the past should revert
        uint256 pastDeadline = block.timestamp - 1;

        vm.prank(user1);
        vm.expectRevert(); // E058_InvalidDeadline
        settlementBridge.buyITPFromSettlement(itpId, 100e6, 1e18, 1, pastDeadline); // 6-decimal USDC
    }

    // ============ TASK 1.6: INVALID SLIPPAGE TIER (AC #5) ============

    function test_e2e_crosschain_buy_invalid_slippage_tier() public {
        vm.chainId(SETTLEMENT_CHAIN_ID);

        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E011_InvalidSlippageTier.selector, 3));
        settlementBridge.buyITPFromSettlement(itpId, 100e6, 1e18, 3, deadline); // 6-decimal USDC
    }

    // ============ TASK 1.7: ZERO AMOUNT (AC #5) ============

    function test_e2e_crosschain_buy_zero_amount() public {
        vm.chainId(SETTLEMENT_CHAIN_ID);

        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E059_CrossChainOrderZeroAmount.selector));
        settlementBridge.buyITPFromSettlement(itpId, 0, 1e18, 1, deadline);
    }

    // ============ TASK 1.8: ZERO ITP ID (AC #5) ============

    function test_e2e_crosschain_buy_zero_itpId() public {
        vm.chainId(SETTLEMENT_CHAIN_ID);

        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E060_ZeroITPId.selector));
        settlementBridge.buyITPFromSettlement(bytes32(0), 100e6, 1e18, 1, deadline); // 6-decimal USDC
    }

    // ============ TASK 1.9: INSUFFICIENT USDC (AC #5) ============

    function test_e2e_crosschain_buy_insufficient_usdc() public {
        vm.chainId(SETTLEMENT_CHAIN_ID);

        uint256 deadline = block.timestamp + 1 hours;
        address poorUser = makeAddr("poorUser");
        // poorUser has no USDC but approves
        vm.prank(poorUser);
        settlementUsdc.approve(address(settlementBridge), type(uint256).max);

        vm.prank(poorUser);
        vm.expectRevert(); // SafeERC20 transferFrom will revert
        settlementBridge.buyITPFromSettlement(itpId, 100e6, 1e18, 1, deadline); // 6-decimal USDC
    }

    // ============ TASK 1.10: ORDER STORED CORRECTLY (AC #1, #2) ============

    function test_e2e_crosschain_buy_order_stored_correctly() public {
        // Story 7-6b: User provides 6-decimal USDC, stored as 18-decimal internally
        uint256 amount6Dec = 500e6;   // User input (6 decimals)
        uint256 amount18Dec = 500e18; // Stored internally (18 decimals)
        uint256 limitPrice = 2e18;
        uint256 deadline = block.timestamp + 12 hours;

        vm.chainId(SETTLEMENT_CHAIN_ID);
        vm.prank(user1);
        uint256 orderId = settlementBridge.buyITPFromSettlement(itpId, amount6Dec, limitPrice, 2, deadline);

        TypesLib.CrossChainOrder memory order = settlementBridge.getCrossChainOrder(orderId);

        assertEq(order.itpId, itpId, "itpId stored correctly");
        assertEq(order.user, user1, "user stored correctly");
        assertEq(order.amount, amount18Dec, "amount stored as 18 decimals");
        assertEq(order.limitPrice, limitPrice, "limitPrice stored correctly");
        assertEq(order.deadline, deadline, "deadline stored correctly");
        assertEq(order.createdAt, block.timestamp, "createdAt is block.timestamp");
    }

    // ============ TASK 1.11: SEQUENTIAL ORDER IDS (AC #1) ============

    function test_e2e_crosschain_buy_sequential_order_ids() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.chainId(SETTLEMENT_CHAIN_ID);

        // Story 7-6b: Use 6-decimal USDC for Settlement buys
        vm.prank(user1);
        uint256 id0 = settlementBridge.buyITPFromSettlement(itpId, 10e6, 1e18, 0, deadline);

        vm.prank(user2);
        uint256 id1 = settlementBridge.buyITPFromSettlement(itpId, 20e6, 1e18, 1, deadline);

        vm.prank(user3);
        uint256 id2 = settlementBridge.buyITPFromSettlement(itpId, 30e6, 1e18, 2, deadline);

        assertEq(id0, 0, "First order ID should be 0");
        assertEq(id1, 1, "Second order ID should be 1");
        assertEq(id2, 2, "Third order ID should be 2");

        // Verify currentOrderId reflects the count
        assertEq(settlementBridge.currentOrderId(), 3, "Next order ID should be 3");
    }

    // ============ TASK 1.12: HIGHER FILL PRICE (AC #4) ============

    function test_e2e_crosschain_buy_higher_fill_price() public {
        // Story 7-6b: Settlement uses 6 decimals, L3 uses 18 decimals
        uint256 orderAmount6Dec = 100e6;   // Settlement USDC (6 decimals)
        uint256 orderAmount18Dec = 100e18; // L3 internal (18 decimals)
        uint256 fillPrice = 2e18; // $2/share -> fewer ITP tokens
        uint256 deadline = block.timestamp + 1 hours;

        // Buy on Settlement (6-decimal USDC)
        _buyITPFromSettlement(user1, orderAmount6Dec, 2e18, 1, deadline);

        // Set NAV to $2 on L3 so limit price validation passes
        {
            bytes32 navMessage = keccak256(abi.encode(block.chainid, address(index), "setItpNav", itpId, uint256(2e18)));
            index.setItpNav(itpId, 2e18, signWithTestOracles(navMessage), 3, 7);
        }

        // Submit matching order on L3 at $2 limit (18-decimal amount)
        uint256 l3OrderId = _submitOrderOnL3(orderAmount18Dec, 2e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = l3OrderId;
        _confirmBatch(1, orderIds);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: l3OrderId,
            fillPrice: fillPrice,
            fillAmount: orderAmount18Dec,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        // shares = 100e18 * 1e18 / 2e18 = 50e18
        uint256 expectedShares = (orderAmount18Dec * 1e18) / fillPrice;
        assertEq(expectedShares, 50e18, "Expected 50 shares at $2");
        assertEq(itpVault.balanceOf(admin), expectedShares, "Admin should receive 50 ITP at $2/share");
    }

    // ============ TASK 1.13: USDC CUSTODY BALANCES (AC #1, #4) ============

    function test_e2e_crosschain_buy_usdc_custody_balances() public {
        // Story 7-6b: Settlement uses 6 decimals, L3 uses 18 decimals
        uint256 orderAmount6Dec = 100e6;   // Settlement USDC (6 decimals)
        uint256 orderAmount18Dec = 100e18; // L3 internal (18 decimals)
        uint256 deadline = block.timestamp + 1 hours;

        uint256 settlementCustodyBefore = settlementUsdc.balanceOf(address(settlementBridge));
        uint256 l3IndexBefore = l3Usdc.balanceOf(address(index));

        // Buy on Settlement (6-decimal USDC)
        _buyITPFromSettlement(user1, orderAmount6Dec, 1e18, 1, deadline);

        // Verify USDC locked in SettlementBridgeCustody (6-decimal amount)
        assertEq(
            settlementUsdc.balanceOf(address(settlementBridge)),
            settlementCustodyBefore + orderAmount6Dec,
            "SettlementBridgeCustody should hold user's USDC"
        );

        // Submit and fill on L3 (18-decimal amount)
        uint256 l3OrderId = _submitOrderOnL3(orderAmount18Dec, 1e18, 1);
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = l3OrderId;
        _confirmBatch(1, orderIds);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: l3OrderId,
            fillPrice: 1e18,
            fillAmount: orderAmount18Dec,
            cycleNumber: 1,
            txHash: bytes32(0)
        });
        _confirmFills(1, fills);

        // Verify L3 Index received USDC for the order (from admin who submitted, 18-decimal)
        assertEq(
            l3Usdc.balanceOf(address(index)),
            l3IndexBefore + orderAmount18Dec,
            "L3 Index should hold USDC from admin order"
        );

        // SettlementBridgeCustody still holds the Settlement USDC (6-decimal, immutable custody)
        assertEq(
            settlementUsdc.balanceOf(address(settlementBridge)),
            settlementCustodyBefore + orderAmount6Dec,
            "SettlementBridgeCustody should still hold USDC"
        );
    }

    // ============ TASK 3: CROSS-CHAIN ORDER RETRIEVAL (AC #2) ============

    // Task 3.1: getCrossChainOrder returns all stored fields
    function test_getCrossChainOrder_returns_all_fields() public {
        uint256 deadline = block.timestamp + 6 hours;

        vm.chainId(SETTLEMENT_CHAIN_ID);
        vm.prank(user1);
        // Story 7-6b: User provides 6-decimal USDC, stored as 18-decimal internally
        uint256 orderId = settlementBridge.buyITPFromSettlement(itpId, 250e6, 3e18, 0, deadline);

        TypesLib.CrossChainOrder memory order = settlementBridge.getCrossChainOrder(orderId);

        assertEq(order.itpId, itpId);
        assertEq(order.user, user1);
        assertEq(order.amount, 250e18); // Stored as 18 decimals internally
        assertEq(order.limitPrice, 3e18);
        assertEq(order.deadline, deadline);
        assertEq(order.createdAt, block.timestamp);
    }

    // Task 3.2: currentOrderId increments properly
    function test_currentOrderId_increments() public {
        vm.chainId(SETTLEMENT_CHAIN_ID);
        uint256 deadline = block.timestamp + 1 hours;

        assertEq(settlementBridge.currentOrderId(), 0, "Starts at 0");

        // Story 7-6b: Use 6-decimal USDC for Settlement buys
        vm.prank(user1);
        settlementBridge.buyITPFromSettlement(itpId, 10e6, 1e18, 0, deadline);
        assertEq(settlementBridge.currentOrderId(), 1, "After 1st order");

        vm.prank(user2);
        settlementBridge.buyITPFromSettlement(itpId, 20e6, 1e18, 1, deadline);
        assertEq(settlementBridge.currentOrderId(), 2, "After 2nd order");
    }

    // Task 3.3: Event data matches stored order data
    function test_event_data_matches_stored_order() public {
        uint256 deadline = block.timestamp + 1 hours;
        // Story 7-6b: User provides 6-decimal USDC, event/stored uses 18-decimal
        uint256 amount6Dec = 75e6;
        uint256 amount18Dec = 75e18;

        vm.chainId(SETTLEMENT_CHAIN_ID);

        vm.recordLogs();

        vm.prank(user1);
        uint256 orderId = settlementBridge.buyITPFromSettlement(itpId, amount6Dec, 1e18, 1, deadline);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Find CrossChainOrderCreated event
        // Signature: CrossChainOrderCreated(uint256 indexed, bytes32 indexed, address indexed, uint256)
        bytes32 eventSig = keccak256("CrossChainOrderCreated(uint256,bytes32,address,uint256)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length >= 4 && logs[i].topics[0] == eventSig) {
                // topics[1] = indexed orderId
                uint256 eventOrderId = uint256(logs[i].topics[1]);
                // topics[2] = indexed itpId
                bytes32 eventItpId = logs[i].topics[2];
                // topics[3] = indexed user
                address eventUser = address(uint160(uint256(logs[i].topics[3])));
                // data = (uint256 amount) — only non-indexed field (18-decimal internal)
                uint256 eventAmount = abi.decode(logs[i].data, (uint256));

                // Compare with stored order
                TypesLib.CrossChainOrder memory stored = settlementBridge.getCrossChainOrder(orderId);

                assertEq(eventOrderId, orderId, "Event orderId matches");
                assertEq(eventItpId, stored.itpId, "Event itpId matches stored");
                assertEq(eventUser, stored.user, "Event user matches stored");
                assertEq(eventAmount, stored.amount, "Event amount matches stored");
                assertEq(eventAmount, amount18Dec, "Event amount is 18 decimals");

                found = true;
                break;
            }
        }
        assertTrue(found, "CrossChainOrderCreated event must be emitted");
    }

    // ============ 8-STEP BRIDGE BUY FLOW ============

    /// @notice Full 8-step cross-chain buy flow exercising all bridge contracts
    /// Steps: 1) Lock USDC on Settlement → 2) Submit on L3 → 3) Batch + RecordCollateralMove
    ///        → 4) Bridge L3→Settlement → 5) Custody→Vault → 6) AP Trades (simulated)
    ///        → 7) ConfirmFills → 8) MintBridgedShares
    function test_e2e_8step_bridge_buy_happy_path() public {
        uint256 orderAmount6Dec = 100e6;
        uint256 orderAmount18Dec = 100e18;
        uint256 limitPrice = 1e18;

        // --- Deploy additional 8-step contracts ---

        // CollateralRegistry (on L3) — needs aggregated pubkey for BLS verification
        CollateralRegistry colReg = new CollateralRegistry(admin, address(mockRegistry));

        // L3BridgeCustody (on L3)
        L3BridgeCustody l3BridgeImpl = new L3BridgeCustody();
        ERC1967Proxy l3BridgeProxy = new ERC1967Proxy(
            address(l3BridgeImpl),
            abi.encodeCall(L3BridgeCustody.initialize, (address(mockRegistry), address(l3Usdc)))
        );
        L3BridgeCustody l3Bridge = L3BridgeCustody(address(l3BridgeProxy));

        // BLSCustody (simulates Settlement custody wallet)
        BLSCustody blsCustodyImpl = new BLSCustody();
        ERC1967Proxy blsCustodyProxy = new ERC1967Proxy(
            address(blsCustodyImpl),
            abi.encodeCall(BLSCustody.initialize, (address(mockRegistry)))
        );
        BLSCustody blsCustody = BLSCustody(address(blsCustodyProxy));

        // MockBitgetVault (destination for AP trades)
        MockBitgetVault vault = new MockBitgetVault();

        // Whitelist settlementUsdc in BLSCustody (requires propose + timelock + activate)
        blsCustody.proposeWhitelist(address(settlementUsdc), _signProposeWhitelist(address(blsCustody), address(settlementUsdc)), 3, 7);
        vm.warp(block.timestamp + 2 days + 1);
        blsCustody.activateWhitelist(address(settlementUsdc));

        // BridgeProxy + BridgedItpFactory (on Settlement)
        BridgeProxy bpImpl = new BridgeProxy();
        ERC1967Proxy bpProxy = new ERC1967Proxy(
            address(bpImpl),
            abi.encodeCall(BridgeProxy.initialize, (address(mockRegistry), address(0), admin))
        );
        BridgeProxy bridgeProx = BridgeProxy(address(bpProxy));
        BridgedItpFactory factory = new BridgedItpFactory(address(bridgeProx));
        bridgeProx.setBridgedItpFactory(address(factory));
        bridgeProx.setIndexContract(address(index));

        // Create BridgedITP via full requestCreate + completeCreate flow
        // First, request creation (sets pending creation at nonce 0)
        address[] memory bAssets = new address[](1);
        uint256[] memory bWeights = new uint256[](1);
        {
            bAssets[0] = address(l3Usdc);
            bWeights[0] = 1e18;
            uint256[] memory bPrices = new uint256[](1);
            bPrices[0] = INITIAL_PRICE;
            bridgeProx.requestCreateItp("Bridged XChain", "bXCHAIN", bWeights, bAssets, bPrices, IBridgeProxy.ItpMetadata("", "", ""));
        }
        // Complete creation with real BLS sig
        address bridgedItpAddr = bridgeProx.completeCreateItp(
            0, itpId,
            _signCompleteCreateItp(address(bridgeProx), admin, 0, bWeights, bAssets)
        , 3, 7);

        // Set deadline after all warps (whitelist timelock advanced block.timestamp)
        uint256 deadline = block.timestamp + 1 hours;

        // ====== STEP 1: User locks USDC on Settlement ======
        vm.chainId(SETTLEMENT_CHAIN_ID);
        vm.prank(user1);
        uint256 settlementOrderId = settlementBridge.buyITPFromSettlement(itpId, orderAmount6Dec, limitPrice, 1, deadline);
        assertEq(settlementOrderId, 0);
        assertEq(settlementUsdc.balanceOf(address(settlementBridge)), orderAmount6Dec);

        // ====== STEP 2: Oracle submits order on L3 ======
        vm.chainId(L3_CHAIN_ID);
        l3Usdc.mint(user1, orderAmount18Dec);
        vm.prank(user1);
        l3Usdc.approve(address(index), type(uint256).max);
        uint256 l3OrderId = _submitOrderOnL3AsUser(user1, orderAmount18Dec, limitPrice, 1);

        // ====== STEP 3a: Confirm batch ======
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = l3OrderId;
        _confirmBatch(1, orderIds);

        // ====== STEP 3b: Record collateral move (L3→Settlement for BUY) ======
        // Seed initial L3 collateral (simulates ITP creation deposited collateral on L3)
        // CollateralRegistry _nonce starts at 0 and auto-increments on each call
        colReg.recordCollateralMove(
            itpId, 0, L3_CHAIN_ID, orderAmount18Dec, TypesLib.TxType.BUY,
            _signRecordCollateralMove(address(colReg), itpId, 0, L3_CHAIN_ID, orderAmount18Dec, TypesLib.TxType.BUY, 0)
        , 3, 7);
        assertEq(colReg.getITPCollateralByChain(itpId, L3_CHAIN_ID), orderAmount18Dec, "L3 seeded");

        // Now record the actual L3→Settlement move (nonce 1)
        colReg.recordCollateralMove(
            itpId, L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, orderAmount18Dec, TypesLib.TxType.BUY,
            _signRecordCollateralMove(address(colReg), itpId, L3_CHAIN_ID, SETTLEMENT_CHAIN_ID, orderAmount18Dec, TypesLib.TxType.BUY, 1)
        , 3, 7);

        assertEq(colReg.getITPCollateralByChain(itpId, L3_CHAIN_ID), 0, "L3 collateral moved out");
        assertEq(colReg.getITPCollateralByChain(itpId, SETTLEMENT_CHAIN_ID), orderAmount18Dec, "Settlement collateral received");

        // ====== STEP 4: Bridge L3→Settlement (simulated: mint L3Usdc to L3BridgeCustody, then release on Settlement side) ======
        // In production, L3BridgeCustody.initiateBridge locks USDC on L3,
        // and SettlementBridgeCustody.completeBridge releases on Settlement.
        // For this E2E we simulate by funding BLSCustody directly.
        l3Usdc.mint(address(l3Bridge), orderAmount18Dec); // Simulate L3 custody holds USDC

        // Simulate Settlement side: fund BLSCustody with 6-dec USDC
        settlementUsdc.mint(address(blsCustody), orderAmount6Dec);

        // ====== STEP 5: BLSCustody transfers USDC to MockBitgetVault ======
        // Build the ERC20.transfer(vault, amount) calldata
        bytes memory transferCalldata = abi.encodeWithSelector(
            IERC20.transfer.selector,
            address(vault),
            orderAmount6Dec
        );
        blsCustody.execute(address(settlementUsdc), transferCalldata, _signExecute(address(blsCustody), address(settlementUsdc), transferCalldata, 0), 0, 3, 7);
        assertEq(settlementUsdc.balanceOf(address(vault)), orderAmount6Dec, "Vault should hold USDC");
        assertEq(settlementUsdc.balanceOf(address(blsCustody)), 0, "BLSCustody should be empty");

        // ====== STEP 6: AP trades (simulated — vault swaps USDC for underlying) ======
        // In production, the vault executes trades. In E2E, the USDC is already in vault.
        // No on-chain call needed for simulation.

        // ====== STEP 7: Confirm fills on L3 ======
        vm.chainId(L3_CHAIN_ID);
        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: l3OrderId,
            fillPrice: limitPrice,
            fillAmount: orderAmount18Dec,
            cycleNumber: 1,
            txHash: bytes32(uint256(0xdead))
        });
        _confirmFills(1, fills);

        // Verify ITP minted on L3
        uint256 expectedShares = (orderAmount18Dec * 1e18) / limitPrice;
        assertEq(itpVault.balanceOf(user1), expectedShares, "User should have L3 ITP");

        // ====== STEP 8: Mint BridgedITP shares on Settlement ======
        bridgeProx.mintBridgedShares(itpId, user1, expectedShares, settlementOrderId, _signMintBridgedShares(address(bridgeProx), itpId, user1, expectedShares, settlementOrderId), 3, 7);

        // Verify BridgedITP minted
        assertGt(IERC20(bridgedItpAddr).balanceOf(user1), 0, "User should have BridgedITP on Settlement");
        assertEq(IERC20(bridgedItpAddr).balanceOf(user1), expectedShares, "BridgedITP amount matches shares");
    }
}
