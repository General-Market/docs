//! Vision type definitions
//!
//! Core data structures for the Vision prediction market system.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// A batch of prediction markets created by a batch creator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Batch {
    pub id: u64,
    pub creator: Address,
    pub market_ids: Vec<H256>,
    pub resolution_types: Vec<u8>,
    pub tick_duration: u64,
    pub custom_thresholds: Vec<U256>,
    pub created_at_tick: u64,
    pub paused: bool,
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
    pub outcome: MarketOutcome,
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
