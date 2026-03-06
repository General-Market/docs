use chrono::{DateTime, Timelike, Utc};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tracing::info;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .idle_timeout(std::time::Duration::from_secs(300))
        .connect(database_url)
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    let m001 = include_str!("../migrations/001_create_prices.sql");
    sqlx::raw_sql(m001).execute(pool).await?;
    let m002 = include_str!("../migrations/002_create_itp_snapshots.sql");
    sqlx::raw_sql(m002).execute(pool).await?;
    let m003 = include_str!("../migrations/003_add_supply_weights.sql");
    sqlx::raw_sql(m003).execute(pool).await?;
    let m004 = include_str!("../migrations/004_create_trades.sql");
    sqlx::raw_sql(m004).execute(pool).await?;
    let m005 = include_str!("../migrations/005_create_klines.sql");
    sqlx::raw_sql(m005).execute(pool).await?;
    let m006 = include_str!("../migrations/006_create_liquidity.sql");
    sqlx::raw_sql(m006).execute(pool).await?;
    let m007 = include_str!("../migrations/007_create_coingecko_market_caps.sql");
    sqlx::raw_sql(m007).execute(pool).await?;
    let m008 = include_str!("../migrations/008_create_coingecko_categories.sql");
    sqlx::raw_sql(m008).execute(pool).await?;
    let m009 = include_str!("../migrations/009_create_bitget_listings.sql");
    sqlx::raw_sql(m009).execute(pool).await?;
    let m010 = include_str!("../migrations/010_create_simulations.sql");
    sqlx::raw_sql(m010).execute(pool).await?;
    let m011 = include_str!("../migrations/011_add_price_history_index.sql");
    sqlx::raw_sql(m011).execute(pool).await?;
    let m012 = include_str!("../migrations/012_add_covering_index.sql");
    sqlx::raw_sql(m012).execute(pool).await?;
    let m013 = include_str!("../migrations/013_add_sim_fk_indexes.sql");
    sqlx::raw_sql(m013).execute(pool).await?;
    let m014 = include_str!("../migrations/014_add_symbol_lookup_index.sql");
    sqlx::raw_sql(m014).execute(pool).await?;
    let m015 = include_str!("../migrations/015_create_defillama_protocols.sql");
    sqlx::raw_sql(m015).execute(pool).await?;
    let m016 = include_str!("../migrations/016_create_defillama_metrics.sql");
    sqlx::raw_sql(m016).execute(pool).await?;
    let m017 = include_str!("../migrations/017_create_defillama_raises.sql");
    sqlx::raw_sql(m017).execute(pool).await?;
    let m018 = include_str!("../migrations/018_add_defi_history_covering.sql");
    sqlx::raw_sql(m018).execute(pool).await?;
    let m019 = include_str!("../migrations/019_create_fng_index.sql");
    sqlx::raw_sql(m019).execute(pool).await?;
    let m020 = include_str!("../migrations/020_create_github_metrics.sql");
    sqlx::raw_sql(m020).execute(pool).await?;
    let m021 = include_str!("../migrations/021_create_market_sources.sql");
    sqlx::raw_sql(m021).execute(pool).await?;
    let m022 = include_str!("../migrations/022_widen_market_symbol.sql");
    sqlx::raw_sql(m022).execute(pool).await?;
    let m023 = include_str!("../migrations/023_create_collector_cursors.sql");
    sqlx::raw_sql(m023).execute(pool).await?;
    let m024 = include_str!("../migrations/024_create_batch_tables.sql");
    sqlx::raw_sql(m024).execute(pool).await?;
    let m025 = include_str!("../migrations/025_create_market_prices_latest.sql");
    sqlx::raw_sql(m025).execute(pool).await?;
    info!("Database migrations applied");
    Ok(())
}

/// Read the last processed block for a collector. Returns 0 if no row exists.
pub async fn get_collector_cursor(pool: &PgPool, name: &str) -> Result<u64, sqlx::Error> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT last_block FROM collector_cursors WHERE collector_name = $1",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(b,)| b as u64).unwrap_or(0))
}

/// Upsert the last processed block for a collector.
pub async fn set_collector_cursor(pool: &PgPool, name: &str, block: u64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO collector_cursors (collector_name, last_block, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (collector_name) DO UPDATE
         SET last_block = $2, updated_at = NOW()",
    )
    .bind(name)
    .bind(block as i64)
    .execute(pool)
    .await?;
    Ok(())
}

/// Reset all collector cursors (used by --reset-session).
pub async fn reset_collector_cursors(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM collector_cursors")
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn batch_insert_prices(
    pool: &PgPool,
    rows: &[(String, String, DateTime<Utc>)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    // Build batch insert with ON CONFLICT DO NOTHING
    let mut symbols = Vec::with_capacity(rows.len());
    let mut prices = Vec::with_capacity(rows.len());
    let mut timestamps = Vec::with_capacity(rows.len());

    for (symbol, price, ts) in rows {
        symbols.push(symbol.as_str());
        prices.push(price.as_str());
        timestamps.push(*ts);
    }

    // Use UNNEST for efficient batch insert
    let result = sqlx::query(
        "INSERT INTO prices (symbol, price, fetched_at)
         SELECT * FROM UNNEST($1::text[], $2::text[], $3::timestamptz[])
         ON CONFLICT (symbol, fetched_at) DO NOTHING"
    )
    .bind(&symbols)
    .bind(&prices)
    .bind(&timestamps)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

#[derive(Debug, serde::Serialize)]
pub struct PriceRow {
    pub symbol: String,
    pub price: String,
    pub fetched_at: DateTime<Utc>,
}

pub async fn query_nearest_price(
    pool: &PgPool,
    symbol: &str,
    at: DateTime<Utc>,
) -> Result<Option<PriceRow>, sqlx::Error> {
    // Find closest row: one before and one after, pick nearest
    let rows = sqlx::query_as::<_, (String, String, DateTime<Utc>)>(
        "(SELECT symbol, price, fetched_at FROM prices WHERE symbol = $1 AND fetched_at <= $2 ORDER BY fetched_at DESC LIMIT 1)
         UNION ALL
         (SELECT symbol, price, fetched_at FROM prices WHERE symbol = $1 AND fetched_at >= $2 ORDER BY fetched_at ASC LIMIT 1)"
    )
    .bind(symbol)
    .bind(at)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(None);
    }

    // Pick the row closest to requested time
    let closest = rows.into_iter().min_by_key(|(_, _, ts)| {
        let diff = (*ts - at).num_milliseconds().unsigned_abs();
        diff
    });

    Ok(closest.map(|(symbol, price, fetched_at)| PriceRow { symbol, price, fetched_at }))
}

pub async fn query_price_series(
    pool: &PgPool,
    symbols: &[&str],
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    interval: Option<&str>,
    max_points: i64,
) -> Result<Vec<PriceRow>, sqlx::Error> {
    match interval {
        Some(interval_str) => {
            let trunc_unit = match interval_str {
                "1m" => "minute",
                "5m" => "5 minutes",
                "15m" => "15 minutes",
                "1h" => "hour",
                "1d" => "day",
                _ => "minute",
            };

            // For standard date_trunc units, use date_trunc directly.
            // For non-standard intervals (5m, 15m), use time bucket approach.
            let query = if matches!(interval_str, "5m" | "15m") {
                let secs: i64 = match interval_str {
                    "5m" => 300,
                    "15m" => 900,
                    _ => 60,
                };
                format!(
                    "SELECT DISTINCT ON (symbol, bucket) symbol, price, fetched_at
                     FROM (
                         SELECT symbol, price, fetched_at,
                                to_timestamp(floor(extract(epoch from fetched_at) / {secs}) * {secs}) AS bucket
                         FROM prices
                         WHERE symbol = ANY($1) AND fetched_at >= $2 AND fetched_at <= $3
                     ) sub
                     ORDER BY symbol, bucket, fetched_at ASC
                     LIMIT $4"
                )
            } else {
                format!(
                    "SELECT DISTINCT ON (symbol, bucket) symbol, price, fetched_at
                     FROM (
                         SELECT symbol, price, fetched_at,
                                date_trunc('{trunc_unit}', fetched_at) AS bucket
                         FROM prices
                         WHERE symbol = ANY($1) AND fetched_at >= $2 AND fetched_at <= $3
                     ) sub
                     ORDER BY symbol, bucket, fetched_at ASC
                     LIMIT $4"
                )
            };

            let rows = sqlx::query_as::<_, (String, String, DateTime<Utc>)>(&query)
                .bind(symbols)
                .bind(from)
                .bind(to)
                .bind(max_points)
                .fetch_all(pool)
                .await?;

            Ok(rows.into_iter().map(|(symbol, price, fetched_at)| PriceRow { symbol, price, fetched_at }).collect())
        }
        None => {
            // Raw data
            let rows = sqlx::query_as::<_, (String, String, DateTime<Utc>)>(
                "SELECT symbol, price, fetched_at FROM prices
                 WHERE symbol = ANY($1) AND fetched_at >= $2 AND fetched_at <= $3
                 ORDER BY symbol, fetched_at ASC
                 LIMIT $4"
            )
            .bind(symbols)
            .bind(from)
            .bind(to)
            .bind(max_points)
            .fetch_all(pool)
            .await?;

            Ok(rows.into_iter().map(|(symbol, price, fetched_at)| PriceRow { symbol, price, fetched_at }).collect())
        }
    }
}

pub async fn query_latest_prices_batch(
    pool: &PgPool,
    symbols: &[&str],
) -> Result<Vec<PriceRow>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query_as::<_, (String, String, DateTime<Utc>)>(
        "SELECT s.symbol, p.price, p.fetched_at
         FROM unnest($1::text[]) AS s(symbol)
         CROSS JOIN LATERAL (
             SELECT price, fetched_at FROM prices
             WHERE prices.symbol = s.symbol
             ORDER BY fetched_at DESC LIMIT 1
         ) p"
    )
    .bind(symbols)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, price, fetched_at)| PriceRow { symbol, price, fetched_at }).collect())
}

/// Fallback: get latest close price from klines table for symbols missing from prices table.
pub async fn query_latest_kline_prices_batch(
    pool: &PgPool,
    symbols: &[&str],
) -> Result<Vec<PriceRow>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query_as::<_, (String, String, DateTime<Utc>)>(
        "SELECT s.symbol, k.close, k.open_time
         FROM unnest($1::text[]) AS s(symbol)
         CROSS JOIN LATERAL (
             SELECT close, open_time FROM klines
             WHERE klines.symbol = s.symbol
             ORDER BY open_time DESC LIMIT 1
         ) k"
    )
    .bind(symbols)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, price, fetched_at)| PriceRow { symbol, price, fetched_at }).collect())
}

/// Get the freshest price per symbol from BOTH prices and klines tables.
/// For each symbol, returns whichever row has the more recent timestamp.
pub async fn query_freshest_prices_batch(
    pool: &PgPool,
    symbols: &[&str],
) -> Result<Vec<PriceRow>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }

    // Query both tables in parallel
    let (prices_result, klines_result) = tokio::join!(
        query_latest_prices_batch(pool, symbols),
        query_latest_kline_prices_batch(pool, symbols),
    );

    let prices = prices_result.unwrap_or_default();
    let klines = klines_result.unwrap_or_default();

    // Index by symbol, pick freshest
    let mut best: std::collections::HashMap<String, PriceRow> = std::collections::HashMap::new();
    for row in prices {
        best.insert(row.symbol.clone(), row);
    }
    for row in klines {
        let entry = best.entry(row.symbol.clone());
        match entry {
            std::collections::hash_map::Entry::Occupied(mut e) => {
                if row.fetched_at > e.get().fetched_at {
                    e.insert(row);
                }
            }
            std::collections::hash_map::Entry::Vacant(e) => { e.insert(row); }
        }
    }

    Ok(best.into_values().collect())
}

pub async fn query_latest_prices_before(
    pool: &PgPool,
    symbols: &[&str],
    before: DateTime<Utc>,
) -> Result<Vec<PriceRow>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query_as::<_, (String, String, DateTime<Utc>)>(
        "SELECT s.sym, p.price, p.fetched_at
         FROM unnest($1::text[]) AS s(sym)
         CROSS JOIN LATERAL (
           SELECT price, fetched_at FROM prices
           WHERE symbol = s.sym AND fetched_at <= $2
           ORDER BY fetched_at DESC LIMIT 1
         ) p"
    )
    .bind(symbols)
    .bind(before)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, price, fetched_at)| PriceRow { symbol, price, fetched_at }).collect())
}

pub async fn prune_old_prices(pool: &PgPool, retention_days: u32) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM prices WHERE fetched_at < NOW() - make_interval(days => $1)"
    )
    .bind(retention_days as i32)
    .execute(pool)
    .await?;

    let deleted = result.rows_affected();
    if deleted > 0 {
        info!(deleted, retention_days, "Pruned old price records");
    }
    Ok(deleted)
}

pub async fn is_connected(pool: &PgPool) -> bool {
    sqlx::query("SELECT 1").execute(pool).await.is_ok()
}

// ---- ITP Snapshot functions ----

pub async fn insert_itp_snapshot(
    pool: &PgPool,
    itp_id: &str,
    assets: &[String],
    inventory: &[String],
    nav: &str,
    valid_from: DateTime<Utc>,
    event_type: &str,
    total_supply: &str,
    weights: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO itp_snapshots (itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(itp_id)
    .bind(assets)
    .bind(inventory)
    .bind(nav)
    .bind(valid_from)
    .bind(event_type)
    .bind(total_supply)
    .bind(weights)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Debug, Clone)]
pub struct ItpSnapshot {
    pub itp_id: String,
    pub assets: Vec<String>,
    pub inventory: Vec<String>,
    pub nav: String,
    pub valid_from: DateTime<Utc>,
    pub event_type: String,
    pub total_supply: String,
    pub weights: Vec<String>,
}

pub async fn query_itp_snapshot_at(
    pool: &PgPool,
    itp_id: &str,
    at: DateTime<Utc>,
) -> Result<Option<ItpSnapshot>, sqlx::Error> {
    let row = sqlx::query_as::<_, (String, Vec<String>, Vec<String>, String, DateTime<Utc>, String, String, Vec<String>)>(
        "SELECT itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights
         FROM itp_snapshots
         WHERE itp_id = $1 AND valid_from <= $2
         ORDER BY valid_from DESC
         LIMIT 1"
    )
    .bind(itp_id)
    .bind(at)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights)| ItpSnapshot {
        itp_id,
        assets,
        inventory,
        nav,
        valid_from,
        event_type,
        total_supply,
        weights,
    }))
}

pub async fn upsert_itp_snapshot(
    pool: &PgPool,
    itp_id: &str,
    assets: &[String],
    inventory: &[String],
    nav: &str,
    valid_from: DateTime<Utc>,
    event_type: &str,
    total_supply: &str,
    weights: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO itp_snapshots (itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (itp_id, valid_from) DO UPDATE SET
            assets = EXCLUDED.assets,
            inventory = EXCLUDED.inventory,
            nav = EXCLUDED.nav,
            event_type = EXCLUDED.event_type,
            total_supply = EXCLUDED.total_supply,
            weights = EXCLUDED.weights"
    )
    .bind(itp_id)
    .bind(assets)
    .bind(inventory)
    .bind(nav)
    .bind(valid_from)
    .bind(event_type)
    .bind(total_supply)
    .bind(weights)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn query_all_snapshots_chronological(
    pool: &PgPool,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
) -> Result<Vec<ItpSnapshot>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, Vec<String>, Vec<String>, String, DateTime<Utc>, String, String, Vec<String>)>(
        "SELECT itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights
         FROM itp_snapshots
         WHERE ($1::timestamptz IS NULL OR valid_from >= $1)
           AND ($2::timestamptz IS NULL OR valid_from <= $2)
         ORDER BY valid_from ASC, id ASC"
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights)| ItpSnapshot {
        itp_id,
        assets,
        inventory,
        nav,
        valid_from,
        event_type,
        total_supply,
        weights,
    }).collect())
}

pub async fn query_creation_snapshot(
    pool: &PgPool,
    itp_id: &str,
) -> Result<Option<ItpSnapshot>, sqlx::Error> {
    let row = sqlx::query_as::<_, (String, Vec<String>, Vec<String>, String, DateTime<Utc>, String, String, Vec<String>)>(
        "SELECT itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights
         FROM itp_snapshots
         WHERE itp_id = $1 AND event_type IN ('created', 'init')
         ORDER BY valid_from ASC
         LIMIT 1"
    )
    .bind(itp_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(itp_id, assets, inventory, nav, valid_from, event_type, total_supply, weights)| ItpSnapshot {
        itp_id,
        assets,
        inventory,
        nav,
        valid_from,
        event_type,
        total_supply,
        weights,
    }))
}

pub async fn has_init_snapshot(
    pool: &PgPool,
    itp_id: &str,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM itp_snapshots
         WHERE itp_id = $1 AND event_type IN ('created', 'init')"
    )
    .bind(itp_id)
    .fetch_one(pool)
    .await?;
    Ok(row > 0)
}

pub async fn delete_stale_snapshots(
    pool: &PgPool,
    itp_id: &str,
    current_asset_count: i32,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM itp_snapshots
         WHERE itp_id = $1 AND array_length(assets, 1) != $2"
    )
    .bind(itp_id)
    .bind(current_asset_count)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Query daily NAV time series for an ITP from stored snapshots.
/// Returns (timestamp, nav_f64) pairs sorted chronologically.
pub async fn query_itp_nav_series(
    pool: &PgPool,
    itp_id: &str,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<(i64, f64)>, sqlx::Error> {
    // Get one NAV per day by taking the last snapshot of each day
    let rows = sqlx::query_as::<_, (DateTime<Utc>, String)>(
        "SELECT DISTINCT ON (date_trunc('day', valid_from))
                valid_from, nav
         FROM itp_snapshots
         WHERE itp_id = $1 AND valid_from >= $2 AND valid_from <= $3
         ORDER BY date_trunc('day', valid_from), valid_from DESC"
    )
    .bind(itp_id)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().filter_map(|(ts, nav_str)| {
        nav_str.parse::<f64>().ok().map(|nav| {
            let day_ts = (ts.timestamp() / 86400) * 86400;
            (day_ts, nav / 1e18)
        })
    }).collect())
}

// ---- Trade functions ----

#[derive(Debug, Clone, serde::Serialize)]
pub struct TradeRow {
    pub order_id: i64,
    pub user_address: String,
    pub itp_id: String,
    pub side: i16,
    pub amount: String,
    pub limit_price: String,
    pub fill_price: Option<String>,
    pub fill_amount: Option<String>,
    pub status: i16,
    pub order_timestamp: DateTime<Utc>,
    pub fill_timestamp: Option<DateTime<Utc>>,
    pub block_number: i64,
}

pub async fn upsert_trade(
    pool: &PgPool,
    order_id: i64,
    user_address: &str,
    itp_id: &str,
    side: i16,
    amount: &str,
    limit_price: &str,
    fill_price: Option<&str>,
    fill_amount: Option<&str>,
    status: i16,
    order_timestamp: DateTime<Utc>,
    fill_timestamp: Option<DateTime<Utc>>,
    block_number: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO trades (order_id, user_address, itp_id, side, amount, limit_price, fill_price, fill_amount, status, order_timestamp, fill_timestamp, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (order_id) DO UPDATE SET
            fill_price = COALESCE(EXCLUDED.fill_price, trades.fill_price),
            fill_amount = COALESCE(EXCLUDED.fill_amount, trades.fill_amount),
            status = EXCLUDED.status,
            fill_timestamp = COALESCE(EXCLUDED.fill_timestamp, trades.fill_timestamp)"
    )
    .bind(order_id)
    .bind(user_address)
    .bind(itp_id)
    .bind(side)
    .bind(amount)
    .bind(limit_price)
    .bind(fill_price)
    .bind(fill_amount)
    .bind(status)
    .bind(order_timestamp)
    .bind(fill_timestamp)
    .bind(block_number)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn query_user_trades(
    pool: &PgPool,
    user_address: &str,
) -> Result<Vec<TradeRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (i64, String, String, i16, String, String, Option<String>, Option<String>, i16, DateTime<Utc>, Option<DateTime<Utc>>, i64)>(
        "SELECT order_id, user_address, itp_id, side, amount, limit_price, fill_price, fill_amount, status, order_timestamp, fill_timestamp, block_number
         FROM trades
         WHERE user_address = $1
         ORDER BY order_timestamp DESC"
    )
    .bind(user_address)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(order_id, user_address, itp_id, side, amount, limit_price, fill_price, fill_amount, status, order_timestamp, fill_timestamp, block_number)| TradeRow {
        order_id,
        user_address,
        itp_id,
        side,
        amount,
        limit_price,
        fill_price,
        fill_amount,
        status,
        order_timestamp,
        fill_timestamp,
        block_number,
    }).collect())
}

pub async fn query_user_positions(
    pool: &PgPool,
    user_address: &str,
) -> Result<Vec<(String, i16, String, String)>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, i16, String, String)>(
        "SELECT itp_id, side, fill_price, fill_amount
         FROM trades
         WHERE user_address = $1 AND status = 2 AND fill_price IS NOT NULL AND fill_amount IS NOT NULL
         ORDER BY order_timestamp ASC"
    )
    .bind(user_address)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

// ---- Kline functions ----

#[derive(Debug, Clone)]
pub struct KlineRow {
    pub symbol: String,
    pub open_time: DateTime<Utc>,
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
}

pub async fn batch_upsert_klines(
    pool: &PgPool,
    rows: &[(String, DateTime<Utc>, String, String, String, String)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut symbols = Vec::with_capacity(rows.len());
    let mut open_times = Vec::with_capacity(rows.len());
    let mut opens = Vec::with_capacity(rows.len());
    let mut highs = Vec::with_capacity(rows.len());
    let mut lows = Vec::with_capacity(rows.len());
    let mut closes = Vec::with_capacity(rows.len());

    for (symbol, open_time, open, high, low, close) in rows {
        symbols.push(symbol.as_str());
        open_times.push(*open_time);
        opens.push(open.as_str());
        highs.push(high.as_str());
        lows.push(low.as_str());
        closes.push(close.as_str());
    }

    let result = sqlx::query(
        "INSERT INTO klines (symbol, open_time, open, high, low, close)
         SELECT * FROM UNNEST($1::text[], $2::timestamptz[], $3::text[], $4::text[], $5::text[], $6::text[])
         ON CONFLICT (symbol, open_time) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close"
    )
    .bind(&symbols)
    .bind(&open_times)
    .bind(&opens)
    .bind(&highs)
    .bind(&lows)
    .bind(&closes)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

pub async fn query_klines(
    pool: &PgPool,
    symbols: &[&str],
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<KlineRow>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query_as::<_, (String, DateTime<Utc>, String, String, String, String)>(
        "SELECT symbol, open_time, open, high, low, close
         FROM klines
         WHERE symbol = ANY($1) AND open_time >= $2 AND open_time <= $3
         ORDER BY open_time"
    )
    .bind(symbols)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, open_time, open, high, low, close)| KlineRow {
        symbol,
        open_time,
        open,
        high,
        low,
        close,
    }).collect())
}

/// Returns the oldest per-symbol MAX(open_time) across the given symbols.
/// This tells us "how far behind is the most-behind symbol?"
/// Returns None if no klines exist for any of the symbols.
pub async fn query_kline_staleness(
    pool: &PgPool,
    symbols: &[&str],
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(None);
    }

    let row = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
        "SELECT MIN(max_ot) FROM (
            SELECT MAX(open_time) as max_ot
            FROM klines
            WHERE symbol = ANY($1)
            GROUP BY symbol
        ) sub"
    )
    .bind(symbols)
    .fetch_optional(pool)
    .await?;

    Ok(row.flatten())
}

// ---- Liquidity functions ----

#[derive(Debug, Clone, serde::Serialize)]
pub struct LiquidityRow {
    pub symbol: String,
    pub spread_bps: f32,
    pub bid_depth_1pct: f32,
    pub ask_depth_1pct: f32,
    pub bid_depth_2pct: f32,
    pub ask_depth_2pct: f32,
    pub volume_24h_usd: f32,
    pub mid_price: String,
    pub fetched_at: DateTime<Utc>,
}

pub async fn batch_insert_liquidity(
    pool: &PgPool,
    rows: &[LiquidityRow],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut symbols = Vec::with_capacity(rows.len());
    let mut spread_bps = Vec::with_capacity(rows.len());
    let mut bid_depth_1 = Vec::with_capacity(rows.len());
    let mut ask_depth_1 = Vec::with_capacity(rows.len());
    let mut bid_depth_2 = Vec::with_capacity(rows.len());
    let mut ask_depth_2 = Vec::with_capacity(rows.len());
    let mut volumes = Vec::with_capacity(rows.len());
    let mut mid_prices = Vec::with_capacity(rows.len());
    let mut timestamps = Vec::with_capacity(rows.len());
    let mut fetched_hours = Vec::with_capacity(rows.len());

    for r in rows {
        symbols.push(r.symbol.as_str());
        spread_bps.push(r.spread_bps);
        bid_depth_1.push(r.bid_depth_1pct);
        ask_depth_1.push(r.ask_depth_1pct);
        bid_depth_2.push(r.bid_depth_2pct);
        ask_depth_2.push(r.ask_depth_2pct);
        volumes.push(r.volume_24h_usd);
        mid_prices.push(r.mid_price.as_str());
        timestamps.push(r.fetched_at);
        // Truncate to hour for dedup
        let hour = r.fetched_at.date_naive().and_hms_opt(r.fetched_at.time().hour(), 0, 0).unwrap();
        fetched_hours.push(hour.and_utc());
    }

    let result = sqlx::query(
        "INSERT INTO liquidity_snapshots (symbol, spread_bps, bid_depth_1pct, ask_depth_1pct, bid_depth_2pct, ask_depth_2pct, volume_24h_usd, mid_price, fetched_at, fetched_hour)
         SELECT * FROM UNNEST($1::text[], $2::real[], $3::real[], $4::real[], $5::real[], $6::real[], $7::real[], $8::text[], $9::timestamptz[], $10::timestamptz[])
         ON CONFLICT (symbol, fetched_hour) DO UPDATE SET
            spread_bps = EXCLUDED.spread_bps,
            bid_depth_1pct = EXCLUDED.bid_depth_1pct,
            ask_depth_1pct = EXCLUDED.ask_depth_1pct,
            bid_depth_2pct = EXCLUDED.bid_depth_2pct,
            ask_depth_2pct = EXCLUDED.ask_depth_2pct,
            volume_24h_usd = EXCLUDED.volume_24h_usd,
            mid_price = EXCLUDED.mid_price,
            fetched_at = EXCLUDED.fetched_at"
    )
    .bind(&symbols)
    .bind(&spread_bps)
    .bind(&bid_depth_1)
    .bind(&ask_depth_1)
    .bind(&bid_depth_2)
    .bind(&ask_depth_2)
    .bind(&volumes)
    .bind(&mid_prices)
    .bind(&timestamps)
    .bind(&fetched_hours)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

pub async fn query_latest_liquidity(
    pool: &PgPool,
    symbols: &[&str],
) -> Result<Vec<LiquidityRow>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query_as::<_, (String, f32, f32, f32, f32, f32, f32, String, DateTime<Utc>)>(
        "SELECT DISTINCT ON (symbol) symbol, spread_bps, bid_depth_1pct, ask_depth_1pct, bid_depth_2pct, ask_depth_2pct, volume_24h_usd, mid_price, fetched_at
         FROM liquidity_snapshots
         WHERE symbol = ANY($1)
         ORDER BY symbol, fetched_at DESC"
    )
    .bind(symbols)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, spread_bps, bid_depth_1pct, ask_depth_1pct, bid_depth_2pct, ask_depth_2pct, volume_24h_usd, mid_price, fetched_at)| LiquidityRow {
        symbol,
        spread_bps,
        bid_depth_1pct,
        ask_depth_1pct,
        bid_depth_2pct,
        ask_depth_2pct,
        volume_24h_usd,
        mid_price,
        fetched_at,
    }).collect())
}

pub async fn query_liquidity_series(
    pool: &PgPool,
    symbol: &str,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<LiquidityRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, f32, f32, f32, f32, f32, f32, String, DateTime<Utc>)>(
        "SELECT symbol, spread_bps, bid_depth_1pct, ask_depth_1pct, bid_depth_2pct, ask_depth_2pct, volume_24h_usd, mid_price, fetched_at
         FROM liquidity_snapshots
         WHERE symbol = $1 AND fetched_at >= $2 AND fetched_at <= $3
         ORDER BY fetched_at ASC"
    )
    .bind(symbol)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, spread_bps, bid_depth_1pct, ask_depth_1pct, bid_depth_2pct, ask_depth_2pct, volume_24h_usd, mid_price, fetched_at)| LiquidityRow {
        symbol,
        spread_bps,
        bid_depth_1pct,
        ask_depth_1pct,
        bid_depth_2pct,
        ask_depth_2pct,
        volume_24h_usd,
        mid_price,
        fetched_at,
    }).collect())
}

pub async fn prune_old_liquidity(pool: &PgPool, retention_days: u32) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM liquidity_snapshots WHERE fetched_at < NOW() - make_interval(days => $1)"
    )
    .bind(retention_days as i32)
    .execute(pool)
    .await?;

    let deleted = result.rows_affected();
    if deleted > 0 {
        info!(deleted, retention_days, "Pruned old liquidity records");
    }
    Ok(deleted)
}

// ---- CoinGecko market-cap functions ----

#[derive(Debug, Clone)]
pub struct CgMarketCapRow {
    pub coin_id: String,
    pub symbol: Option<String>,
    pub name: Option<String>,
    pub market_cap_usd: Option<f64>,
    pub price_usd: Option<f64>,
    pub total_volume_usd: Option<f64>,
    pub market_cap_rank: Option<i32>,
    pub snapshot_date: chrono::NaiveDate,
}

/// Batch upsert market-cap rows. Uses UNNEST for efficiency.
pub async fn cg_batch_upsert_market_caps(
    pool: &PgPool,
    rows: &[CgMarketCapRow],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    // Process in chunks of 5000 to stay within param limits
    let mut total_affected = 0u64;
    for chunk in rows.chunks(5000) {
        let mut coin_ids = Vec::with_capacity(chunk.len());
        let mut symbols = Vec::with_capacity(chunk.len());
        let mut names = Vec::with_capacity(chunk.len());
        let mut mcaps = Vec::with_capacity(chunk.len());
        let mut prices = Vec::with_capacity(chunk.len());
        let mut volumes = Vec::with_capacity(chunk.len());
        let mut ranks = Vec::with_capacity(chunk.len());
        let mut dates = Vec::with_capacity(chunk.len());

        for r in chunk {
            coin_ids.push(r.coin_id.as_str());
            symbols.push(r.symbol.as_deref().unwrap_or(""));
            names.push(r.name.as_deref().unwrap_or(""));
            mcaps.push(r.market_cap_usd);
            prices.push(r.price_usd);
            volumes.push(r.total_volume_usd);
            ranks.push(r.market_cap_rank);
            dates.push(r.snapshot_date);
        }

        let result = sqlx::query(
            "INSERT INTO coingecko_market_caps
                (coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date)
             SELECT * FROM UNNEST(
                $1::text[], $2::text[], $3::text[],
                $4::float8[], $5::float8[], $6::float8[],
                $7::int4[], $8::date[]
             )
             ON CONFLICT (coin_id, snapshot_date) DO UPDATE SET
                symbol = EXCLUDED.symbol,
                name = EXCLUDED.name,
                market_cap_usd = EXCLUDED.market_cap_usd,
                price_usd = EXCLUDED.price_usd,
                total_volume_usd = EXCLUDED.total_volume_usd,
                market_cap_rank = EXCLUDED.market_cap_rank,
                fetched_at = NOW()"
        )
        .bind(&coin_ids)
        .bind(&symbols)
        .bind(&names)
        .bind(&mcaps)
        .bind(&prices)
        .bind(&volumes)
        .bind(&ranks)
        .bind(&dates)
        .execute(pool)
        .await?;

        total_affected += result.rows_affected();
    }

    Ok(total_affected)
}

/// Check whether we already have a snapshot for this date.
pub async fn cg_has_snapshot_for_date(
    pool: &PgPool,
    date: chrono::NaiveDate,
) -> Result<bool, sqlx::Error> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM coingecko_market_caps WHERE snapshot_date = $1"
    )
    .bind(date)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

/// Query market caps for a specific date (or closest earlier date).
pub async fn cg_query_market_caps_at(
    pool: &PgPool,
    date: chrono::NaiveDate,
    limit: i64,
) -> Result<Vec<CgMarketCapRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<f64>, Option<f64>, Option<f64>, Option<i32>, chrono::NaiveDate)>(
        "SELECT coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date
         FROM coingecko_market_caps
         WHERE snapshot_date = (
             SELECT MAX(snapshot_date) FROM coingecko_market_caps WHERE snapshot_date <= $1
         )
         ORDER BY market_cap_rank ASC NULLS LAST
         LIMIT $2"
    )
    .bind(date)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date)| CgMarketCapRow {
        coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date,
    }).collect())
}

/// Query historical market cap series for a single coin.
pub async fn cg_query_coin_history(
    pool: &PgPool,
    coin_id: &str,
) -> Result<Vec<CgMarketCapRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<f64>, Option<f64>, Option<f64>, Option<i32>, chrono::NaiveDate)>(
        "SELECT coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date
         FROM coingecko_market_caps
         WHERE coin_id = $1
         ORDER BY snapshot_date ASC"
    )
    .bind(coin_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date)| CgMarketCapRow {
        coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date,
    }).collect())
}

/// Get all distinct coin_ids in the table.
pub async fn cg_all_coin_ids(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>("SELECT DISTINCT coin_id FROM coingecko_market_caps")
        .fetch_all(pool)
        .await
}

/// Get set of coin_ids that already have historical data (more than 1 snapshot).
/// Used by --skip-existing to avoid re-fetching coins that are already backfilled.
pub async fn cg_coins_with_history(
    pool: &PgPool,
) -> Result<std::collections::HashSet<String>, sqlx::Error> {
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT coin_id FROM coingecko_market_caps GROUP BY coin_id HAVING COUNT(*) > 1"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().collect())
}

// ---- CoinGecko category functions ----

#[derive(Debug, Clone, serde::Serialize)]
pub struct CgCategoryRow {
    pub id: String,
    pub name: String,
    pub market_cap: Option<f64>,
    pub market_cap_change_24h: Option<f64>,
    pub volume_24h: Option<f64>,
    pub top_3_coins: Option<Vec<String>>,
}

/// Batch upsert categories.
pub async fn cg_batch_upsert_categories(
    pool: &PgPool,
    rows: &[CgCategoryRow],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut total_affected = 0u64;
    for chunk in rows.chunks(2000) {
        let mut ids = Vec::with_capacity(chunk.len());
        let mut names = Vec::with_capacity(chunk.len());
        let mut mcaps = Vec::with_capacity(chunk.len());
        let mut mcap_changes = Vec::with_capacity(chunk.len());
        let mut volumes = Vec::with_capacity(chunk.len());

        for r in chunk {
            ids.push(r.id.as_str());
            names.push(r.name.as_str());
            mcaps.push(r.market_cap);
            mcap_changes.push(r.market_cap_change_24h);
            volumes.push(r.volume_24h);
        }

        let result = sqlx::query(
            "INSERT INTO coingecko_categories (id, name, market_cap, market_cap_change_24h, volume_24h, updated_at)
             SELECT id_, name_, mcap_, mcap_ch_, vol_, NOW()
             FROM UNNEST($1::text[], $2::text[], $3::float8[], $4::float8[], $5::float8[])
                AS t(id_, name_, mcap_, mcap_ch_, vol_)
             ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                market_cap = EXCLUDED.market_cap,
                market_cap_change_24h = EXCLUDED.market_cap_change_24h,
                volume_24h = EXCLUDED.volume_24h,
                updated_at = NOW()"
        )
        .bind(&ids)
        .bind(&names)
        .bind(&mcaps)
        .bind(&mcap_changes)
        .bind(&volumes)
        .execute(pool)
        .await?;

        total_affected += result.rows_affected();
    }

    // Update top_3_coins individually (arrays of arrays don't work well with UNNEST)
    for r in rows {
        if let Some(ref top3) = r.top_3_coins {
            sqlx::query("UPDATE coingecko_categories SET top_3_coins = $1 WHERE id = $2")
                .bind(top3)
                .bind(&r.id)
                .execute(pool)
                .await?;
        }
    }

    Ok(total_affected)
}

/// Replace all coin memberships for a category.
pub async fn cg_replace_category_coins(
    pool: &PgPool,
    category_id: &str,
    coin_ids: &[String],
) -> Result<u64, sqlx::Error> {
    // Delete existing memberships
    sqlx::query("DELETE FROM coingecko_category_coins WHERE category_id = $1")
        .bind(category_id)
        .execute(pool)
        .await?;

    if coin_ids.is_empty() {
        return Ok(0);
    }

    let mut total = 0u64;
    for chunk in coin_ids.chunks(5000) {
        let cat_ids: Vec<&str> = vec![category_id; chunk.len()];
        let cids: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();

        let result = sqlx::query(
            "INSERT INTO coingecko_category_coins (category_id, coin_id)
             SELECT * FROM UNNEST($1::text[], $2::text[])
             ON CONFLICT (category_id, coin_id) DO UPDATE SET updated_at = NOW()"
        )
        .bind(&cat_ids)
        .bind(&cids)
        .execute(pool)
        .await?;

        total += result.rows_affected();
    }

    Ok(total)
}

/// Get all categories.
pub async fn cg_query_all_categories(pool: &PgPool) -> Result<Vec<CgCategoryRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String, Option<f64>, Option<f64>, Option<f64>, Option<Vec<String>>)>(
        "SELECT id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins
         FROM coingecko_categories
         ORDER BY market_cap DESC NULLS LAST"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins)| CgCategoryRow {
        id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins,
    }).collect())
}

/// Get a single category by ID.
pub async fn cg_query_category(pool: &PgPool, category_id: &str) -> Result<Option<CgCategoryRow>, sqlx::Error> {
    let row = sqlx::query_as::<_, (String, String, Option<f64>, Option<f64>, Option<f64>, Option<Vec<String>>)>(
        "SELECT id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins
         FROM coingecko_categories
         WHERE id = $1"
    )
    .bind(category_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins)| CgCategoryRow {
        id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins,
    }))
}

/// Get all coin_ids belonging to a category.
pub async fn cg_query_category_coin_ids(pool: &PgPool, category_id: &str) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        "SELECT coin_id FROM coingecko_category_coins WHERE category_id = $1"
    )
    .bind(category_id)
    .fetch_all(pool)
    .await
}

/// Load ALL category→coin_id mappings in one query (for global sim cache).
pub async fn cg_query_all_category_coins(pool: &PgPool) -> Result<Vec<(String, String)>, sqlx::Error> {
    sqlx::query_as::<_, (String, String)>(
        "SELECT category_id, coin_id FROM coingecko_category_coins"
    )
    .fetch_all(pool)
    .await
}


/// Load coin_id→symbol mappings for coins matching Bitget symbols (case-insensitive).
/// Returns one coin_id per symbol (the one with highest market cap = the "real" coin).
/// Uses idx_cg_mcap_symbol_upper index for fast lookup.
pub async fn cg_query_coin_symbols_for_bitget(pool: &PgPool, symbols: &[String]) -> Result<Vec<(String, String)>, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(vec![]);
    }
    let upper_syms: Vec<String> = symbols.iter().map(|s| s.to_uppercase()).collect();
    let sym_refs: Vec<&str> = upper_syms.iter().map(|s| s.as_str()).collect();
    // For each Bitget symbol, find the coin_id with the highest market_cap_usd.
    // This ensures "btc" → "bitcoin" (not "batcat" or "bobby-the-cat").
    sqlx::query_as::<_, (String, String)>(
        "SELECT DISTINCT ON (UPPER(symbol)) coin_id, symbol
         FROM coingecko_market_caps
         WHERE UPPER(symbol) = ANY($1::text[])
           AND symbol IS NOT NULL
           AND market_cap_usd IS NOT NULL
         ORDER BY UPPER(symbol), market_cap_usd DESC"
    )
    .bind(&sym_refs)
    .fetch_all(pool)
    .await
}

/// Load ALL price/mcap data for a set of coin_ids (no date filter — full history).
pub async fn cg_query_all_prices_for_coins(
    pool: &PgPool,
    coin_ids: &[String],
) -> Result<Vec<(String, chrono::NaiveDate, f64, Option<f64>)>, sqlx::Error> {
    if coin_ids.is_empty() {
        return Ok(vec![]);
    }
    let cids: Vec<&str> = coin_ids.iter().map(|s| s.as_str()).collect();
    sqlx::query_as::<_, (String, chrono::NaiveDate, f64, Option<f64>)>(
        "SELECT coin_id, snapshot_date, price_usd, market_cap_usd
         FROM coingecko_market_caps
         WHERE coin_id = ANY($1)
           AND price_usd IS NOT NULL"
    )
    .bind(&cids)
    .fetch_all(pool)
    .await
}

/// Get all category IDs a coin belongs to.
pub async fn cg_query_coin_categories(pool: &PgPool, coin_id: &str) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        "SELECT category_id FROM coingecko_category_coins WHERE coin_id = $1"
    )
    .bind(coin_id)
    .fetch_all(pool)
    .await
}

/// Get coins for a category with their market data (joined with latest snapshot).
pub async fn cg_query_category_coins_with_data(
    pool: &PgPool,
    category_id: &str,
    limit: i64,
) -> Result<Vec<CgMarketCapRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<f64>, Option<f64>, Option<f64>, Option<i32>, chrono::NaiveDate)>(
        "SELECT m.coin_id, m.symbol, m.name, m.market_cap_usd, m.price_usd, m.total_volume_usd, m.market_cap_rank, m.snapshot_date
         FROM coingecko_category_coins cc
         JOIN LATERAL (
             SELECT coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date
             FROM coingecko_market_caps
             WHERE coin_id = cc.coin_id
             ORDER BY snapshot_date DESC
             LIMIT 1
         ) m ON true
         WHERE cc.category_id = $1
         ORDER BY m.market_cap_usd DESC NULLS LAST
         LIMIT $2"
    )
    .bind(category_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date)| CgMarketCapRow {
        coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date,
    }).collect())
}

/// Check if categories table has any data.
pub async fn cg_has_categories(pool: &PgPool) -> Result<bool, sqlx::Error> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM coingecko_categories"
    )
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

/// Batch fetch daily prices for a set of coins over a date range.
/// Returns (coin_id, snapshot_date, price_usd) triples.
pub async fn cg_query_price_history(
    pool: &PgPool,
    coin_ids: &[String],
    from_date: chrono::NaiveDate,
    to_date: chrono::NaiveDate,
) -> Result<Vec<(String, chrono::NaiveDate, f64)>, sqlx::Error> {
    if coin_ids.is_empty() {
        return Ok(vec![]);
    }

    let cids: Vec<&str> = coin_ids.iter().map(|s| s.as_str()).collect();
    let rows = sqlx::query_as::<_, (String, chrono::NaiveDate, f64)>(
        "SELECT coin_id, snapshot_date, price_usd
         FROM coingecko_market_caps
         WHERE coin_id = ANY($1)
           AND snapshot_date >= $2
           AND snapshot_date <= $3
           AND price_usd IS NOT NULL
         ORDER BY coin_id, snapshot_date ASC"
    )
    .bind(&cids)
    .bind(from_date)
    .bind(to_date)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Bulk-load price + market cap data for all category coins over a date range.
/// Returns (coin_id, snapshot_date, price_usd, market_cap_usd) — used to preload
/// everything into memory so the simulation loop does zero per-day DB queries.
pub async fn cg_query_bulk_market_data(
    pool: &PgPool,
    coin_ids: &[String],
    from_date: chrono::NaiveDate,
    to_date: chrono::NaiveDate,
) -> Result<Vec<(String, chrono::NaiveDate, f64, Option<f64>)>, sqlx::Error> {
    if coin_ids.is_empty() {
        return Ok(vec![]);
    }

    let cids: Vec<&str> = coin_ids.iter().map(|s| s.as_str()).collect();
    let rows = sqlx::query_as::<_, (String, chrono::NaiveDate, f64, Option<f64>)>(
        "SELECT coin_id, snapshot_date, price_usd, market_cap_usd
         FROM coingecko_market_caps
         WHERE coin_id = ANY($1)
           AND snapshot_date >= $2
           AND snapshot_date <= $3
           AND price_usd IS NOT NULL"
    )
    .bind(&cids)
    .bind(from_date)
    .bind(to_date)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get all unique snapshot dates.
pub async fn cg_query_snapshot_dates(pool: &PgPool) -> Result<Vec<chrono::NaiveDate>, sqlx::Error> {
    // Recursive CTE skip-scan: ~4700 index lookups instead of scanning 10M rows.
    // Each iteration jumps to the next distinct date via a MIN + WHERE > current.
    let rows = sqlx::query_scalar::<_, chrono::NaiveDate>(
        "WITH RECURSIVE dates AS (
             SELECT MIN(snapshot_date) AS d FROM coingecko_market_caps
             UNION ALL
             SELECT (SELECT MIN(snapshot_date) FROM coingecko_market_caps WHERE snapshot_date > dates.d)
             FROM dates WHERE d IS NOT NULL
         )
         SELECT d FROM dates WHERE d IS NOT NULL ORDER BY d"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// ---- Bitget listing functions ----

#[derive(Debug, Clone, serde::Serialize)]
pub struct BitgetListingRow {
    pub symbol: String,
    pub base_coin: String,
    pub quote_coin: String,
    pub listed_at: DateTime<Utc>,
    pub delisted_at: Option<DateTime<Utc>>,
    pub status: String,
}

/// Batch upsert Bitget listing rows.
pub async fn bitget_batch_upsert_listings(
    pool: &PgPool,
    rows: &[BitgetListingRow],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut symbols = Vec::with_capacity(rows.len());
    let mut bases = Vec::with_capacity(rows.len());
    let mut quotes = Vec::with_capacity(rows.len());
    let mut listed_ats = Vec::with_capacity(rows.len());
    let mut delisted_ats: Vec<Option<DateTime<Utc>>> = Vec::with_capacity(rows.len());
    let mut statuses = Vec::with_capacity(rows.len());

    for r in rows {
        symbols.push(r.symbol.as_str());
        bases.push(r.base_coin.as_str());
        quotes.push(r.quote_coin.as_str());
        listed_ats.push(r.listed_at);
        delisted_ats.push(r.delisted_at);
        statuses.push(r.status.as_str());
    }

    let result = sqlx::query(
        "INSERT INTO bitget_listings (symbol, base_coin, quote_coin, listed_at, delisted_at, status, fetched_at)
         SELECT s, b, q, l, d, st, NOW()
         FROM UNNEST($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::timestamptz[], $6::text[])
            AS t(s, b, q, l, d, st)
         ON CONFLICT (symbol) DO UPDATE SET
            base_coin = EXCLUDED.base_coin,
            quote_coin = EXCLUDED.quote_coin,
            listed_at = EXCLUDED.listed_at,
            delisted_at = EXCLUDED.delisted_at,
            status = EXCLUDED.status,
            fetched_at = NOW()"
    )
    .bind(&symbols)
    .bind(&bases)
    .bind(&quotes)
    .bind(&listed_ats)
    .bind(&delisted_ats)
    .bind(&statuses)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Query all listings, optionally filtered by status.
pub async fn bitget_query_listings(
    pool: &PgPool,
    status_filter: Option<&str>,
) -> Result<Vec<BitgetListingRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String, String, DateTime<Utc>, Option<DateTime<Utc>>, String)>(
        "SELECT symbol, base_coin, quote_coin, listed_at, delisted_at, status
         FROM bitget_listings
         WHERE ($1::text IS NULL OR status = $1)
         ORDER BY listed_at ASC"
    )
    .bind(status_filter)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, base_coin, quote_coin, listed_at, delisted_at, status)| BitgetListingRow {
        symbol, base_coin, quote_coin, listed_at, delisted_at, status,
    }).collect())
}

/// Returns all symbols currently in DB with status != "delisted_gone".
pub async fn bitget_query_active_symbols(
    pool: &PgPool,
) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        "SELECT symbol FROM bitget_listings WHERE status != 'delisted_gone'"
    )
    .fetch_all(pool)
    .await
}

/// Marks symbols as 'delisted_gone' with delisted_at = NOW() for pairs that vanished from API.
pub async fn bitget_mark_disappeared(
    pool: &PgPool,
    symbols: &[String],
) -> Result<u64, sqlx::Error> {
    if symbols.is_empty() {
        return Ok(0);
    }

    let syms: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    let result = sqlx::query(
        "UPDATE bitget_listings
         SET status = 'delisted_gone', delisted_at = NOW()
         WHERE symbol = ANY($1) AND status != 'delisted_gone'"
    )
    .bind(&syms)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Query listings with unsafe status (halt, offline, or delisted_gone).
pub async fn bitget_query_unsafe_listings(
    pool: &PgPool,
) -> Result<Vec<BitgetListingRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String, String, DateTime<Utc>, Option<DateTime<Utc>>, String)>(
        "SELECT symbol, base_coin, quote_coin, listed_at, delisted_at, status
         FROM bitget_listings
         WHERE status IN ('halt', 'offline', 'delisted_gone')
         ORDER BY symbol ASC"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(symbol, base_coin, quote_coin, listed_at, delisted_at, status)| BitgetListingRow {
        symbol, base_coin, quote_coin, listed_at, delisted_at, status,
    }).collect())
}

/// Get listing date for a specific symbol.
pub async fn bitget_query_listing(
    pool: &PgPool,
    symbol: &str,
) -> Result<Option<BitgetListingRow>, sqlx::Error> {
    let row = sqlx::query_as::<_, (String, String, String, DateTime<Utc>, Option<DateTime<Utc>>, String)>(
        "SELECT symbol, base_coin, quote_coin, listed_at, delisted_at, status
         FROM bitget_listings
         WHERE symbol = $1"
    )
    .bind(symbol)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(symbol, base_coin, quote_coin, listed_at, delisted_at, status)| BitgetListingRow {
        symbol, base_coin, quote_coin, listed_at, delisted_at, status,
    }))
}

// ---- Simulation functions ----

#[derive(Debug, Clone, serde::Serialize)]
pub struct SimRunRow {
    pub id: i64,
    pub category_id: String,
    pub top_n: i32,
    pub weighting: String,
    pub rebalance_days: i32,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub total_return_pct: Option<f64>,
    pub annualized_return: Option<f64>,
    pub max_drawdown_pct: Option<f64>,
    pub sharpe_ratio: Option<f64>,
    pub base_fee_pct: f64,
    pub spread_multiplier: f64,
    pub total_fees_pct: Option<f64>,
    pub total_trades: Option<i32>,
    pub total_rebalances: Option<i32>,
    pub total_delistings: Option<i32>,
    pub computed_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct SimRunInsert {
    pub category_id: String,
    pub top_n: i32,
    pub weighting: String,
    pub rebalance_days: i32,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub total_return_pct: Option<f64>,
    pub annualized_return: Option<f64>,
    pub max_drawdown_pct: Option<f64>,
    pub sharpe_ratio: Option<f64>,
    pub base_fee_pct: f64,
    pub spread_multiplier: f64,
    pub total_fees_pct: Option<f64>,
    pub total_trades: Option<i32>,
    pub total_rebalances: Option<i32>,
    pub total_delistings: Option<i32>,
    pub duration_ms: Option<i32>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SimHoldingRow {
    pub rebalance_date: chrono::NaiveDate,
    pub coin_id: String,
    pub symbol: String,
    pub weight: f64,
    pub quantity: f64,
    pub price_usd: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SimTradeRow {
    pub trade_date: chrono::NaiveDate,
    pub coin_id: String,
    pub side: String,
    pub quantity: f64,
    pub price_usd: f64,
    pub fee_pct: f64,
    pub fee_usd: f64,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SimNavPoint {
    pub nav_date: chrono::NaiveDate,
    pub nav: f64,
    pub drawdown_pct: f64,
}

/// Look up a cached simulation run by config params.
pub async fn sim_get_cached_run(
    pool: &PgPool,
    category_id: &str,
    top_n: i32,
    weighting: &str,
    rebalance_days: i32,
    base_fee_pct: f64,
    spread_multiplier: f64,
) -> Result<Option<SimRunRow>, sqlx::Error> {
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT id, category_id, top_n, weighting, rebalance_days, start_date, end_date,
                total_return_pct, annualized_return, max_drawdown_pct, sharpe_ratio,
                base_fee_pct, spread_multiplier, total_fees_pct, total_trades,
                total_rebalances, total_delistings, computed_at, duration_ms
         FROM sim_runs
         WHERE category_id = $1 AND top_n = $2 AND weighting = $3
           AND rebalance_days = $4 AND base_fee_pct = $5 AND spread_multiplier = $6
           AND computed_at > NOW() - INTERVAL '24 hours'"
    )
    .bind(category_id)
    .bind(top_n)
    .bind(weighting)
    .bind(rebalance_days)
    .bind(base_fee_pct)
    .bind(spread_multiplier)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| sim_row_from_pg(&r)))
}

fn sim_row_from_pg(r: &sqlx::postgres::PgRow) -> SimRunRow {
    use sqlx::Row;
    SimRunRow {
        id: r.get("id"),
        category_id: r.get("category_id"),
        top_n: r.get("top_n"),
        weighting: r.get("weighting"),
        rebalance_days: r.get("rebalance_days"),
        start_date: r.get("start_date"),
        end_date: r.get("end_date"),
        total_return_pct: r.get("total_return_pct"),
        annualized_return: r.get("annualized_return"),
        max_drawdown_pct: r.get("max_drawdown_pct"),
        sharpe_ratio: r.get("sharpe_ratio"),
        base_fee_pct: r.get("base_fee_pct"),
        spread_multiplier: r.get("spread_multiplier"),
        total_fees_pct: r.get("total_fees_pct"),
        total_trades: r.get("total_trades"),
        total_rebalances: r.get("total_rebalances"),
        total_delistings: r.get("total_delistings"),
        computed_at: r.get("computed_at"),
        duration_ms: r.get("duration_ms"),
    }
}

/// Insert a new simulation run and return its id.
pub async fn sim_insert_run(pool: &PgPool, run: &SimRunInsert) -> Result<i64, sqlx::Error> {
    // Delete any existing run with same config first (replace stale cache)
    sqlx::query(
        "DELETE FROM sim_runs
         WHERE category_id = $1 AND top_n = $2 AND weighting = $3
           AND rebalance_days = $4 AND base_fee_pct = $5 AND spread_multiplier = $6"
    )
    .bind(&run.category_id)
    .bind(run.top_n)
    .bind(&run.weighting)
    .bind(run.rebalance_days)
    .bind(run.base_fee_pct)
    .bind(run.spread_multiplier)
    .execute(pool)
    .await?;

    let id = sqlx::query_scalar::<_, i64>(
        "INSERT INTO sim_runs
            (category_id, top_n, weighting, rebalance_days, start_date, end_date,
             total_return_pct, annualized_return, max_drawdown_pct, sharpe_ratio,
             base_fee_pct, spread_multiplier, total_fees_pct, total_trades,
             total_rebalances, total_delistings, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id"
    )
    .bind(&run.category_id)
    .bind(run.top_n)
    .bind(&run.weighting)
    .bind(run.rebalance_days)
    .bind(run.start_date)
    .bind(run.end_date)
    .bind(run.total_return_pct)
    .bind(run.annualized_return)
    .bind(run.max_drawdown_pct)
    .bind(run.sharpe_ratio)
    .bind(run.base_fee_pct)
    .bind(run.spread_multiplier)
    .bind(run.total_fees_pct)
    .bind(run.total_trades)
    .bind(run.total_rebalances)
    .bind(run.total_delistings)
    .bind(run.duration_ms)
    .fetch_one(pool)
    .await?;

    Ok(id)
}

/// Batch insert NAV series points.
pub async fn sim_batch_insert_nav(
    pool: &PgPool,
    run_id: i64,
    points: &[SimNavPoint],
) -> Result<u64, sqlx::Error> {
    if points.is_empty() {
        return Ok(0);
    }

    let mut run_ids = Vec::with_capacity(points.len());
    let mut dates = Vec::with_capacity(points.len());
    let mut navs = Vec::with_capacity(points.len());
    let mut drawdowns = Vec::with_capacity(points.len());

    for p in points {
        run_ids.push(run_id);
        dates.push(p.nav_date);
        navs.push(p.nav);
        drawdowns.push(p.drawdown_pct);
    }

    let result = sqlx::query(
        "INSERT INTO sim_nav_series (sim_run_id, nav_date, nav, drawdown_pct)
         SELECT * FROM UNNEST($1::int8[], $2::date[], $3::float8[], $4::float8[])
         ON CONFLICT (sim_run_id, nav_date) DO NOTHING"
    )
    .bind(&run_ids)
    .bind(&dates)
    .bind(&navs)
    .bind(&drawdowns)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Batch insert holdings.
pub async fn sim_batch_insert_holdings(
    pool: &PgPool,
    run_id: i64,
    holdings: &[SimHoldingRow],
) -> Result<u64, sqlx::Error> {
    if holdings.is_empty() {
        return Ok(0);
    }

    let mut run_ids = Vec::with_capacity(holdings.len());
    let mut dates = Vec::with_capacity(holdings.len());
    let mut coin_ids = Vec::with_capacity(holdings.len());
    let mut symbols = Vec::with_capacity(holdings.len());
    let mut weights = Vec::with_capacity(holdings.len());
    let mut quantities = Vec::with_capacity(holdings.len());
    let mut prices = Vec::with_capacity(holdings.len());

    for h in holdings {
        run_ids.push(run_id);
        dates.push(h.rebalance_date);
        coin_ids.push(h.coin_id.as_str());
        symbols.push(h.symbol.as_str());
        weights.push(h.weight);
        quantities.push(h.quantity);
        prices.push(h.price_usd);
    }

    let result = sqlx::query(
        "INSERT INTO sim_holdings (sim_run_id, rebalance_date, coin_id, symbol, weight, quantity, price_usd)
         SELECT * FROM UNNEST($1::int8[], $2::date[], $3::text[], $4::text[], $5::float8[], $6::float8[], $7::float8[])
         ON CONFLICT (sim_run_id, rebalance_date, coin_id) DO NOTHING"
    )
    .bind(&run_ids)
    .bind(&dates)
    .bind(&coin_ids)
    .bind(&symbols)
    .bind(&weights)
    .bind(&quantities)
    .bind(&prices)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Batch insert trades.
pub async fn sim_batch_insert_trades(
    pool: &PgPool,
    run_id: i64,
    trades: &[SimTradeRow],
) -> Result<u64, sqlx::Error> {
    if trades.is_empty() {
        return Ok(0);
    }

    let mut run_ids = Vec::with_capacity(trades.len());
    let mut dates = Vec::with_capacity(trades.len());
    let mut coin_ids = Vec::with_capacity(trades.len());
    let mut sides = Vec::with_capacity(trades.len());
    let mut quantities = Vec::with_capacity(trades.len());
    let mut prices = Vec::with_capacity(trades.len());
    let mut fee_pcts = Vec::with_capacity(trades.len());
    let mut fee_usds = Vec::with_capacity(trades.len());
    let mut reasons: Vec<Option<&str>> = Vec::with_capacity(trades.len());

    for t in trades {
        run_ids.push(run_id);
        dates.push(t.trade_date);
        coin_ids.push(t.coin_id.as_str());
        sides.push(t.side.as_str());
        quantities.push(t.quantity);
        prices.push(t.price_usd);
        fee_pcts.push(t.fee_pct);
        fee_usds.push(t.fee_usd);
        reasons.push(t.reason.as_deref());
    }

    let result = sqlx::query(
        "INSERT INTO sim_trades (sim_run_id, trade_date, coin_id, side, quantity, price_usd, fee_pct, fee_usd, reason)
         SELECT * FROM UNNEST($1::int8[], $2::date[], $3::text[], $4::text[], $5::float8[], $6::float8[], $7::float8[], $8::float8[], $9::text[])"
    )
    .bind(&run_ids)
    .bind(&dates)
    .bind(&coin_ids)
    .bind(&sides)
    .bind(&quantities)
    .bind(&prices)
    .bind(&fee_pcts)
    .bind(&fee_usds)
    .bind(&reasons)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Query NAV series for a run, ordered by date.
pub async fn sim_query_nav_series(pool: &PgPool, run_id: i64) -> Result<Vec<SimNavPoint>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (chrono::NaiveDate, f64, f64)>(
        "SELECT nav_date, nav, drawdown_pct FROM sim_nav_series
         WHERE sim_run_id = $1 ORDER BY nav_date ASC"
    )
    .bind(run_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(nav_date, nav, drawdown_pct)| SimNavPoint { nav_date, nav, drawdown_pct }).collect())
}

/// Query holdings at a specific rebalance date.
pub async fn sim_query_holdings_at(
    pool: &PgPool,
    run_id: i64,
    date: Option<chrono::NaiveDate>,
) -> Result<Vec<SimHoldingRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (chrono::NaiveDate, String, String, f64, f64, f64)>(
        "SELECT rebalance_date, coin_id, symbol, weight, quantity, price_usd
         FROM sim_holdings
         WHERE sim_run_id = $1
           AND rebalance_date = COALESCE($2, (SELECT MAX(rebalance_date) FROM sim_holdings WHERE sim_run_id = $1))
         ORDER BY weight DESC"
    )
    .bind(run_id)
    .bind(date)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(rebalance_date, coin_id, symbol, weight, quantity, price_usd)| SimHoldingRow {
        rebalance_date, coin_id, symbol, weight, quantity, price_usd,
    }).collect())
}

/// List all cached runs, optionally filtered by category.
pub async fn sim_list_runs(
    pool: &PgPool,
    category_filter: Option<&str>,
) -> Result<Vec<SimRunRow>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, category_id, top_n, weighting, rebalance_days, start_date, end_date,
                total_return_pct, annualized_return, max_drawdown_pct, sharpe_ratio,
                base_fee_pct, spread_multiplier, total_fees_pct, total_trades,
                total_rebalances, total_delistings, computed_at, duration_ms
         FROM sim_runs
         WHERE ($1::text IS NULL OR category_id = $1)
         ORDER BY computed_at DESC"
    )
    .bind(category_filter)
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(|r| sim_row_from_pg(r)).collect())
}

/// Delete a cached run (CASCADE deletes nav, holdings, trades).
pub async fn sim_delete_run(pool: &PgPool, run_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM sim_runs WHERE id = $1")
        .bind(run_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Get category coins with market cap at a specific date (for simulation).
/// Returns coins in this category that have price data on the given date, sorted by market cap.
pub async fn cg_query_category_market_caps_at(
    pool: &PgPool,
    category_id: &str,
    date: chrono::NaiveDate,
    limit: i64,
) -> Result<Vec<CgMarketCapRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<f64>, Option<f64>, Option<f64>, Option<i32>, chrono::NaiveDate)>(
        "SELECT m.coin_id, m.symbol, m.name, m.market_cap_usd, m.price_usd,
                m.total_volume_usd, m.market_cap_rank, m.snapshot_date
         FROM coingecko_category_coins cc
         JOIN LATERAL (
             SELECT coin_id, symbol, name, market_cap_usd, price_usd,
                    total_volume_usd, market_cap_rank, snapshot_date
             FROM coingecko_market_caps
             WHERE coin_id = cc.coin_id AND snapshot_date = $2
             LIMIT 1
         ) m ON true
         WHERE cc.category_id = $1
         ORDER BY m.market_cap_usd DESC NULLS LAST
         LIMIT $3"
    )
    .bind(category_id)
    .bind(date)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date)| CgMarketCapRow {
        coin_id, symbol, name, market_cap_usd, price_usd, total_volume_usd, market_cap_rank, snapshot_date,
    }).collect())
}

/// Query average spread for a Bitget symbol from liquidity snapshots, closest to a date.
pub async fn sim_query_spread_at(
    pool: &PgPool,
    symbol: &str,
    date: chrono::NaiveDate,
) -> Result<Option<f64>, sqlx::Error> {
    // Get average spread within ±7 days of the target date
    let spread = sqlx::query_scalar::<_, f64>(
        "SELECT AVG(spread_bps)
         FROM liquidity_snapshots
         WHERE symbol = $1
           AND fetched_at >= ($2::date - INTERVAL '7 days')::timestamptz
           AND fetched_at <= ($2::date + INTERVAL '7 days')::timestamptz
           AND spread_bps > 0"
    )
    .bind(symbol)
    .bind(date)
    .fetch_optional(pool)
    .await?;

    Ok(spread)
}

/// Efficient single-query: for each category, count coins that have CG data AND a matching
/// Bitget USDT listing (by uppercase symbol). Returns categories with >= min_coins eligible.
pub async fn sim_query_eligible_categories(
    pool: &PgPool,
    min_coins: i64,
) -> Result<Vec<(String, String, i64, Option<f64>)>, sqlx::Error> {
    // Join categories → category_coins → latest market cap → bitget listings
    // Count eligible coins per category in one pass
    let rows = sqlx::query_as::<_, (String, String, i64, Option<f64>)>(
        "SELECT cat.id, cat.name, COUNT(*) AS eligible_count, cat.market_cap
         FROM coingecko_categories cat
         JOIN coingecko_category_coins cc ON cc.category_id = cat.id
         JOIN LATERAL (
             SELECT symbol FROM coingecko_market_caps
             WHERE coin_id = cc.coin_id
             ORDER BY snapshot_date DESC LIMIT 1
         ) m ON true
         JOIN bitget_listings bl ON bl.base_coin = UPPER(m.symbol)
            AND bl.quote_coin = 'USDT'
            AND bl.status != 'delisted_gone'
         GROUP BY cat.id, cat.name, cat.market_cap
         HAVING COUNT(*) >= $1
         ORDER BY cat.market_cap DESC NULLS LAST"
    )
    .bind(min_coins)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

// ---- DefiLlama functions ----

/// Batch upsert DefiLlama protocols.
pub async fn dl_batch_upsert_protocols(
    pool: &PgPool,
    rows: &[(String, String, Option<String>, Option<String>, Option<String>, Vec<String>, Option<f64>, Option<f64>, Option<f64>, Option<f64>)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut total = 0u64;
    for chunk in rows.chunks(3000) {
        let mut slugs = Vec::with_capacity(chunk.len());
        let mut names = Vec::with_capacity(chunk.len());
        let mut gecko_ids: Vec<Option<&str>> = Vec::with_capacity(chunk.len());
        let mut symbols: Vec<Option<&str>> = Vec::with_capacity(chunk.len());
        let mut categories: Vec<Option<&str>> = Vec::with_capacity(chunk.len());
        let mut tvls: Vec<Option<f64>> = Vec::with_capacity(chunk.len());
        let mut changes_1d: Vec<Option<f64>> = Vec::with_capacity(chunk.len());
        let mut changes_7d: Vec<Option<f64>> = Vec::with_capacity(chunk.len());
        let mut mcaps: Vec<Option<f64>> = Vec::with_capacity(chunk.len());

        for (slug, name, gecko_id, symbol, category, _chains, tvl, change_1d, change_7d, mcap) in chunk {
            slugs.push(slug.as_str());
            names.push(name.as_str());
            gecko_ids.push(gecko_id.as_deref());
            symbols.push(symbol.as_deref());
            categories.push(category.as_deref());
            tvls.push(*tvl);
            changes_1d.push(*change_1d);
            changes_7d.push(*change_7d);
            mcaps.push(*mcap);
        }

        let result = sqlx::query(
            "INSERT INTO defillama_protocols (slug, name, gecko_id, symbol, category, tvl, tvl_change_1d, tvl_change_7d, mcap, updated_at)
             SELECT s, n, g, sy, cat, t, c1, c7, mc, NOW()
             FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::float8[], $7::float8[], $8::float8[], $9::float8[])
                AS t(s, n, g, sy, cat, t, c1, c7, mc)
             ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                gecko_id = EXCLUDED.gecko_id,
                symbol = EXCLUDED.symbol,
                category = EXCLUDED.category,
                tvl = EXCLUDED.tvl,
                tvl_change_1d = EXCLUDED.tvl_change_1d,
                tvl_change_7d = EXCLUDED.tvl_change_7d,
                mcap = EXCLUDED.mcap,
                updated_at = NOW()"
        )
        .bind(&slugs)
        .bind(&names)
        .bind(&gecko_ids)
        .bind(&symbols)
        .bind(&categories)
        .bind(&tvls)
        .bind(&changes_1d)
        .bind(&changes_7d)
        .bind(&mcaps)
        .execute(pool)
        .await?;

        total += result.rows_affected();
    }

    Ok(total)
}

/// Count protocols in the defillama_protocols table.
pub async fn dl_protocol_count(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM defillama_protocols")
        .fetch_one(pool)
        .await?;
    Ok(count)
}

/// Get all protocol slugs.
pub async fn dl_query_all_protocol_slugs(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>("SELECT slug FROM defillama_protocols ORDER BY slug")
        .fetch_all(pool)
        .await
}

/// Get protocols that have a non-null gecko_id.
/// Returns (slug, gecko_id, category, tvl, tvl_change_7d, mcap).
pub async fn dl_query_protocols_with_gecko_id(
    pool: &PgPool,
) -> Result<Vec<(String, String, Option<String>, Option<f64>, Option<f64>, Option<f64>)>, sqlx::Error> {
    sqlx::query_as::<_, (String, String, Option<String>, Option<f64>, Option<f64>, Option<f64>)>(
        "SELECT slug, gecko_id, category, tvl, tvl_change_7d, mcap
         FROM defillama_protocols
         WHERE gecko_id IS NOT NULL"
    )
    .fetch_all(pool)
    .await
}

/// Batch upsert DefiLlama protocol metrics (fees, revenue, volume).
pub async fn dl_batch_upsert_metrics(
    pool: &PgPool,
    rows: &[(String, chrono::NaiveDate, String, Option<f64>, Option<f64>, Option<f64>)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut slugs = Vec::with_capacity(rows.len());
    let mut dates = Vec::with_capacity(rows.len());
    let mut types = Vec::with_capacity(rows.len());
    let mut v24h: Vec<Option<f64>> = Vec::with_capacity(rows.len());
    let mut v7d: Vec<Option<f64>> = Vec::with_capacity(rows.len());
    let mut v30d: Vec<Option<f64>> = Vec::with_capacity(rows.len());

    for (slug, date, metric_type, val24, val7, val30) in rows {
        slugs.push(slug.as_str());
        dates.push(*date);
        types.push(metric_type.as_str());
        v24h.push(*val24);
        v7d.push(*val7);
        v30d.push(*val30);
    }

    let result = sqlx::query(
        "INSERT INTO defillama_protocol_metrics (slug, snapshot_date, metric_type, value_24h, value_7d, value_30d)
         SELECT * FROM UNNEST($1::text[], $2::date[], $3::text[], $4::float8[], $5::float8[], $6::float8[])
         ON CONFLICT (slug, snapshot_date, metric_type) DO UPDATE SET
            value_24h = EXCLUDED.value_24h,
            value_7d = EXCLUDED.value_7d,
            value_30d = EXCLUDED.value_30d"
    )
    .bind(&slugs)
    .bind(&dates)
    .bind(&types)
    .bind(&v24h)
    .bind(&v7d)
    .bind(&v30d)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Query latest metrics by type. Returns (slug, value_24h, value_7d, value_30d).
pub async fn dl_query_latest_metrics_by_type(
    pool: &PgPool,
    metric_type: &str,
) -> Result<Vec<(String, Option<f64>, Option<f64>, Option<f64>)>, sqlx::Error> {
    sqlx::query_as::<_, (String, Option<f64>, Option<f64>, Option<f64>)>(
        "SELECT DISTINCT ON (slug) slug, value_24h, value_7d, value_30d
         FROM defillama_protocol_metrics
         WHERE metric_type = $1
         ORDER BY slug, snapshot_date DESC"
    )
    .bind(metric_type)
    .fetch_all(pool)
    .await
}

/// Batch upsert DefiLlama yield pools.
pub async fn dl_batch_upsert_yield_pools(
    pool: &PgPool,
    rows: &[(String, String, String, Option<String>, Option<f64>, Option<f64>, Option<f64>, Option<f64>)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut pool_ids = Vec::with_capacity(rows.len());
    let mut chains = Vec::with_capacity(rows.len());
    let mut projects = Vec::with_capacity(rows.len());
    let mut symbols: Vec<Option<&str>> = Vec::with_capacity(rows.len());
    let mut tvls: Vec<Option<f64>> = Vec::with_capacity(rows.len());
    let mut apys: Vec<Option<f64>> = Vec::with_capacity(rows.len());
    let mut apy_bases: Vec<Option<f64>> = Vec::with_capacity(rows.len());
    let mut apy_rewards: Vec<Option<f64>> = Vec::with_capacity(rows.len());

    for (pool_id, chain, project, symbol, tvl, apy, apy_base, apy_reward) in rows {
        pool_ids.push(pool_id.as_str());
        chains.push(chain.as_str());
        projects.push(project.as_str());
        symbols.push(symbol.as_deref());
        tvls.push(*tvl);
        apys.push(*apy);
        apy_bases.push(*apy_base);
        apy_rewards.push(*apy_reward);
    }

    let result = sqlx::query(
        "INSERT INTO defillama_yield_pools (pool_id, chain, project, symbol, tvl_usd, apy, apy_base, apy_reward, updated_at)
         SELECT p, ch, pr, sy, t, a, ab, ar, NOW()
         FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::float8[], $7::float8[], $8::float8[])
            AS t(p, ch, pr, sy, t, a, ab, ar)
         ON CONFLICT (pool_id) DO UPDATE SET
            chain = EXCLUDED.chain,
            project = EXCLUDED.project,
            symbol = EXCLUDED.symbol,
            tvl_usd = EXCLUDED.tvl_usd,
            apy = EXCLUDED.apy,
            apy_base = EXCLUDED.apy_base,
            apy_reward = EXCLUDED.apy_reward,
            updated_at = NOW()"
    )
    .bind(&pool_ids)
    .bind(&chains)
    .bind(&projects)
    .bind(&symbols)
    .bind(&tvls)
    .bind(&apys)
    .bind(&apy_bases)
    .bind(&apy_rewards)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Query max yield APY per project.
pub async fn dl_query_max_yield_by_project(
    pool: &PgPool,
) -> Result<Vec<(String, f64)>, sqlx::Error> {
    sqlx::query_as::<_, (String, f64)>(
        "SELECT project, MAX(apy) AS max_apy
         FROM defillama_yield_pools
         WHERE apy IS NOT NULL AND apy > 0
         GROUP BY project"
    )
    .fetch_all(pool)
    .await
}

/// Batch upsert DefiLlama raises.
pub async fn dl_batch_upsert_raises(
    pool: &PgPool,
    rows: &[(String, Option<String>, Option<String>, Option<f64>, Option<f64>, Option<chrono::NaiveDate>, Option<String>, Vec<String>, Vec<String>, Vec<String>, Option<String>)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut total = 0u64;
    for (name, defillama_id, round, amount, valuation, raise_date, category, _chains, lead_investors, _other_investors, source) in rows {
        let result = sqlx::query(
            "INSERT INTO defillama_raises (name, defillama_id, round, amount_m, valuation_m, raise_date, category, lead_investors, source_url, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT DO NOTHING"
        )
        .bind(name)
        .bind(defillama_id)
        .bind(round)
        .bind(amount)
        .bind(valuation)
        .bind(raise_date)
        .bind(category)
        .bind(lead_investors)
        .bind(source)
        .execute(pool)
        .await?;
        total += result.rows_affected();
    }

    Ok(total)
}

/// Query raises for a set of defillama_ids (slugs).
/// Returns (defillama_id, round, amount_m, valuation_m, raise_date, lead_investors, other_investors).
pub async fn dl_query_raises_for_slugs(
    pool: &PgPool,
    slugs: &[String],
) -> Result<Vec<(String, Option<String>, Option<f64>, Option<f64>, Option<chrono::NaiveDate>, Vec<String>, Vec<String>)>, sqlx::Error> {
    if slugs.is_empty() {
        return Ok(vec![]);
    }
    let slug_refs: Vec<&str> = slugs.iter().map(|s| s.as_str()).collect();
    sqlx::query_as::<_, (String, Option<String>, Option<f64>, Option<f64>, Option<chrono::NaiveDate>, Vec<String>, Vec<String>)>(
        "SELECT COALESCE(defillama_id, ''), round, amount_m, valuation_m, raise_date, lead_investors, COALESCE(other_investors, ARRAY[]::text[])
         FROM defillama_raises
         WHERE defillama_id = ANY($1)
         ORDER BY raise_date DESC NULLS LAST"
    )
    .bind(&slug_refs)
    .fetch_all(pool)
    .await
}

/// Query top investors by raise count.
pub async fn dl_query_investors(
    pool: &PgPool,
) -> Result<Vec<(String, i64)>, sqlx::Error> {
    sqlx::query_as::<_, (String, i64)>(
        "SELECT investor_name, COUNT(*) AS raise_count
         FROM defillama_investors
         GROUP BY investor_name
         ORDER BY raise_count DESC
         LIMIT 200"
    )
    .fetch_all(pool)
    .await
}

/// Batch upsert history rows (TVL/fees/volume daily data).
pub async fn dl_batch_upsert_history(
    pool: &PgPool,
    rows: &[(String, chrono::NaiveDate, String, f64)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut total = 0u64;
    for chunk in rows.chunks(5000) {
        let mut slugs = Vec::with_capacity(chunk.len());
        let mut dates = Vec::with_capacity(chunk.len());
        let mut types = Vec::with_capacity(chunk.len());
        let mut values = Vec::with_capacity(chunk.len());

        for (slug, date, metric_type, value) in chunk {
            slugs.push(slug.as_str());
            dates.push(*date);
            types.push(metric_type.as_str());
            values.push(*value);
        }

        let result = sqlx::query(
            "INSERT INTO defillama_protocol_history (slug, history_date, metric_type, value)
             SELECT * FROM UNNEST($1::text[], $2::date[], $3::text[], $4::float8[])
             ON CONFLICT (slug, history_date, metric_type) DO UPDATE SET value = EXCLUDED.value"
        )
        .bind(&slugs)
        .bind(&dates)
        .bind(&types)
        .bind(&values)
        .execute(pool)
        .await?;

        total += result.rows_affected();
    }

    Ok(total)
}

/// Get slugs that have already been backfilled for a given metric type.
pub async fn dl_get_backfilled_slugs(
    pool: &PgPool,
    metric_type: &str,
) -> Result<std::collections::HashSet<String>, sqlx::Error> {
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT slug FROM defillama_backfill_progress WHERE metric_type = $1"
    )
    .bind(metric_type)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().collect())
}

/// Mark a protocol+metric as backfilled.
pub async fn dl_mark_backfill_done(
    pool: &PgPool,
    slug: &str,
    metric_type: &str,
    rows_inserted: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO defillama_backfill_progress (slug, metric_type, rows_inserted)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug, metric_type) DO UPDATE SET
            completed_at = NOW(),
            rows_inserted = EXCLUDED.rows_inserted"
    )
    .bind(slug)
    .bind(metric_type)
    .bind(rows_inserted)
    .execute(pool)
    .await?;
    Ok(())
}

/// Query all history rows for a set of slugs.
/// Returns (slug, history_date, metric_type, value).
pub async fn dl_query_all_history_for_slugs(
    pool: &PgPool,
    slugs: &[String],
) -> Result<Vec<(String, chrono::NaiveDate, String, f64)>, sqlx::Error> {
    if slugs.is_empty() {
        return Ok(vec![]);
    }
    let slug_refs: Vec<&str> = slugs.iter().map(|s| s.as_str()).collect();
    sqlx::query_as::<_, (String, chrono::NaiveDate, String, f64)>(
        "SELECT slug, history_date, metric_type, value
         FROM defillama_protocol_history
         WHERE slug = ANY($1)
         ORDER BY slug, history_date"
    )
    .bind(&slug_refs)
    .fetch_all(pool)
    .await
}

// ---- Fear & Greed Index functions ----

/// Batch upsert FNG index entries.
pub async fn fng_batch_upsert(
    pool: &PgPool,
    rows: &[(chrono::NaiveDate, i32, String)],
) -> Result<u64, sqlx::Error> {
    if rows.is_empty() {
        return Ok(0);
    }

    let mut dates = Vec::with_capacity(rows.len());
    let mut values = Vec::with_capacity(rows.len());
    let mut classifications = Vec::with_capacity(rows.len());

    for (date, value, classification) in rows {
        dates.push(*date);
        values.push(*value);
        classifications.push(classification.as_str());
    }

    let result = sqlx::query(
        "INSERT INTO fng_index (fng_date, value, classification)
         SELECT * FROM UNNEST($1::date[], $2::int4[], $3::text[])
         ON CONFLICT (fng_date) DO UPDATE SET
            value = EXCLUDED.value,
            classification = EXCLUDED.classification"
    )
    .bind(&dates)
    .bind(&values)
    .bind(&classifications)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Query the latest FNG entry.
pub async fn fng_query_latest(
    pool: &PgPool,
) -> Result<Option<(chrono::NaiveDate, i32, String)>, sqlx::Error> {
    sqlx::query_as::<_, (chrono::NaiveDate, i32, String)>(
        "SELECT fng_date, value, classification FROM fng_index ORDER BY fng_date DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await
}

/// Query all FNG entries.
pub async fn fng_query_all(
    pool: &PgPool,
) -> Result<Vec<(chrono::NaiveDate, i32, String)>, sqlx::Error> {
    sqlx::query_as::<_, (chrono::NaiveDate, i32, String)>(
        "SELECT fng_date, value, classification FROM fng_index ORDER BY fng_date ASC"
    )
    .fetch_all(pool)
    .await
}
