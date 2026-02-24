//! Consensus module for BLS-based agreement between issuers
//!
//! Implements the consensus protocol for Index L3 issuers:
//! - Price consensus: Leader proposes prices, followers vote
//! - Batch consensus: Leader proposes batch, followers sign
//! - Signature aggregation: BFT 2/3+1 threshold for batch approval
//!
//! ## Protocol Flow
//!
//! ```text
//! 1. Leader elected (via LeaderElector from Story 3.11)
//! 2. PHASE 1: Price Consensus
//!    - Leader broadcasts PRICE_PROPOSAL (500ms timeout)
//!    - Followers respond PRICE_VOTE within 300ms
//!    - If ≥20% disagree → retry (max 3 times)
//! 3. PHASE 2: Batch Consensus
//!    - Leader broadcasts BATCH_PROPOSAL (500ms timeout)
//!    - Followers respond BATCH_SIGN within 300ms
//!    - Leader aggregates when BFT threshold (>2/3) signatures received
//! 4. Leader submits aggregated signature on-chain
//! ```

pub mod aggregator;
pub mod equivocation;
pub mod itp_creation;
pub mod rebalance_request;
mod keys;
mod messages;
mod protocol;
mod state;

pub use aggregator::{AggregationStatus, SignatureAggregator, compute_threshold};
pub use itp_creation::{
    build_message_hash, verify_proposal_matches_request, ItpCreationConfig, ItpCreationError,
    ItpCreationResult,
};
pub use rebalance_request::{
    build_rebalance_request_hash, compute_rebalance_weights_hash,
    RebalanceRequestConfig, RebalanceRequestError, RebalanceRequestResult,
};
pub use keys::{InMemoryKeyRegistry, KeyRegistry};
pub use messages::ConsensusMessageHandler;
pub use protocol::{ConfigUpdate, ConsensusConfig, ConsensusProtocol, ConsensusResult};
pub use state::{ConsensusPhase, ConsensusRound, ConsensusState, ConsensusTimeouts};
