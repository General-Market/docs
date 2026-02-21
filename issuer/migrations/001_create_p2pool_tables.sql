-- P2Pool batch state (indexed from Vision.sol events by the issuer's chain listener)
CREATE TABLE IF NOT EXISTS p2pool_batches (
    batch_id BIGINT PRIMARY KEY,
    creator TEXT NOT NULL,
    market_ids TEXT[] NOT NULL,
    resolution_types SMALLINT[] NOT NULL,
    tick_duration BIGINT NOT NULL,
    custom_thresholds TEXT[] NOT NULL DEFAULT '{}',
    current_tick BIGINT NOT NULL DEFAULT 0,
    paused BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player positions (indexed from Vision.sol events)
CREATE TABLE IF NOT EXISTS p2pool_positions (
    batch_id BIGINT NOT NULL REFERENCES p2pool_batches(batch_id),
    player TEXT NOT NULL,
    bitmap_hash TEXT NOT NULL,
    stake_per_tick NUMERIC NOT NULL,
    start_tick BIGINT NOT NULL,
    balance NUMERIC NOT NULL,
    last_claimed_tick BIGINT NOT NULL DEFAULT 0,
    join_timestamp BIGINT NOT NULL,
    total_deposited NUMERIC NOT NULL DEFAULT 0,
    total_claimed NUMERIC NOT NULL DEFAULT 0,
    PRIMARY KEY (batch_id, player)
);

CREATE INDEX IF NOT EXISTS idx_p2pool_positions_balance ON p2pool_positions(batch_id) WHERE balance > 0;

-- Key-value store for indexer state (e.g. last indexed block)
CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tick resolution results (written by chain listener after issuer BLS consensus)
CREATE TABLE IF NOT EXISTS p2pool_tick_results (
    batch_id BIGINT NOT NULL REFERENCES p2pool_batches(batch_id),
    tick_id BIGINT NOT NULL,
    resolved_at BIGINT NOT NULL,
    market_outcomes JSONB NOT NULL,
    total_pool TEXT NOT NULL,
    winner_count BIGINT NOT NULL DEFAULT 0,
    loser_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (batch_id, tick_id)
);
