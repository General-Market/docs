//! Shared Vision utilities
//!
//! Functions extracted from the now-deleted engine.rs that are used by
//! lifecycle.rs and other surviving modules. Kept here to avoid duplication.

use std::collections::HashMap;
use ethers::types::H256;

/// Parse resolution type string to numeric code.
///
/// Matches the on-chain enum: up_0=0, up_30=1, ... flat_3000=13.
pub fn parse_resolution_type(s: &str) -> u8 {
    match s {
        "up_0" => 0,
        "up_30" => 1,
        "up_x" => 2,
        "down_0" => 3,
        "down_30" => 4,
        "down_x" => 5,
        "flat_0" => 6,
        "flat_x" => 7,
        // Extended types (codes 8-13)
        "up_300" => 8,
        "up_3000" => 9,
        "down_300" => 10,
        "down_3000" => 11,
        "flat_300" => 12,
        "flat_3000" => 13,
        _ => {
            tracing::warn!(res_type = s, "Unknown resolution type — treating as Cancelled");
            255
        }
    }
}

/// Compute the market_id (keccak256 of raw UTF-8 bytes of asset_id).
/// Matches `cast keccak $(cast --from-utf8 asset_id)` used in batch creation.
pub fn asset_id_to_market_id(asset_id: &str) -> H256 {
    H256::from(ethers::utils::keccak256(asset_id.as_bytes()))
}

/// Parsed snapshot data for a source:
/// - market_id -> current price scaled by 1e8 (i128, integer, signed for negative values)
/// - market_id -> change_pct (f64, used only for start_price fallback)
/// - market_id -> fetched_at unix timestamp
pub type SnapshotData = (HashMap<H256, i128>, HashMap<H256, f64>, HashMap<H256, i64>);

/// Fetch market prices from the data-node's Vision snapshot endpoint
/// with optional HMAC-SHA256 verification.
pub async fn fetch_snapshot_data_inner_with_secret(
    data_node_url: &str,
    source_id: &str,
    hmac_secret: &Option<String>,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/vision/snapshot?source={}&limit=10000", data_node_url, source_id);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .gzip(true)
        .build()?;

    let response = client.get(&url).send().await?;

    // Verify HMAC-SHA256 signature if secret is configured (IS-7)
    if let Some(secret) = hmac_secret {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        let hmac_header = response
            .headers()
            .get("x-snapshot-hmac")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let body_text = response.text().await?;

        if let Some(received_hmac) = hmac_header {
            let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
                .expect("HMAC can take key of any size");
            mac.update(body_text.as_bytes());
            let expected = hex::encode(mac.finalize().into_bytes());
            if received_hmac != expected {
                tracing::error!(
                    "Snapshot HMAC mismatch — possible tampering. received={} expected={}",
                    received_hmac,
                    expected
                );
                return Err("HMAC verification failed — snapshot may have been tampered with".into());
            }
            tracing::debug!("Snapshot HMAC-SHA256 verification successful");
        } else {
            return Err("Snapshot HMAC header missing — rejecting unauthenticated data".into());
        }

        let json: serde_json::Value = serde_json::from_str(&body_text)?;
        parse_snapshot_data(json)
    } else {
        let json: serde_json::Value = response.json().await?;
        parse_snapshot_data(json)
    }
}

/// Parse the JSON response from `/vision/snapshot` into typed snapshot data.
pub fn parse_snapshot_data(
    json: serde_json::Value,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let snapshots = json
        .get("snapshots")
        .and_then(|s| s.as_array())
        .ok_or("data-node snapshot response missing 'snapshots' array")?;

    let mut current_values: HashMap<H256, i128> = HashMap::new();
    let mut change_pcts: HashMap<H256, f64> = HashMap::new();
    let mut fetched_at_map: HashMap<H256, i64> = HashMap::new();

    for snap in snapshots {
        let asset_id = snap
            .get("asset_id")
            .or_else(|| snap.get("assetId"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if asset_id.is_empty() {
            continue;
        }

        let market_id = asset_id_to_market_id(asset_id);

        let value: i128 = if let Some(scaled) = snap.get("value_scaled").and_then(|v| v.as_str()) {
            match scaled.parse::<i128>() {
                Ok(v) => v,
                Err(_) => {
                    tracing::warn!(market = ?market_id, raw = scaled, "Unparseable value_scaled — skipping market");
                    continue;
                }
            }
        } else if let Some(f) = snap.get("value").and_then(|v| v.as_f64()) {
            (f * 1e8).round() as i128
        } else if let Some(s) = snap.get("value").and_then(|v| v.as_str()) {
            match s.parse::<f64>() {
                Ok(f) => (f * 1e8).round() as i128,
                Err(_) => {
                    tracing::warn!(market = ?market_id, "Unparseable price value — skipping market");
                    continue;
                }
            }
        } else {
            tracing::warn!(market = ?market_id, "Missing price value — skipping market");
            continue;
        };

        if value != 0 {
            current_values.insert(market_id, value);
        }

        let change_pct = snap
            .get("change_pct")
            .or_else(|| snap.get("changePct"))
            .and_then(|v| {
                if let Some(f) = v.as_f64() {
                    Some(f)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            });
        if let Some(pct) = change_pct {
            change_pcts.insert(market_id, pct);
        }

        let fetched_at = snap
            .get("fetched_at")
            .or_else(|| snap.get("fetchedAt"))
            .and_then(|v| {
                if let Some(ts) = v.as_i64() {
                    Some(ts)
                } else if let Some(s) = v.as_str() {
                    chrono::DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.timestamp())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| {
                tracing::warn!(asset_id, "Missing fetched_at in snapshot — defaulting to 0");
                0
            });
        fetched_at_map.insert(market_id, fetched_at);
    }

    tracing::info!(
        total_snapshots = snapshots.len(),
        "Parsed snapshot data from response"
    );

    Ok((current_values, change_pcts, fetched_at_map))
}

/// Fetch snapshot data with exponential backoff retry.
///
/// Attempts up to 4 fetches total: immediate + 3 retries at 5s, 15s, 45s delays.
pub async fn fetch_snapshot_with_retry(
    data_node_url: &str,
    source_id: &str,
    hmac_secret: &Option<String>,
) -> Result<SnapshotData, Box<dyn std::error::Error + Send + Sync>> {
    let delays = [
        std::time::Duration::from_secs(5),
        std::time::Duration::from_secs(5),
        std::time::Duration::from_secs(45),
    ];
    let mut last_err: Option<Box<dyn std::error::Error + Send + Sync>> = None;

    for (attempt, delay) in std::iter::once(std::time::Duration::ZERO)
        .chain(delays.iter().copied())
        .enumerate()
    {
        if attempt > 0 {
            tracing::warn!(
                attempt,
                source = source_id,
                delay_secs = delay.as_secs(),
                "Data-node fetch failed, retrying after delay"
            );
            tokio::time::sleep(delay).await;
        }

        match fetch_snapshot_data_inner_with_secret(data_node_url, source_id, hmac_secret).await {
            Ok(data) => return Ok(data),
            Err(e) => {
                tracing::warn!(
                    attempt,
                    source = source_id,
                    error = %e,
                    "Data-node snapshot fetch failed"
                );
                last_err = Some(e);
            }
        }
    }

    Err(last_err.unwrap_or_else(|| "All data-node fetch retries exhausted".into()))
}

/// Per-source staleness ceiling (seconds).
///
/// Sources that publish daily/weekly/monthly have legitimate data gaps.
/// Real-time sources fall back to `tick_duration * 2`.
pub const SOURCE_MAX_AGE_SECS: &[(&str, u64)] = &[
    ("rates",     3 * 86400),
    ("bls",       3 * 86400),
    ("worldbank", 7 * 86400),
    ("eia",       3 * 86400),
    ("ecb",       3 * 86400),
    ("boe",       3 * 86400),
    ("bonds",     3 * 86400),
    ("imf",       7 * 86400),
    ("cftc",      3 * 86400),
    ("sec_efts",  3 * 86400),
    ("finra",     3 * 86400),
    ("finra_short_vol", 3 * 86400),
    ("fred",      3 * 86400),
    ("congress",  3 * 86400),
    ("yahoo_drinks", 3 * 86400),
];

/// Get the maximum age in seconds for a source's data before it is considered stale.
pub fn source_max_age_secs(source_id: &str, tick_duration_secs: u64) -> u64 {
    if let Some(&(_, cap)) = SOURCE_MAX_AGE_SECS.iter().find(|(id, _)| *id == source_id) {
        cap
    } else {
        tick_duration_secs.saturating_mul(2)
    }
}

/// Record settlements to data-node for threshold feedback loop.
///
/// `source_id` is the human-readable source name (e.g. "twitch", "crypto").
/// The data-node keys `batch_settlements.source_id` on this string and the
/// threshold feedback queries filter by it — an empty string makes every row
/// invisible to the source it belongs to.
///
/// `change_pct` is percent (2.5 = 2.5%). The oracle carries bps internally
/// (`pct_change_bps: i64`); we convert here so data-node's
/// `sanitize_threshold_bps(abs * 100)` lands in the right range.
pub async fn record_settlements(
    data_node_url: &str,
    admin_token: &str,
    source_id: &str,
    result: &super::types::TickResult,
    config_hash: &H256,
) {
    let settlements: Vec<serde_json::Value> = result
        .market_results
        .iter()
        .filter(|r| !matches!(r.outcome, super::types::MarketOutcome::Cancelled))
        .map(|r| {
            serde_json::json!({
                "sourceId": source_id,
                "assetId": r.asset_id,
                "configHash": format!("0x{}", hex::encode(config_hash)),
                "startPrice": r.start_price,
                "endPrice": r.end_price,
                "changePct": (r.pct_change_bps as f64) / 100.0,
            })
        })
        .collect();

    if settlements.is_empty() {
        return;
    }

    let client = reqwest::Client::new();
    if let Err(e) = client
        .post(&format!("{}/batches/settlement", data_node_url))
        .header("x-admin-token", admin_token)
        .json(&settlements)
        .send()
        .await
    {
        tracing::warn!(error = %e, "Failed to record settlements to data-node");
    }
}

/// Fetch the latest block timestamp from the RPC node.
/// Falls back to wall clock if the RPC call fails.
pub async fn get_chain_timestamp(rpc_url: &str) -> u64 {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBlockByNumber",
        "params": ["latest", false],
        "id": 1
    });
    match client.post(rpc_url).json(&body).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(ts_hex) = json["result"]["timestamp"].as_str() {
                    let ts_hex = ts_hex.trim_start_matches("0x");
                    if let Ok(ts) = u64::from_str_radix(ts_hex, 16) {
                        return ts;
                    }
                }
            }
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        }
        Err(_) => std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }
}
