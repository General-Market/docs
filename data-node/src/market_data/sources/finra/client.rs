//! FINRA Consolidated Short Interest API client implementing MarketDataSource
//!
//! Fetches bi-monthly short interest data from https://api.finra.org/
//! using OAuth 2.0 client_credentials flow.
//!
//! OAuth: POST https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token
//! Data:  POST https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest
//!
//! The value stored is the current short interest (total short position in shares).
//! Change% is computed by the sync engine from previous values.
//!
//! Short interest is reported twice a month (mid-month and end-of-month settlement dates).
//! FINRA publishes roughly 10 business days after each settlement date.
//!
//! Tracks 25 high-interest securities.

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::oauth::OAuthTokenCache;

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/finra.json");

/// FINRA OAuth token endpoint
const OAUTH_URL: &str =
    "https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token?grant_type=client_credentials";

/// FINRA Consolidated Short Interest endpoint
/// This dataset contains bi-monthly short interest for OTC and exchange-listed equities.
/// Fields: symbolCode, currentShortPositionQuantity, previousShortPositionQuantity,
///         changePreviousNumber, changePercent, averageDailyVolumeQuantity,
///         daysToCoverQuantity, settlementDate, revisionFlag
const SHORT_INTEREST_URL: &str =
    "https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest";

/// OAuth token response (FINRA returns expires_in as a string)
#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: Option<String>,
    #[allow(dead_code)]
    #[serde(default, deserialize_with = "deserialize_string_u64")]
    expires_in: Option<u64>,
}

fn deserialize_string_u64<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNum {
        Str(String),
        Num(u64),
    }
    match Option::<StringOrNum>::deserialize(deserializer)? {
        Some(StringOrNum::Num(n)) => Ok(Some(n)),
        Some(StringOrNum::Str(s)) => s.parse().map(Some).map_err(de::Error::custom),
        None => Ok(None),
    }
}

/// Short interest row from FINRA consolidatedShortInterest API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShortInterestRow {
    /// Ticker symbol
    #[serde(default)]
    symbol_code: Option<String>,
    /// Current reporting period short position (shares)
    #[serde(default)]
    current_short_position_quantity: Option<f64>,
    /// Previous reporting period short position (shares)
    #[serde(default)]
    previous_short_position_quantity: Option<f64>,
    /// Change from previous period (shares)
    #[serde(default)]
    #[allow(dead_code)]
    change_previous_number: Option<f64>,
    /// Change from previous period (percent)
    #[serde(default)]
    change_percent: Option<f64>,
    /// Average daily volume used for days-to-cover computation
    #[serde(default)]
    average_daily_volume_quantity: Option<f64>,
    /// Days to cover = currentShortPosition / averageDailyVolume
    #[serde(default)]
    days_to_cover_quantity: Option<f64>,
    /// Settlement date for this reporting period (YYYY-MM-DD)
    #[serde(default)]
    settlement_date: Option<String>,
}

/// FINRA market data source
pub struct FinraMarketSource {
    client: reqwest::Client,
    client_id: String,
    client_secret: String,
    token_cache: OAuthTokenCache,
}

impl FinraMarketSource {
    /// Create from environment variables (FINRA_CLIENT_ID + FINRA_CLIENT_SECRET)
    pub fn from_env() -> Result<Self> {
        let client_id =
            std::env::var("FINRA_CLIENT_ID").context("FINRA_CLIENT_ID not set")?;
        let client_secret =
            std::env::var("FINRA_CLIENT_SECRET").context("FINRA_CLIENT_SECRET not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .context("Failed to build reqwest client")?;

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!(
            "FINRA Short Interest client initialized with {} securities (OAuth credentials configured)",
            asset_count
        );

        Ok(Self {
            client,
            client_id,
            client_secret,
            token_cache: OAuthTokenCache::new("FINRA"),
        })
    }

    /// Get a valid OAuth bearer token (cached, refreshed if expired)
    async fn get_token(&self) -> Result<String> {
        let client = self.client.clone();
        let client_id = self.client_id.clone();
        let client_secret = self.client_secret.clone();

        self.token_cache
            .get_or_refresh(|| async move {
                let credentials = format!("{}:{}", client_id, client_secret);
                let encoded = BASE64.encode(credentials.as_bytes());

                let resp = client
                    .post(OAUTH_URL)
                    .header("Authorization", format!("Basic {}", encoded))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .send()
                    .await
                    .context("Failed to request FINRA OAuth token")?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    anyhow::bail!("FINRA OAuth failed: {} {}", status, body);
                }

                let token_resp: OAuthTokenResponse = resp
                    .json()
                    .await
                    .context("Failed to parse FINRA OAuth response")?;

                Ok((token_resp.access_token, token_resp.expires_in.unwrap_or(3600)))
            })
            .await
    }

    /// Fetch consolidated short interest for all tracked symbols in a single API call.
    /// The API supports IN filters, so we batch all 25 symbols into one request.
    /// Returns rows for the most recent settlement date.
    async fn fetch_short_interest(&self, symbols: &[&str]) -> Result<Vec<ShortInterestRow>> {
        let token = self.get_token().await?;

        // Build the request body with all symbols in a single IN filter.
        // Sort results by settlementDate descending to get the latest data first.
        let body = serde_json::json!({
            "fields": [
                "symbolCode",
                "currentShortPositionQuantity",
                "previousShortPositionQuantity",
                "changePreviousNumber",
                "changePercent",
                "averageDailyVolumeQuantity",
                "daysToCoverQuantity",
                "settlementDate"
            ],
            "compareFilters": [{
                "fieldName": "symbolCode",
                "fieldValue": symbols.join(","),
                "compareType": "IN"
            }],
            "sortFields": ["-settlementDate"],
            "limit": 100
        });

        let resp = self
            .client
            .post(SHORT_INTEREST_URL)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .context("Failed to fetch FINRA short interest data")?;

        let status = resp.status();

        // On 401, invalidate the token cache and retry once
        if status.as_u16() == 401 {
            warn!("FINRA API returned 401 — invalidating token and retrying");
            self.token_cache.invalidate().await;

            let token = self.get_token().await?;
            let resp = self
                .client
                .post(SHORT_INTEREST_URL)
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/json")
                .json(&body)
                .send()
                .await
                .context("Failed to fetch FINRA short interest data (retry)")?;

            let status = resp.status();
            if status.as_u16() == 204 {
                return Ok(Vec::new());
            }
            if !status.is_success() {
                let body_text = resp.text().await.unwrap_or_default();
                warn!("FINRA API error on retry: {} {}", status, body_text);
                return Ok(Vec::new());
            }

            return resp
                .json()
                .await
                .context("Failed to parse FINRA short interest response (retry)");
        }

        if status.as_u16() == 204 {
            // No content
            return Ok(Vec::new());
        }

        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            warn!("FINRA API error: {} {}", status, body_text);
            return Ok(Vec::new());
        }

        let rows: Vec<ShortInterestRow> = resp
            .json()
            .await
            .context("Failed to parse FINRA short interest response")?;

        Ok(rows)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FinraMarketSource {
    fn source_id(&self) -> &'static str {
        "finra"
    }

    fn display_name(&self) -> &'static str {
        "FINRA Short Interest"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Short interest is bi-monthly. Sync every 12 hours to catch publication.
        Duration::from_secs(12 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100, // Conservative: FINRA allows 1200/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    fn always_record_price(&self) -> bool {
        // Short interest data only changes bi-monthly. Without this flag,
        // the sync engine's change detection would skip writes when the value
        // matches the in-memory cache, leaving assets with no price history.
        true
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        let entries = load_all_asset_entries(ASSET_JSON)?;

        // Build a map from symbol -> entry for quick lookup
        let symbol_to_entry: HashMap<&str, _> = entries
            .iter()
            .map(|e| (e.api_ref.as_str(), e))
            .collect();

        // Collect all symbols for a single batched API call
        let symbols: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();

        let rows = match self.fetch_short_interest(&symbols).await {
            Ok(rows) => rows,
            Err(e) => {
                warn!("Failed to fetch FINRA short interest: {:?}", e);
                return Ok(results);
            }
        };

        if rows.is_empty() {
            warn!("FINRA short interest API returned 0 rows");
            return Ok(results);
        }

        // Group rows by symbol, taking only the most recent settlement date per symbol
        let mut latest_by_symbol: HashMap<String, ShortInterestRow> = HashMap::new();
        for row in rows {
            let symbol = match &row.symbol_code {
                Some(s) => s.clone(),
                None => continue,
            };
            let date = row.settlement_date.clone().unwrap_or_default();

            let should_replace = match latest_by_symbol.get(&symbol) {
                Some(existing) => {
                    date > existing.settlement_date.clone().unwrap_or_default()
                }
                None => true,
            };

            if should_replace {
                latest_by_symbol.insert(symbol, row);
            }
        }

        // Build PriceUpdate for each matched symbol
        for (symbol, row) in &latest_by_symbol {
            let entry = match symbol_to_entry.get(symbol.as_str()) {
                Some(e) => e,
                None => continue, // API returned a symbol we didn't ask for
            };

            let short_position = row.current_short_position_quantity.unwrap_or(0.0);
            if short_position <= 0.0 {
                debug!("FINRA {}: zero or negative short position, skipping", symbol);
                continue;
            }

            let value = match Decimal::from_str(&format!("{:.0}", short_position)) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Use the FINRA-provided change percent if available
            let change_pct = row.change_percent.and_then(|pct| {
                Decimal::from_str(&format!("{:.2}", pct)).ok()
            });

            // Previous short position as prev_close equivalent
            let prev_close = row.previous_short_position_quantity.and_then(|prev| {
                Decimal::from_str(&format!("{:.0}", prev)).ok()
            });

            // Average daily volume as volume metric
            let volume = row.average_daily_volume_quantity.and_then(|vol| {
                Decimal::from_str(&format!("{:.0}", vol)).ok()
            });

            let date = row.settlement_date.clone().unwrap_or_default();
            let days_to_cover = row.days_to_cover_quantity.unwrap_or(0.0);

            debug!(
                "FINRA {}: short_interest={:.0}, prev={:.0}, change={:.1}%, days_to_cover={:.1}, date={}",
                symbol,
                short_position,
                row.previous_short_position_quantity.unwrap_or(0.0),
                row.change_percent.unwrap_or(0.0),
                days_to_cover,
                date
            );

            results.push(PriceUpdate {
                asset_id: entry.asset_id.clone(),
                symbol: entry.symbol.clone(),
                value,
                prev_close,
                change_pct,
                volume_24h: volume,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {} FINRA short interest records (from {} API rows)",
            results.len(),
            latest_by_symbol.len()
        );
        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::MACRO_DAILY
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.len() >= 25, "Expected at least 25 securities");
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "regulatory"));
        assert!(entries.iter().all(|e| e.subcategory == "short_interest"));
    }

    #[test]
    fn test_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("finra_"),
                "Asset ID '{}' should start with 'finra_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_api_refs_are_ticker_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                !entry.api_ref.is_empty(),
                "api_ref should not be empty for {}",
                entry.asset_id
            );
            // Ticker symbols are uppercase alphanumeric
            assert!(
                entry.api_ref.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()),
                "api_ref '{}' should be an uppercase ticker symbol",
                entry.api_ref
            );
        }
    }

    #[test]
    fn test_short_interest_row_deserialize() {
        let json = r#"{
            "symbolCode": "GME",
            "currentShortPositionQuantity": 24512345,
            "previousShortPositionQuantity": 22100000,
            "changePreviousNumber": 2412345,
            "changePercent": 10.91,
            "averageDailyVolumeQuantity": 5200000,
            "daysToCoverQuantity": 4.71,
            "settlementDate": "2026-02-28"
        }"#;
        let row: ShortInterestRow = serde_json::from_str(json).unwrap();
        assert_eq!(row.symbol_code.as_deref(), Some("GME"));
        assert_eq!(row.current_short_position_quantity, Some(24512345.0));
        assert_eq!(row.previous_short_position_quantity, Some(22100000.0));
        assert_eq!(row.change_previous_number, Some(2412345.0));
        assert_eq!(row.change_percent, Some(10.91));
        assert_eq!(row.average_daily_volume_quantity, Some(5200000.0));
        assert_eq!(row.days_to_cover_quantity, Some(4.71));
        assert_eq!(row.settlement_date.as_deref(), Some("2026-02-28"));
    }

    #[test]
    fn test_days_to_cover_computation() {
        let short_position: f64 = 24512345.0;
        let avg_daily_vol: f64 = 5200000.0;
        let days = short_position / avg_daily_vol;
        assert!((days - 4.71).abs() < 0.1, "Days to cover should be ~4.71");
    }

    #[test]
    fn test_latest_date_selection() {
        // Simulate grouping by symbol and taking latest date
        let rows = vec![
            ("GME", "2026-02-14", 20000000.0),
            ("GME", "2026-02-28", 24500000.0),
            ("TSLA", "2026-02-28", 15000000.0),
        ];

        let mut latest: HashMap<&str, (&str, f64)> = HashMap::new();
        for (sym, date, val) in &rows {
            let should_replace = match latest.get(sym) {
                Some((existing_date, _)) => date > existing_date,
                None => true,
            };
            if should_replace {
                latest.insert(sym, (date, *val));
            }
        }

        assert_eq!(latest["GME"].0, "2026-02-28");
        assert_eq!(latest["GME"].1, 24500000.0);
        assert_eq!(latest["TSLA"].0, "2026-02-28");
    }
}
