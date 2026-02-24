-- Unified market data tables (ported from AA market-data-lib)
-- Stores data from 15+ providers: stocks, weather, FRED, ECB, BLS, etc.

CREATE TABLE IF NOT EXISTS market_assets (
    asset_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (source, asset_id)
);

CREATE TABLE IF NOT EXISTS market_prices (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(100) NOT NULL,
    value DECIMAL(30,10) NOT NULL,
    prev_close DECIMAL(30,10),
    change_pct DECIMAL(10,4),
    volume_24h DECIMAL(30,2),
    market_cap DECIMAL(30,2),
    fetched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (source, asset_id) REFERENCES market_assets(source, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_market_assets_source ON market_assets(source);
CREATE INDEX IF NOT EXISTS idx_market_assets_source_active ON market_assets(source, is_active);
CREATE INDEX IF NOT EXISTS idx_market_assets_category ON market_assets(source, category);
CREATE INDEX IF NOT EXISTS idx_market_prices_source ON market_prices(source);
CREATE INDEX IF NOT EXISTS idx_market_prices_asset ON market_prices(source, asset_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_time ON market_prices(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_asset_time ON market_prices(source, asset_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_source_fetched ON market_prices(source, fetched_at DESC);
