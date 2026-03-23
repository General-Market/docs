//! Event queue for AP event processing
//!
//! Uses tokio::sync::mpsc channels for FIFO event delivery to downstream consumers.

use tokio::sync::mpsc;

use ethers::types::U256;

use crate::error::APError;
use crate::event_types::{AssetTradeRequestEvent, TradeRequestEvent, WithdrawalRequestEvent};

/// Default channel capacity for event queue
pub const DEFAULT_QUEUE_CAPACITY: usize = 10_000;

/// Wrapper enum for all AP event types
#[derive(Debug, Clone)]
pub enum APEvent {
    /// Trade request from blockchain (ITP-level)
    TradeRequest(TradeRequestEvent),
    /// Per-asset trade request from oracle decomposition + cross-ITP netting
    AssetTradeRequest(AssetTradeRequestEvent),
    /// Withdrawal request from blockchain
    WithdrawalRequest(WithdrawalRequestEvent),
    /// Order submitted on L3 — AP tracks for ITP ID + side lookup
    OrderSubmitted { order_id: u64, user: [u8; 20], itp_id: [u8; 32], side: u8 },
    /// Fill confirmed on L3 — AP derives per-asset trades from ITP state
    FillConfirmed { order_id: u64, fill_price: U256, fill_amount: U256 },
}

impl APEvent {
    /// Get the block number where this event was emitted
    pub fn block_number(&self) -> u64 {
        match self {
            APEvent::TradeRequest(e) => e.block_number,
            APEvent::AssetTradeRequest(e) => e.block_number,
            APEvent::WithdrawalRequest(e) => e.block_number,
            APEvent::OrderSubmitted { .. } => 0, // SSE events don't carry block number
            APEvent::FillConfirmed { .. } => 0,
        }
    }

    /// Get unique event identifier for deduplication
    pub fn event_id(&self) -> String {
        match self {
            APEvent::TradeRequest(e) => format!("trade:{}", e.event_id()),
            APEvent::AssetTradeRequest(e) => format!("asset_trade:{}", e.event_id()),
            APEvent::WithdrawalRequest(e) => format!("withdrawal:{}", e.event_id()),
            APEvent::OrderSubmitted { order_id, .. } => format!("order_submitted:{}", order_id),
            APEvent::FillConfirmed { order_id, .. } => format!("fill_confirmed:{}", order_id),
        }
    }
}

/// Event queue for FIFO delivery of blockchain events to downstream consumers
pub struct EventQueue {
    sender: mpsc::Sender<APEvent>,
    receiver: Option<mpsc::Receiver<APEvent>>,
}

impl EventQueue {
    /// Create a new event queue with default capacity
    pub fn new() -> Self {
        Self::with_capacity(DEFAULT_QUEUE_CAPACITY)
    }

    /// Create a new event queue with specified capacity
    pub fn with_capacity(capacity: usize) -> Self {
        let (sender, receiver) = mpsc::channel(capacity);
        Self {
            sender,
            receiver: Some(receiver),
        }
    }

    /// Send an event to the queue
    ///
    /// Returns error if the queue is full or closed.
    pub async fn send(&self, event: APEvent) -> Result<(), APError> {
        self.sender
            .send(event)
            .await
            .map_err(|_| APError::QueueClosed)
    }

    /// Take the receiver for downstream consumption
    ///
    /// This can only be called once. Returns None on subsequent calls.
    pub fn take_receiver(&mut self) -> Option<mpsc::Receiver<APEvent>> {
        self.receiver.take()
    }

    /// Get a clone of the sender for use in other tasks
    pub fn sender(&self) -> mpsc::Sender<APEvent> {
        self.sender.clone()
    }
}

impl Default for EventQueue {
    fn default() -> Self {
        Self::new()
    }
}

/// Handle for receiving events from the queue
///
/// This is a wrapper around mpsc::Receiver that provides a cleaner API.
pub struct EventReceiver {
    receiver: mpsc::Receiver<APEvent>,
}

impl EventReceiver {
    /// Create a new event receiver from an mpsc receiver
    pub fn new(receiver: mpsc::Receiver<APEvent>) -> Self {
        Self { receiver }
    }

    /// Receive the next event, waiting if necessary
    ///
    /// Returns None if the queue is closed.
    pub async fn recv(&mut self) -> Option<APEvent> {
        self.receiver.recv().await
    }

    /// Try to receive an event without blocking
    ///
    /// Returns None if no event is available or the queue is closed.
    pub fn try_recv(&mut self) -> Option<APEvent> {
        self.receiver.try_recv().ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::Side;
    use ethers::types::{H256, U256};

    fn create_test_trade_event(block: u64, log_index: u64) -> TradeRequestEvent {
        TradeRequestEvent {
            cycle_number: 1,
            pair_id: H256::random(),
            side: Side::Buy,
            amount: U256::from(1000u64),
            limit_price: U256::from(100u64),
            block_number: block,
            tx_hash: H256::random(),
            log_index,
        }
    }

    #[tokio::test]
    async fn test_queue_send_receive() {
        let mut queue = EventQueue::new();
        let mut receiver = EventReceiver::new(queue.take_receiver().unwrap());

        let event = APEvent::TradeRequest(create_test_trade_event(100, 0));
        queue.send(event.clone()).await.unwrap();

        let received = receiver.recv().await.unwrap();
        assert_eq!(received.block_number(), 100);
    }

    #[tokio::test]
    async fn test_fifo_ordering() {
        let mut queue = EventQueue::new();
        let mut receiver = EventReceiver::new(queue.take_receiver().unwrap());

        // Send events in order
        for i in 0..5 {
            let event = APEvent::TradeRequest(create_test_trade_event(100 + i, i));
            queue.send(event).await.unwrap();
        }

        // Receive and verify FIFO order
        for i in 0..5 {
            let received = receiver.recv().await.unwrap();
            assert_eq!(received.block_number(), 100 + i);
        }
    }

    #[tokio::test]
    async fn test_receiver_can_only_be_taken_once() {
        let mut queue = EventQueue::new();

        let receiver1 = queue.take_receiver();
        assert!(receiver1.is_some());

        let receiver2 = queue.take_receiver();
        assert!(receiver2.is_none());
    }

    #[tokio::test]
    async fn test_event_id_uniqueness() {
        let event1 = APEvent::TradeRequest(create_test_trade_event(100, 0));
        let event2 = APEvent::TradeRequest(create_test_trade_event(100, 1));
        let event3 = APEvent::TradeRequest(create_test_trade_event(101, 0));

        assert_ne!(event1.event_id(), event2.event_id());
        assert_ne!(event1.event_id(), event3.event_id());
    }

    #[tokio::test]
    async fn test_queue_closed_on_sender_drop() {
        let mut queue = EventQueue::new();
        let mut receiver = EventReceiver::new(queue.take_receiver().unwrap());

        // Drop the queue (and its sender)
        drop(queue);

        // Receive should return None
        let result = receiver.recv().await;
        assert!(result.is_none());
    }
}
