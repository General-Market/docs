//! HTTP API handlers for the oracle node (health, ready, nav-sign, registry-sync).

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use oracle::bootstrap::OracleMetrics;
use oracle::p2p::TcpP2PTransport;
use oracle::{
    handle_nav_sign_request, NavCalculator, NavSignHandler, RegistrySyncCache, StubItpRegistryReader,
};
use common::runtime::config::SharedConfig;
use common::runtime::admin::admin_router;
use chrono::Utc;

/// Type alias for the NAV sign handler used in the oracle node
pub(crate) type OracleNavSignHandler = NavSignHandler<Box<dyn NavCalculator>, StubItpRegistryReader>;

/// Shared state for the oracle HTTP API (health, nav-sign, registry-sync, ready).
/// All oracle endpoints and optional Vision endpoints share one axum server.
pub(crate) struct OracleApiState {
    pub node_id: u32,
    pub p2p_transport: Option<Arc<TcpP2PTransport>>,
    pub metrics: Arc<OracleMetrics>,
    pub p2p_metrics: Arc<oracle::p2p::P2PMetrics>,
    pub registry_sync_cache: Option<RegistrySyncCache>,
    pub nav_sign_handler: Option<Arc<OracleNavSignHandler>>,
    /// Number of oracles in the network (for threshold computation)
    pub num_oracles: u8,
    /// Whether this node has a BLS keypair loaded
    pub bls_keypair_loaded: bool,
    /// Epoch-millis timestamp of last successful RPC call (updated by consensus loop)
    pub last_rpc_success_ms: Arc<std::sync::atomic::AtomicU64>,
    /// Hot-reloadable runtime config (deployment addresses, URLs, tuning)
    pub runtime_config: SharedConfig,
    /// True while a deployment flush is in progress — handlers should return 503
    pub flushing: Arc<AtomicBool>,
}

/// GET /health — oracle health check with metrics
pub(crate) async fn axum_health_handler(
    axum::extract::State(state): axum::extract::State<Arc<OracleApiState>>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let (p2p_mode, connected_peers) = if let Some(ref transport) = state.p2p_transport {
        let count = transport.connected_peer_count().await;
        ("tcp", count)
    } else {
        ("mock", 0)
    };

    let m = &state.metrics;
    let is_leader = m.is_leader.load(Ordering::Relaxed);
    let elections_count = m.elections_count.load(Ordering::Relaxed);
    let tenure_cycles = m.tenure_cycles.load(Ordering::Relaxed);
    let consensus_rounds = m.consensus_rounds_total.load(Ordering::Relaxed);
    let consensus_success = m.consensus_success_total.load(Ordering::Relaxed);
    let consensus_failed = m.consensus_failed_total.load(Ordering::Relaxed);
    let signatures_collected = m.signatures_collected_total.load(Ordering::Relaxed);
    let last_consensus_ms = m.last_consensus_time_ms.load(Ordering::Relaxed);
    let consensus_in_progress = m.consensus_in_progress.load(Ordering::Relaxed);

    let mut heartbeat = serde_json::Map::new();
    if let Ok(guard) = m.heartbeat_metrics.read() {
        if let Some(ref hb) = *guard {
            heartbeat.insert("sent_total".into(), hb.get_heartbeats_sent().into());
            heartbeat.insert("received_total".into(), hb.get_heartbeats_received().into());
            heartbeat.insert("peers_healthy".into(), hb.get_peers_healthy().into());
            heartbeat.insert("peers_unhealthy".into(), hb.get_peers_unhealthy().into());
            heartbeat.insert("kick_proposals".into(), hb.get_kick_votes_proposed().into());
        }
    }

    let (health_status, http_status) = m.health_status(connected_peers);
    let last_cycle_duration_ms = m.last_cycle_duration_ms.load(Ordering::Relaxed);
    let orders_processed = m.orders_processed_last_60s.load(Ordering::Relaxed);
    let pending_orders = m.pending_order_count.load(Ordering::Relaxed);

    let mut body = serde_json::json!({
        "status": health_status,
        "node_id": state.node_id,
        "p2p_mode": p2p_mode,
        "connected_peers": connected_peers,
        "is_leader": is_leader,
        "leader_elections_count": elections_count,
        "leader_tenure_cycles": tenure_cycles,
        "consensus": {
            "rounds_total": consensus_rounds,
            "success_total": consensus_success,
            "failed_total": consensus_failed,
            "signatures_collected": signatures_collected,
            "last_time_ms": last_consensus_ms,
            "in_progress": consensus_in_progress,
        },
        "orders_processed_last_60s": orders_processed,
        "last_cycle_duration_ms": last_cycle_duration_ms,
        "pending_order_count": pending_orders,
        "timestamp": Utc::now().to_rfc3339(),
    });
    if !heartbeat.is_empty() {
        body.as_object_mut().unwrap().insert("heartbeat".into(), serde_json::Value::Object(heartbeat));
    }

    // P2P subsystem metrics (rate limiting, bans, WAL, equivocations, etc.)
    let p2p_snap = state.p2p_metrics.snapshot();
    body.as_object_mut().unwrap().insert(
        "p2p".into(),
        serde_json::to_value(&p2p_snap).unwrap_or_default(),
    );

    let status = if http_status == 200 { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

/// GET /ready — readiness check for deployment orchestration
///
/// Returns 200 OK if the node can participate in consensus (if unpaused):
/// - Enough peers connected (>= threshold - 1)
/// - BLS keypair loaded
/// - Chain reader operational (last RPC success < 30s ago)
/// - Registry sync caught up (if enabled)
///
/// Returns 503 with JSON body indicating which checks failed.
/// Does NOT check consensusPaused — that is intentional to avoid deadlocking
/// the deployment ceremony (step 7 waits for /ready, step 8 unpauses).
pub(crate) async fn axum_ready_handler(
    axum::extract::State(state): axum::extract::State<Arc<OracleApiState>>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let threshold = oracle::consensus::aggregator::compute_threshold(state.num_oracles as usize);
    let required_peers = if threshold > 0 { threshold - 1 } else { 0 };

    // Check 1: peer count
    let connected_peers = if let Some(ref transport) = state.p2p_transport {
        transport.connected_peer_count().await
    } else {
        0
    };
    let peers_ok = connected_peers >= required_peers;

    // Check 2: BLS keypair
    let bls_ok = state.bls_keypair_loaded;

    // Check 3: chain reader (last RPC success < 30s ago)
    let last_rpc_epoch_ms = state.last_rpc_success_ms.load(Ordering::Relaxed);
    let now_epoch_ms = Utc::now().timestamp_millis() as u64;
    let last_success_ms_ago = if last_rpc_epoch_ms > 0 {
        now_epoch_ms.saturating_sub(last_rpc_epoch_ms)
    } else {
        u64::MAX // never succeeded
    };
    let chain_reader_ok = last_success_ms_ago < 30_000;

    // Check 4: registry sync (if enabled)
    let (registry_ok, registry_caught_up) = if let Some(ref cache) = state.registry_sync_cache {
        let guard = cache.read().await;
        if guard.is_some() {
            (true, true)
        } else {
            (false, false)
        }
    } else {
        // Registry sync not enabled — pass the check (single-oracle or not configured)
        (true, true)
    };

    let all_ok = peers_ok && bls_ok && chain_reader_ok && registry_ok;
    let status_code = if all_ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };

    let body = serde_json::json!({
        "ready": all_ok,
        "checks": {
            "peers": {
                "ok": peers_ok,
                "connected": connected_peers,
                "required": required_peers,
            },
            "bls_keypair": {
                "ok": bls_ok,
            },
            "chain_reader": {
                "ok": chain_reader_ok,
                "last_success_ms_ago": if last_rpc_epoch_ms > 0 { last_success_ms_ago } else { 0 },
            },
            "registry_sync": {
                "ok": registry_ok,
                "caught_up": registry_caught_up,
            },
        }
    });

    (status_code, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

/// GET /api/nav-sign — BLS-signed NAV price for an ITP
pub(crate) async fn axum_nav_sign_handler(
    axum::extract::State(state): axum::extract::State<Arc<OracleApiState>>,
    axum::extract::RawQuery(query): axum::extract::RawQuery,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let Some(ref handler) = state.nav_sign_handler else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"NAV sign API not enabled"}"#.to_string(),
        ).into_response();
    };

    let query_str = query.as_deref().unwrap_or("");
    let (status, content_type, body) = handle_nav_sign_request(handler.as_ref(), query_str).await;
    let sc = StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (sc, [(header::CONTENT_TYPE, content_type)], body).into_response()
}

/// GET /api/registry-sync — registry sync state
pub(crate) async fn axum_registry_sync_handler(
    axum::extract::State(state): axum::extract::State<Arc<OracleApiState>>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let Some(ref cache) = state.registry_sync_cache else {
        return (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"Registry sync not enabled"}"#.to_string(),
        ).into_response();
    };

    let guard = cache.read().await;
    if let Some(ref sync_state) = *guard {
        let json = sync_state.to_json_response();
        (StatusCode::OK, [(header::CONTENT_TYPE, "application/json")], json.to_string()).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"No sync data available"}"#.to_string(),
        ).into_response()
    }
}

/// GET / — alias for health check
pub(crate) async fn axum_root_health_handler(
    state: axum::extract::State<Arc<OracleApiState>>,
) -> axum::response::Response {
    axum_health_handler(state).await
}

/// Build the core oracle API router (health, ready, nav-sign, registry-sync, admin).
pub(crate) fn oracle_api_routes(state: Arc<OracleApiState>) -> axum::Router {
    let admin = admin_router(
        state.runtime_config.clone(),
        std::env::var("ADMIN_TOKEN").ok(),
    );

    axum::Router::new()
        .route("/health", axum::routing::get(axum_health_handler))
        .route("/ready", axum::routing::get(axum_ready_handler))
        .route("/", axum::routing::get(axum_root_health_handler))
        .route("/api/nav-sign", axum::routing::get(axum_nav_sign_handler))
        .route("/api/registry-sync", axum::routing::get(axum_registry_sync_handler))
        .with_state(state)
        .merge(admin)
}
