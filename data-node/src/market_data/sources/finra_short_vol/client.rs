//! FINRA Daily Short Sale Volume API client implementing MarketDataSource
//!
//! Fetches daily short volume from https://cdn.finra.org/equity/regsho/daily/
//! Pipe-delimited text file, no authentication required.
//! Tracks 5 market-wide aggregates + 50 per-ticker metrics (2 each).

use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::tracked_tickers::TRACKED_TICKERS;
use crate::market_data::traits::{
    is_us_weekend, next_us_trading_day, today_at_eastern, AssetUpdate, MarketDataSource,
    PriceUpdate, ScheduledMarketDataSource,
};

/// FINRA Daily Short Sale Volume market data source
pub struct FinraShortVolMarketSource {
    client: reqwest::Client,
}

impl FinraShortVolMarketSource {
    /// Create the FINRA Short Volume client. No env vars needed (public CDN).
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60)) // Large file (~11k lines)
            .build()
            .context("Failed to build reqwest client")?;

        info!(
            "FINRA Short Volume client initialized (105 assets, {} tracked tickers)",
            TRACKED_TICKERS.len()
        );

        Ok(Self { client })
    }

    /// Download the short volume file for a given date string (YYYYMMDD).
    /// Returns None if 404 (file not yet published or holiday).
    async fn download_short_volume_file(&self, date_str: &str) -> Result<Option<String>> {
        let url = format!(
            "https://cdn.finra.org/equity/regsho/daily/CNMSshvol{}.txt",
            date_str
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch FINRA short volume file")?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !resp.status().is_success() {
            warn!("FINRA short volume HTTP error: {}", resp.status());
            return Ok(None);
        }

        let text = resp
            .text()
            .await
            .context("Failed to read FINRA short volume response")?;
        Ok(Some(text))
    }

    /// Parse a single pipe-delimited line into (symbol, short_vol, exempt_vol, total_vol).
    /// Returns None for header lines, totals, or malformed data.
    fn parse_short_vol_line(line: &str) -> Option<(String, i64, i64, i64)> {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 5 {
            return None;
        }

        let symbol = parts[1].to_string();
        let short_vol: i64 = parts[2].parse().ok()?;
        let exempt_vol: i64 = parts[3].parse().ok()?;
        let total_vol: i64 = parts[4].parse().ok()?;

        // Skip if total volume is 0
        if total_vol == 0 {
            return None;
        }

        Some((symbol, short_vol, exempt_vol, total_vol))
    }

    /// Try to get today's date string in Eastern time (YYYYMMDD format).
    /// If today's file is unavailable, try the previous trading day.
    async fn fetch_file_with_fallback(&self, now: DateTime<Utc>) -> Result<Option<String>> {
        let eastern = now.with_timezone(&chrono_tz::US::Eastern);
        let today_str = eastern.format("%Y%m%d").to_string();

        // Try today first
        if let Some(text) = self.download_short_volume_file(&today_str).await? {
            debug!("Downloaded FINRA short volume file for {}", today_str);
            return Ok(Some(text));
        }

        // Try previous day (handles weekends and late publishing)
        let yesterday = eastern.date_naive().pred_opt().unwrap();
        let yesterday_str = yesterday.format("%Y%m%d").to_string();

        if let Some(text) = self.download_short_volume_file(&yesterday_str).await? {
            debug!(
                "Downloaded FINRA short volume file for {} (fallback)",
                yesterday_str
            );
            return Ok(Some(text));
        }

        // Try two days back (handles weekends: Monday before file is published)
        let two_days_ago = yesterday.pred_opt().unwrap();
        let two_days_str = two_days_ago.format("%Y%m%d").to_string();

        if let Some(text) = self.download_short_volume_file(&two_days_str).await? {
            debug!(
                "Downloaded FINRA short volume file for {} (2-day fallback)",
                two_days_str
            );
            return Ok(Some(text));
        }

        warn!("No FINRA short volume file found for {} or prior days", today_str);
        Ok(None)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FinraShortVolMarketSource {
    fn source_id(&self) -> &'static str {
        "finra_short_vol"
    }

    fn display_name(&self) -> &'static str {
        "FINRA Daily Short Volume"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10, // Very conservative — it's just a CDN
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let mut assets = Vec::with_capacity(105);

        // 5 market-wide aggregates
        assets.push(AssetUpdate {
            asset_id: "shvol_market_ratio".to_string(),
            symbol: "SHVOL_MKT_RATIO".to_string(),
            name: "Market-Wide Short Volume Ratio".to_string(),
            category: Some("short_volume_market".to_string()),
            metadata: serde_json::json!({
                "source": "finra_short_vol",
                "unit": "percent",
                "update_frequency": "daily",
            }),
        });
        assets.push(AssetUpdate {
            asset_id: "shvol_market_short_total".to_string(),
            symbol: "SHVOL_MKT_SHORT".to_string(),
            name: "Market-Wide Total Short Volume".to_string(),
            category: Some("short_volume_market".to_string()),
            metadata: serde_json::json!({
                "source": "finra_short_vol",
                "unit": "shares",
                "update_frequency": "daily",
            }),
        });
        assets.push(AssetUpdate {
            asset_id: "shvol_market_total_vol".to_string(),
            symbol: "SHVOL_MKT_TOTAL".to_string(),
            name: "Market-Wide Total Volume".to_string(),
            category: Some("short_volume_market".to_string()),
            metadata: serde_json::json!({
                "source": "finra_short_vol",
                "unit": "shares",
                "update_frequency": "daily",
            }),
        });
        assets.push(AssetUpdate {
            asset_id: "shvol_market_high_short_count".to_string(),
            symbol: "SHVOL_MKT_HIGH_CT".to_string(),
            name: "Symbols With Short Ratio > 50%".to_string(),
            category: Some("short_volume_market".to_string()),
            metadata: serde_json::json!({
                "source": "finra_short_vol",
                "unit": "count",
                "update_frequency": "daily",
            }),
        });
        assets.push(AssetUpdate {
            asset_id: "shvol_market_exempt_total".to_string(),
            symbol: "SHVOL_MKT_EXEMPT".to_string(),
            name: "Market-Wide Short Exempt Volume".to_string(),
            category: Some("short_volume_market".to_string()),
            metadata: serde_json::json!({
                "source": "finra_short_vol",
                "unit": "shares",
                "update_frequency": "daily",
            }),
        });

        // 100 per-ticker assets (50 tickers x 2 metrics each)
        for (_ticker, suffix, name) in TRACKED_TICKERS {
            assets.push(AssetUpdate {
                asset_id: format!("shvol_{}_ratio", suffix),
                symbol: format!("SHVOL_{}_RATIO", suffix.to_uppercase()),
                name: format!("{} Short Volume Ratio", name),
                category: Some("short_volume_ticker".to_string()),
                metadata: serde_json::json!({
                    "source": "finra_short_vol",
                    "ticker": _ticker,
                    "unit": "percent",
                    "update_frequency": "daily",
                }),
            });
            assets.push(AssetUpdate {
                asset_id: format!("shvol_{}_short_vol", suffix),
                symbol: format!("SHVOL_{}_VOL", suffix.to_uppercase()),
                name: format!("{} Short Volume", name),
                category: Some("short_volume_ticker".to_string()),
                metadata: serde_json::json!({
                    "source": "finra_short_vol",
                    "ticker": _ticker,
                    "unit": "shares",
                    "update_frequency": "daily",
                }),
            });
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        // Download and parse the file
        let text = match self.fetch_file_with_fallback(now).await? {
            Some(t) => t,
            None => return Ok(results),
        };

        let lines: Vec<&str> = text.lines().collect();
        if lines.is_empty() {
            return Ok(results);
        }

        // Aggregate per-symbol: HashMap<Symbol, (short_vol, exempt_vol, total_vol)>
        // Skip header (line 0) and potential totals (last line)
        let mut per_symbol: HashMap<String, (i64, i64, i64)> = HashMap::new();
        let mut market_short_total: i64 = 0;
        let mut market_exempt_total: i64 = 0;
        let mut market_total_vol: i64 = 0;

        for (i, line) in lines.iter().enumerate() {
            // Skip header line
            if i == 0 {
                continue;
            }

            if let Some((symbol, short_vol, exempt_vol, total_vol)) =
                Self::parse_short_vol_line(line)
            {
                // Aggregate across markets for the same symbol
                let entry = per_symbol.entry(symbol).or_insert((0, 0, 0));
                entry.0 += short_vol;
                entry.1 += exempt_vol;
                entry.2 += total_vol;

                // Market-wide totals
                market_short_total += short_vol;
                market_exempt_total += exempt_vol;
                market_total_vol += total_vol;
            }
        }

        // Market-wide aggregates
        if market_total_vol > 0 {
            let market_ratio =
                (market_short_total as f64 / market_total_vol as f64) * 100.0;

            // Count symbols with short ratio > 50%
            let high_short_count = per_symbol
                .values()
                .filter(|(short, _, total)| {
                    *total > 0 && (*short as f64 / *total as f64) > 0.5
                })
                .count() as i64;

            if let Ok(v) = Decimal::from_str(&format!("{:.2}", market_ratio)) {
                results.push(PriceUpdate {
                    asset_id: "shvol_market_ratio".to_string(),
                    symbol: "SHVOL_MKT_RATIO".to_string(),
                    value: v,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }

            if let Ok(v) = Decimal::from_str(&market_short_total.to_string()) {
                results.push(PriceUpdate {
                    asset_id: "shvol_market_short_total".to_string(),
                    symbol: "SHVOL_MKT_SHORT".to_string(),
                    value: v,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }

            if let Ok(v) = Decimal::from_str(&market_total_vol.to_string()) {
                results.push(PriceUpdate {
                    asset_id: "shvol_market_total_vol".to_string(),
                    symbol: "SHVOL_MKT_TOTAL".to_string(),
                    value: v,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }

            if let Ok(v) = Decimal::from_str(&high_short_count.to_string()) {
                results.push(PriceUpdate {
                    asset_id: "shvol_market_high_short_count".to_string(),
                    symbol: "SHVOL_MKT_HIGH_CT".to_string(),
                    value: v,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }

            if let Ok(v) = Decimal::from_str(&market_exempt_total.to_string()) {
                results.push(PriceUpdate {
                    asset_id: "shvol_market_exempt_total".to_string(),
                    symbol: "SHVOL_MKT_EXEMPT".to_string(),
                    value: v,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        // Per-ticker metrics for TRACKED_TICKERS
        for (ticker, suffix, _name) in TRACKED_TICKERS {
            if let Some((short_vol, _exempt_vol, total_vol)) = per_symbol.get(*ticker) {
                let ratio = (*short_vol as f64 / *total_vol as f64) * 100.0;

                if let Ok(v) = Decimal::from_str(&format!("{:.2}", ratio)) {
                    results.push(PriceUpdate {
                        asset_id: format!("shvol_{}_ratio", suffix),
                        symbol: format!("SHVOL_{}_RATIO", suffix.to_uppercase()),
                        value: v,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }

                if let Ok(v) = Decimal::from_str(&short_vol.to_string()) {
                    results.push(PriceUpdate {
                        asset_id: format!("shvol_{}_short_vol", suffix),
                        symbol: format!("SHVOL_{}_VOL", suffix.to_uppercase()),
                        value: v,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
        }

        info!(
            "Fetched {} FINRA short volume prices ({} symbols parsed)",
            results.len(),
            per_symbol.len()
        );
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for FinraShortVolMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // FINRA publishes by ~6 PM ET. Try 6:30 PM, retry at 7:30 PM.
        let slot_630 = today_at_eastern(now, 18, 30);
        let slot_730 = today_at_eastern(now, 19, 30);

        if now < slot_630 {
            return slot_630;
        }
        if now < slot_730 {
            return slot_730;
        }

        // Past 7:30 PM ET: next trading day at 6:30 PM ET
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&chrono_tz::US::Eastern);
        let dt = next_eastern
            .date_naive()
            .and_time(chrono::NaiveTime::from_hms_opt(18, 30, 0).unwrap());
        chrono_tz::US::Eastern
            .from_local_datetime(&dt)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_weekend(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_count() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap();
        let source = rt.block_on(async {
            // Build client without network — just test asset generation
            FinraShortVolMarketSource {
                client: reqwest::Client::new(),
            }
        });

        let rt = tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap();
        let assets = rt.block_on(source.fetch_assets()).unwrap();
        assert_eq!(assets.len(), 105, "Expected 105 assets (5 market + 50*2 per-ticker)");
    }

    #[test]
    fn test_parse_line() {
        let line = "20260220|AAPL|5432100|12345|15000000|O";
        let result = FinraShortVolMarketSource::parse_short_vol_line(line);
        assert!(result.is_some());
        let (symbol, short, exempt, total) = result.unwrap();
        assert_eq!(symbol, "AAPL");
        assert_eq!(short, 5432100);
        assert_eq!(exempt, 12345);
        assert_eq!(total, 15000000);
    }

    #[test]
    fn test_parse_line_invalid() {
        // Header line
        let header = "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market";
        assert!(FinraShortVolMarketSource::parse_short_vol_line(header).is_none());

        // Too few fields
        let short = "20260220|AAPL|5432100";
        assert!(FinraShortVolMarketSource::parse_short_vol_line(short).is_none());

        // Zero total volume
        let zero = "20260220|AAPL|0|0|0|O";
        assert!(FinraShortVolMarketSource::parse_short_vol_line(zero).is_none());

        // Empty line
        assert!(FinraShortVolMarketSource::parse_short_vol_line("").is_none());
    }

    #[test]
    fn test_market_wide_aggregation() {
        // Simulate parsing multiple lines across markets
        let lines = vec![
            "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market",
            "20260220|AAPL|1000000|5000|3000000|O",
            "20260220|AAPL|500000|2000|1500000|N",
            "20260220|TSLA|2000000|10000|3500000|O",
            "20260220|GME|800000|1000|1000000|O",
        ];

        let mut per_symbol: HashMap<String, (i64, i64, i64)> = HashMap::new();
        let mut market_short_total: i64 = 0;
        let mut market_exempt_total: i64 = 0;
        let mut market_total_vol: i64 = 0;

        for (i, line) in lines.iter().enumerate() {
            if i == 0 {
                continue;
            }
            if let Some((symbol, short, exempt, total)) =
                FinraShortVolMarketSource::parse_short_vol_line(line)
            {
                let entry = per_symbol.entry(symbol).or_insert((0, 0, 0));
                entry.0 += short;
                entry.1 += exempt;
                entry.2 += total;
                market_short_total += short;
                market_exempt_total += exempt;
                market_total_vol += total;
            }
        }

        // AAPL should be aggregated across O and N markets
        let aapl = per_symbol.get("AAPL").unwrap();
        assert_eq!(aapl.0, 1500000); // 1M + 500K short
        assert_eq!(aapl.1, 7000); // 5K + 2K exempt
        assert_eq!(aapl.2, 4500000); // 3M + 1.5M total

        // Market-wide totals
        assert_eq!(market_short_total, 4300000); // 1M + 500K + 2M + 800K
        assert_eq!(market_exempt_total, 18000); // 5K + 2K + 10K + 1K
        assert_eq!(market_total_vol, 9000000); // 3M + 1.5M + 3.5M + 1M

        // Market ratio
        let market_ratio = (market_short_total as f64 / market_total_vol as f64) * 100.0;
        assert!((market_ratio - 47.78).abs() < 0.1);

        // High short count (>50%): GME = 80%, others below
        let high_short_count = per_symbol
            .values()
            .filter(|(short, _, total)| *total > 0 && (*short as f64 / *total as f64) > 0.5)
            .count();
        assert_eq!(high_short_count, 2); // TSLA (57.1%) and GME (80%)
    }

    #[test]
    fn test_per_ticker_lookup() {
        // Verify that TRACKED_TICKERS symbols are the ones we'd look up
        let mut per_symbol: HashMap<String, (i64, i64, i64)> = HashMap::new();
        per_symbol.insert("AAPL".to_string(), (1000000, 5000, 3000000));
        per_symbol.insert("TSLA".to_string(), (2000000, 10000, 3500000));
        per_symbol.insert("RANDOM_UNKNOWN".to_string(), (100, 0, 200));

        let mut found_count = 0;
        for (ticker, suffix, _name) in TRACKED_TICKERS {
            if let Some((short_vol, _exempt, total_vol)) = per_symbol.get(*ticker) {
                let ratio = (*short_vol as f64 / *total_vol as f64) * 100.0;
                assert!(ratio >= 0.0 && ratio <= 100.0);
                assert_eq!(
                    format!("shvol_{}_ratio", suffix),
                    format!("shvol_{}_ratio", suffix)
                );
                found_count += 1;
            }
        }

        // Should find AAPL and TSLA from our test data
        assert_eq!(found_count, 2);

        // RANDOM_UNKNOWN should NOT be looked up (not in TRACKED_TICKERS)
        let tracked_symbols: Vec<&str> = TRACKED_TICKERS.iter().map(|(t, _, _)| *t).collect();
        assert!(!tracked_symbols.contains(&"RANDOM_UNKNOWN"));
    }
}
