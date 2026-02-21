//! SEC Form 4 Insider Trading API client implementing MarketDataSource
//!
//! Fetches daily Form 4 filings from SEC EDGAR EFTS search and parses
//! the XML to aggregate insider buy/sell activity per ticker.
//!
//! Two-phase API:
//! 1. Discovery via EFTS full-text search for Form 4 filings
//! 2. Download and parse each Form 4 XML for transaction details
//!
//! Provides 157 assets: 7 market-wide aggregates + 50 tickers x 3 metrics.

use anyhow::{bail, Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::tracked_tickers::TRACKED_TICKERS;
use crate::market_data::traits::{
    is_us_weekend, next_us_trading_day, today_at_eastern, AssetUpdate, MarketDataSource,
    PriceUpdate, ScheduledMarketDataSource,
};

// ── Market-wide aggregate asset IDs ──

const MARKET_ASSETS: &[(&str, &str, &str)] = &[
    (
        "insider_market_buy_count",
        "Market Insider Buy Count",
        "count",
    ),
    (
        "insider_market_sell_count",
        "Market Insider Sell Count",
        "count",
    ),
    (
        "insider_market_buy_usd",
        "Market Insider Buy Volume USD",
        "usd",
    ),
    (
        "insider_market_sell_usd",
        "Market Insider Sell Volume USD",
        "usd",
    ),
    (
        "insider_market_buy_sell_ratio",
        "Market Insider Buy/Sell Ratio",
        "ratio",
    ),
    (
        "insider_market_net_usd",
        "Market Insider Net USD",
        "usd",
    ),
    (
        "insider_market_csuite_buy_count",
        "Market C-Suite Buy Count",
        "count",
    ),
];

/// Per-ticker metrics (appended to `insider_{suffix}_`)
const TICKER_METRICS: &[(&str, &str, &str)] = &[
    ("_buy_count", "Insider Buy Count", "count"),
    ("_sell_count", "Insider Sell Count", "count"),
    ("_net_usd", "Insider Net USD", "usd"),
];

// ── EFTS discovery response types ──

#[derive(Debug, Deserialize)]
struct EftsResponse {
    hits: EftsHits,
}

#[derive(Debug, Deserialize)]
struct EftsHits {
    total: EftsTotal,
    #[serde(default)]
    hits: Vec<EftsHit>,
}

#[derive(Debug, Deserialize)]
struct EftsTotal {
    value: i64,
}

#[derive(Debug, Deserialize)]
struct EftsHit {
    _id: String,
    #[serde(rename = "_source")]
    source: EftsSource,
}

#[derive(Debug, Deserialize)]
struct EftsSource {
    #[serde(default)]
    ciks: Vec<String>,
    #[serde(default)]
    display_names: Vec<String>,
}

// ── Company tickers response ──

#[derive(Debug, Deserialize)]
struct CompanyTickerEntry {
    cik_str: u64,
    ticker: String,
}

// ── Form 4 XML deserialization ──

#[derive(Debug, Deserialize)]
#[serde(rename = "ownershipDocument")]
struct OwnershipDocument {
    #[serde(rename = "reportingOwner", default)]
    reporting_owner: Vec<ReportingOwner>,
    #[serde(rename = "nonDerivativeTable")]
    non_derivative_table: Option<NonDerivativeTable>,
}

#[derive(Debug, Deserialize)]
struct ReportingOwner {
    #[serde(rename = "reportingOwnerRelationship")]
    relationship: Option<OwnerRelationship>,
}

#[derive(Debug, Deserialize)]
struct OwnerRelationship {
    #[serde(rename = "officerTitle", default)]
    officer_title: Option<String>,
    #[serde(rename = "isOfficer", default)]
    is_officer: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NonDerivativeTable {
    #[serde(rename = "nonDerivativeTransaction", default)]
    transactions: Vec<NonDerivativeTransaction>,
}

#[derive(Debug, Deserialize)]
struct NonDerivativeTransaction {
    #[serde(rename = "transactionAmounts")]
    amounts: Option<TransactionAmounts>,
}

#[derive(Debug, Deserialize)]
struct TransactionAmounts {
    #[serde(rename = "transactionShares")]
    shares: Option<ValueWrapper>,
    #[serde(rename = "transactionPricePerShare")]
    price_per_share: Option<ValueWrapper>,
    #[serde(rename = "transactionAcquiredDisposedCode")]
    acquired_disposed: Option<ValueWrapper>,
}

#[derive(Debug, Deserialize)]
struct ValueWrapper {
    value: Option<String>,
}

// ── Internal aggregation types ──

#[derive(Default)]
struct InsiderAggregates {
    buy_count: i64,
    sell_count: i64,
    buy_usd: f64,
    sell_usd: f64,
    csuite_buy_count: i64,
}

struct ParsedForm4 {
    is_csuite: bool,
    transactions: Vec<InsiderTransaction>,
}

struct InsiderTransaction {
    shares: f64,
    price: f64,
    is_buy: bool,
}

// ── CIK cache ──

struct CikTickerCache {
    /// CIK (zero-padded 10 digits) -> ticker
    cik_to_ticker: HashMap<String, String>,
    /// When the cache was last refreshed
    refreshed_at: DateTime<Utc>,
}

/// SEC Form 4 Insider Trading market data source
pub struct SecInsiderMarketSource {
    client: reqwest::Client,
    cik_cache: Arc<RwLock<Option<CikTickerCache>>>,
}

impl SecInsiderMarketSource {
    /// Create the SEC Insider Trading client
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("IndexProtocol/1.0 (contact@indexprotocol.com)")
            .build()
            .context("Failed to build reqwest client")?;

        let total_assets = MARKET_ASSETS.len() + TRACKED_TICKERS.len() * TICKER_METRICS.len();
        info!(
            "SEC Insider Trading client initialized ({} assets: {} market-wide + {} per-ticker)",
            total_assets,
            MARKET_ASSETS.len(),
            TRACKED_TICKERS.len() * TICKER_METRICS.len()
        );

        Ok(Self {
            client,
            cik_cache: Arc::new(RwLock::new(None)),
        })
    }

    /// Load or refresh the CIK -> ticker mapping from SEC's company_tickers.json
    async fn load_cik_map(&self) -> Result<()> {
        let url = "https://www.sec.gov/files/company_tickers.json";
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("Failed to fetch company_tickers.json")?;

        if !resp.status().is_success() {
            bail!("company_tickers.json HTTP error: {}", resp.status());
        }

        let entries: HashMap<String, CompanyTickerEntry> = resp
            .json()
            .await
            .context("Failed to parse company_tickers.json")?;

        // Build CIK -> ticker lookup, only for our tracked tickers
        let tracked: HashSet<&str> = TRACKED_TICKERS.iter().map(|(t, _, _)| *t).collect();
        let mut cik_to_ticker = HashMap::new();

        for entry in entries.values() {
            if tracked.contains(entry.ticker.as_str()) {
                let cik_padded = format!("{:010}", entry.cik_str);
                cik_to_ticker.insert(cik_padded, entry.ticker.clone());
            }
        }

        info!(
            "Loaded CIK map: {} tracked tickers matched",
            cik_to_ticker.len()
        );

        let mut cache = self.cik_cache.write().await;
        *cache = Some(CikTickerCache {
            cik_to_ticker,
            refreshed_at: Utc::now(),
        });

        Ok(())
    }

    /// Ensure CIK cache is loaded, refreshing if older than 24 hours
    async fn ensure_cik_cache(&self) -> Result<()> {
        let needs_refresh = {
            let cache = self.cik_cache.read().await;
            match &*cache {
                None => true,
                Some(c) => Utc::now() - c.refreshed_at > chrono::Duration::hours(24),
            }
        };

        if needs_refresh {
            self.load_cik_map().await?;
        }

        Ok(())
    }

    /// Look up ticker for a CIK (zero-padded)
    async fn lookup_ticker(&self, cik: &str) -> Option<String> {
        let cache = self.cik_cache.read().await;
        cache
            .as_ref()
            .and_then(|c| c.cik_to_ticker.get(cik).cloned())
    }

    /// Discover Form 4 filings for a given date via EFTS search, paginating up to hard cap
    async fn discover_filings(&self, date_str: &str) -> Result<Vec<EftsHit>> {
        let mut all_hits = Vec::new();
        let mut offset: i64 = 0;
        let page_size = 100;
        let hard_cap = 2000;

        loop {
            let url = format!(
                "https://efts.sec.gov/LATEST/search-index?q=&forms=4\
                 &dateRange=custom&startdt={}&enddt={}\
                 &_source=file_date,period_of_report,entity_name,file_num,file_type,ciks,display_names\
                 &from={}&size={}",
                date_str, date_str, offset, page_size
            );

            let resp = self
                .client
                .get(&url)
                .send()
                .await
                .with_context(|| format!("EFTS search failed at offset {}", offset))?;

            if !resp.status().is_success() {
                warn!("EFTS search HTTP error: {}", resp.status());
                break;
            }

            let page: EftsResponse = resp
                .json()
                .await
                .with_context(|| format!("EFTS JSON parse failed at offset {}", offset))?;

            let total = page.hits.total.value;
            let page_hits = page.hits.hits.len() as i64;

            if page_hits == 0 {
                break;
            }

            all_hits.extend(page.hits.hits);
            offset += page_size;

            if offset >= total || offset >= hard_cap {
                break;
            }

            // Rate-limit between pages
            tokio::time::sleep(Duration::from_millis(150)).await;
        }

        debug!(
            "Discovered {} Form 4 filings for {}",
            all_hits.len(),
            date_str
        );

        Ok(all_hits)
    }

    /// Download and parse a single Form 4 XML filing
    async fn fetch_form4_xml(&self, cik: &str, accession: &str, doc_name: &str) -> Result<String> {
        let url = format!(
            "https://www.sec.gov/Archives/edgar/data/{}/{}/{}",
            cik.trim_start_matches('0'),
            accession,
            doc_name
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch Form 4 XML: {}", url))?;

        if !resp.status().is_success() {
            bail!("Form 4 XML HTTP error {}: {}", resp.status(), url);
        }

        resp.text()
            .await
            .with_context(|| format!("Failed to read Form 4 XML body: {}", url))
    }
}

/// Check if an officer title indicates C-suite level
fn is_csuite_title(title: &str) -> bool {
    let lower = title.to_lowercase();
    lower.contains("chief")
        || lower.contains("president")
        || lower
            .split(|c: char| !c.is_alphanumeric())
            .any(|w| matches!(w, "ceo" | "cfo" | "cto" | "coo"))
}

/// Parse a Form 4 XML document into structured transaction data
fn parse_form4_xml(xml_text: &str) -> Option<ParsedForm4> {
    let cleaned = xml_text.replace("ns1:", "").replace("n1:", "");

    let doc: OwnershipDocument = quick_xml::de::from_str(&cleaned).ok()?;

    let is_csuite = doc.reporting_owner.iter().any(|owner| {
        owner
            .relationship
            .as_ref()
            .map_or(false, |rel| {
                rel.officer_title
                    .as_ref()
                    .map_or(false, |t| is_csuite_title(t))
            })
    });

    let mut transactions = Vec::new();
    if let Some(table) = doc.non_derivative_table {
        for tx in &table.transactions {
            if let Some(amounts) = &tx.amounts {
                let shares = amounts
                    .shares
                    .as_ref()
                    .and_then(|w| w.value.as_ref())
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.0);
                let price = amounts
                    .price_per_share
                    .as_ref()
                    .and_then(|w| w.value.as_ref())
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.0);
                let is_buy = amounts
                    .acquired_disposed
                    .as_ref()
                    .and_then(|w| w.value.as_ref())
                    .map_or(false, |v| v == "A");

                if shares > 0.0 {
                    transactions.push(InsiderTransaction {
                        shares,
                        price,
                        is_buy,
                    });
                }
            }
        }
    }

    Some(ParsedForm4 {
        is_csuite,
        transactions,
    })
}

/// Extract accession number and document name from an EFTS _id field.
/// Format: "{accession_number}:{doc_name}" e.g. "0001234567-26-000123:filing.xml"
fn parse_efts_id(id: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    if parts.len() != 2 {
        return None;
    }
    Some((parts[0].to_string(), parts[1].to_string()))
}

#[async_trait::async_trait]
impl MarketDataSource for SecInsiderMarketSource {
    fn source_id(&self) -> &'static str {
        "sec_insider"
    }

    fn display_name(&self) -> &'static str {
        "SEC Form 4 Insider Trading"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(12 * 3600) // 12 hours
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 5,
                duration: Duration::from_secs(1),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let mut assets = Vec::with_capacity(157);

        // 7 market-wide aggregates
        for (asset_id, name, unit) in MARKET_ASSETS {
            assets.push(AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: asset_id.to_string(),
                name: name.to_string(),
                category: Some("insider_trading".to_string()),
                metadata: serde_json::json!({
                    "source": "sec_insider",
                    "scope": "market_wide",
                    "unit": unit,
                    "update_frequency": "daily",
                }),
            });
        }

        // 50 tickers x 3 metrics = 150 per-ticker assets
        for (ticker, suffix, company_name) in TRACKED_TICKERS {
            for (metric_suffix, metric_name, unit) in TICKER_METRICS {
                let asset_id = format!("insider_{}{}", suffix, metric_suffix);
                let name = format!("{} - {}", company_name, metric_name);

                assets.push(AssetUpdate {
                    asset_id,
                    symbol: format!("{}_{}", ticker, metric_suffix.trim_start_matches('_')),
                    name,
                    category: Some("insider_trading".to_string()),
                    metadata: serde_json::json!({
                        "source": "sec_insider",
                        "scope": "per_ticker",
                        "ticker": ticker,
                        "unit": unit,
                        "update_frequency": "daily",
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        // Ensure CIK cache is loaded
        self.ensure_cik_cache().await?;

        // Get today's date in ET for the EFTS query
        let eastern_now = today_at_eastern(now, 12, 0);
        let date_str = eastern_now.format("%Y-%m-%d").to_string();

        info!("Fetching Form 4 filings for {}", date_str);

        // Phase 1: Discover filings via EFTS
        let hits = self.discover_filings(&date_str).await?;
        info!("Found {} Form 4 filings to process", hits.len());

        // Market-wide aggregates
        let mut market = InsiderAggregates::default();
        // Per-ticker aggregates: suffix -> aggregates
        let mut per_ticker: HashMap<String, InsiderAggregates> =
            HashMap::new();

        let mut processed = 0;
        let mut skipped = 0;

        for hit in &hits {
            // Extract accession number and document name from _id
            let (accession, doc_name) = match parse_efts_id(&hit._id) {
                Some(pair) => pair,
                None => {
                    debug!("Could not parse EFTS _id: {}", hit._id);
                    skipped += 1;
                    continue;
                }
            };

            // Get the CIK from the hit source
            let cik = match hit.source.ciks.first() {
                Some(c) => c.clone(),
                None => {
                    skipped += 1;
                    continue;
                }
            };

            // Check if this CIK maps to a tracked ticker
            let ticker_suffix = self.lookup_ticker(&cik).await.and_then(|ticker| {
                TRACKED_TICKERS
                    .iter()
                    .find(|(t, _, _)| *t == ticker.as_str())
                    .map(|(_, suffix, _)| suffix.to_string())
            });

            // Rate-limit between XML downloads
            tokio::time::sleep(Duration::from_millis(150)).await;

            // Phase 2: Download and parse Form 4 XML
            let xml_text = match self.fetch_form4_xml(&cik, &accession, &doc_name).await {
                Ok(text) => text,
                Err(e) => {
                    debug!("Failed to fetch Form 4 XML for {}: {:?}", accession, e);
                    skipped += 1;
                    continue;
                }
            };

            let parsed = match parse_form4_xml(&xml_text) {
                Some(p) => p,
                None => {
                    debug!("Failed to parse Form 4 XML for {}", accession);
                    skipped += 1;
                    continue;
                }
            };

            // Aggregate transactions
            for tx in &parsed.transactions {
                let usd_value = tx.shares * tx.price;

                if tx.is_buy {
                    market.buy_count += 1;
                    market.buy_usd += usd_value;
                    if parsed.is_csuite {
                        market.csuite_buy_count += 1;
                    }
                } else {
                    market.sell_count += 1;
                    market.sell_usd += usd_value;
                }

                // Per-ticker aggregation if this CIK maps to a tracked ticker
                if let Some(ref suffix) = ticker_suffix {
                    let entry = per_ticker.entry(suffix.clone()).or_default();
                    if tx.is_buy {
                        entry.buy_count += 1;
                        entry.buy_usd += usd_value;
                    } else {
                        entry.sell_count += 1;
                        entry.sell_usd += usd_value;
                    }
                }
            }

            processed += 1;
        }

        info!(
            "Processed {} Form 4 filings ({} skipped). Market: {} buys, {} sells",
            processed, skipped, market.buy_count, market.sell_count
        );

        // Build PriceUpdate results
        let mut results = Vec::new();

        // Market-wide aggregates
        let buy_sell_ratio = if market.sell_count > 0 {
            market.buy_count as f64 / market.sell_count as f64
        } else if market.buy_count > 0 {
            f64::MAX
        } else {
            0.0
        };
        let net_usd = market.buy_usd - market.sell_usd;

        let market_values: Vec<(&str, f64)> = vec![
            ("insider_market_buy_count", market.buy_count as f64),
            ("insider_market_sell_count", market.sell_count as f64),
            ("insider_market_buy_usd", market.buy_usd),
            ("insider_market_sell_usd", market.sell_usd),
            ("insider_market_buy_sell_ratio", buy_sell_ratio),
            ("insider_market_net_usd", net_usd),
            (
                "insider_market_csuite_buy_count",
                market.csuite_buy_count as f64,
            ),
        ];

        for (asset_id, value) in &market_values {
            if let Ok(decimal) = Decimal::from_str(&value.to_string()) {
                results.push(PriceUpdate {
                    asset_id: asset_id.to_string(),
                    symbol: asset_id.to_string(),
                    value: decimal,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        // Per-ticker metrics
        for (ticker, suffix, _name) in TRACKED_TICKERS {
            let agg = per_ticker
                .get(*suffix)
                .cloned()
                .unwrap_or_default();

            let ticker_net_usd = agg.buy_usd - agg.sell_usd;

            let ticker_values: Vec<(String, f64)> = vec![
                (
                    format!("insider_{}_buy_count", suffix),
                    agg.buy_count as f64,
                ),
                (
                    format!("insider_{}_sell_count", suffix),
                    agg.sell_count as f64,
                ),
                (format!("insider_{}_net_usd", suffix), ticker_net_usd),
            ];

            for (asset_id, value) in &ticker_values {
                if let Ok(decimal) = Decimal::from_str(&value.to_string()) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: format!(
                            "{}_{}",
                            ticker,
                            asset_id.rsplit('_').next().unwrap_or("metric")
                        ),
                        value: decimal,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
        }

        info!("Produced {} SEC insider trading metrics", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for SecInsiderMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let one_pm = today_at_eastern(now, 13, 0);
        if now < one_pm {
            return one_pm;
        }

        let seven_pm = today_at_eastern(now, 19, 0);
        if now < seven_pm {
            return seven_pm;
        }

        // Past 7 PM ET — next trading day at 1 PM
        let next_day = next_us_trading_day(now);
        today_at_eastern(next_day, 13, 0)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_weekend(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

// ── Allow InsiderAggregates to be cloned for per-ticker default lookup ──

impl Clone for InsiderAggregates {
    fn clone(&self) -> Self {
        Self {
            buy_count: self.buy_count,
            sell_count: self.sell_count,
            buy_usd: self.buy_usd,
            sell_usd: self.sell_usd,
            csuite_buy_count: self.csuite_buy_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_count() {
        let market_count = MARKET_ASSETS.len();
        let ticker_count = TRACKED_TICKERS.len() * TICKER_METRICS.len();
        let total = market_count + ticker_count;
        assert_eq!(market_count, 7);
        assert_eq!(ticker_count, 150);
        assert_eq!(total, 157);
    }

    #[test]
    fn test_parse_form4_buy() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ownershipDocument>
    <reportingOwner>
        <reportingOwnerRelationship>
            <officerTitle>VP of Engineering</officerTitle>
            <isOfficer>1</isOfficer>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <transactionAmounts>
                <transactionShares><value>10000</value></transactionShares>
                <transactionPricePerShare><value>150.00</value></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
</ownershipDocument>"#;

        let parsed = parse_form4_xml(xml).expect("should parse");
        assert!(!parsed.is_csuite, "VP of Engineering is not C-suite");
        assert_eq!(parsed.transactions.len(), 1);

        let tx = &parsed.transactions[0];
        assert!(tx.is_buy);
        assert!((tx.shares - 10000.0).abs() < f64::EPSILON);
        assert!((tx.price - 150.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_parse_form4_sell() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ownershipDocument>
    <reportingOwner>
        <reportingOwnerRelationship>
            <officerTitle>Chief Financial Officer</officerTitle>
            <isOfficer>1</isOfficer>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <transactionAmounts>
                <transactionShares><value>5000</value></transactionShares>
                <transactionPricePerShare><value>200.50</value></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
</ownershipDocument>"#;

        let parsed = parse_form4_xml(xml).expect("should parse");
        assert!(parsed.is_csuite, "CFO is C-suite");
        assert_eq!(parsed.transactions.len(), 1);

        let tx = &parsed.transactions[0];
        assert!(!tx.is_buy, "D code = disposed = sell");
        assert!((tx.shares - 5000.0).abs() < f64::EPSILON);
        assert!((tx.price - 200.50).abs() < f64::EPSILON);
    }

    #[test]
    fn test_csuite_detection() {
        assert!(is_csuite_title("Chief Executive Officer"));
        assert!(is_csuite_title("CEO"));
        assert!(is_csuite_title("Chief Financial Officer"));
        assert!(is_csuite_title("CFO"));
        assert!(is_csuite_title("Chief Technology Officer"));
        assert!(is_csuite_title("CTO"));
        assert!(is_csuite_title("Chief Operating Officer"));
        assert!(is_csuite_title("COO"));
        assert!(is_csuite_title("President and CEO"));
        assert!(is_csuite_title("President"));
        assert!(is_csuite_title("Co-Chief Executive Officer"));

        assert!(!is_csuite_title("VP of Engineering"));
        assert!(!is_csuite_title("Director"));
        assert!(!is_csuite_title("General Counsel"));
        assert!(!is_csuite_title("SVP, Marketing"));
        assert!(!is_csuite_title("10% Owner"));
    }

    #[test]
    fn test_cik_matching() {
        // Zero-padding to 10 digits
        assert_eq!(format!("{:010}", 320193_u64), "0000320193");
        assert_eq!(format!("{:010}", 789019_u64), "0000789019");
        assert_eq!(format!("{:010}", 1234567890_u64), "1234567890");
        assert_eq!(format!("{:010}", 1_u64), "0000000001");
    }

    #[test]
    fn test_parse_efts_id() {
        let (accession, doc) =
            parse_efts_id("0001234567-26-000123:filing.xml").expect("should parse");
        assert_eq!(accession, "0001234567-26-000123");
        assert_eq!(doc, "filing.xml");

        // Edge case: doc name with colon-like content after first split
        let (accession2, doc2) =
            parse_efts_id("0001234567-26-000123:path/to/doc.xml").expect("should parse");
        assert_eq!(accession2, "0001234567-26-000123");
        assert_eq!(doc2, "path/to/doc.xml");

        // Invalid: no colon
        assert!(parse_efts_id("no-colon-here").is_none());
    }

    #[test]
    fn test_parse_form4_multiple_transactions() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ownershipDocument>
    <reportingOwner>
        <reportingOwnerRelationship>
            <officerTitle>Chief Executive Officer</officerTitle>
            <isOfficer>1</isOfficer>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <transactionAmounts>
                <transactionShares><value>1000</value></transactionShares>
                <transactionPricePerShare><value>100.00</value></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
        </nonDerivativeTransaction>
        <nonDerivativeTransaction>
            <transactionAmounts>
                <transactionShares><value>500</value></transactionShares>
                <transactionPricePerShare><value>105.00</value></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
</ownershipDocument>"#;

        let parsed = parse_form4_xml(xml).expect("should parse");
        assert!(parsed.is_csuite);
        assert_eq!(parsed.transactions.len(), 2);
        assert!(parsed.transactions[0].is_buy);
        assert!(!parsed.transactions[1].is_buy);
    }

    #[test]
    fn test_parse_form4_no_transactions() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ownershipDocument>
    <reportingOwner>
        <reportingOwnerRelationship>
            <officerTitle>Director</officerTitle>
            <isOfficer>0</isOfficer>
        </reportingOwnerRelationship>
    </reportingOwner>
</ownershipDocument>"#;

        let parsed = parse_form4_xml(xml).expect("should parse");
        assert!(!parsed.is_csuite);
        assert!(parsed.transactions.is_empty());
    }

    #[test]
    fn test_parse_form4_with_namespace() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ns1:ownershipDocument>
    <ns1:reportingOwner>
        <ns1:reportingOwnerRelationship>
            <ns1:officerTitle>President</ns1:officerTitle>
            <ns1:isOfficer>1</ns1:isOfficer>
        </ns1:reportingOwnerRelationship>
    </ns1:reportingOwner>
    <ns1:nonDerivativeTable>
        <ns1:nonDerivativeTransaction>
            <ns1:transactionAmounts>
                <ns1:transactionShares><ns1:value>2000</ns1:value></ns1:transactionShares>
                <ns1:transactionPricePerShare><ns1:value>50.00</ns1:value></ns1:transactionPricePerShare>
                <ns1:transactionAcquiredDisposedCode><ns1:value>A</ns1:value></ns1:transactionAcquiredDisposedCode>
            </ns1:transactionAmounts>
        </ns1:nonDerivativeTransaction>
    </ns1:nonDerivativeTable>
</ns1:ownershipDocument>"#;

        let parsed = parse_form4_xml(xml).expect("should parse with ns1 prefix");
        assert!(parsed.is_csuite);
        assert_eq!(parsed.transactions.len(), 1);
        assert!(parsed.transactions[0].is_buy);
        assert!((parsed.transactions[0].shares - 2000.0).abs() < f64::EPSILON);
    }
}
