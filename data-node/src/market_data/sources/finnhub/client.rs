//! Finnhub API client implementing MarketDataSource
//!
//! Fetches stock quotes from https://finnhub.io/api/v1/quote
//! Uses config/stocks.json for the asset list.
//!
//! ## Rolling batch mode
//!
//! Instead of fetching all stocks in one long cycle, this client fetches
//! `BATCH_SIZE` stocks per call using an internal cursor. The sync engine
//! calls `fetch_prices()` every few seconds, and each call advances through
//! the stock list. This produces a continuous stream of price updates rather
//! than a burst every N minutes.

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Mutex;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// Number of stocks to fetch per sync cycle.
/// At ~1050ms per request, 55 stocks ≈ 58 seconds per batch.
/// Stays under Finnhub's 60 req/min free-tier limit.
const BATCH_SIZE: usize = 55;

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/stocks.json");

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

/// Finnhub stock data client.
///
/// Source ID is `"stocks"` — this is the source name used everywhere in the system.
/// Finnhub is just the API adapter underneath.
///
/// Uses rolling batch mode: each `fetch_prices()` call processes only
/// `BATCH_SIZE` stocks, advancing an internal cursor. The sync engine
/// calls this frequently (default every 5s) to produce continuous updates.
pub struct FinnhubClient {
    http: SourceHttpClient,
    api_key: String,
    sync_interval_secs: u64,
    /// Cursor position in the asset list — advances by BATCH_SIZE each call
    batch_cursor: Mutex<usize>,
}

impl FinnhubClient {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("FINNHUB_API_KEY").context("FINNHUB_API_KEY not set")?;

        // Default 5s: just a short pause between batches.
        // The actual pacing comes from the per-request delay inside fetch_prices.
        let sync_interval_secs = std::env::var("FINNHUB_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(5);

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 55,
                duration: Duration::from_secs(60),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to build reqwest client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!(
            "Finnhub client initialized: {} tickers, batch_size={}, interval={}s",
            asset_count, BATCH_SIZE, sync_interval_secs
        );

        Ok(Self {
            http,
            api_key,
            sync_interval_secs,
            batch_cursor: Mutex::new(0),
        })
    }

    /// Fetch a single stock quote from Finnhub
    async fn fetch_quote(&self, symbol: &str) -> Result<Option<FinnhubQuote>> {
        let url = format!(
            "https://finnhub.io/api/v1/quote?symbol={}&token={}",
            symbol, self.api_key
        );

        let quote: FinnhubQuote = match self.http.get_json(&url).await {
            Ok(q) => q,
            Err(e) => {
                warn!("Finnhub error for {}: {}", symbol, e);
                return Ok(None);
            }
        };

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
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(vec![]);
        }

        let total = asset_ids.len();

        // Determine which batch to fetch using the rolling cursor
        let (start, batch): (usize, Vec<String>) = {
            let mut cursor = self.batch_cursor.lock().unwrap();
            // Reset cursor if it's past the end (assets list may have shrunk)
            if *cursor >= total {
                *cursor = 0;
            }
            let start = *cursor;
            let end = (start + BATCH_SIZE).min(total);
            let batch = asset_ids[start..end].to_vec();
            // Advance cursor; wrap to 0 when we've covered all stocks
            *cursor = if end >= total { 0 } else { end };
            (start, batch)
        };

        let now = Utc::now();
        let mut results = Vec::new();

        for symbol in &batch {
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
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Ok(None) => {}
                Err(e) => {
                    warn!("Error fetching quote for {}: {:?}", symbol, e);
                }
            }
        }

        info!(
            "Fetched {}/{} stock prices (batch {}-{}/{} total)",
            results.len(),
            batch.len(),
            start,
            start + batch.len(),
            total
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
        assert_eq!(entries.len(), 780, "Expected 780 stock tickers");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        for asset in &assets {
            assert_eq!(asset.category, Some("stocks".to_string()));
        }
    }

    #[test]
    fn test_known_tickers_exist() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        assert!(symbols.contains(&"AAPL"), "AAPL should be in tickers");
        assert!(symbols.contains(&"MSFT"), "MSFT should be in tickers");
        assert!(symbols.contains(&"GOOGL"), "GOOGL should be in tickers");
    }

    #[test]
    fn test_subcategories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<&str> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"tech"));
        assert!(subcats.contains(&"financials"));
        assert!(subcats.contains(&"healthcare"));
    }

    #[test]
    fn test_batch_cursor_advances() {
        let cursor = Mutex::new(0usize);
        let total = 150;

        // First batch: 0..55
        {
            let mut c = cursor.lock().unwrap();
            let start = *c;
            let end = (start + BATCH_SIZE).min(total);
            *c = if end >= total { 0 } else { end };
            assert_eq!(start, 0);
            assert_eq!(end, 55);
            assert_eq!(*c, 55);
        }

        // Second batch: 55..110
        {
            let mut c = cursor.lock().unwrap();
            let start = *c;
            let end = (start + BATCH_SIZE).min(total);
            *c = if end >= total { 0 } else { end };
            assert_eq!(start, 55);
            assert_eq!(end, 110);
            assert_eq!(*c, 110);
        }

        // Third batch: 110..150 (partial, wraps cursor to 0)
        {
            let mut c = cursor.lock().unwrap();
            let start = *c;
            let end = (start + BATCH_SIZE).min(total);
            *c = if end >= total { 0 } else { end };
            assert_eq!(start, 110);
            assert_eq!(end, 150);
            assert_eq!(*c, 0); // wrapped
        }

        // Fourth batch: back to 0..55
        {
            let c = cursor.lock().unwrap();
            assert_eq!(*c, 0);
        }
    }

    #[test]
    fn test_batch_cursor_resets_on_shrink() {
        // If asset list shrinks, cursor should reset to 0
        let cursor = Mutex::new(200usize); // cursor past end
        let total = 100;

        let mut c = cursor.lock().unwrap();
        if *c >= total {
            *c = 0;
        }
        assert_eq!(*c, 0);
    }

    #[test]
    fn test_batch_size_constant() {
        assert_eq!(BATCH_SIZE, 55);
    }
}
