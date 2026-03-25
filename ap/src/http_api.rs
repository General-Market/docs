//! HTTP API handlers for the AP service (health, prices, NAV).

use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};

use ap::metrics::APMetrics;

// -- Shared state for axum handlers --
#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) metrics: Arc<APMetrics>,
    pub(crate) data_node_url: Option<String>,
}

/// CORS headers middleware layer — applies to every response.
pub(crate) fn cors_layer() -> tower_http::cors::CorsLayer {
    tower_http::cors::CorsLayer::very_permissive()
}

/// GET /health — comprehensive health details (AC #3, #7)
pub(crate) async fn handle_health(State(state): State<AppState>) -> impl IntoResponse {
    let health_details = state.metrics.get_health_details().await;

    let status_code = match health_details.status.as_str() {
        "unhealthy" => StatusCode::SERVICE_UNAVAILABLE,
        _ => StatusCode::OK,
    };

    (status_code, Json(serde_json::to_value(&health_details).unwrap_or_default()))
}

/// GET /prices — delegate to data-node backend
pub(crate) async fn handle_prices(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let Some(ref ph_url) = state.data_node_url else {
        return Json(serde_json::json!({
            "error": "Price endpoint requires --data-node-url.",
            "prices": {}, "count": 0
        }));
    };

    // Forward query params to data-node
    let query_suffix = if params.is_empty() {
        String::new()
    } else {
        let qs: Vec<String> = params.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
        format!("?{}", qs.join("&"))
    };
    let url = format!("{}/fast-prices{}", ph_url, query_suffix);

    match reqwest::get(&url).await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => Json(body),
            Err(e) => Json(serde_json::json!({
                "error": format!("Failed to read data-node response: {}", e),
                "prices": {}, "count": 0
            })),
        },
        Err(e) => Json(serde_json::json!({
            "error": format!("Failed to reach data-node backend: {}", e),
            "prices": {}, "count": 0
        })),
    }
}

/// GET /nav — delegate NAV computation to data-node
pub(crate) async fn handle_nav(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let default_itp = "0x0000000000000000000000000000000000000000000000000000000000000001".to_string();
    let itp_id_hex = params.get("itpId").unwrap_or(&default_itp);

    let Some(ref ph_url) = state.data_node_url else {
        return Json(serde_json::json!({
            "error": "NAV endpoint requires --data-node-url.",
            "nav": "0", "nav_usd": 0.0, "priced_count": 0, "total_count": 0
        }));
    };

    let url = format!("{}/itp-price?itp_id={}", ph_url, itp_id_hex);
    match reqwest::get(&url).await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => {
                let nav_str = body.get("nav").and_then(|v| v.as_str()).unwrap_or("0");
                let nav_display = body.get("nav_display").and_then(|v| v.as_str()).unwrap_or("0.0");
                let nav_usd: f64 = nav_display.parse().unwrap_or(0.0);
                let assets_priced = body.get("assets_priced").and_then(|v| v.as_u64()).unwrap_or(0);
                let assets_total = body.get("assets_total").and_then(|v| v.as_u64()).unwrap_or(0);
                Json(serde_json::json!({
                    "nav": nav_str,
                    "nav_usd": nav_usd,
                    "priced_count": assets_priced,
                    "total_count": assets_total,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "source": "data-node"
                }))
            }
            Err(e) => Json(serde_json::json!({
                "error": format!("Failed to parse data-node response: {}", e),
                "nav": "0", "nav_usd": 0.0, "priced_count": 0, "total_count": 0
            })),
        },
        Err(e) => Json(serde_json::json!({
            "error": format!("Failed to reach data-node: {}", e),
            "nav": "0", "nav_usd": 0.0, "priced_count": 0, "total_count": 0
        })),
    }
}
