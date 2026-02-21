-- Bitget spot pair listing / delisting dates from /api/v2/spot/public/symbols
CREATE TABLE IF NOT EXISTS bitget_listings (
    symbol          TEXT PRIMARY KEY,       -- e.g. "BTCUSDT"
    base_coin       TEXT NOT NULL,          -- e.g. "BTC"
    quote_coin      TEXT NOT NULL,          -- e.g. "USDT"
    listed_at       TIMESTAMPTZ NOT NULL,   -- openTime from Bitget API
    delisted_at     TIMESTAMPTZ,            -- offTime (NULL if still active)
    status          TEXT NOT NULL,           -- "online", "halt", "offline"
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitget_listings_base ON bitget_listings(base_coin);
CREATE INDEX IF NOT EXISTS idx_bitget_listings_listed ON bitget_listings(listed_at);
CREATE INDEX IF NOT EXISTS idx_bitget_listings_status ON bitget_listings(status);
