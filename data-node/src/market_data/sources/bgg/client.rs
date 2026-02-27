//! BoardGameGeek (BGG) data source implementing MarketDataSource
//!
//! Tracks the BGG "Hot" list — the top 50 most-discussed/viewed board games.
//! Each game is a feed; its value is the hotness rank position (1-50).
//! Lower rank = hotter. Ranks reshuffle throughout the day as user activity changes.
//!
//! Assets are dynamic — discovered from the /hot endpoint every sync.
//!
//! API: https://boardgamegeek.com/xmlapi2
//! Auth: Bearer token required (register at https://boardgamegeek.com/using_the_xml_api)
//! Env: BGG_API_TOKEN (required)
//! Rate limit: 12 req/min (5-second wait between requests)

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// BGG XML API2 base URL
const API_BASE: &str = "https://boardgamegeek.com/xmlapi2";

// ============================================================================
// XML RESPONSE TYPES (BGG returns XML, we parse manually)
// ============================================================================

/// A hot item from the BGG hot list
#[derive(Debug)]
struct HotItem {
    id: u64,
    rank: u32,
    name: String,
    year: Option<String>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct BggMarketSource {
    http: SourceHttpClient,
    /// BGG API Bearer token — required since BGG enforced auth on XML API2.
    /// Register at https://boardgamegeek.com/using_the_xml_api to obtain one.
    api_token: String,
}

impl BggMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_token = std::env::var("BGG_API_TOKEN").unwrap_or_default();
        if api_token.is_empty() {
            anyhow::bail!("BGG_API_TOKEN not set — BGG now requires auth, register at https://boardgamegeek.com/using_the_xml_api");
        }

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("BoardGameGeek source initialized (auth=bearer_token)");
        Ok(Self { http, api_token })
    }

    /// Parse the BGG hot list XML response into HotItem structs.
    /// BGG returns XML like:
    /// <items termsofuse="...">
    ///   <item id="174430" rank="1">
    ///     <thumbnail value="..."/>
    ///     <name value="Gloomhaven"/>
    ///     <yearpublished value="2017"/>
    ///   </item>
    ///   ...
    /// </items>
    fn parse_hot_list(xml: &str) -> Vec<HotItem> {
        let mut items = Vec::new();

        // Simple XML parsing without a full XML library — extract <item> tags
        for item_chunk in xml.split("<item ").skip(1) {
            let id = Self::extract_attr(item_chunk, "id")
                .and_then(|s| s.parse::<u64>().ok());
            let rank = Self::extract_attr(item_chunk, "rank")
                .and_then(|s| s.parse::<u32>().ok());
            let name = Self::extract_value_attr(item_chunk, "name");
            let year = Self::extract_value_attr(item_chunk, "yearpublished");

            if let (Some(id), Some(rank), Some(name)) = (id, rank, name) {
                items.push(HotItem { id, rank, name, year });
            }
        }

        items
    }

    /// Extract an attribute value from an XML tag fragment.
    /// e.g., from `id="174430" rank="1">...` extract "174430" for attr "id"
    fn extract_attr(chunk: &str, attr: &str) -> Option<String> {
        let pattern = format!("{}=\"", attr);
        let start = chunk.find(&pattern)? + pattern.len();
        let end = chunk[start..].find('"')? + start;
        Some(chunk[start..end].to_string())
    }

    /// Extract a value="..." attribute from a child element.
    /// e.g., from `<name value="Gloomhaven"/>` extract "Gloomhaven"
    fn extract_value_attr(chunk: &str, tag: &str) -> Option<String> {
        let pattern = format!("<{} value=\"", tag);
        let start = chunk.find(&pattern)? + pattern.len();
        let end = chunk[start..].find('"')? + start;
        Some(chunk[start..end].to_string())
    }

    /// Fetch the hot list XML from BGG API.
    /// Uses Bearer token auth (required since BGG enforced API authorization).
    async fn fetch_hot_xml(&self) -> Result<String, crate::market_data::sources::error::SourceError> {
        let url = format!("{}/hot?type=boardgame", API_BASE);
        let bearer = format!("Bearer {}", self.api_token);

        // Use the inner client directly with the rate limiter for XML (non-JSON) response.
        self.http.rate_limiter().wait_for_permit().await;

        let resp = self
            .http
            .inner()
            .get(&url)
            .header("Authorization", &bearer)
            .header("User-Agent", "IndexDataNode/1.0")
            .send()
            .await
            .map_err(|e| crate::market_data::sources::error::SourceError::Transient(e.to_string()))?;

        if resp.status().as_u16() == 401 {
            return Err(crate::market_data::sources::error::SourceError::AuthFailed(
                "BGG API returned 401 Unauthorized — check BGG_API_TOKEN".to_string(),
            ));
        }

        if !resp.status().is_success() {
            return Err(crate::market_data::sources::error::SourceError::Transient(
                format!("BGG API returned status {}", resp.status()),
            ));
        }

        resp.text()
            .await
            .map_err(|e| crate::market_data::sources::error::SourceError::Transient(e.to_string()))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BggMarketSource {
    fn source_id(&self) -> &'static str {
        "bgg"
    }

    fn display_name(&self) -> &'static str {
        "BoardGameGeek"
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
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let xml = match self.fetch_hot_xml().await {
            Ok(xml) => xml,
            Err(e) => {
                warn!("BGG hot list fetch failed: {:?}", e);
                return Ok(Vec::new());
            }
        };

        let hot_items = Self::parse_hot_list(&xml);
        let assets: Vec<AssetUpdate> = hot_items
            .iter()
            .map(|item| {
                let year_str = item.year.as_deref().unwrap_or("?");
                AssetUpdate {
                    asset_id: format!("bgg_{}_rank", item.id),
                    symbol: format!("BGG:{}", item.id),
                    name: format!("{} ({}) [Hotness]", item.name, year_str),
                    category: Some("sentiment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("bgg:{}", item.id),
                        "subcategory": "board_games",
                        "active": true,
                        "extra": {
                            "bgg_id": item.id,
                            "year": item.year,
                        },
                    }),
                }
            })
            .collect();

        info!("BGG fetch_assets: {} hot games discovered", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Fetch the hot list (single API call)
        let xml = match self.fetch_hot_xml().await {
            Ok(xml) => xml,
            Err(e) => {
                warn!("BGG hot list fetch failed during price sync: {:?}", e);
                return Ok(Vec::new());
            }
        };

        let hot_items = Self::parse_hot_list(&xml);

        // Build lookup: "bgg_{id}_rank" → rank value
        let mut rank_map: HashMap<String, Decimal> = HashMap::new();
        for item in &hot_items {
            let asset_id = format!("bgg_{}_rank", item.id);
            rank_map.insert(asset_id, Decimal::from(item.rank));
        }

        // Map requested asset_ids to their rank values
        let mut results = Vec::with_capacity(asset_ids.len());
        for asset_id in asset_ids {
            if let Some(&rank) = rank_map.get(asset_id) {
                // Extract game ID from asset_id for symbol
                let game_id = asset_id
                    .strip_prefix("bgg_")
                    .and_then(|s| s.strip_suffix("_rank"))
                    .unwrap_or(asset_id);

                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!("BGG:{}", game_id),
                    value: rank,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
            // If not in hot list anymore, skip (asset will be marked inactive by sync engine)
        }

        info!(
            "Fetched {}/{} prices from BGG ({} hot games)",
            results.len(),
            asset_ids.len(),
            hot_items.len()
        );

        Ok(results)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_HOT_XML: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
    <item id="174430" rank="1">
        <thumbnail value="https://example.com/thumb1.jpg"/>
        <name value="Gloomhaven"/>
        <yearpublished value="2017"/>
    </item>
    <item id="167791" rank="2">
        <thumbnail value="https://example.com/thumb2.jpg"/>
        <name value="Terraforming Mars"/>
        <yearpublished value="2016"/>
    </item>
    <item id="224517" rank="3">
        <thumbnail value="https://example.com/thumb3.jpg"/>
        <name value="Brass: Birmingham"/>
        <yearpublished value="2018"/>
    </item>
</items>"#;

    #[test]
    fn test_parse_hot_list() {
        let items = BggMarketSource::parse_hot_list(SAMPLE_HOT_XML);
        assert_eq!(items.len(), 3);

        assert_eq!(items[0].id, 174430);
        assert_eq!(items[0].rank, 1);
        assert_eq!(items[0].name, "Gloomhaven");
        assert_eq!(items[0].year.as_deref(), Some("2017"));

        assert_eq!(items[1].id, 167791);
        assert_eq!(items[1].rank, 2);
        assert_eq!(items[1].name, "Terraforming Mars");

        assert_eq!(items[2].id, 224517);
        assert_eq!(items[2].rank, 3);
        assert_eq!(items[2].name, "Brass: Birmingham");
    }

    #[test]
    fn test_parse_empty_xml() {
        let items = BggMarketSource::parse_hot_list("<items></items>");
        assert!(items.is_empty());
    }

    #[test]
    fn test_extract_attr() {
        let chunk = r#"id="174430" rank="1">"#;
        assert_eq!(
            BggMarketSource::extract_attr(chunk, "id"),
            Some("174430".to_string())
        );
        assert_eq!(
            BggMarketSource::extract_attr(chunk, "rank"),
            Some("1".to_string())
        );
    }

    #[test]
    fn test_asset_id_format() {
        let items = BggMarketSource::parse_hot_list(SAMPLE_HOT_XML);
        let asset_id = format!("bgg_{}_rank", items[0].id);
        assert_eq!(asset_id, "bgg_174430_rank");
        assert!(asset_id.starts_with("bgg_"));
    }
}
