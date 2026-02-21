//! Generic sync engine for any MarketDataSource
//!
//! Handles the sync loop: fetch assets, fetch prices, prune old data.
//! Source-agnostic — just needs a Box<dyn MarketDataSource>.

use anyhow::Result;
use chrono::{Duration as ChronoDuration, Utc};
use sqlx::PgPool;
use std::sync::atomic::{AtomicU64, Ordering};
use tracing::{debug, error, info, warn};

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
}

impl SyncEngine {
    /// Create a new sync engine for the given source
    pub fn new(pool: PgPool, source: Box<dyn MarketDataSource>) -> Self {
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
        }
    }

    /// Run the sync loop forever
    pub async fn run(&self) {
        let _source_id = self.source.source_id();
        let name = self.source.display_name();
        let interval = self.source.sync_interval();

        info!("[{}] Starting sync engine (interval: {:?})", name, interval);

        // Initial asset sync
        info!("[{}] Running initial asset metadata sync...", name);
        match self.sync_assets().await {
            Ok(n) => info!("[{}] Initial asset sync: {} assets", name, n),
            Err(e) => error!("[{}] Initial asset sync failed: {:?}", name, e),
        }

        // Initial price sync
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

        // Periodic sync
        let mut price_interval = tokio::time::interval(interval);
        let mut metadata_interval = tokio::time::interval(std::time::Duration::from_secs(3600));

        loop {
            tokio::select! {
                _ = price_interval.tick() => {
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
                None => true, // No previous value, always insert
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
