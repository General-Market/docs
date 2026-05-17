-- Protocol-wide AUM snapshots. Written every N minutes by tvl_collector.
-- Sum of totalSupply times NAV across all ITPs, USD with 6 decimals of
-- fixed-point precision. itp_count is the snapshot population. supply_count
-- is the subset whose total supply was greater than zero at sample time.
-- (Do not write semicolons inside comments. The migration runner splits
-- statements on the raw character.)

CREATE TABLE IF NOT EXISTS tvl_history (
    id            BIGSERIAL    PRIMARY KEY,
    snapshot_ts   TIMESTAMPTZ  NOT NULL UNIQUE,
    total_aum_usd NUMERIC(38, 6) NOT NULL,
    itp_count     INTEGER      NOT NULL,
    supply_count  INTEGER      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tvl_history_ts
    ON tvl_history (snapshot_ts DESC);
