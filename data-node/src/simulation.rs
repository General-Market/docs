use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use chrono::NaiveDate;
use serde::Serialize;
use sqlx::PgPool;
use tokio::sync::mpsc;
use tracing::info;

use crate::db;

// ---- Global simulation data cache (loaded once at startup) ----

/// All market data preloaded into memory at startup.
/// Shared across all simulation requests via Arc.
/// Precomputed category info for instant /sim/categories responses.
#[derive(Clone, Serialize)]
pub struct CachedCategoryInfo {
    pub id: String,
    pub name: String,
    pub coin_count: usize,
    pub market_cap: Option<f64>,
    #[serde(default = "default_source")]
    pub source: String,
}

fn default_source() -> String {
    "coingecko".to_string()
}

/// DeFi metrics for a single coin (keyed by gecko_id).
#[derive(Debug, Clone, Default, Serialize)]
pub struct DefiCoinMetrics {
    pub tvl: f64,
    pub tvl_change_7d: f64,
    pub fees_24h: f64,
    pub revenue_24h: f64,
    pub volume_24h: f64,
    pub max_yield_apy: f64,
    pub total_funding_m: f64,
    pub latest_funding_m: f64,
    pub latest_round: Option<String>,
    pub latest_valuation_m: Option<f64>,
    pub investor_count: usize,
    pub lead_investors: Vec<String>,
}

/// Daily DeFi metrics snapshot for history-based strategies.
#[derive(Debug, Clone, Default)]
pub struct DefiDayMetrics {
    pub tvl: f64,
    pub fees: f64,
    pub volume: f64,
}


pub struct SimDataCache {
    /// All unique snapshot dates, sorted ascending.
    pub all_dates: Vec<NaiveDate>,
    /// category_id → set of coin_ids
    pub category_coins: HashMap<String, Vec<String>>,
    /// coin_id → uppercase CG symbol
    pub coin_symbol_map: HashMap<String, String>,
    /// Bitget listings: uppercase symbol → listing row
    pub bitget_lookup: HashMap<String, db::BitgetListingRow>,
    /// coin_id → { date → price_usd } for O(1) daily price lookups
    pub prices: HashMap<String, HashMap<NaiveDate, f64>>,
    /// date → Vec<CoinSnapshot> sorted by mcap DESC
    pub mcap_rankings: HashMap<NaiveDate, Vec<CoinSnapshot>>,
    /// Precomputed category list with eligible coin counts (sorted by mcap).
    pub categories: Vec<CachedCategoryInfo>,
    /// gecko_id → current DeFi metrics (from DefiLlama).
    pub defi_metrics: HashMap<String, DefiCoinMetrics>,
    /// gecko_id → { date → DefiDayMetrics } (history for TVL/fees/volume strategies).
    pub defi_history: HashMap<String, HashMap<NaiveDate, DefiDayMetrics>>,
    /// FNG index: date → value (0-100).
    pub fng_index: HashMap<NaiveDate, i32>,
    /// BTC dominance: date → percentage (0.0-100.0).
    pub btc_dominance: HashMap<NaiveDate, f64>,
    /// ETH dominance: date → percentage (0.0-100.0).
    pub eth_dominance: HashMap<NaiveDate, f64>,
}

impl SimDataCache {
    /// Load all simulation data from the database. Called once at startup.
    /// Approach: Bitget-first — only load data for coins ever listed on Bitget.
    pub async fn load(pool: &PgPool) -> Result<Arc<Self>, SimError> {
        let t0 = std::time::Instant::now();

        // 1. Load Bitget listings FIRST — this is the universe of tradeable coins.
        //    Includes delisted coins (needed for historical simulation).
        let all_listings = db::bitget_query_listings(pool, None).await?;
        let bitget_lookup = build_bitget_lookup(&all_listings);
        // Collect unique Bitget base_coin symbols (uppercase)
        let bitget_symbols: Vec<String> = bitget_lookup.keys().cloned().collect();
        let t1 = t0.elapsed().as_millis();

        // 2. Map Bitget symbols → CoinGecko coin_ids (fast LATERAL query for ~700 symbols)
        let sym_rows = db::cg_query_coin_symbols_for_bitget(pool, &bitget_symbols).await?;
        let coin_symbol_map: HashMap<String, String> = sym_rows
            .into_iter()
            .map(|(coin_id, sym)| (coin_id, sym.to_uppercase()))
            .collect();
        let eligible_coin_ids: Vec<String> = coin_symbol_map.keys().cloned().collect();
        let t2 = t0.elapsed().as_millis();

        // 3. Load all snapshot dates (recursive CTE skip-scan)
        let all_dates = db::cg_query_snapshot_dates(pool).await?;
        let t3 = t0.elapsed().as_millis();

        // 4. Load all category→coin mappings + category metadata
        let cat_coins_raw = db::cg_query_all_category_coins(pool).await?;
        let mut category_coins: HashMap<String, Vec<String>> = HashMap::new();
        for (cat_id, coin_id) in &cat_coins_raw {
            category_coins.entry(cat_id.clone()).or_default().push(coin_id.clone());
        }
        let cat_meta = db::cg_query_all_categories(pool).await?;
        let t4 = t0.elapsed().as_millis();

        // 5. Bulk-load prices+mcap for Bitget-eligible coins only (~700 coins, ~1M rows)
        let bulk_rows = db::cg_query_all_prices_for_coins(pool, &eligible_coin_ids).await?;
        let t5 = t0.elapsed().as_millis();

        // 6. Build in-memory price + mcap caches
        let mut prices: HashMap<String, HashMap<NaiveDate, f64>> = HashMap::new();
        let mut mcap_rankings: HashMap<NaiveDate, Vec<CoinSnapshot>> = HashMap::new();

        for (coin_id, date, price, mcap_opt) in &bulk_rows {
            prices.entry(coin_id.clone()).or_default().insert(*date, *price);
            mcap_rankings.entry(*date).or_default().push(CoinSnapshot {
                coin_id: coin_id.clone(),
                price: *price,
                mcap: mcap_opt.unwrap_or(0.0),
            });
        }

        // Sort mcap rankings per date
        for rankings in mcap_rankings.values_mut() {
            rankings.sort_by(|a, b| b.mcap.partial_cmp(&a.mcap).unwrap_or(std::cmp::Ordering::Equal));
        }

        // 7. Precompute category info with eligible coin counts
        //    A coin is "eligible" if it's in the cache (has prices + Bitget listing).
        let eligible_set: HashSet<&String> = coin_symbol_map.keys().collect();

        // Add synthetic "all" category containing every eligible coin
        let all_coin_ids: Vec<String> = eligible_set.iter().map(|s| (*s).clone()).collect();
        let all_count = all_coin_ids.len();
        category_coins.insert("all".to_string(), all_coin_ids);

        // CoinGecko categories
        let mut categories: Vec<CachedCategoryInfo> = cat_meta.into_iter()
            .filter_map(|row| {
                let eligible_count = category_coins.get(&row.id)
                    .map(|coins| coins.iter().filter(|c| eligible_set.contains(c)).count())
                    .unwrap_or(0);
                if eligible_count >= 5 {
                    Some(CachedCategoryInfo {
                        id: row.id, name: row.name, coin_count: eligible_count,
                        market_cap: row.market_cap, source: "coingecko".to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();

        // Sort by coin_count DESC, then insert "All" at the top
        categories.sort_by(|a, b| b.coin_count.cmp(&a.coin_count));
        categories.insert(0, CachedCategoryInfo {
            id: "all".to_string(),
            name: "All Eligible Coins".to_string(),
            coin_count: all_count,
            market_cap: None,
            source: "coingecko".to_string(),
        });

        let t6 = t0.elapsed().as_millis();

        // 8. Load DefiLlama data
        let mut defi_metrics: HashMap<String, DefiCoinMetrics> = HashMap::new();
        let mut defi_history: HashMap<String, HashMap<NaiveDate, DefiDayMetrics>> = HashMap::new();

        // Build slug→gecko_id mapping
        let dl_protocols = db::dl_query_protocols_with_gecko_id(pool).await.unwrap_or_default();
        let mut slug_to_gecko: HashMap<String, String> = HashMap::new();
        let mut gecko_to_slug: HashMap<String, String> = HashMap::new();

        for (slug, gecko_id, category, tvl, tvl_change_7d, _mcap) in &dl_protocols {
            slug_to_gecko.insert(slug.clone(), gecko_id.clone());
            gecko_to_slug.insert(gecko_id.clone(), slug.clone());

            // Build base metrics from protocol data
            let entry = defi_metrics.entry(gecko_id.clone()).or_default();
            entry.tvl = tvl.unwrap_or(0.0);
            entry.tvl_change_7d = tvl_change_7d.unwrap_or(0.0);

            // Build DeFi sector categories (dl-dexes, dl-lending, etc.)
            if let Some(cat) = category {
                let cat_id = format!("dl-{}", cat.to_lowercase().replace(' ', "-").replace('/', "-"));
                category_coins.entry(cat_id).or_default().push(gecko_id.clone());
            }
        }

        // Load fees/revenue/volume metrics
        for metric_type in &["fees", "revenue", "volume"] {
            let metrics = db::dl_query_latest_metrics_by_type(pool, metric_type).await.unwrap_or_default();
            for (slug, v24h, _v7d, _v30d) in &metrics {
                if let Some(gecko_id) = slug_to_gecko.get(slug) {
                    let entry = defi_metrics.entry(gecko_id.clone()).or_default();
                    match *metric_type {
                        "fees" => entry.fees_24h = v24h.unwrap_or(0.0),
                        "revenue" => entry.revenue_24h = v24h.unwrap_or(0.0),
                        "volume" => entry.volume_24h = v24h.unwrap_or(0.0),
                        _ => {}
                    }
                }
            }
        }

        // Load yield data (max APY per project → gecko_id)
        let yield_data = db::dl_query_max_yield_by_project(pool).await.unwrap_or_default();
        for (project, max_apy) in &yield_data {
            // Project names often match slug
            if let Some(gecko_id) = slug_to_gecko.get(project) {
                let entry = defi_metrics.entry(gecko_id.clone()).or_default();
                entry.max_yield_apy = *max_apy;
            }
        }

        // Load raises data
        let all_dl_ids: Vec<String> = slug_to_gecko.keys().cloned().collect();
        let raises = db::dl_query_raises_for_slugs(pool, &all_dl_ids).await.unwrap_or_default();
        for (dl_id, round, amount_m, valuation_m, _date, lead_inv, _other_inv) in &raises {
            if let Some(gecko_id) = slug_to_gecko.get(dl_id.as_str()) {
                let entry = defi_metrics.entry(gecko_id.clone()).or_default();
                if let Some(amt) = amount_m {
                    entry.total_funding_m += amt;
                    // Track latest
                    if entry.latest_funding_m == 0.0 {
                        entry.latest_funding_m = *amt;
                        entry.latest_round = round.clone();
                        entry.latest_valuation_m = *valuation_m;
                        entry.lead_investors = lead_inv.clone();
                    }
                }
                entry.investor_count += lead_inv.len();
            }
        }

        // Load history for eligible protocols (only those with gecko_id matching our coins)
        let eligible_slugs: Vec<String> = eligible_set.iter()
            .filter_map(|gid| gecko_to_slug.get(*gid).cloned())
            .collect();
        if !eligible_slugs.is_empty() {
            let history_rows = db::dl_query_all_history_for_slugs(pool, &eligible_slugs).await.unwrap_or_default();
            for (slug, date, metric_type, value) in &history_rows {
                if let Some(gecko_id) = slug_to_gecko.get(slug) {
                    let day_entry = defi_history
                        .entry(gecko_id.clone())
                        .or_default()
                        .entry(*date)
                        .or_default();
                    match metric_type.as_str() {
                        "tvl" => day_entry.tvl = *value,
                        "fees" => day_entry.fees = *value,
                        "volume" => day_entry.volume = *value,
                        _ => {}
                    }
                }
            }
        }

        let t7 = t0.elapsed().as_millis();

        // 9. Generate DefiLlama categories (sector + FA)
        // Sector categories: auto-generated from DL category field
        let mut dl_category_set: HashSet<String> = HashSet::new();
        for cat_coins in category_coins.keys() {
            if cat_coins.starts_with("dl-") {
                dl_category_set.insert(cat_coins.clone());
            }
        }

        // Human-readable names for DL categories
        let dl_cat_names: HashMap<&str, &str> = [
            ("dl-dexes", "DEXes"), ("dl-lending", "Lending"), ("dl-derivatives", "Derivatives"),
            ("dl-bridge", "Bridges"), ("dl-liquid-staking", "Liquid Staking"), ("dl-cdp", "CDP"),
            ("dl-yield", "Yield"), ("dl-rwa", "RWA"), ("dl-yield-aggregator", "Yield Aggregator"),
            ("dl-liquidity-manager", "Liquidity Manager"), ("dl-farm", "Farms"),
            ("dl-launchpad", "Launchpad"), ("dl-cross-chain", "Cross Chain"),
            ("dl-options", "Options"), ("dl-nft-lending", "NFT Lending"),
            ("dl-insurance", "Insurance"), ("dl-indexes", "Indexes"),
            ("dl-prediction-market", "Prediction Market"), ("dl-synthetics", "Synthetics"),
            ("dl-privacy", "Privacy"), ("dl-payments", "Payments"),
            ("dl-staking-pool", "Staking Pool"), ("dl-services", "Services"),
        ].into_iter().collect();

        for cat_id in &dl_category_set {
            let eligible_count = category_coins.get(cat_id)
                .map(|coins| coins.iter().filter(|c| eligible_set.contains(c)).count())
                .unwrap_or(0);
            if eligible_count >= 5 {
                let name = dl_cat_names.get(cat_id.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| {
                        cat_id.strip_prefix("dl-").unwrap_or(cat_id)
                            .split('-')
                            .map(|w| {
                                let mut c = w.chars();
                                match c.next() {
                                    Some(f) => f.to_uppercase().to_string() + c.as_str(),
                                    None => String::new(),
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(" ")
                    });
                categories.push(CachedCategoryInfo {
                    id: cat_id.clone(),
                    name,
                    coin_count: eligible_count,
                    market_cap: None,
                    source: "defillama".to_string(),
                });
            }
        }

        // FA sub-categories: ranked by DeFi metrics
        let fa_categories = build_fa_categories(&defi_metrics, &eligible_set);
        for (cat_id, cat_name, coin_ids) in &fa_categories {
            if !coin_ids.is_empty() {
                categories.push(CachedCategoryInfo {
                    id: cat_id.clone(),
                    name: cat_name.clone(),
                    coin_count: coin_ids.len(),
                    market_cap: None,
                    source: "defillama".to_string(),
                });
                category_coins.insert(cat_id.clone(), coin_ids.clone());
            }
        }

        let t8 = t0.elapsed().as_millis();
        let dl_cats = categories.iter().filter(|c| c.source == "defillama").count();

        // 9. Load FNG index
        let fng_rows = db::fng_query_all(pool).await.unwrap_or_default();
        let fng_index: HashMap<NaiveDate, i32> = fng_rows.into_iter()
            .map(|(d, v, _)| (d, v))
            .collect();
        let t9 = t0.elapsed().as_millis();

        // 10. Compute BTC/ETH dominance from mcap_rankings
        let mut btc_dominance: HashMap<NaiveDate, f64> = HashMap::new();
        let mut eth_dominance: HashMap<NaiveDate, f64> = HashMap::new();
        for (date, coins) in &mcap_rankings {
            let total_mcap: f64 = coins.iter().map(|c| c.mcap).sum();
            if total_mcap > 0.0 {
                let btc_mcap = coins.iter()
                    .find(|c| c.coin_id == "bitcoin")
                    .map(|c| c.mcap)
                    .unwrap_or(0.0);
                let eth_mcap = coins.iter()
                    .find(|c| c.coin_id == "ethereum")
                    .map(|c| c.mcap)
                    .unwrap_or(0.0);
                btc_dominance.insert(*date, btc_mcap / total_mcap * 100.0);
                eth_dominance.insert(*date, eth_mcap / total_mcap * 100.0);
            }
        }
        let t10 = t0.elapsed().as_millis();

        let t11 = t0.elapsed().as_millis();

        info!(
            t1_bitget_ms = t1,
            t2_symbols_ms = t2 - t1,
            t3_dates_ms = t3 - t2,
            t4_cats_ms = t4 - t3,
            t5_bulk_ms = t5 - t4,
            t6_cg_cats_ms = t6 - t5,
            t7_defi_ms = t7 - t6,
            t8_dl_cats_ms = t8 - t7,
            t9_fng_ms = t9 - t8,
            t10_dom_ms = t10 - t9,
            eligible_coins = eligible_coin_ids.len(),
            bitget_symbols = bitget_symbols.len(),
            bulk_rows = bulk_rows.len(),
            cg_categories = categories.len() - dl_cats,
            dl_categories = dl_cats,
            defi_coins = defi_metrics.len(),
            defi_history_coins = defi_history.len(),
            fng_days = fng_index.len(),
            total_ms = t11,
            "SimDataCache loaded (Bitget-first + DefiLlama + FNG)"
        );

        Ok(Arc::new(Self {
            all_dates,
            category_coins,
            coin_symbol_map,
            bitget_lookup,
            prices,
            mcap_rankings,
            categories,
            defi_metrics,
            defi_history,
            fng_index,
            btc_dominance,
            eth_dominance,
        }))
    }

    /// Build price history for momentum/vol strategies from the cached prices.
    pub fn build_price_history(&self, coin_ids: &[String]) -> HashMap<String, Vec<(NaiveDate, f64)>> {
        let mut history = HashMap::new();
        for coin_id in coin_ids {
            if let Some(date_map) = self.prices.get(coin_id) {
                let mut series: Vec<(NaiveDate, f64)> = date_map.iter()
                    .map(|(d, p)| (*d, *p))
                    .collect();
                series.sort_by_key(|(d, _)| *d);
                history.insert(coin_id.clone(), series);
            }
        }
        history
    }
}

/// Build FA (fundamental analysis) sub-categories from DeFi metrics.
/// Returns Vec of (category_id, category_name, Vec<coin_ids>).
fn build_fa_categories(
    defi_metrics: &HashMap<String, DefiCoinMetrics>,
    eligible_set: &HashSet<&String>,
) -> Vec<(String, String, Vec<String>)> {
    let top_n = 50usize;
    let mut result = Vec::new();

    // Helper: sort eligible coins by a metric, take top N
    let mut rank_by = |metric_fn: &dyn Fn(&DefiCoinMetrics) -> f64, cat_id: &str, cat_name: &str| {
        let mut scored: Vec<(String, f64)> = defi_metrics.iter()
            .filter(|(gid, _)| eligible_set.contains(gid))
            .map(|(gid, m)| (gid.clone(), metric_fn(m)))
            .filter(|(_, v)| *v > 0.0)
            .collect();
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let coin_ids: Vec<String> = scored.into_iter().take(top_n).map(|(id, _)| id).collect();
        if coin_ids.len() >= 5 {
            result.push((cat_id.to_string(), cat_name.to_string(), coin_ids));
        }
    };

    rank_by(&|m| m.tvl, "dl-fa-top-tvl", "Top TVL");
    rank_by(&|m| m.fees_24h, "dl-fa-top-fees", "Top Fees");
    rank_by(&|m| m.revenue_24h, "dl-fa-top-revenue", "Top Revenue");
    rank_by(&|m| m.volume_24h, "dl-fa-top-volume", "Top Volume");
    rank_by(&|m| m.tvl_change_7d, "dl-fa-tvl-momentum", "TVL Momentum");
    rank_by(&|m| if m.tvl > 0.0 { m.fees_24h / m.tvl } else { 0.0 }, "dl-fa-fee-efficiency", "Fee Efficiency");
    rank_by(&|m| m.max_yield_apy, "dl-fa-top-yield", "Top Yield");

    result
}

// ---- Types ----

#[derive(Debug, Clone, Serialize, Default)]
pub struct SimConfig {
    pub category_id: String,
    pub top_n: i32,
    pub weighting: Weighting,
    pub rebalance_days: i32,
    pub base_fee_pct: f64,
    pub spread_multiplier: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold_rebalance_pct: Option<f64>,
    /// Optional override for simulation start date (default: earliest available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<NaiveDate>,
    /// VC overlay mode: "funding", "valuation", "fresh_12", etc. None = off.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vc_mode: Option<String>,
    /// Comma-separated VC investor names filter.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vc_investors: Option<String>,
    /// Minimum funding in millions USD.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vc_min_amount_m: Option<f64>,
    /// Comma-separated round types filter.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vc_round_types: Option<String>,
    /// FNG regime overlay.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fng_regime: Option<FngRegime>,
    /// BTC/ETH dominance regime overlay.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dominance_regime: Option<DominanceRegime>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct FngRegime {
    pub mode: String,           // "trigger"|"cash"|"cash_shift"|"risk_toggle"|"top_n_scaler"|"contrarian"|"frequency"|"graduated_cash"|"quality_rotation"|"trend_follow"
    pub fear_threshold: i32,    // default 25
    pub greed_threshold: i32,   // default 75
    pub cash_pct_greed: f64,    // for "cash"/"cash_shift"/"graduated_cash" modes (default 0.4)
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct DominanceRegime {
    pub mode: String,           // "alts_when_low"|"alts_when_falling"|"btc_when_high"|"combo"|"momentum"|"alt_rotator"|"trend_filter"|"weighted_split"|"breadth"
    pub lookback_days: i32,     // default 30
}

// ---- Pipeline types ----

/// Regime signals for a single day, computed once and passed to all stages.
struct DayRegimeSignals {
    fng_value: Option<i32>,
    fng_zone: FngZone,
    fng_trend: f64,             // 14d FNG delta (positive = sentiment improving)
    btc_dom: Option<f64>,
    btc_dom_trend: f64,
    dom_zone: DomZone,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum FngZone { ExtremeFear, Neutral, ExtremeGreed, Unknown }

#[derive(Debug, Clone, Copy, PartialEq)]
enum DomZone { Rising, Falling, Flat, Unknown }

/// Output of Stage 2: effective simulation params for this rebalance.
struct EffectiveParams {
    top_n: i32,
    weighting: Weighting,
    cash_fraction: f64,
}

/// VC eligibility criteria (parsed once pre-loop, used in Stage 3).
struct VcEligibility {
    investor_names: Option<HashSet<String>>,
    round_types: Option<HashSet<String>>,
    min_funding_m: f64,
}

impl VcEligibility {
    fn from_config(config: &SimConfig) -> Option<Self> {
        config.vc_mode.as_ref()?; // None if VC overlay off
        let investor_names = config.vc_investors.as_ref().map(|s| {
            s.split(',').map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()).collect()
        });
        let round_types = config.vc_round_types.as_ref().map(|s| {
            s.split(',').map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()).collect()
        });
        let min_funding_m = config.vc_min_amount_m.unwrap_or(0.0);
        Some(VcEligibility { investor_names, round_types, min_funding_m })
    }

    fn is_eligible(&self, metrics: &DefiCoinMetrics) -> bool {
        if metrics.total_funding_m < self.min_funding_m {
            return false;
        }
        if let Some(ref investor_set) = self.investor_names {
            if !metrics.lead_investors.iter().any(|inv| investor_set.contains(&inv.to_lowercase())) {
                return false;
            }
        }
        if let Some(ref round_set) = self.round_types {
            let passes = metrics.latest_round.as_ref()
                .map(|r| round_set.contains(&r.to_lowercase()))
                .unwrap_or(false);
            if !passes {
                return false;
            }
        }
        true
    }
}

fn classify_fng(value: Option<i32>, regime: Option<&FngRegime>) -> FngZone {
    match (value, regime) {
        (Some(v), Some(r)) => {
            if v <= r.fear_threshold { FngZone::ExtremeFear }
            else if v >= r.greed_threshold { FngZone::ExtremeGreed }
            else { FngZone::Neutral }
        }
        (Some(v), None) => {
            if v <= 25 { FngZone::ExtremeFear }
            else if v >= 75 { FngZone::ExtremeGreed }
            else { FngZone::Neutral }
        }
        _ => FngZone::Unknown,
    }
}

fn classify_dom(trend: f64) -> DomZone {
    if trend > 2.0 { DomZone::Rising }
    else if trend < -2.0 { DomZone::Falling }
    else { DomZone::Flat }
}

#[derive(Debug, Clone, PartialEq, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Weighting {
    #[default]
    Equal,
    Mcap,
    CappedMcap { cap_pct: f64 },
    SqrtMcap,
    Momentum { lookback_days: i32 },
    InverseVolatility { lookback_days: i32 },
    DualMomentum { lookback_days: i32 },
    RiskParity { lookback_days: i32 },
    MinVariance { lookback_days: i32 },
    MultiFactor { lookback_days: i32 },
    LowVolatility { lookback_days: i32 },
    // DeFi-metric weighting strategies
    TvlWeight,
    TvlCapped { cap_pct: f64 },
    TvlSqrt,
    FeesWeight,
    RevenueWeight,
    VolumeWeight,
    TvlMomentum { lookback_days: i32 },
    FeeEfficiency,
    YieldWeight,
}

impl Weighting {
    pub fn as_str(&self) -> String {
        match self {
            Weighting::Equal => "equal".to_string(),
            Weighting::Mcap => "mcap".to_string(),
            Weighting::CappedMcap { cap_pct } => format!("mcap_cap{}", *cap_pct as i32),
            Weighting::SqrtMcap => "sqrt_mcap".to_string(),
            Weighting::Momentum { lookback_days } => format!("momentum_{}", lookback_days),
            Weighting::InverseVolatility { lookback_days } => format!("invvol_{}", lookback_days),
            Weighting::DualMomentum { lookback_days } => format!("dual_mom_{}", lookback_days),
            Weighting::RiskParity { lookback_days } => format!("risk_parity_{}", lookback_days),
            Weighting::MinVariance { lookback_days } => format!("min_var_{}", lookback_days),
            Weighting::MultiFactor { lookback_days } => format!("multi_factor_{}", lookback_days),
            Weighting::LowVolatility { lookback_days } => format!("low_vol_{}", lookback_days),
            Weighting::TvlWeight => "tvl".to_string(),
            Weighting::TvlCapped { cap_pct } => format!("tvl_cap{}", *cap_pct as i32),
            Weighting::TvlSqrt => "tvl_sqrt".to_string(),
            Weighting::FeesWeight => "fees_w".to_string(),
            Weighting::RevenueWeight => "revenue_w".to_string(),
            Weighting::VolumeWeight => "volume_w".to_string(),
            Weighting::TvlMomentum { lookback_days } => format!("tvl_mom_{}", lookback_days),
            Weighting::FeeEfficiency => "fee_eff".to_string(),
            Weighting::YieldWeight => "yield_w".to_string(),
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        let s_lower = s.to_lowercase();
        match s_lower.as_str() {
            "equal" => Some(Weighting::Equal),
            "mcap" => Some(Weighting::Mcap),
            "sqrt_mcap" => Some(Weighting::SqrtMcap),
            "tvl" => Some(Weighting::TvlWeight),
            "tvl_sqrt" => Some(Weighting::TvlSqrt),
            "fees_w" => Some(Weighting::FeesWeight),
            "revenue_w" => Some(Weighting::RevenueWeight),
            "volume_w" => Some(Weighting::VolumeWeight),
            "fee_eff" => Some(Weighting::FeeEfficiency),
            "yield_w" => Some(Weighting::YieldWeight),
            _ => {
                if let Some(rest) = s_lower.strip_prefix("mcap_cap") {
                    rest.parse::<f64>().ok().map(|c| Weighting::CappedMcap { cap_pct: c })
                } else if let Some(rest) = s_lower.strip_prefix("tvl_cap") {
                    rest.parse::<f64>().ok().map(|c| Weighting::TvlCapped { cap_pct: c })
                } else if let Some(rest) = s_lower.strip_prefix("tvl_mom_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::TvlMomentum { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("momentum_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::Momentum { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("invvol_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::InverseVolatility { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("dual_mom_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::DualMomentum { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("risk_parity_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::RiskParity { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("min_var_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::MinVariance { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("multi_factor_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::MultiFactor { lookback_days: d })
                } else if let Some(rest) = s_lower.strip_prefix("low_vol_") {
                    rest.parse::<i32>().ok().map(|d| Weighting::LowVolatility { lookback_days: d })
                } else {
                    None
                }
            }
        }
    }

    pub fn needs_history(&self) -> bool {
        matches!(self,
            Weighting::Momentum { .. } | Weighting::InverseVolatility { .. } |
            Weighting::DualMomentum { .. } | Weighting::RiskParity { .. } |
            Weighting::MinVariance { .. } | Weighting::MultiFactor { .. } |
            Weighting::LowVolatility { .. }
        )
    }

    /// Whether this strategy uses DeFi metrics (from DefiLlama).
    pub fn needs_defi(&self) -> bool {
        matches!(self,
            Weighting::TvlWeight | Weighting::TvlCapped { .. } | Weighting::TvlSqrt |
            Weighting::FeesWeight | Weighting::RevenueWeight | Weighting::VolumeWeight |
            Weighting::TvlMomentum { .. } | Weighting::FeeEfficiency | Weighting::YieldWeight
        )
    }

    pub fn lookback_days(&self) -> Option<i32> {
        match self {
            Weighting::Momentum { lookback_days }
            | Weighting::InverseVolatility { lookback_days }
            | Weighting::DualMomentum { lookback_days }
            | Weighting::RiskParity { lookback_days }
            | Weighting::MinVariance { lookback_days }
            | Weighting::MultiFactor { lookback_days }
            | Weighting::LowVolatility { lookback_days }
            | Weighting::TvlMomentum { lookback_days } => Some(*lookback_days),
            _ => None,
        }
    }
}

impl SimConfig {
    /// Encodes weighting + threshold + start_date + regime params into one string for cache key.
    pub fn cache_key_weighting(&self) -> String {
        let mut key = self.weighting.as_str();
        if let Some(t) = self.threshold_rebalance_pct {
            key = format!("{}_t{}", key, t as i32);
        }
        if let Some(sd) = self.start_date {
            key = format!("{}_s{}", key, sd);
        }
        if let Some(ref fng) = self.fng_regime {
            key = format!("{}_fng{}_{}_{}", key, fng.mode, fng.fear_threshold, fng.greed_threshold);
        }
        if let Some(ref dom) = self.dominance_regime {
            key = format!("{}_dom{}_{}", key, dom.mode, dom.lookback_days);
        }
        if let Some(ref vc) = self.vc_mode {
            key = format!("{}_vc{}", key, vc);
        }
        if let Some(ref inv) = self.vc_investors {
            key = format!("{}_vci{}", key, inv);
        }
        if let Some(min) = self.vc_min_amount_m {
            key = format!("{}_vcm{}", key, min as i64);
        }
        if let Some(ref rt) = self.vc_round_types {
            key = format!("{}_vcr{}", key, rt);
        }
        key
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SimResult {
    pub run_id: i64,
    pub config: SimConfig,
    pub stats: SimStats,
    pub nav_series: Vec<db::SimNavPoint>,
    pub cached: bool,
    pub computed_in_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SimStats {
    pub total_return_pct: f64,
    pub annualized_return: f64,
    pub max_drawdown_pct: f64,
    pub sharpe_ratio: f64,
    pub total_fees_pct: f64,
    pub total_trades: i32,
    pub total_rebalances: i32,
    pub total_delistings: i32,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SimProgress {
    pub current_date: String,
    pub total_dates: usize,
    pub pct: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_variants: Option<usize>,
}

#[derive(Debug)]
pub enum SimError {
    Db(sqlx::Error),
    NotEnoughCoins { available: usize, required: i32 },
    NoData(String),
}

impl std::fmt::Display for SimError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SimError::Db(e) => write!(f, "database error: {e}"),
            SimError::NotEnoughCoins { available, required } => {
                write!(f, "not enough coins: {available} available, {required} required")
            }
            SimError::NoData(msg) => write!(f, "no data: {msg}"),
        }
    }
}

impl From<sqlx::Error> for SimError {
    fn from(e: sqlx::Error) -> Self {
        SimError::Db(e)
    }
}

// ---- Holding tracking ----

#[derive(Debug, Clone)]
struct Holding {
    coin_id: String,
    symbol: String,       // CG symbol uppercase
    quantity: f64,         // shares of this coin per $1 of index
    last_price: f64,
}

// ---- In-memory preloaded data ----

/// Lightweight coin snapshot for in-memory market cap ranking.
#[derive(Debug, Clone)]
pub struct CoinSnapshot {
    pub coin_id: String,
    pub price: f64,
    pub mcap: f64,
}

/// References into SimDataCache + computed price_history for this run.
struct PreloadedData<'a> {
    /// coin_id → { date → price_usd } for O(1) daily price lookups
    prices: &'a HashMap<String, HashMap<NaiveDate, f64>>,
    /// date → Vec<CoinSnapshot> sorted by mcap DESC — for rebalance ranking
    mcap_rankings: &'a HashMap<NaiveDate, Vec<CoinSnapshot>>,
    /// For momentum/vol strategies: coin_id → sorted [(date, price)]
    price_history: Option<HashMap<String, Vec<(NaiveDate, f64)>>>,
    /// DeFi current metrics (gecko_id → DefiCoinMetrics)
    defi_metrics: &'a HashMap<String, DefiCoinMetrics>,
    /// DeFi historical metrics (gecko_id → { date → DefiDayMetrics })
    defi_history: &'a HashMap<String, HashMap<NaiveDate, DefiDayMetrics>>,
    /// FNG index: date → value
    fng_index: &'a HashMap<NaiveDate, i32>,
    /// BTC dominance: date → pct
    btc_dominance: &'a HashMap<NaiveDate, f64>,
    /// ETH dominance: date → pct
    eth_dominance: &'a HashMap<NaiveDate, f64>,
}

// ---- Price history helpers ----

/// Compute trailing return from price series over lookback_days ending at the given date.
fn compute_trailing_return(prices: &[(NaiveDate, f64)], date: NaiveDate, lookback_days: i32) -> Option<f64> {
    let cutoff = date - chrono::Duration::days(lookback_days as i64);
    // Find price nearest to cutoff (first price >= cutoff)
    let start_price = prices.iter()
        .find(|(d, _)| *d >= cutoff)
        .map(|(_, p)| *p)?;
    // Find price nearest to date (last price <= date)
    let end_price = prices.iter()
        .rev()
        .find(|(d, _)| *d <= date)
        .map(|(_, p)| *p)?;
    if start_price <= 0.0 {
        return None;
    }
    Some((end_price / start_price) - 1.0)
}

/// Compute annualized volatility from price series: std(daily log returns) * sqrt(365).
fn compute_annualized_volatility(prices: &[(NaiveDate, f64)], date: NaiveDate, lookback_days: i32) -> Option<f64> {
    let cutoff = date - chrono::Duration::days(lookback_days as i64);
    let relevant: Vec<f64> = prices.iter()
        .filter(|(d, _)| *d >= cutoff && *d <= date)
        .map(|(_, p)| *p)
        .collect();
    if relevant.len() < 2 {
        return None;
    }
    let log_returns: Vec<f64> = relevant.windows(2)
        .filter(|w| w[0] > 0.0 && w[1] > 0.0)
        .map(|w| (w[1] / w[0]).ln())
        .collect();
    if log_returns.is_empty() {
        return None;
    }
    let mean = log_returns.iter().sum::<f64>() / log_returns.len() as f64;
    let variance = log_returns.iter()
        .map(|r| (r - mean).powi(2))
        .sum::<f64>() / log_returns.len() as f64;
    let std_dev = variance.sqrt();
    Some(std_dev * (365.0_f64).sqrt())
}

/// Extract daily log returns for a coin from price history within lookback window.
fn daily_log_returns(prices: &[(NaiveDate, f64)], date: NaiveDate, lookback_days: i32) -> Vec<f64> {
    let cutoff = date - chrono::Duration::days(lookback_days as i64);
    let relevant: Vec<f64> = prices.iter()
        .filter(|(d, _)| *d >= cutoff && *d <= date)
        .map(|(_, p)| *p)
        .collect();
    relevant.windows(2)
        .filter(|w| w[0] > 0.0 && w[1] > 0.0)
        .map(|w| (w[1] / w[0]).ln())
        .collect()
}

/// Compute NxN covariance matrix from daily log returns of N assets.
/// Returns None if insufficient data.
fn compute_covariance_matrix(
    coins: &[&CoinSnapshot],
    price_history: &HashMap<String, Vec<(NaiveDate, f64)>>,
    date: NaiveDate,
    lookback_days: i32,
) -> Option<Vec<Vec<f64>>> {
    let n = coins.len();
    // Gather returns for each asset
    let all_returns: Vec<Vec<f64>> = coins.iter()
        .map(|c| {
            price_history.get(&c.coin_id)
                .map(|p| daily_log_returns(p, date, lookback_days))
                .unwrap_or_default()
        })
        .collect();

    // Need at least 10 observations for meaningful covariance
    let min_len = all_returns.iter().map(|r| r.len()).min().unwrap_or(0);
    if min_len < 10 {
        return None;
    }

    // Trim all to same length (min_len, from the end = most recent)
    let trimmed: Vec<&[f64]> = all_returns.iter()
        .map(|r| &r[r.len() - min_len..])
        .collect();

    // Compute means
    let means: Vec<f64> = trimmed.iter()
        .map(|r| r.iter().sum::<f64>() / min_len as f64)
        .collect();

    // Compute covariance matrix
    let mut cov = vec![vec![0.0; n]; n];
    for i in 0..n {
        for j in i..n {
            let c: f64 = (0..min_len)
                .map(|t| (trimmed[i][t] - means[i]) * (trimmed[j][t] - means[j]))
                .sum::<f64>() / min_len as f64;
            cov[i][j] = c;
            cov[j][i] = c;
        }
    }
    Some(cov)
}

/// Matrix-vector multiply: result[i] = sum_j(cov[i][j] * w[j])
fn mat_vec_mul(cov: &[Vec<f64>], w: &[f64]) -> Vec<f64> {
    cov.iter()
        .map(|row| row.iter().zip(w).map(|(c, wi)| c * wi).sum())
        .collect()
}

/// Normalize weights so they sum to 1.0.
fn normalize_weights(weights: &mut [f64]) {
    let sum: f64 = weights.iter().sum();
    if sum > 0.0 {
        for w in weights.iter_mut() {
            *w /= sum;
        }
    }
}

/// Check if portfolio has drifted beyond threshold from target weights.
fn should_threshold_rebalance(
    holdings: &[Holding],
    prices: &HashMap<String, f64>,
    target_weights: &HashMap<String, f64>,
    threshold_pct: f64,
) -> bool {
    if holdings.is_empty() || target_weights.is_empty() {
        return false;
    }

    // Compute current portfolio value
    let total_value: f64 = holdings.iter()
        .map(|h| {
            let price = prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
            h.quantity * price
        })
        .sum();

    if total_value <= 0.0 {
        return false;
    }

    // Check drift for each holding
    for h in holdings {
        let price = prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
        let current_weight = (h.quantity * price) / total_value;
        let target = target_weights.get(&h.coin_id).copied().unwrap_or(0.0);
        let drift = (current_weight - target).abs() * 100.0; // as percentage points
        if drift > threshold_pct {
            return true;
        }
    }

    // Also check if any target coin is missing from holdings
    for (coin_id, target_w) in target_weights {
        if *target_w > 0.0 && !holdings.iter().any(|h| h.coin_id == *coin_id) {
            return true;
        }
    }

    false
}

// ---- Core simulation ----

pub async fn run_simulation(
    pool: &PgPool,
    config: &SimConfig,
    progress_tx: Option<mpsc::Sender<SimProgress>>,
    cache: &SimDataCache,
) -> Result<SimResult, SimError> {
    let start_time = std::time::Instant::now();

    if cache.all_dates.is_empty() {
        return Err(SimError::NoData("no CoinGecko snapshot dates found".into()));
    }

    // Look up category coins from global cache
    let category_coin_ids = cache.category_coins.get(&config.category_id)
        .ok_or_else(|| SimError::NoData(format!("no coins in category {}", config.category_id)))?;

    if category_coin_ids.is_empty() {
        return Err(SimError::NoData(format!("no coins in category {}", config.category_id)));
    }

    // Filter to Bitget-eligible coins (using global cache)
    let eligible_coin_ids: Vec<String> = category_coin_ids.iter().filter(|cid| {
        if let Some(sym) = cache.coin_symbol_map.get(*cid) {
            cache.bitget_lookup.contains_key(sym.as_str())
        } else {
            false
        }
    }).cloned().collect();

    if eligible_coin_ids.is_empty() {
        return Err(SimError::NoData(format!(
            "no Bitget-listed coins in category {}", config.category_id
        )));
    }

    let eligible_set: HashSet<String> = eligible_coin_ids.iter().cloned().collect();

    // Build price_history for momentum/vol strategies from cached data
    // Also needed if FNG/DOM regime may switch to momentum/vol-based strategies
    let needs_price_hist = config.weighting.needs_history()
        || config.fng_regime.as_ref().map(|r| matches!(r.mode.as_str(),
            "contrarian" | "risk_toggle" | "quality_rotation" | "trend_follow"
        )).unwrap_or(false)
        || config.dominance_regime.as_ref().map(|r| matches!(r.mode.as_str(), "momentum" | "combo")).unwrap_or(false);
    let price_history: Option<HashMap<String, Vec<(NaiveDate, f64)>>> =
        if needs_price_hist {
            Some(cache.build_price_history(&eligible_coin_ids))
        } else {
            None
        };

    // Wrap cache refs into PreloadedData for the sim loop
    let preloaded = PreloadedData {
        prices: &cache.prices,
        mcap_rankings: &cache.mcap_rankings,
        price_history,
        defi_metrics: &cache.defi_metrics,
        defi_history: &cache.defi_history,
        fng_index: &cache.fng_index,
        btc_dominance: &cache.btc_dominance,
        eth_dominance: &cache.eth_dominance,
    };

    // Find start date: use override if provided, otherwise earliest date with >= 1 eligible coin.
    // Clamp to 2020-01-01 minimum — data before that is too sparse.
    let min_start = chrono::NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
    let effective_start = config.start_date.map(|sd| sd.max(min_start)).or(Some(min_start));
    let mut start_idx = None;
    for (i, date) in cache.all_dates.iter().enumerate() {
        // If start_date override is set, skip dates before it
        if let Some(sd) = effective_start {
            if *date < sd { continue; }
        }
        let eligible = count_eligible_coins_mem(
            &cache.mcap_rankings, *date, &cache.coin_symbol_map, &cache.bitget_lookup,
            &eligible_set,
        );
        if eligible >= 1 {
            start_idx = Some(i);
            break;
        }
    }

    let start_idx = start_idx.ok_or_else(|| SimError::NotEnoughCoins {
        available: 0,
        required: config.top_n,
    })?;

    let sim_dates = &cache.all_dates[start_idx..];
    let total_dates = sim_dates.len();

    info!(
        category = %config.category_id,
        top_n = config.top_n,
        weighting = %config.weighting.as_str(),
        rebalance_days = config.rebalance_days,
        eligible_coins = eligible_coin_ids.len(),
        start_date = %sim_dates[0],
        total_dates,
        "Starting simulation (from global cache)"
    );

    // Pre-loop: parse VC eligibility once
    let vc_eligibility = VcEligibility::from_config(config);

    // 7. Day-by-day simulation — ZERO DB queries in this loop (6-stage pipeline)
    let mut holdings: Vec<Holding> = Vec::new();
    let mut nav_series: Vec<db::SimNavPoint> = Vec::new();
    let mut all_holdings: Vec<db::SimHoldingRow> = Vec::new();
    let mut all_trades: Vec<db::SimTradeRow> = Vec::new();
    let mut peak_nav = 1.0_f64;
    let mut days_since_rebalance = i32::MAX - 1; // Force rebalance on first day (leave room for +1)
    let mut total_fees_usd = 0.0_f64;
    let mut total_delistings = 0_i32;
    let mut total_rebalances = 0_i32;
    let mut portfolio_value = 1.0_f64; // Start at $1
    let mut last_target_weights: HashMap<String, f64> = HashMap::new();
    let mut fng_prev: Option<i32> = None;
    let mut cash_fraction = 0.0_f64;
    let mut cash_balance = 0.0_f64; // Explicit cash tracking (earns 0%)

    for (i, date) in sim_dates.iter().enumerate() {
        // Send progress every ~100 dates
        if let Some(ref tx) = progress_tx {
            if i % 100 == 0 || i == total_dates - 1 {
                let _ = tx.send(SimProgress {
                    current_date: date.to_string(),
                    total_dates,
                    pct: (i as f64 / total_dates as f64) * 100.0,
                    variant_index: None,
                    total_variants: None,
                }).await;
            }
        }

        // Get prices for held coins today — in-memory O(n) lookup
        let today_prices = get_prices_mem(&preloaded.prices, &holdings, *date);

        // Handle delistings (unchanged)
        let (new_holdings, delist_trades, delist_proceeds) = check_delistings(
            &holdings, &today_prices, &cache.bitget_lookup, *date, config,
        );
        if !delist_trades.is_empty() {
            total_delistings += delist_trades.len() as i32;
            for t in &delist_trades {
                total_fees_usd += t.fee_usd;
            }
            all_trades.extend(delist_trades);
            holdings = redistribute_proceeds(new_holdings, delist_proceeds, &today_prices);
        }

        // Build day regime signals (computed once, used by all stages)
        let fng_today = preloaded.fng_index.get(date).copied();
        let btc_dom_today = preloaded.btc_dominance.get(date).copied();
        let dom_lookback = config.dominance_regime.as_ref().map(|r| r.lookback_days).unwrap_or(30);
        let btc_trend = btc_dom_trend(preloaded.btc_dominance, *date, dom_lookback);
        let fng_trend_val = fng_trend(preloaded.fng_index, *date);

        let signals = DayRegimeSignals {
            fng_value: fng_today,
            fng_zone: classify_fng(fng_today, config.fng_regime.as_ref()),
            fng_trend: fng_trend_val,
            btc_dom: btc_dom_today,
            btc_dom_trend: btc_trend,
            dom_zone: classify_dom(btc_trend),
        };

        days_since_rebalance += 1;

        // STAGE 1: Rebalance trigger
        let should_rebalance = resolve_rebalance_trigger(
            &holdings, days_since_rebalance, config.rebalance_days,
            config.threshold_rebalance_pct, &today_prices, &last_target_weights,
            &signals, config.fng_regime.as_ref(), fng_prev,
        );

        // STAGE 2: Effective params (DOM > FNG precedence)
        let params = resolve_effective_params(
            config.top_n, &config.weighting, &signals,
            config.fng_regime.as_ref(), config.dominance_regime.as_ref(),
        );
        cash_fraction = params.cash_fraction;

        if should_rebalance {
            // Total portfolio = holdings NAV + explicit cash balance
            let total_value = portfolio_value + cash_balance;
            let investable_value = total_value * (1.0 - cash_fraction);
            // Park the rest in cash (earns 0% between rebalances)
            cash_balance = total_value * cash_fraction;

            // Get mcap-ranked coins at this date
            let all_coins = preloaded.mcap_rankings.get(date);

            if let Some(all_coins) = all_coins {
                // STAGE 3: Eligibility filters (category + Bitget + price + VC)
                let eligible = filter_eligible_coins(
                    all_coins, &eligible_set, &cache.coin_symbol_map,
                    &cache.bitget_lookup, *date, vc_eligibility.as_ref(),
                    preloaded.defi_metrics,
                );

                // STAGE 4: Top-N + weights
                let top_coins: Vec<&CoinSnapshot> = eligible.into_iter()
                    .take(params.top_n as usize).collect();

                if !top_coins.is_empty() {
                    let mut weights = compute_weights_snap(
                        &top_coins, &params.weighting, *date,
                        preloaded.price_history.as_ref(),
                        preloaded.defi_metrics,
                        preloaded.defi_history,
                    );

                    // STAGE 5: Weight modifiers (VC mult → contrarian → split → trend_filter)
                    apply_weight_modifiers(
                        &mut weights, &top_coins, &signals, config,
                        preloaded.defi_metrics, preloaded.price_history.as_ref(), *date,
                    );

                    // Check if all weights are zero (dual momentum cash mode)
                    let weight_sum: f64 = weights.iter().sum();

                    if weight_sum <= 0.0 && !holdings.is_empty() {
                        // STAGE 6a: Dual momentum go-to-cash
                        let mut cash_proceeds = 0.0_f64;
                        for h in &holdings {
                            let price = today_prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
                            let trade_value = h.quantity * price;
                            if trade_value > 0.01 {
                                let fee_rate = config.base_fee_pct / 100.0 + 0.001 * config.spread_multiplier;
                                let fee_usd = trade_value * fee_rate;
                                total_fees_usd += fee_usd;
                                cash_proceeds += trade_value - fee_usd;
                                all_trades.push(db::SimTradeRow {
                                    trade_date: *date,
                                    coin_id: h.coin_id.clone(),
                                    side: "sell".into(),
                                    quantity: h.quantity,
                                    price_usd: price,
                                    fee_pct: fee_rate * 100.0,
                                    fee_usd,
                                    reason: Some("dual_mom_cash".into()),
                                });
                            }
                        }
                        portfolio_value = cash_proceeds;
                        holdings = Vec::new();
                        last_target_weights.clear();
                        days_since_rebalance = 0;
                        total_rebalances += 1;
                    } else if weight_sum > 0.0 {
                        // STAGE 6b: Execute trades
                        let rebalance_result = execute_rebalance_trades(
                            &top_coins, &weights, investable_value, &holdings,
                            &cache.coin_symbol_map, config, *date,
                        );

                        if !rebalance_result.new_holdings.is_empty() {
                            for t in &rebalance_result.trades {
                                total_fees_usd += t.fee_usd;
                            }
                            all_trades.extend(rebalance_result.trades);
                            all_holdings.extend(rebalance_result.holdings_snapshot);

                            last_target_weights.clear();
                            for h in &rebalance_result.new_holdings {
                                let price = today_prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
                                let value = h.quantity * price;
                                last_target_weights.insert(h.coin_id.clone(), value / rebalance_result.post_fee_value.max(0.001));
                            }

                            holdings = rebalance_result.new_holdings;
                            portfolio_value = rebalance_result.post_fee_value;
                            days_since_rebalance = 0;
                            total_rebalances += 1;
                        }
                    }
                }
            }
        }

        // Compute NAV
        let nav = if holdings.is_empty() {
            portfolio_value
        } else {
            let n = compute_nav(&holdings, &today_prices);
            if n > 0.0 { portfolio_value = n; }
            n
        };

        // Total portfolio = holdings NAV + explicit cash balance
        let total_nav = nav + cash_balance;

        if total_nav > peak_nav {
            peak_nav = total_nav;
        }
        let drawdown = if peak_nav > 0.0 { (total_nav - peak_nav) / peak_nav * 100.0 } else { 0.0 };
        nav_series.push(db::SimNavPoint {
            nav_date: *date,
            nav: total_nav,
            drawdown_pct: drawdown,
        });

        fng_prev = fng_today;
    }

    // 8. Compute stats
    let stats = compute_stats(&nav_series, &all_trades, total_fees_usd, total_rebalances, total_delistings);

    // 9. Store results — insert run synchronously (need run_id), then write
    //    nav/holdings/trades in background so the response returns immediately.
    let duration_ms = start_time.elapsed().as_millis() as i32;
    let run_insert = db::SimRunInsert {
        category_id: config.category_id.clone(),
        top_n: config.top_n,
        weighting: config.cache_key_weighting(),
        rebalance_days: config.rebalance_days,
        start_date: stats.start_date,
        end_date: stats.end_date,
        total_return_pct: Some(stats.total_return_pct),
        annualized_return: Some(stats.annualized_return),
        max_drawdown_pct: Some(stats.max_drawdown_pct),
        sharpe_ratio: Some(stats.sharpe_ratio),
        base_fee_pct: config.base_fee_pct,
        spread_multiplier: config.spread_multiplier,
        total_fees_pct: Some(stats.total_fees_pct),
        total_trades: Some(stats.total_trades),
        total_rebalances: Some(stats.total_rebalances),
        total_delistings: Some(stats.total_delistings),
        duration_ms: Some(duration_ms),
    };

    let run_id = db::sim_insert_run(pool, &run_insert).await?;

    // Background DB writes — sim_insert_run already holds the run_id,
    // and FK indexes on child tables prevent cascade deadlocks.
    let bg_pool = pool.clone();
    let bg_nav = nav_series.clone();
    let bg_holdings = all_holdings;
    let bg_trades = all_trades;
    tokio::spawn(async move {
        if let Err(e) = db::sim_batch_insert_nav(&bg_pool, run_id, &bg_nav).await {
            tracing::error!(run_id, error = %e, "bg: nav insert failed");
        }
        if let Err(e) = db::sim_batch_insert_holdings(&bg_pool, run_id, &bg_holdings).await {
            tracing::error!(run_id, error = %e, "bg: holdings insert failed");
        }
        if let Err(e) = db::sim_batch_insert_trades(&bg_pool, run_id, &bg_trades).await {
            tracing::error!(run_id, error = %e, "bg: trades insert failed");
        }
    });

    info!(
        run_id,
        total_return = format!("{:.2}%", stats.total_return_pct),
        max_drawdown = format!("{:.2}%", stats.max_drawdown_pct),
        sharpe = format!("{:.3}", stats.sharpe_ratio),
        sim_ms = duration_ms,
        "Simulation complete (writes in background)"
    );

    Ok(SimResult {
        run_id,
        config: config.clone(),
        stats,
        nav_series,
        cached: false,
        computed_in_ms: duration_ms as i64,
    })
}

// ---- Helpers ----

fn build_bitget_lookup(listings: &[db::BitgetListingRow]) -> HashMap<String, db::BitgetListingRow> {
    let mut map = HashMap::new();
    for l in listings {
        if l.quote_coin == "USDT" {
            // Key by uppercase base_coin
            map.insert(l.base_coin.to_uppercase(), l.clone());
        }
    }
    map
}

fn is_listed_on_bitget(
    cg_symbol: &str,
    bitget_lookup: &HashMap<String, db::BitgetListingRow>,
    date: NaiveDate,
) -> bool {
    if let Some(listing) = bitget_lookup.get(&cg_symbol.to_uppercase()) {
        let listed_date = listing.listed_at.date_naive();
        if date < listed_date {
            return false;
        }
        if let Some(delisted) = listing.delisted_at {
            if date >= delisted.date_naive() {
                return false;
            }
        }
        // Check status
        listing.status != "delisted_gone"
    } else {
        false
    }
}

/// Count eligible coins at a date using preloaded in-memory data (no DB query).
/// Only counts coins that are in the category's eligible set.
fn count_eligible_coins_mem(
    mcap_rankings: &HashMap<NaiveDate, Vec<CoinSnapshot>>,
    date: NaiveDate,
    coin_symbol_map: &HashMap<String, String>,
    bitget_lookup: &HashMap<String, db::BitgetListingRow>,
    category_coin_ids: &HashSet<String>,
) -> usize {
    let coins = match mcap_rankings.get(&date) {
        Some(c) => c,
        None => return 0,
    };
    coins.iter().filter(|c| {
        category_coin_ids.contains(&c.coin_id)
        && if let Some(sym) = coin_symbol_map.get(&c.coin_id) {
            c.price > 0.0 && is_listed_on_bitget(sym, bitget_lookup, date)
        } else {
            false
        }
    }).count()
}

/// Get prices for held coins at a date from in-memory cache (no DB query).
fn get_prices_mem(
    price_cache: &HashMap<String, HashMap<NaiveDate, f64>>,
    holdings: &[Holding],
    date: NaiveDate,
) -> HashMap<String, f64> {
    let mut map = HashMap::new();
    for h in holdings {
        if let Some(date_map) = price_cache.get(&h.coin_id) {
            if let Some(&price) = date_map.get(&date) {
                map.insert(h.coin_id.clone(), price);
            }
        }
    }
    map
}

fn compute_nav(holdings: &[Holding], prices: &HashMap<String, f64>) -> f64 {
    if holdings.is_empty() {
        return 1.0;
    }
    let mut total = 0.0;
    for h in holdings {
        let price = prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
        total += h.quantity * price;
    }
    total
}

fn check_delistings(
    holdings: &[Holding],
    prices: &HashMap<String, f64>,
    bitget_lookup: &HashMap<String, db::BitgetListingRow>,
    date: NaiveDate,
    config: &SimConfig,
) -> (Vec<Holding>, Vec<db::SimTradeRow>, f64) {
    let mut remaining = Vec::new();
    let mut trades = Vec::new();
    let mut proceeds = 0.0;

    for h in holdings {
        if let Some(listing) = bitget_lookup.get(&h.symbol) {
            if let Some(delisted_at) = listing.delisted_at {
                if date >= delisted_at.date_naive() {
                    // Coin delisted — sell at CG price
                    let price = prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
                    let gross = h.quantity * price;
                    let fee_rate = config.base_fee_pct / 100.0 + 0.001 * config.spread_multiplier;
                    let fee = gross * fee_rate;
                    proceeds += gross - fee;

                    trades.push(db::SimTradeRow {
                        trade_date: date,
                        coin_id: h.coin_id.clone(),
                        side: "sell".into(),
                        quantity: h.quantity,
                        price_usd: price,
                        fee_pct: fee_rate * 100.0,
                        fee_usd: fee,
                        reason: Some("delisting".into()),
                    });
                    continue;
                }
            }
        }
        remaining.push(h.clone());
    }

    (remaining, trades, proceeds)
}

fn redistribute_proceeds(
    mut holdings: Vec<Holding>,
    proceeds: f64,
    prices: &HashMap<String, f64>,
) -> Vec<Holding> {
    if holdings.is_empty() || proceeds <= 0.0 {
        return holdings;
    }

    // Distribute equally among remaining holdings
    let per_holding = proceeds / holdings.len() as f64;
    for h in &mut holdings {
        let price = prices.get(&h.coin_id).copied().unwrap_or(h.last_price);
        if price > 0.0 {
            h.quantity += per_holding / price;
        }
    }
    holdings
}

struct RebalanceResult {
    new_holdings: Vec<Holding>,
    trades: Vec<db::SimTradeRow>,
    holdings_snapshot: Vec<db::SimHoldingRow>,
    post_fee_value: f64,
}

/// STAGE 6: Execute rebalance trades given pre-computed coins + weights.
/// Pure trade execution — no filtering or weight computation.
fn execute_rebalance_trades(
    top_coins: &[&CoinSnapshot],
    weights: &[f64],
    portfolio_value: f64,
    old_holdings: &[Holding],
    coin_symbol_map: &HashMap<String, String>,
    config: &SimConfig,
    date: NaiveDate,
) -> RebalanceResult {
    let mut new_holdings = Vec::new();
    let mut holdings_snapshot = Vec::new();
    let mut trades = Vec::new();

    // Build old holdings map for delta computation
    let old_map: HashMap<String, &Holding> = old_holdings.iter()
        .map(|h| (h.coin_id.clone(), h))
        .collect();

    for (coin, weight) in top_coins.iter().zip(weights.iter()) {
        if coin.price <= 0.0 || *weight <= 0.0 {
            continue;
        }

        let target_value = weight * portfolio_value;
        let target_qty = target_value / coin.price;

        let symbol = coin_symbol_map.get(&coin.coin_id)
            .cloned()
            .unwrap_or_default();

        let old_qty = old_map.get(&coin.coin_id).map(|h| h.quantity).unwrap_or(0.0);
        let delta_qty = target_qty - old_qty;

        if delta_qty.abs() * coin.price > 0.01 {
            let side = if delta_qty > 0.0 { "buy" } else { "sell" };
            let trade_value = delta_qty.abs() * coin.price;
            let fee_rate = config.base_fee_pct / 100.0 + 0.001 * config.spread_multiplier;
            let fee_usd = trade_value * fee_rate;

            trades.push(db::SimTradeRow {
                trade_date: date,
                coin_id: coin.coin_id.clone(),
                side: side.into(),
                quantity: delta_qty.abs(),
                price_usd: coin.price,
                fee_pct: fee_rate * 100.0,
                fee_usd,
                reason: Some("rebalance".into()),
            });
        }

        new_holdings.push(Holding {
            coin_id: coin.coin_id.clone(),
            symbol: symbol.clone(),
            quantity: target_qty,
            last_price: coin.price,
        });

        holdings_snapshot.push(db::SimHoldingRow {
            rebalance_date: date,
            coin_id: coin.coin_id.clone(),
            symbol,
            weight: *weight,
            quantity: target_qty,
            price_usd: coin.price,
        });
    }

    // Sell old holdings not in new set
    for old in old_holdings {
        if !new_holdings.iter().any(|h| h.coin_id == old.coin_id) {
            let price = old.last_price;
            let trade_value = old.quantity * price;
            if trade_value > 0.01 {
                let fee_rate = config.base_fee_pct / 100.0 + 0.001 * config.spread_multiplier;
                let fee_usd = trade_value * fee_rate;

                trades.push(db::SimTradeRow {
                    trade_date: date,
                    coin_id: old.coin_id.clone(),
                    side: "sell".into(),
                    quantity: old.quantity,
                    price_usd: price,
                    fee_pct: fee_rate * 100.0,
                    fee_usd,
                    reason: Some("rebalance_exit".into()),
                });
            }
        }
    }

    // Deduct total fees from portfolio value
    let total_fees: f64 = trades.iter().map(|t| t.fee_usd).sum();
    let post_fee_value = portfolio_value - total_fees;

    // Adjust quantities proportionally for fee deduction
    if post_fee_value < portfolio_value && portfolio_value > 0.0 {
        let ratio = post_fee_value / portfolio_value;
        for h in &mut new_holdings {
            h.quantity *= ratio;
        }
    }

    RebalanceResult {
        new_holdings,
        trades,
        holdings_snapshot,
        post_fee_value,
    }
}

/// Compute weights using CoinSnapshot (in-memory version).
fn compute_weights_snap(
    coins: &[&CoinSnapshot],
    weighting: &Weighting,
    date: NaiveDate,
    price_history: Option<&HashMap<String, Vec<(NaiveDate, f64)>>>,
    defi_metrics: &HashMap<String, DefiCoinMetrics>,
    defi_history: &HashMap<String, HashMap<NaiveDate, DefiDayMetrics>>,
) -> Vec<f64> {
    let n = coins.len();
    if n == 0 {
        return Vec::new();
    }

    match weighting {
        Weighting::Equal => {
            vec![1.0 / n as f64; n]
        }
        Weighting::Mcap => {
            let mcaps: Vec<f64> = coins.iter()
                .map(|c| c.mcap.max(0.0))
                .collect();
            let total_mcap: f64 = mcaps.iter().sum();

            if total_mcap <= 0.0 {
                return vec![1.0 / n as f64; n];
            }

            let min_weight = 0.005; // 0.5% floor
            let mut weights: Vec<f64> = mcaps.iter().map(|m| m / total_mcap).collect();

            // Apply floor
            let mut excess = 0.0;
            let mut floored_count = 0;
            for w in &mut weights {
                if *w < min_weight {
                    excess += min_weight - *w;
                    *w = min_weight;
                    floored_count += 1;
                }
            }

            // Redistribute excess from non-floored weights
            if excess > 0.0 && floored_count < n {
                let non_floored_total: f64 = weights.iter()
                    .filter(|w| **w > min_weight)
                    .sum();
                if non_floored_total > 0.0 {
                    for w in &mut weights {
                        if *w > min_weight {
                            *w -= excess * (*w / non_floored_total);
                        }
                    }
                }
            }

            normalize_weights(&mut weights);
            weights
        }
        Weighting::Momentum { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            let mut raw_returns: Vec<f64> = coins.iter().map(|c| {
                history.get(&c.coin_id)
                    .and_then(|prices| compute_trailing_return(prices, date, *lookback_days))
                    .unwrap_or(0.0)
            }).collect();

            // Shift so min = 0.01 (all positive), then normalize
            let min_ret = raw_returns.iter().copied().fold(f64::INFINITY, f64::min);
            let shift = if min_ret < 0.01 { 0.01 - min_ret } else { 0.0 };
            for r in &mut raw_returns {
                *r += shift;
                if *r < 0.01 { *r = 0.01; }
            }

            normalize_weights(&mut raw_returns);
            raw_returns
        }
        Weighting::InverseVolatility { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            let mut weights: Vec<f64> = coins.iter().map(|c| {
                let vol = history.get(&c.coin_id)
                    .and_then(|prices| compute_annualized_volatility(prices, date, *lookback_days))
                    .unwrap_or(1.0)
                    .max(0.001);
                1.0 / vol
            }).collect();

            normalize_weights(&mut weights);
            weights
        }
        Weighting::DualMomentum { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            let returns: Vec<f64> = coins.iter().map(|c| {
                history.get(&c.coin_id)
                    .and_then(|prices| compute_trailing_return(prices, date, *lookback_days))
                    .unwrap_or(0.0)
            }).collect();

            // Absolute momentum check: if average return of universe < 0 → go to cash
            let avg_return = returns.iter().sum::<f64>() / returns.len() as f64;
            if avg_return < 0.0 {
                return vec![0.0; n]; // all-zero signals "go to cash"
            }

            // Relative momentum: weight proportional to positive returns only
            let mut weights: Vec<f64> = returns.iter().map(|r| {
                if *r > 0.0 { *r } else { 0.0 }
            }).collect();

            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 {
                return vec![0.0; n]; // all negative → cash
            }

            normalize_weights(&mut weights);
            weights
        }

        // ---- New strategies ----

        Weighting::CappedMcap { cap_pct } => {
            let mcaps: Vec<f64> = coins.iter().map(|c| c.mcap.max(0.0)).collect();
            let total: f64 = mcaps.iter().sum();
            if total <= 0.0 { return vec![1.0 / n as f64; n]; }

            let mut weights: Vec<f64> = mcaps.iter().map(|m| m / total).collect();
            let cap = cap_pct / 100.0;

            // Iteratively cap and redistribute (converges in ~10 iterations)
            for _ in 0..20 {
                let mut excess = 0.0_f64;
                for w in weights.iter_mut() {
                    if *w > cap {
                        excess += *w - cap;
                        *w = cap;
                    }
                }
                if excess < 1e-10 { break; }
                let uncapped_sum: f64 = weights.iter().filter(|w| **w < cap - 1e-10).sum();
                if uncapped_sum <= 0.0 { break; }
                for w in weights.iter_mut() {
                    if *w < cap - 1e-10 {
                        *w += excess * (*w / uncapped_sum);
                    }
                }
            }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::SqrtMcap => {
            let mut weights: Vec<f64> = coins.iter()
                .map(|c| c.mcap.max(0.0).sqrt())
                .collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::RiskParity { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            let cov = match compute_covariance_matrix(coins, history, date, *lookback_days) {
                Some(c) => c,
                None => return vec![1.0 / n as f64; n], // fallback to equal
            };

            // Iterative risk parity: target equal risk contribution per asset.
            // Start with inverse-vol weights, then iterate.
            let mut weights: Vec<f64> = (0..n).map(|i| {
                let var = cov[i][i].max(1e-12);
                1.0 / var.sqrt()
            }).collect();
            normalize_weights(&mut weights);

            for _ in 0..50 {
                let sigma_w = mat_vec_mul(&cov, &weights);
                let port_vol_sq: f64 = weights.iter().zip(sigma_w.iter())
                    .map(|(w, sw)| w * sw).sum();
                if port_vol_sq <= 0.0 { break; }

                // Risk contribution: rc_i = w_i * (Σw)_i
                let rc: Vec<f64> = weights.iter().zip(sigma_w.iter())
                    .map(|(w, sw)| w * sw).collect();

                // Adjust: new_w_i ∝ 1/rc_i (equalize risk contributions)
                let mut new_weights: Vec<f64> = rc.iter()
                    .map(|r| if *r > 1e-15 { 1.0 / r } else { 1e12 })
                    .collect();
                normalize_weights(&mut new_weights);

                // Damped update for stability
                for i in 0..n {
                    weights[i] = 0.5 * weights[i] + 0.5 * new_weights[i];
                }
                normalize_weights(&mut weights);
            }
            weights
        }

        Weighting::MinVariance { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            let cov = match compute_covariance_matrix(coins, history, date, *lookback_days) {
                Some(c) => c,
                None => return vec![1.0 / n as f64; n],
            };

            // Iterative min-variance: w_new_i ∝ 1/(Σw)_i, project to simplex.
            let mut weights = vec![1.0 / n as f64; n];

            for _ in 0..100 {
                let sigma_w = mat_vec_mul(&cov, &weights);
                let mut new_weights: Vec<f64> = sigma_w.iter()
                    .map(|sw| if *sw > 1e-15 { 1.0 / sw } else { 1e12 })
                    .collect();
                // Clamp negatives to 0 (long-only constraint)
                for w in new_weights.iter_mut() {
                    if *w < 0.0 { *w = 0.0; }
                }
                normalize_weights(&mut new_weights);

                // Damped update
                for i in 0..n {
                    weights[i] = 0.7 * weights[i] + 0.3 * new_weights[i];
                }
                normalize_weights(&mut weights);
            }
            weights
        }

        Weighting::MultiFactor { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            // Factor 1: Momentum rank (higher return = better rank = higher score)
            let returns: Vec<f64> = coins.iter().map(|c| {
                history.get(&c.coin_id)
                    .and_then(|p| compute_trailing_return(p, date, *lookback_days))
                    .unwrap_or(0.0)
            }).collect();
            let mut mom_ranked: Vec<(usize, f64)> = returns.iter().enumerate()
                .map(|(i, r)| (i, *r)).collect();
            mom_ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            let mut mom_scores = vec![0.0; n];
            for (rank, (idx, _)) in mom_ranked.iter().enumerate() {
                mom_scores[*idx] = (n - rank) as f64; // n=best, 1=worst
            }

            // Factor 2: Low volatility rank (lower vol = better rank = higher score)
            let vols: Vec<f64> = coins.iter().map(|c| {
                history.get(&c.coin_id)
                    .and_then(|p| compute_annualized_volatility(p, date, *lookback_days))
                    .unwrap_or(2.0) // high default penalizes missing data
            }).collect();
            let mut vol_ranked: Vec<(usize, f64)> = vols.iter().enumerate()
                .map(|(i, v)| (i, *v)).collect();
            vol_ranked.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
            let mut vol_scores = vec![0.0; n];
            for (rank, (idx, _)) in vol_ranked.iter().enumerate() {
                vol_scores[*idx] = (n - rank) as f64;
            }

            // Factor 3: Market cap rank (higher mcap = better rank = higher score)
            let mut mcap_ranked: Vec<(usize, f64)> = coins.iter().enumerate()
                .map(|(i, c)| (i, c.mcap)).collect();
            mcap_ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            let mut mcap_scores = vec![0.0; n];
            for (rank, (idx, _)) in mcap_ranked.iter().enumerate() {
                mcap_scores[*idx] = (n - rank) as f64;
            }

            // Composite: equal-weight the three factors
            let mut weights: Vec<f64> = (0..n).map(|i| {
                (mom_scores[i] + vol_scores[i] + mcap_scores[i]).max(0.01)
            }).collect();
            normalize_weights(&mut weights);
            weights
        }

        Weighting::LowVolatility { lookback_days } => {
            let history = match price_history {
                Some(h) => h,
                None => return vec![1.0 / n as f64; n],
            };

            // Compute vol for each asset, keep only the least volatile half
            let mut vol_idx: Vec<(usize, f64)> = coins.iter().enumerate().map(|(i, c)| {
                let vol = history.get(&c.coin_id)
                    .and_then(|p| compute_annualized_volatility(p, date, *lookback_days))
                    .unwrap_or(f64::MAX);
                (i, vol)
            }).collect();

            vol_idx.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

            // Keep bottom half (least volatile), equal-weight among those
            let keep_count = (n / 2).max(1);
            let mut weights = vec![0.0; n];
            for (rank, (idx, _)) in vol_idx.iter().enumerate() {
                if rank < keep_count {
                    weights[*idx] = 1.0 / keep_count as f64;
                }
            }
            weights
        }

        // ---- DeFi-metric weighting strategies ----

        Weighting::TvlWeight => {
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.tvl.max(0.0)).unwrap_or(0.0)
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            // Apply 0.5% floor (same as Mcap)
            let min_weight = 0.005;
            for w in &mut weights { *w /= sum; }
            let mut excess = 0.0;
            let mut floored_count = 0;
            for w in weights.iter_mut() {
                if *w < min_weight {
                    excess += min_weight - *w;
                    *w = min_weight;
                    floored_count += 1;
                }
            }
            if excess > 0.0 && floored_count < n {
                let non_floored_total: f64 = weights.iter().filter(|w| **w > min_weight).sum();
                if non_floored_total > 0.0 {
                    for w in weights.iter_mut() {
                        if *w > min_weight {
                            *w -= excess * (*w / non_floored_total);
                        }
                    }
                }
            }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::TvlCapped { cap_pct } => {
            let tvls: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.tvl.max(0.0)).unwrap_or(0.0)
            }).collect();
            let total: f64 = tvls.iter().sum();
            if total <= 0.0 { return vec![1.0 / n as f64; n]; }

            let mut weights: Vec<f64> = tvls.iter().map(|t| t / total).collect();
            let cap = cap_pct / 100.0;

            for _ in 0..20 {
                let mut excess = 0.0_f64;
                for w in weights.iter_mut() {
                    if *w > cap {
                        excess += *w - cap;
                        *w = cap;
                    }
                }
                if excess < 1e-10 { break; }
                let uncapped_sum: f64 = weights.iter().filter(|w| **w < cap - 1e-10).sum();
                if uncapped_sum <= 0.0 { break; }
                for w in weights.iter_mut() {
                    if *w < cap - 1e-10 {
                        *w += excess * (*w / uncapped_sum);
                    }
                }
            }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::TvlSqrt => {
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.tvl.max(0.0)).unwrap_or(0.0).sqrt()
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::FeesWeight => {
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.fees_24h.max(0.0)).unwrap_or(0.0)
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::RevenueWeight => {
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.revenue_24h.max(0.0)).unwrap_or(0.0)
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::VolumeWeight => {
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.volume_24h.max(0.0)).unwrap_or(0.0)
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::TvlMomentum { lookback_days } => {
            // TVL momentum: ratio of current TVL to TVL N days ago
            let cutoff = date - chrono::Duration::days(*lookback_days as i64);
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                let current_tvl = defi_metrics.get(&c.coin_id)
                    .map(|m| m.tvl).unwrap_or(0.0);
                if current_tvl <= 0.0 { return 0.0; }

                // Find TVL nearest to cutoff date
                let past_tvl = defi_history.get(&c.coin_id)
                    .and_then(|hist| {
                        // Find closest date >= cutoff within a 7-day window
                        (0..7).find_map(|offset| {
                            let d = cutoff + chrono::Duration::days(offset);
                            hist.get(&d).map(|m| m.tvl)
                        })
                    })
                    .unwrap_or(0.0);

                if past_tvl <= 0.0 { return 0.01; } // small weight for new protocols
                let ratio = current_tvl / past_tvl;
                // Shift so all positive: ratio itself is already positive
                ratio.max(0.01)
            }).collect();

            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::FeeEfficiency => {
            // Fee efficiency = fees_24h / TVL (higher = more capital-efficient)
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                let metrics = match defi_metrics.get(&c.coin_id) {
                    Some(m) => m,
                    None => return 0.0,
                };
                let tvl = metrics.tvl;
                let fees = metrics.fees_24h;
                if tvl <= 0.0 || fees <= 0.0 { return 0.0; }
                (fees / tvl).max(0.0)
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }

        Weighting::YieldWeight => {
            let mut weights: Vec<f64> = coins.iter().map(|c| {
                defi_metrics.get(&c.coin_id).map(|m| m.max_yield_apy.max(0.0)).unwrap_or(0.0)
            }).collect();
            let sum: f64 = weights.iter().sum();
            if sum <= 0.0 { return vec![1.0 / n as f64; n]; }
            normalize_weights(&mut weights);
            weights
        }
    }
}

fn compute_stats(
    nav_series: &[db::SimNavPoint],
    _trades: &[db::SimTradeRow],
    total_fees_usd: f64,
    total_rebalances: i32,
    total_delistings: i32,
) -> SimStats {
    if nav_series.is_empty() {
        return SimStats {
            total_return_pct: 0.0,
            annualized_return: 0.0,
            max_drawdown_pct: 0.0,
            sharpe_ratio: 0.0,
            total_fees_pct: 0.0,
            total_trades: 0,
            total_rebalances: 0,
            total_delistings: 0,
            start_date: None,
            end_date: None,
        };
    }

    let first_nav = nav_series.first().map(|p| p.nav).unwrap_or(1.0);
    let last_nav = nav_series.last().map(|p| p.nav).unwrap_or(1.0);
    let total_return_pct = (last_nav / first_nav - 1.0) * 100.0;

    let start_date = nav_series.first().map(|p| p.nav_date);
    let end_date = nav_series.last().map(|p| p.nav_date);

    // Annualized return
    let days = if let (Some(s), Some(e)) = (start_date, end_date) {
        (e - s).num_days() as f64
    } else {
        1.0
    };
    let years = days / 365.25;
    let annualized_return = if years > 0.0 && last_nav / first_nav > 0.0 {
        ((last_nav / first_nav).powf(1.0 / years) - 1.0) * 100.0
    } else {
        0.0
    };

    // Max drawdown
    let max_drawdown_pct = nav_series.iter()
        .map(|p| p.drawdown_pct)
        .fold(0.0_f64, |a, b| a.min(b));

    // Sharpe ratio: mean(daily_ret) / std(daily_ret) * sqrt(365)
    let daily_returns: Vec<f64> = nav_series.windows(2)
        .map(|w| (w[1].nav / w[0].nav) - 1.0)
        .collect();

    let sharpe_ratio = if daily_returns.len() > 1 {
        let mean = daily_returns.iter().sum::<f64>() / daily_returns.len() as f64;
        let variance = daily_returns.iter()
            .map(|r| (r - mean).powi(2))
            .sum::<f64>() / (daily_returns.len() - 1) as f64;
        let std_dev = variance.sqrt();
        if std_dev > 0.0 {
            (mean / std_dev) * (365.0_f64).sqrt()
        } else {
            0.0
        }
    } else {
        0.0
    };

    // Total fees as % of initial value
    let total_fees_pct = total_fees_usd / first_nav * 100.0;

    // Count total trades
    let total_trades = _trades.len() as i32;

    SimStats {
        total_return_pct,
        annualized_return,
        max_drawdown_pct,
        sharpe_ratio,
        total_fees_pct,
        total_trades,
        total_rebalances,
        total_delistings,
        start_date,
        end_date,
    }
}

// ---- Pipeline Stage Functions ----

/// STAGE 1: Determine if rebalance should happen today.
/// Consolidates threshold, FNG trigger/frequency, and base schedule logic.
fn resolve_rebalance_trigger(
    holdings: &[Holding],
    days_since: i32,
    base_rebalance_days: i32,
    threshold_pct: Option<f64>,
    today_prices: &HashMap<String, f64>,
    last_target_weights: &HashMap<String, f64>,
    signals: &DayRegimeSignals,
    fng_regime: Option<&FngRegime>,
    fng_prev: Option<i32>,
) -> bool {
    // Empty holdings → always rebalance
    if holdings.is_empty() {
        return true;
    }

    // FNG regime overrides (trigger/frequency modes)
    if let (Some(regime), Some(fng)) = (fng_regime, signals.fng_value) {
        match regime.mode.as_str() {
            "trigger" => {
                // Rebalance only on FNG threshold crossover
                if let Some(prev) = fng_prev {
                    let crossed_fear = prev > regime.fear_threshold && fng <= regime.fear_threshold;
                    let crossed_greed = prev < regime.greed_threshold && fng >= regime.greed_threshold;
                    if crossed_fear || crossed_greed {
                        return true;
                    }
                }
                // 365d safety net
                return days_since >= 365;
            }
            "frequency" => {
                let interval = if fng <= regime.fear_threshold {
                    14  // Fear: every 2 weeks
                } else if fng >= regime.greed_threshold {
                    90  // Greed: every 3 months
                } else {
                    base_rebalance_days
                };
                return days_since >= interval;
            }
            _ => {} // Other FNG modes don't override rebalance schedule
        }
    }

    // Threshold-based drift check
    if let Some(threshold) = threshold_pct {
        return should_threshold_rebalance(holdings, today_prices, last_target_weights, threshold)
            || days_since >= 365; // safety: at least once per year
    }

    // Base schedule
    days_since >= base_rebalance_days
}

/// STAGE 2: Compute effective params with explicit DOM > FNG precedence.
fn resolve_effective_params(
    base_top_n: i32,
    base_weighting: &Weighting,
    signals: &DayRegimeSignals,
    fng_regime: Option<&FngRegime>,
    dom_regime: Option<&DominanceRegime>,
) -> EffectiveParams {
    let mut top_n = base_top_n;
    let mut weighting = base_weighting.clone();
    let mut cash_fraction = 0.0_f64;

    // Track which params have been overridden
    let mut top_n_set = false;
    let mut weighting_set = false;

    // --- Dominance regime (highest priority for top_n + weighting) ---
    if let (Some(regime), Some(_btc_dom)) = (dom_regime, signals.btc_dom) {
        let trend = signals.btc_dom_trend;

        // Combo mode: 4-quadrant matrix overrides BOTH → STOP
        if regime.mode == "combo" {
            if let Some(fng) = signals.fng_value {
                let (combo_n, combo_w) = dom_fng_combo(fng, trend);
                if let Some(n) = combo_n { top_n = n; top_n_set = true; }
                if let Some(w) = combo_w { weighting = w; weighting_set = true; }
            }
        }

        if !top_n_set {
            if let Some(btc_dom) = signals.btc_dom {
                match regime.mode.as_str() {
                    "breadth" | "alt_rotator" | "alts_when_low" => {
                        if btc_dom < 50.0 {
                            top_n = base_top_n.max(50);
                            top_n_set = true;
                        } else if btc_dom > 60.0 {
                            top_n = 5;
                            top_n_set = true;
                        }
                    }
                    "trend_filter" => {
                        if signals.dom_zone == DomZone::Rising {
                            top_n = 5;
                            top_n_set = true;
                        }
                    }
                    "alts_when_falling" => {
                        if signals.dom_zone == DomZone::Falling {
                            top_n = base_top_n.max(50);
                            top_n_set = true;
                        } else if signals.dom_zone == DomZone::Rising {
                            top_n = 5;
                            top_n_set = true;
                        }
                    }
                    "btc_when_high" => {
                        if btc_dom > 55.0 {
                            top_n = 5;
                            top_n_set = true;
                        }
                    }
                    _ => {}
                }
            }
        }

        if !weighting_set {
            if regime.mode == "momentum" {
                if trend < -3.0 {
                    weighting = Weighting::Momentum { lookback_days: 90 };
                    weighting_set = true;
                } else if trend > 3.0 {
                    weighting = Weighting::Mcap;
                    weighting_set = true;
                }
            }
        }
    }

    // --- FNG regime (only if DOM did NOT override same param) ---
    if let (Some(regime), Some(fng)) = (fng_regime, signals.fng_value) {
        // top_n_scaler: only if DOM didn't set top_n
        if !top_n_set && regime.mode == "top_n_scaler" {
            if fng <= regime.fear_threshold {
                top_n = 5;
            } else if fng >= regime.greed_threshold {
                top_n = base_top_n.max(30);
            }
        }

        // risk_toggle: only if DOM didn't set weighting
        if !weighting_set && regime.mode == "risk_toggle" {
            if fng <= regime.fear_threshold {
                weighting = Weighting::Momentum { lookback_days: 90 };
            } else if fng >= regime.greed_threshold {
                weighting = Weighting::MinVariance { lookback_days: 60 };
            }
        }

        // quality_rotation: concentrate + defensive in fear, expand + momentum in greed
        if regime.mode == "quality_rotation" {
            if fng <= regime.fear_threshold {
                if !top_n_set { top_n = 5; }
                if !weighting_set { weighting = Weighting::MinVariance { lookback_days: 60 }; }
            } else if fng >= regime.greed_threshold {
                if !top_n_set { top_n = base_top_n.max(50); }
                if !weighting_set { weighting = Weighting::Momentum { lookback_days: 90 }; }
            }
        }

        // trend_follow: use 14d FNG direction, not absolute level
        if !weighting_set && regime.mode == "trend_follow" {
            let ft = signals.fng_trend;
            if ft > 5.0 {
                // Sentiment improving → ride momentum
                weighting = Weighting::Momentum { lookback_days: 90 };
            } else if ft < -5.0 {
                // Sentiment deteriorating → get defensive
                weighting = Weighting::InverseVolatility { lookback_days: 60 };
            }
        }

        // cash / cash_shift: binary cash allocation at greed threshold
        if matches!(regime.mode.as_str(), "cash" | "cash_shift") && fng >= regime.greed_threshold {
            cash_fraction = regime.cash_pct_greed.clamp(0.0, 0.95);
        }

        // graduated_cash: proportional cash ramp between fear and greed thresholds
        if regime.mode == "graduated_cash" {
            let f = regime.fear_threshold as f64;
            let g = regime.greed_threshold as f64;
            let fng_f = fng as f64;
            if fng_f <= f {
                cash_fraction = 0.0;
            } else if fng_f >= g {
                cash_fraction = regime.cash_pct_greed.clamp(0.0, 0.95);
            } else {
                // Linear interpolation between thresholds
                cash_fraction = ((fng_f - f) / (g - f)) * regime.cash_pct_greed;
                cash_fraction = cash_fraction.clamp(0.0, 0.95);
            }
        }
    }

    EffectiveParams { top_n, weighting, cash_fraction }
}

/// STAGE 3: Filter eligible coins (category + Bitget + price > 0 + VC eligibility).
fn filter_eligible_coins<'a>(
    all_coins: &'a [CoinSnapshot],
    category_coin_ids: &HashSet<String>,
    coin_symbol_map: &HashMap<String, String>,
    bitget_lookup: &HashMap<String, db::BitgetListingRow>,
    date: NaiveDate,
    vc_eligibility: Option<&VcEligibility>,
    defi_metrics: &HashMap<String, DefiCoinMetrics>,
) -> Vec<&'a CoinSnapshot> {
    let mut eligible: Vec<&CoinSnapshot> = all_coins.iter().filter(|c| {
        category_coin_ids.contains(&c.coin_id)
        && if let Some(sym) = coin_symbol_map.get(&c.coin_id) {
            c.price > 0.0 && is_listed_on_bitget(sym, bitget_lookup, date)
        } else {
            false
        }
    }).collect();

    // Apply VC eligibility filter (pre-top-N)
    if let Some(vc) = vc_eligibility {
        let filtered: Vec<&CoinSnapshot> = eligible.iter().copied().filter(|c| {
            match defi_metrics.get(&c.coin_id) {
                Some(m) => vc.is_eligible(m),
                None => false, // no VC data → excluded when VC active
            }
        }).collect();
        // Fallback: if <5 pass VC filter, relax (keep all)
        if filtered.len() >= 5 {
            eligible = filtered;
        }
    }

    eligible
}

/// STAGE 5: Apply weight modifiers in fixed order.
/// Order: VC multiplier → FNG contrarian → DOM weighted_split → trend_filter clamp.
fn apply_weight_modifiers(
    weights: &mut Vec<f64>,
    coins: &[&CoinSnapshot],
    signals: &DayRegimeSignals,
    config: &SimConfig,
    defi_metrics: &HashMap<String, DefiCoinMetrics>,
    price_history: Option<&HashMap<String, Vec<(NaiveDate, f64)>>>,
    date: NaiveDate,
) {
    let n = weights.len();
    if n == 0 { return; }

    let dom_is_weighted_split = config.dominance_regime.as_ref()
        .map(|r| matches!(r.mode.as_str(), "weighted_split" | "alts_when_low")).unwrap_or(false);
    let dom_is_trend_filter = config.dominance_regime.as_ref()
        .map(|r| matches!(r.mode.as_str(), "trend_filter" | "btc_when_high")).unwrap_or(false);
    let dom_is_alts_falling = config.dominance_regime.as_ref()
        .map(|r| r.mode == "alts_when_falling").unwrap_or(false);

    // 1. VC multiplier (eligibility already handled in Stage 3)
    if let Some(ref vc_mode) = config.vc_mode {
        vc_apply_multiplier(weights, coins, defi_metrics, vc_mode);
    }

    // 2. FNG contrarian — skip BTC when DOM weighted_split is also active
    if let Some(ref regime) = config.fng_regime {
        if regime.mode == "contrarian" {
            if let Some(fng) = signals.fng_value {
                fng_contrarian_adjust(weights, coins, fng, price_history, date, dom_is_weighted_split);
            }
        }
    }

    // 3. DOM weighted_split — set BTC weight = btc_dom%, scale alts
    if dom_is_weighted_split {
        if let Some(btc_dom) = signals.btc_dom {
            dom_weighted_split(weights, coins, btc_dom);
        }
    }

    // 4. DOM trend_filter weight clamp — when rising, BTC ≥40%, zero outside top 5
    if dom_is_trend_filter && signals.dom_zone == DomZone::Rising {
        // Ensure BTC gets ≥40%
        if let Some(btc_idx) = coins.iter().position(|c| c.coin_id == "bitcoin") {
            if weights[btc_idx] < 0.4 {
                weights[btc_idx] = 0.4;
            }
        }
        // Zero weights for coins ranked beyond top 5 mcap
        // (coins are already sorted by mcap DESC from filter_eligible_coins)
        for i in 5..n {
            weights[i] = 0.0;
        }
        // Re-normalize
        let sum: f64 = weights.iter().sum();
        if sum > 0.0 {
            for w in weights.iter_mut() {
                *w /= sum;
            }
        }
    }

    // 5. DOM alts_when_falling — weighted_split when falling, trend_filter when rising
    if dom_is_alts_falling {
        if signals.dom_zone == DomZone::Falling {
            if let Some(btc_dom) = signals.btc_dom {
                dom_weighted_split(weights, coins, btc_dom);
            }
        } else if signals.dom_zone == DomZone::Rising {
            if let Some(btc_idx) = coins.iter().position(|c| c.coin_id == "bitcoin") {
                if weights[btc_idx] < 0.4 {
                    weights[btc_idx] = 0.4;
                }
            }
            for i in 5..n {
                weights[i] = 0.0;
            }
            let sum: f64 = weights.iter().sum();
            if sum > 0.0 {
                for w in weights.iter_mut() {
                    *w /= sum;
                }
            }
        }
    }
}

/// VC multiplier: multiply weights based on VC funding metrics, then re-normalize.
/// Eligibility filtering already done in Stage 3 — this only applies multipliers.
fn vc_apply_multiplier(
    weights: &mut Vec<f64>,
    coins: &[&CoinSnapshot],
    defi_metrics: &HashMap<String, DefiCoinMetrics>,
    vc_mode: &str,
) {
    for (i, coin) in coins.iter().enumerate() {
        let metrics = match defi_metrics.get(&coin.coin_id) {
            Some(m) => m,
            None => continue,
        };

        let multiplier = match vc_mode {
            "funding" => metrics.total_funding_m.max(0.0),
            "valuation" => metrics.latest_valuation_m.unwrap_or(0.0).max(0.0),
            s if s.starts_with("fresh_") => {
                if metrics.latest_funding_m > 0.0 { metrics.latest_funding_m } else { 0.01 }
            }
            _ => 1.0,
        };
        weights[i] *= multiplier;
    }

    // Re-normalize
    let sum: f64 = weights.iter().sum();
    if sum > 0.0 {
        for w in weights.iter_mut() {
            *w /= sum;
        }
    }
}

// ---- FNG Regime Helpers ----

/// FNG contrarian: adjust weights based on fear/greed and coin volatility.
/// When skip_btc=true, don't modify BTC weight (DOM weighted_split will handle it).
fn fng_contrarian_adjust(
    weights: &mut Vec<f64>,
    coins: &[&CoinSnapshot],
    fng: i32,
    price_history: Option<&HashMap<String, Vec<(NaiveDate, f64)>>>,
    date: NaiveDate,
    skip_btc: bool,
) {
    let n = weights.len();
    if n == 0 { return; }

    // Compute 30d volatility for each coin
    let vols: Vec<f64> = coins.iter().map(|c| {
        price_history.and_then(|ph| ph.get(&c.coin_id)).map(|prices| {
            compute_trailing_volatility(prices, date, 30)
        }).unwrap_or(1.0)
    }).collect();

    // Extreme Fear (<20): overweight high-beta (high vol)
    // Extreme Greed (>80): overweight low-vol
    let vol_sum: f64 = vols.iter().sum();
    if vol_sum <= 0.0 { return; }

    for i in 0..n {
        if skip_btc && coins[i].coin_id == "bitcoin" {
            continue;
        }
        let vol_frac = vols[i] / vol_sum;
        if fng <= 20 {
            // Contrarian: buy the dip — overweight volatile coins
            weights[i] *= 1.0 + vol_frac;
        } else if fng >= 80 {
            // Defensive: overweight stable coins
            let inv_vol = 1.0 / vols[i].max(0.001);
            let inv_vol_sum: f64 = vols.iter().map(|v| 1.0 / v.max(0.001)).sum();
            weights[i] *= 1.0 + (inv_vol / inv_vol_sum);
        }
    }

    // Re-normalize
    let sum: f64 = weights.iter().sum();
    if sum > 0.0 {
        for w in weights.iter_mut() {
            *w /= sum;
        }
    }
}

// ---- Dominance Regime Helpers ----

/// Rolling delta of FNG index over 14 days.
fn fng_trend(fng_index: &HashMap<NaiveDate, i32>, date: NaiveDate) -> f64 {
    let past = date - chrono::Duration::days(14);
    let fng_now = fng_index.get(&date).copied().unwrap_or(50) as f64;
    let fng_past = (0..5).filter_map(|offset| {
        fng_index.get(&(past + chrono::Duration::days(offset)))
    }).next().copied().unwrap_or(50) as f64;
    fng_now - fng_past
}

/// Rolling delta of BTC dominance over lookback days.
fn btc_dom_trend(btc_dominance: &HashMap<NaiveDate, f64>, date: NaiveDate, lookback: i32) -> f64 {
    let past = date - chrono::Duration::days(lookback as i64);
    let dom_now = btc_dominance.get(&date).copied().unwrap_or(50.0);
    // Find nearest past date
    let dom_past = (0..5).filter_map(|offset| {
        btc_dominance.get(&(past + chrono::Duration::days(offset)))
    }).next().copied().unwrap_or(dom_now);
    dom_now - dom_past
}

/// Dominance weighted_split: allocate btc_dom% to BTC, rest to index.
fn dom_weighted_split(
    weights: &mut Vec<f64>,
    coins: &[&CoinSnapshot],
    btc_dom: f64,
) {
    let n = weights.len();
    if n == 0 { return; }

    let btc_frac = (btc_dom / 100.0).clamp(0.0, 0.95);

    // Find BTC index
    let btc_idx = coins.iter().position(|c| c.coin_id == "bitcoin");

    if let Some(idx) = btc_idx {
        // Scale non-BTC weights to fill (1 - btc_frac)
        let non_btc_sum: f64 = weights.iter().enumerate()
            .filter(|(i, _)| *i != idx)
            .map(|(_, w)| *w)
            .sum();
        if non_btc_sum > 0.0 {
            for (i, w) in weights.iter_mut().enumerate() {
                if i == idx {
                    *w = btc_frac;
                } else {
                    *w = (*w / non_btc_sum) * (1.0 - btc_frac);
                }
            }
        }
    }
}

/// Dominance + FNG combo: 4-quadrant matrix.
fn dom_fng_combo(fng: i32, btc_dom_trend_val: f64) -> (Option<i32>, Option<Weighting>) {
    let fear = fng <= 25;
    let greed = fng >= 75;
    let rising = btc_dom_trend_val > 2.0;
    let falling = btc_dom_trend_val < -2.0;

    if fear && rising {
        // BTC accumulation mode
        (Some(5), Some(Weighting::Mcap))
    } else if greed && falling {
        // Max alt breadth
        (Some(100), Some(Weighting::Equal))
    } else if fear && falling {
        // Defensive alt play
        (Some(20), Some(Weighting::MinVariance { lookback_days: 60 }))
    } else if greed && rising {
        // Risk-on concentration
        (Some(10), Some(Weighting::Momentum { lookback_days: 90 }))
    } else {
        (None, None)
    }
}

/// Compute trailing volatility (std dev of daily returns) over lookback_days.
fn compute_trailing_volatility(prices: &[(NaiveDate, f64)], date: NaiveDate, lookback_days: i32) -> f64 {
    let cutoff = date - chrono::Duration::days(lookback_days as i64);
    let relevant: Vec<f64> = prices.iter()
        .filter(|(d, _)| *d >= cutoff && *d <= date)
        .map(|(_, p)| *p)
        .collect();

    if relevant.len() < 2 { return 1.0; }

    let returns: Vec<f64> = relevant.windows(2)
        .map(|w| if w[0] > 0.0 { (w[1] - w[0]) / w[0] } else { 0.0 })
        .collect();

    if returns.is_empty() { return 1.0; }

    let mean = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;
    variance.sqrt().max(0.001)
}
