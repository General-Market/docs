// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/core/Index.sol";
import "../../src/core/ITP.sol";
import "../../src/mocks/MockERC20.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import "../../src/registry/IssuerRegistry.sol";
import "../../src/libraries/TypesLib.sol";
import "../../src/libraries/ErrorsLib.sol";
import "../../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title E2ERebalanceFlow - End-to-End Integration Test (V2 - Asset Changes)
/// @notice Tests the new 2-step rebalance flow: requestRebalance (event) → rebalance (BLS)
/// @dev Uses real BLS signatures via FFI (bls-tool). All BLS-protected calls use real signing.
contract E2ERebalanceFlowTest is TestHelper {
    Index public index;
    MockERC20 public usdc;
    MockERC20 public btc;
    MockERC20 public eth_;
    Governance public governance;

    ITP public itpVaultA;
    ITP public itpVaultB;

    address public creator = makeAddr("creator");
    address public user1 = makeAddr("user1");
    address public admin;

    bytes32 public itpIdA;
    bytes32 public itpIdB;

    address public btcAddr;
    address public ethAddr;
    address public solAddr;

    uint256 constant BTC_PRICE = 50_000e18; // $50,000 per BTC
    uint256 constant ETH_PRICE = 3_000e18;  // $3,000 per ETH
    uint256 constant SOL_PRICE = 100e18;    // $100 per SOL
    uint256 constant INITIAL_USDC = 1_000_000e18;

    function setUp() public {
        admin = address(this);

        // Deploy mock tokens
        usdc = new MockERC20("USDC", "USDC", 18);
        btc = new MockERC20("Wrapped BTC", "WBTC", 18);
        eth_ = new MockERC20("Wrapped ETH", "WETH", 18);

        btcAddr = address(btc);
        ethAddr = address(eth_);
        solAddr = makeAddr("SOL");

        // Deploy mock governance
        governance = deployGovernance(admin);

        // Deploy Index as UUPS proxy
        Index impl = new Index();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Index.initialize, (address(governance), address(usdc)))
        );
        index = Index(address(proxy));

        // Deploy IssuerRegistry, register real BLS test issuers, wire to Index
        IssuerRegistry issuerRegistry = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(issuerRegistry, admin);
        index.setIssuerRegistry(address(issuerRegistry));

        // Fund creator with USDC
        usdc.mint(creator, INITIAL_USDC);
        vm.prank(creator);
        usdc.approve(address(index), type(uint256).max);

        // Fund user1 with USDC
        usdc.mint(user1, INITIAL_USDC);
        vm.prank(user1);
        usdc.approve(address(index), type(uint256).max);

        // Create ITP-A with 2 assets: BTC 60%, ETH 40%
        address[] memory assetsA = new address[](2);
        assetsA[0] = btcAddr;
        assetsA[1] = ethAddr;

        uint256[] memory weightsA = new uint256[](2);
        weightsA[0] = 6e17; // 60%
        weightsA[1] = 4e17; // 40%

        uint256[] memory pricesA = new uint256[](2);
        pricesA[0] = BTC_PRICE;
        pricesA[1] = ETH_PRICE;

        vm.prank(creator);
        itpIdA = index.createITP("ITP Alpha", "ITPA", weightsA, assetsA, pricesA, type(uint256).max);

        // Deploy ITP-A vault and link
        itpVaultA = new ITP(itpIdA, address(index), "ITP Alpha Token", "ITPA", IERC20(address(usdc)));
        index.setITPVault(itpIdA, address(itpVaultA));

        // Seed ITP-A with some supply via order flow (100k USDC)
        _seedITP(itpIdA, creator, 100_000e18, 1);

        // Create ITP-B with 2 assets: BTC 40%, ETH 60%
        address[] memory assetsB = new address[](2);
        assetsB[0] = btcAddr;
        assetsB[1] = ethAddr;

        uint256[] memory weightsB = new uint256[](2);
        weightsB[0] = 4e17; // 40%
        weightsB[1] = 6e17; // 60%

        uint256[] memory pricesB = new uint256[](2);
        pricesB[0] = BTC_PRICE;
        pricesB[1] = ETH_PRICE;

        vm.prank(creator);
        itpIdB = index.createITP("ITP Beta", "ITPB", weightsB, assetsB, pricesB, type(uint256).max);

        // Deploy ITP-B vault and link
        itpVaultB = new ITP(itpIdB, address(index), "ITP Beta Token", "ITPB", IERC20(address(usdc)));
        index.setITPVault(itpIdB, address(itpVaultB));

        // Seed ITP-B with some supply via order flow (50k USDC)
        _seedITP(itpIdB, user1, 50_000e18, 2);
    }

    // ============ SIGNING HELPERS ============

    function _signConfirmBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestIssuers(message);
    }

    function _signConfirmFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestIssuers(message);
    }

    function _signRebalance(
        bytes32 _itpId,
        uint256[] memory removeIndices,
        address[] memory addAssets,
        uint256[] memory newWeights,
        uint256[] memory prices
    ) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(index), "rebalance",
            _itpId, removeIndices, addAssets, newWeights, prices
        ));
        return signWithTestIssuers(message);
    }

    // ============ HELPERS ============

    /// @dev Seed an ITP with initial supply via the order-to-mint flow
    function _seedITP(bytes32 _itpId, address user, uint256 amount, uint256 cycleNumber) internal {
        uint256 navPrice = index.getNAV(_itpId);
        uint256 limitPrice = navPrice > 0 ? navPrice : BTC_PRICE;
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            _itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            2, // relaxed slippage
            block.timestamp + 1 hours
        );

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(cycleNumber, orderIds, _signConfirmBatch(cycleNumber, orderIds));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: amount,
            cycleNumber: cycleNumber,
            txHash: bytes32(0)
        });
        index.confirmFills(cycleNumber, fills, _signConfirmFills(cycleNumber, fills));
    }

    // ============ TEST: Weight-only Rebalance Happy Path ============

    function test_e2e_weightOnly_rebalance() public {
        // ITP-A has weights [60%, 40%] for [BTC, ETH]
        // Rebalance to [40%, 60%] with no asset changes
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 4e17; // 40% BTC
        newWeights[1] = 6e17; // 60% ETH

        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        uint256 navBefore = index.getNAV(itpIdA);

        // Execute rebalance (single BLS call)
        index.rebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices, _signRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices));

        // Verify new weights
        (,,,, uint256[] memory finalWeights,) = index.getITPState(itpIdA);
        assertEq(finalWeights[0], 4e17, "BTC weight should be 40% after rebalance");
        assertEq(finalWeights[1], 6e17, "ETH weight should be 60% after rebalance");

        // NAV should be preserved
        uint256 navAfter = index.getNAV(itpIdA);
        assertApproxEqAbs(navAfter, navBefore, 1e5, "NAV should be preserved after weight-only rebalance");
    }

    // ============ TEST: Remove 1 Asset from 5 ============

    function test_e2e_removeAsset() public {
        // Create a 5-asset ITP
        address[] memory assets5 = new address[](5);
        assets5[0] = btcAddr;
        assets5[1] = ethAddr;
        assets5[2] = solAddr;
        assets5[3] = makeAddr("AVAX");
        assets5[4] = makeAddr("LINK");

        uint256[] memory weights5 = new uint256[](5);
        weights5[0] = 3e17;  // 30%
        weights5[1] = 2e17;  // 20%
        weights5[2] = 2e17;  // 20%
        weights5[3] = 15e16; // 15%
        weights5[4] = 15e16; // 15%

        uint256[] memory prices5 = new uint256[](5);
        prices5[0] = BTC_PRICE;
        prices5[1] = ETH_PRICE;
        prices5[2] = SOL_PRICE;
        prices5[3] = 50e18;
        prices5[4] = 20e18;

        bytes32 itpId5 = index.createITP("Five Asset", "FV5", weights5, assets5, prices5, type(uint256).max);

        uint256 navBefore = index.getNAV(itpId5);

        // Remove asset at index 2 (SOL)
        uint256[] memory removeIndices = new uint256[](1);
        removeIndices[0] = 2;

        address[] memory noAddAssets = new address[](0);

        // New weights for 4 remaining assets: redistribute SOL's 20% equally
        uint256[] memory newWeights = new uint256[](4);
        newWeights[0] = 35e16; // 35%
        newWeights[1] = 25e16; // 25%
        newWeights[2] = 20e16; // 20% (was AVAX at index 3, now at 2 after swap-and-pop)
        newWeights[3] = 20e16; // 20% (was LINK at index 4, now at 3)

        // Prices for the 4 remaining assets (after swap-and-pop: SOL replaced by last element LINK)
        // Final order: BTC, ETH, LINK (swapped into SOL's slot), AVAX
        // Wait — swap-and-pop removes index 2 by replacing with last element
        // Before: [BTC, ETH, SOL, AVAX, LINK]
        // After removing index 2: [BTC, ETH, LINK, AVAX]
        uint256[] memory newPrices = new uint256[](4);
        newPrices[0] = BTC_PRICE;
        newPrices[1] = ETH_PRICE;
        newPrices[2] = 20e18;  // LINK (swapped from index 4)
        newPrices[3] = 50e18;  // AVAX (stays at index 3)

        index.rebalance(itpId5, removeIndices, noAddAssets, newWeights, newPrices, _signRebalance(itpId5, removeIndices, noAddAssets, newWeights, newPrices));

        // Verify 4 assets remain
        (,,, address[] memory finalAssets, uint256[] memory finalWeights,) = index.getITPState(itpId5);
        assertEq(finalAssets.length, 4, "Should have 4 assets after removal");
        assertEq(finalWeights.length, 4, "Should have 4 weights after removal");

        // Verify asset order after swap-and-pop
        assertEq(finalAssets[0], btcAddr, "BTC should be at index 0");
        assertEq(finalAssets[1], ethAddr, "ETH should be at index 1");
        assertEq(finalAssets[2], makeAddr("LINK"), "LINK should be swapped to index 2");
        assertEq(finalAssets[3], makeAddr("AVAX"), "AVAX should be at index 3");

        // NAV should be preserved
        uint256 navAfter = index.getNAV(itpId5);
        assertApproxEqAbs(navAfter, navBefore, 1e5, "NAV should be preserved after removing asset");
    }

    // ============ TEST: Add 1 Asset to 5 ============

    function test_e2e_addAsset() public {
        // Create a 5-asset ITP
        address[] memory assets5 = new address[](5);
        assets5[0] = btcAddr;
        assets5[1] = ethAddr;
        assets5[2] = solAddr;
        assets5[3] = makeAddr("AVAX");
        assets5[4] = makeAddr("LINK");

        uint256[] memory weights5 = new uint256[](5);
        weights5[0] = 3e17;  // 30%
        weights5[1] = 2e17;  // 20%
        weights5[2] = 2e17;  // 20%
        weights5[3] = 15e16; // 15%
        weights5[4] = 15e16; // 15%

        uint256[] memory prices5 = new uint256[](5);
        prices5[0] = BTC_PRICE;
        prices5[1] = ETH_PRICE;
        prices5[2] = SOL_PRICE;
        prices5[3] = 50e18;
        prices5[4] = 20e18;

        bytes32 itpId5 = index.createITP("Five Asset", "FV5A", weights5, assets5, prices5, type(uint256).max);

        uint256 navBefore = index.getNAV(itpId5);

        // Add new asset DOT
        address dotAddr = makeAddr("DOT");
        uint256[] memory noRemoveIndices = new uint256[](0);
        address[] memory addAssets = new address[](1);
        addAssets[0] = dotAddr;

        // New weights for 6 assets (existing 5 + DOT)
        uint256[] memory newWeights = new uint256[](6);
        newWeights[0] = 25e16; // 25%
        newWeights[1] = 17e16; // 17%
        newWeights[2] = 17e16; // 17%
        newWeights[3] = 13e16; // 13%
        newWeights[4] = 13e16; // 13%
        newWeights[5] = 15e16; // 15% DOT

        uint256[] memory newPrices = new uint256[](6);
        newPrices[0] = BTC_PRICE;
        newPrices[1] = ETH_PRICE;
        newPrices[2] = SOL_PRICE;
        newPrices[3] = 50e18;
        newPrices[4] = 20e18;
        newPrices[5] = 10e18; // DOT price

        index.rebalance(itpId5, noRemoveIndices, addAssets, newWeights, newPrices, _signRebalance(itpId5, noRemoveIndices, addAssets, newWeights, newPrices));

        // Verify 6 assets
        (,,, address[] memory finalAssets, uint256[] memory finalWeights,) = index.getITPState(itpId5);
        assertEq(finalAssets.length, 6, "Should have 6 assets after addition");
        assertEq(finalWeights.length, 6, "Should have 6 weights after addition");

        // New asset should be at the end
        assertEq(finalAssets[5], dotAddr, "DOT should be at index 5");
        assertEq(finalWeights[5], 15e16, "DOT weight should be 15%");

        // NAV should be preserved
        uint256 navAfter = index.getNAV(itpId5);
        assertApproxEqAbs(navAfter, navBefore, 1e5, "NAV should be preserved after adding asset");
    }

    // ============ TEST: requestRebalance emits event ============

    function test_e2e_requestRebalance_emitsEvent() public {
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 4e17;
        newWeights[1] = 6e17;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        vm.expectEmit(true, true, false, true);
        emit EventsLib.RebalanceRequested(creator, itpIdA, emptyIndices, emptyAddrs, newWeights, "weight adjustment");

        vm.prank(creator);
        index.requestRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, "weight adjustment");
    }

    // ============ TEST: Rebalance emits Rebalanced event ============

    function test_e2e_rebalance_emitsRebalancedEvent() public {
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 5e17;
        newWeights[1] = 5e17;

        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        vm.recordLogs();
        index.rebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices, _signRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 rebalancedTopic = EventsLib.Rebalanced.selector;

        bool foundRebalanced;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == rebalancedTopic) {
                foundRebalanced = true;
                break;
            }
        }
        assertTrue(foundRebalanced, "Rebalanced event must be emitted");
    }

    // ============ TEST: Pause Blocks Rebalance ============

    function test_e2e_rebalance_paused_reverts() public {
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 5e17;
        newWeights[1] = 5e17;

        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        // Pause the system
        governance.pause();

        // rebalance should revert
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E004_SystemPaused.selector));
        index.rebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices, _signRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices));

        // requestRebalance is permissionless event-only, should still work
        // (no pause check on event emitter)
        vm.prank(creator);
        index.requestRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, "paused test");

        // Unpause, rebalance succeeds
        governance.unpause();
        index.rebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices, _signRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices));
    }

    // ============ TEST: ITP Supply Preserved During Rebalance ============

    function test_e2e_rebalance_preserves_itp_supply() public {
        // Get supply before rebalance
        TypesLib.ITPCore memory itpBefore = index.getITP(itpIdA);
        uint256 supplyBefore = itpBefore.totalSupply;
        assertGt(supplyBefore, 0, "ITP should have supply from seeding");

        // Execute rebalance
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 4e17;
        newWeights[1] = 6e17;

        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        index.rebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices, _signRebalance(itpIdA, emptyIndices, emptyAddrs, newWeights, prices));

        // Verify supply unchanged
        TypesLib.ITPCore memory itpAfter = index.getITP(itpIdA);
        assertEq(itpAfter.totalSupply, supplyBefore, "Total supply should not change during rebalance");
    }

    // ============ TEST: Multi-ITP Rebalance Both Directions ============

    function test_e2e_multiItp_rebalance() public {
        // Rebalance ITP-A: BTC 60%→40%, ETH 40%→60%
        uint256[] memory newWeightsA = new uint256[](2);
        newWeightsA[0] = 4e17;
        newWeightsA[1] = 6e17;

        // Rebalance ITP-B: BTC 40%→60%, ETH 60%→40%
        uint256[] memory newWeightsB = new uint256[](2);
        newWeightsB[0] = 6e17;
        newWeightsB[1] = 4e17;

        uint256[] memory prices = new uint256[](2);
        prices[0] = BTC_PRICE;
        prices[1] = ETH_PRICE;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        index.rebalance(itpIdA, emptyIndices, emptyAddrs, newWeightsA, prices, _signRebalance(itpIdA, emptyIndices, emptyAddrs, newWeightsA, prices));
        index.rebalance(itpIdB, emptyIndices, emptyAddrs, newWeightsB, prices, _signRebalance(itpIdB, emptyIndices, emptyAddrs, newWeightsB, prices));

        // Verify final weights
        (,,,, uint256[] memory finalWeightsA,) = index.getITPState(itpIdA);
        assertEq(finalWeightsA[0], 4e17, "ITP-A BTC weight should be 40%");
        assertEq(finalWeightsA[1], 6e17, "ITP-A ETH weight should be 60%");

        (,,,, uint256[] memory finalWeightsB,) = index.getITPState(itpIdB);
        assertEq(finalWeightsB[0], 6e17, "ITP-B BTC weight should be 60%");
        assertEq(finalWeightsB[1], 4e17, "ITP-B ETH weight should be 40%");
    }

    // ============ TEST: Remove and Add in Same Rebalance ============

    function test_e2e_removeAndAdd() public {
        // Create a 3-asset ITP
        address[] memory assets3 = new address[](3);
        assets3[0] = btcAddr;
        assets3[1] = ethAddr;
        assets3[2] = solAddr;

        uint256[] memory weights3 = new uint256[](3);
        weights3[0] = 5e17; // 50%
        weights3[1] = 3e17; // 30%
        weights3[2] = 2e17; // 20%

        uint256[] memory prices3 = new uint256[](3);
        prices3[0] = BTC_PRICE;
        prices3[1] = ETH_PRICE;
        prices3[2] = SOL_PRICE;

        bytes32 itpId3 = index.createITP("Three Asset", "TH3", weights3, assets3, prices3, type(uint256).max);

        uint256 navBefore = index.getNAV(itpId3);

        // Remove SOL (index 2), add AVAX
        uint256[] memory removeIndices = new uint256[](1);
        removeIndices[0] = 2;

        address avaxAddr = makeAddr("AVAX");
        address[] memory addAssets = new address[](1);
        addAssets[0] = avaxAddr;

        // After removal: [BTC, ETH] (SOL was last, just pop)
        // After add: [BTC, ETH, AVAX]
        uint256[] memory newWeights = new uint256[](3);
        newWeights[0] = 5e17; // 50%
        newWeights[1] = 3e17; // 30%
        newWeights[2] = 2e17; // 20% AVAX

        uint256[] memory newPrices = new uint256[](3);
        newPrices[0] = BTC_PRICE;
        newPrices[1] = ETH_PRICE;
        newPrices[2] = 50e18; // AVAX price

        index.rebalance(itpId3, removeIndices, addAssets, newWeights, newPrices, _signRebalance(itpId3, removeIndices, addAssets, newWeights, newPrices));

        // Verify final state
        (,,, address[] memory finalAssets, uint256[] memory finalWeights,) = index.getITPState(itpId3);
        assertEq(finalAssets.length, 3, "Should still have 3 assets");
        assertEq(finalAssets[0], btcAddr, "BTC at index 0");
        assertEq(finalAssets[1], ethAddr, "ETH at index 1");
        assertEq(finalAssets[2], avaxAddr, "AVAX at index 2 (replaced SOL)");
        assertEq(finalWeights[2], 2e17, "AVAX weight should be 20%");

        // NAV preserved
        uint256 navAfter = index.getNAV(itpId3);
        assertApproxEqAbs(navAfter, navBefore, 1e5, "NAV preserved after remove+add");
    }
}
