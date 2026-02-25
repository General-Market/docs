//! Vision type definitions
//!
//! Core data structures for the Vision prediction market system.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// A batch of prediction markets created by a batch creator.
///
/// New auto-batch system: config_hash points to off-chain config (markets, thresholds).
/// On-chain stores only the hash. Full config fetched from data-node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Batch {
    pub id: u64,
    pub creator: Address,
    /// keccak256 of source_id string (identifies the data source)
    pub source_id: H256,
    /// Active config hash (keccak256 of ABI-encoded batch config)
    pub config_hash: H256,
    /// Pending config hash (promoted at tick boundary via lazy promotion)
    pub next_config_hash: H256,
    pub tick_duration: u64,
    /// Active lock window offset in seconds
    pub lock_offset: u64,
    /// Pending lock window offset (promoted with next_config_hash)
    pub next_lock_offset: u64,
    pub created_at_tick: u64,
    /// Last tick at which config was promoted (prevents mid-tick changes)
    pub last_promotion_tick: u64,
    pub paused: bool,
}

/// Per-market config from off-chain batch config.
/// Replaces on-chain market_ids/resolution_types/custom_thresholds.
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
    pub stake_per_tick: U256,
    pub start_tick: u64,
    pub balance: U256,
    pub join_timestamp: u64,
}

/// A bitmap stored off-chain, linking a player's predictions to their on-chain hash.
#[derive(Debug, Clone)]
pub struct StoredBitmap {
    pub player: Address,
    pub batch_id: u64,
    pub bitmap: Vec<u8>,
    pub hash: H256,
    pub received_at: u64,
}

/// The result of settling a single tick across all markets in a batch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickResult {
    pub batch_id: u64,
    pub tick_id: u64,
    pub market_results: Vec<MarketResult>,
    pub player_balances: Vec<PlayerBalance>,
    pub voided_players: Vec<Address>,
}

/// Balance change for a player after tick settlement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerBalance {
    pub player: Address,
    pub old_balance: U256,
    pub new_balance: U256,
    pub delta: i128,
}

/// The result of a single market within a tick.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketResult {
    pub market_id: H256,
    /// Human-readable asset identifier (for settlement recording)
    pub asset_id: String,
    pub outcome: MarketOutcome,
    /// Start price at tick open
    pub start_price: f64,
    /// End price at tick close
    pub end_price: f64,
    pub pct_change: f64,
    pub player_results: Vec<PlayerMarketResult>,
}

/// Possible outcomes for a market at tick resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarketOutcome {
    Up,
    Down,
    Flat,
    Cancelled,
    AllSameSide,
    AllLosers,
}

/// A player's result for a single market within a tick.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerMarketResult {
    pub player: Address,
    pub side: Side,
    pub effective_stake: U256,
    pub matched_stake: U256,
    pub payout: U256,
    pub refund: U256,
}

/// Multipliers applied to a player's stake based on early entry and commitment.
#[derive(Debug, Clone)]
pub struct PlayerMultiplier {
    pub player: Address,
    pub early_mult: f64,
    pub commitment_mult: f64,
    pub total_mult: f64,
    pub effective_stake: U256,
}

/// Which side of a binary market a player is on.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Side {
    Up,
    Down,
}
