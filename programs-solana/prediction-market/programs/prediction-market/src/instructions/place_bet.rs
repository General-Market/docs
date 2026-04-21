//! place_bet — first bet with a tuple instantiates the Market; subsequent
//! bets with the same tuple join it (MR2). Contract enforces MR3 bounds.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::ErrorCode;
use crate::state::{
    BetPlaced, GlobalConfig, Market, MarketInstantiated, Position, Side, Source,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlaceBetArgs {
    pub source_id: u32,
    pub close_time: i64,
    pub settlement_time: i64,
    pub threshold_bps: i32,
    pub side: Side,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: PlaceBetArgs)]
pub struct PlaceBet<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

    #[account(
        seeds = [b"source".as_ref(), &args.source_id.to_le_bytes()[..]],
        bump = source.bump,
        constraint = source.enabled @ ErrorCode::SourceDisabled,
    )]
    pub source: Box<Account<'info, Source>>,

    #[account(
        init_if_needed,
        payer = user,
        space = Market::LEN,
        seeds = [
            b"market".as_ref(),
            &args.source_id.to_le_bytes()[..],
            &args.close_time.to_le_bytes()[..],
            &args.settlement_time.to_le_bytes()[..],
            &args.threshold_bps.to_le_bytes()[..],
        ],
        bump,
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        init_if_needed,
        payer = user,
        space = Position::LEN,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(
        init_if_needed,
        payer = user,
        token::mint = stake_mint,
        token::authority = market,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(address = config.stake_mint)]
    pub stake_mint: Box<Account<'info, Mint>>,

    /// Auto-init user ATA if missing (SA7).
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = stake_mint,
        associated_token::authority = user,
    )]
    pub user_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<PlaceBet>, args: PlaceBetArgs) -> Result<()> {
    require!(!ctx.accounts.config.paused, ErrorCode::Paused);

    // MR3 validation.
    require!(
        args.threshold_bps != 0 && args.threshold_bps.abs() <= 10_000,
        ErrorCode::BadThreshold
    );
    let now = Clock::get()?.unix_timestamp;
    require!(args.close_time > now, ErrorCode::BadTime);
    require!(args.close_time - now >= 10, ErrorCode::BadTime);
    require!(
        args.settlement_time - args.close_time >= 10,
        ErrorCode::BadTime
    );
    require!(
        args.settlement_time - now <= 30 * 86_400,
        ErrorCode::BadTime
    );
    require!(args.amount > 0, ErrorCode::InsufficientBalance);

    let market = &mut ctx.accounts.market;
    let is_first = market.vault == Pubkey::default();

    if is_first {
        market.source_id = args.source_id;
        market.close_time = args.close_time;
        market.settlement_time = args.settlement_time;
        market.threshold_bps = args.threshold_bps;
        market.vault = ctx.accounts.vault.key();
        market.bump = ctx.bumps.market;
        emit!(MarketInstantiated {
            market: market.key(),
            source_id: args.source_id,
            close_time: args.close_time,
            settlement_time: args.settlement_time,
            threshold_bps: args.threshold_bps,
            creator: ctx.accounts.user.key(),
        });
    } else {
        // Trading window closed once close_time is reached.
        require!(now < market.close_time, ErrorCode::WindowClosed);
    }

    let position = &mut ctx.accounts.position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.owner = ctx.accounts.user.key();
        position.bump = ctx.bumps.position;
    }

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        args.amount,
    )?;

    match args.side {
        Side::Yes => {
            market.total_yes = market
                .total_yes
                .checked_add(args.amount)
                .ok_or(ErrorCode::MathOverflow)?;
            position.yes_amount = position
                .yes_amount
                .checked_add(args.amount)
                .ok_or(ErrorCode::MathOverflow)?;
        }
        Side::No => {
            market.total_no = market
                .total_no
                .checked_add(args.amount)
                .ok_or(ErrorCode::MathOverflow)?;
            position.no_amount = position
                .no_amount
                .checked_add(args.amount)
                .ok_or(ErrorCode::MathOverflow)?;
        }
    }

    emit!(BetPlaced {
        market: market.key(),
        owner: ctx.accounts.user.key(),
        side: match args.side {
            Side::Yes => 0,
            Side::No => 1,
        },
        amount: args.amount,
    });
    Ok(())
}
