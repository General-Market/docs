-- 037_create_wallet_balance_snapshots.sql
--
-- Hourly time series of native-gas balances for the oracle wallet roster on
-- both L3 (GM) and Sonic testnet (S). Fed by wallet_balance_collector,
-- consumed by /oracle/balances API and the /oracle frontend page.

CREATE TABLE IF NOT EXISTS wallet_balance_snapshots (
    id           BIGSERIAL PRIMARY KEY,
    wallet       TEXT NOT NULL,
    chain        TEXT NOT NULL CHECK (chain IN ('l3', 'sonic')),
    label        TEXT NOT NULL,
    balance_wei  NUMERIC(80, 0) NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_balance_chain_addr_time
    ON wallet_balance_snapshots (chain, wallet, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_balance_time
    ON wallet_balance_snapshots (fetched_at DESC);
