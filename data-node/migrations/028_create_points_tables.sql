-- Points system tables
-- Budget: 10,000 pts/day total (Vision 5K, Creator 2.5K, Holder 2.5K)

-- Append-only ledger: every point award is a row
CREATE TABLE IF NOT EXISTS points_ledger (
    id          BIGSERIAL PRIMARY KEY,
    player      TEXT NOT NULL,
    pool        TEXT NOT NULL,       -- 'vision' | 'index_creator' | 'index_holder'
    points      NUMERIC NOT NULL,
    reason      TEXT NOT NULL,       -- e.g. 'vision:round:42' or 'index:hourly:2026-03-23T14'
    rank        INTEGER,            -- NULL for vision (share-based, not ranked)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player, pool, reason)    -- idempotency: prevent duplicate awards
);

CREATE INDEX IF NOT EXISTS idx_points_player_pool ON points_ledger(player, pool);
CREATE INDEX IF NOT EXISTS idx_points_created ON points_ledger(created_at);

-- Materialized summary: O(1) lookups per player per pool
CREATE TABLE IF NOT EXISTS points_totals (
    player      TEXT NOT NULL,
    pool        TEXT NOT NULL,
    total       NUMERIC NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player, pool)
);

-- ITP metadata: creator address + NAV at creation for creator/holder point pools
CREATE TABLE IF NOT EXISTS itp_meta (
    itp_id          TEXT PRIMARY KEY,   -- bytes32 hex
    creator         TEXT NOT NULL,      -- 0x address
    nav_at_creation NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
