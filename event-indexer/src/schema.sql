-- Prediction-market event tables. Each row maps 1:1 to an Anchor event
-- emitted by the program. The transaction signature is the primary key —
-- re-indexing the same log stream is idempotent.
--
-- The schema name is substituted at runtime from POSTGRES_SCHEMA. The
-- literal `__SCHEMA__` token is replaced before execution.

CREATE SCHEMA IF NOT EXISTS __SCHEMA__;

-- Raw tx metadata, one row per signature we've seen. Lets queries join
-- without repeating slot/block_time on every event table.
CREATE TABLE IF NOT EXISTS __SCHEMA__.transactions (
    signature       TEXT PRIMARY KEY,
    slot            BIGINT       NOT NULL,
    block_time      BIGINT,
    observed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_slot_idx
    ON __SCHEMA__.transactions (slot);

-- MarketInstantiated(market, source_id, close_time, settlement_time,
--                    threshold_bps, creator)
CREATE TABLE IF NOT EXISTS __SCHEMA__.market_instantiated (
    signature        TEXT         PRIMARY KEY,
    slot             BIGINT       NOT NULL,
    block_time       BIGINT,
    log_index        INTEGER      NOT NULL,
    market           TEXT         NOT NULL,
    source_id        BIGINT       NOT NULL,
    close_time       BIGINT       NOT NULL,
    settlement_time  BIGINT       NOT NULL,
    threshold_bps    INTEGER      NOT NULL,
    creator          TEXT         NOT NULL
);

CREATE INDEX IF NOT EXISTS market_instantiated_market_idx
    ON __SCHEMA__.market_instantiated (market);
CREATE INDEX IF NOT EXISTS market_instantiated_creator_idx
    ON __SCHEMA__.market_instantiated (creator);

-- BetPlaced(market, owner, side, amount)
CREATE TABLE IF NOT EXISTS __SCHEMA__.bet_placed (
    signature   TEXT    PRIMARY KEY,
    slot        BIGINT  NOT NULL,
    block_time  BIGINT,
    log_index   INTEGER NOT NULL,
    market      TEXT    NOT NULL,
    owner       TEXT    NOT NULL,
    side        SMALLINT NOT NULL,       -- 0 = YES, 1 = NO
    amount      NUMERIC(40, 0) NOT NULL  -- u64, widened to fit without loss
);

CREATE INDEX IF NOT EXISTS bet_placed_market_idx ON __SCHEMA__.bet_placed (market);
CREATE INDEX IF NOT EXISTS bet_placed_owner_idx  ON __SCHEMA__.bet_placed (owner);
CREATE INDEX IF NOT EXISTS bet_placed_slot_idx   ON __SCHEMA__.bet_placed (slot DESC);

-- BetExited(market, owner, side, amount)
CREATE TABLE IF NOT EXISTS __SCHEMA__.bet_exited (
    signature   TEXT    PRIMARY KEY,
    slot        BIGINT  NOT NULL,
    block_time  BIGINT,
    log_index   INTEGER NOT NULL,
    market      TEXT    NOT NULL,
    owner       TEXT    NOT NULL,
    side        SMALLINT NOT NULL,
    amount      NUMERIC(40, 0) NOT NULL
);

CREATE INDEX IF NOT EXISTS bet_exited_market_idx ON __SCHEMA__.bet_exited (market);
CREATE INDEX IF NOT EXISTS bet_exited_owner_idx  ON __SCHEMA__.bet_exited (owner);

-- MarketClosed(market, baseline_price)
CREATE TABLE IF NOT EXISTS __SCHEMA__.market_closed (
    signature       TEXT PRIMARY KEY,
    slot            BIGINT NOT NULL,
    block_time      BIGINT,
    log_index       INTEGER NOT NULL,
    market          TEXT   NOT NULL,
    baseline_price  NUMERIC(80, 0) NOT NULL  -- u128
);

CREATE INDEX IF NOT EXISTS market_closed_market_idx ON __SCHEMA__.market_closed (market);

-- MarketResolved(market, baseline_price, final_price, outcome_yes, force_resolved)
CREATE TABLE IF NOT EXISTS __SCHEMA__.market_resolved (
    signature        TEXT PRIMARY KEY,
    slot             BIGINT NOT NULL,
    block_time       BIGINT,
    log_index        INTEGER NOT NULL,
    market           TEXT NOT NULL,
    baseline_price   NUMERIC(80, 0) NOT NULL,
    final_price      NUMERIC(80, 0) NOT NULL,
    outcome_yes      BOOLEAN NOT NULL,
    force_resolved   BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS market_resolved_market_idx ON __SCHEMA__.market_resolved (market);

-- Claimed(market, owner, net, fee, stranded)
CREATE TABLE IF NOT EXISTS __SCHEMA__.claimed (
    signature   TEXT PRIMARY KEY,
    slot        BIGINT NOT NULL,
    block_time  BIGINT,
    log_index   INTEGER NOT NULL,
    market      TEXT   NOT NULL,
    owner       TEXT   NOT NULL,
    net         NUMERIC(40, 0) NOT NULL,
    fee         NUMERIC(40, 0) NOT NULL,
    stranded    BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS claimed_market_idx ON __SCHEMA__.claimed (market);
CREATE INDEX IF NOT EXISTS claimed_owner_idx  ON __SCHEMA__.claimed (owner);

-- Backfill cursor. One row, one pointer. The newest signature we've
-- durably written to Postgres. `getSignaturesForAddress(.., { until: cursor })`
-- on reconnect reconciles whatever the websocket missed.
--
-- A check constraint pins id to 1 so the table can never grow past one row —
-- simpler than enforcing it in application code.
CREATE TABLE IF NOT EXISTS __SCHEMA__.indexer_cursor (
    id             SMALLINT    PRIMARY KEY CHECK (id = 1),
    tx_signature   TEXT        NOT NULL,
    slot           BIGINT      NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Postgres LISTEN/NOTIFY channel for the SSE route. Notifies fire on
-- inserts the frontend cares about — bet_placed, market_resolved,
-- claimed. The payload is the signature; consumers re-query for detail.
CREATE OR REPLACE FUNCTION __SCHEMA__.notify_event() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(TG_ARGV[0], NEW.signature);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bet_placed_notify ON __SCHEMA__.bet_placed;
CREATE TRIGGER bet_placed_notify
    AFTER INSERT ON __SCHEMA__.bet_placed
    FOR EACH ROW EXECUTE FUNCTION __SCHEMA__.notify_event('pm_bet_placed');

DROP TRIGGER IF EXISTS market_resolved_notify ON __SCHEMA__.market_resolved;
CREATE TRIGGER market_resolved_notify
    AFTER INSERT ON __SCHEMA__.market_resolved
    FOR EACH ROW EXECUTE FUNCTION __SCHEMA__.notify_event('pm_market_resolved');

DROP TRIGGER IF EXISTS claimed_notify ON __SCHEMA__.claimed;
CREATE TRIGGER claimed_notify
    AFTER INSERT ON __SCHEMA__.claimed
    FOR EACH ROW EXECUTE FUNCTION __SCHEMA__.notify_event('pm_claimed');
