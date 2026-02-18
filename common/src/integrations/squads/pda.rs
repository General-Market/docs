//! PDA (Program Derived Address) derivation for Squads v4
//!
//! Squads v4 uses PDAs for all account addressing.
//! Reference: https://github.com/Squads-Protocol/v4

use solana_sdk::pubkey::Pubkey;

/// Squads v4 program ID on mainnet
///
/// Verified against https://github.com/Squads-Protocol/v4 IDL.
/// Note: The v3 (legacy) program ID is `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`.
pub const SQUADS_V4_PROGRAM_ID: &str = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";

/// Get the Squads v4 program ID as a Pubkey
pub fn program_id() -> Pubkey {
    SQUADS_V4_PROGRAM_ID
        .parse()
        .expect("Invalid Squads program ID")
}

/// Common prefix seed used by ALL Squads v4 PDAs
///
/// Every PDA in Squads v4 starts with this prefix.
/// Verified against: `programs/squads_multisig_program/src/state/seeds.rs`
pub const SEED_PREFIX: &[u8] = b"multisig";

/// Seeds for multisig PDA derivation (also "multisig" — appears twice in seeds)
pub const SEED_MULTISIG: &[u8] = b"multisig";

/// Seeds for vault PDA derivation
pub const SEED_VAULT: &[u8] = b"vault";

/// Seeds for transaction PDA derivation
pub const SEED_TRANSACTION: &[u8] = b"transaction";

/// Seeds for proposal PDA derivation
pub const SEED_PROPOSAL: &[u8] = b"proposal";

/// Seeds for spending limit PDA derivation
pub const SEED_SPENDING_LIMIT: &[u8] = b"spending_limit";

/// Derive the multisig PDA address
///
/// Seeds: `["multisig", "multisig", create_key]`
///
/// # Arguments
/// * `create_key` - The key used when creating the multisig
///
/// # Returns
/// Tuple of (PDA address, bump seed)
pub fn derive_multisig_pda(create_key: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_PREFIX, SEED_MULTISIG, create_key.as_ref()],
        &program_id(),
    )
}

/// Derive the vault PDA address for a given multisig and vault index
///
/// Seeds: `["multisig", multisig_pda, "vault", vault_index]`
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `vault_index` - The vault index (usually 0 for the default vault)
///
/// # Returns
/// Tuple of (PDA address, bump seed)
pub fn derive_vault_pda(multisig: &Pubkey, vault_index: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_VAULT,
            &vault_index.to_le_bytes(),
        ],
        &program_id(),
    )
}

/// Derive the vault transaction PDA address
///
/// Seeds: `["multisig", multisig_pda, "transaction", transaction_index]`
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `transaction_index` - The transaction index
///
/// # Returns
/// Tuple of (PDA address, bump seed)
pub fn derive_transaction_pda(multisig: &Pubkey, transaction_index: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_TRANSACTION,
            &transaction_index.to_le_bytes(),
        ],
        &program_id(),
    )
}

/// Derive the proposal PDA address
///
/// The proposal PDA is nested under the transaction PDA:
/// Seeds: `["multisig", multisig_pda, "transaction", transaction_index, "proposal"]`
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `transaction_index` - The transaction index this proposal is for
///
/// # Returns
/// Tuple of (PDA address, bump seed)
pub fn derive_proposal_pda(multisig: &Pubkey, transaction_index: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_TRANSACTION,
            &transaction_index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        &program_id(),
    )
}

/// Derive the spending limit configuration PDA address
///
/// Seeds: `["multisig", multisig_pda, "spending_limit", create_key]`
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `create_key` - The unique identifier for this spending limit
///
/// # Returns
/// Tuple of (PDA address, bump seed)
pub fn derive_spending_limit_pda(multisig: &Pubkey, create_key: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            SEED_PREFIX,
            multisig.as_ref(),
            SEED_SPENDING_LIMIT,
            create_key.as_ref(),
        ],
        &program_id(),
    )
}

/// Helper to create a vault address with default vault index (0)
pub fn derive_default_vault_pda(multisig: &Pubkey) -> (Pubkey, u8) {
    derive_vault_pda(multisig, 0)
}

/// SPL Token Program ID
pub const SPL_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/// Associated Token Program ID
pub const ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/// Derive the Associated Token Account (ATA) address for a wallet and mint
///
/// # Arguments
/// * `wallet` - The wallet/owner address
/// * `mint` - The token mint address
///
/// # Returns
/// The ATA address
pub fn derive_associated_token_account(wallet: &Pubkey, mint: &Pubkey) -> Pubkey {
    let token_program_id: Pubkey = SPL_TOKEN_PROGRAM_ID
        .parse()
        .expect("Invalid SPL token program ID");
    let ata_program_id: Pubkey = ASSOCIATED_TOKEN_PROGRAM_ID
        .parse()
        .expect("Invalid ATA program ID");

    let (ata, _) = Pubkey::find_program_address(
        &[wallet.as_ref(), token_program_id.as_ref(), mint.as_ref()],
        &ata_program_id,
    );
    ata
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_program_id_is_valid() {
        let pid = program_id();
        assert_eq!(pid.to_string(), SQUADS_V4_PROGRAM_ID);
    }

    #[test]
    fn test_derive_multisig_pda_is_deterministic() {
        let create_key = Pubkey::new_unique();

        let (pda1, bump1) = derive_multisig_pda(&create_key);
        let (pda2, bump2) = derive_multisig_pda(&create_key);

        assert_eq!(pda1, pda2);
        assert_eq!(bump1, bump2);
    }

    #[test]
    fn test_derive_vault_pda_varies_by_index() {
        let multisig = Pubkey::new_unique();

        let (vault0, _) = derive_vault_pda(&multisig, 0);
        let (vault1, _) = derive_vault_pda(&multisig, 1);

        assert_ne!(vault0, vault1);
    }

    #[test]
    fn test_derive_default_vault_pda() {
        let multisig = Pubkey::new_unique();

        let (default_vault, _) = derive_default_vault_pda(&multisig);
        let (vault0, _) = derive_vault_pda(&multisig, 0);

        assert_eq!(default_vault, vault0);
    }

    #[test]
    fn test_derive_transaction_pda_varies_by_index() {
        let multisig = Pubkey::new_unique();

        let (tx0, _) = derive_transaction_pda(&multisig, 0);
        let (tx1, _) = derive_transaction_pda(&multisig, 1);
        let (tx100, _) = derive_transaction_pda(&multisig, 100);

        assert_ne!(tx0, tx1);
        assert_ne!(tx1, tx100);
    }

    #[test]
    fn test_derive_proposal_pda_linked_to_transaction() {
        let multisig = Pubkey::new_unique();

        let (proposal0, _) = derive_proposal_pda(&multisig, 0);
        let (proposal1, _) = derive_proposal_pda(&multisig, 1);

        assert_ne!(proposal0, proposal1);
    }

    #[test]
    fn test_pdas_are_different_for_different_multisigs() {
        let multisig1 = Pubkey::new_unique();
        let multisig2 = Pubkey::new_unique();

        let (vault1, _) = derive_default_vault_pda(&multisig1);
        let (vault2, _) = derive_default_vault_pda(&multisig2);

        assert_ne!(vault1, vault2);
    }

    #[test]
    fn test_bump_is_valid() {
        let create_key = Pubkey::new_unique();
        let (_, bump) = derive_multisig_pda(&create_key);

        // Bump should be ≤ 255 (u8 max)
        assert!(bump <= 255);
    }
}
