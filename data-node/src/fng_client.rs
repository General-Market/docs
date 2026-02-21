//! Fear & Greed Index API client (alternative.me).

use chrono::NaiveDate;
use serde::Deserialize;
use tracing::debug;

const FNG_URL: &str = "https://api.alternative.me/fng/";

#[derive(Debug, Clone)]
pub struct FngEntry {
    pub date: NaiveDate,
    pub value: i32,
    pub classification: String,
}

#[derive(Deserialize)]
struct FngApiResponse {
    data: Vec<FngApiEntry>,
}

#[derive(Deserialize)]
struct FngApiEntry {
    value: String,
    value_classification: String,
    timestamp: String,
}

/// Fetch all historical FNG data (limit=0 returns everything).
pub async fn fetch_all() -> Result<Vec<FngEntry>, FngError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(FngError::Http)?;

    debug!("Fetching FNG history (limit=0)");
    let resp: FngApiResponse = client
        .get(FNG_URL)
        .query(&[("limit", "0"), ("format", "json")])
        .send()
        .await
        .map_err(FngError::Http)?
        .json()
        .await
        .map_err(FngError::Http)?;

    let mut entries = Vec::with_capacity(resp.data.len());
    for item in resp.data {
        let ts: i64 = match item.timestamp.parse() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let date = match chrono::DateTime::from_timestamp(ts, 0) {
            Some(dt) => dt.date_naive(),
            None => continue,
        };
        let value: i32 = match item.value.parse() {
            Ok(v) => v,
            Err(_) => continue,
        };
        entries.push(FngEntry {
            date,
            value,
            classification: item.value_classification,
        });
    }

    debug!(count = entries.len(), "Parsed FNG entries");
    Ok(entries)
}

#[derive(Debug)]
pub enum FngError {
    Http(reqwest::Error),
}

impl std::fmt::Display for FngError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FngError::Http(e) => write!(f, "FNG HTTP error: {e}"),
        }
    }
}

impl std::error::Error for FngError {}
