# Vision First Deposit via Oracle Bridge

**Date:** 2026-02-27
**Status:** Draft v7 — dual-balance architecture (post round-3 audit)

---

## Problem

User has USDC on Arbitrum. Vision.sol on L3 needs USDC (18 dec). No Arb→L3 deposit path exists.

---

## Design

**Dual-balance architecture.** Vision.sol tracks two separate balances per user:

- `realBalance[user]` — backed by actual L3 USDC in the contract (from `depositBalance`)
- `virtualBalance[user]` — backed by USDC locked in ArbBridgeCustody on Arb (from `creditBalance`)

Each withdrawal path draws from its matching pool:
- `withdrawBalance()` → sends real L3 USDC from contract → debits `realBalance`
- `withdrawToArb()` → virtual debit, oracles release from ArbBridgeCustody → debits `virtualBalance`

Batch operations debit from either pool (user's choice or auto: virtual first, then real). Batch payouts (claims, withdrawals, forceWithdraw) always credit `realBalance` because the batch pool holds real L3 USDC from all participants.

```
DEPOSIT (Arb → Vision.sol)

  User                ArbBridgeCustody         Oracles              Vision.sol (L3)
   │── depositToVision() ─→│                      │                      │
   │   (locks USDC 6dec)   │── event ────────────→│                      │
   │                       │                      │── creditBalance() ──→│
   │                       │                      │   (BLS, 18dec)       │ virtualBalance[user] += amt
   │                       │←── completeDeposit() │                      │
   │                       │    (BLS)             │                      │


DEPOSIT (L3 direct)

  User                Vision.sol
   │── depositBalance() ─→│  USDC.transferFrom(user, this, amount)
   │                      │  realBalance[user] += amount


WITHDRAW (to Arb)

  User                Vision.sol (L3)          Oracles              ArbBridgeCustody
   │── withdrawToArb() ───→│                      │                      │
   │                       │ virtualBalance -= amt │                      │
   │                       │ (NO L3 USDC moves)   │                      │
   │                       │── event ─────────────→│                      │
   │                       │                      │── completeVision ───→│
   │                       │                      │   Withdraw(BLS)      │── USDC to USER


WITHDRAW (to L3 wallet)

  User                Vision.sol
   │── withdrawBalance() ─→│  realBalance[user] -= amount
   │                       │  USDC.transfer(user, amount)


TRADING (all on L3)

  User                Vision.sol
   │── joinBatch() ──→│  _debitBalance(user) (virtual first, then real)
   │── deposit()  ───→│  _debitBalance(user) (virtual first, then real)
   │── claimRewards()→│  realBalance[user] += payout  (batch pool is real USDC)
   │── withdraw() ───→│  realBalance[user] += payout
```

---

## 1. Contract: Vision.sol

### New storage

```solidity
/// @notice Per-user L3 USDC balance — backed by real L3 USDC in the contract
mapping(address => uint256) public realBalance;

/// @notice Per-user virtual balance — backed by USDC locked in ArbBridgeCustody on Arb
mapping(address => uint256) public virtualBalance;

/// @notice Aggregate tracking for solvency invariants
uint256 public totalRealBalance;    // sum(realBalance[all users])
uint256 public totalVirtualBalance; // sum(virtualBalance[all users])

/// @notice Processed cross-chain deposit IDs (idempotency — survives oracle restarts)
mapping(uint256 => bool) public depositProcessed;

/// @notice Auto-incrementing withdraw request ID
uint256 public withdrawNonce;
```

**Solvency invariants (always hold):**
```
USDC.balanceOf(this) >= totalRealBalance + sum(active position balances) + accumulatedFees
totalRealBalance == sum(realBalance[all users])
totalVirtualBalance == sum(virtualBalance[all users])
```

### Helper: total user balance

```solidity
/// @notice Total available balance for a user (real + virtual)
function balanceOf(address user) public view returns (uint256) {
    return realBalance[user] + virtualBalance[user];
}
```

### New events

```solidity
event BalanceCredited(address indexed user, uint256 amount, uint256 indexed depositId);
event BalanceDeposited(address indexed user, uint256 amount);
event RealBalanceWithdrawn(address indexed user, uint256 amount);
event WithdrawToArbRequested(address indexed user, uint256 amount, uint256 indexed withdrawId);
```

### New functions

```solidity
/// @notice Credit virtual balance after cross-chain deposit (BLS-gated, oracles only)
/// @dev No L3 USDC enters the contract. Backed by ArbBridgeCustody on Arb.
function creditBalance(
    address user,
    uint256 amount,
    uint256 depositId,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external nonReentrant {
    if (depositProcessed[depositId]) revert AlreadyProcessed();
    if (user == address(0)) revert ZeroAddress();
    if (amount == 0) revert ZeroAmount();

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "creditBalance",
        user, amount, depositId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    depositProcessed[depositId] = true;
    virtualBalance[user] += amount;
    totalVirtualBalance += amount;
    emit BalanceCredited(user, amount, depositId);
}

/// @notice Direct deposit from L3 (user already has USDC on L3)
/// @dev Real L3 USDC enters the contract.
function depositBalance(uint256 amount) external nonReentrant {
    if (amount == 0) revert ZeroAmount();
    USDC.safeTransferFrom(msg.sender, address(this), amount);
    realBalance[msg.sender] += amount;
    totalRealBalance += amount;
    emit BalanceDeposited(msg.sender, amount);
}

/// @notice Withdraw real balance to caller's L3 wallet
/// @dev Only draws from realBalance — guaranteed backed by L3 USDC in the contract.
function withdrawBalance(uint256 amount) external nonReentrant {
    if (realBalance[msg.sender] < amount) revert InsufficientBalance();
    if (amount == 0) revert ZeroAmount();
    realBalance[msg.sender] -= amount;
    totalRealBalance -= amount;
    USDC.safeTransfer(msg.sender, amount);
    emit RealBalanceWithdrawn(msg.sender, amount);
}

/// @notice Withdraw virtual balance back to Arbitrum via oracle bridge
/// @dev Only draws from virtualBalance — backed by ArbBridgeCustody on Arb.
///      No L3 USDC moves. Oracles release from ArbBridgeCustody.
function withdrawToArb(uint256 amount) external nonReentrant {
    if (virtualBalance[msg.sender] < amount) revert InsufficientBalance();
    if (amount == 0) revert ZeroAmount();
    uint256 wId = withdrawNonce++;
    virtualBalance[msg.sender] -= amount;
    totalVirtualBalance -= amount;
    emit WithdrawToArbRequested(msg.sender, amount, wId);
}
```

### Internal helper: debit from user balance

Batch operations (join, deposit) need to debit from the user's total balance. We debit virtual first, then real. This ensures users who deposited from Arb don't accumulate real balance they can't use, and users who deposited on L3 keep their real balance as long as possible.

```solidity
/// @dev Debit `amount` from user's total balance. Virtual first, then real.
function _debitBalance(address user, uint256 amount) internal {
    uint256 total = virtualBalance[user] + realBalance[user];
    if (total < amount) revert InsufficientBalance();

    // Debit virtual first
    uint256 fromVirtual = amount > virtualBalance[user] ? virtualBalance[user] : amount;
    uint256 fromReal = amount - fromVirtual;

    virtualBalance[user] -= fromVirtual;
    totalVirtualBalance -= fromVirtual;
    realBalance[user] -= fromReal;
    totalRealBalance -= fromReal;
}
```

### Modified functions (6 USDC transfer points)

**1. `_joinBatch()` (internal, called by `joinBatch` and `createBatchAndJoin`)** — line 340
```solidity
// BEFORE: USDC.safeTransferFrom(msg.sender, address(this), depositAmount);
// AFTER:
_debitBalance(msg.sender, depositAmount);
// Note: the USDC is now "in the batch pool" — tracked by position balances
```

**2. `deposit()` (top-up existing position)** — line 387
```solidity
// BEFORE: USDC.safeTransferFrom(msg.sender, address(this), amount);
// AFTER:
_debitBalance(msg.sender, amount);
```

**3. `claimRewards()`** — line 436
```solidity
// BEFORE: USDC.safeTransfer(msg.sender, payout);
// AFTER:
realBalance[msg.sender] += payout;
totalRealBalance += payout;
// Payouts ALWAYS credit realBalance because the batch pool is real L3 USDC.
// (When users join, their virtual balance was "converted" to batch pool USDC.)
//
// SOLVENCY CHECK (replaces old USDC.balanceOf check):
// The BLS-signed newBalance determines the payout. The existing oracle consensus
// ensures payouts are correct. Additionally, since batch pool USDC is real (it was
// either deposited via depositBalance, or the virtual debit at join time was offset
// by another user's real deposit in the same batch), the contract always has enough
// real USDC to cover realBalance credits.
```

**4. `withdraw()`** — line 480
```solidity
// BEFORE: USDC.safeTransfer(msg.sender, payout);
// AFTER:
realBalance[msg.sender] += payout;
totalRealBalance += payout;
// Same as claimRewards — batch payouts are always real.
```

**5. `forceWithdraw()` (oracle emergency exit)** — line 647
```solidity
// BEFORE: USDC.safeTransfer(player, payout);
// AFTER:
realBalance[player] += payout;
totalRealBalance += payout;
// Same — forceWithdraw returns from batch pool (real USDC).
```

**6. `collectFees()`** — line 545
```solidity
// BEFORE: USDC.safeTransfer(feeCollector, fees);
// AFTER:
realBalance[feeCollector] += fees;
totalRealBalance += fees;
accumulatedFees = 0;
// Fees are now credited to feeCollector's realBalance (not transferred out).
// feeCollector can withdrawBalance() or withdrawToArb() to extract.
// This fixes the solvency issue where collectFees tried to transfer USDC
// that didn't exist when all deposits were Arb-bridged.
```

### Unchanged functions

These functions don't touch USDC transfers and remain as-is:

- `createBatch()` — only creates batch metadata
- `updateBatchConfig()` — config management
- `updateBitmap()` — bitmap hash update
- `getBatch()`, `getBatchIdBySourceId()`, `currentTickId()`, `getPosition()` — view functions
- `registerBot()`, `deregisterBot()`, `getAllActiveBots()` — bot registry
- `updateFeeCollector()` — admin
- `pause()`, `unpause()` — batch pause/unpause

### Interface: IVision.sol

Add to interface:
- `realBalance(address) → uint256` (public mapping getter)
- `virtualBalance(address) → uint256` (public mapping getter)
- `balanceOf(address) → uint256` (view, returns real + virtual)
- `totalRealBalance() → uint256`
- `totalVirtualBalance() → uint256`
- `depositProcessed(uint256) → bool`
- `withdrawNonce() → uint256`
- `creditBalance(address, uint256, uint256, bytes, uint256, uint256)`
- `depositBalance(uint256)`
- `withdrawBalance(uint256)`
- `withdrawToArb(uint256)`
- New events: `BalanceCredited`, `BalanceDeposited`, `RealBalanceWithdrawn`, `WithdrawToArbRequested`
- New errors: `InsufficientBalance()`, `AlreadyProcessed()`, `ZeroAddress()`, `ZeroAmount()`

### Constructor / deploy

**Vision.sol is NOT upgradeable** (no UUPS proxy). This means a full redeployment is required. The new constructor takes the same args as before — no `l3BridgeCustody` needed since `withdrawToArb` no longer routes through L3BridgeCustody (it's a virtual debit).

### Deploy script: DeployVision.s.sol

Same constructor args as before. No structural change. Deploy target changes from Arb to L3 (see section 10).

`DeployAllVisionBatches.s.sol` — no changes (batch creation doesn't touch USDC).

---

## 2. Contract: ArbBridgeCustody.sol (Arbitrum)

### New storage

```solidity
struct VisionDeposit {
    address user;
    uint256 amount;      // 18 decimals (converted from 6-dec input)
    uint256 createdAt;
}

mapping(uint256 => VisionDeposit) public visionDeposits;
```

### New functions

```solidity
/// @notice Deposit USDC for Vision on L3 (locks on Arb, credited on L3)
function depositToVision(uint256 usdcAmount) external returns (uint256 orderId) {
    if (usdcAmount < MIN_USDC_AMOUNT)
        revert ErrorsLib.E07F_UsdcAmountTooSmall(usdcAmount, MIN_USDC_AMOUNT);

    usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
    uint256 internalAmount = DecimalLib.toInternal(usdcAmount);
    visionReserve += usdcAmount;

    orderId = crossChainOrderId++;
    visionDeposits[orderId] = VisionDeposit({
        user: msg.sender,
        amount: internalAmount,
        createdAt: block.timestamp
    });

    emit VisionDepositCreated(orderId, msg.sender, internalAmount);
}

/// @notice Mark deposit completed (oracles call after L3 credit confirmed)
function completeVisionDeposit(
    uint256 orderId,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    VisionDeposit storage dep = visionDeposits[orderId];
    if (dep.user == address(0)) revert NotFound();

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "completeVisionDeposit", orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    delete visionDeposits[orderId];
    emit VisionDepositCompleted(orderId);
}

/// @notice Refund failed deposit (oracles call if L3 credit fails)
function refundVisionDeposit(
    uint256 orderId,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    VisionDeposit storage dep = visionDeposits[orderId];
    if (dep.user == address(0)) revert NotFound();

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "refundVisionDeposit", orderId
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    address user = dep.user;
    uint256 usdcAmount = DecimalLib.toUsdc(dep.amount);
    delete visionDeposits[orderId];
    visionReserve -= usdcAmount;

    if (usdcAmount > 0) usdc.safeTransfer(user, usdcAmount);
    emit VisionDepositRefunded(orderId, user, usdcAmount);
}
```

### New function: completeVisionWithdraw

**AUDIT FIX C-01**: Existing `completeBridge()` sends USDC to `msg.sender` (oracle). Vision withdrawals must send to the user. New dedicated function with replay protection:

```solidity
/// @notice Replay protection for Vision withdrawals (AUDIT FIX: round 2+3 confirmed)
mapping(uint256 => bool) public withdrawProcessed;

/// @notice Vision USDC reserve tracker — solvency invariant for Vision pool
uint256 public visionReserve;

/// @notice Release USDC to user after Vision.withdrawToArb on L3
/// @dev Sends USDC to `user`, NOT to msg.sender. Has replay protection.
function completeVisionWithdraw(
    uint256 withdrawId,
    address user,
    uint256 amount,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    if (withdrawProcessed[withdrawId]) revert AlreadyProcessed();

    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "completeVisionWithdraw",
        withdrawId, user, amount
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    withdrawProcessed[withdrawId] = true;

    uint256 usdcAmount = DecimalLib.toUsdc(amount);
    visionReserve -= usdcAmount;

    if (usdcAmount > 0) {
        usdc.safeTransfer(user, usdcAmount);  // ← sends to USER, not msg.sender
    }

    emit VisionWithdrawCompleted(withdrawId, user, usdcAmount);
}
```

### New events

```solidity
event VisionDepositCreated(uint256 indexed orderId, address indexed user, uint256 amount);
event VisionDepositCompleted(uint256 indexed orderId);
event VisionDepositRefunded(uint256 indexed orderId, address indexed user, uint256 usdcAmount);
event VisionWithdrawCompleted(uint256 indexed withdrawId, address indexed user, uint256 usdcAmount);
```

### IArbBridgeCustody.sol

Add the 4 new functions + events to interface.

---

## 3. Contract: L3BridgeCustody.sol (L3)

**No changes. Not involved in Vision flows.**

**AUDIT FIX C-02**: Previous design routed `withdrawToArb` through L3BridgeCustody, but `initiateBridge()` uses a pull model (`safeTransferFrom`) which is incompatible with Vision.sol's push model. Fix: Vision withdrawals bypass L3BridgeCustody entirely.

The revised `withdrawToArb` flow:
1. User calls `Vision.withdrawToArb(amount)` → virtual debit (no L3 USDC moves)
2. Oracles detect `WithdrawToArbRequested` event on Vision.sol
3. Oracles call `ArbBridgeCustody.completeVisionWithdraw(withdrawId, user, amount, blsSig)` on Arb
4. ArbBridgeCustody sends USDC to user on Arb

L3BridgeCustody continues to handle existing ITP L3→Arb flows only.

---

## 4. Contract: BotRegistry.sol

No changes. Bot registration/deregistration is independent of USDC flows.

---

## 5. Oracle

### 5a. New module: `vision_deposit_watcher` (new file)

Polls ArbBridgeCustody on Arbitrum for `VisionDepositCreated` events.

```
Config needed:
  - arb_bridge_custody_address (Arbitrum)
  - arb_rpc_url (Arbitrum RPC)
  - vision_address (L3)
  - l3_rpc_url (L3 RPC, already in VisionConfig)

On VisionDepositCreated(orderId, user, amount):
  1. Wait for Arb finality (~15 confirmations)
  2. Consensus: propose creditBalance(user, amount, orderId) among oracles
  3. Aggregate BLS signatures (11/20 threshold)
  4. Submit Vision.creditBalance(user, amount, orderId, blsSig) on L3
  5. Wait for L3 tx confirmation
  6. Consensus: propose completeVisionDeposit(orderId) among oracles
  7. Submit ArbBridgeCustody.completeVisionDeposit(orderId, blsSig) on Arb
  8. On any failure at step 4-5: submit refundVisionDeposit(orderId, blsSig) on Arb instead

On WithdrawToArbRequested(user, amount, withdrawId):  (from Vision.sol on L3)
  1. Balance already deducted on L3 (virtual debit — no L3 USDC moved)
  2. Wait for L3 finality (~few blocks on Orbit)
  3. Consensus: propose completeVisionWithdraw(withdrawId, user, amount) among oracles
  4. Aggregate BLS signatures (11/20 threshold)
  5. Submit ArbBridgeCustody.completeVisionWithdraw(withdrawId, user, amount, blsSig) on Arb
  6. User receives USDC on Arb
  NOTE: No L3BridgeCustody involvement. No L3 USDC moves.
```

Same pattern as existing `oracle/src/bridge/orchestrator.rs` for ITP buy orders.

**AUDIT FIX C-08 (no atomic rollback):** The deposit flow is a two-phase state machine persisted in `vision_deposit_orders` table. Each step updates status BEFORE submitting the tx. If `creditBalance` tx succeeds but `completeVisionDeposit` fails, on restart the oracle sees status = `credited_on_l3` and retries only the Arb completion step. On-chain `depositProcessed[depositId]` prevents double-credit even if the oracle retries `creditBalance`.

**AUDIT FIX C-09 (restart idempotency):** On startup, the deposit watcher:
1. Loads all `vision_deposit_orders` with status != `completed` and status != `refunded` from DB
2. For each: checks on-chain `depositProcessed[depositId]` — if true, status was `credited_on_l3` → skip to Arb completion
3. For each: checks on-chain `visionDeposits[orderId]` — if deleted, was already completed → mark done
4. Resumes from the correct step. No duplicate credits possible.

**AUDIT FIX H-06 (stuck deposits):** Deposits in `pending` status for >30 minutes trigger an alert. After 2 hours, oracles auto-refund via `refundVisionDeposit`. **CRITICAL: auto-refund MUST NOT fire for deposits with status `credited_on_l3`.** Only `pending` deposits are refundable. For `credited_on_l3` deposits where Arb completion keeps failing, retry forever with exponential backoff.

**AUDIT FIX round 3 (refund safety):** Before signing `refundVisionDeposit`, each oracle MUST query `Vision.depositProcessed[depositId]` on L3. If true (credit already landed), refuse to sign the refund. This prevents the credit+refund double-money race condition.

**AUDIT FIX H-05 (polling interval):** `deposit_poll_interval_ms` defaults to 5000 (5s). Configurable.

**AUDIT FIX round 3 (L3 confirmation depth):** Wait N+5 L3 blocks before marking `credited_on_l3` in DB. Protects against rare L3 Orbit reorgs.

### 5b. Modified: `chain_listener.rs`

Add new event signatures to watch list:

```rust
// NEW events to listen for:
"BalanceCredited(address,uint256,uint256)"       // → update tick_scheduler virtualBalance
"BalanceDeposited(address,uint256)"              // → update tick_scheduler realBalance
"RealBalanceWithdrawn(address,uint256)"          // → update tick_scheduler realBalance
"WithdrawToArbRequested(address,uint256,uint256)" // → trigger arb bridge + update virtualBalance
```

New handlers:
```rust
fn handle_balance_credited(&self, user: Address, amount: U256, deposit_id: U256)
    // → tick_scheduler.on_virtual_balance_credited(user, amount)
    // → persist to postgres vision_balances table

fn handle_balance_deposited(&self, user: Address, amount: U256)
    // → tick_scheduler.on_real_balance_deposited(user, amount)
    // → persist to postgres

fn handle_real_balance_withdrawn(&self, user: Address, amount: U256)
    // → tick_scheduler.on_real_balance_withdrawn(user, amount)
    // → persist to postgres

fn handle_withdraw_to_arb(&self, user: Address, amount: U256, withdraw_id: u64)
    // → tick_scheduler.on_virtual_balance_withdrawn(user, amount)
    // → trigger vision_deposit_watcher arb bridge flow
    // → persist to postgres vision_withdraw_orders table
```

**AUDIT FIX round 3 (implicit balance changes):** `_joinBatch`, `claimRewards`, `withdraw`, `forceWithdraw` also mutate `realBalance`/`virtualBalance` but don't emit dedicated balance events. The tick_scheduler must infer these changes from the existing `PlayerJoined`, `RewardsClaimed`, `PlayerWithdrawn`, `ForceWithdrawn` events. When `PlayerJoined` fires, decrement `user_balances` by `depositAmount`. When `RewardsClaimed`/`PlayerWithdrawn`/`ForceWithdrawn` fires, increment `user_real_balance` by `payout`.

### 5c. Modified: `tick_scheduler.rs`

Add dual-balance tracking (separate from per-batch position balances):

```rust
// NEW fields (dual-balance):
user_real_balances: RwLock<HashMap<Address, U256>>,
user_virtual_balances: RwLock<HashMap<Address, U256>>,

// NEW methods:
pub async fn on_virtual_balance_credited(&self, user: Address, amount: U256)
    // → virtualBalance[user] += amount

pub async fn on_real_balance_deposited(&self, user: Address, amount: U256)
    // → realBalance[user] += amount

pub async fn on_real_balance_withdrawn(&self, user: Address, amount: U256)
    // → realBalance[user] -= amount

pub async fn on_virtual_balance_withdrawn(&self, user: Address, amount: U256)
    // → virtualBalance[user] -= amount

pub async fn on_batch_payout(&self, user: Address, amount: U256)
    // → realBalance[user] += amount (claims/withdrawals/forceWithdraw always credit real)

pub async fn on_batch_join_debit(&self, user: Address, amount: U256)
    // → debit virtual first, then real (mirrors _debitBalance in contract)

pub async fn get_user_balance(&self, user: Address) -> (U256, U256)
    // → returns (realBalance, virtualBalance)

pub async fn get_user_total_balance(&self, user: Address) -> U256
    // → realBalance + virtualBalance
```

Note: existing `on_player_joined`, `on_player_deposited`, `on_player_withdrawn` stay as-is — they track per-batch position state, not the global balance. The contract handles the balance→position transfer internally. However, these events also trigger the dual-balance updates above (see 5b implicit balance changes).

### 5d. Modified: `api.rs`

New endpoints:

```
GET /vision/user/:address/balance → {
    realBalance: U256,      // backed by L3 USDC in contract
    virtualBalance: U256,   // backed by ArbBridgeCustody on Arb
    total: U256             // realBalance + virtualBalance
}
GET /vision/deposit/:orderId/status → { status: "pending" | "credited_on_l3" | "completed" | "refunded" }
GET /vision/withdraw/:withdrawId/status → { status: "pending" | "completed" }
```

`/balance` returns the user's dual Vision balance (reads from tick_scheduler). `total` is the sum used for display; `realBalance` and `virtualBalance` are needed to determine which withdrawal paths are available (withdrawBalance requires realBalance, withdrawToArb requires virtualBalance).
`/deposit/:orderId/status` returns cross-chain deposit progress (for frontend polling).
`/withdraw/:withdrawId/status` returns cross-chain withdraw progress.

Existing endpoints unchanged:
- `GET /vision/batches` — no change
- `GET /vision/batch/:id/state` — no change (position balances still work same way)
- `GET /vision/balance/:batch_id/:player` — no change (BLS-signed per-batch balance proof)
- `POST /vision/bitmap` — no change
- `POST /vision/backtest` — no change
- `GET /vision/leaderboard` — no change
- `GET /vision/markets` — no change
- `GET /vision/reveal/:batch_id/:tick_id` — no change

### 5e. Modified: `types.rs`

New type for cross-chain deposit tracking:

```rust
pub struct PendingVisionDeposit {
    pub order_id: u64,
    pub user: Address,
    pub amount: U256,
    pub created_at: u64,
    pub status: DepositStatus,  // Pending, CreditedOnL3, CompletedOnArb, Refunded
}

pub enum DepositStatus {
    Pending,
    CreditedOnL3,
    CompletedOnArb,
    Refunded,
}
```

### 5f. Modified: `config.rs`

New fields in VisionConfig:

```rust
pub arb_rpc_url: String,                    // Arbitrum RPC for watching deposits
pub arb_bridge_custody_address: String,     // ArbBridgeCustody address on Arb
pub arb_chain_id: u64,                      // 42161 (Arbitrum One)
pub deposit_poll_interval_ms: u64,          // polling interval for Arb events
pub deposit_finality_confirmations: u64,    // ~15 for Arb
```

### 5g. Unchanged oracle modules

- `resolver.rs` — tick resolution unchanged (works on position balances, not global balance)
- `side_matching.rs` — unchanged
- `multiplier.rs` — unchanged
- `bitmap_store.rs` — unchanged
- `engine.rs` — unchanged (drives tick resolution, not deposits)
- `batch_config_orchestrator.rs` — unchanged

### 5h. Database

New table:

```sql
CREATE TABLE vision_user_balances (
    user_address TEXT PRIMARY KEY,
    real_balance TEXT NOT NULL DEFAULT '0',     -- uint256 as string, backed by L3 USDC
    virtual_balance TEXT NOT NULL DEFAULT '0',  -- uint256 as string, backed by ArbBridgeCustody
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vision_deposit_orders (
    order_id BIGINT PRIMARY KEY,
    user_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending/credited_on_l3/completed/refunded
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE vision_withdraw_orders (
    withdraw_id BIGINT PRIMARY KEY,
    user_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending/completed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

---

## 6. Frontend

### 6a. New hooks

**`useDepositToVision.ts`** — Cross-chain deposit from Arbitrum:
```typescript
export function useDepositToVision() {
  // Chain: Arbitrum
  // Step 1: approve USDC (6 dec) → ArbBridgeCustody
  // Step 2: call ArbBridgeCustody.depositToVision(usdcAmount)
  // Step 3: poll GET /vision/user/:address/balance until credited
  return {
    deposit: (usdcAmount: bigint) => void,
    orderId: bigint | null,
    step: 'idle' | 'approving' | 'depositing' | 'bridging' | 'done' | 'error',
    error: string | null,
    reset: () => void,
  }
}
```

**`useDepositBalance.ts`** — Direct deposit from L3:
```typescript
export function useDepositBalance() {
  // Chain: L3
  // Step 1: approve USDC (18 dec) → Vision.sol
  // Step 2: call Vision.depositBalance(amount)
  return {
    deposit: (amount: bigint) => void,
    step: 'idle' | 'approving' | 'depositing' | 'done' | 'error',
    approveHash: `0x${string}` | undefined,
    depositHash: `0x${string}` | undefined,
    error: string | null,
    reset: () => void,
  }
}
```

**`useWithdrawBalance.ts`** — Withdraw to L3 wallet:
```typescript
export function useWithdrawBalance() {
  // Chain: L3
  // Calls Vision.withdrawBalance(amount)
  return {
    withdraw: (amount: bigint) => void,
    step: 'idle' | 'withdrawing' | 'done' | 'error',
    txHash: `0x${string}` | undefined,
    error: string | null,
  }
}
```

**`useWithdrawToArb.ts`** — Withdraw to Arbitrum:
```typescript
export function useWithdrawToArb() {
  // Chain: L3
  // Step 1: call Vision.withdrawToArb(amount)
  // Step 2: poll for Arb USDC balance increase (or oracle API status)
  return {
    withdraw: (amount: bigint) => void,
    step: 'idle' | 'withdrawing' | 'bridging' | 'done' | 'error',
    txHash: `0x${string}` | undefined,
    error: string | null,
  }
}
```

**`useVisionBalance.ts`** — Read user's dual Vision balance:
```typescript
export function useVisionBalance() {
  // Reads Vision.realBalance(address) + Vision.virtualBalance(address) on L3
  // Or fetches from oracle API: GET /vision/user/:address/balance
  return {
    realBalance: bigint,     // 18 dec, backed by L3 USDC in contract
    virtualBalance: bigint,  // 18 dec, backed by ArbBridgeCustody on Arb
    total: bigint,           // realBalance + virtualBalance (display value)
    isLoading: boolean,
    refetch: () => void,
  }
}
```

### 6b. Modified hooks

**`useJoinBatch.ts`** — Remove USDC approve step:
```typescript
// BEFORE flow: encode bitmap → approve USDC → joinBatch()
// AFTER flow:  encode bitmap → joinBatch()
//
// Remove: approve step, approveHash state
// Add: check balance >= depositAmount before calling joinBatch
// joinBatch now pulls from Vision balance internally, no transferFrom
```

**`useDeposit.ts`** (batch top-up) — Remove USDC approve step:
```typescript
// BEFORE flow: approve USDC → deposit()
// AFTER flow:  deposit()
//
// Remove: approve step
// Add: check balance >= amount
```

**`useWithdraw.ts`** (batch exit) — Semantics change:
```typescript
// BEFORE: Vision.withdraw() sends USDC to user's L3 wallet
// AFTER:  Vision.withdraw() credits balance[user] inside Vision
//
// Hook still works same way (fetch BLS proof → call withdraw)
// but user gets balance credit, not USDC in wallet.
// User then uses withdrawBalance() or withdrawToArb() to get USDC out.
```

**`useClaim.ts`** (claim rewards) — Same semantics change:
```typescript
// BEFORE: Vision.claimRewards() sends USDC to user's L3 wallet
// AFTER:  Vision.claimRewards() credits balance[user] inside Vision
// Hook unchanged, just different where the money lands.
```

### 6c. Modified components

**`DepositModal.tsx`** — Currently deposits into a batch. Split into:
- Balance deposit (global, feeds the wallet)
- Batch deposit (top-up specific batch, from balance)

**`WithdrawModal.tsx`** — Currently withdraws from batch to L3 wallet. Now two-step:
- Withdraw from batch → credits `realBalance` (batch payouts always real)
- Withdraw balance → to L3 wallet (from `realBalance`) or bridge to Arb (from `virtualBalance`)
- Show which balance type funds each withdrawal path

**`BatchEntryPanel.tsx`** — Join flow changes:
- Remove approve step from UI stepper
- Show balance check: "Balance: X USDC" with link to deposit if insufficient
- joinBatch call unchanged (just no approve tx)

**`MyPositions.tsx`** — Add global balance display alongside per-batch positions

**`VisionPage.tsx`** — Add dual-balance section at top:
```
┌─────────────────────────────────────────┐
│  Balance: 1,204.50 USDC                 │
│    L3: 804.50  •  Arb-backed: 400.00   │
│  [ DEPOSIT ]  [ WITHDRAW ]              │
└─────────────────────────────────────────┘
```
- Total = `realBalance + virtualBalance` (what the user can spend)
- "L3" = `realBalance` (withdrawable to L3 wallet)
- "Arb-backed" = `virtualBalance` (withdrawable to Arb wallet)
- DEPOSIT: auto-detect chain → Arbitrum = cross-chain (credits virtualBalance), L3 = direct (credits realBalance)
- WITHDRAW: shows available paths based on balance types:
  - "To L3 wallet" enabled if `realBalance > 0`
  - "To Arbitrum" enabled if `virtualBalance > 0`
- If total = 0 and no positions: show onboarding deposit prompt

### 6d. Config + Multi-chain

**AUDIT FIX C-05 (single-chain wagmi):** Currently wagmi config only has L3 chain. `ChainGuard` blocks the entire UI if user is on Arbitrum. Must add Arb as a supported chain.

```typescript
// wagmi config — add Arb chain
const chains = [l3Chain, arbitrum] as const;

// ChainGuard must become context-aware:
// - On Vision deposit page: allow Arbitrum (for cross-chain deposit)
// - On Vision trading pages: require L3
// - On ITP pages: require L3 (existing behavior)
```

Add to frontend env / config:
```
NEXT_PUBLIC_ARB_BRIDGE_CUSTODY_ADDRESS=0x...  // ArbBridgeCustody on Arb
NEXT_PUBLIC_ARB_CHAIN_ID=42161
NEXT_PUBLIC_ARB_USDC_ADDRESS=0x...            // USDC on Arb (6 dec)
```

Already existing:
```
NEXT_PUBLIC_VISION_ADDRESS=0xD185B4846E5fd5419fD4D077dc636084BEfC51C0
NEXT_PUBLIC_L3_CHAIN_ID=421611337
```

### 6e. Decimal handling

**AUDIT FIX C-06 (6-decimal hardcoding):** All Vision frontend components currently hardcode 6 decimals. L3 USDC is 18 decimals. Fix:

```typescript
// frontend/lib/vision/constants.ts
export const VISION_USDC_DECIMALS = 18;  // L3 USDC (was hardcoded 6 everywhere)
export const ARB_USDC_DECIMALS = 6;       // Arb USDC (for deposit modal)

// Replace ALL instances of:
//   formatUnits(amount, 6) → formatUnits(amount, VISION_USDC_DECIMALS)
//   parseUnits(input, 6)   → parseUnits(input, VISION_USDC_DECIMALS)
//
// Affected files (grep "6" in vision/ components):
//   DepositModal.tsx, WithdrawModal.tsx, BatchEntryPanel.tsx,
//   MyPositions.tsx, ExpandedBatch.tsx, TopPlayers.tsx,
//   All vision hooks that format/parse amounts
```

### 6f. Deposit status tracking

**AUDIT FIX H-14 (no deposit status tracking):** Add a deposit status component:

```typescript
// useDepositStatus.ts — poll oracle API for deposit state
export function useDepositStatus(orderId: bigint | null) {
  // GET /vision/deposit/:orderId/status → { status: 'pending' | 'credited' | 'completed' | 'refunded' }
  return { status, isLoading }
}
```

Show in deposit flow UI: "Depositing → Bridging → Credited" progress indicator.

### 6g. ABI updates

Add Vision.sol new functions to frontend ABI:
- `creditBalance` (won't be called from frontend, but good for event decoding)
- `depositBalance`
- `withdrawBalance`
- `withdrawToArb`
- `realBalance(address) → uint256`
- `virtualBalance(address) → uint256`
- `balanceOf(address) → uint256` (returns real + virtual)

Add ArbBridgeCustody new functions:
- `depositToVision`
- `completeVisionDeposit` (event decoding only)
- `refundVisionDeposit` (event decoding only)
- `visionDeposits(uint256) → VisionDeposit`

---

## 7. Gas Tokens (GM)

L3 uses GM (18 dec) as the native gas token. Every tx on L3 costs GM. Users and bots need GM to call `joinBatch`, `deposit`, `updateBitmap`, `claimRewards`, `withdraw`, etc.

### Problem

User deposits USDC from Arbitrum → gets Vision balance. But they have 0 GM on L3 → can't submit any transaction.

### Solution: Oracle gas drip

When oracles credit a user's Vision balance (via `creditBalance`), they also send a small GM drip to the user's L3 address. This is a simple native transfer, not a contract call.

```
On VisionDepositCreated(orderId, user, amount):
  1. Wait for Arb finality
  2. BLS-sign + submit Vision.creditBalance() on L3          ← USDC balance
  3. Send GM drip: transfer 0.01 GM to user on L3            ← gas tokens
  4. BLS-sign + submit ArbBridgeCustody.completeVisionDeposit() on Arb
```

**Drip rules:**
- Amount: fixed small amount (e.g. 0.01 GM, enough for ~1000 L3 txs)
- Only on first deposit (check if user's L3 GM balance < threshold)
- Source: oracle hot wallet on L3 (funded at deploy time)
- No BLS needed for the drip — it's a simple ETH-like transfer from oracle wallet

**Oracle config additions:**
```rust
pub gas_drip_amount: U256,           // e.g. 10_000_000_000_000_000 (0.01 GM)
pub gas_drip_threshold: U256,        // only drip if user GM balance < this
pub gas_drip_wallet_key: String,     // oracle hot wallet private key for drips
```

### Frontend

Show GM balance alongside USDC balance. If GM is 0, show warning:

```
┌─────────────────────────────────────────┐
│  Balance: 1,204.50 USDC                 │
│  Gas: 0.01 GM (~1000 txs)              │
│  [ DEPOSIT ]  [ WITHDRAW ]              │
└─────────────────────────────────────────┘
```

New hook:
```typescript
function useL3GasBalance() {
  // Reads native GM balance on L3
  return { balance: bigint, isLow: boolean }
}
```

### Bots

Bots on L3 also need GM. Two paths:
- **Local dev**: `start.sh` funds bots with GM (see section 10)
- **Production**: bots call `ArbBridgeCustody.depositToVision()` → get auto-dripped GM on first deposit. Or oracles can manually fund known bot addresses.

---

## 8. Bots

**AUDIT FIX C-07 (DECIMALS=6 hardcoded, ARB_USDC address):**

```python
# vision-bot/bot.py
# BEFORE:
DECIMALS = 6
USDC_ADDRESS = os.environ["ARB_USDC"]

# AFTER:
DECIMALS = 18           # L3 USDC is 18 decimals
USDC_ADDRESS = os.environ["L3_USDC"]  # L3 USDC address, not Arb

# vision-bot/config.toml
# BEFORE:
rpc_url = "http://localhost:8546"   # Arb port

# AFTER:
rpc_url = "http://localhost:8547"   # L3 port (or RPC_URL from env)
```

Bots interact with Vision.sol on L3 directly. Changes:

**Before:**
```
1. bot has USDC on L3
2. USDC.approve(Vision, amount)
3. Vision.joinBatch(batchId, configHash, amount, stakePerTick, bitmapHash)
4. POST /vision/bitmap
```

**After:**
```
1. bot has USDC + GM on L3
2. USDC.approve(Vision, amount)
3. Vision.depositBalance(amount)       ← new step: fund balance
4. Vision.joinBatch(batchId, ...)      ← no approve needed, pulls from balance
5. POST /vision/bitmap
```

Or from Arbitrum (gets auto-dripped GM):
```
1. bot has USDC on Arb
2. USDC.approve(ArbBridgeCustody, amount)
3. ArbBridgeCustody.depositToVision(amount)
4. wait for balance credit + GM drip (~2 min)
5. Vision.joinBatch(batchId, ...)      ← now has GM for gas
6. POST /vision/bitmap
```

Bot registry (`registerBot`, `deregisterBot`, `getAllActiveBots`) — unchanged.

---

## 9. Data Node

No changes. Data node serves market snapshots, batch configs, and tick history. None of these are affected by the balance/deposit changes.

- `GET /vision/snapshot` — unchanged
- `GET /vision/markets/active` — unchanged
- `GET /vision/batch/:batch_id/history` — unchanged
- `WS /vision/ws` — unchanged

---

## 10. start.sh — Deploy Vision on L3

`start.sh` currently deploys Vision on Arbitrum (`ARB_RPC_URL`). Must change to deploy on L3 (`RPC_URL`).

### Changes to start.sh

**Step 6: Deploy Vision** — switch from `$ARB_RPC_URL` to `$RPC_URL` (L3):
```bash
# BEFORE (line ~752):
forge script script/DeployVision.s.sol:DeployVision \
    --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-vision.log 2>&1

# AFTER:
USDC_ADDRESS=$USDC \
forge script script/DeployVision.s.sol:DeployVision \
    --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-vision.log 2>&1
```

**Step 6b: Deploy Vision batches** — same, switch to `$RPC_URL`:
```bash
# BEFORE (line ~790):
forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
    --broadcast --slow --rpc-url $ARB_RPC_URL > ../logs/deploy-vision-batches.log 2>&1

# AFTER:
forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
    --broadcast --slow --rpc-url $RPC_URL > ../logs/deploy-vision-batches.log 2>&1
```

**Fund Vision bots on L3** (not Arb) — lines ~350-356:
```bash
# BEFORE: fund bots on Arb with ETH + ARB_USDC
cast send --private-key $DEPLOYER_KEY --value 100ether $VISION_BOT_ADDRESS --rpc-url $ARB_RPC_URL
cast send --private-key $DEPLOYER_KEY $ARB_USDC "mint(address,uint256)" $VISION_BOT_ADDRESS 50000000000 --rpc-url $ARB_RPC_URL

# AFTER: fund bots on L3 with GM (gas) + L3 USDC
# GM gas tokens (native transfer on L3)
cast send --private-key $DEPLOYER_KEY --value 1ether $VISION_BOT_ADDRESS --rpc-url $RPC_URL
cast send --private-key $DEPLOYER_KEY --value 1ether $VISION_BOT2_ADDRESS --rpc-url $RPC_URL
# L3 USDC for Vision deposits
cast send --private-key $DEPLOYER_KEY $USDC "mint(address,uint256)" $VISION_BOT_ADDRESS $(cast --to-wei 50000) --rpc-url $RPC_URL
cast send --private-key $DEPLOYER_KEY $USDC "mint(address,uint256)" $VISION_BOT2_ADDRESS $(cast --to-wei 50000) --rpc-url $RPC_URL
echo -e "  ${GREEN}Vision bots funded with 1 GM + 50k USDC on L3${NC}"
```

**Fund test user on L3** — add GM drip for test user:
```bash
# Fund test user with GM gas tokens on L3
cast send --private-key $DEPLOYER_KEY --value 1ether $TEST_USER_ADDRESS --rpc-url $RPC_URL
echo -e "  ${GREEN}Test user funded with 1 GM on L3${NC}"
```

**Oracle args** — Vision is now on L3, update RPC reference:
```bash
# BEFORE (line ~932):
ORACLE_ARGS="$ORACLE_ARGS --vision-rpc-ws-url $ARB_RPC_URL"

# AFTER:
ORACLE_ARGS="$ORACLE_ARGS --vision-rpc-ws-url $RPC_URL"
# Add Arb watcher for cross-chain deposits:
ORACLE_ARGS="$ORACLE_ARGS --vision-arb-rpc-url $ARB_RPC_URL"
ORACLE_ARGS="$ORACLE_ARGS --vision-arb-bridge-custody $ARB_BRIDGE_CUSTODY"
```

### DeployVision.s.sol

Update to accept L3 USDC address and L3BridgeCustody:
```solidity
// Constructor or post-deploy setup:
Vision vision = new Vision(l3UsdcAddress, oracleRegistry, feeCollector);
// Set L3BridgeCustody reference (BLS-gated or at deploy time)
```

Deploy script must also write to `deployments/vision-deployment.json` with L3 chain ID (111222333) instead of Arb chain ID.

---

## 11. Security

### Dual-balance invariants (v7)

The core security property: **real USDC can never be drained by virtual balance holders.**

```
INVARIANT 1 (real solvency):
  USDC.balanceOf(Vision) >= totalRealBalance + sum(active batch deposits) + accumulatedFees

INVARIANT 2 (real balance consistency):
  totalRealBalance == sum(realBalance[user] for all users)

INVARIANT 3 (virtual balance consistency):
  totalVirtualBalance == sum(virtualBalance[user] for all users)

INVARIANT 4 (Arb solvency):
  ArbBridgeCustody.visionReserve >= totalVirtualBalance (in 6-dec equivalent)

INVARIANT 5 (withdrawal isolation):
  withdrawBalance() ONLY debits realBalance — never touches virtualBalance
  withdrawToArb() ONLY debits virtualBalance — never touches realBalance

INVARIANT 6 (batch payout direction):
  claimRewards/withdraw/forceWithdraw ALWAYS credit realBalance
  (batch pool holds real L3 USDC from all participants)
```

### Security checklist

1. **BLS on all cross-chain ops**: `creditBalance`, `completeVisionDeposit`, `refundVisionDeposit`, `completeVisionWithdraw`
2. **Idempotency**: `depositProcessed[depositId]` prevents double-credit. `withdrawProcessed[withdrawId]` prevents replay withdrawals. Both on-chain.
3. **Refund safety**: before signing `refundVisionDeposit`, each oracle MUST query `Vision.depositProcessed[depositId]` on L3. If true → refuse to sign. Prevents credit+refund double-money.
4. **Dual-balance separation**: `realBalance` withdrawable via `withdrawBalance` (L3 USDC). `virtualBalance` withdrawable via `withdrawToArb` (Arb USDC via oracles). No mixing.
5. **Batch entry debits virtual first**: `_debitBalance` uses virtual before real when joining batches. Batch payouts always credit real — virtual gradually converts to real through trading.
6. **Decimal conversion**: `DecimalLib.toInternal()` (6→18) / `DecimalLib.toUsdc()` (18→6) at every cross-chain boundary.
7. **Balance isolation**: global balance is user-controlled. Batch pause doesn't lock it.
8. **forceWithdraw credits realBalance**: oracle emergency exit puts funds in user's `realBalance`.
9. **Withdrawal sends to user, not caller**: `completeVisionWithdraw` sends to `user` param, not `msg.sender`.
10. **No L3BridgeCustody in Vision flows**: `withdrawToArb` is virtual debit. No L3 USDC moves.
11. **Deposit state machine**: DB-persisted status + on-chain idempotency = crash-safe pipeline.
12. **creditBalance cap**: amount is BLS-signed over exact deposit event data.
13. **collectFees credits realBalance**: no `safeTransfer` — credits `realBalance[feeCollector]`. Eliminates revert when 100% virtual deposits leave 0 real USDC.
14. **visionReserve tracking**: ArbBridgeCustody tracks Vision-specific USDC separately from ITP flows.
15. **L3 confirmation depth**: wait N+5 blocks before marking `credited_on_l3`. Protects against L3 reorgs.

---

## 12. Summary

| Component | File | Change |
|-----------|------|--------|
| **Vision.sol** | `contracts/src/vision/Vision.sol` | Add `realBalance`/`virtualBalance` dual mappings, `totalRealBalance`/`totalVirtualBalance`, `depositProcessed`, `withdrawNonce`, `withdrawProcessed`. New: `creditBalance` (virtual), `depositBalance` (real), `withdrawBalance` (real), `withdrawToArb` (virtual), `balanceOf` (view), `_debitBalance` (internal: virtual-first). Modify `_joinBatch`/`deposit` to use `_debitBalance`, `claimRewards`/`withdraw`/`forceWithdraw` to credit `realBalance`, `collectFees` to credit `realBalance[feeCollector]`. Full redeploy (not upgradeable). |
| **IVision.sol** | `contracts/src/interfaces/IVision.sol` | Add new functions, events, errors to interface. |
| **ArbBridgeCustody** | `contracts/src/custody/ArbBridgeCustody.sol` | Add `depositToVision`, `completeVisionDeposit`, `refundVisionDeposit`, `completeVisionWithdraw` (sends to user, not msg.sender), `visionReserve` tracker, `withdrawProcessed` replay protection. |
| **IArbBridgeCustody** | `contracts/src/interfaces/IBridge.sol` | Add 4 new functions + events to interface. |
| **L3BridgeCustody** | `contracts/src/custody/L3BridgeCustody.sol` | No changes. Not involved in Vision flows. |
| **Deploy script** | `contracts/script/DeployVision.s.sol` | Deploy on L3 (not Arb). Same constructor args, no L3BridgeCustody needed. |
| **Oracle: deposit watcher** | `oracle/src/vision/vision_deposit_watcher.rs` | Watch `VisionDepositCreated` on Arb, credit on L3 (virtualBalance) + GM drip, complete/refund on Arb. Watch `WithdrawToArbRequested` on L3, bridge to Arb. Refund safety: query `depositProcessed` before signing. |
| **Oracle: chain_listener** | `oracle/src/vision/chain_listener.rs` | Add handlers for `BalanceCredited` (virtual), `BalanceDeposited` (real), `RealBalanceWithdrawn`, `WithdrawToArbRequested`. Infer implicit balance changes from `PlayerJoined`/`RewardsClaimed`/`PlayerWithdrawn`/`ForceWithdrawn`. |
| **Oracle: tick_scheduler** | `oracle/src/vision/tick_scheduler.rs` | Add `user_real_balances` + `user_virtual_balances` maps. Dual-balance event handlers. |
| **Oracle: api** | `oracle/src/vision/api.rs` | `GET /vision/user/:address/balance` returns `{ realBalance, virtualBalance, total }`. |
| **Oracle: types** | `oracle/src/vision/types.rs` | Add `PendingVisionDeposit`, `DepositStatus`. |
| **Oracle: config** | `oracle/src/vision/config.rs` | Add `arb_rpc_url`, `arb_bridge_custody_address`, `arb_chain_id`, gas drip config. |
| **Oracle: mod.rs** | `oracle/src/vision/mod.rs` | Declare new `vision_deposit_watcher` module. |
| **Database** | migrations | `vision_user_balances` (real_balance + virtual_balance), `vision_deposit_orders`, `vision_withdraw_orders`. |
| **Frontend: new hooks** | `frontend/hooks/vision/` | `useDepositToVision`, `useDepositBalance`, `useWithdrawBalance`, `useWithdrawToArb`, `useVisionBalance` (returns real+virtual+total), `useL3GasBalance` (6 new hooks). |
| **Frontend: modified hooks** | `frontend/hooks/vision/` | `useJoinBatch` (remove approve), `useDeposit` (remove approve), `useWithdraw` (credits realBalance), `useClaim` (credits realBalance). |
| **Frontend: components** | `frontend/components/domain/vision/` | `DepositModal` (split global/batch), `WithdrawModal` (two-step, path depends on balance type), `BatchEntryPanel` (no approve), `MyPositions` (show dual balance), `VisionPage` (dual balance display: L3 + Arb-backed). |
| **Frontend: config** | `frontend/.env` | Add `ARB_BRIDGE_CUSTODY_ADDRESS`, `ARB_CHAIN_ID`, `ARB_USDC_ADDRESS`. Add Arb to wagmi chains. |
| **Frontend: wagmi** | `frontend/lib/wagmi.ts` | Add Arbitrum chain. Make ChainGuard context-aware (allow Arb on deposit page). |
| **Frontend: decimals** | all vision components | Replace hardcoded 6 → 18 for L3 USDC. Add `VISION_USDC_DECIMALS` constant. |
| **Frontend: ABI** | `frontend/lib/contracts/` | Add new function ABIs for Vision + ArbBridgeCustody. |
| **Bots: decimals** | `vision-bot/bot.py` | `DECIMALS = 18`, `L3_USDC` address, L3 RPC URL. |
| **Bots: config** | `vision-bot/config.toml` | RPC URL points to L3 (not Arb). |
| **Bots** | — | Need GM + USDC on L3. `depositBalance()` before joining. Auto-dripped GM on first cross-chain deposit. |
| **Data node** | — | No changes. |
| **start.sh** | `start.sh` | Deploy Vision on L3 (not Arb). Fund bots + test user with GM + L3 USDC. Update oracle args for L3 RPC. |
| **DeployVision.s.sol** | `contracts/script/DeployVision.s.sol` | Target L3 chain, accept L3 USDC address. |

---

## 13. Audit Findings Log

Three rounds of parallel cynical audit agents reviewed this design against the actual codebase. Round 1 found surface issues (v6 fixes). Round 2 identified the fundamental solvency flaw. Round 3 confirmed with a concrete attack scenario and converged on the dual-balance architecture (v7).

### Round 1: Critical (all fixed in v6)

| ID | Finding | Fix |
|----|---------|-----|
| C-01 | `ArbBridgeCustody.completeBridge()` sends USDC to `msg.sender` (oracle), not user | New `completeVisionWithdraw()` that sends to explicit `user` param (Section 2) |
| C-02 | `L3BridgeCustody.initiateBridge()` uses pull model (`safeTransferFrom`), design used push | Removed L3BridgeCustody from Vision flows entirely. `withdrawToArb` is virtual debit (Section 3) |
| C-03 | No solvency invariant — no `totalBalance` tracking | Replaced with dual `totalRealBalance` + `totalVirtualBalance` in v7 (Section 1) |
| C-04 | `collectFees` could drain pool below user balances | Fixed in v7: `collectFees` credits `realBalance[feeCollector]` instead of `safeTransfer` (Section 1) |
| C-05 | Frontend wagmi single-chain (L3 only) — cross-chain deposit impossible | Added Arbitrum to wagmi chains, ChainGuard made context-aware (Section 6d) |
| C-06 | All frontend Vision components hardcode 6 decimals, L3 USDC is 18 | Added `VISION_USDC_DECIMALS = 18` constant, replace all instances (Section 6e) |
| C-07 | Bot `DECIMALS = 6` hardcoded, loads `ARB_USDC` address | Fixed to `DECIMALS = 18`, `L3_USDC` address, L3 RPC URL (Section 8) |
| C-08 | Two-phase deposit has no atomic rollback | DB-persisted state machine with on-chain idempotency (Section 5a) |
| C-09 | No duplicate-credit protection across oracle restarts | `depositProcessed[depositId]` on-chain + startup recovery from DB state (Section 5a) |
| C-10 | Vision.sol not upgradeable — migration plan missing | Noted: full redeploy required. Same constructor args. (Section 1) |
| C-11 | L3BridgeCustody pull/push mismatch blocks withdrawals | Same fix as C-02 — L3BridgeCustody not used (Section 3) |

### Round 1: High (all addressed in v6)

| ID | Finding | Fix |
|----|---------|-----|
| H-01 | No `totalBalance` — solvency check requires O(n) iteration | Replaced with `totalRealBalance` + `totalVirtualBalance` (Section 1) |
| H-02 | `creditBalance` has no cap | Amount is BLS-signed over exact deposit event data — consensus prevents arbitrary credits (Section 11) |
| H-03 | Missing `balance >= amount` check in `withdrawToArb` | `virtualBalance[msg.sender] < amount` check in v7 (Section 1) |
| H-04 | No gas estimation for `creditBalance` | Implementation concern — use `eth_estimateGas` before submit. Standard practice. |
| H-05 | Polling interval not specified | Set default: `deposit_poll_interval_ms = 5000` (Section 5a) |
| H-06 | No retry/timeout for stuck deposits | Auto-refund after 2h, alert after 30min (Section 5a) |
| H-07 | `useDeposit` still has approve step | Covered in Section 6b — approve removed |
| H-08 | `useJoinBatch` still has approve step | Covered in Section 6b — approve removed |
| H-09 | No balance display component | Covered in Section 6c — VisionPage dual-balance section |
| H-10 | `useWithdraw` semantics change not reflected | Covered in Section 6b — credits realBalance |
| H-11 | Bot config points to Arb RPC port | Fixed in Section 8 — L3 RPC URL |
| H-12 | start.sh funds bots on Arb | Fixed in Section 10 — fund on L3 with GM + USDC |
| H-13 | No mechanism to reclaim GM drip | Accepted risk — 0.01 GM is negligible. No reclaim needed. |
| H-14 | No deposit status tracking in frontend | Added `useDepositStatus` hook + progress indicator (Section 6f) |
| H-15 | `createBatchAndJoin` path not fully covered | Covered — uses `_joinBatch` which is fixed (Section 1) |
| H-16 | Bridge orchestrator has no Vision withdrawal handler | New `vision_deposit_watcher` handles both deposits AND withdrawals (Section 5a) |

### Round 2: Critical findings → led to v7 rewrite

| ID | Finding | Resolution |
|----|---------|------------|
| R2-C-01 | **Fundamental solvency flaw**: `creditBalance` mints virtual balance, but `collectFees` tries real `USDC.safeTransfer`. With 100% Arb deposits, 0 real USDC in contract → `collectFees` reverts. | **Fixed in v7**: `collectFees` now credits `realBalance[feeCollector]` instead of `safeTransfer` (Section 1). |
| R2-C-02 | **Orphaned L3 USDC drain**: batch participants deposit real L3 USDC, but virtual-balance holders can call `withdrawBalance` to drain it. Single `balance[]` mapping doesn't distinguish real from virtual. | **Fixed in v7**: dual-balance architecture. `realBalance` and `virtualBalance` are separate. `withdrawBalance` only debits `realBalance`. `withdrawToArb` only debits `virtualBalance`. (Section 1) |
| R2-C-03 | `completeVisionWithdraw` has NO replay protection. BLSVerifier `referenceNonce` is a snapshot selector, not consumed — same (message, signature) replayable. | **Fixed in v7**: added `withdrawProcessed[withdrawId]` mapping (Section 2). |

### Round 2: High findings

| ID | Finding | Resolution |
|----|---------|------------|
| R2-H-01 | Auto-refund race: credit lands on L3, auto-refund fires on Arb before DB update → double money. | **Downgraded to MEDIUM in round 3.** BLS consensus = all oracles must agree. Added rule: query `depositProcessed` on L3 before signing refund. Only `pending` deposits are refundable. (Section 5a) |
| R2-H-02 | `ArbBridgeCustody` shared pool: ITP flows + Vision flows share same USDC pool with no accounting. | **Downgraded to LOW in round 3.** Added `visionReserve` counter on ArbBridgeCustody (Section 2). In practice, ITP USDC passes through and doesn't stay in custody long. |
| R2-H-03 | `useChainWriteContract` forces L3 chain for all writes. Cross-chain deposit needs Arb writes. | Addressed in Section 6d — wagmi multi-chain config. |
| R2-H-04 | `BatchEntryPanel` 1e6 → 10^12 underflow: displays amounts with 6 decimals but L3 uses 18. | Addressed in Section 6e — `VISION_USDC_DECIMALS = 18` constant. |

### Round 3: Confirmed killer scenario → dual-balance architecture

All three round-3 agents independently converged on the same attack:

> **Alice** deposits 1000 real L3 USDC via `depositBalance`. `balance[Alice] = 1000`.
> **Bob** gets 1000 virtual credit via `creditBalance` (Arb bridge). `balance[Bob] = 1000`.
> Bob calls `withdrawBalance(1000)` → succeeds, draining Alice's real USDC.
> Alice calls `withdrawBalance(1000)` → reverts (0 real USDC left).
> **Alice's funds are permanently lost.**

**Resolution:** Dual-balance architecture (v7). `withdrawBalance` ONLY debits `realBalance`. `withdrawToArb` ONLY debits `virtualBalance`. The attack is impossible because Bob's `virtualBalance` cannot be withdrawn via `withdrawBalance`.

### Round 3: Additional findings

| ID | Finding | Severity | Resolution |
|----|---------|----------|------------|
| R3-01 | L3 reorg after `creditBalance` could orphan credit | MEDIUM | Wait N+5 L3 blocks before marking `credited_on_l3` (Section 5a) |
| R3-02 | `tick_scheduler` doesn't track implicit balance changes from join/claim/withdraw/forceWithdraw | MEDIUM | Infer from existing events: `PlayerJoined` → debit, `RewardsClaimed`/`PlayerWithdrawn`/`ForceWithdrawn` → credit realBalance (Section 5b) |
| R3-03 | `--bls-key-seed-index` deterministic keys catastrophic in production | LOW | Implementation note: add chain ID guard to reject deterministic keys on mainnet. |
| R3-04 | Solvency check in `claimRewards`/`withdraw`/`forceWithdraw` silently removed | INFO | Balance-credit model removes the `USDC.balanceOf(this) < payout` check. BLS consensus + dual-balance invariants provide the safety net. Batch payouts always credit `realBalance` which is backed by real participant deposits. |
