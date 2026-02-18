//! Buffer management module for AP/Keeper service
//!
//! This module provides buffer management for instant fills of small orders.
//! Small orders (below minBuyAmount) can be filled instantly from the buffer,
//! accumulating debt that triggers replenishment when threshold is reached.
//!
//! ## Architecture
//!
//! Buffer tracking is off-chain only (no Solidity state changes).
//! The buffer is initially funded by the protocol, not the AP.
//!
//! ## Data Flow
//!
//! ```text
//! OrderQueue → BufferManager.fill_from_buffer() → Success/Fail
//!                     ↓ (if debt >= threshold)
//!            BufferManager.queue_replenishment()
//!                     ↓
//!            OrderQueue.add_replenishment()
//!                     ↓
//!            Bitget execution → on_replenishment_complete()
//! ```

pub mod config;
pub mod manager;
pub mod metrics;

pub use config::{AssetBufferConfig, BufferConfig};
pub use manager::{AssetBalance, BufferManager};
pub use metrics::{BufferHealthCheck, BufferHealthStatus, BufferMetrics, BufferMetricsSnapshot};

// Re-export for convenience
use common::types::{Fill, LimitOrder, Side};
use ethers::types::{Address, H256, U256};
use std::time::Instant;

/// Result of attempting to fill an order from the buffer
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BufferFillResult {
    /// Order filled successfully from buffer
    Success(Fill),
    /// Buffer has insufficient funds (debt limit exceeded)
    BufferInsufficient,
    /// Order is too large to fill from buffer (exceeds minBuyAmount)
    OrderTooLarge,
    /// Asset is not configured in the buffer
    AssetNotConfigured,
    /// Only Buy orders can be filled from buffer
    SellOrderNotSupported,
}

/// Replenishment order to be queued for CEX execution
#[derive(Debug, Clone)]
pub struct ReplenishmentOrder {
    /// Asset to replenish
    pub asset: Address,
    /// Amount to replenish (in USDC value, 18 decimals)
    pub amount: U256,
    /// Timestamp when replenishment was triggered
    pub triggered_at: Instant,
}

impl BufferManager {
    /// Attempt to fill an order from the buffer
    ///
    /// This is the main entry point for buffer fills. Orders are only filled
    /// from buffer if:
    /// - The asset is configured in the buffer
    /// - The order amount is less than minBuyAmount for that asset
    /// - The buffer hasn't exceeded its debt limit
    ///
    /// Returns a BufferFillResult indicating success or failure reason.
    pub async fn fill_from_buffer(&self, order: &LimitOrder) -> BufferFillResult {
        // Buffer fills are only for Buy orders (instant asset purchase from inventory)
        if order.side != Side::Buy {
            tracing::debug!(
                order_id = %order.id,
                side = ?order.side,
                "Buffer fills only support Buy orders"
            );
            return BufferFillResult::SellOrderNotSupported;
        }

        // Extract asset from pair_id (for MVP, assume pair_id encodes asset address)
        // In full implementation, this would be looked up from a pair registry
        let asset = extract_asset_from_pair_id(&order.pair_id);

        // Check if asset is configured
        let asset_config = match self.config().get_asset_config(&asset) {
            Some(config) => config,
            None => {
                tracing::debug!(
                    asset = ?asset,
                    order_id = %order.id,
                    "Asset not configured for buffer fills"
                );
                return BufferFillResult::AssetNotConfigured;
            }
        };

        // Check if order is small enough for buffer fill
        if order.amount >= asset_config.min_buy_amount {
            tracing::debug!(
                order_id = %order.id,
                order_amount = %order.amount,
                min_buy_amount = %asset_config.min_buy_amount,
                "Order too large for buffer fill"
            );
            self.metrics().record_too_large_rejection();
            return BufferFillResult::OrderTooLarge;
        }

        // Attempt to deduct from buffer
        if !self.deduct(&asset, order.amount).await {
            tracing::debug!(
                order_id = %order.id,
                amount = %order.amount,
                "Buffer insufficient for order"
            );
            self.metrics().record_insufficient_rejection();
            return BufferFillResult::BufferInsufficient;
        }

        // Record successful fill
        self.metrics().record_instant_fill();

        // Create synthetic fill
        let fill = Fill {
            order_id: order.id,
            fill_price: order.limit_price, // Buffer fills at limit price
            fill_amount: order.amount,
            cycle_number: U256::zero(), // Buffer fills are instant, no cycle
            tx_hash: H256::zero(),      // No CEX tx hash for buffer fills
        };

        tracing::info!(
            order_id = %order.id,
            amount = %order.amount,
            asset = ?asset,
            "Order filled from buffer"
        );

        BufferFillResult::Success(fill)
    }

    /// Check if replenishment is needed for an asset
    ///
    /// Returns Some(ReplenishmentOrder) if debt has accumulated to or beyond
    /// the minBuyAmount threshold for that asset.
    pub async fn check_replenishment_needed(&self, asset: &Address) -> Option<ReplenishmentOrder> {
        let min_buy_amount = self.get_min_buy_amount(asset)?;
        let debt = self.get_debt(asset).await;

        if debt >= min_buy_amount {
            tracing::info!(
                asset = ?asset,
                debt = %debt,
                min_buy_amount = %min_buy_amount,
                "Replenishment needed"
            );

            Some(ReplenishmentOrder {
                asset: *asset,
                amount: debt, // Replenish the full accumulated debt
                triggered_at: Instant::now(),
            })
        } else {
            None
        }
    }

    /// Called when replenishment completes successfully
    ///
    /// Clears debt and adds replenished amount to buffer.
    pub async fn on_replenishment_complete(&self, asset: &Address, amount: U256) {
        self.replenish(asset, amount).await;
        self.metrics().record_replenishment();
        tracing::info!(
            asset = ?asset,
            amount = %amount,
            "Replenishment complete"
        );
    }
}

/// Extract asset address from pair_id
/// For MVP, we encode the asset address in the lower 20 bytes of pair_id
fn extract_asset_from_pair_id(pair_id: &H256) -> Address {
    Address::from_slice(&pair_id.as_bytes()[12..32])
}

/// Create a pair_id from an asset address (for testing)
#[cfg(test)]
pub fn pair_id_from_asset(asset: &Address) -> H256 {
    let mut bytes = [0u8; 32];
    bytes[12..32].copy_from_slice(asset.as_bytes());
    H256::from(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{OrderStatus, Side};

    fn test_config() -> BufferConfig {
        let usdc = Address::from_low_u64_be(1);

        BufferConfig::new()
            .with_asset(
                usdc,
                AssetBufferConfig {
                    initial_balance: U256::from(100) * U256::exp10(18), // $100
                    max_debt: U256::from(50) * U256::exp10(18),         // $50 max debt
                    min_buy_amount: U256::from(5) * U256::exp10(18),    // $5 min
                },
            )
            .with_warning_threshold(U256::from(50) * U256::exp10(18))
            .with_critical_threshold(U256::from(10) * U256::exp10(18))
    }

    fn create_test_order(asset: Address, amount: U256) -> LimitOrder {
        LimitOrder {
            id: U256::from(1),
            user: Address::random(),
            pair_id: pair_id_from_asset(&asset),
            side: Side::Buy,
            amount,
            limit_price: U256::from(100) * U256::exp10(18),
            slippage_tier: U256::zero(),
            deadline: U256::from(u64::MAX),
            itp_id: H256::zero(),
            timestamp: U256::from(1000),
            status: OrderStatus::Pending,
        }
    }

    #[tokio::test]
    async fn test_fill_from_buffer_small_order() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let asset = Address::from_low_u64_be(1);
        let order = create_test_order(asset, U256::from(3) * U256::exp10(18)); // $3 order

        let result = manager.fill_from_buffer(&order).await;

        match result {
            BufferFillResult::Success(fill) => {
                assert_eq!(fill.order_id, order.id);
                assert_eq!(fill.fill_amount, order.amount);
            }
            other => panic!("Expected Success, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_fill_from_buffer_order_too_large() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let asset = Address::from_low_u64_be(1);
        // Order of $10 is >= min_buy_amount ($5)
        let order = create_test_order(asset, U256::from(10) * U256::exp10(18));

        let result = manager.fill_from_buffer(&order).await;
        assert_eq!(result, BufferFillResult::OrderTooLarge);
    }

    #[tokio::test]
    async fn test_fill_from_buffer_asset_not_configured() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let unknown_asset = Address::from_low_u64_be(999);
        let order = create_test_order(unknown_asset, U256::from(3) * U256::exp10(18));

        let result = manager.fill_from_buffer(&order).await;
        assert_eq!(result, BufferFillResult::AssetNotConfigured);
    }

    #[tokio::test]
    async fn test_debt_accumulation_triggers_replenishment() {
        // Setup: balance=$15, max_debt=$50, min_buy_amount=$5
        // Fill 6x $3 orders = $18 total, exceeding $15 balance by $3.
        // Then fill 1 more = $21 total, debt = $6 >= $5 min_buy_amount.
        let asset = Address::from_low_u64_be(1);
        let config = BufferConfig::new()
            .with_asset(
                asset,
                AssetBufferConfig {
                    initial_balance: U256::from(15) * U256::exp10(18),
                    max_debt: U256::from(50) * U256::exp10(18),
                    min_buy_amount: U256::from(5) * U256::exp10(18),
                },
            );
        let manager = BufferManager::new(config);

        // Fill 7 orders of $3 each = $21, debt should be $6
        for i in 0..7 {
            let order = create_test_order(asset, U256::from(3) * U256::exp10(18));
            let result = manager.fill_from_buffer(&LimitOrder { id: U256::from(i), ..order }).await;
            assert!(matches!(result, BufferFillResult::Success(_)), "Fill {} should succeed", i);
        }

        let debt = manager.get_debt(&asset).await;
        assert_eq!(debt, U256::from(6) * U256::exp10(18), "Debt should be $6");

        // Debt ($6) >= min_buy_amount ($5), so replenishment must trigger
        let replenishment = manager.check_replenishment_needed(&asset).await;
        assert!(replenishment.is_some(), "Replenishment should be triggered");
        let order = replenishment.unwrap();
        assert_eq!(order.amount, U256::from(6) * U256::exp10(18));
    }

    #[tokio::test]
    async fn test_replenishment_clears_debt() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let asset = Address::from_low_u64_be(1);

        // Deplete buffer and accumulate some debt
        for i in 0..35 {
            let order = LimitOrder {
                id: U256::from(i),
                user: Address::random(),
                pair_id: pair_id_from_asset(&asset),
                side: Side::Buy,
                amount: U256::from(4) * U256::exp10(18), // $4 each
                limit_price: U256::from(100) * U256::exp10(18),
                slippage_tier: U256::zero(),
                deadline: U256::from(u64::MAX),
                itp_id: H256::zero(),
                timestamp: U256::from(1000 + i),
                status: OrderStatus::Pending,
            };
            let _ = manager.fill_from_buffer(&order).await;
        }

        let debt_before = manager.get_debt(&asset).await;

        // Replenish with enough to clear debt
        manager
            .on_replenishment_complete(&asset, debt_before + U256::from(50) * U256::exp10(18))
            .await;

        let debt_after = manager.get_debt(&asset).await;
        assert_eq!(debt_after, U256::zero());

        // Should have positive balance now
        let balance = manager.get_buffer_balance(&asset).await;
        assert!(balance > 0);
    }

    #[tokio::test]
    async fn test_multi_asset_buffer() {
        let usdc = Address::from_low_u64_be(1);
        let btc = Address::from_low_u64_be(2);

        let config = BufferConfig::new()
            .with_asset(
                usdc,
                AssetBufferConfig {
                    initial_balance: U256::from(1000) * U256::exp10(18),
                    max_debt: U256::from(500) * U256::exp10(18),
                    min_buy_amount: U256::from(5) * U256::exp10(18),
                },
            )
            .with_asset(
                btc,
                AssetBufferConfig {
                    initial_balance: U256::from(100) * U256::exp10(18),
                    max_debt: U256::from(50) * U256::exp10(18),
                    min_buy_amount: U256::from(5) * U256::exp10(18),
                },
            );

        let manager = BufferManager::new(config);

        // Fill from USDC buffer
        let usdc_order = create_test_order(usdc, U256::from(3) * U256::exp10(18));
        let result = manager.fill_from_buffer(&usdc_order).await;
        assert!(matches!(result, BufferFillResult::Success(_)));

        // Fill from BTC buffer
        let btc_order = create_test_order(btc, U256::from(3) * U256::exp10(18));
        let result = manager.fill_from_buffer(&btc_order).await;
        assert!(matches!(result, BufferFillResult::Success(_)));

        // Buffers should be independent
        let usdc_balance = manager.get_buffer_balance(&usdc).await;
        let btc_balance = manager.get_buffer_balance(&btc).await;

        // Both should have been decremented independently
        assert!(usdc_balance > btc_balance); // USDC started higher
    }

    #[tokio::test]
    async fn test_sell_order_rejected() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let asset = Address::from_low_u64_be(1);
        let mut order = create_test_order(asset, U256::from(3) * U256::exp10(18));
        order.side = Side::Sell;

        let result = manager.fill_from_buffer(&order).await;
        assert_eq!(result, BufferFillResult::SellOrderNotSupported);
    }

    #[tokio::test]
    async fn test_concurrent_buffer_access() {
        use std::sync::Arc;

        let config = test_config();
        let manager = Arc::new(BufferManager::new(config));
        let asset = Address::from_low_u64_be(1);

        // Spawn 20 concurrent fill tasks
        let mut handles = Vec::new();
        for i in 0..20 {
            let mgr = Arc::clone(&manager);
            let order = LimitOrder {
                id: U256::from(i),
                user: Address::random(),
                pair_id: pair_id_from_asset(&asset),
                side: Side::Buy,
                amount: U256::from(2) * U256::exp10(18), // $2 each
                limit_price: U256::from(100) * U256::exp10(18),
                slippage_tier: U256::zero(),
                deadline: U256::from(u64::MAX),
                itp_id: H256::zero(),
                timestamp: U256::from(1000 + i),
                status: OrderStatus::Pending,
            };
            handles.push(tokio::spawn(async move {
                mgr.fill_from_buffer(&order).await
            }));
        }

        // Collect results
        let mut successes = 0u32;
        let mut insufficient = 0u32;
        for handle in handles {
            match handle.await.unwrap() {
                BufferFillResult::Success(_) => successes += 1,
                BufferFillResult::BufferInsufficient => insufficient += 1,
                other => panic!("Unexpected result: {:?}", other),
            }
        }

        // With $100 balance, $50 max debt, $2 per order:
        // Can fill up to 75 orders ($150 total = $100 balance + $50 debt).
        // 20 orders = $40, all should succeed.
        assert_eq!(successes, 20);
        assert_eq!(insufficient, 0);

        // Balance should be reduced by $40
        let balance = manager.get_buffer_balance(&asset).await;
        assert_eq!(balance, 60 * 10i128.pow(18));
    }

    #[test]
    fn test_extract_asset_from_pair_id() {
        let asset = Address::from_low_u64_be(12345);
        let pair_id = pair_id_from_asset(&asset);
        let extracted = extract_asset_from_pair_id(&pair_id);
        assert_eq!(extracted, asset);
    }
}
