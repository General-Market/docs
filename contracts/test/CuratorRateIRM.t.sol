// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Morpho, Id, MarketParams, Market} from "@morpho-blue/Morpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

/// @title CuratorRateIRMTest
/// @notice Comprehensive tests for CuratorRateIRM contract
contract CuratorRateIRMTest is TestHelper {
    using MarketParamsLib for MarketParams;

    CuratorRateIRM public irm;
    Morpho public morpho;
    ITPNAVOracle public oracle;
    MirrorIssuerRegistry public mirrorRegistry;
    MockERC20 public itp;
    MockERC20 public usdc;
    MarketParams public marketParams;
    Id public marketId;

    address public morphoOwner = address(0xAA);
    address public curatorAddr = address(0xCC);
    address public lender = address(0xBB);
    address public borrower = address(0xDD);

    uint256 public constant LLTV = 0.77e18;
    uint256 public constant ORACLE_PRICE = 1e24;

    // ============ SETUP ============

    function setUp() public {
        vm.warp(1_700_000_000);

        // Mock BLS precompile
        vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

        // Deploy tokens
        itp = new MockERC20("ITP", "ITP", 18);
        usdc = new MockERC20("USDC", "USDC", 6);

        // Deploy mirror registry
        bytes memory aggPubkey = generateTestPubkey(1);
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy mirrorProxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (aggPubkey, 2, 3, address(this)))
        );
        mirrorRegistry = MirrorIssuerRegistry(address(mirrorProxy));

        // Deploy oracle
        oracle = new ITPNAVOracle(address(mirrorRegistry), address(itp), ORACLE_PRICE);
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(ORACLE_PRICE, block.timestamp, 1, mockSig, 0x07);

        // Deploy Morpho
        morpho = new Morpho(morphoOwner);

        // Deploy CuratorRateIRM
        irm = new CuratorRateIRM(address(morpho), curatorAddr);

        // Enable IRM and LLTV
        vm.startPrank(morphoOwner);
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);
        vm.stopPrank();

        // Build market params and create market
        marketParams = MarketParams({
            loanToken: address(usdc),
            collateralToken: address(itp),
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        marketId = marketParams.id();

        // Seed USDC liquidity
        usdc.mint(lender, 1_000_000e6);
        vm.startPrank(lender);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.supply(marketParams, 1_000_000e6, 0, lender, "");
        vm.stopPrank();

        // Give borrower ITP
        itp.mint(borrower, 1_000e18);
    }

    // ============ BASIC RATE TESTS ============

    function test_setRate_success() public {
        uint256 rate = 1585489599; // ~5% APR

        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        assertEq(irm.rates(marketId), rate);
        assertEq(irm.lastRateUpdate(marketId), block.timestamp);
    }

    function test_setRate_emitsEvent() public {
        uint256 rate = 1585489599; // ~5% APR

        vm.prank(curatorAddr);
        vm.expectEmit(true, false, false, true);
        emit CuratorRateIRM.RateSet(marketId, rate, rate * 31557600 * 10000 / 1e18);
        irm.setRate(marketId, rate);
    }

    function test_setRate_revertNotCurator() public {
        vm.expectRevert(CuratorRateIRM.NotCurator.selector);
        irm.setRate(marketId, 1585489599);
    }

    function test_setRate_revertBelowMin() public {
        uint256 belowMin = irm.MIN_RATE() - 1;
        vm.prank(curatorAddr);
        vm.expectRevert(CuratorRateIRM.RateOutOfBounds.selector);
        irm.setRate(marketId, belowMin);
    }

    function test_setRate_revertAboveMax() public {
        uint256 aboveMax = irm.MAX_RATE() + 1;
        vm.prank(curatorAddr);
        vm.expectRevert(CuratorRateIRM.RateOutOfBounds.selector);
        irm.setRate(marketId, aboveMax);
    }

    function test_setRate_minBoundary() public {
        vm.startPrank(curatorAddr);
        irm.setRate(marketId, irm.MIN_RATE());
        vm.stopPrank();
        assertEq(irm.rates(marketId), irm.MIN_RATE());
    }

    function test_setRate_maxBoundary() public {
        vm.startPrank(curatorAddr);
        irm.setRate(marketId, irm.MAX_RATE());
        vm.stopPrank();
        assertEq(irm.rates(marketId), irm.MAX_RATE());
    }

    // ============ BATCH RATE TESTS ============

    function test_setRates_batch() public {
        Id[] memory ids = new Id[](2);
        ids[0] = marketId;
        ids[1] = Id.wrap(bytes32(uint256(999)));

        uint256[] memory rateValues = new uint256[](2);
        rateValues[0] = 1585489599;  // 5% APR
        rateValues[1] = 3170979198;  // 10% APR

        vm.prank(curatorAddr);
        irm.setRates(ids, rateValues);

        assertEq(irm.rates(ids[0]), rateValues[0]);
        assertEq(irm.rates(ids[1]), rateValues[1]);
    }

    function test_setRates_revertLengthMismatch() public {
        Id[] memory ids = new Id[](2);
        uint256[] memory rateValues = new uint256[](1);
        rateValues[0] = 1585489599;

        vm.prank(curatorAddr);
        vm.expectRevert(CuratorRateIRM.ArrayLengthMismatch.selector);
        irm.setRates(ids, rateValues);
    }

    function test_setRates_revertNotCurator() public {
        Id[] memory ids = new Id[](1);
        uint256[] memory rateValues = new uint256[](1);
        rateValues[0] = 1585489599;

        vm.expectRevert(CuratorRateIRM.NotCurator.selector);
        irm.setRates(ids, rateValues);
    }

    function test_setRates_revertOneOutOfBounds() public {
        Id[] memory ids = new Id[](2);
        ids[0] = marketId;
        ids[1] = Id.wrap(bytes32(uint256(999)));

        uint256[] memory rateValues = new uint256[](2);
        rateValues[0] = 1585489599; // valid
        rateValues[1] = 0;          // below min

        vm.prank(curatorAddr);
        vm.expectRevert(CuratorRateIRM.RateOutOfBounds.selector);
        irm.setRates(ids, rateValues);
    }

    // ============ BORROW RATE TESTS ============

    function test_borrowRate_returnsSetRate() public {
        uint256 rate = 1585489599;

        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // borrowRate can only be called by Morpho
        Market memory market;
        vm.prank(address(morpho));
        uint256 returned = irm.borrowRate(marketParams, market);
        assertEq(returned, rate);
    }

    function test_borrowRate_revertNotMorpho() public {
        Market memory market;
        vm.expectRevert(CuratorRateIRM.NotMorpho.selector);
        irm.borrowRate(marketParams, market);
    }

    function test_borrowRateView_returnsSetRate() public {
        uint256 rate = 1585489599;

        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        Market memory market;
        uint256 returned = irm.borrowRateView(marketParams, market);
        assertEq(returned, rate);
    }

    function test_borrowRateView_anyoneCanCall() public {
        uint256 rate = 1585489599;
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Anyone can call view
        Market memory market;
        vm.prank(address(0x1234));
        uint256 returned = irm.borrowRateView(marketParams, market);
        assertEq(returned, rate);
    }

    // ============ PUNITIVE RATE TESTS ============

    function test_punitiveRate_whenNoRateSet() public {
        // No rate has been set for this market
        Market memory market;
        uint256 returned = irm.borrowRateView(marketParams, market);
        assertEq(returned, irm.PUNITIVE_RATE());
    }

    function test_punitiveRate_whenStale() public {
        uint256 rate = 1585489599;
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Advance past MAX_RATE_STALENESS (48h + 1s)
        vm.warp(block.timestamp + 48 hours + 1);

        Market memory market;
        uint256 returned = irm.borrowRateView(marketParams, market);
        assertEq(returned, irm.PUNITIVE_RATE());
    }

    function test_noPunitiveRate_atExactStaleness() public {
        uint256 rate = 1585489599;
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Advance to exactly MAX_RATE_STALENESS
        vm.warp(block.timestamp + 48 hours);

        Market memory market;
        uint256 returned = irm.borrowRateView(marketParams, market);
        assertEq(returned, rate, "Rate should still be valid at exact staleness boundary");
    }

    function test_rateRefreshed_afterStaleAndUpdate() public {
        uint256 rate = 1585489599;
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Go stale
        vm.warp(block.timestamp + 48 hours + 1);

        Market memory market;
        assertEq(irm.borrowRateView(marketParams, market), irm.PUNITIVE_RATE());

        // Curator refreshes
        uint256 newRate = 3170979198;
        vm.prank(curatorAddr);
        irm.setRate(marketId, newRate);

        assertEq(irm.borrowRateView(marketParams, market), newRate);
    }

    // ============ CURATOR TRANSFER TESTS ============

    function test_setCurator_success() public {
        address newCurator = address(0xEE);

        vm.prank(curatorAddr);
        irm.setCurator(newCurator);

        assertEq(irm.curator(), newCurator);
    }

    function test_setCurator_emitsEvent() public {
        address newCurator = address(0xEE);

        vm.prank(curatorAddr);
        vm.expectEmit(true, true, false, false);
        emit CuratorRateIRM.CuratorChanged(curatorAddr, newCurator);
        irm.setCurator(newCurator);
    }

    function test_setCurator_revertNotCurator() public {
        vm.expectRevert(CuratorRateIRM.NotCurator.selector);
        irm.setCurator(address(0xEE));
    }

    function test_setCurator_oldCuratorLosesAccess() public {
        address newCurator = address(0xEE);

        vm.prank(curatorAddr);
        irm.setCurator(newCurator);

        vm.prank(curatorAddr);
        vm.expectRevert(CuratorRateIRM.NotCurator.selector);
        irm.setRate(marketId, 1585489599);
    }

    function test_setCurator_newCuratorCanSetRate() public {
        address newCurator = address(0xEE);

        vm.prank(curatorAddr);
        irm.setCurator(newCurator);

        vm.prank(newCurator);
        irm.setRate(marketId, 1585489599);
        assertEq(irm.rates(marketId), 1585489599);
    }

    // ============ MORPHO INTEGRATION TESTS ============

    function test_morphoBorrow_usesSetRate() public {
        // Set a rate
        uint256 rate = 1585489599; // ~5% APR
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Borrower supplies collateral and borrows
        vm.startPrank(borrower);
        itp.approve(address(morpho), 100e18);
        morpho.supplyCollateral(marketParams, 100e18, borrower, "");
        morpho.borrow(marketParams, 50e6, 0, borrower, borrower);
        vm.stopPrank();

        // Verify debt exists
        (,, uint256 collateral) = morpho.position(marketId, borrower);
        assertEq(collateral, 100e18);
        assertGt(usdc.balanceOf(borrower), 0);
    }

    function test_morphoBorrow_interestAccrues() public {
        uint256 rate = 1585489599; // ~5% APR
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Setup position
        vm.startPrank(borrower);
        itp.approve(address(morpho), 100e18);
        morpho.supplyCollateral(marketParams, 100e18, borrower, "");
        morpho.borrow(marketParams, 50e6, 0, borrower, borrower);
        vm.stopPrank();

        // Get initial borrow shares
        (uint256 supplySharesBefore, uint128 borrowSharesBefore,) = morpho.position(marketId, borrower);

        // Advance time 1 year
        vm.warp(block.timestamp + 365 days);

        // Accrue interest
        morpho.accrueInterest(marketParams);

        // Check that totalBorrowAssets increased (interest accrued)
        (uint128 totalSupplyAssets,, uint128 totalBorrowAssets,,,) = morpho.market(marketId);
        assertGt(totalBorrowAssets, 50e6, "Interest should have accrued");
    }

    function test_morphoLiquidation_withCuratorRateIRM() public {
        uint256 rate = 1585489599;
        vm.prank(curatorAddr);
        irm.setRate(marketId, rate);

        // Setup a tight position
        vm.startPrank(borrower);
        itp.approve(address(morpho), 100e18);
        morpho.supplyCollateral(marketParams, 100e18, borrower, "");
        morpho.borrow(marketParams, 70e6, 0, borrower, borrower); // 70 USDC against 100 ITP at 77% LLTV
        vm.stopPrank();

        // Crash oracle price to make position liquidatable
        // New price: 0.5 USDC per ITP (halved)
        uint256 crashPrice = ORACLE_PRICE / 2;
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(crashPrice, block.timestamp, 2, mockSig, 0x07);

        // Liquidator repays debt and seizes collateral
        address liquidator = address(0xFF);
        usdc.mint(liquidator, 70e6);

        vm.startPrank(liquidator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, 50e18, 0, "");
        vm.stopPrank();

        assertGt(seized, 0, "Should have seized collateral");
        assertGt(repaid, 0, "Should have repaid debt");
    }

    // ============ CONSTANTS VALIDATION ============

    function test_constants_reasonable() public view {
        // Punitive rate should be ~100% APR
        // 100% APR = 1e18 / 31536000 ~= 31709791983
        uint256 punitiveApr = irm.PUNITIVE_RATE() * 31536000 * 100 / 1e18;
        assertGt(punitiveApr, 90, "Punitive rate should be around 100% APR");
        assertLt(punitiveApr, 110, "Punitive rate should be around 100% APR");

        // Min rate should be ~0.5% APR
        uint256 minApr = irm.MIN_RATE() * 31536000 * 10000 / 1e18;
        assertGt(minApr, 40, "Min rate should be around 50 bps (0.5%)");
        assertLt(minApr, 60, "Min rate should be around 50 bps (0.5%)");

        // Max rate should be ~200% APR
        uint256 maxApr = irm.MAX_RATE() * 31536000 * 100 / 1e18;
        assertGt(maxApr, 190, "Max rate should be around 200% APR");
        assertLt(maxApr, 210, "Max rate should be around 200% APR");

        // Staleness should be 48 hours
        assertEq(irm.MAX_RATE_STALENESS(), 48 hours);
    }
}
