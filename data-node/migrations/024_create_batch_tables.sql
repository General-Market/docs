-- Recommended batch configs computed by BatchEngine
CREATE TABLE IF NOT EXISTS batch_configs (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    config_hash     BYTEA NOT NULL,          -- keccak256 of ABI-encoded config
    tick_duration_secs INTEGER NOT NULL,
    lock_offset_secs INTEGER NOT NULL,
    markets         JSONB NOT NULL,          -- [{asset_id, resolution_type, threshold_bps}]
    asset_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_configs_source ON batch_configs (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_configs_hash ON batch_configs (config_hash);

-- Settlement history per asset for threshold computation
CREATE TABLE IF NOT EXISTS batch_settlements (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    asset_id        TEXT NOT NULL,
    config_hash     BYTEA NOT NULL,          -- which batch config this settled under
    start_price     NUMERIC NOT NULL,
    end_price       NUMERIC NOT NULL,
    change_pct      NUMERIC NOT NULL,        -- (end - start) / start * 100
    settled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_settlements_asset
    ON batch_settlements (source_id, asset_id, settled_at DESC);

-- BLS-signed batch configs (persisted for crash recovery)
CREATE TABLE IF NOT EXISTS signed_batch_configs (
    id              BIGSERIAL PRIMARY KEY,
    source_id       TEXT NOT NULL,
    config_hash     BYTEA NOT NULL,
    config_json     JSONB NOT NULL,          -- full config for serving
    bls_signature   BYTEA NOT NULL,
    signers_bitmask BIGINT NOT NULL,
    reference_nonce BIGINT NOT NULL,
    tick_duration_secs INTEGER NOT NULL,
    lock_offset_secs INTEGER NOT NULL,
    signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, config_hash)
);

CREATE INDEX IF NOT EXISTS idx_signed_batch_source ON signed_batch_configs (source_id, signed_at DESC);

-- Vision tick scheduler crash recovery: last resolved tick per batch
CREATE TABLE IF NOT EXISTS vision_last_resolved (
    batch_id        BIGINT PRIMARY KEY,
    last_tick_id    BIGINT NOT NULL,
    resolved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vision reference prices crash recovery
CREATE TABLE IF NOT EXISTS vision_reference_prices (
    batch_id        BIGINT NOT NULL,
    market_id       BYTEA NOT NULL,           -- H256
    price           NUMERIC NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, market_id)
);
