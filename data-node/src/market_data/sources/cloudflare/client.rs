//! Cloudflare Radar API client implementing MarketDataSource
//!
//! Tracks internet health metrics: service rankings, domain popularity,
//! DDoS attack volumes, AI bot traffic, IPv6/HTTP3 adoption, internet quality.
//!
//! API: https://api.cloudflare.com/client/v4/radar/
//! Auth: CLOUDFLARE_RADAR_TOKEN (free account, Radar read permission)
//! Rate limit: 1,200 req/5min = 2,400/10min, 85% = 2,040
//!
//! TODO(dead-signal): The HTTP adoption percentages tracked here (IPv4/IPv6,
//! TLS 1.2/1.3, HTTP/1.x/2/3, etc.) move ~0.01% per month — effectively
//! flat across a sync interval. Add a dynamic metric. Candidates, all on
//! the existing token's permissions:
//!   - `/attacks/layer3/timeseries_groups/industry` — DDoS count per cycle
//!   - `/attacks/layer3/top/locations/origin` — top attack origins (rank shifts)
//!   - `/attacks/layer7/summary` — daily L7 attack volume
//!   - `/quality/iqi/timeseries` — IQI delta per region
//!   - `/email/security/summary/threat_categories` — phish/malware share
//! Each returns counts or volumes that oscillate every cycle. Do NOT
//! remove the adoption metrics in the same patch — keep both, let the
//! aggregate ride on the dynamic side. See nrc_nuclear and mta_subway
//! for the additive aggregate pattern.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy,
    MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/cloudflare.json");
const API_BASE: &str = "https://api.cloudflare.com/client/v4/radar";
const INTER_REQUEST_DELAY_MS: u64 = 300; // ~200 calls in 600s with headroom

/// Service ranking categories
const SERVICE_CATEGORIES: &[(&str, &str)] = &[
    ("general", "Overall"),
    ("generativeAi", "Generative AI"),
    ("socialMedia", "Social Media"),
    ("videoStreaming", "Video Streaming"),
    ("news", "News"),
    ("eCommerce", "E-Commerce"),
    ("messaging", "Messaging"),
    ("gaming", "Gaming"),
    ("financialServices", "Financial Services"),
    ("cryptocurrency", "Cryptocurrency"),
];

/// Countries for IQI/Speed metrics (top 30 by internet traffic)
const TOP_COUNTRIES: &[&str] = &[
    "US", "CN", "IN", "BR", "DE", "JP", "GB", "FR", "KR", "CA",
    "RU", "IT", "AU", "ES", "MX", "ID", "NL", "TR", "PL", "TH",
    "AR", "SE", "CH", "BE", "AT", "NO", "FI", "DK", "SG", "IE",
];

/// HTTP adoption dimensions to track (global)
/// (api_path for URL, display_name for asset_id, values matching API response keys)
const HTTP_DIMENSIONS: &[(&str, &str, &[&str])] = &[
    ("ip_version", "ipVersion", &["IPv4", "IPv6"]),
    ("http_version", "httpVersion", &["HTTP/1.x", "HTTP/2", "HTTP/3"]),
    ("device_type", "deviceType", &["desktop", "mobile"]),
    ("bot_class", "botClass", &["bot", "human"]),
    ("http_protocol", "httpProtocol", &["http", "https"]),
    ("tls_version", "tlsVersion", &["TLS 1.2", "TLS 1.3"]),
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct RadarResponse<T> {
    success: bool,
    result: T,
}

// Service rankings
#[derive(Debug, Deserialize)]
struct ServiceRankingResult {
    #[serde(default)]
    top: Vec<ServiceRankEntry>,
}

#[derive(Debug, Deserialize)]
struct ServiceRankEntry {
    #[serde(rename = "serviceId")]
    service_id: Option<i64>,
    #[serde(rename = "serviceName")]
    service_name: String,
    rank: u64,
}

// Domain rankings
#[derive(Debug, Deserialize)]
struct DomainRankingResult {
    #[serde(default)]
    top: Vec<DomainRankEntry>,
}

#[derive(Debug, Deserialize)]
struct DomainRankEntry {
    domain: String,
    rank: u64,
}

// HTTP summary
#[derive(Debug, Deserialize)]
struct HttpSummaryResult {
    #[serde(default)]
    summary_0: HashMap<String, String>,
}

// Timeseries (for DDoS, AI bots)
#[derive(Debug, Deserialize)]
struct TimeseriesResult {
    #[serde(default)]
    serie_0: Option<TimeseriesSerie>,
}

#[derive(Debug, Deserialize)]
struct TimeseriesSerie {
    #[serde(default)]
    values: Vec<String>,
}

// IQI summary
#[derive(Debug, Deserialize)]
struct IqiSummaryResult {
    #[serde(default)]
    summary_0: IqiSummaryData,
}

#[derive(Debug, Default, Deserialize)]
struct IqiSummaryData {
    #[serde(default)]
    p50: Option<String>,
}

// Speed summary
#[derive(Debug, Deserialize)]
struct SpeedSummaryResult {
    #[serde(default)]
    summary_0: SpeedSummaryData,
}

#[derive(Debug, Default, Deserialize)]
struct SpeedSummaryData {
    #[serde(rename = "bandwidthDownload", default)]
    bandwidth_download: Option<String>,
    #[serde(rename = "latencyIdle", default)]
    latency_idle: Option<String>,
    #[serde(rename = "jitterIdle", default)]
    jitter_idle: Option<String>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct CloudflareRadarMarketSource {
    http: SourceHttpClient,
    token: String,
}

impl CloudflareRadarMarketSource {
    pub fn from_env() -> Result<Self> {
        let token = std::env::var("CLOUDFLARE_RADAR_TOKEN")
            .map_err(|_| anyhow::anyhow!("CLOUDFLARE_RADAR_TOKEN env var not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2040,
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Cloudflare Radar source initialized");
        Ok(Self { http, token })
    }

    fn auth_headers(&self) -> Vec<(&str, String)> {
        vec![
            ("Authorization", format!("Bearer {}", self.token)),
            ("Content-Type", "application/json".to_string()),
        ]
    }

    fn headers_as_refs<'a>(headers: &'a [(&'a str, String)]) -> Vec<(&'a str, &'a str)> {
        headers.iter().map(|(k, v)| (*k, v.as_str())).collect()
    }

    // --- Fetch methods for each metric group ---

    async fn fetch_domain_rankings(&self) -> Result<Vec<(String, f64)>, SourceError> {
        let url = format!("{}/ranking/top?limit=100&format=json", API_BASE);
        let headers = self.auth_headers();
        let resp: RadarResponse<DomainRankingResult> = self
            .http
            .get_json_with_headers(&url, &Self::headers_as_refs(&headers))
            .await?;
        Ok(resp
            .result
            .top
            .into_iter()
            .map(|e| (e.domain, e.rank as f64))
            .collect())
    }

    async fn fetch_service_rankings(
        &self,
        category: &str,
    ) -> Result<Vec<(String, f64)>, SourceError> {
        let url = format!(
            "{}/ranking/internet_services/top?limit=20&name={}&dateRange=7d&format=json",
            API_BASE, category
        );
        let headers = self.auth_headers();
        let resp: RadarResponse<ServiceRankingResult> = self
            .http
            .get_json_with_headers(&url, &Self::headers_as_refs(&headers))
            .await?;
        Ok(resp
            .result
            .top
            .into_iter()
            .map(|e| (e.service_name, e.rank as f64))
            .collect())
    }

    async fn fetch_http_summary(
        &self,
        dimension: &str,
    ) -> Result<HashMap<String, f64>, SourceError> {
        let url = format!(
            "{}/http/summary/{}?dateRange=1d&format=json",
            API_BASE, dimension
        );
        let headers = self.auth_headers();
        let resp: RadarResponse<HttpSummaryResult> = self
            .http
            .get_json_with_headers(&url, &Self::headers_as_refs(&headers))
            .await?;
        let mut result = HashMap::new();
        for (k, v) in resp.result.summary_0 {
            if let Ok(val) = v.parse::<f64>() {
                result.insert(k, val);
            }
        }
        Ok(result)
    }

    async fn fetch_iqi(
        &self,
        metric: &str,
        location: &str,
    ) -> Result<f64, SourceError> {
        let url = format!(
            "{}/quality/iqi/summary?metric={}&location={}&dateRange=7d&format=json",
            API_BASE, metric, location
        );
        let headers = self.auth_headers();
        let resp: RadarResponse<IqiSummaryResult> = self
            .http
            .get_json_with_headers(&url, &Self::headers_as_refs(&headers))
            .await?;
        resp.result
            .summary_0
            .p50
            .and_then(|s| s.parse::<f64>().ok())
            .ok_or_else(|| SourceError::DataError("No IQI p50 value".to_string()))
    }

    async fn fetch_speed_summary(
        &self,
        location: &str,
    ) -> Result<(f64, f64, f64), SourceError> {
        let url = format!(
            "{}/quality/speed/summary?location={}&dateRange=28d&format=json",
            API_BASE, location
        );
        let headers = self.auth_headers();
        let resp: RadarResponse<SpeedSummaryResult> = self
            .http
            .get_json_with_headers(&url, &Self::headers_as_refs(&headers))
            .await?;
        let bw = resp
            .result
            .summary_0
            .bandwidth_download
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);
        let lat = resp
            .result
            .summary_0
            .latency_idle
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);
        let jit = resp
            .result
            .summary_0
            .jitter_idle
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);
        Ok((bw, lat, jit))
    }

    /// Build the full list of trackable metrics as AssetEntry/AssetUpdate
    fn build_asset_list() -> Vec<(String, String, String, String)> {
        // Returns: (asset_id, symbol, name, api_ref)
        let mut assets = Vec::new();

        // 1. Domain rankings (top 100) — asset_ids generated at fetch time
        // We define a placeholder set; actual domains come from the API
        // Skip static definition; domains are dynamic

        // 2. Service rankings per category (20 per category × 10 categories)
        // Also dynamic — services come from the API

        // 3. HTTP adoption metrics (global)
        for (api_path, display_name, values) in HTTP_DIMENSIONS {
            for val in *values {
                let sanitized = val.replace('/', "").replace(' ', "").to_lowercase();
                assets.push((
                    format!("cf_http_{}_{}", display_name.to_lowercase(), sanitized),
                    format!("CF:HTTP:{}:{}", display_name, val),
                    format!("HTTP {} Share: {}", display_name, val),
                    format!("http:{}:{}:{}", api_path, display_name, val),
                ));
            }
        }

        // 4. IQI metrics (3 metrics × 30 countries)
        for metric in &["bandwidth", "latency", "dns"] {
            for country in TOP_COUNTRIES {
                assets.push((
                    format!("cf_iqi_{}_{}", metric, country.to_lowercase()),
                    format!("CF:IQI:{}:{}", metric, country),
                    format!("Internet Quality {} ({})", metric, country),
                    format!("iqi:{}:{}", metric, country),
                ));
            }
        }

        // 5. Speed tests (3 metrics × 30 countries)
        for metric in &["bandwidth", "latency", "jitter"] {
            for country in TOP_COUNTRIES {
                assets.push((
                    format!("cf_speed_{}_{}", metric, country.to_lowercase()),
                    format!("CF:SPEED:{}:{}", metric, country),
                    format!("Speed Test {} ({})", metric, country),
                    format!("speed:{}:{}", metric, country),
                ));
            }
        }

        assets
    }
}

fn sanitize_service_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>()
        .to_lowercase()
}

#[async_trait::async_trait]
impl MarketDataSource for CloudflareRadarMarketSource {
    fn source_id(&self) -> &'static str {
        "cloudflare"
    }

    fn display_name(&self) -> &'static str {
        "Cloudflare Radar"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2040,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        info!("Cloudflare config is empty, performing live discovery");
        let mut assets = Vec::new();

        // Static metrics (HTTP adoption, IQI, Speed)
        for (id, symbol, name, api_ref) in Self::build_asset_list() {
            let subcategory = if id.starts_with("cf_http_") {
                "internet_adoption"
            } else if id.starts_with("cf_iqi_") {
                "internet_quality"
            } else {
                "internet_speed"
            };
            assets.push(AssetUpdate {
                asset_id: id,
                symbol,
                name,
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": api_ref,
                    "subcategory": subcategory,
                    "active": true,
                    "extra": {},
                }),
            });
        }

        // Dynamic: domain rankings
        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        if let Ok(domains) = self.fetch_domain_rankings().await {
            for (domain, _rank) in &domains {
                let sanitized = domain.replace('.', "_");
                assets.push(AssetUpdate {
                    asset_id: format!("cf_domain_{}", sanitized),
                    symbol: format!("CF:DOMAIN:{}", domain),
                    name: format!("Domain Rank: {}", domain),
                    category: Some("sentiment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("domain:{}", domain),
                        "subcategory": "internet_domains",
                        "active": true,
                        "extra": {},
                    }),
                });
            }
        }

        // Dynamic: service rankings
        for (cat_id, cat_name) in SERVICE_CATEGORIES {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            match self.fetch_service_rankings(cat_id).await {
                Ok(services) => {
                    for (name, _rank) in &services {
                        let sanitized = sanitize_service_name(name);
                        let asset_id =
                            format!("cf_service_{}_{}", sanitized, cat_id.to_lowercase());
                        assets.push(AssetUpdate {
                            asset_id,
                            symbol: format!("CF:SVC:{}:{}", name, cat_id),
                            name: format!("{} rank in {}", name, cat_name),
                            category: Some("sentiment".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("service:{}:{}", name, cat_id),
                                "subcategory": "internet_services",
                                "active": true,
                                "extra": {},
                            }),
                        });
                    }
                }
                Err(e) => warn!("Failed to fetch {} services: {:?}", cat_name, e),
            }
        }

        info!("Discovered {} Cloudflare Radar metrics", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load api_ref lookup
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        // Group asset_ids by type
        let mut domain_ids: Vec<&String> = Vec::new();
        let mut service_cats: HashMap<String, Vec<&String>> = HashMap::new();
        let mut http_ids: Vec<&String> = Vec::new();
        let mut iqi_ids: Vec<&String> = Vec::new();
        let mut speed_ids: Vec<&String> = Vec::new();

        for id in asset_ids {
            if id.starts_with("cf_domain_") {
                domain_ids.push(id);
            } else if id.starts_with("cf_service_") {
                // Extract category from api_ref or asset_id
                let api_ref = ref_lookup.get(id).cloned().unwrap_or_default();
                let cat = api_ref.split(':').nth(2).unwrap_or("general").to_string();
                service_cats.entry(cat).or_default().push(id);
            } else if id.starts_with("cf_http_") {
                http_ids.push(id);
            } else if id.starts_with("cf_iqi_") {
                iqi_ids.push(id);
            } else if id.starts_with("cf_speed_") {
                speed_ids.push(id);
            }
        }

        // Fetch domain rankings (1 call)
        if !domain_ids.is_empty() {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            if let Ok(domains) = self.fetch_domain_rankings().await {
                let domain_map: HashMap<String, f64> = domains
                    .into_iter()
                    .map(|(d, r)| (format!("cf_domain_{}", d.replace('.', "_")), r))
                    .collect();
                for id in &domain_ids {
                    if let Some(&rank) = domain_map.get(*id) {
                        results.push(PriceUpdate {
                            asset_id: (*id).clone(),
                            symbol: format!("CF:DOMAIN"),
                            value: Decimal::from_f64_retain(rank).unwrap_or(Decimal::ZERO),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
            }
        }

        // Fetch service rankings (1 call per category)
        for (cat, ids) in &service_cats {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            if let Ok(services) = self.fetch_service_rankings(cat).await {
                let svc_map: HashMap<String, f64> = services
                    .into_iter()
                    .map(|(name, rank)| {
                        let sanitized = sanitize_service_name(&name);
                        (
                            format!("cf_service_{}_{}", sanitized, cat.to_lowercase()),
                            rank,
                        )
                    })
                    .collect();
                for id in ids {
                    if let Some(&rank) = svc_map.get(*id) {
                        results.push(PriceUpdate {
                            asset_id: (*id).clone(),
                            symbol: format!("CF:SVC"),
                            value: Decimal::from_f64_retain(rank).unwrap_or(Decimal::ZERO),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
            }
        }

        // Fetch HTTP adoption (1 call per dimension)
        if !http_ids.is_empty() {
            let mut http_values: HashMap<String, f64> = HashMap::new();
            for (api_path, display_name, _values) in HTTP_DIMENSIONS {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
                if let Ok(summary) = self.fetch_http_summary(api_path).await {
                    for (k, v) in summary {
                        let sanitized = k.replace('/', "").replace(' ', "").to_lowercase();
                        let id = format!("cf_http_{}_{}", display_name.to_lowercase(), sanitized);
                        http_values.insert(id, v);
                    }
                }
            }
            for id in &http_ids {
                if let Some(&val) = http_values.get(*id) {
                    results.push(PriceUpdate {
                        asset_id: (*id).clone(),
                        symbol: format!("CF:HTTP"),
                        value: Decimal::from_f64_retain(val).unwrap_or(Decimal::ZERO),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
        }

        // Fetch IQI (1 call per metric × country)
        for id in &iqi_ids {
            // Parse metric and country from asset_id: cf_iqi_bandwidth_us
            let parts: Vec<&str> = id.strip_prefix("cf_iqi_").unwrap_or("").splitn(2, '_').collect();
            if parts.len() != 2 {
                continue;
            }
            let metric = parts[0];
            let country = parts[1].to_uppercase();

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            match self.fetch_iqi(metric, &country).await {
                Ok(val) => {
                    results.push(PriceUpdate {
                        asset_id: (*id).clone(),
                        symbol: format!("CF:IQI:{}:{}", metric, country),
                        value: Decimal::from_f64_retain(val).unwrap_or(Decimal::ZERO),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Err(e) => debug!("IQI fetch failed for {}: {:?}", id, e),
            }
        }

        // Fetch Speed (1 call per country, returns 3 metrics)
        let mut speed_by_country: HashMap<String, Vec<&String>> = HashMap::new();
        for id in &speed_ids {
            let parts: Vec<&str> = id
                .strip_prefix("cf_speed_")
                .unwrap_or("")
                .splitn(2, '_')
                .collect();
            if parts.len() == 2 {
                speed_by_country
                    .entry(parts[1].to_uppercase())
                    .or_default()
                    .push(id);
            }
        }
        for (country, ids) in &speed_by_country {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            match self.fetch_speed_summary(country).await {
                Ok((bw, lat, jit)) => {
                    let vals: HashMap<&str, f64> = [
                        ("bandwidth", bw),
                        ("latency", lat),
                        ("jitter", jit),
                    ]
                    .into_iter()
                    .collect();
                    for id in ids {
                        let metric = id
                            .strip_prefix("cf_speed_")
                            .and_then(|s| s.splitn(2, '_').next())
                            .unwrap_or("");
                        if let Some(&val) = vals.get(metric) {
                            results.push(PriceUpdate {
                                asset_id: (*id).clone(),
                                symbol: format!("CF:SPEED:{}:{}", metric, country),
                                value: Decimal::from_f64_retain(val).unwrap_or(Decimal::ZERO),
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => debug!("Speed fetch failed for {}: {:?}", country, e),
            }
        }

        info!(
            "Fetched {}/{} prices from Cloudflare Radar",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering Cloudflare Radar metrics...");
        let mut entries = Vec::new();

        // Static metrics
        for (id, symbol, name, api_ref) in Self::build_asset_list() {
            let subcategory = if id.starts_with("cf_http_") {
                "internet_adoption"
            } else if id.starts_with("cf_iqi_") {
                "internet_quality"
            } else {
                "internet_speed"
            };
            entries.push(AssetEntry {
                asset_id: id,
                symbol,
                name,
                category: "sentiment".to_string(),
                subcategory: subcategory.to_string(),
                api_ref,
                active: true,
            });
        }

        // Dynamic: domains
        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        if let Ok(domains) = self.fetch_domain_rankings().await {
            for (domain, _) in &domains {
                let sanitized = domain.replace('.', "_");
                entries.push(AssetEntry {
                    asset_id: format!("cf_domain_{}", sanitized),
                    symbol: format!("CF:DOMAIN:{}", domain),
                    name: format!("Domain Rank: {}", domain),
                    category: "sentiment".to_string(),
                    subcategory: "internet_domains".to_string(),
                    api_ref: format!("domain:{}", domain),
                    active: true,
                });
            }
        }

        // Dynamic: services
        for (cat_id, cat_name) in SERVICE_CATEGORIES {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            if let Ok(services) = self.fetch_service_rankings(cat_id).await {
                for (name, _) in &services {
                    let sanitized = sanitize_service_name(name);
                    entries.push(AssetEntry {
                        asset_id: format!("cf_service_{}_{}", sanitized, cat_id.to_lowercase()),
                        symbol: format!("CF:SVC:{}:{}", name, cat_id),
                        name: format!("{} rank in {}", name, cat_name),
                        category: "sentiment".to_string(),
                        subcategory: "internet_services".to_string(),
                        api_ref: format!("service:{}:{}", name, cat_id),
                        active: true,
                    });
                }
            }
        }

        info!("Discovered {} Cloudflare Radar metrics", entries.len());
        Ok(entries)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    #[test]
    fn test_build_asset_list_not_empty() {
        let assets = CloudflareRadarMarketSource::build_asset_list();
        assert!(!assets.is_empty());
        // HTTP dimensions: 2+3+2+2+2+2 = 13
        // IQI: 3 metrics × 30 countries = 90
        // Speed: 3 metrics × 30 countries = 90
        // Total static: 193
        assert!(assets.len() >= 190);
    }

    #[test]
    fn test_sanitize_service_name() {
        assert_eq!(sanitize_service_name("ChatGPT"), "chatgpt");
        assert_eq!(sanitize_service_name("Google Search"), "googlesearch");
        assert_eq!(sanitize_service_name("TikTok"), "tiktok");
    }

    #[test]
    fn test_service_categories_not_empty() {
        assert_eq!(SERVICE_CATEGORIES.len(), 10);
    }

    #[test]
    fn test_top_countries_count() {
        assert_eq!(TOP_COUNTRIES.len(), 30);
    }
}
