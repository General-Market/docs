// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Id, MarketParams, Position, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import "./helpers/MorphoTestHelper.sol";

/// @title MorphoRepayFlow.t.sol - Tests for Story 8.9
/// @notice Tests the complete repay USDC → withdraw ITP collateral flow on Morpho Blue
contract MorphoRepayFlowTest is MorphoTestHelper {
    using MarketParamsLib for MarketParams;

    function setUp() public {
        _deployMorphoStack();
    }

    // ============ TASK 2: REPAY USDC TESTS (AC #1) ============

    /// @notice AC1: Repay a fixed USDC amount, verify borrow shares decrease
    function test_repay_assetBased_reducesDebt() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        (, uint128 sharesBefore,) = morpho.position(marketId, borrower);
        assertTrue(sharesBefore > 0, "Should have borrow shares");

        uint256 repayAmount = 25e6; // repay half

        vm.startPrank(borrower);
        usdc.approve(address(morpho), repayAmount);
        morpho.repay(marketParams, repayAmount, 0, borrower, "");
        vm.stopPrank();

        (, uint128 sharesAfter,) = morpho.position(marketId, borrower);
        assertTrue(sharesAfter < sharesBefore, "Borrow shares should decrease after repay");
        assertTrue(sharesAfter > 0, "Should still have some borrow shares (partial repay)");
    }

    /// @notice AC1: Share-based repay clears all debt
    function test_repay_shareBased_clearsAllDebt() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        assertTrue(borrowShares > 0, "Should have borrow shares");

        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");
        vm.stopPrank();

        (, uint128 remainingShares,) = morpho.position(marketId, borrower);
        assertEq(remainingShares, 0, "Borrow shares should be zero after share-based full repay");
    }

    /// @notice AC1: Partial repay reduces debt proportionally
    function test_repay_partial_reducesDebtProportionally() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        (, uint128 sharesBefore,) = morpho.position(marketId, borrower);

        // Repay half
        uint256 repayAmount = 25e6;
        vm.startPrank(borrower);
        usdc.approve(address(morpho), repayAmount);
        morpho.repay(marketParams, repayAmount, 0, borrower, "");
        vm.stopPrank();

        (, uint128 sharesAfter,) = morpho.position(marketId, borrower);
        assertTrue(sharesAfter < sharesBefore, "Shares should decrease");

        // Verify remaining debt tracked in market
        // Note: exact equality holds because single borrower + no time warp = zero interest
        (,, uint128 totalBorrowAssets,,,) = morpho.market(marketId);
        assertEq(totalBorrowAssets, borrowAmount - repayAmount, "Remaining borrow should equal original minus repaid");
    }

    /// @notice AC1: User USDC balance decreases by exact repay amount
    function test_repay_usdcTransferredFromUser() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 usdcBefore = usdc.balanceOf(borrower);
        uint256 repayAmount = 30e6;

        vm.startPrank(borrower);
        usdc.approve(address(morpho), repayAmount);
        morpho.repay(marketParams, repayAmount, 0, borrower, "");
        vm.stopPrank();

        uint256 usdcAfter = usdc.balanceOf(borrower);
        assertEq(usdcBefore - usdcAfter, repayAmount, "User USDC should decrease by exact repay amount");
    }

    /// @notice AC1: Asset-based repay of more than owed reverts (use share-based for exact clearing)
    function test_repay_moreThanOwed_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 excessRepay = 100e6; // 2x the debt

        vm.startPrank(borrower);
        usdc.approve(address(morpho), excessRepay);
        vm.expectRevert();
        morpho.repay(marketParams, excessRepay, 0, borrower, "");
        vm.stopPrank();
    }

    // ============ TASK 3: WITHDRAW COLLATERAL AFTER FULL REPAY (AC #2) ============

    /// @notice AC2: Share-based full repay → withdrawCollateral succeeds, ITP returned
    function test_withdrawCollateral_afterFullRepay_succeeds() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        // Full repay (share-based)
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");

        // Verify debt cleared
        (, uint128 remaining,) = morpho.position(marketId, borrower);
        assertEq(remaining, 0, "Debt should be cleared");

        // Withdraw all collateral
        uint256 itpBefore = itp.balanceOf(borrower);
        morpho.withdrawCollateral(marketParams, collateral, borrower, borrower);
        vm.stopPrank();

        uint256 itpAfter = itp.balanceOf(borrower);
        assertEq(itpAfter - itpBefore, collateral, "ITP should be returned to user");
    }

    /// @notice AC2: Verify ITP balances at both user and Morpho
    function test_withdrawCollateral_itpBalancesCorrect() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 morphoItpBefore = itp.balanceOf(address(morpho));

        // Full repay + withdraw
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");
        morpho.withdrawCollateral(marketParams, collateral, borrower, borrower);
        vm.stopPrank();

        assertEq(itp.balanceOf(address(morpho)), morphoItpBefore - collateral, "Morpho ITP should decrease");
        assertEq(itp.balanceOf(borrower), BORROWER_ITP, "User should have original ITP balance restored");
    }

    /// @notice AC2: After full repay + full withdraw, position is (0, 0, 0)
    function test_withdrawCollateral_positionCleared() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        // Full repay + withdraw
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");
        morpho.withdrawCollateral(marketParams, collateral, borrower, borrower);
        vm.stopPrank();

        (uint256 supplyShares, uint128 remainBorrow, uint128 remainCollateral) = morpho.position(marketId, borrower);
        assertEq(supplyShares, 0, "Supply shares should be 0");
        assertEq(remainBorrow, 0, "Borrow shares should be 0");
        assertEq(remainCollateral, 0, "Collateral should be 0");
    }

    // ============ TASK 4: WITHDRAW BLOCKED WHEN UNHEALTHY (AC #3) ============

    /// @notice AC3: Withdraw all collateral with debt remaining reverts
    function test_withdrawCollateral_allWithDebt_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        // Try to withdraw ALL collateral without repaying
        vm.startPrank(borrower);
        vm.expectRevert(bytes("insufficient collateral"));
        morpho.withdrawCollateral(marketParams, collateral, borrower, borrower);
        vm.stopPrank();
    }

    /// @notice AC3: Withdraw that pushes health factor below 1.0 reverts
    function test_withdrawCollateral_exceedsHealthFactor_reverts() public {
        uint256 collateral = 100e18;
        // Borrow near LLTV: 77 USDC max, borrow 50 to leave some room
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        // With 50 USDC debt, minimum collateral = 50 / 0.77 ≈ 64.93 ITP
        // Withdrawing 36 ITP would leave 64 ITP → just under threshold → should revert
        uint256 withdrawAmount = 36e18;

        vm.startPrank(borrower);
        vm.expectRevert(bytes("insufficient collateral"));
        morpho.withdrawCollateral(marketParams, withdrawAmount, borrower, borrower);
        vm.stopPrank();
    }

    // ============ TASK 5: PARTIAL WITHDRAW WITH HEALTHY POSITION (AC #4) ============

    /// @notice AC4: Partial withdraw within health factor succeeds
    function test_withdrawCollateral_partial_withinHealthFactor_succeeds() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        // Withdraw 30 ITP: leaves 70 ITP
        // 70 ITP * 0.77 = 53.9 USDC max debt → 50 USDC actual → HF = 53.9/50 = 1.078 → healthy
        uint256 withdrawAmount = 30e18;

        uint256 itpBefore = itp.balanceOf(borrower);
        vm.startPrank(borrower);
        morpho.withdrawCollateral(marketParams, withdrawAmount, borrower, borrower);
        vm.stopPrank();

        uint256 itpAfter = itp.balanceOf(borrower);
        assertEq(itpAfter - itpBefore, withdrawAmount, "Partial ITP should be returned");
    }

    /// @notice AC4: Position updated after partial withdraw
    function test_withdrawCollateral_partial_positionUpdated() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        (, uint128 borrowSharesBefore,) = morpho.position(marketId, borrower);

        uint256 withdrawAmount = 30e18;
        vm.startPrank(borrower);
        morpho.withdrawCollateral(marketParams, withdrawAmount, borrower, borrower);
        vm.stopPrank();

        (uint256 supplyShares, uint128 borrowSharesAfter, uint128 remainingCollateral) = morpho.position(marketId, borrower);
        assertEq(remainingCollateral, collateral - withdrawAmount, "Collateral should reflect reduction");
        assertEq(borrowSharesAfter, borrowSharesBefore, "Borrow shares unchanged by collateral withdrawal");
        assertEq(supplyShares, 0, "No supply shares");
    }

    /// @notice AC4: Partial withdraw → full repay → withdraw remaining
    function test_withdrawCollateral_partial_thenRepayAndWithdrawRest() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6;
        _setupBorrowPosition(collateral, borrowAmount);

        vm.startPrank(borrower);

        // Step 1: Partial withdraw (30 ITP)
        morpho.withdrawCollateral(marketParams, 30e18, borrower, borrower);

        // Verify partial state
        (,, uint128 collAfterPartial) = morpho.position(marketId, borrower);
        assertEq(collAfterPartial, 70e18, "70 ITP remaining after partial withdraw");

        // Step 2: Full repay (share-based)
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");

        // Step 3: Withdraw remaining collateral
        morpho.withdrawCollateral(marketParams, 70e18, borrower, borrower);
        vm.stopPrank();

        // Verify all ITP returned
        assertEq(itp.balanceOf(borrower), BORROWER_ITP, "All ITP should be returned");

        // Verify position fully cleared
        (uint256 ss, uint128 bs, uint128 c) = morpho.position(marketId, borrower);
        assertEq(ss, 0, "Supply shares = 0");
        assertEq(bs, 0, "Borrow shares = 0");
        assertEq(c, 0, "Collateral = 0");
    }

    // ============ TASK 6: FULL ROUND-TRIP WITH INTEREST (AC #5) ============

    /// @notice AC5: Full round-trip: deposit → borrow → warp → repay → withdraw
    function test_fullRoundTrip_depositBorrowRepayWithdraw() public {
        uint256 collateral = 500e18;
        uint256 borrowAmount = 200e6;

        // Mint extra USDC to borrower to cover interest on repay
        usdc.mint(borrower, 1e6);

        uint256 itpBefore = itp.balanceOf(borrower);
        uint256 usdcBefore = usdc.balanceOf(borrower);

        // Step 1: Setup borrow position
        _setupBorrowPosition(collateral, borrowAmount);

        // Step 2: Warp 7 days for interest accrual
        vm.warp(block.timestamp + 7 days);

        // Step 3: Accrue interest
        morpho.accrueInterest(marketParams);

        // Step 4: Full repay (share-based to handle interest)
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 assetsRepaid,) = morpho.repay(marketParams, 0, borrowShares, borrower, "");
        vm.stopPrank();

        // Repaid amount should exceed original borrow due to interest
        assertTrue(assetsRepaid >= borrowAmount, "Repaid amount should be >= original borrow (interest accrued)");

        // Step 5: Withdraw all collateral
        vm.startPrank(borrower);
        morpho.withdrawCollateral(marketParams, collateral, borrower, borrower);
        vm.stopPrank();

        // Verify ITP fully restored
        assertEq(itp.balanceOf(borrower), itpBefore, "ITP balance should be fully restored");

        // Verify USDC reduced by interest (user started with usdcBefore which includes extra mint)
        uint256 usdcAfter = usdc.balanceOf(borrower);
        // User got `borrowAmount` from borrow, then paid `assetsRepaid` back
        uint256 interestPaid = assetsRepaid - borrowAmount;
        assertEq(usdcAfter, usdcBefore + borrowAmount - assetsRepaid, "USDC should be reduced by interest");
        assertTrue(interestPaid > 0, "Some interest should have accrued over 7 days");
        assertTrue(interestPaid < 1e6, "Interest over 7 days on 200 USDC should be < 1 USDC");
    }

    /// @notice AC5: Interest accrues after warp, totalBorrowAssets increases
    function test_fullRoundTrip_interestAccrues() public {
        uint256 collateral = 500e18;
        uint256 borrowAmount = 200e6;

        // Mint extra USDC to borrower to cover interest on repay
        usdc.mint(borrower, 1e6);

        _setupBorrowPosition(collateral, borrowAmount);

        // Record market state before warp
        (,, uint128 borrowBefore,,,) = morpho.market(marketId);
        assertEq(borrowBefore, borrowAmount, "Initial borrow should match");

        // Warp 7 days
        vm.warp(block.timestamp + 7 days);
        morpho.accrueInterest(marketParams);

        // Verify interest accrued
        (,, uint128 borrowAfter,,,) = morpho.market(marketId);
        assertTrue(borrowAfter > borrowBefore, "totalBorrowAssets should increase with interest");

        uint256 interestAccrued = borrowAfter - borrowBefore;
        assertTrue(interestAccrued > 0, "Interest should accrue over 7 days");

        // Verify share-based repay costs more than original
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 assetsRepaid,) = morpho.repay(marketParams, 0, borrowShares, borrower, "");
        vm.stopPrank();

        assertTrue(assetsRepaid > borrowAmount, "Share-based repay should cost more than original borrow");
        assertTrue(interestAccrued < 1e6, "Interest over 7 days on 200 USDC should be < 1 USDC");
    }

    /// @notice AC5: After full repay, market accounting is consistent
    function test_fullRoundTrip_marketAccountingConsistent() public {
        uint256 collateral = 500e18;
        uint256 borrowAmount = 200e6;

        // Mint extra USDC to borrower to cover interest on repay
        usdc.mint(borrower, 1e6);

        _setupBorrowPosition(collateral, borrowAmount);

        // Warp and accrue
        vm.warp(block.timestamp + 7 days);
        morpho.accrueInterest(marketParams);

        // Full repay
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        vm.startPrank(borrower);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");
        vm.stopPrank();

        // Verify market state
        (uint128 totalSupplyAssets,, uint128 totalBorrowAssets,,,) = morpho.market(marketId);
        assertEq(totalBorrowAssets, 0, "Total borrow should be 0 after full repay");
        assertTrue(totalSupplyAssets >= LENDER_USDC, "Supply should include earned interest");
        assertTrue(totalSupplyAssets - LENDER_USDC < 1e6, "Interest earned should be < 1 USDC for 7 days");
    }
}
