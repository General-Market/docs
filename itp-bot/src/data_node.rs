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
    #[serde(default)]
    pub total_return_pct: f64,
    #[serde(default)]
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
    /// Overrides CoinGecko prices with live Bitget prices so that
    /// ITP creation uses the same price source as NAV computation.
    pub async fn get_target_holdings(
        &self,
        config: &SimConfig,
    ) -> Result<Vec<SimHolding>, Box<dyn std::error::Error>> {
        let run = self.sim_run(config).await?;
        debug!(run_id = run.run_id, "sim complete, fetching holdings");
        let mut holdings = self.sim_holdings(run.run_id).await?;

        // Fetch live Bitget prices and override CoinGecko prices.
        // This prevents NAV drift at creation time — the itp-bot uses
        // the same price source as the data-node's live NAV computation.
        if let Ok(bitget_prices) = self.fetch_bitget_prices().await {
            for h in &mut holdings {
                let pair_usdt = format!("{}USDT", h.symbol);
                let pair_usdc = format!("{}USDC", h.symbol);
                if let Some(price) = bitget_prices.get(&pair_usdt).or(bitget_prices.get(&pair_usdc)) {
                    if *price > 0.0 {
                        debug!(symbol = %h.symbol, cg = h.price_usd, bitget = price, "Price override");
                        h.price_usd = *price;
                    }
                }
            }
        }

        Ok(holdings)
    }

    /// Fetch all live Bitget ticker prices (pair → USD price).
    async fn fetch_bitget_prices(&self) -> Result<std::collections::HashMap<String, f64>, Box<dyn std::error::Error>> {
        let url = "https://api.bitget.com/api/v2/spot/market/tickers";
        let resp: serde_json::Value = self.client.get(url).send().await?.json().await?;
        let mut prices = std::collections::HashMap::new();
        if let Some(data) = resp.get("data").and_then(|d| d.as_array()) {
            for t in data {
                if let (Some(sym), Some(price_str)) = (t.get("symbol").and_then(|s| s.as_str()), t.get("lastPr").and_then(|p| p.as_str())) {
                    if let Ok(p) = price_str.parse::<f64>() {
                        prices.insert(sym.to_string(), p);
                    }
                }
            }
        }
        debug!(count = prices.len(), "Fetched Bitget live prices");
        Ok(prices)
    }
}
