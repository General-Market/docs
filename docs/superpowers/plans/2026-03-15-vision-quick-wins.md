# Vision Quick Wins — 7 Fixes for Survivability

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 7 low-effort fixes that eliminate OOM crashes, data corruption, DoS vectors, and silent event loss — the minimum to make Vision survivable before the architectural rewrites.

**Architecture:** These are surgical fixes to existing code. No new services, no new contracts, no migrations. Three oracle-side Rust changes (DB pool, consensus GC, DB transactions), one data-node Rust change (SSE limits), one data-node one-liner (broadcast capacity), one oracle restructure (BitmapStore), and one oracle event fix (chain listener signature).

**Tech Stack:** Rust (oracle, data-node), PostgreSQL, axum/tower (data-node HTTP)

**Spec:** `docs/superpowers/specs/2026-03-15-vision-10k-batches-bottleneck-audit.md`

---

## Chunk 1: Oracle One-Liners (P0 — 30 minutes total)

### Task 1: Increase oracle DB pool from 2 to 20 connections

**Files:**
- Modify: `oracle/src/vision/engine.rs:1087`

- [ ] **Step 1: Read the current pool configuration**

Verify line 1087 reads `.max_connections(2)`.

- [ ] **Step 2: Change pool size**

```rust
// Before:
.max_connections(2)

// After:
.max_connections(20)
```

At `oracle/src/vision/engine.rs:1087`, change `2` to `20`. This is the vision engine's Postgres connection pool. With 2 connections, all balance updates, proof storage, and tick markers serialize onto 2 connections — a hard throughput ceiling at ~200 batches. With 20, the pool can process 20 concurrent queries. Three oracles × 20 = 60 total connections, well within Postgres defaults (100).

- [ ] **Step 3: Verify it compiles**

Run: `cd oracle && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add oracle/src/vision/engine.rs
git commit -m "fix(vision): increase oracle DB pool from 2 to 20 connections

Removes hard throughput ceiling at ~200 batches where all balance
updates, proof storage, and tick markers serialized onto 2 connections."
```

---

### Task 2: Increase broadcast channel capacity from 16 to 256

**Files:**
- Modify: `data-node/src/market_data/broadcast.rs:53`

- [ ] **Step 1: Read the current channel capacity**

Verify line 53 reads `broadcast::channel(16)`.

- [ ] **Step 2: Change capacity**

```rust
// Before:
.or_insert_with(|| broadcast::channel(16).0)

// After:
.or_insert_with(|| broadcast::channel(256).0)
```

At `data-node/src/market_data/broadcast.rs:53`, change `16` to `256`. Each source gets a broadcast channel holding the last N price updates. At 16, the buffer is ~80ms of history — any WebSocket client with >80ms lag loses data permanently via `RecvError::Lagged`. At 256, the buffer holds ~5 seconds at typical update rates. Memory cost: 256 × 8 bytes × 100 sources = 200KB. Negligible.

- [ ] **Step 3: Verify it compiles**

Run: `cd data-node && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add data-node/src/market_data/broadcast.rs
git commit -m "fix(data-node): increase broadcast channel capacity from 16 to 256

Prevents WebSocket clients from losing data on any processing lag >80ms.
256 gives ~5 seconds of buffer at typical update rates."
```

---

## Chunk 2: Consensus GC (P0 — 1 hour)

### Task 3: Wire gc_stale_rounds() into the tick engine main loop

**Files:**
- Modify: `oracle/src/vision/engine.rs:1446-1470`

**Context:** `tick_consensus.rs:227` defines `gc_stale_rounds()` which removes consensus rounds older than 60 seconds. The function exists but is never called anywhere in the codebase. Every consensus round that fails to reach threshold stays in the `pending_rounds` HashMap forever. At 45 batches with 60s ticks, if 10% of rounds fail, that's ~4 rounds/minute leaking at ~5KB each — OOM in days. At 500 batches, OOM in hours.

- [ ] **Step 1: Locate the main engine loop**

Read `engine.rs:1446-1470`. The loop structure is:
```rust
loop {
    if shutdown.load(Ordering::Relaxed) { break; }
    tokio::select! {
        _ = tokio::time::sleep(interval) => {
            // ... tick resolution ...
        }
    }
}
```

The `tokio::select!` currently has one arm. We need to add a second arm with a 30-second timer for GC.

- [ ] **Step 2: Add a GC timer before the loop**

Before the `loop {` at line 1446, add:
```rust
let mut gc_timer = tokio::time::interval(std::time::Duration::from_secs(30));
gc_timer.tick().await; // consume the immediate first tick
```

- [ ] **Step 3: Add a second arm to tokio::select! for GC**

Inside the `tokio::select!` block (after the existing `_ = tokio::time::sleep(interval) => { ... }` arm), add:
```rust
_ = gc_timer.tick() => {
    if let Some(ref tc) = tick_consensus {
        tc.gc_stale_rounds().await;
    }
}
```

The variable is `tick_consensus: Option<Arc<TickConsensus>>` (created at line ~1113, wrapped in `Arc::new`). The `if let Some(ref tc)` pattern matches what the codebase uses elsewhere (e.g., line 1851).

- [ ] **Step 4: Verify it compiles**

Run: `cd oracle && cargo check`
Expected: Compiles with no errors. If `tc` is not in scope, find the actual variable name by grepping for `TickConsensus::new` in engine.rs.

- [ ] **Step 5: Commit**

```bash
git add oracle/src/vision/engine.rs
git commit -m "fix(vision): wire gc_stale_rounds into tick engine loop

gc_stale_rounds() existed but was never called. Consensus rounds that
failed to reach threshold stayed in memory forever — OOM in hours at
500 batches. Now cleaned up every 30 seconds."
```

---

## Chunk 3: DB Transaction Safety (P0 — 3 hours)

### Task 4: Wrap apply_tick_balances_with_db in a transaction

**Files:**
- Modify: `oracle/src/vision/tick_scheduler.rs:162-182`

**Context:** `apply_tick_balances_with_db` updates player balances one at a time with no DB transaction. If the connection drops mid-loop (crash, pool exhaustion), some players have new balances and others don't. On restart, DB state is inconsistent — some players at tick N, others at tick N-1. Financial corruption.

- [ ] **Step 1: Read the current function**

At `tick_scheduler.rs:162-182`:
```rust
pub async fn apply_tick_balances_with_db(
    &self,
    pool: &PgPool,
    batch_id: u64,
    balances: &[PlayerBalance],
) -> Result<(), sqlx::Error> {
    self.apply_tick_balances(batch_id, balances).await;

    for pb in balances {
        sqlx::query(
            "UPDATE vision_positions SET balance = $1 WHERE batch_id = $2 AND player = $3",
        )
        .bind(pb.new_balance.to_string())
        .bind(batch_id as i64)
        .bind(format!("{:?}", pb.player))
        .execute(pool)
        .await?;
    }

    Ok(())
}
```

Two problems: (1) no transaction wrapping, (2) in-memory state updates before DB confirms.

- [ ] **Step 2: Rewrite with transaction and correct ordering**

Replace the entire function body:
```rust
pub async fn apply_tick_balances_with_db(
    &self,
    pool: &PgPool,
    batch_id: u64,
    balances: &[PlayerBalance],
) -> Result<(), sqlx::Error> {
    // 1. Persist to DB first — all-or-nothing via transaction.
    let mut tx = pool.begin().await?;
    for pb in balances {
        sqlx::query(
            "UPDATE vision_positions SET balance = $1 WHERE batch_id = $2 AND player = $3",
        )
        .bind(pb.new_balance.to_string())
        .bind(batch_id as i64)
        .bind(format!("{:?}", pb.player))
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    // 2. Only update in-memory state after DB confirms.
    self.apply_tick_balances(batch_id, balances).await;

    Ok(())
}
```

Key changes:
- `pool.begin()` / `tx.commit()` wraps all UPDATEs in a single transaction. If any fails, all roll back.
- `self.apply_tick_balances()` moved AFTER the commit. In-memory state only advances when DB confirms success. On crash, `load_from_db()` reloads the consistent pre-update state and the caller can retry.
- Each `.execute(pool)` becomes `.execute(&mut *tx)` to use the transaction connection.

- [ ] **Step 3: Verify it compiles**

Run: `cd oracle && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 4: Run existing tests**

Run: `cd oracle && cargo test --lib vision::tick_scheduler`
Expected: All existing tests pass. The reordering (DB-first, then memory) doesn't change test behavior since tests that call this function mock or use a real pool.

- [ ] **Step 5: Commit**

```bash
git add oracle/src/vision/tick_scheduler.rs
git commit -m "fix(vision): wrap balance updates in DB transaction

apply_tick_balances_with_db did individual UPDATEs per player with no
transaction. Crash mid-loop corrupted state — some players at tick N,
others at N-1. Now all-or-nothing. Also moved in-memory update after
DB commit so on-crash recovery loads consistent state."
```

---

## Chunk 4: Event Signature Fix (P0 — 2-3 hours)

### Task 5: Fix BatchConfigUpdated event signature and propagate tickDuration

**Files:**
- Modify: `oracle/src/vision/chain_listener.rs:69-70` (keccak hash)
- Modify: `oracle/src/vision/chain_listener.rs:471-516` (event handler)
- Modify: `oracle/src/vision/tick_scheduler.rs:186-197` (scheduler method + Batch struct)

**Context:** The contract emits `BatchConfigUpdated(uint256 indexed batchId, bytes32 nextConfigHash, uint256 nextLockOffset, uint256 nextTickDuration)` — 4 params. The chain listener computes the topic hash for 3 params: `"BatchConfigUpdated(uint256,bytes32,uint256)"`. The keccak256 values differ, so the event is **never matched**. Every tick duration change on-chain is invisible to all oracles. Wrong tick boundaries, wrong resolution timing, wrong winners.

- [ ] **Step 1: Fix the event signature hash**

At `chain_listener.rs:69-70`, change:
```rust
// Before:
batch_config_updated: H256::from(ethers::utils::keccak256(
    b"BatchConfigUpdated(uint256,bytes32,uint256)",
)),

// After:
batch_config_updated: H256::from(ethers::utils::keccak256(
    b"BatchConfigUpdated(uint256,bytes32,uint256,uint256)",
)),
```

- [ ] **Step 2: Update the event handler to read 96 bytes (3 data fields)**

At `chain_listener.rs:471-516`, the handler currently reads 64 bytes (2 fields). Update it to read 96 bytes (3 fields):

Change the docstring at line 471:
```rust
/// Handle `BatchConfigUpdated(uint256 indexed batchId, bytes32 nextConfigHash, uint256 nextLockOffset, uint256 nextTickDuration)`
```

Change the data length check at line 484-485:
```rust
// Before:
// Data: nextConfigHash (bytes32) + nextLockOffset (uint256) = 64 bytes
if log.data.len() < 64 {

// After:
// Data: nextConfigHash (bytes32) + nextLockOffset (uint256) + nextTickDuration (uint256) = 96 bytes
if log.data.len() < 96 {
```

After the `new_lock_offset` extraction at line 490, add:
```rust
let new_tick_duration = U256::from_big_endian(&log.data[64..96]).as_u64();
```

Update the scheduler call at line 493-495:
```rust
// Before:
self.scheduler
    .on_batch_config_updated(batch_id, new_config_hash, new_lock_offset)
    .await;

// After:
self.scheduler
    .on_batch_config_updated(batch_id, new_config_hash, new_lock_offset, new_tick_duration)
    .await;
```

Update the Postgres query at line 498-505 to also persist `next_tick_duration`:
```rust
if let Err(e) = sqlx::query(
    "UPDATE vision_batches SET next_config_hash = $1, next_lock_offset = $2, next_tick_duration = $3 WHERE id = $4",
)
.bind(format!("{:?}", new_config_hash))
.bind(new_lock_offset as i64)
.bind(new_tick_duration as i64)
.bind(batch_id as i64)
.execute(&self.pool)
.await
{
    warn!(batch_id, error = %e, "Failed to update batch config in Postgres");
}
```

Update the log line at 510-515 to include `new_tick_duration`:
```rust
info!(
    batch_id,
    new_config_hash = ?new_config_hash,
    new_lock_offset,
    new_tick_duration,
    "BatchConfigUpdated"
);
```

- [ ] **Step 3: Add next_tick_duration to the Batch struct and ALL construction sites**

At `oracle/src/vision/types.rs:13-31`, add a field after `next_lock_offset`:
```rust
/// Pending tick duration (promoted with next_config_hash at tick boundary)
pub next_tick_duration: Option<u64>,
```

Then add `next_tick_duration: None,` to ALL 6 construction sites:

1. `chain_listener.rs:336-348` — `handle_batch_created`, fetched path
2. `chain_listener.rs:365-377` — `handle_batch_created`, fallback path
3. `tick_scheduler.rs:343-355` — `load_from_db` (see Step 3b below)
4. `tick_scheduler.rs:549-562` — test helper `make_batch`
5. `engine.rs:1966-1980` — test helper `make_batch`
6. `resolver.rs:681-695` — test helper `make_batch`

For sites 1, 2, 4, 5, 6: add `next_tick_duration: None,` after `next_lock_offset`.

- [ ] **Step 3b: Update load_from_db to read next_tick_duration from DB**

At `tick_scheduler.rs:329-358`, update the SELECT query and tuple destructure:

```rust
// Before (10 columns):
let batch_rows: Vec<(i64, String, i64, i64, bool, String, String, String, i64, i64)> =
    sqlx::query_as(
        "SELECT id, creator, tick_duration, created_at_tick, paused, \
         source_id, config_hash, next_config_hash, next_lock_offset, last_promotion_tick \
         FROM vision_batches WHERE NOT paused",
    )

// After (11 columns — next_tick_duration is nullable):
let batch_rows: Vec<(i64, String, i64, i64, bool, String, String, String, i64, i64, Option<i64>)> =
    sqlx::query_as(
        "SELECT id, creator, tick_duration, created_at_tick, paused, \
         source_id, config_hash, next_config_hash, next_lock_offset, last_promotion_tick, \
         next_tick_duration \
         FROM vision_batches WHERE NOT paused",
    )
```

Update the destructure at line 342:
```rust
for (id, creator, tick_duration, created_at_tick, paused, source_id, config_hash, next_config_hash, next_lock_offset, last_promotion_tick, next_tick_duration) in &batch_rows {
```

And in the Batch construction at line 343-355, add:
```rust
next_tick_duration: next_tick_duration.map(|v| *v as u64),
```

This ensures `next_tick_duration` survives oracle restarts.

- [ ] **Step 4: Update on_batch_config_updated to accept and store the new field**

At `tick_scheduler.rs:186-197`, change the method signature and body:
```rust
// Before:
pub async fn on_batch_config_updated(
    &self,
    batch_id: u64,
    new_config_hash: H256,
    new_lock_offset: u64,
) {
    let mut batches = self.batches.write().await;
    if let Some(batch) = batches.get_mut(&batch_id) {
        batch.next_config_hash = new_config_hash;
        batch.next_lock_offset = new_lock_offset;
    }
}

// After:
pub async fn on_batch_config_updated(
    &self,
    batch_id: u64,
    new_config_hash: H256,
    new_lock_offset: u64,
    new_tick_duration: u64,
) {
    let mut batches = self.batches.write().await;
    if let Some(batch) = batches.get_mut(&batch_id) {
        batch.next_config_hash = new_config_hash;
        batch.next_lock_offset = new_lock_offset;
        batch.next_tick_duration = Some(new_tick_duration);
    }
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd oracle && cargo check`
Expected: Compiles. If the `Batch` struct is in `types.rs`, also check that `load_from_db` handles the new field (defaults to `None` if the column doesn't exist yet — may need a DB migration to add `next_tick_duration` column to `vision_batches`).

- [ ] **Step 6: Add DB migration (required)**

The `vision_batches` table has no `next_tick_duration` column. Create a migration:
```sql
ALTER TABLE vision_batches ADD COLUMN IF NOT EXISTS next_tick_duration BIGINT;
```

Run: Check existing migrations in `oracle/migrations/` for naming convention, then create the new file.

- [ ] **Step 7: Update tests that call on_batch_config_updated**

Two tests call the old 3-param signature. Update both:

At `tick_scheduler.rs:827`:
```rust
// Before:
.on_batch_config_updated(1, new_hash, 120)
// After:
.on_batch_config_updated(1, new_hash, 120, 3600)
```

At `tick_scheduler.rs:862`:
```rust
// Before:
.on_batch_config_updated(999, H256::from([0xCC; 32]), 60)
// After:
.on_batch_config_updated(999, H256::from([0xCC; 32]), 60, 3600)
```

- [ ] **Step 8: Run existing tests**

Run: `cd oracle && cargo test --lib vision`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add oracle/src/vision/chain_listener.rs oracle/src/vision/tick_scheduler.rs oracle/src/vision/types.rs
git commit -m "fix(vision): fix BatchConfigUpdated event signature mismatch

Chain listener used 3-param keccak hash but contract emits 4 params
including tickDuration. Events were silently never matched — oracles
ignored all tick duration changes. Now reads 96 bytes, propagates
nextTickDuration to scheduler and Postgres."
```

---

## Chunk 5: BitmapStore Restructure (P0 — 1 day)

### Task 6: Restructure BitmapStore from flat to nested HashMap

**Files:**
- Modify: `oracle/src/vision/bitmap_store.rs` (entire file)

**Context:** The BitmapStore uses `HashMap<(u64, Address), SlottedBitmap>` for both pending and active maps. `get_all_active_for_batch(batch_id)` iterates ALL entries across ALL batches and filters by `batch_id`. At 10K batches × 100 players = 1M entries, every tick resolution does a 1M-entry scan to find ~100 entries. This is O(total_entries) instead of O(entries_in_batch). The fix: nested HashMap keyed by batch_id first.

- [ ] **Step 1: Change BitmapSlots to nested HashMap**

Replace the struct:
```rust
// Before:
struct BitmapSlots {
    pending: HashMap<(u64, Address), SlottedBitmap>,
    active: HashMap<(u64, Address), SlottedBitmap>,
}

// After:
struct BitmapSlots {
    pending: HashMap<u64, HashMap<Address, SlottedBitmap>>,
    active: HashMap<u64, HashMap<Address, SlottedBitmap>>,
}

impl BitmapSlots {
    fn new() -> Self {
        Self {
            pending: HashMap::new(),
            active: HashMap::new(),
        }
    }
}
```

- [ ] **Step 2: Update store_pending**

```rust
pub async fn store_pending(
    &self,
    player: Address,
    batch_id: u64,
    bitmap: Vec<u8>,
    expected_hash: H256,
    config_hash: H256,
    target_tick_id: u64,
) -> Result<(), BitmapStoreError> {
    let computed = keccak256(&bitmap);
    if computed != expected_hash {
        return Err(BitmapStoreError::HashMismatch {
            expected: expected_hash,
            computed,
        });
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let entry = SlottedBitmap {
        player,
        batch_id,
        bitmap,
        hash: expected_hash,
        config_hash,
        target_tick_id,
        received_at: now,
    };

    self.slots
        .write()
        .await
        .pending
        .entry(batch_id)
        .or_default()
        .insert(player, entry);

    Ok(())
}
```

- [ ] **Step 3: Update get_active and get_pending**

```rust
pub async fn get_active(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
    self.slots
        .read()
        .await
        .active
        .get(&batch_id)
        .and_then(|m| m.get(&player))
        .cloned()
}

pub async fn get_pending(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
    self.slots
        .read()
        .await
        .pending
        .get(&batch_id)
        .and_then(|m| m.get(&player))
        .cloned()
}
```

- [ ] **Step 4: Update get_all_active_for_batch — the key optimization**

```rust
pub async fn get_all_active_for_batch(&self, batch_id: u64) -> Vec<SlottedBitmap> {
    self.slots
        .read()
        .await
        .active
        .get(&batch_id)
        .map(|m| m.values().cloned().collect())
        .unwrap_or_default()
}
```

This is now O(players_in_batch) instead of O(total_entries_across_all_batches).

- [ ] **Step 5: Update flip**

```rust
pub async fn flip(&self, batch_id: u64) {
    let mut guard = self.slots.write().await;

    // 1. Clear old active entries for this batch.
    guard.active.remove(&batch_id);

    // 2. Move pending entries for this batch into active.
    if let Some(pending_batch) = guard.pending.remove(&batch_id) {
        guard.active.insert(batch_id, pending_batch);
    }
}
```

This is simpler and more efficient than before — no filtering, no key collection, just HashMap remove + insert.

- [ ] **Step 6: Update cleanup_stale_pending**

```rust
pub async fn cleanup_stale_pending(&self, batch_id: u64, last_resolved_tick_id: u64) {
    let mut guard = self.slots.write().await;
    if let Some(batch_pending) = guard.pending.get_mut(&batch_id) {
        batch_pending.retain(|_, bm| bm.target_tick_id > last_resolved_tick_id);
        if batch_pending.is_empty() {
            guard.pending.remove(&batch_id);
        }
    }
}
```

- [ ] **Step 7: Update remove**

```rust
pub async fn remove(&self, batch_id: u64, player: Address) {
    let mut guard = self.slots.write().await;
    if let Some(m) = guard.pending.get_mut(&batch_id) {
        m.remove(&player);
        if m.is_empty() { guard.pending.remove(&batch_id); }
    }
    if let Some(m) = guard.active.get_mut(&batch_id) {
        m.remove(&player);
        if m.is_empty() { guard.active.remove(&batch_id); }
    }
}
```

- [ ] **Step 8: Update load_from_db**

```rust
pub async fn load_from_db(&self, pool: &PgPool) -> Result<(), BitmapStoreError> {
    let rows = sqlx::query_as::<_, (i64, String, Vec<u8>, String, String, i64, String)>(
        "SELECT batch_id, player, bitmap, bitmap_hash, slot, target_tick_id, config_hash
         FROM vision_bitmaps",
    )
    .fetch_all(pool)
    .await
    .map_err(BitmapStoreError::Db)?;

    let mut slots = self.slots.write().await;
    for (batch_id, player_str, bitmap, hash_str, slot, tick_id, config_hash_str) in rows {
        let player: Address = match player_str.parse() {
            Ok(a) => a,
            Err(_) => continue,
        };
        let hash: H256 = match hash_str.parse() {
            Ok(h) => h,
            Err(_) => continue,
        };
        let config_hash: H256 = match config_hash_str.parse() {
            Ok(h) => h,
            Err(_) => continue,
        };

        let entry = SlottedBitmap {
            player,
            batch_id: batch_id as u64,
            bitmap,
            hash,
            config_hash,
            target_tick_id: tick_id as u64,
            received_at: 0,
        };
        let bid = entry.batch_id;
        match slot.as_str() {
            "pending" => {
                slots.pending.entry(bid).or_default().insert(player, entry);
            }
            "active" => {
                slots.active.entry(bid).or_default().insert(player, entry);
            }
            _ => {}
        }
    }
    Ok(())
}
```

- [ ] **Step 9: Update persist_pending_to_db (no changes needed)**

This function takes individual `(batch_id, player)` params and writes to DB. The DB schema doesn't change. No modification needed.

- [ ] **Step 10: Update persist_flip_and_mark_resolved (no changes needed)**

This function operates on DB rows by `batch_id` filter. No in-memory structure access. No modification needed.

- [ ] **Step 11: Run existing tests**

Run: `cd oracle && cargo test --lib vision::bitmap_store`
Expected: All 6 existing tests pass (`test_two_slot_store_and_flip`, `test_flip_clears_previous_active`, `test_no_pending_means_sit_out`, `test_hash_mismatch_rejected`, `test_remove_clears_both_slots`, `test_cleanup_stale_pending`). The test API hasn't changed — same method signatures, same behavior, just different internal structure.

- [ ] **Step 12: Add a multi-batch isolation test**

Add to the `#[cfg(test)]` module:
```rust
#[tokio::test]
async fn test_get_all_active_only_returns_requested_batch() {
    let store = BitmapStore::new();
    let player = Address::random();
    let bm = vec![1u8];
    let hash = make_hash(&bm);

    // Store bitmaps in 3 different batches.
    for batch_id in [10u64, 20, 30] {
        store
            .store_pending(player, batch_id, bm.clone(), hash, zero_config(), 1)
            .await
            .unwrap();
        store.flip(batch_id).await;
    }

    // get_all_active_for_batch should only return the requested batch.
    let active_20 = store.get_all_active_for_batch(20).await;
    assert_eq!(active_20.len(), 1);
    assert_eq!(active_20[0].batch_id, 20);

    // Other batches unaffected.
    assert_eq!(store.get_all_active_for_batch(10).await.len(), 1);
    assert_eq!(store.get_all_active_for_batch(30).await.len(), 1);
    assert_eq!(store.get_all_active_for_batch(99).await.len(), 0);
}
```

- [ ] **Step 13: Run all tests**

Run: `cd oracle && cargo test --lib vision::bitmap_store`
Expected: All 7 tests pass (6 existing + 1 new).

- [ ] **Step 14: Commit**

```bash
git add oracle/src/vision/bitmap_store.rs
git commit -m "perf(vision): restructure BitmapStore to nested HashMap

get_all_active_for_batch scanned ALL entries across ALL batches to
find one batch's bitmaps — O(total_entries). At 10K batches x 100
players, that's 1M entries scanned per tick resolution per batch.

Now uses HashMap<u64, HashMap<Address, SlottedBitmap>> — O(1) batch
lookup, O(players_in_batch) iteration. flip() also simplified from
filter+collect+remove to remove+insert."
```

---

## Chunk 6: SSE Connection Limits (P0 — 1 day)

### Task 7: Add connection limits and rate limiting to SSE endpoints

**Files:**
- Modify: `data-node/src/api.rs:407-409` (route definitions)
- Modify: `data-node/src/api.rs` (SSE handler functions: `sse_system_status`, `sse_stream`, `sse_chain_events`)
- Possibly create: `data-node/src/sse_limiter.rs` (connection tracking)

**Context:** All three SSE endpoints (`/sse/stream`, `/sse/system-status`, `/sse/chain-events`) spawn an unbounded tokio task per connection with no per-IP limit, no authentication, no max connections. An attacker opens 10K connections — 240K RwLock acquisitions/second — starving legitimate tick resolution.

- [ ] **Step 1: Create a shared SSE connection limiter**

Create `data-node/src/sse_limiter.rs`. Uses `std::sync::Mutex` (not tokio/parking_lot) because the lock is never held across `.await`:

```rust
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

pub struct SseLimiter {
    total: AtomicUsize,
    per_ip: Mutex<HashMap<IpAddr, usize>>,
    max_total: usize,
    max_per_ip: usize,
}

impl SseLimiter {
    pub fn new(max_total: usize, max_per_ip: usize) -> Self {
        Self {
            total: AtomicUsize::new(0),
            per_ip: Mutex::new(HashMap::new()),
            max_total,
            max_per_ip,
        }
    }

    /// Try to acquire a connection slot. Returns None if limits exceeded.
    /// The returned SseGuard auto-decrements counters when dropped.
    pub fn try_acquire(self: &Arc<Self>, ip: IpAddr) -> Option<SseGuard> {
        if self.total.load(Ordering::Relaxed) >= self.max_total {
            return None;
        }
        let mut per_ip = self.per_ip.lock().unwrap();
        let count = per_ip.entry(ip).or_insert(0);
        if *count >= self.max_per_ip {
            return None;
        }
        *count += 1;
        self.total.fetch_add(1, Ordering::Relaxed);
        Some(SseGuard {
            limiter: Arc::clone(self),
            ip,
        })
    }

    pub fn active_connections(&self) -> usize {
        self.total.load(Ordering::Relaxed)
    }
}

/// RAII guard — decrements connection counters on drop.
/// IMPORTANT: This guard must be moved into the spawned SSE task
/// so it lives as long as the client connection, not just the handler.
pub struct SseGuard {
    limiter: Arc<SseLimiter>,
    ip: IpAddr,
}

impl Drop for SseGuard {
    fn drop(&mut self) {
        self.limiter.total.fetch_sub(1, Ordering::Relaxed);
        let mut per_ip = self.limiter.per_ip.lock().unwrap();
        if let Some(count) = per_ip.get_mut(&self.ip) {
            *count -= 1;
            if *count == 0 {
                per_ip.remove(&self.ip);
            }
        }
    }
}
```

No external crate dependencies needed — uses only `std::sync`.

- [ ] **Step 2b: Register the module**

Add to `data-node/src/main.rs` (after line 38, alongside other mod declarations):
```rust
mod sse_limiter;
```

Add to `data-node/src/api.rs` imports:
```rust
use crate::sse_limiter::{SseLimiter, SseGuard};
```

Without this, Rust doesn't know the file exists.

- [ ] **Step 3: Add SseLimiter to AppState**

In `api.rs` where `AppState` is defined, add:
```rust
pub sse_limiter: Arc<SseLimiter>,
```

Initialize it where AppState is constructed:
```rust
sse_limiter: Arc::new(SseLimiter::new(500, 10)), // 500 total, 10 per IP
```

- [ ] **Step 4: Add helper to extract client IP**

Add to `api.rs` (near the other helper functions):
```rust
use std::net::IpAddr;

fn extract_client_ip(headers: &HeaderMap) -> IpAddr {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(IpAddr::from([0, 0, 0, 0]))
}
```

- [ ] **Step 5: Change SSE handler return types and add connection check**

Each SSE handler (`sse_stream`, `sse_system_status`, `sse_chain_events`) needs two changes:

**a) Change each handler's signature.** All three currently lack `HeaderMap` and return `Sse<...>` directly. Update each:

For `sse_system_status` (line 5595):
```rust
// Before:
async fn sse_system_status(
    State(state): State<Arc<AppState>>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {

// After:
async fn sse_system_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, StatusCode> {
```

For `sse_stream` (line 5955):
```rust
// Before:
async fn sse_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<StreamQuery>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {

// After:
async fn sse_stream(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<StreamQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, StatusCode> {
```

For `sse_chain_events` (line 6649), same pattern — add `headers: HeaderMap` and wrap return in `Result`.

**b) Add connection check at the top of each handler**, BEFORE `tokio::spawn`:
```rust
let ip = extract_client_ip(&headers);
let guard = state.sse_limiter.try_acquire(ip)
    .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
```

**c) Move the guard INTO the spawned task.** The guard must live as long as the client connection. If it stays in the handler function, it drops immediately when the handler returns (before the spawned task's loop). Move it into the closure:
```rust
tokio::spawn(async move {
    let _guard = guard; // guard lives until this task ends = client disconnects
    loop {
        // ... existing SSE polling loop unchanged ...
    }
});
```

**d) Wrap the final return** in `Ok(...)`:
```rust
// Before:
Sse::new(ReceiverStream::new(rx))

// After:
Ok(Sse::new(ReceiverStream::new(rx)))
```

- [ ] **Step 6: Verify it compiles**

Run: `cd data-node && cargo check`
Expected: Compiles. May need to adjust return types on SSE handlers.

- [ ] **Step 7: Commit**

```bash
git add data-node/src/sse_limiter.rs data-node/src/api.rs data-node/src/main.rs
git commit -m "fix(data-node): add SSE connection limits — 500 total, 10 per IP

All SSE endpoints spawned unbounded tokio tasks with no limits. An
attacker could open 10K connections and starve tick resolution via
RwLock contention. Now enforces 500 max total + 10 per IP with RAII
guard that auto-decrements on disconnect."
```

---

## Execution Notes

**Deploy order:** All oracle changes (Tasks 1, 3, 4, 5, 6) can be batched into a single oracle rebuild. Data-node changes (Tasks 2, 7) are a separate rebuild.

**Restart coordination:**
1. Deploy data-node changes first (Tasks 2 + 7) — zero risk, additive only
2. Deploy oracle changes (Tasks 1 + 3 + 4 + 5 + 6) — requires coordinated restart of all 3 oracles

**DB migration (Task 5):** The `next_tick_duration` column must be added to `vision_batches` BEFORE deploying the oracle. The column is nullable, so the ALTER TABLE is backward-compatible — old code ignores it, new code reads it.

- **Local dev:** Add to `start.sh` after existing migrations: `psql -d index_prices -f oracle/migrations/005_add_next_tick_duration.sql`
- **Testnet:** `ssh index-maker/prod/be` then `psql -d index_prices -c "ALTER TABLE vision_batches ADD COLUMN IF NOT EXISTS next_tick_duration BIGINT;"`

Run the migration BEFORE restarting oracles.

**Rollback:** All changes are backward-compatible. If any oracle change causes issues, revert the commit and restart. The `next_tick_duration` column is additive and nullable — old code ignores it.

**Testing on testnet:** After deploying, verify:
- Consensus rounds don't accumulate (check oracle logs for "GC'd stale tick consensus rounds")
- Balance updates survive oracle restart (kill an oracle mid-tick, restart, verify balances match across oracles)
- SSE connections are capped (open 11 connections from one IP, verify 11th is rejected)
- Broadcast channel doesn't lag (check WebSocket client for `RecvError::Lagged` — should be gone)
