//! claim — permissionless (MR5). Cranker signs; payout and rent flow to
//! position.owner. Three paths unified (SA21): winner payout, stranded
//! refund, loser close. Always closes Position on success. Double-claim
//! guarded by account-closed.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::ErrorCode;
use crate::math::payout;
use crate::state::{Claimed, GlobalConfig, Market, Position};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

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
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        close = owner,
        seeds = [b"position", market.key().as_ref(), position.owner.as_ref()],
        bump = position.bump,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, seeds = [b"fee_vault"], bump = config.fee_vault_bump)]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: address pinned to position.owner, receives payout + rent.
    #[account(mut, address = position.owner)]
    pub owner: UncheckedAccount<'info>,

    /// Auto-init owner ATA (MR5). Cranker pays the rent lamports.
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = stake_mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Box<Account<'info, TokenAccount>>,

    #[account(address = config.stake_mint)]
    pub stake_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub cranker: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let m = &ctx.accounts.market;
    require!(m.resolved, ErrorCode::Unresolved);

    let position = &ctx.accounts.position;
    let total_pool = (m.total_yes as u128) + (m.total_no as u128);
    let winning_total = if m.outcome_yes {
        m.total_yes as u128
    } else {
        m.total_no as u128
    };
    let stake = if m.outcome_yes {
        position.yes_amount as u128
    } else {
        position.no_amount as u128
    };

    // Build the signer seeds for the Market PDA (used to authorize vault
    // withdrawals in winner / stranded paths).
    let source_id_bytes = m.source_id.to_le_bytes();
    let close_bytes = m.close_time.to_le_bytes();
    let settle_bytes = m.settlement_time.to_le_bytes();
    let thresh_bytes = m.threshold_bps.to_le_bytes();
    let bump = [m.bump];
    let seeds: &[&[u8]] = &[
        b"market",
        &source_id_bytes,
        &close_bytes,
        &settle_bytes,
        &thresh_bytes,
        &bump,
    ];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let market_key = m.key();
    let owner_key = position.owner;

    let (net, fee, stranded) = if winning_total == 0 {
        // Stranded pool — every bettor picked the losing side. Refund full
        // combined stake (SA3).
        let refund = (position.yes_amount as u128) + (position.no_amount as u128);
        (refund as u64, 0u64, true)
    } else if stake > 0 {
        // Winner path. Fee skipped when the pool is entirely on the winning
        // side (SA5b) — taxing a pool without losers is theft.
        let effective_fee_bps = if m.total_yes == 0 || m.total_no == 0 {
            0
        } else {
            ctx.accounts.config.fee_bps
        };
        let (net, fee) = payout(total_pool, stake, winning_total, effective_fee_bps);
        (net, fee, false)
    } else {
        // Loser path (SA21). Nothing to transfer; Position still closes —
        // rent returns to owner via `close = owner`.
        (0u64, 0u64, false)
    };

    if net > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner_ata.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            net,
        )?;
    }
    if fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
        )?;
    }

    emit!(Claimed {
        market: market_key,
        owner: owner_key,
        net,
        fee,
        stranded,
    });
    Ok(())
}
