# Vision Continuous Betting — Design Spec

## Goal

Replace the current lock-window + multiplier betting model with a continuous next-tick betting model. Remove static `vision-batches.json`. Remove hardcoded `VISION_SOURCES` frontend registry. Make batch configs dynamic (markets change per tick automatically). Load all source metadata from data-node so new sources can be added on the fly without frontend deploys.

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
- **Manual batch registration** — issuers auto-detect new batches from chain events
- **vision-batches.json** — frontend uses live API data only
- **Static batch IDs** — frontend matches batches by sourceId from proxy, not hardcoded IDs
- **Hardcoded `VISION_SOURCES`** — source metadata (name, logo, description, category) loaded from data-node API
- **Hardcoded `CATEGORY_GROUPS`** — market grid categories derived from live data

### What Stays

- Parimutuel settlement (losers fund winners)
- BLS consensus for tick resolution and withdrawals
- Deposit/withdraw flow (Vision balance → batch position)
- Bitmap UP/DOWN per market
- `stakePerTick` — fixed amount at risk each active tick
- Per-batch tick duration (varies by source category, set per config update)
- **Commit-reveal bitmap model** — player commits hash on-chain before revealing to issuers (bet privacy preserved)

---

## Dataflow — Current System

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATA COLLECTION                                                     │
│                                                                      │
│  CoinGecko, Finnhub, NOAA, etc. ──→ DATA-NODE (Postgres)           │
│                                      ├─ GET /vision/snapshot        │
│                                      ├─ GET /batches/recommended    │
│                                      └─ GET /batches/config/{hash}  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  BATCH SETUP (manual, one-time)                                      │
│                                                                      │
│  DeployAllVisionBatches.s.sol                                        │
│  ├─ Deploys 43 batches on Vision.sol                                 │
│  ├─ Generates vision-batches.json (batchId, configHash, lockOffset) │
│  └─ Frontend ships with this file baked in                           │
│                                                                      │
│  ⚠ Adding a source = redeploy batches + update JSON + frontend deploy│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE REGISTRY (hardcoded in frontend)                             │
│                                                                      │
│  sources.ts → VISION_SOURCES (75 entries: name, logo, category)     │
│  market-categories.ts → PREFIX_MAP (60+ prefixes)                   │
│  VisionMarketsGrid.tsx → CATEGORY_GROUPS (14 display groups)        │
│                                                                      │
│  ⚠ Adding a source = frontend code change + deploy                   │
└─────────────────────────────────────────────────────────────────────┘

PLAYER BETTING FLOW (tick N):

  Player                        Frontend              Issuer              Vision.sol
    │                              │                     │                     │
    │  1. View markets             │                     │                     │
    │─────────────────────────────→│                     │                     │
    │                              │  GET /api/snapshot  │                     │
    │                              │────────────────────→│ (data-node)        │
    │                              │←───── prices ───────│                     │
    │←──── prices ─────────────────│                     │                     │
    │                              │                     │                     │
    │  2. Choose UP/DOWN, encode bitmap                  │                     │
    │  3. Commit hash on-chain     │                     │                     │
    │─────── updateBitmap(hash) ───┼─────────────────────┼────────────────────→│
    │                              │                     │  stores bitmapHash  │
    │                              │                     │←── ChainListener ───│
    │                              │                     │                     │
    │  4. Reveal bitmap to issuers │                     │                     │
    │─────── POST /vision/bitmap ─→│                     │                     │
    │                              │── fan-out ─────────→│                     │
    │                              │                     │  verify hash match  │
    │                              │                     │  store bitmap       │
    │                              │                     │                     │
    │  ⚠ LOCK WINDOW (lockOffset before tick end)        │                     │
    │  ❌ Can't change bitmap after lock                  │                     │
    │                              │                     │                     │

TICK RESOLUTION:

  Issuer Engine
    │
    ├─ Tick N ends
    ├─ Fetch start/end prices from data-node
    ├─ For each player:
    │    ├─ Compute MULTIPLIER (time-based + commitment)    ← weighted
    │    ├─ Decode bitmap → UP/DOWN per market
    │    └─ Compare to price movement → win/lose
    ├─ Parimutuel matching (weighted by multiplier)
    ├─ BLS sign tick result (3 issuers co-sign)
    └─ Player claims via claimRewards() + BLS proof

CONFIG RESOLUTION (how frontend/bots know what markets are in a batch):

  Issuer                          Data-node                    Vision.sol
    │                                │                             │
    │  1. Decide new config          │                             │
    │     (markets, order, thresholds)                             │
    │  2. BLS consensus              │                             │
    │  3. Push config data ─────────→│  stores config by hash      │
    │  4. Push configHash on-chain ──┼────────────────────────────→│
    │                                │                             │

  Frontend/Bot                    Data-node                    Vision.sol
    │                                │                             │
    │  1. Read configHash from chain ┼────────────────────────────→│
    │     (or from issuer API)       │                             │
    │  2. Fetch config data ────────→│                             │
    │     GET /batches/config/{hash} │                             │
    │  ←─ market list + order ───────│                             │
    │  3. Now knows: bit 0 = market A, bit 1 = market B, ...      │
    │  4. Player picks UP/DOWN per market                          │
    │  5. Encodes bitmap, commits hash on-chain                    │

CONFIG UPDATES (every 120s):

  Config Orchestrator
    ├─ GET /batches/recommended (data-node)
    ├─ If config hash changed → BLS consensus
    │    ├─ Push new config data to data-node
    │    └─ Push configHash on-chain via updateBatchConfig()
    └─ ⚠ Blocked during lock window
```

## Dataflow — New System (Continuous Betting)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATA COLLECTION (unchanged)                                         │
│                                                                      │
│  CoinGecko, Finnhub, NOAA, etc. ──→ DATA-NODE (Postgres)           │
│                                      ├─ GET /vision/snapshot        │
│                                      ├─ GET /batches/recommended    │
│                                      └─ NEW: GET /sources/registry  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  BATCH SETUP (automatic)                                             │
│                                                                      │
│  1. Add source to data-node config                                   │
│  2. GET /batches/recommended returns new source                      │
│  3. Config orchestrator sees no on-chain batch for this source       │
│  4. Orchestrator proposes createBatchAndJoin() via BLS consensus     │
│  5. Issuers detect BatchCreated event → auto-register batch          │
│  6. Batch appears in issuer API → frontend shows it                  │
│                                                                      │
│  ✅ Adding a source = data-node config only, zero deploys             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE REGISTRY (dynamic from data-node)                            │
│                                                                      │
│  data-node config → GET /sources/registry → frontend hook            │
│  ├─ Names, logos, categories, prefixes — all from API                │
│  ├─ useSourceRegistry() hook (SWR, 5min cache)                      │
│  └─ Grid, detail, explorer all read from this                        │
│                                                                      │
│  ✅ Zero hardcoded sources in frontend                                │
└─────────────────────────────────────────────────────────────────────┘

CONFIG RESOLUTION (same as current, issuer pushes config to data-node):

  Issuer                          Data-node                    Vision.sol
    │                                │                             │
    │  1. Decide new config (BLS)    │                             │
    │  2. Push config data ─────────→│  stores config by hash      │
    │  3. Push configHash on-chain ──┼────────────────────────────→│
    │                                │                             │
    │  New source? → createBatchAndJoin() via BLS                  │
    │  Config changed? → updateBatchConfig() via BLS               │
    │  ✅ No lock guard — updates anytime                           │

  Frontend/Bot                    Data-node                    Vision.sol
    │                                │                             │
    │  1. Read configHash            │                             │
    │     (from issuer API or chain) │                             │
    │  2. GET /batches/config/{hash}→│                             │
    │  ←─ market list + order ───────│                             │
    │  3. bit 0 = market A, bit 1 = market B, ...                  │
    │  4. Player picks UP/DOWN                                     │
    │  5. Commits bitmapHash on-chain                              │

PLAYER BETTING FLOW (tick N — betting for tick N+1):

  Player                        Frontend              Data-node           Vision.sol
    │                              │                     │                     │
    │  1. View source page         │                     │                     │
    │─────────────────────────────→│                     │                     │
    │                              │  GET /api/snapshot  │                     │
    │                              │────────────────────→│  (prices)          │
    │                              │  GET /api/sources   │  (registry)        │
    │                              │────────────────────→│                     │
    │                              │  GET /batches/config/{hash}              │
    │                              │────────────────────→│  (market list)     │
    │                              │←── prices+markets ──│                     │
    │←──── UI shows markets ───────│                     │                     │
    │                              │                     │                     │
    │  2. Choose UP/DOWN for NEXT tick (N+1)             │                     │
    │     (frontend builds bitmap from config order)     │                     │
    │  3. Commit bitmapHash on-chain                     │                     │
    │─────── updateBitmap(hash) ───┼─────────────────────┼────────────────────→│
    │                              │                     │  stores bitmapHash  │
    │                              │                     │                     │
    │  4. Reveal bitmap to issuers │                     │      Issuer         │
    │─────── POST /vision/bitmap ─→│                     │        │            │
    │                              │── fan-out ──────────┼───────→│            │
    │                              │                     │  verify hash match  │
    │                              │                     │  store in PENDING   │
    │                              │                     │                     │
    │  ✅ NO LOCK — can change anytime during tick        │                     │
    │  ✅ No submit = sit out next tick (balance safe)    │                     │
    │                              │                     │                     │

TWO-SLOT BITMAP MODEL (per player per batch):

  During tick N:
  ┌───────────────────┐          ┌───────────────────┐
  │   PENDING SLOT    │          │   ACTIVE SLOT     │
  │                   │          │                   │
  │ Submitted during  │          │ Submitted during  │
  │ tick N            │          │ tick N-1          │
  │ (for tick N+1)    │          │ (resolving now)   │
  └─────────┬─────────┘          └─────────┬─────────┘
            │     At tick boundary:         │
            │                               │
            ▼                               ▼
  ┌───────────────────┐          ┌───────────────────┐
  │ → becomes ACTIVE  │          │ → RESOLVED (PnL)  │
  └───────────────────┘          └───────────────────┘

  No pending = player sits out → balance unchanged

TICK RESOLUTION:

  Issuer Engine
    │
    ├─ Tick N ends
    ├─ Fetch start/end prices from data-node
    ├─ For each player with ACTIVE bitmap:
    │    ├─ ❌ No multiplier — flat stakePerTick
    │    ├─ Decode bitmap → UP/DOWN per market
    │    └─ Compare to price movement → win/lose
    ├─ Players without active bitmap → SIT OUT
    ├─ Parimutuel matching (flat weighting)
    ├─ BLS sign tick result (3 issuers co-sign)
    │
    │  TICK BOUNDARY (deterministic order):
    │  1. Resolution + BLS signing + publish
    │  2. Config promotion (if pending)
    │  3. Bitmap flip: active = pending, pending = cleared
    │
    └─ Player claims via claimRewards() + BLS proof

CONFIG UPDATES (every tick, fully automatic):

  Config Orchestrator
    ├─ GET /batches/recommended (data-node, bulk)
    ├─ New source with no batch?
    │    ├─ BLS consensus on createBatchAndJoin()
    │    ├─ Push config data to data-node
    │    └─ Push on-chain → issuers detect BatchCreated event
    ├─ Config hash changed for existing batch?
    │    ├─ BLS consensus on updateBatchConfig()
    │    ├─ Push new config data to data-node (by hash)
    │    └─ Push configHash on-chain
    ├─ New tickDuration → defines next tick's settlement time
    └─ ✅ No lock guard — updates anytime
```

## Security & Privacy Model

### Bet Privacy (Commit-Reveal)

The commit-reveal scheme ensures **issuers cannot see your bets before they're committed on-chain**:

```
1. Issuer pushes batch config (market list, order) to data-node
2. Issuer pushes configHash on-chain via updateBatchConfig()
3. Frontend/bot reads configHash → fetches config from data-node
   → now knows: bit 0 = market A, bit 1 = market B, ...
4. Player picks UP/DOWN per market, encodes bitmap
5. Player computes bitmapHash = keccak256(bitmap)
6. Player calls updateBitmap(batchId, bitmapHash) on Vision.sol
   → hash is now immutably committed on-chain
   → nobody can see the actual bets yet (only the hash)
7. Player reveals bitmap bytes to issuers (POST /vision/bitmap)
   → issuers verify: keccak256(revealed) == on-chain hash
   → if mismatch: reject (player can't change bets after commit)
```

**What this prevents:**
- Issuers seeing bets before commit → front-running impossible
- Players changing bets after seeing price movements → hash locks the commitment
- Issuers submitting fake bitmaps → hash must match on-chain commitment
- Config manipulation → configHash on-chain, config data verifiable by anyone

**This model is unchanged in the new system.** The only difference is WHEN bets apply: current system bets on tick N (same tick), new system bets on tick N+1 (next tick). The commit-reveal mechanism is identical.

### Fund Safety

| Layer | Protection | Attack prevented |
|-------|-----------|-----------------|
| **Deposits** | On-chain (Vision.sol), player's wallet tx | Issuers can't deposit/withdraw for you |
| **Bitmap commit** | On-chain hash (player's wallet tx) | Issuers can't change your bets |
| **Bitmap reveal** | keccak256 verification | Player can't change bets after commit |
| **Tick resolution** | BLS consensus (3 issuers must agree) | Single issuer can't manipulate outcomes |
| **Payouts (claimRewards)** | BLS-signed proof verified on-chain | Fake payouts rejected by contract |
| **Withdrawals** | On-chain, player's wallet tx | Only player can withdraw their funds |
| **Batch config** | configHash on-chain, data on data-node | Config data verifiable against on-chain hash |
| **Sit-out** | No active bitmap → balance unchanged | Not betting = no risk |

### What Issuers Control vs What Players Control

```
PLAYER controls (on-chain, trustless):
├─ Deposit USDC into Vision balance
├─ Join a batch (stakePerTick, initial bitmap hash)
├─ Update bitmap hash (commit new bets)
├─ Claim rewards (with BLS proof from issuers)
└─ Withdraw funds

ISSUERS control (off-chain, BLS consensus required):
├─ Tick resolution (price fetching, outcome computation)
├─ Balance proof generation (BLS-signed)
├─ Batch creation (new sources from data-node)
├─ Config updates (markets, tickDuration)
└─ Config orchestration (when to update, what markets)

ISSUERS CANNOT:
├─ Move player funds (deposits/withdrawals are player-only)
├─ Change player bets (bitmap hash committed on-chain by player)
├─ Forge payouts (BLS sig verified on-chain against registered keys)
├─ Act alone (BLS requires threshold of issuers to agree)
└─ See bets before commit (hash committed before reveal)
```

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

**Consensus on bitmap state.** The two-slot flip is deterministic and happens as part of the resolution consensus:
1. All issuers resolve tick N using `active_bitmaps` (derived from on-chain `bitmapHash` — the contract remains source of truth for "has bitmap")
2. All issuers sign the tick result via BLS
3. After consensus is reached and result published, all issuers flip: `active = pending`, `pending = cleared`
4. The flip is deterministic based on `tick_id`, not wall-clock time — all issuers flip at the same logical point

**Ordering at tick boundary:** Resolution → BLS signing → publish → config promotion → bitmap flip. Config promotion happens before bitmap flip so that the newly active bitmaps are evaluated against the new config on their tick.

**Remove multiplier types.** Delete `issuer/src/vision/multiplier.rs` entirely. Remove `PlayerMultiplier` from `types.rs`. Remove `join_timestamp` and `num_committed_ticks` from `PlayerPosition` (these only serve the multiplier). Remove all `use super::multiplier` imports.

### 2. Issuer — Config Orchestrator (`issuer/src/vision/batch_config_orchestrator.rs`)

**Run every tick** (currently runs on a 120s interval). For each batch:
1. Query data-node: `GET /batches/recommended` (bulk endpoint, returns all sources)
2. For each source, if config hash differs from current batch config → propose update
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

### 4. Issuer — Batch Auto-Detection from Chain Events

**Current flow:** Issuers know about batches from their startup config or manual registration. The config orchestrator checks for config updates but doesn't discover new batches.

**New flow:** Issuers auto-detect new batches from `BatchCreated` events on Vision.sol. The `ChainListener` already processes Vision events — add handling for `BatchCreated`:

1. `ChainListener` receives `BatchCreated(batchId, sourceId, configHash, tickDuration)` event
2. Calls `tick_scheduler.on_batch_created(batchId, sourceId, configHash, tickDuration)`
3. Scheduler adds the batch to its `batches` HashMap
4. Config orchestrator automatically includes the new batch in its next check cycle
5. Tick engine starts resolving ticks for the new batch

**No manual registration needed.** Deploy a batch on-chain → issuers pick it up automatically → it appears on the frontend via the batches API.

**Who creates batches?** The config orchestrator. When the data-node's `GET /batches/recommended` returns a source that has no on-chain batch yet, the orchestrator proposes `createBatchAndJoin()` via BLS consensus. This means: add a source to the data-node → orchestrator creates the batch → issuers detect it → frontend shows it. Fully automatic pipeline.

### 5. Contract — Vision.sol (minimal)

**No code changes required.** All behavioral changes are issuer-side. Bitmap commit-reveal stays the same (player calls `updateBitmap()` on-chain, reveals to issuers).

- `lockOffset = 0`: Set via `updateBatchConfig()` for all 43 batches (one-time config push)
- `_requireNotLocked` check in `updateBitmap()`: becomes a no-op when `lockOffset = 0`
- Bitmap hash on-chain: still stores player's latest `bitmapHash`. The issuer decides whether it's "pending" or "active" — the contract doesn't distinguish.

**One-time migration**: For each of the 43 batches:
1. Read `batches[batchId].nonce` on-chain to get current config nonce
2. Call `updateBatchConfig(batchId, currentConfigHash, 0, blsSig, nonce, bitmask)` with `lockOffset = 0`
3. Issuers BLS-sign each update

This is 43 sequential calls in a single migration script. Note: setting `lockOffset = 0` also removes the lock guard from `updateBatchConfig` itself — config updates can land anytime during a tick. This is intentional since there's no lock window anymore.

### 6. Frontend — Remove Static Dependencies

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

### 7. Frontend — Remove Multiplier UI

**Files to clean up:**
- `frontend/lib/vision/tick.ts` — remove `getMultiplier()`, `lockOffset` from `getBatchTickState()`, update `getSourceKeyForBatch()` / `getBatchDisplayName()` / `getBatchLogo()` / `getAllBatches()` to not depend on static config
- `frontend/components/domain/vision/detail/SourceDetail.tsx` — remove Multiplier column from batch bar
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` — remove multiplier display, lock state warnings
- `frontend/components/domain/vision/sources/NextBatches.tsx` — remove `lockOffset` prop, `getMultiplier()` call
- `frontend/hooks/vision/useSignedBatches.ts` — remove lockOffset references
- `frontend/hooks/vision/useBitmapEditor.ts` — no changes needed (bitmap UP/DOWN stays)

### 8. Frontend — Continuous Betting UX

**BatchEntryPanel changes:**
- Always open for submissions (no "locked" disabled state)
- Header: "Set predictions for next tick" (not "Enter Batch")
- Submit flow unchanged: player commits `bitmapHash` on-chain (`updateBitmap()`) → reveals bitmap bytes to issuers (`POST /vision/bitmap`). Commit-reveal preserved.
- After submit: "Your bets are set for tick N+1" confirmation
- Show active status: "You have active bets on tick N" when participating
- Show sit-out status: "No bets set — sitting out this tick" when player didn't submit
- Timer shows: "Tick N resolves in X:XX — betting open for tick N+1"

**Batch status bar (SourceDetail) changes:**
- Remove MULTIPLIER column
- Remove lock state styling (red timer, locked text)
- Timer is just a countdown, no lock phase
- Consider adding: "ACTIVE BETTORS" count (players with active bitmaps for current tick)

### 9. Frontend — Remove vision-batches.json Consumers

**Files referencing vision-batches.json:**
- `frontend/components/domain/vision/detail/SourceDetail.tsx` — static batch lookup
- `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` — static batchId
- `frontend/components/domain/vision/ExpandedBatch.tsx` — static batch data import
- `frontend/app/api/vision/batches/route.ts` — configHash→source reverse lookup
- `frontend/e2e/helpers/vision-api.ts` — scans static file for unjoined batches (has fallback to on-chain scan, update to use only that)
- `contracts/script/DeployAllVisionBatches.s.sol` — generates the file (keep for deploy, but frontend stops reading it)

The API proxy route (`/api/vision/batches`) still needs configHash→source mapping. Move this to the issuer API response: issuers already know which source each batch belongs to (from `source_id` field). The proxy just passes it through — no static file needed.

### 10. Data-node — Config Recommendations

**Endpoint already exists**: `GET /batches/recommended` (bulk, returns all sources at once)

Returns a `RecommendedBatchesResponse` with a `batches` array, each entry containing:
```json
{
  "sourceId": "stocks",
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

The issuer config orchestrator calls this bulk endpoint and proposes updates per-source when the config hash changes.

### 11. Tick Scheduling — Each Config Defines Next Settlement

Each `updateBatchConfig()` call sets the tick duration for subsequent ticks. The config includes `tickDuration` which defines how long the next tick runs. Settlement time is deterministic:

```
next_settlement_time = tick_start_time + tickDuration
```

When a new config is promoted at a tick boundary:
1. Current tick resolves and settles using the OLD config's tick duration
2. New config activates (lazy promotion already in contract)
3. Next tick starts with the NEW config's `tickDuration`
4. Settlement for the new tick = `now + new_tickDuration`

This means the data-node controls tick pacing per source. If a source wants faster ticks (e.g., during high-activity periods), the data-node returns a shorter `tickDuration` in the recommended config. The change takes effect at the next tick boundary.

**Issuer engine** already computes `next_tick_time` from `batch.tickDuration`. No change needed — it naturally picks up the new duration after config promotion.

**Frontend timer** already reads `tickDuration` from the batch API response and computes countdown. No change needed — it naturally shows the correct countdown for the current tick.

### 12. Frontend — Dynamic Source Registry (Remove Hardcoded VISION_SOURCES)

**Current problem:** `frontend/lib/vision/sources.ts` hardcodes 75+ sources with metadata (name, logo, description, category, prefixes). Adding a new data source requires a frontend deploy. Same for `CATEGORY_GROUPS` in `VisionMarketsGrid.tsx`, `PREFIX_MAP` in `market-categories.ts`, and `SOURCE_CATEGORIES` in `source-categories.ts`.

**New model:** All source metadata comes from the data-node API. Frontend has zero hardcoded source knowledge.

**Data-node: new endpoint `GET /sources/registry`**

Returns all active sources with their display metadata:
```json
{
  "sources": [
    {
      "sourceId": "stocks",
      "name": "US Stocks",
      "description": "NYSE & NASDAQ equities via Finnhub",
      "category": "finance",
      "logo": "/logos/finnhub.svg",
      "brandBg": "#D4A574",
      "prefixes": ["stock_"],
      "valueLabel": "Price",
      "valueUnit": "USD",
      "isPrice": true
    }
  ],
  "categories": [
    { "key": "finance", "label": "Finance", "order": 0 },
    { "key": "tech", "label": "Tech & Dev", "order": 3 }
  ]
}
```

This metadata currently lives in `sources.ts` — migrate it to the data-node config (e.g., `data-node/config/sources.json` or a TOML per source). The data-node serves it via API. When a new source is added to the data-node, it automatically appears on the frontend.

**Frontend changes:**

Delete static registries:
- `frontend/lib/vision/sources.ts` — delete `VISION_SOURCES` array, `VISION_TO_DATANODE`, `DATANODE_TO_VISION` maps
- `frontend/lib/vision/source-categories.ts` — delete `SOURCE_CATEGORIES`, `getSourcesByCategory()`, `getCategoryCounts()`
- `frontend/lib/vision/market-categories.ts` — delete `PREFIX_MAP`, `BARE_CRYPTO`, `CATEGORY_ORDER`
- `frontend/components/domain/vision/VisionMarketsGrid.tsx` — delete `CATEGORY_GROUPS`, `SOURCE_DISPLAY_OVERRIDES`, `COUNT_SOURCES`

Replace with:
- New hook: `useSourceRegistry()` → `GET /api/vision/sources` → data-node `/sources/registry`
- New proxy route: `frontend/app/api/vision/sources/route.ts` → forwards to data-node
- All components that used `VISION_SOURCES` now use the hook
- `getCategory(marketId)` derives category from source's `prefixes` field (from API)
- `formatMarketName(marketId)` strips known prefixes (from API)
- `SourcesGrid`, `VisionMarketsGrid`, `SourceDetailCategoryNav`, `VisionSection` (explorer) — all switch to dynamic data

**Logos:** Source logos (SVGs) stay in `frontend/public/logos/`. The data-node returns a path like `/logos/finnhub.svg`. New sources need their logo uploaded to the frontend public dir — this is the only manual step (acceptable; logos are static assets).

**Caching:** `useSourceRegistry()` caches aggressively (SWR with 5min revalidation). Source metadata changes rarely. The hook returns stale data while revalidating, so the grid never flashes empty.

**Fallback:** If the data-node is down, show a "Sources unavailable" message. No hardcoded fallback — the whole point is to eliminate static source lists.

---

## Migration Plan

1. **Deploy issuer changes first** (resolver, bitmap model, config orchestrator)
2. **Push lockOffset=0** for all batches via BLS-signed `updateBatchConfig()` calls
3. **Deploy frontend** (remove static deps, multiplier UI, add next-tick UX)
4. **No contract deployment needed** — all behavioral changes are off-chain

Player positions are unaffected. Existing balances carry over. The transition happens at a tick boundary — old model resolves the last tick, new model starts from the next one.

**Rollback plan**: If issues arise after migration, push `lockOffset = original_value` back for each batch via the same `updateBatchConfig()` + BLS flow. Issuer code can be rolled back to previous Docker image. Frontend can be redeployed from previous commit. No contract changes means no irreversible state.

---

## Testing

- **Issuer unit tests**: Resolver without multiplier, bitmap flip logic, sit-out handling
- **Issuer unit tests**: `multiplier.rs` tests deleted — verify no regressions in resolver
- **Integration test**: Full tick lifecycle — submit pending, resolve, flip, verify sit-out
- **Integration test**: Transition boundary — last old-model tick resolves, first new-model tick uses two-slot model
- **Integration test**: All players sit out — verify no payouts, no panics, balances unchanged
- **Integration test**: Concurrent bitmap submission during tick flip — verify correct slot assignment
- **Config orchestrator**: Mock data-node `GET /batches/recommended` returns new config → verify on-chain update
- **Migration script**: Run against local Anvil — verify all 43 batches get `lockOffset = 0`
- **Batch auto-detection**: Deploy new batch on-chain → issuers pick up `BatchCreated` event → batch appears in API
- **Auto-creation pipeline**: Add source to data-node → orchestrator creates batch → issuers detect → frontend shows
- **E2E**: Player submits bet, waits for tick, verifies payout without multiplier
- **Frontend**: Verify no references to vision-batches.json, multiplier UI gone, continuous betting UX works
- **Frontend**: Verify `tick.ts` functions work without static config (use live API data only)
- **Frontend**: Source grid loads entirely from data-node — no hardcoded sources, new sources appear automatically
- **Data-node**: `GET /sources/registry` returns all sources with metadata, categories
- **Tick scheduling**: Config update with different `tickDuration` → verify next tick uses new duration

---

## What Gets Deleted

| Component | Deleted |
|-----------|---------|
| `vision-batches.json` | Frontend dependency removed (file kept for deploy scripts) |
| Multiplier math | Issuer resolver, frontend display |
| `multiplier.rs` | Entire file deleted (`issuer/src/vision/multiplier.rs`) |
| `PlayerMultiplier` type | Removed from `types.rs` |
| `join_timestamp`, `num_committed_ticks` | Removed from `PlayerPosition` in `types.rs` |
| Lock window logic | Issuer, frontend timer/UI |
| `is_in_lock_period()` | Dead code in `batch_config_orchestrator.rs` |
| `getMultiplier()` | `frontend/lib/vision/tick.ts` |
| Lock countdown | SourceDetail, BatchEntryPanel, NextBatches |
| Static batch fallback | BatchEntryPanel, SourceDetail, ExpandedBatch |
| `VISION_SOURCES` array | `frontend/lib/vision/sources.ts` — replaced by data-node API |
| `VISION_TO_DATANODE` / `DATANODE_TO_VISION` | `frontend/lib/vision/sources.ts` — no longer needed |
| `SOURCE_CATEGORIES` / `getCategoryCounts()` | `frontend/lib/vision/source-categories.ts` — from API |
| `PREFIX_MAP` / `BARE_CRYPTO` / `CATEGORY_ORDER` | `frontend/lib/vision/market-categories.ts` — from API |
| `CATEGORY_GROUPS` / `SOURCE_DISPLAY_OVERRIDES` | `VisionMarketsGrid.tsx` — from API |
| Manual batch registration | Issuers auto-detect from `BatchCreated` chain events |
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
