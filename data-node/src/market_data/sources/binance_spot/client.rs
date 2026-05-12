//! Binance Spot USDT pairs — live spot prices.
//!
//! Two endpoints:
//! - `/api/v3/exchangeInfo` → asset discovery (TRADING USDT pairs, minus leveraged tokens).
//! - `/api/v3/ticker/price` → all symbol prices in one shot.
//!
//! Auth: none. Public, weight-rated (6000/min combined). 30/min keeps us far below the ceiling.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

const EXCHANGE_INFO_URL: &str = "https://api.binance.com/api/v3/exchangeInfo";
const TICKER_PRICE_URL: &str = "https://api.binance.com/api/v3/ticker/price";

/// Suffixes Binance appends to base assets for leveraged tokens. Filtered out — they
/// decay to zero and confuse the threshold engine.
const LEVERAGED_SUFFIXES: &[&str] = &["UP", "DOWN", "BULL", "BEAR", "3L", "3S", "5L", "5S"];

#[derive(Debug, Deserialize)]
struct ExchangeInfo {
    symbols: Vec<SymbolInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SymbolInfo {
    symbol: String,
    status: String,
    base_asset: String,
    quote_asset: String,
}

#[derive(Debug, Deserialize)]
struct TickerPrice {
    symbol: String,
    price: String,
}

pub struct BinanceSpotMarketSource {
    http: SourceHttpClient,
}

impl BinanceSpotMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Binance Spot source initialized");
        Ok(Self { http })
    }

    fn is_leveraged_token(base_asset: &str) -> bool {
        LEVERAGED_SUFFIXES
            .iter()
            .any(|suffix| base_asset.ends_with(suffix) && base_asset.len() > suffix.len())
    }

    async fn fetch_usdt_symbols(&self) -> Result<Vec<SymbolInfo>> {
        let info: ExchangeInfo = self
            .http
            .get_json(EXCHANGE_INFO_URL)
            .await
            .map_err(|e| anyhow::anyhow!("exchangeInfo: {e}"))?;

        let kept: Vec<SymbolInfo> = info
            .symbols
            .into_iter()
            .filter(|s| s.status == "TRADING" && s.quote_asset == "USDT")
            .filter(|s| !Self::is_leveraged_token(&s.base_asset))
            .collect();

        Ok(kept)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BinanceSpotMarketSource {
    fn source_id(&self) -> &'static str {
        "binance_spot"
    }

    fn display_name(&self) -> &'static str {
        "Binance Spot"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let symbols = self.fetch_usdt_symbols().await?;
        info!("Binance Spot: {} USDT pairs discovered", symbols.len());

        let assets = symbols
            .into_iter()
            .map(|s| AssetUpdate {
                asset_id: format!("binancespot_{}", s.symbol.to_lowercase()),
                symbol: s.base_asset.clone(),
                name: format!("{} (Binance Spot)", s.base_asset),
                category: Some("crypto".to_string()),
                metadata: serde_json::json!({
                    "subcategory": "spot",
                    "binance_symbol": s.symbol,
                    "base_asset": s.base_asset,
                    "quote_asset": s.quote_asset,
                }),
            })
            .collect();

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let tickers: Vec<TickerPrice> = self
            .http
            .get_json(TICKER_PRICE_URL)
            .await
            .map_err(|e| anyhow::anyhow!("ticker/price: {e}"))?;

        let price_map: HashMap<String, &str> = tickers
            .iter()
            .map(|t| (t.symbol.to_lowercase(), t.price.as_str()))
            .collect();

        let now = Utc::now();
        let mut out = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let symbol = match asset_id.strip_prefix("binancespot_") {
                Some(s) => s,
                None => {
                    warn!("Binance Spot: malformed asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            let price_str = match price_map.get(symbol) {
                Some(p) => *p,
                None => continue,
            };

            let value = match Decimal::from_str(price_str) {
                Ok(v) => v,
                Err(e) => {
                    warn!("Binance Spot: bad price for {} ({}): {}", asset_id, price_str, e);
                    continue;
                }
            };

            out.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.to_uppercase(),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!("Binance Spot: {}/{} prices returned", out.len(), asset_ids.len());
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leveraged_token_filter() {
        assert!(BinanceSpotMarketSource::is_leveraged_token("BTCUP"));
        assert!(BinanceSpotMarketSource::is_leveraged_token("ETHDOWN"));
        assert!(BinanceSpotMarketSource::is_leveraged_token("BTCBULL"));
        assert!(BinanceSpotMarketSource::is_leveraged_token("ETHBEAR"));
        assert!(BinanceSpotMarketSource::is_leveraged_token("BTC3L"));
        assert!(BinanceSpotMarketSource::is_leveraged_token("ETH5S"));

        assert!(!BinanceSpotMarketSource::is_leveraged_token("BTC"));
        assert!(!BinanceSpotMarketSource::is_leveraged_token("ETH"));
        assert!(!BinanceSpotMarketSource::is_leveraged_token("SOL"));
        // Exact-match edges: a base asset literally named "UP" wouldn't be a leveraged
        // token but doesn't exist on Binance — and len-greater-than-suffix guards it anyway.
        assert!(!BinanceSpotMarketSource::is_leveraged_token("UP"));
    }
}
