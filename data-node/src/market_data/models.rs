//! Unified market data models
//!
//! Database and API response types for the market_assets / market_prices tables.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Row from `market_assets` table
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketAsset {
    pub asset_id: String,
    pub source: String,
    pub symbol: String,
    pub name: String,
    pub category: Option<String>,
    pub is_active: bool,
    pub metadata: serde_json::Value,
    pub updated_at: DateTime<Utc>,
}

/// Summary of a single asset's current value (API response)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketPriceSummary {
    pub asset_id: String,
    pub source: String,
    pub symbol: String,
    pub name: String,
    pub category: Option<String>,
    pub value: Decimal,
    pub prev_close: Option<Decimal>,
    pub change_pct: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub fetched_at: DateTime<Utc>,
    /// Logo image URL from metadata (CoinGecko, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

/// Historical value record from `market_prices` table
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketPriceRecord {
    pub id: i64,
    pub asset_id: String,
    pub source: String,
    pub symbol: String,
    pub value: Decimal,
    pub prev_close: Option<Decimal>,
    pub change_pct: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub fetched_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Sync statistics for a source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketSyncStats {
    pub source: String,
    pub asset_count: i64,
    pub price_record_count: i64,
    pub last_sync: Option<DateTime<Utc>>,
    pub oldest_price: Option<DateTime<Utc>>,
    pub newest_price: Option<DateTime<Utc>>,
}
