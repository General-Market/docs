//! Execution module for DEX swap orchestration
//!
//! Provides orchestrators for:
//! - Same-chain swaps via BLSCustody + 1inch Router (Arbitrum)
//! - Cross-chain swaps via Fusion+ intents
//! - Order routing to classify merged orders by execution venue

pub mod crosschain_orchestrator;
pub mod order_router;
pub mod swap_orchestrator;

pub use crosschain_orchestrator::{CrossChainOrchestrator, CrossChainOrchestratorConfig, CrossChainResult};
pub use order_router::{route_merged_orders, get_venue_for_pair, ExecutionVenue, RoutingConfig, RoutingResult};
pub use swap_orchestrator::{SwapOrchestrator, SwapOrchestratorConfig, SwapResult};
