//! Retry configuration and logic for fill reporting
//!
//! Implements exponential backoff retry strategy per architecture Section 16.

use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Configuration for retry behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillRetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Base delay in milliseconds for exponential backoff
    pub base_delay_ms: u64,
    /// Maximum delay in milliseconds (cap for backoff)
    pub max_delay_ms: u64,
}

impl Default for FillRetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            base_delay_ms: 200,
            max_delay_ms: 2000,
        }
    }
}

impl FillRetryConfig {
    /// Calculate delay for the given attempt number
    ///
    /// Uses exponential backoff: delay = base_delay * 2^attempt
    /// Capped at max_delay_ms
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        if attempt == 0 {
            return Duration::from_millis(0);
        }

        let delay_ms = self
            .base_delay_ms
            .saturating_mul(2u64.saturating_pow(attempt.saturating_sub(1)));

        Duration::from_millis(delay_ms.min(self.max_delay_ms))
    }

    /// Check if more retries are allowed
    pub fn should_retry(&self, current_attempts: u32) -> bool {
        current_attempts < self.max_retries
    }
}

/// Error classification for retry decisions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    /// Transient error - should retry
    Recoverable,
    /// Permanent error - do not retry
    Permanent,
}

/// Classify an error for retry decisions
///
/// Recoverable errors (retry):
/// - Network timeout
/// - RPC unavailable
/// - Nonce too low
/// - Server errors (5xx)
///
/// Permanent errors (do not retry):
/// - Execution reverted
/// - Invalid fill data
/// - Order not found
/// - Fill already confirmed
pub fn classify_error(error: &common::Error) -> ErrorKind {
    match error {
        // Network/connectivity issues are recoverable
        common::Error::ChainRead(msg) | common::Error::ChainWrite(msg) => {
            if msg.contains("timeout")
                || msg.contains("unavailable")
                || msg.contains("connection")
                || msg.contains("nonce too low")
                || msg.contains("502")
                || msg.contains("503")
                || msg.contains("504")
            {
                ErrorKind::Recoverable
            } else if msg.contains("revert")
                || msg.contains("invalid")
                || msg.contains("not found")
                || msg.contains("already")
            {
                ErrorKind::Permanent
            } else {
                // Default to recoverable for unknown chain errors
                ErrorKind::Recoverable
            }
        }
        common::Error::Timeout(_) => ErrorKind::Recoverable,
        common::Error::TransactionFailed(msg) => {
            if msg.contains("revert") || msg.contains("invalid") || msg.contains("already") {
                ErrorKind::Permanent
            } else {
                ErrorKind::Recoverable
            }
        }
        // Other errors are typically permanent
        common::Error::NotFound(_)
        | common::Error::InvalidArgument(_)
        | common::Error::BlsSigning(_)
        | common::Error::BlsVerification(_)
        | common::Error::SignatureAggregation(_) => ErrorKind::Permanent,
        // P2P and AP errors - recoverable if network-related
        common::Error::P2PConnection(_) | common::Error::P2PBroadcast(_) => ErrorKind::Recoverable,
        common::Error::P2PReceive(_) | common::Error::ApClient(_) | common::Error::Serialization(_) => {
            ErrorKind::Permanent
        }
        // Authentication and rate limit errors
        common::Error::Authentication(_) => ErrorKind::Permanent,
        common::Error::RateLimit(_) => ErrorKind::Recoverable,
        common::Error::ExternalService(msg) => {
            if msg.contains("timeout")
                || msg.contains("unavailable")
                || msg.contains("connection")
            {
                ErrorKind::Recoverable
            } else {
                ErrorKind::Permanent
            }
        }
        // Netting errors are permanent (logic mismatch)
        common::Error::Netting(_) => ErrorKind::Permanent,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = FillRetryConfig::default();
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.base_delay_ms, 200);
        assert_eq!(config.max_delay_ms, 2000);
    }

    #[test]
    fn test_delay_for_attempt() {
        let config = FillRetryConfig::default();

        // Attempt 0 = no delay
        assert_eq!(config.delay_for_attempt(0), Duration::from_millis(0));
        // Attempt 1 = 200ms
        assert_eq!(config.delay_for_attempt(1), Duration::from_millis(200));
        // Attempt 2 = 400ms
        assert_eq!(config.delay_for_attempt(2), Duration::from_millis(400));
        // Attempt 3 = 800ms
        assert_eq!(config.delay_for_attempt(3), Duration::from_millis(800));
        // Attempt 4 = 1600ms
        assert_eq!(config.delay_for_attempt(4), Duration::from_millis(1600));
        // Attempt 5 = capped at 2000ms
        assert_eq!(config.delay_for_attempt(5), Duration::from_millis(2000));
    }

    #[test]
    fn test_should_retry() {
        let config = FillRetryConfig::default();

        assert!(config.should_retry(0));
        assert!(config.should_retry(1));
        assert!(config.should_retry(2));
        assert!(!config.should_retry(3));
        assert!(!config.should_retry(4));
    }

    #[test]
    fn test_classify_recoverable_errors() {
        // Timeout errors
        assert_eq!(
            classify_error(&common::Error::Timeout("operation timed out".into())),
            ErrorKind::Recoverable
        );

        // Chain errors with recoverable keywords
        assert_eq!(
            classify_error(&common::Error::ChainWrite("connection timeout".into())),
            ErrorKind::Recoverable
        );
        assert_eq!(
            classify_error(&common::Error::ChainRead("RPC unavailable".into())),
            ErrorKind::Recoverable
        );
        assert_eq!(
            classify_error(&common::Error::ChainWrite("nonce too low".into())),
            ErrorKind::Recoverable
        );
    }

    #[test]
    fn test_classify_permanent_errors() {
        // Transaction reverted
        assert_eq!(
            classify_error(&common::Error::TransactionFailed("execution reverted".into())),
            ErrorKind::Permanent
        );

        // Invalid data
        assert_eq!(
            classify_error(&common::Error::ChainWrite("invalid fill data".into())),
            ErrorKind::Permanent
        );

        // Not found
        assert_eq!(
            classify_error(&common::Error::NotFound("order not found".into())),
            ErrorKind::Permanent
        );

        // Already confirmed
        assert_eq!(
            classify_error(&common::Error::ChainWrite("fill already confirmed".into())),
            ErrorKind::Permanent
        );
    }
}
