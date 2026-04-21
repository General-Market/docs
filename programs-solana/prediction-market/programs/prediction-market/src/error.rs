use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("fee_bps exceeds 10_000")]
    FeeTooHigh,
    #[msg("unauthorized")]
    Unauthorized,
    #[msg("paused")]
    Paused,
    #[msg("window open")]
    WindowOpen,
    #[msg("window closed")]
    WindowClosed,
    #[msg("before resolve_ts")]
    NotResolvable,
    #[msg("already resolved")]
    AlreadyResolved,
    #[msg("unresolved")]
    Unresolved,
    #[msg("signature threshold not met")]
    ThresholdNotMet,
    #[msg("bad signature")]
    BadSignature,
    #[msg("pending not ready")]
    PendingNotReady,
    #[msg("no pending change")]
    NoPending,
    #[msg("pending already queued")]
    PendingAlreadyQueued,
    #[msg("not a winner")]
    NotWinner,
    #[msg("insufficient balance")]
    InsufficientBalance,
    #[msg("batch too large")]
    BatchTooLarge,
    #[msg("source disabled")]
    SourceDisabled,
    #[msg("bad threshold")]
    BadThreshold,
    #[msg("bad time")]
    BadTime,
    #[msg("too early to force-resolve")]
    ForceResolveTooEarly,
    #[msg("stranded pool only")]
    StrandedOnly,
    #[msg("baseline missing")]
    BaselineMissing,
    #[msg("already closed")]
    AlreadyClosed,
    #[msg("not closable yet")]
    NotClosable,
    #[msg("math overflow")]
    MathOverflow,
    #[msg("account layout mismatch")]
    BadAccount,
}
