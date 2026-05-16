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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::LazyLock;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use super::broadcast::{PriceBroadcast, PriceBroadcastHub, SourcePriceBatch};

/// Maximum rows per batched INSERT statement.
/// Runtime-configurable via WRITE_CHANNEL_BATCH_SIZE (default: 500).
static BATCH_SIZE: LazyLock<usize> = LazyLock::new(|| {
    let size = std::env::var("WRITE_CHANNEL_BATCH_SIZE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(500);
    // Runtime guard: BATCH_SIZE * columns must fit in PostgreSQL's 65535 bind limit.
    // market_prices has 10 columns, so BATCH_SIZE * 10 must be <= 65535.
    assert!(
        size * 10 <= 65_535,
        "WRITE_CHANNEL_BATCH_SIZE={size} exceeds PostgreSQL bind limit (max 6553)"
    );
    size
});

/// How often to flush even if batch isn't full (seconds).
/// Runtime-configurable via WRITE_CHANNEL_FLUSH_INTERVAL_SECS (default: 2).
static FLUSH_INTERVAL_SECS: LazyLock<u64> = LazyLock::new(|| {
    std::env::var("WRITE_CHANNEL_FLUSH_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2)
});

/// Channel capacity — try_send drops on full instead of blocking.
/// Runtime-configurable via WRITE_CHANNEL_CAPACITY (default: 10000).
static CHANNEL_CAPACITY: LazyLock<usize> = LazyLock::new(|| {
    std::env::var("WRITE_CHANNEL_CAPACITY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10_000)
});

/// Phase 1 of the storage redesign. When `USE_NEW_STORAGE=1`, every batch
/// inserted into `market_prices` is also mirrored to the hypertable
/// `market_prices_v2`. The dual write runs best-effort — a v2 failure logs
/// at warn but does not poison the primary path. Reads stay on the old
/// table for the entirety of phase 1.
static USE_NEW_STORAGE: LazyLock<bool> = LazyLock::new(|| {
    matches!(
        std::env::var("USE_NEW_STORAGE").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE") | Ok("yes")
    )
});

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

/// Shared liveness flag — true while BatchWriter is running.
/// AppState holds a clone; health endpoint reads it.
pub type WriterAlive = Arc<AtomicBool>;

/// Create a (sender, receiver, alive_flag) triple for the write channel.
pub fn channel() -> (PriceWriteChannel, mpsc::Receiver<WriteMsg>, WriterAlive) {
    let (tx, rx) = mpsc::channel(*CHANNEL_CAPACITY);
    let alive = Arc::new(AtomicBool::new(false));
    (PriceWriteChannel { tx }, rx, alive)
}

/// Max chunks to process per retry tick. Prevents retry storms from blocking
/// the writer for minutes when retry_buffer is full (50k rows = 100 chunks).
const MAX_RETRY_CHUNKS_PER_TICK: usize = 5;

/// Dedicated writer task that drains the channel and flushes batched INSERTs.
pub struct BatchWriter {
    pool: PgPool,
    rx: mpsc::Receiver<WriteMsg>,
    broadcast_hub: Arc<PriceBroadcastHub>,
    alive: WriterAlive,
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
        alive: WriterAlive,
    ) -> Self {
        Self {
            pool,
            rx,
            broadcast_hub,
            alive,
            retry_buffer: VecDeque::new(),
            retry_buffer_rows: 0,
            latest_retry_buffer: VecDeque::new(),
            latest_retry_rows: 0,
        }
    }

    /// Run the batch writer loop forever.
    pub async fn run(mut self) {
        info!("[BatchWriter] Started — draining price channel");
        self.alive.store(true, Ordering::SeqCst);

        let mut buffer: Vec<PriceRow> = Vec::with_capacity(*BATCH_SIZE * 2);
        let mut flush_interval = tokio::time::interval(
            std::time::Duration::from_secs(*FLUSH_INTERVAL_SECS),
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
                            if buffer.len() >= *BATCH_SIZE {
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
                            self.alive.store(false, Ordering::SeqCst);
                            return;
                        }
                    }
                }
            }
        }
    }

    /// Final drain on shutdown — process all retries without per-tick limit.
    async fn retry_all_remaining(&mut self) {
        while let Some((chunk, _attempt)) = self.retry_buffer.pop_front() {
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
        while buffer.len() >= *BATCH_SIZE {
            let chunk: Vec<PriceRow> = buffer.drain(..*BATCH_SIZE).collect();
            total += chunk.len();
            match self.insert_history_batch(&chunk).await {
                Ok(n) => {
                    inserted += n;
                    // Broadcast first (borrows only), then move into retry if latest fails
                    self.broadcast_prices(&chunk);
                    if let Err(e) = self.update_latest_cache(&chunk).await {
                        warn!("[BatchWriter] Latest cache upsert failed ({} rows), queuing retry: {:?}", chunk.len(), e);
                        self.push_to_latest_retry(chunk);
                    }
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
                    self.broadcast_prices(&chunk);
                    if let Err(e) = self.update_latest_cache(&chunk).await {
                        warn!("[BatchWriter] Latest cache upsert failed ({} rows), queuing retry: {:?}", chunk.len(), e);
                        self.push_to_latest_retry(chunk);
                    }
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
    ///
    /// Phase 1 dual-write: when `USE_NEW_STORAGE=1`, mirror the same batch
    /// into `market_prices_v2` after the primary insert succeeds. The mirror
    /// is best-effort — a v2 failure logs at warn but does not poison the
    /// primary path. We do not want to lose price history while we wait for
    /// the new hypertable to prove itself.
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
        let inserted = result.rows_affected() as usize;

        if *USE_NEW_STORAGE {
            if let Err(e) = self.insert_history_batch_v2(rows).await {
                warn!(
                    "[BatchWriter] market_prices_v2 mirror failed ({} rows): {:?}",
                    rows.len(), e
                );
            }
        }

        Ok(inserted)
    }

    /// Phase 1 mirror writer for `market_prices_v2` (TimescaleDB hypertable).
    /// Same row shape as `market_prices` minus the BIGSERIAL id — the
    /// hypertable's natural ordering is `fetched_at` and the (source,
    /// asset_id, fetched_at) tuple is identifying enough for the dedup
    /// contract phase 2 introduces.
    async fn insert_history_batch_v2(&self, rows: &[PriceRow]) -> Result<(), sqlx::Error> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut qb = sqlx::QueryBuilder::new(
            "INSERT INTO market_prices_v2 (asset_id, source, symbol, value, prev_close, change_pct, volume_24h, market_cap, fetched_at, created_at) "
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
                .push_bind(row.fetched_at);
        });

        qb.build().execute(&self.pool).await?;
        Ok(())
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
