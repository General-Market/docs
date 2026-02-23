-- Vision batch state (indexed from Vision.sol events by the issuer's chain listener)
CREATE TABLE IF NOT EXISTS vision_batches (
    id BIGINT PRIMARY KEY,
    creator TEXT NOT NULL,
    market_count INT NOT NULL DEFAULT 0,
    market_ids TEXT[] NOT NULL DEFAULT '{}',
    tick_duration BIGINT NOT NULL,
    created_at_tick BIGINT NOT NULL DEFAULT 0,
    paused BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player positions (indexed from Vision.sol events)
CREATE TABLE IF NOT EXISTS vision_positions (
    batch_id BIGINT NOT NULL REFERENCES vision_batches(id),
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

CREATE INDEX IF NOT EXISTS idx_vision_positions_balance ON vision_positions(batch_id) WHERE balance > 0;

-- Key-value store for indexer state (e.g. last indexed block)
CREATE TABLE IF NOT EXISTS vision_kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tick resolution results (written by chain listener after issuer BLS consensus)
CREATE TABLE IF NOT EXISTS vision_tick_results (
    batch_id BIGINT NOT NULL REFERENCES vision_batches(id),
    tick_id BIGINT NOT NULL,
    resolved_at TIMESTAMPTZ,
    player_count INT,
    total_matched TEXT,
    results_json JSONB,
    PRIMARY KEY (batch_id, tick_id)
);
