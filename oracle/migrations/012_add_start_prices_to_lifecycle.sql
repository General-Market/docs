-- Store price snapshot at round creation so resolver can compute real start vs end
ALTER TABLE vision_batch_lifecycle ADD COLUMN IF NOT EXISTS start_prices JSONB;
