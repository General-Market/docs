-- Settlement proof aggregation table for round-based batches.
--
-- All oracles share this table. Each oracle signs the settlement hash
-- and UPSERTs its signature. The row accumulates signatures via
-- bitwise-OR on signer_bitmap and BLS point addition on bls_sig.
-- When popcount(signer_bitmap) >= quorum, the settlement is submitted on-chain.

CREATE TABLE IF NOT EXISTS vision_settlement_proofs (
    batch_id        BIGINT PRIMARY KEY,
    players_hash    TEXT NOT NULL,
    bls_sig         BYTEA NOT NULL DEFAULT '',
    signer_bitmap   BIGINT NOT NULL DEFAULT 0,
    submitted       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
