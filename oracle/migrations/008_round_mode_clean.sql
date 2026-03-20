-- 008_round_mode_clean.sql
-- Add lifecycle state to vision_batches. Wipe old data for clean start.

ALTER TABLE vision_batches ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_vision_batches_state ON vision_batches(state);

-- Wipe old permanent-batch data (full infra restart)
TRUNCATE vision_player_tick_deltas;
TRUNCATE vision_balance_proofs;
TRUNCATE vision_bitmaps;
TRUNCATE vision_tick_results;
TRUNCATE vision_positions;

-- Ensure round tables exist
CREATE TABLE IF NOT EXISTS vision_batch_lifecycle (
    batch_id            BIGINT PRIMARY KEY,
    source_id           TEXT NOT NULL,
    timeframe_secs      INTEGER NOT NULL,
    config_hash         TEXT NOT NULL,
    betting_start       TIMESTAMPTZ NOT NULL,
    betting_end         TIMESTAMPTZ NOT NULL,
    settlement_deadline TIMESTAMPTZ NOT NULL,
    settled_at          TIMESTAMPTZ,
    settle_tx_hash      TEXT,
    player_count        INTEGER DEFAULT 0,
    total_deposited     TEXT DEFAULT '0',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_source ON vision_batch_lifecycle(source_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_unsettled ON vision_batch_lifecycle(settled_at) WHERE settled_at IS NULL;

CREATE TABLE IF NOT EXISTS vision_round_players (
    batch_id        BIGINT NOT NULL,
    player          TEXT NOT NULL,
    deposited       TEXT NOT NULL,
    payout          TEXT NOT NULL,
    pnl             TEXT NOT NULL,
    correct_count   INTEGER NOT NULL,
    total_markets   INTEGER NOT NULL,
    bitmap_hex      TEXT,
    settled_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (batch_id, player)
);
CREATE INDEX IF NOT EXISTS idx_round_players_player ON vision_round_players(player);
