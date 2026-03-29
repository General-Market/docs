-- 016_settlement_proof_payloads.sql
-- Store settlement payloads alongside BLS proofs so failed on-chain
-- submissions can be retried without recomputing resolution.
--
-- players_json: JSON array of player addresses (hex strings, sorted ascending)
-- payouts_json: JSON array of payout amounts (decimal strings, 18-dec USDC)
-- retry_count:  how many times the recovery loop has attempted resubmission

ALTER TABLE vision_settlement_proofs
    ADD COLUMN IF NOT EXISTS players_json JSONB,
    ADD COLUMN IF NOT EXISTS payouts_json JSONB,
    ADD COLUMN IF NOT EXISTS retry_count  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error   TEXT;

-- Index for the recovery loop: find unsubmitted proofs with stored payloads
CREATE INDEX IF NOT EXISTS idx_settlement_unsubmitted
    ON vision_settlement_proofs (submitted, retry_count)
    WHERE submitted = false AND players_json IS NOT NULL;
