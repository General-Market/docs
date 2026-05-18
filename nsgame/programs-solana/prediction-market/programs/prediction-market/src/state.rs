//! On-chain state for the prediction market program.
//!
//! # PDA seed conventions
//!
//! All integer seeds use Rust `to_le_bytes()` — little-endian, two's-complement
//! for signed types. `threshold_bps: i32 = 50`  becomes `[0x32, 0x00, 0x00, 0x00]`.
//! `threshold_bps: i32 = -50` becomes `[0xCE, 0xFF, 0xFF, 0xFF]`.
//! TS consumers MUST use `Buffer.writeInt32LE` / `writeBigInt64LE`.
//!
//! Market seeds pin the exact tuple that identifies a market:
//! `[b"market", source_id_le(4), close_time_le_i64(8), settlement_time_le_i64(8), threshold_bps_le_i32(4)]`.
//! Identical tuples from different users collide to the same PDA — duplicates
//! are impossible by construction (MR1).
//!
//! # Price decimals
//!
//! All on-chain prices are `u128 = native_price * 10^18` (SA9). The oracle daemon
//! normalizes before signing. Contract math assumes this invariant without
//! verification. A feed with native 8-decimal prices scales up; a feed with
//! 18-decimal prices ships as-is.

use anchor_lang::prelude::*;

// -----------------------------------------------------------------------------
// GlobalConfig
// -----------------------------------------------------------------------------

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub pending_admin: Pubkey, // Pubkey::default() when no pending handoff
    pub fee_bps: u16,
    pub stake_mint: Pubkey,
    pub fee_vault: Pubkey, // [b"fee_vault"] PDA, authority = same PDA
    pub fee_vault_bump: u8,
    pub paused: bool,
    pub bump: u8,
}

impl GlobalConfig {
    // discriminator(8) + admin(32) + pending_admin(32) + fee_bps(2)
    // + stake_mint(32) + fee_vault(32) + fee_vault_bump(1) + paused(1) + bump(1)
    pub const LEN: usize = 8 + 32 + 32 + 2 + 32 + 32 + 1 + 1 + 1;
}

// -----------------------------------------------------------------------------
// OracleConfig — multisig with 24h rotation delay (MR7-SR2: two-state)
// -----------------------------------------------------------------------------

#[account]
pub struct OracleConfig {
    pub active_signers: Vec<Pubkey>,
    pub active_threshold: u8,
    pub pending_signers: Vec<Pubkey>,
    pub pending_threshold: u8,
    pub pending_activation_ts: i64,
    pub bump: u8,
}

impl OracleConfig {
    pub const MAX_SIGNERS: usize = 16;
    // discriminator(8) + Vec<Pubkey>(4 + 32 * 16) + u8(1)
    // + Vec<Pubkey>(4 + 32 * 16) + u8(1) + i64(8) + u8(1)
    pub const LEN: usize = 8
        + 4 + 32 * Self::MAX_SIGNERS
        + 1
        + 4 + 32 * Self::MAX_SIGNERS
        + 1
        + 8
        + 1;
}

// -----------------------------------------------------------------------------
// Source — admin whitelist of data feeds (MR1)
// -----------------------------------------------------------------------------

#[account]
pub struct Source {
    pub source_id: u32,
    pub name: [u8; 32],
    pub enabled: bool,
    pub bump: u8,
}

impl Source {
    // discriminator(8) + source_id(4) + name(32) + enabled(1) + bump(1)
    pub const LEN: usize = 8 + 4 + 32 + 1 + 1;
}

// -----------------------------------------------------------------------------
// Market — instantiated lazily on first bet (MR2, SA1, SA2)
// -----------------------------------------------------------------------------

#[account]
pub struct Market {
    pub source_id: u32,
    pub close_time: i64,
    pub settlement_time: i64,
    pub threshold_bps: i32,
    pub total_yes: u64,
    pub total_no: u64,
    pub resolved: bool,
    pub outcome_yes: bool,
    // force_resolved dropped from state (SA2) — indexers read the `MarketResolved` event.
    pub baseline_price: u128, // 0 until close_market runs
    pub final_price: u128,    // 0 until resolve fires
    pub vault: Pubkey,
    pub bump: u8,
}

impl Market {
    // discriminator(8) + source_id(4) + close_time(8) + settlement_time(8)
    // + threshold_bps(4) + total_yes(8) + total_no(8)
    // + resolved(1) + outcome_yes(1)
    // + baseline_price(16) + final_price(16) + vault(32) + bump(1)
    pub const LEN: usize = 8 + 4 + 8 + 8 + 4 + 8 + 8 + 1 + 1 + 16 + 16 + 32 + 1;
}

// -----------------------------------------------------------------------------
// Position — one per (Market, owner)
// -----------------------------------------------------------------------------

#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub bump: u8,
    // No `claimed` flag — `claim` closes the account; double-claim is guarded by
    // account-closed (SA21).
}

impl Position {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

// -----------------------------------------------------------------------------
// Side — sum type for bet direction, shared across place_bet / exit_bet / batch
// -----------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Side {
    Yes,
    No,
}

// -----------------------------------------------------------------------------
// Events (SA8 — each emission ships with its originating handler)
// -----------------------------------------------------------------------------

#[event]
pub struct MarketInstantiated {
    pub market: Pubkey,
    pub source_id: u32,
    pub close_time: i64,
    pub settlement_time: i64,
    pub threshold_bps: i32,
    pub creator: Pubkey,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: u8, // 0 = YES, 1 = NO
    pub amount: u64,
}

#[event]
pub struct BetExited {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: u8,
    pub amount: u64,
}

#[event]
pub struct MarketClosed {
    pub market: Pubkey,
    pub baseline_price: u128,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub baseline_price: u128,
    pub final_price: u128,
    pub outcome_yes: bool,
    pub force_resolved: bool,
}

#[event]
pub struct Claimed {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub net: u64,
    pub fee: u64,
    pub stranded: bool,
}

// -----------------------------------------------------------------------------
// Admin-surface events (MR10 — every config mutation surfaces an event so
// indexers can reconstruct governance history without polling the PDA)
// -----------------------------------------------------------------------------

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub stake_mint: Pubkey,
    pub fee_vault: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct Paused {
    pub paused: bool,
}

#[event]
pub struct FeeBpsChanged {
    pub fee_bps: u16,
}

#[event]
pub struct SourceUpserted {
    pub source_id: u32,
    pub name: [u8; 32],
    pub enabled: bool,
}

#[event]
pub struct AdminProposed {
    pub new_admin: Pubkey,
}

#[event]
pub struct AdminAccepted {
    pub new_admin: Pubkey,
}

#[event]
pub struct FeesWithdrawn {
    pub destination: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OracleSignersProposed {
    pub signers: Vec<Pubkey>,
    pub threshold: u8,
    pub activation_ts: i64,
}
