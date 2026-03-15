# Vision 10,000 Batches — Bottleneck Audit

> 10-agent parallel scan across contracts, data-node, frontend, PostgreSQL, deployment pipeline, resolution/settlement, SSE/WebSocket, oracle BLS, RPC infrastructure, and external APIs.

**Date:** 2026-03-15
**Current state:** ~45 batches deployed, hard cap at 200
**Target:** 10,000 concurrent batches

---

## The Kill Chain

The system doesn't degrade gracefully. It hits hard walls:

1. **Batch 201** — Solidity `MAX_BATCHES = 200` rejects creation outright
2. **~500 batches** — BLS signing falls behind tick intervals, consensus collapses
3. **~1,000 batches** — Frontend browsers become unresponsive (10K DOM nodes, no virtualization)
4. **~2,000 batches** — SSE broadcasts 2-3MB per event to every client, bandwidth saturates
5. **~5,000 batches** — PostgreSQL queries exceed timeout thresholds, connection pool exhausted
6. **~10,000 batches** — RPC node receives 100K+ calls/second, stops responding

---

## TIER 0: Hard Caps (System refuses to operate)

### B-01: MAX_BATCHES = 200 (Solidity constant)
- **File:** `contracts/src/vision/Vision.sol:35`
- **Impact:** `createBatch()` reverts after batch #200. No degradation — total refusal.
- **Fix:** Increase constant or remove cap entirely.

### B-02: LIMIT 100 on batch queries (Oracle API)
- **File:** `oracle/src/vision/api.rs:236`
- **Impact:** Only latest 100 batches returned. 99% of batches invisible at 10K.
- **Fix:** Pagination with cursor-based queries.

### B-03: Bitmap gossip cap = 10,000 entries
- **File:** `oracle/src/vision/engine.rs:1248`
- **Impact:** At 10K batches × 100 players = 1M bitmap requests. 99% silently dropped. Resolution stalls.
- **Fix:** Per-batch bitmap tracking, not global cap.

---

## TIER 1: Catastrophic Failures (System collapses within minutes)

### B-04: BLS signing is single-threaded — 8.3 minutes per poll cycle
- **File:** `oracle/src/vision/engine.rs:711-737`
- **Pattern:** Sequential `signer.sign_message_hash()` per player per batch
- **Math:** 10K batches × 100 players × 500μs/sig = 500 seconds. Tick interval = 60s.
- **Cascade:** Ticks pile up → pending rounds grow unbounded → HashMap eats 38GB → OOM
- **Fix:** Parallelize BLS signing with rayon threadpool. Batch-sign multiple players.

### B-05: RPC polling generates 100K+ calls/second
- **File:** `data-node/src/chain_pollers.rs` (all polling functions)
- **Pattern:** `poll_user_balances_once()` = users × ITPs × `getUserShares()` every 1s
- **Math:** 100 users × 1000 ITPs = 100,000 eth_call/sec against single self-hosted node
- **Fix:** Event-driven cache (SharesUpdated event), eliminate O(n) polling loops.

### B-06: SSE broadcasts full state to all clients, no filtering
- **File:** `data-node/src/api.rs:1460-1520`
- **Pattern:** Every NAV update sends entire `Vec<NavSnapshot>` (all ITPs) to every client
- **Math:** 10K ITPs × 300B = 3MB per event × 1000 events/sec = 3GB/sec per client
- **Breaking point:** Cannot survive a single concurrent user at 10K batches
- **Fix:** Delta updates (only changed ITPs), batch-level subscriptions, pub/sub filtering.

### B-07: Frontend per-batch RPC calls from BatchCard
- **File:** `frontend/components/domain/vision/BatchCard.tsx:42`
- **Pattern:** `useBatchMetadata(batch.id)` = 1 RPC call per batch, refetch every 30s
- **Math:** 10K batches = 10K simultaneous RPC calls every 30 seconds
- **Fix:** Server-side batch metadata endpoint, single query.

### B-08: Frontend all-batches multicall in usePlayerBatches
- **File:** `frontend/hooks/vision/usePlayerBatches.ts:36-44`
- **Pattern:** `batches.map()` builds multicall with ALL batches, every 15 seconds
- **Math:** 10K-item multicall exceeds RPC payload limits
- **Fix:** Only query batches user has positions in (from server-side index).

### B-09: Market × Player × Outcome computation is O(B×M×P)
- **File:** `oracle/src/vision/resolver.rs:118-301`
- **Pattern:** Nested loop: batches × markets × players per tick
- **Math:** 10K × 50 × 1000 = 500M player-market pairs/tick. Exceeds 10-min window.
- **Fix:** Parallelize tick resolution across batches. Pre-filter by revealed players only.

### B-10: Balance proof DB inserts — 30M sequential INSERTs/hour
- **File:** `oracle/src/vision/engine.rs:752-774`
- **Pattern:** Individual `INSERT ... ON CONFLICT` per player per batch, no batching
- **Math:** 10K × 1000 × 3 oracles = 30M DB ops/hour. Connection pool (16 conns) saturated.
- **Fix:** Batch INSERT with `unnest()`. Use prepared statements.

---

## TIER 2: Severe Degradation (System unusable but doesn't crash)

### B-11: No virtual scrolling — 10K DOM nodes rendered
- **File:** `frontend/components/domain/vision/VisionPage.tsx:58-70`
- **Pattern:** `batches.map()` renders all BatchCard components simultaneously
- **Breaking point:** ~1000-2000 batches, browser becomes unresponsive
- **Fix:** `@tanstack/react-virtual` or intersection observer for lazy rendering.

### B-12: Keccak256 hashing on main thread (useResolvedMarkets)
- **File:** `frontend/hooks/vision/useResolvedMarkets.ts:54-92`
- **Pattern:** 100K assets hashed with `keccak256(toHex(assetId))` per refetch
- **Impact:** Blocks main thread 2-5 seconds every 60s
- **Fix:** Move hashing to backend. Return pre-hashed lookup from data-node.

### B-13: Vision snapshot endpoint loads all rows into memory
- **File:** `data-node/src/vision_api.rs:122-208`
- **Pattern:** `Vec<MarketSnapshot>` holds all rows before JSON serialization
- **Math:** 500K assets × 200B = 100MB per request. HMAC on full payload.
- **Fix:** Streaming response with cursor pagination.

### B-14: Batch cache N+1 — 10K sequential HTTP requests
- **File:** `data-node/src/vision_batch_cache.rs:83-116`
- **Pattern:** For each batch, `GET /batches/config/{hash}` individually. Sequential.
- **Math:** 10K batches × 100ms/fetch = 1000 seconds (16 minutes) to refresh cache
- **Fix:** Bulk config endpoint. Parallel fetches with `futures::join_all()`.

### B-15: Tick scheduler scans all batches every 100ms
- **File:** `oracle/src/vision/tick_scheduler.rs:199-222`
- **Pattern:** `batches.iter().filter().filter_map().collect()` — full HashMap scan
- **Math:** 10K batches × 10 polls/sec = 100K batch checks/sec. RwLock contention.
- **Fix:** Priority queue indexed by `next_resolve_time`. O(log n) instead of O(n).

### B-16: Consensus rounds accumulate without TTL — 38GB memory
- **File:** `oracle/src/vision/tick_consensus.rs:60-84`
- **Pattern:** `HashMap<(batch_id, tick_id), PendingTickRound>` grows unbounded
- **Math:** 76M entries × 500 bytes = 38GB before GC clears them
- **Fix:** Aggressive TTL (10s). Evict stale rounds immediately after deadline.

### B-17: P2P balance proof broadcasting — 1M proofs dropped
- **File:** `oracle/src/vision/engine.rs:834-853`
- **Pattern:** `try_send()` on bounded channel. If queue full, proofs silently dropped.
- **Math:** 10K × 100 players = 1M proofs. Channel capacity ~1000. 99.9% dropped.
- **Fix:** Increase channel capacity. Implement reliable delivery with ACKs.

### B-18: getAllActiveBots — O(n) array, never shrinks
- **File:** `contracts/src/vision/BotRegistry.sol:108-119`
- **Pattern:** Deregistered bots stay in array, filtered on read. Two full passes.
- **Math:** At 500+ bots, exceeds block gas limit (~600M gas for 10K iterations)
- **Fix:** Swap-and-pop on deregister. Or EnumerableSet.

### B-19: Frontend polling batches every 10s — 500MB/sec to oracle
- **File:** `frontend/hooks/vision/useBatches.ts:41`
- **Pattern:** `refetchInterval: 10000` polls `/vision/batches` endpoint
- **Math:** 1000 users × 5MB response = 500MB/sec
- **Fix:** SSE subscription for batch updates, not polling.

---

## TIER 3: Performance Degradation (System works but slowly)

### B-20: market_prices table — 6.5B rows, DISTINCT ON scans 125M
- **File:** `data-node/src/api.rs:150-170`
- **Impact:** Health stats refresh = 2-5s/query, runs every 60s
- **Fix:** Use `market_prices_latest` cache table instead.

### B-21: batch_settlements GROUP BY — no temporal pruning
- **File:** `data-node/src/batch_engine.rs:260-281`
- **Impact:** 5M row table, 200-500ms per query
- **Fix:** Add index + `DISTINCT ON` rewrite + 90-day retention.

### B-22: oracle_health_snapshots — unbounded growth
- **File:** `data-node/migrations/026_create_oracle_health_snapshots.sql`
- **Impact:** 10M rows, GROUP BY = 500ms-2s
- **Fix:** 30-day retention policy + materialized view for hourly aggregates.

### B-23: trades table — LOWER(user_address) breaks index
- **File:** `data-node/src/chain_pollers.rs:463`
- **Impact:** Full table scan per user query (5M rows)
- **Fix:** Store addresses lowercase. Drop LOWER() from WHERE.

### B-24: trades table — no index on status
- **File:** `data-node/src/chain_pollers.rs`
- **Impact:** Order polling = 10-30ms per poll at 5M rows
- **Fix:** `CREATE INDEX idx_trades_status_order ON trades(status, order_id DESC)`

### B-25: Write channel capacity = 10K, drops on burst
- **File:** `data-node/src/market_data/write_channel.rs:29`
- **Impact:** 92 sources × burst = 46K rows/sec, drops permanently
- **Fix:** Increase to 50K. Add backpressure feedback.

### B-26: Broadcast channel capacity = 16 per source
- **File:** `data-node/src/market_data/broadcast.rs:42`
- **Impact:** 80ms history buffer. Any lag > 80ms = data loss for WebSocket clients.
- **Fix:** Increase to 256. Add resync on reconnect.

### B-27: Leaderboard O(N×M) — no pagination
- **File:** `oracle/src/vision/api.rs:971-1003`
- **Impact:** 10K batches × 100 players = 1M iterations per request
- **Fix:** Database-level aggregation with `GROUP BY` + `LIMIT/OFFSET`.

### B-28: All oracles track all batches — no sharding
- **File:** `oracle/src/vision/tick_scheduler.rs:22-25`
- **Impact:** Each oracle stores 1GB+ of state. Adding oracles doesn't reduce per-node load.
- **Fix:** Batch sharding by `batch_id % oracle_count`. Long-term: dedicated shard assignment.

### B-29: claimRewards — per-player per-tick on-chain tx
- **File:** `contracts/src/vision/Vision.sol:455-507`
- **Impact:** 10M claims/settlement period. L3 throughput ~7.2M tx/hour. Weeks to clear.
- **Fix:** Batch claims: `claimRewards(fromTick, toTick)` for multiple ticks in one tx.

### B-30: Single RPC node, no fallback
- **File:** `oracle/src/chain/reader.rs:138`, `frontend/lib/wagmi.ts:50-67`
- **Impact:** Single point of failure. Node failure = total system outage.
- **Fix:** Second L3 node. Configure fallback RPC URL. Connection pooling.

---

## External API Bottlenecks

### B-31: No cross-batch API call deduplication
- **Impact:** 100 batches wanting BTC price = 100 identical API calls instead of 1
- **Fix:** Shared price cache across batch resolutions.

### B-32: Open-Meteo free tier (10K calls/day) insufficient
- **Impact:** 10K weather batches need 22K calls/day
- **Fix:** Upgrade to paid tier (~$300/mo for 100K/day).

### B-33: Finnhub rate limit (55 req/min) insufficient
- **Impact:** 1000 stock batches need ~100 calls/min
- **Fix:** Upgrade to Pro tier ($99/mo).

---

## Summary by System Layer

| Layer | # of Bottlenecks | First Breaking Point | Worst Case |
|-------|------------------|---------------------|------------|
| **Solidity Contracts** | 4 | 200 batches (hard cap) | Cannot create batch #201 |
| **Oracle (BLS/Consensus)** | 10 | ~500 batches | 8.3 min BLS signing, 38GB RAM |
| **Data-Node (Rust)** | 8 | ~2000 batches | 100K RPC/sec, 100MB/request |
| **Frontend (React)** | 7 | ~500 batches | 10K DOM nodes, 3GB/sec SSE |
| **PostgreSQL** | 8 | ~5000 batches | 6.5B row scans, pool exhaustion |
| **SSE/WebSocket** | 5 | ~20 clients at 10K | 3MB/event, no delta encoding |
| **RPC/Chain** | 4 | ~150 ITPs | Single node, 100K calls/sec |
| **External APIs** | 3 | ~3000 batches | Rate limits, no dedup |

---

## Implementation Priority

### P0 — Must fix before 500 batches (architectural rewrites)
1. Remove `MAX_BATCHES` cap (B-01)
2. Event-driven state cache, eliminate polling (B-05)
3. Delta SSE with batch subscriptions (B-06)
4. Parallelize BLS signing (B-04)
5. Batch-level API pagination (B-02)

### P1 — Must fix before 2,000 batches (performance)
6. Virtual scrolling in frontend (B-11)
7. Server-side batch metadata (B-07, B-08)
8. Bulk batch config endpoint (B-14)
9. Priority queue for tick scheduler (B-15)
10. Batch DB inserts for balance proofs (B-10)

### P2 — Must fix before 5,000 batches (scaling)
11. PostgreSQL indexes + retention policies (B-20 through B-24)
12. Tick resolution parallelization (B-09)
13. Oracle batch sharding (B-28)
14. Write channel + broadcast capacity (B-25, B-26)
15. Cross-batch API deduplication (B-31)

### P3 — Must fix before 10,000 batches (resilience)
16. RPC node redundancy (B-30)
17. Consensus round TTL (B-16)
18. P2P reliable delivery (B-17)
19. Bitmap gossip redesign (B-03)
20. External API tier upgrades (B-32, B-33)

---

## Review Round 1 — Adversarial Security Review (3-agent consensus)

Three cynical security researchers tore through the audit. They found correctness defects that exist at **any scale**, attack surfaces exploitable at **batch count 0**, and proposed fixes that are **fundamentally impossible**. The original audit was a throughput study that assumed benign actors in a correct system. Both assumptions were wrong.

### Corrections to Original Audit

| Finding | Original | Corrected | Reason |
|---------|----------|-----------|--------|
| B-13 (snapshot memory) | TIER 2 — 100MB/request | TIER 3 — 1.5MB/request | Already uses `market_prices_latest` cache table. Overstated 60x. |
| B-16 (consensus TTL) | TIER 2 — 38GB memory | **P0 CRITICAL** — `gc_stale_rounds()` is never called | No periodic GC wired into engine loop. OOM at 500 batches within hours. |
| B-20 (market_prices DISTINCT ON) | TIER 3 | **Strike** — already fixed | Vision snapshot endpoint already uses `market_prices_latest`. |
| B-28 (oracle sharding) | P2 fix | **Impossible** — breaks BLS consensus | Followers can't verify proposals for batches they don't track. Requires consensus redesign. |
| B-04 (parallelize BLS) | P0 fix | **Insufficient alone** — main loop is sequential | RwLock on scheduler serializes all batches. Rayon for signing is meaningless without per-batch concurrency. |
| B-01 (remove MAX_BATCHES) | P0 fix | **Dangerous** — needs governance cap, not removal | No access control on `createBatch` with cooperative oracle. Adjustable cap via BLS-signed admin call. |
| B-06 (delta SSE) | P0 fix | **Blocked by B-26** | Requires new market-to-batch routing layer. Broadcast channel capacity 16 must be fixed first. |
| B-08 (multicall explosion) | TIER 1 | TIER 2 | wagmi chunks multicalls automatically. Slow, not catastrophic. |
| B-10 (sequential DB writes) | 30M INSERTs/hour | **180M operations/hour** | Three separate sequential write loops, not one. 6x underestimate. |

---

### New CRITICAL Findings (exist at ANY scale)

#### R1-01: Event signature mismatch drops BatchConfigUpdated silently
- **File:** `oracle/src/vision/chain_listener.rs:70` vs `contracts/src/vision/Vision.sol:341`
- **Bug:** Chain listener computes topic hash for `"BatchConfigUpdated(uint256,bytes32,uint256)"` (3 params). Contract emits 4 params including `tickDuration`. Keccak256 of the two strings differ — event is **never matched**.
- **Impact:** Oracles never learn about tick duration changes. Ticks resolve at wrong times. Wrong winners paid.
- **Scale-dependent:** No. Broken at 1 batch.

#### R1-02: mark_resolved fires before consensus completes — balance state diverges
- **File:** `oracle/src/vision/engine.rs:1900-1925`
- **Bug:** `mark_resolved()` and `bitmap_store.flip()` execute immediately after local resolution. Balance updates deferred to consensus completion. If consensus fails, tick counter advances but balances stay at N-1 values.
- **Impact:** Next tick resolves with stale balances. Cumulative drift.
- **Scale-dependent:** No. 3 oracles is enough.

#### R1-03: Balance proofs sign WITHDRAW hash, not CLAIM hash
- **File:** `oracle/src/vision/engine.rs:723` vs `contracts/src/vision/Vision.sol:474`
- **Bug:** Oracles sign `("WITHDRAW", batchId, player, balance)`. On-chain `claimRewards` verifies `("CLAIM", batchId, player, fromTick, toTick, newBalance)`. Different message structures.
- **Impact:** `claimRewards` is dead code. Players must full-withdraw to realize gains.
- **Scale-dependent:** No. Structural mismatch.

#### R1-04: gc_stale_rounds() never called — consensus rounds leak until OOM
- **File:** `oracle/src/vision/tick_consensus.rs:227-235`
- **Bug:** 60-second TTL exists in code but no caller wires it into the tick engine's main loop.
- **Impact:** 500 new rounds/min × 5KB each. OOM in hours at 500 batches. Days at 100 batches.
- **Scale-dependent:** Partially. Kills faster at scale but lethal at any count given enough time.

---

### New CRITICAL Findings (exploitable before scaling)

#### R1-05: BotRegistry has no access control — permissionless gas DoS
- **File:** `contracts/src/vision/BotRegistry.sol:57-72`
- **Bug:** `registerBot()` has no access control. Anyone can register thousands of bots with 100KB `endpoint` strings. `getAllActiveBots()` does 2 × N storage reads.
- **Impact:** 500 registrations → exceeds block gas limit for `getAllActiveBots()`. Permanent DoS of bot enumeration.
- **Scale-dependent:** No. Works at batch count 0.

#### R1-06: SSE endpoints have zero connection limits — zero-cost DoS
- **File:** `data-node/src/api.rs:6168-6294`
- **Bug:** No per-IP limit, no auth, no max connections. Each SSE connection spawns a tokio task with 250ms polling loop. 10K connections = 240K RwLock acquisitions/second.
- **Impact:** Starves legitimate tick resolution. Single attacker can halt the system.
- **Scale-dependent:** No. Works at batch count 1.

---

### New HIGH Findings

#### R1-07: Oracle DB pool capped at 2 connections — hard ceiling
- **File:** `oracle/src/vision/engine.rs:1087`
- **Bug:** `.max_connections(2)` on vision engine's Postgres pool. All balance updates, proof storage, and position writes share 2 connections.
- **Impact:** DB throughput ceiling at ~200 batches, independent of all other bottlenecks.

#### R1-08: Sequential tick resolution loop is root cause of B-04, B-09, B-10
- **File:** `oracle/src/vision/engine.rs:1616`
- **Bug:** `for item in work_items` processes batches sequentially. No amount of parallelizing BLS signing helps when batches are processed one at a time.
- **Fix:** Per-batch concurrency with `tokio::JoinSet` + DashMap/sharded locks on scheduler.

#### R1-09: BitmapStore.get_all_active_for_batch() is O(total_entries)
- **File:** `oracle/src/vision/bitmap_store.rs:122-131`
- **Bug:** Iterates ALL active bitmaps across ALL batches, filters by batch_id. At 10K batches × 100 players = 1M entries, every tick resolution does a 1M-entry scan.
- **Fix:** Nested HashMap `HashMap<u64, HashMap<Address, SlottedBitmap>>` — O(1) batch lookup.

#### R1-10: BitmapStore growth unbounded — never evicts completed batches
- **File:** `oracle/src/vision/bitmap_store.rs:24-36`
- **Bug:** Neither pending nor active maps evict entries from old/paused batches. 10K batches × 100 players = 1M entries = 500MB-2GB in memory, never shrinking.

#### R1-11: wrapping_sub/div in compute_pct_change_bps — edge case overflow
- **File:** `oracle/src/vision/resolver.rs:362-364`
- **Bug:** `i128::MIN.abs()` panics in debug, wraps in release. Division by zero panics in Rust (not UB). Practically unreachable (requires price of -1.7e30), but code is technically unsound.

#### R1-12: TOCTOU race between get_due_batches and get_batch_state
- **File:** `oracle/src/vision/tick_scheduler.rs:442-483`
- **Bug:** Separate lock acquisitions. At 10K batches, ~10s gap between the two calls for the last batch. Player who joined/withdrew during the gap gets incorrect resolution.

#### R1-13: apply_tick_balances_with_db — no transaction, partial failure corrupts state
- **File:** `oracle/src/vision/tick_scheduler.rs:162-182`
- **Bug:** Individual UPDATE per player, no transaction wrapping. Crash mid-loop = some players updated, others not. On restart, DB and memory diverge.

#### R1-14: Balance proofs become single-signer when P2P channel overflows (B-17 cascade)
- **File:** `oracle/src/vision/engine.rs:850`
- **Bug:** When P2P broadcast channel is full (guaranteed at 10K batches per B-17), proofs are silently dropped. Collector stores single-signer proofs — insufficient for on-chain BLS verification.
- **Impact:** Funds effectively locked. Players cannot claim.

#### R1-15: Circular dependency between B-05 and B-06
- **Bug:** Data-node depends on oracle for batch config. Event-driven cache (B-05) would have oracle depend on data-node events. Implementing both simultaneously creates a circular dependency.
- **Fix:** B-05 first, then B-06. Cannot be parallel P0 items.

#### R1-16: virtual-first debit ordering creates MEV for adversarial bots
- **File:** `contracts/src/vision/Vision.sol:848-864`
- **Bug:** `_debitBalance` always consumes virtual balance first. Adversarial user withdraws real balance before losing tick, ensuring only virtual balance backs the loss. Loss absorbed by bridge custody.

---

### Revised Kill Chain

The original kill chain was optimistic. With the review findings:

1. **Batch 1** — Event signature mismatch (R1-01) means tick duration changes are silently ignored
2. **Batch 1** — BotRegistry permissionless registration (R1-05) enables gas DoS at any time
3. **Batch 1** — SSE zero connection limits (R1-06) enables compute DoS at any time
4. **~100 batches** — Consensus rounds leak memory (R1-04), OOM in days
5. **~200 batches** — Oracle DB pool (2 connections) saturated (R1-07)
6. **Batch 201** — `MAX_BATCHES = 200` hard cap (B-01)
7. **~500 batches** — BLS signing + sequential loop can't keep up (B-04 + R1-08)
8. **~1,000 batches** — Frontend unresponsive (B-11), bitmap gossip deaf (B-03)
9. **~2,000 batches** — SSE broadcasts saturate bandwidth (B-06)
10. **~5,000 batches** — PostgreSQL queries timeout (B-21-24)
11. **~10,000 batches** — RPC node overwhelmed (B-05)

---

### Revised Implementation Priority

#### P0 — Must fix NOW (correctness + exploitability, any batch count)
1. **R1-01**: Fix event signature mismatch in chain_listener (1 hour)
2. **R1-04**: Wire `gc_stale_rounds()` into tick engine main loop (1 hour)
3. **R1-05**: Add access control to BotRegistry.registerBot (1 hour)
4. **R1-06**: Add SSE connection limits + IP rate limiting (half day)
5. **R1-02**: Defer `mark_resolved` until consensus completion (1 day)
6. **R1-13**: Wrap `apply_tick_balances_with_db` in DB transaction (half day)
7. **R1-07**: Increase oracle DB pool from 2 to 20+ connections (1 hour)
8. **B-10 + R1-08**: Batch all three DB write paths + per-batch concurrency in main loop (3-5 days)
9. **R1-09**: Restructure BitmapStore to nested HashMap (half day)
10. **B-01**: Adjustable MAX_BATCHES via BLS-signed admin call (half day)

#### P1 — Must fix before 500 batches
11. **B-05**: Event-driven state cache, eliminate O(n) polling (1 week)
12. **B-26**: Increase broadcast channel capacity to 256 (1 hour — unblocks B-06)
13. **B-06**: Delta SSE with batch routing (1 week, after B-05 + B-26)
14. **B-02**: Cursor-based pagination for batch queries (1 day)
15. **B-15**: Priority queue for tick scheduler (2 days)

#### P2 — Must fix before 2,000 batches
16. **B-11**: Virtual scrolling in frontend (1 day)
17. **B-07, B-08**: Server-side batch metadata (2 days)
18. **B-14**: Bulk batch config endpoint (1 day)
19. **B-21-24**: PostgreSQL indexes + retention policies (3 days)
20. **R1-10**: BitmapStore eviction for completed batches (half day)

#### P3 — Must fix before 10,000 batches
21. **B-30**: RPC node redundancy (infrastructure)
22. **B-17**: P2P reliable delivery (1 week)
23. **B-03**: Bitmap gossip per-batch tracking (2 days)
24. **B-31-33**: External API dedup + tier upgrades

#### Deferred — Requires architectural redesign
25. **B-28**: Oracle consensus sharding — **impossible without redesigning per-batch oracle sets**
26. **R1-03**: claimRewards vs WITHDRAW hash mismatch — **protocol design decision needed**
27. **R1-16**: Virtual-first debit MEV — **economic model decision needed**

---

### Findings Struck from Original Audit
- **B-13**: Overstated 60x. Snapshot already uses cache table. Actual impact: LOW.
- **B-16**: Severity was correct, priority was catastrophically wrong. Moved from P3 to P0.
- **B-20**: Already fixed in code. Struck.
- **B-28**: Fix is fundamentally impossible. Moved to "deferred — requires redesign."

---

## The Verdict (Revised)

The original audit found 33 bottlenecks and called it a throughput problem. The review found it is three problems wearing a trenchcoat:

1. **Correctness defects** that exist at batch count 1 — event signature mismatches, consensus state races, dead contract functions. These are bugs, not scaling issues. They must be fixed before anything else.

2. **Attack surfaces** exploitable by anyone with an Ethereum wallet — permissionless bot registration, unlimited SSE connections, no rate limiting. The system is defenseless against a motivated adversary at any scale.

3. **Architectural assumptions** that break under load — omniscient oracles, broadcast-everything SSE, sequential tick processing, 2-connection DB pools. These are design choices that worked at 45 batches and will kill the system at 500.

The original audit counted 33 bottlenecks and proposed 4 architectural rewrites. The reviewed count is **49 findings** (33 original + 16 new, minus 2 struck). The architectural rewrites number **6**, and one of them (oracle sharding) is impossible without redesigning the consensus protocol.

Realistic P0 effort: 3-4 weeks of focused work. The system cannot safely operate beyond 200 batches until items 1-10 are complete. It cannot reach 500 until items 11-15 are done. The road to 10,000 is measured in months, not sprints.

The ambition remains correct. The foundation has cracks the original audit didn't see — or chose not to name.

---

## Review Round 2 — Final Convergence (3-agent consensus)

Three reviewers verified the complete audit. Findings:

### Corrections from Round 2

| Item | Round 1 Assessment | Round 2 Correction |
|------|-------------------|-------------------|
| R1-03 (WITHDRAW/CLAIM) | CRITICAL | **Downgraded to MEDIUM** — `claimRewards` is dead code (unimplemented feature), not broken code. The WITHDRAW proof path works correctly. No fund theft possible. |
| R1-11 (wrapping overflow) | HIGH | **Downgraded to MEDIUM** — division by zero panics in Rust (not UB). `i128::MIN` price is unreachable in practice. |
| P0-10 effort (MAX_BATCHES) | Half day | **3-5 days** — Vision.sol has NO proxy pattern. `MAX_BATCHES` is a `constant` baked into bytecode. Requires full contract redeploy + state migration of all batches, positions, balances + coordinated config update across 5 services. |
| P0-3 effort (BotRegistry ACL) | 1 hour | **1-2 days** — Also requires full contract redeploy (no proxy). Should be batched with P0-10. |
| P0-5 effort (defer mark_resolved) | 1 day | **2-3 days** — Consensus completion handler needs scheduler/bitmap store access it currently lacks. Architectural threading required. |
| P0-8 effort (concurrency) | 3-5 days | **5-8 days** — All 5 `RwLock<HashMap>` fields on TickScheduler must become concurrent-safe. |
| P0-9 effort (BitmapStore) | Half day | **1 day** — Touches every method on BitmapStore + DB persistence layer. |
| R1-01 effort (event sig) | 1 hour | **2-3 hours** — Must also update scheduler `Batch` struct and `on_batch_config_updated` signature to propagate `tickDuration`. |
| Total P0 | 3-4 weeks | **5-7 weeks** — Contract redeployments are the hidden cost. |

### Key Findings from Round 2

**No fund extraction path exists.** The BLS verification layer holds. The system pays wrong winners (R1-01 + R1-02) and can be DoS'd (R1-05, R1-06), but cannot be robbed.

**No new CRITICAL or HIGH exploit chains found.** Individual findings don't compose into worse attacks.

**Contract redeployment is the hidden bomb.** P0-3 (BotRegistry) and P0-10 (MAX_BATCHES) both require full redeployment with no proxy pattern. Must be batched to avoid two migration cycles. Each migration risks incinerating existing user positions if done carelessly.

**Dependency graph is sound.** No new circular dependencies. The ordering works. The only coupling is deployment-level: P0-3 and P0-10 should be deployed together.

**R1-01 cascading effect confirmed.** Even after fixing the event signature, the scheduler's `Batch` struct has no `next_tick_duration` field. The chain listener handler has no parameter for it. Full data flow plumbing required — not just a string fix.

### Final Severity Distribution

| Severity | Count | Scale-Dependent? |
|----------|-------|-----------------|
| CRITICAL (confirmed) | 4 | R1-01, R1-02, R1-04: No. R1-05, R1-06: No. B-01: Yes (201+) |
| HIGH (confirmed) | 12 | Mixed — some at any scale, most at 200+ |
| MEDIUM | 15 | Mostly scale-dependent |
| LOW | 5 | Optimization targets |
| Struck | 3 | B-13, B-20, B-28 (as fix) |
| Downgraded | 2 | R1-03 (CRITICAL→MEDIUM), R1-11 (HIGH→MEDIUM) |

### Convergence Statement

**All three round 2 reviewers agree: no remaining CRITICAL or HIGH findings are unaddressed.** Confidence: 85-90%. The audit is complete.

---

## Final Revised P0 with Realistic Estimates

| # | Finding | Fix | Effort | Dependencies | Deploy |
|---|---------|-----|--------|-------------|--------|
| 1 | R1-01 (event sig mismatch) | Fix keccak hash + propagate tickDuration through scheduler | 2-3 hours | None | Oracle restart |
| 2 | R1-04 (GC never called) | Add periodic timer in engine main loop | 2-3 hours | None | Oracle restart |
| 3 | R1-05 (BotRegistry ACL) | Add `onlyOwner` modifier + array compaction | 1-2 days | **Batch with #10** | Contract redeploy |
| 4 | R1-06 (SSE no limits) | tower-governor rate limiting + max connection cap | 1 day | None | Data-node restart |
| 5 | R1-02 (premature mark_resolved) | Defer to consensus completion callback | 2-3 days | After #1 | Oracle restart |
| 6 | R1-13 (no DB transaction) | Wrap balance updates in `pool.begin()/commit()` | Half day | None | Oracle restart |
| 7 | R1-07 (DB pool = 2) | Change to 20+ | 30 min | None | Oracle restart |
| 8 | B-10 + R1-08 (sequential loop) | JoinSet + DashMap + batch INSERT with unnest() | 5-8 days | After #2, #6, #7 | Oracle restart |
| 9 | R1-09 (BitmapStore O(n)) | Nested HashMap restructure | 1 day | None | Oracle restart |
| 10 | B-01 (MAX_BATCHES = 200) | State variable + BLS-signed setter + full redeploy + migration | 3-5 days | **Batch with #3** | Contract redeploy + full stack |

**Total P0: 5-7 weeks focused work.**
**Items 1-2, 6-7: can ship in week 1** (quick wins, oracle restart only).
**Items 3, 10: require coordinated contract redeploy** (week 3-4, most risk).
**Items 5, 8: the architectural core** (weeks 2-5, most effort).
**Items 4, 9: independent, parallel-safe** (any time).
