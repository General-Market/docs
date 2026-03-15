//! BitgetReadOnlyClient trait for oracle fill verification
//!
//! This trait is used by oracles to independently verify AP fill claims
//! by reading order and fill data directly from Bitget.

use async_trait::async_trait;

use crate::error::Error;

/// Order details from Bitget API
#[derive(Debug, Clone, serde::Serialize)]
pub struct BitgetOrderInfo {
    /// Bitget order ID
    pub order_id: String,
    /// Client-provided order ID (optional)
    pub client_order_id: Option<String>,
    /// Trading pair symbol (e.g., "BTCUSDT")
    pub symbol: String,
    /// Order side: "buy" or "sell"
    pub side: String,
    /// Order type: "limit" or "market"
    pub order_type: String,
    /// Order price as decimal string
    pub price: String,
    /// Order quantity as decimal string
    pub quantity: String,
    /// Order status: "new", "partial_fill", "full_fill", "cancelled"
    pub status: String,
    /// Filled quantity as decimal string
    pub filled_quantity: String,
    /// Average fill price as decimal string
    pub avg_fill_price: String,
    /// Order creation time (Unix timestamp ms)
    pub create_time: u64,
    /// Last update time (Unix timestamp ms)
    pub update_time: u64,
}

/// Fill/trade record from Bitget API
#[derive(Debug, Clone, serde::Serialize)]
pub struct BitgetFill {
    /// Trade ID
    pub trade_id: String,
    /// Order ID this fill belongs to
    pub order_id: String,
    /// Trading pair symbol
    pub symbol: String,
    /// Execution price as decimal string
    pub price: String,
    /// Filled quantity as decimal string
    pub quantity: String,
    /// Trading fee as decimal string
    pub fee: String,
    /// Fee currency (e.g., "USDT")
    pub fee_currency: String,
    /// Trade execution time (Unix timestamp ms)
    pub trade_time: u64,
}

/// Ticker price data from Bitget API
#[derive(Debug, Clone, serde::Serialize)]
pub struct BitgetTicker {
    /// Trading pair symbol
    pub symbol: String,
    /// Best bid price as decimal string
    pub best_bid: String,
    /// Best ask price as decimal string
    pub best_ask: String,
    /// Last traded price as decimal string
    pub last_price: String,
    /// Timestamp (Unix timestamp ms)
    pub timestamp: u64,
    /// Best bid size as decimal string
    pub bid_size: String,
    /// Best ask size as decimal string
    pub ask_size: String,
    /// 24h USDT volume as decimal string
    pub usdt_volume: String,
}

/// Orderbook data from Bitget API
#[derive(Debug, Clone)]
pub struct BitgetOrderbook {
    /// Ask levels (price, size) sorted ascending by price
    pub asks: Vec<(f64, f64)>,
    /// Bid levels (price, size) sorted descending by price
    pub bids: Vec<(f64, f64)>,
    /// Timestamp (Unix timestamp ms)
    pub timestamp: u64,
}

/// Trait for read-only Bitget API operations
///
/// Used by oracles to verify AP fill claims independently.
/// This is separate from APClient which is used for order placement.
#[async_trait]
pub trait BitgetReadOnlyClient: Send + Sync {
    /// Get order details by order ID
    ///
    /// # Arguments
    /// * `order_id` - Bitget order ID
    ///
    /// # Returns
    /// Complete order details from Bitget
    async fn get_order(&self, order_id: &str) -> Result<BitgetOrderInfo, Error>;

    /// Get fill history for an order
    ///
    /// # Arguments
    /// * `symbol` - Trading pair symbol (e.g., "BTCUSDT") - required by Bitget API
    /// * `order_id` - Bitget order ID
    ///
    /// # Returns
    /// List of fills/trades for this order
    async fn get_fills(&self, symbol: &str, order_id: &str) -> Result<Vec<BitgetFill>, Error>;

    /// Get order history for a trading pair
    ///
    /// # Arguments
    /// * `pair` - Trading pair symbol (e.g., "BTCUSDT")
    /// * `since` - Unix timestamp (ms) to fetch orders after
    /// * `limit` - Maximum number of orders to return (default 100, max 500)
    ///
    /// # Returns
    /// List of orders for the pair since the given timestamp
    async fn get_order_history(
        &self,
        pair: &str,
        since: u64,
        limit: Option<u32>,
    ) -> Result<Vec<BitgetOrderInfo>, Error>;

    /// Get current ticker prices for a trading pair
    ///
    /// # Arguments
    /// * `pair` - Trading pair symbol (e.g., "BTCUSDT")
    ///
    /// # Returns
    /// Current bid/ask/last prices
    async fn get_ticker(&self, pair: &str) -> Result<BitgetTicker, Error>;

    /// Fetch all tickers in a single API call (bulk fetch).
    ///
    /// Returns all spot tickers (~800+). Implementations that don't support
    /// bulk fetch return `Err(Error::NotFound(...))` and callers fall back
    /// to per-symbol `get_ticker`.
    async fn get_all_tickers(&self) -> Result<Vec<BitgetTicker>, Error> {
        Err(Error::NotFound("get_all_tickers not supported".to_string()))
    }

    /// Fetch orderbook for a symbol.
    ///
    /// Returns bid/ask levels parsed as (price, size) tuples.
    /// `limit` controls depth (max levels per side).
    async fn get_orderbook(&self, symbol: &str, limit: u32) -> Result<BitgetOrderbook, Error> {
        let _ = (symbol, limit);
        Err(Error::NotFound("get_orderbook not supported".to_string()))
    }
}
