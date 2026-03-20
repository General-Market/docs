# Round-Based Batches: Implementation Plan

> Session: 20260319
> Design doc: `docs/plans/2026-03-17-vision-round-based-batches.md`

The current model: one permanent batch per source, infinite tick resolution, manual claim/withdraw. The target: ephemeral batches that live one round, auto-settle, and die. Both models coexist in the same contract. The migration is additive, not destructive.

---

## Current State Summary

**Contract** (`Vision.sol`): Already has `joinBatchDirect()`, `settleBatch()`, and `latestBatchForSource` (non-unique mapping). Source uniqueness constraint was already removed from `_createBatch()`. The contract is ~90% ready.

**Oracle** (`engine.rs`): Tick engine polls scheduler for due ticks, resolves them via `TickResolver`, signs balance proofs per-player, and broadcasts via P2P. No concept of "batch lifecycle" or auto-settlement. Config fetched from data-node by hash, cached 55s.

**Data-node** (`batch_engine.rs`): Generates one `BatchConfig` per source with `compute_config_hash()`. Serves via `/batches/recommended` and `/batches/config/:hash`. No round tracking, no per-round config generation.

**Bot** (`bot.py`): Dual-balance flow: `approve_usdc` -> `deposit_balance` -> `joinBatch`. Tracks positions via `Tracker`. Has stub `check_rounds()` in tracker. No direct-deposit support.

**Frontend** (`SourceDetail.tsx`): One batch per source. Shows tick timer, entry panel, markets. No round history, no settlement display.

---

## Phase 1: Oracle BatchLifecycleManager (MVP)

The oracle is the bottleneck. Everything else adapts to what the oracle does. Build the lifecycle manager first, test with a single source, expand later.

### Task 1.1: Oracle migration + DB schema

**What:** New `vision_batch_lifecycle` table for round tracking. New `vision_round_players` table for settlement history.

**Files:**
- `oracle/migrations/004_create_batch_lifecycle.sql` (new)

**Schema:** As specified in the design doc.

**Complexity:** S
**Dependencies:** None
**Incremental:** Yes — migration runs alongside existing tables.

---

### Task 1.2: BatchLifecycleManager skeleton

**What:** New module `oracle/src/vision/lifecycle.rs` that runs per source on a `tickDuration` heartbeat. Core loop:

```
Every T seconds per source:
  1. Create new batch on-chain (createBatch with BLS sig)
  2. If previous batch exists and betting ended:
     a. Fetch prices
     b. Compute outcomes (reuse TickResolver)
     c. Compute payouts per player (new: parimutuel settlement)
     d. BLS-sign (players[], payouts[]) hash
     e. Call settleBatch on-chain
  3. Record lifecycle in DB
```

The lifecycle manager replaces the tick engine for round-based sources. Permanent sources still use the existing tick engine.

**Files:**
- `oracle/src/vision/lifecycle.rs` (new, ~400 lines)
- `oracle/src/vision/mod.rs` (add module)
- `oracle/src/vision/config.rs` (add `round_based_sources: Vec<String>` config field)

**Key design decisions:**
- Lifecycle manager runs as a separate `tokio::spawn` alongside the tick engine
- Sources listed in `round_based_sources` config are handled by lifecycle manager, all others by tick engine
- Lifecycle manager fetches fresh config from data-node at each round start (the whole point)
- Settlement uses existing `TickResolver::resolve()` to compute outcomes, then computes payouts from outcomes + player deposits (new logic)

**Complexity:** L
**Dependencies:** 1.1
**Incremental:** Yes — controlled via config. Empty `round_based_sources` means lifecycle manager is a no-op.

---

### Task 1.3: Settlement payout computation

**What:** Given tick resolution results (per-market outcomes) and player positions (bitmap + deposit + stake), compute the payout for each player. This is the new piece — the current model tracks running balances, round-based needs a final payout.

Logic:
```
For each market:
  winners = players who predicted correctly
  losers = players who predicted incorrectly
  pot = sum(all stakes for this market)
  winner_share = pot / sum(winner_stakes)  [or refund if no winners]

Total payout per player = sum of their share across all markets
Bounded: total_payouts <= total_deposits (zero-sum)
```

**Files:**
- `oracle/src/vision/settlement.rs` (new, ~200 lines)
- Tests within the same file

**Complexity:** M
**Dependencies:** None (pure computation, no I/O)
**Incremental:** Yes — standalone module.

---

### Task 1.4: On-chain settlement transaction

**What:** The lifecycle manager must call `settleBatch()` on-chain after BLS consensus on the (players[], payouts[]) hash.

The BLS message is:
```
keccak256(abi.encode(chainId, visionAddress, "SETTLE_BATCH", batchId, keccak256(abi.encode(players, payouts))))
```

This requires the oracle's chain writer to support the new `settleBatch` function call.

**Files:**
- `oracle/src/chain/writer.rs` (add `settle_batch()` method)
- `common/src/adapters/rpc_chain_reader.rs` (may need ABI updates)
- `frontend/lib/contracts/vision-abi.ts` (already has `settleBatch` in ABI)

**Complexity:** M
**Dependencies:** 1.2, 1.3
**Incremental:** Yes — new method, doesn't touch existing writer functions.

---

### Task 1.5: On-chain batch creation from oracle

**What:** The lifecycle manager must call `createBatch()` on-chain to start each new round. Currently, batch creation happens via the batch config orchestrator (consensus among oracles on config, then one oracle calls `createBatch`). For round-based flow, this must happen on a timer per source.

The existing `batch_config_orchestrator.rs` already handles BLS consensus for batch creation. Extend it to support periodic creation (not just one-time).

**Files:**
- `oracle/src/vision/batch_config_orchestrator.rs` (add `create_round_batch()` function)
- `oracle/src/vision/lifecycle.rs` (call it)

**Complexity:** M
**Dependencies:** 1.2
**Incremental:** Yes.

---

## Phase 2: Data-Node Round Support

### Task 2.1: Per-round config generation

**What:** Currently `batch_engine.rs` generates one config per source. For round-based mode, the data-node must generate a fresh config each time the oracle requests one (at round start). The existing `/batches/recommended` endpoint already does this — it returns the latest config per source. The oracle just needs to call it at each round start instead of caching across rounds.

No data-node changes needed for MVP. The existing `compute_config_hash()` already produces deterministic hashes from current market state. Each call returns the latest config reflecting current healthy assets and thresholds.

**What actually changes:** The oracle's lifecycle manager calls `/batches/recommended` at each round start (Task 1.2 already does this). The 55s `CONFIG_CACHE_TTL` in `engine.rs` must NOT apply to the lifecycle manager — it needs fresh configs.

**Files:**
- No data-node changes for MVP

**Complexity:** S (no-op for data-node, config cache bypass in oracle)
**Dependencies:** 1.2
**Incremental:** Yes.

---

### Task 2.2: Round tracking API endpoints

**What:** New API endpoints on the oracle for frontend/bot consumption:

- `GET /vision/rounds?source=X&timeframe=T` — list rounds for source
- `GET /vision/rounds/active` — all currently betting rounds
- `GET /vision/rounds/:batchId/results` — settlement results
- `GET /vision/rounds/:batchId/bitmaps` — decoded player predictions

These read from the `vision_batch_lifecycle` and `vision_round_players` DB tables.

**Files:**
- `oracle/src/vision/api.rs` (add round endpoints)
- `oracle/src/api/mod.rs` (register routes)

**Complexity:** M
**Dependencies:** 1.1, 1.2 (need populated tables)
**Incremental:** Yes — new routes, old routes untouched.

---

## Phase 3: Contract Hardening

### Task 3.1: Solvency check in settleBatch

**What:** The current `settleBatch()` in `Vision.sol` already has a solvency check (`totalPayouts <= totalDeposits`) and strictly ascending player addresses to prevent duplicates. Review and add:

- Ensure batch is not already settled (`b.paused` check exists)
- Ensure betting window has elapsed (currently no time check — oracle is trusted via BLS)
- Gas optimization: consider maximum player count per settlement tx

**Files:**
- `contracts/src/vision/Vision.sol` (minor review/tighten)
- `contracts/test/Vision.t.sol` (add settlement tests)

**Complexity:** S
**Dependencies:** None
**Incremental:** Yes.

---

### Task 3.2: settleBatch direct USDC transfer variant

**What:** The design doc proposes `settleBatch` sending USDC directly to player wallets. The current implementation credits `realBalance`/`virtualBalance` instead (safer — no DoS from reverting recipients). This is a deliberate design choice that should be preserved.

The current approach is superior: credit to balance, let players withdraw. No contract changes needed here.

**Decision:** Keep current `settleBatch` behavior (credits balance). Document the rationale.

**Complexity:** S (no code change, just documentation)
**Dependencies:** None

---

## Phase 4: Frontend

### Task 4.1: Round-based batch list view

**What:** Replace "one batch per source" with a grouped view: source -> timeframe -> current round state (Betting/Locked/Settling/Settled). Uses the new `/vision/rounds/active` endpoint.

**Files:**
- `frontend/components/domain/vision/detail/SourceDetail.tsx` (add round states)
- `frontend/hooks/vision/useBatches.ts` (add `useRounds()` hook)
- `frontend/hooks/vision/useRounds.ts` (new)

**Complexity:** M
**Dependencies:** 2.2 (needs round API)
**Incremental:** Yes — can coexist with old view. Show round view for round-based sources, old view for permanent sources.

---

### Task 4.2: Settlement results display

**What:** After a round settles, show the results: per-market outcomes, per-player predictions (decoded bitmaps), correct/incorrect, PnL.

**Files:**
- `frontend/components/domain/vision/detail/RoundResults.tsx` (new)
- `frontend/hooks/vision/useRoundResults.ts` (new)

**Complexity:** M
**Dependencies:** 2.2, 4.1
**Incremental:** Yes.

---

### Task 4.3: Auto-join prompt

**What:** When a round settles and the player was participating, prompt: "Round settled. +$X.XX. Join next round?" If auto-join is enabled, submit `joinBatchDirect` automatically.

Watch for `BatchSettled` events via SSE or polling.

**Files:**
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` (add auto-join toggle)
- `frontend/hooks/vision/useAutoJoin.ts` (new)
- `frontend/hooks/useSSE.tsx` (add `BatchSettled` event type)

**Complexity:** M
**Dependencies:** 4.1, 4.2
**Incremental:** Yes.

---

## Phase 5: Bot

### Task 5.1: Direct deposit flow

**What:** Switch from dual-balance (`deposit_balance` -> `joinBatch`) to direct (`approve_usdc` -> `joinBatchDirect`). The bot must also detect settlement via USDC returning to wallet or via the round API.

**Files:**
- `vision-bot/framework/chain.py` (add `join_batch_direct()` method)
- `vision-bot/bot.py` (use direct flow for round-based batches)
- `vision-bot/framework/tracker.py` (settlement detection via round API)

**Complexity:** M
**Dependencies:** 2.2 (needs round API for settlement detection)
**Incremental:** Yes — `round_based` config flag already exists in bot.

---

### Task 5.2: Per-round join cycle

**What:** Instead of joining once and staying forever, the bot must:
1. Poll `/vision/rounds/active` for new betting rounds
2. For each subscribed source/timeframe, check if a new round is available
3. Approve + join via `joinBatchDirect`
4. Submit bitmap
5. Wait for settlement (USDC returns to balance)
6. Repeat

**Files:**
- `vision-bot/framework/tracker.py` (flesh out `check_rounds()`)
- `vision-bot/config.toml` (add `round_subscriptions` config)

**Complexity:** M
**Dependencies:** 5.1, 2.2
**Incremental:** Yes — controlled by `round_based` config flag.

---

## Execution Order (2-3 Sessions)

### Session 1: Oracle Core (Tasks 1.1 → 1.5)

Priority: Get one source creating rounds and settling them on-chain.

1. **1.1** — DB migration (15 min)
2. **1.3** — Settlement payout computation (1 hr) — pure logic, no dependencies, can test immediately
3. **1.2** — BatchLifecycleManager skeleton (2 hr) — the big piece
4. **1.5** — Batch creation from oracle (1 hr)
5. **1.4** — On-chain settlement tx (1 hr)

Test: Deploy to testnet. One source (`crypto`) in round-based mode, 5-minute rounds. Watch logs: batch created -> players join -> tick resolves -> settlement tx lands -> USDC credited.

### Session 2: APIs + Bot (Tasks 2.1 → 2.2, 5.1 → 5.2)

Priority: External consumers can interact with rounds.

1. **2.1** — Config cache bypass (15 min)
2. **2.2** — Round tracking API endpoints (1.5 hr)
3. **5.1** — Bot direct deposit flow (45 min)
4. **5.2** — Per-round join cycle (1 hr)
5. **3.1** — Contract hardening review (30 min)

Test: Bot joins round-based crypto batch, submits bitmap, gets settled automatically, joins next round.

### Session 3: Frontend (Tasks 4.1 → 4.3)

Priority: Users see round states and results.

1. **4.1** — Round-based batch list view (1.5 hr)
2. **4.2** — Settlement results display (1.5 hr)
3. **4.3** — Auto-join prompt (1 hr)

Test: Open source detail page, see round countdown, see settlement results, toggle auto-join.

---

## Minimum Viable Subset

If time is brutally constrained, the absolute minimum to get fresh configs per round:

1. **1.1** — DB migration
2. **1.2** — Lifecycle manager (simplified: create batch + update config per round, skip auto-settlement)
3. **1.5** — Batch creation

This gets new batches with fresh configs created every T seconds. Settlement remains manual (players claim/withdraw as before). The round just refreshes the market list and thresholds each cycle.

This is achievable in one session. Auto-settlement (Tasks 1.3, 1.4) adds the real payoff but can be deferred.

---

## Flag Day vs Incremental

Every task is incremental. Both models coexist:

- **Config:** `round_based_sources: ["crypto", "weather"]` in oracle config controls which sources use lifecycle manager
- **Contract:** `joinBatch` (dual-balance) and `joinBatchDirect` (direct USDC) coexist. `settleBatch` is additive.
- **Bot:** `round_based: true` config flag already exists
- **Frontend:** detect source mode from API (round-based sources have `GET /vision/rounds/active` entries)

No flag day. No migration of existing batches. Old batches keep running until their source is switched to round-based mode.

---

## Risks

1. **BLS nonce exhaustion:** Each round consumes a BLS nonce for `createBatch` and another for `settleBatch`. At 70 sources * 12 rounds/hour, that is 1,680 nonces/hour. The BLSVerifier's 256-nonce sliding window must accommodate this. May need to increase the window or batch multiple source creations under one nonce.

2. **Gas costs:** Each `settleBatch` call transfers USDC to N players. At 100 players, that is ~100 transfers per round per source. Gas budget must be estimated and capped.

3. **Storage bloat:** Each round creates a new Batch struct on-chain. At 20k batches/day, storage grows fast. The contract should zero-out settled batch storage (`delete _batches[batchId]`) to reclaim gas via SSTORE refunds. Not in current `settleBatch` — needs adding.

4. **Consensus timing:** The lifecycle manager must coordinate batch creation BLS signing across oracles. If one oracle is slow, the round starts late. Existing `batch_config_orchestrator` handles this, but must be tested at higher frequency.
