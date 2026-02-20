//! SEC EDGAR API client implementing MarketDataSource
//!
//! Fetches 13F filings from https://data.sec.gov/
//! Tracks 15 major institutional investors.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Major institutional investors tracked via 13F filings
/// (cik, asset_prefix, name, manager)
const SEC_FUNDS: &[(&str, &str, &str, &str)] = &[
    (
        "0001067983",
        "13f_berkshire",
        "Berkshire Hathaway",
        "Warren Buffett",
    ),
    (
        "0001350694",
        "13f_bridgewater",
        "Bridgewater Associates",
        "Ray Dalio",
    ),
    (
        "0001037389",
        "13f_renaissance",
        "Renaissance Technologies",
        "Jim Simons",
    ),
    (
        "0001336528",
        "13f_citadel",
        "Citadel Advisors",
        "Ken Griffin",
    ),
    (
        "0001364742",
        "13f_two_sigma",
        "Two Sigma Investments",
        "John Overdeck",
    ),
    (
        "0001061768",
        "13f_millennium",
        "Millennium Management",
        "Israel Englander",
    ),
    (
        "0001167483",
        "13f_point72",
        "Point72 Asset Management",
        "Steve Cohen",
    ),
    ("0001040273", "13f_third_point", "Third Point", "Dan Loeb"),
    (
        "0001079114",
        "13f_pershing",
        "Pershing Square",
        "Bill Ackman",
    ),
    (
        "0001536411",
        "13f_tiger_global",
        "Tiger Global",
        "Chase Coleman",
    ),
    (
        "0001649339",
        "13f_coatue",
        "Coatue Management",
        "Philippe Laffont",
    ),
    (
        "0001027451",
        "13f_appaloosa",
        "Appaloosa Management",
        "David Tepper",
    ),
    ("0001056831", "13f_baupost", "Baupost Group", "Seth Klarman"),
    (
        "0001273087",
        "13f_viking",
        "Viking Global",
        "Andreas Halvorsen",
    ),
    (
        "0001510627",
        "13f_dragoneer",
        "Dragoneer Investment",
        "Marc Stad",
    ),
];

/// Metrics extracted from each 13F
const SEC_METRICS: &[(&str, &str, &str)] = &[
    ("_aum", "Total AUM", "usd"),
    ("_top10_pct", "Top 10 Concentration", "percent"),
    ("_position_count", "Position Count", "count"),
];

/// SEC EDGAR API response structure for submissions
#[derive(Debug, Deserialize)]
struct SecSubmissions {
    filings: SecFilings,
}

#[derive(Debug, Deserialize)]
struct SecFilings {
    recent: SecRecentFilings,
}

#[derive(Debug, Deserialize)]
struct SecRecentFilings {
    form: Vec<String>,
    #[serde(rename = "filingDate")]
    filing_date: Vec<String>,
    #[serde(rename = "primaryDocument")]
    #[allow(dead_code)]
    primary_document: Vec<String>,
}

/// SEC EDGAR market data source
pub struct SecEdgarMarketSource {
    client: reqwest::Client,
}

impl SecEdgarMarketSource {
    /// Create the SEC EDGAR client
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .user_agent("AgiArena/1.0 (contact@agiarena.com)")
            .build()
            .context("Failed to build reqwest client")?;

        let total_assets = SEC_FUNDS.len() * SEC_METRICS.len();
        info!(
            "SEC EDGAR client initialized with {} funds ({} assets)",
            SEC_FUNDS.len(),
            total_assets
        );

        Ok(Self { client })
    }

    /// Check if we're in a 13F filing window
    fn is_filing_window(now: DateTime<Utc>) -> bool {
        let month = now.month();
        let day = now.day();

        // Filing windows: ~45 days after quarter end
        // Q1 (Jan-Mar) due by May 15
        // Q2 (Apr-Jun) due by Aug 14
        // Q3 (Jul-Sep) due by Nov 14
        // Q4 (Oct-Dec) due by Feb 14

        // Check if we're in the 2 weeks before deadline
        matches!(
            (month, day),
            (2, 1..=14) |   // Q4 filings
            (5, 1..=15) |   // Q1 filings
            (8, 1..=14) |   // Q2 filings
            (11, 1..=14) // Q3 filings
        )
    }

    /// Fetch 13F data for a fund (placeholder - actual implementation requires XML parsing)
    async fn fetch_fund_data(&self, cik: &str) -> Result<Option<FundData>> {
        // Note: Full implementation would:
        // 1. Fetch submissions list from SEC
        // 2. Find latest 13F-HR filing
        // 3. Parse the XML to extract holdings
        // 4. Calculate AUM, top 10 concentration, position count

        let url = format!(
            "https://data.sec.gov/submissions/CIK{}.json",
            cik.trim_start_matches('0')
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch SEC data for CIK {}", cik))?;

        if !resp.status().is_success() {
            let status = resp.status();
            warn!("SEC API error for CIK {}: {}", cik, status);
            return Ok(None);
        }

        // Parse submissions to find latest 13F-HR
        let submissions: SecSubmissions = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse SEC response for CIK {}", cik))?;

        // Find the most recent 13F-HR filing
        let form_index = submissions
            .filings
            .recent
            .form
            .iter()
            .position(|f| f == "13F-HR");

        if let Some(idx) = form_index {
            let filing_date = submissions.filings.recent.filing_date.get(idx).cloned();

            // In a full implementation, we'd fetch and parse the actual 13F XML here
            // For now, return placeholder data indicating the filing exists
            return Ok(Some(FundData {
                filing_date,
                aum: None,            // Would be calculated from holdings
                top10_pct: None,      // Would be calculated from holdings
                position_count: None, // Would be calculated from holdings
            }));
        }

        Ok(None)
    }
}

/// Fund data extracted from 13F
#[allow(dead_code)]
struct FundData {
    filing_date: Option<String>,
    aum: Option<f64>,
    top10_pct: Option<f64>,
    position_count: Option<i64>,
}

#[async_trait::async_trait]
impl MarketDataSource for SecEdgarMarketSource {
    fn source_id(&self) -> &'static str {
        "sec_13f"
    }

    fn display_name(&self) -> &'static str {
        "SEC EDGAR 13F Filings"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Check daily during filing windows, weekly otherwise
        Duration::from_secs(24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 5, // SEC limits to 10/sec, be conservative
                duration: Duration::from_secs(1),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let mut assets = Vec::new();

        for (cik, asset_prefix, fund_name, manager) in SEC_FUNDS {
            for (suffix, metric_name, unit) in SEC_METRICS {
                let asset_id = format!("{}{}", asset_prefix, suffix);
                let name = format!("{} - {}", fund_name, metric_name);

                assets.push(AssetUpdate {
                    asset_id,
                    symbol: format!("{}_{}", cik, suffix),
                    name,
                    category: Some("fund_holdings".to_string()),
                    metadata: serde_json::json!({
                        "source": "sec_edgar",
                        "cik": cik,
                        "fund_name": fund_name,
                        "manager": manager,
                        "metric": metric_name,
                        "unit": unit,
                        "update_frequency": "quarterly",
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (cik, asset_prefix, _fund_name, _manager) in SEC_FUNDS {
            // Respect SEC rate limits
            tokio::time::sleep(Duration::from_millis(200)).await;

            match self.fetch_fund_data(cik).await {
                Ok(Some(fund_data)) => {
                    // AUM
                    if let Some(aum) = fund_data.aum {
                        if let Ok(value) = Decimal::from_str(&aum.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: format!("{}_aum", asset_prefix),
                                symbol: format!("{}_aum", cik),
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }

                    // Top 10 concentration
                    if let Some(top10) = fund_data.top10_pct {
                        if let Ok(value) = Decimal::from_str(&top10.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: format!("{}_top10_pct", asset_prefix),
                                symbol: format!("{}_top10", cik),
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }

                    // Position count
                    if let Some(count) = fund_data.position_count {
                        if let Ok(value) = Decimal::from_str(&count.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: format!("{}_position_count", asset_prefix),
                                symbol: format!("{}_positions", cik),
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Ok(None) => {
                    debug!("No 13F data for CIK {}", cik);
                }
                Err(e) => {
                    warn!("Error fetching SEC data for CIK {}: {:?}", cik, e);
                }
            }
        }

        info!("Fetched {} SEC 13F metrics", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for SecEdgarMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        if Self::is_filing_window(now) {
            // During filing window, check daily
            now + chrono::Duration::days(1)
        } else {
            // Outside filing window, check weekly
            now + chrono::Duration::days(7)
        }
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // 13F data can be filed any day
        false
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        if Self::is_filing_window(now) {
            // Check every 6 hours during filing window
            Some(Duration::from_secs(6 * 3600))
        } else {
            None
        }
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_fund_count() {
        assert!(SEC_FUNDS.len() >= 15, "Expected at least 15 funds");
    }

    #[test]
    fn test_asset_count() {
        let total = SEC_FUNDS.len() * SEC_METRICS.len();
        assert_eq!(total, 45);
    }

    #[test]
    fn test_filing_window() {
        // May 10 should be in filing window
        let may = chrono::Utc.with_ymd_and_hms(2026, 5, 10, 12, 0, 0).unwrap();
        assert!(SecEdgarMarketSource::is_filing_window(may));

        // June 15 should NOT be in filing window
        let june = chrono::Utc.with_ymd_and_hms(2026, 6, 15, 12, 0, 0).unwrap();
        assert!(!SecEdgarMarketSource::is_filing_window(june));
    }
}
