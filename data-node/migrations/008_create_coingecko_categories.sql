-- CoinGecko categories and their coin memberships

CREATE TABLE IF NOT EXISTS coingecko_categories (
    id              TEXT PRIMARY KEY,          -- e.g. "layer-1", "defi"
    name            TEXT NOT NULL,
    market_cap      DOUBLE PRECISION,
    market_cap_change_24h DOUBLE PRECISION,
    volume_24h      DOUBLE PRECISION,
    top_3_coins     TEXT[],                    -- image URLs of top 3 coins
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coingecko_category_coins (
    category_id     TEXT NOT NULL REFERENCES coingecko_categories(id) ON DELETE CASCADE,
    coin_id         TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (category_id, coin_id)
);

CREATE INDEX IF NOT EXISTS idx_cg_cat_coins_coin ON coingecko_category_coins(coin_id);
