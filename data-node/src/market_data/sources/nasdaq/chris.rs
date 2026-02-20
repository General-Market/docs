//! CHRIS Continuous Futures data source
//!
//! Fetches continuous futures contract prices via Nasdaq Data Link.
//! Data updated daily at end of day.
//!
//! Provides 50 continuous contracts across indices, energy, metals,
//! agriculture, rates, currencies, and volatility.

use anyhow::Result;
use chrono::{DateTime, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use super::client::NasdaqClient;
use crate::market_data::traits::{
    is_us_market_closed, next_us_trading_day, today_at_eastern, AssetUpdate, MarketDataSource,
    PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// CHRIS continuous contract definitions
/// (code, asset_id, name, category, unit)
const CHRIS_CONTRACTS: &[(&str, &str, &str, &str, &str)] = &[
    // Equity Indices
    ("CME_ES1", "chris_es", "S&P 500 E-mini", "indices", "points"),
    (
        "CME_NQ1",
        "chris_nq",
        "Nasdaq 100 E-mini",
        "indices",
        "points",
    ),
    (
        "CME_YM1",
        "chris_ym",
        "Dow Jones E-mini",
        "indices",
        "points",
    ),
    (
        "CME_RTY1",
        "chris_rty",
        "Russell 2000 E-mini",
        "indices",
        "points",
    ),
    (
        "EUREX_FESX1",
        "chris_fesx",
        "Euro Stoxx 50",
        "indices",
        "points",
    ),
    ("EUREX_FDAX1", "chris_fdax", "DAX", "indices", "points"),
    // Energy
    (
        "CME_CL1",
        "chris_cl",
        "WTI Crude Oil",
        "energy",
        "usd_per_barrel",
    ),
    (
        "CME_NG1",
        "chris_ng",
        "Natural Gas",
        "energy",
        "usd_per_mmbtu",
    ),
    (
        "CME_RB1",
        "chris_rb",
        "RBOB Gasoline",
        "energy",
        "usd_per_gallon",
    ),
    (
        "CME_HO1",
        "chris_ho",
        "Heating Oil",
        "energy",
        "usd_per_gallon",
    ),
    (
        "ICE_B1",
        "chris_brent",
        "Brent Crude Oil",
        "energy",
        "usd_per_barrel",
    ),
    // Metals
    ("CME_GC1", "chris_gc", "Gold", "metals", "usd_per_oz"),
    ("CME_SI1", "chris_si", "Silver", "metals", "usd_per_oz"),
    ("CME_HG1", "chris_hg", "Copper", "metals", "usd_per_lb"),
    ("CME_PL1", "chris_pl", "Platinum", "metals", "usd_per_oz"),
    ("CME_PA1", "chris_pa", "Palladium", "metals", "usd_per_oz"),
    // Agriculture
    (
        "CBOT_ZC1",
        "chris_zc",
        "Corn",
        "agriculture",
        "cents_per_bushel",
    ),
    (
        "CBOT_ZS1",
        "chris_zs",
        "Soybeans",
        "agriculture",
        "cents_per_bushel",
    ),
    (
        "CBOT_ZW1",
        "chris_zw",
        "Wheat",
        "agriculture",
        "cents_per_bushel",
    ),
    (
        "CBOT_ZM1",
        "chris_zm",
        "Soybean Meal",
        "agriculture",
        "usd_per_ton",
    ),
    (
        "CBOT_ZL1",
        "chris_zl",
        "Soybean Oil",
        "agriculture",
        "cents_per_lb",
    ),
    (
        "ICE_KC1",
        "chris_kc",
        "Coffee",
        "agriculture",
        "cents_per_lb",
    ),
    (
        "ICE_SB1",
        "chris_sb",
        "Sugar #11",
        "agriculture",
        "cents_per_lb",
    ),
    ("ICE_CC1", "chris_cc", "Cocoa", "agriculture", "usd_per_ton"),
    (
        "ICE_CT1",
        "chris_ct",
        "Cotton",
        "agriculture",
        "cents_per_lb",
    ),
    (
        "CME_LE1",
        "chris_le",
        "Live Cattle",
        "agriculture",
        "cents_per_lb",
    ),
    (
        "CME_HE1",
        "chris_he",
        "Lean Hogs",
        "agriculture",
        "cents_per_lb",
    ),
    // Interest Rates
    ("CBOT_ZB1", "chris_zb", "30-Year T-Bond", "rates", "points"),
    ("CBOT_ZN1", "chris_zn", "10-Year T-Note", "rates", "points"),
    ("CBOT_ZF1", "chris_zf", "5-Year T-Note", "rates", "points"),
    ("CBOT_ZT1", "chris_zt", "2-Year T-Note", "rates", "points"),
    ("CME_GE1", "chris_ge", "Eurodollar", "rates", "points"),
    ("EUREX_FGBL1", "chris_bund", "Euro Bund", "rates", "points"),
    // Currencies
    (
        "CME_EC1",
        "chris_ec",
        "Euro FX",
        "currencies",
        "usd_per_eur",
    ),
    (
        "CME_JY1",
        "chris_jy",
        "Japanese Yen",
        "currencies",
        "usd_per_jpy",
    ),
    (
        "CME_BP1",
        "chris_bp",
        "British Pound",
        "currencies",
        "usd_per_gbp",
    ),
    (
        "CME_SF1",
        "chris_sf",
        "Swiss Franc",
        "currencies",
        "usd_per_chf",
    ),
    (
        "CME_CD1",
        "chris_cd",
        "Canadian Dollar",
        "currencies",
        "usd_per_cad",
    ),
    (
        "CME_AD1",
        "chris_ad",
        "Australian Dollar",
        "currencies",
        "usd_per_aud",
    ),
    (
        "ICE_DX1",
        "chris_dx",
        "US Dollar Index",
        "currencies",
        "index",
    ),
    // Volatility
    ("CBOE_VX1", "chris_vx", "VIX Futures", "volatility", "index"),
    // Additional contracts to reach 50
    (
        "CME_NIY1",
        "chris_niy",
        "Nikkei 225 (Yen)",
        "indices",
        "points",
    ),
    (
        "SGX_NK1",
        "chris_nk",
        "Nikkei 225 (SGX)",
        "indices",
        "points",
    ),
    (
        "HKEX_HSI1",
        "chris_hsi",
        "Hang Seng Index",
        "indices",
        "points",
    ),
    (
        "CME_NZ1",
        "chris_nz",
        "New Zealand Dollar",
        "currencies",
        "usd_per_nzd",
    ),
    (
        "CME_MP1",
        "chris_mp",
        "Mexican Peso",
        "currencies",
        "usd_per_mxn",
    ),
    (
        "CME_BR1",
        "chris_br",
        "Brazilian Real",
        "currencies",
        "usd_per_brl",
    ),
    (
        "CME_RU1",
        "chris_ru",
        "Russian Ruble",
        "currencies",
        "usd_per_rub",
    ),
    (
        "CBOT_ZO1",
        "chris_zo",
        "Oats",
        "agriculture",
        "cents_per_bushel",
    ),
    (
        "CBOT_ZR1",
        "chris_zr",
        "Rough Rice",
        "agriculture",
        "cents_per_cwt",
    ),
];

/// Nasdaq dataset response structure
#[derive(Debug, Deserialize)]
struct NasdaqDatasetResponse {
    dataset: NasdaqDataset,
}

#[derive(Debug, Deserialize)]
struct NasdaqDataset {
    column_names: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

/// CHRIS market data source
pub struct ChrisMarketSource {
    client: NasdaqClient,
}

impl ChrisMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        info!(
            "CHRIS client initialized with {} contracts",
            CHRIS_CONTRACTS.len()
        );
        Ok(Self { client })
    }

    /// Fetch price for a contract
    async fn fetch_contract(&self, contract_code: &str) -> Result<Option<ChrisPrice>> {
        let dataset_code = format!("CHRIS/{}", contract_code);

        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset(&dataset_code, 1).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to fetch CHRIS contract {}: {:?}", contract_code, e);
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
            debug!("No CHRIS data for {}", contract_code);
            return Ok(None);
        }

        let row = &resp.dataset.data[0];
        let columns = &resp.dataset.column_names;

        // Find column indices
        let get_value = |name: &str| -> Option<f64> {
            columns
                .iter()
                .position(|c| c.to_lowercase().contains(&name.to_lowercase()))
                .and_then(|i| row.get(i))
                .and_then(|v| v.as_f64())
        };

        // Get settle price (or last, or close)
        let price = get_value("settle")
            .or_else(|| get_value("last"))
            .or_else(|| get_value("close"));

        let prev_close = get_value("previous");
        let volume = get_value("volume");
        let open_interest = get_value("open interest");

        // Date from first column
        let date = row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        if let Some(p) = price {
            Ok(Some(ChrisPrice {
                date,
                settle: p,
                prev_close,
                volume,
                open_interest,
            }))
        } else {
            Ok(None)
        }
    }
}

/// CHRIS price data
struct ChrisPrice {
    #[allow(dead_code)]
    date: String,
    settle: f64,
    prev_close: Option<f64>,
    volume: Option<f64>,
    #[allow(dead_code)]
    open_interest: Option<f64>,
}

#[async_trait::async_trait]
impl MarketDataSource for ChrisMarketSource {
    fn source_id(&self) -> &'static str {
        "futures"
    }

    fn display_name(&self) -> &'static str {
        "CHRIS Continuous Futures"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Sync every 4 hours
        Duration::from_secs(4 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 250,
                    duration: Duration::from_secs(10),
                },
                RateWindow {
                    max_requests: 40000,
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        Ok(CHRIS_CONTRACTS
            .iter()
            .map(|(code, asset_id, name, category, unit)| AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: code.to_string(),
                name: name.to_string(),
                category: Some(category.to_string()),
                metadata: serde_json::json!({
                    "source": "chris",
                    "contract_code": code,
                    "unit": unit,
                    "continuous": true,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (code, asset_id, _name, _category, _unit) in CHRIS_CONTRACTS {
            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_contract(code).await {
                Ok(Some(price)) => {
                    if let Ok(value) = Decimal::from_str(&price.settle.to_string()) {
                        let prev_close = price
                            .prev_close
                            .and_then(|p| Decimal::from_str(&p.to_string()).ok());

                        let change_pct = match (prev_close, Some(value)) {
                            (Some(prev), Some(curr)) if prev != Decimal::ZERO => {
                                Some(((curr - prev) / prev) * Decimal::from(100))
                            }
                            _ => None,
                        };

                        let volume_24h = price
                            .volume
                            .and_then(|v| Decimal::from_str(&v.to_string()).ok());

                        results.push(PriceUpdate {
                            asset_id: asset_id.to_string(),
                            symbol: code.to_string(),
                            value,
                            prev_close,
                            change_pct,
                            volume_24h,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No CHRIS data for {}", code);
                }
                Err(e) => {
                    warn!("Error fetching CHRIS contract {}: {:?}", code, e);
                }
            }
        }

        info!("Fetched {} CHRIS futures prices", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for ChrisMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let hour = eastern.hour();

        // Data publishes after market close ~6 PM ET
        // Fetch windows: 6:30 PM, 7:30 PM, 8:30 PM ET
        let fetch_hour = 18;
        let fetch_minute = 30;

        if hour < fetch_hour {
            // Before 6:30 PM: wait
            return today_at_eastern(now, fetch_hour, fetch_minute);
        } else if hour == fetch_hour && eastern.minute() < fetch_minute {
            // At 6 PM but before :30: wait
            return today_at_eastern(now, fetch_hour, fetch_minute);
        } else if hour <= 20 {
            // 6:30 PM - 8:30 PM: fetch now
            return now;
        }

        // After 8:30 PM: wait for next trading day at 6:30 PM
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&Eastern);
        let fetch_time = next_eastern
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(fetch_hour, fetch_minute, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_market_closed(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst mode for daily settlement data
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contract_count() {
        assert_eq!(CHRIS_CONTRACTS.len(), 50, "Expected exactly 50 CHRIS contracts");
    }

    #[test]
    fn test_categories() {
        let categories: Vec<_> = CHRIS_CONTRACTS.iter().map(|c| c.3).collect();
        assert!(categories.contains(&"indices"));
        assert!(categories.contains(&"energy"));
        assert!(categories.contains(&"metals"));
        assert!(categories.contains(&"agriculture"));
        assert!(categories.contains(&"rates"));
        assert!(categories.contains(&"currencies"));
        assert!(categories.contains(&"volatility"));
    }
}
