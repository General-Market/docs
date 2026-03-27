//! CoinGecko Demo API client for market cap data.

use std::sync::Arc;
use std::time::Duration;

use chrono::NaiveDate;
use reqwest::header::{HeaderMap, HeaderValue};
use serde::Deserialize;
use tokio::sync::Mutex;
use tokio::time::Instant;
use tracing::{debug, warn};

const BASE_URL: &str = "https://api.coingecko.com/api/v3";
/// Demo plan: ~30 req/min.  Shared by CoinGeckoMarketSource AND cg_collector,
/// so 3 s ≈ 20 req/min leaves headroom for 429-retry bursts.
const MIN_INTERVAL_DEMO: Duration = Duration::from_millis(3000);
/// Pro plan: ~500 req/min — 150 ms between requests.
const MIN_INTERVAL_PRO: Duration = Duration::from_millis(150);

// ---------- response types ----------

#[derive(Debug, Clone, Deserialize)]
pub struct MarketCoin {
    pub id: String,
    pub symbol: Option<String>,
    pub name: Option<String>,
    pub image: Option<String>,
    pub market_cap: Option<f64>,
    pub current_price: Option<f64>,
    pub total_volume: Option<f64>,
    pub market_cap_rank: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MarketChartResponse {
    pub market_caps: Vec<(f64, f64)>,   // [timestamp_ms, market_cap]
    pub prices: Vec<(f64, f64)>,        // [timestamp_ms, price]
    pub total_volumes: Vec<(f64, f64)>, // [timestamp_ms, volume]
}

/// A single daily data point extracted from market_chart.
#[derive(Debug, Clone)]
pub struct DailyMarketCap {
    pub date: NaiveDate,
    pub market_cap: f64,
    pub price: f64,
    pub volume: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CoinListEntry {
    pub id: String,
    pub symbol: Option<String>,
    pub name: Option<String>,
}

/// A category from /coins/categories (full data).
#[derive(Debug, Clone, Deserialize)]
pub struct CategoryData {
    pub id: String,
    pub name: String,
    pub market_cap: Option<f64>,
    pub market_cap_change_24h: Option<f64>,
    pub volume_24h: Option<f64>,
    pub top_3_coins: Option<Vec<String>>,
    pub updated_at: Option<String>,
}

/// A lightweight category from /coins/categories/list.
#[derive(Debug, Clone, Deserialize)]
pub struct CategoryListEntry {
    pub category_id: String,
    pub name: String,
}

// ---------- shared rate limiter ----------

/// Global rate limiter that can be shared across multiple workers via Arc.
/// Uses slot-reservation: workers briefly acquire the lock to reserve their
/// time slot, then release it and sleep outside the critical section.
#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Mutex<Instant>>,
    min_interval: Duration,
}

impl RateLimiter {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Instant::now() - min_interval)),
            min_interval,
        }
    }

    /// Rate limiter for CoinGecko Demo plan (~20 req/min, shared).
    pub fn coingecko_demo() -> Self {
        Self::new(MIN_INTERVAL_DEMO)
    }

    /// Rate limiter for CoinGecko Pro plan (~400 req/min, shared).
    pub fn coingecko_pro() -> Self {
        Self::new(MIN_INTERVAL_PRO)
    }

    /// Reserve the next request slot and sleep until it's time.
    pub async fn wait(&self) {
        let sleep_until = {
            let mut last = self.inner.lock().await;
            let now = Instant::now();
            let next = *last + self.min_interval;
            let target = if next > now { next } else { now };
            *last = target;
            target
        };
        // Lock released — sleep without blocking other workers from reserving
        let now = Instant::now();
        if sleep_until > now {
            tokio::time::sleep(sleep_until - now).await;
        }
    }
}

// ---------- client ----------

pub struct CoinGeckoClient {
    client: reqwest::Client,
    limiter: RateLimiter,
}

impl CoinGeckoClient {
    /// Create a client with its own private rate limiter.
    /// Use `with_limiter` for shared rate limiting across workers.
    pub fn new(api_key: &str) -> Result<Self, reqwest::Error> {
        Self::with_limiter(api_key, RateLimiter::coingecko_demo())
    }

    /// Create a client that shares the given rate limiter.
    pub fn with_limiter(api_key: &str, limiter: RateLimiter) -> Result<Self, reqwest::Error> {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-cg-demo-key",
            HeaderValue::from_str(api_key).expect("invalid API key"),
        );
        let client = reqwest::Client::builder()
            .default_headers(headers)
            .user_agent("IndexDataNode/1.0 (market-data-collector)")
            .timeout(Duration::from_secs(60))
            .build()?;

        Ok(Self { client, limiter })
    }

    async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        params: &[(&str, &str)],
    ) -> Result<T, CgError> {
        self.limiter.wait().await;
        let mut retries = 0u32;
        loop {
            let resp = self
                .client
                .get(url)
                .query(params)
                .send()
                .await
                .map_err(CgError::Http)?;

            if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                let wait = resp
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(60);
                warn!(wait_secs = wait, retries, "CoinGecko rate-limited, waiting");
                tokio::time::sleep(Duration::from_secs(wait)).await;
                retries += 1;
                if retries > 5 {
                    return Err(CgError::RateLimited);
                }
                self.limiter.wait().await;
                continue;
            }

            let status = resp.status();
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                return Err(CgError::Api(status.as_u16(), body));
            }

            return resp.json::<T>().await.map_err(CgError::Http);
        }
    }

    // ---------- endpoints ----------

    /// Fetch one page of /coins/markets (up to 250 coins).
    pub async fn fetch_markets_page(
        &self,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<MarketCoin>, CgError> {
        let page_str = page.to_string();
        let per_page_str = per_page.to_string();
        let params = [
            ("vs_currency", "usd"),
            ("order", "market_cap_desc"),
            ("per_page", &per_page_str),
            ("page", &page_str),
            ("sparkline", "false"),
        ];
        let url = format!("{BASE_URL}/coins/markets");
        self.get_json(&url, &params).await
    }

    /// Fetch ALL coins with a market cap, paginated.
    /// Returns when an empty page is received.
    pub async fn fetch_all_markets(&self) -> Result<Vec<MarketCoin>, CgError> {
        let per_page = 250u32;
        let mut all = Vec::new();
        let mut page = 1u32;

        loop {
            debug!(page, "Fetching CoinGecko markets page");
            let coins = self.fetch_markets_page(page, per_page).await?;
            let count = coins.len();
            all.extend(coins);

            if count < per_page as usize {
                break; // last page
            }
            page += 1;

            // Safety: CoinGecko caps at ~15k coins
            if page > 100 {
                break;
            }
        }

        Ok(all)
    }

    /// Fetch full daily historical market chart for a single coin.
    /// Uses `days=max` — CoinGecko returns daily granularity for long ranges.
    pub async fn fetch_daily_market_chart(
        &self,
        coin_id: &str,
    ) -> Result<Vec<DailyMarketCap>, CgError> {
        let url = format!("{BASE_URL}/coins/{coin_id}/market_chart");
        let params = [("vs_currency", "usd"), ("days", "max")];
        let resp: MarketChartResponse = self.get_json(&url, &params).await?;

        // Zip market_caps with prices and volumes by index
        let len = resp
            .market_caps
            .len()
            .min(resp.prices.len())
            .min(resp.total_volumes.len());

        // Deduplicate by date (keep last value per day)
        use std::collections::BTreeMap;
        let mut by_date: BTreeMap<NaiveDate, DailyMarketCap> = BTreeMap::new();

        for i in 0..len {
            let ts_ms = resp.market_caps[i].0 as i64;
            let secs = ts_ms / 1000;
            let dt = match chrono::DateTime::from_timestamp(secs, 0) {
                Some(dt) => dt,
                None => continue,
            };
            let date = dt.date_naive();
            by_date.insert(
                date,
                DailyMarketCap {
                    date,
                    market_cap: resp.market_caps[i].1,
                    price: resp.prices[i].1,
                    volume: resp.total_volumes[i].1,
                },
            );
        }

        Ok(by_date.into_values().collect())
    }

    /// Fetch daily historical market chart for a date range.
    /// Uses `/coins/{id}/market_chart/range` with unix timestamps.
    pub async fn fetch_daily_market_chart_range(
        &self,
        coin_id: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<DailyMarketCap>, CgError> {
        let from_ts = from
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp()
            .to_string();
        let to_ts = to
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_utc()
            .timestamp()
            .to_string();
        let url = format!("{BASE_URL}/coins/{coin_id}/market_chart/range");
        let params = [
            ("vs_currency", "usd"),
            ("from", &from_ts),
            ("to", &to_ts),
        ];
        let resp: MarketChartResponse = self.get_json(&url, &params).await?;

        let len = resp
            .market_caps
            .len()
            .min(resp.prices.len())
            .min(resp.total_volumes.len());

        use std::collections::BTreeMap;
        let mut by_date: BTreeMap<NaiveDate, DailyMarketCap> = BTreeMap::new();

        for i in 0..len {
            let ts_ms = resp.market_caps[i].0 as i64;
            let secs = ts_ms / 1000;
            let dt = match chrono::DateTime::from_timestamp(secs, 0) {
                Some(dt) => dt,
                None => continue,
            };
            let date = dt.date_naive();
            by_date.insert(
                date,
                DailyMarketCap {
                    date,
                    market_cap: resp.market_caps[i].1,
                    price: resp.prices[i].1,
                    volume: resp.total_volumes[i].1,
                },
            );
        }

        Ok(by_date.into_values().collect())
    }

    /// Fetch all categories with market data from /coins/categories.
    pub async fn fetch_categories(&self) -> Result<Vec<CategoryData>, CgError> {
        let url = format!("{BASE_URL}/coins/categories");
        self.get_json(&url, &[]).await
    }

    /// Fetch one page of coins belonging to a specific category.
    pub async fn fetch_category_coins(
        &self,
        category_id: &str,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<MarketCoin>, CgError> {
        let page_str = page.to_string();
        let per_page_str = per_page.to_string();
        let params = [
            ("vs_currency", "usd"),
            ("category", category_id),
            ("order", "market_cap_desc"),
            ("per_page", &per_page_str),
            ("page", &page_str),
            ("sparkline", "false"),
        ];
        let url = format!("{BASE_URL}/coins/markets");
        self.get_json(&url, &params).await
    }

    /// Fetch ALL coins belonging to a specific category, paginated.
    pub async fn fetch_all_category_coins(
        &self,
        category_id: &str,
    ) -> Result<Vec<MarketCoin>, CgError> {
        let per_page = 250u32;
        let mut all = Vec::new();
        let mut page = 1u32;

        loop {
            let coins = self.fetch_category_coins(category_id, page, per_page).await?;
            let count = coins.len();
            all.extend(coins);

            if count < per_page as usize {
                break;
            }
            page += 1;

            if page > 40 {
                break; // safety cap
            }
        }

        Ok(all)
    }
}

// ---------- error ----------

#[derive(Debug)]
pub enum CgError {
    Http(reqwest::Error),
    Api(u16, String),
    RateLimited,
}

impl std::fmt::Display for CgError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CgError::Http(e) => write!(f, "HTTP error: {e}"),
            CgError::Api(code, body) => write!(f, "API error {code}: {body}"),
            CgError::RateLimited => write!(f, "Rate limited after retries"),
        }
    }
}

impl std::error::Error for CgError {}
