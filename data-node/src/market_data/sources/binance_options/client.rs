//! Binance Options mark prices — BTC/ETH/SOL/BNB contracts expiring within 30 days.
//!
//! Filtering is aggressive on purpose: thousands of strike/expiry combinations exist; the
//! interesting bets are near-the-money, near-dated. We trim at fetch time so dead contracts
//! never enter the database.
//!
//! Two endpoints:
//! - `/eapi/v1/exchangeInfo` → option contract metadata.
//! - `/eapi/v1/mark` → mark prices for all options in one call.

use anyhow::Result;
use chrono::{DateTime, TimeZone, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

const EXCHANGE_INFO_URL: &str = "https://eapi.binance.com/eapi/v1/exchangeInfo";
const MARK_URL: &str = "https://eapi.binance.com/eapi/v1/mark";

const MAX_EXPIRY_DAYS: i64 = 30;
const ALLOWED_UNDERLYINGS: &[&str] = &["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

#[derive(Debug, Deserialize)]
struct ExchangeInfo {
    #[serde(default)]
    #[serde(rename = "optionSymbols")]
    option_symbols: Vec<OptionSymbol>,
}

#[derive(Debug, Deserialize)]
struct OptionSymbol {
    symbol: String,
    underlying: String,
    #[serde(rename = "expiryDate")]
    expiry_date: i64,
    side: String,
    #[serde(rename = "strikePrice")]
    strike_price: String,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OptionMark {
    symbol: String,
    mark_price: String,
}

pub struct BinanceOptionsMarketSource {
    http: SourceHttpClient,
}

impl BinanceOptionsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Binance Options source initialized");
        Ok(Self { http })
    }

    fn underlying_short(underlying: &str) -> &str {
        underlying.strip_suffix("USDT").unwrap_or(underlying)
    }

    fn subcategory_for(underlying: &str) -> String {
        format!("options_{}", Self::underlying_short(underlying).to_lowercase())
    }

    /// Pretty name: `BTC 2026-05-30 $65000 CALL`. Strip trailing zeros off the strike so
    /// "65000.000" reads as "65000" but "0.50" stays "0.5".
    fn format_name(opt: &OptionSymbol) -> Option<String> {
        let ms = opt.expiry_date;
        let secs = ms / 1000;
        let nsecs = ((ms % 1000) * 1_000_000) as u32;
        let expiry: DateTime<Utc> = Utc.timestamp_opt(secs, nsecs).single()?;

        let strike = Decimal::from_str(&opt.strike_price).ok()?.normalize();
        let underlying = Self::underlying_short(&opt.underlying);

        Some(format!(
            "{} {} ${} {}",
            underlying,
            expiry.format("%Y-%m-%d"),
            strike,
            opt.side
        ))
    }

    async fn fetch_active_options(&self) -> Result<Vec<OptionSymbol>> {
        let info: ExchangeInfo = self
            .http
            .get_json(EXCHANGE_INFO_URL)
            .await
            .map_err(|e| anyhow::anyhow!("exchangeInfo: {e}"))?;

        let now_ms = Utc::now().timestamp_millis();
        let cutoff_ms = now_ms + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        let kept: Vec<OptionSymbol> = info
            .option_symbols
            .into_iter()
            .filter(|o| ALLOWED_UNDERLYINGS.contains(&o.underlying.as_str()))
            .filter(|o| o.expiry_date >= now_ms && o.expiry_date <= cutoff_ms)
            .filter(|o| o.status.as_deref().map(|s| s == "TRADING").unwrap_or(true))
            .collect();

        Ok(kept)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BinanceOptionsMarketSource {
    fn source_id(&self) -> &'static str {
        "binance_options"
    }

    fn display_name(&self) -> &'static str {
        "Binance Options"
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
                max_requests: 60,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let options = self.fetch_active_options().await?;
        info!(
            "Binance Options: {} contracts within {}d for {:?}",
            options.len(),
            MAX_EXPIRY_DAYS,
            ALLOWED_UNDERLYINGS
        );

        let assets = options
            .into_iter()
            .filter_map(|opt| {
                let name = Self::format_name(&opt)?;
                Some(AssetUpdate {
                    asset_id: format!("binanceoptions_{}", opt.symbol.to_lowercase()),
                    symbol: opt.symbol.clone(),
                    name,
                    category: Some("crypto".to_string()),
                    metadata: serde_json::json!({
                        "subcategory": Self::subcategory_for(&opt.underlying),
                        "binance_symbol": opt.symbol,
                        "underlying": opt.underlying,
                        "side": opt.side,
                        "strike_price": opt.strike_price,
                        "expiry_date_ms": opt.expiry_date,
                    }),
                })
            })
            .collect();

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let marks: Vec<OptionMark> = self
            .http
            .get_json(MARK_URL)
            .await
            .map_err(|e| anyhow::anyhow!("mark: {e}"))?;

        let mark_map: HashMap<String, &str> = marks
            .iter()
            .map(|m| (m.symbol.to_lowercase(), m.mark_price.as_str()))
            .collect();

        let now = Utc::now();
        let mut out = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let symbol = match asset_id.strip_prefix("binanceoptions_") {
                Some(s) => s,
                None => {
                    warn!("Binance Options: malformed asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            let mark_str = match mark_map.get(symbol) {
                Some(p) => *p,
                None => continue,
            };

            let value = match Decimal::from_str(mark_str) {
                Ok(v) => v,
                Err(e) => {
                    warn!(
                        "Binance Options: bad mark price for {} ({}): {}",
                        asset_id, mark_str, e
                    );
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

        info!(
            "Binance Options: {}/{} marks returned",
            out.len(),
            asset_ids.len()
        );
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_option() -> OptionSymbol {
        OptionSymbol {
            symbol: "BTC-260530-65000-C".to_string(),
            underlying: "BTCUSDT".to_string(),
            // 2026-05-30 00:00:00 UTC
            expiry_date: 1779488000000,
            side: "CALL".to_string(),
            strike_price: "65000.000".to_string(),
            status: Some("TRADING".to_string()),
        }
    }

    #[test]
    fn underlying_short_strips_usdt() {
        assert_eq!(BinanceOptionsMarketSource::underlying_short("BTCUSDT"), "BTC");
        assert_eq!(BinanceOptionsMarketSource::underlying_short("ETHUSDT"), "ETH");
        assert_eq!(BinanceOptionsMarketSource::underlying_short("XYZ"), "XYZ");
    }

    #[test]
    fn subcategory_uses_lowercase_short_name() {
        assert_eq!(
            BinanceOptionsMarketSource::subcategory_for("BTCUSDT"),
            "options_btc"
        );
        assert_eq!(
            BinanceOptionsMarketSource::subcategory_for("SOLUSDT"),
            "options_sol"
        );
    }

    #[test]
    fn name_has_iso_date_dollar_strike_side() {
        let name = BinanceOptionsMarketSource::format_name(&sample_option()).unwrap();
        assert!(name.starts_with("BTC "), "got {name}");
        assert!(name.contains("$65000"), "got {name}");
        assert!(name.ends_with(" CALL"), "got {name}");
    }
}
