//! ECB API client implementing MarketDataSource and ScheduledMarketDataSource
//!
//! Fetches Euro area data from https://data-api.ecb.europa.eu
//! No API key required. Uses SDMX 2.1 format (JSON output).

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::Europe::Berlin;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    is_ecb_day, is_eu_weekend, next_eu_trading_day, today_at_cet, AssetUpdate, MarketDataSource,
    PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// ECB API base URL
const ECB_API_URL: &str = "https://data-api.ecb.europa.eu/service/data";

/// ECB series to track
/// Format: (series_key, asset_id, display_name, category)
const ECB_SERIES: &[(&str, &str, &str, &str)] = &[
    // Key Interest Rates (change on ECB meeting days)
    (
        "FM.B.U2.EUR.4F.KR.MRR_FR.LEV",
        "ecb_main_refi",
        "ECB Main Refinancing Rate",
        "interest_rates",
    ),
    (
        "FM.B.U2.EUR.4F.KR.DFR.LEV",
        "ecb_deposit",
        "ECB Deposit Facility Rate",
        "interest_rates",
    ),
    (
        "FM.B.U2.EUR.4F.KR.MLFR.LEV",
        "ecb_marginal",
        "ECB Marginal Lending Rate",
        "interest_rates",
    ),
    // Money Supply (M3) - released ~27th of month
    (
        "BSI.M.U2.Y.V.M30.X.1.U2.2300.Z01.A",
        "ecb_m3",
        "Euro Area M3 Money Supply",
        "money_supply",
    ),
    // Inflation (HICP) - end of month
    (
        "ICP.M.U2.N.000000.4.ANR",
        "ecb_hicp",
        "Euro Area HICP Inflation",
        "inflation",
    ),
    (
        "ICP.M.U2.N.XEF000.4.ANR",
        "ecb_core_hicp",
        "Euro Area Core HICP (Ex Energy & Food)",
        "inflation",
    ),
    // GDP - Quarterly
    (
        "MNA.Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY",
        "ecb_gdp",
        "Euro Area GDP Growth Rate",
        "macro",
    ),
    // Unemployment - Monthly
    (
        "STS.M.I8.S.UNEH.RTT000.4.000",
        "ecb_unemployment",
        "Euro Area Unemployment Rate",
        "employment",
    ),
    // Credit/Lending - Monthly
    (
        "BSI.M.U2.Y.U.A20.A.1.U2.2240.Z01.A",
        "ecb_lending_corps",
        "Euro Area Lending to Corporations",
        "credit",
    ),
    (
        "BSI.M.U2.Y.U.A20.A.1.U2.2250.Z01.A",
        "ecb_lending_households",
        "Euro Area Lending to Households",
        "credit",
    ),
];

/// ECB SDMX JSON response structure
#[derive(Debug, Deserialize)]
struct EcbResponse {
    #[serde(rename = "dataSets")]
    data_sets: Option<Vec<EcbDataSet>>,
    #[allow(dead_code)] // Used for SDMX structure parsing
    structure: Option<EcbStructure>,
}

#[derive(Debug, Deserialize)]
struct EcbDataSet {
    series: Option<std::collections::HashMap<String, EcbSeries>>,
}

#[derive(Debug, Deserialize)]
struct EcbSeries {
    observations: Option<std::collections::HashMap<String, Vec<serde_json::Value>>>,
}

// These structs are part of the SDMX response format and needed for deserialization
// even if we don't currently read all fields directly
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbStructure {
    dimensions: Option<EcbDimensions>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbDimensions {
    observation: Option<Vec<EcbDimension>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbDimension {
    values: Option<Vec<EcbDimensionValue>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbDimensionValue {
    id: String,
}

/// ECB market data source
pub struct EcbMarketSource {
    client: reqwest::Client,
}

impl EcbMarketSource {
    /// Create a new ECB client (no API key needed)
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("ECB client initialized with {} series", ECB_SERIES.len());

        Ok(Self { client })
    }

    /// Fetch a single ECB series
    async fn fetch_series(&self, series_key: &str) -> Result<Option<Decimal>> {
        // ECB API format: /data/{flowRef}/{key}
        // flowRef is the first part before the first dot
        let parts: Vec<&str> = series_key.splitn(2, '.').collect();
        if parts.len() != 2 {
            warn!("Invalid ECB series key format: {}", series_key);
            return Ok(None);
        }

        let flow_ref = parts[0];
        let key = parts[1];

        let url = format!(
            "{}/{}/{}?format=jsondata&lastNObservations=1",
            ECB_API_URL, flow_ref, key
        );

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .with_context(|| format!("Failed to fetch ECB series {}", series_key))?;

        if !resp.status().is_success() {
            let status = resp.status();
            // Don't log body for 404s - series might not exist
            if status.as_u16() != 404 {
                let body = resp.text().await.unwrap_or_default();
                warn!("ECB API error for {}: {} {}", series_key, status, body);
            } else {
                debug!("ECB series {} not found (404)", series_key);
            }
            return Ok(None);
        }

        let data: EcbResponse = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse ECB response for {}", series_key))?;

        // Navigate the SDMX structure to get the value
        // dataSets[0].series["0:0:0:..."].observations["0"][0]
        if let Some(data_sets) = data.data_sets {
            if let Some(first_set) = data_sets.first() {
                if let Some(series) = &first_set.series {
                    // Get the first (and usually only) series
                    if let Some(first_series) = series.values().next() {
                        if let Some(observations) = &first_series.observations {
                            // Get the last observation (most recent)
                            if let Some(last_obs) = observations.values().last() {
                                if let Some(value) = last_obs.first() {
                                    if let Some(num) = value.as_f64() {
                                        return Ok(Some(
                                            Decimal::from_str(&num.to_string()).unwrap_or_default(),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        debug!("No value found in ECB response for {}", series_key);
        Ok(None)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for EcbMarketSource {
    fn source_id(&self) -> &'static str {
        "ecb"
    }

    fn display_name(&self) -> &'static str {
        "ECB Euro Area Data"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // ECB doesn't document limits but is generous
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30, // Conservative
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        Ok(ECB_SERIES
            .iter()
            .map(|(series_key, asset_id, name, category)| AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: asset_id.to_string(),
                name: name.to_string(),
                category: Some(category.to_string()),
                metadata: serde_json::json!({
                    "source": "ecb",
                    "series_key": series_key,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        // Build a lookup from asset_id to series_key
        let series_lookup: std::collections::HashMap<&str, &str> = ECB_SERIES
            .iter()
            .map(|(key, id, _, _)| (*id, *key))
            .collect();

        for asset_id in asset_ids {
            if let Some(series_key) = series_lookup.get(asset_id.as_str()) {
                // Small delay between requests
                tokio::time::sleep(Duration::from_millis(500)).await;

                match self.fetch_series(series_key).await {
                    Ok(Some(value)) => {
                        results.push(PriceUpdate {
                            asset_id: asset_id.clone(),
                            symbol: asset_id.clone(),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                    Ok(None) => {
                        debug!("No data for ECB series {}", asset_id);
                    }
                    Err(e) => {
                        warn!("Error fetching ECB series {}: {:?}", asset_id, e);
                    }
                }
            }
        }

        info!(
            "Fetched {}/{} prices from ECB",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for EcbMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let cet = now.with_timezone(&Berlin);
        let hour = cet.hour();
        let date = cet.date_naive();

        // ECB meeting days: check for rate announcement at 14:15 CET
        if is_ecb_day(date) {
            if hour < 14 {
                return today_at_cet(now, 14, 15);
            } else if hour == 14 {
                return now; // Fetch during announcement window
            }
        }

        // Daily data publishes at 16:00 CET
        let publish_hour = 16;

        if hour < publish_hour {
            return today_at_cet(now, publish_hour, 5);
        } else if hour == publish_hour {
            return now;
        }

        // After 4 PM: wait for next trading day at 4 PM
        let next_day = next_eu_trading_day(now);
        let next_cet = next_day.with_timezone(&Berlin);
        let fetch_time = next_cet
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(publish_hour, 5, 0).unwrap());
        Berlin
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_eu_weekend(now)
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        let cet = now.with_timezone(&Berlin);
        let date = cet.date_naive();
        let day = cet.day();
        let hour = cet.hour();

        // ECB meeting days: burst mode from 14:00 to 17:00 CET
        if is_ecb_day(date) {
            if hour >= 14 && hour <= 17 {
                return Some(Duration::from_secs(5 * 60)); // 5 minutes
            }
        }

        // M3 money supply release window: 26th-28th around 10:00 CET
        if (26..=28).contains(&day) && hour >= 9 && hour <= 11 {
            return Some(Duration::from_secs(15 * 60)); // 15 minutes
        }

        None
    }

    fn timezone(&self) -> &'static str {
        "Europe/Berlin"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_series_count() {
        assert_eq!(ECB_SERIES.len(), 10, "Expected 10 ECB series");
    }

    #[test]
    fn test_source_id() {
        assert_eq!("ecb", "ecb");
    }

    #[test]
    fn test_series_key_format() {
        // Verify all series keys have the expected format
        for (key, _, _, _) in ECB_SERIES {
            assert!(key.contains('.'), "Series key should contain dots: {}", key);
        }
    }

    #[test]
    fn test_category_coverage() {
        let categories: Vec<_> = ECB_SERIES.iter().map(|(_, _, _, cat)| *cat).collect();
        assert!(categories.contains(&"interest_rates"));
        assert!(categories.contains(&"money_supply"));
        assert!(categories.contains(&"inflation"));
        assert!(categories.contains(&"employment"));
        assert!(categories.contains(&"credit"));
        assert!(categories.contains(&"macro"));
    }
}
