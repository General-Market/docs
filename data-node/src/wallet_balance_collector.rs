//! Wallet balance collector — hourly poll of oracle wallet native-gas balances
//! on L3 (GM) and Sonic testnet (S). Persists to `wallet_balance_snapshots`,
//! exposes a public read API at `/oracle/balances`.
//!
//! Scope is "oracle" only: the three main oracle keys (per-node, used by tx
//! signers and the fund-manager treasury) and the six fleet keys (two per
//! oracle, used by the per-source createBatch / settleBatch leaders).

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

const RETENTION_DAYS: i64 = 30;
/// Once per day at the default hourly poll interval.
const PRUNE_EVERY_N_CYCLES: u64 = 24;
const MIN_POLL_SECS: u64 = 60;

#[derive(Clone, Copy)]
pub struct WalletTarget {
    pub address: &'static str,
    pub label: &'static str,
}

/// Oracle wallet roster. Order is the chart's display order.
pub const ORACLE_WALLETS: &[WalletTarget] = &[
    WalletTarget { address: "0xC0D3C9E530ca6d71469bB678E6592274154D9caD", label: "oracle-1 main" },
    WalletTarget { address: "0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4", label: "oracle-2 main (treasury)" },
    WalletTarget { address: "0xC0D3C8DFd3445fd2e4dfED9D11b5B7032B3BD1ac", label: "oracle-3 main" },
    WalletTarget { address: "0xba03882C83a8d6af6f61a6B2071B955971C80b44", label: "oracle-1 fleet #1" },
    WalletTarget { address: "0x37eF0D9d6574d3Beb59E827f0A3D2c66609f799b", label: "oracle-1 fleet #2" },
    WalletTarget { address: "0x6B4cBc6fDe99B681910EB8205B234C3D7CCCc7c3", label: "oracle-2 fleet #1" },
    WalletTarget { address: "0x3Ede2E74aAb30167eC6a949E568Af3Ddf5223696", label: "oracle-2 fleet #2" },
    WalletTarget { address: "0xdF00D68d2a230301b00712E6aB11a3c049b89877", label: "oracle-3 fleet #1" },
    WalletTarget { address: "0x82067AEC6bFC733477F713155061742c1AB80674", label: "oracle-3 fleet #2" },
];

const CHAINS: &[(&str, &str)] = &[("l3", "GM"), ("sonic", "S")];

pub async fn run_wallet_balance_collector(
    pool: PgPool,
    l3_rpc_url: String,
    sonic_rpc_url: String,
    poll_interval_secs: u64,
) {
    let interval_secs = poll_interval_secs.max(MIN_POLL_SECS);
    let interval = Duration::from_secs(interval_secs);

    let client = Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(20))
        .build()
        .expect("Failed to build wallet balance HTTP client");

    info!(
        wallets = ORACLE_WALLETS.len(),
        poll_secs = interval_secs,
        "Wallet balance collector started"
    );

    let mut cycle: u64 = 0;
    loop {
        cycle += 1;
        let ts = Utc::now();

        for (chain_key, _symbol) in CHAINS {
            let rpc_url = match *chain_key {
                "l3" => l3_rpc_url.as_str(),
                "sonic" => sonic_rpc_url.as_str(),
                _ => continue,
            };

            for wallet in ORACLE_WALLETS {
                match fetch_balance_wei(&client, rpc_url, wallet.address).await {
                    Ok(balance) => {
                        if let Err(e) = sqlx::query(
                            "INSERT INTO wallet_balance_snapshots
                             (wallet, chain, label, balance_wei, fetched_at)
                             VALUES ($1, $2, $3, $4::numeric, $5)",
                        )
                        .bind(wallet.address.to_lowercase())
                        .bind(*chain_key)
                        .bind(wallet.label)
                        .bind(balance.clone())
                        .bind(ts)
                        .execute(&pool)
                        .await
                        {
                            error!(
                                error = %e, wallet = wallet.address, chain = *chain_key,
                                "Wallet balance insert failed"
                            );
                        }
                    }
                    Err(e) => {
                        warn!(
                            error = %e, wallet = wallet.address, chain = *chain_key,
                            "Wallet balance fetch failed"
                        );
                    }
                }
            }
        }

        if cycle % PRUNE_EVERY_N_CYCLES == 0 {
            let cutoff = Utc::now() - chrono::Duration::days(RETENTION_DAYS);
            match sqlx::query("DELETE FROM wallet_balance_snapshots WHERE fetched_at < $1")
                .bind(cutoff)
                .execute(&pool)
                .await
            {
                Ok(r) => info!(
                    deleted = r.rows_affected(),
                    retention_days = RETENTION_DAYS,
                    "Pruned old wallet balance snapshots"
                ),
                Err(e) => error!(error = %e, "Wallet balance prune failed"),
            }
        }

        tokio::time::sleep(interval).await;
    }
}

async fn fetch_balance_wei(
    client: &Client,
    rpc_url: &str,
    address: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getBalance",
        "params": [address, "latest"],
    });
    let resp = client.post(rpc_url).json(&body).send().await?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()).into());
    }
    let json: serde_json::Value = resp.json().await?;
    if let Some(err) = json.get("error") {
        return Err(format!("rpc error: {err}").into());
    }
    let hex = json
        .get("result")
        .and_then(|v| v.as_str())
        .ok_or("missing result")?;
    let stripped = hex.strip_prefix("0x").unwrap_or(hex);
    let bal = u128::from_str_radix(stripped, 16)?;
    Ok(bal.to_string())
}

// ---------------------------------------------------------------------------
// Public API: GET /oracle/balances
// ---------------------------------------------------------------------------

struct BalancesState {
    pool: PgPool,
}

#[derive(Deserialize)]
struct BalancesQuery {
    /// One of: 24h, 7d, 30d. Default 7d.
    range: Option<String>,
}

#[derive(Serialize)]
struct BalancePoint {
    ts: DateTime<Utc>,
    /// Balance in whole-token units (wei / 1e18), kept as f64 for the chart.
    /// The collector preserves wei precision in the DB; here we lose dust.
    balance: f64,
}

#[derive(Serialize)]
struct WalletSeries {
    wallet: String,
    label: String,
    chain: String,
    points: Vec<BalancePoint>,
}

#[derive(Serialize)]
struct BalancesResponse {
    range: String,
    series: Vec<WalletSeries>,
    /// Static roster, useful for the frontend even before any data is in.
    roster: Vec<RosterEntry>,
}

#[derive(Serialize)]
struct RosterEntry {
    address: String,
    label: String,
}

fn range_to_secs(range: &str) -> f64 {
    match range {
        "24h" => 86_400.0,
        "7d" => 604_800.0,
        "30d" => 2_592_000.0,
        _ => 604_800.0,
    }
}

async fn balances(
    State(state): State<Arc<BalancesState>>,
    Query(q): Query<BalancesQuery>,
) -> impl IntoResponse {
    let range_str = q.range.unwrap_or_else(|| "7d".to_string());
    let secs = range_to_secs(&range_str);

    // Stream balance as text — NUMERIC(80,0) has no native Rust type in sqlx's
    // rust_decimal feature set (max 28 digits), and we don't want to take a
    // dependency on bigdecimal just to render a chart.
    #[derive(sqlx::FromRow)]
    struct Row {
        wallet: String,
        chain: String,
        label: String,
        balance_wei_text: String,
        fetched_at: DateTime<Utc>,
    }

    let rows = match sqlx::query_as::<_, Row>(
        r#"
        SELECT wallet, chain, label, balance_wei::text AS balance_wei_text, fetched_at
        FROM wallet_balance_snapshots
        WHERE fetched_at > NOW() - make_interval(secs => $1)
        ORDER BY chain, wallet, fetched_at ASC
        "#,
    )
    .bind(secs)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "wallet balance history query failed");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    use std::collections::BTreeMap;
    let mut grouped: BTreeMap<(String, String), WalletSeries> = BTreeMap::new();
    for row in rows {
        let key = (row.chain.clone(), row.wallet.clone());
        let series = grouped.entry(key).or_insert_with(|| WalletSeries {
            wallet: row.wallet.clone(),
            label: row.label.clone(),
            chain: row.chain.clone(),
            points: Vec::new(),
        });
        let balance = wei_text_to_whole(&row.balance_wei_text);
        series.points.push(BalancePoint {
            ts: row.fetched_at,
            balance,
        });
    }

    let roster: Vec<RosterEntry> = ORACLE_WALLETS
        .iter()
        .map(|w| RosterEntry {
            address: w.address.to_string(),
            label: w.label.to_string(),
        })
        .collect();

    Ok(Json(BalancesResponse {
        range: range_str,
        series: grouped.into_values().collect(),
        roster,
    }))
}

/// Convert a wei string (decimal, possibly very long) to whole tokens as f64.
/// We accept the precision loss because the chart only needs ~6 sig figs.
fn wei_text_to_whole(wei_text: &str) -> f64 {
    let bytes = wei_text.as_bytes();
    let (sign, digits): (f64, &[u8]) = if let Some(rest) = wei_text.strip_prefix('-') {
        (-1.0, rest.as_bytes())
    } else {
        (1.0, bytes)
    };
    // For balances that fit in u128 (up to ~3.4e38 wei), parse directly.
    if digits.len() <= 38 {
        if let Ok(s) = std::str::from_utf8(digits) {
            if let Ok(n) = s.parse::<u128>() {
                return sign * (n as f64) / 1e18;
            }
        }
    }
    // Fallback: lossy parse via f64.
    wei_text.parse::<f64>().unwrap_or(0.0) / 1e18
}

pub fn balances_routes(pool: PgPool) -> axum::Router {
    let state = Arc::new(BalancesState { pool });
    axum::Router::new()
        .route("/oracle/balances", axum::routing::get(balances))
        .with_state(state)
}
