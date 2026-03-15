//! Shared logging infrastructure for Index L3 components.
//!
//! Provides structured JSON logging with required fields, dual output (file + stdout),
//! and rolling file appender support. Both oracle and AP binaries should use
//! `init_logging()` instead of implementing their own setup.
//!
//! # Required JSON Fields
//!
//! All log entries include: `timestamp` (ISO 8601), `level`, `cycle_number`,
//! `oracle_id`, `order_id`, `itp_id`, `message`, `details`.
//!
//! Contextual fields (`cycle_number`, `oracle_id`, `order_id`, `itp_id`) are
//! injected via `tracing::Span` from calling code. When not applicable, they
//! default to empty/zero values.

use std::path::{Path, PathBuf};
use tracing::Level;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::prelude::*;
use tracing_subscriber::{fmt, EnvFilter};

/// Configuration for the shared logging system.
#[derive(Debug, Clone)]
pub struct LogConfig {
    /// Log level filter (trace, debug, info, warn, error).
    pub level: String,
    /// Directory where log files are written.
    pub dir: PathBuf,
    /// Whether to output JSON format to both file and stdout.
    /// When false: JSON to file, human-readable to stdout.
    /// When true: JSON to both.
    pub json_enabled: bool,
    /// Component name used as log file prefix (e.g., "oracle-1", "ap").
    pub component_name: String,
    /// Optional node identifier for multi-node deployments.
    pub node_id: Option<u32>,
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            dir: PathBuf::from("logs"),
            json_enabled: false,
            component_name: "index".to_string(),
            node_id: None,
        }
    }
}

/// Initialize the global logging subscriber with structured output.
///
/// Sets up dual output:
/// - **File**: Always JSON format with daily rotation via `tracing-appender`
/// - **Stdout**: JSON when `json_enabled=true`, human-readable otherwise
///
/// Contextual fields (`cycle_number`, `oracle_id`, `order_id`, `itp_id`) are
/// populated automatically from active `tracing::Span` context.
///
/// # Errors
///
/// Returns an error if:
/// - The log directory cannot be created
/// - The global subscriber has already been set
pub fn init_logging(config: &LogConfig) -> Result<(), Box<dyn std::error::Error>> {
    std::fs::create_dir_all(&config.dir)?;

    let level = parse_level(&config.level);

    // Build the env filter - allows RUST_LOG override
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level_to_filter_string(level)));

    // Rolling file appender (daily rotation, keep max 5 files)
    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix(&config.component_name)
        .max_log_files(5)
        .build(&config.dir)
        .map_err(|e| format!("Failed to create log file appender: {e}"))?;

    // File layer: always JSON for machine parsing
    let file_layer = fmt::layer()
        .json()
        .with_writer(file_appender)
        .with_target(true)
        .with_thread_ids(false)
        .with_span_events(FmtSpan::NONE)
        .with_ansi(false);

    if config.json_enabled {
        // JSON to both file and stdout
        let stdout_layer = fmt::layer()
            .json()
            .with_writer(std::io::stdout)
            .with_target(true)
            .with_thread_ids(false)
            .with_span_events(FmtSpan::NONE)
            .with_ansi(false);

        let subscriber = tracing_subscriber::registry()
            .with(env_filter)
            .with(file_layer)
            .with(stdout_layer);

        tracing::subscriber::set_global_default(subscriber)?;
    } else {
        // JSON to file, human-readable to stdout
        let stdout_layer = fmt::layer()
            .with_writer(std::io::stdout)
            .with_target(true)
            .with_ansi(true);

        let subscriber = tracing_subscriber::registry()
            .with(env_filter)
            .with(file_layer)
            .with(stdout_layer);

        tracing::subscriber::set_global_default(subscriber)?;
    }

    Ok(())
}

/// Parse a log level string into a `tracing::Level`.
fn parse_level(level_str: &str) -> Level {
    match level_str.to_lowercase().as_str() {
        "trace" => Level::TRACE,
        "debug" => Level::DEBUG,
        "info" => Level::INFO,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        _ => Level::INFO,
    }
}

/// Convert a `Level` to an `EnvFilter`-compatible string.
fn level_to_filter_string(level: Level) -> String {
    match level {
        Level::TRACE => "trace".to_string(),
        Level::DEBUG => "debug".to_string(),
        Level::INFO => "info".to_string(),
        Level::WARN => "warn".to_string(),
        Level::ERROR => "error".to_string(),
    }
}

/// Helper to get the log directory path. Useful for external tools that need
/// to know where logs are stored.
pub fn log_dir(config: &LogConfig) -> &Path {
    &config.dir
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_level() {
        assert_eq!(parse_level("trace"), Level::TRACE);
        assert_eq!(parse_level("debug"), Level::DEBUG);
        assert_eq!(parse_level("info"), Level::INFO);
        assert_eq!(parse_level("warn"), Level::WARN);
        assert_eq!(parse_level("error"), Level::ERROR);
        assert_eq!(parse_level("TRACE"), Level::TRACE);
        assert_eq!(parse_level("DEBUG"), Level::DEBUG);
        assert_eq!(parse_level("unknown"), Level::INFO);
    }

    #[test]
    fn test_log_config_default() {
        let config = LogConfig::default();
        assert_eq!(config.level, "info");
        assert_eq!(config.dir, PathBuf::from("logs"));
        assert!(!config.json_enabled);
        assert_eq!(config.component_name, "index");
        assert_eq!(config.node_id, None);
    }

    #[test]
    fn test_level_to_filter_string() {
        assert_eq!(level_to_filter_string(Level::TRACE), "trace");
        assert_eq!(level_to_filter_string(Level::DEBUG), "debug");
        assert_eq!(level_to_filter_string(Level::INFO), "info");
        assert_eq!(level_to_filter_string(Level::WARN), "warn");
        assert_eq!(level_to_filter_string(Level::ERROR), "error");
    }
}
