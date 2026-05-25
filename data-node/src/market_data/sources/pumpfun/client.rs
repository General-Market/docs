//! Pump.fun token tracker via Jupiter (primary) + DexScreener (fallback discovery).
//!
//! Discovery problem: DexScreener's trending endpoints only expose ~44 tokens,
//! but Vision references thousands of pump.fun mints. The old build deactivated
//! everything missing from each tick's narrow surface, then Vision batches
//! refunded en masse. This rewrite widens the discovery surface using Jupiter's
//! free Lite API — nine category endpoints (toporganicscore/toptraded/toptrending
//! × 5m/1h/24h) yield ~230 unique pump.fun-suffix mints per cycle. Combined with
//! the two DexScreener boost/profile endpoints, the union is broad enough to
//! sustain the existing market universe.
//!
//! Pricing: Jupiter's `/price/v3?ids=…` accepts any mint, batches well (we use
//! 50 per request), and returns USD prices without a key. DexScreener's
//! per-mint endpoint is kept as a fallback path for the 24h volume + liquidity
//! metadata that Jupiter does not publish — but it is no longer on the
//! critical path of producing prices.
//!
//! Both APIs are free / no auth. We rate-limit at 200 req/min (Jupiter is
//! generous but documents no hard cap; this keeps us polite).
//!
//! Asset lifecycle:
//!   - `fetch_assets()` returns a stable corpus: today's discovery ∪ recent
//!     in-memory cache (tokens discovered within the last 24h that still price).
//!     This prevents the SyncEngine's deactivate-anything-not-in-this-list
//!     cascade from gutting the universe on a single bad upstream cycle.
//!   - `fetch_prices()` queries Jupiter for ALL active asset_ids the engine
//!     passes in (in batches of 50), regardless of whether they appear in
//!     today's discovery. Tokens that have actually died will simply not be
//!     priced and the engine's 7-day stale-asset sweep will eventually retire
//!     them.

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::Mutex;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

/// Asset configuration (empty — assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/pumpfun.json");

/// Jupiter Lite API base — free, no auth.
const JUPITER_BASE: &str = "https://lite-api.jup.ag";

/// DexScreener trending endpoints. Narrow but useful for fresh boosts.
const DEXSCREENER_TOP_BOOSTS: &str = "https://api.dexscreener.com/token-boosts/top/v1";
const DEXSCREENER_LATEST_PROFILES: &str = "https://api.dexscreener.com/token-profiles/latest/v1";

/// DexScreener pumpswap search — surfaces pump.fun AMM pairs.
const DEXSCREENER_PUMPSWAP_SEARCH: &str = "https://api.dexscreener.com/latest/dex/search?q=pumpswap";

/// Jupiter discovery categories. Each returns up to 100 tokens; the union
/// across all nine yields ~230 unique pump.fun-suffix mints in practice.
const JUPITER_CATEGORIES: &[&str] = &[
    "toporganicscore/5m",
    "toporganicscore/1h",
    "toporganicscore/24h",
    "toptraded/5m",
    "toptraded/1h",
    "toptraded/24h",
    "toptrending/5m",
    "toptrending/1h",
    "toptrending/24h",
];

/// Jupiter batch size for `/price/v3?ids=…`. URLs stay well under 4KB.
const JUPITER_PRICE_BATCH: usize = 50;

/// Polite delay between consecutive API calls (ms). Jupiter's published limit
/// is documented loosely; this keeps us under any reasonable bucket.
const REQUEST_DELAY_MS: u64 = 200;

/// Soft cap on tracked tokens (sorted by market cap).
const MAX_TRACKED_TOKENS: usize = 600;

/// How long a previously-discovered mint stays in the in-memory cache after
/// it last appeared in any discovery feed. Keeping it for 24h lets us ride
/// through transient single-endpoint failures without deactivating real assets.
const DISCOVERY_CACHE_TTL_HOURS: i64 = 24;

// ── Jupiter types ─────────────────────────────────────────────────────────

/// Jupiter `tokens/v2/<category>/<window>` entry. Schema is permissive —
/// every field except `id` is optional.
#[derive(Debug, Deserialize)]
struct JupToken {
    id: String,
    #[serde(default)]
    symbol: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default, rename = "usdPrice")]
    usd_price: Option<f64>,
    #[serde(default)]
    mcap: Option<f64>,
    #[serde(default)]
    fdv: Option<f64>,
    #[serde(default)]
    liquidity: Option<f64>,
    #[serde(default, rename = "stats24h")]
    stats_24h: Option<JupStats>,
    #[serde(default, rename = "launchpad")]
    launchpad: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JupStats {
    #[serde(default, rename = "buyVolume")]
    buy_volume: Option<f64>,
    #[serde(default, rename = "sellVolume")]
    sell_volume: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct JupPriceEntry {
    #[serde(default, rename = "usdPrice")]
    usd_price: Option<f64>,
    /// Present in the `/price/v3` payload but unused — volume/liquidity now come
    /// from the discovery `stats24h`. Kept so the deserializer documents the
    /// shape and the parse test can assert against it.
    #[serde(default)]
    #[allow(dead_code)]
    liquidity: Option<f64>,
    #[serde(default, rename = "priceChange24h")]
    price_change_24h: Option<f64>,
}

// ── DexScreener types ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct DexTokenEntry {
    #[serde(rename = "chainId")]
    chain_id: String,
    #[serde(rename = "tokenAddress")]
    token_address: String,
}

#[derive(Debug, Deserialize)]
struct DexPairsResponse {
    pairs: Option<Vec<DexPair>>,
}

#[derive(Debug, Deserialize)]
struct DexPair {
    #[serde(rename = "chainId")]
    chain_id: String,
    #[serde(rename = "baseToken")]
    base_token: DexToken,
}

#[derive(Debug, Deserialize)]
struct DexToken {
    address: String,
    symbol: String,
    name: String,
}

// ── Internal model ────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct TokenInfo {
    mint: String,
    symbol: String,
    name: String,
    market_cap: f64,
    /// 24h trading volume in USD, from Jupiter `stats24h` (buy + sell). Drives
    /// the "tokens of the day" ranking — the daily set is the top 10 NEW tokens
    /// by this number. Jupiter's `/price/v3` path doesn't return volume, so we
    /// carry it from discovery and attach it in `fetch_prices`.
    volume_24h: f64,
}

/// Price snapshot from Jupiter `/price/v3`. Only price and 24h change come from
/// this endpoint; volume and market cap are carried from discovery (`TokenInfo`)
/// because `/price/v3` does not publish them.
#[derive(Debug, Clone)]
struct PriceInfo {
    price_usd: f64,
    change_24h: Option<f64>,
}

/// In-memory cache entry: when a mint was last seen in discovery.
#[derive(Debug, Clone)]
struct CachedMint {
    info: TokenInfo,
    last_seen: DateTime<Utc>,
}

// ── Source ────────────────────────────────────────────────────────────────

pub struct PumpfunMarketSource {
    http: SourceHttpClient,
    /// Mint -> (info, last_seen). Survives across sync cycles so we don't
    /// flap the universe when a single discovery endpoint hiccups.
    cache: Mutex<HashMap<String, CachedMint>>,
    /// Read-only handle used solely to pin today's frozen "tokens of the day"
    /// into the active set (see `pinned_daily_mints`). The daily set is chosen
    /// by 24h volume but the tracked universe is capped by market cap, so a
    /// volume-picked token would otherwise age out of the cap, get deactivated,
    /// and lose its price feed mid-day — blanking the page that renders exactly
    /// the batch markets. Pinning keeps the frozen set alive for the whole day.
    pool: PgPool,
}

impl PumpfunMarketSource {
    pub fn new(pool: PgPool) -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("PumpFun source initialized (Jupiter primary, DexScreener fallback discovery)");

        Ok(Self {
            http,
            cache: Mutex::new(HashMap::new()),
            pool,
        })
    }

    /// Today's frozen daily-token mints (`pf_<mint>` stripped to `<mint>`).
    ///
    /// Read-only and best-effort: any DB error or an empty set degrades to "no
    /// pins", which is exactly the pre-pin behaviour — so this can never make
    /// `fetch_assets` fail.
    async fn pinned_daily_mints(&self) -> Vec<String> {
        let today = Utc::now().date_naive();
        let rows: Vec<(String,)> = match sqlx::query_as(
            "SELECT asset_id FROM pumpfun_daily_tokens WHERE utc_date = $1",
        )
        .bind(today)
        .fetch_all(&self.pool)
        .await
        {
            Ok(rows) => rows,
            Err(e) => {
                warn!(%e, "PumpFun: failed to read daily token pins — set may go dark mid-day");
                return Vec::new();
            }
        };
        rows.into_iter()
            .filter_map(|(aid,)| aid.strip_prefix("pf_").map(str::to_string))
            .collect()
    }

    /// Discover pump.fun-suffix mints from Jupiter categories.
    ///
    /// Each category endpoint returns up to 100 tokens. Filter to mints
    /// ending in `pump` (the pump.fun convention) and union across all
    /// categories.
    async fn discover_from_jupiter(&self) -> Vec<TokenInfo> {
        let mut by_mint: HashMap<String, TokenInfo> = HashMap::new();

        for cat in JUPITER_CATEGORIES {
            let url = format!("{}/tokens/v2/{}?limit=100", JUPITER_BASE, cat);
            match self.http.get_json::<Vec<JupToken>>(&url).await {
                Ok(tokens) => {
                    let mut added = 0;
                    for t in tokens {
                        if !is_pumpfun_mint(&t.id) {
                            continue;
                        }
                        let mcap = t.mcap.or(t.fdv).unwrap_or(0.0);
                        let vol = t
                            .stats_24h
                            .as_ref()
                            .map(|s| s.buy_volume.unwrap_or(0.0) + s.sell_volume.unwrap_or(0.0))
                            .unwrap_or(0.0);
                        let info = TokenInfo {
                            mint: t.id.clone(),
                            symbol: t.symbol.unwrap_or_else(|| "PUMP".to_string()),
                            name: t.name.unwrap_or_else(|| t.id.clone()),
                            market_cap: mcap,
                            volume_24h: vol,
                        };
                        // Highest mcap wins on collision; keep the largest volume
                        // seen across categories so the daily ranking has the
                        // fullest 24h picture (different windows report different
                        // slices of the day).
                        by_mint
                            .entry(t.id)
                            .and_modify(|e| {
                                if mcap > e.market_cap {
                                    e.market_cap = mcap;
                                }
                                if vol > e.volume_24h {
                                    e.volume_24h = vol;
                                }
                            })
                            .or_insert_with(|| {
                                added += 1;
                                info
                            });
                    }
                    debug!("PumpFun: Jupiter {} added {} new mints", cat, added);
                }
                Err(e) => {
                    warn!("PumpFun: Jupiter {} failed: {:?}", cat, e);
                }
            }
            tokio::time::sleep(Duration::from_millis(REQUEST_DELAY_MS)).await;
        }

        info!(
            "PumpFun: Jupiter discovery yielded {} unique pump.fun mints",
            by_mint.len()
        );
        by_mint.into_values().collect()
    }

    /// Discover pump.fun mints from DexScreener trending endpoints + pumpswap
    /// pair search. Narrow surface (~50–70 unique) but catches boost-promoted
    /// tokens Jupiter sometimes ranks below the top-100 cutoff.
    async fn discover_from_dexscreener(&self) -> Vec<String> {
        let mut mints = HashSet::new();

        // Trending boosts + recent profiles.
        for (label, url) in &[
            ("top-boosts", DEXSCREENER_TOP_BOOSTS),
            ("latest-profiles", DEXSCREENER_LATEST_PROFILES),
        ] {
            match self.http.get_json::<Vec<DexTokenEntry>>(url).await {
                Ok(entries) => {
                    for e in entries {
                        if e.chain_id == "solana" && is_pumpfun_mint(&e.token_address) {
                            mints.insert(e.token_address);
                        }
                    }
                }
                Err(e) => warn!("PumpFun: DexScreener {} failed: {:?}", label, e),
            }
            tokio::time::sleep(Duration::from_millis(REQUEST_DELAY_MS)).await;
        }

        // Pumpswap pair search — surfaces actively-traded pump.fun base tokens.
        match self.http.get_json::<DexPairsResponse>(DEXSCREENER_PUMPSWAP_SEARCH).await {
            Ok(resp) => {
                if let Some(pairs) = resp.pairs {
                    for p in pairs {
                        if p.chain_id == "solana" && is_pumpfun_mint(&p.base_token.address) {
                            mints.insert(p.base_token.address);
                        }
                    }
                }
            }
            Err(e) => warn!("PumpFun: DexScreener pumpswap search failed: {:?}", e),
        }
        tokio::time::sleep(Duration::from_millis(REQUEST_DELAY_MS)).await;

        debug!("PumpFun: DexScreener discovery yielded {} mints", mints.len());
        mints.into_iter().collect()
    }

    /// Fetch USD prices in batches from Jupiter `/price/v3`. Returns a map
    /// keyed by mint address. Missing mints simply do not appear in the map.
    async fn fetch_jupiter_prices(&self, mints: &[String]) -> HashMap<String, PriceInfo> {
        let mut out: HashMap<String, PriceInfo> = HashMap::new();

        for chunk in mints.chunks(JUPITER_PRICE_BATCH) {
            let url = format!("{}/price/v3?ids={}", JUPITER_BASE, chunk.join(","));
            match self.http.get_json::<HashMap<String, JupPriceEntry>>(&url).await {
                Ok(prices) => {
                    for (mint, entry) in prices {
                        let price = match entry.usd_price {
                            Some(p) if p > 0.0 && p.is_finite() => p,
                            _ => continue,
                        };
                        out.insert(
                            mint,
                            PriceInfo {
                                price_usd: price,
                                change_24h: entry.price_change_24h,
                            },
                        );
                    }
                }
                Err(e) => warn!("PumpFun: Jupiter price batch failed: {:?}", e),
            }
            tokio::time::sleep(Duration::from_millis(REQUEST_DELAY_MS)).await;
        }

        out
    }

    /// Update the in-memory discovery cache with this cycle's findings.
    /// Prunes entries older than `DISCOVERY_CACHE_TTL_HOURS`.
    fn refresh_cache(&self, fresh: &[TokenInfo]) -> Vec<TokenInfo> {
        let now = Utc::now();
        let cutoff = now - chrono::Duration::hours(DISCOVERY_CACHE_TTL_HOURS);

        let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());

        for info in fresh {
            cache.insert(
                info.mint.clone(),
                CachedMint {
                    info: info.clone(),
                    last_seen: now,
                },
            );
        }

        cache.retain(|_, v| v.last_seen >= cutoff);

        cache.values().map(|c| c.info.clone()).collect()
    }
}

fn is_pumpfun_mint(addr: &str) -> bool {
    addr.len() > 20 && addr.ends_with("pump")
}

#[async_trait::async_trait]
impl MarketDataSource for PumpfunMarketSource {
    fn source_id(&self) -> &'static str {
        "pumpfun"
    }

    fn display_name(&self) -> &'static str {
        "Pump.fun Tokens"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes — matches sources-display.json
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // Static config takes precedence (currently empty — assets are dynamic).
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // 1. Jupiter categories — primary, broad surface with metadata.
        let mut tokens = self.discover_from_jupiter().await;
        let jup_mints: HashSet<String> = tokens.iter().map(|t| t.mint.clone()).collect();

        // 2. DexScreener trending — supplements with boost-promoted tokens.
        //    For mints Jupiter didn't return, we still want them tracked, so
        //    insert a placeholder TokenInfo; pricing will fill in details.
        let dex_mints = self.discover_from_dexscreener().await;
        for mint in dex_mints {
            if !jup_mints.contains(&mint) {
                tokens.push(TokenInfo {
                    mint: mint.clone(),
                    symbol: "PUMP".to_string(),
                    name: mint.clone(),
                    market_cap: 0.0,
                    volume_24h: 0.0,
                });
            }
        }

        // 3. Merge into rolling 24h cache. The returned set is the union of
        //    this cycle and the last 24h of discovery — protects against the
        //    deactivation cascade on a single bad upstream tick.
        let mut all = self.refresh_cache(&tokens);

        // 4. Cap total tracked count by descending market cap to keep the
        //    universe bounded.
        all.sort_by(|a, b| {
            b.market_cap
                .partial_cmp(&a.market_cap)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        all.truncate(MAX_TRACKED_TOKENS);

        let mut assets: Vec<AssetUpdate> = all
            .iter()
            .map(|t| build_asset_update(&t.mint, &t.symbol, &t.name))
            .collect();

        // Pin today's frozen "tokens of the day" so they stay active for the
        // whole UTC day. They were chosen by 24h volume and may not be in the
        // market-cap-capped set above; without this they'd be deactivated by
        // sync_assets and stop being priced, blanking the pumpfun page (which
        // renders exactly the batch markets). Re-emit any pinned mint not
        // already present, reusing cached metadata when we still have it.
        let present: HashSet<String> = assets.iter().map(|a| a.asset_id.clone()).collect();
        let pinned = self.pinned_daily_mints().await;
        let mut pinned_added = 0usize;
        for mint in &pinned {
            let asset_id = format!("pf_{mint}");
            if present.contains(&asset_id) {
                continue;
            }
            let (symbol, name) = {
                let cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
                cache
                    .get(mint)
                    .map(|c| (c.info.symbol.clone(), c.info.name.clone()))
                    .unwrap_or_else(|| ("PUMP".to_string(), mint.clone()))
            };
            assets.push(build_asset_update(mint, &symbol, &name));
            pinned_added += 1;
        }

        info!(
            "PumpFun fetch_assets: {} tokens (jup={}, dex+jup unique={}, cached total={}, daily-pinned={})",
            assets.len(),
            jup_mints.len(),
            tokens.len(),
            all.len(),
            pinned_added,
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Decode `pf_<mint>` -> mint, keep a back-lookup for asset_id.
        let mut mint_to_asset: HashMap<String, &str> = HashMap::new();
        for aid in asset_ids {
            if let Some(mint) = aid.strip_prefix("pf_") {
                mint_to_asset.insert(mint.to_string(), aid.as_str());
            }
        }
        if mint_to_asset.is_empty() {
            return Ok(Vec::new());
        }

        let mints: Vec<String> = mint_to_asset.keys().cloned().collect();
        let prices = self.fetch_jupiter_prices(&mints).await;

        // Pull symbol/name from the in-memory cache when available so the
        // PriceUpdate matches the AssetUpdate. Missing entries fall back to
        // a generic PF symbol.
        let cache = self.cache.lock().unwrap_or_else(|e| e.into_inner()).clone();

        let mut results = Vec::with_capacity(prices.len());
        for (mint, p) in &prices {
            let Some(&asset_id) = mint_to_asset.get(mint) else {
                continue;
            };
            // Symbol, 24h volume, and market cap come from the discovery cache —
            // Jupiter's `/price/v3` returns none of them. The cache is populated
            // by `discover_from_jupiter`, which reads `stats24h` + `mcap`. The
            // "tokens of the day" ranking is built on this volume figure, so
            // emitting it (instead of 0) is what makes the daily selection work.
            let cached = cache.get(mint).map(|c| &c.info);
            let symbol = cached
                .map(|c| c.symbol.clone())
                .unwrap_or_else(|| "PUMP".to_string());
            let cached_volume = cached.map(|c| c.volume_24h).unwrap_or(0.0);
            let cached_mcap = cached.map(|c| c.market_cap).unwrap_or(0.0);

            let price = Decimal::from_str(&format!("{:.10}", p.price_usd)).unwrap_or(Decimal::ZERO);
            let change_pct = p
                .change_24h
                .and_then(|v| Decimal::from_str(&format!("{:.6}", v)).ok());
            let volume = (cached_volume > 0.0)
                .then(|| Decimal::from_str(&format!("{:.2}", cached_volume)).ok())
                .flatten();
            let mcap = (cached_mcap > 0.0)
                .then(|| Decimal::from_str(&format!("{:.2}", cached_mcap)).ok())
                .flatten();

            results.push(PriceUpdate {
                asset_id: asset_id.to_string(),
                symbol: format!("PF:{}", symbol),
                value: price,
                prev_close: None,
                change_pct,
                volume_24h: volume,
                market_cap: mcap,
                fetched_at: now,
            });
        }

        info!(
            "PumpFun fetched {}/{} prices (Jupiter price/v3, liquidity hint when present)",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::FAST_VOLATILE
    }
}

fn short_mint(mint: &str) -> String {
    if mint.len() > 8 {
        format!("{}..{}", &mint[..4], &mint[mint.len() - 4..])
    } else {
        mint.to_string()
    }
}

/// Build the `AssetUpdate` for a pump.fun mint. Shared by discovery and the
/// daily-pin path so both emit an identical shape (`pf_<mint>` id, `PF:` symbol,
/// `name (short)` label, pumpfun metadata).
fn build_asset_update(mint: &str, symbol: &str, name: &str) -> AssetUpdate {
    AssetUpdate {
        asset_id: format!("pf_{mint}"),
        symbol: format!("PF:{symbol}"),
        name: format!("{} ({})", name, short_mint(mint)),
        category: Some("crypto".to_string()),
        metadata: serde_json::json!({
            "api_ref": mint,
            "subcategory": "pumpfun",
            "active": true,
            "extra": {
                "chain": "solana",
                "program": "pump.fun",
            },
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    /// A source backed by a lazily-connected pool. The unit tests here only
    /// exercise pure logic (source_id, the in-memory cache) and never run a
    /// query, so the pool never actually connects — no live DB required.
    fn test_source() -> PumpfunMarketSource {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://localhost/pumpfun_test")
            .expect("lazy pool");
        PumpfunMarketSource::new(pool).unwrap()
    }

    #[test]
    fn test_source_id() {
        let s = test_source();
        assert_eq!(s.source_id(), "pumpfun");
    }

    #[test]
    fn test_is_pumpfun_mint() {
        assert!(is_pumpfun_mint(
            "25ursUJufyybDGdg4AhLXeZfnwDvyawTRhd3bqWVpump"
        ));
        // Pump.fun's own protocol token doesn't end in "pump" — and the suffix
        // check is what we want anyway; it's not a tracked memecoin.
        assert!(!is_pumpfun_mint("pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn"));
        assert!(!is_pumpfun_mint("short"));
        assert!(!is_pumpfun_mint("notapumpaddress"));
    }

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty(), "Config should be empty -- assets are dynamic");
    }

    #[test]
    fn test_short_mint() {
        let m = "25ursUJufyybDGdg4AhLXeZfnwDvyawTRhd3bqWVpump";
        assert_eq!(short_mint(m), "25ur..pump");
        assert_eq!(short_mint("abc"), "abc");
    }

    #[test]
    fn test_jupiter_token_parse_stats24h_volume() {
        // The daily ranking sums buyVolume + sellVolume from stats24h.
        let json = r#"{
            "id": "3hRBXuscbbfmpuLwjvCbDZBSRSqg7JiGD2xS4Ra4pump",
            "symbol": "ANTIPUMP",
            "mcap": 96035.86,
            "stats24h": { "buyVolume": 12000.5, "sellVolume": 8000.25 }
        }"#;
        let t: JupToken = serde_json::from_str(json).unwrap();
        let vol = t
            .stats_24h
            .as_ref()
            .map(|s| s.buy_volume.unwrap_or(0.0) + s.sell_volume.unwrap_or(0.0))
            .unwrap_or(0.0);
        assert!((vol - 20000.75).abs() < 1e-6);
    }

    #[test]
    fn test_jupiter_token_parse() {
        let json = r#"{
            "id": "3hRBXuscbbfmpuLwjvCbDZBSRSqg7JiGD2xS4Ra4pump",
            "symbol": "ANTIPUMP",
            "name": "Anti Pump",
            "usdPrice": 0.00000861,
            "mcap": 96035.86,
            "liquidity": 12345.0
        }"#;
        let t: JupToken = serde_json::from_str(json).unwrap();
        assert_eq!(t.symbol.as_deref(), Some("ANTIPUMP"));
        assert!(is_pumpfun_mint(&t.id));
        assert_eq!(t.usd_price, Some(0.00000861));
    }

    #[test]
    fn test_jupiter_token_parse_minimal() {
        let json = r#"{"id":"3hRBXuscbbfmpuLwjvCbDZBSRSqg7JiGD2xS4Ra4pump"}"#;
        let t: JupToken = serde_json::from_str(json).unwrap();
        assert_eq!(t.id.len(), 44);
        assert!(t.symbol.is_none());
        assert!(t.usd_price.is_none());
    }

    #[test]
    fn test_jupiter_price_parse() {
        let json = r#"{"pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn":{
            "createdAt":"2025-07-10T13:10:28Z",
            "liquidity":20042463.5,
            "usdPrice":0.001745,
            "priceChange24h":-1.9
        }}"#;
        let m: HashMap<String, JupPriceEntry> = serde_json::from_str(json).unwrap();
        let e = m.values().next().unwrap();
        assert_eq!(e.usd_price, Some(0.001745));
        assert_eq!(e.liquidity, Some(20042463.5));
        assert_eq!(e.price_change_24h, Some(-1.9));
    }

    #[test]
    fn test_cache_ttl_prunes_old_entries() {
        let s = test_source();
        let fresh = vec![TokenInfo {
            mint: "AAAApump".to_string(),
            symbol: "A".into(),
            name: "A".into(),
            market_cap: 1.0,
            volume_24h: 0.0,
        }];
        let out = s.refresh_cache(&fresh);
        assert_eq!(out.len(), 1);

        // Simulate an old entry by reaching in and back-dating it.
        {
            let mut cache = s.cache.lock().unwrap();
            cache.insert(
                "OLDpump".into(),
                CachedMint {
                    info: TokenInfo {
                        mint: "OLDpump".into(),
                        symbol: "O".into(),
                        name: "O".into(),
                        market_cap: 1.0,
                        volume_24h: 0.0,
                    },
                    last_seen: Utc::now() - chrono::Duration::hours(48),
                },
            );
        }
        let out = s.refresh_cache(&fresh);
        assert!(out.iter().all(|t| t.mint != "OLDpump"));
        assert!(out.iter().any(|t| t.mint == "AAAApump"));
    }
}
