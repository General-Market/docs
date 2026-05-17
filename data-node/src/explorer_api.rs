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
        FROM oracle_health_snapshots
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
            FROM oracle_health_snapshots
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
        .route(
            "/explorer/dtf/fills",
            axum::routing::get(dtf_fills),
        )
        .route(
            "/explorer/dtf/order-lifecycle",
            axum::routing::get(dtf_order_lifecycle),
        )
        .route(
            "/explorer/dtf/tvl",
            axum::routing::get(dtf_tvl),
        )
        .route(
            "/explorer/dtf/orders-per-hour",
            axum::routing::get(dtf_orders_per_hour),
        )
        .with_state(state)
}

// ---------------------------------------------------------------------------
// DTF metrics — fills, order lifecycle, TVL history, orders per hour.
// ---------------------------------------------------------------------------
//
// Bucket size is picked to give roughly 60 buckets per window — enough
// resolution for trends, sparse enough to render at 60fps. The same
// secs_to_bucket() function is used by every DTF endpoint so the four
// charts share a time axis.

fn secs_to_bucket(secs: f64) -> i64 {
    // Target ~60 buckets — round up to a sensible interval.
    let target = (secs / 60.0).max(60.0) as i64;
    // Snap to {1, 5, 10, 30 min, 1, 4, 12, 24 hours}.
    for snap in [60, 300, 600, 1_800, 3_600, 14_400, 43_200, 86_400] {
        if target <= snap {
            return snap;
        }
    }
    86_400
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct FillsBucket {
    bucket: DateTime<Utc>,
    buy_count: i64,
    sell_count: i64,
    buy_amount: String,
    sell_amount: String,
    borrow_count: i64,
    repay_count: i64,
    supply_count: i64,
    withdraw_count: i64,
    borrow_amount: String,
    repay_amount: String,
    supply_amount: String,
    withdraw_amount: String,
}

async fn dtf_fills(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> impl IntoResponse {
    check_auth(&headers, &state.token)?;

    let secs = range_to_secs(q.range.as_deref().unwrap_or("24h"));
    let bucket = secs_to_bucket(secs);

    // Pivot both tables into a single row per bucket BEFORE joining, so the
    // bucket-grid left-join doesn't fan out (trade_fills has up to 2 rows
    // per bucket, lending up to 6 — naive join would cartesian them).
    let rows = sqlx::query_as::<_, FillsBucket>(
        r#"
        WITH buckets AS (
            SELECT generate_series(
                date_trunc('second', NOW() - make_interval(secs => $1)),
                date_trunc('second', NOW()),
                make_interval(secs => $2)
            ) AS bucket
        ),
        trade_pivot AS (
            SELECT
                to_timestamp(floor(extract(epoch FROM fill_timestamp) / $2) * $2)
                    AT TIME ZONE 'UTC' AS bucket,
                COUNT(*) FILTER (WHERE side = 0) AS buy_count,
                COUNT(*) FILTER (WHERE side = 1) AS sell_count,
                COALESCE(SUM(NULLIF(fill_amount, '')::numeric) FILTER (WHERE side = 0), 0) AS buy_amount,
                COALESCE(SUM(NULLIF(fill_amount, '')::numeric) FILTER (WHERE side = 1), 0) AS sell_amount
            FROM trades
            WHERE fill_timestamp IS NOT NULL
              AND fill_timestamp > NOW() - make_interval(secs => $1)
            GROUP BY 1
        ),
        lending_pivot AS (
            SELECT
                to_timestamp(floor(extract(epoch FROM block_time) / $2) * $2)
                    AT TIME ZONE 'UTC' AS bucket,
                COUNT(*) FILTER (WHERE event_kind = 0) AS supply_count,
                COUNT(*) FILTER (WHERE event_kind = 1) AS withdraw_count,
                COUNT(*) FILTER (WHERE event_kind = 2) AS borrow_count,
                COUNT(*) FILTER (WHERE event_kind = 3) AS repay_count,
                COALESCE(SUM(amount) FILTER (WHERE event_kind = 0), 0) AS supply_amount,
                COALESCE(SUM(amount) FILTER (WHERE event_kind = 1), 0) AS withdraw_amount,
                COALESCE(SUM(amount) FILTER (WHERE event_kind = 2), 0) AS borrow_amount,
                COALESCE(SUM(amount) FILTER (WHERE event_kind = 3), 0) AS repay_amount
            FROM lending_events
            WHERE block_time > NOW() - make_interval(secs => $1)
            GROUP BY 1
        )
        SELECT
            b.bucket,
            COALESCE(tp.buy_count, 0)::BIGINT     AS buy_count,
            COALESCE(tp.sell_count, 0)::BIGINT    AS sell_count,
            COALESCE(tp.buy_amount, 0)::TEXT      AS buy_amount,
            COALESCE(tp.sell_amount, 0)::TEXT     AS sell_amount,
            COALESCE(lp.borrow_count, 0)::BIGINT  AS borrow_count,
            COALESCE(lp.repay_count, 0)::BIGINT   AS repay_count,
            COALESCE(lp.supply_count, 0)::BIGINT  AS supply_count,
            COALESCE(lp.withdraw_count, 0)::BIGINT AS withdraw_count,
            COALESCE(lp.borrow_amount, 0)::TEXT   AS borrow_amount,
            COALESCE(lp.repay_amount, 0)::TEXT    AS repay_amount,
            COALESCE(lp.supply_amount, 0)::TEXT   AS supply_amount,
            COALESCE(lp.withdraw_amount, 0)::TEXT AS withdraw_amount
        FROM buckets b
        LEFT JOIN trade_pivot   tp ON tp.bucket = b.bucket
        LEFT JOIN lending_pivot lp ON lp.bucket = b.bucket
        ORDER BY b.bucket ASC
        "#,
    )
    .bind(secs)
    .bind(bucket as f64)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(data) => Ok(Json(serde_json::json!({
            "bucket_secs": bucket,
            "series": data,
        }))),
        Err(e) => {
            tracing::error!(error = %e, "dtf_fills query failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct LifecycleBucket {
    bucket: DateTime<Utc>,
    placed: i64,
    filled: i64,
    cancelled: i64,
}

async fn dtf_order_lifecycle(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> impl IntoResponse {
    check_auth(&headers, &state.token)?;

    let secs = range_to_secs(q.range.as_deref().unwrap_or("24h"));
    let bucket = secs_to_bucket(secs);

    // Status: 0=pending, 2=filled, 3=cancelled (per trades schema)
    let rows = sqlx::query_as::<_, LifecycleBucket>(
        r#"
        WITH buckets AS (
            SELECT generate_series(
                date_trunc('second', NOW() - make_interval(secs => $1)),
                date_trunc('second', NOW()),
                make_interval(secs => $2)
            ) AS bucket
        ),
        placed AS (
            SELECT
                to_timestamp(floor(extract(epoch FROM order_timestamp) / $2) * $2)
                    AT TIME ZONE 'UTC' AS bucket,
                COUNT(*) AS cnt
            FROM trades
            WHERE order_timestamp > NOW() - make_interval(secs => $1)
            GROUP BY 1
        ),
        filled AS (
            SELECT
                to_timestamp(floor(extract(epoch FROM fill_timestamp) / $2) * $2)
                    AT TIME ZONE 'UTC' AS bucket,
                COUNT(*) AS cnt
            FROM trades
            WHERE fill_timestamp IS NOT NULL
              AND fill_timestamp > NOW() - make_interval(secs => $1)
              AND status = 2
            GROUP BY 1
        ),
        cancelled AS (
            SELECT
                to_timestamp(floor(extract(epoch FROM order_timestamp) / $2) * $2)
                    AT TIME ZONE 'UTC' AS bucket,
                COUNT(*) AS cnt
            FROM trades
            WHERE status = 3
              AND order_timestamp > NOW() - make_interval(secs => $1)
            GROUP BY 1
        )
        SELECT
            b.bucket,
            COALESCE(p.cnt, 0)::BIGINT AS placed,
            COALESCE(f.cnt, 0)::BIGINT AS filled,
            COALESCE(c.cnt, 0)::BIGINT AS cancelled
        FROM buckets b
        LEFT JOIN placed    p ON p.bucket = b.bucket
        LEFT JOIN filled    f ON f.bucket = b.bucket
        LEFT JOIN cancelled c ON c.bucket = b.bucket
        ORDER BY b.bucket ASC
        "#,
    )
    .bind(secs)
    .bind(bucket as f64)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(data) => Ok(Json(serde_json::json!({
            "bucket_secs": bucket,
            "series": data,
        }))),
        Err(e) => {
            tracing::error!(error = %e, "dtf_order_lifecycle query failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct TvlPoint {
    snapshot_ts: DateTime<Utc>,
    total_aum_usd: f64,
    itp_count: i32,
    supply_count: i32,
}

async fn dtf_tvl(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> impl IntoResponse {
    check_auth(&headers, &state.token)?;
    let secs = range_to_secs(q.range.as_deref().unwrap_or("24h"));

    let rows = sqlx::query_as::<_, TvlPoint>(
        r#"
        SELECT
            snapshot_ts,
            total_aum_usd::DOUBLE PRECISION AS total_aum_usd,
            itp_count,
            supply_count
        FROM tvl_history
        WHERE snapshot_ts > NOW() - make_interval(secs => $1)
        ORDER BY snapshot_ts ASC
        LIMIT 2000
        "#,
    )
    .bind(secs)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(data) => Ok(Json(serde_json::json!({"series": data}))),
        Err(e) => {
            tracing::error!(error = %e, "dtf_tvl query failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct HourlyBucket {
    bucket: DateTime<Utc>,
    count: i64,
}

async fn dtf_orders_per_hour(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> impl IntoResponse {
    check_auth(&headers, &state.token)?;
    let secs = range_to_secs(q.range.as_deref().unwrap_or("24h"));

    let rows = sqlx::query_as::<_, HourlyBucket>(
        r#"
        WITH buckets AS (
            SELECT generate_series(
                date_trunc('hour', NOW() - make_interval(secs => $1)),
                date_trunc('hour', NOW()),
                INTERVAL '1 hour'
            ) AS bucket
        ),
        placed AS (
            SELECT
                date_trunc('hour', order_timestamp) AS bucket,
                COUNT(*) AS cnt
            FROM trades
            WHERE order_timestamp > NOW() - make_interval(secs => $1)
            GROUP BY 1
        )
        SELECT
            b.bucket,
            COALESCE(p.cnt, 0)::BIGINT AS count
        FROM buckets b
        LEFT JOIN placed p ON p.bucket = b.bucket
        ORDER BY b.bucket ASC
        "#,
    )
    .bind(secs)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(data) => Ok(Json(serde_json::json!({"series": data}))),
        Err(e) => {
            tracing::error!(error = %e, "dtf_orders_per_hour query failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
