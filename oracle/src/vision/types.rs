//! Vision type definitions
//!
//! Core data structures for the Vision prediction market system (round-based).

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// A batch of prediction markets created by a batch creator.
///
/// Auto-batch system: config_hash points to off-chain config (markets, thresholds).
/// On-chain stores only the hash. Full config fetched from data-node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Batch {
    pub id: u64,
    pub creator: Address,
    /// keccak256 of source_id string (identifies the data source)
    pub source_id: H256,
    /// Active config hash (keccak256 of ABI-encoded batch config)
    pub config_hash: H256,
    pub tick_duration: u64,
    /// Active lock window offset in seconds
    pub lock_offset: u64,
    pub created_at_tick: u64,
    pub paused: bool,
    pub settled: bool,
}

/// Per-market config from off-chain batch config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketConfig {
    pub asset_id: String,
    /// keccak256(asset_id) -- market identifier
    pub market_id: H256,
    /// Resolution type (0-7, parsed from "up_x" string)
    pub resolution_type: u8,
    /// Threshold in basis points (e.g. 150 = 1.5%)
    pub threshold_bps: u32,
}

/// A player's position within a batch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerPosition {
    pub player: Address,
    pub bitmap_hash: H256,
    /// The full deposit committed by the player for this round.
    /// Carried directly from `Vision.PlayerJoined.deposit` — the entire amount
    /// the player put on the table, not a per-tick slice. The resolver splits
    /// this evenly across active markets when settling.
    pub deposit: U256,
}

/// A bitmap in the store.
///
/// Carries config_hash so stale bitmaps can be identified when config rotates.
#[derive(Clone, Debug)]
pub struct SlottedBitmap {
    pub player: Address,
    pub batch_id: u64,
    pub bitmap: Vec<u8>,
    pub hash: H256,
    /// keccak256 of the batch config this bitmap was built against.
    pub config_hash: H256,
    /// Target tick ID (0 for round-based single-round bitmaps).
    pub target_tick_id: u64,
    pub received_at: u64,
}

/// The result of resolving all markets in a batch round.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickResult {
    pub batch_id: u64,
    pub tick_id: u64,
    pub market_results: Vec<MarketResult>,
    pub player_balances: Vec<PlayerBalance>,
    pub voided_players: Vec<Address>,
}

/// Balance change for a player after round settlement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerBalance {
    pub player: Address,
    pub old_balance: U256,
    pub new_balance: U256,
    pub delta: i128,
}

/// The result of a single market within a round.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketResult {
    pub market_id: H256,
    /// Human-readable asset identifier (for settlement recording)
    pub asset_id: String,
    pub outcome: MarketOutcome,
    /// Start price at round open (f64 kept for logging/serialization)
    pub start_price: f64,
    /// End price at round close (f64 kept for logging/serialization)
    pub end_price: f64,
    /// Percent change in basis points (integer, deterministic).
    pub pct_change_bps: i64,
    pub player_results: Vec<PlayerMarketResult>,
}

/// Possible outcomes for a market at resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarketOutcome {
    Up,
    Down,
    Flat,
    Cancelled,
    AllSameSide,
    AllLosers,
}

/// A player's result for a single market within a round.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerMarketResult {
    pub player: Address,
    pub side: Side,
    pub effective_stake: U256,
    pub matched_stake: U256,
    pub payout: U256,
    pub refund: U256,
}

/// Which side of a binary market a player is on.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Side {
    Up,
    Down,
}

// =============================================================================
// Round-based batch types
// =============================================================================

/// Lifecycle state of a round-based batch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoundState {
    Betting,
    Locked,
    Settling,
    Settled,
}

/// Full settlement result for a round, ready for BLS signing and on-chain submission.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoundSettlement {
    pub batch_id: u64,
    pub players: Vec<Address>,
    pub payouts: Vec<U256>,
    /// Per-player original deposit (18-decimal L3 USDC). Used for pnl recording.
    pub deposits: Vec<U256>,
    /// Per-player: how many markets they predicted correctly
    pub correct_counts: Vec<u32>,
    pub total_markets: u32,
}
