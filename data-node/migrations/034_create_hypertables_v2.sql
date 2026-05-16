-- Phase 1 of the storage redesign. Net-new hypertable destinations for
-- market_prices, prices (legacy), and vision_bitmaps. Empty on creation.
-- Reads stay on the old tables. Mirror writes are gated by USE_NEW_STORAGE=1.
--
-- The prod cluster runs TimescaleDB Apache edition. Compression and
-- automatic retention policies are Community-only. We get chunk-based
-- storage from create_hypertable. Retention is handled by the existing
-- data-node retention.rs task, which can drop entire chunks instead of
-- doing per-row DELETE on the new tables (drop_chunks is Apache).
--
-- Every statement here is its own logical block. The migration runner
-- splits SQL on semicolon, so dollar-quoted DO blocks are forbidden.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS market_prices_v2 (
    asset_id   VARCHAR(100)    NOT NULL,
    source     VARCHAR(50)     NOT NULL,
    symbol     VARCHAR(100)    NOT NULL,
    value      DECIMAL(30,10)  NOT NULL,
    prev_close DECIMAL(30,10),
    change_pct DECIMAL(20,4),
    volume_24h DECIMAL(30,2),
    market_cap DECIMAL(30,2),
    fetched_at TIMESTAMPTZ     NOT NULL,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prices_v2 (
    symbol     TEXT        NOT NULL,
    price      TEXT        NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    UNIQUE (symbol, fetched_at)
);

CREATE TABLE IF NOT EXISTS vision_bitmaps_v2 (
    batch_id        BIGINT      NOT NULL,
    player          TEXT        NOT NULL,
    bitmap          BYTEA       NOT NULL,
    bitmap_hash     TEXT        NOT NULL,
    slot            TEXT        NOT NULL DEFAULT 'pending',
    target_tick_id  BIGINT      NOT NULL DEFAULT 0,
    config_hash     TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, player, slot, created_at)
);

SELECT create_hypertable('market_prices_v2', 'fetched_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

SELECT create_hypertable('prices_v2', 'fetched_at', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

SELECT create_hypertable('vision_bitmaps_v2', 'created_at', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_market_prices_v2_lookup ON market_prices_v2 (source, asset_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_prices_v2_symbol_time ON prices_v2 (symbol, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_vision_bitmaps_v2_batch ON vision_bitmaps_v2 (batch_id, player, slot);
