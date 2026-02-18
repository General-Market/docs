//! AP-specific error types for Index L3
//!
//! Error codes follow architecture specification Section 21.

use thiserror::Error;

/// AP-specific error types
#[derive(Debug, Error)]
pub enum APError {
    /// Failed to parse event data from chain logs
    #[error("Event parse error: {0}")]
    EventParse(String),

    /// Failed to subscribe to blockchain events
    #[error("E008: Subscription error: {0}")]
    Subscription(String),

    /// Chain reorganization detected
    #[error("Chain reorg detected at block {block}: {details}")]
    ReorgDetected { block: u64, details: String },

    /// Failed to load or save block tracker state
    #[error("Block tracker error: {0}")]
    BlockTracker(String),

    /// RPC/source unavailable (E008 from architecture)
    #[error("E008: Source unavailable: {0}")]
    SourceUnavailable(String),

    /// Event queue channel closed
    #[error("Event queue closed")]
    QueueClosed,

    /// Invalid event topic
    #[error("Invalid event topic: expected {expected}, got {actual}")]
    InvalidTopic { expected: String, actual: String },

    /// Duplicate event detected (during reorg handling)
    #[error("Duplicate event: {0}")]
    DuplicateEvent(String),

    /// Order execution timeout (NFR8: 60 second limit)
    #[error("Order {order_id} timed out after {elapsed_secs}s (attempt {attempt}/{max_attempts})")]
    OrderTimeout {
        order_id: String,
        elapsed_secs: u64,
        attempt: u32,
        max_attempts: u32,
    },

    /// Order permanently failed after max retries
    #[error("Order {order_id} failed permanently after {attempts} attempts")]
    MaxRetriesExceeded { order_id: String, attempts: u32 },

    /// Queue operation error
    #[error("Queue error: {0}")]
    QueueError(String),

    /// Queue is full (depth > 500), new orders rejected
    #[error("Queue full: depth {depth} exceeds limit {limit}")]
    QueueFull { depth: usize, limit: usize },

    /// Order expired (age > 1 hour)
    #[error("Order {order_id} expired after {age_secs}s (limit: {limit_secs}s)")]
    OrderExpired {
        order_id: String,
        age_secs: u64,
        limit_secs: u64,
    },

    /// AP is suspended, cannot process orders (E008)
    #[error("E008: AP suspended - {reason}")]
    APSuspended { reason: String },

    /// Cannot restore - AP not in suspended state
    #[error("Cannot restore: AP is in {state} state")]
    InvalidRestoration { state: String },

    /// Order pending timeout triggered refund (E009)
    #[error("E009: Order {order_id} auto-refunded after {pending_secs}s pending")]
    OrderAutoRefunded { order_id: String, pending_secs: u64 },
}

impl From<std::io::Error> for APError {
    fn from(err: std::io::Error) -> Self {
        APError::BlockTracker(err.to_string())
    }
}

impl From<serde_json::Error> for APError {
    fn from(err: serde_json::Error) -> Self {
        APError::BlockTracker(format!("JSON error: {}", err))
    }
}
