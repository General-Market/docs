# Story 4.3: Order Queue Manager

Status: done

## Story

As an **AP (Authorized Participant)**,
I want **to manage a queue of orders to execute**,
So that **orders are processed in correct order with fair scheduling across size buckets**.

## Acceptance Criteria

1. **Given** TradeRequest events from Story 4.2 Event Monitor
   **When** orders arrive
   **Then** they are queued in FIFO order by arrival time

2. **Given** orders in the queue
   **When** orders are classified by size
   **Then** they are placed in priority buckets:
   - small (<$100): 30% slot allocation
   - medium ($100-$1k): 30% slot allocation
   - large ($1k-$10k): 20% slot allocation
   - xl (>$10k): 20% slot allocation

3. **Given** multiple buckets have pending orders
   **When** `get_next_order()` is called
   **Then** fair scheduling selects from buckets according to their allocation percentages

4. **Given** an order has been executed
   **When** I call `mark_complete(order_id)`
   **Then** the order is removed from the queue

5. **Given** an order execution failed
   **When** I call `mark_failed(order_id, reason)`
   **Then** the order is moved to the retry queue with failure reason logged

6. **Given** the queue state
   **When** I call `get_queue_depth()`
   **Then** it returns the current total queue size across all buckets

7. **Given** the Order Queue Manager implementation
   **When** running unit tests
   **Then** FIFO ordering and bucket fairness are verified

## Tasks / Subtasks

- [x] Task 1: Create OrderQueueManager struct and module (AC: #1, #6)
  - [x] Create `ap/src/queue/mod.rs` module
  - [x] Define `OrderQueueManager` struct with bucket storage
  - [x] Define `QueuedOrder` struct wrapping TradeRequest with arrival timestamp
  - [x] Implement constructor `new()` with empty buckets
  - [x] Add fields: `buckets: HashMap<Bucket, VecDeque<QueuedOrder>>`, `retry_queue: VecDeque<RetryOrder>`

- [x] Task 2: Define Bucket enum and classification logic (AC: #2)
  - [x] Create `Bucket` enum: `Small`, `Medium`, `Large`, `XL`
  - [x] Implement `Bucket::from_amount(amount: U256) -> Bucket`
  - [x] Define thresholds: <$100 (1e20 wei), <$1k (1e21 wei), <$10k (1e22 wei), >=$10k
  - [x] Add `Bucket::allocation_percent() -> u8` method (30, 30, 20, 20)

- [x] Task 3: Implement order enqueue (AC: #1)
  - [x] Create `enqueue(trade_request: TradeRequest) -> Result<(), Error>`
  - [x] Classify order by amount into appropriate bucket
  - [x] Add QueuedOrder with `arrival_time: Instant::now()`
  - [x] Maintain FIFO within bucket (push_back)
  - [x] Log enqueue event with bucket classification

- [x] Task 4: Implement fair scheduling algorithm (AC: #3)
  - [x] Create `get_next_order() -> Option<QueuedOrder>`
  - [x] Track `slot_counts: HashMap<Bucket, u32>` for fair share tracking
  - [x] Implement weighted round-robin across buckets
  - [x] Reset slot counts every 100 orders (or configurable window)
  - [x] Fall back to any available bucket if target bucket empty
  - [x] Handle edge case: all buckets empty → return None

- [x] Task 5: Implement mark_complete (AC: #4)
  - [x] Create `mark_complete(order_id: OrderId) -> Result<(), Error>`
  - [x] Remove order from active processing set
  - [x] Update metrics: orders_completed counter
  - [x] Log completion with duration

- [x] Task 6: Implement mark_failed and retry queue (AC: #5)
  - [x] Create `mark_failed(order_id: OrderId, reason: String) -> Result<(), Error>`
  - [x] Define `RetryOrder { order: QueuedOrder, attempts: u32, last_failure: String }`
  - [x] Move order to retry queue
  - [x] Track attempt count (max 3 retries per architecture)
  - [x] After 3 failures → permanent failure, log for investigation
  - [x] Update metrics: orders_failed counter

- [x] Task 7: Implement get_queue_depth and metrics (AC: #6)
  - [x] Create `get_queue_depth() -> QueueDepth` struct
  - [x] Return: total count, per-bucket counts, retry queue count
  - [x] Implement `get_bucket_depths() -> HashMap<Bucket, usize>`
  - [x] Add metrics for monitoring: queue_depth_total, queue_depth_by_bucket

- [x] Task 8: Write unit tests (AC: #7)
  - [x] Test FIFO ordering within bucket
  - [x] Test bucket classification at boundary values
  - [x] Test fair scheduling distributes according to percentages
  - [x] Test mark_complete removes from queue
  - [x] Test mark_failed moves to retry queue
  - [x] Test retry limit (3 attempts)
  - [x] Test get_queue_depth accuracy
  - [x] Test edge cases: empty queue, single bucket with orders

## Dev Notes

### Architecture Context

The Order Queue Manager is a core component of the **AP/Keeper Service** (Epic 4). It receives `TradeRequest` events from the Event Monitor (Story 4.2) and manages execution order.

```
AP Service Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                         AP/Keeper Service                        │
├─────────────────────────────────────────────────────────────────┤
│  Event Monitor (4.2)                                             │
│       │                                                          │
│       ▼ TradeRequest events                                      │
│  ┌───────────────────────────────────────┐                      │
│  │     ORDER QUEUE MANAGER (4.3)          │ ◀── THIS STORY      │
│  │  ┌─────────────────────────────────┐  │                      │
│  │  │ Buckets:                        │  │                      │
│  │  │  small  [████░░░░] 30%          │  │                      │
│  │  │  medium [████░░░░] 30%          │  │                      │
│  │  │  large  [██░░░░░░] 20%          │  │                      │
│  │  │  xl     [██░░░░░░] 20%          │  │                      │
│  │  └─────────────────────────────────┘  │                      │
│  │         │                              │                      │
│  │         ▼ get_next_order()            │                      │
│  └───────────────────────────────────────┘                      │
│       │                                                          │
│       ▼                                                          │
│  Fill Reporter (4.4) → Execute on Bitget                        │
└─────────────────────────────────────────────────────────────────┘
```

[Source: architecture.md#Section-10-throughput-priority]

### Priority Algorithm Detail

From architecture Section 10:

```
if rebalance_active:
    slots = {rebalance: 50%, user: 50%}
else:
    slots = {user: 100%}

User order buckets:
    small (<$100): 30%
    medium ($100-$1000): 30%
    large ($1000-$10000): 20%
    xl (>$10000): 20%

Within bucket: FIFO (oldest first)
```

The fair scheduling ensures small orders don't get starved by large orders. Example with 100-order window:
- 30 orders from small bucket
- 30 orders from medium bucket
- 20 orders from large bucket
- 20 orders from xl bucket

[Source: architecture.md#10-throughput-priority]

### Overload Handling

Queue depth triggers from architecture:
```
Queue monitoring:
  depth > 100: WARNING
  depth > 500: CRITICAL (pause new orders)
```

The queue manager should expose metrics for this monitoring.

[Source: architecture.md#overload-handling]

### TradeRequest Event Structure

The Event Monitor (Story 4.2) provides `TradeRequest` events with:
- `orderId`: Unique order identifier
- `pairId`: Trading pair identifier
- `side`: Buy or Sell
- `amount`: Order amount in USDC (18 decimals)
- `limitPrice`: Maximum/minimum acceptable price

Amount thresholds (18 decimals):
- $100 = 100 * 10^18 = 1e20 wei
- $1,000 = 1e21 wei
- $10,000 = 1e22 wei

### Retry Logic

From architecture Section 16 (AP Accountability):
- Timeout: 60 seconds for order execution
- Max retries: 3 attempts
- After 3 failures: order marked as failed, logged for investigation

The retry queue feeds back into the main queue (different from the bucket queues) with tracking.

[Source: architecture.md#16-ap-accountability]

### Project Structure Notes

Create new module at:
```
ap/
├── src/
│   ├── lib.rs           # Add `pub mod queue;`
│   ├── main.rs
│   └── queue/
│       ├── mod.rs       # OrderQueueManager struct and impl
│       ├── bucket.rs    # Bucket enum and classification
│       └── tests.rs     # Unit tests (cfg(test) module)
```

Follows the pattern established in issuer crate (e.g., `issuer/src/batcher/`).

### Technical Requirements

- **Language**: Rust
- **Async**: Use `async/await` pattern (tokio runtime)
- **Data Structures**: `VecDeque` for FIFO queues, `HashMap` for bucket storage
- **Concurrency**: Consider `Arc<Mutex<>>` if accessed from multiple tasks
- **Error Handling**: Use `common::error::Error` type
- **Types**: Use types from `common::types` crate
- **Logging**: Use `tracing` crate for structured JSON logs

### Code Patterns to Follow

From existing AP crate (`ap/src/main.rs`):
```rust
// Use tracing for logging
use tracing::{info, warn, error};

// Use common types
use common::types::{OrderId, Side};
use common::error::Error;

// Use ethers types for chain data
use ethers::types::U256;

// Use tokio for async
use tokio::sync::Mutex;
use std::collections::{HashMap, VecDeque};
```

### Data Structures

```rust
/// Bucket classification for priority scheduling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Bucket {
    Small,   // <$100
    Medium,  // $100-$1000
    Large,   // $1000-$10000
    XL,      // >$10000
}

/// Order wrapped with queue metadata
#[derive(Debug, Clone)]
pub struct QueuedOrder {
    pub trade_request: TradeRequest,
    pub arrival_time: std::time::Instant,
    pub bucket: Bucket,
}

/// Order in retry queue
#[derive(Debug, Clone)]
pub struct RetryOrder {
    pub order: QueuedOrder,
    pub attempts: u32,
    pub last_failure: String,
    pub last_attempt_time: std::time::Instant,
}

/// Queue depth information
#[derive(Debug, Clone)]
pub struct QueueDepth {
    pub total: usize,
    pub by_bucket: HashMap<Bucket, usize>,
    pub retry_count: usize,
}
```

### Fair Scheduling Implementation

```rust
impl OrderQueueManager {
    /// Weighted round-robin selection
    pub fn get_next_order(&mut self) -> Option<QueuedOrder> {
        // Allocation: Small 30%, Medium 30%, Large 20%, XL 20%
        let allocations = [
            (Bucket::Small, 30),
            (Bucket::Medium, 30),
            (Bucket::Large, 20),
            (Bucket::XL, 20),
        ];

        // Find bucket with highest deficit
        let mut best_bucket = None;
        let mut best_deficit = i32::MIN;

        for (bucket, target_pct) in &allocations {
            if let Some(queue) = self.buckets.get(bucket) {
                if !queue.is_empty() {
                    let actual_pct = self.slot_counts.get(bucket).copied().unwrap_or(0);
                    let deficit = *target_pct as i32 - actual_pct as i32;
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
                let order = queue.pop_front();
                *self.slot_counts.entry(bucket).or_insert(0) += 1;
                // Reset counts periodically
                if self.total_processed % 100 == 0 {
                    self.slot_counts.clear();
                }
                return order;
            }
        }

        None
    }
}
```

### Integration with Event Monitor

The Event Monitor (Story 4.2) will call into the queue manager:

```rust
// In event_monitor.rs
async fn handle_trade_request(&self, event: TradeRequestEvent) {
    let trade_request = TradeRequest::from(event);
    self.queue_manager.enqueue(trade_request).await?;
}
```

### Metrics to Expose

For Prometheus-style monitoring (Story 4.9):
- `ap_queue_depth_total` - Total orders in queue
- `ap_queue_depth_bucket{bucket="small|medium|large|xl"}` - Per-bucket depth
- `ap_queue_retry_depth` - Orders in retry queue
- `ap_orders_enqueued_total` - Counter of orders added
- `ap_orders_completed_total` - Counter of orders completed
- `ap_orders_failed_total` - Counter of orders failed (after retries)

### Testing Approach

1. **FIFO Tests**: Enqueue multiple orders, verify dequeue order within bucket
2. **Bucket Classification**: Test boundary values ($99.99 → Small, $100 → Medium)
3. **Fair Scheduling**: Enqueue 100 orders across buckets, verify ~30/30/20/20 distribution
4. **Complete/Fail Flow**: Verify orders removed and metrics updated
5. **Retry Limit**: Fail order 3 times, verify permanent failure
6. **Edge Cases**: Empty queue, single item, all in one bucket

Example test:
```rust
#[tokio::test]
async fn test_fair_scheduling_distribution() {
    let mut manager = OrderQueueManager::new();

    // Add 10 orders to each bucket
    for _ in 0..10 {
        manager.enqueue(make_order(50)).unwrap();   // Small
        manager.enqueue(make_order(500)).unwrap();  // Medium
        manager.enqueue(make_order(5000)).unwrap(); // Large
        manager.enqueue(make_order(50000)).unwrap();// XL
    }

    // Process 100 orders and count distribution
    let mut counts = HashMap::new();
    for _ in 0..40 {  // Only 40 total orders
        if let Some(order) = manager.get_next_order() {
            *counts.entry(order.bucket).or_insert(0) += 1;
        }
    }

    // Verify approximate distribution
    assert!((counts[&Bucket::Small] as f64 / 40.0 - 0.30).abs() < 0.1);
    assert!((counts[&Bucket::Medium] as f64 / 40.0 - 0.30).abs() < 0.1);
    // ... etc
}
```

### References

- [Source: architecture.md#10-throughput-priority] - Priority algorithm and bucket allocations
- [Source: architecture.md#overload-handling] - Queue depth thresholds
- [Source: architecture.md#16-ap-accountability] - Retry logic and timeouts
- [Source: epics.md#story-43-order-queue-manager] - Story definition
- [Source: common/src/types/order.rs] - Order types
- [Source: ap/src/main.rs] - AP binary skeleton and patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - Implementation proceeded without blocking issues.

### Completion Notes List

- Implemented Order Queue Manager with priority bucket scheduling for fair order processing
- Created `Bucket` enum with size-based classification: Small (<$100), Medium ($100-$1k), Large ($1k-$10k), XL (>$10k)
- Allocation percentages: Small 30%, Medium 30%, Large 20%, XL 20% - verified to sum to 100%
- Implemented weighted round-robin fair scheduling algorithm with deficit-based bucket selection
- Scheduling window resets every 100 orders to maintain fair distribution
- Retry logic tracks attempts persistently across re-enqueues with max 3 retries before permanent failure
- All 25 queue-related unit tests pass, covering FIFO ordering, boundary values, fair scheduling, retry limits
- Full AP test suite (107 tests) passes without regressions
- Used existing `TradeRequestEvent` type from Story 4.2 Event Monitor implementation

### File List

- ap/src/queue/mod.rs (new) - OrderQueueManager struct, QueuedOrder, RetryOrder, QueueDepth, enqueue/get_next_order/mark_complete/mark_failed/get_queue_depth methods
- ap/src/queue/bucket.rs (new) - Bucket enum with Small/Medium/Large/XL variants, from_amount classification, allocation_percent method
- ap/src/queue/tests.rs (new) - 17 unit tests for queue manager functionality
- ap/src/lib.rs (modified) - Added queue module export

### Change Log

- 2026-01-29: Implemented Story 4.3 Order Queue Manager with all 8 tasks complete
- 2026-01-30: Code review - Fixed 5 issues (2 HIGH, 3 MEDIUM)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-30
**Outcome:** Changes Requested → Fixed

### Issues Found & Fixed

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | HIGH | No thread safety (missing Arc/Mutex) | Added `ThreadSafeQueueManager` wrapper with RwLock |
| 2 | HIGH | Rebalance 50% priority not implemented (arch Section 10) | Added rebalance queue + 50/50 split logic when active |
| 3 | MEDIUM | Order age auto-fail (1h) not implemented | Added `expire_stale_orders()` method |
| 4 | MEDIUM | Queue depth thresholds missing (100 WARNING, 500 CRITICAL) | Added threshold checks in `enqueue()` |
| 5 | MEDIUM | Wrong error type (EventParse) for queue errors | Added `APError::QueueError`, `QueueFull`, `OrderExpired` |
| 6 | LOW | Test tolerance too loose (15%) | Tightened to 10% |

### New Features Added

1. **Thread Safety**: `ThreadSafeQueueManager` wraps `OrderQueueManager` with `Arc<RwLock<>>` for concurrent access
2. **Rebalance Priority**: `set_rebalance_active(bool)` enables 50/50 split between rebalance and user orders per architecture
3. **Order Expiration**: `expire_stale_orders()` returns orders >1 hour old for refund processing
4. **Queue Limits**: Rejects new orders at depth ≥500, logs WARNING at depth ≥100

### Files Modified

- ap/src/error.rs - Added QueueError, QueueFull, OrderExpired error variants
- ap/src/queue/mod.rs - Major rewrite with all fixes + ThreadSafeQueueManager
- ap/src/queue/tests.rs - Added 12 new tests for fixed functionality
- ap/src/lib.rs - Export new types (ThreadSafeQueueManager, ExpiredOrder)
