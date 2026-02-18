// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Morpho, Id, MarketParams, Market} from "@morpho-blue/Morpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import "./helpers/MorphoTestHelper.sol";

/// @title MorphoCuratorIRMLiquidation Test
/// @notice Tests liquidation flow on markets using CuratorRateIRM
/// @dev Verifies: position creation, price crash → underwater, liquidation,
///      collateral seizure, debt reduction, interest accrual correctness
contract MorphoCuratorIRMLiquidationTest is MorphoTestHelper {
    using MarketParamsLib for MarketParams;

    address public curatorAddr = address(0xEE);
    address public liquidatorAddr = address(0xFF);

    uint256 constant RATE_5PCT = 1585489599; // ~5% APR per second

    function setUp() public {
        _deployMorphoStackWithCuratorIRM(curatorAddr);

        // Set an initial rate
        vm.prank(curatorAddr);
        curatorIrm.setRate(marketId, RATE_5PCT);

        // Give liquidator USDC
        usdc.mint(liquidatorAddr, 1_000_000e6);
    }

    // ============ BASIC LIQUIDATION ============

    function test_liquidation_afterPriceCrash() public {
        // Setup: borrower supplies 100 ITP, borrows 70 USDC (tight at 77% LLTV)
        _setupBorrowPosition(100e18, 70e6);

        // Verify position exists
        (,, uint256 collateral) = morpho.position(marketId, borrower);
        assertEq(collateral, 100e18, "Collateral should be 100 ITP");

        // Crash oracle price to 50% (0.5 USDC per ITP)
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // At crashed price:
        // collateral_value = 100 * 0.5 = 50 USDC
        // max_borrow = 50 * 0.77 = 38.5 USDC
        // debt = 70 USDC > 38.5 → position is liquidatable

        // Liquidator repays some debt and seizes collateral
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(
            marketParams, borrower, 50e18, 0, "" // seize 50 ITP of collateral
        );
        vm.stopPrank();

        assertGt(seized, 0, "Should have seized collateral");
        assertGt(repaid, 0, "Should have repaid debt");

        // Verify borrower has less collateral
        (,, uint256 remainingCollateral) = morpho.position(marketId, borrower);
        assertEq(remainingCollateral, 50e18, "Should have 50 ITP remaining");
    }

    function test_liquidation_fullRepay() public {
        // Setup: smaller position - 100 ITP, 30 USDC borrow
        _setupBorrowPosition(100e18, 30e6);

        // Crash price to 25% ($0.25 per ITP)
        // collateral_value = 100 * 0.25 = 25 USDC
        // max_borrow = 25 * 0.77 = 19.25 USDC < 30 USDC debt → underwater
        uint256 crashPrice = ORACLE_PRICE / 4;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Liquidate all collateral
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.liquidate(marketParams, borrower, 100e18, 0, "");
        vm.stopPrank();

        // Check position is cleared or greatly reduced
        (,, uint256 collateral) = morpho.position(marketId, borrower);
        // Collateral should be reduced (Morpho seizes up to the repaid amount worth)
        assertLt(collateral, 100e18, "Collateral should be reduced");
    }

    // ============ INTEREST ACCRUAL + LIQUIDATION ============

    function test_liquidation_afterInterestAccrual() public {
        // Setup position
        _setupBorrowPosition(100e18, 60e6);

        // Advance 1 year - but refresh rate before accrual so it doesn't go stale
        // (CuratorRateIRM returns punitive rate after 48h without refresh)
        vm.warp(block.timestamp + 365 days);

        // Curator refreshes rate just before accrual (as the bot would)
        vm.prank(curatorAddr);
        curatorIrm.setRate(marketId, RATE_5PCT);

        // Accrue interest - Morpho applies rate * elapsed for full year
        morpho.accrueInterest(marketParams);

        // Check that total borrow assets increased
        (,, uint128 totalBorrowAssets,,,) = morpho.market(marketId);
        assertGt(totalBorrowAssets, 60e6, "Interest should have accrued on 60 USDC debt");

        // With 5% APR simple interest for 1 year: 60 * 1.05 = 63
        // Morpho uses Taylor compound: slightly higher
        assertGt(totalBorrowAssets, 62e6, "Should be > 62 USDC with ~5% interest");
        assertLt(totalBorrowAssets, 65e6, "Should be < 65 USDC (not unreasonably high)");

        // Now crash price
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Liquidate
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(
            marketParams, borrower, 50e18, 0, ""
        );
        vm.stopPrank();

        assertGt(seized, 0, "Liquidation should succeed after interest accrual");
        assertGt(repaid, 0, "Should repay debt including accrued interest");
    }

    // ============ RATE CHANGE BEFORE LIQUIDATION ============

    function test_liquidation_afterRateUpdate() public {
        // Setup position
        _setupBorrowPosition(100e18, 60e6);

        // Curator updates rate to 20% APR
        uint256 rate20pct = RATE_5PCT * 4; // ~20% APR
        vm.prank(curatorAddr);
        curatorIrm.setRate(marketId, rate20pct);

        // Advance 1 year
        vm.warp(block.timestamp + 365 days);
        morpho.accrueInterest(marketParams);

        // Debt should be significantly higher (~72 USDC with 20% on 60)
        (,, uint128 totalBorrowAssets,,,) = morpho.market(marketId);
        assertGt(totalBorrowAssets, 70e6, "20% APR should grow 60 USDC to >70");

        // Crash price
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Liquidate
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(
            marketParams, borrower, 50e18, 0, ""
        );
        vm.stopPrank();

        assertGt(seized, 0, "Should succeed after rate change + time");
    }

    // ============ PUNITIVE RATE LIQUIDATION ============

    function test_liquidation_punitiveRateAccrues() public {
        // Setup position
        _setupBorrowPosition(100e18, 60e6);

        // Let rate go stale (no curator update for 48h+)
        vm.warp(block.timestamp + 49 hours);
        morpho.accrueInterest(marketParams);

        // At punitive rate (~100% APR), interest should accrue faster
        // For 49 hours, that's about 49/8760 * 100% ≈ 0.56% interest
        // on 60 USDC = ~0.33 USDC additional
        (,, uint128 totalBorrowAssets1,,,) = morpho.market(marketId);

        // Now advance more time at punitive rate
        vm.warp(block.timestamp + 30 days);
        morpho.accrueInterest(marketParams);

        (,, uint128 totalBorrowAssets2,,,) = morpho.market(marketId);
        assertGt(totalBorrowAssets2, totalBorrowAssets1, "Punitive rate should accrue more interest");

        // Crash price and liquidate
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(
            marketParams, borrower, 50e18, 0, ""
        );
        vm.stopPrank();

        assertGt(seized, 0, "Should liquidate at punitive rate");
    }

    // ============ MULTIPLE POSITIONS ============

    function test_liquidation_multiplePositions() public {
        // Setup two borrower positions
        address borrower2 = address(0xAB);
        itp.mint(borrower2, 1_000e18);

        // Borrower 1: 100 ITP, 70 USDC
        _setupBorrowPosition(100e18, 70e6);

        // Borrower 2: 200 ITP, 120 USDC
        vm.startPrank(borrower2);
        itp.approve(address(morpho), 200e18);
        morpho.supplyCollateral(marketParams, 200e18, borrower2, "");
        morpho.borrow(marketParams, 120e6, 0, borrower2, borrower2);
        vm.stopPrank();

        // Crash price
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Liquidate borrower 1
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized1, uint256 repaid1) = morpho.liquidate(
            marketParams, borrower, 50e18, 0, ""
        );

        // Liquidate borrower 2
        (uint256 seized2, uint256 repaid2) = morpho.liquidate(
            marketParams, borrower2, 100e18, 0, ""
        );
        vm.stopPrank();

        assertGt(seized1, 0, "Should liquidate borrower 1");
        assertGt(seized2, 0, "Should liquidate borrower 2");
    }

    // ============ HEALTHY POSITION CANNOT BE LIQUIDATED ============

    function test_liquidation_revertsOnHealthyPosition() public {
        // Setup: 100 ITP at $1, borrow only 30 USDC (very safe, HF > 2)
        _setupBorrowPosition(100e18, 30e6);

        // Try to liquidate without crashing price
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        vm.expectRevert();
        morpho.liquidate(marketParams, borrower, 50e18, 0, "");
        vm.stopPrank();
    }

    // ============ ORACLE PRICE PUSH BEFORE LIQUIDATION ============

    function test_liquidation_oracleUpdateThenLiquidate() public {
        // Setup tight position
        _setupBorrowPosition(100e18, 70e6);

        // Simulate curator bot flow: push oracle price first, then liquidate
        // Step 1: Push crashed oracle price
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Step 2: Push fresh rate (curator does this before liquidation)
        uint256 freshRate = RATE_5PCT * 2; // 10% APR
        vm.prank(curatorAddr);
        curatorIrm.setRate(marketId, freshRate);

        // Step 3: Liquidate
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(
            marketParams, borrower, 50e18, 0, ""
        );
        vm.stopPrank();

        assertGt(seized, 0, "Liquidation after oracle+rate push should succeed");

        // Verify the rate is still the fresh one (not punitive)
        Market memory market;
        uint256 currentRate = curatorIrm.borrowRateView(marketParams, market);
        assertEq(currentRate, freshRate, "Rate should be the freshly pushed rate");
    }

    // ============ PARTIAL LIQUIDATION ============

    function test_liquidation_partialSeizure() public {
        // Setup: 100 ITP, 70 USDC
        _setupBorrowPosition(100e18, 70e6);

        // Crash price
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Liquidate only 10 ITP (partial)
        vm.startPrank(liquidatorAddr);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(
            marketParams, borrower, 10e18, 0, ""
        );
        vm.stopPrank();

        assertEq(seized, 10e18, "Should seize exactly 10 ITP");
        assertGt(repaid, 0, "Should repay some debt");

        // Position should still exist with remaining collateral
        (,, uint256 remainingCollateral) = morpho.position(marketId, borrower);
        assertEq(remainingCollateral, 90e18, "Should have 90 ITP remaining");
    }
}
