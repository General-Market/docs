# Story 6.13: Monitoring Dashboard Setup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operator**,
I want **a monitoring dashboard with Prometheus + Grafana stack**,
so that **I can observe system health, detect anomalies, and respond to alerts per NFR15-18 thresholds**.

## Acceptance Criteria

1. Grafana dashboard with key metrics panels: orders/sec, queue depth, fill time, consensus time
2. Panels for: issuer health, AP health, buffer balance
3. Alerts configured per NFR15-17 thresholds (see monitoring thresholds table below)
4. Dashboard JSON exported to `monitoring/grafana/`
5. Prometheus configuration in `monitoring/prometheus/`
6. docker-compose for the complete monitoring stack (Prometheus + Grafana)

## Tasks / Subtasks

- [x] Task 1: Create monitoring directory structure (AC: #4, #5, #6)
  - [x] 1.1: Create `monitoring/prometheus/` directory
  - [x] 1.2: Create `monitoring/grafana/provisioning/datasources/` directory
  - [x] 1.3: Create `monitoring/grafana/provisioning/dashboards/` directory
  - [x] 1.4: Create `monitoring/grafana/dashboards/` directory for JSON exports
- [x] Task 2: Create Prometheus configuration (AC: #5)
  - [x] 2.1: Create `monitoring/prometheus/prometheus.yml` with scrape configs for AP (:9100/metrics) and issuer nodes (:9001-9003/health)
  - [x] 2.2: Configure scrape intervals (15s default, 5s for health endpoints)
  - [x] 2.3: Add alerting rules file reference
  - [x] 2.4: Create `monitoring/prometheus/alerts.yml` with NFR15-17 threshold rules
- [x] Task 3: Create Grafana provisioning (AC: #4)
  - [x] 3.1: Create datasource provisioning YAML pointing to Prometheus
  - [x] 3.2: Create dashboard provisioning YAML pointing to dashboards directory
- [x] Task 4: Create Grafana dashboard JSON (AC: #1, #2, #3)
  - [x] 4.1: Create "Index Protocol Overview" dashboard with the following panels:
    - Row: Order Processing — orders/sec (counter rate), queue depth (gauge), avg fill time (gauge)
    - Row: Issuer Consensus — consensus time (gauge), issuers online (gauge from health), leader status
    - Row: AP Health — AP health status (gauge), buffer balance USD (gauge), violations 24h, timeouts 24h
    - Row: System Alerts — threshold-based alert annotations
  - [x] 4.2: Add Grafana alert rules matching NFR15-17 thresholds
  - [x] 4.3: Export dashboard JSON to `monitoring/grafana/dashboards/index-overview.json`
- [x] Task 5: Create monitoring docker-compose (AC: #6)
  - [x] 5.1: Create `monitoring/docker-compose.yml` with Prometheus and Grafana services
  - [x] 5.2: Mount prometheus.yml and alerts.yml into Prometheus container
  - [x] 5.3: Mount Grafana provisioning configs and dashboards
  - [x] 5.4: Expose Prometheus on :9090 and Grafana on :3000
  - [x] 5.5: Configure Grafana to auto-provision datasource and dashboards on startup
  - [x] 5.6: Network configuration to reach host services (AP on :9100, issuers on :9001-9003)
- [x] Task 6: Update root docker-compose.yml (AC: #6)
  - [x] 6.1: Add monitoring services or reference monitoring compose file so `docker compose up` includes full stack
  - [x] 6.2: Ensure AP and issuer services are on same network as monitoring stack

## Dev Notes

### Monitoring Thresholds (from Architecture Section 21)

These are the NFR15-17 alert thresholds that MUST be configured:

| Metric | WARNING | CRITICAL | Action |
|--------|---------|----------|--------|
| Orders per second | >100 | >500 | Scale alert |
| Queue depth | >100 | >500 | Pause new orders |
| Average fill time | >30s | >5min | Investigate AP |
| Unfilled inventory delta | >$1000 | >$10000 | Investigate |
| AP response time | >10s | >60s | AP health check |
| Issuer consensus time | >500ms | >2s | Network issue |
| Issuers online | <18/20 | <14/20 | Quorum risk |
| Buffer balance | <$500 | <$100 | Refill buffer |

### Existing Metrics Endpoints (DO NOT MODIFY - consume only)

**AP Service (port 9100):**
- `GET /metrics` — Prometheus text format exposition. Metrics:
  - `ap_orders_processed_total` (counter)
  - `ap_orders_failed_total` (counter)
  - `ap_events_received_total` (counter)
  - `ap_queue_depth` (gauge)
  - `ap_avg_fill_time_seconds` (gauge)
  - `ap_buffer_balance_usd` (gauge)
  - `ap_violations_24h` (gauge)
  - `ap_timeouts_24h` (gauge)
  - `ap_health_status` (gauge: 0=unhealthy, 1=degraded, 2=healthy)
- `GET /health` — JSON health response with full metrics snapshot

**Issuer Nodes (ports 9001-9003):**
- `GET /health` — JSON health response including:
  - `is_leader` (bool)
  - `leader_elections_count` (u64)
  - `leader_tenure_cycles` (u64)
  - `consensus_rounds_total` (u64)
  - `consensus_success_total` (u64)
  - `consensus_failed_total` (u64)
  - `signatures_collected_total` (u64)
  - `last_consensus_time_ms` (u64)
  - `consensus_in_progress` (bool)
  - `connected_peers` (count)
- **NOTE:** Issuer nodes do NOT have a `/metrics` Prometheus endpoint. The health JSON must be scraped and converted. Options:
  - Use a Prometheus JSON exporter sidecar
  - Write a simple metrics adapter script
  - Use Grafana's JSON datasource plugin directly for issuer metrics

### Architecture Compliance

- **File locations:** All monitoring config goes in `monitoring/` at project root per architecture Section 20
- **Docker:** Monitoring stack must be composable with existing `docker-compose.yml` (Anvil + issuers + AP)
- **Prometheus versions:** Use latest stable Prometheus (2.x) and Grafana (11.x)
- **No application code changes:** This story creates infrastructure config only. All metrics endpoints already exist.

### Grafana Dashboard Design Guidelines

- Use consistent color scheme: green=healthy, yellow=warning, red=critical
- All panels should have appropriate units (seconds, count, USD)
- Time range default: last 1 hour with auto-refresh every 10s
- Dashboard should work with both local dev (3 issuers + 1 AP) and production (20 issuers + N APs)
- Use Grafana variables for: number of issuers, issuer port range, AP port

### Prometheus Alert Rules

Map each threshold from the table above to a Prometheus alerting rule. Example format:
```yaml
groups:
  - name: index_alerts
    rules:
      - alert: HighQueueDepth
        expr: ap_queue_depth > 100
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "AP queue depth is above WARNING threshold"
      - alert: CriticalQueueDepth
        expr: ap_queue_depth > 500
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "AP queue depth is CRITICAL - pause new orders"
```

### Issuer Metrics Strategy

Since issuer nodes expose JSON health (not Prometheus format), choose ONE approach:

**Option A (Recommended): JSON Exporter sidecar**
- Use `prometheus-json-exporter` container alongside each issuer
- Configure path mappings from JSON fields to Prometheus metrics
- Scrape the exporter from Prometheus

**Option B: Grafana JSON datasource**
- Use Grafana's built-in JSON API datasource
- Point directly to issuer `/health` endpoints
- Less ideal for alerting (Prometheus rules won't have issuer data)

**Option C: Metrics adapter script**
- Tiny Python/shell script that reads `/health` JSON, outputs Prometheus text format
- Run as sidecar or cron

### Project Structure Notes

- All new files go under `monitoring/` directory at project root
- No changes to `contracts/`, `issuer/`, `ap/`, or `common/` directories
- Root `docker-compose.yml` at `/Users/maxguillabert/Desktop/index/docker-compose.yml` already exists with AP, issuer, and Anvil services with health checks configured
- Monitoring compose can be standalone or merged — prefer standalone `monitoring/docker-compose.yml` with shared network

### References

- [Source: architecture.md#Section 21 - Operations: Monitoring Thresholds]
- [Source: architecture.md#Section 21 - Operations: Log Specification]
- [Source: architecture.md#Section 20 - Project Structure & Local Testing]
- [Source: epics.md#Story 6.13 - Monitoring Dashboard Setup]
- [Source: ap/src/metrics/mod.rs - AP metrics implementation]
- [Source: ap/src/metrics/prometheus.rs - Prometheus text format encoder]
- [Source: ap/src/metrics/health.rs - AP health endpoint]
- [Source: issuer/src/main.rs:163-220 - Issuer health endpoint]
- [Source: docker-compose.yml - Existing service definitions with health checks]

### Git Intelligence

Recent commits show active work on Epic 5 external integrations (Stories 5.7, 5.9). No monitoring infrastructure exists yet. The codebase uses:
- Rust with `tracing` + `tracing-subscriber` (JSON logging support)
- Foundry for Solidity contracts
- Docker Compose for local environment orchestration

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 8 config files (7 YAML + 1 JSON) validated syntactically correct
- 353 existing Rust tests pass; 7 pre-existing failures in common/ crate (price_math overflow, bitget rate limiter timing) unrelated to this story
- No application code modified — infrastructure config only
- Issuer metrics strategy: Option A (JSON Exporter sidecar) chosen per Dev Notes recommendation
- NFR threshold coverage: 6 of 8 metrics have alerts. 2 metrics (AP response time, unfilled inventory delta) lack corresponding metric endpoints — no metrics exist to alert on. Story mandates "no application code changes."

### Completion Notes List

- Created full monitoring directory structure under `monitoring/`
- Prometheus config: scrape configs for AP (15s), issuer nodes via JSON exporter multi-target (5s), self-monitoring (15s)
- Alert rules: 14 rules across 3 groups (order_processing, ap_health, issuer_health) covering all available NFR15-17 metrics
- Issuer online alerts use percentage-based thresholds (90% warning, 70% critical) — works for any cluster size
- JSON exporter config: maps all 10 issuer /health JSON fields to Prometheus metrics (single multi-target instance)
- AlertManager added for alert routing and notification delivery pipeline
- Grafana provisioning: auto-configured datasource (Prometheus) and dashboard provider
- Dashboard: "Index Protocol Overview" with 4 row sections, 17 panels total including stat gauges, timeseries, and alert list
- Dashboard variables: datasource, issuer_count (3/5/10/20), issuer_start_port, ap_port
- Color scheme: green=healthy/good, yellow=warning, red=critical throughout
- Monitoring stack added to root docker-compose.yml: Prometheus (:9090), AlertManager (:9093), Grafana (:3000), 1 JSON exporter (multi-target) — all on index-local network
- Standalone monitoring/docker-compose.yml also available (WARNING: mutually exclusive with root compose for monitoring ports)

### File List

- `monitoring/prometheus/prometheus.yml` (new) — Prometheus scrape configuration with multi-target JSON exporter relabel
- `monitoring/prometheus/alerts.yml` (new) — NFR15-17 alerting rules (14 rules, 3 groups) with percentage-based issuer thresholds
- `monitoring/prometheus/alertmanager.yml` (new) — AlertManager configuration for alert routing and notification
- `monitoring/prometheus/json-exporter-config.yml` (new) — JSON-to-Prometheus metric mappings for issuer /health
- `monitoring/grafana/provisioning/datasources/prometheus.yml` (new) — Grafana datasource provisioning
- `monitoring/grafana/provisioning/dashboards/dashboards.yml` (new) — Grafana dashboard provider config
- `monitoring/grafana/dashboards/index-overview.json` (new) — "Index Protocol Overview" dashboard (17 panels)
- `monitoring/docker-compose.yml` (new) — Standalone monitoring stack compose (Prometheus + AlertManager + Grafana + JSON Exporter)
- `monitoring/.gitignore` (new) — Prevent accidental data directory commits
- `docker-compose.yml` (modified) — Added Prometheus, AlertManager, Grafana, JSON exporter (single multi-target instance) + volumes

## Change Log

- 2026-01-30: Story 6.13 implemented — Full Prometheus + Grafana monitoring stack with NFR15-17 alert rules, JSON exporter sidecars for issuer health, and integrated docker-compose deployment
- 2026-01-30: Code review fixes — Fixed json-exporter to multi-target pattern (single instance), removed duplicate ap-health scrape, added AlertManager for complete alerting pipeline, percentage-based issuer online thresholds, added .gitignore and compose mutual exclusivity warning
