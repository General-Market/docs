use axum::{
    Router, Json,
    extract::{State, Query},
    http::StatusCode,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use super::config::SharedConfig;

/// Opaque log-level reload trait -- avoids exposing complex layer stack type.
/// Implemented in common/src/logging.rs via ReloadHandleImpl.
pub trait LogLevelReloader: Send + Sync {
    fn set_level(&self, new_filter: tracing_subscriber::EnvFilter) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}

pub type LogReloadHandle = Arc<dyn LogLevelReloader>;

#[derive(Clone)]
pub struct AdminState {
    pub config: SharedConfig,
    pub admin_token: Option<String>,
    pub log_reload_handle: Option<LogReloadHandle>,
}

#[derive(Deserialize)]
pub struct ReloadParams {
    pub dry_run: Option<bool>,
}

#[derive(Serialize)]
pub struct ReloadResponse {
    pub status: String,
    pub diffs: Vec<String>,
    pub nonce_changed: bool,
    pub dry_run: bool,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub deployment_nonce: u64,
    pub config_loaded_at: String,
    pub rpc_url: String,
    pub deployment_file: String,
    pub contracts: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
pub struct LogLevelRequest {
    pub level: String,
}

#[derive(Serialize)]
pub struct LogLevelResponse {
    pub status: String,
    pub level: String,
}

/// Create admin router. Merge into service's existing axum Router.
pub fn admin_router(config: SharedConfig, admin_token: Option<String>) -> Router {
    admin_router_with_log_handle(config, admin_token, None)
}

/// Create admin router with optional log-level reload handle.
pub fn admin_router_with_log_handle(
    config: SharedConfig,
    admin_token: Option<String>,
    log_reload_handle: Option<LogReloadHandle>,
) -> Router {
    let state = AdminState { config, admin_token, log_reload_handle };
    Router::new()
        .route("/admin/reload", post(handle_reload))
        .route("/admin/config", get(handle_config))
        .route("/admin/health", get(handle_health))
        .route("/admin/log-level", post(handle_log_level))
        .layer(axum::middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

/// Auth middleware -- applied as a layer on the admin router.
/// Requires `x-admin-token` header to match the configured admin token.
/// If no admin token is configured, rejects all requests (fail-closed).
async fn auth_middleware(
    State(state): State<AdminState>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, StatusCode> {
    // If no admin token configured, reject all requests (fail-closed)
    let Some(ref token) = state.admin_token else {
        return Err(StatusCode::FORBIDDEN);
    };

    let provided = request.headers()
        .get("x-admin-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != token {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(request).await)
}

async fn handle_reload(
    State(state): State<AdminState>,
    Query(params): Query<ReloadParams>,
) -> Result<Json<ReloadResponse>, StatusCode> {
    let dry_run = params.dry_run.unwrap_or(false);
    let old = state.config.load();

    match old.reload().await {
        Ok((new_config, nonce_changed)) => {
            let diffs = old.diff(&new_config);

            if !dry_run && !diffs.is_empty() {
                state.config.store(Arc::new(new_config));
            }

            Ok(Json(ReloadResponse {
                status: if diffs.is_empty() { "no_changes".into() } else { "reloaded".into() },
                diffs,
                nonce_changed,
                dry_run,
            }))
        }
        Err(e) => {
            tracing::error!("Reload failed: {e}");
            Ok(Json(ReloadResponse {
                status: format!("error: {e}"),
                diffs: vec![],
                nonce_changed: false,
                dry_run,
            }))
        }
    }
}

async fn handle_config(
    State(state): State<AdminState>,
) -> Json<serde_json::Value> {
    let config = state.config.load();
    Json(serde_json::to_value(&*config).unwrap_or_default())
}

async fn handle_health(
    State(state): State<AdminState>,
) -> Json<HealthResponse> {
    let config = state.config.load();
    Json(HealthResponse {
        deployment_nonce: config.deployment_nonce,
        config_loaded_at: config.loaded_at.to_rfc3339(),
        rpc_url: config.rpc_url.clone(),
        deployment_file: config.deployment_file_path.display().to_string(),
        contracts: config.deployment.contracts.clone(),
    })
}

async fn handle_log_level(
    State(state): State<AdminState>,
    Json(body): Json<LogLevelRequest>,
) -> Result<Json<LogLevelResponse>, StatusCode> {
    let Some(ref handle) = state.log_reload_handle else {
        return Err(StatusCode::NOT_IMPLEMENTED);
    };

    let new_filter = body.level.parse::<tracing_subscriber::EnvFilter>()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    handle.set_level(new_filter)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tracing::info!("Log level changed to: {}", body.level);

    Ok(Json(LogLevelResponse {
        status: "updated".into(),
        level: body.level,
    }))
}
