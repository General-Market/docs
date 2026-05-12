-- 024_vision_settlement_bundles.sql
-- Single-aggregated-BLS bundles for settleBatchesSingle.
--
-- Each row aggregates BLS signatures from multiple oracles over the same
-- bundle hash (one signature covers K batches on-chain instead of K
-- per-batch signatures). Co-signing follows the same shared-DB pattern as
-- vision_settlement_proofs: each oracle UPSERTs its signature using
-- SELECT FOR UPDATE; the last oracle to reach quorum submits on-chain.
--
-- bundle_hash:    keccak256(chainid, vision, "SETTLE_BATCHES_SINGLE_V1",
--                            sorted batchIds, sorted payouts_hashes).
-- batch_ids:      JSONB array of the batch IDs in this bundle (sorted asc).
-- payouts_hashes: JSONB array of the per-batch keccak256(players, payouts).
--                 Stored so oracles arriving later can verify the bundle
--                 composition matches their own pending proofs.
-- bls_sig:        Aggregated BLS signature (G1 point).
-- signer_bitmap:  Bitmap of oracle indices that signed.
-- submitted:      True once settleBatchesSingle has been submitted on-chain.

CREATE TABLE IF NOT EXISTS vision_settlement_bundles (
    bundle_hash      CHAR(66)     PRIMARY KEY,
    batch_ids        JSONB        NOT NULL,
    payouts_hashes   JSONB        NOT NULL,
    bls_sig          BYTEA        NOT NULL,
    signer_bitmap    BIGINT       NOT NULL,
    submitted        BOOLEAN      NOT NULL DEFAULT false,
    abandoned        BOOLEAN      NOT NULL DEFAULT false,
    retry_count      INTEGER      NOT NULL DEFAULT 0,
    last_error       TEXT,
    last_retry_at    TIMESTAMPTZ,
    submitted_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_bundle_unsubmitted
    ON vision_settlement_bundles (submitted, abandoned, created_at)
    WHERE submitted = false AND abandoned = false;

-- Track which bundle (if any) a per-batch proof has been folded into. When
-- non-NULL, the per-batch retry sweep skips the row — the bundle owns it.
ALTER TABLE vision_settlement_proofs
    ADD COLUMN IF NOT EXISTS bundle_hash CHAR(66) REFERENCES vision_settlement_bundles(bundle_hash);

CREATE INDEX IF NOT EXISTS idx_settlement_proof_bundle
    ON vision_settlement_proofs (bundle_hash)
    WHERE bundle_hash IS NOT NULL;
