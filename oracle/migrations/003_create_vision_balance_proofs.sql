-- BLS-signed balance proofs, generated at tick end and stored for immediate serving.
-- Survives oracle restarts — no need to re-generate proofs for previously resolved ticks.

CREATE TABLE IF NOT EXISTS vision_balance_proofs (
    batch_id        BIGINT NOT NULL,
    player          TEXT NOT NULL,
    tick_id         BIGINT NOT NULL,
    balance         TEXT NOT NULL,              -- uint256 as decimal string
    bls_sig         BYTEA NOT NULL,             -- BLS G1 signature (64 bytes)
    signer_bitmap   TEXT NOT NULL,              -- uint256 bitmask as decimal string
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, player)
);

CREATE INDEX IF NOT EXISTS idx_vision_balance_proofs_player
    ON vision_balance_proofs(player);
