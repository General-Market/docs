CREATE INDEX IF NOT EXISTS idx_dl_history_cover
    ON defillama_protocol_history(slug, history_date)
    INCLUDE (metric_type, value);
