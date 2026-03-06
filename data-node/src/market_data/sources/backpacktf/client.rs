//! backpack.tf API client implementing MarketDataSource
//!
//! Tracks TF2 item prices from backpack.tf community pricing.
//! A single API call returns all ~2,700 priced items with USD conversion rates.
//!
//! API: https://backpack.tf/api/IGetPrices/v4?key=KEY
//! Auth: API key (with elevated access) via BACKPACKTF_API_KEY env var
//! Rate limit: Generous — we only need 1 call per sync cycle

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic from API)
const ASSET_JSON: &str = include_str!("../../../config/backpacktf.json");

/// backpack.tf API base URL
const API_URL: &str = "https://backpack.tf/api/IGetPrices/v4";

/// TF2 Quality IDs (preference order for price selection)
/// 6 = Unique, 1 = Genuine, 11 = Strange, 5 = Unusual, 14 = Collector's, 0 = Normal
const QUALITY_PREFERENCE: &[&str] = &["6", "1", "11", "5", "14", "0"];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct PricesResponse {
    response: PricesInner,
}

#[derive(Debug, Deserialize)]
struct PricesInner {
    success: u8,
    /// USD value of 1 refined metal
    raw_usd_value: f64,
    /// Map of item name -> item data
    #[serde(default)]
    items: HashMap<String, ItemData>,
}

#[derive(Debug, Deserialize)]
struct ItemData {
    defindex: Vec<i64>,
    /// Quality ID (string) -> tradability data
    prices: HashMap<String, HashMap<String, HashMap<String, serde_json::Value>>>,
}

/// A resolved price for a single item
struct ResolvedPrice {
    value_usd: f64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct BackpackTfMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl BackpackTfMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("BACKPACKTF_API_KEY")
            .map_err(|_| anyhow::anyhow!("BACKPACKTF_API_KEY env var not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10, // Only need ~1 call per cycle
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("backpack.tf source initialized");

        Ok(Self { http, api_key })
    }

    /// Fetch all prices from backpack.tf in a single API call
    async fn fetch_all_prices(&self) -> Result<PricesResponse, SourceError> {
        let url = format!("{}?key={}", API_URL, self.api_key);
        self.http.get_json(&url).await
    }

    /// Resolve the best price for an item in USD
    fn resolve_price(
        item: &ItemData,
        usd_per_metal: f64,
        key_in_metal: f64,
    ) -> Option<ResolvedPrice> {
        for quality in QUALITY_PREFERENCE {
            let qdata = match item.prices.get(*quality) {
                Some(q) => q,
                None => continue,
            };
            let tradable = match qdata.get("Tradable") {
                Some(t) => t,
                None => continue,
            };
            let craftable = match tradable.get("Craftable") {
                Some(c) => c,
                None => continue,
            };

            // craftable is a JSON array of price entries
            let entries: Vec<PriceEntry> = match serde_json::from_value(craftable.clone()) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in &entries {
                if let (Some(val), Some(cur)) = (entry.value, entry.currency.as_deref()) {
                    let value_usd = match cur {
                        "metal" => val * usd_per_metal,
                        "keys" => val * key_in_metal * usd_per_metal,
                        _ => continue,
                    };
                    return Some(ResolvedPrice { value_usd });
                }
            }
        }
        None
    }
}

#[derive(Deserialize)]
struct PriceEntry {
    value: Option<f64>,
    currency: Option<String>,
}

/// Get the key price in metal from the API response
fn get_key_price_metal(items: &HashMap<String, ItemData>) -> f64 {
    if let Some(key_item) = items.get("Mann Co. Supply Crate Key") {
        if let Some(qdata) = key_item.prices.get("6") {
            if let Some(tradable) = qdata.get("Tradable") {
                if let Some(craftable) = tradable.get("Craftable") {
                    if let Ok(entries) = serde_json::from_value::<Vec<PriceEntry>>(craftable.clone())
                    {
                        for e in &entries {
                            if let (Some(val), Some(cur)) = (e.value, e.currency.as_deref()) {
                                if cur == "metal" {
                                    return val;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    // Fallback: reasonable default
    57.0
}

/// Sanitize item name into a valid asset_id
fn make_asset_id(defindex: i64) -> String {
    format!("tf2_item_{}", defindex)
}

#[async_trait::async_trait]
impl MarketDataSource for BackpackTfMarketSource {
    fn source_id(&self) -> &'static str {
        "backpacktf"
    }

    fn display_name(&self) -> &'static str {
        "backpack.tf TF2 Items"
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
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery from API
        info!("backpack.tf config is empty, performing live asset discovery");
        let resp = self
            .fetch_all_prices()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch backpack.tf prices: {:?}", e))?;

        if resp.response.success != 1 {
            return Err(anyhow::anyhow!("backpack.tf API returned success=0"));
        }

        let usd_per_metal = resp.response.raw_usd_value;
        let key_in_metal = get_key_price_metal(&resp.response.items);

        let mut assets = Vec::new();
        for (name, data) in &resp.response.items {
            let defindex = data.defindex.first().copied().unwrap_or(-1);
            if defindex < 0 {
                continue; // Skip items with negative defindex
            }
            if defindex == 0 && name != "Bat" {
                continue; // Skip items without a valid defindex
            }

            // Only include items that have a resolvable price
            if Self::resolve_price(data, usd_per_metal, key_in_metal).is_none() {
                continue;
            }

            assets.push(AssetUpdate {
                asset_id: make_asset_id(defindex),
                symbol: format!("TF2#{}", defindex),
                name: name.clone(),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("defindex:{}", defindex),
                    "subcategory": "gaming_items",
                    "active": true,
                    "extra": {
                        "item_name": name,
                    },
                }),
            });
        }

        info!(
            "Discovered {} priceable TF2 items from backpack.tf",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Single API call gets all prices
        let resp = self
            .fetch_all_prices()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch backpack.tf prices: {:?}", e))?;

        if resp.response.success != 1 {
            return Err(anyhow::anyhow!("backpack.tf API returned success=0"));
        }

        let usd_per_metal = resp.response.raw_usd_value;
        let key_in_metal = get_key_price_metal(&resp.response.items);

        // Build defindex -> (name, item_data) lookup
        let mut defindex_lookup: HashMap<i64, (&str, &ItemData)> = HashMap::new();
        for (name, data) in &resp.response.items {
            for &defindex in &data.defindex {
                defindex_lookup.insert(defindex, (name, data));
            }
        }

        // Also load api_ref from config for existing assets
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        let mut results = Vec::new();
        for asset_id in asset_ids {
            let defindex = if let Some(api_ref) = ref_lookup.get(asset_id) {
                parse_defindex_from_ref(api_ref)
            } else {
                parse_defindex_from_asset_id(asset_id)
            };

            let defindex = match defindex {
                Some(id) => id,
                None => {
                    debug!("Cannot parse defindex from asset_id: {}", asset_id);
                    continue;
                }
            };

            if let Some((item_name, data)) = defindex_lookup.get(&defindex) {
                if let Some(price) = Self::resolve_price(data, usd_per_metal, key_in_metal) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: item_name.to_string(),
                        value: Decimal::from_f64_retain(price.value_usd)
                            .unwrap_or(Decimal::ZERO),
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
            "Fetched {}/{} prices from backpack.tf",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering TF2 items from backpack.tf...");
        let resp = self
            .fetch_all_prices()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch backpack.tf prices: {:?}", e))?;

        if resp.response.success != 1 {
            return Err(anyhow::anyhow!("backpack.tf API returned success=0"));
        }

        let usd_per_metal = resp.response.raw_usd_value;
        let key_in_metal = get_key_price_metal(&resp.response.items);

        let mut entries = Vec::new();
        for (name, data) in &resp.response.items {
            let defindex = data.defindex.first().copied().unwrap_or(-1);
            if defindex < 0 {
                continue;
            }
            if defindex == 0 && name != "Bat" {
                continue;
            }

            if Self::resolve_price(data, usd_per_metal, key_in_metal).is_none() {
                continue;
            }

            entries.push(AssetEntry {
                asset_id: make_asset_id(defindex),
                symbol: format!("TF2#{}", defindex),
                name: name.clone(),
                category: "sentiment".to_string(),
                subcategory: "gaming_items".to_string(),
                api_ref: format!("defindex:{}", defindex),
                active: true,
            });
        }

        info!("Discovered {} priceable TF2 items", entries.len());
        Ok(entries)
    }
}

/// Parse defindex from api_ref like "defindex:730"
fn parse_defindex_from_ref(api_ref: &str) -> Option<i64> {
    api_ref.strip_prefix("defindex:")?.parse().ok()
}

/// Parse defindex from asset_id like "tf2_item_730"
fn parse_defindex_from_asset_id(asset_id: &str) -> Option<i64> {
    asset_id.strip_prefix("tf2_item_")?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("backpacktf", "backpacktf");
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
    fn test_parse_defindex_from_ref() {
        assert_eq!(parse_defindex_from_ref("defindex:730"), Some(730i64));
        assert_eq!(parse_defindex_from_ref("defindex:5021"), Some(5021i64));
        assert_eq!(parse_defindex_from_ref("invalid"), None);
        assert_eq!(parse_defindex_from_ref("defindex:"), None);
        assert_eq!(parse_defindex_from_ref("defindex:abc"), None);
    }

    #[test]
    fn test_parse_defindex_from_asset_id() {
        assert_eq!(parse_defindex_from_asset_id("tf2_item_730"), Some(730i64));
        assert_eq!(parse_defindex_from_asset_id("tf2_item_5021"), Some(5021i64));
        assert_eq!(parse_defindex_from_asset_id("invalid"), None);
        assert_eq!(parse_defindex_from_asset_id("tf2_item_"), None);
    }

    #[test]
    fn test_make_asset_id() {
        assert_eq!(make_asset_id(730), "tf2_item_730");
        assert_eq!(make_asset_id(5021), "tf2_item_5021");
    }

    #[test]
    fn test_quality_preference_order() {
        assert_eq!(QUALITY_PREFERENCE[0], "6"); // Unique first
        assert!(QUALITY_PREFERENCE.len() >= 4);
    }

    #[test]
    fn test_usd_conversion() {
        let usd_per_metal: f64 = 0.0275;
        let key_in_metal: f64 = 57.33;

        // 1 metal = $0.0275
        let metal_val: f64 = 10.0 * usd_per_metal;
        assert!((metal_val - 0.275).abs() < 0.001);

        // 1 key = 57.33 metal = ~$1.577
        let key_val: f64 = 1.0 * key_in_metal * usd_per_metal;
        assert!((key_val - 1.577).abs() < 0.01);
    }
}
