-- Covering index: serves bulk simulation queries entirely from the index
-- (index-only scan) without random heap I/O. Includes price_usd and market_cap_usd
-- so the simulation preload query never touches the 1GB heap table.
CREATE INDEX IF NOT EXISTS idx_cg_mcap_sim_cover
    ON coingecko_market_caps(coin_id, snapshot_date)
    INCLUDE (price_usd, market_cap_usd)
    WHERE price_usd IS NOT NULL;
