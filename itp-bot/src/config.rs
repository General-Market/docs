use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "itp-bot", about = "Automated ITP deployment and rebalancing")]
pub struct Args {
    #[arg(long, default_value = "itp-bot/manifest.json")]
    pub manifest: String,

    #[arg(long, env = "DATA_NODE_URL", default_value = "http://localhost:8200")]
    pub data_node_url: String,

    #[arg(long, env = "DATA_NODE_AUTH_TOKEN")]
    pub data_node_auth_token: Option<String>,

    #[arg(long, env = "L3_RPC_URL", default_value = "http://localhost:8545")]
    pub rpc_url: String,

    /// Index contract address (read from deployment-file if not provided)
    #[arg(long, env = "INDEX_ADDRESS")]
    pub index_address: Option<String>,

    /// Path to deployment JSON — reads Index address automatically
    #[arg(long, env = "DEPLOYMENT_FILE")]
    pub deployment_file: Option<String>,

    /// Path to file containing bot wallet private key
    #[arg(long, env = "BOT_KEY_FILE", default_value = "/tmp/bot-key.txt")]
    pub key_file: String,

    /// Path to deployed-assets.json for the token registry
    #[arg(long, env = "DEPLOYED_ASSETS_PATH", default_value = "frontend/public/deployed-assets.json")]
    pub deployed_assets: String,

    #[arg(long, default_value = "5.0")]
    pub drift_threshold_pct: f64,

    #[arg(long, default_value = "3600")]
    pub poll_interval_secs: u64,

    #[arg(long, default_value = "5")]
    pub max_rebalances_per_cycle: usize,

    #[arg(long)]
    pub dry_run: bool,
}

impl Args {
    /// Read private key from key file
    pub fn read_private_key(&self) -> Result<String, std::io::Error> {
        std::fs::read_to_string(&self.key_file).map(|s| s.trim().to_string())
    }

    /// Resolve Index address: explicit flag > deployment file
    pub fn resolve_index_address(&self) -> Result<String, Box<dyn std::error::Error>> {
        if let Some(ref addr) = self.index_address {
            return Ok(addr.clone());
        }
        if let Some(ref path) = self.deployment_file {
            let content = std::fs::read_to_string(path)?;
            let json: serde_json::Value = serde_json::from_str(&content)?;
            if let Some(addr) = json["contracts"]["Index"].as_str() {
                return Ok(addr.to_string());
            }
        }
        Err("INDEX_ADDRESS not set and no deployment file provided".into())
    }
}
