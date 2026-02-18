//! 1inch Fusion+ cross-chain swap integration
//!
//! Fusion+ enables cross-chain swaps using an intent-based architecture where:
//! - Issuers create intents (cross-chain swap requests)
//! - 1inch resolvers compete to fill the intents
//! - Settlement occurs atomically on the destination chain
//!
//! All routes originate from Arbitrum (hub chain) to:
//! - Ethereum (Chain ID: 1)
//! - Base (Chain ID: 8453)
//! - Optimism (Chain ID: 10)
//! - Solana (special handling for non-EVM)

use async_trait::async_trait;
use rand::Rng;
use reqwest::Client;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;
use tokio::time::sleep;

use super::error::OneInchError;
use super::types::{
    CreateIntentRequest, CreateIntentResponse, FusionIntent, FusionPlusConfig, FusionQuote,
    FusionRoute, IntentStatus, IntentStatusResponse,
};

/// Maximum retry attempts for rate-limited requests
const MAX_RETRIES: u32 = 5;

/// Trait for Fusion+ client operations
#[async_trait]
pub trait FusionPlusClientTrait: Send + Sync {
    /// Create a cross-chain swap intent
    async fn create_intent(
        &self,
        src_chain_id: u64,
        dst_chain_id: u64,
        src_token: &str,
        dst_token: &str,
        amount: &str,
        min_return: &str,
        deadline: u64,
        receiver: &str,
    ) -> Result<FusionIntent, OneInchError>;

    /// Get current status of an intent
    async fn get_intent_status(&self, order_hash: &str) -> Result<IntentStatus, OneInchError>;

    /// Check if a chain route is supported
    fn is_route_supported(&self, src_chain_id: u64, dst_chain_id: u64) -> bool;

    /// Get quote before creating intent (recommended)
    async fn get_quote(
        &self,
        src_chain_id: u64,
        dst_chain_id: u64,
        src_token: &str,
        dst_token: &str,
        amount: &str,
    ) -> Result<FusionQuote, OneInchError>;
}

/// Client for interacting with the 1inch Fusion+ API
///
/// This client handles cross-chain swap intents for the Index protocol.
/// All swaps originate from Arbitrum (hub chain).
///
/// # Security
/// - API keys are never logged
/// - All requests use HTTPS
/// - Rate limiting with exponential backoff
///
/// # Example
/// ```ignore
/// let client = FusionPlusClient::new(FusionPlusConfig::new("your-api-key"))?;
/// let intent = client.create_intent(
///     42161,  // Arbitrum
///     1,      // Ethereum
///     "0xusdc...",
///     "0xusdt...",
///     "1000000000",  // 1000 USDC
///     "990000000",   // 990 USDT min (1% slippage)
///     deadline,
///     "0xreceiver...",
/// ).await?;
/// ```
pub struct FusionPlusClient {
    /// HTTP client
    client: Client,
    /// Configuration
    config: FusionPlusConfig,
    /// Current retry attempt counter for metrics
    retry_attempts: AtomicU32,
    /// Nonce for intent creation (atomic for thread safety)
    nonce_counter: AtomicU32,
}

impl FusionPlusClient {
    /// Creates a new Fusion+ client with the given configuration
    pub fn new(config: FusionPlusConfig) -> Result<Self, OneInchError> {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .map_err(|e| OneInchError::NetworkError { source: e })?;

        // Seed nonce counter with random value to prevent collisions on restart
        let initial_nonce: u32 = rand::thread_rng().gen();

        Ok(Self {
            client,
            config,
            retry_attempts: AtomicU32::new(0),
            nonce_counter: AtomicU32::new(initial_nonce),
        })
    }

    /// Creates a new client using API key from environment variable
    pub fn from_env() -> Result<Self, OneInchError> {
        let api_key = std::env::var("ONEINCH_FUSION_API_KEY")
            .or_else(|_| std::env::var("ONEINCH_API_KEY"))
            .map_err(|_| OneInchError::MissingApiKey)?;

        Self::new(FusionPlusConfig::new(api_key))
    }

    /// Get the current retry attempt count (for metrics)
    pub fn retry_count(&self) -> u32 {
        self.retry_attempts.load(Ordering::Relaxed)
    }

    /// Reset retry counter
    pub fn reset_retry_count(&self) {
        self.retry_attempts.store(0, Ordering::Relaxed);
    }

    /// Generate next nonce for intent creation
    ///
    /// Combines Unix timestamp (upper 32 bits) with atomic counter (lower 32 bits)
    /// to ensure uniqueness across restarts and within the same second.
    fn next_nonce(&self) -> u64 {
        let base = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let counter = self.nonce_counter.fetch_add(1, Ordering::Relaxed);
        (base << 32) | (counter as u64)
    }

    /// Execute request with exponential backoff on rate limiting
    async fn execute_with_retry<T, F, Fut>(&self, operation: F) -> Result<T, OneInchError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, OneInchError>>,
    {
        let mut attempts = 0;

        loop {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(OneInchError::RateLimited { retry_after_ms }) => {
                    if attempts >= MAX_RETRIES {
                        return Err(OneInchError::MaxRetriesExceeded { attempts });
                    }

                    // Use server-provided retry-after, then configurable backoff sequence
                    let backoff_delay = self
                        .config
                        .backoff_ms
                        .get(attempts as usize)
                        .copied()
                        .unwrap_or(16000);
                    let delay = retry_after_ms.unwrap_or(backoff_delay);

                    self.retry_attempts.fetch_add(1, Ordering::Relaxed);
                    attempts += 1;

                    sleep(Duration::from_millis(delay)).await;
                }
                Err(e) if e.is_retryable() && attempts < MAX_RETRIES => {
                    let backoff_delay = self
                        .config
                        .backoff_ms
                        .get(attempts as usize)
                        .copied()
                        .unwrap_or(16000);
                    self.retry_attempts.fetch_add(1, Ordering::Relaxed);
                    attempts += 1;
                    sleep(Duration::from_millis(backoff_delay)).await;
                }
                Err(e) => return Err(e),
            }
        }
    }

    /// Validate chain route
    fn validate_route(&self, src_chain_id: u64, dst_chain_id: u64) -> Result<(), OneInchError> {
        if !FusionRoute::is_supported(src_chain_id, dst_chain_id) {
            return Err(OneInchError::UnsupportedRoute {
                src: src_chain_id,
                dst: dst_chain_id,
            });
        }
        Ok(())
    }

    /// Validate an EVM address (0x-prefixed, 42 hex chars) or allow non-EVM for Solana routes
    fn validate_address(address: &str, dst_chain_id: u64) -> Result<(), OneInchError> {
        use super::types::SOLANA_CHAIN_ID;

        // Solana addresses are base58, not 0x-prefixed — skip EVM validation
        if dst_chain_id == SOLANA_CHAIN_ID {
            if address.is_empty() {
                return Err(OneInchError::InvalidParameters(
                    "Address cannot be empty".to_string(),
                ));
            }
            return Ok(());
        }

        // EVM address validation
        if !address.starts_with("0x") && !address.starts_with("0X") {
            return Err(OneInchError::InvalidParameters(format!(
                "EVM address must start with 0x: {}",
                address
            )));
        }
        if address.len() != 42 {
            return Err(OneInchError::InvalidParameters(format!(
                "EVM address must be 42 characters (got {}): {}",
                address.len(),
                address
            )));
        }
        // Verify all characters after 0x prefix are valid hex digits
        if !address[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(OneInchError::InvalidParameters(format!(
                "EVM address contains invalid hex characters: {}",
                address
            )));
        }
        Ok(())
    }

    /// Build the API URL for an endpoint
    fn api_url(&self, endpoint: &str) -> String {
        format!("{}{}", self.config.base_url, endpoint)
    }

    /// Parse API error response
    async fn handle_error_response(
        &self,
        status_code: u16,
        response: reqwest::Response,
    ) -> OneInchError {
        // Handle known status codes first (before trying to parse body)
        if status_code == 429 {
            let retry_after_ms = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .map(|secs| secs * 1000);
            return OneInchError::RateLimited { retry_after_ms };
        }
        if status_code == 401 {
            return OneInchError::InvalidApiKey;
        }

        // Try to parse error body for other status codes
        if let Ok(body) = response.text().await {
            if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&body) {
                let message = error_json
                    .get("error")
                    .or_else(|| error_json.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();

                return OneInchError::ApiError {
                    status_code,
                    message,
                };
            }
        }

        OneInchError::ApiError {
            status_code,
            message: format!("HTTP error {}", status_code),
        }
    }

    /// Parse intent status from string
    fn parse_intent_status(status_response: &IntentStatusResponse) -> IntentStatus {
        let status_upper = status_response.status.to_uppercase();

        match status_upper.as_str() {
            "PENDING" => IntentStatus::Pending,
            "MATCHED" => IntentStatus::Matched {
                resolver: status_response
                    .resolver
                    .clone()
                    .unwrap_or_else(|| "unknown".to_string()),
            },
            "SETTLING" => IntentStatus::Settling {
                resolver: status_response
                    .resolver
                    .clone()
                    .unwrap_or_else(|| "unknown".to_string()),
            },
            "COMPLETED" | "FILLED" => {
                if let Some(fill) = status_response.fills.first() {
                    IntentStatus::Completed {
                        dst_tx_hash: fill.dst_tx_hash.clone(),
                        dst_amount: fill.dst_amount.clone(),
                        resolver: fill.resolver.clone(),
                        settled_at: fill.settled_at,
                    }
                } else {
                    IntentStatus::Completed {
                        dst_tx_hash: String::new(),
                        dst_amount: String::new(),
                        resolver: status_response
                            .resolver
                            .clone()
                            .unwrap_or_else(|| "unknown".to_string()),
                        settled_at: 0,
                    }
                }
            }
            "FAILED" => IntentStatus::Failed {
                reason: status_response
                    .error
                    .clone()
                    .unwrap_or_else(|| "Unknown failure".to_string()),
            },
            "EXPIRED" => IntentStatus::Expired,
            _ => IntentStatus::Failed {
                reason: format!("Unknown status: {}", status_response.status),
            },
        }
    }
}

#[async_trait]
impl FusionPlusClientTrait for FusionPlusClient {
    async fn create_intent(
        &self,
        src_chain_id: u64,
        dst_chain_id: u64,
        src_token: &str,
        dst_token: &str,
        amount: &str,
        min_return: &str,
        deadline: u64,
        receiver: &str,
    ) -> Result<FusionIntent, OneInchError> {
        // Validate route and parameters first
        self.validate_route(src_chain_id, dst_chain_id)?;
        Self::validate_address(src_token, src_chain_id)?;
        Self::validate_address(dst_token, dst_chain_id)?;
        Self::validate_address(receiver, dst_chain_id)?;

        // Validate deadline is in the future
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if deadline <= now {
            return Err(OneInchError::InvalidParameters(format!(
                "Deadline {} is in the past (current time: {})",
                deadline, now
            )));
        }

        let nonce = self.next_nonce();
        let request = CreateIntentRequest {
            src_chain_id,
            dst_chain_id,
            src_token_address: src_token.to_string(),
            dst_token_address: dst_token.to_string(),
            amount: amount.to_string(),
            min_return: min_return.to_string(),
            deadline,
            receiver: receiver.to_string(),
            permit: None,
            nonce,
        };

        // Pre-allocate owned strings for the FusionIntent result (avoid re-cloning on retry)
        let src_token_owned = src_token.to_string();
        let dst_token_owned = dst_token.to_string();
        let amount_owned = amount.to_string();
        let min_return_owned = min_return.to_string();
        let receiver_owned = receiver.to_string();

        self.execute_with_retry(|| {
            let client = &self.client;
            let url = self.api_url("/orders/create");
            let api_key = &self.config.api_key;
            let req = &request;

            async move {
                let response = client
                    .post(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .json(req)
                    .send()
                    .await
                    .map_err(|e| OneInchError::NetworkError { source: e })?;

                let status = response.status();

                if status.is_success() {
                    let create_response: CreateIntentResponse = response
                        .json()
                        .await
                        .map_err(|e| OneInchError::NetworkError { source: e })?;

                    Ok(create_response)
                } else {
                    Err(self.handle_error_response(status.as_u16(), response).await)
                }
            }
        })
        .await
        .map(|resp| FusionIntent {
            order_hash: resp.order_hash,
            src_chain_id,
            dst_chain_id,
            src_token: src_token_owned,
            dst_token: dst_token_owned,
            amount: amount_owned,
            min_return: min_return_owned,
            deadline,
            receiver: receiver_owned,
        })
    }

    async fn get_intent_status(&self, order_hash: &str) -> Result<IntentStatus, OneInchError> {
        let hash = order_hash.to_string();

        self.execute_with_retry(|| {
            let client = &self.client;
            let url = self.api_url(&format!("/orders/{}/status", hash));
            let api_key = &self.config.api_key;
            let order_hash_clone = hash.clone();

            async move {
                let response = client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Accept", "application/json")
                    .send()
                    .await
                    .map_err(|e| OneInchError::NetworkError { source: e })?;

                let status = response.status();

                if status.is_success() {
                    let status_response: IntentStatusResponse = response
                        .json()
                        .await
                        .map_err(|e| OneInchError::NetworkError { source: e })?;

                    Ok(Self::parse_intent_status(&status_response))
                } else if status.as_u16() == 404 {
                    Err(OneInchError::IntentNotFound {
                        order_hash: order_hash_clone,
                    })
                } else {
                    Err(self.handle_error_response(status.as_u16(), response).await)
                }
            }
        })
        .await
    }

    fn is_route_supported(&self, src_chain_id: u64, dst_chain_id: u64) -> bool {
        FusionRoute::is_supported(src_chain_id, dst_chain_id)
    }

    async fn get_quote(
        &self,
        src_chain_id: u64,
        dst_chain_id: u64,
        src_token: &str,
        dst_token: &str,
        amount: &str,
    ) -> Result<FusionQuote, OneInchError> {
        // Validate route first
        self.validate_route(src_chain_id, dst_chain_id)?;

        self.execute_with_retry(|| {
            let client = &self.client;
            let url = self.api_url("/quote");
            let api_key = &self.config.api_key;

            async move {
                let response = client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Accept", "application/json")
                    .query(&[
                        ("srcChainId", src_chain_id.to_string()),
                        ("dstChainId", dst_chain_id.to_string()),
                        ("srcTokenAddress", src_token.to_string()),
                        ("dstTokenAddress", dst_token.to_string()),
                        ("amount", amount.to_string()),
                    ])
                    .send()
                    .await
                    .map_err(|e| OneInchError::NetworkError { source: e })?;

                let status = response.status();

                if status.is_success() {
                    let quote: FusionQuote = response
                        .json()
                        .await
                        .map_err(|e| OneInchError::NetworkError { source: e })?;
                    Ok(quote)
                } else {
                    Err(self.handle_error_response(status.as_u16(), response).await)
                }
            }
        })
        .await
    }
}

// Debug implementation that doesn't expose API key
impl std::fmt::Debug for FusionPlusClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FusionPlusClient")
            .field("base_url", &self.config.base_url)
            .field("timeout", &self.config.timeout)
            .field("api_key", &"[REDACTED]")
            .field("retry_attempts", &self.retry_attempts.load(Ordering::Relaxed))
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    const MOCK_API_KEY: &str = "test-api-key";
    const USDC_ARB: &str = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const USDT_ETH: &str = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

    async fn create_test_client(mock_server: &MockServer) -> FusionPlusClient {
        let config = FusionPlusConfig::new(MOCK_API_KEY)
            .with_base_url(mock_server.uri())
            .with_timeout(Duration::from_secs(5))
            .with_backoff_ms(vec![10, 20, 40, 80, 160]); // Fast backoff for tests
        FusionPlusClient::new(config).unwrap()
    }

    #[test]
    fn test_route_validation() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();

        // Valid routes (Arbitrum as source)
        assert!(client.is_route_supported(42161, 1)); // ARB -> ETH
        assert!(client.is_route_supported(42161, 8453)); // ARB -> Base
        assert!(client.is_route_supported(42161, 10)); // ARB -> OP

        // Invalid routes
        assert!(!client.is_route_supported(1, 42161)); // ETH -> ARB (wrong direction)
        assert!(!client.is_route_supported(1, 10)); // ETH -> OP (not from hub)
        assert!(!client.is_route_supported(42161, 999)); // ARB -> unknown
    }

    #[test]
    fn test_debug_redacts_api_key() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();
        let debug_str = format!("{:?}", client);
        assert!(!debug_str.contains(MOCK_API_KEY));
        assert!(debug_str.contains("[REDACTED]"));
    }

    #[test]
    fn test_nonce_generation() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();

        let nonce1 = client.next_nonce();
        let nonce2 = client.next_nonce();
        let nonce3 = client.next_nonce();

        // Nonces should be unique
        assert_ne!(nonce1, nonce2);
        assert_ne!(nonce2, nonce3);
        assert_ne!(nonce1, nonce3);
    }

    #[tokio::test]
    async fn test_create_intent_success() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/orders/create"))
            .and(header("Authorization", format!("Bearer {}", MOCK_API_KEY)))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "orderHash": "0xabc123def456",
                "status": "PENDING"
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        let deadline = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 3600;

        let receiver = "0x1234567890abcdef1234567890abcdef12345678";
        let intent = client
            .create_intent(
                42161,
                1,
                USDC_ARB,
                USDT_ETH,
                "1000000000",
                "990000000",
                deadline,
                receiver,
            )
            .await
            .unwrap();

        assert_eq!(intent.order_hash, "0xabc123def456");
        assert_eq!(intent.src_chain_id, 42161);
        assert_eq!(intent.dst_chain_id, 1);
        assert_eq!(intent.amount, "1000000000");
    }

    #[tokio::test]
    async fn test_create_intent_unsupported_route() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();

        let result = client
            .create_intent(
                1, // Ethereum as source (not supported)
                42161,
                USDC_ARB,
                USDT_ETH,
                "1000",
                "990",
                12345,
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            )
            .await;

        assert!(matches!(result, Err(OneInchError::UnsupportedRoute { .. })));
    }

    #[tokio::test]
    async fn test_create_intent_rejects_invalid_address() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();

        let result = client
            .create_intent(
                42161,
                1,
                "not_an_address",
                USDT_ETH,
                "1000",
                "990",
                12345,
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            )
            .await;

        assert!(matches!(result, Err(OneInchError::InvalidParameters(_))));
    }

    #[tokio::test]
    async fn test_create_intent_rejects_invalid_hex_address() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();

        // Valid length and 0x prefix, but contains non-hex chars
        let result = client
            .create_intent(
                42161,
                1,
                "0xZZZZd065e77c8cC2239327C5EDb3A432268e5831",
                USDT_ETH,
                "1000",
                "990",
                99999999999,
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            )
            .await;

        assert!(matches!(result, Err(OneInchError::InvalidParameters(_))));
    }

    #[tokio::test]
    async fn test_create_intent_rejects_past_deadline() {
        let config = FusionPlusConfig::new(MOCK_API_KEY);
        let client = FusionPlusClient::new(config).unwrap();

        // Deadline in the past
        let result = client
            .create_intent(
                42161,
                1,
                USDC_ARB,
                USDT_ETH,
                "1000",
                "990",
                1000, // Unix timestamp 1000 = 1970
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            )
            .await;

        assert!(matches!(result, Err(OneInchError::InvalidParameters(_))));
    }

    #[tokio::test]
    async fn test_get_intent_status_pending() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/orders/0xhash123/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "orderHash": "0xhash123",
                "status": "PENDING",
                "srcChainId": 42161,
                "dstChainId": 1,
                "fills": []
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        let status = client.get_intent_status("0xhash123").await.unwrap();

        assert_eq!(status, IntentStatus::Pending);
        assert!(!status.is_terminal());
    }

    #[tokio::test]
    async fn test_get_intent_status_completed() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/orders/0xhash456/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "orderHash": "0xhash456",
                "status": "COMPLETED",
                "srcChainId": 42161,
                "dstChainId": 1,
                "fills": [{
                    "dstTxHash": "0xtx789",
                    "dstAmount": "995000000",
                    "resolver": "0xresolver123",
                    "settledAt": 1706540350
                }]
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        let status = client.get_intent_status("0xhash456").await.unwrap();

        // Check terminal/success before destructuring (which moves values)
        assert!(status.is_terminal());
        assert!(status.is_success());

        match status {
            IntentStatus::Completed {
                ref dst_tx_hash,
                ref dst_amount,
                ref resolver,
                settled_at,
            } => {
                assert_eq!(dst_tx_hash, "0xtx789");
                assert_eq!(dst_amount, "995000000");
                assert_eq!(resolver, "0xresolver123");
                assert_eq!(settled_at, 1706540350);
            }
            _ => panic!("Expected Completed status"),
        }
    }

    #[tokio::test]
    async fn test_get_intent_status_not_found() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/orders/0xnonexistent/status"))
            .respond_with(ResponseTemplate::new(404).set_body_json(serde_json::json!({
                "error": "Order not found"
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        let result = client.get_intent_status("0xnonexistent").await;

        assert!(matches!(result, Err(OneInchError::IntentNotFound { .. })));
    }

    #[tokio::test]
    async fn test_rate_limit_backoff() {
        let mock_server = MockServer::start().await;

        // Return 429 twice, then success
        Mock::given(method("GET"))
            .and(path("/orders/0xhash_backoff/status"))
            .respond_with(ResponseTemplate::new(429))
            .up_to_n_times(2)
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/orders/0xhash_backoff/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "orderHash": "0xhash_backoff",
                "status": "PENDING",
                "srcChainId": 42161,
                "dstChainId": 1,
                "fills": []
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        client.reset_retry_count();

        let status = client.get_intent_status("0xhash_backoff").await.unwrap();

        assert_eq!(status, IntentStatus::Pending);
        assert_eq!(client.retry_count(), 2);
    }

    #[tokio::test]
    async fn test_get_quote_success() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/quote"))
            .and(query_param("srcChainId", "42161"))
            .and(query_param("dstChainId", "1"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "dstAmount": "995000000",
                "estimatedFee": "5000000",
                "estimatedTime": 180,
                "quoteExpiry": 1706540500
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        let quote = client
            .get_quote(42161, 1, USDC_ARB, USDT_ETH, "1000000000")
            .await
            .unwrap();

        assert_eq!(quote.dst_amount, "995000000");
        assert_eq!(quote.estimated_time, 180);
    }

    #[tokio::test]
    async fn test_invalid_api_key() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/orders/0xhash/status"))
            .respond_with(ResponseTemplate::new(401).set_body_json(serde_json::json!({
                "error": "Unauthorized"
            })))
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server).await;
        let result = client.get_intent_status("0xhash").await;

        assert!(matches!(result, Err(OneInchError::InvalidApiKey)));
    }
}
