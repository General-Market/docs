//! Issuer node implementation for Index L3
//!
//! This crate provides the issuer node implementation for the Index L3 network.
//! The issuer node participates in order batching, BLS consensus, and trade execution.

pub mod api;
pub mod batcher;
pub mod bootstrap;
pub mod bridge;
pub mod chain;
pub mod config;
pub mod consensus;
pub mod cycle;
pub mod delisting_watchdog;
pub mod execution;
pub mod heartbeat;
pub mod leader;
pub mod netting;
pub mod p2p;
pub mod price;
pub mod registry_sync;
pub mod slippage;
pub mod state;

pub use batcher::{BatchResult, OrderBatcher, PauseState, ValidationResult, DEFAULT_MAX_BATCH_SIZE};
pub use chain::{
    ArbitrumChainReader, ArbitrumChainReaderConfig, ArbitrumChainWriter, ArbitrumChainWriterConfig,
    ArbitrumReaderError, ArbitrumWriterError, ChainReaderConfig, ChainWriterConfig, ContractAddresses,
    CustodyWriter, CustodyWriterConfig, CustodyWriterError, EthersChainReader, EthersChainWriter,
    GasConfig, ItpCreationRequest, NonceManager, RetryConfig, WriterContractAddresses,
};
pub use common;
pub use config::{ConfigBuilder, ConfigError, IssuerConfig};
pub use cycle::{CycleConfig, CycleManager, CyclePhase, CycleState, CycleTrigger, MIN_CYCLE_DURATION_MS};
pub use netting::{
    allocate_rebalance_fills, bridge_netting, calculate_net_deltas, compute_rebalance_progress,
    fee_allocation, finalize_rebalance, generate_rebalance_trades, pair_netting, usdt_netting,
    BridgeRequest, DepegState, FeeAllocation, FeeType, InternalTransfer, MergedOrder,
    NettedBridgeTransfers, NettingEngine, NettingPipelineMetrics, NettingResult,
    NettingResultWithRebalance, NetDeltaResult, PrioritySlots, RebalanceCompleteData,
    RebalanceFillAllocation, RebalanceProposal, RebalanceQueue, RebalanceTrade,
    UsdtNettingResult, ZeroNavOrder,
};
pub use price::{
    tolerance, BackendPriceFetcher, BatchRejectReason, BatchValidationResult, BitgetPriceFetcher,
    ComparisonResult, DexPriceSource, DexPriceSourceConfig, MockPriceFetcher,
    MockPriceFetcherBuilder, OnchainFallback, PriceDisagreement, PriceFetchError, PriceFetcher,
    PriceValidator, StalePrice, StalenessResult, StalenessValidator, SymbolMap, SymbolMapError,
    TokenMapping, ToleranceValidator,
};
pub use leader::{elect_leader, CycleLeaderState, LeaderElector, LeaderElectorError};
pub use slippage::{
    allocate_fills, filter_by_slippage, FilterResult, MergedOrderContext, SlippageTier,
    SourceFill,
};
pub use state::{
    chains, Checkpoint, ITPState, IssuerState, ReconstructionStats, ReconstructorConfig,
    StateReconstructor,
};
pub use consensus::{
    AggregationStatus, ConsensusConfig, ConsensusMessageHandler, ConsensusPhase,
    ConsensusProtocol, ConsensusResult, ConsensusRound, ConsensusState, ConsensusTimeouts,
    InMemoryKeyRegistry, ItpCreationConfig, ItpCreationError, ItpCreationResult, KeyRegistry,
    SignatureAggregator,
};
pub use execution::{
    CrossChainOrchestrator, CrossChainOrchestratorConfig, CrossChainResult,
    ExecutionVenue, RoutingConfig, RoutingResult, route_merged_orders, get_venue_for_pair,
    SwapOrchestrator, SwapOrchestratorConfig, SwapResult,
};
pub use heartbeat::{
    HeartbeatMetrics, HeartbeatMonitor, KickVoteProposal, PeerHealthInfo, PeerHealthStatus,
    PeerHealthTracker, HEARTBEAT_INTERVAL, KICK_VOTE_THRESHOLD, UNHEALTHY_THRESHOLD,
};
pub use bridge::{
    build_bridge_arb_to_l3_hash, BridgeConfig, BridgeError, BridgeOrderStatus, BridgeOrchestrator,
    BridgeProposal, BridgeResult, CrossChainOrderReader, SignatureCollector,
};
pub use api::{
    build_nav_message_hash, handle_nav_sign_request, BackendNavCalculator, DefaultNavCalculator,
    EthersItpRegistryReader, ItpInfo, ItpRegistryConfig, ItpRegistryReader, MockNavCalculator,
    NavCalculator, NavCalculatorError, NavSignError, NavSignHandler, NavSignRequest,
    NavSignResponse, StubItpRegistryReader,
};
pub use registry_sync::{
    build_registry_sync_message_hash, compute_aggregated_pubkey, compute_threshold,
    new_registry_sync_cache, sign_registry_sync_message, RegistrySyncCache, RegistrySyncConfig,
    RegistrySyncError, RegistrySyncHandler, RegistrySyncState,
};
