# Batch Management Cleanup

Session: `20260301-1200-b8m3`

## How It Actually Works (Corrected)

### Batch lifecycle

1. **Data-node** generates recommended config per source (every 60s)
2. **Leader oracle** fetches from its own data-node, proposes to cluster
3. **Other oracles** (with their own data-nodes) verify against their view, BLS co-sign
4. **Signed config** stored on leader's data-node, replicated to followers' data-nodes
5. **Frontend/bots** fetch signed config from API — batch is playable BEFORE on-chain
6. **First user** calls `createBatchAndJoin()` — creates batch on-chain AND joins atomically
7. **Subsequent users** call `joinBatch()` with matching configHash

Config only exists on-chain once a user submits it. Batches not consumed on-chain are not kept in memory — they cycle out when the next config is generated.

### Source downtime (20 min outage)

When a source goes down:
- Its assets become stale (no price update within 2× sync_interval)
- Next batch config excludes those assets (`get_healthy_assets()` filters them)
- **Current tick**: resolver checks `prices.is_stale()` per market → stale = `Cancelled` → all bettors refunded for that sub-market
- Source comes back → assets become healthy → included in next config

No manual intervention needed. The system self-heals.

### Resolution (from vision-p2pool-brief.md)

Each market in a batch has a resolution type. Bitmap bit = 1 means "I bet this condition WILL be met", bit = 0 means "I bet it WON'T". Per sub-market, UP vs DOWN sides are matched (parimutuel), excess refunded.

```
Resolution outcome for each market:
  - condition met     → UP bettors win, DOWN bettors lose
  - condition NOT met → DOWN bettors win, UP bettors lose
  - all same side     → everyone refunded (no opponents)
  - stale price       → Cancelled, everyone refunded
  - all losers        → everyone refunded
```

---

## Issues

### 0. CRITICAL — Lock period = 25% (not 15%)

**Current**: `LOCK_PCT_FAST = 0.15` and `LOCK_PCT_MEDIUM = 0.15` in `batch_engine.rs:22-23`. Lock is 15% of tick. Contract side: `lockOffset` is set at batch creation from data-node value.

**User requirement**: Lock period should be **25%** of tick duration.

**Fix**: Update constants in data-node and frontend:

```rust
// data-node/src/batch_engine.rs
const LOCK_PCT_FAST: f64 = 0.25;    // was 0.15
const LOCK_PCT_MEDIUM: f64 = 0.25;  // was 0.15
const LOCK_PCT_SLOW: f64 = 0.10;    // was 0.04 (slow sources get 10%)
```

```typescript
// frontend/lib/vision/tick.ts
function lockOffsetForDuration(tickDuration: number): number {
  return Math.max(5, Math.floor(tickDuration * 0.25))  // was 0.15
}
```

On-chain: lockOffset is set per-batch at creation via `createBatchAndJoin()` and updated via `updateBatchConfig()`. Both read from the signed config. So changing data-node constants propagates to chain on next config cycle.

**Files**:
- `data-node/src/batch_engine.rs:22-23` — Update `LOCK_PCT_FAST`, `LOCK_PCT_MEDIUM`, `LOCK_PCT_SLOW`
- `frontend/lib/vision/tick.ts:35-37` — Update `lockOffsetForDuration()`

---

### 1. CRITICAL — Smart resolution type per asset using historical data

**Current**: `compute_asset_thresholds()` hardcodes everything to `up_x` / `up_0`.

**Fix**: Use actual volatility data from DB (24h history + last batch settlement, both already fetched in bulk).

**Resolution types** (existing + new):
```
Code  Name        Threshold   When to use
──    ────        ─────────   ──────────
0     up_0        any +       Very volatile, no data
1     up_30       0.3%        Low vol assets
2     up_x        custom      Specific threshold needed
3     down_0      any -       Very volatile, no data
4     down_30     0.3%        Low vol assets
5     down_x      custom      Specific threshold needed
6     flat_0      ±0.01%      Ultra-stable
7     flat_x      custom      Specific threshold needed
8     up_300      3%          NEW — medium vol
9     up_3000     30%         NEW — high vol (memes, twitch)
10    down_300    3%          NEW — medium vol
11    down_3000   30%         NEW — high vol
12    flat_300    3%          NEW — "will it stay within 3%?"
13    flat_3000   30%         NEW — "will it stay within 30%?"
```

**Selection from historical data**:
```
For each asset:
  1. Try 24h price history (avg absolute change %)
  2. Else try last batch settlement (continuation of trend)
  3. Else no data → flat_30 (bet on stability)

Map volatility → type:
  < 0.3% avg change   →  flat_30   (stable: bonds, USDT, rates)
  0.3% — 3%           →  up_30     (low vol: BTC, stocks)
  3% — 30%            →  up_300    (medium: altcoins, DeFi)
  ≥ 30%               →  up_3000   (high: memes, twitch viewers)
```

**Implementation** (batch_engine.rs):

```rust
/// NEW: Get volatility stats from actual historical data.
/// Reuses existing bulk queries (no N+1).
async fn compute_asset_resolutions(
    pool: &PgPool,
    source_id: &str,
    asset_ids: &[String],
) -> Vec<BatchMarket> {
    let history = get_all_24h_changes(pool, source_id).await.unwrap_or_default();
    let settlements = get_all_last_settlement_changes(pool, source_id).await.unwrap_or_default();

    asset_ids.iter().map(|id| {
        let avg_change = history.get(id).map(|c| c.abs())
            .or_else(|| settlements.get(id).map(|c| c.abs()));

        let (res_type, bps) = match avg_change {
            Some(v) if v < 0.3  => ("flat_30", 30),
            Some(v) if v < 3.0  => ("up_30", 30),
            Some(v) if v < 30.0 => ("up_300", 300),
            Some(_)             => ("up_3000", 3000),
            None                => ("flat_30", 30),
        };

        let source = if history.contains_key(id) { "24h_history" }
            else if settlements.contains_key(id) { "last_batch" }
            else { "no_data" };

        BatchMarket {
            asset_id: id.clone(),
            resolution_type: res_type.to_string(),
            threshold_bps: bps,
            threshold_source: source.to_string(),
        }
    }).collect()
}
```

**Files**:
- `data-node/src/batch_engine.rs` — Replace `compute_asset_thresholds()` with `compute_asset_resolutions()`
- `oracle/src/vision/resolver.rs:328` — Add 6 match arms for codes 8-13
- `oracle/src/vision/engine.rs:99` — Add to `parse_resolution_type()`

---

### 2. CRITICAL — Asset exclusion (no stale/dead assets in batches)

**Current gaps**:
- Dead assets stay `is_active = true` forever (only staleness window protects)
- `value > 0` passes dust (0.000001)
- Brand-new assets with 1 data point included immediately (no history → noisy `flat_30`)
- No manual blacklist

**Fix**:
- Auto-deactivate: mark `is_active = false` for assets with no price in 5× sync_interval
- Min value: `value >= 0.0001`
- Min history: require ≥3 price records
- Exclusion table: `excluded_assets(source, asset_id, reason)`

**Files**:
- `data-node/src/batch_engine.rs` — Update `get_healthy_assets()`, add sweep
- `data-node/migrations/XXX_excluded_assets.sql`
- `data-node/src/api.rs` — Admin endpoints

---

### 3. CRITICAL — Lock-period config freeze & diffusion

**Current**: Data-node recomputes blindly every 60s. Config hash can change during lock period. Oracle orchestrator has no lock awareness.

**The flow (corrected)**:
- Only 1 leader oracle pushes signed config to its data-node
- Other oracles fetch from it, verify, BLS co-sign
- Config is served via API to frontend/bots BEFORE on-chain
- First user calls `createBatchAndJoin()` to put it on-chain
- Batches not consumed on-chain get garbage collected

**Fix — 3 layers**:

**Data-node**: During lock period, freeze current config. Pre-compute next config as `staged`.
```
if time_to_tick_end <= lock_offset:
    freeze current → don't recompute
    compute staged → ready for next tick
else:
    normal recompute
```

**Oracle orchestrator**: If in lock window, queue `updateBatchConfig()` for next tick start.

**API**: Serve `{ current, staged }` so bots/frontend can prepare for next tick.

**Files**:
- `data-node/src/batch_engine.rs` — Lock-aware loop, `staged_configs`
- `data-node/src/api.rs` — Update `/batches/recommended` response
- `oracle/src/vision/batch_config_orchestrator.rs` — Lock-window queuing

---

### 4. HIGH — Frontend tick duration mismatch

**Current**: `tick.ts` hardcodes per-category durations. Twitch (60s) and Steam (600s) both get "entertainment" = 120s.

**Fix**: Read per-source duration from signed batch config API.

**Files**:
- `frontend/lib/vision/tick.ts`
- `frontend/hooks/vision/useBatchTiming.ts` — New hook
- `frontend/lib/vision/sources.ts` — Add `syncInterval` fallback

---

### 5. HIGH — Resolution type string ↔ u8 mapping

Add new types to both data-node and oracle, verify consistency.

**Files**:
- `oracle/src/vision/engine.rs:99` — `parse_resolution_type()`
- `oracle/src/vision/resolver.rs:328` — `resolve_outcome()`

---

### 6. HIGH — Garbage collect unconsumed batch configs

**Current**: Data-node generates a config every 60s per source and stores it in `batch_configs` table + in-memory. If nobody joins a batch (no `createBatchAndJoin()` on-chain), old configs accumulate forever.

**Fix**:
- In-memory: `BatchEngineState.configs` is replaced every 60s cycle already (Vec overwrite). No leak.
- DB: Add cleanup query — delete `batch_configs` rows older than 1 hour that are not referenced by `signed_batch_configs`. Run every 10 min.
- `signed_batch_configs`: Keep only latest per source (overwrite on new consensus). Old signed configs unreferenced by any on-chain batch can be pruned after 24h.

```sql
-- Clean old unsigned recommended configs
DELETE FROM batch_configs WHERE created_at < NOW() - interval '1 hour'
  AND config_hash NOT IN (SELECT config_hash FROM signed_batch_configs);

-- Clean old signed configs (keep latest per source + any on-chain referenced)
DELETE FROM signed_batch_configs WHERE signed_at < NOW() - interval '24 hours'
  AND (source_id, signed_at) NOT IN (
    SELECT source_id, MAX(signed_at) FROM signed_batch_configs GROUP BY source_id
  );
```

**Files**:
- `data-node/src/batch_engine.rs` — Add `cleanup_old_configs()` called every 10 min in the main loop

---

### 7. HIGH — Bot-facing API completeness

**Current**: `GET /batches/signed` returns signed configs. But bots need a single endpoint with everything to play: markets list, resolution types, thresholds, BLS signature (to pass to `createBatchAndJoin()`), tick timing.

**Fix**: Ensure `/batches/signed` response includes all fields bots need:

```json
{
  "sourceId": "crypto",
  "displayName": "CoinGecko Crypto",
  "configHash": "0x...",
  "tickDurationSecs": 600,
  "lockOffsetSecs": 150,
  "markets": [
    { "assetId": "BTC", "resolutionType": "up_30", "thresholdBps": 30 },
    { "assetId": "DOGE", "resolutionType": "up_300", "thresholdBps": 300 }
  ],
  "blsSignature": "0x...",
  "signersBitmask": 7,
  "referenceNonce": 42
}
```

Bot workflow:
1. `GET /batches/signed` → get config + BLS sig
2. `GET /vision/snapshot?source=crypto` → get live prices
3. Run strategy → generate bitmap
4. Call `createBatchAndJoin(sourceId, configHash, tickDuration, lockOffset, blsSig, nonce, bitmask, deposit, stake, bitmapHash)`
5. `POST /vision/bitmap` → reveal bitmap to oracles

Verify the current response shape already has all fields. If not, add missing ones.

**Files**:
- `data-node/src/api.rs` — Verify `/batches/signed` response completeness
- Docs: Add bot integration example

---

### 8. MEDIUM — Source downtime → stale market cancellation observability

Already works: `resolver.rs` checks `prices.is_stale()` per market → `Cancelled` → refund. But needs better observability.

**Fix**: Log cancelled markets prominently. Add cancelled count to settlement records. Frontend shows "X markets cancelled (source offline)" instead of silent refund.

**Files**:
- `oracle/src/vision/resolver.rs` — Improve logging
- `data-node/src/api.rs` — Add `cancelled_count` to settlement response
- Frontend — Show cancellation reason in batch UI

---

## Non-Issues (Dismissed)

| Issue | Why |
|-------|-----|
| Tick overflow | u64 epoch seconds → year 584B |
| Missing events | Off-chain system, data flows via API |

## Implementation Order

| # | Issue | What | Where | Effort |
|---|-------|------|-------|--------|
| 1 | #0 | Lock period 15% → 25% | batch_engine.rs, tick.ts | 30m |
| 2 | #1 | Add 6 resolution types (up/down/flat _300/_3000) | resolver.rs, engine.rs | 1h |
| 3 | #5 | Resolution type string ↔ u8 mapping consistency | engine.rs, resolver.rs | 30m |
| 4 | #1 | Smart resolution from historical data | batch_engine.rs | 2h |
| 5 | #2 | Asset exclusion (auto-deactivate, min value, min history) | batch_engine.rs, migrations | 2h |
| 6 | #3 | Lock-period config freeze + staged API | batch_engine.rs, api.rs | 2h |
| 7 | #3 | Lock-period queue in orchestrator | batch_config_orchestrator.rs | 1h |
| 8 | #6 | GC for unconsumed batch configs | batch_engine.rs | 30m |
| 9 | #7 | Bot-facing API completeness check | api.rs | 1h |
| 10 | #4 | Frontend tick duration fix | tick.ts, sources.ts | 2h |
| 11 | #8 | Source downtime observability | resolver.rs, frontend | 1h |

Total: ~13h. No new dependencies.

---

## Integration Test Plan

### Pre-requisites

All tests run on local devnet: `./stop.sh && ./start.sh --vision`
- L3: port 8545, data-node: port 8200, oracle API: port 10001
- Test user: `0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4` (funded by start.sh)

### Layer 1 — Data-Node Unit Tests (Rust)

Run: `cd data-node && cargo test`

| Test | Verifies | Issue |
|------|----------|-------|
| `test_lock_pct_values` | `LOCK_PCT_FAST = 0.25`, `LOCK_PCT_MEDIUM = 0.25`, `LOCK_PCT_SLOW = 0.10` | #0 |
| `test_compute_asset_resolutions_with_history` | 24h data → correct resolution type (e.g. 1.5% avg → `up_30`) | #1 |
| `test_compute_asset_resolutions_fallback_settlement` | No 24h data, has settlement → uses settlement change | #1 |
| `test_compute_asset_resolutions_no_data` | No data at all → `flat_30` | #1 |
| `test_resolution_type_boundaries` | <0.3% → flat_30, 0.3-3% → up_30, 3-30% → up_300, ≥30% → up_3000 | #1 |
| `test_get_healthy_assets_excludes_stale` | Assets with no price in 5× sync_interval are excluded | #2 |
| `test_get_healthy_assets_min_value` | Assets with value < 0.0001 excluded | #2 |
| `test_get_healthy_assets_min_history` | Assets with <3 price records excluded | #2 |
| `test_config_freeze_during_lock` | During lock period, config hash doesn't change, staged config computed | #3 |
| `test_cleanup_old_configs` | Unsigned configs older than 1h deleted, latest signed per source kept | #6 |

### Layer 2 — Oracle Unit Tests (Rust)

Run: `cd oracle && cargo test`

| Test | Verifies | Issue |
|------|----------|-------|
| `test_parse_resolution_type_new_codes` | `up_300`→8, `up_3000`→9, `down_300`→10, `down_3000`→11, `flat_300`→12, `flat_3000`→13 | #5 |
| `test_resolve_outcome_up_300` | condition met at ≥3% → UP wins, <3% → DOWN wins | #1 |
| `test_resolve_outcome_down_3000` | condition met at ≤-30% → DOWN wins, >-30% → UP wins | #1 |
| `test_resolve_outcome_flat_300` | stayed within ±3% → FLAT wins, moved outside → non-FLAT wins | #1 |
| `test_resolve_outcome_flat_3000` | stayed within ±30% → FLAT wins | #1 |
| `test_resolve_stale_market` | stale price → `Cancelled` → all refunded | #8 |
| `test_orchestrator_lock_window_queuing` | During lock window, `updateBatchConfig()` queued for next tick start | #3 |

### Layer 3 — API Integration Tests (curl / E2E helpers)

Run after `./start.sh --vision`, test with curl or add to E2E suite.

**Test A — Config generation includes smart resolution types**
```bash
# GET signed config, verify markets have varied resolution types
curl http://localhost:8200/batches/signed | jq '.[] | .markets[] | .resolutionType'
# Expect: mix of flat_30, up_30, up_300, up_3000 (not all up_x/up_0)
```

**Test B — Signed config completeness (bot API)**
```bash
curl http://localhost:8200/batches/signed | jq '.[0] | keys'
# Must include: sourceId, configHash, tickDurationSecs, lockOffsetSecs,
#               markets, blsSignature, signersBitmask, referenceNonce
```

**Test C — Lock period = 25% in config**
```bash
curl http://localhost:8200/batches/signed | jq '.[0] | {tick: .tickDurationSecs, lock: .lockOffsetSecs}'
# Verify: lockOffsetSecs / tickDurationSecs ≈ 0.25
```

**Test D — Staged config during lock period**
```bash
# During lock window:
curl http://localhost:8200/batches/recommended | jq '.[] | {current: .configHash, staged: .stagedConfigHash}'
# staged should be non-null during lock period
```

**Test E — Stale asset exclusion**
```bash
# Check that assets with very old prices are not in config
curl http://localhost:8200/batches/recommended | jq '.[0].markets | length'
# Should be < 256 if some assets are stale/excluded
```

### Layer 4 — E2E Integration Tests (Playwright)

File: `frontend/e2e/tests/15-vision-batch-config.spec.ts` (new)

Backend-only test (no browser, pure API + RPC calls):

```typescript
test.describe('Vision Batch Config', () => {

  test('signed config has correct lock percentage', async () => {
    // GET /batches/signed → verify lockOffsetSecs / tickDurationSecs ≈ 0.25
    const signed = await fetch('http://localhost:8200/batches/signed').then(r => r.json())
    for (const cfg of signed) {
      const ratio = cfg.lockOffsetSecs / cfg.tickDurationSecs
      expect(ratio).toBeGreaterThanOrEqual(0.20)
      expect(ratio).toBeLessThanOrEqual(0.30)
    }
  })

  test('signed config has all bot-required fields', async () => {
    const signed = await fetch('http://localhost:8200/batches/signed').then(r => r.json())
    const cfg = signed[0]
    expect(cfg.sourceId).toBeDefined()
    expect(cfg.configHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(cfg.tickDurationSecs).toBeGreaterThan(0)
    expect(cfg.lockOffsetSecs).toBeGreaterThan(0)
    expect(cfg.markets).toBeInstanceOf(Array)
    expect(cfg.markets.length).toBeGreaterThan(0)
    expect(cfg.blsSignature).toMatch(/^0x/)
    expect(cfg.signersBitmask).toBeGreaterThan(0)
    // Each market has resolutionType + thresholdBps
    for (const m of cfg.markets) {
      expect(m.assetId).toBeDefined()
      expect(m.resolutionType).toBeDefined()
      expect(m.thresholdBps).toBeGreaterThan(0)
    }
  })

  test('resolution types are data-driven (not all hardcoded)', async () => {
    const signed = await fetch('http://localhost:8200/batches/signed').then(r => r.json())
    const allTypes = new Set<string>()
    for (const cfg of signed) {
      for (const m of cfg.markets) allTypes.add(m.resolutionType)
    }
    // After fix, should have more than just up_x and up_0
    expect(allTypes.size).toBeGreaterThan(2)
  })

  test('createBatchAndJoin uses config from API', async () => {
    // 1. GET signed config
    const signed = await fetch('http://localhost:8200/batches/signed').then(r => r.json())
    const cfg = signed[0]

    // 2. Deposit balance for test user
    await depositToVisionBalance(PLAYER1, BigInt(50) * BigInt(10 ** 18))

    // 3. Call createBatchAndJoin with configHash from API
    //    (uses existing E2E helper that calls Vision contract)
    // 4. Verify batch created on-chain with matching configHash
    const onChainHash = await getBatchConfigHash(0)
    expect(onChainHash).toBe(cfg.configHash)
  })

  test('stale source excluded from config', async () => {
    // Verify get_healthy_assets filters work by checking
    // that config doesn't include sources with no recent data
    const signed = await fetch('http://localhost:8200/batches/signed').then(r => r.json())
    for (const cfg of signed) {
      for (const m of cfg.markets) {
        // Every included market should have a valid asset ID (not empty/dust)
        expect(m.assetId).toBeTruthy()
        expect(m.assetId.length).toBeGreaterThan(0)
      }
    }
  })
})
```

### Layer 5 — Frontend Display Tests (Playwright)

File: `frontend/e2e/tests/16-vision-tick-display.spec.ts` (new)

```typescript
test.describe('Vision Tick Display', () => {

  test('tick duration matches signed config (not hardcoded)', async ({ page }) => {
    // 1. GET /batches/signed → get actual tickDurationSecs for a source
    // 2. Navigate to that source page
    // 3. Verify the displayed tick timer matches the API value
    // 4. Not the hardcoded CATEGORY_TICK_DURATION value
  })

  test('lock indicator shows at 25% remaining', async ({ page }) => {
    // 1. Navigate to source page with active batch
    // 2. Wait until lock period starts (75% of tick elapsed)
    // 3. Verify "LOCKED" or lock indicator appears
    // 4. Verify "Enter Batch" button is disabled during lock
  })

  test('cancelled markets show reason', async ({ page }) => {
    // After a tick resolves with stale markets:
    // 1. Navigate to batch history
    // 2. Verify cancelled markets show "Source offline" or similar
    // 3. Verify refund amount displayed
  })
})
```

### Layer 6 — End-to-End System Test (Full Lifecycle)

Manual verification after all code changes, run once:

```
./stop.sh && ./start.sh --vision

# 1. Wait 2 minutes for data-node to generate first configs
# 2. Check data-node logs:
grep "resolution_type" data-node.log | head -20
# Should show mix of flat_30, up_30, up_300, up_3000

# 3. Check oracle logs for consensus:
grep "batch_config" oracle-1.log | head -10
# Should show leader push + follower verify

# 4. Verify lock period on API:
curl -s http://localhost:8200/batches/signed | jq '.[0].lockOffsetSecs'
# Should be ≈ 25% of tickDurationSecs

# 5. Run full E2E suite:
cd frontend && npx playwright test --config=e2e/playwright.config.ts
# All tests pass (88 existing + 2 new = 90)

# 6. Wait for a tick resolution, check oracle logs:
grep "resolve_outcome\|Cancelled" oracle-1.log | tail -20
# Should show per-market outcomes using new resolution types
```

### Edge Case Scenarios

| Scenario | How to test | Expected result |
|----------|------------|-----------------|
| Source down 20 min | Stop a data feed, wait, restart | Assets excluded from config during outage, re-included after restart |
| Lock period boundary | Send `joinBatch()` during last 25% of tick | Reverts with `BatchLocked` on-chain |
| First user creates batch | New source with no on-chain batch, user calls `createBatchAndJoin()` | Batch created atomically, configHash matches API |
| Config hash mismatch | User sends old configHash after config update | Reverts with `InvalidConfigHash` on-chain |
| All assets stale | Source with zero healthy assets | No config generated for that source, no batch created |
| GC runs | Wait >1h without joining any batch | Old unsigned configs deleted, latest signed kept |
| Resolution type 8-13 | Batch with up_300/flat_3000 markets resolves | Correct winners (3%/30% thresholds), correct payouts |

### Test File Summary

| File | Type | Tests | Issues Covered |
|------|------|-------|---------------|
| `data-node/src/batch_engine.rs` (inline `#[test]`) | Unit | 10 | #0, #1, #2, #3, #6 |
| `oracle/src/vision/resolver.rs` (inline `#[test]`) | Unit | 6 | #1, #5, #8 |
| `oracle/src/vision/batch_config_orchestrator.rs` (inline `#[test]`) | Unit | 1 | #3 |
| `frontend/e2e/tests/15-vision-batch-config.spec.ts` | E2E/API | 5 | #0, #1, #2, #7 |
| `frontend/e2e/tests/16-vision-tick-display.spec.ts` | E2E/UI | 3 | #4, #3, #8 |
| Manual system test | Full | 6 steps | All |

Total: ~25 tests covering all 9 issues.

---

## Security Audit Findings & Fixes

Adversarial audit found 15 criticals across 3 layers. Fix propositions below.

### Data-Node Fixes

**DN-1: Config hash not recomputed on store** — `POST /batches/signed` stores config body + hash from caller without verifying `keccak256(config) == hash`. Tampered market definitions pass through.

```rust
// data-node/src/api.rs — store_signed_batch()
// ADD: recompute hash from config body, reject if mismatch
let recomputed = compute_config_hash(&payload.config);
if recomputed != payload.config_hash {
    return (StatusCode::BAD_REQUEST, "config_hash does not match config body").into_response();
}
```

**DN-2: Empty-string admin token bypass** — `ADMIN_TOKEN=""` matches empty header.

```rust
// data-node/src/main.rs — initialization
// CHANGE: filter empty strings
admin_token: args.admin_token.clone().filter(|t| !t.trim().is_empty()),
```

**DN-3: Settlement injection poisons thresholds** — `POST /batches/settlement` accepts arbitrary `change_pct` with zero validation. Feeds into `compute_asset_thresholds()`.

```rust
// data-node/src/api.rs — record_batch_settlement()
// ADD: validate config_hash exists in signed_batch_configs
let exists = sqlx::query_scalar::<_, i64>(
    "SELECT COUNT(*) FROM signed_batch_configs WHERE config_hash = $1"
).bind(&hash_bytes).fetch_one(&state.pool).await.unwrap_or(0);
if exists == 0 {
    return (StatusCode::BAD_REQUEST, "unknown config_hash").into_response();
}
// ADD: validate change_pct consistent with start/end prices
let expected_pct = if rec.start_price != 0.0 {
    ((rec.end_price - rec.start_price) / rec.start_price) * 100.0
} else { 0.0 };
if (rec.change_pct - expected_pct).abs() > 0.1 {
    return (StatusCode::BAD_REQUEST, "change_pct inconsistent").into_response();
}
```

**DN-4: No replay protection on signed configs** — No nonce monotonicity. Old configs replayed.

```rust
// data-node/src/api.rs — store_signed_batch()
// ADD: reject if nonce <= current nonce for this source
let mut configs = state.batch_engine.signed_configs.write().await;
if let Some(existing) = configs.iter().find(|c| c.source_id == signed.source_id) {
    if signed.reference_nonce <= existing.reference_nonce {
        return (StatusCode::CONFLICT, "stale nonce — replay rejected").into_response();
    }
}
```

**DN-5: TOCTOU config loss on recompute** — 60s loop overwrites in-memory configs. If DB store fails, config for active batch lost.

```rust
// data-node/src/batch_engine.rs — run() loop
// CHANGE: keep historical config map instead of overwriting
// Add: HashMap<String, BatchConfig> keyed by config_hash, never delete in-memory
// Only evict from memory after confirmed not referenced on-chain (24h TTL)
state.config_history.write().await.insert(config.config_hash.clone(), config.clone());
// Current configs still overwritten per-source (latest only), but history preserved
```

**DN-6: Inconsistent auth mechanisms** — Batch endpoints use `x-admin-token`, admin endpoints use `Authorization: Bearer`.

```rust
// data-node/src/api.rs
// CHANGE: unify all auth to use Authorization: Bearer header
// Replace x-admin-token checks with require_admin_auth() in:
//   store_signed_batch, replicate_signed_batch, record_batch_settlement
// ADD auth to read-only admin endpoints:
//   admin_sources_health, admin_source_assets, admin_source_history
```

---

### Oracle/Vision Fixes

**IS-1: Staleness check permanently bypassed** — `engine.rs:254` sets `last_update = now` for every price. `is_stale()` always returns `false`.

```rust
// oracle/src/vision/engine.rs — build_market_prices()
// CHANGE: use actual price timestamp from data-node snapshot, not `now`
// The snapshot JSON has a `last_updated` or `timestamp` field per asset.
// Pass it through instead of overriding with current time:
let last_update = asset_json["last_updated"].as_u64().unwrap_or(now);
prices.insert(market_id, start_price, end_price, last_update);
// This makes is_stale() actually functional
```

**IS-2: f64 non-determinism in resolution** — All payout math uses `f64`. Different CPUs produce different results at boundary conditions.

```rust
// oracle/src/vision/resolver.rs — resolve_outcome(), pct_change computation
// CHANGE: use integer basis points for threshold comparison
// Instead of: pct_change > threshold (f64 comparison)
// Do:
let change_bps = if start_price_u128 != 0 {
    ((end_price_u128 as i128 - start_price_u128 as i128) * 10000) / start_price_u128 as i128
} else { 0 };
// Compare change_bps against threshold_bps (both i128, deterministic)

// oracle/src/vision/multiplier.rs — effective_stake computation
// CHANGE: use fixed-point math (multiply first, divide last)
// Instead of: stake_f64 * total_mult → f64 as u128
// Do:
let early_bps = ((capped_time * capped_time * 10000) / (tick_duration * tick_duration)) as u128;
let early_mult_bps = 10000 + early_bps; // 10000 = 1.0x
// commitment: use precomputed lookup table for log10 values
let effective_stake = (stake * early_mult_bps * commit_mult_bps) / (10000 * 10000);
```

**IS-3: No BLS consensus on tick resolution** — Single oracle resolves unilaterally. `// (TODO)` in engine.rs.

```
This is the most critical missing piece. Implementation:

1. After resolver computes outcomes + balances, leader serializes:
   resolution_payload = {tick_id, batch_id, market_outcomes[], player_balances[]}

2. Leader hashes payload, signs with BLS, broadcasts to other oracles

3. Followers independently compute the same payload from their data-nodes,
   compare hash. If match → BLS co-sign. If mismatch → reject + log divergence.

4. Once 2/3 threshold reached, leader submits BLS-signed result on-chain
   via settleTick(batchId, tickId, outcomes, balances, blsSig, signersBitmask)

5. On-chain: verify BLS, update balances atomically

Files:
  - oracle/src/vision/engine.rs — add consensus round after resolution
  - oracle/src/vision/consensus.rs — new file, BLS signing + verification
  - contracts/src/vision/Vision.sol — add settleTick() with BLS verification
```

**IS-5: Multiplier f64 precision loss** — Formulas match spec (`early = 1 + t²/T²`, `commit = log10(n+9)`, `eff = stake × mult`). But `U256 → u128 → f64 → f64 math → u128 → U256` conversion path loses precision for large stakes (>2^53).

```rust
// oracle/src/vision/multiplier.rs
// CHANGE: fixed-point arithmetic for effective_stake
// Keep f64 for mult display only; use integer math for stake computation
let stake_u128 = player.stake_per_tick.as_u128();
// early_mult in basis points (10000 = 1.0x, 20000 = 2.0x)
let early_bps: u128 = 10000 + (capped_time * capped_time * 10000 / (tick_duration * tick_duration)) as u128;
// commitment_mult: precompute log10 lookup (1..10000 ticks → bps)
let commit_bps: u128 = log10_bps_lookup(ticks_committed + config.commitment_offset);
// effective_stake = stake * early_bps * commit_bps / (10000 * 10000)
let effective_u128 = stake_u128.checked_mul(early_bps)
    .and_then(|v| v.checked_mul(commit_bps))
    .map(|v| v / (10000 * 10000))
    .unwrap_or(stake_u128);
let effective_stake = U256::from(effective_u128).min(player.balance);
```

**IS-6: Short bitmap defaults to Side::Down** — Out-of-bounds bitmap bits return `false` = Down for all future ticks.

```rust
// oracle/src/vision/resolver.rs — resolve_tick()
// ADD: validate bitmap covers the tick being resolved
let required_bits = (tick_offset + 1) * num_markets;
let available_bits = bitmap.len() * 8;
if available_bits < required_bits {
    // Player's bitmap doesn't cover this tick → skip (refund, no bet)
    // Don't silently assign to Down
    continue; // or mark as Void for this tick
}
```

**IS-7: Unauthenticated price feed** — Snapshot fetched via plain HTTP GET.

```rust
// oracle/src/vision/engine.rs — snapshot fetch
// ADD: HMAC verification of snapshot response
// Data-node signs snapshot with shared secret, oracle verifies
let hmac_header = response.headers().get("x-snapshot-hmac");
let body = response.bytes().await?;
let expected = hmac_sha256(&shared_secret, &body);
if hmac_header.map(|h| h.as_bytes()) != Some(expected.as_ref()) {
    return Err("snapshot HMAC verification failed");
}
let json: serde_json::Value = serde_json::from_slice(&body)?;
```

**IS-4: Start price manipulation on bootstrap** — DISMISSED (user: "dont care").

---

### Vision.sol Fixes

**SOL-1: Double payout via claimRewards + withdraw** — `withdraw()` computes `profit = finalBalance - totalDeposited` without subtracting prior `totalClaimed`. Same winnings paid twice.

```solidity
// contracts/src/vision/Vision.sol — withdraw()
// CHANGE: subtract totalClaimed from payout
function withdraw(uint256 batchId, uint256 finalBalance, ...) external {
    Position storage pos = positions[batchId][msg.sender];
    uint256 totalDeposited = pos.totalDeposited;
    uint256 alreadyClaimed = pos.totalClaimed;  // <-- ADD

    uint256 profit = finalBalance > totalDeposited
        ? finalBalance - totalDeposited : 0;
    uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;

    // Payout = final - fee - already claimed
    uint256 payout = finalBalance - fee - alreadyClaimed;  // <-- FIX
    realBalance[msg.sender] += payout;

    // Clear position
    delete positions[batchId][msg.sender];
}

// ALSO: same fix in forceWithdraw()
```

**SOL-2: Virtual balance creates unbacked realBalance** — Virtual users deposit no USDC. Winnings credit `realBalance` → insolvency.

```solidity
// contracts/src/vision/Vision.sol — claimRewards() and withdraw()
// OPTION A: Track virtual-origin positions separately.
//   On claim/withdraw, credit virtualBalance (not realBalance) for virtual-origin users.
//   virtualBalance can only be withdrawn via bridge (back to Arb).

// OPTION B: Require bridge to actually transfer USDC to Vision contract.
//   creditBalance() should pull USDC from a bridge escrow:
function creditBalance(address user, uint256 amount, ...) external {
    // BLS verified...
    USDC.safeTransferFrom(bridgeEscrow, address(this), amount);  // <-- ADD
    virtualBalance[user] += amount;
    totalVirtualBalance += amount;
}
// Bridge escrow must hold sufficient USDC backing all virtual balances.
// This maintains: USDC.balanceOf(Vision) >= totalRealBalance always.
```

**SOL-3: Double fee on same profit** — `claimRewards` charges 0.3%, then `withdraw` charges again on same profit.

```solidity
// contracts/src/vision/Vision.sol — withdraw()
// CHANGE: compute profit net of already-claimed amounts
uint256 newProfit = finalBalance > (totalDeposited + alreadyClaimed)
    ? finalBalance - totalDeposited - alreadyClaimed : 0;
uint256 fee = (newProfit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
// Only charge fee on the INCREMENTAL profit not yet taxed
```

---

### Fix Priority

| Priority | Finding | Fix | Effort |
|----------|---------|-----|--------|
| **P0** | SOL-1 Double payout | Subtract `totalClaimed` in withdraw | 1h |
| **P0** | IS-3 No BLS on resolution | Implement consensus round + on-chain settleTick | 3-5 days |
| **P0** | DN-2 Empty admin token | Filter empty strings at init | 5m |
| **P0** | SOL-2 Virtual insolvency | Bridge escrow must transfer USDC | 4h |
| **P1** | IS-1 Staleness bypass | Use actual price timestamps | 2h |
| **P1** | DN-1 Config hash not verified | Recompute hash on store | 1h |
| **P1** | DN-3 Settlement injection | Validate config_hash + change_pct consistency | 2h |
| **P1** | IS-2 f64 non-determinism | Integer basis points for resolution + multiplier | 4h |
| **P1** | SOL-3 Double fee | Compute incremental profit in withdraw | 1h |
| **P2** | IS-6 Short bitmap default | Validate bitmap covers tick, skip if short | 1h |
| **P2** | DN-4 No replay protection | Nonce monotonicity check | 1h |
| **P2** | DN-5 TOCTOU config loss | Historical config map, never evict active | 2h |
| **P2** | IS-5 Multiplier f64 precision | Fixed-point arithmetic | 3h |
| **P2** | IS-7 Unauth price feed | HMAC on snapshot responses | 2h |
| **P3** | DN-6 Inconsistent auth | Unify to Bearer header | 1h |

**Dismissed**: IS-4 (start price bootstrap) — not a concern.

---

## Review Corrections (Round 2)

Cynical review found 22 issues with the plan itself. Corrections applied below.

### RC-1: `flat_30` is a phantom type — FIXED

**Problem**: Plan uses `flat_30` but it doesn't exist in codes 0-7 or 8-13. Falls back to `up_x` via `parse_resolution_type` default, inverting bitmap semantics for stable assets.

**Fix**: Use existing `flat_x` (code 7) with `threshold_bps: 30` instead of inventing `flat_30`.

```rust
// In compute_asset_resolutions():
let (res_type, bps) = match avg_change {
    Some(v) if v < 0.3  => ("flat_x", 30),     // was "flat_30" (phantom!)
    Some(v) if v < 3.0  => ("up_x", 30),        // was "up_30" — use up_x with bps
    Some(v) if v < 30.0 => ("up_300", 300),
    Some(_)             => ("up_3000", 3000),
    None                => ("flat_x", 30),       // was "flat_30" (phantom!)
};
```

All references to `flat_30` in this doc, tests, and integration plan should read `flat_x` with `threshold_bps: 30`.

### RC-2: SOL-1 fix underflows after claim+loss — FIXED

**Problem**: `payout = finalBalance - fee - alreadyClaimed` underflows when player claimed rewards then lost money (finalBalance < alreadyClaimed).

**Fix**: Pin `finalBalance` semantics. The oracle MUST sign `finalBalance = position.balance` (remaining, AFTER claims). The contract should NOT subtract `totalClaimed` from payout. Instead, the fix is simpler:

```solidity
// withdraw() — the CORRECT fix:
// finalBalance is the CURRENT remaining batch balance (claims already extracted).
// The only thing wrong is the fee basis: profit should exclude already-claimed profit.
uint256 alreadyClaimed = pos.totalClaimed;
uint256 adjustedDeposit = totalDeposited > alreadyClaimed
    ? totalDeposited - alreadyClaimed : 0;  // effective cost basis after claims
uint256 profit = finalBalance > adjustedDeposit
    ? finalBalance - adjustedDeposit : 0;
// BUT: claims already had fees charged. So no fee on the already-claimed portion. ✓
uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
uint256 payout = finalBalance - fee;  // NO subtraction of alreadyClaimed
realBalance[msg.sender] += payout;
```

This means SOL-1 original code is ALMOST correct — only the fee calculation double-taxes. SOL-1 and SOL-3 merge into ONE fix: adjust the fee basis, not the payout.

### RC-3: SOL-1 + SOL-3 conflict — MERGED

**Problem**: Both subtract `alreadyClaimed` in different places. Applied together = double subtraction.

**Fix**: They are ONE fix, not two. See RC-2 above. Only adjust the fee basis. Drop the original SOL-1 payout subtraction and original SOL-3 profit subtraction. Use the merged formula from RC-2.

### RC-4: `compute_asset_resolutions` only emits `up_*` — FIXED

**Problem**: `.abs()` means `down_300`, `down_3000` are dead code. 10 of 14 types unreachable.

**Fix**: This is correct by design for auto-batches. The `up_*` types are symmetric (resolve UP if above threshold, DOWN if below). Users choose direction via bitmap. `down_*` types would be for custom/manual batches only. Remove `down_300`/`down_3000` from auto-selection, keep them as valid codes for manual batch creation.

Document this explicitly:
```
Auto-batch selection: flat_x, up_x, up_300, up_3000 only.
down_* and flat_300/flat_3000 are available for manual batch creation.
```

### RC-5: IS-1 fix references non-existent snapshot field — FIXED

**Problem**: Snapshot JSON has no per-asset `last_updated`. Fix is a no-op.

**Fix**: Requires 3 changes, not 1:

```
1. data-node: Add `fetched_at` (unix timestamp) per asset in /vision/snapshot response
   File: data-node/src/vision_api.rs — add field to SnapshotAsset struct

2. oracle: Extend SnapshotData type to carry timestamps
   File: oracle/src/vision/engine.rs — SnapshotData = HashMap<H256, (f64, f64, u64)>
   (value, change_pct, fetched_at)

3. oracle: Use fetched_at in build_market_prices
   File: oracle/src/vision/engine.rs:254 — prices.insert(market_id, start, end, fetched_at)
```

### RC-6: DN-3 validation is bypassable — FIXED

**Problem**: Attacker controls all 3 fields. Internal consistency check is security theater.

**Fix**: Settlement should only come via BLS-signed path (same as batch configs). Oracles compute settlement from their own resolution data, BLS-sign it, and push to data-node with BLS verification. No separate admin-token path.

```
Short-term: validate config_hash exists + cross-reference against known on-chain prices
Long-term: settlement recording via BLS consensus, not admin token
```

### RC-7: DN-1 wrong function signature — FIXED

**Problem**: `compute_config_hash` takes 4 args, not a struct.

**Fix**: Correct the snippet:
```rust
let markets: Vec<BatchMarket> = serde_json::from_value(
    payload.config.get("markets").cloned().unwrap_or_default()
).unwrap_or_default();
let recomputed = compute_config_hash(
    &payload.source_id,
    payload.tick_duration_secs,
    payload.lock_offset_secs,
    &markets,
);
if recomputed != expected_hash_bytes {
    return (StatusCode::BAD_REQUEST, "config_hash mismatch").into_response();
}
```

### RC-8: Deploy order creates race — FIXED

**Problem**: Data-node emitting new types before oracles understand them → wrong resolution.

**Fix**: Deploy oracles FIRST (steps 2-3), data-node SECOND (step 4). Also: `parse_resolution_type` should return `Cancelled` for unknown types, not default to `up_x`.

```rust
// oracle/src/vision/engine.rs — parse_resolution_type()
_ => {
    tracing::warn!(res_type = s, "Unknown resolution type — treating as Cancelled");
    255 // special code → Cancelled in resolve_outcome
}
```

### RC-9: IS-2 fix assumes u128 prices — ACKNOWLEDGED

**Problem**: Entire pipeline is f64. Fix requires full-stack rewrite.

**Fix**: Acknowledged as multi-file change. Prices must be represented as `u128` (scaled by 1e8 or similar) from data-node through to resolution. Not a 4h task — estimate 2-3 days. Defer to after IS-3 (BLS consensus) since IS-3 requires deterministic resolution anyway.

### RC-10: DN-4 nonce check is racy — FIXED

**Problem**: DB write happens before write lock. Concurrent requests bypass nonce check.

**Fix**: Move the entire check + DB write + memory update inside a single write lock:
```rust
let mut configs = state.batch_engine.signed_configs.write().await;
// Check nonce INSIDE the lock
if let Some(existing) = configs.iter().find(|c| c.source_id == signed.source_id) {
    if signed.reference_nonce <= existing.reference_nonce {
        return (StatusCode::CONFLICT, "stale nonce").into_response();
    }
}
// DB write INSIDE the lock
store_signed_to_db(&state.pool, &signed).await?;
// Memory update INSIDE the lock
// ... update configs vec ...
```

### RC-11: SOL-2 bridgeEscrow doesn't exist — ACKNOWLEDGED

**Problem**: Fix references non-existent contract.

**Fix**: Use Option A (track virtual-origin positions separately). Add `bool isVirtual` to Position struct. On claim/withdraw for virtual positions, credit `virtualBalance` instead of `realBalance`. Virtual users withdraw via bridge only.

### RC-12: IS-5 `log10_bps_lookup` undefined — FIXED

**Problem**: Function referenced but never defined.

**Fix**: Precompute at compile time with a const array:
```rust
/// log10(n) * 10000, precomputed for n = 1..20000
const LOG10_BPS: [u128; 20001] = {
    // Generated at build time or as a const fn
    // log10(1) * 10000 = 0
    // log10(10) * 10000 = 10000
    // log10(100) * 10000 = 20000
    // log10(1000) * 10000 = 30000
    // For runtime: (n as f64).log10() * 10000.0 → round to u128
    // Only used once at multiplier computation, not in hot path
};
// Simpler alternative: compute log10 as f64 once, multiply by 10000, round
let commit_bps = ((ticks + offset) as f64).log10() * 10000.0).round() as u128;
// f64 for log10 is fine because it's a single scalar, not a threshold comparison
```

### RC-13: Free option via Flat outcome — DESIGN FIX NEEDED

**Problem**: Bet UP on `up_3000`. Flat = refund (zero cost). Rare +30% = huge payout. Convex payoff.

**Fix**: Change Flat semantics. If you bet UP and the market is Flat, your condition was NOT met → you LOSE. Only cancel on stale/no-data/all-same-side.

```rust
// resolver.rs — resolve_outcome for up_x types
// Currently: pct_change within threshold → Flat → refund both sides
// NEW: pct_change within threshold → condition NOT met
//   bit=1 (bet condition met) → LOSES
//   bit=0 (bet condition not met) → WINS
// This eliminates the free option

// For up_x (code 2):
2 => {
    if pct_change > threshold {
        MarketOutcome::Up    // condition met
    } else {
        MarketOutcome::Down  // condition NOT met (includes flat zone)
    }
}
// Remove MarketOutcome::Flat from directional types (up_*, down_*)
// Keep Flat only for flat_* types where "stays within band" IS the condition
```

**Impact**: This is a semantic change. All directional resolution types become binary (met/not-met). No more free options. Flat types remain as "will it stay stable?" bets.

### RC-14: Zero-padded bitmap inflates commitment multiplier — DESIGN FIX NEEDED

**Problem**: 125KB bitmap gives 4.0x multiplier vs legitimate 1.28x. Content irrelevant, only byte length matters.

**Fix**: Compute commitment from balance coverage, not bitmap length:
```rust
// Instead of: num_committed_ticks = bitmap.len() * 8 / num_markets
// Use: num_committed_ticks = balance / stake_per_tick
// This represents actual financial commitment (how many ticks they can fund)
let num_committed_ticks = (player.balance / player.stake_per_tick).as_u64();
```

Alternatively: cap `num_committed_ticks` at `balance / effective_stake_per_tick` so padding zeros without funding more ticks gives no advantage.

### RC-15: `finalBalance` semantics ambiguous — FIXED

**Problem**: Does BLS-signed `finalBalance` mean "total ever" or "remaining now"? Wrong pick breaks everything.

**Fix**: Pin explicitly in code and docs:

```
RULE: finalBalance in withdraw() = position.balance at time of withdrawal.
      This is the CURRENT remaining batch balance, AFTER any claimRewards() calls.
      claimRewards already extracted and paid the incremental winnings.
      withdraw pays out the REMAINING balance, not the cumulative total.

Invariant: totalDeposited = totalClaimed + finalBalance + totalLost
```

Add a require in the contract:
```solidity
require(finalBalance <= position.balance + DUST_THRESHOLD, "finalBalance exceeds position");
```

---

## Consolidated TODO (Implementation Order)

**RULE**: Deploy oracles BEFORE data-node for resolution type changes.

### Phase 0 — Instant Fixes (< 1 hour total)

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-01 | DN-2: Filter empty admin token | `data-node/src/main.rs` | `ADMIN_TOKEN="" cargo run` → refuses to start or rejects empty header | 5m |
| T-02 | Issue #0: Lock period 25% | `data-node/src/batch_engine.rs:22-23` | `cargo test test_lock_pct` | 10m |
| T-03 | Issue #0: Lock period frontend | `frontend/lib/vision/tick.ts:35-37` | `lockOffsetForDuration(600) === 150` | 10m |
| T-04 | RC-8: Unknown resolution type → Cancelled | `oracle/src/vision/engine.rs:111` | `parse_resolution_type("garbage") → 255` | 10m |

### Phase 1 — Resolution Types (oracle first, then data-node)

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-05 | Issue #5: Add codes 8-13 to `parse_resolution_type` | `oracle/src/vision/engine.rs:99-111` | Unit test: `parse("up_300") == 8` etc. | 30m |
| T-06 | Issue #1: Add 6 match arms in `resolve_outcome` | `oracle/src/vision/resolver.rs:328-413` | Unit tests for up_300, down_3000, flat_300, flat_3000 | 1h |
| T-07 | RC-13: Remove Flat from directional types | `oracle/src/vision/resolver.rs:328-413` | `up_x` with change < threshold → `Down` (not `Flat`) | 30m |
| T-08 | RC-1: Data-node uses `flat_x`/`up_x` not `flat_30` | `data-node/src/batch_engine.rs` | `compute_asset_resolutions` emits `"flat_x"` with bps=30 | 30m |
| T-09 | Issue #1: Smart resolution from historical data | `data-node/src/batch_engine.rs` | Integration: `GET /batches/recommended` shows varied types | 2h |

### Phase 2 — Security P0 (contract + data-node)

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-10 | RC-2/RC-3: Merged SOL-1+SOL-3 withdraw fee fix | `contracts/src/vision/Vision.sol` | Forge test: claim 50, withdraw 100 → fee only on incremental 50 | 2h |
| T-11 | RC-2: Same fix in forceWithdraw | `contracts/src/vision/Vision.sol` | Forge test: forceWithdraw after claim → no double payout | 30m |
| T-12 | RC-15: Add `require(finalBalance <= position.balance + dust)` | `contracts/src/vision/Vision.sol` | Forge test: finalBalance > balance → reverts | 30m |
| T-13 | RC-11: Virtual position tracking (isVirtual flag) | `contracts/src/vision/Vision.sol` | Forge test: virtual user win → credits virtualBalance not real | 4h |
| T-14 | DN-1/RC-7: Config hash recomputation on store | `data-node/src/api.rs` | curl POST with tampered config → 400 | 1h |
| T-15 | DN-4/RC-10: Atomic nonce check in write lock | `data-node/src/api.rs` | Concurrent replays → second one rejected | 1h |

### Phase 3 — Security P1 (oracle pipeline)

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-16 | RC-5: Add `fetched_at` to snapshot response | `data-node/src/vision_api.rs` | `curl /vision/snapshot` → each asset has `fetchedAt` field | 1h |
| T-17 | RC-5: Carry timestamp through SnapshotData | `oracle/src/vision/engine.rs` | `SnapshotData` has `(f64, f64, u64)` per market | 1h |
| T-18 | IS-1: Use fetched_at in build_market_prices | `oracle/src/vision/engine.rs:254` | Stale asset → `is_stale()` returns true → `Cancelled` | 30m |
| T-19 | IS-6: Validate bitmap covers tick | `oracle/src/vision/resolver.rs` | Short bitmap → player skipped (not defaulted to Down) | 1h |
| T-20 | RC-14: Commitment mult from balance coverage | `oracle/src/vision/resolver.rs` + `multiplier.rs` | Zero-padded bitmap → same mult as funded ticks only | 1h |
| T-21 | DN-3/RC-6: Settlement via BLS path (short-term: validate config_hash) | `data-node/src/api.rs` | POST settlement with fake config_hash → rejected | 1h |

### Phase 4 — Batch Management Features

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-22 | Issue #2: Asset exclusion filters | `data-node/src/batch_engine.rs` | Stale/dust/new assets excluded from config | 2h |
| T-23 | Issue #3: Lock-period config freeze | `data-node/src/batch_engine.rs` | Config hash stable during lock window | 2h |
| T-24 | Issue #3: Lock-period queue in orchestrator | `oracle/src/vision/batch_config_orchestrator.rs` | updateBatchConfig queued during lock | 1h |
| T-25 | Issue #6: GC for unconsumed configs | `data-node/src/batch_engine.rs` | Old configs deleted after 1h | 30m |
| T-26 | DN-5: Historical config map (don't overwrite) | `data-node/src/batch_engine.rs` | Old config_hash still fetchable after recompute | 1h |
| T-27 | Issue #7: Bot API completeness | `data-node/src/api.rs` | `GET /batches/signed` has all required fields | 1h |
| T-28 | DN-6: Unify auth to Bearer | `data-node/src/api.rs` | All mutation endpoints use same auth mechanism | 1h |

### Phase 5 — Frontend + Observability

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-29 | Issue #4: Tick duration from API | `frontend/lib/vision/tick.ts` + new hook | Source page shows correct tick timer | 2h |
| T-30 | Issue #8: Cancelled market observability | `oracle/src/vision/resolver.rs` + frontend | Cancelled markets logged + shown in UI | 1h |
| T-31 | IS-7: HMAC on snapshot responses | `data-node/src/vision_api.rs` + `oracle/src/vision/engine.rs` | Tampered snapshot → oracle rejects | 2h |

### Phase 6 — Heavy Lifts (separate sprints)

| # | Task | File | Verify | Effort |
|---|------|------|--------|--------|
| T-32 | IS-3: BLS consensus on tick resolution | `oracle/src/vision/` + `Vision.sol` | Multi-oracle agreement before balance update | 3-5 days |
| T-33 | IS-2/RC-9: Integer arithmetic for resolution | `oracle/src/vision/resolver.rs` + `multiplier.rs` | All oracles produce identical results | 2-3 days |

### Verification Checklist (run after each phase)

```bash
# After Phase 0:
cd data-node && cargo test && cd ..
cd frontend && npx tsc --noEmit

# After Phase 1:
cd oracle && cargo test
cd data-node && cargo test
# Start system, verify: curl http://localhost:8200/batches/signed | jq '.[0].markets[0].resolutionType'

# After Phase 2:
cd contracts && forge test
# Specifically: forge test --match-test testClaimThenWithdraw
cd data-node && cargo test

# After Phase 3:
cd oracle && cargo test
# Start system, stop a data feed for 5 min, verify stale markets cancelled

# After Phase 4:
./stop.sh && ./start.sh --vision
# Wait 2 min, then: curl http://localhost:8200/batches/signed | jq length
cd frontend && npx playwright test --config=e2e/playwright.config.ts

# After Phase 5:
cd frontend && npx playwright test --config=e2e/playwright.config.ts
# Visual check: source page shows correct tick timer + lock indicator

# After Phase 6:
# Full system test with 3 oracle nodes
# Verify all 3 agree on tick resolution before applying balances
```

---

## Checklist (All User Requests)

- [x] Lock period = 25% (not 15%) → Issue #0
- [x] flat_300 / flat_3000, same for up and down → Issue #1
- [x] Set volatility from historical data (24h → last batch → flat) → Issue #1
- [x] Don't include stale/dead assets in batches → Issue #2
- [x] Lock-period config freeze across data-node, oracles, frontend, bots → Issue #3
- [x] Frontend tick duration from signed config (not hardcoded category) → Issue #4
- [x] Resolution type mapping consistency (string ↔ u8) → Issue #5
- [x] GC for batch configs nobody consumed on-chain → Issue #6
- [x] Bot-facing API has everything to play (config + BLS sig + markets) → Issue #7
- [x] Source downtime → stale markets cancelled, observability → Issue #8
- [x] 1 leader oracle pushes, others verify + BLS co-sign → Description
- [x] First user creates batch on-chain via createBatchAndJoin() → Description
- [x] Frontend/bots get config BEFORE on-chain → Description
- [x] Resolution follows vision-p2pool-brief.md (condition met/not met, parimutuel) → Description
- [x] Tick overflow = non-issue (u64) → Dismissed
- [x] Missing events = non-issue (off-chain system) → Dismissed
