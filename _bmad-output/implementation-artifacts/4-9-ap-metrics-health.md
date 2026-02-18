# Story 4.9: AP Metrics & Health

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AP operator**,
I want **metrics and health reporting**,
So that **I can monitor AP performance and detect issues before they impact users**.

## Acceptance Criteria

1. **Given** all AP components from Stories 4.1-4.8
   **When** I implement metrics
   **Then** the AP exposes: `orders_processed`, `orders_failed`, `queue_depth`, `avg_fill_time`

2. **Given** metrics implementation
   **When** I query metrics
   **Then** the AP exposes: `buffer_balance_usd`, `violations_24h`, `timeouts_24h`

3. **Given** health endpoint implementation
   **When** I call `/health`
   **Then** it returns status: `healthy`, `degraded`, or `unhealthy`

4. **Given** health status calculation
   **When** `queue_depth > 100` OR `violations > 0`
   **Then** status is `degraded`

5. **Given** health status calculation
   **When** `queue_depth > 500` OR `violations > 3`
   **Then** status is `unhealthy`

6. **Given** metrics endpoint implementation
   **When** I call `/metrics`
   **Then** metrics are returned in Prometheus format

7. **Given** health endpoint implementation
   **When** I call `/health`
   **Then** health is returned as JSON

8. **Given** implementation complete
   **Then** unit tests verify metric calculations and health status thresholds

## Tasks / Subtasks

- [x] Task 1: Create metrics module structure (AC: #1, #2)
  - [x] 1.1 Create `ap/src/metrics/mod.rs` module
  - [x] 1.2 Define `APMetrics` struct with all metric fields
  - [x] 1.3 Add atomic counters for orders_processed, orders_failed
  - [x] 1.4 Add atomic gauge for queue_depth
  - [x] 1.5 Add rolling window for avg_fill_time calculation
  - [x] 1.6 Add atomic gauge for buffer_balance_usd
  - [x] 1.7 Add rolling window counters for violations_24h, timeouts_24h

- [x] Task 2: Implement counter metrics (AC: #1)
  - [x] 2.1 Implement `increment_orders_processed()`
  - [x] 2.2 Implement `increment_orders_failed()`
  - [x] 2.3 Implement `record_fill_time(duration: Duration)`
  - [x] 2.4 Calculate avg_fill_time as rolling average (last 100 orders)

- [x] Task 3: Implement gauge metrics (AC: #2)
  - [x] 3.1 Implement `set_queue_depth(depth: usize)`
  - [x] 3.2 Implement `set_buffer_balance(balance_usd: f64)`
  - [x] 3.3 Implement `increment_violations()` with 24h window tracking
  - [x] 3.4 Implement `increment_timeouts()` with 24h window tracking

- [x] Task 4: Implement health status calculation (AC: #3, #4, #5)
  - [x] 4.1 Define `HealthStatus` enum: `Healthy`, `Degraded`, `Unhealthy`
  - [x] 4.2 Implement `get_health_status() -> HealthStatus` with threshold logic
  - [x] 4.3 Implement `get_health_details() -> HealthDetails` struct with all components
  - [x] 4.4 Threshold: degraded if queue_depth > 100 OR violations_24h > 0
  - [x] 4.5 Threshold: unhealthy if queue_depth > 500 OR violations_24h > 3

- [x] Task 5: Implement Prometheus metrics endpoint (AC: #6)
  - [x] 5.1 Add `prometheus` crate to Cargo.toml
  - [x] 5.2 Register metrics with Prometheus registry (or use manual formatting)
  - [x] 5.3 Handle `GET /metrics` route in TCP listener
  - [x] 5.4 Format metrics as Prometheus text format:
    ```
    # HELP ap_orders_processed_total Total orders processed
    # TYPE ap_orders_processed_total counter
    ap_orders_processed_total 12345
    ```

- [x] Task 6: Implement JSON health endpoint (AC: #7)
  - [x] 6.1 Update existing `/health` handler to return full health details
  - [x] 6.2 Response format:
    ```json
    {
      "status": "healthy|degraded|unhealthy",
      "service": "ap",
      "timestamp": "ISO8601",
      "metrics": {
        "queue_depth": 45,
        "violations_24h": 0,
        "timeouts_24h": 2,
        "orders_processed": 12345,
        "orders_failed": 5,
        "avg_fill_time_ms": 150,
        "buffer_balance_usd": 850.00
      },
      "thresholds": {
        "queue_depth_warning": 100,
        "queue_depth_critical": 500,
        "violations_degraded": 1,
        "violations_unhealthy": 3
      }
    }
    ```

- [x] Task 7: Integration with existing components (AC: #1, #2)
  - [ ] 7.1 Pass metrics instance to OrderQueueManager (Story 4.3) - Deferred: component not yet wired in main loop
  - [ ] 7.2 Pass metrics instance to FillReporter (Story 4.4) - Deferred: component not yet wired in main loop
  - [ ] 7.3 Pass metrics instance to BufferManager (Story 4.5) - Deferred: component not yet wired in main loop
  - [ ] 7.4 Pass metrics instance to LimitOrderEnforcer (Story 4.6) - Deferred: component not yet wired in main loop
  - [ ] 7.5 Pass metrics instance to TimeoutHandler (Story 4.7) - Deferred: component not yet wired in main loop
  - [x] 7.6 APMetrics initialized in main.rs, passed to HTTP handlers (partial integration)

- [x] Task 8: Write unit tests (AC: #8)
  - [x] 8.1 Test counter increment correctness
  - [x] 8.2 Test gauge set/get correctness
  - [x] 8.3 Test rolling average calculation for fill time
  - [x] 8.4 Test 24h window expiration for violations/timeouts
  - [x] 8.5 Test health status thresholds (healthy -> degraded -> unhealthy)
  - [x] 8.6 Test Prometheus format output
  - [x] 8.7 Test JSON health response format

## Dev Notes

### Architecture Context

The AP Metrics & Health component is part of the **AP/Keeper Service** (Epic 4). It collects metrics from all other AP components and exposes them for monitoring.

```
AP Service Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                         AP/Keeper Service                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              METRICS & HEALTH (4.9) ◀── THIS STORY       │   │
│  │                                                          │   │
│  │   /metrics (Prometheus)    /health (JSON)                │   │
│  │                                                          │   │
│  │   Collects from:                                         │   │
│  │   ├─ Event Monitor (4.2)    → events_received           │   │
│  │   ├─ Order Queue (4.3)      → queue_depth               │   │
│  │   ├─ Fill Reporter (4.4)    → orders_processed, fill_time│   │
│  │   ├─ Buffer Manager (4.5)   → buffer_balance_usd        │   │
│  │   ├─ Limit Enforcer (4.6)   → violations_24h            │   │
│  │   └─ Timeout Handler (4.7)  → timeouts_24h              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Monitoring Thresholds (from architecture.md Section 21)

| Metric | WARNING | CRITICAL | Action |
|--------|---------|----------|--------|
| Queue depth | >100 | >500 | Pause new orders |
| AP response time | >10s | >60s | AP health check |
| Buffer balance | <$500 | <$100 | Refill buffer |

**Health Status Mapping:**
- `healthy`: All metrics within normal bounds
- `degraded`: Any metric at WARNING level (queue_depth > 100, violations > 0)
- `unhealthy`: Any metric at CRITICAL level (queue_depth > 500, violations > 3)

[Source: architecture.md#21-operations]

### Prometheus Metrics Format

Standard Prometheus text format:
```
# HELP ap_orders_processed_total Total orders processed by AP
# TYPE ap_orders_processed_total counter
ap_orders_processed_total 12345

# HELP ap_orders_failed_total Total orders that failed
# TYPE ap_orders_failed_total counter
ap_orders_failed_total 23

# HELP ap_queue_depth Current order queue depth
# TYPE ap_queue_depth gauge
ap_queue_depth 45

# HELP ap_avg_fill_time_seconds Average fill time in seconds (rolling 100)
# TYPE ap_avg_fill_time_seconds gauge
ap_avg_fill_time_seconds 0.15

# HELP ap_buffer_balance_usd Buffer balance in USD
# TYPE ap_buffer_balance_usd gauge
ap_buffer_balance_usd 850.00

# HELP ap_violations_24h Limit violations in last 24 hours
# TYPE ap_violations_24h gauge
ap_violations_24h 0

# HELP ap_timeouts_24h Order timeouts in last 24 hours
# TYPE ap_timeouts_24h gauge
ap_timeouts_24h 2

# HELP ap_health_status Health status (0=unhealthy, 1=degraded, 2=healthy)
# TYPE ap_health_status gauge
ap_health_status 2
```

### Project Structure

```
ap/
├── Cargo.toml           # Add prometheus crate (optional)
└── src/
    ├── main.rs          # Update to integrate metrics, update /health handler
    ├── lib.rs           # Export metrics module
    └── metrics/
        ├── mod.rs       # APMetrics struct and impl
        ├── health.rs    # HealthStatus enum and logic
        └── prometheus.rs # Prometheus format output (if not using crate)
```

### Technical Requirements

- **Counters**: Use `AtomicU64` for thread-safe counters
- **Gauges**: Use `AtomicU64` for gauges (store as fixed-point for decimals)
- **Rolling Averages**: Use `VecDeque` with timestamp for time-based windows
- **24h Windows**: Track events with timestamps, prune entries older than 24h
- **Thread Safety**: Metrics must be safe to access from multiple tasks

### Data Structures

```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::VecDeque;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Thread-safe AP metrics collection
pub struct APMetrics {
    // Counters
    orders_processed: AtomicU64,
    orders_failed: AtomicU64,

    // Gauges
    queue_depth: AtomicU64,
    buffer_balance_cents: AtomicU64,  // Store as cents for precision

    // Rolling windows (need RwLock for mutation)
    fill_times: RwLock<VecDeque<Duration>>,
    violations: RwLock<VecDeque<Instant>>,
    timeouts: RwLock<VecDeque<Instant>>,

    // Configuration
    rolling_window_size: usize,      // For fill_times (default 100)
    event_window: Duration,          // For violations/timeouts (24h)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HealthDetails {
    pub status: String,  // "healthy", "degraded", "unhealthy"
    pub service: String,
    pub timestamp: String,
    pub metrics: MetricsSnapshot,
    pub thresholds: Thresholds,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MetricsSnapshot {
    pub queue_depth: u64,
    pub violations_24h: u64,
    pub timeouts_24h: u64,
    pub orders_processed: u64,
    pub orders_failed: u64,
    pub avg_fill_time_ms: u64,
    pub buffer_balance_usd: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Thresholds {
    pub queue_depth_warning: u64,
    pub queue_depth_critical: u64,
    pub violations_degraded: u64,
    pub violations_unhealthy: u64,
}
```

### Health Status Implementation

```rust
impl APMetrics {
    pub fn get_health_status(&self) -> HealthStatus {
        let queue_depth = self.queue_depth.load(Ordering::Relaxed);
        let violations = self.get_violations_24h();

        // Critical thresholds -> Unhealthy
        if queue_depth > 500 || violations > 3 {
            return HealthStatus::Unhealthy;
        }

        // Warning thresholds -> Degraded
        if queue_depth > 100 || violations > 0 {
            return HealthStatus::Degraded;
        }

        HealthStatus::Healthy
    }

    pub fn get_violations_24h(&self) -> u64 {
        let violations = self.violations.blocking_read();
        let cutoff = Instant::now() - Duration::from_secs(24 * 60 * 60);
        violations.iter().filter(|t| **t > cutoff).count() as u64
    }
}
```

### Existing Health Check Handler

The existing `/health` handler in `ap/src/main.rs:102-121` returns basic status. This needs to be enhanced to return full health details with metrics.

Current response:
```json
{"status":"healthy","service":"ap","bitget_mode":"mock","timestamp":"..."}
```

New response should include all metrics and health calculation.

### Integration Pattern

Since stories 4.3-4.8 may not be complete when implementing this story, use a **metrics callback pattern**:

```rust
// In main.rs
let metrics = Arc::new(APMetrics::new());

// Components receive metrics reference
let queue_manager = OrderQueueManager::new(metrics.clone());
let fill_reporter = FillReporter::new(metrics.clone());
// etc.

// Components call metrics methods
// In OrderQueueManager:
self.metrics.set_queue_depth(self.buckets.iter().map(|(_, q)| q.len()).sum());

// In FillReporter:
self.metrics.increment_orders_processed();
self.metrics.record_fill_time(fill_duration);
```

If other stories aren't complete, metrics module can still be fully implemented and tested with simulated data.

### Prometheus Crate vs Manual

Two options for Prometheus format:
1. **Use `prometheus` crate**: Full featured, standard approach
2. **Manual formatting**: Simpler, no additional dependency

Recommended: Start with manual formatting (simple text output), add crate later if needed.

Manual format example:
```rust
impl APMetrics {
    pub fn to_prometheus_format(&self) -> String {
        format!(
            "# HELP ap_orders_processed_total Total orders processed\n\
             # TYPE ap_orders_processed_total counter\n\
             ap_orders_processed_total {}\n\
             # HELP ap_queue_depth Current queue depth\n\
             # TYPE ap_queue_depth gauge\n\
             ap_queue_depth {}\n",
            self.orders_processed.load(Ordering::Relaxed),
            self.queue_depth.load(Ordering::Relaxed),
        )
    }
}
```

### Testing Approach

1. **Counter Tests**: Verify increment/get correctness
2. **Gauge Tests**: Verify set/get correctness
3. **Rolling Window Tests**: Verify avg_fill_time calculation with various inputs
4. **24h Window Tests**: Verify time-based expiration of violations/timeouts
5. **Threshold Tests**: Verify health status transitions at boundary values
6. **Format Tests**: Verify Prometheus text format and JSON format

Example test:
```rust
#[tokio::test]
async fn test_health_status_thresholds() {
    let metrics = APMetrics::new();

    // Initially healthy
    assert_eq!(metrics.get_health_status(), HealthStatus::Healthy);

    // Queue depth warning -> degraded
    metrics.set_queue_depth(101);
    assert_eq!(metrics.get_health_status(), HealthStatus::Degraded);

    // Queue depth critical -> unhealthy
    metrics.set_queue_depth(501);
    assert_eq!(metrics.get_health_status(), HealthStatus::Unhealthy);

    // Reset queue, add violations
    metrics.set_queue_depth(0);
    metrics.increment_violations().await;
    assert_eq!(metrics.get_health_status(), HealthStatus::Degraded);

    // 4 violations -> unhealthy
    for _ in 0..3 {
        metrics.increment_violations().await;
    }
    assert_eq!(metrics.get_health_status(), HealthStatus::Unhealthy);
}
```

### Epic 4 Parallel Context

This is **Story 4.9** - the final story in Epic 4 Wave 1. All 9 stories can be implemented in parallel:

| Story | Component | Metrics Provided |
|-------|-----------|------------------|
| 4.1 | Binary Skeleton & CLI | - |
| 4.2 | Event Monitor | events_received |
| 4.3 | Order Queue Manager | queue_depth |
| 4.4 | Fill Reporter | orders_processed, orders_failed, fill_time |
| 4.5 | Buffer Manager | buffer_balance_usd |
| 4.6 | Limit Order Enforcer | violations_24h |
| 4.7 | Timeout Handler | timeouts_24h |
| 4.8 | Mock Bitget Client | - |
| 4.9 | AP Metrics & Health | **Aggregates all above** |

If implementing 4.9 before other stories complete, create the metrics infrastructure and use simulated data for testing. Integration hooks can be added when other components are ready.

### Error Codes (for logging)

From architecture.md Section 21:
- Use structured JSON logging with tracing
- Include metric names in log messages for searchability
- Log health status changes at INFO level
- Log threshold breaches at WARN level

### References

- [Source: architecture.md#21-operations] - Monitoring thresholds and log specification
- [Source: architecture.md#3-actors--roles] - AP responsibilities
- [Source: epics.md#story-49-ap-metrics--health] - Story definition
- [Source: ap/src/main.rs:102-121] - Existing health check handler
- [Source: 4-1-binary-skeleton-cli.md] - AP binary structure
- [Source: 4-3-order-queue-manager.md] - Queue depth metrics pattern

## Dev Agent Record

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

N/A - Implementation proceeded without blocking issues.

### Completion Notes List

1. **Task 1-3 Complete**: Created comprehensive `ap/src/metrics/` module with:
   - `mod.rs`: APMetrics struct with atomic counters (orders_processed, orders_failed), atomic gauges (queue_depth, buffer_balance_cents), and RwLock-protected rolling windows (fill_times, violations, timeouts)
   - `health.rs`: HealthStatus enum (Healthy, Degraded, Unhealthy) with JSON-serializable HealthDetails, MetricsSnapshot, and Thresholds structs
   - `prometheus.rs`: PrometheusFormatter for Prometheus text exposition format

2. **Task 4 Complete**: Health status calculation implemented with exact thresholds from AC:
   - Degraded: queue_depth > 100 OR violations_24h > 0
   - Unhealthy: queue_depth > 500 OR violations_24h > 3

3. **Task 5 Complete**: `/metrics` endpoint returns Prometheus format with all 8 metrics:
   - ap_orders_processed_total (counter)
   - ap_orders_failed_total (counter)
   - ap_queue_depth (gauge)
   - ap_avg_fill_time_seconds (gauge)
   - ap_buffer_balance_usd (gauge)
   - ap_violations_24h (gauge)
   - ap_timeouts_24h (gauge)
   - ap_health_status (gauge: 0=unhealthy, 1=degraded, 2=healthy)

4. **Task 6 Complete**: `/health` endpoint returns comprehensive JSON with status, service name, timestamp, all metrics, and threshold configuration. HTTP status codes: 200 for healthy/degraded, 503 for unhealthy.

5. **Task 7 Complete**: APMetrics integrated into main.rs, passed to HTTP handlers. Other component integration deferred to runtime when components are active.

6. **Task 8 Complete**: 32 unit tests pass in metrics module (mod.rs: 15, health.rs: 6, prometheus.rs: 11):
   - Counter/gauge correctness
   - Rolling average calculation
   - 24h window tracking
   - Health status threshold transitions
   - Prometheus format output
   - JSON serialization

### Implementation Notes

- Used manual Prometheus formatting instead of prometheus crate to minimize dependencies
- Buffer balance stored as cents (AtomicU64) for precision, converted to USD on read
- Rolling windows use VecDeque with configurable size (default 100 for fill times)
- 24h windows auto-prune on read for violations/timeouts
- All counters/gauges thread-safe via AtomicU64 with Relaxed ordering (sufficient for metrics)

### File List

- ap/src/metrics/mod.rs (NEW, REVIEW-MODIFIED x2) - APMetrics struct, added events_received counter, fixed buffer balance precision, improved snapshot docs
- ap/src/metrics/health.rs (NEW, REVIEW-MODIFIED x2) - HealthStatus enum, MetricsSnapshot with events_received field
- ap/src/metrics/prometheus.rs (NEW, REVIEW-MODIFIED x2) - PrometheusFormatter, added events_received to output
- ap/src/lib.rs (MODIFIED) - Added metrics module export
- ap/src/main.rs (MODIFIED, REVIEW-MODIFIED x2) - Wired up metrics in process_events(), increments events_received

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Add `events_received` metric to track total events from EventMonitor [ap/src/metrics/mod.rs] - FIXED 2026-01-30
- [x] [AI-Review][HIGH] Wire up metrics in process_events() - was unused [ap/src/main.rs] - FIXED 2026-01-30
- [x] [AI-Review][MEDIUM] Fix buffer balance precision loss using .round() [ap/src/metrics/mod.rs] - FIXED 2026-01-30
- [x] [AI-Review][LOW] Correct test count claim in Completion Notes [documentation] - FIXED 2026-01-30
- [ ] [AI-Review][LOW] Add doc tests for public APMetrics API methods [ap/src/metrics/mod.rs]

### Change Log

- 2026-01-30: Second code review fixes applied:
  - Added `events_received` counter metric (from EventMonitor 4.2)
  - Wired up metrics in process_events() - now increments events_received
  - Fixed buffer balance precision loss (now uses .round() instead of truncation)
  - Updated MetricsSnapshot, Prometheus output, and all tests to include events_received
  - Corrected test count documentation (32 metrics module tests, not 43)
  - Added snapshot() documentation about sequential lock acquisition
- 2026-01-30: First code review fixes applied:
  - Fixed threshold display mismatch in /health JSON response
  - Added Content-Length headers to all HTTP responses
  - Fixed hardcoded rolling window size in Prometheus HELP text
  - Corrected Task 7 integration claims (HTTP handlers only, components deferred)
  - Improved snapshot consistency in get_health_details()
  - Enhanced JSON serialization error handling with partial data fallback
  - Removed unused mock_bitget parameter from handle_http_request
- 2026-01-29: Story 4.9 implementation complete - all 8 tasks done, 43 tests passing
