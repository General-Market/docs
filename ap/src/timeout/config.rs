//! Timeout configuration for AP/Keeper service
//!
//! Default values per architecture NFR8 and Section 16.

use std::time::Duration;

/// Configuration for timeout handling
#[derive(Debug, Clone)]
pub struct TimeoutConfig {
    /// Order execution timeout (default 60s per NFR8)
    pub timeout_duration: Duration,
    /// Maximum retry attempts (default 3)
    pub max_retries: u32,
    /// Delay between retries (default 5s)
    pub retry_delay: Duration,
    /// Check interval for timeout scanner (default 1s)
    pub check_interval: Duration,
}

impl Default for TimeoutConfig {
    fn default() -> Self {
        Self {
            timeout_duration: Duration::from_secs(60),
            max_retries: 3,
            retry_delay: Duration::from_secs(5),
            check_interval: Duration::from_secs(1),
        }
    }
}

impl TimeoutConfig {
    /// Create a new config with custom timeout duration
    pub fn with_timeout(timeout_duration: Duration) -> Self {
        Self {
            timeout_duration,
            ..Default::default()
        }
    }

    /// Builder pattern: set max retries
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Builder pattern: set retry delay
    pub fn retry_delay(mut self, retry_delay: Duration) -> Self {
        self.retry_delay = retry_delay;
        self
    }

    /// Builder pattern: set check interval
    pub fn check_interval(mut self, check_interval: Duration) -> Self {
        self.check_interval = check_interval;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = TimeoutConfig::default();
        assert_eq!(config.timeout_duration, Duration::from_secs(60));
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.retry_delay, Duration::from_secs(5));
        assert_eq!(config.check_interval, Duration::from_secs(1));
    }

    #[test]
    fn test_builder_pattern() {
        let config = TimeoutConfig::with_timeout(Duration::from_secs(30))
            .max_retries(5)
            .retry_delay(Duration::from_secs(10))
            .check_interval(Duration::from_millis(500));

        assert_eq!(config.timeout_duration, Duration::from_secs(30));
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.retry_delay, Duration::from_secs(10));
        assert_eq!(config.check_interval, Duration::from_millis(500));
    }
}
