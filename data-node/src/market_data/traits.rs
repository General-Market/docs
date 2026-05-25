//! Market data source traits
//!
//! Defines the interfaces for market data sources:
//! - `MarketDataSource`: Basic polling interface (interval-based)
//! - `ScheduledMarketDataSource`: Smart scheduling interface (event-driven)

use anyhow::Result;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, TimeZone, Utc, Weekday};
use chrono_tz::{Europe::Berlin, US::Eastern};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

use crate::market_data::rate_limiter::RateLimitConfig;

// ============================================================================
// CATEGORY CONSTANTS
// ============================================================================

/// Valid asset categories for the platform.
/// All sources must use one of these categories.
pub mod categories {
    pub const STOCKS: &str = "stocks";
    pub const CRYPTO: &str = "crypto";
    pub const DEFI: &str = "defi";
    pub const MACRO: &str = "macro";
    pub const COMMODITIES: &str = "commodities";
    pub const WEATHER: &str = "weather";
    pub const ONCHAIN: &str = "onchain";
    pub const SENTIMENT: &str = "sentiment";
    pub const REGULATORY: &str = "regulatory";
    pub const GEOPHYSICAL: &str = "geophysical";
    pub const SPACE: &str = "space";
    pub const ENVIRONMENT: &str = "environment";
    pub const TRANSPORT: &str = "transport";
    pub const HEALTH: &str = "health";
    pub const SPORTS: &str = "sports";
    pub const DEFENSE: &str = "defense";
    pub const GOVERNMENT: &str = "government";
    pub const EDUCATION: &str = "education";
    pub const ANIMALS: &str = "animals";

    /// All valid categories
    pub const ALL: &[&str] = &[
        STOCKS, CRYPTO, DEFI, MACRO, COMMODITIES, WEATHER, ONCHAIN, SENTIMENT, REGULATORY,
        GEOPHYSICAL, SPACE, ENVIRONMENT, TRANSPORT, HEALTH, SPORTS, DEFENSE, GOVERNMENT,
        EDUCATION, ANIMALS,
    ];

    /// Check if a category string is valid
    pub fn is_valid(cat: &str) -> bool {
        ALL.contains(&cat)
    }
}

// ============================================================================
// JSON CONFIG TYPES
// ============================================================================

/// Asset entry as stored in config/{source_id}.json files.
/// This is the standard schema for all asset configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetEntry {
    /// Unique identifier within this source
    pub asset_id: String,
    /// Trading symbol or ticker
    pub symbol: String,
    /// Human-readable display name
    pub name: String,
    /// Top-level category (must be one of `categories::ALL`)
    pub category: String,
    /// Subcategory within the category
    pub subcategory: String,
    /// API-specific reference (series ID, endpoint slug, etc.)
    pub api_ref: String,
    /// Whether this asset is active and should be synced
    pub active: bool,
}

/// Load assets from a JSON string (typically from `include_str!`).
///
/// This is the standard way to load assets from embedded JSON config files.
/// It parses the JSON, validates categories, filters to only active assets,
/// and converts to `AssetUpdate` with standardized metadata.
///
/// # Arguments
/// * `json_str` - JSON string containing an array of `AssetEntry` objects
///
/// # Returns
/// * `Ok(Vec<AssetUpdate>)` - Only assets where `active: true`
/// * `Err` - If JSON parsing fails or category validation fails
///
/// # Panics
/// Panics if any asset has an invalid category. This is intentional since
/// JSON is embedded at compile time via `include_str!` and should be validated.
pub fn load_assets_from_json(json_str: &str) -> Result<Vec<AssetUpdate>> {
    let entries: Vec<AssetEntry> = serde_json::from_str(json_str)?;

    // Validate all categories (panic on invalid since JSON is embedded at compile time)
    for entry in &entries {
        if !categories::is_valid(&entry.category) {
            panic!(
                "Invalid category '{}' for asset '{}'. Valid categories: {:?}",
                entry.category,
                entry.asset_id,
                categories::ALL
            );
        }
    }

    Ok(entries
        .into_iter()
        .filter(|a| a.active)
        .map(|a| AssetUpdate {
            asset_id: a.asset_id.clone(),
            symbol: a.symbol.clone(),
            name: a.name.clone(),
            category: Some(a.category.clone()),
            metadata: serde_json::json!({
                "api_ref": a.api_ref,
                "subcategory": a.subcategory,
                "active": a.active,
                "extra": {},
            }),
        })
        .collect())
}

/// Load all asset entries from JSON (including inactive ones).
/// Used by the refresh-assets CLI to merge with upstream data.
pub fn load_all_asset_entries(json_str: &str) -> Result<Vec<AssetEntry>> {
    let entries: Vec<AssetEntry> = serde_json::from_str(json_str)?;
    Ok(entries)
}

// ============================================================================
// BATCH STRATEGY — per-source calibration for 50/50 outcomes
// ============================================================================

/// How the batch engine should calibrate thresholds for this source.
///
/// Every source has its own rate of change. PumpFun tokens swing 50%
/// in 5 minutes; Swiss weather barely moves 0.1° in an hour. The
/// strategy says how aggressively the batch engine smooths past moves
/// into the next threshold so that ~50% of bets resolve UP and ~50%
/// DOWN.
///
/// One calibration mode: exponential moving average of |change_pct|
/// over recent settled batches. `ema_change_span` controls how short
/// the memory is — small span chases regime shifts, large span sits
/// still. `fixed_threshold_bps`, when set, replaces the EMA entirely.
#[derive(Debug, Clone, Copy)]
pub struct BatchStrategy {
    /// Floor — never set threshold below this (bps).
    /// Prevents trivially won bets on pure noise.
    pub min_threshold_bps: u32,

    /// Ceiling — never exceed this (bps).
    /// Prevents impossible-to-win bets.
    pub max_threshold_bps: u32,

    /// EMA span over the last N settled batches' |change_pct| (bps).
    /// α = 2 / (span + 1). Short span = jumpy, long span = smooth.
    /// Bootstrap requires at least 3 settlements; below that, falls
    /// through to single-settlement and 24h-history backstops.
    pub ema_change_span: usize,

    /// When `Some(bps)`, bypass EMA calibration entirely and use a
    /// flat fixed threshold for every asset in this source. The
    /// resolution direction is still chosen per asset from the last
    /// settled batch's sign. Useful for sources whose per-tick move
    /// is uniform across all markets and any history-derived value
    /// would only add noise.
    pub fixed_threshold_bps: Option<u32>,
}

impl BatchStrategy {
    /// Default: short EMA, full 0-10000 bps range.
    pub const DEFAULT: Self = Self {
        min_threshold_bps: 0,
        max_threshold_bps: 10000,
        ema_change_span: 10,
        fixed_threshold_bps: None,
    };

    /// Fast volatile source (meme tokens, live streams).
    /// Short EMA chases regime shifts; floor at 0.5% to drop noise.
    pub const FAST_VOLATILE: Self = Self {
        min_threshold_bps: 50,
        max_threshold_bps: 10000,
        ema_change_span: 8,
        fixed_threshold_bps: None,
    };

    /// Slow environmental source (weather, air quality, tides).
    /// Long EMA smooths through hourly noise.
    pub const ENVIRONMENTAL: Self = Self {
        min_threshold_bps: 0,
        max_threshold_bps: 5000,
        ema_change_span: 24,
        fixed_threshold_bps: None,
    };

    /// Macro/daily source (rates, bonds, inflation).
    /// Long EMA, tight ceiling — these barely move.
    pub const MACRO_DAILY: Self = Self {
        min_threshold_bps: 0,
        max_threshold_bps: 1000,
        ema_change_span: 14,
        fixed_threshold_bps: None,
    };

    /// Engagement/social source (twitch, live viewer counts).
    /// Medium EMA, regime changes common. The series moves both up and
    /// down within a session, so a 10-deep EMA reads a fair typical move.
    pub const ENGAGEMENT: Self = Self {
        min_threshold_bps: 10,
        max_threshold_bps: 10000,
        ema_change_span: 10,
        fixed_threshold_bps: None,
    };

    /// Cumulative engagement source (hackernews score/comments, reddit
    /// upvotes). These series only climb and they *decelerate* — a story
    /// gains votes fast early, then plateaus. A long EMA lags above the
    /// curve, so the `up_x%` target sits where the story *was* heading an
    /// hour ago, not where it is heading now, and the bet is unwinnable.
    /// A short span (3) chases the deceleration down to the next-tick
    /// reality. Pair with a youth-capped universe so markets land on
    /// stories still on the steep part of their curve.
    pub const ENGAGEMENT_CUMULATIVE: Self = Self {
        min_threshold_bps: 10,
        max_threshold_bps: 10000,
        ema_change_span: 3,
        fixed_threshold_bps: None,
    };

    /// Status/event source (transit delays, outages, alerts).
    /// Binary-ish data, small thresholds.
    pub const STATUS: Self = Self {
        min_threshold_bps: 0,
        max_threshold_bps: 5000,
        ema_change_span: 10,
        fixed_threshold_bps: None,
    };

    /// Probability source (polymarket, sports odds).
    /// Already 0-100, prices barely move within a tick. Tight ceiling
    /// keeps the question fair even when an asset went wild last batch.
    pub const PROBABILITY: Self = Self {
        min_threshold_bps: 1,
        max_threshold_bps: 200,
        ema_change_span: 10,
        fixed_threshold_bps: None,
    };
}

/// Trait that every market data source must implement.
///
/// The sync engine calls these methods in a loop:
/// 1. `fetch_assets()` on startup and periodically (metadata refresh)
/// 2. `fetch_prices()` every `sync_interval()`
#[async_trait::async_trait]
pub trait MarketDataSource: Send + Sync {
    /// Source identifier stored in the DB `source` column (e.g. "stocks")
    fn source_id(&self) -> &'static str;

    /// Human-readable name for logging (e.g. "Finnhub Stocks")
    fn display_name(&self) -> &'static str;

    /// Default resolution method for bets from this source
    fn default_resolution(&self) -> &'static str;

    /// How often to run a full price sync cycle
    fn sync_interval(&self) -> Duration;

    /// Rate limit configuration for this source's API
    fn rate_limit_config(&self) -> RateLimitConfig;

    /// Fetch all trackable assets (metadata sync).
    /// Called on startup and periodically to refresh asset metadata.
    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>>;

    /// Fetch current prices for the given asset IDs.
    /// The sync engine batches these according to rate limits.
    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>>;

    /// Discover assets from upstream API for the refresh-assets CLI.
    ///
    /// Override this for sources that can discover new assets from their API
    /// (CoinGecko, DefiLlama, Polymarket, etc.). The default returns an empty
    /// vec, meaning the source doesn't support dynamic asset discovery.
    ///
    /// The returned `AssetEntry` objects are merged with the existing JSON
    /// config file. The merge logic never deletes — only adds new entries
    /// or reactivates previously deactivated ones.
    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        Ok(vec![])
    }

    /// Whether this source uses smart-sync and may intentionally return 0 prices
    /// when upstream data hasn't changed (e.g., OpenMeteo checks a metadata timestamp
    /// and skips fetching if unchanged). When true, the sync engine won't record
    /// an error for "0 prices fetched with active assets".
    fn skips_when_unchanged(&self) -> bool {
        false
    }

    /// Whether to always write a price record even when the value hasn't changed.
    ///
    /// Default `true`: every successful fetch advances `market_prices_latest.fetched_at`
    /// so the oracle's per-market staleness gate can see the source as alive.
    /// Counter-style and slow-tick sources (employment counts, alert levels, league
    /// tables) frequently produce identical values for many ticks in a row; if
    /// the sync engine drops those as duplicates, the oracle resolves every market
    /// as Cancelled because the data looks frozen. Override to `false` only for
    /// high-volume sources where unchanged-value rows would bloat storage and
    /// the source's own internal dedup is reliable.
    fn always_record_price(&self) -> bool {
        true
    }

    /// Batch strategy for threshold calibration.
    ///
    /// Override this in your source to define how the batch engine should
    /// compute thresholds for 50/50 outcomes. Each source knows its own
    /// volatility profile better than any centralized match statement.
    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::DEFAULT
    }
}

/// Asset metadata update returned by `fetch_assets()`
#[derive(Debug, Clone)]
pub struct AssetUpdate {
    /// Unique identifier within this source (e.g. ticker symbol "AAPL")
    pub asset_id: String,
    /// Trading symbol
    pub symbol: String,
    /// Full name
    pub name: String,
    /// Category/sector (e.g. "usTechLargeCap")
    pub category: Option<String>,
    /// Source-specific metadata (JSON)
    pub metadata: Value,
}

/// Price/value update returned by `fetch_prices()`
#[derive(Debug, Clone)]
pub struct PriceUpdate {
    /// Asset identifier matching `AssetUpdate::asset_id`
    pub asset_id: String,
    /// Trading symbol
    pub symbol: String,
    /// Current value (price in USD for stocks/crypto, metric value for weather)
    pub value: Decimal,
    /// Previous close price (optional, mainly for stocks)
    pub prev_close: Option<Decimal>,
    /// Value change percentage
    pub change_pct: Option<Decimal>,
    /// 24h trading volume (optional, mainly for stocks/crypto)
    pub volume_24h: Option<Decimal>,
    /// Market capitalization (optional, mainly for crypto)
    pub market_cap: Option<Decimal>,
    /// When this value was fetched
    pub fetched_at: DateTime<Utc>,
}

// ============================================================================
// SCHEDULED MARKET DATA SOURCE
// ============================================================================

/// Schedule-aware market data source trait.
///
/// Extends `MarketDataSource` with time-aware scheduling:
/// - `next_fetch_time()`: Returns optimal next fetch time based on data publish schedule
/// - `should_skip_today()`: Skips weekends and holidays
/// - `burst_mode()`: Returns short interval during high-importance events (FOMC, ECB meetings)
///
/// The `ScheduledSyncEngine` uses these methods instead of a fixed interval.
#[async_trait::async_trait]
pub trait ScheduledMarketDataSource: MarketDataSource {
    /// Returns the next optimal time to fetch data.
    ///
    /// Should return:
    /// - `now` if data should be fetched immediately
    /// - Future time if we should wait for the next publish window
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc>;

    /// Returns true if today should be skipped entirely (weekend, holiday).
    fn should_skip_today(&self, now: DateTime<Utc>) -> bool;

    /// Returns a burst interval if we're in a high-importance window.
    ///
    /// For example, during FOMC announcements or ECB meetings, return
    /// `Some(Duration::from_secs(300))` to fetch every 5 minutes.
    ///
    /// Returns `None` for normal operation.
    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration>;

    /// Get the timezone this source operates in.
    /// Used for logging and debug output.
    fn timezone(&self) -> &'static str {
        "UTC"
    }
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/// Check if a UTC datetime falls on a weekend in US Eastern time.
pub fn is_us_weekend(now: DateTime<Utc>) -> bool {
    let eastern = now.with_timezone(&Eastern);
    matches!(eastern.weekday(), Weekday::Sat | Weekday::Sun)
}

/// Check if a UTC datetime falls on a weekend in EU (CET/CEST) time.
pub fn is_eu_weekend(now: DateTime<Utc>) -> bool {
    let berlin = now.with_timezone(&Berlin);
    matches!(berlin.weekday(), Weekday::Sat | Weekday::Sun)
}

/// Create a datetime for today at a specific hour:minute in US Eastern.
/// Returns UTC equivalent.
pub fn today_at_eastern(now: DateTime<Utc>, hour: u32, minute: u32) -> DateTime<Utc> {
    let eastern = now.with_timezone(&Eastern);
    let date = eastern.date_naive();
    let time = NaiveTime::from_hms_opt(hour, minute, 0).unwrap();
    let dt = date.and_time(time);
    Eastern
        .from_local_datetime(&dt)
        .unwrap()
        .with_timezone(&Utc)
}

/// Create a datetime for today at a specific hour:minute in CET.
/// Returns UTC equivalent.
pub fn today_at_cet(now: DateTime<Utc>, hour: u32, minute: u32) -> DateTime<Utc> {
    let cet = now.with_timezone(&Berlin);
    let date = cet.date_naive();
    let time = NaiveTime::from_hms_opt(hour, minute, 0).unwrap();
    let dt = date.and_time(time);
    Berlin.from_local_datetime(&dt).unwrap().with_timezone(&Utc)
}

/// Get the next weekday (skip Sat/Sun) for US markets.
pub fn next_us_trading_day(now: DateTime<Utc>) -> DateTime<Utc> {
    let eastern = now.with_timezone(&Eastern);
    let mut date = eastern.date_naive();

    loop {
        date = date.succ_opt().unwrap();
        let weekday = date.weekday();
        if !matches!(weekday, Weekday::Sat | Weekday::Sun) {
            break;
        }
    }

    // Return start of that day (midnight ET -> UTC)
    let time = NaiveTime::from_hms_opt(0, 0, 0).unwrap();
    let dt = date.and_time(time);
    Eastern
        .from_local_datetime(&dt)
        .unwrap()
        .with_timezone(&Utc)
}

/// Get the next weekday for EU markets.
pub fn next_eu_trading_day(now: DateTime<Utc>) -> DateTime<Utc> {
    let cet = now.with_timezone(&Berlin);
    let mut date = cet.date_naive();

    loop {
        date = date.succ_opt().unwrap();
        let weekday = date.weekday();
        if !matches!(weekday, Weekday::Sat | Weekday::Sun) {
            break;
        }
    }

    let time = NaiveTime::from_hms_opt(0, 0, 0).unwrap();
    let dt = date.and_time(time);
    Berlin.from_local_datetime(&dt).unwrap().with_timezone(&Utc)
}

// ============================================================================
// CALENDAR DATA (FOMC, ECB, HOLIDAYS)
// ============================================================================

/// FOMC meeting dates for 2025-2027.
/// Announcements typically at 2:00 PM ET.
pub const FOMC_DATES: &[&str] = &[
    // 2025
    "2025-01-29",
    "2025-03-19",
    "2025-05-07",
    "2025-06-18",
    "2025-07-30",
    "2025-09-17",
    "2025-11-05",
    "2025-12-17",
    // 2026
    "2026-01-28",
    "2026-03-18",
    "2026-04-29",
    "2026-06-17",
    "2026-07-29",
    "2026-09-16",
    "2026-11-04",
    "2026-12-16",
    // 2027
    "2027-01-27",
    "2027-03-17",
    "2027-04-28",
    "2027-06-16",
    "2027-07-28",
    "2027-09-15",
    "2027-11-03",
    "2027-12-15",
];

/// ECB Governing Council meeting dates for 2025-2027.
/// Announcements typically at 14:15 CET.
pub const ECB_DATES: &[&str] = &[
    // 2025
    "2025-01-30",
    "2025-03-06",
    "2025-04-17",
    "2025-06-05",
    "2025-07-17",
    "2025-09-11",
    "2025-10-30",
    "2025-12-18",
    // 2026
    "2026-01-22",
    "2026-03-05",
    "2026-04-16",
    "2026-06-04",
    "2026-07-16",
    "2026-09-10",
    "2026-10-29",
    "2026-12-17",
    // 2027
    "2027-01-21",
    "2027-03-04",
    "2027-04-15",
    "2027-06-03",
    "2027-07-15",
    "2027-09-09",
    "2027-10-28",
    "2027-12-16",
];

/// US Federal holidays when markets are closed (2025-2027).
pub const US_HOLIDAYS: &[&str] = &[
    // 2025
    "2025-01-01",
    "2025-01-20",
    "2025-02-17",
    "2025-04-18",
    "2025-05-26",
    "2025-06-19",
    "2025-07-04",
    "2025-09-01",
    "2025-10-13",
    "2025-11-11",
    "2025-11-27",
    "2025-12-25",
    // 2026
    "2026-01-01",
    "2026-01-19",
    "2026-02-16",
    "2026-04-03",
    "2026-05-25",
    "2026-06-19",
    "2026-07-03",
    "2026-09-07",
    "2026-10-12",
    "2026-11-11",
    "2026-11-26",
    "2026-12-25",
    // 2027
    "2027-01-01",
    "2027-01-18",
    "2027-02-15",
    "2027-03-26",
    "2027-05-31",
    "2027-06-18",
    "2027-07-05",
    "2027-09-06",
    "2027-10-11",
    "2027-11-11",
    "2027-11-25",
    "2027-12-24",
];

/// Check if a date is a FOMC announcement day.
pub fn is_fomc_day(date: NaiveDate) -> bool {
    let date_str = date.format("%Y-%m-%d").to_string();
    FOMC_DATES.contains(&date_str.as_str())
}

/// Check if a date is an ECB meeting day.
pub fn is_ecb_day(date: NaiveDate) -> bool {
    let date_str = date.format("%Y-%m-%d").to_string();
    ECB_DATES.contains(&date_str.as_str())
}

/// Check if a date is a US Federal holiday.
pub fn is_us_holiday(date: NaiveDate) -> bool {
    let date_str = date.format("%Y-%m-%d").to_string();
    US_HOLIDAYS.contains(&date_str.as_str())
}

/// Check if US markets are closed (weekend OR holiday).
pub fn is_us_market_closed(now: DateTime<Utc>) -> bool {
    let eastern = now.with_timezone(&Eastern);
    is_us_weekend(now) || is_us_holiday(eastern.date_naive())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_fomc_day() {
        let fomc = NaiveDate::from_ymd_opt(2026, 1, 28).unwrap();
        assert!(is_fomc_day(fomc));

        let non_fomc = NaiveDate::from_ymd_opt(2026, 1, 29).unwrap();
        assert!(!is_fomc_day(non_fomc));
    }

    #[test]
    fn test_is_ecb_day() {
        let ecb = NaiveDate::from_ymd_opt(2025, 1, 30).unwrap();
        assert!(is_ecb_day(ecb));
    }

    #[test]
    fn test_is_us_holiday() {
        // Christmas 2025
        let xmas = NaiveDate::from_ymd_opt(2025, 12, 25).unwrap();
        assert!(is_us_holiday(xmas));

        // Random day
        let random = NaiveDate::from_ymd_opt(2025, 6, 15).unwrap();
        assert!(!is_us_holiday(random));
    }

    #[test]
    fn test_weekend_detection() {
        // Saturday Jan 25, 2025 at noon UTC
        let sat = Utc.with_ymd_and_hms(2025, 1, 25, 12, 0, 0).unwrap();
        assert!(is_us_weekend(sat));

        // Monday Jan 27, 2025 at noon UTC
        let mon = Utc.with_ymd_and_hms(2025, 1, 27, 12, 0, 0).unwrap();
        assert!(!is_us_weekend(mon));
    }

    // ========================================================================
    // CATEGORY TESTS
    // ========================================================================

    #[test]
    fn test_categories_all_valid() {
        assert!(categories::is_valid("stocks"));
        assert!(categories::is_valid("crypto"));
        assert!(categories::is_valid("defi"));
        assert!(categories::is_valid("macro"));
        assert!(categories::is_valid("commodities"));
        assert!(categories::is_valid("weather"));
        assert!(categories::is_valid("onchain"));
        assert!(categories::is_valid("sentiment"));
        assert!(categories::is_valid("regulatory"));
    }

    #[test]
    fn test_categories_invalid() {
        assert!(!categories::is_valid("invalid"));
        assert!(!categories::is_valid("STOCKS"));
        assert!(!categories::is_valid(""));
        assert!(!categories::is_valid("cryptoLargeCap")); // Old format
    }

    #[test]
    fn test_category_count() {
        assert_eq!(categories::ALL.len(), 19);
    }

    // ========================================================================
    // JSON LOADING TESTS
    // ========================================================================

    #[test]
    fn test_load_assets_from_json_basic() {
        let json = r#"[
            {
                "asset_id": "DFF",
                "symbol": "DFF",
                "name": "Fed Funds Rate",
                "category": "macro",
                "subcategory": "interest_rates",
                "api_ref": "DFF",
                "active": true
            },
            {
                "asset_id": "INACTIVE",
                "symbol": "INACTIVE",
                "name": "Inactive Asset",
                "category": "macro",
                "subcategory": "test",
                "api_ref": "INACTIVE",
                "active": false
            }
        ]"#;

        let assets = load_assets_from_json(json).unwrap();

        // Only active assets should be returned
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].asset_id, "DFF");
        assert_eq!(assets[0].category, Some("macro".to_string()));

        // Check metadata
        let meta = &assets[0].metadata;
        assert_eq!(meta["api_ref"], "DFF");
        assert_eq!(meta["subcategory"], "interest_rates");
        assert_eq!(meta["active"], true);
    }

    #[test]
    fn test_load_all_asset_entries() {
        let json = r#"[
            {
                "asset_id": "ACTIVE",
                "symbol": "ACTIVE",
                "name": "Active Asset",
                "category": "macro",
                "subcategory": "test",
                "api_ref": "ACTIVE",
                "active": true
            },
            {
                "asset_id": "INACTIVE",
                "symbol": "INACTIVE",
                "name": "Inactive Asset",
                "category": "macro",
                "subcategory": "test",
                "api_ref": "INACTIVE",
                "active": false
            }
        ]"#;

        let entries = load_all_asset_entries(json).unwrap();

        // All entries should be returned
        assert_eq!(entries.len(), 2);
        assert!(entries[0].active);
        assert!(!entries[1].active);
    }

    #[test]
    #[should_panic(expected = "Invalid category")]
    fn test_load_assets_from_json_invalid_category() {
        let json = r#"[
            {
                "asset_id": "TEST",
                "symbol": "TEST",
                "name": "Test Asset",
                "category": "invalid_category",
                "subcategory": "test",
                "api_ref": "TEST",
                "active": true
            }
        ]"#;

        let _ = load_assets_from_json(json);
    }

    #[test]
    fn test_asset_entry_serde() {
        let entry = AssetEntry {
            asset_id: "BTC".to_string(),
            symbol: "BTC".to_string(),
            name: "Bitcoin".to_string(),
            category: "crypto".to_string(),
            subcategory: "layer1".to_string(),
            api_ref: "bitcoin".to_string(),
            active: true,
        };

        let json = serde_json::to_string(&entry).unwrap();
        let parsed: AssetEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.asset_id, "BTC");
        assert_eq!(parsed.category, "crypto");
        assert!(parsed.active);
    }
}
