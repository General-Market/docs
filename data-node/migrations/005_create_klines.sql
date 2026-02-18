CREATE TABLE IF NOT EXISTS klines (
    symbol    TEXT NOT NULL,
    open_time TIMESTAMPTZ NOT NULL,
    open      TEXT NOT NULL,
    high      TEXT NOT NULL,
    low       TEXT NOT NULL,
    close     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_klines_symbol_time ON klines (symbol, open_time);
