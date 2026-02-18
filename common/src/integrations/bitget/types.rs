//! Bitget API response types
//!
//! Types for deserializing Bitget API responses.

use serde::Deserialize;

/// Bitget API response wrapper
#[derive(Debug, Deserialize)]
pub struct BitgetResponse<T> {
    pub code: String,
    pub msg: Option<String>,
    pub data: Option<T>,
}

impl<T> BitgetResponse<T> {
    /// Check if response indicates success
    pub fn is_success(&self) -> bool {
        self.code == "00000"
    }
}

/// Order info response from Bitget API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetOrderInfoResponse {
    pub order_id: String,
    pub client_oid: Option<String>,
    pub symbol: String,
    pub side: String,
    pub order_type: String,
    pub price: String,
    pub size: String,
    pub status: String,
    pub base_volume: String,
    pub price_avg: String,
    pub c_time: String,
    pub u_time: String,
}

/// Fill response from Bitget API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetFillResponse {
    pub trade_id: String,
    pub order_id: String,
    pub symbol: String,
    pub price: String,
    pub size: String,
    pub fee: String,
    pub fee_ccy: String,
    pub c_time: String,
}

/// Fills list response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetFillsData {
    pub fill_list: Vec<BitgetFillResponse>,
}

/// Order list response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetOrderListData {
    pub order_list: Vec<BitgetOrderInfoResponse>,
}

/// Ticker response from Bitget API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetTickerResponse {
    pub symbol: String,
    pub bid_pr: String,
    pub ask_pr: String,
    pub last_pr: String,
    pub ts: String,
    #[serde(default, deserialize_with = "deserialize_nullable_string")]
    pub bid_sz: String,
    #[serde(default, deserialize_with = "deserialize_nullable_string")]
    pub ask_sz: String,
    #[serde(default, deserialize_with = "deserialize_nullable_string")]
    pub usdt_volume: String,
}

fn deserialize_nullable_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt: Option<String> = Option::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

/// Orderbook response from Bitget API
#[derive(Debug, Deserialize)]
pub struct BitgetOrderbookResponse {
    pub asks: Vec<[String; 2]>,
    pub bids: Vec<[String; 2]>,
    pub ts: String,
}
