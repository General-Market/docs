//! Type definitions for timeout handling
//!
//! Structs for tracking orders, timeout status, and failure records.

use std::time::Duration;
use tokio::time::Instant;

/// Unique order identifier (matches event_id format from TradeRequestEvent)
pub type OrderId = String;

/// Status of an order being tracked for timeout
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeoutStatus {
    /// Order is being executed, not yet timed out
    Active,
    /// 60s elapsed, pending retry decision
    TimedOut,
    /// In retry queue, waiting for retry_delay
    Retrying,
    /// Max retries exceeded, logged for investigation
    Failed,
}

/// An order being tracked for timeout
#[derive(Debug, Clone)]
pub struct TrackedOrder {
    /// Order identifier (event_id format: "block:tx_hash:log_index")
    pub order_id: OrderId,
    /// Time when tracking started
    pub start_time: Instant,
    /// Number of retry attempts made
    pub retry_count: u32,
    /// Current status
    pub status: TimeoutStatus,
    /// Time of last timeout (for retry scheduling)
    pub last_timeout: Option<Instant>,
}

impl TrackedOrder {
    /// Create a new tracked order
    pub fn new(order_id: OrderId) -> Self {
        Self {
            order_id,
            start_time: Instant::now(),
            retry_count: 0,
            status: TimeoutStatus::Active,
            last_timeout: None,
        }
    }

    /// Check if order has exceeded the timeout duration
    pub fn is_timed_out(&self, timeout_duration: Duration) -> bool {
        self.start_time.elapsed() >= timeout_duration
    }

    /// Check if ready for retry (retry_delay has elapsed since last timeout)
    pub fn is_ready_for_retry(&self, retry_delay: Duration) -> bool {
        match self.last_timeout {
            Some(timeout_time) => timeout_time.elapsed() >= retry_delay,
            None => false,
        }
    }

    /// Mark as timed out and increment retry count
    pub fn mark_timed_out(&mut self) {
        self.retry_count += 1;
        self.status = TimeoutStatus::TimedOut;
        self.last_timeout = Some(Instant::now());
    }

    /// Mark as retrying (moved to retry queue)
    pub fn mark_retrying(&mut self) {
        self.status = TimeoutStatus::Retrying;
    }

    /// Mark as permanently failed
    pub fn mark_failed(&mut self) {
        self.status = TimeoutStatus::Failed;
    }

    /// Reset for retry attempt (new start time, keep retry count)
    pub fn reset_for_retry(&mut self) {
        self.start_time = Instant::now();
        self.status = TimeoutStatus::Active;
    }
}

/// Reason for order timeout failure
#[derive(Debug, Clone)]
pub enum TimeoutReason {
    /// Order timed out after max retries
    MaxRetriesExceeded,
    /// External error during execution
    ExecutionError(String),
}

/// Record of a permanently failed order for investigation
#[derive(Debug, Clone)]
pub struct FailedOrder {
    /// Order identifier
    pub order_id: OrderId,
    /// Total retry attempts made
    pub total_attempts: u32,
    /// Total time from first tracking to failure
    pub elapsed_time: Duration,
    /// Reason for permanent failure
    pub failure_reason: TimeoutReason,
    /// Timestamp when failure was recorded (for logging)
    pub failed_at: Instant,
}

impl FailedOrder {
    /// Create a new failed order record
    pub fn new(
        order_id: OrderId,
        total_attempts: u32,
        elapsed_time: Duration,
        failure_reason: TimeoutReason,
    ) -> Self {
        Self {
            order_id,
            total_attempts,
            elapsed_time,
            failure_reason,
            failed_at: Instant::now(),
        }
    }
}

/// Events emitted by the timeout handler
#[derive(Debug, Clone)]
pub enum TimeoutEvent {
    /// Order timed out (may be retried)
    OrderTimedOut {
        order_id: OrderId,
        retry_count: u32,
    },
    /// Order permanently failed after max retries
    OrderFailed {
        order_id: OrderId,
        reason: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tracked_order_creation() {
        let order = TrackedOrder::new("100:0x123:0".to_string());
        assert_eq!(order.order_id, "100:0x123:0");
        assert_eq!(order.retry_count, 0);
        assert_eq!(order.status, TimeoutStatus::Active);
        assert!(order.last_timeout.is_none());
    }

    #[test]
    fn test_timeout_status_transitions() {
        let mut order = TrackedOrder::new("test".to_string());
        assert_eq!(order.status, TimeoutStatus::Active);

        order.mark_timed_out();
        assert_eq!(order.status, TimeoutStatus::TimedOut);
        assert_eq!(order.retry_count, 1);
        assert!(order.last_timeout.is_some());

        order.mark_retrying();
        assert_eq!(order.status, TimeoutStatus::Retrying);

        order.reset_for_retry();
        assert_eq!(order.status, TimeoutStatus::Active);

        order.mark_failed();
        assert_eq!(order.status, TimeoutStatus::Failed);
    }

    #[test]
    fn test_failed_order_creation() {
        let failed = FailedOrder::new(
            "test".to_string(),
            3,
            Duration::from_secs(180),
            TimeoutReason::MaxRetriesExceeded,
        );
        assert_eq!(failed.order_id, "test");
        assert_eq!(failed.total_attempts, 3);
        assert_eq!(failed.elapsed_time, Duration::from_secs(180));
    }
}
