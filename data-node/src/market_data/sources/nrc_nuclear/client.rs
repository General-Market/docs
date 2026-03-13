//! NRC Nuclear Power Reactor Status client implementing MarketDataSource
//!
//! Tracks power output percentage for all ~93 US commercial nuclear reactors
//! from the NRC Power Reactor Status Report.
//!
//! Each reactor unit is an asset; its value is the power output percentage (0-100).
//! Data is pipe-delimited text updated daily by the NRC.
//!
//! Assets are dynamic — parsed from the report file itself (no static config JSON).
//!
//! API: https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/
//! Auth: None
//! Rate limit: 10 req/min (government site, be respectful)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tracing::{debug, info};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// NRC Power Reactor Status Report URL (last 365 days)
const DATA_URL: &str = "https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/PowerReactorStatusForLast365Days.txt";

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Cached NRC data to avoid re-downloading the 365-day file on every call.
/// The file is ~1MB and only updates daily, so caching for 30 minutes is safe.
struct CachedNrcData {
    body: String,
    fetched_at: Instant,
}

/// NRC Nuclear Reactors market data source.
///
/// Tracks power output percentage for US commercial nuclear reactors.
/// Source ID is `"nrc_nuclear"`.
pub struct NrcNuclearMarketSource {
    http: SourceHttpClient,
    /// Cache the 365-day file to avoid redundant downloads.
    /// Both fetch_assets and fetch_prices need the same file.
    cache: Mutex<Option<CachedNrcData>>,
}

impl NrcNuclearMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };

        // Use a custom client with User-Agent header — government sites
        // may block requests without one. Also use a longer timeout since
        // the NRC server can be slow (365-day file is ~1MB).
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .connect_timeout(Duration::from_secs(15))
            .user_agent("IndexDataNode/1.0 (contact: data@index.markets)")
            .build()
            .expect("Failed to create NRC HTTP client");

        let retry = RetryConfig {
            max_retries: 5,          // extra retries for transient DNS/connectivity issues
            base_delay_ms: 2000,     // longer base delay for gov site
            max_delay_ms: 30_000,
        };

        let http = SourceHttpClient::with_client(client, rate_limit, retry);

        info!("NRC Nuclear Reactors source initialized");

        Ok(Self {
            http,
            cache: Mutex::new(None),
        })
    }

    /// Get the NRC data, using cache if fresh enough (30 minutes).
    async fn get_nrc_data(&self) -> Result<String> {
        // Check cache first
        {
            let cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(ref cached) = *cache {
                if cached.fetched_at.elapsed() < Duration::from_secs(1800) {
                    debug!("Using cached NRC data (age: {:?})", cached.fetched_at.elapsed());
                    return Ok(cached.body.clone());
                }
            }
        }

        // Cache miss or stale — download fresh
        let body = self.http.get_raw(DATA_URL).await
            .map_err(|e| anyhow::anyhow!("NRC data download failed: {}", e))?;

        // Update cache
        {
            let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
            *cache = Some(CachedNrcData {
                body: body.clone(),
                fetched_at: Instant::now(),
            });
        }

        Ok(body)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for NrcNuclearMarketSource {
    fn source_id(&self) -> &'static str {
        "nrc_nuclear"
    }

    fn display_name(&self) -> &'static str {
        "NRC Nuclear Reactors"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600) // 1 hour — data only updates daily
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let body = self.get_nrc_data().await?;
        let rows = parse_nrc_data(&body);

        // Collect unique unit names
        let mut seen = HashMap::new();
        for row in &rows {
            seen.entry(row.unit.clone()).or_insert_with(|| row.clone());
        }

        let mut assets: Vec<AssetUpdate> = seen
            .values()
            .map(|row| {
                let asset_id = normalize_unit_name(&row.unit);
                let symbol = format!("NRC/{}", row.unit.to_uppercase());
                AssetUpdate {
                    asset_id: asset_id.clone(),
                    symbol,
                    name: row.unit.clone(),
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": row.unit,
                        "subcategory": "nuclear",
                        "active": true,
                        "extra": {},
                    }),
                }
            })
            .collect();

        // Sort for deterministic ordering
        assets.sort_by(|a, b| a.asset_id.cmp(&b.asset_id));

        info!(
            "NRC Nuclear fetch_assets: {} reactor units discovered",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        let body = self.get_nrc_data().await?;
        let rows = parse_nrc_data(&body);

        // Build lookup: asset_id -> most recent power reading
        // The file is sorted by date ascending, so we just overwrite —
        // the last entry for each unit will be the most recent.
        let mut latest: HashMap<String, Decimal> = HashMap::new();
        for row in &rows {
            let asset_id = normalize_unit_name(&row.unit);
            if let Some(power) = row.power {
                latest.insert(asset_id, power);
            }
        }

        // Build a set for fast lookup
        let requested: std::collections::HashSet<&String> = asset_ids.iter().collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            if !requested.contains(asset_id) {
                continue;
            }

            let value = latest.get(asset_id).copied().unwrap_or(Decimal::ZERO);

            // Reconstruct the unit name from asset_id for the symbol
            let unit_key = asset_id.strip_prefix("nrc_").unwrap_or(asset_id);
            let symbol = format!("NRC/{}", unit_key.to_uppercase());

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol,
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from NRC Nuclear ({} reactors in data)",
            results.len(),
            asset_ids.len(),
            latest.len()
        );

        Ok(results)
    }
}

// ============================================================================
// DATA PARSING
// ============================================================================

/// A single parsed row from the NRC status file
#[derive(Debug, Clone)]
struct NrcRow {
    /// Report date string (MM/DD/YYYY)
    #[allow(dead_code)]
    date: String,
    /// Reactor unit name (e.g., "Braidwood 1")
    unit: String,
    /// Power output percentage (0-100), None if empty or non-numeric
    power: Option<Decimal>,
}

/// Parse the pipe-delimited NRC reactor status text file.
///
/// Expected format:
/// ```text
/// ReportDt|Unit|Power
/// 01/15/2024|Arkansas Nuclear 1|100
/// 01/15/2024|Arkansas Nuclear 2|98
/// ```
///
/// Skips the header row and any malformed lines.
fn parse_nrc_data(body: &str) -> Vec<NrcRow> {
    let mut rows = Vec::new();

    for (i, line) in body.lines().enumerate() {
        // Skip header row
        if i == 0 {
            continue;
        }

        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 3 {
            debug!("Skipping malformed NRC line {}: '{}'", i + 1, line);
            continue;
        }

        let date = parts[0].trim().to_string();
        let unit = parts[1].trim().to_string();
        let power_str = parts[2].trim();

        if unit.is_empty() {
            debug!("Skipping NRC line {} with empty unit name", i + 1);
            continue;
        }

        let power = if power_str.is_empty() {
            None
        } else {
            match power_str.parse::<i64>() {
                Ok(val) => Some(Decimal::from(val)),
                Err(_) => {
                    // Try as decimal (some reports may have fractional values)
                    match power_str.parse::<Decimal>() {
                        Ok(val) => Some(val),
                        Err(_) => {
                            debug!(
                                "Non-numeric power '{}' for unit '{}' on {}",
                                power_str, unit, date
                            );
                            None
                        }
                    }
                }
            }
        };

        rows.push(NrcRow { date, unit, power });
    }

    rows
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Normalize a reactor unit name to an asset_id.
///
/// - Prefix with "nrc_"
/// - Lowercase
/// - Replace spaces with underscores
/// - Remove periods and apostrophes
///
/// Examples:
/// - "Braidwood 1" -> "nrc_braidwood_1"
/// - "Diablo Canyon 1" -> "nrc_diablo_canyon_1"
/// - "St. Lucie 1" -> "nrc_st_lucie_1"
fn normalize_unit_name(name: &str) -> String {
    let normalized = name
        .to_lowercase()
        .replace('.', "")
        .replace('\'', "")
        .replace(' ', "_");
    format!("nrc_{}", normalized)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_DATA: &str = "\
ReportDt|Unit|Power
01/15/2024|Arkansas Nuclear 1|100
01/15/2024|Arkansas Nuclear 2|98
01/15/2024|Beaver Valley 1|0
01/15/2024|Braidwood 1|100
01/14/2024|Arkansas Nuclear 1|99";

    #[test]
    fn test_parse_nrc_data() {
        let rows = parse_nrc_data(SAMPLE_DATA);
        assert_eq!(rows.len(), 5, "Expected 5 data rows (header skipped)");

        // First row
        assert_eq!(rows[0].unit, "Arkansas Nuclear 1");
        assert_eq!(rows[0].power, Some(Decimal::from(100)));
        assert_eq!(rows[0].date, "01/15/2024");

        // Second row
        assert_eq!(rows[1].unit, "Arkansas Nuclear 2");
        assert_eq!(rows[1].power, Some(Decimal::from(98)));

        // Zero power
        assert_eq!(rows[2].unit, "Beaver Valley 1");
        assert_eq!(rows[2].power, Some(Decimal::ZERO));

        // Last row (earlier date for Arkansas Nuclear 1)
        assert_eq!(rows[4].unit, "Arkansas Nuclear 1");
        assert_eq!(rows[4].power, Some(Decimal::from(99)));
    }

    #[test]
    fn test_normalize_unit_name() {
        assert_eq!(normalize_unit_name("Braidwood 1"), "nrc_braidwood_1");
        assert_eq!(
            normalize_unit_name("Diablo Canyon 1"),
            "nrc_diablo_canyon_1"
        );
        assert_eq!(normalize_unit_name("St. Lucie 1"), "nrc_st_lucie_1");
        assert_eq!(
            normalize_unit_name("Arkansas Nuclear 1"),
            "nrc_arkansas_nuclear_1"
        );
        assert_eq!(normalize_unit_name("Beaver Valley 1"), "nrc_beaver_valley_1");
        // Apostrophes removed
        assert_eq!(
            normalize_unit_name("O'Brien's Reactor 1"),
            "nrc_obriens_reactor_1"
        );
    }

    #[test]
    fn test_asset_id_format() {
        let rows = parse_nrc_data(SAMPLE_DATA);

        for row in &rows {
            let asset_id = normalize_unit_name(&row.unit);
            assert!(
                asset_id.starts_with("nrc_"),
                "Asset ID '{}' should start with 'nrc_'",
                asset_id
            );
            // No uppercase letters
            assert_eq!(
                asset_id,
                asset_id.to_lowercase(),
                "Asset ID '{}' should be all lowercase",
                asset_id
            );
            // No spaces
            assert!(
                !asset_id.contains(' '),
                "Asset ID '{}' should not contain spaces",
                asset_id
            );
            // No periods
            assert!(
                !asset_id.contains('.'),
                "Asset ID '{}' should not contain periods",
                asset_id
            );
        }
    }

    #[test]
    fn test_parse_empty_power() {
        let data = "\
ReportDt|Unit|Power
01/15/2024|Normal Reactor|100
01/15/2024|Missing Power|
01/15/2024|Bad Power|N/A
01/15/2024|Another Reactor|50";

        let rows = parse_nrc_data(data);
        assert_eq!(rows.len(), 4);

        // Normal value
        assert_eq!(rows[0].power, Some(Decimal::from(100)));

        // Empty power -> None
        assert_eq!(rows[1].unit, "Missing Power");
        assert_eq!(rows[1].power, None);

        // Non-numeric power -> None
        assert_eq!(rows[2].unit, "Bad Power");
        assert_eq!(rows[2].power, None);

        // Normal value
        assert_eq!(rows[3].power, Some(Decimal::from(50)));
    }

    #[test]
    fn test_parse_skips_malformed_lines() {
        let data = "\
ReportDt|Unit|Power
01/15/2024|Good Reactor|100
bad line without pipes
01/15/2024|Another Good|50
|empty unit|100";

        let rows = parse_nrc_data(data);
        // "bad line without pipes" has <3 parts -> skipped
        // "|empty unit|100" has empty first field but non-empty unit -> included
        // However the row with truly empty unit would be skipped
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].unit, "Good Reactor");
        assert_eq!(rows[1].unit, "Another Good");
        assert_eq!(rows[2].unit, "empty unit");
    }

    #[test]
    fn test_parse_empty_body() {
        let data = "ReportDt|Unit|Power\n";
        let rows = parse_nrc_data(data);
        assert!(rows.is_empty(), "Empty body should produce no rows");
    }

    #[test]
    fn test_most_recent_date_wins() {
        // In the sample data, Arkansas Nuclear 1 appears twice:
        // 01/15/2024 with power 100 and 01/14/2024 with power 99.
        // Since the file is date-ascending (older first), 01/15 comes after 01/14,
        // but our sample has 01/15 first. Either way, last occurrence wins.
        let data = "\
ReportDt|Unit|Power
01/14/2024|Test Reactor|80
01/15/2024|Test Reactor|95
01/16/2024|Test Reactor|100";

        let rows = parse_nrc_data(data);

        // Build latest map the same way fetch_prices does
        let mut latest: HashMap<String, Decimal> = HashMap::new();
        for row in &rows {
            let asset_id = normalize_unit_name(&row.unit);
            if let Some(power) = row.power {
                latest.insert(asset_id, power);
            }
        }

        // Last entry (01/16) should win
        assert_eq!(
            latest.get("nrc_test_reactor"),
            Some(&Decimal::from(100)),
            "Most recent date's power should be used"
        );
    }

    #[test]
    fn test_unique_assets_from_sample() {
        let rows = parse_nrc_data(SAMPLE_DATA);

        let mut seen = HashMap::new();
        for row in &rows {
            seen.entry(normalize_unit_name(&row.unit))
                .or_insert(row.unit.clone());
        }

        // Sample has: Arkansas Nuclear 1, Arkansas Nuclear 2, Beaver Valley 1, Braidwood 1
        // Arkansas Nuclear 1 appears twice but should be deduplicated
        assert_eq!(seen.len(), 4);
        assert!(seen.contains_key("nrc_arkansas_nuclear_1"));
        assert!(seen.contains_key("nrc_arkansas_nuclear_2"));
        assert!(seen.contains_key("nrc_beaver_valley_1"));
        assert!(seen.contains_key("nrc_braidwood_1"));
    }
}
