//! 4chan Board Activity client implementing MarketDataSource
//!
//! Tracks board-level activity metrics: thread creation rate, reply volume,
//! image volume, greentext ratio, and external link count.
//!
//! Assets are dynamic — generated from a curated list of high-signal boards.
//! Each board produces 5 metric assets, computed from a single catalog.json fetch.
//!
//! API: https://a.4cdn.org
//! Auth: None
//! Rate limit: 1 request/second

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/fourchan.json");

/// 4chan API base URL
const API_URL: &str = "https://a.4cdn.org";

/// Delay between sequential catalog fetches (ms) — 4chan requires max 1 req/sec
const INTER_REQUEST_DELAY_MS: u64 = 2000;

/// User-Agent header — 4chan API requires a descriptive User-Agent
const USER_AGENT: &str = "AgiArena-DataNode/1.0 (market data indexer; +https://agiarena.org)";

/// Boards tracked for sentiment metrics.
/// Curated for signal quality: finance, politics, tech, entertainment, culture.
const TRACKED_BOARDS: &[(&str, &str)] = &[
    ("biz", "Business & Finance"),
    ("pol", "Politically Incorrect"),
    ("g", "Technology"),
    ("news", "Current Events"),
    ("sci", "Science & Math"),
    ("int", "International"),
    ("v", "Video Games"),
    ("vg", "Video Game Generals"),
    ("a", "Anime & Manga"),
    ("tv", "Television & Film"),
    ("mu", "Music"),
    ("sp", "Sports"),
    ("co", "Comics & Cartoons"),
    ("vt", "Virtual YouTubers"),
    ("fit", "Fitness"),
    ("diy", "Do It Yourself"),
    ("o", "Auto"),
    ("k", "Weapons"),
    ("lit", "Literature"),
    ("x", "Paranormal"),
];

/// Metrics computed per board from catalog data.
const METRICS: &[(&str, &str)] = &[
    ("new_threads", "New Threads (10min)"),
    ("total_replies", "Total Replies"),
    ("total_images", "Total Images"),
    ("greentext_pct", "Greentext %"),
    ("link_count", "External Links"),
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A page in the catalog response
#[derive(Debug, Deserialize)]
struct CatalogPage {
    #[allow(dead_code)]
    page: u32,
    threads: Vec<CatalogThread>,
}

/// A thread in the catalog (OP data + last few replies)
#[derive(Debug, Deserialize)]
struct CatalogThread {
    #[allow(dead_code)]
    no: u64,
    time: i64,
    #[serde(default)]
    replies: u64,
    #[serde(default)]
    images: u64,
    #[serde(default)]
    com: Option<String>,
    #[serde(default)]
    last_replies: Option<Vec<CatalogReply>>,
}

/// A reply in the catalog's last_replies array
#[derive(Debug, Deserialize)]
struct CatalogReply {
    #[allow(dead_code)]
    no: u64,
    #[serde(default)]
    com: Option<String>,
}

/// Computed metrics for a single board
struct BoardMetrics {
    new_threads: u64,
    total_replies: u64,
    total_images: u64,
    greentext_ratio: Decimal,
    link_count: u64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// 4chan board activity market data source.
///
/// Tracks 5 metrics per board from catalog.json snapshots.
/// Source ID is `"fourchan"`.
pub struct FourchanMarketSource {
    http: SourceHttpClient,
}

impl FourchanMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 28, // 4chan limit: 1 req/sec, use ~0.5/sec to be safe
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!(
            "4chan source initialized ({} boards × {} metrics = {} assets)",
            TRACKED_BOARDS.len(),
            METRICS.len(),
            TRACKED_BOARDS.len() * METRICS.len()
        );

        Ok(Self { http })
    }

    /// Fetch catalog for a board
    async fn fetch_catalog(&self, board: &str) -> Result<Vec<CatalogPage>, SourceError> {
        let url = format!("{}/{}/catalog.json", API_URL, board);
        self.http
            .get_json_with_headers::<Vec<CatalogPage>>(&url, &[("User-Agent", USER_AGENT)])
            .await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FourchanMarketSource {
    fn source_id(&self) -> &'static str {
        "fourchan"
    }

    fn display_name(&self) -> &'static str {
        "4chan"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 28,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // If config JSON has static entries, use them (defensive)
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Generate assets from tracked boards × metrics
        let mut assets = Vec::with_capacity(TRACKED_BOARDS.len() * METRICS.len());

        for &(board, title) in TRACKED_BOARDS {
            for &(metric, metric_display) in METRICS {
                assets.push(AssetUpdate {
                    asset_id: format!("4ch_{}_{}", board, metric),
                    symbol: format!("4CH/{}/{}", board.to_uppercase(), metric.to_uppercase()),
                    name: format!("/{board}/ - {title} ({metric_display})"),
                    category: Some("sentiment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("{board}:{metric}"),
                        "subcategory": "4chan",
                        "active": true,
                        "extra": {
                            "board": board,
                            "metric": metric,
                        },
                    }),
                });
            }
        }

        info!(
            "4chan fetch_assets: {} assets from {} boards",
            assets.len(),
            TRACKED_BOARDS.len()
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let now_unix = now.timestamp();
        let mut results = Vec::new();

        // Group asset_ids by board to fetch each catalog only once
        let mut board_assets: HashMap<String, Vec<(String, String)>> = HashMap::new();
        for asset_id in asset_ids {
            if let Some((board, metric)) = parse_asset_parts(asset_id) {
                board_assets
                    .entry(board.to_string())
                    .or_default()
                    .push((asset_id.clone(), metric.to_string()));
            }
        }

        debug!(
            "4chan fetch_prices: {} asset_ids -> {} unique boards",
            asset_ids.len(),
            board_assets.len()
        );

        for (board, metrics) in &board_assets {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_catalog(board).await {
                Ok(catalog) => {
                    let bm = compute_board_metrics(&catalog, now_unix);

                    for (asset_id, metric) in metrics {
                        let value = match metric.as_str() {
                            "new_threads" => Some(Decimal::from(bm.new_threads)),
                            "total_replies" => Some(Decimal::from(bm.total_replies)),
                            "total_images" => Some(Decimal::from(bm.total_images)),
                            "greentext_pct" => Some(bm.greentext_ratio),
                            "link_count" => Some(Decimal::from(bm.link_count)),
                            _ => None,
                        };

                        if let Some(value) = value {
                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: format!("4CH/{}", board.to_uppercase()),
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
                    warn!("Error fetching 4chan catalog for /{}/: {:?}", board, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from 4chan",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

// ============================================================================
// METRIC COMPUTATION
// ============================================================================

/// Compute all 5 metrics from a board's catalog data.
fn compute_board_metrics(catalog: &[CatalogPage], now_unix: i64) -> BoardMetrics {
    let threads: Vec<&CatalogThread> = catalog.iter().flat_map(|p| &p.threads).collect();

    let total_replies: u64 = threads.iter().map(|t| t.replies).sum();
    let total_images: u64 = threads.iter().map(|t| t.images).sum();
    let new_threads = threads
        .iter()
        .filter(|t| now_unix - t.time < 600)
        .count() as u64;

    // Greentext and link analysis from sampled posts (OP + last_replies)
    let mut greentext_posts = 0u64;
    let mut total_posts = 0u64;
    let mut link_count = 0u64;

    for thread in &threads {
        // OP post
        if let Some(com) = &thread.com {
            total_posts += 1;
            if has_greentext(com) {
                greentext_posts += 1;
            }
            link_count += count_external_links(com);
        }

        // Last replies (3-5 per thread from catalog)
        if let Some(replies) = &thread.last_replies {
            for reply in replies {
                if let Some(com) = &reply.com {
                    total_posts += 1;
                    if has_greentext(com) {
                        greentext_posts += 1;
                    }
                    link_count += count_external_links(com);
                }
            }
        }
    }

    let greentext_ratio = if total_posts > 0 {
        // Store as percentage (e.g., 23.45 means 23.45%)
        Decimal::from(greentext_posts * 10000 / total_posts) / Decimal::from(100)
    } else {
        Decimal::ZERO
    };

    BoardMetrics {
        new_threads,
        total_replies,
        total_images,
        greentext_ratio,
        link_count,
    }
}

/// Check if HTML contains greentext (quoted text spans)
fn has_greentext(html: &str) -> bool {
    html.contains("class=\"quote\"")
}

/// Count external links in HTML.
/// Excludes internal backlinks (#p...) and cross-board links (//boards.4chan.org).
fn count_external_links(html: &str) -> u64 {
    html.matches("href=\"http").count() as u64
}

/// Parse asset_id "4ch_biz_new_threads" into ("biz", "new_threads")
fn parse_asset_parts(asset_id: &str) -> Option<(&str, &str)> {
    let rest = asset_id.strip_prefix("4ch_")?;
    // rest = "biz_new_threads" or "pol_total_replies" etc.
    let underscore_pos = rest.find('_')?;
    let board = &rest[..underscore_pos];
    let metric = &rest[underscore_pos + 1..];
    if board.is_empty() || metric.is_empty() {
        return None;
    }
    Some((board, metric))
}

// ============================================================================
// AUTO-REGISTRATION
// ============================================================================

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("fourchan", "fourchan");
    }

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty(), "Config should be empty — assets are dynamic");
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    #[test]
    fn test_tracked_boards_count() {
        assert_eq!(TRACKED_BOARDS.len(), 20);
        assert_eq!(METRICS.len(), 5);
    }

    #[test]
    fn test_total_asset_count() {
        // 20 boards × 5 metrics = 100 assets
        assert_eq!(TRACKED_BOARDS.len() * METRICS.len(), 100);
    }

    #[test]
    fn test_parse_asset_parts_basic() {
        assert_eq!(parse_asset_parts("4ch_biz_new_threads"), Some(("biz", "new_threads")));
        assert_eq!(parse_asset_parts("4ch_pol_total_replies"), Some(("pol", "total_replies")));
        assert_eq!(parse_asset_parts("4ch_g_total_images"), Some(("g", "total_images")));
        assert_eq!(parse_asset_parts("4ch_a_greentext_pct"), Some(("a", "greentext_pct")));
        assert_eq!(parse_asset_parts("4ch_v_link_count"), Some(("v", "link_count")));
    }

    #[test]
    fn test_parse_asset_parts_multi_char_board() {
        assert_eq!(
            parse_asset_parts("4ch_news_new_threads"),
            Some(("news", "new_threads"))
        );
        assert_eq!(
            parse_asset_parts("4ch_fit_greentext_pct"),
            Some(("fit", "greentext_pct"))
        );
    }

    #[test]
    fn test_parse_asset_parts_invalid() {
        assert_eq!(parse_asset_parts("invalid"), None);
        assert_eq!(parse_asset_parts("4ch_"), None);
        assert_eq!(parse_asset_parts(""), None);
        assert_eq!(parse_asset_parts("hn_123_score"), None);
    }

    #[test]
    fn test_has_greentext() {
        assert!(has_greentext(
            r#"<span class="quote">&gt;implying</span>"#
        ));
        assert!(!has_greentext("just a normal post"));
        assert!(!has_greentext(""));
    }

    #[test]
    fn test_count_external_links() {
        // External link
        assert_eq!(
            count_external_links(r#"<a href="https://example.com">link</a>"#),
            1
        );
        // Two external links
        assert_eq!(
            count_external_links(
                r#"<a href="https://a.com">a</a> <a href="http://b.com">b</a>"#
            ),
            2
        );
        // Internal backlink (no http)
        assert_eq!(
            count_external_links(r##"<a href="#p12345" class="quotelink">&gt;&gt;12345</a>"##),
            0
        );
        // Cross-board link (protocol-relative, no http)
        assert_eq!(
            count_external_links(
                r##"<a href="//boards.4chan.org/biz/" class="quotelink">&gt;&gt;&gt;/biz/</a>"##
            ),
            0
        );
        // Empty
        assert_eq!(count_external_links(""), 0);
        // No links
        assert_eq!(count_external_links("just text"), 0);
    }

    #[test]
    fn test_compute_board_metrics_empty() {
        let catalog: Vec<CatalogPage> = vec![];
        let metrics = compute_board_metrics(&catalog, 1000000);
        assert_eq!(metrics.new_threads, 0);
        assert_eq!(metrics.total_replies, 0);
        assert_eq!(metrics.total_images, 0);
        assert_eq!(metrics.greentext_ratio, Decimal::ZERO);
        assert_eq!(metrics.link_count, 0);
    }

    #[test]
    fn test_compute_board_metrics_basic() {
        let now = 1700000000i64;
        let catalog = vec![CatalogPage {
            page: 1,
            threads: vec![
                CatalogThread {
                    no: 1,
                    time: now - 300, // 5 min ago — within window
                    replies: 100,
                    images: 20,
                    com: Some(r#"<span class="quote">&gt;test</span>"#.to_string()),
                    last_replies: Some(vec![
                        CatalogReply {
                            no: 2,
                            com: Some("normal reply".to_string()),
                        },
                        CatalogReply {
                            no: 3,
                            com: Some(r#"<a href="https://example.com">link</a>"#.to_string()),
                        },
                    ]),
                },
                CatalogThread {
                    no: 4,
                    time: now - 700, // 11+ min ago — outside window
                    replies: 50,
                    images: 10,
                    com: Some("no greentext here".to_string()),
                    last_replies: None,
                },
            ],
        }];

        let metrics = compute_board_metrics(&catalog, now);
        assert_eq!(metrics.new_threads, 1); // only thread 1 is within 10min
        assert_eq!(metrics.total_replies, 150); // 100 + 50
        assert_eq!(metrics.total_images, 30); // 20 + 10
        assert_eq!(metrics.link_count, 1); // one external link in reply 3
        // 4 posts sampled (2 OPs + 2 replies), 1 has greentext = 25%
        assert_eq!(metrics.greentext_ratio, Decimal::from(25));
    }

    #[test]
    fn test_compute_board_metrics_all_greentext() {
        let now = 1700000000i64;
        let catalog = vec![CatalogPage {
            page: 1,
            threads: vec![CatalogThread {
                no: 1,
                time: now - 100,
                replies: 10,
                images: 5,
                com: Some(r#"<span class="quote">&gt;all green</span>"#.to_string()),
                last_replies: Some(vec![CatalogReply {
                    no: 2,
                    com: Some(r#"<span class="quote">&gt;also green</span>"#.to_string()),
                }]),
            }],
        }];

        let metrics = compute_board_metrics(&catalog, now);
        // 2 posts, both greentext = 100%
        assert_eq!(metrics.greentext_ratio, Decimal::from(100));
    }

    #[test]
    fn test_board_names_are_valid() {
        for &(board, _title) in TRACKED_BOARDS {
            assert!(
                !board.is_empty(),
                "Board name should not be empty"
            );
            assert!(
                board.chars().all(|c| c.is_ascii_alphanumeric()),
                "Board '{}' should be alphanumeric",
                board
            );
        }
    }

    #[test]
    fn test_metric_names_are_valid() {
        for &(metric, _display) in METRICS {
            assert!(!metric.is_empty());
            assert!(
                metric.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'),
                "Metric '{}' should be alphanumeric + underscore",
                metric
            );
        }
    }

    #[test]
    fn test_asset_id_roundtrip() {
        // Verify every generated asset_id can be parsed back
        for &(board, _) in TRACKED_BOARDS {
            for &(metric, _) in METRICS {
                let asset_id = format!("4ch_{}_{}", board, metric);
                let parsed = parse_asset_parts(&asset_id);
                assert!(
                    parsed.is_some(),
                    "Failed to parse asset_id: {}",
                    asset_id
                );
                let (pb, pm) = parsed.unwrap();
                assert_eq!(pb, board);
                assert_eq!(pm, metric);
            }
        }
    }
}
