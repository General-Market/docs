# Story 6.4: Wire AP to Real Bitget

Status: done

## Story

As an **AP operator**,
I want **AP connected to real Bitget**,
So that **real exchange execution works end-to-end**.

## Acceptance Criteria

1. **AC1:** Replace MockBitget with real BitgetClient when `--mock-bitget` is NOT set
   - BitgetClient (from `ap/src/external/bitget/client.rs`) implements `APClient` trait
   - Client is injected into the event processing pipeline

2. **AC2:** API keys configured via environment variables
   - `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE` (already in APConfig)
   - Startup fails with clear error if live mode and credentials missing

3. **AC3:** Testnet mode for initial testing
   - `--bitget-testnet` flag or `BITGET_TESTNET=true` env var
   - Defaults to testnet when first wired (safety default)
   - BitgetConfig uses testnet vs mainnet base URL accordingly

4. **AC4:** Rate limiter active for all Bitget calls
   - BitgetRateLimiter (from `common/src/rate_limit/bitget.rs`) wraps order placement
   - Separate limits: 10 orders/sec (placement), 20 req/sec (read)
   - Rate limit metrics exposed to APMetrics

5. **AC5:** Integration test: place order -> verify fill -> report
   - End-to-end test on Bitget testnet with real API credentials
   - Verifies: order placed -> fill received -> fill reported to chain (mock chain)
   - Test marked `#[ignore]` for manual execution

6. **AC6:** Buffer management works with real balances
   - BufferManager tracks real Bitget portfolio balances
   - Small orders still served from buffer, replenishment via real Bitget orders

7. **AC7:** Mainnet switch via config flag
   - `--bitget-mainnet` or `BITGET_MAINNET=true` overrides testnet default
   - Clear log message on startup showing which Bitget environment is active

## Tasks / Subtasks

- [x] Task 1: Implement `APClient` trait for `BitgetClient` (AC: #1)
  - [x] 1.1: Added `APClient` impl via `RateLimitedBitgetClient` wrapper in `ap/src/external/bitget/rate_limited.rs`
  - [x] 1.2: Map `APClient::place_order(pair, side, amount, price)` to `BitgetClient::place_limit_order()`
  - [x] 1.3: Map `APClient::get_fills(order_id)` to `BitgetClient::get_order_fills()` (Option A: added to BitgetClient)
  - [x] 1.4: Map `APClient::get_order_status(order_id)` to `BitgetClient::get_order_detail()`
  - [x] 1.5: Handle type conversions: `u256_to_decimal()`, `decimal_to_u256()`, `side_to_order_side()`, `bitget_status_to_order_status()`

- [x] Task 2: Create rate-limited Bitget client wrapper (AC: #4)
  - [x] 2.1: Created `RateLimitedBitgetClient` struct wrapping `BitgetClient` + `Arc<BitgetRateLimiter>`
  - [x] 2.2: Implemented `APClient` trait with rate limit acquisition before each API call
  - [x] 2.3: Exposed rate limiter metrics via `get_rate_limiter_metrics()`

- [x] Task 3: Add testnet/mainnet config support (AC: #3, #7)
  - [x] 3.1: Added `bitget_testnet: Option<bool>` to `APConfig` (default: `true` for safety)
  - [x] 3.2: Added `--bitget-testnet` / `--bitget-mainnet` CLI flags to Args struct
  - [x] 3.3: Added `BITGET_TESTNET` / `BITGET_MAINNET` environment variable support with precedence
  - [x] 3.4: Added `effective_bitget_testnet()` method to APConfig
  - [x] 3.5: Pass config to `BitgetConfig::testnet()` / `BitgetConfig::mainnet()` when constructing client

- [x] Task 4: Wire real BitgetClient into AP main.rs (AC: #1, #2, #3)
  - [x] 4.1: Created `Arc<dyn APClient>` that holds either MockBitget or RateLimitedBitgetClient
  - [x] 4.2: In `run_ap()`, branch on `mock_bitget` flag to construct the appropriate client
  - [x] 4.3: When live mode: validate credentials, construct BitgetClient, authenticate, wrap with rate limiter
  - [x] 4.4: When live mode: fail startup with error if `has_bitget_credentials()` returns false
  - [x] 4.5: Pass `Arc<dyn APClient>` into `process_events()` and order execution pipeline
  - [x] 4.6: Log which Bitget mode is active on startup (testnet/mainnet/mock)

- [x] Task 5: Integrate with event processing pipeline (AC: #1, #6)
  - [x] 5.1: In `process_events()`, pass APClient to order execution when TradeRequest received
  - [x] 5.2: Wire TradeRequest → `ap_client.place_order()` via tokio::spawn
  - [x] 5.3: Wire fill verification via `ap_client.get_fills()` after order placement
  - [x] 5.4: BufferManager initialized (standalone in-memory; Bitget balance sync deferred to future story)
  - [x] 5.5: Wire TimeoutHandler to track real Bitget order timeouts (60s per NFR8) — initialized in run_ap(), passed to process_events()
  - [x] 5.6: Wire LimitOrderEnforcer to validate fill prices with limit tolerance, increment violation metrics

- [x] Task 6: Write integration tests (AC: #5)
  - [x] 6.1: Created `ap/tests/bitget_wire_integration.rs` with `#[ignore]` tests
  - [x] 6.2: Test: construct live APClient with testnet credentials from env
  - [x] 6.3: Test: place limit order via APClient trait, verify order ID returned
  - [x] 6.4: Test: query order status after placement
  - [x] 6.5: Test: rate limiter throttles when burst > 10 orders/sec
  - [x] 6.6: Test: mock chain + real Bitget end-to-end pipeline

- [x] Task 7: Write unit tests for new wiring code (AC: #1-7)
  - [x] 7.1: Unit tests for RateLimitedBitgetClient APClient impl (in rate_limited.rs)
  - [x] 7.2: Test type conversion roundtrips (U256 ↔ Decimal), side conversion, status mapping
  - [x] 7.3: Test config parsing for testnet/mainnet flags (7 new tests in config.rs)
  - [x] 7.4: Test startup failure when live mode but no credentials (config test)
  - [x] 7.5: Test type conversion edge cases: zero, roundtrip precision (in rate_limited.rs)

## Dev Notes

### Critical Architecture Context

**Story 6.4 is an integration story.** It does NOT create new modules - it WIRES existing components together:

- **BitgetClient** (Story 5.1): `ap/src/external/bitget/client.rs` - real Bitget API for order placement
- **BitgetReadOnlyClient** (Story 5.2): `common/src/integrations/bitget/read_only.rs` - issuer fill verification
- **BitgetRateLimiter** (Story 5.3): `common/src/rate_limit/bitget.rs` - sliding window rate limiting
- **MockBitget** (Story 1.5): `common/src/mocks/bitget.rs` - in-memory mock (being replaced)
- **APClient trait** (Story 1.2): `common/src/traits/ap_client.rs` - the interface to implement

### Current State of AP main.rs

The AP main currently has a TODO at `ap/src/main.rs:200-212`:

```rust
if mock_bitget {
    let _mock_bitget = MockBitgetBuilder::new()
        .with_latency(Duration::from_millis(100))
        .with_fill_delay(Duration::from_millis(500))
        .build();
    info!("MockBitget initialized (APClient - mock mode)");
} else {
    if !config.has_bitget_credentials() {
        warn!("Live Bitget mode enabled but credentials not configured");
    }
    info!("Live Bitget client would be initialized here (APClient - live mode)");
}
```

**Key issue:** The MockBitget is constructed but stored in `_mock_bitget` (unused variable). Neither MockBitget nor the real client is passed to `process_events()`. The entire order execution pipeline is stub code (TODO comments in `process_events()`).

### What Needs to Change

1. **`ap/src/main.rs`** - Construct real or mock client as `Box<dyn APClient>`, pass to event loop
2. **`ap/src/external/bitget/client.rs`** - Add `impl APClient for BitgetClient` (or a wrapper)
3. **`ap/src/config.rs`** - Add testnet/mainnet config fields
4. **New file:** `ap/src/external/bitget/rate_limited.rs` - Rate-limited wrapper implementing APClient
5. **`ap/src/main.rs` Args** - Add `--bitget-testnet`/`--bitget-mainnet` CLI flags

### APClient Trait (Interface to Match)

```rust
// From common/src/traits/ap_client.rs
#[async_trait]
pub trait APClient: Send + Sync {
    async fn place_order(&self, pair: String, side: Side, amount: U256, price: U256) -> Result<OrderId, Error>;
    async fn get_fills(&self, order_id: OrderId) -> Result<Vec<Fill>, Error>;
    async fn get_order_status(&self, order_id: OrderId) -> Result<OrderStatus, Error>;
}
```

### Type Conversion Requirements

The APClient uses `ethers::types::U256` for amounts/prices (18 decimal fixed-point). BitgetClient uses string-based decimal values. Conversion logic:

```rust
// U256 (18 decimals) -> Bitget decimal string
// Example: U256::from(42_000_500_000_000_000_000_000u128) -> "42000.50"
fn u256_to_decimal_string(value: U256, decimals: u8) -> String {
    let divisor = U256::from(10u64).pow(U256::from(decimals));
    let whole = value / divisor;
    let frac = value % divisor;
    format!("{}.{:0>width$}", whole, frac, width = decimals as usize)
}
```

**CRITICAL:** Handle precision loss carefully. Bitget may not support 18-decimal precision - typically 8 decimals max for prices. Truncate appropriately.

### BitgetClient Current API

```rust
// ap/src/external/bitget/client.rs
impl BitgetClient {
    pub fn new(config: BitgetConfig) -> Self { ... }
    pub fn try_new(config: BitgetConfig) -> Result<Self, BitgetError> { ... }
    pub fn authenticate(&mut self, api_key: &str, api_secret: &str, passphrase: &str) -> Result<(), BitgetError> { ... }
    pub async fn place_limit_order(&self, pair: &str, side: OrderSide, amount: &str, price: &str) -> Result<PlaceOrderResponse, BitgetError> { ... }
}
```

Note: BitgetClient currently does NOT implement `get_fills()` or `get_order_status()`. These exist on `BitgetReadOnlyClient` in the common crate. You will need to either:
- **Option A:** Add `get_fills()` and `get_order_status()` methods to BitgetClient (uses same API with trade credentials)
- **Option B:** Compose BitgetClient + BitgetReadOnlyClient together to implement full APClient

**Recommended: Option A** - BitgetClient already has auth, just add the GET endpoints.

### Rate Limiter Integration

```rust
// common/src/rate_limit/bitget.rs
pub struct BitgetRateLimiter { ... }

impl BitgetRateLimiter {
    pub fn new() -> Self { ... } // Default: 10 orders/sec, 20 reads/sec
    pub async fn acquire(&self, endpoint_type: EndpointType) -> Duration { ... }
    pub fn get_remaining(&self, endpoint_type: EndpointType) -> usize { ... }
    pub fn get_metrics(&self) -> RateLimiterMetrics { ... }
}

pub enum EndpointType {
    OrderPlacement,
    ReadOnly,
}
```

### Configuration Pattern

APConfig already has Bitget credential fields. Add:
```rust
// In ap/src/config.rs
pub struct APConfig {
    // ... existing fields ...
    pub bitget_testnet: Option<bool>,  // NEW: default true for safety
}
```

Environment variables: `BITGET_TESTNET=true` / `BITGET_MAINNET=true`

### Existing Event Processing Pipeline

In `ap/src/main.rs` `process_events()`, the current code handles events but has TODOs:
- `APEvent::TradeRequest` -> logs but doesn't execute (TODO: enqueue for execution)
- `APEvent::WithdrawalRequest` -> logs but doesn't process (TODO: queue for withdrawal)

This story should wire TradeRequest -> OrderQueueManager -> APClient -> FillReporter.

### Dependencies (Must Be Complete First)

| Story | Status | What It Provides |
|-------|--------|------------------|
| 6-3 (Wire AP to Real Contracts) | backlog | Real chain reader/writer - BUT this story can work with mock chain |
| 5-1 (Bitget Order Placement) | done | `BitgetClient` in `ap/src/external/bitget/` |
| 5-2 (Bitget Read-Only) | done | `BitgetReadOnlyClient` in `common/src/integrations/bitget/` |
| 5-3 (Bitget Rate Limiter) | done | `BitgetRateLimiter` in `common/src/rate_limit/` |

**Note:** Story 6-3 (Wire AP to Real Contracts) is a dependency but is still `backlog`. This story CAN proceed using MockChain for the chain side while wiring real Bitget for the exchange side. The chain wiring can be layered on top later.

### Security Considerations

- **NEVER log API secrets** - already enforced by APConfig Debug redaction
- Credentials only via environment variables, never CLI args (already enforced in ConfigBuilder)
- Testnet as default prevents accidental mainnet trades during development
- Rate limiter prevents exchange account bans

### Testing Strategy

**Unit tests** (always run): Mock HTTP with wiremock, test type conversions, config parsing
**Integration tests** (manual, `#[ignore]`): Real Bitget testnet API, requires env credentials

### Project Structure Notes

```
ap/src/
├── main.rs                       # MODIFY: wire real client, pass to pipeline
├── config.rs                     # MODIFY: add bitget_testnet field
├── external/
│   └── bitget/
│       ├── client.rs             # MODIFY: add APClient impl, get_fills, get_order_status
│       ├── rate_limited.rs       # NEW: RateLimitedBitgetClient wrapper
│       ├── mod.rs                # MODIFY: export rate_limited module
│       └── ... (existing files)
└── ... (existing modules)

ap/tests/
├── bitget_wire_integration.rs    # NEW: integration tests
└── bitget_integration.rs         # EXISTING: from Story 5.1
```

### Git Intelligence

Recent commits show work on external integrations (Stories 5.7, 5.9). Patterns to follow:
- Module structure: `mod.rs` + `client.rs` + `types.rs` + `error.rs`
- Test patterns: `wiremock` for HTTP mocking, `#[ignore]` for integration tests
- Commits: focused on single-story changes with test counts in messages

### References

- [Source: architecture.md#3-actors--roles] - AP role: Trade on Bitget, push BLS-signed txs
- [Source: architecture.md#9-ap-buffer-strategy] - Buffer management with real balances
- [Source: architecture.md#10-throughput--priority] - Bitget ~10 orders/sec constraint
- [Source: architecture.md#16-security--recovery] - AP accountability, limit order enforcement
- [Source: ap/src/main.rs:200-212] - Current mock/live branching code
- [Source: ap/src/config.rs] - APConfig with credential fields
- [Source: ap/src/external/bitget/client.rs] - BitgetClient implementation
- [Source: common/src/traits/ap_client.rs] - APClient trait definition
- [Source: common/src/rate_limit/bitget.rs] - BitgetRateLimiter
- [Source: common/src/mocks/bitget.rs] - MockBitget (being replaced)
- [Source: epics.md#Story-6.4] - Original acceptance criteria

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Compilation verified: `cargo check -p ap` passes (0 errors, 4 pre-existing warnings)
- Unit tests verified: `cargo test -p ap --lib` passes (295 tests, 0 failures)
- New config tests verified: 7/7 pass (testnet defaults, env vars, CLI flags, merge, credentials)

### Completion Notes List

- Chose Option A from Dev Notes: added `get_order_detail()` and `get_order_fills()` to `BitgetClient` (same auth, just GET endpoints)
- Used `Arc<dyn APClient>` instead of `Box<dyn APClient>` for Send+Sync thread safety with tokio::spawn
- Bitget string order IDs converted to U256 via `from_dec_str()` with keccak256 hash fallback for non-numeric IDs; order ID mapping stored in RateLimitedBitgetClient for reverse lookup
- Fill verification uses exponential backoff polling (1s, 2s, 4s, 8s, 16s — 5 attempts, 31s total before deferring to timeout handler)
- BufferManager is standalone (no APClient dependency); real Bitget balance sync deferred to future story
- Pre-existing errors in common crate (from concurrent Story 6.3) were already resolved on disk before this session
- TimeoutHandler and LimitOrderEnforcer initialized in run_ap(), passed through to process_events()

### File List

**New files:**
- `ap/src/external/bitget/rate_limited.rs` — RateLimitedBitgetClient implementing APClient trait
- `ap/tests/bitget_wire_integration.rs` — Integration tests for APClient wiring (6 tests, all `#[ignore]`)

**Modified files:**
- `ap/src/external/bitget/client.rs` — Added `get_order_detail()`, `get_order_fills()`, type conversion utilities
- `ap/src/external/bitget/types.rs` — Added `OrderDetailData`, `OrderDetailResponse`, `FillData`, `FillsResponse`
- `ap/src/external/bitget/mod.rs` — Added `rate_limited` module, updated exports
- `ap/src/config.rs` — Added `bitget_testnet` field, env vars, effective method, 7 new tests
- `ap/src/main.rs` — Wired APClient (mock/live), pipeline components (TimeoutHandler, LimitOrderEnforcer), CLI flags
- `ap/src/lib.rs` — Added `RateLimitedBitgetClient` to public exports

### Change Log

| Change | File | Reason |
|--------|------|--------|
| APClient impl via rate-limited wrapper | rate_limited.rs | AC#1: Replace mock with real BitgetClient |
| Type conversion utilities | client.rs | AC#1: U256↔Decimal bridge for EVM/CEX |
| Response types for order/fill queries | types.rs | AC#1: Deserialize Bitget API responses |
| Testnet/mainnet config | config.rs, main.rs | AC#3, AC#7: Safety default testnet |
| Live client wiring | main.rs | AC#1, AC#2: Credential validation, client construction |
| Pipeline wiring | main.rs | AC#1, AC#6: TimeoutHandler + LimitEnforcer + fill verification |
| Integration tests | bitget_wire_integration.rs | AC#5: End-to-end testnet validation |
| Config unit tests | config.rs | AC#3, AC#7: Testnet flag parsing |
| [Review] Order ID mapping for reverse lookup | rate_limited.rs | H2: Non-numeric Bitget IDs could not be resolved back |
| [Review] Fix env var BITGET_PASSPHRASE -> BITGET_API_PASSPHRASE | bitget_wire_integration.rs | H3: Integration tests used wrong env var name |
| [Review] Fill polling with exponential backoff | main.rs | M1+M3: Replace fixed 2s sleep with retry loop |
| [Review] Use real trade data in LimitOrder | main.rs | M4: Pass trade.pair_id and block_number instead of zeros |
