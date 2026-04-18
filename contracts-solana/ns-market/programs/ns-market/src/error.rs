use anchor_lang::prelude::*;

#[error_code]
pub enum NsMarketError {
    #[msg("Outcome must be 0 (YES) or 1 (NO)")]
    InvalidOutcome,
    #[msg("Bet amount must be greater than zero")]
    InvalidAmount,
    #[msg("Market id exceeds 32 bytes")]
    MarketIdTooLong,
    #[msg("Market id must not be empty")]
    MarketIdEmpty,
}
