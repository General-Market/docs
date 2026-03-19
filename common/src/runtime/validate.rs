use super::config::RuntimeConfig;
use ethers::providers::{Provider, Http, Middleware};
use tracing::{info, warn};

#[derive(Debug)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

pub struct StartupValidator;

impl StartupValidator {
    /// Run all pre-flight checks. Returns errors found (empty = healthy).
    pub async fn validate(config: &RuntimeConfig) -> Vec<ValidationError> {
        let mut errors = vec![];

        // 1. RPC reachable
        if let Err(e) = Self::check_rpc(&config.rpc_url).await {
            errors.push(ValidationError {
                field: "rpc_url".into(),
                message: format!("RPC unreachable at {}: {e}", config.rpc_url),
            });
        }

        // 2. Settlement RPC reachable (if configured)
        if let Some(ref url) = config.settlement_rpc_url {
            if let Err(e) = Self::check_rpc(url).await {
                errors.push(ValidationError {
                    field: "settlement_rpc_url".into(),
                    message: format!("Settlement RPC unreachable at {url}: {e}"),
                });
            }
        }

        // 3. Investment contract has code
        if let Ok(addr) = config.deployment.index_address() {
            if let Err(e) = Self::check_has_code(&config.rpc_url, addr).await {
                errors.push(ValidationError {
                    field: "Investment".into(),
                    message: format!("Investment contract at {addr:?} has no code: {e}"),
                });
            }
        }

        // 4. Deployment JSON has required contracts
        for name in &["Index", "OracleRegistry", "USDC"] {
            if config.deployment.get_contract_address(name).is_err() {
                errors.push(ValidationError {
                    field: name.to_string(),
                    message: format!("Missing required contract '{name}' in deployment.json"),
                });
            }
        }

        if errors.is_empty() {
            info!("Startup validation passed");
        } else {
            for e in &errors {
                warn!("Startup validation FAILED: {e}");
            }
        }

        errors
    }

    async fn check_rpc(url: &str) -> Result<(), String> {
        let provider = Provider::<Http>::try_from(url)
            .map_err(|e| e.to_string())?;
        let _block = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            provider.get_block_number()
        )
        .await
        .map_err(|_| "timeout".to_string())?
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn check_has_code(rpc_url: &str, addr: ethers::types::Address) -> Result<(), String> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| e.to_string())?;
        let code = provider.get_code(addr, None).await
            .map_err(|e| e.to_string())?;
        if code.is_empty() {
            return Err("no code at address".into());
        }
        Ok(())
    }
}
