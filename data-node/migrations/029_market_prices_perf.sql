-- Covering index for historical queries (batch engine 24h changes, admin lateral joins).
-- Index-only scans: avoids heap I/O by including `value` in the index leaf pages.
--
-- NOTE: For large production tables, run this manually with CONCURRENTLY:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_prices_covering
--     ON market_prices (source, asset_id, fetched_at DESC) INCLUDE (value);
-- CONCURRENTLY cannot run inside a transaction, which some migration runners impose.
CREATE INDEX IF NOT EXISTS idx_market_prices_covering
    ON market_prices (source, asset_id, fetched_at DESC)
    INCLUDE (value);

-- Aggressive autovacuum: market_prices is write-heavy (thousands of inserts/min).
-- Default scale_factor (0.2) delays vacuuming until 20% of the table is dead tuples —
-- at 10M+ rows that means millions of dead rows before vacuum kicks in.
ALTER TABLE market_prices SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE market_prices SET (autovacuum_analyze_scale_factor = 0.005);
ALTER TABLE market_prices_latest SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE market_prices_latest SET (autovacuum_analyze_scale_factor = 0.005);

-- History pruning: 90-day retention.
-- Rows older than 90 days serve no batch or API queries — only bloat remains.
DELETE FROM market_prices WHERE fetched_at < NOW() - INTERVAL '90 days';
