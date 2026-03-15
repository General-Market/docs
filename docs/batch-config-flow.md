# Batch Config Flow — How Assets Get Into Batches

## The Big Picture

```
                    ┌──────────────────┐
                    │    DATA-NODE     │  generates config every 60s
                    │   (1 per oracle) │  per source (67 sources)
                    └────────┬─────────┘
                             │
              GET /batches/recommended
                             │
                    ┌────────▼─────────┐
                    │  LEADER ORACLE   │  fetches from its own data-node
                    │                  │  proposes to cluster
                    └────────┬─────────┘
                             │ P2P: BatchConfigProposal
                    ┌────────▼─────────┐
                    │ OTHER ORACLES    │  have THEIR OWN data-nodes
                    │ (followers)      │  verify against their view
                    │                  │  BLS co-sign if OK
                    └────────┬─────────┘
                             │ aggregated BLS signature
                    ┌────────▼─────────┐
                    │  LEADER'S DN     │  POST /batches/signed
                    │  + replicate     │  followers replicate to own DN
                    └────────┬─────────┘
                             │
              GET /batches/signed (public API)
                             │
               ┌─────────────┼─────────────┐
               │             │             │
       ┌───────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
       │  FRONTEND    │ │  BOTS  │ │ FIRST USER  │
       │  shows batch │ │  fetch │ │             │
       │  config      │ │  config│ │ calls       │
       │  BEFORE      │ │  BEFORE│ │ createBatch │
       │  on-chain    │ │ chain  │ │ AndJoin()   │
       └──────────────┘ └────────┘ └──────┬──────┘
                                          │ on-chain tx (BLS verified)
                                   ┌──────▼──────┐
                                   │  VISION.SOL │  batch exists on-chain
                                   │  (L3 chain) │  ONLY after first user
                                   └─────────────┘
```

**Key**: Batch is playable BEFORE it's on-chain. Frontend and bots get it from the API. First user to join creates it on-chain atomically via `createBatchAndJoin()`. Batches nobody joins are garbage collected on next config cycle.

---

## One Tick Lifecycle

```
  ◀────────────────── tick_duration (e.g. 600s) ──────────────────▶

  ┌────────────── OPEN (75%) ──────────────┐┌──── LOCKED (25%) ───┐
  │                                        ││                     │
  │  ✓ Bets accepted                       ││  ✗ No bets          │
  │  ✓ Config updates accepted             ││  ✗ No config updates│
  │  ✓ Players can join                    ││  ✗ No joins         │
  │  ✓ createBatchAndJoin() allowed        ││  ✗ All reverts      │
  │                                        ││                     │
  │  t=0                              t=450││t=450           t=600│
  └────────────────────────────────────────┘└─────────────────────┘
                                                     │
                                               TICK BOUNDARY
                                               resolve tick
                                               promote next config
```

---

## What's In a Batch Config

```
  ┌──────────────────────────────────────────────────────────────┐
  │  BATCH CONFIG  (source: "crypto", hash: 0xabc...)            │
  │                                                              │
  │  tick_duration: 600s          lock_offset: 90s               │
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  MARKET MAP  (each asset → win condition)             │   │
  │  │                                                       │   │
  │  │  ┌──────────┬────────────┬──────────┬──────────────┐ │   │
  │  │  │ Asset    │ Resolution │ Threshld │ Data Source   │ │   │
  │  │  ├──────────┼────────────┼──────────┼──────────────┤ │   │
  │  │  │ BTC      │ up_30      │ 0.3%     │ 24h_history  │ │   │
  │  │  │ ETH      │ up_30      │ 0.3%     │ 24h_history  │ │   │
  │  │  │ DOGE     │ up_300     │ 3%       │ last_batch   │ │   │
  │  │  │ BONK     │ up_3000    │ 30%      │ 24h_history  │ │   │
  │  │  │ USDT     │ flat_30    │ 0.3%     │ 24h_history  │ │   │
  │  │  │ NEW_COIN │ flat_30    │ 0.3%     │ no_data      │ │   │
  │  │  └──────────┴────────────┴──────────┴──────────────┘ │   │
  │  │                                                       │   │
  │  │  Bitmap: bit 0=BTC, bit 1=ETH, bit 2=DOGE, ...      │   │
  │  │  bit=1 → "I bet the condition WILL be met"           │   │
  │  │  bit=0 → "I bet the condition WON'T be met"          │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                                                              │
  │  configHash = keccak256(source + tick + lock + marketsRoot)  │
  │  Any change to any asset/type/threshold = different hash     │
  └──────────────────────────────────────────────────────────────┘
```

---

## Resolution Types

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ALL RESOLUTION TYPES                                                    │
  │                                                                          │
  │  Code  Name        Threshold    Meaning                        Win %    │
  │  ──    ────        ─────────    ───────                        ─────    │
  │  0     up_0        any +        price went up (any amount)      ~50%    │
  │  1     up_30       0.3%         price went up ≥ 0.3%            ~35%    │
  │  8     up_300      3%           price went up ≥ 3%              ~15%    │
  │  9     up_3000     30%          price went up ≥ 30%             ~3%     │
  │  2     up_x        custom       price went up ≥ x%             varies   │
  │                                                                          │
  │  3     down_0      any -        price went down (any amount)    ~50%    │
  │  4     down_30     0.3%         price went down ≥ 0.3%          ~35%    │
  │  10    down_300    3%           price went down ≥ 3%            ~15%    │
  │  11    down_3000   30%          price went down ≥ 30%           ~3%     │
  │  5     down_x      custom       price went down ≥ x%           varies   │
  │                                                                          │
  │  6     flat_0      ±0.01%       price unchanged                 ~5%     │
  │  7     flat_x      custom       price within ±x%               varies   │
  │  12    flat_300    ±3%          price stayed within ±3%         ~70%    │
  │  13    flat_3000   ±30%         price stayed within ±30%        ~95%    │
  │                                                                          │
  │  Each market: bit=1 means "condition met", bit=0 means "not met"        │
  │  UP vs DOWN sides matched per market (parimutuel)                        │
  │  Excess on heavier side refunded                                         │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## How Resolution Types Are Picked (From Historical Data)

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │   For each asset in the batch:                                          │
  │                                                                          │
  │   ┌──── Data Priority ─────────────────────────────────────┐            │
  │   │                                                         │            │
  │   │  1. Have 24h price history?  ──── YES ──▶  use it      │            │
  │   │     │                                                   │            │
  │   │     NO                                                  │            │
  │   │     ▼                                                   │            │
  │   │  2. Have last batch settlement?  ── YES ──▶  use it    │            │
  │   │     │                            (continue trend)       │            │
  │   │     NO                                                  │            │
  │   │     ▼                                                   │            │
  │   │  3. No data at all  ──────────▶  flat_30 (safe default)│            │
  │   │                                                         │            │
  │   └─────────────────────────────────────────────────────────┘            │
  │                                                                          │
  │   Then map avg absolute change → resolution type:                       │
  │                                                                          │
  │   ◀──── stable ──────────────────────── volatile ────▶                  │
  │                                                                          │
  │   │ < 0.3%      │  0.3% — 3%   │  3% — 30%    │  ≥ 30%     │          │
  │   │             │              │              │             │          │
  │   │  flat_30    │  up_30       │  up_300      │  up_3000    │          │
  │   │  "stay      │  "standard   │  "big move   │  "moon or   │          │
  │   │   flat?"    │   direction" │   bet"       │   crash?"   │          │
  │   │             │              │              │             │          │
  │   │  bonds      │  BTC, stocks │  altcoins    │  meme coins │          │
  │   │  USDT       │  forex       │  DeFi        │  twitch     │          │
  │   │  fed rates  │  indices     │  esports     │  pump.fun   │          │
  │                                                                          │
  │   Data comes from existing DB queries (no new queries needed):          │
  │   • get_all_24h_changes()              — already bulk, no N+1           │
  │   • get_all_last_settlement_changes()  — already bulk, no N+1           │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Full Pipeline

```
 ═══════════════════════════════════════════════════════════════════════════════
  STAGE 1: DATA-NODE GENERATES CONFIG                            every 60s
 ═══════════════════════════════════════════════════════════════════════════════

  ┌───────────────────────────────────────────────────────────────┐
  │  DATA-NODE  (batch_engine.rs)                                 │
  │                                                               │
  │  For each of 67 sources:                                      │
  │                                                               │
  │  ┌─── STEP 1: Filter healthy assets ───────────────────────┐  │
  │  │                                                          │  │
  │  │  SELECT asset_id FROM market_assets                      │  │
  │  │  WHERE source = 'crypto'                                 │  │
  │  │    AND is_active = true             ◀── no dead assets   │  │
  │  │    AND fetched_at >= NOW()-2×interval ◀── no stale data  │  │
  │  │    AND value >= 0.0001              ◀── no dust          │  │
  │  │    AND NOT IN excluded_assets       ◀── no blacklisted   │  │
  │  │    AND has ≥3 price records         ◀── no brand-new     │  │
  │  │  ORDER BY asset_id                                       │  │
  │  │  LIMIT 256                          ◀── bitmap max       │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                         │                                      │
  │                         ▼                                      │
  │  ┌─── STEP 2: Pick resolution type per asset ──────────────┐  │
  │  │                                                          │  │
  │  │  For each asset: use 24h data → last batch → flat_30     │  │
  │  │                                                          │  │
  │  │  BTC:  24h avg change = 1.2%   → up_30                  │  │
  │  │  DOGE: 24h avg change = 8.5%   → up_300                 │  │
  │  │  BONK: last batch change = 45% → up_3000                │  │
  │  │  USDT: 24h avg change = 0.02%  → flat_30                │  │
  │  │  NEW:  no data                  → flat_30                │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                         │                                      │
  │                         ▼                                      │
  │  ┌─── STEP 3: Compute config hash ─────────────────────────┐  │
  │  │                                                          │  │
  │  │  per_market = keccak256(abi.encode(                      │  │
  │  │    asset_id, resolution_type, threshold_bps))            │  │
  │  │  marketsRoot = keccak256(concat(sorted market hashes))   │  │
  │  │  configHash = keccak256(abi.encode(                      │  │
  │  │    source_id, tick_duration, lock_offset, marketsRoot))  │  │
  │  │                                                          │  │
  │  │  Hash binds EXACT market list + types + thresholds.      │  │
  │  │  Any change = different hash. Tamper = hash breaks.      │  │
  │  │                                                          │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                         │                                      │
  │                         ▼                                      │
  │             GET /batches/recommended                           │
  │             { current: [...], staged: [...] }                  │
  └───────────────────────────────────────────────────────────────┘
                            │
                            │
 ═══════════════════════════════════════════════════════════════════════════════
  STAGE 2: ORACLE BLS CONSENSUS                                every 120s
 ═══════════════════════════════════════════════════════════════════════════════
                            │
                            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  ORACLE CLUSTER                                                       │
  │                                                                       │
  │  ┌─── LEADER (round-robin) ────────────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  1. Fetch /batches/recommended from OWN data-node               │  │
  │  │  2. Filter: only configs where hash changed                     │  │
  │  │  3. Composite hash = keccak256(concat(sorted config hashes))    │  │
  │  │  4. Broadcast P2P: BatchConfigProposal                          │  │
  │  │  5. Collect BLS co-signatures                                   │  │
  │  │  6. Aggregate BLS signature                                     │  │
  │  │  7. POST /batches/signed to OWN data-node                       │  │
  │  │                                                                  │  │
  │  └──────────────────────────┬───────────────────────────────────────┘  │
  │                             │ P2P proposal                            │
  │  ┌─── FOLLOWERS ────────────▼───────────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  Each follower has ITS OWN data-node                             │  │
  │  │  Fetches /batches/recommended from ITS OWN data-node             │  │
  │  │  Verifies leader's proposal against its own view:                │  │
  │  │                                                                  │  │
  │  │  ┌────────────────────────────────────────────────────────────┐  │  │
  │  │  │ VERIFICATION CHECKS:                                       │  │  │
  │  │  │                                                            │  │  │
  │  │  │  ✓ tick_duration must match EXACTLY                        │  │  │
  │  │  │  ✓ lock_offset must match EXACTLY                          │  │  │
  │  │  │  ✓ asset_count within ±50%                                 │  │  │
  │  │  │  ✓ unknown assets < 20% of leader's list                   │  │  │
  │  │  │  ✓ threshold divergence < 50% on overlapping assets        │  │  │
  │  │  │                                                            │  │  │
  │  │  │  Pass → BLS co-sign + replicate to own data-node           │  │  │
  │  │  │  Fail → reject (leader gets no signature from this oracle) │  │  │
  │  │  └────────────────────────────────────────────────────────────┘  │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │                             │                                         │
  │                             ▼                                         │
  │  ┌─── SIGNED CONFIG ────────────────────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  Available via public API: GET /batches/signed                   │  │
  │  │  Contains: full market list + types + BLS signature              │  │
  │  │                                                                  │  │
  │  │  Frontends, bots, and users can fetch this NOW.                  │  │
  │  │  Batch is playable BEFORE anyone puts it on-chain.               │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  └───────────────────────────────────────────────────────────────────────┘
                            │
                            │ GET /batches/signed
                            │
 ═══════════════════════════════════════════════════════════════════════════════
  STAGE 3: FIRST USER CREATES BATCH ON-CHAIN                    user tx
 ═══════════════════════════════════════════════════════════════════════════════
                            │
                            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  VISION.SOL  (L3 chain)                                               │
  │                                                                       │
  │  createBatchAndJoin(                                                  │
  │    sourceId, configHash, tickDuration, lockOffset,                    │
  │    blsSignature, referenceNonce, signersBitmask,  ← from signed API  │
  │    depositAmount, stakePerTick, bitmapHash        ← user's bet       │
  │  )                                                                    │
  │                                                                       │
  │  ┌── WHAT HAPPENS ─────────────────────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  1. _createBatch():                                              │  │
  │  │     • Idempotent: if sourceId already has batch → return it      │  │
  │  │     • BLS verify: proves oracles signed this config              │  │
  │  │     • Stores: configHash, tickDuration, lockOffset               │  │
  │  │     • Emits: BatchCreated event                                  │  │
  │  │                                                                  │  │
  │  │  2. _joinBatch():                                                │  │
  │  │     • Config binding: player's configHash must match active      │  │
  │  │     • Lock check: _requireNotLocked() reverts if in lock window  │  │
  │  │     • Stores: bitmapHash, stakePerTick, deposit                  │  │
  │  │     • Emits: PlayerJoined event                                  │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │                                                                       │
  │  ┌── ON-CHAIN PROTECTIONS ─────────────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  ✓ BLS signature verified (never bypassed)                       │  │
  │  │  ✓ Lock window enforced (_requireNotLocked)                      │  │
  │  │  ✓ Config binding (bitmap locked to specific config hash)        │  │
  │  │  ✓ Idempotent creation (same source → same batch, no duplicate)  │  │
  │  │  ✓ lockOffset < tickDuration validated                           │  │
  │  │  ✓ Min stake enforced                                            │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │                                                                       │
  │  Subsequent users call joinBatch() (batch already exists).            │
  │  Config updates via updateBatchConfig() (BLS verified, never mid-tick)│
  └───────────────────────────────────────────────────────────────────────┘
                            │
                            │ events polled every 2s
                            │
 ═══════════════════════════════════════════════════════════════════════════════
  STAGE 4: CONFIG UPDATE (next tick)                              periodic
 ═══════════════════════════════════════════════════════════════════════════════
                            │
                            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  TWO-STAGE CONFIG PROMOTION                                           │
  │                                                                       │
  │  ┌── Stage 1: updateBatchConfig() ─────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  Anyone with valid BLS signature can call                        │  │
  │  │  Reverts if in lock window                                       │  │
  │  │  Writes to PENDING slot:                                         │  │
  │  │    b.nextConfigHash = newHash                                    │  │
  │  │    b.nextLockOffset = newLock                                    │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │                                                                       │
  │  ┌── Stage 2: Automatic promotion at tick boundary (lazy) ─────────┐  │
  │  │                                                                  │  │
  │  │  _promoteConfigIfNeeded() called on every user interaction       │  │
  │  │                                                                  │  │
  │  │  if currentTick > lastPromotionTick:                             │  │
  │  │    configHash = nextConfigHash         ← NOW ACTIVE              │  │
  │  │    nextConfigHash = 0                  ← CLEARED                 │  │
  │  │                                                                  │  │
  │  │  Config NEVER changes mid-tick.                                  │  │
  │  │  Players on tick N always use the config active at tick N start. │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  └───────────────────────────────────────────────────────────────────────┘
                            │
                            │
 ═══════════════════════════════════════════════════════════════════════════════
  STAGE 5: TICK RESOLUTION                                     when tick due
 ═══════════════════════════════════════════════════════════════════════════════
                            │
                            ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  TICK ENGINE  (engine.rs)                                             │
  │                                                                       │
  │  1. scheduler.get_due_batches(now)                                    │
  │  2. For each due batch:                                               │
  │     a. Fetch config by hash: GET /batches/config/{configHash}         │
  │     b. Fetch live prices: GET /vision/snapshot?source=crypto          │
  │     c. resolver.resolve_tick(batch, players, prices, market_configs)  │
  │                                                                       │
  │  ┌── PER-MARKET RESOLUTION ────────────────────────────────────────┐  │
  │  │                                                                  │  │
  │  │  For each market in config:                                      │  │
  │  │                                                                  │  │
  │  │    STALE PRICE? → Cancelled (all bettors refunded this market)   │  │
  │  │                                                                  │  │
  │  │    pct_change = (end_price - start_price) / start_price × 100    │  │
  │  │                                                                  │  │
  │  │    Resolve based on type:                                        │  │
  │  │    ┌────────────┬──────────────────────┬──────────────────────┐  │  │
  │  │    │ Type       │ Condition MET        │ Condition NOT MET    │  │  │
  │  │    ├────────────┼──────────────────────┼──────────────────────┤  │  │
  │  │    │ up_0       │ pct > 0              │ pct ≤ 0              │  │  │
  │  │    │ up_30      │ pct > 0.3%           │ pct ≤ 0.3%          │  │  │
  │  │    │ up_300     │ pct > 3%             │ pct ≤ 3%            │  │  │
  │  │    │ up_3000    │ pct > 30%            │ pct ≤ 30%           │  │  │
  │  │    │ down_0     │ pct < 0              │ pct ≥ 0              │  │  │
  │  │    │ down_30    │ pct < -0.3%          │ pct ≥ -0.3%         │  │  │
  │  │    │ down_300   │ pct < -3%            │ pct ≥ -3%           │  │  │
  │  │    │ down_3000  │ pct < -30%           │ pct ≥ -30%          │  │  │
  │  │    │ flat_0     │ |pct| < 0.01%        │ |pct| ≥ 0.01%      │  │  │
  │  │    │ flat_30    │ |pct| < 0.3%         │ |pct| ≥ 0.3%       │  │  │
  │  │    │ flat_300   │ |pct| < 3%           │ |pct| ≥ 3%         │  │  │
  │  │    │ flat_3000  │ |pct| < 30%          │ |pct| ≥ 30%        │  │  │
  │  │    └────────────┴──────────────────────┴──────────────────────┘  │  │
  │  │                                                                  │  │
  │  │  Per market, parimutuel matching:                                │  │
  │  │    bit=1 side ("condition met") vs bit=0 side ("not met")        │  │
  │  │    matched = min(side_1_total, side_0_total)                     │  │
  │  │    excess on heavier side → refunded                             │  │
  │  │    winners: payout = matched × (1 + opposing/winning)            │  │
  │  │    losers: lose matched stake                                    │  │
  │  │    all same side: everyone refunded (no opponents)               │  │
  │  │    all losers: everyone refunded                                 │  │
  │  │                                                                  │  │
  │  └──────────────────────────────────────────────────────────────────┘  │
  │                                                                       │
  │  3. POST /batches/settlement → settlement data feeds next config      │
  └───────────────────────────────────────────────────────────────────────┘
```

---

## Source Downtime Handling

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  SOURCE GOES DOWN FOR 20 MINUTES                                        │
  │                                                                          │
  │  Timeline:                                                              │
  │                                                                          │
  │  t=0          source healthy, assets in batch                            │
  │  t=5min       source goes DOWN                                          │
  │  t=10min      prices become stale (2× sync_interval for 300s source)    │
  │  t=15min      ┌─────────────────────────────────────────────────┐       │
  │               │ TICK RESOLVES:                                   │       │
  │               │   resolver checks prices.is_stale() per market  │       │
  │               │   stale markets → Cancelled → all refunded      │       │
  │               │   non-stale markets → resolve normally           │       │
  │               └─────────────────────────────────────────────────┘       │
  │  t=20min      source comes BACK                                         │
  │  t=21min      new prices arrive, assets become healthy                  │
  │  t=22min      ┌─────────────────────────────────────────────────┐       │
  │               │ NEXT CONFIG GENERATED:                           │       │
  │               │   get_healthy_assets() includes them again       │       │
  │               │   new configHash (assets may have changed)       │       │
  │               │   BLS consensus → signed → available via API     │       │
  │               └─────────────────────────────────────────────────┘       │
  │                                                                          │
  │  Self-healing. No manual intervention.                                  │
  │  Players never lose money to stale data — cancelled markets = refund.   │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## Lock Period — All Layers

```
  TIME ──────────────────────────────────────────────▶

  ┌─── OPEN (75%) ─────────────────────┐┌─── LOCKED (25%) ──────┐
  │  t=0                          t=450││t=450              t=600│
  └────────────────────────────────────┘└────────────────────────┘
                                         │
  ┌─ DATA-NODE ──────────────────────────┤
  │  OPEN:   recompute config normally   │
  │  LOCKED: FREEZE current config       │
  │          pre-compute STAGED config   │
  │          for next tick               │
  │          API: /batches/recommended   │
  │          returns { current, staged } │
  └──────────────────────────────────────┤
                                         │
  ┌─ ORACLE ORCHESTRATOR ────────────────┤
  │  OPEN:   BLS consensus + push to DN  │
  │  LOCKED: QUEUE updateBatchConfig()   │
  │          flush at next tick start    │
  └──────────────────────────────────────┤
                                         │
  ┌─ VISION.SOL (on-chain) ─────────────┤
  │  OPEN:   all operations allowed      │
  │  LOCKED: _requireNotLocked()         │
  │          REVERTS:                    │
  │            updateBatchConfig()       │
  │            updateBitmap()            │
  │            joinBatch()               │
  │            createBatchAndJoin()      │
  └──────────────────────────────────────┤
                                         │
  ┌─ FRONTEND / BOTS ───────────────────┤
  │  OPEN:   submit bets, join batches   │
  │  LOCKED: UI shows "LOCKED"           │
  │          multiplier = 0              │
  │          can view STAGED config      │
  │          (prepare for next tick)     │
  └──────────────────────────────────────┘
                                         │
                                    TICK BOUNDARY (t=600)
                                         │
                                         ▼
                              _promoteConfigIfNeeded()
                              staged config → active
                              tick resolves
```

---

## Feedback Loop

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │       ┌──────────────┐            POST /batches/settlement          │
  │       │  DATA-NODE   │◀────────────────────────────────┐            │
  │       │              │                                  │            │
  │       │  24h history ─┐                                 │            │
  │       │  last settle ─┤──▶ pick resolution type         │            │
  │       │  no data     ─┘   per asset                     │            │
  │       └──────┬───────┘                                  │            │
  │              │                                          │            │
  │   GET /batches/recommended                              │            │
  │              │                                          │            │
  │              ▼                                          │            │
  │   ┌──────────────────┐                                  │            │
  │   │ ORACLE CONSENSUS │  BLS multi-sign                  │            │
  │   └────────┬─────────┘                                  │            │
  │            │                                            │            │
  │   GET /batches/signed                                   │            │
  │            │                                            │            │
  │   ┌───────┼────────┐                                    │            │
  │   │       │        │                                    │            │
  │   ▼       ▼        ▼                                    │            │
  │  FE    BOTS    FIRST USER ──▶ createBatchAndJoin()      │            │
  │                                      │                  │            │
  │                               VISION.SOL (on-chain)     │            │
  │                                      │                  │            │
  │                              chain listener → scheduler │            │
  │                                      │                  │            │
  │                               TICK ENGINE               │            │
  │                               resolve_tick() ───────────┘            │
  │                               settlement records feed               │
  │                               back into next config                 │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Protection Summary

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                      ALL PROTECTIONS                                     │
  │                                                                          │
  │  ┌── ASSET QUALITY ─────────────────────────────────────────────────┐   │
  │  │  ✓ Stale data filtered (2× sync interval)                       │   │
  │  │  ✓ Dead assets auto-deactivated (5× sync interval)              │   │
  │  │  ✓ Dust values excluded (min 0.0001)                            │   │
  │  │  ✓ New assets need ≥3 price records                             │   │
  │  │  ✓ Manual exclusion list for known-bad assets                   │   │
  │  │  ✓ Max 256 markets per batch (bitmap = uint256)                 │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  │  ┌── CONFIG INTEGRITY ──────────────────────────────────────────────┐   │
  │  │  ✓ configHash = keccak256 of full market list + types            │   │
  │  │  ✓ Any tampering breaks the hash                                 │   │
  │  │  ✓ Sorted by asset_id → deterministic ordering                   │   │
  │  │  ✓ Hash matches Solidity abi.encode (cross-verified)             │   │
  │  │  ✓ Bitmap bound to specific configHash on-chain                  │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  │  ┌── CONSENSUS ─────────────────────────────────────────────────────┐   │
  │  │  ✓ BLS multi-signature (2/3+ oracles)                            │   │
  │  │  ✓ Each oracle verifies against ITS OWN data-node                │   │
  │  │  ✓ tick_duration + lock_offset must match EXACTLY                │   │
  │  │  ✓ Asset count tolerance ±50%                                    │   │
  │  │  ✓ Unknown assets < 20%                                          │   │
  │  │  ✓ Threshold divergence < 50%                                    │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  │  ┌── ON-CHAIN ──────────────────────────────────────────────────────┐   │
  │  │  ✓ BLS verified on createBatch AND updateBatchConfig             │   │
  │  │  ✓ Lock window enforced (_requireNotLocked)                      │   │
  │  │  ✓ Two-stage promotion (config never changes mid-tick)           │   │
  │  │  ✓ Idempotent batch creation (same source → same batch)          │   │
  │  │  ✓ Config binding (player bitmap locked to specific configHash)  │   │
  │  │  ✓ lockOffset < tickDuration validated                           │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  │  ┌── TIMING ────────────────────────────────────────────────────────┐   │
  │  │  ✓ Data-node freezes config during lock period                   │   │
  │  │  ✓ Oracle queues submission if in lock window                    │   │
  │  │  ✓ On-chain reverts if submitted during lock                     │   │
  │  │  ✓ Frontend disables interaction during lock                     │   │
  │  │  ✓ Staged config available for next-tick preparation             │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  │  ┌── SOURCE DOWNTIME ───────────────────────────────────────────────┐   │
  │  │  ✓ Stale prices → market Cancelled → all bettors refunded        │   │
  │  │  ✓ Assets auto-excluded from next config when stale              │   │
  │  │  ✓ Auto-included again when source recovers                      │   │
  │  │  ✓ No manual intervention needed                                 │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                          │
  │  ┌── RESOLUTION FAIRNESS ───────────────────────────────────────────┐   │
  │  │  ✓ Per-market side matching (parimutuel)                         │   │
  │  │  ✓ Excess on heavier side refunded (whale safety)                │   │
  │  │  ✓ All same side → everyone refunded                             │   │
  │  │  ✓ All losers → everyone refunded                                │   │
  │  │  ✓ Zero-sum per tick (total in = total out)                      │   │
  │  │  ✓ Resolution types matched to asset volatility from real data   │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────────────────────────┘
```
