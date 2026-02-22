-- Widen symbol column from VARCHAR(20) to VARCHAR(100) to accommodate
-- long asset IDs from new sources (PyPI packages, weather cities, etc.)
ALTER TABLE market_assets ALTER COLUMN symbol TYPE VARCHAR(100);
ALTER TABLE market_prices ALTER COLUMN symbol TYPE VARCHAR(100);
