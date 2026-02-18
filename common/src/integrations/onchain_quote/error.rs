//! Error types for on-chain quote fallback

use ethers::types::Address;
use thiserror::Error;

/// Errors that can occur when fetching on-chain quotes
#[derive(Debug, Error)]
pub enum OnchainQuoteError {
    /// Pool not found for the given token pair
    #[error("Pool not found for pair {token_a} / {token_b}")]
    PoolNotFound {
        /// First token address
        token_a: Address,
        /// Second token address
        token_b: Address,
    },

    /// RPC call failed
    #[error("RPC error: {message}")]
    RpcError {
        /// Error message from the provider
        message: String,
        /// Source error (if available)
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Pool has zero liquidity
    #[error("Pool {pool} has no liquidity")]
    NoLiquidity {
        /// Pool address with no liquidity
        pool: Address,
    },

    /// Price calculation overflow
    #[error("Math overflow during price calculation: {context}")]
    MathOverflow {
        /// Description of what calculation overflowed
        context: String,
    },

    /// All retry attempts exhausted
    #[error("Max retries exceeded after {attempts} attempts")]
    MaxRetriesExceeded {
        /// Number of attempts made
        attempts: u32,
    },

    /// Configuration error
    #[error("Invalid configuration: {message}")]
    InvalidConfig {
        /// Description of the configuration error
        message: String,
    },

    /// Unsupported chain
    #[error("Unsupported chain ID: {chain_id}")]
    UnsupportedChain {
        /// The unsupported chain ID
        chain_id: u64,
    },

    /// Timeout waiting for RPC response
    #[error("RPC call timed out after {timeout_ms}ms")]
    Timeout {
        /// Timeout duration in milliseconds
        timeout_ms: u64,
    },
}

impl OnchainQuoteError {
    /// Create a new RPC error from a provider error
    pub fn rpc<E: std::error::Error + Send + Sync + 'static>(err: E) -> Self {
        Self::RpcError {
            message: err.to_string(),
            source: Some(Box::new(err)),
        }
    }

    /// Create a new RPC error from a message
    pub fn rpc_message(message: impl Into<String>) -> Self {
        Self::RpcError {
            message: message.into(),
            source: None,
        }
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::RpcError { .. } | Self::Timeout { .. }
        )
    }
}

/// Result type alias for on-chain quote operations
pub type Result<T> = std::result::Result<T, OnchainQuoteError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_not_found_error() {
        let token_a = Address::zero();
        let token_b = Address::random();
        let err = OnchainQuoteError::PoolNotFound { token_a, token_b };
        assert!(err.to_string().contains("Pool not found"));
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_rpc_error_is_retryable() {
        let err = OnchainQuoteError::rpc_message("connection refused");
        assert!(err.is_retryable());
    }

    #[test]
    fn test_timeout_is_retryable() {
        let err = OnchainQuoteError::Timeout { timeout_ms: 5000 };
        assert!(err.is_retryable());
    }

    #[test]
    fn test_no_liquidity_not_retryable() {
        let err = OnchainQuoteError::NoLiquidity {
            pool: Address::zero(),
        };
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_math_overflow_not_retryable() {
        let err = OnchainQuoteError::MathOverflow {
            context: "sqrtPriceX96 squared".to_string(),
        };
        assert!(!err.is_retryable());
    }
}
