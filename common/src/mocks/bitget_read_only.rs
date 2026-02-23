//! MockBitgetReadOnlyClient for local dev and testing
//!
//! Provides a mock implementation of `BitgetReadOnlyClient` that stores
//! configurable ticker data in memory and generates synthetic orderbooks.
//! Used when no Bitget API keys are available (local dev, CI).

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use tokio::sync::RwLock;

use crate::error::Error;
use crate::traits::{
    BitgetFill, BitgetOrderInfo, BitgetOrderbook, BitgetReadOnlyClient, BitgetTicker,
};

/// Mock implementation of [`BitgetReadOnlyClient`].
///
/// Stores tickers in an `Arc<RwLock<HashMap>>` so it can be shared across
/// async tasks and mutated at runtime via `set_ticker` / `load_tickers`.
///
/// - `get_ticker` / `get_all_tickers` return from the in-memory store.
/// - `get_orderbook` generates synthetic levels from the ticker price.
/// - `get_order` / `get_fills` / `get_order_history` return errors or empty
///   results since the mock doesn't track orders.
pub struct MockBitgetReadOnlyClient {
    tickers: Arc<RwLock<HashMap<String, BitgetTicker>>>,
}

impl MockBitgetReadOnlyClient {
    /// Create a new empty mock client.
    pub fn new() -> Self {
        Self {
            tickers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set a single ticker. Sets bid = ask = last = `price_str`.
    pub async fn set_ticker(&self, symbol: &str, price_str: &str) {
        let ticker = BitgetTicker {
            symbol: symbol.to_string(),
            best_bid: price_str.to_string(),
            best_ask: price_str.to_string(),
            last_price: price_str.to_string(),
            timestamp: now_ms(),
            bid_size: "1000".to_string(),
            ask_size: "1000".to_string(),
            usdt_volume: "10000000".to_string(),
        };
        self.tickers
            .write()
            .await
            .insert(symbol.to_string(), ticker);
    }

    /// Bulk-load tickers from a `HashMap<symbol, price_str>`.
    pub async fn load_tickers(&self, map: HashMap<String, String>) {
        let mut tickers = self.tickers.write().await;
        let ts = now_ms();
        for (symbol, price_str) in map {
            let ticker = BitgetTicker {
                symbol: symbol.clone(),
                best_bid: price_str.clone(),
                best_ask: price_str.clone(),
                last_price: price_str,
                timestamp: ts,
                bid_size: "1000".to_string(),
                ask_size: "1000".to_string(),
                usdt_volume: "10000000".to_string(),
            };
            tickers.insert(symbol, ticker);
        }
    }
}

impl Default for MockBitgetReadOnlyClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BitgetReadOnlyClient for MockBitgetReadOnlyClient {
    async fn get_order(&self, order_id: &str) -> Result<BitgetOrderInfo, Error> {
        Err(Error::NotFound(format!(
            "MockBitgetReadOnlyClient does not track orders (order_id={})",
            order_id
        )))
    }

    async fn get_fills(&self, symbol: &str, order_id: &str) -> Result<Vec<BitgetFill>, Error> {
        Err(Error::NotFound(format!(
            "MockBitgetReadOnlyClient does not track fills (symbol={}, order_id={})",
            symbol, order_id
        )))
    }

    async fn get_order_history(
        &self,
        _pair: &str,
        _since: u64,
        _limit: Option<u32>,
    ) -> Result<Vec<BitgetOrderInfo>, Error> {
        Ok(vec![])
    }

    async fn get_ticker(&self, pair: &str) -> Result<BitgetTicker, Error> {
        self.tickers
            .read()
            .await
            .get(pair)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("ticker not found: {}", pair)))
    }

    async fn get_all_tickers(&self) -> Result<Vec<BitgetTicker>, Error> {
        Ok(self.tickers.read().await.values().cloned().collect())
    }

    async fn get_orderbook(&self, symbol: &str, limit: u32) -> Result<BitgetOrderbook, Error> {
        let tickers = self.tickers.read().await;
        let ticker = tickers
            .get(symbol)
            .ok_or_else(|| Error::NotFound(format!("ticker not found for orderbook: {}", symbol)))?;

        let mid_price: f64 = ticker
            .last_price
            .parse()
            .map_err(|e| Error::InvalidArgument(format!("bad price in ticker: {}", e)))?;

        // Generate synthetic orderbook with 0.1% spread per level
        let spread_pct = 0.001; // 0.1%
        let depth = limit.min(20) as usize;
        let base_size = 10.0;

        let mut asks = Vec::with_capacity(depth);
        let mut bids = Vec::with_capacity(depth);

        for i in 0..depth {
            let offset = spread_pct * (i as f64 + 1.0);
            let ask_price = mid_price * (1.0 + offset);
            let bid_price = mid_price * (1.0 - offset);
            asks.push((ask_price, base_size));
            bids.push((bid_price, base_size));
        }

        Ok(BitgetOrderbook {
            asks,
            bids,
            timestamp: now_ms(),
        })
    }
}

/// Current time in milliseconds since UNIX epoch.
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_set_and_get_ticker() {
        let mock = MockBitgetReadOnlyClient::new();
        mock.set_ticker("BTCUSDT", "50000.50").await;

        let ticker = mock.get_ticker("BTCUSDT").await.unwrap();
        assert_eq!(ticker.symbol, "BTCUSDT");
        assert_eq!(ticker.best_bid, "50000.50");
        assert_eq!(ticker.best_ask, "50000.50");
        assert_eq!(ticker.last_price, "50000.50");
        assert!(ticker.timestamp > 0);
    }

    #[tokio::test]
    async fn test_ticker_not_found() {
        let mock = MockBitgetReadOnlyClient::new();
        let result = mock.get_ticker("NONEXISTENT").await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            format!("{}", err).contains("not found"),
            "error should mention 'not found', got: {}",
            err
        );
    }

    #[tokio::test]
    async fn test_get_all_tickers() {
        let mock = MockBitgetReadOnlyClient::new();
        mock.set_ticker("BTCUSDT", "50000").await;
        mock.set_ticker("ETHUSDT", "3000").await;
        mock.set_ticker("SOLUSDT", "100").await;

        let tickers = mock.get_all_tickers().await.unwrap();
        assert_eq!(tickers.len(), 3);

        let symbols: Vec<String> = tickers.iter().map(|t| t.symbol.clone()).collect();
        assert!(symbols.contains(&"BTCUSDT".to_string()));
        assert!(symbols.contains(&"ETHUSDT".to_string()));
        assert!(symbols.contains(&"SOLUSDT".to_string()));
    }

    #[tokio::test]
    async fn test_get_all_tickers_empty() {
        let mock = MockBitgetReadOnlyClient::new();
        let tickers = mock.get_all_tickers().await.unwrap();
        assert!(tickers.is_empty());
    }

    #[tokio::test]
    async fn test_load_tickers_bulk() {
        let mock = MockBitgetReadOnlyClient::new();

        let mut map = HashMap::new();
        map.insert("BTCUSDT".to_string(), "50000".to_string());
        map.insert("ETHUSDT".to_string(), "3000".to_string());
        mock.load_tickers(map).await;

        let btc = mock.get_ticker("BTCUSDT").await.unwrap();
        assert_eq!(btc.last_price, "50000");

        let eth = mock.get_ticker("ETHUSDT").await.unwrap();
        assert_eq!(eth.last_price, "3000");
    }

    #[tokio::test]
    async fn test_orderbook_generation() {
        let mock = MockBitgetReadOnlyClient::new();
        mock.set_ticker("BTCUSDT", "50000").await;

        let orderbook = mock.get_orderbook("BTCUSDT", 5).await.unwrap();

        // Should have 5 levels on each side
        assert_eq!(orderbook.asks.len(), 5);
        assert_eq!(orderbook.bids.len(), 5);

        // Asks should be above mid price, ascending
        for (i, (price, size)) in orderbook.asks.iter().enumerate() {
            assert!(*price > 50000.0, "ask price should be above mid");
            assert_eq!(*size, 10.0, "ask size should be base_size");
            if i > 0 {
                assert!(
                    *price > orderbook.asks[i - 1].0,
                    "asks should be ascending"
                );
            }
        }

        // Bids should be below mid price, descending
        for (i, (price, size)) in orderbook.bids.iter().enumerate() {
            assert!(*price < 50000.0, "bid price should be below mid");
            assert_eq!(*size, 10.0, "bid size should be base_size");
            if i > 0 {
                assert!(
                    *price < orderbook.bids[i - 1].0,
                    "bids should be descending"
                );
            }
        }

        // First ask/bid should be closest to mid (0.1% spread)
        let expected_first_ask = 50000.0 * 1.001;
        let expected_first_bid = 50000.0 * 0.999;
        assert!(
            (orderbook.asks[0].0 - expected_first_ask).abs() < 0.01,
            "first ask should be ~0.1% above mid"
        );
        assert!(
            (orderbook.bids[0].0 - expected_first_bid).abs() < 0.01,
            "first bid should be ~0.1% below mid"
        );
    }

    #[tokio::test]
    async fn test_orderbook_not_found() {
        let mock = MockBitgetReadOnlyClient::new();
        let result = mock.get_orderbook("NONEXISTENT", 5).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_orderbook_limit_capped() {
        let mock = MockBitgetReadOnlyClient::new();
        mock.set_ticker("BTCUSDT", "50000").await;

        // Request 100 levels, should be capped at 20
        let orderbook = mock.get_orderbook("BTCUSDT", 100).await.unwrap();
        assert_eq!(orderbook.asks.len(), 20);
        assert_eq!(orderbook.bids.len(), 20);
    }

    #[tokio::test]
    async fn test_get_order_returns_not_found() {
        let mock = MockBitgetReadOnlyClient::new();
        let result = mock.get_order("some-order-id").await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            format!("{}", err).contains("does not track orders"),
            "error should explain mock limitation, got: {}",
            err
        );
    }

    #[tokio::test]
    async fn test_get_fills_returns_not_found() {
        let mock = MockBitgetReadOnlyClient::new();
        let result = mock.get_fills("BTCUSDT", "some-order-id").await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            format!("{}", err).contains("does not track fills"),
            "error should explain mock limitation, got: {}",
            err
        );
    }

    #[tokio::test]
    async fn test_get_order_history_returns_empty() {
        let mock = MockBitgetReadOnlyClient::new();
        let orders = mock
            .get_order_history("BTCUSDT", 0, Some(100))
            .await
            .unwrap();
        assert!(orders.is_empty());
    }

    #[tokio::test]
    async fn test_set_ticker_overwrites() {
        let mock = MockBitgetReadOnlyClient::new();
        mock.set_ticker("BTCUSDT", "50000").await;
        mock.set_ticker("BTCUSDT", "51000").await;

        let ticker = mock.get_ticker("BTCUSDT").await.unwrap();
        assert_eq!(ticker.last_price, "51000");
    }
}
