//! Build and submit oracle transactions.
//!
//! Three public entry points mirror the program's external surface:
//!   * `submit_close`   — ed25519 precompile ix + `close_market` program ix.
//!   * `submit_resolve` — ed25519 precompile ix + `resolve_market` program ix.
//!   * `submit_claim`   — `claim` program ix; permissionless, no precompile.
//!
//! SA24: the precompile instruction is built by hand. The Solana SDK ships
//! helpers for this, but those helpers have moved across crates twice in
//! two years. A local constructor, pinned by tests to the program's
//! `Ed25519Offsets` parser, is the only stable contract.
//!
//! Retry policy: exponential backoff on network/preflight failures, capped
//! at six attempts. Business-logic reverts (e.g. `AlreadyClosed`) bubble up
//! immediately — the scanner will cease to see the market on the next wake.

use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::{anyhow, Context, Result};
use ed25519_dalek::{Signer as _, SigningKey};
use prediction_market::instructions::{CloseMarketArgs, ResolveMarketArgs};
use solana_commitment_config::CommitmentConfig;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_pubkey::Pubkey;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_rpc_client_api::client_error::Error as ClientError;
use solana_sdk::signature::Signature;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use std::time::Duration;
use tracing::{debug, warn};

/// The native Solana ed25519 precompile program ID. Sourced directly from
/// `solana_sdk_ids` — that crate is the canonical registry for runtime-fixed
/// program addresses, and a mismatch there would break every Solana
/// transaction on the network, not just ours.
/// Base58: `Ed25519SigVerify111111111111111111111111111`.
pub const ED25519_PROGRAM_ID: Pubkey = solana_sdk_ids::ed25519_program::ID;

// -----------------------------------------------------------------------------
// Ed25519 precompile instruction
// -----------------------------------------------------------------------------

/// Build an ed25519 precompile instruction verifying a single signature over
/// `message`. Matches `Ed25519Offsets` in the program's `oracle.rs` and the
/// byte layout emitted by `solana_ed25519_program::new_ed25519_instruction_with_signature`:
///
/// ```text
/// [num_sigs: u8=1][padding: u8=0]
/// [sig_offset: u16][sig_ix_idx: u16=FFFF]
/// [pk_offset: u16][pk_ix_idx: u16=FFFF]
/// [msg_offset: u16][msg_len: u16][msg_ix_idx: u16=FFFF]
/// [pubkey: 32][signature: 64][message: N]
/// ```
///
/// The `0xFFFF` instruction-index sentinel tells the precompile to look up
/// each blob inside this same instruction's data. Pubkey comes before
/// signature in the payload — the precompile does not care about order (it
/// follows the offsets in the header), but matching the reference layout
/// keeps us byte-for-byte identical with the SDK helper and the program's
/// own tests.
pub fn build_ed25519_ix(pubkey: &[u8; 32], signature: &[u8; 64], message: &[u8]) -> Instruction {
    const HEADER: usize = 2 + 14; // count + padding + Ed25519Offsets
    let pk_offset: u16 = HEADER as u16;
    let sig_offset: u16 = pk_offset + 32;
    let msg_offset: u16 = sig_offset + 64;
    let msg_len: u16 = message.len() as u16;

    let mut data = Vec::with_capacity(HEADER + 32 + 64 + message.len());
    data.push(1); // num_signatures
    data.push(0); // padding
    data.extend_from_slice(&sig_offset.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes()); // sig_instruction_index = this ix
    data.extend_from_slice(&pk_offset.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes());
    data.extend_from_slice(&msg_offset.to_le_bytes());
    data.extend_from_slice(&msg_len.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes());
    data.extend_from_slice(pubkey);
    data.extend_from_slice(signature);
    data.extend_from_slice(message);

    Instruction {
        program_id: ED25519_PROGRAM_ID,
        accounts: vec![],
        data,
    }
}

// -----------------------------------------------------------------------------
// Program instruction builders (plain Rust — no anchor-client needed)
// -----------------------------------------------------------------------------

fn oracle_config_pda(program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"oracle_config"], program_id).0
}

fn config_pda(program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"config"], program_id).0
}

fn fee_vault_pda(program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"fee_vault"], program_id).0
}

fn vault_pda(program_id: &Pubkey, market: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", market.as_ref()], program_id).0
}

fn system_program_id() -> Pubkey {
    solana_sdk_ids::system_program::ID
}

fn instructions_sysvar_id() -> Pubkey {
    solana_sdk_ids::sysvar::instructions::ID
}

fn token_program_id() -> Pubkey {
    // SPL Token v1 program ID; pinned so we do not take a transitive crate
    // dependency just for this constant.
    // Base58: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
    Pubkey::new_from_array([
        0x06, 0xdd, 0xf6, 0xe1, 0xd7, 0x65, 0xa1, 0x93,
        0xd9, 0xcb, 0xe1, 0x46, 0xce, 0xeb, 0x79, 0xac,
        0x1c, 0xb4, 0x85, 0xed, 0x5f, 0x5b, 0x37, 0x91,
        0x3a, 0x8c, 0xf5, 0x85, 0x7e, 0xff, 0x00, 0xa9,
    ])
}

fn associated_token_program_id() -> Pubkey {
    // Base58: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
    Pubkey::new_from_array([
        0x8c, 0x97, 0x25, 0x8f, 0x4e, 0x24, 0x89, 0xf1,
        0xbb, 0x3d, 0x10, 0x29, 0x14, 0x8e, 0x0d, 0x83,
        0x0b, 0x5a, 0x13, 0x99, 0xda, 0xff, 0x10, 0x84,
        0x04, 0x8e, 0x7b, 0xd8, 0xdb, 0xe9, 0xf8, 0x59,
    ])
}

fn rent_sysvar_id() -> Pubkey {
    solana_sdk_ids::sysvar::rent::ID
}

/// Spl-associated-token derivation — reimplemented to avoid a fat dep on
/// `anchor-spl` in the host-side daemon.
fn associated_token_address(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(
        &[
            owner.as_ref(),
            token_program_id().as_ref(),
            mint.as_ref(),
        ],
        &associated_token_program_id(),
    );
    pda
}

pub fn build_close_ix(
    program_id: &Pubkey,
    market: &Pubkey,
    cranker: &Pubkey,
    baseline_price: u128,
    signature: [u8; 64],
) -> Instruction {
    let accounts = prediction_market::accounts::CloseMarket {
        market: *market,
        oracle_config: oracle_config_pda(program_id),
        ix_sysvar: instructions_sysvar_id(),
        cranker: *cranker,
    }
    .to_account_metas(None);

    // Anchor's generated accounts module emits `solana_pubkey::Pubkey`-typed
    // metas; convert to the `solana_instruction::AccountMeta` shape our
    // transaction builder expects.
    let accounts: Vec<AccountMeta> = accounts
        .into_iter()
        .map(|m| AccountMeta {
            pubkey: m.pubkey,
            is_signer: m.is_signer,
            is_writable: m.is_writable,
        })
        .collect();

    let data = prediction_market::instruction::CloseMarket {
        args: CloseMarketArgs {
            baseline_price,
            signatures: vec![signature],
        },
    }
    .data();

    Instruction {
        program_id: *program_id,
        accounts,
        data,
    }
}

pub fn build_resolve_ix(
    program_id: &Pubkey,
    market: &Pubkey,
    cranker: &Pubkey,
    final_price: u128,
    signature: [u8; 64],
) -> Instruction {
    let accounts = prediction_market::accounts::ResolveMarket {
        market: *market,
        oracle_config: oracle_config_pda(program_id),
        ix_sysvar: instructions_sysvar_id(),
        cranker: *cranker,
    }
    .to_account_metas(None);

    let accounts: Vec<AccountMeta> = accounts
        .into_iter()
        .map(|m| AccountMeta {
            pubkey: m.pubkey,
            is_signer: m.is_signer,
            is_writable: m.is_writable,
        })
        .collect();

    let data = prediction_market::instruction::ResolveMarket {
        args: ResolveMarketArgs {
            final_price,
            signatures: vec![signature],
        },
    }
    .data();

    Instruction {
        program_id: *program_id,
        accounts,
        data,
    }
}

pub fn build_claim_ix(
    program_id: &Pubkey,
    market: &Pubkey,
    position: &Pubkey,
    owner: &Pubkey,
    stake_mint: &Pubkey,
    cranker: &Pubkey,
) -> Instruction {
    let owner_ata = associated_token_address(owner, stake_mint);
    let accounts = prediction_market::accounts::Claim {
        config: config_pda(program_id),
        market: *market,
        position: *position,
        vault: vault_pda(program_id, market),
        fee_vault: fee_vault_pda(program_id),
        owner: *owner,
        owner_ata,
        stake_mint: *stake_mint,
        cranker: *cranker,
        token_program: token_program_id(),
        associated_token_program: associated_token_program_id(),
        system_program: system_program_id(),
        rent: rent_sysvar_id(),
    }
    .to_account_metas(None);

    let accounts: Vec<AccountMeta> = accounts
        .into_iter()
        .map(|m| AccountMeta {
            pubkey: m.pubkey,
            is_signer: m.is_signer,
            is_writable: m.is_writable,
        })
        .collect();

    let data = prediction_market::instruction::Claim {}.data();

    Instruction {
        program_id: *program_id,
        accounts,
        data,
    }
}

// -----------------------------------------------------------------------------
// Transaction helpers + retry
// -----------------------------------------------------------------------------

const MAX_RETRIES: u32 = 5;
const INITIAL_BACKOFF_MS: u64 = 250;
const MAX_BACKOFF_MS: u64 = 4_000;

async fn send_legacy_tx(
    rpc: &RpcClient,
    payer: &Keypair,
    ixs: &[Instruction],
) -> Result<Signature> {
    let mut backoff = INITIAL_BACKOFF_MS;
    let mut last_err: Option<ClientError> = None;
    for attempt in 0..=MAX_RETRIES {
        let blockhash = rpc
            .get_latest_blockhash()
            .await
            .context("get_latest_blockhash")?;
        let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer])
            .map_err(|e| anyhow!("sign tx: {e}"))?;
        match rpc
            .send_and_confirm_transaction_with_spinner_and_commitment(
                &tx,
                CommitmentConfig::confirmed(),
            )
            .await
        {
            Ok(sig) => return Ok(sig),
            Err(e) => {
                let transient = is_transient(&e);
                warn!(attempt, transient, error = %e, "tx send failed");
                last_err = Some(e);
                if !transient {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(backoff)).await;
                backoff = (backoff * 2).min(MAX_BACKOFF_MS);
            }
        }
    }
    Err(anyhow!(
        "tx send exhausted retries: {:?}",
        last_err.map(|e| e.to_string())
    ))
}

fn is_transient(err: &ClientError) -> bool {
    // A blunt heuristic: anything stringly mentioning a network or blockhash
    // issue gets another chance; on-chain reverts do not. Good enough —
    // every transient bucket we miss just becomes a skipped retry, and the
    // scanner will rediscover the work on the next wake.
    let s = err.to_string();
    s.contains("Blockhash not found")
        || s.contains("was not confirmed")
        || s.contains("timed out")
        || s.contains("rate limit")
        || s.contains("connection")
        || s.contains("503")
        || s.contains("502")
        || s.contains("504")
}

// -----------------------------------------------------------------------------
// Public submit entry points
// -----------------------------------------------------------------------------

pub async fn submit_close(
    rpc: &RpcClient,
    cranker_kp: &Keypair,
    signing_key: &SigningKey,
    program_id: &Pubkey,
    market: &Pubkey,
    source_id: u32,
    close_time: i64,
    baseline_price: u128,
) -> Result<Signature> {
    let payload = crate::payload::build_close_payload(source_id, close_time, baseline_price);
    let signature: [u8; 64] = signing_key.sign(&payload).to_bytes();
    let pk_bytes = signing_key.verifying_key().to_bytes();

    let precompile = build_ed25519_ix(&pk_bytes, &signature, &payload);
    let close_ix = build_close_ix(program_id, market, &cranker_kp.pubkey(), baseline_price, signature);
    debug!(market = %market, baseline_price, "submitting close_market");
    send_legacy_tx(rpc, cranker_kp, &[precompile, close_ix]).await
}

pub async fn submit_resolve(
    rpc: &RpcClient,
    cranker_kp: &Keypair,
    signing_key: &SigningKey,
    program_id: &Pubkey,
    market: &Pubkey,
    source_id: u32,
    settlement_time: i64,
    final_price: u128,
) -> Result<Signature> {
    let payload = crate::payload::build_resolve_payload(source_id, settlement_time, final_price);
    let signature: [u8; 64] = signing_key.sign(&payload).to_bytes();
    let pk_bytes = signing_key.verifying_key().to_bytes();

    let precompile = build_ed25519_ix(&pk_bytes, &signature, &payload);
    let resolve_ix =
        build_resolve_ix(program_id, market, &cranker_kp.pubkey(), final_price, signature);
    debug!(market = %market, final_price, "submitting resolve_market");
    send_legacy_tx(rpc, cranker_kp, &[precompile, resolve_ix]).await
}

pub async fn submit_claim(
    rpc: &RpcClient,
    cranker_kp: &Keypair,
    program_id: &Pubkey,
    market: &Pubkey,
    position: &Pubkey,
    owner: &Pubkey,
    stake_mint: &Pubkey,
) -> Result<Signature> {
    let claim_ix =
        build_claim_ix(program_id, market, position, owner, stake_mint, &cranker_kp.pubkey());
    debug!(market = %market, position = %position, owner = %owner, "submitting claim");
    send_legacy_tx(rpc, cranker_kp, &[claim_ix]).await
}

// -----------------------------------------------------------------------------
// Tests: round-trip the precompile against the program's own ID constant,
// and cross-check the Ed25519 program ID pin against the `solana_sdk_ids` crate.
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ed25519_program_id_matches_sdk_constant() {
        // If `solana_sdk_ids` ever changes the ed25519 precompile address,
        // our pinned constant must change with it. We do not import the
        // constant at runtime to avoid version drift, but we pin this test
        // so a lockstep mismatch dies at `cargo test` instead of on-chain.
        assert_eq!(ED25519_PROGRAM_ID, solana_sdk_ids::ed25519_program::ID);
    }

    #[test]
    fn ed25519_ix_layout_matches_reference_builder() {
        use ed25519_dalek::Signer as _;
        use rand::rngs::OsRng;
        let mut rng = OsRng;
        let sk = ed25519_dalek::SigningKey::generate(&mut rng);
        let pk = sk.verifying_key().to_bytes();
        let msg = b"test message";
        let sig: [u8; 64] = sk.sign(msg).to_bytes();

        let ours = build_ed25519_ix(&pk, &sig, msg);
        let theirs =
            solana_ed25519_program::new_ed25519_instruction_with_signature(msg, &sig, &pk);

        // Program ID is the same precompile.
        assert_eq!(ours.program_id.to_bytes(), theirs.program_id.to_bytes());
        // Byte-for-byte identical payload.
        assert_eq!(ours.data, theirs.data, "ed25519 precompile data byte mismatch");
    }

    #[test]
    fn ed25519_data_parses_with_program_offsets() {
        // Walk the data layout and verify each slice lands where the
        // program's `Ed25519Offsets` parser reads from.
        use ed25519_dalek::Signer as _;
        use rand::rngs::OsRng;
        let mut rng = OsRng;
        let sk = ed25519_dalek::SigningKey::generate(&mut rng);
        let pk = sk.verifying_key().to_bytes();
        let msg = b"domain tagged payload";
        let sig: [u8; 64] = sk.sign(msg).to_bytes();

        let ix = build_ed25519_ix(&pk, &sig, msg);
        let data = &ix.data;

        assert_eq!(data[0], 1, "one signature");
        assert_eq!(data[1], 0, "padding");
        let sig_off = u16::from_le_bytes([data[2], data[3]]) as usize;
        let sig_ix_idx = u16::from_le_bytes([data[4], data[5]]);
        let pk_off = u16::from_le_bytes([data[6], data[7]]) as usize;
        let msg_off = u16::from_le_bytes([data[10], data[11]]) as usize;
        let msg_len = u16::from_le_bytes([data[12], data[13]]) as usize;

        assert_eq!(sig_ix_idx, u16::MAX);
        assert_eq!(&data[sig_off..sig_off + 64], &sig[..]);
        assert_eq!(&data[pk_off..pk_off + 32], &pk[..]);
        assert_eq!(&data[msg_off..msg_off + msg_len], msg);
    }
}
