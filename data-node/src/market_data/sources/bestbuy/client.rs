//! Best Buy Products data source implementing MarketDataSource
//!
//! Tracks real-time sale prices of top-selling electronics from Best Buy.
//! Products are discovered dynamically by querying best-selling items in
//! curated categories (laptops, TVs, phones, headphones, etc.).
//!
//! Each product is a feed; its value is the current sale price in USD.
//! Prices change during sales events, clearances, and daily repricing.
//!
//! API: https://api.bestbuy.com/v1
//! Auth: Free API key (register at developer.bestbuy.com)
//! Rate limit: 5 req/sec (300 req/min)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// Best Buy API base URL
const API_BASE: &str = "https://api.bestbuy.com/v1";

/// Categories to track — (category_id, display_label, short_label)
const CATEGORIES: &[(&str, &str, &str)] = &[
    ("abcat0502000", "Laptops", "laptop"),
    ("abcat0101000", "TVs", "tv"),
    ("pcmcat209400050001", "Cell Phones", "phone"),
    ("abcat0204000", "Headphones", "headphones"),
    ("abcat0912000", "Video Games", "games"),
    ("abcat0501000", "Desktops", "desktop"),
    ("abcat0904000", "Tablets", "tablet"),
];

/// Products per category
const PRODUCTS_PER_CATEGORY: usize = 10;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct BestBuyResponse {
    products: Vec<BestBuyProduct>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BestBuyProduct {
    sku: u64,
    name: String,
    sale_price: Option<f64>,
    regular_price: Option<f64>,
    customer_review_average: Option<f64>,
    customer_review_count: Option<u64>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct BestBuyMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl BestBuyMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("BESTBUY_API_KEY")
            .map_err(|_| anyhow::anyhow!("BESTBUY_API_KEY not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 240,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Best Buy Products source initialized");
        Ok(Self { http, api_key })
    }

    /// Build URL for fetching best-selling products in a category
    fn build_category_url(&self, category_id: &str) -> String {
        format!(
            "{}/products(categoryPath.id={})?apiKey={}&format=json&show=sku,name,salePrice,regularPrice,customerReviewAverage,customerReviewCount&pageSize={}&sort=bestSellingRank.asc",
            API_BASE, category_id, self.api_key, PRODUCTS_PER_CATEGORY
        )
    }

    /// Fetch products for a single category
    async fn fetch_category(&self, category_id: &str) -> Result<Vec<BestBuyProduct>, SourceError> {
        let url = self.build_category_url(category_id);
        let resp: BestBuyResponse = self.http.get_json(&url).await?;
        Ok(resp.products)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BestBuyMarketSource {
    fn source_id(&self) -> &'static str {
        "bestbuy"
    }

    fn display_name(&self) -> &'static str {
        "Best Buy Products"
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
                max_requests: 240,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let mut all_assets = Vec::new();

        for (cat_id, cat_label, cat_short) in CATEGORIES {
            match self.fetch_category(cat_id).await {
                Ok(products) => {
                    for product in &products {
                        // Only track products with active discount (price changes daily)
                        // Skip products where sale price == regular price (static MSRP)
                        let has_discount = match (product.sale_price, product.regular_price) {
                            (Some(sale), Some(reg)) => (reg - sale).abs() > 0.01,
                            _ => false,
                        };
                        if product.sale_price.is_some() && has_discount {
                            // Truncate name to 120 chars for readability
                            let mut display_name = product.name.clone();
                            if display_name.len() > 120 {
                                display_name.truncate(120);
                                display_name.push_str("...");
                            }

                            all_assets.push(AssetUpdate {
                                asset_id: format!("bestbuy_{}", product.sku),
                                symbol: format!("BB:{}", product.sku),
                                name: format!("{} [{}]", display_name, cat_label),
                                category: Some("sentiment".to_string()),
                                metadata: serde_json::json!({
                                    "api_ref": format!("sku:{}", product.sku),
                                    "subcategory": cat_short,
                                    "active": true,
                                    "extra": {
                                        "category": cat_label,
                                        "regular_price": product.regular_price,
                                        "review_avg": product.customer_review_average,
                                        "review_count": product.customer_review_count,
                                    },
                                }),
                            });
                        }
                    }
                    debug!("BGG {} category: {} products found", cat_label, products.len());
                }
                Err(e) => {
                    warn!("Best Buy category {} fetch failed: {:?}", cat_label, e);
                }
            }
        }

        info!("Best Buy fetch_assets: {} products discovered across {} categories",
            all_assets.len(), CATEGORIES.len());
        Ok(all_assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Build a set of requested SKUs for fast lookup
        let requested_skus: HashMap<String, &String> = asset_ids
            .iter()
            .filter_map(|aid| {
                aid.strip_prefix("bestbuy_").map(|sku| (sku.to_string(), aid))
            })
            .collect();

        let mut results = Vec::new();

        // Fetch each category and extract prices for requested SKUs
        for (cat_id, cat_label, _) in CATEGORIES {
            match self.fetch_category(cat_id).await {
                Ok(products) => {
                    for product in &products {
                        let sku_str = product.sku.to_string();
                        if let Some(asset_id) = requested_skus.get(&sku_str) {
                            if let Some(price) = product.sale_price {
                                // Convert f64 price to Decimal (safe for USD prices)
                                let value = Decimal::from_f64_retain(price)
                                    .unwrap_or(Decimal::ZERO);

                                results.push(PriceUpdate {
                                    asset_id: (*asset_id).clone(),
                                    symbol: format!("BB:{}", product.sku),
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
                }
                Err(e) => {
                    warn!("Best Buy {} price fetch failed: {:?}", cat_label, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from Best Buy",
            results.len(),
            asset_ids.len()
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

    #[test]
    fn test_category_count() {
        assert_eq!(CATEGORIES.len(), 7);
    }

    #[test]
    fn test_asset_id_format() {
        let sku: u64 = 6505727;
        let asset_id = format!("bestbuy_{}", sku);
        assert_eq!(asset_id, "bestbuy_6505727");
        assert!(asset_id.starts_with("bestbuy_"));
    }

    #[test]
    fn test_deserialize_response() {
        let json = r#"{
            "products": [
                {
                    "sku": 6505727,
                    "name": "Apple MacBook Pro 14\"",
                    "salePrice": 1599.99,
                    "regularPrice": 1999.99,
                    "customerReviewAverage": 4.7,
                    "customerReviewCount": 1234
                },
                {
                    "sku": 6505728,
                    "name": "Dell XPS 15",
                    "salePrice": 1299.99,
                    "regularPrice": 1399.99,
                    "customerReviewAverage": 4.5,
                    "customerReviewCount": 567
                }
            ]
        }"#;

        let resp: BestBuyResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.products.len(), 2);
        assert_eq!(resp.products[0].sku, 6505727);
        assert_eq!(resp.products[0].sale_price, Some(1599.99));
        assert_eq!(resp.products[0].customer_review_average, Some(4.7));
    }

    #[test]
    fn test_decimal_from_price() {
        use rust_decimal::prelude::FromPrimitive;
        let price = 1599.99_f64;
        let dec = Decimal::from_f64(price);
        assert!(dec.is_some());
    }
}
