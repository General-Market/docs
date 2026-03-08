//! Retry logic with exponential backoff for chain transactions
//!
//! Implements retry logic with configurable backoff for transient failures.
//! Per architecture Section 7 (Leader Timeout): max_retries=3, base_delay=200ms, max_delay=2000ms

use std::time::Duration;

use thiserror::Error;
use tracing::{debug, warn};

/// Errors that can occur during retry operations
#[derive(Debug, Error)]
pub enum RetryError {
    /// Maximum retries exceeded
    #[error("Max retries exceeded after {attempts} attempts: {last_error}")]
    MaxRetriesExceeded { attempts: u32, last_error: String },

    /// Non-retryable error encountered
    #[error("Non-retryable error: {0}")]
    NonRetryable(String),
}

/// Configuration for retry behavior
///
/// Default values per architecture specification:
/// - max_retries: 3
/// - base_delay: 200ms
/// - max_delay: 2000ms
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Base delay for exponential backoff
    pub base_delay: Duration,
    /// Maximum delay cap
    pub max_delay: Duration,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            base_delay: Duration::from_millis(200),
            max_delay: Duration::from_millis(2000),
        }
    }
}

impl RetryConfig {
    /// Create a new RetryConfig with custom values
    pub fn new(max_retries: u32, base_delay: Duration, max_delay: Duration) -> Self {
        Self {
            max_retries,
            base_delay,
            max_delay,
        }
    }

    /// Calculate delay for a given attempt (0-indexed)
    ///
    /// Uses exponential backoff: delay = base_delay * 2^attempt
    /// Capped at max_delay
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        let multiplier = 2u64.saturating_pow(attempt);
        let delay_ms = self.base_delay.as_millis() as u64 * multiplier;
        let capped_delay = std::cmp::min(delay_ms, self.max_delay.as_millis() as u64);
        Duration::from_millis(capped_delay)
    }
}

/// Check if an error message indicates a retryable condition
///
/// # Retryable errors (recoverable):
/// - `nonce too low` - Fetch new nonce, retry
/// - `replacement transaction underpriced` - Bump gas, retry
/// - `connection timeout` - Wait and retry
/// - `server error (5xx)` - Wait and retry
///
/// # Non-retryable errors (permanent):
/// - `execution reverted` - Contract logic failed
/// - `invalid signature` - BLS verification failed
/// - `gas limit exceeded` - Tx too expensive
///
/// Note: "insufficient funds/balance" is NOT here — gas exhaustion is transient.
/// The pre-flight check (check_gas_available) is the primary defense. If gas runs out
/// mid-operation, the retry framework should allow another attempt after funding.
pub fn is_retryable_error(error_msg: &str) -> bool {
    let error_lower = error_msg.to_lowercase();

    // Check for non-retryable errors first (fail fast)
    // "nonce too low" is non-retryable because submit_tx allocates a fixed nonce
    // before entering with_retry — retrying with the same stale nonce always fails.
    // The nonce manager resyncs on failure, so the NEXT operation gets a fresh nonce.
    let non_retryable_patterns = [
        "execution reverted",
        "revert",
        "invalid signature",
        "signature verification failed",
        "gas limit exceeded",
        "out of gas",
        "intrinsic gas too low",
        "nonce too low",
        "nonce has already been used",
    ];

    for pattern in non_retryable_patterns {
        if error_lower.contains(pattern) {
            return false;
        }
    }

    // Check for retryable errors
    let retryable_patterns = [
        "replacement transaction underpriced",
        "transaction underpriced",
        "connection timeout",
        "timeout",
        "connection refused",
        "connection reset",
        "server error",
        "internal server error",
        "503",
        "502",
        "504",
        "rate limit",
        "too many requests",
        "429",
        "insufficient funds",
        "insufficient balance",
    ];

    for pattern in retryable_patterns {
        if error_lower.contains(pattern) {
            return true;
        }
    }

    // Default: do not retry unknown errors
    false
}

/// Execute an async operation with retry logic
///
/// # Arguments
/// * `config` - Retry configuration
/// * `operation_name` - Name for logging
/// * `mut operation` - The async function to retry
///
/// # Returns
/// Result of the operation or RetryError
pub async fn with_retry<F, Fut, T, E>(
    config: &RetryConfig,
    operation_name: &str,
    mut operation: F,
) -> Result<T, RetryError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut last_error = String::new();

    for attempt in 0..=config.max_retries {
        match operation().await {
            Ok(result) => {
                if attempt > 0 {
                    debug!(
                        operation = operation_name,
                        attempt = attempt + 1,
                        "Operation succeeded after retry"
                    );
                }
                return Ok(result);
            }
            Err(e) => {
                last_error = e.to_string();

                // Check if error is retryable
                if !is_retryable_error(&last_error) {
                    warn!(
                        code = "INFRA-002",
                        operation = operation_name,
                        error = %last_error,
                        "Non-retryable error encountered"
                    );
                    return Err(RetryError::NonRetryable(last_error));
                }

                if attempt < config.max_retries {
                    let delay = config.delay_for_attempt(attempt);
                    warn!(
                        code = "INFRA-002",
                        operation = operation_name,
                        attempt = attempt + 1,
                        max_retries = config.max_retries,
                        delay_ms = delay.as_millis(),
                        error = %last_error,
                        "Retryable error, will retry after delay"
                    );
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }

    Err(RetryError::MaxRetriesExceeded {
        attempts: config.max_retries + 1,
        last_error,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.base_delay, Duration::from_millis(200));
        assert_eq!(config.max_delay, Duration::from_millis(2000));
    }

    #[test]
    fn test_exponential_backoff() {
        let config = RetryConfig::default();

        // Attempt 0: 200ms * 2^0 = 200ms
        assert_eq!(config.delay_for_attempt(0), Duration::from_millis(200));

        // Attempt 1: 200ms * 2^1 = 400ms
        assert_eq!(config.delay_for_attempt(1), Duration::from_millis(400));

        // Attempt 2: 200ms * 2^2 = 800ms
        assert_eq!(config.delay_for_attempt(2), Duration::from_millis(800));

        // Attempt 3: 200ms * 2^3 = 1600ms
        assert_eq!(config.delay_for_attempt(3), Duration::from_millis(1600));

        // Attempt 4: 200ms * 2^4 = 3200ms, but capped at 2000ms
        assert_eq!(config.delay_for_attempt(4), Duration::from_millis(2000));
    }

    #[test]
    fn test_is_not_retryable_nonce_too_low() {
        // nonce too low is non-retryable: submit_tx allocates a fixed nonce,
        // retrying with the same stale nonce always fails.
        assert!(!is_retryable_error("nonce too low"));
        assert!(!is_retryable_error("Error: nonce too low for address"));
        assert!(!is_retryable_error("NONCE TOO LOW"));
        assert!(!is_retryable_error("nonce has already been used"));
    }

    #[test]
    fn test_is_retryable_underpriced() {
        assert!(is_retryable_error("replacement transaction underpriced"));
        assert!(is_retryable_error("transaction underpriced"));
    }

    #[test]
    fn test_is_retryable_connection_issues() {
        assert!(is_retryable_error("connection timeout"));
        assert!(is_retryable_error("Connection refused"));
        assert!(is_retryable_error("connection reset by peer"));
    }

    #[test]
    fn test_is_retryable_server_errors() {
        assert!(is_retryable_error("Internal server error"));
        assert!(is_retryable_error("503 Service Unavailable"));
        assert!(is_retryable_error("502 Bad Gateway"));
        assert!(is_retryable_error("rate limit exceeded"));
        assert!(is_retryable_error("429 Too Many Requests"));
    }

    #[test]
    fn test_retryable_insufficient_funds() {
        // Gas exhaustion is transient — pre-flight check is the primary defense
        assert!(is_retryable_error("insufficient funds for transfer"));
        assert!(is_retryable_error("Insufficient balance"));
    }

    #[test]
    fn test_not_retryable_revert() {
        assert!(!is_retryable_error("execution reverted"));
        assert!(!is_retryable_error("Error: revert InvalidSignature"));
    }

    #[test]
    fn test_not_retryable_gas() {
        assert!(!is_retryable_error("gas limit exceeded"));
        assert!(!is_retryable_error("out of gas"));
    }

    #[test]
    fn test_not_retryable_unknown() {
        // Unknown errors should not be retried by default
        assert!(!is_retryable_error("some random error"));
    }

    #[tokio::test]
    async fn test_with_retry_success_first_attempt() {
        let config = RetryConfig::new(
            3,
            Duration::from_millis(10),
            Duration::from_millis(100),
        );

        let result = with_retry(&config, "test_op", || async { Ok::<_, &str>(42) }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_with_retry_success_after_retries() {
        let config = RetryConfig::new(
            3,
            Duration::from_millis(10),
            Duration::from_millis(100),
        );

        let attempt_count = Arc::new(AtomicU32::new(0));
        let attempt_count_clone = attempt_count.clone();

        let result = with_retry(&config, "test_op", || {
            let count = attempt_count_clone.clone();
            async move {
                let attempt = count.fetch_add(1, Ordering::SeqCst);
                if attempt < 2 {
                    Err("nonce too low")
                } else {
                    Ok(42)
                }
            }
        })
        .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(attempt_count.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_with_retry_max_retries_exceeded() {
        let config = RetryConfig::new(
            2,
            Duration::from_millis(10),
            Duration::from_millis(100),
        );

        let result = with_retry(&config, "test_op", || async {
            Err::<i32, _>("connection timeout")
        })
        .await;

        assert!(matches!(result, Err(RetryError::MaxRetriesExceeded { .. })));
    }

    #[tokio::test]
    async fn test_with_retry_non_retryable_error() {
        let config = RetryConfig::new(
            3,
            Duration::from_millis(10),
            Duration::from_millis(100),
        );

        let attempt_count = Arc::new(AtomicU32::new(0));
        let attempt_count_clone = attempt_count.clone();

        let result = with_retry(&config, "test_op", || {
            let count = attempt_count_clone.clone();
            async move {
                count.fetch_add(1, Ordering::SeqCst);
                Err::<i32, _>("insufficient funds")
            }
        })
        .await;

        assert!(matches!(result, Err(RetryError::NonRetryable(_))));
        // Should only attempt once since error is non-retryable
        assert_eq!(attempt_count.load(Ordering::SeqCst), 1);
    }
}
