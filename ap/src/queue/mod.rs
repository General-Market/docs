//! Order Queue Manager for AP/Keeper service
//!
//! Manages order execution queue with priority buckets for fair scheduling.
//! Orders are classified by size into buckets with different allocation percentages.
//!
//! ## Thread Safety
//!
//! Use `ThreadSafeQueueManager` for concurrent access from multiple tasks.
//! The base `OrderQueueManager` is NOT thread-safe and should only be used
//! in single-threaded contexts or wrapped externally.
//!
//! ## Priority Algorithm (Architecture Section 10)
//!
//! ```text
//! if rebalance_active:
//!     slots = {rebalance: 50%, user: 50%}
//! else:
//!     slots = {user: 100%}
//!
//! User order buckets:
//!     small (<$100): 30%
//!     medium ($100-$1000): 30%
//!     large ($1000-$10000): 20%
//!     xl (>$10000): 20%
//! ```

mod bucket;

pub use bucket::Bucket;

use crate::error::APError;
use crate::event_types::TradeRequestEvent;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tracing::{debug, error, info, warn};

/// Maximum retry attempts before permanent failure
const MAX_RETRIES: u32 = 3;

/// Window size for fair scheduling slot count reset
const SCHEDULING_WINDOW: u64 = 100;

/// Queue depth threshold for WARNING log (Architecture Section 10)
const QUEUE_DEPTH_WARNING: usize = 100;

/// Queue depth threshold for CRITICAL - reject new orders (Architecture Section 10)
const QUEUE_DEPTH_CRITICAL: usize = 500;

/// Order age limit before auto-expire (Architecture Section 10: 1 hour)
const ORDER_AGE_LIMIT: Duration = Duration::from_secs(3600);

/// Order wrapped with queue metadata
#[derive(Debug, Clone)]
pub struct QueuedOrder {
    /// Original trade request event
    pub trade_request: TradeRequestEvent,
    /// Time when order was added to queue
    pub arrival_time: Instant,
    /// Assigned bucket based on amount
    pub bucket: Bucket,
    /// Whether this is a rebalance order (vs user order)
    pub is_rebalance: bool,
}

/// Order in retry queue after execution failure
#[derive(Debug, Clone)]
pub struct RetryOrder {
    /// The queued order being retried
    pub order: QueuedOrder,
    /// Number of retry attempts
    pub attempts: u32,
    /// Reason for last failure
    pub last_failure: String,
    /// Time of last retry attempt
    pub last_attempt_time: Instant,
}

/// Queue depth information for monitoring
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueueDepth {
    /// Total orders in all buckets
    pub total: usize,
    /// Orders per bucket
    pub by_bucket: HashMap<Bucket, usize>,
    /// Orders in retry queue
    pub retry_count: usize,
    /// Orders in rebalance queue
    pub rebalance_count: usize,
}

/// Expired order information returned when auto-expiring stale orders
#[derive(Debug, Clone)]
pub struct ExpiredOrder {
    /// The expired order
    pub order: QueuedOrder,
    /// Age of the order when expired
    pub age: Duration,
}

/// Order Queue Manager with priority bucket scheduling
///
/// Implements fair scheduling across size-based priority buckets:
/// - Small (<$100): 30% slot allocation
/// - Medium ($100-$1k): 30% slot allocation
/// - Large ($1k-$10k): 20% slot allocation
/// - XL (>$10k): 20% slot allocation
///
/// When rebalance is active, slots are split 50/50 between rebalance and user orders.
///
/// ## Thread Safety
///
/// This struct is NOT thread-safe. For concurrent access, use `ThreadSafeQueueManager`.
pub struct OrderQueueManager {
    /// Buckets holding queued orders (FIFO within bucket)
    buckets: HashMap<Bucket, VecDeque<QueuedOrder>>,
    /// Rebalance orders queue (separate from user orders)
    rebalance_queue: VecDeque<QueuedOrder>,
    /// Orders pending retry after failure
    retry_queue: VecDeque<RetryOrder>,
    /// Slot counts for fair scheduling tracking (user orders)
    slot_counts: HashMap<Bucket, u32>,
    /// Slot count for rebalance orders
    rebalance_slot_count: u32,
    /// User order slot count (for 50/50 split tracking)
    user_slot_count: u32,
    /// Total orders processed (for scheduling window reset)
    total_processed: u64,
    /// Orders currently being processed (for mark_complete/mark_failed)
    in_flight: HashMap<String, QueuedOrder>,
    /// Track attempt counts per order (persists across retries)
    attempt_counts: HashMap<String, u32>,
    /// Whether rebalance mode is active (50/50 split)
    rebalance_active: bool,
}

impl OrderQueueManager {
    /// Create a new OrderQueueManager with empty buckets
    pub fn new() -> Self {
        let mut buckets = HashMap::new();
        buckets.insert(Bucket::Small, VecDeque::new());
        buckets.insert(Bucket::Medium, VecDeque::new());
        buckets.insert(Bucket::Large, VecDeque::new());
        buckets.insert(Bucket::XL, VecDeque::new());

        Self {
            buckets,
            rebalance_queue: VecDeque::new(),
            retry_queue: VecDeque::new(),
            slot_counts: HashMap::new(),
            rebalance_slot_count: 0,
            user_slot_count: 0,
            total_processed: 0,
            in_flight: HashMap::new(),
            attempt_counts: HashMap::new(),
            rebalance_active: false,
        }
    }

    /// Set rebalance mode active/inactive
    ///
    /// When active, slots are split 50/50 between rebalance and user orders.
    /// When inactive, all slots go to user orders.
    pub fn set_rebalance_active(&mut self, active: bool) {
        if self.rebalance_active != active {
            info!(rebalance_active = active, "Rebalance mode changed");
            self.rebalance_active = active;
            // Reset slot counts when mode changes
            self.rebalance_slot_count = 0;
            self.user_slot_count = 0;
        }
    }

    /// Check if rebalance mode is active
    pub fn is_rebalance_active(&self) -> bool {
        self.rebalance_active
    }

    /// Add an order to the queue, classifying it into the appropriate bucket
    ///
    /// Returns error if queue depth exceeds CRITICAL threshold (500).
    pub fn enqueue(&mut self, trade_request: TradeRequestEvent) -> Result<(), APError> {
        self.enqueue_internal(trade_request, false)
    }

    /// Add a rebalance order to the queue
    ///
    /// Rebalance orders go to a separate queue and get 50% of slots when active.
    pub fn enqueue_rebalance(&mut self, trade_request: TradeRequestEvent) -> Result<(), APError> {
        self.enqueue_internal(trade_request, true)
    }

    fn enqueue_internal(
        &mut self,
        trade_request: TradeRequestEvent,
        is_rebalance: bool,
    ) -> Result<(), APError> {
        // Check queue depth thresholds
        let current_depth = self.get_total_depth();

        if current_depth >= QUEUE_DEPTH_CRITICAL {
            error!(
                code = "E008",
                depth = current_depth,
                limit = QUEUE_DEPTH_CRITICAL,
                "Queue depth CRITICAL - rejecting new order"
            );
            return Err(APError::QueueFull {
                depth: current_depth,
                limit: QUEUE_DEPTH_CRITICAL,
            });
        }

        if current_depth >= QUEUE_DEPTH_WARNING {
            warn!(
                code = "E008",
                depth = current_depth,
                threshold = QUEUE_DEPTH_WARNING,
                "Queue depth WARNING - approaching capacity"
            );
        }

        let bucket = Bucket::from_amount(trade_request.amount);
        let queued_order = QueuedOrder {
            trade_request: trade_request.clone(),
            arrival_time: Instant::now(),
            bucket,
            is_rebalance,
        };

        if is_rebalance {
            self.rebalance_queue.push_back(queued_order);
            debug!(
                amount = %trade_request.amount,
                event_id = %trade_request.event_id(),
                "Rebalance order enqueued"
            );
        } else {
            // Get the bucket queue and push to back (FIFO)
            if let Some(queue) = self.buckets.get_mut(&bucket) {
                queue.push_back(queued_order);
                debug!(
                    bucket = ?bucket,
                    amount = %trade_request.amount,
                    event_id = %trade_request.event_id(),
                    "Order enqueued"
                );
            } else {
                return Err(APError::QueueError(format!(
                    "Invalid bucket: {:?}",
                    bucket
                )));
            }
        }

        Ok(())
    }

    /// Get the next order using fair scheduling across buckets
    ///
    /// Uses weighted round-robin to select from buckets according to allocation.
    /// When rebalance is active, alternates 50/50 between rebalance and user orders.
    pub fn get_next_order(&mut self) -> Option<QueuedOrder> {
        // If rebalance active, use 50/50 split logic
        if self.rebalance_active {
            return self.get_next_order_with_rebalance();
        }

        // Normal mode: 100% user orders
        self.get_next_user_order()
    }

    fn get_next_order_with_rebalance(&mut self) -> Option<QueuedOrder> {
        // 50/50 split: check which queue should get the next slot
        let rebalance_deficit = 50i32 - self.rebalance_slot_count as i32;
        let user_deficit = 50i32 - self.user_slot_count as i32;

        // Try rebalance first if it has higher deficit and has orders
        if rebalance_deficit >= user_deficit && !self.rebalance_queue.is_empty() {
            if let Some(order) = self.rebalance_queue.pop_front() {
                self.rebalance_slot_count += 1;
                self.total_processed += 1;
                self.maybe_reset_slot_counts();

                let event_id = order.trade_request.event_id();
                self.in_flight.insert(event_id.clone(), order.clone());

                debug!(
                    event_id = %event_id,
                    "Rebalance order dequeued for processing"
                );
                return Some(order);
            }
        }

        // Try user order
        if let Some(order) = self.get_next_user_order() {
            self.user_slot_count += 1;
            return Some(order);
        }

        // Fall back to rebalance if user queue empty
        if let Some(order) = self.rebalance_queue.pop_front() {
            self.rebalance_slot_count += 1;
            self.total_processed += 1;
            self.maybe_reset_slot_counts();

            let event_id = order.trade_request.event_id();
            self.in_flight.insert(event_id.clone(), order.clone());

            debug!(
                event_id = %event_id,
                "Rebalance order dequeued (fallback)"
            );
            return Some(order);
        }

        None
    }

    fn get_next_user_order(&mut self) -> Option<QueuedOrder> {
        // Allocation percentages for each bucket
        let allocations = [
            (Bucket::Small, 30),
            (Bucket::Medium, 30),
            (Bucket::Large, 20),
            (Bucket::XL, 20),
        ];

        // Find bucket with highest deficit (target - actual)
        let mut best_bucket = None;
        let mut best_deficit = i32::MIN;

        for (bucket, target_pct) in &allocations {
            if let Some(queue) = self.buckets.get(bucket) {
                if !queue.is_empty() {
                    let actual_count = self.slot_counts.get(bucket).copied().unwrap_or(0);
                    let deficit = *target_pct as i32 - actual_count as i32;
                    if deficit > best_deficit {
                        best_deficit = deficit;
                        best_bucket = Some(*bucket);
                    }
                }
            }
        }

        // Pop from selected bucket
        if let Some(bucket) = best_bucket {
            if let Some(queue) = self.buckets.get_mut(&bucket) {
                if let Some(order) = queue.pop_front() {
                    // Update slot count
                    *self.slot_counts.entry(bucket).or_insert(0) += 1;
                    self.total_processed += 1;

                    self.maybe_reset_slot_counts();

                    // Track in-flight order
                    let event_id = order.trade_request.event_id();
                    self.in_flight.insert(event_id.clone(), order.clone());

                    debug!(
                        bucket = ?bucket,
                        event_id = %event_id,
                        "Order dequeued for processing"
                    );

                    return Some(order);
                }
            }
        }

        None
    }

    fn maybe_reset_slot_counts(&mut self) {
        // Reset slot counts periodically
        if self.total_processed % SCHEDULING_WINDOW == 0 {
            self.slot_counts.clear();
            self.rebalance_slot_count = 0;
            self.user_slot_count = 0;
            debug!(
                window = SCHEDULING_WINDOW,
                total_processed = self.total_processed,
                "Scheduling window reset"
            );
        }
    }

    /// Mark an order as completed and remove from tracking
    pub fn mark_complete(&mut self, order_id: &str) -> Result<(), APError> {
        if self.in_flight.remove(order_id).is_some() {
            // Clean up attempt tracking on success
            self.attempt_counts.remove(order_id);
            info!(order_id = %order_id, "Order completed");
            Ok(())
        } else {
            warn!(code = "E009", order_id = %order_id, "Order not found in in-flight set");
            Err(APError::QueueError(format!(
                "Order not found: {}",
                order_id
            )))
        }
    }

    /// Mark an order as failed and move to retry queue
    pub fn mark_failed(&mut self, order_id: &str, reason: String) -> Result<(), APError> {
        if let Some(order) = self.in_flight.remove(order_id) {
            // Increment attempt count (stored persistently per order)
            let attempts = self
                .attempt_counts
                .entry(order_id.to_string())
                .or_insert(0);
            *attempts += 1;
            let current_attempts = *attempts;

            if current_attempts >= MAX_RETRIES {
                // Permanent failure after max retries
                warn!(
                    code = "E009",
                    order_id = %order_id,
                    attempts = current_attempts,
                    reason = %reason,
                    "Order permanently failed after max retries"
                );
                // Clean up attempt tracking
                self.attempt_counts.remove(order_id);
                // Don't add to retry queue - it's a permanent failure
                return Ok(());
            }

            let retry_order = RetryOrder {
                order,
                attempts: current_attempts,
                last_failure: reason.clone(),
                last_attempt_time: Instant::now(),
            };

            self.retry_queue.push_back(retry_order);
            warn!(
                code = "E009",
                order_id = %order_id,
                attempts = current_attempts,
                reason = %reason,
                "Order moved to retry queue"
            );
            Ok(())
        } else {
            warn!(code = "E009", order_id = %order_id, "Order not found for failure marking");
            Err(APError::QueueError(format!(
                "Order not found: {}",
                order_id
            )))
        }
    }

    /// Expire stale orders that have been in the queue for longer than 1 hour
    ///
    /// Returns a list of expired orders that should be refunded.
    /// Per Architecture Section 10: "If order age > 1 hour: → Auto-fail with refund"
    pub fn expire_stale_orders(&mut self) -> Vec<ExpiredOrder> {
        let mut expired = Vec::new();
        let now = Instant::now();

        // Check all user buckets
        for queue in self.buckets.values_mut() {
            let mut i = 0;
            while i < queue.len() {
                let age = now.duration_since(queue[i].arrival_time);
                if age > ORDER_AGE_LIMIT {
                    if let Some(order) = queue.remove(i) {
                        warn!(
                            code = "E008",
                            event_id = %order.trade_request.event_id(),
                            age_secs = age.as_secs(),
                            "Order expired - queuing for refund"
                        );
                        expired.push(ExpiredOrder { order, age });
                    }
                } else {
                    i += 1;
                }
            }
        }

        // Check rebalance queue
        let mut i = 0;
        while i < self.rebalance_queue.len() {
            let age = now.duration_since(self.rebalance_queue[i].arrival_time);
            if age > ORDER_AGE_LIMIT {
                if let Some(order) = self.rebalance_queue.remove(i) {
                    warn!(
                        code = "E008",
                        event_id = %order.trade_request.event_id(),
                        age_secs = age.as_secs(),
                        "Rebalance order expired"
                    );
                    expired.push(ExpiredOrder { order, age });
                }
            } else {
                i += 1;
            }
        }

        if !expired.is_empty() {
            info!(count = expired.len(), "Expired stale orders");
        }

        expired
    }

    /// Get current queue depth across all buckets
    pub fn get_queue_depth(&self) -> QueueDepth {
        let mut by_bucket = HashMap::new();
        let mut total = 0;

        for (bucket, queue) in &self.buckets {
            let count = queue.len();
            by_bucket.insert(*bucket, count);
            total += count;
        }

        QueueDepth {
            total,
            by_bucket,
            retry_count: self.retry_queue.len(),
            rebalance_count: self.rebalance_queue.len(),
        }
    }

    /// Get total depth including rebalance queue
    fn get_total_depth(&self) -> usize {
        let user_depth: usize = self.buckets.values().map(|q| q.len()).sum();
        user_depth + self.rebalance_queue.len()
    }

    /// Get depth for each bucket individually
    pub fn get_bucket_depths(&self) -> HashMap<Bucket, usize> {
        self.buckets
            .iter()
            .map(|(bucket, queue)| (*bucket, queue.len()))
            .collect()
    }

    /// Get retry queue depth
    pub fn get_retry_depth(&self) -> usize {
        self.retry_queue.len()
    }

    /// Get rebalance queue depth
    pub fn get_rebalance_depth(&self) -> usize {
        self.rebalance_queue.len()
    }

    /// Re-enqueue an order from the retry queue
    /// Call this when ready to retry failed orders
    pub fn retry_next(&mut self) -> Option<QueuedOrder> {
        if let Some(retry_order) = self.retry_queue.pop_front() {
            if retry_order.order.is_rebalance {
                self.rebalance_queue.push_back(retry_order.order.clone());
            } else {
                // Re-enqueue into appropriate bucket
                let bucket = retry_order.order.bucket;
                if let Some(queue) = self.buckets.get_mut(&bucket) {
                    queue.push_back(retry_order.order.clone());
                }
            }
            debug!(
                event_id = %retry_order.order.trade_request.event_id(),
                attempts = retry_order.attempts,
                "Order re-enqueued from retry queue"
            );
            Some(retry_order.order)
        } else {
            None
        }
    }
}

impl Default for OrderQueueManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe wrapper for OrderQueueManager
///
/// Use this when the queue manager needs to be accessed from multiple async tasks.
/// Internally uses RwLock for efficient concurrent reads.
///
/// # SAFETY: Lock unwrap() calls
/// All `.unwrap()` calls on `RwLock::read()`/`RwLock::write()` are intentional.
/// `std::sync::RwLock` only returns `Err` when the lock is poisoned (a thread
/// panicked while holding it), which indicates an unrecoverable state. Propagating
/// a poisoned lock would leave the queue in an inconsistent state.
#[derive(Clone)]
pub struct ThreadSafeQueueManager {
    inner: Arc<RwLock<OrderQueueManager>>,
}

impl ThreadSafeQueueManager {
    /// Create a new thread-safe queue manager
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(OrderQueueManager::new())),
        }
    }

    /// Set rebalance mode active/inactive
    pub fn set_rebalance_active(&self, active: bool) {
        self.inner.write().unwrap().set_rebalance_active(active);
    }

    /// Check if rebalance mode is active
    pub fn is_rebalance_active(&self) -> bool {
        self.inner.read().unwrap().is_rebalance_active()
    }

    /// Add an order to the queue
    pub fn enqueue(&self, trade_request: TradeRequestEvent) -> Result<(), APError> {
        self.inner.write().unwrap().enqueue(trade_request)
    }

    /// Add a rebalance order to the queue
    pub fn enqueue_rebalance(&self, trade_request: TradeRequestEvent) -> Result<(), APError> {
        self.inner.write().unwrap().enqueue_rebalance(trade_request)
    }

    /// Get the next order using fair scheduling
    pub fn get_next_order(&self) -> Option<QueuedOrder> {
        self.inner.write().unwrap().get_next_order()
    }

    /// Mark an order as completed
    pub fn mark_complete(&self, order_id: &str) -> Result<(), APError> {
        self.inner.write().unwrap().mark_complete(order_id)
    }

    /// Mark an order as failed
    pub fn mark_failed(&self, order_id: &str, reason: String) -> Result<(), APError> {
        self.inner.write().unwrap().mark_failed(order_id, reason)
    }

    /// Expire stale orders (>1 hour)
    pub fn expire_stale_orders(&self) -> Vec<ExpiredOrder> {
        self.inner.write().unwrap().expire_stale_orders()
    }

    /// Get current queue depth (read-only, uses read lock)
    pub fn get_queue_depth(&self) -> QueueDepth {
        self.inner.read().unwrap().get_queue_depth()
    }

    /// Get depth for each bucket (read-only)
    pub fn get_bucket_depths(&self) -> HashMap<Bucket, usize> {
        self.inner.read().unwrap().get_bucket_depths()
    }

    /// Get retry queue depth (read-only)
    pub fn get_retry_depth(&self) -> usize {
        self.inner.read().unwrap().get_retry_depth()
    }

    /// Get rebalance queue depth (read-only)
    pub fn get_rebalance_depth(&self) -> usize {
        self.inner.read().unwrap().get_rebalance_depth()
    }

    /// Re-enqueue an order from the retry queue
    pub fn retry_next(&self) -> Option<QueuedOrder> {
        self.inner.write().unwrap().retry_next()
    }
}

impl Default for ThreadSafeQueueManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests;
