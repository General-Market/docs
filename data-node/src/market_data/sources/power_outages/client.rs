//! US Power Outages (ODIN) source implementing MarketDataSource
//!
//! Tracks power outage counts by US state using the PowerOutage.us API.
//! Each state is an asset; its value is the number of customers without power.
//!
//! Assets are static -- defined in config/power_outages.json.
//!
//! API: https://poweroutage.us/api/web/states?key=DEFAULT&countryid=US
//! Auth: None (public API with DEFAULT key)
//! Rate limit: Conservative 30 req/5min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/power_outages.json");
const API_URL: &str = "https://poweroutage.us/api/web/states?key=DEFAULT&countryid=US";
const USER_AGENT: &str = "IndexDataNode/1.0 (market data indexer; contact@agiarena.org)";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level response from PowerOutage.us states endpoint
#[derive(Debug, Deserialize)]
struct StatesResponse {
    data: Vec<StateOutage>,
}

/// Per-state outage data from the API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StateOutage {
    /// Two-letter state code (e.g. "CA", "NY")
    state_id: Option<String>,
    /// Number of customers currently without power
    customers_out: Option<u64>,
    /// Total number of tracked customers in this state
    customers_tracked: Option<u64>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct PowerOutagesMarketSource {
    http: SourceHttpClient,
}

impl PowerOutagesMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("US Power Outages (ODIN) source initialized");
        Ok(Self { http })
    }

    /// Fetch all state outage data in a single request
    async fn fetch_all_states(&self) -> Result<StatesResponse, SourceError> {
        self.http
            .get_json_with_headers::<StatesResponse>(
                API_URL,
                &[
                    ("User-Agent", USER_AGENT),
                    ("Accept", "application/json"),
                ],
            )
            .await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for PowerOutagesMarketSource {
    fn source_id(&self) -> &'static str {
        "power_outages"
    }

    fn display_name(&self) -> &'static str {
        "US Power Outages (ODIN)"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(300),
            }],
        }
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::STATUS
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "Power Outages fetch_assets: {} states loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to build reverse lookup: state_code -> (asset_id, symbol)
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let mut state_to_asset: HashMap<String, (String, String)> = HashMap::new();
        for entry in &entries {
            state_to_asset.insert(
                entry.api_ref.to_uppercase(),
                (entry.asset_id.clone(), entry.symbol.clone()),
            );
        }

        // Build a set of requested asset IDs for filtering
        let requested: std::collections::HashSet<&String> = asset_ids.iter().collect();

        // Fetch all states in a single API call
        let states = match self.fetch_all_states().await {
            Ok(resp) => resp.data,
            Err(e) => {
                warn!("Failed to fetch PowerOutage.us states: {:?}", e);
                Vec::new()
            }
        };

        // Index API results by state code
        let mut outage_by_state: HashMap<String, &StateOutage> = HashMap::new();
        for state in &states {
            if let Some(ref state_id) = state.state_id {
                outage_by_state.insert(state_id.to_uppercase(), state);
            }
        }

        debug!(
            "PowerOutage.us returned {} states, matching against {} requested assets",
            states.len(),
            asset_ids.len()
        );

        let mut results = Vec::with_capacity(asset_ids.len());

        for (state_code, (asset_id, symbol)) in &state_to_asset {
            // Only return prices for requested asset IDs
            if !requested.contains(asset_id) {
                continue;
            }

            let (customers_out, customers_tracked) = match outage_by_state.get(state_code) {
                Some(state) => (
                    state.customers_out.unwrap_or(0),
                    state.customers_tracked,
                ),
                None => {
                    // State not in API response -- report 0 outages
                    debug!("No outage data for state {}, defaulting to 0", state_code);
                    (0, None)
                }
            };

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.clone(),
                value: Decimal::from(customers_out),
                prev_close: None,
                change_pct: None,
                volume_24h: customers_tracked.map(Decimal::from),
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from Power Outages ({} states from API)",
            results.len(),
            asset_ids.len(),
            states.len(),
        );
        Ok(results)
    }
}
