//! Typed errors for market data sources
//!
//! Classifies API errors so the sync engine can respond appropriately:
//! - `AuthFailed` → disable source immediately
//! - `RateLimited` → back off using Retry-After or exponential delay
//! - `Transient` → retry with backoff up to max_retries
//! - `DataError` → log and skip (don't retry, data is bad)
//! - `Disabled` → source manually disabled, stop syncing

use std::time::Duration;

/// Typed error for market data source operations
#[derive(Debug, thiserror::Error)]
pub enum SourceError {
    /// API returned 429 — back off and retry
    #[error("Rate limited, retry after {0:?}")]
    RateLimited(Option<Duration>),

    /// API returned 401/403 — credentials invalid or revoked
    #[error("Auth failed: {0}")]
    AuthFailed(String),

    /// Transient error (timeout, 5xx, network) — retry with backoff
    #[error("Transient error: {0}")]
    Transient(String),

    /// Data parsing or validation error — don't retry, data is bad
    #[error("Data parse error: {0}")]
    DataError(String),

    /// Source is disabled (manually or by circuit breaker)
    #[error("Source disabled")]
    Disabled,
}

impl SourceError {
    /// Classify an HTTP status code into a SourceError
    pub fn from_status(status: u16, body: &str) -> Self {
        match status {
            401 | 403 => SourceError::AuthFailed(format!("HTTP {}: {}", status, body)),
            429 => SourceError::RateLimited(None),
            500..=599 => SourceError::Transient(format!("HTTP {}: {}", status, body)),
            _ => SourceError::DataError(format!("HTTP {}: {}", status, body)),
        }
    }

    /// Whether this error should trigger a retry
    pub fn is_retryable(&self) -> bool {
        matches!(self, SourceError::RateLimited(_) | SourceError::Transient(_))
    }

    /// Whether this error should disable the source
    pub fn should_disable(&self) -> bool {
        matches!(self, SourceError::AuthFailed(_))
    }
}

/// Circuit breaker state machine for a data source
#[derive(Debug, Clone)]
pub enum CircuitState {
    /// Normal operation — requests flow through
    Closed,
    /// Source disabled after too many failures — requests blocked
    Open { disabled_until: std::time::Instant },
    /// Cooldown expired — next request is a test probe
    HalfOpen,
}

/// Circuit breaker protecting a data source from repeated failures
#[derive(Debug)]
pub struct CircuitBreaker {
    pub state: CircuitState,
    pub consecutive_failures: u32,
    pub max_failures: u32,
    pub cooldown: Duration,
}

impl CircuitBreaker {
    /// Create a new circuit breaker with defaults (5 failures, 5 min cooldown)
    pub fn new() -> Self {
        Self {
            state: CircuitState::Closed,
            consecutive_failures: 0,
            max_failures: 5,
            cooldown: Duration::from_secs(300),
        }
    }

    /// Check if requests should be allowed through
    pub fn is_allowed(&mut self) -> bool {
        match &self.state {
            CircuitState::Closed => true,
            CircuitState::Open { disabled_until } => {
                if std::time::Instant::now() >= *disabled_until {
                    self.state = CircuitState::HalfOpen;
                    true // Allow one test request
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true, // Allow test request
        }
    }

    /// Record a successful operation — reset to Closed
    pub fn record_success(&mut self) {
        self.consecutive_failures = 0;
        self.state = CircuitState::Closed;
    }

    /// Record a failure — may trip to Open state
    pub fn record_failure(&mut self, error: &SourceError) {
        self.consecutive_failures += 1;

        // Auth failures immediately open the circuit
        if error.should_disable() {
            self.state = CircuitState::Open {
                disabled_until: std::time::Instant::now() + Duration::from_secs(3600), // 1 hour for auth
            };
            return;
        }

        // Too many consecutive failures
        if self.consecutive_failures >= self.max_failures {
            self.state = CircuitState::Open {
                disabled_until: std::time::Instant::now() + self.cooldown,
            };
        }
    }

    /// Get circuit breaker state as a string (for DB/logging)
    pub fn state_str(&self) -> &'static str {
        match &self.state {
            CircuitState::Closed => "closed",
            CircuitState::Open { .. } => "open",
            CircuitState::HalfOpen => "half_open",
        }
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_source_error_from_status() {
        assert!(matches!(
            SourceError::from_status(401, "unauthorized"),
            SourceError::AuthFailed(_)
        ));
        assert!(matches!(
            SourceError::from_status(403, "forbidden"),
            SourceError::AuthFailed(_)
        ));
        assert!(matches!(
            SourceError::from_status(429, "too many"),
            SourceError::RateLimited(_)
        ));
        assert!(matches!(
            SourceError::from_status(500, "internal"),
            SourceError::Transient(_)
        ));
        assert!(matches!(
            SourceError::from_status(503, "unavailable"),
            SourceError::Transient(_)
        ));
        assert!(matches!(
            SourceError::from_status(400, "bad request"),
            SourceError::DataError(_)
        ));
    }

    #[test]
    fn test_retryable() {
        assert!(SourceError::RateLimited(None).is_retryable());
        assert!(SourceError::Transient("timeout".into()).is_retryable());
        assert!(!SourceError::AuthFailed("bad key".into()).is_retryable());
        assert!(!SourceError::DataError("parse fail".into()).is_retryable());
        assert!(!SourceError::Disabled.is_retryable());
    }

    #[test]
    fn test_circuit_breaker_normal() {
        let mut cb = CircuitBreaker::new();
        assert!(cb.is_allowed());
        cb.record_success();
        assert_eq!(cb.consecutive_failures, 0);
        assert_eq!(cb.state_str(), "closed");
    }

    #[test]
    fn test_circuit_breaker_trips_after_max_failures() {
        let mut cb = CircuitBreaker::new();
        let err = SourceError::Transient("timeout".into());

        for _ in 0..5 {
            cb.record_failure(&err);
        }

        assert_eq!(cb.state_str(), "open");
        assert!(!cb.is_allowed());
    }

    #[test]
    fn test_circuit_breaker_auth_failure_immediate_open() {
        let mut cb = CircuitBreaker::new();
        let err = SourceError::AuthFailed("invalid key".into());

        cb.record_failure(&err);
        assert_eq!(cb.state_str(), "open");
        assert_eq!(cb.consecutive_failures, 1);
    }

    #[test]
    fn test_circuit_breaker_recovery() {
        let mut cb = CircuitBreaker {
            state: CircuitState::Open {
                disabled_until: std::time::Instant::now() - Duration::from_secs(1), // already expired
            },
            consecutive_failures: 5,
            max_failures: 5,
            cooldown: Duration::from_secs(300),
        };

        // Should transition to HalfOpen
        assert!(cb.is_allowed());
        assert_eq!(cb.state_str(), "half_open");

        // Success should reset to Closed
        cb.record_success();
        assert_eq!(cb.state_str(), "closed");
        assert_eq!(cb.consecutive_failures, 0);
    }
}
