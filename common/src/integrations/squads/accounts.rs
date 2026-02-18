//! Squads v4 account structures
//!
//! These structures match the Squads v4 on-chain account layouts for deserialization.
//! Reference: https://github.com/Squads-Protocol/v4

use borsh::{BorshDeserialize, BorshSerialize};
use solana_sdk::pubkey::Pubkey;

use super::error::SquadsError;

/// Discriminator for Squads v4 multisig account
///
/// `sha256("account:Multisig")[0..8]`
/// Verified against Squads v4 IDL: `sdk/multisig/idl/squads_multisig_program.json`
pub const MULTISIG_DISCRIMINATOR: [u8; 8] = [131, 194, 200, 156, 179, 47, 58, 30];

/// Discriminator for Squads v4 proposal account
///
/// `sha256("account:Proposal")[0..8]`
/// Verified against Squads v4 IDL: `sdk/multisig/idl/squads_multisig_program.json`
pub const PROPOSAL_DISCRIMINATOR: [u8; 8] = [217, 230, 98, 24, 119, 170, 47, 137];

/// Discriminator for Squads v4 vault transaction account
///
/// `sha256("account:VaultTransaction")[0..8]`
/// Verified against Squads v4 IDL: `sdk/multisig/idl/squads_multisig_program.json`
pub const VAULT_TRANSACTION_DISCRIMINATOR: [u8; 8] = [126, 169, 10, 105, 126, 230, 58, 20];

/// Member permissions in Squads v4
#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshDeserialize, BorshSerialize)]
pub struct Permissions {
    /// Permission mask bits
    pub mask: u8,
}

impl Permissions {
    /// Can initiate proposals
    pub const INITIATE: u8 = 1 << 0;
    /// Can vote on proposals
    pub const VOTE: u8 = 1 << 1;
    /// Can execute approved proposals
    pub const EXECUTE: u8 = 1 << 2;

    /// Create default permissions (all abilities)
    pub fn all() -> Self {
        Self {
            mask: Self::INITIATE | Self::VOTE | Self::EXECUTE,
        }
    }

    /// Check if has initiate permission
    pub fn can_initiate(&self) -> bool {
        self.mask & Self::INITIATE != 0
    }

    /// Check if has vote permission
    pub fn can_vote(&self) -> bool {
        self.mask & Self::VOTE != 0
    }

    /// Check if has execute permission
    pub fn can_execute(&self) -> bool {
        self.mask & Self::EXECUTE != 0
    }
}

/// A member of the multisig
#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct MultisigMember {
    /// The member's public key
    pub key: Pubkey,
    /// The member's permissions
    pub permissions: Permissions,
}

/// Squads v4 multisig account structure
#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct MultisigAccount {
    /// The key used to derive the multisig PDA
    pub create_key: Pubkey,
    /// Bump seed for PDA derivation
    pub bump: u8,
    /// Number of signatures required to approve a transaction
    pub threshold: u16,
    /// The current transaction index (auto-incrementing)
    pub transaction_index: u64,
    /// Last time this multisig was modified
    pub stale_transaction_index: u64,
    /// The members of the multisig
    pub members: Vec<MultisigMember>,
    /// Optional time-lock in seconds
    pub time_lock: u32,
    /// Optional spending limit configuration bump (0 if not configured)
    pub spending_limit_config_bump: u8,
    /// Padding for future use
    pub _reserved: [u8; 64],
}

impl MultisigAccount {
    /// Deserialize from account data, skipping the discriminator
    pub fn deserialize(data: &[u8]) -> Result<Self, SquadsError> {
        if data.len() < 8 {
            return Err(SquadsError::deserialization("Account data too short"));
        }

        // Verify discriminator
        if &data[..8] != MULTISIG_DISCRIMINATOR {
            return Err(SquadsError::deserialization("Invalid multisig discriminator"));
        }

        // Deserialize the rest
        Self::try_from_slice(&data[8..]).map_err(SquadsError::from_borsh_error)
    }

    /// Check if a pubkey is a member of this multisig
    pub fn is_member(&self, pubkey: &Pubkey) -> bool {
        self.members.iter().any(|m| m.key == *pubkey)
    }

    /// Get a member by pubkey
    pub fn get_member(&self, pubkey: &Pubkey) -> Option<&MultisigMember> {
        self.members.iter().find(|m| m.key == *pubkey)
    }

    /// Get all member pubkeys
    pub fn member_pubkeys(&self) -> Vec<Pubkey> {
        self.members.iter().map(|m| m.key).collect()
    }

    /// Get the number of members
    pub fn member_count(&self) -> usize {
        self.members.len()
    }
}

/// Proposal status in Squads v4
#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshDeserialize, BorshSerialize)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum ProposalState {
    /// Proposal is still accepting votes
    Active = 0,
    /// Proposal has been approved (threshold reached)
    Approved = 1,
    /// Proposal has been rejected
    Rejected = 2,
    /// Proposal has been executed
    Executed = 3,
    /// Proposal has been cancelled
    Cancelled = 4,
}

impl ProposalState {
    /// Create from u8 value
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(ProposalState::Active),
            1 => Some(ProposalState::Approved),
            2 => Some(ProposalState::Rejected),
            3 => Some(ProposalState::Executed),
            4 => Some(ProposalState::Cancelled),
            _ => None,
        }
    }
}

/// Squads v4 proposal account structure
#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct ProposalAccount {
    /// The multisig this proposal belongs to
    pub multisig: Pubkey,
    /// The transaction this proposal is for
    pub transaction_index: u64,
    /// Current status of the proposal
    pub status: u8,
    /// Bump seed for PDA derivation
    pub bump: u8,
    /// List of members who approved
    pub approved: Vec<Pubkey>,
    /// List of members who rejected
    pub rejected: Vec<Pubkey>,
    /// List of members who cancelled
    pub cancelled: Vec<Pubkey>,
    /// Padding for future use
    pub _reserved: [u8; 8],
}

impl ProposalAccount {
    /// Deserialize from account data, skipping the discriminator
    pub fn deserialize(data: &[u8]) -> Result<Self, SquadsError> {
        if data.len() < 8 {
            return Err(SquadsError::deserialization("Account data too short"));
        }

        // Verify discriminator
        if &data[..8] != PROPOSAL_DISCRIMINATOR {
            return Err(SquadsError::deserialization("Invalid proposal discriminator"));
        }

        // Deserialize the rest
        Self::try_from_slice(&data[8..]).map_err(SquadsError::from_borsh_error)
    }

    /// Get the proposal state as an enum
    pub fn state(&self) -> Option<ProposalState> {
        ProposalState::from_u8(self.status)
    }

    /// Number of approvals
    pub fn approval_count(&self) -> u8 {
        self.approved.len() as u8
    }

    /// Number of rejections
    pub fn rejection_count(&self) -> u8 {
        self.rejected.len() as u8
    }

    /// Check if a member has already voted
    pub fn has_voted(&self, member: &Pubkey) -> bool {
        self.approved.contains(member)
            || self.rejected.contains(member)
            || self.cancelled.contains(member)
    }

    /// Check if a member has approved
    pub fn has_approved(&self, member: &Pubkey) -> bool {
        self.approved.contains(member)
    }
}

/// Squads v4 vault transaction account structure
#[derive(Debug, Clone, BorshDeserialize, BorshSerialize)]
pub struct VaultTransactionAccount {
    /// The multisig this transaction belongs to
    pub multisig: Pubkey,
    /// The creator of this transaction
    pub creator: Pubkey,
    /// The transaction index
    pub index: u64,
    /// Bump seed for PDA derivation
    pub bump: u8,
    /// Vault index (which vault to execute from)
    pub vault_index: u8,
    /// Ephemeral signers count
    pub ephemeral_signers: u8,
    /// The serialized transaction message
    pub message: Vec<u8>,
}

impl VaultTransactionAccount {
    /// Deserialize from account data, skipping the discriminator
    pub fn deserialize(data: &[u8]) -> Result<Self, SquadsError> {
        if data.len() < 8 {
            return Err(SquadsError::deserialization("Account data too short"));
        }

        // Verify discriminator
        if &data[..8] != VAULT_TRANSACTION_DISCRIMINATOR {
            return Err(SquadsError::deserialization(
                "Invalid vault transaction discriminator",
            ));
        }

        // Deserialize the rest
        Self::try_from_slice(&data[8..]).map_err(SquadsError::from_borsh_error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permissions_all() {
        let perms = Permissions::all();
        assert!(perms.can_initiate());
        assert!(perms.can_vote());
        assert!(perms.can_execute());
    }

    #[test]
    fn test_permissions_partial() {
        let perms = Permissions {
            mask: Permissions::VOTE | Permissions::EXECUTE,
        };
        assert!(!perms.can_initiate());
        assert!(perms.can_vote());
        assert!(perms.can_execute());
    }

    #[test]
    fn test_proposal_state_from_u8() {
        assert_eq!(ProposalState::from_u8(0), Some(ProposalState::Active));
        assert_eq!(ProposalState::from_u8(1), Some(ProposalState::Approved));
        assert_eq!(ProposalState::from_u8(2), Some(ProposalState::Rejected));
        assert_eq!(ProposalState::from_u8(3), Some(ProposalState::Executed));
        assert_eq!(ProposalState::from_u8(4), Some(ProposalState::Cancelled));
        assert_eq!(ProposalState::from_u8(5), None);
    }

    #[test]
    fn test_multisig_is_member() {
        let member1 = Pubkey::new_unique();
        let member2 = Pubkey::new_unique();
        let non_member = Pubkey::new_unique();

        let multisig = MultisigAccount {
            create_key: Pubkey::new_unique(),
            bump: 255,
            threshold: 2,
            transaction_index: 0,
            stale_transaction_index: 0,
            members: vec![
                MultisigMember {
                    key: member1,
                    permissions: Permissions::all(),
                },
                MultisigMember {
                    key: member2,
                    permissions: Permissions::all(),
                },
            ],
            time_lock: 0,
            spending_limit_config_bump: 0,
            _reserved: [0; 64],
        };

        assert!(multisig.is_member(&member1));
        assert!(multisig.is_member(&member2));
        assert!(!multisig.is_member(&non_member));
    }

    #[test]
    fn test_proposal_has_voted() {
        let voter1 = Pubkey::new_unique();
        let voter2 = Pubkey::new_unique();
        let non_voter = Pubkey::new_unique();

        let proposal = ProposalAccount {
            multisig: Pubkey::new_unique(),
            transaction_index: 1,
            status: 0,
            bump: 255,
            approved: vec![voter1],
            rejected: vec![voter2],
            cancelled: vec![],
            _reserved: [0; 8],
        };

        assert!(proposal.has_voted(&voter1));
        assert!(proposal.has_voted(&voter2));
        assert!(!proposal.has_voted(&non_voter));
        assert!(proposal.has_approved(&voter1));
        assert!(!proposal.has_approved(&voter2));
    }

    #[test]
    fn test_deserialize_invalid_discriminator() {
        let data = vec![0u8; 100];
        let result = MultisigAccount::deserialize(&data);
        assert!(matches!(result, Err(SquadsError::DeserializationError { .. })));
    }

    #[test]
    fn test_deserialize_too_short() {
        let data = vec![0u8; 4];
        let result = MultisigAccount::deserialize(&data);
        assert!(matches!(result, Err(SquadsError::DeserializationError { .. })));
    }
}
