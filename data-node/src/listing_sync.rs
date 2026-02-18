//! Fetch Bitget spot listing/delisting dates from the public symbols API
//! and store them in the `bitget_listings` table.
//!
//! Supports both one-shot CLI mode (`run`) and background daily sync (`run_daily`).

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use tracing::{info, warn};

use crate::config::SyncListingsArgs;
use crate::db::{self, BitgetListingRow};

const DEFAULT_SYMBOLS_URL: &str = "https://api.bitget.com/api/v2/spot/public/symbols";

#[derive(Debug, Deserialize)]
struct BitgetResponse {
    code: String,
    data: Option<Vec<BitgetSymbol>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BitgetSymbol {
    symbol: String,
    base_coin: String,
    quote_coin: String,
    status: String,
    open_time: String,
    off_time: String,
}

fn parse_ms_timestamp(ms_str: &str) -> Option<DateTime<Utc>> {
    if ms_str.is_empty() || ms_str == "0" {
        return None;
    }
    let ms: i64 = ms_str.parse().ok()?;
    DateTime::from_timestamp_millis(ms)
}

/// Result of a listing sync operation.
#[derive(Debug)]
pub struct SyncResult {
    pub upserted: u64,
    pub disappeared: usize,
    pub total: usize,
}

/// Pure function: compute which DB symbols disappeared from the API response.
pub fn compute_disappeared(db_symbols: &[String], api_symbols: &HashSet<String>) -> Vec<String> {
    db_symbols
        .iter()
        .filter(|s| !api_symbols.contains(s.as_str()))
        .cloned()
        .collect()
}

/// Core sync logic: fetch from Bitget API, upsert to DB, detect disappeared pairs.
///
/// `base_url` allows overriding the Bitget API endpoint (for testing).
pub async fn sync_listings_core(
    pool: &PgPool,
    base_url: &str,
) -> Result<SyncResult, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/api/v2/spot/public/symbols", base_url);

    // Snapshot DB symbols before upsert (for diff detection)
    let db_symbols = db::bitget_query_active_symbols(pool).await?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let resp: BitgetResponse = client.get(&url).send().await?.json().await?;

    if resp.code != "00000" {
        return Err(format!("Bitget API error: code={}", resp.code).into());
    }

    let symbols = resp.data.unwrap_or_default();
    let total = symbols.len();
    info!(total, "Received symbols from Bitget");

    let mut rows = Vec::with_capacity(symbols.len());
    let mut api_symbol_set = HashSet::with_capacity(symbols.len());
    let mut skipped = 0u32;

    for s in &symbols {
        let listed_at = match parse_ms_timestamp(&s.open_time) {
            Some(dt) => dt,
            None => {
                warn!(symbol = %s.symbol, open_time = %s.open_time, "Skipping: invalid openTime");
                skipped += 1;
                continue;
            }
        };
        let delisted_at = parse_ms_timestamp(&s.off_time);

        api_symbol_set.insert(s.symbol.clone());
        rows.push(BitgetListingRow {
            symbol: s.symbol.clone(),
            base_coin: s.base_coin.clone(),
            quote_coin: s.quote_coin.clone(),
            listed_at,
            delisted_at,
            status: s.status.clone(),
        });
    }

    // Upsert all rows from API
    let upserted = db::bitget_batch_upsert_listings(pool, &rows).await?;

    // Diff detection: find symbols in DB but NOT in API response
    let disappeared = compute_disappeared(&db_symbols, &api_symbol_set);
    let disappeared_count = disappeared.len();

    if !disappeared.is_empty() {
        info!(count = disappeared_count, "Detected disappeared symbols, marking as delisted_gone");
        let marked = db::bitget_mark_disappeared(pool, &disappeared).await?;
        info!(marked, "Marked disappeared symbols");
    }

    info!(
        upserted,
        skipped,
        disappeared = disappeared_count,
        "Listing sync complete"
    );

    // Print summary
    let online = rows.iter().filter(|r| r.status == "online").count();
    let delisted = rows.iter().filter(|r| r.delisted_at.is_some()).count();
    let usdt = rows.iter().filter(|r| r.quote_coin == "USDT").count();
    let usdc = rows.iter().filter(|r| r.quote_coin == "USDC").count();
    info!(online, delisted, usdt_pairs = usdt, usdc_pairs = usdc, "Summary");

    Ok(SyncResult {
        upserted,
        disappeared: disappeared_count,
        total,
    })
}

/// One-shot CLI command: connect to DB, sync once, exit.
pub async fn run(args: SyncListingsArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    info!("Fetching Bitget spot symbols...");

    let pool = db::create_pool(&args.database_url).await?;
    db::run_migrations(&pool).await?;

    let base_url = "https://api.bitget.com";
    sync_listings_core(&pool, base_url)
        .await
        .map_err(|e| -> Box<dyn std::error::Error> { e })?;

    Ok(())
}

/// Background daily sync loop. Runs `sync_listings_core` every `interval_secs` seconds.
pub async fn run_daily(pool: PgPool, interval_secs: u64) {
    let base_url = DEFAULT_SYMBOLS_URL
        .strip_suffix("/api/v2/spot/public/symbols")
        .unwrap_or("https://api.bitget.com");

    info!(interval_secs, "Listing sync daily task started");

    loop {
        match sync_listings_core(&pool, base_url).await {
            Ok(result) => {
                info!(
                    upserted = result.upserted,
                    disappeared = result.disappeared,
                    total = result.total,
                    "Daily listing sync completed"
                );
            }
            Err(e) => {
                warn!(%e, "Daily listing sync failed");
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ms_timestamp_valid() {
        // 2024-01-25 00:00:00 UTC = 1706140800000 ms
        let result = parse_ms_timestamp("1706140800000");
        assert!(result.is_some());
        let dt = result.unwrap();
        assert_eq!(dt.format("%Y-%m-%d").to_string(), "2024-01-25");
    }

    #[test]
    fn test_parse_ms_timestamp_zero() {
        assert!(parse_ms_timestamp("0").is_none());
    }

    #[test]
    fn test_parse_ms_timestamp_empty() {
        assert!(parse_ms_timestamp("").is_none());
    }

    #[test]
    fn test_parse_ms_timestamp_invalid() {
        assert!(parse_ms_timestamp("not_a_number").is_none());
    }

    #[test]
    fn test_diff_detection_finds_disappeared() {
        let db_symbols = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        let api_symbols: HashSet<String> = ["A", "C"].iter().map(|s| s.to_string()).collect();
        let disappeared = compute_disappeared(&db_symbols, &api_symbols);
        assert_eq!(disappeared, vec!["B".to_string()]);
    }

    #[test]
    fn test_diff_detection_no_disappearances() {
        let db_symbols = vec!["A".to_string(), "B".to_string()];
        let api_symbols: HashSet<String> = ["A", "B"].iter().map(|s| s.to_string()).collect();
        let disappeared = compute_disappeared(&db_symbols, &api_symbols);
        assert!(disappeared.is_empty());
    }

    #[test]
    fn test_diff_detection_new_symbols_ok() {
        let db_symbols = vec!["A".to_string()];
        let api_symbols: HashSet<String> = ["A", "B", "C"].iter().map(|s| s.to_string()).collect();
        let disappeared = compute_disappeared(&db_symbols, &api_symbols);
        assert!(disappeared.is_empty());
    }
}
