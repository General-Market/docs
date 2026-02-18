//! SourceFailureHandler - Core source failure handling logic
//!
//! Implements the state machine for AP suspension, auto-pause detection,
//! pending order timeout, and restoration.

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;

use alloy_primitives::Address;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};

use crate::error::APError;
use super::config::SourceFailureConfig;
use super::metrics::SourceFailureMetrics;
use super::types::{
    APOperationalState, PendingRefundOrder, RefundReason, RefundRequest, RefundedOrder,
    RestorationReport, SourceFailureEvent, SuspensionReason,
};

/// Result of a health check cycle
#[derive(Debug, Clone)]
pub struct HealthCheckResult {
    /// Current operational state
    pub state: APOperationalState,
    /// Orders that timed out and need refund
    pub timed_out_orders: Vec<RefundRequest>,
    /// Whether auto-pause was triggered this cycle
    pub auto_pause_triggered: bool,
}

/// Source failure handler for AP
pub struct SourceFailureHandler {
    /// Configuration
    config: SourceFailureConfig,
    /// Current operational state
    state: Arc<RwLock<APOperationalState>>,
    /// Timestamp of last successful fill
    last_fill_timestamp: Arc<RwLock<Instant>>,
    /// Timestamp when suspension started (for duration tracking)
    suspension_start: Arc<RwLock<Option<Instant>>>,
    /// Pending orders queue during suspension
    pending_queue: Arc<Mutex<VecDeque<PendingRefundOrder>>>,
    /// Refunded orders for audit trail
    refunded_orders: Arc<RwLock<Vec<RefundedOrder>>>,
    /// Metrics collector
    metrics: Arc<SourceFailureMetrics>,
    /// Event channel sender
    event_sender: Option<mpsc::Sender<SourceFailureEvent>>,
}

impl SourceFailureHandler {
    /// Create a new source failure handler with configuration
    pub fn new(config: SourceFailureConfig) -> Self {
        Self {
            config,
            state: Arc::new(RwLock::new(APOperationalState::Active)),
            last_fill_timestamp: Arc::new(RwLock::new(Instant::now())),
            suspension_start: Arc::new(RwLock::new(None)),
            pending_queue: Arc::new(Mutex::new(VecDeque::new())),
            refunded_orders: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(SourceFailureMetrics::new()),
            event_sender: None,
        }
    }

    /// Create handler with event channel for notifications
    pub fn with_event_channel(
        config: SourceFailureConfig,
        sender: mpsc::Sender<SourceFailureEvent>,
    ) -> Self {
        Self {
            config,
            state: Arc::new(RwLock::new(APOperationalState::Active)),
            last_fill_timestamp: Arc::new(RwLock::new(Instant::now())),
            suspension_start: Arc::new(RwLock::new(None)),
            pending_queue: Arc::new(Mutex::new(VecDeque::new())),
            refunded_orders: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(SourceFailureMetrics::new()),
            event_sender: Some(sender),
        }
    }

    // ========== State Queries ==========

    /// Get current operational state
    pub async fn get_state(&self) -> APOperationalState {
        *self.state.read().await
    }

    /// Check if AP is suspended or paused
    pub async fn is_suspended_or_paused(&self) -> bool {
        self.get_state().await.is_suspended_or_paused()
    }

    /// Check if AP can process orders
    pub async fn can_process_orders(&self) -> bool {
        matches!(self.get_state().await, APOperationalState::Active)
    }

    // ========== Fill Recording (Task 2) ==========

    /// Record a successful fill (resets auto-pause timer)
    pub async fn record_fill(&self) {
        let mut timestamp = self.last_fill_timestamp.write().await;
        *timestamp = Instant::now();
        debug!("Recorded fill, auto-pause timer reset");
    }

    /// Get time since last fill
    pub async fn time_since_last_fill(&self) -> Duration {
        let timestamp = self.last_fill_timestamp.read().await;
        timestamp.elapsed()
    }

    // ========== Auto-Pause Detection (Task 2) ==========

    /// Check if auto-pause should be triggered
    pub async fn check_auto_pause(&self) -> bool {
        let state = self.get_state().await;

        // Only trigger auto-pause from Active state
        if state != APOperationalState::Active {
            return false;
        }

        let elapsed = self.time_since_last_fill().await;
        if elapsed >= self.config.auto_pause_threshold {
            warn!(
                code = "E008",
                elapsed_secs = elapsed.as_secs(),
                threshold_secs = self.config.auto_pause_threshold.as_secs(),
                "Auto-pause threshold exceeded, triggering suspension"
            );

            self.suspend(SuspensionReason::AutoPause {
                offline_duration: elapsed,
            })
            .await;

            return true;
        }

        false
    }

    // ========== Suspension (Task 6) ==========

    /// Suspend the AP with a given reason
    pub async fn suspend(&self, reason: SuspensionReason) {
        let mut state = self.state.write().await;

        // Don't re-suspend if already suspended
        if *state == APOperationalState::Suspended {
            warn!(code = "E008", "AP already suspended, ignoring duplicate suspension request");
            return;
        }

        // Transition to appropriate state based on reason
        let new_state = match &reason {
            SuspensionReason::AutoPause { .. } => APOperationalState::Paused,
            SuspensionReason::BLSVote { .. } | SuspensionReason::AdminAction { .. } => {
                APOperationalState::Suspended
            }
        };

        let old_state = *state;
        *state = new_state;

        // Record suspension start time
        {
            let mut start = self.suspension_start.write().await;
            *start = Some(Instant::now());
        }

        // Update metrics
        self.metrics.set_suspended();

        warn!(
            code = "E008",
            old_state = old_state.as_str(),
            new_state = new_state.as_str(),
            reason = %reason.description(),
            "AP suspended"
        );

        // Send event
        if let Some(ref sender) = self.event_sender {
            let _ = sender
                .send(SourceFailureEvent::Suspended {
                    reason: reason.clone(),
                    timestamp: Instant::now(),
                })
                .await;
        }
    }

    // ========== Pending Order Queue (Task 3) ==========

    /// Queue an order during suspension
    pub async fn queue_pending_order(&self, order: PendingRefundOrder) {
        let state = self.get_state().await;

        if !state.is_suspended_or_paused() {
            warn!(
                order_id = %order.order_id,
                "Attempted to queue order while AP is active"
            );
            return;
        }

        let mut queue = self.pending_queue.lock().await;
        debug!(
            order_id = %order.order_id,
            queue_size = queue.len(),
            "Queueing order during suspension"
        );
        queue.push_back(order);
        self.metrics.set_pending_refunds(queue.len() as u64);
    }

    /// Get current pending queue size
    pub async fn pending_queue_size(&self) -> usize {
        self.pending_queue.lock().await.len()
    }

    // ========== Pending Timeout Check (Task 3, 4) ==========

    /// Check for orders that have exceeded the pending timeout
    pub async fn check_pending_timeouts(&self) -> Vec<RefundRequest> {
        let mut queue = self.pending_queue.lock().await;
        let mut timed_out = Vec::new();
        let mut remaining = VecDeque::new();

        while let Some(order) = queue.pop_front() {
            if order.is_timed_out(self.config.pending_order_timeout) {
                warn!(
                    order_id = %order.order_id,
                    pending_secs = order.pending_duration().as_secs(),
                    timeout_secs = self.config.pending_order_timeout.as_secs(),
                    error_code = "E009",
                    "Order pending timeout exceeded, marking for refund"
                );

                let request = RefundRequest::from_pending_order(&order, RefundReason::Timeout);
                timed_out.push(request);
            } else {
                remaining.push_back(order);
            }
        }

        *queue = remaining;
        self.metrics.set_pending_refunds(queue.len() as u64);

        // Record refunds and add to audit trail
        if !timed_out.is_empty() {
            self.metrics.record_auto_refunds(timed_out.len() as u64);

            let mut refunded = self.refunded_orders.write().await;
            for request in &timed_out {
                refunded.push(RefundedOrder::from_request(request));
            }

            // Send event
            if let Some(ref sender) = self.event_sender {
                let _ = sender
                    .send(SourceFailureEvent::RefundRequested {
                        orders: timed_out.clone(),
                        timestamp: Instant::now(),
                    })
                    .await;
            }
        }

        timed_out
    }

    /// Get all pending refund requests (for chain submission)
    pub async fn get_refund_requests(&self) -> Vec<RefundRequest> {
        let queue = self.pending_queue.lock().await;
        queue
            .iter()
            .filter(|order| order.is_timed_out(self.config.pending_order_timeout))
            .map(|order| RefundRequest::from_pending_order(order, RefundReason::Timeout))
            .collect()
    }

    // ========== Restoration (Task 5) ==========

    /// Restore the AP from suspension
    ///
    /// Returns a restoration report with details about processed/refunded orders.
    pub async fn restore(&self, restored_by: Option<Address>) -> Result<RestorationReport, APError> {
        let mut state = self.state.write().await;

        // Validate current state
        if *state == APOperationalState::Active {
            return Err(APError::InvalidRestoration {
                state: state.as_str().to_string(),
            });
        }

        // Calculate downtime duration
        let downtime_duration = {
            let start = self.suspension_start.read().await;
            start.map(|s| s.elapsed()).unwrap_or(Duration::ZERO)
        };

        // Process pending queue
        let mut queue = self.pending_queue.lock().await;
        let mut orders_processed = 0u32;
        let mut orders_refunded = 0u32;
        let mut refund_requests = Vec::new();

        // Separate timed-out orders from processable orders
        let mut processable = VecDeque::new();
        while let Some(order) = queue.pop_front() {
            if order.is_timed_out(self.config.pending_order_timeout) {
                // Order exceeded timeout, refund it
                let request = RefundRequest::from_pending_order(&order, RefundReason::Timeout);
                refund_requests.push(request);
                orders_refunded += 1;
            } else {
                // Order still valid, can be processed
                processable.push_back(order);
                orders_processed += 1;
            }
        }

        // Processable orders are considered "handled" - they would be moved back
        // to execution queue by the caller. Clear the queue since restoration is complete.
        // The caller can use get_processable_orders() before calling restore() if they
        // need to actually retrieve them.
        queue.clear();

        // Record refunds
        if orders_refunded > 0 {
            self.metrics.record_auto_refunds(orders_refunded as u64);

            let mut refunded = self.refunded_orders.write().await;
            for request in &refund_requests {
                refunded.push(RefundedOrder::from_request(request));
            }
        }

        // Update state
        *state = APOperationalState::Active;

        // Clear suspension start
        {
            let mut start = self.suspension_start.write().await;
            *start = None;
        }

        // Update metrics
        self.metrics.set_active();
        self.metrics.set_pending_refunds(queue.len() as u64);

        // Reset last fill timestamp to now (prevents immediate re-pause)
        {
            let mut timestamp = self.last_fill_timestamp.write().await;
            *timestamp = Instant::now();
        }

        info!(
            orders_processed = orders_processed,
            orders_refunded = orders_refunded,
            downtime_secs = downtime_duration.as_secs(),
            "AP restored"
        );

        let report = RestorationReport {
            orders_processed,
            orders_refunded,
            downtime_duration,
            restored_at: Instant::now(),
            restored_by,
        };

        // Send event
        if let Some(ref sender) = self.event_sender {
            let _ = sender
                .send(SourceFailureEvent::Restored {
                    report: report.clone(),
                    timestamp: Instant::now(),
                })
                .await;
        }

        Ok(report)
    }

    /// Get orders that can be processed after restoration
    pub async fn get_processable_orders(&self) -> Vec<PendingRefundOrder> {
        let mut queue = self.pending_queue.lock().await;
        let mut processable = Vec::new();

        while let Some(order) = queue.pop_front() {
            if !order.is_timed_out(self.config.pending_order_timeout) {
                processable.push(order);
            }
        }

        self.metrics.set_pending_refunds(0);
        processable
    }

    // ========== Metrics Access ==========

    /// Get metrics reference
    pub fn metrics(&self) -> Arc<SourceFailureMetrics> {
        Arc::clone(&self.metrics)
    }

    /// Get refunded orders since a given duration
    pub async fn get_refunded_orders(&self, since: Duration) -> Vec<RefundedOrder> {
        let now = Instant::now();
        let refunded = self.refunded_orders.read().await;
        match now.checked_sub(since) {
            Some(cutoff) => refunded
                .iter()
                .filter(|r| r.refunded_at >= cutoff)
                .cloned()
                .collect(),
            None => refunded.iter().cloned().collect(),
        }
    }

    // ========== Health Check (Task 2, 9) ==========

    /// Perform a full health check cycle
    pub async fn check_health(&self) -> HealthCheckResult {
        let auto_pause_triggered = self.check_auto_pause().await;
        let timed_out_orders = self.check_pending_timeouts().await;
        let state = self.get_state().await;

        HealthCheckResult {
            state,
            timed_out_orders,
            auto_pause_triggered,
        }
    }

    // ========== Background Task (Task 9) ==========

    /// Run the background monitoring task
    pub async fn run(&self, cancel_token: CancellationToken) {
        let mut interval = tokio::time::interval(self.config.health_check_interval);
        let mut heartbeat_counter = 0u64;

        info!(
            auto_pause_threshold = ?self.config.auto_pause_threshold,
            pending_order_timeout = ?self.config.pending_order_timeout,
            health_check_interval = ?self.config.health_check_interval,
            "Starting source failure handler"
        );

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    info!("Source failure handler shutting down");
                    break;
                }
                _ = interval.tick() => {
                    // Perform health check
                    let result = self.check_health().await;

                    // Log significant events
                    if result.auto_pause_triggered {
                        warn!(code = "E008", "Auto-pause triggered during health check");
                    }

                    if !result.timed_out_orders.is_empty() {
                        warn!(
                            code = "E008",
                            count = result.timed_out_orders.len(),
                            "Orders timed out during health check"
                        );
                    }

                    // Periodic heartbeat logging (every 10 checks)
                    heartbeat_counter += 1;
                    if heartbeat_counter % 10 == 0 {
                        let snapshot = self.metrics.snapshot();
                        debug!(
                            state = result.state.as_str(),
                            pending_refunds = snapshot.pending_refunds,
                            auto_refunds_total = snapshot.auto_refunds_total,
                            "Source failure handler heartbeat"
                        );
                    }
                }
            }
        }
    }
}

impl Default for SourceFailureHandler {
    fn default() -> Self {
        Self::new(SourceFailureConfig::default())
    }
}
