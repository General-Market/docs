# Round-Based Vision — Clean Implementation (No Backward Compatibility)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent-batch Vision model with ephemeral round-based batches. Each round: fresh config → betting window → settlement → USDC returned. No tick engine, no dual-balance, no manual withdraw. Full infra restart acceptable.

**Architecture:** The `BatchLifecycleManager` is the ONLY tick engine. Every `tickDuration` seconds per source: create batch on-chain (fresh config from data-node), resolve the previous batch, settle it via `settleBatch`. Players use `joinBatchDirect` (direct USDC transfer). Settlement credits Vision balance; players withdraw or auto-join next round from balance. All existing batches are wiped at deploy.

**Tech Stack:** Rust (oracle), TypeScript/React (frontend), Python (bot). ethers-rs, sqlx, BLS consensus via existing infrastructure.

**Spec:** `docs/plans/2026-03-17-vision-round-based-batches.md`

**Key simplification:** No backward compatibility. The old tick engine (`engine.rs` run loop), `claimRewards`, per-tick balance tracking — all dead code. The lifecycle manager replaces everything.

**USDC flow:**
1. Player joins round via `joinBatchDirect` (USDC transferred from wallet to batch position)
2. Oracle auto-settles via `settleBatch` → credits `realBalance` (not wallet)
3. Player's Vision balance accumulates across all settled rounds from all sources
4. Player clicks ONE "Withdraw" button (header bar) to pull all `realBalance` to wallet
5. For subsequent rounds: player can use `joinBatch` (from Vision balance) — no need to withdraw+redeposit

**Bot flow:** First round: `joinBatchDirect`. Subsequent rounds: `joinBatch` (from accumulated Vision balance). Only calls `withdrawBalance()` when shutting down.

**Don't gut engine.rs yet:** Ship lifecycle manager ALONGSIDE the existing tick engine. Once lifecycle works end-to-end, remove old code in a separate PR. No safety net removal during the initial ship.

---

## What gets deleted (AFTER lifecycle manager is proven working)

| Component | What dies | Why |
|-----------|----------|-----|
| `engine.rs` tick resolution loop (lines 1826-2300) | Replaced by lifecycle manager | **Phase 2 — not on first ship** |
| `engine.rs` balance proof generation | Replaced by settlement | Per-tick proofs no longer needed |
| `WithdrawModal.tsx` (per-batch BLS proof modal) | Dead — settlement is automatic | No manual BLS proof fetch |
| `BalanceDepositModal.tsx` | Dead — `joinBatchDirect` handles it | No need to pre-deposit to Vision balance |
| `vision_player_tick_deltas` table | Replaced by `vision_round_players` | Per-round, not per-tick |
| `vision_balance_proofs` table | Dead — no per-tick proofs | Settlement replaces proofs |

## What SURVIVES (critical — do NOT delete)

| Component | Why it lives |
|-----------|-------------|
| `VisionBalanceBar` (header) | Shows accumulated Vision balance + ONE "Withdraw" button |
| `withdrawBalance()` on-chain | Players withdraw accumulated USDC from all settled rounds |
| `joinBatch` (from Vision balance) | Subsequent rounds pull from Vision balance (no withdraw+redeposit) |
| `useJoinBatch.ts` hook | Used for round 2+ (from Vision balance) |
| `engine.rs` tick loop | **Keep running alongside lifecycle manager until proven stable** |
| `IncomingBalanceProofsBatch` types | Imported by main.rs, consensus, P2P — keep type definitions |

## What survives

| Component | Survives as |
|-----------|------------|
| `TickResolver` + `resolver.rs` | Called once per round (not per tick) |
| `TickScheduler` | Tracks active rounds (with `remove_batch` cleanup) |
| `BitmapStore` | Stores bitmaps during betting window, purged at settlement |
| `settlement.rs` | Computes payouts from resolver output |
| `batch_config_orchestrator.rs` | BLS consensus for batch creation |
| `chain_listener.rs` | Handles on-chain events |
| `ChainWriter` | Calls `createBatch` + `settleBatch` |

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `oracle/src/vision/lifecycle.rs` | BatchLifecycleManager — THE engine (replaces tick loop) |
| `oracle/src/vision/settlement.rs` | Parimutuel payout computation |
| `oracle/migrations/008_round_mode_clean.sql` | Add state column, clean old data |
| `frontend/hooks/vision/useJoinBatchDirect.ts` | Direct USDC join hook |
| `frontend/hooks/vision/useRounds.ts` | Fetch active rounds |

### Modified files (key changes only)
| File | Change |
|------|--------|
| `oracle/src/vision/engine.rs` | **Gut it.** Remove tick loop. Keep only bitmap gossip handler + GC. Lifecycle manager takes over. |
| `oracle/src/vision/tick_scheduler.rs` | Add `remove_batch()`, `mark_settled()`. Filter settled batches on load. |
| `oracle/src/vision/bitmap_store.rs` | Add `purge_batch()`. |
| `oracle/src/vision/chain_listener.rs` | Add `BatchSettled` event handler. Pass `bitmap_store` for cleanup. |
| `oracle/src/chain/writer.rs` | Add `settle_batch()` method + `vision` address field. |
| `oracle/src/main.rs` | Spawn lifecycle manager instead of tick engine. |
| `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` | Use `joinBatchDirect`. Remove dual-balance deposit flow. |
| `frontend/lib/contracts/vision-abi.ts` | Add `joinBatchDirect` entry. |
| `vision-bot/bot.py` | Remove dual-balance flow. Use direct deposit only. |
| `vision-bot/framework/tracker.py` | Fix `_join_round` placeholder. Add settlement detection. |

---

## Task 1: DB migration + scheduler cleanup

**Files:**
- Create: `oracle/migrations/008_round_mode_clean.sql`
- Modify: `oracle/src/vision/tick_scheduler.rs`
- Modify: `oracle/src/vision/bitmap_store.rs`

- [ ] **Step 1: Write migration**

```sql
-- 008_round_mode_clean.sql
-- Add lifecycle state to vision_batches. Wipe old data for clean start.

ALTER TABLE vision_batches ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_vision_batches_state ON vision_batches(state);

-- Wipe old permanent-batch data (full infra restart)
TRUNCATE vision_player_tick_deltas;
TRUNCATE vision_balance_proofs;
TRUNCATE vision_bitmaps;
TRUNCATE vision_tick_results;
TRUNCATE vision_positions;
-- Don't truncate vision_batches — chain listener will re-populate from events

-- Ensure round tables exist
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
CREATE INDEX IF NOT EXISTS idx_lifecycle_source ON vision_batch_lifecycle(source_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_unsettled ON vision_batch_lifecycle(settled_at) WHERE settled_at IS NULL;

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
CREATE INDEX IF NOT EXISTS idx_round_players_player ON vision_round_players(player);
```

- [ ] **Step 2: Add remove_batch + mark_settled to TickScheduler**

```rust
// In tick_scheduler.rs, after existing methods:

pub async fn remove_batch(&self, batch_id: u64) {
    self.batches.write().await.remove(&batch_id);
    self.players.write().await.remove(&batch_id);
    self.last_resolved.write().await.remove(&batch_id);
}

pub async fn mark_settled(&self, pool: &PgPool, batch_id: u64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE vision_batches SET state = 'settled', paused = true WHERE id = $1")
        .bind(batch_id as i64)
        .execute(pool)
        .await?;
    self.remove_batch(batch_id).await;
    Ok(())
}
```

- [ ] **Step 3: Filter load_from_db to skip settled batches**

Change the query in `load_from_db` from `WHERE NOT paused` to `WHERE NOT paused AND (state = 'active' OR state IS NULL)`.

- [ ] **Step 4: Add purge_batch to BitmapStore**

```rust
pub async fn purge_batch(&self, batch_id: u64) {
    let mut guard = self.slots.write().await;
    guard.pending.remove(&batch_id);
    guard.active.remove(&batch_id);
}

pub async fn purge_batch_from_db(&self, pool: &PgPool, batch_id: u64) -> Result<(), BitmapStoreError> {
    sqlx::query("DELETE FROM vision_bitmaps WHERE batch_id = $1")
        .bind(batch_id as i64)
        .execute(pool)
        .await
        .map_err(BitmapStoreError::Db)?;
    self.purge_batch(batch_id).await;
    Ok(())
}
```

- [ ] **Step 5: Commit**

```bash
git add oracle/migrations/008_round_mode_clean.sql oracle/src/vision/tick_scheduler.rs oracle/src/vision/bitmap_store.rs
git commit -m "feat: round-mode DB migration, batch lifecycle methods, purge_batch"
```

---

## Task 2: Settlement computation (pure logic, tested)

**Files:**
- Create: `oracle/src/vision/settlement.rs`
- Modify: `oracle/src/vision/mod.rs`

Same as original plan Task 2 — pure parimutuel payout computation with zero-sum invariant tests. See original plan for full code.

Key: `compute_settlement(tick_result, player_deposits, player_stakes) -> RoundSettlement`

PnL uses checked U256 subtraction (corrections A1):
```rust
let pnl_str = if payout >= deposit {
    (payout - deposit).to_string()
} else {
    format!("-{}", deposit - payout)
};
```

- [ ] **Step 1-6:** Write tests → implement → verify → commit (same as original Task 2)

---

## Task 3: ChainWriter — settle_batch + vision address

**Files:**
- Modify: `oracle/src/chain/writer.rs`

- [ ] **Step 1: Add `vision` to WriterContractAddresses**

```rust
// In WriterContractAddresses struct:
pub vision: Address,
```

Initialize from deployment config in `EthersChainWriter::new()`.

- [ ] **Step 2: Add build_settle_batch_tx**

Follow the `build_settle_bet_tx` pattern (line 940). Use `ethers::abi::Function` with explicit params:

```rust
fn build_settle_batch_tx(&self, batch_id: u64, players: &[Address], payouts: &[U256], bls_sig: &[u8], ref_nonce: u64, signers_bitmask: U256) -> Result<TypedTransaction, Error> {
    // Build Function descriptor for settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)
    // Encode input, build Eip1559TransactionRequest to self.config.contracts.vision
    // Return TypedTransaction
}
```

- [ ] **Step 3: Add settle_batch method**

```rust
pub async fn settle_batch(&self, batch_id: u64, players: Vec<Address>, payouts: Vec<U256>, bls_sig: Vec<u8>, ref_nonce: u64, signers_bitmask: U256) -> Result<TxHash, Error> {
    let tx = self.build_settle_batch_tx(batch_id, &players, &payouts, &bls_sig, ref_nonce, signers_bitmask)?;
    self.submit_tx(tx, "settle_batch").await
}
```

- [ ] **Step 4: Commit**

```bash
git add oracle/src/chain/writer.rs
git commit -m "feat: settle_batch chain writer + vision address"
```

---

## Task 4: BatchLifecycleManager — THE engine

**Files:**
- Create: `oracle/src/vision/lifecycle.rs`
- Modify: `oracle/src/vision/mod.rs`
- Modify: `oracle/src/main.rs`
- Modify: `oracle/src/vision/engine.rs` (gut the tick loop)

This is the big task. The lifecycle manager replaces the tick engine entirely.

- [ ] **Step 1: Create lifecycle.rs**

The lifecycle manager:
1. Runs a per-source heartbeat on `tickDuration` intervals (staggered by source index)
2. Each heartbeat: create new batch → resolve previous batch → settle previous batch
3. Uses `batch_config_orchestrator` for BLS-signed batch creation
4. Uses `TickResolver` for market resolution
5. Uses `settlement::compute_settlement` for payout computation
6. Uses `ChainWriter::settle_batch` for on-chain settlement
7. Records everything in `vision_batch_lifecycle` + `vision_round_players`
8. Calls `scheduler.mark_settled()` + `bitmap_store.purge_batch()` for cleanup

```rust
// Core struct
pub struct BatchLifecycleManager {
    config: VisionConfig,
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    pool: PgPool,
    shutdown: Arc<AtomicBool>,
    chain_writer: Arc<dyn ChainWriter>,  // for settleBatch
    bls_keypair: Arc<BLSKeyPair>,
}
```

The `process_source_round` function is NOT a skeleton with TODOs — it contains the full implementation:

**Create batch:** Delegate to `batch_config_orchestrator.create_round_batch(source_id)`. This fetches fresh config from data-node, reaches BLS consensus among oracles, calls `createBatch` on-chain.

**Resolve previous batch:**
1. Get previous batch's players + bitmaps from scheduler/bitmap_store
2. Fetch price snapshot from data-node at `betting_end` timestamp (use most recent if historical not available)
3. Call `resolver.resolve_tick()` with market configs from the batch's config
4. Call `settlement::compute_settlement()` to get per-player payouts

**Settle previous batch:**
1. Compute `SETTLE_BATCH` BLS hash: `keccak256(abi.encode(chainid, vision, "SETTLE_BATCH", batchId, keccak256(abi.encode(players, payouts))))`
2. Sign with local BLS key
3. Broadcast to peers for aggregation (reuse existing balance proof P2P channel)
4. When 2/3+1 signatures collected, call `chain_writer.settle_batch()`
5. Wait for TX receipt
6. Record in `vision_batch_lifecycle` (set `settled_at`, `settle_tx_hash`)
7. Record in `vision_round_players` (per-player PnL with checked U256 subtraction)
8. Call `scheduler.mark_settled(pool, batch_id)` + `bitmap_store.purge_batch_from_db(pool, batch_id)`

- [ ] **Step 2: Add source filter to engine.rs (DON'T gut it)**

Keep the existing tick engine running for non-round sources. Add a skip filter at the top of the batch iteration loop (same as original plan Task 4):

```rust
// In engine.rs tick loop, skip round-based sources
let round_source_ids: Vec<H256> = config.round_based_sources.iter()
    .flat_map(|s| {
        let mut c = vec![H256::from(keccak256(s.as_bytes()))];
        for v in 1..=5u8 { c.push(H256::from(keccak256(format!("{}_v{}", s, v).as_bytes()))); }
        c
    })
    .collect();

// Inside the batch loop:
if round_source_ids.contains(&batch.source_id) { continue; }
```

The old engine stays alive as a safety net. Once lifecycle manager is proven, remove the old code in a separate PR.

- [ ] **Step 3: Spawn lifecycle manager ALONGSIDE engine in main.rs**

Replace the tick engine spawn with:

```rust
// Spawn lifecycle manager (replaces tick engine)
let lifecycle = oracle::vision::lifecycle::BatchLifecycleManager::new(
    vision_cfg.clone(),
    scheduler.clone(),
    resolver.clone(),
    pool.clone(),
    shutdown.clone(),
    chain_writer.clone(),
    bls_keypair.clone(),
);
tokio::spawn(async move { lifecycle.run().await });
```

- [ ] **Step 4: Add BatchSettled event handler to chain_listener**

Add `bitmap_store: Arc<BitmapStore>` to ChainListener struct. Handle `BatchSettled(uint256 indexed batchId, uint256 playerCount)`:

```rust
if log.topics[0] == batch_settled_topic {
    let batch_id = log.topics[1].to_low_u64_be();
    scheduler.mark_settled(&pool, batch_id).await.ok();
    bitmap_store.purge_batch_from_db(&pool, batch_id).await.ok();
}
```

- [ ] **Step 5: Verify compilation**

Run: `cargo build -p oracle`

- [ ] **Step 6: Commit**

```bash
git add oracle/src/vision/lifecycle.rs oracle/src/vision/engine.rs oracle/src/vision/chain_listener.rs oracle/src/main.rs oracle/src/vision/mod.rs
git commit -m "feat: BatchLifecycleManager replaces tick engine — round-based only"
```

---

## Task 5: Frontend — joinBatchDirect + remove dual-balance

**Files:**
- Modify: `frontend/lib/contracts/vision-abi.ts`
- Create: `frontend/hooks/vision/useRounds.ts`
- Modify: `frontend/components/domain/vision/detail/BatchEntryPanel.tsx`
- Delete references to: `useWithdraw`, `BalanceDepositModal`, `useVisionBalance`

- [ ] **Step 1: Add joinBatchDirect to ABI**

```typescript
{
  name: 'joinBatchDirect',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'batchId', type: 'uint256' },
    { name: 'configHash', type: 'bytes32' },
    { name: 'depositAmount', type: 'uint256' },
    { name: 'stakePerTick', type: 'uint256' },
    { name: 'bitmapHash', type: 'bytes32' },
  ],
  outputs: [],
},
```

- [ ] **Step 2: Create useRounds hook**

Fetch from `/api/vision/rounds` (existing proxy). Returns active rounds with state (betting/settling/settled).

- [ ] **Step 3: Update BatchEntryPanel**

Replace the dual-balance join flow with direct USDC:
1. `approve(VISION_ADDRESS, amount)` on USDC contract
2. `joinBatchDirect(batchId, configHash, amount, stake, bitmapHash)` on Vision contract
3. Remove per-batch WithdrawModal (BLS proof modal) — settlement is automatic
4. KEEP VisionBalanceBar in header — shows accumulated balance + global Withdraw button
5. Show round state: "Betting (2:31 left)" / "Settling..." / "Settled: +$X.XX"

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: joinBatchDirect frontend, remove dual-balance flow"
```

---

## Task 6: Bot — smart deposit (direct first, from-balance after)

**Files:**
- Modify: `vision-bot/bot.py`
- Modify: `vision-bot/framework/tracker.py`

- [ ] **Step 1: Smart join flow in bot.py**

In `run_cycle`, replace the old dual-balance flow with a smart flow that checks Vision balance first:

```python
# Check if bot has Vision balance (from previous round settlements)
vision_balance = executor.get_vision_balance()
if vision_balance >= deposit_wei:
    # Use accumulated balance from previous settlements
    executor.join_batch(batch_id, config_hash, deposit_wei, stake_wei, bm_hash)
else:
    # First round or balance withdrawn — direct USDC from wallet
    executor.approve_usdc(deposit_wei)
    executor.join_batch_direct(batch_id, config_hash, deposit_wei, stake_wei, bm_hash)
```

Add `get_vision_balance()` to Executor in `chain.py` — reads `balanceOf(bot_addr)` from Vision contract.

- [ ] **Step 2: Fix _join_round placeholder**

In `tracker.py` line 125, replace:
```python
bets = ["UP"] * market_count  # placeholder
```
With:
```python
bets = strategy.predict(markets) if strategy else [random.choice(["UP", "DOWN"]) for _ in range(market_count)]
```

Pass `strategy` parameter through `check_rounds` → `_join_round`.

- [ ] **Step 3: Commit**

```bash
git add vision-bot/
git commit -m "feat: bot direct deposit only, fix _join_round placeholder"
```

---

## Deploy sequence

1. `cargo build --release --bin oracle --bin data-node` on VPS
2. Stop all oracles, bots, data-node
3. Wipe pnl data: `rm docker/testnet/vision-swarm/pnl-data/pnl-*.json`
4. Run migration 008 (truncates old data)
5. Restart data-node
6. Restart oracles with lifecycle manager
7. Restart bots
8. Watch logs: lifecycle manager creates batches → bots join → round resolves → settlement TX lands → USDC credited

No contract redeploy needed — `settleBatch` and `joinBatchDirect` are already on-chain.

---

## Execution order

| Task | Time | What it produces |
|------|------|-----------------|
| 1 | 30min | DB schema + scheduler cleanup methods |
| 2 | 1h | Tested settlement payout computation |
| 3 | 1h | Chain writer can call settleBatch |
| 4 | 3h | **Working lifecycle manager** — the entire engine replacement |
| 5 | 1.5h | Frontend direct deposit, no dual-balance |
| 6 | 30min | Bot direct deposit, fixed join_round |

**Total: ~7.5 hours.** One session if ambitious, two if careful.

**Minimum viable: Tasks 1-4** (~5.5h). Gets the oracle producing rounds. Frontend/bot can be adapted afterward.
