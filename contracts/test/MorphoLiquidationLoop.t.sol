// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Id, MarketParams, Position, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import "./helpers/MorphoTestHelper.sol";

/// @title MorphoLiquidationLoop.t.sol - Tests for Story 8.11
/// @notice Tests partial liquidation mechanics and iterative liquidation loop on Morpho Blue
contract MorphoLiquidationLoopTest is MorphoTestHelper {
    using MarketParamsLib for MarketParams;

    // ============ CONSTANTS ============

    address public liquidator = address(0xEE);
    uint256 public constant SEED_USDC = 100e6; // 100 USDC seed capital

    // Track cycle numbers for oracle price pushes (oracle enforces strictly increasing)
    uint256 private _nextCycleNumber = 2; // cycle 1 used in _deployMorphoStack

    function setUp() public {
        _deployMorphoStack();
    }

    // ============ HELPERS ============

    /// @notice Update oracle NAV price with mock BLS signature
    /// @param newPrice New oracle price (Morpho-scaled, e.g. 0.8e24 for 0.8 USDC per ITP)
    function _updateOraclePrice(uint256 newPrice) internal {
        bytes memory mockSig = new bytes(64);
        // 0x07 = bitmap indicating signers 0,1,2 participated (binary 0b111 = 7)
        oracle.updatePrice(newPrice, block.timestamp, _nextCycleNumber, mockSig, 0x07);
        _nextCycleNumber++;
    }

    /// @notice Check if a position is healthy (health factor >= 1.0)
    /// @return healthy True if position can't be liquidated
    /// @dev Uses round-up division for debt calculation to match Morpho's SharesMathLib.toAssetsUp:
    ///      This ensures our health check is conservative (may report unhealthy when borderline).
    ///      Formula: debt = (borrowShares * totalBorrowAssets + totalBorrowShares - 1) / totalBorrowShares
    function _isPositionHealthy(address user) internal view returns (bool) {
        (, uint128 borrowShares, uint128 collateral) = morpho.position(marketId, user);
        if (borrowShares == 0) return true;

        // Get actual debt in assets from market state
        (,, uint128 totalBorrowAssets, uint128 totalBorrowShares,,) = morpho.market(marketId);
        // debt = borrowShares * totalBorrowAssets / totalBorrowShares (rounded up per SharesMathLib.toAssetsUp)
        uint256 debt = (uint256(borrowShares) * uint256(totalBorrowAssets) + uint256(totalBorrowShares) - 1)
            / uint256(totalBorrowShares);

        uint256 currentOraclePrice = oracle.currentPrice();
        uint256 collateralValueUsdc = uint256(collateral) * currentOraclePrice / 1e36;
        uint256 maxBorrow = collateralValueUsdc * LLTV / 1e18;

        return maxBorrow >= debt;
    }

    // ============ TASK 2: SINGLE PARTIAL LIQUIDATION (AC #1) ============

    /// @notice AC1: Partial liquidation on unhealthy position succeeds
    function test_partialLiquidation_unhealthyPosition() public {
        // Setup: 100 ITP collateral, borrow 70 USDC (near LLTV)
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral); // Extra ITP beyond default
        _setupBorrowPosition(collateral, borrowAmount);

        // Drop oracle price to 0.8e24 (1 ITP = 0.8 USDC)
        _updateOraclePrice(0.8e24);

        // Verify position is now unhealthy
        assertFalse(_isPositionHealthy(borrower), "Position should be unhealthy after price drop");

        // Mint seed USDC to liquidator and approve Morpho
        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        // Record state before liquidation
        (, uint128 borrowSharesBefore, uint128 collateralBefore) = morpho.position(marketId, borrower);
        uint256 liquidatorItpBefore = itp.balanceOf(liquidator);

        // Partial liquidation: seize 20 ITP
        uint256 seizeAmount = 20e18;
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, seizeAmount, 0, "");
        vm.stopPrank();

        // Verify liquidator received ITP
        uint256 liquidatorItpAfter = itp.balanceOf(liquidator);
        assertEq(liquidatorItpAfter - liquidatorItpBefore, seizeAmount, "Liquidator should receive seized ITP");
        assertEq(seized, seizeAmount, "Seized amount should match request");

        // Verify borrower debt reduced
        (, uint128 borrowSharesAfter, uint128 collateralAfter) = morpho.position(marketId, borrower);
        assertTrue(borrowSharesAfter < borrowSharesBefore, "Borrower borrow shares should decrease");
        assertEq(collateralAfter, collateralBefore - uint128(seizeAmount), "Borrower collateral should decrease");

        console.log("Seized ITP:", seized);
        console.log("Repaid USDC:", repaid);
        console.log("Borrow shares before:", borrowSharesBefore);
        console.log("Borrow shares after:", borrowSharesAfter);
    }

    /// @notice AC1: Verify liquidator profit (seized ITP value > USDC repaid)
    function test_partialLiquidation_liquidatorReceivesITPPlusIncentive() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.8e24);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 seizeAmount = 20e18;
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, seizeAmount, 0, "");
        vm.stopPrank();

        // Seized ITP value at oracle price: 20 ITP * 0.8e24 / 1e36 = 16e6 (16 USDC)
        uint256 seizedValueUsdc = seized * 0.8e24 / 1e36;

        // The repaid USDC should be less than the seized value (liquidation incentive = profit)
        assertTrue(repaid < seizedValueUsdc, "USDC repaid should be less than seized ITP value (incentive)");

        console.log("Seized ITP value (USDC):", seizedValueUsdc);
        console.log("USDC repaid:", repaid);
        console.log("Liquidator profit (USDC):", seizedValueUsdc - repaid);
    }

    /// @notice AC1: Borrower debt shares decrease after partial liquidation
    function test_partialLiquidation_borrowerDebtReduced() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.8e24);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        (, uint128 sharesBefore,) = morpho.position(marketId, borrower);

        morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();

        (, uint128 sharesAfter,) = morpho.position(marketId, borrower);
        assertTrue(sharesAfter < sharesBefore, "Borrow shares should decrease after liquidation");
        assertTrue(sharesAfter > 0, "Should still have remaining debt (partial liquidation)");
    }

    // ============ TASK 3: HEALTHY POSITION REVERT (AC #7) ============

    /// @notice AC7: Liquidating a healthy position reverts
    function test_liquidation_healthyPosition_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6; // Well within LLTV
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Do NOT drop oracle price — position stays healthy
        assertTrue(_isPositionHealthy(borrower), "Position should be healthy");

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        vm.expectRevert(bytes("position is healthy"));
        morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();
    }

    /// @notice AC7: After price recovery, second liquidation reverts
    function test_liquidation_afterPriceRecoversToHealthy_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Drop price to make unhealthy
        _updateOraclePrice(0.8e24);
        assertFalse(_isPositionHealthy(borrower), "Should be unhealthy");

        // First liquidation succeeds
        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();

        // Push price back up to restore health
        _updateOraclePrice(1e24); // Back to original price
        assertTrue(_isPositionHealthy(borrower), "Should be healthy after price recovery");

        // Second liquidation should revert
        vm.startPrank(liquidator);
        vm.expectRevert(bytes("position is healthy"));
        morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();
    }

    // ============ TASK 4: LIQUIDATION INCENTIVE MATH (AC #4) ============

    /// @notice AC4: Liquidation is profitable for liquidator
    function test_liquidationIncentive_profitableForLiquidator() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 dropPrice = 0.8e24;
        _updateOraclePrice(dropPrice);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 usdcBefore = usdc.balanceOf(liquidator);
        (uint256 seized,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        uint256 usdcAfter = usdc.balanceOf(liquidator);
        vm.stopPrank();

        uint256 usdcSpent = usdcBefore - usdcAfter;
        uint256 seizedValueUsdc = seized * dropPrice / 1e36;

        // Seized ITP value should exceed USDC spent (profit from liquidation incentive)
        assertTrue(seizedValueUsdc > usdcSpent, "Seized ITP value should exceed USDC cost");

        console.log("USDC spent:", usdcSpent);
        console.log("Seized ITP value (USDC):", seizedValueUsdc);
        console.log("Profit:", seizedValueUsdc - usdcSpent);
    }

    /// @notice AC4: Liquidation incentive is approximately 7.41% for LLTV=77%
    function test_liquidationIncentive_approximately7Percent() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 dropPrice = 0.8e24;
        _updateOraclePrice(dropPrice);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 seizeAmount = 50e18;
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, seizeAmount, 0, "");
        vm.stopPrank();

        // seized value at oracle price
        uint256 seizedValueUsdc = seized * dropPrice / 1e36;

        // incentive ratio = seizedValue / repaid - 1
        // For LLTV=77%: incentiveFactor = 1/(1 - 0.3*(1-0.77)) = 1/0.931 ≈ 1.0741
        // So incentive ≈ 7.41%
        // Using basis points for precision: (seizedValue - repaid) * 10000 / repaid
        uint256 incentiveBps = (seizedValueUsdc - repaid) * 10000 / repaid;

        // Should be approximately 741 bps (7.41%), allow +/- 50 bps tolerance for rounding
        assertTrue(incentiveBps >= 691, "Incentive should be >= 6.91%");
        assertTrue(incentiveBps <= 791, "Incentive should be <= 7.91%");

        console.log("Seized value (USDC):", seizedValueUsdc);
        console.log("Repaid USDC:", repaid);
        console.log("Incentive (bps):", incentiveBps);
    }

    // ============ TASK 5: ITERATIVE LIQUIDATION LOOP (AC #3, #4, #5) ============

    /// @notice AC3/AC4/AC5: Two-iteration liquidation loop with simulated sell
    function test_iterativeLiquidationLoop_twoIterations() public {
        // Setup: 200 ITP collateral, borrow 140 USDC, severe price drop
        uint256 collateral = 200e18;
        uint256 borrowAmount = 140e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.7e24);
        assertFalse(_isPositionHealthy(borrower), "Should be unhealthy");

        // Seed liquidator
        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        // --- Iteration 1 ---
        uint256 usdcBeforeIter1 = usdc.balanceOf(liquidator);
        (uint256 seized1,) = morpho.liquidate(marketParams, borrower, 50e18, 0, "");
        uint256 usdcAfterIter1 = usdc.balanceOf(liquidator);
        uint256 usdcSpent1 = usdcBeforeIter1 - usdcAfterIter1;
        vm.stopPrank();

        // Simulate sell: mint USDC to liquidator equal to seized ITP value at oracle price
        uint256 recoveredUsdc1 = seized1 * 0.7e24 / 1e36;
        usdc.mint(liquidator, recoveredUsdc1);

        // Verify USDC growth: recovered > spent (by incentive %)
        assertTrue(recoveredUsdc1 > usdcSpent1, "Recovered USDC should exceed spent (iteration 1)");

        console.log("=== Iteration 1 ===");
        console.log("Seized ITP:", seized1);
        console.log("USDC spent:", usdcSpent1);
        console.log("USDC recovered:", recoveredUsdc1);

        // --- Iteration 2 ---
        vm.startPrank(liquidator);
        uint256 usdcBeforeIter2 = usdc.balanceOf(liquidator);
        (uint256 seized2,) = morpho.liquidate(marketParams, borrower, 50e18, 0, "");
        uint256 usdcAfterIter2 = usdc.balanceOf(liquidator);
        uint256 usdcSpent2 = usdcBeforeIter2 - usdcAfterIter2;
        vm.stopPrank();

        uint256 recoveredUsdc2 = seized2 * 0.7e24 / 1e36;
        usdc.mint(liquidator, recoveredUsdc2);

        assertTrue(recoveredUsdc2 > usdcSpent2, "Recovered USDC should exceed spent (iteration 2)");

        // Verify position health improved (collateral decreased, debt decreased)
        (, uint128 finalShares, uint128 finalCollateral) = morpho.position(marketId, borrower);
        assertTrue(finalCollateral < uint128(collateral), "Collateral should have decreased");
        assertEq(finalCollateral, uint128(collateral) - uint128(seized1) - uint128(seized2), "Collateral accounting");

        console.log("=== Iteration 2 ===");
        console.log("Seized ITP:", seized2);
        console.log("USDC spent:", usdcSpent2);
        console.log("USDC recovered:", recoveredUsdc2);
        console.log("Final collateral:", finalCollateral);
        console.log("Final borrow shares:", finalShares);
    }

    /// @notice AC6: Loop stops when position becomes healthy
    function test_iterativeLiquidationLoop_stopsWhenHealthy() public {
        // Setup: 200 ITP collateral, borrow amount calculated to be barely unhealthy at dropped price
        // This approach is more robust than hardcoded values that may become flaky
        uint256 collateral = 200e18;
        uint256 dropPrice = 0.95e24;

        // Calculate maxBorrow at dropped price: collateral * dropPrice / 1e36 * LLTV / 1e18
        // Then borrow slightly MORE than maxBorrow to ensure position is unhealthy
        uint256 collateralValueAtDrop = collateral * dropPrice / 1e36; // 190e6
        uint256 maxBorrowAtDrop = collateralValueAtDrop * LLTV / 1e18; // ~146.3e6
        uint256 borrowAmount = maxBorrowAtDrop + 4e6; // 150.3e6 - ensures unhealthy with margin

        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(dropPrice);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 iterations = 0;
        uint256 maxIterations = 20; // Safety cap

        while (iterations < maxIterations) {
            // Try to liquidate a small chunk
            try morpho.liquidate(marketParams, borrower, 10e18, 0, "") returns (uint256 seized, uint256 repaid) {
                iterations++;

                // Simulate sell (mint USDC back)
                vm.stopPrank();
                uint256 recovered = seized * 0.95e24 / 1e36;
                usdc.mint(liquidator, recovered);
                vm.startPrank(liquidator);

                console.log("Iteration", iterations);
                console.log("  Seized:", seized, "Repaid:", repaid);
            } catch {
                // Liquidation reverted — position is healthy or fully liquidated
                break;
            }
        }

        vm.stopPrank();

        assertTrue(iterations > 0, "Should have performed at least one iteration");
        assertTrue(iterations < maxIterations, "Should have stopped before max iterations");

        // Verify final health
        assertTrue(_isPositionHealthy(borrower), "Position should be healthy after loop completes");

        console.log("Total iterations:", iterations);
    }

    /// @notice AC3: Full liquidation — loop until all collateral seized
    function test_iterativeLiquidationLoop_fullLiquidation() public {
        // Setup: 100 ITP, borrow 75 USDC (near max), severe price drop
        uint256 collateral = 100e18;
        uint256 borrowAmount = 75e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.5e24); // Severe drop

        usdc.mint(liquidator, 200e6); // Extra seed for severe scenario
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 iterations = 0;
        uint256 maxIterations = 30;
        uint256 totalSeized = 0;

        while (iterations < maxIterations) {
            (,, uint128 remainingCollateral) = morpho.position(marketId, borrower);
            if (remainingCollateral == 0) break;

            // Seize up to remaining collateral
            uint256 seizeAmount = remainingCollateral < 20e18 ? uint256(remainingCollateral) : 20e18;

            try morpho.liquidate(marketParams, borrower, seizeAmount, 0, "") returns (uint256 seized, uint256) {
                iterations++;
                totalSeized += seized;

                // Simulate sell
                vm.stopPrank();
                uint256 recovered = seized * 0.5e24 / 1e36;
                usdc.mint(liquidator, recovered);
                vm.startPrank(liquidator);
            } catch {
                break;
            }
        }

        vm.stopPrank();

        assertTrue(iterations > 0, "Should have performed iterations");

        // Check borrower's remaining position
        (,, uint128 finalCollateral) = morpho.position(marketId, borrower);

        // Verify full liquidation: all collateral seized
        assertEq(finalCollateral, 0, "All collateral should be seized (full liquidation)");
        assertEq(totalSeized, collateral, "Total seized should equal initial collateral");

        console.log("Total iterations:", iterations);
        console.log("Total ITP seized:", totalSeized);
        console.log("Remaining collateral:", finalCollateral);
    }

    // ============ TASK 6: ORACLE PRICE MANIPULATION (AC #1) ============

    /// @notice AC1: Price drop makes position unhealthy
    function test_priceDropMakesPositionUnhealthy() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // At 1e24: collateral value = 100 USDC, maxBorrow = 77 USDC, debt = 70 → healthy
        assertTrue(_isPositionHealthy(borrower), "Should be healthy at original price");

        // Drop to 0.8e24: collateral value = 80 USDC, maxBorrow = 61.6 USDC, debt = 70 → unhealthy
        _updateOraclePrice(0.8e24);
        assertFalse(_isPositionHealthy(borrower), "Should be unhealthy after price drop");
    }

    /// @notice AC1: Different price drops affect liquidation behavior
    function test_priceDropSeverity_affectsLiquidationSize() public {
        // Setup two identical positions with separate borrowers for clean comparison
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        address borrower2 = address(0xFF);

        // Borrower 1: 100 ITP collateral, 70 USDC debt
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Borrower 2: identical position (manual setup — _setupBorrowPosition uses hardcoded borrower)
        itp.mint(borrower2, collateral);
        vm.startPrank(borrower2);
        itp.approve(address(morpho), collateral);
        morpho.supplyCollateral(marketParams, collateral, borrower2, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower2, borrower2);
        vm.stopPrank();

        usdc.mint(liquidator, 200e6);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);
        vm.stopPrank();

        // Mild price drop — liquidate 10 ITP from borrower1
        _updateOraclePrice(0.85e24);
        vm.startPrank(liquidator);
        (, uint256 repaid1) = morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();

        // Severe price drop — liquidate 10 ITP from borrower2 (independent position)
        _updateOraclePrice(0.6e24);
        vm.startPrank(liquidator);
        (, uint256 repaid2) = morpho.liquidate(marketParams, borrower2, 10e18, 0, "");
        vm.stopPrank();

        // At lower price, same ITP seized costs less USDC to repay
        assertTrue(repaid2 < repaid1, "Lower price should result in lower USDC repaid for same ITP seized");

        console.log("Mild drop (0.85) - repaid:", repaid1);
        console.log("Severe drop (0.6) - repaid:", repaid2);
    }

    /// @notice AC1: Oracle rejects zero price
    function test_priceDropToZero_prevented() public {
        vm.expectRevert(abi.encodeWithSignature("E095_InvalidOraclePrice()"));
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(0, block.timestamp, _nextCycleNumber, mockSig, 0x07);
    }

    // ============ TASK 7: SEED USDC APPROVAL AND TRACKING (AC #5) ============

    /// @notice AC5: Liquidator must approve Morpho before liquidation
    function test_seedUsdcApproval_beforeLiquidation() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.8e24);

        usdc.mint(liquidator, SEED_USDC);

        // Attempt liquidation WITHOUT approval — should revert
        vm.startPrank(liquidator);
        // Don't approve Morpho
        vm.expectRevert();
        morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();

        // Now approve and it should succeed
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();

        assertTrue(seized > 0, "Should seize ITP after approval");
        assertTrue(repaid > 0, "Should repay USDC");
    }

    /// @notice AC5: Track USDC spent, ITP seized, USDC recovered per iteration
    function test_seedUsdcTracking_perIteration() public {
        uint256 collateral = 200e18;
        uint256 borrowAmount = 140e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.7e24);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 totalUsdcSpent = 0;
        uint256 totalItpSeized = 0;
        uint256 totalUsdcRecovered = 0;

        // 3 iterations
        for (uint256 i = 0; i < 3; i++) {
            uint256 usdcBefore = usdc.balanceOf(liquidator);
            (uint256 seized,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
            uint256 usdcAfter = usdc.balanceOf(liquidator);

            uint256 spent = usdcBefore - usdcAfter;
            totalUsdcSpent += spent;
            totalItpSeized += seized;

            vm.stopPrank();
            // Simulate sell
            uint256 recovered = seized * 0.7e24 / 1e36;
            usdc.mint(liquidator, recovered);
            totalUsdcRecovered += recovered;
            vm.startPrank(liquidator);

            console.log("Iter", i + 1, "Spent:", spent);
            console.log("  Seized:", seized, "Recovered:", recovered);
        }

        vm.stopPrank();

        // Verify consistency: total recovered > total spent (profitable liquidation)
        assertTrue(totalUsdcRecovered > totalUsdcSpent, "Total recovered should exceed total spent");
        assertEq(totalItpSeized, 60e18, "Total ITP seized should be 3 * 20 = 60");

        // Verify approximate profit range (~2.9M expected for 3 iterations at 7.41% incentive)
        uint256 netProfit = totalUsdcRecovered - totalUsdcSpent;
        assertTrue(netProfit >= 2e6, "Net profit should be at least 2M USDC");
        assertTrue(netProfit <= 4e6, "Net profit should not exceed 4M USDC");

        console.log("=== Totals ===");
        console.log("Total USDC spent:", totalUsdcSpent);
        console.log("Total ITP seized:", totalItpSeized);
        console.log("Total USDC recovered:", totalUsdcRecovered);
        console.log("Net profit:", totalUsdcRecovered - totalUsdcSpent);
    }

    // ============ CODE REVIEW FIXES: ADDITIONAL EDGE CASE TESTS ============

    /// @notice H1: Verify liquidation fails when position has zero collateral
    function test_liquidation_zeroCollateral_reverts() public {
        // First, set up and fully liquidate a position
        uint256 collateral = 50e18;
        uint256 borrowAmount = 35e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.5e24); // Severe drop to enable full liquidation

        usdc.mint(liquidator, 200e6);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        // Liquidate all collateral
        morpho.liquidate(marketParams, borrower, collateral, 0, "");
        vm.stopPrank();

        // Verify collateral is now zero
        (,, uint128 remainingCollateral) = morpho.position(marketId, borrower);
        assertEq(remainingCollateral, 0, "Collateral should be zero after full liquidation");

        // Attempt to liquidate again — should revert (no collateral to seize)
        vm.startPrank(liquidator);
        vm.expectRevert(); // Morpho reverts when seizing from zero collateral
        morpho.liquidate(marketParams, borrower, 1e18, 0, "");
        vm.stopPrank();
    }

    /// @notice M1: Verify loop remains profitable even with realistic slippage on sell
    function test_iterativeLiquidationLoop_withSlippage_stillProfitable() public {
        uint256 collateral = 200e18;
        uint256 borrowAmount = 140e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 dropPrice = 0.7e24;
        _updateOraclePrice(dropPrice);

        usdc.mint(liquidator, SEED_USDC);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 totalUsdcSpent = 0;
        uint256 totalUsdcRecovered = 0;

        // Simulate 2% slippage on sell (98% of oracle price)
        uint256 slippageBps = 200; // 2%
        uint256 effectivePrice = dropPrice * (10000 - slippageBps) / 10000;

        // 3 iterations with slippage
        for (uint256 i = 0; i < 3; i++) {
            uint256 usdcBefore = usdc.balanceOf(liquidator);
            (uint256 seized,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
            uint256 usdcAfter = usdc.balanceOf(liquidator);

            totalUsdcSpent += (usdcBefore - usdcAfter);

            vm.stopPrank();
            // Simulate sell WITH SLIPPAGE
            uint256 recovered = seized * effectivePrice / 1e36;
            usdc.mint(liquidator, recovered);
            totalUsdcRecovered += recovered;
            vm.startPrank(liquidator);
        }

        vm.stopPrank();

        // Even with 2% slippage, liquidation should still be profitable
        // (7.41% incentive - 2% slippage = ~5.4% net profit)
        assertTrue(totalUsdcRecovered > totalUsdcSpent, "Should remain profitable even with 2% slippage");

        uint256 netProfit = totalUsdcRecovered - totalUsdcSpent;
        console.log("Net profit with 2% slippage:", netProfit);
    }

    /// @notice M2: Verify liquidation reverts when liquidator has insufficient USDC
    function test_liquidation_insufficientSeedUsdc_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.8e24);

        // Give liquidator only 1 USDC (insufficient for any liquidation)
        usdc.mint(liquidator, 1e6);
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);

        // Attempt to liquidate — should revert due to insufficient USDC balance
        vm.expectRevert(); // ERC20 transfer will fail
        morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();
    }

    /// @notice M3: Verify concurrent liquidators — second liquidator must adapt to remaining collateral
    function test_concurrentLiquidators_raceCondition() public {
        address liquidator2 = address(0xEF);

        // Use larger position with more severe price drop to ensure position stays unhealthy
        // throughout multiple partial liquidations
        uint256 collateral = 200e18;
        uint256 borrowAmount = 150e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePrice(0.6e24); // Severe drop ensures position stays unhealthy

        // Fund both liquidators
        usdc.mint(liquidator, 200e6);
        usdc.mint(liquidator2, 200e6);

        // Liquidator 1 approves and liquidates 80 ITP
        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized1,) = morpho.liquidate(marketParams, borrower, 80e18, 0, "");
        vm.stopPrank();

        assertEq(seized1, 80e18, "Liquidator 1 should seize 80 ITP");

        // Check remaining collateral after first liquidation
        (,, uint128 remainingAfterL1) = morpho.position(marketId, borrower);
        assertEq(remainingAfterL1, 120e18, "Should have 120 ITP remaining after L1");

        // Verify position is still unhealthy (so L2 can continue liquidating)
        assertFalse(_isPositionHealthy(borrower), "Position should still be unhealthy for L2");

        // Liquidator 2 queries remaining collateral and liquidates a portion
        vm.startPrank(liquidator2);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized2,) = morpho.liquidate(marketParams, borrower, 80e18, 0, "");
        vm.stopPrank();

        assertEq(seized2, 80e18, "Liquidator 2 should seize 80 ITP");

        // Verify both liquidators received ITP
        assertEq(itp.balanceOf(liquidator), 80e18, "Liquidator 1 should have 80 ITP");
        assertEq(itp.balanceOf(liquidator2), 80e18, "Liquidator 2 should have 80 ITP");

        // Verify remaining collateral
        (,, uint128 finalCollateral) = morpho.position(marketId, borrower);
        assertEq(finalCollateral, 40e18, "Should have 40 ITP remaining");
    }
}
