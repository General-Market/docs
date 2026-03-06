//! Shared Nasdaq Data Link API client
//!
//! Base client for all Nasdaq Data Link sources with combined rate limiting.
//! Rate limits: 50,000 requests/day, 300 requests/10 seconds.

use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// Nasdaq Data Link API base URL
pub const NASDAQ_API_URL: &str = "https://data.nasdaq.com/api/v3/datasets";

/// Shared Nasdaq API client with rate limiting
pub struct NasdaqClient {
    http: Arc<SourceHttpClient>,
    api_key: String,
}

impl NasdaqClient {
    /// Create from environment variable NASDAQ_API_KEY
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("NASDAQ_API_KEY").context("NASDAQ_API_KEY not set")?;
        if api_key.trim().is_empty() {
            anyhow::bail!("NASDAQ_API_KEY is set but empty — get a free key at https://data.nasdaq.com/sign-up");
        }
        Self::new(api_key)
    }

    /// Create with explicit API key
    pub fn new(api_key: String) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("AgiArena/1.0")
            .build()
            .context("Failed to build reqwest client")?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 300,
                duration: Duration::from_secs(10),
            }],
        };
        let http = Arc::new(SourceHttpClient::with_client(client, rate_limit, RetryConfig::default()));

        Ok(Self {
            http,
            api_key,
        })
    }

    /// Fetch a dataset from Nasdaq Data Link
    ///
    /// # Arguments
    /// * `dataset_code` - Full dataset code (e.g., "CFTC/13874A_F_ALL")
    /// * `rows` - Number of rows to fetch (default: 1 for latest)
    pub async fn fetch_dataset<T: DeserializeOwned>(
        &self,
        dataset_code: &str,
        rows: u32,
    ) -> Result<T> {
        let url = format!(
            "{}/{}.json?api_key={}&rows={}",
            NASDAQ_API_URL, dataset_code, self.api_key, rows
        );

        debug!("Fetching Nasdaq dataset: {}", dataset_code);

        let data: T = self.http.get_json(&url).await
            .with_context(|| format!("Failed to fetch Nasdaq dataset {}", dataset_code))?;

        Ok(data)
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_url() {
        assert!(NASDAQ_API_URL.starts_with("https://"));
        assert!(NASDAQ_API_URL.contains("nasdaq.com"));
    }
}
