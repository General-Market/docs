# Vision Round-Only Purge — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all continuous/tick-engine Vision code. Only the round-based model from `docs/plans/2026-03-17-vision-round-based-batches.md` survives.

**Architecture:** Three-layer purge — contracts (fix settleBatch + delete dual-balance), oracle Rust (delete ~5,500 lines of tick engine, keep lifecycle manager), frontend (delete 10 files, refactor 10). Each batch = one round. Direct USDC in via `joinBatchDirect()`, direct USDC out via `settleBatch()`. No persistent balance, no stakePerTick, no recurring ticks.

**Tech Stack:** Solidity (Foundry), Rust (oracle), TypeScript/React (Next.js frontend)

**Spec:** `docs/plans/2026-03-17-vision-round-based-batches.md`

---

## File Structure

### Contracts (modify)
- `contracts/src/vision/Vision.sol` — delete dual-balance functions, fix settleBatch
- `contracts/src/interfaces/IVision.sol` — delete continuous interfaces
- `contracts/test/Vision.t.sol` — rewrite for round-based (all 59 tests are continuous)

### Oracle (delete/modify)
- DELETE entirely: `oracle/src/vision/tick_consensus.rs`, `oracle/src/vision/deposit_watcher.rs`, `oracle/src/vision/pending_ops.rs`, `oracle/src/vision/config_cache.rs`
- CREATE: `oracle/src/vision/shared.rs` — extracted utilities from engine.rs
- GUTTED: `oracle/src/vision/engine.rs` → delete (after extracting shared utils)
- REFACTOR: `oracle/src/vision/tick_scheduler.rs` (rename to batch_state, remove tick scheduling + dual-balance)
- REFACTOR: `oracle/src/vision/api.rs` (delete continuous endpoints)
- REFACTOR: `oracle/src/vision/bitmap_store.rs` (collapse pending/active slots)
- REFACTOR: `oracle/src/vision/config.rs` (remove round_based_sources)
- REFACTOR: `oracle/src/vision/types.rs` (remove continuous types)
- REFACTOR: `oracle/src/vision/chain_listener.rs` (remove dual-balance events)
- REFACTOR: `oracle/src/vision/mod.rs` (remove deleted modules)
- REFACTOR: `oracle/src/main.rs` (remove tick engine spawn)
- CREATE: `oracle/migrations/010_drop_continuous_tables.sql`

### Frontend (delete/modify)
- DELETE: `frontend/hooks/vision/useDeposit.ts`
- DELETE: `frontend/hooks/vision/useDepositBalance.ts`
- DELETE: `frontend/hooks/vision/useWithdrawBalance.ts`
- DELETE: `frontend/hooks/vision/useVisionBalance.ts`
- DELETE: `frontend/hooks/vision/useDepositToVision.ts`
- DELETE: `frontend/hooks/vision/useWithdrawToSettlement.ts`
- DELETE: `frontend/hooks/vision/useClaim.ts`
- DELETE: `frontend/hooks/vision/useBalanceChangeNotification.ts`
- DELETE: `frontend/components/domain/vision/BalanceDepositModal.tsx`
- DELETE: `frontend/components/domain/vision/BalanceWithdrawModal.tsx`
- REFACTOR: `frontend/hooks/vision/useJoinBatch.ts` (remove stakePerTick, use wallet USDC)
- REFACTOR: `frontend/hooks/vision/usePlayerPosition.ts` (remove stakePerTick sentinel)
- REFACTOR: `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` (gut tick history, round-based UX)
- REFACTOR: `frontend/components/domain/vision/detail/SourceDetail.tsx` (remove tick timer, round status)
- REFACTOR: `frontend/components/domain/vision/WithdrawModal.tsx` → simplify to collect settlement

### Infrastructure
- MODIFY: `testnet.sh` — remove ORACLE_VISION_ROUND_BASED_SOURCES (all sources are round-based)
- MODIFY: `docker/testnet/oracle/docker-compose.yml` — remove tick engine config flags

---

## Chunk 1: Contract Surgery

### Task 1: Fix settleBatch() — direct USDC transfer

The current `settleBatch()` credits `realBalance` instead of transferring USDC. The spec says `collateral.safeTransfer(players[i], netPayout)`.

**Files:**
- Modify: `contracts/src/vision/Vision.sol` (settleBatch function, ~lines 798-871)

- [ ] **Step 1: Read the current settleBatch implementation**

Read `contracts/src/vision/Vision.sol` lines 798-871 to understand the current payout routing.

- [ ] **Step 2: Replace balance credit with direct transfer**

In `settleBatch()`, replace:
```solidity
// Current: credits dual-balance
realBalance[players[i]] += netPayout;
```
With:
```solidity
// Direct transfer to player wallet
collateral.safeTransfer(players[i], netPayout);
```

Also remove the `totalRealBalance` adjustment and any `virtualBalance` logic in the settlement loop.

Keep: solvency check, ascending address requirement, fee accumulation, BLS verification, `BatchAlreadySettled` revert, `PlayerSettled`/`BatchSettled` events.

Change `if (pos.stakePerTick == 0) revert NotJoined()` to `if (pos.joinTimestamp == 0) revert NotJoined()` — `stakePerTick` is vestigial.

- [ ] **Step 3: Verify compilation**

```bash
cd contracts && forge build
```

- [ ] **Step 4: Commit**

```bash
git add contracts/src/vision/Vision.sol
git commit -m "fix: settleBatch sends USDC directly to wallets (not dual-balance credit)"
```

### Task 2: Delete continuous-model contract functions

**Files:**
- Modify: `contracts/src/vision/Vision.sol`
- Modify: `contracts/src/interfaces/IVision.sol`

- [ ] **Step 1: Delete these functions from Vision.sol**

Delete entirely (function body + signature):
- `joinBatch()` — the dual-balance version (pulls from realBalance/virtualBalance via `_debitBalance`)
- `deposit()` — position top-up from dual-balance
- `depositBalance()` — deposits USDC into continuous Vision balance
- `withdrawBalance()` — withdraws from continuous Vision balance
- `withdrawToSettlement()` — cross-chain withdrawal from virtualBalance
- `creditBalance()` — BLS-gated oracle function to credit virtualBalance
- `claimRewards()` — per-tick reward claiming with tick ranges
- `withdraw()` — individual BLS-gated position withdrawal
- `forceWithdraw()` — admin force withdrawal
- `_debitBalance()` — internal dual-balance debit helper
- `createBatchAndJoin()` — uses dual-balance joinBatch internally

Keep:
- `joinBatchDirect()` — the round-based entry point
- `settleBatch()` — just fixed in Task 1
- `_createBatch()` — batch creation
- `createBatch()` — BLS-signed batch creation
- `updateBitmap()` — bitmap updates
- `_requireNotLocked()` — lock window enforcement
- `_currentTickId()` — used for lock window calculation

- [ ] **Step 2: Delete continuous state variables from Vision.sol**

Delete:
```solidity
mapping(address => uint256) public realBalance;
mapping(address => uint256) public virtualBalance;
uint256 public totalRealBalance;
uint256 public totalVirtualBalance;
mapping(address => bool) public depositProcessed;
mapping(address => uint256) public withdrawNonce;
mapping(address => mapping(uint256 => WithdrawRequest)) public withdrawRequests;
```

Keep all batch/position storage as-is.

- [ ] **Step 3: Delete corresponding interface entries from IVision.sol**

Remove function signatures, events, errors, and structs related to deleted functions:
- `BalanceCredited`, `BalanceWithdrawn`, `RewardsClaimed` events
- `WithdrawRequest` struct
- Function signatures matching deleted functions

- [ ] **Step 4: Delete _promoteConfigIfNeeded and updateBatchConfig**

These implement deferred config rotation across ticks. Round-based batches get fresh config at creation. Each batch has one config for its lifetime.

Delete:
- `_promoteConfigIfNeeded()`
- `updateBatchConfig()` — BLS-signed config update for live batches

In `joinBatchDirect()`, remove the `_promoteConfigIfNeeded(batchId)` call.

- [ ] **Step 5: Verify compilation**

```bash
cd contracts && forge build
```

Expected: compilation errors from tests that reference deleted functions. That's fine — tests are rewritten in Task 3.

- [ ] **Step 6: Commit**

```bash
git add contracts/
git commit -m "purge: delete dual-balance, claimRewards, withdraw, deposit — round-only contract"
```

### Task 3: Rewrite contract tests for round-based model

**Files:**
- Modify: `contracts/test/Vision.t.sol`

- [ ] **Step 1: Delete all 59 existing tests**

They all test the continuous model (dual-balance joinBatch, claimRewards, withdraw). Replace with round-based tests.

- [ ] **Step 2: Write round-based test suite**

Tests needed:
1. `test_joinBatchDirect_depositsUSDC` — player USDC transfers to contract, position created
2. `test_joinBatchDirect_requiresApproval` — reverts without USDC approval
3. `test_joinBatchDirect_rejectsInLockWindow` — reverts during lock
4. `test_joinBatchDirect_rejectsDuplicateJoin` — can't join same batch twice
5. `test_settleBatch_transfersUSDCToPlayers` — USDC goes from contract to player wallets
6. `test_settleBatch_deductsFeeOnProfit` — fee only on profit, not on loss
7. `test_settleBatch_deletesPositions` — positions zeroed after settlement
8. `test_settleBatch_rejectsDoubleSettle` — can't settle twice (paused = true)
9. `test_settleBatch_requiresBLS` — invalid BLS signature reverts
10. `test_settleBatch_conservesUSDC` — total payouts <= total deposits + contract balance
11. `test_roundLifecycle_fullCycle` — create → join → settle → USDC back in wallet
12. `test_multipleRoundsSameSource` — same source can have multiple concurrent batches
13. `test_updateBitmap_worksBeforeLock` — bitmap update within betting window
14. `test_updateBitmap_rejectsAfterLock` — bitmap update rejected in lock window

Use the existing `BLSTestHelper` for BLS signature generation in tests.

- [ ] **Step 3: Run tests**

```bash
cd contracts && forge test --match-contract VisionTest -v
```

- [ ] **Step 4: Commit**

```bash
git add contracts/test/Vision.t.sol
git commit -m "test: round-based Vision test suite (14 tests, replaces 59 continuous tests)"
```

---

## Chunk 2: Oracle Purge — Extraction & Deletion

### Task 4: Extract shared utilities from engine.rs

Before deleting engine.rs, extract the ~15% of shared code that lifecycle.rs needs.

**Files:**
- Create: `oracle/src/vision/shared.rs`
- Modify: `oracle/src/vision/mod.rs`

- [ ] **Step 1: Create shared.rs with these functions extracted from engine.rs**

Move these functions to `shared.rs`:
- `fetch_snapshot_data_inner_with_secret()` — HMAC-verified snapshot fetching
- `parse_snapshot_data()` — JSON parsing of data-node snapshots
- `fetch_snapshot_with_retry()` — retry logic
- `parse_resolution_type()` — maps resolution type strings to u8
- `asset_id_to_market_id()` — keccak256 helper
- `record_settlements()` — posts settlement data to data-node
- `get_chain_timestamp()` — fetches block timestamp from RPC
- `source_max_age_secs()` and `SOURCE_MAX_AGE_SECS` — staleness thresholds

Keep the same function signatures. Update imports to use types from `types.rs`.

- [ ] **Step 2: Add `pub mod shared;` to mod.rs**

- [ ] **Step 3: Update lifecycle.rs imports to use shared.rs**

Replace any duplicated utility functions in lifecycle.rs with imports from `shared.rs`.

- [ ] **Step 4: Verify compilation**

```bash
cargo check -p oracle
```

- [ ] **Step 5: Commit**

```bash
git add oracle/src/vision/shared.rs oracle/src/vision/mod.rs oracle/src/vision/lifecycle.rs
git commit -m "refactor: extract shared vision utilities from engine.rs into shared.rs"
```

### Task 5: Delete tick engine and continuous-only modules

**Files:**
- Delete: `oracle/src/vision/engine.rs`
- Delete: `oracle/src/vision/tick_consensus.rs`
- Delete: `oracle/src/vision/deposit_watcher.rs`
- Delete: `oracle/src/vision/pending_ops.rs`
- Delete: `oracle/src/vision/config_cache.rs`
- Modify: `oracle/src/vision/mod.rs`

- [ ] **Step 1: Delete the 5 files**

```bash
rm oracle/src/vision/engine.rs
rm oracle/src/vision/tick_consensus.rs
rm oracle/src/vision/deposit_watcher.rs
rm oracle/src/vision/pending_ops.rs
rm oracle/src/vision/config_cache.rs
```

- [ ] **Step 2: Remove module declarations from mod.rs**

Remove:
```rust
pub mod engine;
pub mod tick_consensus;
pub mod deposit_watcher;
pub mod pending_ops;
pub mod config_cache;
```

- [ ] **Step 3: Fix compilation errors in main.rs**

Remove from `main.rs`:
- `engine::run()` spawn
- `IncomingBalanceProofsBatch` / `IncomingBitmapGossip` channel creation for the tick engine
- `TickConsensus` setup
- `deposit_watcher::run()` spawn
- Any `PendingOps` queue creation
- The `round_based_sources` config gating — ALL sources go through `BatchLifecycleManager`

Keep:
- `BatchLifecycleManager` spawn (lifecycle.rs)
- Chain listener spawn
- API routes
- Bitmap gossip for lifecycle manager (if used)

- [ ] **Step 4: Verify compilation**

```bash
cargo check -p oracle
```

Expect remaining errors from tick_scheduler.rs and api.rs referencing deleted types. Those are fixed in Tasks 6-7.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "purge: delete tick engine, tick consensus, deposit watcher, pending ops, config cache"
```

### Task 6: Gut tick_scheduler.rs → batch state only

**Files:**
- Modify: `oracle/src/vision/tick_scheduler.rs`

- [ ] **Step 1: Delete tick scheduling methods**

Delete:
- `get_due_batches()` — tick engine scheduling
- `mark_resolved()` / `mark_resolved_with_db()` — tick counter advancement
- `next_tick_for_batch()` — next tick computation
- `soonest_due_in()` — tick engine heartbeat
- `apply_tick_balances()` / `apply_tick_balances_with_db()` — per-tick balance deltas
- `last_resolved` field and all references

- [ ] **Step 2: Delete dual-balance state**

Delete:
- `user_real_balances` / `user_virtual_balances` fields
- `on_virtual_balance_credited()`, `on_real_balance_deposited()`, `on_real_balance_withdrawn()`, `on_virtual_balance_withdrawn()`
- `on_batch_payout()`, `on_batch_join_debit()`
- `get_user_balance()`, `get_user_total_balance()`, `set_user_balances()`
- `on_rewards_claimed()`
- `on_player_deposited()` — in-batch deposit additions

- [ ] **Step 3: Keep batch/player state methods**

Keep:
- `on_batch_created()`, `on_player_joined()`, `on_bitmap_updated()`
- `on_batch_paused()` / `on_batch_unpaused()`
- `on_batch_config_updated()` / `on_batch_config_promoted()`
- `get_batch_state()`, `get_batch()`, `get_player_bitmap_hash()`
- `active_batch_count()`, `player_count()`
- `find_latest_batch_for_source()`
- `get_all_batch_ids()`
- `remove_batch()`, `mark_settled()`
- `load_from_db()` (simplify — remove balance recovery)
- `update_config_hash()`

- [ ] **Step 4: Simplify load_from_db()**

Remove balance-related recovery from `load_from_db()`. Only load batch metadata and player positions (bitmap hashes, join timestamps).

- [ ] **Step 5: Verify compilation**

```bash
cargo check -p oracle
```

- [ ] **Step 6: Commit**

```bash
git add oracle/src/vision/tick_scheduler.rs
git commit -m "purge: gut tick_scheduler — keep batch/player state, delete tick scheduling + dual-balance"
```

### Task 7: Purge continuous endpoints from api.rs

**Files:**
- Modify: `oracle/src/vision/api.rs`

- [ ] **Step 1: Delete continuous-model endpoints**

Delete handler functions:
- `batch_history()` — `GET /vision/batch/:id/history` (per-tick history)
- `get_balance()` — `GET /vision/balance/:batch_id/:player` (WITHDRAW balance proofs)
- `get_reveals()` — `GET /vision/reveal/:batch_id/:tick_id` (per-tick reveals)
- `backtest()` — `POST /vision/backtest` (tick-by-tick simulation)
- `get_user_balance()` — `GET /vision/user/:address/balance` (dual-balance query)
- `get_deposit_status()` — `GET /vision/deposit/:order_id/status` (cross-chain deposit)
- `get_withdraw_status()` — `GET /vision/withdraw/:withdraw_id/status` (cross-chain withdraw)

Delete associated types:
- `BalanceResponse`, `TickHistoryEntry`, `TickResultRow`
- Any backtest request/response types

- [ ] **Step 2: Remove deleted types from route registration**

In the `routes()` function, remove `.route()` calls for deleted endpoints.

- [ ] **Step 3: Clean up list_batches()**

Remove `current_tick` computation (calls `scheduler.next_tick_for_batch()`). Remove `PlayerInfo.stake_per_tick`, `PlayerInfo.balance`, `PlayerInfo.start_tick`. Keep source-based batch listing.

- [ ] **Step 4: Clean up submit_bitmap()**

Remove `target_tick_id` and `next_tick_for_batch()` usage. Store bitmap with `tick_id = 0` (single-round, no tick sequence).

- [ ] **Step 5: Clean up leaderboard**

Remove `vision_player_tick_deltas` dependency. Use only `vision_round_players` table for leaderboard data.

- [ ] **Step 6: Verify compilation**

```bash
cargo check -p oracle
```

- [ ] **Step 7: Commit**

```bash
git add oracle/src/vision/api.rs
git commit -m "purge: delete continuous API endpoints — keep round-based only"
```

### Task 8: Simplify remaining oracle modules

**Files:**
- Modify: `oracle/src/vision/bitmap_store.rs`
- Modify: `oracle/src/vision/config.rs`
- Modify: `oracle/src/vision/types.rs`
- Modify: `oracle/src/vision/chain_listener.rs`

- [ ] **Step 1: Simplify bitmap_store.rs — collapse pending/active**

Delete:
- `flip()` method (pending→active merge)
- `cleanup_stale_pending()`
- `persist_flip_and_mark_resolved()`
- `target_tick_id` field in `SlottedBitmap`

Rename `store_pending()` → `store()`, `get_active()` → `get()`, `get_all_active_for_batch()` → `get_all_for_batch()`.

Collapse to a single HashMap per batch (no pending/active slots). Players submit once per round.

- [ ] **Step 2: Simplify config.rs**

Delete:
- `round_based_sources: Vec<String>` — all sources are round-based
- `reveal_window_secs` — lock window handles this
- `commitment_offset` — multi-tick concept
- `tick_poll_interval_ms` — tick engine polling

Keep: `enabled`, `vision_address`, `data_node_url`, `database_url`, `rpc_ws_url`, `start_block`, `staleness_threshold_secs`, `data_node_token`, `snapshot_hmac_secret`, `chain_id`, `num_oracles`, `node_index`, `settlement_*`, `deposit_*`, `oracle_registry_address`.

- [ ] **Step 3: Simplify types.rs**

Delete:
- `PlayerBalance` struct (per-tick balance changes)
- `Batch.next_config_hash`, `Batch.next_lock_offset`, `Batch.next_tick_duration`, `Batch.epoch_offset`, `Batch.last_promotion_tick` (config rotation fields)
- `PlayerPosition.stake_per_tick` (replace with `deposit`)
- `PlayerPosition.balance` (deposit IS the stake)
- `SlottedBitmap.target_tick_id`
- `StoredBitmap` (unused)
- `DepositStatus`, `PendingVisionDeposit`, `WithdrawStatus`, `PendingVisionWithdraw` (dual-balance types)

- [ ] **Step 4: Simplify chain_listener.rs**

Delete event handling for:
- `PlayerDeposited` (in-batch top-up)
- `RewardsClaimed` (continuous claim)
- `BalanceCredited` / `BalanceWithdrawn` (dual-balance)
- `BatchConfigPromoted` (config rotation)

Keep: `BatchCreated`, `PlayerJoined`, `BitmapUpdated`, `BatchPaused`, `BatchUnpaused`, `PlayerWithdrawn`, `BatchSettled`.

- [ ] **Step 5: Verify full oracle compilation**

```bash
cargo check -p oracle
```

- [ ] **Step 6: Commit**

```bash
git add oracle/src/vision/
git commit -m "purge: simplify bitmap_store, config, types, chain_listener — round-only"
```

### Task 9: Remove round_based_sources gating everywhere

**Files:**
- Modify: `oracle/src/vision/lifecycle.rs`
- Modify: `oracle/src/main.rs`
- Modify: `testnet.sh`

- [ ] **Step 1: In lifecycle.rs, remove source filtering**

The `BatchLifecycleManager` currently checks `config.round_based_sources` to decide which sources to manage. Delete this filter — all sources go through the lifecycle manager.

Remove the early return at lines ~128-130:
```rust
if self.config.round_based_sources.is_empty() { return Ok(()); }
```

Remove `round_based_sources` filtering from the heartbeat loop.

- [ ] **Step 2: In main.rs, remove round_based_sources env var parsing**

Remove `ORACLE_VISION_ROUND_BASED_SOURCES` env var reading. All sources are round-based.

- [ ] **Step 3: In testnet.sh, remove round_based_sources from oracle config**

Remove any `--vision-round-based-sources` flag from `_oracle_command_yaml()`.

Remove `--vision-reveal-window-secs` (lock window handles this).

Remove `--vision-tick-poll-interval-ms` (tick engine polling — deleted).

- [ ] **Step 4: Verify compilation**

```bash
cargo check -p oracle
```

- [ ] **Step 5: Commit**

```bash
git add oracle/ testnet.sh
git commit -m "purge: all sources are round-based — no more round_based_sources gating"
```

### Task 10: Database migration — drop continuous tables

**Files:**
- Create: `oracle/migrations/010_drop_continuous_tables.sql`

- [ ] **Step 1: Write migration**

```sql
-- 010_drop_continuous_tables.sql
-- Drop tables used exclusively by the continuous/tick-engine model.
-- Round-based model uses: vision_batches, vision_positions, vision_bitmaps,
-- vision_batch_lifecycle, vision_round_players, vision_settlement_proofs.

DROP TABLE IF EXISTS vision_tick_results CASCADE;
DROP TABLE IF EXISTS vision_player_tick_deltas CASCADE;
DROP TABLE IF EXISTS vision_balance_proofs CASCADE;
DROP TABLE IF EXISTS vision_batch_state CASCADE;
DROP TABLE IF EXISTS vision_deposit_orders CASCADE;
DROP TABLE IF EXISTS vision_withdraw_orders CASCADE;
DROP TABLE IF EXISTS vision_user_balances CASCADE;

-- Clean up vision_kv_store entries used by tick engine
DELETE FROM vision_kv_store WHERE key LIKE 'tick_%' OR key LIKE 'engine_%';
```

- [ ] **Step 2: Commit**

```bash
git add oracle/migrations/010_drop_continuous_tables.sql
git commit -m "migration: drop continuous-model database tables"
```

---

## Chunk 3: Frontend Purge

### Task 11: Delete continuous-model hooks and modals

**Files:**
- Delete: 10 files

- [ ] **Step 1: Delete the files**

```bash
rm frontend/hooks/vision/useDeposit.ts
rm frontend/hooks/vision/useDepositBalance.ts
rm frontend/hooks/vision/useWithdrawBalance.ts
rm frontend/hooks/vision/useVisionBalance.ts
rm frontend/hooks/vision/useDepositToVision.ts
rm frontend/hooks/vision/useWithdrawToSettlement.ts
rm frontend/hooks/vision/useClaim.ts
rm frontend/hooks/vision/useBalanceChangeNotification.ts
rm frontend/components/domain/vision/BalanceDepositModal.tsx
rm frontend/components/domain/vision/BalanceWithdrawModal.tsx
```

- [ ] **Step 2: Find and remove all imports of deleted files**

Search across the codebase for imports of each deleted file. Remove the import lines and any code that uses the imported hooks/components.

Key files that import deleted hooks:
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` — imports `useDeposit`, `useVisionBalance`, `useBalanceChangeNotification`
- `frontend/components/domain/vision/detail/SourceDetail.tsx` — may import balance-related hooks
- `frontend/components/domain/vision/VisionBalanceBar.tsx` — imports `useVisionBalance`, renders DEPOSIT/WITHDRAW buttons that open the deleted modals

Replace `VisionBalanceBar` balance display with wallet USDC balance (via wagmi `useBalance`).

- [ ] **Step 3: Fix TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any remaining import errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "purge: delete 10 continuous-model hooks and modals"
```

### Task 12: Refactor BatchEntryPanel for round-based UX

**Files:**
- Modify: `frontend/components/domain/vision/detail/BatchEntryPanel.tsx`

- [ ] **Step 1: Delete tick-related UI**

Remove:
- `stakePerTick` display ("1.00 USDC/tick")
- Tick history section (per-tick PnL list: #197, #198, etc.)
- `tickSummary` computation (wins/losses/flats across ticks)
- Win/Loss summary bar inside position banner (this was for continuous ticks)
- `batchTicks` from player profile
- `showTickHistory` state
- `betsSubmittedTick` state and "carry forward" / "sitting out this tick" messages
- `getBatchTickState` import and tick timer logic
- `usePlayerProfile` import and profile/batchTicks usage

- [ ] **Step 2: Simplify join flow**

The join flow should:
1. Player sets predictions (UP/DN for each market) — KEEP as-is
2. Player enters deposit amount (USDC) — this IS the entire bet, no separate "stake per tick"
3. Player clicks "Enter Round" → `joinBatchDirect(batchId, configHash, deposit, deposit, bitmapHash)`
   - Pass `deposit` for both `depositAmount` and `stakePerTick` params (stakePerTick = depositAmount for single-round)
4. After join, show: "IN ROUND #N — $X deposited"
5. After settlement: "ROUND SETTLED — You won/lost $Y"

- [ ] **Step 3: Replace balance source**

Remove `useVisionBalance` dependency. Instead, check wallet USDC balance via wagmi `useBalance` or `useReadContract` for the USDC token balance.

The user needs USDC in their wallet, not in a Vision balance pool.

- [ ] **Step 4: Simplify position display**

Show:
- "IN ROUND #N" banner (green) when joined
- Deposit amount
- Round status (Betting / Locked / Settling / Settled)
- After settlement: PnL for this round (one number, not a tick history)

Remove: tick history, stakePerTick display, "sitting out" messaging.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/domain/vision/detail/BatchEntryPanel.tsx
git commit -m "refactor: BatchEntryPanel — round-based UX, no ticks, direct USDC deposit"
```

### Task 13: Refactor SourceDetail and WithdrawModal

**Files:**
- Modify: `frontend/components/domain/vision/detail/SourceDetail.tsx`
- Modify: `frontend/components/domain/vision/WithdrawModal.tsx`

- [ ] **Step 1: Simplify SourceDetail**

Delete:
- `getBatchTickState` and all tick timer infrastructure
- `activeBatch.currentTick` display
- Tick urgency system: `getTickUrgency`, urgency CSS classes
- `justResolved` flash effect
- `isResolving` prop passed to MarketsTable

Replace with round status display:
- "Betting Open — 2:31 remaining" (countdown to betting window close)
- "Locked — Betting closed"
- "Settling — Oracle resolving"
- "Settled — Results available"

- [ ] **Step 2: Simplify WithdrawModal → Collect Settlement**

Delete:
- "Claim Rewards" option (claimRewards tick-range partial claiming)
- `lastClaimedTick` / `startTick` / tick range computation
- `hasClaimableTicks`
- `stakePerTick` in position type
- The choose/withdraw/claim mode system

Simplify to single action: "Collect Settlement" — show round result, withdraw button.

In round-based mode, settlement sends USDC directly to wallet. This modal may become unnecessary if settleBatch() works correctly. Keep as a fallback for manual withdrawal if settlement hasn't completed.

- [ ] **Step 3: Refactor useJoinBatch**

In `frontend/hooks/vision/useJoinBatch.ts`:
- Remove `stakePerTick` parameter — the entire deposit is the bet
- Change balance check from Vision contract balance to wallet USDC balance
- Pass `depositAmount` for both `depositAmount` and `stakePerTick` in the contract call

- [ ] **Step 4: Refactor usePlayerPosition**

In `frontend/hooks/vision/usePlayerPosition.ts`:
- Remove `stakePerTick` field
- Remove `lastClaimedTick` field
- Change `isJoined` check from `pos.stakePerTick > 0n` to `pos.joinTimestamp > 0n`

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend && npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "refactor: SourceDetail round status, WithdrawModal simplified, useJoinBatch + usePlayerPosition cleaned"
```

---

## Chunk 4: Deploy & Verify

### Task 14: Deploy updated contracts

**Files:**
- Modify: `testnet.sh` (already updated in Task 9)

- [ ] **Step 1: Build contracts**

```bash
cd contracts && forge build
```

- [ ] **Step 2: Run contract tests**

```bash
forge test -v
```

All 14 round-based tests should pass.

- [ ] **Step 3: Deploy via testnet.sh**

```bash
./testnet.sh deploy
```

This deploys the updated Vision contract with:
- `settleBatch()` sending USDC directly to wallets
- No `joinBatch()` (dual-balance), no `claimRewards()`, no `depositBalance()`
- Only `joinBatchDirect()` + `settleBatch()` + `updateBitmap()`

- [ ] **Step 4: Commit deployment artifacts**

```bash
git add deployments/ envs/
git commit -m "chore: deploy round-only Vision contract to testnet"
```

### Task 15: Rebuild oracle and restart

- [ ] **Step 1: Push all changes**

```bash
git push mono main
```

- [ ] **Step 2: Restart services**

```bash
./testnet.sh stop
./testnet.sh start
```

The start will:
- Pull latest code on VPS
- Rebuild oracle binary (with tick engine deleted)
- Start lifecycle manager for all sources (no round_based_sources filter)
- Run migrations (drops continuous tables)

- [ ] **Step 3: Verify oracle logs**

```bash
ssh index-maker/prod/be "docker logs testnet-oracle-1 --tail 30 2>&1" | grep -i "lifecycle\|round\|create_batch\|settle"
```

Should see lifecycle manager creating batches and settling rounds.

- [ ] **Step 4: Verify frontend**

```bash
curl -sf http://localhost:3000/source/defi -o /dev/null -w "%{http_code}"
```

Should return 200.

### Task 16: Run E2E tests

- [ ] **Step 1: Run full E2E suite**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts
```

- [ ] **Step 2: Fix any failures**

E2E tests that reference continuous-model concepts (tick history, stakePerTick, dual-balance) need to be updated or deleted.

Key tests to check:
- `10-vision.spec.ts` — should use round-based join
- `14-vision-claim-withdraw.spec.ts` — claim is deleted; this test needs rewriting for round settlement
- `21-vision-claim-rewards.spec.ts` — claim is deleted; rewrite for automatic settlement
- `25-vision-tick-resolution.spec.ts` — tick concept deleted; rewrite for round resolution

- [ ] **Step 3: Commit E2E fixes**

```bash
git add frontend/e2e/
git commit -m "test: E2E tests updated for round-only Vision"
```

---

## Summary

| Chunk | Tasks | Lines Deleted | Lines Created |
|-------|-------|--------------|--------------|
| 1: Contracts | 1-3 | ~800 | ~200 (tests) |
| 2: Oracle | 4-10 | ~5,500 | ~300 (shared.rs, migration) |
| 3: Frontend | 11-13 | ~2,000 | ~200 (refactored components) |
| 4: Deploy | 14-16 | — | — |
| **Total** | **16** | **~8,300** | **~700** |

Net: **-7,600 lines**. The codebase becomes simpler. Each batch is one round. Direct USDC in, direct USDC out. No balance pools, no tick engines, no partial claims. The architecture that should have existed from the start.

---

## Addendum: Audit Gaps (from 3-agent consensus audit)

The following gaps were found by 3 independent full-stack auditors. Each must be addressed as additional tasks or merged into existing tasks.

### Gap Tasks to Add

#### Task 17: Purge consensus/protocol.rs (~800 lines)

**CRITICAL** — This 9,000-line file imports from `deposit_watcher.rs`, `pending_ops.rs`, and `engine.rs` (all deleted). ~800 lines of continuous-model consensus handlers must be removed.

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`
- Modify: `oracle/src/consensus/messages.rs`
- Modify: `oracle/src/consensus/equivocation.rs`

- [ ] Delete imports from `deposit_watcher`, `pending_ops`, `engine` (lines 22-28)
- [ ] Delete `vision_balance_proofs_tx` and `vision_bitmap_gossip_tx` fields (lines 427-430)
- [ ] Delete `run_vision_ops()` method (~300 lines, 7749-8054)
- [ ] Delete 4 follower handlers: `handle_vision_credit_balance_proposal/sign`, `handle_vision_complete_deposit_proposal/sign`, etc. (lines 8207-8525)
- [ ] Delete 12 `ProcessVision*` dispatch arms (lines 3052-3230)
- [ ] Delete `VisionConsensusConfig` struct (lines 222-235)
- [ ] In `messages.rs`: delete 12 continuous `MessageHandleResult` variants
- [ ] In `equivocation.rs`: delete 38 continuous message type match arms

#### Task 18: Purge P2P layer + common types

**Files:**
- Modify: `oracle/src/p2p/transport.rs`
- Modify: `oracle/src/p2p/connection.rs`
- Modify: `common/src/types/p2p.rs`

- [ ] Delete P2P message name strings for deleted types in `transport.rs`
- [ ] Delete sender-ID extraction match arms in `connection.rs`
- [ ] Delete 8 dead P2P enum variants in `common/src/types/p2p.rs` (VisionCreditBalance*, VisionCompleteDeposit*, etc.)
- [ ] Keep: `BitmapGossip`, `BitmapRequest`, `BitmapResponse` (used by lifecycle manager)
- [ ] Delete: `VisionBalanceProofsBatch` (only consumed by deleted engine)

#### Task 19: Fix main.rs completely (10+ removal points)

Plan Task 5 Step 3 says "fix compilation errors in main.rs" which is too vague for a 5,000-line file.

- [ ] Delete `PendingOpsQueue::new()` creation (line 4857)
- [ ] Delete `IncomingBalanceProofsBatch` / `IncomingBitmapGossip` channel creation (lines 5037-5042)
- [ ] Delete `vision_balance_proofs_tx`/`vision_bitmap_gossip_tx` installation on consensus (lines 5192-5209)
- [ ] Delete `VisionDepositWatcher` spawn (lines 5162-5177)
- [ ] Remove `vision_ops_queue_shared` from `run_main_loop` signature (line 616)
- [ ] Delete vision ops consensus task draining PendingOpsQueue (line 1332)
- [ ] Delete `vision_ops_l3_provider_for_task` variables (lines 771-789)
- [ ] Delete CLI args: `--vision-reveal-window-secs`, `--vision-tick-poll-interval-ms` (lines 296-300)
- [ ] Update DB reset truncation list (remove dropped tables, lines 4714-4716)
- [ ] Remove `round_based_sources` env var parsing

#### Task 20: Fix resolver.rs + settlement.rs for type changes

**CRITICAL** — `resolver.rs` uses `PlayerBalance` and `stake_per_tick`, both deleted from types.rs.

- [ ] In `types.rs`: rename `PlayerPosition.stake_per_tick` → `deposit` (NOT delete — resolver needs it)
- [ ] In `types.rs`: keep `PlayerBalance` in `TickResult` but rename field to `player_results` or remove if lifecycle.rs doesn't use it
- [ ] In `resolver.rs`: update all `player.stake_per_tick` references to `player.deposit`
- [ ] In `settlement.rs`: update `TickResult` construction if field names changed
- [ ] In `chain_listener.rs`: update `stake_per_tick` field mapping + SQL column references

#### Task 21: Fix contracts — stakePerTick sentinel + collectFees + isVirtual

Plan Task 1-2 miss these:

- [ ] In `joinBatchDirect()`: change `stakePerTick != 0` check to `joinTimestamp != 0`
- [ ] In `updateBitmap()`: change `stakePerTick == 0` check to `joinTimestamp == 0`
- [ ] In `updateBitmap()`: remove `_promoteConfigIfNeeded()` call (line 454)
- [ ] Delete `collectFees()` dual-balance routing or rewrite for direct USDC
- [ ] Delete `balanceOf()` (reads deleted `realBalance + virtualBalance`)
- [ ] Delete `accumulatedVirtualFees` state variable
- [ ] Remove `isVirtual` routing from `settleBatch()` (lines 849-864)
- [ ] Delete `forceWithdraw()` (missing from Task 2 delete list)
- [ ] Delete `PlayerPosition.startTick`, `lastClaimedTick`, `isVirtual`, `balance` struct fields from IVision.sol
- [ ] Delete Batch struct fields: `nextConfigHash`, `nextLockOffset`, `nextTickDuration`, `epochOffset`, `lastPromotionTick`
- [ ] Rewrite `VisionBatch.t.sol` (15+ tests call deleted functions)

#### Task 22: Fix frontend — additional deletes + ABI

- [ ] DELETE: `DepositModal.tsx`, `ExpandedBatch.tsx`, `MyPositions.tsx`
- [ ] DELETE: `useWithdraw.ts`, `useBacktest.ts`, `useDepositStatus.ts`, `useBatchHistory.ts`, `usePlayerBatches.ts`
- [ ] DELETE: `frontend/lib/vision/tick.ts`
- [ ] REFACTOR: `VisionBalanceBar.tsx` — replace `useVisionBalance` with wallet USDC balance, remove deleted modal imports
- [ ] REFACTOR: `Header.tsx` — handle VisionBalanceBar changes
- [ ] REFACTOR: Profile subsystem (6 files in `frontend/components/domain/profile/`) — replace tick-based display with round-based
- [ ] REGENERATE: `frontend/lib/contracts/vision-abi.ts` from updated contract (add `joinBatchDirect`, remove 15+ deleted functions)
- [ ] ADD: USDC `approve` step in `useJoinBatch.ts` before `joinBatchDirect` (safeTransferFrom requires approval)
- [ ] CLEAN: `MarketsTable.tsx`, `CompactVisualTab.tsx`, `VisualTab.tsx`, `MarketAccordion.tsx`, `NextBatches.tsx` — remove `useBatchHistory` imports
- [ ] CLEAN: i18n — remove ~100 dead keys from `vision.json` across 4 locales

#### Task 23: Fix vision-bot

- [ ] Rewrite `vision-bot/framework/chain.py` — remove `claimRewards`, `depositBalance`, `withdrawBalance` ABIs and methods; add `joinBatchDirect` ABI
- [ ] Rewrite `vision-bot/framework/tracker.py` — remove `_try_claim()`, remove auto-claim/auto-withdraw logic
- [ ] Update `vision-bot/config.toml` and `docker/testnet/vision-swarm/config.toml` — remove `auto_claim`, `auto_withdraw`, `claim_above`, `withdraw_below`
- [ ] Update bot tests

#### Task 24: Fix scripts + E2E helpers

- [ ] Rewrite `scripts/vision-bots.ts` — remove deleted ABI entries and function calls
- [ ] Update `frontend/e2e/helpers/vision-api.ts` — rewrite `fullJoinBatch()` to use `joinBatchDirect`, remove `depositToVisionBalance`, `getVisionRealBalance`, `getVisionVirtualBalance`
- [ ] Update `frontend/e2e/helpers/swarm-api.ts` — remove `stakePerTick`, `realBalance`, `virtualBalance` ABIs
- [ ] Delete or rewrite E2E tests: 12, 13, 15, 19, 20, 29, 33, 41, 43 (plus the 4 already listed)

#### Task 25: Fix cross-cutting contracts

- [ ] Clean `contracts/src/interfaces/IBridge.sol` — remove `depositToVision`, `completeVisionDeposit`, `refundVisionDeposit`, `completeVisionWithdraw`, `getVisionDeposit`, `visionReserve` (or mark as settlement-only if bridge still needed)
- [ ] Clean `contracts/src/custody/SettlementBridgeCustody.sol` — remove Vision deposit/withdraw functions if dual-balance is deleted
- [ ] Clean `contracts/src/libraries/TypesLib.sol` — remove `VisionDeposit` struct
- [ ] Clean `contracts/src/libraries/ErrorsLib.sol` — remove Vision deposit error codes

#### Task 26: Database migration update

Add to `oracle/migrations/010_drop_continuous_tables.sql`:
- [ ] `DROP TABLE IF EXISTS vision_batch_state CASCADE;` (missing from original)
- [ ] `DROP TABLE IF EXISTS vision_last_resolved CASCADE;` (used by tick_scheduler)
- [ ] `ALTER TABLE vision_positions DROP COLUMN IF EXISTS balance;` (continuous running balance)
- [ ] `ALTER TABLE vision_positions RENAME COLUMN stake_per_tick TO deposit;` (if renaming)

---

## Updated Summary

| Chunk | Tasks | Lines Deleted | Lines Created |
|-------|-------|--------------|--------------|
| 1: Contracts | 1-3, 21, 25 | ~1,200 | ~200 (tests) |
| 2: Oracle | 4-10, 17-20, 26 | ~7,500 | ~300 (shared.rs, migration) |
| 3: Frontend | 11-13, 22, 24 | ~3,500 | ~400 (refactored components) |
| 4: Cross-cutting | 23, 24 | ~500 | ~200 (bot rewrite) |
| 5: Deploy | 14-16 | — | — |
| **Total** | **26** | **~12,700** | **~1,100** |

Net: **-11,600 lines**. The original plan missed ~4,000 lines of deletion across the consensus layer, P2P types, frontend components, vision-bot, and scripts.

---

## Addendum 2: Round 2 Audit Consensus (6/6 FAIL → gaps closed)

### Resolution 1: stakePerTick — FINAL DECISION

**Rename to `deposit` everywhere. Sentinel = `deposit != 0`.** Do NOT use `joinTimestamp`.

- Solidity: keep `stakePerTick` parameter name in `joinBatchDirect()` (matches spec) but rename struct field to `deposit` in `PlayerPosition`
- Oracle Rust: rename `stake_per_tick` → `deposit` in `PlayerPosition`
- Frontend: rename in ABI, hooks, E2E helpers
- Sentinel check: `deposit != 0` (not `joinTimestamp != 0`)
- Update Tasks 1, 8, 20, 21 accordingly — they now all say the same thing

### Resolution 2: Migration 001-004 recreate dropped tables

Add to Task 26: null out the continuous table CREATE statements in migrations 001-004 by adding `-- PURGED: round-only migration 010 dropped these` comments. Or: consolidate into a single `000_reset.sql` that runs all creates for surviving tables only.

### Resolution 3: Tasks 11+22 merged into single frontend purge

Tasks 11 and 22 execute as ONE atomic operation. No intermediate `tsc --noEmit` between them.

### Additional files to add to delete/refactor lists:

#### Oracle:
- DELETE: `_joinBatch()` internal helper in Vision.sol (references deleted `_debitBalance()`)
- DELETE: `IVision.sol` getter function signatures for deleted state vars (`realBalance`, `virtualBalance`, `totalRealBalance`, `totalVirtualBalance`, `accumulatedVirtualFees`, `depositProcessed`, `withdrawNonce`)
- DECIDE: `collectFees()` → rewrite to transfer `accumulatedRealFees` directly via `safeTransfer`, delete `accumulatedVirtualFees` routing
- DECIDE: Bitmap gossip → lifecycle.rs needs `IncomingBitmapGossip` channel OR delete `ProcessBitmap*` dispatch arms from `protocol.rs`/`messages.rs`. Decision: DELETE bitmap gossip P2P entirely — lifecycle manager fetches bitmaps from DB, not P2P gossip.
- CLEAN: `settlement_writer.rs:1608-1658` — dead `ChainWriter` adapter for deposit watcher

#### Frontend:
- DELETE: `hooks/vision/useVisionPoints.ts` (imports deleted `usePlayerBatches`)
- REFACTOR: `app/[locale]/points/PointsPageClient.tsx` — remove `useVisionPoints` import
- CLEAN: `components/domain/vision/sources/NextBatches.tsx` — remove `tick.ts` imports
- CLEAN: `lib/vision/bitmap-store.ts` — remove `BatchHistoryEntry` type import
- REGENERATE: `vision-abi.ts` — must include `joinBatchDirect` with updated `PlayerPosition` struct (field `deposit` instead of `stakePerTick`)
- REWRITE: `joinRoundDirect()` in `vision-api.ts` → approve USDC, then call `joinBatchDirect(batchId, configHash, deposit, deposit, bitmapHash)`
- UPDATE: `VISION_GET_BATCH_ABI` — remove deleted struct fields from tuple definition
- UPDATE: `VISION_POSITION_ABI` — remove `startTick`, `balance`, `lastClaimedTick`, `isVirtual`, rename `stakePerTick` → `deposit`
- REWRITE: `verifySolvency()` in `swarm-api.ts` — check `USDC.balanceOf(Vision) >= sum(active deposits)`

#### E2E tests explicit delete list:
DELETE these test files (they test deleted flows):
- `12-vision-deposit.spec.ts`
- `19-vision-settlement-bridge-deposit.spec.ts`
- `20-vision-settlement-withdraw.spec.ts`
- `33-vision-positions.spec.ts`

REWRITE these (adapt to round-based):
- `13-vision-enter-batch.spec.ts` — use `joinBatchDirect`, check `deposit != 0`
- `14-vision-claim-withdraw.spec.ts` — settlement sends USDC to wallet, no manual claim
- `25-vision-tick-resolution.spec.ts` → rename to round-resolution, check wallet USDC after settle
- `29-faucet.spec.ts` — mint USDC to wallet (no BalanceDepositModal)
- `41-vision-round-lifecycle.spec.ts` — check wallet USDC balance after settlement (not realBalance)
- `43-vision-concurrent-rounds.spec.ts` — same

#### Vision-bot additions to Task 23:
- REWRITE: `bot.py` — remove `round_based` flag, make `joinBatchDirect` the only path
- DELETE: `AGENTS.md` continuous-model documentation (rewrite for round-based)
- CLEAN: `framework/core.py` — remove `auto_claim`, `auto_withdraw`, `STAKE_PER_TICK` defaults
- CLEAN: `docker/testnet/vision-swarm/swarm.env.example` — remove `STAKE_PER_TICK`
- CLEAN: `docker/testnet/vision-swarm/config.toml` — remove claim/withdraw config keys

#### Scripts additions to Task 24:
- DELETE or REWRITE: `scripts/fix-null-bitmaps.py`, `scripts/force-withdraw-poisoned.ts`, `scripts/recover-poisoned-positions.py`

#### testnet.sh additions to Task 9:
- UPDATE: DB truncation list at line 872 — remove references to dropped tables
- REMOVE: `--vision-reveal-window-secs` and `--vision-tick-poll-interval-ms` from `_oracle_command_yaml()`

### Updated totals after Round 2:

| Metric | Original Plan | After Round 1 Audit | After Round 2 Audit |
|--------|--------------|--------------------|--------------------|
| Tasks | 16 | 26 | 26 (expanded scope) |
| Files to delete | ~15 | ~25 | ~30 |
| Files to refactor | ~15 | ~25 | ~35 |
| Lines deleted | ~7,600 | ~11,600 | ~12,500 |
| Lines created | ~700 | ~1,100 | ~1,200 |
| Net | -6,900 | -10,500 | -11,300 |
