//! Order Batcher module for Index L3 Issuer
//!
//! Collects and validates orders for batching. Orders with expired deadlines
//! are queued for refund. Orders for paused ITPs or during system pause remain pending.

use std::collections::HashMap;
use std::sync::Arc;

use common::error::Error;
use common::traits::ChainReader;
use common::types::LimitOrder;
use ethers::types::{H256, U256};
use tracing::{debug, info, warn};

/// Result of validating a single order
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationResult {
    /// Order is valid and ready for batching
    Valid,
    /// Order deadline has passed, should be refunded
    Expired,
    /// Order's ITP is paused, remain pending
    ItpPaused,
    /// System is paused, remain pending
    SystemPaused,
}

/// Pause state for system and ITPs
#[derive(Debug, Clone, Default)]
pub struct PauseState {
    /// Whether the entire system is paused
    pub system_paused: bool,
    /// Set of paused ITP IDs
    pub paused_itps: std::collections::HashSet<H256>,
}

impl PauseState {
    /// Create a new PauseState
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if a specific ITP is paused
    pub fn is_itp_paused(&self, itp_id: &H256) -> bool {
        self.paused_itps.contains(itp_id)
    }

    /// Check if the system is paused
    pub fn is_system_paused(&self) -> bool {
        self.system_paused
    }
}

/// Queue for expired orders that need refunds
#[derive(Debug, Clone, Default)]
pub struct ExpiredOrderQueue {
    /// Orders awaiting refund processing
    orders: Vec<LimitOrder>,
}

impl ExpiredOrderQueue {
    /// Create a new empty queue
    pub fn new() -> Self {
        Self::default()
    }

    /// Queue an order for refund processing
    pub fn queue_for_refund(&mut self, order: LimitOrder) {
        info!(
            order_id = %order.id,
            user = %order.user,
            deadline = %order.deadline,
            "Order expired, queuing for refund"
        );
        self.orders.push(order);
    }

    /// Get all queued orders
    pub fn orders(&self) -> &[LimitOrder] {
        &self.orders
    }

    /// Take all orders from the queue
    pub fn take_all(&mut self) -> Vec<LimitOrder> {
        std::mem::take(&mut self.orders)
    }

    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.orders.is_empty()
    }

    /// Get number of queued orders
    pub fn len(&self) -> usize {
        self.orders.len()
    }
}

/// Result of a batching operation for a cycle
#[derive(Debug, Clone)]
pub struct BatchResult {
    /// Valid orders grouped by ITP ID
    pub valid_orders: HashMap<H256, Vec<LimitOrder>>,
    /// Orders that expired and need refunds
    pub expired_orders: Vec<LimitOrder>,
    /// The cycle number for this batch
    pub cycle_number: u64,
}

/// Default maximum number of orders per batch (FIFO, prevents unbounded collection)
pub const DEFAULT_MAX_BATCH_SIZE: usize = 50;

/// Order Batcher for collecting and validating orders
pub struct OrderBatcher<C: ChainReader> {
    /// Chain reader for fetching orders and ITP state
    chain_reader: Arc<C>,
    /// Current pause state
    pause_state: PauseState,
    /// Maximum orders to include in a single batch (FIFO)
    max_batch_size: usize,
}

impl<C: ChainReader> OrderBatcher<C> {
    /// Create a new OrderBatcher with the given chain reader
    pub fn new(chain_reader: Arc<C>) -> Self {
        Self {
            chain_reader,
            pause_state: PauseState::new(),
            max_batch_size: DEFAULT_MAX_BATCH_SIZE,
        }
    }

    /// Create a new OrderBatcher with custom batch size limit
    pub fn with_max_batch_size(chain_reader: Arc<C>, max_batch_size: usize) -> Self {
        Self {
            chain_reader,
            pause_state: PauseState::new(),
            max_batch_size,
        }
    }

    /// Update the pause state (called externally when pause events occur)
    pub fn set_pause_state(&mut self, pause_state: PauseState) {
        self.pause_state = pause_state;
    }

    /// Collect all pending orders from the chain
    ///
    /// # Errors
    /// Returns an error if the chain reader fails to fetch orders
    pub async fn collect_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        debug!("Collecting pending orders from chain");
        let orders = self.chain_reader.get_pending_orders().await?;
        info!(order_count = orders.len(), "Collected pending orders");
        Ok(orders)
    }

    /// Validate a single order against expiry and pause rules
    ///
    /// # Arguments
    /// * `order` - The order to validate
    /// * `now` - Current timestamp for expiry checking (should be block.timestamp)
    ///
    /// # Note
    /// Caller is responsible for providing accurate timestamp from block.timestamp.
    /// Pause state should be refreshed via `set_pause_state()` before calling `get_batch()`.
    pub fn validate_order(&self, order: &LimitOrder, now: u64) -> ValidationResult {
        // Check system pause first
        if self.pause_state.is_system_paused() {
            debug!(order_id = %order.id, "Order skipped: system paused");
            return ValidationResult::SystemPaused;
        }

        // Check ITP pause
        if self.pause_state.is_itp_paused(&order.itp_id) {
            debug!(order_id = %order.id, itp_id = %order.itp_id, "Order skipped: ITP paused");
            return ValidationResult::ItpPaused;
        }

        // Check deadline expiry - use safe comparison to handle U256 > u64::MAX
        // If deadline > u64::MAX, it's definitely not expired (far future)
        let now_u256 = U256::from(now);
        if order.deadline < now_u256 {
            debug!(
                order_id = %order.id,
                deadline = %order.deadline,
                now = now,
                "Order expired"
            );
            return ValidationResult::Expired;
        }

        ValidationResult::Valid
    }

    /// Group orders by ITP ID, preserving FIFO order
    pub fn group_by_itp(&self, orders: Vec<LimitOrder>) -> HashMap<H256, Vec<LimitOrder>> {
        let mut grouped: HashMap<H256, Vec<LimitOrder>> = HashMap::new();

        for order in orders {
            grouped.entry(order.itp_id).or_default().push(order);
        }

        debug!(
            itp_count = grouped.len(),
            total_orders = grouped.values().map(|v| v.len()).sum::<usize>(),
            "Grouped orders by ITP"
        );

        grouped
    }

    /// Get a batch for the given cycle
    ///
    /// This orchestrates the full batching flow:
    /// 1. Collect orders from chain
    /// 2. Validate each order (expiry, pause status)
    /// 3. Queue expired orders for refund
    /// 4. Group valid orders by ITP
    ///
    /// # Arguments
    /// * `cycle_number` - The cycle number for replay protection
    /// * `now` - Current timestamp for expiry checking
    ///
    /// # Errors
    /// Returns an error if collecting orders from the chain fails
    pub async fn get_batch(&mut self, cycle_number: u64, now: u64) -> Result<BatchResult, Error> {
        info!(cycle_number, "Starting batch collection for cycle");

        // Step 1: Collect orders
        let orders = self.collect_orders().await?;

        // Step 2 & 3: Validate and separate
        let mut valid_orders = Vec::new();
        let mut expired_orders = Vec::new();

        for order in orders {
            match self.validate_order(&order, now) {
                ValidationResult::Valid => {
                    valid_orders.push(order);
                }
                ValidationResult::Expired => {
                    expired_orders.push(order);
                }
                ValidationResult::ItpPaused | ValidationResult::SystemPaused => {
                    // These orders remain pending on chain, not included in batch
                    debug!(order_id = %order.id, "Order excluded from batch (paused)");
                }
            }
        }

        // Log expired orders for monitoring
        if !expired_orders.is_empty() {
            warn!(
                expired_count = expired_orders.len(),
                "Orders expired and queued for refund"
            );
        }

        // Step 3.5: Truncate to max_batch_size (FIFO — orders are already in chain order)
        let total_valid = valid_orders.len();
        if total_valid > self.max_batch_size {
            info!(
                total_valid,
                max_batch_size = self.max_batch_size,
                deferred = total_valid - self.max_batch_size,
                "Truncating batch to max size (deferred orders will be processed in next cycle)"
            );
            valid_orders.truncate(self.max_batch_size);
        }

        // Step 4: Group valid orders by ITP
        let grouped_orders = self.group_by_itp(valid_orders);

        info!(
            cycle_number,
            valid_order_count = grouped_orders.values().map(|v| v.len()).sum::<usize>(),
            itp_count = grouped_orders.len(),
            expired_count = expired_orders.len(),
            "Batch collection complete"
        );

        Ok(BatchResult {
            valid_orders: grouped_orders,
            expired_orders,
            cycle_number,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::mocks::MockChainBuilder;
    use common::types::{OrderStatus, Side};
    use ethers::types::{Address, U256};

    fn create_test_order(id: u64, deadline: u64, itp_id: H256) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: Address::random(),
            pair_id: H256::random(),
            side: Side::Buy,
            amount: U256::from(1000u64) * U256::exp10(18),
            limit_price: U256::from(100u64) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(deadline),
            itp_id,
            timestamp: U256::from(1000u64),
            status: OrderStatus::Pending,
        }
    }

    #[tokio::test]
    async fn test_collect_orders_with_mock_chain_reader() {
        // AC: #1 - Collect orders via ChainReader
        let itp_id = H256::random();
        let order1 = create_test_order(1, u64::MAX, itp_id);
        let order2 = create_test_order(2, u64::MAX, itp_id);

        let mock_chain = MockChainBuilder::new()
            .with_order(order1.clone())
            .with_order(order2.clone())
            .build();

        let batcher = OrderBatcher::new(Arc::new(mock_chain));
        let orders = batcher.collect_orders().await.unwrap();

        assert_eq!(orders.len(), 2);
    }

    #[tokio::test]
    async fn test_expired_orders_queued_for_refund() {
        // AC: #2 - Orders with deadline < now are marked expired
        let itp_id = H256::random();
        let now = 2000u64;

        // Expired order (deadline in past)
        let expired_order = create_test_order(1, 1000, itp_id);
        // Valid order (deadline in future)
        let valid_order = create_test_order(2, 3000, itp_id);

        let mock_chain = MockChainBuilder::new()
            .with_order(expired_order.clone())
            .with_order(valid_order.clone())
            .build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));
        let batch = batcher.get_batch(1, now).await.unwrap();

        // Expired order should be in expired_orders
        assert_eq!(batch.expired_orders.len(), 1);
        assert_eq!(batch.expired_orders[0].id, expired_order.id);

        // Valid order should be in valid_orders
        let total_valid: usize = batch.valid_orders.values().map(|v| v.len()).sum();
        assert_eq!(total_valid, 1);
    }

    #[tokio::test]
    async fn test_itp_pause_filtering() {
        // AC: #3 - Orders for paused ITPs are excluded
        let paused_itp = H256::random();
        let active_itp = H256::random();
        let now = 1500u64;

        let paused_order = create_test_order(1, 3000, paused_itp);
        let active_order = create_test_order(2, 3000, active_itp);

        let mock_chain = MockChainBuilder::new()
            .with_order(paused_order.clone())
            .with_order(active_order.clone())
            .build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));

        // Set ITP as paused
        let mut pause_state = PauseState::new();
        pause_state.paused_itps.insert(paused_itp);
        batcher.set_pause_state(pause_state);

        let batch = batcher.get_batch(1, now).await.unwrap();

        // Only active ITP order should be in valid orders
        let total_valid: usize = batch.valid_orders.values().map(|v| v.len()).sum();
        assert_eq!(total_valid, 1);
        assert!(batch.valid_orders.contains_key(&active_itp));
        assert!(!batch.valid_orders.contains_key(&paused_itp));

        // Paused ITP order should not be in expired (it remains pending)
        assert!(batch.expired_orders.is_empty());
    }

    #[tokio::test]
    async fn test_system_pause_filtering() {
        // AC: #4 - All orders excluded when system is paused
        let itp_id = H256::random();
        let now = 1500u64;

        let order1 = create_test_order(1, 3000, itp_id);
        let order2 = create_test_order(2, 3000, itp_id);

        let mock_chain = MockChainBuilder::new()
            .with_order(order1)
            .with_order(order2)
            .build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));

        // Set system paused
        let mut pause_state = PauseState::new();
        pause_state.system_paused = true;
        batcher.set_pause_state(pause_state);

        let batch = batcher.get_batch(1, now).await.unwrap();

        // No valid orders when system is paused
        assert!(batch.valid_orders.is_empty());
        // No expired orders either (they remain pending)
        assert!(batch.expired_orders.is_empty());
    }

    #[tokio::test]
    async fn test_itp_grouping_correctness() {
        // AC: #5 - Orders grouped by ITP ID
        let itp1 = H256::random();
        let itp2 = H256::random();
        let now = 1500u64;

        let order1 = create_test_order(1, 3000, itp1);
        let order2 = create_test_order(2, 3000, itp1);
        let order3 = create_test_order(3, 3000, itp2);

        let mock_chain = MockChainBuilder::new()
            .with_order(order1.clone())
            .with_order(order2.clone())
            .with_order(order3.clone())
            .build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));
        let batch = batcher.get_batch(1, now).await.unwrap();

        // Should have 2 groups
        assert_eq!(batch.valid_orders.len(), 2);

        // ITP1 should have 2 orders
        assert_eq!(batch.valid_orders.get(&itp1).unwrap().len(), 2);

        // ITP2 should have 1 order
        assert_eq!(batch.valid_orders.get(&itp2).unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_get_batch_returns_cycle_number() {
        // AC: #6 - get_batch returns batch for cycle_number
        let itp_id = H256::random();
        let order = create_test_order(1, 3000, itp_id);

        let mock_chain = MockChainBuilder::new().with_order(order).build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));
        let batch = batcher.get_batch(42, 1500).await.unwrap();

        assert_eq!(batch.cycle_number, 42);
    }

    #[tokio::test]
    async fn test_empty_orders() {
        // Edge case: no pending orders
        let mock_chain = MockChainBuilder::new().build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));
        let batch = batcher.get_batch(1, 1500).await.unwrap();

        assert!(batch.valid_orders.is_empty());
        assert!(batch.expired_orders.is_empty());
    }

    #[tokio::test]
    async fn test_all_expired_orders() {
        // Edge case: all orders expired
        let itp_id = H256::random();
        let now = 5000u64;

        let order1 = create_test_order(1, 1000, itp_id);
        let order2 = create_test_order(2, 2000, itp_id);
        let order3 = create_test_order(3, 3000, itp_id);

        let mock_chain = MockChainBuilder::new()
            .with_order(order1)
            .with_order(order2)
            .with_order(order3)
            .build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));
        let batch = batcher.get_batch(1, now).await.unwrap();

        assert!(batch.valid_orders.is_empty());
        assert_eq!(batch.expired_orders.len(), 3);
    }

    #[tokio::test]
    async fn test_mixed_valid_and_invalid_orders() {
        // Edge case: mixed valid, expired, and paused orders
        let valid_itp = H256::random();
        let paused_itp = H256::random();
        let now = 2000u64;

        // Valid order
        let valid_order = create_test_order(1, 3000, valid_itp);
        // Expired order
        let expired_order = create_test_order(2, 1000, valid_itp);
        // Paused ITP order
        let paused_order = create_test_order(3, 3000, paused_itp);

        let mock_chain = MockChainBuilder::new()
            .with_order(valid_order.clone())
            .with_order(expired_order.clone())
            .with_order(paused_order.clone())
            .build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));

        // Set ITP as paused
        let mut pause_state = PauseState::new();
        pause_state.paused_itps.insert(paused_itp);
        batcher.set_pause_state(pause_state);

        let batch = batcher.get_batch(1, now).await.unwrap();

        // 1 valid order
        let total_valid: usize = batch.valid_orders.values().map(|v| v.len()).sum();
        assert_eq!(total_valid, 1);

        // 1 expired order
        assert_eq!(batch.expired_orders.len(), 1);
    }

    #[tokio::test]
    async fn test_batch_size_limit_truncates_to_max() {
        // AC: 200 pending → returns at most 50
        let itp_id = H256::random();
        let now = 1500u64;

        let mut builder = MockChainBuilder::new();
        for i in 0..200u64 {
            builder = builder.with_order(create_test_order(i + 1, 3000, itp_id));
        }
        let mock_chain = builder.build();

        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));
        // Default max_batch_size = 50
        let batch = batcher.get_batch(1, now).await.unwrap();

        let total_valid: usize = batch.valid_orders.values().map(|v| v.len()).sum();
        assert_eq!(total_valid, DEFAULT_MAX_BATCH_SIZE);
    }

    #[tokio::test]
    async fn test_custom_batch_size_limit() {
        let itp_id = H256::random();
        let now = 1500u64;

        let mut builder = MockChainBuilder::new();
        for i in 0..100u64 {
            builder = builder.with_order(create_test_order(i + 1, 3000, itp_id));
        }
        let mock_chain = builder.build();

        let mut batcher = OrderBatcher::with_max_batch_size(Arc::new(mock_chain), 10);
        let batch = batcher.get_batch(1, now).await.unwrap();

        let total_valid: usize = batch.valid_orders.values().map(|v| v.len()).sum();
        assert_eq!(total_valid, 10);
    }

    #[tokio::test]
    async fn test_chain_reader_error_propagation() {
        // Test that chain reader errors are propagated
        let mock_chain = MockChainBuilder::new().with_failure_rate(1.0).build();

        let batcher = OrderBatcher::new(Arc::new(mock_chain));
        let result = batcher.collect_orders().await;

        assert!(result.is_err());
    }

    #[test]
    fn test_expired_order_queue() {
        // Test ExpiredOrderQueue functionality
        let mut queue = ExpiredOrderQueue::new();
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);

        let order = create_test_order(1, 1000, H256::random());
        queue.queue_for_refund(order.clone());

        assert!(!queue.is_empty());
        assert_eq!(queue.len(), 1);
        assert_eq!(queue.orders()[0].id, order.id);

        let taken = queue.take_all();
        assert_eq!(taken.len(), 1);
        assert!(queue.is_empty());
    }

    #[test]
    fn test_validation_result_variants() {
        // Direct unit test for validate_order
        let itp_id = H256::random();
        let mock_chain = MockChainBuilder::new().build();
        let mut batcher = OrderBatcher::new(Arc::new(mock_chain));

        let order = create_test_order(1, 2000, itp_id);

        // Valid order
        assert_eq!(batcher.validate_order(&order, 1000), ValidationResult::Valid);

        // Expired order
        assert_eq!(
            batcher.validate_order(&order, 3000),
            ValidationResult::Expired
        );

        // ITP paused
        let mut pause_state = PauseState::new();
        pause_state.paused_itps.insert(itp_id);
        batcher.set_pause_state(pause_state);
        assert_eq!(
            batcher.validate_order(&order, 1000),
            ValidationResult::ItpPaused
        );

        // System paused (takes precedence)
        let mut pause_state = PauseState::new();
        pause_state.system_paused = true;
        batcher.set_pause_state(pause_state);
        assert_eq!(
            batcher.validate_order(&order, 1000),
            ValidationResult::SystemPaused
        );
    }
}
