//! Integration-style tests for Bitget client using HTTP mocks
//!
//! These tests use wiremock to simulate Bitget API responses without
//! making real network calls.

#[cfg(test)]
mod mock_tests {
    use rust_decimal::Decimal;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use crate::external::bitget::{BitgetClient, BitgetConfig, BitgetError, OrderSide};

    /// Helper to create a client pointing to the mock server
    fn create_test_client(mock_server_uri: &str) -> BitgetClient {
        let config = BitgetConfig::testnet().with_base_url(mock_server_uri);
        let mut client = BitgetClient::new(config);
        client
            .authenticate(
                "test_api_key_12345",
                "test_secret_key_67890",
                "test_passphrase",
            )
            .unwrap();
        client
    }

    #[tokio::test]
    async fn test_successful_order_placement() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .and(header("ACCESS-KEY", "test_api_key_12345"))
            .and(header("Content-Type", "application/json"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "00000",
                "msg": "success",
                "data": {
                    "orderId": "1234567890123456789",
                    "clientOrderId": null
                }
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),       // 0.001 BTC
                Decimal::new(42000_00, 2), // $42,000.00
            )
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "1234567890123456789");
    }

    #[tokio::test]
    async fn test_rate_limited_response() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(
                ResponseTemplate::new(429)
                    .append_header("retry-after", "5"),
            )
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),
                Decimal::new(42000, 0),
            )
            .await;

        assert!(matches!(result, Err(BitgetError::RateLimited { retry_after_ms: 5 })));
    }

    #[tokio::test]
    async fn test_invalid_credentials_error() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "40001",
                "msg": "Invalid API key",
                "data": null
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),
                Decimal::new(42000, 0),
            )
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidCredentials)));
    }

    #[tokio::test]
    async fn test_insufficient_balance_error() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "40602",
                "msg": "Insufficient balance",
                "data": null
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(100, 0), // 100 BTC - unlikely to have this balance
                Decimal::new(42000, 0),
            )
            .await;

        assert!(matches!(result, Err(BitgetError::InsufficientBalance { .. }) | Err(BitgetError::InsufficientBalanceRaw { .. })));
    }

    #[tokio::test]
    async fn test_invalid_symbol_error() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "40601",
                "msg": "Symbol does not exist",
                "data": null
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "FAKE/COIN",
                OrderSide::Buy,
                Decimal::new(1, 0),
                Decimal::new(1, 0),
            )
            .await;

        assert!(matches!(result, Err(BitgetError::InvalidSymbol { .. })));
    }

    #[tokio::test]
    async fn test_order_rejected_error() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "40606",
                "msg": "Order amount too small",
                "data": null
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 10), // 0.0000000001 - too small
                Decimal::new(42000, 0),
            )
            .await;

        assert!(matches!(result, Err(BitgetError::OrderRejected { .. })));
    }

    #[tokio::test]
    async fn test_sell_order() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "00000",
                "msg": "success",
                "data": {
                    "orderId": "9876543210",
                    "clientOrderId": null
                }
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "ETH/USDC",
                OrderSide::Sell,
                Decimal::new(5, 1), // 0.5 ETH
                Decimal::new(2500, 0), // $2,500
            )
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "9876543210");
    }

    #[tokio::test]
    async fn test_headers_are_set_correctly() {
        let mock_server = MockServer::start().await;

        // This mock verifies that the required static headers are present
        // We use header_exists for dynamic headers (timestamp, sign)
        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .and(header("ACCESS-KEY", "test_api_key_12345"))
            .and(header("ACCESS-PASSPHRASE", "test_passphrase"))
            .and(header("Content-Type", "application/json"))
            .and(wiremock::matchers::header_exists("ACCESS-TIMESTAMP"))
            .and(wiremock::matchers::header_exists("ACCESS-SIGN"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "00000",
                "msg": "success",
                "data": {
                    "orderId": "header_test_order_id",
                    "clientOrderId": null
                }
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),
                Decimal::new(42000, 0),
            )
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_malformed_response_error() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_string("not valid json"))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),
                Decimal::new(42000, 0),
            )
            .await;

        // Should error on invalid JSON
        assert!(matches!(result, Err(BitgetError::InvalidRequest { .. })));
    }

    #[tokio::test]
    async fn test_success_response_missing_data() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "code": "00000",
                "msg": "success",
                "data": null
            })))
            .expect(1)
            .mount(&mock_server)
            .await;

        let client = create_test_client(&mock_server.uri());

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),
                Decimal::new(42000, 0),
            )
            .await;

        // Success response but no data should error
        assert!(matches!(result, Err(BitgetError::ApiError { .. })));
    }

    #[tokio::test]
    async fn test_request_timeout() {
        let mock_server = MockServer::start().await;

        // Configure mock to delay response longer than client timeout
        // Note: Don't use .expect(1) as the request may not complete due to timeout
        Mock::given(method("POST"))
            .and(path("/api/spot/v1/trade/orders"))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_json(serde_json::json!({
                        "code": "00000",
                        "msg": "success",
                        "data": { "orderId": "123" }
                    }))
                    .set_delay(std::time::Duration::from_secs(5)), // 5 second delay
            )
            .mount(&mock_server)
            .await;

        // Create client with very short timeout (100ms)
        let config = BitgetConfig::testnet()
            .with_base_url(&mock_server.uri())
            .with_timeout(100); // 100ms timeout
        let mut client = BitgetClient::new(config);
        client
            .authenticate(
                "test_api_key_12345",
                "test_secret_key_67890",
                "test_passphrase",
            )
            .unwrap();

        let result = client
            .place_limit_order(
                "BTC/USDC",
                OrderSide::Buy,
                Decimal::new(1, 3),
                Decimal::new(42000, 0),
            )
            .await;

        // Should error due to timeout (NetworkError wraps reqwest timeout)
        assert!(matches!(result, Err(BitgetError::NetworkError { .. })));
    }
}
