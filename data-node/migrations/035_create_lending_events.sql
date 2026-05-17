-- Global Morpho event ledger. One row per loan-side event on the L3 Morpho
-- contract. Distinct from account_vault_positions (which tracks Vision vault
-- share-events for portfolio cost-basis). This table powers protocol-wide
-- aggregates such as the DTF Fills chart.
--
-- event_kind:
--   0 = Supply             (loan asset deposit into a market)
--   1 = Withdraw           (loan asset withdrawal from a market)
--   2 = Borrow             (loan asset borrow against collateral)
--   3 = Repay              (loan asset repay)
--   4 = SupplyCollateral   (collateral deposit, no loan-asset flow)
--   5 = WithdrawCollateral (collateral withdrawal, no loan-asset flow)
--
-- amount: raw uint256 amount as decimal string (decimals = WUSDC=6 for 0..3,
-- ITP=18 for 4..5). Keep raw — the API layer formats.

CREATE TABLE IF NOT EXISTS lending_events (
    id            BIGSERIAL    PRIMARY KEY,
    block_number  BIGINT       NOT NULL,
    block_time    TIMESTAMPTZ  NOT NULL,
    log_index     INTEGER      NOT NULL,
    event_kind    SMALLINT     NOT NULL,
    account       TEXT         NOT NULL,         -- 0x-prefixed lowercase hex
    market_id     TEXT         NOT NULL,         -- bytes32 0x-prefixed hex
    amount        NUMERIC(78, 0) NOT NULL,
    token         TEXT         NOT NULL,         -- "WUSDC" or "ITP"
    tx_hash       TEXT         NOT NULL,
    UNIQUE (block_number, log_index)
);

CREATE INDEX IF NOT EXISTS idx_lending_events_block_time
    ON lending_events (block_time DESC);

CREATE INDEX IF NOT EXISTS idx_lending_events_kind_time
    ON lending_events (event_kind, block_time DESC);

CREATE INDEX IF NOT EXISTS idx_lending_events_market
    ON lending_events (market_id, block_time DESC);
