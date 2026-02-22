//! US Treasury market data source via Treasury.gov XML feeds
//!
//! Fetches Treasury yield curves, bill rates, and real yields from
//! https://home.treasury.gov/resource-center/data-chart-center/interest-rates
//! All feeds are free and require no API key.
//! Data published daily at 3:30 PM ET.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::US::Eastern;
use regex::Regex;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    is_us_market_closed, load_all_asset_entries, load_assets_from_json, next_us_trading_day,
    today_at_eastern, AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Treasury.gov XML feed base URL
const TREASURY_XML_BASE: &str =
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/bonds.json");

/// Which Treasury.gov XML feed to fetch
#[derive(Debug, Clone, Copy)]
enum TreasuryFeed {
    YieldCurve,
    BillRates,
    RealYield,
}

impl TreasuryFeed {
    /// The `data=` query parameter for the XML feed URL
    fn data_param(&self) -> &'static str {
        match self {
            TreasuryFeed::YieldCurve => "daily_treasury_yield_curve",
            TreasuryFeed::BillRates => "daily_treasury_bill_rates",
            TreasuryFeed::RealYield => "daily_treasury_real_yield_curve",
        }
    }

    /// The dataset prefix in api_ref (before the colon)
    fn dataset_prefix(&self) -> &'static str {
        match self {
            TreasuryFeed::YieldCurve => "USTREASURY/YIELD",
            TreasuryFeed::BillRates => "USTREASURY/BILLRATES",
            TreasuryFeed::RealYield => "USTREASURY/REALYIELD",
        }
    }
}

/// All three Treasury feeds
const ALL_FEEDS: &[TreasuryFeed] = &[
    TreasuryFeed::YieldCurve,
    TreasuryFeed::BillRates,
    TreasuryFeed::RealYield,
];

/// Mapping from api_ref column name to XML element field name.
/// Returns the XML tag name for a given api_ref column (the part after the colon).
fn api_ref_column_to_xml_field(dataset: &str, column: &str) -> Option<&'static str> {
    match (dataset, column) {
        // Yield Curve
        ("USTREASURY/YIELD", "1 MO") => Some("BC_1MONTH"),
        ("USTREASURY/YIELD", "2 MO") => Some("BC_2MONTH"),
        ("USTREASURY/YIELD", "3 MO") => Some("BC_3MONTH"),
        ("USTREASURY/YIELD", "6 MO") => Some("BC_6MONTH"),
        ("USTREASURY/YIELD", "1 YR") => Some("BC_1YEAR"),
        ("USTREASURY/YIELD", "2 YR") => Some("BC_2YEAR"),
        ("USTREASURY/YIELD", "3 YR") => Some("BC_3YEAR"),
        ("USTREASURY/YIELD", "5 YR") => Some("BC_5YEAR"),
        ("USTREASURY/YIELD", "7 YR") => Some("BC_7YEAR"),
        ("USTREASURY/YIELD", "10 YR") => Some("BC_10YEAR"),
        ("USTREASURY/YIELD", "20 YR") => Some("BC_20YEAR"),
        ("USTREASURY/YIELD", "30 YR") => Some("BC_30YEAR"),
        // Bill Rates
        ("USTREASURY/BILLRATES", "4 WEEKS BANK DISCOUNT") => Some("ROUND_B1_CLOSE_4WK_2"),
        ("USTREASURY/BILLRATES", "8 WEEKS BANK DISCOUNT") => Some("ROUND_B1_CLOSE_8WK_2"),
        ("USTREASURY/BILLRATES", "13 WEEKS BANK DISCOUNT") => Some("ROUND_B1_CLOSE_13WK_2"),
        ("USTREASURY/BILLRATES", "26 WEEKS BANK DISCOUNT") => Some("ROUND_B1_CLOSE_26WK_2"),
        ("USTREASURY/BILLRATES", "52 WEEKS BANK DISCOUNT") => Some("ROUND_B1_CLOSE_52WK_2"),
        // Real Yields
        ("USTREASURY/REALYIELD", "5 YR") => Some("TC_5YEAR"),
        ("USTREASURY/REALYIELD", "7 YR") => Some("TC_7YEAR"),
        ("USTREASURY/REALYIELD", "10 YR") => Some("TC_10YEAR"),
        ("USTREASURY/REALYIELD", "20 YR") => Some("TC_20YEAR"),
        ("USTREASURY/REALYIELD", "30 YR") => Some("TC_30YEAR"),
        _ => None,
    }
}

/// Treasury market data source (via Treasury.gov XML feeds)
pub struct TreasuryMarketSource {
    client: reqwest::Client,
}

impl TreasuryMarketSource {
    /// Create from environment variables (no API key needed)
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("Treasury client initialized (via Treasury.gov XML feeds, no API key required)");

        Ok(Self { client })
    }

    /// Fetch a Treasury XML feed and extract the most recent entry's values.
    ///
    /// The XML feed returns all entries for the year sorted oldest-first,
    /// so we find the LAST `<m:properties>` block and extract field values from it.
    async fn fetch_feed(
        &self,
        feed: TreasuryFeed,
        xml_fields: &[(&'static str, String)], // (xml_field_name, asset_id)
    ) -> Result<Vec<(String, f64)>> {
        let year = Utc::now().year();
        let url = format!(
            "{}?data={}&field_tdr_date_value={}",
            TREASURY_XML_BASE,
            feed.data_param(),
            year
        );

        debug!("Fetching Treasury XML: {}", url);

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch Treasury feed {:?}", feed.data_param()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!(
                "Treasury.gov API error for {}: {} {}",
                feed.data_param(),
                status,
                &body[..body.len().min(200)]
            );
            return Ok(vec![]);
        }

        let xml_text = resp
            .text()
            .await
            .with_context(|| {
                format!(
                    "Failed to read Treasury XML body for {:?}",
                    feed.data_param()
                )
            })?;

        // Find the last <m:properties>...</m:properties> block (most recent date)
        let last_entry = Self::find_last_properties_block(&xml_text);
        let entry_text = match last_entry {
            Some(text) => text,
            None => {
                debug!(
                    "No <m:properties> entries found in Treasury feed {:?}",
                    feed.data_param()
                );
                return Ok(vec![]);
            }
        };

        // Extract values from the last entry
        let mut results = Vec::new();
        for (xml_field, asset_id) in xml_fields {
            if let Some(value) = Self::extract_xml_value(&entry_text, xml_field) {
                results.push((asset_id.clone(), value));
            }
        }

        Ok(results)
    }

    /// Find the last `<m:properties>...</m:properties>` block in the XML text.
    fn find_last_properties_block(xml: &str) -> Option<String> {
        let start_tag = "<m:properties>";
        let end_tag = "</m:properties>";

        let mut last_start = None;
        let mut search_from = 0;

        while let Some(pos) = xml[search_from..].find(start_tag) {
            last_start = Some(search_from + pos);
            search_from = search_from + pos + start_tag.len();
        }

        let start = last_start?;
        let end = xml[start..].find(end_tag)?;
        Some(xml[start..start + end + end_tag.len()].to_string())
    }

    /// Extract a numeric value from an XML element like
    /// `<d:BC_10YEAR m:type="Edm.Double">4.19</d:BC_10YEAR>`.
    fn extract_xml_value(entry_xml: &str, field_name: &str) -> Option<f64> {
        // Pattern: <d:FIELD_NAME ...>VALUE</d:FIELD_NAME>
        // The field might have attributes like m:type="Edm.Double" or might not
        let pattern = format!(r"<d:{}[^>]*>([\d.\-]+)</d:{}>", field_name, field_name);
        let re = Regex::new(&pattern).ok()?;
        let caps = re.captures(entry_xml)?;
        caps.get(1)?.as_str().parse::<f64>().ok()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TreasuryMarketSource {
    fn source_id(&self) -> &'static str {
        "bonds"
    }

    fn display_name(&self) -> &'static str {
        "US Treasury Yields"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 10, // Treasury.gov is free but be respectful
                    duration: Duration::from_secs(60),
                },
                RateWindow {
                    max_requests: 100,
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        // Build lookup: for each feed, collect (xml_field_name, asset_id) pairs
        let entries = load_all_asset_entries(ASSET_JSON)?;

        // Group entries by feed
        let mut feed_fields: HashMap<&'static str, Vec<(&'static str, String)>> = HashMap::new();

        for entry in &entries {
            if !entry.active {
                continue;
            }
            let parts: Vec<&str> = entry.api_ref.splitn(2, ':').collect();
            if parts.len() != 2 {
                warn!("Invalid api_ref format (no colon): {}", entry.api_ref);
                continue;
            }
            let dataset = parts[0];
            let column = parts[1];

            if let Some(xml_field) = api_ref_column_to_xml_field(dataset, column) {
                // Determine which feed this dataset belongs to
                for feed in ALL_FEEDS {
                    if feed.dataset_prefix() == dataset {
                        feed_fields
                            .entry(feed.data_param())
                            .or_default()
                            .push((xml_field, entry.asset_id.clone()));
                        break;
                    }
                }
            } else {
                warn!(
                    "No XML field mapping for api_ref: {} (dataset={}, column={})",
                    entry.api_ref, dataset, column
                );
            }
        }

        // Fetch each feed
        for feed in ALL_FEEDS {
            if let Some(fields) = feed_fields.get(feed.data_param()) {
                // Small delay between feed requests
                if !results.is_empty() {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }

                match self.fetch_feed(*feed, fields).await {
                    Ok(values) => {
                        for (asset_id, value) in values {
                            if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                                results.push(PriceUpdate {
                                    asset_id: asset_id.clone(),
                                    symbol: asset_id,
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
                    Err(e) => {
                        warn!(
                            "Error fetching Treasury feed {:?}: {:?}",
                            feed.data_param(),
                            e
                        );
                    }
                }
            }
        }

        info!(
            "Fetched {} Treasury prices from Treasury.gov XML feeds",
            results.len()
        );

        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for TreasuryMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let hour = eastern.hour();
        let minute = eastern.minute();

        // Treasury publishes at 3:30 PM ET
        let publish_hour = 15;
        let publish_minute = 30;

        // Fetch windows: 3:30 PM, 4:00 PM, 4:30 PM ET
        if hour < publish_hour || (hour == publish_hour && minute < publish_minute) {
            // Before 3:30 PM: wait for publish time
            return today_at_eastern(now, publish_hour, publish_minute);
        } else if hour == publish_hour && minute >= publish_minute {
            // At 3:30 PM: fetch now
            return now;
        } else if hour == 16 && minute < 30 {
            // 4:00-4:30 PM: fetch at 4:00 or now if past
            if minute < 5 {
                return now;
            }
            return today_at_eastern(now, 16, 30);
        } else if hour == 16 && minute >= 30 && minute < 35 {
            // 4:30 PM: fetch now
            return now;
        }

        // After 4:30 PM: wait for next trading day at 3:30 PM
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&Eastern);
        let fetch_time = next_eastern
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(publish_hour, publish_minute, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_market_closed(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst mode for Treasury - data only updates once daily
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
    fn test_api_ref_to_xml_field_yield_curve() {
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/YIELD", "10 YR"),
            Some("BC_10YEAR")
        );
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/YIELD", "1 MO"),
            Some("BC_1MONTH")
        );
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/YIELD", "30 YR"),
            Some("BC_30YEAR")
        );
    }

    #[test]
    fn test_api_ref_to_xml_field_bill_rates() {
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/BILLRATES", "4 WEEKS BANK DISCOUNT"),
            Some("ROUND_B1_CLOSE_4WK_2")
        );
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/BILLRATES", "52 WEEKS BANK DISCOUNT"),
            Some("ROUND_B1_CLOSE_52WK_2")
        );
    }

    #[test]
    fn test_api_ref_to_xml_field_real_yield() {
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/REALYIELD", "5 YR"),
            Some("TC_5YEAR")
        );
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/REALYIELD", "30 YR"),
            Some("TC_30YEAR")
        );
    }

    #[test]
    fn test_api_ref_to_xml_field_unknown() {
        assert_eq!(
            api_ref_column_to_xml_field("USTREASURY/YIELD", "99 YR"),
            None
        );
        assert_eq!(
            api_ref_column_to_xml_field("UNKNOWN/DATASET", "10 YR"),
            None
        );
    }

    #[test]
    fn test_extract_xml_value() {
        let xml = r#"<m:properties>
            <d:NEW_DATE m:type="Edm.DateTime">2026-01-31T00:00:00</d:NEW_DATE>
            <d:BC_1MONTH m:type="Edm.Double">4.31</d:BC_1MONTH>
            <d:BC_10YEAR m:type="Edm.Double">4.54</d:BC_10YEAR>
            <d:BC_30YEAR m:type="Edm.Double">4.77</d:BC_30YEAR>
        </m:properties>"#;

        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "BC_10YEAR"),
            Some(4.54)
        );
        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "BC_1MONTH"),
            Some(4.31)
        );
        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "BC_30YEAR"),
            Some(4.77)
        );
        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "BC_NONEXISTENT"),
            None
        );
    }

    #[test]
    fn test_extract_xml_value_negative() {
        let xml = r#"<m:properties>
            <d:TC_5YEAR m:type="Edm.Double">-0.12</d:TC_5YEAR>
        </m:properties>"#;

        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "TC_5YEAR"),
            Some(-0.12)
        );
    }

    #[test]
    fn test_extract_xml_value_bill_rates() {
        let xml = r#"<m:properties>
            <d:ROUND_B1_CLOSE_4WK_2 m:type="Edm.Double">4.255</d:ROUND_B1_CLOSE_4WK_2>
            <d:ROUND_B1_CLOSE_52WK_2 m:type="Edm.Double">4.060</d:ROUND_B1_CLOSE_52WK_2>
        </m:properties>"#;

        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "ROUND_B1_CLOSE_4WK_2"),
            Some(4.255)
        );
        assert_eq!(
            TreasuryMarketSource::extract_xml_value(xml, "ROUND_B1_CLOSE_52WK_2"),
            Some(4.060)
        );
    }

    #[test]
    fn test_find_last_properties_block() {
        let xml = r#"
        <entry>
            <m:properties>
                <d:BC_10YEAR m:type="Edm.Double">4.10</d:BC_10YEAR>
            </m:properties>
        </entry>
        <entry>
            <m:properties>
                <d:BC_10YEAR m:type="Edm.Double">4.20</d:BC_10YEAR>
            </m:properties>
        </entry>
        <entry>
            <m:properties>
                <d:BC_10YEAR m:type="Edm.Double">4.54</d:BC_10YEAR>
            </m:properties>
        </entry>
        "#;

        let last = TreasuryMarketSource::find_last_properties_block(xml).unwrap();
        assert!(last.contains("4.54"));
        assert!(!last.contains("4.10"));
        assert!(!last.contains("4.20"));
    }

    #[test]
    fn test_find_last_properties_block_single_entry() {
        let xml = r#"<m:properties><d:BC_10YEAR m:type="Edm.Double">4.19</d:BC_10YEAR></m:properties>"#;
        let last = TreasuryMarketSource::find_last_properties_block(xml).unwrap();
        assert!(last.contains("4.19"));
    }

    #[test]
    fn test_find_last_properties_block_empty() {
        let xml = r#"<feed><title>No data</title></feed>"#;
        assert!(TreasuryMarketSource::find_last_properties_block(xml).is_none());
    }

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.len() >= 20, "Expected at least 20 Treasury assets");
    }

    #[test]
    fn test_category_is_macro() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "macro",
                "Asset {} should have category 'macro'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_subcategories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<_> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"yield_curve"));
        assert!(subcats.contains(&"bill_rates"));
        assert!(subcats.contains(&"real_yields"));
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.contains(':'),
                "api_ref should contain ':' separator: {}",
                entry.api_ref
            );
            assert!(
                entry.api_ref.starts_with("USTREASURY/"),
                "api_ref should start with 'USTREASURY/': {}",
                entry.api_ref
            );
        }
    }

    #[test]
    fn test_all_assets_have_xml_mapping() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            if !entry.active {
                continue;
            }
            let parts: Vec<&str> = entry.api_ref.splitn(2, ':').collect();
            assert_eq!(
                parts.len(),
                2,
                "api_ref should have two parts: {}",
                entry.api_ref
            );
            let mapping = api_ref_column_to_xml_field(parts[0], parts[1]);
            assert!(
                mapping.is_some(),
                "No XML field mapping for asset {} with api_ref {}",
                entry.asset_id,
                entry.api_ref
            );
        }
    }

    #[test]
    fn test_feed_dataset_prefix_covers_all_assets() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            if !entry.active {
                continue;
            }
            let dataset = entry.api_ref.split(':').next().unwrap();
            let matched = ALL_FEEDS.iter().any(|f| f.dataset_prefix() == dataset);
            assert!(
                matched,
                "No feed found for dataset {} (asset {})",
                dataset, entry.asset_id
            );
        }
    }
}
