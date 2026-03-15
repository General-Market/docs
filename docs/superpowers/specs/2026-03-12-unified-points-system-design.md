# Unified Points System Design

**Date**: 2026-03-12
**Status**: Draft

## Overview

Migrate Vision points from frontend-only estimation to server-authoritative data-node computation, and add two new Index (ITP) point pools. All three pools write to a shared ledger on the data-node, with a single API serving totals and leaderboard.

## Point Pools

| Pool | Budget | Ranked by | Frequency | Who earns |
|---|---|---|---|---|
| **Vision** | 48,000 pts/hr (capped) | TVL share per batch | Every tick (~10 min) | Batch participants |
| **Index Creator** | 24,000 pts/hr | Cumulative NAV % growth since ITP creation | Hourly | ITP creator address |
| **Index Holder** | 24,000 pts/hr | Weighted avg NAV growth since buy | Hourly | Anyone holding ITP shares |

**Total system emission**: 96,000 pts/hr.

## Vision Points (Migration)

### Current state
- Computed in `frontend/hooks/vision/useVisionPoints.ts`
- Formula: `100 pts/tick/batch × (myBalance / batchTVL)`
- Recalculated on page load — not persisted, not verifiable

### New state — fixed budget distribution
The old formula (100 pts/tick/batch, uncapped) produces variable emission depending on batch count and tick durations. The new model uses a **fixed hourly budget of 48,000 pts** distributed proportionally.

**Computation**: The data-node consumes tick resolution events from the oracle API. On each tick for each batch:
1. Call oracle's `GET /vision/batch/{id}/state` to get player balances + TVL
2. Compute each player's TVL share: `share_i = balance_i / batch_tvl`
3. Compute per-tick budget: `tick_budget = 48,000 / total_ticks_per_hour` where `total_ticks_per_hour` = sum of `3600 / tick_duration` across all active batches
4. Player points: `points_i = tick_budget × share_i`
5. Batch-insert into `points_ledger` with pool='vision'

This ensures total Vision emission is always 48,000 pts/hr regardless of how many batches exist or their tick durations.

**Data source**: The data-node does NOT have direct access to Vision player balances. It fetches batch state from the oracle's existing `/vision/batch/{id}/state` endpoint (already returns player list with balances). The data-node polls all active batch IDs from `/vision/batches`, then fetches state for each on a schedule matching tick durations.

### Tick event detection
- Data-node polls `/vision/batches` every 30s to get active batch list with `last_tick_id`
- When `last_tick_id` increments for a batch, a new tick has resolved — trigger points computation
- Store `last_seen_tick_id` per batch in memory to detect changes

## Index Creator Points

### Eligibility
- The `creator` address stored in `_itps[itpId].creator` on Investment.sol
- Only ITPs with positive cumulative NAV growth qualify
- Negative or zero growth = 0 points (excluded from ranking)

### Performance metric
```
nav_growth_pct = (nav_current - nav_at_creation) / nav_at_creation
```

### NAV at creation
- Store `nav_at_creation` in a new `itp_meta` table when first observed by data-node
- The data-node's `itp_collector.rs` already reads `_creator` from `getITPState()` but currently discards it — modify to persist both creator and NAV to `itp_meta`
- For existing ITPs at migration time, use current NAV as baseline (start earning from migration onward)

### Distribution
- Hourly at wall-clock hour boundaries (:00): rank all eligible ITPs by `nav_growth_pct` descending
- Tiebreak: by ITP creation timestamp (older first), then by `itp_id` lexicographic
- Assign weights with 0.7x exponential decay:
  - Rank 1: weight = `0.7^0 = 1.0`
  - Rank 2: weight = `0.7^1 = 0.7`
  - Rank 3: weight = `0.7^2 = 0.49`
  - Rank N: weight = `0.7^(N-1)`
- Normalize: `player_points = floor((weight / sum_of_all_weights) × 24,000)`
- Remainder from flooring goes to rank 1
- Write to `points_ledger`

### Example (5 ITPs, all positive growth)

| Rank | Weight | Normalized | Points |
|---|---|---|---|
| 1 | 1.000 | 36.1% | 8,658 |
| 2 | 0.700 | 25.2% | 6,061 |
| 3 | 0.490 | 17.7% | 4,243 |
| 4 | 0.343 | 12.4% | 2,970 |
| 5 | 0.240 | 8.7% | 2,079 |
| **Total** | **2.7731** | **100%** | **24,000** |

Rank 1 gets floor allocation + any remainder.

## Index Holder Points

### Eligibility
- Any address holding ITP shares (from `getUserShares(itpId, user)`)
- Only holders with positive weighted portfolio performance qualify

### Holder discovery
The data-node cannot enumerate all ITP holders from chain state alone. Approach:
1. Scan `OrderFilled` events from Investment.sol to build a set of known holder addresses (already tracked in the `orders` table)
2. For each known address, query `getUserShares(itpId, user)` for all ITPs
3. Addresses with 0 shares across all ITPs are skipped
4. Note: users who received shares via direct ERC20 transfer (not through Investment.sol) will not be discovered. This is acceptable for testnet — all trading goes through Investment.sol.

### Performance metric
```
For each ITP held:
  nav_growth_i = (nav_current_i - nav_at_buy_i) / nav_at_buy_i

Weighted portfolio performance:
  perf = Σ(shares_i × nav_growth_i × nav_at_buy_i) / Σ(shares_i × nav_at_buy_i)
```

### NAV at buy
- When a fill event is processed, record `nav_at_fill` in the existing fills/trades table
- For existing positions at migration, use current NAV as baseline (start earning from migration)
- Multiple buys: weighted average NAV at buy across all fills for that ITP
- Full exit then rebuy: NAV-at-buy resets — only active fills contribute to the weighted average

### Distribution
- Same 0.7x decay curve as Creator pool, same tiebreak rules
- Rank all eligible holders by `perf` descending
- `player_points = floor((weight / sum_of_all_weights) × 24,000)`
- Remainder to rank 1
- Write to `points_ledger`

## Database Schema

### `points_ledger` (new table, append-only)
```sql
CREATE TABLE points_ledger (
    id          BIGSERIAL PRIMARY KEY,
    player      TEXT NOT NULL,          -- 0x address
    pool        TEXT NOT NULL,          -- 'vision' | 'index_creator' | 'index_holder'
    points      NUMERIC NOT NULL,       -- exact precision, no float drift
    reason      TEXT NOT NULL,          -- e.g. 'vision:batch:42:tick:1205' or 'index:hourly:2026-03-12T14'
    rank        INTEGER,               -- NULL for vision (share-based, not ranked)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player, pool, reason)        -- idempotency: prevent duplicate awards
);
CREATE INDEX idx_points_player_pool ON points_ledger(player, pool);
CREATE INDEX idx_points_created ON points_ledger(created_at);
```

### `points_totals` (materialized summary, updated on write)
```sql
CREATE TABLE points_totals (
    player      TEXT NOT NULL,
    pool        TEXT NOT NULL,
    total       NUMERIC NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player, pool)
);
```
Updated via trigger or application-level upsert on each `points_ledger` insert. The `/points?user=` endpoint reads from this table for O(1) lookups instead of scanning the ledger.

### `itp_meta` (new table)
```sql
CREATE TABLE itp_meta (
    itp_id          TEXT PRIMARY KEY,   -- bytes32 hex
    creator         TEXT NOT NULL,      -- 0x address
    nav_at_creation NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Additions to existing tables
- `orders` / fills table: add `nav_at_fill NUMERIC` column for holder NAV-at-buy tracking

## Data-Node Implementation

### Vision points on tick detection
- New module `vision_points.rs`:
  1. Poll `/vision/batches` every 30s to get batch list + `last_tick_id`
  2. On tick increment: call `/vision/batch/{id}/state` to get players + balances + TVL
  3. Compute fixed-budget points (see Vision section above)
  4. Batch-insert into `points_ledger` + upsert `points_totals`
  5. Use `reason = 'vision:batch:{batch_id}:tick:{tick_id}'` for idempotency

### Index points hourly cron
- New module `index_points.rs` triggered at wall-clock hour boundaries:
  1. **Creator pool**: read `itp_meta` + current NAVs from `itp_snapshots`, compute rankings, distribute 24K
  2. **Holder pool**: read known holders from `orders` table, query current shares via RPC, compute weighted NAV growth, rank, distribute 24K
  3. Batch-insert into `points_ledger` + upsert `points_totals`
  4. Use `reason = 'index:hourly:2026-03-12T14'` for idempotency

### Missed windows
If the data-node is down for multiple hours, missed hourly distributions are **not backfilled**. Points are only awarded for hours where the cron actually runs. This is acceptable for testnet.

### New API endpoints
- `GET /points?user={address}` — reads from `points_totals`:
  ```json
  {
    "vision": 12500.0,
    "index_creator": 8400.0,
    "index_holder": 3200.0,
    "total": 24100.0,
    "updated_at": "2026-03-12T14:00:00Z"
  }
  ```

- `GET /points/leaderboard?limit=50&offset=0` — returns top players by total points across all pools

## Frontend Changes

### Remove
- `frontend/hooks/vision/useVisionPoints.ts` — replaced by server data

### New hook
- `frontend/hooks/usePoints.ts` — fetches `GET /points?user={address}` from data-node
- Returns `{ vision, indexCreator, indexHolder, total, isLoading }`

### `/points` page updates
- Hero: show combined total from all pools
- Three sections: Vision earnings, Index Creator earnings, Index Holder earnings
- Each section shows pool total + earning rate
- Leaderboard: fetches from `/points/leaderboard` (replaces current `useVisionLeaderboard` on points page)

### Header `VisionBalanceBar`
- Points display reads from `usePoints` hook instead of `useVisionPoints`
- Shows combined total
- Disconnected users still see "0 pts"

### `useVisionLeaderboard` on points page
- Replace with new `usePointsLeaderboard` hook hitting `/points/leaderboard`
- The per-source `TopPlayers` component continues to use the existing oracle leaderboard endpoint (unchanged)

## Edge Cases

- **No ITPs exist**: Creator and Holder pools emit 0 points that hour (no one qualifies)
- **All ITPs negative**: Both Index pools emit 0 points (no one qualifies)
- **Single ITP positive**: Gets 100% of creator pool for that hour
- **Holder sells all shares**: Stops earning holder points immediately (next hourly snapshot)
- **ITP NAV at creation = 0**: Should not happen (ITP starts at $1), but guard with `nav_at_creation > 0` check
- **Data-node restart**: Points are in Postgres — no data loss. Cron picks up on next interval. Idempotency constraint prevents duplicates.
- **Tied performance**: Tiebreak by creation timestamp (older first), then itp_id

## Migration

1. Deploy schema changes (new tables + columns)
2. Modify `itp_collector.rs` to persist creator address + NAV to `itp_meta`
3. Populate `itp_meta` for existing ITPs using current NAV as baseline
4. Backfill `nav_at_fill` for existing fills (use current NAV — approximate but acceptable for testnet)
5. Deploy data-node with `vision_points.rs` + `index_points.rs` modules
6. Deploy frontend changes (swap hooks, update /points page)
7. Existing frontend-estimated Vision points are replaced — no migration needed, testnet reset is fine
