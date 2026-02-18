//! Error types for 1inch API operations

use thiserror::Error;

/// Errors that can occur when interacting with 1inch APIs
#[derive(Debug, Error)]
pub enum OneInchError {
    /// Rate limited by the API, should retry after delay
    #[error("Rate limited{}", retry_after_ms.map(|ms| format!(", retry after {}ms", ms)).unwrap_or_default())]
    RateLimited {
        /// Milliseconds to wait before retrying (if provided by API)
        retry_after_ms: Option<u64>,
    },

    /// API key is invalid or missing
    #[error("Invalid API key")]
    InvalidApiKey,

    /// Requested chain route is not supported
    #[error("Unsupported chain route: {src} -> {dst}")]
    UnsupportedRoute {
        /// Source chain ID
        src: u64,
        /// Destination chain ID
        dst: u64,
    },

    /// Intent/order not found
    #[error("Intent not found: {order_hash}")]
    IntentNotFound {
        /// The order hash that was not found
        order_hash: String,
    },

    /// Settlement failed on destination chain
    #[error("Settlement failed: {reason}")]
    SettlementFailed {
        /// Reason for failure
        reason: String,
    },

    /// Network/HTTP error
    #[error("Network error: {source}")]
    NetworkError {
        /// The underlying reqwest error
        #[from]
        source: reqwest::Error,
    },

    /// API returned an error response
    #[error("API error ({status_code}): {message}")]
    ApiError {
        /// HTTP status code
        status_code: u16,
        /// Error message from API
        message: String,
    },

    /// Invalid parameters provided
    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),

    /// Max retries exceeded
    #[error("Max retries exceeded after {attempts} attempts")]
    MaxRetriesExceeded {
        /// Number of attempts made
        attempts: u32,
    },

    /// Timeout waiting for operation
    #[error("Operation timed out after {timeout_ms}ms")]
    Timeout {
        /// Timeout duration in milliseconds
        timeout_ms: u64,
    },

    /// JSON serialization/deserialization error
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    /// Unsupported chain ID for swap operations
    #[error("Unsupported chain ID: {chain_id}")]
    UnsupportedChain {
        /// The unsupported chain ID
        chain_id: u64,
    },

    /// Invalid calldata format
    #[error("Invalid calldata: {message}")]
    InvalidCalldata {
        /// Error details
        message: String,
    },

    /// Invalid token address format
    #[error("Invalid token address: {address}")]
    InvalidToken {
        /// The invalid address
        address: String,
    },

    /// Insufficient liquidity for swap
    #[error("Insufficient liquidity for swap from {from} to {to} (amount: {amount})")]
    InsufficientLiquidity {
        /// Source token address
        from: String,
        /// Destination token address
        to: String,
        /// Requested amount
        amount: String,
    },

    /// Missing API key in environment
    #[error("Missing 1inch API key - set ONEINCH_FUSION_API_KEY or ONEINCH_API_KEY environment variable")]
    MissingApiKey,
}

impl OneInchError {
    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            OneInchError::RateLimited { .. }
                | OneInchError::NetworkError { .. }
                | OneInchError::Timeout { .. }
        )
    }

    /// Get retry delay if applicable
    pub fn retry_after(&self) -> Option<u64> {
        match self {
            OneInchError::RateLimited { retry_after_ms } => *retry_after_ms,
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limited_is_retryable() {
        let err = OneInchError::RateLimited {
            retry_after_ms: Some(1000),
        };
        assert!(err.is_retryable());
        assert_eq!(err.retry_after(), Some(1000));
    }

    #[test]
    fn test_rate_limited_without_retry_after() {
        let err = OneInchError::RateLimited {
            retry_after_ms: None,
        };
        assert!(err.is_retryable());
        assert_eq!(err.retry_after(), None);
    }

    #[test]
    fn test_api_error_not_retryable() {
        let err = OneInchError::ApiError {
            status_code: 400,
            message: "Bad request".to_string(),
        };
        assert!(!err.is_retryable());
        assert_eq!(err.retry_after(), None);
    }

    #[test]
    fn test_unsupported_route_error() {
        let err = OneInchError::UnsupportedRoute { src: 1, dst: 999 };
        assert!(!err.is_retryable());
        assert_eq!(
            err.to_string(),
            "Unsupported chain route: 1 -> 999"
        );
    }
}
