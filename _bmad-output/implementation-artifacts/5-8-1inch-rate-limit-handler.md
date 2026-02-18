# Story 5.8: 1inch Rate Limit Handler

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **robust rate limit handling for 1inch APIs with multi-key rotation and exponential backoff**,
so that **the system degrades gracefully under load and never gets blocked by 1inch rate limits**.

## Acceptance Criteria

1. **Given** multiple 1inch API keys configured (one per issuer node)
   **When** the handler receives a quote request
   **Then** it selects the least-loaded API key via `get_healthy_key()` and routes the request through it

2. **Given** a 1inch API call returns HTTP 429 (rate limited)
   **When** the handler retries
   **Then** it uses exponential backoff with delays: 1s, 2s, 4s, 8s, 16s (max 5 retries)

3. **Given** 5 consecutive retries have failed for a key
   **When** the handler exhausts retries
   **Then** it marks the key as temporarily exhausted and falls back to the next healthy key or returns a fallback-needed error

4. **Given** the handler is managing multiple API keys
   **When** `get_healthy_key()` is called
   **Then** it returns the key with the lowest recent request count (least-loaded)

5. **Given** rate limit events are occurring
   **When** monitoring the handler
   **Then** metrics are exposed: `rate_limits_hit`, `retries`, `fallbacks`, `keys_exhausted`, and per-key request counts

6. **Given** unit tests with controlled timing
   **When** running the test suite
   **Then** tests verify: exponential backoff timing, key rotation on rate limit, multi-key load balancing, metrics accuracy, and exhaustion fallback behavior

## Tasks / Subtasks

- [x] Task 1: Create rate limit handler module (AC: #1, #4)
  - [x] Create `common/src/integrations/oneinch/rate_limiter.rs`
  - [x] Add `pub mod rate_limiter;` to `common/src/integrations/oneinch/mod.rs`
  - [x] Define `OneInchRateLimitHandler` struct with key pool management
  - [x] Define `RateLimitConfig` struct with configurable backoff params
  - [x] Define `ApiKeyState` struct tracking per-key: `key`, `request_count`, `last_rate_limited`, `consecutive_failures`, `exhausted_until`

- [x] Task 2: Implement API key pool and selection (AC: #1, #4)
  - [x] Store keys in `Vec<Arc<RwLock<ApiKeyState>>>` for concurrent access
  - [x] Implement `get_healthy_key()` -> selects key with lowest `request_count` that is not exhausted
  - [x] Skip keys where `exhausted_until > Instant::now()`
  - [x] If all keys exhausted, return `OneInchError::MaxRetriesExceeded` or wait for earliest recovery
  - [x] Implement `add_key(api_key: String)` for runtime key addition

- [x] Task 3: Implement exponential backoff retry (AC: #2, #3)
  - [x] Implement `execute_with_retry<F, T>(f: F) -> Result<T, OneInchError>` generic retry wrapper
  - [x] On `OneInchError::RateLimited`: backoff 1s, 2s, 4s, 8s, 16s (base=1s, multiplier=2x)
  - [x] On `OneInchError::NetworkError`: same backoff (retryable per `is_retryable()`)
  - [x] On non-retryable errors: return immediately, no retry
  - [x] After 5 failures on one key: mark key exhausted for 60s, try next key
  - [x] After all keys exhausted on 5 retries each: return `OneInchError::MaxRetriesExceeded`
  - [x] Use `Retry-After` header value from `retry_after_ms` if provided by API

- [x] Task 4: Implement rate-limited quote client wrapper (AC: #1, #2)
  - [x] Implement `pub async fn get_quote(&self, from_token, to_token, amount, chain) -> Result<Quote, OneInchError>`
  - [x] Select healthy key → create temporary `OneInchQuoteClient` with that key → call get_quote → retry on failure
  - [x] Alternatively: accept a `CachedQuoteClient` (from Story 5.5) and wrap its calls with retry logic
  - [x] Expose same interface signature as `OneInchQuoteClient` and `CachedQuoteClient`

- [x] Task 5: Implement metrics (AC: #5)
  - [x] Define `RateLimitMetrics` struct with `AtomicU64` counters
  - [x] Track: `rate_limits_hit`, `retries_total`, `fallbacks_triggered`, `keys_exhausted`
  - [x] Track per-key: `requests_sent`, `rate_limits_received`
  - [x] `pub fn metrics(&self) -> RateLimitMetricsSnapshot` returns current values
  - [x] Follow `AtomicU64` + snapshot pattern from `BitgetRateLimiter` (Story 5.3)

- [x] Task 6: Write unit tests (AC: #6)
  - [x] Test exponential backoff timing (use `tokio::time::pause()` for deterministic tests)
  - [x] Test key rotation: key A rate-limited → next request uses key B
  - [x] Test multi-key load balancing: requests distributed across keys
  - [x] Test key exhaustion: 5 consecutive rate limits → key marked exhausted
  - [x] Test all-keys-exhausted: returns `MaxRetriesExceeded`
  - [x] Test non-retryable errors pass through immediately
  - [x] Test metrics counters increment correctly
  - [x] Test `Retry-After` header respected when provided
  - [x] Test key recovery after exhaustion timeout (60s)

## Dev Notes

### Architecture Compliance

**From architecture.md Section 14 (1inch API Rate Limit Strategy):**

The architecture defines 4 strategies for handling 1inch rate limits. This story implements **Strategy 1 (Multiple API Keys)** and **Strategy 2 (Exponential Backoff)**:

```
STRATEGY 1: MULTIPLE API KEYS
- Each issuer uses own 1inch API key
- 20 issuers = 20x rate limit capacity
- Leader rotates which issuer fetches quotes

STRATEGY 2: EXPONENTIAL BACKOFF
On 429 response: 1s → 2s → 4s → 8s → 16s
Max 5 retries, then use fallback
```

Strategy 3 (Quote Caching) is Story 5.5. Strategy 4 (On-Chain Fallback) is Story 5.9.

**Integration in the Issuer Cycle:**
```
Issuer Cycle → Price Fetching → OneInchRateLimitHandler
                                     ├─ key rotation + retry
                                     ├─ CachedQuoteClient (Story 5.5)
                                     ├─ OneInchQuoteClient (Story 5.4)
                                     └─ (on total failure) → caller uses OnchainQuoteClient (Story 5.9)
```

The rate limit handler sits between the issuer's price-fetching logic and the cached/raw quote clients. It does NOT directly invoke the on-chain fallback; instead it returns an error that the caller (issuer cycle) uses to trigger fallback.

### Technical Requirements

**Backoff Configuration:**
```rust
pub struct RateLimitConfig {
    /// Base delay for exponential backoff (default: 1 second)
    pub base_delay: Duration,
    /// Backoff multiplier (default: 2)
    pub multiplier: u32,
    /// Maximum retries per key before marking exhausted (default: 5)
    pub max_retries_per_key: u32,
    /// Duration a key stays exhausted before recovery (default: 60 seconds)
    pub exhaustion_cooldown: Duration,
    /// Maximum total retry attempts across all keys
    pub max_total_retries: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            base_delay: Duration::from_secs(1),
            multiplier: 2,
            max_retries_per_key: 5,
            exhaustion_cooldown: Duration::from_secs(60),
            max_total_retries: 15, // 5 retries × 3 keys before giving up
        }
    }
}
```

**Key State Tracking:**
```rust
pub struct ApiKeyState {
    pub api_key: String,
    pub requests_sent: AtomicU64,
    pub rate_limits_received: AtomicU64,
    pub consecutive_failures: AtomicU32,
    pub exhausted_until: RwLock<Option<Instant>>,
}
```

**Error Flow:**
- `OneInchError::RateLimited { retry_after_ms }` → exponential backoff, respect `retry_after_ms` if set
- `OneInchError::NetworkError` → same retry logic (marked retryable in `error.rs`)
- `OneInchError::Timeout` → same retry logic (marked retryable in `error.rs`)
- All other errors → return immediately, not retryable
- The existing `OneInchError::is_retryable()` method in `error.rs` already classifies these correctly

### Dependencies

**Already available in `common/Cargo.toml` - NO new dependencies needed:**
- `tokio` (workspace) - async runtime, `time::sleep`, `time::pause` for tests
- `tracing = "0.1"` - logging rate limit events
- `dashmap = "5"` - if needed for concurrent key state (though `Vec<Arc<RwLock>>` may suffice)

**From Story 5.4 (dependency):**
- `OneInchQuoteClient` in `common/src/integrations/oneinch/client.rs`
- `Quote`, `QuoteRequest`, `SupportedChain` from `types.rs`
- `OneInchError` from `error.rs` - already has `RateLimited`, `MaxRetriesExceeded`, `is_retryable()`, `retry_after()`

**From Story 5.5 (dependency):**
- `CachedQuoteClient` in `common/src/integrations/oneinch/cache.rs` (wraps 5.4 client)
- The rate limit handler should work with EITHER `OneInchQuoteClient` or `CachedQuoteClient`
- Consider using the `QuoteProvider` trait (if 5.5 defines one) as the generic inner client type

### File Structure

```
common/src/integrations/oneinch/
├── mod.rs              # MODIFY: add `pub mod rate_limiter;`
├── rate_limiter.rs     # NEW: OneInchRateLimitHandler implementation
├── cache.rs            # EXISTING (Story 5.5): CachedQuoteClient
├── client.rs           # EXISTING (Story 5.4): OneInchQuoteClient
├── types.rs            # EXISTING: Quote, QuoteRequest, SupportedChain
├── error.rs            # EXISTING: OneInchError (already has MaxRetriesExceeded)
├── swap_builder.rs     # EXISTING (Story 5.6): SwapCalldataBuilder
└── fusion_plus.rs      # EXISTING (Story 5.7): FusionPlusClient
```

**Only 2 files to modify/create:**
1. `rate_limiter.rs` - NEW (all rate limit handler implementation)
2. `mod.rs` - ADD one line: `pub mod rate_limiter;`

### Design Decisions

**Generic vs Concrete Inner Client:**
The handler should be generic over `QuoteProvider` trait (from Story 5.5) if available. If not available, accept `Arc<CachedQuoteClient>` or `Arc<OneInchQuoteClient>`. The key insight: the handler manages API key rotation, NOT the underlying HTTP calls directly. It creates temporary clients per key or wraps a shared client.

**Recommended approach:**
```rust
pub struct OneInchRateLimitHandler<T: QuoteProvider> {
    inner: T,               // The underlying quote client (cached or raw)
    keys: Vec<ApiKeyEntry>, // API key pool
    config: RateLimitConfig,
    metrics: RateLimitMetrics,
}
```

However, since `OneInchQuoteClient` stores the API key internally and isn't easily swappable at runtime, the simpler approach is:
```rust
pub struct OneInchRateLimitHandler {
    keys: Vec<Arc<RwLock<ApiKeyState>>>,
    config: RateLimitConfig,
    metrics: RateLimitMetrics,
    http_client: reqwest::Client, // shared HTTP client
}

impl OneInchRateLimitHandler {
    pub async fn get_quote(&self, from_token: &str, to_token: &str, amount: &str, chain: SupportedChain) -> Result<Quote, OneInchError> {
        // 1. Select healthy key
        // 2. Create temp OneInchQuoteClient with that key
        // 3. Call get_quote
        // 4. On RateLimited → backoff, mark key, try next key
        // 5. Return result or MaxRetriesExceeded
    }
}
```

Choose the approach that best fits how `OneInchQuoteClient` is constructed (check if it accepts a shared `reqwest::Client`). If not, the handler can use the `QuoteProvider` trait approach with key injection.

**Do NOT duplicate caching logic** - the `CachedQuoteClient` (Story 5.5) handles caching. This handler handles retries and key rotation only. The recommended integration stack is:
```
Issuer → OneInchRateLimitHandler → CachedQuoteClient → OneInchQuoteClient → 1inch API
```

### Previous Story Intelligence

**From Story 5.4 (1inch Quote API Client):**
- `OneInchQuoteClient::new(api_key, config)` takes API key as first arg
- `get_quote()` signature: `async fn get_quote(&self, from_token: &str, to_token: &str, amount: &str, chain: SupportedChain) -> Result<Quote, OneInchError>`
- Error types already include `RateLimited { retry_after_ms }` and `MaxRetriesExceeded { attempts }`
- `is_retryable()` returns true for `RateLimited`, `NetworkError`, `Timeout`
- `retry_after()` returns `Option<u64>` with API-provided delay
- Token address validation exists (0x prefix, 40 hex chars)
- Default request timeout: 10 seconds

**From Story 5.5 (1inch Quote Cache):**
- `CachedQuoteClient` wraps `OneInchQuoteClient` with 5-second TTL
- Uses `DashMap` for concurrent cache storage
- Exposes same `get_quote()` interface
- May define `QuoteProvider` trait for generic client injection
- Metrics: hits, misses, evictions via `AtomicU64`

**From Story 5.3 (Bitget Rate Limiter) - PATTERN REFERENCE:**
- `BitgetRateLimiter` in `common/src/rate_limit/bitget.rs`
- Uses `VecDeque<Instant>` sliding window - different approach (per-second windowing)
- Thread-safe via `Arc<RwLock<SlidingWindow>>`
- Metrics via `AtomicU64` counters with `Relaxed` ordering
- Builder pattern for configuration
- Tests use `start_paused = true` for deterministic timing - FOLLOW THIS PATTERN
- 11 total tests covering throttling, concurrency, and edge cases

### Testing Standards

**Use `tokio::time` with `start_paused = true` for deterministic tests:**
```rust
#[tokio::test(start_paused = true)]
async fn test_exponential_backoff_timing() {
    // With paused time, tokio::time::sleep advances instantly
    // Use tokio::time::advance() to control time progression
    // This avoids flaky tests from real-world timing
}
```

**Mock the quote client for testing:**
- Define a `MockQuoteClient` that can return configurable errors
- Set it to return `RateLimited` N times then success
- Verify retry count and key rotation behavior

**Test vectors:**
```rust
// Backoff sequence: 1s, 2s, 4s, 8s, 16s = 31s total
const EXPECTED_DELAYS: [Duration; 5] = [
    Duration::from_secs(1),
    Duration::from_secs(2),
    Duration::from_secs(4),
    Duration::from_secs(8),
    Duration::from_secs(16),
];
```

### Security Considerations

- **NEVER log API keys** - follow `OneInchQuoteClient` pattern of redacting in Debug
- Key state struct should implement custom `Debug` to redact keys
- All keys stored in memory only, not persisted
- Key selection algorithm should not leak information about which keys are rate-limited

### Integration with Other Stories

**Dependencies (must be completed first):**
- Story 5.4: 1inch Quote API Client (provides `OneInchQuoteClient`, `OneInchError`) - DONE
- Story 5.5: 1inch Quote Cache (provides `CachedQuoteClient`) - must be implemented first or in parallel

**Stories that will use this:**
- Story 6.7: Wire Issuer to 1inch (uses this handler for all 1inch API calls)
- Story 3.13: Price Fetching & Staleness (uses this handler during issuer cycle)

**Downstream usage pattern:**
```
Issuer Cycle Price Fetch
    → OneInchRateLimitHandler.get_quote()
        → [select healthy key]
        → CachedQuoteClient.get_quote() [cache layer]
            → OneInchQuoteClient.get_quote() [HTTP layer]
        → [on 429] backoff + rotate key + retry
        → [on 5x failure] MaxRetriesExceeded → caller triggers OnchainQuoteClient fallback
```

### Project Structure Notes

- Lives in `common/src/integrations/oneinch/rate_limiter.rs` alongside other oneinch modules
- Follows established patterns from `BitgetRateLimiter` for metrics and testing
- Follows established patterns from `CachedQuoteClient` for DashMap/concurrent access
- Single new file keeps changes minimal

### References

- [Source: architecture.md#14-1inch-api-rate-limit-strategy] - Rate limiting strategies 1 & 2
- [Source: architecture.md#14-provider-fees] - 1inch API cost and rate context
- [Source: architecture.md#fusion-plus-execution-retry] - Retry pattern reference
- [Source: epics.md#Story-5.8] - 1inch Rate Limit Handler requirements
- [Source: 5-4-1inch-quote-api-client.md] - OneInchQuoteClient API surface and error types
- [Source: 5-5-1inch-quote-cache.md] - CachedQuoteClient patterns and QuoteProvider trait
- [Source: 5-3-bitget-rate-limiter.md] - Rate limiter pattern reference (metrics, testing)
- [Source: common/src/integrations/oneinch/error.rs] - OneInchError with RateLimited, MaxRetriesExceeded
- [Source: common/src/rate_limit/bitget.rs] - BitgetRateLimiter pattern reference

## Dev Agent Record

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

- N/A - Implementation proceeded without debug issues

### Completion Notes List

- Implemented `OneInchRateLimitHandler` that creates temporary `OneInchQuoteClient` instances per request with the selected API key
- Supports multi-key rotation with least-loaded selection via `get_healthy_key()`
- Implements exponential backoff: 1s, 2s, 4s, 8s, 16s (configurable via `RateLimitConfig`)
- Keys are exhausted after 5 consecutive failures and enter 60s cooldown
- Respects `Retry-After` header from API when provided (parsed from HTTP response)
- Uses shared `reqwest::Client` for connection pooling across all temporary clients
- Metrics track: `rate_limits_hit`, `retries_total`, `fallbacks_triggered`, `keys_exhausted`, `network_errors`
- Per-key metrics: `requests_sent`, `rate_limits_received`, `consecutive_failures`
- 32 unit tests covering all acceptance criteria including timing tests with `start_paused = true` and concurrent access safety
- API keys are redacted in Debug output for security
- Uses synchronous `std::sync::RwLock` for key exhaustion state to avoid async overhead in hot path

### File List

**New Files:**
- common/src/integrations/oneinch/rate_limiter.rs

**Modified Files:**
- common/src/integrations/oneinch/mod.rs (added `pub mod rate_limiter;` and `pub use rate_limiter::*;`)
- common/src/integrations/oneinch/client.rs (added `with_client()` constructor, `parse_retry_after_header()` for HTTP header parsing)

### Senior Developer Review (AI)

**Reviewed:** 2026-01-30
**Reviewer:** claude-opus-4-5-20251101

#### Issues Found and Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| 🔴 HIGH | API keys in pool not actually used for requests - handler called inner client's fixed key | Refactored to create temporary `OneInchQuoteClient` per request with selected key |
| 🔴 HIGH | Race condition in `get_healthy_key()` with async locks during iteration | Changed `ApiKeyState.exhausted_until` to synchronous `std::sync::RwLock` |
| 🟡 MEDIUM | No concurrent access test | Added `test_concurrent_access_safety` with 50 parallel requests |
| 🟡 MEDIUM | Retry-After header never parsed from HTTP response | Added `parse_retry_after_header()` to client.rs |
| 🟡 MEDIUM | No network error tracking in metrics | Added `network_errors` counter to `RateLimitMetrics` |
| 🟡 MEDIUM | Inconsistent non-retryable error handling | Added `record_non_retryable_error()` method |

#### Architectural Changes

The original implementation wrapped a `QuoteProvider` trait object but couldn't actually rotate API keys because the inner client had a fixed key. The fix:

1. Removed generic `<T: QuoteProvider>` approach
2. Handler now stores shared `reqwest::Client` and creates temporary `OneInchQuoteClient` instances
3. Each request uses the selected key from the pool to create a fresh client
4. Added `OneInchQuoteClient::with_client()` constructor to accept shared HTTP client

#### Test Results

All 32 tests pass including:
- Exponential backoff timing with `start_paused = true`
- Key rotation on rate limit
- Concurrent access safety (50 parallel requests)
- Key recovery after exhaustion timeout
- Retry-After header respected

### Change Log

- 2026-01-30: Initial implementation of Story 5.8 - 1inch Rate Limit Handler with multi-key rotation and exponential backoff
- 2026-01-30: Code review fixes - Architectural refactor to actually use rotated API keys, added network error metrics, concurrent access test, Retry-After header parsing
