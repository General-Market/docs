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
use tracing::{debug, error, info, warn};

use super::rate_limiter::SlidingWindowRateLimiter;
use crate::market_data::traits::ScheduledMarketDataSource;

/// How many days of price history to keep
const PRICE_HISTORY_DAYS: i64 = 30;

/// Maximum sleep duration to prevent getting stuck
const MAX_SLEEP_HOURS: i64 = 72;

/// Scheduled sync engine for time-aware data sources
pub struct ScheduledSyncEngine {
    pool: PgPool,
    source: Box<dyn ScheduledMarketDataSource>,
    rate_limiter: SlidingWindowRateLimiter,
    sync_count: AtomicU64,
}

impl ScheduledSyncEngine {
    /// Create a new scheduled sync engine for the given source
    pub fn new(pool: PgPool, source: Box<dyn ScheduledMarketDataSource>) -> Self {
        let rate_limiter = SlidingWindowRateLimiter::new(source.rate_limit_config());
        Self {
            pool,
            source,
            rate_limiter,
            sync_count: AtomicU64::new(0),
        }
    }

    /// Run the schedule-aware sync loop forever
    pub async fn run(&self) {
        let name = self.source.display_name();
        let tz = self.source.timezone();

        info!(
            "[{}] Starting scheduled sync engine (timezone: {})",
            name, tz
        );

        // Initial asset sync
        info!("[{}] Running initial asset metadata sync...", name);
        match self.sync_assets().await {
            Ok(n) => info!("[{}] Initial asset sync: {} assets", name, n),
            Err(e) => error!("[{}] Initial asset sync failed: {:?}", name, e),
        }

        // Initial price sync (get current data)
        info!("[{}] Running initial price sync...", name);
        match self.sync_prices().await {
            Ok((updated, errors)) => {
                info!(
                    "[{}] Initial price sync: {} updated, {} errors",
                    name, updated, errors
                );
            }
            Err(e) => error!("[{}] Initial price sync failed: {:?}", name, e),
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
                    Ok((updated, errors)) => {
                        info!(
                            "[{}] Burst sync #{}: {} updated, {} errors",
                            name, count, updated, errors
                        );
                    }
                    Err(e) => error!("[{}] Burst sync #{} failed: {:?}", name, count, e),
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

                // Use tokio::select to also handle metadata refresh while waiting
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
                }
            }

            // Execute the fetch
            let count = self.sync_count.fetch_add(1, Ordering::Relaxed) + 1;
            match self.sync_prices().await {
                Ok((updated, errors)) => {
                    info!(
                        "[{}] Price sync #{}: {} updated, {} errors",
                        name, count, updated, errors
                    );
                }
                Err(e) => error!("[{}] Price sync #{} failed: {:?}", name, count, e),
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

    /// Sync prices for all active assets
    async fn sync_prices(&self) -> Result<(usize, usize)> {
        let source_id = self.source.source_id();

        // Get active asset IDs
        let asset_ids: Vec<String> = sqlx::query_scalar(
            "SELECT asset_id FROM market_assets WHERE source = $1 AND is_active = true ORDER BY symbol",
        )
        .bind(source_id)
        .fetch_all(&self.pool)
        .await?;

        if asset_ids.is_empty() {
            warn!(
                "[{}] No active assets to sync — run asset sync first",
                self.source.display_name()
            );
            return Ok((0, 0));
        }

        // Rate-limit: wait before fetching
        self.rate_limiter.wait_for_permit().await;

        let prices = self.source.fetch_prices(&asset_ids).await?;

        // Get latest values from DB to detect changes
        let latest_values: std::collections::HashMap<String, rust_decimal::Decimal> =
            sqlx::query_as::<_, (String, rust_decimal::Decimal)>(
                r#"
                SELECT DISTINCT ON (asset_id) asset_id, value
                FROM market_prices
                WHERE source = $1
                ORDER BY asset_id, fetched_at DESC
                "#,
            )
            .bind(source_id)
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .collect();

        let mut updated = 0usize;
        let mut skipped = 0usize;
        let mut errors = 0usize;

        for price in &prices {
            // Only insert if value changed or no previous value exists
            let should_insert = match latest_values.get(&price.asset_id) {
                Some(prev_value) => *prev_value != price.value,
                None => true,
            };

            if !should_insert {
                skipped += 1;
                continue;
            }

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
            .bind(price.prev_close)
            .bind(price.change_pct)
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

        if skipped > 0 {
            debug!(
                "[{}] Skipped {} unchanged prices",
                self.source.display_name(),
                skipped
            );
        }

        Ok((updated, errors))
    }

    /// Prune price records older than PRICE_HISTORY_DAYS
    async fn prune_old_prices(&self) -> Result<u64> {
        let source_id = self.source.source_id();
        let cutoff = Utc::now() - ChronoDuration::days(PRICE_HISTORY_DAYS);

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
