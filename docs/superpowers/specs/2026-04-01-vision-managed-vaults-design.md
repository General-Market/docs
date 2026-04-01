# Vision Managed Vaults — Design Spec

> Permissionless vaults where managers trade Vision with depositor capital.

## Overview

A vault manager accepts USDC deposits, receives shares in return, and trades exclusively on Vision (the parimutuel prediction market) with the pooled capital. Depositors earn (or lose) proportionally. The manager earns a performance fee on profits above a high-water mark.

The system is three contracts:
- **VisionVault** — ERC-7540 vault implementation (cloned per vault)
- **VisionVaultFactory** — EIP-1167 clone deployer + on-chain registry
- **VisionVaultAccounting** — library for NAV, high-water mark, and fee math

Vision itself is untouched. From Vision's perspective, each vault is just another player calling `joinBatchDirect()`.

## Standard

**ERC-7540** — the async extension of ERC-4626. Adds request/claim pattern for deposits and withdrawals. Required because Vision locks capital in active batches — instant redemption is not always possible.

ERC-7540 extends ERC-4626, so all standard vault interfaces (`totalAssets()`, `convertToShares()`, `convertToAssets()`, share token ERC-20) are preserved.

## Trust Model

Fully autonomous manager. No on-chain guardrails on trading decisions. The manager chooses which batches to join, how much to stake, what predictions to make. Depositors trust the manager completely — like allocating to a hedge fund.

What the manager **can** do:
- Join any Vision batch with any amount of vault capital
- Update prediction bitmaps on active batches
- Leave batches (if Vision supports early exit)
- Trigger settlement claims

What the manager **cannot** do:
- Transfer USDC out of the vault directly
- Approve USDC to arbitrary addresses
- Call any contract other than Vision
- Change the fee rate after creation
- Withdraw depositor funds to their own wallet

## Contracts

### VisionVault (Implementation)

The core vault. Each clone is an independent fund with its own manager, shares, and accounting.

**State:**
```
address public manager;
address public immutable vision;          // Vision contract address
address public immutable usdc;            // USDC on L3 (18 decimals)
uint256 public performanceFeeRate;        // Basis points (max 5000 = 50%)
uint256 public highWaterMark;             // NAV per share, starts at 1e18

mapping(uint256 => uint256) public activeBatchDeposits;  // batchId → USDC deposited
uint256 public totalActiveCapital;                        // Sum of all active batch deposits

// ERC-7540 withdrawal queue
struct WithdrawRequest {
    address owner;
    address receiver;
    uint256 assets;       // USDC amount requested
    uint256 shares;       // Shares locked for this request
    uint256 timestamp;
}
WithdrawRequest[] public withdrawQueue;
uint256 public queueHead;                 // FIFO pointer
```

**Initialization (called once per clone):**
```
initialize(
    string name,
    string symbol,
    address _manager,
    address _vision,
    address _usdc,
    uint256 _performanceFeeRate
)
```
- Sets all immutable-equivalent state
- `highWaterMark = 1e18` (starting share price = $1)
- Approves Vision contract to spend vault's USDC (infinite approval)

**Trading functions (onlyManager):**

```
joinBatch(uint256 batchId, bytes32 configHash, uint256 depositAmount, uint256 stakePerTick, bytes32 bitmapHash)
```
- Calls `Vision.joinBatchDirect(batchId, configHash, depositAmount, stakePerTick, bitmapHash)`
- Records `activeBatchDeposits[batchId] += depositAmount`
- Increments `totalActiveCapital += depositAmount`
- Reverts if `depositAmount > idleUSDC()`

```
updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newBitmapHash)
```
- Calls `Vision.updateBitmap(batchId, configHash, newBitmapHash)`
- No capital movement

```
leaveBatch(uint256 batchId)
```
- Calls `Vision.leaveBatch(batchId)` if supported
- Updates `activeBatchDeposits[batchId]` and `totalActiveCapital` based on returned amount

```
reconcile(uint256 batchId)
```
- **Permissionless** — anyone can call
- Reads the vault's current USDC balance
- Computes PnL: `payout = currentBalance - expectedBalance` (where expected = idle before settlement)
- Zeroes out `activeBatchDeposits[batchId]`, decrements `totalActiveCapital`
- Calculates new NAV per share
- If NAV per share > `highWaterMark`: crystallizes performance fee (mints shares to manager)
- Updates `highWaterMark`
- Sweeps withdrawal queue: fulfills pending requests in FIFO order while idle USDC allows
- Emits `Reconciled(batchId, pnl, feeSharesMinted, withdrawalsFulfilled)`

**NAV calculation:**
```
totalAssets() = usdc.balanceOf(address(this)) + totalActiveCapital
```
- `usdc.balanceOf(this)` = idle USDC (available for withdrawals and new trades)
- `totalActiveCapital` = USDC currently locked in Vision batches (valued at cost)
- Between settlements, NAV is approximate. After reconciliation, it's exact.

**Idle USDC:**
```
idleUSDC() = usdc.balanceOf(address(this)) - pendingWithdrawalAssets()
```
- Subtracts any already-fulfillable withdrawal requests to avoid double-counting

### VisionVaultFactory

Deploys and registers vaults. No admin, no governance, no upgrade path.

**State:**
```
address public immutable implementation;  // VisionVault implementation to clone
address public immutable vision;          // Vision contract
address public immutable usdc;            // USDC address
uint256 public constant MAX_PERFORMANCE_FEE = 5000;  // 50% cap

address[] public allVaults;
mapping(address => address[]) public managerVaults;  // manager → their vaults
mapping(address => bool) public isVault;              // quick lookup
```

**Functions:**

```
createVault(string name, string symbol, uint256 performanceFeeRate, address manager)
    → returns address vault
```
- Reverts if `performanceFeeRate > MAX_PERFORMANCE_FEE`
- Deploys EIP-1167 minimal proxy clone of `implementation`
- Calls `vault.initialize(name, symbol, manager, vision, usdc, performanceFeeRate)`
- Registers in `allVaults[]` and `managerVaults[manager][]`
- Emits `VaultCreated(vault, manager, name, symbol, performanceFeeRate)`

**Registry reads:**
```
getAllVaults() → address[]
getVaultsByManager(address manager) → address[]
getVaultCount() → uint256
isRegisteredVault(address vault) → bool
```

No `getVaultInfo()` — the frontend reads directly from each vault contract. The factory is a deployer and index, not a data aggregator.

### VisionVaultAccounting (Library)

Pure math, no state. Used by VisionVault internally.

```
calculateSharesForDeposit(uint256 assets, uint256 totalAssets, uint256 totalShares) → uint256 shares
calculateAssetsForWithdraw(uint256 shares, uint256 totalAssets, uint256 totalShares) → uint256 assets
calculatePerformanceFee(uint256 newNAVPerShare, uint256 highWaterMark, uint256 totalShares, uint256 feeRate) → uint256 feeShares
```

Standard ERC-4626 share math with the addition of fee-via-dilution calculation.

## Deposit Flow

1. Depositor calls `requestDeposit(uint256 assets, address receiver, address owner)`
   - USDC transferred from depositor to vault
   - Deposit request recorded
   - Emits `DepositRequest(owner, receiver, assets)`

2. Deposits are fulfillable immediately (USDC is liquid on arrival). No waiting period.

3. Depositor calls `claimDeposit(address receiver)`
   - Shares minted at current NAV per share
   - `shares = assets * totalShares / totalAssets`
   - Request cleared

In practice, a router contract could batch `requestDeposit` + `claimDeposit` in one transaction for UX. The two-step interface is for ERC-7540 compliance.

## Withdrawal Flow

1. Depositor calls `requestWithdraw(uint256 assets, address receiver, address owner)`
   - Corresponding shares locked (moved to vault's internal escrow)
   - Request added to FIFO queue
   - Emits `WithdrawRequest(owner, receiver, assets, shares)`

2. **If idle USDC >= requested amount:** request marked as claimable immediately

3. **If insufficient idle USDC:** request stays queued. Fulfilled when:
   - A batch settles and `reconcile()` is called
   - The manager deposits personal USDC (unlikely but possible)
   - Other depositors add capital (increasing idle pool)

4. Depositor calls `claimWithdraw(address receiver)`
   - Reverts if request not yet fulfillable
   - USDC transferred, shares burned
   - Queue pointer advanced

**Queue sweep** happens inside `reconcile()` — after each settlement, newly freed capital is distributed to queued withdrawals in order.

## Fee Mechanics

**Performance fee only.** No management fee. No entry/exit fee.

**High-water mark (HWM):**
- Stored as NAV per share (18 decimals)
- Starts at 1e18 ($1/share)
- Only moves up, never down

**Crystallization (inside `reconcile()`):**
1. Compute new NAV per share after settlement PnL
2. If `newNAVPerShare > highWaterMark`:
   - `profitPerShare = newNAVPerShare - highWaterMark`
   - `totalProfit = profitPerShare * totalShares / 1e18`
   - `feeAssets = totalProfit * performanceFeeRate / 10000`
   - `feeShares = feeAssets * totalShares / (totalAssets - feeAssets)`
   - Mint `feeShares` to manager
   - `highWaterMark = newNAVPerShare` (post-fee)
3. If `newNAVPerShare <= highWaterMark`: no fee

**Why dilutive fee (share minting):**
- No USDC leaves the vault — all capital remains available for trading and withdrawals
- Manager's incentive is aligned: their shares appreciate alongside depositors
- Manager redeems shares through the same withdrawal queue as everyone else
- Industry standard (Yearn, Enzyme, Maple)

## Events

```
VaultCreated(address indexed vault, address indexed manager, string name, string symbol, uint256 performanceFeeRate)
DepositRequest(address indexed owner, address indexed receiver, uint256 assets)
DepositClaimed(address indexed receiver, uint256 assets, uint256 shares)
WithdrawRequest(address indexed owner, address indexed receiver, uint256 assets, uint256 shares)
WithdrawClaimed(address indexed receiver, uint256 assets, uint256 shares)
BatchJoined(uint256 indexed batchId, uint256 amount)
BatchLeft(uint256 indexed batchId, uint256 returned)
BitmapUpdated(uint256 indexed batchId, bytes32 newBitmapHash)
Reconciled(uint256 indexed batchId, int256 pnl, uint256 feeSharesMinted, uint256 withdrawalsFulfilled)
```

## Edge Cases

**Manager goes dark:**
- No new trades placed. Capital sits idle.
- Pending withdrawals from idle capital still fulfillable — depositors can exit.
- Active batch capital frees on settlement — anyone calls `reconcile()` to unstick.
- Worst case: depositors wait for all active batches to settle, then withdraw everything.

**Vault has zero deposits:**
- Manager can create vault but not trade (no USDC).
- First depositor sets the initial share price at 1:1 (1 share = $1).

**All capital in active batches, withdrawal requested:**
- Request queues. Depositor waits for next settlement.
- UI should show estimated wait time based on active batch tick durations.

**Manager tries to drain via a fake batch:**
- The manager cannot create batches — batch creation requires BLS oracle consensus.
- The manager can only join existing, oracle-created batches on Vision.
- Settlement payouts are determined by oracles, not by the manager.
- The only attack vector is the manager intentionally losing on Vision (trading badly on purpose to transfer value to a colluding counterparty). This is the standard fund manager trust assumption — same as any hedge fund.

**Multiple batches active simultaneously:**
- Each tracked independently via `activeBatchDeposits[batchId]`.
- `reconcile()` called per batch as they settle.
- NAV reflects the sum of all active positions.

**Rounding / dust:**
- Standard ERC-4626 rounding: round shares down on deposit, round assets down on withdraw. Vault keeps dust.
- First depositor protection: mint a minimum number of dead shares to prevent inflation attack (OpenZeppelin's standard `_decimalsOffset()`).

## What This Spec Does NOT Cover

- **Frontend UI** — vault browser, deposit/withdraw pages, manager dashboard. Separate spec.
- **Off-chain indexing** — subgraph or event indexer for historical performance, PnL charts. Not needed for MVP (on-chain reads suffice).
- **Vault upgradability** — intentionally excluded. Immutable implementation. If the contract needs changes, deploy a new factory with a new implementation. Depositors migrate voluntarily.
- **Multi-manager vaults** — single manager per vault. If two people want to co-manage, they share a multisig as the manager address.
- **Cross-chain** — L3 only. No bridge integration for deposits from other chains.
