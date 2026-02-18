CREATE TABLE IF NOT EXISTS prices (
    id          BIGSERIAL PRIMARY KEY,
    symbol      TEXT NOT NULL,
    price       TEXT NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prices_symbol_time ON prices (symbol, fetched_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_symbol_fetched ON prices (symbol, fetched_at);
