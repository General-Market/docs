-- Cache table for fast Vision snapshot lookups.
-- One row per (source, asset_id) with the latest price.
-- Populated by sync_engine / scheduled_sync_engine on each price update.

CREATE TABLE IF NOT EXISTS market_prices_latest (
    source      VARCHAR(50) NOT NULL,
    asset_id    VARCHAR(100) NOT NULL,
    symbol      VARCHAR(100) NOT NULL DEFAULT '',
    name        VARCHAR(200) NOT NULL DEFAULT '',
    value       DECIMAL(30,10) NOT NULL,
    change_pct  DECIMAL(10,4),
    volume_24h  DECIMAL(30,2),
    market_cap  DECIMAL(30,2),
    category    VARCHAR(100),
    fetched_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (source, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_market_prices_latest_source
    ON market_prices_latest (source);
