//! Shared state for unified mode — concurrent tasks communicate via Arc<RwLock<>>
//!
//! Health monitor writes crisis levels and position data.
//! Quote API reads crisis levels for min-HF enforcement.
//! Allocation bot reads crisis levels for stress-aware rebalancing.

use crate::quote::CrisisLevel;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Shared state accessible by all concurrent curator tasks
#[derive(Debug, Clone)]
pub struct SharedCuratorState {
    inner: Arc<RwLock<CuratorStateInner>>,
}

/// Inner state behind the RwLock
#[derive(Debug, Default)]
pub struct CuratorStateInner {
    /// Crisis level per market (market_id hex → CrisisLevel)
    pub crisis_levels: HashMap<String, CrisisLevel>,
    /// Cached BLS data: (price, timestamp, cycle_number, signature, bitmask)
    pub cached_bls: Option<CachedBlsData>,
    /// Per-asset stress scores (asset_address hex → stress WAD)
    pub asset_stress: HashMap<String, f64>,
}

/// Cached BLS oracle data from the latest collection round
#[derive(Debug, Clone)]
pub struct CachedBlsData {
    pub price: ethers::types::U256,
    pub timestamp: u64,
    pub cycle_number: u64,
    pub signature: Vec<u8>,
    pub bitmask: ethers::types::U256,
    /// When this data was cached
    pub cached_at: std::time::Instant,
}

impl SharedCuratorState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(CuratorStateInner::default())),
        }
    }

    /// Update crisis levels (called by health monitor after each scan)
    pub async fn update_crisis_levels(&self, levels: HashMap<String, CrisisLevel>) {
        let mut state = self.inner.write().await;
        state.crisis_levels = levels;
    }

    /// Get crisis level for a specific market
    pub async fn get_crisis_level(&self, market_id_hex: &str) -> CrisisLevel {
        let state = self.inner.read().await;
        state
            .crisis_levels
            .get(market_id_hex)
            .copied()
            .unwrap_or(CrisisLevel::Normal)
    }

    /// Get all crisis levels
    pub async fn get_all_crisis_levels(&self) -> HashMap<String, CrisisLevel> {
        let state = self.inner.read().await;
        state.crisis_levels.clone()
    }

    /// Update cached BLS data (called by oracle collector after push)
    pub async fn update_bls_data(&self, data: CachedBlsData) {
        let mut state = self.inner.write().await;
        state.cached_bls = Some(data);
    }

    /// Get cached BLS data
    pub async fn get_bls_data(&self) -> Option<CachedBlsData> {
        let state = self.inner.read().await;
        state.cached_bls.clone()
    }

    /// Update per-asset stress scores (called by health monitor)
    pub async fn update_asset_stress(&self, stress: HashMap<String, f64>) {
        let mut state = self.inner.write().await;
        state.asset_stress = stress;
    }

    /// Get per-asset stress scores
    pub async fn get_asset_stress(&self) -> HashMap<String, f64> {
        let state = self.inner.read().await;
        state.asset_stress.clone()
    }
}

impl Default for SharedCuratorState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_crisis_level_default_normal() {
        let state = SharedCuratorState::new();
        let level = state.get_crisis_level("0xdeadbeef").await;
        assert_eq!(level, CrisisLevel::Normal);
    }

    #[tokio::test]
    async fn test_update_and_read_crisis_levels() {
        let state = SharedCuratorState::new();
        let mut levels = HashMap::new();
        levels.insert("0xabc".to_string(), CrisisLevel::Stress);
        levels.insert("0xdef".to_string(), CrisisLevel::Normal);

        state.update_crisis_levels(levels).await;

        assert_eq!(state.get_crisis_level("0xabc").await, CrisisLevel::Stress);
        assert_eq!(state.get_crisis_level("0xdef").await, CrisisLevel::Normal);
        assert_eq!(state.get_crisis_level("0xother").await, CrisisLevel::Normal);
    }

    #[tokio::test]
    async fn test_bls_data_caching() {
        let state = SharedCuratorState::new();
        assert!(state.get_bls_data().await.is_none());

        state
            .update_bls_data(CachedBlsData {
                price: ethers::types::U256::from(1_000_000u64),
                timestamp: 1700000000,
                cycle_number: 42,
                signature: vec![1, 2, 3],
                bitmask: ethers::types::U256::from(7u64),
                cached_at: std::time::Instant::now(),
            })
            .await;

        let data = state.get_bls_data().await.unwrap();
        assert_eq!(data.cycle_number, 42);
    }
}
