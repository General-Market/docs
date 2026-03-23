//! MockChain implementation for testing chain interactions
//!
//! Provides an in-memory mock of the blockchain for testing oracle/AP components
//! without a real chain connection.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use rand::Rng;
use tokio::sync::{broadcast, RwLock};

use crate::error::Error;
use crate::traits::{ChainEvent, ChainReader, ChainWriter, EventFilter, EventStream, PendingRebalance};
use crate::types::{Fill, ITPCore, Oracle, LimitOrder, Price, TxHash};

use super::MockError;

/// Internal state for MockChain
#[derive(Debug, Default)]
struct MockChainState {
    /// Pending orders by ID
    orders: HashMap<U256, LimitOrder>,
    /// ITPs by ID
    itps: HashMap<H256, ITPCore>,
    /// Current prices by asset address
    prices: HashMap<Address, Price>,
    /// Registered oracles
    oracles: Vec<Oracle>,
    /// Cycle number tracker
    current_cycle: u64,
    /// Transaction counter for generating tx hashes
    tx_counter: u64,
    /// Filled orders (removed from pending)
    filled_orders: HashMap<U256, Fill>,
    /// Pending rebalances for testing
    pending_rebalances: Vec<PendingRebalance>,
}

/// Configuration for MockChain behavior
#[derive(Debug, Clone)]
pub struct MockChainConfig {
    /// Latency to add to all operations
    pub latency: Option<Duration>,
    /// Random failure rate (0.0-1.0)
    pub failure_rate: f64,
    /// Force next operation to fail with this error
    pub next_error: Option<MockError>,
    /// Event channel capacity
    pub event_capacity: usize,
    /// Random seed for reproducibility
    pub seed: Option<u64>,
}

impl Default for MockChainConfig {
    fn default() -> Self {
        Self {
            latency: None,
            failure_rate: 0.0,
            next_error: None,
            event_capacity: 1000,
            seed: None,
        }
    }
}

/// Mock implementation of blockchain reader/writer
///
/// Thread-safe with `Arc<RwLock<State>>` pattern.
/// Supports configurable latency and failure injection for testing error handling.
pub struct MockChain {
    state: Arc<RwLock<MockChainState>>,
    config: Arc<RwLock<MockChainConfig>>,
    event_tx: broadcast::Sender<ChainEvent>,
    consensus_paused: AtomicBool,
}

impl MockChain {
    /// Check for injected errors or random failures
    async fn maybe_fail(&self) -> Result<(), Error> {
        let mut config = self.config.write().await;

        // Check for forced next error
        if let Some(err) = config.next_error.take() {
            return Err(err.into());
        }

        // Check for random failure
        if config.failure_rate > 0.0 {
            let mut rng = rand::thread_rng();
            if rng.gen::<f64>() < config.failure_rate {
                return Err(MockError::SimulatedFailure(config.failure_rate).into());
            }
        }

        Ok(())
    }

    /// Apply configured latency
    async fn apply_latency(&self) {
        let config = self.config.read().await;
        if let Some(latency) = config.latency {
            tokio::time::sleep(latency).await;
        }
    }

    /// Set latency for all operations
    pub async fn set_latency(&self, latency: Duration) {
        self.config.write().await.latency = Some(latency);
    }

    /// Set random failure rate (0.0-1.0)
    pub async fn set_failure_rate(&self, rate: f64) {
        self.config.write().await.failure_rate = rate.clamp(0.0, 1.0);
    }

    /// Force the next operation to fail with a specific error
    pub async fn set_next_error(&self, error: MockError) {
        self.config.write().await.next_error = Some(error);
    }

    /// Set whether consensus is paused (test helper)
    pub fn set_consensus_paused(&self, paused: bool) {
        self.consensus_paused.store(paused, Ordering::Relaxed);
    }

    /// Simulate order submission (test helper)
    pub async fn simulate_order_submission(&self, order: LimitOrder) -> U256 {
        let order_id = order.id;
        self.state.write().await.orders.insert(order_id, order.clone());

        // Emit event
        let _ = self.event_tx.send(ChainEvent::OrderSubmitted {
            order_id: order_id.as_u64(),
            user: order.user.into(),
            itp_id: order.itp_id.into(),
            side: u8::from(order.side),
        });

        order_id
    }

    /// Simulate batch confirmation (test helper)
    pub async fn simulate_batch_confirmation(&self, cycle: u64, order_ids: &[U256]) {
        use crate::types::OrderStatus;

        let mut state = self.state.write().await;
        state.current_cycle = cycle;

        // Mark orders as batched
        for id in order_ids {
            if let Some(order) = state.orders.get_mut(id) {
                order.status = OrderStatus::Batched;
            }
        }

        // Emit event
        let _ = self.event_tx.send(ChainEvent::BatchConfirmed {
            cycle_number: cycle,
            order_count: order_ids.len() as u64,
        });
    }

    /// Simulate fill confirmation (test helper)
    pub async fn simulate_fill_confirmation(&self, _cycle: u64, fills: Vec<Fill>) {
        let mut state = self.state.write().await;

        for fill in fills {
            // Move from pending to filled
            state.orders.remove(&fill.order_id);
            state.filled_orders.insert(fill.order_id, fill.clone());

            // Emit event
            let _ = self.event_tx.send(ChainEvent::FillConfirmed {
                order_id: fill.order_id.as_u64(),
                fill_price: fill.fill_price,
                fill_amount: fill.fill_amount,
            });
        }
    }

    /// Simulate ITP creation (test helper)
    pub async fn simulate_itp_creation(&self, itp: ITPCore) -> H256 {
        let itp_id = H256::random();
        self.state.write().await.itps.insert(itp_id, itp.clone());

        // Emit event
        let _ = self.event_tx.send(ChainEvent::ITPCreated {
            itp_id: itp_id.into(),
            name: itp.name_string(),
            symbol: itp.symbol_string(),
        });

        itp_id
    }

    /// Get current cycle number
    pub async fn current_cycle(&self) -> u64 {
        self.state.read().await.current_cycle
    }

    /// Simulate a TradeRequest event (test helper for AP EventMonitor)
    pub fn simulate_trade_request(
        &self,
        cycle_number: u64,
        pair_id: [u8; 32],
        side: u8,
        amount: U256,
        limit_price: U256,
        block_number: u64,
    ) {
        let tx_hash = H256::random();
        let _ = self.event_tx.send(ChainEvent::TradeRequest {
            cycle_number,
            pair_id,
            side,
            amount,
            limit_price,
            block_number,
            tx_hash: tx_hash.into(),
            log_index: 0,
        });
    }

    /// Simulate a WithdrawalRequest event (test helper for AP EventMonitor)
    pub fn simulate_withdrawal_request(
        &self,
        itp_id: [u8; 32],
        amount: U256,
        destination: [u8; 20],
        block_number: u64,
    ) {
        let tx_hash = H256::random();
        let _ = self.event_tx.send(ChainEvent::WithdrawalRequest {
            itp_id,
            amount,
            destination,
            block_number,
            tx_hash: tx_hash.into(),
            log_index: 0,
        });
    }

    /// Get all orders (for test assertions)
    pub async fn get_all_orders(&self) -> Vec<LimitOrder> {
        self.state.read().await.orders.values().cloned().collect()
    }

    /// Get filled orders (for test assertions)
    pub async fn get_filled_orders(&self) -> Vec<Fill> {
        self.state.read().await.filled_orders.values().cloned().collect()
    }

    /// Check if an event matches the given filter criteria
    ///
    /// This enables MockChain to properly filter events like a real RPC would (H3 fix).
    fn event_matches_filter(
        event: &ChainEvent,
        filter_address: Option<[u8; 20]>,
        filter_topics: &[[u8; 32]],
        filter_from_block: Option<u64>,
    ) -> bool {
        // Get event's block number for from_block filter
        let event_block = match event {
            ChainEvent::TradeRequest { block_number, .. } => Some(*block_number),
            ChainEvent::WithdrawalRequest { block_number, .. } => Some(*block_number),
            _ => None,
        };

        // Check from_block filter
        if let (Some(from), Some(event_block)) = (filter_from_block, event_block) {
            if event_block < from {
                return false;
            }
        }

        // For MockChain, we don't have contract addresses in events,
        // so we skip address filtering (would need to enhance ChainEvent to include address)
        // In production, the real RPC handles this filtering.

        // Check topic filter - match event type to topic
        if !filter_topics.is_empty() {
            let event_topic = Self::get_event_topic(event);
            if let Some(topic) = event_topic {
                // Check if event's topic matches any of the filter topics
                if !filter_topics.contains(&topic) {
                    return false;
                }
            } else {
                // Events without topics (like OrderSubmitted, BatchConfirmed) pass through
                // This allows general event monitoring to work
            }
        }

        true
    }

    /// Get the topic hash for an event type
    ///
    /// Returns the keccak256 topic for TradeRequest and WithdrawalRequest events.
    fn get_event_topic(event: &ChainEvent) -> Option<[u8; 32]> {
        match event {
            ChainEvent::TradeRequest { .. } => {
                // keccak256("TradeRequest(uint256,bytes32,uint8,uint256,uint256)")
                Some([
                    0xce, 0x1d, 0x92, 0x00, 0x7c, 0x41, 0x7e, 0x02,
                    0x06, 0x17, 0x61, 0x86, 0x35, 0xf2, 0xcb, 0x18,
                    0x8a, 0x38, 0x3d, 0xe2, 0x63, 0x2e, 0x89, 0xe6,
                    0x71, 0x97, 0xcc, 0xff, 0x27, 0x76, 0x36, 0x0a,
                ])
            }
            ChainEvent::WithdrawalRequest { .. } => {
                // Placeholder topic (all zeros since event not yet defined)
                Some([0u8; 32])
            }
            // Other events don't have topic-based filtering
            _ => None,
        }
    }
}

#[async_trait]
impl ChainReader for MockChain {
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let state = self.state.read().await;
        Ok(state.orders.values().cloned().collect())
    }

    async fn get_itp(&self, itp_id: [u8; 32]) -> Result<ITPCore, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let state = self.state.read().await;
        let id = H256::from(itp_id);
        state
            .itps
            .get(&id)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("ITP not found: {:?}", id)))
    }

    async fn get_prices(&self) -> Result<Vec<Price>, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let state = self.state.read().await;
        Ok(state.prices.values().cloned().collect())
    }

    async fn get_oracle_registry(&self) -> Result<Vec<Oracle>, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let state = self.state.read().await;
        Ok(state.oracles.clone())
    }

    async fn subscribe_events(&self, filter: EventFilter) -> Result<EventStream, Error> {
        self.maybe_fail().await?;

        let mut rx = self.event_tx.subscribe();

        // Clone filter for use in async stream
        let filter_address = filter.address;
        let filter_topics = filter.topics;
        let filter_from_block = filter.from_block;

        let stream = async_stream::stream! {
            loop {
                match rx.recv().await {
                    Ok(event) => {
                        // Apply filter (H3 fix) - MockChain now respects EventFilter
                        if MockChain::event_matches_filter(&event, filter_address, &filter_topics, filter_from_block) {
                            yield Ok(event);
                        }
                    },
                    Err(broadcast::error::RecvError::Closed) => break,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn is_consensus_paused(&self) -> Result<bool, Error> {
        self.maybe_fail().await?;
        Ok(self.consensus_paused.load(Ordering::Relaxed))
    }
}

#[async_trait]
impl ChainWriter for MockChain {
    async fn submit_batch(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        _bls_signature: Vec<u8>,
        _reference_nonce: u64,
        _signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let mut state = self.state.write().await;
        state.current_cycle = cycle_number;
        state.tx_counter += 1;

        // Mark orders as batched
        for order_id in &order_ids {
            let id = U256::from(*order_id);
            if !state.orders.contains_key(&id) {
                return Err(Error::NotFound(format!("Order not found: {}", order_id)));
            }
        }

        // Emit event
        let _ = self.event_tx.send(ChainEvent::BatchConfirmed {
            cycle_number,
            order_count: order_ids.len() as u64,
        });

        // Generate deterministic tx hash
        let mut hash_bytes = [0u8; 32];
        hash_bytes[0..8].copy_from_slice(&state.tx_counter.to_be_bytes());
        hash_bytes[8..16].copy_from_slice(&cycle_number.to_be_bytes());

        Ok(H256::from(hash_bytes))
    }

    async fn confirm_fills(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        _bls_signature: Vec<u8>,
        _reference_nonce: u64,
        _signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let mut state = self.state.write().await;
        state.tx_counter += 1;

        // Process fills
        for fill in &fills {
            // Remove from pending orders
            if state.orders.remove(&fill.order_id).is_some() {
                // Add to filled orders
                state.filled_orders.insert(fill.order_id, fill.clone());

                // Emit event
                let _ = self.event_tx.send(ChainEvent::FillConfirmed {
                    order_id: fill.order_id.as_u64(),
                    fill_price: fill.fill_price,
                    fill_amount: fill.fill_amount,
                });
            }
        }

        // Generate deterministic tx hash
        let mut hash_bytes = [0u8; 32];
        hash_bytes[0..8].copy_from_slice(&state.tx_counter.to_be_bytes());
        hash_bytes[8..16].copy_from_slice(&cycle_number.to_be_bytes());

        Ok(H256::from(hash_bytes))
    }

    async fn submit_bridge(
        &self,
        dest_chain_id: u64,
        _amount: U256,
        _bls_signature: Vec<u8>,
        _reference_nonce: u64,
        _signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let mut state = self.state.write().await;
        state.tx_counter += 1;

        // Generate deterministic tx hash
        let mut hash_bytes = [0u8; 32];
        hash_bytes[0..8].copy_from_slice(&state.tx_counter.to_be_bytes());
        hash_bytes[8..16].copy_from_slice(&dest_chain_id.to_be_bytes());

        Ok(H256::from(hash_bytes))
    }

    async fn create_itp(
        &self,
        name: &str,
        symbol: &str,
        weights: &[U256],
        _assets: &[Address],
        _prices: &[U256],
        _bridge_nonce: U256,
    ) -> Result<H256, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let mut state = self.state.write().await;
        state.tx_counter += 1;

        // Generate deterministic ITP ID based on name, symbol, weights
        let mut data = Vec::new();
        data.extend_from_slice(name.as_bytes());
        data.extend_from_slice(symbol.as_bytes());
        for weight in weights {
            let mut weight_bytes = [0u8; 32];
            weight.to_big_endian(&mut weight_bytes);
            data.extend_from_slice(&weight_bytes);
        }
        let itp_id = H256::from_slice(&ethers::utils::keccak256(&data));

        Ok(itp_id)
    }

    async fn send_transaction(
        &self,
        _to: Address,
        calldata: Vec<u8>,
        _value: U256,
    ) -> Result<TxHash, Error> {
        self.maybe_fail().await?;
        self.apply_latency().await;

        let mut state = self.state.write().await;
        state.tx_counter += 1;

        // Generate deterministic tx hash based on calldata
        let mut hash_bytes = [0u8; 32];
        hash_bytes[0..8].copy_from_slice(&state.tx_counter.to_be_bytes());
        if calldata.len() >= 4 {
            hash_bytes[8..12].copy_from_slice(&calldata[0..4]);
        }

        Ok(H256::from(hash_bytes))
    }
}

impl Drop for MockChain {
    fn drop(&mut self) {
        // Broadcast channel will close automatically when all senders are dropped
        // Receivers will get ChannelClosed error
    }
}

/// Builder for MockChain
pub struct MockChainBuilder {
    orders: Vec<LimitOrder>,
    itps: Vec<(H256, ITPCore)>,
    prices: Vec<Price>,
    oracles: Vec<Oracle>,
    config: MockChainConfig,
}

impl MockChainBuilder {
    /// Create a new builder with defaults
    pub fn new() -> Self {
        Self {
            orders: Vec::new(),
            itps: Vec::new(),
            prices: Vec::new(),
            oracles: Vec::new(),
            config: MockChainConfig::default(),
        }
    }

    /// Add an initial order
    pub fn with_order(mut self, order: LimitOrder) -> Self {
        self.orders.push(order);
        self
    }

    /// Add an initial ITP
    pub fn with_itp(mut self, itp_id: H256, itp: ITPCore) -> Self {
        self.itps.push((itp_id, itp));
        self
    }

    /// Add initial prices
    pub fn with_prices(mut self, prices: Vec<Price>) -> Self {
        self.prices.extend(prices);
        self
    }

    /// Set oracle registry
    pub fn with_oracles(mut self, oracles: Vec<Oracle>) -> Self {
        self.oracles = oracles;
        self
    }

    /// Set operation latency
    pub fn with_latency(mut self, latency: Duration) -> Self {
        self.config.latency = Some(latency);
        self
    }

    /// Set random failure rate
    pub fn with_failure_rate(mut self, rate: f64) -> Self {
        self.config.failure_rate = rate.clamp(0.0, 1.0);
        self
    }

    /// Set event channel capacity
    pub fn with_event_capacity(mut self, capacity: usize) -> Self {
        self.config.event_capacity = capacity;
        self
    }

    /// Build the MockChain
    pub fn build(self) -> MockChain {
        let mut state = MockChainState::default();

        // Populate initial state
        for order in self.orders {
            state.orders.insert(order.id, order);
        }
        for (id, itp) in self.itps {
            state.itps.insert(id, itp);
        }
        for price in self.prices {
            state.prices.insert(price.asset, price);
        }
        state.oracles = self.oracles;

        let (event_tx, _) = broadcast::channel(self.config.event_capacity);

        MockChain {
            state: Arc::new(RwLock::new(state)),
            config: Arc::new(RwLock::new(self.config)),
            event_tx,
            consensus_paused: AtomicBool::new(false),
        }
    }
}

impl Default for MockChainBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{OrderStatus, Side};

    fn create_test_order(id: u64) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: Address::random(),
            pair_id: H256::random(),
            side: Side::Buy,
            amount: U256::from(1000u64) * U256::exp10(18),
            limit_price: U256::from(100u64) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(u64::MAX),
            itp_id: H256::random(),
            timestamp: U256::from(1234567890u64),
            status: OrderStatus::Pending,
        }
    }

    #[tokio::test]
    async fn test_happy_path_order_lifecycle() {
        let order = create_test_order(1);
        let mock = MockChainBuilder::new().with_order(order.clone()).build();

        // Read pending orders
        let orders = mock.get_pending_orders().await.unwrap();
        assert_eq!(orders.len(), 1);
        assert_eq!(orders[0].id, order.id);

        // Submit batch
        let tx = mock.submit_batch(1, vec![1], vec![0u8; 96]).await.unwrap();
        assert_ne!(tx, H256::zero());

        // Confirm fill
        let fill = Fill {
            order_id: order.id,
            fill_price: order.limit_price,
            fill_amount: order.amount,
            cycle_number: U256::from(1),
            tx_hash: H256::random(),
        };
        let tx = mock.confirm_fills(1, vec![fill], vec![0u8; 96]).await.unwrap();
        assert_ne!(tx, H256::zero());

        // Order should be removed from pending
        let orders = mock.get_pending_orders().await.unwrap();
        assert!(orders.is_empty());

        // Filled order should be tracked
        let filled = mock.get_filled_orders().await;
        assert_eq!(filled.len(), 1);
    }

    #[tokio::test]
    async fn test_empty_state_queries() {
        let mock = MockChainBuilder::new().build();

        let orders = mock.get_pending_orders().await.unwrap();
        assert!(orders.is_empty());

        let prices = mock.get_prices().await.unwrap();
        assert!(prices.is_empty());

        let oracles = mock.get_oracle_registry().await.unwrap();
        assert!(oracles.is_empty());
    }

    #[tokio::test]
    async fn test_max_u256_values() {
        let mut order = create_test_order(1);
        order.amount = U256::MAX;
        order.limit_price = U256::MAX;

        let mock = MockChainBuilder::new().with_order(order.clone()).build();

        let orders = mock.get_pending_orders().await.unwrap();
        assert_eq!(orders[0].amount, U256::MAX);
        assert_eq!(orders[0].limit_price, U256::MAX);
    }

    #[tokio::test]
    async fn test_failure_rate_triggers_errors() {
        let mock = MockChainBuilder::new().with_failure_rate(1.0).build();

        // With 100% failure rate, should always fail
        let result = mock.get_pending_orders().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_concurrent_reads_writes() {
        let mock = Arc::new(MockChainBuilder::new().build());

        let mut handles = vec![];

        // Spawn multiple concurrent readers
        for i in 0..10 {
            let mock_clone = mock.clone();
            handles.push(tokio::spawn(async move {
                let order = create_test_order(i);
                mock_clone.simulate_order_submission(order).await;
                mock_clone.get_pending_orders().await.unwrap()
            }));
        }

        // Wait for all to complete
        let results: Vec<_> = futures::future::join_all(handles).await;

        // Verify no panics occurred
        for result in results {
            assert!(result.is_ok());
        }

        // Final state should have all orders
        let final_orders = mock.get_pending_orders().await.unwrap();
        assert_eq!(final_orders.len(), 10);
    }
}
