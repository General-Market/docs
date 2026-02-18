CREATE TABLE IF NOT EXISTS liquidity_snapshots (
    id               BIGSERIAL PRIMARY KEY,
    symbol           TEXT NOT NULL,
    spread_bps       REAL NOT NULL,
    bid_depth_1pct   REAL NOT NULL,
    ask_depth_1pct   REAL NOT NULL,
    bid_depth_2pct   REAL NOT NULL,
    ask_depth_2pct   REAL NOT NULL,
    volume_24h_usd   REAL NOT NULL,
    mid_price        TEXT NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetched_hour     TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW())
);
CREATE INDEX IF NOT EXISTS idx_liq_symbol_time
    ON liquidity_snapshots (symbol, fetched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_liq_symbol_hour
    ON liquidity_snapshots (symbol, fetched_hour);
