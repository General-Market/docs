-- 020: Drop stake_per_tick from vision_positions.
--
-- The Vision.PlayerJoined event now carries the FULL deposit in its `deposit`
-- field, replacing the per-tick slice it used to publish. The oracle stores
-- that single number in vision_positions.total_deposited and the duplicated
-- stake_per_tick column has nothing left to say. Idempotent, so safe to apply
-- against fresh and existing databases alike.

ALTER TABLE vision_positions DROP COLUMN IF EXISTS stake_per_tick;
