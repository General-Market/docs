-- Indexes for 1000 ITP scaling

-- Index for order status queries (pending/batched/filled lookups)
CREATE INDEX IF NOT EXISTS idx_trades_status_order ON trades (status, order_id DESC);

-- Index for user order lookups without LOWER() overhead
CREATE INDEX IF NOT EXISTS idx_trades_user_lower ON trades (LOWER(user_address), order_timestamp DESC);

-- User share balances — persisted by SharesUpdated events,
-- hydrated on reconnect. Source of truth when UserCache is evicted or data-node restarts.
CREATE TABLE IF NOT EXISTS user_shares (
    user_address TEXT NOT NULL,
    itp_id TEXT NOT NULL,
    shares TEXT NOT NULL DEFAULT '0',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_address, itp_id)
);
CREATE INDEX IF NOT EXISTS idx_user_shares_user ON user_shares (user_address);
