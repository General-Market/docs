//! Generic sync engine for any MarketDataSource
//!
//! Handles the sync loop: fetch assets, fetch prices, prune old data.
//! Source-agnostic — just needs a Box<dyn MarketDataSource>.
//!
//! Resilience features:
//! - Circuit breaker: trips after repeated failures, auto-recovers
//! - Exponential backoff: doubles interval on consecutive failures (capped 30 min)
//! - Staggered startup: random 0-30s delay prevents thundering herd
//! - Write channel: all DB writes go through PriceWriteChannel → BatchWriter
//! - In-memory price cache: change_pct computed from last-sent values, not stale DB

use anyhow::Result;
use chrono::{Duration as ChronoDuration, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tracing::{debug, error, info, warn};

use super::broadcast::{PriceBroadcast, PriceBroadcastHub, SourcePriceBatch};
use super::rate_limiter::SlidingWindowRateLimiter;
use super::sources::error::CircuitBreaker;
use super::write_channel::{PriceRow, PriceWriteChannel, SendResult};
use crate::market_data::traits::MarketDataSource;

/// Default: keep forever (365 days). These sources have no historical API,
/// so every data point is irreplaceable.
const DEFAULT_PRICE_HISTORY_DAYS: i64 = 365;

/// Max assets per batched upsert query (500 * 8 cols = 4000 binds, well under 65535)
const ASSET_BATCH_SIZE: usize = 500;

/// Generic market data sync engine
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
    /// Create a new sync engine for the given source
    pub fn new(
        pool: PgPool,
        source: Box<dyn MarketDataSource>,
        broadcast_hub: Arc<PriceBroadcastHub>,
        write_channel: PriceWriteChannel,
    ) -> Self {
        // Register batch strategy for the batch engine to read
        crate::batch_engine::register_strategy(source.source_id(), source.batch_strategy());

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

    /// Seed the in-memory price cache from the latest DB values.
    /// This is a one-time read to bootstrap change_pct computation.
    async fn seed_price_cache(&self) -> Result<()> {
        let source_id = self.source.source_id();
        let rows: Vec<(String, Decimal)> = sqlx::query_as(
            "SELECT asset_id, value FROM market_prices_latest WHERE source = $1",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cache = self
            .last_sent_values
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        for (asset_id, value) in rows {
            cache.insert(asset_id, value);
        }
        info!(
            "[{}] Price cache seeded with {} values",
            self.source.display_name(),
            cache.len()
        );
        Ok(())
    }

    /// Run the sync loop forever
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
            warn!(
                "[{}] Failed to seed price cache: {:?} — change_pct will use DB fallback",
                name, e
            );
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
        let mut metadata_interval =
            tokio::time::interval(std::time::Duration::from_secs(3600));

        loop {
            // Compute effective interval with exponential backoff
            let backoff_multiplier = if consecutive_failures > 0 {
                let exp = 2u64.pow(consecutive_failures.min(5));
                exp.min(30)
            } else {
                1
            };
            let effective_interval = interval * backoff_multiplier as u32;
            let capped_interval =
                effective_interval.min(std::time::Duration::from_secs(1800));

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
                        Ok((updated, _errors, fetched, active, channel_full)) => {
                            // H3: fetched==0 only goes to error_tracker, NOT circuit breaker
                            if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                                tracker.record_error(source_id, "API returned 0 prices — source may be broken");
                            } else if channel_full {
                                // Channel was actually full — prices fetched but dropped.
                                warn!("[{}] Sync #{}: fetched {} but channel full, not recording as success", name, count, fetched);
                                tracker.record_error(source_id, "Write channel full — prices dropped (backpressure)");
                            } else {
                                // Success: either prices were written, or all were skipped (unchanged).
                                // Both are healthy states — the source is alive and responding.
                                info!("[{}] Price sync #{}: {} updated, {} fetched", name, count, updated, fetched);
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
                        // Deactivate stale assets that haven't received a price in 7 days
                        if let Err(e) = self.deactivate_stale_assets().await {
                            warn!("[{}] Stale asset deactivation failed: {:?}", name, e);
                        }
                    }
                }
                _ = metadata_interval.tick() => {
                    info!("[{}] Refreshing asset metadata...", name);
                    match self.sync_assets().await {
                        Ok(n) => {
                            info!("[{}] Asset metadata refresh: {} assets", name, n);
                            // Run stale-asset sweep after metadata refresh: sync_assets()
                            // reactivates all config entries, this re-deactivates stale ones.
                            let _ = self.deactivate_stale_assets().await;
                        }
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
            Ok((updated, _errors, fetched, active, channel_full)) => {
                info!("[{}] Price sync #{}: {} updated", name, count, updated);
                if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                    warn!(
                        "[{}] API returned 0 prices for {} active assets",
                        name, active
                    );
                    tracker.record_error(source_id, "API returned 0 prices");
                    false
                } else if channel_full {
                    warn!("[{}] Channel full during initial sync", name);
                    tracker.record_error(source_id, "Write channel full — initial sync");
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

    /// Sync asset metadata from the source.
    /// Upserts returned assets as active and deactivates any assets from this
    /// source that were NOT in the returned set (handles dynamic sources like
    /// HN, Steam, Twitch where assets rotate).
    /// R3-H2: Batched upsert — single query instead of N individual inserts.
    async fn sync_assets(&self) -> Result<usize> {
        let source_id = self.source.source_id();
        let assets = self.source.fetch_assets().await?;
        let now = Utc::now();

        if assets.is_empty() {
            return Ok(0);
        }

        // Deduplicate by asset_id — Postgres ON CONFLICT DO UPDATE cannot affect a row
        // a second time within the same statement. Last entry wins for duplicates.
        let mut seen = std::collections::HashSet::new();
        let assets: Vec<_> = assets
            .into_iter()
            .filter(|a| seen.insert(a.asset_id.clone()))
            .collect();

        let active_ids: Vec<String> = assets.iter().map(|a| a.asset_id.clone()).collect();

        // R3-H2: Batched upsert — single query instead of N individual inserts.
        // Reduces connection hold time from O(N) to O(1).
        for chunk in assets.chunks(ASSET_BATCH_SIZE) {
            let mut qb = sqlx::QueryBuilder::new(
                "INSERT INTO market_assets (asset_id, source, symbol, name, category, is_active, metadata, updated_at) ",
            );
            qb.push_values(chunk, |mut b, asset| {
                let name_trunc: String = asset.name.chars().take(200).collect();
                let symbol_trunc: String = asset.symbol.chars().take(100).collect();
                let cat_trunc: String = asset.category.as_deref().map(|c| c.chars().take(100).collect()).unwrap_or_default();
                b.push_bind(&asset.asset_id)
                    .push_bind(source_id)
                    .push_bind(symbol_trunc)
                    .push_bind(name_trunc)
                    .push_bind(cat_trunc)
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
                  updated_at = EXCLUDED.updated_at",
            );

            if let Err(e) = qb.build().execute(&self.pool).await {
                warn!(
                    "[{}] Batched asset upsert failed ({} assets): {:?}",
                    self.source.display_name(),
                    chunk.len(),
                    e
                );
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
                    info!(
                        "[{}] Deactivated {} stale assets",
                        self.source.display_name(),
                        result.rows_affected()
                    );
                }
            }
        }

        Ok(assets.len())
    }

    /// Sync prices for all active assets. Returns (updated, errors, fetched, active_assets, channel_full).
    ///
    /// All DB writes go through the write channel — no direct INSERT here.
    /// Uses in-memory price cache for change_pct computation.
    /// The `channel_full` flag distinguishes "all prices skipped (unchanged)" from "channel was full."
    async fn sync_prices(&self) -> Result<(usize, usize, usize, usize, bool)> {
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
            warn!(
                "[{}] No active assets to sync",
                self.source.display_name()
            );
            return Ok((0, 0, 0, 0, false));
        }

        // Rate-limit
        self.rate_limiter.wait_for_permit().await;

        let prices = self.source.fetch_prices(&asset_ids).await?;
        let fetched = prices.len();

        // R3-H1: Use in-memory cache for change detection + change_pct computation.
        // This avoids stale reads from DB when channel hasn't flushed yet.
        let cache = self
            .last_sent_values
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        let hundred = Decimal::from(100);
        let mut rows_to_write: Vec<PriceRow> = Vec::new();
        let mut skipped = 0usize;

        for price in &prices {
            let prev_value = cache.get(&price.asset_id).copied();

            // Change detection: always insert if no cache entry, or if value changed
            let should_insert = match prev_value {
                Some(pv) => pv != price.value || self.source.skips_when_unchanged() || self.source.always_record_price(),
                None => true,
            };

            if !should_insert {
                skipped += 1;
                continue;
            }

            let change_pct = price.change_pct.or_else(|| {
                prev_value.and_then(|pv| {
                    if !pv.is_zero() {
                        Some((price.value - pv) / pv * hundred)
                    } else {
                        None
                    }
                })
            });
            let prev_close = price.prev_close.or(prev_value);

            rows_to_write.push(PriceRow {
                asset_id: price.asset_id.clone(),
                source: source_id.to_string(),
                symbol: price.symbol.chars().take(100).collect(),
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
                    let mut cache = self
                        .last_sent_values
                        .lock()
                        .unwrap_or_else(|e| e.into_inner());
                    for (asset_id, value) in cache_updates {
                        cache.insert(asset_id, value);
                    }
                    // Prune stale entries for deactivated assets
                    let active_set: std::collections::HashSet<&str> =
                        asset_ids.iter().map(|s| s.as_str()).collect();
                    cache.retain(|k, _| active_set.contains(k.as_str()));
                }
                SendResult::Full => {
                    // Channel full — prices dropped. Return channel_full=true so
                    // caller does NOT record this as success. Don't update cache.
                    warn!(
                        "[{}] Write channel full, {} prices dropped (will retry next cycle)",
                        self.source.display_name(),
                        updated
                    );
                    return Ok((0, 0, fetched, active_assets, true));
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
            self.source.display_name(),
            updated,
            skipped,
            total_elapsed.as_secs_f64()
        );

        Ok((updated, 0, fetched, active_assets, false))
    }

    /// Deactivate assets that haven't received a price in 7+ days.
    ///
    /// Covers two cases:
    /// 1. Never-priced assets: no entry in market_prices_latest at all
    ///    (dead/delisted tokens still in config JSON).
    /// 2. Stale assets: had prices before but the upstream API stopped returning them
    ///    (last price is older than 7 days).
    ///
    /// Safety: only runs if the source has at least one priced asset in
    /// market_prices_latest (prevents mass deactivation on fresh DB).
    ///
    /// Assets are reactivated by sync_assets() on the next hourly metadata refresh
    /// if they start receiving prices again — sync_assets sets is_active=true for all
    /// config entries, and this sweep re-deactivates the stale ones right after.
    async fn deactivate_stale_assets(&self) -> Result<u64> {
        let source_id = self.source.source_id();
        let cutoff = Utc::now() - ChronoDuration::days(7);

        // Safety check: only deactivate if this source has at least one priced asset.
        // On a fresh DB no assets have prices yet — skip to avoid mass deactivation.
        let has_prices: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM market_prices_latest WHERE source = $1",
        )
        .bind(source_id)
        .fetch_one(&self.pool)
        .await?;

        if has_prices.0 == 0 {
            debug!(
                "[{}] No prices in market_prices_latest yet, skipping stale asset sweep",
                self.source.display_name()
            );
            return Ok(0);
        }

        // Deactivate active assets that either:
        // - Have no entry in market_prices_latest (never priced = dead/delisted)
        // - Have an entry in market_prices_latest with fetched_at older than 7 days
        let result = sqlx::query(
            r#"
            UPDATE market_assets a
            SET is_active = false, updated_at = NOW()
            WHERE a.source = $1
              AND a.is_active = true
              AND (
                -- Never priced: no row in latest at all
                NOT EXISTS (
                    SELECT 1 FROM market_prices_latest l
                    WHERE l.source = a.source AND l.asset_id = a.asset_id
                )
                OR
                -- Had prices but stale: last price older than 7 days
                EXISTS (
                    SELECT 1 FROM market_prices_latest l
                    WHERE l.source = a.source AND l.asset_id = a.asset_id
                      AND l.fetched_at < $2
                )
              )
            "#,
        )
        .bind(source_id)
        .bind(cutoff)
        .execute(&self.pool)
        .await?;

        let deactivated = result.rows_affected();
        if deactivated > 0 {
            info!(
                "[{}] Deactivated {} stale assets (no price in 7+ days)",
                self.source.display_name(),
                deactivated
            );
        }

        Ok(deactivated)
    }

    /// Prune price records older than retention_days
    async fn prune_old_prices(&self) -> Result<u64> {
        let source_id = self.source.source_id();
        let cutoff = Utc::now() - ChronoDuration::days(self.retention_days);

        let result =
            sqlx::query("DELETE FROM market_prices WHERE source = $1 AND fetched_at < $2")
                .bind(source_id)
                .bind(cutoff)
                .execute(&self.pool)
                .await?;

        let deleted = result.rows_affected();
        if deleted > 0 {
            info!(
                "[{}] Pruned {} old price records",
                self.source.display_name(),
                deleted
            );
        }

        Ok(deleted)
    }
}

// classify_anyhow_for_cb lives in sources::error — shared by both engines
use super::sources::error::classify_anyhow_for_cb;
