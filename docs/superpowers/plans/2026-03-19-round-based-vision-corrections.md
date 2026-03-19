# Round-Based Vision — Plan Corrections (Review Round 1)

> Corrections to `docs/superpowers/plans/2026-03-19-round-based-vision.md` based on 3-agent consensus review.

## Critical Corrections

### C1: Task 6 — Lifecycle manager must NOT be a skeleton

The plan has 9 TODOs inside `process_source_round`. These TODOs ARE the feature. Replace them with actual implementation in 3 sub-tasks:

**Task 6a: Settlement consensus via batch_config_orchestrator**

The lifecycle manager MUST NOT fetch config independently. All 3 oracles must agree on the exact configHash. Reuse the existing `batch_config_orchestrator` leader/follower consensus:

1. Leader oracle fetches recommended config from data-node
2. Leader proposes configHash to followers via P2P
3. Followers verify (±30% asset count tolerance, ±20% threshold tolerance)
4. All sign the `CREATE_BATCH` message
5. Leader submits `createBatch` on-chain

The lifecycle manager delegates to `batch_config_orchestrator.create_round_batch(source_id)` — a new method that wraps the existing consensus flow with round-specific timing.

**Task 6b: Settlement BLS consensus**

New consensus message type: `VisionSettleProposal`. Similar to `VisionTickSettlement` but uses `SETTLE_BATCH` domain tag:

```rust
fn compute_settle_batch_hash(
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    players: &[Address],
    payouts: &[U256],
) -> [u8; 32] {
    keccak256(&encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("SETTLE_BATCH".to_string()),
        Token::Uint(U256::from(batch_id)),
        Token::FixedBytes(keccak256(&encode(&[
            Token::Array(players.iter().map(|a| Token::Address(*a)).collect()),
            Token::Array(payouts.iter().map(|p| Token::Uint(*p)).collect()),
        ])).to_vec()),
    ]))
}
```

Leader computes payouts → proposes to followers → followers independently compute and verify → all sign → leader aggregates → leader calls `settleBatch`.

**Task 6c: Historical price fetch for settlement**

Resolution needs prices at `betting_end`, not current time. Add to data-node:

```
GET /vision/snapshot?source={source}&at={unix_timestamp}
```

This queries `market_prices` table with `WHERE fetched_at <= $2 ORDER BY fetched_at DESC LIMIT 1` per asset. The lifecycle manager passes `betting_end` timestamp.

If the data-node doesn't support historical queries yet, fallback: use the most recent snapshot (already cached) and log a warning about potential price drift.

### C2: Task 5 — ChainWriter compilation fixes

**Fix 1:** `EthersChainWriter` has no `vision_address` field. Add it:
- In `WriterContractAddresses` (writer.rs line 25-30), add: `pub vision: Address`
- In `EthersChainWriter::new()`, read from deployment config: `contracts.vision = deploy["Vision"].parse()?`

**Fix 2:** No `build_tx` method. Follow the existing `build_settle_bet_tx` pattern (line 896-934):
- Create `build_settle_batch_tx` that constructs a `TypedTransaction` using `ethers::abi::Function` with explicit `Param` definitions
- Then call `self.submit_tx(tx, "settle_batch")`

**Fix 3:** Add `settle_batch` as a direct method on `EthersChainWriter`, NOT on the `ChainWriter` trait in `common/`. The trait is for ITP operations. Vision settlement is oracle-specific.

### C3: Task 7 — ChainListener needs bitmap_store

`ChainListener` struct has no `bitmap_store` field. Two options:

**Option A (preferred):** Add `bitmap_store: Arc<BitmapStore>` to the `ChainListener` struct. Update `ChainListener::new()` to accept it. Update the caller in `main.rs` to pass `bitmap_store.clone()`.

**Option B:** Move bitmap purge to the GC timer in `engine.rs` (Task 4's gc_timer block already queries settled batches). The chain listener just calls `scheduler.mark_settled()`, and the GC handles bitmap cleanup.

## High-Priority Corrections

### H1: `settleBatch` behavior mismatch

The contract's `settleBatch` credits `realBalance`/`virtualBalance`, NOT direct USDC transfer. The lifecycle manager must account for this:
- After settlement, players' Vision balances are credited
- Players must call `withdrawBalance()` to get USDC back to their wallet
- The "auto-join next round" flow can read Vision balance and use it for the next `joinBatch` (not `joinBatchDirect`)
- Update the spec to match reality OR deploy a new `settleBatchDirect` variant

### H2: No `bytes32_hex_to_string` in engine.rs

Task 4's source filter uses `bytes32_hex_to_string` which is private to `api.rs`. Fix: use direct keccak256 comparison instead of decoding to string. The filter already does keccak matching — remove the string conversion entirely:

```rust
// Instead of decoding source_id to string, match directly:
let round_source_ids: Vec<H256> = config.round_based_sources.iter()
    .flat_map(|s| {
        let mut candidates = vec![H256::from(keccak256(s.as_bytes()))];
        for v in 1..=5u8 {
            candidates.push(H256::from(keccak256(format!("{}_v{}", s, v).as_bytes())));
        }
        candidates
    })
    .collect();

// In the loop:
if round_source_ids.contains(&batch.source_id) {
    continue; // handled by lifecycle manager
}
```

## Medium-Priority Corrections

### M1: Task 9 — Bot regression

`join_batch_direct` already exists on `Executor` (chain.py line 372-380). `_join_round` is mostly implemented (tracker.py line 114-142) — only the `bets = ["UP"] * market_count` placeholder needs fixing. The plan's rewrite loses oracle bitmap submission and `on_join` tracking.

**Fix:** Only change line 125 of `_join_round`:
```python
# Replace: bets = ["UP"] * market_count  # placeholder
# With:
bets = strategy.predict(markets) if strategy else [random.choice(["UP", "DOWN"]) for _ in range(market_count)]
```

Pass `strategy` as parameter to `_join_round` and `check_rounds`.

### M2: Task 10 — Test file collision

File `46-vision-leaderboard-sorting.spec.ts` already exists. Rename to `47-vision-round-lifecycle.spec.ts`.

### M3: Task 8 — useRounds API path

No route exists at `/api/vision/rounds/active`. The existing proxy is at `/api/vision/rounds` (maps to oracle's `/vision/rounds`). Change the hook to fetch `/api/vision/rounds?source=${sourceId}`.

## Additions

### A1: Add Task 6.5 — Populate vision_round_players at settlement

After computing payouts and calling `settleBatch`, INSERT into `vision_round_players`.

**Note:** `U256` is unsigned — no `.as_i128()`. Use checked subtraction with sign handling:

```rust
for (i, player) in settlement.players.iter().enumerate() {
    let deposit = player_deposits.iter()
        .find(|(a, _)| a == player)
        .map(|(_, d)| *d)
        .unwrap_or(U256::zero());
    let payout = settlement.payouts[i];
    // PnL as signed string: payout - deposit (can be negative)
    let pnl_str = if payout >= deposit {
        (payout - deposit).to_string()
    } else {
        format!("-{}", deposit - payout)
    };

    sqlx::query(
        "INSERT INTO vision_round_players (batch_id, player, deposited, payout, pnl, correct_count, total_markets, settled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (batch_id, player) DO NOTHING"
    )
    .bind(batch_id as i64)
    .bind(format!("{:?}", player))
    .bind(deposit.to_string())
    .bind(payout.to_string())
    .bind(pnl_str)
    .bind(settlement.correct_counts[i] as i32)
    .bind(settlement.total_markets as i32)
    .execute(pool)
    .await?;
}
```

### A2: Stagger source round start times

Don't align all 47 sources to the same wall-clock boundary. Add an offset per source:

```rust
let offset_secs = (source_index * 7) % tick_duration_secs; // spread across tick
tokio::time::sleep(Duration::from_secs(offset_secs)).await;
```

This prevents 94 transactions bursting simultaneously.

### A3: Add Task 2.2 — Oracle round API endpoints

The original plan lists `api.rs` as modified but no task implements the round endpoints. The frontend `useRounds` hook fetches `/api/vision/rounds` which proxies to the oracle. The oracle must serve these routes.

**File:** `oracle/src/vision/api.rs`

Add two endpoints (minimum viable):

**`GET /vision/rounds/active`** — already exists as a stub (aliased to list_batches filtered by `!paused`). Update it to query `vision_batch_lifecycle WHERE settled_at IS NULL` when available, falling back to the existing `vision_batches` query.

**`GET /vision/rounds/:batchId/results`** — already exists as a stub reading from `vision_round_players`. Once Task 6.5 (A1) populates that table, this endpoint returns real data. No code change needed — just verify the existing handler works.

Both endpoints already have route registrations in `api.rs` (lines 106-109):
```rust
.route("/vision/rounds/active", get(rounds_active))
.route("/vision/rounds/:id/results", get(round_results))
.route("/vision/rounds/:id/bitmaps", get(round_bitmaps))
.route("/vision/player/:address/rounds", get(player_rounds))
```

The handlers exist. The gap is that `rounds_active` hardcodes `status: "betting"` for all batches and estimates `betting_end` from wall clock instead of reading from `vision_batch_lifecycle`. Fix: query `vision_batch_lifecycle` for batches with `settled_at IS NULL`, derive state from `betting_end` vs `NOW()`.

```rust
// In rounds_active handler, replace the hardcoded status:
let state = if now < betting_end {
    "betting"
} else if settled_at.is_some() {
    "settled"
} else {
    "settling"
};
```

This is ~20 lines of SQL + response mapping. Add to Session 2 alongside Task 7.

### A4: Update execution timeline

| Session | Tasks | Actual time | What it produces |
|---------|-------|-------------|-----------------|
| **1** | 1, 2, 3, 4, 5 | ~4h | Foundation: DB, settlement logic, config, engine filter, chain writer |
| **2** | 6 (with 6a/6b/6c), 7, A3(2.2) | ~6h | **Working** lifecycle manager with BLS consensus + settlement + round API |
| **3** | 8, 9 (minimal), 10 | ~2h | Frontend hook, bot fix, E2E test |

Session 2 is now 6h (was 3h) because it includes consensus integration + API endpoints that were previously TODOs.

### A5: H1 clarification — auto-join timing after settlement

After `settleBatch` credits Vision balance, the bot must wait for the settlement TX to be mined before calling `joinBatch` for the next round. The lifecycle manager should:
1. Call `settleBatch` on-chain
2. Wait for TX receipt (`wait_for_transaction_receipt`)
3. THEN create the next batch
4. THEN signal bots that a new round is open

The bot's `check_rounds` polling loop naturally handles this — it polls `/vision/rounds/active` every 30s. If the new batch isn't created yet, there's nothing to join. No explicit delay needed.
