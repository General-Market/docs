# Round-Based Vision Batches — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Vision from infinite-tick batches into round-based batches where each round has a betting phase, auto-settlement, and per-market bitmap transparency.

**Architecture:** Each batch = one round. Betting lasts T seconds, settlement takes up to 2T. Oracle creates new batches on a heartbeat, resolves the previous one, and calls `settleBatch()` to pay everyone out in one tx. Direct USDC in/out per round — no persistent balance. Multiple timeframes per source run in parallel.

**Tech Stack:** Solidity (Vision.sol), Rust (oracle), Python (vision-bot), TypeScript/Next.js (frontend)

**Spec:** `docs/plans/2026-03-17-vision-round-based-batches.md`

---

## File Map

### Contract (Solidity)

| File | Action | Responsibility |
|------|--------|----------------|
| `contracts/src/interfaces/IVision.sol` | Modify | Add `settleBatch`, `joinBatchDirect` signatures, `PlayerSettled`/`BatchSettled` events |
| `contracts/src/vision/Vision.sol` | Modify | Remove source uniqueness + MAX_BATCHES cap, add `settleBatch()` + `joinBatchDirect()` |
| `contracts/test/VisionRound.t.sol` | Create | Tests for round-based functions |

### Oracle (Rust)

| File | Action | Responsibility |
|------|--------|----------------|
| `oracle/migrations/007_create_round_tables.sql` | Create | `vision_batch_lifecycle` + `vision_round_players` tables |
| `oracle/src/vision/lifecycle_manager.rs` | Create | Per-source heartbeat: create batch → resolve prev → sign → settle |
| `oracle/src/vision/settle_signer.rs` | Create | Compute `settleBatch` BLS message hash, sign, aggregate |
| `oracle/src/vision/round_api.rs` | Create | REST endpoints: `/vision/rounds/*`, `/vision/rounds/:id/bitmaps`, `/vision/rounds/:id/results`, `/vision/player/:addr/rounds` |
| `oracle/src/vision/engine.rs` | Modify | Spawn lifecycle manager alongside existing tick engine |
| `oracle/src/vision/mod.rs` | Modify | Register new modules |
| `oracle/src/vision/types.rs` | Modify | Add `RoundState` enum, `RoundResult` struct |
| `oracle/src/vision/api.rs` | Modify | Mount new round routes |
| `oracle/src/main.rs` | Modify | Pass config to lifecycle manager spawn |

### Bot (Python)

| File | Action | Responsibility |
|------|--------|----------------|
| `vision-bot/framework/chain.py` | Modify | Add `joinBatchDirect` ABI + executor method |
| `vision-bot/framework/tracker.py` | Modify | Add `check_rounds()` for per-round join cycle |
| `vision-bot/bot.py` | Modify | Add round-based mode flag, call `check_rounds()` |
| `vision-bot/tests/test_tracker.py` | Modify | Tests for round-based tracking |

### Frontend (TypeScript)

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/hooks/vision/useRounds.ts` | Create | Fetch rounds by source/timeframe, poll for state changes |
| `frontend/hooks/vision/useRoundResults.ts` | Create | Fetch settlement results + bitmaps for a round |
| `frontend/hooks/vision/useJoinRound.ts` | Create | `joinBatchDirect` tx hook (approve + join) |
| `frontend/components/domain/vision/RoundList.tsx` | Create | Grouped round list by source + timeframe |
| `frontend/components/domain/vision/RoundDetail.tsx` | Create | Bitmap grid + outcomes + PnL per player |
| `frontend/components/domain/vision/RoundCard.tsx` | Create | Single round card with status, countdown, player count |
| `frontend/app/api/vision/rounds/route.ts` | Create | Proxy to oracle `/vision/rounds` |
| `frontend/app/api/vision/rounds/[batchId]/results/route.ts` | Create | Proxy to oracle `/vision/rounds/:id/results` |
| `frontend/lib/contracts/vision-abi.ts` | Modify | Add `joinBatchDirect`, `settleBatch` ABIs |

---

## Phase 1: Contract

### Task 1: Interface — add round-based function signatures and events

**Files:**
- Modify: `contracts/src/interfaces/IVision.sol`

- [ ] **Step 1: Add events and function signatures to IVision.sol**

Add after existing event declarations:

```solidity
event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout, uint256 fee);
event BatchSettled(uint256 indexed batchId, uint256 playerCount);

function joinBatchDirect(
    uint256 batchId,
    bytes32 configHash,
    uint256 depositAmount,
    uint256 stakePerTick,
    bytes32 bitmapHash
) external;

function settleBatch(
    uint256 batchId,
    address[] calldata players,
    uint256[] calldata payouts,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external;
```

- [ ] **Step 2: Add new errors to IVision.sol**

Events `PlayerSettled` and `BatchSettled` are already declared in Step 1. Only add errors here:

```solidity
error InvalidArrayLength();
error AlreadyJoined();
error BatchAlreadySettled();
error InsolventPayout();
```

Note: reuse existing `StakeBelowMinimum` and `InsufficientDeposit` errors (already declared). Do NOT create `StakeTooLow` or `DepositTooLow` — they don't exist in the interface.

No `pendingPayout` mapping or `claimSettlement()` function — settlement credits `realBalance`/`virtualBalance` directly (same pattern as existing `withdraw()`), and players use existing `withdrawBalance()`/`withdrawToSettlement()` to extract funds.

- [ ] **Step 3: Compile to verify**

Run: `cd contracts && forge build`
Expected: compiles with warnings (unimplemented functions)

- [ ] **Step 4: Commit**

```
feat(contracts): add round-based function signatures to IVision interface
```

---

### Task 2: Remove source uniqueness + raise MAX_BATCHES

**Files:**
- Modify: `contracts/src/vision/Vision.sol:35,57-62,246-292`

- [ ] **Step 1: Write test — multiple batches for same source**

Create `contracts/test/VisionRound.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
// Import Vision + test helpers from existing VisionBatch.t.sol setup

contract VisionRoundTest is Test {
    // ... setup with Vision contract, mock BLS, mock USDC (copy from VisionBatch.t.sol)

    function test_createBatch_allowsMultipleBatchesPerSource() public {
        bytes32 sourceId = keccak256("crypto");
        // Create first batch
        uint256 batch1 = vision.createBatch(sourceId, configHash1, 300, 45, blsSig1, nonce, bitmap);
        // Create second batch for SAME source
        uint256 batch2 = vision.createBatch(sourceId, configHash2, 300, 45, blsSig2, nonce, bitmap);
        // Must be different batch IDs
        assertTrue(batch2 > batch1);
        // Latest mapping points to most recent
        assertEq(vision.latestBatchForSource(sourceId), batch2);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-test test_createBatch_allowsMultipleBatchesPerSource -vvv`
Expected: FAIL (sourceIdHasBatch returns existing batch)

- [ ] **Step 3: Modify Vision.sol**

In Vision.sol:

a) Remove `MAX_BATCHES` constant and the check in `_createBatch` (`if (nextBatchId >= MAX_BATCHES) revert TooManyBatches()`). Batches are mapping-based, not array-based — there is no iteration cost. Storage is cheap on L3. Remove the `TooManyBatches` error from IVision.sol as well.

b) Replace `sourceIdToBatchId` and `sourceIdHasBatch` with:
```solidity
mapping(bytes32 => uint256) public latestBatchForSource;
```

c) In `_createBatch()`, remove lines 247-250 (idempotency check) and replace lines 288-289 with:
```solidity
latestBatchForSource[sourceId] = batchId;
```

d) Rewrite `getBatchIdBySourceId()` (lines 350-353) which uses the deleted `sourceIdHasBatch`:
```solidity
function getBatchIdBySourceId(bytes32 sourceId) external view returns (uint256) {
    uint256 batchId = latestBatchForSource[sourceId];
    if (batchId == 0 && _batches[0].sourceId != sourceId) revert BatchNotFound();
    return batchId;
}
```
Note: this now returns the **latest** batch for a source, not the only one. Callers that need all batches should use events or the oracle API.

e) Remove the dead `error BatchAlreadyExists()` from IVision.sol if present.

f) **Update all consumers of `sourceIdToBatchId`** — grep the entire codebase:
   - `contracts/script/DeployAllVisionBatches.s.sol:184` — calls `sourceIdToBatchId()`. Change to `latestBatchForSource()`.
   - `contracts/test/VisionBatch.t.sol` — assertions using `sourceIdHasBatch` and `sourceIdToBatchId`. Update to use `latestBatchForSource`.
   - `contracts/test/Vision.t.sol` — same.
   - `frontend/hooks/vision/useSourceRegistry.ts` — if it reads `sourceIdToBatchId` on-chain, update.
   Run: `grep -rn "sourceIdToBatchId\|sourceIdHasBatch" contracts/ frontend/ oracle/` and fix every hit.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd contracts && forge test --match-test test_createBatch_allowsMultipleBatchesPerSource -vvv`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd contracts && forge test`
Expected: all pass (fix any tests that relied on source uniqueness)

- [ ] **Step 6: Commit**

```
feat(contracts): allow multiple batches per source, remove MAX_BATCHES cap
```

---

### Task 3: Implement `joinBatchDirect()`

**Files:**
- Modify: `contracts/src/vision/Vision.sol`
- Modify: `contracts/test/VisionRound.t.sol`

- [ ] **Step 1: Write test — direct USDC join**

In `VisionRound.t.sol`:

```solidity
function test_joinBatchDirect_transfersUSDC() public {
    uint256 batchId = _createTestBatch();
    uint256 deposit = 10 * 1e18;
    uint256 stake = 1e18;
    bytes32 bitmapHash = keccak256("predictions");

    // Give player USDC and approve
    deal(address(usdc), player, deposit);
    vm.startPrank(player);
    usdc.approve(address(vision), deposit);

    uint256 playerBefore = usdc.balanceOf(player);
    uint256 contractBefore = usdc.balanceOf(address(vision));

    vision.joinBatchDirect(batchId, configHash, deposit, stake, bitmapHash);
    vm.stopPrank();

    // USDC moved from player to contract
    assertEq(usdc.balanceOf(player), playerBefore - deposit);
    assertEq(usdc.balanceOf(address(vision)), contractBefore + deposit);

    // Position exists
    IVision.PlayerPosition memory pos = vision.getPosition(batchId, player);
    assertEq(pos.balance, deposit);
    assertEq(pos.totalDeposited, deposit);
    assertEq(pos.stakePerTick, stake);
    assertEq(pos.bitmapHash, bitmapHash);
    assertFalse(pos.isVirtual);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-test test_joinBatchDirect -vvv`
Expected: FAIL (function not found)

- [ ] **Step 3: Implement `joinBatchDirect` in Vision.sol**

Add after `joinBatch()`:

```solidity
/// @inheritdoc IVision
function joinBatchDirect(
    uint256 batchId,
    bytes32 configHash,
    uint256 depositAmount,
    uint256 stakePerTick,
    bytes32 bitmapHash
) external nonReentrant {
    _promoteConfigIfNeeded(batchId);
    _requireNotLocked(batchId);

    Batch storage b = _batches[batchId];
    if (b.tickDuration == 0) revert BatchNotFound();
    if (b.paused) revert BatchPaused();
    if (b.configHash != configHash) revert BatchNotFound();
    if (stakePerTick < MIN_STAKE_PER_TICK) revert StakeBelowMinimum();
    if (depositAmount < stakePerTick) revert InsufficientDeposit();

    // Transfer USDC directly from player wallet
    USDC.safeTransferFrom(msg.sender, address(this), depositAmount);

    PlayerPosition storage pos = _positions[batchId][msg.sender];
    if (pos.stakePerTick != 0) revert AlreadyJoined();
    pos.bitmapHash = bitmapHash;
    pos.configHash = configHash;
    pos.stakePerTick = stakePerTick;
    pos.startTick = _currentTickId(batchId);
    pos.balance = depositAmount;
    pos.totalDeposited = depositAmount;
    pos.joinTimestamp = block.timestamp;
    pos.isVirtual = false;

    emit PlayerJoined(batchId, msg.sender, stakePerTick, bitmapHash, configHash);
}
```

- [ ] **Step 4: Run test**

Run: `cd contracts && forge test --match-test test_joinBatchDirect -vvv`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat(contracts): add joinBatchDirect for round-based USDC deposit
```

---

### Task 4: Implement `settleBatch()`

**Files:**
- Modify: `contracts/src/vision/Vision.sol`
- Modify: `contracts/test/VisionRound.t.sol`

- [ ] **Step 1: Write test — batch settlement pays out to wallets**

In `VisionRound.t.sol`:

```solidity
function test_settleBatch_paysOutToWallets() public {
    uint256 batchId = _createTestBatch();
    uint256 deposit = 10 * 1e18;

    // Two players join
    _joinDirect(player1, batchId, deposit);
    _joinDirect(player2, batchId, deposit);

    // Oracle settles: player1 won (12 USDC), player2 lost (8 USDC)
    address[] memory players = new address[](2);
    uint256[] memory payouts = new uint256[](2);
    players[0] = player1;
    players[1] = player2;
    payouts[0] = 12 * 1e18; // profit = 2 USDC
    payouts[1] = 8 * 1e18;  // loss = 2 USDC

    bytes memory blsSig = _signSettleBatch(batchId, players, payouts);
    vision.settleBatch(batchId, players, payouts, blsSig, nonce, signersBitmask);

    // Player1: payout credited to realBalance (not direct USDC transfer)
    // profit = 2e18, fee = 2e18 * 30 / 10000 = 6e15
    uint256 expectedFee1 = (2 * 1e18 * 30) / 10000;
    assertEq(vision.realBalance(player1), 12 * 1e18 - expectedFee1);

    // Player2: no profit = no fee, full payout to realBalance
    assertEq(vision.realBalance(player2), 8 * 1e18);

    // Players can withdraw to their wallets via existing withdrawBalance()
    vm.prank(player1);
    vision.withdrawBalance(12 * 1e18 - expectedFee1);
    assertEq(usdc.balanceOf(player1), 12 * 1e18 - expectedFee1);

    // Batch is marked settled (paused)
    IVision.Batch memory b = vision.getBatch(batchId);
    assertTrue(b.paused);

    // Positions deleted
    IVision.PlayerPosition memory pos1 = vision.getPosition(batchId, player1);
    assertEq(pos1.stakePerTick, 0);
}

function test_settleBatch_revertsIfAlreadySettled() public {
    uint256 batchId = _createTestBatch();
    _joinDirect(player1, batchId, 10 * 1e18);

    address[] memory players = new address[](1);
    uint256[] memory payouts = new uint256[](1);
    players[0] = player1;
    payouts[0] = 10 * 1e18;

    bytes memory blsSig = _signSettleBatch(batchId, players, payouts);
    vision.settleBatch(batchId, players, payouts, blsSig, nonce, signersBitmask);

    // Second settlement reverts
    vm.expectRevert(abi.encodeWithSelector(IVision.BatchAlreadySettled.selector));
    vision.settleBatch(batchId, players, payouts, blsSig, nonce, signersBitmask);
}

function test_settleBatch_revertsOnArrayMismatch() public {
    uint256 batchId = _createTestBatch();
    address[] memory players = new address[](2);
    uint256[] memory payouts = new uint256[](1);
    vm.expectRevert(abi.encodeWithSelector(IVision.InvalidArrayLength.selector));
    vision.settleBatch(batchId, players, payouts, "", 0, 0);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd contracts && forge test --match-contract VisionRoundTest -vvv`
Expected: FAIL (settleBatch not found)

- [ ] **Step 3: Implement `settleBatch` in Vision.sol**

Add after `forceWithdraw()`:

```solidity
/// @inheritdoc IVision
/// @dev Credits realBalance/virtualBalance directly (same pattern as withdraw()).
///      Players use existing withdrawBalance() or withdrawToSettlement() to extract funds.
///      No direct USDC transfer in loop — avoids DoS from reverting recipients.
///      No new pendingPayout mapping — reuses the dual-balance system.
function settleBatch(
    uint256 batchId,
    address[] calldata players,
    uint256[] calldata payouts,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external nonReentrant {
    Batch storage b = _batches[batchId];
    if (b.tickDuration == 0) revert BatchNotFound();
    if (b.paused) revert BatchAlreadySettled();
    if (players.length != payouts.length) revert InvalidArrayLength();
    if (players.length == 0) revert InvalidArrayLength();

    // Single BLS check for entire batch
    bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
    bytes32 message = keccak256(abi.encode(
        block.chainid,
        address(this),
        "SETTLE_BATCH",
        batchId,
        payoutsHash
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    // Two-pass: first validate solvency, then mutate state.
    // This avoids wasteful storage writes on revert paths.

    // Pass 1: accumulate totals, verify all players exist, enforce no duplicates
    uint256 totalPayouts;
    uint256 totalDeposits;
    for (uint256 i = 0; i < players.length; i++) {
        // Require strictly ascending addresses — prevents duplicate entries
        // which would inflate totalDeposits and bypass the solvency check.
        if (i > 0 && uint160(players[i]) <= uint160(players[i - 1])) revert InvalidArrayLength();
        PlayerPosition storage pos = _positions[batchId][players[i]];
        if (pos.stakePerTick == 0) revert NotJoined();
        totalPayouts += payouts[i];
        totalDeposits += pos.totalDeposited;
    }
    if (totalPayouts > totalDeposits) revert InsolventPayout();

    // Pass 2: settle each player — credit to realBalance/virtualBalance
    for (uint256 i = 0; i < players.length; i++) {
        PlayerPosition storage pos = _positions[batchId][players[i]];

        uint256 payout = payouts[i];
        uint256 profit = payout > pos.totalDeposited ? payout - pos.totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netPayout = payout - fee;

        // Read isVirtual BEFORE delete (SOL-2 pattern from existing withdraw)
        bool isVirtual = pos.isVirtual;

        // Delete position (CEI)
        delete _positions[batchId][players[i]];

        // Route fees and payout to correct balance bucket
        // (same pattern as forceWithdraw, lines 744-760 of Vision.sol)
        if (isVirtual) {
            accumulatedVirtualFees += fee;
            virtualBalance[players[i]] += netPayout;
            totalVirtualBalance += netPayout;
        } else {
            accumulatedRealFees += fee;
            realBalance[players[i]] += netPayout;
            totalRealBalance += netPayout;
        }

        emit PlayerSettled(batchId, players[i], netPayout, fee);
    }

    b.paused = true;
    emit BatchSettled(batchId, players.length);
}
```

This design:
- **Solvency**: two-pass — `sum(payouts) <= sum(deposits)` checked BEFORE any state mutation. Reverts cheaply on bad oracle data.
- **No DoS**: credits `realBalance`/`virtualBalance` (no external calls in loop). Players withdraw via existing `withdrawBalance()` or `withdrawToSettlement()`.
- **No ghost players**: reverts with `NotJoined` if any player was already `forceWithdraw`-ed. Oracle must exclude them.
- **isVirtual routing**: fees and payouts go to the correct accumulator, preserving dual-balance invariant.
- **No new storage**: reuses existing `realBalance`/`virtualBalance`/`totalRealBalance`/`totalVirtualBalance` — no new `pendingPayout` mapping.
- **No new functions**: players extract funds via existing `withdrawBalance(amount)` (for real) or `withdrawToSettlement(amount)` (for virtual). No `claimSettlement()` needed.

- [ ] **Step 4: Run tests**

Run: `cd contracts && forge test --match-contract VisionRoundTest -vvv`
Expected: PASS

- [ ] **Step 5: Run full contract suite**

Run: `cd contracts && forge test`
Expected: all pass

- [ ] **Step 6: Commit**

```
feat(contracts): add settleBatch for oracle-driven round settlement
```

---

## Phase 2: Oracle — Database + Lifecycle Manager

### Task 5: Database migration for round tables

**Files:**
- Create: `oracle/migrations/007_create_round_tables.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Round-based batch lifecycle tracking
CREATE TABLE IF NOT EXISTS vision_batch_lifecycle (
    batch_id            BIGINT PRIMARY KEY,
    source_id           TEXT NOT NULL,
    timeframe_secs      INTEGER NOT NULL,
    config_hash         TEXT NOT NULL,
    betting_start       TIMESTAMPTZ NOT NULL,
    betting_end         TIMESTAMPTZ NOT NULL,
    settlement_deadline TIMESTAMPTZ NOT NULL,
    settled_at          TIMESTAMPTZ,
    settle_tx_hash      TEXT,
    player_count        INTEGER DEFAULT 0,
    total_deposited     TEXT DEFAULT '0',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_source
    ON vision_batch_lifecycle(source_id, timeframe_secs);
CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_unsettled
    ON vision_batch_lifecycle(settled_at) WHERE settled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_betting
    ON vision_batch_lifecycle(betting_end) WHERE settled_at IS NULL;

-- Per-player results per round (populated at settlement)
CREATE TABLE IF NOT EXISTS vision_round_players (
    batch_id        BIGINT NOT NULL,
    player          TEXT NOT NULL,
    deposited       TEXT NOT NULL,
    payout          TEXT NOT NULL,
    pnl             TEXT NOT NULL,
    correct_count   INTEGER NOT NULL,
    total_markets   INTEGER NOT NULL,
    bitmap_hex      TEXT,
    settled_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (batch_id, player)
);

CREATE INDEX IF NOT EXISTS idx_round_players_player
    ON vision_round_players(player);
CREATE INDEX IF NOT EXISTS idx_round_players_settled
    ON vision_round_players(settled_at);
```

- [ ] **Step 2: Verify migration runs locally**

Run on VPS: `psql $DATABASE_URL -f oracle/migrations/007_create_round_tables.sql`
Expected: CREATE TABLE, CREATE INDEX (no errors)

- [ ] **Step 3: Commit**

```
feat(oracle): add round lifecycle and player result tables
```

---

### Task 6: Types — add round-related structs

**Files:**
- Modify: `oracle/src/vision/types.rs`

- [ ] **Step 1: Add RoundState enum and RoundResult struct**

At the end of `types.rs`:

```rust
/// Lifecycle state of a round-based batch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoundState {
    Betting,
    Locked,
    Settling,
    Settled,
}

/// Full settlement result for a round, ready for BLS signing and on-chain submission.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoundSettlement {
    pub batch_id: u64,
    pub players: Vec<Address>,
    pub payouts: Vec<U256>,
    /// Per-player: how many markets they predicted correctly
    pub correct_counts: Vec<u32>,
    pub total_markets: u32,
}
```

- [ ] **Step 2: Compile**

Run: `cd oracle && cargo check`
Expected: no errors

- [ ] **Step 3: Commit**

```
feat(oracle): add RoundState and RoundSettlement types
```

---

### Task 7: Settlement signer — compute + sign `SETTLE_BATCH` BLS hash

**Files:**
- Create: `oracle/src/vision/settle_signer.rs`

- [ ] **Step 1: Implement the settle hash computation**

```rust
//! BLS signing for settleBatch() — computes the same hash as Vision.sol.

use ethers::abi::{encode, Token};
use ethers::types::{Address, U256};
use ethers::utils::keccak256;

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::types::BLSSignature;

/// Compute the SETTLE_BATCH message hash matching Vision.sol:
///   keccak256(abi.encode(chainId, visionAddress, "SETTLE_BATCH", batchId, payoutsHash))
/// where payoutsHash = keccak256(abi.encode(players, payouts))
pub fn compute_settle_batch_hash(
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    players: &[Address],
    payouts: &[U256],
) -> [u8; 32] {
    // First: hash the players+payouts array (same as Solidity's abi.encode)
    let mut tokens = Vec::with_capacity(players.len() + payouts.len());
    let player_tokens: Vec<Token> = players.iter().map(|a| Token::Address(*a)).collect();
    let payout_tokens: Vec<Token> = payouts.iter().map(|p| Token::Uint(*p)).collect();
    let payouts_hash = keccak256(&encode(&[
        Token::Array(player_tokens),
        Token::Array(payout_tokens),
    ]));

    // Then: hash the full message
    keccak256(&encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("SETTLE_BATCH".to_string()),
        Token::Uint(U256::from(batch_id)),
        Token::FixedBytes(payouts_hash.to_vec()),
    ]))
}

/// Sign a settlement for a batch. Returns the BLS signature.
pub fn sign_settlement(
    keypair: &BLSKeyPair,
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    players: &[Address],
    payouts: &[U256],
) -> Result<BLSSignature, String> {
    let hash = compute_settle_batch_hash(chain_id, vision_address, batch_id, players, payouts);
    let signer = Bn254BLSSigner::new();
    signer.sign_message_hash(keypair, &hash).map_err(|e| format!("{e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settle_hash_deterministic() {
        let addr = "0x0000000000000000000000000000000000000001".parse().unwrap();
        let players = vec![addr];
        let payouts = vec![U256::from(1000u64)];

        let h1 = compute_settle_batch_hash(111222333, addr, 42, &players, &payouts);
        let h2 = compute_settle_batch_hash(111222333, addr, 42, &players, &payouts);
        assert_eq!(h1, h2);

        // Different batch_id = different hash
        let h3 = compute_settle_batch_hash(111222333, addr, 43, &players, &payouts);
        assert_ne!(h1, h3);
    }
}
```

- [ ] **Step 2: Register module in mod.rs**

In `oracle/src/vision/mod.rs`, add:
```rust
pub mod settle_signer;
```

- [ ] **Step 3: Compile + test**

Run: `cd oracle && cargo test vision::settle_signer`
Expected: PASS

- [ ] **Step 4: Commit**

```
feat(oracle): add BLS signing for settleBatch
```

---

### Task 8: Lifecycle manager — the heartbeat

**Files:**
- Create: `oracle/src/vision/lifecycle_manager.rs`

This is the core orchestrator. One async loop polls all (source, timeframe) pairs every 5 seconds. When a betting window expires, it creates the next batch and queues the expired one for settlement.

- [ ] **Step 1: Implement the lifecycle manager**

Architecture: avoid the borrow-checker violation of `&mut self.slots` + `&self` method calls. Extract all shared state (pool, keypair, etc.) into an `Arc<LifecycleShared>` struct. The `run()` loop only touches `slots: Vec<RoundSlot>` directly and passes the shared ref into free functions.

```rust
//! Round-based batch lifecycle manager.
//!
//! Single polling loop (5s interval) manages all (source, timeframe) pairs.
//! State machine per pair: Betting → Settling → Settled → (next Betting).
//!
//! Timing: uses on-chain block.timestamp (fetched via RPC) for tick alignment,
//! NOT wall-clock Utc::now(). This prevents drift between oracle and contract.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use ethers::prelude::*;
use ethers::types::{Address, U256};
use sqlx::PgPool;
use tracing::{info, warn, error};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::types::BLSSignature;
use super::resolver::TickResolver;
use super::settle_signer;
use super::types::{RoundState, RoundSettlement, PlayerBalance, MarketConfig};

const POLL_INTERVAL_SECS: u64 = 5;

/// Shared immutable state (wrapped in Arc, no borrow-checker issues).
struct Shared {
    pool: PgPool,
    chain_id: u64,
    vision_address: Address,
    data_node_url: String,
    bls_keypair: BLSKeyPair,
    node_index: usize,
    resolver: Arc<TickResolver>,
    http_client: reqwest::Client,
    /// Provider for reading on-chain block.timestamp
    provider: Provider<Http>,
}

/// Mutable per-slot state.
#[derive(Debug, Clone)]
struct RoundSlot {
    source_id: String,
    timeframe_secs: u64,
    lock_offset_secs: u64,
    betting_batch: Option<u64>,
    settling_batch: Option<u64>,
    /// On-chain timestamp when betting started (from block.timestamp, not wall clock)
    betting_start_chain_ts: Option<u64>,
}

pub struct LifecycleManager {
    shared: Arc<Shared>,
    slots: Vec<RoundSlot>,
}

impl LifecycleManager {
    pub fn new(
        pool: PgPool,
        chain_id: u64,
        vision_address: Address,
        data_node_url: String,
        bls_keypair: BLSKeyPair,
        node_index: usize,
        round_configs: Vec<(String, u64, u64)>,
        resolver: Arc<TickResolver>,
        provider: Provider<Http>,
    ) -> Self {
        let slots: Vec<RoundSlot> = round_configs.into_iter().map(|(src, tf, lo)| RoundSlot {
            source_id: src, timeframe_secs: tf, lock_offset_secs: lo,
            betting_batch: None, settling_batch: None, betting_start_chain_ts: None,
        }).collect();

        Self {
            shared: Arc::new(Shared {
                pool, chain_id, vision_address, data_node_url,
                bls_keypair, node_index, resolver,
                http_client: reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build().unwrap(),
                provider,
            }),
            slots,
        }
    }

    pub async fn run(&mut self) {
        info!("LifecycleManager started ({} slots)", self.slots.len());

        // Bootstrap: create first batch for each slot
        for slot in &mut self.slots {
            let shared = self.shared.clone();
            match create_batch(&shared, &slot.source_id, slot.timeframe_secs, slot.lock_offset_secs).await {
                Ok((batch_id, chain_ts)) => {
                    slot.betting_batch = Some(batch_id);
                    slot.betting_start_chain_ts = Some(chain_ts);
                    info!(source = %slot.source_id, batch_id, "Initial round created");
                }
                Err(e) => error!(source = %slot.source_id, error = %e, "Failed to create initial round"),
            }
        }

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

            // Read on-chain timestamp (prevents wall-clock drift)
            let chain_ts = match self.shared.provider.get_block(BlockNumber::Latest).await {
                Ok(Some(block)) => block.timestamp.as_u64(),
                _ => { warn!("Failed to fetch block timestamp"); continue; }
            };

            for slot in &mut self.slots {
                let shared = self.shared.clone();

                // 1. Check if betting window expired (using chain time, not wall clock)
                if let (Some(start_ts), Some(batch_id)) = (slot.betting_start_chain_ts, slot.betting_batch) {
                    if chain_ts >= start_ts + slot.timeframe_secs {
                        info!(source = %slot.source_id, batch_id, "Betting expired — rotating");

                        // Move to settling
                        slot.settling_batch = Some(batch_id);

                        // Create next batch
                        match create_batch(&shared, &slot.source_id, slot.timeframe_secs, slot.lock_offset_secs).await {
                            Ok((new_id, new_ts)) => {
                                slot.betting_batch = Some(new_id);
                                slot.betting_start_chain_ts = Some(new_ts);
                                info!(source = %slot.source_id, new_id, "New round created");
                            }
                            Err(e) => {
                                error!(source = %slot.source_id, error = %e, "Failed to create next round");
                                slot.betting_batch = None;
                                slot.betting_start_chain_ts = None;
                            }
                        }
                    }
                }

                // 2. Settle pending batch
                if let Some(settle_id) = slot.settling_batch {
                    match resolve_and_settle(&shared, settle_id, &slot.source_id).await {
                        Ok(()) => {
                            info!(source = %slot.source_id, settle_id, "Round settled");
                            slot.settling_batch = None;
                        }
                        Err(e) => warn!(source = %slot.source_id, settle_id, error = %e, "Settlement retry next poll"),
                    }
                }
            }
        }
    }
}

/// Create a new batch on-chain. Returns (batch_id, chain_timestamp).
/// Free function — no &self borrow issues.
async fn create_batch(
    s: &Shared,
    source_id: &str,
    timeframe_secs: u64,
    lock_offset_secs: u64,
) -> Result<(u64, u64), Box<dyn std::error::Error + Send + Sync>> {
    // 1. Fetch fresh config from data-node
    let url = format!("{}/batches/recommended", s.data_node_url);
    let resp: serde_json::Value = s.http_client.get(&url).send().await?.json().await?;
    let batches = resp["batches"].as_array().ok_or("no batches array")?;
    let config = batches.iter()
        .find(|b| b["sourceId"].as_str() == Some(source_id))
        .ok_or_else(|| format!("no config for {source_id}"))?;
    let config_hash_str = config["configHash"].as_str().unwrap_or("");
    let config_hash: [u8; 32] = hex::decode(config_hash_str.trim_start_matches("0x"))
        .map_err(|e| format!("bad config hash: {e}"))?
        .try_into()
        .map_err(|_| "config hash not 32 bytes")?;

    // 2. Compute sourceId hash (keccak256 of source string — matches contract)
    let source_id_hash = ethers::utils::keccak256(source_id.as_bytes());

    // 3. BLS-sign createBatch message (same domain as engine.rs)
    let message = ethers::utils::keccak256(&ethers::abi::encode(&[
        ethers::abi::Token::Uint(U256::from(s.chain_id)),
        ethers::abi::Token::Address(s.vision_address),
        ethers::abi::Token::String("CREATE_BATCH".to_string()),
        ethers::abi::Token::FixedBytes(source_id_hash.to_vec()),
        ethers::abi::Token::FixedBytes(config_hash.to_vec()),
        ethers::abi::Token::Uint(U256::from(timeframe_secs)),
        ethers::abi::Token::Uint(U256::from(lock_offset_secs)),
    ]));
    let signer = Bn254BLSSigner::new();
    let sig = signer.sign_message_hash(&s.bls_keypair, &message)
        .map_err(|e| format!("BLS sign: {e}"))?;
    let signer_bitmap = U256::one() << s.node_index;

    // 4. Submit createBatch tx on-chain
    //    Uses ethers ContractCall (same pattern as engine.rs batch creation).
    //    The tx receipt contains BatchCreated event with the new batchId.
    //    For now, read nextBatchId before the tx as a prediction.
    //    (Production: parse event logs from receipt.)

    // TODO: actual ethers contract call — pattern:
    //   let vision = Vision::new(s.vision_address, Arc::new(s.provider.clone()));
    //   let tx = vision.create_batch(source_id_hash, config_hash, timeframe_secs, lock_offset_secs, sig.0, nonce, signer_bitmap);
    //   let receipt = tx.send().await?.await?;
    //   let batch_id = parse_batch_created_event(receipt);

    let batch_id = 0u64; // placeholder — replace with actual event parsing

    // 5. Get chain timestamp for drift-free timing
    let block = s.provider.get_block(BlockNumber::Latest).await?
        .ok_or("no latest block")?;
    let chain_ts = block.timestamp.as_u64();

    // 6. Record in lifecycle table
    let betting_end = chrono::DateTime::from_timestamp(chain_ts as i64 + timeframe_secs as i64, 0)
        .unwrap_or_else(Utc::now);
    let settlement_deadline = chrono::DateTime::from_timestamp(chain_ts as i64 + timeframe_secs as i64 * 3, 0)
        .unwrap_or_else(Utc::now);

    sqlx::query(
        "INSERT INTO vision_batch_lifecycle
         (batch_id, source_id, timeframe_secs, config_hash, betting_start, betting_end, settlement_deadline)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)"
    )
    .bind(batch_id as i64)
    .bind(source_id)
    .bind(timeframe_secs as i32)
    .bind(config_hash_str)
    .bind(betting_end)
    .bind(settlement_deadline)
    .execute(&s.pool)
    .await?;

    Ok((batch_id, chain_ts))
}

/// Resolve a batch's markets and submit settleBatch on-chain.
async fn resolve_and_settle(
    s: &Shared,
    batch_id: u64,
    source_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // 1. Fetch batch config (market list) from data-node by config_hash
    let config_hash: String = sqlx::query_scalar(
        "SELECT config_hash FROM vision_batch_lifecycle WHERE batch_id = $1"
    ).bind(batch_id as i64).fetch_one(&s.pool).await?;

    let config_url = format!("{}/batches/config/{}", s.data_node_url, config_hash);
    let config_resp: serde_json::Value = s.http_client.get(&config_url).send().await?.json().await?;
    let markets_json = config_resp["markets"].as_array().ok_or("no markets")?;
    let market_configs: Vec<MarketConfig> = markets_json.iter().filter_map(|m| {
        Some(MarketConfig {
            asset_id: m["assetId"].as_str()?.to_string(),
            market_id: ethers::types::H256::from(ethers::utils::keccak256(m["assetId"].as_str()?.as_bytes())),
            resolution_type: parse_resolution_type(m["resolutionType"].as_str().unwrap_or("up_x")),
            threshold_bps: m["thresholdBps"].as_u64().unwrap_or(30) as u32,
        })
    }).collect();

    // 2. Fetch price snapshot from data-node (latest prices at resolution time)
    let snap_url = format!("{}/vision/snapshot?source={}", s.data_node_url, source_id);
    let snap: serde_json::Value = s.http_client.get(&snap_url).send().await?.json().await?;

    // 3. Fetch players from scheduler (in-memory batch state)
    let batch_state = sqlx::query_as::<_, (String, String)>(
        "SELECT player, balance::text FROM vision_positions WHERE batch_id = $1 AND balance > 0"
    ).bind(batch_id as i64).fetch_all(&s.pool).await?;

    if batch_state.is_empty() {
        info!(batch_id, "No players in batch — marking settled");
        sqlx::query("UPDATE vision_batch_lifecycle SET settled_at = NOW() WHERE batch_id = $1")
            .bind(batch_id as i64).execute(&s.pool).await?;
        return Ok(());
    }

    // 4. Run resolver — reuses existing TickResolver::resolve_tick()
    //    The resolver computes PlayerBalance { player, old_balance, new_balance }
    //    for each player based on bitmap matching + parimutuel distribution.
    //    (This is the same logic used by the infinite-tick engine.)

    // 5. Collect players and payouts from resolution result
    let mut players: Vec<Address> = Vec::new();
    let mut payouts: Vec<U256> = Vec::new();
    let mut correct_counts: Vec<u32> = Vec::new();

    // ... resolver.resolve_tick() populates player_balances
    // For each pb in player_balances:
    //   players.push(pb.player);
    //   payouts.push(pb.new_balance);
    //   correct_counts.push(pb.correct_count);

    // 6. BLS-sign the settlement
    let sig = settle_signer::sign_settlement(
        &s.bls_keypair, s.chain_id, s.vision_address,
        batch_id, &players, &payouts,
    )?;
    let signer_bitmap = U256::one() << s.node_index;

    // 7. Broadcast settlement proof to peers via P2P
    //    (Same pattern as VisionBalanceProofsBatch — peers co-sign, aggregate)
    //    Requires VisionSettlementProof variant in P2PMessage enum.
    //    After aggregation, leader submits settleBatch tx on-chain.

    // 8. Submit settleBatch on-chain (after BLS aggregation)
    //    TODO: ethers contract call — settleBatch(batchId, players, payouts, aggSig, nonce, bitmap)

    // 9. Record settlement in lifecycle table
    sqlx::query("UPDATE vision_batch_lifecycle SET settled_at = NOW(), player_count = $1 WHERE batch_id = $2")
        .bind(players.len() as i32)
        .bind(batch_id as i64)
        .execute(&s.pool).await?;

    // 10. Persist per-player results
    for (i, player) in players.iter().enumerate() {
        let deposited = batch_state.iter()
            .find(|(p, _)| p.to_lowercase() == format!("{:?}", player).to_lowercase())
            .map(|(_, b)| b.clone())
            .unwrap_or_else(|| "0".to_string());
        let payout_str = payouts[i].to_string();
        let pnl: i128 = payouts[i].as_u128() as i128 - deposited.parse::<i128>().unwrap_or(0);

        sqlx::query(
            "INSERT INTO vision_round_players (batch_id, player, deposited, payout, pnl, correct_count, total_markets, settled_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .bind(&deposited)
        .bind(&payout_str)
        .bind(pnl.to_string())
        .bind(correct_counts.get(i).copied().unwrap_or(0) as i32)
        .bind(market_configs.len() as i32)
        .execute(&s.pool).await?;
    }

    Ok(())
}

fn parse_resolution_type(s: &str) -> u8 {
    match s {
        "up_0" => 0, "up_30" => 1, "up_x" => 2,
        "down_0" => 3, "down_30" => 4, "down_x" => 5,
        "flat_0" => 6, "flat_x" => 7,
        "up_300" => 8, "up_3000" => 9,
        "down_300" => 10, "down_3000" => 11,
        "flat_300" => 12, "flat_3000" => 13,
        _ => 2, // default to up_x
    }
}
```

**Remaining integration TODOs** (clearly marked in code, each is ~30-50 lines):
1. `create_batch`: Wire ethers `ContractCall` for `Vision.createBatch()` — reuse the existing `ContractCaller` pattern from `engine.rs`. Parse `BatchCreated` event from receipt for actual `batchId`.
2. `resolve_and_settle` step 4-5: Call `resolver.resolve_tick()` with the fetched players, bitmaps, prices, and market configs. Map `TickResult.player_balances` to the `players`/`payouts` vectors.

- [ ] **Step 2: Add `VisionSettlementProof` P2P message variant**

In `oracle/src/consensus/messages.rs`, add to the `P2PMessage` enum (next to `VisionBalanceProofsBatch`):

```rust
VisionSettlementProof {
    batch_id: u64,
    players: Vec<Address>,
    payouts: Vec<U256>,
    bls_sig: Vec<u8>,
    signer_index: usize,
},
```

In `protocol.rs`, add a handler that forwards to the lifecycle manager's aggregation channel (same pattern as the existing `ProcessVisionBalanceProofsBatch` handler at line 3057).

In `equivocation.rs`, add the hashing pattern for the new variant (next to `VisionBalanceProofsBatch` at line 1115).

- [ ] **Step 2: Register in mod.rs**

```rust
pub mod lifecycle_manager;
```

- [ ] **Step 3: Compile**

Run: `cd oracle && cargo check`
Expected: compiles (todo! macros will panic at runtime but compile fine)

- [ ] **Step 4: Commit**

```
feat(oracle): add round-based batch lifecycle manager
```

---

### Task 9: Spawn lifecycle manager in engine

**Files:**
- Modify: `oracle/src/vision/engine.rs`
- Modify: `oracle/src/main.rs`

- [ ] **Step 1: Add lifecycle manager spawn in engine or main.rs**

In `main.rs`, after the existing `BatchConfigOrchestrator` spawn (~line 4925), add:

```rust
// Spawn round-based lifecycle manager
if config.vision.round_based_enabled {
    let lm_pool = pool.clone();
    let lm_chain_id = config.vision.chain_id;
    let lm_vision_addr: Address = config.vision.vision_address.parse().expect("invalid vision address");
    let lm_dn_url = config.vision.data_node_url.clone();
    let lm_keypair = bls_keypair.clone().expect("BLS keypair required for round mode");
    let lm_node_index = config.vision.node_index as usize;
    let lm_resolver = resolver.clone();
    // L3 RPC URL lives in components.chain, not config.vision
    let lm_provider = Provider::<Http>::try_from(&components.chain.rpc_url).expect("invalid L3 RPC");

    // Build round configs from BATCH_SOURCES (same list as data-node batch_engine)
    let round_configs: Vec<(String, u64, u64)> = config.vision.round_sources.iter()
        .map(|rs| (rs.source_id.clone(), rs.timeframe_secs, rs.lock_offset_secs))
        .collect();

    tokio::spawn(async move {
        let mut manager = LifecycleManager::new(
            lm_pool, lm_chain_id, lm_vision_addr, lm_dn_url,
            (*lm_keypair).clone(), lm_node_index, round_configs,
            lm_resolver, lm_provider,
        );
        manager.run().await;
    });
}
```

- [ ] **Step 2: Add config fields**

In `oracle/src/vision/config.rs`, add:
```rust
/// Round-based lifecycle management
#[serde(default)]
pub round_based_enabled: bool,

/// (source_id, timeframe_secs, lock_offset_secs) tuples for round-based sources
#[serde(default)]
pub round_sources: Vec<RoundSourceConfig>,

#[derive(Debug, Clone, Deserialize)]
pub struct RoundSourceConfig {
    pub source_id: String,
    pub timeframe_secs: u64,
    pub lock_offset_secs: u64,
}
```
Default to `round_based_enabled = false`, `round_sources = []` for safe rollout.

Example TOML:
```toml
[vision]
round_based_enabled = true

[[vision.round_sources]]
source_id = "crypto"
timeframe_secs = 300
lock_offset_secs = 45

[[vision.round_sources]]
source_id = "weather"
timeframe_secs = 3600
lock_offset_secs = 300
```

- [ ] **Step 3: Compile**

Run: `cd oracle && cargo check`
Expected: no errors

- [ ] **Step 4: Commit**

```
feat(oracle): spawn lifecycle manager when round_based_enabled
```

---

## Phase 3: Oracle — API Endpoints

### Task 10: Round API endpoints

**Files:**
- Create: `oracle/src/vision/round_api.rs`
- Modify: `oracle/src/vision/api.rs` (mount routes)

- [ ] **Step 1: Implement round query endpoints**

```rust
//! Round-based Vision API endpoints.

use axum::{extract::{Path, Query, State}, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::api::VisionState;

#[derive(Deserialize)]
pub struct RoundsQuery {
    pub source: Option<String>,
    pub timeframe: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundSummary {
    pub batch_id: i64,
    pub source_id: String,
    pub timeframe_secs: i32,
    pub config_hash: String,
    pub status: String,            // "betting", "locked", "settling", "settled"
    pub betting_start: String,
    pub betting_end: String,
    pub settled_at: Option<String>,
    pub player_count: i32,
    pub total_deposited: String,
}

/// GET /vision/rounds?source=X&timeframe=Y&limit=N
pub async fn list_rounds(
    State(state): State<Arc<VisionState>>,
    Query(params): Query<RoundsQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(50).min(200);
    // Include lock_offset for "locked" status derivation
    let rows: Vec<(i64, String, i32, String, String, String, Option<String>, i32, String, i32)> =
        sqlx::query_as(
            "SELECT l.batch_id, l.source_id, l.timeframe_secs, l.config_hash,
                    l.betting_start::text, l.betting_end::text, l.settled_at::text,
                    l.player_count, l.total_deposited,
                    COALESCE((l.timeframe_secs * 25 / 100), 45)::integer as lock_offset_secs
             FROM vision_batch_lifecycle l
             WHERE ($1::TEXT IS NULL OR l.source_id = $1)
               AND ($2::INTEGER IS NULL OR l.timeframe_secs = $2)
             ORDER BY l.batch_id DESC
             LIMIT $3"
        )
        .bind(params.source.as_deref())
        .bind(params.timeframe)
        .bind(limit)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let rounds: Vec<RoundSummary> = rows.into_iter().map(|r| {
        let now_str = chrono::Utc::now().to_rfc3339();
        let lock_offset = r.9; // seconds before betting_end when lock kicks in
        // Compute lock_start from betting_end - lock_offset (approximate via string comparison)
        let status = if r.6.is_some() { "settled" }
            else if now_str > r.5 { "settling" }
            // TODO: proper locked detection requires parsing betting_end as DateTime
            // and checking now > betting_end - lock_offset. For now, approximate:
            else { "betting" };
        RoundSummary {
            batch_id: r.0, source_id: r.1, timeframe_secs: r.2,
            config_hash: r.3, status: status.to_string(),
            betting_start: r.4, betting_end: r.5,
            settled_at: r.6, player_count: r.7, total_deposited: r.8,
        }
    }).collect();

    Json(serde_json::json!({ "rounds": rounds }))
}

/// GET /vision/rounds/active — currently in betting phase
pub async fn active_rounds(
    State(state): State<Arc<VisionState>>,
    Query(params): Query<RoundsQuery>,
) -> impl IntoResponse {
    let rows: Vec<(i64, String, i32, String, String, i32)> = sqlx::query_as(
        "SELECT batch_id, source_id, timeframe_secs, config_hash,
                betting_end::text, player_count
         FROM vision_batch_lifecycle
         WHERE settled_at IS NULL AND betting_end > NOW()
           AND ($1::TEXT IS NULL OR source_id = $1)
           AND ($2::INTEGER IS NULL OR timeframe_secs = $2)
         ORDER BY source_id, timeframe_secs"
    )
    .bind(params.source.as_deref())
    .bind(params.timeframe)
    .fetch_all(&state.pool).await.unwrap_or_default();

    let rounds: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        serde_json::json!({
            "batchId": r.0, "sourceId": r.1, "timeframeSecs": r.2,
            "configHash": r.3, "bettingEnd": r.4, "playerCount": r.5,
            "status": "betting",
        })
    }).collect();

    Json(serde_json::json!({ "rounds": rounds }))
}

/// GET /vision/rounds/settling — betting ended, not yet settled
pub async fn settling_rounds(State(state): State<Arc<VisionState>>) -> impl IntoResponse {
    let rows: Vec<(i64, String, i32, String, i32)> = sqlx::query_as(
        "SELECT batch_id, source_id, timeframe_secs, betting_end::text, player_count
         FROM vision_batch_lifecycle
         WHERE settled_at IS NULL AND betting_end <= NOW()
         ORDER BY betting_end DESC"
    )
    .fetch_all(&state.pool).await.unwrap_or_default();

    let rounds: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        serde_json::json!({
            "batchId": r.0, "sourceId": r.1, "timeframeSecs": r.2,
            "bettingEnd": r.3, "playerCount": r.4, "status": "settling",
        })
    }).collect();

    Json(serde_json::json!({ "rounds": rounds }))
}

/// GET /vision/rounds/:batchId/bitmaps
pub async fn round_bitmaps(
    State(state): State<Arc<VisionState>>,
    Path(batch_id): Path<u64>,
) -> impl IntoResponse {
    // 1. Check reveal window has passed
    let lifecycle = sqlx::query_as::<_, (String,)>(
        "SELECT betting_end::text FROM vision_batch_lifecycle WHERE batch_id = $1"
    ).bind(batch_id as i64).fetch_optional(&state.pool).await;

    let betting_end = match lifecycle {
        Ok(Some((end,))) => end,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "batch not found"}))).into_response(),
    };

    // 2. Fetch bitmaps from bitmap_store via the existing reveal endpoint pattern.
    //    The bitmap_store has get_active_bitmaps(batch_id) which returns Vec<SlottedBitmap>.
    //    Reuse the same pattern as the existing GET /vision/reveal/:batch_id/:tick_id handler.
    let bitmaps = state.bitmap_store.get_all_active_for_batch(batch_id).await;

    // 3. Fetch config to get market names — query data-node by config_hash
    //    (Same pattern as engine.rs config_cache.get_or_fetch)
    let config_hash: Option<String> = sqlx::query_scalar(
        "SELECT config_hash FROM vision_batch_lifecycle WHERE batch_id = $1"
    ).bind(batch_id as i64).fetch_optional(&state.pool).await.ok().flatten();

    let market_names: Vec<String> = if let Some(hash) = config_hash {
        // Fetch from data-node /batches/config/{hash}
        match reqwest::get(&format!("{}/batches/config/{}", state.config.data_node_url, hash)).await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<serde_json::Value>().await.ok()
                    .and_then(|v| v["markets"].as_array().map(|arr|
                        arr.iter().filter_map(|m| m["assetId"].as_str().map(String::from)).collect()
                    ))
                    .unwrap_or_default()
            }
            _ => vec![],
        }
    } else { vec![] };

    // 4. Decode each bitmap to bool array
    let players: Vec<serde_json::Value> = bitmaps.iter().map(|bm| {
        let predictions: Vec<bool> = (0..market_names.len())
            .map(|i| {
                let byte_idx = i / 8;
                let bit_idx = 7 - (i % 8);
                bm.bitmap.get(byte_idx).map(|b| (b >> bit_idx) & 1 == 1).unwrap_or(false)
            })
            .collect();
        serde_json::json!({
            "player": format!("{:?}", bm.player),
            "predictions": predictions,
        })
    }).collect();

    Json(serde_json::json!({
        "batchId": batch_id,
        "markets": market_names,
        "players": players,
    })).into_response()
}

/// GET /vision/rounds/:batchId/results
pub async fn round_results(
    State(state): State<Arc<VisionState>>,
    Path(batch_id): Path<u64>,
) -> impl IntoResponse {
    let rows: Vec<(String, String, String, String, i32, i32, Option<String>)> = sqlx::query_as(
        "SELECT player, deposited, payout, pnl, correct_count, total_markets, bitmap_hex
         FROM vision_round_players WHERE batch_id = $1"
    )
    .bind(batch_id as i64)
    .fetch_all(&state.pool).await.unwrap_or_default();

    let players: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        serde_json::json!({
            "player": r.0, "deposited": r.1, "payout": r.2, "pnl": r.3,
            "correctCount": r.4, "totalMarkets": r.5, "bitmapHex": r.6,
        })
    }).collect();

    Json(serde_json::json!({ "batchId": batch_id, "players": players }))
}

/// GET /vision/player/:address/rounds
pub async fn player_rounds(
    State(state): State<Arc<VisionState>>,
    Path(address): Path<String>,
    Query(params): Query<RoundsQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(20).min(100);
    let rows: Vec<(i64, String, String, String, i32, i32)> = sqlx::query_as(
        "SELECT rp.batch_id, rp.deposited, rp.payout, rp.pnl, rp.correct_count, rp.total_markets
         FROM vision_round_players rp
         WHERE LOWER(rp.player) = LOWER($1)
         ORDER BY rp.batch_id DESC
         LIMIT $2"
    )
    .bind(&address)
    .bind(limit)
    .fetch_all(&state.pool).await.unwrap_or_default();

    let rounds: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        serde_json::json!({
            "batchId": r.0, "deposited": r.1, "payout": r.2,
            "pnl": r.3, "correctCount": r.4, "totalMarkets": r.5,
        })
    }).collect();

    Json(serde_json::json!({ "rounds": rounds }))
}

/// Build axum Router for all /vision/rounds/* endpoints.
pub fn routes(state: Arc<VisionState>) -> axum::Router {
    use axum::routing::get;
    axum::Router::new()
        .route("/", get(list_rounds))
        .route("/active", get(active_rounds))
        .route("/settling", get(settling_rounds))
        .route("/:batchId/bitmaps", get(round_bitmaps))
        .route("/:batchId/results", get(round_results))
        .with_state(state)
}
```

- [ ] **Step 2: Mount routes in api.rs**

In the `routes()` function of `api.rs`, add:
```rust
.nest("/vision/rounds", round_api::routes(state.clone()))
.route("/vision/player/:address/rounds", get(round_api::player_rounds))
```

- [ ] **Step 3: Compile**

Run: `cd oracle && cargo check`
Expected: no errors

- [ ] **Step 4: Commit**

```
feat(oracle): add round API endpoints for bitmaps, results, and history
```

---

## Phase 4: Bot

### Task 11: Bot — add `joinBatchDirect` ABI and round-based tracking

**Files:**
- Modify: `vision-bot/framework/chain.py`
- Modify: `vision-bot/framework/tracker.py`
- Modify: `vision-bot/bot.py`
- Modify: `vision-bot/tests/test_tracker.py`

- [ ] **Step 1: Add `joinBatchDirect` ABI to chain.py**

Add to `VISION_ABI` list:
```python
{
    "name": "joinBatchDirect",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
        {"name": "batchId", "type": "uint256"},
        {"name": "configHash", "type": "bytes32"},
        {"name": "depositAmount", "type": "uint256"},
        {"name": "stakePerTick", "type": "uint256"},
        {"name": "bitmapHash", "type": "bytes32"},
    ],
    "outputs": [],
},
```

Add `Executor.join_batch_direct()` method:
```python
def join_batch_direct(self, batch_id, config_hash, deposit, stake, bitmap_hash):
    """Join a round-based batch with direct USDC transfer."""
    tx = self.vision.functions.joinBatchDirect(
        batch_id, config_hash, deposit, stake, bitmap_hash
    ).build_transaction(self._build_tx(gas=500_000))
    tx_hash = self._sign_and_send(tx)
    logger.info("Joined round %d direct (tx: %s)", batch_id, tx_hash.hex()[:16])
```

- [ ] **Step 2: Add `check_rounds()` to tracker.py**

```python
def check_rounds(self):
    """Round-based mode: join current betting batch for each subscription."""
    urls = self._oracle_urls_fn()
    if not urls:
        return
    for source, timeframe in self._config.get("round_subscriptions", []):
        try:
            resp = requests.get(
                f"{urls[0]}/vision/rounds/active",
                params={"source": source, "timeframe": timeframe},
                timeout=10,
            )
            if not resp.ok:
                continue
            batches = resp.json().get("rounds", [])
            for batch in batches:
                bid = batch["batchId"]
                if bid in self.active_ids:
                    continue
                self._join_round(batch)
        except Exception as e:
            log.warning("Round check failed for %s/%d: %s", source, timeframe, e)
```

- [ ] **Step 3: Add `_join_round` glue method to tracker.py**

```python
def _join_round(self, batch: dict):
    """Join a round-based batch: approve USDC, call joinBatchDirect, submit bitmap."""
    batch_id = batch["batchId"]
    config_hash = batch.get("configHash", b"\x00" * 32)
    deposit = self._config.get("deposit", 10) * 10**18
    stake = self._config.get("stake", 1) * 10**18

    # Generate predictions
    from framework.core import encode_bitmap, hash_bitmap
    market_count = batch.get("marketCount", 10)
    # Use the strategy to predict (or random fallback)
    bets = ["UP"] * market_count  # placeholder — real impl calls strategy.predict()
    bitmap = encode_bitmap(bets, market_count)
    bitmap_hash = hash_bitmap(bitmap)

    # On-chain: approve + join
    self._executor.approve_usdc(deposit)
    if isinstance(config_hash, str):
        config_hash = bytes.fromhex(config_hash.replace("0x", ""))
    self._executor.join_batch_direct(batch_id, config_hash, deposit, stake, bitmap_hash)

    # Submit bitmap to oracles
    from framework.chain import submit_bitmap
    urls = self._oracle_urls_fn()
    submit_bitmap(urls, self._executor.bot_addr, batch_id, bitmap, bitmap_hash)

    # Track
    self.on_join(batch_id, deposit, bitmap, bets)
    log.info("Joined round %d (%d markets)", batch_id, market_count)
```

- [ ] **Step 4: Add round mode to bot.py**

In `run_cycle()`, add after existing logic:
```python
if cfg.get("round_based", False):
    tracker.check_rounds()
```

- [ ] **Step 5: Write test**

```python
def test_check_rounds_joins_new_batch():
    tracker, executor, _ = make_tracker({
        "round_subscriptions": [("crypto", 300)],
        "deposit": 10,
        "stake": 1,
    })
    # Mock oracle returning active round
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {
        "rounds": [{"batchId": 99, "configHash": "0x" + "ab" * 32, "marketCount": 14}]
    }
    with patch("framework.tracker.requests.get", return_value=mock_resp), \
         patch("framework.tracker.submit_bitmap"):
        tracker.check_rounds()

    executor.approve_usdc.assert_called_once()
    executor.join_batch_direct.assert_called_once()
    assert 99 in tracker.active_ids
```

- [ ] **Step 5: Run tests**

Run: `cd vision-bot && .venv/bin/python -m pytest tests/test_tracker.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```
feat(bot): add round-based batch tracking and joinBatchDirect
```

---

## Phase 5: Frontend

### Task 12: ABI updates

**Files:**
- Modify: `frontend/lib/contracts/vision-abi.ts`

- [ ] **Step 1: Add `joinBatchDirect` and `settleBatch` to vision ABI**

Add the function signatures matching the contract. Include `PlayerSettled` and `BatchSettled` events.

- [ ] **Step 2: Commit**

```
feat(frontend): add round-based ABI entries
```

---

### Task 13: Hooks — useRounds, useJoinRound, useRoundResults

**Files:**
- Create: `frontend/hooks/vision/useRounds.ts`
- Create: `frontend/hooks/vision/useJoinRound.ts`
- Create: `frontend/hooks/vision/useRoundResults.ts`

- [ ] **Step 1: useRounds — fetch and poll rounds by source/timeframe**

SWR hook that queries `/api/vision/rounds?source=X&timeframe=Y`, refreshes every 5s during betting, every 10s during settlement.

- [ ] **Step 2: useJoinRound — approve + joinBatchDirect**

Wagmi hook: checks allowance → approve if needed → `joinBatchDirect(batchId, configHash, deposit, stake, bitmapHash)`. Reports steps: `idle → approving → joining → done`.

- [ ] **Step 3: useRoundResults — fetch bitmaps + outcomes**

SWR hook that queries `/api/vision/rounds/:batchId/results`. Returns markets, player predictions (true/false), correctness, PnL.

- [ ] **Step 4: Commit**

```
feat(frontend): add round hooks (useRounds, useJoinRound, useRoundResults)
```

---

### Task 14: Components — RoundCard, RoundList, RoundDetail

**Files:**
- Create: `frontend/components/domain/vision/RoundCard.tsx`
- Create: `frontend/components/domain/vision/RoundList.tsx`
- Create: `frontend/components/domain/vision/RoundDetail.tsx`

- [ ] **Step 1: RoundCard — single round with status, countdown, player count**

Shows: source name, timeframe, status badge (Betting/Locked/Settling/Settled), countdown timer, player count, market count.

- [ ] **Step 2: RoundList — grouped by source + timeframe**

Fetches rounds via `useRounds`. Groups by source. For each source, shows one card per active timeframe. Historical rounds in a collapsible section.

- [ ] **Step 3: RoundDetail — bitmap grid + outcomes**

Full transparency view: market names, outcomes (UP/DOWN/FLAT), each player's predictions as checkmarks/crosses, PnL. Uses `useRoundResults`.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```
feat(frontend): add round-based Vision components
```

---

### Task 15: API proxy routes

**Files:**
- Create: `frontend/app/api/vision/rounds/route.ts`
- Create: `frontend/app/api/vision/rounds/[batchId]/results/route.ts`
- Create: `frontend/app/api/vision/rounds/[batchId]/bitmaps/route.ts`
- Create: `frontend/app/api/vision/player/[address]/rounds/route.ts`

- [ ] **Step 1: Proxy `/api/vision/rounds` to oracle**

```typescript
import { ORACLE_VISION_URL } from '@/lib/config'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams(searchParams)
  const res = await fetch(`${ORACLE_VISION_URL}/vision/rounds?${params}`, {
    next: { revalidate: 5 },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return Response.json({ rounds: [] }, { status: 502 })
  return Response.json(await res.json())
}
```

- [ ] **Step 2: Proxy `/api/vision/rounds/:batchId/results` to oracle**

```typescript
import { ORACLE_VISION_URL } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params
  const res = await fetch(`${ORACLE_VISION_URL}/vision/rounds/${batchId}/results`, {
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return Response.json({ players: [] }, { status: 502 })
  return Response.json(await res.json())
}
```

- [ ] **Step 3: Proxy `/api/vision/rounds/:batchId/bitmaps` to oracle**

Same pattern as results, path = `/vision/rounds/${batchId}/bitmaps`.

- [ ] **Step 4: Proxy `/api/vision/player/:address/rounds` to oracle**

```typescript
import { ORACLE_VISION_URL } from '@/lib/config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams(searchParams)
  const res = await fetch(`${ORACLE_VISION_URL}/vision/player/${address}/rounds?${qs}`, {
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return Response.json({ rounds: [] }, { status: 502 })
  return Response.json(await res.json())
}
```

- [ ] **Step 5: Commit**

```
feat(frontend): add round API proxy routes (rounds, results, bitmaps, player history)
```

---

## Phase 6: Deploy + Integration

### Task 16: Deploy contract

- [ ] **Step 1: Deploy updated Vision.sol to L3**

Follow existing deploy script pattern. The new functions are additive — existing batches unaffected.

- [ ] **Step 2: Verify `joinBatchDirect` and `settleBatch` callable**

Cast call with test data to verify ABI matches.

- [ ] **Step 3: Update deployment JSON**

Sync deployment addresses if contract address changed.

- [ ] **Step 4: Commit**

```
chore: deploy Vision v2 with round-based functions
```

---

### Task 17: Deploy oracle + run migration

- [ ] **Step 1: Run migration on VPS Postgres**

```bash
ssh index-maker/prod/postgres
psql $DATABASE_URL -f oracle/migrations/007_create_round_tables.sql
```

- [ ] **Step 2: Rebuild and restart oracle**

```bash
ssh index-maker/prod/be
cd /home/max/index && git pull
cargo build --release -p oracle
docker compose -f docker/testnet/oracle/docker-compose.yml restart
```

- [ ] **Step 3: Verify lifecycle manager starts**

```bash
docker logs oracle-1 --tail 50 | grep -i "lifecycle\|round"
```

- [ ] **Step 4: Test round API endpoints**

```bash
curl http://oracle:8080/vision/rounds/active
```

---

### Task 18: Deploy frontend

- [ ] **Step 1: Push frontend changes**

```bash
git push mono main
```

- [ ] **Step 2: Deploy to Vercel**

```bash
cd frontend && vercel --prod
```

- [ ] **Step 3: Verify round UI loads**

Navigate to Vision page, confirm rounds grouped by source appear.

---

## Dependency Graph

```
Task 1 (IVision interface)
  → Task 2 (source uniqueness + MAX_BATCHES)
    → Task 3 (joinBatchDirect)
    → Task 4 (settleBatch)
      → Task 5 (DB migration)        [can start after Task 4]
        → Task 6 (types)
          → Task 7 (settle signer)
            → Task 8 (lifecycle manager + P2P variant)
              → Task 9 (spawn in engine + config)
                → Task 10 (round API)
                  → Task 15 (frontend proxy)  ──┐
      → Task 11 (bot)                [parallel] │
  → Task 12 (ABI)                    [after 1]  │
      ↓                                         │
      Task 13 (hooks)  ←────────────────────────┘  [needs both 12 + 15]
        → Task 14 (components)
  → Task 16 (deploy contract)        [after Tasks 1-4]
    → Task 17 (deploy oracle)        [after Tasks 5-10]
      → Task 18 (deploy frontend)    [after Tasks 12-15]
```

**Parallelizable groups:**
- Tasks 3 + 4 (both depend on Task 2, independent of each other)
- Task 12 (ABI) can start after Task 1 (interface) — no dependency on oracle
- Tasks 5-10 (oracle) + Task 11 (bot) — can run in parallel after Task 4
- Tasks 13-14 (frontend hooks/components) — depend on Task 12 (ABI) AND Task 15 (proxy routes)
- Task 15 (proxy routes) depends on Task 10 (oracle API)

**Maximum parallelism (4 agents):**
- Agent A: Tasks 1 → 2 → 3 → 4 (contract)
- Agent B: Tasks 5 → 6 → 7 → 8 → 9 → 10 (oracle, starts after Task 4)
- Agent C: Task 11 (bot, starts after Task 4)
- Agent D: Task 12 → 15 → 13 → 14 (frontend, Task 12 starts after Task 1, Task 15 waits for Task 10)
