//! In-memory error tracker for market data sources
//!
//! Tracks per-source error state so the health endpoint can report
//! WHY a source is failing, not just that it has no recent data.

use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

/// Global singleton error tracker, initialized once at startup
static GLOBAL_TRACKER: OnceLock<SourceErrorTracker> = OnceLock::new();

/// Initialize the global error tracker (call once from main)
pub fn init_global() {
    let _ = GLOBAL_TRACKER.set(SourceErrorTracker::new());
}

/// Get the global error tracker
pub fn global() -> &'static SourceErrorTracker {
    GLOBAL_TRACKER.get_or_init(SourceErrorTracker::new)
}

/// Error category for display in the health API
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCategory {
    /// Source was never started (missing API key, disabled flag, etc.)
    NotStarted,
    /// API returned 401/403 — credentials invalid or revoked
    AuthFailed,
    /// API returned 429 — rate limited
    RateLimited,
    /// Server error (5xx), timeout, connection refused
    Transient,
    /// Data parsing or validation error
    DataError,
    /// Circuit breaker tripped — too many consecutive failures
    CircuitBreakerOpen,
    /// Source init failed (code-level error, e.g. bad config)
    InitFailed,
    /// No error — source is running fine
    Ok,
}

impl std::fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCategory::NotStarted => write!(f, "not_started"),
            ErrorCategory::AuthFailed => write!(f, "auth_failed"),
            ErrorCategory::RateLimited => write!(f, "rate_limited"),
            ErrorCategory::Transient => write!(f, "transient"),
            ErrorCategory::DataError => write!(f, "data_error"),
            ErrorCategory::CircuitBreakerOpen => write!(f, "circuit_breaker_open"),
            ErrorCategory::InitFailed => write!(f, "init_failed"),
            ErrorCategory::Ok => write!(f, "ok"),
        }
    }
}

/// Per-source error state
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceErrorState {
    pub category: ErrorCategory,
    pub last_error: Option<String>,
    pub last_error_at: Option<DateTime<Utc>>,
    pub consecutive_errors: u32,
    pub total_errors: u64,
    pub last_success_at: Option<DateTime<Utc>>,
    pub total_syncs: u64,
    /// Why the source was not started (e.g., "Missing FINNHUB_API_KEY")
    pub not_started_reason: Option<String>,
}

impl Default for SourceErrorState {
    fn default() -> Self {
        Self {
            category: ErrorCategory::Ok,
            last_error: None,
            last_error_at: None,
            consecutive_errors: 0,
            total_errors: 0,
            last_success_at: None,
            total_syncs: 0,
            not_started_reason: None,
        }
    }
}

/// Thread-safe error tracker shared across all sync engines and the API
#[derive(Debug, Default)]
pub struct SourceErrorTracker {
    states: RwLock<HashMap<String, SourceErrorState>>,
}

impl SourceErrorTracker {
    pub fn new() -> Self {
        Self {
            states: RwLock::new(HashMap::new()),
        }
    }

    /// Record that a source was not started and why
    pub fn record_not_started(&self, source_id: &str, reason: &str) {
        let mut map = self.states.write().unwrap();
        let state = map.entry(source_id.to_string()).or_default();
        state.category = ErrorCategory::NotStarted;
        state.not_started_reason = Some(reason.to_string());
    }

    /// Record that a source failed to initialize
    pub fn record_init_failed(&self, source_id: &str, error: &str) {
        let mut map = self.states.write().unwrap();
        let state = map.entry(source_id.to_string()).or_default();
        state.category = ErrorCategory::InitFailed;
        state.last_error = Some(truncate(error, 500));
        state.last_error_at = Some(Utc::now());
        state.consecutive_errors += 1;
        state.total_errors += 1;
    }

    /// Record a sync error with automatic category detection from the error message
    pub fn record_error(&self, source_id: &str, error: &str) {
        let now = Utc::now();
        let category = classify_error(error);
        let mut map = self.states.write().unwrap();
        let state = map.entry(source_id.to_string()).or_default();
        state.category = category;
        state.last_error = Some(truncate(error, 500));
        state.last_error_at = Some(now);
        state.consecutive_errors += 1;
        state.total_errors += 1;
        state.total_syncs += 1;
    }

    /// Record a successful sync
    pub fn record_success(&self, source_id: &str) {
        let now = Utc::now();
        let mut map = self.states.write().unwrap();
        let state = map.entry(source_id.to_string()).or_default();
        state.category = ErrorCategory::Ok;
        state.consecutive_errors = 0;
        state.last_success_at = Some(now);
        state.total_syncs += 1;
    }

    /// Record that source has started (clear not_started state)
    pub fn record_started(&self, source_id: &str) {
        let mut map = self.states.write().unwrap();
        let state = map.entry(source_id.to_string()).or_default();
        if matches!(state.category, ErrorCategory::NotStarted) {
            state.category = ErrorCategory::Ok;
            state.not_started_reason = None;
        }
    }

    /// Get the error state for a specific source
    pub fn get_state(&self, source_id: &str) -> Option<SourceErrorState> {
        let map = self.states.read().unwrap();
        map.get(source_id).cloned()
    }

    /// Get all source error states
    pub fn get_all_states(&self) -> HashMap<String, SourceErrorState> {
        let map = self.states.read().unwrap();
        map.clone()
    }
}

/// Classify an error string into an ErrorCategory
fn classify_error(error: &str) -> ErrorCategory {
    let lower = error.to_lowercase();
    if lower.contains("401") || lower.contains("403") || lower.contains("auth failed")
        || lower.contains("unauthorized") || lower.contains("forbidden")
        || lower.contains("invalid api key") || lower.contains("api key")
    {
        ErrorCategory::AuthFailed
    } else if lower.contains("429") || lower.contains("rate limit") || lower.contains("too many requests") {
        ErrorCategory::RateLimited
    } else if lower.contains("circuit breaker") || lower.contains("circuit_breaker") {
        ErrorCategory::CircuitBreakerOpen
    } else if lower.contains("parse") || lower.contains("json") || lower.contains("deserialize")
        || lower.contains("expected") || lower.contains("invalid data")
    {
        ErrorCategory::DataError
    } else {
        // Timeout, connection refused, 5xx, network errors
        ErrorCategory::Transient
    }
}

/// Truncate a string to max_len, appending "..." if truncated
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}
