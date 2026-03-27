-- 4-hour epoch points system.
-- These tables are PERSISTENT — they survive testnet.sh redeployments.
-- Do NOT add them to the TRUNCATE list.

-- Lifetime points accumulator per player address.
CREATE TABLE IF NOT EXISTS vision_player_points (
    player          TEXT PRIMARY KEY,
    total_points    BIGINT NOT NULL DEFAULT 0,
    rounds_played   INTEGER NOT NULL DEFAULT 0,
    total_deposited TEXT NOT NULL DEFAULT '0',
    total_pnl       TEXT NOT NULL DEFAULT '0',
    last_epoch_ts   TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-epoch snapshot — one row per player per 4-hour epoch.
-- Allows historical audit of how points were earned.
CREATE TABLE IF NOT EXISTS vision_epoch_log (
    epoch_ts        TIMESTAMPTZ NOT NULL,
    player          TEXT NOT NULL,
    points_delta    BIGINT NOT NULL,
    rounds_in_epoch INTEGER NOT NULL DEFAULT 0,
    deposited_total TEXT NOT NULL DEFAULT '0',
    pnl_total       TEXT NOT NULL DEFAULT '0',
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (epoch_ts, player)
);

CREATE INDEX IF NOT EXISTS idx_epoch_log_player ON vision_epoch_log (player);
CREATE INDEX IF NOT EXISTS idx_player_points_total ON vision_player_points (total_points DESC);
