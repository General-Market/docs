# Unified Points System Design

**Date**: 2026-03-12
**Status**: Draft

## Overview

Migrate Vision points from frontend-only estimation to server-authoritative data-node computation, and add two new Index (ITP) point pools. All three pools write to a shared ledger on the data-node, with a single API serving totals and leaderboard.

## Point Pools

| Pool | Budget | Ranked by | Frequency | Who earns |
|---|---|---|---|---|
| **Vision** | 48,000 pts/hr | TVL share per batch | Every tick (~10 min) | Batch participants |
| **Index Creator** | 24,000 pts/hr | Cumulative NAV % growth since ITP creation | Hourly | ITP creator address |
| **Index Holder** | 24,000 pts/hr | Weighted avg NAV growth since buy | Hourly | Anyone holding ITP shares |

**Total system emission**: ~120,000 pts/hr.

## Vision Points (Migration)

### Current state
- Computed in `frontend/hooks/vision/useVisionPoints.ts`
- Formula: `100 pts/tick/batch × (myBalance / batchTVL)`
- Recalculated on page load — not persisted, not verifiable

### New state
- On each tick resolution in the data-node (`tick_scheduler`), compute each player's share of the 100 pts for that batch
- Write point awards to `points_ledger` table
- Formula unchanged: `points = 100 × (player_balance / batch_tvl)` per tick per batch
- Players with 0 balance get 0 points

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
- For existing ITPs at migration time, use earliest available NAV snapshot (or current NAV as fallback — they start earning from migration onward)

### Distribution
- Hourly: rank all eligible ITPs by `nav_growth_pct` descending
- Assign weights with 0.7x exponential decay:
  - Rank 1: weight = `0.7^0 = 1.0`
  - Rank 2: weight = `0.7^1 = 0.7`
  - Rank 3: weight = `0.7^2 = 0.49`
  - Rank N: weight = `0.7^(N-1)`
- Normalize: `player_points = (weight / sum_of_all_weights) × 24,000`
- Write to `points_ledger`

### Example (5 ITPs, all positive growth)

| Rank | Weight | Normalized | Points |
|---|---|---|---|
| 1 | 1.000 | 35.8% | 8,592 |
| 2 | 0.700 | 25.1% | 6,014 |
| 3 | 0.490 | 17.6% | 4,210 |
| 4 | 0.343 | 12.3% | 2,947 |
| 5 | 0.240 | 8.6% | 2,063 |
| **Total** | **2.773** | **100%** | **23,826** |

Remainder (174 pts) from rounding goes to rank 1.

## Index Holder Points

### Eligibility
- Any address holding ITP shares (from `getUserShares(itpId, user)`)
- Only holders with positive weighted portfolio performance qualify

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

### Distribution
- Same 0.7x decay curve as Creator pool
- Rank all eligible holders by `perf` descending
- `player_points = (weight / sum_of_all_weights) × 24,000`
- Write to `points_ledger`

## Database Schema

### `points_ledger` (new table, append-only)
```sql
CREATE TABLE points_ledger (
    id          BIGSERIAL PRIMARY KEY,
    player      TEXT NOT NULL,          -- 0x address
    pool        TEXT NOT NULL,          -- 'vision' | 'index_creator' | 'index_holder'
    points      DOUBLE PRECISION NOT NULL,
    reason      TEXT,                   -- e.g. 'batch:42:tick:1205' or 'hourly:2026-03-12T14'
    rank        INTEGER,               -- NULL for vision (share-based, not ranked)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_points_player ON points_ledger(player);
CREATE INDEX idx_points_pool ON points_ledger(pool);
CREATE INDEX idx_points_created ON points_ledger(created_at);
```

### `itp_meta` (new table)
```sql
CREATE TABLE itp_meta (
    itp_id          TEXT PRIMARY KEY,   -- bytes32 hex
    creator         TEXT NOT NULL,      -- 0x address
    nav_at_creation DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Additions to existing tables
- `fills` / trades table: add `nav_at_fill DOUBLE PRECISION` column for holder NAV-at-buy tracking

## Data-Node Implementation

### Vision points on tick resolution
- In `tick_scheduler.rs`, after resolving a tick for a batch:
  1. Read all player balances and batch TVL
  2. Compute `points_i = 100 × (balance_i / tvl)`
  3. Batch-insert into `points_ledger` with pool='vision'

### Index points hourly cron
- New module `points_cron.rs` running every hour:
  1. **Creator pool**: fetch all ITPs, current NAVs, `itp_meta.nav_at_creation`, compute rankings, distribute 24K
  2. **Holder pool**: fetch all holders + shares, compute weighted NAV growth per holder, rank, distribute 24K
  3. Batch-insert into `points_ledger`

### New API endpoints
- `GET /points?user={address}` — returns:
  ```json
  {
    "vision": 12500.0,
    "index_creator": 8400.0,
    "index_holder": 3200.0,
    "total": 24100.0,
    "updated_at": "2026-03-12T14:00:00Z"
  }
  ```
  Computed as `SELECT pool, SUM(points) FROM points_ledger WHERE player = $1 GROUP BY pool`

- `GET /points/leaderboard` — returns top players by total points across all pools

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
- Leaderboard: combined points from all pools

### Header `VisionBalanceBar`
- Points display reads from `usePoints` hook instead of `useVisionPoints`
- Shows combined total
- Disconnected users still see "0 pts"

## Edge Cases

- **No ITPs exist**: Creator and Holder pools emit 0 points that hour (no one qualifies)
- **All ITPs negative**: Both Index pools emit 0 points (no one qualifies)
- **Single ITP positive**: Gets 100% of creator pool for that hour
- **Holder sells all shares**: Stops earning holder points immediately (next hourly snapshot)
- **ITP NAV at creation = 0**: Should not happen (ITP starts at $1), but guard with `nav_at_creation > 0` check
- **Data-node restart**: Points are in Postgres — no data loss. Cron picks up on next interval.

## Migration

1. Deploy schema changes (new tables + column)
2. Populate `itp_meta` for existing ITPs using current NAV as baseline
3. Backfill `nav_at_fill` for existing fills (use current NAV — approximate but acceptable for testnet)
4. Deploy data-node with tick-based Vision points + hourly Index cron
5. Deploy frontend changes (swap hooks, update /points page)
6. Existing frontend-estimated Vision points are replaced — no migration needed, testnet reset is fine
