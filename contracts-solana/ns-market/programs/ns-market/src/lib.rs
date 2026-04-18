use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

pub mod error;
pub mod state;

pub use error::*;
pub use state::*;

declare_id!("4zwmmKAL83VQADqRwfXERvPU2e1K3vcPpqPN7DmTR7MT");

pub const MAX_MARKET_ID_LEN: usize = 32;
pub const MAX_QUESTION_LEN: usize = 200;
pub const UNRESOLVED: u8 = 255;
pub const MAX_FEE_BPS: u16 = 10_000;
pub const BPS_DENOMINATOR: u128 = 10_000;

// ns-market: a parimutuel prediction-market program.
// - create_market: anyone creates, with optional closes_at and fee_bps.
// - place_bet: stake SOL on YES (0) or NO (1). Rejected after closes_at.
// - resolve_market: authority picks the winner.
// - redeem: winners claim `bet.amount * total_pool / winning_pool`, minus
//   the market's fee_bps which accrues to the authority.

#[program]
pub mod ns_market {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: String,
        question: String,
        closes_at: i64,
        fee_bps: u16,
    ) -> Result<()> {
        require!(!market_id.is_empty(), NsMarketError::MarketIdEmpty);
        require!(market_id.len() <= MAX_MARKET_ID_LEN, NsMarketError::MarketIdTooLong);
        require!(question.len() <= MAX_QUESTION_LEN, NsMarketError::QuestionTooLong);
        require!(fee_bps <= MAX_FEE_BPS, NsMarketError::FeeTooHigh);

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.market_id = market_id;
        market.question = question;
        market.resolved = false;
        market.winning_outcome = UNRESOLVED;
        market.total_pool = 0;
        market.yes_pool = 0;
        market.no_pool = 0;
        market.created_at = Clock::get()?.unix_timestamp;
        market.closes_at = closes_at;
        market.resolved_at = 0;
        market.fee_bps = fee_bps;
        market.fee_collected = 0;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        _nonce: u64,
        outcome: u8,
        amount: u64,
    ) -> Result<()> {
        require!(outcome < 2, NsMarketError::InvalidOutcome);
        require!(amount > 0, NsMarketError::InvalidAmount);

        let market_key = ctx.accounts.market.key();
        let now = Clock::get()?.unix_timestamp;

        {
            let market = &ctx.accounts.market;
            require!(!market.resolved, NsMarketError::MarketResolved);
            if market.closes_at > 0 {
                require!(now < market.closes_at, NsMarketError::MarketClosed);
            }
        }

        // Move staked lamports from bettor to the Market PDA (the pool).
        let ix = system_instruction::transfer(
            &ctx.accounts.bettor.key(),
            &market_key,
            amount,
        );
        invoke(
            &ix,
            &[
                ctx.accounts.bettor.to_account_info(),
                ctx.accounts.market.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let market = &mut ctx.accounts.market;
        market.total_pool = market.total_pool.checked_add(amount).unwrap();
        if outcome == 0 {
            market.yes_pool = market.yes_pool.checked_add(amount).unwrap();
        } else {
            market.no_pool = market.no_pool.checked_add(amount).unwrap();
        }

        let bet = &mut ctx.accounts.bet;
        bet.bettor = ctx.accounts.bettor.key();
        bet.market = market_key;
        bet.outcome = outcome;
        bet.amount = amount;
        bet.timestamp = now;
        bet.redeemed = false;
        bet.bump = ctx.bumps.bet;

        emit!(BetPlaced {
            bettor: bet.bettor,
            market: market_key,
            outcome,
            amount,
            timestamp: bet.timestamp,
        });

        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        winning_outcome: u8,
    ) -> Result<()> {
        require!(winning_outcome < 2, NsMarketError::InvalidOutcome);

        let market = &mut ctx.accounts.market;
        require!(!market.resolved, NsMarketError::MarketResolved);
        require!(
            market.authority == ctx.accounts.authority.key(),
            NsMarketError::Unauthorized
        );

        market.resolved = true;
        market.winning_outcome = winning_outcome;
        market.resolved_at = Clock::get()?.unix_timestamp;

        emit!(MarketResolved {
            market: market.key(),
            winning_outcome,
        });
        Ok(())
    }

    pub fn redeem(ctx: Context<Redeem>, _nonce: u64) -> Result<()> {
        let bet = &ctx.accounts.bet;
        let market = &ctx.accounts.market;

        require!(market.resolved, NsMarketError::MarketNotResolved);
        require!(!bet.redeemed, NsMarketError::AlreadyRedeemed);
        require!(bet.outcome == market.winning_outcome, NsMarketError::LosingBet);

        let winning_pool = if market.winning_outcome == 0 {
            market.yes_pool
        } else {
            market.no_pool
        };
        require!(winning_pool > 0, NsMarketError::NoWinners);

        // Parimutuel payout before fee.
        let gross: u128 = (bet.amount as u128)
            .checked_mul(market.total_pool as u128)
            .unwrap()
            / (winning_pool as u128);

        // Protocol fee, basis points. 200 bps = 2%.
        let fee: u128 = gross.checked_mul(market.fee_bps as u128).unwrap() / BPS_DENOMINATOR;
        let net: u64 = (gross - fee) as u64;
        let fee_u64: u64 = fee as u64;

        let market_info = ctx.accounts.market.to_account_info();
        let bettor_info = ctx.accounts.bettor.to_account_info();

        // Pay the winner out of the Market PDA's lamports directly.
        let market_lamports = market_info.lamports();
        **market_info.try_borrow_mut_lamports()? = market_lamports
            .checked_sub(net)
            .unwrap();
        let bettor_lamports = bettor_info.lamports();
        **bettor_info.try_borrow_mut_lamports()? = bettor_lamports
            .checked_add(net)
            .unwrap();

        // Pay the protocol fee to the authority in the same instruction, if
        // non-zero and if the authority account is passed in. The authority
        // account lives outside the Anchor account-context boundary
        // otherwise — the #[account] below enforces address.
        if fee_u64 > 0 {
            let authority_info = ctx.accounts.authority.to_account_info();
            let market_lamports = market_info.lamports();
            **market_info.try_borrow_mut_lamports()? = market_lamports
                .checked_sub(fee_u64)
                .unwrap();
            let authority_lamports = authority_info.lamports();
            **authority_info.try_borrow_mut_lamports()? = authority_lamports
                .checked_add(fee_u64)
                .unwrap();
        }

        let market_mut = &mut ctx.accounts.market;
        market_mut.fee_collected = market_mut.fee_collected.checked_add(fee_u64).unwrap();
        ctx.accounts.bet.redeemed = true;

        emit!(BetRedeemed {
            bettor: ctx.accounts.bettor.key(),
            market: ctx.accounts.market.key(),
            payout: net,
            fee: fee_u64,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Market::LEN,
        seeds = [b"market", market_id.as_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = bettor,
        space = 8 + Bet::LEN,
        seeds = [b"bet", bettor.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bet", bettor.key().as_ref(), &nonce.to_le_bytes()],
        bump = bet.bump,
        has_one = bettor,
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut, address = bet.market)]
    pub market: Account<'info, Market>,

    // Protocol fee goes here. Enforced to match market.authority so the
    // caller can't redirect fees by passing a different account.
    /// CHECK: pubkey-equality with market.authority enforced by address.
    #[account(mut, address = market.authority)]
    pub authority: AccountInfo<'info>,
}

#[event]
pub struct BetPlaced {
    pub bettor: Pubkey,
    pub market: Pubkey,
    pub outcome: u8,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winning_outcome: u8,
}

#[event]
pub struct BetRedeemed {
    pub bettor: Pubkey,
    pub market: Pubkey,
    pub payout: u64,
    pub fee: u64,
}
