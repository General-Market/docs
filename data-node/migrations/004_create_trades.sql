CREATE TABLE IF NOT EXISTS trades (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL,
    user_address    TEXT NOT NULL,
    itp_id          TEXT NOT NULL,
    side            SMALLINT NOT NULL,        -- 0=BUY, 1=SELL
    amount          TEXT NOT NULL,             -- USDC amount (uint256 string)
    limit_price     TEXT NOT NULL,
    fill_price      TEXT,                      -- NULL if unfilled
    fill_amount     TEXT,                      -- NULL if unfilled
    status          SMALLINT NOT NULL DEFAULT 0, -- 0=pending, 2=filled
    order_timestamp TIMESTAMPTZ NOT NULL,
    fill_timestamp  TIMESTAMPTZ,
    block_number    BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_order_id ON trades (order_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_address, order_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_itp ON trades (itp_id, order_timestamp DESC);
