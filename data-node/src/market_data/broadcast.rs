use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// A single price update from a collector
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceBroadcast {
    pub source: String,
    pub asset_id: String,
    pub symbol: String,
    pub value: Decimal,
    pub change_pct: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub fetched_at: DateTime<Utc>,
}

/// Batch of price updates from a single collector sync
#[derive(Debug, Clone)]
pub struct SourcePriceBatch {
    pub source: String,
    pub prices: Vec<PriceBroadcast>,
    pub timestamp: DateTime<Utc>,
}

/// Global broadcast hub — one sender per source
pub struct PriceBroadcastHub {
    senders: RwLock<HashMap<String, broadcast::Sender<Arc<SourcePriceBatch>>>>,
}

impl PriceBroadcastHub {
    pub fn new() -> Self {
        Self {
            senders: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a broadcast channel for a source (capacity 16 — recent syncs only)
    pub async fn sender(&self, source: &str) -> broadcast::Sender<Arc<SourcePriceBatch>> {
        {
            let senders = self.senders.read().await;
            if let Some(tx) = senders.get(source) {
                return tx.clone();
            }
        }
        let mut senders = self.senders.write().await;
        senders
            .entry(source.to_string())
            .or_insert_with(|| broadcast::channel(16).0)
            .clone()
    }

    /// Subscribe to a source's price updates
    pub async fn subscribe(&self, source: &str) -> broadcast::Receiver<Arc<SourcePriceBatch>> {
        self.sender(source).await.subscribe()
    }
}
