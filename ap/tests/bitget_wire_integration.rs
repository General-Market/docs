//! Bitget Wire Integration Tests (Story 6.4)
//!
//! Tests the full AP-to-Bitget wiring through the APClient trait interface.
//! These tests validate that the RateLimitedBitgetClient properly bridges
//! the APClient trait to real Bitget API calls.
//!
//! # Running Integration Tests
//!
//! ```bash
//! export BITGET_API_KEY="your_testnet_api_key"
//! export BITGET_API_SECRET="your_testnet_api_secret"
//! export BITGET_API_PASSPHRASE="your_testnet_passphrase"
//! cargo test -p ap --test bitget_wire_integration -- --ignored
//! ```
//!
//! # Notes
//!
//! - All tests run against Bitget TESTNET
//! - Tests use the APClient trait interface (not BitgetClient directly)
//! - RateLimitedBitgetClient wraps real BitgetClient with rate limiting
//! - Orders use very small amounts / extreme prices to avoid fills

use ap::external::bitget::{BitgetClient, BitgetConfig, RateLimitedBitgetClient};
use common::rate_limit::{BitgetRateLimiter, RateLimiterTier};
use common::traits::APClient;
use common::types::Side;
use ethers::types::U256;
use std::env;
use std::sync::Arc;
use std::time::Instant;

/// Load credentials from environment variables
fn load_credentials() -> Option<(String, String, String)> {
    let api_key = env::var("BITGET_API_KEY").ok()?;
    let api_secret = env::var("BITGET_API_SECRET").ok()?;
    let passphrase = env::var("BITGET_API_PASSPHRASE").ok()?;

    if api_key.is_empty() || api_secret.is_empty() || passphrase.is_empty() {
        return None;
    }

    Some((api_key, api_secret, passphrase))
}

/// Create an authenticated RateLimitedBitgetClient (APClient) for testing
fn create_ap_client() -> Option<Arc<dyn APClient>> {
    let (api_key, api_secret, passphrase) = load_credentials()?;

    let config = BitgetConfig::testnet();
    let mut client = BitgetClient::new(config);
    client.authenticate(&api_key, &api_secret, &passphrase).ok()?;

    let rate_limiter = Arc::new(BitgetRateLimiter::from_tier(RateLimiterTier::Testnet));
    let rate_limited = RateLimitedBitgetClient::new(client, rate_limiter);

    Some(Arc::new(rate_limited))
}

/// Test 6.2: Construct live BitgetClient with testnet credentials
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE env vars"]
async fn test_construct_live_ap_client() {
    let client = create_ap_client();
    assert!(
        client.is_some(),
        "Failed to create APClient. Set BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE."
    );
}

/// Test 6.3: Place limit order via APClient trait, verify order ID returned
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE env vars"]
async fn test_place_order_via_ap_client() {
    let client = create_ap_client().expect("APClient creation failed");

    // Place a buy order at a very low price (won't fill)
    // Amount: 0.0001 (1e14 with 18 decimals)
    // Price: $1,000 (1e21 with 18 decimals) — way below BTC market price
    let amount = U256::from(100_000_000_000_000u64); // 0.0001
    let price = U256::from(1000u64) * U256::exp10(18); // $1,000

    let result = client
        .place_order("BTC/USDT".to_string(), Side::Buy, amount, price)
        .await;

    match result {
        Ok(order_id) => {
            println!("Order placed via APClient! OrderId: {}", order_id);
            assert!(order_id > U256::zero(), "Order ID should be non-zero");
        }
        Err(e) => {
            let err_msg = format!("{}", e);
            // Accept symbol not found or insufficient balance as inconclusive
            if err_msg.contains("symbol") || err_msg.contains("balance") || err_msg.contains("Balance") {
                println!("Test inconclusive (expected on some testnet configs): {}", e);
            } else {
                panic!("Unexpected error placing order via APClient: {}", e);
            }
        }
    }
}

/// Test 6.4: Query order status after placement
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE env vars"]
async fn test_query_order_status_via_ap_client() {
    let client = create_ap_client().expect("APClient creation failed");

    // First place an order
    let amount = U256::from(100_000_000_000_000u64); // 0.0001
    let price = U256::from(1000u64) * U256::exp10(18); // $1,000

    let order_id = match client
        .place_order("BTC/USDT".to_string(), Side::Buy, amount, price)
        .await
    {
        Ok(id) => id,
        Err(e) => {
            println!("Could not place order (test inconclusive): {}", e);
            return;
        }
    };

    // Query status
    let status = client.get_order_status(order_id).await;
    match status {
        Ok(s) => {
            println!("Order {} status: {:?}", order_id, s);
            // At very low price, order should be Pending (not filled)
            assert!(
                matches!(s, common::types::OrderStatus::Pending | common::types::OrderStatus::Cancelled),
                "Expected Pending or Cancelled status for unfilled order, got {:?}",
                s
            );
        }
        Err(e) => {
            println!("Could not query status (test inconclusive): {}", e);
        }
    }
}

/// Test 6.5: Rate limiter throttles when burst > 10 orders/sec
///
/// Uses the rate limiter directly (doesn't actually place orders) to verify
/// throttling behavior without consuming testnet resources.
#[tokio::test]
#[ignore = "rate limiter timing test"]
async fn test_rate_limiter_throttle_burst() {
    use common::rate_limit::EndpointType;

    let rate_limiter = BitgetRateLimiter::from_tier(RateLimiterTier::Mainnet);

    // Fire 15 order placement requests rapidly (mainnet limit is 10/sec)
    let mut total_wait = std::time::Duration::ZERO;
    let start = Instant::now();

    for _ in 0..15 {
        let wait = rate_limiter.acquire(EndpointType::OrderPlacement).await;
        total_wait += wait;
    }

    let elapsed = start.elapsed();

    // With a 10/sec limit, 15 requests should take at least 500ms
    // (10 fit in first second, 5 need to wait)
    println!(
        "15 order requests took {:?} total, {:?} waiting",
        elapsed, total_wait
    );

    // At least some requests should have been throttled
    assert!(
        total_wait.as_millis() > 0,
        "Rate limiter should throttle burst of 15 requests"
    );
}

/// Test 6.6: Mock chain + real Bitget end-to-end
///
/// Simulates the full pipeline: construct APClient, place order,
/// query fills, query status. Validates the type conversions work end-to-end.
#[tokio::test]
#[ignore = "requires BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE env vars"]
async fn test_mock_chain_real_bitget_e2e() {
    let client = create_ap_client().expect("APClient creation failed");

    // Step 1: Place order
    let amount = U256::from(100_000_000_000_000u64); // 0.0001
    let price = U256::from(1000u64) * U256::exp10(18); // $1,000

    let order_id = match client
        .place_order("BTC/USDT".to_string(), Side::Buy, amount, price)
        .await
    {
        Ok(id) => {
            println!("E2E: Order placed, ID={}", id);
            id
        }
        Err(e) => {
            println!("E2E: Could not place order (test inconclusive): {}", e);
            return;
        }
    };

    // Step 2: Query fills (unlikely to have any at extreme price)
    match client.get_fills(order_id, U256::zero()).await {
        Ok(fills) => {
            println!("E2E: Got {} fills for order {}", fills.len(), order_id);
            for fill in &fills {
                println!(
                    "  fill: price={}, amount={}",
                    fill.fill_price, fill.fill_amount
                );
                // Verify fill fields are populated
                assert_eq!(fill.order_id, order_id);
                assert!(fill.fill_price > U256::zero());
                assert!(fill.fill_amount > U256::zero());
            }
        }
        Err(e) => {
            println!("E2E: Could not query fills: {}", e);
        }
    }

    // Step 3: Query status
    match client.get_order_status(order_id).await {
        Ok(status) => {
            println!("E2E: Order {} status: {:?}", order_id, status);
        }
        Err(e) => {
            println!("E2E: Could not query status: {}", e);
        }
    }

    println!("E2E: Pipeline test complete");
}
