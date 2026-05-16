-- Phase 1 of the storage redesign. vision_settlements is the JSONB-compacted
-- destination that replaces the per-player and per-asset settlement archives.
-- One row per batch instead of one row per asset per player.
--
-- TimescaleDB compression and retention policies are Community-only and
-- this cluster is Apache. Hypertable chunking still applies. Retention is
-- driven by the existing retention pruner (data-node retention.rs), which
-- can drop_chunks instead of per-row DELETE.
--
-- The migration runner splits SQL on semicolon, so dollar-quoted DO blocks
-- are forbidden. Each statement stands on its own.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS vision_settlements (
    batch_id        BIGINT      NOT NULL,
    source_id       TEXT        NOT NULL,
    on_chain_batch_id BIGINT,
    settled_at      TIMESTAMPTZ NOT NULL,
    outcome_summary JSONB       NOT NULL,
    player_results  JSONB       NOT NULL,
    PRIMARY KEY (batch_id, settled_at)
);

SELECT create_hypertable('vision_settlements', 'settled_at', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_vision_settlements_source_time ON vision_settlements (source_id, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_vision_settlements_on_chain ON vision_settlements (on_chain_batch_id) WHERE on_chain_batch_id IS NOT NULL;
