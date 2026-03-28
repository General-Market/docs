-- Import CoinGecko gap data from CSV into coingecko_market_caps.
-- Run on VPS after scp'ing the CSV:
--
--   psql "$DATABASE_URL" -f /tmp/import-cg-gap.sql
--
-- Uses a temp table + upsert to avoid overwriting existing data with nulls.

BEGIN;

CREATE TEMP TABLE _cg_import (
    coin_id TEXT,
    symbol TEXT,
    name TEXT,
    snapshot_date DATE,
    price_usd DOUBLE PRECISION,
    market_cap_usd DOUBLE PRECISION,
    total_volume_usd DOUBLE PRECISION,
    market_cap_rank INTEGER
);

-- Skip the header row
\copy _cg_import FROM '/tmp/cg-gap-data.csv' WITH (FORMAT csv, HEADER true, NULL '')

-- Upsert into the real table
INSERT INTO coingecko_market_caps (coin_id, symbol, name, snapshot_date, price_usd, market_cap_usd, total_volume_usd, market_cap_rank)
SELECT coin_id, symbol, name, snapshot_date, price_usd, market_cap_usd, total_volume_usd, market_cap_rank
FROM _cg_import
WHERE price_usd IS NOT NULL AND price_usd > 0
ON CONFLICT (coin_id, snapshot_date) DO UPDATE SET
    price_usd = EXCLUDED.price_usd,
    market_cap_usd = EXCLUDED.market_cap_usd,
    total_volume_usd = EXCLUDED.total_volume_usd,
    market_cap_rank = COALESCE(EXCLUDED.market_cap_rank, coingecko_market_caps.market_cap_rank),
    symbol = COALESCE(EXCLUDED.symbol, coingecko_market_caps.symbol),
    name = COALESCE(EXCLUDED.name, coingecko_market_caps.name),
    fetched_at = NOW();

-- Report
SELECT
    COUNT(*) AS rows_imported,
    MIN(snapshot_date) AS earliest,
    MAX(snapshot_date) AS latest,
    COUNT(DISTINCT coin_id) AS coins
FROM _cg_import
WHERE price_usd IS NOT NULL AND price_usd > 0;

DROP TABLE _cg_import;

COMMIT;
