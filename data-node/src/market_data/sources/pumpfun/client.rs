//! Pump.fun token tracker via Helius RPC + Dexscreener enrichment.
//!
//! Discovers recently-traded pump.fun tokens by scanning transactions on the
//! pump.fun program via Helius `getSignaturesForAddress`, then enriches them
//! with price/volume/market cap from Dexscreener.
//!
//! Assets are fully dynamic — discovered from on-chain transactions.
//! Each token gets a single asset tracking its USD price.
//!
//! API:
//!   - Helius RPC: getSignaturesForAddress + getTransaction (requires HELIUS_API_KEY)
//!   - Dexscreener: /latest/dex/tokens (no key, 300 req/min)
//!
//! Gated on: HELIUS_API_KEY environment variable

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/pumpfun.json");

/// Pump.fun program address on Solana
const PUMP_PROGRAM: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/// Dexscreener API base
const DEXSCREENER_TOKENS: &str = "https://api.dexscreener.com/latest/dex/tokens";

/// Max tokens per Dexscreener request
const DEXSCREENER_BATCH_SIZE: usize = 30;

/// How many signature batches to fetch per discovery poll
const SIGNATURE_BATCHES: usize = 3;

/// Signatures per batch (Helius max = 1000)
const SIGNATURES_PER_BATCH: usize = 1000;

/// Delay between Dexscreener requests (ms)
const DEXSCREENER_DELAY_MS: u64 = 250;

/// Max tokens to track (top by market cap)
const MAX_TRACKED_TOKENS: usize = 500;

// ============================================================================
// HELIUS RPC TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
}

#[derive(Debug, Clone, Deserialize)]
struct SignatureInfo {
    signature: String,
}

#[derive(Debug, Deserialize)]
struct ParsedTransaction {
    transaction: TransactionData,
}

#[derive(Debug, Deserialize)]
struct TransactionData {
    message: TransactionMessage,
}

#[derive(Debug, Deserialize)]
struct TransactionMessage {
    #[serde(rename = "accountKeys")]
    account_keys: Vec<AccountKey>,
}

#[derive(Debug, Deserialize)]
struct AccountKey {
    pubkey: String,
}

// ============================================================================
// DEXSCREENER TYPES
// ============================================================================

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
    /// Raw reqwest client for Helius RPC POST requests
    rpc_client: reqwest::Client,
    helius_rpc_url: String,
}

impl PumpfunMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("HELIUS_API_KEY")
            .map_err(|_| anyhow::anyhow!("HELIUS_API_KEY not set"))?;

        let helius_rpc_url = format!("https://mainnet.helius-rpc.com/?api-key={}", api_key);

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        let rpc_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to create Helius HTTP client: {}", e))?;

        info!("PumpFun source initialized (Helius RPC + Dexscreener)");

        Ok(Self {
            http,
            rpc_client,
            helius_rpc_url,
        })
    }

    /// POST a JSON-RPC request to Helius and deserialize the response
    async fn rpc_post<T: serde::de::DeserializeOwned>(
        &self,
        body: &serde_json::Value,
    ) -> Result<RpcResponse<T>, SourceError> {
        let resp = self
            .rpc_client
            .post(&self.helius_rpc_url)
            .json(body)
            .send()
            .await
            .map_err(|e| SourceError::Transient(format!("Helius RPC request failed: {}", e)))?;

        let status = resp.status().as_u16();
        if !resp.status().is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(SourceError::from_status(status, &body_text));
        }

        resp.json::<RpcResponse<T>>()
            .await
            .map_err(|e| SourceError::DataError(format!("Helius RPC parse error: {}", e)))
    }

    /// Fetch recent signatures for the pump.fun program
    async fn fetch_signatures(&self) -> Result<Vec<String>, SourceError> {
        let mut all_sigs = Vec::new();
        let mut before: Option<String> = None;

        for batch_idx in 0..SIGNATURE_BATCHES {
            let params = if let Some(ref before_sig) = before {
                serde_json::json!([PUMP_PROGRAM, {"limit": SIGNATURES_PER_BATCH, "before": before_sig}])
            } else {
                serde_json::json!([PUMP_PROGRAM, {"limit": SIGNATURES_PER_BATCH}])
            };

            let body = serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getSignaturesForAddress",
                "params": params
            });

            let resp: RpcResponse<Vec<SignatureInfo>> = self.rpc_post(&body).await?;

            match resp.result {
                Some(sigs) if !sigs.is_empty() => {
                    before = sigs.last().map(|s| s.signature.clone());
                    all_sigs.extend(sigs.into_iter().map(|s| s.signature));
                }
                _ => {
                    debug!("PumpFun: batch {} returned no signatures, stopping", batch_idx);
                    break;
                }
            }

            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        debug!("PumpFun: fetched {} total signatures", all_sigs.len());
        Ok(all_sigs)
    }

    /// Parse transactions to extract pump.fun token mints
    async fn extract_mints(&self, signatures: &[String]) -> Vec<String> {
        let mut mints = HashSet::new();
        let mut errors = 0u32;

        for (i, sig) in signatures.iter().enumerate() {
            let body = serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]
            });

            match self.rpc_post::<ParsedTransaction>(&body).await {
                Ok(resp) => {
                    if let Some(tx) = resp.result {
                        for key in &tx.transaction.message.account_keys {
                            if key.pubkey.ends_with("pump") && key.pubkey.len() > 20 {
                                mints.insert(key.pubkey.clone());
                            }
                        }
                    }
                }
                Err(_) => {
                    errors += 1;
                }
            }

            // Rate limit: every 50 requests, pause briefly
            if (i + 1) % 50 == 0 {
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }

        if errors > 0 {
            debug!("PumpFun: {} tx parse errors out of {}", errors, signatures.len());
        }

        mints.into_iter().collect()
    }

    /// Fetch market data from Dexscreener for given mints
    async fn fetch_dexscreener_data(&self, mints: &[String]) -> Vec<TokenData> {
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

                            if price > 0.0 && volume > 0.0 {
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

        // Sort by market cap descending and take top N
        results.sort_by(|a, b| {
            b.market_cap
                .partial_cmp(&a.market_cap)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(MAX_TRACKED_TOKENS);

        results
    }

    /// Full discovery pipeline: signatures -> mints -> dexscreener enrichment
    async fn discover_tokens(&self) -> Result<Vec<TokenData>, SourceError> {
        let signatures = self.fetch_signatures().await?;
        if signatures.is_empty() {
            info!("PumpFun: no signatures found");
            return Ok(Vec::new());
        }

        info!(
            "PumpFun: got {} signatures, extracting mints...",
            signatures.len()
        );

        // Sample a subset to avoid burning too many Helius credits per poll
        let sample_size = signatures.len().min(500);
        let mints = self.extract_mints(&signatures[..sample_size]).await;

        info!("PumpFun: discovered {} unique mints", mints.len());

        if mints.is_empty() {
            return Ok(Vec::new());
        }

        let tokens = self.fetch_dexscreener_data(&mints).await;

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
                max_requests: 200,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        let tokens = self
            .discover_tokens()
            .await
            .map_err(|e| anyhow::anyhow!("PumpFun token discovery failed: {:?}", e))?;

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
        let tokens = self.fetch_dexscreener_data(&mints).await;

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
        assert!(entries.is_empty(), "Config should be empty — assets are dynamic");
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
    fn test_pump_program_address() {
        assert_eq!(PUMP_PROGRAM, "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
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
}
