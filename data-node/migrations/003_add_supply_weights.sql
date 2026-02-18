ALTER TABLE itp_snapshots ADD COLUMN IF NOT EXISTS total_supply TEXT NOT NULL DEFAULT '0';
ALTER TABLE itp_snapshots ADD COLUMN IF NOT EXISTS weights TEXT[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_itp_valid_from
    ON itp_snapshots (itp_id, valid_from);
