//! SEC EFTS API client implementing MarketDataSource
//!
//! Fetches daily filing counts by form type from https://efts.sec.gov/
//! Uses the EFTS search-index endpoint with aggregation buckets.
//! Tracks 35 SEC form types.

use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};
use crate::market_data::traits::{
    is_us_weekend, next_us_trading_day, today_at_eastern, AssetUpdate, MarketDataSource,
    PriceUpdate, ScheduledMarketDataSource,
};

/// Tracked SEC form types
/// (form_type, asset_suffix, description)
const TRACKED_FORMS: &[(&str, &str, &str)] = &[
    ("4", "form4", "Insider Trading"),
    ("424B2", "form424b2", "Prospectus Supplement"),
    ("D", "formd", "Reg D Private Placement"),
    ("8-K", "form8k", "Material Event"),
    ("144", "form144", "Restricted Stock Sale"),
    ("D/A", "formda", "Reg D Amendment"),
    ("10-K", "form10k", "Annual Report"),
    ("NPORT-P", "formnportp", "Fund Monthly Holdings"),
    ("3", "form3", "Initial Insider Ownership"),
    ("6-K", "form6k", "Foreign Oracle Report"),
    ("FWP", "formfwp", "Free Writing Prospectus"),
    ("13F-HR", "form13fhr", "Institutional Holdings"),
    ("ABS-EE", "formabsee", "Asset-Backed Securities"),
    ("497", "form497", "Fund Prospectus Supplement"),
    ("N-CSR", "formncsr", "Certified Shareholder Report"),
    ("424B5", "form424b5", "Prospectus Supplement Alt"),
    ("485BPOS", "form485bpos", "Post-Effective Amendment"),
    ("10-Q", "form10q", "Quarterly Report"),
    ("8-K/A", "form8ka", "Material Event Amendment"),
    ("C", "formc", "Crowdfunding Offering"),
    ("S-8", "forms8", "Employee Stock Plan"),
    ("S-1", "forms1", "IPO Registration"),
    ("425", "form425", "Business Combination"),
    ("20-F", "form20f", "Foreign Annual Report"),
    ("DEFA14A", "formdefa14a", "Proxy Solicitation"),
    ("S-3ASR", "forms3asr", "Automatic Shelf Registration"),
    ("8-A12B", "form8a12b", "Securities Registration"),
    ("N-2", "formn2", "Closed-End Fund Registration"),
    ("25", "form25", "Exchange Delisting"),
    ("S-3", "forms3", "Shelf Registration"),
    ("C-U", "formcu", "Crowdfunding Update"),
    ("ARS", "formars", "Annual Report to Shareholders"),
    ("40-F", "form40f", "Canadian Cross-Listed Annual"),
    ("10-K/A", "form10ka", "Annual Report Amendment"),
    ("N-CSR/A", "formncsra", "Certified Shareholder Amendment"),
];

/// Forms that can be batched in a single comma-separated request
/// (no slashes or special characters in the form name)
const BATCHABLE_FORMS: &[&str] = &[
    "4", "8-K", "10-K", "10-Q", "S-1", "3", "D", "DEFA14A", "6-K", "FWP", "144", "425", "C",
];

/// Forms that require individual URL-encoded requests
const INDIVIDUAL_FORMS: &[&str] = &[
    "424B2", "D/A", "NPORT-P", "13F-HR", "ABS-EE", "497", "N-CSR", "424B5", "485BPOS", "8-K/A",
    "C-U", "S-8", "S-3ASR", "8-A12B", "N-2", "25", "S-3", "ARS", "40-F", "10-K/A", "N-CSR/A",
    "20-F",
];

/// EFTS search response structure
#[derive(Debug, Deserialize)]
struct EftsSearchResponse {
    hits: EftsHits,
    #[serde(default)]
    aggregations: Option<EftsAggregations>,
}

#[derive(Debug, Deserialize)]
struct EftsHits {
    total: EftsTotal,
}

#[derive(Debug, Deserialize)]
struct EftsTotal {
    value: i64,
}

#[derive(Debug, Deserialize)]
struct EftsAggregations {
    form_filter: EftsFormFilter,
}

#[derive(Debug, Deserialize)]
struct EftsFormFilter {
    buckets: Vec<EftsFormBucket>,
}

#[derive(Debug, Deserialize)]
struct EftsFormBucket {
    key: String,
    doc_count: i64,
}

/// SEC EFTS Filing Counts market data source
pub struct SecEftsMarketSource {
    http: SourceHttpClient,
}

impl SecEftsMarketSource {
    /// Create the SEC EFTS client
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 5,
                duration: Duration::from_secs(1),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("IndexProtocol/1.0 (contact@indexprotocol.com)")
            .build()
            .context("Failed to build reqwest client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!(
            "SEC EFTS client initialized with {} form types",
            TRACKED_FORMS.len()
        );

        Ok(Self { http })
    }

    /// Fetch filing counts for batchable forms using aggregation buckets
    async fn fetch_batch_counts(&self, date: &str) -> Result<Vec<(String, i64)>> {
        let forms_param = BATCHABLE_FORMS.join(",");
        let url = format!(
            "https://efts.sec.gov/LATEST/search-index?q=&forms={}&dateRange=custom&startdt={}&enddt={}&_source=false&size=0",
            forms_param, date, date
        );

        let data: EftsSearchResponse = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("EFTS batch API error: {}", e);
                return Ok(Vec::new());
            }
        };

        let mut results = Vec::new();

        if let Some(aggs) = data.aggregations {
            for bucket in aggs.form_filter.buckets {
                results.push((bucket.key, bucket.doc_count));
            }
        }

        debug!("EFTS batch returned {} form buckets", results.len());
        Ok(results)
    }

    /// Fetch filing count for a single form type (used for forms with special chars)
    async fn fetch_individual_count(&self, form_type: &str, date: &str) -> Result<Option<i64>> {
        let encoded_form = form_type.replace('/', "%2F");
        let url = format!(
            "https://efts.sec.gov/LATEST/search-index?q=&forms={}&dateRange=custom&startdt={}&enddt={}&_source=false&size=0",
            encoded_form, date, date
        );

        let data: EftsSearchResponse = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("EFTS API error for form {}: {}", form_type, e);
                return Ok(None);
            }
        };

        Ok(Some(data.hits.total.value))
    }

    /// Look up the asset suffix for a given form type
    fn suffix_for_form(form_type: &str) -> Option<&'static str> {
        TRACKED_FORMS
            .iter()
            .find(|(ft, _, _)| *ft == form_type)
            .map(|(_, suffix, _)| *suffix)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for SecEftsMarketSource {
    fn source_id(&self) -> &'static str {
        "sec_efts"
    }

    fn display_name(&self) -> &'static str {
        "SEC EFTS Filing Counts"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(4 * 3600) // 4 hours
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
        Ok(TRACKED_FORMS
            .iter()
            .map(|(form_type, suffix, description)| AssetUpdate {
                asset_id: format!("efts_{}", suffix),
                symbol: form_type.to_string(),
                name: format!("SEC Filing Count: {}", description),
                category: Some("filing_activity".to_string()),
                metadata: serde_json::json!({
                    "source": "sec_efts",
                    "form_type": form_type,
                    "unit": "count",
                    "update_frequency": "daily",
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let today = now.format("%Y-%m-%d").to_string();
        let mut results = Vec::new();

        // Step 1: Batch request for simple form names
        match self.fetch_batch_counts(&today).await {
            Ok(batch_results) => {
                for (form_type, count) in batch_results {
                    if let Some(suffix) = Self::suffix_for_form(&form_type) {
                        if let Ok(value) = Decimal::from_str(&count.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: format!("efts_{}", suffix),
                                symbol: form_type,
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
            }
            Err(e) => {
                warn!("Error fetching EFTS batch counts: {:?}", e);
            }
        }

        // Step 2: Individual requests for forms with special characters
        for form_type in INDIVIDUAL_FORMS {
            match self.fetch_individual_count(form_type, &today).await {
                Ok(Some(count)) => {
                    if let Some(suffix) = Self::suffix_for_form(form_type) {
                        if let Ok(value) = Decimal::from_str(&count.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: format!("efts_{}", suffix),
                                symbol: form_type.to_string(),
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
                    debug!("No EFTS data for form {}", form_type);
                }
                Err(e) => {
                    warn!("Error fetching EFTS count for form {}: {:?}", form_type, e);
                }
            }
        }

        info!("Fetched {} SEC EFTS filing counts", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for SecEftsMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Fetch windows: 9 AM, 1 PM, 5 PM ET
        let slots = [9, 13, 17];

        for &slot in &slots {
            let slot_time = today_at_eastern(now, slot, 0);
            if slot_time > now {
                return slot_time;
            }
        }

        // Past 5 PM ET: wait for next trading day at 9 AM ET
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&chrono_tz::US::Eastern);
        let dt = next_eastern.date_naive().and_time(
            chrono::NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
        );
        chrono_tz::US::Eastern
            .from_local_datetime(&dt)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_weekend(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
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
    fn test_form_count() {
        assert_eq!(TRACKED_FORMS.len(), 35, "Expected 35 tracked form types");
    }

    #[test]
    fn test_deserialize_batch_response() {
        let json = r#"{
            "hits": {
                "total": { "value": 2500 }
            },
            "aggregations": {
                "form_filter": {
                    "buckets": [
                        { "key": "4", "doc_count": 1136 },
                        { "key": "8-K", "doc_count": 312 },
                        { "key": "10-K", "doc_count": 87 }
                    ]
                }
            }
        }"#;

        let resp: EftsSearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.hits.total.value, 2500);

        let aggs = resp.aggregations.unwrap();
        assert_eq!(aggs.form_filter.buckets.len(), 3);
        assert_eq!(aggs.form_filter.buckets[0].key, "4");
        assert_eq!(aggs.form_filter.buckets[0].doc_count, 1136);
        assert_eq!(aggs.form_filter.buckets[1].key, "8-K");
        assert_eq!(aggs.form_filter.buckets[1].doc_count, 312);
        assert_eq!(aggs.form_filter.buckets[2].key, "10-K");
        assert_eq!(aggs.form_filter.buckets[2].doc_count, 87);
    }

    #[test]
    fn test_deserialize_individual_response() {
        let json = r#"{
            "hits": {
                "total": { "value": 42 }
            }
        }"#;

        let resp: EftsSearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.hits.total.value, 42);
        assert!(resp.aggregations.is_none());
    }

    #[test]
    fn test_batchable_forms_subset() {
        let tracked_form_types: Vec<&str> =
            TRACKED_FORMS.iter().map(|(ft, _, _)| *ft).collect();

        for form in BATCHABLE_FORMS {
            assert!(
                tracked_form_types.contains(form),
                "Batchable form '{}' is not in TRACKED_FORMS",
                form
            );
        }
    }
}
