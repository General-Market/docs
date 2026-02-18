# Story 4.7: Timeout Handler

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AP (Authorized Participant)**,
I want **to handle order timeouts gracefully with retry logic**,
So that **stuck orders don't block the queue and users receive timely feedback**.

## Acceptance Criteria

1. **Given** an order in the execution queue, **When** 60 seconds elapse without a fill, **Then** the order is marked as timed out
2. **Given** a timed out order, **When** retry logic executes, **Then** the order is moved to the retry queue for another attempt
3. **Given** an order that has already been retried, **When** it times out again, **Then** the retry count is tracked (max 3 retries)
4. **Given** an order that has failed 3 retries, **When** the 3rd timeout occurs, **Then** the order is marked as permanently failed
5. **Given** a permanently failed order, **Then** it is logged with full details for investigation
6. **Given** the timeout handler is running, **When** `get_timeout_count(time_window)` is called, **Then** it returns the count of timeouts in that window
7. **Given** all timeout functionality, **Then** timeout metrics are exposed for monitoring (Prometheus format)
8. **Given** implementation is complete, **Then** unit tests verify timeout detection and retry logic

## Tasks / Subtasks

- [x] Task 1: Create TimeoutHandler struct and module (AC: #1, #7)
  - [x] Create `ap/src/timeout/` module structure (mod.rs, handler.rs, config.rs, types.rs, metrics.rs)
  - [x] Define `TimeoutHandler` struct with configurable timeout duration (default 60s)
  - [x] Add configuration struct `TimeoutConfig` for timeout_duration, max_retries, retry_delay
  - [x] Implement `new(config: TimeoutConfig)` constructor
  - [x] Add `Arc<RwLock<...>>` and `Arc<Mutex<...>>` for thread-safe state management

- [x] Task 2: Define order tracking data structures (AC: #1, #2, #3)
  - [x] Create `TrackedOrder` struct containing: order_id, start_time, retry_count, status
  - [x] Define `TimeoutStatus` enum: Active, TimedOut, Retrying, Failed
  - [x] Implement `HashMap<OrderId, TrackedOrder>` for in-flight order tracking
  - [x] Add methods: `track_order(order_id)`, `untrack_order(order_id)`

- [x] Task 3: Implement timeout detection logic (AC: #1)
  - [x] Create async `check_timeouts()` method that scans tracked orders
  - [x] Compare `Instant::now()` against `start_time + timeout_duration`
  - [x] Emit `OrderTimedOut` event for orders exceeding threshold
  - [x] Return list of timed out order IDs via `TimeoutCheckResult`

- [x] Task 4: Implement retry queue and logic (AC: #2, #3)
  - [x] Create retry queue using `VecDeque<TrackedOrder>`
  - [x] Implement `move_to_retry(order_id)` method
  - [x] Track retry_count increment on each retry
  - [x] Implement configurable retry_delay between retries (default 5s)
  - [x] Create `get_next_retry()` method returning orders ready for retry

- [x] Task 5: Implement max retry handling (AC: #4, #5)
  - [x] Define max_retries in config (default 3, per architecture NFR8)
  - [x] Implement `is_max_retries_exceeded(order_id)` check
  - [x] Create automatic failure marking when max retries exceeded
  - [x] Store failed orders in `failed_orders: Vec<FailedOrder>` for logging
  - [x] Log failed orders with: order_id, retry_count, total_elapsed_time, via tracing::error!

- [x] Task 6: Implement failure logging (AC: #5)
  - [x] Define `FailedOrder` struct: order_id, total_attempts, elapsed_time, failure_reason, timestamps
  - [x] Implement structured logging for failed orders via tracing crate
  - [x] Include fields: order_id, retry_count, reason in error logs
  - [x] Create `get_failed_orders(since: Duration)` for investigation queries

- [x] Task 7: Implement timeout metrics (AC: #6, #7)
  - [x] Create `TimeoutMetrics` struct with atomic counters
  - [x] Track: timeouts_total, retries_total, failures_total, current_in_flight
  - [x] Implement `get_timeout_count(time_window: Duration)` method
  - [x] Create time-bucketed records for windowed queries
  - [x] Expose metrics in Prometheus format via `to_prometheus()` method

- [x] Task 8: Integrate with Order Queue Manager (AC: #1, #2)
  - [x] Support event channel for timeout notifications via `with_event_channel()`
  - [x] Emit `TimeoutEvent::OrderTimedOut` and `TimeoutEvent::OrderFailed` events
  - [x] Integrate with `untrack_order(order_id)` callback for fill confirmation
  - [x] Ensure proper cleanup when order fills successfully before timeout

- [x] Task 9: Create background timeout checker task (AC: #1)
  - [x] Implement `run()` async method with tokio::interval (check every 1s)
  - [x] Accept CancellationToken for graceful shutdown
  - [x] Handle graceful shutdown via cancellation token
  - [x] Log periodic heartbeat with current state (every 60 checks)

- [x] Task 10: Write unit tests (AC: #8)
  - [x] Test: Order times out after 60s (mock time with tokio::time::pause)
  - [x] Test: Timed out order moves to retry queue
  - [x] Test: Retry count increments correctly
  - [x] Test: Order fails permanently after 3 retries
  - [x] Test: Failed order logged with correct details
  - [x] Test: `get_timeout_count` returns correct count for time window
  - [x] Test: Metrics counters increment correctly
  - [x] Test: Successful fill cancels timeout tracking

## Dev Notes

### Critical Architecture Constraints

**Timeout Specifications from Architecture (NFR8, Section 16):**

| Parameter | Value | Source |
|-----------|-------|--------|
| Order Timeout | 60 seconds | NFR8 |
| Max Retries | 3 | Architecture Section 16 |
| Retry Delay | 5 seconds (recommended) | Derived |
| Failure Action | Log for investigation | Architecture "Rogue AP Detection" |

**From architecture.md Section 16 - Rogue AP Detection:**
```
| Trigger | Threshold | Action |
|---------|-----------|--------|
| Timeout | Order not filled in 60 seconds | Flag, log incident |
```

**AP Suspension Triggers (architecture.md):**
- 3 violations in 24h triggers BLS vote to suspend
- Extended offline (5 minutes no fills) triggers auto-pause
- Timeout is a "violation" that gets flagged

### Order Lifecycle with Timeout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORDER TIMEOUT LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────┐    60s     ┌───────────┐    retry    ┌──────────┐       │
│   │ TRACKING │ ────────> │ TIMED_OUT │ ──────────> │ RETRYING │       │
│   └──────────┘            └───────────┘             └────┬─────┘       │
│        │                                                  │             │
│        │ fill                                             │ 60s         │
│        ▼                                                  ▼             │
│   ┌──────────┐                                    ┌───────────┐        │
│   │ SUCCESS  │                                    │ TIMED_OUT │        │
│   └──────────┘                                    └─────┬─────┘        │
│                                                         │               │
│                                          retry < 3?     │               │
│                                         ┌───────────────┼───────────┐  │
│                                         │ YES           │ NO        │  │
│                                         ▼               ▼           │  │
│                                   ┌──────────┐   ┌──────────┐       │  │
│                                   │ RETRYING │   │  FAILED  │       │  │
│                                   └──────────┘   └──────────┘       │  │
│                                                                      │  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Integration Points

**Upstream (receives from):**
- Order Queue Manager (Story 4.3): Orders to track via channel
- Fill Reporter (Story 4.4): Fill confirmations to cancel tracking

**Downstream (sends to):**
- Order Queue Manager: Failed orders notification
- AP Metrics (Story 4.9): Timeout metrics for health calculation
- Logging system: Failed order details

**Channel Pattern:**
```rust
// From Order Queue Manager
pub struct OrderTrackRequest {
    pub order_id: U256,
    pub submitted_at: Instant,
}

// To Order Queue Manager
pub enum TimeoutEvent {
    OrderTimedOut { order_id: U256, retry_count: u32 },
    OrderFailed { order_id: U256, reason: String },
}
```

### Rust Implementation Patterns

**TimeoutConfig struct:**
```rust
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
```

**TrackedOrder struct:**
```rust
pub struct TrackedOrder {
    pub order_id: U256,
    pub start_time: Instant,
    pub retry_count: u32,
    pub status: TimeoutStatus,
    pub last_timeout: Option<Instant>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeoutStatus {
    Active,      // Order is being executed
    TimedOut,    // 60s elapsed, pending retry decision
    Retrying,    // In retry queue, waiting for retry_delay
    Failed,      // Max retries exceeded, logged for investigation
}
```

### Recommended Rust Libraries

Already available in workspace:
- `tokio`: Async runtime with time utilities (tokio::time::Instant, interval, pause)
- `tracing`: Structured logging for failed orders
- `ethers::types::U256`: For order IDs

May need to add to `ap/Cargo.toml`:
- `prometheus`: For metrics export (already pattern in issuer crate)
- `dashmap`: For concurrent HashMap if lock contention is a concern

### Error Handling

Use existing `common/src/errors.rs` patterns:
- `E009: OrderExpired` - but distinguish from deadline expiry (user-set) vs timeout (execution)

Define AP-specific timeout errors in `ap/src/error.rs`:
```rust
#[derive(Debug, Error)]
pub enum TimeoutError {
    #[error("Order {order_id} timed out after {elapsed:?} (attempt {attempt}/{max_attempts})")]
    OrderTimeout {
        order_id: U256,
        elapsed: Duration,
        attempt: u32,
        max_attempts: u32,
    },

    #[error("Order {order_id} failed permanently after {attempts} attempts")]
    MaxRetriesExceeded {
        order_id: U256,
        attempts: u32,
    },
}
```

### Testing Strategy

Use `tokio::time::pause()` and `tokio::time::advance()` for deterministic timeout testing:
```rust
#[tokio::test]
async fn test_order_times_out_after_60s() {
    tokio::time::pause();

    let handler = TimeoutHandler::new(TimeoutConfig::default());
    let order_id = U256::from(1);

    handler.track_order(order_id).await;

    // Fast-forward time
    tokio::time::advance(Duration::from_secs(61)).await;

    let timed_out = handler.check_timeouts().await;
    assert!(timed_out.contains(&order_id));
}
```

### Project Structure Notes

Files to create/modify:
```
ap/
├── src/
│   ├── main.rs              # Update to integrate TimeoutHandler
│   ├── lib.rs               # Export timeout_handler module
│   ├── timeout_handler.rs   # NEW: Core timeout tracking
│   ├── timeout_config.rs    # NEW: Configuration
│   ├── timeout_metrics.rs   # NEW: Prometheus metrics
│   └── error.rs             # Add TimeoutError variants
└── Cargo.toml               # May need prometheus dependency
```

### Alignment with Project Structure

- Uses `common::types::order::OrderId` (U256) for order identifiers
- Follows existing error pattern from `common/src/errors.rs`
- JSON logging format matches architecture.md Section 21
- Metrics format matches existing patterns in issuer crate

### Metrics Format (Prometheus)

```
# HELP ap_order_timeouts_total Total number of order timeouts
# TYPE ap_order_timeouts_total counter
ap_order_timeouts_total 42

# HELP ap_order_retries_total Total number of order retries
# TYPE ap_order_retries_total counter
ap_order_retries_total 35

# HELP ap_order_failures_total Total number of permanently failed orders
# TYPE ap_order_failures_total counter
ap_order_failures_total 7

# HELP ap_orders_in_flight Current number of orders being tracked
# TYPE ap_orders_in_flight gauge
ap_orders_in_flight 12

# HELP ap_timeout_duration_seconds Histogram of timeout durations
# TYPE ap_timeout_duration_seconds histogram
ap_timeout_duration_seconds_bucket{le="60"} 35
ap_timeout_duration_seconds_bucket{le="120"} 40
ap_timeout_duration_seconds_bucket{le="180"} 42
```

### References

- [Source: architecture.md#NFR8] - AP order execution timeout: 60 seconds
- [Source: architecture.md#Section 16] - Rogue AP Detection: Timeout threshold and actions
- [Source: architecture.md#AP-Suspension-Restoration] - Suspension triggers
- [Source: common/src/types/order.rs] - OrderId type definition (U256)
- [Source: common/src/errors.rs] - Error code patterns (E009 OrderExpired)
- [Source: ap/src/main.rs] - Existing AP binary main loop for integration
- [Source: _bmad-output/implementation-artifacts/4-2-event-monitor.md] - Prior Epic 4 story pattern
- [Source: _bmad-output/implementation-artifacts/4-3-order-queue-manager.md] - Integration point (when implemented)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 28 unit tests pass: `cargo test -p ap --lib -- timeout::`

### Completion Notes List

- Implemented timeout handler as a modular structure under `ap/src/timeout/`
- Used `tokio::time::Instant` throughout for compatibility with `tokio::time::pause()` in tests
- Added `TimeoutEvent` enum for channel-based notifications to integrate with Order Queue Manager
- Metrics support time-windowed queries via `get_timeout_count(Duration)`
- Prometheus-formatted output via `to_prometheus()` method
- Background runner uses `CancellationToken` from `tokio-util` for graceful shutdown
- Added `tokio-util` dependency to `ap/Cargo.toml`
- Added `TimeoutError` variants to `ap/src/error.rs` for completeness
- Fixed unrelated pre-existing compilation issue in `ap/src/fill/retry.rs` (missing match arms)

### File List

**New files:**
- ap/src/timeout/mod.rs - Module entry point with re-exports
- ap/src/timeout/config.rs - TimeoutConfig with builder pattern
- ap/src/timeout/types.rs - TrackedOrder, TimeoutStatus, FailedOrder, TimeoutEvent
- ap/src/timeout/metrics.rs - TimeoutMetrics with Prometheus output
- ap/src/timeout/handler.rs - Core TimeoutHandler implementation
- ap/src/timeout/tests.rs - 28 comprehensive unit tests

**Modified files:**
- ap/Cargo.toml - Added tokio-util dependency
- ap/src/lib.rs - Added timeout module export
- ap/src/error.rs - Added OrderTimeout and MaxRetriesExceeded error variants
- ap/src/fill/retry.rs - Fixed missing match arms for Authentication, RateLimit, ExternalService errors

### Change Log

- 2026-01-29: Implemented complete timeout handler module (Story 4.7)
- 2026-01-30: Code review (Opus 4.5) — 4 issues fixed:
  - [H2] Fixed atomic underflow race in `decrement_in_flight` (metrics.rs) — used `fetch_update` with `saturating_sub`
  - [M1] Fixed `std::time::Instant` vs `tokio::time::Instant` mismatch in metrics.rs — windowed counts now respect `tokio::time::pause()` in tests
  - [M2] Refactored `check_timeouts()` to release tracked_orders write lock before processing side effects (channel sends, failed_orders writes)
  - [M3] Fixed potential panic in `get_failed_orders()` — uses `checked_sub` instead of unchecked subtraction
  - Also fixed pre-existing compilation errors in `ap/src/event_monitor.rs` tests (`try_recv` returns `Result`, not `Option`)
