//! Types for Squads v4 multisig operations

use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;

/// Solana cluster endpoint configuration
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SolanaCluster {
    /// Devnet - for development and testing
    Devnet,
    /// Testnet - for testing
    Testnet,
    /// Mainnet-beta - production
    MainnetBeta,
    /// Custom RPC endpoint
    Custom(String),
}

impl SolanaCluster {
    /// Returns the RPC URL for this cluster
    pub fn url(&self) -> &str {
        match self {
            SolanaCluster::Devnet => "https://api.devnet.solana.com",
            SolanaCluster::Testnet => "https://api.testnet.solana.com",
            SolanaCluster::MainnetBeta => "https://api.mainnet-beta.solana.com",
            SolanaCluster::Custom(url) => url,
        }
    }

    /// Creates a cluster from a string URL or known network name
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "devnet" => SolanaCluster::Devnet,
            "testnet" => SolanaCluster::Testnet,
            "mainnet" | "mainnet-beta" => SolanaCluster::MainnetBeta,
            _ => SolanaCluster::Custom(s.to_string()),
        }
    }
}

impl Default for SolanaCluster {
    fn default() -> Self {
        SolanaCluster::Devnet
    }
}

/// Configuration for SquadsClient
#[derive(Debug, Clone)]
pub struct SquadsConfig {
    /// Solana cluster endpoint
    pub cluster: SolanaCluster,
    /// Squads multisig address
    pub multisig_address: Pubkey,
    /// Request timeout in seconds
    pub timeout_secs: u64,
}

impl SquadsConfig {
    /// Creates a new configuration
    pub fn new(cluster: SolanaCluster, multisig_address: Pubkey) -> Self {
        Self {
            cluster,
            multisig_address,
            timeout_secs: 30,
        }
    }

    /// Creates configuration from environment variables
    ///
    /// Required environment variables:
    /// - `SOLANA_RPC_URL` or `SOLANA_CLUSTER`: RPC endpoint or cluster name
    /// - `SQUADS_MULTISIG_ADDRESS`: Base58-encoded multisig address
    pub fn from_env() -> Result<Self, crate::integrations::squads::error::SquadsError> {
        use crate::integrations::squads::error::SquadsError;

        let cluster_str = std::env::var("SOLANA_RPC_URL")
            .or_else(|_| std::env::var("SOLANA_CLUSTER"))
            .map_err(|_| SquadsError::MissingConfig {
                field: "SOLANA_RPC_URL or SOLANA_CLUSTER".to_string(),
            })?;

        let multisig_str = std::env::var("SQUADS_MULTISIG_ADDRESS").map_err(|_| {
            SquadsError::MissingConfig {
                field: "SQUADS_MULTISIG_ADDRESS".to_string(),
            }
        })?;

        let multisig_address: Pubkey = multisig_str
            .parse()
            .map_err(|_| SquadsError::DeserializationError {
                message: format!("Invalid multisig address: {}", multisig_str),
            })?;

        Ok(Self::new(SolanaCluster::from_str(&cluster_str), multisig_address))
    }

    /// Sets the request timeout
    pub fn with_timeout(mut self, timeout_secs: u64) -> Self {
        self.timeout_secs = timeout_secs;
        self
    }
}

/// Status of a Squads proposal
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProposalStatus {
    /// Number of approvals received
    pub approval_count: u8,
    /// Required threshold for execution
    pub threshold: u8,
    /// Whether the proposal has been executed
    pub is_executed: bool,
    /// Whether the proposal has been rejected
    pub is_rejected: bool,
    /// Whether the proposal has been cancelled
    pub is_cancelled: bool,
    /// Unix timestamp when the proposal was created
    pub created_at: i64,
    /// Unix timestamp when the proposal expires (if any)
    pub expires_at: Option<i64>,
    /// List of members who have approved
    pub approved_members: Vec<Pubkey>,
}

impl ProposalStatus {
    /// Check if the proposal is ready for execution
    pub fn is_ready_for_execution(&self) -> bool {
        self.approval_count >= self.threshold
            && !self.is_executed
            && !self.is_rejected
            && !self.is_cancelled
    }

    /// Check if the proposal is still active (can receive approvals)
    pub fn is_active(&self) -> bool {
        !self.is_executed && !self.is_rejected && !self.is_cancelled
    }

    /// Check if the proposal has expired
    pub fn is_expired(&self, current_time: i64) -> bool {
        self.expires_at.map_or(false, |exp| current_time >= exp)
    }

    /// Get the number of remaining approvals needed
    pub fn remaining_approvals(&self) -> u8 {
        self.threshold.saturating_sub(self.approval_count)
    }
}

/// Result of creating a proposal
#[derive(Debug, Clone)]
pub struct CreateProposalResult {
    /// The proposal public key (PDA)
    pub proposal_id: Pubkey,
    /// The transaction signature
    pub signature: String,
    /// The vault transaction index
    pub transaction_index: u64,
}

/// Result of executing a proposal
#[derive(Debug, Clone)]
pub struct ExecuteProposalResult {
    /// The transaction signature
    pub signature: String,
    /// Whether execution was successful
    pub success: bool,
}

/// Pending proposal summary for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingProposal {
    /// The proposal public key
    pub proposal_id: Pubkey,
    /// The transaction index
    pub transaction_index: u64,
    /// Current approval count
    pub approval_count: u8,
    /// Required threshold
    pub threshold: u8,
    /// When the proposal was created
    pub created_at: i64,
    /// When the proposal expires (if any)
    pub expires_at: Option<i64>,
    /// Brief description (if available)
    pub description: Option<String>,
}

/// Token mint and amount for SPL token transfers
#[derive(Debug, Clone)]
pub struct TokenTransfer {
    /// The token mint address
    pub mint: Pubkey,
    /// The recipient address
    pub recipient: Pubkey,
    /// Amount in smallest units (e.g., lamports for SOL, base units for SPL)
    pub amount: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solana_cluster_urls() {
        assert_eq!(
            SolanaCluster::Devnet.url(),
            "https://api.devnet.solana.com"
        );
        assert_eq!(
            SolanaCluster::Testnet.url(),
            "https://api.testnet.solana.com"
        );
        assert_eq!(
            SolanaCluster::MainnetBeta.url(),
            "https://api.mainnet-beta.solana.com"
        );
        assert_eq!(
            SolanaCluster::Custom("https://my-rpc.com".to_string()).url(),
            "https://my-rpc.com"
        );
    }

    #[test]
    fn test_solana_cluster_from_str() {
        assert_eq!(SolanaCluster::from_str("devnet"), SolanaCluster::Devnet);
        assert_eq!(SolanaCluster::from_str("DEVNET"), SolanaCluster::Devnet);
        assert_eq!(SolanaCluster::from_str("testnet"), SolanaCluster::Testnet);
        assert_eq!(SolanaCluster::from_str("mainnet"), SolanaCluster::MainnetBeta);
        assert_eq!(
            SolanaCluster::from_str("mainnet-beta"),
            SolanaCluster::MainnetBeta
        );
        assert!(matches!(
            SolanaCluster::from_str("https://custom.rpc.com"),
            SolanaCluster::Custom(_)
        ));
    }

    #[test]
    fn test_proposal_status_ready_for_execution() {
        let status = ProposalStatus {
            approval_count: 11,
            threshold: 11,
            is_executed: false,
            is_rejected: false,
            is_cancelled: false,
            created_at: 1000,
            expires_at: None,
            approved_members: vec![],
        };
        assert!(status.is_ready_for_execution());
        assert!(status.is_active());
    }

    #[test]
    fn test_proposal_status_not_ready() {
        let status = ProposalStatus {
            approval_count: 10,
            threshold: 11,
            is_executed: false,
            is_rejected: false,
            is_cancelled: false,
            created_at: 1000,
            expires_at: None,
            approved_members: vec![],
        };
        assert!(!status.is_ready_for_execution());
        assert!(status.is_active());
        assert_eq!(status.remaining_approvals(), 1);
    }

    #[test]
    fn test_proposal_status_executed() {
        let status = ProposalStatus {
            approval_count: 11,
            threshold: 11,
            is_executed: true,
            is_rejected: false,
            is_cancelled: false,
            created_at: 1000,
            expires_at: None,
            approved_members: vec![],
        };
        assert!(!status.is_ready_for_execution());
        assert!(!status.is_active());
    }

    #[test]
    fn test_proposal_status_expired() {
        let status = ProposalStatus {
            approval_count: 5,
            threshold: 11,
            is_executed: false,
            is_rejected: false,
            is_cancelled: false,
            created_at: 1000,
            expires_at: Some(2000),
            approved_members: vec![],
        };
        assert!(!status.is_expired(1500));
        assert!(status.is_expired(2000));
        assert!(status.is_expired(2500));
    }

    #[test]
    fn test_squads_config_with_timeout() {
        let config = SquadsConfig::new(SolanaCluster::Devnet, Pubkey::new_unique())
            .with_timeout(60);
        assert_eq!(config.timeout_secs, 60);
    }
}
