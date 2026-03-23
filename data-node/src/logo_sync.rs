use tracing::info;

use crate::coingecko;
use crate::config;
use crate::logo_downloader;

pub(crate) async fn run_sync_logos(args: config::SyncLogosArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    info!("Fetching all coins from CoinGecko for logo sync...");

    let limiter = coingecko::RateLimiter::coingecko_demo();
    let client = coingecko::CoinGeckoClient::with_limiter(&args.coingecko_api_key, limiter)?;
    let coins = client.fetch_all_markets().await.map_err(|e| format!("{e}"))?;

    let coin_images: Vec<(String, Option<String>)> = coins
        .into_iter()
        .map(|c| (c.id, c.image))
        .collect();

    info!(total = coin_images.len(), "Starting logo sync");
    let logos_dir = std::path::PathBuf::from(&args.logos_dir);
    let downloaded = logo_downloader::sync_logos(&logos_dir, &coin_images).await;
    info!(downloaded, "Logo sync finished");

    Ok(())
}
