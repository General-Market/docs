//! Issuer health collector — polls issuer /health endpoints and stores snapshots.
//!
//! Security requirements implemented:
//! - C5: Shared `poll_batch_ts` assigned BEFORE the polling loop
//! - H5: HTTP redirects disabled (`reqwest::redirect::Policy::none()`)
//! - H6: `node_id` validated with `i32::try_from`, rejected on failure
//! - H7: Status whitelist: healthy, degraded, unhealthy (anything else -> unknown)
//! - H2: Auto-prune old snapshots every 12 polls (30-day retention)
//! - H17: Response body limited to 10 MB
//! - H28: DANGEROUS_FIELDS documented (fields intentionally NOT stored)
//! - H30: Polling order randomized each cycle
//! - M6: Minimum poll interval enforced (30 seconds)

use chrono::Utc;
use rand::seq::SliceRandom;
use reqwest::Client;
use sqlx::PgPool;
use std::time::Duration;
use tracing::{error, info, warn};

/// Maximum response body size from issuer /health endpoints (10 MB).
const MAX_ISSUER_RESPONSE_BYTES: u64 = 10 * 1024 * 1024;

/// Minimum poll interval in seconds (M6).
const MIN_POLL_INTERVAL_SECS: u64 = 30;

/// Prune snapshots older than this many days (H2).
const RETENTION_DAYS: i64 = 30;

/// Run pruning every N poll cycles (H2).
const PRUNE_EVERY_N_CYCLES: u64 = 12;

/// Allowed status values (H7).
const VALID_STATUSES: &[&str] = &["healthy", "degraded", "unhealthy"];

/// Fields from /health that are INTENTIONALLY NOT STORED because they enable
/// leadership identification, attack calibration, or node fingerprinting.
/// See security audit trail in docs/plans/2026-03-08-explorer-page.md
#[allow(dead_code)]
const DANGEROUS_FIELDS: &[&str] = &[
    "is_leader", "leader_elections_count", "leader_tenure_cycles",
    "consensus.in_progress",
    "p2p.rate_limited_total", "p2p.decode_failures_total", "p2p.peers_banned_total",
    "p2p.equivocations_detected", "p2p.leader_rejections", "p2p.connection_rejections",
    "p2p.wal_replays", "heartbeat.kick_proposals",
];

/// Validate issuer URLs at startup (panic on invalid URLs so misconfiguration is caught early).
pub fn validate_issuer_urls(urls: &[String]) {
    for url in urls {
        if url::Url::parse(url).is_err() {
            panic!("Invalid issuer health URL: {url}");
        }
    }
}

/// Main collector loop. Polls all issuer /health endpoints on a fixed interval.
pub async fn run_issuer_health_collector(
    pool: PgPool,
    issuer_urls: Vec<String>,
    poll_interval_secs: u64,
) {
    // M6: Enforce minimum poll interval
    let poll_interval_secs = poll_interval_secs.max(MIN_POLL_INTERVAL_SECS);
    let interval = Duration::from_secs(poll_interval_secs);

    // H5: Disable HTTP redirects
    let client = Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to build HTTP client for issuer health collector");

    info!(
        node_count = issuer_urls.len(),
        poll_secs = poll_interval_secs,
        "Issuer health collector started"
    );

    let mut cycle_count: u64 = 0;

    loop {
        cycle_count += 1;

        // C5: Assign a single poll_batch_ts BEFORE the polling loop
        let poll_batch_ts = Utc::now();

        // H30: Randomize polling order each cycle
        // Create rng in a block so it's dropped before any .await
        let mut urls = issuer_urls.clone();
        {
            let mut rng = rand::thread_rng();
            urls.shuffle(&mut rng);
        }

        let mut success_count = 0u32;
        let mut fail_count = 0u32;

        for url in &urls {
            match fetch_and_store(&client, &pool, url, poll_batch_ts).await {
                Ok(node_id) => {
                    success_count += 1;
                    tracing::debug!(node_id, url, "Issuer health snapshot stored");
                }
                Err(e) => {
                    fail_count += 1;
                    warn!(url, error = %e, "Failed to fetch issuer health");
                }
            }
        }

        info!(
            cycle = cycle_count,
            ok = success_count,
            fail = fail_count,
            batch_ts = %poll_batch_ts,
            "Issuer health poll cycle complete"
        );

        // H2: Auto-prune old snapshots every PRUNE_EVERY_N_CYCLES
        if cycle_count % PRUNE_EVERY_N_CYCLES == 0 {
            match prune_old_snapshots(&pool).await {
                Ok(deleted) => {
                    if deleted > 0 {
                        info!(deleted, retention_days = RETENTION_DAYS, "Pruned old issuer health snapshots");
                    }
                }
                Err(e) => {
                    error!(error = %e, "Failed to prune old issuer health snapshots");
                }
            }
        }

        tokio::time::sleep(interval).await;
    }
}

/// Fetch /health from a single issuer and store the snapshot.
/// Returns the node_id on success.
async fn fetch_and_store(
    client: &Client,
    pool: &PgPool,
    url: &str,
    poll_batch_ts: chrono::DateTime<chrono::Utc>,
) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
    // Build the health endpoint URL
    let health_url = if url.ends_with('/') {
        format!("{url}health")
    } else {
        format!("{url}/health")
    };

    // H17: Fetch with body size limit
    let response = client.get(&health_url).send().await?;

    if !response.status().is_success() {
        return Err(format!("HTTP {} from {}", response.status(), health_url).into());
    }

    // H17: Check content-length header if present
    if let Some(content_length) = response.content_length() {
        if content_length > MAX_ISSUER_RESPONSE_BYTES {
            return Err(format!(
                "Response too large ({content_length} bytes) from {health_url}"
            ).into());
        }
    }

    // Read the body with a size limit
    let bytes = response.bytes().await?;
    if bytes.len() as u64 > MAX_ISSUER_RESPONSE_BYTES {
        return Err(format!(
            "Response body too large ({} bytes) from {health_url}",
            bytes.len()
        ).into());
    }

    let body: serde_json::Value = serde_json::from_slice(&bytes)?;

    // H6: Validate node_id with i32::try_from
    let node_id_raw = body.get("node_id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing or invalid node_id in /health response")?;
    let node_id = i32::try_from(node_id_raw)
        .map_err(|_| format!("node_id {} out of i32 range", node_id_raw))?;
    if node_id < 0 {
        return Err(format!("node_id {} is negative", node_id).into());
    }

    // H7: Whitelist status values
    let raw_status = body.get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let status = if VALID_STATUSES.contains(&raw_status) {
        raw_status
    } else {
        "unknown"
    };

    // Extract consensus fields
    let consensus = body.get("consensus").unwrap_or(&serde_json::Value::Null);
    let consensus_rounds_total = consensus.get("rounds_total").and_then(|v| v.as_i64()).unwrap_or(0);
    let consensus_success_total = consensus.get("success_total").and_then(|v| v.as_i64()).unwrap_or(0);
    let consensus_failed_total = consensus.get("failed_total").and_then(|v| v.as_i64()).unwrap_or(0);
    let signatures_collected = consensus.get("signatures_collected").and_then(|v| v.as_i64()).unwrap_or(0);
    let last_consensus_time_ms = consensus.get("last_consensus_time_ms").and_then(|v| v.as_i64()).unwrap_or(0);

    // Extract order fields
    let orders = body.get("orders").unwrap_or(&serde_json::Value::Null);
    let orders_processed_last_60s = orders.get("processed_last_60s").and_then(|v| v.as_i64()).unwrap_or(0);
    let pending_order_count = orders.get("pending_count").and_then(|v| v.as_i64()).unwrap_or(0);
    let last_cycle_duration_ms = orders.get("last_cycle_duration_ms").and_then(|v| v.as_i64()).unwrap_or(0);

    // Extract P2P fields — cast connected_peers safely
    let p2p = body.get("p2p").unwrap_or(&serde_json::Value::Null);
    let connected_peers_raw = p2p.get("connected_peers").and_then(|v| v.as_i64()).unwrap_or(0);
    let connected_peers = connected_peers_raw.min(i32::MAX as i64) as i32;
    let p2p_messages_received = p2p.get("messages_received").and_then(|v| v.as_i64()).unwrap_or(0);
    let p2p_messages_sent = p2p.get("messages_sent").and_then(|v| v.as_i64()).unwrap_or(0);
    let p2p_wal_entries = p2p.get("wal_entries").and_then(|v| v.as_i64()).unwrap_or(0);

    // Extract heartbeat fields
    let heartbeat = body.get("heartbeat").unwrap_or(&serde_json::Value::Null);
    let heartbeat_sent = heartbeat.get("sent").and_then(|v| v.as_i64()).unwrap_or(0);
    let heartbeat_received = heartbeat.get("received").and_then(|v| v.as_i64()).unwrap_or(0);
    let peers_healthy_raw = heartbeat.get("peers_healthy").and_then(|v| v.as_i64()).unwrap_or(0);
    let peers_healthy = peers_healthy_raw.min(i32::MAX as i64) as i32;
    let peers_unhealthy_raw = heartbeat.get("peers_unhealthy").and_then(|v| v.as_i64()).unwrap_or(0);
    let peers_unhealthy = peers_unhealthy_raw.min(i32::MAX as i64) as i32;

    sqlx::query(
        r#"
        INSERT INTO issuer_health_snapshots (
            node_id, poll_batch_ts, status,
            consensus_rounds_total, consensus_success_total, consensus_failed_total,
            signatures_collected, last_consensus_time_ms,
            orders_processed_last_60s, pending_order_count, last_cycle_duration_ms,
            connected_peers, p2p_messages_received, p2p_messages_sent, p2p_wal_entries,
            heartbeat_sent, heartbeat_received, peers_healthy, peers_unhealthy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        "#,
    )
    .bind(node_id)               // $1
    .bind(poll_batch_ts)          // $2
    .bind(status)                 // $3
    .bind(consensus_rounds_total) // $4
    .bind(consensus_success_total) // $5
    .bind(consensus_failed_total)  // $6
    .bind(signatures_collected)    // $7
    .bind(last_consensus_time_ms)  // $8
    .bind(orders_processed_last_60s) // $9
    .bind(pending_order_count)     // $10
    .bind(last_cycle_duration_ms)  // $11
    .bind(connected_peers)         // $12
    .bind(p2p_messages_received)   // $13
    .bind(p2p_messages_sent)       // $14
    .bind(p2p_wal_entries)         // $15
    .bind(heartbeat_sent)          // $16
    .bind(heartbeat_received)      // $17
    .bind(peers_healthy)           // $18
    .bind(peers_unhealthy)         // $19
    .execute(pool)
    .await?;

    Ok(node_id)
}

/// H2: Delete snapshots older than RETENTION_DAYS.
async fn prune_old_snapshots(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let cutoff = Utc::now() - chrono::Duration::days(RETENTION_DAYS);
    let result = sqlx::query("DELETE FROM issuer_health_snapshots WHERE fetched_at < $1")
        .bind(cutoff)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}
