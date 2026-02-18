//! BitgetReadOnlyClient implementation
//!
//! Read-only Bitget API client for issuer fill verification.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use base64::Engine;
use hmac::{Hmac, Mac};
use reqwest::Client;
use sha2::Sha256;
use tokio::sync::Mutex;
use tokio::time::{sleep, Instant};
use tracing::{debug, info, warn};
use urlencoding::encode;

use crate::error::Error;
use crate::traits::{BitgetFill, BitgetOrderInfo, BitgetOrderbook, BitgetReadOnlyClient, BitgetTicker};

use super::types::{
    BitgetFillsData, BitgetOrderInfoResponse, BitgetOrderListData, BitgetOrderbookResponse,
    BitgetResponse, BitgetTickerResponse,
};

/// Configuration for BitgetReadOnlyClient
#[derive(Clone)]
pub struct BitgetReadOnlyConfig {
    /// API key (read-only permissions)
    pub api_key: String,
    /// API secret for signing
    pub api_secret: String,
    /// API passphrase
    pub passphrase: String,
    /// Base URL (mainnet or testnet)
    pub base_url: String,
    /// Request timeout
    pub timeout: Duration,
}

impl std::fmt::Debug for BitgetReadOnlyConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BitgetReadOnlyConfig")
            .field("api_key", &"[REDACTED]")
            .field("api_secret", &"[REDACTED]")
            .field("passphrase", &"[REDACTED]")
            .field("base_url", &self.base_url)
            .field("timeout", &self.timeout)
            .finish()
    }
}

impl BitgetReadOnlyConfig {
    /// Create config from environment variables
    pub fn from_env() -> Result<Self, Error> {
        Ok(Self {
            api_key: std::env::var("BITGET_READONLY_API_KEY")
                .map_err(|_| Error::InvalidArgument("BITGET_READONLY_API_KEY not set".into()))?,
            api_secret: std::env::var("BITGET_READONLY_API_SECRET")
                .map_err(|_| Error::InvalidArgument("BITGET_READONLY_API_SECRET not set".into()))?,
            passphrase: std::env::var("BITGET_READONLY_PASSPHRASE")
                .map_err(|_| Error::InvalidArgument("BITGET_READONLY_PASSPHRASE not set".into()))?,
            base_url: std::env::var("BITGET_READONLY_BASE_URL")
                .unwrap_or_else(|_| "https://api.bitget.com".to_string()),
            timeout: Duration::from_secs(10),
        })
    }

    /// Create config for mainnet
    pub fn mainnet(api_key: String, api_secret: String, passphrase: String) -> Self {
        Self {
            api_key,
            api_secret,
            passphrase,
            base_url: "https://api.bitget.com".to_string(),
            timeout: Duration::from_secs(10),
        }
    }

    /// Create config with custom base URL
    ///
    /// Use this for testnet or custom endpoints. Note that Bitget's testnet
    /// uses the same URL as mainnet but requires a separate testnet account.
    pub fn with_base_url(
        api_key: String,
        api_secret: String,
        passphrase: String,
        base_url: String,
    ) -> Self {
        Self {
            api_key,
            api_secret,
            passphrase,
            base_url,
            timeout: Duration::from_secs(10),
        }
    }
}

/// Maximum number of timestamps to track in rate limiter
const RATE_LIMIT_WINDOW_CAPACITY: usize = 10;

/// Rate limiter for read-only operations
struct RateLimiter {
    /// Requests per second limit
    rate_limit: u32,
    /// Timestamps of recent requests (bounded sliding window)
    request_times: Mutex<VecDeque<Instant>>,
    /// Current backoff multiplier (reset on success)
    backoff_multiplier: AtomicU64,
    /// Count of rate limit hits for metrics
    rate_limit_hits: AtomicU64,
}

impl RateLimiter {
    fn new(rate_limit: u32) -> Self {
        Self {
            rate_limit,
            request_times: Mutex::new(VecDeque::with_capacity(RATE_LIMIT_WINDOW_CAPACITY)),
            backoff_multiplier: AtomicU64::new(1),
            rate_limit_hits: AtomicU64::new(0),
        }
    }

    /// Wait for rate limit slot, applying backoff if needed
    async fn acquire(&self) {
        let backoff = self.backoff_multiplier.load(Ordering::Relaxed);
        if backoff > 1 {
            debug!(backoff_secs = backoff, "Applying rate limit backoff");
            let delay = Duration::from_secs(backoff);
            sleep(delay).await;
        }

        let mut times = self.request_times.lock().await;
        let now = Instant::now();
        let window = Duration::from_secs(1);

        // Remove old timestamps outside the window
        while let Some(oldest) = times.front() {
            if now.duration_since(*oldest) >= window {
                times.pop_front();
            } else {
                break;
            }
        }

        // If at capacity, wait for oldest to expire
        if times.len() >= self.rate_limit as usize {
            if let Some(oldest) = times.front() {
                let wait = window.saturating_sub(now.duration_since(*oldest));
                if !wait.is_zero() {
                    drop(times);
                    sleep(wait).await;
                    times = self.request_times.lock().await;
                    // Clean up again after waiting
                    let now = Instant::now();
                    while let Some(oldest) = times.front() {
                        if now.duration_since(*oldest) >= window {
                            times.pop_front();
                        } else {
                            break;
                        }
                    }
                }
            }
        }

        times.push_back(Instant::now());
    }

    /// Record successful request (reset backoff)
    fn record_success(&self) {
        self.backoff_multiplier.store(1, Ordering::Relaxed);
    }

    /// Record rate limit hit (increase backoff with atomic CAS)
    fn record_rate_limit(&self) {
        // Increment hit counter for metrics
        let hits = self.rate_limit_hits.fetch_add(1, Ordering::Relaxed) + 1;
        warn!(
            code = "INFRA-013",
            total_hits = hits,
            "Bitget API rate limit hit, applying backoff"
        );

        // Atomic compare-and-swap to safely double backoff
        let _ = self.backoff_multiplier.fetch_update(
            Ordering::SeqCst,
            Ordering::SeqCst,
            |current| Some((current * 2).min(16)),
        );
    }

    /// Get current rate limit hit count (for metrics)
    #[allow(dead_code)]
    fn rate_limit_hit_count(&self) -> u64 {
        self.rate_limit_hits.load(Ordering::Relaxed)
    }
}

/// Implementation of BitgetReadOnlyClient
#[derive(Clone)]
pub struct BitgetReadOnlyClientImpl {
    config: BitgetReadOnlyConfig,
    client: Client,
    rate_limiter: Arc<RateLimiter>,
}

impl std::fmt::Debug for BitgetReadOnlyClientImpl {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BitgetReadOnlyClientImpl")
            .field("config", &self.config)
            .field("rate_limit_hits", &self.rate_limiter.rate_limit_hit_count())
            .finish_non_exhaustive()
    }
}

impl BitgetReadOnlyClientImpl {
    /// Create a new client with the given configuration
    pub fn new(config: BitgetReadOnlyConfig) -> Result<Self, Error> {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .map_err(|e| Error::ExternalService(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            config,
            client,
            rate_limiter: Arc::new(RateLimiter::new(5)), // 5 req/sec for read-only
        })
    }

    /// Get the number of rate limit hits (for metrics/monitoring)
    pub fn rate_limit_hit_count(&self) -> u64 {
        self.rate_limiter.rate_limit_hit_count()
    }

    /// Sign a request using HMAC-SHA256
    fn sign_request(&self, timestamp: &str, method: &str, path: &str, body: &str) -> String {
        let message = format!("{}{}{}{}", timestamp, method, path, body);

        let mut mac =
            Hmac::<Sha256>::new_from_slice(self.config.api_secret.as_bytes()).expect("HMAC key");
        mac.update(message.as_bytes());
        let result = mac.finalize();

        base64::engine::general_purpose::STANDARD.encode(result.into_bytes())
    }

    /// Maximum retry attempts for rate-limited requests
    const MAX_RETRIES: u32 = 3;

    /// Make an authenticated GET request with auto-retry on rate limit
    async fn get<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<T, Error> {
        let mut attempts = 0;

        loop {
            attempts += 1;
            self.rate_limiter.acquire().await;

            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
                .to_string();

            // Build query string for signing (URL-encoded)
            let query_string = if query.is_empty() {
                String::new()
            } else {
                format!(
                    "?{}",
                    query
                        .iter()
                        .map(|(k, v)| format!("{}={}", encode(k), encode(v)))
                        .collect::<Vec<_>>()
                        .join("&")
                )
            };

            let sign_path = format!("{}{}", path, query_string);
            let signature = self.sign_request(&timestamp, "GET", &sign_path, "");

            let url = format!("{}{}{}", self.config.base_url, path, query_string);

            let response = self
                .client
                .get(&url)
                .header("ACCESS-KEY", &self.config.api_key)
                .header("ACCESS-SIGN", &signature)
                .header("ACCESS-TIMESTAMP", &timestamp)
                .header("ACCESS-PASSPHRASE", &self.config.passphrase)
                .header("Content-Type", "application/json")
                .send()
                .await
                .map_err(|e| Error::ExternalService(format!("HTTP request failed: {}", e)))?;

            let status = response.status();

            // Auto-retry on rate limit with backoff
            if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                self.rate_limiter.record_rate_limit();
                if attempts < Self::MAX_RETRIES {
                    info!(
                        attempt = attempts,
                        max_retries = Self::MAX_RETRIES,
                        "Rate limited, retrying with backoff"
                    );
                    continue;
                }
                return Err(Error::RateLimit(
                    "Bitget API rate limit exceeded after retries".into(),
                ));
            }

            if status == reqwest::StatusCode::UNAUTHORIZED {
                return Err(Error::Authentication("Invalid Bitget API key".into()));
            }

            if status == reqwest::StatusCode::NOT_FOUND {
                return Err(Error::NotFound("Resource not found on Bitget".into()));
            }

            if !status.is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(Error::ExternalService(format!(
                    "Bitget API error {}: {}",
                    status, error_text
                )));
            }

            self.rate_limiter.record_success();

            let body_bytes = response
                .bytes()
                .await
                .map_err(|e| Error::ExternalService(format!("Failed to read response body: {}", e)))?;

            let api_response: BitgetResponse<T> = serde_json::from_slice(&body_bytes)
                .map_err(|e| {
                    let preview = String::from_utf8_lossy(&body_bytes[..body_bytes.len().min(500)]);
                    Error::ExternalService(format!(
                        "Failed to parse response: {} | body preview: {}",
                        e, preview
                    ))
                })?;

            if !api_response.is_success() {
                // Map Bitget API error codes to appropriate errors
                let code = &api_response.code;
                let msg = api_response.msg.unwrap_or_default();
                if code == "40001" || code == "40004" || msg.to_lowercase().contains("not found") {
                    return Err(Error::NotFound(format!("Bitget: {}", msg)));
                }
                return Err(Error::ExternalService(format!(
                    "Bitget API error: {} - {}",
                    code, msg
                )));
            }

            return api_response
                .data
                .ok_or_else(|| Error::ExternalService("Empty response data".into()));
        }
    }
}

fn parse_timestamp(s: &str) -> u64 {
    match s.parse() {
        Ok(ts) => ts,
        Err(_) => {
            warn!(code = "INFRA-013", value = %s, "Failed to parse timestamp, defaulting to 0");
            0
        }
    }
}

fn convert_order_info(response: BitgetOrderInfoResponse) -> BitgetOrderInfo {
    BitgetOrderInfo {
        order_id: response.order_id,
        client_order_id: response.client_oid,
        symbol: response.symbol,
        side: response.side,
        order_type: response.order_type,
        price: response.price,
        quantity: response.size,
        status: response.status,
        filled_quantity: response.base_volume,
        avg_fill_price: response.price_avg,
        create_time: parse_timestamp(&response.c_time),
        update_time: parse_timestamp(&response.u_time),
    }
}

#[async_trait]
impl BitgetReadOnlyClient for BitgetReadOnlyClientImpl {
    async fn get_order(&self, order_id: &str) -> Result<BitgetOrderInfo, Error> {
        let data: BitgetOrderInfoResponse = self
            .get("/api/v2/spot/trade/orderInfo", &[("orderId", order_id)])
            .await?;

        Ok(convert_order_info(data))
    }

    async fn get_fills(&self, symbol: &str, order_id: &str) -> Result<Vec<BitgetFill>, Error> {
        let data: BitgetFillsData = self
            .get(
                "/api/v2/spot/trade/fills",
                &[("symbol", symbol), ("orderId", order_id)],
            )
            .await?;

        Ok(data
            .fill_list
            .into_iter()
            .map(|f| BitgetFill {
                trade_id: f.trade_id,
                order_id: f.order_id,
                symbol: f.symbol,
                price: f.price,
                quantity: f.size,
                fee: f.fee,
                fee_currency: f.fee_ccy,
                trade_time: parse_timestamp(&f.c_time),
            })
            .collect())
    }

    async fn get_order_history(
        &self,
        pair: &str,
        since: u64,
        limit: Option<u32>,
    ) -> Result<Vec<BitgetOrderInfo>, Error> {
        let since_str = since.to_string();
        let limit_str = limit.unwrap_or(100).min(500).to_string();
        let data: BitgetOrderListData = self
            .get(
                "/api/v2/spot/trade/history-orders",
                &[
                    ("symbol", pair),
                    ("startTime", &since_str),
                    ("limit", &limit_str),
                ],
            )
            .await?;

        Ok(data.order_list.into_iter().map(convert_order_info).collect())
    }

    async fn get_ticker(&self, pair: &str) -> Result<BitgetTicker, Error> {
        let data: Vec<BitgetTickerResponse> = self
            .get("/api/v2/spot/market/tickers", &[("symbol", pair)])
            .await?;

        let ticker = data
            .into_iter()
            .next()
            .ok_or_else(|| Error::NotFound(format!("Ticker not found for {}", pair)))?;

        Ok(BitgetTicker {
            symbol: ticker.symbol,
            best_bid: ticker.bid_pr,
            best_ask: ticker.ask_pr,
            last_price: ticker.last_pr,
            timestamp: parse_timestamp(&ticker.ts),
            bid_size: ticker.bid_sz,
            ask_size: ticker.ask_sz,
            usdt_volume: ticker.usdt_volume,
        })
    }

    async fn get_all_tickers(&self) -> Result<Vec<BitgetTicker>, Error> {
        let data: Vec<BitgetTickerResponse> = self
            .get("/api/v2/spot/market/tickers", &[])
            .await?;

        Ok(data
            .into_iter()
            .map(|t| BitgetTicker {
                symbol: t.symbol,
                best_bid: t.bid_pr,
                best_ask: t.ask_pr,
                last_price: t.last_pr,
                timestamp: parse_timestamp(&t.ts),
                bid_size: t.bid_sz,
                ask_size: t.ask_sz,
                usdt_volume: t.usdt_volume,
            })
            .collect())
    }

    async fn get_orderbook(&self, symbol: &str, limit: u32) -> Result<BitgetOrderbook, Error> {
        let limit_str = limit.to_string();
        let data: BitgetOrderbookResponse = self
            .get(
                "/api/v2/spot/market/orderbook",
                &[("symbol", symbol), ("limit", &limit_str)],
            )
            .await?;

        let parse_levels = |levels: Vec<[String; 2]>| -> Vec<(f64, f64)> {
            levels
                .into_iter()
                .filter_map(|[price_str, size_str]| {
                    let price: f64 = price_str.parse().ok()?;
                    let size: f64 = size_str.parse().ok()?;
                    Some((price, size))
                })
                .collect()
        };

        Ok(BitgetOrderbook {
            asks: parse_levels(data.asks),
            bids: parse_levels(data.bids),
            timestamp: parse_timestamp(&data.ts),
        })
    }
}

impl BitgetReadOnlyClientImpl {

    /// Fetch historical 1-minute candles for a symbol.
    ///
    /// Uses Bitget's `/api/v2/spot/market/history-candles` endpoint.
    /// Returns `Vec<(timestamp_ms, close_price)>` sorted oldest-first.
    ///
    /// - `symbol`: Bitget trading pair (e.g. "BTCUSDC")
    /// - `granularity`: candle interval (e.g. "1min", "5min", "1h")
    /// - `end_time`: fetch candles ending at this timestamp (ms)
    /// - `limit`: max candles per request (max 200)
    pub async fn get_history_candles(
        &self,
        symbol: &str,
        granularity: &str,
        end_time: u64,
        limit: u32,
    ) -> Result<Vec<(u64, String)>, Error> {
        let end_time_str = end_time.to_string();
        let limit_str = limit.min(200).to_string();

        // Bitget returns Vec<Vec<String>>: [ts, open, high, low, close, baseVol, quoteVol, ...]
        let data: Vec<Vec<String>> = self
            .get(
                "/api/v2/spot/market/history-candles",
                &[
                    ("symbol", symbol),
                    ("granularity", granularity),
                    ("endTime", &end_time_str),
                    ("limit", &limit_str),
                ],
            )
            .await?;

        let mut candles: Vec<(u64, String)> = data
            .into_iter()
            .filter_map(|row| {
                if row.len() >= 5 {
                    let ts: u64 = row[0].parse().ok()?;
                    let close = row[4].clone();
                    Some((ts, close))
                } else {
                    None
                }
            })
            .collect();

        // Sort oldest-first (Bitget returns newest-first)
        candles.sort_by_key(|(ts, _)| *ts);
        Ok(candles)
    }

    /// Fetch historical OHLC candle data for a symbol.
    /// Returns Vec<(timestamp_ms, open, high, low, close)> sorted oldest-first.
    pub async fn get_history_candles_ohlc(
        &self,
        symbol: &str,
        granularity: &str,
        end_time: u64,
        limit: u32,
    ) -> Result<Vec<(u64, String, String, String, String)>, Error> {
        let end_time_str = end_time.to_string();
        let limit_str = limit.min(200).to_string();

        let data: Vec<Vec<String>> = self
            .get(
                "/api/v2/spot/market/history-candles",
                &[
                    ("symbol", symbol),
                    ("granularity", granularity),
                    ("endTime", &end_time_str),
                    ("limit", &limit_str),
                ],
            )
            .await?;

        let mut candles: Vec<(u64, String, String, String, String)> = data
            .into_iter()
            .filter_map(|row| {
                if row.len() >= 5 {
                    let ts: u64 = row[0].parse().ok()?;
                    Some((ts, row[1].clone(), row[2].clone(), row[3].clone(), row[4].clone()))
                } else {
                    None
                }
            })
            .collect();

        candles.sort_by_key(|(ts, _, _, _, _)| *ts);
        Ok(candles)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_request() {
        let config = BitgetReadOnlyConfig::mainnet(
            "test_key".into(),
            "test_secret".into(),
            "test_passphrase".into(),
        );
        let client = BitgetReadOnlyClientImpl::new(config).unwrap();

        // Test signing produces consistent results
        let sig1 = client.sign_request("1234567890", "GET", "/api/test", "");
        let sig2 = client.sign_request("1234567890", "GET", "/api/test", "");
        assert_eq!(sig1, sig2);

        // Different timestamps produce different signatures
        let sig3 = client.sign_request("1234567891", "GET", "/api/test", "");
        assert_ne!(sig1, sig3);
    }

    #[test]
    fn test_config_mainnet() {
        let config =
            BitgetReadOnlyConfig::mainnet("key".into(), "secret".into(), "passphrase".into());
        assert_eq!(config.base_url, "https://api.bitget.com");
        assert_eq!(config.timeout, Duration::from_secs(10));
    }

    #[test]
    fn test_config_debug_redacts_secrets() {
        let config =
            BitgetReadOnlyConfig::mainnet("my_key".into(), "my_secret".into(), "my_pass".into());
        let debug_str = format!("{:?}", config);
        assert!(!debug_str.contains("my_key"));
        assert!(!debug_str.contains("my_secret"));
        assert!(!debug_str.contains("my_pass"));
        assert!(debug_str.contains("[REDACTED]"));
    }

    #[test]
    fn test_parse_timestamp() {
        assert_eq!(parse_timestamp("1234567890000"), 1234567890000);
        assert_eq!(parse_timestamp("invalid"), 0);
    }

    #[test]
    fn test_rate_limiter_backoff_atomic() {
        let limiter = RateLimiter::new(5);

        // Initial state
        assert_eq!(limiter.backoff_multiplier.load(Ordering::Relaxed), 1);
        assert_eq!(limiter.rate_limit_hit_count(), 0);

        // Record rate limit hit
        limiter.record_rate_limit();
        assert_eq!(limiter.backoff_multiplier.load(Ordering::Relaxed), 2);
        assert_eq!(limiter.rate_limit_hit_count(), 1);

        // Another hit doubles it
        limiter.record_rate_limit();
        assert_eq!(limiter.backoff_multiplier.load(Ordering::Relaxed), 4);
        assert_eq!(limiter.rate_limit_hit_count(), 2);

        // Success resets backoff (but not hit count)
        limiter.record_success();
        assert_eq!(limiter.backoff_multiplier.load(Ordering::Relaxed), 1);
        assert_eq!(limiter.rate_limit_hit_count(), 2);
    }

    #[test]
    fn test_rate_limiter_max_backoff() {
        let limiter = RateLimiter::new(5);

        // Hit limit many times
        for _ in 0..10 {
            limiter.record_rate_limit();
        }

        // Should cap at 16
        assert_eq!(limiter.backoff_multiplier.load(Ordering::Relaxed), 16);
    }
}
