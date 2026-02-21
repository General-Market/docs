//! SEC EDGAR API client implementing MarketDataSource
//!
//! Fetches 13F filings from https://data.sec.gov/
//! Downloads and parses the information table XML to compute
//! AUM, top-10 concentration, and position count.
//! Tracks 15 major institutional investors.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};

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
    primary_document: Vec<String>,
    #[serde(rename = "accessionNumber")]
    accession_number: Vec<String>,
}

/// Filing index JSON structure
#[derive(Debug, Deserialize)]
struct FilingIndex {
    directory: FilingDirectory,
}

#[derive(Debug, Deserialize)]
struct FilingDirectory {
    item: Vec<FilingDirectoryItem>,
}

#[derive(Debug, Deserialize)]
struct FilingDirectoryItem {
    name: String,
}

// ── 13F Information Table XML deserialization ──

/// Root element of the 13F information table XML
#[derive(Debug, Deserialize)]
#[serde(rename = "informationTable")]
struct InformationTable {
    #[serde(rename = "infoTable", default)]
    entries: Vec<InfoTableEntry>,
}

/// A single holding in the 13F information table
#[derive(Debug, Deserialize)]
#[serde(rename = "infoTable")]
struct InfoTableEntry {
    #[serde(rename = "nameOfIssuer")]
    #[allow(dead_code)]
    name_of_issuer: String,
    #[allow(dead_code)]
    cusip: String,
    /// Value in thousands of USD
    value: i64,
    #[serde(rename = "shrsOrPrnAmt")]
    #[allow(dead_code)]
    shrs_or_prn_amt: Option<SharesOrPrincipal>,
}

#[derive(Debug, Deserialize)]
struct SharesOrPrincipal {
    #[serde(rename = "sshPrnamt")]
    #[allow(dead_code)]
    amount: Option<i64>,
    #[serde(rename = "sshPrnamtType")]
    #[allow(dead_code)]
    amount_type: Option<String>,
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

        matches!(
            (month, day),
            (2, 1..=14) |   // Q4 filings
            (5, 1..=15) |   // Q1 filings
            (8, 1..=14) |   // Q2 filings
            (11, 1..=14) // Q3 filings
        )
    }

    /// Fetch and parse the information table XML from a 13F filing.
    ///
    /// Steps:
    /// 1. Fetch the filing index JSON to find the infotable document filename
    /// 2. Download the XML
    /// 3. Strip namespace prefixes and deserialize
    async fn fetch_information_table(
        &self,
        cik: &str,
        accession_number: &str,
    ) -> Result<Vec<InfoTableEntry>> {
        let accession_nodash = accession_number.replace('-', "");

        // Step 1: Fetch filing index to find the infotable document
        let index_url = format!(
            "https://www.sec.gov/Archives/edgar/data/{}/{}/{}-index.json",
            cik.trim_start_matches('0'),
            accession_nodash,
            accession_number
        );

        let index_resp = self
            .client
            .get(&index_url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch filing index for {}", accession_number))?;

        if !index_resp.status().is_success() {
            warn!(
                "SEC filing index error for {}: {}",
                accession_number,
                index_resp.status()
            );
            return Ok(vec![]);
        }

        let index: FilingIndex = index_resp
            .json()
            .await
            .with_context(|| format!("Failed to parse filing index for {}", accession_number))?;

        // Find the information table document (filename contains "infotable")
        let infotable_name = index
            .directory
            .item
            .iter()
            .find(|item| {
                let lower = item.name.to_lowercase();
                lower.contains("infotable") && (lower.ends_with(".xml") || lower.ends_with(".htm"))
            })
            .map(|item| item.name.clone());

        let infotable_name = match infotable_name {
            Some(name) => name,
            None => {
                debug!(
                    "No infotable document found in filing {}",
                    accession_number
                );
                return Ok(vec![]);
            }
        };

        // Step 2: Download the XML
        let xml_url = format!(
            "https://www.sec.gov/Archives/edgar/data/{}/{}/{}",
            cik.trim_start_matches('0'),
            accession_nodash,
            infotable_name
        );

        let xml_resp = self
            .client
            .get(&xml_url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch infotable XML for {}", accession_number))?;

        if !xml_resp.status().is_success() {
            warn!(
                "SEC infotable download error for {}: {}",
                accession_number,
                xml_resp.status()
            );
            return Ok(vec![]);
        }

        let xml_text = xml_resp
            .text()
            .await
            .with_context(|| format!("Failed to read infotable XML for {}", accession_number))?;

        // Step 3: Strip namespace prefixes and parse
        let holdings = parse_information_table_xml(&xml_text)?;

        info!(
            "Parsed {} holdings from 13F filing {}",
            holdings.len(),
            accession_number
        );

        Ok(holdings)
    }

    /// Fetch 13F data for a fund, downloading and parsing the actual XML
    async fn fetch_fund_data(&self, cik: &str) -> Result<Option<FundData>> {
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

        let idx = match form_index {
            Some(idx) => idx,
            None => return Ok(None),
        };

        let filing_date = submissions.filings.recent.filing_date.get(idx).cloned();
        let accession_number = match submissions.filings.recent.accession_number.get(idx) {
            Some(acc) => acc.clone(),
            None => return Ok(None),
        };

        // Fetch and parse the information table
        // Rate-limit: small sleep before fetching more SEC pages
        tokio::time::sleep(Duration::from_millis(200)).await;

        let holdings = self
            .fetch_information_table(cik, &accession_number)
            .await?;

        if holdings.is_empty() {
            return Ok(Some(FundData {
                filing_date,
                aum: None,
                top10_pct: None,
                position_count: None,
            }));
        }

        // Compute metrics from holdings
        let metrics = compute_fund_metrics(&holdings);

        Ok(Some(FundData {
            filing_date,
            aum: Some(metrics.aum),
            top10_pct: Some(metrics.top10_pct),
            position_count: Some(metrics.position_count),
        }))
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

/// Computed metrics from parsed holdings
struct FundMetrics {
    aum: f64,
    top10_pct: f64,
    position_count: i64,
}

/// Parse information table XML, stripping namespace prefixes first.
fn parse_information_table_xml(xml_text: &str) -> Result<Vec<InfoTableEntry>> {
    // Strip common namespace prefixes (ns1:, n1:, etc.) for easier parsing
    let cleaned = xml_text
        .replace("ns1:", "")
        .replace("n1:", "")
        .replace("ns2:", "")
        .replace("n2:", "");

    match quick_xml::de::from_str::<InformationTable>(&cleaned) {
        Ok(table) => Ok(table.entries),
        Err(e) => {
            warn!("Failed to parse 13F XML: {}", e);
            Ok(vec![])
        }
    }
}

/// Compute AUM, top-10 concentration, and position count from holdings.
fn compute_fund_metrics(holdings: &[InfoTableEntry]) -> FundMetrics {
    // Values in the XML are in thousands of USD
    let total_value: i64 = holdings.iter().map(|h| h.value).sum();
    let aum = total_value as f64 * 1000.0;

    let position_count = holdings.len() as i64;

    // Top 10 concentration
    let mut values: Vec<i64> = holdings.iter().map(|h| h.value).collect();
    values.sort_unstable_by(|a, b| b.cmp(a));
    let top10_sum: i64 = values.iter().take(10).sum();
    let top10_pct = if total_value > 0 {
        (top10_sum as f64 / total_value as f64) * 100.0
    } else {
        0.0
    };

    FundMetrics {
        aum,
        top10_pct,
        position_count,
    }
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

    #[test]
    fn test_parse_information_table_xml() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<informationTable>
    <infoTable>
        <nameOfIssuer>APPLE INC</nameOfIssuer>
        <cusip>037833100</cusip>
        <value>91819000</value>
        <shrsOrPrnAmt>
            <sshPrnamt>400000000</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
        </shrsOrPrnAmt>
    </infoTable>
    <infoTable>
        <nameOfIssuer>BANK OF AMERICA CORP</nameOfIssuer>
        <cusip>060505104</cusip>
        <value>34764000</value>
        <shrsOrPrnAmt>
            <sshPrnamt>1032852006</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
        </shrsOrPrnAmt>
    </infoTable>
    <infoTable>
        <nameOfIssuer>COCA-COLA CO</nameOfIssuer>
        <cusip>191216100</cusip>
        <value>23684000</value>
        <shrsOrPrnAmt>
            <sshPrnamt>400000000</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
        </shrsOrPrnAmt>
    </infoTable>
</informationTable>"#;

        let holdings = parse_information_table_xml(xml).unwrap();
        assert_eq!(holdings.len(), 3);
        assert_eq!(holdings[0].name_of_issuer, "APPLE INC");
        assert_eq!(holdings[0].cusip, "037833100");
        assert_eq!(holdings[0].value, 91819000);
        assert_eq!(holdings[1].name_of_issuer, "BANK OF AMERICA CORP");
        assert_eq!(holdings[2].value, 23684000);
    }

    #[test]
    fn test_parse_information_table_xml_with_namespace() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ns1:informationTable xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
    <ns1:infoTable>
        <ns1:nameOfIssuer>MICROSOFT CORP</ns1:nameOfIssuer>
        <ns1:cusip>594918104</ns1:cusip>
        <ns1:value>5000000</ns1:value>
        <ns1:shrsOrPrnAmt>
            <ns1:sshPrnamt>12000000</ns1:sshPrnamt>
            <ns1:sshPrnamtType>SH</ns1:sshPrnamtType>
        </ns1:shrsOrPrnAmt>
    </ns1:infoTable>
</ns1:informationTable>"#;

        let holdings = parse_information_table_xml(xml).unwrap();
        assert_eq!(holdings.len(), 1);
        assert_eq!(holdings[0].name_of_issuer, "MICROSOFT CORP");
        assert_eq!(holdings[0].value, 5000000);
    }

    #[test]
    fn test_compute_fund_metrics() {
        let holdings = vec![
            InfoTableEntry {
                name_of_issuer: "APPLE".to_string(),
                cusip: "037833100".to_string(),
                value: 91819000,
                shrs_or_prn_amt: None,
            },
            InfoTableEntry {
                name_of_issuer: "BANK OF AMERICA".to_string(),
                cusip: "060505104".to_string(),
                value: 34764000,
                shrs_or_prn_amt: None,
            },
            InfoTableEntry {
                name_of_issuer: "COCA-COLA".to_string(),
                cusip: "191216100".to_string(),
                value: 23684000,
                shrs_or_prn_amt: None,
            },
        ];

        let metrics = compute_fund_metrics(&holdings);

        // AUM = sum(value) * 1000
        let expected_aum = (91819000 + 34764000 + 23684000) as f64 * 1000.0;
        assert!((metrics.aum - expected_aum).abs() < 1.0);

        // Position count
        assert_eq!(metrics.position_count, 3);

        // Top 10 % = 100% (only 3 holdings, all in top 10)
        assert!((metrics.top10_pct - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_compute_fund_metrics_top10() {
        // 15 holdings, check that top 10 concentration is correct
        let mut holdings = Vec::new();
        for i in 0..15 {
            holdings.push(InfoTableEntry {
                name_of_issuer: format!("COMPANY_{}", i),
                cusip: format!("{:09}", i),
                value: (15 - i) as i64 * 1000, // 15000, 14000, ..., 1000
                shrs_or_prn_amt: None,
            });
        }

        let metrics = compute_fund_metrics(&holdings);

        // Total = 15000 + 14000 + ... + 1000 = 120000
        let total: i64 = (1..=15).sum::<i64>() * 1000;
        assert_eq!(total, 120000);

        // Top 10 = 15000 + 14000 + ... + 6000 = 105000
        let top10: i64 = (6..=15).sum::<i64>() * 1000;
        assert_eq!(top10, 105000);

        let expected_pct = top10 as f64 / total as f64 * 100.0;
        assert!((metrics.top10_pct - expected_pct).abs() < 0.01);
        assert_eq!(metrics.position_count, 15);
    }
}
