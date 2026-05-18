//! 5-minute parimutuel prediction market program.
//!
//! Users wager on whether an external data source will be up or down by some
//! bps threshold between a `close_time` and a `settlement_time`. Admin
//! whitelists sources only (MR1). Bet tuples identify markets; identical tuples
//! collide to the same PDA (MR2). Claim is permissionless (MR5). Oracle
//! baseline lands on-chain at close; final at settlement (MR4).

use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod math;
pub mod oracle;
pub mod state;

use instructions::*;

declare_id!("DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA");

#[program]
pub mod prediction_market {
    use super::*;

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
        initialize::handler(ctx, fee_bps)
    }

    // -------------------------------------------------------------------------
    // Admin surface (SA10)
    // -------------------------------------------------------------------------

    pub fn upsert_source(
        ctx: Context<UpsertSource>,
        source_id: u32,
        name: [u8; 32],
        enabled: bool,
    ) -> Result<()> {
        admin::upsert_source(ctx, source_id, name, enabled)
    }

    pub fn propose_oracle_signers(
        ctx: Context<ProposeOracleSigners>,
        signers: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        admin::propose_oracle_signers(ctx, signers, threshold)
    }

    pub fn activate_oracle_signers(ctx: Context<ActivateOracleSigners>) -> Result<()> {
        admin::activate_oracle_signers(ctx)
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        admin::set_pause(ctx, paused)
    }

    pub fn set_fee_bps(ctx: Context<SetFeeBps>, fee_bps: u16) -> Result<()> {
        admin::set_fee_bps(ctx, fee_bps)
    }

    pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
        admin::propose_admin(ctx, new_admin)
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        admin::accept_admin(ctx)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        admin::withdraw_fees(ctx, amount)
    }

    pub fn admin_force_resolve(
        ctx: Context<AdminForceResolve>,
        baseline_price: u128,
        final_price: u128,
    ) -> Result<()> {
        admin::admin_force_resolve(ctx, baseline_price, final_price)
    }

    // -------------------------------------------------------------------------
    // User-facing bet surface
    // -------------------------------------------------------------------------

    pub fn place_bet(ctx: Context<PlaceBet>, args: PlaceBetArgs) -> Result<()> {
        place_bet::handler(ctx, args)
    }

    pub fn exit_bet(ctx: Context<ExitBet>, args: ExitBetArgs) -> Result<()> {
        exit_bet::handler(ctx, args)
    }

    pub fn batch_bets<'info>(
        ctx: Context<'info, BatchBets<'info>>,
        args: BatchBetsArgs,
    ) -> Result<()> {
        batch_bets::handler(ctx, args)
    }

    // -------------------------------------------------------------------------
    // Oracle-signed resolution (MR4) + permissionless claim (MR5)
    // -------------------------------------------------------------------------

    pub fn close_market(ctx: Context<CloseMarket>, args: CloseMarketArgs) -> Result<()> {
        close_market::handler(ctx, args)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, args: ResolveMarketArgs) -> Result<()> {
        resolve_market::handler(ctx, args)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        claim::handler(ctx)
    }
}
