// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Id, MarketParams, Position, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {SharesMathLib} from "@morpho-blue/libraries/SharesMathLib.sol";
import {MathLib} from "@morpho-blue/libraries/MathLib.sol";
import "./helpers/MorphoTestHelper.sol";

/// @title MorphoBorrowFlow.t.sol - Tests for Story 8.8
/// @notice Tests the complete ITP deposit → USDC borrow flow on Morpho Blue
contract MorphoBorrowFlowTest is MorphoTestHelper {
    using MarketParamsLib for MarketParams;

    function setUp() public {
        _deployMorphoStack();
    }

    // ============ TASK 4: SUPPLY COLLATERAL TESTS (AC #1) ============

    /// @notice AC1: User approves ITP, supplies collateral, ITP transferred, collateral recorded
    function test_supplyCollateral_depositsITP() public {
        uint256 depositAmount = 100e18;

        uint256 userItpBefore = itp.balanceOf(borrower);
        uint256 morphoItpBefore = itp.balanceOf(address(morpho));

        vm.startPrank(borrower);
        itp.approve(address(morpho), depositAmount);
        morpho.supplyCollateral(marketParams, depositAmount, borrower, "");
        vm.stopPrank();

        // Verify ITP transferred from user to Morpho
        assertEq(itp.balanceOf(borrower), userItpBefore - depositAmount, "User ITP should decrease");
        assertEq(itp.balanceOf(address(morpho)), morphoItpBefore + depositAmount, "Morpho ITP should increase");

        // Verify collateral balance recorded in Morpho position
        (,, uint128 collateral) = morpho.position(marketId, borrower);
        assertEq(collateral, depositAmount, "Collateral should be recorded in position");

        console.log("Deposited ITP:", depositAmount);
        console.log("User ITP balance after:", itp.balanceOf(borrower));
        console.log("Morpho ITP balance:", itp.balanceOf(address(morpho)));
    }

    /// @notice AC1: Multiple deposits accumulate collateral
    function test_supplyCollateral_multipleDeposits() public {
        uint256 firstDeposit = 50e18;
        uint256 secondDeposit = 30e18;

        vm.startPrank(borrower);
        itp.approve(address(morpho), firstDeposit + secondDeposit);

        morpho.supplyCollateral(marketParams, firstDeposit, borrower, "");
        (,, uint128 collateralAfterFirst) = morpho.position(marketId, borrower);
        assertEq(collateralAfterFirst, firstDeposit, "First deposit collateral");

        morpho.supplyCollateral(marketParams, secondDeposit, borrower, "");
        (,, uint128 collateralAfterSecond) = morpho.position(marketId, borrower);
        assertEq(collateralAfterSecond, firstDeposit + secondDeposit, "Total collateral is sum");

        vm.stopPrank();

        console.log("First deposit:", firstDeposit);
        console.log("Second deposit:", secondDeposit);
        console.log("Total collateral:", collateralAfterSecond);
    }

    /// @notice AC1: ITP balance changes verified at both ends
    function test_supplyCollateral_balancesCorrect() public {
        uint256 depositAmount = 200e18;

        uint256 userBefore = itp.balanceOf(borrower);
        uint256 morphoBefore = itp.balanceOf(address(morpho));

        vm.startPrank(borrower);
        itp.approve(address(morpho), depositAmount);
        morpho.supplyCollateral(marketParams, depositAmount, borrower, "");
        vm.stopPrank();

        assertEq(itp.balanceOf(borrower), userBefore - depositAmount);
        assertEq(itp.balanceOf(address(morpho)), morphoBefore + depositAmount);
    }

    // ============ TASK 5: BORROW TESTS (AC #2) ============

    /// @notice AC2: User with collateral borrows USDC within LLTV
    function test_borrow_withinLLTV() public {
        uint256 collateralAmount = 100e18;
        // With 100 ITP at price 1e24 and 77% LLTV:
        // Max borrow = (100e18 * 1e24 / 1e36) * 0.77 = 100e6 * 0.77 = 77e6 USDC
        // Borrow conservatively: 50 USDC
        uint256 borrowAmount = 50e6;

        // Supply collateral
        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        // Record USDC balances before borrow
        uint256 userUsdcBefore = usdc.balanceOf(borrower);

        // Borrow USDC
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        // Verify USDC transferred to user
        uint256 userUsdcAfter = usdc.balanceOf(borrower);
        assertEq(userUsdcAfter, userUsdcBefore + borrowAmount, "User should receive borrowed USDC");

        // Verify borrow shares recorded
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        assertTrue(borrowShares > 0, "Borrow shares should be recorded");

        // Verify market state: totalBorrowAssets increased
        (,, uint128 totalBorrowAssets,,,) = morpho.market(marketId);
        assertEq(totalBorrowAssets, borrowAmount, "Market total borrow should equal borrowed amount");

        console.log("Collateral deposited:", collateralAmount);
        console.log("USDC borrowed:", borrowAmount);
        console.log("Borrow shares:", borrowShares);
        console.log("User USDC balance:", userUsdcAfter);
    }

    /// @notice AC2: Verify user's USDC balance increases by exact borrow amount
    function test_borrow_usdcBalanceIncreases() public {
        uint256 collateralAmount = 500e18;
        uint256 borrowAmount = 200e6;

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        uint256 usdcBefore = usdc.balanceOf(borrower);
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        assertEq(usdc.balanceOf(borrower), usdcBefore + borrowAmount, "USDC balance increase must match borrow amount");
    }

    /// @notice AC2: Vault's total USDC decreases by borrow amount
    function test_borrow_vaultSupplyDecreases() public {
        uint256 collateralAmount = 500e18;
        uint256 borrowAmount = 100e6;

        // Get initial market supply
        (uint128 totalSupplyBefore,,,,,) = morpho.market(marketId);

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        // After borrow: totalBorrowAssets should increase
        (uint128 totalSupplyAfter,, uint128 totalBorrowAfter,,,) = morpho.market(marketId);
        // Supply stays the same (supply is total deposited, not available)
        assertEq(totalSupplyAfter, totalSupplyBefore, "Total supply doesn't change on borrow");
        assertEq(totalBorrowAfter, borrowAmount, "Total borrow reflects borrowed amount");

        // Available liquidity decreased
        uint256 availableBefore = totalSupplyBefore;
        uint256 availableAfter = totalSupplyAfter - totalBorrowAfter;
        assertEq(availableBefore - availableAfter, borrowAmount, "Available liquidity decreased by borrow amount");

        console.log("Total supply before:", totalSupplyBefore);
        console.log("Total supply after:", totalSupplyAfter);
        console.log("Total borrow:", totalBorrowAfter);
        console.log("Available liquidity:", availableAfter);
    }

    /// @notice AC2: Health factor > 1.0 after borrow within LLTV
    function test_borrow_healthFactorAboveOne() public {
        uint256 collateralAmount = 100e18;
        uint256 borrowAmount = 50e6; // Well within 77% LLTV

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        // Calculate health factor manually
        // collateral value in USDC = collateral * oracle_price / 1e36
        // = 100e18 * 1e24 / 1e36 = 100e6
        // max borrow = collateral_value_usdc * LLTV / 1e18 = 100e6 * 0.77e18 / 1e18 = 77e6
        // health factor = (collateral_value * LLTV) / debt
        // = (100e6 * 0.77) / 50e6 = 77/50 = 1.54
        uint256 collateralValueUsdc = (collateralAmount * ORACLE_PRICE) / 1e36;
        uint256 maxBorrow = (collateralValueUsdc * LLTV) / 1e18;
        uint256 healthFactor = (maxBorrow * 1e18) / borrowAmount; // in WAD

        assertTrue(healthFactor > 1e18, "Health factor should be > 1.0");
        console.log("Collateral value (USDC):", collateralValueUsdc);
        console.log("Max borrow:", maxBorrow);
        console.log("Actual borrow:", borrowAmount);
        console.log("Health factor (WAD):", healthFactor);
    }

    // ============ TASK 6: BORROW EXCEEDING LLTV TESTS (AC #3) ============

    /// @notice AC3: Borrow exceeding LLTV reverts
    function test_borrow_exceedsLLTV_reverts() public {
        uint256 collateralAmount = 10e18; // 10 ITP
        // Max borrow with 10 ITP at 1:1 price and 77% LLTV = 7.7 USDC
        uint256 excessiveBorrow = 8e6; // 8 USDC > 7.7 USDC limit

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        // Attempt to borrow more than LLTV allows — should revert
        vm.expectRevert(bytes("insufficient collateral"));
        morpho.borrow(marketParams, excessiveBorrow, 0, borrower, borrower);
        vm.stopPrank();
    }

    /// @notice AC3: Borrow exactly at LLTV boundary
    function test_borrow_exactlyAtLLTV() public {
        uint256 collateralAmount = 100e18;
        // Max borrow = 100e18 * 1e24 / 1e36 * 0.77e18 / 1e18 = 77e6
        // Actually Morpho does: maxBorrow = (collateral * price * LLTV) / (WAD * ORACLE_SCALE)
        // Let's borrow exactly 77 USDC
        uint256 maxBorrow = 77e6;

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        // Borrow exactly at max — should succeed (Morpho allows <= LLTV)
        morpho.borrow(marketParams, maxBorrow, 0, borrower, borrower);
        vm.stopPrank();

        assertEq(usdc.balanceOf(borrower), maxBorrow, "Should borrow exactly at LLTV");
    }

    /// @notice AC3: Borrow 1 wei over LLTV boundary reverts
    function test_borrow_oneWeiOverLLTV_reverts() public {
        uint256 collateralAmount = 100e18;
        // Max is 77e6, try 77e6 + 1
        uint256 overMax = 77e6 + 1;

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        vm.expectRevert(bytes("insufficient collateral"));
        morpho.borrow(marketParams, overMax, 0, borrower, borrower);
        vm.stopPrank();
    }

    // ============ TASK 7: POSITION QUERY TESTS (AC #4) ============

    /// @notice AC4: Query position after deposit + borrow returns correct values
    function test_position_query() public {
        uint256 collateralAmount = 100e18;
        uint256 borrowAmount = 50e6;

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        (uint256 supplyShares, uint128 borrowShares, uint128 collateral) = morpho.position(marketId, borrower);

        assertEq(collateral, collateralAmount, "Position collateral should match deposit");
        assertTrue(borrowShares > 0, "Position borrow shares should be non-zero");
        assertEq(supplyShares, 0, "Borrower should have no supply shares");

        console.log("Position - collateral:", collateral);
        console.log("Position - borrowShares:", borrowShares);
        console.log("Position - supplyShares:", supplyShares);
    }

    /// @notice AC4: Position returns zero before any interaction
    function test_position_zeroBeforeInteraction() public view {
        (uint256 supplyShares, uint128 borrowShares, uint128 collateral) = morpho.position(marketId, borrower);

        assertEq(supplyShares, 0, "No supply shares before interaction");
        assertEq(borrowShares, 0, "No borrow shares before interaction");
        assertEq(collateral, 0, "No collateral before interaction");
    }

    // ============ TASK 8: FULL ROUND-TRIP INTEGRATION TEST (AC #5) ============

    /// @notice AC5: Full borrow flow e2e: approve → supplyCollateral → borrow → verify all
    function test_fullBorrowFlow_e2e() public {
        uint256 collateralAmount = 500e18;
        uint256 borrowAmount = 200e6;

        console.log("=== Full Borrow Flow E2E ===");

        // Record all initial states
        uint256 userItpBefore = itp.balanceOf(borrower);
        uint256 userUsdcBefore = usdc.balanceOf(borrower);
        uint256 morphoItpBefore = itp.balanceOf(address(morpho));
        (uint128 totalSupplyBefore,,,,,) = morpho.market(marketId);

        console.log("Initial user ITP:", userItpBefore);
        console.log("Initial user USDC:", userUsdcBefore);
        console.log("Initial Morpho ITP:", morphoItpBefore);
        console.log("Initial market supply:", totalSupplyBefore);

        // Step 1: Approve
        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);

        // Step 2: Supply collateral
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        console.log("After supplyCollateral:");
        console.log("  User ITP:", itp.balanceOf(borrower));
        console.log("  Morpho ITP:", itp.balanceOf(address(morpho)));

        // Step 3: Borrow USDC
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        console.log("After borrow:");
        console.log("  User USDC:", usdc.balanceOf(borrower));

        // Verify final states
        // User should have: ITP reduced, USDC increased
        assertEq(itp.balanceOf(borrower), userItpBefore - collateralAmount, "User ITP reduced by collateral");
        assertEq(usdc.balanceOf(borrower), userUsdcBefore + borrowAmount, "User USDC increased by borrow");

        // ITP locked in Morpho
        assertEq(
            itp.balanceOf(address(morpho)), morphoItpBefore + collateralAmount, "ITP locked in Morpho"
        );

        // Debt recorded
        (, uint128 borrowShares, uint128 collateral) = morpho.position(marketId, borrower);
        assertEq(collateral, collateralAmount, "Collateral recorded");
        assertTrue(borrowShares > 0, "Debt recorded");

        // Vault accounting: supply unchanged, borrow increased
        (uint128 totalSupplyAfter,, uint128 totalBorrowAfter,,,) = morpho.market(marketId);
        assertEq(totalSupplyAfter, totalSupplyBefore, "Supply unchanged after borrow");
        assertEq(totalBorrowAfter, borrowAmount, "Borrow reflects amount");

        console.log("=== E2E Verification Complete ===");
        console.log("Collateral locked:", collateral);
        console.log("Borrow shares:", borrowShares);
        console.log("Market totalBorrow:", totalBorrowAfter);
    }

    /// @notice AC5: Vault total assets accounting is consistent
    function test_fullBorrowFlow_vaultAccountingConsistent() public {
        uint256 collateralAmount = 300e18;
        uint256 borrowAmount = 100e6;

        vm.startPrank(borrower);
        itp.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        vm.stopPrank();

        // Check market-level accounting
        (
            uint128 totalSupplyAssets,
            uint128 totalSupplyShares,
            uint128 totalBorrowAssets,
            uint128 totalBorrowShares,
            ,
        ) = morpho.market(marketId);

        // Total supply should still be LENDER_USDC (supply doesn't decrease on borrow)
        assertEq(totalSupplyAssets, LENDER_USDC, "Total supply assets unchanged");
        assertTrue(totalSupplyShares > 0, "Total supply shares recorded");

        // Total borrow should match what was borrowed
        assertEq(totalBorrowAssets, borrowAmount, "Total borrow matches");
        assertTrue(totalBorrowShares > 0, "Total borrow shares recorded");

        // Available liquidity = supply - borrow
        uint256 availableLiquidity = totalSupplyAssets - totalBorrowAssets;
        assertEq(availableLiquidity, LENDER_USDC - borrowAmount, "Available liquidity correct");

        console.log("Supply assets:", totalSupplyAssets);
        console.log("Supply shares:", totalSupplyShares);
        console.log("Borrow assets:", totalBorrowAssets);
        console.log("Borrow shares:", totalBorrowShares);
        console.log("Available liquidity:", availableLiquidity);
    }
}
