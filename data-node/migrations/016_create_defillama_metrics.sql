CREATE TABLE IF NOT EXISTS defillama_protocol_metrics (
    slug            TEXT NOT NULL REFERENCES defillama_protocols(slug) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    metric_type     TEXT NOT NULL,
    value_24h       DOUBLE PRECISION,
    value_7d        DOUBLE PRECISION,
    value_30d       DOUBLE PRECISION,
    PRIMARY KEY (slug, snapshot_date, metric_type)
);
CREATE INDEX IF NOT EXISTS idx_dl_metrics_type_date ON defillama_protocol_metrics(metric_type, snapshot_date);

CREATE TABLE IF NOT EXISTS defillama_protocol_history (
    slug            TEXT NOT NULL REFERENCES defillama_protocols(slug) ON DELETE CASCADE,
    history_date    DATE NOT NULL,
    metric_type     TEXT NOT NULL,
    value           DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (slug, history_date, metric_type)
);
CREATE INDEX IF NOT EXISTS idx_dl_history_slug_type ON defillama_protocol_history(slug, metric_type, history_date);

CREATE TABLE IF NOT EXISTS defillama_yield_pools (
    pool_id         TEXT PRIMARY KEY,
    chain           TEXT NOT NULL,
    project         TEXT NOT NULL,
    symbol          TEXT,
    tvl_usd         DOUBLE PRECISION,
    apy             DOUBLE PRECISION,
    apy_base        DOUBLE PRECISION,
    apy_reward      DOUBLE PRECISION,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dl_yields_project ON defillama_yield_pools(project);

CREATE TABLE IF NOT EXISTS defillama_backfill_progress (
    slug            TEXT NOT NULL,
    metric_type     TEXT NOT NULL,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rows_inserted   BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (slug, metric_type)
);
