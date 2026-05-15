-- Widen change_pct from numeric(10,4) to numeric(20,4).
--
-- numeric(10,4) caps |change_pct| < 10^6 (six digits before the decimal).
-- A handful of low-cap or thinly-traded assets occasionally report % moves
-- past that ceiling, and the resulting overflow rejects the entire bulk
-- INSERT — poisoning the BatchWriter's retry queue and stalling every
-- subsequent price write. Sixteen hours of stale prices on 2026-05-14/15
-- caused every Vision batch to resolve as Cancelled and refund.
--
-- numeric(20,4) is metadata-only on Postgres ≥12 (the new type is a
-- superset), so this is non-blocking on tables of any size.

ALTER TABLE market_prices       ALTER COLUMN change_pct TYPE numeric(20,4);
ALTER TABLE market_prices_latest ALTER COLUMN change_pct TYPE numeric(20,4);
