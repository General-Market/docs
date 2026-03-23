# Unified Points System Design

**Date**: 2026-03-12 (original), updated 2026-03-23
**Status**: Implemented

## Overview

Server-authoritative points system in the data-node. Three pools, 10,000 pts/day total, stored in Postgres with CSV backup every 4 hours.

## Point Pools

| Pool | Budget | Ranked by | Frequency | Who earns |
|---|---|---|---|---|
| **Vision** | 5,000 pts/day | Deposit share per settled round | On round settlement (~30s poll) | Round participants |
| **Index Creator** | 2,500 pts/day | Cumulative NAV % growth since ITP creation | Hourly | ITP creator address |
| **Index Holder** | 2,500 pts/day | Weighted avg NAV growth since buy | Hourly | Anyone holding ITP shares |

**Total system emission**: 10,000 pts/day.

## Vision Points (Round-Based)

### Model
Each Vision round is a discrete cycle: deposit → bet → settle → USDC back. No persistent balance. Points are awarded when a round settles.

### Computation
1. Data-node polls oracle every 30s for settled rounds (`/vision/rounds/active` + `/vision/batches`)
2. On new settlement: fetch `/vision/rounds/{id}/results` for player deposits
3. Estimate rounds/day from last hour's rate × 24
4. Per-round budget = `5000 / est_rounds_per_day`, clamped to [10, 500] pts
5. Player points = `round_budget × (player_deposit / total_deposited)`
6. Insert into `points_ledger` with `reason = 'vision:round:{batch_id}'`

### Key properties
- Deposit-proportional — bigger deposit = more points, accuracy irrelevant
- Budget adapts to round frequency — more rounds = smaller per-round allocation
- Idempotent — UNIQUE constraint on (player, pool, reason) prevents double-counting

## Index Creator Points

### Eligibility
- Creator address from `itp_meta` table (seeded from `ChainCache.itp_states`)
- Only ITPs with positive cumulative NAV growth qualify

### Performance metric
```
nav_growth_pct = (nav_current - nav_at_creation) / nav_at_creation
```

### Distribution
- Hourly at wall-clock hour boundaries (:00)
- Rank eligible ITPs by `nav_growth_pct` descending
- Weights: 0.7x exponential decay (rank 1 = 1.0, rank 2 = 0.7, rank 3 = 0.49, ...)
- `player_points = floor((weight / sum_all_weights) × (2500/24))`
- Rank 1 gets remainder from flooring

### Example (5 ITPs)

| Rank | Weight | Share | Points/hr |
|---|---|---|---|
| 1 | 1.000 | 36.1% | 37.6 |
| 2 | 0.700 | 25.2% | 26.3 |
| 3 | 0.490 | 17.7% | 18.4 |
| 4 | 0.343 | 12.4% | 12.9 |
| 5 | 0.240 | 8.7% | 9.0 |

## Index Holder Points

Same mechanism as Creator pool. Ranks holders by weighted portfolio performance:

```
For each ITP held:
  nav_growth_i = (nav_current_i - nav_at_creation_i) / nav_at_creation_i

Weighted portfolio performance:
  perf = Σ(shares_i × nav_growth_i × nav_at_creation_i) / Σ(shares_i × nav_at_creation_i)
```

Holder data comes from `user_shares` table (populated by chain pollers). NAV at creation from `itp_meta`.

## Database Schema

### `points_ledger` (append-only)
```sql
CREATE TABLE points_ledger (
    id          BIGSERIAL PRIMARY KEY,
    player      TEXT NOT NULL,
    pool        TEXT NOT NULL,       -- 'vision' | 'index_creator' | 'index_holder'
    points      NUMERIC NOT NULL,
    reason      TEXT NOT NULL,       -- 'vision:round:42' or 'index_creator:hourly:2026-03-23T14'
    rank        INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player, pool, reason)
);
```

### `points_totals` (materialized summary)
```sql
CREATE TABLE points_totals (
    player      TEXT NOT NULL,
    pool        TEXT NOT NULL,
    total       NUMERIC NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player, pool)
);
```

### `itp_meta`
```sql
CREATE TABLE itp_meta (
    itp_id          TEXT PRIMARY KEY,
    creator         TEXT NOT NULL,
    nav_at_creation NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## API Endpoints

`GET /points?user={address}`:
```json
{
  "vision": 12500.0,
  "indexCreator": 8400.0,
  "indexHolder": 3200.0,
  "total": 24100.0,
  "updatedAt": "2026-03-23T14:00:00Z"
}
```

`GET /points/leaderboard?limit=50&offset=0`:
```json
{
  "entries": [
    { "rank": 1, "player": "0x...", "vision": 5000, "indexCreator": 2400, "indexHolder": 1800, "total": 9200 }
  ],
  "updatedAt": "2026-03-23T14:00:00Z"
}
```

## CSV Backup

Every 4 hours + on startup, the points engine dumps:
- `backups/points/points_totals_{timestamp}.csv` — complete player balances
- `backups/points/points_ledger_{timestamp}.csv` — full audit trail

Auto-prunes to keep last 10 of each (40 hours of coverage). Recovery:
```sql
COPY points_totals(player, pool, total, updated_at) FROM '/path/to/points_totals.csv' WITH (FORMAT csv, HEADER true);
```

## Frontend

- `hooks/usePoints.ts` — fetches from `/api/dn/points?user=`
- `/points` page: hero with total, three pool cards with bar chart, unified leaderboard
- `VisionBalanceBar`: shows USDC balance + total points with link to /points

## Edge Cases

- **No rounds settle**: Vision pool emits 0 points that period
- **All ITPs negative**: Both Index pools emit 0 points
- **Data-node restart**: Postgres persists, CSV backup survives, idempotency prevents duplicates
- **Missed hours**: Not backfilled — acceptable for testnet
