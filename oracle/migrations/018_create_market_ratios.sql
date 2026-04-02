-- Per-market parimutuel ratios captured at settlement time.
-- Stores the UP/DOWN stake split for each submarket in each settled batch.
CREATE TABLE IF NOT EXISTS vision_market_ratios (
    batch_id    BIGINT NOT NULL,
    asset_id    TEXT NOT NULL,
    up_stake    TEXT NOT NULL DEFAULT '0',
    down_stake  TEXT NOT NULL DEFAULT '0',
    outcome     TEXT NOT NULL,
    pct_change_bps BIGINT NOT NULL DEFAULT 0,
    settled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_market_ratios_batch
    ON vision_market_ratios(batch_id);

-- Source lookup: join with vision_batch_lifecycle to query ratios by source.
-- Separate index not needed — the PK covers batch_id lookups, and source
-- queries go through the lifecycle table join.
