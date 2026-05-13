-- 025_vision_source_state.sql
-- Persist per-source lifecycle state across oracle restarts.

CREATE TABLE IF NOT EXISTS vision_source_state (
  source_name        TEXT PRIMARY KEY,
  source_id          BYTEA NOT NULL,
  current_batch_id   BIGINT,
  previous_batch_id  BIGINT,
  tick_duration_secs INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stagger_offset_ms  BIGINT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_source_state_due
  ON vision_source_state (last_heartbeat_at, tick_duration_secs)
  WHERE tick_duration_secs > 0;
