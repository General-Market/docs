-- 011_add_market_count_to_lifecycle.sql
-- Store market_count at batch creation time so the batch API doesn't need
-- to look up the (volatile) recommended config every request.
ALTER TABLE vision_batch_lifecycle ADD COLUMN IF NOT EXISTS market_count INTEGER;
