-- Per-player per-tick balance deltas for profile page
-- Written by oracle after each tick resolution (best-effort, background task)
-- Read by oracle profile endpoint, proxied through data-node to frontend

CREATE TABLE IF NOT EXISTS vision_player_tick_deltas (
  batch_id         INTEGER NOT NULL,
  tick_id          INTEGER NOT NULL,
  player           TEXT NOT NULL,
  delta            TEXT NOT NULL,
  won              BOOLEAN NOT NULL,
  total_deposited  TEXT,
  resolved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, tick_id, player)
);

-- Functional indexes on LOWER(player) because addresses are stored checksummed
-- but profile queries use lowercase
CREATE INDEX IF NOT EXISTS idx_vptd_player ON vision_player_tick_deltas(LOWER(player));
CREATE INDEX IF NOT EXISTS idx_vptd_player_batch ON vision_player_tick_deltas(LOWER(player), batch_id, tick_id DESC);

-- Also index vision_positions for profile active-position queries
CREATE INDEX IF NOT EXISTS idx_vp_lower_player ON vision_positions(LOWER(player));
