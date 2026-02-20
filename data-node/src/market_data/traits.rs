//! Market data source traits
//!
//! Defines the interfaces for market data sources:
//! - `MarketDataSource`: Basic polling interface (interval-based)
//! - `ScheduledMarketDataSource`: Smart scheduling interface (event-driven)

use anyhow::Result;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, TimeZone, Utc, Weekday};
use chrono_tz::{Europe::Berlin, US::Eastern};
use rust_decimal::Decimal;
use serde_json::Value;
use std::time::Duration;

use crate::market_data::rate_limiter::RateLimitConfig;

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

/// Convert UTC datetime to US Eastern time.
pub fn to_eastern(now: DateTime<Utc>) -> chrono::DateTime<chrono_tz::Tz> {
    now.with_timezone(&Eastern)
}

/// Convert UTC datetime to Central European time.
pub fn to_cet(now: DateTime<Utc>) -> chrono::DateTime<chrono_tz::Tz> {
    now.with_timezone(&Berlin)
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
}
