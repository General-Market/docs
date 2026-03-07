// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {IMorpho, MarketParams, Id, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MockMorphoOracle} from "../src/mocks/MockMorphoOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MorphoE2ETest - Integration tests for Morpho Blue deployment
/// @notice Verifies: deploy -> create market -> deposit -> borrow -> repay -> withdraw
/// @dev Story 8.5 AC#8: Round-trip sanity check for Morpho lending
contract MorphoE2ETest is Test {
    using MarketParamsLib for MarketParams;

    Morpho morpho;
    AdaptiveCurveIrm irm;
    MockMorphoOracle oracle;
    MetaMorpho vault;
    MockERC20 settlementUSDC;
    MockERC20 itpToken;

    MarketParams marketParams;
    Id marketId;

    address owner = address(this);
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");

    uint256 constant LLTV = 0.77e18;
    // 1 ITP = 100 USDC, precision = 36 + 6 - 18 = 24
    uint256 constant ORACLE_PRICE = 100e24;

    function setUp() public {
        // Deploy tokens
        settlementUSDC = new MockERC20("SettlementUSDC", "USDC", 6);
        itpToken = new MockERC20("ITP Vault", "ITP", 18);

        // Deploy Morpho core
        morpho = new Morpho(owner);

        // Deploy IRM
        irm = new AdaptiveCurveIrm(address(morpho));

        // Deploy oracle
        oracle = new MockMorphoOracle(ORACLE_PRICE);

        // Enable IRM and LLTV
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);

        // Create market
        marketParams = MarketParams({
            loanToken: address(settlementUSDC),
            collateralToken: address(itpToken),
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        marketId = marketParams.id();

        // Deploy MetaMorpho vault (MIN_TIMELOCK = 1 day enforced by MetaMorpho)
        vault = new MetaMorpho(
            owner,
            address(morpho),
            1 days,
            address(settlementUSDC),
            "Index ITP Lending Vault",
            "ilUSDC"
        );

        // Configure vault: set cap, warp past timelock, then accept
        vault.submitCap(marketParams, type(uint184).max);
        vm.warp(block.timestamp + 1 days);
        vault.acceptCap(marketParams);

        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = marketId;
        vault.setSupplyQueue(supplyQueue);

        // Fund lender and seed vault
        uint256 lenderAmount = 1_000_000 * 1e6; // 1M USDC
        settlementUSDC.mint(lender, lenderAmount);
        vm.startPrank(lender);
        settlementUSDC.approve(address(vault), lenderAmount);
        vault.deposit(lenderAmount, lender);
        vm.stopPrank();

        // Fund borrower with ITP collateral
        uint256 collateralAmount = 1000 * 1e18; // 1000 ITP
        itpToken.mint(borrower, collateralAmount);
    }

    function test_createMarket_succeeds() public view {
        // AC#4: createMarket succeeds with valid params, market ID queryable
        (uint128 totalSupplyAssets,,,, uint128 lastUpdate,) = morpho.market(marketId);
        assertGt(totalSupplyAssets, 0, "Market should have supply from vault deposit");
        assertGt(lastUpdate, 0, "Market should have been initialized");
    }

    function test_createMarket_paramsQueryable() public view {
        // AC#4: market params are queryable by ID
        (address loanToken, address collateralToken, address oracleAddr, address irmAddr, uint256 lltv) =
            morpho.idToMarketParams(marketId);
        assertEq(loanToken, address(settlementUSDC));
        assertEq(collateralToken, address(itpToken));
        assertEq(oracleAddr, address(oracle));
        assertEq(irmAddr, address(irm));
        assertEq(lltv, LLTV);
    }

    function test_vaultDeposit_mintsShares() public view {
        // AC#8: lender deposits USDC into vault -> shares minted
        uint256 lenderShares = vault.balanceOf(lender);
        assertGt(lenderShares, 0, "Lender should have vault shares");
    }

    function test_supplyCollateralAndBorrow() public {
        // AC#8: user supplies ITP collateral -> borrows USDC -> verify balances
        uint256 collateralAmount = 100 * 1e18; // 100 ITP
        // With 100 ITP at 100 USDC/ITP = 10,000 USDC collateral value
        // At 77% LLTV, max borrow = 7,700 USDC
        uint256 borrowAmount = 5000 * 1e6; // 5000 USDC (well within LLTV)

        vm.startPrank(borrower);

        // Supply collateral
        itpToken.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        // Verify collateral position
        (,, uint128 collateral) = morpho.position(marketId, borrower);
        assertEq(collateral, collateralAmount, "Collateral should be deposited");

        // Borrow USDC
        uint256 usdcBefore = settlementUSDC.balanceOf(borrower);
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        uint256 usdcAfter = settlementUSDC.balanceOf(borrower);

        assertEq(usdcAfter - usdcBefore, borrowAmount, "Should receive borrowed USDC");

        vm.stopPrank();
    }

    function test_repayAndWithdrawCollateral() public {
        // AC#8: user repays USDC -> withdrawCollateral -> verify ITP returned
        uint256 collateralAmount = 100 * 1e18;
        uint256 borrowAmount = 5000 * 1e6;

        vm.startPrank(borrower);

        // Setup: supply collateral and borrow
        itpToken.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);

        // Repay all borrowed USDC using share-based repay (robust against interest accrual)
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        settlementUSDC.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");
        // Verify borrow position is cleared
        (, uint128 remainingShares,) = morpho.position(marketId, borrower);
        assertEq(remainingShares, 0, "Borrow shares should be zero after full repay");

        // Withdraw collateral
        uint256 itpBefore = itpToken.balanceOf(borrower);
        morpho.withdrawCollateral(marketParams, collateralAmount, borrower, borrower);
        uint256 itpAfter = itpToken.balanceOf(borrower);

        assertEq(itpAfter - itpBefore, collateralAmount, "Should receive collateral back");

        vm.stopPrank();
    }

    function test_borrowExceedingLLTV_reverts() public {
        // AC#8: borrow exceeding LLTV reverts
        uint256 collateralAmount = 100 * 1e18; // 100 ITP
        // 100 ITP * 100 USDC/ITP = 10,000 USDC collateral value
        // At 77% LLTV, max borrow = 7,700 USDC
        uint256 excessiveBorrow = 8000 * 1e6; // 8000 USDC (exceeds 77%)

        vm.startPrank(borrower);

        itpToken.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        vm.expectRevert();
        morpho.borrow(marketParams, excessiveBorrow, 0, borrower, borrower);

        vm.stopPrank();
    }

    function test_oraclePrice_correctFormat() public view {
        // Verify oracle returns correctly formatted price
        uint256 p = oracle.price();
        assertEq(p, ORACLE_PRICE, "Oracle should return initial price");
    }

    function test_oraclePrice_updateable() public {
        // Verify owner can update oracle price
        uint256 newPrice = 50e24; // 1 ITP = 50 USDC
        oracle.setPrice(newPrice);
        assertEq(oracle.price(), newPrice, "Oracle price should be updated");
    }

    function test_vaultWithdrawal_succeeds() public {
        // Verify lender can withdraw USDC from MetaMorpho vault (completes round-trip)
        uint256 sharesBefore = vault.balanceOf(lender);
        assertGt(sharesBefore, 0, "Lender should have vault shares");

        uint256 withdrawAmount = 100_000 * 1e6; // 100k USDC
        vm.startPrank(lender);
        vault.withdraw(withdrawAmount, lender, lender);
        vm.stopPrank();

        uint256 usdcBalance = settlementUSDC.balanceOf(lender);
        assertEq(usdcBalance, withdrawAmount, "Lender should receive withdrawn USDC");
    }
}
