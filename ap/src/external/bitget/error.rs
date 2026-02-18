//! Bitget API error types
//!
//! Provides typed error variants for all Bitget API error conditions including
//! rate limiting, authentication failures, and trading errors.

use rust_decimal::Decimal;
use thiserror::Error;

/// Bitget API error with typed variants for specific error conditions.
#[derive(Debug, Error)]
pub enum BitgetError {
    /// Rate limit exceeded - client should back off and retry
    #[error("rate limited: retry after {retry_after_ms}ms")]
    RateLimited {
        /// Milliseconds to wait before retrying
        retry_after_ms: u64,
    },

    /// API credentials are invalid or expired
    #[error("invalid credentials: authentication failed")]
    InvalidCredentials,

    /// Insufficient balance to place order (with parsed details)
    #[error("insufficient balance: need {required} {asset}, have {available}")]
    InsufficientBalance {
        /// The asset that is insufficient
        asset: String,
        /// Required amount
        required: Decimal,
        /// Available amount
        available: Decimal,
    },

    /// Insufficient balance (raw message from API when parsing fails)
    #[error("insufficient balance: {message}")]
    InsufficientBalanceRaw {
        /// Original error message from Bitget
        message: String,
    },

    /// Trading pair/symbol not recognized or not tradeable
    #[error("invalid symbol: {symbol}")]
    InvalidSymbol {
        /// The invalid symbol
        symbol: String,
    },

    /// Order was rejected by the exchange
    #[error("order rejected: [{code}] {message}")]
    OrderRejected {
        /// Bitget error code
        code: String,
        /// Error message
        message: String,
    },

    /// Network/HTTP error during API call
    #[error("network error: {source}")]
    NetworkError {
        /// The underlying reqwest error
        #[from]
        source: reqwest::Error,
    },

    /// Generic API error with code and message
    #[error("API error: [{code}] {message}")]
    ApiError {
        /// Bitget error code
        code: i32,
        /// Error message
        message: String,
    },

    /// Request timed out
    #[error("request timeout after {timeout_ms}ms")]
    Timeout {
        /// Timeout duration in milliseconds
        timeout_ms: u64,
    },

    /// Invalid request parameters
    #[error("invalid request: {message}")]
    InvalidRequest {
        /// Description of what's invalid
        message: String,
    },

    /// Client not authenticated
    #[error("client not authenticated: call authenticate() first")]
    NotAuthenticated,
}

impl BitgetError {
    /// Create a rate limited error
    pub fn rate_limited(retry_after_ms: u64) -> Self {
        Self::RateLimited { retry_after_ms }
    }

    /// Create an insufficient balance error
    pub fn insufficient_balance(asset: impl Into<String>, required: Decimal, available: Decimal) -> Self {
        Self::InsufficientBalance {
            asset: asset.into(),
            required,
            available,
        }
    }

    /// Create an invalid symbol error
    pub fn invalid_symbol(symbol: impl Into<String>) -> Self {
        Self::InvalidSymbol {
            symbol: symbol.into(),
        }
    }

    /// Create an order rejected error
    pub fn order_rejected(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::OrderRejected {
            code: code.into(),
            message: message.into(),
        }
    }

    /// Create a generic API error
    pub fn api_error(code: i32, message: impl Into<String>) -> Self {
        Self::ApiError {
            code,
            message: message.into(),
        }
    }

    /// Create an invalid request error
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::InvalidRequest {
            message: message.into(),
        }
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            BitgetError::RateLimited { .. }
                | BitgetError::NetworkError { .. }
                | BitgetError::Timeout { .. }
        )
    }

    /// Get retry delay if this is a rate limit error
    pub fn retry_after(&self) -> Option<u64> {
        match self {
            BitgetError::RateLimited { retry_after_ms } => Some(*retry_after_ms),
            _ => None,
        }
    }
}

/// Maps Bitget API error codes to typed errors.
///
/// Reference: https://www.bitget.com/api-doc/common/error-code
pub fn map_bitget_error_code(code: &str, message: &str) -> BitgetError {
    match code {
        // Authentication errors
        "40001" | "40002" | "40003" | "40004" | "40005" => BitgetError::InvalidCredentials,

        // Rate limiting
        "40011" | "40012" | "40013" | "40014" | "429" => {
            // Default retry after 1 second if not specified
            BitgetError::rate_limited(1000)
        }

        // Trading errors - insufficient balance
        // Preserve the original message since Bitget's format varies
        "40602" | "40725" => BitgetError::InsufficientBalanceRaw {
            message: message.to_string(),
        },

        // Invalid symbol
        "40601" | "40700" | "40701" => BitgetError::invalid_symbol(message),

        // Order rejected
        "40606" | "40608" | "40609" | "40610" | "40611" | "40613" | "40614" | "40615"
        | "40620" | "40621" | "40622" | "40623" | "40624" | "40625" | "40626" | "40627"
        | "40628" | "40629" | "40630" | "40633" | "40634" | "40750" => {
            BitgetError::order_rejected(code, message)
        }

        // Default: generic API error
        _ => {
            let code_num = code.parse::<i32>().unwrap_or(-1);
            BitgetError::api_error(code_num, message)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = BitgetError::rate_limited(5000);
        assert_eq!(err.to_string(), "rate limited: retry after 5000ms");

        let err = BitgetError::InvalidCredentials;
        assert_eq!(err.to_string(), "invalid credentials: authentication failed");

        let err = BitgetError::insufficient_balance("USDC", Decimal::new(1000, 2), Decimal::new(500, 2));
        assert!(err.to_string().contains("USDC"));
    }

    #[test]
    fn test_is_retryable() {
        assert!(BitgetError::rate_limited(1000).is_retryable());
        assert!(BitgetError::Timeout { timeout_ms: 30000 }.is_retryable());
        assert!(!BitgetError::InvalidCredentials.is_retryable());
        assert!(!BitgetError::invalid_symbol("INVALID").is_retryable());
    }

    #[test]
    fn test_retry_after() {
        assert_eq!(BitgetError::rate_limited(5000).retry_after(), Some(5000));
        assert_eq!(BitgetError::InvalidCredentials.retry_after(), None);
    }

    #[test]
    fn test_map_error_codes() {
        // Auth errors
        assert!(matches!(map_bitget_error_code("40001", ""), BitgetError::InvalidCredentials));

        // Rate limit
        assert!(matches!(map_bitget_error_code("40011", ""), BitgetError::RateLimited { .. }));

        // Order rejected
        assert!(matches!(map_bitget_error_code("40606", "Order failed"), BitgetError::OrderRejected { .. }));
    }
}
