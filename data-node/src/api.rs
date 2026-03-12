use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Json;
use axum::routing::get;
use axum::Router;
use chrono::{DateTime, Utc};
use ethers::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use subtle::ConstantTimeEq;
use tokio::sync::RwLock;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};

use common::BitgetReadOnlyClient;

use crate::collector::CollectorState;
use crate::db;
use crate::live_cache::{CachedTicker, LiveTickerCache};
use crate::orderbook_aggregator::{self, AggregatedOrderbook, OrderbookCache};
use crate::simulation;

/// Cached per-source health stats, refreshed in background every 60s.
#[derive(Clone, Default)]
pub struct HealthStatsEntry {
    pub total_assets: i64,
    pub active_assets: i64,
    pub zero_count: i64,
    pub stale_count: i64,
    /// Stale assets with value=0 (naturally dormant: offline streamers, resolved markets, etc.)
    pub stale_dormant: i64,
    pub avg_change_pct: f64,
    pub no_change_count: i64,
    pub newest_record: Option<DateTime<Utc>>,
}

pub struct HealthStatsCache {
    data: RwLock<HashMap<String, HealthStatsEntry>>,
    last_updated: RwLock<Option<DateTime<Utc>>>,
}

impl HealthStatsCache {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(HashMap::new()),
            last_updated: RwLock::new(None),
        }
    }

    pub async fn get_all(&self) -> HashMap<String, HealthStatsEntry> {
        self.data.read().await.clone()
    }
}

/// Spawns a background task that refreshes stale/zero/change stats every 60s.
pub fn spawn_health_stats_refresh(pool: PgPool, cache: Arc<HealthStatsCache>) {
    tokio::spawn(async move {
        // Small delay to let sources register first
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        // Fast initial load: just asset counts + newest records (skip heavy DISTINCT ON)
        match refresh_health_stats_fast(&pool, &cache).await {
            Ok(n) => tracing::info!("health stats cache fast-init ({} sources)", n),
            Err(e) => tracing::warn!("health stats cache fast-init failed: {}", e),
        }
        // Full refresh with stale/zero counts
        loop {
            match refresh_health_stats(&pool, &cache).await {
                Ok(n) => tracing::info!("health stats cache refreshed ({} sources)", n),
                Err(e) => tracing::warn!("health stats cache refresh failed: {}", e),
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        }
    });
}

/// Fast initial cache load: only asset counts + newest records (no stale/zero scan).
async fn refresh_health_stats_fast(
    pool: &PgPool,
    cache: &HealthStatsCache,
) -> Result<usize, String> {
    let mut stats: HashMap<String, HealthStatsEntry> = HashMap::new();

    let asset_counts: Vec<(String, i64, i64)> = sqlx::query_as(
        r#"SELECT source, COUNT(*)::bigint, COUNT(*) FILTER (WHERE is_active)::bigint FROM market_assets GROUP BY source"#,
    )
    .fetch_all(pool).await.map_err(|e| format!("fast init assets: {}", e))?;
    for (source, total, active) in &asset_counts {
        let entry = stats.entry(source.clone()).or_default();
        entry.total_assets = *total;
        entry.active_assets = *active;
    }

    let newest_rows: Vec<(String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT source, MAX(fetched_at) as newest FROM market_prices GROUP BY source",
    )
    .fetch_all(pool).await.map_err(|e| format!("fast init newest: {}", e))?;
    for (source, newest) in newest_rows {
        let entry = stats.entry(source.clone()).or_default();
        entry.newest_record = Some(newest);
    }

    let count = stats.len();
    *cache.data.write().await = stats;
    *cache.last_updated.write().await = Some(Utc::now());
    Ok(count)
}

async fn refresh_health_stats(
    pool: &PgPool,
    cache: &HealthStatsCache,
) -> Result<usize, String> {
    let start = std::time::Instant::now();
    let now = Utc::now();

    // Build interval lookup from SOURCE_META
    let interval_lookup: HashMap<&str, u64> =
        SOURCE_META.iter().map(|(id, _, iv)| (*id, *iv)).collect();

    let mut stats: HashMap<String, HealthStatsEntry> = HashMap::new();

    // Query A: Per-source asset counts (market_assets is small, fast)
    tracing::info!("health cache: starting query A (asset counts)");
    let asset_counts: Vec<(String, i64, i64)> = sqlx::query_as(
        r#"
        SELECT source,
               COUNT(*)::bigint as total,
               COUNT(*) FILTER (WHERE is_active)::bigint as active
        FROM market_assets
        GROUP BY source
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("asset counts: {}", e))?;

    for (source, total, active) in &asset_counts {
        let entry = stats.entry(source.clone()).or_default();
        entry.total_assets = *total;
        entry.active_assets = *active;
    }

    // Query B: Per-source newest record (uses source_fetched index)
    tracing::info!("health cache: query A done ({} sources, {:?}), starting query B", asset_counts.len(), start.elapsed());
    let newest_rows: Vec<(String, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT source, MAX(fetched_at) as newest
        FROM market_prices
        GROUP BY source
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("newest query: {}", e))?;

    for (source, newest) in newest_rows {
        let entry = stats.entry(source.clone()).or_default();
        entry.newest_record = Some(newest);
    }

    // Query C: Latest price per (source, asset_id) for zero/stale counting (7d window)
    tracing::info!("health cache: query B done ({:?}), starting query C (7d DISTINCT ON)", start.elapsed());
    let rows: Vec<(String, rust_decimal::Decimal, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT source, value, fetched_at FROM (
            SELECT DISTINCT ON (source, asset_id)
                   source, value, fetched_at
            FROM market_prices
            WHERE fetched_at > NOW() - INTERVAL '7 days'
            ORDER BY source, asset_id, fetched_at DESC
        ) sub
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("health stats query: {}", e))?;

    // Count zeros and stale per source
    let mut source_assets_seen: HashMap<String, i64> = HashMap::new();
    for (source, value, fetched_at) in &rows {
        let entry = stats.entry(source.clone()).or_default();
        *source_assets_seen.entry(source.clone()).or_insert(0) += 1;

        let is_zero = value.is_zero();
        if is_zero {
            entry.zero_count += 1;
        }
        let interval = interval_lookup.get(source.as_str()).copied().unwrap_or(600);
        let stale_threshold = chrono::Duration::seconds((interval as i64) * 3);
        if now - *fetched_at > stale_threshold {
            entry.stale_count += 1;
            if is_zero {
                entry.stale_dormant += 1;
            }
        }
    }

    // For sources with active assets but NO prices in 7d window → all assets are stale
    for (source, total, active) in &asset_counts {
        let _ = total;
        let seen = source_assets_seen.get(source).copied().unwrap_or(0);
        if *active > 0 && seen == 0 {
            let entry = stats.entry(source.clone()).or_default();
            entry.stale_count = *active;
        } else if *active > seen {
            let entry = stats.entry(source.clone()).or_default();
            entry.stale_count += *active - seen;
        }
    }

    let count = stats.len();
    tracing::info!("health cache: all queries done in {:?}, writing {} sources to cache", start.elapsed(), count);
    *cache.data.write().await = stats;
    *cache.last_updated.write().await = Some(Utc::now());
    Ok(count)
}

pub struct AppState {
    pub pool: PgPool,
    pub collector: Arc<CollectorState>,
    pub symbol_map: HashMap<String, String>,
    pub cache: PriceCache,
    pub live_cache: Arc<LiveTickerCache>,
    pub l3_provider: Arc<Provider<Http>>,
    pub settlement_provider: Arc<Provider<Http>>,
    pub deployment: serde_json::Value,
    pub morpho_deployment: serde_json::Value,
    pub logos_dir: std::path::PathBuf,
    /// Global simulation data cache — loaded at startup, can be reloaded via /sim/reload-cache.
    pub sim_cache: Arc<RwLock<Arc<simulation::SimDataCache>>>,
    pub chain_cache: Arc<crate::chain_cache::ChainCache>,
    /// Optional admin token for protecting destructive admin endpoints.
    pub admin_token: Option<String>,
    /// P2.8: Allowed CORS origins (empty = allow any, with warning)
    pub cors_origins: Vec<String>,
    /// Background-refreshed health stats (zero/stale counts per source)
    pub health_stats_cache: Arc<HealthStatsCache>,
    /// Auto-batch engine state (recommended + signed configs)
    pub batch_engine: Arc<crate::batch_engine::BatchEngineState>,
    /// Bitget read-only client for orderbook fetches
    pub bitget_client: Arc<dyn BitgetReadOnlyClient + Send + Sync>,
    /// Orderbook aggregation cache (5s TTL)
    pub orderbook_cache: Arc<OrderbookCache>,
    /// Price broadcast hub for WebSocket streaming
    pub price_broadcast: Arc<crate::market_data::broadcast::PriceBroadcastHub>,
    /// Batch config cache for Vision WebSocket/history endpoints
    pub vision_batch_cache: Arc<crate::vision_batch_cache::VisionBatchCache>,
    /// Shared HMAC secret for authenticating snapshot responses (IS-7)
    pub snapshot_hmac_secret: Option<String>,
    /// Chain event broadcast channel for backend SSE consumers (issuers, AP)
    pub chain_event_tx: tokio::sync::broadcast::Sender<crate::chain_event_scanner::ChainEventEnvelope>,
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
    // P2.8: Restrict CORS origins when configured
    let cors = if state.cors_origins.is_empty() {
        tracing::warn!("No CORS origins configured — allowing all origins (use --cors-origin to restrict)");
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        let origins: Vec<axum::http::HeaderValue> = state.cors_origins.iter()
            .filter_map(|o| o.parse().ok())
            .collect();
        tracing::info!(origins = ?state.cors_origins, "CORS restricted to configured origins");
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods(Any)
            .allow_headers(Any)
    };

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
        .route("/fill-speed", get(fill_speed))
        .route("/latest-prices", get(latest_prices))
        .route("/prices-by-address", get(prices_by_address))
        .route("/fast-prices", get(fast_prices))
        .route("/fast-prices-by-address", get(fast_prices_by_address))
        .route("/itp-bid-ask", get(itp_bid_ask))
        .route("/itp-orderbook", get(itp_orderbook))
        .route("/liquidity", get(liquidity))
        .route("/liquidity/alerts", get(liquidity_alerts))
        .route("/user-state", get(user_state))
        .route("/morpho-position", get(morpho_position))
        .route("/morpho-history", get(morpho_history))
        .route("/order", get(order))
        .route("/vault-balances", get(vault_balances))
        .route("/logo/:coin_id", get(serve_logo))
        .route("/coin-map", get(coin_map))
        .route("/cg/categories", get(cg_categories))
        .route("/cg/category-coins/:category_id", get(cg_category_coins))
        .route("/cg/coin-categories/:coin_id", get(cg_coin_categories))
        .route("/listings", get(listings))
        .route("/listings/unsafe", get(listings_unsafe))
        .route("/listing", get(listing))
        .route("/dl/investors", get(dl_investors))
        .route("/sim/categories", get(sim_categories))
        .route("/sim/run", get(sim_run))
        .route("/sim/run-stream", get(sim_run_stream))
        .route("/sim/sweep-stream", get(sim_sweep_stream))
        .route("/sim/results", get(sim_results))
        .route("/sim/compare", get(sim_compare))
        .route("/sim/holdings", get(sim_holdings))
        .route("/sim/invalidate", get(sim_invalidate))
        .route("/sim/benchmarks", get(sim_benchmarks))
        .route("/sim/reload-cache", get(sim_reload_cache))
        .route("/fng/latest", get(fng_latest))
        // Market data endpoints
        .route("/market/prices/:source", get(market_prices))
        .route("/market/prices/:source/:asset_id", get(market_asset_price))
        .route("/market/prices/:source/:asset_id/history", get(market_price_history))
        .route("/market/assets/:source", get(market_assets))
        .route("/market/stats", get(market_stats_bulk))
        .route("/market/stats/:source", get(market_stats))
        .route("/market/batch-history", get(market_batch_history))
        // Vision snapshot endpoints
        .route("/snapshot", get(snapshot))
        .route("/snapshot/meta", get(snapshot_meta))
        // Vision market data endpoints
        .route("/vision/snapshot", get(crate::vision_api::snapshot))
        .route("/vision/markets/active", get(crate::vision_api::active_markets))
        .route("/vision/batch/:batch_id/history", get(crate::vision_api::batch_history))
        .route("/vision/ws", get(crate::vision_ws::ws_handler))
        // Batch config endpoints
        .route("/batches/recommended", get(batches_recommended))
        .route("/batches/config/:hash", get(batch_config_by_hash))
        .route("/batches/signed", get(batches_signed))
        .route("/batches/signed", axum::routing::post(store_signed_batch))
        .route("/batches/replicate", axum::routing::post(replicate_signed_batch))
        .route("/batches/settlement", axum::routing::post(record_batch_settlement))
        // Admin endpoints
        .route("/admin/truncate/:table", axum::routing::post(admin_truncate))
        .route("/admin/reset-session", axum::routing::post(admin_reset_session))
        // Source monitoring endpoints
        .route("/admin/sources/health", get(admin_sources_health))
        .route("/admin/sources/:source_id/assets", get(admin_source_assets))
        .route("/admin/sources/:source_id/history", get(admin_source_history))
        .route("/admin/sources/:source_id/force-sync", axum::routing::post(admin_force_sync))
        .route("/sse/system-status", get(sse_system_status))
        .route("/sse/stream", get(sse_stream))
        .route("/sse/chain-events", get(sse_chain_events))
        // Chain state endpoints for issuers/AP
        .route("/chain/l3/pending-orders", get(chain_l3_pending_orders))
        .route("/chain/l3/batched-orders", get(chain_l3_batched_orders))
        .route("/chain/l3/issuer-registry", get(chain_l3_issuer_registry))
        .route("/chain/l3/last-cycle", get(chain_l3_last_cycle))
        .route("/chain/l3/next-order-id", get(chain_l3_next_order_id))
        .route("/chain/l3/pending-rebalances", get(chain_l3_pending_rebalances))
        .route("/chain/l3/active-issuer-count", get(chain_l3_active_issuer_count))
        .route("/chain/l3/aggregated-pubkey", get(chain_l3_aggregated_pubkey))
        .route("/chain/l3/consensus-paused", get(chain_l3_consensus_paused))
        .route("/chain/l3/registry-nonce", get(chain_l3_registry_nonce))
        .route("/chain/l3/itp-state", get(chain_l3_itp_state))
        .route("/chain/settlement/confirmed-block", get(chain_settlement_confirmed_block))
        .route("/chain/settlement/pending-creations", get(chain_settlement_pending_creations))
        .route("/chain/settlement/is-pending/:nonce", get(chain_settlement_is_pending))
        .route("/chain/settlement/next-nonce", get(chain_settlement_next_nonce))
        .route("/chain/settlement/cross-chain-orders", get(chain_settlement_cross_chain_orders))
        .route("/chain/settlement/cross-chain-sell-orders", get(chain_settlement_cross_chain_sell_orders))
        .layer(CompressionLayer::new())
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

        // Track consecutive minutes without kline data; stop emitting
        // candles once we've gone 5+ minutes with no real data to avoid
        // stale flat candles that diverge from the live NAV.
        let mut consecutive_empty_minutes: i64 = 0;
        const MAX_EMPTY_MINUTES: i64 = 5;

        let mut minute_ts = start_minute;
        while minute_ts <= end_minute {
            // If klines exist for this minute, update last-known prices
            if let Some(klines) = minute_klines.get(&minute_ts) {
                consecutive_empty_minutes = 0;
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
                consecutive_empty_minutes += 1;
                if consecutive_empty_minutes > MAX_EMPTY_MINUTES {
                    // Too long without real data — stop emitting stale candles
                    minute_ts += 60;
                    continue;
                }
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
    let result = tokio::time::timeout(Duration::from_secs(30), async {
    let top_n = params.top_n.unwrap_or(10);

    // Default to last 7 days when no date range is provided to avoid full-scan N² explosion
    let from: Option<DateTime<Utc>> = params
        .from
        .as_ref()
        .and_then(|s| s.parse().ok())
        .or_else(|| Some(Utc::now() - chrono::Duration::days(7)));
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
    }).await;

    match result {
        Ok(inner) => inner,
        Err(_) => Err((
            StatusCode::GATEWAY_TIMEOUT,
            Json(ErrorResponse {
                error: "aum-ranking computation timed out".to_string(),
            }),
        )),
    }
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

    // For each ITP, fetch daily NAV series from stored snapshots (correct even across rebalances)
    let mut itp_nav_series: HashMap<String, Vec<(i64, f64)>> = HashMap::new();

    for itp_id in &itp_ids {
        let nav_points = db::query_itp_nav_series(&state.pool, itp_id, start, now)
            .await
            .map_err(|e| db_error(e))?;

        if !nav_points.is_empty() {
            itp_nav_series.insert(itp_id.clone(), nav_points);
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

// ---- /fill-speed ----

#[derive(Serialize)]
struct FillSpeedEntry {
    order_id: i64,
    side: i16,
    amount: String,
    submit_time: String,
    fill_time: Option<String>,
    fill_latency_secs: Option<f64>,
    fill_price: Option<String>,
    fill_amount: Option<String>,
}

async fn fill_speed(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<FillSpeedEntry>>, (StatusCode, Json<ErrorResponse>)> {
    let rows = sqlx::query_as::<_, (i64, i16, String, DateTime<Utc>, Option<DateTime<Utc>>, Option<String>, Option<String>)>(
        "SELECT order_id, side, amount, order_timestamp, fill_timestamp, fill_price, fill_amount \
         FROM trades ORDER BY order_timestamp DESC LIMIT 200"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| db_error(e))?;

    let entries: Vec<FillSpeedEntry> = rows
        .into_iter()
        .map(|(oid, side, amt, submit, fill_ts, fp, fa)| {
            let latency = fill_ts.map(|ft| (ft - submit).num_milliseconds() as f64 / 1000.0);
            FillSpeedEntry {
                order_id: oid,
                side,
                amount: amt,
                submit_time: submit.to_rfc3339(),
                fill_time: fill_ts.map(|ft| ft.to_rfc3339()),
                fill_latency_secs: latency,
                fill_price: fp,
                fill_amount: fa,
            }
        })
        .collect();

    Ok(Json(entries))
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

// ---- /itp-orderbook ----

#[derive(Deserialize)]
struct ItpOrderbookQuery {
    itp_id: String,
    /// Number of aggregated levels per side (default 15, max 50)
    #[serde(default = "default_ob_levels")]
    levels: usize,
    /// Aggregation threshold in basis points (default 10)
    #[serde(default = "default_ob_agg_bps")]
    aggregation_bps: u64,
}

fn default_ob_levels() -> usize { 15 }
fn default_ob_agg_bps() -> u64 { 10 }

async fn itp_orderbook(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ItpOrderbookQuery>,
) -> Result<Json<AggregatedOrderbook>, (StatusCode, Json<ErrorResponse>)> {
    let itp_id = params.itp_id.to_lowercase();
    let levels = params.levels.min(50).max(1);
    let aggregation_bps = params.aggregation_bps.min(1000);

    // Check cache first
    let cache_key = format!("{}-{}-{}", itp_id, levels, aggregation_bps);
    if let Some(cached) = state.orderbook_cache.get(&cache_key).await {
        return Ok(Json(cached));
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

    // Map asset addresses to Bitget symbols with inventory and weight_bps
    let mut asset_inputs: Vec<orderbook_aggregator::AssetInput> = Vec::new();

    // Compute total weight for normalization
    let total_weight: f64 = snapshot.weights.iter()
        .filter_map(|w| w.parse::<f64>().ok())
        .sum();

    for (i, asset_addr) in snapshot.assets.iter().enumerate() {
        let inv_val: f64 = snapshot.inventory[i].parse().unwrap_or(0.0);
        let wt_val: f64 = snapshot.weights.get(i)
            .and_then(|w| w.parse().ok())
            .unwrap_or(0.0);

        if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
            // Check if we already have this symbol (dedup)
            if let Some(existing) = asset_inputs.iter_mut().find(|a| a.symbol == *pair) {
                existing.inventory += inv_val;
                existing.weight_bps += if total_weight > 0.0 {
                    ((wt_val / total_weight) * 10000.0) as u64
                } else {
                    0
                };
            } else {
                let weight_bps = if total_weight > 0.0 {
                    ((wt_val / total_weight) * 10000.0) as u64
                } else {
                    0
                };
                asset_inputs.push(orderbook_aggregator::AssetInput {
                    symbol: pair.clone(),
                    inventory: inv_val,
                    weight_bps,
                });
            }
        }
    }

    if asset_inputs.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "No mapped Bitget symbols found for this ITP".into(),
            }),
        ));
    }

    // Fetch real depth directly — parallel Bitget fetches typically complete in ~1s.
    // Result is cached (5s TTL), so subsequent requests are instant.
    let client = Arc::clone(&state.bitget_client);
    let book = orderbook_aggregator::fetch_and_aggregate(
        &client,
        &asset_inputs,
        levels,
        aggregation_bps,
    ).await;

    state.orderbook_cache.set(cache_key, book.clone()).await;

    Ok(Json(book))
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
        function nextOrderId() external view returns (uint256)
        function pendingOrderCount() external view returns (uint256)
        function lastProcessedCycleNumber() external view returns (uint256)
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
    ]"#
);

abigen!(
    IssuerRegistryReader,
    r#"[{"type":"function","name":"getIssuers","inputs":[],"outputs":[{"name":"","type":"tuple[]","components":[{"name":"addr","type":"address"},{"name":"ip","type":"bytes32"},{"name":"blsPubkey","type":"bytes"},{"name":"status","type":"uint8"},{"name":"registeredAt","type":"uint256"}]}],"stateMutability":"view"},{"type":"function","name":"activeIssuerCount","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"}]"#
);

abigen!(
    MockBitgetVaultReader,
    r#"[
        function getBalance(address token) external view returns (uint256)
        function getPrice(address token) external view returns (uint256)
    ]"#
);

// Helper: get address from deployment JSON
pub(crate) fn deployment_addr(deployment: &serde_json::Value, key: &str) -> Result<Address, String> {
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

    let l3 = &state.l3_provider;

    // Morpho is on L3 — read addresses from morpho deployment
    let morpho_addr = deployment_addr(&state.morpho_deployment, "MORPHO").map_err(|e| rpc_error(e))?;

    // Collateral token = vault ERC20 on L3 (from morpho market params)
    let vault_addr_str = state.morpho_deployment["marketParams"]["collateralToken"]
        .as_str()
        .ok_or_else(|| rpc_error("Missing marketParams.collateralToken in morpho deployment".to_string()))?;
    let vault_addr: Address = vault_addr_str.parse().map_err(|e| rpc_error(format!("Invalid collateralToken: {}", e)))?;

    // Loan token = L3_WUSDC (from morpho market params)
    let loan_addr_str = state.morpho_deployment["marketParams"]["loanToken"]
        .as_str()
        .ok_or_else(|| rpc_error("Missing marketParams.loanToken in morpho deployment".to_string()))?;
    let loan_addr: Address = loan_addr_str.parse().map_err(|e| rpc_error(format!("Invalid loanToken: {}", e)))?;

    // USDC balance + allowances (L3_WUSDC on L3)
    let usdc = ERC20Reader::new(loan_addr, Arc::clone(l3));
    let usdc_balance = usdc.balance_of(user).call().await.map_err(|e| rpc_error(format!("USDC balanceOf: {}", e)))?;
    let usdc_allowance_custody = U256::zero(); // No custody on L3 for lending
    let usdc_allowance_morpho = usdc.allowance(user, morpho_addr).call().await.map_err(|e| rpc_error(format!("USDC allowance morpho: {}", e)))?;

    // Vault ERC20 reads (collateral token on L3)
    let vault = ERC20Reader::new(vault_addr, Arc::clone(l3));
    let vault_balance = vault.balance_of(user).call().await.unwrap_or_default();
    let vault_allowance_morpho = vault.allowance(user, morpho_addr).call().await.unwrap_or_default();
    let vault_name = vault.name().call().await.unwrap_or_default();
    let vault_symbol = vault.symbol().call().await.unwrap_or_default();
    let vault_total_supply = vault.total_supply().call().await.unwrap_or_default();

    Ok(Json(UserStateResponse {
        usdc_balance: usdc_balance.to_string(),
        usdc_allowance_custody: usdc_allowance_custody.to_string(),
        usdc_allowance_morpho: usdc_allowance_morpho.to_string(),
        bridged_itp_address: format!("{:?}", vault_addr),
        bridged_itp_balance: vault_balance.to_string(),
        bridged_itp_allowance_custody: "0".to_string(), // No custody for L3 lending
        bridged_itp_allowance_morpho: vault_allowance_morpho.to_string(),
        bridged_itp_name: vault_name,
        bridged_itp_symbol: vault_symbol,
        bridged_itp_total_supply: vault_total_supply.to_string(),
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
    let l3 = &state.l3_provider;

    let morpho_addr = deployment_addr(&state.morpho_deployment, "MORPHO").map_err(|e| rpc_error(e))?;
    let oracle_addr = deployment_addr(&state.morpho_deployment, "ITP_NAV_ORACLE")
        .or_else(|_| deployment_addr(&state.morpho_deployment, "MOCK_ORACLE"))
        .map_err(|e| rpc_error(e))?;

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

    let morpho = MorphoReader::new(morpho_addr, Arc::clone(l3));
    let oracle = MockOracleReader::new(oracle_addr, Arc::clone(l3));

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

// ---- /morpho-history ----

#[derive(Deserialize)]
struct MorphoHistoryQuery {
    address: String,
}

#[derive(Serialize)]
struct MorphoHistoryEntry {
    event_type: String, // "deposit", "withdraw", "borrow", "repay"
    amount: String,
    token: String,
    tx_hash: String,
    block_number: u64,
}

async fn morpho_history(
    State(state): State<Arc<AppState>>,
    Query(q): Query<MorphoHistoryQuery>,
) -> Result<Json<Vec<MorphoHistoryEntry>>, (StatusCode, Json<ErrorResponse>)> {
    let user: Address = q.address.parse()
        .map_err(|e| rpc_error(format!("Invalid address: {}", e)))?;

    let morpho_addr = deployment_addr(&state.morpho_deployment, "MORPHO")
        .map_err(|e| rpc_error(e))?;

    // Scan last 10_000 blocks for Morpho events (on L3)
    let latest_block = state.l3_provider.get_block_number().await
        .map_err(|e| rpc_error(format!("get_block_number: {}", e)))?
        .as_u64();
    let from_block = latest_block.saturating_sub(10_000);

    // The user address (onBehalf) is topic3, NOT topic2.
    // Event layout: topic0=sig, topic1=id(bytes32), topic2=caller, topic3=onBehalf
    let user_h256 = H256::from(user);
    let filter = ethers::types::Filter::new()
        .address(morpho_addr)
        .from_block(from_block)
        .to_block(latest_block)
        .topic3(user_h256);

    let logs = state.l3_provider.get_logs(&filter).await
        .map_err(|e| rpc_error(format!("get_logs: {}", e)))?;

    // Precompute event signature hashes
    let supply_sig = H256::from(ethers::core::utils::keccak256(
        "SupplyCollateral(bytes32,address,address,uint256)",
    ));
    let withdraw_sig = H256::from(ethers::core::utils::keccak256(
        "WithdrawCollateral(bytes32,address,address,address,uint256)",
    ));
    let borrow_sig = H256::from(ethers::core::utils::keccak256(
        "Borrow(bytes32,address,address,address,uint256,uint256)",
    ));
    let repay_sig = H256::from(ethers::core::utils::keccak256(
        "Repay(bytes32,address,address,uint256,uint256)",
    ));

    let mut entries = Vec::new();
    for log in &logs {
        if log.topics.is_empty() { continue; }
        let topic0 = log.topics[0];

        // Determine event type and amount offset in log.data
        // SupplyCollateral: data = [assets:uint256]            → amount at byte 0
        // Repay:            data = [assets:uint256, shares]    → amount at byte 0
        // WithdrawCollateral: data = [receiver:addr, assets]   → amount at byte 32
        // Borrow:           data = [receiver:addr, assets, shares] → amount at byte 32
        let (event_type, amount_offset) = if topic0 == supply_sig {
            ("deposit", 0usize)
        } else if topic0 == withdraw_sig {
            ("withdraw", 32usize)
        } else if topic0 == borrow_sig {
            ("borrow", 32usize)
        } else if topic0 == repay_sig {
            ("repay", 0usize)
        } else {
            continue;
        };

        let amount = if log.data.len() >= amount_offset + 32 {
            U256::from_big_endian(&log.data[amount_offset..amount_offset + 32]).to_string()
        } else {
            "0".to_string()
        };

        let token = match event_type {
            "deposit" | "withdraw" => "ITP",
            _ => "USDC",
        };

        entries.push(MorphoHistoryEntry {
            event_type: event_type.to_string(),
            amount,
            token: token.to_string(),
            tx_hash: format!("{:?}", log.transaction_hash.unwrap_or_default()),
            block_number: log.block_number.map(|b| b.as_u64()).unwrap_or(0),
        });
    }

    Ok(Json(entries))
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
    let settlement = &state.settlement_provider;

    let vault_addr = deployment_addr(&state.deployment, "MockBitgetVault").map_err(|e| rpc_error(e))?;
    let settlement_usdc_addr = deployment_addr(&state.deployment, "SETTLEMENT_USDC").map_err(|e| rpc_error(e))?;
    let vault = MockBitgetVaultReader::new(vault_addr, Arc::clone(settlement));

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
    let usdc_token = ERC20Reader::new(settlement_usdc_addr, Arc::clone(settlement));
    if let Ok(usdc_balance) = usdc_token.balance_of(vault_addr).call().await {
        if usdc_balance > U256::zero() {
            let usdc_f64: f64 = usdc_balance.to_string().parse().unwrap_or(0.0);
            assets.push(VaultAsset {
                address: format!("{:?}", settlement_usdc_addr),
                symbol: "USDC".to_string(),
                balance: usdc_balance.to_string(),
                price: "1000000000000000000".to_string(), // $1 in wei
                usd_value: usdc_f64 / 1e6,
            });
        }
    }

    // Sort by USD value descending
    assets.sort_by(|a, b| b.usd_value.partial_cmp(&a.usd_value).unwrap_or(std::cmp::Ordering::Equal));

    // AUM = only real collateral (USDC), not mock liquidity tokens
    let total_usd: f64 = assets.iter()
        .filter(|a| a.symbol == "USDC")
        .map(|a| a.usd_value)
        .sum();
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

fn internal_error(e: impl std::fmt::Display) -> (StatusCode, Json<ErrorResponse>) {
    tracing::error!("{e}", e = e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: format!("Internal error: {}", e) }),
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

// ---- /coin-map ---- returns symbol → coin_id mapping for logo lookups

async fn coin_map(
    State(state): State<Arc<AppState>>,
) -> Json<HashMap<String, String>> {
    let cache = state.sim_cache.read().await;
    // Invert coin_symbol_map (coin_id→symbol) to symbol→coin_id.
    // If multiple coin_ids share a symbol, last one wins (fine for logos).
    let mut map: HashMap<String, String> = HashMap::new();
    for (coin_id, symbol) in &cache.coin_symbol_map {
        map.insert(symbol.clone(), coin_id.clone());
    }
    Json(map)
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

async fn dl_investors(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let rows = db::dl_query_investors(&state.pool).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse {
            error: format!("DB error: {e}"),
        })))?;
    let investors: Vec<serde_json::Value> = rows.iter().map(|(name, count)| {
        serde_json::json!({ "name": name, "raise_count": count })
    }).collect();
    Ok(Json(serde_json::json!({ "investors": investors })))
}

async fn sim_categories(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    // Serve from in-memory cache — instant response, no DB hit.
    let cache = state.sim_cache.read().await;
    let result: Vec<&simulation::CachedCategoryInfo> = cache.categories.iter()
        .filter(|c| !CATEGORY_BLACKLIST.contains(&c.id.as_str()))
        .collect();
    Json(serde_json::json!({ "categories": result }))
}

async fn sim_reload_cache(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    tracing::info!("Reloading sim data cache...");
    match simulation::SimDataCache::load(&state.pool).await {
        Ok(new_cache) => {
            let cat_count = new_cache.categories.len();
            let dl_cats = new_cache.categories.iter().filter(|c| c.source == "defillama").count();
            let date_count = new_cache.all_dates.len();
            let first_date = new_cache.all_dates.first().map(|d| d.to_string());
            let last_date = new_cache.all_dates.last().map(|d| d.to_string());
            let mut cache = state.sim_cache.write().await;
            *cache = new_cache;
            tracing::info!(categories = cat_count, dl_categories = dl_cats, dates = date_count, "Sim data cache reloaded");
            Ok(Json(serde_json::json!({
                "status": "ok",
                "categories": cat_count,
                "dl_categories": dl_cats,
                "dates": date_count,
                "first_date": first_date,
                "last_date": last_date,
            })))
        }
        Err(e) => {
            tracing::error!(%e, "Failed to reload sim cache");
            Err((StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse {
                error: format!("Cache reload failed: {e}"),
            })))
        }
    }
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
    #[serde(default)]
    vc_mode: Option<String>,
    #[serde(default)]
    vc_investors: Option<String>,
    #[serde(default)]
    vc_min_amount_m: Option<f64>,
    #[serde(default)]
    vc_round_types: Option<String>,
    // FNG regime params
    #[serde(default)]
    fng_mode: Option<String>,
    #[serde(default)]
    fng_fear_threshold: Option<i32>,
    #[serde(default)]
    fng_greed_threshold: Option<i32>,
    #[serde(default)]
    fng_cash_pct: Option<f64>,
    // Dominance regime params
    #[serde(default)]
    dom_mode: Option<String>,
    #[serde(default)]
    dom_lookback: Option<i32>,
}

fn default_base_fee() -> f64 { 0.1 }
fn default_spread_mult() -> f64 { 1.0 }

/// Build FNG regime from query params (returns None if fng_mode is absent).
fn build_fng_regime(
    mode: &Option<String>,
    fear: Option<i32>,
    greed: Option<i32>,
    cash_pct: Option<f64>,
) -> Option<simulation::FngRegime> {
    let m = mode.as_deref().filter(|s| !s.is_empty())?;
    Some(simulation::FngRegime {
        mode: m.to_string(),
        fear_threshold: fear.unwrap_or(25),
        greed_threshold: greed.unwrap_or(75),
        cash_pct_greed: cash_pct.unwrap_or(0.4),
    })
}

/// Build Dominance regime from query params.
fn build_dominance_regime(
    mode: &Option<String>,
    lookback: Option<i32>,
) -> Option<simulation::DominanceRegime> {
    let m = mode.as_deref().filter(|s| !s.is_empty())?;
    Some(simulation::DominanceRegime {
        mode: m.to_string(),
        lookback_days: lookback.unwrap_or(30),
    })
}

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
        vc_mode: params.vc_mode.clone(),
        vc_investors: params.vc_investors.clone(),
        vc_min_amount_m: params.vc_min_amount_m,
        vc_round_types: params.vc_round_types.clone(),
        fng_regime: build_fng_regime(&params.fng_mode, params.fng_fear_threshold, params.fng_greed_threshold, params.fng_cash_pct),
        dominance_regime: build_dominance_regime(&params.dom_mode, params.dom_lookback),
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
    let sim_cache = state.sim_cache.read().await.clone();
    let result = simulation::run_simulation(&state.pool, &config_for_cache, None, &sim_cache)
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

    let fng_regime = build_fng_regime(&params.fng_mode, params.fng_fear_threshold, params.fng_greed_threshold, params.fng_cash_pct);
    let dominance_regime = build_dominance_regime(&params.dom_mode, params.dom_lookback);

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
            vc_mode: params.vc_mode.clone(),
            vc_investors: params.vc_investors.clone(),
            vc_min_amount_m: params.vc_min_amount_m,
            vc_round_types: params.vc_round_types.clone(),
            fng_regime: fng_regime.clone(),
            dominance_regime: dominance_regime.clone(),
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
        vc_mode: params.vc_mode,
        vc_investors: params.vc_investors,
        vc_min_amount_m: params.vc_min_amount_m,
        vc_round_types: params.vc_round_types,
        fng_regime,
        dominance_regime,
    };

    let pool = state.pool.clone();
    let sim_cache = state.sim_cache.read().await.clone();
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
    #[serde(default)]
    vc_mode: Option<String>,
    #[serde(default)]
    vc_investors: Option<String>,
    #[serde(default)]
    vc_min_amount_m: Option<f64>,
    #[serde(default)]
    vc_round_types: Option<String>,
    // FNG regime params
    #[serde(default)]
    fng_mode: Option<String>,
    #[serde(default)]
    fng_fear_threshold: Option<i32>,
    #[serde(default)]
    fng_greed_threshold: Option<i32>,
    #[serde(default)]
    fng_cash_pct: Option<f64>,
    // Dominance regime params
    #[serde(default)]
    dom_mode: Option<String>,
    #[serde(default)]
    dom_lookback: Option<i32>,
}

fn default_sweep_weighting() -> String { "equal".into() }
fn default_sweep_rebalance() -> i32 { 30 }
fn default_sweep_top_n() -> i32 { 10 }

async fn sim_sweep_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SimSweepQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, (StatusCode, Json<ErrorResponse>)> {
    // Build regime/filter structs from query params
    let fng_regime = build_fng_regime(&params.fng_mode, params.fng_fear_threshold, params.fng_greed_threshold, params.fng_cash_pct);
    let dominance_regime = build_dominance_regime(&params.dom_mode, params.dom_lookback);

    // Build overlay fields once — propagated into every sweep variant
    let vc_mode = params.vc_mode.clone();
    let vc_investors = params.vc_investors.clone();
    let vc_min_amount_m = params.vc_min_amount_m;
    let vc_round_types = params.vc_round_types.clone();

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
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
                }
            }).collect()
        }
        "weighting" => {
            // One representative variant per strategy family (default param)
            let mut all_weightings = vec![
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
            // Include DeFi strategies for dl- categories (or always include them)
            if params.category_id.starts_with("dl-") {
                all_weightings.extend(vec![
                    simulation::Weighting::TvlWeight,
                    simulation::Weighting::TvlCapped { cap_pct: 10.0 },
                    simulation::Weighting::TvlSqrt,
                    simulation::Weighting::FeesWeight,
                    simulation::Weighting::RevenueWeight,
                    simulation::Weighting::VolumeWeight,
                    simulation::Weighting::TvlMomentum { lookback_days: 90 },
                    simulation::Weighting::FeeEfficiency,
                    simulation::Weighting::YieldWeight,
                ]);
            }
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
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
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
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
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
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
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
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
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
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
                }
            }).collect()
        }
        "fng_regime" => {
            let weighting = simulation::Weighting::from_str(&params.weighting)
                .unwrap_or(simulation::Weighting::Equal);
            // Sweep through FNG modes: off, contrarian, risk_toggle, cash_shift
            let fear = params.fng_fear_threshold.unwrap_or(25);
            let greed = params.fng_greed_threshold.unwrap_or(75);
            let cash = params.fng_cash_pct.unwrap_or(0.4);
            let fng_modes: Vec<(&str, Option<simulation::FngRegime>)> = vec![
                ("off", None),
                ("contrarian", Some(simulation::FngRegime {
                    mode: "contrarian".into(), fear_threshold: fear, greed_threshold: greed, cash_pct_greed: cash,
                })),
                ("risk_toggle", Some(simulation::FngRegime {
                    mode: "risk_toggle".into(), fear_threshold: fear, greed_threshold: greed, cash_pct_greed: cash,
                })),
                ("cash_shift", Some(simulation::FngRegime {
                    mode: "cash_shift".into(), fear_threshold: fear, greed_threshold: greed, cash_pct_greed: cash,
                })),
                ("graduated_cash", Some(simulation::FngRegime {
                    mode: "graduated_cash".into(), fear_threshold: fear, greed_threshold: greed, cash_pct_greed: cash,
                })),
                ("quality_rotation", Some(simulation::FngRegime {
                    mode: "quality_rotation".into(), fear_threshold: fear, greed_threshold: greed, cash_pct_greed: cash,
                })),
                ("trend_follow", Some(simulation::FngRegime {
                    mode: "trend_follow".into(), fear_threshold: fear, greed_threshold: greed, cash_pct_greed: cash,
                })),
            ];
            fng_modes.into_iter().map(|(_label, regime)| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: weighting.clone(),
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: params.threshold_pct,
                    start_date: params.start_date,
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: regime,
                    dominance_regime: dominance_regime.clone(),
                }
            }).collect()
        }
        "dom_regime" => {
            let weighting = simulation::Weighting::from_str(&params.weighting)
                .unwrap_or(simulation::Weighting::Equal);
            // Sweep through DOM modes: off, alts_when_low, alts_when_falling, btc_when_high
            let lookback = params.dom_lookback.unwrap_or(30);
            let dom_modes: Vec<(&str, Option<simulation::DominanceRegime>)> = vec![
                ("off", None),
                ("alts_when_low", Some(simulation::DominanceRegime {
                    mode: "alts_when_low".into(), lookback_days: lookback,
                })),
                ("alts_when_falling", Some(simulation::DominanceRegime {
                    mode: "alts_when_falling".into(), lookback_days: lookback,
                })),
                ("btc_when_high", Some(simulation::DominanceRegime {
                    mode: "btc_when_high".into(), lookback_days: lookback,
                })),
                ("combo", Some(simulation::DominanceRegime {
                    mode: "combo".into(), lookback_days: lookback,
                })),
                ("momentum", Some(simulation::DominanceRegime {
                    mode: "momentum".into(), lookback_days: lookback,
                })),
            ];
            dom_modes.into_iter().map(|(_label, regime)| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: weighting.clone(),
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: params.threshold_pct,
                    start_date: params.start_date,
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: regime,
                }
            }).collect()
        }
        "defi_weight" => {
            // Sweep through DeFi weighting strategies
            let defi_weightings = vec![
                simulation::Weighting::TvlWeight,
                simulation::Weighting::TvlCapped { cap_pct: 10.0 },
                simulation::Weighting::TvlSqrt,
                simulation::Weighting::FeesWeight,
                simulation::Weighting::RevenueWeight,
                simulation::Weighting::VolumeWeight,
                simulation::Weighting::TvlMomentum { lookback_days: 90 },
                simulation::Weighting::FeeEfficiency,
                simulation::Weighting::YieldWeight,
            ];
            defi_weightings.into_iter().map(|w| {
                simulation::SimConfig {
                    category_id: params.category_id.clone(),
                    top_n: params.top_n,
                    weighting: w,
                    rebalance_days: params.rebalance_days,
                    base_fee_pct: params.base_fee_pct,
                    spread_multiplier: params.spread_multiplier,
                    threshold_rebalance_pct: params.threshold_pct,
                    start_date: params.start_date,
                    vc_mode: vc_mode.clone(),
                    vc_investors: vc_investors.clone(),
                    vc_min_amount_m,
                    vc_round_types: vc_round_types.clone(),
                    fng_regime: fng_regime.clone(),
                    dominance_regime: dominance_regime.clone(),
                }
            }).collect()
        }
        other => {
            return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse {
                error: format!("Invalid sweep dimension '{}', use 'top_n', 'weighting', 'rebalance', 'threshold', 'category', 'fng_regime', 'dom_regime', or 'defi_weight'", other),
            })));
        }
    };

    let total_variants = variants.len();
    let pool = state.pool.clone();
    let sim_cache = state.sim_cache.read().await.clone();
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
                "fng_regime" => match &config.fng_regime {
                    None => "off".into(),
                    Some(r) => r.mode.clone(),
                },
                "dom_regime" => match &config.dominance_regime {
                    None => "off".into(),
                    Some(r) => r.mode.clone(),
                },
                "defi_weight" => format!("weighting={}", config.weighting.as_str()),
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

    let cache = state.sim_cache.read().await;
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

// ---- /fng/latest ----

async fn fng_latest(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    // Query from sim cache (in-memory) — find latest date
    let cache = state.sim_cache.read().await;
    if let Some((&date, &value)) = cache.fng_index.iter()
        .max_by_key(|(d, _)| *d)
    {
        Ok(Json(serde_json::json!({
            "date": date.to_string(),
            "value": value,
            "classification": if value <= 25 { "Extreme Fear" }
                else if value <= 40 { "Fear" }
                else if value <= 60 { "Neutral" }
                else if value <= 75 { "Greed" }
                else { "Extreme Greed" },
        })))
    } else {
        // Fallback: query DB
        match db::fng_query_latest(&state.pool).await {
            Ok(Some((date, value, classification))) => {
                Ok(Json(serde_json::json!({
                    "date": date.to_string(),
                    "value": value,
                    "classification": classification,
                })))
            }
            Ok(None) => {
                Ok(Json(serde_json::json!({
                    "date": null,
                    "value": null,
                    "classification": "Unknown",
                })))
            }
            Err(e) => Err(db_error(e)),
        }
    }
}

// ---- /market/prices/{source} ----

#[derive(Deserialize)]
struct MarketPricesQuery {
    symbols: Option<String>,
    category: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

async fn market_prices(
    State(state): State<Arc<AppState>>,
    AxumPath(source): AxumPath<String>,
    Query(params): Query<MarketPricesQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(100);
    let category = params.category.as_deref();

    let symbols_vec: Vec<&str> = params
        .symbols
        .as_deref()
        .map(|s| s.split(',').collect())
        .unwrap_or_default();
    let symbols_filter = if symbols_vec.is_empty() {
        None
    } else {
        Some(symbols_vec.as_slice())
    };

    match crate::market_data::queries::get_market_prices(
        &state.pool,
        &source,
        symbols_filter,
        category,
        page,
        limit,
    )
    .await
    {
        Ok((prices, total)) => Ok(Json(serde_json::json!({
            "source": source,
            "prices": prices,
            "total": total,
            "page": page,
            "limit": limit,
        }))),
        Err(e) => Err(internal_error(e)),
    }
}

// ---- /market/prices/{source}/{asset_id} ----

async fn market_asset_price(
    State(state): State<Arc<AppState>>,
    AxumPath((source, asset_id)): AxumPath<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    match crate::market_data::queries::get_market_asset_price(&state.pool, &source, &asset_id).await
    {
        Ok(Some(price)) => Ok(Json(serde_json::json!(price))),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Asset {}/{} not found", source, asset_id),
            }),
        )),
        Err(e) => Err(internal_error(e)),
    }
}

// ---- /market/prices/{source}/{asset_id}/history ----

#[derive(Deserialize)]
struct MarketHistoryQuery {
    from: Option<String>,
    to: Option<String>,
}

async fn market_price_history(
    State(state): State<Arc<AppState>>,
    AxumPath((source, asset_id)): AxumPath<(String, String)>,
    Query(params): Query<MarketHistoryQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let now = Utc::now();
    let from = params
        .from
        .as_deref()
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or(now - chrono::Duration::days(7));
    let to = params
        .to
        .as_deref()
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or(now);

    match crate::market_data::queries::get_market_price_history(
        &state.pool,
        &source,
        &asset_id,
        from,
        to,
    )
    .await
    {
        Ok(history) => Ok(Json(serde_json::json!({
            "source": source,
            "asset_id": asset_id,
            "from": from,
            "to": to,
            "count": history.len(),
            "prices": history,
        }))),
        Err(e) => Err(internal_error(e)),
    }
}

// ---- /market/assets/{source} ----

#[derive(Deserialize)]
struct MarketAssetsQuery {
    category: Option<String>,
}

async fn market_assets(
    State(state): State<Arc<AppState>>,
    AxumPath(source): AxumPath<String>,
    Query(params): Query<MarketAssetsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let category = params.category.as_deref();

    match crate::market_data::queries::get_market_active_assets(&state.pool, &source, category)
        .await
    {
        Ok(assets) => Ok(Json(serde_json::json!({
            "source": source,
            "count": assets.len(),
            "assets": assets,
        }))),
        Err(e) => Err(internal_error(e)),
    }
}

// ---- /market/stats (bulk) ----

async fn market_stats_bulk(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let all = state.health_stats_cache.get_all().await;
    let mut sources = serde_json::Map::new();
    let mut total_assets: i64 = 0;
    let mut total_active: i64 = 0;
    for (source, entry) in &all {
        total_assets += entry.total_assets;
        total_active += entry.active_assets;
        sources.insert(source.clone(), serde_json::json!({
            "totalAssets": entry.total_assets,
            "activeAssets": entry.active_assets,
            "newestRecord": entry.newest_record,
        }));
    }
    Json(serde_json::json!({
        "totalAssets": total_assets,
        "totalActiveAssets": total_active,
        "sourceCount": all.len(),
        "sources": sources,
    }))
}

// ---- /market/stats/{source} ----

async fn market_stats(
    State(state): State<Arc<AppState>>,
    AxumPath(source): AxumPath<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    match crate::market_data::queries::get_market_sync_stats(&state.pool, &source).await {
        Ok(stats) => Ok(Json(serde_json::json!(stats))),
        Err(e) => Err(internal_error(e)),
    }
}

// ---- /market/batch-history ----

#[derive(Deserialize)]
struct BatchHistoryQuery {
    /// Comma-separated asset IDs (e.g. "finnhub_AAPL,finnhub_MSFT,wb_usa_ny_gdp_mktp_cd")
    assets: String,
    from: Option<String>,
    to: Option<String>,
}

async fn market_batch_history(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BatchHistoryQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let asset_ids: Vec<String> = params
        .assets
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if asset_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "No asset IDs provided. Use ?assets=id1,id2,...".to_string(),
            }),
        ));
    }

    if asset_ids.len() > 100 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Maximum 100 assets per batch request".to_string(),
            }),
        ));
    }

    let now = Utc::now();
    let from = params
        .from
        .as_deref()
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or(now - chrono::Duration::days(30));
    let to = params
        .to
        .as_deref()
        .and_then(|s| s.parse::<DateTime<Utc>>().ok())
        .unwrap_or(now);

    match crate::market_data::queries::get_batch_market_price_history(
        &state.pool,
        &asset_ids,
        from,
        to,
    )
    .await
    {
        Ok(all_prices) => {
            // Group by asset_id
            let mut grouped: std::collections::HashMap<String, Vec<&crate::market_data::models::MarketPriceRecord>> =
                std::collections::HashMap::new();
            for price in &all_prices {
                grouped.entry(price.asset_id.clone()).or_default().push(price);
            }

            Ok(Json(serde_json::json!({
                "from": from,
                "to": to,
                "assets_requested": asset_ids.len(),
                "assets_found": grouped.len(),
                "total_records": all_prices.len(),
                "data": grouped,
            })))
        }
        Err(e) => Err(internal_error(e)),
    }
}

// ---- /snapshot ----

/// Known source metadata (hardcoded from source implementations).
/// Used to build the SourceSchedule list without runtime references.
/// Source metadata: (source_id, display_name, sync_interval_secs)
/// source_id MUST match the value returned by each source's `source_id()` trait method.
const SOURCE_META: &[(&str, &str, u64)] = &[
    // ── Original sources (21, all via MarketDataSource trait) ──────────────
    ("crypto", "CoinGecko Crypto", 600),                   // coingecko: 10min cycle, 40 pages via /coins/markets
    ("defi", "DefiLlama DeFi", 120),                      // defillama: source_id="defi"
    ("stocks", "Stocks (Finnhub)", 600),                   // finnhub
    ("rates", "Federal Reserve (FRED)", 86400),            // fred
    ("bls", "Bureau of Labor Statistics", 86400),          // bls
    ("worldbank", "World Bank", 604800),                   // worldbank
    ("eia", "US Energy (EIA)", 86400),                     // eia
    ("ecb", "ECB Euro Rates", 86400),                      // ecb
    ("weather", "Weather (Open-Meteo)", 3600),             // openmeteo
    ("sec_13f", "SEC EDGAR 13F", 21600),                   // sec_edgar
    ("sec_efts", "SEC EFTS Filing Counts", 14400),         // sec_efts
    ("sec_insider", "SEC Insider Trading", 14400),         // sec_insider
    ("finra_short_vol", "FINRA Daily Short Volume", 86400),// finra_short_vol
    ("finra", "FINRA Short Interest", 86400),              // finra
    ("congress", "Congressional Trading", 86400),          // congress
    ("cftc", "CFTC Commitments", 604800),                  // nasdaq/cftc
    ("futures", "Continuous Futures", 86400),               // nasdaq/chris
    ("bchain", "Bitcoin On-Chain", 86400),                 // nasdaq/bchain
    ("opec", "OPEC", 2592000),                             // nasdaq/opec
    ("imf", "IMF Indicators", 2592000),                    // nasdaq/imf
    ("bonds", "US Treasury Yields", 86400),                // treasury
    // ── New sources (15 additional) ─────────────────────────────────────────
    ("anilist", "AniList Anime & Manga", 600),             // anilist
    ("backpacktf", "backpack.tf TF2 Items", 600),          // backpacktf
    ("cloudflare", "Cloudflare Radar", 600),               // cloudflare
    ("crates_io", "crates.io Rust Packages", 600),         // crates_io
    ("fourchan", "4chan", 600),                             // fourchan
    ("github", "GitHub Repositories", 600),                // github
    ("hackernews", "Hacker News", 300),                    // hackernews
    ("npm", "npm Package Downloads", 600),                 // npm
    ("polymarket", "Polymarket Predictions", 300),         // polymarket
    ("pypi", "PyPI Python Packages", 600),                 // pypi
    ("steam", "Steam Games", 600),                         // steam
    ("tmdb", "TMDb Movies, TV & Celebrities", 300),          // tmdb
    ("lastfm", "Last.fm Music Artists", 600),              // lastfm
    ("twitch", "Twitch Live Streaming", 60),               // twitch
    ("twse", "Taiwan Stock Exchange", 600),                // twse
    ("zillow", "Zillow Real Estate", 86400),               // zillow
    // ── Bet on Everything sources (10) ────────────────────────────────────
    ("volcano", "USGS Volcanoes", 600),
    ("earthquake", "USGS Earthquakes", 300),
    ("spaceweather", "NOAA Space Weather", 600),
    ("wildfire", "NASA FIRMS Wildfires", 1800),
    ("flights", "OpenSky Flights", 600),
    ("mil_aircraft", "Military Aircraft", 600),
    ("maritime", "AIS Maritime", 600),
    ("epidemic", "disease.sh Epidemics", 1800),
    ("sports", "ESPN Live Scores", 600),
    ("iss", "ISS Position", 600),
    ("weather_alerts", "NWS Severe Weather", 300),
    ("animals", "Wildlife Observations", 600),
    ("movebank", "Movebank Animal GPS", 1800),
    ("ebird", "eBird Observations", 600),
    ("aisstream", "AIS Ship Tracking", 60),
    ("gtfs_transit", "GTFS Transit", 120),
    ("usa_spending", "US Defense Spending", 3600),
    ("pumpfun", "Pump.fun Tokens", 300),
    ("usgs_water", "USGS Water Monitoring", 600),
    // ── Social / Live sources ─────────────────────────────────────────────
    ("reddit", "Reddit Communities", 600),
    ("chaturbate", "Chaturbate Live Cams", 600),
    // ── Esports ─────────────────────────────────────────────────────────
    ("esports", "PandaScore Esports", 300),
    // ── Environment & Transport ───────────────────────────────────────
    ("noaa_tides", "NOAA Tides & Currents", 900),
    ("nrc_nuclear", "NRC Nuclear Reactors", 3600),
    ("citybikes", "CityBikes Bike Sharing", 600),
    ("ndbc", "NDBC Ocean Buoys", 600),
    ("noaa_met", "NOAA Ocean Meteorology", 600),
    ("nwps", "NWPS River Gauges", 600),
    ("airnow", "AirNow Air Quality", 600),
    // ── Government / Legal ──────────────────────────────────────────────
    ("courtlistener", "CourtListener Federal Courts", 600),
    // ── Education / Research ──────────────────────────────────────────────
    ("openalex", "OpenAlex Scholarly Works", 600),
    ("crossref", "Crossref DOI Registry", 600),
    ("pubmed", "PubMed Biomedical Research", 600),
    ("stackexchange", "Stack Exchange Developer Q&A", 600),
    // ── Animals ──────────────────────────────────────────────────────────
    ("shelter", "Animal Shelters", 600),
    // ── Autos & Vehicles ──────────────────────────────────────────────
    ("parking", "ParkAPI Parking Garages", 600),
    ("tomtom_traffic", "TomTom Traffic Flow", 600),
    ("tomtom_evcharge", "TomTom EV Charging", 600),
    // ── Board Games & Shopping ──────────────────────────────────────────
    ("bgg", "BoardGameGeek Hotness", 600),
    ("bestbuy", "Best Buy Products", 600),
    // ── Jobs / Labor ──────────────────────────────────────────────────────
    ("adzuna", "Adzuna Job Market", 1800),
    // ── Tourism ──────────────────────────────────────────────────────────
    ("queue_times", "Queue-Times Theme Parks", 600),
    ("cbp_border", "CBP Border Wait Times", 600),
    ("faa_delays", "FAA Airport Delays", 600),
    // ── Drink Sources ───────────────────────────────────────────────────────
    ("yahoo_drinks", "Yahoo Drink Markets", 600),
    // ── European Transport ────────────────────────────────────────────────
    ("db_trains", "Deutsche Bahn Train Delays", 300),
    ("paris_metro", "Paris Métro Delays", 300),
    ("tfl_tube", "TfL Tube Delays", 300),
    ("ryanair", "Ryanair Flight Delays", 300),
    ("mta_subway", "MTA Subway Delays", 300),
    // ── Internet / Infrastructure ──────────────────────────────────────
    ("ioda", "IODA Internet Outages", 600),
    ("power_outages", "US Power Outages", 600),
    // ── Government / City ──────────────────────────────────────────────
    ("nyc311", "NYC 311 Complaints", 600),
    // ── Food / Entertainment ────────────────────────────────────────────
    ("mcbroken", "McBroken Ice Cream", 600),
];

/// Per-source explanation of why assets may be stale.
/// Shown in health UI to distinguish naturally dormant sources from broken ones.
fn stale_reason_for(source_id: &str) -> &'static str {
    match source_id {
        // ── Live / streaming sources ──
        "twitch" => "Streamers offline — not currently broadcasting",
        "chaturbate" => "Performers offline — not currently broadcasting",
        "aisstream" => "Ships in port or out of AIS range",
        // ── Social / popularity ──
        "reddit" => "Subscriber counts change slowly between syncs",
        "hackernews" => "Story scores stabilize after leaving front page",
        "fourchan" => "Threads archived or fallen off catalog",
        "stackexchange" => "Question activity stabilizes within days",
        // ── Entertainment / media ──
        "tmdb" => "Movies/shows with stable popularity (no recent buzz)",
        "anilist" => "Anime/manga between seasons or completed",
        "lastfm" => "Artist listener counts change slowly",
        "steam" => "Games with stable concurrent player counts",
        "esports" => "No active matches or off-season tournaments",
        "sports" => "Off-season or no scheduled games",
        "bgg" => "Games rotate off BGG Hotness list daily",
        // ── Markets / finance ──
        "crypto" => "Low-cap tokens with no recent trades",
        "defi" => "DeFi protocols with stable TVL",
        "polymarket" => "Markets resolved or with no recent trading",
        "pumpfun" => "Pump.fun tokens with no recent trades",
        "stocks" => "Market closed (weekends, holidays, after-hours)",
        "twse" => "Taiwan market closed (outside 09:00–13:30 UTC+8)",
        "finra_short_vol" => "Short volume only available on trading days",
        "finra" => "Short interest published bi-monthly",
        "sec_13f" => "Quarterly filings — updates every ~3 months",
        "sec_efts" => "EDGAR filings update during business hours",
        "sec_insider" => "Insider trades filed irregularly",
        "congress" => "Congressional trades disclosed with delay",
        "bonds" => "Treasury yields only update on business days",
        "yahoo_drinks" => "Drink commodity prices stable on weekends",
        "bestbuy" => "Product prices don't change frequently",
        // ── Macro / government data ──
        "rates" => "FRED data series updated monthly/quarterly",
        "bls" => "BLS statistics published monthly",
        "eia" => "Energy data published weekly/monthly",
        "ecb" => "ECB exchange rates published on business days",
        "worldbank" => "World Bank indicators updated annually",
        "cftc" => "CFTC data published weekly (Nasdaq WAF blocked)",
        "futures" => "Futures settlements daily (Nasdaq WAF blocked)",
        "opec" => "OPEC basket price published monthly (Nasdaq WAF blocked)",
        "imf" => "IMF data published quarterly (Nasdaq WAF blocked)",
        "bchain" => "Bitcoin on-chain metrics update daily",
        "usa_spending" => "Defense spending data updated quarterly",
        // ── Packages / code ──
        "npm" => "Download counts change slowly between syncs",
        "pypi" => "Download counts change slowly between syncs",
        "crates_io" => "Download counts change slowly between syncs",
        "github" => "Repository stars/forks change slowly",
        "openalex" => "Scholarly citation counts change slowly",
        "crossref" => "DOI citation counts change slowly",
        "pubmed" => "Biomedical article metrics change slowly",
        // ── Weather / environment ──
        "weather" => "Weather stations with no recent observation",
        "noaa_met" => "Ocean stations offline or not reporting",
        "noaa_tides" => "Tide stations with gaps in telemetry",
        "ndbc" => "Ocean buoys offline or out of season",
        "nwps" => "River gauges with stable water levels",
        "airnow" => "AQI reporting areas with no recent update",
        "weather_alerts" => "Alert regions with no active severe weather",
        "spaceweather" => "Solar activity indices stable or no storms",
        "nrc_nuclear" => "Nuclear reactors in steady-state operation",
        "usgs_water" => "Water monitoring stations with stable levels",
        // ── Nature / wildlife ──
        "volcano" => "Volcanoes with no current activity (alert=normal)",
        "earthquake" => "Seismic zones with no recent significant quakes",
        "wildfire" => "Fire perimeters fully contained or extinguished",
        "epidemic" => "Diseases with stable or declining case counts",
        "ebird" => "Bird observation regions with seasonal lulls",
        "animals" => "Wildlife observations depend on migration patterns",
        "movebank" => "Animal GPS trackers with intermittent transmission",
        "shelter" => "Shelter populations change slowly",
        // ── Transport / infrastructure ──
        "flights" => "Aircraft on ground or not broadcasting ADS-B",
        "mil_aircraft" => "Aircraft landed or transponder off",
        "maritime" => "Ships in port or out of AIS range",
        "citybikes" => "Bike stations with stable availability",
        "parking" => "Parking occupancy stable during off-peak",
        "gtfs_transit" => "Transit agencies with no schedule changes",
        "tomtom_traffic" => "Traffic flow stable during off-peak hours",
        "tomtom_evcharge" => "EV charger availability changes slowly",
        "faa_delays" => "Airports with no current delays",
        "cbp_border" => "Border crossings with stable wait times",
        "queue_times" => "Theme parks closed or rides not operating",
        // ── Legal / government ──
        "courtlistener" => "Courts not in session or no new filings (needs auth)",
        "iss" => "ISS position updates are continuous",
        "cloudflare" => "Cloudflare domain stats change slowly",
        "adzuna" => "Job market stats update daily",
        "backpacktf" => "TF2 item prices change slowly",
        "zillow" => "Real estate data updates monthly",
        _ => "Assets not updated within expected interval",
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceSchedule {
    source_id: String,
    display_name: String,
    enabled: bool,
    sync_interval_secs: u64,
    last_sync: Option<DateTime<Utc>>,
    next_sync: Option<DateTime<Utc>>,
    estimated_next_update: Option<DateTime<Utc>>,
    status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotMetaResponse {
    generated_at: DateTime<Utc>,
    total_assets: i64,
    sources: Vec<SourceSchedule>,
    asset_counts: HashMap<String, i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotFullResponse {
    generated_at: DateTime<Utc>,
    max_age_secs: u64,
    total_assets: i64,
    sources: Vec<SourceSchedule>,
    prices: Vec<MarketPriceSummary>,
}

use crate::market_data::models::MarketPriceSummary;

/// Build source schedule list from DB stats + hardcoded metadata (36 entries: 21 original + 15 new)
async fn build_source_schedules(pool: &PgPool) -> Result<Vec<SourceSchedule>, anyhow::Error> {
    // Get per-source stats from market_prices.
    // NOTE: CoinGecko (source_id="crypto") and DeFiLlama (source_id="defi") now implement
    // MarketDataSource and write to market_prices, so the old UNION with coingecko_market_caps
    // and defillama_protocols is no longer needed. If the new pipeline is running, their stats
    // will appear in the market_prices GROUP BY. The old UNION ALL fallback is kept below
    // in case the legacy collectors are still active and no market_prices rows exist yet.
    // TODO: Remove the UNION ALL fallback once the old cg_collector/dl_collector pipelines
    // are fully decommissioned and all crypto/defi data flows through MarketDataSource.
    let rows: Vec<(String, i64, Option<DateTime<Utc>>)> = sqlx::query_as(
        r#"
        SELECT source, COUNT(DISTINCT asset_id) as cnt, MAX(fetched_at) as last_sync
        FROM market_prices
        GROUP BY source
        UNION ALL
        SELECT 'crypto'::text, COUNT(DISTINCT coin_id), MAX(fetched_at)
        FROM coingecko_market_caps
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM coingecko_market_caps)
          AND NOT EXISTS (SELECT 1 FROM market_prices WHERE source = 'crypto' LIMIT 1)
        UNION ALL
        SELECT 'defi'::text, COUNT(*), MAX(updated_at)
        FROM defillama_protocols
        WHERE tvl IS NOT NULL AND tvl > 0
          AND NOT EXISTS (SELECT 1 FROM market_prices WHERE source = 'defi' LIMIT 1)
        "#,
    )
    .fetch_all(pool)
    .await?;

    let db_stats: HashMap<String, (i64, Option<DateTime<Utc>>)> = rows
        .into_iter()
        .map(|(src, cnt, last)| (src, (cnt, last)))
        .collect();

    let now = Utc::now();
    let mut schedules = Vec::new();

    // Add known sources
    for (id, name, interval) in SOURCE_META {
        let (count, last_sync) = db_stats
            .get(*id)
            .cloned()
            .unwrap_or((0, None));

        let status = if count == 0 {
            "pending"
        } else if let Some(last) = last_sync {
            let age = (now - last).num_seconds() as u64;
            if age < *interval * 3 {
                "healthy"
            } else {
                "stale"
            }
        } else {
            "pending"
        };

        let estimated_next = last_sync.map(|ls| ls + chrono::Duration::seconds(*interval as i64));

        schedules.push(SourceSchedule {
            source_id: id.to_string(),
            display_name: name.to_string(),
            enabled: true,
            sync_interval_secs: *interval,
            last_sync,
            next_sync: estimated_next,
            estimated_next_update: estimated_next,
            status: status.to_string(),
        });
    }

    // Add any DB sources not in the hardcoded list
    for (src, (count, last_sync)) in &db_stats {
        if !SOURCE_META.iter().any(|(id, _, _)| id == src) {
            let status = if *count == 0 {
                "pending"
            } else if let Some(last) = last_sync {
                let age = (now - *last).num_seconds() as u64;
                if age < 86400 * 3 { "healthy" } else { "stale" }
            } else {
                "pending"
            };

            schedules.push(SourceSchedule {
                source_id: src.clone(),
                display_name: src.replace('_', " "),
                enabled: *count > 0,
                sync_interval_secs: 86400,
                last_sync: *last_sync,
                next_sync: None,
                estimated_next_update: None,
                status: status.to_string(),
            });
        }
    }

    Ok(schedules)
}

/// GET /snapshot/meta — lightweight: source schedules + per-source counts (~1KB)
async fn snapshot_meta(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SnapshotMetaResponse>, (StatusCode, Json<ErrorResponse>)> {
    let schedules = build_source_schedules(&state.pool)
        .await
        .map_err(internal_error)?;

    // Per-source active asset counts from market_assets.
    // TODO: Remove the UNION ALL fallback for crypto/defi once old collectors are decommissioned.
    let count_rows: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT source, COUNT(*) FROM market_assets WHERE is_active = true GROUP BY source
        UNION ALL
        SELECT 'crypto'::text, COUNT(DISTINCT coin_id)
        FROM coingecko_market_caps
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM coingecko_market_caps)
          AND NOT EXISTS (SELECT 1 FROM market_assets WHERE source = 'crypto' AND is_active = true LIMIT 1)
        UNION ALL
        SELECT 'defi'::text, COUNT(*)
        FROM defillama_protocols
        WHERE tvl IS NOT NULL AND tvl > 0
          AND NOT EXISTS (SELECT 1 FROM market_assets WHERE source = 'defi' AND is_active = true LIMIT 1)
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let asset_counts: HashMap<String, i64> = count_rows.into_iter().collect();
    let total_assets: i64 = asset_counts.values().sum();

    Ok(Json(SnapshotMetaResponse {
        generated_at: Utc::now(),
        total_assets,
        sources: schedules,
        asset_counts,
    }))
}

/// GET /snapshot — full snapshot with all latest prices across all sources
async fn snapshot(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SnapshotFullResponse>, (StatusCode, Json<ErrorResponse>)> {
    let schedules = build_source_schedules(&state.pool)
        .await
        .map_err(internal_error)?;

    // Fetch latest price per (source, asset_id) across ALL sources.
    // CoinGecko (crypto) and DeFiLlama (defi) now write to market_assets/market_prices
    // via MarketDataSource. The UNION ALL fallback to legacy tables is kept until the old
    // cg_collector/dl_collector pipelines are fully decommissioned.
    // TODO: Remove the UNION ALL fallback once old collectors are decommissioned.
    let rows: Vec<(
        String, String, String, String, Option<String>,
        rust_decimal::Decimal, Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>,
        Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>,
        DateTime<Utc>, Option<String>,
    )> = sqlx::query_as(
        r#"
        SELECT DISTINCT ON (source, asset_id) asset_id, source, symbol, name, category,
               value, prev_close, change_pct, volume_24h, market_cap, fetched_at, image_url
        FROM (
            -- All market data sources (including new crypto/defi via MarketDataSource)
            SELECT
                a.asset_id, a.source, a.symbol, a.name, a.category,
                p.value, p.prev_close, p.change_pct,
                p.volume_24h, p.market_cap, p.fetched_at,
                a.metadata->>'image_url' as image_url
            FROM market_assets a
            JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
            WHERE a.is_active = true

            UNION ALL

            -- Legacy CoinGecko fallback (only if no market_prices rows exist for source='crypto')
            SELECT
                c.coin_id as asset_id,
                'crypto'::text as source,
                COALESCE(c.symbol, c.coin_id) as symbol,
                COALESCE(c.name, c.coin_id) as name,
                'cryptocurrency'::text as category,
                c.price_usd::decimal(30,10) as value,
                NULL::decimal(30,10) as prev_close,
                NULL::decimal(10,4) as change_pct,
                c.total_volume_usd::decimal(30,2) as volume_24h,
                c.market_cap_usd::decimal(30,2) as market_cap,
                c.fetched_at,
                NULL::text as image_url
            FROM coingecko_market_caps c
            WHERE c.snapshot_date = (SELECT MAX(snapshot_date) FROM coingecko_market_caps)
              AND c.price_usd IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM market_prices WHERE source = 'crypto' LIMIT 1)

            UNION ALL

            -- Legacy DeFiLlama fallback (only if no market_prices rows exist for source='defi')
            SELECT
                d.slug as asset_id,
                'defi'::text as source,
                COALESCE(d.symbol, d.slug) as symbol,
                d.name,
                COALESCE(d.category, 'DeFi') as category,
                d.tvl::decimal(30,10) as value,
                NULL::decimal(30,10) as prev_close,
                d.tvl_change_1d::decimal(10,4) as change_pct,
                NULL::decimal(30,2) as volume_24h,
                d.mcap::decimal(30,2) as market_cap,
                d.updated_at as fetched_at,
                NULL::text as image_url
            FROM defillama_protocols d
            WHERE d.tvl IS NOT NULL AND d.tvl > 0
              AND NOT EXISTS (SELECT 1 FROM market_prices WHERE source = 'defi' LIMIT 1)
        ) combined
        ORDER BY source, asset_id, fetched_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let prices: Vec<MarketPriceSummary> = rows
        .into_iter()
        .map(|(asset_id, source, symbol, name, category, value, prev_close, pct, vol, mcap, fetched_at, image_url)| {
            MarketPriceSummary {
                asset_id, source, symbol, name, category,
                value, prev_close, change_pct: pct, volume_24h: vol,
                market_cap: mcap, fetched_at, image_url,
            }
        })
        .collect();

    let total_assets = prices.len() as i64;

    Ok(Json(SnapshotFullResponse {
        generated_at: Utc::now(),
        max_age_secs: 30,
        total_assets,
        sources: schedules,
        prices,
    }))
}

// ---- Batch config endpoints ----

/// GET /batches/recommended — latest recommended batch configs from BatchEngine.
async fn batches_recommended(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let configs = state.batch_engine.configs.read().await;
    Json(serde_json::json!({
        "generatedAt": Utc::now(),
        "batchCount": configs.len(),
        "totalMarkets": configs.iter().map(|c| c.markets.len()).sum::<usize>(),
        "batches": *configs,
    }))
}

/// GET /batches/config/:hash — fetch full batch config by keccak256 hash.
/// Used by issuers/resolver to get the full market list for a committed hash.
async fn batch_config_by_hash(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(hash): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Check in-memory recommended configs first
    let configs = state.batch_engine.configs.read().await;
    if let Some(c) = configs.iter().find(|c| c.config_hash == hash) {
        return Ok(Json(serde_json::json!(c)));
    }
    drop(configs);

    // Also check signed configs
    let signed = state.batch_engine.signed_configs.read().await;
    if let Some(s) = signed.iter().find(|s| s.config_hash == hash) {
        return Ok(Json(serde_json::json!({
            "sourceId": s.source_id,
            "configHash": s.config_hash,
            "tickDurationSecs": s.tick_duration_secs,
            "lockOffsetSecs": s.lock_offset_secs,
            "markets": s.markets,
        })));
    }
    drop(signed);

    // Fall back to DB
    let hash_clean = hash.trim_start_matches("0x");
    let hash_bytes = hex::decode(hash_clean).unwrap_or_default();
    let row: Option<(serde_json::Value, i32, i32, String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT markets, tick_duration_secs, lock_offset_secs, source_id, created_at \
         FROM batch_configs WHERE config_hash = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&hash_bytes)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    match row {
        Some((markets, tick_dur, lock_off, source_id, created_at)) => {
            return Ok(Json(serde_json::json!({
                "sourceId": source_id,
                "configHash": hash,
                "tickDurationSecs": tick_dur,
                "lockOffsetSecs": lock_off,
                "markets": markets,
                "createdAt": created_at,
            })));
        }
        None => {}
    }

    // Final fallback: reverse-compute the deploy-script placeholder hash for each
    // recommended config. The deploy script computes:
    //   sourceId = keccak256(sourceName)
    //   configHash = keccak256(abi.encode(sourceId, "default_config_v1"))
    // Match against both the batch engine source_id and known deploy aliases.
    let hash_clean2 = hash.trim_start_matches("0x");
    let target_bytes = hex::decode(hash_clean2).unwrap_or_default();
    if target_bytes.len() == 32 {
        // Deploy aliases: batch_engine_source_id → deploy_script_source_names
        const DEPLOY_ALIASES: &[(&str, &[&str])] = &[
            ("crypto", &["coingecko"]),
            ("defi", &["defillama"]),
            ("stocks", &["finnhub"]),
            ("rates", &["fred"]),
            ("bonds", &["treasury"]),
            ("sec_efts", &["sec"]),
            ("sec_13f", &["sec"]),
            ("sec_insider", &["sec"]),
            ("esports", &["pandascore"]),
            ("gtfs_transit", &["gtfs_rt"]),
            ("weather", &["openmeteo"]),
        ];

        let configs = state.batch_engine.configs.read().await;
        for c in configs.iter() {
            // Collect all names to try: the source_id itself + any deploy aliases
            let mut names_to_try = vec![c.source_id.as_str()];
            for &(engine_id, aliases) in DEPLOY_ALIASES {
                if engine_id == c.source_id {
                    names_to_try.extend(aliases.iter().copied());
                }
            }
            for name in names_to_try {
                let source_id_hash = ethers::core::utils::keccak256(name.as_bytes());
                let encoded = ethers::abi::encode(&[
                    ethers::abi::Token::FixedBytes(source_id_hash.to_vec()),
                    ethers::abi::Token::String("default_config_v1".to_string()),
                ]);
                let deploy_hash = ethers::core::utils::keccak256(&encoded);
                if deploy_hash[..] == target_bytes[..] {
                    tracing::info!(
                        source_id = %c.source_id,
                        deploy_name = name,
                        "Matched config via deploy-hash reverse lookup"
                    );
                    return Ok(Json(serde_json::json!(c)));
                }
            }
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// GET /batches/signed — frontend reads this to build user transactions.
/// Returns array of all sources with their latest signed config.
async fn batches_signed(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let signed = state.batch_engine.signed_configs.read().await;
    Json(serde_json::json!({
        "generatedAt": Utc::now(),
        "batches": *signed,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignedBatchPayload {
    source_id: String,
    config: serde_json::Value,
    config_hash: String,
    bls_signature: String, // hex-encoded
    signers_bitmask: u64,
    reference_nonce: u64,
    tick_duration_secs: u64,
    lock_offset_secs: u64,
}

/// POST /batches/signed — issuer pushes signed config after BLS consensus.
/// Requires Bearer token auth (with x-admin-token fallback).
async fn store_signed_batch(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<SignedBatchPayload>,
) -> StatusCode {
    // Auth check (unified: Bearer or x-admin-token)
    if let Err(e) = require_admin_auth(&headers, &state) {
        return e.0;
    }

    // DN-1: Recompute config hash to prevent tampering
    let markets_for_hash: Vec<crate::batch_engine::BatchMarket> = serde_json::from_value(
        payload.config.get("markets").cloned().unwrap_or_default(),
    ).unwrap_or_default();
    let recomputed = crate::batch_engine::compute_config_hash(
        &payload.source_id,
        payload.tick_duration_secs,
        payload.lock_offset_secs,
        &markets_for_hash,
    );
    let expected_hash = hex::decode(payload.config_hash.trim_start_matches("0x")).unwrap_or_default();
    if recomputed.as_slice() != expected_hash.as_slice() {
        tracing::warn!(
            source = %payload.source_id,
            expected = %payload.config_hash,
            "Config hash mismatch — rejecting tampered payload"
        );
        return StatusCode::BAD_REQUEST;
    }

    // Prepare data outside the lock (no shared-state dependency)
    let hash_bytes =
        hex::decode(payload.config_hash.trim_start_matches("0x")).unwrap_or_default();
    let sig_bytes =
        hex::decode(payload.bls_signature.trim_start_matches("0x")).unwrap_or_default();
    let markets: Vec<crate::batch_engine::BatchMarket> = serde_json::from_value(
        payload.config.get("markets").cloned().unwrap_or_default(),
    )
    .unwrap_or_default();
    let display_name = payload
        .config
        .get("display_name")
        .and_then(|v| v.as_str())
        .unwrap_or(&payload.source_id)
        .to_string();

    // DN-4: Atomic nonce check + DB write + memory update under a SINGLE write lock.
    // This eliminates the TOCTOU race where two concurrent requests could both pass
    // a read-lock nonce check before either updates state.
    let mut configs = state.batch_engine.signed_configs.write().await;

    // Nonce check — reject stale replays
    if let Some(existing) = configs.iter().find(|c| c.source_id == payload.source_id) {
        if payload.reference_nonce <= existing.reference_nonce {
            tracing::warn!(
                source = %payload.source_id,
                incoming = payload.reference_nonce,
                existing = existing.reference_nonce,
                "Rejecting stale nonce"
            );
            return StatusCode::CONFLICT;
        }
    }

    // Persist to DB (crash recovery) — still under write lock to keep atomicity
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO signed_batch_configs
            (source_id, config_hash, config_json, bls_signature, signers_bitmask,
             reference_nonce, tick_duration_secs, lock_offset_secs, signed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (source_id, config_hash) DO UPDATE SET
            bls_signature = EXCLUDED.bls_signature,
            signers_bitmask = EXCLUDED.signers_bitmask,
            reference_nonce = EXCLUDED.reference_nonce,
            signed_at = NOW()
        "#,
    )
    .bind(&payload.source_id)
    .bind(&hash_bytes)
    .bind(&payload.config)
    .bind(&sig_bytes)
    .bind(payload.signers_bitmask as i64)
    .bind(payload.reference_nonce as i64)
    .bind(payload.tick_duration_secs as i32)
    .bind(payload.lock_offset_secs as i32)
    .execute(&state.pool)
    .await
    {
        tracing::error!(%e, source = %payload.source_id, "Failed to persist signed config to DB");
    }

    // Update in-memory cache (still under the same write lock)
    let signed = crate::batch_engine::SignedBatchConfig {
        source_id: payload.source_id.clone(),
        display_name,
        config_hash: payload.config_hash,
        tick_duration_secs: payload.tick_duration_secs,
        lock_offset_secs: payload.lock_offset_secs,
        markets,
        bls_signature: payload.bls_signature,
        signers_bitmask: payload.signers_bitmask,
        reference_nonce: payload.reference_nonce,
        signed_at: Utc::now(),
    };

    // Replace existing entry for this source, or push new
    if let Some(existing) = configs.iter_mut().find(|c| c.source_id == signed.source_id) {
        *existing = signed;
    } else {
        configs.push(signed);
    }

    StatusCode::OK
}

/// POST /batches/replicate — followers store leader's full config.
/// Same as store_signed_batch but named differently for clarity.
/// Requires Bearer token auth (with x-admin-token fallback).
async fn replicate_signed_batch(
    state: State<Arc<AppState>>,
    headers: HeaderMap,
    payload: Json<SignedBatchPayload>,
) -> StatusCode {
    store_signed_batch(state, headers, payload).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettlementRecord {
    source_id: String,
    asset_id: String,
    config_hash: String,
    start_price: f64,
    end_price: f64,
    change_pct: f64,
}

/// POST /batches/settlement — issuers record settlement results for threshold feedback.
/// Requires Bearer token auth (with x-admin-token fallback).
async fn record_batch_settlement(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(records): Json<Vec<SettlementRecord>>,
) -> StatusCode {
    // Auth check (unified: Bearer or x-admin-token)
    if let Err(e) = require_admin_auth(&headers, &state) {
        return e.0;
    }

    for rec in &records {
        let hash_bytes =
            hex::decode(rec.config_hash.trim_start_matches("0x")).unwrap_or_default();

        // DN-3: Verify config_hash references a known batch config
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM batch_configs WHERE config_hash = $1 \
             UNION SELECT 1 FROM signed_batch_configs WHERE config_hash = $1)",
        )
        .bind(&hash_bytes)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(false);

        if !exists {
            tracing::warn!(
                source = %rec.source_id,
                config_hash = %rec.config_hash,
                "Settlement references unknown config_hash — skipping"
            );
            continue;
        }

        let _ = sqlx::query(
            r#"
            INSERT INTO batch_settlements (source_id, asset_id, config_hash, start_price, end_price, change_pct)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(&rec.source_id)
        .bind(&rec.asset_id)
        .bind(&hash_bytes)
        .bind(rust_decimal::Decimal::try_from(rec.start_price).unwrap_or_default())
        .bind(rust_decimal::Decimal::try_from(rec.end_price).unwrap_or_default())
        .bind(rust_decimal::Decimal::try_from(rec.change_pct).unwrap_or_default())
        .execute(&state.pool)
        .await;
    }

    StatusCode::OK
}

// ---- Admin auth helper ----

/// Validates the Authorization header against the configured admin token.
/// Returns 403 if no token is configured or if the provided token does not match.
fn require_admin_auth(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    let expected = state.admin_token.as_deref().ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Admin endpoints disabled (no ADMIN_TOKEN configured)".to_string(),
            }),
        )
    })?;

    let provided = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.strip_prefix("Bearer ").unwrap_or(v))
        // Fallback: check x-admin-token header
        .or_else(|| headers.get("x-admin-token").and_then(|v| v.to_str().ok()));

    match provided {
        Some(token) => {
            let expected_hash = Sha256::digest(expected.as_bytes());
            let provided_hash = Sha256::digest(token.as_bytes());
            if expected_hash.ct_eq(&provided_hash).unwrap_u8() == 1 {
                Ok(())
            } else {
                Err((
                    StatusCode::FORBIDDEN,
                    Json(ErrorResponse {
                        error: "Invalid or missing admin token".to_string(),
                    }),
                ))
            }
        }
        None => Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Invalid or missing admin token".to_string(),
            }),
        )),
    }
}

// ---- /admin/truncate/{table} ----

const TRUNCATABLE_TABLES: &[&str] = &[
    "itp_snapshots",
    "trades",
    "sim_runs",
    "sim_nav_series",
    "sim_holdings",
    "sim_trades",
    "market_assets",
    "market_prices",
    "prices",
];

async fn admin_truncate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AxumPath(table): AxumPath<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    require_admin_auth(&headers, &state)?;

    if !TRUNCATABLE_TABLES.contains(&table.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!(
                    "Table '{}' not in allowlist. Allowed: {:?}",
                    table, TRUNCATABLE_TABLES
                ),
            }),
        ));
    }

    // table name is validated against allowlist, safe to interpolate
    let sql = format!("TRUNCATE {} CASCADE", table);
    match sqlx::query(&sql).execute(&state.pool).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "ok": true,
            "truncated": table,
        }))),
        Err(e) => Err(internal_error(format!("TRUNCATE failed: {}", e))),
    }
}

// ---- /admin/reset-session ----

async fn admin_reset_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    require_admin_auth(&headers, &state)?;

    match sqlx::query("TRUNCATE itp_snapshots, trades CASCADE")
        .execute(&state.pool)
        .await
    {
        Ok(_) => Ok(Json(serde_json::json!({
            "ok": true,
            "truncated": ["itp_snapshots", "trades"],
        }))),
        Err(e) => Err(internal_error(format!("TRUNCATE failed: {}", e))),
    }
}

// ---- SSE /sse/system-status ----

/// Streams system status snapshots every 5 seconds.
/// Each event is a JSON object with issuers, orders, fill times, and vault data.
async fn sse_system_status(
    State(state): State<Arc<AppState>>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(4);

    tokio::spawn(async move {
        loop {
            let snapshot = build_system_snapshot(&state).await;
            let json = serde_json::to_string(&snapshot).unwrap_or_default();
            let event = Event::default().event("system-status").data(json);
            if tx.send(Ok(event)).await.is_err() {
                break; // client disconnected
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });

    Sse::new(ReceiverStream::new(rx))
        .keep_alive(axum::response::sse::KeepAlive::default())
}

#[derive(Serialize)]
struct SystemSnapshot {
    is_healthy: bool,
    active_issuers: u64,
    total_issuers: u64,
    total_orders: u64,
    last_cycle_number: u64,
    pending_orders: u64,
    l3_block_number: u64,
    avg_fill_time_seconds: f64,
    nodes: Vec<IssuerNodeInfo>,
    recent_orders: Vec<RecentOrderInfo>,
    vault_assets: Vec<VaultAssetInfo>,
    vault_usd_total: f64,
}

#[derive(Serialize)]
struct IssuerNodeInfo {
    id: u64,
    addr: String,
    ip: String,
    bls_pubkey_short: String,
    status: u8,
    registered_at: u64,
}

#[derive(Serialize)]
struct RecentOrderInfo {
    order_id: u64,
    user: String,
    itp_id: String,
    side: u8,
    amount: String,
    block_number: u64,
    block_timestamp: u64,
    status: String, // "pending" or "filled"
    fill_time_seconds: Option<f64>,
    fill_cycle: Option<u64>,
}

#[derive(Serialize)]
struct VaultAssetInfo {
    symbol: String,
    usd_value: f64,
}

fn decode_ip_bytes32(ip_bytes: [u8; 32]) -> String {
    let end = ip_bytes.iter().position(|&b| b == 0).unwrap_or(32);
    String::from_utf8_lossy(&ip_bytes[..end]).to_string()
}

fn truncate_hex(hex: &str, prefix_len: usize, suffix_len: usize) -> String {
    if hex.len() <= prefix_len + suffix_len + 2 {
        return hex.to_string();
    }
    format!("{}…{}", &hex[..prefix_len], &hex[hex.len() - suffix_len..])
}

/// Public wrapper: build the system snapshot and return pre-serialized JSON.
pub async fn build_system_snapshot_json(state: &AppState) -> String {
    let snap = build_system_snapshot(state).await;
    serde_json::to_string(&snap).unwrap_or_default()
}

async fn build_system_snapshot(state: &AppState) -> SystemSnapshot {
    let cache = &state.chain_cache;

    // Read all data from ChainCache (populated by background pollers — zero RPC calls)
    let active_issuers = cache.active_issuer_count.load(std::sync::atomic::Ordering::Relaxed);
    let last_cycle_number = cache.last_cycle.load(std::sync::atomic::Ordering::Relaxed);
    let next_order_id = cache.next_order_id.load(std::sync::atomic::Ordering::Relaxed);
    let total_orders = if next_order_id > 0 { next_order_id - 1 } else { 0 };
    let pending_orders = cache.pending_orders.read().await.len() as u64;

    // Single RPC call: current block number
    let l3_block_number = state.l3_provider.get_block_number().await
        .map(|v| v.as_u64()).unwrap_or(0);

    // Issuer nodes from cached registry
    let registry = cache.issuer_registry.read().await;
    let total_issuers = registry.len() as u64;
    let nodes: Vec<IssuerNodeInfo> = registry.iter().enumerate().map(|(idx, iss)| {
        IssuerNodeInfo {
            id: (idx + 1) as u64,
            addr: iss.address.clone(),
            ip: iss.endpoint.clone(),
            bls_pubkey_short: truncate_hex(&iss.bls_pubkey, 10, 4),
            status: 1, // all cached issuers are registered
            registered_at: 0,
        }
    }).collect();
    drop(registry);

    // Recent orders from cached pending/batched orders (no event scanning needed)
    let pending = cache.pending_orders.read().await;
    let batched = cache.batched_orders.read().await;
    let mut all_orders: Vec<&crate::chain_cache::CachedLimitOrder> = Vec::new();
    all_orders.extend(pending.iter());
    all_orders.extend(batched.iter());
    all_orders.sort_by(|a, b| b.order_id.cmp(&a.order_id));
    all_orders.truncate(20);

    let recent_orders: Vec<RecentOrderInfo> = all_orders.iter().map(|o| {
        RecentOrderInfo {
            order_id: o.order_id,
            user: o.user.clone(),
            itp_id: o.itp_id.clone(),
            side: o.side,
            amount: o.amount.clone(),
            block_number: 0,
            block_timestamp: o.timestamp,
            status: if o.status == 0 { "pending".into() } else { "filled".into() },
            fill_time_seconds: None,
            fill_cycle: None,
        }
    }).collect();
    drop(pending);
    drop(batched);

    let is_healthy = active_issuers > 0 && last_cycle_number > 0;

    SystemSnapshot {
        is_healthy,
        active_issuers,
        total_issuers,
        total_orders,
        last_cycle_number,
        pending_orders,
        l3_block_number,
        avg_fill_time_seconds: 0.0,
        nodes,
        recent_orders,
        vault_assets: vec![],
        vault_usd_total: 0.0,
    }
}

async fn build_vault_snapshot(state: &AppState, settlement: &Arc<Provider<Http>>) -> (Vec<VaultAssetInfo>, f64) {
    let vault_addr = match deployment_addr(&state.deployment, "MockBitgetVault") {
        Ok(a) => a,
        Err(_) => return (vec![], 0.0),
    };
    let vault = MockBitgetVaultReader::new(vault_addr, Arc::clone(settlement));

    let token_addrs: Vec<Address> = state.symbol_map.keys()
        .filter_map(|addr_str| addr_str.parse::<Address>().ok())
        .collect();

    let mut assets: Vec<VaultAssetInfo> = Vec::new();
    let mut total_usd = 0.0;

    for token_addr in &token_addrs {
        let balance = match vault.get_balance(*token_addr).call().await {
            Ok(b) if b > U256::zero() => b,
            _ => continue,
        };

        let symbol = state.symbol_map
            .get(&format!("{:?}", token_addr).to_lowercase())
            .map(|pair| pair.trim_end_matches("USDT").trim_end_matches("USDC").to_string())
            .unwrap_or_else(|| format!("{:?}", token_addr)[..10].to_string());

        let pair = state.symbol_map.get(&format!("{:?}", token_addr).to_lowercase());
        let price_f64 = if let Some(pair) = pair {
            let symbol_refs = vec![pair.as_str()];
            let tickers = state.live_cache.get_prices(&symbol_refs).await;
            if let Some(ticker) = tickers.get(pair.as_str()) {
                ticker.last_price.parse::<f64>().unwrap_or(0.0)
            } else {
                match db::query_latest_prices_batch(&state.pool, &[pair.as_str()]).await {
                    Ok(rows) => rows.first().and_then(|r| r.price.parse::<f64>().ok()).unwrap_or(0.0),
                    Err(_) => 0.0,
                }
            }
        } else {
            0.0
        };

        let balance_f64: f64 = balance.to_string().parse().unwrap_or(0.0);
        let usd_value = balance_f64 * price_f64 / 1e18;

        // Sanity cap: skip assets with unrealistic test-chain balances (>$100M)
        if usd_value > 100_000_000.0 {
            continue;
        }

        total_usd += usd_value;
        assets.push(VaultAssetInfo { symbol, usd_value });
    }

    // Sort by USD value descending, keep top 10
    assets.sort_by(|a, b| b.usd_value.partial_cmp(&a.usd_value).unwrap_or(std::cmp::Ordering::Equal));
    assets.truncate(10);

    (assets, total_usd)
}

fn empty_snapshot() -> SystemSnapshot {
    SystemSnapshot {
        is_healthy: false,
        active_issuers: 0,
        total_issuers: 0,
        total_orders: 0,
        last_cycle_number: 0,
        pending_orders: 0,
        l3_block_number: 0,
        avg_fill_time_seconds: 0.0,
        nodes: vec![],
        recent_orders: vec![],
        vault_assets: vec![],
        vault_usd_total: 0.0,
    }
}

// ---- SSE /sse/stream (multiplexed) ----

#[derive(Deserialize)]
struct StreamQuery {
    topics: String,           // comma-separated: "system,nav,balances,orders"
    address: Option<String>,  // required for user topics
}

async fn sse_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<StreamQuery>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let topics: Vec<String> = params.topics.split(',').map(|s| s.trim().to_string()).collect();
    let address = params.address.map(|a| a.to_lowercase());

    // Register user in cache if address-dependent topics requested
    let user_cache = if let Some(ref addr) = address {
        let has_user_topic = topics.iter().any(|t|
            matches!(t.as_str(), "balances" | "allowances" | "orders" | "positions" | "cost-basis")
        );
        if has_user_topic {
            Some(state.chain_cache.get_or_create_user(addr).await)
        } else {
            None
        }
    } else {
        None
    };

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(16);

    tokio::spawn(async move {
        // Track last-sent generation per topic
        let mut last_nav_gen: u64 = 0;
        let mut last_oracle_gen: u64 = 0;
        let mut last_bal_gen: u64 = 0;
        let mut last_allow_gen: u64 = 0;
        let mut last_orders_gen: u64 = 0;
        let mut last_pos_gen: u64 = 0;
        let mut last_cb_gen: u64 = 0;
        let mut last_system_gen: u64 = 0;

        loop {
            let cache = &state.chain_cache;

            // Global topics
            if topics.contains(&"nav".to_string()) {
                let gen = cache.nav_gen.get();
                if gen != last_nav_gen {
                    let data = cache.nav.read().await;
                    let json = serde_json::to_string(&*data).unwrap_or_default();
                    if tx.send(Ok(Event::default().event("itp-nav").data(json))).await.is_err() { break; }
                    last_nav_gen = gen;
                }
            }

            if topics.contains(&"oracle".to_string()) {
                let gen = cache.oracle_gen.get();
                if gen != last_oracle_gen {
                    let data = cache.oracle.read().await;
                    let json = serde_json::to_string(&*data).unwrap_or_default();
                    if tx.send(Ok(Event::default().event("oracle-prices").data(json))).await.is_err() { break; }
                    last_oracle_gen = gen;
                }
            }

            if topics.contains(&"system".to_string()) {
                let gen = cache.system_snapshot_gen.get();
                if gen != last_system_gen {
                    let json = cache.system_snapshot_json.read().await.clone();
                    if !json.is_empty() {
                        if tx.send(Ok(Event::default().event("system-status").data(json))).await.is_err() { break; }
                    }
                    last_system_gen = gen;
                }
            }

            // User topics — only if we have a user cache
            if let Some(ref uc) = user_cache {
                let u = uc.read().await;

                if topics.contains(&"balances".to_string()) {
                    let gen = u.balances_gen.get();
                    if gen != last_bal_gen {
                        let json = serde_json::to_string(&u.balances).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-balances").data(json))).await.is_err() { break; }
                        last_bal_gen = gen;
                    }
                }

                if topics.contains(&"allowances".to_string()) {
                    let gen = u.allowances_gen.get();
                    if gen != last_allow_gen {
                        let json = serde_json::to_string(&u.allowances).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-allowances").data(json))).await.is_err() { break; }
                        last_allow_gen = gen;
                    }
                }

                if topics.contains(&"orders".to_string()) {
                    let gen = u.orders_gen.get();
                    if gen != last_orders_gen {
                        let json = serde_json::to_string(&u.orders).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-orders").data(json))).await.is_err() { break; }
                        last_orders_gen = gen;
                    }
                }

                if topics.contains(&"positions".to_string()) {
                    let gen = u.positions_gen.get();
                    if gen != last_pos_gen {
                        let json = serde_json::to_string(&u.positions).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-positions").data(json))).await.is_err() { break; }
                        last_pos_gen = gen;
                    }
                }

                if topics.contains(&"cost-basis".to_string()) {
                    let gen = u.cost_basis_gen.get();
                    if gen != last_cb_gen {
                        let json = serde_json::to_string(&u.cost_basis).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-cost-basis").data(json))).await.is_err() { break; }
                        last_cb_gen = gen;
                    }
                }
            }

            // Dispatch loop: 250ms tick
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    });

    Sse::new(ReceiverStream::new(rx))
        .keep_alive(axum::response::sse::KeepAlive::default())
}

// ===========================================================================
// Source Monitoring Dashboard endpoints
// ===========================================================================

// ---- /admin/sources/health ----

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceHealthResponse {
    generated_at: DateTime<Utc>,
    sources: Vec<SourceHealthEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceHealthEntry {
    source_id: String,
    display_name: String,
    sync_interval_secs: u64,
    status: String,
    total_assets: i64,
    active_assets: i64,
    total_price_records: i64,
    oldest_record: Option<DateTime<Utc>>,
    newest_record: Option<DateTime<Utc>>,
    last_sync_age_secs: i64,
    records_last_1h: i64,
    records_last_24h: i64,
    records_last_7d: i64,
    zero_value_assets: i64,
    stale_assets: i64,
    /// Stale assets with value=0 — naturally dormant (offline streamers, resolved markets, etc.)
    stale_dormant: i64,
    /// Stale assets with value>0 — potentially concerning, may indicate broken source
    stale_active: i64,
    /// Human-readable explanation of why assets may be stale for this source
    stale_reason: String,
    avg_change_pct: f64,
    assets_with_no_change_24h: i64,
    sync_gap_max_secs: i64,
    estimated_daily_records: i64,
    // Error tracker fields
    error_category: String,
    consecutive_errors: u32,
    total_errors: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_success_at: Option<DateTime<Utc>>,
    total_syncs: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    not_started_reason: Option<String>,
}

async fn admin_force_sync(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AxumPath(source_id): AxumPath<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    require_admin_auth(&headers, &state)?;

    let registry = crate::market_data::sync_registry::global();
    if registry.trigger(&source_id) {
        Ok(Json(serde_json::json!({
            "status": "triggered",
            "source_id": source_id,
            "message": format!("Force-sync triggered for '{}'", source_id)
        })))
    } else {
        let registered = registry.registered_sources();
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!(
                    "Source '{}' not found. Registered sources: {}",
                    source_id,
                    registered.join(", ")
                ),
            }),
        ))
    }
}

async fn admin_sources_health(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<SourceHealthResponse>, (StatusCode, Json<ErrorResponse>)> {
    require_admin_auth(&headers, &state)?;
    let now = Utc::now();

    // All DB stats come from background cache (refreshed every 60s)
    let health_stats = state.health_stats_cache.get_all().await;

    // Assemble results for all known sources
    let mut sources = Vec::new();
    for (id, name, interval) in SOURCE_META {
        let hs = health_stats.get(*id);
        let total_assets = hs.map(|h| h.total_assets).unwrap_or(0);
        let active_assets = hs.map(|h| h.active_assets).unwrap_or(0);
        let newest = hs.and_then(|h| h.newest_record);

        // Record age from DB (how old is the newest price record)
        let last_sync_age_secs = newest
            .map(|n| (now - n).num_seconds().max(0))
            .unwrap_or(999999);

        // Look up error tracker state
        let err_state = crate::market_data::error_tracker::global().get_state(id);

        // ── Tracker-first status algorithm ──
        // Primary signal: is the sync engine working? (error tracker)
        // Secondary signal: is data actually flowing? (DB records)
        //
        // Status rules:
        //   not_started → source was never spawned (missing key / disabled)
        //   initializing → spawned but hasn't completed first sync yet
        //   healthy → sync engine running OK (even if data doesn't change often)
        //   stale → sync engine has recent errors but still retrying
        //   dead → persistent errors or source never produces data
        let status = match &err_state {
            // Not started — gated off
            Some(es) if matches!(es.category, crate::market_data::error_tracker::ErrorCategory::NotStarted) => {
                "not_started".to_string()
            }
            // Init failed — code-level error
            Some(es) if matches!(es.category, crate::market_data::error_tracker::ErrorCategory::InitFailed) => {
                "dead".to_string()
            }
            // Has completed at least one sync
            Some(es) if es.total_syncs > 0 => {
                if matches!(es.category, crate::market_data::error_tracker::ErrorCategory::Ok) {
                    // Sync engine is healthy. Check if source has any assets registered.
                    if active_assets == 0 {
                        "dead".to_string()
                    } else {
                        "healthy".to_string()
                    }
                } else if es.consecutive_errors >= 5 {
                    // 5+ consecutive errors → dead
                    "dead".to_string()
                } else {
                    // Some errors but still retrying → stale
                    "stale".to_string()
                }
            }
            // Spawned but no syncs completed yet — if DB has assets from previous run, show healthy
            Some(es) if es.total_syncs == 0 && !matches!(es.category, crate::market_data::error_tracker::ErrorCategory::NotStarted) => {
                if active_assets > 0 {
                    "healthy".to_string()
                } else {
                    "initializing".to_string()
                }
            }
            // No tracker state at all — just spawned
            None => {
                if active_assets > 0 {
                    "healthy".to_string()
                } else {
                    "initializing".to_string()
                }
            }
            // Fallback
            _ => "initializing".to_string(),
        };

        let estimated_daily_records: i64 = 0;

        let (err_cat, cons_err, tot_err, last_err, last_succ, tot_syncs, ns_reason) =
            if let Some(ref es) = err_state {
                (
                    es.category.to_string(),
                    es.consecutive_errors,
                    es.total_errors,
                    es.last_error.clone(),
                    es.last_success_at,
                    es.total_syncs,
                    es.not_started_reason.clone(),
                )
            } else {
                ("ok".to_string(), 0, 0, None, None, 0, None)
            };

        let hs = health_stats.get(*id);
        let zero_value = hs.map(|h| h.zero_count).unwrap_or(0);
        let stale = hs.map(|h| h.stale_count).unwrap_or(0);
        let stale_dormant = hs.map(|h| h.stale_dormant).unwrap_or(0);
        let stale_active = stale - stale_dormant;
        let avg_change = hs.map(|h| h.avg_change_pct).unwrap_or(0.0);
        let no_change = hs.map(|h| h.no_change_count).unwrap_or(0);

        sources.push(SourceHealthEntry {
            source_id: id.to_string(),
            display_name: name.to_string(),
            sync_interval_secs: *interval,
            status,
            total_assets,
            active_assets,
            total_price_records: active_assets,
            oldest_record: None,
            newest_record: newest,
            last_sync_age_secs,
            records_last_1h: 0,
            records_last_24h: 0,
            records_last_7d: 0,
            zero_value_assets: zero_value,
            stale_assets: stale,
            stale_dormant,
            stale_active,
            stale_reason: stale_reason_for(id).to_string(),
            avg_change_pct: (avg_change * 100.0).round() / 100.0,
            assets_with_no_change_24h: no_change,
            sync_gap_max_secs: 0,
            estimated_daily_records: 0,
            error_category: err_cat,
            consecutive_errors: cons_err,
            total_errors: tot_err,
            last_error: last_err,
            last_success_at: last_succ,
            total_syncs: tot_syncs,
            not_started_reason: ns_reason,
        });
    }

    // Also include any DB sources not in SOURCE_META
    let known_ids: std::collections::HashSet<&str> =
        SOURCE_META.iter().map(|(id, _, _)| *id).collect();
    for (source, hs_u) in &health_stats {
        if known_ids.contains(source.as_str()) {
            continue;
        }
        let newest = hs_u.newest_record;
        let last_sync_age_secs = newest
            .map(|n| (now - n).num_seconds().max(0))
            .unwrap_or(0);

        let default_interval: u64 = 600;
        let status = if hs_u.active_assets == 0 {
            "dead".to_string()
        } else if last_sync_age_secs < (default_interval as i64) * 3 {
            "healthy".to_string()
        } else if last_sync_age_secs < (default_interval as i64) * 10 {
            "stale".to_string()
        } else {
            "dead".to_string()
        };

        sources.push(SourceHealthEntry {
            source_id: source.clone(),
            display_name: source.clone(),
            sync_interval_secs: default_interval,
            status,
            total_assets: hs_u.total_assets,
            active_assets: hs_u.active_assets,
            total_price_records: hs_u.active_assets,
            oldest_record: None,
            newest_record: newest,
            last_sync_age_secs,
            records_last_1h: 0,
            records_last_24h: 0,
            records_last_7d: 0,
            zero_value_assets: hs_u.zero_count,
            stale_assets: hs_u.stale_count,
            stale_dormant: hs_u.stale_dormant,
            stale_active: hs_u.stale_count - hs_u.stale_dormant,
            stale_reason: stale_reason_for(source).to_string(),
            avg_change_pct: (hs_u.avg_change_pct * 100.0).round() / 100.0,
            assets_with_no_change_24h: hs_u.no_change_count,
            sync_gap_max_secs: 0,
            estimated_daily_records: 0,
            error_category: "ok".to_string(),
            consecutive_errors: 0,
            total_errors: 0,
            last_error: None,
            last_success_at: None,
            total_syncs: 0,
            not_started_reason: None,
        });
    }

    Ok(Json(SourceHealthResponse {
        generated_at: now,
        sources,
    }))
}

// ---- /admin/sources/:source_id/assets ----

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceAssetsResponse {
    source_id: String,
    assets: Vec<SourceAssetEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceAssetEntry {
    asset_id: String,
    symbol: String,
    name: String,
    is_active: bool,
    latest_value: Option<f64>,
    latest_fetched_at: Option<DateTime<Utc>>,
    age_secs: i64,
    total_records: i64,
    oldest_record: Option<DateTime<Utc>>,
    value_changed_in_24h: bool,
    change_pct: Option<f64>,
    is_zero: bool,
    is_stale: bool,
}

async fn admin_source_assets(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AxumPath(source_id): AxumPath<String>,
) -> Result<Json<SourceAssetsResponse>, (StatusCode, Json<ErrorResponse>)> {
    require_admin_auth(&headers, &state)?;
    let pool = &state.pool;
    let now = Utc::now();

    // Find the sync interval for this source (for stale detection)
    let sync_interval = SOURCE_META
        .iter()
        .find(|(id, _, _)| *id == source_id)
        .map(|(_, _, interval)| *interval)
        .unwrap_or(600);

    let rows: Vec<(
        String,                // asset_id
        String,                // symbol
        String,                // name
        bool,                  // is_active
        Option<f64>,           // latest value
        Option<DateTime<Utc>>, // latest fetched_at
        Option<f64>,           // change_pct
        Option<i64>,           // total_records
        Option<DateTime<Utc>>, // oldest_record
        Option<f64>,           // prev_value (24h ago)
    )> = sqlx::query_as(
        r#"
        SELECT
            ma.asset_id,
            ma.symbol,
            ma.name,
            ma.is_active,
            latest.value::float8,
            latest.fetched_at,
            latest.change_pct::float8,
            counts.total_records,
            counts.oldest_record,
            prev.value::float8 as prev_value
        FROM market_assets ma
        LEFT JOIN LATERAL (
            SELECT value, fetched_at, change_pct
            FROM market_prices mp
            WHERE mp.source = ma.source AND mp.asset_id = ma.asset_id
            ORDER BY fetched_at DESC LIMIT 1
        ) latest ON true
        LEFT JOIN LATERAL (
            SELECT value
            FROM market_prices mp
            WHERE mp.source = ma.source AND mp.asset_id = ma.asset_id
                AND mp.fetched_at < NOW() - INTERVAL '24 hours'
            ORDER BY fetched_at DESC LIMIT 1
        ) prev ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint as total_records, MIN(fetched_at) as oldest_record
            FROM market_prices mp
            WHERE mp.source = ma.source AND mp.asset_id = ma.asset_id
        ) counts ON true
        WHERE ma.source = $1
        ORDER BY ma.symbol
        "#,
    )
    .bind(&source_id)
    .fetch_all(pool)
    .await
    .map_err(|e| internal_error(format!("source assets query: {}", e)))?;

    let stale_threshold_secs = (sync_interval as i64) * 3;

    let assets: Vec<SourceAssetEntry> = rows
        .into_iter()
        .map(|(asset_id, symbol, name, is_active, latest_value, latest_fetched_at, change_pct, total_records, oldest_record, prev_value)| {
            let age_secs = latest_fetched_at
                .map(|t| (now - t).num_seconds().max(0))
                .unwrap_or(0);

            let is_zero = latest_value.map(|v| v == 0.0).unwrap_or(false);
            let is_stale = age_secs > stale_threshold_secs;

            // value_changed_in_24h: compare latest vs prev (24h ago)
            let value_changed_in_24h = match (latest_value, prev_value) {
                (Some(curr), Some(prev)) => (curr - prev).abs() > 1e-12,
                _ => true, // if no prev, assume changed (can't prove otherwise)
            };

            // Compute change_pct from latest and prev values (DB column is often NULL)
            let computed_change_pct = match (latest_value, prev_value) {
                (Some(curr), Some(prev)) if prev.abs() > 1e-12 => {
                    Some(((curr - prev) / prev) * 100.0)
                }
                _ => change_pct, // fall back to source-provided value
            };

            SourceAssetEntry {
                asset_id,
                symbol,
                name,
                is_active,
                latest_value,
                latest_fetched_at,
                age_secs,
                total_records: total_records.unwrap_or(0),
                oldest_record,
                value_changed_in_24h,
                change_pct: computed_change_pct,
                is_zero,
                is_stale,
            }
        })
        .collect();

    Ok(Json(SourceAssetsResponse {
        source_id,
        assets,
    }))
}

// ---- /admin/sources/:source_id/history ----

#[derive(Deserialize)]
struct SourceHistoryQuery {
    hours: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceHistoryResponse {
    source_id: String,
    hours: i64,
    buckets: Vec<SourceHistoryBucket>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceHistoryBucket {
    hour: DateTime<Utc>,
    record_count: i64,
    unique_assets: i64,
    avg_value: f64,
    zero_count: i64,
}

async fn admin_source_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AxumPath(source_id): AxumPath<String>,
    Query(params): Query<SourceHistoryQuery>,
) -> Result<Json<SourceHistoryResponse>, (StatusCode, Json<ErrorResponse>)> {
    require_admin_auth(&headers, &state)?;
    let pool = &state.pool;
    let hours = params.hours.unwrap_or(24).max(1).min(168); // clamp to 1..168h (1 week max)

    let rows: Vec<(DateTime<Utc>, i64, i64, Option<f64>, i64)> = sqlx::query_as(
        r#"
        SELECT
            date_trunc('hour', fetched_at) as hour,
            COUNT(*)::bigint as record_count,
            COUNT(DISTINCT asset_id)::bigint as unique_assets,
            AVG(value)::float8 as avg_value,
            (COUNT(*) FILTER (WHERE value = 0))::bigint as zero_count
        FROM market_prices
        WHERE source = $1
          AND fetched_at > NOW() - make_interval(hours => $2)
        GROUP BY date_trunc('hour', fetched_at)
        ORDER BY hour
        "#,
    )
    .bind(&source_id)
    .bind(hours as i32)
    .fetch_all(pool)
    .await
    .map_err(|e| internal_error(format!("source history query: {}", e)))?;

    let buckets: Vec<SourceHistoryBucket> = rows
        .into_iter()
        .map(|(hour, record_count, unique_assets, avg_value, zero_count)| {
            SourceHistoryBucket {
                hour,
                record_count,
                unique_assets,
                avg_value: avg_value.unwrap_or(0.0),
                zero_count,
            }
        })
        .collect();

    Ok(Json(SourceHistoryResponse {
        source_id,
        hours,
        buckets,
    }))
}

// ===========================================================================
// Chain Events SSE + Chain State HTTP endpoints
// ===========================================================================

#[derive(Deserialize)]
struct ChainEventsQuery {
    topics: Option<String>, // comma-separated: "l3-orders,settlement-orders,..." — if empty, all events
}

async fn sse_chain_events(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ChainEventsQuery>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let topics: Option<Vec<String>> = params
        .topics
        .map(|t| t.split(',').map(|s| s.trim().to_string()).collect());

    let mut rx = state.chain_event_tx.subscribe();
    let (tx, mpsc_rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(64);

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(envelope) => {
                    // Filter by topic if topics specified
                    if let Some(ref topic_list) = topics {
                        if !topic_list.contains(&envelope.event_type) {
                            continue;
                        }
                    }
                    let json = serde_json::to_string(&envelope).unwrap_or_default();
                    if tx
                        .send(Ok(Event::default()
                            .event(&envelope.event_type)
                            .data(json)))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!(lagged = n, "SSE chain-events consumer lagged");
                    continue;
                }
                Err(_) => break,
            }
        }
    });

    Sse::new(ReceiverStream::new(mpsc_rx)).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    )
}

// ---- Chain state HTTP handlers (read from chain_cache) ----

async fn chain_l3_pending_orders(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::chain_cache::CachedLimitOrder>> {
    let data = state.chain_cache.pending_orders.read().await;
    Json(data.clone())
}

async fn chain_l3_batched_orders(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::chain_cache::CachedLimitOrder>> {
    let data = state.chain_cache.batched_orders.read().await;
    Json(data.clone())
}

async fn chain_l3_issuer_registry(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::chain_cache::CachedIssuer>> {
    let data = state.chain_cache.issuer_registry.read().await;
    Json(data.clone())
}

async fn chain_l3_last_cycle(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let cycle = state
        .chain_cache
        .last_cycle
        .load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "cycle": cycle }))
}

async fn chain_l3_next_order_id(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let id = state
        .chain_cache
        .next_order_id
        .load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "next_order_id": id }))
}

async fn chain_l3_pending_rebalances(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::chain_cache::CachedPendingRebalance>> {
    let data = state.chain_cache.pending_rebalances.read().await;
    Json(data.clone())
}

async fn chain_l3_active_issuer_count(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let count = state
        .chain_cache
        .active_issuer_count
        .load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "active_issuer_count": count }))
}

async fn chain_l3_aggregated_pubkey(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let pubkey = state.chain_cache.aggregated_pubkey.read().await;
    Json(serde_json::json!({ "pubkey": format!("0x{}", hex::encode(&*pubkey)) }))
}

async fn chain_l3_consensus_paused(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let paused = state
        .chain_cache
        .consensus_paused
        .load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "paused": paused }))
}

// lastSnapshotNonce on IssuerRegistry
abigen!(
    RegistryNonceReader,
    r#"[
        function lastSnapshotNonce() external view returns (uint256)
    ]"#
);

async fn chain_l3_registry_nonce(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let registry_addr_str = state.deployment["contracts"]["IssuerRegistry"]
        .as_str()
        .ok_or_else(|| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "IssuerRegistry address not in deployment".into() }))
        })?;
    let registry_addr: Address = registry_addr_str.parse().map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "invalid IssuerRegistry address".into() }))
    })?;

    let contract = RegistryNonceReader::new(registry_addr, state.l3_provider.clone());
    let nonce = contract.last_snapshot_nonce().call().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: format!("lastSnapshotNonce failed: {e}") }))
    })?;

    Ok(Json(serde_json::json!({ "nonce": nonce.as_u64() })))
}

// getITPState ABI — generated manually for data-node (no abigen! here)
abigen!(
    ItpStateReader,
    r#"[
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
    ]"#
);

async fn chain_l3_itp_state(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let itp_hex = params.get("itp_id").ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "missing itp_id".into() }))
    })?;

    // Parse itp_id hex string into [u8; 32]
    let stripped = itp_hex.strip_prefix("0x").unwrap_or(itp_hex);
    let bytes = hex::decode(stripped).map_err(|_| {
        (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "invalid itp_id hex".into() }))
    })?;
    if bytes.len() != 32 {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "itp_id must be 32 bytes".into() })));
    }
    let mut itp_id = [0u8; 32];
    itp_id.copy_from_slice(&bytes);

    // Get Index contract address from deployment
    let index_addr_str = state.deployment["contracts"]["Index"]
        .as_str()
        .ok_or_else(|| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Index address not in deployment".into() }))
        })?;
    let index_addr: Address = index_addr_str.parse().map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "invalid Index address".into() }))
    })?;

    let contract = ItpStateReader::new(index_addr, state.l3_provider.clone());
    let (_creator, _total_supply, nav, assets, _weights, inventory) =
        contract.get_itp_state(itp_id).call().await.map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: format!("getITPState failed: {e}") }))
        })?;

    Ok(Json(serde_json::json!({
        "assets": assets.iter().map(|a| format!("{:?}", a)).collect::<Vec<_>>(),
        "quantities": inventory.iter().map(|q| q.to_string()).collect::<Vec<_>>(),
        "nav": nav.to_string(),
    })))
}

async fn chain_settlement_confirmed_block(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let block = state
        .chain_cache
        .settlement_confirmed_block
        .load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "confirmed_block": block }))
}

async fn chain_settlement_pending_creations(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<serde_json::Value>> {
    let data = state.chain_cache.pending_creations.read().await;
    Json(data.clone())
}

async fn chain_settlement_is_pending(
    State(state): State<Arc<AppState>>,
    AxumPath(nonce): AxumPath<u64>,
) -> Json<serde_json::Value> {
    let creations = state.chain_cache.pending_creations.read().await;
    let pending = creations.iter().any(|c| {
        c.get("nonce")
            .and_then(|n| n.as_str())
            .and_then(|s| {
                if let Some(hex) = s.strip_prefix("0x") {
                    u64::from_str_radix(hex, 16).ok()
                } else {
                    s.parse::<u64>().ok()
                }
            })
            == Some(nonce)
    });
    Json(serde_json::json!({ "pending": pending }))
}

async fn chain_settlement_next_nonce(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let nonce = state
        .chain_cache
        .settlement_next_nonce
        .load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "next_nonce": nonce }))
}

async fn chain_settlement_cross_chain_orders(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<Vec<serde_json::Value>> {
    let data = state.chain_cache.cross_chain_buy_orders.read().await;
    let from_block = params.get("from").and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    let to_block = params.get("to").and_then(|s| s.parse::<u64>().ok()).unwrap_or(u64::MAX);
    let filtered: Vec<_> = data.iter()
        .filter(|v| {
            let bn = v.get("block_number").and_then(|n| n.as_u64()).unwrap_or(0);
            bn >= from_block && bn <= to_block
        })
        .cloned()
        .collect();
    Json(filtered)
}

async fn chain_settlement_cross_chain_sell_orders(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<Vec<serde_json::Value>> {
    let data = state.chain_cache.cross_chain_sell_orders.read().await;
    let from_block = params.get("from").and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    let to_block = params.get("to").and_then(|s| s.parse::<u64>().ok()).unwrap_or(u64::MAX);
    let filtered: Vec<_> = data.iter()
        .filter(|v| {
            let bn = v.get("block_number").and_then(|n| n.as_u64()).unwrap_or(0);
            bn >= from_block && bn <= to_block
        })
        .cloned()
        .collect();
    Json(filtered)
}
