//! Shared rate-limited HTTP client for market data sources
//!
//! Wraps `reqwest::Client` with:
//! - Automatic rate limiting via `SlidingWindowRateLimiter`
//! - Configurable retry with exponential backoff
//! - HTTP error classification into `SourceError` variants
//!
//! Each source constructs a `SourceHttpClient` with its own rate limit config.
//! This replaces the three different rate limiting patterns (manual sleep,
//! Arc<Mutex<Instant>>, and Semaphore) with one unified approach.

use std::time::Duration;

use reqwest::header::RETRY_AFTER;
use serde::de::DeserializeOwned;
use tracing::{debug, warn};

use super::error::SourceError;
use crate::market_data::rate_limiter::{RateLimitConfig, SlidingWindowRateLimiter};

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retries (default: 3)
    pub max_retries: u32,
    /// Base delay for exponential backoff in ms (default: 200)
    pub base_delay_ms: u64,
    /// Maximum delay cap in ms (default: 5000)
    pub max_delay_ms: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            base_delay_ms: 200,
            max_delay_ms: 5000,
        }
    }
}

/// Shared HTTP client with rate limiting, retry, and error classification
pub struct SourceHttpClient {
    client: reqwest::Client,
    rate_limiter: SlidingWindowRateLimiter,
    retry_config: RetryConfig,
}

impl SourceHttpClient {
    /// Create a new SourceHttpClient with rate limiting and retry config
    pub fn new(rate_limit: RateLimitConfig, retry: RetryConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            rate_limiter: SlidingWindowRateLimiter::new(rate_limit),
            retry_config: retry,
        }
    }

    /// Create with custom reqwest client (for sources needing custom headers/TLS)
    pub fn with_client(
        client: reqwest::Client,
        rate_limit: RateLimitConfig,
        retry: RetryConfig,
    ) -> Self {
        Self {
            client,
            rate_limiter: SlidingWindowRateLimiter::new(rate_limit),
            retry_config: retry,
        }
    }

    /// GET request, deserialize JSON response.
    /// Automatically rate-limits, retries transient errors, and classifies failures.
    pub async fn get_json<T: DeserializeOwned>(&self, url: &str) -> Result<T, SourceError> {
        let mut last_error = None;

        for attempt in 0..=self.retry_config.max_retries {
            // Wait for rate limit permit
            self.rate_limiter.wait_for_permit().await;

            match self.client.get(url).send().await {
                Ok(response) => {
                    let status = response.status().as_u16();

                    if response.status().is_success() {
                        match response.json::<T>().await {
                            Ok(data) => return Ok(data),
                            Err(e) => {
                                return Err(SourceError::DataError(format!(
                                    "JSON parse error: {}",
                                    e
                                )));
                            }
                        }
                    }

                    // Rate limited — parse Retry-After header
                    if status == 429 {
                        let retry_after = response
                            .headers()
                            .get(RETRY_AFTER)
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .map(Duration::from_secs);

                        let err = SourceError::RateLimited(retry_after);

                        if attempt < self.retry_config.max_retries {
                            let delay = retry_after.unwrap_or_else(|| self.backoff_delay(attempt));
                            warn!(
                                "Rate limited on {} (attempt {}/{}), waiting {:?}",
                                url,
                                attempt + 1,
                                self.retry_config.max_retries,
                                delay
                            );
                            tokio::time::sleep(delay).await;
                            last_error = Some(err);
                            continue;
                        }
                        return Err(err);
                    }

                    // Auth failure — don't retry
                    if status == 401 || status == 403 {
                        let body = response.text().await.unwrap_or_default();
                        return Err(SourceError::AuthFailed(format!(
                            "HTTP {}: {}",
                            status, body
                        )));
                    }

                    // Server error — retry
                    if status >= 500 {
                        let body = response.text().await.unwrap_or_default();
                        let err =
                            SourceError::Transient(format!("HTTP {}: {}", status, body));

                        if attempt < self.retry_config.max_retries {
                            let delay = self.backoff_delay(attempt);
                            debug!(
                                "Server error on {} (attempt {}/{}), retrying in {:?}",
                                url,
                                attempt + 1,
                                self.retry_config.max_retries,
                                delay
                            );
                            tokio::time::sleep(delay).await;
                            last_error = Some(err);
                            continue;
                        }
                        return Err(err);
                    }

                    // Other client errors — don't retry
                    let body = response.text().await.unwrap_or_default();
                    return Err(SourceError::DataError(format!(
                        "HTTP {}: {}",
                        status, body
                    )));
                }
                Err(e) => {
                    let err = if e.is_timeout() {
                        SourceError::Transient(format!("Request timeout: {}", e))
                    } else if e.is_connect() {
                        SourceError::Transient(format!("Connection error: {}", e))
                    } else {
                        SourceError::Transient(format!("Request failed: {}", e))
                    };

                    if attempt < self.retry_config.max_retries && err.is_retryable() {
                        let delay = self.backoff_delay(attempt);
                        debug!(
                            "Request error on {} (attempt {}/{}), retrying in {:?}",
                            url,
                            attempt + 1,
                            self.retry_config.max_retries,
                            delay
                        );
                        tokio::time::sleep(delay).await;
                        last_error = Some(err);
                        continue;
                    }
                    return Err(err);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            SourceError::Transient("Max retries exceeded".to_string())
        }))
    }

    /// GET request with custom headers, deserialize JSON response.
    /// For APIs requiring auth headers (GitHub, Cloudflare, etc.)
    pub async fn get_json_with_headers<T: DeserializeOwned>(
        &self,
        url: &str,
        headers: &[(&str, &str)],
    ) -> Result<T, SourceError> {
        let mut last_error = None;

        for attempt in 0..=self.retry_config.max_retries {
            self.rate_limiter.wait_for_permit().await;

            let mut req = self.client.get(url);
            for (k, v) in headers {
                req = req.header(*k, *v);
            }

            match req.send().await {
                Ok(response) => {
                    let status = response.status().as_u16();

                    if response.status().is_success() {
                        match response.json::<T>().await {
                            Ok(data) => return Ok(data),
                            Err(e) => {
                                return Err(SourceError::DataError(format!(
                                    "JSON parse error: {}",
                                    e
                                )));
                            }
                        }
                    }

                    if status == 429 {
                        let retry_after = response
                            .headers()
                            .get(RETRY_AFTER)
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .map(Duration::from_secs);

                        let err = SourceError::RateLimited(retry_after);
                        if attempt < self.retry_config.max_retries {
                            let delay = retry_after.unwrap_or_else(|| self.backoff_delay(attempt));
                            warn!(
                                "Rate limited on {} (attempt {}/{}), waiting {:?}",
                                url, attempt + 1, self.retry_config.max_retries, delay
                            );
                            tokio::time::sleep(delay).await;
                            last_error = Some(err);
                            continue;
                        }
                        return Err(err);
                    }

                    if status == 401 || status == 403 {
                        let body = response.text().await.unwrap_or_default();
                        return Err(SourceError::AuthFailed(format!("HTTP {}: {}", status, body)));
                    }

                    if status >= 500 {
                        let body = response.text().await.unwrap_or_default();
                        let err = SourceError::Transient(format!("HTTP {}: {}", status, body));
                        if attempt < self.retry_config.max_retries {
                            let delay = self.backoff_delay(attempt);
                            tokio::time::sleep(delay).await;
                            last_error = Some(err);
                            continue;
                        }
                        return Err(err);
                    }

                    let body = response.text().await.unwrap_or_default();
                    return Err(SourceError::DataError(format!("HTTP {}: {}", status, body)));
                }
                Err(e) => {
                    let err = SourceError::Transient(format!("Request failed: {}", e));
                    if attempt < self.retry_config.max_retries && err.is_retryable() {
                        let delay = self.backoff_delay(attempt);
                        tokio::time::sleep(delay).await;
                        last_error = Some(err);
                        continue;
                    }
                    return Err(err);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            SourceError::Transient("Max retries exceeded".to_string())
        }))
    }

    /// GET request, return raw response text.
    /// For non-JSON APIs (CSV, XML, etc.)
    pub async fn get_raw(&self, url: &str) -> Result<String, SourceError> {
        let mut last_error = None;

        for attempt in 0..=self.retry_config.max_retries {
            self.rate_limiter.wait_for_permit().await;

            match self.client.get(url).send().await {
                Ok(response) => {
                    let status = response.status().as_u16();

                    if response.status().is_success() {
                        return response
                            .text()
                            .await
                            .map_err(|e| SourceError::DataError(format!("Read body: {}", e)));
                    }

                    if status == 429 {
                        let retry_after = response
                            .headers()
                            .get(RETRY_AFTER)
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .map(Duration::from_secs);

                        let err = SourceError::RateLimited(retry_after);
                        if attempt < self.retry_config.max_retries {
                            let delay = retry_after.unwrap_or_else(|| self.backoff_delay(attempt));
                            tokio::time::sleep(delay).await;
                            last_error = Some(err);
                            continue;
                        }
                        return Err(err);
                    }

                    if status == 401 || status == 403 {
                        let body = response.text().await.unwrap_or_default();
                        return Err(SourceError::AuthFailed(format!(
                            "HTTP {}: {}",
                            status, body
                        )));
                    }

                    if status >= 500 {
                        let body = response.text().await.unwrap_or_default();
                        let err = SourceError::Transient(format!("HTTP {}: {}", status, body));
                        if attempt < self.retry_config.max_retries {
                            let delay = self.backoff_delay(attempt);
                            tokio::time::sleep(delay).await;
                            last_error = Some(err);
                            continue;
                        }
                        return Err(err);
                    }

                    let body = response.text().await.unwrap_or_default();
                    return Err(SourceError::DataError(format!(
                        "HTTP {}: {}",
                        status, body
                    )));
                }
                Err(e) => {
                    let err = SourceError::Transient(format!("Request failed: {}", e));
                    if attempt < self.retry_config.max_retries {
                        let delay = self.backoff_delay(attempt);
                        tokio::time::sleep(delay).await;
                        last_error = Some(err);
                        continue;
                    }
                    return Err(err);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            SourceError::Transient("Max retries exceeded".to_string())
        }))
    }

    /// Get the underlying reqwest client (for sources needing custom request building)
    pub fn inner(&self) -> &reqwest::Client {
        &self.client
    }

    /// Get the rate limiter (for sources managing their own request flow)
    pub fn rate_limiter(&self) -> &SlidingWindowRateLimiter {
        &self.rate_limiter
    }

    /// Calculate exponential backoff delay for a given attempt
    fn backoff_delay(&self, attempt: u32) -> Duration {
        let delay_ms = self.retry_config.base_delay_ms * 2u64.pow(attempt);
        let capped = delay_ms.min(self.retry_config.max_delay_ms);
        Duration::from_millis(capped)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::rate_limiter::RateWindow;

    #[test]
    fn test_backoff_delay() {
        let client = SourceHttpClient::new(
            RateLimitConfig {
                windows: vec![RateWindow {
                    max_requests: 10,
                    duration: Duration::from_secs(1),
                }],
            },
            RetryConfig::default(),
        );

        assert_eq!(client.backoff_delay(0), Duration::from_millis(200));
        assert_eq!(client.backoff_delay(1), Duration::from_millis(400));
        assert_eq!(client.backoff_delay(2), Duration::from_millis(800));
        assert_eq!(client.backoff_delay(3), Duration::from_millis(1600));
        // Should cap at max_delay_ms
        assert_eq!(client.backoff_delay(10), Duration::from_millis(5000));
    }

    #[test]
    fn test_retry_config_default() {
        let cfg = RetryConfig::default();
        assert_eq!(cfg.max_retries, 3);
        assert_eq!(cfg.base_delay_ms, 200);
        assert_eq!(cfg.max_delay_ms, 5000);
    }
}
