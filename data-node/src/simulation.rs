use std::collections::HashMap;

use chrono::NaiveDate;
use serde::Serialize;
use sqlx::PgPool;
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::db;

// ---- Types ----

#[derive(Debug, Clone, Serialize)]
pub struct SimConfig {
    pub category_id: String,
    pub top_n: i32,
    pub weighting: Weighting,
    pub rebalance_days: i32,
    pub base_fee_pct: f64,
    pub spread_multiplier: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Weighting {
    Equal,
    Mcap,
}

impl Weighting {
    pub fn as_str(&self) -> &'static str {
        match self {
            Weighting::Equal => "equal",
            Weighting::Mcap => "mcap",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "equal" => Some(Weighting::Equal),
            "mcap" => Some(Weighting::Mcap),
            _ => None,
        }
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

// ---- Core simulation ----

pub async fn run_simulation(
    pool: &PgPool,
    config: &SimConfig,
    progress_tx: Option<mpsc::Sender<SimProgress>>,
) -> Result<SimResult, SimError> {
    let start_time = std::time::Instant::now();

    // 1. Load all snapshot dates
    let all_dates = db::cg_query_snapshot_dates(pool).await?;
    if all_dates.is_empty() {
        return Err(SimError::NoData("no CoinGecko snapshot dates found".into()));
    }

    // 2. Load category coin_ids
    let category_coin_ids = db::cg_query_category_coin_ids(pool, &config.category_id).await?;
    if category_coin_ids.is_empty() {
        return Err(SimError::NoData(format!("no coins in category {}", config.category_id)));
    }

    // 3. Load all Bitget listings (USDT pairs only) → build lookup
    let all_listings = db::bitget_query_listings(pool, None).await?;
    let bitget_lookup = build_bitget_lookup(&all_listings);

    // 4. Load coin_id → symbol mapping from CG market caps
    let coin_symbol_map = load_coin_symbol_map(pool, &category_coin_ids).await?;

    // 5. Find start date: earliest date with >= top_n Bitget-listed coins with CG price data
    let mut start_idx = None;
    for (i, date) in all_dates.iter().enumerate() {
        let eligible = count_eligible_coins(
            pool, &config.category_id, *date, &coin_symbol_map, &bitget_lookup,
        ).await?;
        if eligible >= config.top_n as usize {
            start_idx = Some(i);
            break;
        }
    }

    let start_idx = start_idx.ok_or_else(|| SimError::NotEnoughCoins {
        available: 0,
        required: config.top_n,
    })?;

    let sim_dates = &all_dates[start_idx..];
    let total_dates = sim_dates.len();

    info!(
        category = %config.category_id,
        top_n = config.top_n,
        weighting = ?config.weighting,
        rebalance_days = config.rebalance_days,
        start_date = %sim_dates[0],
        total_dates,
        "Starting simulation"
    );

    // 6. Day-by-day simulation
    let mut holdings: Vec<Holding> = Vec::new();
    let mut nav_series: Vec<db::SimNavPoint> = Vec::new();
    let mut all_holdings: Vec<db::SimHoldingRow> = Vec::new();
    let mut all_trades: Vec<db::SimTradeRow> = Vec::new();
    let mut peak_nav = 1.0_f64;
    let mut days_since_rebalance = i32::MAX; // Force rebalance on first day
    let mut total_fees_usd = 0.0_f64;
    let mut total_delistings = 0_i32;
    let mut total_rebalances = 0_i32;
    let mut portfolio_value = 1.0_f64; // Start at $1

    for (i, date) in sim_dates.iter().enumerate() {
        // Send progress every ~50 dates
        if let Some(ref tx) = progress_tx {
            if i % 50 == 0 || i == total_dates - 1 {
                let _ = tx.send(SimProgress {
                    current_date: date.to_string(),
                    total_dates,
                    pct: (i as f64 / total_dates as f64) * 100.0,
                    variant_index: None,
                    total_variants: None,
                }).await;
            }
        }

        // Load prices for held coins today
        let today_prices = load_prices_for_date(pool, &holdings, *date).await?;

        // Check delistings
        let (new_holdings, delist_trades, delist_proceeds) = check_delistings(
            &holdings, &today_prices, &bitget_lookup, *date, config,
        );
        if !delist_trades.is_empty() {
            total_delistings += delist_trades.len() as i32;
            for t in &delist_trades {
                total_fees_usd += t.fee_usd;
            }
            all_trades.extend(delist_trades);
            // Redistribute proceeds to remaining holdings
            holdings = redistribute_proceeds(new_holdings, delist_proceeds, &today_prices);
        }

        // Check if rebalance is due
        days_since_rebalance += 1;
        if days_since_rebalance >= config.rebalance_days || holdings.is_empty() {
            let rebalance_result = perform_rebalance(
                pool, config, *date, &holdings, &today_prices, &bitget_lookup, &coin_symbol_map, portfolio_value,
            ).await?;

            if !rebalance_result.new_holdings.is_empty() {
                for t in &rebalance_result.trades {
                    total_fees_usd += t.fee_usd;
                }
                all_trades.extend(rebalance_result.trades);
                all_holdings.extend(rebalance_result.holdings_snapshot);
                holdings = rebalance_result.new_holdings;
                portfolio_value = rebalance_result.post_fee_value;
                days_since_rebalance = 0;
                total_rebalances += 1;
            }
        }

        // Compute NAV
        let nav = compute_nav(&holdings, &load_prices_for_date(pool, &holdings, *date).await?);
        if nav > 0.0 {
            portfolio_value = nav;
        }

        if nav > peak_nav {
            peak_nav = nav;
        }
        let drawdown = if peak_nav > 0.0 { (nav - peak_nav) / peak_nav * 100.0 } else { 0.0 };

        nav_series.push(db::SimNavPoint {
            nav_date: *date,
            nav,
            drawdown_pct: drawdown,
        });
    }

    // 7. Compute stats
    let stats = compute_stats(&nav_series, &all_trades, total_fees_usd, total_rebalances, total_delistings);

    // 8. Store results
    let duration_ms = start_time.elapsed().as_millis() as i32;
    let run_insert = db::SimRunInsert {
        category_id: config.category_id.clone(),
        top_n: config.top_n,
        weighting: config.weighting.as_str().to_string(),
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
    db::sim_batch_insert_nav(pool, run_id, &nav_series).await?;
    db::sim_batch_insert_holdings(pool, run_id, &all_holdings).await?;
    db::sim_batch_insert_trades(pool, run_id, &all_trades).await?;

    info!(
        run_id,
        total_return = format!("{:.2}%", stats.total_return_pct),
        max_drawdown = format!("{:.2}%", stats.max_drawdown_pct),
        sharpe = format!("{:.3}", stats.sharpe_ratio),
        duration_ms,
        "Simulation complete"
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

async fn load_coin_symbol_map(
    pool: &PgPool,
    coin_ids: &[String],
) -> Result<HashMap<String, String>, SimError> {
    // coin_id → CG symbol (uppercase)
    let mut map = HashMap::new();
    // Batch query: get latest symbol for each coin_id
    for chunk in coin_ids.chunks(500) {
        let cids: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
        let rows = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT DISTINCT ON (coin_id) coin_id, symbol
             FROM coingecko_market_caps
             WHERE coin_id = ANY($1)
             ORDER BY coin_id, snapshot_date DESC"
        )
        .bind(&cids)
        .fetch_all(pool)
        .await?;

        for (coin_id, symbol) in rows {
            if let Some(sym) = symbol {
                map.insert(coin_id, sym.to_uppercase());
            }
        }
    }
    Ok(map)
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

async fn count_eligible_coins(
    pool: &PgPool,
    category_id: &str,
    date: NaiveDate,
    coin_symbol_map: &HashMap<String, String>,
    bitget_lookup: &HashMap<String, db::BitgetListingRow>,
) -> Result<usize, SimError> {
    let coins = db::cg_query_category_market_caps_at(pool, category_id, date, 500).await?;
    let count = coins.iter().filter(|c| {
        if let Some(sym) = coin_symbol_map.get(&c.coin_id) {
            c.price_usd.is_some() && c.price_usd.unwrap_or(0.0) > 0.0
                && is_listed_on_bitget(sym, bitget_lookup, date)
        } else {
            false
        }
    }).count();
    Ok(count)
}

async fn load_prices_for_date(
    pool: &PgPool,
    holdings: &[Holding],
    date: NaiveDate,
) -> Result<HashMap<String, f64>, SimError> {
    if holdings.is_empty() {
        return Ok(HashMap::new());
    }

    let coin_ids: Vec<&str> = holdings.iter().map(|h| h.coin_id.as_str()).collect();
    let rows = sqlx::query_as::<_, (String, Option<f64>)>(
        "SELECT coin_id, price_usd FROM coingecko_market_caps
         WHERE coin_id = ANY($1) AND snapshot_date = $2"
    )
    .bind(&coin_ids)
    .bind(date)
    .fetch_all(pool)
    .await?;

    let mut map = HashMap::new();
    for (coin_id, price) in rows {
        if let Some(p) = price {
            if p > 0.0 {
                map.insert(coin_id, p);
            }
        }
    }
    Ok(map)
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
                    let fee_rate = config.base_fee_pct / 100.0 + 0.001 * config.spread_multiplier; // base + 10bps spread fallback
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

async fn perform_rebalance(
    pool: &PgPool,
    config: &SimConfig,
    date: NaiveDate,
    old_holdings: &[Holding],
    _old_prices: &HashMap<String, f64>,
    bitget_lookup: &HashMap<String, db::BitgetListingRow>,
    coin_symbol_map: &HashMap<String, String>,
    portfolio_value: f64,
) -> Result<RebalanceResult, SimError> {
    // Get top N coins by market cap in this category, listed on Bitget
    let all_coins = db::cg_query_category_market_caps_at(
        pool, &config.category_id, date, 500,
    ).await?;

    // Filter to Bitget-listed coins with valid prices
    let eligible: Vec<&db::CgMarketCapRow> = all_coins.iter().filter(|c| {
        if let Some(sym) = coin_symbol_map.get(&c.coin_id) {
            c.price_usd.is_some() && c.price_usd.unwrap_or(0.0) > 0.0
                && is_listed_on_bitget(sym, bitget_lookup, date)
        } else {
            false
        }
    }).collect();

    let top_n = eligible.iter().take(config.top_n as usize).cloned().collect::<Vec<_>>();

    if top_n.is_empty() {
        return Ok(RebalanceResult {
            new_holdings: Vec::new(),
            trades: Vec::new(),
            holdings_snapshot: Vec::new(),
            post_fee_value: portfolio_value,
        });
    }

    // Compute weights
    let weights = compute_weights(&top_n, config.weighting);

    // Compute target quantities: qty[i] = (weight[i] * portfolio_value) / price[i]
    let mut new_holdings = Vec::new();
    let mut holdings_snapshot = Vec::new();
    let mut trades = Vec::new();
    let mut _total_trade_value = 0.0_f64;

    // Build old holdings map for delta computation
    let old_map: HashMap<String, &Holding> = old_holdings.iter()
        .map(|h| (h.coin_id.clone(), h))
        .collect();

    for (coin, weight) in top_n.iter().zip(weights.iter()) {
        let price = coin.price_usd.unwrap_or(0.0);
        if price <= 0.0 {
            continue;
        }

        let target_value = weight * portfolio_value;
        let target_qty = target_value / price;

        let symbol = coin_symbol_map.get(&coin.coin_id)
            .cloned()
            .unwrap_or_else(|| coin.symbol.clone().unwrap_or_default().to_uppercase());

        // Compute trade delta
        let old_qty = old_map.get(&coin.coin_id).map(|h| h.quantity).unwrap_or(0.0);
        let delta_qty = target_qty - old_qty;

        if delta_qty.abs() * price > 0.01 { // Skip dust trades
            let side = if delta_qty > 0.0 { "buy" } else { "sell" };
            let trade_value = delta_qty.abs() * price;
            let fee_rate = config.base_fee_pct / 100.0 + 0.001 * config.spread_multiplier; // base + 10bps fallback spread
            let fee_usd = trade_value * fee_rate;
            _total_trade_value += trade_value;

            trades.push(db::SimTradeRow {
                trade_date: date,
                coin_id: coin.coin_id.clone(),
                side: side.into(),
                quantity: delta_qty.abs(),
                price_usd: price,
                fee_pct: fee_rate * 100.0,
                fee_usd,
                reason: Some("rebalance".into()),
            });
        }

        new_holdings.push(Holding {
            coin_id: coin.coin_id.clone(),
            symbol: symbol.clone(),
            quantity: target_qty,
            last_price: price,
        });

        holdings_snapshot.push(db::SimHoldingRow {
            rebalance_date: date,
            coin_id: coin.coin_id.clone(),
            symbol,
            weight: *weight,
            quantity: target_qty,
            price_usd: price,
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

    Ok(RebalanceResult {
        new_holdings,
        trades,
        holdings_snapshot,
        post_fee_value,
    })
}

fn compute_weights(coins: &[&db::CgMarketCapRow], weighting: Weighting) -> Vec<f64> {
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
                .map(|c| c.market_cap_usd.unwrap_or(0.0).max(0.0))
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

            // Normalize to ensure sum = 1.0
            let sum: f64 = weights.iter().sum();
            if sum > 0.0 {
                for w in &mut weights {
                    *w /= sum;
                }
            }

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
