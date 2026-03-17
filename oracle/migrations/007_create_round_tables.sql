-- Round-based batch lifecycle tracking
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

CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_source
    ON vision_batch_lifecycle(source_id, timeframe_secs);
CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_unsettled
    ON vision_batch_lifecycle(settled_at) WHERE settled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_betting
    ON vision_batch_lifecycle(betting_end) WHERE settled_at IS NULL;

-- Per-player results per round (populated at settlement)
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

CREATE INDEX IF NOT EXISTS idx_round_players_player
    ON vision_round_players(player);
CREATE INDEX IF NOT EXISTS idx_round_players_settled
    ON vision_round_players(settled_at);
