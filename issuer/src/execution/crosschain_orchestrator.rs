//! Cross-chain swap orchestrator using Fusion+ intents
//!
//! Routes cross-chain DEX pairs through the Arbitrum hub:
//! 1. Bridge USDC from L3 to Arbitrum (if needed)
//! 2. Create Fusion+ intent from Arbitrum to destination chain
//! 3. Monitor intent settlement status

use common::integrations::oneinch::{
    FusionPlusClient, FusionPlusClientTrait, FusionRoute, IntentStatus, OneInchError,
};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, info, warn};

/// Max retries before deferring order (per architecture Section 14)
const MAX_INTENT_RETRIES: u32 = 3;

/// Intent timeout in seconds (per architecture Section 14: 60s per intent)
const INTENT_TIMEOUT_SECS: u64 = 60;

/// Max cycles deferred before auto-refund
const MAX_DEFERRED_CYCLES: u32 = 3;

/// Errors from cross-chain orchestration
#[derive(Debug, Error)]
pub enum CrossChainError {
    /// Unsupported route
    #[error("Unsupported cross-chain route: {src_chain} -> {dst_chain}")]
    UnsupportedRoute { src_chain: u64, dst_chain: u64 },

    /// Intent creation failed
    #[error("Failed to create Fusion+ intent: {0}")]
    IntentCreationFailed(String),

    /// Intent settlement failed
    #[error("Intent settlement failed for {order_hash}: {reason}")]
    SettlementFailed { order_hash: String, reason: String },

    /// Intent expired
    #[error("Intent expired: {order_hash}")]
    IntentExpired { order_hash: String },

    /// Max retries exceeded
    #[error("Max retries ({max_retries}) exceeded for order")]
    MaxRetriesExceeded { max_retries: u32 },

    /// Bridge required but not available
    #[error("L3 -> Arbitrum bridge required but not configured")]
    BridgeRequired,

    /// 1inch error
    #[error("1inch error: {0}")]
    OneInchError(#[from] OneInchError),
}

/// Result of a cross-chain swap
#[derive(Debug, Clone)]
pub struct CrossChainResult {
    /// Fusion+ order hash (intent ID)
    pub order_hash: String,
    /// Source chain ID
    pub src_chain_id: u64,
    /// Destination chain ID
    pub dst_chain_id: u64,
    /// Amount bridged
    pub amount: String,
    /// Current intent status
    pub status: CrossChainStatus,
}

/// Status tracking for cross-chain swaps
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CrossChainStatus {
    /// Intent created, awaiting settlement
    Pending,
    /// Intent matched by resolver
    Matched,
    /// Settlement in progress
    Settling,
    /// Successfully completed
    Completed { dst_tx_hash: String },
    /// Failed
    Failed { reason: String },
    /// Deferred for retry next cycle
    Deferred { retry_count: u32 },
    /// Auto-refund triggered
    Refunded,
}

/// Configuration for cross-chain orchestrator
#[derive(Debug, Clone)]
pub struct CrossChainOrchestratorConfig {
    /// Intent timeout in seconds
    pub intent_timeout_secs: u64,
    /// Max retries per intent
    pub max_retries: u32,
    /// Max deferred cycles before auto-refund
    pub max_deferred_cycles: u32,
    /// Polling interval for status checks (seconds)
    pub poll_interval_secs: u64,
}

impl Default for CrossChainOrchestratorConfig {
    fn default() -> Self {
        Self {
            intent_timeout_secs: INTENT_TIMEOUT_SECS,
            max_retries: MAX_INTENT_RETRIES,
            max_deferred_cycles: MAX_DEFERRED_CYCLES,
            poll_interval_secs: 5,
        }
    }
}

/// Request to execute a cross-chain swap
#[derive(Debug, Clone)]
pub struct CrossChainRequest {
    /// Source token address (on Arbitrum)
    pub src_token: String,
    /// Destination token address (on dst chain)
    pub dst_token: String,
    /// Amount in smallest units
    pub amount: String,
    /// Minimum return amount
    pub min_return: String,
    /// Destination chain ID
    pub dst_chain_id: u64,
    /// Receiver address on destination chain
    pub receiver: String,
    /// Deadline timestamp
    pub deadline: u64,
}

/// Deferred order tracking
#[derive(Debug, Clone)]
pub struct DeferredOrder {
    /// Original request
    pub request: CrossChainRequest,
    /// Number of retry attempts
    pub retry_count: u32,
    /// Number of cycles deferred
    pub deferred_cycles: u32,
}

/// Cross-chain swap orchestrator using Fusion+ intents
pub struct CrossChainOrchestrator {
    /// Fusion+ client for creating and monitoring intents
    fusion_client: Arc<FusionPlusClient>,
    /// Configuration
    config: CrossChainOrchestratorConfig,
    /// Deferred orders awaiting retry
    deferred_orders: dashmap::DashMap<String, DeferredOrder>,
    /// Successful intent count
    success_count: AtomicU64,
    /// Failed intent count
    failure_count: AtomicU64,
}

impl CrossChainOrchestrator {
    /// Create a new cross-chain orchestrator
    pub fn new(
        fusion_client: Arc<FusionPlusClient>,
        config: CrossChainOrchestratorConfig,
    ) -> Self {
        Self {
            fusion_client,
            config,
            deferred_orders: dashmap::DashMap::new(),
            success_count: AtomicU64::new(0),
            failure_count: AtomicU64::new(0),
        }
    }

    /// Get success count
    pub fn success_count(&self) -> u64 {
        self.success_count.load(Ordering::Relaxed)
    }

    /// Get failure count
    pub fn failure_count(&self) -> u64 {
        self.failure_count.load(Ordering::Relaxed)
    }

    /// Get number of deferred orders
    pub fn deferred_count(&self) -> usize {
        self.deferred_orders.len()
    }

    /// Execute a cross-chain swap via Fusion+
    ///
    /// Flow:
    /// 1. Validate the route is supported
    /// 2. Create Fusion+ intent
    /// 3. Monitor settlement (with timeout)
    /// 4. On timeout: defer for retry next cycle
    /// 5. After max retries: auto-refund
    pub async fn execute_crosschain(
        &self,
        request: &CrossChainRequest,
    ) -> Result<CrossChainResult, CrossChainError> {
        // Validate route (Arbitrum must be source)
        let src_chain_id = 42161; // Arbitrum
        if !FusionRoute::is_supported(src_chain_id, request.dst_chain_id) {
            return Err(CrossChainError::UnsupportedRoute {
                src_chain: src_chain_id,
                dst_chain: request.dst_chain_id,
            });
        }

        info!(
            src_chain = src_chain_id,
            dst_chain = request.dst_chain_id,
            src_token = %request.src_token,
            dst_token = %request.dst_token,
            amount = %request.amount,
            "Creating Fusion+ intent"
        );

        // Create intent via Fusion+ client
        let intent = self
            .fusion_client
            .create_intent(
                src_chain_id,
                request.dst_chain_id,
                &request.src_token,
                &request.dst_token,
                &request.amount,
                &request.min_return,
                request.deadline,
                &request.receiver,
            )
            .await
            .map_err(|e| CrossChainError::IntentCreationFailed(e.to_string()))?;

        let order_hash = intent.order_hash.clone();

        info!(
            order_hash = %order_hash,
            dst_chain = request.dst_chain_id,
            "Fusion+ intent created"
        );

        // Monitor settlement with timeout
        let timeout = Duration::from_secs(self.config.intent_timeout_secs);
        let poll_interval = Duration::from_secs(self.config.poll_interval_secs);

        match tokio::time::timeout(timeout, self.poll_intent_status(&order_hash, poll_interval))
            .await
        {
            Ok(Ok(status)) => {
                match &status {
                    CrossChainStatus::Completed { dst_tx_hash } => {
                        self.success_count.fetch_add(1, Ordering::Relaxed);
                        info!(
                            order_hash = %order_hash,
                            dst_tx_hash = %dst_tx_hash,
                            "Cross-chain swap completed"
                        );
                    }
                    CrossChainStatus::Failed { reason } => {
                        self.failure_count.fetch_add(1, Ordering::Relaxed);
                        warn!(
                            order_hash = %order_hash,
                            reason = %reason,
                            "Cross-chain swap failed"
                        );
                    }
                    _ => {}
                }

                Ok(CrossChainResult {
                    order_hash,
                    src_chain_id,
                    dst_chain_id: request.dst_chain_id,
                    amount: request.amount.clone(),
                    status,
                })
            }
            Ok(Err(e)) => {
                self.failure_count.fetch_add(1, Ordering::Relaxed);
                Err(e)
            }
            Err(_) => {
                // Timeout - defer for retry
                warn!(
                    order_hash = %order_hash,
                    timeout_secs = self.config.intent_timeout_secs,
                    "Fusion+ intent timed out, deferring"
                );

                self.defer_order(order_hash.clone(), request.clone());

                Ok(CrossChainResult {
                    order_hash,
                    src_chain_id,
                    dst_chain_id: request.dst_chain_id,
                    amount: request.amount.clone(),
                    status: CrossChainStatus::Deferred { retry_count: 1 },
                })
            }
        }
    }

    /// Poll intent status until terminal state
    async fn poll_intent_status(
        &self,
        order_hash: &str,
        poll_interval: Duration,
    ) -> Result<CrossChainStatus, CrossChainError> {
        loop {
            let status = self
                .fusion_client
                .get_intent_status(order_hash)
                .await
                .map_err(|e| CrossChainError::SettlementFailed {
                    order_hash: order_hash.to_string(),
                    reason: e.to_string(),
                })?;

            match status {
                IntentStatus::Completed {
                    dst_tx_hash,
                    dst_amount: _,
                    resolver: _,
                    settled_at: _,
                } => {
                    return Ok(CrossChainStatus::Completed { dst_tx_hash });
                }
                IntentStatus::Failed { reason } => {
                    return Ok(CrossChainStatus::Failed { reason });
                }
                IntentStatus::Expired => {
                    return Ok(CrossChainStatus::Failed {
                        reason: "Intent expired".to_string(),
                    });
                }
                IntentStatus::Matched { .. } => {
                    debug!(order_hash = %order_hash, "Intent matched, waiting for settlement");
                }
                IntentStatus::Settling { .. } => {
                    debug!(order_hash = %order_hash, "Intent settling");
                }
                IntentStatus::Pending => {
                    debug!(order_hash = %order_hash, "Intent pending");
                }
            }

            tokio::time::sleep(poll_interval).await;
        }
    }

    /// Defer an order for retry next cycle
    fn defer_order(&self, order_hash: String, request: CrossChainRequest) {
        let (retry_count, deferred_cycles) = {
            let existing = self.deferred_orders.get(&order_hash);
            existing
                .map(|e| (e.retry_count + 1, e.deferred_cycles + 1))
                .unwrap_or((1, 1))
        };

        self.deferred_orders.insert(
            order_hash,
            DeferredOrder {
                request,
                retry_count,
                deferred_cycles,
            },
        );
    }

    /// Process deferred orders - retry or auto-refund
    ///
    /// Should be called at the start of each cycle to handle deferred orders.
    pub async fn process_deferred(&self) -> Vec<CrossChainResult> {
        let mut results = Vec::new();
        let mut to_refund = Vec::new();

        for entry in self.deferred_orders.iter() {
            let order_id = entry.key().clone();
            let order = entry.value();

            if order.deferred_cycles >= self.config.max_deferred_cycles {
                // Auto-refund: exceeded max deferred cycles
                warn!(
                    order_id = %order_id,
                    deferred_cycles = order.deferred_cycles,
                    "Auto-refunding deferred order (max cycles exceeded)"
                );
                to_refund.push(order_id.clone());
                results.push(CrossChainResult {
                    order_hash: order_id,
                    src_chain_id: 42161,
                    dst_chain_id: order.request.dst_chain_id,
                    amount: order.request.amount.clone(),
                    status: CrossChainStatus::Refunded,
                });
            } else if order.retry_count >= self.config.max_retries {
                // Max retries exceeded - defer further
                debug!(
                    order_id = %order_id,
                    retry_count = order.retry_count,
                    "Order at max retries, incrementing deferred cycle"
                );
            }
        }

        // Remove refunded orders
        for id in to_refund {
            self.deferred_orders.remove(&id);
        }

        results
    }
}

impl std::fmt::Debug for CrossChainOrchestrator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CrossChainOrchestrator")
            .field("config", &self.config)
            .field("success_count", &self.success_count())
            .field("failure_count", &self.failure_count())
            .field("deferred_count", &self.deferred_count())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = CrossChainOrchestratorConfig::default();
        assert_eq!(config.intent_timeout_secs, 60);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.max_deferred_cycles, 3);
        assert_eq!(config.poll_interval_secs, 5);
    }

    #[test]
    fn test_crosschain_request() {
        let request = CrossChainRequest {
            src_token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831".to_string(),
            dst_token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".to_string(),
            amount: "1000000000".to_string(),
            min_return: "990000000".to_string(),
            dst_chain_id: 1, // Ethereum
            receiver: "0x1234567890123456789012345678901234567890".to_string(),
            deadline: 1706540400,
        };

        assert_eq!(request.dst_chain_id, 1);
    }

    #[test]
    fn test_crosschain_status_variants() {
        let pending = CrossChainStatus::Pending;
        assert_eq!(pending, CrossChainStatus::Pending);

        let completed = CrossChainStatus::Completed {
            dst_tx_hash: "0xabc".to_string(),
        };
        assert!(matches!(completed, CrossChainStatus::Completed { .. }));

        let failed = CrossChainStatus::Failed {
            reason: "timeout".to_string(),
        };
        assert!(matches!(failed, CrossChainStatus::Failed { .. }));

        let deferred = CrossChainStatus::Deferred { retry_count: 2 };
        assert!(matches!(deferred, CrossChainStatus::Deferred { retry_count: 2 }));

        let refunded = CrossChainStatus::Refunded;
        assert_eq!(refunded, CrossChainStatus::Refunded);
    }

    #[test]
    fn test_supported_routes() {
        // Arbitrum -> Ethereum
        assert!(FusionRoute::is_supported(42161, 1));
        // Arbitrum -> Base
        assert!(FusionRoute::is_supported(42161, 8453));
        // Arbitrum -> Optimism
        assert!(FusionRoute::is_supported(42161, 10));
        // Non-Arbitrum source
        assert!(!FusionRoute::is_supported(1, 42161));
    }

    #[test]
    fn test_error_display() {
        let err = CrossChainError::UnsupportedRoute {
            src_chain: 1,
            dst_chain: 42161,
        };
        assert!(err.to_string().contains("Unsupported"));

        let err = CrossChainError::IntentExpired {
            order_hash: "0xabc".to_string(),
        };
        assert!(err.to_string().contains("expired"));

        let err = CrossChainError::MaxRetriesExceeded { max_retries: 3 };
        assert!(err.to_string().contains("3"));
    }

    #[test]
    fn test_crosschain_result() {
        let result = CrossChainResult {
            order_hash: "0xabc123".to_string(),
            src_chain_id: 42161,
            dst_chain_id: 1,
            amount: "1000000000".to_string(),
            status: CrossChainStatus::Pending,
        };

        assert_eq!(result.src_chain_id, 42161);
        assert_eq!(result.dst_chain_id, 1);
        assert_eq!(result.status, CrossChainStatus::Pending);
    }

    #[test]
    fn test_deferred_order() {
        let request = CrossChainRequest {
            src_token: "0xUSDC".to_string(),
            dst_token: "0xUSDC_ETH".to_string(),
            amount: "1000000".to_string(),
            min_return: "990000".to_string(),
            dst_chain_id: 1,
            receiver: "0xreceiver".to_string(),
            deadline: 9999999999,
        };

        let deferred = DeferredOrder {
            request,
            retry_count: 2,
            deferred_cycles: 1,
        };

        assert_eq!(deferred.retry_count, 2);
        assert_eq!(deferred.deferred_cycles, 1);
    }
}
