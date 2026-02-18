# Story 3.7: Netting Engine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **to net orders for efficient execution**,
So that **trading volume and costs are minimized**.

## Acceptance Criteria

1. **Given** a batch of orders from the Order Batcher (Story 3.6)
   **When** I call `pair_netting(orders)`
   **Then** same-pair orders are merged (buy $10k - sell $3k = net buy $7k)
   **And** a `MergedOrder` is returned with the net amount and source orders tracked

2. **Given** bridge transfer requests in opposite directions
   **When** I call `bridge_netting(transfers)`
   **Then** opposite-direction bridges are netted (L3→Arb $50k, Arb→L3 $30k = net L3→Arb $20k)
   **And** bridge volume is reduced by 50-80%

3. **Given** USDC and USDT order flows
   **When** I call `usdt_netting(orders)`
   **Then** USDC↔USDT swap flows are netted (only swap the net difference)
   **And** the depeg circuit breaker disables netting if |1-rate| > 0.5%

4. **Given** the netting state
   **When** I check the depeg status
   **Then** USDT netting is disabled if USDC/USDT depeg > 0.5%
   **And** USDT netting resumes when |1-rate| < 0.3% for 1 hour
   **And** a "DEPEG_DETECTED" alert is emitted when disabled

5. **Given** execution costs from bridges and gas
   **When** I call `fee_allocation(batch, fees)`
   **Then** fees are distributed proportionally to order size
   **And** each user pays their share: user_fee = total_fee × (order_amount / total_batch_amount)

6. **Given** merged orders with multiple source orders
   **When** I query the MergedOrder
   **Then** source_orders are tracked for later fill allocation
   **And** weighted average slippage is calculated from source orders

7. **Given** the Netting Engine implementation
   **When** running unit tests
   **Then** all netting logic is covered
   **And** tests verify volume reduction correctness
   **And** tests verify fee allocation is proportional

## Tasks / Subtasks

- [x] Task 1: Create NettingEngine struct and module (AC: #1, #6)
  - [x] Create `issuer/src/netting/mod.rs` module
  - [x] Define `NettingEngine` struct
  - [x] Define `MergedOrder` struct with fields:
    - `pair_id: H256`
    - `side: Side` (determined by net amount sign)
    - `net_amount: U256` (absolute value of buy - sell)
    - `source_orders: Vec<LimitOrder>` (for fill allocation)
    - `total_slippage_weight: U256` (for weighted avg calculation)
    - `total_amount: U256` (sum of absolute amounts)
  - [x] Implement `MergedOrder::weighted_avg_slippage()` method

- [x] Task 2: Implement `pair_netting()` (AC: #1, #6)
  - [x] Create `pair_netting(orders: Vec<LimitOrder>) -> HashMap<H256, MergedOrder>`
  - [x] Group orders by `pair_id`
  - [x] For each pair, sum buys (positive) and subtract sells (negative)
  - [x] Determine final side based on net_amount sign (positive=Buy, negative=Sell)
  - [x] Store absolute value as net_amount
  - [x] Track all source orders for later allocation
  - [x] Calculate weighted slippage: Σ(amount × slippage_tier) / Σ(amount)

- [x] Task 3: Implement `bridge_netting()` (AC: #2)
  - [x] Define `BridgeRequest` struct: `source_chain: U256, dest_chain: U256, amount: U256`
  - [x] Define `NettedBridgeTransfers` result struct
  - [x] Create `bridge_netting(requests: Vec<BridgeRequest>) -> NettedBridgeTransfers`
  - [x] Group by chain pair (source, dest)
  - [x] For each chain pair, find opposite direction transfers
  - [x] Net amounts: only bridge the difference
  - [x] Track which direction (if any) needs actual bridge
  - [x] Return both the netted transfers and the internal matches

- [x] Task 4: Implement USDT netting with depeg circuit breaker (AC: #3, #4)
  - [x] Define `DepegState` struct: `is_depegged: bool, depegged_since: Option<Instant>, rate: f64`
  - [x] Create `usdt_netting(orders: Vec<LimitOrder>, usdc_usdt_rate: f64) -> UsdtNettingResult`
  - [x] Classify orders by quote currency (USDC vs USDT pairs)
  - [x] Calculate net USDC flow: Σ(buys) - Σ(sells)
  - [x] Calculate net USDT flow: Σ(buys) - Σ(sells)
  - [x] Return only the net swap amount needed
  - [x] Implement `check_depeg(rate: f64) -> bool` (returns true if |1-rate| > 0.005)
  - [x] Implement `should_resume_netting(rate: f64, depegged_since: Instant) -> bool` (|1-rate| < 0.003 for 1 hour)
  - [x] When depegged: disable netting, return all swaps at market rate
  - [x] Emit/log "DEPEG_DETECTED" alert when transitioning to depegged state

- [x] Task 5: Implement `fee_allocation()` (AC: #5)
  - [x] Define `FeeAllocation` struct: `order_id: U256, fee: U256, fee_type: FeeType`
  - [x] Define `FeeType` enum: `Bridge, Gas, Combined`
  - [x] Create `fee_allocation(batch: &[LimitOrder], total_fee: U256) -> Vec<FeeAllocation>`
  - [x] Calculate total batch amount: Σ(order.amount)
  - [x] For each order: fee = total_fee × (order.amount / total_batch_amount)
  - [x] Handle rounding: give remainder to largest order
  - [x] Return allocation for each order

- [x] Task 6: Implement unified netting pipeline (AC: #1-#5)
  - [x] Create `NettingResult` struct containing all netting outputs
  - [x] Create `run_netting_pipeline(orders: Vec<LimitOrder>, bridges: Vec<BridgeRequest>, usdc_usdt_rate: f64) -> NettingResult`
  - [x] Step 1: Pair netting (merge same-pair orders)
  - [x] Step 2: Bridge netting (net opposite-direction bridges)
  - [x] Step 3: USDT netting (net stablecoin swaps, respecting depeg)
  - [x] Step 4: Fee allocation (distribute costs proportionally)
  - [x] Return combined result for downstream processing

- [x] Task 7: Write unit tests (AC: #7)
  - [x] Test `pair_netting()`:
    - Test buys only → positive net
    - Test sells only → negative net
    - Test buys and sells → correct net and side
    - Test multiple pairs → correct grouping
    - Test weighted slippage calculation
  - [x] Test `bridge_netting()`:
    - Test same-direction bridges → no netting
    - Test opposite-direction bridges → correct netting
    - Test partial netting (unequal amounts)
  - [x] Test `usdt_netting()`:
    - Test normal operation (netting works)
    - Test depeg detected (netting disabled)
    - Test depeg recovery (netting resumes after 1 hour)
  - [x] Test `fee_allocation()`:
    - Test proportional distribution
    - Test rounding behavior
    - Test single order (gets full fee)
    - Test equal orders (equal split)

## Dev Notes

### Architecture Context

The Netting Engine is part of the **Issuer Cycle** (1-second cycles). It runs during **Phase 2** after the Order Batcher collects validated orders:

```
CYCLE N:
├─ PHASE 1: Process Previous Fills (from Cycle N-1)
├─ PHASE 2: Unified Netting Engine ← THIS STORY
│   ├─ STEP 1: Pair Netting - merge same-pair orders
│   ├─ STEP 2: Fill Priority - check liquidity at 25/50/75/100% (Story 3.8)
│   ├─ STEP 3: Slippage Filter - exclude orders above tier (Story 3.8)
│   ├─ STEP 4: Chain Grouping - batch by destination chain
│   ├─ STEP 5: Bridge Netting - net opposite-direction bridges
│   ├─ STEP 6: USDT Netting - net USDC↔USDT swaps
│   └─ STEP 7: Fee Allocation - distribute costs proportionally
├─ PHASE 3: Inventory Check
└─ PHASE 4: Generate Execution Batch
```

[Source: architecture.md#7-issuer-cycle-1-second]
[Source: architecture.md#8-unified-netting-engine]

### Netting Types Summary

| # | Netting Type | What It Nets | Savings |
|---|--------------|--------------|---------|
| 1 | Pair Netting | Same-pair buys vs sells across ITPs | Fewer orders |
| 2 | Bridge Netting | Opposite-direction bridges | 50-80% fewer bridges |
| 3 | USDT Netting | USDT buys vs USDT sells | 50%+ fewer stablecoin swaps |
| 4 | Chain Netting | Orders to same chain batched | Gas savings |
| 5 | Fee Netting | Bridge fees shared across users | Fair distribution |

[Source: architecture.md#netting-types-summary]

### Key Integration Points

1. **Order Batcher (Story 3.6)**:
   - Receives `HashMap<H256, Vec<LimitOrder>>` grouped by ITP
   - This story flattens and re-groups by pair_id

2. **Slippage Filter (Story 3.8)**:
   - Netting Engine outputs `MergedOrder` with weighted_avg_slippage
   - Slippage Filter uses this to determine fill percentage

3. **Fill Allocation (Story 3.8)**:
   - Uses `source_orders` from MergedOrder to distribute fills back

4. **Price Fetching (Story 3.13)**:
   - Provides USDC/USDT rate for depeg circuit breaker

### Pair Netting Algorithm (Rust Reference)

```rust
fn merge_by_pair(orders: Vec<LimitOrder>) -> HashMap<PairId, MergedOrder> {
    let mut merged = HashMap::new();

    for order in orders {
        let entry = merged.entry(order.pair_id).or_insert(MergedOrder::default());

        // Net buys and sells
        if order.side == Buy {
            entry.net_amount += order.amount;
        } else {
            entry.net_amount -= order.amount;
        }

        // Track source orders for allocation
        entry.source_orders.push(order);

        // Weighted average slippage
        entry.total_slippage_weight += order.amount * order.slippage_limit;
        entry.total_amount += order.amount;
    }

    // Determine final side based on net
    for (_, merged) in merged.iter_mut() {
        merged.side = if merged.net_amount >= 0 { Buy } else { Sell };
        merged.net_amount = merged.net_amount.abs();
    }

    merged
}
```

[Source: architecture.md#netting-algorithm-rust]

### USDT Depeg Circuit Breaker

```
DEPEG CIRCUIT BREAKER:
───────────────────────
Monitor USDC/USDT rate (via 1inch quote)
If |1 - rate| > 0.5%:
  - DISABLE netting
  - Execute all USDT swaps at market rate
  - Alert: "DEPEG_DETECTED"
Resume when |1 - rate| < 0.3% for 1 hour
```

[Source: architecture.md#usdt-netting-with-depeg-circuit-breaker]

### Fee Allocation Formula

```
user_fee = total_fee × (user_order_amount / total_batch_amount)

Example:
- User A order: $1000 (20%) → pays 20% of bridge fee
- User B order: $3000 (60%) → pays 60% of bridge fee
- User C order: $1000 (20%) → pays 20% of bridge fee
```

Mini order protection: If fee > 2% of order amount, warn user before execution.

[Source: architecture.md#fee-sharing-stateless-compatible]

### Netting Example (Pair Netting)

```
Two users in same cycle:
- User A: BUY $10k "BTC Max" ITP (100% BTC)
- User B: SELL $3k "Crypto Blend" ITP (40% BTC = $1.2k BTC)

Result:
- Bitget.BTCUSDC: $10k - $1.2k = NET $8.8k BTC buy
- Internal match: $1.2k BTC transfers from User B to User A

Savings:
- Without netting: $10k buy + $1.2k sell = $11.2k volume
- With netting: $8.8k buy only = 21% reduction
```

[Source: architecture.md#example-3-netting-across-itps]

### Project Structure Notes

Create new module at:
```
issuer/
├── src/
│   ├── lib.rs           # Add `pub mod netting;`
│   ├── main.rs
│   └── netting/
│       ├── mod.rs       # NettingEngine struct and impl
│       ├── pair.rs      # pair_netting() implementation
│       ├── bridge.rs    # bridge_netting() implementation
│       ├── usdt.rs      # usdt_netting() with depeg logic
│       ├── fees.rs      # fee_allocation() implementation
│       └── tests.rs     # Unit tests (cfg(test) module)
```

### Technical Requirements

- **Language**: Rust
- **Async**: Not required for netting (pure computation), but struct should be `Send + Sync`
- **Error Handling**: Use `common::error::Error` type
- **Types**: Use types from `common::types` crate
  - `LimitOrder` from `common/src/types/order.rs`
  - `Side`, `OrderStatus` from same
  - `H256`, `U256` from `ethers::types`
- **Logging**: Use `tracing` crate for structured JSON logs
- **Precision**: All amounts use U256 with 18 decimals

### Existing Types to Use

From `common/src/types/order.rs`:
```rust
pub struct LimitOrder {
    pub id: U256,
    pub user: Address,
    pub pair_id: H256,
    pub side: Side,
    pub amount: U256,
    pub limit_price: U256,
    pub slippage_tier: U256,  // 0, 1, or 2
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

### New Types to Define

```rust
/// Result of pair netting - merged order for a single pair
pub struct MergedOrder {
    pub pair_id: H256,
    pub side: Side,
    pub net_amount: U256,
    pub source_orders: Vec<LimitOrder>,
    pub total_slippage_weight: U256,
    pub total_amount: U256,
}

impl MergedOrder {
    pub fn weighted_avg_slippage(&self) -> U256 {
        if self.total_amount.is_zero() {
            return U256::zero();
        }
        self.total_slippage_weight / self.total_amount
    }
}

/// Request for bridge between chains
pub struct BridgeRequest {
    pub source_chain: U256,
    pub dest_chain: U256,
    pub amount: U256,
}

/// Result of bridge netting
pub struct NettedBridgeTransfers {
    /// Actual bridges needed after netting
    pub bridges: Vec<BridgeRequest>,
    /// Internal matches (no bridge needed)
    pub internal_matches: Vec<(BridgeRequest, BridgeRequest)>,
}

/// Fee allocation for a single order
pub struct FeeAllocation {
    pub order_id: U256,
    pub fee: U256,
    pub fee_type: FeeType,
}

pub enum FeeType {
    Bridge,
    Gas,
    Combined,
}

/// State tracking for USDT depeg
pub struct DepegState {
    pub is_depegged: bool,
    pub depegged_since: Option<std::time::Instant>,
    pub last_rate: f64,
}
```

### Slippage Tier Values

| Tier | Max Slippage | Use Case |
|------|--------------|----------|
| 0 | ≤0.3% | Strict - stablecoins, large orders |
| 1 | ≤1.0% | Normal - most trades |
| 2 | ≤3.0% | Relaxed - volatile/illiquid assets |

### Testing Approach

1. **Pure functions**: All netting logic is stateless, easy to unit test
2. **No mocks needed**: Just create test orders and verify outputs
3. **Edge cases to cover**:
   - Empty input
   - Single order (no netting possible)
   - All buys / all sells
   - Equal opposite orders (net to zero)
   - Depeg threshold exactly at boundary

Example test:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{LimitOrder, Side};
    use ethers::types::{H256, U256};

    #[test]
    fn test_pair_netting_buy_sell_same_pair() {
        let buy = create_test_order(Side::Buy, U256::from(10_000));
        let sell = create_test_order(Side::Sell, U256::from(3_000));

        let result = pair_netting(vec![buy, sell]);

        assert_eq!(result.len(), 1);
        let merged = result.values().next().unwrap();
        assert_eq!(merged.side, Side::Buy);
        assert_eq!(merged.net_amount, U256::from(7_000));
        assert_eq!(merged.source_orders.len(), 2);
    }
}
```

### Previous Story Intelligence

From **Story 3.6: Order Batcher** (ready-for-dev):
- Order Batcher outputs `BatchResult { valid_orders: HashMap<H256, Vec<LimitOrder>>, expired_orders, cycle_number }`
- Orders are grouped by ITP, but netting needs regrouping by pair_id
- Validation already done - all orders passed to netting are valid (not expired, not paused)
- Expiry handling separate - don't need to check deadlines in netting

[Source: 3-6-order-batcher.md]

### Downstream Dependencies

- **Story 3.8 (Slippage Filter)**: Consumes `MergedOrder` output
- **Story 3.12 (Consensus Flow)**: Signs netting results
- **Story 3.17 (Rebalance Netting)**: Extends this engine for rebalance orders

### References

- [Source: architecture.md#8-unified-netting-engine] - Complete netting specification
- [Source: architecture.md#7-issuer-cycle-1-second] - Cycle phases
- [Source: architecture.md#netting-algorithm-rust] - Reference implementation
- [Source: architecture.md#usdt-netting-with-depeg-circuit-breaker] - Depeg logic
- [Source: architecture.md#fee-sharing-stateless-compatible] - Fee allocation
- [Source: architecture.md#example-3-netting-across-itps] - Netting example
- [Source: epics.md#story-37-netting-engine] - Story definition
- [Source: common/src/types/order.rs] - LimitOrder struct
- [Source: common/src/error.rs] - Error types
- [Source: 3-6-order-batcher.md] - Previous story context

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered during implementation.

### Completion Notes List

- Implemented complete Netting Engine module with 5 submodules (mod.rs, types.rs, pair.rs, bridge.rs, usdt.rs, fees.rs, tests.rs)
- All 7 acceptance criteria satisfied:
  - AC #1, #6: Pair netting with MergedOrder tracking source orders and weighted avg slippage
  - AC #2: Bridge netting with 50-80% volume reduction capability (verified via volume_reduction() method)
  - AC #3, #4: USDT netting with depeg circuit breaker (>0.5% disables, <0.3% for 1hr resumes)
  - AC #5: Proportional fee allocation with rounding remainder to largest order
  - AC #7: 53 unit tests covering all netting logic, edge cases, and integration scenarios
- Used I256 from ethers for signed arithmetic during pair netting (buys positive, sells negative)
- USDT pair classification uses first byte of pair_id (>=0x80 = USDT) - production would use pair registry
- `exceeds_fee_threshold()` helper added for mini-order protection (fee > 2% warning)
- All netting functions are pure/stateless except DepegState which tracks depeg duration
- Pre-existing test failure in slippage module (test_tier_filtering_at_boundary) unrelated to this implementation

### File List

**New Files:**
- issuer/src/netting/mod.rs - NettingEngine struct, run_netting_pipeline(), module exports
- issuer/src/netting/types.rs - MergedOrder struct with weighted_avg_slippage()
- issuer/src/netting/pair.rs - pair_netting() implementation
- issuer/src/netting/bridge.rs - bridge_netting(), BridgeRequest, NettedBridgeTransfers
- issuer/src/netting/usdt.rs - usdt_netting(), DepegState, UsdtNettingResult, StablecoinSwap
- issuer/src/netting/fees.rs - fee_allocation(), FeeAllocation, FeeType
- issuer/src/netting/tests.rs - Integration tests (53 total unit tests across all modules)

**Modified Files:**
- issuer/src/lib.rs - Added `pub mod netting;` and exports for all netting types

### Change Log

- 2026-01-29: Implemented complete Netting Engine (Story 3.7) - all 7 tasks completed with 53 passing tests
- 2026-01-30: Code review fixes applied:
  - Removed unnecessary orders.clone() in run_netting_pipeline()
  - Integrated fee_allocation() into the netting pipeline
  - Added I256 overflow protection for massive order amounts
  - Changed USDT netting from i128 to I256 to handle full U256 range
  - Added order ID tracking to BridgeRequest for traceability
  - Added documentation for USDT pair detection placeholder and cross-cycle depeg state
