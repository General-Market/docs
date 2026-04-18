use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

pub mod error;
pub mod state;

pub use error::*;
pub use state::*;

declare_id!("4zwmmKAL83VQADqRwfXERvPU2e1K3vcPpqPN7DmTR7MT");

// ns-market: a minimal prediction-market program. Two outcomes per market,
// SOL-denominated, no AMM, no resolution. It exists so the frontend can
// sign a real `place_bet` instruction end-to-end — session wallet signs,
// bet is stored as a PDA, an event is emitted.
//
// Redemption and market resolution are intentionally left to the
// production program. This is the smallest surface that proves 1-click
// trading works against a custom program, not against memo transactions.

#[program]
pub mod ns_market {
    use super::*;

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        _nonce: u64,
        market_id: String,
        outcome: u8,
        amount: u64,
    ) -> Result<()> {
        require!(outcome < 2, NsMarketError::InvalidOutcome);
        require!(amount > 0, NsMarketError::InvalidAmount);
        require!(market_id.len() <= 32, NsMarketError::MarketIdTooLong);
        require!(!market_id.is_empty(), NsMarketError::MarketIdEmpty);

        // Move `amount` lamports from bettor to the bet PDA. The PDA is
        // rent-funded by the `init` constraint; this extra transfer is
        // the stake. A future redeem instruction would close the account
        // and pay out lamports to the winner.
        let cpi_ix = system_instruction::transfer(
            &ctx.accounts.bettor.key(),
            &ctx.accounts.bet.key(),
            amount,
        );
        invoke(
            &cpi_ix,
            &[
                ctx.accounts.bettor.to_account_info(),
                ctx.accounts.bet.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let bet = &mut ctx.accounts.bet;
        bet.bettor = ctx.accounts.bettor.key();
        bet.market_id = market_id.clone();
        bet.outcome = outcome;
        bet.amount = amount;
        bet.timestamp = Clock::get()?.unix_timestamp;
        bet.redeemed = false;
        bet.bump = ctx.bumps.bet;

        emit!(BetPlaced {
            bettor: bet.bettor,
            market_id,
            outcome,
            amount,
            timestamp: bet.timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    // Bet PDA. Seeded by bettor + client-side nonce so every bet has a
    // unique derivation. 8-byte Anchor discriminator + Bet::LEN.
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

#[event]
pub struct BetPlaced {
    pub bettor: Pubkey,
    pub market_id: String,
    pub outcome: u8,
    pub amount: u64,
    pub timestamp: i64,
}
