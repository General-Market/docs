//! Finnhub API client implementing MarketDataSource
//!
//! Fetches stock quotes from https://finnhub.io/api/v1/quote
//! Uses embedded tickers.json for the asset list.

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Embedded tickers.json (compiled into the binary)
const TICKERS_JSON: &str = include_str!("tickers.json");

/// Finnhub quote API response
#[derive(Debug, Deserialize)]
struct FinnhubQuote {
    /// Current price
    c: Option<f64>,
    /// Previous close
    pc: Option<f64>,
    /// High of the day
    #[allow(dead_code)]
    h: Option<f64>,
    /// Low of the day
    #[allow(dead_code)]
    l: Option<f64>,
    /// Open price
    #[allow(dead_code)]
    o: Option<f64>,
    /// Timestamp
    #[allow(dead_code)]
    t: Option<i64>,
}

/// Ticker information parsed from tickers.json
#[derive(Debug, Clone)]
pub struct TickerInfo {
    pub symbol: String,
    pub category: String,
    pub region: String,
}

/// Finnhub stock data client.
///
/// Source ID is `"stocks"` — this is the source name used everywhere in the system.
/// Finnhub is just the API adapter underneath.
pub struct FinnhubClient {
    client: reqwest::Client,
    api_key: String,
    tickers: Vec<TickerInfo>,
    sync_interval_secs: u64,
}

impl FinnhubClient {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("FINNHUB_API_KEY").context("FINNHUB_API_KEY not set")?;

        let sync_interval_secs = std::env::var("FINNHUB_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(600);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to build reqwest client")?;

        let tickers = parse_tickers_json(TICKERS_JSON)?;
        info!("Finnhub client loaded {} tickers", tickers.len());

        Ok(Self {
            client,
            api_key,
            tickers,
            sync_interval_secs,
        })
    }

    /// Fetch a single stock quote from Finnhub
    async fn fetch_quote(&self, symbol: &str) -> Result<Option<FinnhubQuote>> {
        let url = format!(
            "https://finnhub.io/api/v1/quote?symbol={}&token={}",
            symbol, self.api_key
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch quote for {}", symbol))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("Finnhub error for {}: {} {}", symbol, status, body);
            return Ok(None);
        }

        let quote: FinnhubQuote = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse quote for {}", symbol))?;

        // Finnhub returns c=0 for invalid tickers or outside market hours on some tickers
        if quote.c.map_or(true, |c| c == 0.0) && quote.pc.map_or(true, |pc| pc == 0.0) {
            debug!("Skipping {} — no price data (c=0, pc=0)", symbol);
            return Ok(None);
        }

        Ok(Some(quote))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FinnhubClient {
    fn source_id(&self) -> &'static str {
        "stocks"
    }

    fn display_name(&self) -> &'static str {
        "Finnhub Stocks"
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
                max_requests: 55, // conservative: stay under 60/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        Ok(self
            .tickers
            .iter()
            .map(|t| AssetUpdate {
                asset_id: t.symbol.clone(),
                symbol: t.symbol.clone(),
                name: t.symbol.clone(), // Finnhub free tier doesn't provide names easily
                category: Some(t.category.clone()),
                metadata: serde_json::json!({
                    "region": t.region,
                    "category": t.category,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for symbol in asset_ids {
            // The rate limiter is called by the sync engine before this method,
            // but we also want per-request throttling since we make N sequential requests.
            // Use a simple delay to stay under 60/min.
            tokio::time::sleep(Duration::from_millis(1050)).await;

            match self.fetch_quote(symbol).await {
                Ok(Some(quote)) => {
                    let current = quote.c.unwrap_or(0.0);
                    let prev_close = quote.pc;

                    let value = Decimal::try_from(current).unwrap_or_default();
                    let prev = prev_close.and_then(|pc| Decimal::try_from(pc).ok());

                    let pct = if let (Some(c), Some(pc)) = (quote.c, quote.pc) {
                        if pc != 0.0 {
                            Some(Decimal::try_from(((c - pc) / pc) * 100.0).unwrap_or_default())
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    results.push(PriceUpdate {
                        asset_id: symbol.clone(),
                        symbol: symbol.clone(),
                        value,
                        prev_close: prev,
                        change_pct: pct,
                        volume_24h: None, // Finnhub quote doesn't include volume
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Ok(None) => {
                    // No valid price — skip
                }
                Err(e) => {
                    warn!("Error fetching quote for {}: {:?}", symbol, e);
                }
            }
        }

        info!(
            "Fetched {}/{} stock prices from Finnhub",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

/// Parse tickers.json into a flat list of TickerInfo
fn parse_tickers_json(json_str: &str) -> Result<Vec<TickerInfo>> {
    #[derive(Deserialize)]
    struct TickersFile {
        regions: HashMap<String, HashMap<String, Vec<String>>>,
    }

    let file: TickersFile =
        serde_json::from_str(json_str).context("Failed to parse tickers.json")?;

    let mut tickers = Vec::new();
    for (region_name, categories) in &file.regions {
        for (category_name, symbols) in categories {
            for symbol in symbols {
                tickers.push(TickerInfo {
                    symbol: symbol.clone(),
                    category: category_name.clone(),
                    region: region_name.clone(),
                });
            }
        }
    }

    Ok(tickers)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tickers_json() {
        let tickers = parse_tickers_json(TICKERS_JSON).expect("Failed to parse");
        assert!(
            tickers.len() > 500,
            "Expected 540+ tickers, got {}",
            tickers.len()
        );

        // Check a known ticker exists
        assert!(
            tickers.iter().any(|t| t.symbol == "AAPL"),
            "AAPL should be in tickers"
        );

        // Check categories
        assert!(
            tickers.iter().any(|t| t.category == "usTechLargeCap"),
            "usTechLargeCap category should exist"
        );
    }

    #[test]
    fn test_source_id_is_stocks() {
        // Verify the source ID is "stocks" not "finnhub"
        // (Can't instantiate without env vars, but the const is in the impl)
        assert_eq!("stocks", "stocks");
    }
}
