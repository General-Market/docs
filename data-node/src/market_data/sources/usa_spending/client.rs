//! USASpending.gov API client
//!
//! HTTP client wrapper for the USASpending.gov API.
//! All endpoints are under `https://api.usaspending.gov/api/v2/`.
//! No authentication required. Rate limit: 10 req/min (self-imposed).

use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tracing::{debug, warn};

use crate::market_data::rate_limiter::SlidingWindowRateLimiter;

/// Base URL for USASpending.gov API
const BASE_URL: &str = "https://api.usaspending.gov/api/v2";

/// DoD agency code for budgetary resources endpoint
const DOD_AGENCY_CODE: &str = "097";

// ============================================================================
// REQUEST / RESPONSE TYPES
// ============================================================================

/// Filter for spending_by_award_count and spending_by_award
#[derive(Debug, Serialize)]
pub struct SpendingFilters {
    pub agencies: Vec<AgencyFilter>,
    pub time_period: Vec<TimePeriod>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub award_type_codes: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct AgencyFilter {
    #[serde(rename = "type")]
    pub filter_type: String,
    pub tier: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct TimePeriod {
    pub start_date: String,
    pub end_date: String,
}

/// Request body for spending_by_award_count
#[derive(Debug, Serialize)]
pub struct AwardCountRequest {
    pub filters: SpendingFilters,
}

/// Response from spending_by_award_count
#[derive(Debug, Deserialize)]
pub struct AwardCountResponse {
    pub results: AwardCountResults,
}

#[derive(Debug, Deserialize)]
pub struct AwardCountResults {
    #[serde(default)]
    pub contracts: u64,
    #[serde(default)]
    pub grants: u64,
    #[serde(default)]
    pub idvs: u64,
    #[serde(default)]
    pub loans: u64,
    #[serde(default)]
    pub direct_payments: u64,
    #[serde(default)]
    pub other: u64,
}

impl AwardCountResults {
    /// Sum of all award types
    pub fn total(&self) -> u64 {
        self.contracts + self.grants + self.idvs + self.loans + self.direct_payments + self.other
    }
}

/// Request body for spending_by_award (top contracts)
#[derive(Debug, Serialize)]
pub struct SpendingByAwardRequest {
    pub filters: SpendingFilters,
    pub fields: Vec<String>,
    pub limit: u32,
    pub page: u32,
    pub sort: String,
    pub order: String,
    pub subawards: bool,
}

/// Response from spending_by_award
#[derive(Debug, Deserialize)]
pub struct SpendingByAwardResponse {
    pub results: Vec<SpendingByAwardResult>,
}

#[derive(Debug, Deserialize)]
pub struct SpendingByAwardResult {
    #[serde(rename = "Award Amount")]
    pub award_amount: Option<f64>,
}

/// Response from budgetary_resources endpoint
#[derive(Debug, Deserialize)]
pub struct BudgetaryResourcesResponse {
    #[serde(default)]
    pub agency_data_by_year: Vec<BudgetYearData>,
}

#[derive(Debug, Deserialize)]
pub struct BudgetYearData {
    pub fiscal_year: u32,
    #[serde(default)]
    pub agency_total_obligated: f64,
    #[serde(default)]
    pub agency_budgetary_resources: f64,
    #[serde(default)]
    pub agency_total_outlayed: f64,
}

// ============================================================================
// CLIENT
// ============================================================================

/// USASpending.gov API client with rate limiting
pub struct UsaSpendingClient {
    client: Client,
    rate_limiter: SlidingWindowRateLimiter,
}

impl UsaSpendingClient {
    /// Create a new client with a rate limiter
    pub fn new(rate_limiter: SlidingWindowRateLimiter) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            rate_limiter,
        }
    }

    /// Fetch award counts for DoD (toptier) for the given month-to-date period
    pub async fn fetch_dod_award_counts(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<AwardCountResults> {
        let url = format!("{}/search/spending_by_award_count/", BASE_URL);
        let body = AwardCountRequest {
            filters: SpendingFilters {
                agencies: vec![AgencyFilter {
                    filter_type: "awarding".to_string(),
                    tier: "toptier".to_string(),
                    name: "Department of Defense".to_string(),
                }],
                time_period: vec![TimePeriod {
                    start_date: start_date.to_string(),
                    end_date: end_date.to_string(),
                }],
                award_type_codes: None,
            },
        };

        self.post_json::<AwardCountRequest, AwardCountResponse>(&url, &body)
            .await
            .map(|r| r.results)
    }

    /// Fetch award counts for a DoD sub-agency (subtier)
    pub async fn fetch_subagency_award_counts(
        &self,
        subagency_name: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<AwardCountResults> {
        let url = format!("{}/search/spending_by_award_count/", BASE_URL);
        let body = AwardCountRequest {
            filters: SpendingFilters {
                agencies: vec![AgencyFilter {
                    filter_type: "awarding".to_string(),
                    tier: "subtier".to_string(),
                    name: subagency_name.to_string(),
                }],
                time_period: vec![TimePeriod {
                    start_date: start_date.to_string(),
                    end_date: end_date.to_string(),
                }],
                award_type_codes: None,
            },
        };

        self.post_json::<AwardCountRequest, AwardCountResponse>(&url, &body)
            .await
            .map(|r| r.results)
    }

    /// Fetch budgetary resources for DoD (GET endpoint)
    pub async fn fetch_budget_resources(&self) -> Result<BudgetaryResourcesResponse> {
        let url = format!("{}/agency/{}/budgetary_resources/", BASE_URL, DOD_AGENCY_CODE);

        self.rate_limiter.wait_for_permit().await;
        debug!("GET {}", url);

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Budget resources request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Budget resources HTTP {}: {}", status, body);
        }

        let data: BudgetaryResourcesResponse = resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Budget resources JSON parse error: {}", e))?;

        Ok(data)
    }

    /// Fetch the top contract by award amount for DoD this month
    pub async fn fetch_top_contract(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Option<f64>> {
        let url = format!("{}/search/spending_by_award/", BASE_URL);
        let body = SpendingByAwardRequest {
            filters: SpendingFilters {
                agencies: vec![AgencyFilter {
                    filter_type: "awarding".to_string(),
                    tier: "toptier".to_string(),
                    name: "Department of Defense".to_string(),
                }],
                time_period: vec![TimePeriod {
                    start_date: start_date.to_string(),
                    end_date: end_date.to_string(),
                }],
                award_type_codes: Some(vec![
                    "A".to_string(),
                    "B".to_string(),
                    "C".to_string(),
                    "D".to_string(),
                ]),
            },
            fields: vec!["Award Amount".to_string()],
            limit: 1,
            page: 1,
            sort: "Award Amount".to_string(),
            order: "desc".to_string(),
            subawards: false,
        };

        let resp = self
            .post_json::<SpendingByAwardRequest, SpendingByAwardResponse>(&url, &body)
            .await?;

        Ok(resp.results.first().and_then(|r| r.award_amount))
    }

    /// Generic POST JSON helper with rate limiting
    async fn post_json<Req: Serialize, Resp: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: &Req,
    ) -> Result<Resp> {
        self.rate_limiter.wait_for_permit().await;
        debug!("POST {}", url);

        let resp = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            anyhow::bail!("HTTP {}: {}", status, body_text);
        }

        let data: Resp = resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("JSON parse error: {}", e))?;

        Ok(data)
    }
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/// Compute month-to-date date range: (YYYY-MM-01, YYYY-MM-DD)
pub fn month_to_date_range() -> (String, String) {
    let now = chrono::Utc::now().date_naive();
    let start = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
    (
        start.format("%Y-%m-%d").to_string(),
        now.format("%Y-%m-%d").to_string(),
    )
}

/// Get the current federal fiscal year.
/// Federal FY starts Oct 1. FY2026 = Oct 2025 - Sep 2026.
pub fn current_fiscal_year() -> u32 {
    let now = chrono::Utc::now().date_naive();
    if now.month() >= 10 {
        now.year() as u32 + 1
    } else {
        now.year() as u32
    }
}

use chrono::Datelike;

// ============================================================================
// API_REF PARSING
// ============================================================================

/// Parsed api_ref for determining which data to extract
#[derive(Debug, Clone, PartialEq)]
pub enum ApiRef {
    /// award_count:contracts, award_count:grants, award_count:total
    AwardCount(String),
    /// top_contract:amount
    TopContract,
    /// budget:obligated, budget:outlayed, budget:resources
    Budget(String),
    /// subagency_count:Department of the Army:contracts
    SubagencyCount { agency: String, award_type: String },
}

impl ApiRef {
    /// Parse an api_ref string from the config JSON
    pub fn parse(s: &str) -> Option<Self> {
        let parts: Vec<&str> = s.splitn(2, ':').collect();
        match parts.first().copied() {
            Some("award_count") => parts.get(1).map(|t| ApiRef::AwardCount(t.to_string())),
            Some("top_contract") => Some(ApiRef::TopContract),
            Some("budget") => parts.get(1).map(|t| ApiRef::Budget(t.to_string())),
            Some("subagency_count") => {
                // subagency_count:Department of the Army:contracts
                let rest = parts.get(1)?;
                let sub_parts: Vec<&str> = rest.rsplitn(2, ':').collect();
                if sub_parts.len() == 2 {
                    Some(ApiRef::SubagencyCount {
                        agency: sub_parts[1].to_string(),
                        award_type: sub_parts[0].to_string(),
                    })
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

/// Extract a numeric value from AwardCountResults based on the award type key
pub fn extract_award_count(results: &AwardCountResults, key: &str) -> u64 {
    match key {
        "contracts" => results.contracts,
        "grants" => results.grants,
        "idvs" => results.idvs,
        "loans" => results.loans,
        "direct_payments" => results.direct_payments,
        "other" => results.other,
        "total" => results.total(),
        _ => {
            warn!("Unknown award count key: {}", key);
            0
        }
    }
}

/// Convert raw dollar value to billions
pub fn dollars_to_billions(raw: f64) -> f64 {
    raw / 1_000_000_000.0
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_ref_parse_award_count() {
        assert_eq!(
            ApiRef::parse("award_count:contracts"),
            Some(ApiRef::AwardCount("contracts".to_string()))
        );
        assert_eq!(
            ApiRef::parse("award_count:grants"),
            Some(ApiRef::AwardCount("grants".to_string()))
        );
        assert_eq!(
            ApiRef::parse("award_count:total"),
            Some(ApiRef::AwardCount("total".to_string()))
        );
    }

    #[test]
    fn test_api_ref_parse_top_contract() {
        assert_eq!(
            ApiRef::parse("top_contract:amount"),
            Some(ApiRef::TopContract)
        );
    }

    #[test]
    fn test_api_ref_parse_budget() {
        assert_eq!(
            ApiRef::parse("budget:obligated"),
            Some(ApiRef::Budget("obligated".to_string()))
        );
        assert_eq!(
            ApiRef::parse("budget:outlayed"),
            Some(ApiRef::Budget("outlayed".to_string()))
        );
        assert_eq!(
            ApiRef::parse("budget:resources"),
            Some(ApiRef::Budget("resources".to_string()))
        );
    }

    #[test]
    fn test_api_ref_parse_subagency() {
        assert_eq!(
            ApiRef::parse("subagency_count:Department of the Army:contracts"),
            Some(ApiRef::SubagencyCount {
                agency: "Department of the Army".to_string(),
                award_type: "contracts".to_string(),
            })
        );
        assert_eq!(
            ApiRef::parse("subagency_count:Defense Information Systems Agency:contracts"),
            Some(ApiRef::SubagencyCount {
                agency: "Defense Information Systems Agency".to_string(),
                award_type: "contracts".to_string(),
            })
        );
    }

    #[test]
    fn test_api_ref_parse_invalid() {
        assert_eq!(ApiRef::parse("unknown:foo"), None);
        assert_eq!(ApiRef::parse(""), None);
        assert_eq!(ApiRef::parse("award_count"), None);
    }

    #[test]
    fn test_extract_award_count() {
        let results = AwardCountResults {
            contracts: 100,
            grants: 50,
            idvs: 25,
            loans: 10,
            direct_payments: 5,
            other: 3,
        };
        assert_eq!(extract_award_count(&results, "contracts"), 100);
        assert_eq!(extract_award_count(&results, "grants"), 50);
        assert_eq!(extract_award_count(&results, "total"), 193);
        assert_eq!(extract_award_count(&results, "unknown"), 0);
    }

    #[test]
    fn test_dollars_to_billions() {
        assert!((dollars_to_billions(1_000_000_000.0) - 1.0).abs() < f64::EPSILON);
        assert!((dollars_to_billions(500_000_000_000.0) - 500.0).abs() < f64::EPSILON);
        assert!((dollars_to_billions(1_234_567_890_123.0) - 1234.56789_0123).abs() < 0.0001);
    }

    #[test]
    fn test_award_count_total() {
        let results = AwardCountResults {
            contracts: 10,
            grants: 20,
            idvs: 30,
            loans: 40,
            direct_payments: 50,
            other: 60,
        };
        assert_eq!(results.total(), 210);
    }

    #[test]
    fn test_month_to_date_range_format() {
        let (start, end) = month_to_date_range();
        // Verify format: YYYY-MM-DD
        assert_eq!(start.len(), 10);
        assert_eq!(end.len(), 10);
        assert!(start.ends_with("-01"), "Start should be first of month: {}", start);
        // start <= end
        assert!(start <= end);
    }

    #[test]
    fn test_fiscal_year() {
        let fy = current_fiscal_year();
        // Should be a reasonable year
        assert!(fy >= 2025 && fy <= 2030);
    }

    #[test]
    fn test_award_count_response_parsing() {
        let json = r#"{"results":{"contracts":1234,"grants":567,"idvs":89,"loans":12,"direct_payments":34,"other":5}}"#;
        let resp: AwardCountResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.results.contracts, 1234);
        assert_eq!(resp.results.grants, 567);
        assert_eq!(resp.results.total(), 1941);
    }

    #[test]
    fn test_budget_response_parsing() {
        let json = r#"{
            "agency_data_by_year": [
                {
                    "fiscal_year": 2026,
                    "agency_total_obligated": 750000000000.0,
                    "agency_budgetary_resources": 900000000000.0,
                    "agency_total_outlayed": 700000000000.0
                },
                {
                    "fiscal_year": 2025,
                    "agency_total_obligated": 700000000000.0,
                    "agency_budgetary_resources": 850000000000.0,
                    "agency_total_outlayed": 650000000000.0
                }
            ]
        }"#;
        let resp: BudgetaryResourcesResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.agency_data_by_year.len(), 2);
        assert_eq!(resp.agency_data_by_year[0].fiscal_year, 2026);
        assert!((dollars_to_billions(resp.agency_data_by_year[0].agency_total_obligated) - 750.0).abs() < 0.01);
    }

    #[test]
    fn test_spending_by_award_response_parsing() {
        let json = r#"{"results":[{"Award Amount":9876543210.50}]}"#;
        let resp: SpendingByAwardResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.results.len(), 1);
        assert!((resp.results[0].award_amount.unwrap() - 9876543210.50).abs() < 0.01);
    }

    #[test]
    fn test_spending_by_award_empty_response() {
        let json = r#"{"results":[]}"#;
        let resp: SpendingByAwardResponse = serde_json::from_str(json).unwrap();
        assert!(resp.results.is_empty());
    }
}
