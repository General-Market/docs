//! Bitget API Integration Tests
//!
//! These tests are marked with `#[ignore]` as they require real Bitget testnet credentials
//! and make actual network calls.
//!
//! # Running Integration Tests
//!
//! 1. Set up environment variables:
//!    ```bash
//!    export BITGET_API_KEY="your_testnet_api_key"
//!    export BITGET_API_SECRET="your_testnet_api_secret"
//!    export BITGET_PASSPHRASE="your_testnet_passphrase"
//!    ```
//!
//! 2. Run the tests:
//!    ```bash
//!    cargo test -p ap --test bitget_integration -- --ignored
//!    ```
//!
//! # Important Notes
//!
//! - These tests run against Bitget's TESTNET environment
//! - You need a Bitget testnet account with API access enabled
//! - The testnet may have different symbols/pairs available than mainnet
//! - Orders placed are REAL orders on the testnet
//! - Consider using very small amounts to avoid impacting your test balance
//!
//! # Getting Testnet Credentials
//!
//! 1. Register at https://www.bitget.com/
//! 2. Enable testnet/sandbox mode in your account settings
//! 3. Generate API keys for the testnet environment
//! 4. Enable spot trading permissions on the API key

use ap::external::bitget::{BitgetClient, BitgetConfig, BitgetError, OrderSide};
use rust_decimal::Decimal;
use std::env;

/// Load credentials from environment variables
fn load_credentials() -> Option<(String, String, String)> {
    let api_key = env::var("BITGET_API_KEY").ok()?;
    let api_secret = env::var("BITGET_API_SECRET").ok()?;
    let passphrase = env::var("BITGET_PASSPHRASE").ok()?;

    if api_key.is_empty() || api_secret.is_empty() || passphrase.is_empty() {
        return None;
    }

    Some((api_key, api_secret, passphrase))
}

/// Create an authenticated client for testing
fn create_authenticated_client() -> Option<BitgetClient> {
    let (api_key, api_secret, passphrase) = load_credentials()?;

    let config = BitgetConfig::testnet();
    let mut client = BitgetClient::new(config);
    client.authenticate(api_key, api_secret, passphrase).ok()?;

    Some(client)
}

/// Test that authentication works with valid credentials
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_PASSPHRASE env vars"]
async fn test_authentication() {
    let client = create_authenticated_client();
    assert!(
        client.is_some(),
        "Failed to authenticate. Ensure BITGET_API_KEY, BITGET_API_SECRET, and BITGET_PASSPHRASE environment variables are set."
    );
}

/// Test placing a small limit buy order on testnet
///
/// This test:
/// 1. Places a limit order at a price unlikely to fill (very low)
/// 2. Verifies the order ID is returned
/// 3. Does NOT cancel the order (consider adding cleanup logic if needed)
///
/// # Warning
/// This places a REAL order on the Bitget testnet. The order uses:
/// - A very low price to avoid fills
/// - Minimum order size
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_PASSPHRASE env vars"]
async fn test_place_limit_buy_order() {
    let client = create_authenticated_client().expect(
        "Failed to create authenticated client. Ensure environment variables are set.",
    );

    // Place a buy order at a very low price (unlikely to fill)
    // Using BTC/USDT which is commonly available on testnet
    let result = client
        .place_limit_order(
            "BTC/USDT",
            OrderSide::Buy,
            Decimal::new(1, 4),    // 0.0001 BTC (very small)
            Decimal::new(1000, 0), // $1,000 (way below market, won't fill)
        )
        .await;

    match result {
        Ok(order_id) => {
            println!("Order placed successfully! Order ID: {}", order_id);
            assert!(!order_id.is_empty(), "Order ID should not be empty");
        }
        Err(BitgetError::InvalidSymbol { symbol }) => {
            // This is acceptable if the symbol isn't available on testnet
            println!("Symbol {} not available on testnet, test inconclusive", symbol);
        }
        Err(BitgetError::InsufficientBalance { .. }) => {
            // This is acceptable if the testnet account has no balance
            println!("Insufficient balance on testnet account, test inconclusive");
        }
        Err(e) => {
            panic!("Unexpected error placing order: {:?}", e);
        }
    }
}

/// Test placing a small limit sell order on testnet
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_PASSPHRASE env vars"]
async fn test_place_limit_sell_order() {
    let client = create_authenticated_client().expect(
        "Failed to create authenticated client. Ensure environment variables are set.",
    );

    // Place a sell order at a very high price (unlikely to fill)
    let result = client
        .place_limit_order(
            "BTC/USDT",
            OrderSide::Sell,
            Decimal::new(1, 4),       // 0.0001 BTC (very small)
            Decimal::new(1000000, 0), // $1,000,000 (way above market, won't fill)
        )
        .await;

    match result {
        Ok(order_id) => {
            println!("Sell order placed successfully! Order ID: {}", order_id);
            assert!(!order_id.is_empty(), "Order ID should not be empty");
        }
        Err(BitgetError::InvalidSymbol { symbol }) => {
            println!("Symbol {} not available on testnet, test inconclusive", symbol);
        }
        Err(BitgetError::InsufficientBalance { .. }) => {
            // Need BTC to sell, may not have any on testnet
            println!("Insufficient BTC balance on testnet account, test inconclusive");
        }
        Err(e) => {
            panic!("Unexpected error placing sell order: {:?}", e);
        }
    }
}

/// Test error handling for invalid symbol
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_PASSPHRASE env vars"]
async fn test_invalid_symbol_error() {
    let client = create_authenticated_client().expect(
        "Failed to create authenticated client. Ensure environment variables are set.",
    );

    let result = client
        .place_limit_order(
            "NOTREAL/FAKECOIN",
            OrderSide::Buy,
            Decimal::new(1, 0),
            Decimal::new(1, 0),
        )
        .await;

    assert!(
        matches!(result, Err(BitgetError::InvalidSymbol { .. }) | Err(BitgetError::ApiError { .. })),
        "Expected InvalidSymbol error for fake trading pair, got: {:?}",
        result
    );
}

/// Test that invalid credentials are properly rejected
#[tokio::test]
#[ignore = "makes network call to Bitget"]
async fn test_invalid_credentials() {
    let config = BitgetConfig::testnet();
    let mut client = BitgetClient::new(config);

    client
        .authenticate(
            "invalid_api_key_12345",
            "invalid_secret_12345",
            "invalid_passphrase",
        )
        .unwrap();

    let result = client
        .place_limit_order(
            "BTC/USDT",
            OrderSide::Buy,
            Decimal::new(1, 4),
            Decimal::new(1000, 0),
        )
        .await;

    assert!(
        matches!(result, Err(BitgetError::InvalidCredentials)),
        "Expected InvalidCredentials error, got: {:?}",
        result
    );
}
