-- Precomputed per-account portfolio PnL curve, bucketed to match the
-- chart's range/bucket grid:
--   1d  → 300s   buckets (~288 points/day)
--   1w  → 2100s  buckets (~288 points/week)
--   1m  → 10800s buckets (~240 points/month)
--   all → 21600s buckets (capped)
-- One row per (account, bucket_secs, bucket_ts). The chart endpoint reads
-- this table directly — no on-the-fly bucketing, no client-side merge.
--
-- Independence: this is the source of truth for the account curve. It is
-- *built from* vault_snapshots and account_vault_positions, but pruning
-- either upstream table does not erase the materialized curves.

CREATE TABLE IF NOT EXISTS account_pnl_curve (
    account              BYTEA           NOT NULL,
    bucket_secs          INTEGER         NOT NULL,
    bucket_ts            TIMESTAMPTZ     NOT NULL,
    portfolio_value      NUMERIC(38, 18) NOT NULL,   -- Σ shares × NAV (USDC, 18-dec)
    cost_basis           NUMERIC(38, 18) NOT NULL,   -- Σ cost basis at bucket
    pnl                  NUMERIC(38, 18) NOT NULL,   -- portfolio_value - cost_basis
    realized_pnl         NUMERIC(38, 18) NOT NULL DEFAULT 0,
    contributing_vaults  INTEGER         NOT NULL,
    computed_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account, bucket_secs, bucket_ts)
);

-- The single hot read pattern: "give me the last N points of bucket size B
-- for account A". Index already implied by PK ordering, but state it
-- explicitly so the planner picks it for range scans.
CREATE INDEX IF NOT EXISTS idx_apc_account_bucket_ts
    ON account_pnl_curve (account, bucket_secs, bucket_ts DESC);

-- Writer cursor: where each (account, bucket_secs) was last materialized.
-- Lets the precompute job resume mid-account on restart and skip
-- (account, bucket_secs) pairs that are already current.
CREATE TABLE IF NOT EXISTS account_pnl_curve_cursors (
    account      BYTEA       NOT NULL,
    bucket_secs  INTEGER     NOT NULL,
    last_bucket  TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account, bucket_secs)
);
