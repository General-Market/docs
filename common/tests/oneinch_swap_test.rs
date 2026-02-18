//! Integration tests for 1inch Swap Calldata Builder
//!
//! Tests the swap builder with mocked 1inch API responses to verify:
//! - Correct API request formatting
//! - Response parsing and calldata extraction
//! - Error handling for various failure scenarios
//! - Custody encoding correctness

use common::integrations::oneinch::{
    calculate_min_return, slippage_tier_to_bps, OneInchConfig, OneInchError,
    SwapCalldataBuilder, SwapParams, ONEINCH_ROUTER_V6,
};
use ethers::types::{Address, U256};
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Create a test config pointing to mock server
fn create_test_config(mock_url: &str, chain_id: u64) -> OneInchConfig {
    let custody_address: Address = "0x1234567890123456789012345678901234567890"
        .parse()
        .unwrap();

    OneInchConfig::new("test-api-key".to_string(), chain_id, custody_address)
        .with_base_url(mock_url)
}

#[test]
fn test_router_address_is_correct() {
    let router = SwapCalldataBuilder::router_address();
    assert_eq!(
        format!("{:?}", router).to_lowercase(),
        ONEINCH_ROUTER_V6.to_lowercase()
    );
}

#[test]
fn test_all_supported_chains_create_builder() {
    let chain_ids = [1u64, 42161, 8453, 10]; // Ethereum, Arbitrum, Base, Optimism

    for chain_id in chain_ids {
        let config = create_test_config("http://localhost", chain_id);
        let result = SwapCalldataBuilder::new(config);
        assert!(
            result.is_ok(),
            "Should create builder for chain {}",
            chain_id
        );
    }
}

#[test]
fn test_unsupported_chain_fails() {
    let config = create_test_config("http://localhost", 999);
    let result = SwapCalldataBuilder::new(config);
    assert!(matches!(
        result,
        Err(OneInchError::UnsupportedChain { chain_id: 999 })
    ));
}

#[test]
fn test_approve_calldata_format() {
    let amount = U256::MAX;

    let calldata = SwapCalldataBuilder::build_approve_calldata(amount);

    // Verify function selector for approve(address,uint256)
    // keccak256("approve(address,uint256)") = 0x095ea7b3...
    assert_eq!(&calldata[..4], &[0x09, 0x5e, 0xa7, 0xb3]);

    // Total length: 4 (selector) + 32 (address) + 32 (uint256)
    assert_eq!(calldata.len(), 68);

    // Extract spender address from calldata (bytes 4-36)
    let spender_bytes = &calldata[4..36];
    // Address is right-padded with zeros, so we check last 20 bytes
    let expected_router: Address = ONEINCH_ROUTER_V6.parse().unwrap();
    let extracted_spender: Address = Address::from_slice(&spender_bytes[12..]);
    assert_eq!(extracted_spender, expected_router);
}

#[test]
fn test_encode_for_custody_structure() {
    let config = create_test_config("http://localhost", 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    // Sample swap calldata (would come from 1inch API)
    let sample_calldata = vec![0x12, 0xaa, 0x3c, 0xaf, 0x00, 0x01, 0x02, 0x03];
    let nonce = U256::from(42);

    let custody_params = builder.encode_for_custody(&sample_calldata, nonce);

    // Verify structure
    assert_eq!(custody_params.target, SwapCalldataBuilder::router_address());
    assert_eq!(custody_params.data, sample_calldata);
    assert_eq!(custody_params.nonce, nonce);
    assert_eq!(custody_params.message_to_sign.len(), 32);
}

#[test]
fn test_custody_message_hash_includes_chain_id() {
    let config_arb = create_test_config("http://localhost", 42161);
    let config_eth = create_test_config("http://localhost", 1);

    let builder_arb = SwapCalldataBuilder::new(config_arb).unwrap();
    let builder_eth = SwapCalldataBuilder::new(config_eth).unwrap();

    let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];
    let nonce = U256::from(1);

    let params_arb = builder_arb.encode_for_custody(&calldata, nonce);
    let params_eth = builder_eth.encode_for_custody(&calldata, nonce);

    // Different chains should produce different message hashes
    assert_ne!(params_arb.message_to_sign, params_eth.message_to_sign);
}

#[test]
fn test_custody_message_hash_includes_custody_address() {
    let custody1: Address = "0x1111111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let custody2: Address = "0x2222222222222222222222222222222222222222"
        .parse()
        .unwrap();

    let config1 = OneInchConfig::new("key".to_string(), 42161, custody1);
    let config2 = OneInchConfig::new("key".to_string(), 42161, custody2);

    let builder1 = SwapCalldataBuilder::new(config1).unwrap();
    let builder2 = SwapCalldataBuilder::new(config2).unwrap();

    let calldata = vec![0x12, 0xaa];
    let nonce = U256::from(1);

    let params1 = builder1.encode_for_custody(&calldata, nonce);
    let params2 = builder2.encode_for_custody(&calldata, nonce);

    // Different custody addresses should produce different hashes
    assert_ne!(params1.message_to_sign, params2.message_to_sign);
}

#[test]
fn test_custody_message_hash_includes_nonce() {
    let config = create_test_config("http://localhost", 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];

    let params1 = builder.encode_for_custody(&calldata, U256::from(1));
    let params2 = builder.encode_for_custody(&calldata, U256::from(2));

    // Different nonces must produce different hashes (replay protection)
    assert_ne!(params1.message_to_sign, params2.message_to_sign);
}

#[test]
fn test_custody_message_hash_includes_calldata() {
    let config = create_test_config("http://localhost", 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let calldata1 = vec![0x12, 0xaa, 0x3c, 0xaf];
    let calldata2 = vec![0x12, 0xaa, 0x3c, 0xb0]; // Different last byte
    let nonce = U256::from(1);

    let params1 = builder.encode_for_custody(&calldata1, nonce);
    let params2 = builder.encode_for_custody(&calldata2, nonce);

    // Different calldata must produce different hashes
    assert_ne!(params1.message_to_sign, params2.message_to_sign);
}

#[test]
fn test_min_return_calculation_various_slippages() {
    let base = U256::from(1_000_000_000_000_000_000u64); // 1e18

    // 0.3% slippage (30 bps)
    let result_03 = calculate_min_return(base, 30);
    assert_eq!(result_03, U256::from(997_000_000_000_000_000u64));

    // 1% slippage (100 bps)
    let result_1 = calculate_min_return(base, 100);
    assert_eq!(result_1, U256::from(990_000_000_000_000_000u64));

    // 3% slippage (300 bps)
    let result_3 = calculate_min_return(base, 300);
    assert_eq!(result_3, U256::from(970_000_000_000_000_000u64));

    // 5% slippage (500 bps)
    let result_5 = calculate_min_return(base, 500);
    assert_eq!(result_5, U256::from(950_000_000_000_000_000u64));
}

#[test]
fn test_min_return_zero_slippage() {
    let base = U256::from(1_000_000u64);
    let result = calculate_min_return(base, 0);
    // 0% slippage means 100% of expected
    assert_eq!(result, base);
}

#[test]
fn test_slippage_tiers() {
    assert_eq!(slippage_tier_to_bps(0), 30);   // Tier 0: 0.3%
    assert_eq!(slippage_tier_to_bps(1), 100);  // Tier 1: 1%
    assert_eq!(slippage_tier_to_bps(2), 300);  // Tier 2: 3%
    assert_eq!(slippage_tier_to_bps(3), 300);  // Unknown: defaults to 3%
    assert_eq!(slippage_tier_to_bps(255), 300); // Unknown: defaults to 3%
}

#[test]
fn test_swap_params_builder_pattern() {
    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000".to_string(),
        "990000".to_string(),
        "0xCustody".to_string(),
    );

    // Default values
    assert_eq!(params.slippage, "1");
    assert!(params.allow_partial_fill);
    assert!(params.disable_estimate);

    // With custom values
    let params_custom = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000".to_string(),
        "990000".to_string(),
        "0xCustody".to_string(),
    )
    .with_slippage("0.5")
    .with_partial_fill(false)
    .with_disable_estimate(false);

    assert_eq!(params_custom.slippage, "0.5");
    assert!(!params_custom.allow_partial_fill);
    assert!(!params_custom.disable_estimate);
}

// ============================================================================
// Mocked API tests using wiremock
// ============================================================================

#[tokio::test]
async fn test_build_swap_success_with_mock() {
    let mock_server = MockServer::start().await;

    // Mock successful swap response
    Mock::given(method("GET"))
        .and(path("/swap/v6.0/42161/swap"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "toAmount": "997500000000000000",
            "tx": {
                "from": "0xCustody",
                "to": "0x111111125421ca6dc452d289314280a0f8842a65",
                "data": "0x12aa3caf0001020304050607",
                "value": "0",
                "gas": 200000
            }
        })))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server.uri(), 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000".to_string(),
        "".to_string(), // No min_return check
        "0xCustody".to_string(),
    );

    let result = builder.build_swap(&params).await;
    assert!(result.is_ok(), "build_swap should succeed: {:?}", result);

    let calldata = result.unwrap();
    // Verify the calldata matches what we sent (minus 0x prefix)
    assert_eq!(calldata, hex::decode("12aa3caf0001020304050607").unwrap());
}

#[tokio::test]
async fn test_build_swap_validates_min_return() {
    let mock_server = MockServer::start().await;

    // Mock response with toAmount less than min_return
    Mock::given(method("GET"))
        .and(path("/swap/v6.0/42161/swap"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "toAmount": "900000000000000000", // Less than min_return
            "tx": {
                "from": "0xCustody",
                "to": "0x111111125421ca6dc452d289314280a0f8842a65",
                "data": "0x12aa3caf",
                "value": "0"
            }
        })))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server.uri(), 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000000000000000".to_string(),
        "950000000000000000".to_string(), // min_return > toAmount
        "0xCustody".to_string(),
    );

    let result = builder.build_swap(&params).await;
    assert!(
        matches!(result, Err(OneInchError::InsufficientLiquidity { .. })),
        "Should fail with InsufficientLiquidity when toAmount < min_return: {:?}",
        result
    );
}

#[tokio::test]
async fn test_build_swap_rate_limited_mock() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/swap/v6.0/42161/swap"))
        .respond_with(ResponseTemplate::new(429).insert_header("retry-after", "5"))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server.uri(), 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000".to_string(),
        "".to_string(),
        "0xCustody".to_string(),
    );

    let result = builder.build_swap(&params).await;
    assert!(
        matches!(
            result,
            Err(OneInchError::RateLimited {
                retry_after_ms: Some(5000)
            })
        ),
        "Should return RateLimited with retry_after: {:?}",
        result
    );
}

#[tokio::test]
async fn test_build_swap_invalid_api_key_mock() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/swap/v6.0/42161/swap"))
        .respond_with(ResponseTemplate::new(401).set_body_string("Unauthorized"))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server.uri(), 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000".to_string(),
        "".to_string(),
        "0xCustody".to_string(),
    );

    let result = builder.build_swap(&params).await;
    assert!(
        matches!(result, Err(OneInchError::InvalidApiKey)),
        "Should return InvalidApiKey: {:?}",
        result
    );
}

#[tokio::test]
async fn test_build_swap_insufficient_liquidity_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/swap/v6.0/42161/swap"))
        .respond_with(ResponseTemplate::new(400).set_body_json(serde_json::json!({
            "error": "insufficient liquidity",
            "statusCode": 400,
            "description": "Not enough liquidity to complete swap"
        })))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server.uri(), 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000000000000000000".to_string(), // Large amount
        "".to_string(),
        "0xCustody".to_string(),
    );

    let result = builder.build_swap(&params).await;
    assert!(
        matches!(result, Err(OneInchError::InsufficientLiquidity { .. })),
        "Should return InsufficientLiquidity: {:?}",
        result
    );
}

#[tokio::test]
async fn test_build_swap_empty_calldata_rejected() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/swap/v6.0/42161/swap"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "toAmount": "997500000000000000",
            "tx": {
                "from": "0xCustody",
                "to": "0x111111125421ca6dc452d289314280a0f8842a65",
                "data": "0x", // Empty calldata
                "value": "0"
            }
        })))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server.uri(), 42161);
    let builder = SwapCalldataBuilder::new(config).unwrap();

    let params = SwapParams::new(
        "0xUSDC".to_string(),
        "0xWETH".to_string(),
        "1000000".to_string(),
        "".to_string(),
        "0xCustody".to_string(),
    );

    let result = builder.build_swap(&params).await;
    assert!(
        matches!(result, Err(OneInchError::InvalidCalldata { .. })),
        "Should reject empty calldata: {:?}",
        result
    );
}

#[test]
fn test_known_abi_encoding_vector() {
    // Test with a known ABI encoding vector to verify correctness
    // approve(spender, amount) where:
    // - spender = 0x111111125421ca6dc452d289314280a0f8842a65 (1inch router)
    // - amount = type(uint256).max

    let amount = U256::MAX;

    let calldata = SwapCalldataBuilder::build_approve_calldata(amount);

    // Function selector: 0x095ea7b3
    assert_eq!(calldata[0], 0x09);
    assert_eq!(calldata[1], 0x5e);
    assert_eq!(calldata[2], 0xa7);
    assert_eq!(calldata[3], 0xb3);

    // The spender address (1inch router) padded to 32 bytes
    // 0x000000000000000000000000111111125421ca6dc452d289314280a0f8842a65
    let expected_spender = &calldata[4..36];
    assert!(expected_spender[..12].iter().all(|&b| b == 0)); // Zero padding
    assert_eq!(
        hex::encode(&expected_spender[12..]),
        "111111125421ca6dc452d289314280a0f8842a65"
    );

    // The amount (uint256.max) = all ff bytes
    let amount_bytes = &calldata[36..68];
    assert!(amount_bytes.iter().all(|&b| b == 0xff));
}
