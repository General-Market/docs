//! BCHAIN Bitcoin on-chain metrics data source
//!
//! Fetches Bitcoin blockchain data via the blockchain.info stats API.
//! Data updated continuously (fetched hourly).
//!
//! Provides 12 on-chain metrics across network, transactions, supply,
//! market, fees, and mining categories.
//!
//! Uses a single API call to `https://api.blockchain.info/stats` instead of
//! per-series Nasdaq Data Link queries (which are blocked by Incapsula).

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/bchain.json");

/// blockchain.info stats API endpoint
const BLOCKCHAIN_INFO_STATS_URL: &str = "https://api.blockchain.info/stats";

/// API_REF values that are not available in the blockchain.info stats endpoint.
/// These are silently skipped during price fetching.
const UNAVAILABLE_METRICS: &[&str] = &["NTRBL", "MWNUS", "CPTRA"];

/// Response from `https://api.blockchain.info/stats`
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct BlockchainInfoStats {
    market_price_usd: f64,
    hash_rate: f64,
    #[serde(default)]
    total_fees_btc: f64,
    #[serde(default)]
    n_btc_mined: f64,
    n_tx: f64,
    n_blocks_mined: f64,
    #[serde(default)]
    minutes_between_blocks: f64,
    totalbc: f64,
    #[serde(default)]
    n_blocks_total: f64,
    estimated_transaction_volume_usd: f64,
    blocks_size: f64,
    miners_revenue_usd: f64,
    difficulty: f64,
    estimated_btc_sent: f64,
    #[serde(default)]
    trade_volume_btc: f64,
    #[serde(default)]
    trade_volume_usd: f64,
}

impl BlockchainInfoStats {
    /// Build a lookup table mapping BCHAIN api_ref codes to their computed values
    fn to_metric_map(&self) -> HashMap<&'static str, f64> {
        let mut map = HashMap::new();

        // HRATE: hash_rate (GH/s from API, same scale as BCHAIN series)
        map.insert("HRATE", self.hash_rate);

        // DIFF: mining difficulty
        map.insert("DIFF", self.difficulty);

        // BLCHS: average block size in bytes (blocks_size / n_blocks_mined)
        if self.n_blocks_mined > 0.0 {
            map.insert("BLCHS", self.blocks_size / self.n_blocks_mined);
        }

        // NTRAN: daily transaction count
        map.insert("NTRAN", self.n_tx);

        // TRFUS: estimated transaction volume in USD
        map.insert("TRFUS", self.estimated_transaction_volume_usd);

        // TRVOU: estimated BTC sent (API returns satoshis, convert to BTC)
        map.insert("TRVOU", self.estimated_btc_sent / 1e8);

        // TOTBC: total bitcoins in circulation (API returns satoshis, convert to BTC)
        map.insert("TOTBC", self.totalbc / 1e8);

        // MKTCP: market cap = price * total supply in BTC
        let total_btc = self.totalbc / 1e8;
        map.insert("MKTCP", self.market_price_usd * total_btc);

        // MIREV: daily miner revenue in USD
        map.insert("MIREV", self.miners_revenue_usd);

        map
    }
}

/// BCHAIN market data source (backed by blockchain.info stats API)
pub struct BchainMarketSource {
    client: reqwest::Client,
}

impl BchainMarketSource {
    /// Create from environment (no API key required)
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client for BCHAIN")?;

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("BCHAIN client initialized with {} series (blockchain.info stats API)", asset_count);
        Ok(Self { client })
    }

    /// Fetch all stats from blockchain.info in a single call
    async fn fetch_stats(&self) -> Result<BlockchainInfoStats> {
        let resp = self
            .client
            .get(BLOCKCHAIN_INFO_STATS_URL)
            .send()
            .await
            .context("Failed to send request to blockchain.info")?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!(
                "blockchain.info stats API returned HTTP {}: {}",
                status,
                body
            );
        }

        resp.json::<BlockchainInfoStats>()
            .await
            .context("Failed to parse blockchain.info stats JSON")
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
        // blockchain.info has generous rate limits; keep conservative windows
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 30,
                    duration: Duration::from_secs(60),
                },
                RateWindow {
                    max_requests: 500,
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        // Single API call to get all stats
        let stats = match self.fetch_stats().await {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to fetch blockchain.info stats: {:?}", e);
                return Ok(Vec::new());
            }
        };

        let metric_map = stats.to_metric_map();
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let mut results = Vec::new();

        for entry in &entries {
            if !entry.active {
                continue;
            }

            let api_ref = entry.api_ref.as_str();

            // Skip metrics not available in blockchain.info stats
            if UNAVAILABLE_METRICS.contains(&api_ref) {
                debug!("Skipping unavailable metric {} (not in blockchain.info stats)", api_ref);
                continue;
            }

            match metric_map.get(api_ref) {
                Some(&value) => {
                    if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: entry.asset_id.clone(),
                            symbol: entry.symbol.clone(),
                            value: decimal_value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                None => {
                    warn!(
                        "BCHAIN api_ref '{}' not mapped in blockchain.info stats response",
                        api_ref
                    );
                }
            }
        }

        info!("Fetched {} BCHAIN metrics from blockchain.info", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for BchainMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Bitcoin data updates continuously, fetch every hour
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
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 12, "Expected 12 BCHAIN series");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        for asset in &assets {
            assert_eq!(asset.category, Some("onchain".to_string()));
        }
    }

    #[test]
    fn test_api_ref_values() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let api_refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(api_refs.contains(&"HRATE"));
        assert!(api_refs.contains(&"MKTCP"));
        assert!(api_refs.contains(&"NTRAN"));
    }

    #[test]
    fn test_metric_map_contains_expected_keys() {
        let stats = BlockchainInfoStats {
            market_price_usd: 73204.18,
            hash_rate: 1028184533376.3367,
            total_fees_btc: -45625000000.0,
            n_btc_mined: 45625000000.0,
            n_tx: 420628.0,
            n_blocks_mined: 146.0,
            minutes_between_blocks: 9.131,
            totalbc: 1998456562500000.0,
            n_blocks_total: 935061.0,
            estimated_transaction_volume_usd: 13653448815.136261,
            blocks_size: 249099605.0,
            miners_revenue_usd: 0.0,
            difficulty: 141668107417558.0,
            estimated_btc_sent: 18651187425549.0,
            trade_volume_btc: 13037.34,
            trade_volume_usd: 954387784.0812,
        };

        let map = stats.to_metric_map();

        // All mapped metrics should be present
        assert!(map.contains_key("HRATE"));
        assert!(map.contains_key("DIFF"));
        assert!(map.contains_key("BLCHS"));
        assert!(map.contains_key("NTRAN"));
        assert!(map.contains_key("TRFUS"));
        assert!(map.contains_key("TRVOU"));
        assert!(map.contains_key("TOTBC"));
        assert!(map.contains_key("MKTCP"));
        assert!(map.contains_key("MIREV"));

        // Unavailable metrics should NOT be present
        assert!(!map.contains_key("NTRBL"));
        assert!(!map.contains_key("MWNUS"));
        assert!(!map.contains_key("CPTRA"));
    }

    #[test]
    fn test_metric_values_correct() {
        let stats = BlockchainInfoStats {
            market_price_usd: 73204.18,
            hash_rate: 1028184533376.3367,
            total_fees_btc: -45625000000.0,
            n_btc_mined: 45625000000.0,
            n_tx: 420628.0,
            n_blocks_mined: 146.0,
            minutes_between_blocks: 9.131,
            totalbc: 1998456562500000.0,
            n_blocks_total: 935061.0,
            estimated_transaction_volume_usd: 13653448815.136261,
            blocks_size: 249099605.0,
            miners_revenue_usd: 0.0,
            difficulty: 141668107417558.0,
            estimated_btc_sent: 18651187425549.0,
            trade_volume_btc: 13037.34,
            trade_volume_usd: 954387784.0812,
        };

        let map = stats.to_metric_map();

        // HRATE = hash_rate directly
        assert_eq!(map["HRATE"], 1028184533376.3367);

        // DIFF = difficulty directly
        assert_eq!(map["DIFF"], 141668107417558.0);

        // BLCHS = blocks_size / n_blocks_mined
        let expected_blchs = 249099605.0 / 146.0;
        assert!((map["BLCHS"] - expected_blchs).abs() < 0.01);

        // NTRAN = n_tx
        assert_eq!(map["NTRAN"], 420628.0);

        // TRVOU = estimated_btc_sent / 1e8
        let expected_trvou = 18651187425549.0 / 1e8;
        assert!((map["TRVOU"] - expected_trvou).abs() < 0.01);

        // TOTBC = totalbc / 1e8
        let expected_totbc = 1998456562500000.0 / 1e8;
        assert!((map["TOTBC"] - expected_totbc).abs() < 0.01);

        // MKTCP = market_price_usd * (totalbc / 1e8)
        let expected_mktcp = 73204.18 * expected_totbc;
        assert!((map["MKTCP"] - expected_mktcp).abs() < 1.0);

        // MIREV = miners_revenue_usd
        assert_eq!(map["MIREV"], 0.0);
    }

    #[test]
    fn test_unavailable_metrics_list() {
        // Ensure the skip list matches what we expect
        assert!(UNAVAILABLE_METRICS.contains(&"NTRBL"));
        assert!(UNAVAILABLE_METRICS.contains(&"MWNUS"));
        assert!(UNAVAILABLE_METRICS.contains(&"CPTRA"));
        assert_eq!(UNAVAILABLE_METRICS.len(), 3);
    }

    #[test]
    fn test_zero_blocks_mined_no_panic() {
        let stats = BlockchainInfoStats {
            market_price_usd: 73204.18,
            hash_rate: 1028184533376.3367,
            total_fees_btc: 0.0,
            n_btc_mined: 0.0,
            n_tx: 0.0,
            n_blocks_mined: 0.0, // edge case: zero blocks
            minutes_between_blocks: 0.0,
            totalbc: 1998456562500000.0,
            n_blocks_total: 935061.0,
            estimated_transaction_volume_usd: 0.0,
            blocks_size: 0.0,
            miners_revenue_usd: 0.0,
            difficulty: 141668107417558.0,
            estimated_btc_sent: 0.0,
            trade_volume_btc: 0.0,
            trade_volume_usd: 0.0,
        };

        let map = stats.to_metric_map();

        // BLCHS should not be present when n_blocks_mined is 0
        assert!(!map.contains_key("BLCHS"));

        // Other metrics should still work
        assert!(map.contains_key("HRATE"));
        assert!(map.contains_key("DIFF"));
    }
}
