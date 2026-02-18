//! Error types for Squads v4 multisig operations

use solana_sdk::pubkey::Pubkey;
use thiserror::Error;

/// Errors that can occur when interacting with Squads v4 multisig
#[derive(Debug, Error)]
pub enum SquadsError {
    /// Solana RPC connection failed
    #[error("RPC connection failed: {message}")]
    RpcConnectionFailed {
        /// Error message from RPC
        message: String,
    },

    /// Multisig account not found or invalid
    #[error("Multisig not found: {address}")]
    MultisigNotFound {
        /// The multisig address that was not found
        address: Pubkey,
    },

    /// Proposal not found
    #[error("Proposal not found: {proposal_id}")]
    ProposalNotFound {
        /// The proposal ID that was not found
        proposal_id: Pubkey,
    },

    /// Not a member of the multisig
    #[error("Not a member of the multisig: {pubkey}")]
    NotMember {
        /// The pubkey that is not a member
        pubkey: Pubkey,
    },

    /// Already approved this proposal
    #[error("Already approved proposal {proposal_id} by member {member}")]
    AlreadyApproved {
        /// The member who already approved
        member: Pubkey,
        /// The proposal that was already approved
        proposal_id: Pubkey,
    },

    /// Threshold not reached for execution
    #[error("Threshold not reached: {current}/{required} approvals")]
    ThresholdNotReached {
        /// Current number of approvals
        current: u8,
        /// Required number of approvals
        required: u8,
    },

    /// Proposal already executed
    #[error("Proposal already executed: {proposal_id}")]
    AlreadyExecuted {
        /// The proposal that was already executed
        proposal_id: Pubkey,
    },

    /// Proposal expired
    #[error("Proposal expired at {expired_at}: {proposal_id}")]
    ProposalExpired {
        /// The proposal that expired
        proposal_id: Pubkey,
        /// Unix timestamp when it expired
        expired_at: i64,
    },

    /// Transaction too large
    #[error("Transaction too large: {size} bytes (max: {max})")]
    TransactionTooLarge {
        /// Actual size in bytes
        size: usize,
        /// Maximum allowed size
        max: usize,
    },

    /// CPI depth exceeded (Solana limit)
    #[error("CPI depth exceeded - Solana has a 4-level CPI limit")]
    CpiDepthExceeded,

    /// Serialization error
    #[error("Serialization error: {message}")]
    SerializationError {
        /// Error message
        message: String,
    },

    /// Invalid signature
    #[error("Invalid signature")]
    InvalidSignature,

    /// Proposal is cancelled
    #[error("Proposal is cancelled: {proposal_id}")]
    ProposalCancelled {
        /// The cancelled proposal
        proposal_id: Pubkey,
    },

    /// Proposal is rejected
    #[error("Proposal is rejected: {proposal_id}")]
    ProposalRejected {
        /// The rejected proposal
        proposal_id: Pubkey,
    },

    /// Network error from RPC
    #[error("Network error: {message}")]
    NetworkError {
        /// Error message
        message: String,
    },

    /// Invalid instruction data
    #[error("Invalid instruction: {message}")]
    InvalidInstruction {
        /// Error details
        message: String,
    },

    /// Account deserialization failed
    #[error("Failed to deserialize account: {message}")]
    DeserializationError {
        /// Error message
        message: String,
    },

    /// Missing configuration
    #[error("Missing configuration: {field}")]
    MissingConfig {
        /// The missing field
        field: String,
    },

    /// Transaction simulation failed
    #[error("Transaction simulation failed: {message}")]
    SimulationFailed {
        /// Simulation error message
        message: String,
    },

    /// Insufficient SOL for transaction fees
    #[error("Insufficient SOL balance for fees")]
    InsufficientBalance,
}

impl SquadsError {
    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            SquadsError::RpcConnectionFailed { .. }
                | SquadsError::NetworkError { .. }
                | SquadsError::SimulationFailed { .. }
        )
    }

    /// Create an RPC connection error from a solana-client error
    pub fn from_rpc_error(err: impl std::fmt::Display) -> Self {
        SquadsError::RpcConnectionFailed {
            message: err.to_string(),
        }
    }

    /// Create a network error
    pub fn network(message: impl Into<String>) -> Self {
        SquadsError::NetworkError {
            message: message.into(),
        }
    }

    /// Create a serialization error from borsh
    pub fn from_borsh_error(err: impl std::fmt::Display) -> Self {
        SquadsError::SerializationError {
            message: err.to_string(),
        }
    }

    /// Create a deserialization error
    pub fn deserialization(message: impl Into<String>) -> Self {
        SquadsError::DeserializationError {
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rpc_connection_failed_is_retryable() {
        let err = SquadsError::RpcConnectionFailed {
            message: "timeout".to_string(),
        };
        assert!(err.is_retryable());
    }

    #[test]
    fn test_network_error_is_retryable() {
        let err = SquadsError::network("connection reset");
        assert!(err.is_retryable());
    }

    #[test]
    fn test_not_member_not_retryable() {
        let err = SquadsError::NotMember {
            pubkey: Pubkey::new_unique(),
        };
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_threshold_not_reached_error_display() {
        let err = SquadsError::ThresholdNotReached {
            current: 8,
            required: 11,
        };
        assert_eq!(err.to_string(), "Threshold not reached: 8/11 approvals");
    }

    #[test]
    fn test_already_approved_error() {
        let member = Pubkey::new_unique();
        let proposal_id = Pubkey::new_unique();
        let err = SquadsError::AlreadyApproved {
            member,
            proposal_id,
        };
        assert!(!err.is_retryable());
        assert!(err.to_string().contains("Already approved"));
    }

    #[test]
    fn test_transaction_too_large_error() {
        let err = SquadsError::TransactionTooLarge {
            size: 1500,
            max: 1232,
        };
        assert_eq!(
            err.to_string(),
            "Transaction too large: 1500 bytes (max: 1232)"
        );
    }

    #[test]
    fn test_from_borsh_error() {
        let err = SquadsError::from_borsh_error("invalid data");
        assert!(matches!(err, SquadsError::SerializationError { .. }));
    }
}
