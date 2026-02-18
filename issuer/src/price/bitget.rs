//! BitgetPriceFetcher implementation
//!
//! Fetches real-time prices from Bitget API using BitgetReadOnlyClient.

use async_trait::async_trait;
use common::error::Error;
use common::traits::{BitgetReadOnlyClient, BitgetTicker};
use common::types::{Price, PriceSource};
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tracing::{info, warn};

use super::fetcher::{PriceFetchError, PriceFetcher};
use super::symbol_map::SymbolMap;

/// Cache TTL for bulk-fetched tickers (30 seconds)
const TICKER_CACHE_TTL: Duration = Duration::from_secs(30);

/// Fetches prices from Bitget API
///
/// Uses `BitgetReadOnlyClient` to fetch ticker data and converts it to the
/// standard `Price` format with 18 decimal precision.
///
/// When fetching many prices, uses `get_all_tickers()` bulk API (single HTTP
/// call for all ~800 pairs) and caches results for 30 seconds. Subsequent
/// calls within the TTL use cached tickers.
#[derive(Clone)]
pub struct BitgetPriceFetcher<C: BitgetReadOnlyClient> {
    client: Arc<C>,
    symbol_map: SymbolMap,
    /// Cached tickers from bulk fetch: symbol → (ticker, fetch_time)
    ticker_cache: Arc<RwLock<(HashMap<String, BitgetTicker>, Instant)>>,
}

impl<C: BitgetReadOnlyClient> BitgetPriceFetcher<C> {
    /// Create a new BitgetPriceFetcher
    ///
    /// # Arguments
    /// * `client` - The BitgetReadOnlyClient implementation
    /// * `symbol_map` - Mapping from asset addresses to Bitget symbols
    pub fn new(client: Arc<C>, symbol_map: SymbolMap) -> Self {
        Self {
            client,
            symbol_map,
            ticker_cache: Arc::new(RwLock::new((HashMap::new(), Instant::now() - TICKER_CACHE_TTL))),
        }
    }

    /// Get the symbol map (for inspection/testing)
    pub fn symbol_map(&self) -> &SymbolMap {
        &self.symbol_map
    }

    /// Refresh the ticker cache via bulk API if stale
    async fn ensure_cache_fresh(&self) {
        let needs_refresh = {
            let cache = self.ticker_cache.read().await;
            cache.0.is_empty() || cache.1.elapsed() > TICKER_CACHE_TTL
        };
        if !needs_refresh {
            return;
        }

        match self.client.get_all_tickers().await {
            Ok(tickers) => {
                let mut map = HashMap::with_capacity(tickers.len());
                for t in tickers {
                    map.insert(t.symbol.clone(), t);
                }
                let count = map.len();
                let mut cache = self.ticker_cache.write().await;
                *cache = (map, Instant::now());
                info!(count, "Bulk ticker cache refreshed");
            }
            Err(e) => {
                warn!(error = %e, "Bulk ticker fetch failed, will use per-symbol fallback");
            }
        }
    }

    /// Get ticker from cache, falling back to individual API call
    async fn get_ticker_cached(&self, symbol: &str) -> Result<BitgetTicker, Error> {
        // Try cache first
        {
            let cache = self.ticker_cache.read().await;
            if cache.1.elapsed() <= TICKER_CACHE_TTL {
                if let Some(ticker) = cache.0.get(symbol) {
                    return Ok(ticker.clone());
                }
            }
        }
        // Cache miss — fetch individually
        self.client.get_ticker(symbol).await
    }
}

/// 10^18 as U256 constant
const DECIMALS_18: u128 = 1_000_000_000_000_000_000;

/// Parse a price string to U256 with 18 decimals
///
/// Handles various formats:
/// - Whole numbers: "50123" → 50123_000000000000000000
/// - Decimals: "50123.45" → 50123_450000000000000000
/// - Small decimals: "0.00001234" → 12340000000000
/// - Many decimals (truncated): "1.1234567890123456789999" → 1_123456789012345678
///
/// # Arguments
/// * `s` - Price string from Bitget API
/// * `asset` - Asset address for error context
fn parse_price(s: &str, asset: Address) -> Result<U256, PriceFetchError> {
    if s.is_empty() {
        return Err(PriceFetchError::FetchFailed {
            asset,
            reason: "Empty price string".to_string(),
        });
    }

    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() > 2 {
        return Err(PriceFetchError::FetchFailed {
            asset,
            reason: format!("Invalid price format: {}", s),
        });
    }

    // Parse whole part
    let whole: u128 = parts[0].parse().map_err(|_| PriceFetchError::FetchFailed {
        asset,
        reason: format!("Invalid whole number in price: {}", s),
    })?;

    // Parse fractional part (if exists)
    let frac: u128 = if parts.len() > 1 && !parts[1].is_empty() {
        let frac_str = parts[1];
        let frac_len = frac_str.len();

        // Handle the fractional part based on its length
        if frac_len >= 18 {
            // Truncate to 18 decimals
            frac_str[..18].parse().map_err(|_| PriceFetchError::FetchFailed {
                asset,
                reason: format!("Invalid fractional part in price: {}", s),
            })?
        } else {
            // Right-pad with zeros to 18 decimals
            let padded = format!("{:0<18}", frac_str);
            padded.parse().map_err(|_| PriceFetchError::FetchFailed {
                asset,
                reason: format!("Invalid fractional part in price: {}", s),
            })?
        }
    } else {
        0
    };

    // whole * 10^18 + frac
    // Use checked arithmetic and convert to U256
    let whole_scaled = U256::from(whole).saturating_mul(U256::from(DECIMALS_18));
    let result = whole_scaled.saturating_add(U256::from(frac));

    Ok(result)
}

/// Get current timestamp as U256 (Unix seconds)
fn current_timestamp() -> U256 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs()
        .into()
}

#[async_trait]
impl<C: BitgetReadOnlyClient + 'static> PriceFetcher for BitgetPriceFetcher<C> {
    async fn fetch_price(&self, asset: Address) -> Result<Price, PriceFetchError> {
        // Lookup symbol
        let symbol = self.symbol_map.get_symbol(&asset).ok_or_else(|| {
            PriceFetchError::PriceNotAvailable { asset }
        })?;

        // Fetch ticker (from cache if available, else direct API call)
        let ticker = self.get_ticker_cached(symbol).await.map_err(|e| {
            match e {
                Error::NotFound(msg) => {
                    warn!(code = "INFRA-013", asset = ?asset, symbol = %symbol, error = %msg, "Ticker not found on Bitget");
                    PriceFetchError::PriceNotAvailable { asset }
                }
                Error::RateLimit(msg) => {
                    warn!(code = "INFRA-012", asset = ?asset, error = %msg, "Bitget rate limit hit");
                    PriceFetchError::FetchFailed {
                        asset,
                        reason: format!("Rate limit exceeded: {}", msg),
                    }
                }
                Error::Authentication(msg) => {
                    warn!(code = "INFRA-011", error = %msg, "Bitget authentication failed");
                    PriceFetchError::FetchFailed {
                        asset,
                        reason: format!("Authentication error: {}", msg),
                    }
                }
                Error::Timeout(msg) => {
                    warn!(code = "INFRA-014", asset = ?asset, error = %msg, "Bitget API timeout");
                    PriceFetchError::FetchFailed {
                        asset,
                        reason: format!("Request timeout: {}", msg),
                    }
                }
                Error::Serialization(msg) => {
                    warn!(code = "INFRA-015", asset = ?asset, error = %msg, "Bitget response parse error");
                    PriceFetchError::FetchFailed {
                        asset,
                        reason: format!("Invalid response format: {}", msg),
                    }
                }
                Error::ExternalService(msg) => {
                    warn!(code = "INFRA-016", asset = ?asset, error = %msg, "Bitget external service error");
                    PriceFetchError::FetchFailed {
                        asset,
                        reason: format!("External service error: {}", msg),
                    }
                }
                _ => {
                    warn!(code = "INFRA-013", asset = ?asset, error = %e, "Bitget API error");
                    PriceFetchError::FetchFailed {
                        asset,
                        reason: e.to_string(),
                    }
                }
            }
        })?;

        // Parse price (use best_ask for buy orders)
        let price = parse_price(&ticker.best_ask, asset)?;

        // Use ticker timestamp if available, otherwise current time
        // Bitget returns timestamp in milliseconds, convert to seconds
        let timestamp = if ticker.timestamp > 0 {
            U256::from(ticker.timestamp / 1000)
        } else {
            current_timestamp()
        };

        Ok(Price {
            asset,
            price,
            timestamp,
            source: U256::from(PriceSource::Bitget as u8),
        })
    }

    async fn fetch_prices(&self, assets: &[Address]) -> Result<Vec<Price>, PriceFetchError> {
        if assets.is_empty() {
            return Ok(vec![]);
        }

        // Refresh bulk ticker cache (single HTTP call for all ~800 pairs).
        // If bulk fetch fails, falls back to per-symbol calls.
        self.ensure_cache_fresh().await;

        // Resolve each asset from cache, tolerant of individual failures.
        let mut prices = Vec::with_capacity(assets.len());
        let mut failures = 0u32;

        for &asset in assets {
            match self.fetch_price(asset).await {
                Ok(price) => prices.push(price),
                Err(e) => {
                    warn!(asset = ?asset, error = %e, "Skipping asset in batch fetch");
                    failures += 1;
                }
            }
        }

        if failures > 0 {
            warn!(
                total = assets.len(),
                fetched = prices.len(),
                failures,
                "Partial price fetch — some assets failed"
            );
        }

        Ok(prices)
    }
}

/// Test utilities for BitgetPriceFetcher
///
/// Story 7.12: Provides TestBitgetClient for integration tests to use instead of MockPriceFetcher.
#[cfg(test)]
pub mod test_utils {
    use async_trait::async_trait;
    use common::error::Error;
    use common::traits::{BitgetFill, BitgetOrderInfo, BitgetReadOnlyClient, BitgetTicker};
    use std::collections::HashMap;
    use std::sync::{Arc, RwLock};

    /// In-memory Bitget client for testing
    ///
    /// Use this with `BitgetPriceFetcher<TestBitgetClient>` in tests instead of MockPriceFetcher.
    #[derive(Clone)]
    pub struct TestBitgetClient {
        tickers: Arc<RwLock<HashMap<String, BitgetTicker>>>,
    }

    impl TestBitgetClient {
        /// Create a new empty TestBitgetClient
        pub fn new() -> Self {
            Self {
                tickers: Arc::new(RwLock::new(HashMap::new())),
            }
        }

        /// Add a ticker to the client
        pub fn with_ticker(self, symbol: &str, best_ask: &str) -> Self {
            self.tickers.write().unwrap().insert(
                symbol.to_string(),
                BitgetTicker {
                    symbol: symbol.to_string(),
                    best_bid: best_ask.to_string(),
                    best_ask: best_ask.to_string(),
                    last_price: best_ask.to_string(),
                    timestamp: 1700000000000,
                    bid_size: String::new(),
                    ask_size: String::new(),
                    usdt_volume: String::new(),
                },
            );
            self
        }

        /// Set a ticker at runtime
        pub fn set_ticker(&self, symbol: &str, best_ask: &str) {
            self.tickers.write().unwrap().insert(
                symbol.to_string(),
                BitgetTicker {
                    symbol: symbol.to_string(),
                    best_bid: best_ask.to_string(),
                    best_ask: best_ask.to_string(),
                    last_price: best_ask.to_string(),
                    timestamp: 1700000000000,
                    bid_size: String::new(),
                    ask_size: String::new(),
                    usdt_volume: String::new(),
                },
            );
        }
    }

    impl Default for TestBitgetClient {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait]
    impl BitgetReadOnlyClient for TestBitgetClient {
        async fn get_order(&self, _order_id: &str) -> Result<BitgetOrderInfo, Error> {
            unimplemented!("Not needed for price fetcher tests")
        }

        async fn get_fills(&self, _symbol: &str, _order_id: &str) -> Result<Vec<BitgetFill>, Error> {
            unimplemented!("Not needed for price fetcher tests")
        }

        async fn get_order_history(
            &self,
            _pair: &str,
            _since: u64,
            _limit: Option<u32>,
        ) -> Result<Vec<BitgetOrderInfo>, Error> {
            unimplemented!("Not needed for price fetcher tests")
        }

        async fn get_ticker(&self, pair: &str) -> Result<BitgetTicker, Error> {
            self.tickers
                .read()
                .unwrap()
                .get(pair)
                .cloned()
                .ok_or_else(|| Error::NotFound(format!("Ticker not found: {}", pair)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_address(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    #[test]
    fn test_parse_price_whole_number() {
        let asset = test_address(1);
        let result = parse_price("100", asset).unwrap();
        // 100 * 10^18 = 100_000000000000000000
        let expected = U256::from(100u64) * U256::from(10u64).pow(U256::from(18));
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_with_decimals() {
        let asset = test_address(1);
        let result = parse_price("50123.45", asset).unwrap();
        // 50123 * 10^18 + 450000000000000000 = 50123.45 * 10^18
        let expected = U256::from(50123u64) * U256::from(10u64).pow(U256::from(18))
            + U256::from(450000000000000000u64);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_small_decimal() {
        let asset = test_address(1);
        let result = parse_price("0.00001234", asset).unwrap();
        // 0.00001234 * 10^18 = 12340000000000
        let expected = U256::from(12340000000000u64);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_18_decimals() {
        let asset = test_address(1);
        let result = parse_price("1.123456789012345678", asset).unwrap();
        // 1 * 10^18 + 123456789012345678
        let expected = U256::from(10u64).pow(U256::from(18)) + U256::from(123456789012345678u64);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_truncate_excess_decimals() {
        let asset = test_address(1);
        // 19 decimal places - should truncate to 18
        let result = parse_price("1.1234567890123456789", asset).unwrap();
        // Truncates to 1.123456789012345678
        let expected = U256::from(10u64).pow(U256::from(18)) + U256::from(123456789012345678u64);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_many_decimals() {
        let asset = test_address(1);
        // Many decimals - truncate to 18
        let result = parse_price("1.1234567890123456789999", asset).unwrap();
        // Truncates to 1.123456789012345678
        let expected = U256::from(10u64).pow(U256::from(18)) + U256::from(123456789012345678u64);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_zero() {
        let asset = test_address(1);
        let result = parse_price("0", asset).unwrap();
        assert_eq!(result, U256::zero());
    }

    #[test]
    fn test_parse_price_zero_with_decimals() {
        let asset = test_address(1);
        let result = parse_price("0.0", asset).unwrap();
        assert_eq!(result, U256::zero());
    }

    #[test]
    fn test_parse_price_empty_fails() {
        let asset = test_address(1);
        let result = parse_price("", asset);
        assert!(result.is_err());
        // Verify error contains the asset address
        if let Err(PriceFetchError::FetchFailed { asset: err_asset, .. }) = result {
            assert_eq!(err_asset, asset);
        }
    }

    #[test]
    fn test_parse_price_invalid_fails() {
        let asset = test_address(1);
        let result = parse_price("abc", asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_price_multiple_dots_fails() {
        let asset = test_address(1);
        let result = parse_price("1.2.3", asset);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_price_negative_fails() {
        // Negative prices are invalid - crypto prices cannot be negative
        let asset = test_address(1);
        let result = parse_price("-100.50", asset);
        assert!(result.is_err(), "Negative prices should be rejected");
    }

    #[test]
    fn test_parse_price_leading_zeros() {
        // Leading zeros should be handled (parsed as decimal, not octal)
        let asset = test_address(1);
        let result = parse_price("00100.50", asset).unwrap();
        // 100.50 * 10^18
        let expected = U256::from(100u64) * U256::from(10u64).pow(U256::from(18))
            + U256::from(500000000000000000u64);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_trailing_dot() {
        // "100." should be treated as "100" (empty fractional part)
        let asset = test_address(1);
        let result = parse_price("100.", asset).unwrap();
        let expected = U256::from(100u64) * U256::from(10u64).pow(U256::from(18));
        assert_eq!(result, expected);
    }

    #[test]
    fn test_parse_price_only_fractional() {
        // ".5" should be treated as "0.5"
        let asset = test_address(1);
        let result = parse_price(".5", asset);
        // This will fail because the whole part is empty string which doesn't parse as u128
        // This is expected behavior - Bitget API always returns "0.5" not ".5"
        assert!(result.is_err(), "Price without whole part should fail");
    }

    // Mock client for testing
    use async_trait::async_trait;
    use common::traits::{BitgetFill, BitgetOrderInfo, BitgetTicker};
    use std::collections::HashMap;
    use std::sync::RwLock;

    struct MockBitgetClient {
        tickers: RwLock<HashMap<String, BitgetTicker>>,
        should_fail: RwLock<bool>,
    }

    impl MockBitgetClient {
        fn new() -> Self {
            Self {
                tickers: RwLock::new(HashMap::new()),
                should_fail: RwLock::new(false),
            }
        }

        fn with_ticker(self, symbol: &str, best_ask: &str) -> Self {
            self.tickers.write().unwrap().insert(
                symbol.to_string(),
                BitgetTicker {
                    symbol: symbol.to_string(),
                    best_bid: best_ask.to_string(),
                    best_ask: best_ask.to_string(),
                    last_price: best_ask.to_string(),
                    timestamp: 1700000000000,
                    bid_size: String::new(),
                    ask_size: String::new(),
                    usdt_volume: String::new(),
                },
            );
            self
        }

        fn set_should_fail(&self, fail: bool) {
            *self.should_fail.write().unwrap() = fail;
        }
    }

    #[async_trait]
    impl BitgetReadOnlyClient for MockBitgetClient {
        async fn get_order(&self, _order_id: &str) -> Result<BitgetOrderInfo, Error> {
            unimplemented!("Not needed for price fetcher tests")
        }

        async fn get_fills(&self, _symbol: &str, _order_id: &str) -> Result<Vec<BitgetFill>, Error> {
            unimplemented!("Not needed for price fetcher tests")
        }

        async fn get_order_history(
            &self,
            _pair: &str,
            _since: u64,
            _limit: Option<u32>,
        ) -> Result<Vec<BitgetOrderInfo>, Error> {
            unimplemented!("Not needed for price fetcher tests")
        }

        async fn get_ticker(&self, pair: &str) -> Result<BitgetTicker, Error> {
            if *self.should_fail.read().unwrap() {
                return Err(Error::ExternalService("Simulated failure".to_string()));
            }

            self.tickers
                .read()
                .unwrap()
                .get(pair)
                .cloned()
                .ok_or_else(|| Error::NotFound(format!("Ticker not found: {}", pair)))
        }
    }

    #[tokio::test]
    async fn test_bitget_price_fetcher_fetch_price() {
        let btc = test_address(1);

        let client = Arc::new(MockBitgetClient::new().with_ticker("BTCUSDT", "50000.50"));

        let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");

        let fetcher = BitgetPriceFetcher::new(client, symbol_map);

        let price = fetcher.fetch_price(btc).await.unwrap();

        assert_eq!(price.asset, btc);
        // 50000.50 * 10^18
        let expected_price = U256::from(50000u64) * U256::from(10u64).pow(U256::from(18))
            + U256::from(500000000000000000u64);
        assert_eq!(price.price, expected_price);
        assert_eq!(price.source, U256::from(0u8)); // Bitget = 0
        assert_eq!(price.timestamp, U256::from(1700000000u64)); // Converted from ms
    }

    #[tokio::test]
    async fn test_bitget_price_fetcher_unknown_asset() {
        let known = test_address(1);
        let unknown = test_address(99);

        let client = Arc::new(MockBitgetClient::new().with_ticker("BTCUSDT", "50000.0"));

        let symbol_map = SymbolMap::new().add(known, "BTCUSDT");

        let fetcher = BitgetPriceFetcher::new(client, symbol_map);

        let result = fetcher.fetch_price(unknown).await;

        assert!(matches!(
            result,
            Err(PriceFetchError::PriceNotAvailable { .. })
        ));
    }

    #[tokio::test]
    async fn test_bitget_price_fetcher_api_error() {
        let btc = test_address(1);

        let client = Arc::new(MockBitgetClient::new().with_ticker("BTCUSDT", "50000.0"));
        client.set_should_fail(true);

        let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");

        let fetcher = BitgetPriceFetcher::new(client, symbol_map);

        let result = fetcher.fetch_price(btc).await;

        assert!(matches!(result, Err(PriceFetchError::FetchFailed { .. })));
    }

    #[tokio::test]
    async fn test_bitget_price_fetcher_fetch_prices_multiple() {
        let btc = test_address(1);
        let eth = test_address(2);

        let client = Arc::new(
            MockBitgetClient::new()
                .with_ticker("BTCUSDT", "50000.0")
                .with_ticker("ETHUSDT", "3000.0"),
        );

        let symbol_map = SymbolMap::new()
            .add(btc, "BTCUSDT")
            .add(eth, "ETHUSDT");

        let fetcher = BitgetPriceFetcher::new(client, symbol_map);

        let prices = fetcher.fetch_prices(&[btc, eth]).await.unwrap();

        assert_eq!(prices.len(), 2);
        assert_eq!(prices[0].asset, btc);
        // 50000 * 10^18
        let expected_btc = U256::from(50000u64) * U256::from(10u64).pow(U256::from(18));
        assert_eq!(prices[0].price, expected_btc);
        assert_eq!(prices[1].asset, eth);
        // 3000 * 10^18
        let expected_eth = U256::from(3000u64) * U256::from(10u64).pow(U256::from(18));
        assert_eq!(prices[1].price, expected_eth);
    }

    #[tokio::test]
    async fn test_bitget_price_fetcher_fetch_prices_empty() {
        let client = Arc::new(MockBitgetClient::new());
        let symbol_map = SymbolMap::new();
        let fetcher = BitgetPriceFetcher::new(client, symbol_map);

        let prices = fetcher.fetch_prices(&[]).await.unwrap();

        assert!(prices.is_empty());
    }

    #[tokio::test]
    async fn test_bitget_price_fetcher_timestamp_zero_fallback() {
        let btc = test_address(1);

        // Create client with timestamp=0 to trigger fallback
        let client = Arc::new(MockBitgetClient::new());
        client.tickers.write().unwrap().insert(
            "BTCUSDT".to_string(),
            BitgetTicker {
                symbol: "BTCUSDT".to_string(),
                best_bid: "50000.0".to_string(),
                best_ask: "50000.0".to_string(),
                last_price: "50000.0".to_string(),
                timestamp: 0, // Zero timestamp to trigger fallback
                bid_size: String::new(),
                ask_size: String::new(),
                usdt_volume: String::new(),
            },
        );

        let symbol_map = SymbolMap::new().add(btc, "BTCUSDT");
        let fetcher = BitgetPriceFetcher::new(client, symbol_map);

        let before = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let price = fetcher.fetch_price(btc).await.unwrap();

        let after = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Timestamp should be current time (fallback), not 0
        let ts = price.timestamp.as_u64();
        assert!(ts >= before && ts <= after, "Timestamp should be current time when ticker.timestamp=0");
    }
}
