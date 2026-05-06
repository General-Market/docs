# Account PnL Curve — Precompute Service

Date: 2026-05-06
Owner: max
Status: PLAN

## Why this exists

The profile page already paints a per-user PnL curve by:

1. fetching every held vault's NAV history from `oracle:/vision/vault/:addr/history`,
2. multiplying current on-chain shares by `(NAV − 1)` per timestamp,
3. summing the per-vault curves into a portfolio curve in the browser.

Two structural failures.

- **Wrong cost basis.** `useVaultsPortfolioHistory` admits it: "current shares as constant — exact cost basis would require per-user deposit/withdraw events". A user who deposited yesterday but reads NAV all the way back to vault inception sees fictional PnL.
- **Fragile persistence.** The series rests on `vault_snapshots`, written by the Python `fund_manager` every ~4.5 min. Migration `019` plans a 90-day prune. If snapshots are pruned, deleted, lost in an OOM, the historical curve disappears with them. There is nothing downstream that holds the truth independently.
- **Unscalable read path.** N vaults × M users = N parallel HTTP requests per profile load, then a merge in JS. Works at 5 vaults per user. Implodes at 50.

The fix is a separate, durable, per-account PnL series — written from the same data we already have, but stored as the source of truth for the account curve, never recomputed at read time.

## Data flow today

```
fund_manager.py  ──INSERT──►  vault_snapshots (oracle pg)
   every cycle                vault_address, total_assets, total_supply,
                              nav_per_share, tvl_usd, created_at

frontend (per profile load)
   ├─ /api/dn/sse  →  data-node  →  on-chain balanceOf(user) per vault
   └─ N × /api/vision/vault/:addr/history → oracle reads vault_snapshots
        client merges per-timestamp, multiplies by current shares
```

Per-user share history exists nowhere. Cost basis exists nowhere.

## Plan

### 1. Data model

Two new tables in oracle pg. Keep `vault_snapshots` as upstream input — these tables are the durable account-level views.

```sql
-- 020_create_account_vault_positions.sql
-- Per-block share state, written from VisionVault Deposit/Withdraw events.
-- One row per (account, vault, share-changing event). Derive shares-at-time(t)
-- by reading the most recent row with block_time <= t. This is the cost-basis
-- ledger that today's "current shares" hook fakes with constants.
CREATE TABLE account_vault_positions (
    id              BIGSERIAL PRIMARY KEY,
    account         BYTEA       NOT NULL,            -- 20-byte address, lowercased
    vault_address   BYTEA       NOT NULL,
    block_number    BIGINT      NOT NULL,
    block_time      TIMESTAMPTZ NOT NULL,
    log_index       INTEGER     NOT NULL,
    shares_after    NUMERIC(78,0) NOT NULL,          -- absolute, not delta
    cost_basis_after NUMERIC(78,0) NOT NULL,         -- USDC wei (18-dec on L3)
    event_kind      SMALLINT    NOT NULL,            -- 0=deposit 1=withdraw 2=claim 3=transfer-in 4=transfer-out
    tx_hash         BYTEA       NOT NULL,
    UNIQUE (account, vault_address, block_number, log_index)
);
CREATE INDEX idx_avp_account_time ON account_vault_positions (account, block_time DESC);
CREATE INDEX idx_avp_vault_time   ON account_vault_positions (vault_address, block_time DESC);
```

```sql
-- 021_create_account_pnl_curve.sql
-- Precomputed PnL curve per account. Bucket-aligned to the same boundaries
-- the chart uses (5min / 35min / 3h / 6h). One row per (account, bucket_ts).
-- Written by the precompute job; read once per profile load.
CREATE TABLE account_pnl_curve (
    account         BYTEA       NOT NULL,
    bucket_ts       TIMESTAMPTZ NOT NULL,
    bucket_secs     INTEGER     NOT NULL,            -- 300 / 2100 / 10800 / 21600
    portfolio_value NUMERIC(38,18) NOT NULL,         -- shares × NAV per vault, summed
    cost_basis      NUMERIC(38,18) NOT NULL,         -- sum of cost_basis_after at bucket
    pnl             NUMERIC(38,18) NOT NULL,         -- portfolio_value - cost_basis
    realized_pnl    NUMERIC(38,18) NOT NULL,         -- closed positions, monotonic
    contributing_vaults INTEGER NOT NULL,
    -- Bookkeeping
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account, bucket_secs, bucket_ts)
);
CREATE INDEX idx_apc_account_bucket ON account_pnl_curve (account, bucket_secs, bucket_ts DESC);
```

Why two tables, not one. Position events are sparse (one per deposit/withdraw, dozens per user per year). Curve buckets are dense (every 5 min, even when nothing happens). Different write rates, different retention, different read patterns. Conflating them costs us nothing today and a rebuild later.

### 2. Ingestion

Two writers feed `account_vault_positions`. Both already have the data; neither persists it today.

- **Live**: data-node's `chain_event_scanner` already subscribes to L3 logs. Add a `VisionVault::Deposit / Withdraw / Transfer` handler that writes one row per event. Cost basis updates: deposit adds `assets`, withdraw subtracts `shares × NAV_at_block`, transfer moves cost basis proportionally (out: subtract `shares_out / shares_total × cost_basis`; in: add the matching amount, or fall back to `shares_in × NAV` for non-account-to-account transfers).
- **Backfill**: a one-shot job that scans VisionVault logs from each vault's deployment block forward, replays the event stream, writes `account_vault_positions`. Same handler as the live path, just batched.

The ledger is append-only. No upserts. If we replay a block we hit the unique constraint `(account, vault, block_number, log_index)` and skip. Reorgs on L3 are a non-issue (single sequencer); even so, the unique key lets us delete-then-replay a block range without corruption.

### 3. Computation

A scheduled job — `account_pnl_curve_writer` — runs in oracle. Cadence: every 60s for the live tail, plus a nightly catch-up sweep.

For each `(account, vault)` with at least one position event:

```
shares_at(t) = SELECT shares_after FROM account_vault_positions
               WHERE account=$1 AND vault=$2 AND block_time <= t
               ORDER BY block_time DESC LIMIT 1

nav_at(t)    = SELECT nav_per_share FROM vault_snapshots
               WHERE vault_address=$2 AND created_at <= t
               ORDER BY created_at DESC LIMIT 1

value_at(t)  = shares_at(t) × nav_at(t) / 1e18
cost_at(t)   = SELECT cost_basis_after FROM account_vault_positions
               WHERE account=$1 AND vault=$2 AND block_time <= t
               ORDER BY block_time DESC LIMIT 1

pnl_at(t)    = sum_v(value_at(t)) − sum_v(cost_at(t))
```

The job materializes one row per `(account, bucket_secs, bucket_ts)` tuple. Bucket grids match `vault_history`'s ranges so the read path is a straight index lookup, not a re-bucket on the fly.

This *requires* `vault_snapshots` to compute, but the **output is independent**. Once `account_pnl_curve` rows exist, you can drop `vault_snapshots` and the curve survives. That's the resilience the request asked for.

### 4. Read path — `/vision/account/:address/pnl-history`

```
GET /vision/account/0xABC.../pnl-history?range=1d|1w|1m|all
→ {
    range: "1w",
    bucket_secs: 2100,
    points: [{ ts, value, cost, pnl }, ...],
    realized_pnl: number,
    cost_basis: number,
    last_updated: ISO8601
  }
```

- One indexed read on `(account, bucket_secs, bucket_ts >= window_start)`.
- Bounded result size by construction (`range` × `bucket_secs` ≤ 500 points).
- Cache headers: `Cache-Control: public, s-maxage=30, stale-while-revalidate=30`.
- 502 → empty `points`. Existing frontend already tolerates that.

The frontend stops fanning out N requests per profile. `useVaultsPortfolioHistory` is replaced by `useAccountPnlHistory` — one fetch, no merge, no cost-basis fiction.

### 5. Backfill & migration

Strict ordering:

1. Ship migrations 020 + 021 to oracle pg.
2. Backfill `account_vault_positions` from each vault's deployment block. Idempotent. Estimate: ~50k events across 324 vaults × <1k holders, sub-minute on a warm db.
3. Run the precompute job in catch-up mode — produce buckets back to the earliest position event per account. This is the moment the curves first exist.
4. Wire the new endpoint and the new hook in parallel; ship both behind a feature flag.
5. Flip the flag. Old hook becomes dead code. Remove it.

No backwards-compatible reading old data. The honest curve replaces the charitable estimate.

### 6. Retention

- `account_vault_positions`: retain forever. It's the ledger; pruning it loses the cost basis and the curve cannot be rebuilt.
- `account_pnl_curve`: retain by bucket_secs.
  - 300s buckets: 7 days
  - 2100s buckets: 30 days
  - 10800s buckets: 1 year
  - 21600s buckets: forever
- `vault_snapshots`: stays at 90 days as planned. Once the curve is materialized, snapshots are only needed to extend the curve forward.

### 7. Scalability — where this breaks if we don't think about it

- **Write fanout.** 324 vaults × ~1k holders = ~324k cells per bucket grid, but only ~5–20% of `(account, vault)` pairs actually have shares. The job iterates active accounts, not the cartesian. Materialize once per bucket boundary, batch insert with `ON CONFLICT DO UPDATE` so reruns are idempotent.
- **Hot accounts.** Whales touching deposits hourly produce many position events but the curve still only has one row per bucket. The ledger can grow long; the curve cannot.
- **Cold accounts.** Most accounts move once and sit. Detect "no position events in this window" and copy-forward the prior bucket's row (`shares_after` unchanged, only NAV moves). Cheap.
- **Skew on vault count.** If a single account holds 200 vaults, the per-bucket join is the dominant cost. Compute per-(account,vault) value and cost into a CTE, sum once. SQL handles this. No need for per-account compute services until the count is wrong by an order of magnitude.
- **Failure isolation.** The writer is a single pg-bound service; it can be interrupted and resumed at the last bucket. The query layer reads only `account_pnl_curve`, so writer downtime degrades freshness, not availability.
- **Sharding lever (later).** When the curve table exceeds ~50M rows, partition by `bucket_secs`. The bucket_secs column is already a query predicate, so the planner gets per-partition pruning for free. We don't need this in the first six months.

## Out of scope

- Vision (parimutuel) PnL. That's tracked elsewhere (`profile.stats.pnl`, settlement events). The vault curve and the vision curve remain separate hero metrics. A unified "everything you've made on General" curve is a follow-on plan after both halves are stable.
- Cross-chain accounting. Vaults are L3-only. If we ever ship vaults on Settlement or Sonic, this schema needs a `chain_id` column.
- Realized PnL detail (per-trade attribution). The schema reserves `realized_pnl`. The first version increments it on withdrawal events; full attribution comes later.

## Acceptance

- Loading a profile fires one HTTP request for the curve, not N.
- Drop `vault_snapshots` → curve still renders.
- Backfill produces non-zero curves for accounts with vault history before the rollout.
- Hero PnL on the vaults tab matches the last point of the curve to within rounding.
- Curve point count is bounded ≤ 500 per range.

## Open questions

- Cost basis on transfer between two on-chain accounts: do we treat the receiver's basis as `shares × NAV_at_block`, or carry the sender's pro-rata basis? The latter is honest; the former is what vault_actions on-chain code can prove without extra state. I lean honest. Decision before backfill.
- 1-bucket lag is acceptable on read. Real-time tail (last 60s) is best served by client-side extrapolation (last bucket + current shares × current NAV). Keep that hybrid; don't push the writer into sub-minute.
