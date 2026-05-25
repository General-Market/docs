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
#[derive(Clone)]
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
    use std::sync::{Mutex, OnceLock};
    use std::time::Instant;

    // 15-second TTL cache for per-source snapshot results.
    // Key: (source, category, limit). Eliminates redundant DB queries when
    // multiple users view the same source detail page within the TTL window.
    static SNAPSHOT_CACHE: OnceLock<Mutex<std::collections::HashMap<String, (Instant, SnapshotResponse)>>> = OnceLock::new();
    let cache = SNAPSHOT_CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()));
    const SNAPSHOT_TTL: std::time::Duration = std::time::Duration::from_secs(15);

    let cache_key = format!(
        "{}:{}:{}",
        params.source.as_deref().unwrap_or("_all"),
        params.category.as_deref().unwrap_or("_"),
        params.limit.unwrap_or(10_000),
    );

    // Return cached response if within TTL
    if let Ok(guard) = cache.lock() {
        if let Some((ts, resp)) = guard.get(&cache_key) {
            if ts.elapsed() < SNAPSHOT_TTL {
                return Ok(resp.clone());
            }
        }
    }

    // No hard cap — the per-source ROW_NUMBER() window naturally bounds total rows
    // to ~(num_sources * per_source_cap). Default 10K for lightweight grid requests.
    let limit = params.limit.unwrap_or(10_000) as i64;

    // Use market_prices_latest cache table for fast lookups instead of
    // expensive DISTINCT ON against the 12GB market_prices table.
    //
    // When no source filter is given, cap each source to at most `per_source_cap`
    // rows so that large sources (polymarket 48K, crates_io 20K, weather 161K)
    // don't crowd out smaller ones. With a source filter, return up to `limit`.
    let has_source_filter = params.source.is_some();
    // Per-source cap: fit ~84 sources into the limit, but at least 500 each
    let per_source_cap = if has_source_filter {
        limit
    } else {
        (limit / 84).max(500).min(5000)
    };

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
        SELECT asset_id, source, symbol, name, value, change_pct,
               volume_24h, market_cap, category, fetched_at
        FROM (
            SELECT l.asset_id, l.source, l.symbol,
                COALESCE(NULLIF(l.name, ''), a.name, l.symbol) AS name,
                l.value, l.change_pct, l.volume_24h, l.market_cap,
                COALESCE(l.category, a.category) AS category,
                l.fetched_at,
                ROW_NUMBER() OVER (PARTITION BY l.source ORDER BY l.asset_id) AS rn
            FROM market_prices_latest l
            LEFT JOIN market_assets a ON a.source = l.source AND a.asset_id = l.asset_id
            WHERE ($1::TEXT IS NULL OR l.source = $1)
              AND ($2::TEXT IS NULL OR COALESCE(l.category, a.category) = $2)
              AND (a.is_active IS NULL OR a.is_active = true)
        ) sub
        WHERE rn <= $3
        ORDER BY source, asset_id
        LIMIT $4
        "#,
    )
    .bind(params.source.as_deref())
    .bind(params.category.as_deref())
    .bind(per_source_cap)
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

    let resp = SnapshotResponse {
        status,
        headers,
        body: body_str,
    };

    // Cache result for subsequent requests within TTL
    if let Ok(mut guard) = cache.lock() {
        guard.insert(cache_key, (Instant::now(), resp.clone()));
        // Evict stale entries to prevent unbounded growth
        if guard.len() > 200 {
            guard.retain(|_, (ts, _)| ts.elapsed() < SNAPSHOT_TTL);
        }
    }

    Ok(resp)
}

// ---- POST /vision/snapshot/targeted ----

#[derive(Deserialize)]
pub struct TargetedSnapshotRequest {
    /// Specific asset IDs to fetch prices for.
    pub asset_ids: Vec<String>,
    /// Source filter (required — prevents cross-source collisions).
    pub source: String,
}

/// Targeted market data snapshot — returns prices only for the requested asset IDs.
///
/// Designed for oracle resolve_and_settle: instead of fetching the entire source
/// (50k+ rows for polymarket) and discarding 99%, the caller sends the exact
/// asset IDs it needs. Response format matches GET /vision/snapshot.
pub async fn snapshot_targeted(
    State(state): State<Arc<AppState>>,
    Json(body): Json<TargetedSnapshotRequest>,
) -> Result<SnapshotResponse, (StatusCode, Json<ErrorResponse>)> {
    if body.asset_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "asset_ids must not be empty".to_string(),
            }),
        ));
    }

    // Curated subsources (e.g. `defillama-ai-agents`) carry the subsource key as
    // their batch source, but their prices are ingested under the parent firehose
    // (`defi`). Resolve to the price-ingestion source so the snapshot query finds
    // rows — without this, every curated subsource batch resolves 100% Cancelled.
    let price_source = state.source_registry.price_source_for(&body.source);

    let rows: Vec<(
        String,          // asset_id
        String,          // source
        String,          // symbol
        String,          // name
        Decimal,         // value
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
        WHERE l.source = $1
          AND l.asset_id = ANY($2)
        ORDER BY l.asset_id
        "#,
    )
    .bind(&price_source)
    .bind(&body.asset_ids)
    .fetch_all(&state.pool)
    .await
    .map_err(internal_error)?;

    let snapshots: Vec<MarketSnapshot> = rows
        .into_iter()
        .map(
            |(asset_id, source, symbol, name, value, change_pct, volume_24h, market_cap, category, fetched_at)| {
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
        "requested": body.asset_ids.len(),
        "snapshots": snapshots,
    });

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

// ---- GET /vision/leaderboard (proxied from oracle) ----

#[derive(Deserialize)]
pub struct LeaderboardQuery {
    pub source_id: Option<String>,
    /// Shorthand alias for `source_id`. The frontend canonicalises to
    /// `source_id`, but smoke tests and ad-hoc curls often type `source=`.
    /// Treat them as the same query.
    pub source: Option<String>,
    pub batch_id: Option<u64>,
}

/// Leaderboard proxy cache — forwards to the oracle endpoint (single source of truth)
/// with a 15s TTL cache to avoid hammering the oracle on every request.
pub struct LeaderboardProxyCache {
    oracle_url: String,
    client: reqwest::Client,
    cache: mini_moka::sync::Cache<String, String>,
}

impl LeaderboardProxyCache {
    pub fn new(oracle_url: String) -> Self {
        Self {
            oracle_url,
            client: reqwest::Client::builder()
                // Upstream leaderboard query gets slow under load — give it
                // room before we fail the cache miss. Successful misses
                // populate the cache and shelter the next 60s.
                .timeout(std::time::Duration::from_secs(25))
                .build()
                .unwrap_or_default(),
            cache: mini_moka::sync::Cache::builder()
                .max_capacity(100)
                // 60s is generous for a leaderboard that updates on settle —
                // the upstream materialises it from Postgres aggregations and
                // hammering it on every request costs more than it pays.
                .time_to_live(std::time::Duration::from_secs(60))
                .build(),
        }
    }

    pub async fn get_or_fetch(&self, source_id: Option<&str>, batch_id: Option<u64>) -> Result<String, StatusCode> {
        // Build cache key from query params
        let cache_key = match (source_id, batch_id) {
            (Some(s), _) => format!("source:{}", s),
            (_, Some(b)) => format!("batch:{}", b),
            _ => "global".to_string(),
        };

        if let Some(cached) = self.cache.get(&cache_key) {
            return Ok(cached);
        }

        // Build oracle URL with query params
        let mut url = format!("{}/vision/leaderboard", self.oracle_url);
        let mut params = vec![];
        if let Some(s) = source_id {
            params.push(format!("source_id={}", s));
        }
        if let Some(b) = batch_id {
            params.push(format!("batch_id={}", b));
        }
        if !params.is_empty() {
            url = format!("{}?{}", url, params.join("&"));
        }

        match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.text().await {
                    self.cache.insert(cache_key, body.clone());
                    return Ok(body);
                }
                Err(StatusCode::BAD_GATEWAY)
            }
            _ => Err(StatusCode::BAD_GATEWAY),
        }
    }
}

/// Vision leaderboard — proxied from oracle (single source of truth).
///
/// Supports `?source_id=pumpfun` or `?batch_id=N` for filtered views.
pub async fn leaderboard(
    State(state): State<Arc<AppState>>,
    Query(params): Query<LeaderboardQuery>,
) -> impl IntoResponse {
    // `source_id` wins when both are present.
    let source = params.source_id.as_deref().or(params.source.as_deref());
    match state
        .leaderboard_cache
        .get_or_fetch(source, params.batch_id)
        .await
    {
        Ok(json) => (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "application/json")],
            json,
        )
            .into_response(),
        Err(status) => (status, "Leaderboard unavailable").into_response(),
    }
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
