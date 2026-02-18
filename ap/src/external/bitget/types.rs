//! Bitget API request and response types
//!
//! These types match the Bitget Spot API v1 specification for order placement.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Order side (buy or sell)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderSide {
    /// Buy order
    Buy,
    /// Sell order
    Sell,
}

impl OrderSide {
    /// Convert to Bitget API string format
    pub fn as_bitget_str(&self) -> &'static str {
        match self {
            OrderSide::Buy => "buy",
            OrderSide::Sell => "sell",
        }
    }
}

impl std::fmt::Display for OrderSide {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_bitget_str())
    }
}

/// Order type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderType {
    /// Limit order with specified price
    Limit,
    /// Market order executed at best available price
    Market,
}

impl OrderType {
    /// Convert to Bitget API string format
    pub fn as_bitget_str(&self) -> &'static str {
        match self {
            OrderType::Limit => "limit",
            OrderType::Market => "market",
        }
    }
}

/// Time in force for orders
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeInForce {
    /// Good till cancelled
    Gtc,
    /// Fill or kill - must fill entirely or cancel
    Fok,
    /// Immediate or cancel - fill what's possible, cancel rest
    Ioc,
}

impl TimeInForce {
    /// Convert to Bitget API string format
    pub fn as_bitget_str(&self) -> &'static str {
        match self {
            TimeInForce::Gtc => "gtc",
            TimeInForce::Fok => "fok",
            TimeInForce::Ioc => "ioc",
        }
    }
}

/// Request body for placing a spot order
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceOrderRequest {
    /// Trading pair symbol (e.g., "BTCUSDC")
    pub symbol: String,
    /// Order side
    pub side: String,
    /// Order type
    pub order_type: String,
    /// Order price (required for limit orders)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
    /// Order size/quantity
    pub size: String,
    /// Time in force
    pub force: String,
    /// Client order ID (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_oid: Option<String>,
}

impl PlaceOrderRequest {
    /// Create a new limit order request
    pub fn limit_order(
        symbol: impl Into<String>,
        side: OrderSide,
        price: Decimal,
        size: Decimal,
    ) -> Self {
        Self {
            symbol: symbol.into(),
            side: side.as_bitget_str().to_string(),
            order_type: OrderType::Limit.as_bitget_str().to_string(),
            price: Some(price.to_string()),
            size: size.to_string(),
            force: TimeInForce::Gtc.as_bitget_str().to_string(),
            client_oid: None,
        }
    }

    /// Set client order ID
    pub fn with_client_oid(mut self, client_oid: impl Into<String>) -> Self {
        self.client_oid = Some(client_oid.into());
        self
    }

    /// Set time in force
    pub fn with_time_in_force(mut self, tif: TimeInForce) -> Self {
        self.force = tif.as_bitget_str().to_string();
        self
    }
}

/// Generic Bitget API response wrapper
#[derive(Debug, Clone, Deserialize)]
pub struct BitgetResponse<T> {
    /// Response code ("00000" indicates success)
    pub code: String,
    /// Response message
    pub msg: String,
    /// Response data (present on success)
    pub data: Option<T>,
}

impl<T> BitgetResponse<T> {
    /// Check if the response indicates success
    pub fn is_success(&self) -> bool {
        self.code == "00000"
    }
}

/// Response data for a placed order
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceOrderData {
    /// Bitget order ID
    pub order_id: String,
    /// Client order ID (if provided in request)
    #[serde(default)]
    pub client_order_id: Option<String>,
}

/// Full response type for place order endpoint
pub type PlaceOrderResponse = BitgetResponse<PlaceOrderData>;

/// Response data for order detail query
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderDetailData {
    /// Bitget order ID
    pub order_id: String,
    /// Order status string (e.g., "new", "partial_fill", "full_fill", "cancelled")
    pub status: String,
    /// Filled quantity
    #[serde(default)]
    pub fill_quantity: Option<String>,
    /// Filled amount (notional)
    #[serde(default)]
    pub fill_total_amount: Option<String>,
    /// Average fill price
    #[serde(default)]
    pub avg_price: Option<String>,
}

/// Full response type for order detail endpoint
pub type OrderDetailResponse = BitgetResponse<OrderDetailData>;

/// A single fill/trade record from Bitget
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillData {
    /// Trade ID
    pub trade_id: String,
    /// Order ID
    pub order_id: String,
    /// Filled price
    pub price: String,
    /// Filled quantity
    pub quantity: String,
    /// Trade side
    pub side: String,
}

/// Full response type for fills query endpoint
pub type FillsResponse = BitgetResponse<Vec<FillData>>;

/// Trading pair representation
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TradingPair {
    /// Base asset (e.g., "BTC")
    pub base: String,
    /// Quote asset (e.g., "USDC")
    pub quote: String,
}

impl TradingPair {
    /// Create a new trading pair
    pub fn new(base: impl Into<String>, quote: impl Into<String>) -> Self {
        Self {
            base: base.into(),
            quote: quote.into(),
        }
    }

    /// Parse from internal format (e.g., "BTC/USDC")
    pub fn from_internal(pair: &str) -> Option<Self> {
        let parts: Vec<&str> = pair.split('/').collect();
        if parts.len() == 2 {
            Some(Self::new(parts[0], parts[1]))
        } else {
            None
        }
    }

    /// Convert to Bitget symbol format (e.g., "BTCUSDC")
    pub fn to_bitget_symbol(&self) -> String {
        format!("{}{}", self.base.to_uppercase(), self.quote.to_uppercase())
    }

    /// Convert to internal format (e.g., "BTC/USDC")
    pub fn to_internal(&self) -> String {
        format!("{}/{}", self.base.to_uppercase(), self.quote.to_uppercase())
    }
}

impl std::fmt::Display for TradingPair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_internal())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_order_side_to_string() {
        assert_eq!(OrderSide::Buy.as_bitget_str(), "buy");
        assert_eq!(OrderSide::Sell.as_bitget_str(), "sell");
    }

    #[test]
    fn test_trading_pair_conversion() {
        let pair = TradingPair::new("BTC", "USDC");
        assert_eq!(pair.to_bitget_symbol(), "BTCUSDC");
        assert_eq!(pair.to_internal(), "BTC/USDC");
    }

    #[test]
    fn test_trading_pair_from_internal() {
        let pair = TradingPair::from_internal("BTC/USDC").unwrap();
        assert_eq!(pair.base, "BTC");
        assert_eq!(pair.quote, "USDC");

        assert!(TradingPair::from_internal("INVALID").is_none());
    }

    #[test]
    fn test_place_order_request_serialization() {
        let req = PlaceOrderRequest::limit_order(
            "BTCUSDC",
            OrderSide::Buy,
            Decimal::new(42000, 0),
            Decimal::new(1, 3), // 0.001
        );

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"symbol\":\"BTCUSDC\""));
        assert!(json.contains("\"side\":\"buy\""));
        assert!(json.contains("\"orderType\":\"limit\""));
        assert!(json.contains("\"price\":\"42000\""));
        assert!(json.contains("\"size\":\"0.001\""));
        assert!(json.contains("\"force\":\"gtc\""));
    }

    #[test]
    fn test_place_order_response_parsing() {
        let json = r#"{
            "code": "00000",
            "msg": "success",
            "data": {
                "orderId": "1234567890",
                "clientOrderId": "my-order-1"
            }
        }"#;

        let resp: PlaceOrderResponse = serde_json::from_str(json).unwrap();
        assert!(resp.is_success());
        assert_eq!(resp.data.unwrap().order_id, "1234567890");
    }
}
