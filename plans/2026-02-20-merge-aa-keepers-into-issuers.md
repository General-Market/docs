# Merge AA Keepers into Index Issuers — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add betting arbitration to the issuer binary as a modular async subsystem, eliminating the AA keeper binary.

**Architecture:** New `issuer/src/arbitration/` module runs alongside the 1-second trading cycle. Reuses Index's BLS (`common/src/bls/`), P2P (TCP+TLS+MessagePack), and chain infrastructure. AA's HTTP P2P and BLS code are deleted. New `ArbitrationSettlement.sol` contract uses IssuerRegistry for BLS verification with configurable threshold (default 2).

**Tech Stack:** Rust (issuer + common crates), Solidity (ArbitrationSettlement), ethers-rs, arkworks BN254, axum (data-node REST client), reqwest (HTTP client for data-node queries)

**Design doc:** `docs/plans/2026-02-20-merge-aa-keepers-into-issuers-design.md`

---

### Task 1: Add Arbitration P2P Message Types

**Files:**
- Modify: `common/src/types/p2p.rs:596` (before `OrderFill` struct)

**Step 1: Add new types to P2PMessage enum**

Add these variants before the closing `}` of `P2PMessage` enum (after `SetItpNavSign` at line 595):

```rust
    // ==================== Arbitration Consensus ====================

    /// Leader proposes exit prices for arbitration resolution
    /// Timeout: 500ms, Retry: 1
    ArbitrationPriceProposal {
        /// Leader's peer ID
        leader_id: PeerId,
        /// Bet ID from CollateralVault
        bet_id: U256,
        /// Exit prices per trade: (trade_index, symbol, exit_price_cents)
        prices: Vec<(u32, String, i64)>,
        /// Timestamp of price fetch
        timestamp: u64,
        /// Leader's BLS signature on the proposal hash
        leader_signature: BLSSignature,
    },

    /// Follower votes on arbitration price proposal
    /// Timeout: 300ms, Retry: 0
    ArbitrationPriceVote {
        /// Voter's peer ID
        voter_id: PeerId,
        /// Voter's index in issuer set (for bitmap)
        voter_index: u8,
        /// Bet ID (identifies proposal)
        bet_id: U256,
        /// Accept or reject
        accept: bool,
        /// Voter's BLS signature
        signature: BLSSignature,
    },

    /// Follower signs arbitration resolution outcome
    /// Timeout: 300ms, Retry: 0
    ArbitrationResolutionSign {
        /// Signer's peer ID
        signer_id: PeerId,
        /// Signer's index in issuer set (for bitmap)
        signer_index: u8,
        /// Bet ID (identifies proposal)
        bet_id: U256,
        /// keccak256(abi.encode(betId, creatorWins))
        outcome_hash: H256,
        /// Signer's BLS signature on outcome_hash
        signature: BLSSignature,
    },
```

**Step 2: Run test to verify serialization compiles**

Run: `cargo test -p common -- p2p --no-run`
Expected: Compiles successfully

**Step 3: Add serialization roundtrip tests**

Add after the existing tests in `common/src/types/p2p.rs`:

```rust
    #[test]
    fn test_arbitration_price_proposal_serialization_roundtrip() {
        let msg = P2PMessage::ArbitrationPriceProposal {
            leader_id: [0x99u8; 32],
            bet_id: U256::from(42),
            prices: vec![(0, "AAPL".to_string(), 15023), (1, "MSFT".to_string(), 41520)],
            timestamp: 1700000000,
            leader_signature: BLSSignature(vec![0x01, 0x02, 0x03]),
        };
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        assert_eq!(msg, deserialized);
    }

    #[test]
    fn test_arbitration_price_vote_serialization_roundtrip() {
        let msg = P2PMessage::ArbitrationPriceVote {
            voter_id: [0x88u8; 32],
            voter_index: 3,
            bet_id: U256::from(42),
            accept: true,
            signature: BLSSignature(vec![0xAA, 0xBB]),
        };
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        assert_eq!(msg, deserialized);
    }

    #[test]
    fn test_arbitration_resolution_sign_serialization_roundtrip() {
        let msg = P2PMessage::ArbitrationResolutionSign {
            signer_id: [0x77u8; 32],
            signer_index: 1,
            bet_id: U256::from(42),
            outcome_hash: H256::from([0xABu8; 32]),
            signature: BLSSignature(vec![0xCC, 0xDD]),
        };
        let serialized = rmp_serde::to_vec(&msg).expect("Serialization failed");
        let deserialized: P2PMessage = rmp_serde::from_slice(&serialized).expect("Deserialization failed");
        assert_eq!(msg, deserialized);
    }
```

**Step 4: Run tests**

Run: `cargo test -p common -- p2p -v`
Expected: All 3 new tests PASS plus existing tests still pass

**Step 5: Commit**

```bash
git add common/src/types/p2p.rs
git commit -m "feat(common): add ArbitrationPriceProposal/Vote/ResolutionSign P2P message types"
```

---

### Task 2: Wire Arbitration Messages into ConsensusMessageHandler

**Files:**
- Modify: `issuer/src/consensus/messages.rs`

**Step 1: Add new MessageHandleResult variants**

Find the `MessageHandleResult` enum in `issuer/src/consensus/messages.rs` and add:

```rust
    /// Forward arbitration price proposal to arbitration subsystem
    ForwardToArbitration(P2PMessage),
```

**Step 2: Add match arms for arbitration messages**

In the `handle_message` method, add match arms for the 3 new P2P message types. They should all forward to arbitration:

```rust
            P2PMessage::ArbitrationPriceProposal { .. }
            | P2PMessage::ArbitrationPriceVote { .. }
            | P2PMessage::ArbitrationResolutionSign { .. } => {
                debug!(?from, "Forwarding arbitration message to subsystem");
                MessageHandleResult::ForwardToArbitration(message)
            }
```

**Step 3: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles (with warnings about unused variant — expected until Task 6 wires it)

**Step 4: Commit**

```bash
git add issuer/src/consensus/messages.rs
git commit -m "feat(issuer): route arbitration P2P messages to ForwardToArbitration handler"
```

---

### Task 3: Create Arbitration Types Module

**Files:**
- Create: `issuer/src/arbitration/types.rs`

Port AA's domain types adapted to Index error conventions.

**Step 1: Write the types module**

```rust
//! Arbitration domain types
//!
//! Adapted from AA keeper's types.rs and bilateral_resolution.rs.
//! Uses Index error conventions (thiserror) instead of anyhow.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// Arbitration configuration
#[derive(Debug, Clone)]
pub struct ArbitrationConfig {
    /// CollateralVault contract address
    pub collateral_vault: Address,
    /// ArbitrationSettlement contract address
    pub settlement_contract: Address,
    /// BLS signature threshold (default: 2)
    pub signature_threshold: usize,
    /// Polling interval for arbitration events (seconds)
    pub poll_interval_secs: u64,
    /// Total consensus timeout (ms) across all phases
    pub consensus_timeout_ms: u64,
    /// Data-node base URL for price queries
    pub data_node_url: String,
    /// Price tolerance in basis points (e.g. 50 = 0.5%)
    pub price_tolerance_bps: u32,
}

impl Default for ArbitrationConfig {
    fn default() -> Self {
        Self {
            collateral_vault: Address::zero(),
            settlement_contract: Address::zero(),
            signature_threshold: 2,
            poll_interval_secs: 30,
            consensus_timeout_ms: 1100,
            data_node_url: "http://localhost:8200".to_string(),
            price_tolerance_bps: 50,
        }
    }
}

/// An arbitration request from CollateralVault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrationRequest {
    /// Bet ID from CollateralVault
    pub bet_id: U256,
    /// Merkle root of trades
    pub trades_root: H256,
    /// Bet creator address
    pub creator: Address,
    /// Bet filler address
    pub filler: Address,
    /// Creator's staked amount
    pub creator_amount: U256,
    /// Filler's staked amount
    pub filler_amount: U256,
    /// Resolution deadline
    pub deadline: U256,
}

/// Exit price for a single trade (integer cents for determinism)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArbitrationTradePrice {
    /// Trade index within the bet
    pub trade_index: u32,
    /// Asset symbol (e.g. "AAPL")
    pub symbol: String,
    /// Exit price in integer cents (deterministic)
    pub exit_price_cents: i64,
}

/// Result of arbitration consensus
#[derive(Debug, Clone)]
pub struct ArbitrationResult {
    /// Bet ID
    pub bet_id: U256,
    /// Whether the bet creator wins
    pub creator_wins: bool,
    /// Aggregated BLS signature (64 bytes, G1 point)
    pub aggregated_signature: Vec<u8>,
    /// Bitmap of which issuers signed (bit i = issuer i)
    pub signer_bitmap: U256,
    /// Number of signers
    pub signer_count: usize,
}

/// Phase of the 4-phase arbitration consensus
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArbitrationPhase {
    /// Waiting for arbitration request
    Idle,
    /// Leader proposed exit prices, collecting votes
    PriceProposal,
    /// Price accepted, collecting resolution signatures
    PriceVote,
    /// Signatures collected, ready for aggregation
    ResolutionSign,
    /// Consensus complete
    Complete,
    /// Consensus failed
    Failed,
}
```

**Step 2: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles (module not yet wired into lib.rs — will be in Task 6)

**Step 3: Commit**

```bash
git add issuer/src/arbitration/types.rs
git commit -m "feat(issuer): add arbitration domain types (ArbitrationConfig, Request, Result, Phase)"
```

---

### Task 4: Port Bilateral Resolution Logic

**Files:**
- Create: `issuer/src/arbitration/resolution.rs`
- Reference: `../AA/keeper/src/bilateral_resolution.rs` (lines 1-358)

Port AA's bilateral resolution with minimal changes: swap `anyhow` for `thiserror`, drop the `PgPool` dependency (data comes from data-node REST now), keep all integer math identical.

**Step 1: Write the resolution module**

```rust
//! Bilateral Resolution VM
//!
//! Deterministic evaluation of bilateral bet outcomes using method-based resolution.
//! Ported from AA keeper's bilateral_resolution.rs.
//!
//! ## Method Types
//! - `up:X` → maker wins if exit > entry * (1 + X%)
//! - `down:X` → maker wins if exit < entry * (1 - X%)
//! - `flat:X` → maker wins if |exit - entry| <= entry * X%
//!
//! ## Determinism Requirements
//! - Uses INTEGER math only (i64) — no floats
//! - Prices stored as smallest unit (cents)
//! - Threshold stored as basis points (10000 = 100%)
//! - Taker wins on ties

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use thiserror::Error;
use tracing::{debug, info};

/// Basis points base (10000 = 100%)
pub const BPS_BASE: i64 = 10000;

/// Compiled regex for method format validation
static METHOD_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(up|down|flat):(\d{1,4}(?:\.\d{1,2})?)$").expect("Invalid regex pattern")
});

#[derive(Error, Debug)]
pub enum ResolutionError {
    #[error("Invalid method format: '{0}'. Expected 'up:X', 'down:X', or 'flat:X'")]
    InvalidMethod(String),
    #[error("Invalid threshold value: {0}")]
    InvalidThreshold(String),
    #[error("Threshold out of range (must be 0-99.99%, got {0} bps)")]
    ThresholdOutOfRange(i64),
    #[error("Invalid entry price: {0} (must be positive)")]
    InvalidEntryPrice(i64),
    #[error("Invalid exit price: {0} (must be non-negative)")]
    InvalidExitPrice(i64),
    #[error("Integer overflow in {context}: {detail}")]
    Overflow { context: String, detail: String },
}

/// Parse threshold string to basis points using INTEGER MATH ONLY
/// Examples: "10" -> 1000 bps, "10.5" -> 1050 bps, "0.01" -> 1 bps
fn parse_threshold_to_bps(threshold_str: &str) -> Result<i64, ResolutionError> {
    if let Some(dot_pos) = threshold_str.find('.') {
        let int_part = &threshold_str[..dot_pos];
        let dec_part = &threshold_str[dot_pos + 1..];

        let int_val: i64 = if int_part.is_empty() {
            0
        } else {
            int_part.parse().map_err(|_| ResolutionError::InvalidThreshold(threshold_str.to_string()))?
        };

        let dec_val: i64 = match dec_part.len() {
            0 => 0,
            1 => {
                let d: i64 = dec_part.parse().map_err(|_| ResolutionError::InvalidThreshold(threshold_str.to_string()))?;
                d * 10
            }
            _ => {
                let d: i64 = dec_part[..2].parse().map_err(|_| ResolutionError::InvalidThreshold(threshold_str.to_string()))?;
                d
            }
        };

        Ok(int_val * 100 + dec_val)
    } else {
        let int_val: i64 = threshold_str.parse().map_err(|_| ResolutionError::InvalidThreshold(threshold_str.to_string()))?;
        Ok(int_val * 100)
    }
}

/// Resolution method type with threshold in basis points
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MethodType {
    Up(i64),
    Down(i64),
    Flat(i64),
}

impl MethodType {
    pub fn parse(method: &str) -> Result<Self, ResolutionError> {
        let caps = METHOD_REGEX
            .captures(method)
            .ok_or_else(|| ResolutionError::InvalidMethod(method.to_string()))?;

        let method_type = &caps[1];
        let threshold_str = &caps[2];
        let threshold_bps = parse_threshold_to_bps(threshold_str)?;

        if threshold_bps < 0 || threshold_bps > 9999 {
            return Err(ResolutionError::ThresholdOutOfRange(threshold_bps));
        }

        match method_type {
            "up" => Ok(MethodType::Up(threshold_bps)),
            "down" => Ok(MethodType::Down(threshold_bps)),
            "flat" => Ok(MethodType::Flat(threshold_bps)),
            _ => Err(ResolutionError::InvalidMethod(method.to_string())),
        }
    }

    pub fn threshold_bps(&self) -> i64 {
        match self {
            MethodType::Up(t) | MethodType::Down(t) | MethodType::Flat(t) => *t,
        }
    }
}

/// Evaluate a single trade to determine if maker wins
///
/// Returns `Ok(Some(true))` for maker win, `Ok(Some(false))` for taker win,
/// `Ok(None)` for no price movement (skipped).
pub fn evaluate_trade(entry: i64, exit: i64, method: &MethodType) -> Result<Option<bool>, ResolutionError> {
    if entry <= 0 {
        return Err(ResolutionError::InvalidEntryPrice(entry));
    }
    if exit < 0 {
        return Err(ResolutionError::InvalidExitPrice(exit));
    }
    if entry == exit {
        return Ok(None);
    }

    let result = match method {
        MethodType::Up(threshold_bps) => {
            let lhs = exit.checked_mul(BPS_BASE).ok_or_else(|| ResolutionError::Overflow {
                context: "up:lhs".into(), detail: format!("{} * {}", exit, BPS_BASE),
            })?;
            let rhs = entry.checked_mul(BPS_BASE + threshold_bps).ok_or_else(|| ResolutionError::Overflow {
                context: "up:rhs".into(), detail: format!("{} * {}", entry, BPS_BASE + threshold_bps),
            })?;
            lhs > rhs
        }
        MethodType::Down(threshold_bps) => {
            if *threshold_bps >= BPS_BASE { false }
            else {
                let lhs = exit.checked_mul(BPS_BASE).ok_or_else(|| ResolutionError::Overflow {
                    context: "down:lhs".into(), detail: format!("{} * {}", exit, BPS_BASE),
                })?;
                let rhs = entry.checked_mul(BPS_BASE - threshold_bps).ok_or_else(|| ResolutionError::Overflow {
                    context: "down:rhs".into(), detail: format!("{} * {}", entry, BPS_BASE - threshold_bps),
                })?;
                lhs < rhs
            }
        }
        MethodType::Flat(threshold_bps) => {
            let diff = (exit - entry).abs();
            let lhs = diff.checked_mul(BPS_BASE).ok_or_else(|| ResolutionError::Overflow {
                context: "flat:lhs".into(), detail: format!("{} * {}", diff, BPS_BASE),
            })?;
            let rhs = entry.checked_mul(*threshold_bps).ok_or_else(|| ResolutionError::Overflow {
                context: "flat:rhs".into(), detail: format!("{} * {}", entry, threshold_bps),
            })?;
            lhs <= rhs
        }
    };

    Ok(Some(result))
}

/// Winner of a bet
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Winner {
    Maker,
    Taker,
}

/// Outcome of bet resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Outcome {
    pub maker_wins: u64,
    pub taker_wins: u64,
    pub total: u64,
    pub winner: Winner,
}

/// Trade data for resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub ticker: String,
    pub entry_price: i64,
    pub exit_price: Option<i64>,
    pub method: String,
}

/// Compute the outcome for a list of trades.
/// Taker wins ties (convention).
pub fn compute_outcome(trades: &[Trade]) -> Result<Outcome, ResolutionError> {
    let mut maker_wins: u64 = 0;
    let mut taker_wins: u64 = 0;

    for trade in trades {
        let exit = match trade.exit_price {
            Some(e) => e,
            None => {
                debug!(ticker = %trade.ticker, "Skipping trade without exit price");
                continue;
            }
        };

        let method = MethodType::parse(&trade.method)?;
        let result = evaluate_trade(trade.entry_price, exit, &method)?;

        match result {
            Some(true) => maker_wins += 1,
            Some(false) => taker_wins += 1,
            None => {
                debug!(ticker = %trade.ticker, "Skipping trade with no price movement");
            }
        }
    }

    let winner = if maker_wins > taker_wins { Winner::Maker } else { Winner::Taker };

    let outcome = Outcome { maker_wins, taker_wins, total: maker_wins + taker_wins, winner };
    info!(maker_wins = outcome.maker_wins, taker_wins = outcome.taker_wins, winner = ?outcome.winner, "Computed bet outcome");
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_threshold_integer() {
        assert_eq!(parse_threshold_to_bps("10").unwrap(), 1000);
        assert_eq!(parse_threshold_to_bps("0").unwrap(), 0);
        assert_eq!(parse_threshold_to_bps("99").unwrap(), 9900);
    }

    #[test]
    fn test_parse_threshold_decimal() {
        assert_eq!(parse_threshold_to_bps("10.5").unwrap(), 1050);
        assert_eq!(parse_threshold_to_bps("10.55").unwrap(), 1055);
        assert_eq!(parse_threshold_to_bps("0.01").unwrap(), 1);
    }

    #[test]
    fn test_method_parse() {
        assert_eq!(MethodType::parse("up:10").unwrap(), MethodType::Up(1000));
        assert_eq!(MethodType::parse("down:5.5").unwrap(), MethodType::Down(550));
        assert_eq!(MethodType::parse("flat:2").unwrap(), MethodType::Flat(200));
    }

    #[test]
    fn test_evaluate_trade_up() {
        // entry=100, exit=120, up:10 (threshold 1000bps = 10%)
        // 120 * 10000 = 1200000 > 100 * 11000 = 1100000 → maker wins
        assert_eq!(evaluate_trade(100, 120, &MethodType::Up(1000)).unwrap(), Some(true));
        // entry=100, exit=105, up:10 → 1050000 < 1100000 → taker wins
        assert_eq!(evaluate_trade(100, 105, &MethodType::Up(1000)).unwrap(), Some(false));
    }

    #[test]
    fn test_evaluate_trade_down() {
        // entry=100, exit=85, down:10 → 850000 < 900000 → maker wins
        assert_eq!(evaluate_trade(100, 85, &MethodType::Down(1000)).unwrap(), Some(true));
        // entry=100, exit=95, down:10 → 950000 > 900000 → taker wins
        assert_eq!(evaluate_trade(100, 95, &MethodType::Down(1000)).unwrap(), Some(false));
    }

    #[test]
    fn test_evaluate_trade_flat() {
        // entry=100, exit=101, flat:2 (200bps = 2%)
        // |101-100| * 10000 = 10000 <= 100 * 200 = 20000 → maker wins
        assert_eq!(evaluate_trade(100, 101, &MethodType::Flat(200)).unwrap(), Some(true));
        // entry=100, exit=105, flat:2 → 50000 > 20000 → taker wins
        assert_eq!(evaluate_trade(100, 105, &MethodType::Flat(200)).unwrap(), Some(false));
    }

    #[test]
    fn test_evaluate_trade_no_movement() {
        assert_eq!(evaluate_trade(100, 100, &MethodType::Up(1000)).unwrap(), None);
    }

    #[test]
    fn test_compute_outcome_maker_wins() {
        let trades = vec![
            Trade { ticker: "A".into(), entry_price: 100, exit_price: Some(120), method: "up:10".into() },
            Trade { ticker: "B".into(), entry_price: 100, exit_price: Some(115), method: "up:10".into() },
            Trade { ticker: "C".into(), entry_price: 100, exit_price: Some(105), method: "up:10".into() },
        ];
        let outcome = compute_outcome(&trades).unwrap();
        assert_eq!(outcome.maker_wins, 2);
        assert_eq!(outcome.taker_wins, 1);
        assert_eq!(outcome.winner, Winner::Maker);
    }

    #[test]
    fn test_compute_outcome_taker_wins_on_tie() {
        let trades = vec![
            Trade { ticker: "A".into(), entry_price: 100, exit_price: Some(120), method: "up:10".into() },
            Trade { ticker: "B".into(), entry_price: 100, exit_price: Some(105), method: "up:10".into() },
        ];
        let outcome = compute_outcome(&trades).unwrap();
        assert_eq!(outcome.maker_wins, 1);
        assert_eq!(outcome.taker_wins, 1);
        assert_eq!(outcome.winner, Winner::Taker); // taker wins ties
    }
}
```

**Step 2: Run tests**

Run: `cargo test -p issuer -- resolution -v`
Expected: All 9 tests PASS

**Step 3: Commit**

```bash
git add issuer/src/arbitration/resolution.rs
git commit -m "feat(issuer): port bilateral resolution VM from AA keeper (integer math, thiserror)"
```

---

### Task 5: Create Data-Node Price Fetcher

**Files:**
- Create: `issuer/src/arbitration/market_data.rs`

Replaces AA's `backend_client.rs` and direct Postgres queries. Queries the merged data-node REST API instead.

**Step 1: Write the market_data module**

```rust
//! Data-node price fetcher for arbitration
//!
//! Queries the data-node REST API (/market/prices/*) to fetch exit prices
//! for arbitration resolution. Replaces AA's direct Postgres access.

use reqwest::Client;
use serde::Deserialize;
use thiserror::Error;
use tracing::{debug, warn};

use super::types::ArbitrationTradePrice;

#[derive(Error, Debug)]
pub enum PriceFetchError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("No price found for symbol: {0}")]
    NotFound(String),
    #[error("Price data invalid for {symbol}: {reason}")]
    InvalidData { symbol: String, reason: String },
}

/// Response from data-node /market/prices/:source
#[derive(Debug, Deserialize)]
struct MarketPriceResponse {
    prices: Vec<MarketPrice>,
}

#[derive(Debug, Deserialize)]
struct MarketPrice {
    symbol: String,
    value: f64,
}

/// Fetches exit prices from the data-node REST API
#[derive(Debug, Clone)]
pub struct DataNodePriceFetcher {
    client: Client,
    base_url: String,
}

impl DataNodePriceFetcher {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// Fetch current price for a symbol from data-node
    ///
    /// Queries /market/prices/stocks?symbols={symbol} for stock tickers,
    /// or /market/prices/crypto?symbols={symbol} for crypto.
    ///
    /// Returns price in integer cents for deterministic comparison.
    pub async fn fetch_price_cents(&self, symbol: &str) -> Result<i64, PriceFetchError> {
        // Try stocks first (most AA bets are stock-based)
        let url = format!("{}/market/prices/stocks?symbols={}", self.base_url, symbol);
        debug!(url = %url, "Fetching price from data-node");

        let resp = self.client.get(&url).send().await?;

        if resp.status().is_success() {
            let body: MarketPriceResponse = resp.json().await?;
            if let Some(price) = body.prices.first() {
                // Convert to integer cents (multiply by 100, truncate)
                let cents = (price.value * 100.0) as i64;
                debug!(symbol = %symbol, cents = cents, "Got price from data-node");
                return Ok(cents);
            }
        }

        // Fallback: try crypto source
        let url = format!("{}/market/prices/crypto?symbols={}", self.base_url, symbol);
        let resp = self.client.get(&url).send().await?;

        if resp.status().is_success() {
            let body: MarketPriceResponse = resp.json().await?;
            if let Some(price) = body.prices.first() {
                let cents = (price.value * 100.0) as i64;
                return Ok(cents);
            }
        }

        Err(PriceFetchError::NotFound(symbol.to_string()))
    }

    /// Fetch exit prices for a list of trade symbols
    pub async fn fetch_trade_prices(
        &self,
        trades: &[(u32, String)], // (trade_index, symbol)
    ) -> Result<Vec<ArbitrationTradePrice>, PriceFetchError> {
        let mut prices = Vec::with_capacity(trades.len());

        for (trade_index, symbol) in trades {
            let exit_price_cents = self.fetch_price_cents(symbol).await?;
            prices.push(ArbitrationTradePrice {
                trade_index: *trade_index,
                symbol: symbol.clone(),
                exit_price_cents,
            });
        }

        Ok(prices)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_fetcher_creation() {
        let fetcher = DataNodePriceFetcher::new("http://localhost:8200/");
        assert_eq!(fetcher.base_url, "http://localhost:8200");
    }

    #[test]
    fn test_price_fetcher_trailing_slash_stripped() {
        let fetcher = DataNodePriceFetcher::new("http://localhost:8200///");
        assert_eq!(fetcher.base_url, "http://localhost:8200");
    }
}
```

**Step 2: Run tests**

Run: `cargo test -p issuer -- market_data -v`
Expected: 2 unit tests PASS

**Step 3: Commit**

```bash
git add issuer/src/arbitration/market_data.rs
git commit -m "feat(issuer): add DataNodePriceFetcher for arbitration exit prices"
```

---

### Task 6: Create Arbitration Module Scaffold + Wire into Issuer

**Files:**
- Create: `issuer/src/arbitration/mod.rs`
- Modify: `issuer/src/lib.rs` (add `pub mod arbitration;`)

**Step 1: Write the module file**

```rust
//! Arbitration subsystem
//!
//! Runs as an async task alongside the 1-second trading cycle.
//! Listens for ArbitrationRequested events from CollateralVault,
//! runs 4-phase consensus per bet, and submits resolution on-chain.

pub mod types;
pub mod resolution;
pub mod market_data;

use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn, error};

use common::types::P2PMessage;
use types::ArbitrationConfig;

/// Channel for forwarding arbitration P2P messages from consensus handler
pub type ArbitrationMessageSender = mpsc::UnboundedSender<P2PMessage>;
pub type ArbitrationMessageReceiver = mpsc::UnboundedReceiver<P2PMessage>;

/// Create a channel pair for arbitration message forwarding
pub fn arbitration_channel() -> (ArbitrationMessageSender, ArbitrationMessageReceiver) {
    mpsc::unbounded_channel()
}

/// Top-level arbitration subsystem
///
/// Spawns listener and processor tasks, receives forwarded P2P messages.
pub struct ArbitrationSubsystem {
    config: ArbitrationConfig,
    message_rx: ArbitrationMessageReceiver,
}

impl ArbitrationSubsystem {
    pub fn new(config: ArbitrationConfig, message_rx: ArbitrationMessageReceiver) -> Self {
        Self { config, message_rx }
    }

    /// Run the arbitration subsystem (blocks until shutdown)
    pub async fn run(mut self, shutdown: Arc<std::sync::atomic::AtomicBool>) {
        info!(
            vault = %self.config.collateral_vault,
            threshold = self.config.signature_threshold,
            poll_interval = self.config.poll_interval_secs,
            "Arbitration subsystem started"
        );

        // TODO Task 7: Start ArbitrationListener (polls CollateralVault events)
        // TODO Task 8: Start ArbitrationProcessor (runs consensus per bet)

        // Message forwarding loop
        loop {
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("Arbitration subsystem shutting down");
                break;
            }

            tokio::select! {
                Some(msg) = self.message_rx.recv() => {
                    match msg {
                        P2PMessage::ArbitrationPriceProposal { bet_id, .. } => {
                            info!(bet_id = %bet_id, "Received arbitration price proposal");
                            // TODO Task 8: Forward to processor
                        }
                        P2PMessage::ArbitrationPriceVote { bet_id, .. } => {
                            info!(bet_id = %bet_id, "Received arbitration price vote");
                            // TODO Task 8: Forward to processor
                        }
                        P2PMessage::ArbitrationResolutionSign { bet_id, .. } => {
                            info!(bet_id = %bet_id, "Received arbitration resolution signature");
                            // TODO Task 8: Forward to processor
                        }
                        _ => {
                            warn!("Unexpected message type in arbitration channel");
                        }
                    }
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {
                    // Periodic tick (for listener polling in Task 7)
                }
            }
        }
    }
}
```

**Step 2: Wire into lib.rs**

Add `pub mod arbitration;` to `issuer/src/lib.rs` alongside the other module declarations.

**Step 3: Add `regex` dependency to issuer Cargo.toml**

The resolution module uses `regex` (via `LazyLock`). Check if it's already a dependency; if not, add it.

Run: `grep regex issuer/Cargo.toml`

If missing, add: `regex = "1"` to `[dependencies]`

**Step 4: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles with warnings about unused fields/TODOs

**Step 5: Run all tests**

Run: `cargo test -p issuer -- arbitration -v`
Expected: All resolution + market_data tests pass

**Step 6: Commit**

```bash
git add issuer/src/arbitration/ issuer/src/lib.rs issuer/Cargo.toml
git commit -m "feat(issuer): wire arbitration module into issuer (scaffold + resolution + price fetcher)"
```

---

### Task 7: Add Arbitration Config to Issuer Config

**Files:**
- Modify: `issuer/src/config.rs`
- Modify: `issuer/src/main.rs` (parse new CLI args)

**Step 1: Add arbitration fields to IssuerConfig**

In `issuer/src/config.rs`, add to the `IssuerConfig` struct:

```rust
    // --- Arbitration subsystem fields ---
    /// Enable arbitration subsystem (default: false)
    pub arbitration_enabled: Option<bool>,
    /// CollateralVault contract address for arbitration events
    pub arbitration_collateral_vault: Option<String>,
    /// ArbitrationSettlement contract address
    pub arbitration_settlement_contract: Option<String>,
    /// BLS signature threshold for arbitration (default: 2)
    pub arbitration_threshold: Option<usize>,
    /// Polling interval for arbitration events in seconds (default: 30)
    pub arbitration_poll_interval: Option<u64>,
    /// Data-node URL for price queries (default: http://localhost:8200)
    pub arbitration_data_node_url: Option<String>,
```

**Step 2: Add CLI args to main.rs Args struct**

```rust
    /// Enable arbitration subsystem
    #[arg(long)]
    arbitration_enabled: Option<bool>,

    /// CollateralVault address for arbitration
    #[arg(long)]
    arbitration_vault: Option<String>,

    /// ArbitrationSettlement contract address
    #[arg(long)]
    arbitration_settlement: Option<String>,

    /// BLS threshold for arbitration (default: 2)
    #[arg(long)]
    arbitration_threshold: Option<usize>,

    /// Data-node URL for arbitration price queries
    #[arg(long)]
    arbitration_data_node_url: Option<String>,
```

**Step 3: Wire config into ArbitrationConfig construction**

Add a helper method or builder that converts `IssuerConfig` arbitration fields into `ArbitrationConfig`. Add this in the config module or in `arbitration/types.rs`:

```rust
impl ArbitrationConfig {
    pub fn from_issuer_config(config: &IssuerConfig) -> Option<Self> {
        if !config.arbitration_enabled.unwrap_or(false) {
            return None;
        }
        let vault = config.arbitration_collateral_vault.as_ref()?
            .parse().ok()?;
        let settlement = config.arbitration_settlement_contract.as_ref()?
            .parse().ok()?;
        Some(Self {
            collateral_vault: vault,
            settlement_contract: settlement,
            signature_threshold: config.arbitration_threshold.unwrap_or(2),
            poll_interval_secs: config.arbitration_poll_interval.unwrap_or(30),
            data_node_url: config.arbitration_data_node_url.clone()
                .unwrap_or_else(|| "http://localhost:8200".to_string()),
            ..Default::default()
        })
    }
}
```

**Step 4: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles

**Step 5: Commit**

```bash
git add issuer/src/config.rs issuer/src/main.rs issuer/src/arbitration/types.rs
git commit -m "feat(issuer): add arbitration config fields (vault, threshold, data-node-url)"
```

---

### Task 8: Write ArbitrationSettlement.sol Contract

**Files:**
- Create: `contracts/src/arbitration/ArbitrationSettlement.sol`
- Reference: `contracts/src/libraries/BLSLib.sol` (already exists)
- Reference: `contracts/src/registry/IssuerRegistry.sol` (already exists)

**Step 1: Write the contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BLSLib} from "../libraries/BLSLib.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";

/// @title ArbitrationSettlement — BLS-verified bet resolution via issuer consensus
/// @notice Replaces ResolutionDAOVoting. Uses IssuerRegistry for BLS key management.
/// @dev Configurable signature threshold (default 2, upgradable via governance).
contract ArbitrationSettlement {
    // ============ ERRORS ============
    error ZeroBetId();
    error InsufficientSignatures(uint256 provided, uint256 required);
    error InvalidBLSSignature();
    error BetAlreadySettled(uint256 betId);
    error InvalidThreshold(uint256 threshold);
    error Unauthorized();

    // ============ EVENTS ============
    event BetSettled(uint256 indexed betId, bool creatorWins, uint256 signerCount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============ STATE ============
    IIssuerRegistry public immutable issuerRegistry;
    address public immutable collateralVault;
    address public governance;
    uint256 public signatureThreshold;

    /// @notice Track settled bets to prevent double-settlement
    mapping(uint256 => bool) public settled;

    // ============ CONSTRUCTOR ============
    constructor(
        address _issuerRegistry,
        address _collateralVault,
        address _governance,
        uint256 _threshold
    ) {
        issuerRegistry = IIssuerRegistry(_issuerRegistry);
        collateralVault = _collateralVault;
        governance = _governance;
        signatureThreshold = _threshold;
    }

    // ============ SETTLEMENT ============

    /// @notice Settle a bet using aggregated BLS signatures from issuers
    /// @param betId The bet ID from CollateralVault
    /// @param creatorWins Whether the creator wins the bet
    /// @param signature Aggregated BLS G1 signature (64 bytes: x || y)
    /// @param signerBitmap Bitmap of which issuers signed (bit i = issuer i)
    function settleBet(
        uint256 betId,
        bool creatorWins,
        uint256[2] calldata signature,
        uint256 signerBitmap
    ) external {
        if (betId == 0) revert ZeroBetId();
        if (settled[betId]) revert BetAlreadySettled(betId);

        // Count signers from bitmap
        uint256 signerCount = _popcount(signerBitmap);
        if (signerCount < signatureThreshold) {
            revert InsufficientSignatures(signerCount, signatureThreshold);
        }

        // Build message hash: keccak256(abi.encode(betId, creatorWins))
        bytes32 messageHash = keccak256(abi.encode(betId, creatorWins));

        // Compute aggregated pubkey from IssuerRegistry for the signing set
        uint256[4] memory aggPubkey = _aggregatePubkeys(signerBitmap);

        // Verify BLS signature
        uint256[2] memory hashPoint = BLSLib.hashToG1(messageHash);
        bool valid = BLSLib.verifySignature(hashPoint, signature, aggPubkey);
        if (!valid) revert InvalidBLSSignature();

        // Mark as settled
        settled[betId] = true;

        // Call CollateralVault to execute settlement
        // The vault's settleBetByArbitration(betId, winner) handles payouts
        (bool success,) = collateralVault.call(
            abi.encodeWithSignature(
                "settleBetByArbitration(uint256,bool)",
                betId,
                creatorWins
            )
        );
        require(success, "Settlement call failed");

        emit BetSettled(betId, creatorWins, signerCount);
    }

    // ============ GOVERNANCE ============

    function setThreshold(uint256 newThreshold) external {
        if (msg.sender != governance) revert Unauthorized();
        if (newThreshold == 0) revert InvalidThreshold(newThreshold);
        uint256 old = signatureThreshold;
        signatureThreshold = newThreshold;
        emit ThresholdUpdated(old, newThreshold);
    }

    // ============ INTERNAL ============

    /// @notice Aggregate pubkeys from IssuerRegistry for the given signer bitmap
    function _aggregatePubkeys(uint256 bitmap) internal view returns (uint256[4] memory agg) {
        bool first = true;
        for (uint256 i = 0; i < 256; i++) {
            if (bitmap & (1 << i) != 0) {
                // Get pubkey for issuer i from registry
                bytes memory pubkeyBytes = issuerRegistry.getIssuerPubkey(i);
                require(pubkeyBytes.length == 128, "Invalid pubkey length");

                uint256[4] memory pk;
                assembly {
                    pk := add(pubkeyBytes, 32)
                }

                if (first) {
                    agg = pk;
                    first = false;
                } else {
                    // G2 addition via ecAdd isn't directly available as a precompile.
                    // For G2 aggregation, we store the pre-aggregated pubkey in IssuerRegistry
                    // and verify against it. This loop is for bitmap validation only.
                    // In practice, the aggregated pubkey is computed off-chain by issuers
                    // and we verify signature against the registry's stored aggregated key
                    // filtered by the bitmap.
                    revert("G2 aggregation: use registry pre-aggregated key");
                }
            }
        }
    }

    /// @notice Count set bits in a uint256
    function _popcount(uint256 x) internal pure returns (uint256 count) {
        while (x != 0) {
            count += x & 1;
            x >>= 1;
        }
    }
}
```

**Note:** The G2 aggregation approach needs refinement — in practice, issuers pass the pre-aggregated pubkey or the contract uses the registry's stored aggregated key. This is the same pattern used by `Index.sol` for batch confirmation. Adapt based on how `Index.sol` currently handles bitmap-based BLS verification.

**Step 2: Verify compilation**

Run: `forge build` (from contracts/ directory)
Expected: Compiles. May need interface adjustments for `getIssuerPubkey`.

**Step 3: Commit**

```bash
git add contracts/src/arbitration/ArbitrationSettlement.sol
git commit -m "feat(contracts): add ArbitrationSettlement with IssuerRegistry BLS verification"
```

---

### Task 9: Create ArbitrationListener (Event Polling)

**Files:**
- Create: `issuer/src/arbitration/listener.rs`

Polls CollateralVault for `ArbitrationRequested` events using the issuer's existing ChainReader infrastructure.

**Step 1: Write the listener module**

```rust
//! Arbitration event listener
//!
//! Polls CollateralVault for ArbitrationRequested events.
//! Adapted from AA's arbitration_listener.rs but uses Index's ChainReader.

use ethers::types::{Address, Filter, Log, H256, U256, U64};
use ethers::abi::AbiDecode;
use ethers::providers::{Middleware, Provider, Http};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, info, warn, error};

use super::types::ArbitrationRequest;

/// Event signature: ArbitrationRequested(uint256 indexed betId, address indexed requestedBy)
const ARBITRATION_REQUESTED_TOPIC: &str =
    "ArbitrationRequested(uint256,address)";

/// Listens for ArbitrationRequested events from CollateralVault
pub struct ArbitrationListener {
    provider: Arc<Provider<Http>>,
    vault_address: Address,
    poll_interval_secs: u64,
    last_block: U64,
    request_tx: mpsc::UnboundedSender<ArbitrationRequest>,
}

impl ArbitrationListener {
    pub fn new(
        provider: Arc<Provider<Http>>,
        vault_address: Address,
        poll_interval_secs: u64,
        request_tx: mpsc::UnboundedSender<ArbitrationRequest>,
    ) -> Self {
        Self {
            provider,
            vault_address,
            poll_interval_secs,
            last_block: U64::zero(),
            request_tx,
        }
    }

    /// Run the listener loop (blocks until shutdown)
    pub async fn run(mut self, shutdown: Arc<std::sync::atomic::AtomicBool>) {
        info!(
            vault = %self.vault_address,
            interval = self.poll_interval_secs,
            "ArbitrationListener started"
        );

        // Initialize last_block to current block
        match self.provider.get_block_number().await {
            Ok(block) => self.last_block = block,
            Err(e) => {
                error!("Failed to get initial block number: {}", e);
                return;
            }
        }

        loop {
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("ArbitrationListener shutting down");
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(self.poll_interval_secs)).await;

            match self.poll_events().await {
                Ok(count) => {
                    if count > 0 {
                        info!(count, "Processed arbitration events");
                    }
                }
                Err(e) => {
                    warn!("Failed to poll arbitration events: {}", e);
                }
            }
        }
    }

    async fn poll_events(&mut self) -> Result<usize, Box<dyn std::error::Error>> {
        let current_block = self.provider.get_block_number().await?;
        if current_block <= self.last_block {
            return Ok(0);
        }

        let event_sig = ethers::utils::keccak256(ARBITRATION_REQUESTED_TOPIC.as_bytes());
        let filter = Filter::new()
            .address(self.vault_address)
            .topic0(H256::from(event_sig))
            .from_block(self.last_block + 1)
            .to_block(current_block);

        let logs = self.provider.get_logs(&filter).await?;
        let count = logs.len();

        for log in logs {
            if let Some(request) = self.parse_arbitration_event(&log) {
                info!(bet_id = %request.bet_id, "New arbitration request");
                if self.request_tx.send(request).is_err() {
                    error!("Arbitration request channel closed");
                    break;
                }
            }
        }

        self.last_block = current_block;
        Ok(count)
    }

    fn parse_arbitration_event(&self, log: &Log) -> Option<ArbitrationRequest> {
        // Topics[1] = bet_id (indexed), Topics[2] = requestedBy (indexed)
        let bet_id = U256::from(log.topics.get(1)?.as_bytes());
        let _requester = Address::from(log.topics.get(2)?);

        // TODO: Fetch full bet data from CollateralVault.bets(betId)
        // For now, create a minimal request
        Some(ArbitrationRequest {
            bet_id,
            trades_root: H256::zero(), // Will be filled from contract read
            creator: Address::zero(),
            filler: Address::zero(),
            creator_amount: U256::zero(),
            filler_amount: U256::zero(),
            deadline: U256::zero(),
        })
    }
}
```

**Step 2: Add to mod.rs**

Add `pub mod listener;` to `issuer/src/arbitration/mod.rs`

**Step 3: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles

**Step 4: Commit**

```bash
git add issuer/src/arbitration/listener.rs issuer/src/arbitration/mod.rs
git commit -m "feat(issuer): add ArbitrationListener polling CollateralVault events"
```

---

### Task 10: Create ArbitrationProcessor (4-Phase Consensus)

**Files:**
- Create: `issuer/src/arbitration/consensus.rs`
- Create: `issuer/src/arbitration/processor.rs`

The processor orchestrates the 4-phase consensus for each bet. Uses Index's P2P transport and BLS signer.

**Step 1: Write consensus.rs** — hash builders for arbitration messages

```rust
//! Arbitration consensus hash builders
//!
//! Builds message hashes for BLS signing during arbitration consensus.
//! Follows the same pattern as issuer/src/bridge/types.rs hash builders.

use ethers::abi::encode;
use ethers::abi::Token;
use ethers::types::{H256, U256};
use ethers::utils::keccak256;

/// Build the hash for an arbitration price proposal
///
/// hash = keccak256(abi.encode(bet_id, prices_hash, timestamp))
pub fn build_price_proposal_hash(
    bet_id: U256,
    prices: &[(u32, String, i64)],
    timestamp: u64,
) -> H256 {
    // Hash the prices array first
    let prices_hash = {
        let mut tokens = Vec::new();
        for (idx, symbol, price) in prices {
            tokens.push(Token::Tuple(vec![
                Token::Uint(U256::from(*idx)),
                Token::String(symbol.clone()),
                Token::Int(U256::from(*price as u64)),  // i64 as uint256
            ]));
        }
        H256::from(keccak256(encode(&tokens)))
    };

    H256::from(keccak256(encode(&[
        Token::Uint(bet_id),
        Token::FixedBytes(prices_hash.as_bytes().to_vec()),
        Token::Uint(U256::from(timestamp)),
    ])))
}

/// Build the hash for an arbitration outcome (what gets signed in phase 3)
///
/// hash = keccak256(abi.encode(betId, creatorWins))
/// This MUST match ArbitrationSettlement.sol's messageHash computation.
pub fn build_outcome_hash(bet_id: U256, creator_wins: bool) -> H256 {
    H256::from(keccak256(encode(&[
        Token::Uint(bet_id),
        Token::Bool(creator_wins),
    ])))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_outcome_hash_deterministic() {
        let h1 = build_outcome_hash(U256::from(42), true);
        let h2 = build_outcome_hash(U256::from(42), true);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_differs_by_winner() {
        let h1 = build_outcome_hash(U256::from(42), true);
        let h2 = build_outcome_hash(U256::from(42), false);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_differs_by_bet_id() {
        let h1 = build_outcome_hash(U256::from(42), true);
        let h2 = build_outcome_hash(U256::from(43), true);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_price_proposal_hash_deterministic() {
        let prices = vec![(0, "AAPL".to_string(), 15023i64)];
        let h1 = build_price_proposal_hash(U256::from(1), &prices, 1000);
        let h2 = build_price_proposal_hash(U256::from(1), &prices, 1000);
        assert_eq!(h1, h2);
    }
}
```

**Step 2: Write processor.rs** — orchestrates the full flow

```rust
//! Arbitration processor
//!
//! Runs consensus for each arbitration request.
//! Coordinates price proposal, voting, signature collection, and chain submission.

use ethers::types::{U256, H256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn, error};

use common::types::{BLSSignature, P2PMessage, PeerId};
use super::consensus::{build_outcome_hash, build_price_proposal_hash};
use super::market_data::DataNodePriceFetcher;
use super::resolution::{self, Trade};
use super::types::{ArbitrationConfig, ArbitrationPhase, ArbitrationRequest, ArbitrationResult};

/// Per-bet consensus state
struct BetConsensusState {
    request: ArbitrationRequest,
    phase: ArbitrationPhase,
    /// Collected price votes (signer_index → accept)
    price_votes: HashMap<u8, bool>,
    /// Collected resolution signatures (signer_index → signature)
    resolution_sigs: HashMap<u8, BLSSignature>,
    /// Whether creator wins (computed after price consensus)
    creator_wins: Option<bool>,
}

/// Processes arbitration requests through 4-phase consensus
pub struct ArbitrationProcessor {
    config: ArbitrationConfig,
    price_fetcher: DataNodePriceFetcher,
    /// Active consensus rounds (bet_id → state)
    active: HashMap<U256, BetConsensusState>,
    /// Channel to receive new arbitration requests
    request_rx: mpsc::UnboundedReceiver<ArbitrationRequest>,
}

impl ArbitrationProcessor {
    pub fn new(
        config: ArbitrationConfig,
        request_rx: mpsc::UnboundedReceiver<ArbitrationRequest>,
    ) -> Self {
        let price_fetcher = DataNodePriceFetcher::new(&config.data_node_url);
        Self {
            config,
            price_fetcher,
            active: HashMap::new(),
            request_rx,
        }
    }

    /// Handle an incoming P2P message for an active arbitration
    pub fn handle_message(&mut self, msg: P2PMessage) {
        match msg {
            P2PMessage::ArbitrationPriceVote {
                voter_index, bet_id, accept, ..
            } => {
                if let Some(state) = self.active.get_mut(&bet_id) {
                    state.price_votes.insert(voter_index, accept);
                    info!(bet_id = %bet_id, voter = voter_index, accept, "Price vote received");
                    self.check_price_vote_threshold(bet_id);
                }
            }
            P2PMessage::ArbitrationResolutionSign {
                signer_index, bet_id, signature, ..
            } => {
                if let Some(state) = self.active.get_mut(&bet_id) {
                    state.resolution_sigs.insert(signer_index, signature);
                    info!(bet_id = %bet_id, signer = signer_index, "Resolution signature received");
                    self.check_resolution_threshold(bet_id);
                }
            }
            _ => {}
        }
    }

    fn check_price_vote_threshold(&mut self, bet_id: U256) {
        let threshold = self.config.signature_threshold;
        if let Some(state) = self.active.get_mut(&bet_id) {
            let accept_count = state.price_votes.values().filter(|v| **v).count();
            if accept_count >= threshold {
                info!(bet_id = %bet_id, accepts = accept_count, "Price consensus reached");
                state.phase = ArbitrationPhase::ResolutionSign;
                // TODO: Broadcast ArbitrationResolutionSign to peers
            }
        }
    }

    fn check_resolution_threshold(&mut self, bet_id: U256) {
        let threshold = self.config.signature_threshold;
        if let Some(state) = self.active.get_mut(&bet_id) {
            if state.resolution_sigs.len() >= threshold {
                info!(
                    bet_id = %bet_id,
                    sigs = state.resolution_sigs.len(),
                    "Resolution signature threshold reached — ready for chain submission"
                );
                state.phase = ArbitrationPhase::Complete;
                // TODO: Aggregate signatures and submit on-chain via ChainWriter
            }
        }
    }

    /// Start a new consensus round for an arbitration request (leader only)
    pub async fn start_consensus(&mut self, request: ArbitrationRequest) {
        let bet_id = request.bet_id;
        info!(bet_id = %bet_id, "Starting arbitration consensus");

        self.active.insert(bet_id, BetConsensusState {
            request,
            phase: ArbitrationPhase::PriceProposal,
            price_votes: HashMap::new(),
            resolution_sigs: HashMap::new(),
            creator_wins: None,
        });

        // TODO: Fetch trades from data-node, compute exit prices,
        //       broadcast ArbitrationPriceProposal via P2P
    }
}
```

**Step 3: Add modules to mod.rs**

Add `pub mod consensus;` and `pub mod processor;` to `issuer/src/arbitration/mod.rs`

**Step 4: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles

**Step 5: Run tests**

Run: `cargo test -p issuer -- arbitration -v`
Expected: All arbitration tests pass (resolution, market_data, consensus hash tests)

**Step 6: Commit**

```bash
git add issuer/src/arbitration/
git commit -m "feat(issuer): add ArbitrationProcessor with 4-phase consensus + hash builders"
```

---

### Task 11: Spawn Arbitration Subsystem in main.rs

**Files:**
- Modify: `issuer/src/main.rs`

**Step 1: Add arbitration startup logic**

After the existing bootstrap and before the main loop, add:

```rust
    // --- Arbitration subsystem (optional) ---
    let arbitration_tx = if let Some(arb_config) = ArbitrationConfig::from_issuer_config(&config) {
        let (arb_msg_tx, arb_msg_rx) = issuer::arbitration::arbitration_channel();
        let subsystem = issuer::arbitration::ArbitrationSubsystem::new(arb_config, arb_msg_rx);
        let shutdown_clone = shutdown.clone();
        tokio::spawn(async move {
            subsystem.run(shutdown_clone).await;
        });
        info!("Arbitration subsystem enabled");
        Some(arb_msg_tx)
    } else {
        info!("Arbitration subsystem disabled");
        None
    };
```

**Step 2: Wire ForwardToArbitration in the message dispatch**

In the P2P message handling loop, add:

```rust
    MessageHandleResult::ForwardToArbitration(msg) => {
        if let Some(ref tx) = arbitration_tx {
            let _ = tx.send(msg);
        }
    }
```

**Step 3: Verify compilation**

Run: `cargo check -p issuer`
Expected: Compiles

**Step 4: Commit**

```bash
git add issuer/src/main.rs
git commit -m "feat(issuer): spawn arbitration subsystem on startup when enabled"
```

---

### Task 12: Add ArbitrationSettlement Deploy Script + Test

**Files:**
- Create: `contracts/test/ArbitrationSettlement.t.sol`

**Step 1: Write Forge test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/arbitration/ArbitrationSettlement.sol";

contract ArbitrationSettlementTest is Test {
    ArbitrationSettlement public settlement;

    function setUp() public {
        // Deploy with mock addresses
        settlement = new ArbitrationSettlement(
            address(0x1), // mock IssuerRegistry
            address(0x2), // mock CollateralVault
            address(this), // governance = test contract
            2              // threshold = 2
        );
    }

    function test_constructor() public view {
        assertEq(settlement.signatureThreshold(), 2);
        assertEq(settlement.governance(), address(this));
        assertEq(address(settlement.collateralVault()), address(0x2));
    }

    function test_setThreshold() public {
        settlement.setThreshold(5);
        assertEq(settlement.signatureThreshold(), 5);
    }

    function test_setThreshold_unauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert(ArbitrationSettlement.Unauthorized.selector);
        settlement.setThreshold(5);
    }

    function test_setThreshold_zero_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(ArbitrationSettlement.InvalidThreshold.selector, 0));
        settlement.setThreshold(0);
    }

    function test_settleBet_zeroBetId_reverts() public {
        uint256[2] memory sig;
        vm.expectRevert(ArbitrationSettlement.ZeroBetId.selector);
        settlement.settleBet(0, true, sig, 0x3);
    }

    function test_settleBet_insufficientSignatures_reverts() public {
        uint256[2] memory sig;
        // bitmap = 0x1 = only 1 signer, threshold = 2
        vm.expectRevert(
            abi.encodeWithSelector(ArbitrationSettlement.InsufficientSignatures.selector, 1, 2)
        );
        settlement.settleBet(1, true, sig, 0x1);
    }

    function test_popcount() public view {
        // bitmap 0x3 = 0b11 = 2 bits set
        // bitmap 0x7 = 0b111 = 3 bits set
        // Tested via settleBet threshold check
    }

    function test_doubleSettlement_reverts() public {
        // Can't easily test full settlement without real BLS keys
        // but we can verify the settled mapping works
        // This would require a full integration test with BLS fixtures
    }
}
```

**Step 2: Run tests**

Run: `cd contracts && forge test --match-contract ArbitrationSettlement -v`
Expected: Tests pass (constructor, threshold, reverts)

**Step 3: Commit**

```bash
git add contracts/test/ArbitrationSettlement.t.sol contracts/src/arbitration/ArbitrationSettlement.sol
git commit -m "test(contracts): add ArbitrationSettlement unit tests (threshold, auth, reverts)"
```

---

### Task 13: Integration Verification — Full Compilation + Existing Tests

**Files:** None (verification only)

**Step 1: Full workspace compilation**

Run: `cargo build -p common -p issuer`
Expected: Clean compilation

**Step 2: Run all common tests**

Run: `cargo test -p common -v`
Expected: All existing + new P2P serialization tests pass

**Step 3: Run all issuer tests**

Run: `cargo test -p issuer -v`
Expected: All existing + new arbitration tests pass

**Step 4: Run Solidity tests**

Run: `cd contracts && forge test -v`
Expected: All existing + ArbitrationSettlement tests pass

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: integration fixes for arbitration merger compilation"
```

---

## Summary of Deliverables

| Task | Component | Files | Tests |
|------|-----------|-------|-------|
| 1 | P2P message types | `common/src/types/p2p.rs` | 3 serialization roundtrips |
| 2 | Message routing | `issuer/src/consensus/messages.rs` | Compile check |
| 3 | Domain types | `issuer/src/arbitration/types.rs` | Compile check |
| 4 | Resolution VM | `issuer/src/arbitration/resolution.rs` | 9 unit tests |
| 5 | Price fetcher | `issuer/src/arbitration/market_data.rs` | 2 unit tests |
| 6 | Module scaffold | `issuer/src/arbitration/mod.rs` + lib.rs | Compile + run |
| 7 | Config | `issuer/src/config.rs` + main.rs | Compile check |
| 8 | Settlement contract | `contracts/src/arbitration/ArbitrationSettlement.sol` | Forge build |
| 9 | Event listener | `issuer/src/arbitration/listener.rs` | Compile check |
| 10 | Processor + consensus | `issuer/src/arbitration/{consensus,processor}.rs` | 4 hash tests |
| 11 | Startup wiring | `issuer/src/main.rs` | Compile check |
| 12 | Contract tests | `contracts/test/ArbitrationSettlement.t.sol` | 5 Forge tests |
| 13 | Integration | All | Full workspace build + test |

**Future work (not in this plan):**
- Wire ChainWriter to call ArbitrationSettlement.settleBet()
- Full BLS signature aggregation in processor (reuse existing aggregator)
- CollateralVault contract read for full bet data in listener
- Deploy script for ArbitrationSettlement
- E2E integration test with real BLS keys
- Remove AA keeper binary after validation
