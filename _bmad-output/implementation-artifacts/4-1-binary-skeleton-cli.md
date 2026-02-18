# Story 4.1: Binary Skeleton & CLI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **AP operator**,
I want **an AP binary with CLI args and config**,
So that **I can start and configure the AP service**.

## Acceptance Criteria

1. `ap --help` shows available options
2. `--port <PORT>` sets API listen port (default 9100)
3. `--rpc <URL>` sets chain RPC endpoint (default http://localhost:8545)
4. `--config <PATH>` loads config from YAML/TOML file
5. Config file supports: port, rpc_url, bitget_api_key, bitget_api_secret, mock_bitget, log_level, log_dir, json_logs
6. Environment variables override config (AP_PORT, BITGET_API_KEY, etc.)
7. Graceful shutdown on SIGTERM/SIGINT
8. Version command shows build info

## Tasks / Subtasks

- [x] Task 1: Add YAML/TOML config file support (AC: #4, #5)
  - [x] 1.1 Add `serde_yaml` dependency to ap/Cargo.toml for YAML parsing
  - [x] 1.2 Create `APConfig` struct in `ap/src/config.rs`
  - [x] 1.3 Implement config file loading from `--config` path
  - [x] 1.4 Support fields: port, rpc_url, bitget_api_key, bitget_api_secret, mock_bitget, log_level, log_dir, json_logs
  - [x] 1.5 Merge CLI args with config (CLI takes precedence)

- [x] Task 2: Add environment variable override support (AC: #6)
  - [x] 2.1 Define env var names: AP_PORT, AP_RPC_URL, BITGET_API_KEY, BITGET_API_SECRET, AP_LOG_LEVEL, AP_LOG_DIR
  - [x] 2.2 Implement env var parsing in config resolution chain
  - [x] 2.3 Priority: CLI > ENV > Config file > Defaults

- [x] Task 3: Verify existing CLI functionality (AC: #1-3, #7, #8)
  - [x] 3.1 Run `ap --help` and verify output
  - [x] 3.2 Run `ap --version` and verify output
  - [x] 3.3 Test `--port` with custom value
  - [x] 3.4 Test graceful shutdown with Ctrl+C and SIGTERM
  - [x] 3.5 Test `--mock-bitget` flag enables mock mode

- [x] Task 4: Add unit tests for config resolution (AC: #4, #5, #6)
  - [x] 4.1 Test config file parsing (valid YAML)
  - [x] 4.2 Test env var override precedence
  - [x] 4.3 Test CLI override precedence
  - [x] 4.4 Test missing optional fields use defaults
  - [x] 4.5 Test sensitive fields (API keys) don't log in plain text

## Dev Notes

### Architecture Compliance

- **Technology Stack**: Rust binary using clap for CLI, tokio for async runtime [Source: architecture.md#4-technology-stack]
- **Project Structure**: `ap/` crate in workspace, binary at `ap/src/main.rs` [Source: architecture.md#20-project-structure--local-testing]
- **Dependencies**: Use workspace deps (`clap`, `serde`, `tokio`, `tracing`)
- **Pattern**: Configuration layering pattern (CLI > Env > Config > Defaults)

### Existing Implementation Status

The AP binary skeleton **already exists** from Epic 1 with:
- ✅ CLI args parsing via clap (`--port`, `--rpc`, `--mock-bitget`, `--config`, `--log-level`, `--log-dir`, `--json-logs`)
- ✅ Graceful shutdown handling (SIGTERM/SIGINT)
- ✅ Version command via `env!("CARGO_PKG_VERSION")`
- ✅ JSON logging support with tracing
- ✅ Health check endpoint on the API port (returns JSON status)
- ✅ Integration with mock components from common crate (MockChain, MockBitget)
- ✅ Main event loop with heartbeat logging

**CRITICAL: The AP binary is already 80% complete from Epic 1. This story completes the remaining 20%.**

### Missing Implementation

The following items need to be added:
1. **Config file loading**: The `--config` flag exists but doesn't load a file yet
2. **Environment variable support**: Not yet implemented
3. **APConfig struct**: Need `APConfig` with all fields including Bitget credentials
4. **Config resolution chain**: CLI > Env > Config > Defaults
5. **Credential handling**: Secure handling of API keys (don't log in plain text)

### Technical Requirements

- **Config file format**: YAML preferred (consistent with BMAD workflows and issuer)
- **Config fields**:
  ```yaml
  port: 9100
  rpc_url: "http://localhost:8545"
  mock_bitget: true
  bitget_api_key: ""      # Empty for mock mode
  bitget_api_secret: ""   # Empty for mock mode
  log_level: "info"
  log_dir: "./logs"
  json_logs: false
  ```

### Library/Framework Requirements

- **clap 4.x**: Already in workspace deps - `derive` feature for Args (ALREADY USED)
- **serde_yaml**: Add to ap/Cargo.toml for YAML config parsing (NEW)
- **serde**: Already in workspace deps (ALREADY USED)
- **dotenvy** (optional): For .env file support if desired

### File Structure Requirements

```
ap/
├── Cargo.toml           # Add serde_yaml dependency
└── src/
    ├── main.rs          # Entry point, CLI parsing (EXISTS - extensive)
    ├── lib.rs           # Public exports (EXISTS - minimal)
    ├── config.rs        # NEW - APConfig struct and loading
    └── error.rs         # NEW - Error types for config loading
```

### Testing Requirements

- **Unit tests**: Config parsing and resolution
- **Integration tests**: Full binary startup with config file
- **Test command**: `cargo test -p ap`
- **Security test**: Verify API keys not logged in plain text

### AP Service Architecture Context

Per architecture.md Section 3:
- AP/Keeper monitors blockchain for `TradeRequest` events
- Executes trades on CEX (Bitget)
- Monitors `WithdrawalRequest` events
- **NO direct communication with issuers** - all via blockchain
- AP has Bitget trade permissions, issuers only have read-only Bitget API

### Communication Model (CRITICAL)

```
Issuers ──── NO P2P ──── AP

Both read/write to blockchain:
- TradeRequest events (issuers emit, AP reads)
- FillConfirmation events (issuers emit after verifying Bitget)
- AP does NOT send data to issuers directly
```
[Source: architecture.md#3-actors--roles]

### Monitoring Thresholds (For Future Stories)

| Metric | WARNING | CRITICAL |
|--------|---------|----------|
| Queue depth | >100 | >500 |
| AP response time | >10s | >60s |
| Buffer balance | <$500 | <$100 |
[Source: architecture.md#21-operations]

### Project Structure Notes

- Alignment: Binary is in `ap/` crate as specified in architecture
- Naming: Binary name is `ap` (matches architecture start.sh example)
- Workspace: Uses workspace dependencies for consistency
- Pattern: Follow same config pattern as issuer (story 3-1) for consistency

### Epic 4 Context

This is **Story 4.1** - the first story in Epic 4 (AP/Keeper Service). All 9 stories in Epic 4 Wave 1 can run in parallel:
- 4.1 Binary Skeleton & CLI (this story)
- 4.2 Event Monitor
- 4.3 Order Queue Manager
- 4.4 Fill Reporter
- 4.5 Buffer Manager
- 4.6 Limit Order Enforcer
- 4.7 Timeout Handler
- 4.8 Mock Bitget Client
- 4.9 AP Metrics & Health

The binary skeleton must support future stories by:
- Providing clean config structure for Bitget credentials
- Establishing logging patterns consistent with issuer
- Setting up main loop structure for event processing

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#3-actors--roles] - AP/Keeper communication model
- [Source: _bmad-output/planning-artifacts/architecture.md#9-ap-buffer-strategy] - AP buffer management
- [Source: _bmad-output/planning-artifacts/architecture.md#20-project-structure--local-testing] - Project structure and start.sh
- [Source: _bmad-output/planning-artifacts/architecture.md#21-operations] - Monitoring thresholds
- [Source: _bmad-output/planning-artifacts/epics.md#story-41-binary-skeleton--cli] - Full acceptance criteria
- [Source: ap/src/main.rs] - Existing implementation with CLI args
- [Source: ap/Cargo.toml] - Current dependencies

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with no major debugging required.

### Completion Notes List

- Implemented APConfig struct with all required fields (port, rpc_url, bitget_api_key, bitget_api_secret, mock_bitget, log_level, log_dir, json_logs)
- Implemented ConfigBuilder with layered resolution chain: CLI > ENV > Config file > Defaults
- Added comprehensive test suite with 10 tests covering YAML parsing, env vars, CLI override, and defaults
- Integrated config module into main.rs, replacing direct Args usage with APConfig
- All 16 config-related tests pass (10 in config module + 6 in related modules)
- CLI help and version commands verified working
- Bitget credentials are never exposed via CLI for security (only config file or env vars)
- Fixed pre-existing compilation error in event_monitor.rs (added Clone derive to EventMonitorMetrics)

### File List

- ap/Cargo.toml (modified - added serde_yaml, thiserror, tempfile dev-dependency)
- ap/src/config.rs (new - APConfig struct, ConfigBuilder, ConfigError, comprehensive tests)
- ap/src/error.rs (new - AP error types)
- ap/src/lib.rs (modified - added config module export)
- ap/src/main.rs (modified - integrated ConfigBuilder into main function)
- ap/src/event_monitor.rs (modified - added Clone derive to EventMonitorMetrics)

## Senior Developer Review (AI)

**Review Date:** 2026-01-29
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)

### Issues Found & Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | Missing `bitget_api_passphrase` field (Bitget API requires 3 credentials) | Added field to APConfig, from_env(), merge(), and updated has_bitget_credentials() |
| HIGH | Test env var pollution (race condition on panic) | Added EnvGuard drop pattern to env var tests |
| HIGH | Debug impl exposes API keys in plain text | Implemented custom Debug that redacts sensitive fields |
| HIGH | File List missing `ap/src/error.rs` | Updated File List in story |
| MEDIUM | `has_bitget_credentials()` doesn't check empty strings | Updated to use `is_some_and(\|s\| !s.is_empty())` |
| MEDIUM | Invalid env var values fail silently | Added tracing warnings for parse failures |
| MEDIUM | Misleading port validation error message | Updated error text to reflect u16 constraint |

### Tests Added

- `test_debug_redacts_sensitive_fields` - Verifies API keys/secrets are not exposed in Debug output
- Enhanced `test_has_bitget_credentials` - Tests all three credentials and empty string handling
- EnvGuard pattern in env var tests for cleanup safety

### Review Outcome

**APPROVED** - All HIGH and MEDIUM issues fixed. Code now properly:
- Supports all three Bitget credentials (key, secret, passphrase)
- Redacts sensitive data in logs/debug output
- Validates credentials are non-empty strings
- Warns on invalid env var values

## Change Log

- 2026-01-29: Senior Developer Review - Fixed 7 issues (4 HIGH, 3 MEDIUM), added security tests
- 2026-01-29: Implemented config file loading and environment variable support (Story 4.1 complete)
