-- Curated UI flags on market_assets.
-- Phase 1 of the DefiLlama source split: humans curate ~10 protocols per page;
-- the bot firehose pages stay open-ended. The flag rides on the asset row so
-- the frontend never has to query DefiLlama directly.

ALTER TABLE market_assets
    ADD COLUMN IF NOT EXISTS tradable_in_ui BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ui_rank INTEGER;

CREATE INDEX IF NOT EXISTS idx_market_assets_tradable
    ON market_assets(tradable_in_ui)
    WHERE tradable_in_ui = TRUE;
