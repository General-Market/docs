CREATE TABLE IF NOT EXISTS collector_cursors (
    collector_name TEXT PRIMARY KEY,
    last_block     BIGINT NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
