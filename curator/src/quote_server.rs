//! Axum HTTP server for the Quote API
//!
//! POST /api/lending/quote — returns lending terms + bundler calldata
//!
//! Authentication via X-API-Key header (optional, configurable).
//! Rate limiting per API key (10 req/min default).
//! Before returning a quote, computes SERM rate and pushes to CuratorRateIRM if changed.

use crate::allocator::{BotCommand, BotCommandSender};
use crate::market_config::MarketRegistry;
use crate::quote::{parse_quote_request, QuoteEngine, QuoteError, QuoteRequest, RateLimiter};
use crate::rate_pusher::RatePusher;
use crate::serm::{MarketRateInput, SermEngine};
use crate::shared_state::SharedCuratorState;
use crate::tier_config::RiskTier;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use common::runtime::config::SharedConfig;
use ethers::types::{Address, U256};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{oneshot, RwLock};
use tracing::{info, warn};

/// Configuration for rate pushing (optional)
pub struct RatePushConfig {
    pub rpc_url: String,
    pub private_key: String,
    pub irm_address: Address,
}

/// State shared across all axum handlers
struct QuoteApiState {
    market_registry: MarketRegistry,
    rate_limiter: RwLock<RateLimiter>,
    api_keys: Vec<String>,
    shared_state: SharedCuratorState,
    serm: SermEngine,
    rate_pusher: Option<RatePusher>,
    /// Channel to the AllocationBot for synchronous prepare requests.
    /// None when the allocator task didn't spin up (incomplete config).
    prepare_tx: Option<BotCommandSender>,
}

/// Run the Quote API HTTP server
pub async fn run_quote_api_server(
    listen_addr: &str,
    api_keys: Vec<String>,
    market_configs_path: Option<String>,
    shared_state: SharedCuratorState,
    rate_push_config: Option<RatePushConfig>,
    shutdown: Arc<AtomicBool>,
    shared_config: Option<SharedConfig>,
    admin_token: Option<String>,
    prepare_tx: Option<BotCommandSender>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Load market registry
    let registry = if let Some(path) = market_configs_path {
        MarketRegistry::from_file(&path).unwrap_or_else(|e| {
            warn!(error = %e, "Failed to load market configs, using empty registry");
            MarketRegistry::new()
        })
    } else {
        info!("No market configs path, using empty registry");
        MarketRegistry::new()
    };

    // Initialize rate pusher if config provided
    let rate_pusher = if let Some(cfg) = rate_push_config {
        match RatePusher::new(&cfg.rpc_url, &cfg.private_key, cfg.irm_address) {
            Ok(pusher) => {
                info!(irm = ?cfg.irm_address, "Rate pusher initialized for quote API");
                Some(pusher)
            }
            Err(e) => {
                warn!(error = %e, "Failed to initialize rate pusher, quotes will use default rate");
                None
            }
        }
    } else {
        info!("No rate push config, quotes will use default rate");
        None
    };

    let state = Arc::new(QuoteApiState {
        market_registry: registry,
        rate_limiter: RwLock::new(RateLimiter::new(10, Duration::from_secs(60))),
        api_keys,
        shared_state,
        serm: SermEngine::with_defaults(),
        rate_pusher,
        prepare_tx,
    });

    let mut app = Router::new()
        .route("/api/lending/quote", post(handle_quote))
        .route("/api/lending/prepare", post(handle_prepare))
        .route("/health", get(handle_health))
        .route("/health/live", get(handle_live))
        .route("/health/ready", get(handle_ready))
        .with_state(state);

    // Merge admin routes (hot-reload, config introspection, log-level) if SharedConfig available
    if let Some(sc) = shared_config {
        let admin = common::runtime::admin::admin_router(sc, admin_token);
        app = app.merge(admin);
        info!("Admin routes merged into quote server (/admin/reload, /admin/config, /admin/health, /admin/log-level)");
    }

    let listener = tokio::net::TcpListener::bind(listen_addr).await?;
    info!(addr = %listen_addr, "Quote API server listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            loop {
                if shutdown.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        })
        .await?;

    info!("Quote API server stopped");
    Ok(())
}

/// Health check endpoint
async fn handle_health() -> impl IntoResponse {
    Json(json!({ "status": "ok", "service": "curator-quote-api" }))
}

/// GET /health/live — liveness probe, always 200 while the process answers.
async fn handle_live() -> impl IntoResponse {
    Json(json!({ "status": "live" }))
}

/// GET /health/ready — readiness: 503 if no successful on-chain read in
/// the last five minutes. A curator that cannot reach the chain is not
/// curating anything; it is simply logging.
async fn handle_ready(
    State(state): State<Arc<QuoteApiState>>,
) -> impl IntoResponse {
    const STALE_ETH_CALL_SECS: u64 = 300;
    let age = state.shared_state.eth_call_age_secs().await;
    let mut reasons: Vec<String> = Vec::new();
    if age == u64::MAX {
        reasons.push("no successful on-chain read since start".into());
    } else if age > STALE_ETH_CALL_SECS {
        reasons.push(format!(
            "last successful eth_call {}s ago (> {}s)",
            age, STALE_ETH_CALL_SECS
        ));
    }
    if reasons.is_empty() {
        (
            StatusCode::OK,
            Json(json!({
                "status": "ready",
                "last_eth_call_age_secs": age,
            })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "not_ready",
                "reasons": reasons,
                "last_eth_call_age_secs": if age == u64::MAX { -1i64 } else { age as i64 },
            })),
        )
    }
}

/// POST /api/lending/quote
async fn handle_quote(
    State(state): State<Arc<QuoteApiState>>,
    headers: HeaderMap,
    Json(request): Json<QuoteRequest>,
) -> impl IntoResponse {
    // API key authentication (if keys configured)
    if !state.api_keys.is_empty() {
        let api_key = headers
            .get("x-api-key")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if !state.api_keys.contains(&api_key.to_string()) {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Invalid or missing API key",
                    "code": "UNAUTHORIZED"
                })),
            );
        }
    }

    // Rate limiting (use API key or remote IP as key)
    let rate_key = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
        .to_string();

    {
        let mut limiter = state.rate_limiter.write().await;
        if let Err(e) = limiter.check(&rate_key) {
            let retry_after = match &e {
                QuoteError::RateLimited { retry_after } => *retry_after,
                _ => 60,
            };
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": e.to_string(),
                    "code": "RATE_LIMITED",
                    "retryAfter": retry_after
                })),
            );
        }
    }

    // Parse and validate request
    let (itp_address, collateral_amount, borrow_amount) = match parse_quote_request(&request) {
        Ok(parsed) => parsed,
        Err(e) => {
            return (
                StatusCode::from_u16(e.status_code()).unwrap_or(StatusCode::BAD_REQUEST),
                Json(json!({
                    "error": e.to_string(),
                    "code": e.error_code()
                })),
            );
        }
    };

    // Look up market
    let market_config = match state.market_registry.get_by_itp(&itp_address) {
        Some(config) => config.clone(),
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "error": format!("Market not found for ITP {}", request.itp_address),
                    "code": "MARKET_NOT_FOUND"
                })),
            );
        }
    };

    // Get crisis level from shared state
    let market_id_hex = format!("0x{}", hex::encode(market_config.market_id));
    let crisis_level = state
        .shared_state
        .get_crisis_level(&market_id_hex)
        .await;

    // Get cached BLS data
    let bls_data = match state.shared_state.get_bls_data().await {
        Some(data) => data,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "error": "Oracle data not yet available (waiting for first BLS collection)",
                    "code": "ORACLE_UNAVAILABLE"
                })),
            );
        }
    };

    // Check BLS freshness (> 5 min is considered stale for quoting)
    let oracle_already_fresh = bls_data.cached_at.elapsed() < Duration::from_secs(300);

    // Compute rate via SERM and push to CuratorRateIRM if changed
    let rate_per_second = compute_and_push_rate(
        &state.serm,
        state.rate_pusher.as_ref(),
        &market_config.market_id,
        borrow_amount,
    )
    .await;

    // Build quote
    match QuoteEngine::build_quote(
        &market_config,
        collateral_amount,
        borrow_amount,
        bls_data.price,
        rate_per_second,
        bls_data.price,
        bls_data.timestamp,
        bls_data.cycle_number,
        &bls_data.signature,
        bls_data.bitmask,
        oracle_already_fresh,
        crisis_level,
    ) {
        Ok(quote) => {
            let mut response = serde_json::to_value(&quote).unwrap();
            // Include crisis level in response for frontend
            response
                .as_object_mut()
                .unwrap()
                .insert("crisisLevel".to_string(), json!(format!("{:?}", crisis_level)));
            (StatusCode::OK, Json(response))
        }
        Err(e) => {
            let status = StatusCode::from_u16(e.status_code()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
            (
                status,
                Json(json!({
                    "error": e.to_string(),
                    "code": e.error_code()
                })),
            )
        }
    }
}

/// Compute SERM rate for a market and push to CuratorRateIRM if changed.
/// Falls back to a default 5% APR rate if SERM inputs are unavailable.
async fn compute_and_push_rate(
    serm: &SermEngine,
    rate_pusher: Option<&RatePusher>,
    market_id: &[u8; 32],
    borrow_amount: U256,
) -> U256 {
    // Default 5% APR as per-second: 5e16 / 31_536_000
    let default_rate = U256::from(1_585_489_600u64);

    // Build minimal SERM input for this market
    // In a full integration, we'd read total_borrowed and composition from on-chain.
    // For now, use borrow_amount as total_borrowed and empty composition (yields base rate only).
    let input = MarketRateInput {
        market_id: *market_id,
        total_borrowed: borrow_amount,
        risk_tier: RiskTier::A,
        composition: vec![],
    };

    // Use conservative defaults: 50% vault utilization, no stress, no concentration
    let vault_total = borrow_amount * U256::from(2u64); // implies ~50% util
    let global_util = SermEngine::compute_global_utilization(borrow_amount, vault_total);
    let asset_prices = HashMap::new();
    let global_exposures = HashMap::new();

    let output = serm.compute_rate(&input, global_util, &asset_prices, &global_exposures, vault_total);
    let computed_rate = output.rate_per_second;

    // If rate is zero (e.g., zero borrow), fall back to default
    if computed_rate.is_zero() {
        return default_rate;
    }

    // Push to CuratorRateIRM if rate pusher is available and rate changed
    if let Some(pusher) = rate_pusher {
        // Threshold: 50 bps (0.5%) change triggers push
        match pusher.push_rate_if_changed(*market_id, computed_rate, 50).await {
            Ok(Some(tx_hash)) => {
                info!(
                    market = hex::encode(market_id),
                    tx = ?tx_hash,
                    rate_per_sec = %computed_rate,
                    "Pushed SERM rate to CuratorRateIRM before quote"
                );
            }
            Ok(None) => {
                // Rate unchanged, no push needed
            }
            Err(e) => {
                warn!(
                    market = hex::encode(market_id),
                    error = %e,
                    "Failed to push rate to CuratorRateIRM, using computed rate anyway"
                );
            }
        }
    }

    computed_rate
}

// ============================================================================
// Prepare endpoint — synchronous reallocate-on-borrow
// ============================================================================

/// Request body for POST /api/lending/prepare
#[derive(Debug, Deserialize)]
pub struct PrepareRequest {
    /// Hex-encoded bytes32 market id (with or without 0x prefix)
    #[serde(rename = "marketId")]
    pub market_id: String,
    /// Borrow amount in USDC base units (decimal string)
    #[serde(rename = "borrowAmount")]
    pub borrow_amount: String,
}

fn parse_market_id(s: &str) -> Option<[u8; 32]> {
    let h = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(h).ok()?;
    if bytes.len() != 32 {
        return None;
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Some(out)
}

/// POST /api/lending/prepare
///
/// Asks the allocator to reallocate enough idle vault liquidity into
/// `marketId` to cover a pending borrow of `borrowAmount`. Returns once
/// the reallocate transaction has been confirmed (or immediately if no
/// reallocation was necessary).
async fn handle_prepare(
    State(state): State<Arc<QuoteApiState>>,
    headers: HeaderMap,
    Json(request): Json<PrepareRequest>,
) -> impl IntoResponse {
    // API key authentication (same gate as /quote).
    if !state.api_keys.is_empty() {
        let api_key = headers
            .get("x-api-key")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if !state.api_keys.contains(&api_key.to_string()) {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Invalid or missing API key",
                    "code": "UNAUTHORIZED"
                })),
            );
        }
    }

    // Rate limit — share the same bucket as /quote so a misbehaving client
    // can't drain the reallocate signer with prepare spam either.
    let rate_key = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
        .to_string();
    {
        let mut limiter = state.rate_limiter.write().await;
        if let Err(e) = limiter.check(&rate_key) {
            let retry_after = match &e {
                QuoteError::RateLimited { retry_after } => *retry_after,
                _ => 60,
            };
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": e.to_string(),
                    "code": "RATE_LIMITED",
                    "retryAfter": retry_after
                })),
            );
        }
    }

    // Allocator must be running.
    let tx = match &state.prepare_tx {
        Some(t) => t.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "error": "Allocator task not running; prepare unavailable",
                    "code": "ALLOCATOR_UNAVAILABLE"
                })),
            );
        }
    };

    let market_id = match parse_market_id(&request.market_id) {
        Some(id) => id,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": format!("Invalid marketId: {}", request.market_id),
                    "code": "INVALID_MARKET_ID"
                })),
            );
        }
    };

    let borrow_amount = match U256::from_dec_str(&request.borrow_amount) {
        Ok(v) if !v.is_zero() => v,
        Ok(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "borrowAmount must be > 0",
                    "code": "INVALID_BORROW_AMOUNT"
                })),
            );
        }
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": format!("Invalid borrowAmount: {}", request.borrow_amount),
                    "code": "INVALID_BORROW_AMOUNT"
                })),
            );
        }
    };

    let (resp_tx, resp_rx) = oneshot::channel();
    let cmd = BotCommand::Prepare {
        target_market: market_id,
        borrow_amount,
        response: resp_tx,
    };

    if let Err(e) = tx.send(cmd).await {
        warn!(error = %e, "Failed to enqueue prepare command");
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "Allocator command channel closed",
                "code": "ALLOCATOR_UNAVAILABLE"
            })),
        );
    }

    // Wait for the allocator to reply. Worst case: a periodic cycle is
    // already in flight, so allow up to ~90s before timing out.
    let result = match tokio::time::timeout(Duration::from_secs(90), resp_rx).await {
        Ok(Ok(r)) => r,
        Ok(Err(_)) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": "Allocator dropped prepare response",
                    "code": "ALLOCATOR_INTERNAL"
                })),
            );
        }
        Err(_) => {
            return (
                StatusCode::GATEWAY_TIMEOUT,
                Json(json!({
                    "error": "Prepare timed out waiting for allocator",
                    "code": "PREPARE_TIMEOUT"
                })),
            );
        }
    };

    match result {
        Ok(None) => (
            StatusCode::OK,
            Json(json!({
                "alreadyFunded": true,
                "txHash": null,
                "blockNumber": null
            })),
        ),
        Ok(Some(tx_hash)) => (
            StatusCode::OK,
            Json(json!({
                "alreadyFunded": false,
                "txHash": format!("{:?}", tx_hash),
                "blockNumber": null
            })),
        ),
        Err(e) => {
            warn!(error = %e, market = %request.market_id, "Prepare failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": e.to_string(),
                    "code": "PREPARE_FAILED"
                })),
            )
        }
    }
}
