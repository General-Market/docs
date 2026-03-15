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
- **Manual batch registration** — oracles auto-detect new batches from chain events
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
- **Commit-reveal bitmap model** — player commits hash on-chain before revealing to oracles (bet privacy preserved)

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

  Player                        Frontend              Oracle              Vision.sol
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
    │  4. Reveal bitmap to oracles │                     │                     │
    │─────── POST /vision/bitmap ─→│                     │                     │
    │                              │── fan-out ─────────→│                     │
    │                              │                     │  verify hash match  │
    │                              │                     │  store bitmap       │
    │                              │                     │                     │
    │  ⚠ LOCK WINDOW (lockOffset before tick end)        │                     │
    │  ❌ Can't change bitmap after lock                  │                     │
    │                              │                     │                     │

TICK RESOLUTION:

  Oracle Engine
    │
    ├─ Tick N ends
    ├─ Fetch start/end prices from data-node
    ├─ For each player:
    │    ├─ Compute MULTIPLIER (time-based + commitment)    ← weighted
    │    ├─ Decode bitmap → UP/DOWN per market
    │    └─ Compare to price movement → win/lose
    ├─ Parimutuel matching (weighted by multiplier)
    ├─ BLS sign tick result (3 oracles co-sign)
    └─ Player claims via claimRewards() + BLS proof

CONFIG RESOLUTION (how frontend/bots know what markets are in a batch):

  Data-node                         Oracle                       Vision.sol
    │                                  │                              │
    │  1. Generate recommended config  │                              │
    │     (markets, order, thresholds) │                              │
    │     Store unsigned config        │                              │
    │                                  │                              │
    │  2. GET /batches/recommended ←───│                              │
    │  ──→ recommended configs         │                              │
    │                                  │  3. BLS consensus            │
    │                                  │  4. Push configHash ────────→│
    │  5. POST /batches/signed ←───────│  (signed config + BLS sig)  │
    │     Store signed config in DB    │                              │

  Frontend/Bot                      Data-node
    │                                  │
    │  GET /batches/signed ───────────→│  (poll every 15s)
    │  ←─ signed configs with markets ─│
    │  OR                              │
    │  GET /batches/config/{hash} ────→│  (lookup by hash)
    │  ←─ market list + order ─────────│
    │                                  │
    │  Now knows: bit 0 = market A, bit 1 = market B, ...
    │  Player picks UP/DOWN per market
    │  Encodes bitmap, commits hash on-chain

CONFIG UPDATES (every 120s):

  Config Orchestrator
    ├─ GET /batches/recommended (data-node generates config, oracle reads)
    ├─ If config hash changed → BLS consensus
    │    ├─ Push configHash on-chain via updateBatchConfig()
    │    └─ POST /batches/signed to data-node (signed config for storage)
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
│  5. Oracles detect BatchCreated event → auto-register batch          │
│  6. Batch appears in oracle API → frontend shows it                  │
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

CONFIG RESOLUTION (data-node generates, oracle signs, data-node stores):

  Data-node                         Oracle                       Vision.sol
    │                                  │                              │
    │  1. Generate recommended config  │                              │
    │  2. GET /batches/recommended ←───│                              │
    │  ──→ recommended configs         │                              │
    │                                  │  3. BLS consensus            │
    │                                  │  4. Push configHash ────────→│
    │  5. POST /batches/signed ←───────│  (signed config + BLS sig)  │
    │     Store signed config in DB    │                              │
    │                                  │                              │
    │  New source? → createBatchAndJoin() via BLS consensus          │
    │  Config changed? → updateBatchConfig() via BLS consensus       │
    │  ✅ No lock guard — updates anytime                             │

  Frontend/Bot                      Data-node
    │                                  │
    │  GET /batches/signed ───────────→│  (signed configs + markets)
    │  OR GET /batches/config/{hash} ─→│  (lookup by hash)
    │  ←─ market list + order ─────────│
    │  bit 0 = market A, bit 1 = market B, ...
    │  Player picks UP/DOWN, commits bitmapHash on-chain

PLAYER BETTING FLOW (tick N — betting for tick N+1):

  Two reveal strategies — frontend reveals immediately, bots reveal later.

  FRONTEND (immediate reveal):

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
    │  4. Reveal bitmap IMMEDIATELY to oracles           │      Oracle         │
    │─────── POST /vision/bitmap ─→│                     │        │            │
    │                              │── fan-out ──────────┼───────→│            │
    │                              │                     │  verify hash match  │
    │                              │                     │  store in PENDING   │
    │                              │                     │                     │

  VISION-BOT (delayed reveal):

  Bot                                                 Data-node           Vision.sol
    │                                                    │                     │
    │  1. Fetch config + prices                          │                     │
    │────── GET /batches/signed ────────────────────────→│                     │
    │────── GET /vision/snapshot ───────────────────────→│                     │
    │←──── config + prices ─────────────────────────────│                     │
    │                                                    │                     │
    │  2. Build bitmap, commit hash on-chain             │                     │
    │─────── updateBitmap(hash) ─────────────────────────┼────────────────────→│
    │                                                    │  stores bitmapHash  │
    │                                                    │                     │
    │  ... bot keeps bets private ...                    │                     │
    │  ... waits until closer to tick boundary ...       │                     │
    │                                                    │                     │
    │  3. Reveal bitmap to oracles (LATER, before tick boundary)   Oracle     │
    │─────── POST /vision/bitmap (direct to each oracle) ─────────→│         │
    │                                                    │  verify hash match  │
    │                                                    │  store in PENDING   │
    │                                                    │                     │

  Key difference: frontend reveals via Next.js proxy (fan-out), bot reveals
  directly to each oracle endpoint. Both commit hash on-chain first.

    ✅ NO LOCK — can change anytime during tick
    ✅ No submit = sit out next tick (balance safe)
    ✅ Reveal can happen anytime between commit and tick boundary
    ⚠ No reveal before tick boundary = sit out (hash on-chain but oracle has no bitmap data)

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

  Oracle Engine
    │
    ├─ Tick N ends
    ├─ Fetch start/end prices from data-node
    ├─ For each player with ACTIVE bitmap:
    │    ├─ ❌ No multiplier — flat stakePerTick
    │    ├─ Decode bitmap → UP/DOWN per market
    │    └─ Compare to price movement → win/lose
    ├─ Players without active bitmap → SIT OUT
    ├─ Parimutuel matching (flat weighting)
    ├─ BLS sign tick result (3 oracles co-sign)
    │
    │  TICK BOUNDARY (deterministic order):
    │  1. Resolution + BLS signing + publish
    │  2. Config promotion (if pending)
    │  3. Bitmap flip: active = pending, pending = cleared
    │
    └─ Player claims via claimRewards() + BLS proof

CONFIG UPDATES (every tick, fully automatic):

  Config Orchestrator
    ├─ GET /batches/recommended (data-node generates configs, oracle reads)
    ├─ New source with no batch?
    │    ├─ BLS consensus on createBatchAndJoin()
    │    ├─ Push on-chain → oracles detect BatchCreated event
    │    └─ POST /batches/signed to data-node (signed config for storage)
    ├─ Config hash changed for existing batch?
    │    ├─ BLS consensus on updateBatchConfig()
    │    ├─ Push configHash on-chain
    │    └─ POST /batches/signed to data-node (signed config for storage)
    ├─ New tickDuration → defines next tick's settlement time
    └─ ✅ No lock guard — updates anytime (remove is_in_lock_period checks)
```

## Security & Privacy Model

### Bet Privacy (Commit-Reveal)

The commit-reveal scheme ensures **oracles cannot see your bets before they're committed on-chain**:

```
1. Data-node generates batch config (market list, order, thresholds)
2. Oracle fetches recommendation, BLS consensus, pushes configHash on-chain
3. Oracle posts signed config to data-node for storage (POST /batches/signed)
4. Frontend/bot fetches signed config from data-node (GET /batches/signed or /batches/config/{hash})
   → now knows: bit 0 = market A, bit 1 = market B, ...
5. Player picks UP/DOWN per market, encodes bitmap
6. Player computes bitmapHash = keccak256(bitmap)
7. Player calls updateBitmap(batchId, bitmapHash) on Vision.sol
   → hash is now immutably committed on-chain
   → nobody can see the actual bets yet (only the hash)
8. Player reveals bitmap bytes to oracles
   → Frontend: reveals IMMEDIATELY via POST /vision/bitmap (fan-out through proxy)
   → Vision-bot: reveals LATER, directly to each oracle, closer to tick boundary
   → oracles verify: keccak256(revealed) == on-chain hash
   → if mismatch: reject (player can't change bets after commit)
   → if no reveal before tick boundary: player sits out (hash exists but no bitmap data)
```

**What this prevents:**
- Oracles seeing bets before commit → front-running impossible
- Players changing bets after seeing price movements → hash locks the commitment
- Oracles submitting fake bitmaps → hash must match on-chain commitment
- Config manipulation → configHash on-chain, config data verifiable by anyone

**Reveal timing strategies:**
- **Frontend (immediate):** Commit + reveal in same user flow. Simpler UX, bets are visible to oracles sooner. Oracles can't act on them (BLS consensus + commit-reveal prevents front-running).
- **Vision-bot (delayed):** Commit hash early, reveal just before tick boundary. Maximizes bet privacy — other participants (including other bots monitoring oracle APIs) cannot see the bot's positions until the last moment. The on-chain hash locks the bet regardless of reveal timing.

Both strategies are equally safe. The commit-reveal scheme guarantees bets can't be changed after commit. Delayed reveal is an optimization for competitive privacy, not a security difference.

### Fund Safety

| Layer | Protection | Attack prevented |
|-------|-----------|-----------------|
| **Deposits** | On-chain (Vision.sol), player's wallet tx | Oracles can't deposit/withdraw for you |
| **Bitmap commit** | On-chain hash (player's wallet tx) | Oracles can't change your bets |
| **Bitmap reveal** | keccak256 verification | Player can't change bets after commit |
| **Tick resolution** | BLS consensus (3 oracles must agree) | Single oracle can't manipulate outcomes |
| **Payouts (claimRewards)** | BLS-signed proof verified on-chain | Fake payouts rejected by contract |
| **Withdrawals** | On-chain, player's wallet tx | Only player can withdraw their funds |
| **Batch config** | configHash on-chain, data on data-node | Config data verifiable against on-chain hash |
| **Sit-out** | No active bitmap → balance unchanged | Not betting = no risk |

### What Oracles Control vs What Players Control

```
PLAYER controls (on-chain, trustless):
├─ Deposit USDC into Vision balance
├─ Join a batch (stakePerTick, initial bitmap hash)
├─ Update bitmap hash (commit new bets)
├─ Claim rewards (with BLS proof from oracles)
└─ Withdraw funds

ORACLES control (off-chain, BLS consensus required):
├─ Tick resolution (price fetching, outcome computation)
├─ Balance proof generation (BLS-signed)
├─ Batch creation (new sources from data-node)
├─ Config updates (markets, tickDuration)
└─ Config orchestration (when to update, what markets)

ORACLES CANNOT:
├─ Move player funds (deposits/withdrawals are player-only)
├─ Change player bets (bitmap hash committed on-chain by player)
├─ Forge payouts (BLS sig verified on-chain against registered keys)
├─ Act alone (BLS requires threshold of oracles to agree)
└─ See bets before commit (hash committed before reveal)
```

---

## Changes by Layer

### 1. Oracle — Resolver (`oracle/src/vision/resolver.rs`)

**Remove multiplier calculation.** Currently the resolver computes a multiplier based on:
- How early in the tick the player submitted (time-based)
- Commitment level (balance coverage)

Replace with flat weighting: every active player's `stakePerTick` counts equally.

**Two-slot bitmap model.** Per player per batch:
- `pending_bitmap`: what the player submitted during the current tick (for next tick)
- `active_bitmap`: what's being used for current tick resolution (submitted during previous tick)

Each pending bitmap stores the `config_hash` it was encoded against. When the bitmap becomes active, the resolver decodes it using THAT config — not the "current" config. This prevents config/bitmap desync: if a config update lands between submission and resolution, the bitmap is still decoded against the config the player used to encode it.

```rust
struct SlottedBitmap {
    bitmap_hash: H256,
    bitmap_data: Vec<u8>,
    config_hash: H256,       // config active when player submitted
    submitted_at_tick: u64,  // tick ID during which this was submitted
}

// Per batch, two slots:
pending_bitmaps: HashMap<Address, SlottedBitmap>  // submitted during current tick
active_bitmaps: HashMap<Address, SlottedBitmap>   // being resolved this tick
```

At tick resolution:
1. Resolve current tick using `active_bitmaps` — decode each bitmap using its stored `config_hash`
2. Players without `active_bitmap` → sit out (balance unchanged)
3. Flip: `active_bitmaps = pending_bitmaps`, `pending_bitmaps = cleared`
4. Config promotion (if pending) — new config applies to FUTURE submissions only

**Deterministic slot assignment.** When a bitmap is received, it goes to `pending_bitmaps` for `current_tick_id + 1`. The `current_tick_id` is derived from the chain — all oracles agree on it via BLS-signed tick resolution. Bitmaps received AFTER the flip (new tick started) go to the new `pending_bitmaps` for `new_tick_id + 1`.

**Ordering at tick boundary (CRITICAL — order matters for safety):**
1. Resolution: resolve tick N using `active_bitmaps` (each decoded with its own `config_hash`)
2. BLS signing: sign tick result (includes `tick_id`, `config_hash`, `bitmap_set_hash`)
3. Publish results
4. Bitmap flip: `active = pending`, `pending = cleared`
5. Config promotion (if pending) — new config is now "current" for new submissions

Config promotion happens AFTER bitmap flip. This means:
- Active bitmaps are always decoded against the config they were encoded with (stored `config_hash`)
- Config updates only affect bitmaps submitted AFTER the promotion
- No market-order scrambling is possible

**Bitmap set hash in BLS message.** The BLS consensus message includes `bitmap_set_hash = keccak256(sorted list of (player, bitmap_hash) pairs in active set)`. This ensures all oracles agree on which bitmaps are active before resolution. If any oracle has a different active set, BLS consensus fails — preventing silent divergence.

**Cross-oracle bitmap gossip.** Before resolution, oracles exchange "bitmap inventory" messages listing `(player, bitmap_hash)` pairs in their active set. If an oracle is missing a bitmap (e.g., player's reveal didn't reach it), it requests the missing bitmap from peers. Resolution proceeds only with the INTERSECTION of bitmaps confirmed by all oracles. This prevents a single missed reveal from breaking consensus.

**Trust assumption (threshold model):** With 2-of-3 BLS threshold, two colluding oracles can selectively exclude any player from resolution (by claiming they don't have the bitmap). This is inherent to ANY threshold consensus system — a quorum of malicious actors can censor participants. Mitigations: (1) the `bitmap_set_hash` in BLS messages makes exclusion auditable (anyone can compare the signed set against the on-chain committed hashes), (2) a monitoring service can flag when a player's committed bitmap is excluded from resolution despite all oracles having received it, (3) long-term: increase oracle set size beyond 3 to make collusion harder.

**DB persistence for crash recovery.** The `vision_bitmaps` table must include:
- `slot` column: `'pending'` or `'active'`
- `target_tick_id`: which tick this bitmap is for
- `config_hash`: which config the bitmap was encoded against

```sql
ALTER TABLE vision_bitmaps ADD COLUMN slot TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE vision_bitmaps ADD COLUMN target_tick_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE vision_bitmaps ADD COLUMN config_hash TEXT NOT NULL DEFAULT '';
```

On crash recovery, `load_from_db()` restores both `pending_bitmaps` and `active_bitmaps` using the `slot` column. Also persist `current_tick_id` per batch in a `vision_batch_state` table so recovery knows which tick boundary to reference.

```sql
CREATE TABLE vision_batch_state (
    batch_id BIGINT PRIMARY KEY,
    current_tick_id BIGINT NOT NULL,
    last_resolved_tick_id BIGINT NOT NULL,
    active_config_hash TEXT NOT NULL
);
```

**Remove multiplier types.** Delete `oracle/src/vision/multiplier.rs` entirely. Remove `PlayerMultiplier` from `types.rs`. Remove `join_timestamp` and `num_committed_ticks` from `PlayerPosition` (these only serve the multiplier). Remove all `use super::multiplier` imports.

### 2. Oracle — Config Orchestrator (`oracle/src/vision/batch_config_orchestrator.rs`)

**Run every tick** (currently runs on a 120s interval). For each batch:
1. Query data-node: `GET /batches/recommended` (bulk endpoint, returns all sources)
2. For each source, if config hash differs from current batch config → propose update
3. BLS consensus among oracles on new config
4. Call `updateBatchConfig()` on-chain
5. Lazy promotion at next tick boundary (already in contract)

**Interval**: Match to tick duration per batch. 600s batches check every 600s. 300s batches check every 300s. Can keep the existing 120s interval and batch all checks — any batch whose tick boundary is approaching gets a config check.

**Failure mode**: If config update fails (BLS quorum not reached, RPC down), current config persists. No harm — markets just stay the same for another tick.

**Remove lock period checks.** Currently `publish_to_data_node()` (line 320) and `replicate_to_own_data_node()` (line 357) skip during lock period. With `lockOffset = 0` these checks are dead code — remove `is_in_lock_period()` and all callers.

**Add batch auto-creation.** When `GET /batches/recommended` returns a source with no on-chain batch, propose `createBatchAndJoin()` via BLS consensus. Currently the orchestrator only updates existing batches.

**Batch creation safeguards:**
- Hard cap on-chain: `require(nextBatchId < MAX_BATCHES)` (e.g., 200). Prevents unbounded batch flooding from a compromised data-node.
- Rate limit in orchestrator: max 3 new batches per hour. Prevents gas exhaustion from rapid auto-creation.
- Minimum healthy assets: only create a batch for a source that has at least 5 healthy markets with recent data. Prevents empty/dead batches.
- Admin alert: log WARN when auto-creating a batch. Log CRITICAL if creation rate exceeds 1 per 10 minutes.

**Tighten follower verification tolerances.** Current tolerances are dangerously loose (`THRESHOLD_TOLERANCE = 0.50`, `ASSET_COUNT_TOLERANCE = 0.50`). A compromised leader could craft adversarial configs that pass follower verification. Change to:
- `THRESHOLD_TOLERANCE = 0.20` (20% threshold drift max)
- `ASSET_COUNT_TOLERANCE = 0.30` (30% asset count drift max)
- `UNKNOWN_ASSET_TOLERANCE = 0.05` (max 5% unknown assets)
- Exact match on `resolution_type` per market (not just `threshold_bps`)

### 3. Oracle — Tick Engine (`oracle/src/vision/engine.rs`)

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
2. BLS sign tick result — message includes `tick_id`, `config_hash`, `bitmap_set_hash` (hash of active player set)
3. Publish results via BLS consensus
4. Flip bitmaps: `active = pending`, `pending = cleared`
5. Config promotion (if pending config exists)

**Remove degraded-mode balance application.** Currently `engine.rs` falls back to applying balances directly when `TickConsensus::create_proposal()` fails. This MUST be removed — in degraded mode, skip the tick entirely and retry next cycle. Never apply balance changes without BLS consensus. Log a CRITICAL alert.

**Fixed-point price conversion.** The data-node MUST return prices as integer-scaled values (price * 1e8 as string) in the snapshot response. Oracles parse directly to `u128`, never going through `f64`. This eliminates non-deterministic float-to-integer rounding that can cause BLS consensus failure across oracles on different hardware. Add a `price_scale` field to the snapshot response (default `100000000` = 1e8). Current `(start_price * 1e8) as u128` in `resolver.rs` is non-deterministic — replace with integer parsing.

### 4. Oracle — Batch Auto-Detection from Chain Events

**Current flow:** Oracles know about batches from their startup config or manual registration. The config orchestrator checks for config updates but doesn't discover new batches.

**New flow:** Oracles auto-detect new batches from `BatchCreated` events on Vision.sol. The `ChainListener` already processes Vision events — add handling for `BatchCreated`:

1. `ChainListener` receives `BatchCreated(batchId, sourceId, configHash, tickDuration)` event
2. Calls `tick_scheduler.on_batch_created(batchId, sourceId, configHash, tickDuration)`
3. Scheduler adds the batch to its `batches` HashMap
4. Config orchestrator automatically includes the new batch in its next check cycle
5. Tick engine starts resolving ticks for the new batch

**No manual registration needed.** Deploy a batch on-chain → oracles pick it up automatically → it appears on the frontend via the batches API.

**Who creates batches?** The config orchestrator. When the data-node's `GET /batches/recommended` returns a source that has no on-chain batch yet, the orchestrator proposes `createBatchAndJoin()` via BLS consensus. This means: add a source to the data-node → orchestrator creates the batch → oracles detect it → frontend shows it. Fully automatic pipeline.

### 5. Contract — Vision.sol (minor changes)

**Two contract changes required:**

1. **Add `tickDuration` parameter to `updateBatchConfig()`.** Currently the function only accepts `configHash` and `lockOffset`. The spec requires dynamic tick pacing where each config update can change the tick duration. Add `tickDuration` as a parameter, store it in the batch struct, emit it in the `BatchConfigUpdated` event. Oracles read `tickDuration` from the event to schedule the next tick.

2. **Add `MAX_BATCHES` constant.** Prevent unbounded batch creation: `uint256 public constant MAX_BATCHES = 200;` and `require(nextBatchId < MAX_BATCHES, "TooManyBatches")` in `createBatch()`.

**Unchanged:**
- Bitmap commit-reveal stays the same (player calls `updateBitmap()` on-chain, reveals to oracles)
- `lockOffset = 0`: Set via `updateBatchConfig()` for all 43 batches (one-time config push)
- `_requireNotLocked` check in `updateBitmap()`: becomes a no-op when `lockOffset = 0`
- Bitmap hash on-chain: still stores player's latest `bitmapHash`. The oracle decides whether it's "pending" or "active" — the contract doesn't distinguish.

**Fresh deploy**: All batches are created with `lockOffset = 0` from the start via `DeployAllVisionBatches.s.sol`. No migration needed — full redeploy wipes previous state. Setting `lockOffset = 0` also removes the lock guard from `updateBatchConfig` itself — config updates can land anytime during a tick. This is intentional since there's no lock window anymore.

### 6. Frontend — Remove Static Dependencies

**Delete `frontend/lib/contracts/vision-batches.json`.**

All batch data comes from live API:
- `useBatches()` hook → `GET /api/vision/batches` → oracle API
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
- `frontend/hooks/vision/useSignedBatches.ts` — remove lockOffset references. This hook already fetches `GET /batches/signed` from data-node (market list + BLS sig) — it's the main source of config data for the frontend.
- `frontend/components/domain/vision/detail/MarketsTable.tsx` — currently reads configHash from vision-batches.json to call `GET /batches/config/{hash}`. Switch to use live batch data (from `useBatches()` or `useSignedBatches()`).
- `frontend/hooks/vision/useBitmapEditor.ts` — no changes needed (bitmap UP/DOWN stays)

### 8. Frontend — Continuous Betting UX

**BatchEntryPanel changes:**
- Always open for submissions (no "locked" disabled state)
- Header: "Set predictions for next tick" (not "Enter Batch")
- Submit flow: player commits `bitmapHash` on-chain (`updateBitmap()`) → reveals bitmap bytes to oracles (`POST /vision/bitmap`). Commit-reveal preserved.
- **Config freshness check before submit:** Before calling `updateBitmap()`, re-fetch the latest config from `GET /batches/signed` and compare `configHash` to the one used for bitmap encoding. If mismatch (config updated between last poll and submit), re-encode the bitmap against the new config before sending the transaction. This prevents committed hashes with unresolvable bitmaps. The oracle stores the `config_hash` with each pending bitmap to ensure correct decoding.
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

The API proxy route (`/api/vision/batches`) still needs configHash→source mapping. Move this to the oracle API response: oracles already know which source each batch belongs to (from `source_id` field). The proxy just passes it through — no static file needed.

### 10. Data-node — Changes

**Existing endpoints (changes noted):**
- `GET /batches/recommended` — returns unsigned recommended configs per source. Data-node generates these every 60s from collected market data. **Now returns integer-scaled prices** (price * 1e8 as string) instead of floats, plus a `price_scale` field.
- `GET /batches/config/{hash}` — resolves configHash to full config (market list, order). Lookup chain: memory → DB → deploy-hash reverse.
- `GET /batches/signed` — returns BLS-signed configs (latest per source). Frontend polls this every 15s.
- `POST /batches/signed` — stores signed config from oracle (after BLS consensus). **Add BLS signature verification on ingestion**: verify that `keccak256(abi.encode(config_body))` matches the claimed `configHash`, and that the BLS signature over that hash is valid against the registered oracle aggregate pubkey. This turns the admin token into defense-in-depth rather than the sole trust boundary. Use per-oracle admin tokens and rotate periodically.
- `POST /batches/replicate` — follower oracles replicate signed configs.

**HMAC hard-fail.** In `engine.rs`, when `snapshot_hmac_secret` is configured and the response header `x-snapshot-hmac` is missing, this MUST be an error (reject snapshot), not a warning. A missing HMAC on a supposedly authenticated channel means MITM or compromise.

**Remove lock period freeze.** `batch_engine.rs` (line 454-462) skips config generation during lock periods. With `lockOffset = 0`, remove this check.

**New endpoint: `GET /sources/registry`** — returns source display metadata (name, logo, description, category, prefixes) for all active sources. See section 12.

**Set `lockOffset = 0` in generated configs.** `batch_engine.rs` currently sets `lockOffset` based on source config. Force to 0 for all sources.

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

**Oracle engine** already computes `next_tick_time` from `batch.tickDuration`. No change needed — it naturally picks up the new duration after config promotion.

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

## Deployment Strategy

**Full redeploy — no backward compatibility, no migration.**

All contracts, oracles, and DB are deployed fresh. Previous bitmaps are wiped. No dual-mode / `activation_tick_id` mechanism needed.

1. **Deploy data-node** — lock removal, /sources/registry, integer prices, BLS verification
2. **Stop all oracles + wipe vision DB tables** (vision_bitmaps, vision_batch_state)
3. **Deploy fresh contracts** — `DeployAllVisionBatches.s.sol` creates all batches with `lockOffset=0`
4. **Deploy new oracles** — continuous-only mode, fresh DB migration on startup
5. **Deploy frontend** — remove static deps, multiplier UI, add next-tick UX

**First tick:** All batches start fresh with no active bitmaps. Players must submit new bitmaps to participate. This is safe — balances unchanged.

**Fix i64 overflow in `apply_tick_balances_with_db`.** The current `pb.new_balance.as_u128() as i64` silently overflows for balances > i64::MAX (possible with 18-decimal USDC). Store balance as `TEXT`/`NUMERIC` in DB, matching the approach in `store_balance_proof` which already uses `balance.to_string()`.

**Rollback plan**: Redeploy previous contract + oracle + frontend versions. Full revert since no backward-compatible state to preserve.

---

## Testing

- **Oracle unit tests**: Resolver without multiplier, bitmap flip logic, sit-out handling
- **Oracle unit tests**: `multiplier.rs` tests deleted — verify no regressions in resolver
- **Integration test**: Full tick lifecycle — submit pending, resolve, flip, verify sit-out
- **Integration test**: Fresh deploy — first tick has no active bitmaps, all players sit out safely
- **Integration test**: All players sit out — verify no payouts, no panics, balances unchanged
- **Integration test**: Concurrent bitmap submission during tick flip — verify correct slot assignment
- **Config orchestrator**: Mock data-node `GET /batches/recommended` returns new config → verify on-chain update
- **Deploy script**: Run DeployAllVisionBatches against local Anvil — verify all batches get `lockOffset = 0`
- **Batch auto-detection**: Deploy new batch on-chain → oracles pick up `BatchCreated` event → batch appears in API
- **Auto-creation pipeline**: Add source to data-node → orchestrator creates batch → oracles detect → frontend shows
- **E2E**: Player submits bet, waits for tick, verifies payout without multiplier
- **Frontend**: Verify no references to vision-batches.json, multiplier UI gone, continuous betting UX works
- **Frontend**: Verify `tick.ts` functions work without static config (use live API data only)
- **Frontend**: Source grid loads entirely from data-node — no hardcoded sources, new sources appear automatically
- **Data-node**: `GET /sources/registry` returns all sources with metadata, categories
- **Tick scheduling**: Config update with different `tickDuration` → verify next tick uses new duration
- **Crash recovery**: Kill oracle mid-tick, restart, verify pending/active slots restored correctly from DB
- **Config/bitmap desync**: Submit bitmap under config C1, update config to C2 before resolution → verify bitmap decoded with C1 (its stored `config_hash`)
- **Cross-oracle gossip**: One oracle misses a bitmap reveal → gossip fills the gap → consensus succeeds
- **Bitmap set hash**: Oracles with different active sets → BLS consensus fails (correct behavior)
- **Batch creation cap**: Attempt to create batch beyond `MAX_BATCHES` → reverts
- **HMAC hard-fail**: Remove HMAC header from data-node response → oracle rejects snapshot (not just warn)
- **Fixed-point prices**: Verify all oracles produce identical `u128` prices from same integer-scaled data-node response
- **Degraded mode**: Force proposal failure → verify NO balance changes applied (tick skipped)
- **i64 overflow**: Player with balance > i64::MAX → verify DB stores correctly, crash recovery preserves balance
- **First-tick skip**: New batch first tick → verify resolution skipped, reference prices established
- **Fresh deploy**: Stop oracles, wipe DB, deploy new contracts + oracles, verify continuous mode works from first tick

---

## Security Mitigations

Findings from multi-round cross-referenced security review by 5 independent reviewers.

### Tick Boundary Front-Running (no lock window)

**Concern:** With `lockOffset = 0` and no multiplier, bots can wait until maximum information before submitting.

**Mitigation:** The bet-on-next-tick model is the primary defense. During tick N, a player submitting is betting on tick N+1's price DIRECTION — not tick N's. They cannot know which way prices will move during N+1. The tick boundary creates a natural cut-off: bitmaps submitted before the flip go to N+1, after the flip go to N+2. The only exploitable window is between tick N's final prices becoming known and the flip completing (seconds during BLS consensus). During this window, a bot knows N+1's START prices but not its price DIRECTION. Knowing start prices doesn't help predict UP/DOWN.

**Remaining risk:** LOW. A bot with superior price prediction models has an edge, but this is true with any prediction market. The lock window only prevented _observing_ current tick prices — it didn't prevent _predicting_ next tick prices.

### Config Promotion Timing Mismatch (contract vs oracle)

**Problem:** Contract promotes config lazily (triggered by user interactions). Oracle promotes via events. If no user interacts, contract and oracle can desync.

**Mitigation:** Oracles accept bitmaps for BOTH the current AND pending config hashes during the transition window. Each bitmap stores its `config_hash`. The resolver uses the bitmap's stored `config_hash` to decode, not the "current" config. This makes the timing of on-chain promotion irrelevant — the bitmap always gets decoded correctly.

### First-Tick Reference Price Manipulation

**Problem:** New batch's first tick has no reference prices. `change_pct` from data-node is unverified.

**Mitigation:** For the first tick of any newly created batch, skip resolution entirely. Use the first tick only to establish reference prices. Players who submit bitmaps during tick 0 sit out (their bitmaps become active for tick 1, which has proper reference prices from tick 0). This eliminates the attack surface.

### Data-Node Downtime

**Problem:** If data-node is unavailable, oracles can't fetch snapshots → ticks don't resolve → players can't claim.

**Mitigation:** Each oracle already has its own data-node instance. Add retry with exponential backoff (3 attempts, 5s/15s/45s). If all retries fail for a tick, skip the tick (balances unchanged, no PnL applied). Players who were active simply sit out that tick. On recovery, the next tick resolves normally. No funds are at risk — only temporarily idle.

---

## What Gets Deleted

| Component | Deleted |
|-----------|---------|
| `vision-batches.json` | Frontend dependency removed (file kept for deploy scripts) |
| Multiplier math | Oracle resolver, frontend display |
| `multiplier.rs` | Entire file deleted (`oracle/src/vision/multiplier.rs`) |
| `PlayerMultiplier` type | Removed from `types.rs` |
| `join_timestamp`, `num_committed_ticks` | Removed from `PlayerPosition` in `types.rs` |
| Lock window logic | Oracle, frontend timer/UI |
| `is_in_lock_period()` | Dead code in `batch_config_orchestrator.rs` |
| `getMultiplier()` | `frontend/lib/vision/tick.ts` |
| Lock countdown | SourceDetail, BatchEntryPanel, NextBatches |
| Static batch fallback | BatchEntryPanel, SourceDetail, ExpandedBatch |
| `VISION_SOURCES` array | `frontend/lib/vision/sources.ts` — replaced by data-node API |
| `VISION_TO_DATANODE` / `DATANODE_TO_VISION` | `frontend/lib/vision/sources.ts` — no longer needed |
| `SOURCE_CATEGORIES` / `getCategoryCounts()` | `frontend/lib/vision/source-categories.ts` — from API |
| `PREFIX_MAP` / `BARE_CRYPTO` / `CATEGORY_ORDER` | `frontend/lib/vision/market-categories.ts` — from API |
| `CATEGORY_GROUPS` / `SOURCE_DISPLAY_OVERRIDES` | `VisionMarketsGrid.tsx` — from API |
| Manual batch registration | Oracles auto-detect from `BatchCreated` chain events |
| Early-entry incentive | Entire concept removed |

## What Stays

| Component | Unchanged |
|-----------|-----------|
| Vision.sol contract | Minor: add `tickDuration` param to `updateBatchConfig()`, add `MAX_BATCHES` cap |
| Parimutuel settlement | Same matching logic |
| BLS consensus | Same signing/verification |
| Deposit/withdraw | Same flow |
| Bitmap UP/DOWN | Same per-market bets |
| stakePerTick | Same risk model |
| Per-source tick duration | Same (600s, 300s, 86400s etc.) |
