//! Integration tests for the Health Monitor
//!
//! These tests verify the health monitor against a local anvil deployment
//! with Morpho, MetaMorpho vault, ITPNAVOracle, and MirrorIssuerRegistry contracts.
//!
//! Prerequisites:
//! - Anvil running with deployed contracts
//! - Environment variables set for contract addresses

use curator::health_monitor::{
    classify_health_status, compute_health_factor, write_report_to_file, AlertConfig,
    HealthMonitor, HealthReport, HealthStatus, Severity,
};
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::path::PathBuf;
use tempfile::tempdir;

// ============================================================================
// Unit-Level Integration Tests (no chain required)
// ============================================================================

#[test]
fn test_health_report_serialization() {
    // Create a minimal health report and verify it serializes to JSON
    let report = HealthReport {
        timestamp: chrono::Utc::now(),
        positions: vec![],
        oracles: vec![],
        mirror_sync: curator::health_monitor::MirrorSyncStatus {
            l3_nonce: 5,
            mirror_nonce: 5,
            nonce_gap: 0,
            is_synced: true,
            l3_active_count: 3,
            mirror_active_count: 3,
        },
        vault_metrics: curator::health_monitor::VaultMetrics {
            total_assets: U256::from(1000000u64),
            total_supply: U256::from(1000000u64),
            idle_assets: U256::from(200000u64),
            utilization_pct: 80,
            markets_count: 2,
            high_utilization: false,
        },
        alerts: vec![],
        crisis_levels: HashMap::new(),
    };

    // Serialize to JSON
    let json = serde_json::to_string_pretty(&report).unwrap();
    assert!(json.contains("mirror_sync"));
    assert!(json.contains("vault_metrics"));
    assert!(json.contains("is_synced"));
}

#[test]
fn test_write_report_to_file() {
    let report = HealthReport {
        timestamp: chrono::Utc::now(),
        positions: vec![],
        oracles: vec![],
        mirror_sync: curator::health_monitor::MirrorSyncStatus {
            l3_nonce: 10,
            mirror_nonce: 8,
            nonce_gap: 2,
            is_synced: false,
            l3_active_count: 5,
            mirror_active_count: 5,
        },
        vault_metrics: curator::health_monitor::VaultMetrics {
            total_assets: U256::from(5000000u64),
            total_supply: U256::from(5000000u64),
            idle_assets: U256::from(500000u64),
            utilization_pct: 90,
            markets_count: 3,
            high_utilization: false,
        },
        alerts: vec![curator::health_monitor::Alert {
            severity: Severity::Warning,
            category: curator::health_monitor::AlertCategory::Mirror,
            message: "Mirror registry behind L3".to_string(),
            details: serde_json::json!({"nonce_gap": 2}),
        }],
        crisis_levels: HashMap::new(),
    };

    // Write to temp file
    let dir = tempdir().unwrap();
    let path = dir.path().join("health_report.json");

    write_report_to_file(&report, &path).unwrap();

    // Verify file exists and contains expected content
    let content = std::fs::read_to_string(&path).unwrap();
    assert!(content.contains("Mirror registry behind L3"));
    assert!(content.contains("nonce_gap"));
}

#[test]
fn test_health_factor_boundary_values() {
    let config = AlertConfig::default();

    // Test exact boundary at 1.2 (should be Healthy)
    let status = classify_health_status(1.2, &config);
    assert_eq!(status, HealthStatus::Healthy);

    // Test just below 1.2 (should be Warning)
    let status = classify_health_status(1.199, &config);
    assert_eq!(status, HealthStatus::Warning);

    // Test exact boundary at 1.05 (should be Warning)
    let status = classify_health_status(1.05, &config);
    assert_eq!(status, HealthStatus::Warning);

    // Test just below 1.05 (should be Critical)
    let status = classify_health_status(1.049, &config);
    assert_eq!(status, HealthStatus::Critical);

    // Test exact boundary at 1.0 (should be Critical)
    let status = classify_health_status(1.0, &config);
    assert_eq!(status, HealthStatus::Critical);

    // Test just below 1.0 (should be Liquidatable)
    let status = classify_health_status(0.999, &config);
    assert_eq!(status, HealthStatus::Liquidatable);
}

#[test]
fn test_health_factor_extreme_values() {
    // Test very high health factor
    // collateral=10000 ITP, debt=100 USDC, lltv=0.77, price=100e24
    // HF = (10000 * 100 * 0.77) / 100 = 7700
    let collateral = U256::from(10000u64) * U256::exp10(18);
    let debt = U256::from(100u64) * U256::exp10(6);
    let lltv = U256::from(77u64) * U256::exp10(16);
    let price = U256::from(100u64) * U256::exp10(24);

    let hf = compute_health_factor(collateral, debt, lltv, price);
    assert!(hf > 100.0, "Expected very high HF, got {}", hf);

    // Test lower health factor (with more debt)
    // HF = (10000 * 100 * 0.77) / 10000 = 77
    let debt = U256::from(10000u64) * U256::exp10(6);
    let hf = compute_health_factor(collateral, debt, lltv, price);
    assert!(hf > 50.0 && hf < 100.0, "Expected HF between 50 and 100, got {}", hf);
}

#[test]
fn test_custom_alert_config() {
    let config = AlertConfig {
        warning_health_factor: 1.5,
        critical_health_factor: 1.1,
        oracle_stale_secs: std::collections::HashMap::new(),
        high_utilization_pct: 85,
    };

    // With custom thresholds, 1.3 should now be Warning (not Healthy)
    let status = classify_health_status(1.3, &config);
    assert_eq!(status, HealthStatus::Warning);

    // And 1.05 should now be Critical (not Warning)
    let status = classify_health_status(1.05, &config);
    assert_eq!(status, HealthStatus::Critical);
}

// ============================================================================
// Chain-Dependent Integration Tests (require anvil)
// ============================================================================
// These tests are marked as ignored by default since they require a running
// anvil instance with deployed contracts. Run with:
//   cargo test -p curator --test health_monitor_integration -- --ignored

#[tokio::test]
#[ignore = "Requires anvil with deployed contracts"]
async fn test_health_monitor_full_scan() {
    // This test would:
    // 1. Connect to anvil with deployed Morpho contracts
    // 2. Create a borrow position
    // 3. Run health monitor scan
    // 4. Verify JSON report generated with correct data

    // Placeholder for now - would be implemented with actual contract deployment
    // let monitor = HealthMonitor::new(
    //     "http://localhost:8545",
    //     "http://localhost:8546",
    //     morpho_address,
    //     vault_address,
    //     vec![oracle_address],
    //     vec![itp_address],
    //     mirror_registry_address,
    //     l3_registry_address,
    //     vec![market_id],
    //     AlertConfig::default(),
    // ).unwrap();
    //
    // let report = monitor.run_scan_cycle().await.unwrap();
    // assert!(report.positions.is_empty() || report.positions.len() > 0);
}

#[tokio::test]
#[ignore = "Requires anvil with deployed contracts"]
async fn test_health_monitor_detects_stale_oracle() {
    // This test would:
    // 1. Connect to anvil with deployed oracle
    // 2. Advance block timestamp past staleness threshold
    // 3. Run oracle freshness check
    // 4. Verify stale flag is true and warning alert generated
}

#[tokio::test]
#[ignore = "Requires anvil with deployed contracts"]
async fn test_health_monitor_detects_low_health_position() {
    // This test would:
    // 1. Connect to anvil with deployed Morpho
    // 2. Create an undercollateralized position
    // 3. Run position scan
    // 4. Verify warning/critical alert generated
}
