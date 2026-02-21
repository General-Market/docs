CREATE TABLE IF NOT EXISTS defillama_protocols (
    slug            TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    gecko_id        TEXT,
    symbol          TEXT,
    category        TEXT,
    chains          TEXT[],
    tvl             DOUBLE PRECISION,
    tvl_change_1d   DOUBLE PRECISION,
    tvl_change_7d   DOUBLE PRECISION,
    mcap            DOUBLE PRECISION,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dl_protocols_gecko ON defillama_protocols(gecko_id) WHERE gecko_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_protocols_category ON defillama_protocols(category);
