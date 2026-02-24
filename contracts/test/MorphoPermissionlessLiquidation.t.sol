// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Id, MarketParams, Position, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/MorphoTestHelper.sol";

/// @title MorphoPermissionlessLiquidation.t.sol - Tests for Story 8.12
/// @notice Tests that mirror registry sync, oracle price push, and liquidation are fully permissionless
contract MorphoPermissionlessLiquidationTest is MorphoTestHelper {
    using MarketParamsLib for MarketParams;

    // ============ TEST ADDRESSES ============

    address public curator = makeAddr("curator");
    address public independentLiquidator = makeAddr("independentLiquidator");
    address public randomUser = makeAddr("randomUser");

    // ============ CONSTANTS ============

    uint256 public constant LIQUIDATOR_SEED_USDC = 100e6; // 100 USDC seed capital

    // Track cycle numbers for oracle price pushes (oracle enforces strictly increasing)
    uint256 private _nextCycleNumber = 2; // cycle 1 used in _deployMorphoStack

    // ============ SETUP ============

    function setUp() public {
        _deployMorphoStack();
    }

    // ============ HELPERS ============

    /// @notice Update oracle NAV price with real BLS signature from any caller
    /// @param caller The address that will call updatePrice
    /// @param newPrice New oracle price (Morpho-scaled)
    function _updateOraclePriceFrom(address caller, uint256 newPrice) internal {
        bytes32 h = keccak256(abi.encodePacked(address(itp), newPrice, block.timestamp, _nextCycleNumber));
        bytes memory sig = signWithTestIssuers(h);
        vm.prank(caller);
        oracle.updatePrice(newPrice, block.timestamp, _nextCycleNumber, sig, 0x07);
        _nextCycleNumber++;
    }

    /// @notice Sign a NAV update hash with the current key set (seeds 0,1,2)
    function _signOracleUpdate(uint256 price, uint256 cycleNumber) internal returns (bytes memory) {
        bytes32 h = keccak256(abi.encodePacked(address(itp), price, block.timestamp, cycleNumber));
        return signWithTestIssuers(h);
    }

    /// @notice Sign a mirror registry sync hash with seeds 0,1,2
    function _signSync(bytes memory newAggPubkey, uint256 newActiveCount, uint256 newThreshold, uint256 nonce)
        internal
        returns (bytes memory)
    {
        bytes32 h = keccak256(abi.encodePacked("REGISTRY_SYNC", nonce, newAggPubkey, newActiveCount, newThreshold));
        return signWithTestIssuers(h);
    }

    /// @notice Generate a new aggregated pubkey using real BLS
    /// @param seedIndices Comma-separated seed indices for the new key set
    function _generateNewAggPubkey(string memory seedIndices) internal returns (bytes memory) {
        return blsAggPubkey(seedIndices);
    }

    /// @notice Check if a position is healthy (health factor >= 1.0)
    /// @dev WARNING: This is an approximation that may differ slightly from Morpho's internal
    ///      _isHealthy() due to rounding and interest accrual timing. Use only for test setup,
    ///      not for precise health assertions. For definitive health checks, attempt liquidation
    ///      and check for revert.
    function _isPositionHealthy(address user) internal view returns (bool) {
        (, uint128 borrowShares, uint128 collateral) = morpho.position(marketId, user);
        if (borrowShares == 0) return true;

        (,, uint128 totalBorrowAssets, uint128 totalBorrowShares,,) = morpho.market(marketId);
        uint256 debt = (uint256(borrowShares) * uint256(totalBorrowAssets) + uint256(totalBorrowShares) - 1)
            / uint256(totalBorrowShares);

        uint256 currentOraclePrice = oracle.currentPrice();
        uint256 collateralValueUsdc = uint256(collateral) * currentOraclePrice / 1e36;
        uint256 maxBorrow = collateralValueUsdc * LLTV / 1e18;

        return maxBorrow >= debt;
    }

    // ============ TASK 1: PERMISSIONLESS MIRROR REGISTRY SYNC (AC #1) ============

    /// @notice AC1: Non-curator address can sync MirrorIssuerRegistry
    function test_mirrorRegistrySync_permissionless() public {
        // Get current registry state
        uint256 currentNonce = mirrorRegistry.registryNonce();
        uint256 currentActiveCount = mirrorRegistry.activeCount();
        uint256 currentThreshold = mirrorRegistry.threshold();

        // Prepare new registry state (simulate adding an issuer on L3)
        uint256 newNonce = currentNonce + 1;
        uint256 newActiveCount = currentActiveCount + 1;
        uint256 newThreshold = currentThreshold; // Keep same threshold
        // Use same key set so subsequent tests remain consistent
        bytes memory newAggPubkey = _generateNewAggPubkey("0,1,2");

        uint256 signersBitmask = 0x07; // issuers 0,1,2 signed
        bytes memory sig = _signSync(newAggPubkey, newActiveCount, newThreshold, newNonce);

        // Non-curator address (independentLiquidator) calls sync
        vm.prank(independentLiquidator);
        mirrorRegistry.sync(newAggPubkey, newActiveCount, newThreshold, newNonce, sig, signersBitmask);

        // Verify state updated
        assertEq(mirrorRegistry.registryNonce(), newNonce, "Nonce should be incremented");
        assertEq(mirrorRegistry.activeCount(), newActiveCount, "Active count should be updated");
        assertEq(keccak256(mirrorRegistry.getAggregatedPubkey()), keccak256(newAggPubkey), "Pubkey should be updated");
    }

    /// @notice AC1: Random user can also sync (not just known addresses)
    function test_mirrorRegistrySync_randomUserCanSync() public {
        uint256 currentNonce = mirrorRegistry.registryNonce();
        uint256 newNonce = currentNonce + 1;
        // Use same key set so signing stays consistent
        bytes memory newAggPubkey = _generateNewAggPubkey("0,1,2");
        bytes memory sig = _signSync(newAggPubkey, 4, 2, newNonce);

        // Completely random address
        address completelyRandom = address(uint160(uint256(keccak256("completelyRandom"))));

        vm.prank(completelyRandom);
        mirrorRegistry.sync(newAggPubkey, 4, 2, newNonce, sig, 0x0F);

        assertEq(mirrorRegistry.registryNonce(), newNonce, "Random user sync should succeed");
    }

    /// @notice AC1: RegistrySynced event emitted on sync
    function test_mirrorRegistrySync_emitsEvent() public {
        uint256 currentNonce = mirrorRegistry.registryNonce();
        uint256 newNonce = currentNonce + 1;
        bytes memory newAggPubkey = _generateNewAggPubkey("0,1,2");
        uint256 signersBitmask = 0x07;
        bytes memory sig = _signSync(newAggPubkey, 4, 2, newNonce);

        vm.expectEmit(true, true, true, true);
        emit EventsLib.RegistrySynced(newNonce, 4, 2, keccak256(newAggPubkey), signersBitmask);

        vm.prank(randomUser);
        mirrorRegistry.sync(newAggPubkey, 4, 2, newNonce, sig, signersBitmask);
    }

    // ============ TASK 2: PERMISSIONLESS ORACLE PRICE PUSH (AC #2) ============

    /// @notice AC2: Non-curator can push oracle price update
    function test_oracleUpdatePrice_permissionless() public {
        uint256 newPrice = 0.9e24; // 1 ITP = 0.9 USDC

        uint256 oldCycle = oracle.lastCycleNumber();
        uint256 newCycle = oldCycle + 1;
        bytes memory sig = _signOracleUpdate(newPrice, newCycle);

        vm.prank(independentLiquidator);
        oracle.updatePrice(newPrice, block.timestamp, newCycle, sig, 0x07);

        assertEq(oracle.currentPrice(), newPrice, "Price should be updated");
        assertEq(oracle.lastCycleNumber(), newCycle, "Cycle number should be updated");
    }

    /// @notice AC2: Price with cycleNumber > lastCycleNumber accepted
    function test_oracleUpdatePrice_acceptsHigherCycleNumber() public {
        uint256 oldCycle = oracle.lastCycleNumber();
        uint256 newCycle = oldCycle + 10; // Jump ahead
        bytes memory sig = _signOracleUpdate(0.95e24, newCycle);

        vm.prank(randomUser);
        oracle.updatePrice(0.95e24, block.timestamp, newCycle, sig, 0x07);

        assertEq(oracle.lastCycleNumber(), newCycle, "Should accept higher cycle number");
    }

    /// @notice AC2: Price with cycleNumber <= lastCycleNumber is a silent no-op
    function test_oracleUpdatePrice_silentNoOpOnStaleCycleNumber() public {
        uint256 currentCycle = oracle.lastCycleNumber();
        uint256 currentPrice = oracle.currentPrice();

        // Sign with the stale cycle number — BLS won't be checked since it's a no-op
        bytes memory sig = _signOracleUpdate(0.95e24, currentCycle);

        // Try same cycle number — should not revert, just no-op
        vm.prank(randomUser);
        oracle.updatePrice(0.95e24, block.timestamp, currentCycle, sig, 0x07);
        assertEq(oracle.currentPrice(), currentPrice, "Price should not change on stale cycle no-op");

        // Try lower cycle number — should not revert, just no-op
        if (currentCycle > 0) {
            bytes memory sig2 = _signOracleUpdate(0.95e24, currentCycle - 1);
            vm.prank(randomUser);
            oracle.updatePrice(0.95e24, block.timestamp, currentCycle - 1, sig2, 0x07);
            assertEq(oracle.currentPrice(), currentPrice, "Price should not change on older cycle no-op");
        }
    }

    /// @notice AC2: PriceUpdated event emitted
    function test_oracleUpdatePrice_emitsEvent() public {
        uint256 newPrice = 0.85e24;
        uint256 newCycle = oracle.lastCycleNumber() + 1;
        uint256 signersBitmask = 0x07;
        bytes memory sig = _signOracleUpdate(newPrice, newCycle);

        vm.expectEmit(true, true, true, true);
        emit EventsLib.NAVPriceUpdated(address(itp), newPrice, block.timestamp, newCycle, signersBitmask);

        vm.prank(independentLiquidator);
        oracle.updatePrice(newPrice, block.timestamp, newCycle, sig, signersBitmask);
    }

    // ============ TASK 3: PERMISSIONLESS LIQUIDATION EXECUTION (AC #3) ============

    /// @notice AC3: Non-curator liquidator can call morpho.liquidate()
    function test_liquidation_permissionless() public {
        // Setup borrower position
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Drop price to make unhealthy
        _updateOraclePriceFrom(randomUser, 0.8e24);
        assertFalse(_isPositionHealthy(borrower), "Position should be unhealthy");

        // Fund independent liquidator
        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);

        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 seizeAmount = 20e18;
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, seizeAmount, 0, "");
        vm.stopPrank();

        assertEq(seized, seizeAmount, "Independent liquidator should seize ITP");
        assertTrue(repaid > 0, "Debt should be repaid");
        assertEq(itp.balanceOf(independentLiquidator), seized, "Liquidator should receive seized ITP");
    }

    /// @notice AC3: Liquidator receives seized ITP with incentive
    function test_liquidation_liquidatorReceivesIncentive() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        uint256 dropPrice = 0.8e24;
        _updateOraclePriceFrom(independentLiquidator, dropPrice);

        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 seizeAmount = 20e18;
        (uint256 seized, uint256 repaid) = morpho.liquidate(marketParams, borrower, seizeAmount, 0, "");
        vm.stopPrank();

        // Seized ITP value at oracle price: 20 ITP * 0.8e24 / 1e36 = 16e6 (16 USDC)
        uint256 seizedValueUsdc = seized * dropPrice / 1e36;

        // Repaid USDC < seized value = liquidation incentive (profit)
        assertTrue(repaid < seizedValueUsdc, "Liquidator should profit from incentive");

        // Incentive should be ~7.41% for LLTV=77%
        uint256 incentiveBps = (seizedValueUsdc - repaid) * 10000 / repaid;
        assertTrue(incentiveBps >= 691 && incentiveBps <= 791, "Incentive should be ~7.41%");

        console.log("Seized ITP value (USDC):", seizedValueUsdc);
        console.log("USDC repaid:", repaid);
        console.log("Incentive (bps):", incentiveBps);
    }

    /// @notice AC3: Borrower debt reduced after liquidation
    function test_liquidation_borrowerDebtReduced() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePriceFrom(randomUser, 0.8e24);

        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        (, uint128 sharesBefore,) = morpho.position(marketId, borrower);

        morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();

        (, uint128 sharesAfter,) = morpho.position(marketId, borrower);
        assertTrue(sharesAfter < sharesBefore, "Borrow shares should decrease");
    }

    // ============ TASK 4: FULL PERMISSIONLESS FLOW E2E (AC #4) ============

    /// @notice AC4: Complete permissionless flow - sync registry, push price, liquidate, simulate sell
    function test_fullPermissionlessFlow() public {
        // Step 1: Setup borrower position
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Step 2: Make position unhealthy via oracle price drop (non-curator pushes price)
        uint256 dropPrice = 0.8e24;
        _updateOraclePriceFrom(independentLiquidator, dropPrice);
        assertFalse(_isPositionHealthy(borrower), "Position should be unhealthy");

        // Step 3: Non-curator syncs mirror registry with real BLS
        {
            uint256 currentNonce = mirrorRegistry.registryNonce();
            uint256 newNonce = currentNonce + 1;
            // Keep same key set so oracle signing remains consistent
            bytes memory newAggPubkey = _generateNewAggPubkey("0,1,2");
            bytes memory sig = _signSync(newAggPubkey, 4, 2, newNonce);

            vm.prank(independentLiquidator);
            mirrorRegistry.sync(newAggPubkey, 4, 2, newNonce, sig, 0x07);
        }

        // Step 4: Non-curator liquidates partial position
        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        uint256 usdcBefore = usdc.balanceOf(independentLiquidator);
        (uint256 seized,) = morpho.liquidate(marketParams, borrower, 30e18, 0, "");
        uint256 usdcAfter = usdc.balanceOf(independentLiquidator);
        uint256 usdcSpent = usdcBefore - usdcAfter;
        vm.stopPrank();

        // Step 5: Simulate ITP sell proceeds
        // NOTE: In production, liquidator would sell ITP via Index contract's sell order flow,
        // which is a cross-chain operation (Arb→L3→Arb) requiring issuer consensus.
        // For this Foundry test, we simulate the USDC proceeds by minting equivalent value.
        // The key assertion is that the liquidator ends profitable, proving the economic model works.
        uint256 usdcProceeds = seized * dropPrice / 1e36;
        usdc.mint(independentLiquidator, usdcProceeds);

        // Assertions
        uint256 finalUsdcBalance = usdc.balanceOf(independentLiquidator);
        assertTrue(finalUsdcBalance > usdcBefore, "Liquidator should end with more USDC (profitable)");
        assertEq(itp.balanceOf(independentLiquidator), seized, "Liquidator holds seized ITP");

        console.log("=== Full Permissionless Flow ===");
        console.log("USDC spent:", usdcSpent);
        console.log("ITP seized:", seized);
        console.log("USDC proceeds (simulated sell):", usdcProceeds);
        console.log("Net profit:", usdcProceeds - usdcSpent);
    }

    /// @notice AC4: Every step uses non-admin/non-curator address
    function test_fullPermissionlessFlow_noAdminRoles() public {
        // Verify independentLiquidator has no special roles
        assertTrue(independentLiquidator != mirrorAdmin, "Liquidator should not be mirrorAdmin");
        assertTrue(independentLiquidator != morphoOwner, "Liquidator should not be morphoOwner");
        assertTrue(independentLiquidator != borrower, "Liquidator should not be borrower");

        // Setup and execute flow
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // All operations by independentLiquidator
        _updateOraclePriceFrom(independentLiquidator, 0.8e24);

        uint256 currentNonce = mirrorRegistry.registryNonce();
        uint256 newNonce = currentNonce + 1;
        bytes memory newAggPubkey = _generateNewAggPubkey("0,1,2");
        bytes memory sig = _signSync(newAggPubkey, 4, 2, newNonce);
        vm.prank(independentLiquidator);
        mirrorRegistry.sync(newAggPubkey, 4, 2, newNonce, sig, 0x07);

        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();

        assertTrue(seized > 0, "Non-admin liquidation should succeed");
    }

    // ============ TASK 5: CONCURRENT LIQUIDATION RACE (AC #5) ============

    /// @notice AC5: Curator liquidates first, then independent liquidator
    function test_concurrentLiquidation_curatorFirst() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePriceFrom(randomUser, 0.8e24);

        // Fund both liquidators
        usdc.mint(curator, LIQUIDATOR_SEED_USDC);
        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);

        // Curator liquidates first
        vm.startPrank(curator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized1,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();

        // Independent liquidator liquidates second (position still unhealthy)
        assertFalse(_isPositionHealthy(borrower), "Position should still be unhealthy");

        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized2,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();

        // Both liquidations succeeded
        assertTrue(seized1 > 0 && seized2 > 0, "Both liquidations should succeed");

        // Total seized <= original collateral (no double-seize)
        (, , uint128 remainingCollateral) = morpho.position(marketId, borrower);
        assertEq(
            uint256(remainingCollateral),
            collateral - seized1 - seized2,
            "Collateral accounting should be correct"
        );
    }

    /// @notice AC5: Second liquidator reverts gracefully if position becomes healthy
    function test_concurrentLiquidation_secondRevertsIfHealthy() public {
        // Setup position that is barely unhealthy after price drop
        // At 0.82 price: collateral value = 82 USDC, max borrow = 63.14 USDC
        // Borrow 70 USDC → unhealthy (health factor < 1.0)
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePriceFrom(randomUser, 0.82e24); // Make position slightly unhealthy
        assertFalse(_isPositionHealthy(borrower), "Position should be unhealthy");

        usdc.mint(curator, 200e6); // More USDC for larger liquidation
        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);

        // Curator liquidates a large portion to restore health
        // After seizing 40 ITP: collateral = 60 ITP = 49.2 USDC value
        // Debt reduced proportionally, position may become healthy
        vm.startPrank(curator);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.liquidate(marketParams, borrower, 40e18, 0, ""); // Large liquidation
        vm.stopPrank();

        // Position should now be healthy (or close to it)
        // Either way, test that second liquidator handles it gracefully
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        if (_isPositionHealthy(borrower)) {
            // Second liquidator should fail gracefully
            vm.expectRevert(bytes("position is healthy"));
            morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        } else {
            // If still unhealthy, second liquidation should succeed
            (uint256 seized,) = morpho.liquidate(marketParams, borrower, 10e18, 0, "");
            assertTrue(seized > 0, "Second liquidation should succeed if still unhealthy");
        }
        vm.stopPrank();
    }

    /// @notice AC5: Deterministic test that position becomes healthy and second liquidation reverts
    /// @dev This test guarantees we hit the revert path, unlike test_concurrentLiquidation_secondRevertsIfHealthy
    ///      which has conditional logic that may not always exercise the revert.
    function test_concurrentLiquidation_secondRevertsIfHealthy_deterministic() public {
        // Setup: Create a position that is barely unhealthy
        // At price 0.9, collateral value = 90 USDC, max borrow at 77% LLTV = 69.3 USDC
        // Borrow 70 USDC → unhealthy (health factor ~0.99)
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Drop price to 0.9 - makes position just barely unhealthy
        _updateOraclePriceFrom(randomUser, 0.9e24);

        // First liquidation: liquidate enough to restore health
        // Seizing 50 ITP leaves 50 ITP collateral = 45 USDC value
        // Debt reduced proportionally: ~35 USDC debt remaining
        // New health: 45 * 0.77 / 35 = 0.99 → healthy after liquidation bonus
        usdc.mint(curator, 200e6);
        vm.startPrank(curator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized1,) = morpho.liquidate(marketParams, borrower, 50e18, 0, "");
        vm.stopPrank();

        assertTrue(seized1 == 50e18, "First liquidation should seize requested amount");

        // Position should now be healthy - verify by attempting liquidation
        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        // This MUST revert - if it doesn't, the test setup is wrong
        vm.expectRevert(bytes("position is healthy"));
        morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();
    }

    /// @notice AC5: No double-seize vulnerability
    function test_concurrentLiquidation_noDoubleSeize() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePriceFrom(randomUser, 0.7e24); // Severe drop

        usdc.mint(curator, 200e6);
        usdc.mint(independentLiquidator, 200e6);

        uint256 totalSeized = 0;

        // Multiple rapid liquidations
        vm.startPrank(curator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 s1,) = morpho.liquidate(marketParams, borrower, 30e18, 0, "");
        totalSeized += s1;
        vm.stopPrank();

        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 s2,) = morpho.liquidate(marketParams, borrower, 30e18, 0, "");
        totalSeized += s2;
        vm.stopPrank();

        vm.startPrank(curator);
        (uint256 s3,) = morpho.liquidate(marketParams, borrower, 30e18, 0, "");
        totalSeized += s3;
        vm.stopPrank();

        // Total seized cannot exceed original collateral
        assertTrue(totalSeized <= collateral, "Total seized must not exceed original collateral");

        // Verify collateral accounting
        (, , uint128 remaining) = morpho.position(marketId, borrower);
        assertEq(collateral - totalSeized, uint256(remaining), "Collateral accounting mismatch");
    }

    // ============ TASK 6: ACCESS CONTROL VERIFICATION (AC #4) ============

    /// @notice AC4: ITPNAVOracle.updatePrice() has no access control
    function test_accessControl_oracleUpdatePrice_noRestriction() public {
        address[] memory callers = new address[](4);
        callers[0] = independentLiquidator;
        callers[1] = randomUser;
        callers[2] = address(0xDEAD);
        callers[3] = address(uint160(uint256(keccak256("absolutelyRandom"))));

        for (uint256 i = 0; i < callers.length; i++) {
            uint256 newCycle = oracle.lastCycleNumber() + 1;
            bytes memory sig = _signOracleUpdate(0.95e24, newCycle);

            vm.prank(callers[i]);
            oracle.updatePrice(0.95e24, block.timestamp, newCycle, sig, 0x07);

            assertEq(oracle.lastCycleNumber(), newCycle, "Any address should be able to update oracle");
        }
    }

    /// @notice AC4: MirrorIssuerRegistry.sync() has no access control
    function test_accessControl_mirrorRegistrySync_noRestriction() public {
        address[] memory callers = new address[](3);
        callers[0] = independentLiquidator;
        callers[1] = randomUser;
        callers[2] = address(0xBEEF);

        for (uint256 i = 0; i < callers.length; i++) {
            uint256 newNonce = mirrorRegistry.registryNonce() + 1;
            // Keep same key set (0,1,2) throughout so signing stays consistent across iterations
            bytes memory newPubkey = _generateNewAggPubkey("0,1,2");
            bytes memory sig = _signSync(newPubkey, 4, 2, newNonce);

            vm.prank(callers[i]);
            mirrorRegistry.sync(newPubkey, 4, 2, newNonce, sig, 0x07);

            assertEq(mirrorRegistry.registryNonce(), newNonce, "Any address should be able to sync registry");
        }
    }

    /// @notice AC4: Morpho.liquidate() has no access control (permissionless by design)
    function test_accessControl_morphoLiquidate_noRestriction() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePriceFrom(randomUser, 0.8e24);

        address[] memory callers = new address[](3);
        callers[0] = independentLiquidator;
        callers[1] = randomUser;
        callers[2] = address(0xCAFE);

        for (uint256 i = 0; i < callers.length; i++) {
            if (_isPositionHealthy(borrower)) break; // Stop if position becomes healthy

            usdc.mint(callers[i], LIQUIDATOR_SEED_USDC);
            vm.startPrank(callers[i]);
            usdc.approve(address(morpho), type(uint256).max);
            (uint256 seized,) = morpho.liquidate(marketParams, borrower, 10e18, 0, "");
            vm.stopPrank();

            assertTrue(seized > 0, "Any address should be able to liquidate");
        }
    }

    /// @notice AC4: Random EOA with no prior roles can perform entire flow
    function test_accessControl_randomEOA_fullFlow() public {
        // Generate a completely fresh address with no roles
        address freshEOA = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, "freshEOA")))));

        // Setup position
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Fresh EOA performs all operations
        // 1. Push oracle price
        uint256 oracleCycle = _nextCycleNumber++;
        bytes memory oracleSig = _signOracleUpdate(0.8e24, oracleCycle);
        vm.prank(freshEOA);
        oracle.updatePrice(0.8e24, block.timestamp, oracleCycle, oracleSig, 0x07);

        // 2. Sync registry
        uint256 newNonce = mirrorRegistry.registryNonce() + 1;
        bytes memory newAggPubkey = _generateNewAggPubkey("0,1,2");
        bytes memory syncSig = _signSync(newAggPubkey, 4, 2, newNonce);
        vm.prank(freshEOA);
        mirrorRegistry.sync(newAggPubkey, 4, 2, newNonce, syncSig, 0x07);

        // 3. Liquidate
        usdc.mint(freshEOA, LIQUIDATOR_SEED_USDC);
        vm.startPrank(freshEOA);
        usdc.approve(address(morpho), type(uint256).max);
        (uint256 seized,) = morpho.liquidate(marketParams, borrower, 20e18, 0, "");
        vm.stopPrank();

        assertTrue(seized > 0, "Fresh EOA should complete full permissionless flow");
    }

    // ============ TASK 7: EDGE CASES AND ERROR HANDLING ============

    /// @notice Edge case: Liquidation with stale oracle price reverts
    function test_edgeCase_staleOraclePrice_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Push a price update
        _updateOraclePriceFrom(randomUser, 0.8e24);

        // Warp time beyond MAX_STALENESS (24 hours)
        vm.warp(block.timestamp + 25 hours);

        // Liquidation should revert because oracle.price() will revert
        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);
        vm.expectRevert(); // Oracle staleness check
        morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();
    }

    /// @notice Edge case: Liquidation on healthy position reverts cleanly
    function test_edgeCase_healthyPosition_revertsCleanly() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 50e6; // Well within LLTV
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        // Don't drop price - position stays healthy
        assertTrue(_isPositionHealthy(borrower), "Position should be healthy");

        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);
        vm.expectRevert(bytes("position is healthy"));
        morpho.liquidate(marketParams, borrower, 10e18, 0, "");
        vm.stopPrank();
    }

    /// @notice Edge case: Oracle update with invalid BLS signature reverts
    /// @dev Uses a real BLS signature over the wrong message to trigger BLS failure
    function test_edgeCase_invalidBLSSignature_reverts() public {
        uint256 newCycle = oracle.lastCycleNumber() + 1;
        // Sign a completely different message — real BLS sig but over wrong content
        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong message"));

        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSignature("E020_InvalidBLSSignature()"));
        oracle.updatePrice(0.9e24, block.timestamp, newCycle, wrongSig, 0x07);
    }

    /// @notice Edge case: Mirror registry sync with wrong nonce reverts
    function test_edgeCase_wrongNonce_reverts() public {
        uint256 currentNonce = mirrorRegistry.registryNonce();
        bytes memory newPubkey = _generateNewAggPubkey("0,1,2");
        // Sign with stale nonce (nonce check happens before BLS, but we still use real sig)
        bytes memory staleSig = _signSync(newPubkey, 4, 2, currentNonce);

        // Try with same nonce
        vm.prank(randomUser);
        vm.expectRevert(abi.encodeWithSignature("E090_StaleNonce(uint256,uint256)", currentNonce, currentNonce));
        mirrorRegistry.sync(newPubkey, 4, 2, currentNonce, staleSig, 0x07);

        // Try with lower nonce
        if (currentNonce > 0) {
            bytes memory olderSig = _signSync(newPubkey, 4, 2, currentNonce - 1);
            vm.prank(randomUser);
            vm.expectRevert(
                abi.encodeWithSignature("E090_StaleNonce(uint256,uint256)", currentNonce - 1, currentNonce)
            );
            mirrorRegistry.sync(newPubkey, 4, 2, currentNonce - 1, olderSig, 0x07);
        }
    }

    /// @notice Edge case: Liquidation with zero USDC repay amount reverts
    function test_edgeCase_zeroRepayAmount_reverts() public {
        uint256 collateral = 100e18;
        uint256 borrowAmount = 70e6;
        itp.mint(borrower, collateral);
        _setupBorrowPosition(collateral, borrowAmount);

        _updateOraclePriceFrom(randomUser, 0.8e24);

        usdc.mint(independentLiquidator, LIQUIDATOR_SEED_USDC);
        vm.startPrank(independentLiquidator);
        usdc.approve(address(morpho), type(uint256).max);

        // Try to seize 0 assets
        vm.expectRevert();
        morpho.liquidate(marketParams, borrower, 0, 0, "");
        vm.stopPrank();
    }
}
