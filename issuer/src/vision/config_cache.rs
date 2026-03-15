use std::collections::HashMap;
use tokio::sync::RwLock;
use ethers::types::H256;

const MAX_CACHE_ENTRIES: usize = 500;

#[derive(Clone, Debug)]
pub struct CachedConfig {
    pub market_ids: Vec<String>,
    pub inserted_at: u64,
}

pub struct ConfigCache {
    cache: RwLock<HashMap<H256, CachedConfig>>,
}

impl ConfigCache {
    pub fn new() -> Self {
        Self { cache: RwLock::new(HashMap::new()) }
    }

    pub async fn get(&self, config_hash: &H256) -> Option<Vec<String>> {
        self.cache.read().await.get(config_hash).map(|c| c.market_ids.clone())
    }

    pub async fn insert(&self, config_hash: H256, market_ids: Vec<String>) {
        let mut cache = self.cache.write().await;
        if cache.len() >= MAX_CACHE_ENTRIES {
            // Evict oldest 10%
            let mut entries: Vec<_> = cache.iter()
                .map(|(k, v)| (*k, v.inserted_at))
                .collect();
            entries.sort_by_key(|(_, t)| *t);
            for (key, _) in entries.iter().take(MAX_CACHE_ENTRIES / 10) {
                cache.remove(key);
            }
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        cache.insert(config_hash, CachedConfig {
            market_ids,
            inserted_at: now,
        });
    }
}
