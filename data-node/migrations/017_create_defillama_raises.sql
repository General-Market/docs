CREATE TABLE IF NOT EXISTS defillama_raises (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    defillama_id    TEXT,
    round           TEXT,
    amount_m        DOUBLE PRECISION,
    valuation_m     DOUBLE PRECISION,
    raise_date      DATE,
    category        TEXT,
    chains          TEXT[],
    lead_investors  TEXT[],
    other_investors TEXT[],
    source_url      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dl_raises_defillama_id ON defillama_raises(defillama_id) WHERE defillama_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_raises_date ON defillama_raises(raise_date);

CREATE TABLE IF NOT EXISTS defillama_investors (
    investor_name   TEXT NOT NULL,
    raise_id        BIGINT NOT NULL REFERENCES defillama_raises(id) ON DELETE CASCADE,
    is_lead         BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (investor_name, raise_id)
);
CREATE INDEX IF NOT EXISTS idx_dl_investors_name ON defillama_investors(investor_name);
