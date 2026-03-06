//! Schedule-aware sync engine for market data sources
//!
//! Unlike the basic `SyncEngine` which uses fixed intervals, this engine
//! fetches data at optimal times based on when data is actually published.
//!
//! Features:
//! - Skips weekends and holidays automatically
//! - Waits for specific publish times (e.g., 6 PM ET for FRED daily data)
//! - Burst mode during high-importance events (FOMC, ECB meetings)
//! - Efficient: doesn't waste API calls polling when no new data

use anyhow::Result;
use chrono::{Duration as ChronoDuration, Utc};
use sqlx::PgPool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use super::broadcast::{PriceBroadcast, PriceBroadcastHub, SourcePriceBatch};
use super::rate_limiter::SlidingWindowRateLimiter;
use crate::market_data::traits::ScheduledMarketDataSource;

/// Default: keep forever (365 days). These sources have no historical API,
/// so every data point is irreplaceable.
const DEFAULT_PRICE_HISTORY_DAYS: i64 = 365;

/// Maximum sleep duration to prevent getting stuck
const MAX_SLEEP_HOURS: i64 = 72;

/// Scheduled sync engine for time-aware data sources
pub struct ScheduledSyncEngine {
    pool: PgPool,
    source: Box<dyn ScheduledMarketDataSource>,
    rate_limiter: SlidingWindowRateLimiter,
    sync_count: AtomicU64,
    retention_days: i64,
    broadcast_hub: Arc<PriceBroadcastHub>,
}

impl ScheduledSyncEngine {
    /// Create a new scheduled sync engine for the given source
    pub fn new(pool: PgPool, source: Box<dyn ScheduledMarketDataSource>, broadcast_hub: Arc<PriceBroadcastHub>) -> Self {
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

    /// Run the schedule-aware sync loop forever
    pub async fn run(&self) {
        let source_id = self.source.source_id();
        let name = self.source.display_name();
        let tz = self.source.timezone();
        let tracker = super::error_tracker::global();
        let force_trigger = super::sync_registry::global().register(source_id);

        info!(
            "[{}] Starting scheduled sync engine (timezone: {})",
            name, tz
        );
        tracker.record_started(source_id);

        // Initial asset sync
        info!("[{}] Running initial asset metadata sync...", name);
        match self.sync_assets().await {
            Ok(n) => info!("[{}] Initial asset sync: {} assets", name, n),
            Err(e) => error!("[{}] Initial asset sync failed: {:?}", name, e),
        }

        // Initial price sync (get current data)
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
                    tracker.record_success(source_id);
                }
            }
            Err(e) => {
                error!("[{}] Initial price sync failed: {:?}", name, e);
                tracker.record_error(source_id, &format!("{:?}", e));
            }
        }

        // Metadata refresh interval (hourly)
        let mut metadata_interval = tokio::time::interval(std::time::Duration::from_secs(3600));

        loop {
            let now = Utc::now();

            // Check if we should skip today entirely (weekend/holiday)
            if self.source.should_skip_today(now) {
                let tomorrow = (now + ChronoDuration::hours(24))
                    .date_naive()
                    .and_hms_opt(0, 0, 0)
                    .unwrap();
                let sleep_duration = tomorrow
                    .signed_duration_since(now.naive_utc())
                    .to_std()
                    .unwrap_or(std::time::Duration::from_secs(3600));

                info!(
                    "[{}] Market closed today, sleeping until tomorrow ({:?})",
                    name, sleep_duration
                );
                tokio::time::sleep(sleep_duration).await;
                continue;
            }

            // Check for burst mode (FOMC, ECB meeting)
            if let Some(burst_interval) = self.source.burst_mode(now) {
                info!(
                    "[{}] BURST MODE: High-importance event, fetching every {:?}",
                    name, burst_interval
                );

                let count = self.sync_count.fetch_add(1, Ordering::Relaxed) + 1;
                match self.sync_prices().await {
                    Ok((updated, errors, fetched, active)) => {
                        info!(
                            "[{}] Burst sync #{}: {} updated, {} errors",
                            name, count, updated, errors
                        );
                        if fetched == 0 && active > 0 && !self.source.skips_when_unchanged() {
                            tracker.record_error(source_id, "API returned 0 prices — all requests may have failed");
                        } else {
                            tracker.record_success(source_id);
                        }
                    }
                    Err(e) => {
                        error!("[{}] Burst sync #{} failed: {:?}", name, count, e);
                        tracker.record_error(source_id, &format!("{:?}", e));
                    }
                }

                tokio::time::sleep(burst_interval).await;
                continue;
            }

            // Normal mode: calculate next fetch time
            let next_fetch = self.source.next_fetch_time(now);

            if next_fetch > now {
                let wait_duration = (next_fetch - now)
                    .to_std()
                    .unwrap_or(std::time::Duration::from_secs(60));

                // Cap maximum wait to prevent getting stuck
                let max_wait = std::time::Duration::from_secs((MAX_SLEEP_HOURS * 3600) as u64);
                let actual_wait = wait_duration.min(max_wait);

                info!(
                    "[{}] Next fetch at {} ({:?} from now)",
                    name,
                    next_fetch.format("%Y-%m-%d %H:%M:%S UTC"),
                    actual_wait
                );

                // Use tokio::select to also handle metadata refresh and force-sync while waiting
                tokio::select! {
                    _ = tokio::time::sleep(actual_wait) => {
                        // Time to fetch
                    }
                    _ = metadata_interval.tick() => {
                        info!("[{}] Refreshing asset metadata...", name);
                        match self.sync_assets().await {
                            Ok(n) => info!("[{}] Asset metadata refresh: {} assets", name, n),
                            Err(e) => warn!("[{}] Asset metadata refresh failed: {:?}", name, e),
                        }
                        continue; // Re-evaluate schedule
                    }
                    _ = force_trigger.notified() => {
                        info!("[{}] Force-sync triggered via admin API (bypassing schedule)", name);
                        // Fall through to the fetch below
                    }
                }
            }

            // Execute the fetch
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

            // Prune old data periodically
            if count % 50 == 0 {
                if let Err(e) = self.prune_old_prices().await {
                    warn!("[{}] Price pruning failed: {:?}", name, e);
                }
            }

            // Small delay to prevent tight loops if next_fetch_time returns now
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    }

    /// Sync asset metadata from the source.
    /// Upserts returned assets as active and deactivates any assets from this
    /// source that were NOT in the returned set (handles dynamic sources like
    /// HN, Steam, Twitch where assets rotate).
    async fn sync_assets(&self) -> Result<usize> {
        let source_id = self.source.source_id();
        let assets = self.source.fetch_assets().await?;
        let now = Utc::now();
        let mut count = 0;

        let active_ids: Vec<String> = assets.iter().map(|a| a.asset_id.clone()).collect();

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

        // Deactivate assets from this source that are no longer in the active set.
        // This handles dynamic sources (HN, Steam, etc.) where assets rotate.
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

            match deactivated {
                Ok(result) if result.rows_affected() > 0 => {
                    info!(
                        "[{}] Deactivated {} stale assets no longer returned by source",
                        self.source.display_name(),
                        result.rows_affected()
                    );
                }
                _ => {}
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
        let fetch_elapsed = fetch_start.elapsed();
        let fetched = prices.len();
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
                None => true,
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
                Ok(_) => {
                    updated += 1;
                    // Update latest prices cache for fast vision snapshots
                    // Pulls name + category from market_assets so snapshot API shows real names
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO market_prices_latest (
                            source, asset_id, symbol, name, value,
                            change_pct, volume_24h, market_cap, category, fetched_at
                        )
                        SELECT $1, $2, $3, COALESCE(a.name, ''), $4, $5, $6, $7, a.category, $8
                        FROM (SELECT 1) x
                        LEFT JOIN market_assets a ON a.source = $1 AND a.asset_id = $2
                        ON CONFLICT (source, asset_id) DO UPDATE SET
                            symbol = EXCLUDED.symbol,
                            name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE market_prices_latest.name END,
                            value = EXCLUDED.value,
                            change_pct = EXCLUDED.change_pct,
                            volume_24h = EXCLUDED.volume_24h,
                            market_cap = EXCLUDED.market_cap,
                            category = COALESCE(EXCLUDED.category, market_prices_latest.category),
                            fetched_at = EXCLUDED.fetched_at
                        "#,
                    )
                    .bind(source_id)
                    .bind(&price.asset_id)
                    .bind(&price.symbol)
                    .bind(price.value)
                    .bind(change_pct)
                    .bind(price.volume_24h)
                    .bind(price.market_cap)
                    .bind(price.fetched_at)
                    .execute(&self.pool)
                    .await;
                }
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
