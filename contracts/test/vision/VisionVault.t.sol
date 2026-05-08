// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Vision} from "../../src/vision/Vision.sol";
import {VisionVault} from "../../src/vision/VisionVault.sol";
import {IVisionVault} from "../../src/interfaces/IVisionVault.sol";
import {IVision} from "../../src/interfaces/IVision.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {Governance} from "../../src/Governance.sol";
import {VisionVaultAccounting} from "../../src/libraries/VisionVaultAccounting.sol";
import "../helpers/TestHelper.sol";

contract VisionVaultTest is TestHelper {
    Vision public vision;
    VisionVault public vault;
    MockERC20 public usdc;
    OracleRegistry public oracleRegistry;
    Governance public governance;

    address public manager;
    address public depositor1;
    address public depositor2;
    address public player2; // external player for 2-player settlement tests

    bytes32 constant SOURCE_ID = keccak256("vault_test_source");
    bytes32 constant CONFIG_HASH = keccak256("vault_test_config");
    uint256 constant TICK_DURATION = 1 hours;
    uint256 constant LOCK_OFFSET = 60;
    uint256 constant SETTLEMENT_GRACE = 2 hours;
    uint256 constant DEPOSIT = 100 ether; // 100 USDC (18 decimals)
    uint256 constant FEE_RATE = 2000; // 20% performance fee

    function setUp() public {
        manager = makeAddr("vaultManager");
        depositor1 = makeAddr("depositor1");
        depositor2 = makeAddr("depositor2");
        player2 = makeAddr("player2");

        usdc = new MockERC20("USDC", "USDC", 18);

        governance = deployGovernance(address(this));
        oracleRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(oracleRegistry, address(this));

        address collector = makeAddr("feeCollector");
        vision = new Vision(address(usdc), address(oracleRegistry), collector);

        // Deploy vault directly (not via clone for test simplicity)
        vault = new VisionVault();
        // VisionVault constructor marks _initialized = true on the impl.
        // We need an uninitialized copy. Deploy via create to get bytecode, then use a fresh deploy.
        // Actually, for testing we'll deploy a helper that skips the constructor guard.
        // Simpler: use vm.store to reset _initialized.
        // Slot for _initialized: after all the mappings and state. Let's just use etch.

        // Deploy a fresh contract with the vault's runtime code
        bytes memory code = address(vault).code;
        address vaultAddr = makeAddr("vaultInstance");
        vm.etch(vaultAddr, code);
        vault = VisionVault(vaultAddr);

        vault.initialize("Vision Vault Alpha", "vVALPHA", manager, address(vision), address(usdc), FEE_RATE);

        // Fund depositors
        usdc.mint(depositor1, 10000 ether);
        usdc.mint(depositor2, 10000 ether);
        usdc.mint(player2, 10000 ether);

        // Approve vault
        vm.prank(depositor1);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(depositor2);
        usdc.approve(address(vault), type(uint256).max);

        // Player2 approves Vision directly (for 2-player tests)
        vm.prank(player2);
        usdc.approve(address(vision), type(uint256).max);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    function _createBatch() internal returns (uint256 batchId) {
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "CREATE_BATCH",
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET, SETTLEMENT_GRACE
        ));
        bytes memory sig = signWithTestOracles(message);
        batchId = vision.createBatch(
            SOURCE_ID, CONFIG_HASH, TICK_DURATION, LOCK_OFFSET, SETTLEMENT_GRACE,
            sig, REF_NONCE, SIGNERS_BITMASK
        );
    }

    function _requestAndClaimDeposit(address depositor, uint256 amount) internal returns (uint256 shares) {
        vm.prank(depositor);
        vault.requestDeposit(amount, depositor, depositor);
        vm.prank(depositor);
        shares = vault.claimDeposit(depositor, depositor);
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

    function _sortTwoAddresses(address a, address b)
        internal
        pure
        returns (address first, address second)
    {
        if (uint160(a) < uint160(b)) {
            return (a, b);
        }
        return (b, a);
    }

    // ── Test 1: Initialization ───────────────────────────────────────

    function test_initialize_setsState() public view {
        assertEq(vault.manager(), manager);
        assertEq(address(vault.usdc()), address(usdc));
        assertEq(vault.performanceFeeRate(), FEE_RATE);
        assertEq(vault.highWaterMark(), 1e18);
        assertEq(vault.totalActiveCapital(), 0);
    }

    function test_initialize_rejectsDouble() public {
        vm.expectRevert(IVisionVault.AlreadyInitialized.selector);
        vault.initialize("x", "x", manager, address(vision), address(usdc), 0);
    }

    function test_initialize_rejectsHighFee() public {
        bytes memory code = address(vault).code;
        address raw = makeAddr("rawVault");
        vm.etch(raw, code);
        VisionVault v2 = VisionVault(raw);

        vm.expectRevert(IVisionVault.FeeTooHigh.selector);
        v2.initialize("x", "x", manager, address(vision), address(usdc), 5001);
    }

    // ── Test 2: ERC-20 basics ────────────────────────────────────────

    function test_erc20_nameSymbolDecimals() public view {
        assertEq(vault.name(), "Vision Vault Alpha");
        assertEq(vault.symbol(), "vVALPHA");
        assertEq(vault.decimals(), 18);
    }

    // ── Test 3: Deposit and claim shares ─────────────────────────────

    function test_depositAndClaim_mintsCorrectShares() public {
        uint256 shares = _requestAndClaimDeposit(depositor1, DEPOSIT);

        // First deposit: 1:1 ratio
        assertEq(shares, DEPOSIT, "First deposit should be 1:1");
        assertEq(vault.balanceOf(depositor1), DEPOSIT);
        assertEq(vault.totalSupply(), DEPOSIT);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT);
    }

    function test_depositAndClaim_secondDepositorGetsProRata() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 shares2 = _requestAndClaimDeposit(depositor2, DEPOSIT);

        // Same NAV, should get same shares
        assertEq(shares2, DEPOSIT, "Second deposit at same NAV should be 1:1");
        assertEq(vault.totalSupply(), DEPOSIT * 2);
    }

    function test_pendingDepositRequest_tracksCorrectly() public {
        vm.prank(depositor1);
        vault.requestDeposit(DEPOSIT, depositor1, depositor1);
        assertEq(vault.pendingDepositRequest(0, depositor1), DEPOSIT);

        vm.prank(depositor1);
        vault.claimDeposit(depositor1, depositor1);
        assertEq(vault.pendingDepositRequest(0, depositor1), 0);
    }

    // ── Test 4: Redeem from idle USDC ────────────────────────────────

    function test_redeemFromIdle_immediatelyClaimable() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);

        uint256 shares = vault.balanceOf(depositor1);
        vm.prank(depositor1);
        vault.requestRedeem(shares, depositor1, depositor1);

        // Should be immediately fulfilled since all USDC is idle
        uint256 balBefore = usdc.balanceOf(depositor1);
        vm.prank(depositor1);
        vault.claimRedeem(depositor1, depositor1);
        uint256 received = usdc.balanceOf(depositor1) - balBefore;

        assertEq(received, DEPOSIT, "Full deposit should be returned");
        assertEq(vault.totalSupply(), 0);
    }

    function test_claimRedeem_revertsWhenNothingClaimable() public {
        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NothingToClaim.selector);
        vault.claimRedeem(depositor1, depositor1);
    }

    // ── Test 5: joinBatch ────────────────────────────────────────────

    function test_joinBatch_tracksActiveCapital() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256("vault_bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        assertEq(vault.activeBatchDeposits(batchId), DEPOSIT);
        assertEq(vault.totalActiveCapital(), DEPOSIT);
        assertEq(vault.idleUSDC(), 0);

        // totalAssets should still include the active capital
        assertEq(vault.totalAssets(), DEPOSIT);
    }

    function test_joinBatch_onlyManager() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NotManager.selector);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);
    }

    function test_joinBatch_revertsInsufficientIdle() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vm.expectRevert(IVisionVault.InsufficientIdleCapital.selector);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT + 1, bitmapHash);
    }

    // ── Test 6: updateBitmap ─────────────────────────────────────────

    function test_updateBitmap_onlyManager() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        bytes32 newBitmapHash = keccak256("new_bitmap");
        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NotManager.selector);
        vault.updateBitmap(batchId, CONFIG_HASH, newBitmapHash);

        vm.prank(manager);
        vault.updateBitmap(batchId, CONFIG_HASH, newBitmapHash);

        // Verify bitmap updated on Vision
        IVision.PlayerPosition memory pos = vision.getPosition(batchId, address(vault));
        assertEq(pos.bitmapHash, newBitmapHash);
    }

    // ── Test 7: Reconcile break-even (single player) ────────────────

    function test_reconcile_breakEven() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        // Manager joins batch
        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        // Settle: single player gets back exactly what they deposited
        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = address(vault);
        payouts[0] = DEPOSIT; // break-even

        _settleBatch(batchId, players, payouts);

        // USDC is back in the vault
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT);

        // Reconcile — break-even: payout == deposit, no fee
        vault.reconcile(batchId, DEPOSIT);

        assertEq(vault.activeBatchDeposits(batchId), 0);
        assertEq(vault.totalActiveCapital(), 0);
        assertEq(vault.highWaterMark(), 1e18, "HWM unchanged at break-even");
    }

    // ── Test 8: Reconcile with profit (2 players) ────────────────────

    function test_reconcile_withProfit_mintsFeeShares() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        // Vault joins
        bytes32 bitmapHash = keccak256("vault_bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        // Player2 joins directly
        bytes32 p2Bitmap = keccak256("p2_bitmap");
        vm.prank(player2);
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, p2Bitmap);

        // Settle: vault wins, player2 loses. Total = 200, must sum to <= 200.
        // Vault gets 130, player2 gets 70.
        (address first, address second) = _sortTwoAddresses(address(vault), player2);
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        players[0] = first;
        players[1] = second;

        if (first == address(vault)) {
            payouts[0] = 130 ether;
            payouts[1] = 70 ether;
        } else {
            payouts[0] = 70 ether;
            payouts[1] = 130 ether;
        }

        _settleBatch(batchId, players, payouts);

        // Vision deducts 0.05% fee on vault's profit of 30 USDC
        // fee = 30e18 * 5 / 10000 = 0.015e18
        // net payout to vault = 130e18 - 0.015e18 = 129.985e18
        uint256 visionFee = (30 ether * 5) / 10000;
        uint256 expectedVaultBalance = 130 ether - visionFee;

        assertEq(usdc.balanceOf(address(vault)), expectedVaultBalance, "Vault balance after settlement");

        uint256 supplyBefore = vault.totalSupply();
        uint256 managerSharesBefore = vault.balanceOf(manager);

        vault.reconcile(batchId, expectedVaultBalance);

        uint256 supplyAfter = vault.totalSupply();
        uint256 managerSharesAfter = vault.balanceOf(manager);

        assertTrue(managerSharesAfter > managerSharesBefore, "Manager should receive fee shares");
        assertTrue(supplyAfter > supplyBefore, "Supply should increase from fee shares");
        assertEq(vault.totalActiveCapital(), 0);
        assertTrue(vault.highWaterMark() > 1e18, "HWM should increase after profit");
    }

    // ── Test 9: Double reconcile reverts ─────────────────────────────

    function test_reconcile_doubleRevert() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = address(vault);
        payouts[0] = DEPOSIT;
        _settleBatch(batchId, players, payouts);

        vault.reconcile(batchId, DEPOSIT);

        vm.expectRevert(IVisionVault.BatchAlreadyReconciled.selector);
        vault.reconcile(batchId, DEPOSIT);
    }

    // ── Test 10: Queued withdrawal + sweep on reconcile ──────────────

    function test_queuedWithdrawal_fulfilledOnReconcile() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        // Manager deploys all capital
        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        // Depositor requests redeem — no idle USDC, so it queues
        uint256 shares = vault.balanceOf(depositor1);
        vm.prank(depositor1);
        vault.requestRedeem(shares, depositor1, depositor1);

        // Shares should be held by vault, pending
        assertEq(vault.balanceOf(address(vault)), shares);
        assertEq(vault.pendingRedeemRequest(0, depositor1), shares);

        // Nothing claimable yet
        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NothingToClaim.selector);
        vault.claimRedeem(depositor1, depositor1);

        // Settle batch (break-even)
        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = address(vault);
        payouts[0] = DEPOSIT;
        _settleBatch(batchId, players, payouts);

        // Reconcile — should sweep the redeem queue
        vault.reconcile(batchId, DEPOSIT);

        // Now depositor can claim
        assertEq(vault.pendingRedeemRequest(0, depositor1), 0, "Pending should be cleared");

        uint256 balBefore = usdc.balanceOf(depositor1);
        vm.prank(depositor1);
        vault.claimRedeem(depositor1, depositor1);
        uint256 received = usdc.balanceOf(depositor1) - balBefore;

        assertEq(received, DEPOSIT, "Should receive full deposit back");
    }

    // ── Test 11: Sync 4626 operations blocked ────────────────────────

    function test_syncDeposit_reverts() public {
        vm.expectRevert(VisionVault.SyncDisabled.selector);
        vault.deposit(100, depositor1);
    }

    function test_syncMint_reverts() public {
        vm.expectRevert(VisionVault.SyncDisabled.selector);
        vault.mint(100, depositor1);
    }

    function test_syncWithdraw_reverts() public {
        vm.expectRevert(VisionVault.SyncDisabled.selector);
        vault.withdraw(100, depositor1, depositor1);
    }

    function test_syncRedeem_reverts() public {
        vm.expectRevert(VisionVault.SyncDisabled.selector);
        vault.redeem(100, depositor1, depositor1);
    }

    // ── Test 12: ERC-4626 view functions ─────────────────────────────

    function test_asset_returnsUSDC() public view {
        assertEq(vault.asset(), address(usdc));
    }

    function test_totalAssets_includesActiveCapital() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        assertEq(vault.totalAssets(), DEPOSIT);

        uint256 batchId = _createBatch();
        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        // USDC left the vault balance, but totalActiveCapital compensates
        assertEq(vault.totalAssets(), DEPOSIT);
    }

    function test_maxDeposit_returnsMax() public view {
        assertEq(vault.maxDeposit(depositor1), type(uint256).max);
    }

    function test_maxWithdraw_returnsZero() public view {
        assertEq(vault.maxWithdraw(depositor1), 0);
    }

    function test_convertToShares_atOneToOne() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        assertEq(vault.convertToShares(DEPOSIT), DEPOSIT);
    }

    function test_convertToAssets_atOneToOne() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        assertEq(vault.convertToAssets(DEPOSIT), DEPOSIT);
    }

    // ── Test 13: ERC-20 transfer ─────────────────────────────────────

    function test_erc20_transfer() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);

        vm.prank(depositor1);
        vault.transfer(depositor2, 50 ether);

        assertEq(vault.balanceOf(depositor1), 50 ether);
        assertEq(vault.balanceOf(depositor2), 50 ether);
    }

    // ── Test 14: Performance fee math ────────────────────────────────

    function test_performanceFee_zeroOnNoProfit() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        // Vault joins and breaks even
        bytes32 bitmapHash = keccak256("bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        address[] memory players = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        players[0] = address(vault);
        payouts[0] = DEPOSIT;
        _settleBatch(batchId, players, payouts);

        uint256 managerBefore = vault.balanceOf(manager);
        vault.reconcile(batchId, DEPOSIT);

        assertEq(vault.balanceOf(manager), managerBefore, "No fee shares on break-even");
    }

    // ── Test 15: Loss does not lower HWM ─────────────────────────────

    function test_reconcile_lossDoesNotLowerHWM() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        uint256 batchId = _createBatch();

        bytes32 bitmapHash = keccak256("vault_bitmap");
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, DEPOSIT, bitmapHash);

        // Player2 joins
        bytes32 p2Bitmap = keccak256("p2_bitmap");
        vm.prank(player2);
        vision.joinBatchDirect(batchId, CONFIG_HASH, DEPOSIT, p2Bitmap);

        // Vault loses: gets 70, player2 gets 130
        (address first, address second) = _sortTwoAddresses(address(vault), player2);
        address[] memory players = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        players[0] = first;
        players[1] = second;

        if (first == address(vault)) {
            payouts[0] = 70 ether;
            payouts[1] = 130 ether;
        } else {
            payouts[0] = 130 ether;
            payouts[1] = 70 ether;
        }

        _settleBatch(batchId, players, payouts);

        // Vault lost: gross payout=70, no profit so no fee, net=70
        uint256 hwmBefore = vault.highWaterMark();
        vault.reconcile(batchId, 70 ether);

        assertEq(vault.highWaterMark(), hwmBefore, "HWM should not decrease on loss");
        assertEq(vault.balanceOf(manager), 0, "No fee shares on loss");
    }

    // ── Test 16: idleUSDC excludes claimable ────────────────────────

    function test_idleUSDC_excludesClaimable() public {
        _requestAndClaimDeposit(depositor1, DEPOSIT);
        _requestAndClaimDeposit(depositor2, DEPOSIT);

        // depositor1 redeems — immediately claimable
        uint256 shares1 = vault.balanceOf(depositor1);
        vm.prank(depositor1);
        vault.requestRedeem(shares1, depositor1, depositor1);

        // idleUSDC should be reduced by the claimable amount
        assertEq(vault.idleUSDC(), DEPOSIT, "Idle should exclude depositor1's claimable");

        // totalAssets should include the claimable (it's in vault balance)
        // but totalSupply went down, so NAV shifts
    }

    // ── Test 17: Multiple batches ───────────────────────────────────

    function test_multipleBatches_trackIndependently() public {
        _requestAndClaimDeposit(depositor1, 500 ether);

        uint256 batchId1 = _createBatch();
        uint256 batchId2 = _createBatch();

        bytes32 bitmap = keccak256("bitmap");

        vm.prank(manager);
        vault.joinBatch(batchId1, CONFIG_HASH, 200 ether, bitmap);

        // Need a fresh bitmap hash since Vision tracks per-player per-batch
        // but configHash is same. Actually joinBatch calls Vision as msg.sender=vault
        // so vault joins both batches. Vision requires AlreadyJoined per batch, not globally.
        vm.prank(manager);
        vault.joinBatch(batchId2, CONFIG_HASH, 100 ether, bitmap);

        assertEq(vault.activeBatchDeposits(batchId1), 200 ether);
        assertEq(vault.activeBatchDeposits(batchId2), 100 ether);
        assertEq(vault.totalActiveCapital(), 300 ether);
        assertEq(vault.idleUSDC(), 200 ether);
    }

    // ── Test 18: refundStuckBatch reconciles NAV ─────────────────────

    /// @notice The vault NAV bug fix. After a batch goes stuck and the grace
    ///         elapses, refundStuckBatch must atomically pull USDC back AND
    ///         clear activeBatchDeposits + totalActiveCapital. Without that
    ///         atomic update, NAV silently double-counts the recovered USDC
    ///         and over-pays the next redeemer.
    /// @dev    Deposits are sized so joinAmount stays inside the 5% per-batch
    ///         cap (MAX_BATCH_BPS = 500). 200 of 10000 = 2%, well under.
    function test_refundStuckBatch_recoversCapital() public {
        _requestAndClaimDeposit(depositor1, 10000 ether);

        uint256 batchId = _createBatch();
        bytes32 bitmap = keccak256("bitmap");

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 200 ether, bitmap);

        assertEq(vault.activeBatchDeposits(batchId), 200 ether);
        assertEq(vault.totalActiveCapital(), 200 ether);
        assertEq(vault.idleUSDC(), 9800 ether);
        uint256 totalAssetsBefore = vault.totalAssets();

        // Oracle goes silent. Grace expires.
        vm.warp(vision.batchExpirationTime(batchId) + 1);

        // Anyone can fire the rescue — try a random caller, not the manager.
        address rescuer = makeAddr("rescuer");
        vm.prank(rescuer);
        vault.refundStuckBatch(batchId);

        // Active tracking cleared, idle restored, NAV unchanged.
        assertEq(vault.activeBatchDeposits(batchId), 0, "active deposit cleared");
        assertEq(vault.totalActiveCapital(), 0, "active capital cleared");
        assertEq(vault.idleUSDC(), 10000 ether, "USDC fully returned to idle");
        assertEq(vault.totalAssets(), totalAssetsBefore, "totalAssets preserved: no double-count, no loss");
    }

    /// @notice Calling refundStuckBatch twice — second call must revert
    ///         because activeBatchDeposits[batchId] is already zero.
    function test_refundStuckBatch_rejectsDouble() public {
        _requestAndClaimDeposit(depositor1, 10000 ether);

        uint256 batchId = _createBatch();
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100 ether, keccak256("bm"));

        vm.warp(vision.batchExpirationTime(batchId) + 1);

        vault.refundStuckBatch(batchId);

        vm.expectRevert(IVisionVault.BatchAlreadyReconciled.selector);
        vault.refundStuckBatch(batchId);
    }

    /// @notice refundStuckBatch must revert before the grace window has
    ///         elapsed — the underlying claimRefund will reject with
    ///         NotYetRefundable.
    function test_refundStuckBatch_rejectsBeforeExpiration() public {
        _requestAndClaimDeposit(depositor1, 10000 ether);

        uint256 batchId = _createBatch();
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100 ether, keccak256("bm"));

        // Don't warp — still in the grace window.
        vm.expectRevert(IVision.NotYetRefundable.selector);
        vault.refundStuckBatch(batchId);
    }
}
