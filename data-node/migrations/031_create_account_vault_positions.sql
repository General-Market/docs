-- Per-(account, vault) share-event ledger. One row per share-changing event:
--   DepositClaimed → mint inflow (assets become cost basis)
--   WithdrawClaimed → burn outflow (realized PnL booked)
--   Transfer (account ↔ account) → cost basis carried pro-rata
--
-- Append-only. Replays are idempotent via (account, vault, block_number, log_index).
-- Read shares-at-time(t) by selecting the most-recent row WHERE block_time <= t.
-- This is the cost-basis ledger that the legacy "current shares × historical NAV"
-- portfolio chart was missing.

CREATE TABLE IF NOT EXISTS account_vault_positions (
    id                BIGSERIAL PRIMARY KEY,
    account           BYTEA       NOT NULL,
    vault_address     BYTEA       NOT NULL,
    block_number      BIGINT      NOT NULL,
    block_time        TIMESTAMPTZ NOT NULL,
    log_index         INTEGER     NOT NULL,
    shares_after      NUMERIC(78, 0) NOT NULL,
    cost_basis_after  NUMERIC(78, 0) NOT NULL,
    realized_pnl_after NUMERIC(78, 0) NOT NULL DEFAULT 0,
    event_kind        SMALLINT    NOT NULL,  -- 0=deposit-claimed 1=withdraw-claimed 2=transfer-in 3=transfer-out
    tx_hash           BYTEA       NOT NULL,
    UNIQUE (account, vault_address, block_number, log_index)
);

CREATE INDEX IF NOT EXISTS idx_avp_account_time
    ON account_vault_positions (account, block_time DESC);

CREATE INDEX IF NOT EXISTS idx_avp_vault_time
    ON account_vault_positions (vault_address, block_time DESC);

-- Cursor for the live event ingestor: highest scanned block per scope.
-- One row per (chain, scope) so we can resume after a restart without
-- replaying or skipping. Scope is "vault-events" for VisionVault logs.
CREATE TABLE IF NOT EXISTS chain_event_cursors (
    scope        TEXT        NOT NULL,
    chain        TEXT        NOT NULL,
    last_block   BIGINT      NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scope, chain)
);
