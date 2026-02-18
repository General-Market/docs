//! TimeoutHandler - Core timeout tracking and retry management
//!
//! Monitors orders for 60-second timeout (NFR8) and manages retry logic.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::Instant as TokioInstant;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

use super::config::TimeoutConfig;
use super::metrics::TimeoutMetrics;
use super::types::{FailedOrder, OrderId, TimeoutEvent, TimeoutReason, TimeoutStatus, TrackedOrder};

/// Result of a timeout check cycle
#[derive(Debug, Clone)]
pub struct TimeoutCheckResult {
    /// Orders that timed out this cycle
    pub timed_out: Vec<OrderId>,
    /// Orders ready for retry
    pub ready_for_retry: Vec<OrderId>,
    /// Orders permanently failed
    pub failed: Vec<OrderId>,
}

/// Timeout handler for AP orders
pub struct TimeoutHandler {
    /// Configuration
    config: TimeoutConfig,
    /// Active orders being tracked
    tracked_orders: Arc<RwLock<HashMap<OrderId, TrackedOrder>>>,
    /// Orders in retry queue waiting for retry_delay
    retry_queue: Arc<Mutex<VecDeque<TrackedOrder>>>,
    /// Permanently failed orders for investigation
    failed_orders: Arc<RwLock<Vec<FailedOrder>>>,
    /// Metrics collector
    metrics: Arc<TimeoutMetrics>,
    /// Channel to send timeout events
    event_sender: Option<mpsc::Sender<TimeoutEvent>>,
}

impl TimeoutHandler {
    /// Create a new timeout handler with configuration
    pub fn new(config: TimeoutConfig) -> Self {
        Self {
            config,
            tracked_orders: Arc::new(RwLock::new(HashMap::new())),
            retry_queue: Arc::new(Mutex::new(VecDeque::new())),
            failed_orders: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(TimeoutMetrics::new()),
            event_sender: None,
        }
    }

    /// Create handler with event channel for notifications
    pub fn with_event_channel(config: TimeoutConfig, sender: mpsc::Sender<TimeoutEvent>) -> Self {
        Self {
            config,
            tracked_orders: Arc::new(RwLock::new(HashMap::new())),
            retry_queue: Arc::new(Mutex::new(VecDeque::new())),
            failed_orders: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(TimeoutMetrics::new()),
            event_sender: Some(sender),
        }
    }

    /// Start tracking an order for timeout
    pub async fn track_order(&self, order_id: OrderId) {
        let tracked = TrackedOrder::new(order_id.clone());
        let mut orders = self.tracked_orders.write().await;
        orders.insert(order_id.clone(), tracked);
        self.metrics.increment_in_flight();
        debug!(order_id = %order_id, "Started tracking order for timeout");
    }

    /// Stop tracking an order (called when fill is successful)
    pub async fn untrack_order(&self, order_id: &str) -> bool {
        let mut orders = self.tracked_orders.write().await;
        if orders.remove(order_id).is_some() {
            self.metrics.decrement_in_flight();
            debug!(order_id = %order_id, "Stopped tracking order (filled successfully)");
            true
        } else {
            // Check retry queue
            let mut retry_queue = self.retry_queue.lock().await;
            let initial_len = retry_queue.len();
            retry_queue.retain(|o| o.order_id != order_id);
            if retry_queue.len() < initial_len {
                self.metrics.decrement_in_flight();
                debug!(order_id = %order_id, "Removed order from retry queue (filled successfully)");
                true
            } else {
                warn!(code = "E009", order_id = %order_id, "Order not found for untracking");
                false
            }
        }
    }

    /// Check all tracked orders for timeouts
    pub async fn check_timeouts(&self) -> TimeoutCheckResult {
        let mut result = TimeoutCheckResult {
            timed_out: Vec::new(),
            ready_for_retry: Vec::new(),
            failed: Vec::new(),
        };

        // Collected side effects to process after releasing the write lock
        let mut to_move_to_retry: Vec<TrackedOrder> = Vec::new();
        let mut newly_failed: Vec<(OrderId, u32, Duration)> = Vec::new();
        let mut timed_out_events: Vec<(OrderId, u32)> = Vec::new();

        // Phase 1: Identify timeouts under write lock (no awaits on other locks or channels)
        {
            let mut orders = self.tracked_orders.write().await;
            let mut to_remove: Vec<OrderId> = Vec::new();

            for (order_id, tracked) in orders.iter_mut() {
                if tracked.status == TimeoutStatus::Active
                    && tracked.is_timed_out(self.config.timeout_duration)
                {
                    tracked.mark_timed_out();
                    self.metrics.record_timeout();

                    if tracked.retry_count > self.config.max_retries {
                        tracked.mark_failed();
                        result.failed.push(order_id.clone());
                        to_remove.push(order_id.clone());
                        newly_failed.push((
                            order_id.clone(),
                            tracked.retry_count,
                            tracked.start_time.elapsed(),
                        ));
                        self.metrics.record_failure();
                    } else {
                        tracked.mark_retrying();
                        result.timed_out.push(order_id.clone());
                        to_move_to_retry.push(tracked.clone());
                        to_remove.push(order_id.clone());
                        timed_out_events.push((order_id.clone(), tracked.retry_count));
                    }
                }
            }

            for order_id in &to_remove {
                orders.remove(order_id);
            }
        } // tracked_orders write lock released

        // Phase 2: Move to retry queue (separate lock scope)
        if !to_move_to_retry.is_empty() {
            let mut retry_queue = self.retry_queue.lock().await;
            for order in to_move_to_retry {
                retry_queue.push_back(order);
            }
        }

        // Phase 3: Record failures and send events (no tracked_orders lock held)
        for (order_id, retry_count, elapsed) in &newly_failed {
            let failed = FailedOrder::new(
                order_id.clone(),
                *retry_count,
                *elapsed,
                TimeoutReason::MaxRetriesExceeded,
            );

            error!(
                code = "E009",
                order_id = %order_id,
                retry_count = retry_count,
                elapsed = ?elapsed,
                "Order permanently failed after max retries"
            );

            self.failed_orders.write().await.push(failed);

            if let Some(ref sender) = self.event_sender {
                let _ = sender
                    .send(TimeoutEvent::OrderFailed {
                        order_id: order_id.clone(),
                        reason: "Max retries exceeded".to_string(),
                    })
                    .await;
            }
        }

        for (order_id, retry_count) in &timed_out_events {
            warn!(
                code = "E009",
                order_id = %order_id,
                retry_count = retry_count,
                "Order timed out, moving to retry queue"
            );

            if let Some(ref sender) = self.event_sender {
                let _ = sender
                    .send(TimeoutEvent::OrderTimedOut {
                        order_id: order_id.clone(),
                        retry_count: *retry_count,
                    })
                    .await;
            }
        }

        result
    }

    /// Get next order ready for retry (retry_delay has elapsed)
    pub async fn get_next_retry(&self) -> Option<OrderId> {
        let mut retry_queue = self.retry_queue.lock().await;

        // Find first order ready for retry
        let ready_idx = retry_queue.iter().position(|o| {
            o.is_ready_for_retry(self.config.retry_delay)
        });

        if let Some(idx) = ready_idx {
            if let Some(mut order) = retry_queue.remove(idx) {
                order.reset_for_retry();
                self.metrics.record_retry();

                // Re-add to tracked orders
                let order_id = order.order_id.clone();
                self.tracked_orders.write().await.insert(order_id.clone(), order);

                info!(order_id = %order_id, "Order ready for retry");
                return Some(order_id);
            }
        }

        None
    }

    /// Move a specific order to retry queue (called externally on failure)
    pub async fn move_to_retry(&self, order_id: &str) -> bool {
        let mut orders = self.tracked_orders.write().await;

        if let Some(mut tracked) = orders.remove(order_id) {
            tracked.mark_timed_out();
            tracked.mark_retrying();

            // Check max retries
            if tracked.retry_count > self.config.max_retries {
                tracked.mark_failed();
                self.metrics.record_failure();

                let failed = FailedOrder::new(
                    order_id.to_string(),
                    tracked.retry_count,
                    tracked.start_time.elapsed(),
                    TimeoutReason::MaxRetriesExceeded,
                );

                error!(
                    code = "E009",
                    order_id = %order_id,
                    retry_count = tracked.retry_count,
                    "Order permanently failed after max retries"
                );

                self.failed_orders.write().await.push(failed);
                self.metrics.decrement_in_flight();
                return false;
            }

            self.retry_queue.lock().await.push_back(tracked);
            self.metrics.record_timeout();
            true
        } else {
            warn!(code = "E009", order_id = %order_id, "Order not found for retry");
            false
        }
    }

    /// Check if order has exceeded max retries
    pub async fn is_max_retries_exceeded(&self, order_id: &str) -> bool {
        let orders = self.tracked_orders.read().await;
        if let Some(tracked) = orders.get(order_id) {
            return tracked.retry_count >= self.config.max_retries;
        }

        let retry_queue = self.retry_queue.lock().await;
        for order in retry_queue.iter() {
            if order.order_id == order_id {
                return order.retry_count >= self.config.max_retries;
            }
        }

        false
    }

    /// Get count of timeouts within a time window
    pub fn get_timeout_count(&self, time_window: Duration) -> u64 {
        self.metrics.get_timeout_count(time_window)
    }

    /// Get failed orders since a given duration
    pub async fn get_failed_orders(&self, since: Duration) -> Vec<FailedOrder> {
        let now = TokioInstant::now();
        let failed = self.failed_orders.read().await;
        match now.checked_sub(since) {
            Some(cutoff) => failed
                .iter()
                .filter(|f| f.failed_at >= cutoff)
                .cloned()
                .collect(),
            None => failed.iter().cloned().collect(), // window exceeds runtime, return all
        }
    }

    /// Get metrics reference for external access
    pub fn metrics(&self) -> Arc<TimeoutMetrics> {
        Arc::clone(&self.metrics)
    }

    /// Run the background timeout checker
    pub async fn run(&self, cancel_token: CancellationToken) {
        let mut interval = tokio::time::interval(self.config.check_interval);
        let mut heartbeat_counter = 0u64;

        info!(
            timeout_duration = ?self.config.timeout_duration,
            max_retries = self.config.max_retries,
            check_interval = ?self.config.check_interval,
            "Starting timeout handler"
        );

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    info!("Timeout handler shutting down");
                    break;
                }
                _ = interval.tick() => {
                    // Check for timeouts
                    let result = self.check_timeouts().await;

                    // Process ready retries
                    while let Some(order_id) = self.get_next_retry().await {
                        debug!(order_id = %order_id, "Processing retry");
                        // Caller should re-submit this order
                    }

                    // Periodic heartbeat logging
                    heartbeat_counter += 1;
                    if heartbeat_counter % 60 == 0 {
                        let metrics = self.metrics.snapshot();
                        info!(
                            in_flight = metrics.in_flight,
                            timeouts_total = metrics.timeouts_total,
                            failures_total = metrics.failures_total,
                            "Timeout handler heartbeat"
                        );
                    }

                    // Log any events this cycle
                    if !result.timed_out.is_empty() || !result.failed.is_empty() {
                        debug!(
                            timed_out = result.timed_out.len(),
                            failed = result.failed.len(),
                            "Timeout check cycle complete"
                        );
                    }
                }
            }
        }
    }

    /// Get current in-flight count
    pub async fn in_flight_count(&self) -> usize {
        self.tracked_orders.read().await.len()
    }

    /// Get retry queue depth
    pub async fn retry_queue_depth(&self) -> usize {
        self.retry_queue.lock().await.len()
    }
}

impl Default for TimeoutHandler {
    fn default() -> Self {
        Self::new(TimeoutConfig::default())
    }
}
