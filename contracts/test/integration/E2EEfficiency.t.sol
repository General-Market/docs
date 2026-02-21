// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/core/Investment.sol";
import "../../src/core/ITP.sol";
import "../../src/mocks/MockERC20.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import "../../src/registry/IssuerRegistry.sol";
import "../../src/registry/FeeRegistry.sol";
import "../../src/interfaces/IFeeRegistry.sol";
import "../../src/libraries/TypesLib.sol";
import "../../src/libraries/ErrorsLib.sol";
import "../../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title E2EEfficiency - Per-Asset Spread Decomposition & Fee Recording Tests
/// @notice Models the full issuer pipeline: per-asset bid/ask from Bitget spreads, NAV from
///         on-chain inventory quantities, FeeRegistry integration, self-funded pool (no usdc.mint hacks).
/// @dev Real BLS signatures via FFI (bls-tool). Every intermediate balance is asserted.
contract E2EEfficiencyTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;
    ITP public itpVault;
    FeeRegistry public feeRegistry;
    address public feeRegistryProxy;
    IssuerRegistry public issuerRegistry;

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public user4 = makeAddr("user4");
    address public user5 = makeAddr("user5");
    address public admin;

    bytes32 public itpId;

    uint256 constant BTC_PRICE = 50_000e18;
    uint256 constant ETH_PRICE = 3_000e18;
    uint256 constant SOL_PRICE = 100e18;
    uint256 constant AVAX_PRICE = 50e18;
    uint256 constant LINK_PRICE = 20e18;

    uint256 constant INITIAL_USDC = 1_000_000e18;

    uint256 constant DECI_BPS_BASE = 100_000;

    // Per-asset Bitget spreads in deci-bps (from creation-spreads.json)
    // BTC=0, ETH=1, SOL=12, AVAX=108, LINK=35
    uint256[5] internal SPREADS = [uint256(0), 1, 12, 108, 35];

    uint256 internal _cycleCounter = 1;

    function setUp() public {
        admin = address(this);

        usdc = new MockERC20("USDC", "USDC", 18);
        governance = deployGovernance(admin);

        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        index = Investment(address(proxy));

        issuerRegistry = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(issuerRegistry, admin);
        index.setIssuerRegistry(address(issuerRegistry));

        // Deploy FeeRegistry UUPS proxy
        FeeRegistry feeRegistryImpl = new FeeRegistry();
        ERC1967Proxy feeProxy = new ERC1967Proxy(
            address(feeRegistryImpl),
            abi.encodeWithSelector(FeeRegistry.initialize.selector, admin)
        );
        feeRegistryProxy = address(feeProxy);
        feeRegistry = FeeRegistry(feeRegistryProxy);

        // Wire FeeRegistry: set IssuerRegistry for BLS, authorize test contract + index
        feeRegistry.setIssuerRegistry(address(issuerRegistry));
        feeRegistry.setAuthorizedCaller(address(this), true);
        feeRegistry.setAuthorizedCaller(address(index), true);

        // Wire FeeRegistry into Investment
        index.setFeeRegistry(feeRegistryProxy);

        // 5-asset ITP: BTC 30%, ETH 25%, SOL 20%, AVAX 15%, LINK 10%
        address[] memory assets = new address[](5);
        assets[0] = makeAddr("BTC");
        assets[1] = makeAddr("ETH");
        assets[2] = makeAddr("SOL");
        assets[3] = makeAddr("AVAX");
        assets[4] = makeAddr("LINK");

        uint256[] memory weights = new uint256[](5);
        weights[0] = 3e17;
        weights[1] = 25e16;
        weights[2] = 2e17;
        weights[3] = 15e16;
        weights[4] = 1e17;

        uint256[] memory prices = new uint256[](5);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;
        prices[2] = SOL_PRICE;
        prices[3] = AVAX_PRICE;
        prices[4] = LINK_PRICE;

        itpId = index.createITP("Efficiency Test", "EFFT", weights, assets, prices, type(uint256).max);
        itpVault = new ITP(itpId, address(index), "Efficiency Test Token", "EFFT", IERC20(address(usdc)));
        index.setITPVault(itpId, address(itpVault));

        // Set fee rate 50 bps for the ITP
        {
            uint256 nonce = feeRegistry.getNonce();
            bytes32 msg_ = keccak256(abi.encode(block.chainid, feeRegistryProxy, "setFeeRate", itpId, uint256(50), nonce));
            feeRegistry.setFeeRate(itpId, 50, signWithTestIssuers(msg_));
        }

        // Verify inventory qty formula: qty[i] = (weight[i] * 1e18) / price[i]
        (,,,,, uint256[] memory inv) = index.getITPState(itpId);
        assertEq(inv.length, 5, "5 inventory slots");
        for (uint256 i = 0; i < 5; i++) {
            uint256 expectedQty = (weights[i] * 1e18) / prices[i];
            assertEq(inv[i], expectedQty, "inventory qty matches formula");
        }

        // Fund users
        address[5] memory users = [user1, user2, user3, user4, user5];
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], INITIAL_USDC);
            vm.prank(users[i]);
            usdc.approve(address(index), type(uint256).max);
        }
    }

    // ============ SIGNING HELPERS ============

    function _signBatch(uint256 c, uint256[] memory ids) internal returns (bytes memory) {
        return signWithTestIssuers(keccak256(abi.encode(block.chainid, address(index), c, ids)));
    }

    function _signFills(uint256 c, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        return signWithTestIssuers(keccak256(abi.encode(block.chainid, address(index), c, fills)));
    }

    function _signNav(bytes32 id, uint256 nav) internal returns (bytes memory) {
        return signWithTestIssuers(keccak256(abi.encode(block.chainid, address(index), "setItpNav", id, nav)));
    }

    function _signRebal(
        bytes32 id,
        uint256[] memory rm,
        address[] memory add_,
        uint256[] memory w,
        uint256[] memory p,
        address[] memory qt
    ) internal returns (bytes memory) {
        return signWithTestIssuers(keccak256(abi.encode(block.chainid, address(index), "rebalance", id, rm, add_, w, p, qt)));
    }

    // ============ NAV COMPUTATION HELPERS ============

    /// @dev Compute midNAV from inventory + prices (replicates issuer's calculate_nav)
    function _computeMidNav(uint256[] memory prices) internal view returns (uint256 nav) {
        (,,,,, uint256[] memory inventory) = index.getITPState(itpId);
        for (uint256 i = 0; i < inventory.length; i++) {
            nav += (inventory[i] * prices[i]) / 1e18;
        }
    }

    /// @dev Compute askNAV — per-asset decomposition with individual spreads
    function _computeAskNav(uint256[] memory prices, uint256[] memory spreads) internal view returns (uint256 nav) {
        (,,,,, uint256[] memory inventory) = index.getITPState(itpId);
        for (uint256 i = 0; i < inventory.length; i++) {
            uint256 askPx = prices[i] * (DECI_BPS_BASE + spreads[i]) / DECI_BPS_BASE;
            nav += (inventory[i] * askPx) / 1e18;
        }
    }

    /// @dev Compute bidNAV — per-asset decomposition with individual spreads
    function _computeBidNav(uint256[] memory prices, uint256[] memory spreads) internal view returns (uint256 nav) {
        (,,,,, uint256[] memory inventory) = index.getITPState(itpId);
        for (uint256 i = 0; i < inventory.length; i++) {
            uint256 bidPx = prices[i] * (DECI_BPS_BASE - spreads[i]) / DECI_BPS_BASE;
            nav += (inventory[i] * bidPx) / 1e18;
        }
    }

    /// @dev Convert fixed-size SPREADS to dynamic array
    function _spreadsArray() internal view returns (uint256[] memory s) {
        s = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) s[i] = SPREADS[i];
    }

    /// @dev Build initial prices array
    function _initialPrices() internal pure returns (uint256[] memory p) {
        p = new uint256[](5);
        p[0] = BTC_PRICE; p[1] = ETH_PRICE; p[2] = SOL_PRICE; p[3] = AVAX_PRICE; p[4] = LINK_PRICE;
    }

    // ============ FEE RECORDING HELPER ============

    /// @dev Record trading fee in FeeRegistry with BLS
    function _recordFee(address user, uint256 feeAmt) internal {
        uint256 nonce = feeRegistry.getNonce();
        bytes32 message = keccak256(abi.encode(
            block.chainid, feeRegistryProxy, "recordFeeCharge",
            user, itpId, feeAmt, TypesLib.FeeType.TRADING, nonce
        ));
        feeRegistry.recordFeeCharge(
            user, itpId, feeAmt, TypesLib.FeeType.TRADING, signWithTestIssuers(message)
        );
    }

    // ============ FLOW HELPERS ============

    function _nextCycle() internal returns (uint256) {
        return _cycleCounter++;
    }

    /// @dev Set NAV from prices using inventory-based computation, push via setItpNav with BLS
    function _setNavFromPrices(uint256[] memory prices) internal returns (uint256 midNAV) {
        midNAV = _computeMidNav(prices);
        index.setItpNav(itpId, midNAV, _signNav(itpId, midNAV));
    }

    /// @dev Buy flow at specific fill price. Returns (orderId, sharesReceived).
    function _buy(address user, uint256 usdcAmt, uint256 fillPrice) internal returns (uint256 orderId, uint256 shares) {
        vm.prank(user);
        orderId = index.submitOrder(itpId, TypesLib.Side.BUY, usdcAmt, 0, 2, block.timestamp + 1 hours);

        uint256 c = _nextCycle();
        uint256[] memory ids = new uint256[](1);
        ids[0] = orderId;
        index.confirmBatch(c, ids, _signBatch(c, ids));

        TypesLib.Fill[] memory f = new TypesLib.Fill[](1);
        f[0] = TypesLib.Fill(orderId, fillPrice, usdcAmt, c, bytes32(0));
        index.confirmFills(c, f, _signFills(c, f));

        shares = (usdcAmt * 1e18) / fillPrice;
    }

    /// @dev Sell flow at specific fill price. Returns (orderId, usdcReceived).
    function _sell(address user, uint256 shareAmt, uint256 fillPrice) internal returns (uint256 orderId, uint256 usdcOut) {
        vm.prank(user);
        orderId = index.submitOrder(itpId, TypesLib.Side.SELL, shareAmt, 0, 2, block.timestamp + 1 hours);

        uint256 c = _nextCycle();
        uint256[] memory ids = new uint256[](1);
        ids[0] = orderId;
        index.confirmBatch(c, ids, _signBatch(c, ids));

        TypesLib.Fill[] memory f = new TypesLib.Fill[](1);
        f[0] = TypesLib.Fill(orderId, fillPrice, shareAmt, c, bytes32(0));
        index.confirmFills(c, f, _signFills(c, f));

        usdcOut = (shareAmt * fillPrice) / 1e18;
    }

    /// @dev Batch and fill N orders in one cycle.
    function _batchAndFill(
        uint256[] memory orderIds,
        uint256[] memory fillPrices,
        uint256[] memory fillAmounts
    ) internal returns (uint256 cycle) {
        cycle = _nextCycle();
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](orderIds.length);
        for (uint256 i = 0; i < orderIds.length; i++) {
            fills[i] = TypesLib.Fill(orderIds[i], fillPrices[i], fillAmounts[i], cycle, bytes32(0));
        }
        index.confirmFills(cycle, fills, _signFills(cycle, fills));
    }

    // ============ SNAPSHOT HELPERS ============

    struct Snap {
        uint256 u1Shares;
        uint256 u2Shares;
        uint256 u3Shares;
        uint256 u4Shares;
        uint256 u5Shares;
        uint256 u1Usdc;
        uint256 u2Usdc;
        uint256 u3Usdc;
        uint256 u4Usdc;
        uint256 u5Usdc;
        uint256 indexUsdc;
        uint256 totalSupply;
        uint256 totalValue;
        uint256 nav;
    }

    function _snap() internal view returns (Snap memory s) {
        s.u1Shares = index.getUserShares(itpId, user1);
        s.u2Shares = index.getUserShares(itpId, user2);
        s.u3Shares = index.getUserShares(itpId, user3);
        s.u4Shares = index.getUserShares(itpId, user4);
        s.u5Shares = index.getUserShares(itpId, user5);
        s.u1Usdc = usdc.balanceOf(user1);
        s.u2Usdc = usdc.balanceOf(user2);
        s.u3Usdc = usdc.balanceOf(user3);
        s.u4Usdc = usdc.balanceOf(user4);
        s.u5Usdc = usdc.balanceOf(user5);
        s.indexUsdc = usdc.balanceOf(address(index));
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        s.totalSupply = itp.totalSupply;
        s.totalValue = itp.totalValue;
        s.nav = index.getNAV(itpId);
    }

    function _totalUsdc(Snap memory s) internal pure returns (uint256) {
        return s.u1Usdc + s.u2Usdc + s.u3Usdc + s.u4Usdc + s.u5Usdc + s.indexUsdc;
    }

    function _totalShares(Snap memory s) internal pure returns (uint256) {
        return s.u1Shares + s.u2Shares + s.u3Shares + s.u4Shares + s.u5Shares;
    }

    // ============ TEST 1: Concurrent Buys & Sells — Per-Asset Spread Decomposition ============

    /// @notice 3 buys + 2 sells in one batch. Buys at askNAV, sells at bidNAV.
    ///         Self-funded pool (no usdc.mint to index). FeeRegistry records spread fees.
    function test_concurrentBuysAndSells_fairDistribution() public {
        uint256[] memory prices = _initialPrices();
        uint256[] memory spreads = _spreadsArray();

        // Compute initial NAVs from inventory
        uint256 midNAV = _computeMidNav(prices);
        uint256 askNAV = _computeAskNav(prices, spreads);
        uint256 bidNAV = _computeBidNav(prices, spreads);

        // Verify decomposition ordering
        assertTrue(askNAV > midNAV, "askNAV > midNAV");
        assertTrue(midNAV > bidNAV, "midNAV > bidNAV");

        emit log_named_uint("initial midNAV", midNAV);
        emit log_named_uint("initial askNAV", askNAV);
        emit log_named_uint("initial bidNAV", bidNAV);
        emit log_named_uint("ask-mid spread (wei)", askNAV - midNAV);
        emit log_named_uint("mid-bid spread (wei)", midNAV - bidNAV);

        // Seed sellers with shares at askNAV (deposits USDC into pool)
        index.setItpNav(itpId, askNAV, _signNav(itpId, askNAV));
        _buy(user4, 5_000e18, askNAV);
        _buy(user5, 5_000e18, askNAV);

        // Now set NAV to midNAV for the actual test
        // Prices move to ugly numbers
        prices[0] = 51_337e18;  // BTC
        prices[1] = 3_177e18;   // ETH
        prices[2] = 107e18;     // SOL
        prices[3] = 53e18;      // AVAX
        prices[4] = 21e18;      // LINK

        midNAV = _setNavFromPrices(prices);
        askNAV = _computeAskNav(prices, spreads);
        bidNAV = _computeBidNav(prices, spreads);

        assertTrue(askNAV > midNAV, "askNAV > midNAV at ugly prices");
        assertTrue(midNAV > bidNAV, "midNAV > bidNAV at ugly prices");

        // Log per-asset spread contributions
        {
            (,,,,, uint256[] memory inv) = index.getITPState(itpId);
            for (uint256 i = 0; i < 5; i++) {
                uint256 spreadContrib = (inv[i] * prices[i] * SPREADS[i]) / (DECI_BPS_BASE * 1e18);
                emit log_named_uint(string(abi.encodePacked("asset[", vm.toString(i), "] spread contrib (wei)")), spreadContrib);
            }
        }

        Snap memory pre = _snap();

        // ---- Submit 5 orders ----
        uint256 buy1Amt = 1_337e18;
        uint256 buy2Amt = 2_719e18;
        uint256 buy3Amt = 4_501e18;
        uint256 sell4Amt = 1_111e18; // shares
        uint256 sell5Amt = 2_777e18;

        vm.prank(user1);
        uint256 oid1 = index.submitOrder(itpId, TypesLib.Side.BUY, buy1Amt, askNAV + 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user2);
        uint256 oid2 = index.submitOrder(itpId, TypesLib.Side.BUY, buy2Amt, askNAV + 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user3);
        uint256 oid3 = index.submitOrder(itpId, TypesLib.Side.BUY, buy3Amt, askNAV + 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user4);
        uint256 oid4 = index.submitOrder(itpId, TypesLib.Side.SELL, sell4Amt, bidNAV - 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user5);
        uint256 oid5 = index.submitOrder(itpId, TypesLib.Side.SELL, sell5Amt, bidNAV - 0.1e18, 2, block.timestamp + 1 hours);

        // Check intermediate: USDC moved from buyers to index, shares escrowed from sellers
        assertEq(usdc.balanceOf(user1), pre.u1Usdc - buy1Amt, "u1 USDC debited on submit");
        assertEq(usdc.balanceOf(user2), pre.u2Usdc - buy2Amt, "u2 USDC debited on submit");
        assertEq(usdc.balanceOf(user3), pre.u3Usdc - buy3Amt, "u3 USDC debited on submit");
        assertEq(index.getUserShares(itpId, user4), pre.u4Shares - sell4Amt, "u4 shares escrowed on submit");
        assertEq(index.getUserShares(itpId, user5), pre.u5Shares - sell5Amt, "u5 shares escrowed on submit");

        // ---- Batch and fill: buys at askNAV, sells at bidNAV ----
        uint256[] memory oids = new uint256[](5);
        oids[0] = oid1; oids[1] = oid2; oids[2] = oid3; oids[3] = oid4; oids[4] = oid5;
        uint256[] memory fps = new uint256[](5);
        fps[0] = askNAV; fps[1] = askNAV; fps[2] = askNAV; fps[3] = bidNAV; fps[4] = bidNAV;
        uint256[] memory fas = new uint256[](5);
        fas[0] = buy1Amt; fas[1] = buy2Amt; fas[2] = buy3Amt; fas[3] = sell4Amt; fas[4] = sell5Amt;

        _batchAndFill(oids, fps, fas);

        Snap memory post = _snap();

        // ---- Exact share computation per buyer ----
        uint256 exp1Shares = (buy1Amt * 1e18) / askNAV;
        uint256 exp2Shares = (buy2Amt * 1e18) / askNAV;
        uint256 exp3Shares = (buy3Amt * 1e18) / askNAV;

        // Rounding favors protocol
        assertTrue(exp1Shares * askNAV <= buy1Amt * 1e18, "u1 rounding favors protocol");
        assertTrue(exp2Shares * askNAV <= buy2Amt * 1e18, "u2 rounding favors protocol");
        assertTrue(exp3Shares * askNAV <= buy3Amt * 1e18, "u3 rounding favors protocol");

        // Dust < 1 share-unit
        assertTrue(buy1Amt * 1e18 - exp1Shares * askNAV < askNAV, "u1 dust < 1 share-unit");
        assertTrue(buy2Amt * 1e18 - exp2Shares * askNAV < askNAV, "u2 dust < 1 share-unit");
        assertTrue(buy3Amt * 1e18 - exp3Shares * askNAV < askNAV, "u3 dust < 1 share-unit");

        assertEq(post.u1Shares, pre.u1Shares + exp1Shares, "u1 exact shares");
        assertEq(post.u2Shares, pre.u2Shares + exp2Shares, "u2 exact shares");
        assertEq(post.u3Shares, pre.u3Shares + exp3Shares, "u3 exact shares");

        // ---- Exact USDC computation per seller ----
        uint256 sell4Payout = (sell4Amt * bidNAV) / 1e18;
        uint256 sell5Payout = (sell5Amt * bidNAV) / 1e18;
        assertEq(post.u4Usdc, pre.u4Usdc + sell4Payout, "u4 exact USDC from sell");
        assertEq(post.u5Usdc, pre.u5Usdc + sell5Payout, "u5 exact USDC from sell");

        // Sell rounding favors protocol
        assertTrue(sell4Payout * 1e18 <= sell4Amt * bidNAV, "u4 sell rounding favors protocol");
        assertTrue(sell5Payout * 1e18 <= sell5Amt * bidNAV, "u5 sell rounding favors protocol");

        // ---- Spread fee computation ----
        // Buy spread fee = usdcAmount - (sharesMinted * midNAV) / 1e18
        uint256 buy1Fee = buy1Amt - (exp1Shares * midNAV) / 1e18;
        uint256 buy2Fee = buy2Amt - (exp2Shares * midNAV) / 1e18;
        uint256 buy3Fee = buy3Amt - (exp3Shares * midNAV) / 1e18;

        // Sell spread fee = (sharesBurned * midNAV) / 1e18 - payout
        uint256 sell4Fee = (sell4Amt * midNAV) / 1e18 - sell4Payout;
        uint256 sell5Fee = (sell5Amt * midNAV) / 1e18 - sell5Payout;

        emit log_named_uint("buy1 spread fee", buy1Fee);
        emit log_named_uint("buy2 spread fee", buy2Fee);
        emit log_named_uint("buy3 spread fee", buy3Fee);
        emit log_named_uint("sell4 spread fee", sell4Fee);
        emit log_named_uint("sell5 spread fee", sell5Fee);

        // ---- Record fees in FeeRegistry ----
        uint256 totalSpreadFees = buy1Fee + buy2Fee + buy3Fee + sell4Fee + sell5Fee;
        _recordFee(user1, buy1Fee);
        _recordFee(user2, buy2Fee);
        _recordFee(user3, buy3Fee);
        _recordFee(user4, sell4Fee);
        _recordFee(user5, sell5Fee);

        // Assert FeeRegistry totals
        (uint256 tradingFees,,,) = feeRegistry.getAccumulatedFees(itpId);
        assertEq(tradingFees, totalSpreadFees, "FeeRegistry trading == sum of all spread fees");

        // ---- Proportional fairness ----
        uint256 cross12a = exp1Shares * buy2Amt;
        uint256 cross12b = exp2Shares * buy1Amt;
        uint256 cross12diff = cross12a > cross12b ? cross12a - cross12b : cross12b - cross12a;
        assertTrue(cross12diff <= buy2Amt, "u1/u2 proportional within 1 share rounding");

        uint256 cross13a = exp1Shares * buy3Amt;
        uint256 cross13b = exp3Shares * buy1Amt;
        uint256 cross13diff = cross13a > cross13b ? cross13a - cross13b : cross13b - cross13a;
        assertTrue(cross13diff <= buy3Amt, "u1/u3 proportional within 1 share rounding");

        uint256 crossS45a = sell4Payout * sell5Amt;
        uint256 crossS45b = sell5Payout * sell4Amt;
        uint256 crossS45diff = crossS45a > crossS45b ? crossS45a - crossS45b : crossS45b - crossS45a;
        assertTrue(crossS45diff <= sell5Amt, "u4/u5 sell proportional within 1 USDC rounding");

        // ---- ITP state ----
        uint256 expectedSupply = pre.totalSupply + exp1Shares + exp2Shares + exp3Shares - sell4Amt - sell5Amt;
        assertEq(post.totalSupply, expectedSupply, "totalSupply = pre + minted - burned");

        uint256 expectedValue = pre.totalValue + buy1Amt + buy2Amt + buy3Amt - sell4Payout - sell5Payout;
        assertEq(post.totalValue, expectedValue, "totalValue = pre + buys - sell payouts");

        // ---- USDC conservation (closed system after seeds) ----
        assertEq(_totalUsdc(post), _totalUsdc(pre), "USDC conserved (no external mints)");
    }

    // ============ TEST 2: Rebalance Between Buy and Sell — No Value Leakage ============

    /// @notice Buy → prices move → rebalance (remove+add asset) → new buyer provides liquidity → sell.
    ///         Per-asset decomposition throughout. Profit/loss accounting with spread costs.
    function test_rebalanceBetweenBuyAndSell_noValueLeakage() public {
        uint256[] memory prices1 = _initialPrices();
        uint256[] memory spreads = _spreadsArray();

        // Initial NAVs from inventory
        uint256 midNAV1 = _setNavFromPrices(prices1);
        uint256 askNAV1 = _computeAskNav(prices1, spreads);

        Snap memory s0 = _snap();

        // ---- User1 buys at askNAV1 ----
        uint256 buyAmt = 7_777e18;
        (, uint256 buyShares) = _buy(user1, buyAmt, askNAV1);

        Snap memory s1 = _snap();

        uint256 expShares = (buyAmt * 1e18) / askNAV1;
        assertEq(buyShares, expShares, "buyShares matches formula");
        assertEq(s1.u1Shares, s0.u1Shares + expShares, "u1 shares exact after buy");
        assertEq(s1.u1Usdc, s0.u1Usdc - buyAmt, "u1 USDC debited exactly");
        assertEq(s1.indexUsdc, s0.indexUsdc + buyAmt, "index received exact USDC");

        // Record buy spread fee
        uint256 buySpreadFee = buyAmt - (expShares * midNAV1) / 1e18;
        _recordFee(user1, buySpreadFee);
        emit log_named_uint("buy spread fee", buySpreadFee);

        // ---- Prices move up ~9% ----
        uint256[] memory prices2 = new uint256[](5);
        prices2[0] = 54_500e18;   // BTC +9%
        prices2[1] = 3_270e18;    // ETH +9%
        prices2[2] = 109e18;      // SOL +9%
        prices2[3] = 54_500000000000000000; // AVAX 54.5
        prices2[4] = 21_800000000000000000; // LINK 21.8

        uint256 midNAV2 = _setNavFromPrices(prices2);
        assertTrue(midNAV2 > midNAV1, "NAV increased after price move");
        emit log_named_uint("midNAV1", midNAV1);
        emit log_named_uint("midNAV2", midNAV2);

        // ---- Rebalance: remove LINK, add DOT ----
        uint256[] memory removeIndices = new uint256[](1);
        removeIndices[0] = 4;
        address[] memory addAssets = new address[](1);
        addAssets[0] = makeAddr("DOT");

        uint256[] memory newWeights = new uint256[](5);
        newWeights[0] = 4e17;
        newWeights[1] = 25e16;
        newWeights[2] = 15e16;
        newWeights[3] = 1e17;
        newWeights[4] = 1e17; // DOT

        // Prices for final asset list (LINK removed, DOT added)
        uint256[] memory rebalPrices = new uint256[](5);
        rebalPrices[0] = prices2[0]; // BTC
        rebalPrices[1] = prices2[1]; // ETH
        rebalPrices[2] = prices2[2]; // SOL
        rebalPrices[3] = prices2[3]; // AVAX
        rebalPrices[4] = 10e18;      // DOT

        Snap memory s2Pre = _snap();

        address[] memory emptyQt = new address[](0);
        index.rebalance(itpId, removeIndices, addAssets, newWeights, rebalPrices, emptyQt,
            _signRebal(itpId, removeIndices, addAssets, newWeights, rebalPrices, emptyQt));

        Snap memory s2Post = _snap();

        // Rebalance invariants
        assertApproxEqAbs(s2Post.nav, s2Pre.nav, 1e5, "NAV preserved <=1e5 wei");
        assertEq(s2Post.totalSupply, s2Pre.totalSupply, "supply unchanged by rebalance");
        assertEq(s2Post.u1Shares, s2Pre.u1Shares, "u1 shares unchanged by rebalance");
        assertEq(s2Post.u1Usdc, s2Pre.u1Usdc, "u1 USDC unchanged by rebalance");
        assertEq(s2Post.indexUsdc, s2Pre.indexUsdc, "index USDC unchanged by rebalance");

        // Verify inventory recalculated
        (,,, address[] memory assetsAfter,,) = index.getITPState(itpId);
        assertEq(assetsAfter.length, 5, "still 5 assets after remove+add");
        assertEq(assetsAfter[4], makeAddr("DOT"), "DOT added at end");

        // ---- User2 buys to provide liquidity ----
        // After rebalance, need new prices for post-rebalance assets (DOT instead of LINK)
        uint256[] memory prices2Post = new uint256[](5);
        prices2Post[0] = prices2[0]; // BTC
        prices2Post[1] = prices2[1]; // ETH
        prices2Post[2] = prices2[2]; // SOL
        prices2Post[3] = prices2[3]; // AVAX
        prices2Post[4] = 10e18;      // DOT

        // New spreads array for post-rebalance (DOT spread = 50 deci-bps, assume)
        uint256[] memory spreads2 = new uint256[](5);
        spreads2[0] = SPREADS[0]; // BTC
        spreads2[1] = SPREADS[1]; // ETH
        spreads2[2] = SPREADS[2]; // SOL
        spreads2[3] = SPREADS[3]; // AVAX
        spreads2[4] = 50;         // DOT spread

        // Push NAV from post-rebalance inventory
        uint256 midNAV2Post = _setNavFromPrices(prices2Post);
        uint256 askNAV2 = _computeAskNav(prices2Post, spreads2);
        uint256 bidNAV2 = _computeBidNav(prices2Post, spreads2);

        (, uint256 u2Shares) = _buy(user2, 8_000e18, askNAV2);
        uint256 u2BuyFee = 8_000e18 - (u2Shares * midNAV2Post) / 1e18;
        _recordFee(user2, u2BuyFee);

        // ---- User1 sells all shares at bidNAV ----
        uint256 u1UsdcBefore = usdc.balanceOf(user1);
        (, uint256 sellPayout) = _sell(user1, expShares, bidNAV2);

        // Sell spread fee
        uint256 sellSpreadFee = (expShares * midNAV2Post) / 1e18 - sellPayout;
        _recordFee(user1, sellSpreadFee);
        emit log_named_uint("sell spread fee", sellSpreadFee);

        Snap memory s3 = _snap();

        // Verify payout
        assertEq(s3.u1Usdc, u1UsdcBefore + sellPayout, "u1 USDC after sell");
        assertEq(s3.u1Shares, 0, "u1 sold all shares");

        // Rounding direction
        assertTrue(sellPayout * 1e18 <= expShares * bidNAV2, "sell rounding favors protocol");

        // ---- Profit accounting ----
        uint256 actualProfit = sellPayout > buyAmt ? sellPayout - buyAmt : 0;
        uint256 buySpreadCost = buyAmt - (expShares * midNAV1) / 1e18;
        uint256 sellSpreadCost = (expShares * midNAV2Post) / 1e18 - sellPayout;
        // NAV appreciation part
        uint256 navAppreciation = (expShares * midNAV2Post) / 1e18 - (expShares * midNAV1) / 1e18;

        emit log_named_uint("actual profit", actualProfit);
        emit log_named_uint("buy spread cost", buySpreadCost);
        emit log_named_uint("sell spread cost", sellSpreadCost);
        emit log_named_uint("NAV appreciation (shares * delta)", navAppreciation);

        // Theoretical profit with zero spreads = buyAmt * (midNAV2/midNAV1 - 1)
        // But integer-only: (buyAmt * midNAV2Post) / midNAV1 - buyAmt
        uint256 theoreticalReturn = (buyAmt * midNAV2Post) / midNAV1;
        emit log_named_uint("theoretical return (zero-spread)", theoreticalReturn);
        emit log_named_uint("actual return", sellPayout);

        // Profit is positive (NAV went up)
        assertTrue(sellPayout > buyAmt, "user profited from NAV increase");

        // ---- FeeRegistry totals ----
        (uint256 tradingTotal,,,) = feeRegistry.getAccumulatedFees(itpId);
        assertEq(tradingTotal, buySpreadFee + u2BuyFee + sellSpreadFee, "FeeRegistry total matches all fees");

        // Fee split: deployer claimable = 70%, protocol = 30%
        uint256 deployerClaimable = feeRegistry.getClaimableFees(itpId);
        uint256 protocolClaimable = feeRegistry.getProtocolClaimableFees(itpId);
        assertEq(deployerClaimable, (tradingTotal * 7000) / 10000, "deployer gets 70%");
        assertEq(protocolClaimable, (tradingTotal * 3000) / 10000, "protocol gets 30%");
    }

    // ============ TEST 3: Mixed Operations — Value Conservation ============

    /// @notice Seed → buy+sell → rebalance → buy+sell. All with per-asset decomposition.
    ///         Closed-system USDC conservation + cumulative fee tracking.
    function test_mixedOperationsOneCycle_valueConservation() public {
        uint256[] memory prices = _initialPrices();
        uint256[] memory spreads = _spreadsArray();

        // ---- Seed at askNAV ----
        uint256 midNAV0 = _setNavFromPrices(prices);
        uint256 askNAV0 = _computeAskNav(prices, spreads);

        (, uint256 u1Shares0) = _buy(user1, 10_000e18, askNAV0);
        (, uint256 u2Shares0) = _buy(user2, 7_500e18, askNAV0);
        (, uint256 u3Shares0) = _buy(user3, 4_200e18, askNAV0);

        // Record seed spread fees
        uint256 u1SeedFee = 10_000e18 - (u1Shares0 * midNAV0) / 1e18;
        uint256 u2SeedFee = 7_500e18 - (u2Shares0 * midNAV0) / 1e18;
        uint256 u3SeedFee = 4_200e18 - (u3Shares0 * midNAV0) / 1e18;
        _recordFee(user1, u1SeedFee);
        _recordFee(user2, u2SeedFee);
        _recordFee(user3, u3SeedFee);

        Snap memory sA0 = _snap();
        uint256 closedSystemUsdc = _totalUsdc(sA0);

        // ---- STEP A: 2 buys + 1 sell ----
        uint256 bidNAV_A = _computeBidNav(prices, spreads);

        vm.prank(user4);
        uint256 oidA1 = index.submitOrder(itpId, TypesLib.Side.BUY, 3_333e18, askNAV0 + 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user5);
        uint256 oidA2 = index.submitOrder(itpId, TypesLib.Side.BUY, 1_999e18, askNAV0 + 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user1);
        uint256 oidA3 = index.submitOrder(itpId, TypesLib.Side.SELL, 2_000e18, bidNAV_A - 0.1e18, 2, block.timestamp + 1 hours);

        // Check intermediate escrowing
        assertEq(index.getUserShares(itpId, user1), u1Shares0 - 2_000e18, "u1 shares escrowed");

        uint256[] memory idsA = new uint256[](3);
        idsA[0] = oidA1; idsA[1] = oidA2; idsA[2] = oidA3;
        uint256[] memory fpA = new uint256[](3);
        fpA[0] = askNAV0; fpA[1] = askNAV0; fpA[2] = bidNAV_A;
        uint256[] memory faA = new uint256[](3);
        faA[0] = 3_333e18; faA[1] = 1_999e18; faA[2] = 2_000e18;

        _batchAndFill(idsA, fpA, faA);

        Snap memory sA1 = _snap();

        // Exact shares minted
        uint256 u4SharesA = (3_333e18 * 1e18) / askNAV0;
        uint256 u5SharesA = (1_999e18 * 1e18) / askNAV0;
        assertEq(sA1.u4Shares, u4SharesA, "u4 shares exact after step A");
        assertEq(sA1.u5Shares, u5SharesA, "u5 shares exact after step A");

        // Exact USDC to seller
        uint256 u1SellPayoutA = (2_000e18 * bidNAV_A) / 1e18;
        assertEq(sA1.u1Usdc, sA0.u1Usdc + u1SellPayoutA, "u1 USDC exact after sell A");
        assertEq(sA1.u1Shares, u1Shares0 - 2_000e18, "u1 shares after sell A");

        // Record step A spread fees
        uint256 u4BuyFeeA = 3_333e18 - (u4SharesA * midNAV0) / 1e18;
        uint256 u5BuyFeeA = 1_999e18 - (u5SharesA * midNAV0) / 1e18;
        uint256 u1SellFeeA = (2_000e18 * midNAV0) / 1e18 - u1SellPayoutA;
        _recordFee(user4, u4BuyFeeA);
        _recordFee(user5, u5BuyFeeA);
        _recordFee(user1, u1SellFeeA);

        // USDC conservation
        assertEq(_totalUsdc(sA1), closedSystemUsdc, "USDC conserved after step A");

        // ---- STEP B: Rebalance (weight-only, no add/remove) ----
        uint256[] memory emptyIdx = new uint256[](0);
        address[] memory emptyAddr = new address[](0);
        uint256[] memory wB = new uint256[](5);
        wB[0] = 35e16; wB[1] = 2e17; wB[2] = 2e17; wB[3] = 15e16; wB[4] = 1e17;

        uint256 navPreRebal = index.getNAV(itpId);
        address[] memory emptyQt2 = new address[](0);
        index.rebalance(itpId, emptyIdx, emptyAddr, wB, prices, emptyQt2,
            _signRebal(itpId, emptyIdx, emptyAddr, wB, prices, emptyQt2));

        Snap memory sB = _snap();
        assertApproxEqAbs(sB.nav, navPreRebal, 1e5, "NAV preserved by rebalance");
        assertEq(sB.totalSupply, sA1.totalSupply, "supply unchanged by rebalance");
        assertEq(_totalUsdc(sB), closedSystemUsdc, "USDC conserved through rebalance");
        assertEq(sB.u1Shares, sA1.u1Shares, "u1 shares unchanged by rebalance");
        assertEq(sB.u2Shares, sA1.u2Shares, "u2 shares unchanged by rebalance");
        assertEq(sB.u1Usdc, sA1.u1Usdc, "u1 USDC unchanged by rebalance");

        // ---- STEP C: 1 buy + 2 sells at post-rebalance NAV ----
        // Recompute NAVs with NEW inventory (quantities recalculated by rebalance)
        uint256 midNAV_C = _setNavFromPrices(prices);
        uint256 askNAV_C = _computeAskNav(prices, spreads);
        uint256 bidNAV_C = _computeBidNav(prices, spreads);

        vm.prank(user4);
        uint256 oidC1 = index.submitOrder(itpId, TypesLib.Side.BUY, 1_111e18, askNAV_C + 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user2);
        uint256 oidC2 = index.submitOrder(itpId, TypesLib.Side.SELL, 3_000e18, bidNAV_C - 0.1e18, 2, block.timestamp + 1 hours);
        vm.prank(user3);
        uint256 oidC3 = index.submitOrder(itpId, TypesLib.Side.SELL, 1_500e18, bidNAV_C - 0.1e18, 2, block.timestamp + 1 hours);

        // Check intermediate escrowing
        assertEq(index.getUserShares(itpId, user2), sB.u2Shares - 3_000e18, "u2 shares escrowed for sell C");
        assertEq(index.getUserShares(itpId, user3), sB.u3Shares - 1_500e18, "u3 shares escrowed for sell C");
        assertEq(usdc.balanceOf(user4), sB.u4Usdc - 1_111e18, "u4 USDC debited for buy C");

        uint256[] memory idsC = new uint256[](3);
        idsC[0] = oidC1; idsC[1] = oidC2; idsC[2] = oidC3;
        uint256[] memory fpC = new uint256[](3);
        fpC[0] = askNAV_C; fpC[1] = bidNAV_C; fpC[2] = bidNAV_C;
        uint256[] memory faC = new uint256[](3);
        faC[0] = 1_111e18; faC[1] = 3_000e18; faC[2] = 1_500e18;

        _batchAndFill(idsC, fpC, faC);

        Snap memory sC = _snap();

        // ---- EXACT per-user verification ----

        // u4: bought in step A at askNAV0 + step C at askNAV_C
        uint256 u4SharesC = (1_111e18 * 1e18) / askNAV_C;
        assertEq(sC.u4Shares, u4SharesA + u4SharesC, "u4 total shares from both buys");
        assertEq(sC.u4Usdc, INITIAL_USDC - 3_333e18 - 1_111e18, "u4 USDC: initial - buy_A - buy_C");

        // u5: only bought in step A
        assertEq(sC.u5Shares, u5SharesA, "u5 shares unchanged after step A");
        assertEq(sC.u5Usdc, INITIAL_USDC - 1_999e18, "u5 USDC: initial - buy_A");

        // u1: seeded, sold in step A at bidNAV_A
        assertEq(sC.u1Shares, u1Shares0 - 2_000e18, "u1 shares: seed - sold_A");
        assertEq(sC.u1Usdc, INITIAL_USDC - 10_000e18 + u1SellPayoutA, "u1 USDC: init - seed + sell_A payout");

        // u2: seeded, sold in step C at bidNAV_C
        uint256 u2SellPayoutC = (3_000e18 * bidNAV_C) / 1e18;
        assertEq(sC.u2Shares, u2Shares0 - 3_000e18, "u2 shares: seed - sold_C");
        assertEq(sC.u2Usdc, INITIAL_USDC - 7_500e18 + u2SellPayoutC, "u2 USDC: init - seed + sell_C payout");

        // u3: seeded, sold in step C at bidNAV_C
        uint256 u3SellPayoutC = (1_500e18 * bidNAV_C) / 1e18;
        assertEq(sC.u3Shares, u3Shares0 - 1_500e18, "u3 shares: seed - sold_C");
        assertEq(sC.u3Usdc, INITIAL_USDC - 4_200e18 + u3SellPayoutC, "u3 USDC: init - seed + sell_C payout");

        // ---- Record step C spread fees ----
        uint256 u4BuyFeeC = 1_111e18 - (u4SharesC * midNAV_C) / 1e18;
        uint256 u2SellFeeC = (3_000e18 * midNAV_C) / 1e18 - u2SellPayoutC;
        uint256 u3SellFeeC = (1_500e18 * midNAV_C) / 1e18 - u3SellPayoutC;
        _recordFee(user4, u4BuyFeeC);
        _recordFee(user2, u2SellFeeC);
        _recordFee(user3, u3SellFeeC);

        // ---- CONSERVATION ----
        assertEq(_totalUsdc(sC), closedSystemUsdc, "Total USDC conserved end-to-end");

        // Net share change
        uint256 sharesMinted = u1Shares0 + u2Shares0 + u3Shares0 + u4SharesA + u5SharesA + u4SharesC;
        uint256 sharesBurned = 2_000e18 + 3_000e18 + 1_500e18;
        assertEq(sC.totalSupply, sharesMinted - sharesBurned, "totalSupply = minted - burned");

        // ITP totalValue
        uint256 totalBuyUsdc = 10_000e18 + 7_500e18 + 4_200e18 + 3_333e18 + 1_999e18 + 1_111e18;
        uint256 totalSellUsdc = u1SellPayoutA + u2SellPayoutC + u3SellPayoutC;
        assertEq(sC.totalValue, totalBuyUsdc - totalSellUsdc, "totalValue = sum(buys) - sum(sell payouts)");

        // ---- FeeRegistry total = all fees from seeds + step A + step C ----
        uint256 allFees = u1SeedFee + u2SeedFee + u3SeedFee
            + u4BuyFeeA + u5BuyFeeA + u1SellFeeA
            + u4BuyFeeC + u2SellFeeC + u3SellFeeC;
        (uint256 tradingTotal,,,) = feeRegistry.getAccumulatedFees(itpId);
        assertEq(tradingTotal, allFees, "FeeRegistry total = sum of all 9 spread fees");

        // Fee split verification
        uint256 deployerClaimable = feeRegistry.getClaimableFees(itpId);
        uint256 protocolClaimable = feeRegistry.getProtocolClaimableFees(itpId);
        assertEq(deployerClaimable, (tradingTotal * 7000) / 10000, "deployer claimable = 70%");
        assertEq(protocolClaimable, (tradingTotal * 3000) / 10000, "protocol claimable = 30%");

        emit log_named_uint("closedSystemUsdc", closedSystemUsdc);
        emit log_named_uint("totalSharesFinal", _totalShares(sC));
        emit log_named_uint("totalSupply", sC.totalSupply);
        emit log_named_uint("total spread fees", allFees);
        emit log_named_uint("deployer claimable (70%)", deployerClaimable);
        emit log_named_uint("protocol claimable (30%)", protocolClaimable);
    }
}
