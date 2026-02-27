# Fix Plan: 4 Vision/Consensus Bugs

**Date:** 2026-02-26
**Session:** 20260226-1730-v9q1

---

## Bug 1: Batch Signing 2/3 (Timing)

### Problem
When a leader achieves price consensus (3/3 agree), the batch signing phase times out with only 2/3 signatures. The `--consensus-timeout-ms 150` CLI flag divides 150ms evenly across 4 phases = 37.5ms each. The last phase (batch signing) gets `150 - 3*37 = 39ms`. With P2P roundtrip + BLS verification taking 30-50ms locally, the 39ms window is too tight.

### Root Cause
`issuer/src/bootstrap/consensus.rs:156-163` — evenly distributes the total timeout across 4 phases. The batch signing phase needs the most time (collect from N-1 peers) but gets the same allocation as proposal phases (which are just broadcasts).

Default timeouts in `issuer/src/consensus/state.rs:155-165` are 200+150+200+250 = 800ms total, heavily weighted toward batch signing (250ms). But `--consensus-timeout-ms 150` overrides this to 37+37+37+39ms.

### Fix
Change the distribution in `issuer/src/bootstrap/consensus.rs` to weight batch signing higher:

```
File: issuer/src/bootstrap/consensus.rs (lines 156-163)

Current:
  let per_phase = total_ms / 4;
  ConsensusTimeouts::new(
      Duration::from_millis(per_phase),      // price_proposal
      Duration::from_millis(per_phase),      // price_vote
      Duration::from_millis(per_phase),      // batch_proposal
      Duration::from_millis(total_ms - 3 * per_phase),  // batch_sign (remainder)
  )

Fix:
  // Distribute: 15% proposal, 20% vote, 15% batch proposal, 50% batch sign
  let proposal = total_ms * 15 / 100;
  let vote = total_ms * 20 / 100;
  let batch_proposal = total_ms * 15 / 100;
  let batch_sign = total_ms - proposal - vote - batch_proposal;
  ConsensusTimeouts::new(
      Duration::from_millis(proposal),        // 22ms
      Duration::from_millis(vote),            // 30ms
      Duration::from_millis(batch_proposal),  // 22ms
      Duration::from_millis(batch_sign),      // 76ms
  )
```

For `--consensus-timeout-ms 150`: batch signing gets 76ms instead of 39ms — double the window.

### Files
- `issuer/src/bootstrap/consensus.rs` — change timeout distribution (lines 156-163)

### Test
- Start 3 issuers with `--consensus-timeout-ms 150 --cycle-duration-ms 200`
- Check `grep "signer_count=3" logs/issuer-1.log` appears
- Check `grep "not enough signatures" logs/issuer-1.log | tail -5` shows count=3 (not 1 or 2)

---

## Bug 2: Stuck ITP Creation Nonce

### Problem
A pending ITP creation request (nonce=1, from E2E test) retries every consensus cycle forever. The log says `ITP creation consensus succeeded nonce=1 signer_count=0` — but signer_count=0 means no BLS signatures were collected. Followers return a placeholder `Ok(ItpCreationResult { signature_count: 0 })` which logs as "succeeded" misleadingly. On-chain `BridgeProxy.isPending(1)` stays true because no leader ever calls `completeCreateItp()` with a valid aggregated signature.

### Root Cause
1. **Misleading log**: `main.rs:1207-1208` logs `Ok(result)` as "succeeded" even when `result.signature_count == 0`
2. **No skip/cancel mechanism**: The code re-fetches all pending requests from chain every cycle (`arbitrum_reader.get_all_pending_requests()`) and retries them all. There's no TTL, max-retry, or admin cancel.
3. **Why consensus fails**: The ITP creation leader election rotates per cycle (`cycle % num_issuers`). When the leader tries to collect signatures, the same batch-signing timeout (Bug 1) applies. With the current tight timeouts, followers can't respond in time.

### Fix (two parts)

**Part A — Fix the misleading log and skip zero-signature results:**
```
File: issuer/src/main.rs (lines 1207-1210)

Current:
  Ok(result) => {
      info!(nonce = %result.nonce, signer_count = result.signature_count,
            "ITP creation consensus succeeded");
      if am_leader && !result.aggregated_signature.is_empty() {

Fix:
  Ok(result) => {
      if result.signature_count == 0 {
          debug!(nonce = %result.nonce, am_leader,
                 "ITP creation: no signatures collected (follower placeholder)");
      } else {
          info!(nonce = %result.nonce, signer_count = result.signature_count,
                "ITP creation consensus succeeded");
      }
      if am_leader && !result.aggregated_signature.is_empty() {
```

**Part B — Add max-age skip for stale requests:**
```
File: issuer/src/main.rs (inside the for request in pending_requests loop, before run_itp_creation_phase)

Add:
  // Skip requests older than 1 hour to avoid infinite retry of stale E2E requests
  let request_age_secs = now_secs.saturating_sub(request.created_at);
  if request_age_secs > 3600 {
      debug!(nonce = %request.nonce, age_secs = request_age_secs,
             "Skipping stale ITP creation request (>1h old)");
      continue;
  }
```

This requires `request.created_at` to be available in `ItpCreationRequest`. Check if it exists; if not, use the `request.nonce` to track first-seen time in a local `HashMap<U256, Instant>` and skip if seen for more than N minutes.

### Files
- `issuer/src/main.rs` — fix log level and add staleness skip (lines 1203-1257)
- Possibly `issuer/src/chain/arbitrum_reader.rs` — check if `created_at` is parsed from on-chain data

### Test
- After fix, `grep "ITP creation consensus succeeded" logs/issuer-2.log` should no longer spam signer_count=0
- Stale nonce=1 request should show "Skipping stale ITP creation request" after 1h

---

## Bug 3: All Pumpfun Markets Cancelled (Hardcoded Source)

### Problem
Tick resolution for batch 1 (pumpfun, 256 markets) shows `cancelled=256`. The resolver cancels any market with no price data. The engine's `fetch_market_prices()` queries `/vision/snapshot?source=hackernews&limit=10000` — **hardcoded to hackernews**. Pumpfun markets have `source=pumpfun` in the DB, so zero matches are found.

### Root Cause
`issuer/src/vision/engine.rs:113` — the snapshot source filter is hardcoded:
```rust
let url = format!("{}/vision/snapshot?source=hackernews&limit=10000", data_node_url);
```

This was presumably a dev placeholder that never got parameterized.

### Fix
Pass the source_id from the batch config through to `fetch_market_prices()`. The source_id is already available in the `RecommendedBatch` struct returned by the config cache.

**Step 1 — Add source_id to the config cache return:**
```
File: issuer/src/vision/engine.rs

Change ConfigCache::get_or_fetch return type to include source_id:
  Currently returns: Vec<MarketConfig>
  Change to return: (String, Vec<MarketConfig>)  // (source_id, markets)

In get_or_fetch body (line 56-64):
  let source_id = batch.source_id.clone();
  let market_configs = batch.markets.iter().map(...).collect();
  // Cache as (source_id, market_configs)
  Ok((source_id, market_configs))
```

**Step 2 — Pass source_id to fetch_market_prices:**
```
File: issuer/src/vision/engine.rs

Change function signature (line 105):
  async fn fetch_market_prices(
      data_node_url: &str,
+     source_id: &str,
      batch_market_ids: &[H256],
      reference_prices: &ReferencePrices,
      now: u64,
  )

Change line 113:
  Current: let url = format!("{}/vision/snapshot?source=hackernews&limit=10000", data_node_url);
  Fix:     let url = format!("{}/vision/snapshot?source={}&limit=10000", data_node_url, source_id);
```

**Step 3 — Map batch engine source_id to data-node source_id if needed:**

The batch engine uses IDs like `"pumpfun"`, `"stocks"`, `"crypto"` etc. The data-node `market_assets` table uses the collector's `source_id()` which may differ (e.g., `"finnhub"` not `"stocks"`). Need a reverse mapping:

```
File: issuer/src/vision/engine.rs (new constant)

const SOURCE_ID_TO_SNAPSHOT: &[(&str, &str)] = &[
    ("crypto", "coingecko"),
    ("stocks", "finnhub"),
    ("rates", "fred"),
    ("defi", "defillama"),
    ("bonds", "treasury"),
    ("esports", "pandascore"),
    ("gtfs_transit", "gtfs_rt"),
    ("weather", "openmeteo"),
];

fn resolve_snapshot_source(batch_source_id: &str) -> &str {
    for &(engine_id, snapshot_id) in SOURCE_ID_TO_SNAPSHOT {
        if engine_id == batch_source_id {
            return snapshot_id;
        }
    }
    batch_source_id  // fallback: use as-is (works for pumpfun, zillow, reddit, etc.)
}
```

**Step 4 — Wire it in the main loop (line 381-399):**
```
  let (source_id, market_configs) = config_cache.get_or_fetch(...).await?;
  let snapshot_source = resolve_snapshot_source(&source_id);
  let prices = fetch_market_prices(&config.data_node_url, snapshot_source, &market_ids, &reference_prices, now).await?;
```

**Alternative (simpler):** Remove the source filter entirely and fetch ALL active market prices. The engine already filters by `batch_market_ids` (line 148: `if !batch_ids.contains(&market_id)`). This is simpler but fetches more data (~5000 rows vs ~256). For a local system this is fine; for production, the source filter is better.

### Files
- `issuer/src/vision/engine.rs` — parameterize source in fetch_market_prices, add source mapping
- `issuer/src/vision/batch_config_orchestrator.rs` — ensure `RecommendedBatch.source_id` is returned

### Test
- After fix: `grep "Tick resolved.*batch_id=1" logs/issuer-1.log` should show `up=X down=Y` instead of `cancelled=256`
- `grep "matched_markets" logs/issuer-1.log` should show non-zero matches

---

## Bug 4: E2E Test Batches (76-80) Config 404

### Problem
Batches 76-80 (`e2e_test_*`) have on-chain deploy hashes but no corresponding configs in the batch engine. The deploy-hash reverse lookup can't match them because the batch engine doesn't have `e2e_test_*` source configs.

### Root Cause
The deploy script (`DeployAllVisionBatches.s.sol`) creates 5 E2E test batches with source names `e2e_test_0` through `e2e_test_4`. The batch engine's `BATCH_SOURCES` constant doesn't include any `e2e_test_*` entries. These batches have no real market data.

### Fix
Ignore E2E test batch errors silently instead of logging WARN every 500ms.

```
File: issuer/src/vision/engine.rs (lines 358-366, the config fetch error handler)

Current:
  Err(e) => {
      tracing::warn!(batch_id, tick_id, error = %e,
          "Failed to fetch market config, skipping tick");
      continue;
  }

Fix — Downgrade to debug for known-missing configs:
  Err(e) => {
      // Downgrade to debug after first occurrence to avoid log spam
      // (e.g., e2e_test batches have no configs in non-test mode)
      if config_cache.is_known_missing(&batch.config_hash).await {
          tracing::debug!(batch_id, tick_id, "Config still missing, skipping tick");
      } else {
          tracing::warn!(batch_id, tick_id, error = %e,
              "Failed to fetch market config, skipping tick");
          config_cache.mark_missing(&batch.config_hash).await;
      }
      continue;
  }
```

Add a `known_missing: RwLock<HashSet<H256>>` to `ConfigCache` to track hashes that already 404'd.

### Files
- `issuer/src/vision/engine.rs` — add missing-config dedup to ConfigCache, downgrade log level

### Test
- After fix: `grep "WARN.*Failed to fetch market config" logs/issuer-1.log | wc -l` should be ~5 (one per batch) instead of thousands

---

## Implementation Order

1. **Bug 3** (hardcoded source) — highest impact, ticks are resolving but all cancelled
2. **Bug 1** (signing timeout) — second highest, blocks all on-chain writes
3. **Bug 2** (stuck nonce) — annoying log spam + wasted cycles
4. **Bug 4** (e2e log noise) — cosmetic, lowest priority

## Estimated Scope

| Bug | Files Changed | Lines Changed | Risk |
|-----|--------------|---------------|------|
| 1 | 1 | ~8 | Low — only changes timeout distribution |
| 2 | 1 | ~15 | Low — adds guard clause + log fix |
| 3 | 1-2 | ~30 | Medium — new parameter threading through engine |
| 4 | 1 | ~15 | Low — log dedup only |
