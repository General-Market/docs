# Vision Continuous Betting — Design Spec

## Goal

Replace the current lock-window + multiplier betting model with a continuous next-tick betting model. Remove static `vision-batches.json`. Make batch configs dynamic (markets change per tick automatically).

## Core Model

**Current**: Bet on tick N during tick N. Lock window prevents late changes. Multiplier rewards early bets. Static batch config.

**New**: Bet on tick N+1 during tick N. No lock window. No multiplier. Bets reset each tick. Dynamic market config per tick.

### Tick Lifecycle

```
Tick N running (prices being measured for resolution)
│
├─ Players submit/modify bitmaps → pending for tick N+1
├─ Tick N ends → resolve using ACTIVE bitmaps (submitted during N-1)
├─ Payouts applied (winners gain, losers lose, sitters unchanged)
├─ Pending bitmaps (submitted during N) promoted to active for N+1
├─ Pending slot cleared
│
Tick N+1 starts
├─ Active bets (from N) are being resolved
├─ Players submit new bitmaps for N+2
├─ Players who did NOT submit during N sit out (balance untouched)
```

### What's Removed

- **Multiplier** — all stakes weighted equally, no early-entry advantage
- **Lock window** — `lockOffset = 0`, players can submit/change bets anytime
- **vision-batches.json** — frontend uses live API data only
- **Static batch IDs** — frontend matches batches by sourceId from proxy, not hardcoded IDs

### What Stays

- Parimutuel settlement (losers fund winners)
- BLS consensus for tick resolution and withdrawals
- Deposit/withdraw flow (Vision balance → batch position)
- Bitmap UP/DOWN per market
- `stakePerTick` — fixed amount at risk each active tick
- Per-batch tick duration (immutable per batch, varies by source category)

---

## Changes by Layer

### 1. Issuer — Resolver (`issuer/src/vision/resolver.rs`)

**Remove multiplier calculation.** Currently the resolver computes a multiplier based on:
- How early in the tick the player submitted (time-based)
- Commitment level (balance coverage)

Replace with flat weighting: every active player's `stakePerTick` counts equally.

**Two-slot bitmap model.** Per player per batch:
- `pending_bitmap`: what the player submitted during the current tick (for next tick)
- `active_bitmap`: what's being used for current tick resolution (submitted during previous tick)

At tick resolution:
1. Resolve current tick using `active_bitmap` for each player
2. Players without `active_bitmap` → sit out (balance unchanged)
3. Promote: `active_bitmap = pending_bitmap` for each player
4. Clear: `pending_bitmap = None`

**Bitmap submission timestamp tracking.** The issuer already stores bitmaps in memory. Add a `submitted_at_tick` field so the resolver knows which tick the bitmap targets:
- If `submitted_at_tick == current_tick` → this is a pending bitmap (for next tick)
- If `submitted_at_tick == current_tick - 1` → this was promoted and is now active

Simpler approach: just maintain two HashMaps per batch:
```rust
pending_bitmaps: HashMap<Address, (H256, Vec<u8>)>  // hash + data
active_bitmaps: HashMap<Address, (H256, Vec<u8>)>
```

Flip at tick boundary during resolution.

### 2. Issuer — Config Orchestrator (`issuer/src/vision/batch_config_orchestrator.rs`)

**Run every tick** (currently runs on a 120s interval). For each batch:
1. Query data-node: `GET /vision/recommended-config?source={sourceId}`
2. If config hash differs from current batch config → propose update
3. BLS consensus among issuers on new config
4. Call `updateBatchConfig()` on-chain
5. Lazy promotion at next tick boundary (already in contract)

**Interval**: Match to tick duration per batch. 600s batches check every 600s. 300s batches check every 300s. Can keep the existing 120s interval and batch all checks — any batch whose tick boundary is approaching gets a config check.

**Failure mode**: If config update fails (BLS quorum not reached, RPC down), current config persists. No harm — markets just stay the same for another tick.

### 3. Issuer — Tick Engine (`issuer/src/vision/engine.rs`)

**Remove multiplier from PnL calculation.** The `TickResolver` currently:
1. Computes time-based multiplier per player
2. Applies multiplier to stake for weighting
3. Runs parimutuel matching with weighted stakes

Change to:
1. Skip multiplier computation
2. Use raw `stakePerTick` for weighting
3. Run parimutuel matching with flat stakes

**Add bitmap flip to resolution cycle.** After resolving tick N:
1. Compute payouts (existing logic minus multiplier)
2. Flip bitmaps: `active = pending`, `pending = cleared`
3. Publish results via BLS consensus (existing flow)

### 4. Contract — Vision.sol (minimal)

**No code changes required.** All behavioral changes are issuer-side.

- `lockOffset = 0`: Set via `updateBatchConfig()` for all 43 batches (one-time config push)
- `_requireNotLocked` check in `updateBitmap()`: becomes a no-op when `lockOffset = 0`
- Bitmap hash on-chain: still stores player's latest `bitmapHash`. The issuer decides whether it's "pending" or "active" — the contract doesn't distinguish.

**One-time migration**: Call `updateBatchConfig(batchId, currentConfigHash, 0, blsSig, nonce, bitmask)` for each batch to set `lockOffset = 0`. Issuers sign the update. Can be done in a single script.

### 5. Frontend — Remove Static Dependencies

**Delete `frontend/lib/contracts/vision-batches.json`.**

All batch data comes from live API:
- `useBatches()` hook → `GET /api/vision/batches` → issuer API
- Proxy already deduplicates to latest batch per source via configHash

**Update `BatchEntryPanel.tsx`:**
- Remove `staticBatchId` / `staticEntry` fallback logic
- Match batch by sourceId from live API only
- If API returns no batch for this source → show "No active batch" instead of fake zeros

**Update `SourceDetail.tsx`:**
- Same: remove static fallback, use live data only

### 6. Frontend — Remove Multiplier UI

**Files to clean up:**
- `frontend/lib/vision/tick.ts` — remove `getMultiplier()`, `lockOffset` from `getBatchTickState()`
- `frontend/components/domain/vision/detail/SourceDetail.tsx` — remove Multiplier column from batch bar
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` — remove multiplier display, lock state warnings
- `frontend/hooks/vision/useBitmapEditor.ts` — no changes needed (bitmap UP/DOWN stays)

### 7. Frontend — Continuous Betting UX

**BatchEntryPanel changes:**
- Always open for submissions (no "locked" disabled state)
- Header: "Set predictions for next tick" (not "Enter Batch")
- After submit: "Your bets are set for tick N+1" confirmation
- Show active status: "You have active bets on tick N" when participating
- Show sit-out status: "No bets set — sitting out this tick" when player didn't submit
- Timer shows: "Tick N resolves in X:XX — betting open for tick N+1"

**Batch status bar (SourceDetail) changes:**
- Remove MULTIPLIER column
- Remove lock state styling (red timer, locked text)
- Timer is just a countdown, no lock phase
- Consider adding: "ACTIVE BETTORS" count (players with active bitmaps for current tick)

### 8. Frontend — Remove vision-batches.json Consumers

**Files referencing vision-batches.json:**
- `frontend/components/domain/vision/detail/SourceDetail.tsx` — static batch lookup
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` — static batchId
- `frontend/app/api/vision/batches/route.ts` — configHash→source reverse lookup
- `contracts/script/DeployAllVisionBatches.s.sol` — generates the file (keep for deploy, but frontend stops reading it)

The API proxy route (`/api/vision/batches`) still needs configHash→source mapping. Move this to the issuer API response: issuers already know which source each batch belongs to (from `source_id` field). The proxy just passes it through — no static file needed.

### 9. Data-node — Config Recommendations

**Ensure endpoint exists**: `GET /vision/recommended-config?source={sourceId}`

Returns:
```json
{
  "configHash": "0x...",
  "markets": [
    { "assetId": "bitcoin", "resolutionType": "up_x", "thresholdBps": 200 }
  ],
  "tickDuration": 600,
  "lockOffset": 0
}
```

Data-node generates this from its source-specific data collection. Markets can change based on:
- Data availability (source API up/down)
- New assets added to a source
- Seasonal relevance (e.g., sports seasons, market hours)

The issuer config orchestrator calls this and proposes updates when the hash changes.

---

## Migration Plan

1. **Deploy issuer changes first** (resolver, bitmap model, config orchestrator)
2. **Push lockOffset=0** for all batches via BLS-signed `updateBatchConfig()` calls
3. **Deploy frontend** (remove static deps, multiplier UI, add next-tick UX)
4. **No contract deployment needed** — all behavioral changes are off-chain

Player positions are unaffected. Existing balances carry over. The transition happens at a tick boundary — old model resolves the last tick, new model starts from the next one.

---

## Testing

- **Issuer unit tests**: Resolver without multiplier, bitmap flip logic, sit-out handling
- **Integration test**: Full tick lifecycle — submit pending, resolve, flip, verify sit-out
- **E2E**: Player submits bet, waits for tick, verifies payout without multiplier
- **Config orchestrator**: Mock data-node returns new config → verify on-chain update
- **Frontend**: Verify no references to vision-batches.json, multiplier UI gone, continuous betting UX works

---

## What Gets Deleted

| Component | Deleted |
|-----------|---------|
| `vision-batches.json` | Frontend dependency removed (file kept for deploy scripts) |
| Multiplier math | Issuer resolver, frontend display |
| Lock window logic | Issuer, frontend timer/UI |
| `getMultiplier()` | `frontend/lib/vision/tick.ts` |
| Lock countdown | SourceDetail, BatchEntryPanel |
| Static batch fallback | BatchEntryPanel, SourceDetail |
| Early-entry incentive | Entire concept removed |

## What Stays

| Component | Unchanged |
|-----------|-----------|
| Vision.sol contract | No code changes |
| Parimutuel settlement | Same matching logic |
| BLS consensus | Same signing/verification |
| Deposit/withdraw | Same flow |
| Bitmap UP/DOWN | Same per-market bets |
| stakePerTick | Same risk model |
| Per-source tick duration | Same (600s, 300s, 86400s etc.) |
