//! close_market — oracle-signed, writes Market.baseline_price at close_time (MR4).

use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::oracle::{build_close_payload, verify_multisig};
use crate::state::{Market, MarketClosed, OracleConfig};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CloseMarketArgs {
    pub baseline_price: u128,
    pub signatures: Vec<[u8; 64]>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
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

pub fn handler(ctx: Context<CloseMarket>, args: CloseMarketArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    require!(now >= market.close_time, ErrorCode::NotClosable);
    require!(market.baseline_price == 0, ErrorCode::AlreadyClosed);
    require!(args.baseline_price > 0, ErrorCode::BaselineMissing);

    let payload = build_close_payload(market.source_id, market.close_time, args.baseline_price);
    verify_multisig(
        &ctx.accounts.oracle_config,
        &payload,
        &args.signatures,
        &ctx.accounts.ix_sysvar.to_account_info(),
    )?;

    market.baseline_price = args.baseline_price;
    emit!(MarketClosed {
        market: market.key(),
        baseline_price: args.baseline_price,
    });
    Ok(())
}
