use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItpConfig {
    pub id: u32,
    pub ticker: String,
    pub name: String,
    pub thesis: String,
    pub section: String,
    pub config: SimConfig,
    pub overlays: Option<serde_json::Value>,
    pub on_chain: OnChainState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimConfig {
    pub category_id: String,
    pub top_n: u32,
    pub weighting: String,
    pub rebalance_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnChainState {
    pub itp_id: Option<String>,
    pub vault_address: Option<String>,
    pub deployed_at: Option<String>,
}

pub fn load_manifest(path: &str) -> Result<Vec<ItpConfig>, Box<dyn std::error::Error>> {
    let data = std::fs::read_to_string(path)?;
    let itps: Vec<ItpConfig> = serde_json::from_str(&data)?;
    Ok(itps)
}
