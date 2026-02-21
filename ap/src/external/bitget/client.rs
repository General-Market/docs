//! Bitget API client implementation
//!
//! Provides authenticated access to Bitget Spot API for order placement,
//! fill queries, and order status checks.

use reqwest::Client;
use rust_decimal::Decimal;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, instrument, warn};

use super::auth::{
    build_auth_headers, generate_timestamp, sign_request, BitgetCredentials,
};
use super::error::{map_bitget_error_code, BitgetError};
use super::types::{
    FillsResponse, OrderDetailResponse, OrderSide, PlaceOrderRequest, PlaceOrderResponse,
    TradingPair,
};

/// Bitget API endpoint configuration
#[derive(Debug, Clone)]
pub struct BitgetConfig {
    /// Base URL for API requests
    pub base_url: String,
    /// Request timeout in milliseconds
    pub timeout_ms: u64,
}

impl BitgetConfig {
    /// Bitget uses the same URL for testnet and mainnet; the environment is determined by API key scope.

    /// Testnet configuration
    pub fn testnet() -> Self {
        Self {
            base_url: "https://api.bitget.com".to_string(),
            timeout_ms: 30_000,
        }
    }

    /// Mainnet configuration (same base URL, different behavior based on API key)
    pub fn mainnet() -> Self {
        Self {
            base_url: "https://api.bitget.com".to_string(),
            timeout_ms: 30_000,
        }
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = timeout_ms;
        self
    }

    /// Set custom base URL (for testing with mock servers)
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }
}

impl Default for BitgetConfig {
    fn default() -> Self {
        Self::testnet()
    }
}

/// Bitget API client for order placement
///
/// # Example
/// ```ignore
/// use ap::external::bitget::{BitgetClient, BitgetConfig};
///
/// let config = BitgetConfig::testnet();
/// let mut client = BitgetClient::new(config)?;
///
/// client.authenticate("api_key", "api_secret", "passphrase");
///
/// let order_id = client.place_limit_order("BTC/USDC", OrderSide::Buy, amount, price).await?;
/// ```
pub struct BitgetClient {
    config: BitgetConfig,
    http_client: Client,
    credentials: Option<BitgetCredentials>,
}

impl BitgetClient {
    /// Create a new Bitget client with the given configuration
    ///
    /// Returns an error if the HTTP client cannot be created (e.g., TLS initialization fails).
    pub fn new(config: BitgetConfig) -> Result<Self, BitgetError> {
        let http_client = Client::builder()
            .timeout(Duration::from_millis(config.timeout_ms))
            .build()
            .map_err(|e| BitgetError::invalid_request(format!("failed to create HTTP client: {}", e)))?;

        Ok(Self {
            config,
            http_client,
            credentials: None,
        })
    }

    /// Authenticate the client with API credentials
    ///
    /// # Arguments
    /// * `api_key` - Bitget API key
    /// * `api_secret` - Bitget API secret
    /// * `passphrase` - Bitget API passphrase
    ///
    /// # Returns
    /// `Ok(())` if credentials are valid format, `Err` otherwise
    pub fn authenticate(
        &mut self,
        api_key: impl Into<String>,
        api_secret: impl Into<String>,
        passphrase: impl Into<String>,
    ) -> Result<(), BitgetError> {
        let credentials = BitgetCredentials::new(api_key, api_secret, passphrase);

        if !credentials.validate_format() {
            return Err(BitgetError::invalid_request(
                "invalid credential format: api_key and api_secret must be at least 10 characters, passphrase must be non-empty",
            ));
        }

        debug!("Bitget client authenticated with key: {:?}", credentials);
        self.credentials = Some(credentials);
        Ok(())
    }

    /// Check if the client is authenticated
    pub fn is_authenticated(&self) -> bool {
        self.credentials.is_some()
    }

    /// Get credentials or return error
    fn require_credentials(&self) -> Result<&BitgetCredentials, BitgetError> {
        self.credentials.as_ref().ok_or(BitgetError::NotAuthenticated)
    }

    /// Place a limit order on Bitget
    ///
    /// # Arguments
    /// * `pair` - Trading pair in internal format (e.g., "BTC/USDC")
    /// * `side` - Order side (buy or sell)
    /// * `amount` - Order size/quantity
    /// * `price` - Limit price
    ///
    /// # Returns
    /// Bitget order ID on success
    #[instrument(skip(self), fields(pair = %pair, side = ?side))]
    pub async fn place_limit_order(
        &self,
        pair: &str,
        side: OrderSide,
        amount: Decimal,
        price: Decimal,
    ) -> Result<String, BitgetError> {
        let credentials = self.require_credentials()?;

        // Validate amount and price are positive
        if amount <= Decimal::ZERO {
            return Err(BitgetError::invalid_request(
                "amount must be positive",
            ));
        }
        if price <= Decimal::ZERO {
            return Err(BitgetError::invalid_request(
                "price must be positive",
            ));
        }

        // Parse and convert trading pair
        let trading_pair = TradingPair::from_internal(pair).ok_or_else(|| {
            BitgetError::invalid_request(format!(
                "invalid pair format '{}': expected 'BASE/QUOTE' (e.g., 'BTC/USDC')",
                pair
            ))
        })?;

        let symbol = trading_pair.to_bitget_symbol();
        debug!(symbol = %symbol, "placing limit order");

        // Build request
        let request = PlaceOrderRequest::limit_order(&symbol, side, price, amount);
        let body = serde_json::to_string(&request)
            .map_err(|e| BitgetError::invalid_request(format!("failed to serialize request: {}", e)))?;

        // Sign request
        let request_path = "/api/spot/v1/trade/orders";
        let timestamp = generate_timestamp()
            .map_err(|e| BitgetError::invalid_request(format!("timestamp error: {}", e)))?;
        let signed = sign_request(credentials, timestamp, "POST", request_path, &body)
            .map_err(|e| BitgetError::invalid_request(format!("signing error: {}", e)))?;
        let headers = build_auth_headers(&signed);

        // Build and send HTTP request
        let url = format!("{}{}", self.config.base_url, request_path);
        let mut req_builder = self.http_client.post(&url).body(body);

        for (name, value) in headers {
            req_builder = req_builder.header(name, value);
        }

        let response = req_builder.send().await?;
        let status = response.status();

        // Handle HTTP-level rate limiting
        if status.as_u16() == 429 {
            let retry_after = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1000);
            return Err(BitgetError::rate_limited(retry_after));
        }

        // Parse response (don't log full response - may contain sensitive account data)
        let response_text = response.text().await?;
        debug!(response_len = response_text.len(), "received response");

        let parsed: PlaceOrderResponse = serde_json::from_str(&response_text)
            .map_err(|e| BitgetError::invalid_request(format!("failed to parse response: {}", e)))?;

        // Check for API-level errors
        if !parsed.is_success() {
            warn!(code = %parsed.code, msg = %parsed.msg, "order placement failed");
            return Err(map_bitget_error_code(&parsed.code, &parsed.msg));
        }

        // Extract order ID
        let data = parsed.data.ok_or_else(|| {
            BitgetError::api_error(-1, "success response missing data field")
        })?;

        debug!(order_id = %data.order_id, "order placed successfully");
        Ok(data.order_id)
    }

    /// Query order details from Bitget
    ///
    /// # Arguments
    /// * `order_id` - Bitget order ID string
    ///
    /// # Returns
    /// Order detail data on success
    #[instrument(skip(self), fields(order_id = %order_id))]
    pub async fn get_order_detail(&self, order_id: &str) -> Result<super::types::OrderDetailData, BitgetError> {
        let credentials = self.require_credentials()?;

        let request_path = format!("/api/spot/v1/trade/orderInfo?orderId={}", order_id);
        let timestamp = generate_timestamp()
            .map_err(|e| BitgetError::invalid_request(format!("timestamp error: {}", e)))?;
        let signed = sign_request(credentials, timestamp, "GET", &request_path, "")
            .map_err(|e| BitgetError::invalid_request(format!("signing error: {}", e)))?;
        let headers = build_auth_headers(&signed);

        let url = format!("{}{}", self.config.base_url, request_path);
        let mut req_builder = self.http_client.get(&url);

        for (name, value) in headers {
            req_builder = req_builder.header(name, value);
        }

        let response = req_builder.send().await?;
        let status = response.status();

        if status.as_u16() == 429 {
            let retry_after = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1000);
            return Err(BitgetError::rate_limited(retry_after));
        }

        let response_text = response.text().await?;
        debug!(response_len = response_text.len(), "received order detail response");

        let parsed: OrderDetailResponse = serde_json::from_str(&response_text)
            .map_err(|e| BitgetError::invalid_request(format!("failed to parse order detail response: {}", e)))?;

        if !parsed.is_success() {
            warn!(code = %parsed.code, msg = %parsed.msg, "order detail query failed");
            return Err(map_bitget_error_code(&parsed.code, &parsed.msg));
        }

        parsed.data.ok_or_else(|| {
            BitgetError::api_error(-1, "success response missing data field")
        })
    }

    /// Query fills/trades for an order from Bitget
    ///
    /// # Arguments
    /// * `order_id` - Bitget order ID string
    ///
    /// # Returns
    /// List of fill records on success
    #[instrument(skip(self), fields(order_id = %order_id))]
    pub async fn get_order_fills(&self, order_id: &str) -> Result<Vec<super::types::FillData>, BitgetError> {
        let credentials = self.require_credentials()?;

        let request_path = format!("/api/spot/v1/trade/fills?orderId={}", order_id);
        let timestamp = generate_timestamp()
            .map_err(|e| BitgetError::invalid_request(format!("timestamp error: {}", e)))?;
        let signed = sign_request(credentials, timestamp, "GET", &request_path, "")
            .map_err(|e| BitgetError::invalid_request(format!("signing error: {}", e)))?;
        let headers = build_auth_headers(&signed);

        let url = format!("{}{}", self.config.base_url, request_path);
        let mut req_builder = self.http_client.get(&url);

        for (name, value) in headers {
            req_builder = req_builder.header(name, value);
        }

        let response = req_builder.send().await?;
        let status = response.status();

        if status.as_u16() == 429 {
            let retry_after = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1000);
            return Err(BitgetError::rate_limited(retry_after));
        }

        let response_text = response.text().await?;
        debug!(response_len = response_text.len(), "received fills response");

        let parsed: FillsResponse = serde_json::from_str(&response_text)
            .map_err(|e| BitgetError::invalid_request(format!("failed to parse fills response: {}", e)))?;

        if !parsed.is_success() {
            warn!(code = %parsed.code, msg = %parsed.msg, "fills query failed");
            return Err(map_bitget_error_code(&parsed.code, &parsed.msg));
        }

        Ok(parsed.data.unwrap_or_default())
    }

    /// Get the current configuration
    pub fn config(&self) -> &BitgetConfig {
        &self.config
    }
}

/// Convert a U256 value with `decimals` precision to a Decimal string.
///
/// Example: U256(42_000_500_000_000_000_000_000) with 18 decimals -> "42000.500000000000000000"
/// Bitget typically supports up to 8 decimal places for prices, so the caller may want to
/// truncate the result.
pub fn u256_to_decimal(value: ethers::types::U256, decimals: u8) -> Decimal {
    let divisor_dec = Decimal::from_str(&ethers::types::U256::exp10(decimals as usize).to_string())
        .unwrap_or(Decimal::ONE);
    let value_dec = Decimal::from_str(&value.to_string()).unwrap_or(Decimal::ZERO);
    value_dec / divisor_dec
}

/// Convert a Decimal string value to U256 with `decimals` precision.
///
/// Example: Decimal("42000.50") with 18 decimals -> U256(42_000_500_000_000_000_000_000)
pub fn decimal_to_u256(value: Decimal, decimals: u8) -> ethers::types::U256 {
    let multiplier = Decimal::from_str(&ethers::types::U256::exp10(decimals as usize).to_string())
        .unwrap_or(Decimal::ONE);
    let scaled = value * multiplier;
    // Truncate to integer
    let truncated = scaled.trunc();
    ethers::types::U256::from_dec_str(&truncated.to_string()).unwrap_or(ethers::types::U256::zero())
}

/// Convert common::types::Side to bitget OrderSide
pub fn side_to_order_side(side: common::types::Side) -> OrderSide {
    match side {
        common::types::Side::Buy => OrderSide::Buy,
        common::types::Side::Sell => OrderSide::Sell,
    }
}

/// Map Bitget order status string to common::types::OrderStatus
pub fn bitget_status_to_order_status(status: &str) -> common::types::OrderStatus {
    match status {
        "new" | "init" => common::types::OrderStatus::Pending,
        "partial_fill" => common::types::OrderStatus::Batched,
        "full_fill" => common::types::OrderStatus::Filled,
        "cancelled" => common::types::OrderStatus::Cancelled,
        _ => common::types::OrderStatus::Pending,
    }
}

impl std::fmt::Debug for BitgetClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BitgetClient")
            .field("config", &self.config)
            .field("authenticated", &self.is_authenticated())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let testnet = BitgetConfig::testnet();
        assert_eq!(testnet.base_url, "https://api.bitget.com");
        assert_eq!(testnet.timeout_ms, 30_000);

        let mainnet = BitgetConfig::mainnet();
        assert_eq!(mainnet.base_url, "https://api.bitget.com");
    }

    #[test]
    fn test_config_builder() {
        let config = BitgetConfig::testnet()
            .with_timeout(60_000)
            .with_base_url("http://localhost:8080");

        assert_eq!(config.timeout_ms, 60_000);
        assert_eq!(config.base_url, "http://localhost:8080");
    }

    #[test]
    fn test_client_creation() {
        let config = BitgetConfig::testnet();
        let client = BitgetClient::new(config).unwrap();

        assert!(!client.is_authenticated());
    }

    #[test]
    fn test_authentication_success() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();

        let result = client.authenticate(
            "bg_test_api_key_12345",
            "test_secret_key_67890",
            "test_passphrase",
        );

        assert!(result.is_ok());
        assert!(client.is_authenticated());
    }

    #[test]
    fn test_authentication_invalid_format() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();

        // Empty credentials
        let result = client.authenticate("", "", "");
        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
        assert!(!client.is_authenticated());

        // Too short
        let result = client.authenticate("short", "short", "pass");
        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }

    #[test]
    fn test_require_credentials_when_not_authenticated() {
        let config = BitgetConfig::testnet();
        let client = BitgetClient::new(config).unwrap();

        let result = client.require_credentials();
        assert!(matches!(result, Err(BitgetError::NotAuthenticated)));
    }

    #[tokio::test]
    async fn test_place_order_requires_authentication() {
        let config = BitgetConfig::testnet();
        let client = BitgetClient::new(config).unwrap();

        let result = client
            .place_limit_order("BTC/USDC", OrderSide::Buy, Decimal::new(1, 3), Decimal::new(42000, 0))
            .await;

        assert!(matches!(result, Err(BitgetError::NotAuthenticated)));
    }

    #[tokio::test]
    async fn test_place_order_invalid_pair_format() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();
        client
            .authenticate("bg_test_key_12345", "test_secret_67890", "passphrase")
            .unwrap();

        let result = client
            .place_limit_order("INVALID", OrderSide::Buy, Decimal::new(1, 3), Decimal::new(42000, 0))
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }

    #[tokio::test]
    async fn test_place_order_zero_amount() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();
        client
            .authenticate("bg_test_key_12345", "test_secret_67890", "passphrase")
            .unwrap();

        let result = client
            .place_limit_order("BTC/USDC", OrderSide::Buy, Decimal::ZERO, Decimal::new(42000, 0))
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }

    #[tokio::test]
    async fn test_place_order_negative_amount() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();
        client
            .authenticate("bg_test_key_12345", "test_secret_67890", "passphrase")
            .unwrap();

        let result = client
            .place_limit_order("BTC/USDC", OrderSide::Buy, Decimal::new(-1, 0), Decimal::new(42000, 0))
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }

    #[tokio::test]
    async fn test_place_order_zero_price() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();
        client
            .authenticate("bg_test_key_12345", "test_secret_67890", "passphrase")
            .unwrap();

        let result = client
            .place_limit_order("BTC/USDC", OrderSide::Buy, Decimal::new(1, 3), Decimal::ZERO)
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }

    #[tokio::test]
    async fn test_place_order_negative_price() {
        let config = BitgetConfig::testnet();
        let mut client = BitgetClient::new(config).unwrap();
        client
            .authenticate("bg_test_key_12345", "test_secret_67890", "passphrase")
            .unwrap();

        let result = client
            .place_limit_order("BTC/USDC", OrderSide::Buy, Decimal::new(1, 3), Decimal::new(-42000, 0))
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }
}
