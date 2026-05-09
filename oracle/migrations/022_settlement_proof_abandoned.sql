-- 022_settlement_proof_abandoned.sql
-- Mark settlement proofs whose on-chain window has closed as abandoned, so the
-- recovery loop stops hammering them. After Vision.sol's expiration cliff the
-- contract reverts with SettlementWindowClosed() permanently — there is no
-- decision left to make, only refunds.

ALTER TABLE vision_settlement_proofs
    ADD COLUMN IF NOT EXISTS abandoned BOOLEAN NOT NULL DEFAULT false;

-- Recreate the recovery-loop partial index to also exclude abandoned rows.
DROP INDEX IF EXISTS idx_settlement_unsubmitted;
CREATE INDEX idx_settlement_unsubmitted
    ON vision_settlement_proofs (submitted, retry_count)
    WHERE submitted = false AND abandoned = false AND players_json IS NOT NULL;
