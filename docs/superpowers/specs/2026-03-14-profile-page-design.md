# Profile Page — Design Spec

Public address profile at `/profile/[address]`. Two tabs: Vision (batch tick history) and Index (ITP portfolio). Viewable for any wallet.

## Route

- **Path**: `/[locale]/profile/[address]/page.tsx`
- **Public**: No wallet connection required to view
- **Linkable from**: leaderboard rows, batch player lists, anywhere an address appears
- Does NOT replace `/agent/[address]` — coexists for now, `/agent` may be deprecated later once profile is stable

## Header

Shared across both tabs. Shows address identity and tab-contextual stats.

### Identity Row
- **Avatar**: Generated from address (deterministic gradient or blockies)
- **Address**: Full address, truncated display (`0xABC...1234`)
- **Meta**: "Last active {relative time}" — derived from most recent on-chain event (Vision tick or ITP order)
- No "Joined" date in v1 — requires expensive cross-system scan for minimal value

### Stats Row — Tab-Contextual
Changes when switching tabs.

**Vision stats:**
| Stat | Source |
|------|--------|
| P&L | Sum of (balance - deposited) across all batches |
| ROI | P&L / total deposited * 100 |
| Win Rate | Profitable batches / total batches (matches leaderboard definition) |
| Volume | Total USDC deposited across all batches |
| Batches | Count of distinct batches joined |

**Index stats:**
| Stat | Source |
|------|--------|
| Portfolio Value | Sum of (shares * NAV) across all held ITPs |
| Holdings | Count of ITPs with non-zero balance |

Index tab shows only stats derivable from current on-chain state. No historical aggregates (total invested, total orders) in v1 — would require scanning all order events.

### Stats Data Sources
- Vision stats: New `/api/vision/player/{address}/profile` endpoint (see below)
- Vision stats are **cached for 60 seconds** server-side. Not real-time — prevents rapid polling from revealing per-tick changes.
- Index stats: On-chain multicall — iterate all ITP IDs, call `balanceOf(address)` per ITP

## Tabs

Two tabs below the header: **Vision** | **Index**

Tab selection via query param `?tab=vision|index` (default `vision`). Use `useSearchParams()` wrapped in `Suspense` boundary.

## Vision Tab

### 1. Cumulative P&L Chart

Line chart showing cumulative P&L over time across all batches.

- **Time range toggles**: 1D / 1W / 1M / ALL (button group, top-right)
- **Y axis**: Dollar P&L (positive green area fill, negative red area fill)
- **X axis**: Date labels
- **Current value**: Large mono text, top-right of chart
- **Chart library**: `recharts` (already used by `PerformanceGraphMini` — `LineChart`, `Line`, `ResponsiveContainer`)

**Data source**: The `pnlHistory` array from the profile endpoint. Built from hourly P&L snapshots (see Backend Changes).

### 2. Batch Tick History

List of all batches the address participated in. Each row:

```
[Batch Info]  [GitHub-style tick squares]  [ROI]
```

**Batch Info (left, 140px):**
- Batch name (e.g., "Crypto #4")
- Status badge: ACTIVE (green) or EXITED (gray)
- Sub-line: "{N} ticks · ${deposited} in"

**Tick Squares (center, flex):**
- GitHub contribution graph style: 11x11px squares, 2px gap, 2px border-radius
- 4 intensity levels for profit: `#dcfce7`, `#86efac`, `#22c55e`, `#15803d`
- 4 intensity levels for loss: `#fecaca`, `#f87171`, `#ef4444`, `#dc2626`
- Neutral (no activity): `#ebedf0`
- Intensity = magnitude of P&L on that tick (quartiles of the player's own P&L distribution for that batch)
- Order: oldest tick on left → newest on right
- Show the most recent 60 ticks. If fewer than 60, show all.
- Tooltip on hover: "Tick {N}: +$X.XX" or "Tick {N}: -$X.XX"

**ROI (right, 72px):**
- `(balance - deposited) / deposited * 100`
- Green if positive, red if negative
- Font: 14px mono bold

**Ordering:**
- Active batches first, then exited
- Within each group: sorted by most recent activity

**Legend (bottom):**
Loss [dark red → light red → neutral → light green → dark green] Profit

**Mobile**: Tick squares scroll horizontally within the row. Batch info stacks above the bar on screens < 640px.

### Empty State
If the address has no Vision activity: "This address has no Vision history yet."

## Backend Changes — Vision

### New table: `vision_player_tick_results`

Per-player per-tick balance deltas are not currently persisted. The tick resolver computes `PlayerBalance { player, old_balance, new_balance, delta }` in memory, but discards the breakdown.

**New table:**
```sql
CREATE TABLE vision_player_tick_results (
  batch_id    INTEGER NOT NULL,
  tick_id     INTEGER NOT NULL,
  player      TEXT NOT NULL,
  delta       TEXT NOT NULL,           -- wei string, effective delta (new_balance - old_balance, post-clamping)
  won         BOOLEAN NOT NULL,        -- balance increased on this tick
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, tick_id, player)
);
CREATE INDEX idx_vptr_player ON vision_player_tick_results(player);
CREATE INDEX idx_vptr_player_resolved ON vision_player_tick_results(player, resolved_at);
CREATE INDEX idx_vptr_player_batch_tick ON vision_player_tick_results(player, batch_id, tick_id DESC);
```

The composite index `(player, batch_id, tick_id DESC)` is critical for the CTE query that fetches the most recent 60 ticks per batch — it enables Postgres to do an index-only scan with efficient per-partition ordering instead of scanning all rows and sorting.

**`delta` computation**: Use the effective (post-clamping) delta. **Do NOT use `pb.delta`** — that is the raw pre-clamping value. Compute explicitly:
```rust
let effective_delta = pb.new_balance.as_u128() as i128 - pb.old_balance.as_u128() as i128;
// Store as string for Postgres numeric: effective_delta.to_string()
```
This ensures the stored value matches reality when balance clamps to zero via `saturating_sub`.

**`won` computation**: `effective_delta > 0`.

**Where to persist**: In `engine.rs`, within the `apply_tick_balances_with_db()` function. **This function must be refactored to use an explicit Postgres transaction** (`pool.begin()` / `tx.commit()`). Currently it executes individual UPDATE queries in a loop with no transaction wrapper. The INSERT into `vision_player_tick_results` and the UPDATE to `vision_positions` MUST be in the same transaction. The in-memory balance update (`apply_tick_balances`) should only run after the transaction commits successfully. **Launch gate: profile page MUST NOT ship until this refactor is deployed.** Without it, crash recovery produces inconsistent DB state that the profile page would surface as authoritative.

All balance/delta bindings MUST use `to_string()` + `::numeric` casting. Never `as_u128() as i64`.

### P&L History — Hourly Snapshots

The P&L chart needs timestamped data points. Rather than computing cross-batch snapshots during tick resolution (which suffers from concurrent batch resolution staleness), use **hourly snapshots computed lazily at query time**.

**Approach**: No new column needed. At query time, the profile endpoint:
1. Fetches all `vision_player_tick_results` for the player, ordered by `resolved_at`
2. Groups into hourly buckets
3. Within each bucket, sums the deltas to get the net change for that hour
4. Computes running cumulative sum across buckets

This avoids the concurrent-snapshot problem entirely — no write-time aggregation across batches. The query is bounded by `LIMIT 5000` on raw rows (see implementation below), and the hourly bucketing further reduces output size.

### Preserving Deposit Data for Exited Batches

`vision_positions` rows are DELETED when a player withdraws. This destroys `total_deposited` for that batch — making ROI and Volume uncomputable for any player who has exited a batch.

**Solution**: Add a `vision_player_batch_summary` table, written once when a player exits a batch (before the `vision_positions` row is deleted):

```sql
CREATE TABLE vision_player_batch_summary (
  batch_id        INTEGER NOT NULL,
  player          TEXT NOT NULL,
  total_deposited TEXT NOT NULL,    -- wei string
  final_balance   TEXT NOT NULL,    -- wei string
  total_ticks     INTEGER NOT NULL,
  exited_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, player)
);
CREATE INDEX idx_vpbs_player ON vision_player_batch_summary(player);
```

**Where to persist**: In `chain_listener.rs`, when processing a withdrawal event (before deleting the `vision_positions` row), INSERT the summary. This captures `total_deposited` and `final_balance` for posterity.

**Profile stats computation**: `totalDeposited = SUM from vision_positions (active) + SUM from vision_player_batch_summary (exited)`. Same for `totalBatches`, `winRate`.

### New API endpoint: `GET /api/vision/player/{address}/profile`

**Address validation**: The `address` parameter MUST be validated as a valid Ethereum address (regex: `^0x[0-9a-fA-F]{40}$`) before any database query. Reject with 400 otherwise. All queries use parameterized bindings (`$1`), never `format!()`.

**Rate limiting**: 10 requests/minute per IP, enforced at the Axum layer (tower-governor).

**Response caching**: Results are cached in-memory (HashMap) for 60 seconds per address. Prevents rapid polling from revealing per-tick state changes.

**Dedicated read pool**: Use a separate `PgPool` (2 connections) for profile queries. The tick resolution write path MUST NOT share connections with profile reads.

Returns:
```json
{
  "stats": {
    "totalPnl": "1247800000000000000000",
    "totalDeposited": "5130000000000000000000",
    "roi": 24.3,
    "winRate": 62.1,
    "totalBatches": 47,
    "lastActiveAt": "2026-03-14T10:00:00Z"
  },
  "batches": [
    {
      "batchId": 4,
      "sourceName": "Crypto",
      "status": "active",
      "deposited": "200000000000000000000",
      "balance": "245800000000000000000",
      "tickCount": 142,
      "roi": 22.9,
      "ticks": [
        { "tickId": 141, "delta": "1200000000000000000", "won": true },
        { "tickId": 142, "delta": "-800000000000000000", "won": false }
      ]
    }
  ],
  "pnlHistory": [
    { "timestamp": "2026-02-01T00:00:00Z", "cumulativePnl": "0" },
    { "timestamp": "2026-02-01T01:00:00Z", "cumulativePnl": "1200000000000000000" }
  ]
}
```

**Implementation (3 queries total, no N+1):**
- `stats`: Two sources combined:
  - **Active batches**: `SELECT batch_id, balance::numeric, total_deposited::numeric FROM vision_positions WHERE player = $1` (rows exist only for active positions)
  - **All batches (active + exited)**: `SELECT batch_id, SUM(CASE WHEN won THEN 1 ELSE 0 END) as wins, COUNT(*) as ticks FROM vision_player_tick_results WHERE player = $1 GROUP BY batch_id` — gives total batches, total ticks, wins per batch
  - **P&L from tick results**: `SELECT SUM(delta::numeric) FROM vision_player_tick_results WHERE player = $1` — total P&L including exited batches
  - NOTE: `vision_positions` rows are DELETED on withdrawal. Stats MUST NOT rely solely on `vision_positions` — use `vision_player_tick_results` for historical aggregates (total batches, total P&L, win rate). `vision_positions` is only for current active batch data.
- `batches + ticks`: Single query with window function + SQL-level cap:
  ```sql
  WITH ranked AS (
    SELECT vptr.batch_id, vptr.tick_id, vptr.delta, vptr.won,
           ROW_NUMBER() OVER (PARTITION BY vptr.batch_id ORDER BY vptr.tick_id DESC) as rn
    FROM vision_player_tick_results vptr
    WHERE vptr.player = $1
  )
  SELECT batch_id, tick_id, delta, won FROM ranked WHERE rn <= 60
  ```
  Hard cap in SQL — only the most recent 60 ticks per batch leave Postgres. Join with batch metadata (source name, status) from in-memory `TickScheduler` state.
- `pnlHistory`:
  ```sql
  SELECT resolved_at, delta
  FROM vision_player_tick_results
  WHERE player = $1
  ORDER BY resolved_at
  LIMIT 5000
  ```
  Bucket into hourly intervals and compute running cumulative sum application-side. Hard cap of 5000 rows from Postgres. Downsample to ~200 chart points.
- `lastActiveAt`: `MAX(resolved_at)` from the ticks query (no additional query needed).

### Pre-existing Issue: i64 Truncation in Balance/Deposit Bindings

Two locations cast 18-decimal wei values through `i64`, silently overflowing above ~9.2 USDC:

1. **`apply_tick_balances_with_db`** (`tick_scheduler.rs`): `pb.new_balance.as_u128() as i64` — corrupts balance writes
2. **`DepositRow.total_deposited`** (`api.rs:1054`): `Option<i64>` — corrupts leaderboard deposit reads

The correct pattern is `to_string()` + `::numeric` for writes, and `String` (parsed via `U256::from_dec_str`) for reads. `chain_listener.rs` already does this correctly. **Launch gate: both must be fixed before profile ships.** The profile page surfaces these values as authoritative P&L — corrupted inputs produce corrupted profiles.

### Pre-existing Issue: Reveal Endpoint Bitmap Truncation

The `/vision/reveal/:batch_id/:tick_id` endpoint returns the full multi-tick bitmap blob, exposing predictions for future unresolved ticks. This MUST be fixed before or alongside the profile page launch: return only the bits for the requested tick slice, not the full blob. **Launch gate: profile page MUST NOT ship until reveal endpoint truncation is deployed.**

### Pre-existing Issue: format!() SQL in Leaderboard

The existing leaderboard endpoint (`api.rs:970-978`) uses `format!()` for SQL instead of parameterized `$1`. While not exploitable (`u64` type prevents injection), this pattern must not propagate. Fix the leaderboard query to use parameterized binding as part of this work.

## Index Tab

Reuses existing Index page components scoped to the viewed address.

### Holdings Table
- Enumerate all ITP IDs (from deployed-assets.json or contract `getITPCount()`)
- Multicall `balanceOf(address)` for each ITP ID
- Filter to non-zero balances
- Show: ITP name, shares, current NAV, value (shares * NAV), % of portfolio
- NAV from existing `useItpNav` hook (reads `_itpInventory` + price feeds)

### Portfolio Value Chart
Deferred to v2. No historical portfolio value data exists for arbitrary addresses — would require snapshotting NAV * shares daily. In v1, show only the holdings table.

### Order History
Deferred to v2. Fetching order events for arbitrary addresses requires scanning contract logs across all blocks — expensive and not currently indexed. The existing SSE system (`useSSE`) only serves connected wallet orders.

In v1, the Index tab shows: **Holdings table only** (current state, fully derivable from on-chain reads).

### Empty State
If the address holds no ITPs: "This address has no ITP holdings."

## Component Architecture

```
ProfilePage (page.tsx)
├── ProfileHeader
│   ├── ProfileIdentity (avatar, address, meta)
│   └── ProfileStats (tab-contextual stats row)
├── ProfileTabs (Vision | Index)
├── VisionTab
│   ├── PnlChart (cumulative P&L line chart, recharts)
│   └── BatchTickHistory
│       └── BatchTickRow[] (info + tick squares + ROI)
└── IndexTab
    └── HoldingsTable (ITP list with shares/NAV/value/%)
```

## New Files

| File | Purpose |
|------|---------|
| `frontend/app/[locale]/profile/[address]/page.tsx` | Route page |
| `frontend/components/domain/profile/ProfileHeader.tsx` | Identity + stats |
| `frontend/components/domain/profile/ProfileTabs.tsx` | Tab switcher |
| `frontend/components/domain/profile/VisionTab.tsx` | Vision tab content |
| `frontend/components/domain/profile/IndexTab.tsx` | Index tab content |
| `frontend/components/domain/profile/PnlChart.tsx` | Cumulative P&L chart |
| `frontend/components/domain/profile/BatchTickHistory.tsx` | Batch list with tick bars |
| `frontend/components/domain/profile/BatchTickRow.tsx` | Single batch row |
| `frontend/components/domain/profile/TickSquares.tsx` | GitHub-style tick visualization |
| `frontend/hooks/usePlayerProfile.ts` | Fetch player history from API |
| `oracle/migrations/NNN_create_player_tick_results.sql` | New table migration |
| `oracle/migrations/NNN_create_player_batch_summary.sql` | Exited batch deposit preservation |

## Styling

Follows existing design system:
- `text-color-up` / `text-color-down` for P&L
- `font-mono tabular-nums` for numbers
- `border-border-light` for dividers
- `bg-surface` for hover/header backgrounds
- `text-text-muted` for secondary text
- Section headers: 10px uppercase tracking 0.08em
- Same `max-w-site mx-auto px-6 lg:px-12` layout wrapper

## Security Summary

| Threat | Mitigation |
|--------|------------|
| Postgres pool exhaustion (3 connections) | Dedicated read pool (2 conn) for profile; tick resolution pool untouched |
| N+1 query pattern | Single query with window function for all batches + ticks |
| Unbounded pnlHistory scan | LIMIT 5000 in SQL, hourly bucketing, downsample to ~200 points |
| SQL injection via address param | Regex validation + parameterized $1 bindings, never format!() |
| Rate limiting | 10 req/min per IP on profile endpoint |
| Rapid polling reveals per-tick changes | 60-second response cache per address |
| Race condition between tick write and profile read | Single Postgres transaction for position update + tick result insert |
| Concurrent cross-batch snapshot staleness | No write-time snapshots; P&L computed lazily at query time from deltas |
| apply_tick_balances_with_db lacks transaction | Refactor to use pool.begin()/tx.commit(); in-memory update only after commit |
| Reveal endpoint leaks future bitmaps | Launch gate: must fix before profile ships |
| format!() SQL in leaderboard | Fix to parameterized binding during this work |
| Balance truncation (u128→i64) in tick_scheduler + leaderboard | Launch gate: fix both to `to_string()` + `::numeric` / `String` |
| Stats wrong for exited players (vision_positions DELETEs rows) | New `vision_player_batch_summary` table preserves deposit data at withdrawal |
| Batches+ticks query unbounded | CTE with `WHERE rn <= 60` in SQL + composite index |
| pb.delta vs effective delta confusion | Explicit code: `pb.new_balance - pb.old_balance`, never `pb.delta` |
| CTE performance on large player histories | Composite index `(player, batch_id, tick_id DESC)` for index-only scan |

## Not In Scope

- Social features (follow, share)
- ENS resolution
- Custom avatars / display names
- Performance by source breakdown (can add later)
- Comparison between addresses
- Index tab order history (v2 — needs event indexing)
- Index tab portfolio value chart (v2 — needs historical snapshots)
- "Joined" date (v2 — expensive cross-system scan)

## Launch Gates

Profile page MUST NOT ship until all of these are deployed:

1. **Reveal endpoint bitmap truncation** — return only the bits for the requested tick slice, not the full blob
2. **Transaction refactor in `apply_tick_balances_with_db`** — `pool.begin()`/`tx.commit()`, in-memory update only after commit
3. **i64 truncation fixes** — `tick_scheduler.rs` balance writes + `DepositRow` leaderboard reads → `to_string()` + `String`
4. **Leaderboard `format!()` SQL** — fix to parameterized `$1` binding
