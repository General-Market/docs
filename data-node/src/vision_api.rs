//! Vision price data endpoints
//!
//! Serves raw market/price data for Vision strategy scripts.
//! Batch state, history, and backtest endpoints live on the issuer.

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::api::AppState;

// ---- Response types ----

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketSnapshot {
    pub asset_id: String,
    pub source: String,
    pub symbol: String,
    pub name: String,
    pub value: Decimal,
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

fn internal_error(e: impl std::fmt::Display) -> (StatusCode, Json<ErrorResponse>) {
    tracing::error!("{e}", e = e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: format!("Internal error: {}", e),
        }),
    )
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
pub async fn snapshot(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SnapshotQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let limit = params.limit.unwrap_or(10_000).min(100_000);

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
        SELECT DISTINCT ON (a.source, a.asset_id)
            a.asset_id, a.source, a.symbol, a.name,
            p.value, p.change_pct, p.volume_24h, p.market_cap,
            a.category, p.fetched_at
        FROM market_assets a
        JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
        WHERE a.is_active = true
          AND ($1::TEXT IS NULL OR a.source = $1)
          AND ($2::TEXT IS NULL OR a.category = $2)
        ORDER BY a.source, a.asset_id, p.fetched_at DESC
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
                MarketSnapshot {
                    asset_id,
                    source,
                    symbol,
                    name,
                    value,
                    change_pct,
                    volume_24h,
                    market_cap,
                    category,
                    fetched_at,
                }
            },
        )
        .collect();

    Ok(Json(serde_json::json!({
        "generatedAt": Utc::now(),
        "count": snapshots.len(),
        "limit": limit,
        "snapshots": snapshots,
    })))
}

// ---- GET /vision/markets/active ----

/// Active markets catalog for Vision issuers.
///
/// For now, returns the full catalog (snapshot with limit=50000).
/// Future: will filter by BLS-signed issuer whitelist.
pub async fn active_markets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SnapshotQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    // Override limit to full catalog, but respect source/category filters
    let full_params = SnapshotQuery {
        source: params.source,
        category: params.category,
        limit: Some(50_000),
    };
    snapshot(State(state), Query(full_params)).await
}
