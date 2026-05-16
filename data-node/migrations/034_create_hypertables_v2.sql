-- Phase 1 of the storage redesign — net-new hypertable destinations for
-- market_prices, prices (legacy), and vision_bitmaps. Empty on creation.
-- Reads stay on the old tables; dual-write is gated by USE_NEW_STORAGE=1
-- in the data-node and oracle binaries.
--
-- Safe to run while the in-flight emergency vacuums are still grinding.
-- Nothing here touches market_prices, vision_asset_settlement_players_archive,
-- prices, or vision_bitmaps. We only CREATE new empty tables and register
-- TimescaleDB policies against them.
--
-- TimescaleDB is required in production. On environments without the
-- extension (local Anvil dev), the DO block detects its absence and skips
-- the hypertable/compression/retention DDL. The plain table definitions
-- still get created, so the dual-write code paths function — they just
-- store rows in a plain heap table on dev. This is intentional.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- market_prices_v2 — same columns as market_prices, BIGSERIAL dropped because
-- hypertables don't need a synthetic PK and the (source, asset_id, fetched_at)
-- tuple is uniquely identifying for the dedup-on-write contract we're moving to.
-- =============================================================================
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

-- =============================================================================
-- prices_v2 — legacy table is still read by db.rs::query_nearest_price.
-- Convert the destination, not the existing table.
-- =============================================================================
CREATE TABLE IF NOT EXISTS prices_v2 (
    symbol     TEXT        NOT NULL,
    price      TEXT        NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    UNIQUE (symbol, fetched_at)
);

-- =============================================================================
-- vision_bitmaps_v2 — current table has no time column; v2 introduces one.
-- =============================================================================
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

-- =============================================================================
-- Hypertables + compression + retention. All guarded by extension presence so
-- the migration runs on dev environments without TimescaleDB.
-- =============================================================================
DO $$
DECLARE
    has_timescale BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) INTO has_timescale;

    IF NOT has_timescale THEN
        RAISE NOTICE 'TimescaleDB not installed — skipping hypertable DDL. v2 tables remain plain heaps.';
        RETURN;
    END IF;

    -- market_prices_v2: 1-day chunks, segment by (source, asset_id),
    -- order by time desc. Compress at 2 days, drop at 30.
    PERFORM create_hypertable(
        'market_prices_v2',
        'fetched_at',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists       => TRUE
    );

    EXECUTE $ddl$
        ALTER TABLE market_prices_v2 SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'source, asset_id',
            timescaledb.compress_orderby   = 'fetched_at DESC'
        )
    $ddl$;

    -- add_compression_policy / add_retention_policy raise if a policy already
    -- exists for the same hypertable, which makes re-running this migration
    -- on a partially-applied DB explode. Guard with a duplicate check.
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'market_prices_v2' AND proc_name = 'policy_compression'
    ) THEN
        PERFORM add_compression_policy('market_prices_v2', INTERVAL '2 days');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'market_prices_v2' AND proc_name = 'policy_retention'
    ) THEN
        PERFORM add_retention_policy('market_prices_v2', INTERVAL '30 days');
    END IF;

    -- prices_v2: legacy crypto price history. 7-day chunks (lower volume),
    -- compress at 7 days, drop at 90.
    PERFORM create_hypertable(
        'prices_v2',
        'fetched_at',
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists       => TRUE
    );

    EXECUTE $ddl$
        ALTER TABLE prices_v2 SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol',
            timescaledb.compress_orderby   = 'fetched_at DESC'
        )
    $ddl$;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'prices_v2' AND proc_name = 'policy_compression'
    ) THEN
        PERFORM add_compression_policy('prices_v2', INTERVAL '7 days');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'prices_v2' AND proc_name = 'policy_retention'
    ) THEN
        PERFORM add_retention_policy('prices_v2', INTERVAL '90 days');
    END IF;

    -- vision_bitmaps_v2: 1-day chunks, segment by batch_id (the natural
    -- access shape — bitmaps are queried per-batch). Drop at 7 days.
    PERFORM create_hypertable(
        'vision_bitmaps_v2',
        'created_at',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists       => TRUE
    );

    EXECUTE $ddl$
        ALTER TABLE vision_bitmaps_v2 SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'batch_id',
            timescaledb.compress_orderby   = 'created_at DESC'
        )
    $ddl$;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'vision_bitmaps_v2' AND proc_name = 'policy_compression'
    ) THEN
        PERFORM add_compression_policy('vision_bitmaps_v2', INTERVAL '1 day');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'vision_bitmaps_v2' AND proc_name = 'policy_retention'
    ) THEN
        PERFORM add_retention_policy('vision_bitmaps_v2', INTERVAL '7 days');
    END IF;

END $$;

-- Read-side indexes on the new tables. Hot lookup shape matches the old
-- index_market_prices_covering: (source, asset_id, fetched_at DESC).
-- TimescaleDB will create matching indexes on each chunk automatically.
CREATE INDEX IF NOT EXISTS idx_market_prices_v2_lookup
    ON market_prices_v2 (source, asset_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_prices_v2_symbol_time
    ON prices_v2 (symbol, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_vision_bitmaps_v2_batch
    ON vision_bitmaps_v2 (batch_id, player, slot);
