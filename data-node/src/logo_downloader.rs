//! Downloads and caches CoinGecko coin logos locally.
//!
//! On each cycle, compares coins in the DB with logos on disk and
//! downloads any missing ones. Logos are saved as `{coin_id}.png`.

use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;

use reqwest::Client;
use tracing::{debug, error, info, warn};

/// Download logos for all coins that don't have one on disk yet.
/// Called by the CG collector after each daily snapshot.
pub async fn sync_logos(
    logos_dir: &Path,
    coins: &[(String, Option<String>)], // (coin_id, image_url)
) -> u64 {
    // Ensure directory exists
    if let Err(e) = tokio::fs::create_dir_all(logos_dir).await {
        error!(%e, dir = %logos_dir.display(), "Failed to create logos directory");
        return 0;
    }

    // Get existing logos on disk
    let existing = match list_existing_logos(logos_dir).await {
        Ok(set) => set,
        Err(e) => {
            error!(%e, "Failed to list existing logos");
            return 0;
        }
    };

    // Filter to coins that need logos
    let missing: Vec<_> = coins
        .iter()
        .filter(|(id, url)| url.is_some() && !existing.contains(id.as_str()))
        .collect();

    if missing.is_empty() {
        debug!(existing = existing.len(), "All logos up to date");
        return 0;
    }

    info!(
        missing = missing.len(),
        existing = existing.len(),
        "Downloading missing logos"
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client");

    let mut downloaded = 0u64;
    let mut failed = 0u64;

    for (coin_id, image_url) in &missing {
        let url = match image_url {
            Some(u) => u,
            None => continue,
        };

        match download_logo(&client, url, logos_dir, coin_id).await {
            Ok(()) => {
                downloaded += 1;
                if downloaded % 500 == 0 {
                    info!(downloaded, remaining = missing.len() as u64 - downloaded, "Logo download progress");
                }
            }
            Err(e) => {
                failed += 1;
                if failed <= 10 {
                    warn!(coin = %coin_id, %e, "Failed to download logo");
                }
            }
        }

        // Small delay to be nice to CoinGecko CDN
        tokio::time::sleep(Duration::from_millis(20)).await;
    }

    info!(downloaded, failed, "Logo sync complete");
    downloaded
}

/// Download a single logo and save it to disk.
async fn download_logo(
    client: &Client,
    url: &str,
    logos_dir: &Path,
    coin_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let resp = client.get(url).send().await?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()).into());
    }

    let bytes = resp.bytes().await?;
    if bytes.is_empty() {
        return Err("Empty response".into());
    }

    let path = logos_dir.join(format!("{coin_id}.png"));
    tokio::fs::write(&path, &bytes).await?;
    Ok(())
}

/// List all existing logo coin_ids on disk (filename without extension).
async fn list_existing_logos(dir: &Path) -> Result<HashSet<String>, std::io::Error> {
    let mut set = HashSet::new();
    let mut entries = tokio::fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        if let Some(name) = entry.file_name().to_str() {
            if let Some(stem) = name.strip_suffix(".png") {
                set.insert(stem.to_string());
            }
        }
    }
    Ok(set)
}
