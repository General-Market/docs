//! Data-node HTTP client.
//!
//! Contract: `GET {base}/v1/sources/{source_id}/price` returns
//! `{ "price": <u128 as string or number>, "ts": <i64> }`. Prices arrive pre-
//! normalized to 1e18 decimals (SA9, MR4).
//!
//! u128 crosses JSON as either a numeric literal or a decimal string — the
//! serde layer accepts both so a data-node that switches representations
//! mid-operation doesn't strand the daemon.

use anyhow::{Context, Result};
use serde::{Deserialize, Deserializer};
use std::time::Duration;

#[derive(Clone, Debug, Deserialize)]
pub struct PriceResponse {
    #[serde(deserialize_with = "de_u128")]
    pub price: u128,
    pub ts: i64,
}

fn de_u128<'de, D: Deserializer<'de>>(d: D) -> std::result::Result<u128, D::Error> {
    use serde::de::Error;
    use serde_json::Value;
    // serde_json's default Number cannot hold u128 without the
    // `arbitrary_precision` feature, so we descend through Value and branch
    // on the concrete shape. Accepts unsigned integers up to u64 natively and
    // arbitrary-precision integers or decimal strings as JSON strings.
    match Value::deserialize(d)? {
        Value::Number(n) => {
            if let Some(u) = n.as_u64() {
                Ok(u as u128)
            } else {
                // JSON number too large for u64 — require string form.
                Err(D::Error::custom(
                    "numeric price exceeds u64; send as string for full u128 range",
                ))
            }
        }
        Value::String(s) => s.parse::<u128>().map_err(D::Error::custom),
        other => Err(D::Error::custom(format!(
            "price must be a number or decimal string, got {other:?}"
        ))),
    }
}

#[derive(Clone)]
pub struct Feed {
    base: String,
    client: reqwest::Client,
}

impl Feed {
    pub fn new(base: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .expect("reqwest client build");
        Self { base, client }
    }

    pub async fn price(&self, source_id: u32) -> Result<PriceResponse> {
        let url = format!("{}/v1/sources/{}/price", self.base, source_id);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {url}"))?
            .error_for_status()
            .with_context(|| format!("HTTP error from {url}"))?;
        let body: PriceResponse = resp
            .json()
            .await
            .with_context(|| format!("JSON decode from {url}"))?;
        Ok(body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_numeric_price() {
        let j = r#"{"price": 1000000000000000000, "ts": 1700000000}"#;
        let p: PriceResponse = serde_json::from_str(j).unwrap();
        assert_eq!(p.price, 1_000_000_000_000_000_000u128);
        assert_eq!(p.ts, 1_700_000_000);
    }

    #[test]
    fn deserializes_string_price() {
        let j = r#"{"price": "340282366920938463463374607431768211455", "ts": 1}"#;
        let p: PriceResponse = serde_json::from_str(j).unwrap();
        assert_eq!(p.price, u128::MAX);
    }
}
