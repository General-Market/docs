//! SEC EDGAR API client implementing MarketDataSource
//!
//! Fetches 13F filings from https://data.sec.gov/
//! Tracks 15 major institutional investors.
//! Parses the infotable XML to extract AUM, top-10 concentration, and position count.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/sec_13f.json");

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
    #[serde(rename = "accessionNumber")]
    accession_number: Vec<String>,
    #[serde(rename = "primaryDocument")]
    #[allow(dead_code)]
    primary_document: Vec<String>,
}

/// Filing directory index from SEC
#[derive(Debug, Deserialize)]
struct FilingIndex {
    directory: FilingDirectory,
}

#[derive(Debug, Deserialize)]
struct FilingDirectory {
    item: Vec<FilingItem>,
}

#[derive(Debug, Deserialize)]
struct FilingItem {
    name: String,
    #[allow(dead_code)]
    size: Option<String>,
}

/// SEC EDGAR market data source
pub struct SecEdgarMarketSource {
    http: SourceHttpClient,
}

impl SecEdgarMarketSource {
    /// Create the SEC EDGAR client
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 5,
                duration: Duration::from_secs(1),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .user_agent("AgiArena/1.0 (contact@agiarena.com)")
            .build()
            .context("Failed to build reqwest client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("SEC EDGAR client initialized with {} assets", asset_count);

        Ok(Self { http })
    }

    /// Parse CIK and metric from api_ref (format: "CIK:metric")
    fn parse_api_ref(api_ref: &str) -> Option<(&str, &str)> {
        api_ref.split_once(':')
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

    /// Fetch and parse 13F data for a fund
    async fn fetch_fund_data(&self, cik: &str) -> Result<Option<FundData>> {
        // submissions API needs 10-digit zero-padded CIK
        // Archives path needs CIK without leading zeros
        let cik_stripped = cik.trim_start_matches('0');

        // Step 1: Fetch submissions list
        let url = format!("https://data.sec.gov/submissions/CIK{}.json", cik);

        let submissions: SecSubmissions = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("SEC API error for CIK {}: {}", cik, e);
                return Ok(None);
            }
        };

        // Step 2: Find the most recent 13F-HR filing
        let form_index = submissions
            .filings
            .recent
            .form
            .iter()
            .position(|f| f == "13F-HR");

        let Some(idx) = form_index else {
            debug!("No 13F-HR filing found for CIK {}", cik);
            return Ok(None);
        };

        let accession = match submissions.filings.recent.accession_number.get(idx) {
            Some(a) => a.clone(),
            None => return Ok(None),
        };
        let filing_date = submissions.filings.recent.filing_date.get(idx).cloned();

        // Step 3: Fetch filing directory to find infotable XML
        let accession_no_dash = accession.replace('-', "");
        let index_url = format!(
            "https://www.sec.gov/Archives/edgar/data/{}/{}/index.json",
            cik_stripped, accession_no_dash
        );

        let filing_index: FilingIndex = match self.http.get_json(&index_url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("Filing index error for CIK {}: {}", cik, e);
                return Ok(None);
            }
        };

        // Find the infotable XML (any .xml that's not primary_doc.xml)
        let infotable_file = filing_index
            .directory
            .item
            .iter()
            .find(|item| {
                item.name.ends_with(".xml") && item.name != "primary_doc.xml"
            })
            .map(|item| item.name.clone());

        let Some(infotable_name) = infotable_file else {
            warn!("No infotable XML found in 13F filing for CIK {}", cik);
            return Ok(None);
        };

        // Step 4: Fetch and parse infotable XML
        let xml_url = format!(
            "https://www.sec.gov/Archives/edgar/data/{}/{}/{}",
            cik_stripped, accession_no_dash, infotable_name
        );

        let xml_text = match self.http.get_raw(&xml_url).await {
            Ok(text) => text,
            Err(e) => {
                warn!("Infotable error for CIK {}: {}", cik, e);
                return Ok(None);
            }
        };

        // Parse the infotable XML
        let fund_data = Self::parse_infotable(&xml_text, filing_date);

        Ok(Some(fund_data))
    }

    /// Parse 13F infotable XML to extract AUM, top-10 concentration, position count.
    ///
    /// XML structure (one entry per holding):
    /// ```xml
    /// <infoTable>
    ///   <cusip>02005N100</cusip>
    ///   <value>576074081</value>
    ///   ...
    /// </infoTable>
    /// ```
    fn parse_infotable(xml: &str, filing_date: Option<String>) -> FundData {
        // Extract all (cusip, value) pairs from the XML
        let mut holdings: HashMap<String, i64> = HashMap::new();

        // Simple regex-free XML parsing: find each <infoTable>...</infoTable> block
        let mut pos = 0;
        while let Some(start) = xml[pos..].find("<infoTable>") {
            let abs_start = pos + start;
            let Some(end) = xml[abs_start..].find("</infoTable>") else {
                break;
            };
            let block = &xml[abs_start..abs_start + end];

            // Extract <value>...</value>
            let value = Self::extract_tag(block, "value")
                .and_then(|v| v.parse::<i64>().ok());

            // Extract <cusip>...</cusip>
            let cusip = Self::extract_tag(block, "cusip");

            if let (Some(cusip_str), Some(val)) = (cusip, value) {
                // Aggregate by CUSIP (same security can have multiple entries)
                *holdings.entry(cusip_str).or_insert(0) += val;
            }

            pos = abs_start + end + 12; // skip past </infoTable>
        }

        if holdings.is_empty() {
            return FundData {
                filing_date,
                aum: None,
                top10_pct: None,
                position_count: None,
            };
        }

        // AUM = sum of all holding values (in dollars)
        let aum: i64 = holdings.values().sum();

        // Position count = unique CUSIPs
        let position_count = holdings.len() as i64;

        // Top-10 concentration
        let mut values: Vec<i64> = holdings.values().copied().collect();
        values.sort_unstable_by(|a, b| b.cmp(a));
        let top10_sum: i64 = values.iter().take(10).sum();
        let top10_pct = if aum > 0 {
            (top10_sum as f64 / aum as f64) * 100.0
        } else {
            0.0
        };

        FundData {
            filing_date,
            aum: Some(aum as f64),
            top10_pct: Some(top10_pct),
            position_count: Some(position_count),
        }
    }

    /// Extract text content from a simple XML tag (no attributes, no nesting)
    fn extract_tag<'a>(xml: &'a str, tag: &str) -> Option<String> {
        let open = format!("<{}>", tag);
        let close = format!("</{}>", tag);
        let start = xml.find(&open)?;
        let content_start = start + open.len();
        let end = xml[content_start..].find(&close)?;
        Some(xml[content_start..content_start + end].trim().to_string())
    }
}

/// Fund data extracted from 13F
struct FundData {
    #[allow(dead_code)]
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

    fn always_record_price(&self) -> bool {
        // 13F data is quarterly — values don't change between filings, but we
        // need a fresh timestamped record on every sync to build price history
        // and prove the collector is alive.
        true
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
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        let entries = load_all_asset_entries(ASSET_JSON)?;

        // Group entries by CIK to fetch once per fund
        let mut seen_ciks = std::collections::HashSet::new();

        for entry in &entries {
            let Some((cik, _metric)) = Self::parse_api_ref(&entry.api_ref) else {
                continue;
            };

            // Only fetch fund data once per CIK
            if !seen_ciks.insert(cik.to_string()) {
                continue;
            }

            match self.fetch_fund_data(cik).await {
                Ok(Some(fund_data)) => {
                    // Find all entries for this CIK and populate their values
                    for e in entries.iter().filter(|e| e.api_ref.starts_with(cik)) {
                        let Some((_, m)) = Self::parse_api_ref(&e.api_ref) else {
                            continue;
                        };

                        let value_opt = match m {
                            "aum" => fund_data.aum,
                            "top10_pct" => fund_data.top10_pct,
                            "position_count" => fund_data.position_count.map(|c| c as f64),
                            _ => None,
                        };

                        if let Some(val) = value_opt {
                            if let Ok(decimal_value) = Decimal::from_str(&format!("{:.2}", val)) {
                                results.push(PriceUpdate {
                                    asset_id: e.asset_id.clone(),
                                    symbol: e.symbol.clone(),
                                    value: decimal_value,
                                    prev_close: None,
                                    change_pct: None,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
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

        info!("Fetched {} SEC 13F metrics from {} funds", results.len(), seen_ciks.len());
        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::MACRO_DAILY
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for SecEdgarMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        if Self::is_filing_window(now) {
            // During filing window, check every 6 hours
            now + chrono::Duration::hours(6)
        } else {
            // Outside filing window, check daily to build price history
            now + chrono::Duration::days(1)
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
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        // 15 funds × 3 metrics = 45 assets
        assert_eq!(entries.len(), 45);
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "regulatory"));
        assert!(entries.iter().all(|e| e.subcategory == "fund_holdings"));
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        // All api_refs should be in "CIK:metric" format
        for entry in &entries {
            let parts: Vec<&str> = entry.api_ref.split(':').collect();
            assert_eq!(parts.len(), 2, "api_ref should be CIK:metric format");
            assert!(parts[0].len() == 10, "CIK should be 10 digits");
        }
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

    #[test]
    fn test_parse_infotable() {
        let xml = r#"
        <informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
          <infoTable>
            <cusip>02005N100</cusip>
            <value>500000000</value>
          </infoTable>
          <infoTable>
            <cusip>02005N100</cusip>
            <value>100000000</value>
          </infoTable>
          <infoTable>
            <cusip>037833100</cusip>
            <value>300000000</value>
          </infoTable>
          <infoTable>
            <cusip>594918104</cusip>
            <value>200000000</value>
          </infoTable>
        </informationTable>
        "#;

        let data = SecEdgarMarketSource::parse_infotable(xml, Some("2026-02-17".to_string()));

        // AUM = 500M + 100M + 300M + 200M = 1.1B
        assert_eq!(data.aum, Some(1_100_000_000.0));

        // 3 unique CUSIPs
        assert_eq!(data.position_count, Some(3));

        // Top-10: all 3 positions (sum = 1.1B), so 100%
        // But by CUSIP: 02005N100=600M, 037833100=300M, 594918104=200M
        // Top 10 (all 3): 1.1B / 1.1B = 100%
        let top10 = data.top10_pct.unwrap();
        assert!((top10 - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_extract_tag() {
        let xml = "<infoTable><cusip>02005N100</cusip><value>576074081</value></infoTable>";
        assert_eq!(
            SecEdgarMarketSource::extract_tag(xml, "cusip"),
            Some("02005N100".to_string())
        );
        assert_eq!(
            SecEdgarMarketSource::extract_tag(xml, "value"),
            Some("576074081".to_string())
        );
        assert_eq!(SecEdgarMarketSource::extract_tag(xml, "missing"), None);
    }
}
