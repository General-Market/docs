use anchor_lang::prelude::*;

#[account]
pub struct Bet {
    pub bettor: Pubkey,       // 32
    pub market_id: String,    // 4 (len prefix) + 32 (max bytes)
    pub outcome: u8,          // 1  (0 = YES, 1 = NO)
    pub amount: u64,          // 8  (lamports staked)
    pub timestamp: i64,       // 8
    pub redeemed: bool,       // 1
    pub bump: u8,             // 1
}

impl Bet {
    // Total borsh-serialized size (without the 8-byte Anchor discriminator).
    // 32 + 4 + 32 + 1 + 8 + 8 + 1 + 1 = 87
    pub const LEN: usize = 32 + 4 + 32 + 1 + 8 + 8 + 1 + 1;
}
