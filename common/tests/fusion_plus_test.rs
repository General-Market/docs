//! Integration tests for 1inch Fusion+ client
//!
//! These tests use wiremock to mock the Fusion+ API responses
//! without making actual network calls.

use common::integrations::oneinch::{
    FusionPlusClient, FusionPlusClientTrait, FusionPlusConfig, IntentStatus, OneInchError,
};
use std::time::Duration;
use wiremock::matchers::{header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

const MOCK_API_KEY: &str = "test-api-key-12345";
const USDC_ARB: &str = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDT_ETH: &str = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

async fn create_test_client(mock_server: &MockServer) -> FusionPlusClient {
    let config = FusionPlusConfig::new(MOCK_API_KEY)
        .with_base_url(mock_server.uri())
        .with_timeout(Duration::from_secs(10))
        .with_backoff_ms(vec![10, 20, 40, 80, 160]); // Fast backoff for tests
    FusionPlusClient::new(config).expect("Failed to create client")
}

fn deadline_future() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + 3600
}

// =============================================================================
// Intent Creation Tests (AC #1, #4)
// =============================================================================

#[tokio::test]
async fn test_create_intent_with_all_parameters() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/orders/create"))
        .and(header("Authorization", format!("Bearer {}", MOCK_API_KEY)))
        .and(header("Content-Type", "application/json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0x1234567890abcdef",
            "status": "PENDING"
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let deadline = deadline_future();

    let intent = client
        .create_intent(
            42161,                  // Arbitrum (source)
            1,                      // Ethereum (destination)
            USDC_ARB,               // Source token
            USDT_ETH,               // Destination token
            "1000000000",           // 1000 USDC (6 decimals)
            "990000000",            // 990 USDT min (1% slippage)
            deadline,               // Deadline timestamp
            "0x1234567890abcdef1234567890abcdef12345678", // Receiver
        )
        .await
        .expect("Intent creation should succeed");

    assert_eq!(intent.order_hash, "0x1234567890abcdef");
    assert_eq!(intent.src_chain_id, 42161);
    assert_eq!(intent.dst_chain_id, 1);
    assert_eq!(intent.amount, "1000000000");
    assert_eq!(intent.min_return, "990000000");
    assert_eq!(intent.deadline, deadline);
}

// =============================================================================
// Status Tracking Tests (AC #2, #5)
// =============================================================================

#[tokio::test]
async fn test_status_transitions_pending_to_matched() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/orders/0xpending/status"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xpending",
            "status": "MATCHED",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": [],
            "resolver": "0xResolver123"
        })))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let status = client.get_intent_status("0xpending").await.unwrap();

    match status {
        IntentStatus::Matched { resolver } => {
            assert_eq!(resolver, "0xResolver123");
        }
        _ => panic!("Expected Matched status, got {:?}", status),
    }
}

#[tokio::test]
async fn test_status_settling_state() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/orders/0xsettling/status"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xsettling",
            "status": "SETTLING",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": [],
            "resolver": "0xSettlingResolver"
        })))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let status = client.get_intent_status("0xsettling").await.unwrap();

    assert!(!status.is_terminal());
    match status {
        IntentStatus::Settling { resolver } => {
            assert_eq!(resolver, "0xSettlingResolver");
        }
        _ => panic!("Expected Settling status"),
    }
}

#[tokio::test]
async fn test_status_completed_with_fill_details() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/orders/0xcompleted/status"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xcompleted",
            "status": "COMPLETED",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": [{
                "dstTxHash": "0xSettlementTx123",
                "dstAmount": "995000000",
                "resolver": "0xFillingResolver",
                "settledAt": 1706540350
            }]
        })))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let status = client.get_intent_status("0xcompleted").await.unwrap();

    assert!(status.is_terminal());
    assert!(status.is_success());

    match status {
        IntentStatus::Completed {
            dst_tx_hash,
            dst_amount,
            resolver,
            settled_at,
        } => {
            assert_eq!(dst_tx_hash, "0xSettlementTx123");
            assert_eq!(dst_amount, "995000000");
            assert_eq!(resolver, "0xFillingResolver");
            assert_eq!(settled_at, 1706540350);
        }
        _ => panic!("Expected Completed status"),
    }
}

#[tokio::test]
async fn test_status_failed() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/orders/0xfailed/status"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xfailed",
            "status": "FAILED",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": [],
            "error": "Resolver rejected - insufficient liquidity"
        })))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let status = client.get_intent_status("0xfailed").await.unwrap();

    assert!(status.is_terminal());
    assert!(!status.is_success());

    match status {
        IntentStatus::Failed { reason } => {
            assert!(reason.contains("insufficient liquidity"));
        }
        _ => panic!("Expected Failed status"),
    }
}

#[tokio::test]
async fn test_status_expired() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/orders/0xexpired/status"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xexpired",
            "status": "EXPIRED",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": []
        })))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let status = client.get_intent_status("0xexpired").await.unwrap();

    assert!(status.is_terminal());
    assert!(!status.is_success());
    assert_eq!(status, IntentStatus::Expired);
}

// =============================================================================
// Chain Routing Tests (AC #3)
// =============================================================================

#[tokio::test]
async fn test_supported_route_arb_to_eth() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    assert!(client.is_route_supported(42161, 1)); // Arbitrum -> Ethereum
}

#[tokio::test]
async fn test_supported_route_arb_to_base() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    assert!(client.is_route_supported(42161, 8453)); // Arbitrum -> Base
}

#[tokio::test]
async fn test_supported_route_arb_to_optimism() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    assert!(client.is_route_supported(42161, 10)); // Arbitrum -> Optimism
}

#[tokio::test]
async fn test_supported_route_arb_to_solana() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    // Solana uses special chain ID
    assert!(client.is_route_supported(42161, 1399811149)); // Arbitrum -> Solana
}

#[tokio::test]
async fn test_unsupported_route_eth_to_arb() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    // Only Arbitrum as source is supported
    assert!(!client.is_route_supported(1, 42161)); // Ethereum -> Arbitrum
}

#[tokio::test]
async fn test_create_intent_rejects_unsupported_route() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    let result = client
        .create_intent(
            1, // Ethereum (not supported as source)
            42161,
            USDT_ETH,
            USDC_ARB,
            "1000000000",
            "990000000",
            deadline_future(),
            "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        )
        .await;

    assert!(matches!(result, Err(OneInchError::UnsupportedRoute { .. })));
}

// =============================================================================
// Solana Route Intent Creation (AC #3 - non-EVM)
// =============================================================================

#[tokio::test]
async fn test_create_intent_arb_to_solana() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/orders/create"))
        .and(header("Authorization", format!("Bearer {}", MOCK_API_KEY)))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xsolana_intent_hash",
            "status": "PENDING"
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;

    let intent = client
        .create_intent(
            42161,                  // Arbitrum (source)
            1399811149,             // Solana (non-EVM destination)
            USDC_ARB,
            "So11111111111111111111111111111111111111112", // SOL native mint
            "200000000",            // 200 USDC
            "190000000",
            deadline_future(),
            "SoLaNaReceiverAddress111111111111111111111",
        )
        .await
        .expect("Solana route intent creation should succeed");

    assert_eq!(intent.order_hash, "0xsolana_intent_hash");
    assert_eq!(intent.src_chain_id, 42161);
    assert_eq!(intent.dst_chain_id, 1399811149);
}

// =============================================================================
// Error Handling Tests (AC #6)
// =============================================================================

#[tokio::test]
async fn test_exponential_backoff_on_rate_limit() {
    let mock_server = MockServer::start().await;

    // Return 429 three times, then success
    Mock::given(method("GET"))
        .and(path("/orders/0xbackoff/status"))
        .respond_with(ResponseTemplate::new(429))
        .up_to_n_times(3)
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/orders/0xbackoff/status"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "orderHash": "0xbackoff",
            "status": "PENDING",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": []
        })))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    client.reset_retry_count();

    let status = client.get_intent_status("0xbackoff").await.unwrap();

    assert_eq!(status, IntentStatus::Pending);
    assert_eq!(client.retry_count(), 3);
}

#[tokio::test]
async fn test_max_retries_exceeded() {
    let mock_server = MockServer::start().await;

    // Always return 429
    Mock::given(method("GET"))
        .and(path("/orders/0xalways429/status"))
        .respond_with(ResponseTemplate::new(429))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server).await;
    let result = client.get_intent_status("0xalways429").await;

    assert!(matches!(
        result,
        Err(OneInchError::MaxRetriesExceeded { .. })
    ));
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

#[tokio::test]
async fn test_intent_not_found() {
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

// =============================================================================
// Quote Tests
// =============================================================================

#[tokio::test]
async fn test_get_quote_success() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .and(query_param("srcChainId", "42161"))
        .and(query_param("dstChainId", "1"))
        .and(query_param("amount", "1000000000"))
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
async fn test_get_quote_unsupported_route() {
    let config = FusionPlusConfig::new(MOCK_API_KEY);
    let client = FusionPlusClient::new(config).unwrap();

    let result = client
        .get_quote(1, 42161, USDT_ETH, USDC_ARB, "1000000000")
        .await;

    assert!(matches!(result, Err(OneInchError::UnsupportedRoute { .. })));
}

// =============================================================================
// Security Tests
// =============================================================================

#[test]
fn test_api_key_not_in_debug_output() {
    let config = FusionPlusConfig::new("super-secret-api-key-12345");
    let client = FusionPlusClient::new(config).unwrap();

    let debug_output = format!("{:?}", client);

    assert!(!debug_output.contains("super-secret-api-key-12345"));
    assert!(debug_output.contains("[REDACTED]"));
}
