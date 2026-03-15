//! Squads v4 multisig integration for Solana
//!
//! Provides programmatic interaction with Squads v4 multisig to enable
//! Solana asset management with the same 11/20 threshold security as EVM chains.
//!
//! ## Overview
//!
//! Squads v4 is an audited, battle-tested multisig program on Solana. This module
//! provides a Rust client that enables:
//!
//! - Creating proposals for transactions
//! - Approving/rejecting proposals with Ed25519 signatures
//! - Executing approved proposals when threshold is reached
//! - Querying proposal status and multisig configuration
//!
//! ## Architecture
//!
//! Since Solana doesn't have BN254 precompiles (like EVM chains), we use Squads v4
//! multisig instead of BLS signatures. Oracles hold both key types:
//! - BLS (BN254) keys for EVM chain custody
//! - Ed25519 keys for Solana custody via Squads
//!
//! The threshold is identical (11/20) to maintain consistent security across chains.
//!
//! ## Usage
//!
//! ```ignore
//! use common::integrations::squads::{SquadsClient, SquadsConfig, SolanaCluster};
//!
//! // Initialize client
//! let config = SquadsConfig::new(SolanaCluster::MainnetBeta, multisig_pubkey);
//! let client = SquadsClient::new(config)?;
//!
//! // Create a proposal
//! let result = client.create_proposal(&keypair, transfer_instruction).await?;
//!
//! // Approve the proposal (each oracle does this with their key)
//! client.approve_proposal(&keypair, result.proposal_id).await?;
//!
//! // Execute when threshold reached
//! let exec = client.execute_proposal(&keypair, result.proposal_id).await?;
//! ```
//!
//! ## Supported Operations
//!
//! - SPL token transfers via `build_transfer_tx()`
//! - Jupiter swaps via `build_swap_tx()`
//! - Any arbitrary instruction via `create_proposal()`
//!
//! ## Security
//!
//! - Ed25519 keys are separate from BLS keys
//! - Member validation before all operations
//! - Threshold enforcement before execution
//! - Proposal expiry handling (if configured)

mod accounts;
mod client;
mod error;
mod instructions;
mod pda;
mod types;

pub use accounts::{
    MultisigAccount, MultisigMember, Permissions, ProposalAccount, ProposalState,
    VaultTransactionAccount, MULTISIG_DISCRIMINATOR, PROPOSAL_DISCRIMINATOR,
    VAULT_TRANSACTION_DISCRIMINATOR,
};
pub use client::{SquadsClient, EXPECTED_MEMBERS, EXPECTED_THRESHOLD};
pub use error::SquadsError;
pub use instructions::{
    discriminator, proposal_approve, proposal_cancel, proposal_create, proposal_reject,
    vault_transaction_create, vault_transaction_execute, ProposalCreateArgs,
    VaultTransactionCreateArgs,
};
pub use pda::{
    derive_associated_token_account, derive_default_vault_pda, derive_multisig_pda,
    derive_proposal_pda, derive_spending_limit_pda, derive_transaction_pda, derive_vault_pda,
    program_id, ASSOCIATED_TOKEN_PROGRAM_ID, SEED_MULTISIG, SEED_PREFIX, SEED_PROPOSAL,
    SEED_SPENDING_LIMIT, SEED_TRANSACTION, SEED_VAULT, SPL_TOKEN_PROGRAM_ID,
    SQUADS_V4_PROGRAM_ID,
};
pub use types::{
    CreateProposalResult, ExecuteProposalResult, PendingProposal, ProposalStatus, SolanaCluster,
    SquadsConfig, TokenTransfer,
};
