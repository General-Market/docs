//! Binance USDT-margined perpetual funding — uses the LIVE premium index, not the
//! 8-hour-static `lastFundingRate`. The premium is `(markPrice - indexPrice) / indexPrice`,
//! continuously refreshed by Binance and the strongest forward signal of the next funding
//! settlement. Scaled ×10_000 so 0.01% reads as 1.0 in the betting market.
//!
//! Two endpoints:
//! - `/fapi/v1/exchangeInfo` → discover PERPETUAL USDT contracts that are TRADING.
//! - `/fapi/v1/premiumIndex` → markPrice + indexPrice + lastFundingRate per symbol.

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

const EXCHANGE_INFO_URL: &str = "https://fapi.binance.com/fapi/v1/exchangeInfo";
const PREMIUM_INDEX_URL: &str = "https://fapi.binance.com/fapi/v1/premiumIndex";

/// Multiplier — Binance reports rates as decimals (0.0001 = 0.01%). Scaling by 10_000 yields
/// "% × 100", so 0.01% → 1.0 and -0.005% → -0.5. Easier for threshold calibration to chew on.
const FUNDING_SCALE: i64 = 10_000;

#[derive(Debug, Deserialize)]
struct ExchangeInfo {
    symbols: Vec<SymbolInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SymbolInfo {
    symbol: String,
    status: String,
    contract_type: String,
    base_asset: String,
    quote_asset: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PremiumIndex {
    symbol: String,
    #[serde(default)]
    last_funding_rate: Option<String>,
    #[serde(default)]
    mark_price: Option<String>,
    #[serde(default)]
    index_price: Option<String>,
}

pub struct BinanceFuturesFundingMarketSource {
    http: SourceHttpClient,
}

impl BinanceFuturesFundingMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Binance Futures Funding source initialized");
        Ok(Self { http })
    }

    async fn fetch_perpetuals(&self) -> Result<Vec<SymbolInfo>> {
        let info: ExchangeInfo = self
            .http
            .get_json(EXCHANGE_INFO_URL)
            .await
            .map_err(|e| anyhow::anyhow!("exchangeInfo: {e}"))?;

        Ok(info
            .symbols
            .into_iter()
            .filter(|s| {
                s.status == "TRADING" && s.contract_type == "PERPETUAL" && s.quote_asset == "USDT"
            })
            .collect())
    }

    fn scale_funding(raw: &str) -> Option<Decimal> {
        let decimal = Decimal::from_str(raw).ok()?;
        Some(decimal * Decimal::from(FUNDING_SCALE))
    }

    /// Live mark premium = (markPrice - indexPrice) / indexPrice, scaled ×10_000.
    /// This refreshes every Binance tick, unlike `lastFundingRate` which only
    /// updates at the 8-hour funding boundaries.
    fn premium_bps(mark: &str, index: &str) -> Option<Decimal> {
        let m = Decimal::from_str(mark).ok()?;
        let i = Decimal::from_str(index).ok()?;
        if i.is_zero() {
            return None;
        }
        Some((m - i) / i * Decimal::from(FUNDING_SCALE))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BinanceFuturesFundingMarketSource {
    fn source_id(&self) -> &'static str {
        "binance_futures_funding"
    }

    fn display_name(&self) -> &'static str {
        "Binance Futures Funding"
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
        let symbols = self.fetch_perpetuals().await?;
        info!("Binance Funding: {} perpetual contracts discovered", symbols.len());

        let assets = symbols
            .into_iter()
            .map(|s| AssetUpdate {
                asset_id: format!("binancefunding_{}", s.symbol.to_lowercase()),
                symbol: s.base_asset.clone(),
                name: format!("{} Perp Funding", s.base_asset),
                category: Some("crypto".to_string()),
                metadata: serde_json::json!({
                    "subcategory": "funding",
                    "binance_symbol": s.symbol,
                    "base_asset": s.base_asset,
                    "quote_asset": s.quote_asset,
                    "scale": FUNDING_SCALE,
                }),
            })
            .collect();

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let indexes: Vec<PremiumIndex> = self
            .http
            .get_json(PREMIUM_INDEX_URL)
            .await
            .map_err(|e| anyhow::anyhow!("premiumIndex: {e}"))?;

        let funding_map: HashMap<String, &PremiumIndex> = indexes
            .iter()
            .map(|p| (p.symbol.to_lowercase(), p))
            .collect();

        let now = Utc::now();
        let mut out = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let symbol = match asset_id.strip_prefix("binancefunding_") {
                Some(s) => s,
                None => {
                    warn!("Binance Funding: malformed asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            let entry = match funding_map.get(symbol) {
                Some(e) => *e,
                None => continue,
            };

            let mark_str = entry.mark_price.as_deref();
            let index_str = entry.index_price.as_deref();
            let value = match (mark_str, index_str) {
                (Some(m), Some(i)) => match Self::premium_bps(m, i) {
                    Some(v) => v,
                    None => {
                        warn!(
                            "Binance Funding: bad premium for {} (mark={}, index={})",
                            asset_id, m, i
                        );
                        continue;
                    }
                },
                _ => {
                    // Fall back to lastFundingRate if mark/index missing — keeps the
                    // pair listed even on stripped responses.
                    let fallback = entry.last_funding_rate.as_deref().and_then(Self::scale_funding);
                    match fallback {
                        Some(v) => v,
                        None => {
                            warn!("Binance Funding: no usable premium or rate for {}", asset_id);
                            continue;
                        }
                    }
                }
            };

            let mark = mark_str.and_then(|s| Decimal::from_str(s).ok());

            out.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.to_uppercase(),
                value,
                prev_close: mark,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Binance Funding: {}/{} rates returned",
            out.len(),
            asset_ids.len()
        );
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scaling_preserves_sign_and_magnitude() {
        let positive = BinanceFuturesFundingMarketSource::scale_funding("0.0001").unwrap();
        assert_eq!(positive.to_string(), "1.0000");

        let negative = BinanceFuturesFundingMarketSource::scale_funding("-0.00005").unwrap();
        assert_eq!(negative.to_string(), "-0.50000");

        let zero = BinanceFuturesFundingMarketSource::scale_funding("0").unwrap();
        assert!(zero.is_zero());
    }

    #[test]
    fn scaling_rejects_garbage() {
        assert!(BinanceFuturesFundingMarketSource::scale_funding("not_a_number").is_none());
    }

    #[test]
    fn premium_bps_computes_percentage_premium() {
        // mark $100.01, index $100.00 → premium = 0.0001 → ×10000 = 1.0
        let p = BinanceFuturesFundingMarketSource::premium_bps("100.01", "100.00").unwrap();
        assert_eq!(p.to_string(), "1.000000");

        // mark $99.99, index $100.00 → premium = -0.0001 → ×10000 = -1.0
        let n = BinanceFuturesFundingMarketSource::premium_bps("99.99", "100.00").unwrap();
        assert_eq!(n.to_string(), "-1.000000");

        // mark == index → 0
        let z = BinanceFuturesFundingMarketSource::premium_bps("100", "100").unwrap();
        assert!(z.is_zero());

        // index = 0 → None (avoid divide-by-zero)
        assert!(BinanceFuturesFundingMarketSource::premium_bps("1.0", "0").is_none());
    }
}
