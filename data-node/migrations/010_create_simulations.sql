-- Simulation backtester tables
CREATE TABLE IF NOT EXISTS sim_runs (
    id         BIGSERIAL PRIMARY KEY,
    category_id TEXT NOT NULL,
    top_n      INT NOT NULL,
    weighting  TEXT NOT NULL,
    rebalance_days INT NOT NULL,
    start_date DATE,
    end_date   DATE,
    total_return_pct  FLOAT8,
    annualized_return FLOAT8,
    max_drawdown_pct  FLOAT8,
    sharpe_ratio      FLOAT8,
    base_fee_pct      FLOAT8 NOT NULL DEFAULT 0.1,
    spread_multiplier FLOAT8 NOT NULL DEFAULT 1.0,
    total_fees_pct    FLOAT8,
    total_trades      INT,
    total_rebalances  INT,
    total_delistings  INT,
    computed_at       TIMESTAMPTZ DEFAULT NOW(),
    duration_ms       INT
);

-- Unique constraint on config params (use DO NOTHING pattern)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_runs_config
    ON sim_runs (category_id, top_n, weighting, rebalance_days, base_fee_pct, spread_multiplier);

CREATE TABLE IF NOT EXISTS sim_nav_series (
    sim_run_id BIGINT NOT NULL REFERENCES sim_runs(id) ON DELETE CASCADE,
    nav_date   DATE NOT NULL,
    nav        FLOAT8 NOT NULL,
    drawdown_pct FLOAT8 NOT NULL DEFAULT 0.0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_nav_series
    ON sim_nav_series (sim_run_id, nav_date);

CREATE TABLE IF NOT EXISTS sim_holdings (
    sim_run_id     BIGINT NOT NULL REFERENCES sim_runs(id) ON DELETE CASCADE,
    rebalance_date DATE NOT NULL,
    coin_id        TEXT NOT NULL,
    symbol         TEXT NOT NULL,
    weight         FLOAT8 NOT NULL,
    quantity       FLOAT8 NOT NULL,
    price_usd      FLOAT8 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_holdings
    ON sim_holdings (sim_run_id, rebalance_date, coin_id);

CREATE TABLE IF NOT EXISTS sim_trades (
    sim_run_id BIGINT NOT NULL REFERENCES sim_runs(id) ON DELETE CASCADE,
    trade_date DATE NOT NULL,
    coin_id    TEXT NOT NULL,
    side       TEXT NOT NULL,
    quantity   FLOAT8 NOT NULL,
    price_usd  FLOAT8 NOT NULL,
    fee_pct    FLOAT8 NOT NULL,
    fee_usd    FLOAT8 NOT NULL,
    reason     TEXT
);
