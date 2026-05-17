-- Protocol-wide AUM snapshots. Written every N minutes by tvl_collector.
-- Sum of (totalSupply × NAV) across all ITPs, denominated in USD with 6
-- decimals of fixed-point precision (USDC-style). itp_count is the number
-- of ITPs the snapshot integrated; supply_count is the number whose total
-- supply was > 0 at sample time.

CREATE TABLE IF NOT EXISTS tvl_history (
    id            BIGSERIAL    PRIMARY KEY,
    snapshot_ts   TIMESTAMPTZ  NOT NULL UNIQUE,
    total_aum_usd NUMERIC(38, 6) NOT NULL,
    itp_count     INTEGER      NOT NULL,
    supply_count  INTEGER      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tvl_history_ts
    ON tvl_history (snapshot_ts DESC);
