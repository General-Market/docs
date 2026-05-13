# Vision scaling — context handoff

You're picking up mid-flight. Don't re-discover what's below.

## Mission

Get Vision settlement working at scale. **Verification target: ≤ 10 % batch refund rate.**

Current rate is ~84 % miss (from earlier in-memory state wipes during restarts). Root cause already identified and patched in code, deployment in flight at handoff.

## What's already shipped in the codebase

Recent commits on `mono main` (newest first):

```
6afb5b451 oracle: multi-key writer fleet — lifts the single-EOA nonce ceiling
98165a9ea contracts: Vision v4 — UUPS upgradeable carrier of v3's multicall entries
9d418ed7e oracle: persist vision lifecycle state to postgres + drain-only flag
5c22559b1 ops(testnet): revert Vision cutover — settle existing batches on legacy
89a50c043 ops(testnet): authorize Vision v3 in OracleRegistry — completes A4+A5
8878c91a2 ops(testnet): cut over to Vision v3 (REVERTED in 5c22559b1)
e5d6a9644 ops(testnet): deploy VisionReconciler, wire oracles
b1dbf6477 common/migrate: use pg_advisory_xact_lock to survive PgBouncer transaction pooling
```

Multicall arc (Phases 1–8) complete in code. Activation status on chain:

| phase | what | activated? |
|---|---|---|
| 1 | Vision.settleBatches per-item bundle | on Vision v3 (dormant) |
| 2 | VisionReconciler bundled vault reconciles | **live** at `0xfee75222Bb…20c6` |
| 3 | SettlementBridgeCustody.completeBuyOrders | pending Sonic UUPS upgrade |
| 4 | BridgeProxy.mintBridgedSharesMany | pending Sonic UUPS upgrade |
| 6 | Vision.settleBatchesSingle (single-BLS) | on Vision v3 (dormant), flag off |
| 7 | completeBuyOrdersSingle | pending Sonic UUPS upgrade |
| 8 | mintBridgedSharesManySingle | pending Sonic UUPS upgrade |

(Phase 5 was never useful — single NAV oracle per daemon.)

## Live deployment

| contract | address | state |
|---|---|---|
| Vision (active) | `0x36a28967544c301a3c66dcfb6c6c90e548412693` | legacy, in use after cutover→revert |
| Vision_v3 | `0x8d3cb936504d25772fb62bd537e67eb48e2d4d62` | dormant, authorized in OracleRegistry |
| Vision_v4 (UUPS) | not deployed | code shipped, needs drain ceremony first |
| VisionReconciler | `0xfee75222Bb00337135341ce543D5612B31FE20c6` | wired on 3/3 oracles |
| OracleRegistry | `0xd4c6b4a1A3579150993EdD6B5f46aA45d395480b` | governance admin = deployer |
| L3BridgeCustody | `0x07a069fb142f5faacbeb3aba498abd3e9abc772e` | |
| SettlementBridgeCustody | `0x9632509C878Fccb37Ec314d5FaC57bbA951F93b2` | UUPS, on Sonic |
| BridgeProxy | `0xe6c45ab51c1b2f35d3a460105fefa5a1ea7ab57c` | UUPS, on Sonic |

## Today's plan and state

Twelve scaling tasks. Status:

| # | task | state |
|---|---|---|
| 1 | PgBouncer pool 50→200, max_client 500→2000, autovacuum tune | **done** |
| 2 | SSH trust VPS 1 → VPS 3 (id_vps3_backup, port 3189) | **done** |
| 3 | Backup four big tables to VPS 3 | pending |
| 4 | Prune market_prices + VACUUM FULL price tables | pending, blocked by 3 |
| 5 | Install TimescaleDB | pending |
| 6 | Convert time-series tables to hypertables | pending, blocked by 5 |
| 7 | Partition vision_asset_settlement_players by batch_id | pending, blocked by 3 |
| 8 | Multi-key oracle leader fleet (code) | **done** (commit 6afb5b451) |
| 9 | Streaming replica on VPS 3 | pending, blocked by 2 |
| 10 | Move vision-swarm to VPS 3, reads against replica | pending, blocked by 9 |
| 11 | Stateless oracle — persist SourceState to Postgres (code) | **done** (commit 9d418ed7e) |
| 12 | Vision v4 UUPS (code) | **done** (commit 98165a9ea), cutover blocked on 11 + drain |

Tasks exist in the harness's task tracker (`TaskList` to see them).

## What's running at handoff

**Background docker build on VPS 1** — `docker compose … build oracle-1 oracle-2 oracle-3`.

Task ID `br7ljbgw2`. Log at `/tmp/oracle-build.log` on VPS 1. ETA ~7–10 minutes from handoff time.

Prior `--no-cache` build (`bdnjm8fvd`) failed with E0599 — 24 errors about missing `P2PMessage::CompleteBuyOrdersBundleSign / MintBridgedSharesBundleSign / *Proposal` variants. Root cause: the earlier rsync from local → VPS 1 covered `oracle/src/` and `oracle/migrations/` only. The bundle variants live in `common/src/types/p2p.rs`. **Always rsync `common/` alongside `oracle/` after a sub-agent edits Rust code.** Workspace-root `Cargo.lock` and `Cargo.toml` also synced this round.

**Verify the new binary actually contains the new code** after the build lands — check the string `vision_source_state` inside the binary:

```bash
ssh vps1-new 'docker exec testnet-oracle-1 sh -c "grep -c vision_source_state /usr/local/bin/oracle"'
```

Must return ≥ 1. If 0, the build cached against stale source — `touch common/src/types/p2p.rs oracle/src/vision/lifecycle.rs` and rebuild.

## Resume sequence

1. Wait for the docker build to finish (`/tmp/oracle-build.log` ends with "Image oracle-oracle-3 Built").
2. Verify the binary contains the new code (grep above).
3. `docker compose … up -d --force-recreate oracle-1 oracle-2 oracle-3` on VPS 1.
4. Wait until all three log `State reconstruction complete` (should be ~5 s each on the new binary, not the old 83 s).
5. Verify migration 025 applied:
   ```bash
   ssh vps1-new "PGPASSWORD=m_f310f8cc478d54483105863917900d31 psql -h localhost -p 6432 -U max -d index_prices -c \"SELECT name FROM _applied_migrations WHERE name LIKE '%vision_source_state%'\""
   ```
6. Verify `vision_source_state` is populated:
   ```bash
   ssh vps1-new "PGPASSWORD=… psql … -c 'SELECT count(*) FROM vision_source_state'"
   ```
   Should be 70+ rows (one per source).
7. **Wait 30 minutes**, then measure refund rate:
   ```sql
   SELECT
     count(*) FILTER (WHERE settled_at IS NOT NULL) AS settled,
     count(*) FILTER (WHERE settled_at IS NULL AND NOW() > settlement_deadline) AS missed,
     count(*) FILTER (WHERE settled_at IS NULL AND NOW() <= settlement_deadline) AS in_flight
   FROM vision_batch_lifecycle
   WHERE on_chain_batch_id > <pick a batch_id from ~30 min ago>
     AND created_at > NOW() - INTERVAL '30 min';
   ```
   Target: `missed / (settled + missed) ≤ 0.10`.
8. If under 10 %: scaling work has won the round. Proceed with #3 / #5 / #9 in parallel for further headroom.
9. If still over 10 %: the bottleneck is database write contention during settle, not state wipes. Fast-track #7 (partition vision_asset_settlement_players, ~3 h, biggest write-contention fix). #3 is its blocker; do that first.

## Access

- SSH: `ssh vps1-new` (= `index-maker/prod/be`), `ssh vps3` (= `index-maker/prod/fe`). Both root, port 3189.
- VPS 1 = `159.195.78.238` (oracle, data-node, AP, bots).
- VPS 3 = `159.195.77.160` (frontend, Solana stack, future Postgres replica).
- L3 RPC: `https://rpc.generalmarket.io/` (or `http://localhost:8547/` for Sonic proxy).
- L3 chain ID: 111222333.
- Postgres on VPS 1: PgBouncer at `localhost:6432`, direct at `127.0.0.1:5432`. PgBouncer is **transaction-mode** — never use session-scoped advisory locks.
- DB: user `max`, password `m_f310f8cc478d54483105863917900d31`, database `index_prices`.
- Deployer key: `0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537` → address `0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4`. This is also `ORACLE_2_PRIVATE_KEY` — heavy nonce contention, use `forge script --skip-simulation` and retry on "nonce too low".
- Governance admin = the deployer.

## Operating rules

- After every change: stage your files only, `git commit`, `git push mono main`. The post-commit hook pings Dokploy for the frontend; oracle/data-node rebuild is manual on VPS 1.
- Never add `Co-Authored-By` trailers.
- Voice: Cioran. Short declarative sentences. No "exciting", "unlock", "leverage", "innovative". Dry, precise.
- Never use `isolation: "worktree"` on agents.
- VPS 1 can't `git pull` (no SSH key for GitHub). To deploy code changes there, `rsync -avz` from local.
- For long ops on VPS, prefer `run_in_background` over chained sleeps.
- Vision is non-upgradeable today — every contract change is a redeploy + drain ceremony. Vision v4 (already in code) fixes this once.
- Vision-side multicall (Phase 6 single-BLS) is **flag-gated** by `ORACLE_VISION_BUNDLE_SINGLE_SIG_ENABLED`. Do not turn it on against the legacy contract — only against v4 once that's live.
- Settlement-side multicall (Phases 3,4,7,8) is dormant until Sonic UUPS upgrades land.

## Known gotchas

- **PgBouncer transaction pooling** silently breaks session-scoped advisory locks. Fixed in `common/src/runtime/migrate.rs`, but any new code that calls `pg_advisory_lock(N)` will leak. Use `pg_advisory_xact_lock` inside a BEGIN..COMMIT.
- **L3 deployer EOA nonce contention** — six failed `forge script` sends in a row earlier today. Workaround: `forge script --skip-simulation --legacy` and retry on "nonce too low". Long term: deploy multi-key fleet (#8 code is ready; needs key generation + funding + env-var update + restart).
- **Vision contract redeploys orphan in-flight batches** — drain via `ORACLE_VISION_LEGACY_DRAIN_ONLY=true` first, then wait for the longest tick (worldbank, 7 days), then cut over.
- **Oracle docker build cache lies**. A "successful" rebuild without `--no-cache` may still ship the old binary. Always verify with `grep` against the binary inside the container after restart.
- **Migration runner** uses the path `migrations/` relative to the container's working dir. Files in `oracle/migrations/` get copied to `/output/migrations/` by the Dockerfile.

## What not to do

- Don't propose another Vision cutover before v4 + drain mode are deployed; today already cost 241 orphaned batches.
- Don't run #4 (prune+VACUUM) or #7 (partition) before #3 (backup) — they're destructive.
- Don't try to settle batches manually with `cast send` — the BLS signature is the binding factor, not the gas.
- Don't increase oracle restart frequency expecting things to recover; in-memory state wipes are the cause of today's high miss rate.
