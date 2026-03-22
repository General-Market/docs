-- 010_drop_continuous_tables.sql
-- Drop tables used exclusively by the continuous/tick-engine model.
-- Round-based model uses: vision_batches, vision_positions, vision_bitmaps,
-- vision_batch_lifecycle, vision_round_players, vision_settlement_proofs.

DROP TABLE IF EXISTS vision_tick_results CASCADE;
DROP TABLE IF EXISTS vision_player_tick_deltas CASCADE;
DROP TABLE IF EXISTS vision_balance_proofs CASCADE;
DROP TABLE IF EXISTS vision_batch_state CASCADE;
DROP TABLE IF EXISTS vision_deposit_orders CASCADE;
DROP TABLE IF EXISTS vision_withdraw_orders CASCADE;
DROP TABLE IF EXISTS vision_user_balances CASCADE;
DROP TABLE IF EXISTS vision_last_resolved CASCADE;

-- Clean up vision_kv_store entries used by tick engine
DELETE FROM vision_kv_store WHERE key LIKE 'tick_%' OR key LIKE 'engine_%';
