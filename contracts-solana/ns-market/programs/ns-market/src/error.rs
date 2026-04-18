use anchor_lang::prelude::*;

#[error_code]
pub enum NsMarketError {
    #[msg("Outcome must be 0 (YES) or 1 (NO)")]
    InvalidOutcome,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Market id exceeds 32 bytes")]
    MarketIdTooLong,
    #[msg("Market id must not be empty")]
    MarketIdEmpty,
    #[msg("Question exceeds 200 bytes")]
    QuestionTooLong,
    #[msg("Market is already resolved")]
    MarketResolved,
    #[msg("Market is not yet resolved")]
    MarketNotResolved,
    #[msg("Bet has already been redeemed")]
    AlreadyRedeemed,
    #[msg("Bet is on the losing outcome")]
    LosingBet,
    #[msg("No bets on the winning outcome")]
    NoWinners,
    #[msg("Caller is not the market authority")]
    Unauthorized,
    #[msg("Market is closed to new bets")]
    MarketClosed,
    #[msg("Fee must be <= 10_000 bps (100%)")]
    FeeTooHigh,
}
