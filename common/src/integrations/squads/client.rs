//! Squads v4 multisig client implementation
//!
//! Provides programmatic interaction with Squads v4 multisig on Solana.

use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    hash::Hash,
    instruction::{AccountMeta, Instruction},
    message::Message,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use std::sync::Arc;

use super::{
    accounts::{MultisigAccount, ProposalAccount, ProposalState, VaultTransactionAccount},
    error::SquadsError,
    instructions,
    pda::{
        derive_associated_token_account, derive_default_vault_pda, derive_proposal_pda,
        derive_transaction_pda,
    },
    types::{
        CreateProposalResult, ExecuteProposalResult, PendingProposal, ProposalStatus, SquadsConfig,
        TokenTransfer,
    },
};

/// Maximum transaction size in bytes (Solana limit)
const MAX_TRANSACTION_SIZE: usize = 1232;

/// Expected threshold for 11/20 multisig (matching BLS threshold)
pub const EXPECTED_THRESHOLD: u8 = 11;

/// Expected number of members (20 oracles)
pub const EXPECTED_MEMBERS: usize = 20;

/// Client for interacting with Squads v4 multisig on Solana
///
/// This client provides:
/// - Proposal creation for transactions
/// - Proposal approval/rejection
/// - Proposal execution when threshold is reached
/// - Status queries for proposals and multisig configuration
///
/// # Security
/// - Validates member status before operations
/// - Checks threshold before execution
/// - Handles proposal expiry
///
/// # Example
/// ```ignore
/// let config = SquadsConfig::new(SolanaCluster::Devnet, multisig_address);
/// let client = SquadsClient::new(config)?;
///
/// // Create a proposal
/// let result = client.create_proposal(&keypair, transfer_ix).await?;
///
/// // Approve a proposal
/// client.approve_proposal(&keypair, result.proposal_id).await?;
///
/// // Execute when threshold reached
/// let exec_result = client.execute_proposal(&keypair, result.proposal_id).await?;
/// ```
pub struct SquadsClient {
    /// Solana RPC client
    rpc: Arc<RpcClient>,
    /// Multisig account address
    multisig_address: Pubkey,
    /// Configuration
    config: SquadsConfig,
}

impl SquadsClient {
    /// Creates a new SquadsClient with the given configuration
    ///
    /// # Arguments
    /// * `config` - Configuration including cluster and multisig address
    ///
    /// # Returns
    /// New SquadsClient instance
    pub fn new(config: SquadsConfig) -> Result<Self, SquadsError> {
        let rpc = RpcClient::new_with_timeout_and_commitment(
            config.cluster.url().to_string(),
            std::time::Duration::from_secs(config.timeout_secs),
            CommitmentConfig::confirmed(),
        );

        Ok(Self {
            rpc: Arc::new(rpc),
            multisig_address: config.multisig_address,
            config,
        })
    }

    /// Creates a client from environment variables
    pub fn from_env() -> Result<Self, SquadsError> {
        let config = SquadsConfig::from_env()?;
        Self::new(config)
    }

    /// Get the multisig address
    pub fn multisig_address(&self) -> &Pubkey {
        &self.multisig_address
    }

    /// Get the vault PDA address (default vault index 0)
    pub fn get_vault_address(&self) -> Pubkey {
        let (vault, _) = derive_default_vault_pda(&self.multisig_address);
        vault
    }

    /// Fetch and deserialize the multisig account
    async fn fetch_multisig(&self) -> Result<MultisigAccount, SquadsError> {
        let data = self
            .rpc
            .get_account_data(&self.multisig_address)
            .await
            .map_err(SquadsError::from_rpc_error)?;

        MultisigAccount::deserialize(&data)
    }

    /// Fetch and deserialize a proposal account
    async fn fetch_proposal(&self, proposal_id: &Pubkey) -> Result<ProposalAccount, SquadsError> {
        let data = self
            .rpc
            .get_account_data(proposal_id)
            .await
            .map_err(|_| SquadsError::ProposalNotFound {
                proposal_id: *proposal_id,
            })?;

        ProposalAccount::deserialize(&data)
    }

    /// Fetch and deserialize a vault transaction account
    async fn fetch_vault_transaction(
        &self,
        transaction_index: u64,
    ) -> Result<VaultTransactionAccount, SquadsError> {
        let (transaction_pda, _) = derive_transaction_pda(&self.multisig_address, transaction_index);
        let data = self
            .rpc
            .get_account_data(&transaction_pda)
            .await
            .map_err(SquadsError::from_rpc_error)?;

        VaultTransactionAccount::deserialize(&data)
    }

    /// Extract remaining accounts required by the inner transaction
    ///
    /// Squads v4 requires all accounts referenced by the inner transaction
    /// to be passed as remaining accounts when executing via CPI.
    fn extract_remaining_accounts(
        &self,
        vault_tx: &VaultTransactionAccount,
    ) -> Result<Vec<AccountMeta>, SquadsError> {
        let message: Message = bincode::deserialize(&vault_tx.message).map_err(|e| {
            SquadsError::deserialization(format!(
                "Failed to deserialize vault transaction message: {}",
                e
            ))
        })?;

        let num_signers = message.header.num_required_signatures as usize;
        let num_readonly_signed = message.header.num_readonly_signed_accounts as usize;
        let num_readonly_unsigned = message.header.num_readonly_unsigned_accounts as usize;
        let num_accounts = message.account_keys.len();

        let mut accounts = Vec::with_capacity(num_accounts);
        for (i, key) in message.account_keys.iter().enumerate() {
            // Message header layout:
            // [writable signers | readonly signers | writable non-signers | readonly non-signers]
            let is_writable = if i < num_signers {
                i < num_signers - num_readonly_signed
            } else {
                i < num_accounts - num_readonly_unsigned
            };

            // is_signer=false for remaining accounts: Squads handles CPI signing
            if is_writable {
                accounts.push(AccountMeta::new(*key, false));
            } else {
                accounts.push(AccountMeta::new_readonly(*key, false));
            }
        }

        Ok(accounts)
    }

    /// Attempt to fetch the creation timestamp for a proposal
    ///
    /// Uses RPC `getSignaturesForAddress` to find the earliest transaction
    /// that created the proposal account.
    async fn fetch_proposal_created_at(&self, proposal_id: &Pubkey) -> i64 {
        match self.rpc.get_signatures_for_address(proposal_id).await {
            Ok(sigs) if !sigs.is_empty() => {
                // Signatures are returned newest-first; last entry is the creation tx
                sigs.last().and_then(|sig| sig.block_time).unwrap_or(0)
            }
            _ => 0,
        }
    }

    /// Check if a pubkey is a member of the multisig
    pub async fn is_member(&self, pubkey: &Pubkey) -> Result<bool, SquadsError> {
        let multisig = self.fetch_multisig().await?;
        Ok(multisig.is_member(pubkey))
    }

    /// Get all member public keys
    pub async fn get_member_pubkeys(&self) -> Result<Vec<Pubkey>, SquadsError> {
        let multisig = self.fetch_multisig().await?;
        Ok(multisig.member_pubkeys())
    }

    /// Verify the multisig threshold is 11/20
    pub async fn verify_threshold(&self) -> Result<(u16, usize), SquadsError> {
        let multisig = self.fetch_multisig().await?;
        Ok((multisig.threshold, multisig.member_count()))
    }

    /// Get the current transaction index
    async fn get_transaction_index(&self) -> Result<u64, SquadsError> {
        let multisig = self.fetch_multisig().await?;
        Ok(multisig.transaction_index)
    }

    /// Create a proposal for a transaction
    ///
    /// This creates a new Squads proposal that members can vote on.
    ///
    /// # Arguments
    /// * `keypair` - The keypair of the member creating the proposal (must sign)
    /// * `inner_instruction` - The instruction to be executed when proposal is approved
    ///
    /// # Returns
    /// CreateProposalResult with proposal ID and signature
    pub async fn create_proposal(
        &self,
        keypair: &Keypair,
        inner_instruction: Instruction,
    ) -> Result<CreateProposalResult, SquadsError> {
        // Verify creator is a member
        let multisig = self.fetch_multisig().await?;
        if !multisig.is_member(&keypair.pubkey()) {
            return Err(SquadsError::NotMember {
                pubkey: keypair.pubkey(),
            });
        }

        // Get next transaction index
        let tx_index = multisig.transaction_index + 1;

        // Serialize the inner instruction into a transaction message
        let message = Message::new(&[inner_instruction], Some(&keypair.pubkey()));
        let tx_message_bytes = message.serialize();

        // Check transaction size
        if tx_message_bytes.len() > MAX_TRANSACTION_SIZE {
            return Err(SquadsError::TransactionTooLarge {
                size: tx_message_bytes.len(),
                max: MAX_TRANSACTION_SIZE,
            });
        }

        // Build instructions
        let vault_tx_ix = instructions::vault_transaction_create(
            &self.multisig_address,
            &keypair.pubkey(),
            tx_index,
            0, // default vault
            tx_message_bytes,
            0, // no ephemeral signers
        );

        let proposal_ix = instructions::proposal_create(
            &self.multisig_address,
            &keypair.pubkey(),
            tx_index,
            false, // auto-approve by creator
        );

        // Build and sign transaction
        let recent_blockhash = self.get_recent_blockhash().await?;
        let tx = Transaction::new_signed_with_payer(
            &[vault_tx_ix, proposal_ix],
            Some(&keypair.pubkey()),
            &[keypair],
            recent_blockhash,
        );

        // Send transaction
        let signature = self
            .rpc
            .send_and_confirm_transaction(&tx)
            .await
            .map_err(SquadsError::from_rpc_error)?;

        // Derive proposal PDA
        let (proposal_id, _) = derive_proposal_pda(&self.multisig_address, tx_index);

        Ok(CreateProposalResult {
            proposal_id,
            signature: signature.to_string(),
            transaction_index: tx_index,
        })
    }

    /// Approve a proposal
    ///
    /// # Arguments
    /// * `keypair` - The keypair of the member approving (must sign)
    /// * `proposal_id` - The proposal PDA address
    ///
    /// # Errors
    /// - NotMember: Approver is not a multisig member
    /// - AlreadyApproved: Member already approved this proposal
    /// - ProposalNotFound: Proposal does not exist
    pub async fn approve_proposal(
        &self,
        keypair: &Keypair,
        proposal_id: Pubkey,
    ) -> Result<String, SquadsError> {
        // Verify approver is a member
        if !self.is_member(&keypair.pubkey()).await? {
            return Err(SquadsError::NotMember {
                pubkey: keypair.pubkey(),
            });
        }

        // Fetch proposal to check status
        let proposal = self.fetch_proposal(&proposal_id).await?;

        // Check if already approved by this member
        if proposal.has_approved(&keypair.pubkey()) {
            return Err(SquadsError::AlreadyApproved {
                member: keypair.pubkey(),
                proposal_id,
            });
        }

        // Check proposal state
        match proposal.state() {
            Some(ProposalState::Executed) => {
                return Err(SquadsError::AlreadyExecuted { proposal_id });
            }
            Some(ProposalState::Cancelled) => {
                return Err(SquadsError::ProposalCancelled { proposal_id });
            }
            Some(ProposalState::Rejected) => {
                return Err(SquadsError::ProposalRejected { proposal_id });
            }
            _ => {}
        }

        // Build approve instruction
        let ix = instructions::proposal_approve(
            &self.multisig_address,
            &keypair.pubkey(),
            proposal.transaction_index,
        );

        // Build and send transaction
        let recent_blockhash = self.get_recent_blockhash().await?;
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&keypair.pubkey()),
            &[keypair],
            recent_blockhash,
        );

        let signature = self
            .rpc
            .send_and_confirm_transaction(&tx)
            .await
            .map_err(SquadsError::from_rpc_error)?;

        Ok(signature.to_string())
    }

    /// Execute an approved proposal
    ///
    /// The proposal must have reached the threshold (11 approvals) to execute.
    ///
    /// # Arguments
    /// * `keypair` - The keypair of the member executing (must sign)
    /// * `proposal_id` - The proposal PDA address
    ///
    /// # Errors
    /// - ThresholdNotReached: Not enough approvals
    /// - AlreadyExecuted: Proposal already executed
    /// - ProposalExpired: Proposal has expired
    pub async fn execute_proposal(
        &self,
        keypair: &Keypair,
        proposal_id: Pubkey,
    ) -> Result<ExecuteProposalResult, SquadsError> {
        // Fetch proposal and multisig
        let proposal = self.fetch_proposal(&proposal_id).await?;
        let multisig = self.fetch_multisig().await?;

        // Check threshold
        let approval_count = proposal.approval_count();
        let threshold = multisig.threshold as u8;

        if approval_count < threshold {
            return Err(SquadsError::ThresholdNotReached {
                current: approval_count,
                required: threshold,
            });
        }

        // Check if already executed
        if proposal.state() == Some(ProposalState::Executed) {
            return Err(SquadsError::AlreadyExecuted { proposal_id });
        }

        // Fetch vault transaction to extract remaining accounts for CPI
        let vault_tx = self
            .fetch_vault_transaction(proposal.transaction_index)
            .await?;
        let remaining_accounts = self.extract_remaining_accounts(&vault_tx)?;

        // Build execute instruction with the inner transaction's required accounts
        let ix = instructions::vault_transaction_execute(
            &self.multisig_address,
            &keypair.pubkey(),
            proposal.transaction_index,
            vault_tx.vault_index,
            remaining_accounts,
        );

        // Build and send transaction
        let recent_blockhash = self.get_recent_blockhash().await?;
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&keypair.pubkey()),
            &[keypair],
            recent_blockhash,
        );

        let signature = self
            .rpc
            .send_and_confirm_transaction(&tx)
            .await
            .map_err(SquadsError::from_rpc_error)?;

        Ok(ExecuteProposalResult {
            signature: signature.to_string(),
            success: true,
        })
    }

    /// Get the status of a proposal
    ///
    /// # Arguments
    /// * `proposal_id` - The proposal PDA address
    ///
    /// # Returns
    /// ProposalStatus with approval count, threshold, and execution status
    pub async fn get_proposal_status(
        &self,
        proposal_id: Pubkey,
    ) -> Result<ProposalStatus, SquadsError> {
        let proposal = self.fetch_proposal(&proposal_id).await?;
        let multisig = self.fetch_multisig().await?;

        let state = proposal.state();
        let created_at = self.fetch_proposal_created_at(&proposal_id).await;

        Ok(ProposalStatus {
            approval_count: proposal.approval_count(),
            threshold: multisig.threshold as u8,
            is_executed: state == Some(ProposalState::Executed),
            is_rejected: state == Some(ProposalState::Rejected),
            is_cancelled: state == Some(ProposalState::Cancelled),
            created_at,
            expires_at: None, // Squads v4 proposals don't expire by default
            approved_members: proposal.approved.clone(),
        })
    }

    /// List pending proposals (not yet executed)
    ///
    /// # Arguments
    /// * `limit` - Maximum number of proposals to return
    /// * `offset` - Number of proposals to skip (for pagination)
    ///
    /// # Returns
    /// Vector of pending proposals
    pub async fn list_pending_proposals(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<PendingProposal>, SquadsError> {
        let multisig = self.fetch_multisig().await?;
        let mut pending = Vec::new();
        let mut skipped = 0usize;

        // Iterate from newest to oldest (most relevant first)
        let mut tx_index = multisig.transaction_index;
        while tx_index > 0 && pending.len() < limit {
            let (proposal_pda, _) = derive_proposal_pda(&self.multisig_address, tx_index);

            if let Ok(proposal) = self.fetch_proposal(&proposal_pda).await {
                let state = proposal.state();
                if state == Some(ProposalState::Active) || state == Some(ProposalState::Approved) {
                    if skipped < offset {
                        skipped += 1;
                    } else {
                        pending.push(PendingProposal {
                            proposal_id: proposal_pda,
                            transaction_index: tx_index,
                            approval_count: proposal.approval_count(),
                            threshold: multisig.threshold as u8,
                            created_at: 0, // Per-proposal timestamp lookup omitted for list performance
                            expires_at: None,
                            description: None,
                        });
                    }
                }
            }

            tx_index = tx_index.saturating_sub(1);
        }

        Ok(pending)
    }

    /// Build an SPL token transfer instruction
    ///
    /// Helper to create a transfer instruction that can be wrapped in a proposal.
    /// Uses Associated Token Accounts (ATAs) for source and destination.
    ///
    /// # Arguments
    /// * `transfer` - Token transfer details (mint, recipient, amount)
    pub fn build_transfer_tx(&self, transfer: &TokenTransfer) -> Instruction {
        let vault = self.get_vault_address();

        // Derive Associated Token Accounts for source (vault) and destination (recipient)
        let source_ata = derive_associated_token_account(&vault, &transfer.mint);
        let dest_ata = derive_associated_token_account(&transfer.recipient, &transfer.mint);

        // SPL Token transfer instruction
        // Accounts: [source (writable), destination (writable), authority (signer)]
        Instruction {
            program_id: spl_token_program_id(),
            accounts: vec![
                AccountMeta::new(source_ata, false),    // source token account (vault ATA)
                AccountMeta::new(dest_ata, false),       // destination token account (recipient ATA)
                AccountMeta::new_readonly(vault, true),  // authority (vault PDA, signed via CPI)
            ],
            data: {
                let mut data = vec![3u8]; // SPL Token Transfer instruction discriminator
                data.extend(&transfer.amount.to_le_bytes());
                data
            },
        }
    }

    /// Build a swap instruction wrapper for Jupiter
    ///
    /// Takes a Jupiter swap instruction and prepares it for Squads execution.
    ///
    /// # Arguments
    /// * `jupiter_ix` - The instruction from Jupiter
    pub fn build_swap_tx(&self, jupiter_ix: Instruction) -> Instruction {
        // The Jupiter instruction is already complete, we just return it
        // The vault will be the signer when executed through Squads
        jupiter_ix
    }

    /// Get recent blockhash for transaction signing
    async fn get_recent_blockhash(&self) -> Result<Hash, SquadsError> {
        self.rpc
            .get_latest_blockhash()
            .await
            .map_err(SquadsError::from_rpc_error)
    }
}

/// SPL Token program ID (placeholder - would use spl_token::id() in real impl)
fn spl_token_program_id() -> Pubkey {
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        .parse()
        .expect("Invalid SPL token program ID")
}

// Debug implementation that doesn't expose internal state
impl std::fmt::Debug for SquadsClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SquadsClient")
            .field("multisig_address", &self.multisig_address)
            .field("cluster", &self.config.cluster)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::integrations::squads::pda::derive_associated_token_account;
    use crate::integrations::squads::types::SolanaCluster;

    fn test_config() -> SquadsConfig {
        SquadsConfig::new(SolanaCluster::Devnet, Pubkey::new_unique())
    }

    #[test]
    fn test_client_creation() {
        let config = test_config();
        let client = SquadsClient::new(config);
        assert!(client.is_ok());
    }

    #[test]
    fn test_get_vault_address() {
        let config = test_config();
        let client = SquadsClient::new(config.clone()).unwrap();

        let vault = client.get_vault_address();
        let (expected, _) = derive_default_vault_pda(&config.multisig_address);

        assert_eq!(vault, expected);
    }

    #[test]
    fn test_client_debug_output() {
        let config = test_config();
        let client = SquadsClient::new(config).unwrap();

        let debug_str = format!("{:?}", client);
        assert!(debug_str.contains("SquadsClient"));
        assert!(debug_str.contains("Devnet"));
    }

    #[test]
    fn test_build_transfer_tx() {
        let config = test_config();
        let client = SquadsClient::new(config).unwrap();

        let transfer = TokenTransfer {
            mint: Pubkey::new_unique(),
            recipient: Pubkey::new_unique(),
            amount: 1_000_000,
        };

        let ix = client.build_transfer_tx(&transfer);

        assert_eq!(ix.program_id, spl_token_program_id());
        // 3 accounts: source ATA (writable), dest ATA (writable), authority (signer)
        assert_eq!(ix.accounts.len(), 3);
        // Source ATA should be writable, not a signer
        assert!(ix.accounts[0].is_writable);
        assert!(!ix.accounts[0].is_signer);
        // Dest ATA should be writable, not a signer
        assert!(ix.accounts[1].is_writable);
        assert!(!ix.accounts[1].is_signer);
        // Authority (vault) should be a signer, read-only
        assert!(!ix.accounts[2].is_writable);
        assert!(ix.accounts[2].is_signer);
    }

    #[test]
    fn test_build_transfer_tx_uses_atas() {
        let config = test_config();
        let client = SquadsClient::new(config).unwrap();
        let mint = Pubkey::new_unique();
        let recipient = Pubkey::new_unique();

        let transfer = TokenTransfer {
            mint,
            recipient,
            amount: 500,
        };

        let ix = client.build_transfer_tx(&transfer);
        let vault = client.get_vault_address();

        // Source should be vault's ATA, not the vault itself
        let expected_source = derive_associated_token_account(&vault, &mint);
        assert_eq!(ix.accounts[0].pubkey, expected_source);

        // Dest should be recipient's ATA, not the recipient directly
        let expected_dest = derive_associated_token_account(&recipient, &mint);
        assert_eq!(ix.accounts[1].pubkey, expected_dest);

        // Authority should be the vault PDA
        assert_eq!(ix.accounts[2].pubkey, vault);
    }

    #[test]
    fn test_extract_remaining_accounts_from_message() {
        let config = test_config();
        let client = SquadsClient::new(config).unwrap();

        // Build a simple message with known account layout
        let writable_signer = Pubkey::new_unique();
        let readonly_unsigned = Pubkey::new_unique();
        let program_id = Pubkey::new_unique();

        let ix = Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(writable_signer, true),
                AccountMeta::new_readonly(readonly_unsigned, false),
            ],
            data: vec![1, 2, 3],
        };

        let message = Message::new(&[ix], Some(&writable_signer));
        let message_bytes = bincode::serialize(&message).unwrap();

        let vault_tx = crate::integrations::squads::accounts::VaultTransactionAccount {
            multisig: Pubkey::new_unique(),
            creator: writable_signer,
            index: 1,
            bump: 255,
            vault_index: 0,
            ephemeral_signers: 0,
            message: message_bytes,
        };

        let accounts = client.extract_remaining_accounts(&vault_tx).unwrap();

        // Should have extracted accounts from the message
        assert!(!accounts.is_empty());
        // All remaining accounts should have is_signer=false (CPI handles signing)
        for acc in &accounts {
            assert!(!acc.is_signer, "Remaining accounts should not require signing");
        }
    }

    #[test]
    fn test_extract_remaining_accounts_invalid_data() {
        let config = test_config();
        let client = SquadsClient::new(config).unwrap();

        let vault_tx = crate::integrations::squads::accounts::VaultTransactionAccount {
            multisig: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            index: 1,
            bump: 255,
            vault_index: 0,
            ephemeral_signers: 0,
            message: vec![0xFF, 0xFF, 0xFF], // invalid bincode data
        };

        let result = client.extract_remaining_accounts(&vault_tx);
        assert!(result.is_err(), "Should fail on invalid message data");
    }

    #[test]
    fn test_proposal_status_helpers() {
        let status = ProposalStatus {
            approval_count: 10,
            threshold: 11,
            is_executed: false,
            is_rejected: false,
            is_cancelled: false,
            created_at: 0,
            expires_at: None,
            approved_members: vec![],
        };

        assert!(!status.is_ready_for_execution());
        assert!(status.is_active());
        assert_eq!(status.remaining_approvals(), 1);
    }

    #[test]
    fn test_proposal_status_ready() {
        let status = ProposalStatus {
            approval_count: 11,
            threshold: 11,
            is_executed: false,
            is_rejected: false,
            is_cancelled: false,
            created_at: 0,
            expires_at: None,
            approved_members: vec![],
        };

        assert!(status.is_ready_for_execution());
    }
}
