//! Integration tests for BitgetReadOnlyClient
//!
//! Uses wiremock to mock HTTP responses from Bitget API.

use std::time::Duration;
use wiremock::matchers::{header, header_exists, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

use common::error::Error;
use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use common::traits::BitgetReadOnlyClient;

fn test_config(base_url: &str) -> BitgetReadOnlyConfig {
    BitgetReadOnlyConfig {
        api_key: "test_api_key".into(),
        api_secret: "test_secret".into(),
        passphrase: "test_passphrase".into(),
        base_url: base_url.into(),
        timeout: Duration::from_secs(5),
    }
}

#[tokio::test]
async fn test_get_order_success() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "00000",
        "msg": "success",
        "data": {
            "orderId": "123456789",
            "clientOid": "my-order-1",
            "symbol": "BTCUSDT",
            "side": "buy",
            "orderType": "limit",
            "price": "50000.00",
            "size": "0.1",
            "status": "full_fill",
            "baseVolume": "0.1",
            "priceAvg": "49999.50",
            "cTime": "1706540000000",
            "uTime": "1706540100000"
        }
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .and(query_param("orderId", "123456789"))
        .and(header("ACCESS-KEY", "test_api_key"))
        .and(header("ACCESS-PASSPHRASE", "test_passphrase"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let order = client.get_order("123456789").await.unwrap();

    assert_eq!(order.order_id, "123456789");
    assert_eq!(order.client_order_id, Some("my-order-1".into()));
    assert_eq!(order.symbol, "BTCUSDT");
    assert_eq!(order.side, "buy");
    assert_eq!(order.order_type, "limit");
    assert_eq!(order.price, "50000.00");
    assert_eq!(order.quantity, "0.1");
    assert_eq!(order.status, "full_fill");
    assert_eq!(order.filled_quantity, "0.1");
    assert_eq!(order.avg_fill_price, "49999.50");
    assert_eq!(order.create_time, 1706540000000);
    assert_eq!(order.update_time, 1706540100000);
}

#[tokio::test]
async fn test_get_fills_success() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "00000",
        "msg": "success",
        "data": {
            "fillList": [
                {
                    "tradeId": "trade_1",
                    "orderId": "123456789",
                    "symbol": "BTCUSDT",
                    "price": "49999.50",
                    "size": "0.05",
                    "fee": "0.025",
                    "feeCcy": "USDT",
                    "cTime": "1706540050000"
                },
                {
                    "tradeId": "trade_2",
                    "orderId": "123456789",
                    "symbol": "BTCUSDT",
                    "price": "49999.00",
                    "size": "0.05",
                    "fee": "0.025",
                    "feeCcy": "USDT",
                    "cTime": "1706540075000"
                }
            ]
        }
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/fills"))
        .and(query_param("symbol", "BTCUSDT"))
        .and(query_param("orderId", "123456789"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let fills = client.get_fills("BTCUSDT", "123456789").await.unwrap();

    assert_eq!(fills.len(), 2);

    assert_eq!(fills[0].trade_id, "trade_1");
    assert_eq!(fills[0].order_id, "123456789");
    assert_eq!(fills[0].symbol, "BTCUSDT");
    assert_eq!(fills[0].price, "49999.50");
    assert_eq!(fills[0].quantity, "0.05");
    assert_eq!(fills[0].fee, "0.025");
    assert_eq!(fills[0].fee_currency, "USDT");
    assert_eq!(fills[0].trade_time, 1706540050000);

    assert_eq!(fills[1].trade_id, "trade_2");
    assert_eq!(fills[1].price, "49999.00");
}

#[tokio::test]
async fn test_get_order_history_success() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "00000",
        "msg": "success",
        "data": {
            "orderList": [
                {
                    "orderId": "order_1",
                    "clientOid": null,
                    "symbol": "BTCUSDT",
                    "side": "buy",
                    "orderType": "limit",
                    "price": "50000.00",
                    "size": "0.1",
                    "status": "full_fill",
                    "baseVolume": "0.1",
                    "priceAvg": "50000.00",
                    "cTime": "1706540000000",
                    "uTime": "1706540100000"
                },
                {
                    "orderId": "order_2",
                    "clientOid": null,
                    "symbol": "BTCUSDT",
                    "side": "sell",
                    "orderType": "market",
                    "price": "0",
                    "size": "0.05",
                    "status": "full_fill",
                    "baseVolume": "0.05",
                    "priceAvg": "51000.00",
                    "cTime": "1706541000000",
                    "uTime": "1706541050000"
                }
            ]
        }
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/history-orders"))
        .and(query_param("symbol", "BTCUSDT"))
        .and(query_param("startTime", "1706540000000"))
        .and(query_param("limit", "100"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let orders = client
        .get_order_history("BTCUSDT", 1706540000000, None)
        .await
        .unwrap();

    assert_eq!(orders.len(), 2);
    assert_eq!(orders[0].order_id, "order_1");
    assert_eq!(orders[0].side, "buy");
    assert_eq!(orders[1].order_id, "order_2");
    assert_eq!(orders[1].side, "sell");
}

#[tokio::test]
async fn test_get_ticker_success() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "00000",
        "msg": "success",
        "data": [
            {
                "symbol": "BTCUSDT",
                "bidPr": "50000.00",
                "askPr": "50001.00",
                "lastPr": "50000.50",
                "ts": "1706540000000"
            }
        ]
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .and(query_param("symbol", "BTCUSDT"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let ticker = client.get_ticker("BTCUSDT").await.unwrap();

    assert_eq!(ticker.symbol, "BTCUSDT");
    assert_eq!(ticker.best_bid, "50000.00");
    assert_eq!(ticker.best_ask, "50001.00");
    assert_eq!(ticker.last_price, "50000.50");
    assert_eq!(ticker.timestamp, 1706540000000);
}

#[tokio::test]
async fn test_authentication_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .respond_with(ResponseTemplate::new(401))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let result = client.get_order("123").await;

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, Error::Authentication(msg) if msg.contains("Invalid")));
}

#[tokio::test]
async fn test_rate_limit_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .respond_with(ResponseTemplate::new(429))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let result = client.get_order("123").await;

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, Error::RateLimit(msg) if msg.contains("rate limit")));
}

#[tokio::test]
async fn test_server_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let result = client.get_order("123").await;

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, Error::ExternalService(msg) if msg.contains("500")));
}

#[tokio::test]
async fn test_api_error_response() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "40001",
        "msg": "Order not found",
        "data": null
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let result = client.get_order("nonexistent").await;

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, Error::ExternalService(msg) if msg.contains("40001")));
}

#[tokio::test]
async fn test_ticker_not_found() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "00000",
        "msg": "success",
        "data": []
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/market/tickers"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let result = client.get_ticker("INVALIDPAIR").await;

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(matches!(err, Error::NotFound(_)));
}

#[tokio::test]
async fn test_rate_limit_backoff_and_recovery() {
    let mock_server = MockServer::start().await;

    // First request returns 429, second returns success
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .respond_with(ResponseTemplate::new(429))
        .up_to_n_times(1)
        .mount(&mock_server)
        .await;

    let success_response = r#"{
        "code": "00000",
        "msg": "success",
        "data": {
            "orderId": "123",
            "clientOid": null,
            "symbol": "BTCUSDT",
            "side": "buy",
            "orderType": "limit",
            "price": "50000.00",
            "size": "0.1",
            "status": "new",
            "baseVolume": "0",
            "priceAvg": "0",
            "cTime": "1706540000000",
            "uTime": "1706540000000"
        }
    }"#;

    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .respond_with(ResponseTemplate::new(200).set_body_string(success_response))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    // First call should fail with rate limit
    let result1 = client.get_order("123").await;
    assert!(result1.is_err());

    // Second call should succeed (after backoff applied internally)
    let result2 = client.get_order("123").await;
    assert!(result2.is_ok());
    assert_eq!(result2.unwrap().order_id, "123");
}

#[tokio::test]
async fn test_request_headers_are_set() {
    let mock_server = MockServer::start().await;

    let response_body = r#"{
        "code": "00000",
        "msg": "success",
        "data": {
            "orderId": "123",
            "clientOid": null,
            "symbol": "BTCUSDT",
            "side": "buy",
            "orderType": "limit",
            "price": "50000.00",
            "size": "0.1",
            "status": "new",
            "baseVolume": "0",
            "priceAvg": "0",
            "cTime": "1706540000000",
            "uTime": "1706540000000"
        }
    }"#;

    // Verify all required headers are present
    Mock::given(method("GET"))
        .and(path("/api/v2/spot/trade/orderInfo"))
        .and(header("ACCESS-KEY", "test_api_key"))
        .and(header("ACCESS-PASSPHRASE", "test_passphrase"))
        .and(header("Content-Type", "application/json"))
        .and(header_exists("ACCESS-SIGN"))
        .and(header_exists("ACCESS-TIMESTAMP"))
        .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = BitgetReadOnlyClientImpl::new(config).unwrap();

    let result = client.get_order("123").await;
    assert!(result.is_ok());
}
