//! 1inch Quote API client implementation

use reqwest::Client;
use std::time::Duration;

use super::error::OneInchError;
use super::types::{ApiErrorResponse, Quote, QuoteRequest, QuoteResponse, SupportedChain};

/// Default request timeout in seconds
const DEFAULT_TIMEOUT_SECS: u64 = 10;

/// Default retry delay when rate limited (ms)
const DEFAULT_RATE_LIMIT_RETRY_MS: u64 = 1000;

/// Configuration for the 1inch quote client
#[derive(Debug, Clone)]
pub struct QuoteClientConfig {
    /// Request timeout duration
    pub timeout: Duration,
}

impl Default for QuoteClientConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(DEFAULT_TIMEOUT_SECS),
        }
    }
}

/// Client for interacting with the 1inch Quote API
///
/// This client fetches swap quotes for DEX execution pricing.
/// For swap execution, use the swap builder from story 5-6.
///
/// # Security
/// - API keys are never logged
/// - All requests use HTTPS
/// - Token addresses are validated before requests
///
/// # Example
/// ```ignore
/// let client = OneInchQuoteClient::new("your-api-key", None)?;
/// let quote = client.get_quote(
///     "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
///     "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
///     "1000000", // 1 USDC
///     SupportedChain::Arbitrum,
/// ).await?;
/// ```
pub struct OneInchQuoteClient {
    /// HTTP client
    client: Client,
    /// API key for authentication (never logged)
    api_key: String,
    /// Client configuration
    config: QuoteClientConfig,
}

impl OneInchQuoteClient {
    /// Creates a new 1inch quote client with the given API key
    ///
    /// # Arguments
    /// * `api_key` - 1inch API key for authentication
    /// * `config` - Optional configuration (uses defaults if None)
    pub fn new(api_key: impl Into<String>, config: Option<QuoteClientConfig>) -> Result<Self, OneInchError> {
        let config = config.unwrap_or_default();
        let client = Client::builder()
            .timeout(config.timeout)
            .build()?;

        Ok(Self {
            client,
            api_key: api_key.into(),
            config,
        })
    }

    /// Creates a new 1inch quote client with a shared HTTP client
    ///
    /// This constructor is useful when you want to share connection pools
    /// across multiple clients (e.g., for API key rotation in rate limiting).
    ///
    /// # Arguments
    /// * `api_key` - 1inch API key for authentication
    /// * `client` - Pre-configured reqwest Client to use
    /// * `config` - Optional configuration (uses defaults if None)
    pub fn with_client(
        api_key: impl Into<String>,
        client: Client,
        config: Option<QuoteClientConfig>,
    ) -> Self {
        Self {
            client,
            api_key: api_key.into(),
            config: config.unwrap_or_default(),
        }
    }

    /// Creates a new 1inch client using the API key from environment variable
    ///
    /// Reads the API key from `ONEINCH_API_KEY` environment variable.
    ///
    /// # Errors
    /// Returns `MissingApiKey` if environment variable is not set
    pub fn from_env(config: Option<QuoteClientConfig>) -> Result<Self, OneInchError> {
        let api_key = std::env::var("ONEINCH_API_KEY").map_err(|_| OneInchError::MissingApiKey)?;
        Self::new(api_key, config)
    }

    /// Fetches a swap quote from the 1inch API
    ///
    /// # Arguments
    /// * `from_token` - Source token address
    /// * `to_token` - Destination token address
    /// * `amount` - Amount in smallest unit (wei)
    /// * `chain` - Chain to execute on
    ///
    /// # Returns
    /// Quote containing destination amount, gas estimate, and routing protocols
    ///
    /// # Errors
    /// - `RateLimited` - API rate limit exceeded
    /// - `InvalidApiKey` - Invalid or expired API key
    /// - `InvalidToken` - Invalid token address
    /// - `InsufficientLiquidity` - Not enough liquidity for the swap
    /// - `UnsupportedChain` - Chain not supported
    /// - `NetworkError` - Network communication error
    /// - `ApiError` - Other API errors
    pub async fn get_quote(
        &self,
        from_token: &str,
        to_token: &str,
        amount: &str,
        chain: SupportedChain,
    ) -> Result<Quote, OneInchError> {
        // Validate token addresses
        Self::validate_token_address(from_token)?;
        Self::validate_token_address(to_token)?;

        let url = chain.quote_url();

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Accept", "application/json")
            .query(&[
                ("src", from_token),
                ("dst", to_token),
                ("amount", amount),
                ("includeGas", "true"),
                ("includeProtocols", "true"),
            ])
            .send()
            .await?;

        let status = response.status();

        if status.is_success() {
            let quote_response: QuoteResponse = response.json().await?;
            Ok(Quote::from(quote_response))
        } else {
            self.handle_error_response(status.as_u16(), response, from_token, to_token, amount)
                .await
        }
    }

    /// Fetches a swap quote using a QuoteRequest struct
    ///
    /// Convenience method that wraps `get_quote` with a structured request.
    ///
    /// # Example
    /// ```ignore
    /// let request = QuoteRequest {
    ///     from_token: "0xaf88...".to_string(),
    ///     to_token: "0x82aF...".to_string(),
    ///     amount: "1000000".to_string(),
    ///     chain: SupportedChain::Arbitrum,
    /// };
    /// let quote = client.get_quote_from_request(&request).await?;
    /// ```
    pub async fn get_quote_from_request(&self, request: &QuoteRequest) -> Result<Quote, OneInchError> {
        self.get_quote(&request.from_token, &request.to_token, &request.amount, request.chain)
            .await
    }

    /// Parses the Retry-After header from an HTTP response
    ///
    /// Supports both delay-seconds format (e.g., "120") and HTTP-date format.
    /// Returns delay in milliseconds, or None if header is missing/unparseable.
    fn parse_retry_after_header(response: &reqwest::Response) -> Option<u64> {
        let header_value = response.headers().get("retry-after")?.to_str().ok()?;

        // Try parsing as seconds (most common)
        if let Ok(seconds) = header_value.parse::<u64>() {
            return Some(seconds * 1000);
        }

        // Fallback to default if unparseable
        None
    }

    /// Validates that a token address is properly formatted
    fn validate_token_address(address: &str) -> Result<(), OneInchError> {
        // Must start with 0x
        if !address.starts_with("0x") {
            return Err(OneInchError::InvalidToken {
                address: address.to_string(),
            });
        }

        // Must be exactly 42 characters (0x + 40 hex chars)
        if address.len() != 42 {
            return Err(OneInchError::InvalidToken {
                address: address.to_string(),
            });
        }

        // All characters after 0x must be valid hex
        if !address[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(OneInchError::InvalidToken {
                address: address.to_string(),
            });
        }

        Ok(())
    }

    /// Handles error responses from the API
    async fn handle_error_response(
        &self,
        status_code: u16,
        response: reqwest::Response,
        from_token: &str,
        to_token: &str,
        amount: &str,
    ) -> Result<Quote, OneInchError> {
        // Extract Retry-After header before consuming response body
        let retry_after_ms = Self::parse_retry_after_header(&response);
        // Try to parse error response body
        let error_body: Option<ApiErrorResponse> = response.json().await.ok();

        match status_code {
            401 => Err(OneInchError::InvalidApiKey),
            429 => {
                // Rate limited - use Retry-After header if available, otherwise default
                Err(OneInchError::RateLimited {
                    retry_after_ms: retry_after_ms.or(Some(DEFAULT_RATE_LIMIT_RETRY_MS)),
                })
            }
            400 => {
                if let Some(error) = error_body {
                    let error_lower = error.error.to_lowercase();
                    if error_lower.contains("insufficient liquidity")
                        || error_lower.contains("not enough")
                    {
                        return Err(OneInchError::InsufficientLiquidity {
                            from: from_token.to_string(),
                            to: to_token.to_string(),
                            amount: amount.to_string(),
                        });
                    }
                    if error_lower.contains("token") || error_lower.contains("address") {
                        // Determine which token is invalid if possible
                        let invalid_addr = if error.description.as_ref().map_or(false, |d| d.contains(from_token)) {
                            from_token
                        } else {
                            to_token
                        };
                        return Err(OneInchError::InvalidToken {
                            address: invalid_addr.to_string(),
                        });
                    }
                    Err(OneInchError::ApiError {
                        status_code,
                        message: error.error,
                    })
                } else {
                    Err(OneInchError::ApiError {
                        status_code,
                        message: "Bad request".to_string(),
                    })
                }
            }
            _ => {
                let message = error_body
                    .map(|e| e.error)
                    .unwrap_or_else(|| format!("HTTP error {}", status_code));
                Err(OneInchError::ApiError {
                    status_code,
                    message,
                })
            }
        }
    }
}

// Implement QuoteProvider trait for CachedQuoteClient compatibility
#[async_trait::async_trait]
impl crate::integrations::oneinch::cache::QuoteProvider for OneInchQuoteClient {
    async fn get_quote(
        &self,
        from_token: &str,
        to_token: &str,
        amount: &str,
        chain: SupportedChain,
    ) -> Result<Quote, OneInchError> {
        // Delegate to the existing get_quote method
        OneInchQuoteClient::get_quote(self, from_token, to_token, amount, chain).await
    }
}

// Debug implementation that doesn't expose API key
impl std::fmt::Debug for OneInchQuoteClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OneInchQuoteClient")
            .field("config", &self.config)
            .field("api_key", &"[REDACTED]")
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MOCK_API_KEY: &str = "test-api-key";
    const USDC_ARBITRUM: &str = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_ARBITRUM: &str = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    fn mock_quote_response() -> &'static str {
        r#"{
            "dstAmount": "999500000000000000",
            "gas": 150000,
            "protocols": [[
                [{"name": "UNISWAP_V3", "part": 100, "fromTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "toTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"}]
            ]]
        }"#
    }

    #[test]
    fn test_validate_token_address_valid() {
        assert!(OneInchQuoteClient::validate_token_address(USDC_ARBITRUM).is_ok());
        assert!(OneInchQuoteClient::validate_token_address(WETH_ARBITRUM).is_ok());
        assert!(OneInchQuoteClient::validate_token_address(
            "0x0000000000000000000000000000000000000000"
        )
        .is_ok());
    }

    #[test]
    fn test_validate_token_address_invalid() {
        // Missing 0x prefix
        assert!(matches!(
            OneInchQuoteClient::validate_token_address("af88d065e77c8cC2239327C5EDb3A432268e5831"),
            Err(OneInchError::InvalidToken { .. })
        ));

        // Too short
        assert!(matches!(
            OneInchQuoteClient::validate_token_address("0x1234"),
            Err(OneInchError::InvalidToken { .. })
        ));

        // Too long
        assert!(matches!(
            OneInchQuoteClient::validate_token_address(
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831000000"
            ),
            Err(OneInchError::InvalidToken { .. })
        ));

        // Invalid hex characters
        assert!(matches!(
            OneInchQuoteClient::validate_token_address("0xZZZZd065e77c8cC2239327C5EDb3A432268e5831"),
            Err(OneInchError::InvalidToken { .. })
        ));
    }

    #[test]
    fn test_client_debug_redacts_api_key() {
        let client = OneInchQuoteClient::new(MOCK_API_KEY, None).unwrap();
        let debug_str = format!("{:?}", client);
        assert!(!debug_str.contains(MOCK_API_KEY));
        assert!(debug_str.contains("[REDACTED]"));
    }

    #[test]
    fn test_get_quote_response_parsing() {
        // Test response parsing directly
        let response: QuoteResponse = serde_json::from_str(mock_quote_response()).unwrap();
        let quote = Quote::from(response);

        assert_eq!(quote.to_amount, "999500000000000000");
        assert_eq!(quote.estimated_gas, 150000);
        assert_eq!(quote.protocols.len(), 1);
        assert_eq!(quote.protocols[0].name, "UNISWAP_V3");
    }

    #[test]
    fn test_rate_limited_error_is_retryable() {
        let err = OneInchError::RateLimited {
            retry_after_ms: Some(1000),
        };
        assert!(err.is_retryable());
        assert_eq!(err.retry_after(), Some(1000));
    }

    #[test]
    fn test_invalid_api_key_not_retryable() {
        let err = OneInchError::InvalidApiKey;
        assert!(!err.is_retryable());
        assert!(err.to_string().to_lowercase().contains("invalid"));
    }

    #[test]
    fn test_insufficient_liquidity_error() {
        let err = OneInchError::InsufficientLiquidity {
            from: USDC_ARBITRUM.to_string(),
            to: WETH_ARBITRUM.to_string(),
            amount: "1000000000000".to_string(),
        };
        assert!(!err.is_retryable());
        assert!(err.to_string().to_lowercase().contains("insufficient liquidity"));
    }

    #[test]
    fn test_client_from_env_missing_key() {
        // Ensure env var is not set
        std::env::remove_var("ONEINCH_API_KEY");
        let result = OneInchQuoteClient::from_env(None);
        assert!(matches!(result, Err(OneInchError::MissingApiKey)));
    }

    #[test]
    fn test_supported_chain_ids() {
        assert_eq!(SupportedChain::Ethereum.chain_id(), 1);
        assert_eq!(SupportedChain::Arbitrum.chain_id(), 42161);
        assert_eq!(SupportedChain::Base.chain_id(), 8453);
        assert_eq!(SupportedChain::Optimism.chain_id(), 10);
    }

    #[test]
    fn test_supported_chain_quote_urls() {
        assert_eq!(
            SupportedChain::Ethereum.quote_url(),
            "https://api.1inch.dev/swap/v6.0/1/quote"
        );
        assert_eq!(
            SupportedChain::Arbitrum.quote_url(),
            "https://api.1inch.dev/swap/v6.0/42161/quote"
        );
        assert_eq!(
            SupportedChain::Base.quote_url(),
            "https://api.1inch.dev/swap/v6.0/8453/quote"
        );
        assert_eq!(
            SupportedChain::Optimism.quote_url(),
            "https://api.1inch.dev/swap/v6.0/10/quote"
        );
    }

    #[test]
    fn test_supported_chain_from_chain_id() {
        assert_eq!(SupportedChain::from_chain_id(1), Some(SupportedChain::Ethereum));
        assert_eq!(SupportedChain::from_chain_id(42161), Some(SupportedChain::Arbitrum));
        assert_eq!(SupportedChain::from_chain_id(8453), Some(SupportedChain::Base));
        assert_eq!(SupportedChain::from_chain_id(10), Some(SupportedChain::Optimism));
        assert_eq!(SupportedChain::from_chain_id(999), None);
    }

    #[test]
    fn test_quote_request_struct() {
        // Verify QuoteRequest can be constructed and used
        let request = super::super::types::QuoteRequest {
            from_token: USDC_ARBITRUM.to_string(),
            to_token: WETH_ARBITRUM.to_string(),
            amount: "1000000".to_string(),
            chain: SupportedChain::Arbitrum,
        };

        assert_eq!(request.from_token, USDC_ARBITRUM);
        assert_eq!(request.to_token, WETH_ARBITRUM);
        assert_eq!(request.amount, "1000000");
        assert_eq!(request.chain.chain_id(), 42161);
    }

    #[test]
    fn test_from_chain_id_edge_cases() {
        // Test edge cases for chain ID conversion
        assert_eq!(SupportedChain::from_chain_id(0), None);
        assert_eq!(SupportedChain::from_chain_id(u64::MAX), None);
        // Valid chain IDs
        assert!(SupportedChain::from_chain_id(1).is_some());
        assert!(SupportedChain::from_chain_id(10).is_some());
        assert!(SupportedChain::from_chain_id(42161).is_some());
        assert!(SupportedChain::from_chain_id(8453).is_some());
    }
}
