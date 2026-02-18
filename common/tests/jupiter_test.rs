//! Integration tests for Jupiter client
//!
//! Uses wiremock for HTTP mocking to test quote fetching, transaction building,
//! and error handling without making real network calls.

use common::integrations::jupiter::{
    JupiterClient, JupiterConfig, JupiterError, QuoteResponse, Route, RoutePlanStep, SwapInfo,
    SwapResponse, BONK_MINT, SOL_MINT, USDC_MINT,
};
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

// =============================================================================
// Test Helpers
// =============================================================================

/// Create a mock quote response JSON
fn mock_quote_json(in_amount: u64, out_amount: u64, slippage_bps: u16) -> String {
    format!(
        r#"{{
            "inputMint": "{}",
            "inAmount": "{}",
            "outputMint": "{}",
            "outAmount": "{}",
            "otherAmountThreshold": "{}",
            "swapMode": "ExactIn",
            "slippageBps": {},
            "priceImpactPct": "0.05",
            "routePlan": [{{
                "swapInfo": {{
                    "ammKey": "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
                    "label": "Raydium",
                    "inputMint": "{}",
                    "outputMint": "{}",
                    "inAmount": "{}",
                    "outAmount": "{}"
                }},
                "percent": 100
            }}],
            "contextSlot": 123456789,
            "timeTaken": 0.5
        }}"#,
        SOL_MINT,
        in_amount,
        USDC_MINT,
        out_amount,
        out_amount * (10000 - slippage_bps as u64) / 10000,
        slippage_bps,
        SOL_MINT,
        USDC_MINT,
        in_amount,
        out_amount
    )
}

/// Create a mock swap response JSON
fn mock_swap_json() -> &'static str {
    r#"{
        "swapTransaction": "AQAAAAAAAAABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8=",
        "lastValidBlockHeight": 300000000
    }"#
}

/// Create a mock error response JSON
fn mock_error_json(message: &str) -> String {
    format!(r#"{{"message": "{}"}}"#, message)
}

/// Create a test client with mock server URL
fn create_test_client(mock_server: &MockServer) -> JupiterClient {
    let config = JupiterConfig::default().with_base_url(mock_server.uri());
    JupiterClient::new(config).unwrap()
}

// =============================================================================
// Quote Fetching Tests
// =============================================================================

#[tokio::test]
async fn test_get_quote_success() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .and(query_param("inputMint", SOL_MINT))
        .and(query_param("outputMint", USDC_MINT))
        .and(query_param("amount", "1000000000"))
        .and(query_param("slippageBps", "50"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let quote = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await
        .expect("Quote should succeed");

    assert_eq!(quote.input_mint, SOL_MINT);
    assert_eq!(quote.output_mint, USDC_MINT);
    assert_eq!(quote.in_amount, 1_000_000_000);
    assert_eq!(quote.out_amount, 25_000_000);
    assert_eq!(quote.slippage_bps, 50);
    assert_eq!(quote.swap_mode, "ExactIn");
    assert!(!quote.route_plan.is_empty());
}

#[tokio::test]
async fn test_get_quote_with_route_details() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let quote = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await
        .unwrap();

    // Verify route plan
    assert_eq!(quote.route_plan.len(), 1);
    let step = &quote.route_plan[0];
    assert_eq!(step.swap_info.label, "Raydium");
    assert_eq!(step.percent, 100);

    // Verify price impact parsing
    assert!((quote.price_impact() - 0.05).abs() < 0.001);

    // Verify is_direct_route
    assert!(quote.is_direct_route());
}

#[tokio::test]
async fn test_get_quote_rate_limited() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(ResponseTemplate::new(429))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let result = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await;

    assert!(matches!(result, Err(JupiterError::RateLimited { .. })));
    if let Err(JupiterError::RateLimited { retry_after_ms }) = result {
        assert!(retry_after_ms.is_some());
    }
}

#[tokio::test]
async fn test_get_quote_insufficient_liquidity() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(
            ResponseTemplate::new(400)
                .set_body_string(mock_error_json("No route found - insufficient liquidity")),
        )
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let result = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await;

    assert!(matches!(
        result,
        Err(JupiterError::InsufficientLiquidity { .. })
    ));
}

#[tokio::test]
async fn test_get_quote_invalid_mint_format() {
    let mock_server = MockServer::start().await;
    let client = create_test_client(&mock_server);

    // Invalid mint - should fail validation before making request
    let result = client
        .get_quote("invalid-mint", USDC_MINT, 1_000_000_000, 50)
        .await;

    assert!(matches!(result, Err(JupiterError::InvalidMint { .. })));
}

#[tokio::test]
async fn test_get_quote_api_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(
            ResponseTemplate::new(500).set_body_string(mock_error_json("Internal server error")),
        )
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let result = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await;

    assert!(matches!(result, Err(JupiterError::ApiError { .. })));
}

// =============================================================================
// Transaction Building Tests
// =============================================================================

#[tokio::test]
async fn test_build_swap_tx_success() {
    let mock_server = MockServer::start().await;

    // First mock the quote
    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    // Then mock the swap
    Mock::given(method("POST"))
        .and(path("/swap"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_swap_json()))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    // Get quote first
    let quote = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await
        .unwrap();

    // Build swap tx - use a valid base58 pubkey (32 bytes)
    let user_pubkey = "11111111111111111111111111111111";
    let swap = client.build_swap_tx(&quote, user_pubkey).await.unwrap();

    assert!(!swap.swap_transaction.is_empty());
    assert!(swap.last_valid_block_height > 0);
}

#[tokio::test]
async fn test_build_swap_tx_invalid_pubkey() {
    let mock_server = MockServer::start().await;

    // Mock the quote
    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let quote = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await
        .unwrap();

    // Invalid pubkey
    let result = client.build_swap_tx(&quote, "invalid").await;

    assert!(matches!(result, Err(JupiterError::InvalidPubkey { .. })));
}

#[tokio::test]
async fn test_decode_transaction_success() {
    let client = JupiterClient::new(JupiterConfig::default()).unwrap();

    let swap = SwapResponse {
        swap_transaction: "AQAAAAAAAAABAgMEBQYHCAkK".to_string(), // Valid base64
        last_valid_block_height: 12345,
    };

    let bytes = client.decode_transaction(&swap);
    assert!(bytes.is_ok());
    assert!(!bytes.unwrap().is_empty());
}

#[tokio::test]
async fn test_decode_transaction_invalid_base64() {
    let client = JupiterClient::new(JupiterConfig::default()).unwrap();

    let swap = SwapResponse {
        swap_transaction: "not!valid!base64!!!".to_string(),
        last_valid_block_height: 12345,
    };

    let result = client.decode_transaction(&swap);
    assert!(matches!(
        result,
        Err(JupiterError::InvalidTransaction { .. })
    ));
}

// =============================================================================
// Route Parsing Tests
// =============================================================================

#[tokio::test]
async fn test_get_route_from_quote() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    let client = create_test_client(&mock_server);

    let quote = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await
        .unwrap();

    let route = client.get_route(&quote);

    assert_eq!(route.input_mint, SOL_MINT);
    assert_eq!(route.output_mint, USDC_MINT);
    assert_eq!(route.in_amount, 1_000_000_000);
    assert_eq!(route.out_amount, 25_000_000);
    assert!(route.is_direct());
    assert_eq!(route.hop_count(), 1);
    assert!(route.uses_dex("Raydium"));
}

#[tokio::test]
async fn test_route_dex_labels() {
    let client = JupiterClient::new(JupiterConfig::default()).unwrap();

    let quote = QuoteResponse {
        input_mint: SOL_MINT.to_string(),
        in_amount: 1_000_000_000,
        output_mint: USDC_MINT.to_string(),
        out_amount: 25_000_000,
        other_amount_threshold: 24_875_000,
        swap_mode: "ExactIn".to_string(),
        slippage_bps: 50,
        price_impact_pct: Some("0.05".to_string()),
        route_plan: vec![
            RoutePlanStep {
                swap_info: SwapInfo {
                    amm_key: "amm1".to_string(),
                    label: "Raydium".to_string(),
                    input_mint: SOL_MINT.to_string(),
                    output_mint: "INTERMEDIATE".to_string(),
                    in_amount: 500_000_000,
                    out_amount: 12_500_000,
                    fee_amount: None,
                    fee_mint: None,
                },
                percent: 50,
            },
            RoutePlanStep {
                swap_info: SwapInfo {
                    amm_key: "amm2".to_string(),
                    label: "Orca".to_string(),
                    input_mint: SOL_MINT.to_string(),
                    output_mint: USDC_MINT.to_string(),
                    in_amount: 500_000_000,
                    out_amount: 12_500_000,
                    fee_amount: None,
                    fee_mint: None,
                },
                percent: 50,
            },
        ],
        context_slot: None,
        time_taken: None,
    };

    let route = client.get_route(&quote);

    assert!(!route.is_direct());
    assert_eq!(route.hop_count(), 2);
    let labels = route.dex_labels();
    assert!(labels.contains(&"Raydium"));
    assert!(labels.contains(&"Orca"));
}

// =============================================================================
// Error Handling Tests
// =============================================================================

#[tokio::test]
async fn test_error_is_retryable() {
    let rate_limited = JupiterError::RateLimited {
        retry_after_ms: Some(1000),
    };
    assert!(rate_limited.is_retryable());
    assert_eq!(rate_limited.retry_after(), Some(1000));

    let api_error = JupiterError::ApiError {
        message: "test".to_string(),
    };
    assert!(!api_error.is_retryable());
    assert_eq!(api_error.retry_after(), None);

    let invalid_mint = JupiterError::InvalidMint {
        mint: "test".to_string(),
    };
    assert!(!invalid_mint.is_retryable());
}

#[tokio::test]
async fn test_slippage_exceeded_error() {
    let err = JupiterError::SlippageExceeded {
        expected: 25_000_000,
        actual: 24_000_000,
    };
    assert!(!err.is_retryable());
    let msg = err.to_string();
    assert!(msg.contains("25000000"));
    assert!(msg.contains("24000000"));
}

#[tokio::test]
async fn test_transaction_too_large_error() {
    let err = JupiterError::TransactionTooLarge {
        accounts: 70,
        limit: 64,
    };
    assert!(!err.is_retryable());
    let msg = err.to_string();
    assert!(msg.contains("70"));
    assert!(msg.contains("64"));
}

// =============================================================================
// Configuration Tests
// =============================================================================

#[test]
fn test_config_from_env_defaults() {
    // Note: We avoid set_var/remove_var here because std::env::set_var is
    // unsound in multi-threaded test contexts (Rust tests run in parallel).
    // Instead we verify from_env() returns valid config with defaults.
    let config = JupiterConfig::from_env();
    assert!(!config.base_url.is_empty());
    assert_eq!(config.timeout.as_secs(), 30);
    assert_eq!(config.max_accounts, 64);
}

#[test]
fn test_config_builder_pattern() {
    let config = JupiterConfig::default()
        .with_api_key("my-key")
        .with_max_accounts(32)
        .with_restrict_intermediate_tokens(false)
        .with_timeout(std::time::Duration::from_secs(60));

    assert_eq!(config.api_key, Some("my-key".to_string()));
    assert_eq!(config.max_accounts, 32);
    assert!(!config.restrict_intermediate_tokens);
    assert_eq!(config.timeout.as_secs(), 60);
}

#[test]
fn test_config_url_methods() {
    let config = JupiterConfig::default();

    assert!(config.quote_url().ends_with("/quote"));
    assert!(config.swap_url().ends_with("/swap"));
    assert!(config.swap_instructions_url().ends_with("/swap-instructions"));
}

// =============================================================================
// API Key Header Tests
// =============================================================================

#[tokio::test]
async fn test_api_key_header_sent_on_quote() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .and(wiremock::matchers::header("x-api-key", "test-key-123"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    let config = JupiterConfig::default()
        .with_base_url(mock_server.uri())
        .with_api_key("test-key-123");
    let client = JupiterClient::new(config).unwrap();

    let result = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await;

    // If the header wasn't sent, wiremock returns 404 (no matching mock)
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_api_key_header_sent_on_swap() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/quote"))
        .and(wiremock::matchers::header("x-api-key", "test-key-456"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_quote_json(
            1_000_000_000,
            25_000_000,
            50,
        )))
        .mount(&mock_server)
        .await;

    Mock::given(method("POST"))
        .and(path("/swap"))
        .and(wiremock::matchers::header("x-api-key", "test-key-456"))
        .respond_with(ResponseTemplate::new(200).set_body_string(mock_swap_json()))
        .mount(&mock_server)
        .await;

    let config = JupiterConfig::default()
        .with_base_url(mock_server.uri())
        .with_api_key("test-key-456");
    let client = JupiterClient::new(config).unwrap();

    let quote = client
        .get_quote(SOL_MINT, USDC_MINT, 1_000_000_000, 50)
        .await
        .unwrap();

    let user_pubkey = "11111111111111111111111111111111";
    let result = client.build_swap_tx(&quote, user_pubkey).await;
    assert!(result.is_ok());
}

// =============================================================================
// Token Mint Constants Tests
// =============================================================================

#[test]
fn test_well_known_mints() {
    // SOL wrapped mint
    assert_eq!(SOL_MINT, "So11111111111111111111111111111111111111112");

    // USDC on Solana
    assert_eq!(USDC_MINT, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

    // BONK memecoin
    assert_eq!(BONK_MINT, "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");

    // All should be valid pubkeys
    use solana_sdk::pubkey::Pubkey;
    use std::str::FromStr;

    assert!(Pubkey::from_str(SOL_MINT).is_ok());
    assert!(Pubkey::from_str(USDC_MINT).is_ok());
    assert!(Pubkey::from_str(BONK_MINT).is_ok());
}

// =============================================================================
// Multi-hop Route Tests
// =============================================================================

#[test]
fn test_multi_hop_route_parsing() {
    let quote = QuoteResponse {
        input_mint: BONK_MINT.to_string(),
        in_amount: 1_000_000_000_000, // 1 trillion BONK
        output_mint: USDC_MINT.to_string(),
        out_amount: 500_000, // 0.5 USDC
        other_amount_threshold: 495_000,
        swap_mode: "ExactIn".to_string(),
        slippage_bps: 100,
        price_impact_pct: Some("0.50".to_string()),
        route_plan: vec![
            RoutePlanStep {
                swap_info: SwapInfo {
                    amm_key: "amm1".to_string(),
                    label: "Raydium".to_string(),
                    input_mint: BONK_MINT.to_string(),
                    output_mint: SOL_MINT.to_string(),
                    in_amount: 1_000_000_000_000,
                    out_amount: 200_000,
                    fee_amount: Some("1000000".to_string()),
                    fee_mint: Some(BONK_MINT.to_string()),
                },
                percent: 100,
            },
            RoutePlanStep {
                swap_info: SwapInfo {
                    amm_key: "amm2".to_string(),
                    label: "Orca".to_string(),
                    input_mint: SOL_MINT.to_string(),
                    output_mint: USDC_MINT.to_string(),
                    in_amount: 200_000,
                    out_amount: 500_000,
                    fee_amount: Some("100".to_string()),
                    fee_mint: Some(SOL_MINT.to_string()),
                },
                percent: 100,
            },
        ],
        context_slot: Some(12345),
        time_taken: Some(0.3),
    };

    let route = Route::from_quote(&quote);

    // Multi-hop route
    assert!(!route.is_direct());
    assert_eq!(route.hop_count(), 2);

    // DEXes used
    assert!(route.uses_dex("Raydium"));
    assert!(route.uses_dex("Orca"));
    assert!(!route.uses_dex("Meteora"));

    // Price impact
    assert!((route.price_impact_pct - 0.50).abs() < 0.01);

    // Estimated fees (should sum up)
    assert_eq!(route.estimated_fees, Some(1_000_100)); // 1000000 + 100

    // Intermediate tokens
    let intermediates = route.intermediate_tokens();
    assert_eq!(intermediates.len(), 1);
    assert!(intermediates.contains(&SOL_MINT));
}

// =============================================================================
// Versioned Transaction Tests
// =============================================================================

#[test]
fn test_deserialize_transaction_failure() {
    let client = JupiterClient::new(JupiterConfig::default()).unwrap();

    // Valid base64 but not a valid serialized transaction
    let swap = SwapResponse {
        swap_transaction: "AQIDBA==".to_string(), // [1, 2, 3, 4] - not a valid tx
        last_valid_block_height: 12345,
    };

    let result = client.deserialize_transaction(&swap);
    assert!(matches!(
        result,
        Err(JupiterError::TransactionDeserializationError { .. })
    ));
}

// =============================================================================
// Client Debug Output Tests
// =============================================================================

#[test]
fn test_client_debug_hides_api_key() {
    let config = JupiterConfig::default().with_api_key("super-secret-key-12345");
    let client = JupiterClient::new(config).unwrap();

    let debug_output = format!("{:?}", client);

    assert!(!debug_output.contains("super-secret-key-12345"));
    assert!(debug_output.contains("[REDACTED]"));
    assert!(debug_output.contains("JupiterClient"));
}
