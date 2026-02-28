//! FINRA Daily Short Volume (Reg SHO) API client implementing MarketDataSource
//!
//! Fetches daily short volume data from https://api.finra.org/
//! using OAuth 2.0 client_credentials flow.
//!
//! OAuth: POST https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token
//! Data:  POST https://api.finra.org/data/group/otcMarket/name/regShoDaily
//!
//! The value stored is the total short volume (sum across all market codes)
//! for the most recent available trading day. Change% is the short ratio
//! (short volume / total volume × 100).
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
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/finra.json");

/// FINRA OAuth token endpoint
const OAUTH_URL: &str =
    "https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token?grant_type=client_credentials";

/// FINRA Reg SHO daily short volume endpoint (otcMarket group)
const DATA_URL: &str = "https://api.finra.org/data/group/otcMarket/name/regShoDaily";

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

/// Daily short volume row from FINRA regShoDaily API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegShoRow {
    #[serde(default)]
    securities_information_processor_symbol_identifier: Option<String>,
    #[serde(default)]
    short_par_quantity: Option<f64>,
    #[serde(default)]
    short_exempt_par_quantity: Option<f64>,
    #[serde(default)]
    total_par_quantity: Option<f64>,
    #[serde(default)]
    trade_report_date: Option<String>,
    #[serde(default)]
    market_code: Option<String>,
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
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!(
            "FINRA client initialized with {} securities (OAuth credentials configured)",
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

    /// Fetch daily short volume rows for a symbol.
    /// Returns multiple rows (one per market code) for the latest available date.
    async fn fetch_short_volume(&self, symbol: &str) -> Result<Vec<RegShoRow>> {
        let token = self.get_token().await?;

        // Query without date filter — API returns the latest available date.
        // We get multiple rows per market code (Q=NASDAQ, N=NYSE, B=ADF, etc.)
        let body = serde_json::json!({
            "fields": [
                "securitiesInformationProcessorSymbolIdentifier",
                "shortParQuantity",
                "shortExemptParQuantity",
                "totalParQuantity",
                "tradeReportDate",
                "marketCode"
            ],
            "compareFilters": [{
                "fieldName": "securitiesInformationProcessorSymbolIdentifier",
                "fieldValue": symbol,
                "compareType": "EQUAL"
            }],
            "limit": 10
        });

        let resp = self
            .client
            .post(DATA_URL)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("Failed to fetch FINRA short volume for {}", symbol))?;

        let status = resp.status();

        if status.as_u16() == 204 {
            // No content — no data for this symbol
            return Ok(Vec::new());
        }

        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            warn!("FINRA API error for {}: {} {}", symbol, status, body);
            return Ok(Vec::new());
        }

        let rows: Vec<RegShoRow> = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse FINRA response for {}", symbol))?;

        Ok(rows)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FinraMarketSource {
    fn source_id(&self) -> &'static str {
        "finra"
    }

    fn display_name(&self) -> &'static str {
        "FINRA Short Volume"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Daily data, sync every 6 hours to catch publication
        Duration::from_secs(6 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100, // Conservative: FINRA allows 1200/min
                duration: Duration::from_secs(60),
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

        for entry in &entries {
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_short_volume(&entry.api_ref).await {
                Ok(rows) if !rows.is_empty() => {
                    // Sum short volume and total volume across all market codes.
                    // Group by date and take the most recent date available.
                    let mut by_date: HashMap<String, (f64, f64)> = HashMap::new();
                    for row in &rows {
                        let date = row
                            .trade_report_date
                            .clone()
                            .unwrap_or_default();
                        let entry_agg = by_date.entry(date).or_insert((0.0, 0.0));
                        entry_agg.0 += row.short_par_quantity.unwrap_or(0.0)
                            + row.short_exempt_par_quantity.unwrap_or(0.0);
                        entry_agg.1 += row.total_par_quantity.unwrap_or(0.0);
                    }

                    // Take the latest date
                    if let Some((date, (short_vol, total_vol))) =
                        by_date.into_iter().max_by_key(|(d, _)| d.clone())
                    {
                        if let Ok(value) = Decimal::from_str(&format!("{:.0}", short_vol)) {
                            let short_ratio = if total_vol > 0.0 {
                                Some(
                                    Decimal::from_str(&format!(
                                        "{:.2}",
                                        (short_vol / total_vol) * 100.0
                                    ))
                                    .ok(),
                                )
                                .flatten()
                            } else {
                                None
                            };

                            let total_vol_dec =
                                Decimal::from_str(&format!("{:.0}", total_vol)).ok();

                            debug!(
                                "FINRA {}: short_vol={:.0}, total_vol={:.0}, ratio={:.1}%, date={}",
                                entry.api_ref,
                                short_vol,
                                total_vol,
                                short_vol / total_vol.max(1.0) * 100.0,
                                date
                            );

                            results.push(PriceUpdate {
                                asset_id: entry.asset_id.clone(),
                                symbol: entry.symbol.clone(),
                                value,
                                prev_close: None,
                                change_pct: short_ratio,
                                volume_24h: total_vol_dec,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Ok(_) => {
                    debug!("No FINRA data for {}", entry.api_ref);
                }
                Err(e) => {
                    warn!("Error fetching FINRA data for {}: {:?}", entry.api_ref, e);
                }
            }
        }

        info!("Fetched {} FINRA short volume records", results.len());
        Ok(results)
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
    fn test_reg_sho_row_deserialize() {
        let json = r#"{
            "securitiesInformationProcessorSymbolIdentifier": "GME",
            "shortParQuantity": 725901,
            "shortExemptParQuantity": 0,
            "totalParQuantity": 1442211,
            "tradeReportDate": "2026-01-06",
            "marketCode": "Q"
        }"#;
        let row: RegShoRow = serde_json::from_str(json).unwrap();
        assert_eq!(
            row.securities_information_processor_symbol_identifier
                .as_deref(),
            Some("GME")
        );
        assert_eq!(row.short_par_quantity, Some(725901.0));
        assert_eq!(row.total_par_quantity, Some(1442211.0));
        assert_eq!(row.trade_report_date.as_deref(), Some("2026-01-06"));
        assert_eq!(row.market_code.as_deref(), Some("Q"));
    }

    #[test]
    fn test_short_ratio_computation() {
        let short_vol: f64 = 725901.0;
        let total_vol: f64 = 1442211.0;
        let ratio = (short_vol / total_vol) * 100.0;
        assert!((ratio - 50.33).abs() < 0.1, "Short ratio should be ~50.3%");
    }
}
