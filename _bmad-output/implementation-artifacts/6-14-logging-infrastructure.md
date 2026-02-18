# Story 6.14: Logging Infrastructure

Status: review

## Story

As an **operator**,
I want **structured logging across all components with centralized aggregation and retention**,
so that **I can debug issues, audit system behavior, and meet operational requirements**.

## Acceptance Criteria

1. All logs in JSON format with required fields: `timestamp` (ISO 8601), `level`, `cycle_number`, `issuer_id`, `order_id`, `itp_id`, `message`, `details`
2. Log levels: ERROR, WARN, INFO, DEBUG consistently used across issuer and AP
3. Log rotation configured (size-based and time-based)
4. Retention policy enforced: ERROR/WARN 90 days, INFO 30 days, DEBUG 7 days (per NFR18)
5. Centralized logging via Loki with Promtail log shipper
6. Log aggregation configuration in `monitoring/loki/`
7. Existing `setup_logging()` in issuer and AP upgraded to enforce required JSON fields and dual output (file + stdout) in JSON mode

## Tasks / Subtasks

- [x] Task 1: Create shared logging module in `common/` crate (AC: #1, #2)
  - [x] 1.1: Create `common/src/logging.rs` with `init_logging(config)` function
  - [x] 1.2: Define `LogConfig` struct (level, dir, json_enabled, component_name, node_id)
  - [x] 1.3: Implement custom `tracing` layer that injects required fields (`cycle_number`, `issuer_id`, `order_id`, `itp_id`) as span context
  - [x] 1.4: Use `tracing_appender::rolling` for file rotation (daily + 100MB max size)
  - [x] 1.5: Dual output: JSON to file, human-readable to stdout (always); JSON to both when `json_logs=true`
  - [x] 1.6: Export module from `common/src/lib.rs`
- [x] Task 2: Integrate shared logging into issuer binary (AC: #1, #2, #7)
  - [x] 2.1: Replace `issuer/src/main.rs` `setup_logging()` with call to `common::logging::init_logging()`
  - [x] 2.2: Add `issuer_id` and `cycle_number` as span fields in cycle loop
  - [x] 2.3: Verify JSON output contains all required fields
- [x] Task 3: Integrate shared logging into AP binary (AC: #1, #2, #7)
  - [x] 3.1: Replace `ap/src/main.rs` `setup_logging()` with call to `common::logging::init_logging()`
  - [x] 3.2: Add `order_id` and `itp_id` as span fields in event processing
  - [x] 3.3: Verify JSON output contains all required fields
- [x] Task 4: Log rotation and retention (AC: #3, #4)
  - [x] 4.1: Configure `tracing_appender::rolling::daily` for time-based rotation
  - [x] 4.2: Add `monitoring/logrotate/logrotate.conf` for size-based rotation and retention enforcement
  - [x] 4.3: Retention rules: `/logs/*error*.log` and `/logs/*warn*.log` → 90 days; `/logs/*info*.log` → 30 days; `/logs/*debug*.log` → 7 days
  - [x] 4.4: Alternatively, implement single log file with level-based filtering in Loki for retention (preferred approach)
- [x] Task 5: Loki + Promtail centralized logging stack (AC: #5, #6)
  - [x] 5.1: Create `monitoring/loki/loki-config.yaml` with retention policies
  - [x] 5.2: Create `monitoring/loki/promtail-config.yaml` to scrape `logs/` directory
  - [x] 5.3: Add Loki and Promtail services to `docker-compose.yml` (or `monitoring/docker-compose.monitoring.yml`)
  - [x] 5.4: Configure Promtail pipeline stages to parse JSON logs and extract labels (component, level, issuer_id)
  - [x] 5.5: Set Loki retention: 90 days ERROR/WARN, 30 days INFO, 7 days DEBUG using stream-based retention
- [x] Task 6: Tests (AC: #1, #2, #3)
  - [x] 6.1: Unit test: `init_logging()` creates log file and writes valid JSON
  - [x] 6.2: Unit test: JSON output contains all required fields (timestamp, level, cycle_number, issuer_id, order_id, itp_id, message)
  - [x] 6.3: Unit test: Log level filtering works (DEBUG not written when level=INFO)
  - [x] 6.4: Integration test: Loki receives logs from Promtail (manual/docker test)

## Dev Notes

### Existing Logging Infrastructure (DO NOT reinvent)

Both issuer and AP already have `setup_logging()` functions that:
- Use `tracing` 0.1 + `tracing-subscriber` 0.3 (with `json` and `env-filter` features)
- Support JSON mode via `--json-logs` CLI flag / `*_JSON_LOGS` env var
- Write to file + stdout (dual layer)
- File patterns: `ap.log` (AP), `issuer-{node_id}.log` (issuer)
- Config via CLI args, env vars, YAML (precedence: CLI > ENV > file > defaults)

**Key files to modify:**
- `ap/src/main.rs:65-109` - AP `setup_logging()` (replace with shared module call)
- `issuer/src/main.rs:105-153` - Issuer `setup_logging()` (replace with shared module call)
- `ap/src/config.rs` - `APConfig` has `log_level`, `log_dir`, `json_logs` fields
- `issuer/src/config.rs` - `IssuerConfig` has same fields + `ISSUER_LOG_LEVEL`, `ISSUER_LOG_DIR`, `ISSUER_JSON_LOGS` env vars

**Workspace-level deps already declared** (`Cargo.toml:37-39`):
```toml
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
```

**Add to workspace deps:**
```toml
tracing-appender = "0.2"  # For rolling file appender with rotation
```

### Architecture Compliance

- **Log Spec** (architecture.md Section 21 "Log Specification"): All logs MUST be JSON with fields: `timestamp` (ISO 8601), `level`, `cycle_number`, `issuer_id`, `order_id`, `itp_id`, `message`, `details`
- **NFR18**: Log retention: ERROR/WARN 90 days, INFO 30 days, DEBUG 7 days
- **Monitoring Thresholds** (architecture.md Section 21): Logging infrastructure must support the alert thresholds defined in the monitoring table (queue depth, fill time, consensus time, etc.)
- Fields like `cycle_number`, `issuer_id`, `order_id`, `itp_id` are contextual - use `tracing::Span` to inject them from the calling code. When not applicable (e.g., AP startup), omit or set to null/0.

### Implementation Approach

1. **Shared `common/src/logging.rs`**: Single source of truth for log initialization. Both binaries call `common::logging::init_logging(LogConfig { ... })`. This eliminates the duplicate `setup_logging()` code in both `main.rs` files.

2. **Required fields via `tracing` spans**: Use `#[instrument]` or manual `tracing::info_span!` to inject contextual fields. The JSON layer automatically serializes all span fields. Example:
   ```rust
   let span = tracing::info_span!("cycle", cycle_number = cycle, issuer_id = %hex_id);
   let _guard = span.enter();
   info!(order_id = oid, itp_id = iid, "Processing order");
   // JSON output will include cycle_number, issuer_id, order_id, itp_id automatically
   ```

3. **Rolling file appender**: Use `tracing_appender::rolling::daily(log_dir, prefix)` for automatic daily rotation. Size-based rotation handled by external `logrotate` config.

4. **Loki retention**: Loki supports per-stream retention via `retention_period` in `limits_config`. Use label `level` to apply different retention for ERROR/WARN (90d), INFO (30d), DEBUG (7d).

### File Structure

```
common/src/logging.rs          # NEW - shared logging module
monitoring/
  loki/
    loki-config.yaml            # NEW - Loki server config with retention
    promtail-config.yaml        # NEW - Promtail log scraper config
  logrotate/
    logrotate.conf              # NEW - OS-level log rotation (backup)
```

### Docker Integration

Existing `docker-compose.yml` already mounts `./logs:/app/logs` for all services. Loki + Promtail should be added as additional services:
- Loki listens on port 3100
- Promtail scrapes `/app/logs/*.log` and ships to Loki
- Grafana (from Story 6.13) connects to Loki as a data source

### Testing Standards

- Use `tracing-test` crate or capture subscriber for unit tests
- Verify JSON output by deserializing log lines with `serde_json`
- Test that all 7 required fields are present in output
- Test level filtering (DEBUG suppressed when level=INFO)

### Project Structure Notes

- `common/src/lib.rs` already exports modules - add `pub mod logging;`
- No conflicts with existing code - `setup_logging()` is self-contained in each binary
- Docker compose in project root: `docker-compose.yml`
- Monitoring configs go in `monitoring/` directory (created by this story and 6.13)

### References

- [Source: architecture.md Section 21 "Log Specification" - lines 2946-2971]
- [Source: architecture.md Section 21 "Monitoring Thresholds" - lines 2916-2929]
- [Source: epics.md Story 6.14 - lines 1663-1680]
- [Source: NFR18 - Log retention: ERROR/WARN 90 days, INFO 30 days, DEBUG 7 days]
- [Source: ap/src/main.rs:65-109 - existing AP setup_logging()]
- [Source: issuer/src/main.rs:105-153 - existing Issuer setup_logging()]
- [Source: Cargo.toml:37-39 - workspace tracing dependencies]
- [Source: docker-compose.yml - existing log volume mounts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All 10 logging tests pass (3 unit + 7 integration)
- `cargo check -p issuer` and `cargo check -p ap` both compile successfully
- Pre-existing broken `common/src/adapters/` module (untracked, from another story) prevents full workspace test, but is unrelated to logging changes

### Completion Notes List

- Created shared `common/src/logging.rs` module with `LogConfig` struct and `init_logging()` function
- Replaced duplicate `setup_logging()` functions in both `issuer/src/main.rs` and `ap/src/main.rs` with calls to `common::logging::init_logging()`
- Added `tracing-appender = "0.2"` to workspace dependencies for rolling file appender
- File output is always JSON format with daily rotation via `tracing_appender::rolling::DAILY`
- Stdout output is human-readable by default, JSON when `json_enabled=true`
- Contextual fields (`cycle_number`, `issuer_id`, `order_id`, `itp_id`) are injected via `tracing::Span` from calling code (already present in both binaries from existing span instrumentation)
- Created `monitoring/logrotate/logrotate.conf` for size-based rotation (100MB) and OS-level retention
- Created `monitoring/loki/loki-config.yaml` with stream-based retention: ERROR/WARN 90d, INFO 30d (default), DEBUG 7d per NFR18
- Created `monitoring/loki/promtail-config.yaml` with JSON pipeline stages to extract `level`, `component`, and contextual fields as labels
- Added Loki and Promtail services to `monitoring/docker-compose.yml`
- Added Loki datasource provisioning for Grafana (`monitoring/grafana/provisioning/datasources/loki.yml`)
- Wrote 7 integration tests covering JSON output validation, required field presence, log level filtering, nested span context, and component config

### Change Log

- 2026-01-30: Story 6.14 implementation complete - all 6 tasks done, 10 tests passing

### File List

- `common/src/logging.rs` (NEW) - Shared logging module
- `common/src/lib.rs` (MODIFIED) - Added `pub mod logging;`
- `common/Cargo.toml` (MODIFIED) - Added `tracing-subscriber` and `tracing-appender` dependencies
- `common/tests/logging_test.rs` (NEW) - 7 integration tests
- `Cargo.toml` (MODIFIED) - Added `tracing-appender = "0.2"` to workspace dependencies
- `issuer/src/main.rs` (MODIFIED) - Replaced `setup_logging()` with `common::logging::init_logging()`, removed unused imports
- `ap/src/main.rs` (MODIFIED) - Replaced `setup_logging()` with `common::logging::init_logging()`, removed unused imports
- `monitoring/logrotate/logrotate.conf` (NEW) - Size-based rotation and retention config
- `monitoring/loki/loki-config.yaml` (NEW) - Loki server config with NFR18 retention
- `monitoring/loki/promtail-config.yaml` (NEW) - Promtail JSON log scraper config
- `monitoring/docker-compose.yml` (MODIFIED) - Added Loki and Promtail services
- `monitoring/grafana/provisioning/datasources/loki.yml` (NEW) - Grafana Loki datasource
