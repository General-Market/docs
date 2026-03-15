# Data Node Resilience Implementation Plan (v5 — final, post 4 rounds of security review)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make data-node self-healing — sources recover from failures, DB writes batch through a channel, no more pool starvation or silent deaths.

**Architecture:** All 75+ sync engines stop writing to DB directly. They send prices into a bounded mpsc channel. A dedicated BatchWriter drains the channel and flushes batched INSERTs. History table gets ALL rows (no dedup); latest cache deduplicates with unconditional overwrite for price fields (COALESCE only for `category`/`name` from joined asset table). Sync engines gain circuit breakers, exponential backoff, and in-memory price caches for `change_pct` computation. A panic-catching wrapper auto-restarts crashed sources. Startup is staggered.

**Tech Stack:** Rust, tokio (mpsc, spawn, select), sqlx (PgPool, QueryBuilder), rust_decimal, chrono

**Security review fixes incorporated (v1 round):**
- C1: BatchWriter death detected via `is_closed()` → sources propagate error
- C2: `try_send()` instead of blocking `send()` — non-blocking channel writes
- H1: No dedup on `market_prices` INSERT (append-only history)
- H3: `fetched==0` only feeds error_tracker, NOT circuit breaker
- H4: Force-sync only resets circuit breaker on actual success
- H5: Retry failed DB inserts up to 3× before dropping
- H6: Pool size 30 + `acquire_timeout(5s)`
- H8: `biased;` select! with flush timer first
- H9: `spawn_resilient` outer loop protected by inner `tokio::spawn`
- H11: Log warning on latest cache upsert failure

**Security review fixes incorporated (v2 round):**
- NEW-C1: `try_send()` returns `SendResult` tri-state enum `{Sent, Full, WriterDead}`
- NEW-C2: `flush()` never sleeps. Failed chunks go to `retry_buffer`.
- NEW-H2: `classify_anyhow_for_cb` uses `downcast_ref::<SourceError>()` first
- NEW-H3: Removed H10 pre-open check (error_tracker in-memory, no-op on restart)
- NEW-H4: Store BatchWriter `JoinHandle`. Drop sender before shutdown. Await with 5s timeout.
- NEW-H5: Unconditional overwrite for price fields. COALESCE only for `category`/`name`.
- NEW-H6: `spawn_resilient` resets `restart_count` after 5 min healthy runtime.
- NEW-H7: `WriterDead` variant in `ErrorCategory`.
- NEW-H8: Compile-time assert guards bind count.

**Security review fixes incorporated (v3 round):**
- R3-C1: Cap `retry_buffer` at `MAX_RETRY_BUFFER_ROWS` (50,000). Drop oldest when full. Prevents OOM under sustained DB failure.
- R3-C2: `flush_interval.set_missed_tick_behavior(MissedTickBehavior::Delay)`. Prevents biased select! from starving channel reads when flushes take >2s.
- R3-H1: In-memory `last_sent_values: HashMap<String, Decimal>` per SyncEngine for `change_pct` computation. Updated on `SendResult::Sent`, not on `Full`/`WriterDead`. Eliminates stale change_pct from channel lag. Seeded from DB on startup.
- R3-H2: Batch `sync_assets()` with `QueryBuilder::push_values` (1 query instead of N individual inserts). Reduces connection hold time from O(N) queries to O(1).
- R3-H3: `spawn_resilient` checks `write_channel.is_closed()` before restart. If dead, exit loop — no zombie restart cycles.
- R3-H4: `update_latest_cache` failures queued in `latest_retry_buffer` and retried on next tick. Prevents stale latest prices.
- R3-H5: `spawn_resilient` uses `restart_count.saturating_sub(1)` after 5 min healthy instead of `= 0`. Gentler decay prevents rapid-panic sources from burning pool connections.

**Security review fixes incorporated (v4 round):**
- R4-1: Cap `latest_retry_buffer` same as `retry_buffer` (MAX_RETRY_BUFFER_ROWS). Move chunks instead of clone to avoid doubling peak memory.
- R4-2: Cancellation-safe `flush()` — process chunks in-place from buffer instead of drain-then-iterate. Unprocessed rows survive cancellation.
- R4-3: Incremental retry processing — max 5 chunks per tick to prevent retry storms from blocking the writer for minutes.
- R4-4: `VecDeque` for `retry_buffer` — `pop_front()` is O(1) vs `Vec::remove(0)` O(n).
- R4-5: Add `WriterDead` variant to `SourceError` enum. Use `bail!(SourceError::WriterDead)` instead of string. `classify_anyhow_for_cb` checks `write_channel.is_closed()` instead of string matching for channel-closed.
- R4-6: Skip broadcast for retried chunks — retried data is stale, broadcasting it causes phantom price movements on WebSocket.
- R4-7: Record `SendResult::Full` in error_tracker as warning so health endpoint shows backpressure visibility.

---

## File Structure

| File | Role |
|------|------|
| `src/market_data/write_channel.rs` | **NEW** — WriteMsg, SendResult, PriceWriteChannel, BatchWriter |
| `src/market_data/mod.rs` | Add `pub mod write_channel` + re-export |
| `src/market_data/sync_engine.rs` | Circuit breaker, backoff, stagger, write channel, in-memory price cache |
| `src/market_data/scheduled_sync_engine.rs` | Same resilience changes |
| `src/market_data/sources/error.rs` | Fix HalfOpen to block concurrent probes |
| `src/market_data/error_tracker.rs` | Add `WriterDead` variant to `ErrorCategory` |
| `src/db.rs` | Pool size 5 → 30 + acquire_timeout |
| `src/main.rs` | Create channel, spawn BatchWriter, panic-catching spawn wrapper, graceful shutdown |

---

## Chunk 1: Write Channel + DB Pool

### Task 1: Create write_channel.rs

**Files:**
- Create: `src/market_data/write_channel.rs`

- [ ] **Step 1: Create the write channel module**

```rust
// src/market_data/write_channel.rs
//! Batched write channel for market data prices.
//!
//! All sync engines send prices here instead of writing to DB directly.
//! BatchWriter drains the channel, flushes batched INSERTs for history,
//! deduplicates for the latest cache, and broadcasts to WebSocket.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use super::broadcast::{PriceBroadcast, PriceBroadcastHub, SourcePriceBatch};

/// Maximum rows per batched INSERT statement
const BATCH_SIZE: usize = 500;

/// Compile-time guard: BATCH_SIZE * columns must fit in PostgreSQL's 65535 bind limit.
/// market_prices has 10 columns, so BATCH_SIZE * 10 must be <= 65535.
const _: () = assert!(BATCH_SIZE * 10 <= 65_535);

/// How often to flush even if batch isn't full (seconds)
const FLUSH_INTERVAL_SECS: u64 = 2;

/// Channel capacity — try_send drops on full instead of blocking
const CHANNEL_CAPACITY: usize = 10_000;

/// Max retries for a failed DB batch before dropping
const MAX_INSERT_RETRIES: u32 = 3;

/// Max total rows in retry_buffer. Prevents OOM under sustained DB failure.
/// At ~200 bytes/row, 50k rows ≈ 10 MB — bounded and predictable.
const MAX_RETRY_BUFFER_ROWS: usize = 50_000;

/// A price row ready for DB insertion (pre-computed change_pct and prev_close)
#[derive(Debug, Clone)]
pub struct PriceRow {
    pub asset_id: String,
    pub source: String,
    pub symbol: String,
    pub value: Decimal,
    pub prev_close: Option<Decimal>,
    pub change_pct: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub fetched_at: DateTime<Utc>,
}

/// Message sent from sync engines to the batch writer
#[derive(Debug)]
pub enum WriteMsg {
    /// A batch of prices from one source sync cycle
    Prices(Vec<PriceRow>),
}

/// Result of try_send — tri-state so callers can distinguish
/// "sent OK" from "dropped because full" from "writer is dead".
#[derive(Debug, PartialEq)]
pub enum SendResult {
    /// Message accepted by the channel
    Sent,
    /// Channel is full — batch was dropped. Source should NOT record this as success.
    Full,
    /// Channel is closed — BatchWriter is dead. Source should bail and trip circuit breaker.
    WriterDead,
}

/// Cloneable sender handle — each sync engine gets one
#[derive(Clone)]
pub struct PriceWriteChannel {
    tx: mpsc::Sender<WriteMsg>,
}

impl PriceWriteChannel {
    /// Try to send a batch of prices. Non-blocking.
    /// Returns SendResult so callers can react appropriately:
    /// - Sent: all good, record as success
    /// - Full: batch dropped, do NOT record as success (source retries next cycle)
    /// - WriterDead: channel closed, caller should bail!() to trip circuit breaker
    pub fn try_send(&self, prices: Vec<PriceRow>) -> SendResult {
        if prices.is_empty() {
            return SendResult::Sent;
        }
        match self.tx.try_send(WriteMsg::Prices(prices)) {
            Ok(()) => SendResult::Sent,
            Err(mpsc::error::TrySendError::Full(_)) => {
                warn!("[WriteChannel] Channel full — dropping batch. BatchWriter may be overloaded.");
                SendResult::Full
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                error!("[WriteChannel] Channel closed — BatchWriter is dead!");
                SendResult::WriterDead
            }
        }
    }

    /// Check if the channel is closed (BatchWriter died)
    pub fn is_closed(&self) -> bool {
        self.tx.is_closed()
    }
}

/// Create a (sender, receiver) pair for the write channel
pub fn channel() -> (PriceWriteChannel, mpsc::Receiver<WriteMsg>) {
    let (tx, rx) = mpsc::channel(CHANNEL_CAPACITY);
    (PriceWriteChannel { tx }, rx)
}

/// Max chunks to process per retry tick. Prevents retry storms from blocking
/// the writer for minutes when retry_buffer is full (50k rows = 100 chunks).
const MAX_RETRY_CHUNKS_PER_TICK: usize = 5;

/// Dedicated writer task that drains the channel and flushes batched INSERTs.
pub struct BatchWriter {
    pool: PgPool,
    rx: mpsc::Receiver<WriteMsg>,
    broadcast_hub: Arc<PriceBroadcastHub>,
    /// R4-4: VecDeque for O(1) pop_front eviction
    retry_buffer: VecDeque<(Vec<PriceRow>, u32)>,
    /// Total rows currently in retry_buffer (for cap enforcement)
    retry_buffer_rows: usize,
    /// Failed latest-cache chunks awaiting retry (capped same as retry_buffer)
    latest_retry_buffer: VecDeque<Vec<PriceRow>>,
    /// Total rows in latest_retry_buffer
    latest_retry_rows: usize,
}

impl BatchWriter {
    pub fn new(
        pool: PgPool,
        rx: mpsc::Receiver<WriteMsg>,
        broadcast_hub: Arc<PriceBroadcastHub>,
    ) -> Self {
        Self {
            pool,
            rx,
            broadcast_hub,
            retry_buffer: VecDeque::new(),
            retry_buffer_rows: 0,
            latest_retry_buffer: VecDeque::new(),
            latest_retry_rows: 0,
        }
    }

    /// Run the batch writer loop forever.
    pub async fn run(mut self) {
        info!("[BatchWriter] Started — draining price channel");
        let mut buffer: Vec<PriceRow> = Vec::with_capacity(BATCH_SIZE * 2);
        let mut flush_interval = tokio::time::interval(
            std::time::Duration::from_secs(FLUSH_INTERVAL_SECS),
        );
        // R3-C2: Delay mode prevents overdue ticks from accumulating and starving recv()
        flush_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            // biased; ensures flush timer is checked first, preventing unbounded buffer growth.
            // MissedTickBehavior::Delay ensures the timer only fires once per FLUSH_INTERVAL_SECS
            // even if the flush took longer than 2s, so recv() gets a fair turn.
            tokio::select! {
                biased;

                // Periodic flush — checked first to bound buffer size
                _ = flush_interval.tick() => {
                    if !buffer.is_empty() {
                        self.flush(&mut buffer).await;
                    }
                    // R4-3: Incremental retry — max 5 chunks per tick
                    self.retry_failed_history_chunks().await;
                    self.retry_failed_latest_chunks().await;
                }

                // Drain messages from the channel
                msg = self.rx.recv() => {
                    match msg {
                        Some(WriteMsg::Prices(rows)) => {
                            buffer.extend(rows);
                            // Flush immediately if buffer is large enough
                            if buffer.len() >= BATCH_SIZE {
                                self.flush(&mut buffer).await;
                            }
                        }
                        None => {
                            // Channel closed — flush remaining and exit
                            if !buffer.is_empty() {
                                info!("[BatchWriter] Channel closed, flushing {} remaining rows", buffer.len());
                                self.flush(&mut buffer).await;
                            }
                            // Final retry attempt (all remaining, no per-tick limit)
                            self.retry_all_remaining().await;
                            info!("[BatchWriter] Channel closed, exiting");
                            return;
                        }
                    }
                }
            }
        }
    }

    /// Final drain on shutdown — process all retries without per-tick limit.
    async fn retry_all_remaining(&mut self) {
        while let Some((chunk, attempt)) = self.retry_buffer.pop_front() {
            self.retry_buffer_rows -= chunk.len();
            if let Err(e) = self.insert_history_batch(&chunk).await {
                error!("[BatchWriter] Final retry failed ({} rows lost): {:?}", chunk.len(), e);
            }
            // Latest cache on shutdown — best effort
            let _ = self.update_latest_cache(&chunk).await;
        }
        while let Some(chunk) = self.latest_retry_buffer.pop_front() {
            self.latest_retry_rows -= chunk.len();
            let _ = self.update_latest_cache(&chunk).await;
        }
    }

    /// R4-3: Retry max MAX_RETRY_CHUNKS_PER_TICK history chunks per tick.
    /// Prevents retry storms from blocking the writer for minutes.
    async fn retry_failed_history_chunks(&mut self) {
        if self.retry_buffer.is_empty() {
            return;
        }

        let mut processed = 0usize;
        while processed < MAX_RETRY_CHUNKS_PER_TICK {
            let Some((chunk, attempt)) = self.retry_buffer.pop_front() else { break };
            self.retry_buffer_rows -= chunk.len();
            processed += 1;

            match self.insert_history_batch(&chunk).await {
                Ok(n) => {
                    info!("[BatchWriter] Retry succeeded: {} rows inserted (attempt {})", n, attempt + 1);
                    // R4-6: No broadcast for retried data — it's stale
                    // R4-1: Move into latest_retry_buffer (no clone)
                    self.push_to_latest_retry(chunk);
                }
                Err(e) => {
                    if attempt + 1 >= MAX_INSERT_RETRIES {
                        error!(
                            "[BatchWriter] History insert DROPPED after {} retries ({} rows lost): {:?}",
                            MAX_INSERT_RETRIES, chunk.len(), e
                        );
                    } else {
                        self.push_to_retry_buffer(chunk, attempt + 1);
                    }
                }
            }
        }
    }

    /// Retry previously failed latest-cache updates. Max 5 per tick.
    async fn retry_failed_latest_chunks(&mut self) {
        if self.latest_retry_buffer.is_empty() {
            return;
        }

        let mut processed = 0usize;
        while processed < MAX_RETRY_CHUNKS_PER_TICK {
            let Some(chunk) = self.latest_retry_buffer.pop_front() else { break };
            self.latest_retry_rows -= chunk.len();
            processed += 1;

            if let Err(e) = self.update_latest_cache(&chunk).await {
                warn!("[BatchWriter] Latest cache retry failed ({} rows): {:?}", chunk.len(), e);
                // Don't re-queue forever — latest cache will self-correct on next successful sync
            }
        }
    }

    /// R4-4: Push a failed chunk to retry_buffer (VecDeque), respecting the cap.
    fn push_to_retry_buffer(&mut self, chunk: Vec<PriceRow>, attempt: u32) {
        let chunk_rows = chunk.len();
        // R3-C1: Cap retry_buffer to prevent OOM under sustained DB failure
        while self.retry_buffer_rows + chunk_rows > MAX_RETRY_BUFFER_ROWS {
            if let Some((dropped, dropped_attempt)) = self.retry_buffer.pop_front() {
                warn!(
                    "[BatchWriter] Retry buffer full — dropping oldest chunk ({} rows, attempt {}) to make room",
                    dropped.len(), dropped_attempt
                );
                self.retry_buffer_rows -= dropped.len();
            } else {
                break;
            }
        }
        self.retry_buffer_rows += chunk_rows;
        self.retry_buffer.push_back((chunk, attempt));
    }

    /// R4-1: Push to latest_retry_buffer with cap enforcement. Move, not clone.
    fn push_to_latest_retry(&mut self, chunk: Vec<PriceRow>) {
        let chunk_rows = chunk.len();
        while self.latest_retry_rows + chunk_rows > MAX_RETRY_BUFFER_ROWS {
            if let Some(dropped) = self.latest_retry_buffer.pop_front() {
                self.latest_retry_rows -= dropped.len();
            } else {
                break;
            }
        }
        self.latest_retry_rows += chunk_rows;
        self.latest_retry_buffer.push_back(chunk);
    }

    /// R4-2: Cancellation-safe flush. Processes chunks in-place from buffer.
    /// Unprocessed rows remain in buffer if the future is cancelled.
    async fn flush(&mut self, buffer: &mut Vec<PriceRow>) {
        if buffer.is_empty() {
            return;
        }

        let mut total = 0usize;
        let mut inserted = 0usize;

        // Process BATCH_SIZE chunks from the front of buffer, leaving remainder in place
        while buffer.len() >= BATCH_SIZE {
            let chunk: Vec<PriceRow> = buffer.drain(..BATCH_SIZE).collect();
            total += chunk.len();
            match self.insert_history_batch(&chunk).await {
                Ok(n) => {
                    inserted += n;
                    if let Err(e) = self.update_latest_cache(&chunk).await {
                        warn!("[BatchWriter] Latest cache upsert failed ({} rows), queuing retry: {:?}", chunk.len(), e);
                        self.push_to_latest_retry(chunk.clone());
                    }
                    self.broadcast_prices(&chunk);
                }
                Err(e) => {
                    warn!(
                        "[BatchWriter] History insert failed (attempt 1/{}), queuing for retry: {:?}",
                        MAX_INSERT_RETRIES, e
                    );
                    self.push_to_retry_buffer(chunk, 1);
                }
            }
        }

        // Flush remaining partial batch (< BATCH_SIZE)
        if !buffer.is_empty() {
            let chunk: Vec<PriceRow> = buffer.drain(..).collect();
            total += chunk.len();
            match self.insert_history_batch(&chunk).await {
                Ok(n) => {
                    inserted += n;
                    if let Err(e) = self.update_latest_cache(&chunk).await {
                        warn!("[BatchWriter] Latest cache upsert failed ({} rows), queuing retry: {:?}", chunk.len(), e);
                        self.push_to_latest_retry(chunk.clone());
                    }
                    self.broadcast_prices(&chunk);
                }
                Err(e) => {
                    warn!(
                        "[BatchWriter] History insert failed (attempt 1/{}), queuing for retry: {:?}",
                        MAX_INSERT_RETRIES, e
                    );
                    self.push_to_retry_buffer(chunk, 1);
                }
            }
        }

        if total > 10 {
            info!("[BatchWriter] Flushed {} prices ({} inserted)", total, inserted);
        }
    }

    /// Broadcast prices to WebSocket subscribers. Only called for fresh data, NOT retries (R4-6).
    fn broadcast_prices(&self, rows: &[PriceRow]) {
        let mut source_prices: HashMap<String, Vec<PriceBroadcast>> = HashMap::new();
        for row in rows {
            source_prices
                .entry(row.source.clone())
                .or_default()
                .push(PriceBroadcast {
                    source: row.source.clone(),
                    asset_id: row.asset_id.clone(),
                    symbol: row.symbol.clone(),
                    value: row.value,
                    change_pct: row.change_pct,
                    volume_24h: row.volume_24h,
                    market_cap: row.market_cap,
                    fetched_at: row.fetched_at,
                });
        }
        for (source, prices) in source_prices {
            if !prices.is_empty() {
                let batch = Arc::new(SourcePriceBatch {
                    source: source.clone(),
                    prices,
                    timestamp: Utc::now(),
                });
                let hub = self.broadcast_hub.clone();
                let source_c = source.clone();
                tokio::spawn(async move {
                    let tx = hub.sender(&source_c).await;
                    let _ = tx.send(batch);
                });
            }
        }
    }

    /// Insert a batch of rows into market_prices (append-only history, no dedup).
    async fn insert_history_batch(&self, rows: &[PriceRow]) -> Result<usize, sqlx::Error> {
        if rows.is_empty() {
            return Ok(0);
        }

        let mut qb = sqlx::QueryBuilder::new(
            "INSERT INTO market_prices (asset_id, source, symbol, value, prev_close, change_pct, volume_24h, market_cap, fetched_at, created_at) "
        );

        qb.push_values(rows, |mut b, row| {
            b.push_bind(&row.asset_id)
                .push_bind(&row.source)
                .push_bind(&row.symbol)
                .push_bind(row.value)
                .push_bind(row.prev_close)
                .push_bind(row.change_pct)
                .push_bind(row.volume_24h)
                .push_bind(row.market_cap)
                .push_bind(row.fetched_at)
                .push_bind(row.fetched_at); // created_at = fetched_at
        });

        let result = qb.build().execute(&self.pool).await?;
        Ok(result.rows_affected() as usize)
    }

    /// Update market_prices_latest cache. Deduplicates by (source, asset_id) — last value wins.
    /// Returns Err so callers can queue for retry.
    /// Unconditional overwrite for price fields (match current behavior).
    /// COALESCE only for `name` and `category` (from asset join).
    async fn update_latest_cache(&self, rows: &[PriceRow]) -> Result<(), sqlx::Error> {
        if rows.is_empty() {
            return Ok(());
        }

        // Dedup for latest cache: last value per (source, asset_id) wins
        let mut deduped: HashMap<(&str, &str), &PriceRow> = HashMap::new();
        for row in rows {
            deduped.insert((row.source.as_str(), row.asset_id.as_str()), row);
        }
        let unique: Vec<&&PriceRow> = deduped.values().collect();

        let sources: Vec<&str> = unique.iter().map(|r| r.source.as_str()).collect();
        let asset_ids: Vec<&str> = unique.iter().map(|r| r.asset_id.as_str()).collect();
        let symbols: Vec<&str> = unique.iter().map(|r| r.symbol.as_str()).collect();
        let values: Vec<Decimal> = unique.iter().map(|r| r.value).collect();
        let change_pcts: Vec<Option<Decimal>> = unique.iter().map(|r| r.change_pct).collect();
        let volumes: Vec<Option<Decimal>> = unique.iter().map(|r| r.volume_24h).collect();
        let mcaps: Vec<Option<Decimal>> = unique.iter().map(|r| r.market_cap).collect();
        let fetched_ats: Vec<DateTime<Utc>> = unique.iter().map(|r| r.fetched_at).collect();

        sqlx::query(r#"
            INSERT INTO market_prices_latest (source, asset_id, symbol, name, value, change_pct, volume_24h, market_cap, category, fetched_at)
            SELECT
                u.source, u.asset_id, u.symbol,
                COALESCE(NULLIF(a.name, ''), ''),
                u.value, u.change_pct, u.volume_24h, u.market_cap,
                COALESCE(a.category, ''), u.fetched_at
            FROM UNNEST($1::text[], $2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[], $8::timestamptz[])
                AS u(source, asset_id, symbol, value, change_pct, volume_24h, market_cap, fetched_at)
            LEFT JOIN market_assets a ON a.source = u.source AND a.asset_id = u.asset_id
            ON CONFLICT (source, asset_id) DO UPDATE SET
                symbol = EXCLUDED.symbol,
                name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE market_prices_latest.name END,
                value = EXCLUDED.value,
                change_pct = EXCLUDED.change_pct,
                volume_24h = EXCLUDED.volume_24h,
                market_cap = EXCLUDED.market_cap,
                category = CASE WHEN EXCLUDED.category != '' THEN EXCLUDED.category ELSE market_prices_latest.category END,
                fetched_at = EXCLUDED.fetched_at
        "#)
            .bind(&sources)
            .bind(&asset_ids)
            .bind(&symbols)
            .bind(&values)
            .bind(&change_pcts)
            .bind(&volumes)
            .bind(&mcaps)
            .bind(&fetched_ats)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
```

- [ ] **Step 2: Register module in mod.rs**

In `src/market_data/mod.rs`, add:
```rust
pub mod write_channel;
```
And add to re-exports:
```rust
pub use write_channel::{PriceWriteChannel, PriceRow, SendResult};
```

- [ ] **Step 3: Compile check**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node 2>&1 | head -30`
Expected: Compiles (write_channel is standalone, no consumers yet)

- [ ] **Step 4: Commit**

```bash
git add data-node/src/market_data/write_channel.rs data-node/src/market_data/mod.rs
git commit -m "feat(data-node): add batched write channel for market data prices"
```

### Task 2: Increase DB pool size + acquire timeout

**Files:**
- Modify: `src/db.rs:7-11`

- [ ] **Step 1: Change pool config**

In `src/db.rs`, replace the pool creation:
```rust
// old
PgPoolOptions::new()
    .max_connections(5)
    .idle_timeout(std::time::Duration::from_secs(300))
    .connect(database_url)
    .await

// new
PgPoolOptions::new()
    .max_connections(30)
    .acquire_timeout(std::time::Duration::from_secs(5))
    .idle_timeout(std::time::Duration::from_secs(300))
    .connect(database_url)
    .await
```

- [ ] **Step 2: Commit**

```bash
git add data-node/src/db.rs
git commit -m "fix(data-node): increase DB pool to 30 connections + 5s acquire timeout"
```

### Task 3: Fix HalfOpen circuit breaker + add WriterDead error category

**Files:**
- Modify: `src/market_data/sources/error.rs`
- Modify: `src/market_data/error_tracker.rs`

- [ ] **Step 1: Add `WriterDead` variant to SourceError + derive Clone**

```rust
// R4-5: Add to SourceError enum:
#[derive(Debug, Clone)]
pub enum SourceError {
    // ... existing variants ...
    /// Write channel closed — BatchWriter is dead
    WriterDead,
}
```

Also add `WriterDead` to the Display impl and ensure SourceError implements `Clone`.

- [ ] **Step 2: Add probe_in_flight flag to CircuitBreaker**

```rust
// In CircuitBreaker struct, add field:
pub probe_in_flight: bool,

// In CircuitBreaker::new(), add:
probe_in_flight: false,

// In is_allowed(), replace the HalfOpen arm:
CircuitState::HalfOpen => {
    if self.probe_in_flight {
        false // Already probing, block further requests
    } else {
        self.probe_in_flight = true;
        true
    }
}

// In record_success(), add:
self.probe_in_flight = false;

// In record_failure(), add at the top:
self.probe_in_flight = false;

// Update Default impl to include probe_in_flight: false
```

- [ ] **Step 2: Add WriterDead to ErrorCategory in error_tracker.rs**

```rust
// In ErrorCategory enum, add:
/// Write channel closed — BatchWriter is dead, prices cannot be persisted
WriterDead,

// In Display impl, add:
ErrorCategory::WriterDead => write!(f, "writer_dead"),

// In classify_error(), add before the Transient fallback:
} else if lower.contains("channel closed") || lower.contains("batchwriter") || lower.contains("writer_dead") {
    ErrorCategory::WriterDead
}
```

- [ ] **Step 3: Update test for HalfOpen**

Add test that verifies second call to `is_allowed()` in HalfOpen returns false.

- [ ] **Step 4: Run tests**

Run: `cargo test -p data-node -- circuit_breaker 2>&1`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add data-node/src/market_data/sources/error.rs data-node/src/market_data/error_tracker.rs
git commit -m "fix(data-node): circuit breaker HalfOpen blocks concurrent probes + WriterDead error category"
```

---

## Chunk 2: Self-Healing Sync Engines

### Task 4: Add circuit breaker + backoff + stagger + write channel + price cache to SyncEngine

**Files:**
- Modify: `src/market_data/sync_engine.rs`

- [ ] **Step 1: Update SyncEngine struct and constructor**

Replace imports, struct, and `new()`:

```rust
use super::write_channel::{PriceRow, PriceWriteChannel, SendResult};
use super::sources::error::CircuitBreaker;
use std::sync::Mutex;

pub struct SyncEngine {
    pool: PgPool,
    source: Box<dyn MarketDataSource>,
    rate_limiter: SlidingWindowRateLimiter,
    sync_count: AtomicU64,
    retention_days: i64,
    broadcast_hub: Arc<PriceBroadcastHub>,
    write_channel: PriceWriteChannel,
    circuit_breaker: Mutex<CircuitBreaker>,
    /// R3-H1: In-memory cache of last-sent values per asset_id for change_pct computation.
    /// Avoids stale change_pct from channel lag (DB may not have flushed yet).
    /// Updated only on SendResult::Sent. Seeded from DB on startup.
    last_sent_values: Mutex<HashMap<String, Decimal>>,
}

impl SyncEngine {
    pub fn new(
        pool: PgPool,
        source: Box<dyn MarketDataSource>,
        broadcast_hub: Arc<PriceBroadcastHub>,
        write_channel: PriceWriteChannel,
    ) -> Self {
        let retention_days = std::env::var("MARKET_DATA_RETENTION_DAYS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_PRICE_HISTORY_DAYS);
        let rate_limiter = SlidingWindowRateLimiter::new(source.rate_limit_config());
        Self {
            pool,
            source,
            rate_limiter,
            sync_count: AtomicU64::new(0),
            retention_days,
            broadcast_hub,
            write_channel,
            circuit_breaker: Mutex::new(CircuitBreaker::new()),
            last_sent_values: Mutex::new(HashMap::new()),
        }
    }
}
```

- [ ] **Step 2: Add method to seed the in-memory price cache from DB**

Called once at startup, before the sync loop begins:

```rust
/// Seed the in-memory price cache from the latest DB values.
/// This is a one-time read to bootstrap change_pct computation.
async fn seed_price_cache(&self) -> Result<()> {
    let source_id = self.source.source_id();
    let rows: Vec<(String, Decimal)> = sqlx::query_as(
        "SELECT asset_id, value FROM market_prices_latest WHERE source = $1"
    )
    .bind(source_id)
    .fetch_all(&self.pool)
    .await?;

    let mut cache = self.last_sent_values.lock().unwrap_or_else(|e| e.into_inner());
    for (asset_id, value) in rows {
        cache.insert(asset_id, value);
    }
    info!("[{}] Price cache seeded with {} values", self.source.display_name(), cache.len());
    Ok(())
}
```

- [ ] **Step 3: Rewrite the `run()` method**

```rust
pub async fn run(&self) {
    let source_id = self.source.source_id();
    let name = self.source.display_name();
    let interval = self.source.sync_interval();
    let tracker = super::error_tracker::global();
    let force_trigger = super::sync_registry::global().register(source_id);

    info!("[{}] Starting sync engine (interval: {:?})", name, interval);
    tracker.record_started(source_id);

    // Staggered startup: random 0-30s delay to prevent thundering herd
    let stagger = std::time::Duration::from_millis(rand::random::<u64>() % 30_000);
    info!("[{}] Staggering startup by {:?}", name, stagger);
    tokio::time::sleep(stagger).await;

    // Seed in-memory price cache from DB (one-time read)
    if let Err(e) = self.seed_price_cache().await {
        warn!("[{}] Failed to seed price cache: {:?} — change_pct will use DB fallback", name, e);
    }

    // Initial asset sync
    info!("[{}] Running initial asset metadata sync...", name);
    match self.sync_assets().await {
        Ok(n) => info!("[{}] Initial asset sync: {} assets", name, n),
        Err(e) => error!("[{}] Initial asset sync failed: {:?}", name, e),
    }

    // Initial price sync
    info!("[{}] Running initial price sync...", name);
    let _ = self.do_price_sync(source_id, name).await;

    // Periodic sync with backoff
    let mut consecutive_failures: u32 = 0;
    let mut metadata_interval = tokio::time::interval(std::time::Duration::from_secs(3600));

    loop {
        // Compute effective interval with exponential backoff
        let backoff_multiplier = if consecutive_failures > 0 {
            let exp = 2u64.pow(consecutive_failures.min(5));
            exp.min(30)
        } else {
            1
        };
        let effective_interval = interval * backoff_multiplier as u32;
        let capped_interval = effective_interval.min(std::time::Duration::from_secs(1800));

        if consecutive_failures > 0 {
            warn!(
                "[{}] Backing off: {} consecutive failures, next sync in {:?}",
                name, consecutive_failures, capped_interval
            );
        }

        tokio::select! {
            _ = tokio::time::sleep(capped_interval) => {
                // Check circuit breaker (poison-safe)
                {
                    let mut cb = self.circuit_breaker.lock().unwrap_or_else(|e| e.into_inner());
                    if !cb.is_allowed() {
                        debug!("[{}] Circuit breaker open, skipping sync", name);
                        continue;
                    }
                }

                let count = self.sync_count.fetch_add(1, Ordering::Relaxed) + 1;

                match self.sync_prices().await {
                    Ok((updated, _errors, fetched, active)) => {
                        // H3: fetched==0 only goes to error_tracker, NOT circuit breaker
                        if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                            tracker.record_error(source_id, "API returned 0 prices — source may be broken");
                        } else if updated == 0 && fetched > 0 {
                            // NEW-C1: try_send returned Full — prices fetched but not written.
                            // R4-7: Record in error tracker for health endpoint visibility.
                            warn!("[{}] Sync #{}: fetched {} but channel full, not recording as success", name, count, fetched);
                            tracker.record_error(source_id, "Write channel full — prices dropped (backpressure)");
                        } else {
                            info!("[{}] Price sync #{}: {} updated", name, count, updated);
                            if fetched > 0 && active > 0 && (fetched as f64) < (active as f64 * 0.5) {
                                warn!("[{}] Partial data: {}/{} prices", name, fetched, active);
                            }
                            tracker.record_success(source_id);
                            consecutive_failures = 0;
                            self.circuit_breaker.lock().unwrap_or_else(|e| e.into_inner()).record_success();
                        }
                    }
                    Err(e) => {
                        error!("[{}] Price sync #{} failed: {:?}", name, count, e);
                        tracker.record_error(source_id, &format!("{:?}", e));
                        consecutive_failures += 1;
                        let source_err = classify_anyhow_for_cb(&e, &self.write_channel);
                        self.circuit_breaker.lock().unwrap_or_else(|e| e.into_inner()).record_failure(&source_err);
                    }
                }

                // Prune every 100 syncs
                if self.sync_count.load(Ordering::Relaxed) % 100 == 0 {
                    if let Err(e) = self.prune_old_prices().await {
                        warn!("[{}] Price pruning failed: {:?}", name, e);
                    }
                }
            }
            _ = metadata_interval.tick() => {
                info!("[{}] Refreshing asset metadata...", name);
                match self.sync_assets().await {
                    Ok(n) => info!("[{}] Asset metadata refresh: {} assets", name, n),
                    Err(e) => warn!("[{}] Asset metadata refresh failed: {:?}", name, e),
                }
            }
            _ = force_trigger.notified() => {
                info!("[{}] Force-sync triggered via admin API", name);
                let success = self.do_price_sync(source_id, name).await;
                if success {
                    consecutive_failures = 0;
                    self.circuit_breaker.lock().unwrap_or_else(|e| e.into_inner()).record_success();
                }
            }
        }
    }
}

/// Helper for initial and force-triggered syncs. Returns true on success.
async fn do_price_sync(&self, source_id: &str, name: &str) -> bool {
    let tracker = super::error_tracker::global();
    let count = self.sync_count.fetch_add(1, Ordering::Relaxed) + 1;
    match self.sync_prices().await {
        Ok((updated, _errors, fetched, active)) => {
            info!("[{}] Price sync #{}: {} updated", name, count, updated);
            if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                warn!("[{}] API returned 0 prices for {} active assets", name, active);
                tracker.record_error(source_id, "API returned 0 prices");
                false
            } else {
                tracker.record_success(source_id);
                true
            }
        }
        Err(e) => {
            error!("[{}] Price sync #{} failed: {:?}", name, count, e);
            tracker.record_error(source_id, &format!("{:?}", e));
            false
        }
    }
}
```

- [ ] **Step 4: Rewrite `sync_prices()` with SendResult + in-memory price cache**

Key changes vs v3:
- Uses `last_sent_values` for `change_pct` computation instead of DB LATERAL join
- Falls back to DB only on first sync (cache empty) — seeded by `seed_price_cache`
- Updates cache on `SendResult::Sent`, NOT on `Full` or `WriterDead`

```rust
async fn sync_prices(&self) -> Result<(usize, usize, usize, usize)> {
    let source_id = self.source.source_id();
    let sync_start = std::time::Instant::now();

    // Check if BatchWriter is alive
    if self.write_channel.is_closed() {
        return Err(super::sources::error::SourceError::WriterDead.into());
    }

    // Get active asset IDs (read-only)
    let asset_ids: Vec<String> = sqlx::query_scalar(
        "SELECT asset_id FROM market_assets WHERE source = $1 AND is_active = true ORDER BY symbol",
    )
    .bind(source_id)
    .fetch_all(&self.pool)
    .await?;

    let active_assets = asset_ids.len();
    if asset_ids.is_empty() {
        warn!("[{}] No active assets to sync", self.source.display_name());
        return Ok((0, 0, 0, 0));
    }

    // Rate-limit
    self.rate_limiter.wait_for_permit().await;

    let prices = self.source.fetch_prices(&asset_ids).await?;
    let fetched = prices.len();

    // R3-H1: Use in-memory cache for change detection + change_pct computation.
    // This avoids stale reads from DB when channel hasn't flushed yet.
    let cache = self.last_sent_values.lock().unwrap_or_else(|e| e.into_inner()).clone();

    let max_staleness = ChronoDuration::from_std(self.source.sync_interval() * 6)
        .unwrap_or(ChronoDuration::minutes(30));
    let hundred = rust_decimal::Decimal::from(100);
    let mut rows_to_write: Vec<PriceRow> = Vec::new();
    let mut skipped = 0usize;

    for price in &prices {
        let prev_value = cache.get(&price.asset_id).copied();

        // Change detection: always insert if no cache entry, or if value changed
        let should_insert = match prev_value {
            Some(pv) => pv != price.value || self.source.skips_when_unchanged(),
            None => true,
        };

        if !should_insert {
            skipped += 1;
            continue;
        }

        let change_pct = price.change_pct.or_else(|| {
            prev_value.and_then(|pv| {
                if !pv.is_zero() { Some((price.value - pv) / pv * hundred) } else { None }
            })
        });
        let prev_close = price.prev_close.or_else(|| prev_value);

        rows_to_write.push(PriceRow {
            asset_id: price.asset_id.clone(),
            source: source_id.to_string(),
            symbol: price.symbol.clone(),
            value: price.value,
            prev_close,
            change_pct,
            volume_24h: price.volume_24h,
            market_cap: price.market_cap,
            fetched_at: price.fetched_at,
        });
    }

    let updated = rows_to_write.len();

    // Send through write channel with tri-state result
    if !rows_to_write.is_empty() {
        // Collect values for cache update BEFORE sending (rows_to_write moves on Sent)
        let cache_updates: Vec<(String, Decimal)> = rows_to_write
            .iter()
            .map(|r| (r.asset_id.clone(), r.value))
            .collect();

        match self.write_channel.try_send(rows_to_write) {
            SendResult::Sent => {
                // Update in-memory cache only on successful send
                let mut cache = self.last_sent_values.lock().unwrap_or_else(|e| e.into_inner());
                for (asset_id, value) in cache_updates {
                    cache.insert(asset_id, value);
                }
            }
            SendResult::Full => {
                // Channel full — prices dropped. Return (0, 0, fetched, active) so
                // caller does NOT record this as success. Don't update cache.
                warn!("[{}] Write channel full, {} prices dropped (will retry next cycle)",
                    self.source.display_name(), updated);
                return Ok((0, 0, fetched, active_assets));
            }
            SendResult::WriterDead => {
                // BatchWriter is dead — bail to trigger circuit breaker
                return Err(super::sources::error::SourceError::WriterDead.into());
            }
        }
    }

    let total_elapsed = sync_start.elapsed();
    info!(
        "[{}] Sync complete: {} to write, {} skipped in {:.1}s",
        self.source.display_name(), updated, skipped, total_elapsed.as_secs_f64()
    );

    Ok((updated, 0, fetched, active_assets))
}
```

- [ ] **Step 5: Batch sync_assets() to reduce connection hold time**

Replace the per-asset individual INSERT loop with a single batched query:

```rust
async fn sync_assets(&self) -> Result<usize> {
    let source_id = self.source.source_id();
    let assets = self.source.fetch_assets().await?;
    let now = Utc::now();

    if assets.is_empty() {
        return Ok(0);
    }

    let active_ids: Vec<String> = assets.iter().map(|a| a.asset_id.clone()).collect();

    // R3-H2: Batched upsert — single query instead of N individual inserts.
    // Reduces connection hold time from O(N) to O(1).
    for chunk in assets.chunks(BATCH_SIZE) {
        let mut qb = sqlx::QueryBuilder::new(
            "INSERT INTO market_assets (asset_id, source, symbol, name, category, is_active, metadata, updated_at) "
        );
        qb.push_values(chunk, |mut b, asset| {
            b.push_bind(&asset.asset_id)
                .push_bind(source_id)
                .push_bind(&asset.symbol)
                .push_bind(&asset.name)
                .push_bind(&asset.category)
                .push_bind(true)
                .push_bind(&asset.metadata)
                .push_bind(now);
        });
        qb.push(
            " ON CONFLICT (source, asset_id) DO UPDATE SET \
              symbol = EXCLUDED.symbol, \
              name = EXCLUDED.name, \
              category = EXCLUDED.category, \
              is_active = true, \
              metadata = EXCLUDED.metadata, \
              updated_at = EXCLUDED.updated_at"
        );

        if let Err(e) = qb.build().execute(&self.pool).await {
            warn!("[{}] Batched asset upsert failed ({} assets): {:?}", self.source.display_name(), chunk.len(), e);
        }
    }

    // Deactivate assets from this source that are no longer in the active set
    if !active_ids.is_empty() {
        let deactivated = sqlx::query(
            r#"
            UPDATE market_assets
            SET is_active = false, updated_at = $3
            WHERE source = $1 AND is_active = true AND asset_id != ALL($2)
            "#,
        )
        .bind(source_id)
        .bind(&active_ids)
        .bind(now)
        .execute(&self.pool)
        .await;

        if let Ok(result) = deactivated {
            if result.rows_affected() > 0 {
                info!("[{}] Deactivated {} stale assets", self.source.display_name(), result.rows_affected());
            }
        }
    }

    Ok(assets.len())
}
```

Note: `BATCH_SIZE` here can reuse the constant from write_channel (500) or define a local one. 500 * 8 columns = 4000 binds, well under 65535.

- [ ] **Step 6: Add classify_anyhow_for_cb with downcast + is_closed() strategy**

R4-5: Uses `downcast_ref` first, then checks `write_channel.is_closed()` for WriterDead
(no string matching for "channel closed" which could false-positive on API error messages).

```rust
/// Classify an anyhow::Error into a SourceError for the circuit breaker.
/// R4-5: Uses downcast_ref first. Checks is_closed() for WriterDead instead of string matching.
fn classify_anyhow_for_cb(
    e: &anyhow::Error,
    write_channel: &PriceWriteChannel,
) -> super::sources::error::SourceError {
    // Try structured downcast first
    if let Some(source_err) = e.downcast_ref::<super::sources::error::SourceError>() {
        return source_err.clone();
    }

    // R4-5: Check actual channel state instead of string matching
    if write_channel.is_closed() {
        return super::sources::error::SourceError::WriterDead;
    }

    // Fallback: string matching for errors that don't use SourceError
    let msg = format!("{:?}", e).to_lowercase();
    if msg.contains("401") || msg.contains("403") || msg.contains("unauthorized") || msg.contains("forbidden") {
        super::sources::error::SourceError::AuthFailed(format!("{:?}", e))
    } else if msg.contains("429") || msg.contains("rate limit") {
        super::sources::error::SourceError::RateLimited(None)
    } else {
        super::sources::error::SourceError::Transient(format!("{:?}", e))
    }
}
```

Note: Requires adding `WriterDead` variant to `SourceError` enum in `error.rs` and `#[derive(Clone)]`. The `bail!()` calls in `sync_prices` should use `bail!(SourceError::WriterDead)` instead of string messages.

- [ ] **Step 7: Compile check**

Run: `cargo check -p data-node 2>&1 | head -40`
Expected: Errors in main.rs (constructor changed) — that's expected.

- [ ] **Step 8: Commit**

```bash
git add data-node/src/market_data/sync_engine.rs
git commit -m "feat(data-node): SyncEngine with circuit breaker, backoff, stagger, write channel, price cache"
```

### Task 5: Same resilience changes to ScheduledSyncEngine

**Files:**
- Modify: `src/market_data/scheduled_sync_engine.rs`

Apply identical pattern as Task 4:

- [ ] **Step 1: Update struct and constructor**

Add `write_channel: PriceWriteChannel`, `circuit_breaker: Mutex<CircuitBreaker>`, and `last_sent_values: Mutex<HashMap<String, Decimal>>` fields. Update `new()` to accept `PriceWriteChannel`. Use `unwrap_or_else(|e| e.into_inner())` for mutex.

- [ ] **Step 2: Add `seed_price_cache()` + call at top of `run()`**

Same as Task 4 Step 2. Seed from `market_prices_latest`.

- [ ] **Step 3: Add stagger at top of `run()`**

Random 0-30s sleep.

- [ ] **Step 4: Wire circuit breaker into fetch paths**

Check before normal fetch, burst fetch. H3: don't trip circuit breaker on fetched==0.

- [ ] **Step 5: Add backoff on consecutive failures**

```rust
let backoff_secs = if consecutive_failures > 0 {
    let exp = 2u64.pow(consecutive_failures.min(5));
    (60 * exp.min(30)).min(1800)
} else {
    60
};
tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
```

- [ ] **Step 6: Rewrite `sync_prices()` with SendResult tri-state + in-memory cache**

Same pattern as Task 4 Step 4: use `last_sent_values` cache, update only on `Sent`.

- [ ] **Step 7: Batch `sync_assets()` with QueryBuilder**

Same as Task 4 Step 5.

- [ ] **Step 8: Fix force-sync to only reset on success**

- [ ] **Step 9: Compile check**

Run: `cargo check -p data-node 2>&1 | head -40`

- [ ] **Step 10: Commit**

```bash
git add data-node/src/market_data/scheduled_sync_engine.rs
git commit -m "feat(data-node): ScheduledSyncEngine with circuit breaker, backoff, stagger, write channel, price cache"
```

---

## Chunk 3: Wire Everything in main.rs

### Task 6: Create write channel + BatchWriter + panic wrapper in main.rs

**Files:**
- Modify: `src/main.rs`

- [ ] **Step 1: Create write channel and spawn BatchWriter with JoinHandle**

After `broadcast_hub` creation (line ~356):

```rust
// Create batched write channel for all market data sources
let (price_writer, price_rx) = market_data::write_channel::channel();

// Spawn BatchWriter and store JoinHandle for graceful shutdown
let writer_handle: tokio::task::JoinHandle<()> = {
    let writer_pool = pool.clone();
    let writer_bh = broadcast_hub.clone();
    tokio::spawn(async move {
        let writer = market_data::write_channel::BatchWriter::new(writer_pool, price_rx, writer_bh);
        writer.run().await;
        tracing::error!("[BatchWriter] Exited");
    })
};
info!("BatchWriter started — all market data writes go through channel");
```

Note: BatchWriter cannot be wrapped in `spawn_resilient` because the `mpsc::Receiver` is consumed on first run. If BatchWriter dies, sources detect via `is_closed()` → circuit breakers trip → visible degradation. Admin must restart.

- [ ] **Step 2: Add panic-catching spawn helper with WriterDead check + gentle decay**

```rust
/// Spawn a source with panic recovery.
/// Inner tokio::spawn catches panics. Outer loop restarts with increasing delay.
/// R3-H3: Checks write channel before restart — exits if BatchWriter is dead.
/// R3-H5: Restart counter uses saturating_sub(1) after healthy runtime.
fn spawn_resilient<F, Fut>(
    name: &'static str,
    write_channel: PriceWriteChannel,
    make_fut: F,
)
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = ()> + Send + 'static,
{
    tokio::spawn(async move {
        let mut restart_count = 0u32;
        loop {
            // R3-H3: Don't restart if BatchWriter is dead — exit cleanly
            if write_channel.is_closed() {
                tracing::error!(
                    "[{}] BatchWriter is dead (channel closed), stopping restart loop",
                    name
                );
                return;
            }

            let start_time = tokio::time::Instant::now();
            let fut = make_fut();
            match tokio::spawn(fut).await {
                Ok(()) => {
                    tracing::warn!("[{}] Source exited normally, restarting", name);
                }
                Err(e) => {
                    tracing::error!(
                        "[{}] Source PANICKED (restart #{}): {}",
                        name, restart_count + 1, e
                    );
                }
            }

            // R3-H5: Gentle decay — subtract 1 if healthy >5 min, else increment
            let runtime = start_time.elapsed();
            if runtime > std::time::Duration::from_secs(300) {
                restart_count = restart_count.saturating_sub(1);
            } else {
                restart_count += 1;
            }

            // Increasing delay: 30s, 60s, 90s, ..., 300s max
            let delay_secs = 30u64 * (restart_count.min(10) as u64);
            tracing::warn!("[{}] Restarting in {}s (restart #{})", name, delay_secs, restart_count);
            tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
        }
    });
}
```

- [ ] **Step 3: Update all SyncEngine spawns**

For each source spawn (~75 occurrences), change:

```rust
// OLD pattern:
let pool_c = pool.clone();
let bh = broadcast_hub.clone();
tokio::spawn(async move {
    match SomeSource::from_env() {
        Ok(source) => {
            let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
            engine.run().await;
        }
        Err(e) => tracing::error!("init failed: {e}"),
    }
});

// NEW pattern:
{
    let pool_c = pool.clone();
    let bh = broadcast_hub.clone();
    let pw = price_writer.clone();
    spawn_resilient("source_id", pw.clone(), move || {
        let pool_c = pool_c.clone();
        let bh = bh.clone();
        let pw = pw.clone();
        async move {
            match SomeSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh, pw);
                    engine.run().await;
                }
                Err(e) => {
                    tracing::error!("init failed: {e}");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            }
        }
    });
}
```

Same for `ScheduledSyncEngine::new(pool_c, Box::new(source), bh, pw)`.

This is a mechanical search-and-replace across ~75 spawn blocks in main.rs.

- [ ] **Step 4: Add graceful shutdown for BatchWriter**

At the shutdown section of main.rs (before process exit):

```rust
// Graceful shutdown: drop the price_writer sender so BatchWriter can drain
// the channel and flush remaining rows before exiting.
drop(price_writer);
info!("Price writer sender dropped — BatchWriter draining...");

// Wait up to 5 seconds for BatchWriter to flush
match tokio::time::timeout(
    std::time::Duration::from_secs(5),
    writer_handle,
).await {
    Ok(Ok(())) => info!("BatchWriter drained successfully"),
    Ok(Err(e)) => error!("BatchWriter panicked during shutdown: {}", e),
    Err(_) => warn!("BatchWriter drain timed out after 5s — some data may be lost"),
}
```

Note: The clones (`pw = price_writer.clone()`) are moved into spawns. The original `price_writer` stays in the main scope for the drop.

- [ ] **Step 5: Compile check**

Run: `cargo check -p data-node 2>&1 | head -50`
Expected: Clean compilation

- [ ] **Step 6: Full build**

Run: `cargo build -p data-node 2>&1 | tail -5`
Expected: Success

- [ ] **Step 7: Run tests**

Run: `cargo test -p data-node 2>&1 | tail -20`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add data-node/src/main.rs
git commit -m "feat(data-node): wire write channel + panic recovery + graceful shutdown into all source spawns"
```

### Task 7: Final verification

- [ ] **Step 1: Full clean build**

Run: `cargo build -p data-node 2>&1`

- [ ] **Step 2: Run all tests**

Run: `cargo test -p data-node 2>&1`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(data-node): complete resilience overhaul v5

Write channel:
- BatchWriter with batched INSERTs (no per-row inserts)
- try_send() returns SendResult tri-state: Sent/Full/WriterDead
- Full → recorded in error_tracker for health visibility (not circuit breaker)
- WriterDead → SourceError::WriterDead trips circuit breaker immediately
- No dedup on history table (append-only); dedup only on latest cache
- Unconditional overwrite for price fields; COALESCE only for name/category
- VecDeque retry_buffer (O(1) eviction) capped at 50k rows
- latest_retry_buffer capped same, move not clone (no memory doubling)
- Incremental retry: max 5 chunks/tick (no retry storm blocking)
- Cancellation-safe flush: process chunks in-place from buffer
- No broadcast for retried data (stale prices)
- MissedTickBehavior::Delay prevents timer starvation
- Compile-time assert guards bind count vs BATCH_SIZE

Self-healing:
- Circuit breaker wired into sync loop (was defined but unused)
- HalfOpen blocks concurrent probes
- classify_anyhow_for_cb: downcast first, is_closed() for WriterDead
- fetched==0 only feeds error_tracker, NOT circuit breaker
- Force-sync only resets breaker on actual success
- Exponential backoff on consecutive failures (capped 30 min)
- spawn_resilient with gentle decay + WriterDead exit
- Mutex uses unwrap_or_else for poison safety

Data integrity:
- In-memory price cache per engine for change_pct (no stale DB reads)
- Cache seeded from DB on startup, updated only on SendResult::Sent
- Batched sync_assets() (single query vs N individual inserts)

Infrastructure:
- DB pool 5 → 30 with 5s acquire_timeout
- Staggered startup (random 0-30s) prevents thundering herd
- Graceful shutdown: drop sender, await BatchWriter drain with 5s timeout"
```

- [ ] **Step 4: Push**

```bash
git push mono main
```
