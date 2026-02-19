// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {IMorpho, MarketParams, Id, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

/// @title MorphoBorrowLendTest - Integration tests for Morpho Blue with real ITPNAVOracle
/// @notice Story 8.7: Full borrow/lend flow with BLS-verified oracle (not MockMorphoOracle)
/// @dev BLS verification uses real signatures via FFI bls-tool (seeds 0,1,2).
contract MorphoBorrowLendTest is TestHelper {
    using MarketParamsLib for MarketParams;

    Morpho morpho;
    AdaptiveCurveIrm irm;
    ITPNAVOracle oracle;
    MirrorIssuerRegistry mirror;
    MetaMorpho vault;
    MockERC20 arbUSDC;
    MockERC20 itpToken;

    MarketParams marketParams;
    Id marketId;

    address owner = address(this);
    address curator = makeAddr("curator");
    address allocator = makeAddr("allocator");
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");

    uint256 constant LLTV = 0.77e18;
    // 1 ITP = 100 USDC, precision = 36 + 6 - 18 = 24
    uint256 constant ORACLE_PRICE = 100e24;

    function setUp() public {
        // Set a reasonable block timestamp
        vm.warp(1_700_000_000);

        // Deploy tokens
        arbUSDC = new MockERC20("ArbUSDC", "USDC", 6);
        itpToken = new MockERC20("ITP Vault", "ITP", 18);

        // Deploy MirrorIssuerRegistry as UUPS proxy with real BLS aggregated pubkey
        bytes memory testPubkey = blsAggPubkey("0,1,2");
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (testPubkey, 2, 3, owner))
        );
        mirror = MirrorIssuerRegistry(address(proxy));

        // Deploy ITPNAVOracle with real BLS oracle
        oracle = new ITPNAVOracle(address(mirror), address(itpToken), ORACLE_PRICE);

        // Push initial BLS-signed price via updatePrice (cycle 1)
        {
            bytes32 h = keccak256(abi.encodePacked(address(itpToken), ORACLE_PRICE, block.timestamp, uint256(1)));
            bytes memory sig = signWithTestIssuers(h);
            oracle.updatePrice(ORACLE_PRICE, block.timestamp, 1, sig, 0x07);
        }

        // Deploy Morpho core
        morpho = new Morpho(owner);

        // Deploy IRM
        irm = new AdaptiveCurveIrm(address(morpho));

        // Enable IRM and LLTV
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);

        // Create market with real ITPNAVOracle
        marketParams = MarketParams({
            loanToken: address(arbUSDC),
            collateralToken: address(itpToken),
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        marketId = marketParams.id();

        // Deploy MetaMorpho vault
        vault = new MetaMorpho(
            owner,
            address(morpho),
            1 days,
            address(arbUSDC),
            "Index ITP Lending Vault",
            "ilUSDC"
        );

        // Set curator and allocator roles
        vault.setCurator(curator);
        vault.setIsAllocator(allocator, true);

        // Submit supply cap, warp past timelock, accept
        vault.submitCap(marketParams, type(uint184).max);
        vm.warp(block.timestamp + 1 days + 1);
        vault.acceptCap(marketParams);

        // Refresh oracle price after warp (otherwise price() reverts with E096_StaleOraclePrice)
        {
            bytes32 h2 = keccak256(abi.encodePacked(address(itpToken), ORACLE_PRICE, block.timestamp, uint256(2)));
            bytes memory sig2 = signWithTestIssuers(h2);
            oracle.updatePrice(ORACLE_PRICE, block.timestamp, 2, sig2, 0x07);
        }

        // Set supply queue
        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = marketId;
        vault.setSupplyQueue(supplyQueue);

        // Fund lender and seed vault with USDC
        uint256 lenderAmount = 1_000_000 * 1e6; // 1M USDC
        arbUSDC.mint(lender, lenderAmount);
        vm.startPrank(lender);
        arbUSDC.approve(address(vault), lenderAmount);
        vault.deposit(lenderAmount, lender);
        vm.stopPrank();

        // Fund borrower with ITP collateral
        uint256 collateralAmount = 1000 * 1e18; // 1000 ITP
        itpToken.mint(borrower, collateralAmount);
    }

    // ============ AC1: MARKET CREATION WITH BLS ORACLE ============

    function test_createMarket_withBLSOracle_succeeds() public view {
        // AC1: Market creation with ITPNAVOracle succeeds
        (uint128 totalSupplyAssets,,,, uint128 lastUpdate,) = morpho.market(marketId);
        assertGt(totalSupplyAssets, 0, "Market should have supply from vault deposit");
        assertGt(lastUpdate, 0, "Market should have been initialized");
    }

    function test_createMarket_deterministic_id() public {
        // AC1: Same MarketParams always produce same ID
        MarketParams memory sameParams = MarketParams({
            loanToken: address(arbUSDC),
            collateralToken: address(itpToken),
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });
        Id sameId = sameParams.id();
        assertEq(Id.unwrap(sameId), Id.unwrap(marketId), "Same params should produce same market ID");
    }

    // ============ AC2: METAMORPHO VAULT DEPLOYMENT ============

    function test_deployVault_success() public view {
        // AC2: MetaMorpho vault deployed with correct params
        assertEq(vault.name(), "Index ITP Lending Vault");
        assertEq(vault.symbol(), "ilUSDC");
        assertEq(vault.asset(), address(arbUSDC));
        assertEq(vault.timelock(), 1 days);
    }

    // ============ AC3: VAULT ROLES ============

    function test_vaultRoles_curator_allocator() public view {
        // AC3: Curator and allocator configured correctly
        assertEq(vault.curator(), curator, "Curator should be set");
        assertTrue(vault.isAllocator(allocator), "Allocator should be enabled");
    }

    // ============ AC4: SUPPLY CAP TIMELOCK ============

    function test_submitCap_and_acceptCap() public {
        // AC4: Submit cap, warp past timelock, accept cap
        // Deploy a second market to test cap submission flow
        MockERC20 itpToken2 = new MockERC20("ITP2", "ITP2", 18);
        ITPNAVOracle oracle2 = new ITPNAVOracle(address(mirror), address(itpToken2), ORACLE_PRICE);
        {
            bytes32 h = keccak256(abi.encodePacked(address(itpToken2), ORACLE_PRICE, block.timestamp, uint256(1)));
            oracle2.updatePrice(ORACLE_PRICE, block.timestamp, 1, signWithTestIssuers(h), 0x07);
        }

        MarketParams memory mp2 = MarketParams({
            loanToken: address(arbUSDC),
            collateralToken: address(itpToken2),
            oracle: address(oracle2),
            irm: address(irm),
            lltv: LLTV
        });
        morpho.createMarket(mp2);

        // Submit cap
        vault.submitCap(mp2, 500_000 * 1e6);

        // Warp past timelock
        vm.warp(block.timestamp + 1 days + 1);

        // Accept cap
        vault.acceptCap(mp2);

        // Verify cap is active by checking we can set supply queue including this market
        Id[] memory newQueue = new Id[](2);
        newQueue[0] = marketId;
        newQueue[1] = mp2.id();
        vault.setSupplyQueue(newQueue);
    }

    function test_submitCap_beforeTimelock_reverts() public {
        // AC4: Accepting cap before timelock should revert
        MockERC20 itpToken3 = new MockERC20("ITP3", "ITP3", 18);
        ITPNAVOracle oracle3 = new ITPNAVOracle(address(mirror), address(itpToken3), ORACLE_PRICE);
        {
            bytes32 h = keccak256(abi.encodePacked(address(itpToken3), ORACLE_PRICE, block.timestamp, uint256(1)));
            oracle3.updatePrice(ORACLE_PRICE, block.timestamp, 1, signWithTestIssuers(h), 0x07);
        }

        MarketParams memory mp3 = MarketParams({
            loanToken: address(arbUSDC),
            collateralToken: address(itpToken3),
            oracle: address(oracle3),
            irm: address(irm),
            lltv: LLTV
        });
        morpho.createMarket(mp3);

        vault.submitCap(mp3, 500_000 * 1e6);

        // Try to accept immediately (before timelock)
        vm.expectRevert();
        vault.acceptCap(mp3);
    }

    // ============ AC5: LENDER DEPOSIT ============

    function test_lenderDeposit_mintsShares() public view {
        // AC5: Lender deposits USDC, receives vault shares
        uint256 lenderShares = vault.balanceOf(lender);
        assertGt(lenderShares, 0, "Lender should have vault shares");
    }

    function test_lenderDeposit_fundsAvailable() public view {
        // AC5: Deposited USDC available for borrowing via Morpho
        (uint128 totalSupplyAssets,,,,, ) = morpho.market(marketId);
        assertGt(totalSupplyAssets, 0, "Market should have USDC supply available for borrowing");
    }

    // ============ AC7: BLS ORACLE INTEGRATION ============

    function test_supplyCollateralAndBorrow_withBLSOracle() public {
        // AC7 + full borrow flow with BLS-verified oracle pricing
        uint256 collateralAmount = 100 * 1e18; // 100 ITP
        // 100 ITP at 100 USDC/ITP = 10,000 USDC collateral value
        // At 77% LLTV, max borrow = 7,700 USDC
        uint256 borrowAmount = 5000 * 1e6; // 5000 USDC

        vm.startPrank(borrower);

        // Supply collateral
        itpToken.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");

        // Verify collateral position
        (,, uint128 collateral) = morpho.position(marketId, borrower);
        assertEq(collateral, collateralAmount, "Collateral should be deposited");

        // Borrow USDC
        uint256 usdcBefore = arbUSDC.balanceOf(borrower);
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);
        uint256 usdcAfter = arbUSDC.balanceOf(borrower);

        assertEq(usdcAfter - usdcBefore, borrowAmount, "Should receive borrowed USDC");

        vm.stopPrank();
    }

    function test_repayAndWithdrawCollateral() public {
        // Full repay → withdraw round-trip
        uint256 collateralAmount = 100 * 1e18;
        uint256 borrowAmount = 5000 * 1e6;

        vm.startPrank(borrower);

        // Setup: supply collateral and borrow
        itpToken.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        morpho.borrow(marketParams, borrowAmount, 0, borrower, borrower);

        // Repay all borrowed USDC (share-based for interest accrual robustness)
        (, uint128 borrowShares,) = morpho.position(marketId, borrower);
        arbUSDC.approve(address(morpho), type(uint256).max);
        morpho.repay(marketParams, 0, borrowShares, borrower, "");

        // Verify borrow position cleared
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
        // LLTV enforcement with BLS oracle
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

    function test_oracleUpdate_changesCollateralValue() public {
        // Update oracle price, verify borrow capacity changes
        uint256 collateralAmount = 100 * 1e18; // 100 ITP

        vm.startPrank(borrower);
        itpToken.approve(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, borrower, "");
        vm.stopPrank();

        // At 100 USDC/ITP: collateral = 10,000 USDC, max borrow = 7,700 USDC
        // Borrow 5000 should work
        vm.prank(borrower);
        morpho.borrow(marketParams, 5000 * 1e6, 0, borrower, borrower);

        // Drop price to 50 USDC/ITP via oracle update
        {
            bytes32 h = keccak256(abi.encodePacked(address(itpToken), uint256(50e24), block.timestamp, uint256(3)));
            oracle.updatePrice(50e24, block.timestamp, 3, signWithTestIssuers(h), 0x07);
        }

        // At 50 USDC/ITP: collateral = 5,000 USDC, max borrow = 3,850 USDC
        // Already borrowed 5000, so trying to borrow more should fail
        vm.prank(borrower);
        vm.expectRevert();
        morpho.borrow(marketParams, 1 * 1e6, 0, borrower, borrower);
    }

    function test_supplyQueue_setsMarket() public view {
        // Supply queue directs USDC to ITP market
        uint256 queueLength = vault.supplyQueueLength();
        assertEq(queueLength, 1, "Should have one market in supply queue");

        Id queueMarket = vault.supplyQueue(0);
        assertEq(Id.unwrap(queueMarket), Id.unwrap(marketId), "Supply queue should point to ITP market");
    }

    function test_vaultWithdrawal_succeeds() public {
        // Lender can withdraw USDC from vault
        uint256 sharesBefore = vault.balanceOf(lender);
        assertGt(sharesBefore, 0, "Lender should have vault shares");

        uint256 withdrawAmount = 100_000 * 1e6; // 100k USDC
        vm.startPrank(lender);
        vault.withdraw(withdrawAmount, lender, lender);
        vm.stopPrank();

        uint256 usdcBalance = arbUSDC.balanceOf(lender);
        assertEq(usdcBalance, withdrawAmount, "Lender should receive withdrawn USDC");
    }
}
