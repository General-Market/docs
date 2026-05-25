-- Pump.fun "tokens of the day" support.
--
-- Two tables back the feature:
--   1. pumpfun_first_seen — when each pump.fun asset was first observed with a
--      live price. A token is "new" (a fresh launch) if its first_seen falls on
--      the current UTC day. Persisted so the signal survives a data-node
--      restart; the in-memory discovery cache in the pumpfun client does not.
--      Written once per asset, never updated (ON CONFLICT DO NOTHING).
--
--   2. pumpfun_daily_tokens — the frozen daily set. The batch engine computes
--      the top 10 NEW tokens by 24h volume once per UTC day and persists them
--      here, ranked. Every round that day (144 rounds at a 600s tick) reuses
--      this exact set, so the on-chain batch and the UI never diverge. A
--      mid-day restart reads the existing rows instead of recomputing.

CREATE TABLE IF NOT EXISTS pumpfun_first_seen (
    asset_id    TEXT PRIMARY KEY,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pumpfun_first_seen_ts
    ON pumpfun_first_seen (first_seen);

CREATE TABLE IF NOT EXISTS pumpfun_daily_tokens (
    utc_date    DATE NOT NULL,
    rank        INTEGER NOT NULL,        -- 0-based position in the frozen set
    asset_id    TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (utc_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_pumpfun_daily_tokens_date
    ON pumpfun_daily_tokens (utc_date);
