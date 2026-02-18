-- Fast symbol → coin_id lookup for simulation cache loading.
-- Partial index: only rows with non-null symbol, covering coin_id for index-only scan.
CREATE INDEX IF NOT EXISTS idx_cg_mcap_symbol_upper
    ON coingecko_market_caps(UPPER(symbol))
    INCLUDE (coin_id)
    WHERE symbol IS NOT NULL;
