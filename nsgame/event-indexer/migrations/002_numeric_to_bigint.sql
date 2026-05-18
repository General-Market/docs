-- 2026-04-25: tokio-postgres 0.7 cannot serialize Rust i64/i128 to a
-- numeric column even with a SQL ::numeric cast — the cast operates
-- after parameter binding, not during. Switch the price/amount columns
-- to bigint. View counts and stake amounts both stay well under
-- i64::MAX. If a future event ever carries a value above 2^63 - 1,
-- migrate this back to numeric and pull rust_decimal into the indexer.
--
-- Applied operationally on VPS 3 before this file existed; this migration
-- is the recovery script for any fresh deploy.

ALTER TABLE bet_placed       ALTER COLUMN amount         TYPE bigint USING amount::bigint;
ALTER TABLE bet_exited       ALTER COLUMN amount         TYPE bigint USING amount::bigint;
ALTER TABLE market_closed    ALTER COLUMN baseline_price TYPE bigint USING baseline_price::bigint;
ALTER TABLE market_resolved  ALTER COLUMN baseline_price TYPE bigint USING baseline_price::bigint;
ALTER TABLE market_resolved  ALTER COLUMN final_price    TYPE bigint USING final_price::bigint;
ALTER TABLE claimed          ALTER COLUMN net            TYPE bigint USING net::bigint;
ALTER TABLE claimed          ALTER COLUMN fee            TYPE bigint USING fee::bigint;
