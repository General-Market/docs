//! Shared test helpers for the prediction-market LiteSVM suite.

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use anchor_lang::prelude::Pubkey;
use litesvm::LiteSVM;
use litesvm_token::{CreateAssociatedTokenAccount, CreateMint, MintTo};
use solana_clock::Clock;
use solana_ed25519_program::new_ed25519_instruction_with_signature;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

pub fn load_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../../target/deploy/prediction_market.so");
    svm.add_program(prediction_market::ID, bytes).unwrap();
    // Advance past the program's deployment slot so the program is runnable.
    let slot = svm.get_sysvar::<Clock>().slot;
    svm.warp_to_slot(slot + 1);
    svm
}

pub fn airdrop(svm: &mut LiteSVM, pk: &Pubkey, lamports: u64) {
    svm.airdrop(pk, lamports).unwrap();
}

pub fn warp_unix(svm: &mut LiteSVM, delta: i64) {
    let mut c = svm.get_sysvar::<Clock>();
    c.unix_timestamp += delta;
    svm.set_sysvar::<Clock>(&c);
}

pub fn set_unix(svm: &mut LiteSVM, ts: i64) {
    let mut c = svm.get_sysvar::<Clock>();
    c.unix_timestamp = ts;
    svm.set_sysvar::<Clock>(&c);
}

pub fn now_unix(svm: &LiteSVM) -> i64 {
    svm.get_sysvar::<Clock>().unix_timestamp
}

pub fn send_ix(svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) {
    // Rotate the blockhash so repeated identical txs from the same payer
    // never collide on LiteSVM's signature dedup cache.
    svm.expire_blockhash();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let mut all_signers = vec![payer];
    for s in signers {
        all_signers.push(*s);
    }
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all_signers).unwrap();
    svm.send_transaction(tx).unwrap();
}

pub fn try_send_ix(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> std::result::Result<(), String> {
    svm.expire_blockhash();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let mut all_signers = vec![payer];
    for s in signers {
        all_signers.push(*s);
    }
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all_signers)
        .map_err(|e| format!("{:?}", e))?;
    svm.send_transaction(tx).map_err(|e| format!("{:?}", e))?;
    Ok(())
}

// ----------------------------------------------------------------------------
// PDA helpers (deterministic for the program ID)
// ----------------------------------------------------------------------------

pub fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &prediction_market::ID).0
}

pub fn fee_vault_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"fee_vault"], &prediction_market::ID).0
}

pub fn oracle_config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"oracle_config"], &prediction_market::ID).0
}

pub fn source_pda(source_id: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[b"source", &source_id.to_le_bytes()],
        &prediction_market::ID,
    )
    .0
}

pub fn market_pda(source_id: u32, close_time: i64, settlement_time: i64, threshold_bps: i32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            b"market",
            &source_id.to_le_bytes(),
            &close_time.to_le_bytes(),
            &settlement_time.to_le_bytes(),
            &threshold_bps.to_le_bytes(),
        ],
        &prediction_market::ID,
    )
    .0
}

pub fn position_pda(market: &Pubkey, user: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"position", market.as_ref(), user.as_ref()], &prediction_market::ID).0
}

pub fn vault_pda(market: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", market.as_ref()], &prediction_market::ID).0
}

pub fn ata_for(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    anchor_spl::associated_token::get_associated_token_address(owner, mint)
}

// ----------------------------------------------------------------------------
// Account fetch
// ----------------------------------------------------------------------------

pub fn fetch<T: AccountDeserialize>(svm: &LiteSVM, pk: &Pubkey) -> T {
    let data = svm.get_account(pk).expect("account").data;
    T::try_deserialize(&mut data.as_slice()).expect("deserialize")
}

pub fn fetch_opt<T: AccountDeserialize>(svm: &LiteSVM, pk: &Pubkey) -> Option<T> {
    svm.get_account(pk)
        .and_then(|a| T::try_deserialize(&mut a.data.as_slice()).ok())
}

// ----------------------------------------------------------------------------
// Mint + ATA setup
// ----------------------------------------------------------------------------

pub fn create_mint(svm: &mut LiteSVM, payer: &Keypair, decimals: u8) -> Pubkey {
    CreateMint::new(svm, payer)
        .decimals(decimals)
        .authority(&payer.pubkey())
        .send()
        .unwrap()
}

pub fn create_ata(svm: &mut LiteSVM, payer: &Keypair, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    CreateAssociatedTokenAccount::new(svm, payer, mint)
        .owner(owner)
        .send()
        .unwrap()
}

pub fn mint_to(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, ata: &Pubkey, amount: u64) {
    MintTo::new(svm, payer, mint, ata, amount).send().unwrap();
}

pub fn token_balance(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    let data = svm.get_account(ata).expect("ata").data;
    // Offset 64 in the SPL token Account layout = `amount` (u64 LE).
    u64::from_le_bytes(data[64..72].try_into().unwrap())
}

// ----------------------------------------------------------------------------
// Ed25519 oracle helpers
// ----------------------------------------------------------------------------

pub struct MockOracle {
    pub members: Vec<ed25519_dalek::SigningKey>,
}

impl MockOracle {
    pub fn new(n: usize) -> Self {
        use rand::rngs::OsRng;
        let mut rng = OsRng;
        let members = (0..n)
            .map(|_| ed25519_dalek::SigningKey::generate(&mut rng))
            .collect();
        Self { members }
    }

    pub fn pubkeys(&self) -> Vec<Pubkey> {
        self.members
            .iter()
            .map(|sk| Pubkey::new_from_array(sk.verifying_key().to_bytes()))
            .collect()
    }

    pub fn sign(&self, idx: usize, payload: &[u8]) -> ([u8; 64], [u8; 32]) {
        use ed25519_dalek::Signer;
        let sk = &self.members[idx];
        let sig = sk.sign(payload).to_bytes();
        let pk = sk.verifying_key().to_bytes();
        (sig, pk)
    }

    /// Build an ed25519-precompile instruction that verifies a single
    /// signature over `payload`.
    pub fn precompile_ix(&self, idx: usize, payload: &[u8]) -> (Instruction, [u8; 64]) {
        let (sig, pk) = self.sign(idx, payload);
        let ix = new_ed25519_instruction_with_signature(payload, &sig, &pk);
        (ix, sig)
    }
}

// ----------------------------------------------------------------------------
// Instruction builders
// ----------------------------------------------------------------------------

pub fn ix_initialize_config(
    admin: &Pubkey,
    stake_mint: &Pubkey,
    fee_bps: u16,
) -> Instruction {
    let data = prediction_market::instruction::InitializeConfig { fee_bps }.data();
    let accounts = prediction_market::accounts::InitializeConfig {
        config: config_pda(),
        fee_vault: fee_vault_pda(),
        stake_mint: *stake_mint,
        admin: *admin,
        token_program: anchor_spl::token::ID,
        system_program: solana_sdk_ids::system_program::ID,
        rent: solana_sdk_ids::sysvar::rent::ID,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_upsert_source(
    admin: &Pubkey,
    source_id: u32,
    name: [u8; 32],
    enabled: bool,
) -> Instruction {
    let data = prediction_market::instruction::UpsertSource {
        source_id,
        name,
        enabled,
    }
    .data();
    let accounts = prediction_market::accounts::UpsertSource {
        config: config_pda(),
        source: source_pda(source_id),
        admin: *admin,
        system_program: solana_sdk_ids::system_program::ID,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_propose_oracle_signers(
    admin: &Pubkey,
    signers: Vec<Pubkey>,
    threshold: u8,
) -> Instruction {
    let data = prediction_market::instruction::ProposeOracleSigners { signers, threshold }.data();
    let accounts = prediction_market::accounts::ProposeOracleSigners {
        config: config_pda(),
        oracle_config: oracle_config_pda(),
        admin: *admin,
        system_program: solana_sdk_ids::system_program::ID,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_activate_oracle_signers() -> Instruction {
    let data = prediction_market::instruction::ActivateOracleSigners {}.data();
    let accounts = prediction_market::accounts::ActivateOracleSigners {
        oracle_config: oracle_config_pda(),
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_place_bet(
    user: &Pubkey,
    stake_mint: &Pubkey,
    args: prediction_market::instructions::PlaceBetArgs,
) -> Instruction {
    let market = market_pda(args.source_id, args.close_time, args.settlement_time, args.threshold_bps);
    let position = position_pda(&market, user);
    let vault = vault_pda(&market);
    let user_ata = ata_for(user, stake_mint);
    let data = prediction_market::instruction::PlaceBet { args: args.clone() }.data();
    let accounts = prediction_market::accounts::PlaceBet {
        config: config_pda(),
        source: source_pda(args.source_id),
        market,
        position,
        vault,
        stake_mint: *stake_mint,
        user_ata,
        user: *user,
        token_program: anchor_spl::token::ID,
        associated_token_program: anchor_spl::associated_token::ID,
        system_program: solana_sdk_ids::system_program::ID,
        rent: solana_sdk_ids::sysvar::rent::ID,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_exit_bet(
    user: &Pubkey,
    stake_mint: &Pubkey,
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    args: prediction_market::instructions::ExitBetArgs,
) -> Instruction {
    let market = market_pda(source_id, close_time, settlement_time, threshold_bps);
    let position = position_pda(&market, user);
    let vault = vault_pda(&market);
    let user_ata = ata_for(user, stake_mint);
    let data = prediction_market::instruction::ExitBet { args }.data();
    let accounts = prediction_market::accounts::ExitBet {
        market,
        position,
        vault,
        user_ata,
        user: *user,
        token_program: anchor_spl::token::ID,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_close_market(
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    cranker: &Pubkey,
    args: prediction_market::instructions::CloseMarketArgs,
) -> Instruction {
    let market = market_pda(source_id, close_time, settlement_time, threshold_bps);
    let data = prediction_market::instruction::CloseMarket { args }.data();
    let accounts = prediction_market::accounts::CloseMarket {
        market,
        oracle_config: oracle_config_pda(),
        ix_sysvar: solana_sdk_ids::sysvar::instructions::ID,
        cranker: *cranker,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_resolve_market(
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    cranker: &Pubkey,
    args: prediction_market::instructions::ResolveMarketArgs,
) -> Instruction {
    let market = market_pda(source_id, close_time, settlement_time, threshold_bps);
    let data = prediction_market::instruction::ResolveMarket { args }.data();
    let accounts = prediction_market::accounts::ResolveMarket {
        market,
        oracle_config: oracle_config_pda(),
        ix_sysvar: solana_sdk_ids::sysvar::instructions::ID,
        cranker: *cranker,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_claim(
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    owner: &Pubkey,
    cranker: &Pubkey,
    stake_mint: &Pubkey,
) -> Instruction {
    let market = market_pda(source_id, close_time, settlement_time, threshold_bps);
    let data = prediction_market::instruction::Claim {}.data();
    let accounts = prediction_market::accounts::Claim {
        config: config_pda(),
        market,
        position: position_pda(&market, owner),
        vault: vault_pda(&market),
        fee_vault: fee_vault_pda(),
        owner: *owner,
        owner_ata: ata_for(owner, stake_mint),
        stake_mint: *stake_mint,
        cranker: *cranker,
        token_program: anchor_spl::token::ID,
        associated_token_program: anchor_spl::associated_token::ID,
        system_program: solana_sdk_ids::system_program::ID,
        rent: solana_sdk_ids::sysvar::rent::ID,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_admin_force_resolve(
    admin: &Pubkey,
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    baseline_price: u128,
    final_price: u128,
) -> Instruction {
    let market = market_pda(source_id, close_time, settlement_time, threshold_bps);
    let data = prediction_market::instruction::AdminForceResolve {
        baseline_price,
        final_price,
    }
    .data();
    let accounts = prediction_market::accounts::AdminForceResolve {
        config: config_pda(),
        market,
        admin: *admin,
    }
    .to_account_metas(None);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}

pub fn ix_batch_bets(
    user: &Pubkey,
    stake_mint: &Pubkey,
    remaining: Vec<AccountMeta>,
    args: prediction_market::instructions::BatchBetsArgs,
) -> Instruction {
    let data = prediction_market::instruction::BatchBets { args }.data();
    let mut accounts = prediction_market::accounts::BatchBets {
        config: config_pda(),
        stake_mint: *stake_mint,
        user: *user,
        token_program: anchor_spl::token::ID,
        system_program: solana_sdk_ids::system_program::ID,
        rent: solana_sdk_ids::sysvar::rent::ID,
    }
    .to_account_metas(None);
    accounts.extend(remaining);
    Instruction {
        program_id: prediction_market::ID,
        accounts,
        data,
    }
}
