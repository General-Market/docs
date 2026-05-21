-- Asset-scoped settlement lookups (e.g. the /vision/asset/<src>/<asset>/settlements
-- endpoint) need to find rows where outcome_summary has a specific top-level
-- key. The existing GIN index uses jsonb_path_ops, which only accelerates
-- containment (@>) — it cannot serve the `?` (key exists) operator.
-- Without this second index, those queries fall back to a Bitmap Index Scan
-- on source_id followed by a JSONB filter on every row, which becomes
-- pathological for sparse assets (no early termination at LIMIT) and
-- multiplies oracle latency from ~10ms to >25s on hot defi assets.
--
-- The default jsonb_ops opclass supports `?`, `?|`, `?&`, `@>`. We keep the
-- existing jsonb_path_ops index for containment queries elsewhere — the two
-- coexist without conflict.
CREATE INDEX IF NOT EXISTS idx_vision_settlements_outcome_keys
  ON vision_settlements
  USING GIN (outcome_summary);
