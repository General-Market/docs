//! Tests for source failure handler
//!
//! Uses tokio::time::pause() for deterministic time control.

use super::*;
use crate::source_failure::types::SourceType;
use alloy_primitives::{Address, U256};
use std::time::Duration;
use tokio::sync::mpsc;

/// Test: Auto-pause triggers after 5 minutes of no fills (AC #1)
#[tokio::test]
async fn test_auto_pause_after_5_minutes() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // Initially active
    assert_eq!(handler.get_state().await, APOperationalState::Active);

    // Record a fill
    handler.record_fill().await;

    // Advance time past 5 minute threshold
    tokio::time::advance(Duration::from_secs(6 * 60)).await;

    // Check health should trigger auto-pause
    let result = handler.check_health().await;
    assert!(result.auto_pause_triggered);
    assert_eq!(handler.get_state().await, APOperationalState::Paused);
}

/// Test: Auto-pause does not trigger before threshold (AC #1)
#[tokio::test]
async fn test_no_auto_pause_before_threshold() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler.record_fill().await;

    // Advance time to just before threshold (4 minutes)
    tokio::time::advance(Duration::from_secs(4 * 60)).await;

    let result = handler.check_health().await;
    assert!(!result.auto_pause_triggered);
    assert_eq!(handler.get_state().await, APOperationalState::Active);
}

/// Test: Fill resets auto-pause timer (AC #1)
#[tokio::test]
async fn test_fill_resets_auto_pause_timer() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // Advance time to 4 minutes
    tokio::time::advance(Duration::from_secs(4 * 60)).await;

    // Record a fill - resets timer
    handler.record_fill().await;

    // Advance another 4 minutes (8 total, but only 4 since last fill)
    tokio::time::advance(Duration::from_secs(4 * 60)).await;

    let result = handler.check_health().await;
    assert!(!result.auto_pause_triggered);
    assert_eq!(handler.get_state().await, APOperationalState::Active);
}

/// Test: Orders queue during suspension (AC #2)
#[tokio::test]
async fn test_orders_queue_during_suspension() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // Trigger suspension
    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    assert!(handler.is_suspended_or_paused().await);

    // Queue some orders
    let order1 = PendingRefundOrder::new(
        "100:0x123:0".to_string(),
        Address::ZERO,
        U256::from(1000),
        SourceType::CEX,
        100,
    );
    let order2 = PendingRefundOrder::new(
        "101:0x124:0".to_string(),
        Address::ZERO,
        U256::from(2000),
        SourceType::DEX,
        101,
    );

    handler.queue_pending_order(order1).await;
    handler.queue_pending_order(order2).await;

    assert_eq!(handler.pending_queue_size().await, 2);
    assert_eq!(handler.metrics().get_pending_refunds(), 2);
}

/// Test: Order auto-refund after 1 hour pending (AC #3)
#[tokio::test]
async fn test_order_auto_refund_after_1_hour() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // Trigger suspension
    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    // Queue an order
    let order = PendingRefundOrder::new(
        "100:0x123:0".to_string(),
        Address::ZERO,
        U256::from(1000),
        SourceType::CEX,
        100,
    );
    handler.queue_pending_order(order).await;

    // Advance time past 1 hour
    tokio::time::advance(Duration::from_secs(61 * 60)).await;

    // Check pending timeouts
    let refunds = handler.check_pending_timeouts().await;
    assert_eq!(refunds.len(), 1);
    assert_eq!(refunds[0].order_id, "100:0x123:0");
    assert_eq!(refunds[0].reason, RefundReason::Timeout);

    // Verify metrics updated
    assert_eq!(handler.metrics().get_auto_refunds_total(), 1);
    assert_eq!(handler.pending_queue_size().await, 0);
}

/// Test: Order not refunded before 1 hour (AC #3)
#[tokio::test]
async fn test_order_not_refunded_before_timeout() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    let order = PendingRefundOrder::new(
        "100:0x123:0".to_string(),
        Address::ZERO,
        U256::from(1000),
        SourceType::CEX,
        100,
    );
    handler.queue_pending_order(order).await;

    // Advance time to 59 minutes (just before timeout)
    tokio::time::advance(Duration::from_secs(59 * 60)).await;

    let refunds = handler.check_pending_timeouts().await;
    assert!(refunds.is_empty());
    assert_eq!(handler.pending_queue_size().await, 1);
}

/// Test: Admin restoration clears suspension (AC #4)
#[tokio::test]
async fn test_admin_restoration_clears_suspension() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    assert!(handler.is_suspended_or_paused().await);

    // Advance some time
    tokio::time::advance(Duration::from_secs(120)).await;

    // Restore
    let report = handler.restore(None).await.expect("Restoration should succeed");

    assert_eq!(handler.get_state().await, APOperationalState::Active);
    assert!(!handler.is_suspended_or_paused().await);
    assert!(report.downtime_duration >= Duration::from_secs(120));
}

/// Test: Restoration processes queued orders (AC #4)
#[tokio::test]
async fn test_restoration_processes_queued_orders() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    // Queue orders
    for i in 0..5 {
        let order = PendingRefundOrder::new(
            format!("{}:0x{}:0", 100 + i, i),
            Address::ZERO,
            U256::from(1000),
            SourceType::CEX,
            100 + i,
        );
        handler.queue_pending_order(order).await;
    }

    assert_eq!(handler.pending_queue_size().await, 5);

    // Restore before any timeouts
    let report = handler.restore(None).await.unwrap();

    assert_eq!(report.orders_processed, 5);
    assert_eq!(report.orders_refunded, 0);
}

/// Test: Restoration skips timed-out orders and refunds them (AC #4)
#[tokio::test]
async fn test_restoration_refunds_timed_out_orders() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    // Queue 3 orders
    for i in 0..3 {
        let order = PendingRefundOrder::new(
            format!("{}:0x{}:0", 100 + i, i),
            Address::ZERO,
            U256::from(1000),
            SourceType::CEX,
            100 + i,
        );
        handler.queue_pending_order(order).await;
    }

    // Advance time past 1 hour timeout
    tokio::time::advance(Duration::from_secs(61 * 60)).await;

    // Queue 2 more orders (these are fresh)
    for i in 3..5 {
        let order = PendingRefundOrder::new(
            format!("{}:0x{}:0", 100 + i, i),
            Address::ZERO,
            U256::from(1000),
            SourceType::CEX,
            100 + i,
        );
        handler.queue_pending_order(order).await;
    }

    // Restore
    let report = handler.restore(None).await.unwrap();

    // First 3 should be refunded (timed out), last 2 processed
    assert_eq!(report.orders_processed, 2);
    assert_eq!(report.orders_refunded, 3);
    assert_eq!(handler.metrics().get_auto_refunds_total(), 3);
}

/// Test: Metrics update correctly on state transitions (AC #7)
#[tokio::test]
async fn test_metrics_update_on_state_transitions() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // Initial state
    assert!(!handler.metrics().is_suspended());
    assert_eq!(handler.metrics().get_suspensions_total(), 0);

    // Suspend
    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    assert!(handler.metrics().is_suspended());
    assert_eq!(handler.metrics().get_suspensions_total(), 1);

    // Restore
    handler.restore(None).await.unwrap();

    assert!(!handler.metrics().is_suspended());
    assert_eq!(handler.metrics().get_restorations_total(), 1);

    // Suspend again
    handler
        .suspend(SuspensionReason::BLSVote { voter_count: 11 })
        .await;

    assert_eq!(handler.metrics().get_suspensions_total(), 2);
}

/// Test: Multiple suspensions/restorations in sequence (AC #8)
#[tokio::test]
async fn test_multiple_suspension_restoration_cycles() {
    tokio::time::pause();

    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    for cycle in 0..3 {
        // Suspend
        handler
            .suspend(SuspensionReason::AutoPause {
                offline_duration: Duration::from_secs(300),
            })
            .await;

        assert!(handler.is_suspended_or_paused().await);

        // Queue an order
        let order = PendingRefundOrder::new(
            format!("{}:0x{}:0", 100 + cycle, cycle),
            Address::ZERO,
            U256::from(1000),
            SourceType::CEX,
            100 + cycle,
        );
        handler.queue_pending_order(order).await;

        // Restore
        let report = handler.restore(None).await.unwrap();
        assert_eq!(report.orders_processed, 1);
        assert!(!handler.is_suspended_or_paused().await);
    }

    assert_eq!(handler.metrics().get_suspensions_total(), 3);
    assert_eq!(handler.metrics().get_restorations_total(), 3);
}

/// Test: BLS vote suspension trigger (AC #6)
#[tokio::test]
async fn test_bls_vote_suspension_trigger() {
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::BLSVote { voter_count: 11 })
        .await;

    // BLS vote triggers full Suspended state (not just Paused)
    assert_eq!(handler.get_state().await, APOperationalState::Suspended);
}

/// Test: Admin action suspension trigger (AC #6)
#[tokio::test]
async fn test_admin_action_suspension_trigger() {
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::AdminAction {
            admin: Address::ZERO,
            reason: "Manual maintenance".to_string(),
        })
        .await;

    assert_eq!(handler.get_state().await, APOperationalState::Suspended);
}

/// Test: Cannot restore when already active
#[tokio::test]
async fn test_cannot_restore_when_active() {
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // Try to restore while active
    let result = handler.restore(None).await;
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("active"));
}

/// Test: Event channel notifications
#[tokio::test]
async fn test_event_channel_notifications() {
    tokio::time::pause();

    let (tx, mut rx) = mpsc::channel(10);
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::with_event_channel(config, tx);

    // Trigger suspension
    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    // Should receive suspended event
    let event = rx.try_recv().expect("Should receive event");
    match event {
        SourceFailureEvent::Suspended { reason, .. } => {
            assert!(matches!(reason, SuspensionReason::AutoPause { .. }));
        }
        _ => panic!("Expected Suspended event"),
    }

    // Restore
    handler.restore(None).await.unwrap();

    // Should receive restored event
    let event = rx.try_recv().expect("Should receive event");
    match event {
        SourceFailureEvent::Restored { report, .. } => {
            assert_eq!(report.orders_processed, 0);
        }
        _ => panic!("Expected Restored event"),
    }
}

/// Test: Refund requested event channel notification
#[tokio::test]
async fn test_refund_requested_event() {
    tokio::time::pause();

    let (tx, mut rx) = mpsc::channel(10);
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::with_event_channel(config, tx);

    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    // Consume suspended event
    let _ = rx.recv().await;

    // Queue an order
    let order = PendingRefundOrder::new(
        "100:0x123:0".to_string(),
        Address::ZERO,
        U256::from(1000),
        SourceType::CEX,
        100,
    );
    handler.queue_pending_order(order).await;

    // Advance past timeout
    tokio::time::advance(Duration::from_secs(61 * 60)).await;

    // Check timeouts
    handler.check_pending_timeouts().await;

    // Should receive refund requested event
    let event = rx.try_recv().expect("Should receive event");
    match event {
        SourceFailureEvent::RefundRequested { orders, .. } => {
            assert_eq!(orders.len(), 1);
            assert_eq!(orders[0].order_id, "100:0x123:0");
        }
        _ => panic!("Expected RefundRequested event"),
    }
}

/// Test: Duplicate suspension is ignored
#[tokio::test]
async fn test_duplicate_suspension_ignored() {
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    // First suspension
    handler
        .suspend(SuspensionReason::BLSVote { voter_count: 11 })
        .await;

    assert_eq!(handler.metrics().get_suspensions_total(), 1);

    // Second suspension (should be ignored)
    handler
        .suspend(SuspensionReason::BLSVote { voter_count: 15 })
        .await;

    // Count should still be 1
    assert_eq!(handler.metrics().get_suspensions_total(), 1);
}

/// Test: Prometheus metrics format
#[tokio::test]
async fn test_prometheus_metrics_format() {
    let config = SourceFailureConfig::default();
    let handler = SourceFailureHandler::new(config);

    handler
        .suspend(SuspensionReason::AutoPause {
            offline_duration: Duration::from_secs(300),
        })
        .await;

    let order = PendingRefundOrder::new(
        "100:0x123:0".to_string(),
        Address::ZERO,
        U256::from(1000),
        SourceType::CEX,
        100,
    );
    handler.queue_pending_order(order).await;

    let prometheus_output = handler.metrics().to_prometheus();
    assert!(prometheus_output.contains("ap_suspended 1"));
    assert!(prometheus_output.contains("ap_pending_refunds 1"));
    assert!(prometheus_output.contains("# TYPE ap_suspended gauge"));
}

/// Test: Handler default
#[tokio::test]
async fn test_handler_default() {
    let handler = SourceFailureHandler::default();
    assert_eq!(handler.get_state().await, APOperationalState::Active);
    assert_eq!(handler.pending_queue_size().await, 0);
}

/// Test: Custom config thresholds
#[tokio::test]
async fn test_custom_config_thresholds() {
    tokio::time::pause();

    // Use shorter thresholds for testing
    let config = SourceFailureConfig::with_auto_pause_threshold(Duration::from_secs(60))
        .pending_order_timeout(Duration::from_secs(120));

    let handler = SourceFailureHandler::new(config);

    // Advance 61 seconds (past custom threshold)
    tokio::time::advance(Duration::from_secs(61)).await;

    let result = handler.check_health().await;
    assert!(result.auto_pause_triggered);

    // Queue an order
    let order = PendingRefundOrder::new(
        "100:0x123:0".to_string(),
        Address::ZERO,
        U256::from(1000),
        SourceType::CEX,
        100,
    );
    handler.queue_pending_order(order).await;

    // Advance 121 seconds (past custom pending timeout)
    tokio::time::advance(Duration::from_secs(121)).await;

    let refunds = handler.check_pending_timeouts().await;
    assert_eq!(refunds.len(), 1);
}
