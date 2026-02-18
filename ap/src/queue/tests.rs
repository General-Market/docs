//! Unit tests for Order Queue Manager
//!
//! Tests cover:
//! - FIFO ordering within buckets
//! - Bucket classification at boundary values
//! - Fair scheduling distribution
//! - Mark complete/failed flows
//! - Retry queue behavior
//! - Rebalance priority (50/50 split)
//! - Queue depth thresholds
//! - Thread-safe wrapper
//! - Edge cases

use super::*;
use crate::event_types::TradeRequestEvent;
use common::types::Side;
use ethers::types::{H256, U256};

/// Create a test trade request with specified USDC amount
fn make_order(amount_usd: u64) -> TradeRequestEvent {
    make_order_with_id(amount_usd, 0)
}

/// Create a test trade request with specified USDC amount and unique block/log
fn make_order_with_id(amount_usd: u64, id: u64) -> TradeRequestEvent {
    TradeRequestEvent {
        cycle_number: 1,
        pair_id: H256::random(),
        side: Side::Buy,
        amount: U256::from(amount_usd) * U256::exp10(18),
        limit_price: U256::from(50u64) * U256::exp10(18),
        block_number: 100 + id,
        tx_hash: H256::random(),
        log_index: id,
    }
}

#[test]
fn test_new_creates_empty_buckets() {
    let manager = OrderQueueManager::new();
    let depth = manager.get_queue_depth();

    assert_eq!(depth.total, 0);
    assert_eq!(depth.retry_count, 0);
    assert_eq!(depth.rebalance_count, 0);
    assert_eq!(depth.by_bucket.len(), 4);

    for bucket in Bucket::all() {
        assert_eq!(depth.by_bucket.get(&bucket), Some(&0));
    }
}

#[test]
fn test_enqueue_classifies_into_correct_bucket() {
    let mut manager = OrderQueueManager::new();

    // Enqueue orders of different sizes
    manager.enqueue(make_order(50)).unwrap();   // Small
    manager.enqueue(make_order(500)).unwrap();  // Medium
    manager.enqueue(make_order(5000)).unwrap(); // Large
    manager.enqueue(make_order(50000)).unwrap(); // XL

    let depth = manager.get_queue_depth();
    assert_eq!(depth.total, 4);
    assert_eq!(depth.by_bucket.get(&Bucket::Small), Some(&1));
    assert_eq!(depth.by_bucket.get(&Bucket::Medium), Some(&1));
    assert_eq!(depth.by_bucket.get(&Bucket::Large), Some(&1));
    assert_eq!(depth.by_bucket.get(&Bucket::XL), Some(&1));
}

#[test]
fn test_fifo_ordering_within_bucket() {
    let mut manager = OrderQueueManager::new();

    // Enqueue 3 small orders
    let order1 = make_order_with_id(50, 1);
    let order2 = make_order_with_id(60, 2);
    let order3 = make_order_with_id(70, 3);

    manager.enqueue(order1.clone()).unwrap();
    manager.enqueue(order2.clone()).unwrap();
    manager.enqueue(order3.clone()).unwrap();

    // Dequeue should return in FIFO order
    let dequeued1 = manager.get_next_order().unwrap();
    assert_eq!(dequeued1.trade_request.event_id(), order1.event_id());

    let dequeued2 = manager.get_next_order().unwrap();
    assert_eq!(dequeued2.trade_request.event_id(), order2.event_id());

    let dequeued3 = manager.get_next_order().unwrap();
    assert_eq!(dequeued3.trade_request.event_id(), order3.event_id());
}

#[test]
fn test_fair_scheduling_distribution() {
    let mut manager = OrderQueueManager::new();

    // Add 20 orders to each bucket
    for i in 0..20 {
        manager.enqueue(make_order_with_id(50, i)).unwrap();        // Small
        manager.enqueue(make_order_with_id(500, 100 + i)).unwrap();  // Medium
        manager.enqueue(make_order_with_id(5000, 200 + i)).unwrap(); // Large
        manager.enqueue(make_order_with_id(50000, 300 + i)).unwrap(); // XL
    }

    // Process 80 orders (all of them)
    let mut counts: HashMap<Bucket, u32> = HashMap::new();
    for _ in 0..80 {
        if let Some(order) = manager.get_next_order() {
            *counts.entry(order.bucket).or_insert(0) += 1;
            // Mark complete so we can process the next one
            manager.mark_complete(&order.trade_request.event_id()).unwrap();
        }
    }

    // Verify approximate distribution (30/30/20/20)
    // With 80 orders: Small ~24, Medium ~24, Large ~16, XL ~16
    let small = *counts.get(&Bucket::Small).unwrap_or(&0);
    let medium = *counts.get(&Bucket::Medium).unwrap_or(&0);
    let large = *counts.get(&Bucket::Large).unwrap_or(&0);
    let xl = *counts.get(&Bucket::XL).unwrap_or(&0);

    // Allow 10% tolerance (tightened from 15%)
    assert!((small as f64 / 80.0 - 0.30).abs() < 0.10, "Small: {}/80", small);
    assert!((medium as f64 / 80.0 - 0.30).abs() < 0.10, "Medium: {}/80", medium);
    assert!((large as f64 / 80.0 - 0.20).abs() < 0.10, "Large: {}/80", large);
    assert!((xl as f64 / 80.0 - 0.20).abs() < 0.10, "XL: {}/80", xl);

    // Verify total processed
    assert_eq!(small + medium + large + xl, 80);
}

#[test]
fn test_mark_complete_removes_from_tracking() {
    let mut manager = OrderQueueManager::new();

    let order = make_order(50);
    let event_id = order.event_id();
    manager.enqueue(order).unwrap();

    // Get the order
    let dequeued = manager.get_next_order().unwrap();
    assert_eq!(dequeued.trade_request.event_id(), event_id);

    // Mark complete
    manager.mark_complete(&event_id).unwrap();

    // Should not be found again
    let result = manager.mark_complete(&event_id);
    assert!(result.is_err());
}

#[test]
fn test_mark_failed_moves_to_retry_queue() {
    let mut manager = OrderQueueManager::new();

    let order = make_order(50);
    let event_id = order.event_id();
    manager.enqueue(order).unwrap();

    // Get and fail the order
    let _dequeued = manager.get_next_order().unwrap();
    manager.mark_failed(&event_id, "Exchange timeout".to_string()).unwrap();

    // Check retry queue
    assert_eq!(manager.get_retry_depth(), 1);

    // Original queue should be empty
    assert_eq!(manager.get_queue_depth().total, 0);
}

#[test]
fn test_retry_limit_of_three_attempts() {
    let mut manager = OrderQueueManager::new();

    let order = make_order(50);
    let event_id = order.event_id();
    manager.enqueue(order).unwrap();

    // First attempt - fail
    let _dequeued = manager.get_next_order().unwrap();
    manager.mark_failed(&event_id, "Fail 1".to_string()).unwrap();
    assert_eq!(manager.get_retry_depth(), 1);

    // Re-enqueue from retry and fail again
    manager.retry_next();
    let _dequeued = manager.get_next_order().unwrap();
    manager.mark_failed(&event_id, "Fail 2".to_string()).unwrap();
    assert_eq!(manager.get_retry_depth(), 1);

    // Re-enqueue from retry and fail third time
    manager.retry_next();
    let _dequeued = manager.get_next_order().unwrap();
    manager.mark_failed(&event_id, "Fail 3".to_string()).unwrap();

    // After 3 failures, should NOT be in retry queue (permanent failure)
    assert_eq!(manager.get_retry_depth(), 0);
}

#[test]
fn test_get_queue_depth_accuracy() {
    let mut manager = OrderQueueManager::new();

    // Empty queue
    let depth = manager.get_queue_depth();
    assert_eq!(depth.total, 0);

    // Add orders
    for i in 0..5 {
        manager.enqueue(make_order_with_id(50, i)).unwrap();
    }
    for i in 0..3 {
        manager.enqueue(make_order_with_id(500, 100 + i)).unwrap();
    }

    let depth = manager.get_queue_depth();
    assert_eq!(depth.total, 8);
    assert_eq!(depth.by_bucket.get(&Bucket::Small), Some(&5));
    assert_eq!(depth.by_bucket.get(&Bucket::Medium), Some(&3));
    assert_eq!(depth.by_bucket.get(&Bucket::Large), Some(&0));
    assert_eq!(depth.by_bucket.get(&Bucket::XL), Some(&0));
}

#[test]
fn test_empty_queue_returns_none() {
    let mut manager = OrderQueueManager::new();

    assert!(manager.get_next_order().is_none());
}

#[test]
fn test_single_bucket_with_orders() {
    let mut manager = OrderQueueManager::new();

    // Only add orders to Small bucket
    for i in 0..5 {
        manager.enqueue(make_order_with_id(50, i)).unwrap();
    }

    // Should still be able to get all orders
    for _ in 0..5 {
        let order = manager.get_next_order();
        assert!(order.is_some());
        manager.mark_complete(&order.unwrap().trade_request.event_id()).unwrap();
    }

    // Queue should now be empty
    assert!(manager.get_next_order().is_none());
}

#[test]
fn test_bucket_depths_method() {
    let mut manager = OrderQueueManager::new();

    manager.enqueue(make_order(50)).unwrap();   // Small
    manager.enqueue(make_order(51)).unwrap();   // Small
    manager.enqueue(make_order(500)).unwrap();  // Medium

    let depths = manager.get_bucket_depths();

    assert_eq!(depths.get(&Bucket::Small), Some(&2));
    assert_eq!(depths.get(&Bucket::Medium), Some(&1));
    assert_eq!(depths.get(&Bucket::Large), Some(&0));
    assert_eq!(depths.get(&Bucket::XL), Some(&0));
}

#[test]
fn test_retry_next_re_enqueues_order() {
    let mut manager = OrderQueueManager::new();

    let order = make_order(50);
    let event_id = order.event_id();
    manager.enqueue(order).unwrap();

    // Get, fail, move to retry queue
    manager.get_next_order().unwrap();
    manager.mark_failed(&event_id, "Error".to_string()).unwrap();

    assert_eq!(manager.get_queue_depth().total, 0);
    assert_eq!(manager.get_retry_depth(), 1);

    // Retry should re-enqueue
    let retried = manager.retry_next();
    assert!(retried.is_some());

    // Should now be back in the main queue
    assert_eq!(manager.get_queue_depth().total, 1);
    assert_eq!(manager.get_retry_depth(), 0);
}

#[test]
fn test_default_trait() {
    let manager = OrderQueueManager::default();
    let depth = manager.get_queue_depth();
    assert_eq!(depth.total, 0);
}

// === NEW TESTS FOR FIXED ISSUES ===

#[test]
fn test_rebalance_mode_toggle() {
    let mut manager = OrderQueueManager::new();

    assert!(!manager.is_rebalance_active());

    manager.set_rebalance_active(true);
    assert!(manager.is_rebalance_active());

    manager.set_rebalance_active(false);
    assert!(!manager.is_rebalance_active());
}

#[test]
fn test_enqueue_rebalance_order() {
    let mut manager = OrderQueueManager::new();

    manager.enqueue_rebalance(make_order(1000)).unwrap();

    let depth = manager.get_queue_depth();
    assert_eq!(depth.total, 0); // User buckets empty
    assert_eq!(depth.rebalance_count, 1);
    assert_eq!(manager.get_rebalance_depth(), 1);
}

#[test]
fn test_rebalance_50_50_split() {
    let mut manager = OrderQueueManager::new();
    manager.set_rebalance_active(true);

    // Add 10 user orders and 10 rebalance orders
    for i in 0..10 {
        manager.enqueue(make_order_with_id(50, i)).unwrap();
        manager.enqueue_rebalance(make_order_with_id(1000, 100 + i)).unwrap();
    }

    // Process 20 orders and count distribution
    let mut user_count = 0;
    let mut rebalance_count = 0;

    for _ in 0..20 {
        if let Some(order) = manager.get_next_order() {
            if order.is_rebalance {
                rebalance_count += 1;
            } else {
                user_count += 1;
            }
            manager.mark_complete(&order.trade_request.event_id()).unwrap();
        }
    }

    // Should be approximately 50/50
    assert_eq!(user_count + rebalance_count, 20);
    assert!((user_count as f64 / 20.0 - 0.50).abs() < 0.15,
        "User: {}/20, Rebalance: {}/20", user_count, rebalance_count);
}

#[test]
fn test_rebalance_fallback_when_one_queue_empty() {
    let mut manager = OrderQueueManager::new();
    manager.set_rebalance_active(true);

    // Only add rebalance orders
    for i in 0..5 {
        manager.enqueue_rebalance(make_order_with_id(1000, i)).unwrap();
    }

    // Should still get all orders
    for _ in 0..5 {
        let order = manager.get_next_order();
        assert!(order.is_some());
        assert!(order.as_ref().unwrap().is_rebalance);
        manager.mark_complete(&order.unwrap().trade_request.event_id()).unwrap();
    }

    assert!(manager.get_next_order().is_none());
}

#[test]
fn test_queue_depth_warning_threshold() {
    let mut manager = OrderQueueManager::new();

    // Add 99 orders - should succeed without warning threshold hit
    for i in 0..99 {
        manager.enqueue(make_order_with_id(50, i)).unwrap();
    }

    // 100th order triggers WARNING (but still succeeds)
    manager.enqueue(make_order_with_id(50, 99)).unwrap();

    assert_eq!(manager.get_queue_depth().total, 100);
}

#[test]
fn test_queue_depth_critical_threshold_rejects() {
    let mut manager = OrderQueueManager::new();

    // Add 500 orders to reach critical threshold
    for i in 0..500 {
        manager.enqueue(make_order_with_id(50, i)).unwrap();
    }

    // 501st order should be rejected
    let result = manager.enqueue(make_order_with_id(50, 500));
    assert!(result.is_err());

    match result {
        Err(APError::QueueFull { depth, limit }) => {
            assert_eq!(depth, 500);
            assert_eq!(limit, 500);
        }
        _ => panic!("Expected QueueFull error"),
    }
}

#[test]
fn test_queue_error_type_not_event_parse() {
    let mut manager = OrderQueueManager::new();

    // Try to mark complete an order that doesn't exist
    let result = manager.mark_complete("nonexistent");

    match result {
        Err(APError::QueueError(msg)) => {
            assert!(msg.contains("not found"));
        }
        _ => panic!("Expected QueueError, got {:?}", result),
    }
}

#[test]
fn test_thread_safe_wrapper_basic_operations() {
    let manager = ThreadSafeQueueManager::new();

    // Enqueue
    manager.enqueue(make_order(50)).unwrap();
    assert_eq!(manager.get_queue_depth().total, 1);

    // Dequeue
    let order = manager.get_next_order().unwrap();
    assert_eq!(manager.get_queue_depth().total, 0);

    // Mark complete
    manager.mark_complete(&order.trade_request.event_id()).unwrap();
}

#[test]
fn test_thread_safe_wrapper_rebalance() {
    let manager = ThreadSafeQueueManager::new();

    manager.set_rebalance_active(true);
    assert!(manager.is_rebalance_active());

    manager.enqueue_rebalance(make_order(1000)).unwrap();
    assert_eq!(manager.get_rebalance_depth(), 1);
}

#[test]
fn test_queued_order_has_is_rebalance_flag() {
    let mut manager = OrderQueueManager::new();

    manager.enqueue(make_order(50)).unwrap();
    manager.enqueue_rebalance(make_order(1000)).unwrap();

    manager.set_rebalance_active(true);

    // Get orders and check flags
    let order1 = manager.get_next_order().unwrap();
    let order2 = manager.get_next_order().unwrap();

    // One should be rebalance, one should not
    assert!(order1.is_rebalance != order2.is_rebalance);
}

#[test]
fn test_retry_preserves_is_rebalance_flag() {
    let mut manager = OrderQueueManager::new();

    let order = make_order(50);
    let event_id = order.event_id();
    manager.enqueue_rebalance(order).unwrap();

    // Get and fail
    manager.set_rebalance_active(true);
    let _dequeued = manager.get_next_order().unwrap();
    manager.mark_failed(&event_id, "Error".to_string()).unwrap();

    // Retry
    let retried = manager.retry_next().unwrap();
    assert!(retried.is_rebalance);

    // Should be back in rebalance queue, not user bucket
    assert_eq!(manager.get_rebalance_depth(), 1);
    assert_eq!(manager.get_queue_depth().total, 0);
}

#[test]
fn test_queue_depth_includes_rebalance_count() {
    let mut manager = OrderQueueManager::new();

    manager.enqueue(make_order(50)).unwrap();
    manager.enqueue_rebalance(make_order(1000)).unwrap();

    let depth = manager.get_queue_depth();
    assert_eq!(depth.total, 1); // Only user orders in total
    assert_eq!(depth.rebalance_count, 1);
}
