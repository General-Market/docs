# Vision Settlement Stability Plan

**Date:** 2026-05-13
**Target refund rate:** ≤ 10 %
**Observed today:** ~89 %

Refunds are not a bug. They are the shape of an architecture that mistook hope for budget.

## Diagnosis

The cliff is `(createdAtTick + 1) * tickDuration + settlementGrace`. With `settlementGrace = 2 * tick`, that gives the oracle one tick after `betting_end` to land settlement on-chain. Inside that tick the pipeline does: resolve → BLS sign → aggregate → quorum → broadcast → mine → confirm. One first-try miss usually exceeds the cliff. The recovery sweep wakes too late. The lifecycle clears `previous_batch_id` regardless of outcome. The deployer EOA serializes every L3 write. None of these alone explains 89%. Together they explain it precisely.

## Blocker map

| # | Blocker | Root cause | Symptom |
|---|---------|------------|---------|
| 1 | 2-tick architectural lag | `lifecycle.rs:357–365` defers settle until `betting_end + 60s`, then waits for next heartbeat. First settle attempt lives ~half the grace window. | `SettlementWindowClosed` revert on retry. |
| 2 | First-attempt fragility | Cosign timeout 30s; one nonce queue on deployer EOA; broadcast-relay drops. | INFRA-002 gas-est revert. |
| 3 | Recovery sweep too slow | 60s interval, independent task, not event-driven. | Retry lands after cliff. |
| 4 | Bookkeeping clears state on failure | `lifecycle.rs:424–435` always nulls `previous_batch_id`. Recovery has only the proof row; the lifecycle row no longer points at it. | Failed settles disappear from per-source view. |
| 5 | Deterministic signer hint absent for settle | `writer.settle_batch` does not pass a `hint` derived from `batch_id`. Even with a fleet, all settles can collide on one signer. | Fleet activation alone would not eliminate nonce contention. |

## Phases

### Phase 0 — Activate the fleet (already coded, never enabled)

**Objective.** Free settle from the deployer nonce queue.

**Files.** `docker/testnet/oracle/.env` (`ORACLE_FLEET_KEYS=...`); generate two L3 EOAs; fund with GM gas drip; `oracle/src/main.rs` startup path that already reads `ORACLE_FLEET_KEYS` (verify; if missing, add at writer construction next to where `EthersChainWriter::new` is called).

**Trade-offs.** Three keys must be funded and rotated. New EOAs are not `ORACLE_2_PRIVATE_KEY`; consensus identity stays on `signer_addresses[0]`. BLS-on-chain accepts any submitter — that's safe.

**Disruption.** One container restart per oracle, ~10 min boot ramp. No contract change.

**Depends on.** Nothing. Ship first.

### Phase 1 — Settle on the SAME heartbeat as resolve

**Objective.** Kill the 2-tick lag. Move from `tick × 2` to `tick + ε`.

**Files.** `oracle/src/vision/lifecycle.rs:340–438` — collapse step 1. Pass `hint = batch_id` to `chain_writer.settle_batch` so fleet distribution is deterministic (`writer.rs:786–807`). Drop the `betting_end + 60s` defer (line 357) to `betting_end` plus a small drift buffer (10s) — proof exists only after lock; signing path is already idempotent.

**Mechanism.** Heartbeat fires at `last_heartbeat + tick`. Currently rotates current→previous, then *next* heartbeat resolves+settles. Instead: at heartbeat T, if `previous` exists and `betting_end <= NOW() - 10s`, resolve + sign + submit immediately. If submission fails inside this heartbeat, do **not** clear `previous_batch_id`. The cliff at `(createTime + tick × 2)` then offers a full tick of in-band retry.

**Trade-offs.** Heartbeats become longer (resolve + on-chain ≈ 5–15s). Semaphore (`MAX_CONCURRENT_SOURCES`) absorbs it. Co-sign for createBatch still runs in the same heartbeat; budget for both must fit under the next tick — see Phase 2.

**Risk.** Resolve before all chain events landed → bitmaps lag. Already mitigated by `chain_listener` event-indexer; verify it's `betting_end - lock_offset` aware. If not, add a single-query check on `vision_batch_lifecycle.last_event_block`.

**Disruption.** Code-only. One build + container recycle. Refund rate should drop here.

**Depends on.** Phase 0 for nonce throughput, otherwise heartbeats stack on one EOA.

### Phase 2 — On-failure escalation: do not clear, do not wait

**Objective.** Replace the periodic sweep with on-demand retry inside the lifecycle.

**Files.** `oracle/src/vision/lifecycle.rs:401–437` (the `bls_ok` branch). `oracle/src/vision/lifecycle.rs:1973–2029` (recovery loop — tighten interval to 5s, keep as backstop only).

**Mechanism.**

1. On `sign_and_aggregate_settlement` Err: keep `previous_batch_id`. Mark `vision_settlement_proofs.next_retry_at = NOW() + 3s`. Log INFRA classification.
2. Spawn an immediate in-heartbeat retry (up to 3 attempts) with 3s/6s/12s backoff. Each attempt uses a different fleet hint (`batch_id + attempt`).
3. Recovery loop tightens to `RECOVERY_INTERVAL_SECS = 5` and reads `next_retry_at <= NOW()` first. It becomes a survivor for cross-restart cases only.

**Trade-offs.** The heartbeat may now run for 30–45s in the worst case (3 retries × ~12s). Acceptable: still under the cliff for any tick ≥ 60s, and `MAX_CONCURRENT_SOURCES` keeps the pool sane.

**Risk.** Double-submission: prevented by `submitted = true` UPSERT + on-chain `BatchAlreadySettled` revert handler (already at `lifecycle.rs:1516`). BLS aggregation is not bypassed anywhere — all retries reuse the existing aggregated signature row.

**Disruption.** Code-only.

**Depends on.** Phase 1.

### Phase 3 — Decouple createBatch co-sign from settle path

**Objective.** Cosign timeout never blocks settle.

**Files.** `oracle/src/vision/lifecycle.rs:319–530`.

**Mechanism.** Run create-batch co-sign in a `tokio::spawn` whose result writes back to `vision_source_state.current_batch_id` asynchronously. The heartbeat does not await it. The next heartbeat sees `current_batch_id IS NULL` and re-proposes — already the safe path.

**Trade-offs.** Brief tick where no current batch exists for a source. Player joins fail with `BatchNotFound` for ≤30s. Acceptable: this already happens today on co-sign timeout.

**Risk.** Two leaders proposing simultaneously across a restart boundary. The `CosignRouter` DashMap already deduplicates by `source_id`; the second proposal short-circuits.

**Disruption.** Code-only.

**Depends on.** None.

### Phase 4 — Drop `VISION_COSIGN_TIMEOUT_SECS` to 10s, add fast-fail

**Objective.** Truncate the head of the failure curve.

**Files.** `oracle/src/vision/lifecycle.rs:60–65`. Env in `docker/testnet/oracle/.env`.

**Mechanism.** 30s is generous and corresponds to nothing measurable. Drop to 10s. Followers respond in <2s under normal load. If 2/3 not collected, abort and let Phase 3's retry path handle it next heartbeat.

**Trade-offs.** During P2P degradation, more createBatch aborts. Acceptable — players see one missed batch, not 89% refunds.

**Depends on.** Phase 3.

### Phase 5 — v4 cutover (only if 0–4 do not reach ≤10%)

**Objective.** Move grace to `3 × tick`, fix on-chain. Adds margin for any future regression.

**Files.** `contracts/src/vision/VisionV4.sol`. Deploy proxy at new address. Migrate the live contract via drain ceremony.

**Cost — loud.** Drain ceremony stops new createBatches across all sources. Longest tick is `worldbank = 7 days`. That is **up to seven days of refunds** at the longest source while drain completes, even if shorter sources resume on v4 within minutes. Do not attempt without 0–4 first proving insufficient.

**Trade-offs.** UUPS standard timelock 7d, emergency 24h. Use emergency only if 0–4 fail to land us below 30% in two weeks of observation. Bundle path (`settleBatchesSingle`) becomes safe to activate post-cutover.

**Disruption.** Days. Contract change. Drain ceremony. Hard.

**Depends on.** Phases 0–4 measured insufficient.

## Sequencing

| Order | Phase | Wall time | Expected refund delta |
|-------|-------|-----------|----------------------|
| 1 | Phase 0 (fleet) | 1 build cycle | -20 pp |
| 2 | Phase 1 (same-heartbeat settle) | 1 build cycle | -40 pp |
| 3 | Phase 2 (on-failure escalation) | 1 build cycle | -20 pp |
| 4 | Phase 3 (async cosign) | 1 build cycle | -5 pp |
| 5 | Phase 4 (timeout 10s) | env change | -2 pp |
| 6 | Phase 5 (v4 cutover) | days | margin only |

Target ≤ 10 % achieved by Phase 3, comfortably.

## Hard constraints respected

- BLS verification never bypassed. All phases reuse `sign_and_aggregate_settlement` and `vision_settlement_proofs` rows.
- Vision contract untouched in 0–4. Phase 5 is the only contract change and is conditional.
- `ORACLE_2_PRIVATE_KEY` stays on `signer_addresses[0]`.
- Cosign timeout cut, not bumped — Phase 4 shortens, does not serialize.

## Verification

- Refund rate (30-min window) per source — primary metric.
- `vision_settlement_proofs.retry_count` distribution — should fall.
- `SettlementWindowClosed` revert count from JSON-RPC logs — should approach zero.
- Heartbeat duration p99 per source — must remain under `tick_duration`.

## Critical files

- `oracle/src/vision/lifecycle.rs`
- `oracle/src/chain/writer.rs`
- `oracle/src/main.rs`
- `oracle/src/vision/config.rs`
- `contracts/src/vision/VisionV4.sol`
