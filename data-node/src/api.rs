use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Path as AxumPath, Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use axum::routing::get;
use axum::Router;
use chrono::{DateTime, Utc};
use ethers::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

use crate::collector::CollectorState;
use crate::db;
use crate::live_cache::{CachedTicker, LiveTickerCache};
use crate::simulation;

pub struct AppState {
    pub pool: PgPool,
    pub collector: Arc<CollectorState>,
    pub symbol_map: HashMap<String, String>,
    pub cache: PriceCache,
    pub live_cache: Arc<LiveTickerCache>,
    pub l3_provider: Arc<Provider<Http>>,
    pub arb_provider: Arc<Provider<Http>>,
    pub deployment: serde_json::Value,
    pub morpho_deployment: serde_json::Value,
    pub logos_dir: std::path::PathBuf,
    /// Global simulation data cache — loaded once at startup, eliminates per-sim DB reads.
    pub sim_cache: Arc<simulation::SimDataCache>,
}

/// In-memory TTL cache for hot endpoints.
/// Collector writes to DB every ~30s, so a 5s TTL is plenty fresh.
pub struct PriceCache {
    /// key = sorted,comma-joined symbols → (inserted_at, symbol→price map)
    latest_prices: RwLock<HashMap<String, (Instant, HashMap<String, String>)>>,
    /// key = itp_id → (inserted_at, cached response fields)
    itp_price: RwLock<HashMap<String, (Instant, CachedItpPrice)>>,
    ttl: Duration,
}

#[derive(Clone)]
struct CachedItpPrice {
    nav: String,
    nav_display: String,
    assets_priced: usize,
    assets_total: usize,
    timestamp: DateTime<Utc>,
}

impl PriceCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            latest_prices: RwLock::new(HashMap::new()),
            itp_price: RwLock::new(HashMap::new()),
            ttl: Duration::from_secs(ttl_secs),
        }
    }
}

/// Load symbol-map.json: address (lowercase) → Bitget pair
pub fn load_symbol_map(
    path: &str,
) -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(path)?;
    let raw: HashMap<String, serde_json::Value> = serde_json::from_str(&content)?;

    let mut map = HashMap::new();
    for (address, entry) in raw {
        if let Some(pair) = entry.get("pair").and_then(|v| v.as_str()) {
            map.insert(address.to_lowercase(), pair.to_string());
        }
    }

    tracing::info!(entries = map.len(), path, "Loaded symbol map for API");
    Ok(map)
}

pub fn router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/price", get(price))
        .route("/prices", get(prices))
        .route("/verify-nav", get(verify_nav))
        .route("/itp-price", get(itp_price))
        .route("/nav-series", get(nav_series))
        .route("/aum-ranking", get(aum_ranking))
        .route("/portfolio", get(portfolio))
        .route("/portfolio/history", get(portfolio_history))
        .route("/portfolio/trades", get(portfolio_trades))
        .route("/latest-prices", get(latest_prices))
        .route("/prices-by-address", get(prices_by_address))
        .route("/fast-prices", get(fast_prices))
        .route("/fast-prices-by-address", get(fast_prices_by_address))
        .route("/itp-bid-ask", get(itp_bid_ask))
        .route("/liquidity", get(liquidity))
        .route("/liquidity/alerts", get(liquidity_alerts))
        .route("/user-state", get(user_state))
        .route("/morpho-position", get(morpho_position))
        .route("/order", get(order))
        .route("/vault-balances", get(vault_balances))
        .route("/logo/:coin_id", get(serve_logo))
        .route("/cg/categories", get(cg_categories))
        .route("/cg/category-coins/:category_id", get(cg_category_coins))
        .route("/cg/coin-categories/:coin_id", get(cg_coin_categories))
        .route("/listings", get(listings))
        .route("/listings/unsafe", get(listings_unsafe))
        .route("/listing", get(listing))
        .route("/sim/categories", get(sim_categories))
        .route("/sim/run", get(sim_run))
        .route("/sim/run-stream", get(sim_run_stream))
        .route("/sim/sweep-stream", get(sim_sweep_stream))
        .route("/sim/results", get(sim_results))
        .route("/sim/compare", get(sim_compare))
        .route("/sim/holdings", get(sim_holdings))
        .route("/sim/invalidate", get(sim_invalidate))
        .route("/sim/benchmarks", get(sim_benchmarks))
        .layer(cors)
        .with_state(state)
}

// ---- /health ----

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    db_connected: bool,
    last_fetch_at: Option<DateTime<Utc>>,
    symbols_tracked: usize,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let db_connected = db::is_connected(&state.pool).await;
    let last_fetch_at = *state.collector.last_fetch_at.read().await;
    let symbols_tracked = *state.collector.symbols_tracked.read().await;

    Json(HealthResponse {
        status: if db_connected { "healthy".into() } else { "degraded".into() },
        db_connected,
        last_fetch_at,
        symbols_tracked,
    })
}

// ---- /price ----

#[derive(Deserialize)]
struct PriceQuery {
    symbol: String,
    at: DateTime<Utc>,
}

#[derive(Serialize)]
struct PriceResponse {
    symbol: String,
    price: String,
    fetched_at: DateTime<Utc>,
    delta_seconds: i64,
}

async fn price(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PriceQuery>,
) -> Result<Json<PriceResponse>, (StatusCode, Json<ErrorResponse>)> {
    let row = db::query_nearest_price(&state.pool, &params.symbol, params.at)
        .await
        .map_err(|e| db_error(e))?;

    match row {
        Some(r) => {
            let delta = (r.fetched_at - params.at).num_seconds();
            Ok(Json(PriceResponse {
                symbol: r.symbol,
                price: r.price,
                fetched_at: r.fetched_at,
                delta_seconds: delta,
            }))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse { error: format!("No price data for symbol '{}'", params.symbol) }),
        )),
    }
}

// ---- /prices ----

#[derive(Deserialize)]
struct PricesQuery {
    symbols: String,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    interval: Option<String>,
}

#[derive(Serialize)]
struct PricePoint {
    price: String,
    at: DateTime<Utc>,
}

async fn prices(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PricesQuery>,
) -> Result<Json<HashMap<String, Vec<PricePoint>>>, (StatusCode, Json<ErrorResponse>)> {
    // Validate interval if provided
    if let Some(ref iv) = params.interval {
        if !["1m", "5m", "15m", "1h", "1d"].contains(&iv.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse { error: format!("Invalid interval '{}'. Valid: 1m, 5m, 15m, 1h, 1d", iv) }),
            ));
        }
    }

    let symbol_list: Vec<&str> = params.symbols.split(',').map(|s| s.trim()).collect();
    if symbol_list.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "symbols parameter is required".into() }),
        ));
    }

    let rows = db::query_price_series(
        &state.pool,
        &symbol_list,
        params.from,
        params.to,
        params.interval.as_deref(),
        10_000,
    )
    .await
    .map_err(|e| db_error(e))?;

    let mut result: HashMap<String, Vec<PricePoint>> = HashMap::new();
    for row in rows {
        result
            .entry(row.symbol)
            .or_default()
            .push(PricePoint { price: row.price, at: row.fetched_at });
    }

    Ok(Json(result))
}

// ---- /verify-nav ----

#[derive(Deserialize)]
struct VerifyNavQuery {
    itp_id: String,
    at: DateTime<Utc>,
}

#[derive(Serialize)]
struct VerifyNavResponse {
    itp_id: String,
    at: DateTime<Utc>,
    computed_nav: String,
    snapshot_from: DateTime<Utc>,
    snapshot_type: String,
    assets_priced: usize,
    assets_total: usize,
}

async fn verify_nav(
    State(state): State<Arc<AppState>>,
    Query(params): Query<VerifyNavQuery>,
) -> Result<Json<VerifyNavResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Normalize itp_id to lowercase 0x-prefixed 64-char hex
    let itp_id = params.itp_id.to_lowercase();

    // Find the active snapshot at the requested time
    let snapshot = db::query_itp_snapshot_at(&state.pool, &itp_id, params.at)
        .await
        .map_err(|e| db_error(e))?;

    let snapshot = match snapshot {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("No snapshot found for ITP '{}' at {}", itp_id, params.at),
                }),
            ));
        }
    };

    if snapshot.assets.len() != snapshot.inventory.len() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Snapshot has mismatched assets/inventory lengths".into(),
            }),
        ));
    }

    // For each asset, look up the nearest price at the requested time
    let mut nav_sum: f64 = 0.0;
    let mut assets_priced: usize = 0;
    let assets_total = snapshot.assets.len();

    for (i, asset_addr) in snapshot.assets.iter().enumerate() {
        let inventory_str = &snapshot.inventory[i];
        let inventory_val: f64 = inventory_str.parse().unwrap_or(0.0);

        // Map address to Bitget pair
        let pair = match state.symbol_map.get(&asset_addr.to_lowercase()) {
            Some(p) => p,
            None => {
                tracing::warn!(asset = %asset_addr, "No symbol mapping for asset, skipping");
                continue;
            }
        };

        // Find nearest price
        match db::query_nearest_price(&state.pool, pair, params.at).await {
            Ok(Some(price_row)) => {
                let price_val: f64 = price_row.price.parse().unwrap_or(0.0);
                // NAV = sum(qty[i] * price[i]) / 1e18
                nav_sum += inventory_val * price_val;
                assets_priced += 1;
            }
            Ok(None) => {
                tracing::warn!(pair = %pair, "No price data for asset at requested time");
            }
            Err(e) => {
                tracing::error!(pair = %pair, %e, "DB error looking up price");
            }
        }
    }

    // Divide by 1e18 (inventory quantities are in wei-scale)
    let computed_nav = nav_sum / 1e18;

    Ok(Json(VerifyNavResponse {
        itp_id,
        at: params.at,
        computed_nav: format!("{:.6}", computed_nav),
        snapshot_from: snapshot.valid_from,
        snapshot_type: snapshot.event_type,
        assets_priced,
        assets_total,
    }))
}

// ---- /itp-price ----

#[derive(Deserialize)]
struct ItpPriceQuery {
    itp_id: String,
}

#[derive(Clone, Serialize)]
struct ItpPriceResponse {
    itp_id: String,
    nav: String,
    nav_display: String,
    assets_priced: usize,
    assets_total: usize,
    timestamp: DateTime<Utc>,
}

async fn itp_price(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ItpPriceQuery>,
) -> Result<Json<ItpPriceResponse>, (StatusCode, Json<ErrorResponse>)> {
    let itp_id = params.itp_id.to_lowercase();

    // Check cache
    {
        let cache = state.cache.itp_price.read().await;
        if let Some((inserted_at, cached)) = cache.get(&itp_id) {
            if inserted_at.elapsed() < state.cache.ttl {
                return Ok(Json(ItpPriceResponse {
                    itp_id: itp_id.clone(),
                    nav: cached.nav.clone(),
                    nav_display: cached.nav_display.clone(),
                    assets_priced: cached.assets_priced,
                    assets_total: cached.assets_total,
                    timestamp: cached.timestamp,
                }));
            }
        }
    }

    // Find the latest snapshot for this ITP
    let snapshot = db::query_itp_snapshot_at(&state.pool, &itp_id, Utc::now())
        .await
        .map_err(|e| db_error(e))?;

    let snapshot = match snapshot {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("No snapshot found for ITP '{}'", itp_id),
                }),
            ));
        }
    };

    if snapshot.assets.len() != snapshot.inventory.len() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Snapshot has mismatched assets/inventory lengths".into(),
            }),
        ));
    }

    let assets_total = snapshot.assets.len();

    // Map asset addresses to Bitget symbols
    let mut symbols: Vec<String> = Vec::new();
    let mut asset_symbol_idx: Vec<Option<usize>> = Vec::with_capacity(assets_total);

    for asset_addr in &snapshot.assets {
        if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
            // Check if we already have this symbol (multiple assets can map to same pair)
            if let Some(existing) = symbols.iter().position(|s| s == pair) {
                asset_symbol_idx.push(Some(existing));
            } else {
                asset_symbol_idx.push(Some(symbols.len()));
                symbols.push(pair.clone());
            }
        } else {
            asset_symbol_idx.push(None);
        }
    }

    // Multi-layer price resolution: live cache → freshest of (prices table, klines table)
    let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    let mut tickers = state.live_cache.get_prices(&symbol_refs).await;

    // For symbols missing from live cache, pick freshest from DB
    let missing: Vec<&str> = symbol_refs.iter()
        .filter(|s| !tickers.contains_key(**s))
        .copied()
        .collect();
    if !missing.is_empty() {
        if let Ok(rows) = db::query_freshest_prices_batch(&state.pool, &missing).await {
            for row in rows {
                tickers.entry(row.symbol.clone()).or_insert(CachedTicker {
                    last_price: row.price,
                    best_bid: String::new(),
                    best_ask: String::new(),
                    timestamp_ms: row.fetched_at.timestamp_millis() as u64,
                });
            }
        }
    }

    // Build symbol → price map from resolved tickers
    let price_map: HashMap<&str, f64> = symbols.iter()
        .filter_map(|s| {
            tickers.get(s.as_str())
                .and_then(|t| t.last_price.parse::<f64>().ok())
                .map(|p| (s.as_str(), p))
        })
        .collect();

    // Compute NAV = sum(inventory[i] * price[i]) / 1e18
    let mut nav_sum: f64 = 0.0;
    let mut assets_priced: usize = 0;
    let mut latest_ts = snapshot.valid_from;

    for (i, inv_str) in snapshot.inventory.iter().enumerate() {
        let inv_val: f64 = inv_str.parse().unwrap_or(0.0);
        if let Some(Some(sym_idx)) = asset_symbol_idx.get(i) {
            if let Some(&price) = price_map.get(symbols[*sym_idx].as_str()) {
                nav_sum += inv_val * price;
                assets_priced += 1;
                // Track latest price timestamp from ticker
                if let Some(ticker) = tickers.get(symbols[*sym_idx].as_str()) {
                    let ts = chrono::DateTime::from_timestamp_millis(ticker.timestamp_ms as i64)
                        .unwrap_or(snapshot.valid_from);
                    if ts > latest_ts {
                        latest_ts = ts;
                    }
                }
            }
        }
    }

    let nav_f64 = nav_sum / 1e18;
    // Convert to wei-scale string (multiply by 1e18)
    let nav_wei = format!("{:.0}", nav_sum);
    let nav_display = format!("{:.6}", nav_f64);

    // Update cache
    {
        let mut cache = state.cache.itp_price.write().await;
        cache.insert(itp_id.clone(), (Instant::now(), CachedItpPrice {
            nav: nav_wei.clone(),
            nav_display: nav_display.clone(),
            assets_priced,
            assets_total,
            timestamp: latest_ts,
        }));
    }

    Ok(Json(ItpPriceResponse {
        itp_id,
        nav: nav_wei,
        nav_display,
        assets_priced,
        assets_total,
        timestamp: latest_ts,
    }))
}

// ---- /nav-series ----

#[derive(Deserialize)]
struct NavSeriesQuery {
    itp_id: String,
    from: String,
    to: String,
    interval: Option<String>,
}

#[derive(Serialize)]
struct NavSeriesPoint {
    time: i64,
    open: String,
    high: String,
    low: String,
    close: String,
}

#[derive(Serialize)]
struct NavSeriesResponse {
    itp_id: String,
    interval: String,
    points: Vec<NavSeriesPoint>,
}

async fn nav_series(
    State(state): State<Arc<AppState>>,
    Query(params): Query<NavSeriesQuery>,
) -> Result<Json<NavSeriesResponse>, (StatusCode, Json<ErrorResponse>)> {
    let interval = params.interval.as_deref().unwrap_or("5m");
    if !["5m", "15m", "1h", "1d"].contains(&interval) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid interval '{}'. Valid: 1m, 5m, 15m, 1h, 1d", interval),
            }),
        ));
    }

    let itp_id = params.itp_id.to_lowercase();

    let from: DateTime<Utc> = params.from.parse().map_err(|e| (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse { error: format!("Invalid 'from' timestamp: {}", e) }),
    ))?;
    let to: DateTime<Utc> = params.to.parse().map_err(|e| (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse { error: format!("Invalid 'to' timestamp: {}", e) }),
    ))?;

    tracing::info!(itp_id = %itp_id, %from, %to, interval, "nav-series request");

    // Find the active snapshot (latest state for inventory/weights)
    let snapshot = db::query_itp_snapshot_at(&state.pool, &itp_id, to)
        .await
        .map_err(|e| db_error(e))?;

    let snapshot = match snapshot {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("No snapshot found for ITP '{}' before {}", itp_id, to),
                }),
            ));
        }
    };

    if snapshot.assets.len() != snapshot.inventory.len() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Snapshot has mismatched assets/inventory lengths".into(),
            }),
        ));
    }

    // Use the creation snapshot's timestamp to clamp `from` — never show data before
    // the ITP existed. We use the creation snapshot (init/created) NOT the latest
    // snapshot, because periodic snapshots update every 5min and would clamp `from`
    // to near-present, killing the chart history.
    let creation_time = match db::query_creation_snapshot(&state.pool, &itp_id).await {
        Ok(Some(cs)) => cs.valid_from,
        _ => snapshot.valid_from, // fallback to latest snapshot if no creation found
    };
    let effective_from = from.max(creation_time);

    tracing::info!(
        assets = snapshot.assets.len(),
        snapshot_from = %snapshot.valid_from,
        %effective_from,
        "nav-series: found snapshot"
    );

    // Map assets to Bitget symbols and parse inventory + weights
    let mut symbols: Vec<String> = Vec::new();
    let mut inventory: Vec<f64> = Vec::new();
    let mut weights: Vec<f64> = Vec::new();
    let mut asset_to_idx: HashMap<String, usize> = HashMap::new();

    for (i, asset_addr) in snapshot.assets.iter().enumerate() {
        let inv_val: f64 = snapshot.inventory[i].parse().unwrap_or(0.0);
        let wt_val: f64 = snapshot.weights.get(i).and_then(|w| w.parse().ok()).unwrap_or(0.0);
        if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
            if let Some(&existing) = asset_to_idx.get(pair) {
                // Same symbol mapped by multiple assets — accumulate
                inventory[existing] += inv_val;
                weights[existing] += wt_val;
            } else {
                let idx = symbols.len();
                asset_to_idx.insert(pair.clone(), idx);
                symbols.push(pair.clone());
                inventory.push(inv_val);
                weights.push(wt_val);
            }
        } else {
            tracing::warn!(asset = %asset_addr, "nav-series: no symbol mapping, skipping");
        }
    }

    tracing::info!(mapped_symbols = symbols.len(), "nav-series: symbol mapping done");

    if symbols.is_empty() {
        return Ok(Json(NavSeriesResponse {
            itp_id,
            interval: interval.to_string(),
            points: vec![],
        }));
    }

    let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();

    // Bucket interval in seconds
    let bucket_secs: i64 = match interval {
        "5m" => 300,
        "15m" => 900,
        "1h" => 3600,
        "1d" => 86400,
        _ => 300,
    };

    // Try klines-based OHLC first (preferred — continuous, gap-free)
    let kline_rows = db::query_klines(&state.pool, &symbol_refs, effective_from, to)
        .await
        .map_err(|e| db_error(e))?;

    tracing::info!(kline_rows = kline_rows.len(), "nav-series: kline data fetched");

    // Use klines only if they cover at least 50% of the requested time range.
    // Otherwise fall back to prices (which may have longer history from backfill).
    let range_secs = (to - effective_from).num_seconds().max(1);
    let kline_coverage = if kline_rows.is_empty() {
        0
    } else {
        let first_ts = kline_rows.first().unwrap().open_time.timestamp();
        let last_ts = kline_rows.last().unwrap().open_time.timestamp();
        ((last_ts - first_ts) * 100 / range_secs) as u64
    };
    let use_klines = kline_coverage >= 50;

    tracing::info!(kline_coverage, use_klines, "nav-series: kline coverage check");

    let points: Vec<NavSeriesPoint> = if use_klines {
        // ---- Klines-based path: compute ITP OHLC from per-symbol klines ----

        // Seed last-known prices from implied creation prices (weight/qty)
        let mut last_open: HashMap<String, f64> = HashMap::new();
        let mut last_high: HashMap<String, f64> = HashMap::new();
        let mut last_low: HashMap<String, f64> = HashMap::new();
        let mut last_close: HashMap<String, f64> = HashMap::new();

        for (i, sym) in symbols.iter().enumerate() {
            let qty = inventory[i];
            let wt = weights[i];
            if qty > 0.0 {
                let implied = wt / qty;
                last_open.insert(sym.clone(), implied);
                last_high.insert(sym.clone(), implied);
                last_low.insert(sym.clone(), implied);
                last_close.insert(sym.clone(), implied);
            }
        }

        // Group klines by open_time (minute)
        let mut minute_klines: std::collections::BTreeMap<i64, Vec<&db::KlineRow>> =
            std::collections::BTreeMap::new();
        for row in &kline_rows {
            minute_klines
                .entry(row.open_time.timestamp())
                .or_default()
                .push(row);
        }

        // Walk every minute in the range, producing a candle for each.
        // Minutes with klines update last-known prices; minutes without
        // produce a flat candle at the last-known close (no gap).
        let mut itp_1m_candles: Vec<(i64, f64, f64, f64, f64)> = Vec::new();

        // Snap effective_from to minute boundary
        let start_minute = (effective_from.timestamp() / 60) * 60;
        let end_minute = (to.timestamp() / 60) * 60;

        // Insert creation tick at $1.00 (before the minute walk)
        {
            let mut seed_nav: f64 = 0.0;
            for (i, sym) in symbols.iter().enumerate() {
                let price = last_close.get(sym).copied().unwrap_or(0.0);
                seed_nav += inventory[i] * price;
            }
            let nav = seed_nav / 1e18;
            if nav > 0.0 {
                itp_1m_candles.push((effective_from.timestamp(), nav, nav, nav, nav));
            }
        }

        let mut minute_ts = start_minute;
        while minute_ts <= end_minute {
            // If klines exist for this minute, update last-known prices
            if let Some(klines) = minute_klines.get(&minute_ts) {
                for kline in klines {
                    if let Ok(o) = kline.open.parse::<f64>() {
                        last_open.insert(kline.symbol.clone(), o);
                    }
                    if let Ok(h) = kline.high.parse::<f64>() {
                        last_high.insert(kline.symbol.clone(), h);
                    }
                    if let Ok(l) = kline.low.parse::<f64>() {
                        last_low.insert(kline.symbol.clone(), l);
                    }
                    if let Ok(c) = kline.close.parse::<f64>() {
                        last_close.insert(kline.symbol.clone(), c);
                    }
                }
            } else {
                // No klines for this minute — collapse OHLC to last close (flat candle)
                for sym in &symbols {
                    if let Some(&c) = last_close.get(sym) {
                        last_open.insert(sym.clone(), c);
                        last_high.insert(sym.clone(), c);
                        last_low.insert(sym.clone(), c);
                    }
                }
            }

            // Compute ITP OHLC for this minute
            let mut itp_open: f64 = 0.0;
            let mut itp_high: f64 = 0.0;
            let mut itp_low: f64 = 0.0;
            let mut itp_close: f64 = 0.0;

            for (i, sym) in symbols.iter().enumerate() {
                let qty = inventory[i];
                itp_open += qty * last_open.get(sym).copied().unwrap_or(0.0);
                itp_high += qty * last_high.get(sym).copied().unwrap_or(0.0);
                itp_low += qty * last_low.get(sym).copied().unwrap_or(0.0);
                itp_close += qty * last_close.get(sym).copied().unwrap_or(0.0);
            }

            itp_1m_candles.push((
                minute_ts,
                itp_open / 1e18,
                itp_high / 1e18,
                itp_low / 1e18,
                itp_close / 1e18,
            ));

            minute_ts += 60;
        }

        // Aggregate 1m candles into requested interval
        let mut ohlc_map: std::collections::BTreeMap<i64, (f64, f64, f64, f64)> =
            std::collections::BTreeMap::new();

        for &(ts, o, h, l, c) in &itp_1m_candles {
            let bucket_ts = (ts / bucket_secs) * bucket_secs;
            ohlc_map
                .entry(bucket_ts)
                .and_modify(|(_bo, bh, bl, bc)| {
                    if h > *bh { *bh = h; }
                    if l < *bl { *bl = l; }
                    *bc = c;
                })
                .or_insert((o, h, l, c));
        }

        ohlc_map
            .into_iter()
            .map(|(ts, (o, h, l, c))| NavSeriesPoint {
                time: ts,
                open: format!("{:.6}", o),
                high: format!("{:.6}", h),
                low: format!("{:.6}", l),
                close: format!("{:.6}", c),
            })
            .collect()
    } else {
        // ---- Fallback: prices-based path (original logic) ----
        tracing::info!("nav-series: no klines found, falling back to prices-based logic");

        let rows = db::query_price_series(
            &state.pool,
            &symbol_refs,
            effective_from,
            to,
            None,
            500_000,
        )
        .await
        .map_err(|e| db_error(e))?;

        tracing::info!(price_rows = rows.len(), "nav-series: price data fetched (fallback)");

        let mut fetch_groups: std::collections::BTreeMap<i64, Vec<(&str, f64)>> =
            std::collections::BTreeMap::new();
        for row in &rows {
            let ts = row.fetched_at.timestamp();
            let price_val: f64 = row.price.parse().unwrap_or(0.0);
            fetch_groups
                .entry(ts)
                .or_default()
                .push((&row.symbol, price_val));
        }

        let mut last_prices: HashMap<String, f64> = HashMap::new();

        for (i, sym) in symbols.iter().enumerate() {
            let qty = inventory[i];
            let wt = weights[i];
            if qty > 0.0 {
                last_prices.insert(sym.clone(), wt / qty);
            }
        }

        let mut nav_ticks: Vec<(i64, f64)> = Vec::new();

        if !last_prices.is_empty() && !inventory.is_empty() {
            let seed_nav: f64 = inventory
                .iter()
                .zip(symbols.iter())
                .map(|(&qty, sym)| {
                    let price = last_prices.get(sym).copied().unwrap_or(0.0);
                    qty * price
                })
                .sum::<f64>()
                / 1e18;
            if seed_nav > 0.0 {
                nav_ticks.push((effective_from.timestamp(), seed_nav));
            }
        }

        let seed_prices =
            db::query_latest_prices_before(&state.pool, &symbol_refs, effective_from)
                .await
                .map_err(|e| db_error(e))?;
        for r in &seed_prices {
            if let Ok(p) = r.price.parse::<f64>() {
                last_prices.insert(r.symbol.clone(), p);
            }
        }

        for (ts, price_updates) in &fetch_groups {
            for &(sym, price) in price_updates {
                last_prices.insert(sym.to_string(), price);
            }

            let mut nav_sum: f64 = 0.0;
            for (i, sym) in symbols.iter().enumerate() {
                if let Some(&price) = last_prices.get(sym.as_str()) {
                    nav_sum += inventory[i] * price;
                }
            }
            let nav = nav_sum / 1e18;
            nav_ticks.push((*ts, nav));
        }

        let mut ohlc_map: std::collections::BTreeMap<i64, (f64, f64, f64, f64)> =
            std::collections::BTreeMap::new();

        for &(ts, nav) in &nav_ticks {
            let bucket_ts = (ts / bucket_secs) * bucket_secs;
            ohlc_map
                .entry(bucket_ts)
                .and_modify(|(o, h, l, c)| {
                    if nav > *h {
                        *h = nav;
                    }
                    if nav < *l {
                        *l = nav;
                    }
                    *c = nav;
                    let _ = o;
                })
                .or_insert((nav, nav, nav, nav));
        }

        ohlc_map
            .into_iter()
            .map(|(ts, (o, h, l, c))| NavSeriesPoint {
                time: ts,
                open: format!("{:.6}", o),
                high: format!("{:.6}", h),
                low: format!("{:.6}", l),
                close: format!("{:.6}", c),
            })
            .collect()
    };

    tracing::info!(nav_points = points.len(), "nav-series: done");

    Ok(Json(NavSeriesResponse {
        itp_id,
        interval: interval.to_string(),
        points,
    }))
}

// ---- /aum-ranking ----

#[derive(Deserialize)]
struct AumRankingQuery {
    top_n: Option<usize>,
    from: Option<String>,
    to: Option<String>,
}

#[derive(Serialize)]
struct AumRankedAsset {
    address: String,
    symbol: String,
    aum: String,
    weight_pct: String,
    qty_per_share: String,
    rank: usize,
}

#[derive(Serialize)]
struct AumRankingSnapshot {
    timestamp: i64,
    label: String,
    event_type: String,
    itp_id: String,
    total_aum: String,
    computed_nav: String,
    perf_ratio: String,
    ranked: Vec<AumRankedAsset>,
}

#[derive(Serialize)]
struct AumRankingResponse {
    snapshots: Vec<AumRankingSnapshot>,
    all_symbols: HashMap<String, String>,
}

fn compute_asset_aum(qty_str: &str, total_supply_str: &str, price_usd: f64) -> f64 {
    let qty: f64 = qty_str.parse().unwrap_or(0.0);
    let supply: f64 = total_supply_str.parse().unwrap_or(0.0);
    qty * supply * price_usd / 1e36
}

fn compute_perf_ratio(current_nav: f64, initial_nav_str: &str) -> f64 {
    let init: f64 = initial_nav_str.parse().unwrap_or(1e18);
    if init == 0.0 {
        return 1.0;
    }
    current_nav / (init / 1e18)
}

fn format_label(ts: i64) -> String {
    let dt = chrono::DateTime::from_timestamp(ts, 0).unwrap_or_default();
    dt.format("%m/%d %H:%M").to_string()
}

async fn aum_ranking(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AumRankingQuery>,
) -> Result<Json<AumRankingResponse>, (StatusCode, Json<ErrorResponse>)> {
    let top_n = params.top_n.unwrap_or(10);

    let from: Option<DateTime<Utc>> = params
        .from
        .as_ref()
        .and_then(|s| s.parse().ok());
    let to: Option<DateTime<Utc>> = params
        .to
        .as_ref()
        .and_then(|s| s.parse().ok());

    // 1. Fetch all snapshots chronologically
    let snapshots = db::query_all_snapshots_chronological(&state.pool, from, to)
        .await
        .map_err(|e| db_error(e))?;

    if snapshots.is_empty() {
        return Ok(Json(AumRankingResponse {
            snapshots: vec![],
            all_symbols: HashMap::new(),
        }));
    }

    // 2. Cache creation NAVs for perf ratio
    let mut initial_navs: HashMap<String, String> = HashMap::new();
    for snap in &snapshots {
        if snap.event_type == "created" || snap.event_type == "init" {
            initial_navs.entry(snap.itp_id.clone()).or_insert_with(|| snap.nav.clone());
        }
    }

    // For any ITP without a "created" snapshot in range, fetch from DB
    let mut itp_ids_seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for snap in &snapshots {
        itp_ids_seen.insert(snap.itp_id.clone());
    }
    for itp_id in &itp_ids_seen {
        if !initial_navs.contains_key(itp_id) {
            if let Ok(Some(creation)) = db::query_creation_snapshot(&state.pool, itp_id).await {
                initial_navs.insert(itp_id.clone(), creation.nav);
            }
        }
    }

    // 3. Collect all unique asset addresses across all snapshots for symbol resolution
    let mut all_addr_set: std::collections::HashSet<String> = std::collections::HashSet::new();
    for snap in &snapshots {
        for addr in &snap.assets {
            all_addr_set.insert(addr.clone());
        }
    }

    // Build address→symbol map from symbol_map (address→pair→symbol)
    let mut all_symbols: HashMap<String, String> = HashMap::new();
    for addr in &all_addr_set {
        if let Some(pair) = state.symbol_map.get(&addr.to_lowercase()) {
            // Extract symbol from pair (e.g., "BTCUSDT" → "BTC")
            let symbol = pair.trim_end_matches("USDT").trim_end_matches("USDC").to_string();
            all_symbols.insert(addr.clone(), symbol);
        } else {
            all_symbols.insert(
                addr.clone(),
                format!("{}...{}", &addr[..6], &addr[addr.len().saturating_sub(4)..]),
            );
        }
    }

    // 4. Walk snapshots, maintaining ITP state and computing rankings
    struct ItpState {
        assets: Vec<String>,
        inventory: Vec<String>,
        total_supply: String,
    }

    let mut itp_states: HashMap<String, ItpState> = HashMap::new();
    let mut result_snapshots: Vec<AumRankingSnapshot> = Vec::new();

    for snap in &snapshots {
        // Update ITP state
        itp_states.insert(
            snap.itp_id.clone(),
            ItpState {
                assets: snap.assets.clone(),
                inventory: snap.inventory.clone(),
                total_supply: snap.total_supply.clone(),
            },
        );

        // Compute AUM for each asset across ALL active ITPs
        let mut asset_aum: HashMap<String, f64> = HashMap::new();
        let mut total_aum: f64 = 0.0;

        for (_itp_id, itp) in &itp_states {
            for (i, addr) in itp.assets.iter().enumerate() {
                if i >= itp.inventory.len() {
                    continue;
                }

                // Look up price
                let pair = match state.symbol_map.get(&addr.to_lowercase()) {
                    Some(p) => p,
                    None => continue,
                };

                let price_val = match db::query_nearest_price(&state.pool, pair, snap.valid_from).await {
                    Ok(Some(row)) => row.price.parse::<f64>().unwrap_or(0.0),
                    _ => continue,
                };

                let aum = compute_asset_aum(&itp.inventory[i], &itp.total_supply, price_val);
                *asset_aum.entry(addr.clone()).or_insert(0.0) += aum;
                total_aum += aum;
            }
        }

        // Sort by AUM descending
        let mut sorted: Vec<(String, f64)> = asset_aum.into_iter().collect();
        sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top_n and build ranked list
        let ranked: Vec<AumRankedAsset> = sorted
            .iter()
            .take(top_n)
            .enumerate()
            .map(|(rank, (addr, aum))| {
                let weight_pct = if total_aum > 0.0 {
                    aum / total_aum * 100.0
                } else {
                    0.0
                };

                // Find qty_per_share for this asset (from the triggering ITP)
                let qty_str = itp_states
                    .get(&snap.itp_id)
                    .and_then(|itp| {
                        itp.assets
                            .iter()
                            .position(|a| a == addr)
                            .and_then(|i| itp.inventory.get(i))
                    })
                    .cloned()
                    .unwrap_or_default();

                AumRankedAsset {
                    address: addr.clone(),
                    symbol: all_symbols.get(addr).cloned().unwrap_or_default(),
                    aum: format!("{:.2}", aum),
                    weight_pct: format!("{:.1}", weight_pct),
                    qty_per_share: qty_str,
                    rank: rank + 1,
                }
            })
            .collect();

        // Compute NAV for the triggering ITP
        let triggering_itp = &itp_states[&snap.itp_id];
        let mut nav_sum: f64 = 0.0;
        for (i, addr) in triggering_itp.assets.iter().enumerate() {
            if i >= triggering_itp.inventory.len() {
                continue;
            }
            let addr_lower = addr.to_lowercase();
            let pair = match state.symbol_map.get(&addr_lower) {
                Some(p) => p,
                None => continue,
            };
            let price_val = match db::query_nearest_price(&state.pool, pair, snap.valid_from).await {
                Ok(Some(row)) => row.price.parse::<f64>().unwrap_or(0.0),
                _ => 0.0,
            };
            let qty: f64 = triggering_itp.inventory[i].parse().unwrap_or(0.0);
            nav_sum += qty * price_val;
        }
        let computed_nav = nav_sum / 1e18;

        let initial_nav_str = initial_navs
            .get(&snap.itp_id)
            .cloned()
            .unwrap_or_else(|| "1000000000000000000".to_string());
        let perf_ratio = compute_perf_ratio(computed_nav, &initial_nav_str);

        let timestamp = snap.valid_from.timestamp();

        result_snapshots.push(AumRankingSnapshot {
            timestamp,
            label: format_label(timestamp),
            event_type: snap.event_type.clone(),
            itp_id: snap.itp_id.clone(),
            total_aum: format!("{:.2}", total_aum),
            computed_nav: format!("{:.6}", computed_nav),
            perf_ratio: format!("{:.2}", perf_ratio),
            ranked,
        });
    }

    Ok(Json(AumRankingResponse {
        snapshots: result_snapshots,
        all_symbols,
    }))
}

// ---- /portfolio ----

#[derive(Deserialize)]
struct PortfolioQuery {
    user: String,
}

#[derive(Serialize)]
struct PositionEntry {
    itp_id: String,
    shares_bought: String,
    shares_sold: String,
    avg_cost: String,
    current_nav: String,
    current_value: String,
    pnl: String,
    pnl_pct: String,
}

#[derive(Serialize)]
struct PortfolioResponse {
    user: String,
    positions: Vec<PositionEntry>,
    total_value: String,
    total_invested: String,
    total_pnl: String,
    total_pnl_pct: String,
}

async fn portfolio(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PortfolioQuery>,
) -> Result<Json<PortfolioResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user = params.user.to_lowercase();

    // Get all filled trades for this user
    let positions = db::query_user_positions(&state.pool, &user)
        .await
        .map_err(|e| db_error(e))?;

    // Group by itp_id: compute shares_bought, shares_sold, VWAP cost
    struct Accum {
        bought: f64,
        sold: f64,
        cost_basis: f64, // total cost in USDC (sum of buy fill_price * fill_amount / 1e18)
    }
    let mut accum_map: HashMap<String, Accum> = HashMap::new();

    for (itp_id, side, fill_price, fill_amount) in &positions {
        let fp: f64 = fill_price.parse().unwrap_or(0.0);
        let fa: f64 = fill_amount.parse().unwrap_or(0.0);
        let shares = fa / 1e18; // fill_amount is in wei
        let price = fp / 1e18; // fill_price is in wei

        let entry = accum_map.entry(itp_id.clone()).or_insert(Accum {
            bought: 0.0,
            sold: 0.0,
            cost_basis: 0.0,
        });

        if *side == 0 {
            // BUY
            entry.cost_basis += shares * price;
            entry.bought += shares;
        } else {
            // SELL
            entry.sold += shares;
        }
    }

    let mut result_positions: Vec<PositionEntry> = Vec::new();
    let mut total_value: f64 = 0.0;
    let mut total_invested: f64 = 0.0;

    for (itp_id, acc) in &accum_map {
        let shares_held = acc.bought - acc.sold;
        if shares_held <= 0.0 {
            continue;
        }

        let avg_cost = if acc.bought > 0.0 { acc.cost_basis / acc.bought } else { 0.0 };
        total_invested += shares_held * avg_cost;

        // Get current NAV for this ITP
        let snapshot = db::query_itp_snapshot_at(&state.pool, itp_id, Utc::now())
            .await
            .map_err(|e| db_error(e))?;

        let current_nav = if let Some(ref snap) = snapshot {
            // Compute NAV from inventory + latest prices (same as /itp-price)
            let mut symbols: Vec<String> = Vec::new();
            let mut inv_vals: Vec<f64> = Vec::new();
            let mut sym_indices: Vec<Option<usize>> = Vec::new();

            for (i, asset_addr) in snap.assets.iter().enumerate() {
                let inv_val: f64 = snap.inventory.get(i).and_then(|s| s.parse().ok()).unwrap_or(0.0);
                if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
                    if let Some(existing) = symbols.iter().position(|s| s == pair) {
                        sym_indices.push(Some(existing));
                        inv_vals[existing] += inv_val;
                    } else {
                        sym_indices.push(Some(symbols.len()));
                        symbols.push(pair.clone());
                        inv_vals.push(inv_val);
                    }
                } else {
                    sym_indices.push(None);
                }
            }

            let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
            let price_rows = db::query_latest_prices_batch(&state.pool, &symbol_refs)
                .await
                .map_err(|e| db_error(e))?;

            let price_map: HashMap<&str, f64> = price_rows
                .iter()
                .filter_map(|r| r.price.parse::<f64>().ok().map(|p| (r.symbol.as_str(), p)))
                .collect();

            let mut nav_sum: f64 = 0.0;
            for (i, inv) in inv_vals.iter().enumerate() {
                if let Some(&price) = price_map.get(symbols[i].as_str()) {
                    nav_sum += inv * price;
                }
            }
            nav_sum / 1e18
        } else {
            0.0
        };

        let current_value = shares_held * current_nav;
        let pnl = current_value - (shares_held * avg_cost);
        let pnl_pct = if avg_cost > 0.0 { (current_nav / avg_cost - 1.0) * 100.0 } else { 0.0 };

        total_value += current_value;

        result_positions.push(PositionEntry {
            itp_id: itp_id.clone(),
            shares_bought: format!("{:.4}", acc.bought),
            shares_sold: format!("{:.4}", acc.sold),
            avg_cost: format!("{:.6}", avg_cost),
            current_nav: format!("{:.6}", current_nav),
            current_value: format!("{:.2}", current_value),
            pnl: format!("{:.2}", pnl),
            pnl_pct: format!("{:.1}", pnl_pct),
        });
    }

    let total_pnl = total_value - total_invested;
    let total_pnl_pct = if total_invested > 0.0 { (total_value / total_invested - 1.0) * 100.0 } else { 0.0 };

    Ok(Json(PortfolioResponse {
        user,
        positions: result_positions,
        total_value: format!("{:.2}", total_value),
        total_invested: format!("{:.2}", total_invested),
        total_pnl: format!("{:.2}", total_pnl),
        total_pnl_pct: format!("{:.1}", total_pnl_pct),
    }))
}

// ---- /portfolio/history ----

#[derive(Deserialize)]
struct PortfolioHistoryQuery {
    user: String,
    days: Option<u32>,
}

#[derive(Serialize)]
struct PortfolioHistoryPoint {
    date: String,
    value: f64,
    pnl: f64,
    pnl_pct: f64,
}

#[derive(Serialize)]
struct PortfolioHistoryResponse {
    points: Vec<PortfolioHistoryPoint>,
}

async fn portfolio_history(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PortfolioHistoryQuery>,
) -> Result<Json<PortfolioHistoryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user = params.user.to_lowercase();
    let days = params.days.unwrap_or(30);

    // Get all filled trades for this user, chronological
    let trades = db::query_user_trades(&state.pool, &user)
        .await
        .map_err(|e| db_error(e))?;

    let filled: Vec<_> = trades
        .iter()
        .filter(|t| t.status == 2 && t.fill_price.is_some() && t.fill_amount.is_some())
        .collect();

    if filled.is_empty() {
        return Ok(Json(PortfolioHistoryResponse { points: vec![] }));
    }

    // Walk day-by-day for the requested range
    let now = Utc::now();
    let start = now - chrono::Duration::days(days as i64);

    // Collect all ITP IDs the user has traded
    let mut itp_ids: Vec<String> = filled.iter().map(|t| t.itp_id.clone()).collect();
    itp_ids.sort();
    itp_ids.dedup();

    // For each ITP, fetch daily NAV series
    let mut itp_nav_series: HashMap<String, Vec<(i64, f64)>> = HashMap::new();

    for itp_id in &itp_ids {
        let snapshot = db::query_itp_snapshot_at(&state.pool, itp_id, now)
            .await
            .map_err(|e| db_error(e))?;

        if let Some(snap) = snapshot {
            let mut symbols: Vec<String> = Vec::new();
            let mut inv_vals: Vec<f64> = Vec::new();

            for (i, asset_addr) in snap.assets.iter().enumerate() {
                let inv_val: f64 = snap.inventory.get(i).and_then(|s| s.parse().ok()).unwrap_or(0.0);
                if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
                    if let Some(existing) = symbols.iter().position(|s| s == pair) {
                        inv_vals[existing] += inv_val;
                    } else {
                        symbols.push(pair.clone());
                        inv_vals.push(inv_val);
                    }
                }
            }

            if !symbols.is_empty() {
                let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
                let rows = db::query_price_series(&state.pool, &symbol_refs, start, now, Some("1d"), 10_000)
                    .await
                    .map_err(|e| db_error(e))?;

                // Group by day, compute NAV per day using last known prices
                let mut day_prices: std::collections::BTreeMap<i64, HashMap<String, f64>> = std::collections::BTreeMap::new();
                for row in &rows {
                    let day_ts = (row.fetched_at.timestamp() / 86400) * 86400;
                    let price: f64 = row.price.parse().unwrap_or(0.0);
                    day_prices.entry(day_ts).or_default().insert(row.symbol.clone(), price);
                }

                let mut last_prices: HashMap<String, f64> = HashMap::new();
                let mut nav_points: Vec<(i64, f64)> = Vec::new();

                for (day_ts, prices) in &day_prices {
                    for (sym, price) in prices {
                        last_prices.insert(sym.clone(), *price);
                    }
                    let mut nav_sum: f64 = 0.0;
                    for (i, sym) in symbols.iter().enumerate() {
                        if let Some(&price) = last_prices.get(sym) {
                            nav_sum += inv_vals[i] * price;
                        }
                    }
                    nav_points.push((*day_ts, nav_sum / 1e18));
                }

                itp_nav_series.insert(itp_id.clone(), nav_points);
            }
        }
    }

    // Walk day-by-day: replay trades, compute portfolio value
    let mut shares_held: HashMap<String, f64> = HashMap::new();
    let mut cost_basis: f64 = 0.0;
    let mut trade_idx: usize = 0;
    let mut points: Vec<PortfolioHistoryPoint> = Vec::new();

    // Sort filled trades chronologically (they come DESC from query)
    let mut sorted_fills: Vec<_> = filled.clone();
    sorted_fills.sort_by_key(|t| t.order_timestamp);

    let num_days = days as i64;
    for d in 0..=num_days {
        let day = start + chrono::Duration::days(d);
        let day_ts = (day.timestamp() / 86400) * 86400;
        let day_end = day_ts + 86400;

        // Replay trades that happened on or before this day
        while trade_idx < sorted_fills.len() {
            let t = sorted_fills[trade_idx];
            if t.order_timestamp.timestamp() < day_end {
                let fa: f64 = t.fill_amount.as_ref().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                let fp: f64 = t.fill_price.as_ref().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                let shares = fa / 1e18;
                let price = fp / 1e18;

                let held = shares_held.entry(t.itp_id.clone()).or_insert(0.0);
                if t.side == 0 {
                    // BUY
                    cost_basis += shares * price;
                    *held += shares;
                } else {
                    // SELL
                    *held -= shares;
                }
                trade_idx += 1;
            } else {
                break;
            }
        }

        // Compute portfolio value at this day
        let mut day_value: f64 = 0.0;
        for (itp_id, &shares) in &shares_held {
            if shares <= 0.0 { continue; }
            if let Some(nav_series) = itp_nav_series.get(itp_id) {
                // Find the closest NAV at or before this day
                let nav = nav_series
                    .iter()
                    .rev()
                    .find(|(ts, _)| *ts <= day_ts)
                    .map(|(_, nav)| *nav)
                    .unwrap_or(0.0);
                day_value += shares * nav;
            }
        }

        if day_value > 0.0 || cost_basis > 0.0 {
            let pnl = day_value - cost_basis;
            let pnl_pct = if cost_basis > 0.0 { (day_value / cost_basis - 1.0) * 100.0 } else { 0.0 };

            let date_str = chrono::DateTime::from_timestamp(day_ts, 0)
                .unwrap_or_default()
                .format("%Y-%m-%d")
                .to_string();

            points.push(PortfolioHistoryPoint {
                date: date_str,
                value: (day_value * 100.0).round() / 100.0,
                pnl: (pnl * 100.0).round() / 100.0,
                pnl_pct: (pnl_pct * 10.0).round() / 10.0,
            });
        }
    }

    Ok(Json(PortfolioHistoryResponse { points }))
}

// ---- /portfolio/trades ----

#[derive(Deserialize)]
struct PortfolioTradesQuery {
    user: String,
}

#[derive(Serialize)]
struct PortfolioTradeEntry {
    order_id: i64,
    itp_id: String,
    side: String,
    amount: String,
    fill_price: Option<String>,
    shares: Option<String>,
    status: String,
    timestamp: String,
}

#[derive(Serialize)]
struct PortfolioTradesResponse {
    trades: Vec<PortfolioTradeEntry>,
}

async fn portfolio_trades(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PortfolioTradesQuery>,
) -> Result<Json<PortfolioTradesResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user = params.user.to_lowercase();

    let rows = db::query_user_trades(&state.pool, &user)
        .await
        .map_err(|e| db_error(e))?;

    let trades: Vec<PortfolioTradeEntry> = rows
        .into_iter()
        .map(|t| {
            let fill_price_display = t.fill_price.as_ref().map(|fp| {
                let v: f64 = fp.parse().unwrap_or(0.0);
                format!("{:.6}", v / 1e18)
            });
            let shares_display = t.fill_amount.as_ref().map(|fa| {
                let v: f64 = fa.parse().unwrap_or(0.0);
                format!("{:.4}", v / 1e18)
            });
            let amount_display = {
                let v: f64 = t.amount.parse().unwrap_or(0.0);
                format!("{:.2}", v / 1e18)
            };

            PortfolioTradeEntry {
                order_id: t.order_id,
                itp_id: t.itp_id,
                side: if t.side == 0 { "BUY".to_string() } else { "SELL".to_string() },
                amount: amount_display,
                fill_price: fill_price_display,
                shares: shares_display,
                status: match t.status {
                    0 => "pending".to_string(),
                    2 => "filled".to_string(),
                    _ => format!("unknown({})", t.status),
                },
                timestamp: t.order_timestamp.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(PortfolioTradesResponse { trades }))
}

// ---- /latest-prices ----

#[derive(Deserialize)]
struct LatestPricesQuery {
    symbols: String,
}

#[derive(Serialize)]
struct LatestPricesResponse {
    prices: HashMap<String, String>,
    count: usize,
}

async fn latest_prices(
    State(state): State<Arc<AppState>>,
    Query(params): Query<LatestPricesQuery>,
) -> Result<Json<LatestPricesResponse>, (StatusCode, Json<ErrorResponse>)> {
    let symbol_list: Vec<&str> = params.symbols.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if symbol_list.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "symbols parameter is required".into() }),
        ));
    }

    // Build cache key from sorted symbols
    let mut sorted: Vec<&str> = symbol_list.clone();
    sorted.sort();
    let cache_key = sorted.join(",");

    // Check cache
    {
        let cache = state.cache.latest_prices.read().await;
        if let Some((inserted_at, cached)) = cache.get(&cache_key) {
            if inserted_at.elapsed() < state.cache.ttl {
                let prices = cached.clone();
                let count = prices.len();
                return Ok(Json(LatestPricesResponse { prices, count }));
            }
        }
    }

    // Cache miss — query DB
    let price_rows = db::query_latest_prices_batch(&state.pool, &symbol_list)
        .await
        .map_err(|e| db_error(e))?;

    let prices: HashMap<String, String> = price_rows
        .into_iter()
        .map(|r| (r.symbol, r.price))
        .collect();
    let count = prices.len();

    // Update cache
    {
        let mut cache = state.cache.latest_prices.write().await;
        cache.insert(cache_key, (Instant::now(), prices.clone()));
    }

    Ok(Json(LatestPricesResponse { prices, count }))
}

// ---- /prices-by-address ----

#[derive(Deserialize)]
struct PricesByAddressQuery {
    addresses: String,
}

#[derive(Serialize)]
struct PricesByAddressEntry {
    price: String,
    symbol: String,
}

#[derive(Serialize)]
struct PricesByAddressResponse {
    prices: HashMap<String, PricesByAddressEntry>,
}

async fn prices_by_address(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PricesByAddressQuery>,
) -> Result<Json<PricesByAddressResponse>, (StatusCode, Json<ErrorResponse>)> {
    let addresses: Vec<&str> = params.addresses.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if addresses.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "addresses parameter is required".into() }),
        ));
    }

    // Map addresses to Bitget symbols
    let mut addr_to_symbol: HashMap<String, String> = HashMap::new();
    let mut symbols: Vec<String> = Vec::new();

    for addr in &addresses {
        let lower = addr.to_lowercase();
        if let Some(pair) = state.symbol_map.get(&lower) {
            if !symbols.contains(pair) {
                symbols.push(pair.clone());
            }
            addr_to_symbol.insert(lower, pair.clone());
        }
    }

    if symbols.is_empty() {
        return Ok(Json(PricesByAddressResponse { prices: HashMap::new() }));
    }

    // Build cache key and check cache
    let mut sorted_syms: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    sorted_syms.sort();
    let cache_key = sorted_syms.join(",");

    let symbol_prices: HashMap<String, String>;

    {
        let cache = state.cache.latest_prices.read().await;
        if let Some((inserted_at, cached)) = cache.get(&cache_key) {
            if inserted_at.elapsed() < state.cache.ttl {
                symbol_prices = cached.clone();
            } else {
                drop(cache);
                let rows = db::query_freshest_prices_batch(&state.pool, &sorted_syms)
                    .await
                    .map_err(|e| db_error(e))?;
                symbol_prices = rows.into_iter().map(|r| (r.symbol, r.price)).collect();
                let mut cache = state.cache.latest_prices.write().await;
                cache.insert(cache_key, (Instant::now(), symbol_prices.clone()));
            }
        } else {
            drop(cache);
            let rows = db::query_latest_prices_batch(&state.pool, &sorted_syms)
                .await
                .map_err(|e| db_error(e))?;
            let mut sp: HashMap<String, String> = rows.into_iter().map(|r| (r.symbol, r.price)).collect();
            // Kline fallback for symbols missing from prices table
            let still_missing: Vec<&str> = sorted_syms.iter().filter(|s| !sp.contains_key(**s)).copied().collect();
            if !still_missing.is_empty() {
                if let Ok(kline_rows) = db::query_latest_kline_prices_batch(&state.pool, &still_missing).await {
                    for row in kline_rows { sp.entry(row.symbol).or_insert(row.price); }
                }
            }
            symbol_prices = sp;
            let mut cache = state.cache.latest_prices.write().await;
            cache.insert(cache_key, (Instant::now(), symbol_prices.clone()));
        }
    }

    // Build address → price response (convert decimal price to 18-decimal wei string)
    let mut result: HashMap<String, PricesByAddressEntry> = HashMap::new();
    for (addr, symbol) in &addr_to_symbol {
        if let Some(price_str) = symbol_prices.get(symbol) {
            let price_f64: f64 = price_str.parse().unwrap_or(0.0);
            let price_wei = format!("{:.0}", price_f64 * 1e18);
            result.insert(addr.clone(), PricesByAddressEntry {
                price: price_wei,
                symbol: symbol.clone(),
            });
        }
    }

    Ok(Json(PricesByAddressResponse { prices: result }))
}

// ---- /fast-prices ----

#[derive(Deserialize)]
struct FastPricesQuery {
    symbols: Option<String>,
}

#[derive(Serialize)]
struct FastPriceEntry {
    last_price: String,
    bid: String,
    ask: String,
}

#[derive(Serialize)]
struct FastPricesResponse {
    prices: HashMap<String, FastPriceEntry>,
    count: usize,
    age_ms: u64,
}

async fn fast_prices(
    State(state): State<Arc<AppState>>,
    Query(params): Query<FastPricesQuery>,
) -> Result<Json<FastPricesResponse>, (StatusCode, Json<ErrorResponse>)> {
    let age_ms = state.live_cache.age_ms().await.unwrap_or(u64::MAX);

    let tickers = if let Some(ref symbols_str) = params.symbols {
        let symbol_list: Vec<&str> = symbols_str
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if symbol_list.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse { error: "symbols parameter is empty".into() }),
            ));
        }
        let live = state.live_cache.get_prices(&symbol_list).await;
        // Fall back to DB for symbols missing from live cache
        let missing: Vec<&str> = symbol_list.iter()
            .filter(|s| !live.contains_key(**s))
            .copied()
            .collect();
        if !missing.is_empty() {
            let mut merged = live;
            if let Ok(rows) = db::query_freshest_prices_batch(&state.pool, &missing).await {
                for row in rows {
                    merged.entry(row.symbol.clone()).or_insert(CachedTicker {
                        last_price: row.price,
                        best_bid: String::new(),
                        best_ask: String::new(),
                        timestamp_ms: row.fetched_at.timestamp_millis() as u64,
                    });
                }
            }
            merged
        } else {
            live
        }
    } else {
        state.live_cache.get_all().await
    };

    let count = tickers.len();
    let prices: HashMap<String, FastPriceEntry> = tickers
        .into_iter()
        .map(|(sym, t)| {
            (
                sym,
                FastPriceEntry {
                    last_price: t.last_price,
                    bid: t.best_bid,
                    ask: t.best_ask,
                },
            )
        })
        .collect();

    Ok(Json(FastPricesResponse { prices, count, age_ms }))
}

// ---- /fast-prices-by-address ----

#[derive(Deserialize)]
struct FastPricesByAddressQuery {
    addresses: String,
}

#[derive(Serialize)]
struct FastPricesByAddressEntry {
    price: String,
    bid: String,
    ask: String,
    symbol: String,
}

#[derive(Serialize)]
struct FastPricesByAddressResponse {
    prices: HashMap<String, FastPricesByAddressEntry>,
    age_ms: u64,
}

async fn fast_prices_by_address(
    State(state): State<Arc<AppState>>,
    Query(params): Query<FastPricesByAddressQuery>,
) -> Result<Json<FastPricesByAddressResponse>, (StatusCode, Json<ErrorResponse>)> {
    let addresses: Vec<&str> = params
        .addresses
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    if addresses.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "addresses parameter is required".into() }),
        ));
    }

    // Map addresses to Bitget symbols
    let mut addr_to_symbol: HashMap<String, String> = HashMap::new();
    let mut symbols: Vec<String> = Vec::new();
    for addr in &addresses {
        let lower = addr.to_lowercase();
        if let Some(pair) = state.symbol_map.get(&lower) {
            if !symbols.contains(pair) {
                symbols.push(pair.clone());
            }
            addr_to_symbol.insert(lower, pair.clone());
        }
    }

    if symbols.is_empty() {
        return Ok(Json(FastPricesByAddressResponse {
            prices: HashMap::new(),
            age_ms: state.live_cache.age_ms().await.unwrap_or(u64::MAX),
        }));
    }

    let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    let mut tickers = state.live_cache.get_prices(&symbol_refs).await;
    let age_ms = state.live_cache.age_ms().await.unwrap_or(u64::MAX);

    // Fall back to DB for symbols missing from live cache (freshest of prices + klines)
    let missing: Vec<&str> = symbol_refs.iter()
        .filter(|s| !tickers.contains_key(**s))
        .copied()
        .collect();
    if !missing.is_empty() {
        if let Ok(rows) = db::query_freshest_prices_batch(&state.pool, &missing).await {
            for row in rows {
                tickers.entry(row.symbol.clone()).or_insert(CachedTicker {
                    last_price: row.price,
                    best_bid: String::new(),
                    best_ask: String::new(),
                    timestamp_ms: row.fetched_at.timestamp_millis() as u64,
                });
            }
        }
    }

    let mut result: HashMap<String, FastPricesByAddressEntry> = HashMap::new();
    for (addr, symbol) in &addr_to_symbol {
        if let Some(ticker) = tickers.get(symbol) {
            let price_f64: f64 = ticker.last_price.parse().unwrap_or(0.0);
            let bid_f64: f64 = ticker.best_bid.parse().unwrap_or(0.0);
            let ask_f64: f64 = ticker.best_ask.parse().unwrap_or(0.0);
            result.insert(
                addr.clone(),
                FastPricesByAddressEntry {
                    price: format!("{:.0}", price_f64 * 1e18),
                    bid: format!("{:.0}", bid_f64 * 1e18),
                    ask: format!("{:.0}", ask_f64 * 1e18),
                    symbol: symbol.clone(),
                },
            );
        }
    }

    Ok(Json(FastPricesByAddressResponse { prices: result, age_ms }))
}

// ---- /itp-bid-ask ----

#[derive(Deserialize)]
struct ItpBidAskQuery {
    itp_id: String,
}

#[derive(Serialize)]
struct ItpBidAskResponse {
    itp_id: String,
    nav_bid: String,
    nav_ask: String,
    nav_mid: String,
    spread_bps: u64,
    assets_priced: usize,
    assets_total: usize,
    age_ms: u64,
}

async fn itp_bid_ask(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ItpBidAskQuery>,
) -> Result<Json<ItpBidAskResponse>, (StatusCode, Json<ErrorResponse>)> {
    let itp_id = params.itp_id.to_lowercase();

    // Find the latest snapshot for this ITP
    let snapshot = db::query_itp_snapshot_at(&state.pool, &itp_id, Utc::now())
        .await
        .map_err(|e| db_error(e))?;

    let snapshot = match snapshot {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("No snapshot found for ITP '{}'", itp_id),
                }),
            ));
        }
    };

    if snapshot.assets.len() != snapshot.inventory.len() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Snapshot has mismatched assets/inventory lengths".into(),
            }),
        ));
    }

    let assets_total = snapshot.assets.len();

    // Map asset addresses to Bitget symbols and collect inventory
    let mut symbols: Vec<String> = Vec::new();
    let mut inv_vals: Vec<f64> = Vec::new();
    let mut asset_sym_idx: Vec<Option<usize>> = Vec::with_capacity(assets_total);

    for (i, asset_addr) in snapshot.assets.iter().enumerate() {
        let inv_val: f64 = snapshot.inventory[i].parse().unwrap_or(0.0);
        if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
            if let Some(existing) = symbols.iter().position(|s| s == pair) {
                asset_sym_idx.push(Some(existing));
                inv_vals[existing] += inv_val;
            } else {
                asset_sym_idx.push(Some(symbols.len()));
                symbols.push(pair.clone());
                inv_vals.push(inv_val);
            }
        } else {
            asset_sym_idx.push(None);
        }
    }

    // Get ticker data from live cache
    let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    let tickers = state.live_cache.get_prices(&symbol_refs).await;
    let age_ms = state.live_cache.age_ms().await.unwrap_or(u64::MAX);

    let mut bid_sum: f64 = 0.0;
    let mut ask_sum: f64 = 0.0;
    let mut assets_priced: usize = 0;

    for (i, sym) in symbols.iter().enumerate() {
        if let Some(ticker) = tickers.get(sym) {
            let bid: f64 = ticker.best_bid.parse().unwrap_or(0.0);
            let ask: f64 = ticker.best_ask.parse().unwrap_or(0.0);
            bid_sum += inv_vals[i] * bid;
            ask_sum += inv_vals[i] * ask;
            assets_priced += 1;
        }
    }

    let nav_bid = bid_sum / 1e18;
    let nav_ask = ask_sum / 1e18;
    let nav_mid = (nav_bid + nav_ask) / 2.0;
    let spread_bps = if nav_mid > 0.0 {
        ((nav_ask - nav_bid) / nav_mid * 10000.0) as u64
    } else {
        0
    };

    Ok(Json(ItpBidAskResponse {
        itp_id,
        nav_bid: format!("{:.6}", nav_bid),
        nav_ask: format!("{:.6}", nav_ask),
        nav_mid: format!("{:.6}", nav_mid),
        spread_bps,
        assets_priced,
        assets_total,
        age_ms,
    }))
}

// ---- /liquidity ----

#[derive(Deserialize)]
struct LiquidityQuery {
    symbols: String,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
}

async fn liquidity(
    State(state): State<Arc<AppState>>,
    Query(params): Query<LiquidityQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let symbol_list: Vec<&str> = params
        .symbols
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if symbol_list.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "symbols parameter is required".into() }),
        ));
    }

    // If from/to provided, return time series for the first symbol
    if let (Some(from), Some(to)) = (params.from, params.to) {
        let symbol = symbol_list[0];
        let rows = db::query_liquidity_series(&state.pool, symbol, from, to)
            .await
            .map_err(|e| db_error(e))?;
        return Ok(Json(serde_json::json!({ "series": rows })));
    }

    // Otherwise return latest snapshot per symbol
    let rows = db::query_latest_liquidity(&state.pool, &symbol_list)
        .await
        .map_err(|e| db_error(e))?;

    Ok(Json(serde_json::json!({ "snapshots": rows })))
}

// ---- /liquidity/alerts ----

#[derive(Deserialize)]
struct LiquidityAlertsQuery {
    symbols: Option<String>,
    min_volume_usd: Option<f32>,
    max_spread_bps: Option<f32>,
    min_depth_1pct: Option<f32>,
}

#[derive(Serialize)]
struct LiquidityAlert {
    symbol: String,
    spread_bps: f32,
    bid_depth_1pct: f32,
    ask_depth_1pct: f32,
    volume_24h_usd: f32,
    mid_price: String,
    reasons: Vec<String>,
}

async fn liquidity_alerts(
    State(state): State<Arc<AppState>>,
    Query(params): Query<LiquidityAlertsQuery>,
) -> Result<Json<Vec<LiquidityAlert>>, (StatusCode, Json<ErrorResponse>)> {
    let symbol_list: Vec<&str> = params
        .symbols
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if symbol_list.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: "symbols parameter is required".into() }),
        ));
    }

    let min_volume = params.min_volume_usd.unwrap_or(0.0);
    let max_spread = params.max_spread_bps.unwrap_or(f32::MAX);
    let min_depth = params.min_depth_1pct.unwrap_or(0.0);

    let rows = db::query_latest_liquidity(&state.pool, &symbol_list)
        .await
        .map_err(|e| db_error(e))?;

    let mut alerts: Vec<LiquidityAlert> = Vec::new();

    for r in rows {
        let mut reasons = Vec::new();

        if r.volume_24h_usd < min_volume {
            reasons.push(format!(
                "Low 24h volume: ${:.0} < ${:.0}",
                r.volume_24h_usd, min_volume
            ));
        }
        if r.spread_bps > max_spread {
            reasons.push(format!(
                "Wide spread: {:.1} bps > {:.1} bps",
                r.spread_bps, max_spread
            ));
        }
        let total_depth_1pct = r.bid_depth_1pct + r.ask_depth_1pct;
        if total_depth_1pct < min_depth {
            reasons.push(format!(
                "Thin 1% depth: ${:.0} < ${:.0}",
                total_depth_1pct, min_depth
            ));
        }

        if !reasons.is_empty() {
            alerts.push(LiquidityAlert {
                symbol: r.symbol,
                spread_bps: r.spread_bps,
                bid_depth_1pct: r.bid_depth_1pct,
                ask_depth_1pct: r.ask_depth_1pct,
                volume_24h_usd: r.volume_24h_usd,
                mid_price: r.mid_price,
                reasons,
            });
        }
    }

    // Sort by worst spread first
    alerts.sort_by(|a, b| b.spread_bps.partial_cmp(&a.spread_bps).unwrap_or(std::cmp::Ordering::Equal));

    Ok(Json(alerts))
}

// ---- Contract ABIs for on-chain reads ----

abigen!(
    ERC20Reader,
    r#"[
        function balanceOf(address account) external view returns (uint256)
        function allowance(address owner, address spender) external view returns (uint256)
        function name() external view returns (string)
        function symbol() external view returns (string)
        function totalSupply() external view returns (uint256)
    ]"#
);

abigen!(
    BridgeProxyReader,
    r#"[
        function getBridgedItp(bytes32 orbitItpId) external view returns (address)
    ]"#
);

abigen!(
    MorphoReader,
    r#"[
        function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
        function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
    ]"#
);

abigen!(
    MockOracleReader,
    r#"[
        function currentPrice() external view returns (uint256)
    ]"#
);

abigen!(
    IndexReader,
    r#"[
        function getOrder(uint256 orderId) external view returns ((uint256 id, address user, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline, bytes32 itpId, uint256 timestamp, uint8 status) order)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
    ]"#
);

abigen!(
    MockBitgetVaultReader,
    r#"[
        function getBalance(address token) external view returns (uint256)
        function getPrice(address token) external view returns (uint256)
    ]"#
);

// Helper: get address from deployment JSON
fn deployment_addr(deployment: &serde_json::Value, key: &str) -> Result<Address, String> {
    deployment["contracts"][key]
        .as_str()
        .ok_or_else(|| format!("Missing contracts.{} in deployment", key))
        .and_then(|s| s.parse::<Address>().map_err(|e| format!("Invalid address for {}: {}", key, e)))
}

fn rpc_error(msg: String) -> (StatusCode, Json<ErrorResponse>) {
    tracing::error!(%msg, "RPC error");
    (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: msg }))
}

// ---- /user-state ----

#[derive(Deserialize)]
struct UserStateQuery {
    user: String,
    itp_id: String,
}

#[derive(Serialize)]
struct UserStateResponse {
    usdc_balance: String,
    usdc_allowance_custody: String,
    usdc_allowance_morpho: String,
    bridged_itp_address: String,
    bridged_itp_balance: String,
    bridged_itp_allowance_custody: String,
    bridged_itp_allowance_morpho: String,
    bridged_itp_name: String,
    bridged_itp_symbol: String,
    bridged_itp_total_supply: String,
}

async fn user_state(
    State(state): State<Arc<AppState>>,
    Query(params): Query<UserStateQuery>,
) -> Result<Json<UserStateResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user: Address = params.user.parse().map_err(|e| rpc_error(format!("Invalid user address: {}", e)))?;
    let itp_id_bytes: [u8; 32] = {
        let hex_str = params.itp_id.strip_prefix("0x").unwrap_or(&params.itp_id);
        let bytes = hex::decode(hex_str).map_err(|e| rpc_error(format!("Invalid itp_id: {}", e)))?;
        let mut arr = [0u8; 32];
        let len = bytes.len().min(32);
        arr[32 - len..].copy_from_slice(&bytes[..len]);
        arr
    };

    let arb = &state.arb_provider;

    // Get addresses from deployment
    let arb_usdc_addr = deployment_addr(&state.deployment, "ARB_USDC").map_err(|e| rpc_error(e))?;
    let arb_custody_addr = deployment_addr(&state.deployment, "ArbBridgeCustody").map_err(|e| rpc_error(e))?;
    let bridge_proxy_addr = deployment_addr(&state.deployment, "BridgeProxy").map_err(|e| rpc_error(e))?;
    let morpho_addr = deployment_addr(&state.morpho_deployment, "MORPHO").map_err(|e| rpc_error(e))?;

    // USDC balance + allowances
    let usdc = ERC20Reader::new(arb_usdc_addr, Arc::clone(arb));
    let usdc_balance = usdc.balance_of(user).call().await.map_err(|e| rpc_error(format!("USDC balanceOf: {}", e)))?;
    let usdc_allowance_custody = usdc.allowance(user, arb_custody_addr).call().await.map_err(|e| rpc_error(format!("USDC allowance custody: {}", e)))?;
    let usdc_allowance_morpho = usdc.allowance(user, morpho_addr).call().await.map_err(|e| rpc_error(format!("USDC allowance morpho: {}", e)))?;

    // Get BridgedITP address
    let bridge_proxy = BridgeProxyReader::new(bridge_proxy_addr, Arc::clone(arb));
    let bridged_itp_addr = bridge_proxy.get_bridged_itp(itp_id_bytes).call().await
        .map_err(|e| rpc_error(format!("getBridgedItp: {}", e)))?;

    let zero_addr: Address = Address::zero();
    if bridged_itp_addr == zero_addr {
        return Ok(Json(UserStateResponse {
            usdc_balance: usdc_balance.to_string(),
            usdc_allowance_custody: usdc_allowance_custody.to_string(),
            usdc_allowance_morpho: usdc_allowance_morpho.to_string(),
            bridged_itp_address: format!("{:?}", bridged_itp_addr),
            bridged_itp_balance: "0".to_string(),
            bridged_itp_allowance_custody: "0".to_string(),
            bridged_itp_allowance_morpho: "0".to_string(),
            bridged_itp_name: "".to_string(),
            bridged_itp_symbol: "".to_string(),
            bridged_itp_total_supply: "0".to_string(),
        }));
    }

    // BridgedITP reads
    let bitp = ERC20Reader::new(bridged_itp_addr, Arc::clone(arb));
    let bitp_balance = bitp.balance_of(user).call().await.unwrap_or_default();
    let bitp_allowance_custody = bitp.allowance(user, arb_custody_addr).call().await.unwrap_or_default();
    let bitp_allowance_morpho = bitp.allowance(user, morpho_addr).call().await.unwrap_or_default();
    let bitp_name = bitp.name().call().await.unwrap_or_default();
    let bitp_symbol = bitp.symbol().call().await.unwrap_or_default();
    let bitp_total_supply = bitp.total_supply().call().await.unwrap_or_default();

    Ok(Json(UserStateResponse {
        usdc_balance: usdc_balance.to_string(),
        usdc_allowance_custody: usdc_allowance_custody.to_string(),
        usdc_allowance_morpho: usdc_allowance_morpho.to_string(),
        bridged_itp_address: format!("{:?}", bridged_itp_addr),
        bridged_itp_balance: bitp_balance.to_string(),
        bridged_itp_allowance_custody: bitp_allowance_custody.to_string(),
        bridged_itp_allowance_morpho: bitp_allowance_morpho.to_string(),
        bridged_itp_name: bitp_name,
        bridged_itp_symbol: bitp_symbol,
        bridged_itp_total_supply: bitp_total_supply.to_string(),
    }))
}

// ---- /morpho-position ----

#[derive(Deserialize)]
struct MorphoPositionQuery {
    user: String,
}

#[derive(Serialize)]
struct MorphoMarketState {
    total_supply_assets: String,
    total_supply_shares: String,
    total_borrow_assets: String,
    total_borrow_shares: String,
}

#[derive(Serialize)]
struct MorphoPositionResponse {
    collateral: String,
    borrow_shares: String,
    debt_amount: String,
    oracle_price: String,
    health_factor: String,
    max_borrow: String,
    max_withdraw: String,
    market: MorphoMarketState,
}

async fn morpho_position(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MorphoPositionQuery>,
) -> Result<Json<MorphoPositionResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user: Address = params.user.parse().map_err(|e| rpc_error(format!("Invalid user address: {}", e)))?;
    let arb = &state.arb_provider;

    let morpho_addr = deployment_addr(&state.morpho_deployment, "MORPHO").map_err(|e| rpc_error(e))?;
    let oracle_addr = deployment_addr(&state.morpho_deployment, "MOCK_ORACLE").map_err(|e| rpc_error(e))?;

    let market_id_str = state.morpho_deployment["contracts"]["MARKET_ID"]
        .as_str()
        .ok_or_else(|| rpc_error("Missing MARKET_ID".to_string()))?;
    let market_id_bytes: [u8; 32] = {
        let hex_str = market_id_str.strip_prefix("0x").unwrap_or(market_id_str);
        let bytes = hex::decode(hex_str).map_err(|e| rpc_error(format!("Invalid market_id: {}", e)))?;
        let mut arr = [0u8; 32];
        let len = bytes.len().min(32);
        arr[..len].copy_from_slice(&bytes[..len]);
        arr
    };

    let lltv_str = state.morpho_deployment["marketParams"]["lltv"]
        .as_str()
        .or_else(|| state.morpho_deployment["marketParams"]["lltv"].as_u64().map(|_| ""))
        .unwrap_or("770000000000000000");
    let lltv: U256 = if lltv_str.is_empty() {
        U256::from(state.morpho_deployment["marketParams"]["lltv"].as_u64().unwrap_or(770000000000000000))
    } else {
        U256::from_dec_str(lltv_str).unwrap_or(U256::from(770000000000000000u64))
    };

    let morpho = MorphoReader::new(morpho_addr, Arc::clone(arb));
    let oracle = MockOracleReader::new(oracle_addr, Arc::clone(arb));

    // Fetch position
    let (supply_shares, borrow_shares, collateral) = morpho.position(market_id_bytes, user).call().await
        .map_err(|e| rpc_error(format!("Morpho.position: {}", e)))?;

    // Fetch market state
    let (total_supply_assets, total_supply_shares, total_borrow_assets, total_borrow_shares, _last_update, _fee) =
        morpho.market(market_id_bytes).call().await
            .map_err(|e| rpc_error(format!("Morpho.market: {}", e)))?;

    // Fetch oracle price
    let oracle_price = oracle.current_price().call().await
        .map_err(|e| rpc_error(format!("Oracle.currentPrice: {}", e)))?;

    // Convert borrow shares to assets (round up for debt)
    let borrow_shares_u256 = U256::from(borrow_shares);
    let total_borrow_assets_u256 = U256::from(total_borrow_assets);
    let total_borrow_shares_u256 = U256::from(total_borrow_shares);

    let debt_amount = if total_borrow_shares_u256 > U256::zero() {
        (borrow_shares_u256 * total_borrow_assets_u256 + total_borrow_shares_u256 - 1) / total_borrow_shares_u256
    } else {
        U256::zero()
    };

    let collateral_u256 = U256::from(collateral);

    // Health factor = (collateralValue * LLTV) / debt
    // Morpho convention: collateral_raw * oracle_price / ORACLE_PRICE_SCALE = loan_raw
    // ORACLE_PRICE_SCALE = 1e36 (oracle price encodes token decimal differences)
    let e36 = U256::from_dec_str("1000000000000000000000000000000000000").unwrap();
    let wad = U256::from_dec_str("1000000000000000000").unwrap();

    let collateral_value_e6 = collateral_u256 * oracle_price / e36;
    let max_borrow_total = collateral_value_e6 * lltv / wad;
    let max_borrow = if max_borrow_total > debt_amount { max_borrow_total - debt_amount } else { U256::zero() };

    let health_factor = if debt_amount > U256::zero() {
        let hf_num = max_borrow_total.as_u128() as f64;
        let hf_den = debt_amount.as_u128() as f64;
        hf_num / hf_den
    } else {
        f64::INFINITY
    };

    // Max withdraw: if no debt, can withdraw all; otherwise limited
    let max_withdraw = if debt_amount == U256::zero() {
        collateral_u256
    } else {
        // Required collateral value = debt / LLTV * WAD
        let required_value_e6 = debt_amount * wad / lltv;
        // Required collateral = required_value * 1e36 / oracle_price
        let required_collateral = required_value_e6 * e36 / oracle_price;
        if collateral_u256 > required_collateral {
            collateral_u256 - required_collateral
        } else {
            U256::zero()
        }
    };

    let _ = supply_shares; // unused but returned by position()

    Ok(Json(MorphoPositionResponse {
        collateral: collateral_u256.to_string(),
        borrow_shares: borrow_shares_u256.to_string(),
        debt_amount: debt_amount.to_string(),
        oracle_price: oracle_price.to_string(),
        health_factor: if health_factor.is_infinite() { "Infinity".to_string() } else { format!("{:.2}", health_factor) },
        max_borrow: max_borrow.to_string(),
        max_withdraw: max_withdraw.to_string(),
        market: MorphoMarketState {
            total_supply_assets: total_supply_assets.to_string(),
            total_supply_shares: total_supply_shares.to_string(),
            total_borrow_assets: total_borrow_assets.to_string(),
            total_borrow_shares: total_borrow_shares.to_string(),
        },
    }))
}

// ---- /order ----

#[derive(Deserialize)]
struct OrderQuery {
    id: u64,
}

#[derive(Serialize)]
struct FillInfo {
    fill_price: String,
    fill_amount: String,
    cycle_number: String,
}

#[derive(Serialize)]
struct OrderResponse {
    id: u64,
    user: String,
    side: u8,
    amount: String,
    limit_price: String,
    itp_id: String,
    timestamp: String,
    status: u8,
    fill: Option<FillInfo>,
}

async fn order(
    State(state): State<Arc<AppState>>,
    Query(params): Query<OrderQuery>,
) -> Result<Json<OrderResponse>, (StatusCode, Json<ErrorResponse>)> {
    let l3 = &state.l3_provider;

    let index_addr = deployment_addr(&state.deployment, "Index").map_err(|e| rpc_error(e))?;
    let index = IndexReader::new(index_addr, Arc::clone(l3));

    let order_id = U256::from(params.id);
    let order_data = index.get_order(order_id).call().await
        .map_err(|e| rpc_error(format!("getOrder: {}", e)))?;

    // Parse fill from FillConfirmed events
    let fill_filter = index.fill_confirmed_filter()
        .topic1(order_id)
        .from_block(0u64);

    let fill = match fill_filter.query().await {
        Ok(logs) => {
            if let Some(last) = logs.last() {
                Some(FillInfo {
                    fill_price: last.fill_price.to_string(),
                    fill_amount: last.fill_amount.to_string(),
                    cycle_number: last.cycle_number.to_string(),
                })
            } else {
                None
            }
        }
        Err(_) => None,
    };

    // order_data is a tuple: (id, user, pairId, side, amount, limitPrice, slippageTier, deadline, itpId, timestamp, status)
    Ok(Json(OrderResponse {
        id: params.id,
        user: format!("{:?}", order_data.1),
        side: order_data.3,
        amount: order_data.4.to_string(),
        limit_price: order_data.5.to_string(),
        itp_id: format!("0x{}", hex::encode(order_data.8)),
        timestamp: order_data.9.to_string(),
        status: order_data.10,
        fill,
    }))
}

// ---- /vault-balances ----

#[derive(Serialize)]
struct VaultAsset {
    address: String,
    symbol: String,
    balance: String,
    price: String,
    usd_value: f64,
}

#[derive(Serialize)]
struct VaultBalancesResponse {
    assets: Vec<VaultAsset>,
    total_usd: f64,
    token_count: usize,
}

async fn vault_balances(
    State(state): State<Arc<AppState>>,
) -> Result<Json<VaultBalancesResponse>, (StatusCode, Json<ErrorResponse>)> {
    let arb = &state.arb_provider;

    let vault_addr = deployment_addr(&state.deployment, "MockBitgetVault").map_err(|e| rpc_error(e))?;
    let arb_usdc_addr = deployment_addr(&state.deployment, "ARB_USDC").map_err(|e| rpc_error(e))?;
    let vault = MockBitgetVaultReader::new(vault_addr, Arc::clone(arb));

    // Get token addresses from symbol map
    let token_addrs: Vec<Address> = state.symbol_map.keys()
        .filter_map(|addr_str| addr_str.parse::<Address>().ok())
        .collect();

    let mut assets: Vec<VaultAsset> = Vec::new();

    for token_addr in &token_addrs {
        let balance = match vault.get_balance(*token_addr).call().await {
            Ok(b) if b > U256::zero() => b,
            _ => continue,
        };

        let symbol = state.symbol_map
            .get(&format!("{:?}", token_addr).to_lowercase())
            .map(|pair| pair.trim_end_matches("USDT").trim_end_matches("USDC").to_string())
            .unwrap_or_else(|| format!("{:?}", token_addr)[..10].to_string());

        // Get price from live cache or DB
        let pair = state.symbol_map
            .get(&format!("{:?}", token_addr).to_lowercase());
        let price_f64 = if let Some(pair) = pair {
            let symbol_refs = vec![pair.as_str()];
            let tickers = state.live_cache.get_prices(&symbol_refs).await;
            if let Some(ticker) = tickers.get(pair.as_str()) {
                ticker.last_price.parse::<f64>().unwrap_or(0.0)
            } else {
                // Fallback to DB
                match db::query_latest_prices_batch(&state.pool, &[pair.as_str()]).await {
                    Ok(rows) => rows.first().and_then(|r| r.price.parse::<f64>().ok()).unwrap_or(0.0),
                    Err(_) => 0.0,
                }
            }
        } else {
            0.0
        };

        let price_wei = format!("{:.0}", price_f64 * 1e18);
        let balance_f64: f64 = balance.to_string().parse().unwrap_or(0.0);
        let usd_value = balance_f64 * price_f64 / 1e18;

        assets.push(VaultAsset {
            address: format!("{:?}", token_addr),
            symbol,
            balance: balance.to_string(),
            price: price_wei,
            usd_value,
        });
    }

    // Check USDC balance in vault
    let usdc_token = ERC20Reader::new(arb_usdc_addr, Arc::clone(arb));
    if let Ok(usdc_balance) = usdc_token.balance_of(vault_addr).call().await {
        if usdc_balance > U256::zero() {
            let usdc_f64: f64 = usdc_balance.to_string().parse().unwrap_or(0.0);
            assets.push(VaultAsset {
                address: format!("{:?}", arb_usdc_addr),
                symbol: "USDC".to_string(),
                balance: usdc_balance.to_string(),
                price: "1000000000000000000".to_string(), // $1 in wei
                usd_value: usdc_f64 / 1e6,
            });
        }
    }

    // Sort by USD value descending
    assets.sort_by(|a, b| b.usd_value.partial_cmp(&a.usd_value).unwrap_or(std::cmp::Ordering::Equal));

    let total_usd: f64 = assets.iter().map(|a| a.usd_value).sum();
    let token_count = assets.len();

    Ok(Json(VaultBalancesResponse {
        assets,
        total_usd,
        token_count,
    }))
}

// ---- Error helpers ----

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn db_error(e: sqlx::Error) -> (StatusCode, Json<ErrorResponse>) {
    tracing::error!(%e, "Database query error");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: format!("Database error: {}", e) }),
    )
}

// ---- /logo/:coin_id ----

// ---- /cg/categories ----

#[derive(Serialize)]
struct CgCategoryResponse {
    id: String,
    name: String,
    market_cap: Option<f64>,
    market_cap_change_24h: Option<f64>,
    volume_24h: Option<f64>,
    top_3_coins: Option<Vec<String>>,
}

async fn cg_categories(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CgCategoryResponse>>, StatusCode> {
    let rows = db::cg_query_all_categories(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<CgCategoryResponse> = rows
        .into_iter()
        .map(|r| CgCategoryResponse {
            id: r.id,
            name: r.name,
            market_cap: r.market_cap,
            market_cap_change_24h: r.market_cap_change_24h,
            volume_24h: r.volume_24h,
            top_3_coins: r.top_3_coins,
        })
        .collect();

    Ok(Json(result))
}

// ---- /cg/categories/:id/coins ----

#[derive(Deserialize)]
struct CgCategoryCoinsQuery {
    limit: Option<i64>,
}

#[derive(Serialize)]
struct CgCoinInCategory {
    coin_id: String,
    symbol: Option<String>,
    name: Option<String>,
    market_cap_usd: Option<f64>,
    price_usd: Option<f64>,
    total_volume_usd: Option<f64>,
    market_cap_rank: Option<i32>,
}

async fn cg_category_coins(
    State(state): State<Arc<AppState>>,
    AxumPath(category_id): AxumPath<String>,
    Query(params): Query<CgCategoryCoinsQuery>,
) -> Result<Json<Vec<CgCoinInCategory>>, StatusCode> {
    let limit = params.limit.unwrap_or(500);

    let rows = db::cg_query_category_coins_with_data(&state.pool, &category_id, limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<CgCoinInCategory> = rows
        .into_iter()
        .map(|r| CgCoinInCategory {
            coin_id: r.coin_id,
            symbol: r.symbol,
            name: r.name,
            market_cap_usd: r.market_cap_usd,
            price_usd: r.price_usd,
            total_volume_usd: r.total_volume_usd,
            market_cap_rank: r.market_cap_rank,
        })
        .collect();

    Ok(Json(result))
}

// ---- /cg/coin/:id/categories ----

#[derive(Serialize)]
struct CgCoinCategoriesResponse {
    coin_id: String,
    categories: Vec<String>,
}

async fn cg_coin_categories(
    State(state): State<Arc<AppState>>,
    AxumPath(coin_id): AxumPath<String>,
) -> Result<Json<CgCoinCategoriesResponse>, StatusCode> {
    let categories = db::cg_query_coin_categories(&state.pool, &coin_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CgCoinCategoriesResponse {
        coin_id,
        categories,
    }))
}

async fn serve_logo(
    State(state): State<Arc<AppState>>,
    AxumPath(coin_id): AxumPath<String>,
) -> Result<(StatusCode, [(String, String); 2], Vec<u8>), StatusCode> {
    // Sanitize: only allow alphanumeric, hyphens, underscores
    if !coin_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(StatusCode::BAD_REQUEST);
    }

    let path = state.logos_dir.join(format!("{coin_id}.png"));
    match tokio::fs::read(&path).await {
        Ok(bytes) => Ok((
            StatusCode::OK,
            [
                ("Content-Type".to_string(), "image/png".to_string()),
                ("Cache-Control".to_string(), "public, max-age=86400".to_string()),
            ],
            bytes,
        )),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

// ---- /listings ----

#[derive(Deserialize)]
struct ListingsQuery {
    status: Option<String>,
    quote: Option<String>,
}

async fn listings(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListingsQuery>,
) -> Result<Json<Vec<db::BitgetListingRow>>, (StatusCode, Json<ErrorResponse>)> {
    let mut rows = db::bitget_query_listings(&state.pool, params.status.as_deref())
        .await
        .map_err(|e| db_error(e))?;

    if let Some(ref quote) = params.quote {
        let q = quote.to_uppercase();
        rows.retain(|r| r.quote_coin == q);
    }

    Ok(Json(rows))
}

// ---- /listings/unsafe ----

async fn listings_unsafe(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<db::BitgetListingRow>>, (StatusCode, Json<ErrorResponse>)> {
    let rows = db::bitget_query_unsafe_listings(&state.pool)
        .await
        .map_err(|e| db_error(e))?;
    Ok(Json(rows))
}

// ---- /listing ----

#[derive(Deserialize)]
struct ListingQuery {
    symbol: String,
}

async fn listing(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListingQuery>,
) -> Result<Json<db::BitgetListingRow>, (StatusCode, Json<ErrorResponse>)> {
    let row = db::bitget_query_listing(&state.pool, &params.symbol)
        .await
        .map_err(|e| db_error(e))?;

    match row {
        Some(r) => Ok(Json(r)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse { error: format!("No listing found for '{}'", params.symbol) }),
        )),
    }
}

// ======== Simulation endpoints ========

#[derive(Serialize)]
struct SimCategoryInfo {
    id: String,
    name: String,
    coin_count: usize,
    market_cap: Option<f64>,
}

/// Categories that produce meaningless index results (stablecoins, wrappers, bridged).
const CATEGORY_BLACKLIST: &[&str] = &[
    "stablecoins",
    "usd-stablecoin",
    "fiat-backed-stablecoin",
    "bridged-stablecoins",
    "bridged-dai",
    "bridged-usdc",
    "wrapped-tokens",
    "bridged-tokens",
    "bridged-wbtc",
    "wormhole-assets",
];

async fn sim_categories(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    // Serve from in-memory cache — instant response, no DB hit.
    let result: Vec<&simulation::CachedCategoryInfo> = state.sim_cache.categories.iter()
        .filter(|c| !CATEGORY_BLACKLIST.contains(&c.id.as_str()))
        .collect();
    Json(serde_json::json!({ "categories": result }))
}

#[derive(Deserialize)]
struct SimRunQuery {
    category_id: String,
    top_n: i32,
    weighting: String,
    rebalance_days: i32,
    #[serde(default = "default_base_fee")]
    base_fee_pct: f64,
    #[serde(default = "default_spread_mult")]
    spread_multiplier: f64,
    #[serde(default)]
    force: bool,
    #[serde(default)]
    threshold_pct: Option<f64>,
    #[serde(default)]
    start_date: Option<chrono::NaiveDate>,
}

fn default_base_fee() -> f64 { 0.1 }
fn default_spread_mult() -> f64 { 1.0 }

async fn sim_run(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimRunQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let weighting = simulation::Weighting::from_str(&params.weighting).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(ErrorResponse {
            error: format!("Invalid weighting '{}', use 'equal', 'mcap', 'momentum_N', 'invvol_N', or 'dual_mom_N'", params.weighting),
        }))
    })?;

    let config_for_cache = simulation::SimConfig {
        category_id: params.category_id.clone(),
        top_n: params.top_n,
        weighting: weighting.clone(),
        rebalance_days: params.rebalance_days,
        base_fee_pct: params.base_fee_pct,
        spread_multiplier: params.spread_multiplier,
        threshold_rebalance_pct: params.threshold_pct,
        start_date: params.start_date,
    };

    // Check cache first
    if !params.force {
        if let Some(cached) = db::sim_get_cached_run(
            &state.pool, &params.category_id, params.top_n,
            &config_for_cache.cache_key_weighting(), params.rebalance_days,
            params.base_fee_pct, params.spread_multiplier,
        ).await.map_err(|e| db_error(e))? {
            let nav_series = db::sim_query_nav_series(&state.pool, cached.id)
                .await.map_err(|e| db_error(e))?;
            return Ok(Json(serde_json::json!({
                "run_id": cached.id,
                "config": {
                    "category_id": cached.category_id,
                    "top_n": cached.top_n,
                    "weighting": cached.weighting,
                    "rebalance_days": cached.rebalance_days,
                    "base_fee_pct": cached.base_fee_pct,
                    "spread_multiplier": cached.spread_multiplier,
                },
                "stats": {
                    "total_return_pct": cached.total_return_pct,
                    "annualized_return": cached.annualized_return,
                    "max_drawdown_pct": cached.max_drawdown_pct,
                    "sharpe_ratio": cached.sharpe_ratio,
                    "total_fees_pct": cached.total_fees_pct,
                    "total_trades": cached.total_trades,
                    "total_rebalances": cached.total_rebalances,
                    "total_delistings": cached.total_delistings,
                    "start_date": cached.start_date,
                    "end_date": cached.end_date,
                },
                "nav_series": nav_series,
                "cached": true,
                "computed_in_ms": cached.duration_ms,
            })));
        }
    }

    // Run simulation
    let result = simulation::run_simulation(&state.pool, &config_for_cache, None, &state.sim_cache)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse {
            error: format!("Simulation failed: {e}"),
        })))?;

    Ok(Json(serde_json::json!({
        "run_id": result.run_id,
        "config": result.config,
        "stats": result.stats,
        "nav_series": result.nav_series,
        "cached": false,
        "computed_in_ms": result.computed_in_ms,
    })))
}

// ---- SSE streaming ----

use axum::response::sse::{Event, Sse};
use futures::stream::Stream;
use tokio_stream::wrappers::ReceiverStream;

async fn sim_run_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimRunQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, (StatusCode, Json<ErrorResponse>)> {
    let weighting = simulation::Weighting::from_str(&params.weighting).ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(ErrorResponse {
            error: format!("Invalid weighting '{}', use 'equal', 'mcap', 'momentum_N', 'invvol_N', or 'dual_mom_N'", params.weighting),
        }))
    })?;

    let cache_key_w = {
        let tmp = simulation::SimConfig {
            category_id: params.category_id.clone(),
            top_n: params.top_n,
            weighting: weighting.clone(),
            rebalance_days: params.rebalance_days,
            base_fee_pct: params.base_fee_pct,
            spread_multiplier: params.spread_multiplier,
            threshold_rebalance_pct: params.threshold_pct,
            start_date: params.start_date,
        };
        tmp.cache_key_weighting()
    };

    // Check cache first
    if !params.force {
        if let Some(cached) = db::sim_get_cached_run(
            &state.pool, &params.category_id, params.top_n,
            &cache_key_w, params.rebalance_days,
            params.base_fee_pct, params.spread_multiplier,
        ).await.map_err(|e| db_error(e))? {
            let nav_series = db::sim_query_nav_series(&state.pool, cached.id)
                .await.map_err(|e| db_error(e))?;

            let result_json = serde_json::json!({
                "type": "result",
                "run_id": cached.id,
                "config": {
                    "category_id": cached.category_id,
                    "top_n": cached.top_n,
                    "weighting": cached.weighting,
                    "rebalance_days": cached.rebalance_days,
                    "base_fee_pct": cached.base_fee_pct,
                    "spread_multiplier": cached.spread_multiplier,
                },
                "stats": {
                    "total_return_pct": cached.total_return_pct,
                    "annualized_return": cached.annualized_return,
                    "max_drawdown_pct": cached.max_drawdown_pct,
                    "sharpe_ratio": cached.sharpe_ratio,
                    "total_fees_pct": cached.total_fees_pct,
                    "total_trades": cached.total_trades,
                    "total_rebalances": cached.total_rebalances,
                    "total_delistings": cached.total_delistings,
                    "start_date": cached.start_date,
                    "end_date": cached.end_date,
                },
                "nav_series": nav_series,
                "cached": true,
            });

            let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(1);
            tokio::spawn(async move {
                let _ = tx.send(Ok(Event::default().data(result_json.to_string()))).await;
            });
            let stream = ReceiverStream::new(rx);
            return Ok(Sse::new(stream));
        }
    }

    let config = simulation::SimConfig {
        category_id: params.category_id.clone(),
        top_n: params.top_n,
        weighting,
        rebalance_days: params.rebalance_days,
        base_fee_pct: params.base_fee_pct,
        spread_multiplier: params.spread_multiplier,
        threshold_rebalance_pct: params.threshold_pct,
        start_date: params.start_date,
    };

    let pool = state.pool.clone();
    let sim_cache = state.sim_cache.clone();
    let (sse_tx, sse_rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(64);
    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::channel::<simulation::SimProgress>(64);

    // Spawn simulation task
    let sse_tx_clone = sse_tx.clone();
    tokio::spawn(async move {
        let result = simulation::run_simulation(&pool, &config, Some(progress_tx), &sim_cache).await;
        match result {
            Ok(r) => {
                let result_json = serde_json::json!({
                    "type": "result",
                    "run_id": r.run_id,
                    "config": r.config,
                    "stats": r.stats,
                    "nav_series": r.nav_series,
                    "cached": false,
                    "computed_in_ms": r.computed_in_ms,
                });
                let _ = sse_tx_clone.send(Ok(Event::default().data(result_json.to_string()))).await;
            }
            Err(e) => {
                let err_json = serde_json::json!({ "type": "error", "error": e.to_string() });
                let _ = sse_tx_clone.send(Ok(Event::default().data(err_json.to_string()))).await;
            }
        }
    });

    // Forward progress events to SSE
    tokio::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            let progress_json = serde_json::json!({
                "type": "progress",
                "current_date": progress.current_date,
                "total_dates": progress.total_dates,
                "pct": progress.pct,
            });
            if sse_tx.send(Ok(Event::default().data(progress_json.to_string()))).await.is_err() {
                break;
            }
        }
    });

    let stream = ReceiverStream::new(sse_rx);
    Ok(Sse::new(stream))
}

#[derive(Deserialize)]
struct SimSweepQuery {
    #[serde(default)]
    category_id: String,
    sweep: String,  // "top_n", "weighting", "rebalance", "category", "threshold"
    /// Comma-separated category IDs for category sweep
    #[serde(default)]
    categories: String,
    #[serde(default = "default_sweep_weighting")]
    weighting: String,
    #[serde(default = "default_sweep_rebalance")]
    rebalance_days: i32,
    #[serde(default = "default_sweep_top_n")]
    top_n: i32,
    #[serde(default = "default_base_fee")]
    base_fee_pct: f64,
    #[serde(default = "default_spread_mult")]
    spread_multiplier: f64,
    #[serde(default)]
    threshold_pct: Option<f64>,
    #[serde(default)]
    start_date: Option<chrono::NaiveDate>,
}

fn default_sweep_weighting() -> String { "equal".into() }
fn default_sweep_rebalance() -> i32 { 30 }
fn default_sweep_top_n() -> i32 { 10 }

async fn sim_sweep_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimSweepQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, (StatusCode, Json<ErrorResponse>)> {
    // Build list of variants based on sweep dimension
    let variants: Vec<simulation::SimConfig> = match params.sweep.as_str() {
        "top_n" => {
            let weighting = simulation::Weighting::from_str(&params.weighting)
                .unwrap_or(simulation::Weighting::Equal);
            vec![5, 10, 20, 30, 50, 100, 200].into_iter().map(|n| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: n,
                    weighting: weighting.clone(),
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: params.threshold_pct,
                    start_date: params.start_date,
                }
            }).collect()
        }
        "weighting" => {
            // One representative variant per strategy family (default param)
            let all_weightings = vec![
                simulation::Weighting::Equal,
                simulation::Weighting::Mcap,
                simulation::Weighting::CappedMcap { cap_pct: 10.0 },
                simulation::Weighting::SqrtMcap,
                simulation::Weighting::Momentum { lookback_days: 90 },
                simulation::Weighting::InverseVolatility { lookback_days: 60 },
                simulation::Weighting::DualMomentum { lookback_days: 180 },
                simulation::Weighting::RiskParity { lookback_days: 60 },
                simulation::Weighting::MinVariance { lookback_days: 60 },
                simulation::Weighting::MultiFactor { lookback_days: 90 },
                simulation::Weighting::LowVolatility { lookback_days: 60 },
            ];
            all_weightings.into_iter().map(|w| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: w,
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: params.threshold_pct,
                    start_date: params.start_date,
                }
            }).collect()
        }
        "rebalance" => {
            let weighting = simulation::Weighting::from_str(&params.weighting)
                .unwrap_or(simulation::Weighting::Equal);
            // Periodic intervals (threshold=None)
            let mut configs: Vec<simulation::SimConfig> = vec![14, 30, 60, 90, 180].into_iter().map(|d| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: weighting.clone(),
                    rebalance_days: d,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: None,
                    start_date: params.start_date,
                }
            }).collect();
            // Drift-based bands (rebalance_days=365 safety fallback)
            for &pct in &[3.0, 5.0, 10.0, 15.0] {
                configs.push(simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: weighting.clone(),
                    rebalance_days: 365,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: Some(pct),
                    start_date: params.start_date,
                });
            }
            configs
        }
        // Keep "threshold" as alias — only drift bands (legacy)
        "threshold" => {
            let weighting = simulation::Weighting::from_str(&params.weighting)
                .unwrap_or(simulation::Weighting::Equal);
            let thresholds: Vec<Option<f64>> = vec![None, Some(3.0), Some(5.0), Some(10.0), Some(15.0)];
            thresholds.into_iter().map(|t| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: weighting.clone(),
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: t,
                    start_date: params.start_date,
                }
            }).collect()
        }
        "category" => {
            let cat_ids: Vec<String> = params.categories.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if cat_ids.is_empty() {
                return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse {
                    error: "category sweep requires 'categories' param with comma-separated IDs".into(),
                })));
            }
            let weighting = simulation::Weighting::from_str(&params.weighting)
                .unwrap_or(simulation::Weighting::Equal);
            cat_ids.into_iter().map(|cid| {
                simulation::SimConfig {
                    category_id: cid,
                    top_n: params.top_n,
                    weighting: weighting.clone(),
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: params.threshold_pct,
                    start_date: params.start_date,
                }
            }).collect()
        }
        other => {
            return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse {
                error: format!("Invalid sweep dimension '{}', use 'top_n', 'weighting', 'rebalance', 'threshold', or 'category'", other),
            })));
        }
    };

    let total_variants = variants.len();
    let pool = state.pool.clone();
    let sim_cache = state.sim_cache.clone();
    let (sse_tx, sse_rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(64);

    tokio::spawn(async move {
        let mut all_results = Vec::new();

        for (idx, config) in variants.iter().enumerate() {
            let variant_label = match params.sweep.as_str() {
                "top_n" => format!("top_n={}", config.top_n),
                "weighting" => format!("weighting={}", config.weighting.as_str()),
                "rebalance" => {
                    match config.threshold_rebalance_pct {
                        None => format!("periodic {}d", config.rebalance_days),
                        Some(t) => format!("drift {}%", t as i32),
                    }
                }
                "threshold" => {
                    match config.threshold_rebalance_pct {
                        None => format!("periodic {}d", config.rebalance_days),
                        Some(t) => format!("drift {}%", t as i32),
                    }
                }
                "category" => config.category_id.clone(),
                _ => format!("variant_{}", idx),
            };

            // Check cache
            if let Ok(Some(cached)) = db::sim_get_cached_run(
                &pool, &config.category_id, config.top_n,
                &config.cache_key_weighting(), config.rebalance_days,
                config.base_fee_pct, config.spread_multiplier,
            ).await {
                let nav_series = db::sim_query_nav_series(&pool, cached.id).await.unwrap_or_default();
                let done_json = serde_json::json!({
                    "type": "variant_done",
                    "variant": variant_label,
                    "variant_index": idx,
                    "total_variants": total_variants,
                    "run_id": cached.id,
                    "stats": {
                        "total_return_pct": cached.total_return_pct,
                        "annualized_return": cached.annualized_return,
                        "max_drawdown_pct": cached.max_drawdown_pct,
                        "sharpe_ratio": cached.sharpe_ratio,
                        "total_fees_pct": cached.total_fees_pct,
                        "total_trades": cached.total_trades,
                        "total_rebalances": cached.total_rebalances,
                        "total_delistings": cached.total_delistings,
                        "start_date": cached.start_date,
                        "end_date": cached.end_date,
                    },
                    "nav_series": nav_series,
                    "cached": true,
                });
                let _ = sse_tx.send(Ok(Event::default().data(done_json.to_string()))).await;
                all_results.push(done_json);
                continue;
            }

            // Run simulation with progress forwarding
            let (progress_tx, mut progress_rx) = tokio::sync::mpsc::channel::<simulation::SimProgress>(64);
            let sse_tx_progress = sse_tx.clone();
            let variant_label_clone = variant_label.clone();

            // Forward progress in background
            let progress_handle = tokio::spawn(async move {
                while let Some(mut progress) = progress_rx.recv().await {
                    progress.variant_index = Some(idx);
                    progress.total_variants = Some(total_variants);
                    let progress_json = serde_json::json!({
                        "type": "progress",
                        "variant": variant_label_clone,
                        "variant_index": idx,
                        "total_variants": total_variants,
                        "current_date": progress.current_date,
                        "total_dates": progress.total_dates,
                        "pct": progress.pct,
                    });
                    if sse_tx_progress.send(Ok(Event::default().data(progress_json.to_string()))).await.is_err() {
                        break;
                    }
                }
            });

            let result = simulation::run_simulation(&pool, config, Some(progress_tx), &sim_cache).await;
            let _ = progress_handle.await;

            match result {
                Ok(r) => {
                    let done_json = serde_json::json!({
                        "type": "variant_done",
                        "variant": variant_label,
                        "variant_index": idx,
                        "total_variants": total_variants,
                        "run_id": r.run_id,
                        "stats": r.stats,
                        "nav_series": r.nav_series,
                        "cached": false,
                    });
                    let _ = sse_tx.send(Ok(Event::default().data(done_json.to_string()))).await;
                    all_results.push(done_json);
                }
                Err(e) => {
                    let err_json = serde_json::json!({
                        "type": "variant_error",
                        "variant": variant_label,
                        "variant_index": idx,
                        "total_variants": total_variants,
                        "error": e.to_string(),
                    });
                    let _ = sse_tx.send(Ok(Event::default().data(err_json.to_string()))).await;
                }
            }
        }

        // Send sweep_done
        let sweep_done = serde_json::json!({
            "type": "sweep_done",
            "total_variants": total_variants,
            "simulations": all_results,
        });
        let _ = sse_tx.send(Ok(Event::default().data(sweep_done.to_string()))).await;
    });

    let stream = ReceiverStream::new(sse_rx);
    Ok(Sse::new(stream))
}

#[derive(Deserialize)]
struct SimResultsQuery {
    category_id: Option<String>,
}

async fn sim_results(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimResultsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let runs = db::sim_list_runs(&state.pool, params.category_id.as_deref())
        .await
        .map_err(|e| db_error(e))?;

    Ok(Json(serde_json::json!({ "results": runs })))
}

#[derive(Deserialize)]
struct SimCompareQuery {
    run_ids: String,
}

async fn sim_compare(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimCompareQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let ids: Vec<i64> = params.run_ids.split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    let mut simulations = Vec::new();
    for id in ids {
        let nav_series = db::sim_query_nav_series(&state.pool, id)
            .await
            .map_err(|e| db_error(e))?;
        simulations.push(serde_json::json!({
            "run_id": id,
            "nav_series": nav_series,
        }));
    }

    Ok(Json(serde_json::json!({ "simulations": simulations })))
}

#[derive(Deserialize)]
struct SimHoldingsQuery {
    run_id: i64,
    date: Option<chrono::NaiveDate>,
}

async fn sim_holdings(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimHoldingsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let holdings = db::sim_query_holdings_at(&state.pool, params.run_id, params.date)
        .await
        .map_err(|e| db_error(e))?;

    Ok(Json(serde_json::json!({ "holdings": holdings })))
}

#[derive(Deserialize)]
struct SimInvalidateQuery {
    run_id: i64,
}

async fn sim_invalidate(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimInvalidateQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let deleted = db::sim_delete_run(&state.pool, params.run_id)
        .await
        .map_err(|e| db_error(e))?;

    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

// ── Benchmark price series (BTC + ETH normalized to 1.0 at start) ──────────

#[derive(Deserialize)]
struct SimBenchmarkQuery {
    start_date: String,    // YYYY-MM-DD
    #[serde(default)]
    end_date: Option<String>,
}

async fn sim_benchmarks(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimBenchmarkQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let start = chrono::NaiveDate::parse_from_str(&params.start_date, "%Y-%m-%d")
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Invalid start_date".into() })))?;
    let end = params.end_date.as_ref()
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let cache = &state.sim_cache;
    let benchmarks = vec![("bitcoin", "BTC"), ("ethereum", "ETH")];
    let mut result: Vec<serde_json::Value> = Vec::new();

    for (coin_id, symbol) in &benchmarks {
        let prices = match cache.prices.get(*coin_id) {
            Some(p) => p,
            None => continue,
        };

        // Collect dates from start..end, sorted
        let mut points: Vec<(chrono::NaiveDate, f64)> = prices.iter()
            .filter(|(d, _)| **d >= start && end.map_or(true, |e| **d <= e))
            .map(|(d, p)| (*d, *p))
            .collect();
        points.sort_by_key(|(d, _)| *d);

        if points.is_empty() { continue; }
        let base_price = points[0].1;
        if base_price <= 0.0 { continue; }

        let nav_series: Vec<serde_json::Value> = points.iter()
            .map(|(d, p)| serde_json::json!({
                "nav_date": d.to_string(),
                "nav": p / base_price,
            }))
            .collect();

        result.push(serde_json::json!({
            "symbol": symbol,
            "coin_id": coin_id,
            "nav_series": nav_series,
        }));
    }

    Ok(Json(serde_json::json!({ "benchmarks": result })))
}
