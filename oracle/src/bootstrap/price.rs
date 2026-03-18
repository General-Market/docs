//! Price fetcher and DEX price source builders
//!
//! Prefers BackendPriceFetcher (data-node backend) when DATA_NODE_URL is set.
//! Falls back to BitgetPriceFetcher when backend URL is not available.

use super::{BootstrapError, BootstrapParams, PriceComponents};
use crate::{
    BackendPriceFetcher, BitgetPriceFetcher, DexPriceSource, DexPriceSourceConfig, OracleConfig,
    PriceFetcher, PriceValidator, SymbolMap,
};
use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use common::integrations::oneinch::{CachedQuoteClient, OneInchQuoteClient, OneInchRateLimitHandler, QuoteCacheConfig};
use common::mocks::MockBitgetReadOnlyClient;
use common::traits::BitgetReadOnlyClient;
use common::types::ExchangeMode;
use std::collections::HashSet;
use std::sync::Arc;
use tracing::{error, info, warn};

/// Validate symbol map against live Bitget tickers.
///
/// Fetches all tickers in a single bulk call and emits a WARN for every pair
/// in `symbol_map` that is absent from Bitget's response.  Missing pairs will
/// produce "ticker not found" errors during price consensus — better to surface
/// them immediately at startup.
///
/// Failures in the bulk fetch are logged but do not abort startup: we cannot
/// afford to refuse to start just because Bitget is momentarily unreachable.
async fn validate_symbol_map_against_bitget<C: BitgetReadOnlyClient>(
    client: &C,
    symbol_map: &SymbolMap,
    node_id: u32,
) {
    match client.get_all_tickers().await {
        Ok(tickers) => {
            let valid: HashSet<String> = tickers.into_iter().map(|t| t.symbol).collect();
            let mut untradeable: Vec<String> = symbol_map
                .all_pairs()
                .filter(|pair| !valid.contains(*pair))
                .map(|s| s.to_string())
                .collect();
            untradeable.sort();

            if untradeable.is_empty() {
                info!(
                    node_id,
                    total = symbol_map.len(),
                    "All symbol-map pairs confirmed tradeable on Bitget"
                );
            } else {
                warn!(
                    node_id,
                    count = untradeable.len(),
                    pairs = %untradeable.join(", "),
                    "Symbol-map contains pairs not found on Bitget — price fetch will fail for these assets"
                );
            }
        }
        Err(e) => {
            warn!(
                node_id,
                error = %e,
                "Bulk ticker fetch for symbol validation failed — cannot confirm all pairs are tradeable"
            );
        }
    }
}

/// Builder for price-related components
pub struct PriceBuilder<'a> {
    config: &'a OracleConfig,
    params: &'a BootstrapParams,
    node_id: u32,
}

impl<'a> PriceBuilder<'a> {
    pub fn new(config: &'a OracleConfig, params: &'a BootstrapParams, node_id: u32) -> Self {
        Self { config, params, node_id }
    }

    pub async fn build(self) -> Result<PriceComponents, BootstrapError> {
        // Build shared cached client for 1inch (reused by DexPriceSource and SwapOrchestrator)
        let shared_cached_client = self.build_cached_client();

        // Load symbol map first (shared by both fetcher types)
        let symbol_map = self.load_symbol_map();

        // Build price fetcher: prefer BackendPriceFetcher, fall back to BitgetPriceFetcher
        let fetcher: Arc<dyn PriceFetcher> = self.build_price_fetcher(&symbol_map).await?;

        // Build DEX price source
        let dex_source = self.build_dex_source(&shared_cached_client).await;

        // Initialize price validator (currently unused but ready)
        let _price_validator = PriceValidator::new();
        info!(self.node_id, "PriceValidator initialized");

        Ok(PriceComponents {
            fetcher,
            symbol_map,
            dex_source,
            shared_cached_client,
        })
    }

    fn build_cached_client(&self) -> Option<Arc<CachedQuoteClient<OneInchQuoteClient>>> {
        let api_key = self.config.oneinch_api_key.as_ref()?;

        match OneInchQuoteClient::new(api_key.clone(), None) {
            Ok(quote_client) => {
                let cache_config = QuoteCacheConfig::new(5);
                Some(Arc::new(CachedQuoteClient::new(quote_client, Some(cache_config))))
            }
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "Failed to create OneInchQuoteClient");
                None
            }
        }
    }

    async fn build_price_fetcher(&self, symbol_map: &SymbolMap) -> Result<Arc<dyn PriceFetcher>, BootstrapError> {
        // Check if data-node backend URL is configured (config or env var)
        let data_node_url = self.config.data_node_url.clone()
            .or_else(|| std::env::var("DATA_NODE_URL").ok());

        if let Some(url) = data_node_url {
            info!(
                self.node_id,
                url = %url,
                symbols = symbol_map.len(),
                pairs = %symbol_map.all_pairs().collect::<Vec<_>>().join(", "),
                "Using BackendPriceFetcher (data-node backend) — symbol inventory logged"
            );
            let fetcher = BackendPriceFetcher::new(url, symbol_map.clone());
            return Ok(Arc::new(fetcher));
        }

        // Resolve exchange mode to decide which Bitget client to use
        let exchange_mode = self.config.effective_exchange_mode();
        info!(self.node_id, mode = %exchange_mode, "No DATA_NODE_URL set, using BitgetPriceFetcher");

        // Check symbol map validity if provided
        if let Some(ref path) = self.params.symbol_map_file {
            if let Err(e) = SymbolMap::from_file(path) {
                error!(
                    self.node_id,
                    path = %path.display(),
                    error = %e,
                    "Failed to load symbol map from file"
                );
                return Err(BootstrapError::Config(format!(
                    "Invalid symbol map file {}: {}",
                    path.display(), e
                )));
            }
        }

        match exchange_mode {
            ExchangeMode::Mock => {
                info!(self.node_id, "Using MockBitgetReadOnlyClient (no Bitget credentials needed)");
                let client = MockBitgetReadOnlyClient::new();
                // Mock client has no real tickers — skip validation
                let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map.clone());
                Ok(Arc::new(fetcher))
            }
            ExchangeMode::Testnet | ExchangeMode::Mainnet => {
                // Verify credentials are available for real modes
                let has_api_key = std::env::var("BITGET_READONLY_API_KEY").is_ok();
                let has_api_secret = std::env::var("BITGET_READONLY_API_SECRET").is_ok();
                let has_passphrase = std::env::var("BITGET_READONLY_PASSPHRASE").is_ok();

                if !has_api_key || !has_api_secret || !has_passphrase {
                    let missing = vec![
                        (!has_api_key).then_some("BITGET_READONLY_API_KEY"),
                        (!has_api_secret).then_some("BITGET_READONLY_API_SECRET"),
                        (!has_passphrase).then_some("BITGET_READONLY_PASSPHRASE"),
                    ].into_iter().flatten().collect::<Vec<_>>().join(", ");

                    error!(
                        self.node_id,
                        mode = %exchange_mode,
                        missing = %missing,
                        "Exchange mode requires Bitget credentials but they are missing"
                    );
                    return Err(BootstrapError::Config(format!(
                        "Exchange mode '{}' requires Bitget credentials, missing: {}",
                        exchange_mode, missing
                    )));
                }

                let fetcher = self.build_bitget_fetcher_with_validation(symbol_map).await?;
                Ok(Arc::new(fetcher))
            }
        }
    }

    async fn build_bitget_fetcher_with_validation(&self, symbol_map: &SymbolMap) -> Result<BitgetPriceFetcher<BitgetReadOnlyClientImpl>, BootstrapError> {
        let bitget_config = BitgetReadOnlyConfig::from_env()
            .map_err(|e| BootstrapError::Config(format!("Failed to load Bitget config: {}", e)))?;

        let client = BitgetReadOnlyClientImpl::new(bitget_config)
            .map_err(|e| BootstrapError::Config(format!("Failed to create Bitget client: {}", e)))?;

        // Validate all mapped pairs against live Bitget tickers before committing to this map.
        // Untradeable pairs (ICX, ZAMA, DBR, etc.) are logged as WARN — startup is not aborted.
        validate_symbol_map_against_bitget(&client, symbol_map, self.node_id).await;

        let fetcher = BitgetPriceFetcher::new(Arc::new(client), symbol_map.clone());
        info!(self.node_id, "BitgetPriceFetcher initialized");
        Ok(fetcher)
    }

    fn load_symbol_map(&self) -> SymbolMap {
        if let Some(ref path) = self.params.symbol_map_file {
            match SymbolMap::from_file(path) {
                Ok(map) => {
                    info!(self.node_id, path = %path.display(), symbols = map.len(), "Loaded custom symbol map");
                    return map;
                }
                Err(e) => {
                    error!(self.node_id, error = %e, "Symbol map error (unexpected), using default");
                }
            }
        }
        SymbolMap::default_settlement()
    }

    async fn build_dex_source(
        &self,
        cached_client: &Option<Arc<CachedQuoteClient<OneInchQuoteClient>>>,
    ) -> Option<Arc<DexPriceSource>> {
        let api_key = self.config.oneinch_api_key.as_ref()?;
        let cached = cached_client.as_ref()?;

        match OneInchRateLimitHandler::new(None, None) {
            Ok(rate_limiter) => {
                let rate_limiter = Arc::new(rate_limiter);
                rate_limiter.add_key(api_key.clone()).await;

                let dex_config = DexPriceSourceConfig::default();
                let dex_source = DexPriceSource::new(rate_limiter, cached.clone(), dex_config);

                info!(self.node_id, "DexPriceSource initialized (1inch with cache + rate limiting)");
                Some(Arc::new(dex_source))
            }
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "Failed to create rate limiter");
                None
            }
        }
    }
}
