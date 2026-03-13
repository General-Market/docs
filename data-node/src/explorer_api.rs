//! Authenticated explorer API — aggregated-only health endpoints.
//!
//! Security invariants:
//! - C6: Empty token panics at startup, returns 500 at runtime
//! - C7/H14: SHA-256 hash-then-compare eliminates length oracle
//! - H23: AVG for timing fields (no MAX that leaks slow-node identity)
//! - H24: quorum_met bool, NOT node_count
//! - H25: Numeric severity mapping for worst_status
//! - C5: GROUP BY poll_batch_ts
//! - H31: Latest window = 10 minutes (2x poll interval)

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use subtle::ConstantTimeEq;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROWS: i64 = 2000;
/// 2x the 5-minute poll interval — window for "latest" query.
const LATEST_WINDOW_SECS: f64 = 600.0;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct ExplorerState {
    pool: PgPool,
    token: String,
}

// ---------------------------------------------------------------------------
// Auth — C6, C7, H14
// ---------------------------------------------------------------------------

fn check_auth(headers: &HeaderMap, expected: &str) -> Result<(), StatusCode> {
    // C6: empty token at runtime → 500 (startup panics via assert in route ctor)
    if expected.is_empty() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let provided = headers
        .get("x-explorer-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    // C7: hash both sides so lengths are always equal
    let expected_hash = Sha256::digest(expected.as_bytes());
    let provided_hash = Sha256::digest(provided.as_bytes());
    // H14: constant-time comparison
    if expected_hash.ct_eq(&provided_hash).unwrap_u8() != 1 {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AggregatedSnapshot {
    pub poll_batch_ts: DateTime<Utc>,
    pub quorum_met: bool,
    pub worst_status: String,
    pub consensus_rounds_total: i64,
    pub consensus_success_total: i64,
    pub consensus_failed_total: i64,
    pub signatures_collected: i64,
    pub avg_consensus_time_ms: i64,
    pub avg_cycle_duration_ms: i64,
    pub orders_processed_last_60s: i64,
    pub pending_order_count: i64,
    pub total_peers: i64,
    pub p2p_messages_received: i64,
    pub p2p_messages_sent: i64,
    pub total_peers_healthy: i64,
    pub total_peers_unhealthy: i64,
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct HistoryQuery {
    /// One of: 1h, 6h, 24h, 7d, 30d (default 24h)
    range: Option<String>,
    /// Max rows returned (capped at MAX_ROWS)
    limit: Option<i64>,
}

fn range_to_secs(range: &str) -> f64 {
    match range {
        "1h" => 3_600.0,
        "6h" => 21_600.0,
        "24h" => 86_400.0,
        "7d" => 604_800.0,
        "30d" => 2_592_000.0,
        _ => 86_400.0,
    }
}

// ---------------------------------------------------------------------------
// GET /explorer/health/history
// ---------------------------------------------------------------------------

async fn health_history(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> impl IntoResponse {
    check_auth(&headers, &state.token)?;

    let secs = range_to_secs(q.range.as_deref().unwrap_or("24h"));
    let limit = q.limit.unwrap_or(MAX_ROWS).min(MAX_ROWS).max(1);

    let rows = sqlx::query_as::<_, AggregatedSnapshot>(
        r#"
        SELECT
            poll_batch_ts,
            (COUNT(*) >= 2)                                      AS quorum_met,
            CASE MAX(CASE WHEN status = 'unhealthy' THEN 3
                          WHEN status = 'degraded'  THEN 2
                          ELSE 1 END)
                 WHEN 3 THEN 'unhealthy'
                 WHEN 2 THEN 'degraded'
                 ELSE 'healthy' END                              AS worst_status,
            COALESCE(SUM(consensus_rounds_total), 0)::BIGINT     AS consensus_rounds_total,
            COALESCE(SUM(consensus_success_total), 0)::BIGINT    AS consensus_success_total,
            COALESCE(SUM(consensus_failed_total), 0)::BIGINT     AS consensus_failed_total,
            COALESCE(SUM(signatures_collected), 0)::BIGINT       AS signatures_collected,
            COALESCE(AVG(last_consensus_time_ms), 0)::BIGINT     AS avg_consensus_time_ms,
            COALESCE(AVG(last_cycle_duration_ms), 0)::BIGINT     AS avg_cycle_duration_ms,
            COALESCE(SUM(orders_processed_last_60s), 0)::BIGINT  AS orders_processed_last_60s,
            COALESCE(SUM(pending_order_count), 0)::BIGINT        AS pending_order_count,
            COALESCE(SUM(connected_peers), 0)::BIGINT            AS total_peers,
            COALESCE(SUM(p2p_messages_received), 0)::BIGINT      AS p2p_messages_received,
            COALESCE(SUM(p2p_messages_sent), 0)::BIGINT          AS p2p_messages_sent,
            COALESCE(SUM(peers_healthy), 0)::BIGINT              AS total_peers_healthy,
            COALESCE(SUM(peers_unhealthy), 0)::BIGINT            AS total_peers_unhealthy
        FROM issuer_health_snapshots
        WHERE poll_batch_ts > NOW() - make_interval(secs => $1)
        GROUP BY poll_batch_ts
        ORDER BY poll_batch_ts ASC
        LIMIT $2
        "#,
    )
    .bind(secs)
    .bind(limit)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(data) => Ok(Json(serde_json::json!({"snapshots": data}))),
        Err(e) => {
            tracing::error!(error = %e, "explorer health_history query failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// ---------------------------------------------------------------------------
// GET /explorer/health/latest
// ---------------------------------------------------------------------------

async fn health_latest(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    check_auth(&headers, &state.token)?;

    let row = sqlx::query_as::<_, AggregatedSnapshot>(
        r#"
        SELECT
            MAX(poll_batch_ts)                                   AS poll_batch_ts,
            (COUNT(DISTINCT node_id) >= 2)                       AS quorum_met,
            CASE MAX(CASE WHEN status = 'unhealthy' THEN 3
                          WHEN status = 'degraded'  THEN 2
                          ELSE 1 END)
                 WHEN 3 THEN 'unhealthy'
                 WHEN 2 THEN 'degraded'
                 ELSE 'healthy' END                              AS worst_status,
            COALESCE(SUM(consensus_rounds_total), 0)::BIGINT     AS consensus_rounds_total,
            COALESCE(SUM(consensus_success_total), 0)::BIGINT    AS consensus_success_total,
            COALESCE(SUM(consensus_failed_total), 0)::BIGINT     AS consensus_failed_total,
            COALESCE(SUM(signatures_collected), 0)::BIGINT       AS signatures_collected,
            COALESCE(AVG(last_consensus_time_ms), 0)::BIGINT     AS avg_consensus_time_ms,
            COALESCE(AVG(last_cycle_duration_ms), 0)::BIGINT     AS avg_cycle_duration_ms,
            COALESCE(SUM(orders_processed_last_60s), 0)::BIGINT  AS orders_processed_last_60s,
            COALESCE(SUM(pending_order_count), 0)::BIGINT        AS pending_order_count,
            COALESCE(SUM(connected_peers), 0)::BIGINT            AS total_peers,
            COALESCE(SUM(p2p_messages_received), 0)::BIGINT      AS p2p_messages_received,
            COALESCE(SUM(p2p_messages_sent), 0)::BIGINT          AS p2p_messages_sent,
            COALESCE(SUM(peers_healthy), 0)::BIGINT              AS total_peers_healthy,
            COALESCE(SUM(peers_unhealthy), 0)::BIGINT            AS total_peers_unhealthy
        FROM (
            SELECT DISTINCT ON (node_id) *
            FROM issuer_health_snapshots
            WHERE poll_batch_ts > NOW() - make_interval(secs => $1)
            ORDER BY node_id, poll_batch_ts DESC
        ) latest_per_node
        HAVING COUNT(*) > 0
        "#,
    )
    .bind(LATEST_WINDOW_SECS)
    .fetch_optional(&state.pool)
    .await;

    match row {
        Ok(Some(data)) => Ok(Json(serde_json::json!({"network": data}))),
        Ok(None) => Err(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!(error = %e, "explorer health_latest query failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// ---------------------------------------------------------------------------
// Route constructor — C6: panics if token is empty
// ---------------------------------------------------------------------------

pub fn explorer_routes(pool: PgPool, token: String) -> axum::Router {
    assert!(
        !token.is_empty(),
        "EXPLORER_TOKEN must be set and non-empty"
    );
    let state = Arc::new(ExplorerState { pool, token });
    axum::Router::new()
        .route(
            "/explorer/health/history",
            axum::routing::get(health_history),
        )
        .route(
            "/explorer/health/latest",
            axum::routing::get(health_latest),
        )
        .with_state(state)
}
