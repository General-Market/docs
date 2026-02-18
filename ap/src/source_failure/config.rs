//! Configuration for source failure handling
//!
//! Default values per architecture Section 16 (AP Accountability).

use std::time::Duration;

/// Configuration for source failure handling
#[derive(Debug, Clone)]
pub struct SourceFailureConfig {
    /// Duration of no fills before auto-pause (default 5 min per architecture)
    pub auto_pause_threshold: Duration,
    /// Duration before pending orders auto-refund (default 1 hour per architecture)
    pub pending_order_timeout: Duration,
    /// Health check interval (default 30s)
    pub health_check_interval: Duration,
}

impl Default for SourceFailureConfig {
    fn default() -> Self {
        Self {
            auto_pause_threshold: Duration::from_secs(5 * 60),   // 5 minutes
            pending_order_timeout: Duration::from_secs(60 * 60), // 1 hour
            health_check_interval: Duration::from_secs(30),
        }
    }
}

impl SourceFailureConfig {
    /// Create config with custom auto-pause threshold
    pub fn with_auto_pause_threshold(auto_pause_threshold: Duration) -> Self {
        Self {
            auto_pause_threshold,
            ..Default::default()
        }
    }

    /// Builder: set pending order timeout
    pub fn pending_order_timeout(mut self, timeout: Duration) -> Self {
        self.pending_order_timeout = timeout;
        self
    }

    /// Builder: set health check interval
    pub fn health_check_interval(mut self, interval: Duration) -> Self {
        self.health_check_interval = interval;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = SourceFailureConfig::default();
        assert_eq!(config.auto_pause_threshold, Duration::from_secs(5 * 60));
        assert_eq!(config.pending_order_timeout, Duration::from_secs(60 * 60));
        assert_eq!(config.health_check_interval, Duration::from_secs(30));
    }

    #[test]
    fn test_builder_pattern() {
        let config = SourceFailureConfig::with_auto_pause_threshold(Duration::from_secs(120))
            .pending_order_timeout(Duration::from_secs(1800))
            .health_check_interval(Duration::from_secs(10));

        assert_eq!(config.auto_pause_threshold, Duration::from_secs(120));
        assert_eq!(config.pending_order_timeout, Duration::from_secs(1800));
        assert_eq!(config.health_check_interval, Duration::from_secs(10));
    }
}
