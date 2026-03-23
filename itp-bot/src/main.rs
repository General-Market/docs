pub mod chain;
mod config;
pub mod data_node;
pub mod deployer;
mod manifest;
pub mod rebalancer;
pub mod token_registry;

use clap::Parser;
use ethers::prelude::Signer;
use ethers::signers::LocalWallet;
use ethers::types::Address;
use ethers::utils::parse_ether;
use rand::seq::SliceRandom;
use rand::Rng;
use tracing::{error, info, warn};

const L3_CHAIN_ID: u64 = 111_222_333;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("itp_bot=info".parse()?),
        )
        .init();

    // ── 1. Parse args ───────────────────────────────────────────────────────
    let args = config::Args::parse();
    info!("ITP Bot starting (dry_run={})", args.dry_run);
    info!("Manifest: {}", args.manifest);
    info!("Data node: {}", args.data_node_url);
    info!("RPC: {}", args.rpc_url);

    // ── 2. Load manifest ────────────────────────────────────────────────────
    let manifest = manifest::load_manifest(&args.manifest)?;
    info!("Loaded {} ITP configs from manifest", manifest.len());

    // ── 3. Read private key, create wallet ──────────────────────────────────
    let key_str = args.read_private_key()?;
    let wallet: LocalWallet = key_str.parse::<LocalWallet>()?.with_chain_id(L3_CHAIN_ID);
    info!(
        wallet = ?wallet.address(),
        chain_id = L3_CHAIN_ID,
        "Bot wallet loaded from {}",
        args.key_file
    );

    // ── 4. Init clients ─────────────────────────────────────────────────────
    let data_node = data_node::DataNodeClient::new(
        &args.data_node_url,
        args.data_node_auth_token.clone(),
    );

    let registry = token_registry::TokenRegistry::from_deployed_assets(&args.deployed_assets)?;
    info!(path = %args.deployed_assets, "Token registry loaded");

    let index_address_str = args.resolve_index_address()?;
    let contract_addr: Address = index_address_str.parse()?;
    let chain = chain::ChainClient::new(&args.rpc_url, contract_addr, wallet)?;

    // ── 5. Log startup info ─────────────────────────────────────────────────
    let itp_count_manifest = manifest.iter().filter(|c| c.on_chain.itp_id.is_some()).count();
    match chain.itp_count().await {
        Ok(count) => info!(
            manifest_total = manifest.len(),
            manifest_deployed = itp_count_manifest,
            on_chain = %count,
            "Startup summary"
        ),
        Err(e) => warn!("Failed to read on-chain ITP count: {}", e),
    }

    // Spawn health endpoint
    tokio::spawn(async {
        use axum::{routing::get, Router};
        let app = Router::new().route("/health", get(|| async { "ok" }));
        let listener = tokio::net::TcpListener::bind("0.0.0.0:8210").await.unwrap();
        axum::serve(listener, app).await.unwrap();
    });

    let min_gas = parse_ether("0.01")?;
    let mut rng = rand::thread_rng();

    // ── 6. Main loop ────────────────────────────────────────────────────────
    loop {
        info!("━━━ Cycle start ━━━");

        // (a) Shuffle ITPs randomly
        let mut itps = manifest.clone();
        itps.shuffle(&mut rng);

        // (b) Track rebalances this cycle
        let mut rebalances_this_cycle: usize = 0;

        // (c) Process each ITP that has an on-chain ID
        for itp in &itps {
            let ticker = &itp.ticker;

            let itp_id_hex = match &itp.on_chain.itp_id {
                Some(id) => id.clone(),
                None => {
                    // Deploy undeployed ITPs
                    info!("[{}] Not deployed — attempting deployment", ticker);
                    match deployer::deploy_itp(itp, &data_node, &chain, &registry, args.dry_run).await {
                        Ok(Some(_id)) => info!("[{}] Deployed successfully", ticker),
                        Ok(None) => info!("[{}] Deployment skipped (dry run or insufficient data)", ticker),
                        Err(e) => error!("[{}] Deployment failed: {}", ticker, e),
                    }
                    continue;
                }
            };

            // Parse itp_id hex to [u8; 32]
            let itp_id_bytes: [u8; 32] = match parse_itp_id(&itp_id_hex) {
                Ok(b) => b,
                Err(e) => {
                    error!("[{}] Invalid itp_id '{}': {}", ticker, itp_id_hex, e);
                    continue;
                }
            };

            // Get target holdings from data-node
            let target_holdings = match data_node.get_target_holdings(&itp.config).await {
                Ok(h) => h,
                Err(e) => {
                    error!("[{}] Failed to get target holdings: {}", ticker, e);
                    continue;
                }
            };
            info!(
                "[{}] Got {} target holdings from data-node",
                ticker,
                target_holdings.len()
            );

            // Get on-chain state
            let (_creator, total_supply, nav, on_chain_assets, on_chain_weights, _inventory) =
                match chain.get_itp_state(itp_id_bytes).await {
                    Ok(state) => state,
                    Err(e) => {
                        error!("[{}] Failed to get on-chain state: {}", ticker, e);
                        continue;
                    }
                };
            info!(
                "[{}] On-chain: {} assets, NAV={}, supply={}",
                ticker,
                on_chain_assets.len(),
                nav,
                total_supply
            );

            // Compute rebalance diff
            let diff = rebalancer::compute_rebalance_diff(
                &on_chain_assets,
                &on_chain_weights,
                &target_holdings,
                &registry,
                args.drift_threshold_pct,
            );

            let diff = match diff {
                Some(d) => d,
                None => {
                    info!("[{}] No rebalance needed", ticker);
                    continue;
                }
            };

            // Check cycle limit
            if rebalances_this_cycle >= args.max_rebalances_per_cycle {
                warn!(
                    "[{}] Rebalance needed (drift={:.2}%) but cycle limit ({}) reached — skipping",
                    ticker, diff.max_drift_pct, args.max_rebalances_per_cycle
                );
                continue;
            }

            // Check gas balance
            match chain.get_balance().await {
                Ok(balance) => {
                    if balance < min_gas {
                        warn!(
                            "[{}] Gas balance too low: {} — skipping rebalance",
                            ticker,
                            ethers::utils::format_ether(balance)
                        );
                        continue;
                    }
                }
                Err(e) => {
                    error!("[{}] Failed to check gas balance: {}", ticker, e);
                    continue;
                }
            }

            // Dry run or submit
            if args.dry_run {
                info!(
                    "[{}] DRY RUN — would rebalance: removes={}, adds={}, drift={:.2}%",
                    ticker,
                    diff.remove_indices.len(),
                    diff.add_assets.len(),
                    diff.max_drift_pct
                );
            } else {
                let remove_u256: Vec<ethers::types::U256> = diff
                    .remove_indices
                    .iter()
                    .map(|&i| ethers::types::U256::from(i))
                    .collect();

                match chain
                    .request_rebalance(
                        itp_id_bytes,
                        remove_u256,
                        diff.add_assets.clone(),
                        diff.new_weights.clone(),
                        diff.note.clone(),
                    )
                    .await
                {
                    Ok(receipt) => {
                        info!(
                            "[{}] Rebalance submitted: tx={:?}, drift={:.2}%",
                            ticker, receipt.transaction_hash, diff.max_drift_pct
                        );
                        rebalances_this_cycle += 1;
                    }
                    Err(e) => {
                        error!("[{}] Rebalance tx failed: {}", ticker, e);
                    }
                }
            }
        }

        // (d) Log cycle summary
        info!(
            "━━━ Cycle complete: {} rebalances submitted ━━━",
            rebalances_this_cycle
        );

        // (e) Sleep with ±20% jitter
        let base_secs = args.poll_interval_secs as f64;
        let jittered = base_secs * (0.8 + rng.gen::<f64>() * 0.4);
        info!("Sleeping {:.0}s until next cycle", jittered);
        tokio::time::sleep(std::time::Duration::from_secs_f64(jittered)).await;
    }
}

/// Parse a hex ITP ID (with or without 0x prefix) into a [u8; 32] array.
fn parse_itp_id(hex_str: &str) -> Result<[u8; 32], Box<dyn std::error::Error>> {
    let stripped = hex_str.trim_start_matches("0x");
    let bytes = hex::decode(stripped)?;
    if bytes.len() != 32 {
        return Err(format!(
            "expected 32 bytes for itp_id, got {}",
            bytes.len()
        )
        .into());
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}
