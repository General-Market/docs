-- 026_vision_pending_creates.sql
-- Pending createBatch proposals whose first cosign sweep fell short of threshold.
-- A background sweeper replays the broadcast every 10s. After 20 retries
-- (~3.5 minutes) the row and its lifecycle peer are deleted — the batch is
-- permanently lost. No players can join an unsubmitted batch, so no refunds
-- are owed.

CREATE TABLE IF NOT EXISTS vision_pending_creates (
    lifecycle_id      BIGINT PRIMARY KEY,
    source_name       TEXT NOT NULL,
    source_id         BYTEA NOT NULL,
    config_hash       BYTEA NOT NULL,
    tick_duration     BIGINT NOT NULL,
    lock_offset       BIGINT NOT NULL,
    settlement_grace  BIGINT NOT NULL,
    ref_nonce         BIGINT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retry_count       INT NOT NULL DEFAULT 0,
    last_attempt_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_creates_retry
    ON vision_pending_creates (last_attempt_at NULLS FIRST);
