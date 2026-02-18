//! Prometheus metrics formatting for AP service
//!
//! Provides Prometheus text format output for all AP metrics.
//! Format follows the Prometheus exposition format specification.

use super::APMetrics;

/// Prometheus metrics formatter
pub struct PrometheusFormatter;

impl PrometheusFormatter {
    /// Format all AP metrics in Prometheus text format
    pub async fn format(metrics: &APMetrics) -> String {
        Self::format_with_window_size(metrics, 100).await
    }

    /// Format all AP metrics with custom rolling window size for HELP text
    pub async fn format_with_window_size(metrics: &APMetrics, rolling_window_size: usize) -> String {
        let orders_processed = metrics.get_orders_processed();
        let orders_failed = metrics.get_orders_failed();
        let events_received = metrics.get_events_received();
        let queue_depth = metrics.get_queue_depth();
        let avg_fill_time_ms = metrics.get_avg_fill_time_ms().await;
        let avg_fill_time_secs = avg_fill_time_ms as f64 / 1000.0;
        let buffer_balance_usd = metrics.get_buffer_balance_usd();
        let violations_24h = metrics.get_violations_24h().await;
        let timeouts_24h = metrics.get_timeouts_24h().await;
        let health_status = metrics.get_health_status().await;

        format!(
            r#"# HELP ap_orders_processed_total Total orders processed by AP
# TYPE ap_orders_processed_total counter
ap_orders_processed_total {}

# HELP ap_orders_failed_total Total orders that failed
# TYPE ap_orders_failed_total counter
ap_orders_failed_total {}

# HELP ap_events_received_total Total events received from EventMonitor
# TYPE ap_events_received_total counter
ap_events_received_total {}

# HELP ap_queue_depth Current order queue depth
# TYPE ap_queue_depth gauge
ap_queue_depth {}

# HELP ap_avg_fill_time_seconds Average fill time in seconds (rolling {})
# TYPE ap_avg_fill_time_seconds gauge
ap_avg_fill_time_seconds {:.3}

# HELP ap_buffer_balance_usd Buffer balance in USD
# TYPE ap_buffer_balance_usd gauge
ap_buffer_balance_usd {:.2}

# HELP ap_violations_24h Limit violations in last 24 hours
# TYPE ap_violations_24h gauge
ap_violations_24h {}

# HELP ap_timeouts_24h Order timeouts in last 24 hours
# TYPE ap_timeouts_24h gauge
ap_timeouts_24h {}

# HELP ap_health_status Health status (0=unhealthy, 1=degraded, 2=healthy)
# TYPE ap_health_status gauge
ap_health_status {}
"#,
            orders_processed,
            orders_failed,
            events_received,
            queue_depth,
            rolling_window_size,
            avg_fill_time_secs,
            buffer_balance_usd,
            violations_24h,
            timeouts_24h,
            health_status.as_prometheus_value()
        )
    }

    /// Format a single counter metric
    pub fn format_counter(name: &str, help: &str, value: u64) -> String {
        format!(
            "# HELP {} {}\n# TYPE {} counter\n{} {}\n",
            name, help, name, name, value
        )
    }

    /// Format a single gauge metric
    pub fn format_gauge(name: &str, help: &str, value: f64) -> String {
        format!(
            "# HELP {} {}\n# TYPE {} gauge\n{} {}\n",
            name, help, name, name, value
        )
    }

    /// Format a single gauge metric with integer value
    pub fn format_gauge_int(name: &str, help: &str, value: u64) -> String {
        format!(
            "# HELP {} {}\n# TYPE {} gauge\n{} {}\n",
            name, help, name, name, value
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn test_prometheus_format_basic() {
        let metrics = APMetrics::new();
        let output = PrometheusFormatter::format(&metrics).await;

        // Check for required metric names
        assert!(output.contains("ap_orders_processed_total"));
        assert!(output.contains("ap_orders_failed_total"));
        assert!(output.contains("ap_events_received_total"));
        assert!(output.contains("ap_queue_depth"));
        assert!(output.contains("ap_avg_fill_time_seconds"));
        assert!(output.contains("ap_buffer_balance_usd"));
        assert!(output.contains("ap_violations_24h"));
        assert!(output.contains("ap_timeouts_24h"));
        assert!(output.contains("ap_health_status"));
    }

    #[tokio::test]
    async fn test_prometheus_format_with_values() {
        let metrics = APMetrics::new();

        metrics.increment_orders_processed();
        metrics.increment_orders_processed();
        metrics.increment_orders_failed();
        metrics.set_queue_depth(42);
        metrics.set_buffer_balance(850.50);
        metrics.record_fill_time(Duration::from_millis(100)).await;
        metrics.record_fill_time(Duration::from_millis(200)).await;
        metrics.increment_violations().await;

        let output = PrometheusFormatter::format(&metrics).await;

        // Verify values are present
        assert!(output.contains("ap_orders_processed_total 2"));
        assert!(output.contains("ap_orders_failed_total 1"));
        assert!(output.contains("ap_queue_depth 42"));
        assert!(output.contains("ap_buffer_balance_usd 850.50"));
        assert!(output.contains("ap_violations_24h 1"));
        // Health should be degraded (violations > 0) so value should be 1
        assert!(output.contains("ap_health_status 1"));
    }

    #[tokio::test]
    async fn test_prometheus_format_healthy() {
        let metrics = APMetrics::new();
        let output = PrometheusFormatter::format(&metrics).await;

        // Healthy = 2
        assert!(output.contains("ap_health_status 2"));
    }

    #[tokio::test]
    async fn test_prometheus_format_unhealthy() {
        let metrics = APMetrics::new();
        metrics.set_queue_depth(600); // > 500 = unhealthy

        let output = PrometheusFormatter::format(&metrics).await;

        // Unhealthy = 0
        assert!(output.contains("ap_health_status 0"));
    }

    #[test]
    fn test_format_counter() {
        let output = PrometheusFormatter::format_counter(
            "test_counter",
            "A test counter",
            42,
        );

        assert!(output.contains("# HELP test_counter A test counter"));
        assert!(output.contains("# TYPE test_counter counter"));
        assert!(output.contains("test_counter 42"));
    }

    #[test]
    fn test_format_gauge() {
        let output = PrometheusFormatter::format_gauge(
            "test_gauge",
            "A test gauge",
            3.14159,
        );

        assert!(output.contains("# HELP test_gauge A test gauge"));
        assert!(output.contains("# TYPE test_gauge gauge"));
        assert!(output.contains("test_gauge 3.14159"));
    }

    #[test]
    fn test_format_gauge_int() {
        let output = PrometheusFormatter::format_gauge_int(
            "test_gauge_int",
            "A test integer gauge",
            100,
        );

        assert!(output.contains("# HELP test_gauge_int A test integer gauge"));
        assert!(output.contains("# TYPE test_gauge_int gauge"));
        assert!(output.contains("test_gauge_int 100"));
    }

    #[tokio::test]
    async fn test_prometheus_format_content_type() {
        // Prometheus format should be plain text with no special characters
        let metrics = APMetrics::new();
        let output = PrometheusFormatter::format(&metrics).await;

        // Should start with # (HELP line)
        assert!(output.starts_with('#'));

        // Should have proper newline endings
        let lines: Vec<&str> = output.lines().collect();
        assert!(!lines.is_empty());

        // All lines should either be comments (#) or metric values
        for line in lines {
            if !line.is_empty() {
                assert!(
                    line.starts_with('#') || line.starts_with("ap_"),
                    "Invalid line format: {}",
                    line
                );
            }
        }
    }
}
