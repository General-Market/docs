//! Mock error types for testing

use std::time::Duration;
use thiserror::Error;

/// Error type for all mock implementations
///
/// Provides consistent error handling across mocks with support for
/// failure injection and simulated network conditions.
#[derive(Debug, Clone, Error)]
pub enum MockError {
    /// Simulated random failure (for failure injection)
    #[error("simulated failure (rate={0})")]
    SimulatedFailure(f64),

    /// Simulated timeout
    #[error("simulated timeout after {0:?}")]
    Timeout(Duration),

    /// Resource not found
    #[error("not found: {0}")]
    NotFound(String),

    /// Invalid state for the requested operation
    #[error("invalid state: {0}")]
    InvalidState(String),

    /// Network partition (P2P)
    #[error("network partition")]
    NetworkPartition,

    /// Peer disconnected (P2P)
    #[error("peer disconnected: {0}")]
    PeerDisconnected(String),

    /// Channel closed (internal communication)
    #[error("channel closed")]
    ChannelClosed,

    /// Insufficient balance (Bitget mock)
    #[error("insufficient balance: {0}")]
    InsufficientBalance(String),

    /// Order not found
    #[error("order not found: {0}")]
    OrderNotFound(String),

    /// Invalid signature
    #[error("invalid signature: {0}")]
    InvalidSignature(String),

    /// Consensus failure
    #[error("consensus failure: {0}")]
    ConsensusFailure(String),
}

impl From<MockError> for crate::error::Error {
    fn from(e: MockError) -> Self {
        match e {
            MockError::SimulatedFailure(rate) => {
                crate::error::Error::ChainRead(format!("simulated failure (rate={})", rate))
            }
            MockError::Timeout(d) => crate::error::Error::Timeout(format!("{:?}", d)),
            MockError::NotFound(s) => crate::error::Error::NotFound(s),
            MockError::InvalidState(s) => crate::error::Error::InvalidArgument(s),
            MockError::NetworkPartition => {
                crate::error::Error::P2PConnection("network partition".to_string())
            }
            MockError::PeerDisconnected(s) => crate::error::Error::P2PConnection(s),
            MockError::ChannelClosed => {
                crate::error::Error::P2PReceive("channel closed".to_string())
            }
            MockError::InsufficientBalance(s) => crate::error::Error::ApClient(s),
            MockError::OrderNotFound(s) => crate::error::Error::NotFound(s),
            MockError::InvalidSignature(s) => crate::error::Error::BlsVerification(s),
            MockError::ConsensusFailure(s) => crate::error::Error::BlsSigning(s),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_error_display() {
        let err = MockError::SimulatedFailure(0.5);
        assert!(err.to_string().contains("simulated failure"));
        assert!(err.to_string().contains("0.5"));
    }

    #[test]
    fn test_mock_error_conversion() {
        let mock_err = MockError::NotFound("test".to_string());
        let common_err: crate::error::Error = mock_err.into();
        assert!(matches!(common_err, crate::error::Error::NotFound(_)));
    }
}
