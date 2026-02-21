//! Rate-limited Bitget client wrapper implementing APClient trait
//!
//! Wraps BitgetClient with BitgetRateLimiter to enforce API rate limits
//! and implements the APClient trait for integration into the AP pipeline.

use async_trait::async_trait;
use ethers::types::{H256, U256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use common::error::Error;
use common::rate_limit::{BitgetRateLimiter, EndpointType, RateLimiterMetrics};
use common::traits::APClient;
use common::types::{Fill, OrderId, OrderStatus, Side};

use super::client::{
    bitget_status_to_order_status, decimal_to_u256, side_to_order_side, u256_to_decimal,
    BitgetClient,
};

/// Number of decimal places for U256 fixed-point values (18 decimals per EVM convention)
const U256_DECIMALS: u8 = 18;

/// File path for persisting the order_id_map between restarts
const ORDER_ID_MAP_PATH: &str = "data/order_id_map.json";

/// Load order_id_map from disk if the file exists.
/// Keys are U256 serialized as decimal strings, values are Bitget order ID strings.
fn load_order_id_map() -> HashMap<U256, String> {
    let path = std::path::Path::new(ORDER_ID_MAP_PATH);
    if !path.exists() {
        return HashMap::new();
    }
    match std::fs::read_to_string(path) {
        Ok(data) => {
            // Deserialize as HashMap<String, String> then convert keys to U256
            match serde_json::from_str::<HashMap<String, String>>(&data) {
                Ok(raw_map) => {
                    let mut map = HashMap::new();
                    for (key_str, val) in raw_map {
                        if let Ok(key) = U256::from_dec_str(&key_str) {
                            map.insert(key, val);
                        } else {
                            warn!(key = %key_str, "Skipping invalid U256 key in order_id_map.json");
                        }
                    }
                    info!(entries = map.len(), "Loaded order_id_map from {}", ORDER_ID_MAP_PATH);
                    map
                }
                Err(e) => {
                    warn!(error = %e, "Failed to parse {}, starting with empty map", ORDER_ID_MAP_PATH);
                    HashMap::new()
                }
            }
        }
        Err(e) => {
            warn!(error = %e, "Failed to read {}, starting with empty map", ORDER_ID_MAP_PATH);
            HashMap::new()
        }
    }
}

/// Save order_id_map to disk for persistence across restarts.
fn save_order_id_map(map: &HashMap<U256, String>) {
    // Convert U256 keys to decimal strings for JSON serialization
    let raw_map: HashMap<String, &String> = map.iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    if let Ok(data) = serde_json::to_string_pretty(&raw_map) {
        let _ = std::fs::create_dir_all("data");
        if let Err(e) = std::fs::write(ORDER_ID_MAP_PATH, data) {
            warn!(error = %e, "Failed to save order_id_map to {}", ORDER_ID_MAP_PATH);
        }
    }
}

/// Rate-limited Bitget client that implements APClient
///
/// Wraps a BitgetClient with a BitgetRateLimiter to enforce API rate limits
/// before each call. Implements the APClient trait for seamless integration
/// into the AP event processing pipeline.
pub struct RateLimitedBitgetClient {
    client: BitgetClient,
    rate_limiter: Arc<BitgetRateLimiter>,
    /// Maps U256 order IDs back to original Bitget string IDs (needed for hashed non-numeric IDs)
    order_id_map: RwLock<HashMap<U256, String>>,
}

impl RateLimitedBitgetClient {
    /// Create a new rate-limited client.
    /// Loads any previously persisted order_id_map from disk.
    pub fn new(client: BitgetClient, rate_limiter: Arc<BitgetRateLimiter>) -> Self {
        Self {
            client,
            rate_limiter,
            order_id_map: RwLock::new(load_order_id_map()),
        }
    }

    /// Get rate limiter metrics for monitoring
    pub fn get_rate_limiter_metrics(&self) -> RateLimiterMetrics {
        self.rate_limiter.get_metrics()
    }

    /// Get a reference to the inner BitgetClient
    pub fn inner(&self) -> &BitgetClient {
        &self.client
    }

    /// Resolve a U256 order ID to the original Bitget string ID.
    /// Falls back to `order_id.to_string()` if no mapping exists (i.e., the ID was numeric).
    async fn resolve_order_id(&self, order_id: U256) -> String {
        self.order_id_map
            .read()
            .await
            .get(&order_id)
            .cloned()
            .unwrap_or_else(|| order_id.to_string())
    }
}

impl std::fmt::Debug for RateLimitedBitgetClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RateLimitedBitgetClient")
            .field("client", &self.client)
            .field("rate_limiter", &self.rate_limiter)
            .finish_non_exhaustive()
    }
}

#[async_trait]
impl APClient for RateLimitedBitgetClient {
    async fn place_order(
        &self,
        pair: String,
        side: Side,
        amount: U256,
        price: U256,
    ) -> Result<OrderId, Error> {
        // Acquire rate limit slot for order placement
        let wait = self
            .rate_limiter
            .acquire(EndpointType::OrderPlacement)
            .await;
        if !wait.is_zero() {
            debug!(wait_ms = wait.as_millis(), "rate limiter throttled order placement");
        }

        // Convert U256 (18 decimals) -> Decimal for BitgetClient
        let amount_dec = u256_to_decimal(amount, U256_DECIMALS);
        let price_dec = u256_to_decimal(price, U256_DECIMALS);
        let order_side = side_to_order_side(side);

        // Place order via BitgetClient
        let bitget_order_id = self
            .client
            .place_limit_order(&pair, order_side, amount_dec, price_dec)
            .await
            .map_err(|e| Error::ApClient(format!("Bitget place_order failed: {}", e)))?;

        // Convert Bitget string order ID to U256 OrderId
        let order_id = U256::from_dec_str(&bitget_order_id).unwrap_or_else(|_| {
            // If the order ID is not a pure decimal, hash it to get a deterministic U256
            warn!(
                bitget_order_id = %bitget_order_id,
                "Bitget order ID is not a decimal number, using hash"
            );
            let hash = ethers::utils::keccak256(bitget_order_id.as_bytes());
            U256::from_big_endian(&hash)
        });

        // Store mapping so we can resolve the original Bitget ID for future queries
        {
            let mut map = self.order_id_map.write().await;
            map.insert(order_id, bitget_order_id.clone());
            save_order_id_map(&map);
        }

        debug!(order_id = %order_id, bitget_id = %bitget_order_id, "order placed successfully");
        Ok(order_id)
    }

    async fn get_fills(&self, order_id: OrderId, cycle_number: U256) -> Result<Vec<Fill>, Error> {
        // Acquire rate limit slot for read operation
        let wait = self.rate_limiter.acquire(EndpointType::ReadOnly).await;
        if !wait.is_zero() {
            debug!(wait_ms = wait.as_millis(), "rate limiter throttled fills query");
        }

        let order_id_str = self.resolve_order_id(order_id).await;

        let bitget_fills = self
            .client
            .get_order_fills(&order_id_str)
            .await
            .map_err(|e| Error::ApClient(format!("Bitget get_fills failed: {}", e)))?;

        // Convert Bitget FillData to common Fill type
        let mut fills = Vec::with_capacity(bitget_fills.len());
        for f in bitget_fills {
            let parsed_price: rust_decimal::Decimal = f.price.parse()
                .map_err(|e| Error::ApClient(format!("failed to parse fill price '{}': {}", f.price, e)))?;
            let parsed_qty: rust_decimal::Decimal = f.quantity.parse()
                .map_err(|e| Error::ApClient(format!("failed to parse fill quantity '{}': {}", f.quantity, e)))?;

            let fill_price = decimal_to_u256(parsed_price, U256_DECIMALS);
            let fill_amount = decimal_to_u256(parsed_qty, U256_DECIMALS);

            fills.push(Fill {
                order_id,
                fill_price,
                fill_amount,
                cycle_number,
                tx_hash: H256::zero(), // CEX fills don't have on-chain tx hash
            });
        }

        Ok(fills)
    }

    async fn get_order_status(&self, order_id: OrderId) -> Result<OrderStatus, Error> {
        // Acquire rate limit slot for read operation
        let wait = self.rate_limiter.acquire(EndpointType::ReadOnly).await;
        if !wait.is_zero() {
            debug!(wait_ms = wait.as_millis(), "rate limiter throttled status query");
        }

        let order_id_str = self.resolve_order_id(order_id).await;

        let detail = self
            .client
            .get_order_detail(&order_id_str)
            .await
            .map_err(|e| Error::ApClient(format!("Bitget get_order_status failed: {}", e)))?;

        Ok(bitget_status_to_order_status(&detail.status))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_u256_to_decimal_conversion() {
        // 1.0 with 18 decimals
        let one = U256::exp10(18);
        let dec = u256_to_decimal(one, 18);
        assert_eq!(dec, rust_decimal::Decimal::ONE);

        // 42000.5 with 18 decimals
        let value = U256::from(42000u64) * U256::exp10(18) + U256::from(5u64) * U256::exp10(17);
        let dec = u256_to_decimal(value, 18);
        let expected = rust_decimal::Decimal::new(420005, 1); // 42000.5
        assert_eq!(dec, expected);

        // Zero
        let dec = u256_to_decimal(U256::zero(), 18);
        assert_eq!(dec, rust_decimal::Decimal::ZERO);
    }

    #[test]
    fn test_decimal_to_u256_conversion() {
        // 1.0 -> U256 with 18 decimals
        let dec = rust_decimal::Decimal::ONE;
        let u = decimal_to_u256(dec, 18);
        assert_eq!(u, U256::exp10(18));

        // 42000.5 -> U256 with 18 decimals
        let dec = rust_decimal::Decimal::new(420005, 1);
        let u = decimal_to_u256(dec, 18);
        let expected = U256::from(42000u64) * U256::exp10(18) + U256::from(5u64) * U256::exp10(17);
        assert_eq!(u, expected);

        // Zero
        let dec = rust_decimal::Decimal::ZERO;
        let u = decimal_to_u256(dec, 18);
        assert_eq!(u, U256::zero());
    }

    #[test]
    fn test_roundtrip_u256_decimal() {
        let original = U256::from(123_456_789u64) * U256::exp10(10); // 1234567890000000000 (1.23... with 18 dec)
        let dec = u256_to_decimal(original, 18);
        let back = decimal_to_u256(dec, 18);
        assert_eq!(original, back);
    }

    #[test]
    fn test_side_conversion() {
        assert_eq!(
            side_to_order_side(Side::Buy),
            super::super::types::OrderSide::Buy
        );
        assert_eq!(
            side_to_order_side(Side::Sell),
            super::super::types::OrderSide::Sell
        );
    }

    #[test]
    fn test_bitget_status_mapping() {
        assert_eq!(
            bitget_status_to_order_status("new"),
            OrderStatus::Pending
        );
        assert_eq!(
            bitget_status_to_order_status("init"),
            OrderStatus::Pending
        );
        assert_eq!(
            bitget_status_to_order_status("partial_fill"),
            OrderStatus::Batched
        );
        assert_eq!(
            bitget_status_to_order_status("full_fill"),
            OrderStatus::Filled
        );
        assert_eq!(
            bitget_status_to_order_status("cancelled"),
            OrderStatus::Cancelled
        );
        assert_eq!(
            bitget_status_to_order_status("unknown_status"),
            OrderStatus::Pending
        );
    }
}
