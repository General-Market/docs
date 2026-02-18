//! Tests for timeout handler
//!
//! Uses tokio::time::pause() for deterministic time control.

use super::*;
use std::time::Duration;
use tokio::sync::mpsc;

/// Test: Order times out after 60s (AC #1)
#[tokio::test]
async fn test_order_times_out_after_60s() {
    tokio::time::pause();

    let config = TimeoutConfig::default();
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // Verify order is tracked
    assert_eq!(handler.in_flight_count().await, 1);

    // Advance time past timeout
    tokio::time::advance(Duration::from_secs(61)).await;

    let result = handler.check_timeouts().await;
    assert!(result.timed_out.contains(&order_id));
    assert!(result.failed.is_empty()); // Not failed yet, just first timeout
}

/// Test: Timed out order moves to retry queue (AC #2)
#[tokio::test]
async fn test_timed_out_order_moves_to_retry_queue() {
    tokio::time::pause();

    let config = TimeoutConfig::default();
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // Advance past timeout
    tokio::time::advance(Duration::from_secs(61)).await;

    let result = handler.check_timeouts().await;
    assert!(result.timed_out.contains(&order_id));

    // Order should be in retry queue now
    assert_eq!(handler.retry_queue_depth().await, 1);
    assert_eq!(handler.in_flight_count().await, 0); // Moved out of active tracking
}

/// Test: Retry count increments correctly (AC #3)
#[tokio::test]
async fn test_retry_count_increments_correctly() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // First timeout
    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;

    // Advance past retry delay
    tokio::time::advance(Duration::from_secs(6)).await;
    let retry_id = handler.get_next_retry().await;
    assert_eq!(retry_id, Some(order_id.clone()));

    // Second timeout
    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;

    // Advance past retry delay again
    tokio::time::advance(Duration::from_secs(6)).await;
    let retry_id = handler.get_next_retry().await;
    assert_eq!(retry_id, Some(order_id.clone()));

    // Third timeout
    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;

    // Check metrics show 3 timeouts
    assert_eq!(handler.metrics().total_timeouts(), 3);
}

/// Test: Order fails permanently after 3 retries (AC #4)
#[tokio::test]
async fn test_order_fails_permanently_after_3_retries() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .max_retries(3)
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // Simulate 4 timeouts (initial + 3 retries)
    for i in 0..4 {
        tokio::time::advance(Duration::from_secs(61)).await;
        let result = handler.check_timeouts().await;

        if i < 3 {
            // Should be in retry queue
            assert!(result.timed_out.contains(&order_id), "Timeout {} failed", i);
            assert!(result.failed.is_empty());

            // Advance past retry delay and retry
            tokio::time::advance(Duration::from_secs(6)).await;
            let retry_id = handler.get_next_retry().await;
            assert_eq!(retry_id, Some(order_id.clone()));
        } else {
            // Fourth timeout should result in permanent failure
            assert!(result.failed.contains(&order_id));
        }
    }

    // Verify failure recorded
    assert_eq!(handler.metrics().total_failures(), 1);
}

/// Test: Failed order logged with full details (AC #5)
#[tokio::test]
async fn test_failed_order_logged_with_details() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .max_retries(3)
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // Simulate 4 timeouts to trigger failure
    for _ in 0..4 {
        tokio::time::advance(Duration::from_secs(61)).await;
        handler.check_timeouts().await;

        tokio::time::advance(Duration::from_secs(6)).await;
        handler.get_next_retry().await;
    }

    // Check failed orders record
    let failed = handler.get_failed_orders(Duration::from_secs(3600)).await;
    assert_eq!(failed.len(), 1);
    assert_eq!(failed[0].order_id, order_id);
    assert_eq!(failed[0].total_attempts, 4); // Initial + 3 retries
}

/// Test: get_timeout_count returns correct count for time window (AC #6)
#[tokio::test]
async fn test_get_timeout_count_returns_correct_count() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);

    // Track and timeout 3 orders
    for i in 0..3 {
        let order_id = format!("100:0x{}:0", i);
        handler.track_order(order_id).await;
    }

    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;

    // All 3 should be in the time window
    let count = handler.get_timeout_count(Duration::from_secs(60));
    assert_eq!(count, 3);
}

/// Test: Metrics counters increment correctly (AC #7)
#[tokio::test]
async fn test_metrics_counters_increment_correctly() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .max_retries(1)
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;
    let metrics = handler.metrics();

    assert_eq!(metrics.current_in_flight(), 1);

    // First timeout -> retry
    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;
    assert_eq!(metrics.total_timeouts(), 1);

    // Advance and get retry
    tokio::time::advance(Duration::from_secs(6)).await;
    handler.get_next_retry().await;
    assert_eq!(metrics.total_retries(), 1);

    // Second timeout -> failure (max_retries=1)
    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;
    assert_eq!(metrics.total_timeouts(), 2);
    assert_eq!(metrics.total_failures(), 1);
}

/// Test: Successful fill cancels timeout tracking (AC #8)
#[tokio::test]
async fn test_successful_fill_cancels_timeout_tracking() {
    tokio::time::pause();

    let config = TimeoutConfig::default();
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;
    assert_eq!(handler.in_flight_count().await, 1);

    // Simulate successful fill before timeout
    tokio::time::advance(Duration::from_secs(30)).await;
    let removed = handler.untrack_order(&order_id).await;
    assert!(removed);
    assert_eq!(handler.in_flight_count().await, 0);

    // Advance past timeout - should not trigger anything
    tokio::time::advance(Duration::from_secs(61)).await;
    let result = handler.check_timeouts().await;
    assert!(result.timed_out.is_empty());
    assert!(result.failed.is_empty());
}

/// Test: Event channel notifications
#[tokio::test]
async fn test_event_channel_notifications() {
    tokio::time::pause();

    let (tx, mut rx) = mpsc::channel(10);
    let config = TimeoutConfig::with_timeout(Duration::from_secs(60));
    let handler = TimeoutHandler::with_event_channel(config, tx);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;

    // Should receive timeout event
    let event = rx.try_recv().expect("Should receive event");
    match event {
        TimeoutEvent::OrderTimedOut {
            order_id: id,
            retry_count,
        } => {
            assert_eq!(id, order_id);
            assert_eq!(retry_count, 1);
        }
        _ => panic!("Expected OrderTimedOut event"),
    }
}

/// Test: Remove order from retry queue on fill
#[tokio::test]
async fn test_remove_from_retry_queue_on_fill() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // Trigger timeout -> moves to retry queue
    tokio::time::advance(Duration::from_secs(61)).await;
    handler.check_timeouts().await;
    assert_eq!(handler.retry_queue_depth().await, 1);

    // Fill comes in while in retry queue
    let removed = handler.untrack_order(&order_id).await;
    assert!(removed);
    assert_eq!(handler.retry_queue_depth().await, 0);
}

/// Test: move_to_retry method
#[tokio::test]
async fn test_move_to_retry_method() {
    tokio::time::pause();

    let config = TimeoutConfig::default();
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;

    // Externally trigger retry (simulating execution failure)
    let moved = handler.move_to_retry(&order_id).await;
    assert!(moved);
    assert_eq!(handler.retry_queue_depth().await, 1);
    assert_eq!(handler.metrics().total_timeouts(), 1);
}

/// Test: is_max_retries_exceeded check
#[tokio::test]
async fn test_is_max_retries_exceeded() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60))
        .max_retries(2)
        .retry_delay(Duration::from_secs(5));
    let handler = TimeoutHandler::new(config);
    let order_id = "100:0x123:0".to_string();

    handler.track_order(order_id.clone()).await;
    assert!(!handler.is_max_retries_exceeded(&order_id).await);

    // First retry
    handler.move_to_retry(&order_id).await;
    tokio::time::advance(Duration::from_secs(6)).await;
    handler.get_next_retry().await;
    assert!(!handler.is_max_retries_exceeded(&order_id).await);

    // Second retry
    handler.move_to_retry(&order_id).await;
    tokio::time::advance(Duration::from_secs(6)).await;
    handler.get_next_retry().await;
    assert!(handler.is_max_retries_exceeded(&order_id).await);
}

/// Test: Prometheus metrics format
#[tokio::test]
async fn test_prometheus_metrics_format() {
    let config = TimeoutConfig::default();
    let handler = TimeoutHandler::new(config);

    handler.track_order("test".to_string()).await;
    handler.metrics().record_timeout();
    handler.metrics().record_failure();

    let prometheus_output = handler.metrics().to_prometheus();
    assert!(prometheus_output.contains("ap_order_timeouts_total 1"));
    assert!(prometheus_output.contains("ap_order_failures_total 1"));
    assert!(prometheus_output.contains("ap_orders_in_flight 1"));
    assert!(prometheus_output.contains("# TYPE ap_order_timeouts_total counter"));
}

/// Test: Handler default
#[tokio::test]
async fn test_handler_default() {
    let handler = TimeoutHandler::default();
    assert_eq!(handler.in_flight_count().await, 0);
    assert_eq!(handler.retry_queue_depth().await, 0);
}

/// Test: Multiple concurrent orders
#[tokio::test]
async fn test_multiple_concurrent_orders() {
    tokio::time::pause();

    let config = TimeoutConfig::with_timeout(Duration::from_secs(60));
    let handler = TimeoutHandler::new(config);

    // Track 5 orders
    for i in 0..5 {
        handler.track_order(format!("{}:0x{}:0", i, i)).await;
    }
    assert_eq!(handler.in_flight_count().await, 5);
    assert_eq!(handler.metrics().current_in_flight(), 5);

    // Complete 2 of them before timeout
    handler.untrack_order("0:0x0:0").await;
    handler.untrack_order("1:0x1:0").await;
    assert_eq!(handler.in_flight_count().await, 3);

    // Timeout remaining 3
    tokio::time::advance(Duration::from_secs(61)).await;
    let result = handler.check_timeouts().await;
    assert_eq!(result.timed_out.len(), 3);
}
