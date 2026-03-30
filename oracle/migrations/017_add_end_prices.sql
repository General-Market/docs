-- 017_add_end_prices.sql
-- Freeze end prices at settlement time so all oracles use identical values.
-- Without this, oracles fetch prices at slightly different times, producing
-- different payouts_hash → co-signing fails → settlements stuck forever.

ALTER TABLE vision_batch_lifecycle
    ADD COLUMN IF NOT EXISTS end_prices JSONB;
