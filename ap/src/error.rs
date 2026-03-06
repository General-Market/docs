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

    /// Failed to load or save block tracker state
    #[error("Block tracker error: {0}")]
    BlockTracker(String),

    /// Event queue channel closed
    #[error("Event queue closed")]
    QueueClosed,
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
