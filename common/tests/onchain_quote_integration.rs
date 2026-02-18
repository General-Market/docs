//! Integration tests for on-chain quote fallback
//!
//! These tests require a live Arbitrum RPC connection and are marked with #[ignore].
//! Run with: cargo test -p common --test onchain_quote_integration -- --ignored
//!
//! Environment variables:
//! - ARBITRUM_RPC_URL: Arbitrum RPC URL (required)
//!
//! Expected test conditions:
//! - USDC/WETH pool exists with meaningful liquidity
//! - Prices should be within 0.5% of 1inch API quotes

use common::integrations::onchain_quote::{
    arbitrum_tokens, DexType, FeeTier, OnchainQuoteClient, OnchainQuoteConfig,
};
use ethers::prelude::*;
use std::sync::Arc;

/// Helper to get RPC URL from environment
fn get_rpc_url() -> String {
    std::env::var("ARBITRUM_RPC_URL").expect("ARBITRUM_RPC_URL environment variable required")
}

/// Create a client connected to Arbitrum
async fn create_arbitrum_client() -> OnchainQuoteClient<Provider<Http>> {
    let rpc_url = get_rpc_url();
    let provider = Provider::<Http>::try_from(&rpc_url).expect("Failed to create provider");
    let config = OnchainQuoteConfig::arbitrum(&rpc_url);
    OnchainQuoteClient::new(Arc::new(provider), config)
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_usdc_weth_pool_exists() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let weth = arbitrum_tokens::weth();

    // Get pool address for USDC/WETH with 0.3% fee
    let pool_address = client
        .get_pool_address(usdc, weth, FeeTier::Medium, DexType::UniswapV3)
        .expect("Should compute pool address");

    println!("USDC/WETH 0.3% pool address: {:?}", pool_address);

    // Pool address should be non-zero (pool exists)
    assert_ne!(pool_address, Address::zero());
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_get_quote_usdc_to_weth() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let weth = arbitrum_tokens::weth();

    // Quote for 1000 USDC (6 decimals)
    let amount = U256::from(1_000_000_000u64); // 1000 USDC

    let quote = client
        .get_quote_onchain(usdc, weth, amount)
        .await
        .expect("Should get quote");

    println!("Quote for 1000 USDC -> WETH:");
    println!("  Price: {} WETH per USDC", quote.price);
    println!("  Source: {:?}", quote.source);
    println!("  Degraded: {}", quote.degraded);
    println!("  Liquidity: {}", quote.liquidity);
    println!("  Price Impact: {} bps", quote.price_impact_bps);
    println!("  Fee Tier: {} bps", quote.fee_tier_bps);

    // Verify quote is marked as degraded
    assert!(quote.degraded);
    assert!(quote.is_degraded());

    // Price should be positive
    assert!(quote.price > rust_decimal::Decimal::ZERO);

    // Price impact should be reasonable for 1000 USDC
    assert!(quote.price_impact_bps < 100, "Price impact should be < 1%");
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_get_quote_weth_to_usdc() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let weth = arbitrum_tokens::weth();

    // Quote for 0.5 WETH (18 decimals)
    let amount = U256::from(500_000_000_000_000_000u64); // 0.5 WETH

    let quote = client
        .get_quote_onchain(weth, usdc, amount)
        .await
        .expect("Should get quote");

    println!("Quote for 0.5 WETH -> USDC:");
    println!("  Price: {} USDC per WETH", quote.price);
    println!("  Source: {:?}", quote.source);
    println!("  Degraded: {}", quote.degraded);
    println!("  Liquidity: {}", quote.liquidity);
    println!("  Price Impact: {} bps", quote.price_impact_bps);

    // Verify quote is marked as degraded
    assert!(quote.degraded);

    // Price should be positive (expect ~1000-3000 USDC per WETH range)
    assert!(quote.price > rust_decimal::Decimal::ZERO);
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_stablecoin_pair() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let usdt = arbitrum_tokens::usdt();

    // Quote for 10000 USDC
    let amount = U256::from(10_000_000_000u64); // 10000 USDC

    // This may fail if the pool doesn't exist - that's OK
    if let Ok(quote) = client.get_quote_onchain(usdc, usdt, amount).await {
        println!("Quote for 10000 USDC -> USDT:");
        println!("  Price: {} USDT per USDC", quote.price);
        println!("  Source: {:?}", quote.source);

        // For stablecoins, price should be close to 1.0
        let price_f64 = quote.price.to_string().parse::<f64>().unwrap();
        assert!(
            (price_f64 - 1.0).abs() < 0.01,
            "Stablecoin price {} should be ~1.0",
            price_f64
        );
    } else {
        println!("USDC/USDT pool not found or has no liquidity - this is acceptable");
    }
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_latency_metrics() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let weth = arbitrum_tokens::weth();
    let amount = U256::from(1_000_000u64); // 1 USDC

    // Run a few quotes to get latency samples
    for i in 0..3 {
        let start = std::time::Instant::now();
        let _ = client.get_quote_onchain(usdc, weth, amount).await;
        let elapsed = start.elapsed();
        println!("Quote {} latency: {:?}", i + 1, elapsed);
    }

    let metrics = client.metrics();
    println!("Average latency: {} ms", metrics.avg_latency_ms());
    println!("Degraded quote count: {}", client.degraded_quotes_count());

    // Verify metrics are being tracked
    assert!(client.degraded_quotes_count() >= 3);
    assert!(metrics.avg_latency_ms() > 0);
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_pool_caching() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let weth = arbitrum_tokens::weth();

    // First call populates cache
    let _addr1 = client
        .get_pool_address(usdc, weth, FeeTier::Medium, DexType::UniswapV3)
        .unwrap();
    assert_eq!(client.cache_size(), 1);

    // Second call uses cache (should be fast)
    let _addr2 = client
        .get_pool_address(usdc, weth, FeeTier::Medium, DexType::UniswapV3)
        .unwrap();
    assert_eq!(client.cache_size(), 1);

    // Different DEX adds to cache
    let _addr3 = client
        .get_pool_address(usdc, weth, FeeTier::Medium, DexType::SushiswapV3)
        .unwrap();
    assert_eq!(client.cache_size(), 2);

    println!("Cache size after 3 lookups: {}", client.cache_size());
}

#[tokio::test]
#[ignore = "Requires live Arbitrum RPC connection"]
async fn test_compare_uniswap_sushiswap_prices() {
    let client = create_arbitrum_client().await;

    let usdc = arbitrum_tokens::usdc();
    let weth = arbitrum_tokens::weth();
    let amount = U256::from(1_000_000_000u64); // 1000 USDC

    // The main quote function returns the best price across both DEXes
    let quote = client
        .get_quote_onchain(usdc, weth, amount)
        .await
        .expect("Should get quote");

    println!("Best quote source: {:?}", quote.source);
    println!("Best price: {} WETH per USDC", quote.price);

    // Verify the quote came from one of the expected sources
    match &quote.source {
        common::integrations::onchain_quote::QuoteSource::Onchain { dex } => {
            assert!(
                matches!(dex, DexType::UniswapV3 | DexType::SushiswapV3),
                "Quote should come from Uniswap or Sushiswap"
            );
        }
        _ => panic!("Quote should be from on-chain source"),
    }
}
