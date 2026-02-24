//! Yahoo Finance drink commodities & beverage stocks.
//!
//! Tracks coffee/sugar/cocoa/OJ futures and major beverage company stocks.
//! Uses Yahoo Finance unofficial v8 chart API (no auth needed).
//! Pattern A: sequential ticker fetch, fan-out from API responses.

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

const YAHOO_CHART_URL: &str = "https://query2.finance.yahoo.com/v8/finance/chart";

/// Delay between sequential ticker fetches (ms) to avoid Yahoo rate limiting.
const INTER_REQUEST_DELAY_MS: u64 = 500;

// ── Yahoo v8 chart response types ──

#[derive(Debug, Deserialize)]
struct YahooChartResponse {
    chart: Option<YahooChart>,
}

#[derive(Debug, Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooChartResult>>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResult {
    meta: Option<YahooChartMeta>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooChartMeta {
    regular_market_price: Option<f64>,
    previous_close: Option<f64>,
    regular_market_volume: Option<f64>,
    chart_previous_close: Option<f64>,
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

        // Build asset_id → api_ref lookup from config
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .filter(|e| e.active)
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let ticker = match ref_map.get(asset_id) {
                Some(t) => t,
                None => {
                    warn!("Yahoo drinks: unknown asset_id {}", asset_id);
                    continue;
                }
            };

            // URL-encode ticker (KC=F → KC%3DF)
            let encoded = ticker.replace('=', "%3D");
            let url = format!(
                "{}/{}?interval=1d&range=1d",
                YAHOO_CHART_URL, encoded
            );

            match self.http.get_json::<YahooChartResponse>(&url).await {
                Ok(resp) => {
                    if let Some(meta) = resp.chart
                        .and_then(|c| c.result)
                        .and_then(|r| r.into_iter().next())
                        .and_then(|r| r.meta)
                    {
                        if let Some(price) = meta.regular_market_price {
                            let value = Decimal::try_from(price).unwrap_or(Decimal::ZERO);
                            let prev = meta.previous_close
                                .or(meta.chart_previous_close)
                                .and_then(|p| Decimal::try_from(p).ok());
                            let change_pct = prev.and_then(|p| {
                                if p.is_zero() { None }
                                else { Some(((value - p) / p) * Decimal::from(100)) }
                            });
                            let volume = meta.regular_market_volume
                                .and_then(|v| Decimal::try_from(v).ok());

                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: format!("DRINK/{}", ticker.replace('=', "").replace('-', "")),
                                value,
                                prev_close: prev,
                                change_pct,
                                volume_24h: volume,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Yahoo drinks: failed to fetch {}: {:?}", ticker, e);
                }
            }

            // Rate limit: sleep between requests
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!("Yahoo drinks: fetched {}/{} prices", results.len(), asset_ids.len());
        Ok(results)
    }
}
