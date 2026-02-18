use chrono::{DateTime, Timelike, Utc};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tracing::info;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
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
    info!("Database migrations applied");
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
        "SELECT DISTINCT ON (symbol) symbol, price, fetched_at
         FROM prices WHERE symbol = ANY($1)
         ORDER BY symbol, fetched_at DESC"
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
        "SELECT DISTINCT ON (symbol) symbol, close, open_time
         FROM klines WHERE symbol = ANY($1)
         ORDER BY symbol, open_time DESC"
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

/// Get all unique snapshot dates.
pub async fn cg_query_snapshot_dates(pool: &PgPool) -> Result<Vec<chrono::NaiveDate>, sqlx::Error> {
    let rows = sqlx::query_scalar::<_, chrono::NaiveDate>(
        "SELECT DISTINCT snapshot_date FROM coingecko_market_caps ORDER BY snapshot_date ASC"
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
