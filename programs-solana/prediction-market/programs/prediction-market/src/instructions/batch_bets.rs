//! batch_bets — one transaction, many bets. ALT-friendly for market makers.
//!
//! Layout: stride-4 walk over `remaining_accounts`: entry `i` owns
//! `[market, position, vault, user_ata]` at `[4i..4i+4]` (SA18 — no
//! `market_index` field). Per-entry manual PDA-derivation checks (SR1 —
//! macro-generated `Accounts` for MAX_BATCH=24 would explode IDL size).
//!
//! NOTE: batch_bets assumes Market + Position + Vault already exist. MMs must
//! seed each via `place_bet` first, or the daemon/keeper must prime them. The
//! SA23 "auto-init per entry" variant requires hand-rolled CPIs to the system
//! program and is deferred.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};

use crate::error::ErrorCode;
use crate::state::{BetPlaced, GlobalConfig, Market, Position, Side};

pub const MAX_BATCH: usize = 24;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BatchEntry {
    pub side: Side,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BatchBetsArgs {
    pub entries: Vec<BatchEntry>,
}

#[derive(Accounts)]
pub struct BatchBets<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'info>(
    ctx: Context<'info, BatchBets<'info>>,
    args: BatchBetsArgs,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, ErrorCode::Paused);
    require!(args.entries.len() <= MAX_BATCH, ErrorCode::BatchTooLarge);
    require!(!args.entries.is_empty(), ErrorCode::BatchTooLarge);

    let now = Clock::get()?.unix_timestamp;
    let ra = ctx.remaining_accounts;
    require!(ra.len() >= args.entries.len() * 4, ErrorCode::BatchTooLarge);

    for (i, entry) in args.entries.iter().enumerate() {
        let base = i * 4;
        let market_info = &ra[base];
        let position_info = &ra[base + 1];
        let vault_info = &ra[base + 2];
        let user_ata_info = &ra[base + 3];

        // Deserialize + mutate via Account wrappers.
        let mut market: Account<Market> = Account::try_from(market_info)?;
        let mut position: Account<Position> = Account::try_from(position_info)?;

        require!(now < market.close_time, ErrorCode::WindowClosed);
        require!(!market.resolved, ErrorCode::AlreadyResolved);
        require!(
            position.owner == ctx.accounts.user.key(),
            ErrorCode::Unauthorized
        );
        require!(position.market == market.key(), ErrorCode::BadAccount);
        require!(market.vault == vault_info.key(), ErrorCode::BadAccount);

        // Manual PDA-derivation checks (SR1). Anchor's macro doesn't run for
        // stride-4 remaining_accounts, so a forged account must die here.
        let expected_market = Pubkey::create_program_address(
            &[
                b"market",
                &market.source_id.to_le_bytes(),
                &market.close_time.to_le_bytes(),
                &market.settlement_time.to_le_bytes(),
                &market.threshold_bps.to_le_bytes(),
                &[market.bump],
            ],
            &crate::ID,
        )
        .map_err(|_| error!(ErrorCode::BadAccount))?;
        require_keys_eq!(market_info.key(), expected_market, ErrorCode::BadAccount);

        let expected_position = Pubkey::create_program_address(
            &[
                b"position",
                market.key().as_ref(),
                position.owner.as_ref(),
                &[position.bump],
            ],
            &crate::ID,
        )
        .map_err(|_| error!(ErrorCode::BadAccount))?;
        require_keys_eq!(
            position_info.key(),
            expected_position,
            ErrorCode::BadAccount
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: user_ata_info.to_account_info(),
                    to: vault_info.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            entry.amount,
        )?;

        match entry.side {
            Side::Yes => {
                market.total_yes = market
                    .total_yes
                    .checked_add(entry.amount)
                    .ok_or(ErrorCode::MathOverflow)?;
                position.yes_amount = position
                    .yes_amount
                    .checked_add(entry.amount)
                    .ok_or(ErrorCode::MathOverflow)?;
            }
            Side::No => {
                market.total_no = market
                    .total_no
                    .checked_add(entry.amount)
                    .ok_or(ErrorCode::MathOverflow)?;
                position.no_amount = position
                    .no_amount
                    .checked_add(entry.amount)
                    .ok_or(ErrorCode::MathOverflow)?;
            }
        }

        emit!(BetPlaced {
            market: market.key(),
            owner: ctx.accounts.user.key(),
            side: match entry.side {
                Side::Yes => 0,
                Side::No => 1,
            },
            amount: entry.amount,
        });

        market.exit(&crate::ID)?;
        position.exit(&crate::ID)?;
    }
    Ok(())
}
