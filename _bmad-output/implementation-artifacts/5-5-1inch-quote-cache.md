# Story 5.5: 1inch Quote Cache

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **cached 1inch quotes with 5-second TTL to reduce API calls**,
so that **multiple orders in the same cycle reuse cached quotes and we avoid hitting 1inch rate limits**.

## Acceptance Criteria

1. **Given** a `OneInchQuoteClient` from Story 5.4 is available
   **When** I create a `CachedQuoteClient` wrapping it
   **Then** the cache client exposes the same `get_quote(from_token, to_token, amount, chain)` interface

2. **Given** a quote was fetched less than 5 seconds ago for the same parameters
   **When** `get_quote_cached()` is called with the same `(from_token, to_token, amount, chain)`
   **Then** the cached quote is returned without making an API call

3. **Given** a cached quote is older than 5 seconds
   **When** `get_quote_cached()` is called
   **Then** a fresh quote is fetched from 1inch API and the cache is updated

4. **Given** cache operations occurring from multiple async tasks concurrently
   **When** concurrent reads and writes happen
   **Then** the cache is thread-safe with no data races or panics

5. **Given** cache metrics are exposed
   **When** monitoring the cache
   **Then** `hits`, `misses`, and `evictions` counters are available

6. **Given** unit tests covering cache behavior
   **When** running the test suite
   **Then** tests verify: cache hit on same params within TTL, cache miss after TTL expires, cache miss on different params, concurrent access safety, and metrics accuracy

## Tasks / Subtasks

- [x] Task 1: Create cache module structure (AC: #1)
  - [x] Create `common/src/integrations/oneinch/cache.rs`
  - [x] Add `pub mod cache;` to `common/src/integrations/oneinch/mod.rs`
  - [x] Define `CachedQuoteClient` struct wrapping `OneInchQuoteClient`
  - [x] Define `QuoteCacheConfig` struct with `ttl_secs: u64` (default 5)

- [x] Task 2: Implement cache key and entry types (AC: #2, #3)
  - [x] Define cache key as `String` using format: `"{chain_id}:{from_token}:{to_token}:{amount}"`
  - [x] Define `CacheEntry` struct: `{ quote: Quote, inserted_at: Instant }`
  - [x] Use `DashMap<String, CacheEntry>` for concurrent cache storage (matches existing codebase pattern)

- [x] Task 3: Implement cached quote fetching (AC: #1, #2, #3, #4)
  - [x] Implement `pub async fn get_quote(&self, from_token, to_token, amount, chain) -> Result<Quote, OneInchError>`
  - [x] Build cache key from parameters (lowercase token addresses for consistency)
  - [x] Check cache: if entry exists and `inserted_at.elapsed() < ttl` → return cached quote
  - [x] On cache miss or expiry: call inner `OneInchQuoteClient::get_quote()`, insert result, return
  - [x] Implement `pub async fn get_quote_from_request(&self, request: &QuoteRequest) -> Result<Quote, OneInchError>` convenience wrapper

- [x] Task 4: Implement cache management methods (AC: #1)
  - [x] `pub fn clear_cache(&self)` - remove all entries
  - [x] `pub fn cache_size(&self) -> usize` - return current entry count
  - [x] `pub fn evict_expired(&self) -> usize` - remove entries older than TTL, return count evicted

- [x] Task 5: Implement cache metrics (AC: #5)
  - [x] Define `QuoteCacheMetrics` struct with `AtomicU64` counters: `hits`, `misses`, `evictions`
  - [x] Increment `hits` on cache hit, `misses` on cache miss
  - [x] Increment `evictions` when expired entries are removed
  - [x] `pub fn metrics(&self) -> QuoteCacheSnapshot` returns current counter values
  - [x] `pub fn hit_rate(&self) -> f64` returns `hits / (hits + misses)` (0.0 if no requests)

- [x] Task 6: Write unit tests (AC: #6)
  - [x] Test cache hit within TTL (same key returns cached, no API call)
  - [x] Test cache miss after TTL expiry (new API call made)
  - [x] Test cache miss on different params (different key = new fetch)
  - [x] Test concurrent access with `tokio::spawn` multiple tasks
  - [x] Test `clear_cache()` invalidates all entries
  - [x] Test `evict_expired()` removes stale entries
  - [x] Test metrics accuracy (hits/misses/evictions counted correctly)
  - [x] Test `hit_rate()` calculation
  - [x] Test configurable TTL (non-default value)

## Dev Notes

### Architecture Compliance

**From architecture.md Section 14 (1inch API Rate Limit Strategy):**
- Quote caching is Strategy 3 of 4 for handling 1inch rate limits
- Cache TTL: 5 seconds (configurable)
- Multiple orders in the same issuer cycle (1 second) reuse cached quotes
- Expected reduction: 60-80% fewer API calls
- Cache data structure per architecture: `HashMap<PairId, QuoteCache>` with `pairId`, `quote`, `timestamp`

**Architecture pseudocode:**
```
fn get_quote(pair_id) -> Quote {
    if cache[pair_id].timestamp > now() - 5s:
        return cache[pair_id].quote;
    return fetch_with_backoff(pair_id);
}
```

**DEX Price Staleness (NFR5):**
- DEX pairs (1inch): 30-second staleness limit
- Cache TTL of 5 seconds is well within the 30-second staleness window
- Cached quotes remain valid for price validation purposes

### Technical Requirements

**Concurrency Model:**
- Use `DashMap` (already in `common/Cargo.toml` as `dashmap = "5"`) for lock-free concurrent access
- This matches the established pattern in `common/src/integrations/onchain_quote/client.rs` which uses `DashMap` for pool address caching
- Use `std::time::Instant` for monotonic time measurement (not `SystemTime` which can drift)

**Cache Key Format:**
```rust
// Lowercase addresses for case-insensitive matching
fn cache_key(from_token: &str, to_token: &str, amount: &str, chain: SupportedChain) -> String {
    format!("{}:{}:{}:{}",
        chain.chain_id(),
        from_token.to_lowercase(),
        to_token.to_lowercase(),
        amount
    )
}
```

**Cache Entry:**
```rust
struct CacheEntry {
    quote: Quote,
    inserted_at: Instant,
}
```

**IMPORTANT - Amount in Cache Key:**
The `amount` is part of the cache key because 1inch quotes vary by amount due to liquidity depth and routing. The same token pair at different amounts can yield different prices and routes.

**Metrics Pattern:**
Follow the existing `OnchainQuoteMetrics` pattern from `common/src/integrations/onchain_quote/client.rs`:
```rust
pub struct QuoteCacheMetrics {
    pub hits: AtomicU64,
    pub misses: AtomicU64,
    pub evictions: AtomicU64,
}
```

### Dependencies

**Already available in `common/Cargo.toml` - NO new dependencies needed:**
- `dashmap = "5"` - concurrent hashmap (already used by onchain_quote)
- `tokio` (workspace) - async runtime
- `tracing = "0.1"` - logging

**From Story 5.4 (dependency):**
- `OneInchQuoteClient` - the underlying quote client
- `Quote`, `QuoteRequest`, `SupportedChain` - types from `oneinch/types.rs`
- `OneInchError` - error type from `oneinch/error.rs`

### File Structure

```
common/src/integrations/oneinch/
├── mod.rs            # ADD: pub mod cache;
├── cache.rs          # NEW: CachedQuoteClient implementation
├── client.rs         # EXISTING: OneInchQuoteClient (Story 5.4)
├── types.rs          # EXISTING: Quote, QuoteRequest, SupportedChain
├── error.rs          # EXISTING: OneInchError
├── swap_builder.rs   # EXISTING: SwapCalldataBuilder (Story 5.6)
└── fusion_plus.rs    # EXISTING: FusionPlusClient (Story 5.7)
```

**Only 2 files to modify/create:**
1. `cache.rs` - NEW (all cache implementation)
2. `mod.rs` - ADD one line: `pub mod cache;`

### Testing Standards

**Unit Tests in `cache.rs`:**
- Use a mock/stub `OneInchQuoteClient` or trait-based injection for testing without HTTP
- Use `tokio::time::sleep` + short TTL (e.g., 100ms) for TTL expiry tests instead of waiting 5 seconds
- Use `tokio::spawn` for concurrent access tests
- No network calls in unit tests

**Test Pattern for Cache Hit:**
```rust
#[tokio::test]
async fn test_cache_hit_within_ttl() {
    // 1. Create CachedQuoteClient with mock inner client
    // 2. First call: cache miss, fetches from inner client
    // 3. Second call: cache hit, returns cached quote
    // 4. Assert inner client was called only once
    // 5. Assert metrics: hits=1, misses=1
}
```

**Consider:** Define a trait (`QuoteProvider`) that both `OneInchQuoteClient` and a mock can implement, enabling clean test injection. Example:

```rust
#[async_trait]
pub trait QuoteProvider: Send + Sync {
    async fn get_quote(&self, from_token: &str, to_token: &str, amount: &str, chain: SupportedChain) -> Result<Quote, OneInchError>;
}
```

This also makes `CachedQuoteClient<T: QuoteProvider>` generic, which is cleaner than hardcoding the inner client type.

### Previous Story Intelligence (Story 5.4)

**From Story 5.4 completion notes:**
- `OneInchQuoteClient` lives in `common/src/integrations/oneinch/client.rs`
- Module was placed in `common/src/integrations/` (not `external/` as originally planned)
- Types (`Quote`, `QuoteRequest`, `SupportedChain`) are in `types.rs`
- Error types (`OneInchError`) are shared across stories 5-4, 5-6, 5-7 in `error.rs`
- API key stored securely, Debug impl redacts it
- Token address validation exists: 0x prefix + 40 hex chars
- `get_quote()` signature: `async fn get_quote(&self, from_token: &str, to_token: &str, amount: &str, chain: SupportedChain) -> Result<Quote, OneInchError>`
- `get_quote_from_request(&self, request: &QuoteRequest)` convenience method also available

**Key pattern: `Quote` type from 5.4:**
```rust
pub struct Quote {
    pub to_amount: String,
    pub estimated_gas: u64,
    pub protocols: Vec<Protocol>,
}
```
`Quote` must implement `Clone` to be stored in cache and returned. If it doesn't already, the `CacheEntry` will need to clone it. Check if `Quote` derives `Clone` - if not, add `#[derive(Clone)]` to `Quote` in `types.rs`.

### Git Intelligence

Recent commits show active work on Epic 5 external integrations:
- `d21d866` Add common crate dependencies and module exports
- `7a67b6d` Add on-chain quote fallback module (Story 5.9)
- `460be19` Add on-chain quote fallback for DEX pricing (Story 5.9)

The on-chain quote module (`onchain_quote`) uses `DashMap` for caching and `AtomicU64` for metrics - follow these established patterns.

### Integration with Other Stories

**This story is used by:**
- **Story 5.8** (1inch Rate Limit Handler) - wraps this cached client with backoff/retry
- **Story 6.7** (Wire Issuer to 1inch) - uses cached quotes during issuer cycle
- **Story 3.13** (Price Fetching & Staleness) - uses cached quotes for DEX price validation

**Downstream usage pattern:**
```
Issuer Cycle → Price Fetching → CachedQuoteClient → (cache hit OR OneInchQuoteClient → 1inch API)
                                                   ↘ (on API failure) → OnchainQuoteClient (Story 5.9)
```

### Security Considerations

- Cache stores quote data only (no API keys)
- Cache entries are in-memory only (not persisted to disk)
- No sensitive data in cache keys (token addresses are public)
- API key handling stays in the inner `OneInchQuoteClient` (not duplicated)

### Project Structure Notes

- Follows existing `onchain_quote` caching pattern with `DashMap`
- Single new file (`cache.rs`) keeps changes minimal
- Generic `QuoteProvider` trait enables clean testing and future extensibility
- No new dependencies required (all already in Cargo.toml)

### References

- [Source: architecture.md#14-1inch-api-rate-limit-strategy] - Quote caching strategy (Strategy 3)
- [Source: architecture.md#14-order-routing-cross-chain-execution] - 1inch as DEX aggregator
- [Source: architecture.md#7-price-staleness-validation] - DEX 30s staleness limit (NFR5)
- [Source: epics.md#Story-5.5] - 1inch Quote Cache requirements
- [Source: 5-4-1inch-quote-api-client.md] - Previous story patterns and API surface
- [Source: common/src/integrations/onchain_quote/client.rs] - DashMap caching pattern reference

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - clean implementation

### Completion Notes List

- **2026-01-30**: Implemented complete 1inch quote cache with TTL-based caching
  - Created `CachedQuoteClient<T: QuoteProvider>` generic wrapper for any quote provider
  - Implemented `QuoteProvider` trait for clean testing and extensibility
  - Used `DashMap` for lock-free concurrent access (matches existing codebase pattern)
  - Used `std::time::Instant` for monotonic TTL measurement
  - Cache key format: `{chain_id}:{from_token_lowercase}:{to_token_lowercase}:{amount}`
  - All 14 unit tests pass covering: cache hit/miss, TTL expiry, concurrent access, metrics
  - Implemented `QuoteProvider` trait on `OneInchQuoteClient` for seamless integration

### File List

- `common/src/integrations/oneinch/cache.rs` (NEW) - CachedQuoteClient implementation with 14 unit tests
- `common/src/integrations/oneinch/mod.rs` (MODIFIED) - Added `pub mod cache;` and `pub use cache::*;`
- `common/src/integrations/oneinch/client.rs` (MODIFIED) - Added `QuoteProvider` trait impl for `OneInchQuoteClient`

### Change Log

- 2026-01-30: Story 5.5 implementation complete - 1inch Quote Cache with 5-second TTL
- 2026-01-30: Code review (Opus 4.5) - Fixed 1 HIGH, 3 MEDIUM issues:
  - H1: Removed out-of-scope chain.rs from File List and fabricated bug fix claim
  - M1: Documented TOCTOU cache stampede limitation in get_quote() doc comment
  - M2: Removed erroneous eviction recording from clear_cache() (now only TTL evictions tracked)
  - M3: Made QuoteCacheMetrics fields private (snapshot() is the public read API)
  - 2 LOW issues noted but not fixed (DEFAULT_TTL_SECS export, glob re-exports)
