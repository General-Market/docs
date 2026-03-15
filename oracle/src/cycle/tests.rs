//! Unit tests for the cycle management module.

use super::*;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;

/// Test that phases transition in the correct order.
#[test]
fn test_phase_transition_order() {
    let phases = [
        CyclePhase::ProcessFills,
        CyclePhase::Netting,
        CyclePhase::InventoryCheck,
        CyclePhase::GenerateBatch,
        CyclePhase::SignSubmit,
    ];

    // Verify forward transitions
    for i in 0..phases.len() {
        let next_idx = (i + 1) % phases.len();
        assert_eq!(
            phases[i].next(),
            phases[next_idx],
            "Phase {:?} should transition to {:?}",
            phases[i],
            phases[next_idx]
        );
    }

    // Verify wrapping from SignSubmit back to ProcessFills
    assert_eq!(CyclePhase::SignSubmit.next(), CyclePhase::ProcessFills);
}

/// Test phase index and from_index methods.
#[test]
fn test_phase_indexing() {
    for (i, phase) in CyclePhase::all().iter().enumerate() {
        assert_eq!(phase.index(), i);
        assert_eq!(CyclePhase::from_index(i), Some(*phase));
    }

    // Invalid index should return None
    assert_eq!(CyclePhase::from_index(5), None);
    assert_eq!(CyclePhase::from_index(100), None);
}

/// Test cycle state monotonic increment.
#[test]
fn test_cycle_number_monotonic_increment() {
    let mut state = CycleState::new(0);

    assert_eq!(state.get_current_cycle(), 0);

    // Advance through one full cycle
    for _ in 0..5 {
        state.advance_phase();
    }

    // After completing one full cycle (5 phases), we should be at cycle 1
    assert_eq!(state.get_current_cycle(), 1);
    assert_eq!(state.get_cycle_phase(), CyclePhase::ProcessFills);

    // Advance through another full cycle
    for _ in 0..5 {
        state.advance_phase();
    }

    assert_eq!(state.get_current_cycle(), 2);
}

/// Test cycle state tracks phases correctly.
#[test]
fn test_cycle_state_phase_tracking() {
    let mut state = CycleState::new(0);

    assert_eq!(state.get_cycle_phase(), CyclePhase::ProcessFills);

    state.advance_phase();
    assert_eq!(state.get_cycle_phase(), CyclePhase::Netting);

    state.advance_phase();
    assert_eq!(state.get_cycle_phase(), CyclePhase::InventoryCheck);

    state.advance_phase();
    assert_eq!(state.get_cycle_phase(), CyclePhase::GenerateBatch);

    state.advance_phase();
    assert_eq!(state.get_cycle_phase(), CyclePhase::SignSubmit);

    // Next advance should wrap to ProcessFills and increment cycle
    let cycle_before = state.get_current_cycle();
    state.advance_phase();
    assert_eq!(state.get_cycle_phase(), CyclePhase::ProcessFills);
    assert_eq!(state.get_current_cycle(), cycle_before + 1);
}

/// Test cycle state serialization for JSON logging.
#[test]
fn test_cycle_state_serialization() {
    let state = CycleState::new(42);

    let json = serde_json::to_string(&state).expect("Should serialize");
    assert!(json.contains("42")); // cycle_number
    assert!(json.contains("PROCESS_FILLS")); // phase in SCREAMING_SNAKE_CASE

    let deserialized: CycleState = serde_json::from_str(&json).expect("Should deserialize");
    assert_eq!(deserialized.get_current_cycle(), 42);
    assert_eq!(deserialized.get_cycle_phase(), CyclePhase::ProcessFills);
}

/// Test phase serialization.
#[test]
fn test_phase_serialization() {
    let phases = CyclePhase::all();
    let expected_names = [
        "PROCESS_FILLS",
        "NETTING",
        "INVENTORY_CHECK",
        "GENERATE_BATCH",
        "SIGN_SUBMIT",
    ];

    for (phase, expected) in phases.iter().zip(expected_names.iter()) {
        let json = serde_json::to_string(phase).expect("Should serialize");
        assert_eq!(json, format!("\"{}\"", expected));
    }
}

/// Test configurable cycle duration.
#[test]
fn test_configurable_cycle_duration() {
    let config_100ms = CycleConfig::with_duration_ms(100);
    assert_eq!(config_100ms.cycle_duration_ms, 100);
    assert_eq!(config_100ms.phase_duration_ms(), 20); // 100ms / 5 phases

    let config_500ms = CycleConfig::with_duration_ms(500);
    assert_eq!(config_500ms.cycle_duration_ms, 500);
    assert_eq!(config_500ms.phase_duration_ms(), 100); // 500ms / 5 phases

    let config_default = CycleConfig::default();
    assert_eq!(config_default.cycle_duration_ms, 1000);
    assert_eq!(config_default.phase_duration_ms(), 200); // 1000ms / 5 phases
}

/// Test CycleManager creation and accessors.
#[test]
fn test_cycle_manager_creation() {
    let manager = CycleManager::new(CycleConfig::default().with_issuer_id(5));

    assert_eq!(manager.get_current_cycle(), 0);
    assert_eq!(manager.get_cycle_phase(), CyclePhase::ProcessFills);
}

/// Test CycleManager with starting cycle.
#[test]
fn test_cycle_manager_starting_cycle() {
    let manager = CycleManager::new(CycleConfig::default()).with_starting_cycle(100);

    assert_eq!(manager.get_current_cycle(), 100);
    assert_eq!(manager.get_cycle_phase(), CyclePhase::ProcessFills);
}

/// Test time synchronization check with no reference time.
#[test]
fn test_time_sync_no_reference() {
    let manager = CycleManager::new(CycleConfig::default());

    // With no reference time, should always report synchronized
    assert!(manager.is_time_synchronized());
    assert!(manager.get_timing_drift_ms().is_none());
}

/// Test time synchronization check with reference time.
#[test]
fn test_time_sync_with_reference() {
    let mut manager = CycleManager::new(CycleConfig::default());

    // Set reference time to now
    let now = std::time::SystemTime::now();
    manager.set_reference_time(now);

    // Should be synchronized (drift near zero)
    assert!(manager.is_time_synchronized());

    let drift = manager.get_timing_drift_ms().expect("Should have drift");
    assert!(drift.abs() < 50, "Drift should be minimal: {} ms", drift);
}

/// Test phase start/end detection.
#[test]
fn test_phase_start_end_detection() {
    assert!(CyclePhase::ProcessFills.is_cycle_start());
    assert!(!CyclePhase::ProcessFills.is_cycle_end());

    assert!(!CyclePhase::SignSubmit.is_cycle_start());
    assert!(CyclePhase::SignSubmit.is_cycle_end());

    // Middle phases are neither start nor end
    assert!(!CyclePhase::Netting.is_cycle_start());
    assert!(!CyclePhase::Netting.is_cycle_end());
}

/// Test phase display formatting.
#[test]
fn test_phase_display() {
    assert_eq!(format!("{}", CyclePhase::ProcessFills), "PROCESS_FILLS");
    assert_eq!(format!("{}", CyclePhase::Netting), "NETTING");
    assert_eq!(format!("{}", CyclePhase::InventoryCheck), "INVENTORY_CHECK");
    assert_eq!(format!("{}", CyclePhase::GenerateBatch), "GENERATE_BATCH");
    assert_eq!(format!("{}", CyclePhase::SignSubmit), "SIGN_SUBMIT");
}

/// Test CycleState reset functionality.
#[test]
fn test_cycle_state_reset() {
    let mut state = CycleState::new(0);

    // Advance through several phases
    for _ in 0..7 {
        state.advance_phase();
    }

    assert!(state.get_current_cycle() > 0);
    assert_ne!(state.get_cycle_phase(), CyclePhase::ProcessFills);

    // Reset to a specific cycle
    state.reset_to_cycle(50);

    assert_eq!(state.get_current_cycle(), 50);
    assert_eq!(state.get_cycle_phase(), CyclePhase::ProcessFills);
}

/// Test phase count constant.
#[test]
fn test_phase_count() {
    assert_eq!(CyclePhase::count(), 5);
    assert_eq!(CyclePhase::all().len(), 5);
}

/// Integration test: CycleManager runs cycles with fast timing.
#[tokio::test]
async fn test_cycle_manager_runs_cycles() {
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();

    let phase_count = Arc::new(AtomicU64::new(0));
    let phase_count_clone = phase_count.clone();

    let manager = CycleManager::for_testing(100, 1) // 100ms cycles = 20ms per phase
        .on_phase_transition(move |_phase, _cycle| {
            phase_count_clone.fetch_add(1, Ordering::Relaxed);
        });

    // Run for ~250ms, should see multiple phase transitions
    let handle = tokio::spawn(async move {
        manager.start(shutdown).await;
    });

    tokio::time::sleep(Duration::from_millis(250)).await;
    shutdown_clone.store(true, Ordering::Relaxed);

    // Wait for shutdown with timeout
    timeout(Duration::from_millis(100), handle)
        .await
        .expect("Should complete within timeout")
        .expect("Task should not panic");

    let transitions = phase_count.load(Ordering::Relaxed);
    assert!(
        transitions >= 5,
        "Should have at least 5 transitions, got {}",
        transitions
    );
}

/// Test graceful shutdown during any phase.
#[tokio::test]
async fn test_graceful_shutdown_during_phase() {
    for start_delay in [10, 30, 50, 70, 90] {
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

        let manager = CycleManager::for_testing(100, 1);

        let handle = tokio::spawn(async move {
            manager.start_with_channel(shutdown_rx).await;
        });

        // Wait for a specific duration then shutdown
        tokio::time::sleep(Duration::from_millis(start_delay)).await;
        shutdown_tx.send(()).expect("Should send shutdown");

        // Should complete gracefully
        timeout(Duration::from_millis(100), handle)
            .await
            .expect("Should complete within timeout")
            .expect("Task should not panic");
    }
}

/// Test state subscription mechanism.
#[tokio::test]
async fn test_state_subscription() {
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();

    let manager = CycleManager::for_testing(100, 1);
    let mut state_rx = manager.subscribe();

    let handle = tokio::spawn(async move {
        manager.start(shutdown).await;
    });

    // Wait for state update
    let result = timeout(Duration::from_millis(200), state_rx.changed()).await;
    assert!(result.is_ok(), "Should receive state update");

    // Check we can read the state
    let state = state_rx.borrow();
    assert!(state.get_current_cycle() >= 0);

    shutdown_clone.store(true, Ordering::Relaxed);
    let _ = timeout(Duration::from_millis(100), handle).await;
}
