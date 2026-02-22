//! DefiLlama API client implementing MarketDataSource
//!
//! Fetches DeFi data from https://api.llama.fi (free, no API key required)
//! - Chain TVL: /api/v2/chains
//! - Protocol TVL: /api/protocols
//! - DEX volumes: /api/overview/dexs

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/defi.json");

/// DefiLlama API base URL (free, no auth required)
const DEFILLAMA_API_URL: &str = "https://api.llama.fi";

/// DEX volumes use a different base
const DEFILLAMA_DEX_URL: &str = "https://api.llama.fi";

/// Request timeout in seconds
const REQUEST_TIMEOUT_SECS: u64 = 60;

/// Maximum retries per request
const MAX_RETRIES: u32 = 3;

/// Minimum delay between requests (ms) - conservative for free tier
const MIN_REQUEST_DELAY_MS: u64 = 200;

// ============================================================================
// Deserialization Helpers
// ============================================================================

/// Deserialize chain_id that can be either a string or number
fn deserialize_chain_id<'de, D>(deserializer: D) -> std::result::Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNumber {
        String(String),
        Number(i64),
        Null,
    }

    match StringOrNumber::deserialize(deserializer)? {
        StringOrNumber::String(s) => s.parse::<i64>().map(Some).map_err(D::Error::custom),
        StringOrNumber::Number(n) => Ok(Some(n)),
        StringOrNumber::Null => Ok(None),
    }
}

// ============================================================================
// API Response Types
// ============================================================================

/// Chain TVL from /api/v2/chains
#[derive(Debug, Clone, Deserialize)]
pub struct ChainTvl {
    pub name: String,
    pub tvl: Option<f64>,
    #[serde(rename = "tokenSymbol")]
    pub token_symbol: Option<String>,
    #[serde(rename = "chainId", default, deserialize_with = "deserialize_chain_id")]
    pub chain_id: Option<i64>,
    pub gecko_id: Option<String>,
}

/// Protocol TVL from /api/protocols
#[derive(Debug, Clone, Deserialize)]
pub struct ProtocolTvl {
    pub id: Option<String>,
    pub name: String,
    pub slug: String,
    pub symbol: Option<String>,
    pub tvl: Option<f64>,
    pub category: Option<String>,
    pub chains: Option<Vec<String>>,
    #[serde(rename = "change_1h")]
    pub change_1h: Option<f64>,
    #[serde(rename = "change_1d")]
    pub change_1d: Option<f64>,
    #[serde(rename = "change_7d")]
    pub change_7d: Option<f64>,
    pub mcap: Option<f64>,
}

/// DEX overview from /api/overview/dexs
#[derive(Debug, Clone, Deserialize)]
pub struct DexOverview {
    pub protocols: Option<Vec<DexProtocol>>,
}

/// Individual DEX protocol data
#[derive(Debug, Clone, Deserialize)]
pub struct DexProtocol {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub module: Option<String>,
    pub category: Option<String>,
    pub chains: Option<Vec<String>>,
    #[serde(rename = "total24h")]
    pub total_24h: Option<f64>,
    #[serde(rename = "total7d")]
    pub total_7d: Option<f64>,
    #[serde(rename = "total30d")]
    pub total_30d: Option<f64>,
    #[serde(rename = "change_1d")]
    pub change_1d: Option<f64>,
    #[serde(rename = "change_7d")]
    pub change_7d: Option<f64>,
    #[serde(rename = "change_1m")]
    pub change_1m: Option<f64>,
}

// ============================================================================
// DefiLlama Market Source
// ============================================================================

/// DefiLlama DeFi market data source.
///
/// Source ID is `"defi"` — covers chain TVL, protocol TVL, and DEX volumes.
pub struct DefiLlamaMarketSource {
    client: reqwest::Client,
    sync_interval_secs: u64,
    /// Last request timestamp for internal rate limiting
    last_request: Arc<Mutex<std::time::Instant>>,
    /// Top N protocols to track (0 = all)
    top_protocols_count: usize,
    /// Top N DEXes to track (0 = all)
    top_dex_count: usize,
}

impl DefiLlamaMarketSource {
    /// Create a new DefiLlama market source
    pub fn new(
        sync_interval_secs: u64,
        top_protocols_count: usize,
        top_dex_count: usize,
    ) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            client,
            sync_interval_secs,
            last_request: Arc::new(Mutex::new(std::time::Instant::now())),
            top_protocols_count,
            top_dex_count,
        })
    }

    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let sync_interval_secs = std::env::var("DEFILLAMA_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(120); // Default 2 minutes - data updates hourly but we poll frequently

        let top_protocols_count = std::env::var("DEFILLAMA_TOP_PROTOCOLS")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(100); // Top 100 protocols by default

        let top_dex_count = std::env::var("DEFILLAMA_TOP_DEX")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(50); // Top 50 DEXes by default

        Self::new(sync_interval_secs, top_protocols_count, top_dex_count)
    }

    /// Enforce rate limiting before making a request
    async fn rate_limit(&self) {
        let mut last = self.last_request.lock().await;
        let elapsed = last.elapsed();
        let min_delay = Duration::from_millis(MIN_REQUEST_DELAY_MS);

        if elapsed < min_delay {
            let sleep_time = min_delay - elapsed;
            tokio::time::sleep(sleep_time).await;
        }

        *last = std::time::Instant::now();
    }

    /// Generic GET request with retries
    async fn get_json<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T> {
        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;

            match self.client.get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<T>().await {
                            Ok(data) => return Ok(data),
                            Err(e) => {
                                warn!(
                                    "Failed to parse response (attempt {}/{}): {:?}",
                                    attempt + 1,
                                    MAX_RETRIES,
                                    e
                                );
                                last_error = Some(e.to_string());
                            }
                        }
                    } else {
                        warn!(
                            "DefiLlama API error (attempt {}/{}): status {}",
                            attempt + 1,
                            MAX_RETRIES,
                            response.status()
                        );
                        last_error = Some(format!("HTTP {}", response.status()));
                    }
                }
                Err(e) => {
                    warn!(
                        "Request failed (attempt {}/{}): {:?}",
                        attempt + 1,
                        MAX_RETRIES,
                        e
                    );
                    last_error = Some(e.to_string());
                }
            }

            // Exponential backoff
            if attempt < MAX_RETRIES - 1 {
                let delay = Duration::from_secs(2u64.pow(attempt));
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Failed to fetch {} after {} retries: {:?}",
            url,
            MAX_RETRIES,
            last_error
        ))
    }

    /// Fetch all chain TVLs
    async fn fetch_chain_tvls(&self) -> Result<Vec<ChainTvl>> {
        let url = format!("{}/v2/chains", DEFILLAMA_API_URL);
        let chains: Vec<ChainTvl> = self.get_json(&url).await?;
        info!("Fetched {} chain TVLs from DefiLlama", chains.len());
        Ok(chains)
    }

    /// Fetch all protocol TVLs
    async fn fetch_protocol_tvls(&self) -> Result<Vec<ProtocolTvl>> {
        let url = format!("{}/protocols", DEFILLAMA_API_URL);
        let protocols: Vec<ProtocolTvl> = self.get_json(&url).await?;
        info!("Fetched {} protocol TVLs from DefiLlama", protocols.len());
        Ok(protocols)
    }

    /// Fetch DEX volumes
    async fn fetch_dex_volumes(&self) -> Result<Vec<DexProtocol>> {
        let url = format!(
            "{}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
            DEFILLAMA_DEX_URL
        );
        let overview: DexOverview = self.get_json(&url).await?;
        let protocols = overview.protocols.unwrap_or_default();
        info!("Fetched {} DEX volumes from DefiLlama", protocols.len());
        Ok(protocols)
    }

    /// Get category based on TVL tier
    fn get_tvl_category(tvl: f64) -> String {
        if tvl >= 10_000_000_000.0 {
            "defiMegaCap".to_string() // $10B+
        } else if tvl >= 1_000_000_000.0 {
            "defiLargeCap".to_string() // $1B+
        } else if tvl >= 100_000_000.0 {
            "defiMidCap".to_string() // $100M+
        } else {
            "defiSmallCap".to_string()
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for DefiLlamaMarketSource {
    fn source_id(&self) -> &'static str {
        "defi"
    }

    fn display_name(&self) -> &'static str {
        "DefiLlama DeFi"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(self.sync_interval_secs)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 400, // conservative: stay under 500/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;

        // If config has >500 entries, use it; otherwise do live discovery
        if static_assets.len() > 500 {
            return Ok(static_assets);
        }

        info!("DefiLlama config has only {} assets, performing live discovery", static_assets.len());
        let mut assets = Vec::new();

        // 1. Fetch all chains
        match self.fetch_chain_tvls().await {
            Ok(chains) => {
                for chain in &chains {
                    if let Some(tvl) = chain.tvl {
                        if tvl <= 0.0 { continue; }
                        let asset_id = format!("chain_{}", chain.name.to_lowercase().replace(' ', "_"));
                        assets.push(AssetUpdate {
                            asset_id,
                            symbol: chain.token_symbol.clone().unwrap_or_else(|| chain.name.clone()),
                            name: format!("{} TVL", chain.name),
                            category: Some("defi".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("chain:{}", chain.name),
                                "subcategory": "chain_tvl",
                                "active": true,
                            }),
                        });
                    }
                }
                info!("Discovered {} chains from DefiLlama", chains.len());
            }
            Err(e) => warn!("Failed to discover chains: {:?}", e),
        }

        // 2. Fetch all protocols
        match self.fetch_protocol_tvls().await {
            Ok(protocols) => {
                let count = protocols.len();
                for protocol in protocols {
                    if let Some(tvl) = protocol.tvl {
                        if tvl <= 0.0 { continue; }
                        let asset_id = format!("protocol_{}", protocol.slug);
                        let subcategory = protocol.category.as_deref().unwrap_or("protocol").to_lowercase();
                        assets.push(AssetUpdate {
                            asset_id,
                            symbol: protocol.symbol.unwrap_or_else(|| protocol.slug.to_uppercase()),
                            name: protocol.name,
                            category: Some("defi".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("protocol:{}", protocol.slug),
                                "subcategory": subcategory,
                                "active": true,
                            }),
                        });
                    }
                }
                info!("Discovered {} protocols from DefiLlama", count);
            }
            Err(e) => warn!("Failed to discover protocols: {:?}", e),
        }

        // 3. Fetch DEX volumes
        match self.fetch_dex_volumes().await {
            Ok(dexes) => {
                let count = dexes.len();
                for dex in &dexes {
                    let slug = dex.name.to_lowercase().replace(' ', "_");
                    // 24h volume entry
                    if dex.total_24h.map_or(false, |v| v > 0.0) {
                        assets.push(AssetUpdate {
                            asset_id: format!("dex_24h_{}", slug),
                            symbol: format!("{}_24H", slug.to_uppercase()),
                            name: format!("{} 24h Vol", dex.display_name.as_deref().unwrap_or(&dex.name)),
                            category: Some("defi".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("dex_24h:{}", dex.name),
                                "subcategory": "dex_volume",
                                "active": true,
                            }),
                        });
                    }
                }
                info!("Discovered {} DEXes from DefiLlama", count);
            }
            Err(e) => warn!("Failed to discover DEXes: {:?}", e),
        }

        info!("Total DefiLlama discovery: {} assets", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Build lookup sets for each type
        let chain_ids: Vec<&String> = asset_ids
            .iter()
            .filter(|id| id.starts_with("chain_"))
            .collect();
        let protocol_ids: Vec<&String> = asset_ids
            .iter()
            .filter(|id| id.starts_with("protocol_"))
            .collect();
        let dex_24h_ids: Vec<&String> = asset_ids
            .iter()
            .filter(|id| id.starts_with("dex_24h_"))
            .collect();
        let dex_30d_ids: Vec<&String> = asset_ids
            .iter()
            .filter(|id| id.starts_with("dex_30d_"))
            .collect();

        // 1. Fetch chain TVLs if needed
        if !chain_ids.is_empty() {
            match self.fetch_chain_tvls().await {
                Ok(chains) => {
                    for chain in chains {
                        let asset_id =
                            format!("chain_{}", chain.name.to_lowercase().replace(' ', "_"));
                        if chain_ids.contains(&&asset_id) {
                            if let Some(tvl) = chain.tvl {
                                results.push(PriceUpdate {
                                    asset_id,
                                    symbol: chain
                                        .token_symbol
                                        .unwrap_or_else(|| chain.name.clone()),
                                    value: Decimal::try_from(tvl).unwrap_or_default(),
                                    prev_close: None,
                                    change_pct: None,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                }
                Err(e) => warn!("Failed to fetch chain TVLs for prices: {:?}", e),
            }
        }

        // 2. Fetch protocol TVLs if needed
        if !protocol_ids.is_empty() {
            match self.fetch_protocol_tvls().await {
                Ok(protocols) => {
                    for protocol in protocols {
                        let asset_id = format!("protocol_{}", protocol.slug);
                        if protocol_ids.contains(&&asset_id) {
                            if let Some(tvl) = protocol.tvl {
                                let change_pct =
                                    protocol.change_1d.and_then(|v| Decimal::try_from(v).ok());
                                let market_cap =
                                    protocol.mcap.and_then(|v| Decimal::try_from(v).ok());

                                results.push(PriceUpdate {
                                    asset_id,
                                    symbol: protocol
                                        .symbol
                                        .unwrap_or_else(|| protocol.slug.to_uppercase()),
                                    value: Decimal::try_from(tvl).unwrap_or_default(),
                                    prev_close: None,
                                    change_pct,
                                    volume_24h: None,
                                    market_cap,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                }
                Err(e) => warn!("Failed to fetch protocol TVLs for prices: {:?}", e),
            }
        }

        // 3. Fetch DEX volumes if needed
        if !dex_24h_ids.is_empty() || !dex_30d_ids.is_empty() {
            match self.fetch_dex_volumes().await {
                Ok(dexes) => {
                    for dex in dexes {
                        let slug = dex.name.to_lowercase().replace(' ', "_");

                        // 24h volume
                        let asset_id_24h = format!("dex_24h_{}", slug);
                        if dex_24h_ids.contains(&&asset_id_24h) {
                            if let Some(vol) = dex.total_24h {
                                let change_pct =
                                    dex.change_1d.and_then(|v| Decimal::try_from(v).ok());

                                results.push(PriceUpdate {
                                    asset_id: asset_id_24h,
                                    symbol: format!("{}_24H", slug.to_uppercase()),
                                    value: Decimal::try_from(vol).unwrap_or_default(),
                                    prev_close: None,
                                    change_pct,
                                    volume_24h: dex
                                        .total_24h
                                        .and_then(|v| Decimal::try_from(v).ok()),
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }

                        // 30d volume
                        let asset_id_30d = format!("dex_30d_{}", slug);
                        if dex_30d_ids.contains(&&asset_id_30d) {
                            if let Some(vol) = dex.total_30d {
                                let change_pct =
                                    dex.change_1m.and_then(|v| Decimal::try_from(v).ok());

                                results.push(PriceUpdate {
                                    asset_id: asset_id_30d,
                                    symbol: format!("{}_30D", slug.to_uppercase()),
                                    value: Decimal::try_from(vol).unwrap_or_default(),
                                    prev_close: None,
                                    change_pct,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                }
                Err(e) => warn!("Failed to fetch DEX volumes for prices: {:?}", e),
            }
        }

        debug!(
            "Fetched {}/{} DeFi prices from DefiLlama",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 130, "Expected 130 defi assets (50 chains + 50 protocols + 30 DEX)");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        for asset in &assets {
            assert_eq!(asset.category, Some("defi".to_string()));
        }
    }

    #[test]
    fn test_subcategories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<&str> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"chain_tvl"));
        assert!(subcats.contains(&"lending"));
        assert!(subcats.contains(&"dex"));
        assert!(subcats.contains(&"dex_volume"));
    }

    #[test]
    fn test_known_assets_exist() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"chain_ethereum"));
        assert!(ids.contains(&"protocol_aave-v3"));
        assert!(ids.contains(&"dex_24h_uniswap"));
    }

    #[test]
    fn test_tvl_category() {
        assert_eq!(
            DefiLlamaMarketSource::get_tvl_category(15_000_000_000.0),
            "defiMegaCap"
        );
        assert_eq!(
            DefiLlamaMarketSource::get_tvl_category(5_000_000_000.0),
            "defiLargeCap"
        );
        assert_eq!(
            DefiLlamaMarketSource::get_tvl_category(50_000_000.0),
            "defiSmallCap"
        );
    }

    #[test]
    fn test_asset_id_generation() {
        let chain_name = "Ethereum";
        let asset_id = format!("chain_{}", chain_name.to_lowercase().replace(' ', "_"));
        assert_eq!(asset_id, "chain_ethereum");

        let slug = "aave-v3";
        let asset_id = format!("protocol_{}", slug);
        assert_eq!(asset_id, "protocol_aave-v3");
    }
}
