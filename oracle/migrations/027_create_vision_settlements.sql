-- Phase 1 of the storage redesign — vision_settlements is the JSONB-compacted
-- destination that replaces vision_asset_settlement_players_archive (84 GB,
-- 262 M rows) and vision_market_ratios_archive (20 GB, 102 M rows).
--
-- One row per (batch, settled_at) instead of one row per (batch, asset, player).
-- For a typical polymarket batch that collapses ~49 000 INSERTs into 1.
--
-- Safe to run during the in-flight wraparound vacuums — this only creates a
-- new empty table. Nothing here touches the existing _archive tables.
--
-- TimescaleDB is expected in production; the DO block skips hypertable DDL
-- on dev environments without the extension. The plain table still gets
-- created so the dual-write code path compiles and runs.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS vision_settlements (
    batch_id        BIGINT      NOT NULL,
    source_id       TEXT        NOT NULL,
    on_chain_batch_id BIGINT,
    settled_at      TIMESTAMPTZ NOT NULL,
    -- Per-asset outcome and parimutuel split. Shape:
    --   { "<asset_id>": { "outcome": "Up"|"Down"|"Flat"|"Cancelled"|"AllSameSide"|"AllLosers",
    --                     "up_stake": "<wei str>", "down_stake": "<wei str>",
    --                     "pct_change_bps": <i64> }, ... }
    outcome_summary JSONB       NOT NULL,
    -- Per-player breakdown. Shape:
    --   { "0x...": { "deposited": "<wei>", "payout": "<wei>", "pnl": "<wei>",
    --                "correct": <i32>, "total": <i32>,
    --                "by_asset": [ { "asset": "...", "side": "Up"|"Down",
    --                                "won": <bool>, "stake": "<wei>",
    --                                "payout": "<wei>" }, ... ] }, ... }
    player_results  JSONB       NOT NULL,
    PRIMARY KEY (batch_id, settled_at)
);

DO $$
DECLARE
    has_timescale BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) INTO has_timescale;

    IF NOT has_timescale THEN
        RAISE NOTICE 'TimescaleDB not installed — vision_settlements remains a plain heap.';
        RETURN;
    END IF;

    -- 7-day chunks. Settlements are sparse vs market_prices; smaller chunk
    -- count keeps catalog overhead low. JSONB rows are ~50 KB compressed
    -- so 7d of polymarket batches ≈ 250 MB raw, ~30 MB compressed.
    PERFORM create_hypertable(
        'vision_settlements',
        'settled_at',
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists       => TRUE
    );

    EXECUTE $ddl$
        ALTER TABLE vision_settlements SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'source_id',
            timescaledb.compress_orderby   = 'settled_at DESC'
        )
    $ddl$;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'vision_settlements' AND proc_name = 'policy_compression'
    ) THEN
        PERFORM add_compression_policy('vision_settlements', INTERVAL '2 days');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'vision_settlements' AND proc_name = 'policy_retention'
    ) THEN
        PERFORM add_retention_policy('vision_settlements', INTERVAL '30 days');
    END IF;
END $$;

-- Lookups: (source_id, settled_at desc) for per-source history,
-- (on_chain_batch_id) for the API's batch-by-id endpoint.
CREATE INDEX IF NOT EXISTS idx_vision_settlements_source_time
    ON vision_settlements (source_id, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_vision_settlements_on_chain
    ON vision_settlements (on_chain_batch_id)
    WHERE on_chain_batch_id IS NOT NULL;
