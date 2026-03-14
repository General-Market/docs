use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;
use tracing::debug;

use crate::manifest::SimConfig;

/// HTTP client for the data-node simulation API.
pub struct DataNodeClient {
    client: Client,
    base_url: String,
    auth_token: Option<String>,
}

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SimRunResponse {
    pub run_id: i64,
    pub stats: SimStats,
}

#[derive(Debug, Deserialize)]
pub struct SimStats {
    pub total_return_pct: f64,
    pub sharpe_ratio: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SimHolding {
    pub coin_id: String,
    pub symbol: String,
    pub weight: f64,
    pub price_usd: f64,
}

/// Wrapper for the `/sim/holdings` JSON envelope.
#[derive(Debug, Deserialize)]
struct HoldingsEnvelope {
    holdings: Vec<SimHolding>,
}

// ── Implementation ──────────────────────────────────────────────────────────

impl DataNodeClient {
    pub fn new(base_url: &str, auth_token: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("failed to build reqwest client");

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            auth_token,
        }
    }

    /// Run a simulation and return the run_id + summary stats.
    pub async fn sim_run(
        &self,
        config: &SimConfig,
    ) -> Result<SimRunResponse, Box<dyn std::error::Error>> {
        let url = format!("{}/sim/run", self.base_url);

        let query = [
            ("category_id", config.category_id.clone()),
            ("top_n", config.top_n.to_string()),
            ("weighting", config.weighting.clone()),
            ("rebalance_days", config.rebalance_days.to_string()),
            ("base_fee_pct", "0.001".to_string()),
            ("spread_multiplier", "1.0".to_string()),
        ];

        debug!(url, ?query, "GET /sim/run");

        let mut req = self.client.get(&url).query(&query);
        if let Some(token) = &self.auth_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        let resp = req.send().await?.error_for_status()?;
        let body: SimRunResponse = resp.json().await?;
        Ok(body)
    }

    /// Fetch the latest holdings for a completed simulation run.
    pub async fn sim_holdings(
        &self,
        run_id: i64,
    ) -> Result<Vec<SimHolding>, Box<dyn std::error::Error>> {
        let url = format!("{}/sim/holdings", self.base_url);

        debug!(url, run_id, "GET /sim/holdings");

        let mut req = self.client.get(&url).query(&[("run_id", run_id)]);
        if let Some(token) = &self.auth_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }

        let resp = req.send().await?.error_for_status()?;
        let envelope: HoldingsEnvelope = resp.json().await?;
        Ok(envelope.holdings)
    }

    /// Convenience: run a simulation then return its latest holdings.
    pub async fn get_target_holdings(
        &self,
        config: &SimConfig,
    ) -> Result<Vec<SimHolding>, Box<dyn std::error::Error>> {
        let run = self.sim_run(config).await?;
        debug!(run_id = run.run_id, "sim complete, fetching holdings");
        self.sim_holdings(run.run_id).await
    }
}
