//! Integration tests for BitgetPriceFetcher with wiremock HTTP mocking
//!
//! Tests the full HTTP path including BitgetReadOnlyClientImpl using wiremock
//! to simulate various Bitget API responses and error conditions.

use std::sync::Arc;

use common::integrations::bitget::BitgetReadOnlyClientImpl;
use common::integrations::bitget::BitgetReadOnlyConfig;
use ethers::types::Address;
use issuer::price::{BitgetPriceFetcher, PriceFetcher, SymbolMap};
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Create a test address from a u8
fn test_address(n: u8) -> Address {
    let mut bytes = [0u8; 20];
    bytes[19] = n;
    Address::from(bytes)
}

/// Create a BitgetReadOnlyConfig pointing to the mock server
fn create_test_config(mock_server: &MockServer) -> BitgetReadOnlyConfig {
    BitgetReadOnlyConfig::with_base_url(
        "test_api_key".to_string(),
        "test_api_secret".to_string(),
        "test_passphrase".to_string(),
        mock_server.uri(),
    )
}

/// Create a BitgetReadOnlyConfig with short timeout for timeout tests
/// Uses 1s timeout instead of default 10s to speed up test execution
fn create_test_config_short_timeout(mock_server: &MockServer) -> BitgetReadOnlyConfig {
    let mut config = BitgetReadOnlyConfig::with_base_url(
        "test_api_key".to_string(),
        "test_api_secret".to_string(),
        "test_passphrase".to_string(),
        mock_server.uri(),
    );
    config.timeout = std::time::Duration::from_secs(1);
    config
}

/// Successful ticker response JSON matching Bitget API format
fn successful_ticker_response(symbol: &str, best_ask: &str) -> serde_json::Value {
    serde_json::json!({
        "code": "00000",
        "msg": "success",
        "requestTime": 1700000000000i64,
        "data": [{
            "symbol": symbol,
            "bidPr": best_ask,  // Use same value for simplicity
            "askPr": best_ask,
            "lastPr": best_ask,
            "ts": "1700000000000"
        }]
    })
}

/// Empty ticker response (symbol not found)
fn empty_ticker_response() -> serde_json::Value {
    serde_json::json!({
        "code": "00000",
        "msg": "success",
        "requestTime": 1700000000000i64,
        "data": []
    })
}

/// Error response JSON
fn error_response(code: &str, msg: &str) -> serde_json::Value {
    serde_json::json!({
        "code": code,
        "msg": msg,
        "requestTime": 1700000000000i64,
        "data": null
    })
}

#[tokio::test]
async fn test_successful_ticker_response() {
    // Start mock server
    let mock_server = MockServer::start().await;

    // Setup mock response for BTCUSDT ticker
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "BTCUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(successful_ticker_response(
            "BTCUSDT",
            "50000.50",
        )))
        .mount(&mock_server)
        .await;

    // Create client and fetcher
    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    // Fetch price
    let price = fetcher.fetch_price(btc).await.unwrap();

    // Verify result
    assert_eq!(price.asset, btc);
    // 50000.50 * 10^18
    let expected_price = ethers::types::U256::from(50000u64)
        * ethers::types::U256::from(10u64).pow(ethers::types::U256::from(18))
        + ethers::types::U256::from(500000000000000000u64);
    assert_eq!(price.price, expected_price);
    // Timestamp: 1700000000000ms / 1000 = 1700000000s
    assert_eq!(price.timestamp, ethers::types::U256::from(1700000000u64));
}

#[tokio::test]
async fn test_rate_limit_429_response() {
    let mock_server = MockServer::start().await;

    // Return 429 rate limit error (3 times to exhaust retries)
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(429).set_body_string("Rate limit exceeded"))
        .expect(3) // Expect 3 attempts (MAX_RETRIES = 3)
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(btc).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(
        matches!(error, issuer::price::PriceFetchError::FetchFailed { .. }),
        "Expected FetchFailed error for rate limit, got: {:?}",
        error
    );
}

#[tokio::test]
async fn test_authentication_error_401() {
    let mock_server = MockServer::start().await;

    // Return 401 unauthorized
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(401).set_body_string("Unauthorized"))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(btc).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    // Authentication errors are mapped to FetchFailed
    assert!(
        matches!(error, issuer::price::PriceFetchError::FetchFailed { .. }),
        "Expected FetchFailed error for auth failure, got: {:?}",
        error
    );
}

#[tokio::test]
async fn test_network_timeout() {
    let mock_server = MockServer::start().await;

    // Return response with delay longer than timeout to trigger timeout error
    // Uses short timeout config (1s) with 2s delay for faster test execution
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(successful_ticker_response("BTCUSDT", "50000.0"))
                .set_delay(std::time::Duration::from_secs(2)),
        )
        .mount(&mock_server)
        .await;

    let config = create_test_config_short_timeout(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(btc).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(
        matches!(error, issuer::price::PriceFetchError::FetchFailed { .. }),
        "Expected FetchFailed error for timeout, got: {:?}",
        error
    );
}

#[tokio::test]
async fn test_invalid_json_response() {
    let mock_server = MockServer::start().await;

    // Return malformed JSON
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(200).set_body_string("not valid json {{{"))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(btc).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(
        matches!(error, issuer::price::PriceFetchError::FetchFailed { .. }),
        "Expected FetchFailed error for invalid JSON, got: {:?}",
        error
    );
}

#[tokio::test]
async fn test_multiple_concurrent_requests() {
    let mock_server = MockServer::start().await;

    // Setup mock responses for multiple symbols
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "BTCUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(successful_ticker_response(
            "BTCUSDT",
            "50000.0",
        )))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "ETHUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(successful_ticker_response(
            "ETHUSDT",
            "3000.0",
        )))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "ARBUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(successful_ticker_response(
            "ARBUSDT",
            "1.50",
        )))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let eth = test_address(2);
    let arb = test_address(3);
    let symbol_map = SymbolMap::new()
        .add(btc, "BTCUSDT")
        .add(eth, "ETHUSDT")
        .add(arb, "ARBUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    // Fetch multiple prices (sequential in fetch_prices implementation)
    let prices = fetcher.fetch_prices(&[btc, eth, arb]).await.unwrap();

    assert_eq!(prices.len(), 3);
    assert_eq!(prices[0].asset, btc);
    assert_eq!(prices[1].asset, eth);
    assert_eq!(prices[2].asset, arb);

    // Verify prices are correctly parsed
    // BTC: 50000 * 10^18
    let expected_btc =
        ethers::types::U256::from(50000u64) * ethers::types::U256::from(10u64).pow(18.into());
    assert_eq!(prices[0].price, expected_btc);

    // ETH: 3000 * 10^18
    let expected_eth =
        ethers::types::U256::from(3000u64) * ethers::types::U256::from(10u64).pow(18.into());
    assert_eq!(prices[1].price, expected_eth);

    // ARB: 1.50 * 10^18 = 1.5e18
    let expected_arb =
        ethers::types::U256::from(10u64).pow(18.into()) + ethers::types::U256::from(500000000000000000u64);
    assert_eq!(prices[2].price, expected_arb);
}

#[tokio::test]
async fn test_ticker_not_found_empty_response() {
    let mock_server = MockServer::start().await;

    // Return empty data array (symbol not found but API call succeeded)
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(empty_ticker_response()))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let unknown = test_address(99);
    let symbol_map = SymbolMap::new().add(unknown, "UNKNOWNUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(unknown).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    // Empty data results in NotFound which maps to PriceNotAvailable
    assert!(
        matches!(
            error,
            issuer::price::PriceFetchError::PriceNotAvailable { .. }
        ),
        "Expected PriceNotAvailable error for empty ticker data, got: {:?}",
        error
    );
}

#[tokio::test]
async fn test_bitget_api_error_response() {
    let mock_server = MockServer::start().await;

    // Return Bitget API error (code != "00000")
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(error_response(
            "40004",
            "Symbol not supported",
        )))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(btc).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    // 40004 error code maps to NotFound which becomes PriceNotAvailable
    assert!(
        matches!(
            error,
            issuer::price::PriceFetchError::PriceNotAvailable { .. }
        ),
        "Expected PriceNotAvailable for Bitget API not found error, got: {:?}",
        error
    );
}

#[tokio::test]
async fn test_rate_limit_recovery_on_retry() {
    use std::sync::atomic::{AtomicU32, Ordering};

    let mock_server = MockServer::start().await;
    let call_count = Arc::new(AtomicU32::new(0));
    let call_count_clone = call_count.clone();

    // Use a responder that returns 429 on first call, success on second
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "BTCUSDT"))
        .respond_with(move |_: &wiremock::Request| {
            let count = call_count_clone.fetch_add(1, Ordering::SeqCst);
            if count == 0 {
                // First call: rate limit
                ResponseTemplate::new(429).set_body_string("Rate limit")
            } else {
                // Subsequent calls: success
                ResponseTemplate::new(200).set_body_json(successful_ticker_response(
                    "BTCUSDT",
                    "50000.0",
                ))
            }
        })
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    // Should succeed after retry
    let result = fetcher.fetch_price(btc).await;
    assert!(
        result.is_ok(),
        "Expected success after rate limit retry, got: {:?}",
        result
    );

    // Verify we actually retried (at least 2 calls)
    assert!(
        call_count.load(Ordering::SeqCst) >= 2,
        "Expected at least 2 API calls (initial + retry), got: {}",
        call_count.load(Ordering::SeqCst)
    );
}

#[tokio::test]
async fn test_server_error_500() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let btc = test_address(1);
    let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    let result = fetcher.fetch_price(btc).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(
        matches!(error, issuer::price::PriceFetchError::FetchFailed { .. }),
        "Expected FetchFailed error for server error, got: {:?}",
        error
    );
}

// =============================================================================
// E2E Tests - Full price flow from mock Bitget server to consensus-ready Price
// =============================================================================

/// E2E test: Simulates complete flow with realistic Bitget API responses
/// including multiple assets with various price formats, demonstrating the
/// full integration path that would be used in production consensus rounds.
#[tokio::test]
async fn test_e2e_full_price_flow_for_consensus() {
    use common::types::PriceSource;

    let mock_server = MockServer::start().await;

    // Realistic Arbitrum token addresses (from SymbolMap::default_arbitrum)
    let wbtc: Address = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
        .parse()
        .unwrap();
    let weth: Address = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
        .parse()
        .unwrap();
    let usdc: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
        .parse()
        .unwrap();
    let arb: Address = "0x912CE59144191C1204E64559FE8253a0e49E6548"
        .parse()
        .unwrap();

    // Mock realistic Bitget API responses with various price formats
    // BTC: ~97000 USD with decimals
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "BTCUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "code": "00000",
            "msg": "success",
            "requestTime": 1706745600000i64,
            "data": [{
                "symbol": "BTCUSDT",
                "bidPr": "97456.78",
                "askPr": "97456.78",
                "lastPr": "97450.00",
                "ts": "1706745600000"
            }]
        })))
        .mount(&mock_server)
        .await;

    // ETH: ~3400 USD
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "ETHUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "code": "00000",
            "msg": "success",
            "requestTime": 1706745600000i64,
            "data": [{
                "symbol": "ETHUSDT",
                "bidPr": "3421.50",
                "askPr": "3421.50",
                "lastPr": "3420.00",
                "ts": "1706745600000"
            }]
        })))
        .mount(&mock_server)
        .await;

    // USDC: ~1 USD (stablecoin with many decimals)
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "USDCUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "code": "00000",
            "msg": "success",
            "requestTime": 1706745600000i64,
            "data": [{
                "symbol": "USDCUSDT",
                "bidPr": "0.99985",
                "askPr": "0.99985",
                "lastPr": "0.99980",
                "ts": "1706745600000"
            }]
        })))
        .mount(&mock_server)
        .await;

    // ARB: ~1.25 USD
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "ARBUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "code": "00000",
            "msg": "success",
            "requestTime": 1706745600000i64,
            "data": [{
                "symbol": "ARBUSDT",
                "bidPr": "1.2567",
                "askPr": "1.2567",
                "lastPr": "1.2565",
                "ts": "1706745600000"
            }]
        })))
        .mount(&mock_server)
        .await;

    // Create fetcher with default Arbitrum symbol map (production-like setup)
    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let symbol_map = SymbolMap::default_arbitrum();
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    // Fetch all prices (simulating consensus round price collection)
    let assets = [wbtc, weth, usdc, arb];
    let prices = fetcher.fetch_prices(&assets).await.unwrap();

    // Verify all prices were fetched
    assert_eq!(prices.len(), 4, "Should fetch prices for all 4 assets");

    // Verify BTC price
    let btc_price = &prices[0];
    assert_eq!(btc_price.asset, wbtc);
    // 97456.78 * 10^18
    let expected_btc = ethers::types::U256::from(97456u64)
        * ethers::types::U256::from(10u64).pow(18.into())
        + ethers::types::U256::from(780000000000000000u64);
    assert_eq!(btc_price.price, expected_btc);
    assert_eq!(
        btc_price.source,
        ethers::types::U256::from(PriceSource::Bitget as u8)
    );
    assert_eq!(btc_price.timestamp, ethers::types::U256::from(1706745600u64));

    // Verify ETH price
    let eth_price = &prices[1];
    assert_eq!(eth_price.asset, weth);
    // 3421.50 * 10^18
    let expected_eth = ethers::types::U256::from(3421u64)
        * ethers::types::U256::from(10u64).pow(18.into())
        + ethers::types::U256::from(500000000000000000u64);
    assert_eq!(eth_price.price, expected_eth);

    // Verify USDC price (stablecoin with small decimal value)
    let usdc_price = &prices[2];
    assert_eq!(usdc_price.asset, usdc);
    // 0.99985 * 10^18 = 999850000000000000
    let expected_usdc = ethers::types::U256::from(999850000000000000u64);
    assert_eq!(usdc_price.price, expected_usdc);

    // Verify ARB price
    let arb_price = &prices[3];
    assert_eq!(arb_price.asset, arb);
    // 1.2567 * 10^18
    let expected_arb = ethers::types::U256::from(10u64).pow(18.into())
        + ethers::types::U256::from(256700000000000000u64);
    assert_eq!(arb_price.price, expected_arb);

    // Verify all timestamps are consistent (same mock response time)
    for price in &prices {
        assert_eq!(
            price.timestamp,
            ethers::types::U256::from(1706745600u64),
            "All prices should have consistent timestamps"
        );
    }

    // Verify all sources are Bitget
    for price in &prices {
        assert_eq!(
            price.source,
            ethers::types::U256::from(PriceSource::Bitget as u8),
            "All prices should be from Bitget source"
        );
    }
}

/// E2E test: Verifies graceful degradation when some assets fail to fetch
/// This simulates a real scenario where one asset might have temporary issues
/// while others succeed.
#[tokio::test]
async fn test_e2e_partial_failure_handling() {
    let mock_server = MockServer::start().await;

    let btc = test_address(1);
    let eth = test_address(2);

    // BTC succeeds
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "BTCUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_json(successful_ticker_response(
            "BTCUSDT",
            "50000.0",
        )))
        .mount(&mock_server)
        .await;

    // ETH returns 500 error (simulating temporary API issue)
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "ETHUSDT"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let config = create_test_config(&mock_server);
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();
    let symbol_map = SymbolMap::new()
        .add(btc, "BTCUSDT")
        .add(eth, "ETHUSDT");
    let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map);

    // BTC alone should succeed
    let btc_result = fetcher.fetch_price(btc).await;
    assert!(btc_result.is_ok(), "BTC price fetch should succeed");

    // ETH alone should fail
    let eth_result = fetcher.fetch_price(eth).await;
    assert!(eth_result.is_err(), "ETH price fetch should fail");

    // Batch fetch fails fast on first error (documented implementation behavior)
    // fetch_prices uses `?` operator, so it returns Err as soon as ANY asset fails,
    // discarding any previously fetched prices. This is fail-fast behavior.

    // Test with [btc, eth] - btc succeeds, but eth fails, so entire batch fails
    let batch_result = fetcher.fetch_prices(&[btc, eth]).await;
    assert!(
        batch_result.is_err(),
        "Batch fetch should fail when any asset fails (fail-fast behavior): {:?}",
        batch_result
    );

    // Test with [eth, btc] - eth fails first, batch fails immediately
    let batch_result_fail_first = fetcher.fetch_prices(&[eth, btc]).await;
    assert!(
        batch_result_fail_first.is_err(),
        "Batch fetch with failing asset first should also fail"
    );

    // Verify both error messages reference the failing eth asset
    if let Err(issuer::price::PriceFetchError::FetchFailed { asset, .. }) = batch_result {
        assert_eq!(asset, eth, "Error should reference the failing eth asset");
    }
}
