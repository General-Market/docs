-- Vision dual-balance deposit/withdraw tables (Vision First Deposit feature)
-- Tracks cross-chain deposit and withdraw orders, and per-user dual balances.

-- Drop if re-running (dev-only, same pattern as 001)
DROP TABLE IF EXISTS vision_withdraw_orders CASCADE;
DROP TABLE IF EXISTS vision_deposit_orders CASCADE;
DROP TABLE IF EXISTS vision_user_balances CASCADE;
DROP TABLE IF EXISTS vision_last_resolved CASCADE;

-- Per-user dual balance: real (backed by L3 USDC) + virtual (backed by ArbBridgeCustody)
CREATE TABLE IF NOT EXISTS vision_user_balances (
    user_address TEXT PRIMARY KEY,
    real_balance TEXT NOT NULL DEFAULT '0',      -- uint256 as string, backed by L3 USDC
    virtual_balance TEXT NOT NULL DEFAULT '0',   -- uint256 as string, backed by ArbBridgeCustody
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cross-chain deposit orders (Arb → L3 Vision)
-- State machine: pending → credited_on_l3 → completed | pending → refunded
CREATE TABLE IF NOT EXISTS vision_deposit_orders (
    order_id BIGINT PRIMARY KEY,
    user_address TEXT NOT NULL,
    amount TEXT NOT NULL,                        -- 18-decimal internal format
    status TEXT NOT NULL DEFAULT 'pending',      -- pending/credited_on_l3/completed/refunded
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vision_deposit_orders_status
    ON vision_deposit_orders(status) WHERE status IN ('pending', 'credited_on_l3');

CREATE INDEX IF NOT EXISTS idx_vision_deposit_orders_user
    ON vision_deposit_orders(user_address);

-- Cross-chain withdraw orders (L3 Vision → Arb)
-- State machine: pending → completed
CREATE TABLE IF NOT EXISTS vision_withdraw_orders (
    withdraw_id BIGINT PRIMARY KEY,
    user_address TEXT NOT NULL,
    amount TEXT NOT NULL,                        -- 18-decimal internal format
    status TEXT NOT NULL DEFAULT 'pending',      -- pending/completed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vision_withdraw_orders_status
    ON vision_withdraw_orders(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_vision_withdraw_orders_user
    ON vision_withdraw_orders(user_address);

-- Last resolved tick per batch (crash recovery for tick scheduler)
CREATE TABLE IF NOT EXISTS vision_last_resolved (
    batch_id BIGINT PRIMARY KEY,
    last_tick_id BIGINT NOT NULL,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
