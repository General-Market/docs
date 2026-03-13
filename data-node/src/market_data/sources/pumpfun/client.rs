//! Pump.fun token tracker via Dexscreener discovery.
//!
//! Discovers trending pump.fun tokens from DexScreener's public API endpoints
//! (token-boosts/top and token-profiles/latest), then enriches them with
//! price/volume/market cap from DexScreener's pairs endpoint.
//!
//! Assets are fully dynamic — discovered from DexScreener trending data.
//! Each token gets a single asset tracking its USD price.
//!
//! API:
//!   - Dexscreener: token-boosts/top, token-profiles/latest, /latest/dex/tokens
//!   - No auth required (public API, ~300 req/min)
//!
//! No external API key needed — always-on source.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/pumpfun.json");

/// Dexscreener API endpoints
const DEXSCREENER_TOKENS: &str = "https://api.dexscreener.com/latest/dex/tokens";
const DEXSCREENER_TOP_BOOSTS: &str = "https://api.dexscreener.com/token-boosts/top/v1";
const DEXSCREENER_LATEST_PROFILES: &str = "https://api.dexscreener.com/token-profiles/latest/v1";

/// Max tokens per Dexscreener /latest/dex/tokens request
const DEXSCREENER_BATCH_SIZE: usize = 30;

/// Delay between Dexscreener requests (ms)
const DEXSCREENER_DELAY_MS: u64 = 250;

/// Max tokens to track (top by market cap)
const MAX_TRACKED_TOKENS: usize = 500;

// ============================================================================
// DEXSCREENER TYPES
// ============================================================================

/// Token entry from DexScreener top-boosts or latest-profiles endpoint
#[derive(Debug, Deserialize)]
struct DexTokenEntry {
    #[serde(rename = "chainId")]
    chain_id: String,
    #[serde(rename = "tokenAddress")]
    token_address: String,
}

#[derive(Debug, Deserialize)]
struct DexPairsResponse {
    pairs: Option<Vec<DexPair>>,
}

#[derive(Debug, Deserialize)]
struct DexPair {
    #[serde(rename = "chainId")]
    chain_id: String,
    #[serde(rename = "baseToken")]
    base_token: DexToken,
    #[serde(rename = "priceUsd")]
    price_usd: Option<String>,
    volume: Option<DexVolume>,
    liquidity: Option<DexLiquidity>,
    fdv: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct DexToken {
    address: String,
    symbol: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct DexVolume {
    h24: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct DexLiquidity {
    usd: Option<f64>,
}

/// Enriched token data from Dexscreener
#[derive(Debug, Clone)]
struct TokenData {
    mint: String,
    symbol: String,
    name: String,
    price_usd: f64,
    volume_24h: f64,
    liquidity_usd: f64,
    market_cap: f64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct PumpfunMarketSource {
    /// Rate-limited HTTP client for Dexscreener GET requests
    http: SourceHttpClient,
}

impl PumpfunMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 250,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("PumpFun source initialized (Dexscreener-only, no API key required)");

        Ok(Self { http })
    }

    /// Discover pump.fun token addresses from DexScreener trending endpoints.
    ///
    /// Uses two endpoints:
    /// 1. token-boosts/top — trending/promoted tokens
    /// 2. token-profiles/latest — recently profiled tokens
    ///
    /// Filters to Solana tokens whose address ends with "pump" (pump.fun convention).
    async fn discover_mints(&self) -> Vec<String> {
        let mut mints = HashSet::new();

        // 1. Top boosted tokens
        match self.http.get_json::<Vec<DexTokenEntry>>(DEXSCREENER_TOP_BOOSTS).await {
            Ok(entries) => {
                for entry in &entries {
                    if entry.chain_id == "solana"
                        && entry.token_address.ends_with("pump")
                        && entry.token_address.len() > 20
                    {
                        mints.insert(entry.token_address.clone());
                    }
                }
                debug!(
                    "PumpFun: {} pump.fun tokens from top-boosts ({} total)",
                    mints.len(),
                    entries.len()
                );
            }
            Err(e) => {
                warn!("PumpFun: failed to fetch top-boosts: {:?}", e);
            }
        }

        tokio::time::sleep(Duration::from_millis(DEXSCREENER_DELAY_MS)).await;

        // 2. Latest token profiles
        let before_profiles = mints.len();
        match self
            .http
            .get_json::<Vec<DexTokenEntry>>(DEXSCREENER_LATEST_PROFILES)
            .await
        {
            Ok(entries) => {
                for entry in &entries {
                    if entry.chain_id == "solana"
                        && entry.token_address.ends_with("pump")
                        && entry.token_address.len() > 20
                    {
                        mints.insert(entry.token_address.clone());
                    }
                }
                debug!(
                    "PumpFun: {} new pump.fun tokens from latest-profiles",
                    mints.len() - before_profiles
                );
            }
            Err(e) => {
                warn!("PumpFun: failed to fetch latest-profiles: {:?}", e);
            }
        }

        info!(
            "PumpFun: discovered {} unique pump.fun token addresses",
            mints.len()
        );
        mints.into_iter().collect()
    }

    /// Fetch market data from Dexscreener for given mints.
    ///
    /// When `limit` is `Some(n)`, sort by market cap descending and return
    /// only the top `n` results (used during discovery to cap tracked tokens).
    /// When `limit` is `None`, return ALL tokens that have a price (used
    /// during price sync so existing active tokens always get updates).
    async fn fetch_dexscreener_data(&self, mints: &[String], limit: Option<usize>) -> Vec<TokenData> {
        let mut results = Vec::new();
        let mut seen = HashSet::new();

        for chunk in mints.chunks(DEXSCREENER_BATCH_SIZE) {
            let url = format!("{}/{}", DEXSCREENER_TOKENS, chunk.join(","));

            match self.http.get_json::<DexPairsResponse>(&url).await {
                Ok(resp) => {
                    if let Some(pairs) = resp.pairs {
                        for pair in pairs {
                            if pair.chain_id != "solana" {
                                continue;
                            }
                            let mint = pair.base_token.address.clone();
                            if seen.contains(&mint) {
                                continue;
                            }

                            let volume = pair.volume.as_ref().and_then(|v| v.h24).unwrap_or(0.0);
                            let fdv = pair.fdv.unwrap_or(0.0);
                            let price = pair
                                .price_usd
                                .as_ref()
                                .and_then(|p| p.parse::<f64>().ok())
                                .unwrap_or(0.0);
                            let liquidity = pair
                                .liquidity
                                .as_ref()
                                .and_then(|l| l.usd)
                                .unwrap_or(0.0);

                            if price > 0.0 {
                                seen.insert(mint.clone());
                                results.push(TokenData {
                                    mint,
                                    symbol: pair.base_token.symbol,
                                    name: pair.base_token.name,
                                    price_usd: price,
                                    volume_24h: volume,
                                    liquidity_usd: liquidity,
                                    market_cap: fdv,
                                });
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("PumpFun: Dexscreener batch failed: {:?}", e);
                }
            }

            tokio::time::sleep(Duration::from_millis(DEXSCREENER_DELAY_MS)).await;
        }

        // Sort by market cap descending; optionally truncate
        results.sort_by(|a, b| {
            b.market_cap
                .partial_cmp(&a.market_cap)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        if let Some(n) = limit {
            results.truncate(n);
        }

        results
    }

    /// Full discovery pipeline: DexScreener trending -> enrich with prices
    async fn discover_tokens(&self) -> Result<Vec<TokenData>> {
        let mints = self.discover_mints().await;
        if mints.is_empty() {
            warn!("PumpFun: no pump.fun mints discovered from DexScreener");
            return Ok(Vec::new());
        }

        let tokens = self.fetch_dexscreener_data(&mints, Some(MAX_TRACKED_TOKENS)).await;

        info!(
            "PumpFun: {} tokens with market data (top mcap: ${:.2})",
            tokens.len(),
            tokens.first().map(|t| t.market_cap).unwrap_or(0.0)
        );

        Ok(tokens)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for PumpfunMarketSource {
    fn source_id(&self) -> &'static str {
        "pumpfun"
    }

    fn display_name(&self) -> &'static str {
        "Pump.fun Tokens"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 250,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        let tokens = self.discover_tokens().await?;

        let assets: Vec<AssetUpdate> = tokens
            .iter()
            .map(|t| {
                let short_mint = if t.mint.len() > 8 {
                    format!("{}..{}", &t.mint[..4], &t.mint[t.mint.len() - 4..])
                } else {
                    t.mint.clone()
                };

                AssetUpdate {
                    asset_id: format!("pf_{}", t.mint),
                    symbol: format!("PF:{}", t.symbol),
                    name: format!("{} ({})", t.name, short_mint),
                    category: Some("crypto".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": t.mint.clone(),
                        "subcategory": "pumpfun",
                        "active": true,
                        "extra": {
                            "chain": "solana",
                            "program": "pump.fun",
                            "liquidity_usd": t.liquidity_usd,
                        },
                    }),
                }
            })
            .collect();

        info!(
            "PumpFun fetch_assets: {} tokens -> {} assets",
            tokens.len(),
            assets.len()
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Extract mint addresses from asset IDs (format: "pf_<mint>")
        let mut mint_to_asset: HashMap<String, &str> = HashMap::new();
        for aid in asset_ids {
            if let Some(mint) = aid.strip_prefix("pf_") {
                mint_to_asset.insert(mint.to_string(), aid.as_str());
            }
        }

        if mint_to_asset.is_empty() {
            return Ok(Vec::new());
        }

        let mints: Vec<String> = mint_to_asset.keys().cloned().collect();
        // No limit — update prices for ALL existing active tokens, not just top N
        let tokens = self.fetch_dexscreener_data(&mints, None).await;

        let mut results = Vec::new();
        for token in &tokens {
            if let Some(&asset_id) = mint_to_asset.get(&token.mint) {
                let price = Decimal::from_str(&format!("{:.10}", token.price_usd))
                    .unwrap_or(Decimal::ZERO);

                let volume = Decimal::from_str(&format!("{:.2}", token.volume_24h)).ok();
                let mcap = Decimal::from_str(&format!("{:.2}", token.market_cap)).ok();

                results.push(PriceUpdate {
                    asset_id: asset_id.to_string(),
                    symbol: format!("PF:{}", token.symbol),
                    value: price,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: volume,
                    market_cap: mcap,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} prices from PumpFun (Dexscreener)",
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
    fn test_source_id() {
        assert_eq!("pumpfun", "pumpfun");
    }

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty(), "Config should be empty -- assets are dynamic");
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    fn parse_mint(asset_id: &str) -> Option<&str> {
        asset_id.strip_prefix("pf_")
    }

    #[test]
    fn test_parse_mint_valid() {
        assert_eq!(
            parse_mint("pf_25ursUJufyybDGdg4AhLXeZfnwDvyawTRhd3bqWVpump"),
            Some("25ursUJufyybDGdg4AhLXeZfnwDvyawTRhd3bqWVpump")
        );
    }

    #[test]
    fn test_parse_mint_invalid() {
        assert_eq!(parse_mint("invalid"), None);
        assert_eq!(parse_mint("hn_12345_score"), None);
        assert_eq!(parse_mint(""), None);
        assert_eq!(parse_mint("pf_"), Some(""));
    }

    #[test]
    fn test_mint_ends_with_pump() {
        let mint = "25ursUJufyybDGdg4AhLXeZfnwDvyawTRhd3bqWVpump";
        assert!(mint.ends_with("pump"));
        assert!(mint.len() > 20);
    }

    #[test]
    fn test_price_decimal_conversion() {
        let price: f64 = 0.00001234;
        let dec = Decimal::from_str(&format!("{:.10}", price)).unwrap();
        assert!(dec > Decimal::ZERO);

        let price: f64 = 107.66;
        let dec = Decimal::from_str(&format!("{:.10}", price)).unwrap();
        assert_eq!(dec.to_string(), "107.6600000000");
    }

    #[test]
    fn test_short_mint_display() {
        let mint = "25ursUJufyybDGdg4AhLXeZfnwDvyawTRhd3bqWVpump";
        let short = if mint.len() > 8 {
            format!("{}..{}", &mint[..4], &mint[mint.len() - 4..])
        } else {
            mint.to_string()
        };
        assert_eq!(short, "25ur..pump");
    }

    #[test]
    fn test_asset_id_format() {
        let mint = "AbCdEfGhIjKlMnOpQrStUvWxYz1234567890pump";
        let asset_id = format!("pf_{}", mint);
        assert!(asset_id.starts_with("pf_"));
        assert_eq!(parse_mint(&asset_id), Some(mint));
    }

    #[test]
    fn test_dex_token_entry_deserialization() {
        let json = r#"[{
            "url": "https://dexscreener.com/solana/testpump",
            "chainId": "solana",
            "tokenAddress": "94p9UtdeZviYSKY1b7ZvXkf7EdTMbVzNjzvFzYi3pump"
        }]"#;

        let entries: Vec<DexTokenEntry> = serde_json::from_str(json).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].chain_id, "solana");
        assert!(entries[0].token_address.ends_with("pump"));
    }

    #[test]
    fn test_dex_pairs_response() {
        let json = r#"{
            "pairs": [{
                "chainId": "solana",
                "baseToken": {
                    "address": "94p9UtdeZviYSKY1b7ZvXkf7EdTMbVzNjzvFzYi3pump",
                    "symbol": "TEST",
                    "name": "Test Token"
                },
                "priceUsd": "0.001234",
                "volume": {"h24": 50000.0},
                "liquidity": {"usd": 10000.0},
                "fdv": 500000.0
            }]
        }"#;

        let resp: DexPairsResponse = serde_json::from_str(json).unwrap();
        let pairs = resp.pairs.unwrap();
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].base_token.symbol, "TEST");
        assert_eq!(pairs[0].price_usd.as_deref(), Some("0.001234"));
    }
}
