//! Yahoo Finance drink commodities & beverage stocks.
//!
//! Tracks coffee/sugar/cocoa/OJ futures and major beverage company stocks.
//! Uses Yahoo Finance v7 quote API (batch endpoint, no auth needed).
//! Single call fetches all tickers at once.

use std::collections::HashMap;
use std::time::Duration;

use anyhow::Result;
use rust_decimal::Decimal;
use chrono::Utc;
use serde::Deserialize;
use tracing::{info, warn};

use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};

const ASSET_JSON: &str = include_str!("../../../config/yahoo_drinks.json");

const YAHOO_QUOTE_URL: &str = "https://query2.finance.yahoo.com/v7/finance/quote";

// ── Yahoo v7 batch quote response types ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooQuoteResponse {
    quote_response: Option<QuoteResponse>,
}

#[derive(Debug, Deserialize)]
struct QuoteResponse {
    result: Option<Vec<QuoteResult>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuoteResult {
    symbol: Option<String>,
    regular_market_price: Option<f64>,
    regular_market_previous_close: Option<f64>,
    regular_market_volume: Option<f64>,
    market_cap: Option<f64>,
}

// ── Source implementation ──

pub struct YahooDrinksMarketSource {
    http: SourceHttpClient,
}

impl YahooDrinksMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 300,
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Yahoo Finance drink commodities source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for YahooDrinksMarketSource {
    fn source_id(&self) -> &'static str { "yahoo_drinks" }
    fn display_name(&self) -> &'static str { "Yahoo Drink Markets" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }
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
        if asset_ids.is_empty() { return Ok(Vec::new()); }
        let now = Utc::now();

        // Build asset_id → (api_ref ticker) lookup from config
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .filter(|e| e.active)
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        // Collect tickers for requested asset_ids
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

        // Build comma-separated symbols list for batch call
        let symbols: Vec<&str> = ticker_to_assets.keys().map(|s| s.as_str()).collect();
        let symbols_param = symbols.join(",");
        let url = format!("{}?symbols={}", YAHOO_QUOTE_URL, symbols_param);

        let mut results = Vec::with_capacity(asset_ids.len());

        match self.http.get_json::<YahooQuoteResponse>(&url).await {
            Ok(resp) => {
                let quotes = resp
                    .quote_response
                    .and_then(|qr| qr.result)
                    .unwrap_or_default();

                for quote in quotes {
                    let symbol = match &quote.symbol {
                        Some(s) => s,
                        None => continue,
                    };

                    let asset_ids_for_ticker = match ticker_to_assets.get(symbol) {
                        Some(ids) => ids,
                        None => continue,
                    };

                    if let Some(price) = quote.regular_market_price {
                        let value = Decimal::try_from(price).unwrap_or(Decimal::ZERO);
                        let prev = quote.regular_market_previous_close
                            .and_then(|p| Decimal::try_from(p).ok());
                        let change_pct = prev.and_then(|p| {
                            if p.is_zero() { None }
                            else { Some(((value - p) / p) * Decimal::from(100)) }
                        });
                        let volume = quote.regular_market_volume
                            .and_then(|v| Decimal::try_from(v).ok());
                        let mcap = quote.market_cap
                            .and_then(|m| Decimal::try_from(m).ok());

                        for asset_id in asset_ids_for_ticker {
                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: format!("DRINK/{}", symbol.replace('=', "").replace('-', "")),
                                value,
                                prev_close: prev,
                                change_pct,
                                volume_24h: volume,
                                market_cap: mcap,
                                fetched_at: now,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                warn!("Yahoo drinks: batch quote failed: {:?}", e);
            }
        }

        info!("Yahoo drinks: fetched {}/{} prices (1 batch call)", results.len(), asset_ids.len());
        Ok(results)
    }
}
