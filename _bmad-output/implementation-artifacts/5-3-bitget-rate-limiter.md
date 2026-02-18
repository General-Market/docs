# Story 5.3: Bitget Rate Limiter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AP (Authorized Participant)**,
I want **rate limiting for Bitget API calls**,
so that **I don't get blocked by the exchange**.

## Acceptance Criteria

1. **AC1:** `acquire()` blocks until rate limit allows - must wait if at capacity
2. **AC2:** Sliding window algorithm (not fixed buckets) - smooth rate limiting over time
3. **AC3:** Separate limits for order placement vs read APIs - different rate limits per endpoint type
4. **AC4:** `get_remaining()` returns remaining capacity - allow clients to check before calling
5. **AC5:** Metrics exposed: `requests_throttled`, `avg_wait_time` - for monitoring and alerting
6. **AC6:** Configurable limits (for different API tiers) - support testnet/mainnet/premium tiers
7. **AC7:** Unit tests verify throttling behavior - prove rate limiting works correctly

## Tasks / Subtasks

- [x] Task 1: Create `BitgetRateLimiter` struct and core types (AC: #2, #3)
  - [x] 1.1: Define `RateLimiterConfig` with default 10 orders/sec for placement, separate read limit
  - [x] 1.2: Define `EndpointType` enum: `OrderPlacement`, `ReadOnly`
  - [x] 1.3: Implement sliding window data structure using `VecDeque<Instant>`
  - [x] 1.4: Add `Arc<RwLock>` for thread-safe concurrent access

- [x] Task 2: Implement `acquire()` method (AC: #1)
  - [x] 2.1: Check current window count vs limit
  - [x] 2.2: If at limit, calculate sleep duration until oldest request expires
  - [x] 2.3: Sleep and retry until slot available
  - [x] 2.4: Record timestamp on successful acquire
  - [x] 2.5: Return Duration waited (simplified from AcquireGuard for cleaner API)

- [x] Task 3: Implement sliding window cleanup (AC: #2)
  - [x] 3.1: Remove timestamps older than window duration (default 1 second)
  - [x] 3.2: Call cleanup before each acquire check
  - [x] 3.3: Ensure O(n) cleanup with efficient deque operations

- [x] Task 4: Implement `get_remaining()` method (AC: #4)
  - [x] 4.1: Clean expired entries
  - [x] 4.2: Return `limit - current_count`
  - [x] 4.3: Thread-safe read access

- [x] Task 5: Implement metrics collection (AC: #5)
  - [x] 5.1: Track `requests_throttled` counter (increments when `acquire()` must wait)
  - [x] 5.2: Track cumulative wait time for `avg_wait_time` calculation
  - [x] 5.3: Add `get_metrics()` method returning `RateLimiterMetrics` struct
  - [x] 5.4: Make metrics atomically accessible

- [x] Task 6: Implement configuration (AC: #6)
  - [x] 6.1: Builder pattern `BitgetRateLimiterBuilder` for configuration
  - [x] 6.2: Default config: 10 orders/sec (per NFR4), 20 reads/sec
  - [x] 6.3: Support runtime limit adjustment `set_limit(endpoint_type, limit)`
  - [x] 6.4: Testnet tier (higher limits), mainnet tier (standard), premium tier

- [x] Task 7: Write comprehensive tests (AC: #7)
  - [x] 7.1: Test basic throttling - verify requests at capacity must wait
  - [x] 7.2: Test sliding window - verify requests allowed after window slides
  - [x] 7.3: Test concurrent access - multiple tasks acquiring simultaneously
  - [x] 7.4: Test separate endpoint limits - verify order vs read isolation
  - [x] 7.5: Test metrics accuracy - verify counters increment correctly
  - [x] 7.6: Test `get_remaining()` accuracy during active limiting

## Dev Notes

### Relevant Architecture Patterns and Constraints

**From architecture.md:**
- **NFR4:** Bitget rate limit: ~10 orders/second
- Rate limiting is AP/issuer responsibility (batch sizing must respect this)
- AP reads `TradeRequest` events and executes on Bitget respecting rate limits
- Issuers verify fills via Bitget read-only API (separate from order placement)

**Rate Limit Context:**
```
Constraints (architecture.md Section 10):
- Bitget: ~10 orders/sec
- Effective capacity: ~20 user orders/cycle (with netting)
- Per day: ~1.7M orders
```

### Source Tree Components to Touch

**New file location:**
```
/Users/maxguillabert/Desktop/index/
├── common/
│   └── src/
│       └── rate_limit/           # NEW MODULE
│           ├── mod.rs            # Module exports
│           └── bitget.rs         # BitgetRateLimiter implementation
```

**Alternatively, can be placed in external integrations crate when Epic 5 creates it:**
```
/Users/maxguillabert/Desktop/index/
├── integrations/                  # May be created by Epic 5
│   └── src/
│       └── bitget/
│           ├── mod.rs
│           ├── rate_limiter.rs   # This story
│           ├── order_client.rs   # Story 5.1
│           └── read_client.rs    # Story 5.2
```

**Recommendation:** Place in `common/src/rate_limit/` since rate limiting is a reusable utility that both AP and Issuer will use (Issuer uses read-only API for fill verification).

### Testing Standards Summary

- All tests use `#[tokio::test]` for async testing (see existing pattern in `common/src/mocks/bitget.rs`)
- Use `tokio::time::sleep` for timing tests
- Use `std::time::Instant` for elapsed time verification
- Follow existing mock patterns: builder pattern, configurable delays
- Tests should complete quickly - use short windows (50-100ms) in tests

### Existing Code Patterns to Follow

**From `common/src/mocks/bitget.rs`:**
- Use `Arc<RwLock<State>>` for thread-safe state
- Use `async fn` with `self` reference pattern
- Builder pattern for configuration (see `MockBitgetBuilder`)
- Use `tokio::spawn` for background tasks if needed

**Error handling:**
- Use `crate::error::Error` from common crate
- Consider adding `RateLimitExceeded` variant if not present

### Algorithm: Sliding Window Rate Limiter

```rust
// Conceptual implementation
struct SlidingWindowLimiter {
    timestamps: VecDeque<Instant>,
    limit: usize,
    window: Duration,
}

impl SlidingWindowLimiter {
    fn cleanup(&mut self) {
        let cutoff = Instant::now() - self.window;
        while self.timestamps.front().map_or(false, |t| *t < cutoff) {
            self.timestamps.pop_front();
        }
    }

    async fn acquire(&mut self) -> Duration {
        self.cleanup();
        let wait_time = if self.timestamps.len() >= self.limit {
            // Calculate how long until oldest expires
            let oldest = self.timestamps.front().unwrap();
            let expires_at = *oldest + self.window;
            expires_at.saturating_duration_since(Instant::now())
        } else {
            Duration::ZERO
        };

        if !wait_time.is_zero() {
            tokio::time::sleep(wait_time).await;
            self.cleanup();
        }

        self.timestamps.push_back(Instant::now());
        wait_time
    }
}
```

### Dependencies

**Already available in workspace (see `common/Cargo.toml`):**
- `tokio` - async runtime, timing
- `async-trait` - async trait definitions (if creating trait)
- `thiserror` - error handling

**May need to add:**
- None - all required dependencies are available

### Thread Safety Requirements

The rate limiter MUST be thread-safe for concurrent access:
- AP may have multiple tasks placing orders simultaneously
- Multiple issuer nodes may query read API concurrently
- Use `Arc<RwLock<_>>` or `Arc<Mutex<_>>` appropriately

### Project Structure Notes

- Alignment with unified project structure: Place in `common/` crate for reusability
- Module path: `common::rate_limit::BitgetRateLimiter`
- Re-export from `common/src/lib.rs`: `pub mod rate_limit;`
- Follow existing module structure pattern (see `common/src/traits/mod.rs`)

### Detected Conflicts or Variances

- **None detected** - This is a new utility module with no existing conflicts
- The `APClient` trait in `common/src/traits/ap_client.rs` does not include rate limiting - this is intentional, rate limiting wraps the client

### References

- [Source: architecture.md#10-THROUGHPUT--PRIORITY] - NFR4 Bitget rate limit ~10 orders/sec
- [Source: architecture.md#3-ACTORS--ROLES] - AP executes trades on Bitget
- [Source: architecture.md#Issuer-Fill-Verification] - Issuers have read-only Bitget API access
- [Source: epics.md#Story-5.3] - Full acceptance criteria
- [Source: common/src/mocks/bitget.rs] - Pattern reference for async/thread-safe code
- [Source: common/Cargo.toml] - Available dependencies

## Dev Agent Record

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

N/A - No debug issues encountered

### Completion Notes List

- Implemented `BitgetRateLimiter` with sliding window algorithm in `common/src/rate_limit/`
- Uses `VecDeque<Instant>` for O(n) efficient timestamp tracking
- Separate `SlidingWindow` instances for order placement and read-only endpoints
- Thread-safe via `Arc<RwLock<SlidingWindow>>` pattern
- Metrics tracked via `AtomicU64` counters: `requests_throttled`, `total_wait_time_ms`, `total_requests`
- `acquire()` returns `Duration` waited (simplified from AcquireGuard per YAGNI)
- Builder pattern `BitgetRateLimiterBuilder` with fluent API
- Three tiers: Testnet (20/50), Mainnet (10/20), Premium (30/100)
- Runtime limit adjustment via `set_limit(endpoint_type, limit)`
- All 9 unit tests pass, covering all acceptance criteria
- 85 total library tests pass (no regressions)

### File List

- `common/src/rate_limit/mod.rs` (NEW) - Module exports
- `common/src/rate_limit/bitget.rs` (NEW) - BitgetRateLimiter implementation with tests
- `common/src/lib.rs` (MODIFIED) - Added `pub mod rate_limit` and `pub use rate_limit::*`

## Senior Developer Review (AI)

**Reviewer:** max
**Date:** 2026-01-30
**Outcome:** APPROVED WITH FIXES APPLIED

### Issues Found and Fixed:
1. **[HIGH] Files not staged** - Added `common/src/rate_limit/` to git
2. **[MEDIUM] get_remaining() write lock** - Added documentation noting the lock behavior
3. **[MEDIUM] No zero limit validation** - Added `assert!` in `build()` to prevent zero limits
4. **[MEDIUM] Test timing sensitivity** - Converted 7 tests to use `start_paused = true` for deterministic timing
5. **[MEDIUM] Relaxed ordering undocumented** - Added doc comment explaining relaxed ordering behavior
6. **[LOW] Pre-allocation off-by-one** - Fixed `limit + 1` → `limit`
7. **[LOW] Missing Debug trait** - Implemented `Debug` for `BitgetRateLimiter`
8. **[LOW] Doc example ignore** - Changed to `no_run` with proper async wrapper

### Tests Added:
- `test_zero_order_limit_panics` - Verifies panic on zero order limit
- `test_zero_read_limit_panics` - Verifies panic on zero read limit

## Change Log

- 2026-01-30: Code review completed - 8 issues fixed, 2 tests added
- 2026-01-29: Implemented story 5.3 - Bitget Rate Limiter with all ACs satisfied

