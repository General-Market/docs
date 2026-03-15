use async_trait::async_trait;
use ethers::types::{Address, U256};
use tracing::info;

use super::nav::{NavCalculator, NavCalculatorError};
use crate::price::PriceFetchError;

pub struct BackendNavCalculator {
    http: reqwest::Client,
    base_url: String,
    itp_id: String,
}

impl BackendNavCalculator {
    pub fn new(base_url: String, itp_id: String) -> Self {
        info!(base_url = %base_url, itp_id = %itp_id, "BackendNavCalculator initialized");
        Self {
            http: reqwest::Client::new(),
            base_url,
            itp_id,
        }
    }
}

#[derive(serde::Deserialize)]
struct ItpPriceResponse {
    nav: String,
}

#[async_trait]
impl NavCalculator for BackendNavCalculator {
    async fn calculate_nav(
        &self,
        inventory: &[(Address, U256)],
    ) -> Result<U256, NavCalculatorError> {
        if inventory.is_empty() {
            return Err(NavCalculatorError::EmptyComposition);
        }

        let url = format!("{}/itp-price?itp_id={}", self.base_url, self.itp_id);
        let resp: ItpPriceResponse = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| PriceFetchError::FetchFailed {
                asset: Address::zero(),
                reason: format!("data-node request failed: {}", e),
            })?
            .json()
            .await
            .map_err(|e| PriceFetchError::FetchFailed {
                asset: Address::zero(),
                reason: format!("data-node response parse failed: {}", e),
            })?;

        U256::from_dec_str(&resp.nav).map_err(|_| {
            NavCalculatorError::PriceFetchFailed(PriceFetchError::FetchFailed {
                asset: Address::zero(),
                reason: format!("Invalid NAV value from backend: '{}'", resp.nav),
            })
        })
    }
}
