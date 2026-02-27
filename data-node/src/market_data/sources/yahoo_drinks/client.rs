//! Yahoo Finance drink commodities & beverage stocks.
//!
//! Tracks coffee/sugar/cocoa/OJ futures and major beverage company stocks.
//! Uses Yahoo Finance v8 chart API (per-symbol endpoint, no auth needed).
//!
//! Strategy: One call per symbol (~12 assets). The v7 batch quote API now
//! requires authentication; the v8 chart API returns current market price
//! in the `meta` field without any auth.
//!
//! API: https://query2.finance.yahoo.com/v8/finance/chart/{symbol}
//! Auth: None (requires browser-like User-Agent)
//! Rate limit: ~2000 calls/hour (conservative: 300/hr)

use std::collections::HashMap;
use std::time::Duration;

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/yahoo_drinks.json");

/// Yahoo Finance v8 chart API base URL
const CHART_API_BASE: &str = "https://query2.finance.yahoo.com/v8/finance/chart";

/// Browser-like User-Agent required by Yahoo Finance
const USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)";

/// Delay between per-symbol requests to avoid rate limiting (ms)
const INTER_REQUEST_DELAY_MS: u64 = 200;

// ── Yahoo v8 chart response types ──

#[derive(Debug, Deserialize)]
struct ChartResponse {
    chart: Option<ChartResult>,
}

#[derive(Debug, Deserialize)]
struct ChartResult {
    result: Option<Vec<ChartEntry>>,
    error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ChartEntry {
    meta: ChartMeta,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChartMeta {
    symbol: Option<String>,
    regular_market_price: Option<f64>,
    chart_previous_close: Option<f64>,
    regular_market_volume: Option<u64>,
}

// ── Source implementation ──

pub struct YahooDrinksMarketSource {
    client: reqwest::Client,
}

impl YahooDrinksMarketSource {
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(USER_AGENT)
            .build()
            .expect("Failed to create HTTP client");
        info!("Yahoo Finance drink commodities source initialized (v8 chart API)");
        Ok(Self { client })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for YahooDrinksMarketSource {
    fn source_id(&self) -> &'static str {
        "yahoo_drinks"
    }
    fn display_name(&self) -> &'static str {
        "Yahoo Drink Markets"
    }
    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }
    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600)
    }
    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 300,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Yahoo drinks fetch_assets: {} assets loaded", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }
        let now = Utc::now();

        // Build asset_id -> (api_ref ticker) lookup from config
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .filter(|e| e.active)
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        // Collect unique tickers and map ticker -> asset_ids
        let mut ticker_to_assets: HashMap<String, Vec<String>> = HashMap::new();
        for asset_id in asset_ids {
            if let Some(ticker) = ref_map.get(asset_id) {
                ticker_to_assets
                    .entry(ticker.clone())
                    .or_default()
                    .push(asset_id.clone());
            } else {
                warn!("Yahoo drinks: unknown asset_id {}", asset_id);
            }
        }

        if ticker_to_assets.is_empty() {
            return Ok(Vec::new());
        }

        let mut results = Vec::with_capacity(asset_ids.len());
        let mut ok_count = 0u32;
        let mut err_count = 0u32;

        for (ticker, asset_ids_for_ticker) in &ticker_to_assets {
            // v8 chart API: one call per symbol, minimal data request
            let url = format!("{}?interval=1d&range=1d", Self::chart_url(ticker));

            let resp = match self.client.get(&url).send().await {
                Ok(r) => r,
                Err(e) => {
                    warn!("Yahoo drinks: request failed for {}: {:?}", ticker, e);
                    err_count += 1;
                    continue;
                }
            };

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                warn!(
                    "Yahoo drinks: HTTP {} for {}: {}",
                    status,
                    ticker,
                    &body[..body.len().min(200)]
                );
                err_count += 1;
                continue;
            }

            let chart_resp: ChartResponse = match resp.json().await {
                Ok(r) => r,
                Err(e) => {
                    warn!("Yahoo drinks: JSON parse error for {}: {:?}", ticker, e);
                    err_count += 1;
                    continue;
                }
            };

            // Extract meta from chart response
            let meta = match chart_resp
                .chart
                .and_then(|c| {
                    if let Some(err) = &c.error {
                        warn!("Yahoo drinks: chart error for {}: {:?}", ticker, err);
                    }
                    c.result
                })
                .and_then(|mut r| if r.is_empty() { None } else { Some(r.remove(0)) })
            {
                Some(entry) => entry.meta,
                None => {
                    warn!("Yahoo drinks: no chart data for {}", ticker);
                    err_count += 1;
                    continue;
                }
            };

            if let Some(price) = meta.regular_market_price {
                let value = Decimal::try_from(price).unwrap_or(Decimal::ZERO);
                let prev = meta
                    .chart_previous_close
                    .and_then(|p| Decimal::try_from(p).ok());
                let change_pct = prev.and_then(|p| {
                    if p.is_zero() {
                        None
                    } else {
                        Some(((value - p) / p) * Decimal::from(100))
                    }
                });
                let volume = meta
                    .regular_market_volume
                    .map(|v| Decimal::from(v));

                for asset_id in asset_ids_for_ticker {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: format!(
                            "DRINK/{}",
                            ticker.replace('=', "").replace('-', "")
                        ),
                        value,
                        prev_close: prev,
                        change_pct,
                        volume_24h: volume,
                        market_cap: None, // v8 chart API doesn't provide market cap
                        fetched_at: now,
                    });
                }

                debug!("Yahoo {} = {} (prev={:?})", ticker, value, prev);
                ok_count += 1;
            } else {
                warn!("Yahoo drinks: no regularMarketPrice for {}", ticker);
                err_count += 1;
            }

            // Small delay between requests to avoid rate limiting
            if ticker_to_assets.len() > 1 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }
        }

        info!(
            "Yahoo drinks: fetched {}/{} prices ({} symbols ok, {} failed)",
            results.len(),
            asset_ids.len(),
            ok_count,
            err_count
        );
        Ok(results)
    }
}

impl YahooDrinksMarketSource {
    /// Build the chart URL for a given ticker symbol.
    /// Handles URL encoding for symbols with special chars (e.g., KC=F, BF-B).
    fn chart_url(ticker: &str) -> String {
        // reqwest handles URL encoding, but = in query strings is ambiguous.
        // For path segments, = and - are safe in URLs so no encoding needed.
        format!("{}/{}", CHART_API_BASE, ticker)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            12,
            "Expected 12 Yahoo drink entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 12);
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(e.active, "{} should be active", e.asset_id);
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(
                e.asset_id.starts_with("yahoodrinks_"),
                "{} should start with yahoodrinks_",
                e.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_drink() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(
                e.symbol.starts_with("DRINK/"),
                "{} should start with DRINK/",
                e.symbol
            );
        }
    }

    #[test]
    fn test_known_tickers() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(refs.contains(&"KC=F"), "Coffee futures should be present");
        assert!(refs.contains(&"KO"), "Coca-Cola should be present");
        assert!(refs.contains(&"SBUX"), "Starbucks should be present");
        assert!(refs.contains(&"BF-B"), "Brown-Forman should be present");
    }

    #[test]
    fn test_chart_url() {
        assert_eq!(
            YahooDrinksMarketSource::chart_url("KC=F"),
            "https://query2.finance.yahoo.com/v8/finance/chart/KC=F"
        );
        assert_eq!(
            YahooDrinksMarketSource::chart_url("BF-B"),
            "https://query2.finance.yahoo.com/v8/finance/chart/BF-B"
        );
        assert_eq!(
            YahooDrinksMarketSource::chart_url("KO"),
            "https://query2.finance.yahoo.com/v8/finance/chart/KO"
        );
    }

    #[test]
    fn test_chart_response_deserialize() {
        let json = r#"{"chart":{"result":[{"meta":{"currency":"USX","symbol":"KC=F","exchangeName":"NYB","regularMarketPrice":284.25,"chartPreviousClose":278.05,"regularMarketVolume":15969},"timestamp":[],"indicators":{"quote":[{}]}}],"error":null}}"#;
        let resp: ChartResponse = serde_json::from_str(json).unwrap();
        let chart = resp.chart.unwrap();
        assert!(chart.error.is_none());
        let results = chart.result.unwrap();
        assert_eq!(results.len(), 1);
        let meta = &results[0].meta;
        assert_eq!(meta.symbol.as_deref(), Some("KC=F"));
        assert_eq!(meta.regular_market_price, Some(284.25));
        assert_eq!(meta.chart_previous_close, Some(278.05));
        assert_eq!(meta.regular_market_volume, Some(15969));
    }

    #[test]
    fn test_chart_response_with_error() {
        let json = r#"{"chart":{"result":null,"error":{"code":"Not Found","description":"No data found, symbol may be delisted"}}}"#;
        let resp: ChartResponse = serde_json::from_str(json).unwrap();
        let chart = resp.chart.unwrap();
        assert!(chart.error.is_some());
        assert!(chart.result.is_none());
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), entries.len(), "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_tickers() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        refs.dedup();
        assert_eq!(
            refs.len(),
            entries.len(),
            "All tickers (api_ref) should be unique"
        );
    }
}
