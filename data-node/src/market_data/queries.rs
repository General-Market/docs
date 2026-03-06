//! Shared database queries for market data
//!
//! Used by API routes, scorer, and keeper to read from the unified tables.

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use tracing::debug;

use super::models::{MarketAsset, MarketPriceRecord, MarketPriceSummary, MarketSyncStats};

/// Get current prices for a source with optional symbol and category filters.
///
/// Returns the most recent price per asset.
pub async fn get_market_prices(
    pool: &PgPool,
    source: &str,
    symbols_filter: Option<&[&str]>,
    category_filter: Option<&str>,
    page: u32,
    limit: u32,
) -> Result<(Vec<MarketPriceSummary>, i64)> {
    // Count total matching assets
    let total: (i64,) = if let Some(cat) = category_filter {
        sqlx::query_as(
            "SELECT COUNT(*) FROM market_assets WHERE source = $1 AND is_active = true AND category = $2",
        )
        .bind(source)
        .bind(cat)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_as("SELECT COUNT(*) FROM market_assets WHERE source = $1 AND is_active = true")
            .bind(source)
            .fetch_one(pool)
            .await?
    };

    let offset = ((page.saturating_sub(1)) * limit) as i64;
    let limit_val = limit.min(1000) as i64;

    let rows: Vec<(
        String,
        String,
        String,
        String,
        Option<String>,
        Decimal,
        Option<Decimal>,
        Option<Decimal>,
        Option<Decimal>,
        Option<Decimal>,
        DateTime<Utc>,
        Option<String>,
    )> = sqlx::query_as(
        r#"
        SELECT DISTINCT ON (a.asset_id)
            a.asset_id, a.source, a.symbol, a.name, a.category,
            p.value, p.prev_close, p.change_pct,
            p.volume_24h, p.market_cap, p.fetched_at,
            a.metadata->>'image_url' as image_url
        FROM market_assets a
        JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
        WHERE a.source = $1
          AND a.is_active = true
          AND ($2::TEXT IS NULL OR a.category = $2)
        ORDER BY a.asset_id, p.fetched_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(source)
    .bind(category_filter)
    .bind(limit_val)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let mut summaries: Vec<MarketPriceSummary> = rows
        .into_iter()
        .map(
            |(
                asset_id,
                source,
                symbol,
                name,
                category,
                value,
                prev_close,
                pct,
                vol,
                mcap,
                fetched_at,
                image_url,
            )| {
                MarketPriceSummary {
                    asset_id,
                    source,
                    symbol,
                    name,
                    category,
                    value,
                    prev_close,
                    change_pct: pct,
                    volume_24h: vol,
                    market_cap: mcap,
                    fetched_at,
                    image_url,
                }
            },
        )
        .collect();

    // Apply symbol filter in-memory (simpler than dynamic SQL for a small filter)
    if let Some(syms) = symbols_filter {
        summaries.retain(|s| syms.iter().any(|sym| s.symbol.eq_ignore_ascii_case(sym)));
    }

    Ok((summaries, total.0))
}

/// Get current price for a single asset
pub async fn get_market_asset_price(
    pool: &PgPool,
    source: &str,
    asset_id: &str,
) -> Result<Option<MarketPriceSummary>> {
    let row: Option<(
        String,
        String,
        String,
        String,
        Option<String>,
        Decimal,
        Option<Decimal>,
        Option<Decimal>,
        Option<Decimal>,
        Option<Decimal>,
        DateTime<Utc>,
        Option<String>,
    )> = sqlx::query_as(
        r#"
        SELECT
            a.asset_id, a.source, a.symbol, a.name, a.category,
            p.value, p.prev_close, p.change_pct,
            p.volume_24h, p.market_cap, p.fetched_at,
            a.metadata->>'image_url' as image_url
        FROM market_assets a
        JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
        WHERE a.source = $1 AND a.asset_id = $2
        ORDER BY p.fetched_at DESC
        LIMIT 1
        "#,
    )
    .bind(source)
    .bind(asset_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(
        |(
            asset_id,
            source,
            symbol,
            name,
            category,
            value,
            prev_close,
            pct,
            vol,
            mcap,
            fetched_at,
            image_url,
        )| {
            MarketPriceSummary {
                asset_id,
                source,
                symbol,
                name,
                category,
                value,
                prev_close,
                change_pct: pct,
                volume_24h: vol,
                market_cap: mcap,
                fetched_at,
                image_url,
            }
        },
    ))
}

/// Get price history for an asset within a time range
pub async fn get_market_price_history(
    pool: &PgPool,
    source: &str,
    asset_id: &str,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<MarketPriceRecord>> {
    let prices = sqlx::query_as::<_, MarketPriceRecord>(
        r#"
        SELECT id, asset_id, source, symbol, value, prev_close,
               change_pct, volume_24h, market_cap, fetched_at, created_at
        FROM market_prices
        WHERE source = $1 AND asset_id = $2 AND fetched_at >= $3 AND fetched_at <= $4
        ORDER BY fetched_at ASC
        "#,
    )
    .bind(source)
    .bind(asset_id)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;

    Ok(prices)
}

/// Get all active assets for a source, optionally filtered by category
pub async fn get_market_active_assets(
    pool: &PgPool,
    source: &str,
    category: Option<&str>,
) -> Result<Vec<MarketAsset>> {
    let assets = sqlx::query_as::<_, MarketAsset>(
        r#"
        SELECT asset_id, source, symbol, name, category, is_active, metadata, updated_at
        FROM market_assets
        WHERE source = $1 AND is_active = true AND ($2::TEXT IS NULL OR category = $2)
        ORDER BY symbol ASC
        "#,
    )
    .bind(source)
    .bind(category)
    .fetch_all(pool)
    .await?;

    Ok(assets)
}

/// Get price history for multiple assets from any source.
/// Returns a map of asset_id -> Vec<PriceRecord>.
pub async fn get_batch_market_price_history(
    pool: &PgPool,
    asset_ids: &[String],
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<MarketPriceRecord>> {
    if asset_ids.is_empty() {
        return Ok(vec![]);
    }

    let prices = sqlx::query_as::<_, MarketPriceRecord>(
        r#"
        SELECT id, asset_id, source, symbol, value, prev_close,
               change_pct, volume_24h, market_cap, fetched_at, created_at
        FROM market_prices
        WHERE asset_id = ANY($1) AND fetched_at >= $2 AND fetched_at <= $3
        ORDER BY asset_id ASC, fetched_at ASC
        "#,
    )
    .bind(asset_ids)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;

    Ok(prices)
}

/// Get sync statistics for a source
pub async fn get_market_sync_stats(pool: &PgPool, source: &str) -> Result<MarketSyncStats> {
    let asset_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM market_assets WHERE source = $1 AND is_active = true")
            .bind(source)
            .fetch_one(pool)
            .await?;

    let price_stats: (i64, Option<DateTime<Utc>>, Option<DateTime<Utc>>) = sqlx::query_as(
        "SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM market_prices WHERE source = $1",
    )
    .bind(source)
    .fetch_one(pool)
    .await?;

    debug!(
        "Sync stats for {}: {} assets, {} prices",
        source, asset_count.0, price_stats.0
    );

    Ok(MarketSyncStats {
        source: source.to_string(),
        asset_count: asset_count.0,
        price_record_count: price_stats.0,
        last_sync: price_stats.2,
        oldest_price: price_stats.1,
        newest_price: price_stats.2,
    })
}
