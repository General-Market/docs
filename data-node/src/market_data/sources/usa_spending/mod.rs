//! USASpending.gov data source — US federal defense spending
//!
//! Tracks DoD contract awards, spending totals by sub-agency, and budget metrics.
//! Data updates daily on USASpending.gov. We poll hourly.
//!
//! API: https://api.usaspending.gov/api/v2/
//! Auth: None
//! Rate limit: 10 req/min (self-imposed, no documented limit)

pub mod client;

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow, SlidingWindowRateLimiter};
use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};

use client::{
    ApiRef, AwardCountResults, UsaSpendingClient, current_fiscal_year, dollars_to_billions,
    extract_award_count, month_to_date_range,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/usa_spending.json");

/// Sub-agencies we track (must match api_ref values in config)
const SUBAGENCIES: &[&str] = &[
    "Department of the Army",
    "Department of the Navy",
    "Department of the Air Force",
    "Defense Information Systems Agency",
    "Defense Logistics Agency",
];

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// USASpending.gov market data source.
///
/// Tracks US federal defense spending metrics from USASpending.gov.
/// Source ID is `"usa_spending"`.
pub struct UsaSpendingMarketSource {
    client: UsaSpendingClient,
}

impl UsaSpendingMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let limiter = SlidingWindowRateLimiter::new(rate_limit);
        let client = UsaSpendingClient::new(limiter);

        info!("USASpending.gov source initialized");
        Ok(Self { client })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for UsaSpendingMarketSource {
    fn source_id(&self) -> &'static str {
        "usa_spending"
    }

    fn display_name(&self) -> &'static str {
        "US Defense Spending"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600) // 1 hour
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "USASpending fetch_assets: {} assets loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let (start_date, end_date) = month_to_date_range();
        let fy = current_fiscal_year();

        // Parse api_refs to determine what data we need
        let assets = load_assets_from_json(ASSET_JSON)?;
        let api_ref_map: HashMap<String, String> = assets
            .iter()
            .filter_map(|a| {
                a.metadata
                    .get("api_ref")
                    .and_then(|v| v.as_str())
                    .map(|r| (a.asset_id.clone(), r.to_string()))
            })
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        // Determine which API calls we need
        let mut need_dod_awards = false;
        let mut need_budget = false;
        let mut need_top_contract = false;
        let mut need_subagencies: Vec<String> = Vec::new();

        for asset_id in asset_ids {
            if let Some(ref_str) = api_ref_map.get(asset_id) {
                match ApiRef::parse(ref_str) {
                    Some(ApiRef::AwardCount(_)) => need_dod_awards = true,
                    Some(ApiRef::Budget(_)) => need_budget = true,
                    Some(ApiRef::TopContract) => need_top_contract = true,
                    Some(ApiRef::SubagencyCount { ref agency, .. }) => {
                        if !need_subagencies.contains(agency) {
                            need_subagencies.push(agency.clone());
                        }
                    }
                    None => {
                        warn!("Unknown api_ref for asset {}: {}", asset_id, ref_str);
                    }
                }
            }
        }

        // 1. Fetch DoD award counts (if needed)
        let dod_awards = if need_dod_awards {
            match self.client.fetch_dod_award_counts(&start_date, &end_date).await {
                Ok(data) => {
                    debug!(
                        "DoD awards: contracts={}, grants={}, total={}",
                        data.contracts,
                        data.grants,
                        data.total()
                    );
                    Some(data)
                }
                Err(e) => {
                    warn!("Failed to fetch DoD award counts: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // 2. Fetch budget resources (if needed)
        let budget_data = if need_budget {
            match self.client.fetch_budget_resources().await {
                Ok(data) => {
                    // Find current fiscal year data
                    let fy_data = data
                        .agency_data_by_year
                        .iter()
                        .find(|d| d.fiscal_year == fy);
                    if let Some(d) = fy_data {
                        debug!(
                            "DoD budget FY{}: obligated=${:.1}B, outlayed=${:.1}B, resources=${:.1}B",
                            fy,
                            dollars_to_billions(d.agency_total_obligated),
                            dollars_to_billions(d.agency_total_outlayed),
                            dollars_to_billions(d.agency_budgetary_resources)
                        );
                    }
                    Some(data)
                }
                Err(e) => {
                    warn!("Failed to fetch DoD budget resources: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // 3. Fetch top contract (if needed)
        let top_contract_amount = if need_top_contract {
            match self.client.fetch_top_contract(&start_date, &end_date).await {
                Ok(amount) => {
                    debug!("Top contract amount: {:?}", amount);
                    amount
                }
                Err(e) => {
                    warn!("Failed to fetch top contract: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // 4. Fetch sub-agency award counts
        let mut subagency_awards: HashMap<String, AwardCountResults> = HashMap::new();
        for agency in &need_subagencies {
            match self
                .client
                .fetch_subagency_award_counts(agency, &start_date, &end_date)
                .await
            {
                Ok(data) => {
                    debug!(
                        "Sub-agency {}: contracts={}, total={}",
                        agency,
                        data.contracts,
                        data.total()
                    );
                    subagency_awards.insert(agency.clone(), data);
                }
                Err(e) => {
                    warn!("Failed to fetch sub-agency {} awards: {}", agency, e);
                }
            }
        }

        // Build price updates from collected data
        for asset_id in asset_ids {
            let ref_str = match api_ref_map.get(asset_id) {
                Some(r) => r,
                None => continue,
            };

            let parsed = match ApiRef::parse(ref_str) {
                Some(p) => p,
                None => continue,
            };

            let value: Option<Decimal> = match parsed {
                ApiRef::AwardCount(ref key) => dod_awards
                    .as_ref()
                    .map(|d| Decimal::from(extract_award_count(d, key))),

                ApiRef::TopContract => top_contract_amount
                    .map(|v| Decimal::from_f64_retain(v).unwrap_or(Decimal::ZERO)),

                ApiRef::Budget(ref key) => {
                    budget_data.as_ref().and_then(|data| {
                        let fy_data = data.agency_data_by_year.iter().find(|d| d.fiscal_year == fy)?;
                        let raw = match key.as_str() {
                            "obligated" => fy_data.agency_total_obligated,
                            "outlayed" => fy_data.agency_total_outlayed,
                            "resources" => fy_data.agency_budgetary_resources,
                            _ => return None,
                        };
                        Some(
                            Decimal::from_f64_retain(dollars_to_billions(raw))
                                .unwrap_or(Decimal::ZERO),
                        )
                    })
                }

                ApiRef::SubagencyCount {
                    ref agency,
                    ref award_type,
                } => subagency_awards
                    .get(agency)
                    .map(|d| Decimal::from(extract_award_count(d, award_type))),
            };

            if let Some(val) = value {
                // Look up symbol from assets
                let symbol = assets
                    .iter()
                    .find(|a| a.asset_id == *asset_id)
                    .map(|a| a.symbol.clone())
                    .unwrap_or_else(|| format!("GOV/{}", asset_id.to_uppercase()));

                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol,
                    value: val,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} prices from USASpending.gov (MTD: {} to {})",
            results.len(),
            asset_ids.len(),
            start_date,
            end_date,
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
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            12,
            "Expected 12 usa_spending entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            12,
            "Expected 12 active assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Entry {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_government_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "government",
                "Entry {} should have government category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "defense",
                "Entry {} should have defense subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("usgov_"),
                "Asset ID {} should start with 'usgov_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_all_api_refs_parseable() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parsed = ApiRef::parse(&entry.api_ref);
            assert!(
                parsed.is_some(),
                "api_ref '{}' for asset {} should be parseable",
                entry.api_ref,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_known_assets_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"usgov_dod_contracts_mtd"));
        assert!(ids.contains(&"usgov_dod_top_contract_value"));
        assert!(ids.contains(&"usgov_dod_obligated_fy"));
        assert!(ids.contains(&"usgov_army_contracts_mtd"));
        assert!(ids.contains(&"usgov_navy_contracts_mtd"));
        assert!(ids.contains(&"usgov_airforce_contracts_mtd"));
    }

    #[test]
    fn test_subagency_api_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subagency_entries: Vec<_> = entries
            .iter()
            .filter(|e| e.api_ref.starts_with("subagency_count:"))
            .collect();
        assert_eq!(subagency_entries.len(), 5, "Expected 5 sub-agency entries");

        for entry in &subagency_entries {
            let parsed = ApiRef::parse(&entry.api_ref).unwrap();
            match parsed {
                ApiRef::SubagencyCount { ref agency, ref award_type } => {
                    assert_eq!(award_type, "contracts");
                    assert!(
                        SUBAGENCIES.contains(&agency.as_str()),
                        "Agency '{}' should be in SUBAGENCIES list",
                        agency
                    );
                }
                _ => panic!("Expected SubagencyCount variant"),
            }
        }
    }
}
