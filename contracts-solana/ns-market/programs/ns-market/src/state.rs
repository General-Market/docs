use anchor_lang::prelude::*;

// Market PDA — one per (market_id).
// Seeded by [b"market", market_id.as_bytes()].
#[account]
pub struct Market {
    pub authority: Pubkey,       // 32  (can resolve)
    pub market_id: String,       // 4 + 32
    pub question: String,        // 4 + 200
    pub resolved: bool,          // 1
    pub winning_outcome: u8,     // 1   (0 = YES, 1 = NO, 255 = unresolved)
    pub total_pool: u64,         // 8   (lamports staked total)
    pub yes_pool: u64,           // 8
    pub no_pool: u64,            // 8
    pub created_at: i64,         // 8
    pub resolved_at: i64,        // 8   (0 if unresolved)
    pub bump: u8,                // 1
}

impl Market {
    pub const LEN: usize = 32 + 4 + 32 + 4 + 200 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1;
}

// Bet PDA — one per (bettor, nonce).
// Seeded by [b"bet", bettor.as_ref(), &nonce.to_le_bytes()].
#[account]
pub struct Bet {
    pub bettor: Pubkey,       // 32
    pub market: Pubkey,       // 32  (references Market PDA)
    pub outcome: u8,          // 1   (0 = YES, 1 = NO)
    pub amount: u64,          // 8
    pub timestamp: i64,       // 8
    pub redeemed: bool,       // 1
    pub bump: u8,             // 1
}

impl Bet {
    pub const LEN: usize = 32 + 32 + 1 + 8 + 8 + 1 + 1;
}
