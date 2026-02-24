//! Untappd beer social data -- check-ins, ratings, trending beers.
//!
//! API: https://api.untappd.com/v4
//! Auth: client_id + client_secret as query params.
//! Rate limit: 100 calls/hour.
//!
//! Discovery: Dynamic -- /beer/trending + /search/beer?sort=checkin.
//! Feeds per beer: 4 (checkins, rating, rating_count, monthly).
//! Pattern F (full list re-fetch) + A (fan-out from /beer/info responses).

use std::collections::HashMap;
use std::time::Duration;

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use tracing::{info, warn};

use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

const UNTAPPD_API: &str = "https://api.untappd.com/v4";

/// Max beers to track (keeps API calls within budget).
const MAX_BEERS: usize = 50;

/// Max beer/info calls per sync (stay under 16 calls/sync budget).
const MAX_INFO_CALLS: usize = 12;

/// Delay between API calls to spread load.
const INTER_REQUEST_DELAY_MS: u64 = 200;

// -- Untappd API response types --

#[derive(Debug, Deserialize)]
struct UntappdResponse<T> {
    response: Option<T>,
}

// Trending response
#[derive(Debug, Deserialize)]
struct TrendingResponse {
    micro: Option<TrendingMicro>,
    macro_list: Option<TrendingMacro>,
}

#[derive(Debug, Deserialize)]
struct TrendingMicro {
    items: Option<Vec<TrendingItem>>,
}

#[derive(Debug, Deserialize)]
struct TrendingMacro {
    items: Option<Vec<TrendingItem>>,
}

#[derive(Debug, Deserialize)]
struct TrendingItem {
    beer: Option<BeerBasic>,
    brewery: Option<BreweryBasic>,
}

// Search response
#[derive(Debug, Deserialize)]
struct SearchResponse {
    beers: Option<SearchBeers>,
}

#[derive(Debug, Deserialize)]
struct SearchBeers {
    items: Option<Vec<SearchBeerItem>>,
}

#[derive(Debug, Deserialize)]
struct SearchBeerItem {
    beer: Option<BeerBasic>,
    brewery: Option<BreweryBasic>,
}

#[derive(Debug, Deserialize)]
struct BeerBasic {
    bid: Option<u64>,
    beer_name: Option<String>,
    beer_style: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BreweryBasic {
    brewery_name: Option<String>,
}

// Beer info response
#[derive(Debug, Deserialize)]
struct BeerInfoResponse {
    beer: Option<BeerDetail>,
}

#[derive(Debug, Deserialize)]
struct BeerDetail {
    #[allow(dead_code)]
    bid: Option<u64>,
    beer_name: Option<String>,
    #[allow(dead_code)]
    beer_style: Option<String>,
    brewery: Option<BreweryBasic>,
    stats: Option<BeerStats>,
    rating_score: Option<f64>,
    rating_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct BeerStats {
    total_count: Option<u64>,
    monthly_count: Option<u64>,
    #[allow(dead_code)]
    total_user_count: Option<u64>,
    #[allow(dead_code)]
    user_count: Option<u64>,
}

// -- Discovered beer --

#[derive(Debug, Clone)]
struct DiscoveredBeer {
    bid: u64,
    name: String,
    brewery: String,
    style: String,
}

// -- Source implementation --

pub struct UntappdMarketSource {
    http: SourceHttpClient,
    client_id: String,
    client_secret: String,
}

impl UntappdMarketSource {
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("UNTAPPD_CLIENT_ID")
            .map_err(|_| anyhow::anyhow!("UNTAPPD_CLIENT_ID not set"))?;
        let client_secret = std::env::var("UNTAPPD_CLIENT_SECRET")
            .map_err(|_| anyhow::anyhow!("UNTAPPD_CLIENT_SECRET not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 80, // 20% headroom under 100/hr
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Untappd beer source initialized");
        Ok(Self {
            http,
            client_id,
            client_secret,
        })
    }

    fn auth_params(&self) -> String {
        format!(
            "client_id={}&client_secret={}",
            self.client_id, self.client_secret
        )
    }

    /// Discover beers from trending + search endpoints.
    async fn discover_beers(&self) -> Vec<DiscoveredBeer> {
        let mut seen = HashMap::new();

        // 1. Trending (1 call)
        let trending_url = format!("{}/beer/trending?{}", UNTAPPD_API, self.auth_params());
        if let Ok(resp) = self
            .http
            .get_json::<UntappdResponse<TrendingResponse>>(&trending_url)
            .await
        {
            if let Some(r) = resp.response {
                let items = r
                    .micro
                    .and_then(|m| m.items)
                    .unwrap_or_default()
                    .into_iter()
                    .chain(r.macro_list.and_then(|m| m.items).unwrap_or_default());
                for item in items {
                    if let Some(beer) = item.beer {
                        if let Some(bid) = beer.bid {
                            seen.entry(bid).or_insert(DiscoveredBeer {
                                bid,
                                name: beer.beer_name.unwrap_or_default(),
                                brewery: item
                                    .brewery
                                    .and_then(|b| b.brewery_name)
                                    .unwrap_or_default(),
                                style: beer.beer_style.unwrap_or_default(),
                            });
                        }
                    }
                }
            }
        }

        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

        // 2. Search by popularity -- 2 pages (2 calls)
        for offset in [0, 25] {
            let search_url = format!(
                "{}/search/beer?q=&sort=checkin&limit=25&offset={}&{}",
                UNTAPPD_API,
                offset,
                self.auth_params()
            );
            if let Ok(resp) = self
                .http
                .get_json::<UntappdResponse<SearchResponse>>(&search_url)
                .await
            {
                if let Some(r) = resp.response {
                    for item in r.beers.and_then(|b| b.items).unwrap_or_default() {
                        if let Some(beer) = item.beer {
                            if let Some(bid) = beer.bid {
                                seen.entry(bid).or_insert(DiscoveredBeer {
                                    bid,
                                    name: beer.beer_name.unwrap_or_default(),
                                    brewery: item
                                        .brewery
                                        .and_then(|b| b.brewery_name)
                                        .unwrap_or_default(),
                                    style: beer.beer_style.unwrap_or_default(),
                                });
                            }
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        let mut beers: Vec<DiscoveredBeer> = seen.into_values().collect();
        beers.truncate(MAX_BEERS);
        beers
    }
}

#[async_trait::async_trait]
impl MarketDataSource for UntappdMarketSource {
    fn source_id(&self) -> &'static str {
        "untappd"
    }

    fn display_name(&self) -> &'static str {
        "Untappd Beer"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 80,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let beers = self.discover_beers().await;
        info!("Untappd: discovered {} unique beers", beers.len());

        let mut assets = Vec::with_capacity(beers.len() * 4);
        for beer in &beers {
            let base_name = if beer.brewery.is_empty() {
                beer.name.clone()
            } else {
                format!("{} ({})", beer.name, beer.brewery)
            };

            let feeds = [
                ("checkins", "Check-ins", "sentiment"),
                ("rating", "Rating", "sentiment"),
                ("rating_count", "Ratings Count", "sentiment"),
                ("monthly", "Monthly Check-ins", "sentiment"),
            ];

            for (suffix, label, cat) in &feeds {
                assets.push(AssetUpdate {
                    asset_id: format!("untappd_{}_{}", beer.bid, suffix),
                    symbol: format!("BEER/{}/{}", beer.bid, suffix.to_uppercase()),
                    name: format!("{} [{}]", base_name, label),
                    category: Some(cat.to_string()),
                    metadata: serde_json::json!({
                        "api_ref": beer.bid.to_string(),
                        "subcategory": "beer",
                        "active": true,
                        "beer_name": beer.name,
                        "brewery": beer.brewery,
                        "style": beer.style,
                        "feed_type": suffix,
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }
        let now = Utc::now();

        // Collect unique BIDs from requested asset_ids.
        // Match known suffixes explicitly to handle compound suffixes like "rating_count".
        let mut bid_to_assets: HashMap<u64, Vec<(String, String)>> = HashMap::new();
        let known_suffixes = ["_checkins", "_rating_count", "_rating", "_monthly"];
        for asset_id in asset_ids {
            if let Some(rest) = asset_id.strip_prefix("untappd_") {
                let mut matched = false;
                for suffix in &known_suffixes {
                    if let Some(bid_str) = rest.strip_suffix(suffix) {
                        if let Ok(bid) = bid_str.parse::<u64>() {
                            let clean_suffix = &suffix[1..]; // strip leading '_'
                            bid_to_assets
                                .entry(bid)
                                .or_default()
                                .push((asset_id.clone(), clean_suffix.to_string()));
                            matched = true;
                            break;
                        }
                    }
                }
                if !matched {
                    warn!("Untappd: could not parse asset_id {}", asset_id);
                }
            }
        }

        let mut results = Vec::new();
        let mut calls = 0;

        for (bid, assets) in &bid_to_assets {
            if calls >= MAX_INFO_CALLS {
                break;
            }

            let url = format!(
                "{}/beer/info/{}?compact=true&{}",
                UNTAPPD_API,
                bid,
                self.auth_params()
            );

            match self
                .http
                .get_json::<UntappdResponse<BeerInfoResponse>>(&url)
                .await
            {
                Ok(resp) => {
                    if let Some(beer) = resp.response.and_then(|r| r.beer) {
                        let checkins = beer
                            .stats
                            .as_ref()
                            .and_then(|s| s.total_count)
                            .unwrap_or(0);
                        let rating = beer.rating_score.unwrap_or(0.0);
                        let rating_count = beer.rating_count.unwrap_or(0);
                        let monthly = beer
                            .stats
                            .as_ref()
                            .and_then(|s| s.monthly_count)
                            .unwrap_or(0);

                        for (asset_id, suffix) in assets {
                            let (value, symbol_suffix) = match suffix.as_str() {
                                "checkins" => (Decimal::from(checkins), "CHECKINS"),
                                "rating" => (
                                    Decimal::try_from(rating).unwrap_or(Decimal::ZERO),
                                    "RATING",
                                ),
                                "rating_count" => (Decimal::from(rating_count), "RATINGS"),
                                "monthly" => (Decimal::from(monthly), "MONTHLY"),
                                _ => continue,
                            };

                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: format!("BEER/{}/{}", bid, symbol_suffix),
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Untappd: failed to fetch beer {}: {:?}", bid, e);
                }
            }

            calls += 1;
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!(
            "Untappd: fetched {} prices from {} beer/info calls",
            results.len(),
            calls
        );
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    /// Helper: replicates the asset_id parsing logic from fetch_prices.
    fn parse_untappd_asset_id(asset_id: &str) -> Option<(u64, String)> {
        let rest = asset_id.strip_prefix("untappd_")?;
        let known_suffixes = ["_checkins", "_rating_count", "_rating", "_monthly"];
        for suffix in &known_suffixes {
            if let Some(bid_str) = rest.strip_suffix(suffix) {
                if let Ok(bid) = bid_str.parse::<u64>() {
                    return Some((bid, suffix[1..].to_string()));
                }
            }
        }
        None
    }

    #[test]
    fn test_parse_checkins() {
        let (bid, suffix) = parse_untappd_asset_id("untappd_12345_checkins").unwrap();
        assert_eq!(bid, 12345);
        assert_eq!(suffix, "checkins");
    }

    #[test]
    fn test_parse_rating() {
        let (bid, suffix) = parse_untappd_asset_id("untappd_99999_rating").unwrap();
        assert_eq!(bid, 99999);
        assert_eq!(suffix, "rating");
    }

    #[test]
    fn test_parse_rating_count() {
        let (bid, suffix) = parse_untappd_asset_id("untappd_12345_rating_count").unwrap();
        assert_eq!(bid, 12345);
        assert_eq!(suffix, "rating_count");
    }

    #[test]
    fn test_parse_monthly() {
        let (bid, suffix) = parse_untappd_asset_id("untappd_67890_monthly").unwrap();
        assert_eq!(bid, 67890);
        assert_eq!(suffix, "monthly");
    }

    #[test]
    fn test_parse_missing_prefix() {
        assert!(parse_untappd_asset_id("other_12345_checkins").is_none());
    }

    #[test]
    fn test_parse_unknown_suffix() {
        assert!(parse_untappd_asset_id("untappd_12345_unknown").is_none());
    }
}
