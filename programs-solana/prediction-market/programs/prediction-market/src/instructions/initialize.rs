use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::ErrorCode;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = GlobalConfig::LEN,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, GlobalConfig>,

    /// Self-owned PDA token account. Address and authority share the same seed
    /// so admin cannot re-target fees to an external wallet (SA4).
    #[account(
        init,
        payer = admin,
        token::mint = stake_mint,
        token::authority = fee_vault,
        seeds = [b"fee_vault"],
        bump,
    )]
    pub fee_vault: Account<'info, TokenAccount>,

    pub stake_mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= 10_000, ErrorCode::FeeTooHigh);
    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.pending_admin = Pubkey::default();
    cfg.fee_bps = fee_bps;
    cfg.stake_mint = ctx.accounts.stake_mint.key();
    cfg.fee_vault = ctx.accounts.fee_vault.key();
    cfg.fee_vault_bump = ctx.bumps.fee_vault;
    cfg.paused = false;
    cfg.bump = ctx.bumps.config;
    Ok(())
}
