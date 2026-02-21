//! DefiLlama API client for TVL, fees, revenue, volume, yields, and raises data.

use std::time::Duration;

use reqwest::StatusCode;
use serde::Deserialize;
use tracing::warn;

use crate::coingecko::RateLimiter;

const BASE_URL: &str = "https://api.llama.fi";
const YIELDS_URL: &str = "https://yields.llama.fi";
/// DefiLlama has no explicit rate limit — use ~10 req/s to be respectful.
const MIN_INTERVAL: Duration = Duration::from_millis(100);

// ---------- response types ----------

// --- /protocols ---

#[derive(Debug, Clone, Deserialize)]
pub struct Protocol {
    pub slug: String,
    pub name: String,
    pub gecko_id: Option<String>,
    pub symbol: Option<String>,
    pub category: Option<String>,
    #[serde(default)]
    pub chains: Vec<String>,
    pub tvl: Option<f64>,
    pub change_1d: Option<f64>,
    pub change_7d: Option<f64>,
    pub mcap: Option<f64>,
}

// --- overview endpoints (fees, revenue, dex, derivatives, options, aggregators) ---

#[derive(Debug, Clone, Deserialize)]
pub struct OverviewResponse {
    pub protocols: Vec<OverviewProtocol>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewProtocol {
    pub name: String,
    #[serde(alias = "defillamaId")]
    pub defillama_id: Option<String>,
    pub total24h: Option<f64>,
    pub total7d: Option<f64>,
    pub total30d: Option<f64>,
}

// --- /yields/pools ---

#[derive(Debug, Clone, Deserialize)]
pub struct YieldPoolsResponse {
    pub status: String,
    pub data: Vec<YieldPool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YieldPool {
    pub pool: String,
    pub chain: Option<String>,
    pub project: Option<String>,
    pub symbol: Option<String>,
    pub tvl_usd: Option<f64>,
    pub apy: Option<f64>,
    pub apy_base: Option<f64>,
    pub apy_reward: Option<f64>,
}

// --- /raises ---

#[derive(Debug, Clone, Deserialize)]
pub struct RaisesResponse {
    pub raises: Vec<RaiseEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaiseEntry {
    pub name: Option<String>,
    pub defillama_id: Option<String>,
    pub round: Option<String>,
    pub amount: Option<f64>,
    pub valuation: Option<f64>,
    pub date: Option<i64>,
    pub category: Option<String>,
    #[serde(default)]
    pub chains: Vec<String>,
    #[serde(default)]
    pub lead_investors: Vec<String>,
    #[serde(default)]
    pub other_investors: Vec<String>,
    pub source: Option<String>,
}

// --- /protocol/{slug} (TVL history) ---

#[derive(Debug, Clone, Deserialize)]
pub struct ProtocolDetail {
    #[serde(default)]
    pub tvl: Vec<TvlDataPoint>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TvlDataPoint {
    pub date: i64,
    pub total_liquidity_usd: Option<f64>,
}

// --- /summary/fees/{slug} and /summary/dexs/{slug} ---

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryChartResponse {
    /// Array of [timestamp, value] pairs.
    #[serde(default)]
    pub total_data_chart: Vec<DataChartEntry>,
}

/// A single [timestamp, value] pair from totalDataChart.
/// DefiLlama returns these as JSON arrays: [1690000000, 12345.67]
#[derive(Debug, Clone)]
pub struct DataChartEntry {
    pub timestamp: i64,
    pub value: f64,
}

impl<'de> Deserialize<'de> for DataChartEntry {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let arr: (serde_json::Value, serde_json::Value) =
            Deserialize::deserialize(deserializer)?;
        let timestamp = arr
            .0
            .as_i64()
            .ok_or_else(|| serde::de::Error::custom("expected i64 timestamp"))?;
        let value = arr
            .1
            .as_f64()
            .ok_or_else(|| serde::de::Error::custom("expected f64 value"))?;
        Ok(DataChartEntry { timestamp, value })
    }
}

// ---------- client ----------

pub struct DlClient {
    client: reqwest::Client,
    limiter: RateLimiter,
}

impl DlClient {
    /// Create a new DefiLlama client. No API key required.
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("failed to build reqwest client");

        Self {
            client,
            limiter: RateLimiter::new(MIN_INTERVAL),
        }
    }

    /// Create a client with a shared rate limiter.
    pub fn with_limiter(limiter: RateLimiter) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("failed to build reqwest client");

        Self { client, limiter }
    }

    async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        params: &[(&str, &str)],
    ) -> Result<T, DlError> {
        self.limiter.wait().await;
        let mut retries = 0u32;
        loop {
            let resp = self
                .client
                .get(url)
                .query(params)
                .send()
                .await
                .map_err(DlError::Http)?;

            if resp.status() == StatusCode::TOO_MANY_REQUESTS {
                let wait = resp
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(60);
                warn!(wait_secs = wait, retries, "DefiLlama rate-limited, waiting");
                tokio::time::sleep(Duration::from_secs(wait)).await;
                retries += 1;
                if retries > 5 {
                    return Err(DlError::RateLimited);
                }
                self.limiter.wait().await;
                continue;
            }

            let status = resp.status();
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                return Err(DlError::Api(status.as_u16(), body));
            }

            return resp.json::<T>().await.map_err(DlError::Http);
        }
    }

    // ---------- endpoints ----------

    /// Fetch all protocols with TVL data.
    /// `GET https://api.llama.fi/protocols`
    pub async fn fetch_protocols(&self) -> Result<Vec<Protocol>, DlError> {
        let url = format!("{BASE_URL}/protocols");
        self.get_json(&url, &[]).await
    }

    /// Fetch fees overview across all protocols.
    /// `GET https://api.llama.fi/overview/fees`
    pub async fn fetch_fees_overview(&self) -> Result<OverviewResponse, DlError> {
        let url = format!("{BASE_URL}/overview/fees");
        self.get_json(&url, &[]).await
    }

    /// Fetch revenue overview (daily revenue) across all protocols.
    /// `GET https://api.llama.fi/overview/fees?dataType=dailyRevenue`
    pub async fn fetch_revenue_overview(&self) -> Result<OverviewResponse, DlError> {
        let url = format!("{BASE_URL}/overview/fees");
        self.get_json(&url, &[("dataType", "dailyRevenue")]).await
    }

    /// Fetch DEX volume overview across all protocols.
    /// `GET https://api.llama.fi/overview/dexs`
    pub async fn fetch_dex_overview(&self) -> Result<OverviewResponse, DlError> {
        let url = format!("{BASE_URL}/overview/dexs");
        self.get_json(&url, &[]).await
    }

    /// Fetch derivatives volume overview across all protocols.
    /// `GET https://api.llama.fi/overview/derivatives`
    pub async fn fetch_derivatives_overview(&self) -> Result<OverviewResponse, DlError> {
        let url = format!("{BASE_URL}/overview/derivatives");
        self.get_json(&url, &[]).await
    }

    /// Fetch options volume overview across all protocols.
    /// `GET https://api.llama.fi/overview/options`
    pub async fn fetch_options_overview(&self) -> Result<OverviewResponse, DlError> {
        let url = format!("{BASE_URL}/overview/options");
        self.get_json(&url, &[]).await
    }

    /// Fetch aggregator volume overview across all protocols.
    /// `GET https://api.llama.fi/overview/aggregators`
    pub async fn fetch_aggregators_overview(&self) -> Result<OverviewResponse, DlError> {
        let url = format!("{BASE_URL}/overview/aggregators");
        self.get_json(&url, &[]).await
    }

    /// Fetch all yield pools.
    /// `GET https://yields.llama.fi/pools`
    pub async fn fetch_yield_pools(&self) -> Result<YieldPoolsResponse, DlError> {
        let url = format!("{YIELDS_URL}/pools");
        self.get_json(&url, &[]).await
    }

    /// Fetch fundraising rounds.
    /// `GET https://api.llama.fi/raises`
    pub async fn fetch_raises(&self) -> Result<RaisesResponse, DlError> {
        let url = format!("{BASE_URL}/raises");
        self.get_json(&url, &[]).await
    }

    /// Fetch historical TVL data for a specific protocol by slug.
    /// `GET https://api.llama.fi/protocol/{slug}`
    pub async fn fetch_protocol_tvl_history(
        &self,
        slug: &str,
    ) -> Result<ProtocolDetail, DlError> {
        let url = format!("{BASE_URL}/protocol/{slug}");
        self.get_json(&url, &[]).await
    }

    /// Fetch historical daily fees for a specific protocol by slug.
    /// `GET https://api.llama.fi/summary/fees/{slug}?dataType=dailyFees`
    pub async fn fetch_protocol_fee_history(
        &self,
        slug: &str,
    ) -> Result<SummaryChartResponse, DlError> {
        let url = format!("{BASE_URL}/summary/fees/{slug}");
        self.get_json(&url, &[("dataType", "dailyFees")]).await
    }

    /// Fetch historical daily DEX volume for a specific protocol by slug.
    /// `GET https://api.llama.fi/summary/dexs/{slug}`
    pub async fn fetch_protocol_volume_history(
        &self,
        slug: &str,
    ) -> Result<SummaryChartResponse, DlError> {
        let url = format!("{BASE_URL}/summary/dexs/{slug}");
        self.get_json(&url, &[]).await
    }
}

// ---------- error ----------

#[derive(Debug)]
pub enum DlError {
    Http(reqwest::Error),
    Api(u16, String),
    RateLimited,
}

impl std::fmt::Display for DlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DlError::Http(e) => write!(f, "HTTP error: {e}"),
            DlError::Api(code, body) => write!(f, "API error {code}: {body}"),
            DlError::RateLimited => write!(f, "Rate limited after retries"),
        }
    }
}

impl std::error::Error for DlError {}
