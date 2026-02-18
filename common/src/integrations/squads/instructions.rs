//! Instruction builders for Squads v4
//!
//! Builds Solana instructions for Squads v4 multisig operations.
//! Reference: https://github.com/Squads-Protocol/v4

use borsh::{to_vec, BorshSerialize};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
};

#[allow(deprecated)]
use solana_sdk::system_program;

use super::pda::{derive_proposal_pda, derive_transaction_pda, derive_vault_pda, program_id};

/// Instruction discriminators for Squads v4
///
/// Computed as `sha256("global:<snake_case_name>")[0..8]` per Anchor convention.
/// Verified against Squads v4 IDL: `sdk/multisig/idl/squads_multisig_program.json`
/// See: https://github.com/Squads-Protocol/v4
pub mod discriminator {
    /// proposal_create instruction — `sha256("global:proposal_create")[0..8]`
    pub const PROPOSAL_CREATE: [u8; 8] = [194, 26, 166, 183, 128, 17, 197, 210];
    /// proposal_approve instruction — `sha256("global:proposal_approve")[0..8]`
    pub const PROPOSAL_APPROVE: [u8; 8] = [160, 12, 47, 103, 17, 136, 27, 48];
    /// proposal_reject instruction — `sha256("global:proposal_reject")[0..8]`
    pub const PROPOSAL_REJECT: [u8; 8] = [208, 226, 30, 60, 234, 52, 19, 164];
    /// proposal_cancel instruction — `sha256("global:proposal_cancel")[0..8]`
    pub const PROPOSAL_CANCEL: [u8; 8] = [245, 67, 180, 231, 31, 207, 163, 64];
    /// vault_transaction_create instruction — `sha256("global:vault_transaction_create")[0..8]`
    pub const VAULT_TRANSACTION_CREATE: [u8; 8] = [153, 32, 180, 183, 26, 156, 230, 160];
    /// vault_transaction_execute instruction — `sha256("global:vault_transaction_execute")[0..8]`
    pub const VAULT_TRANSACTION_EXECUTE: [u8; 8] = [236, 40, 161, 183, 231, 164, 10, 143];
}

/// Arguments for vault_transaction_create instruction
#[derive(Debug, Clone, BorshSerialize)]
pub struct VaultTransactionCreateArgs {
    /// Vault index (default: 0)
    pub vault_index: u8,
    /// Number of ephemeral signers needed
    pub ephemeral_signers: u8,
    /// The transaction message bytes
    pub transaction_message: Vec<u8>,
    /// Optional memo
    pub memo: Option<String>,
}

/// Arguments for proposal_create instruction
#[derive(Debug, Clone, BorshSerialize)]
pub struct ProposalCreateArgs {
    /// Transaction index to create proposal for
    pub transaction_index: u64,
    /// Whether to auto-approve by the creator
    pub draft: bool,
}

/// Build instruction to create a vault transaction
///
/// This creates the underlying transaction that will be voted on.
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `creator` - The member creating the transaction
/// * `transaction_index` - The transaction index
/// * `vault_index` - The vault index (default: 0)
/// * `transaction_message` - Serialized transaction message
/// * `ephemeral_signers` - Number of ephemeral signers needed (default: 0)
pub fn vault_transaction_create(
    multisig: &Pubkey,
    creator: &Pubkey,
    transaction_index: u64,
    vault_index: u8,
    transaction_message: Vec<u8>,
    ephemeral_signers: u8,
) -> Instruction {
    let (transaction_pda, _) = derive_transaction_pda(multisig, transaction_index);

    let args = VaultTransactionCreateArgs {
        vault_index,
        ephemeral_signers,
        transaction_message,
        memo: None,
    };

    let mut data = discriminator::VAULT_TRANSACTION_CREATE.to_vec();
    data.extend(to_vec(&args).expect("Failed to serialize args"));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*multisig, false),
            AccountMeta::new(transaction_pda, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(*creator, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

/// Build instruction to create a proposal for voting
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `creator` - The member creating the proposal
/// * `transaction_index` - The transaction index to create proposal for
/// * `draft` - If true, creator does not auto-approve
pub fn proposal_create(
    multisig: &Pubkey,
    creator: &Pubkey,
    transaction_index: u64,
    draft: bool,
) -> Instruction {
    let (transaction_pda, _) = derive_transaction_pda(multisig, transaction_index);
    let (proposal_pda, _) = derive_proposal_pda(multisig, transaction_index);

    let args = ProposalCreateArgs {
        transaction_index,
        draft,
    };

    let mut data = discriminator::PROPOSAL_CREATE.to_vec();
    data.extend(to_vec(&args).expect("Failed to serialize args"));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*multisig, false),
            AccountMeta::new_readonly(transaction_pda, false),
            AccountMeta::new(proposal_pda, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(*creator, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

/// Build instruction to approve a proposal
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `member` - The member approving the proposal
/// * `transaction_index` - The transaction index
pub fn proposal_approve(
    multisig: &Pubkey,
    member: &Pubkey,
    transaction_index: u64,
) -> Instruction {
    let (proposal_pda, _) = derive_proposal_pda(multisig, transaction_index);

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(proposal_pda, false),
            AccountMeta::new_readonly(*member, true),
        ],
        data: discriminator::PROPOSAL_APPROVE.to_vec(),
    }
}

/// Build instruction to reject a proposal
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `member` - The member rejecting the proposal
/// * `transaction_index` - The transaction index
pub fn proposal_reject(
    multisig: &Pubkey,
    member: &Pubkey,
    transaction_index: u64,
) -> Instruction {
    let (proposal_pda, _) = derive_proposal_pda(multisig, transaction_index);

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(proposal_pda, false),
            AccountMeta::new_readonly(*member, true),
        ],
        data: discriminator::PROPOSAL_REJECT.to_vec(),
    }
}

/// Build instruction to cancel a proposal (creator only)
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `creator` - The member who created the proposal (only they can cancel)
/// * `transaction_index` - The transaction index
pub fn proposal_cancel(
    multisig: &Pubkey,
    creator: &Pubkey,
    transaction_index: u64,
) -> Instruction {
    let (proposal_pda, _) = derive_proposal_pda(multisig, transaction_index);

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(proposal_pda, false),
            AccountMeta::new_readonly(*creator, true),
        ],
        data: discriminator::PROPOSAL_CANCEL.to_vec(),
    }
}

/// Build instruction to execute an approved proposal
///
/// # Arguments
/// * `multisig` - The multisig PDA address
/// * `executor` - The member executing the proposal
/// * `transaction_index` - The transaction index
/// * `vault_index` - The vault index (default: 0)
/// * `remaining_accounts` - Additional accounts needed by the inner transaction
pub fn vault_transaction_execute(
    multisig: &Pubkey,
    executor: &Pubkey,
    transaction_index: u64,
    vault_index: u8,
    remaining_accounts: Vec<AccountMeta>,
) -> Instruction {
    let (transaction_pda, _) = derive_transaction_pda(multisig, transaction_index);
    let (proposal_pda, _) = derive_proposal_pda(multisig, transaction_index);
    let (vault_pda, _) = derive_vault_pda(multisig, vault_index);

    let mut accounts = vec![
        AccountMeta::new_readonly(*multisig, false),
        AccountMeta::new_readonly(transaction_pda, false),
        AccountMeta::new(proposal_pda, false),
        AccountMeta::new(vault_pda, false),
        AccountMeta::new(*executor, true),
    ];

    // Add any additional accounts needed by the inner transaction
    accounts.extend(remaining_accounts);

    Instruction {
        program_id: program_id(),
        accounts,
        data: discriminator::VAULT_TRANSACTION_EXECUTE.to_vec(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_transaction_create_builds_correctly() {
        let multisig = Pubkey::new_unique();
        let creator = Pubkey::new_unique();
        let tx_message = vec![1, 2, 3, 4, 5];

        let ix = vault_transaction_create(&multisig, &creator, 0, 0, tx_message.clone(), 0);

        assert_eq!(ix.program_id, program_id());
        assert_eq!(ix.accounts.len(), 5);
        assert!(ix.data.starts_with(&discriminator::VAULT_TRANSACTION_CREATE));
    }

    #[test]
    fn test_proposal_create_builds_correctly() {
        let multisig = Pubkey::new_unique();
        let creator = Pubkey::new_unique();

        let ix = proposal_create(&multisig, &creator, 0, false);

        assert_eq!(ix.program_id, program_id());
        assert_eq!(ix.accounts.len(), 6);
        assert!(ix.data.starts_with(&discriminator::PROPOSAL_CREATE));
    }

    #[test]
    fn test_proposal_approve_builds_correctly() {
        let multisig = Pubkey::new_unique();
        let member = Pubkey::new_unique();

        let ix = proposal_approve(&multisig, &member, 0);

        assert_eq!(ix.program_id, program_id());
        assert_eq!(ix.accounts.len(), 3);
        assert_eq!(ix.data, discriminator::PROPOSAL_APPROVE);
    }

    #[test]
    fn test_proposal_reject_builds_correctly() {
        let multisig = Pubkey::new_unique();
        let member = Pubkey::new_unique();

        let ix = proposal_reject(&multisig, &member, 5);

        assert_eq!(ix.program_id, program_id());
        assert_eq!(ix.accounts.len(), 3);
        assert_eq!(ix.data, discriminator::PROPOSAL_REJECT);
    }

    #[test]
    fn test_proposal_cancel_builds_correctly() {
        let multisig = Pubkey::new_unique();
        let creator = Pubkey::new_unique();

        let ix = proposal_cancel(&multisig, &creator, 10);

        assert_eq!(ix.program_id, program_id());
        assert_eq!(ix.accounts.len(), 3);
        assert_eq!(ix.data, discriminator::PROPOSAL_CANCEL);
    }

    #[test]
    fn test_vault_transaction_execute_builds_correctly() {
        let multisig = Pubkey::new_unique();
        let executor = Pubkey::new_unique();
        let extra_account = Pubkey::new_unique();

        let remaining = vec![AccountMeta::new(extra_account, false)];
        let ix = vault_transaction_execute(&multisig, &executor, 0, 0, remaining);

        assert_eq!(ix.program_id, program_id());
        assert_eq!(ix.accounts.len(), 6); // 5 base + 1 remaining
        assert_eq!(ix.data, discriminator::VAULT_TRANSACTION_EXECUTE);
    }

    #[test]
    fn test_transaction_index_affects_pda() {
        let multisig = Pubkey::new_unique();
        let member = Pubkey::new_unique();

        let ix0 = proposal_approve(&multisig, &member, 0);
        let ix1 = proposal_approve(&multisig, &member, 1);

        // The proposal PDA account should be different
        assert_ne!(ix0.accounts[1].pubkey, ix1.accounts[1].pubkey);
    }
}
