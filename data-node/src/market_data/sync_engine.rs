//! Generic sync engine for any MarketDataSource
//!
//! Handles the sync loop: fetch assets, fetch prices, prune old data.
//! Source-agnostic — just needs a Box<dyn MarketDataSource>.

use anyhow::Result;
use chrono::{Duration as ChronoDuration, Utc};
use sqlx::PgPool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use super::broadcast::{PriceBroadcast, PriceBroadcastHub, SourcePriceBatch};
use super::rate_limiter::SlidingWindowRateLimiter;
use crate::market_data::traits::MarketDataSource;

/// Default: keep forever (365 days). These sources have no historical API,
/// so every data point is irreplaceable.
const DEFAULT_PRICE_HISTORY_DAYS: i64 = 365;

/// Generic market data sync engine
pub struct SyncEngine {
    pool: PgPool,
    source: Box<dyn MarketDataSource>,
    rate_limiter: SlidingWindowRateLimiter,
    sync_count: AtomicU64,
    retention_days: i64,
    broadcast_hub: Arc<PriceBroadcastHub>,
}

impl SyncEngine {
    /// Create a new sync engine for the given source
    pub fn new(pool: PgPool, source: Box<dyn MarketDataSource>, broadcast_hub: Arc<PriceBroadcastHub>) -> Self {
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
        }
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

        // Initial asset sync
        info!("[{}] Running initial asset metadata sync...", name);
        match self.sync_assets().await {
            Ok(n) => info!("[{}] Initial asset sync: {} assets", name, n),
            Err(e) => error!("[{}] Initial asset sync failed: {:?}", name, e),
        }

        // Initial price sync
        info!("[{}] Running initial price sync...", name);
        match self.sync_prices().await {
            Ok((updated, errors, fetched, active)) => {
                info!(
                    "[{}] Initial price sync: {} updated, {} errors",
                    name, updated, errors
                );
                if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                    warn!("[{}] API returned 0 prices for {} active assets — source may be broken", name, active);
                    tracker.record_error(source_id, "API returned 0 prices — all requests may have failed");
                } else {
                    if fetched > 0 && active > 0 && (fetched as f64) < (active as f64 * 0.5) {
                        warn!("[{}] Partial data loss: got {}/{} prices ({:.0}%)", name, fetched, active, fetched as f64 / active as f64 * 100.0);
                    }
                    tracker.record_success(source_id);
                }
            }
            Err(e) => {
                error!("[{}] Initial price sync failed: {:?}", name, e);
                tracker.record_error(source_id, &format!("{:?}", e));
            }
        }

        // Periodic sync
        let mut price_interval = tokio::time::interval(interval);
        let mut metadata_interval = tokio::time::interval(std::time::Duration::from_secs(3600));

        loop {
            tokio::select! {
                _ = price_interval.tick() => {
                    let count = self.sync_count.fetch_add(1, Ordering::Relaxed) + 1;

                    match self.sync_prices().await {
                        Ok((updated, errors, fetched, active)) => {
                            info!(
                                "[{}] Price sync #{}: {} updated, {} errors",
                                name, count, updated, errors
                            );
                            if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                                tracker.record_error(source_id, "API returned 0 prices — all requests may have failed");
                            } else {
                                if fetched > 0 && active > 0 && (fetched as f64) < (active as f64 * 0.5) {
                                    warn!("[{}] Partial data loss: got {}/{} prices ({:.0}%)", name, fetched, active, fetched as f64 / active as f64 * 100.0);
                                }
                                tracker.record_success(source_id);
                            }
                        }
                        Err(e) => {
                            error!("[{}] Price sync #{} failed: {:?}", name, count, e);
                            tracker.record_error(source_id, &format!("{:?}", e));
                        }
                    }

                    // Prune every 100 syncs
                    if count % 100 == 0 {
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
                    let count = self.sync_count.fetch_add(1, Ordering::Relaxed) + 1;
                    match self.sync_prices().await {
                        Ok((updated, errors, fetched, active)) => {
                            info!(
                                "[{}] Force sync #{}: {} updated, {} errors",
                                name, count, updated, errors
                            );
                            if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                                tracker.record_error(source_id, "API returned 0 prices — all requests may have failed");
                            } else {
                                tracker.record_success(source_id);
                            }
                        }
                        Err(e) => {
                            error!("[{}] Force sync #{} failed: {:?}", name, count, e);
                            tracker.record_error(source_id, &format!("{:?}", e));
                        }
                    }
                }
            }
        }
    }

    /// Sync asset metadata from the source
    async fn sync_assets(&self) -> Result<usize> {
        let source_id = self.source.source_id();
        let assets = self.source.fetch_assets().await?;
        let now = Utc::now();
        let mut count = 0;

        for asset in &assets {
            let result = sqlx::query(
                r#"
                INSERT INTO market_assets (asset_id, source, symbol, name, category, is_active, metadata, updated_at)
                VALUES ($1, $2, $3, $4, $5, true, $6, $7)
                ON CONFLICT (source, asset_id) DO UPDATE SET
                    symbol = EXCLUDED.symbol,
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    is_active = true,
                    metadata = EXCLUDED.metadata,
                    updated_at = EXCLUDED.updated_at
                "#,
            )
            .bind(&asset.asset_id)
            .bind(source_id)
            .bind(&asset.symbol)
            .bind(&asset.name)
            .bind(&asset.category)
            .bind(&asset.metadata)
            .bind(now)
            .execute(&self.pool)
            .await;

            match result {
                Ok(_) => count += 1,
                Err(e) => warn!("Failed to upsert asset {}: {:?}", asset.asset_id, e),
            }
        }

        Ok(count)
    }

    /// Sync prices for all active assets. Returns (updated, errors, fetched, active_assets).
    async fn sync_prices(&self) -> Result<(usize, usize, usize, usize)> {
        let source_id = self.source.source_id();
        let sync_start = std::time::Instant::now();

        // Get active asset IDs
        let asset_ids: Vec<String> = sqlx::query_scalar(
            "SELECT asset_id FROM market_assets WHERE source = $1 AND is_active = true ORDER BY symbol",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        let active_assets = asset_ids.len();

        if asset_ids.is_empty() {
            warn!(
                "[{}] No active assets to sync — run asset sync first",
                self.source.display_name()
            );
            return Ok((0, 0, 0, 0));
        }

        info!("[{}] Fetching prices for {} assets...", self.source.display_name(), asset_ids.len());

        // Rate-limit: wait before fetching
        self.rate_limiter.wait_for_permit().await;

        let fetch_start = std::time::Instant::now();
        let prices = self.source.fetch_prices(&asset_ids).await?;
        let fetched = prices.len();
        let fetch_elapsed = fetch_start.elapsed();
        info!("[{}] API fetch: {} prices in {:.1}s", self.source.display_name(), fetched, fetch_elapsed.as_secs_f64());

        // Get latest values + timestamps from DB to detect changes (LATERAL for index efficiency)
        let latest_values: std::collections::HashMap<String, (rust_decimal::Decimal, chrono::DateTime<Utc>)> =
            sqlx::query_as::<_, (String, rust_decimal::Decimal, chrono::DateTime<Utc>)>(
                r#"
            SELECT a.asset_id, p.value, p.fetched_at
            FROM market_assets a
            CROSS JOIN LATERAL (
                SELECT value, fetched_at FROM market_prices
                WHERE market_prices.source = a.source AND market_prices.asset_id = a.asset_id
                ORDER BY fetched_at DESC LIMIT 1
            ) p
            WHERE a.source = $1 AND a.is_active = true
            "#,
            )
            .bind(source_id)
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|(id, val, ts)| (id, (val, ts)))
            .collect();

        // Force-insert unchanged values if record is older than 6x sync interval
        let max_staleness = ChronoDuration::from_std(self.source.sync_interval() * 6)
            .unwrap_or(ChronoDuration::minutes(30));

        let mut updated = 0usize;
        let mut skipped = 0usize;
        let mut errors = 0usize;

        let hundred = rust_decimal::Decimal::from(100);

        for price in &prices {
            // Insert if value changed, no previous value, or record is too old (heartbeat)
            let prev_info = latest_values.get(&price.asset_id);
            let should_insert = match prev_info {
                Some((prev_value, prev_time)) => {
                    if *prev_value != price.value {
                        true // value changed
                    } else {
                        // Force-insert to keep fetched_at fresh for stable metrics
                        (Utc::now() - *prev_time) > max_staleness
                    }
                }
                None => true, // No previous value, always insert
            };

            if !should_insert {
                skipped += 1;
                continue;
            }

            // Compute change_pct from previous DB value when the source didn't provide it
            let change_pct = price.change_pct.or_else(|| {
                prev_info.and_then(|(prev_value, _)| {
                    if !prev_value.is_zero() {
                        Some((price.value - *prev_value) / *prev_value * hundred)
                    } else {
                        None
                    }
                })
            });

            // Use previous DB value as prev_close when the source didn't provide it
            let prev_close = price.prev_close.or_else(|| {
                prev_info.map(|(prev_value, _)| *prev_value)
            });

            let result = sqlx::query(
                r#"
                INSERT INTO market_prices (
                    asset_id, source, symbol, value,
                    prev_close, change_pct, volume_24h, market_cap,
                    fetched_at, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
                "#,
            )
            .bind(&price.asset_id)
            .bind(source_id)
            .bind(&price.symbol)
            .bind(price.value)
            .bind(prev_close)
            .bind(change_pct)
            .bind(price.volume_24h)
            .bind(price.market_cap)
            .bind(price.fetched_at)
            .execute(&self.pool)
            .await;

            match result {
                Ok(_) => updated += 1,
                Err(e) => {
                    debug!("Failed to insert price for {}: {:?}", price.asset_id, e);
                    errors += 1;
                }
            }
        }

        // Broadcast updated prices to WebSocket subscribers
        if updated > 0 {
            let batch = Arc::new(SourcePriceBatch {
                source: source_id.to_string(),
                prices: prices.iter().map(|p| PriceBroadcast {
                    source: source_id.to_string(),
                    asset_id: p.asset_id.clone(),
                    symbol: p.symbol.clone(),
                    value: p.value,
                    change_pct: p.change_pct,
                    volume_24h: p.volume_24h,
                    market_cap: p.market_cap,
                    fetched_at: p.fetched_at,
                }).collect(),
                timestamp: Utc::now(),
            });
            let tx = self.broadcast_hub.sender(source_id).await;
            let _ = tx.send(batch);
        }

        let total_elapsed = sync_start.elapsed();
        info!(
            "[{}] Sync complete: {} updated, {} skipped, {} errors in {:.1}s",
            self.source.display_name(),
            updated, skipped, errors, total_elapsed.as_secs_f64()
        );

        Ok((updated, errors, fetched, active_assets))
    }

    /// Prune price records older than retention_days
    async fn prune_old_prices(&self) -> Result<u64> {
        let source_id = self.source.source_id();
        let cutoff = Utc::now() - ChronoDuration::days(self.retention_days);

        let result = sqlx::query("DELETE FROM market_prices WHERE source = $1 AND fetched_at < $2")
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
