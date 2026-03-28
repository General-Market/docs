//! Stale order watchdog for detecting and recovering stuck orders.
//!
//! Orders can get stuck in non-terminal states when a leader fails mid-cycle.
//! The watchdog detects orders that haven't progressed within a configurable
//! threshold and signals them for retry.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use ethers::types::U256;
use tracing::{debug, warn};

use super::types::BridgeOrderStatus;

/// Tracks order status transitions and detects stale orders.
pub struct StaleOrderWatchdog {
    /// Order ID → (last known status, timestamp of last status change)
    order_timestamps: HashMap<U256, (BridgeOrderStatus, Instant)>,
    /// How long an order can stay in a non-terminal status before being considered stale
    stale_threshold: Duration,
}

impl StaleOrderWatchdog {
    /// Create a new watchdog with the given staleness threshold.
    pub fn new(stale_threshold: Duration) -> Self {
        Self {
            order_timestamps: HashMap::new(),
            stale_threshold,
        }
    }

    /// Record a status change for an order. Resets the staleness timer.
    pub fn record_status_change(&mut self, order_id: U256, status: BridgeOrderStatus) {
        self.order_timestamps.insert(order_id, (status.clone(), Instant::now()));
        debug!(order_id = %order_id, status = ?status, "Watchdog: recorded status change");
    }

    /// Get all orders that are stuck in a non-terminal status for longer than the threshold.
    ///
    /// Terminal statuses (Filled, ReleasedToVault, Failed) are never considered stale.
    pub fn get_stale_orders(&self) -> Vec<(U256, BridgeOrderStatus)> {
        let mut stale = Vec::new();
        for (order_id, (status, last_change)) in &self.order_timestamps {
            // Skip terminal statuses
            if matches!(status,
                BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed |
                BridgeOrderStatus::SharesBridged | BridgeOrderStatus::BridgedBackToSettlement |
                BridgeOrderStatus::SellCompleted
            ) {
                // NOTE: SellFilled is NOT terminal — Phase C (completeSellOrder) still needs to run.
                // If Phase C permanently fails, the watchdog will detect SellFilled as stale after 10s
                // and route it through reset_stale_sell_order for retry.
                continue;
            }
            if last_change.elapsed() > self.stale_threshold {
                warn!(
                    order_id = %order_id,
                    status = ?status,
                    stale_for_secs = last_change.elapsed().as_secs(),
                    "Watchdog: stale order detected"
                );
                stale.push((*order_id, status.clone()));
            }
        }
        stale
    }

    /// Returns true if any non-terminal order has had a status change within `freshness`.
    ///
    /// Used by `has_in_flight_orders()` to gate WorkDriven cycles: orders that
    /// haven't progressed recently are not "active work" — they're stuck, and the
    /// heartbeat watchdog will handle them. Without this, a reverted tx leaves an
    /// order in-flight forever, triggering rapid WorkDriven cycles that desync oracles.
    pub fn has_fresh_in_flight(&self, freshness: Duration) -> bool {
        for (_, (status, last_change)) in &self.order_timestamps {
            // Terminal statuses are never in-flight
            if matches!(status,
                BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed |
                BridgeOrderStatus::SharesBridged | BridgeOrderStatus::BridgedBackToSettlement |
                BridgeOrderStatus::SellCompleted
            ) {
                continue;
            }
            if last_change.elapsed() < freshness {
                return true;
            }
        }
        false
    }

    /// Remove a specific order from tracking (after reset or completion).
    pub fn clear(&mut self, order_id: &U256) {
        self.order_timestamps.remove(order_id);
    }

    /// Remove all completed/terminal orders to prevent unbounded growth.
    pub fn cleanup_terminal(&mut self) {
        self.order_timestamps.retain(|_, (status, _)| {
            !matches!(status,
                BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed |
                BridgeOrderStatus::SharesBridged | BridgeOrderStatus::BridgedBackToSettlement |
                BridgeOrderStatus::SellCompleted
            )
        });
    }

    /// Get the number of tracked orders.
    pub fn tracked_count(&self) -> usize {
        self.order_timestamps.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn test_no_stale_orders_initially() {
        let watchdog = StaleOrderWatchdog::new(Duration::from_secs(30));
        assert!(watchdog.get_stale_orders().is_empty());
    }

    #[test]
    fn test_recent_order_not_stale() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_secs(30));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Pending);
        assert!(watchdog.get_stale_orders().is_empty());
    }

    #[test]
    fn test_old_order_is_stale() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_millis(50));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::SubmittedOnL3);
        sleep(Duration::from_millis(60));
        let stale = watchdog.get_stale_orders();
        assert_eq!(stale.len(), 1);
        assert_eq!(stale[0].0, U256::from(1));
    }

    #[test]
    fn test_terminal_status_never_stale() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_millis(50));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Filled);
        watchdog.record_status_change(U256::from(2), BridgeOrderStatus::ReleasedToVault);
        watchdog.record_status_change(U256::from(3), BridgeOrderStatus::Failed);
        sleep(Duration::from_millis(60));
        assert!(watchdog.get_stale_orders().is_empty());
    }

    #[test]
    fn test_status_update_resets_timer() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_millis(100));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Pending);
        sleep(Duration::from_millis(60));
        // Update status — resets timer
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::BridgedToL3);
        sleep(Duration::from_millis(60));
        // Only 60ms since last update, threshold is 100ms
        assert!(watchdog.get_stale_orders().is_empty());
    }

    #[test]
    fn test_clear_removes_order() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_millis(50));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Pending);
        watchdog.clear(&U256::from(1));
        sleep(Duration::from_millis(60));
        assert!(watchdog.get_stale_orders().is_empty());
    }

    #[test]
    fn test_cleanup_terminal() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_secs(30));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Filled);
        watchdog.record_status_change(U256::from(2), BridgeOrderStatus::Pending);
        watchdog.record_status_change(U256::from(3), BridgeOrderStatus::Failed);
        assert_eq!(watchdog.tracked_count(), 3);
        watchdog.cleanup_terminal();
        assert_eq!(watchdog.tracked_count(), 1); // Only Pending remains
    }

    #[test]
    fn test_fresh_in_flight_recent_order() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_secs(300));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Batched);
        // Just created — well within 30s freshness
        assert!(watchdog.has_fresh_in_flight(Duration::from_secs(30)));
    }

    #[test]
    fn test_fresh_in_flight_stale_order() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_secs(300));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Batched);
        sleep(Duration::from_millis(80));
        // 80ms > 50ms freshness — no longer fresh
        assert!(!watchdog.has_fresh_in_flight(Duration::from_millis(50)));
    }

    #[test]
    fn test_fresh_in_flight_terminal_ignored() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_secs(300));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Failed);
        watchdog.record_status_change(U256::from(2), BridgeOrderStatus::SellCompleted);
        // Terminal orders are never "fresh in-flight" even if just created
        assert!(!watchdog.has_fresh_in_flight(Duration::from_secs(30)));
    }

    #[test]
    fn test_fresh_in_flight_mixed() {
        let mut watchdog = StaleOrderWatchdog::new(Duration::from_secs(300));
        watchdog.record_status_change(U256::from(1), BridgeOrderStatus::Batched);
        sleep(Duration::from_millis(80));
        // Order 1 is stale (80ms > 50ms)
        // Add a fresh sell order
        watchdog.record_status_change(U256::from(2), BridgeOrderStatus::SellPending);
        // At least one fresh non-terminal order exists
        assert!(watchdog.has_fresh_in_flight(Duration::from_millis(50)));
    }
}
