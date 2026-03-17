//! Vision price data endpoints
//!
//! Serves raw market/price data for Vision strategy scripts.
//! Batch state, history, and backtest endpoints live on the oracle.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json, Response};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::api::AppState;

// ---- Profile proxy cache ----

/// Caches oracle player profile responses (30s TTL, up to 5k entries).
pub struct ProfileCache {
    oracle_url: String,
    client: reqwest::Client,
    cache: mini_moka::sync::Cache<String, String>,
}

impl ProfileCache {
    pub fn new(oracle_url: String) -> Self {
        Self {
            oracle_url,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            cache: mini_moka::sync::Cache::builder()
                .max_capacity(5_000)
                .time_to_live(std::time::Duration::from_secs(30))
                .build(),
        }
    }

    pub async fn get_or_fetch(&self, addr: &str) -> Result<String, StatusCode> {
        if let Some(cached) = self.cache.get(&addr.to_string()) {
            return Ok(cached);
        }
        let url = format!("{}/vision/player/{}/profile", self.oracle_url, addr);
        match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.text().await {
                    self.cache.insert(addr.to_string(), body.clone());
                    return Ok(body);
                }
                Err(StatusCode::BAD_GATEWAY)
            }
            _ => Err(StatusCode::BAD_GATEWAY),
        }
    }
}

// ---- Response types ----

const PRICE_SCALE: u64 = 100_000_000; // 1e8

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketSnapshot {
    pub asset_id: String,
    pub source: String,
    pub symbol: String,
    pub name: String,
    pub value: Decimal,
    /// Integer-scaled price: round(value * 1e8), serialized as string.
    /// May be negative (e.g., interest rates, temperatures). Consumers MUST parse as i128, not u128.
    /// Computed once at the data-node — all oracles parse the same string to the same i128.
    pub value_scaled: String,
    /// Scale factor applied to produce value_scaled. Always 100_000_000 (1e8).
    pub price_scale: u64,
    pub change_pct: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub category: Option<String>,
    pub fetched_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Custom response type for snapshot endpoints that includes HMAC signature header.
pub struct SnapshotResponse {
    status: StatusCode,
    headers: Vec<(String, String)>,
    body: String,
}

impl IntoResponse for SnapshotResponse {
    fn into_response(self) -> Response {
        let mut response = (self.status, self.body).into_response();
        for (key, value) in self.headers {
            if let Ok(header_name) = key.parse::<axum::http::HeaderName>() {
                if let Ok(header_value) = value.parse::<axum::http::HeaderValue>() {
                    response.headers_mut().insert(header_name, header_value);
                }
            }
        }
        response
    }
}

fn internal_error(e: impl std::fmt::Display) -> (StatusCode, Json<ErrorResponse>) {
    tracing::error!("{e}", e = e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: format!("Internal error: {}", e),
        }),
    )
}

/// Compute HMAC-SHA256 signature of JSON body if secret is configured.
/// Returns (status, headers_with_signature, body) for snapshot responses.
fn add_snapshot_hmac(
    body_json: serde_json::Value,
    secret: &Option<String>,
) -> (StatusCode, Vec<(String, String)>, String) {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let body_str = body_json.to_string();

    let mut headers = vec![];

    if let Some(secret) = secret {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(body_str.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());
        headers.push(("X-Snapshot-HMAC".to_string(), signature));

        tracing::debug!("Added HMAC-SHA256 signature to snapshot response");
    }

    (StatusCode::OK, headers, body_str)
}

// ---- GET /vision/snapshot ----

#[derive(Deserialize)]
pub struct SnapshotQuery {
    /// Filter by source (e.g. "coingecko", "finnhub")
    pub source: Option<String>,
    /// Filter by category
    pub category: Option<String>,
    /// Max rows to return (default 10000)
    pub limit: Option<i64>,
}

/// Bulk market data snapshot for Vision strategy scripts.
///
/// Returns the latest price per (source, asset_id) across all active assets,
/// with optional source and category filters.
/// If SNAPSHOT_HMAC_SECRET is configured, response includes X-Snapshot-HMAC header.
pub async fn snapshot(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SnapshotQuery>,
) -> Result<SnapshotResponse, (StatusCode, Json<ErrorResponse>)> {
    let limit = params.limit.unwrap_or(10_000).min(100_000);

    // Use market_prices_latest cache table for fast lookups instead of
    // expensive DISTINCT ON against the 12GB market_prices table.
    // Falls back to the slow query if cache table is empty/missing.
    let rows: Vec<(
        String,         // asset_id
        String,         // source
        String,         // symbol
        String,         // name
        Decimal,        // value
        Option<Decimal>, // change_pct
        Option<Decimal>, // volume_24h
        Option<Decimal>, // market_cap
        Option<String>,  // category
        DateTime<Utc>,   // fetched_at
    )> = sqlx::query_as(
        r#"
        SELECT l.asset_id, l.source, l.symbol,
            COALESCE(NULLIF(l.name, ''), a.name, l.symbol) AS name,
            l.value, l.change_pct, l.volume_24h, l.market_cap,
            COALESCE(l.category, a.category) AS category,
            l.fetched_at
        FROM market_prices_latest l
        LEFT JOIN market_assets a ON a.source = l.source AND a.asset_id = l.asset_id
        WHERE ($1::TEXT IS NULL OR l.source = $1)
          AND ($2::TEXT IS NULL OR COALESCE(l.category, a.category) = $2)
          AND (a.is_active IS NULL OR a.is_active = true)
        ORDER BY l.source, l.asset_id
        LIMIT $3
        "#,
    )
    .bind(params.source.as_deref())
    .bind(params.category.as_deref())
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let snapshots: Vec<MarketSnapshot> = rows
        .into_iter()
        .map(
            |(asset_id, source, symbol, name, value, change_pct, volume_24h, market_cap, category, fetched_at)| {
                // Convert Decimal → f64 → integer-scaled i128, rounding once here so all
                // oracles parse the same string to the same i128 (no per-hardware f64 drift).
                // i128 (not u128) to preserve sign for negative values (e.g., interest rates,
                // temperatures). Consumers must parse value_scaled as i128.
                let value_f64: f64 = value.to_string().parse().unwrap_or(0.0);
                let value_scaled: i128 = (value_f64 * PRICE_SCALE as f64).round() as i128;
                MarketSnapshot {
                    asset_id,
                    source,
                    symbol,
                    name,
                    value,
                    value_scaled: value_scaled.to_string(),
                    price_scale: PRICE_SCALE,
                    change_pct,
                    volume_24h,
                    market_cap,
                    category,
                    fetched_at,
                }
            },
        )
        .collect();

    let body_json = serde_json::json!({
        "generatedAt": Utc::now(),
        "count": snapshots.len(),
        "limit": limit,
        "snapshots": snapshots,
    });

    // Compute HMAC signature if secret is configured
    let (status, headers, body_str) = add_snapshot_hmac(body_json, &state.snapshot_hmac_secret);

    Ok(SnapshotResponse {
        status,
        headers,
        body: body_str,
    })
}

// ---- GET /vision/markets/active ----

/// Active markets catalog for Vision oracles.
///
/// For now, returns the full catalog (snapshot with limit=50000).
/// Future: will filter by BLS-signed oracle whitelist.
/// If SNAPSHOT_HMAC_SECRET is configured, response includes X-Snapshot-HMAC header.
pub async fn active_markets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SnapshotQuery>,
) -> Result<SnapshotResponse, (StatusCode, Json<ErrorResponse>)> {
    // Override limit to full catalog, but respect source/category filters
    let full_params = SnapshotQuery {
        source: params.source,
        category: params.category,
        limit: Some(50_000),
    };
    snapshot(State(state), Query(full_params)).await
}

// ---- GET /vision/batch/:batch_id/history ----

#[derive(Deserialize)]
pub struct BatchHistoryQuery {
    pub days: Option<i64>,
}

/// Price history for all markets in a given batch.
///
/// Returns up to 7 days of price data grouped by asset_id.
pub async fn batch_history(
    State(state): State<Arc<AppState>>,
    Path(batch_id): Path<u64>,
    Query(params): Query<BatchHistoryQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let days = params.days.unwrap_or(7).min(7);
    let cutoff = Utc::now() - chrono::Duration::days(days);

    // Resolve batch → source + market_ids
    let batch_info = state
        .vision_batch_cache
        .get(batch_id)
        .await
        .map_err(|e| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
        })?;

    // Query price history for all markets in the batch
    let rows: Vec<(
        String,          // asset_id
        String,          // symbol
        Decimal,         // value
        Option<Decimal>, // change_pct
        Option<Decimal>, // volume_24h
        Option<Decimal>, // market_cap
        DateTime<Utc>,   // fetched_at
    )> = sqlx::query_as(
        r#"
        SELECT asset_id, symbol, value, change_pct, volume_24h, market_cap, fetched_at
        FROM market_prices
        WHERE source = $1
          AND asset_id = ANY($2)
          AND fetched_at >= $3
        ORDER BY asset_id, fetched_at ASC
        "#,
    )
    .bind(&batch_info.source)
    .bind(&batch_info.market_ids)
    .bind(cutoff)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    // Group by asset_id
    let mut markets: HashMap<String, serde_json::Value> = HashMap::new();
    for (asset_id, symbol, value, change_pct, volume_24h, _market_cap, fetched_at) in rows {
        let entry = markets.entry(asset_id.clone()).or_insert_with(|| {
            serde_json::json!({
                "id": asset_id,
                "symbol": symbol,
                "prices": []
            })
        });
        if let Some(prices) = entry["prices"].as_array_mut() {
            prices.push(serde_json::json!({
                "ts": fetched_at,
                "price": value.to_string(),
                "changePct": change_pct.map(|v| v.to_string()),
                "volume24h": volume_24h.map(|v| v.to_string()),
            }));
        }
    }

    Ok(Json(serde_json::json!({
        "batchId": batch_id,
        "source": batch_info.source,
        "markets": markets.into_values().collect::<Vec<_>>(),
    })))
}

// ---- GET /vision/leaderboard (precomputed from Postgres) ----

#[derive(Deserialize)]
pub struct LeaderboardQuery {
    pub source_id: Option<String>,
    pub batch_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LeaderboardEntry {
    rank: usize,
    wallet_address: String,
    pnl: f64,
    win_rate: f64,
    roi: f64,
    total_volume: f64,
    portfolio_bets: i64,
    avg_portfolio_size: f64,
    largest_portfolio: i64,
}

/// Precomputed leaderboard data, refreshed every 30s from shared Postgres.
///
/// Stores per-batch and global leaderboards so the API handler never queries at request time.
pub struct LeaderboardCache {
    /// batch_id → ranked leaderboard entries
    per_batch: RwLock<HashMap<u64, Vec<LeaderboardEntry>>>,
    /// Global leaderboard (aggregated across all batches)
    global: RwLock<Vec<LeaderboardEntry>>,
    /// source_name → batch_id (from vision-batches.json manifest)
    source_to_batch: HashMap<String, u64>,
    updated_at: RwLock<DateTime<Utc>>,
}

impl LeaderboardCache {
    pub fn new(_oracle_url: String) -> Self {
        // Load source → batch_id mapping from deployment manifest
        let mut source_to_batch = HashMap::new();
        let manifest_paths = [
            "deployments/vision-batches.json",
            "/app/deployments/vision-batches.json",
        ];
        for path in &manifest_paths {
            if let Ok(contents) = std::fs::read_to_string(path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                    if let Some(batches) = val.get("batches").and_then(|b| b.as_object()) {
                        for (name, info) in batches {
                            if let Some(id) = info.get("batchId").and_then(|v| v.as_u64()) {
                                source_to_batch.insert(name.clone(), id);
                            }
                        }
                    }
                }
                tracing::info!(
                    count = source_to_batch.len(),
                    path,
                    "Leaderboard: loaded source→batch mapping"
                );
                break;
            }
        }

        Self {
            per_batch: RwLock::new(HashMap::new()),
            global: RwLock::new(Vec::new()),
            source_to_batch,
            updated_at: RwLock::new(Utc::now()),
        }
    }

    /// Background refresh — call every 30s from a spawned task.
    pub async fn refresh(&self, pool: &sqlx::PgPool) {
        #[derive(sqlx::FromRow)]
        struct Row {
            player: String,
            batch_id: i64,
            balance: Option<String>,
            total_deposited: Option<String>,
        }

        let rows = sqlx::query_as::<_, Row>(
            "SELECT player, batch_id, balance::text, total_deposited::text
             FROM vision_positions
             WHERE total_deposited::numeric > 0",
        )
        .fetch_all(pool)
        .await;

        let rows = match rows {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Leaderboard refresh failed: {e}");
                return;
            }
        };

        // Per-batch aggregation: batch_id → player → stats
        let mut batch_players: HashMap<u64, HashMap<String, (f64, f64)>> = HashMap::new();
        // Global aggregation: player → (total_balance, total_deposited, batches, wins)
        let mut global_players: HashMap<String, (f64, f64, i64, i64)> = HashMap::new();

        for row in &rows {
            let bid = row.batch_id as u64;
            let balance = row
                .balance
                .as_deref()
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            let deposited = row
                .total_deposited
                .as_deref()
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);

            // Per-batch
            batch_players
                .entry(bid)
                .or_default()
                .entry(row.player.clone())
                .and_modify(|(b, d)| {
                    *b += balance;
                    *d += deposited;
                })
                .or_insert((balance, deposited));

            // Global
            let g = global_players.entry(row.player.clone()).or_insert((0.0, 0.0, 0, 0));
            g.0 += balance;
            g.1 += deposited;
            g.2 += 1;
            if balance > deposited {
                g.3 += 1;
            }
        }

        // Build per-batch leaderboards
        let mut new_per_batch = HashMap::new();
        for (bid, players) in &batch_players {
            let mut entries: Vec<LeaderboardEntry> = players
                .iter()
                .map(|(addr, (bal, dep))| {
                    let pnl = (bal - dep) / 1e18;
                    let vol = dep / 1e18;
                    let roi = if *dep > 0.0 { (pnl / vol) * 100.0 } else { 0.0 };
                    let win = if *bal > *dep { 1.0 } else { 0.0 };
                    LeaderboardEntry {
                        rank: 0,
                        wallet_address: addr.clone(),
                        pnl,
                        win_rate: win * 100.0,
                        roi,
                        total_volume: vol,
                        portfolio_bets: 1,
                        avg_portfolio_size: 0.0,
                        largest_portfolio: 0,
                    }
                })
                .collect();
            entries.sort_by(|a, b| b.pnl.partial_cmp(&a.pnl).unwrap_or(std::cmp::Ordering::Equal));
            for (i, e) in entries.iter_mut().enumerate() {
                e.rank = i + 1;
            }
            new_per_batch.insert(*bid, entries);
        }

        // Build global leaderboard
        let mut global_entries: Vec<LeaderboardEntry> = global_players
            .iter()
            .map(|(addr, (bal, dep, batches, wins))| {
                let pnl = (bal - dep) / 1e18;
                let vol = dep / 1e18;
                let roi = if *dep > 0.0 { (pnl / vol) * 100.0 } else { 0.0 };
                let win_rate = if *batches > 0 {
                    (*wins as f64 / *batches as f64) * 100.0
                } else {
                    0.0
                };
                LeaderboardEntry {
                    rank: 0,
                    wallet_address: addr.clone(),
                    pnl,
                    win_rate,
                    roi,
                    total_volume: vol,
                    portfolio_bets: *batches,
                    avg_portfolio_size: 0.0,
                    largest_portfolio: 0,
                }
            })
            .collect();
        global_entries.sort_by(|a, b| b.pnl.partial_cmp(&a.pnl).unwrap_or(std::cmp::Ordering::Equal));
        for (i, e) in global_entries.iter_mut().enumerate() {
            e.rank = i + 1;
        }

        *self.per_batch.write().await = new_per_batch;
        *self.global.write().await = global_entries;
        *self.updated_at.write().await = Utc::now();
    }

    /// Read precomputed leaderboard — zero allocation for the common case.
    pub async fn get(
        &self,
        source_id: Option<&str>,
        batch_id: Option<u64>,
    ) -> serde_json::Value {
        let updated = *self.updated_at.read().await;

        // Resolve source_id to batch_id
        let effective_batch = match (source_id, batch_id) {
            (Some(s), _) => self.source_to_batch.get(s).copied(),
            (_, Some(b)) => Some(b),
            _ => None,
        };

        let entries = if let Some(bid) = effective_batch {
            let per_batch = self.per_batch.read().await;
            per_batch.get(&bid).cloned().unwrap_or_default()
        } else {
            self.global.read().await.clone()
        };

        serde_json::json!({
            "leaderboard": entries,
            "updatedAt": updated.to_rfc3339(),
        })
    }
}

/// Vision leaderboard — precomputed from Postgres every 30s.
///
/// Supports `?source_id=pumpfun` (resolved to batch_id via manifest)
/// or `?batch_id=N` for a single batch.
pub async fn leaderboard(
    State(state): State<Arc<AppState>>,
    Query(params): Query<LeaderboardQuery>,
) -> Json<serde_json::Value> {
    Json(
        state
            .leaderboard_cache
            .get(params.source_id.as_deref(), params.batch_id)
            .await,
    )
}

// ---- GET /vision/player/:address/profile ----

/// Player profile — proxied from oracle with 30s cache.
pub async fn player_profile_proxy(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    if address.len() != 42
        || !address.starts_with("0x")
        || !address[2..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return (StatusCode::BAD_REQUEST, "Invalid address").into_response();
    }
    let addr = address.to_lowercase();
    match state.profile_cache.get_or_fetch(&addr).await {
        Ok(json) => (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "application/json")],
            json,
        )
            .into_response(),
        Err(status) => (status, "Profile unavailable").into_response(),
    }
}
