use anyhow::Result;
use serde::Deserialize;
use std::collections::HashMap;
use tokio::sync::RwLock;
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct BatchMarketInfo {
    pub source: String,
    pub market_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct BatchSummary {
    id: u64,
    source_id: String,
    config_hash: String,
}

#[derive(Debug, Deserialize)]
struct BatchesResponse {
    batches: Vec<BatchSummary>,
}

#[derive(Debug, Deserialize)]
struct BatchConfigMarket {
    asset_id: String,
}

#[derive(Debug, Deserialize)]
struct BatchConfigResponse {
    markets: Vec<BatchConfigMarket>,
}

pub struct VisionBatchCache {
    oracle_url: String,
    data_node_url: String,
    cache: RwLock<HashMap<u64, BatchMarketInfo>>,
    last_refresh: RwLock<Option<chrono::DateTime<chrono::Utc>>>,
    client: reqwest::Client,
}

impl VisionBatchCache {
    pub fn new(oracle_url: String, data_node_url: String) -> Self {
        Self {
            oracle_url,
            data_node_url,
            cache: RwLock::new(HashMap::new()),
            last_refresh: RwLock::new(None),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    /// Get batch info, refreshing cache if older than 5 minutes or missing
    pub async fn get(&self, batch_id: u64) -> Result<BatchMarketInfo> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(info) = cache.get(&batch_id) {
                let last = self.last_refresh.read().await;
                if let Some(ts) = *last {
                    if (chrono::Utc::now() - ts).num_seconds() < 300 {
                        return Ok(info.clone());
                    }
                }
            }
        }

        // Refresh from oracle
        self.refresh().await?;

        let cache = self.cache.read().await;
        cache
            .get(&batch_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("batch {} not found on oracle", batch_id))
    }

    /// Refresh all batches from oracle
    async fn refresh(&self) -> Result<()> {
        let url = format!("{}/vision/batches", self.oracle_url);
        let resp: BatchesResponse = self.client.get(&url).send().await?.json().await?;

        let mut new_cache = HashMap::new();
        for batch in &resp.batches {
            // Fetch config to get market_ids from the data-node's batch config endpoint
            let config_url = format!(
                "{}/batches/config/{}",
                self.data_node_url, batch.config_hash
            );
            match self.client.get(&config_url).send().await {
                Ok(r) if r.status().is_success() => {
                    if let Ok(config) = r.json::<BatchConfigResponse>().await {
                        new_cache.insert(
                            batch.id,
                            BatchMarketInfo {
                                source: batch.source_id.clone(),
                                market_ids: config
                                    .markets
                                    .iter()
                                    .map(|m| m.asset_id.clone())
                                    .collect(),
                            },
                        );
                    }
                }
                _ => {
                    warn!(
                        "Failed to fetch config for batch {} (hash: {})",
                        batch.id, batch.config_hash
                    );
                }
            }
        }

        info!("Refreshed vision batch cache: {} batches", new_cache.len());
        *self.cache.write().await = new_cache;
        *self.last_refresh.write().await = Some(chrono::Utc::now());
        Ok(())
    }
}
