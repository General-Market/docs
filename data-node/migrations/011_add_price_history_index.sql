CREATE INDEX IF NOT EXISTS idx_cg_mcap_coin_date_price
    ON coingecko_market_caps(coin_id, snapshot_date)
    WHERE price_usd IS NOT NULL;
