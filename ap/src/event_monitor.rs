//! Event Monitor for AP blockchain event subscription
//!
//! Monitors TradeRequest and WithdrawalRequest events from Index.sol,
//! handles chain reorgs, and queues events for downstream processing.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;

use common::traits::{ChainReader, EventFilter};
use futures::StreamExt;
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::block_tracker::BlockTracker;
use crate::error::APError;
use crate::event_queue::{APEvent, EventQueue};
use crate::event_types::{AssetTradeRequestEvent, TradeRequestEvent, WithdrawalRequestEvent};

/// Default number of block confirmations before processing
pub const DEFAULT_CONFIRMATION_DEPTH: u64 = 3;

/// Configuration for EventMonitor
#[derive(Debug, Clone)]
pub struct EventMonitorConfig {
    /// Index.sol contract address
    pub index_contract: [u8; 20],
    /// Number of confirmations required (safe block depth)
    pub confirmation_depth: u64,
    /// Chain ID for validation
    pub chain_id: u64,
    /// Path to block tracker state file
    pub state_file: PathBuf,
    /// Event queue capacity
    pub queue_capacity: usize,
    /// Starting block (if no saved state)
    pub start_block: Option<u64>,
}

impl Default for EventMonitorConfig {
    fn default() -> Self {
        Self {
            index_contract: [0u8; 20],
            confirmation_depth: DEFAULT_CONFIRMATION_DEPTH,
            chain_id: 111222333, // Index L3 chain ID
            state_file: PathBuf::from("data/ap_block_tracker.json"),
            queue_capacity: 10_000,
            start_block: None,
        }
    }
}

/// Metrics for EventMonitor
#[derive(Debug, Default, Clone)]
pub struct EventMonitorMetrics {
    /// Total trade request events received
    pub trade_requests_received: u64,
    /// Total asset trade request events received
    pub asset_trade_requests_received: u64,
    /// Total withdrawal request events received
    pub withdrawal_requests_received: u64,
    /// Number of reorgs detected
    pub reorgs_detected: u64,
    /// Number of duplicate events filtered
    pub duplicates_filtered: u64,
    /// Current block being processed
    pub current_block: u64,
    /// Last safe block (current - confirmation_depth)
    pub safe_block: u64,
}

/// Block info for reorg detection
#[derive(Debug, Clone)]
struct BlockInfo {
    /// Block number
    pub number: u64,
    /// Block hash (if available from chain events)
    pub hash: Option<[u8; 32]>,
}

/// Event Monitor for subscribing to and processing blockchain events
pub struct EventMonitor<R: ChainReader> {
    chain_reader: Arc<R>,
    config: EventMonitorConfig,
    block_tracker: BlockTracker,
    event_queue: EventQueue,
    /// Set of event IDs we've already processed (for deduplication)
    processed_events: Arc<RwLock<HashSet<String>>>,
    metrics: Arc<RwLock<EventMonitorMetrics>>,
    /// Recent block info for reorg detection (block_number -> BlockInfo)
    /// We keep track of recent blocks to detect if the chain has reorganized
    recent_blocks: Arc<RwLock<HashMap<u64, BlockInfo>>>,
    /// Maximum number of recent blocks to track for reorg detection
    max_recent_blocks: usize,
}

impl<R: ChainReader + 'static> EventMonitor<R> {
    /// Create a new EventMonitor
    pub fn new(chain_reader: Arc<R>, config: EventMonitorConfig) -> Self {
        let block_tracker = BlockTracker::with_state_file(
            config.chain_id,
            config.state_file.clone(),
        );
        let event_queue = EventQueue::with_capacity(config.queue_capacity);
        // Keep enough blocks for reorg detection (at least 2x confirmation depth)
        let max_recent_blocks = (config.confirmation_depth * 3).max(100) as usize;

        Self {
            chain_reader,
            config,
            block_tracker,
            event_queue,
            processed_events: Arc::new(RwLock::new(HashSet::new())),
            metrics: Arc::new(RwLock::new(EventMonitorMetrics::default())),
            recent_blocks: Arc::new(RwLock::new(HashMap::new())),
            max_recent_blocks,
        }
    }

    /// Initialize the event monitor (load persisted state)
    pub fn init(&mut self) -> Result<(), APError> {
        self.block_tracker.load()?;

        // If no persisted state, apply configured start block
        if self.block_tracker.get_start_block() == 0 {
            if let Some(start) = self.config.start_block {
                if start > 0 {
                    self.block_tracker.update(start)?;
                }
            }
        }

        let start_block = self.block_tracker.get_start_block();

        info!(
            start_block,
            contract = ?hex::encode(self.config.index_contract),
            confirmation_depth = self.config.confirmation_depth,
            "EventMonitor initialized"
        );

        Ok(())
    }

    /// Get the event receiver for downstream consumers
    pub fn take_event_receiver(&mut self) -> Option<mpsc::Receiver<APEvent>> {
        self.event_queue.take_receiver()
    }

    /// Get a clone of the event sender
    pub fn event_sender(&self) -> mpsc::Sender<APEvent> {
        self.event_queue.sender()
    }

    /// Get current metrics
    pub async fn metrics(&self) -> EventMonitorMetrics {
        self.metrics.read().await.clone()
    }

    /// Calculate the safe block (current - confirmation_depth)
    fn calculate_safe_block(&self, current_block: u64) -> u64 {
        current_block.saturating_sub(self.config.confirmation_depth)
    }

    /// Check if an event has already been processed
    async fn is_duplicate(&self, event_id: &str) -> bool {
        self.processed_events.read().await.contains(event_id)
    }

    /// Mark an event as processed
    async fn mark_processed(&self, event_id: String) {
        self.processed_events.write().await.insert(event_id);
    }

    /// Clean up processed events set, retaining events from recent blocks
    ///
    /// Events from blocks before safe_block are finalized and can be evicted
    /// from the deduplication set.
    async fn cleanup_processed_events(&self, safe_block: u64) {
        let mut processed = self.processed_events.write().await;

        // Cleanup more aggressively - at 10k entries or every 1000 blocks
        // This prevents unbounded memory growth (M1 fix)
        if processed.len() > 10_000 {
            let old_len = processed.len();
            // Retain events from blocks >= safe_block (they might still reorg)
            // Event ID format: "{block_number}:{tx_hash}:{log_index}"
            processed.retain(|event_id| {
                event_id
                    .split(':')
                    .next()
                    .and_then(|block_str| block_str.parse::<u64>().ok())
                    .map(|block| block >= safe_block)
                    .unwrap_or(true) // Keep entries we can't parse
            });
            debug!(
                old_size = old_len,
                new_size = processed.len(),
                safe_block,
                "Cleaned up processed events older than safe block"
            );
        }

        // Also cleanup recent_blocks map
        let mut recent = self.recent_blocks.write().await;
        if recent.len() > self.max_recent_blocks {
            // Remove blocks older than safe_block
            recent.retain(|&block_num, _| block_num >= safe_block);
        }
    }

    /// Track a block for reorg detection
    async fn track_block(&self, block_number: u64, tx_hash: Option<[u8; 32]>) {
        let mut recent = self.recent_blocks.write().await;

        // Check for potential reorg: if we already have this block with different data
        if let Some(existing) = recent.get(&block_number) {
            if let (Some(existing_hash), Some(new_hash)) = (existing.hash, tx_hash) {
                if existing_hash != new_hash {
                    // Different tx_hash for same block number could indicate reorg
                    // (though this is a heuristic - proper reorg detection needs block hashes)
                    debug!(
                        block_number,
                        "Potential reorg detected: different tx seen for same block"
                    );
                }
            }
        }

        recent.insert(block_number, BlockInfo {
            number: block_number,
            hash: tx_hash,
        });

        // Prune old entries if needed
        if recent.len() > self.max_recent_blocks {
            let safe_block = self.calculate_safe_block(block_number);
            recent.retain(|&num, _| num >= safe_block);
        }
    }

    /// Detect if a reorg has occurred based on block number
    ///
    /// Returns true if we should trigger reorg handling
    async fn detect_reorg(&self, event_block: u64) -> bool {
        let last_processed = self.block_tracker.last_processed_block();

        // If we receive an event from a block that's significantly behind
        // our last processed block (more than confirmation_depth),
        // this could indicate a reorg
        if event_block > 0 && last_processed > 0 {
            // If event block is behind what we've processed but within reorg window
            if event_block < last_processed &&
               last_processed - event_block <= self.config.confirmation_depth * 2 {
                return true;
            }
        }

        false
    }

    /// Create event filter for TradeRequest events
    fn create_trade_request_filter(&self, from_block: u64) -> EventFilter {
        EventFilter {
            address: Some(self.config.index_contract),
            topics: vec![TradeRequestEvent::TOPIC],
            from_block: Some(from_block),
            to_block: None,
        }
    }

    /// Create event filter for WithdrawalRequest events
    fn create_withdrawal_filter(&self, from_block: u64) -> EventFilter {
        EventFilter {
            address: Some(self.config.index_contract),
            topics: vec![WithdrawalRequestEvent::TOPIC],
            from_block: Some(from_block),
            to_block: None,
        }
    }

    /// Create combined event filter for TradeRequest, AssetTradeRequest, and WithdrawalRequest events
    fn create_combined_filter(&self, from_block: u64) -> EventFilter {
        let mut topics = vec![TradeRequestEvent::TOPIC, AssetTradeRequestEvent::topic()];
        // Include WithdrawalRequest filter only when event is defined (non-zero topic)
        if WithdrawalRequestEvent::TOPIC != [0u8; 32] {
            topics.push(WithdrawalRequestEvent::TOPIC);
        }
        EventFilter {
            address: Some(self.config.index_contract),
            topics,
            from_block: Some(from_block),
            to_block: None,
        }
    }

    /// Handle a potential chain reorganization
    ///
    /// Called when we detect events from blocks we thought we'd already processed.
    async fn handle_reorg(&mut self, reorg_block: u64) -> Result<(), APError> {
        warn!(
            reorg_block,
            last_processed = self.block_tracker.last_processed_block(),
            "Chain reorg detected"
        );

        // Update metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.reorgs_detected += 1;
        }

        // Reset block tracker to re-process from the reorg point
        self.block_tracker.reset_to(reorg_block)?;

        // Clear processed events that might now be invalid
        // In a more sophisticated implementation, we'd only clear events
        // from the reorg'd blocks
        self.processed_events.write().await.clear();

        info!(
            new_start = self.block_tracker.get_start_block(),
            "Reset block tracker for reorg handling"
        );

        Ok(())
    }

    /// Process a single TradeRequest event
    async fn process_trade_request(
        &self,
        event: TradeRequestEvent,
    ) -> Result<(), APError> {
        let event_id = event.event_id();

        // Check for duplicate
        if self.is_duplicate(&event_id).await {
            let mut metrics = self.metrics.write().await;
            metrics.duplicates_filtered += 1;
            debug!(event_id, "Filtered duplicate trade request");
            return Ok(());
        }

        // Queue the event
        self.event_queue
            .send(APEvent::TradeRequest(event.clone()))
            .await?;

        // Mark as processed
        self.mark_processed(event_id).await;

        // Update metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.trade_requests_received += 1;
            metrics.current_block = event.block_number;
        }

        info!(
            cycle = event.cycle_number,
            pair_id = ?event.pair_id,
            side = ?event.side,
            amount = %event.amount,
            block = event.block_number,
            "Received TradeRequest event"
        );

        Ok(())
    }

    /// Process a single AssetTradeRequest event
    async fn process_asset_trade_request(
        &self,
        event: AssetTradeRequestEvent,
    ) -> Result<(), APError> {
        let event_id = event.event_id();

        if self.is_duplicate(&event_id).await {
            let mut metrics = self.metrics.write().await;
            metrics.duplicates_filtered += 1;
            debug!(event_id, "Filtered duplicate asset trade request");
            return Ok(());
        }

        self.event_queue
            .send(APEvent::AssetTradeRequest(event.clone()))
            .await?;

        self.mark_processed(event_id).await;

        {
            let mut metrics = self.metrics.write().await;
            metrics.asset_trade_requests_received += 1;
            metrics.current_block = event.block_number;
        }

        info!(
            cycle = event.cycle_number,
            asset = ?hex::encode(event.asset),
            side = event.side,
            usdc_amount = %event.usdc_amount,
            block = event.block_number,
            "Received AssetTradeRequest event"
        );

        Ok(())
    }

    /// Process a single WithdrawalRequest event
    async fn process_withdrawal_request(
        &self,
        event: WithdrawalRequestEvent,
    ) -> Result<(), APError> {
        let event_id = event.event_id();

        // Check for duplicate
        if self.is_duplicate(&event_id).await {
            let mut metrics = self.metrics.write().await;
            metrics.duplicates_filtered += 1;
            debug!(event_id, "Filtered duplicate withdrawal request");
            return Ok(());
        }

        // Queue the event
        self.event_queue
            .send(APEvent::WithdrawalRequest(event.clone()))
            .await?;

        // Mark as processed
        self.mark_processed(event_id).await;

        // Update metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.withdrawal_requests_received += 1;
            metrics.current_block = event.block_number;
        }

        info!(
            itp_id = ?event.itp_id,
            amount = %event.amount,
            block = event.block_number,
            "Received WithdrawalRequest event"
        );

        Ok(())
    }

    /// Subscribe to TradeRequest events and process them
    ///
    /// This is a long-running task that should be spawned in tokio.
    ///
    /// **Deprecated**: Use `run()` instead, which handles both TradeRequest and
    /// WithdrawalRequest events in a single stream. This method is kept for
    /// backward compatibility but will be removed in a future version.
    #[deprecated(since = "0.2.0", note = "Use run() instead which handles all event types")]
    pub async fn subscribe_trade_requests(&mut self) -> Result<(), APError> {
        let from_block = self.block_tracker.get_start_block();
        let filter = self.create_trade_request_filter(from_block);

        info!(from_block, "Subscribing to TradeRequest events");

        let mut event_stream = self
            .chain_reader
            .subscribe_events(filter)
            .await
            .map_err(|e| APError::Subscription(e.to_string()))?;

        while let Some(result) = event_stream.next().await {
            match result {
                Ok(chain_event) => {
                    if let Err(e) = self.handle_chain_event(chain_event).await {
                        error!(code = "E008", error = %e, "Error processing trade request chain event");
                    }
                }
                Err(e) => {
                    error!(code = "E008", error = %e, "Error receiving chain event");
                }
            }
        }

        warn!(code = "E008", "TradeRequest event stream ended");
        Ok(())
    }

    /// Subscribe to WithdrawalRequest events and process them
    ///
    /// Note: Currently a placeholder as WithdrawalRequest is not yet defined.
    ///
    /// **Deprecated**: Use `run()` instead, which handles both TradeRequest and
    /// WithdrawalRequest events in a single stream. This method is kept for
    /// backward compatibility but will be removed in a future version.
    #[deprecated(since = "0.2.0", note = "Use run() instead which handles all event types")]
    pub async fn subscribe_withdrawals(&mut self) -> Result<(), APError> {
        let from_block = self.block_tracker.get_start_block();
        let filter = self.create_withdrawal_filter(from_block);

        info!(from_block, "Subscribing to WithdrawalRequest events (placeholder)");

        let mut event_stream = self
            .chain_reader
            .subscribe_events(filter)
            .await
            .map_err(|e| APError::Subscription(e.to_string()))?;

        while let Some(result) = event_stream.next().await {
            match result {
                Ok(chain_event) => {
                    if let Err(e) = self.handle_chain_event(chain_event).await {
                        error!(code = "E008", error = %e, "Error processing withdrawal chain event");
                    }
                }
                Err(e) => {
                    error!(code = "E008", error = %e, "Error receiving withdrawal event");
                }
            }
        }

        warn!(code = "E008", "WithdrawalRequest event stream ended");
        Ok(())
    }

    /// Run the event monitor (main loop)
    ///
    /// Processes both TradeRequest and WithdrawalRequest events from the chain.
    ///
    /// Note: Takes `&mut self` to allow the monitor to be restarted or have
    /// methods called after run completes (H1 fix).
    pub async fn run(&mut self) -> Result<(), APError> {
        self.init()?;

        info!("Starting EventMonitor main loop");

        let from_block = self.block_tracker.get_start_block();
        let filter = self.create_combined_filter(from_block);

        let mut event_stream = self
            .chain_reader
            .subscribe_events(filter)
            .await
            .map_err(|e| APError::Subscription(e.to_string()))?;

        let mut events_since_cleanup = 0u64;

        while let Some(result) = event_stream.next().await {
            match result {
                Ok(chain_event) => {
                    // Extract block number for reorg detection before processing
                    let event_block = Self::extract_block_number(&chain_event);

                    // Check for reorg (H2/H4 fix)
                    if let Some(block) = event_block {
                        if self.detect_reorg(block).await {
                            warn!(
                                code = "INFRA-001",
                                event_block = block,
                                last_processed = self.block_tracker.last_processed_block(),
                                "Reorg detected, triggering reorg handling"
                            );
                            if let Err(e) = self.handle_reorg(block).await {
                                error!(code = "INFRA-001", error = %e, "Error handling reorg");
                            }
                        }
                    }

                    if let Err(e) = self.handle_chain_event(chain_event).await {
                        error!(code = "E008", error = %e, "Error processing chain event");
                    }
                }
                Err(e) => {
                    error!(code = "E008", error = %e, "Error in event stream");
                }
            }

            events_since_cleanup += 1;

            // Periodic cleanup of processed events set (every 100 events)
            if events_since_cleanup >= 100 {
                let safe = self.calculate_safe_block(self.block_tracker.last_processed_block());
                self.cleanup_processed_events(safe).await;
                events_since_cleanup = 0;
            }
        }

        info!("EventMonitor stopped");
        Ok(())
    }

    /// Extract block number from a chain event
    fn extract_block_number(event: &common::traits::ChainEvent) -> Option<u64> {
        use common::traits::ChainEvent;
        match event {
            ChainEvent::TradeRequest { block_number, .. } => Some(*block_number),
            ChainEvent::AssetTradeRequest { block_number, .. } => Some(*block_number),
            ChainEvent::WithdrawalRequest { block_number, .. } => Some(*block_number),
            _ => None,
        }
    }

    /// Handle a chain event by converting to APEvent and processing
    async fn handle_chain_event(
        &mut self,
        chain_event: common::traits::ChainEvent,
    ) -> Result<(), APError> {
        use common::traits::ChainEvent;

        match chain_event {
            ChainEvent::TradeRequest {
                cycle_number,
                pair_id,
                side,
                amount,
                limit_price,
                block_number,
                tx_hash,
                log_index,
            } => {
                // Track block for reorg detection
                self.track_block(block_number, Some(tx_hash)).await;

                let trade_event = TradeRequestEvent::from_chain_fields(
                    cycle_number, pair_id, side, amount, limit_price,
                    block_number, tx_hash, log_index,
                )?;

                self.process_trade_request(trade_event).await?;

                // Update block tracker and safe block metric
                self.block_tracker.update(block_number)?;
                {
                    let safe = self.calculate_safe_block(block_number);
                    let mut metrics = self.metrics.write().await;
                    metrics.safe_block = safe;
                }
            }
            ChainEvent::AssetTradeRequest {
                cycle_number,
                asset,
                side,
                usdc_amount,
                price,
                quote_token,
                block_number,
                tx_hash,
                log_index,
            } => {
                self.track_block(block_number, Some(tx_hash)).await;

                let asset_event = AssetTradeRequestEvent::from_chain_fields(
                    cycle_number, asset, side, usdc_amount, price, quote_token,
                    block_number, tx_hash, log_index,
                );

                self.process_asset_trade_request(asset_event).await?;

                self.block_tracker.update(block_number)?;
                {
                    let safe = self.calculate_safe_block(block_number);
                    let mut metrics = self.metrics.write().await;
                    metrics.safe_block = safe;
                }
            }
            ChainEvent::WithdrawalRequest {
                itp_id,
                amount,
                destination,
                block_number,
                tx_hash,
                log_index,
            } => {
                // Track block for reorg detection
                self.track_block(block_number, Some(tx_hash)).await;

                let withdrawal_event = WithdrawalRequestEvent::from_chain_fields(
                    itp_id, amount, destination, block_number, tx_hash, log_index,
                );

                self.process_withdrawal_request(withdrawal_event).await?;

                // Update block tracker and safe block metric
                self.block_tracker.update(block_number)?;
                {
                    let safe = self.calculate_safe_block(block_number);
                    let mut metrics = self.metrics.write().await;
                    metrics.safe_block = safe;
                }
            }
            // Other chain events are not relevant to AP EventMonitor
            other => {
                debug!(?other, "Ignoring non-AP chain event");
            }
        }

        Ok(())
    }

    /// Update block tracker to a new block
    pub fn update_block(&mut self, block_number: u64) -> Result<(), APError> {
        self.block_tracker.update(block_number)
    }

    /// Get the current start block
    pub fn get_start_block(&self) -> u64 {
        self.block_tracker.get_start_block()
    }
}

/// Builder for EventMonitor
pub struct EventMonitorBuilder<R: ChainReader> {
    chain_reader: Option<Arc<R>>,
    config: EventMonitorConfig,
}

impl<R: ChainReader + 'static> EventMonitorBuilder<R> {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            chain_reader: None,
            config: EventMonitorConfig::default(),
        }
    }

    /// Set the chain reader
    pub fn with_chain_reader(mut self, reader: Arc<R>) -> Self {
        self.chain_reader = Some(reader);
        self
    }

    /// Set the Index contract address
    pub fn with_index_contract(mut self, address: [u8; 20]) -> Self {
        self.config.index_contract = address;
        self
    }

    /// Set the confirmation depth
    pub fn with_confirmation_depth(mut self, depth: u64) -> Self {
        self.config.confirmation_depth = depth;
        self
    }

    /// Set the chain ID
    pub fn with_chain_id(mut self, chain_id: u64) -> Self {
        self.config.chain_id = chain_id;
        self
    }

    /// Set the state file path
    pub fn with_state_file(mut self, path: PathBuf) -> Self {
        self.config.state_file = path;
        self
    }

    /// Set the queue capacity
    pub fn with_queue_capacity(mut self, capacity: usize) -> Self {
        self.config.queue_capacity = capacity;
        self
    }

    /// Set the starting block
    pub fn with_start_block(mut self, block: u64) -> Self {
        self.config.start_block = Some(block);
        self
    }

    /// Build the EventMonitor
    pub fn build(self) -> Result<EventMonitor<R>, APError> {
        let chain_reader = self
            .chain_reader
            .ok_or_else(|| APError::Subscription("ChainReader not provided".to_string()))?;

        Ok(EventMonitor::new(chain_reader, self.config))
    }
}

impl<R: ChainReader + 'static> Default for EventMonitorBuilder<R> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::mocks::MockChainBuilder;
    use tempfile::{tempdir, TempDir};

    /// Test helper that returns TempDir to keep it alive for the test duration
    fn create_test_monitor() -> (EventMonitor<common::mocks::MockChain>, TempDir) {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("test_block_tracker.json");

        let config = EventMonitorConfig {
            index_contract: [1u8; 20],
            confirmation_depth: 3,
            chain_id: 111222333,
            state_file,
            queue_capacity: 100,
            start_block: Some(0),
        };

        (EventMonitor::new(mock_chain, config), dir)
    }

    #[tokio::test]
    async fn test_monitor_initialization() {
        let (mut monitor, _dir) = create_test_monitor();
        assert!(monitor.init().is_ok());
        assert_eq!(monitor.get_start_block(), 0);
    }

    #[tokio::test]
    async fn test_block_tracker_update() {
        let (mut monitor, _dir) = create_test_monitor();
        monitor.init().unwrap();

        monitor.update_block(100).unwrap();
        assert_eq!(monitor.get_start_block(), 100);
    }

    #[tokio::test]
    async fn test_event_receiver() {
        let (mut monitor, _dir) = create_test_monitor();
        let receiver = monitor.take_event_receiver();
        assert!(receiver.is_some());

        // Second call should return None
        let receiver2 = monitor.take_event_receiver();
        assert!(receiver2.is_none());
    }

    #[tokio::test]
    async fn test_safe_block_calculation() {
        let (monitor, _dir) = create_test_monitor();

        assert_eq!(monitor.calculate_safe_block(100), 97);
        assert_eq!(monitor.calculate_safe_block(3), 0);
        assert_eq!(monitor.calculate_safe_block(0), 0);
    }

    #[tokio::test]
    async fn test_duplicate_detection() {
        let (monitor, _dir) = create_test_monitor();

        assert!(!monitor.is_duplicate("event1").await);

        monitor.mark_processed("event1".to_string()).await;

        assert!(monitor.is_duplicate("event1").await);
        assert!(!monitor.is_duplicate("event2").await);
    }

    #[tokio::test]
    async fn test_metrics_initialization() {
        let (monitor, _dir) = create_test_monitor();
        let metrics = monitor.metrics().await;

        assert_eq!(metrics.trade_requests_received, 0);
        assert_eq!(metrics.withdrawal_requests_received, 0);
        assert_eq!(metrics.reorgs_detected, 0);
    }

    #[tokio::test]
    async fn test_builder_pattern() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("builder_test.json");

        let monitor = EventMonitorBuilder::new()
            .with_chain_reader(mock_chain)
            .with_index_contract([2u8; 20])
            .with_confirmation_depth(5)
            .with_chain_id(12345)
            .with_state_file(state_file)
            .with_queue_capacity(500)
            .with_start_block(1000)
            .build()
            .unwrap();

        assert_eq!(monitor.config.index_contract, [2u8; 20]);
        assert_eq!(monitor.config.confirmation_depth, 5);
        assert_eq!(monitor.config.chain_id, 12345);
        drop(dir); // Explicitly drop to clean up
    }

    #[tokio::test]
    async fn test_builder_missing_chain_reader() {
        let result = EventMonitorBuilder::<common::mocks::MockChain>::new().build();
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_handle_trade_request_event() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("handle_event_test.json");

        let config = EventMonitorConfig {
            index_contract: [1u8; 20],
            confirmation_depth: 3,
            chain_id: 111222333,
            state_file,
            queue_capacity: 100,
            start_block: Some(0),
        };

        let mut monitor = EventMonitor::new(mock_chain, config);
        monitor.init().unwrap();

        // Take the receiver to consume events
        let mut receiver = monitor.take_event_receiver().unwrap();

        // Create a TradeRequest chain event
        let chain_event = common::traits::ChainEvent::TradeRequest {
            cycle_number: 42,
            pair_id: [1u8; 32],
            side: 0, // Buy
            amount: ethers::types::U256::from(1000u64),
            limit_price: ethers::types::U256::from(50u64),
            block_number: 100,
            tx_hash: [2u8; 32],
            log_index: 5,
        };

        // Process the event
        monitor.handle_chain_event(chain_event).await.unwrap();

        // Verify event was queued
        let received = receiver.try_recv();
        assert!(received.is_ok());

        if let Ok(APEvent::TradeRequest(trade)) = received {
            assert_eq!(trade.cycle_number, 42);
            assert_eq!(trade.block_number, 100);
            assert_eq!(trade.log_index, 5);
        } else {
            panic!("Expected TradeRequest event");
        }

        // Verify metrics were updated (including safe_block)
        let metrics = monitor.metrics().await;
        assert_eq!(metrics.trade_requests_received, 1);
        assert_eq!(metrics.safe_block, 97); // 100 - 3 confirmation depth

        // Verify block tracker was updated
        assert_eq!(monitor.get_start_block(), 100);

        drop(dir);
    }

    #[tokio::test]
    async fn test_handle_withdrawal_request_event() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("withdrawal_test.json");

        let config = EventMonitorConfig {
            index_contract: [1u8; 20],
            confirmation_depth: 3,
            chain_id: 111222333,
            state_file,
            queue_capacity: 100,
            start_block: Some(0),
        };

        let mut monitor = EventMonitor::new(mock_chain, config);
        monitor.init().unwrap();

        let mut receiver = monitor.take_event_receiver().unwrap();

        let chain_event = common::traits::ChainEvent::WithdrawalRequest {
            itp_id: [3u8; 32],
            amount: ethers::types::U256::from(500u64),
            destination: [4u8; 20],
            block_number: 200,
            tx_hash: [5u8; 32],
            log_index: 10,
        };

        monitor.handle_chain_event(chain_event).await.unwrap();

        let received = receiver.try_recv();
        assert!(received.is_ok());

        if let Ok(APEvent::WithdrawalRequest(withdrawal)) = received {
            assert_eq!(withdrawal.block_number, 200);
            assert_eq!(withdrawal.log_index, 10);
        } else {
            panic!("Expected WithdrawalRequest event");
        }

        let metrics = monitor.metrics().await;
        assert_eq!(metrics.withdrawal_requests_received, 1);
        assert_eq!(metrics.safe_block, 197); // 200 - 3

        drop(dir);
    }

    #[tokio::test]
    async fn test_duplicate_event_filtering() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("dedup_test.json");

        let config = EventMonitorConfig {
            index_contract: [1u8; 20],
            confirmation_depth: 3,
            chain_id: 111222333,
            state_file,
            queue_capacity: 100,
            start_block: Some(0),
        };

        let mut monitor = EventMonitor::new(mock_chain, config);
        monitor.init().unwrap();

        let mut receiver = monitor.take_event_receiver().unwrap();

        // Same event twice (same block, tx_hash, log_index)
        let chain_event = common::traits::ChainEvent::TradeRequest {
            cycle_number: 1,
            pair_id: [1u8; 32],
            side: 0,
            amount: ethers::types::U256::from(100u64),
            limit_price: ethers::types::U256::from(10u64),
            block_number: 50,
            tx_hash: [99u8; 32],
            log_index: 0,
        };

        // Process same event twice
        monitor.handle_chain_event(chain_event.clone()).await.unwrap();
        monitor.handle_chain_event(chain_event).await.unwrap();

        // Should only receive one event
        let first = receiver.try_recv();
        assert!(first.is_ok());

        let second = receiver.try_recv();
        assert!(second.is_err(), "Duplicate event should have been filtered");

        // Metrics should show 1 received, 1 filtered
        let metrics = monitor.metrics().await;
        assert_eq!(metrics.trade_requests_received, 1);
        assert_eq!(metrics.duplicates_filtered, 1);

        drop(dir);
    }

    #[tokio::test]
    async fn test_init_applies_configured_start_block() {
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let dir = tempdir().unwrap();
        let state_file = dir.path().join("start_block_test.json");

        let config = EventMonitorConfig {
            index_contract: [1u8; 20],
            confirmation_depth: 3,
            chain_id: 111222333,
            state_file,
            queue_capacity: 100,
            start_block: Some(500),
        };

        let mut monitor = EventMonitor::new(mock_chain, config);
        monitor.init().unwrap();

        // Should use configured start block since no prior state exists
        assert_eq!(monitor.get_start_block(), 500);

        drop(dir);
    }

    #[tokio::test]
    async fn test_combined_filter_includes_trade_request_topic() {
        let (monitor, _dir) = create_test_monitor();

        let filter = monitor.create_combined_filter(0);
        assert!(filter.topics.contains(&TradeRequestEvent::TOPIC));
        // WithdrawalRequest has zero topic (placeholder), should NOT be included
        assert!(!filter.topics.contains(&[0u8; 32]));
    }
}
