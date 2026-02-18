# Story 4.6: Limit Order Enforcer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AP (Authorized Participant)**,
I want **to enforce limit prices on all orders before and after execution**,
So that **users always receive price protection and violations are detected for AP accountability**.

## Acceptance Criteria

1. **Given** a fill with an order, **When** I call `validate_fill(order, fill_price)`, **Then** it returns pass if fill respects limit price (for BUY: fillPrice ≤ limitPrice, for SELL: fillPrice ≥ limitPrice)
2. **Given** a fill that violates the limit price, **When** I call `validate_fill(order, fill_price)`, **Then** it returns fail and logs the violation with full details
3. **Given** the limit tolerance is 0.1%, **When** fillPrice is within tolerance of limitPrice, **Then** validation passes (e.g., limit 100, fill 100.09 for BUY passes)
4. **Given** violations are logged, **When** I call `get_violation_count(time_window)`, **Then** it returns the count of violations within the specified time window
5. **Given** 3 or more violations in a 24-hour window, **Then** an alert is triggered (logged at WARN level with specific alert flag)
6. **Given** implementation complete, **Then** unit tests verify validation logic with edge cases (exact limit, tolerance boundary, both sides)

## Tasks / Subtasks

- [x] Task 1: Create LimitOrderEnforcer module and types (AC: #1, #2, #3)
  - [x] Create `ap/src/limit_enforcer.rs` module
  - [x] Define `ValidationResult` enum: `Pass`, `Fail { reason: String }`
  - [x] Define `LimitViolation` struct with: order_id, expected_limit, actual_fill_price, side, timestamp, deviation_pct
  - [x] Define tolerance constant: `LIMIT_TOLERANCE_BPS: u64 = 10` (0.1% = 10 basis points)
  - [x] Implement `LimitOrderEnforcer` struct with violation tracking

- [x] Task 2: Implement core validation logic (AC: #1, #2, #3)
  - [x] Implement `validate_fill(order: &LimitOrder, fill_price: U256) -> ValidationResult`
  - [x] For BUY orders: `fill_price <= limit_price * (1 + tolerance)`
  - [x] For SELL orders: `fill_price >= limit_price * (1 - tolerance)`
  - [x] Calculate deviation percentage for logging: `(fill_price - limit_price) / limit_price * 100`
  - [x] Use fixed-point math with U256 to avoid overflow (multiply before divide)
  - [x] Return detailed failure reason including order_id, prices, and deviation

- [x] Task 3: Implement violation tracking and alerting (AC: #4, #5)
  - [x] Add `violations: Vec<LimitViolation>` field to LimitOrderEnforcer
  - [x] Implement `record_violation(violation: LimitViolation)` method
  - [x] Log violations at ERROR level with structured fields
  - [x] Implement `get_violation_count(time_window: Duration) -> usize`
  - [x] Filter violations by timestamp within window
  - [x] Implement `check_alert_threshold() -> bool` (returns true if ≥3 violations in 24h)
  - [x] On threshold breach: log at WARN level with `alert=true` structured field
  - [x] Expose `get_recent_violations(count: usize) -> Vec<LimitViolation>` for diagnostics

- [x] Task 4: Implement metrics exposure (AC: #4)
  - [x] Add `total_validations: u64` counter
  - [x] Add `total_violations: u64` counter
  - [x] Add `violations_24h: u64` counter (rolling window)
  - [x] Implement `get_metrics() -> LimitEnforcerMetrics` struct
  - [x] Metrics struct includes: total_validations, total_violations, violations_24h, last_violation_time

- [x] Task 5: Write comprehensive unit tests (AC: #6)
  - [x] Test: BUY order fill at exactly limit price → PASS
  - [x] Test: BUY order fill below limit price → PASS
  - [x] Test: BUY order fill above limit price (outside tolerance) → FAIL
  - [x] Test: BUY order fill slightly above limit (within 0.1% tolerance) → PASS
  - [x] Test: BUY order fill at exactly tolerance boundary → PASS
  - [x] Test: BUY order fill just beyond tolerance boundary → FAIL
  - [x] Test: SELL order fill at exactly limit price → PASS
  - [x] Test: SELL order fill above limit price → PASS
  - [x] Test: SELL order fill below limit price (outside tolerance) → FAIL
  - [x] Test: SELL order fill slightly below limit (within 0.1% tolerance) → PASS
  - [x] Test: Violation count returns correct count for time window
  - [x] Test: Alert threshold triggers at 3 violations in 24h
  - [x] Test: Violations outside 24h window don't trigger alert
  - [x] Test: Edge case with zero limit price (should fail gracefully)
  - [x] Test: Edge case with max U256 values (overflow protection)

- [x] Task 6: Integration with AP main module
  - [x] Export `LimitOrderEnforcer` from `ap/src/lib.rs`
  - [x] Add `limit_enforcer` field to AP state (when order queue integration happens)
  - [x] Document integration point: call `validate_fill()` after receiving fill from Bitget
  - [x] Document integration point: check `check_alert_threshold()` on each validation

## Dev Notes

### Critical Architecture Constraints

**Principle:** Limit orders protect users. AP cannot fill at worse price. No slashing - suspension only.

From architecture.md Section 16 (AP Accountability):
```
┌─────────────────────────────────────────────────────────────────────────┐
│          AP ACCOUNTABILITY: LIMIT ORDER ENFORCEMENT                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   FLOW:                                                                  │
│   1. Issuers emit LimitOrderRequest(pairId, side, amount, limitPrice)   │
│   2. AP MUST place limit order on Bitget at limitPrice                  │
│   3. If market doesn't reach limitPrice → Order doesn't fill            │
│   4. Issuers verify via Bitget read-only API:                           │
│      - Order was placed at correct limitPrice                           │
│      - Fill price ≤ limitPrice (for buys)                               │
│      - Fill price ≥ limitPrice (for sells)                              │
│                                                                          │
│   VIOLATION DETECTION:                                                   │
│   ────────────────────                                                   │
│   IF AP places market order OR wrong price:                             │
│   - Issuers detect mismatch via Bitget read-only API                    │
│   - Flag AP, log incident with timestamp                                │
│   - After 3 violations in 24h → Vote to suspend AP (11/20 BLS)         │
│   - Suspended AP cannot submit fills until admin review                 │
│                                                                          │
│   VERIFICATION CHECKS (every fill):                                     │
│   ─────────────────────────────────                                     │
│   1. Order exists on Bitget at expected price                           │
│   2. Fill timestamp within expected window                              │
│   3. Fill amount matches or explains partial                            │
│   4. Fill price respects limit (not worse)                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Limit Price Validation Rules

From architecture.md Section 6 (Order System):

```
For BUY orders:
  limitPrice = currentPrice × (1 + slippageLimit)
  User accepts paying UP TO this price
  → Fill valid if: fillPrice <= limitPrice

For SELL orders:
  limitPrice = currentPrice × (1 - slippageLimit)
  User accepts receiving AT LEAST this price
  → Fill valid if: fillPrice >= limitPrice
```

**Limit Tolerance:** 0.1% (per architecture.md order policies table)
- This allows for minor rounding differences in CEX execution
- Tolerance is applied to the limit price, not the fill price

### Fixed-Point Math for U256

All prices use 18 decimals. For tolerance calculation:

```rust
// 0.1% tolerance = 10 basis points = 10/10000 = 1/1000
const TOLERANCE_BPS: U256 = U256::from(10);  // 10 basis points
const BPS_DENOMINATOR: U256 = U256::from(10_000);

// For BUY: fill_price <= limit_price * (1 + tolerance)
// Equivalent: fill_price * 10000 <= limit_price * 10010
fn is_buy_valid(fill_price: U256, limit_price: U256) -> bool {
    // Multiply first to avoid precision loss
    let fill_scaled = fill_price * BPS_DENOMINATOR;
    let limit_with_tolerance = limit_price * (BPS_DENOMINATOR + TOLERANCE_BPS);
    fill_scaled <= limit_with_tolerance
}

// For SELL: fill_price >= limit_price * (1 - tolerance)
// Equivalent: fill_price * 10000 >= limit_price * 9990
fn is_sell_valid(fill_price: U256, limit_price: U256) -> bool {
    let fill_scaled = fill_price * BPS_DENOMINATOR;
    let limit_with_tolerance = limit_price * (BPS_DENOMINATOR - TOLERANCE_BPS);
    fill_scaled >= limit_with_tolerance
}
```

### Existing Types (from common crate)

**LimitOrder (common/src/types/order.rs):**
```rust
pub struct LimitOrder {
    pub id: U256,
    pub user: Address,
    pub pair_id: H256,
    pub side: Side,           // BUY or SELL
    pub amount: U256,
    pub limit_price: U256,    // Worst acceptable price (18 decimals)
    pub slippage_tier: U256,
    pub deadline: U256,
    pub itp_id: H256,
    pub timestamp: U256,
    pub status: OrderStatus,
}

pub enum Side {
    Buy = 0,
    Sell = 1,
}
```

**Fill (common/src/types/fill.rs):**
```rust
pub struct Fill {
    pub order_id: U256,
    pub fill_price: U256,     // Actual execution price (18 decimals)
    pub fill_amount: U256,
    pub cycle_number: U256,
    pub tx_hash: TxHash,
}
```

### Error Handling

Use the existing error infrastructure. Limit violations are NOT protocol errors (E001-E010) - they are AP accountability issues tracked separately.

Define AP-specific errors in `ap/src/error.rs`:
```rust
#[derive(Debug, Clone, Error)]
pub enum LimitEnforcerError {
    #[error("Limit price violation: order={order_id}, limit={limit_price}, fill={fill_price}, side={side:?}")]
    LimitViolation {
        order_id: U256,
        limit_price: U256,
        fill_price: U256,
        side: Side,
    },
}
```

### Logging Requirements

From architecture.md Section 21 (Log Specification):
- JSON format required
- Required fields: timestamp, level, message
- Use structured fields for order_id, prices, etc.

```rust
// Violation log (ERROR level)
error!(
    order_id = %order.id,
    limit_price = %order.limit_price,
    fill_price = %fill_price,
    side = ?order.side,
    deviation_pct = %.4f,
    "Limit price violation detected"
);

// Alert log (WARN level with alert flag)
warn!(
    alert = true,
    violations_24h = violation_count,
    threshold = 3,
    "AP limit violation threshold breached"
);
```

### Project Structure Notes

Files to create/modify:
```
ap/
├── src/
│   ├── main.rs           # No changes needed for this story
│   ├── lib.rs            # Export limit_enforcer module
│   ├── limit_enforcer.rs # NEW: Core validation logic
│   └── error.rs          # NEW or UPDATE: Add LimitEnforcerError
└── Cargo.toml            # May need chrono for timestamp handling
```

### Dependencies to Consider

The AP crate already has access to:
- `common` crate (types, errors)
- `ethers` (U256, H256)
- `tracing` (logging)
- `chrono` (timestamps)
- `tokio` (async runtime)

May need to add:
- `std::time::{Duration, Instant}` for violation window tracking

### Testing Standards

- Unit tests in `ap/src/limit_enforcer.rs` using `#[cfg(test)]` module
- Use `common::types::{LimitOrder, Side}` for test fixtures
- Test both happy path and failure cases
- Test edge cases: exact boundaries, max values, zero values
- Test time-based violation counting

### Alignment with Previous Stories

This story depends on types from Epic 1:
- `common::types::order::LimitOrder` (Story 1.3)
- `common::types::order::Side` (Story 1.3)
- `common::types::fill::Fill` (Story 1.3)

This story will integrate with:
- Story 4.2 (Event Monitor) - receives orders to validate
- Story 4.3 (Order Queue Manager) - orders queued before validation
- Story 4.4 (Fill Reporter) - fills are validated before reporting
- Story 4.8 (Mock Bitget Client) - simulated fills for testing

### References

- [Source: architecture.md#16-security--recovery] - AP Accountability section
- [Source: architecture.md#6-order-system] - Limit price rules and tolerance
- [Source: architecture.md#order-policies] - 0.1% tolerance specification
- [Source: common/src/types/order.rs] - LimitOrder struct
- [Source: common/src/types/fill.rs] - Fill struct
- [Source: common/src/errors.rs] - Error code patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required.

### Completion Notes List

- Implemented `LimitOrderEnforcer` struct with full validation logic
- Validation uses fixed-point math (U256) to avoid overflow: `fill_scaled <= limit_with_tolerance`
- BUY validation: `fill_price * 10000 <= limit_price * 10010` (0.1% tolerance)
- SELL validation: `fill_price * 10000 >= limit_price * 9990` (0.1% tolerance)
- Violation tracking with `Vec<LimitViolation>` stores all violations
- `get_violation_count(Duration)` filters violations within time window
- `check_alert_threshold()` returns true when ≥3 violations in 24h
- Alert logging uses `warn!(alert = true, ...)` structured field per architecture spec
- `LimitEnforcerMetrics` provides: total_validations, total_violations, violations_24h, last_violation_time
- 17 unit tests covering edge cases (including SELL boundary tests)
- Exported from `ap/src/lib.rs` for integration

### File List

- `ap/src/limit_enforcer.rs` - NEW: Core limit order enforcement module
- `ap/src/lib.rs` - MODIFIED: Added limit_enforcer module and exports
- `ap/src/timeout/handler.rs` - MODIFIED: Fixed TokioInstant import issue (unrelated pre-existing bug)

## Change Log

- 2026-01-29: Implemented Story 4.6 - Limit Order Enforcer with full validation logic, violation tracking, alerting, metrics, and comprehensive tests
- 2026-01-30: Code review fixes applied (H1-H3, M1-M4, L3): safe U256 deviation calc, private record_violation, auto-cleanup, checked_mul overflow handling, consistent API, SELL boundary tests added

