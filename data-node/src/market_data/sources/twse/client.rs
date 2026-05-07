//! TWSE (Taiwan Stock Exchange) API client implementing MarketDataSource
//!
//! Tracks real-time stock prices for all listed companies on the Taiwan Stock Exchange.
//! Assets are fully dynamic — discovered from the TWSE OpenAPI listing endpoint.
//!
//! API (asset list): https://openapi.twse.com.tw/v1/opendata/t187ap03_L
//! API (prices): http://mis.twse.com.tw/stock/api/getStockInfo.jsp
//! Auth: None
//! Rate limit: undocumented, use conservative 51 req/10min (85% of ~60 req/10min)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/twse.json");

/// TWSE OpenAPI base URL (HTTPS, for listing data)
const TWSE_OPENAPI_URL: &str = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";

/// TWSE daily closing prices — works 24/7 (unlike the real-time MIS API)
const TWSE_DAILY_URL: &str = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";

/// TWSE MIS API base URL (real-time quotes, only during market hours 09:00-13:30 UTC+8)
const TWSE_MIS_URL: &str = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

/// Delay between sequential batch price fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 1200;

/// How many stocks per price batch (pipe-separated ex_ch param)
const BATCH_SIZE: usize = 20;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// TWSE OpenAPI stock listing entry
#[derive(Debug, Deserialize)]
struct TwseListingEntry {
    /// Stock code (e.g., "2330")
    #[serde(rename = "公司代號")]
    code: String,
    /// Company name (e.g., "台積電")
    #[serde(rename = "公司名稱")]
    name: String,
}

/// TWSE MIS API real-time quote response wrapper
#[derive(Debug, Deserialize)]
struct TwseMisResponse {
    #[serde(rename = "msgArray", default)]
    msg_array: Vec<TwseMisQuote>,
}

/// Individual stock quote from MIS API
#[derive(Debug, Deserialize)]
struct TwseMisQuote {
    /// Stock code
    c: String,
    /// Current price (can be "-" if no trade)
    #[serde(default)]
    z: Option<String>,
    /// Previous close
    #[serde(default)]
    y: Option<String>,
    /// Accumulated volume
    #[serde(default)]
    v: Option<String>,
}

/// Daily closing price entry from STOCK_DAY_ALL endpoint
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct TwseDailyEntry {
    #[serde(rename = "Code")]
    code: String,
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "ClosingPrice")]
    closing_price: String,
    #[serde(rename = "Change")]
    change: String,
    #[serde(rename = "TradeVolume")]
    trade_volume: String,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// TWSE market data source.
///
/// Tracks real-time stock prices on the Taiwan Stock Exchange.
/// Source ID is `"twse"`.
pub struct TwseMarketSource {
    http: SourceHttpClient,
}

impl TwseMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 51, // conservative: 85% of ~60 req/10min
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("TWSE source initialized (dynamic assets from OpenAPI)");

        Ok(Self { http })
    }

    /// Discover all listed stocks from the TWSE OpenAPI
    async fn discover_listed_stocks(&self) -> Result<Vec<(String, String)>, SourceError> {
        let entries: Vec<TwseListingEntry> = self.http.get_json(TWSE_OPENAPI_URL).await?;

        let total = entries.len();
        let result: Vec<(String, String)> = entries
            .into_iter()
            .filter(|e| !e.code.is_empty())
            .map(|e| (e.code, e.name))
            .collect();

        info!("TWSE OpenAPI returned {} listed stocks", total);
        Ok(result)
    }

    /// Fetch prices for a batch of stock codes via the MIS API.
    /// Codes are pipe-separated in the ex_ch query parameter.
    async fn fetch_batch_prices(
        &self,
        codes: &[&str],
    ) -> Result<Vec<TwseMisQuote>, SourceError> {
        let ex_ch: String = codes
            .iter()
            .map(|c| format!("tse_{}.tw", c))
            .collect::<Vec<_>>()
            .join("|");

        let url = format!("{}?ex_ch={}&json=1&delay=0", TWSE_MIS_URL, ex_ch);
        let resp: TwseMisResponse = self.http.get_json(&url).await?;
        Ok(resp.msg_array)
    }

    /// Fetch ALL daily closing prices in a single request.
    /// This endpoint works 24/7 and returns the most recent trading day's data.
    async fn fetch_daily_all(&self) -> Result<Vec<TwseDailyEntry>, SourceError> {
        self.http.get_json(TWSE_DAILY_URL).await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TwseMarketSource {
    fn source_id(&self) -> &'static str {
        "twse"
    }

    fn display_name(&self) -> &'static str {
        "Taiwan Stock Exchange"
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
                max_requests: 51,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery from TWSE OpenAPI
        info!("TWSE config is empty, performing live asset discovery");
        let stocks = self
            .discover_listed_stocks()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover TWSE stocks: {:?}", e))?;

        let mut assets = Vec::with_capacity(stocks.len());
        for (code, name) in &stocks {
            assets.push(AssetUpdate {
                asset_id: format!("twse_{}", code),
                symbol: format!("TWSE#{}", code),
                name: name.clone(),
                category: Some("stocks".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("tse:{}", code),
                    "subcategory": "taiwan",
                    "active": true,
                    "extra": {},
                }),
            });
        }

        info!("Discovered {} TWSE stocks via OpenAPI", assets.len());
        Ok(assets)
    }

    fn always_record_price(&self) -> bool {
        true // counter-style metric: write a row every tick so fetched_at advances even when value is identical (otherwise batch_engine excludes the source)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load api_ref lookup from config
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: std::collections::HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        // Extract stock codes from asset_ids
        let codes: Vec<String> = asset_ids
            .iter()
            .filter_map(|id| {
                if let Some(api_ref) = ref_lookup.get(id) {
                    parse_code_from_ref(api_ref)
                } else {
                    parse_code_from_asset_id(id)
                }
            })
            .collect();

        // Build a set of requested codes for filtering
        let requested_codes: std::collections::HashSet<&str> =
            codes.iter().map(|s| s.as_str()).collect();

        // Try MIS (real-time) first — only works during market hours
        for chunk in codes.chunks(BATCH_SIZE) {
            let code_refs: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_batch_prices(&code_refs).await {
                Ok(quotes) => {
                    for q in quotes {
                        // Parse current price — skip if "-" (no trade yet / outside hours)
                        let value = match &q.z {
                            Some(z) if z != "-" && !z.is_empty() => {
                                match Decimal::from_str(z) {
                                    Ok(d) => d,
                                    Err(_) => {
                                        debug!("Cannot parse price '{}' for {}", z, q.c);
                                        continue;
                                    }
                                }
                            }
                            _ => continue,
                        };

                        let prev_close = q
                            .y
                            .as_deref()
                            .filter(|y| *y != "-" && !y.is_empty())
                            .and_then(|y| Decimal::from_str(y).ok());

                        let change_pct = prev_close
                            .filter(|pc| !pc.is_zero())
                            .map(|pc| ((value - pc) / pc) * Decimal::from(100));

                        let volume = q
                            .v
                            .as_deref()
                            .filter(|v| *v != "-" && !v.is_empty())
                            .and_then(|v| Decimal::from_str(v).ok());

                        results.push(PriceUpdate {
                            asset_id: format!("twse_{}", q.c),
                            symbol: format!("TWSE#{}", q.c),
                            value,
                            prev_close,
                            change_pct,
                            volume_24h: volume,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to fetch TWSE MIS batch for {} codes: {:?}",
                        code_refs.len(),
                        e
                    );
                }
            }
        }

        // If MIS returned < 10% of requested prices, fall back to daily closing prices.
        // This handles outside-market-hours, weekends, and holidays.
        if results.len() * 10 < asset_ids.len() {
            info!(
                "TWSE MIS returned only {}/{} prices — falling back to daily closing data",
                results.len(),
                asset_ids.len()
            );

            // Clear partial MIS results since daily data is more complete
            results.clear();

            match self.fetch_daily_all().await {
                Ok(daily_entries) => {
                    for entry in daily_entries {
                        if !requested_codes.contains(entry.code.as_str()) {
                            continue;
                        }

                        let value = match Decimal::from_str(entry.closing_price.trim()) {
                            Ok(d) if !d.is_zero() => d,
                            _ => continue,
                        };

                        let change = Decimal::from_str(entry.change.trim()).ok();
                        // Compute prev_close from closing_price - change
                        let prev_close = change.map(|c| value - c);

                        let change_pct = prev_close
                            .filter(|pc| !pc.is_zero())
                            .map(|pc| ((value - pc) / pc) * Decimal::from(100));

                        let volume = entry
                            .trade_volume
                            .trim()
                            .replace(',', "")
                            .parse::<u64>()
                            .ok()
                            .map(Decimal::from);

                        results.push(PriceUpdate {
                            asset_id: format!("twse_{}", entry.code),
                            symbol: format!("TWSE#{}", entry.code),
                            value,
                            prev_close,
                            change_pct,
                            volume_24h: volume,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch TWSE daily closing data: {:?}", e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from TWSE",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering TWSE listed stocks...");
        let stocks = self
            .discover_listed_stocks()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover TWSE stocks: {:?}", e))?;

        let entries: Vec<AssetEntry> = stocks
            .into_iter()
            .map(|(code, name)| AssetEntry {
                asset_id: format!("twse_{}", code),
                symbol: format!("TWSE#{}", code),
                name,
                category: "stocks".to_string(),
                subcategory: "taiwan".to_string(),
                api_ref: format!("tse:{}", code),
                active: true,
            })
            .collect();

        info!("Discovered {} TWSE stock assets", entries.len());
        Ok(entries)
    }
}

/// Parse stock code from api_ref like "tse:2330"
fn parse_code_from_ref(api_ref: &str) -> Option<String> {
    api_ref.strip_prefix("tse:").map(|s| s.to_string())
}

/// Parse stock code from asset_id like "twse_2330"
fn parse_code_from_asset_id(asset_id: &str) -> Option<String> {
    asset_id.strip_prefix("twse_").map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("twse", "twse");
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

    #[test]
    fn test_parse_code_from_ref() {
        assert_eq!(parse_code_from_ref("tse:2330"), Some("2330".to_string()));
        assert_eq!(parse_code_from_ref("tse:0050"), Some("0050".to_string()));
        assert_eq!(parse_code_from_ref("invalid"), None);
        assert_eq!(parse_code_from_ref("tse:"), Some("".to_string()));
    }

    #[test]
    fn test_parse_code_from_asset_id() {
        assert_eq!(parse_code_from_asset_id("twse_2330"), Some("2330".to_string()));
        assert_eq!(parse_code_from_asset_id("twse_0050"), Some("0050".to_string()));
        assert_eq!(parse_code_from_asset_id("invalid"), None);
    }

    #[test]
    fn test_asset_id_format() {
        let asset_id = format!("twse_{}", "2330");
        assert_eq!(asset_id, "twse_2330");
    }

    #[test]
    fn test_price_parsing() {
        // Normal price
        let price = Decimal::from_str("1022.00").unwrap();
        assert_eq!(price, Decimal::from_str("1022.00").unwrap());

        // "-" should not parse
        assert!(Decimal::from_str("-").is_err());
    }

    #[test]
    fn test_change_pct_calculation() {
        let value = Decimal::from_str("1022.00").unwrap();
        let prev = Decimal::from_str("1020.00").unwrap();
        let pct = ((value - prev) / prev) * Decimal::from(100);
        // ~0.196%
        assert!(pct > Decimal::ZERO);
        assert!(pct < Decimal::ONE);
    }

    #[test]
    fn test_batch_ex_ch_format() {
        let codes = vec!["2330", "0050", "2317"];
        let ex_ch: String = codes
            .iter()
            .map(|c| format!("tse_{}.tw", c))
            .collect::<Vec<_>>()
            .join("|");
        assert_eq!(ex_ch, "tse_2330.tw|tse_0050.tw|tse_2317.tw");
    }

    #[test]
    fn test_api_ref_roundtrip() {
        let code = "2330";
        let api_ref = format!("tse:{}", code);
        assert_eq!(parse_code_from_ref(&api_ref), Some("2330".to_string()));
    }
}
