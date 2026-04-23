//! batch_bets — one transaction, many bets. ALT-friendly for market makers.
//!
//! Layout: stride-5 walk over `remaining_accounts`: entry `i` owns
//! `[market, position, vault, user_ata, source]` at `[5i..5i+5]` (SA18 — no
//! `market_index` field). Per-entry manual PDA-derivation checks (SR1 —
//! macro-generated `Accounts` for MAX_BATCH=24 would explode IDL size).
//!
//! SA23: markets open on first contact. If the Market / Position / vault PDAs
//! are uninitialized, we hand-roll the system-program + SPL-token CPIs to
//! create them — signed by the PDAs' own seeds. Anchor's `init_if_needed`
//! cannot run inside a stride loop, hence the manual ceremony.
//!
//! Unbacked invariant: every entry validates its source is enabled and its
//! tuple respects MR3 bounds before a single lamport moves. A forged account
//! dies on PDA re-derivation. A disabled source dies on `source.enabled`.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::system_program::{self, CreateAccount};
use anchor_spl::token::{self, spl_token, Mint, Token, Transfer};

use crate::error::ErrorCode;
use crate::state::{BetPlaced, GlobalConfig, Market, MarketInstantiated, Position, Side, Source};

pub const MAX_BATCH: usize = 24;
pub const ENTRY_STRIDE: usize = 5;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BatchEntry {
    pub source_id: u32,
    pub close_time: i64,
    pub settlement_time: i64,
    pub threshold_bps: i32,
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

    /// Stake mint — required for vault initialization when a fresh market
    /// instantiates inside the loop.
    #[account(address = config.stake_mint)]
    pub stake_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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
    require!(
        ra.len() >= args.entries.len() * ENTRY_STRIDE,
        ErrorCode::BatchTooLarge
    );

    let rent = Rent::get()?;
    let market_rent = rent.minimum_balance(Market::LEN);
    let position_rent = rent.minimum_balance(Position::LEN);
    let vault_rent = rent.minimum_balance(spl_token::state::Account::LEN);

    for (i, entry) in args.entries.iter().enumerate() {
        let base = i * ENTRY_STRIDE;
        let market_info = &ra[base];
        let position_info = &ra[base + 1];
        let vault_info = &ra[base + 2];
        let user_ata_info = &ra[base + 3];
        let source_info = &ra[base + 4];

        // MR3 bounds apply per entry — gate before any lamport moves.
        require!(
            entry.threshold_bps != 0 && entry.threshold_bps.abs() <= 10_000,
            ErrorCode::BadThreshold
        );
        require!(entry.close_time > now, ErrorCode::BadTime);
        require!(entry.close_time - now >= 10, ErrorCode::BadTime);
        require!(
            entry.settlement_time - entry.close_time >= 10,
            ErrorCode::BadTime
        );
        require!(
            entry.settlement_time - now <= 30 * 86_400,
            ErrorCode::BadTime
        );
        require!(entry.amount > 0, ErrorCode::InsufficientBalance);
        // Grid alignment — 60s stride prevents sparse-pool fragmentation.
        require!(
            entry.close_time % 60 == 0 && entry.settlement_time % 60 == 0,
            ErrorCode::BadTime
        );

        // Source must be whitelisted and enabled (MR1). Deserialize through the
        // Anchor wrapper so the discriminator is checked.
        let (expected_source, _src_bump) = Pubkey::find_program_address(
            &[b"source", &entry.source_id.to_le_bytes()],
            &crate::ID,
        );
        require_keys_eq!(source_info.key(), expected_source, ErrorCode::BadAccount);
        let source: Account<Source> = Account::try_from(source_info)?;
        require!(source.enabled, ErrorCode::SourceDisabled);

        // Derive PDA keys + bumps for market, position, vault. The market PDA
        // is the vault's token-account authority, so its bump must match the
        // one we use for both create_account CPIs.
        let (expected_market, market_bump) = Pubkey::find_program_address(
            &[
                b"market",
                &entry.source_id.to_le_bytes(),
                &entry.close_time.to_le_bytes(),
                &entry.settlement_time.to_le_bytes(),
                &entry.threshold_bps.to_le_bytes(),
            ],
            &crate::ID,
        );
        require_keys_eq!(market_info.key(), expected_market, ErrorCode::BadAccount);

        let (expected_position, position_bump) = Pubkey::find_program_address(
            &[b"position", expected_market.as_ref(), ctx.accounts.user.key().as_ref()],
            &crate::ID,
        );
        require_keys_eq!(
            position_info.key(),
            expected_position,
            ErrorCode::BadAccount
        );

        let (expected_vault, vault_bump) =
            Pubkey::find_program_address(&[b"vault", expected_market.as_ref()], &crate::ID);
        require_keys_eq!(vault_info.key(), expected_vault, ErrorCode::BadAccount);

        // Market — create if empty, otherwise load + validate.
        let source_id_bytes = entry.source_id.to_le_bytes();
        let close_bytes = entry.close_time.to_le_bytes();
        let settle_bytes = entry.settlement_time.to_le_bytes();
        let thresh_bytes = entry.threshold_bps.to_le_bytes();
        let market_bump_arr = [market_bump];
        let market_signer_seeds: &[&[u8]] = &[
            b"market",
            &source_id_bytes,
            &close_bytes,
            &settle_bytes,
            &thresh_bytes,
            &market_bump_arr,
        ];

        let market_is_fresh = market_info.data_is_empty();

        if market_is_fresh {
            // Allocate the Market PDA from the system program, signed by its
            // own seeds. Rent-exempt, crate::ID-owned.
            system_program::create_account(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.key(),
                    CreateAccount {
                        from: ctx.accounts.user.to_account_info(),
                        to: market_info.clone(),
                    },
                    &[market_signer_seeds],
                ),
                market_rent,
                Market::LEN as u64,
                &crate::ID,
            )?;

            // Vault — a token account owned by spl_token, authority = Market PDA.
            system_program::create_account(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.key(),
                    CreateAccount {
                        from: ctx.accounts.user.to_account_info(),
                        to: vault_info.clone(),
                    },
                    &[&[b"vault", expected_market.as_ref(), &[vault_bump]]],
                ),
                vault_rent,
                spl_token::state::Account::LEN as u64,
                &spl_token::ID,
            )?;

            // InitializeAccount3 — no rent sysvar needed. Authority = Market PDA.
            let init_ix = spl_token::instruction::initialize_account3(
                &spl_token::ID,
                vault_info.key,
                ctx.accounts.stake_mint.to_account_info().key,
                &expected_market,
            )?;
            anchor_lang::solana_program::program::invoke(
                &init_ix,
                &[
                    vault_info.clone(),
                    ctx.accounts.stake_mint.to_account_info(),
                    ctx.accounts.token_program.to_account_info(),
                ],
            )?;

            // Write the Market struct — discriminator + Borsh payload.
            let market_state = Market {
                source_id: entry.source_id,
                close_time: entry.close_time,
                settlement_time: entry.settlement_time,
                threshold_bps: entry.threshold_bps,
                total_yes: 0,
                total_no: 0,
                resolved: false,
                outcome_yes: false,
                baseline_price: 0,
                final_price: 0,
                vault: expected_vault,
                bump: market_bump,
            };
            let mut data = market_info.try_borrow_mut_data()?;
            let mut cursor = std::io::Cursor::new(&mut data[..]);
            market_state.try_serialize(&mut cursor)?;

            emit!(MarketInstantiated {
                market: expected_market,
                source_id: entry.source_id,
                close_time: entry.close_time,
                settlement_time: entry.settlement_time,
                threshold_bps: entry.threshold_bps,
                creator: ctx.accounts.user.key(),
            });
        } else {
            // Existing market — owner must be this program; discriminator
            // check via Account::try_from below catches foreign accounts.
            require_keys_eq!(*market_info.owner, crate::ID, ErrorCode::BadAccount);
        }

        // Load the market as a mutable Anchor account. Works in both branches
        // — freshly written data deserializes identically.
        let mut market: Account<Market> = Account::try_from(market_info)?;
        require!(now < market.close_time, ErrorCode::WindowClosed);
        require!(!market.resolved, ErrorCode::AlreadyResolved);
        require_keys_eq!(market.vault, expected_vault, ErrorCode::BadAccount);

        // Position — create or load.
        let user_key = ctx.accounts.user.key();
        if position_info.data_is_empty() {
            let position_bump_arr = [position_bump];
            let position_signer_seeds: &[&[u8]] = &[
                b"position",
                expected_market.as_ref(),
                user_key.as_ref(),
                &position_bump_arr,
            ];
            system_program::create_account(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.key(),
                    CreateAccount {
                        from: ctx.accounts.user.to_account_info(),
                        to: position_info.clone(),
                    },
                    &[position_signer_seeds],
                ),
                position_rent,
                Position::LEN as u64,
                &crate::ID,
            )?;

            let fresh_position = Position {
                market: expected_market,
                owner: ctx.accounts.user.key(),
                yes_amount: 0,
                no_amount: 0,
                bump: position_bump,
            };
            let mut data = position_info.try_borrow_mut_data()?;
            let mut cursor = std::io::Cursor::new(&mut data[..]);
            fresh_position.try_serialize(&mut cursor)?;
        } else {
            require_keys_eq!(*position_info.owner, crate::ID, ErrorCode::BadAccount);
        }

        let mut position: Account<Position> = Account::try_from(position_info)?;
        require!(
            position.owner == ctx.accounts.user.key(),
            ErrorCode::Unauthorized
        );
        require!(position.market == expected_market, ErrorCode::BadAccount);

        // Vault must exist by now (either pre-existing or just created).
        require!(!vault_info.data_is_empty(), ErrorCode::BadAccount);
        require_keys_eq!(
            *vault_info.owner,
            spl_token::ID,
            ErrorCode::BadAccount
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: user_ata_info.clone(),
                    to: vault_info.clone(),
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
            market: expected_market,
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
