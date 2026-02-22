//! Shared Nasdaq Data Link API client
//!
//! Base client for all Nasdaq Data Link sources with combined rate limiting.
//! Rate limits: 50,000 requests/day, 300 requests/10 seconds.

use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tracing::{debug, warn};

/// Nasdaq Data Link API base URL
pub const NASDAQ_API_URL: &str = "https://data.nasdaq.com/api/v3/datasets";

/// Shared Nasdaq API client with rate limiting
#[derive(Clone)]
pub struct NasdaqClient {
    client: reqwest::Client,
    api_key: String,
    /// Semaphore for concurrency control (respect 300/10sec limit)
    request_semaphore: Arc<Semaphore>,
}

impl NasdaqClient {
    /// Create from environment variable NASDAQ_API_KEY
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("NASDAQ_API_KEY").context("NASDAQ_API_KEY not set")?;
        Self::new(api_key)
    }

    /// Create with explicit API key
    pub fn new(api_key: String) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("AgiArena/1.0")
            .build()
            .context("Failed to build reqwest client")?;

        // Allow ~20 concurrent requests to stay well under 300/10sec
        let request_semaphore = Arc::new(Semaphore::new(20));

        Ok(Self {
            client,
            api_key,
            request_semaphore,
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
        // Acquire semaphore permit
        let _permit = self.request_semaphore.acquire().await.unwrap();

        // Small delay to smooth out request rate
        tokio::time::sleep(Duration::from_millis(50)).await;

        let url = format!(
            "{}/{}.json?api_key={}&rows={}",
            NASDAQ_API_URL, dataset_code, self.api_key, rows
        );

        debug!("Fetching Nasdaq dataset: {}", dataset_code);

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch Nasdaq dataset {}", dataset_code))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();

            // Check for rate limit
            if status.as_u16() == 429 {
                warn!("Nasdaq rate limit hit for {}. Waiting...", dataset_code);
                tokio::time::sleep(Duration::from_secs(10)).await;
            }

            anyhow::bail!("Nasdaq API error for {}: {} {}", dataset_code, status, body);
        }

        let data: T = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse Nasdaq response for {}", dataset_code))?;

        Ok(data)
    }

    /// Check if API key is configured
    pub fn is_configured() -> bool {
        std::env::var("NASDAQ_API_KEY").is_ok()
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
