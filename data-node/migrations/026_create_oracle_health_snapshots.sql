-- 026_create_issuer_health_snapshots.sql

CREATE TABLE issuer_health_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    node_id         INTEGER NOT NULL CHECK (node_id >= 0),
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- C5: Shared timestamp assigned by collector before polling loop.
    -- All nodes in the same poll cycle share the same poll_batch_ts.
    -- API GROUP BY uses this column, NOT fetched_at.
    poll_batch_ts   TIMESTAMPTZ NOT NULL,

    -- Health (validated to whitelist: healthy, degraded, unhealthy, unknown)
    status          TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),

    -- Consensus (counters only, no timing or in-progress state)
    consensus_rounds_total   BIGINT NOT NULL DEFAULT 0,
    consensus_success_total  BIGINT NOT NULL DEFAULT 0,
    consensus_failed_total   BIGINT NOT NULL DEFAULT 0,
    signatures_collected     BIGINT NOT NULL DEFAULT 0,
    last_consensus_time_ms   BIGINT NOT NULL DEFAULT 0,

    -- Orders
    orders_processed_last_60s BIGINT NOT NULL DEFAULT 0,
    pending_order_count       BIGINT NOT NULL DEFAULT 0,
    last_cycle_duration_ms    BIGINT NOT NULL DEFAULT 0,

    -- P2P (aggregate counters only — no security-sensitive counters)
    connected_peers          INTEGER NOT NULL DEFAULT 0,
    p2p_messages_received    BIGINT NOT NULL DEFAULT 0,
    p2p_messages_sent        BIGINT NOT NULL DEFAULT 0,
    p2p_wal_entries          BIGINT NOT NULL DEFAULT 0,

    -- Heartbeat (aggregate only)
    heartbeat_sent           BIGINT DEFAULT 0,
    heartbeat_received       BIGINT DEFAULT 0,
    peers_healthy            INTEGER DEFAULT 0,
    peers_unhealthy          INTEGER DEFAULT 0
);

-- C5: Primary query index — GROUP BY poll_batch_ts for aggregation
CREATE INDEX idx_issuer_health_batch_time
    ON issuer_health_snapshots (poll_batch_ts DESC);

CREATE INDEX idx_issuer_health_node_time
    ON issuer_health_snapshots (node_id, fetched_at DESC);
