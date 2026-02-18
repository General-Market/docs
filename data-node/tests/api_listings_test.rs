//! API endpoint tests for listings.
//!
//! These tests require a running PostgreSQL database.
//! Run with: DATABASE_URL=... cargo test -p data-node -- --ignored

use reqwest::StatusCode;

/// These tests are ignored by default because they require DATABASE_URL.
/// They validate the API endpoints against a real database.

#[tokio::test]
#[ignore = "requires DATABASE_URL"]
async fn test_listings_unsafe_endpoint() {
    let base = std::env::var("DATA_NODE_URL").unwrap_or_else(|_| "http://localhost:8200".into());
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{}/listings/unsafe", base))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body: Vec<serde_json::Value> = resp.json().await.unwrap();
    // All returned rows should have unsafe status
    for row in &body {
        let status = row["status"].as_str().unwrap();
        assert!(
            status == "halt" || status == "offline" || status == "delisted_gone",
            "Unexpected status: {}",
            status
        );
    }
}

#[tokio::test]
#[ignore = "requires DATABASE_URL"]
async fn test_listings_filter_by_status() {
    let base = std::env::var("DATA_NODE_URL").unwrap_or_else(|_| "http://localhost:8200".into());
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{}/listings?status=online", base))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body: Vec<serde_json::Value> = resp.json().await.unwrap();
    for row in &body {
        assert_eq!(row["status"].as_str().unwrap(), "online");
    }
}

#[tokio::test]
#[ignore = "requires DATABASE_URL"]
async fn test_listing_single_lookup() {
    let base = std::env::var("DATA_NODE_URL").unwrap_or_else(|_| "http://localhost:8200".into());
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{}/listing?symbol=BTCUSDT", base))
        .send()
        .await
        .unwrap();

    // May be 200 or 404 depending on DB state
    assert!(resp.status() == StatusCode::OK || resp.status() == StatusCode::NOT_FOUND);
}

#[tokio::test]
#[ignore = "requires DATABASE_URL"]
async fn test_listing_not_found() {
    let base = std::env::var("DATA_NODE_URL").unwrap_or_else(|_| "http://localhost:8200".into());
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{}/listing?symbol=DOESNOTEXIST", base))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}
