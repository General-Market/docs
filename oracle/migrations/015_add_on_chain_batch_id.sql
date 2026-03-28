-- 015_add_on_chain_batch_id.sql
-- The lifecycle table uses auto-increment batch_id (now at 3000+) while on-chain
-- batches use IDs 1-975. All joins against vision_batches break because the IDs
-- don't match. Store the on-chain batch_id separately so joins work reliably.

ALTER TABLE vision_batch_lifecycle ADD COLUMN IF NOT EXISTS on_chain_batch_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lifecycle_on_chain_batch_id
    ON vision_batch_lifecycle(on_chain_batch_id) WHERE on_chain_batch_id IS NOT NULL;

-- Backfill: for any lifecycle rows where batch_id happens to match an on-chain
-- batch in vision_batches, copy it over. This covers rows where the old
-- UPDATE batch_id = on_chain_id succeeded.
UPDATE vision_batch_lifecycle vbl
   SET on_chain_batch_id = vbl.batch_id
 WHERE on_chain_batch_id IS NULL
   AND EXISTS (SELECT 1 FROM vision_batches vb WHERE vb.id = vbl.batch_id);
