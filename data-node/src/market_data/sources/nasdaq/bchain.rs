//! BCHAIN Bitcoin on-chain metrics data source
//!
//! Fetches Bitcoin blockchain data via Nasdaq Data Link.
//! Data updated daily.
//!
//! Provides 12 on-chain metrics across network, transactions, supply,
//! market, fees, and mining categories.

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use super::client::NasdaqClient;
use crate::market_data::traits::{
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// BCHAIN series definitions
/// (series_id, asset_id, name, category, unit)
const BCHAIN_SERIES: &[(&str, &str, &str, &str, &str)] = &[
    // Network Metrics
    (
        "HRATE",
        "bchain_hashrate",
        "Bitcoin Hash Rate",
        "network",
        "terahash_per_sec",
    ),
    (
        "DIFF",
        "bchain_difficulty",
        "Bitcoin Mining Difficulty",
        "network",
        "difficulty",
    ),
    (
        "BLCHS",
        "bchain_block_size",
        "Average Block Size",
        "network",
        "megabytes",
    ),
    // Transaction Metrics
    (
        "NTRAN",
        "bchain_tx_count",
        "Daily Transactions",
        "transactions",
        "count",
    ),
    (
        "NTRBL",
        "bchain_unique_addresses",
        "Unique Addresses Used",
        "transactions",
        "count",
    ),
    (
        "TRFUS",
        "bchain_tx_volume_usd",
        "Transaction Volume (USD)",
        "transactions",
        "usd",
    ),
    (
        "TRVOU",
        "bchain_tx_volume_btc",
        "Transaction Volume (BTC)",
        "transactions",
        "btc",
    ),
    // Supply Metrics
    (
        "TOTBC",
        "bchain_total_supply",
        "Total Bitcoins Mined",
        "supply",
        "btc",
    ),
    (
        "MWNUS",
        "bchain_wallets",
        "Blockchain Wallets",
        "supply",
        "count",
    ),
    // Market Metrics
    (
        "MKTCP",
        "bchain_marketcap",
        "Bitcoin Market Cap",
        "market",
        "usd",
    ),
    // Fees
    (
        "CPTRA",
        "bchain_cost_per_tx",
        "Cost Per Transaction",
        "fees",
        "usd",
    ),
    // Mining
    (
        "MIREV",
        "bchain_miner_revenue",
        "Daily Miner Revenue",
        "mining",
        "usd",
    ),
];

/// Nasdaq dataset response structure
#[derive(Debug, Deserialize)]
struct NasdaqDatasetResponse {
    dataset: NasdaqDataset,
}

#[derive(Debug, Deserialize)]
struct NasdaqDataset {
    #[allow(dead_code)]
    column_names: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

/// BCHAIN market data source
pub struct BchainMarketSource {
    client: NasdaqClient,
}

impl BchainMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        info!(
            "BCHAIN client initialized with {} series",
            BCHAIN_SERIES.len()
        );
        Ok(Self { client })
    }

    /// Fetch a BCHAIN series
    async fn fetch_series(&self, series_id: &str) -> Result<Option<(String, f64)>> {
        let dataset_code = format!("BCHAIN/{}", series_id);

        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset(&dataset_code, 1).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to fetch BCHAIN series {}: {:?}", series_id, e);
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
            debug!("No BCHAIN data for {}", series_id);
            return Ok(None);
        }

        let row = &resp.dataset.data[0];

        // Date is first column, value is second
        let date = row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let value = row.get(1).and_then(|v| v.as_f64());

        if let Some(v) = value {
            Ok(Some((date, v)))
        } else {
            Ok(None)
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BchainMarketSource {
    fn source_id(&self) -> &'static str {
        "bchain"
    }

    fn display_name(&self) -> &'static str {
        "Bitcoin On-Chain Metrics"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Sync hourly
        Duration::from_secs(3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 250,
                    duration: Duration::from_secs(10),
                },
                RateWindow {
                    max_requests: 40000,
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        Ok(BCHAIN_SERIES
            .iter()
            .map(|(series_id, asset_id, name, category, unit)| AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: series_id.to_string(),
                name: name.to_string(),
                category: Some(category.to_string()),
                metadata: serde_json::json!({
                    "source": "bchain",
                    "series_id": series_id,
                    "unit": unit,
                    "blockchain": "bitcoin",
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (series_id, asset_id, _name, _category, _unit) in BCHAIN_SERIES {
            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_series(series_id).await {
                Ok(Some((_date, value))) => {
                    if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: asset_id.to_string(),
                            symbol: series_id.to_string(),
                            value: decimal_value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No BCHAIN data for {}", series_id);
                }
                Err(e) => {
                    warn!("Error fetching BCHAIN series {}: {:?}", series_id, e);
                }
            }
        }

        info!("Fetched {} BCHAIN metrics", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for BchainMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Bitcoin data updates continuously, fetch every hour
        // Return now + 1 hour
        now + chrono::Duration::hours(1)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Bitcoin operates 24/7
        false
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        None
    }

    fn timezone(&self) -> &'static str {
        "UTC"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_series_count() {
        assert_eq!(BCHAIN_SERIES.len(), 12);
    }

    #[test]
    fn test_categories() {
        let categories: Vec<_> = BCHAIN_SERIES.iter().map(|s| s.3).collect();
        assert!(categories.contains(&"network"));
        assert!(categories.contains(&"transactions"));
        assert!(categories.contains(&"supply"));
        assert!(categories.contains(&"market"));
        assert!(categories.contains(&"fees"));
        assert!(categories.contains(&"mining"));
    }
}
