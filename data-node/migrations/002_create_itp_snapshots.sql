CREATE TABLE IF NOT EXISTS itp_snapshots (
    id          BIGSERIAL PRIMARY KEY,
    itp_id      TEXT NOT NULL,                    -- bytes32 hex
    assets      TEXT[] NOT NULL,                  -- token addresses
    inventory   TEXT[] NOT NULL,                  -- per-share quantities (uint256 strings)
    nav         TEXT NOT NULL,                    -- NAV at snapshot time
    valid_from  TIMESTAMPTZ NOT NULL,             -- block timestamp
    event_type  TEXT NOT NULL                     -- 'created' or 'rebalanced'
);
CREATE INDEX IF NOT EXISTS idx_snapshots_itp_time
    ON itp_snapshots (itp_id, valid_from DESC);
