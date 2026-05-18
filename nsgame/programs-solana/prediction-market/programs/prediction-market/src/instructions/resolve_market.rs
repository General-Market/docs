//! resolve_market — oracle-signed, fires at settlement_time. Reads stored
//! baseline, writes final + outcome + resolved (MR4).

use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::math::outcome_yes;
use crate::oracle::{build_resolve_payload, verify_multisig};
use crate::state::{Market, MarketResolved, OracleConfig};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ResolveMarketArgs {
    pub final_price: u128,
    pub signatures: Vec<[u8; 64]>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        seeds = [
            b"market".as_ref(),
            &market.source_id.to_le_bytes()[..],
            &market.close_time.to_le_bytes()[..],
            &market.settlement_time.to_le_bytes()[..],
            &market.threshold_bps.to_le_bytes()[..],
        ],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(seeds = [b"oracle_config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,

    /// CHECK: sysvar; enforced by `address` constraint.
    #[account(address = solana_sdk_ids::sysvar::instructions::ID)]
    pub ix_sysvar: UncheckedAccount<'info>,

    pub cranker: Signer<'info>,
}

pub fn handler(ctx: Context<ResolveMarket>, args: ResolveMarketArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    require!(now >= market.settlement_time, ErrorCode::NotResolvable);
    require!(market.baseline_price > 0, ErrorCode::BaselineMissing);
    require!(!market.resolved, ErrorCode::AlreadyResolved);
    require!(args.final_price > 0, ErrorCode::BaselineMissing);

    let payload = build_resolve_payload(market.source_id, market.settlement_time, args.final_price);
    verify_multisig(
        &ctx.accounts.oracle_config,
        &payload,
        &args.signatures,
        &ctx.accounts.ix_sysvar.to_account_info(),
    )?;

    market.final_price = args.final_price;
    market.outcome_yes = outcome_yes(market.baseline_price, args.final_price, market.threshold_bps);
    market.resolved = true;

    emit!(MarketResolved {
        market: market.key(),
        baseline_price: market.baseline_price,
        final_price: args.final_price,
        outcome_yes: market.outcome_yes,
        force_resolved: false,
    });
    Ok(())
}
