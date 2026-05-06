-- Per-player breakdown of every settled (batch, asset) market.
-- Sibling to vision_market_ratios (which is the per-asset aggregate).
-- One row per player who participated in a given market in a given round.
-- The `side` column stores raw bitmap semantics — frontend resolves to up/down arrows
-- per source convention (price-style sources vs delay-style sources flip direction).
CREATE TABLE IF NOT EXISTS vision_asset_settlement_players (
    batch_id            BIGINT NOT NULL,
    asset_id            TEXT NOT NULL,
    player              TEXT NOT NULL,
    side                TEXT NOT NULL,                -- 'Up' | 'Down'
    won                 BOOLEAN NOT NULL,
    effective_stake     TEXT NOT NULL DEFAULT '0',    -- wei, stringified
    payout              TEXT NOT NULL DEFAULT '0',    -- wei, stringified
    settled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, asset_id, player)
);

CREATE INDEX IF NOT EXISTS idx_asp_asset_settled
    ON vision_asset_settlement_players(asset_id, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_asp_player
    ON vision_asset_settlement_players(player);

-- Backfill from existing settled rounds. Safe to re-run — ON CONFLICT DO NOTHING.
-- Source: vision_market_ratios joined to vision_round_players via batch_id.
-- We can't recover per-player effective_stake or payout from existing storage
-- without re-running settlement, so backfill writes side+won only and leaves
-- stake/payout at '0'. Future settlements populate the real values.
--
-- side reconstruction: if outcome is Up and player is in correct_count > 0 set
-- on this market, they bet Up. We can't decode this from aggregates alone, so
-- backfill is intentionally limited to the aggregate row in vision_market_ratios
-- and is left as a no-op here. Run a dedicated script if historical reconstruction
-- is needed later.
