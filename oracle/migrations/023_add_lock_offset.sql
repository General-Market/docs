-- The Vision tick scheduler restores batch state from `vision_batches.lock_offset`
-- on startup (oracle/src/vision/tick_scheduler.rs:242). The column was never
-- created — only `next_lock_offset`, which is the staging value for the next
-- tick. Without this column the scheduler boots with zero rows, has to
-- rediscover every source from chain events, and during that gap every
-- short-tick batch sails past its settlement grace window and refunds.

ALTER TABLE vision_batches
    ADD COLUMN IF NOT EXISTS lock_offset BIGINT NOT NULL DEFAULT 0;

-- Backfill from the staging column where it has been written. For batches
-- created before this migration the staging value is the best estimate;
-- chain_listener will refresh from contract on the next tick anyway.
UPDATE vision_batches
SET lock_offset = next_lock_offset
WHERE lock_offset = 0 AND next_lock_offset > 0;
