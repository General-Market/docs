//! Admin surface: source upsert, oracle signer rotation, pause/fee adjust,
//! admin handoff, fee withdrawal, force-resolve. One file (SA10).
//!
//! Every admin ix derives the config PDA with `has_one = admin` so the signer
//! constraint is enforced by Anchor's constraint engine rather than by a
//! shared `AdminOnly` wrapper (SA25).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::ErrorCode;
use crate::math::outcome_yes;
use crate::state::{GlobalConfig, Market, MarketResolved, OracleConfig, Source};

pub const MULTISIG_DELAY: i64 = 86_400;

// =============================================================================
// Source upsert (MR1)
// =============================================================================

#[derive(Accounts)]
#[instruction(source_id: u32)]
pub struct UpsertSource<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init_if_needed,
        payer = admin,
        space = Source::LEN,
        seeds = [b"source".as_ref(), &source_id.to_le_bytes()[..]],
        bump,
    )]
    pub source: Account<'info, Source>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn upsert_source(
    ctx: Context<UpsertSource>,
    source_id: u32,
    name: [u8; 32],
    enabled: bool,
) -> Result<()> {
    let s = &mut ctx.accounts.source;
    // On first init, source_id is 0 — safe to set. On upsert, the PDA seed
    // check already pinned source_id, so this is idempotent.
    s.source_id = source_id;
    s.name = name;
    s.enabled = enabled;
    if s.bump == 0 {
        s.bump = ctx.bumps.source;
    }
    Ok(())
}

// =============================================================================
// Oracle signer rotation (SA5: empty-vec = instant cancel; SR6: no timelock
// on the escape hatch)
// =============================================================================

#[derive(Accounts)]
pub struct ProposeOracleSigners<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init_if_needed,
        payer = admin,
        space = OracleConfig::LEN,
        seeds = [b"oracle_config"],
        bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn propose_oracle_signers(
    ctx: Context<ProposeOracleSigners>,
    signers: Vec<Pubkey>,
    threshold: u8,
) -> Result<()> {
    require!(
        signers.len() <= OracleConfig::MAX_SIGNERS,
        ErrorCode::BatchTooLarge
    );

    let oc = &mut ctx.accounts.oracle_config;
    if oc.bump == 0 {
        oc.bump = ctx.bumps.oracle_config;
    }

    // Empty vec + threshold 0 = instant cancel (SA5). A door locked during
    // the fire is a trap, not a feature.
    if signers.is_empty() && threshold == 0 {
        oc.pending_signers = Vec::new();
        oc.pending_threshold = 0;
        oc.pending_activation_ts = 0;
        return Ok(());
    }

    require!(
        threshold as usize >= 1 && (threshold as usize) <= signers.len(),
        ErrorCode::ThresholdNotMet
    );
    // Block new proposals while one is pending — prevents silent extension
    // of the 24h clock by re-proposal.
    require!(
        oc.pending_signers.is_empty(),
        ErrorCode::PendingAlreadyQueued
    );

    oc.pending_signers = signers;
    oc.pending_threshold = threshold;
    oc.pending_activation_ts = Clock::get()?.unix_timestamp + MULTISIG_DELAY;
    Ok(())
}

#[derive(Accounts)]
pub struct ActivateOracleSigners<'info> {
    #[account(mut, seeds = [b"oracle_config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
}

pub fn activate_oracle_signers(ctx: Context<ActivateOracleSigners>) -> Result<()> {
    let oc = &mut ctx.accounts.oracle_config;
    require!(!oc.pending_signers.is_empty(), ErrorCode::NoPending);
    require!(
        Clock::get()?.unix_timestamp >= oc.pending_activation_ts,
        ErrorCode::PendingNotReady
    );
    oc.active_signers = std::mem::take(&mut oc.pending_signers);
    oc.active_threshold = oc.pending_threshold;
    // SA13 — `pending_signers.is_empty()` is the single source of truth;
    // zeroing the rest is defensive cleanup for readability.
    oc.pending_threshold = 0;
    oc.pending_activation_ts = 0;
    Ok(())
}

// =============================================================================
// Pause, fee adjust
// =============================================================================

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}

#[derive(Accounts)]
pub struct SetFeeBps<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

pub fn set_fee_bps(ctx: Context<SetFeeBps>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= 10_000, ErrorCode::FeeTooHigh);
    ctx.accounts.config.fee_bps = fee_bps;
    Ok(())
}

// =============================================================================
// Two-step admin transfer (H8)
// =============================================================================

#[derive(Accounts)]
pub struct ProposeAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
    ctx.accounts.config.pending_admin = new_admin;
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(address = config.pending_admin @ ErrorCode::Unauthorized)]
    pub new_admin: Signer<'info>,
}

pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    require!(cfg.pending_admin != Pubkey::default(), ErrorCode::NoPending);
    cfg.admin = cfg.pending_admin;
    cfg.pending_admin = Pubkey::default();
    Ok(())
}

// =============================================================================
// Fee withdrawal (H7)
// =============================================================================

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [b"fee_vault"], bump = config.fee_vault_bump)]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    let bump = ctx.accounts.config.fee_vault_bump;
    let seeds: &[&[u8]] = &[b"fee_vault", std::slice::from_ref(&bump)];
    let signer_seeds: &[&[&[u8]]] = &[seeds];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.fee_vault.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.fee_vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;
    Ok(())
}

// =============================================================================
// Admin force-resolve (MR6 — unlocks at settlement + observation window)
// =============================================================================

#[derive(Accounts)]
pub struct AdminForceResolve<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
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
    pub admin: Signer<'info>,
}

pub fn admin_force_resolve(
    ctx: Context<AdminForceResolve>,
    baseline_price: u128,
    final_price: u128,
) -> Result<()> {
    let m = &mut ctx.accounts.market;
    require!(!m.resolved, ErrorCode::AlreadyResolved);

    // MR6 — one full observation window past missed settlement.
    let observation_window = m
        .settlement_time
        .checked_sub(m.close_time)
        .ok_or(ErrorCode::BadTime)?;
    let unlock_at = m
        .settlement_time
        .checked_add(observation_window)
        .ok_or(ErrorCode::BadTime)?;
    require!(
        Clock::get()?.unix_timestamp >= unlock_at,
        ErrorCode::ForceResolveTooEarly
    );

    m.baseline_price = baseline_price;
    m.final_price = final_price;
    m.outcome_yes = outcome_yes(baseline_price, final_price, m.threshold_bps);
    m.resolved = true;

    emit!(MarketResolved {
        market: m.key(),
        baseline_price,
        final_price,
        outcome_yes: m.outcome_yes,
        force_resolved: true,
    });
    Ok(())
}
