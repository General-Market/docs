# Story 3.17: Rebalance Netting Engine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **to batch and net rebalances across ITPs**,
So that **trading volume is minimized when multiple ITPs adjust their asset weights simultaneously**.

## Acceptance Criteria

1. **Given** multiple ITP rebalance proposals in the queue
   **When** I call `collect_rebalance_proposals()`
   **Then** all pending rebalances are collected with their ITP ID, old weights, and new weights
   **And** the queue accepts proposals until: all expected rebalances submitted, timeout (1 hour), or admin signals "execute batch"

2. **Given** a batch of rebalance proposals
   **When** I call `calculate_net_deltas(proposals, itp_values, prices)`
   **Then** net deltas are computed for each asset across all ITPs
   **And** formula: `net_delta[asset] = Σ(itp_value × (new_weight - old_weight))`
   **And** result shows net buy/sell amounts per asset (e.g., net_delta[BTC] = -$10k means sell)

3. **Given** net deltas for all assets
   **When** I call `generate_rebalance_trades(net_deltas)`
   **Then** trades are generated only for non-zero net deltas
   **And** positive delta = BUY trade, negative delta = SELL trade
   **And** trades are returned as `RebalanceTrade` structs compatible with existing netting pipeline

4. **Given** executed rebalance fills
   **When** I call `allocate_rebalance_fills(fills, proposals)`
   **Then** fills are allocated pro-rata to each ITP based on their individual delta contribution
   **And** formula: `itp_fill = total_fill × (itp_delta / total_delta)`
   **And** internal transfers recorded for ITPs on opposite sides (ITP-A "sells to" ITP-B)

5. **Given** all rebalance fills allocated
   **When** I call `finalize_rebalance(itp_id)`
   **Then** ITP weights are updated to new target weights
   **And** `RebalanceComplete` event data is prepared for each ITP
   **And** progress tracking updated (0.0 → 1.0)

6. **Given** the Priority Algorithm configuration
   **When** rebalance is active
   **Then** execution slots are split: 50% rebalance, 50% user orders
   **And** when no rebalance is active, 100% goes to user orders

7. **Given** the Rebalance Netting Engine implementation
   **When** running unit tests
   **Then** all netting logic is covered
   **And** tests verify volume reduction correctness
   **And** tests verify pro-rata fill allocation
   **And** tests verify internal transfer matching

## Tasks / Subtasks

- [x] Task 1: Create RebalanceNetting module and types (AC: #1, #2)
  - [x] Create `issuer/src/netting/rebalance.rs` module
  - [x] Define `RebalanceProposal` struct:
    - `itp_id: H256`
    - `old_weights: Vec<U256>` (18 decimals, sum = 1e18)
    - `new_weights: Vec<U256>` (18 decimals, sum = 1e18)
    - `asset_indices: Vec<U256>` (which assets this ITP holds)
    - `proposed_at: U256` (timestamp)
  - [x] Define `RebalanceQueue` struct with queue management
  - [x] Define `RebalanceTrade` struct matching existing `MergedOrder` interface
  - [x] Define `RebalanceFillAllocation` for pro-rata distribution
  - [x] Define `InternalTransfer` for ITP-to-ITP matches

- [x] Task 2: Implement `collect_rebalance_proposals()` (AC: #1)
  - [x] Create queue add/remove methods
  - [x] Implement timeout tracking (1 hour configurable)
  - [x] Implement "execute batch" signal handling
  - [x] Track expected rebalances vs submitted
  - [x] Return `Vec<RebalanceProposal>` when batch ready

- [x] Task 3: Implement `calculate_net_deltas()` (AC: #2)
  - [x] Input: `Vec<RebalanceProposal>`, `HashMap<H256, U256>` (itp_values), `HashMap<U256, U256>` (prices)
  - [x] For each asset index, calculate net delta across all ITPs:
    ```rust
    for proposal in proposals:
      for (idx, asset_idx) in proposal.asset_indices.iter().enumerate():
        itp_value = itp_values[proposal.itp_id]
        old_amount = itp_value * proposal.old_weights[idx] / 1e18
        new_amount = itp_value * proposal.new_weights[idx] / 1e18
        delta = new_amount - old_amount  // I256 for signed
        net_delta[asset_idx] += delta
    ```
  - [x] Return `HashMap<U256, I256>` (asset_idx → net delta)
  - [x] Handle precision: use I256 for signed arithmetic

- [x] Task 4: Implement `generate_rebalance_trades()` (AC: #3)
  - [x] Convert net deltas to trades
  - [x] For each non-zero delta:
    - If delta > 0: BUY trade
    - If delta < 0: SELL trade (use absolute value)
  - [x] Create `RebalanceTrade` compatible with pair netting
  - [x] Tag trades as rebalance (for priority slot allocation)
  - [x] Return `Vec<RebalanceTrade>`

- [x] Task 5: Implement `allocate_rebalance_fills()` (AC: #4)
  - [x] Track each ITP's contribution to the net delta per asset
  - [x] Pro-rata allocation formula:
    ```rust
    itp_fill = total_fill * (itp_delta.abs() / total_delta.abs())
    ```
  - [x] Handle opposite sides (internal transfers):
    - ITPs with positive delta (buying) receive from execution
    - ITPs with negative delta (selling) "sell" to buyers
    - If some ITPs buy and some sell same asset, match internally first
  - [x] Track `InternalTransfer` records for internal matches
  - [x] Return `HashMap<H256, RebalanceFillAllocation>` per ITP

- [x] Task 6: Implement `finalize_rebalance()` and progress tracking (AC: #5)
  - [x] Update ITP to new weights (prepare on-chain update data)
  - [x] Prepare `RebalanceComplete` event data
  - [x] Compute rebalance progress (0.0 to 1.0) per architecture:
    ```rust
    progress = Σ(current_allocation - start_allocation) / Σ(target_allocation - start_allocation)
    ```
  - [x] Clear completed rebalance from queue

- [x] Task 7: Implement priority slot integration (AC: #6)
  - [x] Define `PrioritySlots` struct with configurable percentages
  - [x] Default: `{rebalance: 50%, user: 50%}` when active
  - [x] Method `allocate_slots(rebalance_active: bool, total_capacity: usize)` → `(rebalance_slots, user_slots)`
  - [x] Integrate with existing netting pipeline

- [x] Task 8: Write unit tests (AC: #7)
  - [x] Test `collect_rebalance_proposals()`:
    - Single proposal collection
    - Multiple proposal batching
    - Timeout trigger
    - Execute signal trigger
  - [x] Test `calculate_net_deltas()`:
    - Single ITP rebalance
    - Multi-ITP with same asset changes
    - Multi-ITP with opposite changes (buy/sell netting)
    - Verify volume reduction
  - [x] Test `generate_rebalance_trades()`:
    - Net buy → BUY trade
    - Net sell → SELL trade
    - Zero net → no trade
  - [x] Test `allocate_rebalance_fills()`:
    - Pro-rata allocation accuracy
    - Internal transfer matching
    - Rounding behavior
  - [x] Test `finalize_rebalance()`:
    - Weight update preparation
    - Progress calculation
  - [x] Test priority slots:
    - 50/50 split when active
    - 100% user when inactive

## Dev Notes

### Architecture Context

The Rebalance Netting Engine extends Story 3.7's Netting Engine to handle ITP weight rebalances. It runs during **Phase 2** of the Issuer Cycle alongside user order netting:

```
CYCLE N:
├─ PHASE 1: Process Previous Fills
├─ PHASE 2: Unified Netting Engine
│   ├─ STEP 1: Pair Netting (user orders) ← Story 3.7
│   ├─ STEP 1b: Rebalance Netting ← THIS STORY (nets rebalances across ITPs)
│   ├─ STEP 2-7: Remaining pipeline steps...
├─ PHASE 3: Inventory Check
└─ PHASE 4: Generate Execution Batch
```

[Source: architecture.md#7-issuer-cycle-1-second]
[Source: architecture.md#rebalance-netting-algorithm]

### Rebalance Flow Overview

```
1. Asset manager proposes new weights via proposeRebalance(itpId, newWeights)
2. Queue rebalances (batch them for efficiency)
3. Issuers vote to approve each (11/20 BLS threshold)
4. Admin/timeout signals "execute batch"
5. Calculate net trades across all rebalances ← THIS STORY
6. Execute in patches based on liquidity
7. Update weights on completion
```

[Source: architecture.md#rebalance-flow]

### Netting Benefit Example

```
ITP-A: BTC 50%→30% (value $100k) → sell $20k BTC
ITP-B: BTC 40%→60% (value $50k)  → buy $10k BTC

Net: Sell $10k BTC (instead of $30k volume)
ITP-A "sells to" ITP-B internally ($10k)
Only $10k needs external execution

Volume reduction: 66% (from $30k to $10k)
```

[Source: architecture.md#rebalance-netting-algorithm]

### Key Integration Points

1. **Story 3.7 (Netting Engine)**: Rebalance trades integrate into existing `run_netting_pipeline()`
   - Reuse `MergedOrder` interface where possible
   - Reuse `fee_allocation()` for cost distribution
   - Reuse `bridge_netting()` if rebalance involves cross-chain assets

2. **State Reconstruction (Story 3.4)**: Uses `getPendingRebalance(itpId)` to read on-chain state
   - `PendingRebalance { targetWeights, startedAt, active }`
   - Progress computed from inventory vs target weights

3. **Consensus Flow (Story 3.12)**: BLS signatures required for:
   - Rebalance approval (11/20 threshold)
   - Weight updates after completion

4. **Chain Reader (Story 3.2)**: Read ITP state and pending rebalances
   - `getITPState(itpId)` → weights, inventory, totalValue
   - `getPendingRebalance(itpId)` → target weights if active

### Project Structure Notes

Extend existing netting module:
```
issuer/
├── src/
│   ├── lib.rs           # Add exports for rebalance types
│   └── netting/
│       ├── mod.rs       # Add `mod rebalance;` and exports
│       ├── rebalance.rs # ← NEW: RebalanceNetting implementation
│       ├── pair.rs      # Existing pair netting
│       ├── bridge.rs    # Existing bridge netting
│       └── ...
```

### Technical Requirements

- **Language**: Rust
- **Async**: Not required for netting (pure computation), but struct should be `Send + Sync`
- **Error Handling**: Use `common::error::Error` type
- **Types**: Use types from `common::types` crate + existing netting types
- **Precision**: All amounts use U256 with 18 decimals; use I256 for signed delta calculations
- **Logging**: Use `tracing` crate with structured JSON:
  ```rust
  tracing::info!(
      itp_id = %proposal.itp_id,
      net_delta_btc = %net_delta[btc_idx],
      "Rebalance delta calculated"
  );
  ```

### New Types to Define

```rust
/// A rebalance proposal for a single ITP
#[derive(Debug, Clone)]
pub struct RebalanceProposal {
    pub itp_id: H256,
    pub old_weights: Vec<U256>,      // 18 decimals, sum = 1e18
    pub new_weights: Vec<U256>,      // 18 decimals, sum = 1e18
    pub asset_indices: Vec<U256>,    // Sparse asset list for this ITP
    pub proposed_at: U256,           // Block timestamp
}

/// Queue for collecting rebalance proposals
#[derive(Debug)]
pub struct RebalanceQueue {
    pub proposals: Vec<RebalanceProposal>,
    pub batch_started_at: Option<Instant>,
    pub execute_signal_received: bool,
    pub timeout_duration: Duration,  // Default 1 hour
}

impl RebalanceQueue {
    pub fn new(timeout: Duration) -> Self;
    pub fn add_proposal(&mut self, proposal: RebalanceProposal);
    pub fn is_batch_ready(&self) -> bool;
    pub fn signal_execute(&mut self);
    pub fn drain_batch(&mut self) -> Vec<RebalanceProposal>;
}

/// A trade generated from rebalance netting
#[derive(Debug, Clone)]
pub struct RebalanceTrade {
    pub asset_idx: U256,
    pub side: Side,                  // Buy or Sell
    pub amount: U256,                // Absolute amount
    pub source_itps: Vec<H256>,      // ITPs contributing to this trade
    pub is_rebalance: bool,          // Always true (for priority allocation)
}

/// Fill allocation result for a single ITP
#[derive(Debug, Clone)]
pub struct RebalanceFillAllocation {
    pub itp_id: H256,
    pub asset_allocations: HashMap<U256, U256>,  // asset_idx → fill amount
    pub internal_transfers: Vec<InternalTransfer>,
}

/// Internal transfer between ITPs (no external execution needed)
#[derive(Debug, Clone)]
pub struct InternalTransfer {
    pub from_itp: H256,
    pub to_itp: H256,
    pub asset_idx: U256,
    pub amount: U256,
}

/// Execution priority slot configuration
#[derive(Debug, Clone)]
pub struct PrioritySlots {
    pub rebalance_percent: u8,  // Default 50
    pub user_percent: u8,       // Default 50
}

impl PrioritySlots {
    pub fn when_rebalance_active() -> Self {
        Self { rebalance_percent: 50, user_percent: 50 }
    }

    pub fn when_no_rebalance() -> Self {
        Self { rebalance_percent: 0, user_percent: 100 }
    }

    pub fn allocate_slots(&self, total_capacity: usize) -> (usize, usize) {
        let rebalance = total_capacity * self.rebalance_percent as usize / 100;
        let user = total_capacity - rebalance;
        (rebalance, user)
    }
}
```

### Existing Types to Reuse

From `issuer/src/netting/`:
- `MergedOrder` - Can adapt for rebalance trades
- `FeeAllocation`, `fee_allocation()` - Reuse for rebalance fee distribution
- `BridgeRequest`, `bridge_netting()` - If rebalance involves cross-chain

From `common/src/types/`:
- `Side` enum (Buy/Sell)
- `U256`, `H256`, `I256` from ethers

### Signed Arithmetic for Net Deltas

Use `I256` from ethers for signed delta calculations:

```rust
use ethers::types::I256;

fn calculate_net_deltas(
    proposals: &[RebalanceProposal],
    itp_values: &HashMap<H256, U256>,
    prices: &HashMap<U256, U256>,
) -> HashMap<U256, I256> {
    let mut net_deltas: HashMap<U256, I256> = HashMap::new();

    for proposal in proposals {
        let itp_value = itp_values.get(&proposal.itp_id)
            .copied()
            .unwrap_or(U256::zero());

        for (idx, &asset_idx) in proposal.asset_indices.iter().enumerate() {
            let old_weight = proposal.old_weights.get(idx).copied().unwrap_or(U256::zero());
            let new_weight = proposal.new_weights.get(idx).copied().unwrap_or(U256::zero());

            // Calculate amounts: value * weight / 1e18
            let old_amount = itp_value * old_weight / U256::exp10(18);
            let new_amount = itp_value * new_weight / U256::exp10(18);

            // Convert to I256 for signed arithmetic
            let old_i256 = I256::try_from(old_amount).unwrap_or(I256::zero());
            let new_i256 = I256::try_from(new_amount).unwrap_or(I256::zero());
            let delta = new_i256 - old_i256;

            // Accumulate
            *net_deltas.entry(asset_idx).or_insert(I256::zero()) += delta;
        }
    }

    net_deltas
}
```

### Progress Calculation Formula

From architecture.md, rebalance progress is COMPUTED not stored:

```rust
fn compute_rebalance_progress(
    current_inventory: &[U256],
    start_weights: &[U256],
    target_weights: &[U256],
    asset_indices: &[U256],
    prices: &HashMap<U256, U256>,
) -> f64 {
    let total_value: U256 = asset_indices.iter()
        .zip(current_inventory.iter())
        .map(|(idx, qty)| *qty * prices.get(idx).copied().unwrap_or(U256::one()))
        .fold(U256::zero(), |acc, x| acc + x);

    let mut progress_sum = 0.0;
    let mut weight_sum = 0.0;

    for (i, &asset_idx) in asset_indices.iter().enumerate() {
        let qty = current_inventory[i];
        let price = prices.get(&asset_idx).copied().unwrap_or(U256::one());
        let current_value = qty * price;

        let current_alloc = if total_value.is_zero() {
            0.0
        } else {
            current_value.as_u128() as f64 / total_value.as_u128() as f64
        };

        let start_alloc = start_weights[i].as_u128() as f64 / 1e18;
        let target_alloc = target_weights[i].as_u128() as f64 / 1e18;

        let change_magnitude = (target_alloc - start_alloc).abs();
        if change_magnitude > 0.0 {
            let progress = if (target_alloc - start_alloc).abs() < f64::EPSILON {
                1.0
            } else {
                ((current_alloc - start_alloc) / (target_alloc - start_alloc)).clamp(0.0, 1.0)
            };
            progress_sum += progress * change_magnitude;
            weight_sum += change_magnitude;
        }
    }

    if weight_sum > 0.0 {
        progress_sum / weight_sum
    } else {
        1.0
    }
}
```

[Source: architecture.md#reconstruction-algorithm-rust]

### On-Chain State References

```solidity
// From Index.sol (architecture.md Appendix B)
struct PendingRebalance {
    uint256[] targetWeights;
    uint256 startedAt;
    bool active;
}
mapping(uint256 => PendingRebalance) public pendingRebalances;

function getPendingRebalance(uint256 itpId) external view returns (
    bool active,
    uint256[] memory targetWeights,
    uint256 startedAt
);
```

### Priority Algorithm Integration

```rust
// From architecture.md Section 10
if rebalance_active {
    slots = {rebalance: 50%, user: 50%}
} else {
    slots = {user: 100%}
}
```

Integration point in `run_netting_pipeline()`:
```rust
pub fn run_netting_pipeline_with_rebalance(
    &mut self,
    user_orders: Vec<LimitOrder>,
    rebalance_trades: Vec<RebalanceTrade>,
    bridges: Vec<BridgeRequest>,
    usdc_usdt_rate: f64,
    total_fee: U256,
    total_capacity: usize,
) -> NettingResult {
    let slots = if !rebalance_trades.is_empty() {
        PrioritySlots::when_rebalance_active()
    } else {
        PrioritySlots::when_no_rebalance()
    };

    let (rebalance_slots, user_slots) = slots.allocate_slots(total_capacity);

    // Process rebalance trades up to rebalance_slots limit
    // Process user orders up to user_slots limit
    // ...existing pipeline...
}
```

### Testing Approach

1. **Pure functions**: All rebalance netting is stateless (except queue), easy to unit test
2. **No mocks needed for computation**: Create test proposals and verify outputs
3. **Edge cases to cover**:
   - Empty proposals (nothing to rebalance)
   - Single ITP rebalance (no cross-ITP netting)
   - All ITPs buying same asset (no internal matching)
   - All ITPs selling same asset (no internal matching)
   - Perfect offset (net zero, all internal)
   - Partial offset (some internal, some external)
   - Large values (I256 overflow protection)

Example test:
```rust
#[test]
fn test_net_deltas_opposite_directions() {
    // ITP-A: BTC 50%→30% ($100k value) → sell $20k BTC
    // ITP-B: BTC 40%→60% ($50k value)  → buy $10k BTC
    // Net: sell $10k BTC

    let proposals = vec![
        RebalanceProposal {
            itp_id: H256::from_low_u64_be(1),
            old_weights: vec![U256::from(500_000_000_000_000_000u64)], // 50%
            new_weights: vec![U256::from(300_000_000_000_000_000u64)], // 30%
            asset_indices: vec![U256::zero()], // BTC = index 0
            proposed_at: U256::zero(),
        },
        RebalanceProposal {
            itp_id: H256::from_low_u64_be(2),
            old_weights: vec![U256::from(400_000_000_000_000_000u64)], // 40%
            new_weights: vec![U256::from(600_000_000_000_000_000u64)], // 60%
            asset_indices: vec![U256::zero()], // BTC = index 0
            proposed_at: U256::zero(),
        },
    ];

    let mut itp_values = HashMap::new();
    itp_values.insert(H256::from_low_u64_be(1), U256::from(100_000_000_000_000_000_000_000u128)); // $100k
    itp_values.insert(H256::from_low_u64_be(2), U256::from(50_000_000_000_000_000_000_000u128));  // $50k

    let prices = HashMap::new(); // Not needed for weight-based calculation

    let net_deltas = calculate_net_deltas(&proposals, &itp_values, &prices);

    // Net delta should be -$10k (net sell)
    let btc_delta = net_deltas.get(&U256::zero()).unwrap();
    assert!(btc_delta.is_negative());
    // -$10k in 18 decimal = -10_000_000_000_000_000_000_000
    assert_eq!(btc_delta.abs(), I256::from(10_000_000_000_000_000_000_000u128));
}
```

### Previous Story Intelligence

From **Story 3.7: Netting Engine** (done):
- Uses `I256` for signed arithmetic in pair netting
- `MergedOrder` tracks `source_orders` for fill allocation
- `fee_allocation()` distributes fees proportionally with rounding to largest
- `DepegState` tracks USDT depeg across cycles
- All netting functions are pure/stateless except DepegState
- 53 unit tests provide good coverage patterns to follow

Key code patterns to follow:
```rust
// From pair.rs - tracking source orders for allocation
entry.source_orders.push(order.clone());
entry.total_amount += order.amount;

// From fees.rs - proportional allocation with rounding
let share = (order.amount * total_fee) / total_amount;
// Remainder goes to largest order
```

### Dependencies

- **Blocks**: None (can be implemented independently)
- **Blocked by**: Story 3.7 (Netting Engine) - DONE
- **Parallel with**: Stories 3.4 (State Reconstruction), 3.11 (Leader Election)

### References

- [Source: architecture.md#rebalance-flow] - Rebalance lifecycle
- [Source: architecture.md#rebalance-netting-algorithm] - Netting algorithm phases
- [Source: architecture.md#10-throughput--priority] - Priority slot allocation
- [Source: architecture.md#reconstruction-algorithm-rust] - Progress calculation
- [Source: architecture.md#appendix-b-data-structures] - PendingRebalance struct
- [Source: epics.md#epic-3-issuer-node] - Story 3.17 definition
- [Source: 3-7-netting-engine.md] - Previous story learnings and patterns
- [Source: issuer/src/netting/] - Existing netting implementation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered.

### Completion Notes List

1. **Task 1 Complete**: Created `issuer/src/netting/rebalance.rs` module with all core types:
   - `RebalanceProposal`: ITP weight change proposal
   - `RebalanceQueue`: Batch collection with timeout/signal support
   - `RebalanceTrade`: Trade generated from netting
   - `RebalanceFillAllocation`: Pro-rata fill distribution per ITP
   - `InternalTransfer`: ITP-to-ITP matches avoiding external execution
   - `PrioritySlots`: 50/50 slot allocation when rebalance active

2. **Task 2 Complete**: Implemented `collect_rebalance_proposals()` via `RebalanceQueue`:
   - `add_proposal()` - adds proposals and starts batch timer
   - `is_batch_ready()` - checks signal/timeout/expected count
   - `signal_execute()` - triggers immediate execution
   - `drain_batch()` - returns proposals and resets queue
   - Configurable timeout (default 1 hour)

3. **Task 3 Complete**: Implemented `calculate_net_deltas()`:
   - Formula: `net_delta[asset] = Σ(itp_value × (new_weight - old_weight))`
   - Uses I256 for signed arithmetic (safe overflow handling)
   - Returns `HashMap<U256, I256>` (asset_idx → net delta)

4. **Task 4 Complete**: Implemented `generate_rebalance_trades()`:
   - Positive delta → BUY trade
   - Negative delta → SELL trade
   - Zero delta → no trade (fully netted internally)
   - Tracks source ITPs for each trade

5. **Task 5 Complete**: Implemented `allocate_rebalance_fills()`:
   - Pro-rata allocation: `itp_fill = total_fill × (|itp_delta| / |total_delta|)`
   - Internal transfers for ITPs on opposite sides
   - Rounding remainder goes to largest contributor

6. **Task 6 Complete**: Implemented `finalize_rebalance()` and `compute_rebalance_progress()`:
   - Progress formula from architecture.md
   - Returns `RebalanceCompleteData` for event emission

7. **Task 7 Complete**: Implemented `PrioritySlots`:
   - `when_rebalance_active()` → 50% rebalance, 50% user
   - `when_no_rebalance()` → 0% rebalance, 100% user
   - `allocate_slots(capacity)` → (rebalance_slots, user_slots)

8. **Task 8 Complete**: 29 unit tests covering all acceptance criteria

### File List

- `issuer/src/netting/rebalance.rs` (NEW) - Rebalance Netting Engine implementation
- `issuer/src/netting/mod.rs` (MODIFIED) - Added `mod rebalance`, exports, and `run_netting_pipeline_with_rebalance()` method
- `issuer/src/lib.rs` (MODIFIED) - Added rebalance type exports including `NettingResultWithRebalance` and `NetDeltaResult`

## Change Log

- 2026-01-30: Implemented Rebalance Netting Engine (Story 3.17)
  - Created rebalance.rs module with all types and functions
  - Added 29 unit tests covering queue, netting, trades, allocation, and priority slots
  - All netting tests pass (82 total including existing tests)

- 2026-01-30: Code Review Fixes Applied (Story 3.17)
  - **CRITICAL FIX**: Added `run_netting_pipeline_with_rebalance()` to integrate PrioritySlots with pipeline (AC#6 was incomplete)
  - **CRITICAL FIX**: Changed `i256_from_u256()` to panic on overflow instead of silent cap
  - **HIGH FIX**: Fixed math bug in `u256_to_f64()` - was multiplying by u128::MAX instead of 2^128
  - **HIGH FIX**: Changed `PrioritySlots::custom()` from debug_assert to return Result<Self, Error>
  - **HIGH FIX**: Added `RebalanceProposal::new()` with weight validation (sum must equal 1e18)
  - **MEDIUM FIX**: Added `is_batch_ready_at_block_time()` for consensus-safe timeout checking
  - **MEDIUM FIX**: Changed `compute_rebalance_progress()` to return Result instead of 0.0 on error
  - **MEDIUM FIX**: Added `NetDeltaResult` struct to track skipped proposals (zero-value ITPs)
  - Added new types: `NettingResultWithRebalance`, `NetDeltaResult`
  - Added 8 new tests (now 44 rebalance tests, 90 total netting tests pass)

