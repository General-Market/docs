-- Periodic snapshots of vault TVL and NAV for historical charts.
-- The oracle writes one row per vault per reconciliation cycle.

CREATE TABLE IF NOT EXISTS vault_snapshots (
    id BIGSERIAL PRIMARY KEY,
    vault_address TEXT NOT NULL,
    total_assets TEXT NOT NULL,       -- uint256 as string (18 dec)
    total_supply TEXT NOT NULL,       -- uint256 as string (18 dec)
    nav_per_share DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    tvl_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_snapshots_address_time
    ON vault_snapshots (vault_address, created_at DESC);

-- Keep 90 days of data, prune older rows via pg_cron or app-level cleanup
