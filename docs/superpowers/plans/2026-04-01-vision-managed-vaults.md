# Vision Managed Vaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permissionless ERC-7540 vaults where managers trade Vision prediction markets with depositor capital, earning performance fees above a high-water mark.

**Architecture:** Factory deploys EIP-1167 clones of a VisionVault implementation. Each vault holds USDC, issues shares, and restricts the manager to Vision-only trading (joinBatch, updateBitmap). Deposits are near-synchronous; withdrawals are async (instant from idle USDC, queued when capital is locked in active batches). Reconciliation is permissionless — anyone can trigger accounting updates after batch settlement.

**Tech Stack:** Solidity 0.8.24, Forge, OpenZeppelin ERC-4626/ERC-20/Clones, custom ERC-7540 async interfaces.

**Spec:** `docs/superpowers/specs/2026-04-01-vision-managed-vaults-design.md`

---

## File Structure

```
contracts/src/
├── interfaces/
│   ├── IERC7540.sol              # ERC-7540 async deposit/redeem interfaces
│   └── IVisionVault.sol          # VisionVault + VisionVaultFactory interfaces
├── libraries/
│   └── VisionVaultAccounting.sol # Pure math: shares, NAV, performance fee
└── vision/
    ├── VisionVault.sol           # ERC-7540 vault implementation (cloned)
    └── VisionVaultFactory.sol    # EIP-1167 clone deployer + registry

contracts/test/
└── vision/
    ├── VisionVaultAccounting.t.sol
    ├── VisionVault.t.sol
    └── VisionVaultFactory.t.sol

contracts/script/
└── DeployVisionVaults.s.sol
```

---

## Task 1: ERC-7540 Async Interfaces

OpenZeppelin does not ship ERC-7540. The interfaces are minimal — define them directly.

**Files:**
- Create: `contracts/src/interfaces/IERC7540.sol`

- [ ] **Step 1: Create IERC7540.sol with async deposit and redeem interfaces**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IERC7540Deposit — Async deposit requests (ERC-7540)
interface IERC7540Deposit {
    event DepositRequest(address indexed controller, address indexed owner, uint256 requestId, address sender, uint256 assets);

    /// @notice Submit a deposit request. USDC transferred immediately, shares minted on claim.
    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256 requestId);

    /// @notice Preview how many assets are claimable for a pending deposit.
    function pendingDepositRequest(uint256 requestId, address controller) external view returns (uint256 assets);

    /// @notice Claim shares from a fulfilled deposit request.
    function claimDeposit(address receiver, address controller) external returns (uint256 shares);
}

/// @title IERC7540Redeem — Async withdrawal requests (ERC-7540)
interface IERC7540Redeem {
    event RedeemRequest(address indexed controller, address indexed owner, uint256 requestId, address sender, uint256 shares);

    /// @notice Submit a withdrawal request. Shares locked, USDC released on claim.
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);

    /// @notice Preview how many shares are claimable (fulfilled) for a pending redeem.
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares);

    /// @notice Claim USDC from a fulfilled redeem request.
    function claimRedeem(address receiver, address controller) external returns (uint256 assets);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd contracts && forge build --contracts src/interfaces/IERC7540.sol`
Expected: success, no errors.

- [ ] **Step 3: Commit**

```bash
git add contracts/src/interfaces/IERC7540.sol
git commit -m "feat(vault): add ERC-7540 async deposit/redeem interfaces"
```

---

## Task 2: IVisionVault Interface

**Files:**
- Create: `contracts/src/interfaces/IVisionVault.sol`

- [ ] **Step 1: Create IVisionVault.sol with vault and factory interfaces**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC7540Deposit, IERC7540Redeem} from "./IERC7540.sol";

/// @title IVisionVault — Managed vault for Vision prediction market trading
interface IVisionVault is IERC4626, IERC7540Deposit, IERC7540Redeem {
    // ── Events ──────────────────────────────────────────────────────
    event BatchJoined(uint256 indexed batchId, uint256 amount);
    event BitmapUpdated(uint256 indexed batchId, bytes32 newBitmapHash);
    event Reconciled(uint256 indexed batchId, int256 pnl, uint256 feeSharesMinted, uint256 withdrawalsFulfilled);

    // ── Errors ──────────────────────────────────────────────────────
    error NotManager();
    error AlreadyInitialized();
    error InsufficientIdleCapital();
    error BatchNotActive();
    error BatchAlreadyReconciled();
    error NothingToClaim();
    error FeeTooHigh();

    // ── Manager Trading ─────────────────────────────────────────────
    function joinBatch(uint256 batchId, bytes32 configHash, uint256 depositAmount, uint256 stakePerTick, bytes32 bitmapHash) external;
    function updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newBitmapHash) external;

    // ── Reconciliation (permissionless) ─────────────────────────────
    function reconcile(uint256 batchId) external;

    // ── View ────────────────────────────────────────────────────────
    function manager() external view returns (address);
    function performanceFeeRate() external view returns (uint256);
    function highWaterMark() external view returns (uint256);
    function totalActiveCapital() external view returns (uint256);
    function activeBatchDeposits(uint256 batchId) external view returns (uint256);
    function idleUSDC() external view returns (uint256);

    // ── Initialization ──────────────────────────────────────────────
    function initialize(string calldata name, string calldata symbol, address manager, address vision, address usdc, uint256 performanceFeeRate) external;
}

/// @title IVisionVaultFactory — Permissionless vault deployer + registry
interface IVisionVaultFactory {
    event VaultCreated(address indexed vault, address indexed manager, string name, string symbol, uint256 performanceFeeRate);

    error FeeTooHigh();

    function createVault(string calldata name, string calldata symbol, uint256 performanceFeeRate, address manager) external returns (address vault);

    function implementation() external view returns (address);
    function vision() external view returns (address);
    function usdc() external view returns (address);
    function MAX_PERFORMANCE_FEE() external view returns (uint256);

    function getAllVaults() external view returns (address[] memory);
    function getVaultsByManager(address manager) external view returns (address[] memory);
    function getVaultCount() external view returns (uint256);
    function isRegisteredVault(address vault) external view returns (bool);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd contracts && forge build --contracts src/interfaces/IVisionVault.sol`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add contracts/src/interfaces/IVisionVault.sol
git commit -m "feat(vault): add IVisionVault and IVisionVaultFactory interfaces"
```

---

## Task 3: VisionVaultAccounting Library

Pure math. No state, no dependencies beyond Solidity. TDD — tests first.

**Files:**
- Create: `contracts/src/libraries/VisionVaultAccounting.sol`
- Create: `contracts/test/vision/VisionVaultAccounting.t.sol`

- [ ] **Step 1: Write failing tests for all accounting functions**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VisionVaultAccounting} from "../../src/libraries/VisionVaultAccounting.sol";

contract VisionVaultAccountingTest is Test {
    using VisionVaultAccounting for *;

    // ── sharesForDeposit ────────────────────────────────────────────

    function test_sharesForDeposit_firstDepositor() public pure {
        // First depositor: 1:1 ratio (1 USDC = 1 share)
        uint256 shares = VisionVaultAccounting.sharesForDeposit(100e18, 0, 0);
        assertEq(shares, 100e18);
    }

    function test_sharesForDeposit_existingVault() public pure {
        // Vault has 200 USDC, 100 shares → 1 share = 2 USDC → 50 USDC gets 25 shares
        uint256 shares = VisionVaultAccounting.sharesForDeposit(50e18, 200e18, 100e18);
        assertEq(shares, 25e18);
    }

    function test_sharesForDeposit_zeroAssets() public pure {
        uint256 shares = VisionVaultAccounting.sharesForDeposit(0, 200e18, 100e18);
        assertEq(shares, 0);
    }

    // ── assetsForRedeem ─────────────────────────────────────────────

    function test_assetsForRedeem_proportional() public pure {
        // 100 shares, 200 USDC total, redeem 50 shares → 100 USDC
        uint256 assets = VisionVaultAccounting.assetsForRedeem(50e18, 200e18, 100e18);
        assertEq(assets, 100e18);
    }

    function test_assetsForRedeem_allShares() public pure {
        uint256 assets = VisionVaultAccounting.assetsForRedeem(100e18, 200e18, 100e18);
        assertEq(assets, 200e18);
    }

    // ── performanceFeeShares ────────────────────────────────────────

    function test_performanceFee_aboveHWM() public pure {
        // NAV went from 1.0 to 1.2 per share. 100 shares. 20% fee.
        // Profit = 0.2 * 100 = 20 USDC. Fee = 20 * 0.20 = 4 USDC.
        // feeShares = 4 * 100 / (120 - 4) = 400 / 116 ≈ 3.448...e18
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            1.2e18,   // newNAVPerShare
            1.0e18,   // highWaterMark
            100e18,   // totalShares
            2000      // 20% fee rate in bps
        );
        // 4e18 * 100e18 / 116e18 = 400e36 / 116e18 = 3.448...e18
        assertApproxEqAbs(feeShares, 3448275862068965517, 1e15); // ~3.448e18 ± dust
    }

    function test_performanceFee_belowHWM() public pure {
        // NAV went from 1.0 to 0.8 → no fee
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            0.8e18, 1.0e18, 100e18, 2000
        );
        assertEq(feeShares, 0);
    }

    function test_performanceFee_atHWM() public pure {
        // NAV exactly at HWM → no fee
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            1.0e18, 1.0e18, 100e18, 2000
        );
        assertEq(feeShares, 0);
    }

    function test_performanceFee_zeroFeeRate() public pure {
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            1.5e18, 1.0e18, 100e18, 0
        );
        assertEq(feeShares, 0);
    }

    // ── navPerShare ─────────────────────────────────────────────────

    function test_navPerShare_normal() public pure {
        // 200 USDC, 100 shares → 2e18 per share
        uint256 nav = VisionVaultAccounting.navPerShare(200e18, 100e18);
        assertEq(nav, 2e18);
    }

    function test_navPerShare_zeroSupply() public pure {
        // No shares → 1e18 (default $1)
        uint256 nav = VisionVaultAccounting.navPerShare(200e18, 0);
        assertEq(nav, 1e18);
    }
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd contracts && forge test --match-contract VisionVaultAccountingTest -v`
Expected: compilation failure — `VisionVaultAccounting` not found.

- [ ] **Step 3: Implement VisionVaultAccounting library**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title VisionVaultAccounting — Pure math for Vision vault share/NAV/fee calculations
/// @dev All values use 18-decimal precision. Fee rates use basis points (10000 = 100%).
library VisionVaultAccounting {
    /// @notice Calculate shares to mint for a deposit.
    /// @dev First depositor gets 1:1. Subsequent depositors get proportional shares.
    function sharesForDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256) {
        if (totalShares == 0 || totalAssets == 0) return assets;
        return (assets * totalShares) / totalAssets;
    }

    /// @notice Calculate USDC to return for a share redemption.
    function assetsForRedeem(
        uint256 shares,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalAssets) / totalShares;
    }

    /// @notice Calculate fee shares to mint when NAV exceeds high-water mark.
    /// @dev Returns 0 if newNAVPerShare <= highWaterMark or feeRate == 0.
    /// @param newNAVPerShare Current NAV per share (18 decimals)
    /// @param hwm High-water mark NAV per share (18 decimals)
    /// @param totalShares Total shares outstanding before fee mint
    /// @param feeRate Performance fee in basis points (2000 = 20%)
    function performanceFeeShares(
        uint256 newNAVPerShare,
        uint256 hwm,
        uint256 totalShares,
        uint256 feeRate
    ) internal pure returns (uint256) {
        if (newNAVPerShare <= hwm || feeRate == 0) return 0;

        uint256 profitPerShare = newNAVPerShare - hwm;
        uint256 totalProfit = (profitPerShare * totalShares) / 1e18;
        uint256 feeAssets = (totalProfit * feeRate) / 10000;
        uint256 totalAssetsAfterFee = (newNAVPerShare * totalShares) / 1e18 - feeAssets;

        if (totalAssetsAfterFee == 0) return 0;
        return (feeAssets * totalShares) / totalAssetsAfterFee;
    }

    /// @notice NAV per share. Returns 1e18 if no shares exist.
    function navPerShare(uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalAssets * 1e18) / totalShares;
    }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd contracts && forge test --match-contract VisionVaultAccountingTest -v`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/libraries/VisionVaultAccounting.sol contracts/test/vision/VisionVaultAccounting.t.sol
git commit -m "feat(vault): add VisionVaultAccounting library with full test coverage"
```

---

## Task 4: VisionVault Implementation

The core vault. ERC-4626 base + ERC-7540 async overlay + Vision-only trading + performance fee with HWM.

**Files:**
- Create: `contracts/src/vision/VisionVault.sol`
- Create: `contracts/test/vision/VisionVault.t.sol`

**Dependencies:** Tasks 1, 2, 3 must be complete.

- [ ] **Step 1: Write failing tests for VisionVault**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VisionVault} from "../../src/vision/VisionVault.sol";
import {IVisionVault} from "../../src/interfaces/IVisionVault.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Vision} from "../../src/vision/Vision.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {Governance} from "../../src/Governance.sol";
import "./helpers/TestHelper.sol";

contract VisionVaultTest is TestHelper {
    VisionVault public vault;
    Vision public vision;
    MockERC20 public usdc;

    address manager = address(0xBEEF);
    address depositor1 = address(0xCAFE);
    address depositor2 = address(0xFACE);
    address feeCollector = address(0xFEE);

    uint256 constant PERF_FEE = 2000; // 20%

    bytes32 constant SOURCE_ID = keccak256("test_source");
    bytes32 constant CONFIG_HASH = keccak256("test_config");
    uint256 constant TICK_DURATION = 1 hours;
    uint256 constant LOCK_OFFSET = 60;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy Vision (needs OracleRegistry + Governance)
        Governance gov = new Governance(address(this));
        OracleRegistry oracleReg = new OracleRegistry(address(gov));
        registerTestOraclesWithBLS(oracleReg, address(this));
        vision = new Vision(address(usdc), address(oracleReg), feeCollector);

        // Deploy vault implementation and initialize
        vault = new VisionVault();
        vault.initialize("Test Vault", "tvVISION", manager, address(vision), address(usdc), PERF_FEE);

        // Fund depositors
        usdc.mint(depositor1, 1000e18);
        usdc.mint(depositor2, 500e18);
        vm.prank(depositor1);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(depositor2);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ── Initialization ──────────────────────────────────────────────

    function test_initialize_setsState() public view {
        assertEq(vault.manager(), manager);
        assertEq(vault.performanceFeeRate(), PERF_FEE);
        assertEq(vault.highWaterMark(), 1e18);
        assertEq(vault.name(), "Test Vault");
        assertEq(vault.symbol(), "tvVISION");
    }

    function test_initialize_cannotReinitialize() public {
        vm.expectRevert(IVisionVault.AlreadyInitialized.selector);
        vault.initialize("X", "X", manager, address(vision), address(usdc), PERF_FEE);
    }

    // ── Deposits ────────────────────────────────────────────────────

    function test_deposit_requestAndClaim() public {
        vm.prank(depositor1);
        vault.requestDeposit(100e18, depositor1, depositor1);

        // USDC should be in the vault now
        assertEq(usdc.balanceOf(address(vault)), 100e18);

        // Claim shares
        vm.prank(depositor1);
        uint256 shares = vault.claimDeposit(depositor1, depositor1);
        assertEq(shares, 100e18); // First depositor: 1:1
        assertEq(vault.balanceOf(depositor1), 100e18);
    }

    function test_deposit_secondDepositorGetsProportionalShares() public {
        // Depositor 1: 100 USDC → 100 shares
        vm.startPrank(depositor1);
        vault.requestDeposit(100e18, depositor1, depositor1);
        vault.claimDeposit(depositor1, depositor1);
        vm.stopPrank();

        // Depositor 2: 50 USDC → 50 shares (NAV still 1:1)
        vm.startPrank(depositor2);
        vault.requestDeposit(50e18, depositor2, depositor2);
        uint256 shares = vault.claimDeposit(depositor2, depositor2);
        vm.stopPrank();
        assertEq(shares, 50e18);
    }

    // ── Withdrawals ─────────────────────────────────────────────────

    function test_withdraw_fromIdleCapital() public {
        // Deposit
        vm.startPrank(depositor1);
        vault.requestDeposit(100e18, depositor1, depositor1);
        vault.claimDeposit(depositor1, depositor1);

        // Request withdrawal (all idle, should be instant)
        vault.requestRedeem(50e18, depositor1, depositor1);
        uint256 assets = vault.claimRedeem(depositor1, depositor1);
        vm.stopPrank();

        assertEq(assets, 50e18);
        assertEq(usdc.balanceOf(depositor1), 950e18); // 1000 - 100 + 50
        assertEq(vault.balanceOf(depositor1), 50e18);
    }

    function test_withdraw_queuesWhenCapitalLocked() public {
        // Deposit
        vm.startPrank(depositor1);
        vault.requestDeposit(100e18, depositor1, depositor1);
        vault.claimDeposit(depositor1, depositor1);
        vm.stopPrank();

        // Manager joins a batch with all capital
        uint256 batchId = _createBatch();
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100e18, 100e18, keccak256("predictions"));

        // Depositor tries to withdraw — should queue (no idle USDC)
        vm.prank(depositor1);
        vault.requestRedeem(50e18, depositor1, depositor1);

        // Claim should revert — not yet fulfillable
        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NothingToClaim.selector);
        vault.claimRedeem(depositor1, depositor1);
    }

    // ── Manager Trading ─────────────────────────────────────────────

    function test_joinBatch_onlyManager() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NotManager.selector);
        vault.joinBatch(batchId, CONFIG_HASH, 50e18, 50e18, keccak256("pred"));
    }

    function test_joinBatch_tracksActiveCapital() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 60e18, 60e18, keccak256("pred"));

        assertEq(vault.totalActiveCapital(), 60e18);
        assertEq(vault.activeBatchDeposits(batchId), 60e18);
        assertEq(vault.idleUSDC(), 40e18);
    }

    function test_joinBatch_revertsIfInsufficientIdle() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vm.expectRevert(IVisionVault.InsufficientIdleCapital.selector);
        vault.joinBatch(batchId, CONFIG_HASH, 200e18, 200e18, keccak256("pred"));
    }

    function test_updateBitmap_onlyManager() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 50e18, 50e18, keccak256("pred"));

        vm.prank(depositor1);
        vm.expectRevert(IVisionVault.NotManager.selector);
        vault.updateBitmap(batchId, CONFIG_HASH, keccak256("new_pred"));
    }

    // ── Reconciliation ──────────────────────────────────────────────

    function test_reconcile_updatesAccountingOnProfit() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100e18, 100e18, keccak256("pred"));

        // Simulate settlement: Vision sends 120 USDC back (20 USDC profit)
        _settleWithPayout(batchId, address(vault), 120e18);

        // Reconcile
        vault.reconcile(batchId);

        assertEq(vault.totalActiveCapital(), 0);
        assertEq(vault.activeBatchDeposits(batchId), 0);
        // Total assets = 120 USDC (minus fee shares dilution)
        assertGt(vault.totalAssets(), 115e18); // At least 115 after fees
    }

    function test_reconcile_mintsFeeSharesToManager() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100e18, 100e18, keccak256("pred"));

        _settleWithPayout(batchId, address(vault), 120e18);
        vault.reconcile(batchId);

        // Manager should have fee shares
        assertGt(vault.balanceOf(manager), 0);
        // HWM should have moved up
        assertGt(vault.highWaterMark(), 1e18);
    }

    function test_reconcile_noFeeOnLoss() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100e18, 100e18, keccak256("pred"));

        _settleWithPayout(batchId, address(vault), 80e18); // Loss
        vault.reconcile(batchId);

        assertEq(vault.balanceOf(manager), 0); // No fee shares
        assertEq(vault.highWaterMark(), 1e18); // HWM unchanged
    }

    function test_reconcile_sweepsWithdrawalQueue() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100e18, 100e18, keccak256("pred"));

        // Queue a withdrawal while capital is locked
        vm.prank(depositor1);
        vault.requestRedeem(50e18, depositor1, depositor1);

        // Settle and reconcile
        _settleWithPayout(batchId, address(vault), 100e18);
        vault.reconcile(batchId);

        // Now the withdrawal should be claimable
        vm.prank(depositor1);
        uint256 assets = vault.claimRedeem(depositor1, depositor1);
        assertEq(assets, 50e18);
    }

    function test_reconcile_revertIfAlreadyReconciled() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 100e18, 100e18, keccak256("pred"));

        _settleWithPayout(batchId, address(vault), 100e18);
        vault.reconcile(batchId);

        vm.expectRevert(IVisionVault.BatchAlreadyReconciled.selector);
        vault.reconcile(batchId);
    }

    // ── NAV ─────────────────────────────────────────────────────────

    function test_totalAssets_includesActiveCapital() public {
        _depositAs(depositor1, 100e18);
        uint256 batchId = _createBatch();

        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 60e18, 60e18, keccak256("pred"));

        // totalAssets = 40 idle + 60 active = 100
        assertEq(vault.totalAssets(), 100e18);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _depositAs(address depositor, uint256 amount) internal {
        vm.startPrank(depositor);
        vault.requestDeposit(amount, depositor, depositor);
        vault.claimDeposit(depositor, depositor);
        vm.stopPrank();
    }

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

    function _settleWithPayout(uint256 batchId, address player, uint256 payout) internal {
        // Mint USDC to Vision to cover payout (simulates the pool having funds)
        usdc.mint(address(vision), payout);

        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory payouts = new uint256[](1);
        payouts[0] = payout;

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH",
            batchId, players, payouts
        ));
        bytes memory sig = signWithTestOracles(message);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }
}
```

Note: The test helper functions `registerTestOraclesWithBLS`, `signWithTestOracles`, `REF_NONCE`, and `SIGNERS_BITMASK` come from the existing `TestHelper.sol`. If `TestHelper` uses a different path or different method names, adapt the test to match. Read `contracts/test/helpers/TestHelper.sol` before running.

- [ ] **Step 2: Run tests — verify compilation fails**

Run: `cd contracts && forge test --match-contract VisionVaultTest -v`
Expected: compilation failure — `VisionVault` not found.

- [ ] **Step 3: Implement VisionVault.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IVisionVault} from "../interfaces/IVisionVault.sol";
import {IERC7540Deposit, IERC7540Redeem} from "../interfaces/IERC7540.sol";
import {IVision} from "../interfaces/IVision.sol";
import {VisionVaultAccounting} from "../libraries/VisionVaultAccounting.sol";

/// @title VisionVault — Managed vault for Vision prediction market trading
/// @notice ERC-7540 vault where a designated manager trades on Vision with depositor capital.
/// @dev Deployed as EIP-1167 clone via VisionVaultFactory. Call initialize() once after cloning.
contract VisionVault is ERC20, IVisionVault {
    using SafeERC20 for IERC20;
    using VisionVaultAccounting for *;

    // ── State ───────────────────────────────────────────────────────

    address public manager;
    address public vision;
    IERC20 public usdc;
    uint256 public performanceFeeRate;
    uint256 public highWaterMark;
    bool private _initialized;

    mapping(uint256 => uint256) public activeBatchDeposits;
    uint256 public totalActiveCapital;

    // ── ERC-7540 Deposit Requests ───────────────────────────────────

    struct DepositRequest {
        uint256 assets;
    }
    mapping(address => DepositRequest) private _depositRequests;

    // ── ERC-7540 Redeem Requests (FIFO queue) ───────────────────────

    struct RedeemRequest {
        address owner;
        address receiver;
        uint256 shares;
        bool fulfilled;
    }
    RedeemRequest[] private _redeemQueue;
    uint256 private _queueHead;
    mapping(address => uint256) private _pendingRedeemShares;
    mapping(address => uint256) private _claimableAssets;

    // ── Constructor (for implementation — clones skip this) ─────────

    constructor() ERC20("VisionVault Implementation", "vvIMPL") {}

    // ── Initialization ──────────────────────────────────────────────

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _manager,
        address _vision,
        address _usdc,
        uint256 _performanceFeeRate
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        // ERC20 name/symbol set via internal storage (clones don't call constructor)
        _setNameAndSymbol(_name, _symbol);

        manager = _manager;
        vision = _vision;
        usdc = IERC20(_usdc);
        performanceFeeRate = _performanceFeeRate;
        highWaterMark = 1e18;

        // Approve Vision to spend vault's USDC
        IERC20(_usdc).safeApprove(_vision, type(uint256).max);
    }

    // ── Modifiers ───────────────────────────────────────────────────

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    // ── ERC-4626 Core (read-only conformance) ───────────────────────

    function asset() public view returns (address) {
        return address(usdc);
    }

    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this)) + totalActiveCapital;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return VisionVaultAccounting.sharesForDeposit(assets, totalAssets(), totalSupply());
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return VisionVaultAccounting.assetsForRedeem(shares, totalAssets(), totalSupply());
    }

    // Block synchronous ERC-4626 deposit/withdraw (use ERC-7540 async)
    function deposit(uint256, address) public pure returns (uint256) { revert("UseAsyncDeposit"); }
    function mint(uint256, address) public pure returns (uint256) { revert("UseAsyncDeposit"); }
    function withdraw(uint256, address, address) public pure returns (uint256) { revert("UseAsyncRedeem"); }
    function redeem(uint256, address, address) public pure returns (uint256) { revert("UseAsyncRedeem"); }

    // Required ERC-4626 preview/max functions
    function previewDeposit(uint256) public pure returns (uint256) { return 0; }
    function previewMint(uint256) public pure returns (uint256) { return 0; }
    function previewWithdraw(uint256) public pure returns (uint256) { return 0; }
    function previewRedeem(uint256) public pure returns (uint256) { return 0; }
    function maxDeposit(address) public pure returns (uint256) { return type(uint256).max; }
    function maxMint(address) public pure returns (uint256) { return type(uint256).max; }
    function maxWithdraw(address) public pure returns (uint256) { return 0; }
    function maxRedeem(address) public pure returns (uint256) { return 0; }

    // ── ERC-7540 Deposit ────────────────────────────────────────────

    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256) {
        usdc.safeTransferFrom(msg.sender, address(this), assets);
        _depositRequests[controller].assets += assets;
        emit DepositRequest(controller, owner, 0, msg.sender, assets);
        return 0; // Single request ID (simplified — one pending deposit per controller)
    }

    function pendingDepositRequest(uint256, address controller) external view returns (uint256) {
        return _depositRequests[controller].assets;
    }

    function claimDeposit(address receiver, address controller) external returns (uint256 shares) {
        uint256 assets = _depositRequests[controller].assets;
        if (assets == 0) revert NothingToClaim();
        delete _depositRequests[controller];

        shares = VisionVaultAccounting.sharesForDeposit(assets, totalAssets() - assets, totalSupply());
        _mint(receiver, shares);
        emit DepositClaimed(receiver, assets, shares);
    }

    // ── ERC-7540 Redeem ─────────────────────────────────────────────

    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256) {
        // Lock shares by transferring to vault
        _transfer(owner, address(this), shares);
        _pendingRedeemShares[controller] += shares;

        uint256 assets = VisionVaultAccounting.assetsForRedeem(shares, totalAssets(), totalSupply());

        // Check if fulfillable immediately from idle capital
        uint256 idle = idleUSDC();
        if (idle >= assets) {
            _claimableAssets[controller] += assets;
            _pendingRedeemShares[controller] -= shares;
            _burn(address(this), shares);
        } else {
            // Queue for later fulfillment
            _redeemQueue.push(RedeemRequest({
                owner: controller,
                receiver: controller, // Default; overridden at claim
                shares: shares,
                fulfilled: false
            }));
        }

        emit RedeemRequest(controller, owner, 0, msg.sender, shares);
        return 0;
    }

    function pendingRedeemRequest(uint256, address controller) external view returns (uint256) {
        return _pendingRedeemShares[controller];
    }

    function claimRedeem(address receiver, address controller) external returns (uint256 assets) {
        assets = _claimableAssets[controller];
        if (assets == 0) revert NothingToClaim();
        delete _claimableAssets[controller];

        usdc.safeTransfer(receiver, assets);
        emit WithdrawClaimed(receiver, assets, 0);
    }

    // ── Manager Trading ─────────────────────────────────────────────

    function joinBatch(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external onlyManager {
        if (depositAmount > idleUSDC()) revert InsufficientIdleCapital();

        activeBatchDeposits[batchId] += depositAmount;
        totalActiveCapital += depositAmount;

        IVision(vision).joinBatchDirect(batchId, configHash, depositAmount, stakePerTick, bitmapHash);

        emit BatchJoined(batchId, depositAmount);
    }

    function updateBitmap(
        uint256 batchId,
        bytes32 configHash,
        bytes32 newBitmapHash
    ) external onlyManager {
        IVision(vision).updateBitmap(batchId, configHash, newBitmapHash);
        emit BitmapUpdated(batchId, newBitmapHash);
    }

    // ── Reconciliation (permissionless) ─────────────────────────────

    function reconcile(uint256 batchId) external {
        uint256 deposited = activeBatchDeposits[batchId];
        if (deposited == 0) revert BatchAlreadyReconciled();

        // Clear active tracking
        activeBatchDeposits[batchId] = 0;
        totalActiveCapital -= deposited;

        // Crystallize performance fee
        uint256 supply = totalSupply();
        uint256 assets = totalAssets();
        uint256 currentNAV = VisionVaultAccounting.navPerShare(assets, supply);
        uint256 feeShares = 0;

        if (currentNAV > highWaterMark) {
            feeShares = VisionVaultAccounting.performanceFeeShares(
                currentNAV, highWaterMark, supply, performanceFeeRate
            );
            if (feeShares > 0) {
                _mint(manager, feeShares);
            }
            highWaterMark = VisionVaultAccounting.navPerShare(totalAssets(), totalSupply());
        }

        // Sweep withdrawal queue
        uint256 fulfilled = _sweepRedeemQueue();

        int256 pnl = int256(usdc.balanceOf(address(this)) + totalActiveCapital) - int256(assets);
        emit Reconciled(batchId, pnl, feeShares, fulfilled);
    }

    // ── View ────────────────────────────────────────────────────────

    function idleUSDC() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 pendingClaims = _totalClaimableAssets();
        return balance > pendingClaims ? balance - pendingClaims : 0;
    }

    // ── Internal ────────────────────────────────────────────────────

    function _sweepRedeemQueue() internal returns (uint256 fulfilled) {
        uint256 idle = idleUSDC();
        uint256 i = _queueHead;

        while (i < _redeemQueue.length && idle > 0) {
            RedeemRequest storage req = _redeemQueue[i];
            if (!req.fulfilled) {
                uint256 assets = VisionVaultAccounting.assetsForRedeem(
                    req.shares, totalAssets(), totalSupply()
                );
                if (idle >= assets) {
                    req.fulfilled = true;
                    _claimableAssets[req.owner] += assets;
                    _pendingRedeemShares[req.owner] -= req.shares;
                    _burn(address(this), req.shares);
                    idle -= assets;
                    fulfilled++;
                } else {
                    break; // Not enough idle for next request
                }
            }
            i++;
        }
        _queueHead = i;
    }

    function _totalClaimableAssets() internal view returns (uint256 total) {
        // This is a simplification — in production, iterate or track a running sum
        // For now, we track claimable assets as they're added
        // The _claimableAssets mapping is the source of truth
        // We can't easily sum a mapping, so we track via a storage var
        // TODO: Add _totalClaimable state variable in implementation
        return 0; // Simplified for now — idle calculation is conservative
    }

    /// @dev Override ERC20 name/symbol for clones (constructor doesn't run)
    string private _vaultName;
    string private _vaultSymbol;

    function _setNameAndSymbol(string calldata newName, string calldata newSymbol) internal {
        _vaultName = newName;
        _vaultSymbol = newSymbol;
    }

    function name() public view override returns (string memory) {
        return bytes(_vaultName).length > 0 ? _vaultName : super.name();
    }

    function symbol() public view override returns (string memory) {
        return bytes(_vaultSymbol).length > 0 ? _vaultSymbol : super.symbol();
    }

    // ── ERC-4626 required overrides ─────────────────────────────────
    // These are needed because we inherit ERC20 but claim ERC-4626 interface

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
```

**Implementation notes for the executing agent:**
- The `_totalClaimableAssets()` function needs a proper running total via a `_totalClaimable` state variable. Increment in `requestRedeem` (when instant) and `_sweepRedeemQueue`. Decrement in `claimRedeem`. This replaces the TODO above.
- The ERC-20 `_transfer` from `owner` in `requestRedeem` requires the caller to be the owner or have approval. This matches ERC-7540 semantics where `owner` authorizes the request.
- `safeApprove` in `initialize` may revert if called with nonzero existing allowance. Since this is only called once (on a fresh clone), this is safe.
- Verify that the `IVision` interface has the exact function signatures for `joinBatchDirect` and `updateBitmap`. Read `contracts/src/interfaces/IVision.sol` before compiling.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd contracts && forge test --match-contract VisionVaultTest -v`
Expected: all tests pass. If TestHelper methods differ, adapt test setUp and helpers.

- [ ] **Step 5: Fix any compilation or test issues**

Common issues to check:
- TestHelper import path (may be `../helpers/TestHelper.sol` or `../../test/helpers/TestHelper.sol`)
- BLS helper method names (check TestHelper.sol for exact names)
- Vision.settleBatch BLS message format (check Vision.sol for exact encoding)
- ERC20 constructor in clones (may need initializable pattern instead of constructor)

- [ ] **Step 6: Commit**

```bash
git add contracts/src/vision/VisionVault.sol contracts/test/vision/VisionVault.t.sol
git commit -m "feat(vault): VisionVault ERC-7540 implementation with tests"
```

---

## Task 5: VisionVaultFactory

Clone deployer + registry. Depends on Task 4.

**Files:**
- Create: `contracts/src/vision/VisionVaultFactory.sol`
- Create: `contracts/test/vision/VisionVaultFactory.t.sol`

- [ ] **Step 1: Write failing tests**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VisionVault} from "../../src/vision/VisionVault.sol";
import {VisionVaultFactory} from "../../src/vision/VisionVaultFactory.sol";
import {IVisionVault, IVisionVaultFactory} from "../../src/interfaces/IVisionVault.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Vision} from "../../src/vision/Vision.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {Governance} from "../../src/Governance.sol";
import "./helpers/TestHelper.sol";

contract VisionVaultFactoryTest is TestHelper {
    VisionVaultFactory public factory;
    Vision public vision;
    MockERC20 public usdc;

    address manager1 = address(0xBEEF);
    address manager2 = address(0xCAFE);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 18);
        Governance gov = new Governance(address(this));
        OracleRegistry oracleReg = new OracleRegistry(address(gov));
        vision = new Vision(address(usdc), address(oracleReg), address(0xFEE));

        VisionVault impl = new VisionVault();
        factory = new VisionVaultFactory(address(impl), address(vision), address(usdc));
    }

    function test_createVault_deploysClone() public {
        address vault = factory.createVault("Alpha Fund", "avVISION", 2000, manager1);
        assertTrue(vault != address(0));
        assertTrue(factory.isRegisteredVault(vault));
    }

    function test_createVault_initializesCorrectly() public {
        address vault = factory.createVault("Alpha Fund", "avVISION", 2000, manager1);
        IVisionVault v = IVisionVault(vault);

        assertEq(v.manager(), manager1);
        assertEq(v.performanceFeeRate(), 2000);
        assertEq(v.highWaterMark(), 1e18);
    }

    function test_createVault_emitsEvent() public {
        vm.expectEmit(false, true, false, true);
        emit IVisionVaultFactory.VaultCreated(address(0), manager1, "Alpha Fund", "avVISION", 2000);
        factory.createVault("Alpha Fund", "avVISION", 2000, manager1);
    }

    function test_createVault_revertsFeeAboveMax() public {
        vm.expectRevert(IVisionVaultFactory.FeeTooHigh.selector);
        factory.createVault("Bad Fund", "BAD", 6000, manager1); // 60% > 50% cap
    }

    function test_registry_tracksAllVaults() public {
        factory.createVault("Fund A", "A", 1000, manager1);
        factory.createVault("Fund B", "B", 2000, manager1);
        factory.createVault("Fund C", "C", 1500, manager2);

        assertEq(factory.getVaultCount(), 3);
        assertEq(factory.getAllVaults().length, 3);
    }

    function test_registry_tracksByManager() public {
        factory.createVault("Fund A", "A", 1000, manager1);
        factory.createVault("Fund B", "B", 2000, manager1);
        factory.createVault("Fund C", "C", 1500, manager2);

        assertEq(factory.getVaultsByManager(manager1).length, 2);
        assertEq(factory.getVaultsByManager(manager2).length, 1);
    }

    function test_createVault_multipleFromSameManager() public {
        address v1 = factory.createVault("Fund 1", "V1", 1000, manager1);
        address v2 = factory.createVault("Fund 2", "V2", 2000, manager1);
        assertTrue(v1 != v2); // Different clones
    }

    function test_immutables() public view {
        assertEq(factory.vision(), address(vision));
        assertEq(factory.usdc(), address(usdc));
        assertEq(factory.MAX_PERFORMANCE_FEE(), 5000);
    }
}
```

- [ ] **Step 2: Run tests — verify compilation fails**

Run: `cd contracts && forge test --match-contract VisionVaultFactoryTest -v`
Expected: compilation failure — `VisionVaultFactory` not found.

- [ ] **Step 3: Implement VisionVaultFactory.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IVisionVault, IVisionVaultFactory} from "../interfaces/IVisionVault.sol";

/// @title VisionVaultFactory — Permissionless deployer for Vision managed vaults
/// @notice Deploys EIP-1167 minimal proxy clones. No admin, no governance, no upgrade path.
contract VisionVaultFactory is IVisionVaultFactory {
    using Clones for address;

    address public immutable implementation;
    address public immutable vision;
    address public immutable usdc;
    uint256 public constant MAX_PERFORMANCE_FEE = 5000; // 50%

    address[] private _allVaults;
    mapping(address => address[]) private _managerVaults;
    mapping(address => bool) private _isVault;

    constructor(address _implementation, address _vision, address _usdc) {
        implementation = _implementation;
        vision = _vision;
        usdc = _usdc;
    }

    function createVault(
        string calldata name,
        string calldata symbol,
        uint256 performanceFeeRate,
        address manager
    ) external returns (address vault) {
        if (performanceFeeRate > MAX_PERFORMANCE_FEE) revert FeeTooHigh();

        vault = implementation.clone();
        IVisionVault(vault).initialize(name, symbol, manager, vision, usdc, performanceFeeRate);

        _allVaults.push(vault);
        _managerVaults[manager].push(vault);
        _isVault[vault] = true;

        emit VaultCreated(vault, manager, name, symbol, performanceFeeRate);
    }

    function getAllVaults() external view returns (address[] memory) {
        return _allVaults;
    }

    function getVaultsByManager(address manager) external view returns (address[] memory) {
        return _managerVaults[manager];
    }

    function getVaultCount() external view returns (uint256) {
        return _allVaults.length;
    }

    function isRegisteredVault(address vault) external view returns (bool) {
        return _isVault[vault];
    }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd contracts && forge test --match-contract VisionVaultFactoryTest -v`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/vision/VisionVaultFactory.sol contracts/test/vision/VisionVaultFactory.t.sol
git commit -m "feat(vault): VisionVaultFactory with EIP-1167 clones and registry"
```

---

## Task 6: Deploy Script

**Files:**
- Create: `contracts/script/DeployVisionVaults.s.sol`

- [ ] **Step 1: Write deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VisionVault} from "../src/vision/VisionVault.sol";
import {VisionVaultFactory} from "../src/vision/VisionVaultFactory.sol";

/// @title DeployVisionVaults — Deploy VisionVault implementation + VisionVaultFactory
contract DeployVisionVaults is Script {
    function run() external {
        address vision = vm.envAddress("VISION_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // 1. Deploy implementation (never used directly, only cloned)
        VisionVault impl = new VisionVault();
        console.log("VisionVault implementation:", address(impl));

        // 2. Deploy factory
        VisionVaultFactory factory = new VisionVaultFactory(
            address(impl),
            vision,
            usdc
        );
        console.log("VisionVaultFactory:", address(factory));

        vm.stopBroadcast();
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd contracts && forge build --contracts script/DeployVisionVaults.s.sol`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add contracts/script/DeployVisionVaults.s.sol
git commit -m "feat(vault): add VisionVault deploy script"
```

---

## Task 7: Integration Test — Full Lifecycle

End-to-end: create vault via factory → deposit → manager trades → settlement → reconcile with fee → withdraw.

**Files:**
- Create: `contracts/test/integration/E2EVisionVault.t.sol`

- [ ] **Step 1: Write integration test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VisionVault} from "../../src/vision/VisionVault.sol";
import {VisionVaultFactory} from "../../src/vision/VisionVaultFactory.sol";
import {IVisionVault} from "../../src/interfaces/IVisionVault.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Vision} from "../../src/vision/Vision.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {Governance} from "../../src/Governance.sol";
import "../helpers/TestHelper.sol";

contract E2EVisionVault is TestHelper {
    VisionVaultFactory public factory;
    Vision public vision;
    MockERC20 public usdc;

    address manager = address(0xBEEF);
    address depositor1 = address(0xCAFE);
    address depositor2 = address(0xFACE);
    address feeCollector = address(0xFEE);

    bytes32 constant SOURCE_ID = keccak256("test_source");
    bytes32 constant CONFIG_HASH = keccak256("test_config");
    uint256 constant TICK_DURATION = 1 hours;
    uint256 constant LOCK_OFFSET = 60;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 18);
        Governance gov = new Governance(address(this));
        OracleRegistry oracleReg = new OracleRegistry(address(gov));
        registerTestOraclesWithBLS(oracleReg, address(this));
        vision = new Vision(address(usdc), address(oracleReg), feeCollector);

        VisionVault impl = new VisionVault();
        factory = new VisionVaultFactory(address(impl), address(vision), address(usdc));

        usdc.mint(depositor1, 1000e18);
        usdc.mint(depositor2, 500e18);
    }

    function test_fullLifecycle() public {
        // 1. Create vault via factory
        address vaultAddr = factory.createVault("E2E Fund", "e2eV", 2000, manager);
        IVisionVault vault = IVisionVault(vaultAddr);
        VisionVault vaultERC20 = VisionVault(vaultAddr);

        // 2. Depositor 1 deposits 200 USDC
        vm.startPrank(depositor1);
        usdc.approve(vaultAddr, type(uint256).max);
        vault.requestDeposit(200e18, depositor1, depositor1);
        vault.claimDeposit(depositor1, depositor1);
        vm.stopPrank();
        assertEq(vaultERC20.balanceOf(depositor1), 200e18);

        // 3. Depositor 2 deposits 100 USDC
        vm.startPrank(depositor2);
        usdc.approve(vaultAddr, type(uint256).max);
        vault.requestDeposit(100e18, depositor2, depositor2);
        vault.claimDeposit(depositor2, depositor2);
        vm.stopPrank();
        assertEq(vaultERC20.balanceOf(depositor2), 100e18);

        // 4. Manager joins a batch with 250 USDC
        uint256 batchId = _createBatch();
        vm.prank(manager);
        vault.joinBatch(batchId, CONFIG_HASH, 250e18, 250e18, keccak256("predictions"));

        assertEq(vault.totalActiveCapital(), 250e18);
        assertEq(vault.idleUSDC(), 50e18); // 300 - 250

        // 5. Depositor 2 requests full withdrawal (100 shares)
        vm.prank(depositor2);
        vault.requestRedeem(100e18, depositor2, depositor2);

        // Only 50 USDC idle — partial at best, queued
        // (100 shares = 100 USDC at current NAV of 1:1)

        // 6. Settle batch with profit: 250 → 300 (20% gain)
        _settleWithPayout(batchId, vaultAddr, 300e18);

        // 7. Reconcile — triggers fee crystallization + queue sweep
        vault.reconcile(batchId);

        // Manager should have fee shares (20% of 50 USDC profit = 10 USDC worth)
        assertGt(vaultERC20.balanceOf(manager), 0);
        assertEq(vault.totalActiveCapital(), 0);

        // 8. Depositor 2 claims withdrawal
        vm.prank(depositor2);
        uint256 assets = vault.claimRedeem(depositor2, depositor2);
        assertGt(assets, 0);

        // 9. Depositor 1 withdraws remaining
        uint256 d1Shares = vaultERC20.balanceOf(depositor1);
        vm.startPrank(depositor1);
        vault.requestRedeem(d1Shares, depositor1, depositor1);
        uint256 d1Assets = vault.claimRedeem(depositor1, depositor1);
        vm.stopPrank();
        assertGt(d1Assets, 200e18); // Should be > initial deposit (profit minus fees)

        console2.log("Depositor 1 final:", d1Assets);
        console2.log("Depositor 2 final:", assets);
        console2.log("Manager fee shares:", vaultERC20.balanceOf(manager));
    }

    // ── Helpers (same as VisionVault.t.sol) ──────────────────────────

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

    function _settleWithPayout(uint256 batchId, address player, uint256 payout) internal {
        usdc.mint(address(vision), payout);
        address[] memory players = new address[](1);
        players[0] = player;
        uint256[] memory payouts = new uint256[](1);
        payouts[0] = payout;

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(vision), "SETTLE_BATCH",
            batchId, players, payouts
        ));
        bytes memory sig = signWithTestOracles(message);
        vision.settleBatch(batchId, players, payouts, sig, REF_NONCE, SIGNERS_BITMASK);
    }
}
```

- [ ] **Step 2: Run integration test**

Run: `cd contracts && forge test --match-contract E2EVisionVault -v`
Expected: `test_fullLifecycle` passes. All assertions hold. Console output shows depositors profiting and manager earning fees.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/integration/E2EVisionVault.t.sol
git commit -m "test(vault): add E2E lifecycle test for VisionVault"
```

---

## Task 8: Final Verification

Run the full test suite to confirm nothing is broken.

- [ ] **Step 1: Run all vault tests**

Run: `cd contracts && forge test --match-path "test/vision/*" --match-path "test/integration/E2EVisionVault*" -v`
Expected: all tests pass.

- [ ] **Step 2: Run type check on all new contracts**

Run: `cd contracts && forge build`
Expected: clean compilation, no warnings.

- [ ] **Step 3: Run existing test suite to verify no regressions**

Run: `cd contracts && forge test`
Expected: all existing tests still pass.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(vault): address test suite integration issues"
```
