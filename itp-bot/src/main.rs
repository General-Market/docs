pub mod chain;
mod config;
pub mod data_node;
mod manifest;
pub mod token_registry;

use clap::Parser;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("itp_bot=info".parse()?),
        )
        .init();

    let args = config::Args::parse();
    info!("ITP Bot starting (dry_run={})", args.dry_run);
    info!("Manifest: {}", args.manifest);
    info!("Data node: {}", args.data_node_url);
    info!("RPC: {}", args.rpc_url);

    let manifest = manifest::load_manifest(&args.manifest)?;
    info!("Loaded {} ITP configs", manifest.len());

    // Verify key file is readable
    let _key = args.read_private_key()?;
    info!("Bot wallet key loaded from {}", args.key_file);

    // TODO: init data_node client, chain client, token registry
    // TODO: main loop with scheduler

    info!("ITP Bot scaffold complete — modules not yet wired");
    Ok(())
}
