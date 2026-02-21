//! FINRA Short Interest API client implementing MarketDataSource
//!
//! Fetches short interest data from https://api.finra.org/
//! Uses OAuth 2.0 client credentials for authentication.
//! Tracks 25 high-interest securities.

use anyhow::{bail, Context, Result};
use base64::Engine;
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};

/// Securities tracked for short interest
/// (symbol, asset_id, name, category)
const FINRA_SECURITIES: &[(&str, &str, &str, &str)] = &[
    // Meme Stocks
    ("GME", "finra_gme", "GameStop", "meme"),
    ("AMC", "finra_amc", "AMC Entertainment", "meme"),
    // Mega Cap Tech
    ("TSLA", "finra_tsla", "Tesla", "tech"),
    ("AAPL", "finra_aapl", "Apple", "tech"),
    ("NVDA", "finra_nvda", "NVIDIA", "tech"),
    ("MSFT", "finra_msft", "Microsoft", "tech"),
    ("AMZN", "finra_amzn", "Amazon", "tech"),
    ("META", "finra_meta", "Meta Platforms", "tech"),
    ("GOOGL", "finra_googl", "Alphabet", "tech"),
    // EV / Clean Energy
    ("RIVN", "finra_rivn", "Rivian", "ev"),
    ("LCID", "finra_lcid", "Lucid Motors", "ev"),
    ("NIO", "finra_nio", "NIO", "ev"),
    // Biotech
    ("MRNA", "finra_mrna", "Moderna", "biotech"),
    ("BNTX", "finra_bntx", "BioNTech", "biotech"),
    // Financials
    ("COIN", "finra_coin", "Coinbase", "crypto"),
    ("HOOD", "finra_hood", "Robinhood", "fintech"),
    ("SOFI", "finra_sofi", "SoFi", "fintech"),
    // High Short Interest
    ("CVNA", "finra_cvna", "Carvana", "retail"),
    ("UPST", "finra_upst", "Upstart", "fintech"),
    ("W", "finra_w", "Wayfair", "retail"),
    ("BYND", "finra_bynd", "Beyond Meat", "consumer"),
    ("SPCE", "finra_spce", "Virgin Galactic", "aerospace"),
    ("PLTR", "finra_pltr", "Palantir", "tech"),
    ("SNOW", "finra_snow", "Snowflake", "tech"),
    ("RBLX", "finra_rblx", "Roblox", "gaming"),
];

/// Cached OAuth token
struct CachedToken {
    access_token: String,
    expires_at: chrono::DateTime<Utc>,
}

/// FINRA market data source
pub struct FinraMarketSource {
    client: reqwest::Client,
    client_id: String,
    client_secret: String,
    token_cache: Arc<RwLock<Option<CachedToken>>>,
}

/// OAuth token response from FINRA
#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    /// Token lifetime in seconds (typically ~43200 = 12h)
    expires_in: u64,
}

/// A row from the FINRA consolidated short interest API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FinraShortInterestRow {
    current_short_position_quantity: Option<i64>,
    previous_short_position_quantity: Option<i64>,
    average_daily_volume_quantity: Option<i64>,
    days_to_cover_quantity: Option<f64>,
}

impl FinraMarketSource {
    /// Create from environment variables (required: FINRA_CLIENT_ID + FINRA_CLIENT_SECRET)
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("FINRA_CLIENT_ID")
            .context("FINRA_CLIENT_ID is required")?;
        let client_secret = std::env::var("FINRA_CLIENT_SECRET")
            .context("FINRA_CLIENT_SECRET is required")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!(
            "FINRA client initialized with {} securities (OAuth credentials configured)",
            FINRA_SECURITIES.len(),
        );

        Ok(Self {
            client,
            client_id,
            client_secret,
            token_cache: Arc::new(RwLock::new(None)),
        })
    }

    /// Get a valid OAuth access token, refreshing if needed.
    /// Tokens are cached and refreshed 5 minutes before expiry.
    async fn get_access_token(&self) -> Result<String> {
        // Check cache first
        {
            let cache = self.token_cache.read().await;
            if let Some(ref cached) = *cache {
                // Refresh 5 minutes before expiry
                if cached.expires_at > Utc::now() + chrono::Duration::minutes(5) {
                    return Ok(cached.access_token.clone());
                }
            }
        }

        // Acquire new token
        let credentials = format!("{}:{}", self.client_id, self.client_secret);
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());

        let resp = self
            .client
            .post("https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token?grant_type=client_credentials")
            .header("Authorization", format!("Basic {}", encoded))
            .send()
            .await
            .context("FINRA OAuth token request failed")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            bail!("FINRA OAuth failed with {}: {}", status, body);
        }

        let token_resp: OAuthTokenResponse = resp
            .json()
            .await
            .context("Failed to parse FINRA OAuth response")?;

        let expires_at = Utc::now() + chrono::Duration::seconds(token_resp.expires_in as i64);
        let access_token = token_resp.access_token.clone();

        // Cache the token
        {
            let mut cache = self.token_cache.write().await;
            *cache = Some(CachedToken {
                access_token: token_resp.access_token,
                expires_at,
            });
        }

        info!("FINRA OAuth token acquired (expires in {}s)", token_resp.expires_in);
        Ok(access_token)
    }

    /// Check if we're in a settlement period (mid-month or end-of-month)
    fn is_settlement_period(now: DateTime<Utc>) -> bool {
        let day = now.day();
        // Mid-month: 15th-17th
        // End-of-month: 28th-31st
        matches!(day, 15..=17 | 28..=31)
    }

    /// Fetch short interest for a symbol from the FINRA API
    async fn fetch_short_interest(&self, symbol: &str) -> Result<Option<ShortInterestData>> {
        let token = self.get_access_token().await?;

        let body = serde_json::json!({
            "fields": [
                "currentShortPositionQuantity",
                "previousShortPositionQuantity",
                "averageDailyVolumeQuantity",
                "daysToCoverQuantity"
            ],
            "compareFilters": [{
                "fieldName": "issueSymbolIdentifier",
                "fieldValue": symbol,
                "compareType": "EQUAL"
            }],
            "sortFields": ["-settlementDate"],
            "limit": 2,
            "offset": 0
        });

        let resp = self
            .client
            .post("https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest")
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("FINRA API request failed for {}", symbol))?;

        if !resp.status().is_success() {
            let status = resp.status();
            warn!("FINRA API error for {}: {}", symbol, status);
            return Ok(None);
        }

        let rows: Vec<FinraShortInterestRow> = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse FINRA response for {}", symbol))?;

        if rows.is_empty() {
            return Ok(None);
        }

        let current = &rows[0];
        let shares_short = match current.current_short_position_quantity {
            Some(qty) => qty,
            None => return Ok(None),
        };

        // Calculate change from prior report
        let change_from_prior = match (
            current.current_short_position_quantity,
            current.previous_short_position_quantity,
        ) {
            (Some(curr), Some(prev)) if prev != 0 => {
                ((curr - prev) as f64 / prev as f64) * 100.0
            }
            _ => 0.0,
        };

        // Days to cover = short interest ratio
        let short_interest_ratio = current.days_to_cover_quantity.unwrap_or(0.0);

        // Estimate short % of float using avg daily volume as proxy
        // (actual float data would need a separate source)
        let short_pct_float = match current.average_daily_volume_quantity {
            Some(adv) if adv > 0 => (shares_short as f64 / adv as f64) * 100.0,
            _ => 0.0,
        };

        Ok(Some(ShortInterestData {
            shares_short,
            short_interest_ratio,
            short_pct_float,
            change_from_prior,
        }))
    }
}

/// Short interest data
struct ShortInterestData {
    shares_short: i64,
    short_interest_ratio: f64, // days to cover
    #[allow(dead_code)]
    short_pct_float: f64, // % of float shorted (estimate)
    change_from_prior: f64, // % change from last report
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
        // Bi-weekly data, check daily during settlement periods
        Duration::from_secs(24 * 3600)
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
        Ok(FINRA_SECURITIES
            .iter()
            .map(|(symbol, asset_id, name, category)| AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: symbol.to_string(),
                name: format!("{} Short Interest", name),
                category: Some(category.to_string()),
                metadata: serde_json::json!({
                    "source": "finra",
                    "symbol": symbol,
                    "company_name": name,
                    "unit": "shares",
                    "update_frequency": "bi-weekly",
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (symbol, asset_id, _name, _category) in FINRA_SECURITIES {
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_short_interest(symbol).await {
                Ok(Some(data)) => {
                    if let Ok(value) = Decimal::from_str(&data.shares_short.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: asset_id.to_string(),
                            symbol: symbol.to_string(),
                            value,
                            prev_close: None,
                            change_pct: Decimal::from_str(&data.change_from_prior.to_string())
                                .ok(),
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No FINRA data for {}", symbol);
                }
                Err(e) => {
                    warn!("Error fetching FINRA data for {}: {:?}", symbol, e);
                }
            }
        }

        info!("Fetched {} FINRA short interest records", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for FinraMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        if Self::is_settlement_period(now) {
            // During settlement, check every 6 hours
            now + chrono::Duration::hours(6)
        } else {
            // Outside settlement, check daily
            now + chrono::Duration::days(1)
        }
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Short interest data can be published any business day
        false
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        if Self::is_settlement_period(now) {
            Some(Duration::from_secs(6 * 3600)) // Every 6 hours
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
    fn test_security_count() {
        assert!(
            FINRA_SECURITIES.len() >= 25,
            "Expected at least 25 securities"
        );
    }

    #[test]
    fn test_categories() {
        let categories: Vec<_> = FINRA_SECURITIES.iter().map(|s| s.3).collect();
        assert!(categories.contains(&"meme"));
        assert!(categories.contains(&"tech"));
        assert!(categories.contains(&"ev"));
        assert!(categories.contains(&"biotech"));
    }

    #[test]
    fn test_settlement_period() {
        // 15th should be in settlement period
        let mid = chrono::Utc.with_ymd_and_hms(2026, 6, 15, 12, 0, 0).unwrap();
        assert!(FinraMarketSource::is_settlement_period(mid));

        // 10th should NOT be in settlement period
        let tenth = chrono::Utc.with_ymd_and_hms(2026, 6, 10, 12, 0, 0).unwrap();
        assert!(!FinraMarketSource::is_settlement_period(tenth));
    }

    #[test]
    fn test_deserialize_finra_response() {
        let json = r#"[
            {
                "currentShortPositionQuantity": 12345678,
                "previousShortPositionQuantity": 11000000,
                "averageDailyVolumeQuantity": 5000000,
                "daysToCoverQuantity": 2.47
            }
        ]"#;

        let rows: Vec<FinraShortInterestRow> = serde_json::from_str(json).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].current_short_position_quantity, Some(12345678));
        assert_eq!(rows[0].previous_short_position_quantity, Some(11000000));
        assert_eq!(rows[0].average_daily_volume_quantity, Some(5000000));
        assert!((rows[0].days_to_cover_quantity.unwrap() - 2.47).abs() < 0.001);
    }

    #[test]
    fn test_deserialize_finra_response_with_nulls() {
        let json = r#"[
            {
                "currentShortPositionQuantity": 5000000,
                "previousShortPositionQuantity": null,
                "averageDailyVolumeQuantity": null,
                "daysToCoverQuantity": null
            }
        ]"#;

        let rows: Vec<FinraShortInterestRow> = serde_json::from_str(json).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].current_short_position_quantity, Some(5000000));
        assert!(rows[0].previous_short_position_quantity.is_none());
        assert!(rows[0].average_daily_volume_quantity.is_none());
        assert!(rows[0].days_to_cover_quantity.is_none());
    }
}
