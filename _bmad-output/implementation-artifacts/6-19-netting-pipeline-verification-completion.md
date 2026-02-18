# Story 6.19: Netting Pipeline Verification & Completion

Status: done

## Story

As a **developer**,
I want to verify the full 7-step netting pipeline from architecture.md is correctly implemented,
so that the system achieves maximum trading efficiency through proper order netting, slippage filtering, and chain grouping.

## Acceptance Criteria

1. **AC1: Pipeline Audit** - Verify each of the 7 netting steps against architecture.md Section 8:
   - Document which steps are fully implemented, partially implemented, or missing
   - For each gap, determine if it's a genuine requirement or architectural dead-end

2. **AC2: Fill Priority Check (Step 2)** - If needed, implement liquidity checking:
   - Query spreads at 25%, 50%, 75%, 100% fill levels
   - Find highest fillable level within tolerance
   - Partial fill with remainder queued for next cycle

3. **AC3: Slippage Tier Filter Integration (Step 3)** - Wire existing slippage module into pipeline:
   - `issuer/src/slippage/mod.rs` exists but isn't called from `NettingEngine`
   - Integrate `filter_by_slippage()` and `FilteredMergedOrder` into pipeline
   - Tier 0 (≤0.3%), Tier 1 (≤1%), Tier 2 (≤3%) filtering

4. **AC4: Chain Grouping (Step 4)** - If needed, implement destination chain batching:
   - Group merged orders by destination chain (Arbitrum, Solana, etc.)
   - Batch orders for gas efficiency
   - Respect per-chain execution limits

5. **AC5: USDT Pair Classification Fix** - Replace placeholder heuristic:
   - Current: First byte >= 0x80 detects USDT pairs (placeholder)
   - Required: Use AssetPairRegistry lookup for production accuracy
   - Location: `issuer/src/netting/usdt.rs`

6. **AC6: Pipeline Integration Test** - Create comprehensive test:
   - Test full 7-step flow with mixed orders (BUY/SELL, multiple pairs, multiple chains)
   - Verify correct netting savings calculations
   - Verify slippage tier exclusions
   - Verify fee allocations match order proportions

7. **AC7: Architecture Alignment Documentation** - Update implementation to match architecture or document deviations:
   - If steps 2/3/4 are simplified or combined, document rationale in backlog.md
   - Ensure `mod.rs` doc comments accurately reflect actual pipeline

## Tasks / Subtasks

- [x] Task 1: Pipeline Audit (AC: 1)
  - [x] 1.1 Read architecture.md Section 8 and Phase 2 diagram (lines 857-910)
  - [x] 1.2 Trace current implementation in `issuer/src/netting/*.rs`
  - [x] 1.3 Create gap analysis table with implementation status
  - [x] 1.4 Determine which gaps are blocking vs acceptable simplifications

- [x] Task 2: Fill Priority Check Implementation (AC: 2)
  - [x] 2.1 Assess if fill priority is needed (may be handled by execution layer) - ASSESSED: NOT NEEDED IN NETTING
  - [x] 2.2 If needed: Add `query_spreads_at_levels()` function - SKIPPED: execution layer concern (architectural decision)
  - [x] 2.3 If needed: Add `find_max_fillable_level()` function - SKIPPED: execution layer concern (architectural decision)
  - [x] 2.4 If deferred: Document rationale in backlog.md

- [x] Task 3: Slippage Integration (AC: 3)
  - [x] 3.1 Review `issuer/src/slippage/mod.rs` current state
  - [x] 3.2 Add `filter_merged_orders()` call in `run_netting_pipeline()`
  - [x] 3.3 Update `NettingResult` to include excluded orders for retry
  - [x] 3.4 Add tests for slippage tier filtering (10 new tests)

- [x] Task 4: Chain Grouping (AC: 4)
  - [x] 4.1 Assess if chain grouping is needed (may be execution-layer concern) - ASSESSED: NOT NEEDED IN NETTING
  - [x] 4.2 If needed: Add `group_by_chain()` function - SKIPPED: execution-layer concern (architectural decision)
  - [x] 4.3 If deferred: Document rationale in backlog.md

- [x] Task 5: USDT Classification Fix (AC: 5)
  - [x] 5.1 Add AssetPairRegistry dependency to netting module (via PairQuoteLookup trait)
  - [x] 5.2 Replace byte heuristic with registry lookup (usdt_netting_with_registry)
  - [x] 5.3 Add fallback for missing registry (dev/test mode - NoPairRegistry)

- [x] Task 6: Integration Tests (AC: 6)
  - [x] 6.1 Create `tests/netting_pipeline_integration.rs`
  - [x] 6.2 Test scenario: Multi-ITP orders netting correctly
  - [x] 6.3 Test scenario: Slippage tier filtering
  - [x] 6.4 Test scenario: USDT depeg circuit breaker
  - [x] 6.5 Test scenario: Fee allocation proportionality

- [x] Task 7: Documentation Update (AC: 7)
  - [x] 7.1 Update `netting/mod.rs` doc comments to reflect actual pipeline
  - [x] 7.2 Log decisions to backlog.md with session ID (20260131-1809-n6p7)
  - [x] 7.3 Close GAP-H1 and GAP-M8 in backlog.md

## Dev Notes

### Architecture Pipeline (Section 8, lines 857-910)

```
STEP 1: Pair Netting     - Group by pairId, net buys vs sells
STEP 2: Fill Priority    - Query liquidity at 25/50/75/100%, partial fill
STEP 3: Slippage Filter  - Exclude orders above tier limit
STEP 4: Chain Grouping   - Batch by destination chain
STEP 5: Bridge Netting   - Net opposite-direction bridges
STEP 6: USDT Netting     - Net USDC↔USDT swaps, depeg check
STEP 7: Fee Allocation   - Distribute costs by order size
```

### Final Implementation Status

| Step | File | Status | Notes |
|------|------|--------|-------|
| 1 | `pair.rs` | ✅ Done | `pair_netting()` merges same-pair orders |
| 2 | - | ⏭️ Deferred | Execution-layer concern (liquidity query) |
| 3 | `slippage/mod.rs` + `mod.rs` | ✅ Done | `filter_merged_orders_by_slippage()` wired in pipeline |
| 4 | - | ⏭️ Deferred | Execution-layer concern (chain batching) |
| 5 | `bridge.rs` | ✅ Done | `bridge_netting()` nets opposite directions |
| 6 | `usdt.rs` | ✅ Done | `usdt_netting_with_registry()` + depeg circuit breaker |
| 7 | `fees.rs` | ✅ Done | `fee_allocation()` proportional to order size |

### Known Backlog Items

From `backlog.md`:
- **GAP-H1**: Netting engine implements 4 of 7 pipeline steps
- **GAP-M8**: USDT netting pair classification uses placeholder heuristic

### Key Questions to Resolve

1. **Fill Priority (Step 2)**: Is liquidity querying needed in netting, or handled by execution layer?
2. **Chain Grouping (Step 4)**: Is this a netting concern or execution routing concern?
3. **Slippage Integration**: Why is slippage module not wired? Was it intentional or oversight?

### Project Structure Notes

- Netting module: `issuer/src/netting/`
- Slippage module: `issuer/src/slippage/`
- Rebalance netting: `issuer/src/netting/rebalance.rs`
- Integration point: `NettingEngine::run_netting_pipeline()` in `mod.rs`

### References

- [Source: architecture.md#8-unified-netting-engine] - Full pipeline specification
- [Source: architecture.md lines 857-910] - Phase 2 Unified Netting Flow diagram
- [Source: architecture.md lines 1113-1183] - Netting Algorithm Rust pseudocode
- [Source: backlog.md GAP-H1] - Known 4/7 steps implementation gap
- [Source: backlog.md GAP-M8] - USDT pair classification placeholder

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Session ID

20260131-1809-n6p7

### Debug Log References

None

### Completion Notes List

1. **Pipeline Audit Complete**: Steps 2 (Fill Priority) and 4 (Chain Grouping) are execution-layer concerns, not netting-layer. These are intentionally not implemented in NettingEngine as they require real-time liquidity data and chain routing which is handled downstream.

2. **Slippage Integration Complete**: Added `run_netting_pipeline_with_slippage()` and `run_netting_pipeline_with_rebalance_and_slippage()` methods. Slippage filtering happens after pair netting, excluded orders are collected in `NettingResult.excluded_orders` for retry next cycle.

3. **USDT Classification Fixed**: Added `PairQuoteLookup` trait for production registry injection. `usdt_netting_with_registry()` uses trait-based lookup. `NoPairRegistry` struct provides fallback for dev/test mode.

4. **Integration Tests Pass**: 11 comprehensive integration tests covering all pipeline scenarios - multi-ITP netting, slippage filtering, USDT depeg, fee allocation, bridge netting, rebalance slot allocation, edge cases.

5. **Backlog Gaps Closed**: GAP-H1 (4/7 steps) and GAP-M8 (USDT placeholder) both resolved and documented in backlog.md.

6. **Code Review Complete (2026-01-31)**: Adversarial code review performed. 3 issues found (0H/1M/2L). M-3 fixed: Task checkboxes for skipped subtasks now correctly marked [x] with architectural decision notes. 103 netting module tests + 11 integration tests all passing.

### Test Results

```
running 11 tests
test test_full_pipeline_bridge_netting ... ok
test test_full_pipeline_fee_allocation_proportionality ... ok
test test_full_pipeline_mixed_orders_comprehensive ... ok
test test_full_pipeline_multi_itp_orders_netting ... ok
test test_full_pipeline_slippage_tier_filtering ... ok
test test_full_pipeline_usdt_depeg_circuit_breaker ... ok
test test_pipeline_all_orders_excluded ... ok
test test_pipeline_empty_input ... ok
test test_pipeline_netting_savings_calculation ... ok
test test_pipeline_single_order ... ok
test test_pipeline_with_rebalance_slot_allocation ... ok

test result: ok. 11 passed; 0 failed
```

### File List

**Modified:**
- `issuer/src/netting/mod.rs` - Added slippage integration, new pipeline methods, filter_merged_orders_by_slippage()
- `issuer/src/netting/usdt.rs` - Added PairQuoteLookup trait, usdt_netting_with_registry(), NoPairRegistry, usdt_addresses module
- `issuer/src/netting/tests.rs` - Added 10 slippage filtering tests
- `backlog.md` - Logged decisions and closed GAP-H1, GAP-M8

**Created:**
- `issuer/tests/netting_pipeline_integration.rs` - 11 comprehensive integration tests

