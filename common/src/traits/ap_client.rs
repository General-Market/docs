//! APClient trait for AP (Authorized Participant) interactions

use async_trait::async_trait;
use ethers::types::U256;

use crate::error::Error;
use crate::types::{Fill, OrderId, OrderStatus, Side};

/// Trait for AP client operations
/// Defines methods for placing orders and querying fills
#[async_trait]
pub trait APClient: Send + Sync {
    /// Place an order on the exchange
    ///
    /// # Arguments
    /// * `pair` - Trading pair (e.g., "BTC/USDT")
    /// * `side` - Buy or Sell
    /// * `amount` - Order amount (18 decimals)
    /// * `price` - Limit price (18 decimals)
    ///
    /// # Returns
    /// Order ID assigned to this order
    async fn place_order(
        &self,
        pair: String,
        side: Side,
        amount: U256,
        price: U256,
    ) -> Result<OrderId, Error>;

    /// Get fills for a specific order
    ///
    /// # Arguments
    /// * `order_id` - Order ID to query
    ///
    /// # Returns
    /// List of fills for this order
    async fn get_fills(&self, order_id: OrderId) -> Result<Vec<Fill>, Error>;

    /// Get the status of an order
    ///
    /// # Arguments
    /// * `order_id` - Order ID to query
    ///
    /// # Returns
    /// Current status of the order
    async fn get_order_status(&self, order_id: OrderId) -> Result<OrderStatus, Error>;
}
