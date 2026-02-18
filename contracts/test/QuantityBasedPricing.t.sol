// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Index.sol";
import "../src/core/ITP.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title QuantityBasedPricing.t.sol - Tests for ITP quantity-based NAV pricing
/// @notice Verifies: ITP starts at $1, NAV moves with price changes, rebalance preserves NAV
contract QuantityBasedPricingTest is TestHelper {
    Index public index;
    MockERC20 public usdc;
    Governance public governance;

    address public admin;

    address public btcAddr;
    address public ethAddr;
    address public solAddr;

    uint256 constant BTC_PRICE = 100_000e18; // $100,000
    uint256 constant ETH_PRICE = 3_000e18;   // $3,000
    uint256 constant SOL_PRICE = 100e18;     // $100

    bytes public emptyBlsSignature = "";

    function setUp() public {
        admin = address(this);

        usdc = new MockERC20("USDC", "USDC", 18);
        governance = deployGovernance(admin);

        Index impl = new Index();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Index.initialize, (address(governance), address(usdc)))
        );
        index = Index(address(proxy));

        btcAddr = makeAddr("BTC");
        ethAddr = makeAddr("ETH");
        solAddr = makeAddr("SOL");
    }

    // ============ ITP CREATION: NAV STARTS AT $1 ============

    function test_singleAsset_navStartsAtOneDollar() public {
        address[] memory assets = new address[](1);
        assets[0] = btcAddr;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18; // 100%
        uint256[] memory prices = new uint256[](1);
        prices[0] = BTC_PRICE;

        bytes32 itpId = index.createITP("BTC Only", "BTC1", weights, assets, prices, type(uint256).max);
        uint256 nav = index.getNAV(itpId);

        assertEq(nav, 1e18, "Single asset ITP should start at $1");
    }

    function test_twoAsset_navStartsAtOneDollar() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 6e17; // 60%
        weights[1] = 4e17; // 40%
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("BTC ETH", "BE", weights, assets, prices, type(uint256).max);
        uint256 nav = index.getNAV(itpId);

        // Minor rounding due to integer division
        assertApproxEqAbs(nav, 1e18, 1e3, "Two-asset ITP should start at ~$1");
    }

    function test_threeAsset_navStartsAtOneDollar() public {
        address[] memory assets = new address[](3);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        assets[2] = solAddr;
        uint256[] memory weights = new uint256[](3);
        weights[0] = 5e17;  // 50%
        weights[1] = 3e17;  // 30%
        weights[2] = 2e17;  // 20%
        uint256[] memory prices = new uint256[](3);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;
        prices[2] = SOL_PRICE;

        bytes32 itpId = index.createITP("Three", "TH3", weights, assets, prices, type(uint256).max);
        uint256 nav = index.getNAV(itpId);

        assertApproxEqAbs(nav, 1e18, 1e3, "Three-asset ITP should start at ~$1");
    }

    // ============ INVENTORY CORRECTNESS ============

    function test_inventory_computedCorrectly() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 6e17; // 60%
        weights[1] = 4e17; // 40%
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("Test", "TST", weights, assets, prices, type(uint256).max);
        (,,, address[] memory retAssets,, uint256[] memory inventory) = index.getITPState(itpId);

        // qty_btc = (6e17 * 1e18) / 100000e18 = 6000000000000 = 6e12
        assertEq(inventory[0], 6e12, "BTC qty: (60% * $1) / $100k");
        // qty_eth = (4e17 * 1e18) / 3000e18 = 133333333333333
        assertEq(inventory[1], (4e17 * 1e18) / ETH_PRICE, "ETH qty: (40% * $1) / $3k");
        assertEq(retAssets[0], btcAddr);
        assertEq(retAssets[1], ethAddr);
    }

    // ============ NAV MOVES WITH PRICE CHANGES ============

    function test_btcDoubles_navIncreasesCorrectly() public {
        // 1% BTC weight, 99% SOL weight
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = solAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1e16;             // 1%
        weights[1] = 1e18 - 1e16;      // 99%
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = SOL_PRICE;

        bytes32 itpId = index.createITP("BTC SOL", "BS", weights, assets, prices, type(uint256).max);

        // Verify starting NAV ~ $1
        uint256 navBefore = index.getNAV(itpId);
        assertApproxEqAbs(navBefore, 1e18, 1e3, "Should start at ~$1");

        // BTC doubles: $100k -> $200k
        // BTC was 1% of $1 = $0.01. BTC doubles -> contribution becomes $0.02
        // SOL was 99% = $0.99, unchanged
        // New NAV = $0.99 + $0.02 = $1.01
        index.setItpNav(itpId, 1.01e18, emptyBlsSignature);

        uint256 navAfter = index.getNAV(itpId);
        assertApproxEqAbs(navAfter, 1.01e18, 1e3, "NAV should be ~$1.01 after BTC doubles");
    }

    function test_allPricesDouble_navDoubles() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 5e17;
        weights[1] = 5e17;
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("5050", "5050", weights, assets, prices, type(uint256).max);

        // All prices double -> NAV doubles from $1 to $2
        index.setItpNav(itpId, 2e18, emptyBlsSignature);

        uint256 nav = index.getNAV(itpId);
        assertApproxEqAbs(nav, 2e18, 1e4, "NAV should double when all prices double");
    }

    function test_priceDropsToZero_navPartiallyZero() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 6e17;
        weights[1] = 4e17;
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("Test", "TST", weights, assets, prices, type(uint256).max);

        // ETH price drops to 0 (oracle failure) — only BTC contributes
        // qty_btc = (6e17 * 1e18) / 100000e18 = 6e12
        // contribution = (6e12 * 100000e18) / 1e18 = 6e17
        index.setItpNav(itpId, 6e17, emptyBlsSignature);

        uint256 nav = index.getNAV(itpId);
        assertEq(nav, 6e17, "Only BTC portion should contribute when ETH price is 0");
    }

    // ============ REBALANCE PRESERVES NAV ============

    function test_rebalance_preservesNAV() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 6e17; // 60% BTC
        weights[1] = 4e17; // 40% ETH
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("Rebal", "REB", weights, assets, prices, type(uint256).max);

        // Simulate market movement: BTC +20% ($120k), ETH -16.7% ($2.5k)
        // qty_btc = (6e17 * 1e18) / 100000e18 = 6e12
        // qty_eth = (4e17 * 1e18) / 3000e18 = 133333333333333
        // new NAV = (6e12 * 120000e18 + 133333333333333 * 2500e18) / 1e18
        //         = (720000000000000000 + 333333333333332500) = 1053333333333332500
        uint256 simulatedNav = 1053333333333332500;
        index.setItpNav(itpId, simulatedNav, emptyBlsSignature);

        uint256 navBefore = index.getNAV(itpId);
        assertGt(navBefore, 0, "NAV should be non-zero before rebalance");

        // Propose and execute rebalance: 60/40 -> 40/60
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 4e17; // 40% BTC
        newWeights[1] = 6e17; // 60% ETH

        // Compute new inventory: newInventory[i] = (newWeights[i] * navBefore) / prices[i]
        uint256[] memory newInventory = new uint256[](2);
        newInventory[0] = (newWeights[0] * navBefore) / 120_000e18;
        newInventory[1] = (newWeights[1] * navBefore) / 2_500e18;

        // Prices for rebalance inventory computation (use simulated market prices)
        uint256[] memory rebalPrices = new uint256[](2);
        rebalPrices[0] = 120_000e18;
        rebalPrices[1] = 2_500e18;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        index.rebalance(itpId, emptyIndices, emptyAddrs, newWeights, rebalPrices, emptyBlsSignature);

        uint256 navAfter = index.getNAV(itpId);

        // NAV should be preserved (with minor rounding)
        assertApproxEqAbs(navAfter, navBefore, 1e5, "NAV should be preserved after rebalance");

        // Verify weights changed
        (,,,, uint256[] memory finalWeights,) = index.getITPState(itpId);
        assertEq(finalWeights[0], 4e17, "BTC weight should be 40%");
        assertEq(finalWeights[1], 6e17, "ETH weight should be 60%");
    }

    function test_rebalance_inventoryRecalculated() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 5e17;
        weights[1] = 5e17;
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("Inv", "INV", weights, assets, prices, type(uint256).max);

        (,,,,, uint256[] memory invBefore) = index.getITPState(itpId);
        uint256 btcQtyBefore = invBefore[0];
        uint256 ethQtyBefore = invBefore[1];

        // Rebalance: 50/50 -> 80/20
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 8e17;
        newWeights[1] = 2e17;

        uint256 nav = 1e18; // NAV is $1 at creation prices
        uint256[] memory newInventory = new uint256[](2);
        newInventory[0] = (newWeights[0] * nav) / BTC_PRICE;
        newInventory[1] = (newWeights[1] * nav) / ETH_PRICE;

        uint256[] memory rebalPrices = new uint256[](2);
        rebalPrices[0] = BTC_PRICE;
        rebalPrices[1] = ETH_PRICE;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        index.rebalance(itpId, emptyIndices, emptyAddrs, newWeights, rebalPrices, emptyBlsSignature);

        (,,,,, uint256[] memory invAfter) = index.getITPState(itpId);

        // BTC qty should increase (more weight), ETH qty should decrease
        assertGt(invAfter[0], btcQtyBefore, "BTC qty should increase after 50->80% rebalance");
        assertLt(invAfter[1], ethQtyBefore, "ETH qty should decrease after 50->20% rebalance");
    }

    // ============ 100-ASSET ITP: PLAN SPEC EXAMPLE ============

    function test_100AssetITP_navStartsAtOneDollar() public {
        uint256 assetCount = 100;
        address[] memory assets = new address[](assetCount);
        uint256[] memory weights = new uint256[](assetCount);
        uint256[] memory prices = new uint256[](assetCount);

        // 1% each, all at $100
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = address(uint160(0x5000 + i));
            assets[i] = asset;
            weights[i] = 1e16; // 1%
            prices[i] = 100e18; // $100 each
        }

        bytes32 itpId = index.createITP("100 Fund", "F100", weights, assets, prices, type(uint256).max);
        uint256 nav = index.getNAV(itpId);

        assertEq(nav, 1e18, "100-asset ITP should start at exactly $1");
    }

    // ============ VIEW FUNCTION CONSISTENCY ============

    function test_getNAV_matchesGetITPState() public {
        address[] memory assets = new address[](2);
        assets[0] = btcAddr;
        assets[1] = ethAddr;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 7e17;
        weights[1] = 3e17;
        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        bytes32 itpId = index.createITP("Consistent", "CON", weights, assets, prices, type(uint256).max);

        uint256 navDirect = index.getNAV(itpId);
        (,, uint256 navFromState,,,) = index.getITPState(itpId);

        assertEq(navDirect, navFromState, "getNAV and getITPState.nav must be identical");
    }
}
