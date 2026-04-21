//! Prometheus exporter. Minimum viable observability — the scheduler
//! publishes gauges, an HTTP server exposes `/metrics`.
//!
//! SA14: at boot the daemon queries its SOL balance. If it is below the
//! configured floor, the process refuses to start — systemd's restart loop
//! then makes the outage visible instead of quietly-failing transactions.

use anyhow::{Context, Result};
use hyper::body::Bytes;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use http_body_util::Full;
use prometheus::{Counter, Encoder, Gauge, Registry, TextEncoder};
use solana_pubkey::Pubkey;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::{error, info};

#[derive(Clone)]
pub struct Metrics {
    pub registry: Arc<Registry>,
    pub keypair_sol_balance: Gauge,
    pub markets_awaiting_close: Gauge,
    pub markets_awaiting_resolve: Gauge,
    pub markets_awaiting_claim: Gauge,
    pub last_tx_success_ts: Gauge,
    pub tx_failures_total: Counter,
}

impl Metrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        let keypair_sol_balance = Gauge::new(
            "oracle_keypair_sol_balance",
            "Current SOL balance of the oracle keypair.",
        )?;
        let markets_awaiting_close = Gauge::new(
            "markets_awaiting_close",
            "Markets where close_time has passed but baseline is unset.",
        )?;
        let markets_awaiting_resolve = Gauge::new(
            "markets_awaiting_resolve",
            "Markets with a baseline where settlement_time has passed but resolved=false.",
        )?;
        let markets_awaiting_claim = Gauge::new(
            "markets_awaiting_claim",
            "Resolved markets with at least one open Position.",
        )?;
        let last_tx_success_ts = Gauge::new(
            "last_tx_success_ts",
            "Unix timestamp of the last successfully-confirmed transaction.",
        )?;
        let tx_failures_total = Counter::new(
            "tx_failures_total",
            "Cumulative transaction failures since process boot.",
        )?;

        registry.register(Box::new(keypair_sol_balance.clone()))?;
        registry.register(Box::new(markets_awaiting_close.clone()))?;
        registry.register(Box::new(markets_awaiting_resolve.clone()))?;
        registry.register(Box::new(markets_awaiting_claim.clone()))?;
        registry.register(Box::new(last_tx_success_ts.clone()))?;
        registry.register(Box::new(tx_failures_total.clone()))?;

        Ok(Self {
            registry: Arc::new(registry),
            keypair_sol_balance,
            markets_awaiting_close,
            markets_awaiting_resolve,
            markets_awaiting_claim,
            last_tx_success_ts,
            tx_failures_total,
        })
    }
}

/// SA14: boot-time balance check. Returns the balance in SOL; errors if the
/// RPC is unreachable, refuses-to-proceed if below the floor.
pub async fn check_boot_balance(
    rpc: &RpcClient,
    pubkey: &Pubkey,
    min_sol: f64,
) -> Result<f64> {
    let lamports = rpc
        .get_balance(pubkey)
        .await
        .context("failed to query oracle balance at boot")?;
    let sol = lamports as f64 / 1_000_000_000.0;
    if sol < min_sol {
        return Err(anyhow::anyhow!(
            "oracle keypair balance {sol:.4} SOL is below the {min_sol:.4} floor — refusing to start"
        ));
    }
    info!(sol, "boot balance check passed");
    Ok(sol)
}

/// Spawn the Prometheus HTTP server. Returns immediately; the server runs
/// until the process exits.
pub fn spawn_server(metrics: Metrics, port: u16) {
    tokio::spawn(async move {
        let addr: SocketAddr = ([0, 0, 0, 0], port).into();
        let listener = match TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                error!(error = %e, "metrics bind failed");
                return;
            }
        };
        info!(port, "metrics server listening");
        loop {
            let (stream, _) = match listener.accept().await {
                Ok(s) => s,
                Err(e) => {
                    error!(error = %e, "metrics accept failed");
                    continue;
                }
            };
            let io = TokioIo::new(stream);
            let registry = metrics.registry.clone();
            tokio::spawn(async move {
                let svc = service_fn(move |_req: Request<hyper::body::Incoming>| {
                    let registry = registry.clone();
                    async move {
                        let mut buf = Vec::new();
                        let encoder = TextEncoder::new();
                        let mf = registry.gather();
                        if let Err(e) = encoder.encode(&mf, &mut buf) {
                            error!(error = %e, "prometheus encode failed");
                        }
                        Ok::<_, std::convert::Infallible>(
                            Response::builder()
                                .status(200)
                                .header("content-type", encoder.format_type())
                                .body(Full::new(Bytes::from(buf)))
                                .unwrap(),
                        )
                    }
                });
                if let Err(e) = http1::Builder::new().serve_connection(io, svc).await {
                    // Connection closed or client-side issue; not worth escalating.
                    tracing::debug!(error = %e, "metrics connection closed");
                }
            });
        }
    });
}
