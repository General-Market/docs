-- FK indexes on simulation child tables to speed up CASCADE DELETE
-- Without these, DELETE FROM sim_runs does sequential scans on child tables.
CREATE INDEX IF NOT EXISTS idx_sim_trades_run_id ON sim_trades(sim_run_id);
CREATE INDEX IF NOT EXISTS idx_sim_nav_series_run_id ON sim_nav_series(sim_run_id);
CREATE INDEX IF NOT EXISTS idx_sim_holdings_run_id ON sim_holdings(sim_run_id);
