//! Ed25519 multisig verification via Solana's native precompile.
//!
//! The precompile verifies signatures OUTSIDE program execution. We read the
//! sysvar `Instructions` and confirm the precompile ran with the inputs we
//! expect. This is the standard governance pattern.
//!
//! Two payload shapes (MR4), domain-tagged to prevent replay:
//! - Close:   `source_id(4) || close_time(8) || baseline_price(16) || TAG_CLOSE(1)` = 29 bytes
//! - Resolve: `source_id(4) || settlement_time(8) || final_price(16) || TAG_RESOLVE(2)` = 29 bytes

use anchor_lang::prelude::*;
use bytemuck::{Pod, Zeroable};
use solana_instructions_sysvar::load_instruction_at_checked;

use crate::error::ErrorCode;
use crate::state::OracleConfig;

pub const TAG_CLOSE: u8 = 1;
pub const TAG_RESOLVE: u8 = 2;

pub const PAYLOAD_LEN: usize = 4 + 8 + 16 + 1;

/// Mirrors the ed25519 precompile record layout. 14 bytes, little-endian
/// offsets. Pinned to the on-chain precompile format — if the runtime drifts,
/// the `assert!` below fails at compile time (SR5).
#[repr(C, packed)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct Ed25519Offsets {
    pub signature_offset: u16,
    pub signature_instruction_index: u16,
    pub public_key_offset: u16,
    pub public_key_instruction_index: u16,
    pub message_data_offset: u16,
    pub message_data_size: u16,
    pub message_instruction_index: u16,
}
const _: () = assert!(core::mem::size_of::<Ed25519Offsets>() == 14);

pub fn build_close_payload(source_id: u32, close_time: i64, baseline_price: u128) -> [u8; PAYLOAD_LEN] {
    build_payload(source_id, close_time, baseline_price, TAG_CLOSE)
}

pub fn build_resolve_payload(
    source_id: u32,
    settlement_time: i64,
    final_price: u128,
) -> [u8; PAYLOAD_LEN] {
    build_payload(source_id, settlement_time, final_price, TAG_RESOLVE)
}

fn build_payload(source_id: u32, ts: i64, price: u128, tag: u8) -> [u8; PAYLOAD_LEN] {
    let mut out = [0u8; PAYLOAD_LEN];
    out[0..4].copy_from_slice(&source_id.to_le_bytes());
    out[4..12].copy_from_slice(&ts.to_le_bytes());
    out[12..28].copy_from_slice(&price.to_le_bytes());
    out[28] = tag;
    out
}

/// For each entry `i` in `sigs`, the instruction at position `i` in the
/// current transaction must be a call to the ed25519 precompile that verified
/// `sigs[i]` over `expected` using a pubkey in `oracle.active_signers`.
///
/// No `SigEntry` wrapper (SA17) — signature bytes only. The signer pubkey is
/// read from the precompile instruction data.
pub fn verify_multisig(
    oracle: &Account<OracleConfig>,
    expected: &[u8],
    sigs: &[[u8; 64]],
    ix_sysvar: &AccountInfo,
) -> Result<()> {
    require_keys_eq!(
        ix_sysvar.key(),
        solana_sdk_ids::sysvar::instructions::ID,
        ErrorCode::BadSignature
    );
    require!(
        sigs.len() >= oracle.active_threshold as usize,
        ErrorCode::ThresholdNotMet
    );

    let mut seen: Vec<Pubkey> = Vec::with_capacity(sigs.len());
    for (i, sig) in sigs.iter().enumerate() {
        let ix = load_instruction_at_checked(i, ix_sysvar)
            .map_err(|_| error!(ErrorCode::BadSignature))?;
        require!(
            ix.program_id == solana_sdk_ids::ed25519_program::ID,
            ErrorCode::BadSignature
        );

        // Precompile layout: [num_sigs (u8), padding (u8), Ed25519Offsets (14 bytes), sig || pk || msg].
        let data = &ix.data;
        require!(data.len() >= 16, ErrorCode::BadSignature);
        require!(data[0] == 1, ErrorCode::BadSignature); // exactly 1 sig per precompile ix
        let offsets: &Ed25519Offsets = bytemuck::from_bytes(&data[2..16]);

        let pk_off = offsets.public_key_offset as usize;
        let sig_off = offsets.signature_offset as usize;
        let msg_off = offsets.message_data_offset as usize;
        let msg_len = offsets.message_data_size as usize;

        require!(
            data.len() >= pk_off + 32 && data.len() >= sig_off + 64 && data.len() >= msg_off + msg_len,
            ErrorCode::BadSignature
        );

        // Pubkey must be in the active signer set.
        let pk = Pubkey::try_from(&data[pk_off..pk_off + 32])
            .map_err(|_| error!(ErrorCode::BadSignature))?;
        require!(
            oracle.active_signers.contains(&pk),
            ErrorCode::BadSignature
        );
        // No duplicate signers within a single verification.
        require!(!seen.contains(&pk), ErrorCode::BadSignature);
        seen.push(pk);

        // Signature and message must match our args.
        require!(&data[sig_off..sig_off + 64] == &sig[..], ErrorCode::BadSignature);
        require!(&data[msg_off..msg_off + msg_len] == expected, ErrorCode::BadSignature);
    }
    Ok(())
}
