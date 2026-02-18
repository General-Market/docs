CREATE TABLE IF NOT EXISTS coingecko_market_caps (
    id          BIGSERIAL PRIMARY KEY,
    coin_id     TEXT NOT NULL,
    symbol      TEXT,
    name        TEXT,
    market_cap_usd      DOUBLE PRECISION,
    price_usd           DOUBLE PRECISION,
    total_volume_usd    DOUBLE PRECISION,
    market_cap_rank     INTEGER,
    snapshot_date       DATE NOT NULL,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (coin_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_cg_mcap_coin_id   ON coingecko_market_caps(coin_id);
CREATE INDEX IF NOT EXISTS idx_cg_mcap_date      ON coingecko_market_caps(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cg_mcap_rank_date ON coingecko_market_caps(snapshot_date, market_cap_rank);
