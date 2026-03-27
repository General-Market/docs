-- 014_backfill_lifecycle_player_count.sql
-- Backfill vision_batch_lifecycle.player_count from vision_positions.
-- The column existed since migration 008 (DEFAULT 0) but was never incremented.
-- Going forward, chain_listener.handle_player_joined increments it on each PlayerJoined event.

UPDATE vision_batch_lifecycle vbl
SET player_count = sub.cnt
FROM (
    SELECT batch_id, COUNT(DISTINCT player)::integer AS cnt
    FROM vision_positions
    GROUP BY batch_id
) sub
WHERE vbl.batch_id = sub.batch_id
  AND (vbl.player_count IS NULL OR vbl.player_count = 0);
