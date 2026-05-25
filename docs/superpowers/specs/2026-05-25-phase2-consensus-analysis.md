# Phase 2 — Oracle consensus determinism analysis (the gate)

**Session:** 20260525-1455-q9p2
**Scope:** Does scoping each firehose Vision source's betting batch to its live top-N (N=10) by popularity survive the BLS oracle consensus path? This is the gate that must pass before the data-node top-N change is deployed to VPS.

The code change (Part 1, `data-node/src/batch_engine.rs`) is already in the tree. It is **inert until a deploy** — the data-node is a native systemd binary rebuilt by hand on VPS 1, never auto-deployed by a git push. This document decides whether that manual deploy is safe.

---

## What "top-N churn" would threaten

A firehose source's top-10 re-ranks as `market_cap`/`volume_24h`/`value` move. Every tick, the data-node recomputes the recommended config; if the top-10 membership changed, the `config_hash` changes. The fear: a *rotating* config set trips one of the oracle's consensus safety checks (follower rejection, count/unknown tolerances, a rate limit), or mis-settles a round whose membership shifted mid-flight.

Each question below is a potential blocker. The answers are grounded in file:line evidence.

---

## Q1 — TOPOLOGY: single shared data-node, or one per oracle?

**Answer: SINGLE shared data-node. All three oracles read `/batches/recommended` from the same `http://localhost:8200`.**

Evidence:
- Oracle reads its data-node URL from env `ORACLE_VISION_DATA_NODE_URL` / `DATA_NODE_URL` — `oracle/src/config.rs:369,390`.
- All three oracle containers run `network_mode: host` — `docker/testnet/oracle/docker-compose.yml:14`. "host" networking means `localhost` inside the container is the VPS host.
- The override generator pins the data-node port to `8200` for every oracle — `scripts/gen-oracle-override.py:43` (`DNP = "8200"`). Combined with host networking, every oracle's `data_node_url` resolves to the one data-node on the host.
- Project memory + CLAUDE.md: the data-node runs as a single native binary on VPS 1 (`data-node-shadow.service`, `159.195.78.238:8200`); all EVM oracle infra is one Docker Compose on VPS 1.

**Consequence:** the proposed market set is *identical* for all oracles, because they all read the same in-memory `batch_engine.configs` from the same process (`data-node/src/api.rs:6211`). There is no cross-oracle disagreement about "what is the top-10 right now" — there is exactly one answer. Top-N churn is therefore **not a multi-node divergence problem**. It is at most a single-node, tick-over-tick rotation question, addressed by Q2–Q5.

---

## Q2 — VERIFY-BY-HASH vs VERIFY-LATEST?

**Answer: VERIFY-BY-HASH. The leader proposes a `config_hash`; followers sign that exact hash. They do NOT fetch "latest" and do NOT re-derive a competing set.**

The live createBatch consensus path is in `BatchLifecycleManager` (`oracle/src/vision/lifecycle.rs`), not the stubbed `batch_config_orchestrator`. (See Q4 — the orchestrator's `run()` body is commented-out dead code.)

Leader side (`lifecycle.rs:create_new_round`):
- Leader fetches the current recommended config once and reads its `config_hash` — `lifecycle.rs:1312-1319`.
- Leader builds the BLS message as `keccak256(abi.encode(chain_id, vision_address, "CREATE_BATCH", source_id, config_hash, tick_duration, lock_offset, settlement_grace))` — `lifecycle.rs:1390-1400`.
- Leader broadcasts `VisionCreateBatchProposal { source_id, config_hash, tick_duration, lock_offset, settlement_grace, message_hash, ... }` — `lifecycle.rs:1474-1485`.

Follower side (`oracle/src/consensus/protocol.rs:3075-3140`):
- The follower recomputes the message hash from the **leader-supplied** `(chain_id, vision_address, "CREATE_BATCH", source_id, config_hash, tick_duration, lock_offset, settlement_grace)` — `protocol.rs:3098-3108`.
- It rejects only if its recomputed hash ≠ the leader's `message_hash` — `protocol.rs:3109-3113`.
- If they match, it BLS-signs `message_hash` and returns `VisionCreateBatchSign` — `protocol.rs:3115-3138`.

The follower never calls `/batches/recommended` in this path, never re-derives a top-10, never compares market sets. It signs the leader's `config_hash` as an opaque 32-byte value. **Churn between the leader's read and a follower's view is impossible to detect here — and therefore harmless.**

**Per-source single proposer.** Each source is owned by exactly one oracle: the heartbeat SQL filter `((hashtext(source_name)::bigint % N) + N) % N == node_index` pins a source to one node (`lifecycle.rs:325`), and `create_new_round` sets `is_leader = true` by construction (`lifecycle.rs:1367-1371`). So for any given source there is one proposer and the rest co-sign its hash. No two oracles ever propose competing top-10 sets for the same source.

---

## Q3 — FOLLOWER TOLERANCES (±30% count, <5% unknown assets)

**Answer: those tolerances are NOT on the live path. They live only in `verify_single_source` / `handle_proposal`, which are dead stub code. The live follower path applies no count or unknown-asset tolerance — it verifies a hash. Top-N can never trip them.**

The ±30% asset-count tolerance (`ASSET_COUNT_TOLERANCE = 0.30`) and the <5% unknown-asset tolerance (`UNKNOWN_ASSET_TOLERANCE = 0.05`) are defined in `batch_config_orchestrator.rs:21-23` and enforced in `verify_single_source` (`batch_config_orchestrator.rs:112-150`). That function re-derives the follower's own set and compares it against the leader's — the independent-derivation model the gate worried about.

But `verify_single_source` is only ever called from `handle_proposal` (`batch_config_orchestrator.rs:334`), and `handle_proposal` is never invoked in production. The orchestrator's `run()` loop is a stub: it increments a round counter and sleeps; the leader/follower logic is commented out (`batch_config_orchestrator.rs:239-256`). It is spawned (`main.rs:841-847`) but does nothing each cycle. The functions remain only because they carry unit tests.

The tolerances are computed against an **independently-derived** set — which is exactly why they would be dangerous for a churning top-N. The saving grace is that this code is not on the live path. The live path (Q2) verifies the proposed hash, not an independently-derived set, so:

> With top-N=10, no top-N batch can ever trip the ±30% / <5% checks, because those checks do not run.

This is the single most important finding of the gate. A naive reading of the spec assumed `verify_single_source` was live; it is not.

---

## Q4 — RATE LIMIT: 3/hour global or per-source? Is it even live?

**Answer: the `MAX_CREATIONS_PER_HOUR = 3` cap is dead code, never enforced. The live `BatchLifecycleManager` path has NO per-hour creation cap. Not a blocker.**

Evidence:
- `MAX_CREATIONS_PER_HOUR = 3` and the `recent_creations` Vec are defined in `batch_config_orchestrator.rs:27,217-218`.
- The only place they are read is inside `run_leader_round`, and the entire auto-creation block — including the `recent_creations.len() >= MAX_CREATIONS_PER_HOUR` check — is commented out (`batch_config_orchestrator.rs:266-284`). `run_leader_round` itself is never called (the orchestrator `run()` loop is a stub; see Q3).
- A repo-wide grep for `rate.?limit | per.?hour | 3600 | MAX_CREATION | recent_creation` in `lifecycle.rs` returns nothing — the live manager has no such gate.
- The live creation cadence in `BatchLifecycleManager` is: one batch per source per `tick_duration`, fired only when the source is *due* (heartbeat SQL, `lifecycle.rs:321-339`) AND the source's current slot is empty after rotation (`should_create = cur_after.is_none() && !legacy_drain_only`, `lifecycle.rs:613`). The cadence is governed by `tick_duration`, not a per-hour counter, and is naturally one-in-flight-per-source.

So the question "global vs per-source" is moot: **no rate limit fires at all** on the live path. A churning top-N across 99 sources produces at most one createBatch per source per tick — exactly what the system already does for full firehose batches today. The top-N change does not increase creation frequency; it only shrinks each batch from "all healthy" to "top 10". If anything it *reduces* per-batch on-chain cost.

**Note on the dead cap, had it been live:** `MAX_CREATIONS_PER_HOUR` would have been GLOBAL (a single `recent_creations: Vec<Instant>` on the orchestrator, not keyed by source — `batch_config_orchestrator.rs:218`). A global 3/hour cap across 99 churning sources would have starved batch creation catastrophically. Because it is dead, no fix is required now. If the orchestrator's auto-creation path is ever revived, it MUST be made per-source (a `HashMap<String, Vec<Instant>>`) or scoped to genuinely-new sources only, not config-hash rotations. Flagged for whoever wakes that code.

**No code change made to the oracle.** The rate limit is inert; touching it would be speculative work against dead code, against the project's "don't gold-plate dead paths" instinct and rule 20 (don't change code whose contract you can't verify is live).

---

## Q5 — SETTLEMENT INTEGRITY: does a round settle on the set it opened with?

**Answer: YES. The batch's `config_hash` is frozen at creation and settlement resolves against that exact pinned hash, never the current top-N. A mid-round re-rank cannot mis-settle.**

Freeze at creation:
- The `config_hash` proposed and signed at createBatch (`lifecycle.rs:1381-1400`) is recorded on the lifecycle row (`record_round_lifecycle`, `lifecycle.rs:1358`) and is the `config_hash` field of the on-chain `Batch` struct fed to the scheduler (`lifecycle.rs:1648` in the submitter loop). It does not change for the life of the batch.

Read at settlement:
- `resolve_and_settle` fetches the market config **by the batch's pinned hash**, not the current recommended config — `lifecycle.rs:910-935`. The comment is explicit (`lifecycle.rs:905-909`): "Fetch market config by the batch's PINNED config hash — not the current recommended config. The recommended config drifts as assets become healthy/unhealthy between batch creation and resolution. Players built their bitmaps against the creation-time config; resolving against a different config produces bitmap length mismatches and lost stakes."
- The pinned config is served immutably by the data-node: `/batches/config/:hash` is a forever-cached, content-addressed lookup — `data-node/src/api.rs:6227-6250` ("Once a config exists for a given hash, it will never change... stores results forever with no eviction").
- The hash is content-addressed over the exact market set: `compute_config_hash` sorts markets by `asset_id` and hashes `(asset_id, resolution_type, threshold_bps)` per market plus `(source_id, tick_duration, lock_offset, marketsRoot)` — `batch_engine.rs:309-346`. Two different top-10 memberships necessarily produce two different hashes; a round bound to hash H can only resolve against the set that hashed to H.

So the *display* set on the human page re-ranks live (Phase 1 frontend), and the *next* round's batch may open on a different top-10, but the *open* round always settles on its own frozen membership. This is the same invariant the full-firehose batches already rely on; top-N does not weaken it.

---

## Cross-check: the data-node's own guard binds hash to set

Even outside the per-tick createBatch path, when a signed config is pushed to the data-node, two guards bind the `config_hash` to the actual market list:
- **DN-1** recomputes `compute_config_hash` over the posted markets and rejects on mismatch — `data-node/src/api.rs:6461-6479`.
- **DN-5** verifies the BLS signature over that recomputed hash against the on-chain aggregated pubkey, hard-rejecting if the pubkey is unset — `data-node/src/api.rs:6481-6518`.

A top-10 set and its hash cannot be decoupled: tamper the set, the hash changes, DN-1 rejects; forge the hash, DN-5 rejects. This holds for any N.

---

## Residual observations (not blockers)

1. **The live follower trusts the leader's `config_hash` without fetching the body.** The createBatch follower (Q2) signs an opaque hash; it never pulls `/batches/config/:hash` to confirm the hash corresponds to a sane top-10. This is a *pre-existing* property of the design and is identical for full-firehose batches today. Top-N does not change it. A single compromised proposer for a source could propose any hash its peers will co-sign — but that is the standing trust model (one owner per source), out of scope for this gate. Worth a future hardening pass; not a top-N regression.

2. **Determinism of the top-N set itself.** The selected set is a pure function of the DB snapshot at query time: SQL `ORDER BY COALESCE(NULLIF(market_cap,0), NULLIF(volume_24h,0), value) DESC NULLS LAST, asset_id ASC LIMIT $N`, then the deterministic stagnation filter (order-preserving), then `.take(TOP_N_PER_BATCH)` — `batch_engine.rs` (`get_healthy_assets` firehose branch + the top-N truncation after stagnation). No randomness, stable tiebreak. Because there is one data-node (Q1), all oracles see one set per tick. The `asset_id ASC` tiebreak guarantees that equal-popularity assets order identically on every read.

---

## VERDICT

**SAFE TO DEPLOY.** Top-N is consensus-safe, for four independent reasons, any one of which would suffice:

1. **Single shared data-node** (Q1): all oracles read one set; there is no cross-node top-N divergence to reconcile.
2. **Verify-by-hash, single proposer per source** (Q2): the live follower co-signs the leader's opaque `config_hash`; it neither re-derives nor compares market sets. Churn is undetectable and therefore harmless.
3. **The dangerous tolerances and the rate limit are dead code** (Q3, Q4): `verify_single_source`'s ±30%/<5% checks and the global `MAX_CREATIONS_PER_HOUR=3` cap live only in the stubbed `batch_config_orchestrator`, which is spawned but does nothing. The live `BatchLifecycleManager` applies neither. Top-N cannot trip a check that never runs.
4. **Settlement is bound to the frozen creation-time hash** (Q5): a mid-round re-rank cannot mis-settle; the open round always resolves against its own pinned top-10.

The top-N change reduces each firehose batch from its full healthy universe to 10 markets. It does not increase createBatch frequency (one per source per tick, unchanged), does not introduce randomness, and does not alter the freeze-at-creation settlement contract.

**No oracle code change was required.** The data-node `batch_engine.rs` change is the only code touched, and it is inert until the manual VPS rebuild.

**Recommendation to the human orchestrator:** the deploy is safe to schedule. Rebuild the data-node on VPS 1 and restart oracles per the standard procedure. After the first tick, spot-check `/batches/recommended` for a firehose source and confirm `markets.length == 10` and that the ten are the current top by the source's strongest popularity signal. If the orchestrator's auto-creation/`verify_single_source` path is ever revived, re-open this analysis — the dead tolerances and the global rate limit would then become real, and both need the per-source fixes noted in Q3/Q4 before they can coexist with a churning top-N.
