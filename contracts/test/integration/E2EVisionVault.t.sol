// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Vision} from "../../src/vision/Vision.sol";
import {VisionVault} from "../../src/vision/VisionVault.sol";
import {VisionVaultFactory} from "../../src/vision/VisionVaultFactory.sol";
import {IVisionVault} from "../../src/interfaces/IVisionVault.sol";
import {IVision} from "../../src/interfaces/IVision.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {Governance} from "../../src/Governance.sol";
import {VisionVaultAccounting} from "../../src/libraries/VisionVaultAccounting.sol";
import "../helpers/TestHelper.sol";

/// @title E2EVisionVault — Full lifecycle integration test
/// @notice Factory → deposit → trade on Vision → settle → reconcile with fees → withdraw.
///         Two tests: profitable round (fee crystallization) and losing round (no fees).
contract E2EVisionVault is TestHelper {
    Vision public vision;
    VisionVaultFactory public factory;
    MockERC20 public usdc;
    OracleRegistry public oracleRegistry;
    Governance public governance;

    address public vaultManager;
    address public depositor1;
    address public depositor2;
    address public player2; // external player, not a depositor

    bytes32 constant SOURCE_ID = keccak256("e2e_vault_source");
    bytes32 constant CONFIG_HASH = keccak256("e2e_vault_config");
    uint256 constant TICK_DURATION = 1 hours;
    uint256 constant LOCK_OFFSET = 60;
    uint256 constant FEE_RATE = 2000; // 20% performance fee

    function setUp() public {
        vaultManager = makeAddr("vaultManager");
        depositor1 = makeAddr("depositor1");
        depositor2 = makeAddr("depositor2");
        player2 = makeAddr("player2");

        usdc = new MockERC20("USDC", "USDC", 18);

        governance = deployGovernance(address(this));
        oracleRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(oracleRegistry, address(this));

        address collector = makeAddr("feeCollector");
        vision = new Vision(address(usdc), address(oracleRegistry), collector);

        // Deploy vault implementation + factory
        VisionVault impl = new VisionVault();
        factory = new VisionVaultFactory(address(impl), address(vision), address(usdc));

        // Fund actors
        usdc.mint(depositor1, 10_000 ether);
        usdc.mint(depositor2, 10_000 ether);
        usdc.mint(player2, 10_000 ether);

        // Player2 approves Vision directly (joins as external counterparty)
        vm.prank(player2);
        usdc.approve(address(vision), type(uint256).max);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _createBatch() internal returns (uint256 batchId) {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET
        ));
        bytes memory sig = signWithTestOracles(message);
        batchId = vision.createBatch(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET,
            sig, REF_NONCE, SIGNERS_BITMASK
        );
    }

    function _settleBatch(
        uint256 batchId,
        address[] memory players,
        uint256[] memory payouts
    ) internal {
        bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH", batchId, payoutsHash
        ));
        bytes memory sig = signWithTestOracles(message);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }

    function _sortTwo(address a, address b)
        internal
        pure
        returns (address first, address second)
    {
        return uint160(a) < uint160(b) ? (a, b) : (b, a);
    }

    function _requestAndClaimDeposit(VisionVault vault, address depositor, uint256 amount)
        internal
        returns (uint256 shares)
    {
        vm.prank(depositor);
        vault.requestDeposit(amount, depositor, depositor);
        vm.prank(depositor);
        shares = vault.claimDeposit(depositor, depositor);
    }

    // ── Test: Full Lifecycle with Profit ─────────────────────────────

    function test_fullLifecycle() public {
        // ── 1. Factory creates vault ──
        address vaultAddr = factory.createVault("Vision Alpha", "vALPHA", FEE_RATE, vaultManager);
        VisionVault vault = VisionVault(vaultAddr);

        assertTrue(factory.isRegisteredVault(vaultAddr), "Vault registered in factory");
        assertEq(vault.manager(), vaultManager);
        assertEq(vault.performanceFeeRate(), FEE_RATE);
        assertEq(vault.highWaterMark(), 1e18);

        // ── 2. Depositors approve vault ──
        vm.prank(depositor1);
        usdc.approve(vaultAddr, type(uint256).max);
        vm.prank(depositor2);
        usdc.approve(vaultAddr, type(uint256).max);

        // ── 3. Depositor1 deposits 200 USDC ──
        uint256 shares1 = _requestAndClaimDeposit(vault, depositor1, 200 ether);
        assertEq(shares1, 200 ether, "First deposit: 1:1 shares");
        assertEq(vault.totalSupply(), 200 ether);

        // ── 4. Depositor2 deposits 100 USDC ──
        uint256 shares2 = _requestAndClaimDeposit(vault, depositor2, 100 ether);
        assertEq(shares2, 100 ether, "Second deposit at same NAV: 1:1");
        assertEq(vault.totalSupply(), 300 ether);
        assertEq(vault.totalAssets(), 300 ether);

        // ── 5. Create batch (BLS signed) ──
        uint256 batchId = _createBatch();

        // ── 6. Manager joins batch with 250 USDC ──
        bytes32 bitmapHash = keccak256("vault_bitmap");
        vm.prank(vaultManager);
        vault.joinBatch(batchId, CONFIG_HASH, 250 ether, bitmapHash);

        assertEq(vault.totalActiveCapital(), 250 ether);
        assertEq(vault.idleUSDC(), 50 ether);
        assertEq(vault.totalAssets(), 300 ether, "totalAssets unchanged after join");

        // ── 7. Player2 joins same batch directly with 50 USDC ──
        bytes32 p2Bitmap = keccak256("p2_bitmap");
        vm.prank(player2);
        vision.joinBatchDirect(batchId, CONFIG_HASH, 50 ether, p2Bitmap);

        // ── 8. Depositor2 requests full redeem (100 shares) ──
        //       Only 50 USDC idle, so 100 shares worth ~100 USDC queues.
        vm.prank(depositor2);
        vault.requestRedeem(shares2, depositor2, depositor2);

        assertEq(vault.pendingRedeemRequest(0, depositor2), shares2, "Redeem should be queued");
        assertEq(vault.balanceOf(address(vault)), shares2, "Shares locked in vault");

        // Nothing claimable yet
        vm.prank(depositor2);
        vm.expectRevert(IVisionVault.NothingToClaim.selector);
        vault.claimRedeem(depositor2, depositor2);

        // ── 9. Advance time past tick (avoid lock window) ──
        uint256 currentTick = block.timestamp / TICK_DURATION;
        vm.warp((currentTick + 2) * TICK_DURATION + 1);

        // ── 10. Settle batch ──
        //  Total deposits in Vision: vault=250, player2=50 → 300 total.
        //  Vault gets 270 (profit of 20), player2 gets 30 (loss of 20). Sum = 300.
        (address first, address second) = _sortTwo(address(vault), player2);
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        players[0] = first;
        players[1] = second;

        if (first == address(vault)) {
            payouts[0] = 270 ether;
            payouts[1] = 30 ether;
        } else {
            payouts[0] = 30 ether;
            payouts[1] = 270 ether;
        }

        _settleBatch(batchId, players, payouts);

        // Vision takes 0.05% on vault's profit (270 - 250 = 20 profit)
        // fee = 20e18 * 5 / 10000 = 0.01e18
        uint256 visionFee = (20 ether * 5) / 10000;
        uint256 expectedVaultUsdc = 270 ether - visionFee; // 269.99e18
        assertEq(usdc.balanceOf(vaultAddr), expectedVaultUsdc + 50 ether, "Vault USDC: settlement + idle");

        // ── 11. Reconcile ──
        uint256 hwmBefore = vault.highWaterMark();
        uint256 managerSharesBefore = vault.balanceOf(vaultManager);

        vault.reconcile(batchId, expectedVaultUsdc);

        // ── 12. Verify fee crystallization ──
        uint256 managerSharesAfter = vault.balanceOf(vaultManager);
        assertTrue(managerSharesAfter > managerSharesBefore, "Manager received fee shares");

        uint256 hwmAfter = vault.highWaterMark();
        assertTrue(hwmAfter > hwmBefore, "HWM moved up after profit");
        assertTrue(hwmAfter > 1e18, "HWM above initial");

        assertEq(vault.totalActiveCapital(), 0, "Active capital zeroed");
        assertEq(vault.activeBatchDeposits(batchId), 0, "Batch deposit cleared");

        // Depositor2's queued redeem should now be fulfilled
        assertEq(vault.pendingRedeemRequest(0, depositor2), 0, "Redeem queue swept");

        // ── 12b. Depositor2 claims redeem ──
        uint256 d2UsdcBefore = usdc.balanceOf(depositor2);
        vm.prank(depositor2);
        vault.claimRedeem(depositor2, depositor2);
        uint256 d2Received = usdc.balanceOf(depositor2) - d2UsdcBefore;
        assertTrue(d2Received > 0, "Depositor2 received USDC");

        // Since vault profited, depositor2's share of 100/300 should reflect appreciation
        // (minus the manager's 20% performance fee cut, which diluted everyone slightly)
        console2.log("Depositor2 redeemed:", d2Received);

        // ── 13. Depositor1 requests + claims full withdrawal ──
        uint256 d1Shares = vault.balanceOf(depositor1);
        assertTrue(d1Shares > 0, "Depositor1 still has shares");

        vm.prank(depositor1);
        vault.requestRedeem(d1Shares, depositor1, depositor1);

        uint256 d1UsdcBefore = usdc.balanceOf(depositor1);
        vm.prank(depositor1);
        vault.claimRedeem(depositor1, depositor1);
        uint256 d1Received = usdc.balanceOf(depositor1) - d1UsdcBefore;
        assertTrue(d1Received > 0, "Depositor1 received USDC");
        console2.log("Depositor1 redeemed:", d1Received);

        // ── 14. Final balance log ──
        uint256 managerShares = vault.balanceOf(vaultManager);
        console2.log("Manager fee shares:", managerShares);
        console2.log("Vault remaining USDC:", usdc.balanceOf(vaultAddr));
        console2.log("Vault total supply:", vault.totalSupply());
        console2.log("HWM:", hwmAfter);

        // Manager still holds fee shares — vault still has some USDC backing them
        assertEq(vault.totalSupply(), managerShares, "Only manager shares remain");
    }

    // ── Test: No Fee on Loss ────────────────────────────────────────

    function test_noFeeOnLoss() public {
        // Deploy vault via factory
        address vaultAddr = factory.createVault("Vision Beta", "vBETA", FEE_RATE, vaultManager);
        VisionVault vault = VisionVault(vaultAddr);

        // Depositor1 approves + deposits
        vm.prank(depositor1);
        usdc.approve(vaultAddr, type(uint256).max);
        uint256 shares1 = _requestAndClaimDeposit(vault, depositor1, 200 ether);
        assertEq(shares1, 200 ether);

        // Create batch
        uint256 batchId = _createBatch();

        // Manager joins with 200 USDC
        bytes32 bitmapHash = keccak256("loss_bitmap");
        vm.prank(vaultManager);
        vault.joinBatch(batchId, CONFIG_HASH, 200 ether, bitmapHash);

        // Player2 joins with 100 USDC
        bytes32 p2Bitmap = keccak256("p2_loss_bitmap");
        vm.prank(player2);
        vision.joinBatchDirect(batchId, CONFIG_HASH, 100 ether, p2Bitmap);

        // Advance past tick
        uint256 currentTick = block.timestamp / TICK_DURATION;
        vm.warp((currentTick + 2) * TICK_DURATION + 1);

        // Settle: vault LOSES. Gets 150 (lost 50), player2 gets 150 (won 50).
        // Total = 300 = total deposits.
        (address first, address second) = _sortTwo(address(vault), player2);
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        players[0] = first;
        players[1] = second;

        if (first == address(vault)) {
            payouts[0] = 150 ether;
            payouts[1] = 150 ether;
        } else {
            payouts[0] = 150 ether;
            payouts[1] = 150 ether;
        }

        _settleBatch(batchId, players, payouts);

        uint256 hwmBefore = vault.highWaterMark();
        uint256 managerSharesBefore = vault.balanceOf(vaultManager);

        // Vault got 150 gross, no profit so no fee, net = 150
        vault.reconcile(batchId, 150 ether);

        // No fee shares minted on loss
        assertEq(vault.balanceOf(vaultManager), managerSharesBefore, "No fee shares on loss");
        assertEq(vault.highWaterMark(), hwmBefore, "HWM unchanged on loss");
        assertEq(vault.totalActiveCapital(), 0);

        // NAV per share should be below 1e18 (loss)
        uint256 nav = VisionVaultAccounting.navPerShare(vault.totalAssets(), vault.totalSupply());
        assertTrue(nav < 1e18, "NAV should reflect loss");

        console2.log("NAV after loss:", nav);
        console2.log("Vault USDC:", usdc.balanceOf(vaultAddr));
    }
}
