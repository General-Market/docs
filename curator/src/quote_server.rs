//! Axum HTTP server for the Quote API
//!
//! POST /api/lending/quote — returns lending terms + bundler calldata
//!
//! Authentication via X-API-Key header (optional, configurable).
//! Rate limiting per API key (10 req/min default).
//! Before returning a quote, computes SERM rate and pushes to CuratorRateIRM if changed.

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
    routing::post,
    Json, Router,
};
use ethers::types::{Address, U256};
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
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
}

/// Run the Quote API HTTP server
pub async fn run_quote_api_server(
    listen_addr: &str,
    api_keys: Vec<String>,
    market_configs_path: Option<String>,
    shared_state: SharedCuratorState,
    rate_push_config: Option<RatePushConfig>,
    shutdown: Arc<AtomicBool>,
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
    });

    let app = Router::new()
        .route("/api/lending/quote", post(handle_quote))
        .route("/health", axum::routing::get(handle_health))
        .with_state(state);

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
