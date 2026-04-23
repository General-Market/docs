//! End-to-end lifecycle test for the prediction-market program.
//!
//! The LiteSVM harness executes the real BPF bytecode — these tests exercise
//! the entire pipeline: init, upsert_source, oracle rotation with 24h warp,
//! bet entry, close_market (ed25519 precompile), resolve_market, claim.

mod common;

use common::*;
use prediction_market::instructions::{CloseMarketArgs, ExitBetArgs, PlaceBetArgs, ResolveMarketArgs};
use prediction_market::oracle::{build_close_payload, build_resolve_payload};
use prediction_market::state::{GlobalConfig, Market, OracleConfig, Position, Side, Source};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use anchor_lang::prelude::Pubkey;
use solana_signer::Signer;

const ONE_USDC: u64 = 1_000_000; // 6-decimal mint

fn make_admin() -> Keypair {
    Keypair::new()
}

fn genesis() -> (litesvm::LiteSVM, Keypair, Pubkey) {
    let mut svm = load_svm();
    let admin = make_admin();
    airdrop(&mut svm, &admin.pubkey(), 100_000_000_000);
    let mint = create_mint(&mut svm, &admin, 6);
    // Anchor clocks on a fresh LiteSVM start at 0 — nudge to a realistic
    // timestamp so MR3 bounds line up.
    set_unix(&mut svm, 1_700_000_000);
    (svm, admin, mint)
}

fn init_config(svm: &mut litesvm::LiteSVM, admin: &Keypair, mint: &Pubkey, fee_bps: u16) {
    let ix = ix_initialize_config(&admin.pubkey(), mint, fee_bps);
    send_ix(svm, &[ix], admin, &[]);
}

fn upsert_source(
    svm: &mut litesvm::LiteSVM,
    admin: &Keypair,
    source_id: u32,
    enabled: bool,
) {
    let mut name = [0u8; 32];
    let label = b"bitget";
    name[..label.len()].copy_from_slice(label);
    let ix = ix_upsert_source(&admin.pubkey(), source_id, name, enabled);
    send_ix(svm, &[ix], admin, &[]);
}

fn install_oracle(svm: &mut litesvm::LiteSVM, admin: &Keypair, oracle: &MockOracle, threshold: u8) {
    let ix = ix_propose_oracle_signers(&admin.pubkey(), oracle.pubkeys(), threshold);
    send_ix(svm, &[ix], admin, &[]);
    // 24h + 1s past activation.
    warp_unix(svm, 86_401);
    send_ix(svm, &[ix_activate_oracle_signers()], admin, &[]);
}

fn fund_user(svm: &mut litesvm::LiteSVM, admin: &Keypair, mint: &Pubkey, user: &Keypair, amount: u64) {
    airdrop(svm, &user.pubkey(), 50_000_000_000);
    let ata = create_ata(svm, admin, &user.pubkey(), mint);
    mint_to(svm, admin, mint, &ata, amount);
}

// -----------------------------------------------------------------------------
// 1. initialize_config + upsert_source + oracle rotation
// -----------------------------------------------------------------------------

#[test]
fn initialize_config_stores_fields() {
    let (mut svm, admin, mint) = genesis();
    init_config(&mut svm, &admin, &mint, 50);

    let cfg: GlobalConfig = fetch(&svm, &config_pda());
    assert_eq!(cfg.admin, admin.pubkey());
    assert_eq!(cfg.fee_bps, 50);
    assert_eq!(cfg.stake_mint, mint);
    assert_eq!(cfg.fee_vault, fee_vault_pda());
    assert_eq!(cfg.pending_admin, Pubkey::default());
    assert!(!cfg.paused);
}

#[test]
fn upsert_source_toggles_enabled() {
    let (mut svm, admin, mint) = genesis();
    init_config(&mut svm, &admin, &mint, 50);
    upsert_source(&mut svm, &admin, 7, true);

    let s: Source = fetch(&svm, &source_pda(7));
    assert_eq!(s.source_id, 7);
    assert!(s.enabled);

    upsert_source(&mut svm, &admin, 7, false);
    let s2: Source = fetch(&svm, &source_pda(7));
    assert!(!s2.enabled);
}

#[test]
fn bootstrap_activation_skips_delay() {
    // First oracle signer activation has nothing to protect — an empty
    // `active_signers` set leaves no previous custody to rotate away from.
    // The 24h wait is ceremony in that moment. We skip it.
    let (mut svm, admin, mint) = genesis();
    init_config(&mut svm, &admin, &mint, 50);
    upsert_source(&mut svm, &admin, 1, true);
    let oracle = MockOracle::new(1);

    let propose = ix_propose_oracle_signers(&admin.pubkey(), oracle.pubkeys(), 1);
    send_ix(&mut svm, &[propose], &admin, &[]);

    // No time warp. Activation must still succeed on bootstrap.
    send_ix(&mut svm, &[ix_activate_oracle_signers()], &admin, &[]);

    let oc: OracleConfig = fetch(&svm, &oracle_config_pda());
    assert_eq!(oc.active_signers.len(), 1);
    assert_eq!(oc.active_threshold, 1);
    assert!(oc.pending_signers.is_empty());
}

#[test]
fn rotation_still_waits_24h() {
    // Bootstrap bypasses the delay; every rotation after it does not.
    let (mut svm, admin, mint) = genesis();
    init_config(&mut svm, &admin, &mint, 50);

    // Bootstrap — immediate activation.
    let first = MockOracle::new(1);
    send_ix(
        &mut svm,
        &[ix_propose_oracle_signers(&admin.pubkey(), first.pubkeys(), 1)],
        &admin,
        &[],
    );
    send_ix(&mut svm, &[ix_activate_oracle_signers()], &admin, &[]);

    // Now rotate to a new set. Active is non-empty, so the timelock reasserts.
    let second = MockOracle::new(3);
    send_ix(
        &mut svm,
        &[ix_propose_oracle_signers(&admin.pubkey(), second.pubkeys(), 2)],
        &admin,
        &[],
    );

    // Too early — the door is locked.
    warp_unix(&mut svm, 3_600);
    let err = try_send_ix(&mut svm, &[ix_activate_oracle_signers()], &admin, &[]);
    assert!(err.is_err(), "rotation must fail before 24h");

    // Past the delay.
    warp_unix(&mut svm, 86_401 - 3_600);
    send_ix(&mut svm, &[ix_activate_oracle_signers()], &admin, &[]);

    let oc: OracleConfig = fetch(&svm, &oracle_config_pda());
    assert_eq!(oc.active_signers.len(), 3);
    assert_eq!(oc.active_threshold, 2);
    assert!(oc.pending_signers.is_empty());
}

// -----------------------------------------------------------------------------
// 2. Happy-path lifecycle: place_bet -> close_market -> resolve_market -> claim
// -----------------------------------------------------------------------------

fn setup_market(
    svm: &mut litesvm::LiteSVM,
    admin: &Keypair,
    mint: &Pubkey,
    source_id: u32,
    _threshold_bps: i32,
) -> (i64, i64, MockOracle) {
    init_config(svm, admin, mint, 50);
    upsert_source(svm, admin, source_id, true);
    let oracle = MockOracle::new(1);
    install_oracle(svm, admin, &oracle, 1);
    let now = now_unix(svm);
    // Grid-aligned (60s) close + settle, safely beyond MR3's 10s floor.
    let close = ((now + 180) / 60) * 60;
    let settle = close + 180;
    (close, settle, oracle)
}

fn close_market_ix_pair(
    _svm: &litesvm::LiteSVM,
    oracle: &MockOracle,
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    baseline: u128,
    cranker: &Pubkey,
) -> (Instruction, Instruction) {
    let payload = build_close_payload(source_id, close_time, baseline);
    let (precompile_ix, sig_bytes) = oracle.precompile_ix(0, &payload);
    let close_ix = ix_close_market(
        source_id,
        close_time,
        settlement_time,
        threshold_bps,
        cranker,
        CloseMarketArgs {
            baseline_price: baseline,
            signatures: vec![sig_bytes],
        },
    );
    (precompile_ix, close_ix)
}

fn resolve_market_ix_pair(
    _svm: &litesvm::LiteSVM,
    oracle: &MockOracle,
    source_id: u32,
    close_time: i64,
    settlement_time: i64,
    threshold_bps: i32,
    final_price: u128,
    cranker: &Pubkey,
) -> (Instruction, Instruction) {
    let payload = build_resolve_payload(source_id, settlement_time, final_price);
    let (precompile_ix, sig_bytes) = oracle.precompile_ix(0, &payload);
    let resolve_ix = ix_resolve_market(
        source_id,
        close_time,
        settlement_time,
        threshold_bps,
        cranker,
        ResolveMarketArgs {
            final_price,
            signatures: vec![sig_bytes],
        },
    );
    (precompile_ix, resolve_ix)
}

#[test]
fn happy_path_lifecycle() {
    let (mut svm, admin, mint) = genesis();
    let source_id = 7u32;
    let threshold_bps = 50i32;
    let (close, settle, oracle) = setup_market(&mut svm, &admin, &mint, source_id, threshold_bps);

    let alice = Keypair::new();
    let bob = Keypair::new();
    fund_user(&mut svm, &admin, &mint, &alice, 10 * ONE_USDC);
    fund_user(&mut svm, &admin, &mint, &bob, 10 * ONE_USDC);

    // Alice: YES 1M, Bob: NO 500k.
    let yes_args = PlaceBetArgs {
        source_id,
        close_time: close,
        settlement_time: settle,
        threshold_bps,
        side: Side::Yes,
        amount: 1_000_000,
    };
    send_ix(
        &mut svm,
        &[ix_place_bet(&alice.pubkey(), &mint, yes_args.clone())],
        &alice,
        &[],
    );
    let no_args = PlaceBetArgs {
        side: Side::No,
        amount: 500_000,
        ..yes_args.clone()
    };
    send_ix(
        &mut svm,
        &[ix_place_bet(&bob.pubkey(), &mint, no_args.clone())],
        &bob,
        &[],
    );

    // Bob exits 100k of his NO mid-window.
    set_unix(&mut svm, close - 1);
    let exit = ix_exit_bet(
        &bob.pubkey(),
        &mint,
        source_id,
        close,
        settle,
        threshold_bps,
        ExitBetArgs {
            side: Side::No,
            amount: 100_000,
        },
    );
    send_ix(&mut svm, &[exit], &bob, &[]);

    let m: Market = fetch(&svm, &market_pda(source_id, close, settle, threshold_bps));
    assert_eq!(m.total_yes, 1_000_000);
    assert_eq!(m.total_no, 400_000);

    // Warp to close_time; close_market.
    set_unix(&mut svm, close + 1);
    let cranker = Keypair::new();
    airdrop(&mut svm, &cranker.pubkey(), 5_000_000_000);

    let baseline = 1_000_000_000_000_000_000u128; // 1.0 at 1e18
    let (pre, close_ix) = close_market_ix_pair(
        &svm,
        &oracle,
        source_id,
        close,
        settle,
        threshold_bps,
        baseline,
        &cranker.pubkey(),
    );
    send_ix(&mut svm, &[pre, close_ix], &cranker, &[]);

    let m: Market = fetch(&svm, &market_pda(source_id, close, settle, threshold_bps));
    assert_eq!(m.baseline_price, baseline);

    // Warp past settlement. Final 1.01 -> +100bps -> YES wins.
    set_unix(&mut svm, settle + 1);
    let final_price = 1_010_000_000_000_000_000u128;
    let (pre2, resolve_ix) = resolve_market_ix_pair(
        &svm,
        &oracle,
        source_id,
        close,
        settle,
        threshold_bps,
        final_price,
        &cranker.pubkey(),
    );
    send_ix(&mut svm, &[pre2, resolve_ix], &cranker, &[]);

    let m: Market = fetch(&svm, &market_pda(source_id, close, settle, threshold_bps));
    assert!(m.resolved);
    assert!(m.outcome_yes);

    // Claim for Alice (cranker signs, Alice receives). Loser Bob too — his
    // Position closes with no transfer.
    let alice_before = token_balance(&svm, &ata_for(&alice.pubkey(), &mint));
    send_ix(
        &mut svm,
        &[ix_claim(
            source_id,
            close,
            settle,
            threshold_bps,
            &alice.pubkey(),
            &cranker.pubkey(),
            &mint,
        )],
        &cranker,
        &[],
    );
    let alice_after = token_balance(&svm, &ata_for(&alice.pubkey(), &mint));

    // Pool 1.4M; winning_total 1M; Alice's stake 1M; gross 1.4M; fee 50bps=7000; net 1_393_000.
    assert_eq!(alice_after - alice_before, 1_393_000);

    // Fee vault received 7_000.
    let fee_bal = token_balance(&svm, &fee_vault_pda());
    assert_eq!(fee_bal, 7_000);

    // Bob's claim — loser path. Position should close, no token transfer.
    let bob_before = token_balance(&svm, &ata_for(&bob.pubkey(), &mint));
    send_ix(
        &mut svm,
        &[ix_claim(
            source_id,
            close,
            settle,
            threshold_bps,
            &bob.pubkey(),
            &cranker.pubkey(),
            &mint,
        )],
        &cranker,
        &[],
    );
    let bob_after = token_balance(&svm, &ata_for(&bob.pubkey(), &mint));
    assert_eq!(bob_after, bob_before, "loser receives nothing");

    // Alice Position is closed.
    assert!(fetch_opt::<Position>(&svm, &position_pda(&market_pda(source_id, close, settle, threshold_bps), &alice.pubkey())).is_none());
}

// -----------------------------------------------------------------------------
// 3. Negative threshold — YES if price goes DOWN past threshold
// -----------------------------------------------------------------------------

#[test]
fn negative_threshold_flips_direction() {
    let (mut svm, admin, mint) = genesis();
    let source_id = 11u32;
    let threshold_bps = -50i32; // YES if final <= baseline * 0.995
    let (close, settle, oracle) = setup_market(&mut svm, &admin, &mint, source_id, threshold_bps);

    let alice = Keypair::new();
    let bob = Keypair::new();
    fund_user(&mut svm, &admin, &mint, &alice, 10 * ONE_USDC);
    fund_user(&mut svm, &admin, &mint, &bob, 10 * ONE_USDC);

    let yes = PlaceBetArgs {
        source_id,
        close_time: close,
        settlement_time: settle,
        threshold_bps,
        side: Side::Yes,
        amount: 1_000_000,
    };
    let no = PlaceBetArgs { side: Side::No, ..yes.clone() };
    send_ix(&mut svm, &[ix_place_bet(&alice.pubkey(), &mint, yes)], &alice, &[]);
    send_ix(&mut svm, &[ix_place_bet(&bob.pubkey(), &mint, no)], &bob, &[]);

    set_unix(&mut svm, close + 1);
    let cranker = Keypair::new();
    airdrop(&mut svm, &cranker.pubkey(), 5_000_000_000);
    let baseline = 1_000_000_000_000_000_000u128;
    let (p, ci) = close_market_ix_pair(
        &svm, &oracle, source_id, close, settle, threshold_bps, baseline, &cranker.pubkey(),
    );
    send_ix(&mut svm, &[p, ci], &cranker, &[]);

    // Final drops to 0.99 — past -50bps threshold -> YES wins.
    set_unix(&mut svm, settle + 1);
    let final_price = 990_000_000_000_000_000u128;
    let (p2, ri) = resolve_market_ix_pair(
        &svm, &oracle, source_id, close, settle, threshold_bps, final_price, &cranker.pubkey(),
    );
    send_ix(&mut svm, &[p2, ri], &cranker, &[]);

    let m: Market = fetch(&svm, &market_pda(source_id, close, settle, threshold_bps));
    assert!(m.outcome_yes, "price dropped past -50bps → YES wins");
}

// -----------------------------------------------------------------------------
// 4. Stranded pool — everyone on losing side
// -----------------------------------------------------------------------------

#[test]
fn stranded_pool_refunds_full_stake() {
    let (mut svm, admin, mint) = genesis();
    let source_id = 19u32;
    let threshold_bps = 50i32;
    let (close, settle, oracle) = setup_market(&mut svm, &admin, &mint, source_id, threshold_bps);

    let alice = Keypair::new();
    fund_user(&mut svm, &admin, &mint, &alice, 10 * ONE_USDC);

    // Alice bets YES 1M. She's alone on YES; no one on NO.
    let yes = PlaceBetArgs {
        source_id,
        close_time: close,
        settlement_time: settle,
        threshold_bps,
        side: Side::Yes,
        amount: 1_000_000,
    };
    send_ix(&mut svm, &[ix_place_bet(&alice.pubkey(), &mint, yes)], &alice, &[]);

    set_unix(&mut svm, close + 1);
    let cranker = Keypair::new();
    airdrop(&mut svm, &cranker.pubkey(), 5_000_000_000);
    let baseline = 1_000_000_000_000_000_000u128;
    let (p, ci) = close_market_ix_pair(
        &svm, &oracle, source_id, close, settle, threshold_bps, baseline, &cranker.pubkey(),
    );
    send_ix(&mut svm, &[p, ci], &cranker, &[]);

    // Final UNCHANGED → Alice's YES loses (price didn't move +50bps). Winning
    // side is NO, winning_total = 0 → stranded.
    set_unix(&mut svm, settle + 1);
    let final_price = baseline; // no movement; YES loses at strict + threshold
    let (p2, ri) = resolve_market_ix_pair(
        &svm, &oracle, source_id, close, settle, threshold_bps, final_price, &cranker.pubkey(),
    );
    send_ix(&mut svm, &[p2, ri], &cranker, &[]);

    let m: Market = fetch(&svm, &market_pda(source_id, close, settle, threshold_bps));
    assert!(!m.outcome_yes);
    assert_eq!(m.total_no, 0);

    // Alice claim → stranded refund of her full 1M (no fee).
    let before = token_balance(&svm, &ata_for(&alice.pubkey(), &mint));
    send_ix(
        &mut svm,
        &[ix_claim(source_id, close, settle, threshold_bps, &alice.pubkey(), &cranker.pubkey(), &mint)],
        &cranker,
        &[],
    );
    let after = token_balance(&svm, &ata_for(&alice.pubkey(), &mint));
    assert_eq!(after - before, 1_000_000);
}

// -----------------------------------------------------------------------------
// 5. One-sided fee skip — whole pool on winning side
// -----------------------------------------------------------------------------

#[test]
fn one_sided_pool_skips_fee() {
    let (mut svm, admin, mint) = genesis();
    let source_id = 23u32;
    let threshold_bps = 50i32;
    let (close, settle, oracle) = setup_market(&mut svm, &admin, &mint, source_id, threshold_bps);

    let alice = Keypair::new();
    fund_user(&mut svm, &admin, &mint, &alice, 10 * ONE_USDC);
    let yes = PlaceBetArgs {
        source_id,
        close_time: close,
        settlement_time: settle,
        threshold_bps,
        side: Side::Yes,
        amount: 1_000_000,
    };
    send_ix(&mut svm, &[ix_place_bet(&alice.pubkey(), &mint, yes)], &alice, &[]);

    set_unix(&mut svm, close + 1);
    let cranker = Keypair::new();
    airdrop(&mut svm, &cranker.pubkey(), 5_000_000_000);
    let baseline = 1_000_000_000_000_000_000u128;
    let (p, ci) = close_market_ix_pair(
        &svm, &oracle, source_id, close, settle, threshold_bps, baseline, &cranker.pubkey(),
    );
    send_ix(&mut svm, &[p, ci], &cranker, &[]);

    set_unix(&mut svm, settle + 1);
    let final_price = 1_010_000_000_000_000_000u128; // YES wins
    let (p2, ri) = resolve_market_ix_pair(
        &svm, &oracle, source_id, close, settle, threshold_bps, final_price, &cranker.pubkey(),
    );
    send_ix(&mut svm, &[p2, ri], &cranker, &[]);

    let before = token_balance(&svm, &ata_for(&alice.pubkey(), &mint));
    send_ix(
        &mut svm,
        &[ix_claim(source_id, close, settle, threshold_bps, &alice.pubkey(), &cranker.pubkey(), &mint)],
        &cranker,
        &[],
    );
    let after = token_balance(&svm, &ata_for(&alice.pubkey(), &mint));

    // Full 1M refund — fee skipped because NO side was empty.
    assert_eq!(after - before, 1_000_000);
    assert_eq!(token_balance(&svm, &fee_vault_pda()), 0);
}

// -----------------------------------------------------------------------------
// 6. Force-resolve timing (MR6)
// -----------------------------------------------------------------------------

#[test]
fn force_resolve_enforces_observation_window_delay() {
    let (mut svm, admin, mint) = genesis();
    let source_id = 31u32;
    let threshold_bps = 50i32;
    let (close, settle, _oracle) = setup_market(&mut svm, &admin, &mint, source_id, threshold_bps);
    let observation = settle - close;

    let alice = Keypair::new();
    fund_user(&mut svm, &admin, &mint, &alice, 10 * ONE_USDC);
    send_ix(
        &mut svm,
        &[ix_place_bet(
            &alice.pubkey(),
            &mint,
            PlaceBetArgs {
                source_id,
                close_time: close,
                settlement_time: settle,
                threshold_bps,
                side: Side::Yes,
                amount: 1_000_000,
            },
        )],
        &alice,
        &[],
    );

    // Too early: exactly at settlement.
    set_unix(&mut svm, settle);
    let err = try_send_ix(
        &mut svm,
        &[ix_admin_force_resolve(
            &admin.pubkey(),
            source_id,
            close,
            settle,
            threshold_bps,
            1_000_000_000_000_000_000u128,
            1_010_000_000_000_000_000u128,
        )],
        &admin,
        &[],
    );
    assert!(err.is_err(), "force-resolve at settlement must fail");

    // Past settlement + observation window (MR6).
    set_unix(&mut svm, settle + observation + 1);
    send_ix(
        &mut svm,
        &[ix_admin_force_resolve(
            &admin.pubkey(),
            source_id,
            close,
            settle,
            threshold_bps,
            1_000_000_000_000_000_000u128,
            1_010_000_000_000_000_000u128,
        )],
        &admin,
        &[],
    );

    let m: Market = fetch(&svm, &market_pda(source_id, close, settle, threshold_bps));
    assert!(m.resolved);
    assert!(m.outcome_yes);
}

// -----------------------------------------------------------------------------
// 7. batch_bets — forged Market account rejected
// -----------------------------------------------------------------------------

#[test]
fn batch_bets_rejects_forged_market() {
    let (mut svm, admin, mint) = genesis();
    let source_id = 41u32;
    let threshold_bps = 50i32;
    let (close, settle, _oracle) = setup_market(&mut svm, &admin, &mint, source_id, threshold_bps);

    let mm = Keypair::new();
    fund_user(&mut svm, &admin, &mint, &mm, 10 * ONE_USDC);
    // Seed one legitimate market.
    send_ix(
        &mut svm,
        &[ix_place_bet(
            &mm.pubkey(),
            &mint,
            PlaceBetArgs {
                source_id,
                close_time: close,
                settlement_time: settle,
                threshold_bps,
                side: Side::Yes,
                amount: 10_000,
            },
        )],
        &mm,
        &[],
    );

    // Now craft a forged stride-5 where the "market" account is actually
    // the Source PDA — the manual PDA-derivation check in batch_bets must
    // reject it.
    let fake_market = source_pda(source_id);
    let real_market = market_pda(source_id, close, settle, threshold_bps);
    let remaining = vec![
        AccountMeta::new(fake_market, false),
        AccountMeta::new(position_pda(&real_market, &mm.pubkey()), false),
        AccountMeta::new(vault_pda(&real_market), false),
        AccountMeta::new(ata_for(&mm.pubkey(), &mint), false),
        AccountMeta::new_readonly(source_pda(source_id), false),
    ];

    let err = try_send_ix(
        &mut svm,
        &[ix_batch_bets(
            &mm.pubkey(),
            &mint,
            remaining,
            prediction_market::instructions::BatchBetsArgs {
                entries: vec![prediction_market::instructions::BatchEntry {
                    source_id,
                    close_time: close,
                    settlement_time: settle,
                    threshold_bps,
                    side: Side::Yes,
                    amount: 1_000,
                }],
            },
        )],
        &mm,
        &[],
    );
    assert!(err.is_err(), "forged market account must be rejected");
}
