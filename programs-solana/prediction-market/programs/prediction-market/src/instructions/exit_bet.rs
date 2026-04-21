//! exit_bet — exit a bet during the trading window (before close_time).
//! The market PDA signs the refund transfer out of the vault.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::ErrorCode;
use crate::state::{BetExited, Market, Position, Side};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExitBetArgs {
    pub side: Side,
    pub amount: u64,
}

#[derive(Accounts)]
pub struct ExitBet<'info> {
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

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ExitBet>, args: ExitBetArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now < ctx.accounts.market.close_time, ErrorCode::WindowClosed);

    let market_key = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    match args.side {
        Side::Yes => {
            require!(
                position.yes_amount >= args.amount,
                ErrorCode::InsufficientBalance
            );
            position.yes_amount -= args.amount;
            market.total_yes -= args.amount;
        }
        Side::No => {
            require!(
                position.no_amount >= args.amount,
                ErrorCode::InsufficientBalance
            );
            position.no_amount -= args.amount;
            market.total_no -= args.amount;
        }
    }

    let source_id_bytes = market.source_id.to_le_bytes();
    let close_bytes = market.close_time.to_le_bytes();
    let settle_bytes = market.settlement_time.to_le_bytes();
    let thresh_bytes = market.threshold_bps.to_le_bytes();
    let bump = [market.bump];
    let seeds: &[&[u8]] = &[
        b"market",
        &source_id_bytes,
        &close_bytes,
        &settle_bytes,
        &thresh_bytes,
        &bump,
    ];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: market.to_account_info(),
            },
            signer_seeds,
        ),
        args.amount,
    )?;

    emit!(BetExited {
        market: market_key,
        owner: ctx.accounts.user.key(),
        side: match args.side {
            Side::Yes => 0,
            Side::No => 1,
        },
        amount: args.amount,
    });
    Ok(())
}
