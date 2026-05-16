# Vision Storage Redesign — TimescaleDB Hypertables, JSONB Compaction, Real Retention

Status: design + phase 1 (foundation). Cutover scheduled after the in-flight wraparound vacuums clear.
Author: storage redesign sub-agent
Date: 2026-05-16

The retention pruner was a tourniquet. The patient still has hundreds of millions of unfrozen tuples and an N+1 settlement writer. This doc proposes the bone-setting.

---

## 1. Current State (measured 2026-05-16, VPS 1, `index_prices`)

TimescaleDB 2.19.3 is installed. Two zero-chunk hypertable stubs already exist: `vision_asset_settlement_players` and `vision_market_ratios`. The writers point at those names, but the rows live in the `_archive` siblings — the rename happened in psql, the rewire never happened in code.

| Table | Size | Rows | Cardinality / cycle | Retention today |
|---|---|---|---|---|
| `vision_asset_settlement_players_archive` | 84 GB | 262 174 928 | ~40 960 INSERTs per polymarket batch (8192 markets × 5 players) | 4 h via retention.rs (band-aid) |
| `market_prices` | 81 GB | 240 321 705 | thousands of rows/min, mostly identical values from `always_record_price=true` | 30 d via retention.rs |
| `vision_market_ratios_archive` | 20 GB | 102 566 350 | 1 row per (batch, asset) | none today |
| `prices` (legacy) | 14 GB | 97 401 420 | still read by `db.rs::query_nearest_price` | none |
| `klines` | 9 GB | 73 281 536 | OHLC, Bitget backfill | none |
| `vision_bitmaps` | 1.5 GB | 197 646 | 1 per (batch, player, slot) | 4 h after settlement |

Two `autovacuum (to prevent wraparound)` are running right now. Host load ~40. The 30-d horizon kept the byte count bounded but did nothing for transaction-ID age — tuples age in XIDs, not gigabytes. Every emergency vacuum cycle is the system telling us the schema is wrong.

Two structural failures compound it:

1. **N+1 INSERTs at settlement.** `oracle/src/vision/lifecycle.rs::record_market_ratios` issues one `INSERT … ON CONFLICT` per (batch, asset) into `vision_market_ratios` and one per (batch, asset, player) into `vision_asset_settlement_players`. A polymarket settlement = ~8 192 + ~40 960 = ~49 000 round-trips. The lifecycle author already spawns this off the heartbeat as a damage-control measure (commit `17d0ecd46`). The right fix is fewer rows, not async penance.

2. **Always-write market_prices.** `traits.rs::always_record_price()` defaults to `true`. Every successful fetch writes a row even when the value is byte-identical to the previous one. The in-memory `last_sent_values` dedup is overridden by the default. Counter-style sources need the heartbeat for staleness gating — but a 1 hour heartbeat is enough for that, not a 30 second one.

---

## 2. Target Architecture

### 2.1 `market_prices` — hypertable, native compression, 30 d retention

```sql
SELECT create_hypertable('market_prices', 'fetched_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists       => TRUE,
  migrate_data        => FALSE);

ALTER TABLE market_prices SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source, asset_id',
  timescaledb.compress_orderby   = 'fetched_at DESC'
);

SELECT add_compression_policy('market_prices', INTERVAL '2 days');
SELECT add_retention_policy('market_prices',  INTERVAL '30 days');
```

Rationale:
- Chunk-by-day: ~1.5 GB raw per chunk before compression; cleanly drops by the retention policy in O(1).
- `segmentby = (source, asset_id)`: every read filter shape we use (`WHERE source = $1 AND asset_id = $2 ORDER BY fetched_at DESC`) hits a single segment and skips the rest. Expect 10–15× compression on this shape.
- Compression after 2 days: leaves the hot chunk uncompressed so the ON CONFLICT-less append-only writes stay cheap.

Compaction policy at the source layer (`always_record_price`):
- Default flips to **false**.
- Sources keep their heartbeat by overriding `heartbeat_interval()` → `Duration::from_secs(3600)` (new method, default 1h). Sync engine writes if `value changed` OR `now - last_written_at > heartbeat_interval`.
- Net effect on counter-style sources: 1 row/hour/asset instead of 1 row/30s/asset. 120× fewer rows, oracle staleness gate (currently 8h) still sees the source alive.

### 2.2 `vision_asset_settlement_players` → `vision_settlements` (JSONB-compacted hypertable)

Replace 40 960 rows per batch with **one row per batch**:

```sql
CREATE TABLE vision_settlements (
    batch_id     BIGINT      NOT NULL,
    source_id    TEXT        NOT NULL,
    settled_at   TIMESTAMPTZ NOT NULL,
    outcome_summary JSONB    NOT NULL, -- aggregate ratios per asset
    player_results  JSONB    NOT NULL, -- per-player detail
    PRIMARY KEY (batch_id, settled_at)
);

SELECT create_hypertable('vision_settlements', 'settled_at',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists       => TRUE);

ALTER TABLE vision_settlements SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'source_id',
  timescaledb.compress_orderby   = 'settled_at DESC'
);

SELECT add_compression_policy('vision_settlements', INTERVAL '2 days');
SELECT add_retention_policy('vision_settlements',  INTERVAL '30 days');
```

JSONB shape:

```jsonc
// outcome_summary
{
  "BTCUSDT": { "outcome": "Up",   "up_stake": "1234000000000000000000", "down_stake": "987000000000000000000", "pct_change_bps": 42 },
  "ETHUSDT": { "outcome": "Down", "up_stake": "0",                       "down_stake": "550000000000000000000", "pct_change_bps": -19 }
  // … one entry per asset_id
}

// player_results
{
  "0xabc…": {
    "deposited": "1000000000000000000",
    "payout":    "1735000000000000000",
    "pnl":       "735000000000000000",
    "correct":   42,
    "total":     50,
    "by_asset": [
      { "asset": "BTCUSDT", "side": "Up", "won": true,  "stake": "20000000000000000", "payout": "35200000000000000" }
      // … repeated per (asset_id) the player participated in
    ]
  }
  // … one entry per player
}
```

Why JSONB and not normalized:
- The only read paths against this data are (a) "batch X — show me the ratios" (one row), (b) "asset Y — last N settlements with their player breakdown" (N rows, JSON unpacked client-side). Neither needs row-per-player on the hot path.
- Row count drops by a factor of ~5 000 for polymarket batches. The biggest single contributor to wraparound pressure dies.
- Compression on JSONB columns with shared key prefixes hits 8–12× routinely.
- Keeping it queryable: `outcome_summary -> 'BTCUSDT'` is a GIN-indexable expression if we ever need it. We won't, today.

### 2.3 `vision_market_ratios` — folded into `vision_settlements.outcome_summary`

No separate table. The aggregate ratios are derivable from `outcome_summary` in JSONB. The current API endpoint `/vision/batch/:id/ratios` returns exactly that shape after one row fetch + one JSONB unfold.

### 2.4 `vision_bitmaps` — hypertable on derived time

```sql
ALTER TABLE vision_bitmaps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Promote to hypertable on the new time column. Since the table has only ~200k
-- rows we can `migrate_data => TRUE` in one shot.
SELECT create_hypertable('vision_bitmaps', 'created_at',
  chunk_time_interval => INTERVAL '1 day',
  migrate_data        => TRUE,
  if_not_exists       => TRUE);

ALTER TABLE vision_bitmaps SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'batch_id',
  timescaledb.compress_orderby   = 'created_at DESC'
);

SELECT add_compression_policy('vision_bitmaps', INTERVAL '1 day');
SELECT add_retention_policy('vision_bitmaps',  INTERVAL '7 days');
```

Bitmaps are evidence we re-verify once at settlement and then keep around only for dispute windows. 7 days is generous; could tighten to 48 h later.

### 2.5 `prices` (legacy) — keep, hypertable, retention

Still read by `query_nearest_price` in `db.rs`. Don't drop. Convert to a hypertable so the same retention machinery applies.

```sql
SELECT create_hypertable('prices', 'fetched_at',
  chunk_time_interval => INTERVAL '7 days',
  migrate_data        => FALSE,
  if_not_exists       => TRUE);

SELECT add_compression_policy('prices', INTERVAL '7 days');
SELECT add_retention_policy('prices',  INTERVAL '90 days');
```

### 2.6 `klines` — out of scope today

9 GB. Slow-growth (OHLC, finite symbol set). Convert in a follow-up; not urgent.

---

## 3. Migration Plan

Five phases. Each independently rollback-able. Phase 1 ships in this commit. Phases 2–5 are gated on the in-flight emergency vacuums clearing.

### Phase 1 — Foundation (this commit)
- SQL migrations create the new schema as **net-new** tables (`vision_settlements`, `market_prices_v2`, `vision_bitmaps_v2`, `prices_v2`) wrapped in hypertables with compression + retention policies.
- The migrations only run their TimescaleDB DDL when `timescaledb` is installed; they no-op otherwise (testnet, local Anvil dev). `CREATE EXTENSION IF NOT EXISTS timescaledb;` is guarded.
- Dual-write code paths land behind env var `USE_NEW_STORAGE=1` (default off). When unset, behavior is identical to today. When set, every write to the old table is mirrored to the new one inside the same transaction (or best-effort spawn for the bitmap async path).
- Reads stay on the old tables. Retention pruner stays running.
- **Net effect on prod when shipped: zero.** The migrations create empty tables and policies; without the flag, nothing dual-writes.

### Phase 2 — Backfill (manual, off-hours)
Once the two emergency vacuums finish:
1. Flip `USE_NEW_STORAGE=1` on data-node + oracle. Dual-write begins. Verify lag with row-count probes.
2. Backfill `market_prices_v2` from `market_prices` in 1-day windows oldest → newest, with `INSERT … SELECT … ORDER BY fetched_at` and `pg_sleep(0.5)` between windows. TimescaleDB ingests into the right chunk on its own.
3. Backfill `vision_settlements` from `vision_market_ratios_archive` + `vision_asset_settlement_players_archive` joined by (batch_id, asset_id), grouped into the JSONB shape. A `psql` script with `\copy … (FORMAT csv)` to a staging table, then `INSERT … SELECT … jsonb_object_agg(...)`. One pass per source. Expect ~30 min total.

### Phase 3 — Read cutover
- Flip the four read sites in `oracle/src/vision/api.rs` (`batch_ratios`, `asset_settlements`) and any frontend-facing aggregations to read from `vision_settlements`.
- Frontend has no schema knowledge; the endpoint shape is preserved.
- Keep dual-write on. If a read regression surfaces, revert the read switch; old tables still hot.

### Phase 4 — Stop the dual-write, drop the old paths
- Remove the dual-write branches behind `USE_NEW_STORAGE`.
- Rename the new tables back to canonical names: `vision_settlements_v2 → vision_settlements`, `market_prices_v2 → market_prices`, `prices_v2 → prices`, `vision_bitmaps_v2 → vision_bitmaps`. The old `market_prices`/`prices`/`vision_bitmaps` rename to `*_legacy_drop`.
- Delete the `retention.rs` task; TimescaleDB retention policies take over.

### Phase 5 — Garbage collection
- `DROP TABLE vision_asset_settlement_players_archive, vision_market_ratios_archive, market_prices_legacy_drop, prices_legacy_drop, vision_bitmaps_legacy_drop;`
- Drop the empty 0-chunk hypertable stubs (`vision_asset_settlement_players`, `vision_market_ratios`).
- Drop the redundant indexes the user queued (`idx_market_prices_source_fetched`, `idx_market_prices_asset_time`, `idx_market_prices_asset`) — already in flight outside this plan.

### Rollback paths
- **Phase 1**: unset `USE_NEW_STORAGE`. No behavior change to revert.
- **Phase 2**: stop the backfill. Old tables untouched. New tables drop with `DROP TABLE` (chunks go with them).
- **Phase 3**: revert the four read switches. Old data is still hot.
- **Phase 4**: harder — undoing the rename means a rename-back and re-enabling the dual-write branch. Don't enter phase 4 until phase 3 has soaked for ≥48 h.

---

## 4. Capacity Projections

**Current trajectory (6 months at status quo, no retention):**
- `market_prices`: 81 GB × 6 ≈ 486 GB (linear)
- `vision_asset_settlement_players_archive`: 84 GB × 6 ≈ 504 GB
- `vision_market_ratios_archive`: 20 GB × 6 ≈ 120 GB
- **Total: ~1.1 TB on the high-volume tables alone, plus continuing wraparound emergencies every ~30 days.**

**Post-redesign (6 months, with 30 d retention + 10× compression on chunks older than 2 days):**

```
market_prices:
  raw at 30d horizon: ~81 GB × (30/365) projection ≈ 81 GB worst case unchanged
  with 1h heartbeat (×0.05): ~4 GB raw
  with 10× compression on 28 of 30 days: ~0.5 GB compressed + 0.3 GB hot = ~0.8 GB
  Saving vs trajectory: 600×.

vision_settlements (replacing _archive):
  ~5 000× fewer rows; 30 d retention.
  Estimate: 50 707 batches in 6 months × ~50 KB/batch JSONB = ~2.5 GB raw
  Compressed: ~250 MB
  Saving vs trajectory: 2 000×.

vision_bitmaps_v2:
  7 d retention, ~200 k rows steady-state: ~150 MB raw, ~20 MB compressed.

prices (legacy):
  90 d retention + compression: ~3 GB compressed (vs 14 GB today, growing).
```

**Projected total at 6 months: ~5 GB across the redesigned set.** vs ~1.1 TB on the current trajectory. Wraparound becomes structurally impossible because chunks drop before they age.

**12 months: identical to 6 months** — that's the point of retention. Steady-state.

---

## 5. Codebase Cleanup at End of Phase 5

Delete:
- `data-node/src/retention.rs` (entire file)
- The `--prune-retention-days` CLI arg in `data-node/src/config.rs`
- The retention `spawn(...)` call in `data-node/src/main.rs` / `serve.rs`
- The 0-chunk hypertable stubs in the DB (the two pre-existing empty hypertables)
- Old `record_market_ratios` and the per-player loop in `lifecycle.rs` (replaced by single JSONB insert)
- Any callers of `vision_asset_settlement_players_archive` / `vision_market_ratios_archive` (none in code today; retention.rs only)

Keep:
- `klines` (out of scope, follow-up)
- `vision_round_players` (per-round aggregate, low cardinality, fine as-is)
- `vision_batch_lifecycle` (PK table, used everywhere)

---

## 6. Open Questions (decide before phase 2)

1. **Should `outcome_summary` and `player_results` be split into two columns, or one JSONB with two top-level keys?** Two columns lets compression segment differently. Going with two for now; cheap to merge later.
2. **Backfill or skip?** The current 30-day window of settlements is mostly polymarket coin-flips that resolved as `Cancelled` or `AllSameSide`. Probably skip the backfill — start the new table at the cutover instant, let the old table age out via existing retention. Saves ~30 min of script time and removes the only risky write during phase 2.
3. **`market_prices` always_record_price audit.** Ship the 1h heartbeat default, but verify per-source that the override list (currently ~18 sources opt back in) is correct. The default flip alone cuts write rate ~80%.

---

## 7. What's In This Commit (Phase 1)

- `data-node/migrations/034_create_hypertables_v2.sql` — TimescaleDB-conditional DDL for the four new tables + policies. Idempotent. No-ops without the extension.
- `oracle/migrations/027_create_vision_settlements.sql` — same shape, oracle side.
- `data-node/src/market_data/write_channel.rs` — dual-write to `market_prices_v2` when `USE_NEW_STORAGE=1`. Same statement structure, separate retry buffer.
- `oracle/src/vision/lifecycle.rs` — new `record_settlement_jsonb` that emits one row to `vision_settlements`. Called alongside the existing per-row writers when `USE_NEW_STORAGE=1`.
- `oracle/src/vision/bitmap_store.rs` — populate `created_at` on insert (already defaults to NOW(), but explicit for the dual path).
- No reads moved. No data backfilled. No old tables touched.

Cutover schedule (pending vacuum completion):
- T+0 (vacuum-clear): flip `USE_NEW_STORAGE=1` on staging data-node, validate row counts for 24 h.
- T+24 h: flip on prod oracle + data-node. Monitor for 48 h.
- T+72 h: read-cutover PR (phase 3).
- T+7 d: phase 4 rename + retention.rs deletion.
- T+10 d: phase 5 GC.

This is the foundation. The bone is set. We wait for the swelling.
